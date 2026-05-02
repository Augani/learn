# Lesson 32: Design Uber

Uber matches riders with nearby drivers in real-time. Every second,
millions of drivers broadcast their GPS coordinates, and the system
must find the closest available driver for each rider — in under 5
seconds.

**Analogy:** Imagine you're standing on a city street and need a taxi.
Before ride-sharing, you'd wave at passing cabs. Uber is like having a
helicopter view of every cab in the city, instantly knowing which one
is closest and available, and dispatching it to you — all while the
cabs are moving.

---

## Step 1: Requirements

### Functional Requirements

1. **Rider requests ride** — Enter pickup and dropoff locations
2. **Match with driver** — Find the nearest available driver
3. **Real-time tracking** — Rider sees driver's live location
4. **ETA calculation** — Estimated time of arrival
5. **Trip management** — Start, end, fare calculation
6. **Surge pricing** — Dynamic pricing based on demand

### Non-Functional Requirements

1. **Match latency < 5 seconds** from request to driver assignment
2. **Location accuracy** — Update driver positions every 3-5 seconds
3. **High availability** — the matching service cannot go down
4. **Millions of concurrent location updates**

### Scale Estimation

```
Active drivers:        1M simultaneously
Active riders:         10M DAU
Ride requests/day:     15M
Location updates:      1M drivers × every 4s = 250K updates/sec
Ride matches/sec:      15M / 86400 ≈ 175/sec, peak ~500/sec
```

---

## Step 2: High-Level Design

```
┌───────────────────────────────────────────────────────┐
│                      CLIENTS                           │
│              Rider App    │    Driver App               │
└─────────┬────────────────┬──────────┬─────────────────┘
          │                │          │
    Request ride      Get ETA    Send location
          │                │          │
   ┌──────▼──────┐  ┌──────▼───┐  ┌──▼──────────────┐
   │   Trip      │  │   ETA    │  │  Location       │
   │   Service   │  │  Service │  │  Service        │
   └──────┬──────┘  └──────────┘  └──────┬──────────┘
          │                              │
   ┌──────▼──────┐                ┌──────▼──────────┐
   │  Matching   │◀───────────────│  Spatial Index  │
   │  Service    │                │  (where are     │
   │             │                │   drivers?)     │
   └──────┬──────┘                └─────────────────┘
          │
   ┌──────▼──────┐
   │  Pricing    │
   │  Service    │
   └─────────────┘
```

---

## Step 3: Geospatial Indexing

The core challenge: given a rider at (lat, lng), find the nearest
available drivers. Scanning all 1M drivers for every request is too slow.

### Approach 1: Geohashing

Encode latitude/longitude into a string. Nearby locations share a prefix.

```
Geohash divides the world into a grid of cells:

  Precision  │  Cell Size     │  Use Case
  ───────────┼────────────────┼──────────────
  4 chars    │  ~20 km × 20km │  City-level
  5 chars    │  ~5 km × 5 km  │  Neighborhood
  6 chars    │  ~1 km × 1 km  │  Street-level
  7 chars    │  ~150m × 150m  │  Block-level

  Location (37.7749, -122.4194) → geohash "9q8yy"

  All locations starting with "9q8yy" are within ~1 km of each other.

  ┌────┬────┬────┐
  │9q8z│9q8y│9q8x│
  │    │ y  │    │
  ├────┼────┼────┤
  │9q8w│9q8v│9q8u│  ← grid at precision 4
  │    │    │    │
  ├────┼────┼────┤
  │9q8t│9q8s│9q8r│
  │    │    │    │
  └────┴────┴────┘
```

**Finding nearby drivers:**

```
Rider at geohash "9q8yyk":
  1. Look up drivers in cell "9q8yyk"
  2. Also check 8 neighboring cells
     (driver might be across the border)
  3. Filter by distance, sort by closest
  4. Filter by availability
```

### Approach 2: Quadtree

Recursively divide the map into quadrants. Dense areas get more divisions.

```
World map:
┌───────────────────┐
│         │         │
│   NW    │   NE    │
│         │         │
├─────────┼─────────┤
│         │         │
│   SW    │   SE    │
│         │         │
└───────────────────┘

Manhattan (dense) gets subdivided further:
┌────┬────┬─────────┐
│NW-1│NW-2│         │
├────┼────┤   NE    │
│NW-3│NW-4│         │
├─────────┼─────────┤
│         │         │
│   SW    │   SE    │
└─────────┴─────────┘

Each leaf node contains < 100 drivers.
Finding neighbors: traverse tree from root to the cell
containing the rider, then check adjacent cells.
```

| Feature | Geohash | Quadtree |
|---------|---------|----------|
| Implementation | Simple (string prefix) | Complex (tree structure) |
| Memory | Lower (Redis sorted set) | Higher (tree nodes) |
| Update cost | O(1) per driver | O(log n) per driver |
| Range query | Check cell + neighbors | Traverse tree |
| Edge cases | Cell border issues | Unbalanced if poorly tuned |
| Used by | Elasticsearch, Redis | Uber (custom H3-based) |

---

## Step 4: Location Service

250K location updates per second from drivers.

