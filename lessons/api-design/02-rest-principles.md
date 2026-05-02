# Lesson 02: REST Principles

## REST Is a Set of Rules for the Web

Think of REST like traffic laws. Cars (clients) and roads (servers) work
because everyone agrees on the rules: drive on the right, stop at red lights,
yield at roundabouts. REST gives HTTP-based APIs the same kind of order.

REST stands for **Representational State Transfer**. It's not a protocol --
it's an architectural style with constraints.

## The Six Constraints

```
  +-----------------------------------------------------------+
  |                   REST CONSTRAINTS                         |
  +-----------------------------------------------------------+
  |                                                           |
  |  1. Client-Server        Separation of concerns           |
  |  2. Stateless            Each request is self-contained   |
  |  3. Cacheable            Responses say if they're fresh   |
  |  4. Uniform Interface    Consistent URL + method patterns |
  |  5. Layered System       Proxies/gateways are invisible   |
  |  6. Code on Demand*      Server can send executable code  |
  |                          (* optional)                     |
  +-----------------------------------------------------------+
```

**Stateless** is the most important. Every request must contain everything
the server needs to process it. No "remember me from last time."
Like a food truck -- you order fresh each time, no reservations.

## Resources: Everything Is a Noun

In REST, you model your API around **resources** (nouns), not actions (verbs).

```
  WRONG (RPC-style):              RIGHT (REST):
  POST /getUser                   GET  /users/42
  POST /createUser                POST /users
  POST /deleteUser?id=42          DELETE /users/42
  POST /updateUserEmail           PATCH /users/42
```

A resource is any thing your API exposes: users, orders, products, invoices.
Each resource gets a URL (its address on the web).

## HTTP Methods Map to Actions

```
  +--------+------------+------------------+-------------+
  | Method | Action     | Example          | Idempotent? |
  +--------+------------+------------------+-------------+
  | GET    | Read       | GET /users/42    | Yes         |
  | POST   | Create     | POST /users      | No          |
  | PUT    | Replace    | PUT /users/42    | Yes         |
  | PATCH  | Update     | PATCH /users/42  | No*         |
  | DELETE | Remove     | DELETE /users/42 | Yes         |
  +--------+------------+------------------+-------------+
  * PATCH can be idempotent if designed carefully
```

**Idempotent** means calling it multiple times produces the same result.
Pressing an elevator button 10 times doesn't call 10 elevators.

## HTTP Status Codes (The Big Picture)

```
  +------+-------------------------------+-------------------+
  | Code | Meaning                       | Analogy           |
  +------+-------------------------------+-------------------+
  | 1xx  | "Hold on..."                  | "Still cooking"   |
  | 2xx  | "Here you go!"                | "Order ready"     |
  | 3xx  | "Go over there"               | "We moved"        |
  | 4xx  | "You messed up"               | "Bad order"       |
  | 5xx  | "We messed up"                | "Kitchen fire"    |
  +------+-------------------------------+-------------------+

  Most common:
  200 OK              - Success
  201 Created         - New resource made
  204 No Content      - Success, nothing to return
  400 Bad Request     - Invalid input
  401 Unauthorized    - Not authenticated
  403 Forbidden       - Authenticated but not allowed
  404 Not Found       - Resource doesn't exist
  409 Conflict        - State conflict (duplicate, etc.)
  429 Too Many Reqs   - Rate limited
  500 Internal Error  - Server broke
```

See [reference-status-codes.md](reference-status-codes.md) for the full list.

## HATEOAS: Self-Describing APIs

HATEOAS (Hypermedia As The Engine Of Application State) means responses
include links to related actions. Like a website where every page has
navigation links -- you don't need to memorize URLs.

```json
{
  "id": 42,
  "name": "Alice",
  "email": "alice@example.com",
  "_links": {
    "self":    { "href": "/users/42" },
    "orders":  { "href": "/users/42/orders" },
    "update":  { "href": "/users/42", "method": "PATCH" },
    "delete":  { "href": "/users/42", "method": "DELETE" }
  }
}
```

