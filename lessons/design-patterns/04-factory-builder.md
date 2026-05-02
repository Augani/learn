# Lesson 04: Factory Method, Abstract Factory, and Builder

> **The one thing to remember**: When creating objects gets complicated
> — lots of parameters, conditional logic, or families of related
> objects — don't shove all that complexity into the constructor.
> Use a Factory to decide what to create, or a Builder to assemble
> it step by step.

---

## The Pizza Shop Analogy

Think about ordering pizza:

- **Factory**: You tell the counter "I want a pepperoni pizza." The
  kitchen decides HOW to make it — what dough, what sauce, what oven
  temperature. You just get a pizza back.

- **Builder**: You're at a build-your-own-pizza station. You pick
  the dough, then the sauce, then the cheese, then the toppings,
  one step at a time. You assemble it yourself.

```
FACTORY vs BUILDER

  FACTORY:  "Give me a pepperoni pizza"
            → Kitchen handles all the details
            → You get a complete pizza

  BUILDER:  Choose dough: thin crust
            Choose sauce: marinara
            Choose cheese: mozzarella
            Choose topping: pepperoni
            → Build!
            → You get a complete pizza

  Both give you a pizza. The difference is WHO controls the details.
```

---

## Factory Method

The Factory Method pattern defines an interface for creating objects
but lets subclasses (or functions) decide which class to instantiate.

### When You Need It

You need a Factory when:
- The exact type to create depends on runtime conditions
- Creation logic is complex and shouldn't live in the caller
- You want to centralize creation so it's easy to change later

### Before: Messy Conditional Creation

```typescript
function createNotification(type: string, message: string) {
  if (type === "email") {
    const n = new EmailNotification();
    n.setSmtpServer("smtp.example.com");
    n.setFrom("noreply@example.com");
    n.setBody(message);
    return n;
  } else if (type === "sms") {
    const n = new SmsNotification();
    n.setGateway("twilio");
    n.setMaxLength(160);
    n.setBody(message.slice(0, 160));
    return n;
  } else if (type === "push") {
    const n = new PushNotification();
    n.setProvider("firebase");
    n.setBody(message);
    return n;
  }
  throw new Error(`Unknown type: ${type}`);
}
```

This grows with every new notification type. The caller needs to
know about all the configuration details.

### After: Factory Method

```typescript
interface Notification {
  send(recipient: string): Promise<void>;
}

class EmailNotification implements Notification {
  constructor(private message: string) {}
  async send(recipient: string): Promise<void> {
    // email-specific sending logic
  }
}

class SmsNotification implements Notification {
  constructor(private message: string) {}
  async send(recipient: string): Promise<void> {
    // SMS-specific sending logic
  }
}

class PushNotification implements Notification {
  constructor(private message: string) {}
  async send(recipient: string): Promise<void> {
    // push-specific sending logic
  }
}

type NotificationType = "email" | "sms" | "push";

function createNotification(type: NotificationType, message: string): Notification {
  const factories: Record<NotificationType, () => Notification> = {
    email: () => new EmailNotification(message),
    sms:   () => new SmsNotification(message),
    push:  () => new PushNotification(message),
  };

  const factory = factories[type];
  if (!factory) {
    throw new Error(`Unknown notification type: ${type}`);
  }
  return factory();
}
```

### Factory in Python

```python
from abc import ABC, abstractmethod

class Serializer(ABC):
    @abstractmethod
    def serialize(self, data: dict) -> str: ...

class JsonSerializer(Serializer):
    def serialize(self, data: dict) -> str:
        import json
        return json.dumps(data)

class XmlSerializer(Serializer):
    def serialize(self, data: dict) -> str:
        return dict_to_xml(data)

def create_serializer(format: str) -> Serializer:
    serializers = {
        "json": JsonSerializer,
        "xml": XmlSerializer,
    }
    cls = serializers.get(format)
    if cls is None:
        raise ValueError(f"Unknown format: {format}")
    return cls()
```

### Factory in Rust

```rust
trait Transport {
    fn deliver(&self, package: &Package) -> Result<(), DeliveryError>;
}

struct Truck;
impl Transport for Truck {
    fn deliver(&self, package: &Package) -> Result<(), DeliveryError> {
        // ground delivery logic
        Ok(())
    }
}

struct Ship;
impl Transport for Ship {
    fn deliver(&self, package: &Package) -> Result<(), DeliveryError> {
        // sea delivery logic
        Ok(())
    }
}

enum TransportKind {
    Ground,
    Sea,
}

fn create_transport(kind: TransportKind) -> Box<dyn Transport> {
    match kind {
        TransportKind::Ground => Box::new(Truck),
        TransportKind::Sea => Box::new(Ship),
    }
}
```

