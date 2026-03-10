# Lesson 09: Strategy and Observer

> **The one thing to remember**: Strategy lets you swap out algorithms
> like changing the blade on a multi-tool — same handle, different
> function. Observer lets objects subscribe to events so they're
> notified when something changes — like following a social media
> account. These are two of the most commonly used patterns.

---

## Strategy Pattern

### The GPS Navigation Analogy

Your GPS app asks: "How do you want to get there?" You can choose
driving, walking, cycling, or public transit. Each option uses a
completely different algorithm to calculate the route. But the app
works the same way regardless — it shows you a route on a map.

The algorithm is the strategy. The app is the context that uses it.

```
STRATEGY: SWAPPABLE ALGORITHMS

  ┌─────────────────────────┐
  │    Navigation App       │
  │    (context)            │
  │                         │
  │    strategy: RouteAlgo ─────→ which algorithm to use?
  │                         │
  │    calculateRoute()     │
  └─────────────────────────┘
              │
     ┌────────┼──────────┐
     │        │          │
  ┌──────┐ ┌──────┐ ┌──────┐
  │Drive │ │Walk  │ │Bike  │   ← each is a different strategy
  │Route │ │Route │ │Route │
  └──────┘ └──────┘ └──────┘

  Same interface. Different algorithms.
  Swap anytime without changing the app.
```

### When You Need Strategy

- You have several algorithms that do the same thing differently
- You want to choose the algorithm at runtime
- You have a big if/else or switch selecting between behaviors
- You want to isolate algorithm-specific code for testing

### Strategy in TypeScript

```typescript
interface PricingStrategy {
  calculatePrice(basePrice: number, quantity: number): number;
}

class RegularPricing implements PricingStrategy {
  calculatePrice(basePrice: number, quantity: number): number {
    return basePrice * quantity;
  }
}

class BulkDiscountPricing implements PricingStrategy {
  calculatePrice(basePrice: number, quantity: number): number {
    if (quantity >= 100) return basePrice * quantity * 0.7;
    if (quantity >= 50) return basePrice * quantity * 0.8;
    if (quantity >= 10) return basePrice * quantity * 0.9;
    return basePrice * quantity;
  }
}

class SeasonalPricing implements PricingStrategy {
  constructor(private multiplier: number) {}

  calculatePrice(basePrice: number, quantity: number): number {
    return basePrice * quantity * this.multiplier;
  }
}

class ShoppingCart {
  private items: Array<{ price: number; quantity: number }> = [];

  constructor(private pricing: PricingStrategy) {}

  setPricing(strategy: PricingStrategy): void {
    this.pricing = strategy;
  }

  addItem(price: number, quantity: number): void {
    this.items.push({ price, quantity });
  }

  total(): number {
    return this.items.reduce(
      (sum, item) => sum + this.pricing.calculatePrice(item.price, item.quantity),
      0
    );
  }
}

const cart = new ShoppingCart(new RegularPricing());
cart.addItem(10, 5);
console.log(cart.total());

cart.setPricing(new BulkDiscountPricing());
cart.addItem(10, 100);
console.log(cart.total());
```

### Strategy in Python

Python's first-class functions make Strategy elegant — you don't
even need classes:

```python
from typing import Callable

SortStrategy = Callable[[list], list]

def bubble_sort(data: list) -> list:
    arr = data[:]
    for i in range(len(arr)):
        for j in range(len(arr) - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

def merge_sort(data: list) -> list:
    if len(data) <= 1:
        return data
    mid = len(data) // 2
    left = merge_sort(data[:mid])
    right = merge_sort(data[mid:])
    return _merge(left, right)

class DataProcessor:
    def __init__(self, sort_strategy: SortStrategy):
        self._sort = sort_strategy

    def process(self, data: list) -> list:
        sorted_data = self._sort(data)
        return [x for x in sorted_data if x is not None]

processor = DataProcessor(merge_sort)
result = processor.process([3, 1, None, 4, 1, 5])

processor = DataProcessor(bubble_sort)
result = processor.process([3, 1, None, 4, 1, 5])
```

### Strategy in Rust

