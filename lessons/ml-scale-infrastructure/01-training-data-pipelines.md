# Lesson 01: Training Data Pipelines — From the Raw Web to Training Tokens

Every large language model starts with data. Not curated textbook data —
raw, messy, petabyte-scale web crawls. The pipeline that transforms this
raw data into clean training tokens is one of the most important (and
least glamorous) parts of building a model. Get the data wrong, and no
amount of compute will save you.

---

## The Core Idea

Training data pipelines are like water treatment plants. Raw water
(web crawls) comes in full of contaminants. The plant filters, purifies,
and tests the water through multiple stages before it reaches your tap
(the model's training loop). Skip a stage, and you get bad water — or
in our case, a model that memorizes spam, generates toxic content, or
regurgitates copyrighted text verbatim.

```
The Training Data Pipeline:

  ┌──────────────┐
  │  Raw Web      │   Common Crawl, web scrapes, etc.
  │  (~petabytes) │   Hundreds of billions of pages
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Extraction   │   HTML → plain text, language detection
  │  & Filtering  │   Remove boilerplate, navigation, ads
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Quality      │   Perplexity filtering, classifier-based
  │  Filtering    │   filtering, heuristic rules
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Deduplication│   Exact dedup, fuzzy dedup (MinHash)
  │               │   URL-level, document-level, paragraph-level
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Safety       │   Toxicity filtering, PII removal,
  │  Filtering    │   copyright filtering
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Data Mixing  │   Combine web, books, code, academic papers
  │  & Sampling   │   Set ratios for each source
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Tokenization │   BPE encoding, vocabulary application
  │               │   Convert text → token IDs
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Training-    │   Shuffled, batched, ready for the
  │  Ready Data   │   training loop
  └──────────────┘
```

---

## Stage 1: Data Collection

The starting point for most LLM training is web crawl data. The largest
public source is **Common Crawl** — a nonprofit that crawls the web
monthly and makes the data freely available.

**Common Crawl by the numbers:**
- ~250 billion pages crawled (cumulative)
- ~3.5 billion pages per monthly crawl
- ~60–80 TB of compressed data per crawl
- Raw HTML, not clean text

Other data sources used in LLM training:

```
┌─────────────────────────────────────────────────────┐
│  Data Source        │  Size (approx)  │  Quality     │
├─────────────────────┼─────────────────┼──────────────┤
│  Common Crawl       │  ~60 TB/month   │  Low (raw)   │
│  Wikipedia          │  ~20 GB         │  High         │
│  Books (public)     │  ~100 GB        │  High         │
│  ArXiv papers       │  ~50 GB         │  High         │
│  GitHub code        │  ~1 TB          │  Medium       │
│  StackOverflow      │  ~50 GB         │  Medium-High  │
│  Reddit             │  ~500 GB        │  Medium       │
│  Patent filings     │  ~100 GB        │  Medium       │
└─────────────────────┴─────────────────┴──────────────┘
```

**Analogy: Grocery shopping.** Common Crawl is like buying produce from
a massive wholesale market — cheap and abundant, but you need to wash
everything, throw out the rotten stuff, and check for bugs. Wikipedia
is like buying from a premium organic store — expensive to produce but
already clean.

---

## Stage 2: Text Extraction and Language Filtering

Raw web pages are HTML with navigation bars, ads, cookie banners, and
boilerplate. The first processing step extracts just the meaningful text.

```
Raw HTML:
┌──────────────────────────────────────────┐
│ <html>                                   │
│   <nav>Home | About | Contact</nav>      │  ← Remove
│   <div class="ad">Buy widgets!</div>     │  ← Remove
│   <article>                              │
│     <h1>How Neural Networks Learn</h1>   │  ← Keep
│     <p>Neural networks adjust their      │  ← Keep
│     weights through backpropagation...</p>│  ← Keep
│   </article>                             │
│   <footer>© 2024 Example Corp</footer>   │  ← Remove
│ </html>                                  │
└──────────────────────────────────────────┘

Extracted text:
┌──────────────────────────────────────────┐
│ How Neural Networks Learn                │
│                                          │
│ Neural networks adjust their weights     │
│ through backpropagation...               │
└──────────────────────────────────────────┘
```

Tools commonly used:
- **trafilatura** — Python library for web text extraction
- **jusText** — Removes boilerplate from HTML pages
- **fastText language ID** — Classifies text language (keep English, or whatever target languages)

```python
# Example: Basic text extraction pipeline
import trafilatura

def extract_text(html_content):
    """Extract main text content from HTML."""
    text = trafilatura.extract(
        html_content,
        include_comments=False,
        include_tables=False,
        no_fallback=False
    )
    return text

def filter_language(text, target_lang='en', threshold=0.8):
    """
    Filter documents by language.
    In production, use fastText's lid.176.bin model.
    """
    # Simplified — real pipelines use fastText
    # import fasttext
    # model = fasttext.load_model('lid.176.bin')
    # predictions = model.predict(text.replace('\n', ' ')[:1000])
    # lang = predictions[0][0].replace('__label__', '')
    # confidence = predictions[1][0]
    # return lang == target_lang and confidence > threshold
    pass
```

---

## Stage 3: Quality Filtering

Not all text is useful for training. Quality filtering removes:
- Very short documents (< 50 words)
- Documents with too many special characters or numbers
- Machine-generated spam
- Low-quality content (SEO spam, auto-generated pages)

Two main approaches:

**Heuristic rules** (fast, simple):
```
Quality Heuristic Rules:
┌──────────────────────────────────────────────────┐
│  Rule                          │  Threshold       │
├────────────────────────────────┼──────────────────┤
│  Minimum word count            │  > 50 words      │
│  Maximum word count            │  < 100,000 words │
│  Fraction of alphabetic chars  │  > 0.70          │
│  Mean word length              │  3–10 characters  │
│  Fraction of lines ending '.'  │  > 0.10          │
│  Fraction of duplicate lines   │  < 0.30          │
│  Contains "lorem ipsum"        │  Reject          │
│  Curly bracket ratio (code)    │  < 0.10 *        │
└────────────────────────────────┴──────────────────┘
  * Unless specifically collecting code data
```

**Classifier-based filtering** (slower, more accurate):

Train a classifier to distinguish "high-quality" text (Wikipedia,
published books) from "low-quality" text (random web pages). Then
score every document and keep only those above a threshold.

```python
# Simplified quality scoring
def quality_score_heuristic(text):
    """Score document quality using simple heuristics."""
    words = text.split()
    if len(words) < 50:
        return 0.0

    # Check alphabetic character ratio
    alpha_chars = sum(c.isalpha() for c in text)
    total_chars = len(text)
    alpha_ratio = alpha_chars / max(total_chars, 1)

    # Check mean word length
    mean_word_len = sum(len(w) for w in words) / len(words)

    # Check duplicate line ratio
    lines = text.strip().split('\n')
    unique_lines = set(lines)
    dedup_ratio = len(unique_lines) / max(len(lines), 1)

    score = 0.0
    if alpha_ratio > 0.70:
        score += 0.33
    if 3 <= mean_word_len <= 10:
        score += 0.33
    if dedup_ratio > 0.70:
        score += 0.34

    return score
```

---

## Stage 4: Deduplication

Duplicate data is a serious problem. If the same text appears 100 times
in training data, the model memorizes it rather than learning from it.
Deduplication typically removes 30–60% of web crawl data.

Three levels of deduplication:

```
Deduplication Levels:

1. URL-level dedup (cheapest)
   ┌─────────────────────────────────────┐
   │  Same URL → keep only one copy      │
   │  Fast: just hash the URL            │
   └─────────────────────────────────────┘

2. Exact document dedup
   ┌─────────────────────────────────────┐
   │  Hash entire document content       │
   │  SHA-256 or similar                 │
   │  Catches exact copies on diff URLs  │
   └─────────────────────────────────────┘

3. Fuzzy / near-duplicate dedup (most thorough)
   ┌─────────────────────────────────────┐
   │  MinHash + LSH (Locality-Sensitive  │
   │  Hashing)                           │
   │  Catches documents that are 80%+    │
   │  similar (e.g., same article with   │
   │  different headers/footers)         │
   └─────────────────────────────────────┘
```

**MinHash** works by creating a compact "signature" for each document
based on its n-grams (word sequences). Documents with similar signatures
are likely near-duplicates.

```python
# Simplified MinHash deduplication concept
import hashlib

def get_ngrams(text, n=5):
    """Get word n-grams from text."""
    words = text.lower().split()
    return [' '.join(words[i:i+n]) for i in range(len(words) - n + 1)]

def minhash_signature(text, num_hashes=128):
    """
    Create a MinHash signature for a document.
    Real implementations use multiple hash functions.
    """
    ngrams = get_ngrams(text)
    signature = []
    for i in range(num_hashes):
        min_hash = float('inf')
        for ngram in ngrams:
            # Simulate different hash functions with salt
            h = int(hashlib.md5(
                f"{i}:{ngram}".encode()
            ).hexdigest(), 16)
            min_hash = min(min_hash, h)
        signature.append(min_hash)
    return signature

def estimated_similarity(sig1, sig2):
    """Estimate Jaccard similarity from MinHash signatures."""
    matches = sum(a == b for a, b in zip(sig1, sig2))
    return matches / len(sig1)
```

See [Lesson 08: Data Quality and Curation](./08-data-quality-curation.md)
for a deeper dive into deduplication algorithms.

---

## Stage 5: Data Mixing

Real training datasets are not just web text. They are carefully
constructed mixtures of different data sources, each contributing
different capabilities to the model.

```
Example Data Mix (inspired by published LLM training mixes):

┌────────────────────────────────────────────────────────┐
│                                                        │
│  ┌──────────────────────────────────┐                  │
│  │         Web Text (67%)           │                  │
│  │  Filtered Common Crawl           │                  │
│  └──────────────────────────────────┘                  │
│  ┌──────────────┐ ┌──────────────┐                     │
│  │  Code (15%)  │ │ Books (4.5%) │                     │
│  │  GitHub      │ │ Public domain│                     │
│  └──────────────┘ └──────────────┘                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │Wiki (4.5)│ │ArXiv (3%)│ │Stack (3%)│               │
│  └──────────┘ └──────────┘ └──────────┘               │
│  ┌────────────────┐                                    │
│  │ Other (3%)     │  Patents, legal, forums            │
│  └────────────────┘                                    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Why mixing matters:** A model trained only on web text will be
mediocre at code. A model trained only on code will be bad at
conversation. The mix determines the model's strengths.

Published data mixes:
- **LLaMA 1:** 67% Common Crawl, 15% C4, 4.5% GitHub, 4.5% Wikipedia, 4.5% books, 2.5% ArXiv, 2% StackExchange
- **The Pile:** 22.5% Pile-CC, 15.7% PubMed, 14.4% Books3, 10.1% OpenWebText2, 7.6% ArXiv, 5.4% GitHub, and 16 other sources
- **Dolma:** 75% web, 9% code, 7% Reddit, 5% academic, 3% books, 1% encyclopedic

**Upsampling and downsampling:** High-quality sources (Wikipedia, books)
are often upsampled — repeated 2–5× in the training data — because
their quality-per-token is much higher than web text.

---

## Stage 6: Tokenization at Scale

Once text is clean and mixed, it must be converted to token IDs that
the model can process. At scale, this means tokenizing trillions of
tokens efficiently.

```
Tokenization Pipeline:

  Clean text corpus          Tokenizer          Token IDs
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ "The cat sat │     │  BPE with    │     │ [464, 3797,  │
  │  on the mat" │ --> │  32K-128K    │ --> │  3332, 319,  │
  │              │     │  vocabulary  │     │  262, 2603]  │
  └──────────────┘     └──────────────┘     └──────────────┘

  At scale:
  - Input: ~1-5 TB of clean text
  - Output: ~1-2 trillion tokens
  - Time: hours to days on a cluster
  - Storage: token IDs stored as memory-mapped arrays
