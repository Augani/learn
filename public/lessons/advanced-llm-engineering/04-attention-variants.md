# Lesson 04: Attention Variants — Faster, Leaner, Longer

Standard multi-head attention is the heart of every transformer. It is
also the bottleneck. As sequences get longer, attention's memory and
compute costs grow quadratically. A 4K context model uses 16x more
attention resources than a 1K model.

Think of attention like a meeting. In standard attention, every person
(token) must listen to every other person's full update. With 100
people that is 10,000 conversations. The variants in this lesson are
like organizing the meeting more efficiently — sharing notes, splitting
into groups, or only listening to nearby speakers.

---

## Quick Refresher: Standard Multi-Head Attention

```
For each attention head:
  Q = X @ W_Q    (query)
  K = X @ W_K    (key)
  V = X @ W_V    (value)

  Attention = softmax(Q @ K^T / sqrt(d_k)) @ V

With h heads, each head has dimension d_k = d_model / h
```

```
Standard Multi-Head Attention (MHA):

Head 0:  Q0  K0  V0  → Attention0
Head 1:  Q1  K1  V1  → Attention1
Head 2:  Q2  K2  V2  → Attention2
...
Head h:  Qh  Kh  Vh  → Attentionh

Each head has its own Q, K, V projections.
Total KV parameters: 2 × h × d_k × d_model
```

The problem: during generation, you cache K and V for all previous
tokens (the "KV cache"). With many heads, this cache is enormous.

```
KV Cache size per layer:
  = 2 × batch_size × seq_len × num_heads × head_dim × bytes_per_param

Example (Llama 70B, 1 layer, batch=1, seq=4096):
  = 2 × 1 × 4096 × 64 × 128 × 2 bytes
  = 128 MB per layer × 80 layers = 10 GB just for KV cache!
```

---

## Multi-Query Attention (MQA)

**Key idea:** All attention heads share the same K and V projections.
Each head still has its own Q.

```
Multi-Query Attention:

Head 0:  Q0  K   V   → Attention0
Head 1:  Q1  K   V   → Attention1    ◄── All heads share K and V
Head 2:  Q2  K   V   → Attention2
...
Head h:  Qh  K   V   → Attentionh

KV parameters: 2 × 1 × d_k × d_model  (not × h)
KV cache: reduced by factor of h (e.g., 64x smaller!)
```

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiQueryAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = d_model // num_heads

        self.q_proj = nn.Linear(d_model, d_model)
        self.k_proj = nn.Linear(d_model, self.head_dim)   # single head
        self.v_proj = nn.Linear(d_model, self.head_dim)   # single head
        self.out_proj = nn.Linear(d_model, d_model)

    def forward(self, x, mask=None):
        batch, seq_len, _ = x.shape

        q = self.q_proj(x).view(batch, seq_len, self.num_heads, self.head_dim)
        k = self.k_proj(x).view(batch, seq_len, 1, self.head_dim)
        v = self.v_proj(x).view(batch, seq_len, 1, self.head_dim)

        q = q.transpose(1, 2)  # (batch, heads, seq, dim)
        k = k.transpose(1, 2)  # (batch, 1, seq, dim) — broadcasts
        v = v.transpose(1, 2)

        scores = torch.matmul(q, k.transpose(-2, -1)) / (self.head_dim ** 0.5)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float("-inf"))
        attn = F.softmax(scores, dim=-1)
        out = torch.matmul(attn, v)  # v broadcasts across heads

        out = out.transpose(1, 2).contiguous().view(batch, seq_len, -1)
        return self.out_proj(out)
```

**Tradeoff:** MQA is faster and uses far less memory, but quality
degrades slightly because heads cannot attend to different
representations of keys and values.

**Used by:** PaLM, Falcon, StarCoder.

---

## Grouped-Query Attention (GQA)

**Key idea:** A middle ground. Instead of 1 KV head (MQA) or h KV
heads (MHA), use g groups of KV heads where 1 < g < h.

```
Standard MHA (h=8 KV heads):
  Q0 K0 V0 | Q1 K1 V1 | Q2 K2 V2 | Q3 K3 V3 | Q4 K4 V4 | Q5 K5 V5 | Q6 K6 V6 | Q7 K7 V7