```rust
trait Compressor {
    fn compress(&self, data: &[u8]) -> Vec<u8>;
    fn decompress(&self, data: &[u8]) -> Vec<u8>;
}

struct GzipCompressor;
impl Compressor for GzipCompressor {
    fn compress(&self, data: &[u8]) -> Vec<u8> { gzip_encode(data) }
    fn decompress(&self, data: &[u8]) -> Vec<u8> { gzip_decode(data) }
}

struct ZstdCompressor { level: i32 }
impl Compressor for ZstdCompressor {
    fn compress(&self, data: &[u8]) -> Vec<u8> { zstd_encode(data, self.level) }
    fn decompress(&self, data: &[u8]) -> Vec<u8> { zstd_decode(data) }
}

struct FileStore {
    compressor: Box<dyn Compressor>,
}

impl FileStore {
    fn save(&self, path: &str, data: &[u8]) -> Result<(), io::Error> {
        let compressed = self.compressor.compress(data);
        std::fs::write(path, compressed)
    }

    fn load(&self, path: &str) -> Result<Vec<u8>, io::Error> {
        let compressed = std::fs::read(path)?;
        Ok(self.compressor.decompress(&compressed))
    }
}
```

### Strategy in Go

```go
type HashStrategy func(data []byte) string

func MD5Hash(data []byte) string {
    h := md5.Sum(data)
    return hex.EncodeToString(h[:])
}

func SHA256Hash(data []byte) string {
    h := sha256.Sum256(data)
    return hex.EncodeToString(h[:])
}

type FileIntegrityChecker struct {
    hasher HashStrategy
}

func (c *FileIntegrityChecker) Verify(path string, expectedHash string) (bool, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return false, err
    }
    return c.hasher(data) == expectedHash, nil
}

checker := &FileIntegrityChecker{hasher: SHA256Hash}
ok, _ := checker.Verify("file.txt", "abc123...")
```

---

## Observer Pattern

### The Newsletter Analogy

You subscribe to a newsletter. When the author publishes a new
article, every subscriber gets notified. You don't have to check
the website every day. And the author doesn't need to know who
specifically is subscribed — they just publish, and the system
delivers to all subscribers.

```
OBSERVER: PUBLISH-SUBSCRIBE

  ┌───────────────┐    notify()    ┌──────────────┐
  │   Subject     │──────────────→│ Observer A   │
  │   (Publisher) │──────────────→│ Observer B   │
  │               │──────────────→│ Observer C   │
  │  subscribe()  │               └──────────────┘
  │  unsubscribe()│
  │  notify()     │    Observers come and go.
  └───────────────┘    Subject doesn't care who they are.
```

### When You Need Observer

- Multiple objects need to react to changes in another object
- You don't want tight coupling between the source and receivers
- The set of receivers can change at runtime
- You're building an event system, pub/sub, or reactive UI

### Observer in TypeScript

```typescript
type EventHandler<T> = (data: T) => void;

class EventEmitter<Events extends Record<string, unknown>> {
  private listeners = new Map<string, Set<EventHandler<unknown>>>();

  on<K extends keyof Events & string>(
    event: K,
    handler: EventHandler<Events[K]>
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown>);
  }

  off<K extends keyof Events & string>(
    event: K,
    handler: EventHandler<Events[K]>
  ): void {
    this.listeners.get(event)?.delete(handler as EventHandler<unknown>);
  }

  emit<K extends keyof Events & string>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach((handler) => handler(data));
  }
}

interface ShopEvents {
  "item-added": { itemId: string; price: number };
  "order-placed": { orderId: string; total: number };
  "order-shipped": { orderId: string; trackingNumber: string };
}

const shop = new EventEmitter<ShopEvents>();

shop.on("order-placed", (data) => {
  sendConfirmationEmail(data.orderId);
});

shop.on("order-placed", (data) => {
  updateInventory(data.orderId);
});

shop.on("order-placed", (data) => {
  trackAnalytics("purchase", data.total);
});

shop.emit("order-placed", { orderId: "123", total: 49.99 });
```

### Observer in Python

```python
from typing import Callable, Any

class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = {}

    def subscribe(self, event: str, handler: Callable) -> None:
        if event not in self._subscribers:
            self._subscribers[event] = []
        self._subscribers[event].append(handler)

    def unsubscribe(self, event: str, handler: Callable) -> None:
        if event in self._subscribers:
            self._subscribers[event].remove(handler)

    def publish(self, event: str, **data: Any) -> None:
        for handler in self._subscribers.get(event, []):
            handler(**data)

bus = EventBus()

def log_purchase(user_id: str, amount: float, **_):
    print(f"User {user_id} purchased ${amount}")

def send_receipt(user_id: str, amount: float, **_):
    print(f"Sending receipt to {user_id}")

def update_analytics(user_id: str, amount: float, **_):
    print(f"Analytics: purchase ${amount}")

bus.subscribe("purchase", log_purchase)
bus.subscribe("purchase", send_receipt)
bus.subscribe("purchase", update_analytics)

bus.publish("purchase", user_id="alice", amount=29.99)
```

