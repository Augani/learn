# Lesson 37: Design an AI Inference Platform

Serving ML models in production is fundamentally different from training
them. Training runs for hours on a batch of data. Inference serves
millions of users in real-time, where every millisecond of latency
matters and GPU utilization determines your cost.

**Analogy:** Training is like a chef perfecting a recipe in a test
kitchen — take all the time you need. Inference is like running a
restaurant during dinner rush — hundreds of orders, each must be
plated in under 30 seconds, and you're paying $50/hour for every
burner on the stove whether it's cooking or idle.

---

## Step 1: Requirements

### Functional Requirements

1. **Serve predictions** — Real-time inference for multiple models
2. **Model versioning** — Deploy new model versions without downtime
3. **A/B testing** — Route traffic between model versions
4. **Batch inference** — Process large datasets offline
5. **Embedding generation** — Generate and cache vector embeddings

### Non-Functional Requirements

1. **Latency < 100ms** for real-time inference (p99)
2. **GPU utilization > 70%** (GPUs cost $2-10/hour each)
3. **Auto-scaling** — Scale GPU count with demand
4. **Model isolation** — One model's failure doesn't affect others

### Scale Estimation

```
Real-time requests:    10,000 req/sec
Average inference:     20ms per request on GPU
Batch capacity:        1M predictions/hour
Models in production:  50 different models
GPU fleet:             200 GPUs (A100 / H100)

Cost:
  200 GPUs × $3/hour = $600/hour = $14,400/day
  If utilization is 30%: wasting $10,000/day
  Getting to 70% utilization saves $5,700/day
```

---

## Step 2: High-Level Design

```
┌──────────────────────────────────────────────────────────┐
│                        CLIENTS                            │
│              (API calls, batch jobs)                      │
└──────────┬───────────────────────────────────────────────┘
           │
    ┌──────▼──────┐
    │  API        │
    │  Gateway    │     (auth, rate limiting, routing)
    └──────┬──────┘
           │
    ┌──────▼──────┐     ┌──────────────┐
    │  Router     │────▶│  Model       │
    │  (A/B test, │     │  Registry    │
    │   version)  │     │  (which model│
    └──────┬──────┘     │   where)     │
           │            └──────────────┘
           │
    ┌──────▼──────┐
    │  Request    │     (group requests for same model)
    │  Batcher    │
    └──────┬──────┘
           │
    ┌──────▼──────────────────────────────┐
    │         GPU Inference Workers        │
    │                                     │
    │  ┌──────┐  ┌──────┐    ┌──────┐    │
    │  │GPU 0 │  │GPU 1 │ .. │GPU N │    │
    │  │Model │  │Model │    │Model │    │
    │  │  A   │  │  B   │    │  A   │    │
    │  └──────┘  └──────┘    └──────┘    │
    └─────────────────────────────────────┘
           │
    ┌──────▼──────┐
    │  Cache      │     (embedding cache, result cache)
    │  (Redis)    │
    └─────────────┘
```

---

## Step 3: Request Batching

GPUs are most efficient processing many inputs simultaneously. A single
request wastes GPU capacity. Batching groups requests together.

```
WITHOUT BATCHING:
  Request 1 → GPU processes 1 input → 15ms
  Request 2 → GPU processes 1 input → 15ms
  Request 3 → GPU processes 1 input → 15ms
  Total: 3 requests in 45ms
  GPU utilization: ~10%

WITH BATCHING:
  Collect requests for 5ms, then:
  [Req 1, Req 2, Req 3] → GPU processes batch of 3 → 18ms
  Total: 3 requests in 23ms (5ms wait + 18ms inference)
  GPU utilization: ~60%

  ┌──────────────────────────────────────────────┐
  │            Request Batcher                    │
  │                                              │
  │  Incoming requests:                          │
  │    t=0ms: req_1 arrives → start batch timer  │
  │    t=2ms: req_2 arrives → add to batch       │
  │    t=4ms: req_3 arrives → add to batch       │
  │    t=5ms: timer fires OR batch full           │
  │           → send batch [req_1,2,3] to GPU    │
  │                                              │
  │  Two triggers to flush:                      │
  │    1. Max wait time (5-10ms)                 │
  │    2. Max batch size (32 or 64)              │
  │    Whichever comes first.                    │
  └──────────────────────────────────────────────┘
```