### Factory in Go

```go
type Logger interface {
    Log(message string)
}

type ConsoleLogger struct{}
func (l ConsoleLogger) Log(message string) {
    fmt.Println(message)
}

type FileLogger struct {
    path string
}
func (l FileLogger) Log(message string) {
    os.WriteFile(l.path, []byte(message), 0644)
}

func NewLogger(logType string) (Logger, error) {
    switch logType {
    case "console":
        return ConsoleLogger{}, nil
    case "file":
        return FileLogger{path: "/var/log/app.log"}, nil
    default:
        return nil, fmt.Errorf("unknown logger type: %s", logType)
    }
}
```

---

## Abstract Factory

Abstract Factory creates **families** of related objects. It's a
factory that produces multiple things that belong together.

### The Furniture Store Analogy

You walk into a furniture store and say "I want the Modern
collection." They give you a Modern sofa, a Modern chair, and a
Modern table — all matching. If you ask for "Victorian," you get
the Victorian set. You never get a Modern sofa with a Victorian
chair.

```
ABSTRACT FACTORY: FURNITURE COLLECTIONS

  ModernFactory               VictorianFactory
  ├─ createSofa()  → ModernSofa    ├─ createSofa()  → VictorianSofa
  ├─ createChair() → ModernChair   ├─ createChair() → VictorianChair
  └─ createTable() → ModernTable   └─ createTable() → VictorianTable

  The factory guarantees everything matches.
```

### Abstract Factory in TypeScript

```typescript
interface Button {
  render(): string;
}

interface TextInput {
  render(): string;
}

interface UIFactory {
  createButton(label: string): Button;
  createTextInput(placeholder: string): TextInput;
}

class DarkThemeButton implements Button {
  constructor(private label: string) {}
  render(): string { return `<button class="dark">${this.label}</button>`; }
}

class DarkThemeInput implements TextInput {
  constructor(private placeholder: string) {}
  render(): string { return `<input class="dark" placeholder="${this.placeholder}">`; }
}

class LightThemeButton implements Button {
  constructor(private label: string) {}
  render(): string { return `<button class="light">${this.label}</button>`; }
}

class LightThemeInput implements TextInput {
  constructor(private placeholder: string) {}
  render(): string { return `<input class="light" placeholder="${this.placeholder}">`; }
}

class DarkThemeFactory implements UIFactory {
  createButton(label: string): Button { return new DarkThemeButton(label); }
  createTextInput(placeholder: string): TextInput { return new DarkThemeInput(placeholder); }
}

class LightThemeFactory implements UIFactory {
  createButton(label: string): Button { return new LightThemeButton(label); }
  createTextInput(placeholder: string): TextInput { return new LightThemeInput(placeholder); }
}

function buildLoginForm(factory: UIFactory): string {
  const emailInput = factory.createTextInput("Enter email");
  const submitBtn = factory.createButton("Log In");
  return emailInput.render() + submitBtn.render();
}
```

---

## Builder Pattern

The Builder constructs complex objects step by step. Unlike a
Factory (which returns a complete object in one call), a Builder
lets you configure the object piece by piece.

### When You Need It

- Objects with many optional parameters
- Objects that need validation before creation
- Objects with complex construction that varies

### The Problem Builder Solves

```
THE TELESCOPING CONSTRUCTOR PROBLEM

  new User(name)
  new User(name, email)
  new User(name, email, age)
  new User(name, email, age, phone)
  new User(name, email, age, phone, address)
  new User(name, email, age, phone, address, role)
  new User(name, email, age, phone, address, role, avatar)

  Which parameter is which? What if you only want name and role?
  new User("Alice", null, null, null, null, "admin", null)  ← terrible
```

### Builder in TypeScript

```typescript
class QueryBuilder {
  private table = "";
  private conditions: string[] = [];
  private orderField = "";
  private limitCount = 0;

  from(table: string): this {
    this.table = table;
    return this;
  }

  where(condition: string): this {
    this.conditions.push(condition);
    return this;
  }

  orderBy(field: string): this {
    this.orderField = field;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  build(): string {
    if (!this.table) {
      throw new Error("Table is required");
    }

    let query = `SELECT * FROM ${this.table}`;

    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(" AND ")}`;
    }
    if (this.orderField) {
      query += ` ORDER BY ${this.orderField}`;
    }
    if (this.limitCount > 0) {
      query += ` LIMIT ${this.limitCount}`;
    }

    return query;
  }
}

