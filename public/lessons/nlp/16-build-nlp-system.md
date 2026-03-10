# Lesson 16: Capstone — Build a Document Q&A System

## The Project: RAG-Based Document Q&A

```
SYSTEM ARCHITECTURE

  User uploads documents          User asks questions
       |                               |
       v                               v
  +-----------+                  +-----------+
  | Ingest    |                  | Query     |
  | Pipeline  |                  | Pipeline  |
  +-----------+                  +-----------+
       |                               |
       v                               v
  +-----------+                  +-----------+
  | Chunk &   |                  | Embed     |
  | Embed     |                  | Query     |
  +-----------+                  +-----------+
       |                               |
       v                               v
  +-----------+   search         +-----------+
  | Vector    |<-----------------| Retriever |
  | Store     |                  +-----------+
  +-----------+                        |
                                       v
                                 +-----------+
                                 | Reranker  |
                                 +-----------+
                                       |
                                       v
                                 +-----------+
                                 | Generator |
                                 | (LLM)     |
                                 +-----------+
                                       |
                                       v
                                 Answer with sources
```

## Step 1: Document Ingestion

```python
from dataclasses import dataclass
from pathlib import Path
import hashlib

@dataclass
class Document:
    id: str
    title: str
    content: str
    source: str
    metadata: dict

@dataclass
class Chunk:
    id: str
    document_id: str
    content: str
    position: int
    metadata: dict

def generate_id(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()[:16]

def load_text_file(path: Path) -> Document:
    content = path.read_text(encoding="utf-8")
    return Document(
        id=generate_id(str(path) + content[:100]),
        title=path.stem,
        content=content,
        source=str(path),
        metadata={"file_type": path.suffix, "size_bytes": path.stat().st_size},
    )

def chunk_document(
    document: Document,
    chunk_size: int = 500,
    overlap: int = 100,
) -> list[Chunk]:
    text = document.content
    sentences = split_into_sentences(text)

    chunks = []
    current_chunk: list[str] = []
    current_length = 0
    position = 0

    for sentence in sentences:
        sentence_length = len(sentence.split())

        if current_length + sentence_length > chunk_size and current_chunk:
            chunk_text = " ".join(current_chunk)
            chunks.append(Chunk(
                id=generate_id(f"{document.id}_{position}"),
                document_id=document.id,
                content=chunk_text,
                position=position,
                metadata={
                    "document_title": document.title,
                    "source": document.source,
                    "word_count": current_length,
                },
            ))
            position += 1

            overlap_words = 0
            overlap_start = len(current_chunk)
            for i in range(len(current_chunk) - 1, -1, -1):
                overlap_words += len(current_chunk[i].split())
                if overlap_words >= overlap:
                    overlap_start = i
                    break
            current_chunk = current_chunk[overlap_start:]
            current_length = sum(len(s.split()) for s in current_chunk)

        current_chunk.append(sentence)
        current_length += sentence_length

    if current_chunk:
        chunks.append(Chunk(
            id=generate_id(f"{document.id}_{position}"),
            document_id=document.id,
            content=" ".join(current_chunk),
            position=position,
            metadata={
                "document_title": document.title,
                "source": document.source,
                "word_count": current_length,
            },
        ))

    return chunks

def split_into_sentences(text: str) -> list[str]:
    import re
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if s.strip()]
```

## Step 2: Vector Store

```python
import numpy as np
from sentence_transformers import SentenceTransformer
from dataclasses import dataclass, field
import json

@dataclass
class SearchResult:
    chunk: Chunk
    score: float

class VectorStore:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.encoder = SentenceTransformer(model_name)
        self.chunks: list[Chunk] = []
        self.embeddings: np.ndarray | None = None

    def add_chunks(self, chunks: list[Chunk]) -> None:
        texts = [chunk.content for chunk in chunks]
        new_embeddings = self.encoder.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=True,
            batch_size=64,
        )

        self.chunks.extend(chunks)

        if self.embeddings is None:
            self.embeddings = new_embeddings
        else:
            self.embeddings = np.vstack([self.embeddings, new_embeddings])

    def search(self, query: str, top_k: int = 10) -> list[SearchResult]:
        if self.embeddings is None or len(self.chunks) == 0:
            return []

        query_embedding = self.encoder.encode(
            [query],
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        scores = np.dot(self.embeddings, query_embedding.T).squeeze()
        top_indices = np.argsort(scores)[::-1][:top_k]

        return [
            SearchResult(
                chunk=self.chunks[idx],
                score=float(scores[idx]),
            )
            for idx in top_indices
        ]

    def save(self, path: str) -> None:
        np.save(f"{path}_embeddings.npy", self.embeddings)
        chunks_data = [
            {
                "id": c.id,
                "document_id": c.document_id,
                "content": c.content,
                "position": c.position,
                "metadata": c.metadata,
            }
            for c in self.chunks
        ]
        with open(f"{path}_chunks.json", "w") as f:
            json.dump(chunks_data, f)

    def load(self, path: str) -> None:
        self.embeddings = np.load(f"{path}_embeddings.npy")
        with open(f"{path}_chunks.json") as f:
            chunks_data = json.load(f)
        self.chunks = [
            Chunk(**data) for data in chunks_data
        ]
```

