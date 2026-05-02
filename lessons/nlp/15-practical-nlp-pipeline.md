# Lesson 15: Practical NLP Pipeline

## The Big Analogy: Food Processing Factory

```
NLP PIPELINE = FOOD PROCESSING

  Raw Ingredients          Raw Text
  (dirty vegetables)       (messy HTML, typos, mixed formats)
       |                        |
       v                        v
  Wash & Sort              Preprocess
  (clean, separate)        (clean, normalize, tokenize)
       |                        |
       v                        v
  Process & Cook           Model Inference
  (cut, combine, heat)    (embed, classify, extract)
       |                        |
       v                        v
  Quality Check            Postprocess
  (taste test, inspect)    (threshold, filter, format)
       |                        |
       v                        v
  Package & Ship           Serve via API
  (label, box, deliver)   (JSON response, monitoring)
```

## Pipeline Architecture

```
END-TO-END NLP SYSTEM

  Input Text
       |
       v
  +-------------+
  | Preprocess  |  Clean, normalize, language detect
  +------+------+
         |
         v
  +------+------+
  | Tokenize    |  Model-specific tokenization
  +------+------+
         |
         v
  +------+------+
  | Embed       |  Dense vector representations
  +------+------+
         |
    +----+----+----+----+
    |         |         |
    v         v         v
  +-----+ +------+ +-------+
  |Class| |NER   | |Sentim |   Task-specific heads
  |ify  | |      | |ent    |
  +--+--+ +--+---+ +---+---+
     |        |         |
     v        v         v
  +------+------+------+------+
  |     Postprocess           |  Aggregate, threshold, format
  +------+------+------+------+
         |
         v
  +------+------+
  | API Response|  Structured JSON
  +--------------+
```

## Step 1: Preprocessing

```python
import re
import unicodedata
from dataclasses import dataclass

@dataclass
class ProcessedText:
    original: str
    cleaned: str
    language: str
    tokens: list[str]
    metadata: dict

def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)

    text = re.sub(r"<[^>]+>", " ", text)

    text = re.sub(r"https?://\S+|www\.\S+", "[URL]", text)

    text = re.sub(r"\S+@\S+\.\S+", "[EMAIL]", text)

    text = re.sub(r"\s+", " ", text)

    text = text.strip()

    return text

def detect_language(text: str) -> str:
    from langdetect import detect
    try:
        return detect(text)
    except Exception:
        return "unknown"

def preprocess(text: str) -> ProcessedText:
    cleaned = clean_text(text)
    language = detect_language(cleaned)

    return ProcessedText(
        original=text,
        cleaned=cleaned,
        language=language,
        tokens=cleaned.split(),
        metadata={
            "original_length": len(text),
            "cleaned_length": len(cleaned),
            "word_count": len(cleaned.split()),
        },
    )
```

## Step 2: Model Pipeline

