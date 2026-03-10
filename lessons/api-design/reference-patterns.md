# API Patterns & Anti-Patterns Reference

---

## Patterns (Do This)

```
+---------------------------+-----------------------------------------------+
| Pattern                   | Description                                   |
+---------------------------+-----------------------------------------------+
| Resource-oriented URLs    | /users/{id}/orders (nouns, not verbs)         |
+---------------------------+-----------------------------------------------+
| Consistent naming         | snake_case or camelCase — pick one, stick     |
+---------------------------+-----------------------------------------------+
| Cursor pagination         | ?after=cursor&limit=50 for all list endpoints |
+---------------------------+-----------------------------------------------+
| Envelope response         | { "data": [...], "pagination": {...} }        |
+---------------------------+-----------------------------------------------+
| RFC 7807 errors           | { "type", "title", "status", "detail" }       |
+---------------------------+-----------------------------------------------+
| Idempotency keys          | Idempotency-Key header for POST operations    |
+---------------------------+-----------------------------------------------+
| HATEOAS links             | Include related resource URLs in responses     |
+---------------------------+-----------------------------------------------+
| Field selection           | ?fields=id,name,email for sparse responses    |
+---------------------------+-----------------------------------------------+
| Bulk operations           | POST /tasks/bulk with array of operations     |
+---------------------------+-----------------------------------------------+
| Async for long ops        | 202 Accepted + poll URL for long operations   |
+---------------------------+-----------------------------------------------+
| ETags                     | Conditional requests with If-None-Match       |
+---------------------------+-----------------------------------------------+
| Rate limit headers        | X-RateLimit-Limit, Remaining, Reset           |
+---------------------------+-----------------------------------------------+
| Request ID tracking       | X-Request-ID on every request and response    |
+---------------------------+-----------------------------------------------+
| Consistent date format    | ISO 8601: 2024-01-15T14:30:00Z everywhere     |
+---------------------------+-----------------------------------------------+
| Expand/embed related      | ?expand=author,comments to include related    |
+---------------------------+-----------------------------------------------+
```

---

## Anti-Patterns (Don't Do This)

```
+---------------------------+-----------------------------------------------+
| Anti-Pattern              | Problem                                       |
+---------------------------+-----------------------------------------------+
| Verbs in URLs             | /getUser, /createOrder, /deleteItem           |
|                           | Use: GET /users, POST /orders, DELETE /items  |
+---------------------------+-----------------------------------------------+
| Nested beyond 2 levels    | /a/{id}/b/{id}/c/{id}/d/{id}                 |
|                           | Use: /d/{id} with query param for context     |
+---------------------------+-----------------------------------------------+
| 200 for errors            | 200 {"error": true}                           |
|                           | Use: proper 4xx/5xx status codes              |
+---------------------------+-----------------------------------------------+
| Breaking changes in       | Renaming/removing fields without new version  |
| same version              | Use: new API version for breaking changes     |
+---------------------------+-----------------------------------------------+
| Offset pagination         | ?page=500 scans 500 pages of rows             |
| for large datasets        | Use: cursor pagination                        |
+---------------------------+-----------------------------------------------+
| Exposing internal IDs     | Auto-increment integers reveal count/order    |
|                           | Use: UUIDs or prefixed IDs (usr_abc123)       |
+---------------------------+-----------------------------------------------+
| No rate limiting          | One client can overwhelm the API              |
|                           | Always rate limit with clear headers          |
+---------------------------+-----------------------------------------------+
| Chatty APIs               | Client makes 10 calls to render one page      |
|                           | Use: compound documents, ?expand, BFF         |
+---------------------------+-----------------------------------------------+
| Inconsistent naming       | user_name in one endpoint, userName in another |
|                           | Pick one convention and enforce it             |
+---------------------------+-----------------------------------------------+
| No pagination             | GET /events returns 1 million records          |
|                           | Always paginate list endpoints                 |
+---------------------------+-----------------------------------------------+
| Leaking internals         | Stack traces, SQL errors, internal paths       |
|                           | Generic 500 message, log details server-side   |
+---------------------------+-----------------------------------------------+
| PUT for partial updates   | PUT replaces the entire resource               |
|                           | Use: PATCH for partial updates                 |
+---------------------------+-----------------------------------------------+
| Ignoring Accept header    | Always returning JSON even when XML requested  |
|                           | Return 406 if format not supported             |
+---------------------------+-----------------------------------------------+
| No versioning strategy    | Painting yourself into a corner                |
|                           | Version from day one (URL or header)           |
+---------------------------+-----------------------------------------------+
```

---

## Authentication Patterns

```
+---------------------------+-----------------------------------------------+
| Pattern                   | When to Use                                   |
+---------------------------+-----------------------------------------------+
| API Keys                  | Server-to-server, scripts, CLIs               |
| (Authorization: Bearer)   | Simple, no user context needed                |
+---------------------------+-----------------------------------------------+
| OAuth 2.0 + PKCE         | User-facing apps, third-party integrations    |
|                           | When you need user identity + scopes          |
+---------------------------+-----------------------------------------------+
| JWT (short-lived)         | Stateless auth, microservice-to-microservice  |
|                           | Always with refresh tokens                    |
+---------------------------+-----------------------------------------------+
| Session cookies           | Traditional web apps (SSR)                    |
|                           | HttpOnly, Secure, SameSite=Strict             |
+---------------------------+-----------------------------------------------+
| Mutual TLS                | High-security service-to-service              |
|                           | Both client and server present certificates   |
+---------------------------+-----------------------------------------------+
```

---

## Caching Patterns

```
+---------------------------+-----------------------------------------------+
| Pattern                   | Headers / Strategy                            |
+---------------------------+-----------------------------------------------+
| Immutable assets          | Cache-Control: public, max-age=31536000,      |
|                           | immutable                                     |
+---------------------------+-----------------------------------------------+
| User-specific data        | Cache-Control: private, max-age=60            |
|                           | + ETag for conditional requests               |
+---------------------------+-----------------------------------------------+
| Frequently changing       | Cache-Control: no-cache                        |
| (must revalidate)         | ETag for bandwidth savings                    |
+---------------------------+-----------------------------------------------+
| Sensitive data            | Cache-Control: no-store                        |
|                           | Never cache (auth responses, PII)             |
+---------------------------+-----------------------------------------------+
| Stale while refresh       | Cache-Control: max-age=60,                     |
|                           | stale-while-revalidate=300                    |
+---------------------------+-----------------------------------------------+
```

---

## URL Design Patterns

```
  COLLECTION:      GET  /users           (list)
                   POST /users           (create)

  ITEM:            GET    /users/{id}    (read)
                   PATCH  /users/{id}    (update)
                   DELETE /users/{id}    (delete)

  SUB-RESOURCE:    GET  /users/{id}/orders
                   POST /users/{id}/orders

  ACTION:          POST /orders/{id}/cancel     (RPC-style action)
                   POST /orders/{id}/refund

  SEARCH:          GET  /search/users?q=alice
                   POST /search/advanced  (complex queries)

  BULK:            POST /users/bulk       (batch create)
                   PATCH /users/bulk      (batch update)
                   DELETE /users/bulk     (batch delete)

  SINGLETON:       GET /users/me          (current user)
                   GET /config            (system config)
```
