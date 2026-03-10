# 03 - Evaluation

You wouldn't ship a web app without tests. AI apps are the
same. Evaluation is how you know if your AI actually works,
or if it just LOOKS like it works during your demo.

Think of evals like a driving test. Passing a few easy roads
doesn't mean you can handle a highway in a storm.

---

## Why Most AI Apps Fail

```
+-------------------------------------------+
|  "It worked in my demo"                   |
|                                           |
|  Demo: 5 hand-picked examples            |
|  Reality: 10,000 messy, weird inputs      |
|                                           |
|  The gap between demo and production      |
|  is EVALUATION.                           |
+-------------------------------------------+
```

---

## The Eval Framework

```
                    +------------------+
                    |    TEST CASES    |
                    | (inputs + expected|
                    |  outputs)         |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |   RUN THROUGH    |
                    |   YOUR SYSTEM    |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |    SCORE IT      |
                    | (auto + human)   |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |   DECIDE         |
                    | (ship or fix?)   |
                    +------------------+
```

---

## Building a Test Suite

Start simple. A test case is just: input, expected output,
and how to score it.

```python
from dataclasses import dataclass, field
from typing import Callable


@dataclass
class EvalCase:
    name: str
    input_text: str
    expected: str
    tags: list[str] = field(default_factory=list)


@dataclass
class EvalSuite:
    name: str
    cases: list[EvalCase]

    def run(self, system_fn: Callable[[str], str]) -> list[dict]:
        results = []
        for case in self.cases:
            actual = system_fn(case.input_text)
            results.append({
                "name": case.name,
                "input": case.input_text,
                "expected": case.expected,
                "actual": actual,
                "tags": case.tags,
            })
        return results


sentiment_suite = EvalSuite(
    name="Sentiment Analysis",
    cases=[
        EvalCase(
            name="clear_positive",
            input_text="This product is amazing!",
            expected="positive",
            tags=["easy"],
        ),
        EvalCase(
            name="clear_negative",
            input_text="Worst purchase ever.",
            expected="negative",
            tags=["easy"],
        ),
        EvalCase(
            name="sarcasm",
            input_text="Oh great, another broken feature.",
            expected="negative",
            tags=["hard", "sarcasm"],
        ),
        EvalCase(
            name="mixed",
            input_text="Great camera but terrible battery.",
            expected="mixed",
            tags=["hard", "mixed"],
        ),
    ],
)
```

---

## Automated Scoring

Different tasks need different scorers. Like grading:
multiple choice is easy, essays are hard.

```python
from difflib import SequenceMatcher


def exact_match(expected: str, actual: str) -> float:
    return 1.0 if expected.strip().lower() == actual.strip().lower() else 0.0


def contains_match(expected: str, actual: str) -> float:
    return 1.0 if expected.lower() in actual.lower() else 0.0


def fuzzy_match(expected: str, actual: str, threshold: float = 0.8) -> float:
    ratio = SequenceMatcher(None, expected.lower(), actual.lower()).ratio()
    return ratio if ratio >= threshold else 0.0


def keyword_match(keywords: list[str], actual: str) -> float:
    found = sum(1 for kw in keywords if kw.lower() in actual.lower())
    return found / len(keywords) if keywords else 0.0


print(exact_match("positive", "Positive"))
print(contains_match("positive", "The sentiment is positive overall"))
print(fuzzy_match("San Francisco", "San Fransisco"))
print(keyword_match(["battery", "camera", "price"], "The battery is great"))
```

---

## LLM-as-Judge

For subjective tasks, use another LLM to grade. Like having
a teacher grade student essays.

```python
from openai import OpenAI

client = OpenAI()

JUDGE_PROMPT = """You are evaluating an AI assistant's response.

Question: {question}
Expected answer: {expected}
Actual answer: {actual}

Rate the actual answer on a scale of 1-5:
1 = Completely wrong
2 = Partially correct but missing key info
3 = Mostly correct with minor issues
4 = Correct with good detail
5 = Excellent, comprehensive answer

Respond with ONLY a JSON object:
{{"score": <1-5>, "reasoning": "<brief explanation>"}}"""


def llm_judge(question: str, expected: str, actual: str) -> dict:
    import json

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "user",
                "content": JUDGE_PROMPT.format(
                    question=question,
                    expected=expected,
                    actual=actual,
                ),
            }
        ],
    )

    return json.loads(response.choices[0].message.content)


result = llm_judge(
    question="What causes rain?",
    expected="Evaporation and condensation in the water cycle",
    actual="Water evaporates, forms clouds, then falls as precipitation",
)
print(f"Score: {result['score']}/5")
print(f"Reason: {result['reasoning']}")
```

