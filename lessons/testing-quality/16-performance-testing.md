# Lesson 16: Performance and Load Testing

> **The one thing to remember**: Performance testing is like a stress
> test for a bridge. You don't just check if one car can cross — you
> check what happens when 1,000 cars cross at rush hour, when a heavy
> truck drives over, and whether the bridge degrades over time.
> Functional tests ask "does it work?" Performance tests ask "does it
> work *fast enough under real conditions*?"

---

## The Restaurant Rush Analogy

```
PERFORMANCE QUESTIONS FOR A RESTAURANT

  LATENCY:     "How long does one customer wait for their food?"
  THROUGHPUT:  "How many customers can we serve per hour?"
  LOAD:        "What happens when 200 people show up at once?"
  STRESS:      "At what point do we completely fail?"
  SOAK:        "Can we handle a busy Saturday from 6pm to midnight?"
  SPIKE:       "What happens when a tour bus arrives unexpectedly?"

  Each question maps to a type of performance test.
```

```
TYPES OF PERFORMANCE TESTS

  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  Load Test: Expected traffic                        │
  │  "100 concurrent users for 30 minutes"              │
  │                                                     │
  │  Stress Test: Beyond expected limits                │
  │  "Keep adding users until the system breaks"        │
  │                                                     │
  │  Spike Test: Sudden burst                           │
  │  "0 → 1000 users → 0 in 60 seconds"               │
  │                                                     │
  │  Soak Test: Extended duration                       │
  │  "Normal load for 24 hours straight"                │
  │  (finds memory leaks, resource exhaustion)          │
  │                                                     │
  │  Benchmark: Measure specific operations             │
  │  "How fast is this function with 10M items?"        │
  │                                                     │
  └─────────────────────────────────────────────────────┘
```

---

## Benchmarking: Measuring Individual Operations

Before testing the whole system, measure individual pieces.

### Python: timeit and pytest-benchmark

```python
import timeit

def linear_search(items, target):
    for item in items:
        if item == target:
            return True
    return False

def binary_search(sorted_items, target):
    low, high = 0, len(sorted_items) - 1
    while low <= high:
        mid = (low + high) // 2
        if sorted_items[mid] == target:
            return True
        elif sorted_items[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return False

items = list(range(10000))

linear_time = timeit.timeit(lambda: linear_search(items, 9999), number=1000)
binary_time = timeit.timeit(lambda: binary_search(items, 9999), number=1000)

print(f"Linear: {linear_time:.4f}s for 1000 iterations")
print(f"Binary: {binary_time:.4f}s for 1000 iterations")
```

With pytest-benchmark:

```python
def test_linear_search_performance(benchmark):
    items = list(range(10000))
    benchmark(linear_search, items, 9999)

def test_binary_search_performance(benchmark):
    items = list(range(10000))
    benchmark(binary_search, items, 9999)
```

### Go: Built-in Benchmarking

```go
func BenchmarkLinearSearch(b *testing.B) {
    items := make([]int, 10000)
    for i := range items {
        items[i] = i
    }

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        linearSearch(items, 9999)
    }
}

func BenchmarkBinarySearch(b *testing.B) {
    items := make([]int, 10000)
    for i := range items {
        items[i] = i
    }

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        binarySearch(items, 9999)
    }
}
```

```
$ go test -bench=. -benchmem

BenchmarkLinearSearch-8    50000    25000 ns/op    0 B/op    0 allocs/op
BenchmarkBinarySearch-8  5000000      300 ns/op    0 B/op    0 allocs/op
```

### Rust: Built-in Benchmarking

```rust
#[cfg(test)]
mod benches {
    use test::Bencher;

    #[bench]
    fn bench_sort_1000(b: &mut Bencher) {
        let mut data: Vec<i32> = (0..1000).rev().collect();
        b.iter(|| {
            let mut d = data.clone();
            d.sort();
        });
    }
}
```

