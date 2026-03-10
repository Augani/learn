# 10 - Evaluating RAG

"It seems to work" is not an evaluation strategy. RAG
systems have multiple failure modes: wrong documents
retrieved, hallucinated answers, correct info ignored.
You need to test each part separately.

Like quality control in a factory: check the parts AND
the assembled product.

---

## RAG Failure Modes

```
+------------------+----------------------------------+
| Failure          | What Happened                    |
+------------------+----------------------------------+
| Retrieval miss   | Right answer exists in DB but    |
|                  | search didn't find it            |
+------------------+----------------------------------+
| Retrieval noise  | Search returned irrelevant docs  |
|                  | that confused the LLM            |
+------------------+----------------------------------+
| Hallucination    | LLM made up info not in the      |
|                  | retrieved context                 |
+------------------+----------------------------------+
| Wrong synthesis  | Right docs retrieved but LLM     |
|                  | combined them incorrectly        |
+------------------+----------------------------------+
| Incomplete       | Answered part of the question    |
|                  | but missed important details     |
+------------------+----------------------------------+

            Query
              |
              v
         [Retrieval] -- Can fail here (miss/noise)
              |
              v
         [Generation] -- Can fail here (hallucination)
              |
              v
           Answer
```

---

## The Three Pillars of RAG Eval

```
+------------------+     +------------------+     +------------------+
| FAITHFULNESS     |     | RELEVANCE        |     | ANSWER QUALITY   |
|                  |     |                  |     |                  |
| Does the answer  |     | Did retrieval    |     | Is the answer    |
| stick to the     |     | find the right   |     | actually correct |
| retrieved context|     | documents?       |     | and complete?    |
+------------------+     +------------------+     +------------------+
```

---

## Building an Eval Dataset

You need question-answer-context triplets.

```python
from dataclasses import dataclass


@dataclass
class RAGEvalCase:
    question: str
    expected_answer: str
    expected_source: str | None = None
    required_facts: list[str] | None = None
    category: str = "general"


eval_dataset = [
    RAGEvalCase(
        question="How do I reset my password?",
        expected_answer="Go to Settings > Security > Reset Password",
        expected_source="security.md",
        required_facts=["Settings", "Security", "Reset Password"],
        category="auth",
    ),
    RAGEvalCase(
        question="What payment methods do you accept?",
        expected_answer="We accept Visa, Mastercard, and ACH bank transfer",
        expected_source="billing.md",
        required_facts=["Visa", "Mastercard", "ACH"],
        category="billing",
    ),
    RAGEvalCase(
        question="How do I export my data?",
        expected_answer="Go to Settings > Privacy > Data Export",
        expected_source="privacy.md",
        required_facts=["Settings", "Privacy", "Data Export"],
        category="privacy",
    ),
]
```

---

## Retrieval Evaluation

Did we fetch the right documents?

```python
def eval_retrieval(
    eval_cases: list[RAGEvalCase],
    retriever,
    top_k: int = 5,
) -> dict:
    results = {
        "hit_rate": 0,
        "mrr": 0,
        "details": [],
    }

    hits = 0
    reciprocal_ranks = []

    for case in eval_cases:
        docs = retriever.search(case.question, top_k=top_k)
        sources = [doc["metadata"].get("source", "") for doc in docs]

        found_at = None
        if case.expected_source:
            for i, source in enumerate(sources):
                if case.expected_source in source:
                    found_at = i
                    break

        if found_at is not None:
            hits += 1
            reciprocal_ranks.append(1.0 / (found_at + 1))
        else:
            reciprocal_ranks.append(0.0)

        results["details"].append({
            "question": case.question,
            "expected_source": case.expected_source,
            "retrieved_sources": sources,
            "found": found_at is not None,
            "rank": found_at,
        })

    total = len(eval_cases)
    results["hit_rate"] = hits / total if total > 0 else 0
    results["mrr"] = sum(reciprocal_ranks) / total if total > 0 else 0

    print(f"Hit Rate @ {top_k}: {results['hit_rate']:.2%}")
    print(f"MRR @ {top_k}: {results['mrr']:.3f}")

    return results
```

```
Retrieval Metrics Explained:

Hit Rate @ K:
  "Did the right doc appear in the top K?"
  Hit Rate @ 5 = 0.80 means 80% of queries found the
  right doc in the top 5 results.

MRR (Mean Reciprocal Rank):
  "How high did the right doc rank?"
  Found at rank 1 = score 1.0
  Found at rank 2 = score 0.5
  Found at rank 5 = score 0.2
  Not found        = score 0.0

  Higher MRR = right docs rank higher on average
```

---

## Faithfulness Evaluation

Does the answer stick to the context, or does it make
stuff up?

```python
from openai import OpenAI
import json

client = OpenAI()

FAITHFULNESS_PROMPT = """Given a context and an answer, determine if the answer is faithful to the context.

Context:
{context}

Answer:
{answer}

For each claim in the answer, check if it's supported by the context.

Respond in JSON:
{{
    "claims": [
        {{"claim": "...", "supported": true/false, "evidence": "..."}}
    ],
    "faithfulness_score": <0.0 to 1.0>,
    "hallucinations": ["list of unsupported claims"]
}}"""


def eval_faithfulness(answer: str, context: str) -> dict:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "user",
                "content": FAITHFULNESS_PROMPT.format(
                    context=context,
                    answer=answer,
                ),
            }
        ],
    )

    return json.loads(response.choices[0].message.content)


context = (
    "Our platform supports OAuth2 and SAML for authentication. "
    "API keys can be generated in the developer settings. "
    "Two-factor authentication is available but not required."
)

answer = (
    "The platform supports OAuth2, SAML, and LDAP for authentication. "
    "You can generate API keys in developer settings. "
    "2FA is mandatory for all accounts."
)

result = eval_faithfulness(answer, context)
print(f"Faithfulness: {result['faithfulness_score']}")
for claim in result.get("claims", []):
    status = "OK" if claim["supported"] else "HALLUCINATED"
    print(f"  [{status}] {claim['claim']}")
```

