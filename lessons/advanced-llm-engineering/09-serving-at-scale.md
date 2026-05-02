# Lesson 09: Serving at Scale — From Model to API

Training a model is the easy part. Serving it to thousands of
concurrent users with low latency and high reliability — that is
where engineering gets real.

Think of it like running a restaurant. Having a great recipe (model) is
step one. But you also need a kitchen that can handle 500 orders per
hour (throughput), serve each dish in under 5 minutes (latency), not
crash when the dinner rush hits (reliability), and do all of this
without burning through your budget (cost efficiency).

---

## The Serving Stack

```
User Request
      │
      ▼
┌──────────────┐
│  Load Balancer│  Route to least-loaded instance
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  API Gateway  │  Auth, rate limiting, request validation
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Inference    │  vLLM / TGI / TensorRT-LLM
│  Server       │  Tokenize → Generate → Detokenize
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  GPU Cluster  │  Model weights + KV cache
└──────────────┘
```

---

## The Big Three Inference Engines

### vLLM

The most popular open-source LLM serving engine. Built around
PagedAttention (Lesson 06).

```
vLLM key features:
  ✓ PagedAttention (near-zero KV cache waste)
  ✓ Continuous batching
  ✓ Speculative decoding
  ✓ Tensor parallelism
  ✓ AWQ/GPTQ/FP8 quantization
  ✓ Prefix caching
  ✓ OpenAI-compatible API

Best for:
  - General-purpose LLM serving
  - High-throughput scenarios
  - Teams that want a simple, well-documented solution
```

```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Llama-3-70B-Instruct",
    tensor_parallel_size=4,
    gpu_memory_utilization=0.90,
    max_model_len=8192,
    enable_prefix_caching=True,
    quantization="awq",
)

params = SamplingParams(
    temperature=0.7,
    top_p=0.9,
    max_tokens=1024,
    stop=["<|eot_id|>"],
)

outputs = llm.generate(prompts, params)
```

To run as a server:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3-70B-Instruct \
  --tensor-parallel-size 4 \
  --gpu-memory-utilization 0.90 \
  --max-model-len 8192 \
  --enable-prefix-caching \
  --port 8000
```

### Text Generation Inference (TGI)

Hugging Face's inference server. Strong integration with the HF
ecosystem.

```
TGI key features:
  ✓ Flash Attention 2
  ✓ Continuous batching
  ✓ Tensor parallelism
  ✓ Quantization (AWQ, GPTQ, EETQ, bitsandbytes)
  ✓ Guidance/grammar-based generation
  ✓ Watermarking
  ✓ OpenAI-compatible API

Best for:
  - Hugging Face model hub integration
  - Docker-based deployments
  - When you need grammar-constrained generation
```

```bash
docker run --gpus all --shm-size 1g -p 8080:80 \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id meta-llama/Llama-3-70B-Instruct \
  --num-shard 4 \
  --max-input-tokens 4096 \
  --max-total-tokens 8192 \
  --quantize awq
```

### TensorRT-LLM

NVIDIA's inference engine. Maximum performance on NVIDIA GPUs through
aggressive kernel optimization.

```
TensorRT-LLM key features:
  ✓ Custom CUDA kernels (fastest raw performance)
  ✓ FP8 quantization (Hopper GPUs)
  ✓ In-flight batching
  ✓ Paged KV cache
  ✓ Multi-GPU, multi-node
  ✓ Medusa, EAGLE speculative decoding

Best for:
  - Maximum throughput on NVIDIA hardware
  - Production deployments with strict latency SLOs
  - When you need every last token/second

Downsides:
  - Complex build process
  - Less flexible than vLLM/TGI
  - NVIDIA-only
```

```python
# TensorRT-LLM requires building the engine first
import tensorrt_llm
from tensorrt_llm.runtime import ModelRunner

runner = ModelRunner.from_dir(
    engine_dir="./llama-70b-tp4-engine",
    rank=tensorrt_llm.mpi_rank(),
)

outputs = runner.generate(
    batch_input_ids=input_ids,
    max_new_tokens=1024,
    temperature=0.7,
    top_p=0.9,
)
```

---

## Batching Strategies

Batching is the single most important optimization for throughput.
Without batching, each request runs through the model alone. With
batching, multiple requests share the same model forward pass.

### Static Batching

Wait for N requests, process them together, return all results.

```
Time ──────────────────────────────────────►

Queue: [R1, R2, R3, R4] → Process batch → [O1, O2, O3, O4]
Queue: [R5, R6, R7, R8] → Process batch → [O5, O6, O7, O8]

Problem: If R2 finishes early, R1, R3, R4 must wait.
Problem: If queue has only 2 requests, you wait for 2 more.
```

### Continuous Batching (iteration-level)

Add/remove requests every decode step.

```
Step 1: Active batch [R1, R2, R3, R4]
Step 2: R2 finishes → Active batch [R1, R5, R3, R4]  (R5 joins)
Step 3: Active batch [R1, R5, R3, R4]
Step 4: R4 finishes → Active batch [R1, R5, R3, R6]  (R6 joins)

