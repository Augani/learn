# Lesson 15: Domain-Driven Design Basics

> **The one thing to remember**: Domain-Driven Design (DDD) is about
> making your code speak the same language as the business. If the
> business says "a customer places an order," your code should have
> a `Customer` that `placesOrder()` — not a `UserEntity` that calls
> `insertOrderRecord()`. When code mirrors the real world, everyone
> can understand it, and bugs become obvious.

---

## The Translation Problem

Imagine you're building software for a hospital. The doctors say
"patient," "diagnosis," "prescription." But the developers write
code with `UserRecord`, `StatusCode`, `ItemList`. Every
conversation requires translation:

```
WITHOUT DDD (translation required)

  Doctor:    "The patient needs a prescription for the diagnosis"
  Developer: "So... UserRecord gets an ItemList linked to StatusCode?"
  Doctor:    "What? No. A PATIENT gets a PRESCRIPTION for a DIAGNOSIS."
  Developer: "That's what I said."
  Doctor:    "No it's not."

WITH DDD (shared language)

  Doctor:    "The patient needs a prescription for the diagnosis"
  Developer: "Got it. Patient.prescribe(diagnosis) creates a Prescription."
  Doctor:    "Yes. Exactly."
```

---

## Ubiquitous Language

The first and most important idea in DDD: create a **ubiquitous
language** — a shared vocabulary used by developers AND domain
experts (the people who know the business).

This language appears everywhere: in conversations, in
documentation, in code, in database tables, in API endpoints.

```
UBIQUITOUS LANGUAGE EXAMPLES

  E-COMMERCE:
    Business says: "Customer places an Order with Line Items"
    Code has:       Customer, Order, LineItem, placeOrder()

  BANKING:
    Business says: "Account holder transfers funds between Accounts"
    Code has:       Account, AccountHolder, Transfer, transferFunds()

  HEALTHCARE:
    Business says: "Doctor prescribes Medication for a Diagnosis"
    Code has:       Doctor, Medication, Diagnosis, prescribe()

  NOT UBIQUITOUS (bad):
    Business says: "Customer places an Order"
    Code has:       User.createRecord(data)  ← generic, no domain meaning
```

---

## Bounded Contexts

A "customer" means different things to different departments:

- **Sales**: a lead with a name, phone, and deal stage
- **Shipping**: a delivery address with tracking preferences
- **Billing**: a payment method with credit history
- **Support**: a ticket history with satisfaction score

Trying to make ONE `Customer` class that serves all four is a
recipe for a bloated mess. DDD says: each department gets its own
**bounded context** with its own model of "customer."

```
BOUNDED CONTEXTS

  ┌──────────────────┐  ┌──────────────────┐
  │  SALES CONTEXT   │  │ SHIPPING CONTEXT  │
  │                  │  │                   │
  │  Customer:       │  │  Customer:        │
  │    name           │  │    address        │
  │    phone          │  │    deliveryNotes  │
  │    dealStage      │  │    preferredTime  │
  │    leadScore      │  │                   │
  └──────────────────┘  └───────────────────┘

  ┌──────────────────┐  ┌──────────────────┐
  │ BILLING CONTEXT  │  │ SUPPORT CONTEXT   │
  │                  │  │                   │
  │  Customer:       │  │  Customer:        │
  │    paymentMethod  │  │    ticketHistory  │
  │    creditLimit    │  │    satisfaction   │
  │    invoiceHistory │  │    priority       │
  └──────────────────┘  └───────────────────┘

  Same word "Customer," DIFFERENT models in each context.
  This is CORRECT. Don't force one model to rule them all.
```

Bounded contexts communicate through well-defined interfaces (APIs,
events, messages) — not by sharing database tables or classes.

---

## Entities vs Value Objects

DDD distinguishes between two types of domain objects:

### Entities (Identity Matters)

An entity has a unique identity that persists over time. Two
entities with the same data but different IDs are different objects.

A person is an entity — you're still you even if you change your
name, address, or hair color. Your identity persists.

