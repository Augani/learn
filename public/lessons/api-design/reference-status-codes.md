# HTTP Status Codes Reference

When to use each status code in your API.

---

## 2xx Success

```
+------+---------------------+--------------------------------------------+
| Code | Name                | When to Use                                |
+------+---------------------+--------------------------------------------+
| 200  | OK                  | GET succeeded, PUT/PATCH updated resource  |
|      |                     | Default success response                   |
+------+---------------------+--------------------------------------------+
| 201  | Created             | POST created a new resource                |
|      |                     | Include Location header with new URL       |
+------+---------------------+--------------------------------------------+
| 202  | Accepted            | Request accepted for async processing      |
|      |                     | Job will complete later, return job URL     |
+------+---------------------+--------------------------------------------+
| 204  | No Content          | DELETE succeeded, no body to return         |
|      |                     | PUT/PATCH when no body needed              |
+------+---------------------+--------------------------------------------+
```

---

## 3xx Redirection

```
+------+---------------------+--------------------------------------------+
| Code | Name                | When to Use                                |
+------+---------------------+--------------------------------------------+
| 301  | Moved Permanently   | Resource URL changed forever               |
|      |                     | Old endpoint deprecated, use new one       |
+------+---------------------+--------------------------------------------+
| 304  | Not Modified        | Conditional GET, ETag/Last-Modified match  |
|      |                     | Client's cached version is still valid     |
+------+---------------------+--------------------------------------------+
| 307  | Temporary Redirect  | Resource temporarily at different URL      |
|      |                     | Preserves HTTP method (unlike 302)         |
+------+---------------------+--------------------------------------------+
| 308  | Permanent Redirect  | Like 301 but preserves HTTP method         |
+------+---------------------+--------------------------------------------+
```

---

## 4xx Client Errors

```
+------+---------------------+--------------------------------------------+
| Code | Name                | When to Use                                |
+------+---------------------+--------------------------------------------+
| 400  | Bad Request         | Malformed request syntax (bad JSON,        |
|      |                     | missing Content-Type, invalid encoding)    |
+------+---------------------+--------------------------------------------+
| 401  | Unauthorized        | No authentication provided, or token       |
|      |                     | expired/invalid. "Who are you?"            |
+------+---------------------+--------------------------------------------+
| 403  | Forbidden           | Authenticated but not authorized.          |
|      |                     | "I know who you are, but you can't."       |
+------+---------------------+--------------------------------------------+
| 404  | Not Found           | Resource doesn't exist at this URL         |
|      |                     | Also use for unauthorized resource (hide)  |
+------+---------------------+--------------------------------------------+
| 405  | Method Not Allowed  | HTTP method not supported on this resource |
|      |                     | GET on a write-only endpoint               |
+------+---------------------+--------------------------------------------+
| 406  | Not Acceptable      | Server can't produce requested format      |
|      |                     | (Accept header mismatch)                   |
+------+---------------------+--------------------------------------------+
| 408  | Request Timeout     | Client took too long to send request       |
+------+---------------------+--------------------------------------------+
| 409  | Conflict            | Resource state conflict (duplicate,        |
|      |                     | version mismatch, state transition error)  |
+------+---------------------+--------------------------------------------+
| 410  | Gone                | Resource was deleted and won't return      |
|      |                     | Webhook subscription cancelled             |
+------+---------------------+--------------------------------------------+
| 413  | Payload Too Large   | Request body exceeds size limit            |
+------+---------------------+--------------------------------------------+
| 415  | Unsupported Media   | Wrong Content-Type (sent XML, need JSON)   |
+------+---------------------+--------------------------------------------+
| 422  | Unprocessable       | Valid JSON but semantic errors              |
|      | Entity              | (invalid email, negative price, etc.)      |
+------+---------------------+--------------------------------------------+
| 429  | Too Many Requests   | Rate limit exceeded                        |
|      |                     | Include Retry-After header                 |
+------+---------------------+--------------------------------------------+
```

---

## 5xx Server Errors

```
+------+---------------------+--------------------------------------------+
| Code | Name                | When to Use                                |
+------+---------------------+--------------------------------------------+
| 500  | Internal Server     | Unhandled exception, unexpected error      |
|      | Error               | Never expose stack traces to clients       |
+------+---------------------+--------------------------------------------+
| 502  | Bad Gateway         | Upstream service returned invalid response |
+------+---------------------+--------------------------------------------+
| 503  | Service Unavailable | Server is overloaded or in maintenance     |
|      |                     | Include Retry-After header                 |
+------+---------------------+--------------------------------------------+
| 504  | Gateway Timeout     | Upstream service didn't respond in time    |
+------+---------------------+--------------------------------------------+
```

---

## Common Mistakes

```
  MISTAKE: Using 200 for everything
  BAD:  200 { "error": true, "message": "not found" }
  GOOD: 404 { "type": "...", "title": "Not Found", "status": 404 }

  MISTAKE: 400 for all client errors
  BAD:  400 for missing auth, bad data, rate limiting
  GOOD: 401 (auth), 422 (validation), 429 (rate limit)

  MISTAKE: 500 for client errors
  BAD:  500 when user sends invalid JSON
  GOOD: 400 with clear error message

  MISTAKE: 200 for DELETE
  BAD:  200 with empty body
  GOOD: 204 No Content

  MISTAKE: 403 when resource doesn't exist
  BAD:  403 "You don't have access to project_xyz"
        (reveals that project_xyz exists!)
  GOOD: 404 "Resource not found"
        (hides existence from unauthorized users)
```

---

## Decision Flowchart

```
  Request succeeded?
  |
  +-- YES
  |   +-- Created new resource? --> 201 + Location header
  |   +-- Async processing? --> 202 + job URL
  |   +-- No body to return? --> 204
  |   +-- ETag matches? --> 304
  |   +-- Otherwise --> 200
  |
  +-- NO
      +-- Client's fault?
      |   +-- Bad syntax/JSON? --> 400
      |   +-- Not authenticated? --> 401
      |   +-- Not authorized? --> 403
      |   +-- Resource missing? --> 404
      |   +-- Conflict? --> 409
      |   +-- Invalid data? --> 422
      |   +-- Rate limited? --> 429
      |
      +-- Server's fault?
          +-- Bug/crash? --> 500
          +-- Upstream down? --> 502
          +-- Overloaded? --> 503
          +-- Upstream slow? --> 504
```