```go
package location

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type DriverLocation struct {
	DriverID  string
	Latitude  float64
	Longitude float64
	UpdatedAt time.Time
}

type LocationService struct {
	redis *redis.Client
}

func (ls *LocationService) UpdateDriverLocation(ctx context.Context, loc DriverLocation) error {
	return ls.redis.GeoAdd(ctx, "drivers:active", &redis.GeoLocation{
		Name:      loc.DriverID,
		Longitude: loc.Longitude,
		Latitude:  loc.Latitude,
	}).Err()
}

func (ls *LocationService) FindNearbyDrivers(
	ctx context.Context,
	lat, lng float64,
	radiusKm float64,
	limit int,
) ([]redis.GeoLocation, error) {
	results, err := ls.redis.GeoSearchLocation(ctx, "drivers:active",
		&redis.GeoSearchLocationQuery{
			GeoSearchQuery: redis.GeoSearchQuery{
				Longitude:  lng,
				Latitude:   lat,
				Radius:     radiusKm,
				RadiusUnit: "km",
				Sort:       "ASC",
				Count:      limit,
			},
			WithDist: true,
		},
	).Result()
	if err != nil {
		return nil, fmt.Errorf("geo search: %w", err)
	}
	return results, nil
}
```

### Redis GEO Performance

```
Redis GEOSEARCH with 1M drivers:
  Find 10 nearest within 5 km: ~1 ms
  250K GEOADD/second: ~1 ms each (pipelined)

Memory:
  1M drivers × ~100 bytes each = ~100 MB
  Fits in a single Redis instance
```

---

## Step 5: Matching Algorithm

```
Rider requests ride at (37.77, -122.42):

  ┌──────────┐
  │ Matching  │
  │ Service   │
  └────┬──────┘
       │
  1. Find 20 nearest available drivers (GEOSEARCH)
       │
  2. Calculate ETA for each (routing API)
       │
  3. Score candidates:
     Score = w1/ETA + w2*driver_rating + w3*acceptance_rate
       │
  4. Offer ride to top-scored driver
       │
  5. Driver has 15 seconds to accept
       │
  6. If declined → offer to next driver
       │
  7. If accepted → create trip, notify rider

  ┌──────────┐
  │ Driver 1 │ ETA: 3 min, rating: 4.9 → Score: 0.92 ← PICK
  │ Driver 2 │ ETA: 5 min, rating: 4.8 → Score: 0.78
  │ Driver 3 │ ETA: 2 min, rating: 4.2 → Score: 0.81
  └──────────┘
```

---

## Step 6: ETA Calculation

```
Naive: straight-line distance / average speed
  Distance: 2 km → ETA: 2 km / 30 km/h = 4 minutes

Better: road-network distance (Dijkstra/A* on road graph)
  Account for actual roads, one-way streets, highways

Best: ML model trained on historical trip data
  Features: distance, time of day, day of week, weather,
            current traffic, road conditions, events
  Model predicts: actual travel time

  ┌────────────┐     ┌────────────┐     ┌──────────┐
  │  Road      │────▶│  Traffic   │────▶│  ML ETA  │
  │  Graph     │     │  Overlay   │     │  Model   │
  │  (static)  │     │  (live)    │     │          │
  └────────────┘     └────────────┘     └──────────┘
```

---

## Step 7: Surge Pricing

```
Supply/demand ratio by geohash cell:

  Cell "9q8yy":
    Available drivers: 5
    Pending requests:  25
    Ratio: 25/5 = 5.0 → surge multiplier 2.5x

  Cell "9q8yz":
    Available drivers: 20
    Pending requests:  10
    Ratio: 10/20 = 0.5 → no surge (1.0x)

  ┌────┬────┬────┐
  │1.0x│2.5x│1.5x│
  ├────┼────┼────┤     ← surge heat map
  │1.0x│3.0x│2.0x│
  ├────┼────┼────┤
  │1.0x│1.5x│1.0x│
  └────┴────┴────┘

  Surge recalculated every 1-2 minutes.
  Smoothed to avoid rapid oscillation.
```

---

## Complete Architecture

```
  RIDER APP              DRIVER APP
     │                       │
  ┌──▼───────────────────────▼──┐
  │       API Gateway / LB      │
  └──┬────┬────┬────┬────┬──────┘
     │    │    │    │    │
  ┌──▼─┐┌─▼──┐┌▼──┐┌▼──┐┌▼─────┐
  │Trip││Match││ETA││Loc.││Price │
  │Svc ││Svc  ││Svc││Svc ││ Svc  │
  └──┬─┘└──┬─┘└───┘└─┬─┘└──────┘
     │     │          │
  ┌──▼─────▼──┐  ┌───▼────────┐
  │  Trip DB  │  │ Redis GEO  │
  │ (Postgres)│  │ (locations)│
  └───────────┘  └────────────┘

  Real-time: WebSocket for driver location → rider app
  Async: Kafka for trip events, analytics, billing
```

---

## Exercises

1. Implement a geospatial index using Redis GEO commands. Store 1000
   random driver locations and find the 10 nearest to a given point.
   Measure query time.

2. Design the matching algorithm: given 20 candidate drivers with
   different ETAs and ratings, implement the scoring function.
   What weights would you use?

3. Calculate: 1M active drivers sending location every 4 seconds.
   What's the write throughput? Can one Redis instance handle it?
   If not, how do you shard?

4. Design surge pricing: track supply/demand per geohash cell,
   recalculate every 2 minutes, smooth the multiplier to avoid
   oscillation. What data structures do you use?

---

*Next: [Lesson 33 — Design Dropbox](./33-design-dropbox.md), where we
tackle file synchronization across devices with conflict resolution.*