```

Tokenization is embarrassingly parallel — each document can be
tokenized independently. Production pipelines use tools like:
- **SentencePiece** — Google's tokenizer library
- **tiktoken** — OpenAI's fast BPE tokenizer
- **Hugging Face tokenizers** — Rust-based, very fast

```python
# Example: Tokenizing a dataset at scale
# In production, this runs on hundreds of workers in parallel

def tokenize_document(text, tokenizer, max_length=2048):
    """Tokenize a single document into fixed-length chunks."""
    token_ids = tokenizer.encode(text)
    # Split into chunks of max_length
    chunks = []
    for i in range(0, len(token_ids), max_length):
        chunk = token_ids[i:i + max_length]
        if len(chunk) == max_length:  # Only keep full chunks
            chunks.append(chunk)
    return chunks

# Pseudocode for parallel tokenization
# from multiprocessing import Pool
# with Pool(num_workers) as pool:
#     all_chunks = pool.map(tokenize_fn, documents)
```

---

## Putting It All Together: The Full Pipeline

Here is the complete pipeline with approximate data sizes at each stage,
based on published numbers from LLaMA and similar projects:

```
Full Pipeline with Data Sizes:

  Common Crawl (1 snapshot)
  ├── Raw: ~60 TB compressed HTML
  │
  ├── After text extraction: ~15 TB plain text
  │   (removed HTML, boilerplate, non-text)
  │
  ├── After language filtering: ~8 TB
  │   (kept English only)
  │
  ├── After quality filtering: ~4 TB
  │   (removed low-quality documents)
  │
  ├── After deduplication: ~1.5 TB
  │   (removed 60%+ duplicates)
  │
  ├── After safety filtering: ~1.3 TB
  │   (removed toxic/PII content)
  │
  ├── Mixed with other sources: ~2 TB total
  │   (added books, code, Wikipedia, etc.)
  │
  └── After tokenization: ~1.5 trillion tokens
      (stored as memory-mapped int32 arrays)

  Compression ratio: ~60 TB → ~2 TB usable text
  That is roughly 97% removed.
