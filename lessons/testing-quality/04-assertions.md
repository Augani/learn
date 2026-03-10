# Lesson 04: Writing Good Assertions

> **The one thing to remember**: An assertion is the judge in your test.
> A bad assertion is a judge who says "something's wrong" without saying
> what. A good assertion says "I expected 42 but got 41 — the tax
> calculation is off by one cent." Write assertions that help you debug,
> not ones that make you hunt.

---

## The Thermometer Analogy

Imagine two thermometers:

```
BAD THERMOMETER                 GOOD THERMOMETER

  "Temperature is wrong"          "98.6°F expected, 101.3°F measured"

  Now what? You have no           Immediately useful. You know:
  idea what the temp is,          - What you expected
  what it should be, or           - What you got
  how far off it is.              - How far off (2.7° high)
```

Assertions are your thermometers. Every assertion should tell you three
things when it fails:

1. **What was expected** — the correct answer
2. **What actually happened** — what your code produced
3. **Where it went wrong** — enough context to find the bug

---

## Basic Assertions

Every testing framework provides assertion functions. Here's the core
set you'll use 90% of the time:

### Python (pytest)

```python
def test_equality():
    assert calculate_total([10, 20, 30]) == 60

def test_truthiness():
    assert is_valid_email("user@example.com")
    assert not is_valid_email("not-an-email")

def test_membership():
    fruits = ["apple", "banana", "cherry"]
    assert "banana" in fruits
    assert "mango" not in fruits

def test_type_checking():
    result = parse_config("settings.json")
    assert isinstance(result, dict)

def test_approximate_equality():
    assert abs(calculate_pi() - 3.14159) < 0.001

def test_exceptions():
    with pytest.raises(ValueError, match="too short"):
        validate_password("ab")

def test_none():
    assert find_user("nonexistent") is None
    assert find_user("alice") is not None
```

### TypeScript (Vitest / Jest)

```typescript
it("checks equality", () => {
  expect(calculateTotal([10, 20, 30])).toBe(60);
});

it("checks deep equality for objects", () => {
  expect(parseUser('{"name":"Alice"}')).toEqual({ name: "Alice" });
});

it("checks truthiness", () => {
  expect(isValidEmail("user@example.com")).toBeTruthy();
  expect(isValidEmail("nope")).toBeFalsy();
});

it("checks containment", () => {
  expect(["apple", "banana"]).toContain("banana");
  expect("hello world").toContain("world");
});

it("checks approximate equality", () => {
  expect(calculatePi()).toBeCloseTo(3.14159, 4);
});

it("checks exceptions", () => {
  expect(() => validatePassword("ab")).toThrow("too short");
});

it("checks null/undefined", () => {
  expect(findUser("nonexistent")).toBeNull();
  expect(findUser("alice")).toBeDefined();
});
```

---

## toBe vs toEqual: A Critical Distinction

This trips up almost every beginner:

```typescript
const a = { name: "Alice" };
const b = { name: "Alice" };

expect(a).toBe(b);    // FAILS! Different objects in memory
expect(a).toEqual(b);  // PASSES! Same contents

expect(5).toBe(5);     // PASSES for primitives
expect("hi").toBe("hi"); // PASSES for primitives
```

```
toBe vs toEqual

  toBe:    "Are these the SAME object?" (reference equality)
           Like asking "Is this the EXACT SAME book?" (same copy)

  toEqual: "Do these have the SAME contents?" (deep equality)
           Like asking "Do these books have the same words?" (any copy)

  USE toBe FOR:        USE toEqual FOR:
  numbers              objects
  strings              arrays
  booleans             nested structures
  null/undefined       anything with {}
```

Python handles this more simply:

```python
a = {"name": "Alice"}
b = {"name": "Alice"}

assert a == b       # PASSES (== checks value equality in Python)
assert a is not b   # PASSES (is checks identity/reference)
```

---

## Error Messages That Help

The number one mistake in assertions is writing ones that produce
useless failure messages.

```python
assert result  # BAD: "AssertionError" — tells you NOTHING

assert result == 42  # BETTER: "assert 41 == 42" — you see both values

assert result == 42, f"Tax calculation returned {result}, expected 42 for $500 at 8.4%"
# BEST: Full context for debugging
```

### Custom Messages in Python

```python
def test_shipping_calculation():
    orders = [
        {"weight": 1.0, "expected": 5.99},
        {"weight": 5.0, "expected": 9.99},
        {"weight": 10.0, "expected": 14.99},
    ]

    for order in orders:
        result = calculate_shipping(order["weight"])
        expected = order["expected"]
        assert result == expected, (
            f"Shipping for {order['weight']}kg: "
            f"expected ${expected}, got ${result}"
        )
```

### Custom Messages in TypeScript

```typescript
it("calculates shipping for various weights", () => {
  const cases = [
    { weight: 1.0, expected: 5.99 },
    { weight: 5.0, expected: 9.99 },
    { weight: 10.0, expected: 14.99 },
  ];

  for (const { weight, expected } of cases) {
    const result = calculateShipping(weight);
    expect(result).toBe(expected);
  }
});
```

Vitest and Jest automatically generate helpful messages for `expect()`,
showing both expected and received values with a colored diff.

---

## Custom Matchers

When you find yourself writing the same complex assertions repeatedly,
create a custom matcher.

### Python: Custom Assertion Helpers

```python
def assert_valid_user(user):
    assert user is not None, "User should not be None"
    assert isinstance(user.get("id"), int), f"User ID should be int, got {type(user.get('id'))}"
    assert len(user.get("name", "")) > 0, "User name should not be empty"
    assert "@" in user.get("email", ""), f"User email invalid: {user.get('email')}"

def test_create_user():
    user = create_user("Alice", "alice@example.com")
    assert_valid_user(user)

def test_fetch_user():
    user = fetch_user(1)
    assert_valid_user(user)
```