MQA (1 KV head):
  Q0 K V | Q1 K V | Q2 K V | Q3 K V | Q4 K V | Q5 K V | Q6 K V | Q7 K V

GQA (2 KV groups):
  Q0 K0 V0 | Q1 K0 V0 | Q2 K0 V0 | Q3 K0 V0 | Q4 K1 V1 | Q5 K1 V1 | Q6 K1 V1 | Q7 K1 V1
  ◄──── group 0 ─────────────────────────────► ◄──── group 1 ─────────────────────────────►
```

```python
class GroupedQueryAttention(nn.Module):
    def __init__(self, d_model, num_heads, num_kv_heads):
        super().__init__()
        self.num_heads = num_heads
        self.num_kv_heads = num_kv_heads
        self.num_queries_per_kv = num_heads // num_kv_heads
        self.head_dim = d_model // num_heads

        self.q_proj = nn.Linear(d_model, num_heads * self.head_dim)
        self.k_proj = nn.Linear(d_model, num_kv_heads * self.head_dim)
        self.v_proj = nn.Linear(d_model, num_kv_heads * self.head_dim)
        self.out_proj = nn.Linear(d_model, d_model)

    def forward(self, x, mask=None):
        batch, seq_len, _ = x.shape

        q = self.q_proj(x).view(batch, seq_len, self.num_heads, self.head_dim)
        k = self.k_proj(x).view(batch, seq_len, self.num_kv_heads, self.head_dim)
        v = self.v_proj(x).view(batch, seq_len, self.num_kv_heads, self.head_dim)

        q = q.transpose(1, 2)
        k = k.transpose(1, 2)
        v = v.transpose(1, 2)

        # expand KV heads to match Q heads
        if self.num_kv_heads < self.num_heads:
            k = k.repeat_interleave(self.num_queries_per_kv, dim=1)
            v = v.repeat_interleave(self.num_queries_per_kv, dim=1)

        scores = torch.matmul(q, k.transpose(-2, -1)) / (self.head_dim ** 0.5)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float("-inf"))
        attn = F.softmax(scores, dim=-1)
        out = torch.matmul(attn, v)

        out = out.transpose(1, 2).contiguous().view(batch, seq_len, -1)
        return self.out_proj(out)
```

**Used by:** Llama 2 70B (8 KV heads from 64 Q heads), Llama 3,
Mistral, Gemma.

GQA gives you most of MQA's memory savings with almost no quality loss.
It has become the default for modern LLMs.

```
Memory comparison (64 Q heads, head_dim=128, seq=4096, bf16):

MHA  (64 KV heads): 2 × 64 × 4096 × 128 × 2 = 128 MB/layer
GQA  (8 KV heads):  2 × 8  × 4096 × 128 × 2 = 16 MB/layer   (8x less)
MQA  (1 KV head):   2 × 1  × 4096 × 128 × 2 = 2 MB/layer    (64x less)
```

---

## Sliding Window Attention

**Key idea:** Each token only attends to the W nearest tokens, not the
entire sequence. Outside the window, attention is zero.

```
Full Attention (seq_len=8):
   1 2 3 4 5 6 7 8
1 [■ □ □ □ □ □ □ □]
2 [■ ■ □ □ □ □ □ □]
3 [■ ■ ■ □ □ □ □ □]
4 [■ ■ ■ ■ □ □ □ □]
5 [■ ■ ■ ■ ■ □ □ □]
6 [■ ■ ■ ■ ■ ■ □ □]
7 [■ ■ ■ ■ ■ ■ ■ □]
8 [■ ■ ■ ■ ■ ■ ■ ■]

Sliding Window (window=3):
   1 2 3 4 5 6 7 8
1 [■ □ □ □ □ □ □ □]
2 [■ ■ □ □ □ □ □ □]
3 [■ ■ ■ □ □ □ □ □]
4 [□ ■ ■ ■ □ □ □ □]
5 [□ □ ■ ■ ■ □ □ □]
6 [□ □ □ ■ ■ ■ □ □]
7 [□ □ □ □ ■ ■ ■ □]
8 [□ □ □ □ □ ■ ■ ■]