---

## Answer Quality Evaluation

Is the answer correct and complete?

```python
from openai import OpenAI
import json

client = OpenAI()

QUALITY_PROMPT = """Evaluate this answer against the expected answer.

Question: {question}
Expected: {expected}
Actual: {actual}

Score on these dimensions (each 1-5):
- correctness: Are the facts right?
- completeness: Are all required points covered?
- conciseness: Is it appropriately brief?
- clarity: Is it easy to understand?

Required facts that MUST be present: {required_facts}

Respond in JSON:
{{
    "correctness": <1-5>,
    "completeness": <1-5>,
    "conciseness": <1-5>,
    "clarity": <1-5>,
    "missing_facts": ["list of missing required facts"],
    "overall": <1-5>
}}"""


def eval_answer_quality(
    question: str,
    expected: str,
    actual: str,
    required_facts: list[str] | None = None,
) -> dict:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "user",
                "content": QUALITY_PROMPT.format(
                    question=question,
                    expected=expected,
                    actual=actual,
                    required_facts=required_facts or [],
                ),
            }
        ],
    )

    return json.loads(response.choices[0].message.content)
```

---

## Full RAG Evaluation Pipeline

```python
def evaluate_rag_pipeline(
    rag_pipeline,
    eval_cases: list[RAGEvalCase],
) -> dict:
    results = {
        "total": len(eval_cases),
        "retrieval_hits": 0,
        "avg_faithfulness": 0,
        "avg_quality": 0,
        "cases": [],
    }

    faithfulness_scores = []
    quality_scores = []

    for case in eval_cases:
        rag_result = rag_pipeline.query(case.question)

        retrieval_hit = (
            case.expected_source in str(rag_result.get("sources", []))
            if case.expected_source
            else True
        )
        if retrieval_hit:
            results["retrieval_hits"] += 1

        context = " ".join(
            str(s) for s in rag_result.get("sources", [])
        )
        faith = eval_faithfulness(rag_result["answer"], context)
        faithfulness_scores.append(faith.get("faithfulness_score", 0))

        quality = eval_answer_quality(
            case.question,
            case.expected_answer,
            rag_result["answer"],
            case.required_facts,
        )
        quality_scores.append(quality.get("overall", 0))

        results["cases"].append({
            "question": case.question,
            "retrieval_hit": retrieval_hit,
            "faithfulness": faith.get("faithfulness_score", 0),
            "quality": quality.get("overall", 0),
            "answer": rag_result["answer"][:200],
        })

    total = results["total"]
    results["retrieval_hit_rate"] = results["retrieval_hits"] / total
    results["avg_faithfulness"] = sum(faithfulness_scores) / total
    results["avg_quality"] = sum(quality_scores) / total

    print(f"\n{'='*50}")
    print(f"RAG Evaluation Results ({total} cases)")
    print(f"{'='*50}")
    print(f"Retrieval Hit Rate: {results['retrieval_hit_rate']:.2%}")
    print(f"Avg Faithfulness:   {results['avg_faithfulness']:.2f}")
    print(f"Avg Quality:        {results['avg_quality']:.1f}/5")

    return results
```

---

## Using RAGAS

RAGAS is a library purpose-built for RAG evaluation.

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
from datasets import Dataset

eval_data = {
    "question": [
        "How do I reset my password?",
        "What payment methods do you accept?",
    ],
    "answer": [
        "Go to Settings, then Security, then Reset Password.",
        "We accept Visa and Mastercard.",
    ],
    "contexts": [
        ["To reset your password, navigate to Settings > Security > Reset Password."],
        ["We accept Visa, Mastercard, and ACH bank transfers."],
    ],
    "ground_truth": [
        "Navigate to Settings > Security > Reset Password",
        "Visa, Mastercard, and ACH bank transfer",
    ],
}

dataset = Dataset.from_dict(eval_data)

results = evaluate(
    dataset,
    metrics=[
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall,
    ],
)

print(results)
```

---

## Exercises

**Exercise 1: Build an Eval Dataset**
Create a 20-case evaluation dataset for your RAG system
from Lesson 08. Include: questions, expected answers,
expected sources, and required facts.

**Exercise 2: Retrieval Quality Audit**
Run retrieval evaluation on your 20 cases. Measure hit rate
and MRR at k=1, k=3, k=5, k=10. Where does performance
plateau?

**Exercise 3: Hallucination Detector**
Build a faithfulness checker that takes a RAG answer and
its context, identifies all claims, and flags unsupported
ones. Run it on 10 answers from your pipeline.

**Exercise 4: RAG Scorecard**
Build a complete RAG evaluation that produces a scorecard:
retrieval metrics, faithfulness, answer quality, and per-
category breakdowns. Output as a formatted table.

---

Next: [11 - When to Fine-Tune](11-when-to-finetune.md)
