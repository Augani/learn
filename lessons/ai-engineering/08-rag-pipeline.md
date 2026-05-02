# 08 - RAG Pipeline

RAG (Retrieval-Augmented Generation) is the bread and butter
of AI engineering. Instead of hoping the model knows the
answer, you FIND the relevant info and hand it over. Like
giving a student the textbook page before asking the question.

---

## The Full Architecture

```
+--------+     +----------+     +----------+     +---------+
| User   |     | Embed    |     | Search   |     | Vector  |
| Query  |---->| Query    |---->| Vector   |---->| DB      |
+--------+     +----------+     | DB       |     |         |
                                +----+-----+     +---------+
                                     |
                                     v
                                +----------+
                                | Retrieved|
                                | Chunks   |
                                +----+-----+
                                     |
                +--------+           v
                |  LLM   |<----+-----------+
                |        |     | Query +   |
                |        |     | Context   |
                +---+----+     +-----------+
                    |
                    v
               +----------+
               | Answer   |
               | (grounded|
               |  in docs)|
               +----------+
```

---

## Step 1: Ingestion Pipeline

Before you can search, you need to load and embed documents.
This is the "stocking the library shelves" phase.

```python
import chromadb
from pathlib import Path
import hashlib
import re


class DocumentIngester:
    def __init__(self, collection_name: str = "documents"):
        self.client = chromadb.PersistentClient(path="./rag_db")
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
        sentences = re.split(r'(?<=[.!?])\s+', text)
        chunks = []
        current = ""

        for sentence in sentences:
            if len(current) + len(sentence) > chunk_size and current:
                chunks.append(current.strip())
                words = current.split()
                overlap_text = " ".join(words[-10:]) if len(words) > 10 else current
                current = overlap_text + " " + sentence
            else:
                current = current + " " + sentence if current else sentence

        if current.strip():
            chunks.append(current.strip())

        return chunks

    def ingest_file(self, file_path: str):
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        text = path.read_text(encoding="utf-8")
        chunks = self.chunk_text(text)

        ids = []
        documents = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            chunk_id = hashlib.md5(f"{file_path}:{i}".encode()).hexdigest()
            ids.append(chunk_id)
            documents.append(chunk)
            metadatas.append({
                "source": str(path.name),
                "chunk_index": i,
                "total_chunks": len(chunks),
            })

        self.collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )

        return len(chunks)

    def ingest_directory(self, dir_path: str, extensions: list[str] | None = None):
        if extensions is None:
            extensions = [".txt", ".md"]

        path = Path(dir_path)
        total = 0

        for ext in extensions:
            for file in path.rglob(f"*{ext}"):
                count = self.ingest_file(str(file))
                total += count
                print(f"  Ingested {file.name}: {count} chunks")

        print(f"\nTotal: {total} chunks ingested")
        return total
```

---

## Step 2: Retrieval

Find the most relevant chunks for a query.

```python
class Retriever:
    def __init__(self, collection_name: str = "documents"):
        client = chromadb.PersistentClient(path="./rag_db")
        self.collection = client.get_collection(collection_name)

    def search(
        self,
        query: str,
        top_k: int = 5,
        filter_metadata: dict | None = None,
    ) -> list[dict]:
        kwargs = {
            "query_texts": [query],
            "n_results": top_k,
        }

        if filter_metadata:
            kwargs["where"] = filter_metadata

        results = self.collection.query(**kwargs)

        documents = []
        for i in range(len(results["ids"][0])):
            documents.append({
                "id": results["ids"][0][i],
                "content": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i],
                "relevance": 1 - results["distances"][0][i],
            })

        return documents
```

---

## Step 3: Generation

Combine the query and retrieved context, send to the LLM.

```python
from openai import OpenAI


class Generator:
    def __init__(self, model: str = "gpt-4o-mini"):
        self.client = OpenAI()
        self.model = model

    def generate(
        self,
        query: str,
        context_docs: list[dict],
        system_prompt: str | None = None,
    ) -> dict:
        if system_prompt is None:
            system_prompt = (
                "You are a helpful assistant. Answer the user's question "
                "based ONLY on the provided context. If the context doesn't "
                "contain the answer, say 'I don't have enough information "
                "to answer that.' Cite which source you used."
            )

        context = "\n\n---\n\n".join(
            f"Source: {doc['metadata'].get('source', 'unknown')}\n{doc['content']}"
            for doc in context_docs
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {query}",
            },
        ]

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.1,
        )

        return {
            "answer": response.choices[0].message.content,
            "sources": [doc["metadata"].get("source", "unknown") for doc in context_docs],
            "model": self.model,
        }
```

---

## Step 4: The Complete Pipeline

Wire it all together.

