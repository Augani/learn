# Lesson 14: Hexagonal Architecture (Ports and Adapters)

> **The one thing to remember**: Hexagonal Architecture puts your
> business logic in the center and connects it to the outside world
> through "ports" (interfaces) and "adapters" (implementations).
> Think of it like a game console: the console is the core, the
> controller ports accept different controllers, and the HDMI port
> works with any TV. The console doesn't care what's plugged into it.

---

## The Game Console Analogy

A PlayStation has ports: USB, HDMI, Ethernet, power. You can plug
in different controllers, displays, and network connections. The
console itself doesn't change — only the adapters (peripherals)
change.

```
HEXAGONAL ARCHITECTURE

                    ┌──────────────────────┐
   Primary          │                      │        Secondary
   (Driving)        │    APPLICATION       │        (Driven)
                    │       CORE           │
  ┌──────────┐     │                      │     ┌──────────┐
  │ REST API │────→ PORT ──→ Business ──→ PORT ────→│ Postgres │
  └──────────┘     │         Logic        │     └──────────┘
                    │                      │
  ┌──────────┐     │                      │     ┌──────────┐
  │   CLI    │────→ PORT ──→         ──→ PORT ────→│  Redis   │
  └──────────┘     │                      │     └──────────┘
                    │                      │
  ┌──────────┐     │                      │     ┌──────────┐
  │  Tests   │────→ PORT                PORT ────→│  S3      │
  └──────────┘     │                      │     └──────────┘
                    └──────────────────────┘

  PRIMARY PORTS: "How the outside world talks to us"
    (HTTP controllers, CLI commands, message consumers)

  SECONDARY PORTS: "How we talk to the outside world"
    (database, cache, file storage, external APIs)
```

---

## Ports and Adapters Explained

### Ports (Interfaces)

A port is an interface that defines how the application core
communicates. There are two kinds:

**Primary ports** (driving): Define what the application CAN DO.
These are your use case interfaces — the API of your business logic.

**Secondary ports** (driven): Define what the application NEEDS.
These are the interfaces for external dependencies — databases,
email services, payment gateways.

### Adapters (Implementations)

An adapter plugs into a port to connect a specific technology:

**Primary adapters** (driving): Translate external input into calls
to primary ports. An HTTP controller is a primary adapter. A CLI
command is a primary adapter. A test is a primary adapter.

**Secondary adapters** (driven): Implement secondary ports using
specific technologies. A PostgreSQL repository is a secondary
adapter. An SMTP email sender is a secondary adapter.

```
PORT = Interface (defined by the core)
ADAPTER = Implementation (lives outside the core)

  PRIMARY (inbound)              SECONDARY (outbound)
  ─────────────────              ──────────────────────
  "Things that USE                "Things the application
   the application"                USES"

  HTTP Controller ─→ Port         Port ─→ PostgresRepo
  CLI Command     ─→ Port         Port ─→ RedisCache
  gRPC Handler    ─→ Port         Port ─→ SmtpMailer
  Test Harness    ─→ Port         Port ─→ S3Storage
  Message Queue   ─→ Port         Port ─→ StripePayments
```

---

## Complete Example in TypeScript

### The Core (Business Logic + Ports)

```typescript
interface OrderData {
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
}

interface OrderResult {
  orderId: string;
  total: number;
}

interface PlaceOrderPort {
  execute(data: OrderData): Promise<OrderResult>;
}

interface OrderStore {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
}

interface ProductCatalog {
  getPrice(productId: string): Promise<number>;
}

interface PaymentProcessor {
  charge(customerId: string, amountCents: number): Promise<string>;
}

class PlaceOrderService implements PlaceOrderPort {
  constructor(
    private orders: OrderStore,
    private catalog: ProductCatalog,
    private payments: PaymentProcessor
  ) {}

  async execute(data: OrderData): Promise<OrderResult> {
    let totalCents = 0;
    const items: OrderItem[] = [];

    for (const item of data.items) {
      const price = await this.catalog.getPrice(item.productId);
      totalCents += price * item.quantity;
      items.push(new OrderItem(item.productId, price, item.quantity));
    }

    const txnId = await this.payments.charge(data.customerId, totalCents);
    const order = new Order(generateId(), data.customerId, items, txnId);
    await this.orders.save(order);

    return { orderId: order.id, total: totalCents / 100 };
  }
}
```

