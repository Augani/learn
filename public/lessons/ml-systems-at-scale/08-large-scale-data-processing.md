# Lesson 08: Large-Scale Data Processing

> **Analogy**: Preparing ingredients for a restaurant chain.
> A single restaurant can buy from the local market and prep
> in the kitchen. A chain with 500 locations needs industrial
> supply chains, central processing plants, quality control labs,
> and distribution logistics. Training data at scale is the same
> -- the techniques that work for 10 GB datasets break down
> completely at 10 TB.

---

## The Data Processing Pipeline

```
Raw Data (100+ TB)
     |
     v
+--------------------+
| Collection         |  Web crawl, APIs, licensed data
+--------------------+
     |
     v
+--------------------+
| Filtering          |  Language ID, quality scoring, dedup
+--------------------+
     |
     v
+--------------------+
| Cleaning           |  HTML removal, normalization, PII redaction
+--------------------+
     |
     v
+--------------------+
| Deduplication      |  Exact dedup, fuzzy/near dedup (MinHash)
+--------------------+
     |
     v
+--------------------+
| Tokenization       |  BPE/SentencePiece encoding
+--------------------+
     |
     v
+--------------------+
| Sharding           |  Pack into training-ready format
+--------------------+
     |
     v
Training-Ready Data (10-50 TB tokenized)
```

---

## Apache Spark for ML Data Processing

Spark is the workhorse for processing terabytes of text data.
It distributes computation across a cluster and handles
fault tolerance automatically.

### Setting Up a Spark Cluster for Data Processing

```bash
spark-submit \
  --master yarn \
  --deploy-mode cluster \
  --num-executors 100 \
  --executor-cores 8 \
  --executor-memory 32g \
  --driver-memory 16g \
  --conf spark.sql.shuffle.partitions=2000 \
  --conf spark.default.parallelism=2000 \
  --conf spark.sql.adaptive.enabled=true \
  process_data.py
```

### Quality Filtering

```python
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import FloatType, BooleanType
import re

spark = SparkSession.builder.appName("DataFilter").getOrCreate()

raw = spark.read.parquet("s3://data-bucket/raw-crawl/")

@F.udf(returnType=FloatType())
def text_quality_score(text):
    if text is None or len(text) < 100:
        return 0.0

    words = text.split()
    if len(words) < 20:
        return 0.0

    unique_words = set(w.lower() for w in words)
    word_diversity = len(unique_words) / len(words)

    alpha_ratio = sum(1 for c in text if c.isalpha()) / max(len(text), 1)

    avg_word_len = sum(len(w) for w in words) / len(words)
    word_len_score = 1.0 if 3 < avg_word_len < 12 else 0.5

    lines = text.split('\n')
    non_empty_lines = [l for l in lines if l.strip()]
    avg_line_len = sum(len(l) for l in non_empty_lines) / max(len(non_empty_lines), 1)
    line_score = 1.0 if avg_line_len > 40 else 0.5

    score = (word_diversity * 0.3 + alpha_ratio * 0.3 +
             word_len_score * 0.2 + line_score * 0.2)
    return float(score)

@F.udf(returnType=BooleanType())
def passes_heuristic_filters(text):
    if text is None:
        return False

    if len(text) < 200 or len(text) > 1_000_000:
        return False

    words = text.split()
    if len(words) < 50:
        return False

    upper_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)
    if upper_ratio > 0.3:
        return False

    if text.count('...') > 10 or text.count('!!!') > 5:
        return False

    if re.search(r'(.{20,})\1{3,}', text):
        return False

    return True

filtered = (
    raw
    .filter(F.col("text").isNotNull())
    .filter(passes_heuristic_filters(F.col("text")))
    .withColumn("quality_score", text_quality_score(F.col("text")))
    .filter(F.col("quality_score") > 0.4)
)

filtered.write.parquet("s3://data-bucket/filtered/", mode="overwrite")
```

---

## Deduplication at Scale

Duplicate data degrades model quality. Studies show that
deduplication improves perplexity and reduces memorization.

### Exact Deduplication

Fast but misses near-duplicates:

```python
from pyspark.sql import functions as F
import hashlib

@F.udf
def content_hash(text):
    normalized = ' '.join(text.lower().split())
    return hashlib.sha256(normalized.encode()).hexdigest()

deduped = (
    filtered
    .withColumn("hash", content_hash(F.col("text")))
    .dropDuplicates(["hash"])
    .drop("hash")
)
```

### Near-Deduplication with MinHash LSH

