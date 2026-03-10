# Lesson 05: Singleton and Prototype

> **The one thing to remember**: Singleton ensures exactly one instance
> of something exists (like a country having one president). Prototype
> creates new objects by cloning existing ones (like photocopying a
> filled-out form instead of filling out a blank one). Use Singleton
> sparingly — it's the most overused and most controversial pattern.

---

## Singleton Pattern

### The School Principal Analogy

A school has exactly one principal. When any teacher needs to report
something, they go to THE principal — not a principal, not some
principal, THE principal. There's only one, and everyone shares them.

That's a Singleton: a class that guarantees only one instance exists,
and provides a global access point to it.

```
SINGLETON: ONLY ONE INSTANCE

  Teacher A ──→ ┌──────────────┐
  Teacher B ──→ │  Principal   │  ← same instance for everyone
  Teacher C ──→ │  (instance)  │
  Student D ──→ └──────────────┘

  No matter who asks, they all talk to the same principal.
```

### When Singletons Are Appropriate

- **Database connection pools**: You want one pool shared across
  your application, not a new pool per request.
- **Configuration**: Application config loaded once at startup.
- **Logging**: One logger instance for consistency.
- **Hardware access**: One object managing a printer or serial port.

### Singleton in TypeScript

```typescript
class AppConfig {
  private static instance: AppConfig | null = null;
  private settings: Map<string, string>;

  private constructor() {
    this.settings = new Map();
  }

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  get(key: string): string | undefined {
    return this.settings.get(key);
  }

  set(key: string, value: string): void {
    this.settings.set(key, value);
  }
}

const config1 = AppConfig.getInstance();
const config2 = AppConfig.getInstance();
// config1 === config2 → true (same object)
```

### Singleton in Python

Python's module system is already a singleton. When you `import`
a module, Python caches it. So the simplest singleton is just a
module:

```python
# config.py — this IS a singleton. Python only loads it once.
_settings: dict[str, str] = {}

def get(key: str) -> str | None:
    return _settings.get(key)

def set(key: str, value: str) -> None:
    _settings[key] = value
```

If you need a class-based singleton:

```python
class DatabasePool:
    _instance: "DatabasePool | None" = None

    def __new__(cls) -> "DatabasePool":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._pool = create_pool()
        return cls._instance

    def get_connection(self):
        return self._pool.acquire()

pool1 = DatabasePool()
pool2 = DatabasePool()
assert pool1 is pool2
```

### Singleton in Rust

Rust makes singletons deliberately awkward because mutable global
state is unsafe. The standard approach uses `OnceLock` (or the
`once_cell` crate for older Rust versions):

```rust
use std::sync::OnceLock;

struct Config {
    database_url: String,
    max_retries: u32,
}

static CONFIG: OnceLock<Config> = OnceLock::new();

fn get_config() -> &'static Config {
    CONFIG.get_or_init(|| Config {
        database_url: std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "localhost:5432".to_string()),
        max_retries: 3,
    })
}
```

### Singleton in Go

```go
var (
    configInstance *Config
    configOnce     sync.Once
)

type Config struct {
    DatabaseURL string
    MaxRetries  int
}

func GetConfig() *Config {
    configOnce.Do(func() {
        configInstance = &Config{
            DatabaseURL: os.Getenv("DATABASE_URL"),
            MaxRetries:  3,
        }
    })
    return configInstance
}
```

Go's `sync.Once` ensures the initialization function runs exactly
once, even if called from multiple goroutines simultaneously.

---

## Why Singleton Is Controversial

Singleton is the most debated GoF pattern. Here's why experienced
developers often avoid it:

```
PROBLEMS WITH SINGLETON

  1. HIDDEN DEPENDENCIES
     Your function secretly depends on a global object.
     Reading the function signature doesn't tell you this.

     func ProcessOrder(order Order) error {
         db := GetDatabase()     // ← hidden dependency!
         config := GetConfig()   // ← another hidden dependency!
         ...
     }

  2. TESTING NIGHTMARE
     You can't substitute a fake database in tests.
     The singleton IS the real database.

  3. CONCURRENCY BUGS
     Global mutable state + multiple threads = pain.
     Every thread reads and writes the same object.

  4. TIGHT COUPLING
     Everything depends on the singleton.
     Changing it can break the entire application.

  5. VIOLATION OF SRP
     The class manages its own lifecycle (creation, uniqueness)
     AND its actual business logic.
```

### The Better Alternative: Dependency Injection

Instead of having objects reach out to grab a global singleton,
pass the dependency in:

```typescript
// BAD: hidden singleton dependency
class OrderService {
  process(order: Order): void {
    const db = Database.getInstance();
    db.save(order);
  }
}

// GOOD: explicit dependency
class OrderService {
  constructor(private db: Database) {}

  process(order: Order): void {
    this.db.save(order);
  }
}
```

With DI, you can pass a real database in production and a fake one
in tests. The dependency is visible in the constructor signature.

```
SINGLETON vs DEPENDENCY INJECTION

  Singleton:
  - Object fetches its own dependencies (hidden)
  - Hard to test (can't swap implementations)
  - Global state (concurrency risk)

  Dependency Injection:
  - Dependencies are passed in (explicit)
  - Easy to test (pass in mocks)
  - No global state (each instance is independent)

  RULE OF THUMB: If you're using Singleton just to avoid passing
  objects around, use DI instead. Save Singleton for cases where
  you truly need exactly one instance (like a hardware driver).
```

---

## Prototype Pattern

