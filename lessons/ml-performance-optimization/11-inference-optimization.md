# 11 - Inference Optimization

## The Analogy

You've built a sports car (your trained model). It handles beautifully on the
track (your dev machine). Now you need to put it on a highway with a million
other cars (production). Suddenly, raw speed isn't the only thing that
matters -- fuel efficiency, reliability, and how many lanes you can fill
become critical.

Inference optimization is the art of making your model serve as many requests
as possible, as cheaply as possible, without degrading quality. A model that's
10x faster at inference saves 10x on GPU costs -- and at production scale,
that's the difference between a viable product and a money pit.

```
  TRAINING vs INFERENCE PRIORITIES

  Training:                          Inference:
  - Time to convergence              - Latency per request
  - Accuracy maximization            - Throughput (requests/second)
  - GPU hours per experiment         - Cost per 1000 inferences
  - Not real-time                    - Often real-time SLA

  Optimization budget:               Optimization budget:
  - Weeks of development OK          - Must be maintainable
  - Can use multiple GPUs freely     - Cost per GPU-hour matters
  - Flexibility matters              - Predictability matters
```

## Model Pruning

Pruning removes unnecessary weights from a model. Most neural networks are
overparameterized -- many weights contribute little to the output.

### Unstructured Pruning

Set individual weights to zero. The model has the same architecture but a
sparse weight matrix.

```python
import torch.nn.utils.prune as prune

model = load_trained_model()

for name, module in model.named_modules():
    if isinstance(module, torch.nn.Linear):
        prune.l1_unstructured(module, name='weight', amount=0.5)

for name, module in model.named_modules():
    if isinstance(module, torch.nn.Linear):
        prune.remove(module, 'weight')
```

```
  UNSTRUCTURED PRUNING (50%)

  Before:
  [0.3  0.1  -0.5  0.8]
  [0.2  -0.7  0.4  0.1]
  [0.9  0.1  -0.3  0.6]
  [0.1  0.5  -0.2  0.7]

  After (smallest 50% of weights zeroed):
  [0.3  0.0   -0.5  0.8]
  [0.0  -0.7   0.4  0.0]
  [0.9  0.0   -0.3  0.6]
  [0.0  0.5    0.0  0.7]

  Problem: sparse matrices aren't faster on GPUs unless you
  use sparse compute libraries. GPUs are designed for dense math.
```

