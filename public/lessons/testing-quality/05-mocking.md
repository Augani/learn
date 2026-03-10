# Lesson 05: Mocking, Stubs, Fakes, and Spies

> **The one thing to remember**: Mocking is like using a crash test
> dummy instead of a real person. You replace real dependencies (databases,
> APIs, email services) with simple stand-ins that you control. This lets
> you test your code without needing the whole world to be running.

---

## The Stunt Double Analogy

In movies, actors have stunt doubles. The double looks enough like the
actor to fool the camera, but they're easier to control and don't get
hurt. Mocks are stunt doubles for your code's dependencies.

```
YOUR CODE IN THE REAL WORLD

  Your Function ──→ Database (might be down)
       │
       ├──→ Payment API (charges real money!)
       │
       └──→ Email Service (sends real emails!)

YOUR CODE IN TESTS (with mocks)

  Your Function ──→ Fake Database (in-memory, instant)
       │
       ├──→ Stub Payment API (always returns "success")
       │
       └──→ Spy Email Service (records what was sent)
```

---

## The Four Types of Test Doubles

People often say "mock" for everything, but there are actually four
distinct types, each with a different purpose:

```
TEST DOUBLE TYPES

  TYPE     WHAT IT DOES                  ANALOGY
  ──────────────────────────────────────────────────────────────
  Stub     Returns pre-programmed        A recorded voicemail:
           answers. Doesn't check         "The weather is sunny."
           how it's called.              Always gives the same answer.

  Mock     Records calls AND verifies    A security camera:
           they happened correctly.       records everything and
           Fails if not called right.    you check the tape later.

  Fake     A simplified working          A calculator app on
           implementation.               your phone instead of
           Actually computes things.     a scientific calculator.

  Spy      Wraps the REAL object.        A wiretap: the real
           Calls go through to the       phone call happens, but
           real code, but records them.  you're listening in.
```

Let's see each one in code:

### Stub: Returns Canned Data

```python
class StubWeatherService:
    def get_temperature(self, city):
        return 72.0

def test_outdoor_activity_recommendation():
    weather = StubWeatherService()
    recommender = ActivityRecommender(weather_service=weather)

    result = recommender.suggest("New York")

    assert result == "Perfect for outdoor activities!"
```

The stub doesn't care what city you ask about. It always says 72 degrees.
This lets you test the recommender logic without calling a real weather API.

### Mock: Verifies Interactions

```python
from unittest.mock import Mock

def test_order_sends_confirmation_email():
    email_service = Mock()

    order_processor = OrderProcessor(email_service=email_service)
    order_processor.process(order_id=123, email="alice@example.com")

    email_service.send.assert_called_once_with(
        to="alice@example.com",
        subject="Order #123 Confirmed",
        body=Mock()  # Don't care about exact body
    )
```

The mock checks that `send` was called with the right arguments. If your
code forgets to send the email, the test fails.

### Fake: Simplified Implementation

```python
class FakeUserRepository:
    def __init__(self):
        self.users = {}
        self.next_id = 1

    def create(self, name, email):
        user = {"id": self.next_id, "name": name, "email": email}
        self.users[self.next_id] = user
        self.next_id += 1
        return user

    def find_by_id(self, user_id):
        return self.users.get(user_id)

    def find_by_email(self, email):
        for user in self.users.values():
            if user["email"] == email:
                return user
        return None

def test_register_user():
    repo = FakeUserRepository()
    service = UserService(repository=repo)

    user = service.register("Alice", "alice@example.com")

    assert user["name"] == "Alice"
    found = repo.find_by_email("alice@example.com")
    assert found is not None
```

The fake is a real working implementation — just simpler than a database.
It uses a dictionary instead of SQL, but the behavior is correct.

### Spy: Wraps the Real Thing

```python
from unittest.mock import patch

class RealCalculator:
    def add(self, a, b):
        return a + b

def test_spy_on_real_calculator():
    calc = RealCalculator()

    with patch.object(calc, 'add', wraps=calc.add) as spy:
        result = calc.add(2, 3)

        assert result == 5
        spy.assert_called_once_with(2, 3)
```

The spy lets the real code run but records the call so you can verify it
happened.

---

## TypeScript Mocking

```typescript
import { describe, it, expect, vi } from "vitest";

interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

class OrderProcessor {
  constructor(private emailService: EmailService) {}

  async process(orderId: number, email: string): Promise<void> {
    await this.emailService.send(
      email,
      `Order #${orderId} Confirmed`,
      "Thank you for your order!"
    );
  }
}

describe("OrderProcessor", () => {
  it("sends confirmation email", async () => {
    const mockEmail: EmailService = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const processor = new OrderProcessor(mockEmail);
    await processor.process(123, "alice@example.com");

    expect(mockEmail.send).toHaveBeenCalledWith(
      "alice@example.com",
      "Order #123 Confirmed",
      "Thank you for your order!"
    );
  });

  it("handles email failure", async () => {
    const mockEmail: EmailService = {
      send: vi.fn().mockRejectedValue(new Error("SMTP down")),
    };

    const processor = new OrderProcessor(mockEmail);
    await expect(processor.process(123, "alice@example.com")).rejects.toThrow("SMTP down");
  });
});
```

---

## Dependency Injection: The Key to Testability

Mocking only works if you can swap dependencies. This is where
**dependency injection** comes in.

```
HARD TO TEST (dependency created inside)

  class OrderService:
      def process(self, order):
          db = PostgresDatabase()          ← Creates its own database!
          email = SendGridClient()          ← Creates its own email client!
          db.save(order)
          email.send(order.customer_email)

  How do you test this without a real database and email server?
  You can't easily.

