# Lesson 04: Type Hints & Modern Python

> Type hints are like lane markings on a road.
> Python won't stop you from crossing them, but they keep everyone safe.

---

## Why Type Hints Matter for AI Code

ML codebases pass around tensors, configs, and data in complex shapes.
Without type hints, you're driving at night with no headlights.
The code runs, but nobody knows what anything is.

```python
def train(model, data, config):
    ...

from typing import Any
import torch
from torch.utils.data import DataLoader

def train(
    model: torch.nn.Module,
    data: DataLoader,
    config: dict[str, Any],
) -> float:
    ...
```

The second version is a map. The first is a guessing game.

---

## Basic Type Annotations

```python
name: str = "ResNet"
epochs: int = 100
learning_rate: float = 3e-4
is_training: bool = True

def greet(name: str) -> str:
    return f"Hello, {name}"

def compute_loss(predictions: list[float], targets: list[float]) -> float:
    return sum((p - t) ** 2 for p, t in zip(predictions, targets)) / len(predictions)

print(compute_loss([1.0, 2.0, 3.0], [1.1, 2.2, 2.9]))
```

```
  Type Hints Cheat Sheet:
  ───────────────────────────────────────
  int, float, str, bool       Primitives
  list[int]                   List of ints
  dict[str, float]            String keys, float values
  tuple[int, str]             Fixed: (int, str)
  tuple[int, ...]             Variable length: all ints
  set[str]                    Set of strings
  str | None                  String or None (3.10+)
  Optional[str]               Same as str | None
```

---

## Union Types and Optional

```python
from typing import Optional

def find_model(name: str) -> Optional[dict]:
    models = {"bert": {"layers": 12}, "gpt2": {"layers": 24}}
    return models.get(name)

result = find_model("bert")
if result is not None:
    print(result["layers"])

def parse_input(value: int | str) -> int:
    if isinstance(value, str):
        return int(value)
    return value

print(parse_input("42"))
print(parse_input(42))
```

---

## Generic Types

Like templates in C++ or generics in Rust. You define a container
that works with any type, like a box that can hold anything but
remembers what's inside.

```python
from typing import TypeVar, Generic

T = TypeVar("T")

class Result(Generic[T]):
    def __init__(self, value: T | None = None, error: str | None = None):
        self._value = value
        self._error = error

    @property
    def is_ok(self) -> bool:
        return self._error is None

    def unwrap(self) -> T:
        if self._error is not None:
            raise RuntimeError(self._error)
        return self._value

    @classmethod
    def ok(cls, value: T) -> "Result[T]":
        return cls(value=value)

    @classmethod
    def err(cls, message: str) -> "Result[T]":
        return cls(error=message)


success: Result[int] = Result.ok(42)
failure: Result[int] = Result.err("not found")

print(success.unwrap())
print(failure.is_ok)
```

---

## Callable Types

Functions as arguments need type annotations too.
Like specifying what kind of plug fits into your socket.

```python
from typing import Callable

def apply_transform(
    data: list[float],
    transform: Callable[[float], float],
) -> list[float]:
    return [transform(x) for x in data]

import math
result = apply_transform([1.0, 4.0, 9.0], math.sqrt)
print(result)

result = apply_transform([1.0, 2.0, 3.0], lambda x: x ** 2)
print(result)
```

---

## TypedDict

For when you want dict structure but with known keys.
Like a form with specific fields vs a blank piece of paper.

```python
from typing import TypedDict, NotRequired

class ModelConfig(TypedDict):
    name: str
    hidden_size: int
    num_layers: int
    dropout: NotRequired[float]

def create_model(config: ModelConfig) -> str:
    dropout = config.get("dropout", 0.1)
    return f"{config['name']}: {config['num_layers']}L, {config['hidden_size']}H, drop={dropout}"

cfg: ModelConfig = {
    "name": "transformer",
    "hidden_size": 768,
    "num_layers": 12,
}
print(create_model(cfg))
```

