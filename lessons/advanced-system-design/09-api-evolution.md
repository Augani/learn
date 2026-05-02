# Lesson 9: API Evolution

> The first version of your API is easy. The tenth version,
> with the first version still in production, is the hard part.

---

## The Analogy

Think about a power outlet standard. When your country decided
on a plug shape (Type A, Type B, Type G, etc.), that decision
was nearly permanent. Billions of devices were manufactured to
fit that exact shape. Changing the standard would require
replacing every outlet in every building AND every plug on every
device.

APIs are your power outlets. Once external consumers depend on
your API, changing it requires coordinating with every consumer
— and you probably don't even know who all of them are.

The goal isn't to never change. It's to change in ways that
don't break every device plugged into your wall.

---

## Versioning Strategies

### URL Path Versioning

```
  GET /v1/orders/123
  GET /v2/orders/123

  Pros:
  - Easy to understand
  - Clear which version a request uses
  - Can run v1 and v2 on different infrastructure

  Cons:
  - URL isn't a representation of the resource
  - Clients must update URLs to migrate
  - Every endpoint gets a version, even unchanged ones
```

### Header Versioning

```
  GET /orders/123
  Accept: application/vnd.mycompany.v2+json

  Pros:
  - URLs stay clean
  - Can version individual resources
  - More RESTful

  Cons:
  - Harder to test (can't just paste URL in browser)
  - Clients must manage headers carefully
  - Proxy/cache configuration more complex
```

### Query Parameter Versioning

```
  GET /orders/123?version=2

  Pros:
  - Easy to test
  - Backward compatible by default (no param = latest or v1)

  Cons:
  - Pollutes URL
  - Caching complexity
  - Feels hacky
```

### What to Actually Use

```
  ┌──────────────────────────────────────────────────────────┐
  │ Recommendation:                                          │
  │                                                          │
  │ EXTERNAL APIs: URL path versioning (/v1/, /v2/)          │
  │ Reason: Simplest for external consumers to understand.   │
  │ Accept the trade-offs for clarity.                       │
  │                                                          │
  │ INTERNAL APIs: Don't version. Just evolve.               │
  │ Reason: You control both sides. Use additive changes     │
  │ and feature flags. Versioning internal APIs creates       │
  │ coordination overhead that slows everyone down.          │
  └──────────────────────────────────────────────────────────┘
```

---

## Breaking vs Non-Breaking Changes

This is the most important distinction in API evolution.

```
  NON-BREAKING (safe to deploy anytime):

  ✓ Adding a new field to a response
  ✓ Adding a new optional query parameter
  ✓ Adding a new endpoint
  ✓ Adding a new enum value (if client handles unknown values)
  ✓ Widening a type (int32 → int64)
  ✓ Making a required field optional
  ✓ Increasing a rate limit

  BREAKING (requires coordination):

  ✗ Removing a field from a response
  ✗ Renaming a field
  ✗ Changing a field type (string → int)
  ✗ Adding a required field to a request
  ✗ Removing an endpoint
  ✗ Changing the URL structure
  ✗ Changing error codes or formats
  ✗ Narrowing a type (int64 → int32)
  ✗ Making an optional field required
  ✗ Reducing a rate limit
```

### The Robustness Principle (Postel's Law)

> Be conservative in what you send, liberal in what you accept.

For APIs, this means:
- **Producers**: Only add fields, never remove or rename
- **Consumers**: Ignore fields you don't recognize
- **Both**: Tolerate unknown enum values

```go
type OrderResponse struct {
	ID        string  `json:"id"`
	Status    string  `json:"status"`
	Total     float64 `json:"total"`
	Currency  string  `json:"currency"`
	CreatedAt string  `json:"created_at"`
}

func decodeOrder(data []byte) (*OrderResponse, error) {
	var order OrderResponse
	if err := json.Unmarshal(data, &order); err != nil {
		return nil, err
	}
	return &order, nil
}
```

---

