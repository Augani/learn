# Lesson 08: SQL vs NoSQL — When to Use What

Every database exists because someone needed to store data in a way that
existing databases handled poorly. There's no universally "best"
database — only the best database for YOUR access patterns.

Think of databases like storage systems in your house:
- **SQL (PostgreSQL)** is a filing cabinet — structured drawers, labeled
  folders, cross-referenced indexes. Great for organized, relational data.
- **MongoDB** is a box of labeled folders — each folder can hold whatever
  it wants. Flexible, fast to toss things in, but harder to cross-reference.
- **Redis** is a sticky note board — fast to write, fast to read, but
  limited space and no complex organization.
- **Cassandra** is a warehouse — massive capacity, simple lookups by
  aisle and shelf number, but don't ask it to search every box.

---

## Category 1: Relational Databases (SQL)

**Examples**: PostgreSQL, MySQL, CockroachDB, SQLite

### How they work

Data lives in tables with fixed schemas. Rows have the same columns.
Tables relate to each other through foreign keys. You query with SQL,
a declarative language for asking questions about structured data.

```
┌─────────────────────────────────┐
│           users                 │
├──────┬──────────┬───────────────┤
│  id  │  name    │  email        │
├──────┼──────────┼───────────────┤
│  1   │  Alice   │  a@test.com   │
│  2   │  Bob     │  b@test.com   │
└──────┴──────────┴───────────────┘
         │
         │ user_id (foreign key)
         ▼
┌──────────────────────────────────────┐
│           orders                     │
├──────┬─────────┬─────────┬───────────┤
│  id  │ user_id │ total   │ status    │
├──────┼─────────┼─────────┼───────────┤
│  1   │    1    │  59.99  │ shipped   │
│  2   │    1    │  24.50  │ delivered │
│  3   │    2    │ 199.00  │ pending   │
└──────┴─────────┴─────────┴───────────┘
```

### Strengths

**ACID transactions**: All-or-nothing operations. Transfer money from
Account A to Account B — either both happen or neither does. This isn't
optional for financial data.

**JOINs**: Combine data from multiple tables in a single query. "Show me
all orders with the customer's name and email" is one SQL statement.

**Schema enforcement**: The database rejects bad data. You can't put a
string where a number should go. This catches bugs before they corrupt
your data.

**Mature tooling**: 40+ years of optimization. Query planners, EXPLAIN
ANALYZE, pg_stat_statements, index advisors. The ecosystem is enormous.

### Weaknesses

**Rigid schema**: Adding a column to a billion-row table can lock it
for minutes. Schema migrations require planning and coordination.

**Horizontal scaling is hard**: JOINs across shards are painful or
impossible. This is why sharding SQL databases is complex (see Lesson 07).

**Not great for hierarchical data**: A deeply nested JSON document
doesn't fit naturally in flat tables. You end up with many tables and
complex JOINs.

### When to use SQL

- Your data has clear relationships (users → orders → items)
- You need transactions (financial systems, inventory)
- You need complex queries (reporting, analytics, search)
- Data integrity matters more than write speed
- You don't know your access patterns yet (SQL is the most flexible)

### PostgreSQL-specific advantages

```sql
SELECT
    u.name,
    COUNT(o.id) AS order_count,
    SUM(o.total) AS lifetime_value
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at > NOW() - INTERVAL '1 year'
GROUP BY u.id, u.name
HAVING SUM(o.total) > 100
ORDER BY lifetime_value DESC;
```

PostgreSQL also handles JSON natively, blurring the line with document
stores:

```sql
CREATE TABLE products (
    id    SERIAL PRIMARY KEY,
    name  TEXT NOT NULL,
    attrs JSONB NOT NULL DEFAULT '{}'
);

SELECT name, attrs->>'color' AS color
FROM products
WHERE attrs @> '{"size": "large"}';
```

---

## Category 2: Document Stores

**Examples**: MongoDB, CouchDB, Firestore

### How they work

Data stored as JSON-like documents in collections (instead of rows in
tables). Each document can have a different structure. No fixed schema.

```json
{
  "_id": "user_123",
  "name": "Alice",
  "email": "a@test.com",
  "addresses": [
    {"type": "home", "city": "Portland", "zip": "97201"},
    {"type": "work", "city": "Seattle", "zip": "98101"}
  ],
  "preferences": {
    "newsletter": true,
    "theme": "dark"
  }
}
```

