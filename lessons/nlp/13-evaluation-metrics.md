# Lesson 13: NLP Evaluation Metrics

## The Big Analogy: Grading an Essay

```
EVALUATION METRICS = DIFFERENT GRADING CRITERIA

  BLEU        = Word matching (spelling bee)
                "Did you use the right words?"

  ROUGE       = Coverage check (book report)
                "Did you cover all the key points?"

  BERTScore   = Meaning comparison (comprehension test)
                "Does it mean the same thing?"

  Human Eval  = Expert review (thesis defense)
                "Is this actually good?"

  Each metric captures a different aspect.
  No single metric tells the whole story.
```

## BLEU: Bilingual Evaluation Understudy

```
BLEU MEASURES N-GRAM OVERLAP

  Reference: "The cat sat on the mat"
  Candidate: "The cat is on the mat"

  1-gram matches: The(Y) cat(Y) is(N) on(Y) the(Y) mat(Y) = 5/6
  2-gram matches: "The cat"(Y) "cat is"(N) "is on"(N)
                  "on the"(Y) "the mat"(Y) = 3/5
  3-gram matches: "The cat is"(N) "cat is on"(N)
                  "is on the"(N) "on the mat"(Y) = 1/4

  BLEU = geometric mean of n-gram precisions * brevity penalty

  BLEU ranges 0-1 (or 0-100)
  0.3+ is generally considered decent for translation
```

```python
from nltk.translate.bleu_score import sentence_bleu, corpus_bleu
from nltk.translate.bleu_score import SmoothingFunction
import numpy as np

def compute_bleu(
    references: list[list[str]],
    hypotheses: list[str],
    max_n: int = 4,
) -> dict:
    smoother = SmoothingFunction()

    ref_tokenized = [[ref.split() for ref in refs] for refs in references]
    hyp_tokenized = [hyp.split() for hyp in hypotheses]

    bleu_scores = {}
    for n in range(1, max_n + 1):
        weights = tuple([1.0 / n] * n + [0.0] * (4 - n))
        score = corpus_bleu(
            ref_tokenized,
            hyp_tokenized,
            weights=weights,
            smoothing_function=smoother.method1,
        )
        bleu_scores[f"bleu_{n}"] = score

    bleu_scores["bleu_4_standard"] = corpus_bleu(
        ref_tokenized,
        hyp_tokenized,
        smoothing_function=smoother.method1,
    )

    return bleu_scores

references = [
    ["The cat sat on the mat"],
    ["It is raining outside today"],
]
hypotheses = [
    "The cat is on the mat",
    "It is raining outside",
]

scores = compute_bleu(references, hypotheses)
for metric, score in scores.items():
    print(f"{metric}: {score:.4f}")
```

## ROUGE: Recall-Oriented Understudy

```
ROUGE MEASURES RECALL OF N-GRAMS

  Reference: "The cat sat on the mat near the door"
  Summary:   "The cat sat on the mat"

  ROUGE-1 (unigram recall):
  Ref tokens in summary: The, cat, sat, on, the, mat = 6/9 = 0.67

  ROUGE-2 (bigram recall):
  Ref bigrams in summary: "The cat", "cat sat", "sat on",
                          "on the", "the mat" = 5/8 = 0.625

  ROUGE-L (longest common subsequence):
  LCS("The cat sat on the mat near the door",
      "The cat sat on the mat") = "The cat sat on the mat" (6)
  Recall = 6/9 = 0.67

  ROUGE focuses on RECALL (did you capture the key content?)
  BLEU focuses on PRECISION (are your words correct?)
```

```python
from rouge_score import rouge_scorer

def compute_rouge(
    references: list[str],
    hypotheses: list[str],
) -> dict:
    scorer = rouge_scorer.RougeScorer(
        ["rouge1", "rouge2", "rougeL", "rougeLsum"],
        use_stemmer=True,
    )

    aggregated = {
        "rouge1": [],
        "rouge2": [],
        "rougeL": [],
        "rougeLsum": [],
    }

    for ref, hyp in zip(references, hypotheses):
        scores = scorer.score(ref, hyp)
        for key in aggregated:
            aggregated[key].append(scores[key].fmeasure)

    return {
        key: {
            "mean": np.mean(values),
            "std": np.std(values),
        }
        for key, values in aggregated.items()
    }

references = [
    "The quick brown fox jumped over the lazy dog near the river bank",
    "Machine learning models require large amounts of training data",
]
summaries = [
    "The fox jumped over the dog",
    "ML models need lots of training data",
]

results = compute_rouge(references, summaries)
for metric, stats in results.items():
    print(f"{metric}: {stats['mean']:.4f} (+/- {stats['std']:.4f})")
```

## BERTScore: Semantic Similarity

```
BERTScore USES CONTEXTUAL EMBEDDINGS

  Reference: "The feline rested upon the mat"
  Candidate: "The cat sat on the mat"

  BLEU/ROUGE: Low score (different words!)

  BERTScore:
  "feline" embedding <--> "cat" embedding    = 0.92 (similar!)
  "rested" embedding <--> "sat" embedding    = 0.88 (similar!)
  "upon"   embedding <--> "on"  embedding    = 0.95 (similar!)

  BERTScore: High score (same meaning!)

  Process:
  1. Embed each token with BERT
  2. Compute pairwise cosine similarity
  3. Greedy match tokens between ref and candidate
  4. Average matched similarities
```