## Migration Strategies for Breaking Changes

When you absolutely must make a breaking change:

### Strategy 1: Additive Change + Deprecation

```
  Step 1: Add new field alongside old field

  Response v1:
  {
    "user_name": "Alice Smith"
  }

  Response v1.1 (both fields):
  {
    "user_name": "Alice Smith",
    "display_name": "Alice Smith"
  }

  Step 2: Mark old field as deprecated (docs, headers)

  Deprecation-Warning: user_name is deprecated, use display_name

  Step 3: Monitor old field usage

  Track which consumers still read user_name.
  Contact them. Give timeline (90 days minimum).

  Step 4: Remove old field (new major version)

  Response v2:
  {
    "display_name": "Alice Smith"
  }
```

### Strategy 2: API Gateway Transformation

```
  Consumer sends v1 request
         │
         ▼
  ┌──────────────┐
  │  API Gateway  │
  │  (transforms  │
  │   v1 → v2)   │
  └──────┬───────┘
         │ v2 request
         ▼
  ┌──────────────┐
  │   Service    │
  │  (only v2)   │
  └──────┬───────┘
         │ v2 response
         ▼
  ┌──────────────┐
  │  API Gateway  │
  │  (transforms  │
  │   v2 → v1)   │
  └──────┬───────┘
         │ v1 response
         ▼
  Consumer receives v1 response
```

The service only needs to support the latest version.
The gateway handles backward compatibility.

```go
func TransformV1ToV2(v1Body []byte) ([]byte, error) {
	var v1 map[string]interface{}
	if err := json.Unmarshal(v1Body, &v1); err != nil {
		return nil, err
	}

	if userName, ok := v1["user_name"]; ok {
		v1["display_name"] = userName
		delete(v1, "user_name")
	}

	return json.Marshal(v1)
}

func TransformV2ToV1(v2Body []byte) ([]byte, error) {
	var v2 map[string]interface{}
	if err := json.Unmarshal(v2Body, &v2); err != nil {
		return nil, err
	}

	if displayName, ok := v2["display_name"]; ok {
		v2["user_name"] = displayName
	}

	return json.Marshal(v2)
}
```

### Strategy 3: Parallel Endpoints

Run old and new endpoints simultaneously during migration:

```
  POST /v1/orders    ← old consumers
  POST /v2/orders    ← new consumers

  Both write to the same database.
  Same validation. Different request/response shapes.
  Eventually sunset v1.
```

---

## API Deprecation

Deprecation is a process, not an event.

```
  Timeline for deprecating an API version:

  ┌────────────────────────────────────────────────────────────┐
  │                                                            │
  │ Month 0:  Announce deprecation                             │
  │           - Blog post, email to consumers                  │
  │           - Add Deprecation header to responses            │
  │           - Update docs with migration guide               │
  │                                                            │
  │ Month 1:  Start tracking usage                             │
  │           - Dashboard: requests per consumer per version   │
  │           - Contact top consumers directly                 │
  │                                                            │
  │ Month 3:  Reduce SLA for deprecated version                │
  │           - No new features on v1                          │
  │           - Security patches only                          │
  │           - Add Sunset header with date                    │
  │                                                            │
  │ Month 6:  Rate limit deprecated version                    │
  │           - Gradual reduction in allowed rate              │
  │           - Return 299 Warning header                      │
  │                                                            │
  │ Month 9:  Return 410 Gone for deprecated endpoints         │
  │           - Or redirect to new version with 301            │
  │                                                            │
  │ Month 12: Remove deprecated code completely                │
  │                                                            │
  └────────────────────────────────────────────────────────────┘
```

### Deprecation Headers (RFC 8594 / RFC 9230)

```http
HTTP/1.1 200 OK
Deprecation: Sat, 01 Sep 2026 00:00:00 GMT
Sunset: Sat, 01 Dec 2026 00:00:00 GMT
Link: <https://api.example.com/v2/docs>; rel="successor-version"
```

