# Lesson 03: SOLID — Liskov Substitution, Interface Segregation, Dependency Inversion

> **The one thing to remember**: Subtypes must be usable wherever their
> parent types are expected without surprises (LSP). Interfaces should
> be small and focused (ISP). High-level code should depend on
> abstractions, not concrete details (DIP). Together, these three
> principles keep your code flexible and trustworthy.

---

## Liskov Substitution Principle (LSP)

### The Rental Car Analogy

You rent a car. The rental company promises "a sedan." Whether they
give you a Toyota Camry or a Honda Accord doesn't matter — you can
drive either one the same way. Same steering wheel, same pedals,
same gear shift.

But if they gave you a "sedan" that had the brake pedal wired to the
horn? That **violates the contract**. It looks like a sedan, but it
doesn't behave like one. You'd crash.

LSP says: **if your code expects a type T, then any subtype of T
must work correctly in its place**. No surprises, no broken
contracts.

### The Classic Violation: Square and Rectangle

This is the most famous LSP example. It seems logical that a Square
is a Rectangle (it is, geometrically). But in code, it breaks:

```
THE RECTANGLE-SQUARE PROBLEM

  Rectangle: has independent width and height
  Square: width and height must always be equal

  If code does this:
    rect.setWidth(5)
    rect.setHeight(10)
    assert rect.area() == 50    ← works for Rectangle

  But with a Square:
    square.setWidth(5)     ← also sets height to 5
    square.setHeight(10)   ← also sets width to 10
    assert square.area() == 50  ← FAILS! Area is 100.

  The Square LOOKS like a Rectangle but BEHAVES differently.
  Code that works with Rectangles breaks with Squares.
```

### Fixing LSP Violations

The fix is usually to rethink the hierarchy. Instead of Square
extending Rectangle, make them siblings:

```typescript
interface Shape {
  area(): number;
}

class Rectangle implements Shape {
  constructor(
    private width: number,
    private height: number
  ) {}

  area(): number {
    return this.width * this.height;
  }
}

class Square implements Shape {
  constructor(private side: number) {}

  area(): number {
    return this.side * this.side;
  }
}

function printArea(shape: Shape): void {
  console.log(shape.area());
}
```

Now `printArea` works with any Shape without surprises.

### LSP in Python — A Realistic Example

```python
from abc import ABC, abstractmethod

class Notification(ABC):
    @abstractmethod
    def send(self, recipient: str, message: str) -> bool:
        """Returns True if sent successfully."""
        ...

class EmailNotification(Notification):
    def send(self, recipient: str, message: str) -> bool:
        return smtp.deliver(recipient, message)

class SmsNotification(Notification):
    def send(self, recipient: str, message: str) -> bool:
        return sms_gateway.deliver(recipient, message)
```

Both return a `bool`. Neither throws unexpected exceptions. Code
that uses `Notification` works identically with either subtype.

A violation would be if `SmsNotification.send()` returned a string
instead of a bool, or raised a `NotImplementedError` for some
arguments that `EmailNotification` handles fine.

### LSP Rules of Thumb

```
LSP CHECKLIST

  A subtype must:
  ✓ Accept at least the same inputs as the parent
  ✓ Return the same type of output (or a more specific subtype)
  ✓ Not throw new exceptions the parent doesn't
  ✓ Maintain the same invariants (rules that are always true)
  ✓ Not strengthen preconditions (demand MORE from callers)
  ✓ Not weaken postconditions (promise LESS to callers)
```

### LSP in Rust

Rust enforces much of this through its trait system:

```rust
trait Cache {
    fn get(&self, key: &str) -> Option<String>;
    fn set(&mut self, key: &str, value: String);
}

struct MemoryCache {
    store: HashMap<String, String>,
}

impl Cache for MemoryCache {
    fn get(&self, key: &str) -> Option<String> {
        self.store.get(key).cloned()
    }

    fn set(&mut self, key: &str, value: String) {
        self.store.insert(key.to_string(), value);
    }
}

struct RedisCache {
    client: RedisClient,
}

impl Cache for RedisCache {
    fn get(&self, key: &str) -> Option<String> {
        self.client.get(key).ok()
    }

    fn set(&mut self, key: &str, value: String) {
        self.client.set(key, &value).ok();
    }
}

fn warm_up(cache: &mut dyn Cache) {
    cache.set("version", "1.0".to_string());
}
```