```python
from bert_score import score as bert_score

def compute_bertscore(
    references: list[str],
    hypotheses: list[str],
    model_type: str = "microsoft/deberta-xlarge-mnli",
) -> dict:
    precision, recall, f1 = bert_score(
        hypotheses,
        references,
        model_type=model_type,
        lang="en",
        verbose=False,
    )

    return {
        "precision": {
            "mean": precision.mean().item(),
            "std": precision.std().item(),
        },
        "recall": {
            "mean": recall.mean().item(),
            "std": recall.std().item(),
        },
        "f1": {
            "mean": f1.mean().item(),
            "std": f1.std().item(),
        },
    }

refs = ["The cat sat on the mat", "I love programming"]
hyps = ["A feline rested on the rug", "I enjoy coding"]

results = compute_bertscore(refs, hyps)
for metric, stats in results.items():
    print(f"BERTScore {metric}: {stats['mean']:.4f}")
```

## Human Evaluation

```
HUMAN EVALUATION DIMENSIONS

  +----------------+----------------------------------------+
  | Dimension      | Question to Evaluator                  |
  +----------------+----------------------------------------+
  | Fluency        | Is the text grammatically correct?     |
  | Coherence      | Does it make logical sense?            |
  | Relevance      | Does it answer the question?           |
  | Faithfulness   | Is it consistent with the source?      |
  | Informativeness| Does it contain useful information?    |
  +----------------+----------------------------------------+

  RATING SCALES:
  Likert:    1-5 (Strongly disagree to Strongly agree)
  Binary:    Yes/No
  Ranking:   A > B > C (comparative)
  Best-worst: Pick best and worst from set
```

```python
from dataclasses import dataclass
from enum import Enum
import statistics

class Dimension(Enum):
    FLUENCY = "fluency"
    COHERENCE = "coherence"
    RELEVANCE = "relevance"
    FAITHFULNESS = "faithfulness"

@dataclass
class HumanRating:
    evaluator_id: str
    sample_id: str
    system: str
    dimension: Dimension
    score: int

def compute_inter_annotator_agreement(
    ratings: list[HumanRating],
    dimension: Dimension,
) -> float:
    from itertools import combinations

    by_sample: dict[str, dict[str, int]] = {}
    for rating in ratings:
        if rating.dimension != dimension:
            continue
        key = f"{rating.sample_id}_{rating.system}"
        if key not in by_sample:
            by_sample[key] = {}
        by_sample[key][rating.evaluator_id] = rating.score

    agreements = 0
    total = 0
    for sample_ratings in by_sample.values():
        scores = list(sample_ratings.values())
        for s1, s2 in combinations(scores, 2):
            if abs(s1 - s2) <= 1:
                agreements += 1
            total += 1

    return agreements / total if total > 0 else 0.0

def aggregate_ratings(
    ratings: list[HumanRating],
) -> dict[str, dict[str, float]]:
    by_system: dict[str, dict[str, list[int]]] = {}

    for rating in ratings:
        system = rating.system
        dim = rating.dimension.value
        if system not in by_system:
            by_system[system] = {}
        if dim not in by_system[system]:
            by_system[system][dim] = []
        by_system[system][dim].append(rating.score)

    return {
        system: {
            dim: statistics.mean(scores)
            for dim, scores in dims.items()
        }
        for system, dims in by_system.items()
    }
```

## Metric Comparison

```
WHEN TO USE EACH METRIC

  +-------------+-------------------+-------------------+
  | Metric      | Good At           | Bad At            |
  +-------------+-------------------+-------------------+
  | BLEU        | Translation       | Creative tasks    |
  |             | Exact matching    | Paraphrases       |
  +-------------+-------------------+-------------------+
  | ROUGE       | Summarization     | Short outputs     |
  |             | Content coverage  | Style evaluation  |
  +-------------+-------------------+-------------------+
  | BERTScore   | Semantic match    | Factual accuracy  |
  |             | Paraphrases       | Computational cost|
  +-------------+-------------------+-------------------+
  | Human Eval  | Everything        | Cost, scale,      |
  |             | Ground truth      | consistency       |
  +-------------+-------------------+-------------------+

  RULE OF THUMB:
  - Translation: BLEU + human eval
  - Summarization: ROUGE + BERTScore + faithfulness eval
  - Generation: Human eval + BERTScore + task-specific
  - Q&A: Exact Match + F1 + human eval
```

## Exercises

1. Compute BLEU, ROUGE, and BERTScore for 20 machine-generated summaries against reference summaries. Compare how the three metrics rank the same outputs.

2. Implement a custom F1 metric for extractive QA that measures token-level overlap between predicted and gold answer spans.

3. Design a human evaluation form for a chatbot: define 4 evaluation dimensions, create a rating rubric, and calculate inter-annotator agreement on 10 sample conversations.

4. Build an evaluation pipeline that takes a CSV of (reference, hypothesis) pairs and outputs a comprehensive report with BLEU-1/2/3/4, ROUGE-1/2/L, and BERTScore.

5. Compare BLEU sensitivity to paraphrasing: take 10 reference sentences, create paraphrased versions, and show how BLEU scores drop while BERTScore stays stable.

## Key Takeaways

```
+-------------------------------------------+
| NLP EVALUATION                            |
|                                           |
| 1. BLEU = precision of n-gram overlap    |
| 2. ROUGE = recall of n-gram overlap      |
| 3. BERTScore = semantic similarity       |
| 4. No single metric is sufficient        |
| 5. Human evaluation is gold standard     |
| 6. Always report multiple metrics        |
+-------------------------------------------+
```
