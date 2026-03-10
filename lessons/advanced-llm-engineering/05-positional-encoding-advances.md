# Lesson 05: Positional Encoding Advances — Teaching Models Where Tokens Are

Transformers have no built-in sense of order. Without positional
encoding, the sentence "dog bites man" and "man bites dog" produce
identical outputs. Positional encodings tell the model where each token
sits in the sequence.

Think of it like seat numbers in a theater. The actors (tokens) are the
same, but the show changes completely depending on who sits where. The
original transformer used fixed sinusoidal seat numbers. Modern methods
use relative distances — like saying "I am 3 seats to your left"
instead of "I am in seat 47."

---

## The Evolution of Positional Encoding

```
2017: Sinusoidal (original Transformer)
  └── Fixed, absolute positions. Cannot extrapolate beyond training length.

2018: Learned Absolute (BERT, GPT-2)
  └── Learned embeddings per position. Still absolute, still limited.

2020: Relative Position Bias (T5)
  └── Learned bias based on distance between tokens.

2021: RoPE (RoFormer)
  └── Rotary embeddings. Encodes relative position in the query-key dot product.

2022: ALiBi (BLOOM)
  └── Linear bias on attention scores. No learned parameters.

2023-24: Context Extension (YaRN, NTK-aware)
  └── Methods to extend RoPE models beyond their training context length.
```

---

## Rotary Position Embeddings (RoPE)

RoPE is the dominant method. Used by Llama, Mistral, Qwen, Phi, and
most modern LLMs. It encodes position by rotating query and key vectors
in a way that makes their dot product depend only on relative distance.

### The Intuition

Imagine two arrows (vectors) on a plane. If you rotate both arrows by
the same angle, the angle between them stays the same. But if you
rotate them by different amounts (because they are at different
positions), the angle between them encodes the difference in position.

```
Position 0: rotate by 0°    →  →
Position 1: rotate by 10°   ↗  ↗
Position 2: rotate by 20°   ↑  ↑
Position 3: rotate by 30°   ↖  ↖

Dot product of Q at pos 0 and K at pos 2
= same as dot product of Q at pos 5 and K at pos 7
= depends only on the distance (2), not absolute positions
```

### The Math

RoPE groups the dimensions of Q and K into pairs and applies a 2D
rotation to each pair. The rotation angle depends on the position
and the dimension index.

```
For dimension pair (2i, 2i+1) at position m:

θ_i = 10000^(-2i/d)    (frequency for this dimension pair)

Rotation matrix for position m, dimension pair i:

R(m, i) = [ cos(m·θ_i)  -sin(m·θ_i) ]
          [ sin(m·θ_i)   cos(m·θ_i) ]

Apply to query:   q'[2i:2i+2] = R(m, i) @ q[2i:2i+2]
Apply to key:     k'[2i:2i+2] = R(n, i) @ k[2i:2i+2]
```

The dot product q' · k' then depends on (m - n) — the relative
position — not on m or n individually.

```python
import torch

def precompute_rope_frequencies(dim, max_seq_len, base=10000.0):
    freqs = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
    positions = torch.arange(max_seq_len).float()
    angles = torch.outer(positions, freqs)
    cos_cache = angles.cos()
    sin_cache = angles.sin()
    return cos_cache, sin_cache


def apply_rope(x, cos, sin):
    # x: (batch, seq_len, num_heads, head_dim)
    d = x.shape[-1]
    x_pairs = x.view(*x.shape[:-1], d // 2, 2)

    x_even = x_pairs[..., 0]
    x_odd = x_pairs[..., 1]

    # cos and sin: (seq_len, head_dim // 2)
    cos = cos[:x.shape[1]].unsqueeze(0).unsqueeze(2)
    sin = sin[:x.shape[1]].unsqueeze(0).unsqueeze(2)

    x_rotated_even = x_even * cos - x_odd * sin
    x_rotated_odd = x_even * sin + x_odd * cos

    x_rotated = torch.stack([x_rotated_even, x_rotated_odd], dim=-1)
    return x_rotated.view(*x.shape)


cos_cache, sin_cache = precompute_rope_frequencies(128, 8192)

# during forward pass:
q_rotated = apply_rope(q, cos_cache, sin_cache)
k_rotated = apply_rope(k, cos_cache, sin_cache)
# then compute attention with q_rotated and k_rotated
```