---

## Consumer-Driven Contracts

Instead of the API provider defining what consumers need,
consumers define what they need from the provider.

```
  Traditional: Provider defines, consumers adapt

  Provider: "Here's our API. Deal with it."
  Consumer A: "I only need 3 of your 20 fields."
  Consumer B: "I need a field you don't expose."
  Consumer C: "You changed a field and broke us."


  Consumer-Driven: Consumers define, provider validates

  Consumer A: "I need fields: id, name, email"
  Consumer B: "I need fields: id, orders, total_spent"
  Consumer C: "I need fields: id, name, created_at"

  Provider runs ALL consumer contracts before deploying.
  If a change breaks ANY contract, deployment fails.
```

### Pact (Contract Testing)

```go
func TestOrderServiceContract(t *testing.T) {
	pact := dsl.Pact{
		Consumer: "checkout-service",
		Provider: "order-service",
	}

	pact.AddInteraction().
		Given("an order exists").
		UponReceiving("a request for an order").
		WithRequest(dsl.Request{
			Method: "GET",
			Path:   dsl.String("/orders/123"),
			Headers: dsl.MapMatcher{
				"Accept": dsl.String("application/json"),
			},
		}).
		WillRespondWith(dsl.Response{
			Status: 200,
			Headers: dsl.MapMatcher{
				"Content-Type": dsl.String("application/json"),
			},
			Body: dsl.Match(OrderResponse{
				ID:     "123",
				Status: "confirmed",
				Total:  49.99,
			}),
		})

	err := pact.Verify(func() error {
		client := NewOrderClient(pact.Server.URL)
		order, err := client.GetOrder("123")
		if err != nil {
			return err
		}
		if order.ID != "123" {
			return fmt.Errorf("expected ID 123, got %s", order.ID)
		}
		return nil
	})

	if err != nil {
		t.Fatal(err)
	}
}
```

The provider runs all consumer contracts in their CI pipeline:

```yaml
jobs:
  verify-contracts:
    steps:
      - name: Fetch consumer contracts
        run: pact-broker list-latest-pact-versions --broker-url=$PACT_BROKER

      - name: Verify all contracts
        run: go test ./... -run TestProviderPacts -tags=pact
```

---

## GraphQL Federation

For large organizations with many teams, GraphQL Federation
lets each team own their part of the graph.

```
  Without Federation (monolithic GraphQL):

  ┌──────────────────────────────────────┐
  │        Giant GraphQL Server           │
  │  (one team owns everything)          │
  │                                      │
  │  type User { ... }                   │
  │  type Order { ... }                  │
  │  type Product { ... }               │
  │  type Payment { ... }               │
  └──────────────────────────────────────┘


  With Federation (distributed GraphQL):

  ┌──────────────────┐
  │  Apollo Gateway   │  (routes queries to subgraphs)
  └──────┬───────────┘
         │
    ┌────┼────┬────────┐
    │    │    │        │
    ▼    ▼    ▼        ▼
  ┌────┐┌────┐┌──────┐┌───────┐
  │User││Ordr││ Prod ││Payment│  (each team owns their subgraph)
  │Svc ││Svc ││ Svc  ││ Svc   │
  └────┘└────┘└──────┘└───────┘
```

### Federation Schema Example

```graphql
# User subgraph (owned by User team)
type User @key(fields: "id") {
  id: ID!
  name: String!
  email: String!
}

# Order subgraph (owned by Order team)
type Order @key(fields: "id") {
  id: ID!
  items: [OrderItem!]!
  total: Float!
  user: User!  # references User from another subgraph
}

extend type User @key(fields: "id") {
  id: ID! @external
  orders: [Order!]!  # adds 'orders' field to User type
}
```

A single query can span subgraphs:

```graphql
query {
  user(id: "123") {
    name           # resolved by User subgraph
    email          # resolved by User subgraph
    orders {       # resolved by Order subgraph
      id
      total
      items {
        name       # resolved by Product subgraph
        price
      }
    }
  }
}
```

