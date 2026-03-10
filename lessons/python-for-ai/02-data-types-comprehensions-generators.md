# Lesson 02: Data Types, Comprehensions & Generators

> Python's built-in data structures are like a Swiss Army knife.
> You'll use lists, dicts, and comprehensions in almost every ML script.

---

## Lists: The Workhorse

Lists are like a train with numbered cars. You can add cars, remove cars,
look at any car by number, and the order stays exactly as you set it.

```python
numbers = [10, 20, 30, 40, 50]

print(numbers[0])
print(numbers[-1])
print(numbers[1:3])
print(numbers[::2])
```

### Slicing is Powerful

```
   Index:    0    1    2    3    4
            ┌────┬────┬────┬────┬────┐
   Values:  │ 10 │ 20 │ 30 │ 40 │ 50 │
            └────┴────┴────┴────┴────┘
  Negative: -5   -4   -3   -2   -1

  numbers[1:4]   -> [20, 30, 40]   (start inclusive, end exclusive)
  numbers[:3]    -> [10, 20, 30]   (from beginning)
  numbers[2:]    -> [30, 40, 50]   (to end)
  numbers[::-1]  -> [50, 40, 30, 20, 10]  (reversed)
```

```python
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

first_column = [row[0] for row in matrix]
print(first_column)

flat = [val for row in matrix for val in row]
print(flat)
```

---

## Dictionaries: Key-Value Maps

Dictionaries are like a phone book. You look up a name (key)
and get a number (value). Since Python 3.7, they remember insertion order.

```python
model_config = {
    "name": "gpt-mini",
    "layers": 12,
    "hidden_size": 768,
    "vocab_size": 50257,
}

print(model_config["layers"])
print(model_config.get("dropout", 0.1))

model_config["learning_rate"] = 3e-4
print(model_config)
```

### Common Dict Patterns

```python
from collections import defaultdict, Counter

words = ["apple", "banana", "apple", "cherry", "banana", "apple"]

counts = Counter(words)
print(counts.most_common(2))

grouped = defaultdict(list)
records = [("a", 1), ("b", 2), ("a", 3), ("b", 4)]
for key, val in records:
    grouped[key].append(val)
print(dict(grouped))

config = {"a": 1, "b": 2}
overrides = {"b": 99, "c": 3}
merged = {**config, **overrides}
print(merged)

merged_pipe = config | overrides
print(merged_pipe)
```

---

## Sets: Unique Collections

Sets are like a bag of unique marbles. You can check what's in the bag
fast, combine bags, or find what two bags have in common.

```python
installed = {"numpy", "pandas", "torch"}
required = {"numpy", "pandas", "transformers", "datasets"}

missing = required - installed
print(f"Need to install: {missing}")

common = installed & required
print(f"Already have: {common}")

all_packages = installed | required
print(f"All packages: {all_packages}")
```

```
  Set Operations:
  ┌─────────┐   ┌─────────┐
  │  A - B   │   │  B - A   │     A - B  = only in A
  │    ┌─────┼───┼────┐    │     A & B  = in both
  │    │ A&B │   │    │    │     A | B  = in either
  └────┼─────┘   └────┼────┘     A ^ B  = in one but not both
       └──────────────┘
```

---

## Tuples: Immutable Sequences

Tuples are like sealed envelopes. Once you put items in,
you can't change them. Great for returning multiple values.

```python
point = (3.14, 2.71)
x, y = point
print(f"x={x}, y={y}")

def train_step(model, batch):
    loss = 0.5
    accuracy = 0.92
    return loss, accuracy

loss, acc = train_step(None, None)
print(f"Loss: {loss}, Accuracy: {acc}")
```

### Named Tuples

```python
from typing import NamedTuple

class TrainingResult(NamedTuple):
    loss: float
    accuracy: float
    epoch: int

result = TrainingResult(loss=0.23, accuracy=0.95, epoch=10)
print(f"Epoch {result.epoch}: loss={result.loss}")
```

---

## List Comprehensions

Comprehensions are like assembly lines. Raw materials go in one end,
a transformation happens, and finished products come out the other.

```python
squares = [x ** 2 for x in range(10)]
print(squares)

even_squares = [x ** 2 for x in range(10) if x % 2 == 0]
print(even_squares)

words = ["Hello", "World", "Python"]
lengths = {word: len(word) for word in words}
print(lengths)

unique_letters = {char.lower() for word in words for char in word}
print(sorted(unique_letters))
```

### Comprehension Anatomy

```
  [ expression  for item in iterable  if condition ]
    ──────────  ────────────────────  ────────────
    what to       where items          filter
    produce       come from            (optional)

  Assembly line analogy:
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Raw      │───>│ Filter   │───>│ Transform│───> Output
  │ Materials│    │ (if)     │    │ (expr)   │
  └──────────┘    └──────────┘    └──────────┘
```

### Nested Comprehensions

```python
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

transposed = [[row[i] for row in matrix] for i in range(3)]
print(transposed)

pairs = [(x, y) for x in range(3) for y in range(3) if x != y]
print(pairs)
```

---

## Generators: Lazy Sequences

Generators are like a TV series on a streaming service. Episodes exist
one at a time - you don't download the whole season. Each episode is
produced only when you press "next episode."

```python
def count_up(limit):
    n = 0
    while n < limit:
        yield n
        n += 1

for num in count_up(5):
    print(num, end=" ")
print()
```