Or with the `criterion` crate for stable Rust:

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn fibonacci(n: u64) -> u64 {
    match n {
        0 => 1,
        1 => 1,
        n => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn criterion_benchmark(c: &mut Criterion) {
    c.bench_function("fib 20", |b| b.iter(|| fibonacci(black_box(20))));
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
```

---

## Load Testing with k6

k6 is a popular tool for HTTP load testing, written in Go with
JavaScript test scripts:

```
k6 LOAD TEST CONCEPT

  ┌──────────────────────────────────────────────┐
  │  k6 Script (JavaScript)                       │
  │                                               │
  │  "Simulate 50 users doing this for 5 min:"    │
  │    1. GET /api/products                       │
  │    2. Wait 1-3 seconds                        │
  │    3. POST /api/cart  (add random product)    │
  │    4. Wait 1-3 seconds                        │
  │    5. GET /api/cart                            │
  │    6. Repeat                                  │
  │                                               │
  │  Report:                                      │
  │    Requests/sec: 450                          │
  │    Avg latency: 120ms                         │
  │    p95 latency: 350ms                         │
  │    p99 latency: 800ms                         │
  │    Errors: 0.1%                               │
  └──────────────────────────────────────────────┘
```

```javascript
import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 20 },
    { duration: "3m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const res = http.get("http://localhost:3000/api/products");

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timers.duration < 500,
  });

  sleep(Math.random() * 3 + 1);

  const cartRes = http.post(
    "http://localhost:3000/api/cart",
    JSON.stringify({ productId: Math.floor(Math.random() * 100) + 1 }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(cartRes, {
    "cart add succeeds": (r) => r.status === 200 || r.status === 201,
  });

  sleep(Math.random() * 2 + 1);
}
```

---

## Understanding Latency Metrics

```
LATENCY PERCENTILES

  If you serve 100 requests:

  p50 (median):  50 requests were faster than this
  p95:           95 requests were faster than this
  p99:           99 requests were faster than this
  max:           The slowest single request

  Example:
    p50: 50ms    "Most users have a good experience"
    p95: 200ms   "5% of users wait a bit longer"
    p99: 1200ms  "1% of users have a BAD experience"
    max: 8500ms  "Someone waited 8.5 seconds once"

  AVERAGES LIE. If 99 requests take 10ms and 1 takes 10 seconds:
    Average: 109ms   (looks fine!)
    p99: 10000ms     (one user waited TEN SECONDS)

  Always look at p95 and p99, not just the average.
```

```
LATENCY DISTRIBUTION (typical web API)

  Response Time (ms)
  │
  │████████████████████████  50ms   Most requests
  │██████████████           100ms
  │████████                 200ms
  │████                     500ms
  │██                       1000ms
  │█                        2000ms
  │                         5000ms  Rare outliers
  └──────────────────────────────
           Number of requests

  The "long tail" matters. Those rare slow requests
  affect real users.
```

---

## Baseline Metrics and Regression Detection

```
PERFORMANCE REGRESSION DETECTION

  Step 1: Establish baselines
    "GET /api/products normally takes p95 = 120ms"

  Step 2: Run benchmarks on every PR
    PR #42: p95 = 115ms  → ✓ OK (within normal range)
    PR #43: p95 = 340ms  → ✗ REGRESSION DETECTED

  Step 3: Alert or block the PR
    "This PR increased p95 latency by 183%.
     Please investigate before merging."

  ┌──────────────────────────────────────────┐
  │  Latency over time                       │
  │                                          │
  │  120ms ─────────────────┐                │
  │                         │     340ms      │
  │                         └─────────       │
  │                              ↑           │
  │                         Regression!      │
  └──────────────────────────────────────────┘
```

### Automated Performance Tests in CI

```python
import time

LATENCY_BUDGET_MS = 100

def test_product_list_performance():
    start = time.perf_counter()

    response = client.get("/api/products")

    elapsed_ms = (time.perf_counter() - start) * 1000

    assert response.status_code == 200
    assert elapsed_ms < LATENCY_BUDGET_MS, (
        f"GET /api/products took {elapsed_ms:.1f}ms, "
        f"budget is {LATENCY_BUDGET_MS}ms"
    )
```

**Caution**: Performance tests in CI can be flaky due to shared
infrastructure. Use generous thresholds (2-3x expected) or run on
dedicated hardware.

---

## Load Testing with Python (Locust)

```python
from locust import HttpUser, task, between

class WebsiteUser(HttpUser):
    wait_time = between(1, 5)

    @task(3)
    def view_products(self):
        self.client.get("/api/products")

    @task(1)
    def view_product_detail(self):
        product_id = 1
        self.client.get(f"/api/products/{product_id}")

    @task(1)
    def add_to_cart(self):
        self.client.post("/api/cart", json={"product_id": 1, "quantity": 1})
```

```
$ locust -f loadtest.py --host=http://localhost:3000

  Open http://localhost:8089 for the web dashboard
  Set: 100 users, spawn rate 10/second
```

---

## Performance Testing Best Practices

```
DO                                  DON'T

Test on production-like hardware    Test on your laptop and extrapolate
Use realistic data volumes          Test with 10 rows, deploy with 10M
Measure percentiles (p95, p99)      Only look at averages
Establish baselines first           Skip baselines and guess
Test under expected AND peak load   Only test happy path load
Monitor resource usage (CPU, mem)   Only look at response times
Run performance tests regularly     Only test once before launch
```

```
WHAT TO MEASURE

  ┌──────────────────────────────────────┐
  │  Response time (latency)             │
  │  Requests per second (throughput)    │
  │  Error rate under load               │
  │  CPU usage                           │
  │  Memory usage                        │
  │  Database query time                 │
  │  Connection pool usage               │
  │  Garbage collection pauses           │
  │  Disk I/O                            │
  │  Network bandwidth                   │
  └──────────────────────────────────────┘
```

---

## Exercises

1. **Benchmark**: Write two implementations of the same function (e.g.,
   bubble sort vs built-in sort). Benchmark both and compare.

2. **Load test**: Set up a simple API and run a basic k6 or Locust load
   test against it. What's the p95 latency at 10, 50, and 100
   concurrent users?

3. **Find a bottleneck**: Run a load test and identify the bottleneck.
   Is it CPU, memory, database queries, or network? How would you
   fix it?

4. **Performance budget**: Define performance budgets for 3 API
   endpoints in a project. Write automated tests that fail if the
   budget is exceeded.

---

[Next: Lesson 17 - Test Organization and Architecture](./17-test-architecture.md)