### Why RoPE Works So Well

1. **Relative position naturally:** The dot product decays with distance
   in a smooth, continuous way.

2. **No additional parameters:** Just a mathematical transformation of
   existing Q and K vectors.

3. **Works with KV cache:** You only need to apply RoPE once when a
   token enters the cache. No need to recompute.

4. **Long-range decay:** Higher-frequency dimensions create rapid
   oscillations that naturally reduce attention to distant tokens.
   Lower-frequency dimensions maintain long-range connections.

```
Dimension pair 0 (low freq):  wavelength ≈ 10000 tokens
  Slow rotation → captures long-range relationships

Dimension pair 32 (mid freq): wavelength ≈ 100 tokens
  Medium rotation → captures paragraph-level structure

Dimension pair 63 (high freq): wavelength ≈ 1 token
  Fast rotation → captures immediate neighbors
```

---

## ALiBi (Attention with Linear Biases)

ALiBi takes a radically simpler approach. Instead of modifying Q and K,
it adds a penalty to attention scores based on the distance between
tokens.

```
Standard attention:  score(i,j) = q_i · k_j / sqrt(d)
ALiBi attention:     score(i,j) = q_i · k_j / sqrt(d) - m · |i - j|

m = head-specific slope (fixed, not learned)
```

```
Attention bias matrix for ALiBi (head with slope m=0.5):

       Position 0  1  2  3  4  5  6  7
Pos 0:    0.0
Pos 1:   -0.5   0.0
Pos 2:   -1.0  -0.5   0.0
Pos 3:   -1.5  -1.0  -0.5   0.0
Pos 4:   -2.0  -1.5  -1.0  -0.5   0.0
Pos 5:   -2.5  -2.0  -1.5  -1.0  -0.5   0.0
Pos 6:   -3.0  -2.5  -2.0  -1.5  -1.0  -0.5   0.0
Pos 7:   -3.5  -3.0  -2.5  -2.0  -1.5  -1.0  -0.5   0.0

Distant tokens get penalized more → local attention is stronger
```

```python
import torch
import math

def build_alibi_slopes(num_heads):
    closest_power_of_2 = 2 ** math.floor(math.log2(num_heads))
    base = 2 ** (-(2 ** -(math.log2(closest_power_of_2) - 3)))
    powers = torch.arange(1, closest_power_of_2 + 1)
    slopes = base ** powers

    if closest_power_of_2 != num_heads:
        extra_base = 2 ** (-(2 ** -(math.log2(2 * closest_power_of_2) - 3)))
        extra_powers = torch.arange(1, 2 * (num_heads - closest_power_of_2) + 1, 2)
        extra_slopes = extra_base ** extra_powers
        slopes = torch.cat([slopes, extra_slopes])

    return slopes


def build_alibi_bias(seq_len, num_heads):
    slopes = build_alibi_slopes(num_heads)
    positions = torch.arange(seq_len)
    distances = positions.unsqueeze(0) - positions.unsqueeze(1)
    distances = distances.abs().float()
    bias = -distances.unsqueeze(0) * slopes.unsqueeze(1).unsqueeze(2)
    return bias  # (num_heads, seq_len, seq_len)
```

### ALiBi Strengths and Weaknesses

**Strengths:**
- Zero learned parameters
- Naturally extrapolates to longer sequences (just larger penalties)
- Simple to implement
- Works without modifying Q/K projections

**Weaknesses:**
- Fixed linear decay may be too aggressive for some tasks
- Cannot learn complex position-dependent patterns
- Slightly worse quality than RoPE on long-context benchmarks

**Used by:** BLOOM, MPT.

---

## Context Length Extension

You trained a model with 4K context. Now you want it to work at 32K
or 128K. The positional encoding determines whether this is possible.

### The Problem with Direct Extrapolation

```
Training: positions 0, 1, 2, ..., 4095
Inference: positions 0, 1, 2, ..., 32767

RoPE angles at position 32767:
  θ × 32767 = very large angles that the model never saw during training

Result: attention patterns break down. Quality collapses.
```

### Position Interpolation (PI)