**The dirty truth about unstructured pruning**: it doesn't speed up inference
on GPUs unless you reach very high sparsity (>90%) and use hardware-specific
sparse kernels (NVIDIA's 2:4 sparsity on Ampere+).

### Structured Pruning

Remove entire neurons, channels, or attention heads. This produces a smaller
dense model that's actually faster on any hardware.

```python
import torch.nn.utils.prune as prune

for name, module in model.named_modules():
    if isinstance(module, torch.nn.Conv2d):
        prune.ln_structured(module, name='weight', amount=0.3, n=2, dim=0)

for name, module in model.named_modules():
    if isinstance(module, torch.nn.Conv2d):
        prune.remove(module, 'weight')
```

```
  STRUCTURED PRUNING (remove 30% of output channels)

  Before: Conv2d(64, 128, 3x3)  -> 128 output channels
  After:  Conv2d(64, 90, 3x3)   -> 90 output channels (38 removed)

  This is a genuinely smaller model. No sparse tricks needed.
  Every downstream layer that takes 128 inputs now takes 90.
```

### 2:4 Sparsity (NVIDIA Ampere+)

NVIDIA's hardware-accelerated sparsity pattern: in every group of 4 weights,
exactly 2 must be zero. The GPU has specialized hardware for this pattern.

```python
from torch.sparse import to_sparse_semi_structured

model = load_trained_model()

for name, module in model.named_modules():
    if isinstance(module, torch.nn.Linear):
        sparse_weight = to_sparse_semi_structured(module.weight)
        module.weight = torch.nn.Parameter(sparse_weight)
```

```
  2:4 SPARSITY PATTERN

  Dense:     [0.3  0.1  -0.5  0.8  |  0.2  -0.7  0.4  0.1]
  2:4 sparse: [0.3  0.0  -0.5  0.0  |  0.0  -0.7  0.4  0.0]
               ^^^^^^^^^^^^^^^^^^      ^^^^^^^^^^^^^^^^^^
               2 nonzero per 4         2 nonzero per 4

  Hardware stores only the 2 nonzero values + their indices.
  Tensor core can process this 2x faster than dense.
  Typical accuracy loss: <1% with fine-tuning.
```

## Quantization

Quantization reduces the precision of weights and/or activations from fp32
to int8, int4, or even lower. This reduces model size and speeds up
computation on hardware with integer math units.

### Post-Training Quantization (PTQ)

No retraining needed. Quantize the trained model directly:

```python
import torch.ao.quantization as quant

model_fp32 = load_trained_model().cpu().eval()

model_fp32.qconfig = quant.get_default_qconfig('x86')
model_prepared = quant.prepare(model_fp32)

with torch.inference_mode():
    for batch in calibration_dataloader:
        model_prepared(batch)

model_int8 = quant.convert(model_prepared)
```

### Dynamic Quantization

Weights are quantized ahead of time, activations are quantized dynamically
at runtime. Simplest to apply:

```python
model_dynamic = torch.ao.quantization.quantize_dynamic(
    model,
    {torch.nn.Linear},
    dtype=torch.qint8,
)
```

### GPTQ: LLM Quantization

For large language models, GPTQ (Generative Pre-trained Transformer
Quantization) uses a layer-wise optimal quantization algorithm:

```python
from auto_gptq import AutoGPTQForCausalLM, BaseQuantizeConfig

quantize_config = BaseQuantizeConfig(
    bits=4,
    group_size=128,
    desc_act=False,
)

model = AutoGPTQForCausalLM.from_pretrained(
    model_name,
    quantize_config,
)

model.quantize(calibration_dataset)
model.save_quantized(output_dir)

quantized_model = AutoGPTQForCausalLM.from_quantized(
    output_dir,
    device="cuda:0",
)
```

```
  QUANTIZATION COMPARISON

  Method          Bits   Size Reduction   Speed    Accuracy Loss   Effort
  -----------------------------------------------------------------------
  Dynamic quant   8      4x              1.5-2x   < 0.5%          Low
  Static PTQ      8      4x              2-3x     < 1%            Medium
  GPTQ            4      8x              2-4x     < 2%            Medium
  AWQ             4      8x              2-4x     < 1%            Medium
  QAT             4-8    varies          2-4x     < 0.5%          High
```

## Weight Sharing and Tying

Some model architectures share weights between layers. The classic example
is sharing the embedding and output projection in language models:

```python
class LanguageModel(nn.Module):
    def __init__(self, vocab_size, dim):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, dim)
        self.transformer = TransformerStack(dim)
        self.output_proj = nn.Linear(dim, vocab_size, bias=False)
        self.output_proj.weight = self.embedding.weight

    def forward(self, x):
        x = self.embedding(x)
        x = self.transformer(x)
        logits = self.output_proj(x)
        return logits
```

For a 50,000-token vocabulary with 4096-dimensional embeddings, this saves
50000 * 4096 * 4 = ~800MB in fp32. It also often improves generalization.

## Early Exit

Not all inputs need the full model. Simple inputs can be classified after
just a few layers. Early exit adds classifiers at intermediate layers:

```python
class EarlyExitModel(nn.Module):
    def __init__(self, base_model, num_classes, exit_layers, threshold=0.9):
        super().__init__()
        self.layers = base_model.layers
        self.threshold = threshold
        self.exit_heads = nn.ModuleDict({
            str(i): nn.Linear(base_model.dim, num_classes)
            for i in exit_layers
        })
        self.final_head = nn.Linear(base_model.dim, num_classes)

    def forward(self, x):
        for idx, layer in enumerate(self.layers):
            x = layer(x)
            if str(idx) in self.exit_heads:
                logits = self.exit_heads[str(idx)](x.mean(dim=1))
                confidence = torch.softmax(logits, dim=-1).max(dim=-1).values
                if confidence.min() > self.threshold:
                    return logits
        return self.final_head(x.mean(dim=1))
```

```
  EARLY EXIT

  Input --> [Layer 1] --> [Layer 2] --> [Exit Head] --> Confident? --> YES: return
                                             |
                                             NO
                                             v
                          [Layer 3] --> [Layer 4] --> [Exit Head] --> Confident? --> YES: return
                                                          |
                                                          NO
                                                          v
                                        [Layer 5] --> [Layer 6] --> [Final Head] --> return

  Easy inputs exit after layer 2 (faster)
  Hard inputs go through all layers (slower but more accurate)
  Average latency drops significantly if most inputs are easy.
```

## Caching Intermediate Results

### KV-Cache for Autoregressive Models

The most important inference optimization for language models. During
autoregressive generation, each new token needs attention over all previous
tokens. Without caching, you recompute attention for all previous tokens at
each step.

```
  WITHOUT KV-CACHE (generating 4 tokens):

  Step 1: Process [A]           -> compute K,V for A        -> predict B
  Step 2: Process [A, B]        -> recompute K,V for A,B    -> predict C
  Step 3: Process [A, B, C]     -> recompute K,V for A,B,C  -> predict D
  Step 4: Process [A, B, C, D]  -> recompute K,V for all    -> predict E

  Total attention compute: 1 + 2 + 3 + 4 = O(N^2)


  WITH KV-CACHE:

  Step 1: Process [A]    -> store K_A, V_A in cache    -> predict B
  Step 2: Process [B]    -> store K_B, V_B, attend to cached A -> predict C
  Step 3: Process [C]    -> store K_C, V_C, attend to cached A,B -> predict D
  Step 4: Process [D]    -> store K_D, V_D, attend to cached A,B,C -> predict E

  Total attention compute: 1 + 1 + 1 + 1 = O(N)
  (But cache memory grows as O(N * layers * heads * head_dim))
```

```python
class CachedAttention(nn.Module):
    def forward(self, x, kv_cache=None):
        q = self.q_proj(x)
        k = self.k_proj(x)
        v = self.v_proj(x)

        if kv_cache is not None:
            past_k, past_v = kv_cache
            k = torch.cat([past_k, k], dim=-2)
            v = torch.cat([past_v, v], dim=-2)

        new_cache = (k, v)
        output = scaled_dot_product_attention(q, k, v, is_causal=True)
        return output, new_cache
```

### Embedding Cache for Retrieval Systems

If you're running the same model on many similar inputs (e.g., a retrieval
system where documents are fixed but queries change), cache the document
embeddings:

