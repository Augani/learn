# Lesson 07: Decorator and Proxy

> **The one thing to remember**: A Decorator wraps an object to ADD
> new behavior (like adding toppings to ice cream — each topping
> wraps the previous one). A Proxy wraps an object to CONTROL ACCESS
> (like a security guard who checks your ID before letting you into
> the building). Both use wrapping, but for different purposes.

---

## Decorator Pattern

### The Gift Wrapping Analogy

You buy a book. Then you wrap it in paper. Then you put it in a box.
Then you add a bow. Each layer adds something new, but underneath
it's still a book. You can add or remove any layer without changing
the book itself.

```
DECORATOR: ADDING LAYERS

  ┌─────────────────────────────────┐
  │         Bow (decorator)         │
  │  ┌───────────────────────────┐  │
  │  │      Box (decorator)      │  │
  │  │  ┌─────────────────────┐  │  │
  │  │  │  Paper (decorator)  │  │  │
  │  │  │  ┌───────────────┐  │  │  │
  │  │  │  │     Book      │  │  │  │
  │  │  │  │  (original)   │  │  │  │
  │  │  │  └───────────────┘  │  │  │
  │  │  └─────────────────────┘  │  │
  │  └───────────────────────────┘  │
  └─────────────────────────────────┘

  Each wrapper adds something.
  The core object stays unchanged.
  You can add or remove wrappers freely.
```

### Why Not Just Use Inheritance?

You COULD make subclasses for every combination:
`LoggedCachedCompressedDataSource`. But that creates an explosion
of classes:

```
THE INHERITANCE EXPLOSION

  If you have 4 optional features: Logging, Caching, Compression, Encryption

  Subclass approach → 2^4 = 16 combinations:
    DataSource
    LoggedDataSource
    CachedDataSource
    CompressedDataSource
    EncryptedDataSource
    LoggedCachedDataSource
    LoggedCompressedDataSource
    LoggedEncryptedDataSource
    CachedCompressedDataSource
    ... 8 more ...

  Decorator approach → 4 decorators, compose any combination:
    new Logged(new Cached(new Compressed(new Encrypted(source))))
    new Logged(new Cached(source))
    new Encrypted(source)
    ... any combination works
```

### Decorator in TypeScript

```typescript
interface DataSource {
  read(): Promise<string>;
  write(data: string): Promise<void>;
}

class FileDataSource implements DataSource {
  constructor(private path: string) {}

  async read(): Promise<string> {
    return fs.readFile(this.path, "utf-8");
  }

  async write(data: string): Promise<void> {
    await fs.writeFile(this.path, data);
  }
}

class LoggingDecorator implements DataSource {
  constructor(private wrapped: DataSource) {}

  async read(): Promise<string> {
    const start = Date.now();
    const result = await this.wrapped.read();
    console.log(`Read took ${Date.now() - start}ms`);
    return result;
  }

  async write(data: string): Promise<void> {
    const start = Date.now();
    await this.wrapped.write(data);
    console.log(`Write took ${Date.now() - start}ms`);
  }
}

class CompressionDecorator implements DataSource {
  constructor(private wrapped: DataSource) {}

  async read(): Promise<string> {
    const compressed = await this.wrapped.read();
    return decompress(compressed);
  }

  async write(data: string): Promise<void> {
    const compressed = compress(data);
    await this.wrapped.write(compressed);
  }
}

class EncryptionDecorator implements DataSource {
  constructor(private wrapped: DataSource, private key: string) {}

  async read(): Promise<string> {
    const encrypted = await this.wrapped.read();
    return decrypt(encrypted, this.key);
  }

  async write(data: string): Promise<void> {
    const encrypted = encrypt(data, this.key);
    await this.wrapped.write(encrypted);
  }
}

const source = new EncryptionDecorator(
  new CompressionDecorator(
    new LoggingDecorator(
      new FileDataSource("data.txt")
    )
  ),
  "secret-key"
);

await source.write("Hello World");
const data = await source.read();
```

### Middleware: Decorators in Disguise

If you've used Express.js, Koa, or any HTTP framework with
middleware, you've already used the Decorator pattern:

```typescript
app.use(logging());
app.use(authentication());
app.use(rateLimit({ max: 100 }));
app.use(compression());

// Each middleware wraps the next handler.
// Request flows through: logging → auth → rateLimit → compression → handler
// Response flows back:   handler → compression → rateLimit → auth → logging
```

### Decorator in Python

Python has built-in decorator syntax (`@`), which is the same
concept applied to functions:

```python
from abc import ABC, abstractmethod

class Notifier(ABC):
    @abstractmethod
    def send(self, message: str) -> None: ...

class EmailNotifier(Notifier):
    def __init__(self, address: str):
        self._address = address

    def send(self, message: str) -> None:
        send_email(self._address, message)

class SlackDecorator(Notifier):
    def __init__(self, wrapped: Notifier, channel: str):
        self._wrapped = wrapped
        self._channel = channel

    def send(self, message: str) -> None:
        self._wrapped.send(message)
        post_to_slack(self._channel, message)

class SmsDecorator(Notifier):
    def __init__(self, wrapped: Notifier, phone: str):
        self._wrapped = wrapped
        self._phone = phone

    def send(self, message: str) -> None:
        self._wrapped.send(message)
        send_sms(self._phone, message)

notifier = SmsDecorator(
    SlackDecorator(
        EmailNotifier("admin@example.com"),
        "#alerts"
    ),
    "+1234567890"
)

notifier.send("Server is down!")
```

### Decorator in Rust

```rust
trait Logger {
    fn log(&self, message: &str);
}

struct ConsoleLogger;
impl Logger for ConsoleLogger {
    fn log(&self, message: &str) {
        println!("{message}");
    }
}

struct TimestampDecorator<L: Logger> {
    inner: L,
}

impl<L: Logger> Logger for TimestampDecorator<L> {
    fn log(&self, message: &str) {
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S");
        self.inner.log(&format!("[{now}] {message}"));
    }
}

struct LevelDecorator<L: Logger> {
    inner: L,
    level: String,
}

impl<L: Logger> Logger for LevelDecorator<L> {
    fn log(&self, message: &str) {
        self.inner.log(&format!("[{}] {message}", self.level));
    }
}

let logger = TimestampDecorator {
    inner: LevelDecorator {
        inner: ConsoleLogger,
        level: "INFO".to_string(),
    },
};
logger.log("Application started");
```

### Decorator in Go

```go
type Handler func(req *Request) *Response

func WithLogging(next Handler) Handler {
    return func(req *Request) *Response {
        start := time.Now()
        resp := next(req)
        log.Printf("%s %s took %v", req.Method, req.Path, time.Since(start))
        return resp
    }
}

func WithAuth(next Handler) Handler {
    return func(req *Request) *Response {
        if !isAuthenticated(req) {
            return &Response{Status: 401}
        }
        return next(req)
    }
}

func WithRateLimit(max int, next Handler) Handler {
    limiter := rate.NewLimiter(rate.Limit(max), max)
    return func(req *Request) *Response {
        if !limiter.Allow() {
            return &Response{Status: 429}
        }
        return next(req)
    }
}

handler := WithLogging(WithAuth(WithRateLimit(100, myHandler)))
```

---

## Proxy Pattern

### The Security Guard Analogy

You want to enter a building. The security guard checks your badge,
logs your entry, and either lets you in or turns you away. The guard
doesn't change what's inside the building — they control access to it.

```
PROXY: CONTROLLING ACCESS

  ┌──────┐     ┌────────────┐     ┌───────────┐
  │ You  │────→│   Proxy    │────→│  Real     │
  │      │     │ (guard)    │     │  Object   │
  └──────┘     │            │     │           │
               │ ✓ Check    │     │ The actual│
               │   access   │     │ work      │
               │ ✓ Log      │     │ happens   │
               │   usage    │     │ here      │
               │ ✓ Cache    │     │           │
               │   results  │     │           │
               └────────────┘     └───────────┘
```

### Types of Proxies

```
PROXY VARIANTS

  VIRTUAL PROXY      — Delays creation of expensive objects
                       until actually needed (lazy loading)

  PROTECTION PROXY   — Controls access based on permissions

  CACHING PROXY      — Stores results to avoid repeated
                       expensive operations

  LOGGING PROXY      — Records every call for debugging
                       or auditing

  REMOTE PROXY       — Represents an object on another
                       server (like RPC stubs)
```

### Caching Proxy in TypeScript

```typescript
interface WeatherService {
  getForecast(city: string): Promise<Forecast>;
}

class RealWeatherService implements WeatherService {
  async getForecast(city: string): Promise<Forecast> {
    const response = await fetch(`https://api.weather.com/${city}`);
    return response.json();
  }
}

class CachingWeatherProxy implements WeatherService {
  private cache = new Map<string, { data: Forecast; expiry: number }>();

