# Lesson 26: Time-Series and Analytics

Every metric your system emits — CPU usage, request latency, revenue per
minute — is a time-series data point. Storing and querying billions of
timestamped values efficiently requires fundamentally different storage
than your OLTP database.

**Analogy:** Your OLTP database is like a filing cabinet where you grab
one customer's folder. A time-series database is like a weather station's
logbook — it only appends new readings, you always query by time range,
and you never update yesterday's temperature.

---

## OLTP vs OLAP

```
OLTP (Online Transaction Processing):
  "Get order #12345"
  "Update customer address"
  Small reads/writes, many concurrent users
  Row-oriented: fetch all columns for one row

  ┌────┬──────┬──────┬───────┬─────────┐
  │ ID │ Name │ City │ Sales │ Revenue │  ← row stored together
  ├────┼──────┼──────┼───────┼─────────┤
  │  1 │ Alice│ NYC  │  150  │  45000  │
  │  2 │ Bob  │ LA   │  230  │  72000  │
  └────┴──────┴──────┴───────┴─────────┘

OLAP (Online Analytical Processing):
  "Total revenue by city for Q4 2024"
  "Average latency per endpoint, last 7 days"
  Huge scans over few columns, few concurrent queries
  Column-oriented: fetch one column across all rows

  Column "Revenue": [45000, 72000, 31000, ...]  ← stored together
  Column "City":    [NYC, LA, NYC, ...]          ← stored together
```

### Why Column Storage is Faster for Analytics

```
Query: SELECT SUM(revenue) FROM sales WHERE city = 'NYC'

ROW STORE (PostgreSQL):
  Must read ENTIRE rows to get revenue + city columns
  Read: ID, Name, City, Sales, Revenue for EVERY row
  I/O: read 100 bytes per row × 1 billion rows = 100 GB

COLUMN STORE (ClickHouse):
  Only reads the "revenue" and "city" columns
  Read: 4 bytes (revenue) + ~4 bytes (city) per row
  I/O: 8 bytes × 1 billion = 8 GB

  Plus: columns compress much better (same data type)
  Compressed: maybe 800 MB instead of 8 GB

  Result: 100x less I/O than row store
```

---

## Time-Series Data Model

```
Metric: http_requests_total
Labels: {method="GET", endpoint="/api/users", status="200"}
Timestamps + Values:

  ┌─────────────────────┬───────┐
  │     Timestamp       │ Value │
  ├─────────────────────┼───────┤
  │ 2024-01-15 10:00:00 │  1523 │
  │ 2024-01-15 10:00:10 │  1587 │
  │ 2024-01-15 10:00:20 │  1542 │
  │ 2024-01-15 10:00:30 │  1601 │
  │        ...          │  ...  │
  └─────────────────────┴───────┘

Key properties:
  - Append-only (never update old data)
  - Time-ordered (always query by time range)
  - High write throughput (millions of points/sec)
  - Recent data queried most (hot/cold split)
```

### Back-of-Envelope: Metrics Storage

```
Infrastructure monitoring:
  1000 servers × 100 metrics each = 100K time series
  Scrape interval: 10 seconds
  Points per day: 100K × 8640 (seconds/day ÷ 10) = 864M points/day

  Each point: 8 bytes (timestamp) + 8 bytes (value) = 16 bytes
  Raw per day: 864M × 16 = ~14 GB/day

  With compression (delta encoding + gorilla):
  Compressed: ~1.5 GB/day (10:1 compression typical for TSDB)

  Per year: 1.5 GB × 365 = ~550 GB
  Retention 2 years: ~1.1 TB
```

---

## TSDB Design: How InfluxDB/Prometheus Work

```
┌─────────────────────────────────────────────────────┐
│                    TSDB Architecture                  │
│                                                     │
│  ┌──────────────┐                                   │
│  │  Write Path  │                                   │
│  │              │                                   │
│  │  Incoming ──▶ WAL (Write-Ahead Log)             │
│  │  points      │                                   │
│  │           ──▶ In-Memory Buffer                   │
│  │              │                                   │
│  │           ──▶ Flush to Disk (time-partitioned)   │
│  └──────────────┘                                   │
│                                                     │
│  ┌──────────────┐                                   │
│  │  On-Disk     │                                   │
│  │  Storage     │                                   │
│  │              │                                   │
│  │  Block_2024-01-15_10:00  (2-hour block)         │
│  │  Block_2024-01-15_12:00                          │
│  │  Block_2024-01-15_14:00                          │
│  │  ...                                             │
│  └──────────────┘                                   │
│                                                     │
│  ┌──────────────┐                                   │
│  │  Read Path   │                                   │
│  │              │                                   │
│  │  Query ──▶ Identify time blocks to scan          │
│  │        ──▶ Read only relevant blocks             │
│  │        ──▶ Decompress + aggregate                │
│  └──────────────┘                                   │
└─────────────────────────────────────────────────────┘
```

### Time Partitioning

