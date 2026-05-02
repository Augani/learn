# Lesson 16: Repository and Unit of Work

> **The one thing to remember**: Repository acts as a collection of
> domain objects — you ask it for objects and give it objects to
> store, without knowing anything about SQL or databases. Unit of
> Work groups multiple operations into a single transaction — either
> everything succeeds or everything rolls back. Together, they keep
> your business logic clean of database concerns.

---

## The Library Analogy

Think of a public library:

**Repository** = the librarian. You say "I need books about space"
and the librarian brings you books. You don't go into the back room
and search the shelves yourself. You don't know if books are stored
alphabetically, by Dewey Decimal, or in cardboard boxes. You just
ask the librarian.

**Unit of Work** = checking out books. When you check out three
books, it's one transaction. Either all three are recorded as
checked out, or none are. You don't get a situation where two
books are checked out but the third isn't recorded.

```
REPOSITORY: A COLLECTION FACADE FOR YOUR DATA

  Your Code                Repository            Database
  ─────────               ──────────             ────────
  "Give me order #123"  → findById("123")      → SELECT * FROM orders
                          ← Order object        ← WHERE id = '123'

  "Save this order"     → save(order)           → INSERT INTO orders ...

  "Find pending orders" → findByStatus("pending") → SELECT * FROM orders
                          ← Order[]                 WHERE status = 'pending'

  Your code sees: a collection of Order objects
  Your code does NOT see: SQL, tables, joins, connections
```

---

## Repository Pattern

### The Problem

Without Repository, database logic leaks into business code:

```typescript
class OrderService {
  async placeOrder(customerId: string, items: CartItem[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "INSERT INTO orders (customer_id, status) VALUES ($1, $2) RETURNING id",
        [customerId, "pending"]
      );
      const orderId = result.rows[0].id;
      for (const item of items) {
        await client.query(
          "INSERT INTO order_items (order_id, product_id, qty, price) VALUES ($1, $2, $3, $4)",
          [orderId, item.productId, item.quantity, item.price]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
```

Business logic is buried in SQL. Testing requires a real database.
Changing from PostgreSQL to MongoDB means rewriting business code.

### With Repository

```typescript
interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  findByCustomer(customerId: string): Promise<Order[]>;
  findByStatus(status: OrderStatus): Promise<Order[]>;
  delete(id: string): Promise<void>;
}

class OrderService {
  constructor(private orders: OrderRepository) {}

  async placeOrder(customerId: string, items: CartItem[]): Promise<Order> {
    const order = new Order(generateId(), customerId, items);
    order.validate();
    await this.orders.save(order);
    return order;
  }

  async cancelOrder(orderId: string): Promise<void> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new Error("Order not found");
    order.cancel();
    await this.orders.save(order);
  }
}
```

Clean. Testable. Database-independent.

### Repository Implementation in TypeScript

