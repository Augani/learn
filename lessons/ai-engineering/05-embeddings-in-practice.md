# 05 - Embeddings in Practice

An embedding turns text into a list of numbers that captures
its MEANING. Think of it like GPS coordinates for ideas.
"Happy" and "joyful" are close together. "Happy" and
"database migration" are far apart.

---

## What Embeddings Look Like

```
"I love pizza"  -->  [0.12, -0.34, 0.87, 0.03, ...]  (1536 numbers)
"Pizza is great" -> [0.11, -0.31, 0.85, 0.05, ...]  (very similar!)
"Fix the database" -> [-0.45, 0.72, -0.12, 0.91, ...] (very different)

    "I love pizza"
          *  * "Pizza is great"
         /
        /
       /
      /
     *--------------------------* "Fix the database"

    Close in vector space = similar meaning
```

---

## OpenAI Embeddings

The fastest way to get started.

```python
from openai import OpenAI

client = OpenAI()


def get_embedding(text: str, model: str = "text-embedding-3-small") -> list[float]:
    response = client.embeddings.create(
        input=text,
        model=model,
    )
    return response.data[0].embedding


embedding = get_embedding("How do I reset my password?")
print(f"Dimensions: {len(embedding)}")
print(f"First 5 values: {embedding[:5]}")
```

**OpenAI Embedding Models:**

```
+---------------------------+------+----------+----------+
| Model                     | Dims | Cost/1M  | Quality  |
+---------------------------+------+----------+----------+
| text-embedding-3-small    | 1536 | $0.02    | Good     |
| text-embedding-3-large    | 3072 | $0.13    | Better   |
| text-embedding-ada-002    | 1536 | $0.10    | Legacy   |
+---------------------------+------+----------+----------+
```

---

## Sentence Transformers (Local & Free)

No API key needed. Runs on your machine. Like having your
own embedding factory instead of outsourcing.

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

sentences = [
    "How do I reset my password?",
    "I forgot my login credentials",
    "What's the weather today?",
]

embeddings = model.encode(sentences)
print(f"Shape: {embeddings.shape}")
print(f"Each embedding: {embeddings.shape[1]} dimensions")
```

**Popular Local Models:**

```
+------------------------------+------+--------+-----------+
| Model                        | Dims | Size   | Quality   |
+------------------------------+------+--------+-----------+
| all-MiniLM-L6-v2             | 384  | 80MB   | Good      |
| all-mpnet-base-v2            | 768  | 420MB  | Better    |
| BAAI/bge-large-en-v1.5       | 1024 | 1.3GB  | Great     |
| BAAI/bge-m3                  | 1024 | 2.2GB  | Best      |
+------------------------------+------+--------+-----------+
```

---

## Similarity Search

The whole point: find similar things. Like a librarian who
knows exactly which books are related.

```python
import numpy as np
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")


def cosine_similarity(vec_a, vec_b):
    dot = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


knowledge_base = [
    "To reset your password, go to Settings > Security > Reset Password",
    "Billing invoices are available under Account > Billing History",
    "To cancel your subscription, contact support@example.com",
    "Two-factor authentication can be enabled in Security settings",
    "Export your data from Settings > Privacy > Data Export",
]

kb_embeddings = model.encode(knowledge_base)


def search(query: str, top_k: int = 3) -> list[tuple[str, float]]:
    query_embedding = model.encode([query])[0]
    scores = [
        (doc, cosine_similarity(query_embedding, doc_emb))
        for doc, doc_emb in zip(knowledge_base, kb_embeddings)
    ]
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_k]


results = search("How do I change my password?")
for doc, score in results:
    print(f"  [{score:.3f}] {doc}")

print()
results = search("Where are my invoices?")
for doc, score in results:
    print(f"  [{score:.3f}] {doc}")
```

---

## Batch Processing

Real apps have thousands of documents. Batch them.

```python
from sentence_transformers import SentenceTransformer
import numpy as np
import time

model = SentenceTransformer("all-MiniLM-L6-v2")

documents = [f"Document number {i} about topic {i % 10}" for i in range(1000)]

