# Lesson 02: SOLID — Single Responsibility and Open/Closed Principle

> **The one thing to remember**: Each piece of code should have one
> reason to change (SRP), and you should be able to add new behavior
> without modifying existing code (OCP). These two principles alone
> eliminate most of the "spaghetti" in real-world codebases.

---

## What Is SOLID?

SOLID is an acronym for five design principles coined by Robert C.
Martin. They guide you toward code that's easy to change, easy to
test, and hard to break accidentally.

```
S.O.L.I.D.

  S — Single Responsibility Principle    (this lesson)
  O — Open/Closed Principle              (this lesson)
  L — Liskov Substitution Principle      (next lesson)
  I — Interface Segregation Principle    (next lesson)
  D — Dependency Inversion Principle     (next lesson)
```

We'll cover S and O here, and L, I, D in the next lesson.

---

## Single Responsibility Principle (SRP)

### The Restaurant Analogy

Imagine a restaurant where one person takes orders, cooks the food,
serves the tables, washes dishes, AND handles billing. If you need
to change the menu, you have to retrain the same person who's also
handling payment. If they get sick, everything stops.

Now imagine a restaurant with separate roles: a server takes orders,
a chef cooks, a cashier handles billing. Changing the menu only
affects the chef. Changing the payment system only affects the
cashier. Each person has one job.

```
BAD: ONE PERSON DOES EVERYTHING

  +----------------------------------+
  |         SuperEmployee            |
  |                                  |
  |  takeOrder()                     |
  |  cookFood()                      |
  |  serveTable()                    |
  |  washDishes()                    |
  |  processPayment()               |
  |  generateReport()               |
  +----------------------------------+
  Change the menu? Modify this.
  Change payment? Modify this.
  Change reports? Modify this.
  → Everything breaks together.

GOOD: SEPARATE RESPONSIBILITIES

  +-------------+  +----------+  +-----------+
  |   Server    |  |   Chef   |  |  Cashier  |
  |             |  |          |  |           |
  | takeOrder() |  | cook()   |  | charge()  |
  | serve()     |  | plate()  |  | receipt() |
  +-------------+  +----------+  +-----------+
  Change the menu? Only Chef changes.
  Change payment? Only Cashier changes.
  → Isolated changes. Nothing else breaks.
```

### The Principle

**A class (or module, or function) should have one, and only one,
reason to change.**

"Reason to change" means one stakeholder, one area of business
logic, or one axis of functionality. If a class handles both user
authentication AND email formatting, those are two different reasons
to change — and they should be in two different places.

### Before: Violating SRP

```typescript
class UserService {
  createUser(name: string, email: string): User {
    if (!email.includes("@")) {
      throw new Error("Invalid email");
    }

    const user = { id: generateId(), name, email };

    const db = new Database();
    db.insert("users", user);

    const subject = "Welcome!";
    const body = `Hi ${name}, welcome aboard.`;
    const smtpClient = new SmtpClient();
    smtpClient.send(email, subject, body);

    console.log(`User created: ${name}`);

    return user;
  }
}
```

This one method does five things: validates, creates, saves, emails,
and logs. If the email provider changes, you're modifying the same
class that handles database logic.

### After: Applying SRP

```typescript
class EmailValidator {
  isValid(email: string): boolean {
    return email.includes("@");
  }
}

class UserRepository {
  constructor(private db: Database) {}

  save(user: User): void {
    this.db.insert("users", user);
  }
}

class WelcomeMailer {
  constructor(private smtp: SmtpClient) {}

  sendWelcome(user: User): void {
    this.smtp.send(user.email, "Welcome!", `Hi ${user.name}`);
  }
}

class UserService {
  constructor(
    private validator: EmailValidator,
    private repo: UserRepository,
    private mailer: WelcomeMailer
  ) {}

  createUser(name: string, email: string): User {
    if (!this.validator.isValid(email)) {
      throw new Error("Invalid email");
    }

    const user = { id: generateId(), name, email };
    this.repo.save(user);
    this.mailer.sendWelcome(user);
    return user;
  }
}
```

