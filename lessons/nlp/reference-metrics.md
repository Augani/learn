# Reference: NLP Evaluation Metrics Explained

## Classification Metrics

```
CONFUSION MATRIX

                    Predicted
                 Positive  Negative
  Actual   Pos  [  TP  ] [  FN  ]
           Neg  [  FP  ] [  TN  ]

  Precision = TP / (TP + FP)    "Of predicted positives, how many correct?"
  Recall    = TP / (TP + FN)    "Of actual positives, how many found?"
  F1        = 2 * P * R / (P+R) "Harmonic mean of precision and recall"
  Accuracy  = (TP+TN) / Total   "Overall correctness"

  USE PRECISION WHEN: False positives are costly (spam detection)
  USE RECALL WHEN:    False negatives are costly (disease detection)
  USE F1 WHEN:        You need balance between precision and recall
```

## Token-Level Metrics (NER, QA)

```
EXACT MATCH (EM)

  Predicted: "Barack Obama"
  Gold:      "Barack Obama"
  EM = 1 (exact match)

  Predicted: "Obama"
  Gold:      "Barack Obama"
  EM = 0 (not exact)


TOKEN F1

  Predicted tokens: {"Obama"}
  Gold tokens:      {"Barack", "Obama"}

  Precision = |{"Obama"} ∩ {"Barack","Obama"}| / |{"Obama"}| = 1/1 = 1.0
  Recall    = |{"Obama"} ∩ {"Barack","Obama"}| / |{"Barack","Obama"}| = 1/2 = 0.5
  F1 = 2 * 1.0 * 0.5 / (1.0 + 0.5) = 0.667


SEQEVAL (NER-specific)

  Evaluates entity spans, not individual tokens.
  An entity is correct only if BOTH the type AND boundaries match.

  Gold:      [B-PER, I-PER, O, B-LOC]   = "Barack Obama" (PER), "Paris" (LOC)
  Predicted: [B-PER, O,     O, B-LOC]   = "Barack" (PER), "Paris" (LOC)

  PER: Predicted "Barack" but gold is "Barack Obama" -> wrong boundary -> FP + FN
  LOC: Predicted "Paris" = gold "Paris" -> TP
```

## Generation Metrics

```
BLEU (Bilingual Evaluation Understudy)

  Measures: n-gram precision of generated text vs reference
  Range:    0-1 (higher = better)
  Used for: Machine translation

  BLEU-1: unigram precision
  BLEU-2: bigram precision
  BLEU-4: 4-gram precision (standard)

  Formula: BP * exp(sum(w_n * log(p_n)))
  BP = brevity penalty (penalizes short outputs)
  p_n = modified n-gram precision
  w_n = weight (usually 1/4 each for BLEU-4)

  Thresholds (translation):
  < 0.10  = poor
  0.10-0.20 = below average
  0.20-0.30 = reasonable
  0.30-0.40 = good
  > 0.40 = very good


ROUGE (Recall-Oriented Understudy for Gisting Evaluation)

  Measures: n-gram recall of reference in generated text
  Range:    0-1 (higher = better)
  Used for: Summarization

  ROUGE-1:  Unigram recall
  ROUGE-2:  Bigram recall
  ROUGE-L:  Longest Common Subsequence
  ROUGE-Lsum: Sentence-level LCS (for multi-sentence)

  Each reports: Precision, Recall, F-measure
  Usually report F-measure.


BERTScore

  Measures: Semantic similarity using contextual embeddings
  Range:    0-1 (higher = better)
  Used for: Any generation task

  Process:
  1. Encode reference and candidate with BERT
  2. Compute pairwise cosine similarity matrix
  3. Greedy match: each token matches its most similar counterpart
  4. Average matched similarities

  Reports: Precision, Recall, F1
  Advantage: Captures paraphrases that BLEU/ROUGE miss


METEOR

  Measures: Unigram matching with stemming and synonyms
  Range:    0-1 (higher = better)
  Used for: Machine translation

  Better correlation with human judgment than BLEU.
  Considers: exact match, stem match, synonym match.
```

## Perplexity

```
PERPLEXITY

  Measures: How surprised the model is by the text
  Range:    1 to infinity (lower = better)
  Used for: Language model evaluation

  Formula: exp(-1/N * sum(log P(token_i | context)))

  Intuition:
  Perplexity = 10  -> model is choosing from ~10 equally likely tokens
  Perplexity = 100 -> model is choosing from ~100 equally likely tokens

  Lower perplexity = model predicts text better
  Not comparable across different vocabularies/tokenizers!
```

## Retrieval Metrics

```
RETRIEVAL METRICS

  Precision@K:  Of top K results, how many are relevant?
  Recall@K:     Of all relevant docs, how many are in top K?
  MRR:          1/rank of first relevant result
  nDCG@K:       Discounted cumulative gain (rewards early relevance)
  MAP:          Mean Average Precision across queries

  Example (10 results, R=relevant, N=not relevant):

  Rank:  1  2  3  4  5  6  7  8  9  10
  Label: R  N  R  N  N  R  N  N  N  N

  P@1 = 1/1 = 1.0
  P@3 = 2/3 = 0.67
  P@5 = 2/5 = 0.40

  MRR = 1/1 = 1.0  (first relevant at rank 1)

  AP = (1/1 + 2/3 + 3/6) / 3 = (1.0 + 0.67 + 0.5) / 3 = 0.72

  nDCG accounts for position: relevant results at rank 1
  are worth more than at rank 10.
```

## Metric Selection Guide

```
+-------------------+--------------------+--------------------+
| Task              | Primary Metrics    | Secondary          |
+-------------------+--------------------+--------------------+
| Classification    | F1, Accuracy       | Precision, Recall  |
| Multi-class       | Macro-F1, Weighted | Per-class F1       |
| NER               | Entity F1 (seqeval)| Per-type F1        |
| Translation       | BLEU, COMET        | chrF, TER          |
| Summarization     | ROUGE-1/2/L        | BERTScore          |
| Question Answer   | EM, Token F1       | ROUGE-L            |
| Text Generation   | BERTScore, Human   | Perplexity         |
| Retrieval         | MRR, nDCG@10       | P@K, Recall@K      |
| Semantic Sim      | Spearman corr.     | Pearson corr.      |
+-------------------+--------------------+--------------------+
```

## Computing Metrics Quick Reference

```python
from evaluate import load

bleu = load("bleu")
result = bleu.compute(
    predictions=["the cat sat"],
    references=[["the cat sat on the mat"]],
)

rouge = load("rouge")
result = rouge.compute(
    predictions=["the cat sat"],
    references=["the cat sat on the mat"],
)

bertscore = load("bertscore")
result = bertscore.compute(
    predictions=["the cat sat"],
    references=["the cat sat on the mat"],
    lang="en",
)

accuracy = load("accuracy")
result = accuracy.compute(
    predictions=[0, 1, 1, 0],
    references=[0, 1, 0, 0],
)

f1 = load("f1")
result = f1.compute(
    predictions=[0, 1, 1, 0],
    references=[0, 1, 0, 0],
    average="macro",
)

seqeval = load("seqeval")
result = seqeval.compute(
    predictions=[["B-PER", "I-PER", "O", "B-LOC"]],
    references=[["B-PER", "I-PER", "O", "B-LOC"]],
)
```
