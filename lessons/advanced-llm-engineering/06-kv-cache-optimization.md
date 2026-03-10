# Lesson 06: KV Cache Optimization — Taming the Memory Monster

During text generation, the KV cache is like a court stenographer
recording everything that has been said. Every time a new word is
spoken, the stenographer does not re-listen to the entire trial — they
just add the new statement to their notes and the judge (attention)
can reference any part of the record.

The problem: the stenographer's notebook has limited pages. At long
context lengths with many concurrent conversations, the KV cache
consumes more GPU memory than the model weights themselves.

---

## How the KV Cache Works

During autoregressive generation, each new token attends to all
previous tokens. Without a cache, you would recompute Q, K, V for
every previous token at every step. The KV cache stores the K and V
projections so you only compute them once.

```
Step 1: Generate token 1
  Compute K1, V1 → store in cache
  Compute Q1, attend to K1, V1

Step 2: Generate token 2
  Compute K2, V2 → store in cache
  Compute Q2, attend to [K1,K2], [V1,V2]
  (K1,V1 loaded from cache, not recomputed)

Step 3: Generate token 3
  Compute K3, V3 → store in cache
  Compute Q3, attend to [K1,K2,K3], [V1,V2,V3]

...

Step N: Generate token N
  Compute KN, VN → store in cache
  Compute QN, attend to [K1,...,KN], [V1,...,VN]

Without cache: O(N²) compute total (recompute all K,V every step)
With cache:    O(N) compute total  (only new K,V each step)
```

---

## Memory Requirements

The KV cache size depends on the model architecture:

```
KV Cache per token per layer:
  = 2 × num_kv_heads × head_dim × bytes_per_param

KV Cache total:
  = above × num_layers × seq_len × batch_size

Example: Llama 2 7B
  num_kv_heads = 32  (MHA, no GQA)
  head_dim = 128
  num_layers = 32
  bytes = 2 (bf16)

  Per token: 2 × 32 × 128 × 2 = 16,384 bytes = 16 KB
  Per layer per token: 16 KB
  All layers, one token: 16 KB × 32 = 512 KB
  4K sequence: 512 KB × 4096 = 2 GB
  32K sequence: 512 KB × 32768 = 16 GB  ← larger than model weights!

Example: Llama 2 7B with GQA (hypothetical, 8 KV heads)
  Per token: 2 × 8 × 128 × 2 = 4,096 bytes = 4 KB
  All layers, one token: 4 KB × 32 = 128 KB
  4K sequence: 128 KB × 4096 = 512 MB  ← 4x smaller
```

```
Memory breakdown during inference (Llama 2 7B, 4K context):

┌────────────────────────────────────┐
│           GPU Memory               │
│                                    │
│  ┌────────────────────┐            │
│  │ Model Weights      │  14 GB     │
│  │ (bf16)             │            │
│  ├────────────────────┤            │
│  │ KV Cache           │  2 GB      │
│  │ (single request)   │            │
│  ├────────────────────┤            │
│  │ Activations +      │  ~1 GB     │
│  │ Overhead           │            │
│  └────────────────────┘            │
│                                    │
│  Total: ~17 GB                     │
│  Available (A100 80GB): 63 GB free │
│  Max batch size: ~31 concurrent    │
│  requests at 4K context            │
└────────────────────────────────────┘
```

With batch_size=32 at 4K context, the KV cache alone is 64 GB.
At 32K context, a single request needs 16 GB just for the cache.
This is why KV cache optimization is critical for serving.

---

## PagedAttention (vLLM)

The breakthrough idea from vLLM. Traditional KV cache pre-allocates
a contiguous block of memory for the maximum sequence length. This
wastes enormous amounts of memory because most sequences are shorter
than the maximum.

```
Traditional KV Cache (max_seq=4096):

Request A (actual: 500 tokens):
[████████░░░░░░░░░░░░░░░░░░░░░░░░]  used: 12%, wasted: 88%

Request B (actual: 2000 tokens):
[██████████████████████░░░░░░░░░░░]  used: 49%, wasted: 51%

Request C (actual: 100 tokens):
[██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  used: 2%, wasted: 98%

Average utilization: ~21%. Almost 80% of memory is wasted!
```