Notice: addresses and preferences are embedded IN the document. In SQL,
these would be separate tables with foreign keys.

### The denormalization trade-off

```
SQL Approach (normalized):               Document Approach (denormalized):
┌────────┐   ┌───────────┐               ┌──────────────────────┐
│ users  │──►│ addresses │               │  user document       │
└────────┘   └───────────┘               │  ├── name            │
     │                                    │  ├── email           │
     └──────►┌─────────────┐             │  ├── addresses: [..] │
             │ preferences │              │  └── prefs: {..}     │
             └─────────────┘              └──────────────────────┘

3 tables, 2 JOINs                        1 document, 0 JOINs
```

Denormalization trades storage space and update complexity for read
speed. When you read a user, you get EVERYTHING in one query, no JOINs.

### Strengths

**Flexible schema**: Different documents can have different fields. Great
for products with varying attributes (a shirt has "size" and "color",
a laptop has "RAM" and "screen_size").

**Read performance**: All related data in one document means one read,
not multiple JOINs.

**Horizontal scaling**: Documents are self-contained, making sharding
straightforward. MongoDB has built-in sharding.

**Developer experience**: Documents map naturally to objects in code.
What you store is what you get back.

### Weaknesses

**No JOINs**: If you need data from two collections, you make two
queries and merge in application code.

**Data duplication**: Denormalization means the same data exists in
multiple documents. Updating a user's email might require updating it
in dozens of documents.

**Weaker consistency**: MongoDB can lose acknowledged writes in certain
failure scenarios (though this has improved significantly).

**Schema chaos**: "Flexible schema" often means "no schema" which means
bugs. You'll find documents missing fields, fields with wrong types, and
inconsistent data formats. Eventually you end up enforcing schema in
application code anyway.

### When to use document stores

- Data is naturally hierarchical (product catalogs, CMS content)
- Schema changes frequently (early-stage products iterating fast)
- Read patterns are document-centric (always read the whole user profile)
- You need built-in horizontal scaling
- Relationships between documents are rare

### TypeScript with MongoDB

```typescript
interface Product {
  name: string;
  category: string;
  price: number;
  attributes: Record<string, string | number | boolean>;
  reviews: Array<{
    userId: string;
    rating: number;
    text: string;
    createdAt: Date;
  }>;
}

async function getProductsInCategory(
  db: Db,
  category: string,
  minRating: number
): Promise<Product[]> {
  return db.collection<Product>("products")
    .find({
      category,
      "reviews.rating": { $gte: minRating }
    })
    .sort({ price: 1 })
    .limit(50)
    .toArray();
}
```

---

## Category 3: Key-Value Stores

**Examples**: Redis, Memcached, DynamoDB, etcd

### How they work

