# Lesson 02: Serving Models with FastAPI

## Your Model's Front Door

```
  +----------+     HTTP      +----------+     Python     +----------+
  |  Client  | -----------> |  FastAPI  | ------------> |  Model   |
  |  (user)  | <----------- |  Server   | <------------ |          |
  +----------+     JSON      +----------+     Tensor     +----------+
```

Imagine your ML model is a brilliant chef locked in a kitchen.
FastAPI is the **waiter** -- it takes orders from customers (HTTP
requests), translates them into something the chef understands
(tensors), gets the result (predictions), and brings it back in
a nice plate (JSON response).

Without the waiter, no one can access the chef's skills.

---

## The Simplest Model Server

```python
from fastapi import FastAPI
import numpy as np

app = FastAPI()

weights = np.array([0.5, -0.3, 0.8])
bias = 0.1


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/predict")
async def predict(features: list[float]):
    if len(features) != len(weights):
        return {"error": f"Expected {len(weights)} features, got {len(features)}"}
    prediction = float(np.dot(features, weights) + bias)
    return {"prediction": prediction}
```

Run it:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

---

## Request & Response Schemas

In production, always define explicit schemas. Think of them as
the **menu** -- customers know exactly what to order and what
they'll get back.

```python
from pydantic import BaseModel, Field, field_validator
from fastapi import FastAPI, HTTPException
from enum import Enum


class ModelName(str, Enum):
    SENTIMENT = "sentiment"
    TOXICITY = "toxicity"


class PredictionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    model_name: ModelName = ModelName.SENTIMENT

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Text cannot be blank")
        return stripped


class PredictionResponse(BaseModel):
    label: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    model_version: str


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
```

---

## A Production-Grade Serving App

```python
import time
import logging
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoTokenizer, AutoModelForSequenceClassification

logger = logging.getLogger(__name__)

models: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading models...")
    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased-finetuned-sst-2-english")
    model = AutoModelForSequenceClassification.from_pretrained(
        "distilbert-base-uncased-finetuned-sst-2-english"
    )
    model.eval()
    models["sentiment"] = {"model": model, "tokenizer": tokenizer}
    logger.info("Models loaded successfully")

    yield

    models.clear()
    logger.info("Models unloaded")


app = FastAPI(
    title="ML Inference API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)
```

---

## The Prediction Endpoint

```python
LABEL_MAP = {0: "negative", 1: "positive"}


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    if request.model_name.value not in models:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{request.model_name}' not loaded",
        )

    model_bundle = models[request.model_name.value]
    tokenizer = model_bundle["tokenizer"]
    model = model_bundle["model"]

    inputs = tokenizer(
        request.text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True,
    )

    with torch.no_grad():
        outputs = model(**inputs)

    probabilities = torch.softmax(outputs.logits, dim=-1)
    predicted_class = torch.argmax(probabilities, dim=-1).item()
    confidence = probabilities[0][predicted_class].item()

    return PredictionResponse(
        label=LABEL_MAP.get(predicted_class, "unknown"),
        confidence=round(confidence, 4),
        model_version="1.0.0",
    )
```

---

## Middleware: The Bouncer and the Stopwatch

```
  Request --> [Timing] --> [Logging] --> [Route] --> Response
                |              |                        |
                v              v                        v
           "How long?"   "Who asked?"            "What happened?"
```

```python
@app.middleware("http")
async def add_timing(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Response-Time-Ms"] = f"{duration_ms:.2f}"
    logger.info(
        "method=%s path=%s status=%d duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response
```

---

## Health Checks: Is the Restaurant Open?

Production services need health endpoints. Load balancers and
orchestrators use these to know if your service is alive.

```
  Load Balancer                   Your Service
  +---------------+               +---------------+
  | GET /health   | ------------> | Check model   |
  | every 10s     |               | Check memory  |
  |               | <------------ | Return status |
  +---------------+               +---------------+
         |
         v
  If unhealthy --> route traffic elsewhere
```

```python
import psutil


@app.get("/health")
async def health_check():
    memory = psutil.virtual_memory()
    model_loaded = "sentiment" in models

    if not model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if memory.percent > 95:
        raise HTTPException(status_code=503, detail="Memory critical")

    return {
        "status": "healthy",
        "models_loaded": list(models.keys()),
        "memory_percent": memory.percent,
    }


@app.get("/ready")
async def readiness_check():
    if not models:
        raise HTTPException(status_code=503, detail="Not ready")
    return {"status": "ready"}
```

---

## Async Serving: Why It Matters

```
  Synchronous (blocking)          Async (non-blocking)
  +----+----+----+----+           +----+----+----+----+
  | R1 | R2 | R3 | R4 |           | R1 | R2 | R3 | R4 |
  +----+----+----+----+           +--+-+--+-+--+-+--+-+
  |====|    |    |    |  t=0      |==|==|==|==|  |  |  t=0
  |    |====|    |    |  t=1      |  |  |  |  |==|==|  t=1
  |    |    |====|    |  t=2      |==|==|==|==|  |  |  t=2
  |    |    |    |====|  t=3
                                  Total: ~2 units
  Total: 4 units
```