```python
import hashlib

class EmbeddingCache:
    def __init__(self, model, max_size=100000):
        self.model = model
        self.cache = {}
        self.max_size = max_size

    def encode(self, texts):
        uncached = []
        uncached_indices = []
        results = [None] * len(texts)

        for idx, text in enumerate(texts):
            key = hashlib.md5(text.encode()).hexdigest()
            if key in self.cache:
                results[idx] = self.cache[key]
            else:
                uncached.append(text)
                uncached_indices.append(idx)

        if uncached:
            with torch.inference_mode():
                new_embeddings = self.model.encode(uncached)
            for idx, text, embedding in zip(uncached_indices, uncached, new_embeddings):
                key = hashlib.md5(text.encode()).hexdigest()
                self.cache[key] = embedding
                results[idx] = embedding

        return torch.stack(results)
```

## Async Inference

Overlap preprocessing, GPU computation, and postprocessing:

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class AsyncInferenceServer:
    def __init__(self, model, preprocess_fn, postprocess_fn):
        self.model = model
        self.preprocess_fn = preprocess_fn
        self.postprocess_fn = postprocess_fn
        self.thread_pool = ThreadPoolExecutor(max_workers=4)
        self.cuda_stream = torch.cuda.Stream()

    async def predict(self, raw_input):
        loop = asyncio.get_event_loop()
        processed = await loop.run_in_executor(
            self.thread_pool, self.preprocess_fn, raw_input
        )

        with torch.cuda.stream(self.cuda_stream):
            input_tensor = processed.cuda(non_blocking=True)
            with torch.inference_mode():
                output = self.model(input_tensor)
            output = output.cpu()

        torch.cuda.current_stream().wait_stream(self.cuda_stream)

        result = await loop.run_in_executor(
            self.thread_pool, self.postprocess_fn, output
        )
        return result
