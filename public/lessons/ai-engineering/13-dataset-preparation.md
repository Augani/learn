# 13 - Dataset Preparation

Garbage in, garbage out. Your fine-tuned model is only as
good as your training data. Think of it like cooking: the
best chef can't make a great dish with rotten ingredients.

---

## What Good Training Data Looks Like

```
+-------------------+-----------------------------------+
| Quality Signal    | What It Means                     |
+-------------------+-----------------------------------+
| Correct           | Labels/outputs are actually right |
| Consistent        | Same format across all examples   |
| Diverse           | Covers edge cases and variations  |
| Representative    | Matches real-world distribution   |
| Clean             | No duplicates, typos, or noise    |
+-------------------+-----------------------------------+

BAD data:                       GOOD data:
  "classify: great" -> pos        "Review: This laptop exceeded
  "bad" -> neg                     all my expectations. The
  "meh idk" -> neutral             battery lasts 12 hours."
                                   -> {"sentiment": "positive",
                                       "confidence": "high"}
```

---

## Data Formats

Most fine-tuning expects conversations or instruction pairs.

```python
import json


def create_instruction_pair(instruction: str, input_text: str, output: str) -> dict:
    return {
        "instruction": instruction,
        "input": input_text,
        "output": output,
    }


def create_chat_format(system: str, user: str, assistant: str) -> dict:
    return {
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }


instruction_example = create_instruction_pair(
    instruction="Classify the sentiment of the following product review.",
    input_text="The battery life on this phone is incredible, easily lasts two days.",
    output='{"sentiment": "positive", "aspect": "battery", "confidence": 0.95}',
)

chat_example = create_chat_format(
    system="You are a sentiment classifier. Output JSON with sentiment, aspect, and confidence.",
    user="The battery life on this phone is incredible, easily lasts two days.",
    assistant='{"sentiment": "positive", "aspect": "battery", "confidence": 0.95}',
)


def save_jsonl(data: list[dict], filepath: str):
    with open(filepath, "w") as f:
        for item in data:
            f.write(json.dumps(item) + "\n")


def load_jsonl(filepath: str) -> list[dict]:
    with open(filepath) as f:
        return [json.loads(line) for line in f if line.strip()]
```

---

## Synthetic Data Generation

Don't have enough real data? Generate it. Like a flight
simulator: not the real thing, but good enough to learn from.

```python
from openai import OpenAI
import json

client = OpenAI()


def generate_synthetic_data(
    task_description: str,
    examples: list[dict],
    num_to_generate: int = 20,
    model: str = "gpt-4o-mini",
) -> list[dict]:
    examples_text = "\n".join(
        json.dumps(ex) for ex in examples[:5]
    )

    prompt = f"""Generate {num_to_generate} training examples for:
{task_description}

Here are real examples to match the format and quality:
{examples_text}

Generate diverse examples that cover edge cases. Each should be
different from the examples above. Output as a JSON array."""

    response = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": "Generate training data. Output valid JSON with key 'examples' containing an array.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.9,
    )

    result = json.loads(response.choices[0].message.content)
    return result.get("examples", [])


seed_examples = [
    {
        "input": "This laptop is amazing, best purchase ever!",
        "output": '{"sentiment": "positive", "confidence": 0.95}',
    },
    {
        "input": "Terrible customer service, waited 3 hours.",
        "output": '{"sentiment": "negative", "confidence": 0.9}',
    },
    {
        "input": "It works fine, nothing special.",
        "output": '{"sentiment": "neutral", "confidence": 0.7}',
    },
]

synthetic = generate_synthetic_data(
    task_description="Sentiment classification of product reviews with confidence scores",
    examples=seed_examples,
    num_to_generate=10,
)

for item in synthetic[:3]:
    print(json.dumps(item, indent=2))
```

---

## Data Validation

Never trust data without checking it.

```python
from pydantic import BaseModel, Field, ValidationError
import json


class SentimentExample(BaseModel):
    input_text: str = Field(min_length=10, alias="input")
    output: str

    def validate_output_format(self) -> bool:
        try:
            parsed = json.loads(self.output)
            required_keys = {"sentiment", "confidence"}
            return required_keys.issubset(parsed.keys())
        except json.JSONDecodeError:
            return False


class DataValidator:
    def __init__(self, schema: type[BaseModel]):
        self.schema = schema
        self.errors: list[dict] = []
        self.valid: list[dict] = []

    def validate_dataset(self, data: list[dict]) -> dict:
        self.errors = []
        self.valid = []

        for i, item in enumerate(data):
            try:
                validated = self.schema.model_validate(item)
                if hasattr(validated, "validate_output_format"):
                    if not validated.validate_output_format():
                        self.errors.append({
                            "index": i,
                            "error": "Invalid output format",
                            "item": item,
                        })
                        continue
                self.valid.append(item)
            except ValidationError as exc:
                self.errors.append({
                    "index": i,
                    "error": str(exc),
                    "item": item,
                })

        total = len(data)
        valid_count = len(self.valid)

        report = {
            "total": total,
            "valid": valid_count,
            "invalid": len(self.errors),
            "validity_rate": valid_count / total if total > 0 else 0,
        }

        print(f"Validation: {valid_count}/{total} valid ({report['validity_rate']:.0%})")
        if self.errors:
            print(f"First error: {self.errors[0]['error'][:100]}")

        return report


validator = DataValidator(SentimentExample)
```

