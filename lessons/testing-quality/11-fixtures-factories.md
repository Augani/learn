# Lesson 11: Fixtures, Factories, and Builders

> **The one thing to remember**: Test data setup is like preparing
> ingredients before cooking. Fixtures are pre-made ingredient kits
> (always the same), factories are recipes that produce fresh
> ingredients on demand (customizable), and builders let you assemble
> complex ingredients piece by piece. Pick the right tool for your
> test's complexity.

---

## The Meal Prep Analogy

```
THREE WAYS TO PREPARE TEST DATA

  FIXTURES (Meal Prep Sunday)
    Pre-made meals stored in containers.
    Same food every time. Quick to grab.
    "Here's the test user I always use."

  FACTORIES (Recipe Card)
    A recipe you follow to make fresh food.
    Can customize: "Make a salad, but hold the onions."
    "Make me a user, but this one should be an admin."

  BUILDERS (Build-Your-Own Bowl)
    Start with a base, add toppings one by one.
    Maximum control for complex objects.
    "Start with a user, add a subscription, add 3 orders..."
```

---

## Fixtures: Pre-Made Test Data

A fixture is a fixed set of test data that's set up before tests run.

### Python (pytest fixtures)

```python
import pytest

@pytest.fixture
def sample_user():
    return {
        "id": 1,
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "role": "user",
        "active": True,
    }

@pytest.fixture
def sample_products():
    return [
        {"id": 1, "name": "Widget", "price": 9.99, "stock": 100},
        {"id": 2, "name": "Gadget", "price": 24.99, "stock": 50},
        {"id": 3, "name": "Doohickey", "price": 4.99, "stock": 200},
    ]

def test_user_display_name(sample_user):
    display = format_display_name(sample_user)
    assert display == "Alice Johnson"

def test_filter_affordable_products(sample_products):
    affordable = filter_by_max_price(sample_products, max_price=10.00)
    assert len(affordable) == 2
    assert all(p["price"] <= 10.00 for p in affordable)
```

### Fixture Scoping

```python
@pytest.fixture(scope="function")
def fresh_db():
    """New database for EACH test. Slowest but safest."""
    db = create_test_database()
    yield db
    db.drop()

@pytest.fixture(scope="module")
def shared_db():
    """One database per test FILE. Faster, shared state risk."""
    db = create_test_database()
    yield db
    db.drop()

@pytest.fixture(scope="session")
def global_db():
    """One database for ALL tests. Fastest, most shared state."""
    db = create_test_database()
    yield db
    db.drop()
```

```
FIXTURE SCOPE TRADEOFFS

  Scope       Speed     Isolation    Use When
  ──────────────────────────────────────────────────
  function    Slow      Perfect      Tests modify data
  module      Medium    Shared       Tests only read data
  session     Fast      Most shared  Expensive setup (Docker)
```

### TypeScript (Vitest beforeEach)

```typescript
import { describe, it, expect, beforeEach } from "vitest";

interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
}

let testUser: User;
let testProducts: Product[];

beforeEach(() => {
  testUser = {
    id: 1,
    name: "Alice Johnson",
    email: "alice@example.com",
    role: "user",
  };

  testProducts = [
    { id: 1, name: "Widget", price: 9.99 },
    { id: 2, name: "Gadget", price: 24.99 },
  ];
});

it("formats user greeting", () => {
  expect(greet(testUser)).toBe("Hello, Alice Johnson!");
});
```

---

## Factories: Customizable Test Data

Factories create test data with sensible defaults that you can override.

### Python Factory Pattern

