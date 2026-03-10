# Quick Reference: SOLID Principles

> Five principles for writing code that's easy to change, easy to
> test, and hard to break. Memorize these — they come up in every
> code review, every interview, and every architecture discussion.

---

## At a Glance

```
SOLID AT A GLANCE

  S — Single Responsibility    Each class has ONE reason to change
  O — Open/Closed              Open for extension, closed for modification
  L — Liskov Substitution      Subtypes must work wherever the parent works
  I — Interface Segregation    Many small interfaces beat one big interface
  D — Dependency Inversion     Depend on abstractions, not concrete details
```

---

## S — Single Responsibility Principle

**One class, one reason to change.**

If your class handles both user validation AND email sending, a
change to email templates risks breaking validation logic.

```typescript
// BAD: two responsibilities
class UserManager {
  validateEmail(email: string): boolean { return email.includes("@"); }
  saveToDatabase(user: User): void { db.insert(user); }
  sendWelcomeEmail(user: User): void { smtp.send(user.email, "Welcome!"); }
}

// GOOD: separated
class EmailValidator {
  isValid(email: string): boolean { return email.includes("@"); }
}
class UserRepository {
  save(user: User): void { db.insert(user); }
}
class WelcomeMailer {
  send(user: User): void { smtp.send(user.email, "Welcome!"); }
}
```

```python
# BAD
class Report:
    def calculate(self, data): ...
    def format_pdf(self, data): ...
    def send_email(self, data): ...

# GOOD
class ReportCalculator:
    def calculate(self, data): ...

class PdfFormatter:
    def format(self, report): ...

class ReportMailer:
    def send(self, report): ...
```

```go
// BAD
type OrderService struct{}
func (s *OrderService) ValidateOrder(o *Order) error { ... }
func (s *OrderService) SaveOrder(o *Order) error { ... }
func (s *OrderService) SendInvoice(o *Order) error { ... }
func (s *OrderService) UpdateInventory(o *Order) error { ... }

// GOOD
type OrderValidator struct{}
func (v *OrderValidator) Validate(o *Order) error { ... }

type OrderStore struct{ db *sql.DB }
func (s *OrderStore) Save(o *Order) error { ... }

type InvoiceSender struct{ mailer Mailer }
func (s *InvoiceSender) Send(o *Order) error { ... }
```

---

## O — Open/Closed Principle

**Add new behavior by writing new code, not editing old code.**

```typescript
// BAD: must edit this function for every new shape
function area(shape: { type: string; width?: number; height?: number; radius?: number }): number {
  if (shape.type === "rectangle") return shape.width! * shape.height!;
  if (shape.type === "circle") return Math.PI * shape.radius! ** 2;
  throw new Error("Unknown shape");
}

// GOOD: add new shapes without touching existing code
interface Shape {
  area(): number;
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  area(): number { return this.width * this.height; }
}

class Circle implements Shape {
  constructor(private radius: number) {}
  area(): number { return Math.PI * this.radius ** 2; }
}

class Triangle implements Shape {
  constructor(private base: number, private height: number) {}
  area(): number { return (this.base * this.height) / 2; }
}
```

```rust
// GOOD: trait-based OCP in Rust
trait Exporter {
    fn export(&self, data: &[u8]) -> Result<Vec<u8>, ExportError>;
}

struct JsonExporter;
impl Exporter for JsonExporter {
    fn export(&self, data: &[u8]) -> Result<Vec<u8>, ExportError> { ... }
}

struct CsvExporter;
impl Exporter for CsvExporter {
    fn export(&self, data: &[u8]) -> Result<Vec<u8>, ExportError> { ... }
}

// Adding XmlExporter doesn't change JsonExporter or CsvExporter
```

---

## L — Liskov Substitution Principle

**Any subtype must be usable wherever the parent type is expected,
with no surprises.**

```typescript
// BAD: Square breaks Rectangle's contract
class Rectangle {
  setWidth(w: number): void { this.width = w; }
  setHeight(h: number): void { this.height = h; }
  area(): number { return this.width * this.height; }
}

class Square extends Rectangle {
  setWidth(w: number): void { this.width = w; this.height = w; } // surprise!
  setHeight(h: number): void { this.width = h; this.height = h; } // surprise!
}

// Code that works with Rectangle BREAKS with Square:
function test(rect: Rectangle) {
  rect.setWidth(5);
  rect.setHeight(10);
  assert(rect.area() === 50); // fails for Square!
}

// GOOD: separate types, shared interface
interface Shape {
  area(): number;
}

class Rectangle implements Shape {
  constructor(readonly width: number, readonly height: number) {}
  area(): number { return this.width * this.height; }
}

class Square implements Shape {
  constructor(readonly side: number) {}
  area(): number { return this.side * this.side; }
}
```

