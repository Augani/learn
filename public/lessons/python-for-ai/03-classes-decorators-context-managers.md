# Lesson 03: Classes, Decorators & Context Managers

> Python OOP is like building with modular furniture.
> Decorators are add-on features. Context managers are self-closing doors.

---

## Classes: The Basics

If you're coming from Rust structs + impl blocks, Python classes combine
both into one unit. Like a blueprint for a house that includes both
the floor plan (data) and the instruction manual (methods).

```python
class Model:
    def __init__(self, name, version):
        self.name = name
        self.version = version
        self.layers = []

    def add_layer(self, layer_type, units):
        self.layers.append({"type": layer_type, "units": units})
        return self

    def summary(self):
        total = sum(layer["units"] for layer in self.layers)
        return f"{self.name} v{self.version}: {len(self.layers)} layers, {total} units"


net = Model("ResNet", "1.0")
net.add_layer("dense", 128).add_layer("dense", 64).add_layer("dense", 10)
print(net.summary())
```

```
  Rust                          Python
  ──────────────────            ──────────────────
  struct Model {                class Model:
      name: String,                 def __init__(self, ...):
      layers: Vec<Layer>,               self.name = ...
  }                                     self.layers = ...

  impl Model {                      def add_layer(self, ...):
      fn add_layer(&mut self)           ...
      fn summary(&self)             def summary(self):
  }                                     ...
```

---

## Dunder Methods (Magic Methods)

Dunder methods are like installing custom drivers for your class.
They tell Python how to handle your objects with built-in operations.
Like teaching a robot how to shake hands, introduce itself, and compare
itself to other robots.

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

    def __str__(self):
        return f"({self.x}, {self.y})"

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __mul__(self, scalar):
        return Vector(self.x * scalar, self.y * scalar)

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __len__(self):
        return 2

    def __getitem__(self, index):
        if index == 0:
            return self.x
        if index == 1:
            return self.y
        raise IndexError(f"Index {index} out of range for Vector")


v1 = Vector(1, 2)
v2 = Vector(3, 4)
print(v1 + v2)
print(v1 * 3)
print(v1 == Vector(1, 2))
print(f"x={v1[0]}, y={v1[1]}")
```

### Common Dunder Methods

```
  Method              Triggered By         Like...
  ─────────────────   ──────────────────   ───────────────────
  __init__            MyClass()            Constructor
  __repr__            repr(obj)            Debug display
  __str__             str(obj), print()    User display
  __len__             len(obj)             How big?
  __getitem__         obj[key]             Index/subscript
  __setitem__         obj[key] = val       Assign to index
  __contains__        item in obj          Membership test
  __iter__            for x in obj         Make iterable
  __call__            obj()                Call like function
  __eq__              obj == other         Equality check
  __lt__              obj < other          Less than
  __hash__            hash(obj)            Dict key / set member
  __enter__/__exit__  with obj:            Context manager
```

### Making a Class Iterable

```python
class DataLoader:
    def __init__(self, data, batch_size):
        self.data = data
        self.batch_size = batch_size

    def __len__(self):
        return (len(self.data) + self.batch_size - 1) // self.batch_size

    def __iter__(self):
        for i in range(0, len(self.data), self.batch_size):
            yield self.data[i:i + self.batch_size]


loader = DataLoader(list(range(10)), batch_size=3)
print(f"Batches: {len(loader)}")
for batch in loader:
    print(batch)
```

---

## Inheritance and Composition

Inheritance is like a family tree. Composition is like a toolbox.
In ML code, you'll see both, but composition tends to win for
flexibility.

```python
class BaseTrainer:
    def __init__(self, model, optimizer):
        self.model = model
        self.optimizer = optimizer
        self.history = []

    def train_step(self, batch):
        raise NotImplementedError

    def fit(self, data, epochs):
        for epoch in range(epochs):
            for batch in data:
                loss = self.train_step(batch)
                self.history.append(loss)
            avg = sum(self.history[-len(data):]) / len(data)
            print(f"Epoch {epoch + 1}: avg_loss={avg:.4f}")


class SimpleTrainer(BaseTrainer):
    def train_step(self, batch):
        return sum(batch) / len(batch) * 0.9
```

### Composition Over Inheritance

```python
class EarlyStopping:
    def __init__(self, patience):
        self.patience = patience
        self.best_loss = float("inf")
        self.counter = 0

    def should_stop(self, loss):
        if loss < self.best_loss:
            self.best_loss = loss
            self.counter = 0
            return False
        self.counter += 1
        return self.counter >= self.patience


class Trainer:
    def __init__(self, callbacks=None):
        self.callbacks = callbacks or []

    def fit(self, data, epochs):
        for epoch in range(epochs):
            loss = sum(data) / len(data) * (0.9 ** epoch)
            print(f"Epoch {epoch + 1}: loss={loss:.4f}")
            for cb in self.callbacks:
                if hasattr(cb, "should_stop") and cb.should_stop(loss):
                    print("Early stopping triggered")
                    return


stopper = EarlyStopping(patience=3)
trainer = Trainer(callbacks=[stopper])
trainer.fit([1.0, 0.8, 0.6], epochs=20)
```

---

## Decorators

Decorators are like gift wrapping. You take an existing function,
wrap it with extra behavior, and it still looks like the same function
from the outside.

```
  Without decorator:        With decorator:
  ┌────────────────┐        ┌────────────────┐
  │   function()   │        │  ┌──────────┐  │
  │                │   =>   │  │ function()│  │
  │                │        │  └──────────┘  │
  └────────────────┘        │   wrapper      │
                            └────────────────┘