```

```
  ASYNC INFERENCE PIPELINE

  Request 1: [preprocess] [GPU forward] [postprocess]
  Request 2:              [preprocess] [GPU forward] [postprocess]
  Request 3:                           [preprocess] [GPU forward] [postprocess]

  CPU threads handle pre/post processing.
  GPU handles model forward.
  CUDA streams allow overlap.
  Result: higher throughput than sequential processing.
```

## Request Batching for Serving

Combine dynamic batching (lesson 10) with inference optimization:

```python
from concurrent.futures import Future
import threading
import queue
import time

class InferenceServer:
    def __init__(self, model, max_batch=64, max_wait_s=0.01):
        self.model = model
        self.max_batch = max_batch
        self.max_wait_s = max_wait_s
        self.request_queue = queue.Queue()
        self.worker = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker.start()

    def predict(self, input_tensor):
        future = Future()
        self.request_queue.put((input_tensor, future))
        return future.result(timeout=30)

    def _worker_loop(self):
        while True:
            batch = []
            deadline = time.monotonic() + self.max_wait_s

            while len(batch) < self.max_batch and time.monotonic() < deadline:
                try:
                    timeout = max(0, deadline - time.monotonic())
                    item = self.request_queue.get(timeout=timeout)
                    batch.append(item)
                except queue.Empty:
                    break

            if not batch:
                continue

            inputs = torch.stack([item[0] for item in batch]).cuda()
            with torch.inference_mode():
                outputs = self.model(inputs)

            for idx, (_, future) in enumerate(batch):
                future.set_result(outputs[idx].cpu())
```

## End-to-End Optimization Checklist

```
  INFERENCE OPTIMIZATION PRIORITY ORDER

  1. [ ] Use inference_mode() and model.eval()              (free)
  2. [ ] Enable KV-cache for autoregressive models          (free)
  3. [ ] Use torch.compile(mode="max-autotune")             (easy)
  4. [ ] Switch to FP16/BF16                                (easy)
  5. [ ] Enable Flash Attention                             (easy)
  6. [ ] Implement request batching                         (medium)
  7. [ ] Apply INT8 quantization (PTQ)                      (medium)
  8. [ ] Convert to TensorRT                                (medium)
  9. [ ] Apply structured pruning + fine-tuning             (hard)
  10.[ ] Apply INT4 quantization (GPTQ/AWQ)                 (hard)
  11.[ ] Write custom fused kernels for hot paths           (hard)
  12.[ ] Implement early exit (if applicable)               (hard)
```

## Exercises

1. Apply dynamic INT8 quantization to a BERT model. Measure latency and
   accuracy on a benchmark dataset. How much speed do you gain? How much
   accuracy do you lose?

2. Implement KV-caching for a small GPT model. Compare generation speed
   (tokens/second) with and without caching.

3. Build a simple inference server with request batching. Benchmark
   throughput at various request rates. What's the optimal max_wait time?

4. Apply 2:4 structured sparsity to a model's linear layers (on Ampere+
   hardware). Fine-tune for 1 epoch. What's the speed improvement?