Instead of extrapolating (using positions beyond training range),
interpolate (squash the extended range into the original range).

```
Original (4K training):
  Position 0    → angle 0
  Position 4095 → angle θ × 4095

Extrapolation to 16K (broken):
  Position 16383 → angle θ × 16383  ← never seen, model confused

Position Interpolation to 16K:
  Position 0     → angle 0
  Position 16383 → angle θ × 4095  ← same max angle as training

  Scale factor: 4096 / 16384 = 0.25
  New position: actual_position × 0.25
```

```python
def apply_rope_with_interpolation(x, cos, sin, scale_factor):
    seq_len = x.shape[1]
    positions = torch.arange(seq_len, device=x.device).float()
    scaled_positions = positions * scale_factor

    # recompute cos/sin at scaled positions
    # (or index into a precomputed cache at fractional positions)
    cos_scaled = interpolate_cache(cos, scaled_positions)
    sin_scaled = interpolate_cache(sin, scaled_positions)

    return apply_rope(x, cos_scaled, sin_scaled)
```

PI works but requires fine-tuning. The model needs to adjust to the
compressed position space. Typically 1000-2000 steps of fine-tuning
is sufficient.

### NTK-Aware Scaling

A smarter approach: instead of scaling all frequencies equally, change
the base frequency of RoPE. This preserves high-frequency (local)
information while extending low-frequency (global) reach.

```
Original RoPE:
  θ_i = 10000^(-2i/d)

NTK-Aware (extending 4x):
  θ_i = (10000 × α)^(-2i/d)    where α adjusts the base

This changes the "wavelength" of each dimension:
  High dimensions (local):  barely changed
  Low dimensions (global):  significantly extended
```

```python
def compute_ntk_rope_frequencies(dim, max_seq_len, base=10000.0, scale=4.0):
    # NTK-aware interpolation: scale the base
    base = base * (scale ** (dim / (dim - 2)))
    freqs = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
    positions = torch.arange(max_seq_len).float()
    angles = torch.outer(positions, freqs)
    return angles.cos(), angles.sin()
```

**Advantage over PI:** NTK-aware scaling can work without fine-tuning
for moderate extensions (2-4x). For larger extensions you still need
some fine-tuning.

### YaRN (Yet another RoPE extensioN)

YaRN combines the best ideas: NTK-aware scaling for low frequencies
plus a temperature scaling for the attention logits.

```
YaRN frequency modification:

For each dimension pair i:
  if wavelength(i) < original_context:
      Don't scale (high-frequency, local — already fine)
  elif wavelength(i) > original_context × scale:
      Apply full NTK scaling (low-frequency, global)
  else:
      Interpolate between no-scaling and full scaling

Plus: scale attention logits by sqrt(1/t) where t depends on
the extension ratio. This compensates for the entropy change
in the attention distribution.
```

```python
import torch
import math

def yarn_rope_frequencies(
    dim, max_seq_len, original_max_len=4096,
    base=10000.0, scale=4.0, beta_fast=32, beta_slow=1
):
    freqs = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
    wavelengths = 2 * math.pi / freqs

    low_threshold = original_max_len / beta_fast
    high_threshold = original_max_len / beta_slow

    yarn_freqs = torch.zeros_like(freqs)
    for i, (freq, wavelength) in enumerate(zip(freqs, wavelengths)):
        if wavelength < low_threshold:
            yarn_freqs[i] = freq
        elif wavelength > high_threshold:
            yarn_freqs[i] = freq / scale
        else:
            smooth = (original_max_len / wavelength - beta_fast) / (beta_slow - beta_fast)
            smooth = max(0, min(1, smooth))
            yarn_freqs[i] = (1 - smooth) * freq + smooth * (freq / scale)

    positions = torch.arange(max_seq_len).float()
    angles = torch.outer(positions, yarn_freqs)
    return angles.cos(), angles.sin()
```

### Extension Methods Comparison

```
Method                Fine-tune    Extension    Quality
                      Required?    Range
────────────────────────────────────────────────────────
Position Interpolation  Yes        2-8x         Good
NTK-Aware              Sometimes   2-4x         Good
NTK-Aware + fine-tune  Yes         4-16x        Better
YaRN                   Minimal     4-16x        Best
YaRN + fine-tune       Yes         16-64x       Best

Practical recommendations:
  2-4x extension:   NTK-aware (no fine-tune needed)
  4-16x extension:  YaRN + 1000 steps fine-tuning
  16x+ extension:   Train with long context from scratch
```

