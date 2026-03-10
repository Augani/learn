# 04 - Prompt Testing

You version control your code. Why not your prompts? A "small
tweak" to a prompt can break everything, just like a "small
tweak" to a regex. Prompt testing catches that before users do.

---

## The Problem

```
Monday:    "Summarize in 3 bullets"         -> Works great
Tuesday:   "Summarize in 3 concise bullets" -> Breaks formatting
Wednesday: "Summarize concisely, 3 bullets" -> Half the tests fail

         Without tests, you'd never know.
```

---

## Version Control for Prompts

Store prompts as data, not buried in code.

```python
import json
from pathlib import Path
from datetime import datetime


class PromptRegistry:
    def __init__(self, storage_dir: str = "prompts"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)

    def save(self, name: str, system_prompt: str, metadata: dict | None = None):
        versions_dir = self.storage_dir / name
        versions_dir.mkdir(exist_ok=True)

        existing = sorted(versions_dir.glob("v*.json"))
        next_version = len(existing) + 1

        record = {
            "version": next_version,
            "system_prompt": system_prompt,
            "created_at": datetime.now().isoformat(),
            "metadata": metadata or {},
        }

        path = versions_dir / f"v{next_version}.json"
        path.write_text(json.dumps(record, indent=2))
        return next_version

    def load(self, name: str, version: int | None = None) -> dict:
        versions_dir = self.storage_dir / name
        if not versions_dir.exists():
            raise FileNotFoundError(f"No prompt named '{name}'")

        if version is None:
            files = sorted(versions_dir.glob("v*.json"))
            if not files:
                raise FileNotFoundError(f"No versions for '{name}'")
            path = files[-1]
        else:
            path = versions_dir / f"v{version}.json"

        return json.loads(path.read_text())

    def list_versions(self, name: str) -> list[int]:
        versions_dir = self.storage_dir / name
        if not versions_dir.exists():
            return []
        files = sorted(versions_dir.glob("v*.json"))
        return [int(f.stem[1:]) for f in files]


registry = PromptRegistry()

registry.save(
    "sentiment_classifier",
    "Classify sentiment as positive, negative, or neutral. One word only.",
    {"author": "team", "task": "sentiment"},
)

registry.save(
    "sentiment_classifier",
    "You are a sentiment classifier. Respond with exactly one word: "
    "positive, negative, or neutral.",
    {"author": "team", "task": "sentiment", "change": "more explicit"},
)

print(registry.list_versions("sentiment_classifier"))
latest = registry.load("sentiment_classifier")
print(f"Latest: v{latest['version']}")
```

---

## Regression Testing

Like unit tests: define inputs and expected outputs, then
run them every time you change a prompt.

```python
from dataclasses import dataclass
from openai import OpenAI

client = OpenAI()


@dataclass
class PromptTest:
    name: str
    user_input: str
    must_contain: list[str] | None = None
    must_not_contain: list[str] | None = None
    expected_exact: str | None = None
    max_length: int | None = None


def run_prompt_tests(
    system_prompt: str,
    tests: list[PromptTest],
    model: str = "gpt-4o-mini",
) -> dict:
    passed = 0
    failed = 0
    failures = []

    for test in tests:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": test.user_input},
            ],
        )
        output = response.choices[0].message.content.strip()
        errors = []

        if test.expected_exact and output.lower() != test.expected_exact.lower():
            errors.append(f"Expected '{test.expected_exact}', got '{output}'")

        if test.must_contain:
            for keyword in test.must_contain:
                if keyword.lower() not in output.lower():
                    errors.append(f"Missing required: '{keyword}'")

        if test.must_not_contain:
            for keyword in test.must_not_contain:
                if keyword.lower() in output.lower():
                    errors.append(f"Contains forbidden: '{keyword}'")

        if test.max_length and len(output) > test.max_length:
            errors.append(f"Too long: {len(output)} > {test.max_length}")

        if errors:
            failed += 1
            failures.append({"test": test.name, "output": output, "errors": errors})
        else:
            passed += 1

        status = "PASS" if not errors else "FAIL"
        print(f"  [{status}] {test.name}")

    print(f"\nResults: {passed}/{passed + failed} passed")
    return {"passed": passed, "failed": failed, "failures": failures}


tests = [
    PromptTest(
        name="clear_positive",
        user_input="I love this product!",
        expected_exact="positive",
    ),
    PromptTest(
        name="clear_negative",
        user_input="This is terrible.",
        expected_exact="negative",
    ),
    PromptTest(
        name="no_explanation",
        user_input="It's okay I guess.",
        max_length=15,
        must_not_contain=["because", "the sentiment"],
    ),
]

prompt_v1 = "Classify sentiment. Respond with one word: positive, negative, or neutral."
print("=== Testing v1 ===")
run_prompt_tests(prompt_v1, tests)
```

---

## A/B Testing Prompts

Run two prompt versions on the same inputs and compare.
Like a taste test: same food, different recipes.

