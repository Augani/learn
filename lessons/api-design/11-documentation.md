# Lesson 11: Documentation

## The Ikea Manual Analogy

Great API documentation is like an Ikea manual. You don't need to call
the factory to figure out how to assemble the shelf. Every part is labeled,
every step is illustrated, and there's a list of tools you need.

Bad API docs are like getting furniture with no manual -- you'll figure it
out eventually, but you'll waste hours and have leftover screws.

```
  BAD DOCS:                         GOOD DOCS:
  +---------------------------+     +---------------------------+
  | "Use the API"             |     | Every endpoint listed     |
  | "See code for details"    |     | Request/response examples |
  | (last updated 2019)       |     | Error codes explained     |
  |                           |     | Authentication guide      |
  +---------------------------+     | Runnable code samples     |
                                    | Always up to date         |
                                    +---------------------------+
```

## OpenAPI (Swagger)

OpenAPI is the industry standard for describing REST APIs. It's a YAML/JSON
file that defines every endpoint, parameter, request body, and response.

```
  openapi.yaml
       |
       v
  +----+-----+-----+-----+-----+
  |    |     |     |     |     |
  | Docs | Client | Server | Tests | Mock |
  | Page | SDKs  | Stubs  | Gen   | Srvr |
  +------+-------+--------+-------+------+
  One spec, many outputs
```

### Example OpenAPI Spec

```yaml
openapi: "3.1.0"
info:
  title: Bookstore API
  version: "1.0.0"
  description: API for managing a bookstore

servers:
  - url: https://api.bookstore.com/v1

paths:
  /books:
    get:
      summary: List all books
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: per_page
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: genre
          in: query
          schema:
            type: string
      responses:
        "200":
          description: A list of books
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/Book"
                  pagination:
                    $ref: "#/components/schemas/Pagination"

    post:
      summary: Create a book
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateBookRequest"
      responses:
        "201":
          description: Book created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Book"
        "400":
          description: Validation error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /books/{id}:
    get:
      summary: Get a book by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The book
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Book"
        "404":
          description: Book not found

components:
  schemas:
    Book:
      type: object
      required: [id, title, author, isbn]
      properties:
        id:
          type: string
        title:
          type: string
        author:
          type: string
        isbn:
          type: string
        genre:
          type: string
        published_at:
          type: string
          format: date

    CreateBookRequest:
      type: object
      required: [title, author, isbn]
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 200
        author:
          type: string
        isbn:
          type: string
          pattern: "^[0-9]{13}$"
        genre:
          type: string

    Pagination:
      type: object
      properties:
        page:
          type: integer
        per_page:
          type: integer
        total:
          type: integer

    Error:
      type: object
      properties:
        type:
          type: string
        title:
          type: string
        status:
          type: integer
        detail:
          type: string

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
```

## API-First Design

Write the spec BEFORE writing code. Like an architect drawing blueprints
before pouring concrete.

```
  TRADITIONAL:                    API-FIRST:
  1. Write code                   1. Write OpenAPI spec
  2. Generate docs (maybe)        2. Review with stakeholders
  3. Docs drift from reality      3. Generate server stubs
                                  4. Implement handlers
                                  5. Docs are always accurate

  +----------+     +---------+     +----------+
  | Write    | --> | Review  | --> | Generate |
  | OpenAPI  |     | with    |     | code +   |
  | spec     |     | team    |     | docs     |
  +----------+     +---------+     +----------+
```

## Generating Docs from Code

If you don't go API-first, you can generate specs from code annotations.

### Go - Generating OpenAPI from Code

```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type Book struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
	ISBN   string `json:"isbn"`
}

type CreateBookRequest struct {
	Title  string `json:"title"`
	Author string `json:"author"`
	ISBN   string `json:"isbn"`
}

func main() {
	http.HandleFunc("GET /books", listBooks)
	http.HandleFunc("POST /books", createBook)
	http.HandleFunc("GET /books/{id}", getBook)
	http.HandleFunc("GET /docs", serveSpec)

	fmt.Println("Server on :8080, docs at /docs")
	http.ListenAndServe(":8080", nil)
}

func listBooks(w http.ResponseWriter, r *http.Request) {
	books := []Book{
		{ID: "1", Title: "API Design Patterns", Author: "JJ Geewax", ISBN: "9781617295850"},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"data": books})
}

func createBook(w http.ResponseWriter, r *http.Request) {
	var req CreateBookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid json"})
		return
	}
	book := Book{ID: "2", Title: req.Title, Author: req.Author, ISBN: req.ISBN}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(book)
}

func getBook(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	book := Book{ID: id, Title: "API Design Patterns", Author: "JJ Geewax", ISBN: "9781617295850"}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(book)
}

func serveSpec(w http.ResponseWriter, r *http.Request) {
	spec := map[string]any{
		"openapi": "3.1.0",
		"info": map[string]string{
			"title":   "Bookstore API",
			"version": "1.0.0",
		},
		"paths": map[string]any{
			"/books": map[string]any{
				"get":  map[string]string{"summary": "List all books"},
				"post": map[string]string{"summary": "Create a book"},
			},
			"/books/{id}": map[string]any{
				"get": map[string]string{"summary": "Get a book by ID"},
			},
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(spec)
}
```

## Documentation Checklist

```
  +-------------------------------------------------------+
  |  GREAT API DOCS INCLUDE:                              |
  +-------------------------------------------------------+
  |                                                       |
  |  [ ] Getting started guide (auth, first request)      |
  |  [ ] Authentication section                           |
  |  [ ] Endpoint reference (all paths, methods)          |
  |  [ ] Request/response examples (copy-pasteable)       |
  |  [ ] Error code reference                             |
  |  [ ] Rate limit documentation                         |
  |  [ ] Pagination guide                                 |
  |  [ ] Changelog / versioning policy                    |
  |  [ ] SDKs or code samples in popular languages        |
  |  [ ] Interactive playground (try-it-out)              |
  |                                                       |
  +-------------------------------------------------------+
```

## Tools Ecosystem

```
  +-------------------+--------------------------------------------+
  | Tool              | Purpose                                    |
  +-------------------+--------------------------------------------+
  | Swagger UI        | Interactive docs from OpenAPI spec          |
  | Redoc             | Beautiful API reference docs                |
  | Stoplight         | Visual API design + docs                   |
  | Postman           | API testing + auto-generated docs           |
  | openapi-generator | Generate client SDKs from spec              |
  | oapi-codegen (Go) | Generate Go server/client from OpenAPI      |
  +-------------------+--------------------------------------------+
```

## Exercises

1. **Write an OpenAPI spec** for a todo-list API with: create, list,
   get, update, and delete todos. Include filtering by status.

2. **Generate docs.** Use Swagger UI (available as a Docker image) to
   render your spec: `docker run -p 80:8080 swaggerapi/swagger-ui`

3. **API-first exercise.** Before writing any code, write the OpenAPI
   spec for a "URL shortener" API. Then implement it.

4. **Review real docs.** Look at the Stripe API docs. List 3 things they
   do well that you'd want to copy.

---

[Next: Lesson 12 - Error Handling ->](12-error-handling.md)