---

## Long-Context Strategies Beyond Positional Encoding

Positional encoding extension is only part of the story. Actually
using long contexts requires additional engineering.

### The Memory Wall

```
Context Length    KV Cache (Llama 7B, bf16)    Attention FLOPs
───────────────────────────────────────────────────────────────
4K               1 GB                          Baseline
16K              4 GB                          16x
32K              8 GB                          64x
128K             32 GB                         1024x
1M               256 GB                        ~65000x
```

Attention compute grows quadratically. KV cache grows linearly. Both
become problems at long context.

### Strategies for Long Context

```
1. Sliding window attention (Lesson 04)
   - Limits attention to local window
   - Information propagates through layers

2. Ring attention
   - Distribute long sequences across GPUs
   - Each GPU handles a chunk, passes KV to neighbors

3. Sparse attention patterns
   - Global tokens + local windows
   - Every 512th token attends to everything

4. KV cache compression (Lesson 06)
   - Evict old KV entries
   - Quantize cached values
   - Page-based memory management

5. Retrieval augmentation
   - Don't put everything in context
   - Retrieve relevant chunks as needed
```

### Ring Attention for Ultra-Long Contexts

Ring attention distributes a long sequence across GPUs in a ring
topology. Each GPU processes its local chunk while receiving KV
blocks from its neighbor.

```
GPU Ring (4 GPUs, 128K context = 32K per GPU):

     GPU 0 (tokens 0-32K)
        ↗           ↘
GPU 3              GPU 1
(96K-128K)         (32K-64K)
        ↖           ↙
     GPU 2 (tokens 64K-96K)

Step 1: Each GPU computes attention on its local chunk
Step 2: GPU 0 sends KV to GPU 1, GPU 1 sends to GPU 2, etc.
Step 3: Each GPU computes attention with received KV chunk
Step 4: Repeat until all chunks have been rotated around the ring

Result: Full attention computed without any GPU holding all KV
```

---

## Implementation Checklist

When implementing or choosing positional encoding:

```
□ RoPE is the default choice for new models
□ Base frequency 10000 is standard (higher = more extrapolation room)
□ Apply RoPE to Q and K only (not V, not FFN)
□ Precompute sin/cos tables (do not recompute per forward pass)
□ For context extension:
    □ Decide target context length
    □ Choose method (NTK-aware for small extensions, YaRN for large)
    □ Fine-tune on long-context data (even a few hundred examples helps)
    □ Evaluate on long-context benchmarks (RULER, LongBench, Needle-in-Haystack)
□ Test extrapolation: run inference at 2x training length and check quality
```

---

## Key Takeaways

1. **RoPE is the standard.** Used by nearly every modern LLM. Learn it
   deeply — you will encounter it everywhere.

2. **Relative position > absolute position.** Models care about
   distance between tokens, not their absolute index.

3. **Context extension is a solved problem** for moderate ranges (4-16x).
   YaRN + fine-tuning is reliable. Extreme extension (100x+) still
   requires careful engineering.

4. **Long context is not just about positional encoding.** Memory
   management (KV cache), attention patterns (sliding window), and
   distributed computation (ring attention) all matter.

5. **The base frequency controls extrapolation.** Higher base = longer
   wavelengths = more room to extend without fine-tuning.

---

## Exercises

1. **Visualize RoPE.** Plot the rotation angles for different dimension
   pairs at positions 0-4096. Observe how high-frequency dimensions
   oscillate rapidly while low-frequency dimensions change slowly.

2. **Needle-in-a-haystack test.** Take a model with 4K training
   context. Test it at 8K and 16K with raw extrapolation, PI,
   NTK-aware, and YaRN. Plant a fact early in the context and test
   retrieval at different depths.

3. **Build a context extension pipeline.** Take Llama 3 8B (8K context),
   apply YaRN to extend to 32K, fine-tune on 200 long-context examples,
   and evaluate on LongBench. Compare to the base model.