Near-dedup catches documents that are mostly identical but
differ in headers, footers, timestamps, or minor edits.

```
MinHash Deduplication Pipeline:

  Document -> Extract n-grams -> MinHash signature -> LSH buckets

  Example:
  Doc A: "The quick brown fox jumps over the lazy dog"
  Doc B: "The quick brown fox jumps over a lazy dog"

  5-grams of A: {"The q", "he qu", "e qui", "quic", ...}
  5-grams of B: {"The q", "he qu", "e qui", "quic", ...}

  Jaccard similarity: |A ∩ B| / |A ∪ B| = very high

  MinHash approximates Jaccard with fixed-size signatures.
  LSH groups similar signatures into buckets.
  Documents in the same bucket are candidate duplicates.
```

```python
from datasketch import MinHash, MinHashLSH
from pyspark.sql import functions as F

def create_minhash(text, num_perm=128):
    mh = MinHash(num_perm=num_perm)
    ngrams = set()
    words = text.lower().split()
    for i in range(len(words) - 4):
        ngram = ' '.join(words[i:i+5])
        ngrams.add(ngram)

    for ngram in ngrams:
        mh.update(ngram.encode('utf-8'))
    return mh

lsh = MinHashLSH(threshold=0.8, num_perm=128)

documents = filtered.select("id", "text").collect()
duplicates = set()

for doc in documents:
    mh = create_minhash(doc.text)
    result = lsh.query(mh)

    if result:
        duplicates.add(doc.id)
    else:
        lsh.insert(doc.id, mh)
```

For truly large-scale dedup (billions of documents), use
the suffix array approach from the "Deduplicating Training
Data" paper, or tools like `text-dedup`:

```bash
pip install text-dedup

python -m text_dedup.minhash \
  --path /data/filtered \
  --output /data/deduped \
  --column text \
  --ngram 5 \
  --num-perm 256 \
  --threshold 0.8 \
  --num-workers 64
```

---

## Ray Data: Python-Native Parallel Processing

Ray Data is increasingly popular as an alternative to Spark
for ML data pipelines. It's Python-native, GPU-aware, and
integrates with the PyTorch ecosystem.

```python
import ray

ray.init()

ds = ray.data.read_parquet("s3://data-bucket/raw/")

def quality_filter(batch):
    mask = []
    for text in batch["text"]:
        words = text.split() if text else []
        passes = (
            len(words) >= 50 and
            len(set(w.lower() for w in words)) / max(len(words), 1) > 0.3
        )
        mask.append(passes)
    return {k: [v for v, m in zip(batch[k], mask) if m] for k in batch}

def clean_text(batch):
    import re
    cleaned = []
    for text in batch["text"]:
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        text = re.sub(r'http\S+', '', text)
        cleaned.append(text)
    batch["text"] = cleaned
    return batch

def tokenize(batch):
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-7b-hf")
    tokens = tokenizer(
        batch["text"],
        truncation=True,
        max_length=4096,
        return_attention_mask=False,
    )
    batch["input_ids"] = tokens["input_ids"]
    return batch

processed = (
    ds
    .map_batches(quality_filter, batch_format="numpy")
    .map_batches(clean_text, batch_format="numpy")
    .map_batches(tokenize, batch_format="numpy", num_gpus=0, num_cpus=4)
)

processed.write_parquet("s3://data-bucket/processed/")
```

### Ray vs Spark for ML Data

```
+----------------------+------------------+---------------------+
| Aspect               | Spark            | Ray Data            |
+----------------------+------------------+---------------------+
| Language             | Scala/PySpark    | Native Python       |
| GPU support          | Limited          | First-class         |
| ML library compat    | Needs wrappers   | Direct PyTorch/HF   |
| Cluster setup        | Heavyweight      | Lightweight         |
| Shuffle/join perf    | Excellent        | Good, not as robust |
| Fault tolerance      | Mature           | Good                |
| Data size sweet spot | 1 TB - 1 PB     | 100 GB - 100 TB    |
+----------------------+------------------+---------------------+

Use Spark when: processing petabyte-scale data with complex
  SQL-like transformations and joins.
Use Ray when: the pipeline is mostly Python/PyTorch transforms
  and you want GPU-accelerated processing.
```

---

## Tokenization Pipelines

Tokenization is deceptively expensive at scale. A 10 TB text
corpus takes hours to tokenize even with fast tokenizers.

### Parallel Tokenization with multiprocessing