### TypeScript: Custom Vitest Matchers

```typescript
expect.extend({
  toBeValidUser(received) {
    const pass =
      received !== null &&
      typeof received.id === "number" &&
      received.name.length > 0 &&
      received.email.includes("@");

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${JSON.stringify(received)} not to be a valid user`
          : `Expected a valid user but got ${JSON.stringify(received)}`,
    };
  },
});

it("creates a valid user", () => {
  const user = createUser("Alice", "alice@example.com");
  expect(user).toBeValidUser();
});
```

---

## Assertion Patterns for Common Scenarios

### Testing Collections

```python
def test_search_returns_matching_items():
    results = search_products("wireless")

    assert len(results) > 0, "Search should return at least one result"
    assert len(results) <= 20, "Search should return at most 20 results"

    for product in results:
        assert "wireless" in product["name"].lower(), (
            f"Product '{product['name']}' doesn't match search term"
        )

def test_sort_preserves_all_elements():
    original = [3, 1, 4, 1, 5, 9, 2, 6]
    sorted_list = my_sort(original)

    assert len(sorted_list) == len(original)
    assert set(sorted_list) == set(original)
    assert sorted_list == sorted(original)
```

### Testing Floating Point Numbers

```
FLOATING POINT COMPARISON

  Never do this:   assert 0.1 + 0.2 == 0.3      FAILS!
                   (0.1 + 0.2 = 0.30000000000000004)

  Do this instead: assert abs((0.1 + 0.2) - 0.3) < 1e-9
  Or use built-in: expect(0.1 + 0.2).toBeCloseTo(0.3)
                   assert 0.1 + 0.2 == pytest.approx(0.3)
```

```python
import pytest

def test_circle_area():
    area = calculate_area(radius=5)
    assert area == pytest.approx(78.5398, rel=1e-4)
```

```typescript
it("calculates circle area", () => {
  expect(calculateArea(5)).toBeCloseTo(78.5398, 2);
});
```

### Testing Exceptions with Specific Messages

```python
def test_password_too_short():
    with pytest.raises(ValueError) as exc_info:
        validate_password("ab")

    assert "at least 8 characters" in str(exc_info.value)
    assert exc_info.value.args[0].startswith("Password must be")

def test_password_missing_uppercase():
    with pytest.raises(ValueError, match="uppercase letter"):
        validate_password("alllowercase123")
```

```typescript
it("rejects short passwords with helpful message", () => {
  expect(() => validatePassword("ab")).toThrow(
    expect.objectContaining({
      message: expect.stringContaining("at least 8 characters"),
    })
  );
});
```

---

## Assertion Antipatterns

```
ANTIPATTERNS TO AVOID

  1. BOOLEAN TRAP
     assert is_valid(input) == True    ← Redundant
     assert is_valid(input)            ← Just do this

  2. MAGIC NUMBERS
     assert len(results) == 7          ← Why 7?
     assert len(results) == len(expected_items)  ← Much clearer

  3. ASSERTING IMPLEMENTATION
     assert mock.called_with("SELECT * FROM users")  ← Too coupled
     assert user.name == "Alice"       ← Test behavior, not SQL

  4. NO ASSERTION AT ALL
     def test_something():
         result = do_thing()
         # Forgot to assert! Test always passes.

  5. TOO MANY UNRELATED ASSERTIONS
     def test_everything():
         assert user.name == "Alice"
         assert product.price == 9.99    ← Different concept
         assert order.status == "shipped" ← Different concept
```

---

## The Assertion Cheat Sheet

```
COMMON ASSERTIONS ACROSS LANGUAGES

  Concept              Python (pytest)          TypeScript (Vitest)
  ─────────────────────────────────────────────────────────────────
  Equality             assert x == 42           expect(x).toBe(42)
  Deep equality        assert x == {"a": 1}     expect(x).toEqual({a:1})
  Truthiness           assert x                 expect(x).toBeTruthy()
  Falsiness            assert not x             expect(x).toBeFalsy()
  None/null            assert x is None         expect(x).toBeNull()
  Not none/null        assert x is not None     expect(x).toBeDefined()
  Contains             assert "hi" in s         expect(s).toContain("hi")
  Greater than         assert x > 5             expect(x).toBeGreaterThan(5)
  Approximate          assert x == approx(3.14) expect(x).toBeCloseTo(3.14)
  Raises/throws        pytest.raises(Error)     expect(fn).toThrow(Error)
  Type check           assert isinstance(x, T)  expect(x).toBeInstanceOf(T)
  Matches regex        assert re.match(p, s)    expect(s).toMatch(/pattern/)
  List length          assert len(xs) == 3      expect(xs).toHaveLength(3)
```

---

## Exercises

1. **Fix bad assertions**: Rewrite these to produce helpful failure
   messages:
   ```python
   assert result
   assert len(items) == 3
   assert x == True
   ```

2. **Custom matcher**: Write a custom assertion helper `assert_valid_email`
   that checks format, produces a clear error message, and handles None
   input.

3. **Floating point**: Write tests for a function that converts Celsius
   to Fahrenheit. Use approximate equality. Test with 0, 100, -40, and
   37 degrees.

4. **Collection assertions**: Write tests for a function that returns
   the top N items from a list. Assert on: the count, ordering, and
   that all returned items exist in the original list.

---

[Next: Lesson 05 - Mocking, Stubs, Fakes, and Spies](./05-mocking.md)