  constructor(
    private service: WeatherService,
    private ttlMs: number = 600_000
  ) {}

  async getForecast(city: string): Promise<Forecast> {
    const cached = this.cache.get(city);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const data = await this.service.getForecast(city);
    this.cache.set(city, { data, expiry: Date.now() + this.ttlMs });
    return data;
  }
}

const weather: WeatherService = new CachingWeatherProxy(
  new RealWeatherService(),
  10 * 60 * 1000
);
```

### Protection Proxy in Python

```python
class Document:
    def __init__(self, content: str):
        self.content = content

    def read(self) -> str:
        return self.content

    def write(self, new_content: str) -> None:
        self.content = new_content

class ProtectedDocumentProxy:
    def __init__(self, document: Document, user_role: str):
        self._document = document
        self._role = user_role

    def read(self) -> str:
        return self._document.read()

    def write(self, new_content: str) -> None:
        if self._role not in ("admin", "editor"):
            raise PermissionError(
                f"Role '{self._role}' cannot write documents"
            )
        self._document.write(new_content)

doc = Document("Hello World")
viewer_proxy = ProtectedDocumentProxy(doc, "viewer")
viewer_proxy.read()
viewer_proxy.write("Hacked!")  # raises PermissionError
```

### Lazy Loading Proxy in Rust

```rust
struct HeavyImage {
    data: Vec<u8>,
}

impl HeavyImage {
    fn load(path: &str) -> Self {
        let data = std::fs::read(path).expect("failed to read image");
        Self { data }
    }

    fn display(&self) {
        println!("Displaying {} bytes", self.data.len());
    }
}

struct LazyImage {
    path: String,
    image: Option<HeavyImage>,
}

impl LazyImage {
    fn new(path: &str) -> Self {
        Self {
            path: path.to_string(),
            image: None,
        }
    }

    fn display(&mut self) {
        if self.image.is_none() {
            self.image = Some(HeavyImage::load(&self.path));
        }
        self.image.as_ref().unwrap().display();
    }
}

let mut img = LazyImage::new("huge_photo.png");
// Image NOT loaded yet. No disk I/O has happened.
img.display(); // NOW it loads (first access)
img.display(); // Uses cached version
```

### Logging Proxy in Go

```go
type Database interface {
    Query(sql string) ([]Row, error)
    Execute(sql string) error
}

type RealDatabase struct {
    conn *sql.DB
}

func (d *RealDatabase) Query(sql string) ([]Row, error) {
    return d.conn.Query(sql)
}

func (d *RealDatabase) Execute(sql string) error {
    _, err := d.conn.Exec(sql)
    return err
}

type LoggingProxy struct {
    db     Database
    logger *log.Logger
}

func (p *LoggingProxy) Query(sql string) ([]Row, error) {
    start := time.Now()
    rows, err := p.db.Query(sql)
    p.logger.Printf("QUERY [%v] %s (err: %v)", time.Since(start), sql, err)
    return rows, err
}

func (p *LoggingProxy) Execute(sql string) error {
    start := time.Now()
    err := p.db.Execute(sql)
    p.logger.Printf("EXEC [%v] %s (err: %v)", time.Since(start), sql, err)
    return err
}
```

---

## Decorator vs Proxy

```
DECORATOR vs PROXY

  DECORATOR                        PROXY
  ─────────────────────────────    ─────────────────────────────
  Adds NEW behavior                Controls EXISTING behavior

  Client knows about wrapping      Client doesn't know about proxy
  (often stacks multiple)          (thinks it's the real object)

  Open-ended composition           Usually one layer

  "Add logging AND caching         "Cache results before hitting
   AND compression"                 the database"

  Think: toppings on ice cream     Think: bouncer at a club
```

---

## Exercises

1. **Decorator stack**: Build a `TextFormatter` with decorators for
   bold, italic, uppercase, and trimming. Stack them in different
   orders and observe the output.

2. **Caching proxy**: Write a proxy for an API client that caches
   responses for 5 minutes. Add a way to invalidate the cache.

3. **Middleware chain**: Implement a simple HTTP middleware system
   where each middleware is a decorator. Include logging, timing,
   and error handling.

4. **Real-world hunt**: Find three examples of the Decorator pattern
   in libraries you use. (Hint: Java I/O streams, Python function
   decorators, Express/Koa middleware.)

---

[← Previous: Adapter and Facade](./06-adapter-facade.md) · [Next: Lesson 08 — Composite and Bridge →](./08-composite-bridge.md)