```python
import torch
from transformers import AutoTokenizer, AutoModel
import numpy as np
from dataclasses import dataclass

@dataclass
class PipelineConfig:
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    classification_model: str = "distilbert-base-uncased-finetuned-sst-2-english"
    ner_model: str = "dslim/bert-base-NER"
    max_length: int = 512
    batch_size: int = 32
    device: str = "cuda" if torch.cuda.is_available() else "cpu"

class NLPPipeline:
    def __init__(self, config: PipelineConfig | None = None):
        self.config = config or PipelineConfig()
        self._embedding_model = None
        self._embedding_tokenizer = None
        self._classifier = None
        self._ner = None

    @property
    def embedder(self):
        if self._embedding_model is None:
            from sentence_transformers import SentenceTransformer
            self._embedding_model = SentenceTransformer(
                self.config.embedding_model,
                device=self.config.device,
            )
        return self._embedding_model

    @property
    def classifier(self):
        if self._classifier is None:
            from transformers import pipeline
            self._classifier = pipeline(
                "sentiment-analysis",
                model=self.config.classification_model,
                device=0 if self.config.device == "cuda" else -1,
            )
        return self._classifier

    @property
    def ner(self):
        if self._ner is None:
            from transformers import pipeline
            self._ner = pipeline(
                "ner",
                model=self.config.ner_model,
                aggregation_strategy="simple",
                device=0 if self.config.device == "cuda" else -1,
            )
        return self._ner

    def embed(self, texts: list[str]) -> np.ndarray:
        return self.embedder.encode(
            texts,
            batch_size=self.config.batch_size,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )

    def classify(self, texts: list[str]) -> list[dict]:
        results = self.classifier(
            texts,
            batch_size=self.config.batch_size,
            truncation=True,
            max_length=self.config.max_length,
        )
        return [
            {"label": r["label"], "score": round(r["score"], 4)}
            for r in results
        ]

    def extract_entities(self, texts: list[str]) -> list[list[dict]]:
        all_entities = []
        for text in texts:
            entities = self.ner(text)
            all_entities.append([
                {
                    "text": e["word"],
                    "label": e["entity_group"],
                    "score": round(e["score"], 4),
                    "start": e["start"],
                    "end": e["end"],
                }
                for e in entities
                if e["score"] > 0.5
            ])
        return all_entities

    def process(self, texts: list[str]) -> list[dict]:
        embeddings = self.embed(texts)
        sentiments = self.classify(texts)
        entities = self.extract_entities(texts)

        results = []
        for i, text in enumerate(texts):
            results.append({
                "text": text,
                "embedding": embeddings[i].tolist(),
                "sentiment": sentiments[i],
                "entities": entities[i],
            })
        return results
```

## Step 3: Postprocessing

```python
from dataclasses import dataclass

@dataclass
class PipelineOutput:
    text: str
    sentiment: dict
    entities: list[dict]
    topics: list[str]
    summary: str | None
    confidence: float

def postprocess(
    raw_results: list[dict],
    confidence_threshold: float = 0.7,
    merge_entities: bool = True,
) -> list[PipelineOutput]:
    outputs = []

    for result in raw_results:
        entities = result["entities"]
        if merge_entities:
            entities = merge_adjacent_entities(entities)

        entities = [
            e for e in entities if e["score"] >= confidence_threshold
        ]

        sentiment = result["sentiment"]
        confidence = sentiment["score"]

        outputs.append(PipelineOutput(
            text=result["text"],
            sentiment=sentiment,
            entities=entities,
            topics=extract_topics(entities),
            summary=None,
            confidence=confidence,
        ))

    return outputs

def merge_adjacent_entities(entities: list[dict]) -> list[dict]:
    if not entities:
        return []

    merged = [entities[0].copy()]

    for entity in entities[1:]:
        prev = merged[-1]
        if (
            entity["label"] == prev["label"]
            and entity["start"] <= prev["end"] + 2
        ):
            prev["text"] = prev["text"] + " " + entity["text"]
            prev["end"] = entity["end"]
            prev["score"] = min(prev["score"], entity["score"])
        else:
            merged.append(entity.copy())

    return merged

def extract_topics(entities: list[dict]) -> list[str]:
    topic_entity_types = {"ORG", "LOC", "PER", "MISC"}
    topics = []
    seen = set()

    for entity in entities:
        if entity["label"] in topic_entity_types:
            normalized = entity["text"].lower().strip()
            if normalized not in seen:
                seen.add(normalized)
                topics.append(entity["text"])

    return topics
```

## Step 4: API Service

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import time

app = FastAPI(title="NLP Pipeline API")

pipeline = NLPPipeline()

class TextRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=100)
    tasks: list[str] = Field(
        default=["sentiment", "entities"],
        description="Tasks to run: sentiment, entities, embed",
    )

class EntityResponse(BaseModel):
    text: str
    label: str
    score: float