```typescript
class PostgresOrderRepository implements OrderRepository {
  constructor(private pool: Pool) {}

  async save(order: Order): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO orders (id, customer_id, status, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET status = $3`,
        [order.id, order.customerId, order.status, order.createdAt]
      );

      await client.query("DELETE FROM order_items WHERE order_id = $1", [order.id]);
      for (const item of order.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [order.id, item.productId, item.quantity, item.price]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<Order | null> {
    const orderRow = await this.pool.query(
      "SELECT * FROM orders WHERE id = $1", [id]
    );
    if (orderRow.rows.length === 0) return null;

    const itemRows = await this.pool.query(
      "SELECT * FROM order_items WHERE order_id = $1", [id]
    );

    return this.mapToOrder(orderRow.rows[0], itemRows.rows);
  }

  async findByCustomer(customerId: string): Promise<Order[]> {
    const rows = await this.pool.query(
      "SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC",
      [customerId]
    );
    return Promise.all(rows.rows.map((row) => this.hydrateOrder(row)));
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    const rows = await this.pool.query(
      "SELECT * FROM orders WHERE status = $1", [status]
    );
    return Promise.all(rows.rows.map((row) => this.hydrateOrder(row)));
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM orders WHERE id = $1", [id]);
  }

  private mapToOrder(row: DbRow, itemRows: DbRow[]): Order {
    const items = itemRows.map(
      (r) => new OrderItem(r.product_id, r.price, r.quantity)
    );
    return new Order(row.id, row.customer_id, items, row.status, row.created_at);
  }
}
```

### In-Memory Repository for Testing

```typescript
class InMemoryOrderRepository implements OrderRepository {
  private store = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.store.set(order.id, structuredClone(order));
  }

  async findById(id: string): Promise<Order | null> {
    const order = this.store.get(id);
    return order ? structuredClone(order) : null;
  }

  async findByCustomer(customerId: string): Promise<Order[]> {
    return [...this.store.values()]
      .filter((o) => o.customerId === customerId)
      .map((o) => structuredClone(o));
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    return [...this.store.values()]
      .filter((o) => o.status === status)
      .map((o) => structuredClone(o));
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
```

### Repository in Python

```python
from abc import ABC, abstractmethod

class ProductRepository(ABC):
    @abstractmethod
    def find_by_id(self, product_id: str) -> Product | None: ...

    @abstractmethod
    def find_by_category(self, category: str) -> list[Product]: ...

    @abstractmethod
    def save(self, product: Product) -> None: ...

    @abstractmethod
    def delete(self, product_id: str) -> None: ...

class SqlAlchemyProductRepo(ProductRepository):
    def __init__(self, session):
        self._session = session

    def find_by_id(self, product_id: str) -> Product | None:
        row = self._session.query(ProductModel).get(product_id)
        return self._to_domain(row) if row else None

    def find_by_category(self, category: str) -> list[Product]:
        rows = (self._session.query(ProductModel)
                .filter(ProductModel.category == category)
                .all())
        return [self._to_domain(r) for r in rows]

    def save(self, product: Product) -> None:
        model = self._to_model(product)
        self._session.merge(model)

    def delete(self, product_id: str) -> None:
        self._session.query(ProductModel).filter_by(id=product_id).delete()

    def _to_domain(self, model: ProductModel) -> Product:
        return Product(id=model.id, name=model.name,
                       price=Money(model.price, model.currency),
                       category=model.category)

    def _to_model(self, product: Product) -> ProductModel:
        return ProductModel(id=product.id, name=product.name,
                           price=product.price.amount,
                           currency=product.price.currency,
                           category=product.category)
```

### Repository in Rust

```rust
trait UserRepository {
    fn find_by_id(&self, id: &str) -> Result<Option<User>, RepoError>;
    fn find_by_email(&self, email: &str) -> Result<Option<User>, RepoError>;
    fn save(&self, user: &User) -> Result<(), RepoError>;
    fn delete(&self, id: &str) -> Result<(), RepoError>;
}

struct PostgresUserRepo {
    pool: PgPool,
}

impl UserRepository for PostgresUserRepo {
    fn find_by_id(&self, id: &str) -> Result<Option<User>, RepoError> {
        let row = sqlx::query_as!(UserRow,
            "SELECT id, email, name FROM users WHERE id = $1", id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| User::new(r.id, r.email, r.name)))
    }

    fn save(&self, user: &User) -> Result<(), RepoError> {
        sqlx::query!(
            "INSERT INTO users (id, email, name) VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET email = $2, name = $3",
            user.id, user.email, user.name)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    fn find_by_email(&self, email: &str) -> Result<Option<User>, RepoError> {
        let row = sqlx::query_as!(UserRow,
            "SELECT id, email, name FROM users WHERE email = $1", email)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| User::new(r.id, r.email, r.name)))
    }

    fn delete(&self, id: &str) -> Result<(), RepoError> {
        sqlx::query!("DELETE FROM users WHERE id = $1", id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
```

### Repository in Go

```go
type ArticleRepository interface {
    FindByID(id string) (*Article, error)
    FindByAuthor(authorID string) ([]*Article, error)
    FindPublished(limit int, offset int) ([]*Article, error)
    Save(article *Article) error
    Delete(id string) error
}

type PostgresArticleRepo struct {
    db *sql.DB
}

func (r *PostgresArticleRepo) FindByID(id string) (*Article, error) {
    row := r.db.QueryRow(
        "SELECT id, title, body, author_id, published_at FROM articles WHERE id = $1", id)

    var a Article
    var publishedAt sql.NullTime
    err := row.Scan(&a.ID, &a.Title, &a.Body, &a.AuthorID, &publishedAt)
    if err == sql.ErrNoRows {
        return nil, nil
    }
    if err != nil {
        return nil, err
    }
    if publishedAt.Valid {
        a.PublishedAt = &publishedAt.Time
    }
    return &a, nil
}

func (r *PostgresArticleRepo) Save(article *Article) error {
    _, err := r.db.Exec(
        `INSERT INTO articles (id, title, body, author_id, published_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET title=$2, body=$3, published_at=$5`,
        article.ID, article.Title, article.Body, article.AuthorID, article.PublishedAt,
    )
    return err
}
```

---

## Unit of Work Pattern

Unit of Work tracks all changes during a business operation and
commits them in a single transaction.

```
UNIT OF WORK: ALL OR NOTHING

  Business Operation: "Transfer $100 from Account A to Account B"

  Steps:
    1. Debit Account A by $100
    2. Credit Account B by $100
    3. Log the transfer

  Without Unit of Work:
    Step 1 succeeds ✓
    Step 2 fails ✗       ← Account A lost $100, Account B gained nothing!
    Step 3 never runs

  With Unit of Work:
    Step 1 succeeds ✓ (tracked, not committed)
    Step 2 fails ✗
    ROLLBACK → Step 1 is undone
    → Both accounts unchanged. No money lost.
```

### Unit of Work in TypeScript

```typescript
interface UnitOfWork {
  orders: OrderRepository;
  payments: PaymentRepository;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

class PostgresUnitOfWork implements UnitOfWork {
  orders: OrderRepository;
  payments: PaymentRepository;
  private client: PoolClient;

  static async create(pool: Pool): Promise<PostgresUnitOfWork> {
    const client = await pool.connect();
    await client.query("BEGIN");
    const uow = new PostgresUnitOfWork();
    uow.client = client;
    uow.orders = new PostgresOrderRepo(client);
    uow.payments = new PostgresPaymentRepo(client);
    return uow;
  }

  async commit(): Promise<void> {
    try {
      await this.client.query("COMMIT");
    } finally {
      this.client.release();
    }
  }

  async rollback(): Promise<void> {
    try {
      await this.client.query("ROLLBACK");
    } finally {
      this.client.release();
    }
  }
}

class TransferService {
  constructor(private pool: Pool) {}

  async transfer(fromId: string, toId: string, amount: Money): Promise<void> {
    const uow = await PostgresUnitOfWork.create(this.pool);
    try {
      const fromOrder = await uow.orders.findById(fromId);
      const toOrder = await uow.orders.findById(toId);

      if (!fromOrder || !toOrder) throw new Error("Order not found");

      fromOrder.debit(amount);
      toOrder.credit(amount);

      await uow.orders.save(fromOrder);
      await uow.orders.save(toOrder);
      await uow.payments.logTransfer(fromId, toId, amount);

      await uow.commit();
    } catch (e) {
      await uow.rollback();
      throw e;
    }
  }
}
```

### Unit of Work in Python

Python's context managers make UoW elegant:

```python
class UnitOfWork:
    def __init__(self, session_factory):
        self._session_factory = session_factory

    def __enter__(self):
        self.session = self._session_factory()
        self.accounts = SqlAlchemyAccountRepo(self.session)
        self.transfers = SqlAlchemyTransferRepo(self.session)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.session.rollback()
        self.session.close()

    def commit(self):
        self.session.commit()

class TransferService:
    def __init__(self, uow_factory):
        self._uow_factory = uow_factory

    def transfer(self, from_id: str, to_id: str, amount: Decimal) -> None:
        with self._uow_factory() as uow:
            from_account = uow.accounts.find_by_id(from_id)
            to_account = uow.accounts.find_by_id(to_id)

            from_account.debit(amount)
            to_account.credit(amount)

            uow.accounts.save(from_account)
            uow.accounts.save(to_account)
            uow.transfers.log(from_id, to_id, amount)

            uow.commit()
```

### Unit of Work in Go

```go
type UnitOfWork struct {
    tx       *sql.Tx
    Accounts AccountRepository
    Ledger   LedgerRepository
}

func NewUnitOfWork(db *sql.DB) (*UnitOfWork, error) {
    tx, err := db.Begin()
    if err != nil {
        return nil, err
    }
    return &UnitOfWork{
        tx:       tx,
        Accounts: &PostgresAccountRepo{tx: tx},
        Ledger:   &PostgresLedgerRepo{tx: tx},
    }, nil
}

func (uow *UnitOfWork) Commit() error   { return uow.tx.Commit() }
func (uow *UnitOfWork) Rollback() error { return uow.tx.Rollback() }

func Transfer(db *sql.DB, fromID, toID string, amount int) error {
    uow, err := NewUnitOfWork(db)
    if err != nil {
        return err
    }
    defer uow.Rollback()

    from, err := uow.Accounts.FindByID(fromID)
    if err != nil {
        return err
    }
    to, err := uow.Accounts.FindByID(toID)
    if err != nil {
        return err
    }

    from.Debit(amount)
    to.Credit(amount)

    if err := uow.Accounts.Save(from); err != nil {
        return err
    }
    if err := uow.Accounts.Save(to); err != nil {
        return err
    }
    if err := uow.Ledger.Record(fromID, toID, amount); err != nil {
        return err
    }

    return uow.Commit()
}
```

---

## Repository + Unit of Work Together

```
HOW THEY WORK TOGETHER

  ┌────────────────────────────────────────┐
  │  Unit of Work                          │
  │                                        │
  │  ┌─────────────┐  ┌─────────────┐    │
  │  │ OrderRepo   │  │ PaymentRepo │    │
  │  │ (same txn)  │  │ (same txn)  │    │
  │  └──────┬──────┘  └──────┬──────┘    │
  │         │                │            │
  │         └────────┬───────┘            │
  │                  │                    │
  │           ┌──────┴──────┐             │
  │           │ Transaction │             │
  │           │ (shared)    │             │
  │           └─────────────┘             │
  │                                        │
  │  commit() → all repos save together   │
  │  rollback() → all repos undo together │
  └────────────────────────────────────────┘
```

---

## Exercises

1. **Build a repository**: Create an `OrderRepository` interface
   and two implementations: PostgreSQL and in-memory. Use the
   in-memory one in tests.

2. **Unit of Work**: Implement a bank transfer that debits one
   account and credits another within a single transaction. Verify
   that a failure in the credit step rolls back the debit.

3. **Repository queries**: Add finder methods to your repository:
   `findByDateRange`, `findByPriceAbove`, `findRecentlyCreated`.
   Implement them in both the Postgres and in-memory versions.

4. **No leaking**: Review your repository implementations. Ensure
   no SQL or database types leak into the domain layer.

---

[← Previous: DDD Basics](./15-ddd-basics.md) · [Next: Lesson 17 — Anti-Patterns →](./17-anti-patterns.md)