```python
from openai import OpenAI
import time

client = OpenAI()


def ab_test_prompts(
    prompt_a: str,
    prompt_b: str,
    test_inputs: list[str],
    scorer,
    expected_outputs: list[str],
    model: str = "gpt-4o-mini",
) -> dict:
    results_a = {"scores": [], "latencies": []}
    results_b = {"scores": [], "latencies": []}

    for user_input, expected in zip(test_inputs, expected_outputs):
        for prompt, results in [(prompt_a, results_a), (prompt_b, results_b)]:
            start = time.time()
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_input},
                ],
            )
            elapsed = time.time() - start
            output = response.choices[0].message.content.strip()
            score = scorer(expected, output)
            results["scores"].append(score)
            results["latencies"].append(elapsed)

    def summarize(results):
        return {
            "avg_score": sum(results["scores"]) / len(results["scores"]),
            "avg_latency": sum(results["latencies"]) / len(results["latencies"]),
            "pass_rate": sum(1 for s in results["scores"] if s >= 0.8) / len(results["scores"]),
        }

    summary_a = summarize(results_a)
    summary_b = summarize(results_b)

    print(f"{'Metric':<20} {'Prompt A':<15} {'Prompt B':<15}")
    print(f"{'-'*50}")
    print(f"{'Avg Score':<20} {summary_a['avg_score']:<15.2%} {summary_b['avg_score']:<15.2%}")
    print(f"{'Pass Rate':<20} {summary_a['pass_rate']:<15.2%} {summary_b['pass_rate']:<15.2%}")
    print(f"{'Avg Latency':<20} {summary_a['avg_latency']:<15.3f}s {summary_b['avg_latency']:<15.3f}s")

    winner = "A" if summary_a["avg_score"] >= summary_b["avg_score"] else "B"
    print(f"\nWinner: Prompt {winner}")

    return {"a": summary_a, "b": summary_b, "winner": winner}


def simple_scorer(expected, actual):
    return 1.0 if expected.lower() in actual.lower() else 0.0


inputs = [
    "Amazing product, love it!",
    "Terrible experience.",
    "It's fine, nothing special.",
    "Best purchase I ever made!",
    "Do not buy this.",
]
expected = ["positive", "negative", "neutral", "positive", "negative"]

ab_test_prompts(
    prompt_a="Classify sentiment as: positive, negative, neutral. One word.",
    prompt_b="You are a precise sentiment classifier. Output exactly one word: positive, negative, or neutral. No explanation.",
    test_inputs=inputs,
    scorer=simple_scorer,
    expected_outputs=expected,
)
```

---

## Prompt CI/CD

```
+-----------+     +------------+     +------------+     +----------+
|  Change   |     |  Run       |     |  Compare   |     |  Deploy  |
|  prompt   |---->|  test      |---->|  to        |---->|  or      |
|           |     |  suite     |     |  baseline  |     |  reject  |
+-----------+     +------------+     +------------+     +----------+
                       |                   |
                       v                   v
                  Pass rate >= 90%?   Score >= previous?
                  Latency okay?       No regressions?
```

```python
import json
from pathlib import Path


class PromptCI:
    def __init__(self, baseline_file: str = "baseline.json"):
        self.baseline_file = Path(baseline_file)

    def save_baseline(self, results: dict):
        self.baseline_file.write_text(json.dumps(results, indent=2))

    def load_baseline(self) -> dict | None:
        if not self.baseline_file.exists():
            return None
        return json.loads(self.baseline_file.read_text())

    def check_regression(
        self,
        new_results: dict,
        max_score_drop: float = 0.05,
        min_pass_rate: float = 0.9,
    ) -> dict:
        baseline = self.load_baseline()
        checks = {"passed": True, "issues": []}

        if new_results.get("pass_rate", 0) < min_pass_rate:
            checks["passed"] = False
            checks["issues"].append(
                f"Pass rate {new_results['pass_rate']:.0%} "
                f"below minimum {min_pass_rate:.0%}"
            )

        if baseline:
            score_drop = baseline.get("avg_score", 0) - new_results.get("avg_score", 0)
            if score_drop > max_score_drop:
                checks["passed"] = False
                checks["issues"].append(
                    f"Score dropped by {score_drop:.2%} "
                    f"(max allowed: {max_score_drop:.2%})"
                )

        return checks


ci = PromptCI()

new_results = {"avg_score": 0.87, "pass_rate": 0.92}
check = ci.check_regression(new_results)

if check["passed"]:
    print("All checks passed. Safe to deploy.")
    ci.save_baseline(new_results)
else:
    print("BLOCKED. Issues:")
    for issue in check["issues"]:
        print(f"  - {issue}")
```

---

## Prompt Diff

See exactly what changed between versions.

```python
import difflib


def prompt_diff(old_prompt: str, new_prompt: str):
    old_lines = old_prompt.splitlines(keepends=True)
    new_lines = new_prompt.splitlines(keepends=True)

    diff = difflib.unified_diff(
        old_lines,
        new_lines,
        fromfile="v1",
        tofile="v2",
    )

    for line in diff:
        print(line, end="")


prompt_diff(
    "Classify sentiment as positive, negative, or neutral.\nOne word only.",
    "You are a sentiment classifier.\nRespond with exactly one word: positive, negative, or neutral.\nNo explanation or punctuation.",
)
```

---

## Exercises

**Exercise 1: Prompt Registry**
Build a prompt registry that stores prompts as files with
version numbers. Add commands to: save, load, list, diff,
and rollback to a previous version.

**Exercise 2: Regression Test Suite**
Write a 15-case regression test suite for a prompt of your
choice. Run it, save the baseline. Then modify the prompt
and run again. Did anything regress?

**Exercise 3: A/B Test Runner**
Build a CLI tool that takes two prompt files and a test
cases file, runs both prompts, and produces a comparison
report with scores, latency, and a recommendation.

**Exercise 4: Prompt CI Pipeline**
Combine everything: prompt registry + regression tests +
baseline comparison. Simulate a CI check that blocks
deployment if tests regress.

---

Next: [05 - Embeddings in Practice](05-embeddings-in-practice.md)
