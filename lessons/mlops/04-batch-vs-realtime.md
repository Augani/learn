# Lesson 04: Batch vs Real-Time Inference

## Restaurant Orders vs Buffet

```
  Real-Time (Restaurant)           Batch (Buffet)
  +------------------------+       +------------------------+
  | Customer orders         |       | Chef preps everything  |
  | Chef cooks immediately  |       | at once in the morning |
  | Food arrives in minutes |       | All dishes laid out    |
  | One order at a time     |       | Customers serve selves |
  |                        |       |                        |
  | Low latency            |       | High throughput        |
  | Higher cost per request |       | Lower cost per request |
  +------------------------+       +------------------------+
```

In a restaurant, each order is cooked fresh -- you get exactly
what you want, fast. That's **real-time inference**.

A buffet prepares all the food in advance in big batches. It's
cheaper and feeds more people, but you eat what's available.
That's **batch inference**.

---

## When to Use Which

```
  +------------------+-------------------+------------------+
  | Criteria         | Real-Time         | Batch            |
  +------------------+-------------------+------------------+
  | Latency need     | < 100ms           | Minutes to hours |
  | Volume           | 1-1000 req/sec    | Millions of items|
  | Freshness        | Must be current   | Can be stale     |
  | Cost priority    | Speed > cost      | Cost > speed     |
  | Examples         | Autocomplete,     | Email campaigns, |
  |                  | fraud detection,  | recommendations, |
  |                  | chatbots          | reports, ETL     |
  +------------------+-------------------+------------------+
```

---

## Real-Time Inference Architecture

```
  User Action (click, type, submit)
       |
       v  (milliseconds matter)
  +----------+     +----------+     +----------+
  | API      |---->| Model    |---->| Response |
  | Gateway  |     | Server   |     | Cache    |
  +----------+     +----------+     +----------+
       |                                  |
       +----------------------------------+
       |
       v
  User sees result (<200ms total)
```

### Real-Time Example: Fraud Detection

```python
from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import onnxruntime as ort

app = FastAPI()
session = ort.InferenceSession("fraud_model.onnx")


class Transaction(BaseModel):
    amount: float
    merchant_category: int
    hour_of_day: int
    distance_from_home: float
    is_foreign: bool


class FraudResult(BaseModel):
    is_fraud: bool
    confidence: float
    transaction_id: str


@app.post("/check-fraud", response_model=FraudResult)
async def check_fraud(txn: Transaction):
    features = np.array([[
        txn.amount,
        txn.merchant_category,
        txn.hour_of_day,
        txn.distance_from_home,
        float(txn.is_foreign),
    ]], dtype=np.float32)

    outputs = session.run(None, {"features": features})
    probability = float(outputs[0][0][1])

    return FraudResult(
        is_fraud=probability > 0.85,
        confidence=round(probability, 4),
        transaction_id=f"txn_{hash(str(txn.amount)):#010x}",
    )
```

---

## Batch Inference Architecture

```
  Scheduler (cron / orchestrator)
       |
       v  (runs on schedule)
  +----------+     +----------+     +----------+
  | Data     |---->| Batch    |---->| Output   |
  | Source   |     | Processor|     | Store    |
  | (S3, DB) |     | (GPU)    |     | (S3, DB) |
  +----------+     +----------+     +----------+

  Typical schedule: hourly, daily, weekly
```

### Batch Example: Product Recommendations

```python
import pandas as pd
import torch
from torch.utils.data import DataLoader, Dataset
from pathlib import Path


class UserDataset(Dataset):
    def __init__(self, features: pd.DataFrame):
        self.features = torch.tensor(features.values, dtype=torch.float32)

    def __len__(self):
        return len(self.features)

    def __getitem__(self, idx):
        return self.features[idx]


def run_batch_inference(
    model_path: str,
    input_path: str,
    output_path: str,
    batch_size: int = 256,
    device: str = "cuda",
):
    model = torch.jit.load(model_path)
    model = model.to(device)
    model.eval()

    df = pd.read_parquet(input_path)
    user_ids = df["user_id"].tolist()
    feature_cols = [c for c in df.columns if c != "user_id"]

    dataset = UserDataset(df[feature_cols])
    loader = DataLoader(dataset, batch_size=batch_size, num_workers=4)

    all_predictions = []

    with torch.no_grad():
        for batch in loader:
            batch = batch.to(device)
            outputs = model(batch)
            predictions = torch.argmax(outputs, dim=-1)
            all_predictions.extend(predictions.cpu().tolist())

    results = pd.DataFrame({
        "user_id": user_ids,
        "recommendation": all_predictions,
    })

    results.to_parquet(output_path, index=False)
    return len(results)
```

---

## Queue-Based Processing: The Middle Ground

```
  Real-Time  <-------  Queue-Based  -------->  Batch
  (instant)            (near-real-time)         (scheduled)

  +-----+     +-------+     +--------+     +--------+
  | API | --> | Queue | --> | Worker | --> | Result |
  +-----+     | (Kafka|     | Pool   |     | Store  |
              | Redis)|     |        |     |        |
              +-------+     +--------+     +--------+

  Like a deli counter: you take a number,
  wait briefly, get served in order.
```

### Queue-Based Example with Redis