---

## Dataclasses

Dataclasses are like Rust structs with `#[derive(Debug, Clone, PartialEq)]`.
They auto-generate boilerplate. Think of them as a form template -
you define the fields, Python fills in the rest.

```python
from dataclasses import dataclass, field

@dataclass
class TrainingConfig:
    model_name: str
    learning_rate: float = 3e-4
    epochs: int = 10
    batch_size: int = 32
    tags: list[str] = field(default_factory=list)

config = TrainingConfig(
    model_name="bert-base",
    epochs=20,
    tags=["experiment", "v2"],
)
print(config)
print(config.learning_rate)

config2 = TrainingConfig(model_name="bert-base", epochs=20, tags=["experiment", "v2"])
print(config == config2)
```

### Frozen Dataclasses (Immutable)

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Hyperparams:
    lr: float
    batch_size: int
    seed: int = 42

params = Hyperparams(lr=0.001, batch_size=32)
print(params)

try:
    params.lr = 0.01
except AttributeError as exc:
    print(f"Can't mutate: {exc}")

print(hash(params))
params_set = {params, Hyperparams(lr=0.001, batch_size=32)}
print(f"Set size: {len(params_set)}")
```

### Post-Init Processing

```python
from dataclasses import dataclass, field
from pathlib import Path

@dataclass
class Experiment:
    name: str
    base_dir: str = "./experiments"
    output_dir: Path = field(init=False)
    checkpoint_dir: Path = field(init=False)

    def __post_init__(self):
        self.output_dir = Path(self.base_dir) / self.name / "outputs"
        self.checkpoint_dir = Path(self.base_dir) / self.name / "checkpoints"

exp = Experiment(name="bert-finetune-v3")
print(f"Output: {exp.output_dir}")
print(f"Checkpoints: {exp.checkpoint_dir}")
```

---

## Match Statements (Python 3.10+)

Pattern matching is like a sorting machine at a post office.
Packages go down different chutes based on their shape and labels.

```python
def handle_response(response: dict) -> str:
    match response:
        case {"status": "ok", "data": data}:
            return f"Success: {data}"
        case {"status": "error", "message": msg}:
            return f"Error: {msg}"
        case {"status": "pending", "retry_after": seconds}:
            return f"Retry in {seconds}s"
        case _:
            return "Unknown response format"

print(handle_response({"status": "ok", "data": [1, 2, 3]}))
print(handle_response({"status": "error", "message": "not found"}))
print(handle_response({"status": "pending", "retry_after": 30}))
print(handle_response({"unknown": True}))
```

### Matching with Guards and OR Patterns

```python
def classify_score(score: float) -> str:
    match score:
        case x if x >= 0.95:
            return "excellent"
        case x if x >= 0.80:
            return "good"
        case x if x >= 0.60:
            return "fair"
        case _:
            return "needs improvement"

for s in [0.98, 0.85, 0.65, 0.40]:
    print(f"{s} -> {classify_score(s)}")
```

### Matching Sequences

```python
def parse_command(parts: list[str]) -> str:
    match parts:
        case ["train", model_name]:
            return f"Training {model_name}"
        case ["train", model_name, "--epochs", epochs]:
            return f"Training {model_name} for {epochs} epochs"
        case ["evaluate", model_name, *datasets]:
            return f"Evaluating {model_name} on {datasets}"
        case ["help" | "--help" | "-h"]:
            return "Showing help"
        case []:
            return "No command given"
        case _:
            return f"Unknown command: {parts}"

print(parse_command(["train", "bert"]))
print(parse_command(["train", "gpt2", "--epochs", "10"]))
print(parse_command(["evaluate", "bert", "squad", "glue"]))
print(parse_command(["help"]))
```

---

## The Walrus Operator (:=)

The walrus operator assigns and returns a value in one step.
Like a cashier who scans an item and bags it simultaneously
instead of scanning first, then bagging.

```python
data = [1, 5, 12, 3, 18, 7, 25, 2]