```typescript
class Patient {
  constructor(
    readonly id: string,
    private name: string,
    private dateOfBirth: Date,
    private allergies: string[]
  ) {}

  rename(newName: string): void {
    this.name = newName;
  }

  addAllergy(allergy: string): void {
    if (!this.allergies.includes(allergy)) {
      this.allergies.push(allergy);
    }
  }

  equals(other: Patient): boolean {
    return this.id === other.id;
  }
}
```

### Value Objects (Values Matter)

A value object has no identity — it's defined entirely by its
attributes. Two value objects with the same data are equal.

Money is a value object. A five-dollar bill is a five-dollar bill,
no matter which specific bill it is. You care about the value, not
the identity.

```typescript
class Money {
  constructor(
    readonly amount: number,
    readonly currency: string
  ) {
    Object.freeze(this);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error("Currency mismatch");
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}

class Address {
  constructor(
    readonly street: string,
    readonly city: string,
    readonly state: string,
    readonly zip: string
  ) {
    Object.freeze(this);
  }

  equals(other: Address): boolean {
    return (
      this.street === other.street &&
      this.city === other.city &&
      this.state === other.state &&
      this.zip === other.zip
    );
  }
}
```

```
ENTITY vs VALUE OBJECT

  ENTITY                           VALUE OBJECT
  ─────────────────────────────    ─────────────────────────────
  Has unique ID                    No ID needed

  Identity-based equality          Attribute-based equality
  (same ID = same entity)         (same values = same object)

  Mutable (changes over time)      Immutable (create new instead)

  Examples:                        Examples:
    User, Order, Account             Money, Address, DateRange
    Product, Patient, Employee       Color, Coordinates, Email
```

### Value Objects in Python

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class DateRange:
    start: date
    end: date

    def __post_init__(self):
        if self.start > self.end:
            raise ValueError("Start must be before end")

    def overlaps(self, other: "DateRange") -> bool:
        return self.start <= other.end and other.start <= self.end

    def duration_days(self) -> int:
        return (self.end - self.start).days
```

### Value Objects in Rust

Rust's ownership model makes value objects natural:

```rust
#[derive(Debug, Clone, PartialEq)]
struct EmailAddress {
    value: String,
}

impl EmailAddress {
    fn new(email: &str) -> Result<Self, ValidationError> {
        if !email.contains('@') || email.len() < 3 {
            return Err(ValidationError::InvalidEmail);
        }
        Ok(Self { value: email.to_lowercase() })
    }

    fn domain(&self) -> &str {
        self.value.split('@').nth(1).unwrap_or("")
    }
}
```

---

## Aggregates

An aggregate is a cluster of entities and value objects treated as
a single unit. One entity is the **aggregate root** — the gateway
for all changes.

### The Shopping Cart Example

A shopping cart contains items. You don't modify items directly —
you go through the cart. The cart is the aggregate root. It enforces
rules like "max 100 items" or "can't add out-of-stock products."

```
AGGREGATE: ORDER

  ┌────────────────────────────────────────┐
  │  Order (aggregate root)                │
  │                                        │
  │  id: "ord-123"                         │
  │  status: "pending"                     │
  │                                        │
  │  ┌──────────────┐ ┌──────────────┐    │
  │  │  LineItem     │ │  LineItem     │   │
  │  │  product: ABC │ │  product: XYZ │   │
  │  │  qty: 2       │ │  qty: 1       │   │
  │  └──────────────┘ └──────────────┘    │
  │                                        │
  │  ┌──────────────┐                     │
  │  │ ShippingAddr │  (value object)     │
  │  │ 123 Main St  │                     │
  │  └──────────────┘                     │
  └────────────────────────────────────────┘

  Rules:
  - All changes go through Order (the root)
  - No direct access to LineItems from outside
  - Order enforces business rules (max items, valid transitions)
  - The whole aggregate is saved/loaded as a unit