The simplest model: a key maps to a value. Think of it as a giant hash
map that persists to disk (or doesn't, in the case of Memcached).

```
┌──────────────────┬───────────────────────┐
│       Key        │        Value          │
├──────────────────┼───────────────────────┤
│ user:123         │ {"name":"Alice",...}   │
│ session:abc-def  │ {"userId":123,...}     │
│ rate:api:10.0.1  │ 47                    │
│ cache:prod:456   │ {"name":"Widget",...}  │
└──────────────────┴───────────────────────┘
```

### Redis — the Swiss army knife

Redis isn't just a key-value store. It supports rich data structures:

| Structure    | Use case                          | Example                    |
|-------------|-----------------------------------|----------------------------|
| String       | Cache, counters, flags            | Page cache, rate limiting  |
| Hash         | Object storage                    | User session data          |
| List         | Queues, activity feeds            | Job queue, recent activity |
| Set          | Unique collections, tags          | Online users, categories   |
| Sorted Set   | Leaderboards, priority queues     | Game rankings, scheduling  |
| Stream       | Event log, message queue          | Activity stream            |

### Strengths

**Speed**: Sub-millisecond reads and writes. Redis stores everything in
memory, making it 100x faster than disk-based databases.

**Simplicity**: GET, SET, DELETE. Hard to mess up.

**Atomic operations**: INCR, DECR, SETNX are atomic. Perfect for
counters, rate limiting, distributed locks.

### Weaknesses

**Limited querying**: You can only look up by key. No "find all users
where age > 30". You need to know exactly what you're looking for.

**Memory bound**: Everything lives in RAM. At $6/GB/month for cloud
memory, storing terabytes gets expensive fast.

**Data loss risk**: Even with persistence (RDB snapshots, AOF), Redis
can lose recent writes on crash. Don't use it as your primary database
for critical data.

### When to use key-value stores

- Caching (most common use case)
- Session storage
- Rate limiting
- Leaderboards and counters
- Distributed locks
- Feature flags
- Real-time data that can be rebuilt from a primary database

### Go with Redis

```go
func CacheUser(ctx context.Context, rdb *redis.Client, user *User) error {
    data, err := json.Marshal(user)
    if err != nil {
        return fmt.Errorf("marshal user: %w", err)
    }
    return rdb.Set(ctx, fmt.Sprintf("user:%d", user.ID), data, 15*time.Minute).Err()
}

func GetCachedUser(ctx context.Context, rdb *redis.Client, db *sql.DB, userID int64) (*User, error) {
    key := fmt.Sprintf("user:%d", userID)
    data, err := rdb.Get(ctx, key).Bytes()

    if err == redis.Nil {
        user, dbErr := getUserFromDB(ctx, db, userID)
        if dbErr != nil {
            return nil, dbErr
        }
        _ = CacheUser(ctx, rdb, user)
        return user, nil
    }
    if err != nil {
        return nil, fmt.Errorf("redis get: %w", err)
    }

    var user User
    if err := json.Unmarshal(data, &user); err != nil {
        return nil, fmt.Errorf("unmarshal user: %w", err)
    }
    return &user, nil
}
```

### DynamoDB — key-value at massive scale

DynamoDB is AWS's managed key-value/document hybrid. You define a
partition key (and optional sort key) and access data through those keys.

```
┌───────────────────────────────────────────────┐
│  Table: UserOrders                            │
│  Partition Key: user_id                       │
│  Sort Key: order_date                         │
├──────────┬─────────────┬────────┬─────────────┤
│ user_id  │ order_date  │ total  │ items       │
├──────────┼─────────────┼────────┼─────────────┤
│ user_123 │ 2024-01-15  │ 59.99  │ [...]       │
│ user_123 │ 2024-03-22  │ 24.50  │ [...]       │
│ user_456 │ 2024-02-10  │ 199.00 │ [...]       │
└──────────┴─────────────┴────────┴─────────────┘
```

DynamoDB scales to millions of requests per second with single-digit
millisecond latency. The trade-off: you MUST know your access patterns
up front. Changing them later is expensive.

---

## Category 4: Wide-Column Stores

**Examples**: Apache Cassandra, ScyllaDB, HBase

### How they work

Data organized by rows and column families, but unlike SQL, different
rows can have different columns. Optimized for writing massive amounts
of data across many nodes.

```
Row Key: "sensor_42"
┌──────────────────────────────────────────────┐
│  Column Family: "readings"                   │
│  ┌───────────────┬───────────┬──────────────┐│
│  │ temp:2024-01  │ temp:02   │ humidity:01  ││
│  │    22.5       │   23.1    │    45%       ││
│  └───────────────┴───────────┴──────────────┘│
│                                              │
│  Column Family: "metadata"                   │
│  ┌───────────────┬──────────────┐            │
│  │ location      │ install_date │            │
│  │ "Building A"  │ "2023-06-15" │            │
│  └───────────────┴──────────────┘            │
└──────────────────────────────────────────────┘
```

### Cassandra's architecture

Cassandra uses a ring of equal nodes. No primary/replica distinction.
Every node can accept reads AND writes.

```
           Node A
          ╱      ╲
    Node F        Node B
    │                  │
    Node E        Node C
          ╲      ╱
           Node D

Every node is equal. No single point of failure.
Data replicated across 3 nodes (configurable).
```

### Strengths

**Write throughput**: Cassandra is optimized for writes. It writes to a
commit log and memtable in memory, then flushes to disk later. Writes
are always fast regardless of data size.

**Linear scalability**: Need 2x throughput? Add 2x nodes. Performance
scales linearly with cluster size. No resharding needed.

**No single point of failure**: Every node is equal. Any node can go
down without affecting availability. Compare this to PostgreSQL where
the primary going down is an emergency.

**Geographic distribution**: Built-in multi-datacenter replication. Data
can be written in US-East and automatically replicated to EU-West.

### Weaknesses

**Limited query patterns**: You must design your schema around your
queries. Want to query by a different field? Create another table with
that field as the partition key.

**No JOINs, no aggregations**: No GROUP BY, no SUM, no complex queries.
All of that happens in application code.

**Eventual consistency by default**: A write might not be visible on
all nodes immediately. You can tune consistency levels per query, but
strong consistency costs performance.

**Operational complexity**: Running a Cassandra cluster requires
specialized knowledge. Compaction, repair, tombstones, and gossip
protocol tuning are non-trivial.

### When to use wide-column stores

- Write-heavy workloads (IoT sensor data, event logging, metrics)
- Time-series data at massive scale
- You need multi-region replication
- Availability matters more than consistency
- Simple access patterns (no complex queries)

---

## Category 5: Graph Databases

**Examples**: Neo4j, Amazon Neptune, DGraph

### How they work

Data stored as nodes (entities) and edges (relationships). Both nodes
and edges can have properties. Queries traverse relationships.

```
    ┌─────────┐    FOLLOWS     ┌─────────┐
    │  Alice  │───────────────►│   Bob   │
    └────┬────┘                └────┬────┘
         │                          │
     LIKES                      WROTE
         │                          │
         ▼                          ▼
    ┌─────────┐    ABOUT       ┌─────────┐
    │ Post #3 │◄───────────────│ Post #7 │
    │ "Go tip"│                │ "Rust!" │
    └─────────┘                └─────────┘
```

### Strengths

**Relationship queries**: "Find friends of friends who like the same
movies" is a simple traversal in a graph database. In SQL, that's
multiple self-JOINs that get exponentially slower with depth.

**Flexible relationships**: Add new relationship types without schema
changes. "Alice MENTORS Bob" is just a new edge.

**Pattern matching**: Find cycles, shortest paths, clusters, and
communities in your data.

### Weaknesses

**Niche use case**: Most data isn't relationship-heavy enough to justify
a graph database. If your queries don't traverse relationships, a graph
database adds complexity for no benefit.

**Scaling challenges**: Graph queries can touch unpredictable amounts of
data. A "friends of friends" query on a well-connected node might touch
millions of edges.

**Small ecosystem**: Fewer tools, fewer developers, fewer resources
compared to SQL or even MongoDB.

### When to use graph databases

- Social networks (friend recommendations, influence mapping)
- Fraud detection (finding suspicious transaction patterns)
- Knowledge graphs (connecting concepts and entities)
- Network topology (infrastructure dependency mapping)
- Recommendation engines (users who liked X also liked Y)

---

## Category 6: Time-Series Databases

**Examples**: TimescaleDB, InfluxDB, Prometheus, QuestDB

### How they work

Optimized for data that arrives with a timestamp — metrics, events,
sensor readings. They compress time-stamped data efficiently and support
time-windowed queries natively.

```
┌─────────────────────────────────────────────────────┐
│  Metric: cpu_usage                                  │
│  Tags: host=web-1, region=us-east                   │
├──────────────────────┬──────────┬───────────────────┤
│     timestamp        │  value   │  extra fields     │
├──────────────────────┼──────────┼───────────────────┤
│ 2024-01-15 10:00:00  │   45.2   │  cores=16         │
│ 2024-01-15 10:00:10  │   47.8   │  cores=16         │
│ 2024-01-15 10:00:20  │   52.1   │  cores=16         │
│ 2024-01-15 10:00:30  │   48.3   │  cores=16         │
└──────────────────────┴──────────┴───────────────────┘
```

### Strengths

**Compression**: Time-series data has high locality. Timestamps increase
monotonically, values change slowly. Compression ratios of 10x-20x are
common.

**Time-windowed queries**: "Average CPU over the last hour, grouped by
5-minute buckets" is a native operation, not an expensive aggregation.

**Automatic data lifecycle**: Old data gets downsampled (1-second
resolution → 1-minute averages) and eventually deleted. Built-in
retention policies.

### When to use time-series databases

- Application metrics and monitoring
- IoT sensor data collection
- Financial market data
- Log aggregation and analysis
- Any data where "what happened in the last N minutes" is the primary
  query pattern

### TimescaleDB advantage

TimescaleDB is PostgreSQL with time-series superpowers. You get full SQL
plus time-series optimizations. If you already use PostgreSQL, it's the
easiest time-series option.

```sql
SELECT
    time_bucket('5 minutes', created_at) AS bucket,
    host,
    AVG(cpu_usage) AS avg_cpu,
    MAX(cpu_usage) AS max_cpu
FROM metrics
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY bucket, host
ORDER BY bucket DESC;
```

---

## The Decision Matrix

When starting a project, use this framework:

```
┌──────────────────────────────────────────────────────────┐
│                   DECISION MATRIX                        │
├──────────────┬───────┬───────┬───────┬───────┬───────────┤
│  Need        │  SQL  │ Doc   │  KV   │ Wide  │  Graph    │
│              │       │ Store │ Store │ Col   │           │
├──────────────┼───────┼───────┼───────┼───────┼───────────┤
│ Transactions │  ★★★  │  ★    │  ★    │  ★    │  ★★       │
│ Joins        │  ★★★  │  ★    │  —    │  —    │  ★★★      │
│ Flexible     │  ★    │  ★★★  │  ★★   │  ★★   │  ★★       │
│  schema      │       │       │       │       │           │
│ Write speed  │  ★★   │  ★★   │  ★★★  │  ★★★  │  ★★       │
│ Read speed   │  ★★   │  ★★   │  ★★★  │  ★★   │  ★★       │
│ Scale-out    │  ★    │  ★★   │  ★★★  │  ★★★  │  ★        │
│ Complex      │  ★★★  │  ★    │  —    │  —    │  ★★★      │
│  queries     │       │       │       │       │           │
│ Ecosystem    │  ★★★  │  ★★   │  ★★   │  ★    │  ★        │
└──────────────┴───────┴───────┴───────┴───────┴───────────┘

★★★ = excellent   ★★ = good   ★ = limited   — = not applicable
```

### Quick decision guide

```
What kind of data do you have?

├── Structured with relationships → PostgreSQL
│   (users, orders, products, anything with foreign keys)
│
├── Documents with varying structure → MongoDB or PostgreSQL JSONB
│   (product catalogs, CMS content, user profiles)
│
├── Simple lookups by key → Redis (ephemeral) or DynamoDB (persistent)
│   (sessions, cache, feature flags, config)
│
├── Massive write throughput → Cassandra / ScyllaDB
│   (IoT, event logging, metrics at enormous scale)
│
├── Relationship-heavy queries → Neo4j
│   (social graphs, fraud detection, recommendations)
│
└── Time-stamped metrics → TimescaleDB or InfluxDB
    (monitoring, sensor data, financial ticks)
```

---

## Polyglot Persistence

Real systems use multiple databases, each for what it does best. This is
called polyglot persistence.

### Example: E-commerce platform

```
┌──────────────────────────────────────────────────────┐
│                    Application                       │
└────┬──────────┬──────────┬──────────┬───────────────┘
     │          │          │          │
     ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
│Postgres│ │ Redis  │ │Elastic │ │ TimescaleDB│
│        │ │        │ │ search │ │            │
│Users   │ │Sessions│ │Product │ │ Metrics    │
│Orders  │ │Cart    │ │Search  │ │ Monitoring │
│Payments│ │Cache   │ │Full-   │ │ Analytics  │
│        │ │Rate    │ │text    │ │            │
│        │ │limits  │ │        │ │            │
└────────┘ └────────┘ └────────┘ └────────────┘
 Source of   Fast       Search      Time-series
 truth       ephemeral  optimized   optimized
```

### The rules of polyglot persistence

**1. One source of truth.** PostgreSQL holds the authoritative data.
Redis cache and Elasticsearch indexes are derived from it.

**2. Accept eventual consistency between stores.** When a product price
changes in PostgreSQL, the Elasticsearch index might be stale for a few
seconds. Design for this.

**3. Don't overdo it.** Each database is another system to deploy,
monitor, backup, and debug. Start with PostgreSQL. Add others only when
PostgreSQL genuinely can't handle a specific workload.

### Keeping stores in sync

```
                    ┌──────────┐
                    │ Postgres │ (write)
                    └────┬─────┘
                         │
                    Change Data
                    Capture (CDC)
                         │
                    ┌────┴─────┐
                    │  Kafka   │ (event stream)
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
         ┌────────┐ ┌────────┐ ┌────────┐
         │ Redis  │ │Elastic │ │ Data   │
         │ Cache  │ │ Search │ │ Lake   │
         └────────┘ └────────┘ └────────┘
```

Change Data Capture (CDC) streams changes from PostgreSQL to Kafka.
Consumers read from Kafka and update their respective stores. Tools like
Debezium make this straightforward.

---

## Common Mistakes

### Mistake 1: Using MongoDB because "it's faster"

MongoDB isn't inherently faster than PostgreSQL. It's faster for
specific access patterns (read a whole document by ID). For anything
involving JOINs or complex queries, PostgreSQL wins.

### Mistake 2: Using Redis as a primary database

Redis is amazing for caching but dangerous as a primary store. Even with
persistence enabled, it can lose data. Keep your source of truth in
PostgreSQL or DynamoDB.

### Mistake 3: Choosing based on hype

"Netflix uses Cassandra, so we should too." Netflix has billions of
events per day across thousands of servers. You have a CRUD app with
10,000 users. Use PostgreSQL.

### Mistake 4: Premature polyglot persistence

Running PostgreSQL + Redis + MongoDB + Elasticsearch when your app has
1,000 users. Each database is a deployment target, a monitoring target,
a backup target, and a potential failure point.

### Mistake 5: Ignoring PostgreSQL's flexibility

PostgreSQL has JSONB columns (flexible schema), full-text search (basic
Elasticsearch replacement), PostGIS (geospatial), and TimescaleDB
extension (time-series). One database can do a lot before you need a
second one.

---

## TypeScript Example: Multi-Database Service

```typescript
interface UserService {
  getUser(id: string): Promise<User>;
  searchUsers(query: string): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<void>;
}

class MultiDBUserService implements UserService {
  constructor(
    private pg: Pool,
    private redis: RedisClient,
    private elastic: ElasticClient
  ) {}

  async getUser(id: string): Promise<User> {
    const cacheKey = `user:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as User;
    }

    const result = await this.pg.query(
      "SELECT id, name, email, bio FROM users WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      throw new NotFoundError(`User ${id} not found`);
    }

    const user = result.rows[0] as User;
    await this.redis.set(cacheKey, JSON.stringify(user), "EX", 900);
    return user;
  }

  async searchUsers(query: string): Promise<User[]> {
    const response = await this.elastic.search({
      index: "users",
      body: {
        query: {
          multi_match: {
            query,
            fields: ["name", "bio", "email"],
          },
        },
      },
    });
    return response.hits.hits.map((hit: { _source: User }) => hit._source);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields
      .map((f, i) => `${f} = $${i + 2}`)
      .join(", ");

    await this.pg.query(
      `UPDATE users SET ${setClause} WHERE id = $1`,
      [id, ...values]
    );

    await this.redis.del(`user:${id}`);

    await this.elastic.update({
      index: "users",
      id,
      body: { doc: updates },
    });
  }
}
```

---

## Key Takeaways

1. **Start with PostgreSQL.** It handles 90% of use cases well. Add
   other databases only when PostgreSQL genuinely can't do the job.

2. **SQL for relationships and transactions.** If your data has foreign
   keys and you need ACID, use a relational database.

3. **Document stores for flexible, self-contained data.** MongoDB shines
   when documents are read and written as a unit.

4. **Key-value for speed.** Redis for caching and ephemeral data.
   DynamoDB for persistent key-value at scale.

5. **Wide-column for massive writes.** Cassandra when you're writing
   millions of events per second.

6. **Graph for relationships.** Neo4j when your queries are "who knows
   who" and "what connects to what."

7. **Polyglot persistence is powerful but costly.** Each database is
   another system to maintain. Start simple.

8. **Choose based on access patterns**, not brand names or what big
   tech companies use.

Next: [Lesson 09 — Consistent Hashing: Distributing Data Evenly](./09-consistent-hashing.md)
