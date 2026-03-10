# Reference: LLM Architectures — Parameter Counts, Context Lengths, and Key Design Choices

Quick reference for the most important open and notable LLM architectures.

---

## Architecture Comparison Table

```
Model             Params   Context   Vocab    Layers  Heads  KV Heads  Hidden   FFN      Pos Enc   Attention
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
GPT-2             1.5B     1024      50257    48      25     25        1600     6400     Learned   MHA
GPT-3             175B     2048      50257    96      96     96        12288    49152    Learned   MHA
LLaMA 1 7B        6.7B     2048      32000    32      32     32        4096     11008    RoPE      MHA
LLaMA 1 13B       13B      2048      32000    40      40     40        5120     13824    RoPE      MHA
LLaMA 1 65B       65B      2048      32000    80      64     64        8192     22016    RoPE      MHA

Llama 2 7B        6.7B     4096      32000    32      32     32        4096     11008    RoPE      MHA
Llama 2 13B       13B      4096      32000    40      40     40        5120     13824    RoPE      MHA
Llama 2 70B       70B      4096      32000    80      64     8         8192     28672    RoPE      GQA

Llama 3 8B        8B       8192      128256   32      32     8         4096     14336    RoPE      GQA
Llama 3 70B       70B      8192      128256   80      64     8         8192     28672    RoPE      GQA
Llama 3 405B      405B     8192      128256   126     128    8         16384    53248    RoPE      GQA

Mistral 7B        7.3B     32768*    32000    32      32     8         4096     14336    RoPE      GQA+SW
Mixtral 8x7B      46.7B    32768     32000    32      32     8         4096     14336    RoPE      GQA+SW (MoE)
Mixtral 8x22B     141B     65536     32768    56      48     8         6144     16384    RoPE      GQA+SW (MoE)

Falcon 7B         7B       2048      65024    32      71     1         4544     —        RoPE      MQA
Falcon 40B        40B      2048      65024    60      64     8         8192     —        RoPE      GQA
Falcon 180B       180B     2048      65024    80      232    8         14848    —        RoPE      GQA

Phi-3 Mini         3.8B    128000    32064    32      32     32        3072     8192     RoPE+LTR  MHA
Phi-3 Medium       14B     128000    32064    40      40     10        5120     17920    RoPE      GQA

Qwen 2 7B         7.6B     131072    151936   28      28     4         3584     18944    RoPE      GQA
Qwen 2 72B        72.7B    131072    151936   80      64     8         8192     29568    RoPE      GQA

Gemma 2 9B        9.2B     8192      256000   42      16     8         3584     14336    RoPE      GQA+SW
Gemma 2 27B       27.2B    8192      256000   46      32     16        4608     36864    RoPE      GQA+SW

DeepSeek-V2       236B     128000    100015   60      128    —         5120     12288    RoPE      MLA (MoE)
DeepSeek-V3       671B     131072    129280   61      128    —         7168     18432    RoPE      MLA (MoE)

BLOOM              176B    2048      250680   70      112    112       14336    57344    ALiBi     MHA
MPT-30B            30B     8192      50432    48      64     64        7168     28672    ALiBi     MHA
```

*Mistral 7B uses sliding window attention with window size 4096, but supports 32K context via rolling buffer.

**Abbreviations:**
- MHA: Multi-Head Attention
- MQA: Multi-Query Attention
- GQA: Grouped-Query Attention
- SW: Sliding Window
- MoE: Mixture of Experts
- MLA: Multi-head Latent Attention
- RoPE: Rotary Position Embedding
- ALiBi: Attention with Linear Biases
- LTR: Long-range Token Recurrence

---

## Memory Requirements (Inference, bf16)

```
Model Weights Only (bf16 = 2 bytes per parameter):

Model           Params    Weight Size    Min VRAM (with overhead)
──────────────────────────────────────────────────────────────────
1.5B            1.5B      3 GB          6 GB
7B              7B        14 GB         18 GB
8B              8B        16 GB         20 GB
13B             13B       26 GB         32 GB
34B             34B       68 GB         80 GB
70B             70B       140 GB        160 GB
180B            180B      360 GB        400 GB
405B            405B      810 GB        900 GB

Quantized (4-bit, ~0.55 bytes per parameter):

Model           Params    Weight Size    Min VRAM
──────────────────────────────────────────────────
7B              7B        ~4 GB         8 GB
8B              8B        ~4.5 GB       9 GB
13B             13B       ~7.5 GB       12 GB
34B             34B       ~19 GB        24 GB
70B             70B       ~38 GB        48 GB
180B            180B      ~100 GB       120 GB
```

---

## KV Cache Size Per Token (bf16)