Both `MemoryCache` and `RedisCache` honor the `Cache` contract.
The function `warm_up` works with either one.

---

## Interface Segregation Principle (ISP)

### The Remote Control Analogy

Imagine a universal remote control with 200 buttons: TV, DVD,
sound system, projector, smart lights, curtains. You just want to
change the TV channel. Those 194 irrelevant buttons get in the way.

ISP says: **don't force clients to depend on methods they don't
use.** Give the TV viewer a simple TV remote, not the universal one.

```
BAD: ONE FAT INTERFACE

  +----------------------------------+
  |         MegaInterface            |
  |                                  |
  |  print()                         |
  |  scan()                          |
  |  fax()                           |
  |  staple()                        |
  |  copy()                          |
  |  emailScan()                     |
  +----------------------------------+

  A simple printer must implement fax()? staple()? emailScan()?
  That makes no sense.

GOOD: SMALL, FOCUSED INTERFACES

  +-----------+  +-----------+  +-----------+
  | Printable |  | Scannable |  | Faxable   |
  |           |  |           |  |           |
  | print()   |  | scan()    |  | fax()     |
  +-----------+  +-----------+  +-----------+

  A simple printer only implements Printable.
  A multifunction device implements all three.
```

### ISP in TypeScript

```typescript
interface Readable {
  read(id: string): Promise<Record<string, unknown>>;
}

interface Writable {
  write(id: string, data: Record<string, unknown>): Promise<void>;
}

interface Deletable {
  remove(id: string): Promise<void>;
}

class ReadOnlyCache implements Readable {
  async read(id: string): Promise<Record<string, unknown>> {
    return this.cache.get(id);
  }
}

class FullDatabase implements Readable, Writable, Deletable {
  async read(id: string): Promise<Record<string, unknown>> {
    return this.db.find(id);
  }
  async write(id: string, data: Record<string, unknown>): Promise<void> {
    await this.db.upsert(id, data);
  }
  async remove(id: string): Promise<void> {
    await this.db.delete(id);
  }
}
```

Code that only needs to read data takes a `Readable`. It doesn't
know or care about `write` or `remove`.

### ISP in Go

Go naturally encourages ISP because interfaces are implicitly
satisfied:

```go
type Reader interface {
    Read(id string) ([]byte, error)
}

type Writer interface {
    Write(id string, data []byte) error
}

type ReadWriter interface {
    Reader
    Writer
}

func generateReport(source Reader) ([]byte, error) {
    data, err := source.Read("report-data")
    if err != nil {
        return nil, err
    }
    return format(data), nil
}
```

The `generateReport` function only asks for `Reader`. It works with
anything that can read — a database, a file, an API client, a mock
in a test.

### ISP in Python

```python
from typing import Protocol

class Readable(Protocol):
    def read(self, key: str) -> bytes: ...

class Writable(Protocol):
    def write(self, key: str, data: bytes) -> None: ...

def backup(source: Readable, destination: Writable) -> None:
    data = source.read("all")
    destination.write("backup", data)
```

---

## Dependency Inversion Principle (DIP)

### The Electrical Outlet Analogy

Your lamp doesn't wire directly into the power plant. It plugs into
a standard outlet. The outlet is an abstraction — the lamp doesn't
know if power comes from solar panels, a coal plant, or a generator.
And the power company doesn't know if you're plugging in a lamp, a
TV, or a blender.

```
WITHOUT DIP (direct dependency)

  ┌──────────┐         ┌──────────┐
  │  Lamp    │────────→│ Coal     │
  │          │ depends  │ Plant    │
  │          │ on       │          │
  └──────────┘         └──────────┘

  To switch to solar, you must rewire the lamp.

WITH DIP (depend on abstraction)

  ┌──────────┐         ┌──────────┐
  │  Lamp    │────────→│ Outlet   │  ← abstraction (interface)
  │          │ depends  │ (120V AC)│
  └──────────┘ on      └──────────┘
                            ↑
                ┌───────────┼───────────┐
                │           │           │
          ┌──────────┐ ┌──────────┐ ┌──────────┐
          │ Coal     │ │ Solar    │ │ Wind     │
          │ Plant    │ │ Panel    │ │ Turbine  │
          └──────────┘ └──────────┘ └──────────┘

  To switch to solar, plug in a different source.
  The lamp never changes.
```