■ = can attend, □ = cannot attend
```

Memory goes from O(n^2) to O(n × w). For a 128K sequence with
window 4K, that is 32x less memory in the attention computation.

**But wait — does this lose long-range information?**

Not as much as you would think. With L layers and window W, information
can propagate L × W tokens through the network. A 32-layer model with
window 4096 can theoretically propagate information 131,072 tokens.

```
Layer 1: Token 1 sees tokens 1-4096
Layer 2: Token 4096 has info from tokens 1-4096
         Token 8192 sees tokens 4097-8192
         But also sees token 4096 which "knows about" 1-4096
Layer 3: Information has reached 12,288 tokens...
```

**Used by:** Mistral 7B (window=4096), Mixtral.

**Common pattern:** Combine sliding window with a few full-attention
layers. Use sliding window for most layers but full attention every
4th layer. This gives you local efficiency with global reach.

---

## Flash Attention

Flash Attention is not a different attention pattern — it computes the
exact same result as standard attention. The difference is how it uses
GPU memory.

### The Memory Problem

Standard attention materializes the full N×N attention matrix:

```
Standard Attention Memory Flow:

                    GPU SRAM (fast, small: ~20MB)
                    ┌─────────────────────┐
  GPU HBM           │ Small working set   │
  (slow, large)     │                     │
  ┌──────────┐      └─────────────────────┘
  │ Q  (NxD) │ ──►  Load Q
  │ K  (NxD) │ ──►  Load K
  │          │       Compute S = QK^T
  │ S  (NxN) │ ◄──  Store S (N×N!)  ◄── THIS IS THE PROBLEM
  │          │ ──►  Load S
  │ P  (NxN) │ ◄──  Store softmax(S)
  │          │ ──►  Load P
  │ V  (NxD) │ ──►  Load V
  │ O  (NxD) │ ◄──  Store output
  └──────────┘

For seq_len=4096, d=128: S is 4096×4096 = 16M entries = 64MB in fp32
This matrix is written to slow HBM, then read back. Huge waste.
```

### Flash Attention: Tiled Computation

Flash Attention never materializes the full attention matrix. It
processes attention in tiles that fit in fast SRAM.

```
Flash Attention Memory Flow:

  GPU HBM            GPU SRAM (fast)
  ┌──────────┐       ┌──────────────────────┐
  │ Q  (NxD) │ ──►   │ Q_tile (block × D)   │
  │ K  (NxD) │ ──►   │ K_tile (block × D)   │
  │ V  (NxD) │ ──►   │ V_tile (block × D)   │
  │          │        │ S_tile (block × block)│ ◄── small! fits in SRAM
  │ O  (NxD) │ ◄──   │ O_tile (block × D)   │
  └──────────┘       └──────────────────────┘

  Process blocks one at a time. Accumulate results.
  Never materialize the full N×N matrix.
```

The key trick: the online softmax algorithm. Standard softmax requires
seeing all values first. Flash Attention uses a running max and sum to
compute softmax incrementally across tiles.

### Using Flash Attention

You rarely implement Flash Attention yourself. Use the library:

```python
from flash_attn import flash_attn_func

# q, k, v: (batch, seq_len, num_heads, head_dim)
output = flash_attn_func(q, k, v, causal=True)
```

Or through PyTorch 2.0+ scaled_dot_product_attention:

```python
import torch.nn.functional as F

# PyTorch automatically uses Flash Attention when possible
output = F.scaled_dot_product_attention(
    query, key, value,
    attn_mask=None,
    is_causal=True,
)
```

### Flash Attention Performance

```
Speedup over standard attention (A100, bf16):

Sequence Length    Speedup    Memory Savings
──────────────────────────────────────────────
512                1.3x       2x
1024               1.7x       4x
2048               2.2x       8x
4096               2.8x       16x
8192               3.5x       32x
16384              4.2x       64x