PagedAttention borrows virtual memory from operating systems. Instead
of contiguous allocation, the KV cache is split into fixed-size pages
(blocks) that can be anywhere in GPU memory.

```
PagedAttention KV Cache:

Physical GPU Memory (blocks):
[Block0][Block1][Block2][Block3][Block4][Block5][Block6][Block7]...

Request A page table: [Block0 → Block3 → Block7]
Request B page table: [Block1 → Block2 → Block5 → Block4 → Block6]
Request C page table: [Block8]

No wasted space! Each request only uses the blocks it needs.
New blocks are allocated as the sequence grows.
```

```python
# Conceptual PagedAttention implementation (simplified)

class PagedKVCache:
    def __init__(self, num_blocks, block_size, num_heads, head_dim, dtype):
        self.block_size = block_size  # tokens per block (e.g., 16)

        # pre-allocate a pool of blocks
        self.k_blocks = torch.zeros(
            num_blocks, block_size, num_heads, head_dim, dtype=dtype, device="cuda"
        )
        self.v_blocks = torch.zeros(
            num_blocks, block_size, num_heads, head_dim, dtype=dtype, device="cuda"
        )

        self.free_blocks = list(range(num_blocks))
        self.page_tables = {}  # request_id → list of block indices

    def allocate_block(self, request_id):
        if not self.free_blocks:
            raise RuntimeError("Out of KV cache blocks")
        block_idx = self.free_blocks.pop(0)
        if request_id not in self.page_tables:
            self.page_tables[request_id] = []
        self.page_tables[request_id].append(block_idx)
        return block_idx

    def append_kv(self, request_id, new_k, new_v, position):
        block_offset = position % self.block_size

        if block_offset == 0:
            self.allocate_block(request_id)

        block_idx = self.page_tables[request_id][-1]
        self.k_blocks[block_idx, block_offset] = new_k
        self.v_blocks[block_idx, block_offset] = new_v

    def free_request(self, request_id):
        blocks = self.page_tables.pop(request_id, [])
        self.free_blocks.extend(blocks)
```

### PagedAttention Memory Savings

```
Scenario: 100 concurrent requests, max_seq=4096, Llama 7B

Traditional allocation:
  100 × 4096 × 512 KB/token = 200 GB  ← does not fit on any single GPU

PagedAttention (avg actual length = 500 tokens):
  100 × 500 × 512 KB/token = 25 GB    ← fits on one A100-80GB

Memory waste:
  Traditional: ~88% (most slots empty)
  PagedAttention: ~3% (only last block of each request partially empty)
```

---

## Continuous Batching

Traditional batching waits for all requests in a batch to finish before
starting new ones. Continuous batching adds new requests as soon as any
request completes.

```
Traditional (Static) Batching:

Time ──────────────────────────────►

Batch 1: [Req A ████████████]
          [Req B ████████          ]  ← B finishes early, GPU idle
          [Req C ████████████]

          ────── gap ──────

Batch 2: [Req D ████████]
          [Req E ████████████████]
          [Req F ██████████]


Continuous Batching:

Time ──────────────────────────────►

Running:  [Req A ████████████]
          [Req B ████████][Req D ████████][Req F ██████████]
          [Req C ████████████][Req E ████████████████]

No gaps! As B finishes, D starts immediately.
GPU utilization stays high.
```

Continuous batching requires PagedAttention (or similar dynamic memory
management) because requests have different lengths and lifetimes.

### Prefill vs Decode Phases

Each request has two phases:

```
Prefill: Process the entire prompt at once (matrix multiply, fast)
  - Input: 500 tokens of prompt
  - Output: KV cache entries for all 500 tokens
  - Compute: GPU-bound (large batch matmul)
  - Time: ~50ms for 500 tokens

Decode: Generate tokens one at a time (memory-bound, slow per token)
  - Input: 1 new token
  - Output: 1 new token + KV cache update
  - Compute: Memory-bound (small matmul, large KV cache read)
  - Time: ~15ms per token

The challenge: prefill and decode have very different compute
characteristics. Mixing them in the same batch is tricky.
```