---

## Backend for Frontend (BFF) Pattern

Instead of one API for all clients, each client type gets its
own API:

```
  Without BFF:

  Mobile App ──┐
  Web App    ──┼──> Generic API ──> Microservices
  Partner API ─┘

  Mobile needs: small payloads, offline support
  Web needs: full data, real-time updates
  Partner needs: batch operations, webhooks

  One API can't serve all three well.


  With BFF:

  Mobile App ──> Mobile BFF ──┐
  Web App    ──> Web BFF    ──┼──> Microservices
  Partner    ──> Partner BFF──┘

  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │ Mobile BFF  │  │   Web BFF   │  │ Partner BFF │
  │             │  │             │  │             │
  │ - Compact   │  │ - Full data │  │ - Batch ops │
  │   payloads  │  │ - WebSocket │  │ - Webhooks  │
  │ - Offline   │  │   support   │  │ - Rate      │
  │   friendly  │  │ - Server    │  │   limits    │
  │ - Auth via  │  │   rendering │  │ - API keys  │
  │   tokens    │  │   support   │  │             │
  └─────────────┘  └─────────────┘  └─────────────┘
```

### When BFF Makes Sense

```
  Use BFF when:
  ✓ Different clients need fundamentally different data shapes
  ✓ Different clients have different performance requirements
  ✓ You have dedicated frontend teams per platform
  ✓ API aggregation is complex (combining many microservices)

  Don't use BFF when:
  ✗ All clients need the same data
  ✗ You only have one client type
  ✗ The BFF would just be a passthrough proxy
  ✗ You don't have team capacity to maintain multiple BFFs
```

---

## API Governance at Scale

With 50+ teams building APIs, you need standards:

```
  API Design Review Checklist:

  □ Follows naming conventions (snake_case, resource-based URLs)
  □ Uses standard HTTP status codes
  □ Includes pagination for list endpoints
  □ Supports filtering and sorting
  □ Has idempotency keys for mutating operations
  □ Returns consistent error format
  □ Includes versioning strategy
  □ Has OpenAPI/Swagger spec
  □ Rate limiting defined
  □ Authentication/authorization documented
  □ Breaking change review completed
  □ Consumer contracts updated
```

```yaml
openapi: 3.0.3
info:
  title: Order Service API
  version: 2.0.0
  x-api-owner: order-team
  x-api-tier: critical
  x-deprecation-policy: 12-months

paths:
  /v2/orders/{orderId}:
    get:
      operationId: getOrder
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Order found
          headers:
            X-Request-Id:
              schema:
                type: string
            X-RateLimit-Remaining:
              schema:
                type: integer
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '404':
          $ref: '#/components/responses/NotFound'
        '429':
          $ref: '#/components/responses/RateLimited'
```

---

## Exercises

1. **Version migration.** Your API v1 returns user names as a
   single `name` field. V2 needs `first_name` and `last_name`.
   Design the complete migration plan. How do you handle names
   that don't cleanly split (e.g., "Madonna", "Jean-Claude Van
   Damme")? How long is the deprecation period?

2. **Contract testing.** You own a user service consumed by 8 other
   teams. Design the consumer-driven contract testing setup. What
   happens when a contract breaks? Who is responsible for fixing
   it? How do you handle urgent security patches that break
   contracts?

3. **Federation design.** Your e-commerce platform has 5 domains:
   users, products, orders, payments, and shipping. Design the
   GraphQL federation schema. Which entities are shared? How do
   you handle the N+1 query problem across subgraphs?

4. **BFF evaluation.** Your platform has a mobile app, web app,
   and public API. Currently all use the same REST API. The mobile
   team complains about over-fetching, the web team wants
   WebSocket support, and partners want batch operations. Evaluate
   whether BFF is the right approach. What's the migration plan?

---

[Next: Lesson 10 — Data Architecture -->](10-data-architecture.md)
