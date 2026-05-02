# 11 - When to Fine-Tune

Fine-tuning is like sending an employee to specialized
training. It's expensive and time-consuming. Before you do
it, make sure you've tried the cheaper options first.

---

## The Decision Ladder

```
START HERE
    |
    v
+----------------------+
| Better prompts?      |  Cost: $0  Time: hours
| (Lesson 01)          |
+----------+-----------+
           |
       Still not good enough?
           |
           v
+----------------------+
| Few-shot examples?   |  Cost: $0  Time: hours
| (Lesson 01)          |
+----------+-----------+
           |
       Still not good enough?
           |
           v
+----------------------+
| RAG / retrieval?     |  Cost: $   Time: days
| (Lessons 05-10)      |
+----------+-----------+
           |
       Still not good enough?
           |
           v
+----------------------+
| Fine-tuning          |  Cost: $$  Time: weeks
| (Lessons 12-14)      |
+----------+-----------+
           |
       Still not good enough?
           |
           v
+----------------------+
| Train from scratch   |  Cost: $$$$$  Time: months
| (probably don't)     |
+----------------------+
```

---

## When Fine-Tuning Actually Helps

```
+----------------------------+----------------------------------+
| Scenario                   | Why Fine-Tuning Helps            |
+----------------------------+----------------------------------+
| Consistent style/format    | Learns YOUR specific output      |
|                            | format better than prompting     |
+----------------------------+----------------------------------+
| Domain-specific language   | Medical, legal, financial jargon |
|                            | that base models struggle with   |
+----------------------------+----------------------------------+
| Reduce prompt size         | Behavior baked in = fewer tokens |
|                            | per request = lower cost at scale|
+----------------------------+----------------------------------+
| Specific task mastery      | Classification, extraction on    |
|                            | YOUR data types                  |
+----------------------------+----------------------------------+
| Latency reduction          | Smaller fine-tuned model can     |
|                            | match bigger base model          |
+----------------------------+----------------------------------+
```

---

## When Fine-Tuning Does NOT Help

```
+----------------------------+----------------------------------+
| Scenario                   | Why It Won't Help                |
+----------------------------+----------------------------------+
| Need factual knowledge     | Fine-tuning doesn't reliably     |
|                            | add facts. Use RAG instead.      |
+----------------------------+----------------------------------+
| Small dataset (<100 ex.)   | Not enough signal to learn from. |
|                            | Few-shot prompting is better.    |
+----------------------------+----------------------------------+
| Rapidly changing info      | Can't retrain every day.         |
|                            | Use RAG for dynamic content.     |
+----------------------------+----------------------------------+
| General improvement        | "Make it better" isn't a task.   |
|                            | Define specific failures first.  |
+----------------------------+----------------------------------+
| One-off tasks              | ROI doesn't justify the effort.  |
|                            | Prompt engineering is enough.    |
+----------------------------+----------------------------------+
```

---

## The Decision Framework

```python
from dataclasses import dataclass
from enum import Enum


class Recommendation(Enum):
    PROMPT_ENGINEERING = "prompt_engineering"
    FEW_SHOT = "few_shot"
    RAG = "rag"
    FINE_TUNING = "fine_tuning"


@dataclass
class ProjectContext:
    task_type: str
    dataset_size: int
    needs_current_info: bool
    needs_consistent_format: bool
    budget_per_month: float
    latency_requirement_ms: int
    accuracy_requirement: float
    current_accuracy: float


def recommend_approach(ctx: ProjectContext) -> list[dict]:
    recommendations = []

    accuracy_gap = ctx.accuracy_requirement - ctx.current_accuracy

    if accuracy_gap <= 0.05:
        recommendations.append({
            "approach": Recommendation.PROMPT_ENGINEERING,
            "reason": "Small accuracy gap, try better prompts first",
            "effort": "hours",
            "cost": "~$0",
        })

    if ctx.dataset_size < 100:
        recommendations.append({
            "approach": Recommendation.FEW_SHOT,
            "reason": "Too little data for fine-tuning, use examples in prompt",
            "effort": "hours",
            "cost": "~$0",
        })

    if ctx.needs_current_info:
        recommendations.append({
            "approach": Recommendation.RAG,
            "reason": "Dynamic info needs retrieval, not baked-in knowledge",
            "effort": "days",
            "cost": "$-$$",
        })

    should_finetune = (
        ctx.dataset_size >= 100
        and accuracy_gap > 0.1
        and not ctx.needs_current_info
        and (ctx.needs_consistent_format or ctx.latency_requirement_ms < 500)
    )

    if should_finetune:
        recommendations.append({
            "approach": Recommendation.FINE_TUNING,
            "reason": "Good dataset size, significant accuracy gap, stable task",
            "effort": "weeks",
            "cost": "$$",
        })

    return recommendations


project = ProjectContext(
    task_type="classification",
    dataset_size=500,
    needs_current_info=False,
    needs_consistent_format=True,
    budget_per_month=200,
    latency_requirement_ms=300,
    accuracy_requirement=0.95,
    current_accuracy=0.82,
)

recs = recommend_approach(project)
for rec in recs:
    print(f"  {rec['approach'].value}: {rec['reason']}")
    print(f"    Effort: {rec['effort']}, Cost: {rec['cost']}")
```

