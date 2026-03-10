# 07 - Chunking Strategies

Before you can search documents, you have to split them into
pieces. This is chunking. Think of it like cutting a book
into index cards. Cut too big, you get vague matches. Cut
too small, you lose context. The art is finding the sweet spot.

---

## Why Chunking Matters

```
DOCUMENT: "Chapter 12: Error Handling. When your application
encounters an error, it should log the error, notify the user,
and attempt recovery. The logging system uses structured JSON
format with severity levels..."

TOO BIG (whole chapter):
  Embedding captures the average of ALL topics
  Query about "logging" matches weakly

TOO SMALL ("it should"):
  No useful meaning at all
  Matches nothing relevant

JUST RIGHT (paragraph):
  Embedding captures "error handling + logging"
  Query about "logging errors" matches strongly
```

---

## Fixed-Size Chunking

The simplest approach. Like cutting a ribbon into equal pieces.
Fast and predictable, but might cut mid-sentence.

```python
def fixed_size_chunks(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
) -> list[str]:
    if not text:
        return []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap

    return chunks


sample_text = "A" * 200 + " " + "B" * 200 + " " + "C" * 200
chunks = fixed_size_chunks(sample_text, chunk_size=250, overlap=50)
for i, chunk in enumerate(chunks):
    print(f"Chunk {i}: {len(chunk)} chars, starts with '{chunk[:20]}...'")
```

```
Overlap visualized:

Chunk 1: [=========================]
Chunk 2:                      [=========================]
Chunk 3:                                           [=========================]
                              ^^^^^               ^^^^^
                              overlap             overlap

Overlap prevents cutting a thought in half.
```

---

## Recursive Character Chunking

Tries to split on natural boundaries first: paragraphs, then
sentences, then words. Like a thoughtful editor who breaks at
logical points.

```python
def recursive_chunk(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
    separators: list[str] | None = None,
) -> list[str]:
    if separators is None:
        separators = ["\n\n", "\n", ". ", " ", ""]

    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    for sep in separators:
        if sep in text:
            parts = text.split(sep)
            break
    else:
        return fixed_size_chunks(text, chunk_size, overlap)

    chunks = []
    current = ""

    for part in parts:
        candidate = current + sep + part if current else part

        if len(candidate) <= chunk_size:
            current = candidate
        else:
            if current.strip():
                chunks.append(current.strip())
            if overlap > 0 and current:
                overlap_text = current[-overlap:]
                current = overlap_text + sep + part
            else:
                current = part

    if current.strip():
        chunks.append(current.strip())

    return chunks


document = """Introduction to Machine Learning

Machine learning is a branch of artificial intelligence that focuses on building systems that learn from data. Instead of being explicitly programmed, these systems improve through experience.

Supervised Learning

In supervised learning, the algorithm learns from labeled training data. Common algorithms include linear regression, decision trees, and neural networks. Each has strengths for different types of problems.

Unsupervised Learning

Unsupervised learning works with unlabeled data. The algorithm tries to find patterns and structure on its own. Clustering and dimensionality reduction are common techniques."""

chunks = recursive_chunk(document, chunk_size=200, overlap=30)
for i, chunk in enumerate(chunks):
    print(f"\n--- Chunk {i} ({len(chunk)} chars) ---")
    print(chunk[:100] + "..." if len(chunk) > 100 else chunk)
```

---

## Sentence-Based Chunking

Split into sentences first, then group them. Like dealing
cards: one sentence at a time until you hit your limit.

```python
import re


def split_sentences(text: str) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]


def sentence_chunks(
    text: str,
    max_sentences: int = 5,
    overlap_sentences: int = 1,
) -> list[str]:
    sentences = split_sentences(text)
    if not sentences:
        return []

    chunks = []
    start = 0

    while start < len(sentences):
        end = min(start + max_sentences, len(sentences))
        chunk = " ".join(sentences[start:end])
        chunks.append(chunk)
        start = end - overlap_sentences

    return chunks


text = (
    "Machine learning models need training data. "
    "The data should be clean and representative. "
    "Missing values should be handled carefully. "
    "Feature engineering is often more important than model choice. "
    "Always split data into train, validation, and test sets. "
    "Cross-validation gives more robust estimates. "
    "Hyperparameter tuning should use the validation set. "
    "Never tune on the test set."
)

chunks = sentence_chunks(text, max_sentences=3, overlap_sentences=1)
for i, chunk in enumerate(chunks):
    print(f"\nChunk {i}: {chunk}")
```

---

## Semantic Chunking

The smart approach: split where the MEANING changes. Like
a human editor who reads the text and knows where one topic
ends and another begins.

