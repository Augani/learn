# 09 - Advanced RAG

Basic RAG gets you 70% of the way. Advanced RAG closes the
gap. Think of basic RAG as Google Search, and advanced RAG
as a research librarian who refines your question, checks
multiple sources, and ranks the best answers.

---

## Where Basic RAG Falls Short

```
Basic RAG:
  Query --> Embed --> Top K --> LLM --> Answer

Problems:
  1. Query doesn't match doc vocabulary
  2. Top K includes irrelevant junk
  3. No way to combine keyword + semantic search
  4. Single query misses multi-faceted questions
```

---

## Reranking

First pass retrieval is fast but rough. Reranking is a second,
more careful look. Like a recruiter who does a quick resume
screen, then reads the top 20 carefully.

```python
from sentence_transformers import CrossEncoder
import chromadb


class RerankedRetriever:
    def __init__(self, collection_name: str = "documents"):
        client = chromadb.PersistentClient(path="./rag_db")
        self.collection = client.get_collection(collection_name)
        self.reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

    def search(self, query: str, top_k: int = 5, initial_k: int = 20) -> list[dict]:
        results = self.collection.query(
            query_texts=[query],
            n_results=initial_k,
        )

        candidates = []
        for i in range(len(results["ids"][0])):
            candidates.append({
                "id": results["ids"][0][i],
                "content": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
            })

        if not candidates:
            return []

        pairs = [(query, doc["content"]) for doc in candidates]
        scores = self.reranker.predict(pairs)

        for doc, score in zip(candidates, scores):
            doc["rerank_score"] = float(score)

        candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
        return candidates[:top_k]
```

```
Without reranking:          With reranking:

Retrieve 20 docs            Retrieve 20 docs
    |                           |
    v                           v
Take top 5 by                Reranker scores all 20
vector similarity             carefully
    |                           |
    v                           v
[3 relevant,                 [5 relevant,
 2 irrelevant]                0 irrelevant]

The reranker is slower but much more accurate.
It actually READS query + document together.
```

---

## Hybrid Search

Combine vector search (meaning) with keyword search (exact
terms). Like using both Google and Ctrl+F.

```python
import re
from math import log
from collections import Counter


class BM25:
    def __init__(self, documents: list[str], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.docs = documents
        self.doc_count = len(documents)
        self.tokenized = [self._tokenize(doc) for doc in documents]
        self.avg_dl = sum(len(d) for d in self.tokenized) / self.doc_count
        self.doc_freqs: dict[str, int] = {}

        for tokens in self.tokenized:
            for token in set(tokens):
                self.doc_freqs[token] = self.doc_freqs.get(token, 0) + 1

    def _tokenize(self, text: str) -> list[str]:
        return re.findall(r'\w+', text.lower())

    def score(self, query: str) -> list[float]:
        query_tokens = self._tokenize(query)
        scores = []

        for tokens in self.tokenized:
            doc_score = 0.0
            tf_map = Counter(tokens)
            dl = len(tokens)

            for qt in query_tokens:
                if qt not in self.doc_freqs:
                    continue
                df = self.doc_freqs[qt]
                idf = log((self.doc_count - df + 0.5) / (df + 0.5) + 1)
                tf = tf_map.get(qt, 0)
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * dl / self.avg_dl)
                doc_score += idf * numerator / denominator

            scores.append(doc_score)

        return scores


def hybrid_search(
    query: str,
    documents: list[str],
    embeddings,
    query_embedding,
    alpha: float = 0.5,
    top_k: int = 5,
) -> list[tuple[int, float]]:
    import numpy as np

    bm25 = BM25(documents)
    keyword_scores = bm25.score(query)

    vector_scores = [
        float(np.dot(query_embedding, doc_emb) / (
            np.linalg.norm(query_embedding) * np.linalg.norm(doc_emb)
        ))
        for doc_emb in embeddings
    ]

    max_kw = max(keyword_scores) if max(keyword_scores) > 0 else 1
    max_vec = max(vector_scores) if max(vector_scores) > 0 else 1
    norm_kw = [s / max_kw for s in keyword_scores]
    norm_vec = [s / max_vec for s in vector_scores]

    combined = [
        alpha * vec + (1 - alpha) * kw
        for vec, kw in zip(norm_vec, norm_kw)
    ]

    ranked = sorted(enumerate(combined), key=lambda x: x[1], reverse=True)
    return ranked[:top_k]
```

```
Hybrid search advantage:

Query: "error code 4012"

Vector search: finds docs about "error handling" (semantic match)
Keyword search: finds docs containing "4012" (exact match)
Hybrid: finds docs about "error code 4012" (both!)

     Vector:  "When errors occur in your application..."  (0.82)
     Keyword: "Error 4012: Authentication timeout"        (0.95)
     Hybrid:  "Error 4012: Authentication timeout"        (0.91)
              "When errors occur in your application..."  (0.76)
```