Some systems separate prefill and decode into different batches or
even different GPUs (disaggregated serving). This lets each phase
run with optimal batch sizes.

---

## Cache Eviction Strategies

When the KV cache is full, you have to decide what to evict. Not all
cached tokens are equally important.

### Sliding Window Eviction

Simplest approach: keep only the last W tokens in the cache.

```
Window size = 1024

Cache: [token 0] [token 1] ... [token 1023]
New token arrives → evict token 0
Cache: [token 1] [token 2] ... [token 1024]
```

Problem: loses all information beyond the window.

### H2O (Heavy-Hitter Oracle)

Keep tokens that receive the most attention. Some tokens (like
punctuation, key entities, instructions) consistently get high
attention scores — these are "heavy hitters."

```
Attention scores at step N:

Token 0 ("You"):       avg attention = 0.02  → evict candidate
Token 1 ("are"):       avg attention = 0.01  → evict candidate
Token 2 ("a"):         avg attention = 0.01  → evict candidate
Token 3 ("helpful"):   avg attention = 0.15  → keep! (heavy hitter)
Token 4 ("assistant"): avg attention = 0.12  → keep!
Token 5 ("."):         avg attention = 0.08  → keep (moderate)
...

Strategy: Keep top-k tokens by cumulative attention score + recent window
```

```python
class H2OCache:
    def __init__(self, max_cache_size, recent_window=256):
        self.max_cache_size = max_cache_size
        self.recent_window = recent_window
        self.attention_accumulator = None

    def update(self, attention_scores, new_k, new_v):
        # attention_scores: (num_heads, 1, seq_len) — from latest token
        if self.attention_accumulator is None:
            self.attention_accumulator = attention_scores.sum(dim=0).squeeze()
        else:
            self.attention_accumulator += attention_scores.sum(dim=0).squeeze()

        current_len = self.k_cache.shape[1]
        if current_len > self.max_cache_size:
            heavy_hitter_budget = self.max_cache_size - self.recent_window
            old_scores = self.attention_accumulator[:-self.recent_window]
            _, keep_indices = old_scores.topk(heavy_hitter_budget)

            recent_indices = torch.arange(
                current_len - self.recent_window, current_len
            )
            keep = torch.cat([keep_indices, recent_indices])

            self.k_cache = self.k_cache[:, keep]
            self.v_cache = self.v_cache[:, keep]
            self.attention_accumulator = self.attention_accumulator[keep]
```

### StreamingLLM

Observation: the very first few tokens (the "attention sink") always
receive high attention regardless of content. StreamingLLM keeps:
1. The first 4 tokens (attention sink)
2. The last W tokens (recent window)
3. Evict everything in between

```
StreamingLLM cache layout:

[sink tokens (4)] + [gap - evicted] + [recent window (W)]

This allows infinite-length generation with fixed memory!
```

---

## Quantized KV Cache

Instead of storing KV values in bf16 (2 bytes), quantize them to int8
or int4. This cuts cache memory by 2-4x with minimal quality loss.

```python
import torch

class QuantizedKVCache:
    def __init__(self, num_layers, max_seq_len, num_kv_heads, head_dim):
        self.k_cache = torch.zeros(
            num_layers, max_seq_len, num_kv_heads, head_dim,
            dtype=torch.int8, device="cuda"
        )
        self.v_cache = torch.zeros(
            num_layers, max_seq_len, num_kv_heads, head_dim,
            dtype=torch.int8, device="cuda"
        )
        self.k_scales = torch.zeros(
            num_layers, max_seq_len, num_kv_heads, 1,
            dtype=torch.float16, device="cuda"
        )
        self.v_scales = torch.zeros(
            num_layers, max_seq_len, num_kv_heads, 1,
            dtype=torch.float16, device="cuda"
        )

    def store(self, layer_idx, position, k, v):
        # per-head, per-token quantization
        k_scale = k.abs().max(dim=-1, keepdim=True).values / 127.0
        v_scale = v.abs().max(dim=-1, keepdim=True).values / 127.0

        self.k_cache[layer_idx, position] = (k / k_scale.clamp(min=1e-8)).round().to(torch.int8)
        self.v_cache[layer_idx, position] = (v / v_scale.clamp(min=1e-8)).round().to(torch.int8)
        self.k_scales[layer_idx, position] = k_scale.half()
        self.v_scales[layer_idx, position] = v_scale.half()

    def load(self, layer_idx, start, end):
        k = self.k_cache[layer_idx, start:end].float() * self.k_scales[layer_idx, start:end].float()
        v = self.v_cache[layer_idx, start:end].float() * self.v_scales[layer_idx, start:end].float()
        return k, v
```

