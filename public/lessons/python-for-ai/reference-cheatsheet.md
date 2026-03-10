# Reference: Python Cheatsheet for Systems Programmers

> Quick reference mapping systems programming concepts to Python.
> Organized by "I know how to do X in C/Rust/Go, how do I do it in Python?"

---

## Types and Memory

```
  C/Rust Type        Python Equivalent       Notes
  ──────────────     ──────────────────      ─────────────────
  int / i32          int                     Arbitrary precision
  float / f64        float                   Always 64-bit
  double             float                   Same as above
  char               str (length 1)          No separate char type
  char* / &str       str                     Immutable, UTF-8
  bool               bool                    True / False
  void               None                    Return type
  array[N]           list or tuple           Dynamic size
  struct             dataclass or dict       See below
  enum               Enum or IntEnum         import enum
  NULL / nullptr     None                    Nullable by default
```

---

## Data Structures

```python
from collections import defaultdict, Counter, deque
from dataclasses import dataclass, field
from typing import Optional

xs = [1, 2, 3]
xs.append(4)
xs.insert(0, 0)
xs.pop()

t = (1, 2, 3)

s = {1, 2, 3}
s.add(4)
s.discard(2)

d = {"key": "value", "count": 42}
d.get("missing", "default")

dd = defaultdict(list)
dd["group"].append("item")

counts = Counter(["a", "b", "a", "c", "a", "b"])

q = deque(maxlen=100)
q.append("new")
q.popleft()

@dataclass(frozen=True)
class Point:
    x: float
    y: float
    z: float = 0.0

@dataclass
class Config:
    learning_rate: float = 0.001
    epochs: int = 10
    layers: list[int] = field(default_factory=lambda: [64, 32])
```

---

## Control Flow

```python
if x > 0:
    pass
elif x == 0:
    pass
else:
    pass

result = "positive" if x > 0 else "non-positive"

for item in collection:
    pass

for i, item in enumerate(collection):
    pass

for key, value in dictionary.items():
    pass

for a, b in zip(list1, list2):
    pass

while condition:
    pass

match command:
    case "quit":
        exit()
    case "help":
        show_help()
    case str(cmd) if cmd.startswith("run"):
        execute(cmd)
    case _:
        unknown(command)
```

---

## Functions

```python
from typing import Callable, TypeVar
from functools import partial, reduce

def greet(name: str, greeting: str = "Hello") -> str:
    return f"{greeting}, {name}!"

def process(*args: int, **kwargs: str) -> None:
    pass

add = lambda a, b: a + b

squares = [x ** 2 for x in range(10)]
evens = [x for x in range(20) if x % 2 == 0]
flat = [item for sublist in nested for item in sublist]
pairs = {k: v for k, v in zip(keys, values)}

T = TypeVar("T")
def first(items: list[T]) -> Optional[T]:
    return items[0] if items else None

add_ten = partial(add, 10)
total = reduce(lambda a, b: a + b, [1, 2, 3, 4])
```

---

## Error Handling

```python
from pathlib import Path

try:
    result = risky_operation()
except ValueError as exc:
    print(f"Bad value: {exc}")
except (TypeError, KeyError):
    print("Type or key error")
except Exception as exc:
    print(f"Unexpected: {exc}")
    raise
finally:
    cleanup()

def divide(a: float, b: float) -> float:
    if b == 0:
        raise ZeroDivisionError("Cannot divide by zero")
    return a / b

class ModelNotTrainedError(Exception):
    pass

class InvalidDataError(Exception):
    def __init__(self, column: str, reason: str):
        self.column = column
        self.reason = reason
        super().__init__(f"Column '{column}': {reason}")
```

---

## Classes

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

class BaseModel(ABC):
    @abstractmethod
    def fit(self, X, y) -> "BaseModel":
        ...

    @abstractmethod
    def predict(self, X):
        ...