## Step 3: Reranker

```python
from sentence_transformers import CrossEncoder

class Reranker:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model = CrossEncoder(model_name)

    def rerank(
        self,
        query: str,
        results: list[SearchResult],
        top_k: int = 5,
    ) -> list[SearchResult]:
        if not results:
            return []

        pairs = [(query, r.chunk.content) for r in results]
        scores = self.model.predict(pairs)

        for result, score in zip(results, scores):
            result.score = float(score)

        ranked = sorted(results, key=lambda r: r.score, reverse=True)
        return ranked[:top_k]
```

## Step 4: Answer Generation

```python
from openai import OpenAI

class AnswerGenerator:
    def __init__(self, model: str = "gpt-4o-mini"):
        self.client = OpenAI()
        self.model = model

    def generate(
        self,
        query: str,
        context_chunks: list[SearchResult],
        max_tokens: int = 500,
    ) -> dict:
        context_parts = []
        for i, result in enumerate(context_chunks):
            source = result.chunk.metadata.get("document_title", "Unknown")
            context_parts.append(
                f"[Source {i+1}: {source}]\n{result.chunk.content}"
            )

        context = "\n\n---\n\n".join(context_parts)

        system_prompt = """You are a helpful assistant that answers questions based on provided documents.
Rules:
- Only answer based on the provided context
- If the answer is not in the context, say "I could not find this information in the documents"
- Cite sources using [Source N] notation
- Be concise and accurate"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
            ],
            max_tokens=max_tokens,
            temperature=0.1,
        )

        answer = response.choices[0].message.content or ""

        return {
            "answer": answer,
            "sources": [
                {
                    "document": r.chunk.metadata.get("document_title", "Unknown"),
                    "excerpt": r.chunk.content[:200],
                    "relevance_score": round(r.score, 4),
                }
                for r in context_chunks
            ],
            "model": self.model,
            "tokens_used": response.usage.total_tokens if response.usage else 0,
        }
```

## Step 5: Putting It All Together

```python
from pathlib import Path

class DocumentQA:
    def __init__(self):
        self.vector_store = VectorStore()
        self.reranker = Reranker()
        self.generator = AnswerGenerator()
        self.documents: dict[str, Document] = {}

    def ingest_file(self, file_path: str) -> dict:
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        document = load_text_file(path)
        self.documents[document.id] = document

        chunks = chunk_document(document, chunk_size=500, overlap=100)
        self.vector_store.add_chunks(chunks)

        return {
            "document_id": document.id,
            "title": document.title,
            "chunks_created": len(chunks),
        }

    def ingest_directory(self, directory: str) -> list[dict]:
        path = Path(directory)
        results = []

        for file_path in path.glob("**/*.txt"):
            result = self.ingest_file(str(file_path))
            results.append(result)

        for file_path in path.glob("**/*.md"):
            result = self.ingest_file(str(file_path))
            results.append(result)

        return results

    def ask(
        self,
        question: str,
        top_k_retrieval: int = 10,
        top_k_rerank: int = 5,
    ) -> dict:
        retrieval_results = self.vector_store.search(question, top_k=top_k_retrieval)

        if not retrieval_results:
            return {
                "answer": "No documents have been ingested yet.",
                "sources": [],
            }

        reranked = self.reranker.rerank(question, retrieval_results, top_k=top_k_rerank)

        response = self.generator.generate(question, reranked)

        return response

    def save(self, path: str) -> None:
        self.vector_store.save(path)

    def load(self, path: str) -> None:
        self.vector_store.load(path)


if __name__ == "__main__":
    qa = DocumentQA()

    print("Ingesting documents...")
    results = qa.ingest_directory("./documents")
    for r in results:
        print(f"  {r['title']}: {r['chunks_created']} chunks")

    print("\nReady for questions!")

    while True:
        question = input("\nQuestion (or 'quit'): ").strip()
        if question.lower() == "quit":
            break

        response = qa.ask(question)
        print(f"\nAnswer: {response['answer']}")
        print(f"\nSources:")
        for source in response["sources"]:
            print(f"  - {source['document']} (score: {source['relevance_score']})")
```

## Exercises

1. Build the complete Document Q&A system from this lesson. Ingest at least 5 text documents and test with 10 diverse questions.

2. Add evaluation: create a test set of 20 question-answer pairs, run the system, and measure answer quality using ROUGE and BERTScore against gold answers.

3. Implement hybrid search: combine BM25 keyword search with dense vector search using Reciprocal Rank Fusion. Compare retrieval quality.

4. Add a conversation history feature: maintain chat context so follow-up questions like "Tell me more about that" work correctly.

5. Deploy the system as a web application: FastAPI backend with the Q&A pipeline, React frontend with chat UI, Docker Compose for the full stack.

## Key Takeaways

```
+-------------------------------------------+
| DOCUMENT Q&A SYSTEM                       |
|                                           |
| 1. Chunk wisely: sentence boundaries     |
| 2. Embed and index for fast retrieval    |
| 3. Rerank to improve precision           |
| 4. Generate with grounded context        |
| 5. Always cite sources                   |
| 6. Evaluate with gold-standard Q&A pairs |
+-------------------------------------------+
```
