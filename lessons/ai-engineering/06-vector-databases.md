# 06 - Vector Databases

In the last lesson, we searched with a loop. That works for
100 documents. For 1 million? You need a vector database.
It's like the difference between searching a pile of papers
vs using a library catalog system.

---

## Why You Need One

```
Naive search:
  For each query:
    Compare to ALL documents  -->  O(n) per query
    1M docs = 1M comparisons  -->  Slow

Vector database:
  Builds an index (like a book's index)
  Query hits the index first  -->  O(log n) per query
  1M docs = ~20 comparisons   -->  Fast
```

---

## The Landscape

```
+----------------+----------+--------+------------------+
| Database       | Type     | Cost   | Best For         |
+----------------+----------+--------+------------------+
| Chroma         | Embedded | Free   | Prototyping      |
| pgvector       | Extension| Free   | Already use PG   |
| Pinecone       | Managed  | Paid   | Zero ops needed  |
| Weaviate       | Self/Cloud| Both  | Hybrid search    |
| Qdrant         | Self/Cloud| Both  | Performance      |
| Milvus         | Self-host| Free   | Massive scale    |
+----------------+----------+--------+------------------+
```

---

## Chroma: Start Here

Chroma is like SQLite for vectors. No server needed. Perfect
for prototyping and small apps.

```python
import chromadb

client = chromadb.Client()

collection = client.create_collection(
    name="support_docs",
    metadata={"hnsw:space": "cosine"},
)

documents = [
    "To reset your password, go to Settings > Security",
    "Billing invoices are under Account > Billing History",
    "Cancel your subscription by emailing support@example.com",
    "Enable 2FA in Settings > Security > Two-Factor",
    "Export data from Settings > Privacy > Data Export",
    "Upgrade your plan at Account > Subscription > Upgrade",
    "API keys are managed in Settings > Developer > API Keys",
    "Team members can be added under Account > Team",
]

collection.add(
    documents=documents,
    ids=[f"doc_{i}" for i in range(len(documents))],
    metadatas=[{"category": "support"} for _ in documents],
)

results = collection.query(
    query_texts=["How do I change my password?"],
    n_results=3,
)

for doc, distance in zip(results["documents"][0], results["distances"][0]):
    print(f"  [{1 - distance:.3f}] {doc}")
```

---

## Chroma with Persistence

Save to disk so you don't re-embed every restart.

```python
import chromadb

client = chromadb.PersistentClient(path="./chroma_data")

collection = client.get_or_create_collection("my_docs")

if collection.count() == 0:
    collection.add(
        documents=["First doc", "Second doc", "Third doc"],
        ids=["1", "2", "3"],
    )

print(f"Collection has {collection.count()} documents")

results = collection.query(query_texts=["find something"], n_results=2)
print(results["documents"])
```

---

## pgvector: When You Already Have Postgres

If your app already uses Postgres, pgvector adds vector
search without another database. Like adding a new shelf
to an existing bookshelf.

```python
import psycopg2
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

conn = psycopg2.connect("postgresql://localhost/mydb")
cur = conn.cursor()

cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
cur.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector(384),
        metadata JSONB DEFAULT '{}'
    )
""")
cur.execute("""
    CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON documents USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
""")
conn.commit()


def insert_document(content: str, metadata: dict | None = None):
    embedding = model.encode([content])[0].tolist()
    cur.execute(
        "INSERT INTO documents (content, embedding, metadata) VALUES (%s, %s, %s)",
        (content, str(embedding), json.dumps(metadata or {})),
    )
    conn.commit()


def search_documents(query: str, top_k: int = 5):
    query_embedding = model.encode([query])[0].tolist()
    cur.execute(
        """
        SELECT content, 1 - (embedding <=> %s::vector) as similarity
        FROM documents
        ORDER BY embedding <=> %s::vector
        LIMIT %s
        """,
        (str(query_embedding), str(query_embedding), top_k),
    )
    return cur.fetchall()
```

---

## Pinecone: Managed & Scalable

Pinecone is like AWS for vectors. You don't manage servers.
Just send vectors and query.