```
Model           KV Heads   Head Dim   Layers   Per Token    4K Context
──────────────────────────────────────────────────────────────────────────
Llama 2 7B      32 (MHA)   128        32       512 KB       2 GB
Llama 2 70B     8 (GQA)    128        80       320 KB       1.3 GB
Llama 3 8B      8 (GQA)    128        32       128 KB       512 MB
Llama 3 70B     8 (GQA)    128        80       320 KB       1.3 GB
Llama 3 405B    8 (GQA)    128        126      504 KB       2 GB
Mistral 7B      8 (GQA)    128        32       128 KB       512 MB
Qwen 2 72B      8 (GQA)    128        80       320 KB       1.3 GB

Formula:
  Per token per layer = 2 × kv_heads × head_dim × 2 bytes
  Per token all layers = above × num_layers
  Total = above × sequence_length × batch_size
```

---

## MoE Architecture Details

```
Model            Experts   Active   Expert Size   Total Params   Active Params
──────────────────────────────────────────────────────────────────────────────
Mixtral 8x7B     8         2        ~7B FFN       46.7B          ~12.9B
Mixtral 8x22B    8         2        ~22B FFN      141B           ~39B
DeepSeek-V2      160       6        Small         236B           ~21B
DeepSeek-V3      256       8        Small         671B           ~37B
DBRX             16        4        ~12B FFN      132B           ~36B
Grok-1           8         2        ~?             314B           ~?

MoE Memory Rule:
  Need ALL experts in memory (total params)
  But compute only uses active experts per token
  Memory ≈ dense model of same total size
  Speed ≈ dense model of active params size
```

---

## Activation Functions

```
Model Family        Activation     Notes
──────────────────────────────────────────────
GPT-2/3             GELU           Original choice
LLaMA / Llama       SiLU (Swish)   With gated FFN (SwiGLU)
Mistral / Mixtral   SiLU           SwiGLU
Falcon              GELU           Standard FFN
Phi                 GELU           Standard FFN
Qwen                SiLU           SwiGLU
Gemma               GeGLU          Gated GELU

SwiGLU FFN:
  output = down_proj(silu(gate_proj(x)) * up_proj(x))

Standard FFN:
  output = down_proj(activation(up_proj(x)))

SwiGLU has 3 weight matrices vs 2 for standard FFN,
so intermediate_size is usually 2/3 of what a standard FFN would use.
```

---

## Normalization

```
Model Family        Norm Type        Location
──────────────────────────────────────────────────
GPT-2               LayerNorm        Pre-norm
GPT-3               LayerNorm        Pre-norm
LLaMA / Llama       RMSNorm          Pre-norm
Mistral             RMSNorm          Pre-norm
Falcon              LayerNorm        Pre-norm
Qwen                RMSNorm          Pre-norm
Gemma               RMSNorm          Pre-norm + post-norm

RMSNorm is simpler and faster than LayerNorm:
  RMSNorm(x) = x / sqrt(mean(x²) + ε) × γ
  LayerNorm(x) = (x - mean(x)) / sqrt(var(x) + ε) × γ + β

RMSNorm removes the mean-centering step. Works just as well in practice.
```

---

## Training Data Scale

```
Model            Training Tokens    Data Mix Highlights
──────────────────────────────────────────────────────────────
GPT-3            300B               Web, books, Wikipedia
LLaMA 1          1.4T               CommonCrawl, C4, books, arXiv, code
Llama 2          2T                 Similar to LLaMA 1, more data
Llama 3          15T+               Massive expansion, multilingual
Mistral 7B       Undisclosed        Web, code
Falcon 180B      3.5T               RefinedWeb (filtered CommonCrawl)
Qwen 2           7T+                Multilingual, code-heavy
DeepSeek-V3      14.8T              Multilingual, math, code
BLOOM             1.6T              46 languages, ROOTS corpus

Chinchilla optimal: tokens ≈ 20 × parameters
Most modern models are "over-trained" (tokens >> 20 × params)
because inference cost depends on model size, not training data.
```

---

## Quick Selection Guide

```
Use Case                         Recommended Starting Point
──────────────────────────────────────────────────────────────────
Small/edge deployment            Phi-3 Mini (3.8B) or Gemma 2 9B
General assistant (single GPU)   Llama 3 8B or Qwen 2 7B
High-quality assistant           Llama 3 70B or Qwen 2 72B
Code generation                  DeepSeek-Coder-V2 or CodeLlama
Long context (128K+)             Qwen 2 or Phi-3
Multilingual                     Qwen 2 or BLOOM
Maximum quality (open)           Llama 3 405B or DeepSeek-V3
Maximum throughput (MoE)         Mixtral 8x22B or DeepSeek-V2
```