EASY TO TEST (dependency injected)

  class OrderService:
      def __init__(self, db, email):       ← Receives dependencies
          self.db = db
          self.email = email

      def process(self, order):
          self.db.save(order)
          self.email.send(order.customer_email)

  In tests: pass fake db and mock email
  In production: pass real db and real email client
```

```
DEPENDENCY INJECTION DIAGRAM

  PRODUCTION:

    Real Database ──→ OrderService ←── Real EmailClient

  TESTING:

    Fake Database ──→ OrderService ←── Mock EmailClient

  Same OrderService code. Different dependencies.
  This is the entire trick.
```

### Go Example (interfaces make this natural)

```go
type UserStore interface {
    Save(user User) error
    FindByID(id string) (*User, error)
}

type UserService struct {
    store UserStore
}

func NewUserService(store UserStore) *UserService {
    return &UserService{store: store}
}

func (s *UserService) Register(name, email string) (*User, error) {
    user := User{ID: generateID(), Name: name, Email: email}
    if err := s.store.Save(user); err != nil {
        return nil, fmt.Errorf("failed to save user: %w", err)
    }
    return &user, nil
}

type FakeUserStore struct {
    users map[string]User
}

func (f *FakeUserStore) Save(user User) error {
    f.users[user.ID] = user
    return nil
}

func (f *FakeUserStore) FindByID(id string) (*User, error) {
    user, ok := f.users[id]
    if !ok {
        return nil, nil
    }
    return &user, nil
}

func TestRegisterUser(t *testing.T) {
    store := &FakeUserStore{users: make(map[string]User)}
    service := NewUserService(store)

    user, err := service.Register("Alice", "alice@example.com")

    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if user.Name != "Alice" {
        t.Errorf("expected name Alice, got %s", user.Name)
    }
    if len(store.users) != 1 {
        t.Errorf("expected 1 user in store, got %d", len(store.users))
    }
}
```

---

## When to Mock and When Not To

```
MOCK THESE                          DON'T MOCK THESE

External APIs (weather, payment)    Your own simple functions
Databases (when testing logic)      Data structures (lists, maps)
Email/SMS services                  Pure calculations
File system (when testing logic)    The thing you're testing!
Time/dates (for determinism)        Everything (over-mocking)
Random number generators            Value objects
```

### The Over-Mocking Antipattern

```python
def test_over_mocked():
    mock_user = Mock()
    mock_user.name = "Alice"
    mock_user.calculate_discount = Mock(return_value=10)
    mock_cart = Mock()
    mock_cart.total = Mock(return_value=100)
    mock_cart.apply_discount = Mock(return_value=90)

    result = checkout(mock_user, mock_cart)

    mock_cart.apply_discount.assert_called_with(10)
    assert result == 90
```

This test mocks everything. It's really just testing that your code
calls methods in the right order — not that the logic works. If someone
changes `calculate_discount` to return the wrong value, this test still
passes!

```python
def test_properly_tested():
    user = User("Alice", membership="gold")
    cart = ShoppingCart()
    cart.add_item(Product("Widget", price=100))

    result = checkout(user, cart)

    assert result.total == 90.0
    assert result.discount_applied == 10.0
```

This test uses real objects where possible and only mocks external
services. It actually verifies the math works.

---

## Mocking in Rust

Rust's type system makes mocking different. You typically use traits
and provide test implementations:

```rust
trait NotificationSender {
    fn send(&self, to: &str, message: &str) -> Result<(), String>;
}

struct EmailSender;

impl NotificationSender for EmailSender {
    fn send(&self, to: &str, message: &str) -> Result<(), String> {
        // Real email sending logic
        Ok(())
    }
}

struct FakeSender {
    sent: std::cell::RefCell<Vec<(String, String)>>,
}

impl FakeSender {
    fn new() -> Self {
        FakeSender { sent: std::cell::RefCell::new(Vec::new()) }
    }

    fn messages(&self) -> Vec<(String, String)> {
        self.sent.borrow().clone()
    }
}

impl NotificationSender for FakeSender {
    fn send(&self, to: &str, message: &str) -> Result<(), String> {
        self.sent.borrow_mut().push((to.to_string(), message.to_string()));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sends_welcome_notification() {
        let sender = FakeSender::new();
        let service = UserService::new(&sender);

        service.register("alice@example.com").unwrap();

        let messages = sender.messages();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].0, "alice@example.com");
        assert!(messages[0].1.contains("Welcome"));
    }
}
```

---

## Exercises

1. **Identify the double**: For each scenario, which test double type
   (stub, mock, fake, spy) would you use?
   - Testing that a function calls a logging service
   - Testing business logic that needs user data
   - Testing that the real code runs but tracking calls
   - Testing code that reads from a database

2. **Refactor for testability**: Take a function that creates its own
   database connection inside. Refactor it to accept the connection as a
   parameter instead. Write a test using a fake.

3. **Over-mock detector**: Review a test that uses more than 3 mocks. Is
   each mock necessary? Could any be replaced with a real object?

4. **Go interfaces**: Write a Go interface for a `Cache` (Get, Set,
   Delete methods). Implement a `FakeCache` using a map. Write tests
   for a service that uses the cache.

---

[Next: Lesson 06 - Integration Testing](./06-integration-testing.md)