```
Memory savings:

              bf16 cache    int8 cache    int4 cache
Llama 7B,     2 GB          1 GB          0.5 GB
4K context

Llama 70B,    20 GB         10 GB         5 GB
4K context

Quality impact (perplexity increase):
  int8: +0.01-0.05 (negligible)
  int4: +0.1-0.5 (noticeable but usually acceptable)
```

---

## Prefix Caching

When many requests share the same prompt prefix (system prompt, few-shot
examples), cache the KV for the shared prefix and reuse it.

```
Request 1: "You are a helpful assistant. User: What is Python?"
Request 2: "You are a helpful assistant. User: Explain gravity."
Request 3: "You are a helpful assistant. User: Write a poem."

Shared prefix: "You are a helpful assistant. User: "
  → Compute KV once, reuse for all 3 requests

Without prefix caching: 3 × (prefix_compute + unique_compute)
With prefix caching:    1 × prefix_compute + 3 × unique_compute

Savings: proportional to shared prefix length
```

vLLM implements automatic prefix caching using a radix tree to find
shared prefixes across requests.

---

## Putting It Together: Production KV Cache Stack

```
Production KV Cache Strategy:

┌─────────────────────────────────────────┐
│ Level 1: Architecture                    │
│   GQA (8 KV heads instead of 64)        │
│   → 8x base reduction                   │
├─────────────────────────────────────────┤
│ Level 2: Memory Management              │
│   PagedAttention (vLLM)                 │
│   → Near-zero waste                     │
├─────────────────────────────────────────┤
│ Level 3: Quantization                   │
│   INT8 KV cache                         │
│   → 2x further reduction               │
├─────────────────────────────────────────┤
│ Level 4: Eviction                       │
│   H2O or StreamingLLM                   │
│   → Fixed memory for any context length │
├─────────────────────────────────────────┤
│ Level 5: Sharing                        │
│   Prefix caching                        │
│   → Amortize shared prompt costs        │
└─────────────────────────────────────────┘

Combined: 20-50x memory reduction vs naive MHA + static allocation
```

---

## Key Takeaways

1. **The KV cache often uses more memory than model weights.** At long
   contexts with large batches, it dominates GPU memory.

2. **PagedAttention is essential.** It eliminates memory waste from
   pre-allocation. This is why vLLM can serve 2-4x more concurrent
   requests than naive implementations.

3. **Continuous batching maximizes throughput.** Never let GPUs sit idle
   waiting for the longest request in a batch.

4. **Quantized KV cache is a free win.** INT8 quantization has
   negligible quality impact and doubles your effective batch size.

5. **Cache eviction enables infinite context.** StreamingLLM and H2O
   let models process arbitrarily long inputs with fixed memory.

6. **Prefix caching matters for production.** When many requests share
   a system prompt, caching it once saves significant compute.

---

## Exercises

1. **Measure KV cache size.** Load Llama 3 8B and generate text at
   context lengths 1K, 4K, 16K. Profile GPU memory and calculate what
   fraction is model weights vs KV cache at each length.

2. **Implement StreamingLLM.** Build the attention-sink + recent-window
   cache strategy. Test on a long document summarization task and
   compare quality against full cache.

3. **Quantized cache experiment.** Implement INT8 KV cache quantization.
   Measure perplexity on a benchmark before and after. Then try INT4
   and compare the quality-memory tradeoff.