```python
import json
import redis
import time
from dataclasses import dataclass


@dataclass
class InferenceJob:
    job_id: str
    input_data: dict
    status: str = "pending"
    result: dict | None = None


class InferenceQueue:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url)
        self.queue_name = "inference_queue"
        self.results_prefix = "result:"

    def submit(self, job_id: str, input_data: dict) -> str:
        job = {"job_id": job_id, "input_data": input_data}
        self.redis.lpush(self.queue_name, json.dumps(job))
        self.redis.set(f"{self.results_prefix}{job_id}", json.dumps({"status": "pending"}))
        return job_id

    def get_result(self, job_id: str) -> dict | None:
        result = self.redis.get(f"{self.results_prefix}{job_id}")
        if result is None:
            return None
        return json.loads(result)

    def process_next(self, model) -> bool:
        raw = self.redis.rpop(self.queue_name)
        if raw is None:
            return False

        job = json.loads(raw)
        job_id = job["job_id"]

        try:
            prediction = model.predict(job["input_data"])
            result = {"status": "completed", "prediction": prediction}
        except Exception as exc:
            result = {"status": "failed", "error": str(exc)}

        self.redis.set(
            f"{self.results_prefix}{job_id}",
            json.dumps(result),
        )
        self.redis.expire(f"{self.results_prefix}{job_id}", 3600)
        return True
```

### Worker Process

```python
def run_worker(queue: InferenceQueue, model, poll_interval: float = 0.1):
    while True:
        processed = queue.process_next(model)
        if not processed:
            time.sleep(poll_interval)
```

### API with Queue Backend

```python
import uuid
from fastapi import FastAPI, HTTPException

app = FastAPI()
queue = InferenceQueue()


@app.post("/submit")
async def submit_job(input_data: dict):
    job_id = str(uuid.uuid4())
    queue.submit(job_id, input_data)
    return {"job_id": job_id, "status": "submitted"}


@app.get("/result/{job_id}")
async def get_result(job_id: str):
    result = queue.get_result(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return result
```

---

## Hybrid Patterns

Most production systems use a mix:

```
  User Request
       |
       +--> Is it in cache? --YES--> Return cached result
       |                              (from last batch run)
       |
       +--> NO --> Is it urgent? --YES--> Real-time inference
       |
       +--> NO --> Queue it for next batch
```

```python
from functools import lru_cache


class HybridPredictor:
    def __init__(self, model, cache_client, queue):
        self.model = model
        self.cache = cache_client
        self.queue = queue

    def predict(self, user_id: str, features: dict, urgent: bool = False) -> dict:
        cached = self.cache.get(f"pred:{user_id}")
        if cached is not None:
            return {"source": "cache", "prediction": json.loads(cached)}

        if urgent:
            result = self.model.predict(features)
            self.cache.set(f"pred:{user_id}", json.dumps(result), ex=3600)
            return {"source": "realtime", "prediction": result}

        job_id = self.queue.submit(user_id, features)
        return {"source": "queued", "job_id": job_id}
```

---

## Performance Comparison

```
  Metric          | Real-Time  | Queue-Based | Batch
  ----------------|------------|-------------|--------
  Latency         | ~50ms      | ~1-30s      | hours
  Throughput      | ~1K/s      | ~10K/s      | millions
  GPU Utilization | 20-40%     | 60-80%      | 90-99%
  Cost/prediction | $$$        | $$          | $
  Freshness       | Instant    | Near-real   | Stale

  GPU Utilization Visualization:
  Real-Time:  [==........] 20%  (lots of idle time)
  Queue:      [======....] 60%  (batches fill GPU)
  Batch:      [=========.] 95%  (fully packed)
```

---

## Scaling Each Pattern

```
  Real-Time Scaling:
  +--------+
  | LB     |--+--> [Server 1] [GPU]
  |        |  +--> [Server 2] [GPU]
  |        |  +--> [Server 3] [GPU]
  +--------+
  Scale: add more servers

  Batch Scaling:
  +--------+     +--------+--------+--------+
  | Data   | --> | Chunk 1| Chunk 2| Chunk 3|
  | (100M) |     | GPU 1  | GPU 2  | GPU 3  |
  +--------+     +--------+--------+--------+
  Scale: partition data, add more GPUs

  Queue Scaling:
  +-------+     +--------+--------+--------+
  | Queue | --> |Worker 1|Worker 2|Worker 3|
  |       |     +--------+--------+--------+
  +-------+
  Scale: add more workers
```

---

## Decision Framework

```
  Start Here
      |
      v
  Need results in < 1 second?
      |           |
     YES         NO
      |           |
      v           v
  Real-Time    Processing > 10K items?
                  |           |
                 YES         NO
                  |           |
                  v           v
               Batch      Queue-Based
```

---

## Exercises

1. **Latency Budget**: You have a 200ms SLA for an e-commerce
   search page. Your model takes 50ms. Draw the full request
   flow and identify where the other 150ms goes (network,
   preprocessing, serialization). What can you optimize?

2. **Batch Pipeline**: Write a batch inference script that reads
   a CSV of 10,000 items, runs predictions in batches of 256,
   and writes results to a new CSV. Add progress logging.

3. **Queue System**: Implement the Redis queue pattern above.
   Submit 100 jobs, run 3 workers, and verify all results are
   collected. Measure end-to-end latency per job.

4. **Hybrid Predictor**: Build the hybrid cache/realtime/queue
   pattern. Simulate 1000 requests with varying urgency and
   measure cache hit rate, average latency, and throughput.

---

[Next: Lesson 05 - GPU Management -->](05-gpu-management.md)