### The Principle

DIP has two rules:

1. **High-level modules should not depend on low-level modules.**
   Both should depend on abstractions.
2. **Abstractions should not depend on details.** Details should
   depend on abstractions.

"High-level" means business logic (calculating prices, processing
orders). "Low-level" means infrastructure (databases, file systems,
APIs).

### Before: Violating DIP

```typescript
class OrderService {
  private db = new PostgresDatabase();
  private mailer = new SendGridMailer();

  placeOrder(order: Order): void {
    this.db.save(order);
    this.mailer.sendConfirmation(order);
  }
}
```

`OrderService` (high-level) directly depends on `PostgresDatabase`
and `SendGridMailer` (low-level). To switch databases or email
providers, you must edit `OrderService`. To test it, you need a
real database and email server.

### After: Applying DIP

```typescript
interface OrderRepository {
  save(order: Order): Promise<void>;
}

interface OrderNotifier {
  sendConfirmation(order: Order): Promise<void>;
}

class OrderService {
  constructor(
    private repo: OrderRepository,
    private notifier: OrderNotifier
  ) {}

  async placeOrder(order: Order): Promise<void> {
    await this.repo.save(order);
    await this.notifier.sendConfirmation(order);
  }
}

class PostgresOrderRepo implements OrderRepository {
  async save(order: Order): Promise<void> { /* Postgres logic */ }
}

class SendGridNotifier implements OrderNotifier {
  async sendConfirmation(order: Order): Promise<void> { /* SendGrid logic */ }
}
```

Now `OrderService` depends on interfaces, not implementations. You
can swap databases, swap email providers, or pass in fakes for
testing — all without changing a single line in `OrderService`.

### DIP in Rust

```rust
trait OrderStore {
    fn save(&self, order: &Order) -> Result<(), StoreError>;
}

trait Notifier {
    fn confirm(&self, order: &Order) -> Result<(), NotifyError>;
}

struct OrderService<S: OrderStore, N: Notifier> {
    store: S,
    notifier: N,
}

impl<S: OrderStore, N: Notifier> OrderService<S, N> {
    fn place_order(&self, order: &Order) -> Result<(), ServiceError> {
        self.store.save(order)?;
        self.notifier.confirm(order)?;
        Ok(())
    }
}
```

### DIP in Go

```go
type OrderStore interface {
    Save(order *Order) error
}

type Notifier interface {
    Confirm(order *Order) error
}

type OrderService struct {
    store    OrderStore
    notifier Notifier
}

func (s *OrderService) PlaceOrder(order *Order) error {
    if err := s.store.Save(order); err != nil {
        return err
    }
    return s.notifier.Confirm(order)
}
```

---

## All Three Together

```
LSP + ISP + DIP WORKING TOGETHER

  HIGH LEVEL (business logic)
  ┌─────────────────────────────┐
  │  OrderService               │
  │  - depends on OrderStore    │ ← small interface (ISP)
  │  - depends on Notifier      │ ← abstraction, not detail (DIP)
  └─────────────┬───────────────┘
                │ uses
                ▼
  ┌─────────────────────────────┐
  │  OrderStore interface       │ ← any implementation works (LSP)
  │  - save(order)              │
  └─────────────────────────────┘
        ↑               ↑
        │               │
  ┌───────────┐   ┌───────────┐
  │ Postgres  │   │ InMemory  │   ← both honor the contract (LSP)
  │ Store     │   │ Store     │   ← interchangeable without surprises
  └───────────┘   └───────────┘

  LOW LEVEL (infrastructure)
```

---

## Exercises

1. **LSP check**: You have a `Bird` class with a `fly()` method.
   `Penguin extends Bird`. What's the LSP problem? How would you
   fix the hierarchy?

2. **ISP refactor**: You have an interface with 8 methods. Only 2
   of your 5 implementations use all 8. Split it into smaller
   interfaces.

3. **DIP practice**: Take a function that directly instantiates a
   database client. Refactor it to accept an interface instead.
   Write a mock implementation for testing.

4. **Spot violations**: In a codebase you know, find one violation
   of LSP, ISP, or DIP. Describe the fix (or implement it).

---

[← Previous: SRP and OCP](./02-solid-srp-ocp.md) · [Next: Lesson 04 — Factory and Builder →](./04-factory-builder.md)
