# Lesson 08: Data Quality and Curation — The Art of Building a Good Dataset

Data quality is the single biggest lever you have for improving model
performance. A smaller model trained on excellent data consistently
outperforms a larger model trained on mediocre data. This lesson dives
deep into the techniques for filtering, deduplicating, and curating
training data at scale.

---

## The Core Idea

Data curation is like editing a newspaper. You start with thousands of
submissions (raw web crawls). Most are not publishable — some are spam,
some are duplicates, some are offensive, some are just poorly written.
The editor's job is to select, clean, and arrange the best content into
a coherent publication. The quality of the newspaper depends more on the
editor than on the volume of submissions.

```
Data Quality Impact:

  Same compute budget, different data quality:

  ┌──────────────────────────────────────────────────┐
  │  Loss                                            │
  │  │                                               │
  │  │╲  Low quality data                            │
  │  │ ╲                                             │
  │  │  ╲___                                         │
  │  │      ╲_____                                   │
  │  │            ╲___________  ← plateaus early     │
  │  │                                               │
  │  │╲  High quality data                           │
  │  │ ╲                                             │
  │  │  ╲                                            │
  │  │   ╲___                                        │
  │  │       ╲___                                    │
  │  │           ╲_____                              │
  │  │                 ╲________  ← keeps improving  │
  │  └──────────────────────────────────────────→    │
  │                  Training Steps                  │
  └──────────────────────────────────────────────────┘
```

---

## Quality Filtering Techniques

### Heuristic Filtering

Fast, rule-based filters that catch obvious low-quality content:

```
Heuristic Filter Pipeline:

  Document
     │
     ├── Length filter: 50 < words < 100,000
     │   (removes empty pages and data dumps)
     │
     ├── Character filter: >70% alphabetic
     │   (removes code dumps, base64, binary)
     │
     ├── Word length filter: 3 < mean_word_len < 10
     │   (removes gibberish, URL lists)
     │
     ├── Repetition filter: <30% duplicate lines
     │   (removes boilerplate-heavy pages)
     │
     ├── Sentence filter: >10% lines end with punctuation
     │   (removes lists, navigation, menus)
     │
     ├── Stopword filter: contains common words
     │   (removes non-natural-language content)
     │
     └── Blocklist filter: no banned patterns
         (removes known spam, adult content markers)
```

```python
def heuristic_quality_filter(text):
    """
    Apply heuristic quality filters to a document.
    Returns True if the document passes all filters.
    """
    words = text.split()

    # Length filter
    if len(words) < 50 or len(words) > 100000:
        return False

    # Character ratio
    alpha_chars = sum(c.isalpha() for c in text)
    if alpha_chars / max(len(text), 1) < 0.70:
        return False

    # Mean word length
    mean_len = sum(len(w) for w in words) / len(words)
    if mean_len < 3 or mean_len > 10:
        return False

    # Duplicate line ratio
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if lines:
        unique_ratio = len(set(lines)) / len(lines)
        if unique_ratio < 0.70:
            return False

    # Sentence ending ratio
    if lines:
        ends_with_punct = sum(
            1 for l in lines if l[-1] in '.!?'
        )
        if ends_with_punct / len(lines) < 0.10:
            return False

    return True
```

### Classifier-Based Filtering

Train a binary classifier to distinguish "high-quality" from
"low-quality" text. The classifier is trained on:
- **Positive examples:** Wikipedia, published books, curated web content
- **Negative examples:** Random web crawl samples