### Primary Adapters (Driving)

```typescript
class HttpOrderAdapter {
  constructor(private placeOrder: PlaceOrderPort) {}

  async handle(req: Request, res: Response): Promise<void> {
    const result = await this.placeOrder.execute({
      customerId: req.body.customerId,
      items: req.body.items,
    });
    res.status(201).json(result);
  }
}

class CliOrderAdapter {
  constructor(private placeOrder: PlaceOrderPort) {}

  async run(args: string[]): Promise<void> {
    const data = JSON.parse(fs.readFileSync(args[0], "utf-8"));
    const result = await this.placeOrder.execute(data);
    console.log(`Order placed: ${result.orderId}, Total: $${result.total}`);
  }
}
```

### Secondary Adapters (Driven)

```typescript
class PostgresOrderStore implements OrderStore {
  constructor(private pool: Pool) {}

  async save(order: Order): Promise<void> {
    await this.pool.query(
      "INSERT INTO orders (id, customer_id, txn_id) VALUES ($1, $2, $3)",
      [order.id, order.customerId, order.transactionId]
    );
  }

  async findById(id: string): Promise<Order | null> {
    const result = await this.pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    return result.rows[0] ? mapRowToOrder(result.rows[0]) : null;
  }
}

class StripePaymentProcessor implements PaymentProcessor {
  async charge(customerId: string, amountCents: number): Promise<string> {
    const charge = await stripe.charges.create({
      customer: customerId,
      amount: amountCents,
      currency: "usd",
    });
    return charge.id;
  }
}

class InMemoryOrderStore implements OrderStore {
  private orders = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }
}
```

---

## Hexagonal Architecture in Python

```python
# ports (defined by the core)
class UserRegistrationPort(Protocol):
    def register(self, email: str, name: str) -> User: ...

class UserStore(Protocol):
    def save(self, user: User) -> None: ...
    def exists(self, email: str) -> bool: ...

class WelcomeNotifier(Protocol):
    def send_welcome(self, user: User) -> None: ...

# core
class UserRegistrationService:
    def __init__(self, store: UserStore, notifier: WelcomeNotifier):
        self._store = store
        self._notifier = notifier

    def register(self, email: str, name: str) -> User:
        if self._store.exists(email):
            raise ValueError("Email already taken")
        user = User(id=generate_id(), email=email, name=name)
        self._store.save(user)
        self._notifier.send_welcome(user)
        return user

# primary adapter
class FlaskUserController:
    def __init__(self, registration: UserRegistrationPort):
        self._registration = registration

    def handle_register(self, request):
        user = self._registration.register(
            request.json["email"], request.json["name"]
        )
        return {"id": user.id, "email": user.email}, 201

# secondary adapters
class PostgresUserStore:
    def __init__(self, conn):
        self._conn = conn

    def save(self, user: User) -> None:
        self._conn.execute(
            "INSERT INTO users (id, email, name) VALUES (%s, %s, %s)",
            (user.id, user.email, user.name)
        )

    def exists(self, email: str) -> bool:
        row = self._conn.fetchone("SELECT 1 FROM users WHERE email=%s", (email,))
        return row is not None

class InMemoryUserStore:
    def __init__(self):
        self._users: dict[str, User] = {}

    def save(self, user: User) -> None:
        self._users[user.id] = user

    def exists(self, email: str) -> bool:
        return any(u.email == email for u in self._users.values())
```

## Hexagonal Architecture in Go

