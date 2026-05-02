# Lesson 07: API Versioning

## The Road Construction Analogy

Imagine a highway that millions of cars use daily. You need to add a lane.
You can't just close the highway -- you build the new lane alongside the
old one, then gradually redirect traffic. API versioning works the same way.

```
  Without versioning:
  +--------+     +--------+
  | Client | --> | API v1 |  <-- change response format
  +--------+     +--------+
       |
       X  CLIENT BREAKS

  With versioning:
  +--------+     +--------+
  | Old    | --> | API v1 |  <-- still works
  | Client |     +--------+
  +--------+
  +--------+     +--------+
  | New    | --> | API v2 |  <-- new format
  | Client |     +--------+
  +--------+
```

## Breaking vs Non-Breaking Changes

```
  NON-BREAKING (safe):              BREAKING (needs new version):
  +---------------------------+     +---------------------------+
  | Adding a new field        |     | Removing a field          |
  | Adding a new endpoint     |     | Renaming a field          |
  | Adding optional parameter |     | Changing field type       |
  | Fixing a bug              |     | Changing URL structure    |
  | Improving performance     |     | Changing error format     |
  | Adding new enum value     |     | Changing auth mechanism   |
  | Making required -> optional|    | Making optional -> required|
  +---------------------------+     +---------------------------+
```

Rule of thumb: if existing clients break, it's a breaking change.

## Three Versioning Strategies

### 1. URL Path Versioning

```
  GET /v1/users/42
  GET /v2/users/42

  +------+     +-----------+     +--------+
  | LB / | --> | /v1/users | --> | v1     |
  | Gate | --> | /v2/users | --> | handler|
  | way  |     +-----------+     +--------+
  +------+
```

**Pros:** Simple, visible, easy to test in browser.
**Cons:** URL changes for every version. Not "RESTful" (URL should identify resource, not version).

### 2. Header Versioning

```
  GET /users/42
  Accept-Version: v2

  -- or using a custom header --

  GET /users/42
  X-API-Version: 2
```

**Pros:** Clean URLs. Version and resource are separate concerns.
**Cons:** Harder to test (can't just paste a URL). Easy to forget the header.

### 3. Content-Type Versioning (Media Type)

```
  GET /users/42
  Accept: application/vnd.myapi.v2+json
```

**Pros:** Most "RESTful." Follows HTTP content negotiation.
**Cons:** Complex. Rarely used in practice.

## Comparison

```
  +------------------+----------+----------+----------+
  |                  | URL      | Header   | Content  |
  +------------------+----------+----------+----------+
  | Simplicity       | High     | Medium   | Low      |
  | Discoverability  | High     | Low      | Low      |
  | Browser testing  | Easy     | Hard     | Hard     |
  | Caching          | Easy     | Varies   | Varies   |
  | RESTfulness      | Low      | Medium   | High     |
  | Adoption         | Most     | Some     | Rare     |
  +------------------+----------+----------+----------+
```

Most companies use **URL path versioning** because it's the simplest.

## Go - Multi-Version Router

```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type UserV1 struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type UserV2 struct {
	ID        int    `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func main() {
	http.HandleFunc("GET /v1/users/{id}", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, UserV1{
			ID:   42,
			Name: "Alice Smith",
		})
	})

	http.HandleFunc("GET /v2/users/{id}", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, UserV2{
			ID:        42,
			FirstName: "Alice",
			LastName:  "Smith",
			Email:     "alice@example.com",
		})
	})

	fmt.Println("Server on :8080 (v1 and v2)")
	http.ListenAndServe(":8080", nil)
}
```

## TypeScript - Header-Based Versioning

```typescript
interface UserV1 {
  id: number;
  name: string;
}

interface UserV2 {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

function getUserV1(): UserV1 {
  return { id: 42, name: "Alice Smith" };
}

function getUserV2(): UserV2 {
  return { id: 42, firstName: "Alice", lastName: "Smith", email: "alice@example.com" };
}

const server = Bun.serve({
  port: 8080,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/users/42") {
      const version = req.headers.get("Accept-Version") ?? "v1";

      switch (version) {
        case "v2":
          return Response.json(getUserV2());
        case "v1":
        default:
          return Response.json(getUserV1());
      }
    }

    return Response.json({ error: "not found" }, { status: 404 });
  },
});

console.log(`Server on :${server.port}`);
```

## Deprecation Strategy

Don't just kill old versions. Give users a migration path.

```
  Timeline:
  +-------+--------+--------+--------+--------+
  | Month  |  v1   |  v2    |  v3    | Action |
  +-------+--------+--------+--------+--------+
  |  Jan   | Active|        |        |        |
  |  Mar   | Active| Launch |        | v2 out |
  |  Jun   | Deprec| Active |        | Warn   |
  |  Sep   | Sunset| Active | Launch | v1 off |
  |  Dec   |  OFF  | Deprec | Active |        |
  +-------+--------+--------+--------+--------+

  Deprecation headers:
  Deprecation: true
  Sunset: Sat, 01 Sep 2026 00:00:00 GMT
  Link: <https://api.example.com/v2/docs>; rel="successor-version"
```

## Exercises

1. **Run both examples.** Call v1 and v2 endpoints. Observe the different
   response structures.

2. **Design a migration.** Your v1 API returns `name` as a single string.
   V2 splits it into `first_name` and `last_name`. How do you support
   both without duplicating all your business logic?

3. **Add deprecation headers.** Modify the Go server to return `Deprecation`
   and `Sunset` headers on v1 endpoints.

4. **Debate.** A teammate says "let's just version everything in the URL
   and bump it whenever we want." What's the risk of version inflation?

---

[Next: Lesson 08 - Authentication & Authorization ->](08-authentication-authorization.md)