```python
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer

pc = Pinecone(api_key="your-api-key")

index = pc.Index("my-index")

model = SentenceTransformer("all-MiniLM-L6-v2")

documents = [
    {"id": "doc1", "text": "Password reset instructions"},
    {"id": "doc2", "text": "Billing and invoices"},
    {"id": "doc3", "text": "Subscription management"},
]

vectors = []
for doc in documents:
    embedding = model.encode(doc["text"]).tolist()
    vectors.append({
        "id": doc["id"],
        "values": embedding,
        "metadata": {"text": doc["text"]},
    })

index.upsert(vectors=vectors)

query_embedding = model.encode("How do I pay?").tolist()
results = index.query(vector=query_embedding, top_k=3, include_metadata=True)

for match in results["matches"]:
    print(f"  [{match['score']:.3f}] {match['metadata']['text']}")
```

---

## Weaviate: Hybrid Search

Weaviate combines vector search AND keyword search. Like
having both a librarian (semantic) and a card catalog (keyword).

```python
import weaviate

client = weaviate.connect_to_local()

from weaviate.classes.config import Configure, Property, DataType

collection = client.collections.create(
    name="Document",
    vectorizer_config=Configure.Vectorizer.text2vec_transformers(),
    properties=[
        Property(name="content", data_type=DataType.TEXT),
        Property(name="category", data_type=DataType.TEXT),
    ],
)

collection.data.insert(
    properties={
        "content": "Reset your password in settings",
        "category": "support",
    }
)

results = collection.query.hybrid(
    query="change password",
    alpha=0.5,
    limit=3,
)

for obj in results.objects:
    print(f"  {obj.properties['content']}")

client.close()
```

---

## Metadata Filtering

Vector search finds similar meaning. Metadata filters narrow
the scope. Like searching a bookstore by genre THEN similarity.

```python
import chromadb

client = chromadb.Client()
collection = client.create_collection("products")

collection.add(
    documents=[
        "Lightweight running shoes for daily training",
        "Professional basketball shoes with ankle support",
        "Casual sneakers for everyday wear",
        "Trail running shoes with waterproof membrane",
        "High-top basketball shoes for competition",
    ],
    ids=["p1", "p2", "p3", "p4", "p5"],
    metadatas=[
        {"category": "running", "price": 89.99},
        {"category": "basketball", "price": 149.99},
        {"category": "casual", "price": 59.99},
        {"category": "running", "price": 129.99},
        {"category": "basketball", "price": 179.99},
    ],
)

results = collection.query(
    query_texts=["comfortable shoes for sports"],
    n_results=3,
    where={"category": "running"},
)

print("Running shoes matching 'comfortable for sports':")
for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
    print(f"  ${meta['price']} - {doc}")
```

---

## Decision Framework

```
Starting a project?
    |
    +-- Just prototyping?
    |   --> Chroma (zero setup)
    |
    +-- Already have Postgres?
    |   --> pgvector (no new infra)
    |
    +-- Need keyword + vector search?
    |   --> Weaviate
    |
    +-- Want zero operations?
    |   --> Pinecone
    |
    +-- Massive scale (100M+ vectors)?
    |   --> Milvus or Qdrant
    |
    +-- Need on-device/edge?
        --> Chroma or LanceDB
```

---

## Performance Tips

```
+---------------------------+-----------------------------------+
| Problem                   | Solution                          |
+---------------------------+-----------------------------------+
| Slow inserts              | Batch inserts (100-1000 at a time)|
| Slow queries              | Add an index (IVF, HNSW)         |
| Too many results          | Add metadata filters              |
| Poor relevance            | Try a better embedding model      |
| High memory usage         | Use quantization or disk index    |
| Cold start                | Pre-warm with common queries      |
+---------------------------+-----------------------------------+
```

---

## Exercises

**Exercise 1: Chroma FAQ Bot**
Load 30+ FAQ entries into Chroma with metadata (category,
priority). Build a search function that filters by category
and returns the top 3 answers.

**Exercise 2: Database Comparison**
Take the same 500 documents and load them into Chroma AND
one other vector DB. Compare: insert speed, query speed,
and result quality on 10 test queries.

**Exercise 3: Hybrid Search**
Build a search system that combines vector similarity with
keyword matching (BM25). Compare results to pure vector
search on 10 queries.

**Exercise 4: Production-Ready Search**
Build a search service with: batch ingestion, metadata
filtering, pagination, and a `/health` endpoint. Use FastAPI
and Chroma. Include error handling for missing collections.

---

Next: [07 - Chunking Strategies](07-chunking-strategies.md)
