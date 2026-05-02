# Lesson 12: Error Handling

## The Hospital Triage Analogy

When you go to the ER, they don't just say "something's wrong." They
categorize, prioritize, and give you a clear next step. API errors should
work the same way: clear category, specific details, actionable fix.

```
  BAD error:                       GOOD error:
  { "error": "fail" }             {
                                    "type": "https://api.example.com/errors/validation",
  What failed?                      "title": "Validation Error",
  Why?                              "status": 422,
  What do I do about it?            "detail": "Email format is invalid",
                                    "instance": "/users/signup",
                                    "errors": [{
                                      "field": "email",
                                      "message": "must contain @",
                                      "value": "notanemail"
                                    }]
                                  }
```

## RFC 7807: Problem Details for HTTP APIs

This is the standard format for API errors. Adopt it and your errors
become self-documenting.

```
  RFC 7807 FIELDS:
  +----------+--------------------------------------------------+
  | Field    | Description                                      |
  +----------+--------------------------------------------------+
  | type     | URI identifying the error type (documentation)   |
  | title    | Short human-readable summary                     |
  | status   | HTTP status code                                 |
  | detail   | Human-readable explanation of THIS occurrence    |
  | instance | URI identifying this specific occurrence         |
  +----------+--------------------------------------------------+
  Content-Type: application/problem+json
```

## Error Categories

```
  CLIENT ERRORS (4xx):                SERVER ERRORS (5xx):
  "You did something wrong"           "We did something wrong"

  +-----+------------------------+    +-----+-------------------+
  | 400 | Bad Request (malformed)|    | 500 | Internal Error    |
  | 401 | Not authenticated      |    | 502 | Bad Gateway       |
  | 403 | Not authorized         |    | 503 | Service Down      |
  | 404 | Not found              |    | 504 | Gateway Timeout   |
  | 409 | Conflict               |    +-----+-------------------+
  | 422 | Unprocessable (valid   |
  |     | JSON, invalid content) |    Client can retry 5xx errors
  | 429 | Rate limited           |    Client should NOT retry 4xx
  +-----+------------------------+    (except 429 with Retry-After)
```

## Go - RFC 7807 Error System

```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type ProblemDetail struct {
	Type     string        `json:"type"`
	Title    string        `json:"title"`
	Status   int           `json:"status"`
	Detail   string        `json:"detail"`
	Instance string        `json:"instance,omitempty"`
	Errors   []FieldError  `json:"errors,omitempty"`
}

type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Value   any    `json:"value,omitempty"`
}

func writeProblem(w http.ResponseWriter, p ProblemDetail) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(p.Status)
	json.NewEncoder(w).Encode(p)
}

func NotFound(resource string, id string) ProblemDetail {
	return ProblemDetail{
		Type:   "https://api.example.com/errors/not-found",
		Title:  "Resource Not Found",
		Status: http.StatusNotFound,
		Detail: fmt.Sprintf("%s with id '%s' does not exist", resource, id),
	}
}

func ValidationFailed(errors []FieldError) ProblemDetail {
	return ProblemDetail{
		Type:   "https://api.example.com/errors/validation",
		Title:  "Validation Error",
		Status: http.StatusUnprocessableEntity,
		Detail: fmt.Sprintf("%d field(s) failed validation", len(errors)),
		Errors: errors,
	}
}

func Conflict(detail string) ProblemDetail {
	return ProblemDetail{
		Type:   "https://api.example.com/errors/conflict",
		Title:  "Conflict",
		Status: http.StatusConflict,
		Detail: detail,
	}
}

func main() {
	http.HandleFunc("POST /users", func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Name  string `json:"name"`
			Email string `json:"email"`
			Age   int    `json:"age"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeProblem(w, ProblemDetail{
				Type:   "https://api.example.com/errors/parse",
				Title:  "Parse Error",
				Status: http.StatusBadRequest,
				Detail: "Request body is not valid JSON",
			})
			return
		}

		var fieldErrors []FieldError
		if input.Name == "" {
			fieldErrors = append(fieldErrors, FieldError{Field: "name", Message: "is required"})
		}
		if input.Email == "" {
			fieldErrors = append(fieldErrors, FieldError{Field: "email", Message: "is required"})
		}
		if input.Age < 0 || input.Age > 150 {
			fieldErrors = append(fieldErrors, FieldError{
				Field: "age", Message: "must be between 0 and 150", Value: input.Age,
			})
		}

		if len(fieldErrors) > 0 {
			writeProblem(w, ValidationFailed(fieldErrors))
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"name": input.Name, "email": input.Email})
	})

	fmt.Println("Server on :8080")
	http.ListenAndServe(":8080", nil)
}
```

## Retry Strategies

Not all errors deserve a retry. And when you retry, don't hammer the server.

```
  RETRY DECISION TREE:

  Is it a 4xx?
    |
    +-- Yes -> DON'T retry (except 429 with Retry-After)
    |          The request is wrong; resending won't help
    |
    +-- No (5xx or network error)
         |
         +-- Is it idempotent? (GET, PUT, DELETE)
              |
              +-- Yes -> RETRY with exponential backoff
              |
              +-- No (POST) -> Only retry if you have
                               an idempotency key