Most real-world APIs skip HATEOAS. But it's the highest level of REST maturity.

## The Richardson Maturity Model

Leonard Richardson defined levels of REST adoption.
Most APIs live at Level 2. Level 3 is full REST.

```
  Level 3: Hypermedia Controls (HATEOAS)    <-- Full REST
     ^     Responses include links to next actions
     |
  Level 2: HTTP Verbs                        <-- Most APIs
     ^     GET, POST, PUT, DELETE used correctly
     |
  Level 1: Resources
     ^     Different URLs for different things
     |
  Level 0: The Swamp of POX
           One URL, one method (POST), XML payloads
           (like old SOAP services)

  +--------------------------------------------------+
  |  Level 0:  POST /api   { action: "getUser" }     |
  |  Level 1:  POST /users/42                         |
  |  Level 2:  GET  /users/42                         |
  |  Level 3:  GET  /users/42  -> { ..., _links: {} } |
  +--------------------------------------------------+
```

## Building a REST API

### Go (using standard library)

```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
)

type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type UserStore struct {
	mu    sync.RWMutex
	users map[int]User
	next  int
}

func NewUserStore() *UserStore {
	return &UserStore{users: make(map[int]User), next: 1}
}

func (s *UserStore) Create(name, email string) User {
	s.mu.Lock()
	defer s.mu.Unlock()
	user := User{ID: s.next, Name: name, Email: email}
	s.users[s.next] = user
	s.next++
	return user
}

func (s *UserStore) Get(id int) (User, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[id]
	return u, ok
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func main() {
	store := NewUserStore()

	http.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
		var id int
		if _, err := fmt.Sscanf(r.PathValue("id"), "%d", &id); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		user, ok := store.Get(id)
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		writeJSON(w, http.StatusOK, user)
	})

	http.HandleFunc("POST /users", func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Name  string `json:"name"`
			Email string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}
		if input.Name == "" || input.Email == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and email required"})
			return
		}
		user := store.Create(input.Name, input.Email)
		writeJSON(w, http.StatusCreated, user)
	})

	fmt.Println("Server on :8080")
	http.ListenAndServe(":8080", nil)
}
```

### TypeScript (using Express-like pattern with native fetch server)

```typescript
const users = new Map<number, { id: number; name: string; email: string }>();
let nextId = 1;

const server = Bun.serve({
  port: 8080,
  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;

    if (method === "GET" && url.pathname.match(/^\/users\/\d+$/)) {
      const id = parseInt(url.pathname.split("/")[2]);
      const user = users.get(id);
      if (!user) {
        return Response.json({ error: "not found" }, { status: 404 });
      }
      return Response.json(user);
    }

    if (method === "POST" && url.pathname === "/users") {
      const body = await req.json();
      if (!body.name || !body.email) {
        return Response.json({ error: "name and email required" }, { status: 400 });
      }
      const user = { id: nextId++, name: body.name, email: body.email };
      users.set(user.id, user);
      return Response.json(user, { status: 201 });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  },
});

console.log(`Server on :${server.port}`);
```

## Exercises

1. **Classify these endpoints** by Richardson Maturity level:
   - `POST /api/actions { "type": "getUser", "id": 42 }`
   - `GET /users/42`
   - `GET /users/42` returning `{ "id": 42, "_links": { ... } }`

2. **Design resource URLs** for a blog: posts, authors, comments, tags.

3. **Run the Go or TypeScript server above.** Create a user with `curl`:
   ```bash
   curl -X POST http://localhost:8080/users \
     -H "Content-Type: application/json" \
     -d '{"name":"Alice","email":"alice@test.com"}'
   ```

4. **Which HTTP method is idempotent?** PUT or POST? Why does it matter?

---

[Next: Lesson 03 - REST Best Practices ->](03-rest-best-practices.md)