```

---

## Connection to ML

The quality of training data directly determines model quality. This is
not a minor detail — it is arguably the most important factor:

- **Garbage in, garbage out** — A model trained on spam will generate spam
- **Data determines capabilities** — No code in training data = no code generation ability
- **Deduplication prevents memorization** — Duplicate data leads to verbatim regurgitation
- **Mixing ratios shape behavior** — More code data = better at code, less at conversation

See [Lesson 08: Data Quality and Curation](./08-data-quality-curation.md)
for deeper coverage of quality filtering and deduplication algorithms.

See [Track 8, Lesson 02: Tokenization](../llms-transformers/02-tokenization.md)
for how tokenizers work at the algorithmic level.

---

## Exercises

### Exercise 1: Pipeline Math

A single Common Crawl snapshot contains approximately 3.5 billion web
pages. If each page averages 5 KB of extracted text:

```python
# TODO: Calculate the total raw text size in TB
# TODO: If quality filtering removes 70% and deduplication removes
#       another 60% of what remains, how much text is left?
# TODO: If the average token is ~4 characters, how many tokens
#       does the final dataset contain?
# TODO: Compare your answer to published numbers
#       (LLaMA 1 trained on 1.4 trillion tokens)
```

### Exercise 2: Design a Data Mix

You are building a model optimized for helping software developers.
Design a data mix with at least 5 sources. For each source, specify:
- The source name
- The approximate percentage of the total mix
- Why you included it and at that ratio

Consider: What happens if you use too much code? Too little natural
language? How would you handle the fact that most code on GitHub is
low quality?

### Exercise 3: Deduplication Impact

```python
# Simulate the impact of deduplication on a small dataset
import hashlib
import random

def generate_corpus(num_docs=1000, duplicate_rate=0.4):
    """Generate a corpus with controlled duplication."""
    unique_docs = [
        f"Document {i}: " + " ".join(
            random.choices(
                ["the", "cat", "sat", "on", "mat", "dog",
                 "ran", "fast", "big", "small"],
                k=random.randint(20, 100)
            )
        )
        for i in range(int(num_docs * (1 - duplicate_rate)))
    ]
    # Add duplicates
    duplicates = random.choices(
        unique_docs,
        k=num_docs - len(unique_docs)
    )
    corpus = unique_docs + duplicates
    random.shuffle(corpus)
    return corpus

# TODO: Generate a corpus with 40% duplication
# TODO: Implement exact deduplication using SHA-256 hashes
# TODO: Report: original size, deduplicated size, % removed
# TODO: What happens to model training if you skip this step?
```

---

Next: [Lesson 02: Compute Planning and Scaling Laws](./02-compute-planning.md)
