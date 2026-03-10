# Lesson 13: Clean Architecture

> **The one thing to remember**: Clean Architecture organizes code
> into concentric layers where dependencies always point INWARD.
> Business rules live at the center and know nothing about databases,
> web frameworks, or UIs. This means you can swap any outer layer
> without touching the business logic. Think of it like an onion:
> the core never depends on the skin.

---

## The Onion Analogy

Imagine an onion with four layers. Each layer can only depend on
layers closer to the center. The innermost layer knows nothing about
the outer layers.

```
CLEAN ARCHITECTURE: THE DEPENDENCY RULE

         ┌─────────────────────────────────────────┐
         │          FRAMEWORKS & DRIVERS            │
         │  (Web, DB, UI, External Services)        │
         │                                          │
         │    ┌─────────────────────────────────┐   │
         │    │     INTERFACE ADAPTERS           │   │
         │    │  (Controllers, Gateways,         │   │
         │    │   Presenters, Repositories)      │   │
         │    │                                  │   │
         │    │    ┌─────────────────────────┐   │   │
         │    │    │     USE CASES           │   │   │
         │    │    │  (Application Business  │   │   │
         │    │    │   Rules)                │   │   │
         │    │    │                         │   │   │
         │    │    │    ┌───────────────┐    │   │   │
         │    │    │    │  ENTITIES     │    │   │   │
         │    │    │    │  (Enterprise  │    │   │   │
         │    │    │    │   Business    │    │   │   │
         │    │    │    │   Rules)      │    │   │   │
         │    │    │    └───────────────┘    │   │   │
         │    │    └─────────────────────────┘   │   │
         │    └─────────────────────────────────┘   │
         └─────────────────────────────────────────┘

  Dependencies ALWAYS point inward →

  Entities know nothing about Use Cases.
  Use Cases know nothing about Controllers.
  Controllers know nothing about Frameworks.
```

---

## The Four Layers

### Layer 1: Entities (The Core)

Entities are your core business objects and rules. They exist
independent of any application. If you're building an e-commerce
system, the rule "an order total is the sum of item prices" is an
Entity-level rule — it's true whether you're a website, a mobile
app, or a command-line tool.

```typescript
class Money {
  constructor(
    readonly amount: number,
    readonly currency: string
  ) {
    if (amount < 0) throw new Error("Amount cannot be negative");
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error("Cannot add different currencies");
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }
}

class OrderItem {
  constructor(
    readonly productId: string,
    readonly name: string,
    readonly price: Money,
    readonly quantity: number
  ) {
    if (quantity <= 0) throw new Error("Quantity must be positive");
  }

  subtotal(): Money {
    return this.price.multiply(this.quantity);
  }
}

class Order {
  constructor(
    readonly id: string,
    readonly customerId: string,
    readonly items: OrderItem[],
    readonly createdAt: Date
  ) {}

  total(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.subtotal()),
      new Money(0, this.items[0]?.price.currency ?? "USD")
    );
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}
```

Notice: no database imports, no HTTP, no frameworks. Pure business
logic.

### Layer 2: Use Cases (Application Rules)

Use Cases orchestrate the flow of data to and from Entities. They
contain application-specific business rules. A use case might be
"place an order" or "register a new user."

```typescript
interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
}

interface PaymentGateway {
  charge(customerId: string, amount: Money): Promise<PaymentResult>;
}

interface OrderNotifier {
  sendConfirmation(order: Order): Promise<void>;
}

class PlaceOrderUseCase {
  constructor(
    private orders: OrderRepository,
    private payments: PaymentGateway,
    private notifier: OrderNotifier
  ) {}

  async execute(request: PlaceOrderRequest): Promise<PlaceOrderResponse> {
    const items = request.items.map(
      (i) => new OrderItem(i.productId, i.name, new Money(i.price, "USD"), i.quantity)
    );
    const order = new Order(generateId(), request.customerId, items, new Date());

    if (order.isEmpty()) {
      return { success: false, error: "Order cannot be empty" };
    }

    const paymentResult = await this.payments.charge(
      request.customerId,
      order.total()
    );

    if (!paymentResult.success) {
      return { success: false, error: "Payment failed" };
    }

    await this.orders.save(order);
    await this.notifier.sendConfirmation(order);

    return { success: true, orderId: order.id };
  }
}
```

The use case depends on **interfaces** (`OrderRepository`,
`PaymentGateway`), not implementations. It doesn't know if the
repo is Postgres or MongoDB.

### Layer 3: Interface Adapters (Controllers, Gateways)

This layer converts data between the format most convenient for use
cases and the format most convenient for external systems.

```typescript
class OrderController {
  constructor(private placeOrder: PlaceOrderUseCase) {}

  async handlePlaceOrder(req: HttpRequest): Promise<HttpResponse> {
    const request: PlaceOrderRequest = {
      customerId: req.body.customerId,
      items: req.body.items.map((i: Record<string, unknown>) => ({
        productId: String(i.productId),
        name: String(i.name),
        price: Number(i.price),
        quantity: Number(i.quantity),
      })),
    };

    const result = await this.placeOrder.execute(request);

    if (result.success) {
      return { status: 201, body: { orderId: result.orderId } };
    }
    return { status: 400, body: { error: result.error } };
  }
}

class PostgresOrderRepository implements OrderRepository {
  constructor(private db: Pool) {}

  async save(order: Order): Promise<void> {
    await this.db.query(
      "INSERT INTO orders (id, customer_id, created_at) VALUES ($1, $2, $3)",
      [order.id, order.customerId, order.createdAt]
    );
    for (const item of order.items) {
      await this.db.query(
        "INSERT INTO order_items (order_id, product_id, price, quantity) VALUES ($1, $2, $3, $4)",
        [order.id, item.productId, item.price.amount, item.quantity]
      );
    }
  }

  async findById(id: string): Promise<Order | null> {
    const rows = await this.db.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (rows.length === 0) return null;
    // ... map database rows back to Order entity
    return order;
  }
}
```