```

```python
import time
import functools

def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper


@timer
def slow_operation():
    time.sleep(0.1)
    return "done"

result = slow_operation()
print(result)
```

### Decorator with Arguments

Like gift wrapping with options - you choose the paper first,
then wrap the gift.

```python
import functools

def retry(max_attempts, delay=0):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as exc:
                    last_exception = exc
                    print(f"Attempt {attempt}/{max_attempts} failed: {exc}")
                    if delay and attempt < max_attempts:
                        time.sleep(delay)
            raise last_exception
        return wrapper
    return decorator


@retry(max_attempts=3, delay=0.1)
def flaky_api_call():
    import random
    if random.random() < 0.7:
        raise ConnectionError("Server busy")
    return {"status": "ok"}

try:
    result = flaky_api_call()
    print(result)
except ConnectionError:
    print("All attempts failed")
```

### Class-Based Decorators

```python
class CacheResult:
    def __init__(self, func):
        functools.update_wrapper(self, func)
        self.func = func
        self.cache = {}

    def __call__(self, *args):
        if args not in self.cache:
            self.cache[args] = self.func(*args)
        return self.cache[args]

    def clear(self):
        self.cache.clear()


@CacheResult
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(30))
print(f"Cache size: {len(fibonacci.cache)}")
```

### Built-in Decorators You'll Use

```python
class Dataset:
    def __init__(self, data):
        self._data = data
        self._processed = None

    @property
    def size(self):
        return len(self._data)

    @staticmethod
    def from_file(path):
        with open(path) as f:
            return Dataset(f.readlines())

    @classmethod
    def empty(cls):
        return cls([])

    @functools.cached_property
    def processed(self):
        print("Processing (only runs once)...")
        return [x * 2 for x in self._data]


ds = Dataset([1, 2, 3])
print(ds.size)
print(ds.processed)
print(ds.processed)
```

---

## Context Managers

Context managers are like self-closing doors. You walk through,
do your thing, and the door closes behind you whether you walk
out normally or run out in a panic (exception).

```
  with open("file.txt") as f:     # Door opens (__enter__)
      data = f.read()              # Do your thing
                                   # Door closes (__exit__)
                                   # Even if an exception happened
```

### The Protocol

```python
class Timer:
    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.elapsed = time.perf_counter() - self.start
        print(f"Elapsed: {self.elapsed:.4f}s")
        return False


with Timer() as t:
    total = sum(range(1_000_000))
print(f"Result: {total}, took {t.elapsed:.4f}s")
```

### contextlib Shortcuts

```python
from contextlib import contextmanager

@contextmanager
def temporary_config(obj, **overrides):
    original = {}
    for key, value in overrides.items():
        original[key] = getattr(obj, key, None)
        setattr(obj, key, value)
    try:
        yield obj
    finally:
        for key, value in original.items():
            if value is None:
                delattr(obj, key)
            else:
                setattr(obj, key, value)


class Config:
    debug = False
    verbose = False

cfg = Config()
print(f"Before: debug={cfg.debug}")

with temporary_config(cfg, debug=True, verbose=True):
    print(f"Inside: debug={cfg.debug}, verbose={cfg.verbose}")

print(f"After: debug={cfg.debug}")
```

### Real-World: GPU Memory Management

```python
from contextlib import contextmanager

@contextmanager
def gpu_memory_scope(device_id=0):
    print(f"Allocating GPU {device_id} memory")
    try:
        yield device_id
    finally:
        print(f"Freeing GPU {device_id} memory")
        print("Running garbage collection")

with gpu_memory_scope(0) as device:
    print(f"Training on GPU {device}")
    print("Doing heavy computation...")
```

### Combining Context Managers

```python
from contextlib import ExitStack

files_to_process = ["data_a.txt", "data_b.txt", "data_c.txt"]

with ExitStack() as stack:
    print("Would open all files in one 'with' block")
    print("ExitStack closes them all, even if one fails")
```

---

## Protocols and Duck Typing

Python doesn't need interfaces. If it walks like a duck
and quacks like a duck, it's a duck. Your class just needs
the right methods.

```python
class InMemoryDataset:
    def __init__(self, items):
        self._items = items

    def __len__(self):
        return len(self._items)

    def __getitem__(self, idx):
        return self._items[idx]


def train_on_dataset(dataset):
    print(f"Dataset size: {len(dataset)}")
    for i in range(min(3, len(dataset))):
        print(f"Sample {i}: {dataset[i]}")


train_on_dataset(InMemoryDataset(["cat", "dog", "bird", "fish"]))
train_on_dataset(["also", "works", "with", "lists"])
```

---

## Exercises

1. **Custom Container**: Build a `SortedList` class that keeps items
   sorted after each insert. Implement `__len__`, `__getitem__`,
   `__contains__`, `__iter__`, and `__repr__`.

2. **Decorator Stack**: Write a `@validate_types` decorator that checks
   argument types against type hints at runtime. Apply it alongside
   `@timer` and verify both work together.

3. **Context Manager**: Create a `@contextmanager` function called
   `suppress_and_log` that catches specified exception types, logs them,
   and continues execution.

4. **Builder Pattern**: Create a `QueryBuilder` class where method calls
   chain (return `self`). Implement `select()`, `where()`, `limit()`,
   and `build()` that returns the SQL string.

5. **Protocol Compliance**: Write a class `CSVDataset` that implements
   the same protocol as PyTorch datasets (`__len__`, `__getitem__`).
   It should lazily read rows from a CSV file.

---

[Next: Lesson 04 - Type Hints & Modern Python ->](04-type-hints-modern-python.md)
