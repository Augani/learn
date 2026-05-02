# Lesson 19: Patterns & Anti-Patterns

> Battle-tested blueprints for distributed systems,
> and the traps that catch everyone at least once.

---

## Pattern 1: Sidecar

Attach a helper process alongside your main service.
The sidecar handles cross-cutting concerns.

```
  WITHOUT SIDECAR:                WITH SIDECAR:
  +-------------------+           +-------------------+
  | Service A         |           | Service A         |
  | - business logic  |           | - business logic  |
  | - logging         |           +-------------------+
  | - metrics         |                   |
  | - TLS termination |           +-------------------+
  | - service mesh    |           | Sidecar Proxy     |
  | - retries         |           | - logging         |
  +-------------------+           | - metrics         |
                                  | - TLS             |
  Every service reimplements      | - retries         |
  the same infra code.            | - circuit breaker |
                                  +-------------------+
                                  Infrastructure is separate
                                  from business logic.

  EXAMPLES:
  - Envoy proxy (Istio service mesh)
  - Fluent Bit (log forwarding)
  - Vault agent (secret injection)
  - Dapr sidecar (state, pubsub, bindings)
```

```
  POD LAYOUT (Kubernetes):
  +------------------------------------------+
  | Pod                                      |
  | +------------------+ +----------------+  |
  | | App Container    | | Sidecar        |  |
  | | port 8080        |<>| Envoy          |  |
  | |                  | | port 15001     |  |
  | +------------------+ +----------------+  |
  | shared network namespace (localhost)     |
  +------------------------------------------+
  App talks to localhost:15001.
  Envoy handles mTLS, retries, load balancing.
```

---

## Pattern 2: Ambassador

A special sidecar that acts as a proxy to external services.
Simplifies how your service talks to the outside world.

```
  WITHOUT AMBASSADOR:            WITH AMBASSADOR:
  +----------------+             +----------------+
  | Service A      |             | Service A      |
  | connect to:    |             | connect to:    |
  |  redis-1:6379  |             |  localhost:6379|
  |  redis-2:6379  |             +----------------+
  |  redis-3:6379  |                    |
  | handle failover|             +----------------+
  | handle sharding|             | Ambassador     |
  +----------------+             | - redis-1      |
                                 | - redis-2      |
  Service has complex            | - redis-3      |
  connection logic.              | - failover     |
                                 | - sharding     |
                                 +----------------+
                                 Service just connects
                                 to localhost. Simple.

  USE CASES:
  - Database connection pooling (PgBouncer)
  - Service discovery + routing
  - Protocol translation (REST -> gRPC)
  - Legacy system adaptation
```

---

## Pattern 3: Circuit Breaker

Prevent cascading failures by stopping calls to a
failing service.

```
  STATE MACHINE:

  +--------+   failure threshold   +---------+
  | CLOSED | --------------------> |  OPEN   |
  | (normal|                       | (reject |
  |  flow) |                       |  all)   |
  +--------+                       +---------+
      ^                                |
      |     success                    | timeout
      |                                v
      |                          +-----------+
      +------------------------- | HALF-OPEN |
            success              | (try one  |
                                 |  request) |
            failure ------------> +-----------+
            (back to OPEN)

  ANALOGY: an electrical circuit breaker.
  Too much current -> breaker trips -> stops electricity.
  Wait, try again. If OK, close breaker. If not, stay open.
```

```python
import time
from enum import Enum
from typing import Callable, TypeVar

T = TypeVar("T")

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 1,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.half_open_calls = 0

    def call(self, func: Callable[[], T]) -> T:
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.half_open_calls = 0
            else:
                raise CircuitOpenError("Circuit is open")

        if self.state == CircuitState.HALF_OPEN:
            if self.half_open_calls >= self.half_open_max_calls:
                raise CircuitOpenError("Half-open limit reached")
            self.half_open_calls += 1

        try:
            result = func()
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        self.failure_count = 0
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED

    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

class CircuitOpenError(Exception):
    pass


breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=10.0)

def call_external_service():
    raise ConnectionError("Service unavailable")

for i in range(5):
    try:
        breaker.call(call_external_service)
    except CircuitOpenError:
        print(f"Call {i}: REJECTED (circuit open)")
    except ConnectionError:
        print(f"Call {i}: FAILED (service error)")
```

---

## Pattern 4: Bulkhead

Isolate failures so one component's problems don't sink
the whole ship.

