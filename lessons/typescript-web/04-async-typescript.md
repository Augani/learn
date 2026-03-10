# Lesson 04: Async TypeScript

## The Async Mental Model

In Rust you have `tokio::spawn`. In Go you have goroutines.
In TypeScript, everything async runs on a single-threaded event loop.

Think of it like a restaurant with one waiter. The waiter takes your order
(starts a task), goes to the kitchen (I/O), comes back when it's ready.
They never stand around waiting — they serve other tables in between.

```
  EVENT LOOP (single thread)
  ==========================

  +--------+     +-----------+     +----------+
  | Call    |---->| Event     |---->| Callback |
  | Stack   |     | Queue     |     | Execution|
  +--------+     +-----------+     +----------+
       ^                                 |
       |_________________________________|

  1. Your code runs on the call stack
  2. Async operations (fetch, timers) go to the system
  3. When complete, callbacks enter the event queue
  4. Event loop picks from queue when stack is empty
```

## Promises: The Foundation

A Promise is like Rust's `Future` — a value that will exist later.
Three states: pending, fulfilled, rejected.

```typescript
const promise: Promise<string> = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve("Hello after 1 second");
  }, 1000);
});

promise
  .then((value) => console.log(value))
  .catch((error) => console.error(error));
```

```
  PROMISE STATES
  ==============

  Promise<T>
    |
    +--[pending]----> waiting for result
    |
    +--[fulfilled]--> .then(value: T)
    |
    +--[rejected]---> .catch(error: unknown)

  Compare:
    Rust:  Future<Output = T>   (poll-based)
    Go:    <-chan T              (channel-based)
    TS:    Promise<T>           (callback-based)
```

## Async/Await

`async/await` is syntactic sugar over Promises. Like `await` in Rust but
you don't need an executor — the JS runtime handles it.

```typescript
async function fetchUser(id: number): Promise<{ name: string; email: string }> {
  const response = await fetch(`https://api.example.com/users/${id}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function main(): Promise<void> {
  try {
    const user = await fetchUser(1);
    console.log(user.name);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}
```

## Error Handling Patterns

### Try/Catch (Standard)

```typescript
async function safeFetch<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Network error — check your connection");
    }
    throw error;
  }
}
```

### Result Pattern (Rust-Style)

```typescript
type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

async function safeFetch<T>(url: string): Promise<Result<T>> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, error: new Error(`HTTP ${response.status}`) };
    }
    const data: T = await response.json();
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

async function main(): Promise<void> {
  const result = await safeFetch<{ name: string }>("https://api.example.com/user");
  if (!result.ok) {
    console.error(result.error.message);
    return;
  }
  console.log(result.data.name);
}
```

### Tuple Pattern (Go-Style)

```typescript
async function goStyleFetch<T>(url: string): Promise<[T | null, Error | null]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [null, new Error(`HTTP ${response.status}`)];
    }
    const data: T = await response.json();
    return [data, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

async function main(): Promise<void> {
  const [user, err] = await goStyleFetch<{ name: string }>("/api/user");
  if (err !== null) {
    console.error(err.message);
    return;
  }
  console.log(user!.name);
}
```

## Parallel Execution

```typescript
async function fetchDashboard(userId: number): Promise<{
  user: { name: string };
  posts: { title: string }[];
  notifications: { message: string }[];
}> {
  const [user, posts, notifications] = await Promise.all([
    fetch(`/api/users/${userId}`).then((r) => r.json()),
    fetch(`/api/users/${userId}/posts`).then((r) => r.json()),
    fetch(`/api/users/${userId}/notifications`).then((r) => r.json()),
  ]);

  return { user, posts, notifications };
}
```

```
  SEQUENTIAL vs PARALLEL
  ======================

  Sequential (3 seconds total):
  |--fetch user (1s)--|--fetch posts (1s)--|--fetch notifs (1s)--|

  Parallel with Promise.all (1 second total):
  |--fetch user (1s)--|
  |--fetch posts (1s)--|
  |--fetch notifs (1s)--|
  |                    |
  done ----------------+
```

## Promise.allSettled

When you want all results, even if some fail:

```typescript
async function fetchMultipleAPIs(urls: string[]): Promise<void> {
  const results = await Promise.allSettled(
    urls.map((url) => fetch(url).then((r) => r.json()))
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      console.log("Success:", result.value);
    } else {
      console.error("Failed:", result.reason);
    }
  }
}
```

## Promise.race and Promise.any

```typescript
async function fetchWithTimeout<T>(url: string, ms: number): Promise<T> {
  const fetchPromise = fetch(url).then((r) => r.json());

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

async function fetchFromFastest<T>(urls: string[]): Promise<T> {
  return Promise.any(urls.map((url) => fetch(url).then((r) => r.json())));
}
```

## AbortController: Cancellation

Rust has `tokio::select!` for cancellation. TypeScript has `AbortController`.
Think of it as a kill switch for async operations.

```typescript
async function fetchWithAbort<T>(
  url: string,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Cancelling on User Action

```typescript
function createCancellableFetch(): {
  fetch: <T>(url: string) => Promise<T>;
  cancel: () => void;
} {
  let controller: AbortController | null = null;

  return {
    fetch: async <T>(url: string): Promise<T> => {
      controller?.abort();
      controller = new AbortController();

      const response = await fetch(url, { signal: controller.signal });
      return response.json();
    },
    cancel: () => {
      controller?.abort();
      controller = null;
    },
  };
}

const search = createCancellableFetch();
```

## Async Iteration

```typescript
async function* generateNumbers(count: number): AsyncGenerator<number> {
  for (let i = 0; i < count; i++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    yield i;
  }
}

async function consumeNumbers(): Promise<void> {
  for await (const num of generateNumbers(5)) {
    console.log(num);
  }
}
```

## Retry Pattern

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        const backoff = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastError;
}

const data = await withRetry(
  () => fetch("/api/data").then((r) => r.json()),
  3,
  1000
);
```

```
  RETRY WITH EXPONENTIAL BACKOFF
  ==============================

  Attempt 1: immediate
  Attempt 2: wait 1000ms  (1s)
  Attempt 3: wait 2000ms  (2s)
  Attempt 4: wait 4000ms  (4s)
         ...exponential growth
```

## Exercises

1. Write a `timeout<T>(promise: Promise<T>, ms: number): Promise<T>` function that rejects if the promise doesn't resolve within `ms` milliseconds. Use `AbortController`.

2. Implement a `throttle` function that limits how often an async function can be called. If called again within the cooldown, return the previous result.

3. Create a `batchFetch` function that takes an array of URLs, fetches them in parallel with a concurrency limit (e.g., max 3 at a time), and returns all results.

4. Write a type-safe event emitter class using generics:
   ```typescript
   const emitter = new TypedEmitter<{
     login: { userId: string };
     error: { message: string; code: number };
   }>();
   emitter.on("login", (data) => console.log(data.userId));
   ```

5. Implement the Go-style `[data, error]` tuple pattern as a generic wrapper `tryCatch<T>(fn: () => Promise<T>)` that never throws.

---

[← Lesson 03](./03-utility-types.md) | [Next: Lesson 05 - Node Runtime →](./05-node-runtime.md)