```python
import numpy as np
from transformers import AutoTokenizer
from multiprocessing import Pool
import os

def tokenize_file(args):
    filepath, output_dir, tokenizer_name = args
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_name)

    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    tokens = tokenizer.encode(text)
    token_array = np.array(tokens, dtype=np.uint16)

    output_path = os.path.join(
        output_dir,
        os.path.basename(filepath) + '.bin'
    )
    token_array.tofile(output_path)
    return len(tokens)

def tokenize_dataset(input_dir, output_dir, tokenizer_name, num_workers=64):
    os.makedirs(output_dir, exist_ok=True)

    files = [
        os.path.join(input_dir, f)
        for f in os.listdir(input_dir)
        if f.endswith('.txt')
    ]

    args = [(f, output_dir, tokenizer_name) for f in files]

    with Pool(num_workers) as pool:
        results = pool.map(tokenize_file, args)

    total_tokens = sum(results)
    print(f"Tokenized {len(files)} files, {total_tokens:,} total tokens")

    merge_binary_files(output_dir)

def merge_binary_files(directory):
    bin_files = sorted(
        [os.path.join(directory, f)
         for f in os.listdir(directory)
         if f.endswith('.bin')]
    )

    total_tokens = sum(
        os.path.getsize(f) // 2 for f in bin_files
    )

    merged = np.memmap(
        os.path.join(directory, 'train.bin'),
        dtype=np.uint16,
        mode='w+',
        shape=(total_tokens,)
    )

    offset = 0
    for bf in bin_files:
        tokens = np.fromfile(bf, dtype=np.uint16)
        merged[offset:offset + len(tokens)] = tokens
        offset += len(tokens)

    merged.flush()
    print(f"Merged into {total_tokens:,} tokens")
```

### Tokenization Performance

```
Tokenizer speeds (approximate, single thread):

  HuggingFace fast tokenizer (Rust):  ~2 MB/s
  SentencePiece:                      ~1.5 MB/s
  tiktoken:                           ~3 MB/s

  10 TB corpus, single thread at 3 MB/s:
    10 TB / 3 MB/s = 3.3 million seconds = 38 days

  With 128 CPU cores:
    38 days / 128 = ~7 hours  (if I/O isn't the bottleneck)
```

---

## Data Quality at Scale

Bad data is the #1 cause of poor model performance. At scale,
manual inspection is impossible. You need automated quality checks.

### Quality Metrics Pipeline

```python
from pyspark.sql import functions as F

def compute_data_quality_report(df):
    report = {}

    report['total_documents'] = df.count()
    report['null_texts'] = df.filter(F.col("text").isNull()).count()

    length_stats = df.select(
        F.avg(F.length("text")).alias("avg_length"),
        F.stddev(F.length("text")).alias("std_length"),
        F.min(F.length("text")).alias("min_length"),
        F.max(F.length("text")).alias("max_length"),
        F.percentile_approx(F.length("text"), 0.5).alias("median_length"),
    ).collect()[0]

    for field in length_stats.asDict():
        report[field] = length_stats[field]

    if "language" in df.columns:
        lang_dist = (
            df.groupBy("language")
            .count()
            .orderBy(F.desc("count"))
            .collect()
        )
        report['language_distribution'] = {
            row['language']: row['count'] for row in lang_dist[:20]
        }

    if "source" in df.columns:
        source_dist = (
            df.groupBy("source")
            .agg(
                F.count("*").alias("count"),
                F.avg(F.length("text")).alias("avg_length"),
            )
            .orderBy(F.desc("count"))
            .collect()
        )
        report['source_distribution'] = {
            row['source']: {'count': row['count'], 'avg_length': row['avg_length']}
            for row in source_dist[:50]
        }

    return report
```

### PII Redaction

Training on personal data is a legal and ethical minefield. Always
redact before training.

```python
import re

PII_PATTERNS = {
    'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    'phone_us': r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b',
    'ssn': r'\b\d{3}-\d{2}-\d{4}\b',
    'credit_card': r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
    'ip_address': r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',
}

def redact_pii(text):
    for pii_type, pattern in PII_PATTERNS.items():
        replacement = f'[{pii_type.upper()}_REDACTED]'
        text = re.sub(pattern, replacement, text)
    return text

@F.udf
def redact_pii_udf(text):
    if text is None:
        return None
    return redact_pii(text)

redacted = df.withColumn("text", redact_pii_udf(F.col("text")))
```

For production systems, use dedicated PII detection libraries
like Presidio or spaCy NER models that handle names, addresses,
and context-dependent PII.

---

## Data Mixing and Curriculum

Large models train on data from multiple sources. The mixture
ratio matters -- a lot.