start = time.time()
embeddings = model.encode(
    documents,
    batch_size=64,
    show_progress_bar=True,
    normalize_embeddings=True,
)
elapsed = time.time() - start

print(f"Embedded {len(documents)} docs in {elapsed:.2f}s")
print(f"Rate: {len(documents)/elapsed:.0f} docs/sec")
print(f"Shape: {embeddings.shape}")
```

---

## Choosing an Embedding Model

```
                        Quality
                          ^
                          |
   BAAI/bge-large  *     |     * text-embedding-3-large
                          |
   all-mpnet-base  *     |     * text-embedding-3-small
                          |
   all-MiniLM      *     |
                          |
   ---------+-------------+--------------->
             Local/Free        API/Paid

   Decision tree:
   +-- Need offline/privacy? --> Local model
   |   +-- Have GPU? --> bge-large
   |   +-- CPU only? --> all-MiniLM
   |
   +-- Need best quality? --> text-embedding-3-large
   |
   +-- General use? --> text-embedding-3-small
```

---

## Caching Embeddings

Don't re-embed the same text. That's like recalculating
2+2 every time someone asks.

```python
import hashlib
import json
import numpy as np
from pathlib import Path


class EmbeddingCache:
    def __init__(self, cache_dir: str = ".embedding_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)

    def _key(self, text: str, model_name: str) -> str:
        content = f"{model_name}:{text}"
        return hashlib.sha256(content.encode()).hexdigest()

    def get(self, text: str, model_name: str) -> np.ndarray | None:
        key = self._key(text, model_name)
        path = self.cache_dir / f"{key}.npy"
        if path.exists():
            return np.load(path)
        return None

    def put(self, text: str, model_name: str, embedding: np.ndarray):
        key = self._key(text, model_name)
        path = self.cache_dir / f"{key}.npy"
        np.save(path, embedding)

    def get_or_compute(self, text: str, model_name: str, compute_fn):
        cached = self.get(text, model_name)
        if cached is not None:
            return cached
        embedding = compute_fn(text)
        self.put(text, model_name, np.array(embedding))
        return embedding


cache = EmbeddingCache()
```

---

## Measuring Embedding Quality

How do you know if your embeddings are actually good for
YOUR data? Test them.

```python
from sentence_transformers import SentenceTransformer
import numpy as np


def evaluate_embeddings(model, test_pairs):
    correct = 0
    total = len(test_pairs)

    for query, positive, negative in test_pairs:
        embs = model.encode([query, positive, negative])
        pos_sim = np.dot(embs[0], embs[1]) / (
            np.linalg.norm(embs[0]) * np.linalg.norm(embs[1])
        )
        neg_sim = np.dot(embs[0], embs[2]) / (
            np.linalg.norm(embs[0]) * np.linalg.norm(embs[2])
        )
        if pos_sim > neg_sim:
            correct += 1

    accuracy = correct / total if total > 0 else 0
    return accuracy


test_pairs = [
    (
        "reset password",
        "change my login credentials",
        "billing information",
    ),
    (
        "cancel subscription",
        "stop my membership",
        "password reset help",
    ),
    (
        "download invoice",
        "get my billing receipt",
        "enable two-factor auth",
    ),
]

model = SentenceTransformer("all-MiniLM-L6-v2")
accuracy = evaluate_embeddings(model, test_pairs)
print(f"Embedding accuracy: {accuracy:.0%}")
```

---

## Exercises

**Exercise 1: Semantic Search Engine**
Build a search engine over a folder of text files. Embed
all files on startup, save embeddings to disk. Accept queries
and return the top 3 most relevant files with scores.

**Exercise 2: Duplicate Detector**
Given a list of support tickets, find near-duplicates using
embeddings. Set a similarity threshold and group duplicates.

**Exercise 3: Model Shootout**
Compare 3 embedding models on YOUR data. Create 20 test
triplets (query, relevant, irrelevant). Measure accuracy
for each model. Which wins?

**Exercise 4: Embedding API**
Build a FastAPI service that accepts text, returns embeddings,
and caches results. Include a `/search` endpoint that finds
similar documents from a pre-loaded corpus.

---

Next: [06 - Vector Databases](06-vector-databases.md)