class LinearModel(BaseModel):
    def __init__(self, learning_rate: float = 0.01):
        self.learning_rate = learning_rate
        self.weights = None

    def fit(self, X, y) -> "LinearModel":
        self.weights = [0.0] * X.shape[1]
        return self

    def predict(self, X):
        if self.weights is None:
            raise ModelNotTrainedError("Call fit() first")
        return X @ self.weights

    def __repr__(self) -> str:
        return f"LinearModel(lr={self.learning_rate})"

    @property
    def is_fitted(self) -> bool:
        return self.weights is not None

    @classmethod
    def from_config(cls, config: dict) -> "LinearModel":
        return cls(**config)

    @staticmethod
    def validate_input(X) -> bool:
        return len(X.shape) == 2
```

---

## Context Managers and Decorators

```python
import time
from contextlib import contextmanager
from functools import wraps

@contextmanager
def timer(label: str = "Block"):
    start = time.perf_counter()
    yield
    elapsed = time.perf_counter() - start
    print(f"{label}: {elapsed:.3f}s")

with timer("Training"):
    train_model()

def retry(max_attempts: int = 3, delay: float = 1.0):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as exc:
                    if attempt == max_attempts - 1:
                        raise
                    time.sleep(delay)
        return wrapper
    return decorator

@retry(max_attempts=3, delay=0.5)
def fetch_data(url: str) -> dict:
    pass
```

---

## File I/O

```python
from pathlib import Path
import json
import csv
import pickle

path = Path("data/output")
path.mkdir(parents=True, exist_ok=True)

text = Path("file.txt").read_text(encoding="utf-8")
Path("file.txt").write_text("content", encoding="utf-8")

with open("data.json") as f:
    data = json.load(f)
with open("data.json", "w") as f:
    json.dump(data, f, indent=2)

with open("data.csv") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

with open("model.pkl", "wb") as f:
    pickle.dump(model, f)
with open("model.pkl", "rb") as f:
    model = pickle.load(f)

for filepath in Path("data").glob("*.csv"):
    print(filepath.stem)

Path("data").rglob("*.json")
```

---

## Concurrency

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

with ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(process_file, file_list))

with ProcessPoolExecutor(max_workers=4) as pool:
    futures = [pool.submit(heavy_compute, data) for data in chunks]
    results = [f.result() for f in futures]

async def fetch_all(urls: list[str]) -> list[str]:
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_one(session, url) for url in urls]
        return await asyncio.gather(*tasks)
```

---

## NumPy Quick Reference

```python
import numpy as np

a = np.zeros((3, 4))
b = np.ones((3, 4))
c = np.arange(0, 10, 0.5)
d = np.linspace(0, 1, 100)
e = np.random.randn(3, 4)

a.shape
a.dtype
a.reshape(4, 3)
a.T

a + b
a * b
a @ b.T
np.dot(a, b.T)

np.sum(a, axis=0)
np.mean(a, axis=1)
np.max(a)
np.argmax(a)

mask = a > 0
filtered = a[mask]
a[a < 0] = 0

np.concatenate([a, b], axis=0)
np.stack([a, b], axis=0)
np.split(a, 3, axis=0)
```

---

## String Formatting

```python
name = "model"
acc = 0.9543
epoch = 42

print(f"Epoch {epoch:04d}: {name} accuracy = {acc:.2%}")

print(f"{'Metric':<20} {'Value':>10}")
print(f"{'Accuracy':<20} {acc:>10.4f}")

big = 1_000_000
print(f"Samples: {big:,}")
```

---

## Common Gotchas for Systems Programmers

```
  GOTCHA                         FIX
  ──────────────────────         ────────────────────────────
  Mutable default args           Use None, set in body
  Shallow copy of lists          Use copy.deepcopy()
  Integer division               Use // for int, / for float
  Global Interpreter Lock        Use multiprocessing for CPU
  No switch/case before 3.10     Use match/case (3.10+)
  Everything is a reference      Explicit copy when needed
  Indentation matters            Use 4 spaces, never tabs
  No braces for blocks           Colon + indentation
```

```python
def bad_default(items: list = []):
    items.append(1)
    return items

def good_default(items: list | None = None):
    if items is None:
        items = []
    items.append(1)
    return items
```

---

## Virtual Environment Commands

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pip freeze > requirements.txt
deactivate

uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
```