No waiting! GPU is always busy with a full batch.
```

### Prefill-Decode Disaggregation

The prefill phase (processing the prompt) is compute-heavy.
The decode phase (generating tokens) is memory-heavy.
Mixing them in the same batch creates inefficiency.

```
Disaggregated serving:

Prefill GPUs (compute-optimized):
  → Process prompts in large batches
  → Output: KV cache entries

Decode GPUs (memory-optimized):
  → Generate tokens using cached KV
  → Smaller batches, memory-bound

KV cache transfer: Prefill GPU → Decode GPU via NVLink/network

Why: Each GPU type runs at peak efficiency for its phase.
```

This is an emerging pattern used by services like Fireworks AI and
Anyscale for maximum throughput.

---

## Request Scheduling

When requests vary in length, scheduling determines throughput and
fairness.

### First-Come First-Served (FCFS)

Process requests in arrival order. Simple but can lead to head-of-line
blocking (one long request delays everything behind it).

### Shortest Job First (SJF)

Prioritize requests with shorter expected output. Reduces average
latency but requires output length prediction.

```python
class LengthPredictingScheduler:
    def __init__(self, max_batch_size):
        self.queue = []
        self.max_batch_size = max_batch_size

    def add_request(self, request):
        estimated_tokens = self.estimate_output_length(request)
        self.queue.append((estimated_tokens, request))
        self.queue.sort(key=lambda x: x[0])

    def get_batch(self):
        batch = []
        remaining_capacity = self.max_batch_size

        for est_len, request in self.queue[:remaining_capacity]:
            batch.append(request)

        self.queue = self.queue[len(batch):]
        return batch

    def estimate_output_length(self, request):
        prompt_len = len(request.input_ids)
        if request.max_tokens:
            return min(request.max_tokens, prompt_len * 2)
        return prompt_len * 2  # rough heuristic
```

### Priority-Based Scheduling

Different users or request types get different priorities.

```
Priority levels:
  P0 (highest): Paid tier, real-time chat
  P1:           Paid tier, batch processing
  P2:           Free tier, real-time chat
  P3 (lowest):  Free tier, batch processing

Under load: P3 requests get queued or rejected first
```

---

## SLO Management

Service Level Objectives define your quality targets.

```
Common LLM serving SLOs:

Metric                       Target              How to Measure
────────────────────────────────────────────────────────────────
Time to First Token (TTFT)   < 500ms p95          Prefill latency
Inter-Token Latency (ITL)    < 50ms p95           Decode latency
End-to-End Latency           < 10s p95            Full request time
Throughput                   > 1000 tokens/s/GPU  Tokens generated per second
Availability                 > 99.9%              Uptime
Error Rate                   < 0.1%               Failed requests
```

### Monitoring Setup

```python
import time
from prometheus_client import Histogram, Counter, Gauge

TTFT_HISTOGRAM = Histogram(
    "llm_time_to_first_token_seconds",
    "Time to first token",
    buckets=[0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0],
)

ITL_HISTOGRAM = Histogram(
    "llm_inter_token_latency_seconds",
    "Time between tokens",
    buckets=[0.01, 0.02, 0.05, 0.1, 0.2, 0.5],
)

ACTIVE_REQUESTS = Gauge(
    "llm_active_requests",
    "Number of currently processing requests",
)

TOKENS_GENERATED = Counter(
    "llm_tokens_generated_total",
    "Total tokens generated",
)

REQUEST_ERRORS = Counter(
    "llm_request_errors_total",
    "Total failed requests",
    ["error_type"],
)
```

### Load Shedding

When the system is overloaded, reject new requests gracefully rather
than letting everything degrade.

```python
class LoadShedder:
    def __init__(self, max_queue_size=100, max_wait_time=30.0):
        self.max_queue_size = max_queue_size
        self.max_wait_time = max_wait_time
        self.current_queue_size = 0

    def should_accept(self, request):
        if self.current_queue_size >= self.max_queue_size:
            return False, "Queue full — try again later"

        estimated_wait = self.estimate_wait_time()
        if estimated_wait > self.max_wait_time:
            return False, f"Estimated wait {estimated_wait:.0f}s exceeds limit"

        return True, None

    def estimate_wait_time(self):
        avg_processing_time = 5.0  # seconds per request
        return self.current_queue_size * avg_processing_time
```

---

## Autoscaling for LLMs

LLM autoscaling is harder than standard web service autoscaling because:

1. **GPU initialization is slow.** Loading a 70B model takes minutes.
2. **GPUs are expensive.** Over-provisioning costs thousands per hour.
3. **Traffic is bursty.** Chat traffic has daily patterns with 10x peaks.

```
Autoscaling strategy:

                Peak
Capacity  ┌─────┐
   │      │     │
   │   ┌──┘     └──┐        Reactive scaling
   │───┘            └───     (follows demand)
   │
   │──────────────────────   Baseline (always on)
   │
   └─────────────────────── Time
     6am    noon    6pm