### Generator Expressions

Like list comprehensions, but with parentheses. They produce values
lazily instead of building the entire list in memory.

```python
import sys

big_list = [x ** 2 for x in range(1_000_000)]
big_gen = (x ** 2 for x in range(1_000_000))

print(f"List size: {sys.getsizeof(big_list):,} bytes")
print(f"Generator size: {sys.getsizeof(big_gen):,} bytes")

total = sum(x ** 2 for x in range(1_000_000))
print(f"Sum: {total}")
```

### Real-World Generator: Reading Large Files

```python
def read_batches(filepath, batch_size=1000):
    batch = []
    with open(filepath) as f:
        for line in f:
            batch.append(line.strip())
            if len(batch) >= batch_size:
                yield batch
                batch = []
    if batch:
        yield batch
```

### Generator Pipelines

Chain generators like UNIX pipes. Each stage processes one item
at a time, so memory stays flat regardless of data size.

```python
def read_lines(text):
    for line in text.strip().split("\n"):
        yield line

def parse_numbers(lines):
    for line in lines:
        try:
            yield float(line)
        except ValueError:
            continue

def running_average(numbers):
    total = 0
    count = 0
    for num in numbers:
        total += num
        count += 1
        yield total / count

data = "10\n20\nbad\n30\n40"
pipeline = running_average(parse_numbers(read_lines(data)))
for avg in pipeline:
    print(f"{avg:.1f}")
```

```
  Generator Pipeline (like UNIX pipes):

  read_lines ──> parse_numbers ──> running_average ──> output
     │                │                  │
     │  "10\n20\n"    │  10.0, 20.0     │  10.0, 15.0
     │  one line      │  one float       │  one average
     │  at a time     │  at a time       │  at a time
```

---

## itertools: The Generator Toolkit

Think of `itertools` as LEGO pieces for building data pipelines.
Each function takes iterables in and produces iterables out.

```python
from itertools import chain, islice, groupby, product, combinations

combined = list(chain([1, 2], [3, 4], [5, 6]))
print(f"chain: {combined}")

first_five = list(islice(range(1000), 5))
print(f"islice: {first_five}")

grid = list(product("AB", range(3)))
print(f"product: {grid}")

combos = list(combinations([1, 2, 3, 4], 2))
print(f"combinations: {combos}")
```

### groupby for Data Processing

```python
from itertools import groupby
from operator import itemgetter

data = [
    {"type": "train", "loss": 0.5},
    {"type": "train", "loss": 0.3},
    {"type": "val", "loss": 0.6},
    {"type": "val", "loss": 0.55},
    {"type": "train", "loss": 0.2},
]

sorted_data = sorted(data, key=itemgetter("type"))
for group_name, items in groupby(sorted_data, key=itemgetter("type")):
    losses = [item["loss"] for item in items]
    print(f"{group_name}: avg_loss={sum(losses)/len(losses):.2f}")
```

### Infinite Generators

```python
from itertools import count, cycle, repeat

for i in count(10, step=5):
    if i > 30:
        break
    print(i, end=" ")
print()

colors = cycle(["red", "green", "blue"])
for _, color in zip(range(7), colors):
    print(color, end=" ")
print()
```

---

## Unpacking and Starred Expressions

Like opening a box and spreading its contents on a table.

```python
first, *middle, last = [1, 2, 3, 4, 5]
print(f"first={first}, middle={middle}, last={last}")

head, *tail = range(5)
print(f"head={head}, tail={tail}")

def train(lr, epochs, batch_size):
    print(f"lr={lr}, epochs={epochs}, batch={batch_size}")

params = [0.001, 10, 32]
train(*params)

config = {"lr": 0.001, "epochs": 10, "batch_size": 32}
train(**config)
```

---

## Sorting and Key Functions

```python
models = [
    {"name": "bert", "params": 110_000_000},
    {"name": "gpt2", "params": 1_500_000_000},
    {"name": "distilbert", "params": 66_000_000},
]

by_size = sorted(models, key=lambda m: m["params"])
for m in by_size:
    print(f"{m['name']}: {m['params']:,}")

print()

by_name = sorted(models, key=lambda m: m["name"])
for m in by_name:
    print(f"{m['name']}: {m['params']:,}")
```

---

## Exercises

1. **Comprehension Challenge**: Given a list of file paths, use a
   comprehension to extract only `.py` files and return a dict mapping
   filename (without extension) to full path.

2. **Generator Pipeline**: Write three generators: `read_csv_lines(text)`
   that yields rows, `filter_by_column(rows, col, value)` that filters,
   and `extract_column(rows, col)` that yields one column. Chain them.

3. **Set Operations**: Given two lists of package dependencies from
   different projects, find: shared deps, unique to each, and total
   unique deps. Do it with sets in one line each.

4. **itertools Puzzle**: Using `itertools.product`, generate all possible
   hyperparameter combinations for: learning_rate=[0.001, 0.01],
   batch_size=[16, 32, 64], optimizer=["adam", "sgd"].

5. **Memory Comparison**: Create a function that processes numbers 1
   to 10 million. Implement it with a list, then a generator. Compare
   memory usage using `sys.getsizeof` and `tracemalloc`.

---

[Next: Lesson 03 - Classes, Decorators & Context Managers ->](03-classes-decorators-context-managers.md)