---

## Running an Eval Pipeline

```python
from openai import OpenAI
import json

client = OpenAI()


def my_sentiment_system(text: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Classify sentiment as: positive, negative, "
                    "neutral, or mixed. Respond with ONE word only."
                ),
            },
            {"role": "user", "content": text},
        ],
    )
    return response.choices[0].message.content.strip().lower()


def run_eval(suite, system_fn, scorer):
    results = suite.run(system_fn)
    scores = []

    for result in results:
        score = scorer(result["expected"], result["actual"])
        result["score"] = score
        scores.append(score)

    avg_score = sum(scores) / len(scores) if scores else 0

    print(f"\n{'='*50}")
    print(f"Suite: {suite.name}")
    print(f"Average Score: {avg_score:.2%}")
    print(f"{'='*50}")

    for result in results:
        status = "PASS" if result["score"] >= 0.8 else "FAIL"
        print(f"  [{status}] {result['name']}: "
              f"expected={result['expected']}, "
              f"actual={result['actual']}")

    return results, avg_score


run_eval(sentiment_suite, my_sentiment_system, contains_match)
```

---

## Human Evaluation

Some things need human eyes. Build a simple human eval loop.

```python
import json
from pathlib import Path


def human_eval(cases: list[dict], output_file: str = "human_eval.jsonl"):
    results = []

    for i, case in enumerate(cases):
        print(f"\n--- Case {i+1}/{len(cases)} ---")
        print(f"Input: {case['input']}")
        print(f"Output: {case['actual']}")
        print()

        while True:
            score = input("Score (1-5, or 's' to skip): ").strip()
            if score == "s":
                break
            if score in ("1", "2", "3", "4", "5"):
                case["human_score"] = int(score)
                note = input("Notes (optional): ").strip()
                if note:
                    case["human_notes"] = note
                results.append(case)
                break
            print("Invalid input. Enter 1-5 or 's'.")

    with open(output_file, "w") as f:
        for result in results:
            f.write(json.dumps(result) + "\n")

    if results:
        avg = sum(r["human_score"] for r in results) / len(results)
        print(f"\nAverage human score: {avg:.2f}/5")

    return results
```

---

## Eval Metrics Cheat Sheet

```
+------------------+------------------------+------------------+
| Metric           | Use When               | How to Measure   |
+------------------+------------------------+------------------+
| Exact match      | Classification,        | expected == actual|
|                  | yes/no answers         |                  |
+------------------+------------------------+------------------+
| Contains         | Key info extraction    | keyword in output|
+------------------+------------------------+------------------+
| BLEU/ROUGE       | Summarization,         | n-gram overlap   |
|                  | translation            |                  |
+------------------+------------------------+------------------+
| LLM-as-judge     | Open-ended generation, | Another LLM      |
|                  | quality assessment     | scores output    |
+------------------+------------------------+------------------+
| Human eval       | Subjective quality,    | Humans rate      |
|                  | safety checking        | outputs          |
+------------------+------------------------+------------------+
| Task completion  | Agents, multi-step     | Did it achieve   |
|                  | workflows              | the goal?        |
+------------------+------------------------+------------------+
```

---

## Exercises

**Exercise 1: Build an Eval Suite**
Create a 20-case eval suite for a task you care about
(summarization, Q&A, classification). Include easy, medium,
and hard cases. Tag them by difficulty.

**Exercise 2: Multi-Scorer Pipeline**
Run the same test suite through 3 different scorers
(exact match, contains, LLM-as-judge). Compare results.
Which scorer best matches human judgment?

**Exercise 3: Model Comparison**
Run the same eval suite against gpt-4o-mini and gpt-4o.
Create a comparison table showing scores, latency, and cost
per case. Is the expensive model worth it?

**Exercise 4: Eval Dashboard**
Build a script that runs evals and outputs a markdown table:
test name, score, pass/fail, latency. Save results as JSONL
for tracking over time.

---

Next: [04 - Prompt Testing](04-prompt-testing.md)