Approach:
  1. Baseline capacity: handle average load (always running)
  2. Pre-scale: add GPUs before known traffic spikes
  3. Reactive scale: add GPUs when queue depth exceeds threshold
  4. Scale-down delay: keep GPUs for 10-15 min after load drops
     (avoids thrashing on bursty traffic)
```

```python
class LLMAutoscaler:
    def __init__(self, min_replicas, max_replicas, target_queue_depth=10):
        self.min_replicas = min_replicas
        self.max_replicas = max_replicas
        self.target_queue_depth = target_queue_depth
        self.current_replicas = min_replicas
        self.cooldown_seconds = 600  # 10 min cooldown
        self.last_scale_time = 0

    def evaluate(self, current_queue_depth, current_time):
        if current_time - self.last_scale_time < self.cooldown_seconds:
            return self.current_replicas

        desired = max(
            self.min_replicas,
            min(
                self.max_replicas,
                int(current_queue_depth / self.target_queue_depth) + 1,
            ),
        )

        if desired != self.current_replicas:
            self.current_replicas = desired
            self.last_scale_time = current_time

        return self.current_replicas
```

---

## Multi-Model Serving

Running multiple models on the same GPU infrastructure. Common for
serving different model sizes, A/B testing, or routing by task.

```
Router-based multi-model serving:

Request → [Router] → Model A (70B, complex tasks)
                   → Model B (8B, simple tasks)
                   → Model C (code-specific)

Routing criteria:
  - Task complexity (long prompts → larger model)
  - Domain detection (code → code model)
  - Cost optimization (simple queries → small model)
  - A/B testing (random split for experiments)
```

```python
class ModelRouter:
    def __init__(self, models):
        self.models = models  # {"small": vllm_8b, "large": vllm_70b, "code": vllm_code}

    def route(self, request):
        if self.is_code_request(request):
            return self.models["code"]

        complexity = self.estimate_complexity(request)
        if complexity > 0.7:
            return self.models["large"]
        return self.models["small"]

    def estimate_complexity(self, request):
        prompt_len = len(request.prompt.split())
        has_system_prompt = "system" in request.messages[0].get("role", "")
        is_multi_turn = len(request.messages) > 3

        score = 0.0
        if prompt_len > 500:
            score += 0.3
        if has_system_prompt:
            score += 0.2
        if is_multi_turn:
            score += 0.2
        return min(score, 1.0)

    def is_code_request(self, request):
        code_indicators = ["```", "def ", "function ", "class ", "import "]
        text = request.prompt.lower()
        return any(indicator in text for indicator in code_indicators)
```

---

## Production Deployment Checklist

```
Pre-deployment:
  □ Benchmark throughput and latency at expected load
  □ Set up monitoring (TTFT, ITL, throughput, error rate, GPU utilization)
  □ Configure load shedding and graceful degradation
  □ Test failure scenarios (GPU failure, OOM, model loading timeout)
  □ Set up request logging (for debugging and evaluation)

Infrastructure:
  □ Health checks (readiness + liveness probes)
  □ Graceful shutdown (finish in-flight requests)
  □ Rolling deployments (no downtime for model updates)
  □ GPU topology awareness (NVLink groups for tensor parallelism)

Security:
  □ Input validation (reject oversized prompts)
  □ Output filtering (safety classifiers)
  □ Rate limiting per user/API key
  □ Request/response logging (PII-aware)

Cost optimization:
  □ Spot/preemptible instances for batch workloads
  □ Reserved instances for baseline capacity
  □ Quantized models where quality permits
  □ Request routing to smallest capable model
```

---

## Key Takeaways

1. **vLLM is the default choice** for most teams. It is well-documented,
   actively maintained, and has the best balance of performance and
   usability.

2. **Continuous batching is non-negotiable.** Static batching wastes
   30-50% of GPU capacity on average.

3. **TTFT and ITL are the metrics that matter.** Users care about how
   fast the first token appears and how smooth the stream is. Total
   throughput is an infrastructure concern.

4. **Autoscaling LLMs is hard.** Model loading takes minutes. Plan for
   pre-scaling based on traffic patterns, not just reactive scaling.

5. **Multi-model routing saves money.** Route simple queries to small
   models. Only use the big model when needed.

6. **Load shedding preserves quality under load.** Better to reject
   10% of requests cleanly than to slow down everyone.

---

## Exercises

1. **Deploy vLLM.** Set up vLLM with Llama 3 8B. Benchmark with
   different batch sizes (1, 8, 32, 128). Measure TTFT, ITL, and
   throughput at each level.

2. **Load test.** Use a tool like Locust or vegeta to simulate 100
   concurrent users hitting your vLLM endpoint. Identify the
   throughput limit and observe behavior under overload.

3. **Multi-model router.** Deploy a small (8B) and large (70B) model.
   Build a router that sends simple queries to the small model and
   complex queries to the large. Measure cost savings vs quality impact.