```go
package inference

import (
	"context"
	"sync"
	"time"
)

type Request struct {
	Input    []float32
	ResultCh chan Result
}

type Result struct {
	Output []float32
	Err    error
}

type Batcher struct {
	maxBatchSize int
	maxWait      time.Duration
	processFn    func([][]float32) ([][]float32, error)
	mu           sync.Mutex
	batch        []Request
	timer        *time.Timer
}

func NewBatcher(maxBatch int, maxWait time.Duration, fn func([][]float32) ([][]float32, error)) *Batcher {
	return &Batcher{
		maxBatchSize: maxBatch,
		maxWait:      maxWait,
		processFn:    fn,
	}
}

func (b *Batcher) Submit(ctx context.Context, input []float32) ([]float32, error) {
	resultCh := make(chan Result, 1)
	req := Request{Input: input, ResultCh: resultCh}

	b.mu.Lock()
	b.batch = append(b.batch, req)

	if len(b.batch) >= b.maxBatchSize {
		batch := b.batch
		b.batch = nil
		if b.timer != nil {
			b.timer.Stop()
		}
		b.mu.Unlock()
		go b.processBatch(batch)
	} else if len(b.batch) == 1 {
		b.timer = time.AfterFunc(b.maxWait, func() {
			b.mu.Lock()
			batch := b.batch
			b.batch = nil
			b.mu.Unlock()
			if len(batch) > 0 {
				b.processBatch(batch)
			}
		})
		b.mu.Unlock()
	} else {
		b.mu.Unlock()
	}

	select {
	case result := <-resultCh:
		return result.Output, result.Err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (b *Batcher) processBatch(batch []Request) {
	inputs := make([][]float32, len(batch))
	for i, req := range batch {
		inputs[i] = req.Input
	}

	outputs, err := b.processFn(inputs)

	for i, req := range batch {
		if err != nil {
			req.ResultCh <- Result{Err: err}
		} else {
			req.ResultCh <- Result{Output: outputs[i]}
		}
	}
}
```

---

## Step 4: Model Serving and Versioning

```
MODEL REGISTRY:

  ┌──────────────────────────────────────────────┐
  │  model_name     │ version │ status  │ GPU    │
  ├─────────────────┼─────────┼─────────┼────────┤
  │ text-classifier │ v3      │ primary │ GPU 0-3│
  │ text-classifier │ v4      │ canary  │ GPU 4  │
  │ image-detect    │ v7      │ primary │ GPU 5-9│
  │ embeddings      │ v2      │ primary │ GPU 10+│
  └──────────────────────────────────────────────┘

DEPLOYMENT STRATEGIES:

  Blue-Green:
    v3 (blue) serving 100% traffic
    Deploy v4 (green) alongside
    Switch traffic: v3 → v4 instantly
    Rollback: switch back to v3

  Canary:
    v3 serving 95% traffic
    v4 serving 5% traffic
    Monitor metrics (latency, accuracy, errors)
    Gradually increase v4: 5% → 25% → 50% → 100%

  Shadow:
    v3 serving 100% (responses returned to users)
    v4 receives same requests (responses logged, not returned)
    Compare v3 vs v4 outputs offline
```

---

## Step 5: GPU Auto-Scaling

```
CHALLENGE: GPUs take 2-5 minutes to spin up (loading model weights).
           Can't scale as fast as CPU containers.

STRATEGY: Predictive + reactive scaling

  ┌──────────────────────────────────────────────┐
  │           GPU Autoscaler                      │
  │                                              │
  │  Metrics:                                    │
  │    - Request queue depth                     │
  │    - GPU utilization (target: 70%)           │
  │    - Inference latency (p99 < 100ms)         │
  │    - Time of day (predictable patterns)      │
  │                                              │
  │  Scaling rules:                              │
  │    Queue depth > 100 for 30s → scale up      │
  │    GPU util < 30% for 5min → scale down      │
  │    Weekday 9am → pre-scale for traffic       │
  │                                              │
  │  Warm pool:                                  │
  │    Keep 2-3 GPUs with models pre-loaded      │
  │    Ready to serve in < 30 seconds            │
  │    (vs 2-5 min cold start)                   │
  └──────────────────────────────────────────────┘
```