```

### Exponential Backoff

```
  Attempt 1: wait 1s    +  jitter
  Attempt 2: wait 2s    +  jitter
  Attempt 3: wait 4s    +  jitter
  Attempt 4: wait 8s    +  jitter
  Attempt 5: wait 16s   +  jitter (max reached)
  GIVE UP

  Why jitter? Without it, all clients retry at the same time
  (thundering herd). Jitter spreads them out.

  +-----+-----+-----+-----+-----+
  | 1s  | 2s  | 4s  | 8s  | 16s | <- without jitter (stampede)
  +-----+-----+-----+-----+-----+

  +--+----+--+------+--+--------+  <- with jitter (spread out)
```

### TypeScript - Retry with Exponential Backoff

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: RetryConfig = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 16000 }
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status < 500 && response.status !== 429) {
        return response;
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter) {
          await sleep(parseInt(retryAfter) * 1000);
          continue;
        }
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err as Error;
    }

    if (attempt < config.maxRetries) {
      const delay = Math.min(
        config.baseDelayMs * Math.pow(2, attempt),
        config.maxDelayMs
      );
      const jitter = delay * 0.5 * Math.random();
      await sleep(delay + jitter);
    }
  }

  throw lastError ?? new Error("max retries exceeded");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

fetchWithRetry("https://api.example.com/data")
  .then((res) => res.json())
  .then(console.log)
  .catch(console.error);
```

## Idempotency Keys

For non-idempotent operations (POST), idempotency keys prevent duplicates
when retrying.

```
  Client                              Server
    |                                    |
    | POST /payments                     |
    | Idempotency-Key: abc-123           |
    |-------- (network timeout) -------->| (payment processed!)
    |                                    |
    | (no response received)             |
    |                                    |
    | POST /payments (retry)             |
    | Idempotency-Key: abc-123           |
    |----------------------------------->|
    |                                    | "I already processed abc-123"
    |<--- 200 OK (original result) ------|
    |                                    |
    | (no duplicate payment!)            |

  Without idempotency key:
    | POST /payments (retry)             |
    |----------------------------------->| Creates SECOND payment!
```

```
  Server-side implementation:
  +----------+     +------------------+     +---------+
  | Request  | --> | Check key in     | --> | Execute |
  | arrives  |     | idempotency      |     | and     |
  |          |     | store            |     | store   |
  +----------+     +------------------+     +---------+
                      |
                   Key exists?
                      |
                   +--+--+
                   | Yes  | --> Return stored response
                   +------+
```

## Exercises

1. **Implement RFC 7807 errors.** Create a TypeScript version of the
   `ProblemDetail` type and write validation errors for a "create order"
   endpoint.

2. **Test retries.** Write a server that fails 50% of the time. Use the
   `fetchWithRetry` function to call it. Observe the backoff behavior.

3. **Add idempotency keys.** Implement a `POST /payments` endpoint that
   accepts an `Idempotency-Key` header and returns stored results for
   duplicate keys.

4. **Error audit.** Pick a public API you use. List all the error formats
   it returns. Are they consistent? Do they follow RFC 7807?

---

[Next: Lesson 13 - Testing APIs ->](13-testing-apis.md)
