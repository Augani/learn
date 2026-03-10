# Quick Reference: Testing Patterns

> A cheat sheet for common testing patterns, assertion styles, and mock
> types. Bookmark this and refer back when writing tests.

---

## Test Structure Patterns

### Arrange-Act-Assert (AAA)

```python
def test_example():
    # ARRANGE: set up inputs and state
    cart = ShoppingCart()
    cart.add_item(Product("Widget", 9.99))

    # ACT: call the function under test
    total = cart.calculate_total()

    # ASSERT: verify the result
    assert total == 9.99
```

### Given-When-Then (BDD Style)

```python
def test_free_shipping_for_large_orders():
    # GIVEN a cart with items totaling over $100
    cart = ShoppingCart()
    cart.add_item(Product("Laptop", 999.99))

    # WHEN shipping is calculated
    shipping = cart.calculate_shipping()

    # THEN shipping is free
    assert shipping == 0.0
```

### Table-Driven Tests

```python
@pytest.mark.parametrize("input_val,expected", [
    (0, "zero"),
    (1, "positive"),
    (-1, "negative"),
    (100, "positive"),
    (-100, "negative"),
])
def test_classify_number(input_val, expected):
    assert classify(input_val) == expected
```

```go
func TestClassify(t *testing.T) {
    tests := []struct {
        name     string
        input    int
        expected string
    }{
        {"zero", 0, "zero"},
        {"positive", 1, "positive"},
        {"negative", -1, "negative"},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := classify(tt.input)
            if result != tt.expected {
                t.Errorf("classify(%d) = %s, want %s", tt.input, result, tt.expected)
            }
        })
    }
}
```

```typescript
it.each([
  [0, "zero"],
  [1, "positive"],
  [-1, "negative"],
])("classify(%i) returns %s", (input, expected) => {
  expect(classify(input)).toBe(expected);
});
```

---

## Test Double Quick Reference

```
TYPE       PURPOSE                         VERIFIES CALLS?

Stub       Return canned data              No
Mock       Record and verify interactions  Yes
Fake       Simplified implementation       No (but works correctly)
Spy        Wrap real object + record       Optional
```

### Stub

```python
class StubPriceService:
    def get_price(self, product_id):
        return 9.99
```

### Mock

```python
from unittest.mock import Mock

email = Mock()
send_receipt(email, order)
email.send.assert_called_once_with("user@example.com", subject="Receipt")
```

### Fake

```python
class FakeDatabase:
    def __init__(self):
        self.data = {}

    def save(self, key, value):
        self.data[key] = value

    def load(self, key):
        return self.data.get(key)
```

### Spy

```python
from unittest.mock import patch

with patch.object(real_service, 'process', wraps=real_service.process) as spy:
    real_service.process(data)
    spy.assert_called_once_with(data)
```

---

## Assertion Patterns

### Equality

```
Python:    assert x == 42
TS:        expect(x).toBe(42)
Go:        if x != 42 { t.Errorf(...) }
Rust:      assert_eq!(x, 42);
```

### Deep Equality (Objects/Structs)

```
Python:    assert user == {"name": "Alice", "age": 30}
TS:        expect(user).toEqual({ name: "Alice", age: 30 })
Go:        if !reflect.DeepEqual(user, expected) { ... }
Rust:      assert_eq!(user, expected);  // requires PartialEq
```

### Approximate (Floating Point)

```
Python:    assert x == pytest.approx(3.14, rel=1e-3)
TS:        expect(x).toBeCloseTo(3.14, 2)
Go:        if math.Abs(x - 3.14) > 0.01 { ... }
Rust:      assert!((x - 3.14).abs() < 0.01);
```

### Exceptions / Errors

```
Python:    with pytest.raises(ValueError, match="msg"): ...
TS:        expect(() => fn()).toThrow("msg")
Go:        if err == nil { t.Fatal("expected error") }
Rust:      assert!(result.is_err());
```

### Contains

```
Python:    assert "hello" in text
TS:        expect(text).toContain("hello")
Go:        if !strings.Contains(text, "hello") { ... }
Rust:      assert!(text.contains("hello"));
```

### Collection Length

```
Python:    assert len(items) == 3
TS:        expect(items).toHaveLength(3)
Go:        if len(items) != 3 { ... }
Rust:      assert_eq!(items.len(), 3);
```

### Truthiness

```
Python:    assert is_valid
TS:        expect(isValid).toBeTruthy()
Go:        if !isValid { ... }
Rust:      assert!(is_valid);
```

### Null / None

```
Python:    assert result is None
TS:        expect(result).toBeNull()
Go:        if result != nil { ... }
Rust:      assert!(result.is_none());
```

---

## Common Testing Patterns

### Factory Function

```python
def make_user(**overrides):
    defaults = {"name": "Test", "email": "test@example.com", "role": "user"}
    return {**defaults, **overrides}

admin = make_user(role="admin")
```

### Builder

```python
user = UserBuilder().with_name("Alice").as_admin().with_orders(3).build()
```

### Fixture (pytest)

```python
@pytest.fixture
def db():
    conn = create_connection(":memory:")
    yield conn
    conn.close()
```

### Transaction Rollback

```python
@pytest.fixture
def db_session(conn):
    tx = conn.begin()
    yield conn
    tx.rollback()
```

### Page Object (E2E)

```typescript
class LoginPage {
  constructor(private page: Page) {}
  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="submit"]');
  }
}
```

---

## Property-Based Testing Properties

```
PROPERTY               MEANING                   EXAMPLE

Round-trip             decode(encode(x)) == x    JSON, Base64, compression
Idempotent             f(f(x)) == f(x)           sort, normalize, dedupe
Commutative            f(a,b) == f(b,a)          add, merge, union
Invariant              property always holds      len preserved after sort
Monotonic              order preserved            if a > b then f(a) > f(b)
Oracle                 matches known-good impl   mySort(x) == stdlib.sort(x)
```

---

## Test Naming Conventions

```
Pattern:  test_[what]_[when]_[then]

  test_login_with_valid_credentials_succeeds
  test_login_with_wrong_password_returns_401
  test_cart_when_empty_has_zero_total
  test_order_with_insufficient_stock_raises_error

Pattern: should_[expected]_when_[condition]   (JS/TS style)

  should_return_user_when_id_exists
  should_throw_when_email_is_invalid
```

---

## Anti-Pattern Quick Reference

```
ANTI-PATTERN          WHAT IT IS                    FIX

Over-mocking          Mock everything, test nothing  Use real objects when cheap
Ice cream cone        Mostly E2E, few unit tests     Invert the pyramid
Flaky tests           Random pass/fail               Fix timing, isolate data
Shared state          Tests depend on each other     Independent test data
No assertions         Test runs but checks nothing   Always assert
Snapshot fatigue      Auto-update without review     Review every diff
Testing impl          Assert on HOW not WHAT         Test behavior
God test              One test checks everything     Split into focused tests
```

---

[Back to Roadmap](./00-roadmap.md)