Longer sequences = bigger wins. At 16K, Flash Attention uses
64x less memory for the attention computation.
```

### Flash Attention 2 and 3

Flash Attention 2 improved GPU occupancy with better work partitioning:
- 2x faster than Flash Attention 1 on A100
- Better parallelism across warps within thread blocks

Flash Attention 3 (Hopper GPUs only) uses H100-specific features:
- FP8 tensor cores for attention computation
- Asynchronous data movement (TMA)
- ~1.5-2x faster than Flash Attention 2 on H100

---

## When to Use Which

```
Attention Type      Best For                           KV Cache   Speed
─────────────────────────────────────────────────────────────────────────
MHA                 Maximum quality, small models       Largest    Slowest
GQA                 Production LLMs (best tradeoff)    Small      Fast
MQA                 Extreme batch inference             Smallest   Fastest
Sliding Window      Very long contexts + local tasks    Small      Fast
Flash Attention     Everything (implementation detail)  Same       2-4x faster

Recommendations:
  - New model < 3B params:   MHA + Flash Attention
  - New model 3B-70B:        GQA + Flash Attention
  - New model + long context: GQA + Sliding Window + Flash Attention
  - Batch inference focus:    MQA + Flash Attention
```

---

## Combining Variants

Modern models combine these techniques. Mistral 7B uses:
- GQA (8 KV heads, 32 Q heads)
- Sliding window attention (window = 4096)
- Flash Attention 2 for implementation

```python
class MistralAttention(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.num_heads = 32
        self.num_kv_heads = 8
        self.head_dim = 128
        self.window_size = 4096

        self.q_proj = nn.Linear(4096, 32 * 128)
        self.k_proj = nn.Linear(4096, 8 * 128)
        self.v_proj = nn.Linear(4096, 8 * 128)
        self.out_proj = nn.Linear(4096, 4096)

    def forward(self, x, position_ids, past_kv=None):
        batch, seq_len, _ = x.shape

        q = self.q_proj(x).view(batch, seq_len, self.num_heads, self.head_dim)
        k = self.k_proj(x).view(batch, seq_len, self.num_kv_heads, self.head_dim)
        v = self.v_proj(x).view(batch, seq_len, self.num_kv_heads, self.head_dim)

        # apply rotary position embeddings (RoPE — see Lesson 05)
        q, k = apply_rotary_emb(q, k, position_ids)

        # update KV cache (sliding window)
        if past_kv is not None:
            k = torch.cat([past_kv[0], k], dim=1)
            v = torch.cat([past_kv[1], v], dim=1)
            # only keep last window_size entries
            if k.shape[1] > self.window_size:
                k = k[:, -self.window_size:]
                v = v[:, -self.window_size:]

        # expand KV heads for GQA
        k = k.repeat_interleave(self.num_heads // self.num_kv_heads, dim=2)
        v = v.repeat_interleave(self.num_heads // self.num_kv_heads, dim=2)

        # Flash Attention handles the actual computation
        # (through PyTorch's SDPA or flash_attn library)
        q = q.transpose(1, 2)
        k = k.transpose(1, 2)
        v = v.transpose(1, 2)

        output = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        output = output.transpose(1, 2).contiguous().view(batch, seq_len, -1)

        return self.out_proj(output), (k, v)
```

---

## Key Takeaways

1. **GQA is the modern default.** It provides 4-8x KV cache reduction
   with minimal quality loss. Use it for any model above 3B.

2. **Flash Attention is not optional.** It is a pure implementation win
   with no quality tradeoff. Always use it (PyTorch SDPA or the
   flash-attn library).

3. **Sliding window extends context cheaply** but sacrifices direct
   long-range attention. Combine it with a few full-attention layers.

4. **KV cache is the real bottleneck** for inference. MQA/GQA exist
   primarily to shrink the cache, not to speed up training.

5. **These techniques compose.** GQA + sliding window + Flash Attention
   is the standard stack for modern LLMs.

---

## Exercises

1. **Benchmark MHA vs GQA vs MQA.** Implement all three for a small
   transformer. Measure training speed, memory usage, and perplexity
   on the same dataset. Plot KV cache size vs sequence length.

2. **Sliding window experiment.** Train two small models — one with
   full attention, one with sliding window. Test on tasks requiring
   long-range dependencies (document QA, long summarization). At what
   window size does quality start to degrade?

3. **Flash Attention profiling.** Profile attention computation with
   and without Flash Attention at sequence lengths 512, 2048, 8192,
   and 32768. Measure wall-clock time and peak memory.