```
  ANALOGY: Ship bulkheads.
  A ship has watertight compartments.
  If one floods, the others stay dry.

  WITHOUT BULKHEADS:              WITH BULKHEADS:
  +-------------------+           +-------------------+
  | Service           |           | Service           |
  | Connection Pool:  |           | Pool A (payments):|
  |   100 connections |           |   30 connections  |
  |   shared by ALL   |           | Pool B (users):   |
  +-------------------+           |   30 connections  |
                                  | Pool C (search):  |
  If payment service is           |   40 connections  |
  slow, ALL 100 connections       +-------------------+
  get stuck on payments.
  Nothing else can connect.       If payments is slow,
                                  only 30 connections stuck.
                                  Users and search still work.

  IMPLEMENTATION APPROACHES:
  +-------------------------+-------------------------------+
  | Thread pools            | Separate pool per dependency  |
  | Connection pools        | Separate pool per downstream  |
  | Process isolation       | Separate process per feature  |
  | Container limits        | CPU/memory limits per service |
  | Rate limiting           | Per-tenant request limits     |
  +-------------------------+-------------------------------+
```

---

## Pattern 5: Retry with Backoff

```
  NAIVE RETRY:
  fail -> retry -> retry -> retry -> retry (hammers server)

  EXPONENTIAL BACKOFF:
  fail -> wait 1s -> fail -> wait 2s -> fail -> wait 4s

  EXPONENTIAL BACKOFF + JITTER:
  fail -> wait 0.8s -> fail -> wait 2.3s -> fail -> wait 3.7s
                   ^                 ^                 ^
                 random           random            random

  WHY JITTER?
  Without: 1000 clients retry at EXACTLY 1s, 2s, 4s
  Thundering herd at every retry interval!

  With: 1000 clients retry at random times around 1s, 2s, 4s
  Spread the load. No thundering herd.
```

```python
import random
import time

def retry_with_backoff(
    func,
    max_retries: int = 5,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: bool = True,
):
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            delay = min(base_delay * (2 ** attempt), max_delay)
            if jitter:
                delay = random.uniform(0, delay)
            print(f"Attempt {attempt + 1} failed, retrying in {delay:.1f}s")
            time.sleep(delay)
```

---

## Pattern 6: Saga

Manage distributed transactions without 2PC.
Each step has a compensating action.

```
  BOOK A TRIP:
  +----------+    +----------+    +----------+
  | Book     | -> | Book     | -> | Book     |
  | Flight   |    | Hotel    |    | Car      |
  +----------+    +----------+    +----------+

  If car booking fails:
  +----------+    +----------+    +----------+
  | Cancel   | <- | Cancel   | <- | Car      |
  | Flight   |    | Hotel    |    | FAILED   |
  +----------+    +----------+    +----------+

  CHOREOGRAPHY (event-driven):
  Flight booked -> event -> Hotel service books
  Hotel booked -> event -> Car service books
  Car failed -> event -> Hotel cancels -> Flight cancels

  ORCHESTRATION (coordinator):
  Saga coordinator calls each service in sequence.
  On failure, coordinator calls compensations in reverse.
```

---

## Anti-Pattern 1: Distributed Monolith

```
  WHAT IT LOOKS LIKE:
  "We have microservices!" (20 services!)

  WHAT IT ACTUALLY IS:
  +--------+   sync   +--------+   sync   +--------+
  | Svc A  | -------> | Svc B  | -------> | Svc C  |
  +--------+          +--------+          +--------+
       |                   |                   |
       | sync              | sync              | sync
       v                   v                   v
  +--------+          +--------+          +--------+
  | Svc D  |          | Svc E  |          | Svc F  |
  +--------+          +--------+          +--------+

  ALL services must be up for ANY request to work.
  Deploy one, must test with all others.
  Can't deploy independently.
  ALL the complexity of microservices.
  NONE of the benefits.

  SYMPTOMS:
  - Must deploy multiple services together
  - One service down = everything down
  - Shared database between services
  - Can't understand one service without the others
```

---

## Anti-Pattern 2: Chatty Services

```
  Order Service needs to display an order:

  BAD (chatty):
  Order Service -> User Service: GET /users/123
  Order Service -> Product Service: GET /products/456
  Order Service -> Product Service: GET /products/789
  Order Service -> Inventory Service: GET /stock/456
  Order Service -> Inventory Service: GET /stock/789
  Order Service -> Shipping Service: GET /rates?from=A&to=B
  Order Service -> Tax Service: GET /calculate?amount=100

  7 network calls for ONE page load!

  BETTER:
  Order Service -> BFF/Aggregator: GET /order-details/123
  Aggregator makes calls in parallel, returns combined result.

  OR: denormalize data into the order service.
  Store user name, product name with the order.
  1 database query instead of 7 network calls.
```

---

## Anti-Pattern 3: No Timeout, No Retry Budget