const query = new QueryBuilder()
  .from("users")
  .where("age > 18")
  .where("active = true")
  .orderBy("name")
  .limit(10)
  .build();
```

### Builder in Python

```python
class HttpRequest:
    def __init__(self, method: str, url: str, headers: dict,
                 body: str | None, timeout: int):
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
        self.timeout = timeout

class HttpRequestBuilder:
    def __init__(self):
        self._method = "GET"
        self._url = ""
        self._headers: dict = {}
        self._body: str | None = None
        self._timeout = 30

    def method(self, method: str) -> "HttpRequestBuilder":
        self._method = method
        return self

    def url(self, url: str) -> "HttpRequestBuilder":
        self._url = url
        return self

    def header(self, key: str, value: str) -> "HttpRequestBuilder":
        self._headers[key] = value
        return self

    def body(self, body: str) -> "HttpRequestBuilder":
        self._body = body
        return self

    def timeout(self, seconds: int) -> "HttpRequestBuilder":
        self._timeout = seconds
        return self

    def build(self) -> HttpRequest:
        if not self._url:
            raise ValueError("URL is required")
        return HttpRequest(
            self._method, self._url, self._headers,
            self._body, self._timeout
        )

request = (HttpRequestBuilder()
    .method("POST")
    .url("https://api.example.com/users")
    .header("Content-Type", "application/json")
    .body('{"name": "Alice"}')
    .timeout(10)
    .build())
```

### Builder in Rust

Rust's builder pattern is especially common because Rust doesn't
have default arguments or method overloading:

```rust
struct ServerConfig {
    host: String,
    port: u16,
    max_connections: usize,
    tls_enabled: bool,
}

struct ServerConfigBuilder {
    host: String,
    port: u16,
    max_connections: usize,
    tls_enabled: bool,
}

impl ServerConfigBuilder {
    fn new(host: &str) -> Self {
        Self {
            host: host.to_string(),
            port: 8080,
            max_connections: 100,
            tls_enabled: false,
        }
    }

    fn port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    fn max_connections(mut self, max: usize) -> Self {
        self.max_connections = max;
        self
    }

    fn tls(mut self, enabled: bool) -> Self {
        self.tls_enabled = enabled;
        self
    }

    fn build(self) -> ServerConfig {
        ServerConfig {
            host: self.host,
            port: self.port,
            max_connections: self.max_connections,
            tls_enabled: self.tls_enabled,
        }
    }
}

let config = ServerConfigBuilder::new("0.0.0.0")
    .port(443)
    .tls(true)
    .max_connections(1000)
    .build();
```

### Builder in Go

```go
type Server struct {
    Host           string
    Port           int
    MaxConnections int
    TLSEnabled     bool
}

type ServerOption func(*Server)

func WithPort(port int) ServerOption {
    return func(s *Server) { s.Port = port }
}

func WithMaxConnections(max int) ServerOption {
    return func(s *Server) { s.MaxConnections = max }
}

func WithTLS() ServerOption {
    return func(s *Server) { s.TLSEnabled = true }
}

func NewServer(host string, opts ...ServerOption) *Server {
    server := &Server{
        Host:           host,
        Port:           8080,
        MaxConnections: 100,
        TLSEnabled:     false,
    }
    for _, opt := range opts {
        opt(server)
    }
    return server
}

server := NewServer("0.0.0.0", WithPort(443), WithTLS(), WithMaxConnections(1000))
```

Go's "functional options" pattern is the idiomatic way to do
builders. It's used extensively in the standard library and
popular packages.

---

## When to Use Which

```
DECISION GUIDE

  Need to create one of several types?
  → Factory Method

  Need families of related objects that must match?
  → Abstract Factory

  Need to build complex objects with many optional parts?
  → Builder

  Object is simple with 1-3 required params?
  → Just use a constructor. No pattern needed.
```

---

## Exercises

1. **Factory**: Write a factory that creates different database
   connections (PostgreSQL, MySQL, SQLite) based on a config string.

2. **Abstract Factory**: Create a cross-platform UI factory that
   produces buttons and dialogs for Windows and macOS.

3. **Builder**: Build an email builder with to, from, cc, bcc,
   subject, body, and attachments. Require at least `to` and
   `subject` before building.

4. **Refactor**: Find an `if/else` chain that creates different
   objects in your codebase. Convert it to a Factory.

---

[← Previous: SOLID LSP, ISP, DIP](./03-solid-lsp-isp-dip.md) · [Next: Lesson 05 — Singleton and Prototype →](./05-singleton-prototype.md)