big_numbers = [x for x in data if (squared := x ** 2) > 100]
print(big_numbers)

import re

text = "Model accuracy: 95.7% on test set"
if match := re.search(r"(\d+\.?\d*)%", text):
    print(f"Found accuracy: {match.group(1)}%")

lines = ["", "  ", "hello", "", "world", ""]
non_empty = [stripped for line in lines if (stripped := line.strip())]
print(non_empty)
```

### Walrus in While Loops

```python
import random

random.seed(42)
attempts = 0
while (value := random.randint(1, 10)) != 7:
    attempts += 1
print(f"Got 7 after {attempts} attempts, value={value}")
```

---

## Protocols (Structural Typing)

Protocols are Python's answer to Rust traits and Go interfaces.
Like a job posting - it doesn't matter where you went to school
(class hierarchy), it matters what you can do (methods).

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Predictable(Protocol):
    def predict(self, inputs: list[float]) -> list[float]: ...
    def score(self, inputs: list[float], targets: list[float]) -> float: ...

class LinearModel:
    def __init__(self, weight: float, bias: float):
        self.weight = weight
        self.bias = bias

    def predict(self, inputs: list[float]) -> list[float]:
        return [x * self.weight + self.bias for x in inputs]

    def score(self, inputs: list[float], targets: list[float]) -> float:
        preds = self.predict(inputs)
        errors = [(p - t) ** 2 for p, t in zip(preds, targets)]
        return 1 - sum(errors) / len(errors)

model = LinearModel(2.0, 1.0)
print(isinstance(model, Predictable))
print(model.predict([1.0, 2.0, 3.0]))
```

---

## Enums

```python
from enum import Enum, auto

class Phase(Enum):
    TRAIN = auto()
    VALIDATE = auto()
    TEST = auto()

class Optimizer(Enum):
    SGD = "sgd"
    ADAM = "adam"
    ADAMW = "adamw"

def get_lr_schedule(phase: Phase, optimizer: Optimizer) -> str:
    if phase == Phase.TRAIN and optimizer == Optimizer.ADAMW:
        return "cosine_warmup"
    return "constant"

print(get_lr_schedule(Phase.TRAIN, Optimizer.ADAMW))
print(Phase.TRAIN.name, Phase.TRAIN.value)

for opt in Optimizer:
    print(f"{opt.name}: {opt.value}")
```

---

## Running a Type Checker

Type hints don't enforce anything at runtime. You need a type
checker like `mypy` or `pyright` to actually catch errors.

```
pip install mypy

mypy my_script.py
mypy my_script.py --strict
```

```python
def add_numbers(a: int, b: int) -> int:
    return a + b

result: str = add_numbers(1, 2)
```

Running `mypy` on this would catch that `result` should be `int`, not `str`.

---

## Exercises

1. **Typed Config**: Create a `@dataclass` hierarchy for ML experiment
   configs: `BaseConfig`, `TrainConfig(BaseConfig)`, `EvalConfig(BaseConfig)`.
   Use frozen dataclasses and type all fields.

2. **Pattern Matching Router**: Write a function that takes API response
   dicts and routes them using `match`. Handle at least 5 different
   response shapes including nested patterns.

3. **Protocol-Based Pipeline**: Define a `Transformer` protocol with
   `fit` and `transform` methods. Create 3 classes that implement it
   (Scaler, Encoder, Selector). Write a pipeline function that accepts
   `list[Transformer]`.

4. **Walrus Optimization**: Refactor this code to use walrus operators:
   ```python
   results = []
   for item in data:
       processed = expensive_function(item)
       if processed is not None:
           filtered = validate(processed)
           if filtered:
               results.append(filtered)
   ```

5. **Generic Container**: Build a typed `RingBuffer[T]` class using
   generics. It should have a fixed capacity and overwrite the oldest
   item when full. Include full type annotations.

---

[Next: Lesson 05 - NumPy ->](05-numpy.md)