```python
# LSP Checklist:
# Subtypes must:
# - Accept same (or broader) inputs
# - Return same (or narrower) outputs
# - Not throw new/unexpected exceptions
# - Maintain parent's invariants

# BAD
class Bird:
    def fly(self) -> None: ...

class Penguin(Bird):
    def fly(self) -> None:
        raise NotImplementedError("Penguins can't fly")  # LSP violation!

# GOOD
class Bird:
    def move(self) -> None: ...

class Sparrow(Bird):
    def move(self) -> None: ...  # flies

class Penguin(Bird):
    def move(self) -> None: ...  # waddles
```

---

## I — Interface Segregation Principle

**Don't force clients to implement methods they don't need.**

```typescript
// BAD: one fat interface
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
  attendMeeting(): void;
  writeReport(): void;
}

// A robot can work but doesn't eat or sleep
class Robot implements Worker {
  work(): void { /* ok */ }
  eat(): void { throw new Error("Robots don't eat"); } // forced!
  sleep(): void { throw new Error("Robots don't sleep"); } // forced!
  attendMeeting(): void { /* ok */ }
  writeReport(): void { /* ok */ }
}

// GOOD: small, focused interfaces
interface Workable {
  work(): void;
}
interface Feedable {
  eat(): void;
}
interface Reportable {
  writeReport(): void;
}

class Robot implements Workable, Reportable {
  work(): void { /* ok */ }
  writeReport(): void { /* ok */ }
}

class Human implements Workable, Feedable, Reportable {
  work(): void { /* ok */ }
  eat(): void { /* ok */ }
  writeReport(): void { /* ok */ }
}
```

```go
// Go naturally encourages ISP with small interfaces

// BAD
type DataStore interface {
    Read(key string) ([]byte, error)
    Write(key string, data []byte) error
    Delete(key string) error
    List(prefix string) ([]string, error)
    Watch(key string) <-chan Event
    Backup() error
}

// GOOD
type Reader interface {
    Read(key string) ([]byte, error)
}

type Writer interface {
    Write(key string, data []byte) error
}

type ReadWriter interface {
    Reader
    Writer
}

// Functions take only what they need
func processData(store Reader) error {
    data, err := store.Read("key")
    // ...
}
```

---

## D — Dependency Inversion Principle

**High-level code depends on abstractions. Low-level code implements
those abstractions.**

```typescript
// BAD: high-level depends on low-level
class NotificationService {
  private gmail = new GmailClient();     // concrete dependency
  private twilio = new TwilioClient();   // concrete dependency

  notify(user: User, message: string): void {
    this.gmail.send(user.email, message);
    this.twilio.sms(user.phone, message);
  }
}

// GOOD: depends on abstractions
interface MessageChannel {
  send(recipient: string, message: string): Promise<void>;
}

class NotificationService {
  constructor(private channels: MessageChannel[]) {}

  async notify(user: User, message: string): Promise<void> {
    for (const channel of this.channels) {
      await channel.send(user.id, message);
    }
  }
}

// Concrete implementations
class EmailChannel implements MessageChannel {
  async send(recipient: string, message: string): Promise<void> { ... }
}
class SmsChannel implements MessageChannel {
  async send(recipient: string, message: string): Promise<void> { ... }
}
class SlackChannel implements MessageChannel {
  async send(recipient: string, message: string): Promise<void> { ... }
}

// Wire in the composition root
const service = new NotificationService([
  new EmailChannel(gmailConfig),
  new SmsChannel(twilioConfig),
]);
```

```rust
// Rust: compile-time DI with generics
trait Logger {
    fn log(&self, message: &str);
}

struct App<L: Logger> {
    logger: L,
}

impl<L: Logger> App<L> {
    fn run(&self) {
        self.logger.log("App started");
    }
}

// Production
let app = App { logger: FileLogger::new("/var/log/app.log") };

// Tests
let app = App { logger: TestLogger::new() };
```

---

## SOLID Violations Cheat Sheet

```
IF YOU SEE THIS...             IT PROBABLY VIOLATES...   FIX WITH...
────────────────────────────   ───────────────────────   ──────────────────
Class has 10+ methods across   SRP                       Split into focused
unrelated areas                                          classes

Long if/else or switch to      OCP                       Strategy pattern
pick behavior                                            or polymorphism

Subclass throws "not           LSP                       Rethink the
implemented" or changes                                  hierarchy; use
parent's behavior                                        composition

Interface with 8+ methods,     ISP                       Split into smaller
some implementations leave                               interfaces
methods empty

Class creates its own          DIP                       Constructor
database/API client                                      injection
internally
```

---

## Memory Aid

```
S.O.L.I.D. MEMORY AID

  S — "One job per class"
  O — "New code extends, old code stays shut"
  L — "Kids must honor parents' promises"
  I — "Don't make me sign a contract for things I'll never do"
  D — "Talk to the interface, not the implementation"
```

---

[← Reference: All Patterns](./reference-patterns.md) · [Back to Roadmap](./00-roadmap.md)