### Layer 4: Frameworks & Drivers

The outermost layer. Express, React, PostgreSQL drivers, Redis
clients. This is glue code that connects your adapters to external
tools. You write as little code here as possible.

```typescript
const app = express();

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const orderRepo = new PostgresOrderRepository(db);
const paymentGateway = new StripeGateway(process.env.STRIPE_KEY);
const notifier = new EmailNotifier(process.env.SMTP_URL);
const placeOrderUseCase = new PlaceOrderUseCase(orderRepo, paymentGateway, notifier);
const orderController = new OrderController(placeOrderUseCase);

app.post("/orders", (req, res) => orderController.handlePlaceOrder(req, res));
```

---

## The Dependency Rule

The most important rule in Clean Architecture:

```
THE DEPENDENCY RULE

  Source code dependencies ALWAYS point INWARD.

  ✓ Frameworks → Adapters → Use Cases → Entities     (correct)
  ✗ Entities → Use Cases → Adapters → Frameworks     (WRONG)

  Inner layers define INTERFACES.
  Outer layers provide IMPLEMENTATIONS.

  The Use Case says: "I need an OrderRepository"
  The Adapter says: "Here's a PostgresOrderRepository"

  The Use Case never says: "I need PostgreSQL"
```

### How Data Crosses Boundaries

```
DATA FLOW (not dependency direction!)

  HTTP Request
       │
       ▼
  Controller (converts HTTP → UseCase input)
       │
       ▼
  Use Case (orchestrates business logic)
       │
       ▼
  Repository Interface (defined by Use Case layer)
       │
       ▼
  PostgresRepo (implements the interface)
       │
       ▼
  Database

  Data flows outward to the DB, but DEPENDENCIES
  point inward. The Use Case defines the interface;
  the Postgres adapter implements it.
```

---

## Clean Architecture in Python

```python
# entities/user.py
class User:
    def __init__(self, user_id: str, email: str, name: str):
        if "@" not in email:
            raise ValueError("Invalid email")
        self.id = user_id
        self.email = email
        self.name = name

# use_cases/register_user.py
class UserRepository(Protocol):
    def save(self, user: User) -> None: ...
    def find_by_email(self, email: str) -> User | None: ...

class RegisterUser:
    def __init__(self, repo: UserRepository):
        self._repo = repo

    def execute(self, email: str, name: str) -> User:
        existing = self._repo.find_by_email(email)
        if existing:
            raise ValueError("Email already registered")
        user = User(generate_id(), email, name)
        self._repo.save(user)
        return user

# adapters/postgres_user_repo.py
class PostgresUserRepo:
    def __init__(self, connection):
        self._conn = connection

    def save(self, user: User) -> None:
        self._conn.execute(
            "INSERT INTO users (id, email, name) VALUES (%s, %s, %s)",
            (user.id, user.email, user.name)
        )

    def find_by_email(self, email: str) -> User | None:
        row = self._conn.fetchone("SELECT * FROM users WHERE email=%s", (email,))
        if not row:
            return None
        return User(row["id"], row["email"], row["name"])
```

## Clean Architecture in Go

```go
// entities
type User struct {
    ID    string
    Email string
    Name  string
}

// use cases
type UserRepository interface {
    Save(user *User) error
    FindByEmail(email string) (*User, error)
}

type RegisterUserUseCase struct {
    repo UserRepository
}

func (uc *RegisterUserUseCase) Execute(email, name string) (*User, error) {
    existing, _ := uc.repo.FindByEmail(email)
    if existing != nil {
        return nil, fmt.Errorf("email already registered")
    }
    user := &User{ID: uuid.New().String(), Email: email, Name: name}
    if err := uc.repo.Save(user); err != nil {
        return nil, err
    }
    return user, nil
}

// adapters
type PostgresUserRepo struct {
    db *sql.DB
}

func (r *PostgresUserRepo) Save(user *User) error {
    _, err := r.db.Exec(
        "INSERT INTO users (id, email, name) VALUES ($1, $2, $3)",
        user.ID, user.Email, user.Name,
    )
    return err
}
```

---

## Benefits and Costs

```
BENEFITS                           COSTS
─────────────────────────────      ─────────────────────────────
Testable without infrastructure    More files and interfaces
Framework-independent              Initial setup is more work
Database-independent               Over-engineering for small apps
Business rules are isolated        Learning curve
Easy to reason about each layer    Mapping between layers
```

**Rule of thumb**: Use Clean Architecture when your application has
meaningful business logic and will be maintained for years. Don't
use it for a weekend hack or a simple CRUD API.

---

## Exercises

1. **Layer identification**: Take an existing project and classify
   each class into one of the four layers. Where are the dependency
   rule violations?

2. **Extract entities**: Find business rules scattered in controller
   or database code. Move them into pure entity classes with no
   external dependencies.

3. **Build a use case**: Write a use case for "transfer money between
   accounts" that depends only on interfaces. Then write two
   implementations: one with a real database, one in-memory for tests.

4. **Swap the framework**: If your use cases are truly independent,
   you should be able to call them from a CLI instead of a web
   server. Try it.

---

[← Previous: Dependency Injection](./12-dependency-injection.md) · [Next: Lesson 14 — Hexagonal Architecture →](./14-hexagonal-architecture.md)