```python
def make_user(**overrides):
    defaults = {
        "id": 1,
        "name": "Test User",
        "email": "test@example.com",
        "role": "user",
        "active": True,
        "created_at": "2024-01-01T00:00:00Z",
    }
    return {**defaults, **overrides}

def make_product(**overrides):
    defaults = {
        "id": 1,
        "name": "Test Product",
        "price": 9.99,
        "stock": 100,
        "category": "general",
    }
    return {**defaults, **overrides}

def make_order(user=None, products=None, **overrides):
    if user is None:
        user = make_user()
    if products is None:
        products = [make_product()]

    defaults = {
        "id": 1,
        "user": user,
        "products": products,
        "status": "pending",
        "total": sum(p["price"] for p in products),
    }
    return {**defaults, **overrides}

def test_admin_can_cancel_any_order():
    admin = make_user(role="admin")
    order = make_order(status="confirmed")

    result = cancel_order(order, requested_by=admin)

    assert result["status"] == "cancelled"

def test_user_can_only_cancel_own_order():
    alice = make_user(id=1, name="Alice")
    bob = make_user(id=2, name="Bob")
    alices_order = make_order(user=alice)

    with pytest.raises(PermissionError):
        cancel_order(alices_order, requested_by=bob)
```

Notice how each test only specifies the data that matters for *that
test*. The factory fills in everything else. This makes tests readable:
you can see exactly what conditions the test is checking.

### Auto-Incrementing IDs

```python
_counters = {}

def next_id(entity_type):
    _counters.setdefault(entity_type, 0)
    _counters[entity_type] += 1
    return _counters[entity_type]

def make_user(**overrides):
    user_id = next_id("user")
    defaults = {
        "id": user_id,
        "name": f"User {user_id}",
        "email": f"user{user_id}@example.com",
        "role": "user",
        "active": True,
    }
    return {**defaults, **overrides}

def test_unique_users():
    user1 = make_user()
    user2 = make_user()
    assert user1["id"] != user2["id"]
    assert user1["email"] != user2["email"]
```

### TypeScript Factory

```typescript
let userIdCounter = 0;

function makeUser(overrides: Partial<User> = {}): User {
  userIdCounter++;
  return {
    id: userIdCounter,
    name: `User ${userIdCounter}`,
    email: `user${userIdCounter}@example.com`,
    role: "user",
    active: true,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    user: makeUser(),
    items: [makeProduct()],
    status: "pending",
    total: 0,
    ...overrides,
  };
}

it("applies discount for premium users", () => {
  const user = makeUser({ role: "premium" });
  const order = makeOrder({ user, total: 100 });

  const discounted = applyDiscount(order);

  expect(discounted.total).toBe(90);
});
```

---

## Builders: Complex Object Assembly

When objects have many optional fields and complex relationships, the
Builder pattern shines.

```python
class UserBuilder:
    def __init__(self):
        self._data = {
            "id": 1,
            "name": "Test User",
            "email": "test@example.com",
            "role": "user",
            "active": True,
            "addresses": [],
            "orders": [],
            "preferences": {},
        }

    def with_name(self, name):
        self._data["name"] = name
        self._data["email"] = f"{name.lower().replace(' ', '.')}@example.com"
        return self

    def as_admin(self):
        self._data["role"] = "admin"
        return self

    def inactive(self):
        self._data["active"] = False
        return self

    def with_address(self, street, city, state):
        self._data["addresses"].append({
            "street": street, "city": city, "state": state
        })
        return self

    def with_order(self, total, status="completed"):
        self._data["orders"].append({"total": total, "status": status})
        return self

    def with_preference(self, key, value):
        self._data["preferences"][key] = value
        return self

    def build(self):
        return dict(self._data)

def test_shipping_to_multiple_addresses():
    user = (
        UserBuilder()
        .with_name("Alice")
        .with_address("123 Main St", "Springfield", "IL")
        .with_address("456 Oak Ave", "Shelbyville", "IL")
        .build()
    )

    addresses = get_shipping_options(user)
    assert len(addresses) == 2

def test_loyal_customer_discount():
    customer = (
        UserBuilder()
        .with_name("Bob")
        .with_order(50.00)
        .with_order(75.00)
        .with_order(100.00)
        .build()
    )

    discount = calculate_loyalty_discount(customer)
    assert discount == 0.10
```

### TypeScript Builder