```python
import numpy as np
from sentence_transformers import SentenceTransformer
import re


def semantic_chunks(
    text: str,
    model: SentenceTransformer,
    similarity_threshold: float = 0.5,
    min_chunk_size: int = 100,
) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if s.strip()]

    if len(sentences) <= 1:
        return sentences

    embeddings = model.encode(sentences)

    similarities = []
    for i in range(len(embeddings) - 1):
        sim = np.dot(embeddings[i], embeddings[i + 1]) / (
            np.linalg.norm(embeddings[i]) * np.linalg.norm(embeddings[i + 1])
        )
        similarities.append(sim)

    chunks = []
    current_chunk = [sentences[0]]

    for i, sim in enumerate(similarities):
        if sim < similarity_threshold and len(" ".join(current_chunk)) >= min_chunk_size:
            chunks.append(" ".join(current_chunk))
            current_chunk = [sentences[i + 1]]
        else:
            current_chunk.append(sentences[i + 1])

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


model = SentenceTransformer("all-MiniLM-L6-v2")

text = (
    "Python is a versatile programming language. "
    "It supports multiple programming paradigms. "
    "Python's syntax is clean and readable. "
    "Machine learning has transformed many industries. "
    "Neural networks can learn complex patterns. "
    "Training requires large amounts of labeled data. "
    "The stock market opened higher today. "
    "Tech stocks led the gains."
)

chunks = semantic_chunks(text, model, similarity_threshold=0.4)
for i, chunk in enumerate(chunks):
    print(f"\n--- Semantic Chunk {i} ---")
    print(chunk)
```

```
What semantic chunking "sees":

Sentence similarities:
  Python versatile -- Python paradigms:      0.72  (same topic)
  Python paradigms -- Python syntax:         0.68  (same topic)
  Python syntax    -- ML transformed:        0.23  (TOPIC CHANGE!)
  ML transformed   -- Neural networks:       0.71  (same topic)
  Neural networks  -- Training data:         0.65  (same topic)
  Training data    -- Stock market:          0.12  (TOPIC CHANGE!)
  Stock market     -- Tech stocks:           0.78  (same topic)

                 CUT HERE              CUT HERE
                    v                     v
  [Python chunk] | [ML chunk]         | [Finance chunk]
```

---

## Document-Aware Chunking

Some documents have structure. Use it. Like using chapter
headings instead of page numbers.

```python
import re


def markdown_chunks(text: str, max_chunk_size: int = 1000) -> list[dict]:
    sections = re.split(r'(^#{1,3}\s+.+$)', text, flags=re.MULTILINE)

    chunks = []
    current_heading = "Introduction"
    current_content = ""

    for part in sections:
        if re.match(r'^#{1,3}\s+', part):
            if current_content.strip():
                chunks.append({
                    "heading": current_heading,
                    "content": current_content.strip(),
                })
            current_heading = part.strip().lstrip("#").strip()
            current_content = ""
        else:
            current_content += part

    if current_content.strip():
        chunks.append({
            "heading": current_heading,
            "content": current_content.strip(),
        })

    final_chunks = []
    for chunk in chunks:
        if len(chunk["content"]) > max_chunk_size:
            sub_chunks = fixed_size_chunks(chunk["content"], max_chunk_size)
            for i, sub in enumerate(sub_chunks):
                final_chunks.append({
                    "heading": f"{chunk['heading']} (part {i+1})",
                    "content": sub,
                })
        else:
            final_chunks.append(chunk)

    return final_chunks
```

---

## Choosing Your Strategy

```
+------------------+------------------+------------------+
| Strategy         | Pros             | Cons             |
+------------------+------------------+------------------+
| Fixed-size       | Simple, fast     | Cuts mid-thought |
| Recursive        | Respects breaks  | Needs tuning     |
| Sentence-based   | Clean boundaries | Uneven sizes     |
| Semantic         | Best relevance   | Slow, expensive  |
| Document-aware   | Uses structure   | Format-specific  |
+------------------+------------------+------------------+

Decision:
  Prototyping?           --> Fixed-size (just start)
  Have structured docs?  --> Document-aware
  Need best quality?     --> Semantic
  General use?           --> Recursive
```

---

## The Chunk Size Sweet Spot

```
Too small (<100 chars):     Lost context, noisy matches
                            "it should" matches everything

Sweet spot (200-1000 chars): Rich enough for good embeddings
                             Focused enough for precise matches

Too big (>2000 chars):      Diluted meaning, vague matches
                            "Chapter about many things"

         Quality
           ^
           |        *****
           |      *       *
           |    *           *
           |  *               *
           | *                  *
           +--+----+----+----+-----> Chunk size
              100  300  700  1500
```

---

## Exercises

**Exercise 1: Chunking Comparison**
Take a 5-page document. Chunk it with all 4 strategies.
For each, count chunks and average chunk size. Then run
5 test queries through each and compare which finds the
best answers.

**Exercise 2: Optimal Chunk Size Finder**
Write a script that takes a document and test queries,
tries chunk sizes from 100 to 2000 in steps of 100,
and plots retrieval quality vs chunk size.

**Exercise 3: Code-Aware Chunker**
Build a chunker that understands Python code structure.
Split on function/class boundaries, keep docstrings with
their functions, and never cut inside a function body.

**Exercise 4: Chunk Pipeline**
Build a complete chunking pipeline: read files from a
directory, detect format (markdown, code, plain text),
apply the right chunking strategy, and output chunks
with metadata (source file, position, heading).

---

Next: [08 - RAG Pipeline](08-rag-pipeline.md)
