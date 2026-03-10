# Lesson 12: Dependency Injection

> **The one thing to remember**: Instead of a class creating its own
> dependencies (like a restaurant growing its own vegetables), you
> hand them in from outside (like a restaurant ordering from
> suppliers). This makes code testable, flexible, and loosely coupled.
> DI is arguably the most important pattern for professional software.

---

## The Restaurant Supply Chain

A restaurant needs ingredients. It could:

**Option A** — Grow its own tomatoes, raise its own cattle, mill its
own flour. If it wants to switch from beef to chicken, it needs to
rebuild the entire farm.

**Option B** — Order from suppliers. Want to switch from beef to
chicken? Change the supplier. The kitchen doesn't change at all.

```
WITHOUT DI (creates its own dependencies):

  ┌──────────────────────────────────┐
  │  OrderService                     │
  │                                   │
  │  db = new PostgresDatabase()  ←── creates its own dependency
  │  mailer = new Gmail()         ←── creates its own dependency
  │                                   │
  │  Can't swap. Can't test easily.  │
  └──────────────────────────────────┘

WITH DI (receives dependencies from outside):

  ┌──────────────────────────────────┐
  │  OrderService(db, mailer)         │
  │                                   │
  │  this.db = db              ←───── given from outside
  │  this.mailer = mailer      ←───── given from outside
  │                                   │
  │  Swap anything. Test with fakes. │
  └──────────────────────────────────┘
```

---

## Three Types of Dependency Injection

### 1. Constructor Injection (Recommended)

Dependencies are passed through the constructor. This is the most
common and most recommended form.

```typescript
class OrderService {
  constructor(
    private repo: OrderRepository,
    private mailer: Mailer,
    private logger: Logger
  ) {}

  async placeOrder(order: Order): Promise<void> {
    await this.repo.save(order);
    await this.mailer.sendConfirmation(order);
    this.logger.info(`Order ${order.id} placed`);
  }
}

const service = new OrderService(
  new PostgresOrderRepo(connectionString),
  new SmtpMailer(smtpConfig),
  new ConsoleLogger()
);
```

**Why it's best**: Dependencies are visible in the constructor.
You can't create an `OrderService` without providing all its
dependencies. The object is always in a valid state.

### 2. Method Injection

Dependencies are passed to individual methods. Use this when
different calls need different dependencies.

```typescript
class ReportGenerator {
  generate(data: ReportData, formatter: Formatter): string {
    const processed = this.processData(data);
    return formatter.format(processed);
  }
}

generator.generate(data, new PdfFormatter());
generator.generate(data, new CsvFormatter());
```

### 3. Property Injection

Dependencies are set via properties after construction. Least
recommended — the object can exist in an invalid state.

```typescript
class NotificationService {
  sender?: MessageSender;

  notify(message: string): void {
    if (!this.sender) {
      throw new Error("Sender not configured");
    }
    this.sender.send(message);
  }
}
```

---

## DI Makes Testing Easy

This is the killer feature. Without DI, testing requires a real
database, a real email server, real everything. With DI, you pass
in fakes.

### TypeScript Testing Example

```typescript
class FakeOrderRepo implements OrderRepository {
  saved: Order[] = [];

  async save(order: Order): Promise<void> {
    this.saved.push(order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.saved.find((o) => o.id === id) ?? null;
  }
}

class FakeMailer implements Mailer {
  sentEmails: Array<{ to: string; subject: string }> = [];

  async sendConfirmation(order: Order): Promise<void> {
    this.sentEmails.push({
      to: order.customerEmail,
      subject: `Order ${order.id} confirmed`,
    });
  }
}

describe("OrderService", () => {
  it("saves order and sends confirmation", async () => {
    const repo = new FakeOrderRepo();
    const mailer = new FakeMailer();
    const logger = new NullLogger();
    const service = new OrderService(repo, mailer, logger);

    await service.placeOrder(testOrder);

    expect(repo.saved).toHaveLength(1);
    expect(mailer.sentEmails).toHaveLength(1);
  });
});
```

No database. No SMTP server. Tests run in milliseconds.

### Python Testing Example

```python
class FakeUserRepo:
    def __init__(self):
        self.users: dict[str, User] = {}

    def save(self, user: User) -> None:
        self.users[user.id] = user

    def find_by_email(self, email: str) -> User | None:
        for user in self.users.values():
            if user.email == email:
                return user
        return None

class FakeEmailSender:
    def __init__(self):
        self.sent: list[tuple[str, str]] = []

    def send(self, to: str, body: str) -> None:
        self.sent.append((to, body))

def test_registration():
    repo = FakeUserRepo()
    email = FakeEmailSender()
    service = RegistrationService(repo, email)

    service.register("alice", "alice@test.com")

    assert "alice@test.com" in [u.email for u in repo.users.values()]
    assert len(email.sent) == 1
```

---

## DI Containers

As applications grow, wiring dependencies manually gets tedious.
DI containers automate this wiring.

### Manual Wiring (Small Apps)

```typescript
const config = loadConfig();
const db = new PostgresDatabase(config.databaseUrl);
const userRepo = new PostgresUserRepo(db);
const emailService = new SmtpEmailService(config.smtpHost);
const logger = new FileLogger(config.logPath);
const userService = new UserService(userRepo, emailService, logger);
const orderRepo = new PostgresOrderRepo(db);
const paymentGateway = new StripeGateway(config.stripeKey);
const orderService = new OrderService(orderRepo, paymentGateway, userService, logger);
```

