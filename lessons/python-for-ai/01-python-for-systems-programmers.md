# Lesson 01: Python for Systems Programmers

> You know how to drive stick (Rust/C/Go). Python is an automatic.
> Same destination, fewer pedals, different tradeoffs.

---

## What Makes Python Different

If compiled languages are building with LEGO Technic (precise, structured,
every piece has a specific socket), Python is building with Play-Doh.
You shape things fast, but there's no compiler catching you if your
shape doesn't hold.

```
  Rust/C/Go                          Python
  ┌──────────────────────┐           ┌──────────────────────┐
  │ Compiled to machine  │           │ Interpreted bytecode │
  │ Static types         │           │ Dynamic types        │
  │ Manual/RAII memory   │           │ Garbage collected    │
  │ Zero-cost abstracts  │           │ Runtime overhead OK  │
  │ Ownership/borrowing  │           │ Reference counting   │
  │ Compile-time errors  │           │ Runtime errors       │
  └──────────────────────┘           └──────────────────────┘
```

---

## Dynamic Typing

In Rust, you declare types. In Python, values carry their types with them,
like luggage tags on suitcases at an airport.

```python
x = 42
x = "now I'm a string"
x = [1, 2, 3]
```

The variable `x` is just a name tag. It points to whatever object
you hand it. The object itself knows its type.

```python
x = 42
print(type(x))
print(id(x))

x = "hello"
print(type(x))
print(id(x))
```

Think of it like a parking spot. The spot (variable name) doesn't care
if you park a sedan or a truck there. The vehicle (object) knows what it is.

---

## The Memory Model

Python uses reference counting plus a cycle collector.
Like a library book system: each book tracks how many people
have checked it out. When nobody has it, it goes back on the shelf.

```
  x = [1, 2, 3]
  y = x

  ┌───┐     ┌───────────┐
  │ x │────>│ [1, 2, 3] │  refcount = 2
  └───┘     └───────────┘
  ┌───┐          ^
  │ y │──────────┘
  └───┘
```

```python
import sys

a = [1, 2, 3]
b = a
print(sys.getrefcount(a))

b = None
print(sys.getrefcount(a))
```

### Mutable vs Immutable

This is the single biggest gotcha for systems programmers.

```python
a = [1, 2, 3]
b = a
b.append(4)
print(a)

x = 42
y = x
y = 99
print(x)
```

Lists are mutable - `b = a` creates a shared reference, not a copy.
Integers are immutable - `y = 99` rebinds `y` to a new object.

Think of mutable objects like a shared Google Doc. Everyone with the link
sees the same changes. Immutable objects are like printed handouts -
each person gets their own copy.

```
  Immutable (safe to share)     Mutable (shared reference!)
  ─────────────────────────     ──────────────────────────
  int, float, str, tuple,      list, dict, set,
  frozenset, bytes              bytearray, objects
```

---

## The GIL (Global Interpreter Lock)

The GIL is like a talking stick in a meeting. Only one thread
can execute Python bytecode at a time, even on a 64-core machine.

```
  Thread 1: ████░░░░████░░░░████
  Thread 2: ░░░░████░░░░████░░░░
  GIL:      ─T1──T2──T1──T2──T1─

  Only ONE thread runs Python code at any moment.
  They take turns holding the GIL.
```

```python
import threading
import time

counter = 0

def increment():
    global counter
    for _ in range(1_000_000):
        counter += 1

t1 = threading.Thread(target=increment)
t2 = threading.Thread(target=increment)

t1.start()
t2.start()
t1.join()
t2.join()

print(f"Expected: 2000000, Got: {counter}")
```

The result will be wrong because `counter += 1` isn't atomic.
The GIL releases between bytecode instructions.

### When the GIL Doesn't Matter

- **I/O-bound work**: Threads release the GIL during I/O (network, disk)
- **C extensions**: NumPy, pandas release the GIL during computation
- **multiprocessing**: Separate processes, separate GILs

```python
import multiprocessing

def cpu_work(n):
    return sum(i * i for i in range(n))

if __name__ == "__main__":
    with multiprocessing.Pool(4) as pool:
        results = pool.map(cpu_work, [10_000_000] * 4)
    print(f"Total: {sum(results)}")
```

---

## Everything Is an Object

In C, an `int` is 4 bytes on the stack. In Python, an `int` is a full
object with methods, metadata, and heap allocation. Like the difference
between a raw number written on paper vs a number inside an envelope
with a return address and tracking number.

```python
x = 42
print(x.bit_length())
print(x.__add__(8))
print(dir(x)[:5])
```

Functions are objects too:

```python
def greet(name):
    return f"Hello, {name}"

fn = greet
print(fn("World"))
print(type(greet))
print(greet.__name__)
```

---

## Error Handling: Exceptions vs Result Types

Python uses exceptions where Rust uses `Result<T, E>`.
Think of exceptions like fire alarms - they interrupt everything
until someone handles them.