```
Typical LLM data mixture:

+-------------------+--------+------------------------------+
| Source            | Weight | Purpose                      |
+-------------------+--------+------------------------------+
| Web crawl         | 50%    | General knowledge            |
| Books             | 15%    | Long-range coherence         |
| Wikipedia         | 5%     | Factual accuracy             |
| Code (GitHub)     | 15%    | Code generation              |
| Scientific papers | 5%     | Technical reasoning          |
| Conversations     | 5%     | Dialog ability               |
| Math              | 5%     | Mathematical reasoning       |
+-------------------+--------+------------------------------+
```

### Implementing Data Mixing

```python
import numpy as np

class MixedDataset:
    def __init__(self, datasets, weights, seed=42):
        self.datasets = datasets
        self.weights = np.array(weights) / sum(weights)
        self.rng = np.random.RandomState(seed)

        self.iterators = [iter(ds) for ds in datasets]
        self.exhausted = [False] * len(datasets)

    def __iter__(self):
        return self

    def __next__(self):
        active_weights = self.weights.copy()
        active_weights[self.exhausted] = 0

        if active_weights.sum() == 0:
            raise StopIteration

        active_weights /= active_weights.sum()
        source_idx = self.rng.choice(len(self.datasets), p=active_weights)

        try:
            return next(self.iterators[source_idx])
        except StopIteration:
            self.exhausted[source_idx] = True
            return next(self)
```

---

## End-to-End Pipeline Example

Here's a complete data processing pipeline for a 10 TB web
crawl destined for LLM pretraining:

```bash
#!/bin/bash

echo "Step 1: Language identification and initial filtering"
spark-submit --num-executors 200 --executor-memory 32g \
  step1_filter.py \
  --input s3://raw-crawl/ \
  --output s3://pipeline/step1-filtered/

echo "Step 2: Quality scoring and filtering"
spark-submit --num-executors 200 --executor-memory 32g \
  step2_quality.py \
  --input s3://pipeline/step1-filtered/ \
  --output s3://pipeline/step2-quality/ \
  --min-score 0.4

echo "Step 3: Exact deduplication"
spark-submit --num-executors 100 --executor-memory 64g \
  step3_exact_dedup.py \
  --input s3://pipeline/step2-quality/ \
  --output s3://pipeline/step3-exact-dedup/

echo "Step 4: Near deduplication (MinHash)"
python -m text_dedup.minhash \
  --path s3://pipeline/step3-exact-dedup/ \
  --output s3://pipeline/step4-near-dedup/ \
  --threshold 0.8 \
  --num-workers 256

echo "Step 5: PII redaction"
spark-submit --num-executors 200 --executor-memory 32g \
  step5_pii_redact.py \
  --input s3://pipeline/step4-near-dedup/ \
  --output s3://pipeline/step5-clean/

echo "Step 6: Tokenization"
python tokenize_parallel.py \
  --input s3://pipeline/step5-clean/ \
  --output s3://pipeline/step6-tokenized/ \
  --tokenizer meta-llama/Llama-2-7b-hf \
  --workers 128

echo "Step 7: Create training shards"
python create_shards.py \
  --input s3://pipeline/step6-tokenized/ \
  --output s3://training-data/v1/ \
  --shard-size 256MB \
  --seq-length 4096

echo "Pipeline complete."
echo "Raw: $(du -sh s3://raw-crawl/)"
echo "Final: $(du -sh s3://training-data/v1/)"
```

Typical compression ratio through this pipeline:

```
Raw crawl:         10 TB (100%)
After filtering:    3 TB (30%)
After dedup:        1.5 TB (15%)
After PII redact:   1.5 TB (15%, same size, content changed)
After tokenization: 500 GB (5%, tokens are compact)
Training shards:    500 GB ready to stream
```

---

## Exercises

1. **Quality filter**: Write a Spark UDF that scores document
   quality based on perplexity from a small language model.
   Documents with perplexity above a threshold are likely
   low quality or non-natural-language.

2. **Dedup at scale**: Process 1 TB of Common Crawl data through
   exact + MinHash deduplication. Measure the deduplication rate
   and compare the quality of a model trained on deduped vs
   non-deduped data.

3. **Data mixing**: Implement a weighted data mixing system that
   supports dynamic weight adjustment during training. The
   system should log the actual sample rate per source to verify
   the intended mixture.

4. **Pipeline design**: Design a data processing pipeline for
   a multilingual model covering 20 languages. Address language
   identification, per-language quality filtering, cross-lingual
   deduplication, and balanced sampling.