```
Classifier-Based Quality Filtering:

  Training the classifier:
  ┌──────────────────────────────────────────────────┐
  │  Positive (high quality):                        │
  │  - Wikipedia articles                            │
  │  - Published books                               │
  │  - Curated web content (OpenWebText)             │
  │                                                  │
  │  Negative (low quality):                         │
  │  - Random Common Crawl samples                   │
  │                                                  │
  │  Model: fastText classifier or small transformer │
  │  Features: n-grams, perplexity, text statistics  │
  └──────────────────────────────────────────────────┘

  Using the classifier:
  ┌──────────────────────────────────────────────────┐
  │  For each document in the corpus:                │
  │    score = classifier.predict(document)          │
  │    if score > threshold:                         │
  │      keep(document)                              │
  │    else:                                         │
  │      discard(document)                           │
  │                                                  │
  │  Threshold tuning:                               │
  │    High threshold → less data, higher quality    │
  │    Low threshold  → more data, lower quality     │
  │    Sweet spot: usually keeps 20-40% of web data  │
  └──────────────────────────────────────────────────┘
```

### Perplexity Filtering

Use a pre-trained language model to score documents. Documents with
very high perplexity (the model finds them surprising) are likely
low quality.

```
Perplexity Filtering:

  ┌──────────────────────────────────────────────────┐
  │  Perplexity = exp(average negative log-likelihood)│
  │                                                  │
  │  Low perplexity (~50-200):                       │
  │    Well-written, coherent text                   │
  │    "The cat sat on the mat."                     │
  │                                                  │
  │  Medium perplexity (~200-500):                   │
  │    Informal but readable text                    │
  │    Forum posts, casual writing                   │
  │                                                  │
  │  High perplexity (>500):                         │
  │    Garbled, machine-generated, or non-English    │
  │    "asdf jkl; qwerty uiop zxcv"                 │
  │                                                  │
  │  Filter: Keep documents with perplexity < threshold│
  └──────────────────────────────────────────────────┘
```

---

## Deduplication Algorithms

Deduplication is critical. Duplicate data causes models to memorize
rather than generalize, and can lead to verbatim regurgitation of
training data.

### Exact Deduplication

The simplest approach: hash each document and remove exact copies.

```python
import hashlib

def exact_dedup(documents):
    """Remove exact duplicate documents using SHA-256."""
    seen_hashes = set()
    unique_docs = []

    for doc in documents:
        # Normalize whitespace before hashing
        normalized = ' '.join(doc.split())
        doc_hash = hashlib.sha256(normalized.encode()).hexdigest()

        if doc_hash not in seen_hashes:
            seen_hashes.add(doc_hash)
            unique_docs.append(doc)

    removed = len(documents) - len(unique_docs)
    print(f"Removed {removed} exact duplicates "
          f"({removed/len(documents)*100:.1f}%)")
    return unique_docs
```

### MinHash for Near-Duplicate Detection

MinHash estimates the Jaccard similarity between documents using
compact signatures. Combined with LSH (Locality-Sensitive Hashing),
it efficiently finds near-duplicates in massive datasets.

```
MinHash + LSH Pipeline:

  Step 1: Shingling
  ┌──────────────────────────────────────────────────┐
  │  Document: "the cat sat on the mat"              │
  │  5-grams: {"the cat sat on the",                 │
  │            "cat sat on the mat"}                  │
  └──────────────────────────────────────────────────┘

  Step 2: MinHash Signature
  ┌──────────────────────────────────────────────────┐
  │  Apply k hash functions to all shingles          │
  │  Keep minimum hash value for each function       │
  │  Result: k-dimensional signature vector          │
  │                                                  │
  │  Doc A signature: [42, 17, 93, 5, 71, ...]      │
  │  Doc B signature: [42, 17, 88, 5, 71, ...]      │
  │  Similarity ≈ fraction of matching values        │
  └──────────────────────────────────────────────────┘

  Step 3: LSH Banding
  ┌──────────────────────────────────────────────────┐
  │  Split signature into b bands of r rows          │
  │  Hash each band separately                       │
  │  Documents that share a band hash are candidates │
  │                                                  │
  │  Tuning b and r controls the similarity threshold│
  │  b=20, r=5 → catches pairs with ~80% similarity │
  └──────────────────────────────────────────────────┘

  Step 4: Verify Candidates
  ┌──────────────────────────────────────────────────┐
  │  For each candidate pair:                        │
  │    Compute exact Jaccard similarity              │
  │    If similarity > threshold: mark as duplicate  │
  │    Keep one copy, remove the rest                │
  └──────────────────────────────────────────────────┘
```