```
  Rust                          Python
  ─────────────────────         ─────────────────────
  Result<T, E>                  try/except
  Option<T>                     value or None
  .unwrap() panics              uncaught exception
  ? propagates errors           exceptions bubble up
  match on Result               except specific types
```

```python
def parse_config(raw):
    try:
        lines = raw.strip().split("\n")
        config = {}
        for line in lines:
            key, value = line.split("=")
            config[key.strip()] = value.strip()
        return config
    except ValueError as exc:
        raise ValueError(f"Bad config line: {exc}") from exc

good = "host = localhost\nport = 8080"
print(parse_config(good))

bad = "this has no equals sign"
try:
    parse_config(bad)
except ValueError as exc:
    print(f"Caught: {exc}")
```

### Exception Hierarchy

```
BaseException
 ├── KeyboardInterrupt
 ├── SystemExit
 └── Exception
      ├── ValueError
      ├── TypeError
      ├── KeyError
      ├── IndexError
      ├── FileNotFoundError
      ├── RuntimeError
      └── ... many more
```

Never catch bare `Exception` in production. It's like catching
every ball thrown at you including grenades.

---

## Pythonic Patterns for Systems Programmers

### EAFP vs LBYL

```python
data = {"name": "Alice", "age": 30}

if "name" in data:
    name = data["name"]
else:
    name = "Unknown"

try:
    name = data["name"]
except KeyError:
    name = "Unknown"

name = data.get("name", "Unknown")
```

Python prefers "ask forgiveness, not permission" (EAFP).

### Truthiness

Everything has a boolean value. Empty things are falsy.
Like checking if a box has anything in it - you don't count items,
you just peek inside.

```python
falsy_values = [None, 0, 0.0, "", [], {}, set(), False]
for val in falsy_values:
    print(f"{str(val):>10} -> {bool(val)}")
```

```python
results = []
if results:
    print("Got results")
else:
    print("No results")

name = "" or "default"
print(name)
```

---

## String Formatting

Python has evolved through several string formatting approaches.
F-strings are what you want.

```python
name = "Alice"
score = 95.678

print(f"Player: {name}, Score: {score:.1f}")
print(f"{'Header':=^40}")
print(f"Binary: {42:08b}")
print(f"Debug: {name!r}")

items = ["a", "b", "c"]
print(f"Items: {', '.join(items)}")
```

---

## Iteration Protocol

For loops in Python work on any iterable. Like a conveyor belt
at a sushi restaurant - you don't need to know how many plates
there are, you just grab the next one.

```python
for char in "hello":
    print(char, end=" ")
print()

for key, value in {"a": 1, "b": 2}.items():
    print(f"{key}={value}")

for index, item in enumerate(["x", "y", "z"]):
    print(f"{index}: {item}")
```

No index-based for loops needed. If you're writing
`for i in range(len(something))`, there's almost always a better way.

---

## Modules and Imports

Python modules are files. Packages are directories with `__init__.py`.
Like a filing cabinet: drawers are packages, folders inside are modules.

```
  myproject/
  ├── __init__.py
  ├── models/
  │   ├── __init__.py
  │   ├── user.py
  │   └── product.py
  └── utils/
      ├── __init__.py
      └── helpers.py
```

```python
import os
from pathlib import Path
from collections import defaultdict

print(os.getcwd())
print(Path.home())

counts = defaultdict(int)
counts["a"] += 1
print(dict(counts))
```

---

## Quick Comparison Table

```
  Concept          Rust/C                Python
  ──────────────   ───────────────────   ─────────────────
  Entry point      fn main()             if __name__ == "__main__":
  Null             Option<T> / NULL      None
  Strings          &str / String         str (immutable)
  Print debug      dbg!() / printf       print() / repr()
  Package mgr      cargo / make          pip / uv
  Build            cargo build           python script.py
  REPL             (none built-in)       python -i
  Linting          clippy / -Wall        ruff / pylint
  Formatting       rustfmt / clang-fmt   black / ruff format
```

---

## Exercises

1. **Reference vs Copy**: Create a nested list `matrix = [[1,2],[3,4]]`.
   Assign `clone = matrix[:]`. Modify `clone[0][0] = 99`.
   What happens to `matrix`? Why? Fix it with `copy.deepcopy()`.

2. **GIL Experiment**: Write a CPU-bound function that sums squares
   up to 10 million. Time it with 1 thread, then 4 threads, then
   4 processes. Compare the results.

3. **Exception Chaining**: Write a function `load_json_file(path)` that
   reads a JSON file. Chain exceptions so the caller sees both
   "file not found" and "invalid JSON" errors with context.

4. **Pythonic Rewrite**: Rewrite this C-style Python:
   ```python
   i = 0
   while i < len(items):
       if items[i] != "":
           result.append(items[i].upper())
       i += 1
   ```

5. **Object Inspection**: Given any object, write a function that prints
   its type, id, size in bytes (`sys.getsizeof`), and all non-dunder
   attributes.

---

[Next: Lesson 02 - Data Types, Comprehensions & Generators ->](02-data-types-comprehensions-generators.md)
