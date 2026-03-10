# Lesson 14: Testing Async Code

> **The one thing to remember**: Testing async code is like testing a
> restaurant where orders are placed now but food arrives later. You
> can't taste the food the moment you order — you have to *wait* for it.
> The test framework needs to know to wait, or it will check the plate
> before the food arrives and say "test failed: plate is empty."

---

## The Mail-Order Analogy

Synchronous code is like buying at a store: you pay, you get the item,
done. Async code is like ordering online: you place the order, time
passes, the package arrives later.

```
SYNCHRONOUS                         ASYNCHRONOUS

  result = compute(42)              future = fetch_data(url)
  // result is ready NOW             // result is NOT ready yet
  assert result == 84                // ... time passes ...
                                    result = await future
                                    // NOW it's ready
                                    assert result == expected
```

The key challenge: your test must **wait for the async operation to
complete** before checking the result.

---

## Testing Promises and Async/Await

### TypeScript (Vitest)

```typescript
import { describe, it, expect } from "vitest";

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error(`User ${id} not found`);
  return response.json();
}

describe("fetchUser", () => {
  it("returns user data", async () => {
    const user = await fetchUser(1);

    expect(user.name).toBe("Alice");
    expect(user.email).toBeDefined();
  });

  it("throws for nonexistent user", async () => {
    await expect(fetchUser(99999)).rejects.toThrow("not found");
  });
});
```

The critical keyword is `async` on the test function and `await` on the
call. Without `await`, the test finishes before the promise resolves.

```
COMMON MISTAKE: FORGETTING AWAIT

  it("should fail but doesn't", () => {
    // Missing async/await!
    expect(fetchUser(99999)).rejects.toThrow("not found");
    // Test passes immediately because the promise isn't awaited.
    // The rejection happens AFTER the test finishes.
    // This test gives false confidence — it never actually checks anything.
  });
```

### Python (pytest-asyncio)

```python
import pytest
import asyncio

async def fetch_temperature(city):
    await asyncio.sleep(0.1)
    temperatures = {"new york": 72, "london": 55, "tokyo": 80}
    if city.lower() not in temperatures:
        raise ValueError(f"Unknown city: {city}")
    return temperatures[city.lower()]

@pytest.mark.asyncio
async def test_fetch_temperature():
    temp = await fetch_temperature("New York")
    assert temp == 72

@pytest.mark.asyncio
async def test_unknown_city():
    with pytest.raises(ValueError, match="Unknown city"):
        await fetch_temperature("Atlantis")
```

---

## Testing Callbacks

Older async patterns use callbacks instead of promises. Testing them
requires wrapping in a way your test framework can wait for.

```typescript
function fetchDataCallback(
  url: string,
  onSuccess: (data: unknown) => void,
  onError: (err: Error) => void
): void {
  setTimeout(() => {
    if (url.includes("error")) {
      onError(new Error("Fetch failed"));
    } else {
      onSuccess({ result: "data" });
    }
  }, 100);
}

it("fetches data via callback", async () => {
  const result = await new Promise((resolve, reject) => {
    fetchDataCallback(
      "/api/data",
      (data) => resolve(data),
      (err) => reject(err)
    );
  });

  expect(result).toEqual({ result: "data" });
});

it("handles callback errors", async () => {
  await expect(
    new Promise((resolve, reject) => {
      fetchDataCallback("/api/error", resolve, reject);
    })
  ).rejects.toThrow("Fetch failed");
});
```

---

## Timeouts: Preventing Hanging Tests

Async tests can hang forever if a promise never resolves. Always set
timeouts.

```typescript
it("completes within reasonable time", async () => {
  const result = await Promise.race([
    fetchSlowData(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 5000)
    ),
  ]);

  expect(result).toBeDefined();
}, 10_000);

// Vitest/Jest: second argument to `it` is timeout in ms
```

```python
@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_with_timeout():
    result = await slow_operation()
    assert result is not None
```

```go
func TestSlowOperation(t *testing.T) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    result, err := slowOperation(ctx)
    if err != nil {
        t.Fatalf("operation failed or timed out: %v", err)
    }
    if result == nil {
        t.Fatal("expected non-nil result")
    }
}
```

---

## Testing Event-Driven Code

Code that emits events needs tests that listen for those events:

```typescript
import { EventEmitter } from "events";

class OrderProcessor extends EventEmitter {
  async process(order: Order): Promise<void> {
    this.emit("processing", order.id);

    const result = await chargePayment(order);

    if (result.success) {
      this.emit("completed", order.id, result.transactionId);
    } else {
      this.emit("failed", order.id, result.error);
    }
  }
}

it("emits completed event on successful order", async () => {
  const processor = new OrderProcessor();
  const events: string[] = [];

  processor.on("processing", (id) => events.push(`processing:${id}`));
  processor.on("completed", (id) => events.push(`completed:${id}`));

  await processor.process(makeOrder({ id: 42 }));

  expect(events).toEqual(["processing:42", "completed:42"]);
});

it("emits failed event on payment failure", async () => {
  const processor = new OrderProcessor();

  const failedPromise = new Promise<string>((resolve) => {
    processor.on("failed", (id, error) => resolve(error));
  });

  await processor.process(makeOrder({ id: 42, amount: -1 }));

  const error = await failedPromise;
  expect(error).toContain("Invalid amount");
});
```

---

## Controlling Time

Async code often involves timers, delays, and debouncing. Use fake
timers to avoid real waiting:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls function after delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("resets timer on subsequent calls", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(200);
    debounced();
    vi.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });
});
```

### Python: Freezing Time

```python
from unittest.mock import patch
from datetime import datetime, timedelta

def is_token_expired(token):
    return datetime.utcnow() > token["expires_at"]

def test_valid_token():
    token = {"expires_at": datetime(2024, 12, 31)}

    with patch("mymodule.datetime") as mock_dt:
        mock_dt.utcnow.return_value = datetime(2024, 6, 15)
        assert is_token_expired(token) is False

def test_expired_token():
    token = {"expires_at": datetime(2024, 1, 1)}

    with patch("mymodule.datetime") as mock_dt:
        mock_dt.utcnow.return_value = datetime(2024, 6, 15)
        assert is_token_expired(token) is True
```

---

## Testing Concurrent Code

When multiple async operations run simultaneously:

```python
import asyncio

async def fetch_all_prices(product_ids):
    tasks = [fetch_price(pid) for pid in product_ids]
    return await asyncio.gather(*tasks)

@pytest.mark.asyncio
async def test_fetch_all_prices():
    prices = await fetch_all_prices(["A", "B", "C"])

    assert len(prices) == 3
    assert all(isinstance(p, float) for p in prices)
    assert all(p > 0 for p in prices)

@pytest.mark.asyncio
async def test_partial_failure():
    with pytest.raises(Exception):
        await fetch_all_prices(["A", "INVALID", "C"])
```

### Go: Testing Goroutines

```go
func TestConcurrentFetch(t *testing.T) {
    results := make(chan string, 3)
    errors := make(chan error, 3)

    urls := []string{"/api/a", "/api/b", "/api/c"}

    for _, url := range urls {
        go func(u string) {
            result, err := fetchData(u)
            if err != nil {
                errors <- err
                return
            }
            results <- result
        }(url)
    }

    var collected []string
    for i := 0; i < len(urls); i++ {
        select {
        case r := <-results:
            collected = append(collected, r)
        case err := <-errors:
            t.Fatalf("unexpected error: %v", err)
        case <-time.After(5 * time.Second):
            t.Fatal("timeout waiting for results")
        }
    }

    if len(collected) != 3 {
        t.Errorf("expected 3 results, got %d", len(collected))
    }
}
```

---

## Testing Retry Logic

```typescript
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      if (attempt === maxRetries) throw new Error(`Failed after ${maxRetries} attempts`);
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error("Unreachable");
}

describe("fetchWithRetry", () => {
  it("succeeds on first try", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("ok"));

    const result = await fetchWithRetry("/api/data");
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    vi.useFakeTimers();

    vi.spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(new Response("ok"));

    const promise = fetchWithRetry("/api/data", 3, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });
});
```

---

## Common Async Testing Pitfalls

```
PITFALL                            FIX

Forgetting async/await             Always use async test functions
  Test passes but checks nothing    for async code

Not waiting for events             Use promise wrappers or
  Event fires after test ends       waitFor utilities

Real timers in tests               Use fake timers
  Tests are slow and flaky          vi.useFakeTimers()

Unhandled promise rejections       Always catch and assert errors
  Silent failures                   expect(...).rejects.toThrow()

Testing internal timing            Test outcomes, not timing
  "It should take 100ms"            "It should eventually complete"

Race conditions in tests           Use synchronization primitives
  Tests pass/fail randomly          Barriers, latches, channels
```

---

## Exercises

1. **Async basics**: Write an async function that fetches data from two
   sources and combines the results. Test it with mocked fetch calls.

2. **Timeout testing**: Write a function with a timeout parameter. Test
   that it times out correctly using fake timers.

3. **Event testing**: Create an event emitter that emits "start",
   "progress", and "done" events. Write tests that verify all events
   fire in the correct order.

4. **Retry testing**: Implement a retry wrapper that retries a function
   N times with exponential backoff. Test all scenarios: success on
   first try, success after retries, failure after all retries.

---

[Next: Lesson 15 - Testing Database Code](./15-testing-databases.md)