```typescript
class OrderBuilder {
  private order: Order = {
    id: 1,
    userId: 1,
    items: [],
    status: "pending",
    total: 0,
    couponCode: undefined,
    shippingMethod: "standard",
  };

  withItem(name: string, price: number, quantity: number = 1): this {
    this.order.items.push({ name, price, quantity });
    this.order.total += price * quantity;
    return this;
  }

  withCoupon(code: string): this {
    this.order.couponCode = code;
    return this;
  }

  withShipping(method: "standard" | "express" | "overnight"): this {
    this.order.shippingMethod = method;
    return this;
  }

  confirmed(): this {
    this.order.status = "confirmed";
    return this;
  }

  build(): Order {
    return { ...this.order, items: [...this.order.items] };
  }
}

it("calculates express shipping surcharge", () => {
  const order = new OrderBuilder()
    .withItem("Laptop", 999.99)
    .withShipping("express")
    .build();

  const total = calculateTotal(order);
  expect(total).toBe(999.99 + 15.0);
});
```

---

## Database Seeding

For integration tests that need data in a real database:

```python
@pytest.fixture
def seeded_db(db_connection):
    cursor = db_connection.cursor()

    cursor.execute("DELETE FROM orders")
    cursor.execute("DELETE FROM products")
    cursor.execute("DELETE FROM users")

    cursor.execute(
        "INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com')"
    )
    cursor.execute(
        "INSERT INTO products (id, name, price) VALUES (1, 'Widget', 9.99)"
    )
    cursor.execute(
        "INSERT INTO products (id, name, price) VALUES (2, 'Gadget', 24.99)"
    )

    db_connection.commit()
    yield db_connection

    cursor.execute("DELETE FROM orders")
    cursor.execute("DELETE FROM products")
    cursor.execute("DELETE FROM users")
    db_connection.commit()
```

**Prefer factories over fixed seeds** for most tests. Seeds create
hidden dependencies between tests. Factories make each test's data
explicit.

---

## Keeping Tests Independent

```
THE INDEPENDENCE RULE

  Each test must be able to:
    1. Run alone          (not depend on other tests)
    2. Run in any order   (not depend on execution sequence)
    3. Run in parallel    (not share mutable state)

  VIOLATIONS:

    test_1 creates user "alice@example.com"
    test_2 looks up "alice@example.com"    ← Depends on test_1!

  FIXES:

    Option A: Each test creates its own data
      test_1: create alice, test alice
      test_2: create its OWN alice, look up its OWN alice

    Option B: Use fixtures with proper cleanup
      @pytest.fixture(autouse=True)
      def clean_db(): ... yield ... cleanup ...

    Option C: Use transactions that roll back
      Each test runs in a transaction, rolled back after
```

---

## Choosing the Right Approach

```
DECISION GUIDE

  Simple data, few fields?
    → Plain objects / dictionaries
    user = {"name": "Alice", "email": "alice@example.com"}

  Same structure, varying values?
    → Factory functions
    user = make_user(role="admin")

  Complex objects with many optional parts?
    → Builder pattern
    order = OrderBuilder().withItem(...).withCoupon(...).build()

  Database integration tests?
    → Fixtures with cleanup OR factory + transaction rollback

  Shared across many test files?
    → Conftest fixtures (Python) or test utility module
```

---

## Exercises

1. **Build a factory**: Create a `make_product` factory function with
   sensible defaults. Use it to write 3 tests that each need slightly
   different product data.

2. **Builder pattern**: Implement an `InvoiceBuilder` with methods like
   `withLineItem()`, `withTax()`, `withDiscount()`, `forCustomer()`.
   Write tests that build invoices of varying complexity.

3. **Independence audit**: Look at an existing test suite. Can you run
   any single test in isolation? If not, identify the shared state and
   fix it using fixtures or factories.

4. **Fixture vs factory**: Take a test that uses a fixture (pre-made
   data). Convert it to use a factory. Which is more readable? Which
   makes the test's intent clearer?

---

[Next: Lesson 12 - Code Coverage Metrics](./12-code-coverage.md)