---

## Deduplication

Duplicates waste training budget and overfit on repeated
examples. Like studying the same flashcard 50 times while
ignoring the others.

```python
import hashlib
from collections import Counter


def exact_dedup(data: list[dict], key: str = "input") -> list[dict]:
    seen = set()
    unique = []

    for item in data:
        text = item.get(key, "")
        text_hash = hashlib.md5(text.encode()).hexdigest()

        if text_hash not in seen:
            seen.add(text_hash)
            unique.append(item)

    removed = len(data) - len(unique)
    print(f"Removed {removed} exact duplicates ({removed/len(data):.1%})")
    return unique


def fuzzy_dedup(
    data: list[dict],
    key: str = "input",
    threshold: float = 0.9,
) -> list[dict]:
    from difflib import SequenceMatcher

    unique = []
    removed_count = 0

    for item in data:
        text = item.get(key, "")
        is_dup = False

        for existing in unique:
            ratio = SequenceMatcher(None, text, existing.get(key, "")).ratio()
            if ratio >= threshold:
                is_dup = True
                break

        if not is_dup:
            unique.append(item)
        else:
            removed_count += 1

    print(f"Removed {removed_count} fuzzy duplicates")
    return unique
```

---

## Dataset Splitting

```
+---------------------------------------------------+
|              YOUR DATASET (100%)                   |
+---------------------------------------------------+
|  TRAIN (80%)   |  VALIDATION (10%) |  TEST (10%)  |
|  Model learns  |  Tune hyperparams |  Final eval  |
|  from this     |  stop overfitting |  DON'T TOUCH |
+----------------+-------------------+--------------+

CRITICAL: Never let test data leak into training.
          That's like giving students the exam answers.
```

```python
import random


def split_dataset(
    data: list[dict],
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
    seed: int = 42,
) -> dict:
    random.seed(seed)
    shuffled = data.copy()
    random.shuffle(shuffled)

    total = len(shuffled)
    train_end = int(total * train_ratio)
    val_end = train_end + int(total * val_ratio)

    splits = {
        "train": shuffled[:train_end],
        "validation": shuffled[train_end:val_end],
        "test": shuffled[val_end:],
    }

    for name, split in splits.items():
        print(f"  {name}: {len(split)} examples")

    return splits
```

---

## Dataset Quality Checks

```python
from collections import Counter


def analyze_dataset(data: list[dict], output_key: str = "output") -> dict:
    lengths = [len(item.get("input", "")) for item in data]
    output_lengths = [len(item.get(output_key, "")) for item in data]

    label_dist = Counter()
    for item in data:
        try:
            parsed = json.loads(item.get(output_key, "{}"))
            label_dist[parsed.get("sentiment", "unknown")] += 1
        except (json.JSONDecodeError, AttributeError):
            label_dist["parse_error"] += 1

    report = {
        "total_examples": len(data),
        "avg_input_length": sum(lengths) / len(lengths) if lengths else 0,
        "min_input_length": min(lengths) if lengths else 0,
        "max_input_length": max(lengths) if lengths else 0,
        "label_distribution": dict(label_dist),
    }

    print(f"\nDataset Analysis ({len(data)} examples)")
    print(f"  Input length: {report['min_input_length']}-{report['max_input_length']} chars "
          f"(avg: {report['avg_input_length']:.0f})")
    print(f"  Label distribution:")
    for label, count in sorted(label_dist.items(), key=lambda x: -x[1]):
        pct = count / len(data) * 100
        bar = "#" * int(pct / 2)
        print(f"    {label:15s} {count:4d} ({pct:5.1f}%) {bar}")

    return report
```

```
Watch for these data problems:

IMBALANCED:                 BALANCED:
  positive: 900 (90%)        positive: 350 (35%)
  negative:  80 (8%)         negative: 300 (30%)
  neutral:   20 (2%)         neutral:  350 (35%)
  ^-- Model will just          ^-- Model learns all classes
     predict "positive"

TOO SHORT:                  GOOD LENGTH:
  "great" -> pos              "The build quality is excellent
  "bad" -> neg                 but the price is steep for what
  ^-- No real signal           you get" -> mixed
                               ^-- Rich signal to learn from
```

---

## Exercises

**Exercise 1: Synthetic Data Pipeline**
Given 10 seed examples, generate 200 synthetic training
examples. Validate all of them. Remove duplicates. Split
into train/val/test. Save as JSONL files.

**Exercise 2: Data Quality Audit**
Write an audit script that checks a JSONL dataset for:
duplicates, label imbalance, empty fields, inconsistent
formats, and outlier lengths. Print a quality report.

**Exercise 3: Data Augmentation**
Take 50 examples and create augmented versions: rephrase
inputs, add typos, change formatting. Verify augmented
examples still have correct labels.

**Exercise 4: End-to-End Data Prep**
Build a CLI tool that takes raw data (CSV/JSON), cleans it,
validates it, deduplicates, balances classes, splits, and
outputs ready-to-train JSONL files with a quality report.

---

Next: [14 - Fine-Tuning in Practice](14-finetuning-practice.md)