```go
// ports
type TaskService interface {
    Create(title string, assignee string) (*Task, error)
    Complete(taskID string) error
}

type TaskRepository interface {
    Save(task *Task) error
    FindByID(id string) (*Task, error)
}

type EventPublisher interface {
    Publish(event Event) error
}

// core
type TaskManager struct {
    repo      TaskRepository
    publisher EventPublisher
}

func (tm *TaskManager) Create(title, assignee string) (*Task, error) {
    task := &Task{ID: uuid.New().String(), Title: title, Assignee: assignee, Status: "open"}
    if err := tm.repo.Save(task); err != nil {
        return nil, err
    }
    tm.publisher.Publish(Event{Type: "task.created", Payload: task})
    return task, nil
}

func (tm *TaskManager) Complete(taskID string) error {
    task, err := tm.repo.FindByID(taskID)
    if err != nil {
        return err
    }
    task.Status = "completed"
    if err := tm.repo.Save(task); err != nil {
        return err
    }
    tm.publisher.Publish(Event{Type: "task.completed", Payload: task})
    return nil
}

// primary adapter
type HttpTaskHandler struct {
    service TaskService
}

func (h *HttpTaskHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
    var req CreateTaskRequest
    json.NewDecoder(r.Body).Decode(&req)
    task, err := h.service.Create(req.Title, req.Assignee)
    if err != nil {
        http.Error(w, err.Error(), 400)
        return
    }
    json.NewEncoder(w).Encode(task)
}

// secondary adapter
type PostgresTaskRepo struct {
    db *sql.DB
}

func (r *PostgresTaskRepo) Save(task *Task) error {
    _, err := r.db.Exec(
        `INSERT INTO tasks (id, title, assignee, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET status = $4`,
        task.ID, task.Title, task.Assignee, task.Status,
    )
    return err
}
```

---

## Hexagonal vs Clean Architecture

```
HEXAGONAL vs CLEAN ARCHITECTURE

  They're very similar! Both separate business logic from
  infrastructure using interfaces.

  HEXAGONAL                        CLEAN
  ─────────────────────────────    ─────────────────────────────
  Ports and Adapters               Concentric layers

  Two types: primary/secondary     Four layers: entities, use
                                   cases, adapters, frameworks

  Focuses on symmetry              Focuses on dependency direction
  (driving = driven)               (always inward)

  "Plug anything into              "Inner layers define
   any port"                        interfaces, outer layers
                                    implement them"

  In practice, most teams blend the two approaches.
  The core idea is identical: isolate business logic.
```

---

## Testing Benefits

The hexagonal structure makes testing straightforward at every level:

```
TESTING PYRAMID WITH HEXAGONAL ARCHITECTURE

  ┌─────────────────────────────────────┐
  │        Integration Tests            │  Test with real DB
  │    (secondary adapters + core)      │  and real services
  └─────────────────────────────────────┘
  ┌─────────────────────────────────────┐
  │        Use Case Tests               │  Test core with
  │    (core + in-memory adapters)      │  fake adapters
  └─────────────────────────────────────┘
  ┌─────────────────────────────────────┐
  │          Unit Tests                 │  Test entities
  │       (entities only)              │  in isolation
  └─────────────────────────────────────┘
```

---

## Exercises

1. **Identify ports**: Take an existing application and list all its
   primary ports (how is it accessed?) and secondary ports (what
   external systems does it use?).

2. **Add a primary adapter**: If your app has an HTTP API, add a CLI
   adapter that calls the same use case.

3. **Swap a secondary adapter**: Replace a database adapter with an
   in-memory one. Your use cases should work without any changes.

4. **Full hexagonal**: Build a small task management API with HTTP
   and CLI primary adapters, and PostgreSQL and in-memory secondary
   adapters.

---

[← Previous: Clean Architecture](./13-clean-architecture.md) · [Next: Lesson 15 — Domain-Driven Design Basics →](./15-ddd-basics.md)