### The Photocopy Analogy

You have a complex form that's already filled out with your
company's standard information — name, address, tax ID, 30 other
fields. For each new employee, do you fill out a blank form from
scratch? No. You photocopy the standard form and only change the
employee-specific fields.

That's the Prototype pattern: create new objects by **cloning**
an existing object (the prototype) instead of constructing from
scratch.

```
PROTOTYPE: CLONE INSTEAD OF CREATE

  Template Document (prototype)
  ┌────────────────────────────┐
  │ Company: Acme Corp         │
  │ Address: 123 Main St       │
  │ Tax ID: XX-XXXXXXX         │
  │ Department: ___________    │
  │ Employee: ___________      │
  └────────────────────────────┘
        │             │
     clone()       clone()
        │             │
        ▼             ▼
  ┌──────────┐  ┌──────────┐
  │ Dept: Eng│  │ Dept: HR │
  │ Emp: Ada │  │ Emp: Bob │
  └──────────┘  └──────────┘
```

### When You Need Prototype

- Creating an object is expensive (complex setup, database queries,
  file parsing) and you need many similar objects.
- You don't know the exact type at runtime — you just have an
  object and want another one like it.
- You need to create variations of a "template" object.

### Prototype in TypeScript

```typescript
interface Cloneable<T> {
  clone(): T;
}

class GameUnit implements Cloneable<GameUnit> {
  constructor(
    public name: string,
    public health: number,
    public attack: number,
    public defense: number,
    public abilities: string[]
  ) {}

  clone(): GameUnit {
    return new GameUnit(
      this.name,
      this.health,
      this.attack,
      this.defense,
      [...this.abilities]
    );
  }
}

const archerTemplate = new GameUnit("Archer", 100, 25, 10, ["ranged", "stealth"]);

const archer1 = archerTemplate.clone();
archer1.name = "Archer Squadron A";

const archer2 = archerTemplate.clone();
archer2.name = "Archer Squadron B";
archer2.abilities.push("fire_arrows");
```

### Prototype in Python

Python has built-in support via `copy`:

```python
import copy

class SpreadsheetCell:
    def __init__(self, value, formula, style, validation_rules):
        self.value = value
        self.formula = formula
        self.style = style
        self.validation_rules = validation_rules

    def clone(self):
        return copy.deepcopy(self)

template_cell = SpreadsheetCell(
    value=0,
    formula=None,
    style={"font": "Arial", "size": 12, "bold": False, "color": "#000"},
    validation_rules={"type": "number", "min": 0, "max": 1000}
)

cell_a1 = template_cell.clone()
cell_a1.value = 42

cell_b1 = template_cell.clone()
cell_b1.formula = "=A1*2"
```

### Prototype in Rust

Rust uses the `Clone` trait, which is built into the language:

```rust
#[derive(Clone)]
struct DocumentTemplate {
    header: String,
    footer: String,
    font: String,
    margins: Margins,
    styles: Vec<Style>,
}

let template = DocumentTemplate {
    header: "Acme Corp".to_string(),
    footer: "Confidential".to_string(),
    font: "Helvetica".to_string(),
    margins: Margins::default(),
    styles: vec![Style::default()],
};

let mut invoice = template.clone();
invoice.header = "Acme Corp - Invoice".to_string();

let mut report = template.clone();
report.header = "Acme Corp - Report".to_string();
```

### Prototype in Go

```go
type ChartConfig struct {
    Title      string
    XLabel     string
    YLabel     string
    Colors     []string
    Width      int
    Height     int
    ShowLegend bool
}

func (c *ChartConfig) Clone() *ChartConfig {
    clone := *c
    clone.Colors = make([]string, len(c.Colors))
    copy(clone.Colors, c.Colors)
    return &clone
}

template := &ChartConfig{
    Title:      "",
    XLabel:     "Time",
    YLabel:     "Value",
    Colors:     []string{"#FF0000", "#00FF00", "#0000FF"},
    Width:      800,
    Height:     600,
    ShowLegend: true,
}

salesChart := template.Clone()
salesChart.Title = "Q4 Sales"

trafficChart := template.Clone()
trafficChart.Title = "Website Traffic"
trafficChart.Colors = append(trafficChart.Colors, "#FF00FF")
```

### Deep Clone vs Shallow Clone

```
SHALLOW CLONE vs DEEP CLONE

  Original:  { name: "Alice", tags: ["a", "b"] }

  SHALLOW CLONE:
  { name: "Alice", tags: ──→ same array as original }
  Changing tags in the clone changes the original too!

  DEEP CLONE:
  { name: "Alice", tags: ["a", "b"] }  ← independent copy
  Changing tags in the clone doesn't affect the original.

  RULE: Always deep clone when objects contain references
  to other objects (arrays, maps, nested objects).
```

---

## Exercises

1. **Singleton debate**: List three cases where a Singleton is the
   right choice and three where DI would be better.

2. **Thread safety**: The basic TypeScript singleton is not
   thread-safe in a multi-threaded environment. How does Go's
   `sync.Once` solve this?

3. **Prototype practice**: Create a prototype for email templates.
   The template has subject, body, sender, and styling. Clone it
   to create different email types (welcome, reset password, etc.).

4. **Refactor away Singleton**: Find a Singleton in a codebase and
   refactor it to use dependency injection. What tests can you write
   now that you couldn't before?

---

[← Previous: Factory and Builder](./04-factory-builder.md) · [Next: Lesson 06 — Adapter and Facade →](./06-adapter-facade.md)
