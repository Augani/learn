# Lesson 09: Property-Based Testing

> **The one thing to remember**: Instead of testing specific examples
> ("add(2, 3) should be 5"), property-based testing says "for *any* two
> numbers a and b, add(a, b) should equal add(b, a)." The testing
> framework generates hundreds of random inputs to try to break your
> code. It's like hiring a chaos monkey to press every button.

---

## The Taste-Tester vs Food Inspector Analogy

Traditional tests (example-based) are like tasting a few specific
dishes: "The tomato soup is good, the Caesar salad is good."

Property-based tests are like a food inspector who checks fundamental
rules: "Every dish must be served at safe temperature. No dish should
contain allergens that aren't listed. Every plate must be clean."

```
EXAMPLE-BASED TESTING               PROPERTY-BASED TESTING

  "sort([3,1,2]) == [1,2,3]"        "For ANY list:"
  "sort([]) == []"                    - Output has same length as input
  "sort([1]) == [1]"                  - Output contains same elements
                                      - Each element <= the next
  Tests 3 specific cases.
                                     Tests HUNDREDS of random cases,
                                     including ones you'd never think of.
```

---

## What Is a Property?

A property is a rule that must hold true for ALL valid inputs, not just
specific examples.

```
PROPERTIES OF COMMON OPERATIONS

  SORT:
    1. Output length == input length
    2. Output contains the same elements as input
    3. Each element is <= the next element
    4. Sorting a sorted list returns the same list

  ENCODE/DECODE:
    1. decode(encode(x)) == x  (round-trip property)
    2. encode output is always valid format

  SERIALIZE/DESERIALIZE:
    1. deserialize(serialize(obj)) == obj

  REVERSE:
    1. reverse(reverse(list)) == list
    2. length doesn't change

  ADD:
    1. a + b == b + a          (commutative)
    2. (a + b) + c == a + (b + c)  (associative)
    3. a + 0 == a              (identity)
```

---

## Python: Hypothesis

Hypothesis is the premier property-based testing library for Python.

```python
from hypothesis import given
from hypothesis.strategies import integers, lists, text

def sort_list(items):
    return sorted(items)

@given(lists(integers()))
def test_sort_preserves_length(xs):
    assert len(sort_list(xs)) == len(xs)

@given(lists(integers()))
def test_sort_preserves_elements(xs):
    sorted_xs = sort_list(xs)
    assert sorted(sorted_xs) == sorted(xs)

@given(lists(integers()))
def test_sort_is_ordered(xs):
    sorted_xs = sort_list(xs)
    for i in range(len(sorted_xs) - 1):
        assert sorted_xs[i] <= sorted_xs[i + 1]

@given(lists(integers()))
def test_sort_is_idempotent(xs):
    once = sort_list(xs)
    twice = sort_list(once)
    assert once == twice
```

When you run this, Hypothesis generates hundreds of random lists:
empty lists, single-element lists, lists with duplicates, lists with
negative numbers, huge lists, etc. If *any* input breaks a property,
Hypothesis finds it.

### Testing a Real Function

```python
from hypothesis import given
from hypothesis.strategies import text, emails

def normalize_email(email):
    local, domain = email.split("@")
    return f"{local.lower()}@{domain.lower()}"

@given(emails())
def test_normalized_email_is_lowercase(email):
    result = normalize_email(email)
    assert result == result.lower()

@given(emails())
def test_normalize_is_idempotent(email):
    once = normalize_email(email)
    twice = normalize_email(once)
    assert once == twice

@given(emails())
def test_normalize_preserves_at_sign(email):
    result = normalize_email(email)
    assert "@" in result
    assert result.count("@") == 1
```

---

## TypeScript: fast-check

```typescript
import { describe, it, expect } from "vitest";
import fc from "fast-check";

function reverseString(s: string): string {
  return s.split("").reverse().join("");
}

describe("reverseString properties", () => {
  it("reversing twice returns the original", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(reverseString(reverseString(s))).toBe(s);
      })
    );
  });

  it("preserves length", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(reverseString(s).length).toBe(s.length);
      })
    );
  });

  it("first char becomes last char", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (s) => {
          const reversed = reverseString(s);
          expect(reversed[reversed.length - 1]).toBe(s[0]);
        }
      )
    );
  });
});
```

### Testing JSON Serialization Round-Trip

```typescript
describe("JSON round-trip", () => {
  it("serialize then deserialize returns original", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string(),
          age: fc.integer({ min: 0, max: 150 }),
          active: fc.boolean(),
          tags: fc.array(fc.string()),
        }),
        (user) => {
          const json = JSON.stringify(user);
          const parsed = JSON.parse(json);
          expect(parsed).toEqual(user);
        }
      )
    );
  });
});
```

---

## Shrinking: Finding the Minimal Failing Case

When a property-based test finds a failure, it doesn't just show you the
giant random input that failed. It **shrinks** the input to the smallest
possible example that still fails.