Now each class has one job. Changing email logic doesn't touch
database code. You can test each piece in isolation.

### SRP in Python

```python
class InvoiceCalculator:
    def calculate_total(self, items: list[LineItem]) -> Decimal:
        return sum(item.price * item.quantity for item in items)

class InvoiceFormatter:
    def to_pdf(self, invoice: Invoice) -> bytes:
        ...

class InvoiceRepository:
    def save(self, invoice: Invoice) -> None:
        ...
```

### SRP in Rust

```rust
struct PriceCalculator;

impl PriceCalculator {
    fn total(items: &[LineItem]) -> Decimal {
        items.iter().map(|i| i.price * i.quantity).sum()
    }
}

struct InvoiceStore {
    db: Database,
}

impl InvoiceStore {
    fn save(&self, invoice: &Invoice) -> Result<(), DbError> {
        self.db.insert(invoice)
    }
}
```

### SRP in Go

```go
type PriceCalculator struct{}

func (p PriceCalculator) Total(items []LineItem) float64 {
    total := 0.0
    for _, item := range items {
        total += item.Price * float64(item.Quantity)
    }
    return total
}

type InvoiceStore struct {
    db *Database
}

func (s *InvoiceStore) Save(inv *Invoice) error {
    return s.db.Insert(inv)
}
```

---

## Open/Closed Principle (OCP)

### The Power Strip Analogy

A power strip is **open** for extension (plug in new devices) but
**closed** for modification (you don't rewire the strip to add a
device). You extend what it can power by plugging things in, not
by opening it up with a screwdriver.

Software should work the same way: add new behavior by writing
new code, not by editing existing code.

```
POWER STRIP DESIGN

  +─────────────────────────────────────+
  |  Power Strip (closed for changes)   |
  |                                     |
  |  [outlet] [outlet] [outlet] [outlet]|
  +─────────────────────────────────────+
      │          │         │
      ▼          ▼         ▼
    Lamp     Laptop     Phone       ← plug in new devices
                                       without modifying the strip
```

### The Problem OCP Solves

Without OCP, adding a new feature means editing existing code.
Every edit to existing code risks breaking things that already work.

```
WITHOUT OCP (modifying existing code)

  Version 1: supports PDF export
  Version 2: edit code to add CSV export  → might break PDF
  Version 3: edit code to add XML export  → might break PDF or CSV
  Version 4: edit code to add JSON export → might break anything

WITH OCP (extending with new code)

  Core: export interface
  Plugin: PDFExporter   (new file, never changes)
  Plugin: CSVExporter   (new file, never changes)
  Plugin: XMLExporter   (new file, never changes)
  Plugin: JSONExporter  (new file, never changes)
  → Adding JSON can't break PDF. They don't touch each other.
```

### Before: Violating OCP

```typescript
class PaymentProcessor {
  process(payment: Payment): void {
    if (payment.type === "credit_card") {
      this.chargeCreditCard(payment);
    } else if (payment.type === "paypal") {
      this.chargePayPal(payment);
    } else if (payment.type === "crypto") {
      this.chargeCrypto(payment);
    }
  }
}
```

Every new payment method means editing this class. The if/else chain
grows. You risk breaking existing payment methods.

### After: Applying OCP

```typescript
interface PaymentMethod {
  charge(amount: number): Promise<Receipt>;
}

class CreditCardPayment implements PaymentMethod {
  async charge(amount: number): Promise<Receipt> {
    return stripe.charge(amount);
  }
}

class PayPalPayment implements PaymentMethod {
  async charge(amount: number): Promise<Receipt> {
    return paypal.execute(amount);
  }
}

class CryptoPayment implements PaymentMethod {
  async charge(amount: number): Promise<Receipt> {
    return crypto.transfer(amount);
  }
}

class PaymentProcessor {
  async process(method: PaymentMethod, amount: number): Promise<Receipt> {
    return method.charge(amount);
  }
}
```

Adding a new payment type means creating a new class. The processor
never changes.