```

### Aggregate in TypeScript

```typescript
class Order {
  private items: OrderItem[] = [];
  private status: OrderStatus = "draft";

  constructor(
    readonly id: string,
    readonly customerId: string
  ) {}

  addItem(productId: string, price: Money, quantity: number): void {
    if (this.status !== "draft") {
      throw new Error("Cannot modify a non-draft order");
    }
    if (this.items.length >= 50) {
      throw new Error("Order cannot have more than 50 items");
    }

    const existing = this.items.find((i) => i.productId === productId);
    if (existing) {
      existing.increaseQuantity(quantity);
    } else {
      this.items.push(new OrderItem(productId, price, quantity));
    }
  }

  removeItem(productId: string): void {
    if (this.status !== "draft") {
      throw new Error("Cannot modify a non-draft order");
    }
    this.items = this.items.filter((i) => i.productId !== productId);
  }

  submit(): void {
    if (this.items.length === 0) {
      throw new Error("Cannot submit empty order");
    }
    this.status = "submitted";
  }

  total(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.subtotal()),
      new Money(0, "USD")
    );
  }
}
```

### Aggregate in Go

```go
type Order struct {
    id         string
    customerID string
    items      []OrderItem
    status     string
}

func NewOrder(id, customerID string) *Order {
    return &Order{id: id, customerID: customerID, status: "draft"}
}

func (o *Order) AddItem(productID string, price int, qty int) error {
    if o.status != "draft" {
        return fmt.Errorf("cannot modify non-draft order")
    }
    if len(o.items) >= 50 {
        return fmt.Errorf("max 50 items per order")
    }
    o.items = append(o.items, OrderItem{
        ProductID: productID,
        Price:     price,
        Quantity:  qty,
    })
    return nil
}

func (o *Order) Submit() error {
    if len(o.items) == 0 {
        return fmt.Errorf("cannot submit empty order")
    }
    o.status = "submitted"
    return nil
}
```

---

## Putting It All Together

```
DDD BUILDING BLOCKS

  ┌─────────────────────────────────────────────────┐
  │  BOUNDED CONTEXT: Order Management              │
  │                                                  │
  │  Ubiquitous Language:                            │
  │    Customer places Order                         │
  │    Order contains LineItems                      │
  │    Order has ShippingAddress                     │
  │    Customer submits Order for fulfillment        │
  │                                                  │
  │  Aggregates:                                     │
  │    Order (root) → LineItem, ShippingAddress      │
  │    Customer (root) → ContactInfo                 │
  │                                                  │
  │  Value Objects: Money, Address, Email            │
  │  Entities: Order, Customer, LineItem             │
  │                                                  │
  │  Domain Events:                                  │
  │    OrderPlaced, OrderShipped, OrderCancelled     │
  └─────────────────────────────────────────────────┘
```

---

## When to Use DDD

DDD adds complexity. It's worth it when:

- The business domain is complex (finance, healthcare, logistics)
- Domain experts are available to collaborate with
- The project will be maintained for years
- Incorrect business logic is expensive (money, health, safety)

It's NOT worth it for:
- Simple CRUD applications
- Short-lived projects
- Domains you already fully understand
- Prototypes or MVPs

---

## Exercises

1. **Ubiquitous language**: Pick a domain you know (e-commerce,
   banking, social media). List 10 terms that both business people
   and developers should use consistently.

2. **Bounded contexts**: For an e-commerce system, identify at least
   four bounded contexts. What does "Product" mean in each?

3. **Entity vs value object**: Classify these as entity or value
   object: Email address, Bank Account, GPS coordinates, User,
   Invoice, Color, Flight Booking.

4. **Build an aggregate**: Model a BankAccount aggregate with
   deposit, withdraw, and transfer operations. Enforce business
   rules (no overdraft, maximum daily withdrawal).

---

[← Previous: Hexagonal Architecture](./14-hexagonal-architecture.md) · [Next: Lesson 16 — Repository and Unit of Work →](./16-repository-uow.md)