FastAPI is async by default. But model inference is CPU/GPU-bound,
so you need to be careful:

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)


def run_inference_sync(text: str) -> dict:
    model_bundle = models["sentiment"]
    tokenizer = model_bundle["tokenizer"]
    model = model_bundle["model"]

    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)

    with torch.no_grad():
        outputs = model(**inputs)

    probs = torch.softmax(outputs.logits, dim=-1)
    predicted = torch.argmax(probs, dim=-1).item()

    return {
        "label": LABEL_MAP.get(predicted, "unknown"),
        "confidence": round(probs[0][predicted].item(), 4),
    }


@app.post("/predict-async")
async def predict_async(request: PredictionRequest):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, run_inference_sync, request.text)
    return PredictionResponse(model_version="1.0.0", **result)
```

---

## Batching Requests for Throughput

```
  Without batching:              With batching:
  R1 --> [infer] --> resp        R1 -+
  R2 --> [infer] --> resp        R2 -+--> [batch infer] --> responses
  R3 --> [infer] --> resp        R3 -+

  3 forward passes               1 forward pass
  3x GPU kernel launches         1x GPU kernel launch
```

```python
import asyncio
from dataclasses import dataclass, field


@dataclass
class BatchProcessor:
    max_batch_size: int = 32
    max_wait_ms: float = 50.0
    _queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    _running: bool = False

    async def start(self):
        self._running = True
        asyncio.create_task(self._process_loop())

    async def _process_loop(self):
        while self._running:
            batch = []
            futures = []

            first_item, first_future = await self._queue.get()
            batch.append(first_item)
            futures.append(first_future)

            deadline = asyncio.get_event_loop().time() + (self.max_wait_ms / 1000)

            while len(batch) < self.max_batch_size:
                remaining = deadline - asyncio.get_event_loop().time()
                if remaining <= 0:
                    break
                try:
                    item, future = await asyncio.wait_for(
                        self._queue.get(), timeout=remaining
                    )
                    batch.append(item)
                    futures.append(future)
                except asyncio.TimeoutError:
                    break

            results = self._run_batch(batch)

            for future, result in zip(futures, results):
                future.set_result(result)

    def _run_batch(self, texts: list[str]) -> list[dict]:
        model_bundle = models["sentiment"]
        tokenizer = model_bundle["tokenizer"]
        model = model_bundle["model"]

        inputs = tokenizer(
            texts, return_tensors="pt", truncation=True,
            max_length=512, padding=True,
        )

        with torch.no_grad():
            outputs = model(**inputs)

        probs = torch.softmax(outputs.logits, dim=-1)
        predicted = torch.argmax(probs, dim=-1)

        return [
            {
                "label": LABEL_MAP.get(p.item(), "unknown"),
                "confidence": round(probs[i][p].item(), 4),
            }
            for i, p in enumerate(predicted)
        ]

    async def predict(self, text: str) -> dict:
        future = asyncio.get_event_loop().create_future()
        await self._queue.put((text, future))
        return await future
```

---

## Dockerizing Your Server

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

```
  Host Machine
  +----------------------------------------+
  |  Docker Container                       |
  |  +----------------------------------+  |
  |  | Python 3.11                      |  |
  |  | FastAPI + Uvicorn                |  |
  |  | Model weights                    |  |
  |  | Port 8000 <---> Host port 8000   |  |
  |  +----------------------------------+  |
  +----------------------------------------+
```

---

## Error Handling Patterns

```python
from fastapi.responses import JSONResponse


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


@app.exception_handler(torch.cuda.OutOfMemoryError)
async def oom_handler(request: Request, exc: torch.cuda.OutOfMemoryError):
    torch.cuda.empty_cache()
    logger.critical("GPU OOM error: %s", exc)
    return JSONResponse(
        status_code=503,
        content={"error": "GPU out of memory", "detail": "Try a shorter input"},
    )
```

---

## Testing Your API

```python
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_predict_valid():
    response = client.post(
        "/predict",
        json={"text": "This movie was amazing!", "model_name": "sentiment"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "label" in data
    assert 0 <= data["confidence"] <= 1


def test_predict_empty_text():
    response = client.post("/predict", json={"text": "", "model_name": "sentiment"})
    assert response.status_code == 422
```

---

## Exercises

1. **Basic Server**: Build a FastAPI server that serves a
   scikit-learn model. Include `/health` and `/predict` endpoints.

2. **Schema Validation**: Add Pydantic schemas with validation
   for a model that takes numerical features. Test edge cases
   (empty input, wrong types, too many features).

3. **Batch Endpoint**: Add a `/predict-batch` endpoint that
   accepts a list of inputs and returns a list of predictions.
   Compare throughput with individual calls.

4. **Docker It**: Containerize your server. Test that the
   container starts, loads the model, and serves predictions.

---

[Next: Lesson 03 - Model Servers -->](03-model-servers.md)