```
SHRINKING IN ACTION

  Test: "sorted output should have no duplicates"
  (This property is WRONG — sorted lists CAN have duplicates)

  Step 1: Hypothesis generates [847, -23, 102, 847, 5, -7, 847]
          Test fails!

  Step 2: Hypothesis shrinks the input:
          [847, 847]         Still fails
          [0, 0]             Still fails (simpler numbers)
          [0, 0]             Can't shrink further

  Final report:
    "Falsifying example: [0, 0]"

  Instead of debugging with a 7-element list of random numbers,
  you get the SIMPLEST possible counterexample.
```

```python
from hypothesis import given
from hypothesis.strategies import lists, integers

@given(lists(integers(), min_size=1))
def test_max_is_in_list(xs):
    maximum = max(xs)
    xs.remove(maximum)
    assert maximum not in xs

"""
This test claims: after removing the max, it shouldn't appear again.
But what about duplicates? [5, 5] → max is 5, remove one 5,
5 is still in the list!

Hypothesis finds this and shrinks to: [0, 0]
The simplest counterexample possible.
"""
```

---

## Strategies: Generating Test Data

Strategies are recipes for generating random data. You combine simple
strategies to build complex ones.

```python
from hypothesis import strategies as st

st.integers()
st.integers(min_value=0, max_value=100)
st.floats(allow_nan=False)
st.text(min_size=1, max_size=50)
st.booleans()
st.none()
st.emails()
st.datetimes()

st.lists(st.integers())
st.lists(st.text(), min_size=1, max_size=10)

st.tuples(st.text(), st.integers())

st.dictionaries(
    keys=st.text(min_size=1),
    values=st.integers()
)

st.one_of(st.integers(), st.text(), st.none())

@st.composite
def user_strategy(draw):
    name = draw(st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=("L",))))
    age = draw(st.integers(min_value=0, max_value=150))
    email = draw(st.emails())
    return {"name": name, "age": age, "email": email}
```

```typescript
fc.integer()
fc.integer({ min: 0, max: 100 })
fc.float({ noNaN: true })
fc.string()
fc.string({ minLength: 1, maxLength: 50 })
fc.boolean()
fc.constant(null)
fc.emailAddress()
fc.date()

fc.array(fc.integer())
fc.array(fc.string(), { minLength: 1, maxLength: 10 })

fc.tuple(fc.string(), fc.integer())

fc.record({
  name: fc.string({ minLength: 1 }),
  age: fc.integer({ min: 0, max: 150 }),
  active: fc.boolean(),
})

fc.oneof(fc.integer(), fc.string(), fc.constant(null))
```

---

## Common Properties to Test

```
PROPERTY PATTERNS

  ROUND-TRIP / INVERTIBILITY
    decode(encode(x)) == x
    deserialize(serialize(x)) == x
    fromString(toString(x)) == x

  IDEMPOTENCE
    f(f(x)) == f(x)
    sort(sort(list)) == sort(list)
    normalize(normalize(s)) == normalize(s)

  INVARIANTS
    len(sort(list)) == len(list)
    sum(split(total)) == total

  COMMUTATIVITY
    f(a, b) == f(b, a)
    merge(a, b) == merge(b, a)

  MONOTONICITY
    if a >= b then f(a) >= f(b)

  HARD TO PROVE, EASY TO CHECK
    isPrime(n) → no divisor between 2 and sqrt(n)
    isAnagram(a, b) → sorted(a) == sorted(b)

  TEST ORACLE
    mySort(list) == standardLibrarySort(list)
    myCompress(data) → decompress gives back original
```

---

## When to Use Property-Based Testing

```
GREAT FIT                          POOR FIT

Serialization / parsing            UI behavior
Mathematical operations            Complex business workflows
Data transformations               Tests needing specific examples
Anything with round-trip property   Code with many side effects
Fuzz testing for robustness         Slow-running functions
Algorithm correctness               Exploratory testing
```

---

## Combining Example and Property Tests

Property-based tests don't replace example-based tests. They complement
each other:

```python
def test_specific_known_case():
    assert encode_base64("hello") == "aGVsbG8="

@given(st.binary())
def test_round_trip_property(data):
    assert decode_base64(encode_base64(data)) == data

@given(st.binary())
def test_output_is_valid_base64(data):
    encoded = encode_base64(data)
    assert all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=" for c in encoded)
```

Example tests document known behaviors. Property tests explore the
unknown edges.

---

## Exercises

1. **Find properties**: For each function, list at least 2 properties:
   - `abs(n)` (absolute value)
   - `unique(list)` (remove duplicates)
   - `compress(data)` / `decompress(data)`

2. **Write property tests**: Use Hypothesis or fast-check to test a
   `clamp(value, min, max)` function. Properties: result is always
   between min and max, clamping an already-clamped value doesn't
   change it, clamping min returns min, clamping max returns max.

3. **Find a bug**: Write a slightly buggy sort function (e.g., one that
   drops duplicates). Use property-based tests to find the bug
   automatically.

4. **Custom strategy**: Build a strategy that generates valid credit card
   numbers using the Luhn algorithm. Use it to property-test a credit
   card validator.

---

[Next: Lesson 10 - Snapshot and Golden File Testing](./10-snapshot-testing.md)
