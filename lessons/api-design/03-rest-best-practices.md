# Lesson 03: REST Best Practices

## Naming Conventions

Think of API URLs like street addresses. Good addresses are predictable.
If Main St has houses numbered 1, 2, 3... you can guess where #4 is.

```
  GOOD                          BAD
  ----                          ---
  GET /users                    GET /getUsers
  GET /users/42                 GET /user?id=42
  GET /users/42/orders          GET /getUserOrders
  POST /users                   POST /createNewUser
  DELETE /users/42              POST /deleteUser

  Rules:
  - Plural nouns:   /users   not /user
  - Lowercase:      /users   not /Users
  - Hyphens:        /order-items  not /orderItems
  - No verbs:       /users   not /getUsers
  - Nest for relationships: /users/42/orders
```

## Pagination

No one hands you the entire library when you ask for books.
You get one shelf at a time. APIs work the same way.

```
  GET /users?page=2&per_page=25

  Response:
  {
    "data": [ ... 25 users ... ],
    "pagination": {
      "page": 2,
      "per_page": 25,
      "total": 150,
      "total_pages": 6
    }
  }
```

### Offset-Based vs Cursor-Based

```
  OFFSET-BASED:                    CURSOR-BASED:
  GET /users?page=3&per_page=10    GET /users?after=abc123&limit=10

  +-----+-----+-----+-----+       +-------+-------+-------+
  |pg 1 |pg 2 |pg 3 |pg 4 |       | fetch | fetch | fetch |
  +-----+-----+-----+-----+       | after | after | after |
  Skip 20, take 10                 +---^---+---^---+---^---+
                                       |       |       |
  PRO: Jump to any page              cursor  cursor  cursor
  CON: Inconsistent if data changes
                                   PRO: Stable with changing data
                                   CON: Can't jump to page N
```

### Go - Cursor-Based Pagination

```go
package main

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type Product struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type PageResponse struct {
	Data       []Product `json:"data"`
	NextCursor string    `json:"next_cursor,omitempty"`
	HasMore    bool      `json:"has_more"`
}

func main() {
	products := make([]Product, 100)
	for i := range products {
		products[i] = Product{ID: i + 1, Name: "Product " + strconv.Itoa(i+1)}
	}

	http.HandleFunc("GET /products", func(w http.ResponseWriter, r *http.Request) {
		limit := 10
		if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 && l <= 50 {
			limit = l
		}

		afterID := 0
		if a, err := strconv.Atoi(r.URL.Query().Get("after")); err == nil {
			afterID = a
		}

		var result []Product
		for _, p := range products {
			if p.ID > afterID {
				result = append(result, p)
			}
			if len(result) == limit {
				break
			}
		}

		resp := PageResponse{Data: result, HasMore: len(result) == limit}
		if resp.HasMore {
			resp.NextCursor = strconv.Itoa(result[len(result)-1].ID)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	http.ListenAndServe(":8080", nil)
}
```

## Filtering and Sorting

Let users narrow down results. Like searching Amazon -- you filter by price,
brand, rating, then sort by relevance.

```
  GET /products?category=electronics&min_price=100&max_price=500
  GET /products?sort=price&order=asc
  GET /products?sort=-created_at          (prefix - for descending)
  GET /products?status=active,pending      (comma for multiple values)
```

```
  +---------------------------------------------------+
  |  Filtering Strategy                                |
  +---------------------------------------------------+
  |                                                   |
  |  Simple:    ?status=active                        |
  |  Range:     ?min_price=10&max_price=100           |
  |  Multiple:  ?status=active,pending                |
  |  Search:    ?q=wireless+headphones                |
  |  Nested:    ?author.name=Alice  (less common)     |
  |                                                   |
  +---------------------------------------------------+
```

## Partial Responses (Field Selection)

Don't send 50 fields when the client only needs 3.
Like ordering a la carte instead of the full buffet.

```
  GET /users/42?fields=name,email,avatar

  Instead of returning:
  { id, name, email, avatar, bio, created_at, address,
    phone, settings, preferences, ... 40 more fields }

  You return:
  { "name": "Alice", "email": "alice@test.com", "avatar": "..." }
```

### TypeScript - Field Selection

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  bio: string;
  avatar: string;
  createdAt: string;
}

function selectFields(user: User, fields: string[]): Partial<User> {
  if (fields.length === 0) {
    return user;
  }
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in user) {
      result[field] = user[field as keyof User];
    }
  }
  return result as Partial<User>;
}

const user: User = {
  id: 1,
  name: "Alice",
  email: "alice@test.com",
  bio: "Software engineer",
  avatar: "https://example.com/alice.jpg",
  createdAt: "2025-01-01T00:00:00Z",
};

console.log(selectFields(user, ["name", "email"]));
```

## Error Response Format

Errors should be structured and consistent. Think of error messages like
medical reports -- they need a code, a description, and what to do about it.

```
  BAD:                              GOOD:
  { "error": "something broke" }    {
                                      "type": "validation_error",
                                      "title": "Invalid input",
                                      "status": 400,
                                      "detail": "Email format invalid",
                                      "errors": [
                                        {
                                          "field": "email",
                                          "message": "must be valid email",
                                          "value": "not-an-email"
                                        }
                                      ]
                                    }
```

### Go - Consistent Error Handling

```go
package main

import (
	"encoding/json"
	"net/http"
)

type APIError struct {
	Type   string        `json:"type"`
	Title  string        `json:"title"`
	Status int           `json:"status"`
	Detail string        `json:"detail"`
	Errors []FieldError  `json:"errors,omitempty"`
}

type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func writeError(w http.ResponseWriter, err APIError) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(err.Status)
	json.NewEncoder(w).Encode(err)
}

func main() {
	http.HandleFunc("POST /users", func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Name  string `json:"name"`
			Email string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, APIError{
				Type:   "parse_error",
				Title:  "Invalid JSON",
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

		if len(fieldErrors) > 0 {
			writeError(w, APIError{
				Type:   "validation_error",
				Title:  "Validation failed",
				Status: http.StatusBadRequest,
				Detail: "One or more fields are invalid",
				Errors: fieldErrors,
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"name": input.Name, "email": input.Email})
	})

	http.ListenAndServe(":8080", nil)
}
```

## Summary Cheat Sheet

```
  +---------------------------+-----------------------------------+
  | Topic                     | Rule of Thumb                     |
  +---------------------------+-----------------------------------+
  | URLs                      | Plural nouns, no verbs            |
  | Pagination                | Cursor for feeds, offset for UIs  |
  | Filtering                 | Query params, keep it simple      |
  | Sorting                   | ?sort=field or ?sort=-field       |
  | Partial responses         | ?fields=name,email                |
  | Errors                    | Structured JSON, include field    |
  |                           | errors for validation             |
  +---------------------------+-----------------------------------+
```

## Exercises

1. **Design URLs** for an e-commerce API: products, categories, reviews, carts.
   Include filtering and pagination.

2. **Implement filtering.** Add `?category=X&min_price=Y` to the products
   endpoint from the Go example above.

3. **Error format.** Write a validation function that returns structured
   errors for a "create order" endpoint (item_id, quantity, shipping_address).

4. **Debate: offset vs cursor.** When would you choose each? Write two
   scenarios where one is clearly better than the other.

---

[Next: Lesson 04 - GraphQL ->](04-graphql.md)
