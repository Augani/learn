# API Design & Protocols - Track Roadmap

## What This Track Covers

This track is a deep dive into designing, building, and consuming APIs.
You'll move from fundamentals to production-grade patterns.

```
  +----------------------------------------------------------+
  |                  API DESIGN & PROTOCOLS                   |
  +----------------------------------------------------------+
  |                                                          |
  |  FOUNDATIONS          PROTOCOLS         OPERATIONS        |
  |  +-----------+      +-----------+     +-----------+      |
  |  | What's an |      | GraphQL   |     | Auth      |      |
  |  | API?      |----->| gRPC      |---->| Rate Limit|      |
  |  | REST      |      | WebSocket |     | Gateways  |      |
  |  | Best      |      |           |     | Docs      |      |
  |  | Practices |      |           |     |           |      |
  |  +-----------+      +-----------+     +-----------+      |
  |        |                  |                 |            |
  |        v                  v                 v            |
  |  RELIABILITY         EVOLUTION        CAPSTONE           |
  |  +-----------+      +-----------+     +-----------+      |
  |  | Errors    |      | Versioning|     | Design a  |      |
  |  | Testing   |      | Webhooks  |     | Complete  |      |
  |  | Perf      |      | Events    |     | API       |      |
  |  +-----------+      +-----------+     +-----------+      |
  |                                                          |
  +----------------------------------------------------------+
```

## Lesson Plan

| #  | Lesson                        | Focus                                      |
|----|-------------------------------|---------------------------------------------|
| 01 | What Is an API?               | Contracts, interfaces, the restaurant menu  |
| 02 | REST Principles               | Resources, methods, status codes, HATEOAS   |
| 03 | REST Best Practices           | Naming, pagination, filtering, errors       |
| 04 | GraphQL                       | Schema-first, queries, mutations, N+1       |
| 05 | gRPC & Protocol Buffers       | Protobuf, streaming, code generation        |
| 06 | WebSockets                    | Bidirectional comms, lifecycle, scaling      |
| 07 | API Versioning                | URL, header, content-type strategies        |
| 08 | Authentication & Authorization| OAuth 2.0, JWT, scopes, API keys            |
| 09 | Rate Limiting & Throttling    | Token bucket, sliding window, distributed   |
| 10 | API Gateways                  | Routing, transformation, security layers    |
| 11 | Documentation                 | OpenAPI/Swagger, API-first design           |
| 12 | Error Handling                | RFC 7807, retries, idempotency              |
| 13 | Testing APIs                  | Contract tests, integration, mocking        |
| 14 | Performance                   | Caching, compression, HTTP/2                |
| 15 | Webhooks & Events             | Event-driven APIs, delivery, verification   |
| 16 | Design an API (Capstone)      | Build a complete API for a real product     |

## Reference Materials

- [HTTP Status Codes Reference](reference-status-codes.md)
- [Common API Patterns & Anti-Patterns](reference-patterns.md)

## Prerequisites

- Basic HTTP knowledge (methods, headers, status codes)
- Familiarity with JSON
- Go or TypeScript fundamentals
- Completed the System Design track (recommended)

## How to Use This Track

Each lesson is 5-10 minutes of reading with runnable code examples.
Do the exercises at the end of each lesson before moving on.
The capstone in lesson 16 ties everything together.

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **API Design Patterns** by JJ Geewax (Manning, 2021) — Comprehensive API design patterns
- **The Design of Web APIs** by Arnaud Lauret (Manning, 2019) — API design from the consumer's perspective

---

[Start with Lesson 01: What Is an API? ->](01-what-is-an-api.md)