```python
# Simplified MinHash implementation
import hashlib
import random

class MinHashDedup:
    def __init__(self, num_hashes=128, ngram_size=5,
                 similarity_threshold=0.8):
        self.num_hashes = num_hashes
        self.ngram_size = ngram_size
        self.threshold = similarity_threshold
        # Generate random hash parameters
        self.hash_params = [
            (random.randint(1, 2**31), random.randint(0, 2**31))
            for _ in range(num_hashes)
        ]

    def get_ngrams(self, text):
        """Extract word n-grams from text."""
        words = text.lower().split()
        return set(
            ' '.join(words[i:i+self.ngram_size])
            for i in range(len(words) - self.ngram_size + 1)
        )

    def minhash(self, text):
        """Compute MinHash signature for a document."""
        ngrams = self.get_ngrams(text)
        signature = []
        for a, b in self.hash_params:
            min_val = float('inf')
            for ngram in ngrams:
                h = int(hashlib.md5(ngram.encode()).hexdigest(), 16)
                hash_val = (a * h + b) % (2**32)
                min_val = min(min_val, hash_val)
            signature.append(min_val)
        return signature

    def similarity(self, sig1, sig2):
        """Estimate Jaccard similarity from signatures."""
        return sum(a == b for a, b in zip(sig1, sig2)) / len(sig1)
```

---

## Toxicity Filtering

Removing toxic, harmful, or offensive content from training data:

```
Toxicity Filtering Pipeline:

  ┌──────────────────────────────────────────────────┐
  │  1. Keyword/regex blocklists                     │
  │     Fast first pass, catches obvious content     │
  │     High recall, low precision                   │
  │                                                  │
  │  2. Classifier-based filtering                   │
  │     Perspective API, custom toxicity classifiers  │
  │     Better precision, slower                     │
  │                                                  │
  │  3. URL-based filtering                          │
  │     Block known adult/toxic domains              │
  │     Very fast, limited coverage                  │
  │                                                  │
  │  Trade-off:                                      │
  │  ┌────────────────────────────────────────┐      │
  │  │  Too aggressive → removes legitimate   │      │
  │  │  content about sensitive topics        │      │
  │  │  (medical, legal, historical)          │      │
  │  │                                        │      │
  │  │  Too lenient → model learns to         │      │
  │  │  generate toxic content                │      │
  │  └────────────────────────────────────────┘      │
  └──────────────────────────────────────────────────┘
```

---

## PII Removal

Personally Identifiable Information must be removed or redacted:

```
PII Detection and Removal:

  Types of PII:
  ┌──────────────────────────────────────────────────┐
  │  Type              │  Detection Method            │
  ├────────────────────┼──────────────────────────────┤
  │  Email addresses   │  Regex                       │
  │  Phone numbers     │  Regex + format detection    │
  │  Social Security   │  Regex + validation          │
  │  Credit cards      │  Regex + Luhn check          │
  │  Physical addresses│  NER (Named Entity Recog.)   │
  │  Names             │  NER (hardest to detect)     │
  │  IP addresses      │  Regex                       │
  │  URLs with PII     │  Regex + heuristics          │
  └────────────────────┴──────────────────────────────┘

  Strategies:
  - Redaction: Replace PII with placeholder tokens
    "[EMAIL]", "[PHONE]", "[NAME]"
  - Removal: Delete documents containing PII
  - Synthetic replacement: Replace real PII with fake data
```

---

## Data Mixing Ratios

The ratio of different data sources in the training mix significantly
affects model capabilities:

```
Data Mixing Strategies:

  Strategy 1: Proportional to source size
  ┌──────────────────────────────────────────────────┐
  │  Each source sampled proportional to its size    │
  │  Web (95%), Code (3%), Books (1%), Wiki (1%)     │
  │  Problem: Web dominates, model weak at code      │
  └──────────────────────────────────────────────────┘

  Strategy 2: Upsampling high-quality sources
  ┌──────────────────────────────────────────────────┐
  │  High-quality sources repeated multiple times    │
  │  Web (67%), Code (15%), Books (5%), Wiki (5%)    │
  │  Wikipedia seen 3-5× during training             │
  │  Better balance of capabilities                  │
  └──────────────────────────────────────────────────┘

  Strategy 3: Domain-weighted mixing
  ┌──────────────────────────────────────────────────┐
  │  Weights tuned for target capabilities           │
  │  Coding model: Code (40%), Web (40%), Docs (20%) │
  │  Chat model: Web (60%), Dialog (20%), Code (10%) │
  │  Weights found through ablation experiments      │
  └──────────────────────────────────────────────────┘
```

---

## Synthetic Data Generation

Increasingly, training data includes synthetically generated content:

```
Synthetic Data Uses:

  ┌──────────────────────────────────────────────────┐
  │  Use Case              │  Method                  │
  ├────────────────────────┼──────────────────────────┤
  │  Math/reasoning data   │  Generate problems +     │
  │                        │  verify solutions        │
  │  Code data             │  Generate code + run     │
  │                        │  tests to verify         │
  │  Instruction data      │  Distill from stronger   │
  │                        │  model (with permission) │
  │  Multilingual data     │  Translate high-quality  │
  │                        │  English content         │
  │  Safety data           │  Generate adversarial    │
  │                        │  examples + safe responses│
  └────────────────────────┴──────────────────────────┘

  Risks of synthetic data:
  - Model collapse: training on own outputs degrades quality
  - Amplifying biases from the generating model
  - Reduced diversity compared to real data
  - Quality verification is essential
```

---

## Connection to ML

Data quality connects to every other lesson in this track:

- **Training data pipelines** are the first stage of quality control. See [Lesson 01](./01-training-data-pipelines.md).
- **Compute planning** depends on dataset size, which depends on how much data survives filtering. See [Lesson 02](./02-compute-planning.md).
- **Evaluation** can reveal data quality issues (contamination, bias). See [Lesson 07](./07-evaluation-at-scale.md).

See [Track 8, Lesson 02: Tokenization](../llms-transformers/02-tokenization.md)
for how tokenization interacts with data quality.

---

## Exercises

### Exercise 1: Quality Filter Implementation

```python
# Implement a complete quality filtering pipeline
# that combines multiple heuristic filters.

def quality_pipeline(documents):
    """
    Apply a multi-stage quality filter to a list of documents.
    Return the filtered documents and statistics.
    """
    stats = {
        'input': len(documents),
        'removed_length': 0,
        'removed_alpha': 0,
        'removed_repetition': 0,
        'output': 0,
    }

    # TODO: Implement each filter stage
    # TODO: Track how many documents each stage removes
    # TODO: Return filtered documents and stats
    # TODO: What percentage of documents survive all filters?

    return filtered_docs, stats
```

### Exercise 2: Deduplication at Scale

```python
# Given a corpus of 10,000 short documents (simulated),
# implement and compare exact vs fuzzy deduplication.

import random
import time

def generate_test_corpus(n=10000, dup_rate=0.3, near_dup_rate=0.1):
    """Generate a test corpus with exact and near duplicates."""
    # TODO: Generate unique documents
    # TODO: Add exact duplicates (dup_rate)
    # TODO: Add near-duplicates with small modifications (near_dup_rate)
    pass

# TODO: Implement exact dedup (SHA-256)
# TODO: Implement MinHash near-dedup
# TODO: Compare: how many duplicates does each method find?
# TODO: Time both methods. Which is faster?
```

### Exercise 3: Data Mix Design

You are building a model optimized for medical question answering.
Design a data mix with at least 6 sources. For each source:
- Name and description
- Approximate percentage of the mix
- Quality level (high/medium/low)
- Whether you would upsample or downsample it
- Any special filtering needed (PII is critical for medical data)

---

Next: [Lesson 09: Capstone — Plan a Training Run](./09-capstone-plan-training-run.md)