---

## Query Expansion

One query might miss relevant docs that use different words.
Expand it. Like a librarian who thinks of synonyms.

```python
from openai import OpenAI

client = OpenAI()


def expand_query(query: str, num_variations: int = 3) -> list[str]:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    f"Generate {num_variations} alternative phrasings "
                    "of the given query. Each should capture the same "
                    "intent but use different words. Return one per line. "
                    "No numbering or bullets."
                ),
            },
            {"role": "user", "content": query},
        ],
        temperature=0.7,
    )

    variations = response.choices[0].message.content.strip().split("\n")
    variations = [v.strip() for v in variations if v.strip()]
    return [query] + variations[:num_variations]


queries = expand_query("How do I fix authentication errors?")
for q in queries:
    print(f"  - {q}")
```

---

## HyDE (Hypothetical Document Embeddings)

Instead of embedding the QUESTION, generate a hypothetical
ANSWER and embed that. The fake answer is closer in vector
space to real answers than the question is.

```python
from openai import OpenAI
from sentence_transformers import SentenceTransformer
import numpy as np

client = OpenAI()
embed_model = SentenceTransformer("all-MiniLM-L6-v2")


def hyde_search(
    query: str,
    document_embeddings: np.ndarray,
    documents: list[str],
    top_k: int = 5,
) -> list[tuple[str, float]]:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Write a short paragraph that would be a good "
                    "answer to the given question. Write it as if it "
                    "were from a documentation page."
                ),
            },
            {"role": "user", "content": query},
        ],
    )

    hypothetical = response.choices[0].message.content
    hyde_embedding = embed_model.encode([hypothetical])[0]

    scores = []
    for i, doc_emb in enumerate(document_embeddings):
        sim = np.dot(hyde_embedding, doc_emb) / (
            np.linalg.norm(hyde_embedding) * np.linalg.norm(doc_emb)
        )
        scores.append((documents[i], float(sim)))

    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_k]
```

```
Normal search:
  "How to fix auth?"  -->  [embed question]  -->  find similar docs
                           ^
                           Question embedding is in "question space"

HyDE search:
  "How to fix auth?"  -->  LLM generates fake answer:
                           "To fix authentication errors,
                            check your API key and ensure..."
                           -->  [embed fake answer]  -->  find similar docs
                                ^
                                Answer embedding is in "answer space"
                                Much closer to actual answer docs!
```

---

## Multi-Query Retrieval

Ask the same question from different angles, combine results.

```python
from openai import OpenAI
import chromadb

client = OpenAI()


def multi_query_retrieve(
    query: str,
    collection,
    top_k: int = 5,
) -> list[dict]:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Generate 3 different search queries that would help "
                    "answer the given question. Each should approach the "
                    "topic from a different angle. One per line."
                ),
            },
            {"role": "user", "content": query},
        ],
    )

    sub_queries = [query] + [
        q.strip() for q in response.choices[0].message.content.strip().split("\n")
        if q.strip()
    ]

    seen_ids = set()
    all_results = []

    for sub_q in sub_queries:
        results = collection.query(query_texts=[sub_q], n_results=top_k)
        for i in range(len(results["ids"][0])):
            doc_id = results["ids"][0][i]
            if doc_id not in seen_ids:
                seen_ids.add(doc_id)
                all_results.append({
                    "id": doc_id,
                    "content": results["documents"][0][i],
                    "distance": results["distances"][0][i],
                    "found_by": sub_q,
                })

    all_results.sort(key=lambda x: x["distance"])
    return all_results[:top_k]
```

---

## Putting It All Together

```
+--------+     +-----------+     +------------+
| User   |---->| Query     |---->| Multi-Query|
| Query  |     | Expansion |     | Search     |
+--------+     +-----------+     +-----+------+
                                       |
                                       v
+--------+     +-----------+     +------------+
| Answer |<----| Generate  |<----| Rerank     |
|        |     | w/Context |     | Top K      |
+--------+     +-----------+     +------------+

   Advanced RAG = Basic RAG + smarter retrieval
```

---

## Exercises

**Exercise 1: Reranking Pipeline**
Add a cross-encoder reranker to your RAG pipeline from
Lesson 08. Compare answer quality with and without
reranking on 10 test questions.

**Exercise 2: Hybrid Search System**
Implement hybrid search combining BM25 and vector search.
Experiment with different alpha values (0.3, 0.5, 0.7).
Which alpha works best for your data?

**Exercise 3: HyDE Implementation**
Add HyDE to your search pipeline. Compare retrieval quality
(using the eval techniques from Lesson 03) between normal
embedding search and HyDE search.

**Exercise 4: Advanced RAG Stack**
Combine query expansion + hybrid search + reranking into a
single pipeline. Measure: latency, retrieval quality, and
answer quality. Is the complexity worth it?

---

Next: [10 - Evaluating RAG](10-evaluating-rag.md)