### OCP in Python

```python
from abc import ABC, abstractmethod

class Notifier(ABC):
    @abstractmethod
    def send(self, message: str) -> None: ...

class EmailNotifier(Notifier):
    def send(self, message: str) -> None:
        smtp_client.send(message)

class SlackNotifier(Notifier):
    def send(self, message: str) -> None:
        slack_api.post(message)

class NotificationService:
    def __init__(self, notifiers: list[Notifier]):
        self._notifiers = notifiers

    def notify_all(self, message: str) -> None:
        for notifier in self._notifiers:
            notifier.send(message)
```

### OCP in Rust

```rust
trait Exporter {
    fn export(&self, data: &Report) -> Result<Vec<u8>, ExportError>;
}

struct PdfExporter;
impl Exporter for PdfExporter {
    fn export(&self, data: &Report) -> Result<Vec<u8>, ExportError> {
        // PDF generation logic
        Ok(pdf_bytes)
    }
}

struct CsvExporter;
impl Exporter for CsvExporter {
    fn export(&self, data: &Report) -> Result<Vec<u8>, ExportError> {
        // CSV generation logic
        Ok(csv_bytes)
    }
}

fn generate_report(exporter: &dyn Exporter, report: &Report) -> Result<Vec<u8>, ExportError> {
    exporter.export(report)
}
```

### OCP in Go

```go
type Exporter interface {
    Export(data *Report) ([]byte, error)
}

type PDFExporter struct{}
func (e PDFExporter) Export(data *Report) ([]byte, error) {
    // PDF logic
    return pdfBytes, nil
}

type CSVExporter struct{}
func (e CSVExporter) Export(data *Report) ([]byte, error) {
    // CSV logic
    return csvBytes, nil
}

func GenerateReport(exporter Exporter, data *Report) ([]byte, error) {
    return exporter.Export(data)
}
```

---

## SRP and OCP Work Together

```
HOW SRP + OCP COMBINE

  SRP says: each class has one job
  OCP says: add new behavior by adding new classes, not editing old ones

  Together they create a system where:

  +──────────────────────────────────────────────+
  |  Each box is small (SRP)                     |
  |  New boxes plug in without changing old ones  |
  |  (OCP)                                       |
  +──────────────────────────────────────────────+

  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Module A │  │ Module B │  │ Module C │
  │ (1 job)  │  │ (1 job)  │  │ (1 job)  │
  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │              │              │
       └──────────────┼──────────────┘
                      │
               ┌──────┴──────┐
               │  Interface  │ ← defined once, never changes
               └─────────────┘
                      │
               ┌──────┴──────┐
               │  New Module │ ← add this to extend behavior
               │  (1 job)    │
               └─────────────┘
```

---

## Common Mistakes

1. **SRP taken too far**: splitting code into 50 tiny classes with
   one method each. SRP means "one reason to change," not "one
   method per class."

2. **OCP taken too far**: making everything abstract and pluggable
   when you only ever have one implementation. If you only have one
   payment method, you don't need a PaymentMethod interface yet.

3. **Confusing SRP with "do one thing"**: a `UserService` that
   orchestrates validation, saving, and emailing is fine — it has
   one responsibility (coordinating user creation). The key is that
   it delegates the actual work to other classes.

---

## Exercises

1. **Spot the violation**: Find a class in a project you've worked
   on that has more than one reason to change. Sketch how you'd
   split it.

2. **Refactor for OCP**: Take the `if/else` or `switch` statement
   pattern and refactor it to use an interface. Write the interface
   and two implementations.

3. **Know when to stop**: Think of a class in your code that follows
   SRP. Would splitting it further help or hurt readability?

4. **Multi-language practice**: Pick one of the examples above and
   implement it in a language you're learning. Make sure you can
   add a new variant without editing the core code.

---

[← Previous: Why Design Patterns](./01-why-patterns.md) · [Next: Lesson 03 — SOLID: LSP, ISP, DIP →](./03-solid-lsp-isp-dip.md)