This works but gets unwieldy with 50+ services.

### Container Wiring (Large Apps)

```typescript
class Container {
  private factories = new Map<string, () => unknown>();
  private singletons = new Map<string, unknown>();

  register<T>(name: string, factory: () => T): void {
    this.factories.set(name, factory);
  }

  registerSingleton<T>(name: string, factory: () => T): void {
    this.factories.set(name, () => {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, factory());
      }
      return this.singletons.get(name);
    });
  }

  resolve<T>(name: string): T {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`No registration for: ${name}`);
    }
    return factory() as T;
  }
}

const container = new Container();
container.registerSingleton("db", () => new PostgresDatabase(dbUrl));
container.registerSingleton("logger", () => new FileLogger("/var/log/app.log"));
container.register("userRepo", () =>
  new PostgresUserRepo(container.resolve("db"))
);
container.register("userService", () =>
  new UserService(
    container.resolve("userRepo"),
    container.resolve("emailService"),
    container.resolve("logger")
  )
);
```

### DI in Go

Go doesn't typically use DI containers. Instead, the standard
approach is to wire dependencies in `main()`:

```go
func main() {
    db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    userRepo := postgres.NewUserRepo(db)
    emailSvc := smtp.NewEmailService(os.Getenv("SMTP_HOST"))
    logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

    userSvc := service.NewUserService(userRepo, emailSvc, logger)
    orderSvc := service.NewOrderService(
        postgres.NewOrderRepo(db),
        stripe.NewGateway(os.Getenv("STRIPE_KEY")),
        userSvc,
        logger,
    )

    server := api.NewServer(userSvc, orderSvc, logger)
    log.Fatal(server.ListenAndServe(":8080"))
}
```

This is Go's philosophy: explicit is better than magic. You can
see every dependency clearly.

### DI in Rust

Rust uses generics to achieve DI at compile time (no runtime
overhead):

```rust
struct AppService<R: Repository, N: Notifier> {
    repo: R,
    notifier: N,
}

impl<R: Repository, N: Notifier> AppService<R, N> {
    fn new(repo: R, notifier: N) -> Self {
        Self { repo, notifier }
    }

    fn process(&self, id: &str) -> Result<(), AppError> {
        let item = self.repo.find(id)?;
        self.notifier.notify(&format!("Processed: {}", item.name))?;
        Ok(())
    }
}

fn main() {
    let service = AppService::new(
        PostgresRepo::new(&database_url),
        EmailNotifier::new(&smtp_config),
    );
    service.process("item-1").unwrap();
}

#[cfg(test)]
mod tests {
    fn test_process() {
        let service = AppService::new(
            MockRepo::with_items(vec![test_item()]),
            MockNotifier::new(),
        );
        assert!(service.process("item-1").is_ok());
    }
}
```

---

## Service Locator: The Anti-Pattern

A Service Locator is a global registry that objects query for their
dependencies. It's the opposite of DI:

```typescript
class ServiceLocator {
  private static services = new Map<string, unknown>();

  static register(name: string, service: unknown): void {
    this.services.set(name, service);
  }

  static get<T>(name: string): T {
    return this.services.get(name) as T;
  }
}

class OrderService {
  placeOrder(order: Order): void {
    const db = ServiceLocator.get<Database>("db");
    const mailer = ServiceLocator.get<Mailer>("mailer");
    // ...
  }
}
```

**Why it's worse than DI**:
- Dependencies are hidden (you can't see them in the constructor)
- Testing is harder (must set up the global locator)
- Order of registration matters (fragile)
- It's essentially a fancy global variable

```
DI vs SERVICE LOCATOR

  Dependency Injection:
  ┌────────────────┐
  │ OrderService   │ ← constructor shows: needs DB, Mailer, Logger
  │ (db, mailer,   │
  │  logger)       │    Dependencies are VISIBLE
  └────────────────┘

  Service Locator:
  ┌────────────────┐
  │ OrderService   │ ← constructor shows: nothing
  │ ()             │
  │                │    Dependencies are HIDDEN inside
  │  db = Locator  │    You have to read the code to find them
  │    .get("db")  │
  └────────────────┘
```

---

## The Composition Root

The **composition root** is the one place in your application where
all the wiring happens. It's typically in `main()` or the
application's entry point.

```
THE COMPOSITION ROOT

  ┌──────────────────────────────────────────────┐
  │  main() / app startup  ← COMPOSITION ROOT    │
  │                                               │
  │  1. Create infrastructure (DB, logger, etc.)  │
  │  2. Create repositories                       │
  │  3. Create services                           │
  │  4. Wire everything together                  │
  │  5. Start the application                     │
  └──────────────────────────────────────────────┘

  Everything below the composition root receives
  its dependencies through constructors.
  Nothing below creates its own infrastructure.
```

---

## Exercises

1. **Refactor to DI**: Take a class that creates its own database
   connection inside a method. Refactor it to receive the database
   through its constructor.

2. **Test with fakes**: Write a fake implementation of a `UserRepo`
   that stores users in a plain array. Use it to test a `UserService`
   without any database.

3. **Build a container**: Implement a simple DI container that can
   register factories and resolve dependencies. Support both
   transient (new instance each time) and singleton lifetimes.

4. **Composition root**: Take an existing application and identify
   where dependencies are created. Move all creation to a single
   composition root.

---

[← Previous: Iterator and Template Method](./11-iterator-template.md) · [Next: Lesson 13 — Clean Architecture →](./13-clean-architecture.md)