---

## Cost Comparison

```
Approach         | Setup Cost | Per-Query Cost | Maintenance
-----------------+------------+----------------+------------
Prompt eng.      | ~$0        | Base API rate  | Low
Few-shot         | ~$0        | Higher (tokens)| Low
RAG              | $50-500    | Base + embed   | Medium
Fine-tuning      | $50-5000   | Lower per query| Medium
Train from scrach| $10K-1M+   | Self-hosted    | Very High

   Monthly cost at 100K queries:
   +--------------------------------------------------+
   | Prompt (GPT-4o-mini): ~$15                        |
   | Few-shot (5 examples): ~$45                       |
   | RAG (embed + generate): ~$30                      |
   | Fine-tuned (small model): ~$10                    |
   +--------------------------------------------------+

   Fine-tuning has high SETUP cost but LOW per-query cost.
   At scale, it often wins.
```

---

## Prompting vs RAG vs Fine-Tuning

```
                    +-------------+
                    |             |
                    |  Prompting  |  "Teach by instruction"
                    |             |  Like giving verbal directions
                    +------+------+
                           |
            Need external knowledge?
                  /                \
                YES                 NO
                /                     \
        +------+------+        +------+------+
        |             |        |             |
        |    RAG      |        | Fine-Tuning |  "Teach by training"
        |             |        |             |  Like muscle memory
        +-------------+        +------+------+
        "Teach by               Need consistent
         reference"             style + format?
        Like an open-                |
        book exam               Fine-tune for
                                FORMAT, RAG for
                                KNOWLEDGE
```

---

## Hybrid Approach: RAG + Fine-Tuning

The best systems often combine both.

```
Fine-tune for:              RAG for:
- Output format             - Current facts
- Domain vocabulary         - User-specific data
- Response style            - Large knowledge base
- Task-specific behavior    - Frequently updated info

Combined:
+-------------+     +----------+     +------------------+
| User query  |---->| RAG      |---->| Fine-tuned model |
|             |     | retrieves|     | generates in the |
|             |     | context  |     | right style      |
+-------------+     +----------+     +------------------+
```

---

## Exercises

**Exercise 1: Decision Framework**
Take a real project idea. Fill out the `ProjectContext`
dataclass with realistic numbers. Run the recommendation
function. Do you agree with the recommendation?

**Exercise 2: Baseline First**
Pick a task (classification, extraction, summarization).
Establish a baseline with prompt engineering. Then add
few-shot examples. Track accuracy at each step. Calculate
how much accuracy you'd need fine-tuning to add.

**Exercise 3: Cost Calculator**
Build a cost calculator that takes: query volume, prompt
size, response size, and approach (prompt/RAG/fine-tune).
Output monthly cost for each approach.

**Exercise 4: Decision Document**
Write a one-page decision document for a hypothetical
project: what approach to use and why. Include: task
description, data availability, accuracy requirements,
budget, and your recommendation with justification.

---

Next: [12 - LoRA & QLoRA](12-lora-qlora.md)