```
Instead of one giant table, partition by time:

  ┌─────────────────┐
  │  Jan 15, 10-12h │  ← recent (in memory, SSD)
  ├─────────────────┤
  │  Jan 15, 08-10h │  ← warm (SSD)
  ├─────────────────┤
  │  Jan 14         │  ← cold (HDD)
  ├─────────────────┤
  │  Dec 2023       │  ← archive (compressed, cheap storage)
  └─────────────────┘

Query "last 2 hours": reads only the top block.
Query "last 30 days": reads 360 blocks, skipping archived data.
```

---

## ClickHouse for Analytics

ClickHouse is a columnar database built for fast aggregation queries.

```sql
-- Create a table for web analytics events
CREATE TABLE page_views (
    timestamp DateTime,
    user_id UInt64,
    page_url String,
    country LowCardinality(String),
    device LowCardinality(String),
    load_time_ms UInt32
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (country, timestamp);
```

**Why ClickHouse is fast:**

```
1. Columnar storage → only reads columns in SELECT
2. Compression → same-type columns compress 10x
3. Vectorized execution → processes data in CPU-cache-sized batches
4. Partition pruning → skips irrelevant time ranges
5. Approximate functions → approx_percentile is 100x faster than exact

Query: SELECT country, avg(load_time_ms)
       FROM page_views
       WHERE timestamp > now() - INTERVAL 7 DAY
       GROUP BY country

Execution:
  1. Prune: skip all partitions older than 7 days
  2. Read: only "country" and "load_time_ms" columns
  3. Decompress in batch
  4. Aggregate with vectorized sum/count
```

---

## Materialized Views

Pre-compute expensive aggregations so dashboards load instantly.

```
RAW DATA (billions of rows):
  timestamp | user_id | event | revenue
  ─────────────────────────────────────
  10:00:01  │ 123     │ buy   │ 29.99
  10:00:01  │ 456     │ view  │ 0
  10:00:02  │ 789     │ buy   │ 14.50
  ...

MATERIALIZED VIEW (pre-aggregated):
  hour       | total_revenue | buy_count | view_count
  ──────────────────────────────────────────────────
  2024-01-15 10:00 │ 145,230 │ 4,521  │ 89,432
  2024-01-15 11:00 │ 167,890 │ 5,102  │ 95,210

Dashboard query "revenue by hour":
  Without MV: scan 864M rows → 30 seconds
  With MV: scan 24 rows (one per hour) → 2ms
```

```go
package analytics

import (
	"context"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
)

type HourlySummary struct {
	Hour         time.Time
	TotalRevenue float64
	BuyCount     uint64
	ViewCount    uint64
}

func QueryHourlySummary(
	ctx context.Context,
	conn clickhouse.Conn,
	start time.Time,
	end time.Time,
) ([]HourlySummary, error) {
	rows, err := conn.Query(ctx, `
		SELECT
			toStartOfHour(timestamp) AS hour,
			sum(revenue) AS total_revenue,
			countIf(event = 'buy') AS buy_count,
			countIf(event = 'view') AS view_count
		FROM page_events
		WHERE timestamp BETWEEN $1 AND $2
		GROUP BY hour
		ORDER BY hour
	`, start, end)
	if err != nil {
		return nil, fmt.Errorf("query hourly summary: %w", err)
	}
	defer rows.Close()

	var results []HourlySummary
	for rows.Next() {
		var s HourlySummary
		if err := rows.Scan(&s.Hour, &s.TotalRevenue, &s.BuyCount, &s.ViewCount); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		results = append(results, s)
	}
	return results, nil
}
```

---

## Downsampling

Keep high-resolution data for recent queries, downsample older data.

```
Resolution strategy:
  Last 24 hours:  10-second granularity (8,640 points/series)
  Last 7 days:    1-minute granularity  (10,080 points/series)
  Last 90 days:   5-minute granularity  (25,920 points/series)
  Last 2 years:   1-hour granularity    (17,520 points/series)

Storage savings:
  Raw 10s data for 2 years: 6.3M points/series
  Downsampled:              62K points/series
  Reduction: 99%
```

---

## Trade-Off Summary

| Decision | Option A | Option B | When to Pick |
|----------|----------|----------|-------------|
| Storage engine | Row (PostgreSQL) | Column (ClickHouse) | Column for analytics, row for OLTP |
| TSDB | Prometheus | InfluxDB | Prometheus for metrics, InfluxDB for IoT/events |
| Aggregation | On-the-fly | Materialized views | MV when dashboard latency matters |
| Retention | Keep everything | Downsample + archive | Downsample when storage cost > query need |
| Query layer | SQL | Custom (PromQL) | SQL for analysts, PromQL for SREs |

---

## Exercises

1. Create a ClickHouse table for application metrics (timestamp, service
   name, endpoint, latency_ms, status_code). Write a query for p99
   latency per endpoint over the last hour.

2. Calculate storage requirements for a monitoring system: 5000 servers,
   200 metrics each, 15-second scrape interval, 1-year retention with
   downsampling after 30 days.

3. Design a materialized view for an e-commerce dashboard showing
   hourly revenue, orders, and average order value by country.

4. Compare query performance: run `SELECT avg(value) WHERE time > now()-7d`
   on 1 billion rows in PostgreSQL vs a columnar store. Estimate the I/O
   difference.

---

*Next: [Lesson 27 — Workflow Engines](./27-workflow-engines.md), where we
orchestrate long-running business processes that span multiple services.*