```python
class RAGPipeline:
    def __init__(
        self,
        collection_name: str = "documents",
        model: str = "gpt-4o-mini",
        top_k: int = 5,
        relevance_threshold: float = 0.3,
    ):
        self.retriever = Retriever(collection_name)
        self.generator = Generator(model)
        self.top_k = top_k
        self.relevance_threshold = relevance_threshold

    def query(self, question: str) -> dict:
        retrieved = self.retriever.search(question, top_k=self.top_k)

        relevant = [
            doc for doc in retrieved
            if doc["relevance"] >= self.relevance_threshold
        ]

        if not relevant:
            return {
                "answer": "I couldn't find relevant information to answer that.",
                "sources": [],
                "num_chunks_searched": len(retrieved),
            }

        result = self.generator.generate(question, relevant)
        result["num_chunks_used"] = len(relevant)
        result["relevance_scores"] = [
            round(doc["relevance"], 3) for doc in relevant
        ]

        return result


ingester = DocumentIngester()
ingester.ingest_directory("./docs")

rag = RAGPipeline()
result = rag.query("How do I configure authentication?")

print(f"Answer: {result['answer']}")
print(f"Sources: {result['sources']}")
print(f"Relevance: {result.get('relevance_scores', [])}")
```

---

## Conversation History

Real apps need multi-turn conversations. The model needs
to remember what was already discussed.

```python
from openai import OpenAI


class ConversationalRAG:
    def __init__(self, rag_pipeline: RAGPipeline):
        self.rag = rag_pipeline
        self.client = OpenAI()
        self.history: list[dict] = []

    def _rewrite_query(self, question: str) -> str:
        if not self.history:
            return question

        recent = self.history[-4:]
        history_text = "\n".join(
            f"{msg['role']}: {msg['content'][:200]}" for msg in recent
        )

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Rewrite the user's question to be standalone, "
                        "incorporating context from the conversation history. "
                        "Output ONLY the rewritten question."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"History:\n{history_text}\n\n"
                        f"Latest question: {question}"
                    ),
                },
            ],
        )

        return response.choices[0].message.content.strip()

    def chat(self, question: str) -> str:
        standalone = self._rewrite_query(question)
        result = self.rag.query(standalone)
        answer = result["answer"]

        self.history.append({"role": "user", "content": question})
        self.history.append({"role": "assistant", "content": answer})

        return answer
```

```
Without query rewriting:

User: "What authentication methods do you support?"
Bot:  "We support OAuth2, SAML, and API keys."
User: "How do I set up the first one?"
                    ^^^^^^^^^^^^^^^^^
                    "First one" = meaningless without context

With query rewriting:

User question: "How do I set up the first one?"
Rewritten:     "How do I set up OAuth2 authentication?"
                    Now the vector search works!
```

---

## Error Handling

Production RAG needs to handle failures gracefully.

```python
class RobustRAGPipeline:
    def __init__(self, collection_name: str = "documents"):
        self.retriever = Retriever(collection_name)
        self.generator = Generator()

    def query(self, question: str) -> dict:
        if not question or not question.strip():
            return {"answer": "Please provide a question.", "error": "empty_query"}

        try:
            retrieved = self.retriever.search(question, top_k=5)
        except Exception as exc:
            return {
                "answer": "I'm having trouble searching right now.",
                "error": f"retrieval_error: {exc}",
            }

        relevant = [doc for doc in retrieved if doc["relevance"] >= 0.3]

        if not relevant:
            return {
                "answer": "I couldn't find relevant information.",
                "error": "no_relevant_docs",
                "best_score": retrieved[0]["relevance"] if retrieved else 0,
            }

        try:
            result = self.generator.generate(question, relevant)
        except Exception as exc:
            context_preview = relevant[0]["content"][:500]
            return {
                "answer": f"Here's what I found: {context_preview}...",
                "error": f"generation_error: {exc}",
                "fallback": True,
            }

        return result
```

---

## Exercises

**Exercise 1: Build a Chat-With-Docs System**
Create a RAG pipeline over a folder of markdown files.
Include: ingestion, search, generation, and a CLI interface
where you can ask questions in a loop.

**Exercise 2: Source Citations**
Modify the generator to include inline citations like [1]
in the answer, with a reference list at the bottom showing
which chunk each citation came from.

**Exercise 3: Multi-Collection RAG**
Build a pipeline that searches across 2+ collections
(e.g., "docs" and "faq") and merges results. Show which
collection each result came from.

**Exercise 4: RAG API**
Wrap your pipeline in a FastAPI app with endpoints:
- POST /ingest (upload a file)
- POST /query (ask a question)
- GET /sources (list all ingested sources)
Include proper error responses and request validation.

---

Next: [09 - Advanced RAG](09-advanced-rag.md)