class TextResponse(BaseModel):
    text: str
    sentiment: dict | None = None
    entities: list[EntityResponse] | None = None
    embedding: list[float] | None = None
    processing_time_ms: float

class BatchResponse(BaseModel):
    results: list[TextResponse]
    total_processing_time_ms: float

@app.post("/analyze", response_model=BatchResponse)
async def analyze_texts(request: TextRequest) -> BatchResponse:
    start_time = time.time()

    for text in request.texts:
        if len(text) > 10000:
            raise HTTPException(
                status_code=400,
                detail="Text exceeds maximum length of 10000 characters",
            )

    results = []

    sentiments = None
    entities = None
    embeddings = None

    if "sentiment" in request.tasks:
        sentiments = pipeline.classify(request.texts)

    if "entities" in request.tasks:
        entities = pipeline.extract_entities(request.texts)

    if "embed" in request.tasks:
        embeddings = pipeline.embed(request.texts)

    for i, text in enumerate(request.texts):
        results.append(TextResponse(
            text=text,
            sentiment=sentiments[i] if sentiments else None,
            entities=[
                EntityResponse(**e) for e in entities[i]
            ] if entities else None,
            embedding=embeddings[i].tolist() if embeddings is not None else None,
            processing_time_ms=0,
        ))

    total_time = (time.time() - start_time) * 1000

    return BatchResponse(
        results=results,
        total_processing_time_ms=round(total_time, 2),
    )

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

## Step 5: Monitoring and Evaluation

```python
from dataclasses import dataclass, field
from datetime import datetime
import statistics

@dataclass
class PipelineMetrics:
    request_count: int = 0
    total_latency_ms: float = 0.0
    error_count: int = 0
    latencies: list[float] = field(default_factory=list)

    def record_request(self, latency_ms: float, error: bool = False) -> None:
        self.request_count += 1
        self.total_latency_ms += latency_ms
        self.latencies.append(latency_ms)
        if error:
            self.error_count += 1

    def summary(self) -> dict:
        if not self.latencies:
            return {"request_count": 0}

        sorted_latencies = sorted(self.latencies)
        p50_idx = int(len(sorted_latencies) * 0.5)
        p95_idx = int(len(sorted_latencies) * 0.95)
        p99_idx = int(len(sorted_latencies) * 0.99)

        return {
            "request_count": self.request_count,
            "error_rate": self.error_count / self.request_count,
            "avg_latency_ms": self.total_latency_ms / self.request_count,
            "p50_latency_ms": sorted_latencies[p50_idx],
            "p95_latency_ms": sorted_latencies[min(p95_idx, len(sorted_latencies) - 1)],
            "p99_latency_ms": sorted_latencies[min(p99_idx, len(sorted_latencies) - 1)],
        }
```

## Exercises

1. Build a complete NLP pipeline that takes raw text and returns: cleaned text, language, sentiment, named entities, and key topics. Expose it as a FastAPI service.

2. Add batching and caching to the pipeline. Batch requests that arrive within a 50ms window and cache results for identical inputs using an LRU cache.

3. Implement A/B testing: run two different sentiment models on the same input and log both results with latency metrics. Build a dashboard to compare them.

4. Create a document processing pipeline: accept PDF/text uploads, chunk documents, generate embeddings, and store in a vector database for later retrieval.

5. Add monitoring: track request count, latency percentiles, error rate, and model confidence distribution. Alert when p95 latency exceeds 500ms.

## Key Takeaways

```
+-------------------------------------------+
| PRACTICAL NLP PIPELINE                    |
|                                           |
| 1. Preprocess: clean before you model    |
| 2. Lazy load: initialize models on first |
|    use, not at startup                    |
| 3. Batch: process multiple texts together|
| 4. Postprocess: threshold, merge, format |
| 5. Monitor: latency, errors, confidence  |
| 6. API: validate inputs, handle errors   |
+-------------------------------------------+
```