### Observer in Rust

```rust
type Handler<T> = Box<dyn Fn(&T)>;

struct EventEmitter<T> {
    handlers: Vec<Handler<T>>,
}

impl<T> EventEmitter<T> {
    fn new() -> Self {
        Self { handlers: Vec::new() }
    }

    fn subscribe(&mut self, handler: impl Fn(&T) + 'static) {
        self.handlers.push(Box::new(handler));
    }

    fn emit(&self, event: &T) {
        for handler in &self.handlers {
            handler(event);
        }
    }
}

struct TemperatureReading {
    sensor_id: String,
    celsius: f64,
}

let mut monitor = EventEmitter::<TemperatureReading>::new();

monitor.subscribe(|reading| {
    println!("Display: {}°C from {}", reading.celsius, reading.sensor_id);
});

monitor.subscribe(|reading| {
    if reading.celsius > 100.0 {
        println!("ALERT: {} overheating!", reading.sensor_id);
    }
});

monitor.emit(&TemperatureReading {
    sensor_id: "sensor-1".to_string(),
    celsius: 105.0,
});
```

### Observer in Go

```go
type OrderEvent struct {
    OrderID string
    Total   float64
    UserID  string
}

type OrderHandler func(event OrderEvent)

type OrderEventBus struct {
    mu       sync.RWMutex
    handlers []OrderHandler
}

func (b *OrderEventBus) Subscribe(handler OrderHandler) {
    b.mu.Lock()
    defer b.mu.Unlock()
    b.handlers = append(b.handlers, handler)
}

func (b *OrderEventBus) Publish(event OrderEvent) {
    b.mu.RLock()
    defer b.mu.RUnlock()
    for _, handler := range b.handlers {
        handler(event)
    }
}

bus := &OrderEventBus{}

bus.Subscribe(func(e OrderEvent) {
    log.Printf("Order %s placed for $%.2f", e.OrderID, e.Total)
})

bus.Subscribe(func(e OrderEvent) {
    sendEmail(e.UserID, "Your order has been placed!")
})

bus.Publish(OrderEvent{OrderID: "ord-1", Total: 59.99, UserID: "alice"})
```

---

## Strategy vs Observer

```
STRATEGY vs OBSERVER

  STRATEGY                         OBSERVER
  ─────────────────────────────    ─────────────────────────────
  One algorithm chosen at a time   Multiple listeners at once

  "How should I do this?"          "Who needs to know about this?"

  Caller selects the strategy      Listeners register themselves

  One-to-one relationship          One-to-many relationship

  Swap behavior of one object      Broadcast events to many objects

  Example: choosing sort           Example: order events trigger
  algorithm                        email, inventory, analytics
```

---

## Real-World Combinations

These patterns often work together:

```
REAL SYSTEM: PAYMENT PROCESSING

  Strategy: which payment method to use
  ┌───────────────┐
  │ PaymentMethod │ ← strategy interface
  └───────┬───────┘
          │
  ┌───────┼───────┐
  │       │       │
Credit  PayPal  Crypto

  Observer: notify systems after payment
  ┌────────────────┐     notify      ┌─────────────┐
  │ PaymentService │────────────────→│ EmailService│
  │                │────────────────→│ Inventory   │
  │  strategy ─→   │────────────────→│ Analytics   │
  │  PaymentMethod │────────────────→│ Accounting  │
  └────────────────┘                 └─────────────┘

  The Strategy handles HOW to charge.
  The Observer handles WHO needs to know.
```

---

## Exercises

1. **Strategy**: Build a text formatter with strategies for
   markdown, HTML, and plain text. The same content renders
   differently based on the strategy.

2. **Observer**: Build a stock price ticker. Multiple displays
   (table, chart, alert) subscribe to price changes.

3. **Combined**: Create an authentication system where the Strategy
   determines how to authenticate (password, OAuth, biometric) and
   the Observer notifies logging, security monitoring, and session
   management after successful login.

4. **Refactor**: Find an if/else chain that selects behavior in
   your codebase. Refactor it to use Strategy.

---

[← Previous: Composite and Bridge](./08-composite-bridge.md) · [Next: Lesson 10 — Command and State →](./10-command-state.md)