---

## Step 6: Embedding Cache

Embeddings (vector representations) are expensive to compute but
frequently reused. Cache aggressively.

```
EMBEDDING CACHE:

  Request: "Compute embedding for 'machine learning basics'"

  ┌──────────┐     ┌──────────┐     ┌──────────────┐
  │  Client  │────▶│  Cache   │────▶│  GPU Worker  │
  │          │     │ (Redis)  │     │  (compute)   │
  └──────────┘     └──────────┘     └──────────────┘

  Cache key: SHA256(model_id + input_text)
  Cache value: float32 vector (768-4096 dimensions)

  Memory per embedding:
    768 dims × 4 bytes = 3 KB
    10M cached embeddings = 30 GB (fits in Redis cluster)

  Cache hit rate for search queries: typically 60-80%
  (many users search similar things)
```

---

## Step 7: A/B Testing Models

```
A/B TEST FRAMEWORK:

  ┌──────────┐
  │  Router  │
  │          │
  │  user_id │──▶ hash(user_id) % 100
  │          │
  │  0-89:   │──▶ Model v3 (control)
  │  90-99:  │──▶ Model v4 (experiment)
  └──────────┘

  Track metrics per variant:
    - Prediction latency
    - Business metric (CTR, conversion, revenue)
    - Error rate
    - Model confidence distribution

  Statistically significant after N observations?
    → Promote v4 or roll back
```

---

## Back-of-Envelope: GPU Fleet Sizing

```
Requirements:
  10,000 req/sec real-time
  Average batch size: 32 (after batching)
  Inference time per batch: 20ms on A100

Throughput per GPU:
  1000ms / 20ms = 50 batches/sec
  50 batches × 32 requests = 1,600 req/sec per GPU

GPUs needed for real-time:
  10,000 / 1,600 = 7 GPUs (minimum)
  With 70% utilization target: 7 / 0.7 = 10 GPUs
  With redundancy (N+2): 12 GPUs

Cost:
  12 × A100 at $3/hour = $36/hour = $864/day
  vs naive (no batching, 1 req at a time):
    10,000 req/sec × 20ms = 200 GPUs needed
    200 × $3/hour = $14,400/day

  Batching saves $13,500/day.
```

---

## Trade-Off Summary

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| Batching | No batching | Dynamic batching | Always batch (massive cost savings) |
| Scaling | Reactive only | Predictive + reactive | Both (GPUs need warm-up time) |
| Deployment | Blue-green | Canary | Canary for models (gradual validation) |
| Caching | No cache | Embedding cache | Cache (60-80% hit rate typical) |
| Framework | Custom serving | TorchServe/Triton | Triton for production, custom for flexibility |
| GPU type | A100 | H100 | H100 for LLMs, A100 for smaller models |

---

## Exercises

1. Implement the request batcher from this lesson. Simulate 1000
   concurrent requests and measure latency with batch sizes of 1, 8,
   32, and 64. Graph the throughput vs latency trade-off.

2. Design the model deployment pipeline: build, test, register, deploy
   to canary, promote to primary. What metrics trigger automatic
   rollback?

3. Calculate: you serve a 7B parameter LLM. Each parameter is float16
   (2 bytes). How much GPU memory to load the model? How many A100
   (80GB) GPUs needed for the model weights alone? Add KV cache for
   batch size 32 with 2048 token context.

4. Design an embedding cache for a search system. 50M unique queries/day,
   40% are repeats. Embedding size: 1536 floats. How much Redis memory?
   What's the optimal TTL?

---

*Next: [Lesson 38 — Design a Recommendation Engine](./38-design-recommendation-engine.md),
where we build personalized recommendations that handle the cold start
problem.*