```
  MISSING TIMEOUTS:
  Service A -> Service B (B is slow, 30 second response)
  Service A holds connection for 30 seconds.
  100 requests to A -> 100 threads stuck waiting for B.
  A runs out of threads. A is now down too.
  Cascading failure!

  FIX: always set timeouts.
  - Connection timeout: 1-5 seconds
  - Read timeout: 5-30 seconds
  - Total request timeout: aligned with SLA

  MISSING RETRY BUDGET:
  Service A retries 3 times.
  Service A calls Service B, which calls Service C.
  A retries B 3 times. B retries C 3 times.
  One C failure = 9 total calls to C!
  3 levels deep: 27 calls to the bottom service.

  FIX: retry budget.
  Total retries across the call chain <= N.
  Or: only retry at the EDGE (client), not intermediaries.
```

---

## Anti-Pattern 4: Ignoring Partial Failures

```
  BAD: treat distributed call like a local function call

  result = payment_service.charge(order)
  shipping_service.ship(order)

  What if charge succeeds but ship fails?
  What if charge times out but actually succeeded?
  What if the response is lost but the operation completed?

  GOOD: handle every possible outcome

  result = payment_service.charge(order)
  match result:
    case Success(payment_id):
        try:
            shipping_service.ship(order, payment_id)
        except ShippingError:
            payment_service.refund(payment_id)
    case Timeout:
        check_payment_status(order)
    case NetworkError:
        retry_or_queue(order)
    case ServerError(code):
        if is_retryable(code):
            retry_with_backoff(...)
        else:
            alert_and_compensate(order)
```

---

## Anti-Pattern 5: Shared Database

```
  BAD: multiple services sharing one database

  +--------+   +--------+   +--------+
  | Svc A  |   | Svc B  |   | Svc C  |
  +--------+   +--------+   +--------+
       \           |           /
        \          |          /
         v         v         v
       +--------------------+
       |    Shared Database  |
       |  orders | users     |
       |  products | payments|
       +--------------------+

  PROBLEMS:
  - Schema change in one service breaks others
  - Can't scale services independently
  - Can't use different databases for different services
  - Tight coupling through shared tables
  - Migration nightmare

  GOOD: each service owns its data

  +--------+   +--------+   +--------+
  | Svc A  |   | Svc B  |   | Svc C  |
  +--------+   +--------+   +--------+
       |            |            |
  +--------+  +--------+  +--------+
  | DB A   |  | DB B   |  | DB C   |
  +--------+  +--------+  +--------+

  Services communicate through APIs, not shared tables.
```

---

## Pattern Summary

```
  +-------------------+----------------------------------+
  | Pattern           | Use When                         |
  +-------------------+----------------------------------+
  | Sidecar           | Cross-cutting concerns (logging, |
  |                   | TLS, metrics, tracing)           |
  +-------------------+----------------------------------+
  | Ambassador        | Simplify access to external      |
  |                   | services (DB, cache, API)        |
  +-------------------+----------------------------------+
  | Circuit Breaker   | Downstream service may fail;     |
  |                   | prevent cascading failures       |
  +-------------------+----------------------------------+
  | Bulkhead          | Isolate failures between         |
  |                   | components or tenants            |
  +-------------------+----------------------------------+
  | Retry + Backoff   | Transient failures; always add   |
  |                   | jitter to prevent thundering herd|
  +-------------------+----------------------------------+
  | Saga              | Distributed transactions without |
  |                   | 2PC; compensating actions        |
  +-------------------+----------------------------------+
```

---

## Exercises

### Exercise 1: Circuit Breaker with Metrics

Extend the CircuitBreaker to track:
1. Total calls, successes, failures per minute
2. Time spent in each state
3. Number of times the circuit opened
4. Average response time when closed vs half-open

### Exercise 2: Saga Coordinator

Implement a saga coordinator for a trip booking:
1. Book flight (compensation: cancel flight)
2. Book hotel (compensation: cancel hotel)
3. Book car (compensation: cancel car)
4. Simulate random failures and verify compensations run

### Exercise 3: Bulkhead Simulation

Create a service with 3 downstream dependencies.
Use separate thread pools (bulkheads) for each.
Simulate one dependency becoming slow (1s responses).
Verify the other two dependencies are unaffected.

### Exercise 4: Identify Anti-Patterns

Given this architecture, list all anti-patterns:
- 5 services sharing one PostgreSQL database
- All calls are synchronous REST
- No timeouts configured
- Each service retries failed calls 5 times
- Services deploy together in one CI/CD pipeline

---

## Key Takeaways

```
  1. Sidecar: separate infrastructure from business logic
  2. Ambassador: simplify external service access
  3. Circuit breaker: stop calling failing services
  4. Bulkhead: isolate failures between components
  5. Always use exponential backoff with jitter
  6. Sagas replace 2PC for distributed transactions
  7. Anti-pattern: distributed monolith (worst of both worlds)
  8. Anti-pattern: chatty services (too many network calls)
  9. Anti-pattern: no timeouts (cascading failures)
  10. Anti-pattern: shared database (tight coupling)
```

---

Next: [Lesson 20 — Build a Distributed Key-Value Store](./20-build-distributed-kv.md)
