# Lesson 07: Memory Management for ML — Will Your Model Fit?

"CUDA out of memory" is the most common error in ML. Before you start
training, you need to know: how much GPU memory does my model need?
This lesson gives you the formulas to estimate memory for any model,
understand mixed precision, and know when to use gradient checkpointing
or quantization.

---

## The Core Idea

GPU memory holds three things during training: **model parameters**,
**optimizer states**, and **activations** (intermediate values needed
for backpropagation). Each has a formula. Add them up and you know if
your model fits.

**Analogy: Packing for a trip.** Parameters are your clothes (you
always need them). Optimizer states are your toiletries (extra stuff
the training process needs). Activations are souvenirs you collect
along the way (intermediate results you need to carry back). If your
suitcase (GPU memory) is too small, something has to go.

```
GPU Memory During Training:

┌─────────────────────────────────────────────┐
│              GPU Memory (HBM)               │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Model Parameters                   │    │
│  │  (weights + biases)                 │    │
│  │  Size: params × bytes_per_param     │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  Optimizer States                   │    │
│  │  (Adam: momentum + variance)        │    │
│  │  Size: 2× parameters (FP32)         │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  Gradients                          │    │
│  │  (same shape as parameters)         │    │
│  │  Size: 1× parameters                │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  Activations                        │    │
│  │  (intermediate values for backprop) │    │
│  │  Size: depends on batch size,       │    │
│  │        sequence length, model size  │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  CUDA Overhead                      │    │
│  │  (kernels, workspace, fragmentation)│    │
│  │  Size: ~500 MB - 2 GB               │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

---

## Parameter Count → Memory

The first step: how many bytes do your parameters need?

```
Bytes per parameter by precision:

Format    Bits    Bytes    Example: 7B model
──────    ────    ─────    ─────────────────
FP32      32      4        7B × 4 = 28 GB
FP16      16      2        7B × 2 = 14 GB
BF16      16      2        7B × 2 = 14 GB
FP8       8       1        7B × 1 = 7 GB
INT8      8       1        7B × 1 = 7 GB
INT4      4       0.5      7B × 0.5 = 3.5 GB
```

```python
def model_memory_gb(num_params_billions, bytes_per_param=2):
    """Estimate memory for model parameters only."""
    params = num_params_billions * 1e9
    bytes_total = params * bytes_per_param
    gb = bytes_total / (1024**3)
    return gb

# Examples
models = [
    ("GPT-2",       0.124, 2),
    ("LLaMA-7B",    7,     2),
    ("LLaMA-13B",   13,    2),
    ("LLaMA-70B",   70,    2),
    ("GPT-3",       175,   2),
]

print(f"{'Model':<15} {'Params':<10} {'FP16 (GB)':<12} {'INT4 (GB)':<12}")
print("-" * 50)
for name, params, bpp in models:
    fp16 = model_memory_gb(params, 2)
    int4 = model_memory_gb(params, 0.5)
    print(f"{name:<15} {params:<10} {fp16:<12.1f} {int4:<12.1f}")
```

---

## Training Memory: The Full Picture

Training needs much more memory than just the parameters. With Adam
optimizer and mixed precision (FP16 parameters, FP32 optimizer states):

```
Training Memory Formula (Mixed Precision + Adam):

  Parameters (FP16):           2 bytes × P
  Gradients (FP16):            2 bytes × P
  Optimizer momentum (FP32):   4 bytes × P
  Optimizer variance (FP32):   4 bytes × P
  Master weights (FP32):       4 bytes × P
  ─────────────────────────────────────────
  Total per parameter:         16 bytes × P

  Plus activations (depends on batch size and sequence length)

Example: 7B parameter model
  Parameters + optimizer: 7B × 16 bytes = 112 GB
  Activations (batch=1, seq=2048): ~2-8 GB
  CUDA overhead: ~1 GB
  ─────────────────────────────────
  Total: ~115-121 GB

  → Does NOT fit on a single 80 GB A100
  → Needs model parallelism or ZeRO optimization
```

```
Memory Breakdown for Training (7B model, FP16 + Adam):

┌──────────────────────────────────────────┐
│                                          │
│  ████████████████  Parameters    14 GB   │
│  ████████████████  Gradients     14 GB   │
│  ████████████████████████████████         │
│  ████████████████████████████████         │
│                    Optimizer     56 GB   │
│                    States                │
│  ████████  Activations           ~5 GB   │
│  ██  CUDA overhead               ~1 GB   │
│                                          │
│  Total: ~90-120 GB                       │
│  (varies with batch size)                │
└──────────────────────────────────────────┘
```

---

## Inference Memory: Much Simpler

Inference only needs parameters and a small KV cache. No gradients,
no optimizer states.

```
Inference Memory Formula:

  Parameters:    bytes_per_param × P
  KV Cache:      2 × layers × d_model × seq_len × batch × bytes
  Overhead:      ~500 MB

Example: LLaMA-7B inference in FP16
  Parameters: 7B × 2 bytes = 14 GB
  KV Cache (seq=2048, batch=1): ~1 GB
  Overhead: ~0.5 GB
  ─────────────────────────────────
  Total: ~15.5 GB → fits on RTX 4090 (24 GB)

Example: LLaMA-7B inference in INT4 (quantized)
  Parameters: 7B × 0.5 bytes = 3.5 GB
  KV Cache: ~0.5 GB (also quantized)
  Overhead: ~0.5 GB
  ─────────────────────────────────
  Total: ~4.5 GB → fits on RTX 3060 (12 GB)!
```

---

## Mixed Precision: FP32, FP16, BF16, FP8

Different number formats trade precision for speed and memory:

```
Number Format Comparison:

FP32 (32 bits): ┌─┬────────┬───────────────────────┐
                │S│Exponent│      Mantissa          │
                │ │ 8 bits │      23 bits           │
                └─┴────────┴───────────────────────┘
                Range: ±3.4×10³⁸, Precision: ~7 decimal digits

FP16 (16 bits): ┌─┬─────┬──────────┐
                │S│ Exp │ Mantissa │
                │ │5 bit│ 10 bits  │
                └─┴─────┴──────────┘
                Range: ±65,504, Precision: ~3 decimal digits
                Problem: small range → overflow/underflow

BF16 (16 bits): ┌─┬────────┬───────┐
                │S│Exponent│Mantis.│
                │ │ 8 bits │7 bits │
                └─┴────────┴───────┘
                Range: same as FP32! Precision: ~2 decimal digits
                Best of both: FP32 range + 16-bit size

FP8 (8 bits):   ┌─┬────┬───┐
                │S│Exp │Man│
                │ │4-5 │2-3│
                └─┴────┴───┘
                Very limited precision, but 4× less memory than FP32
                Used in H100 tensor cores for training
```

```python
import torch

# Comparing precision formats
value = torch.tensor(3.141592653589793)

print(f"FP32: {value.float()}")           # 3.1415927410125732
print(f"FP16: {value.half()}")            # 3.140625
print(f"BF16: {value.bfloat16()}")        # 3.140625

# Memory comparison
size = 1_000_000_000  # 1 billion elements
print(f"\n1B elements:")
print(f"  FP32: {size * 4 / 1e9:.1f} GB")
print(f"  FP16: {size * 2 / 1e9:.1f} GB")
print(f"  BF16: {size * 2 / 1e9:.1f} GB")
print(f"  INT8: {size * 1 / 1e9:.1f} GB")
print(f"  INT4: {size * 0.5 / 1e9:.1f} GB")
```

---

## Gradient Checkpointing

Gradient checkpointing trades compute for memory. Instead of storing
all activations during the forward pass, you only store checkpoints
and recompute the rest during backpropagation.

```
Without Gradient Checkpointing:
  Forward:  store ALL activations (layers 1-32)
  Memory:   ████████████████████████████████  (high)

  Layer 1 → Layer 2 → ... → Layer 32 → Loss
  save a1    save a2          save a32

With Gradient Checkpointing:
  Forward:  store only SOME activations (every 4th layer)
  Memory:   ████████  (much lower, ~4× reduction)

  Layer 1 → Layer 2 → ... → Layer 32 → Loss
  save a1              save a8    save a16  ...

  Backward: recompute missing activations from checkpoints
  Cost: ~33% more compute, ~60-75% less activation memory
```

```python
import torch
from torch.utils.checkpoint import checkpoint

class TransformerBlock(torch.nn.Module):
    def __init__(self, d_model):
        super().__init__()
        self.attn = torch.nn.MultiheadAttention(d_model, 8)
        self.ffn = torch.nn.Sequential(
            torch.nn.Linear(d_model, 4 * d_model),
            torch.nn.GELU(),
            torch.nn.Linear(4 * d_model, d_model),
        )
        self.norm1 = torch.nn.LayerNorm(d_model)
        self.norm2 = torch.nn.LayerNorm(d_model)

    def forward(self, x):
        # With gradient checkpointing:
        x = x + checkpoint(self.attn, self.norm1(x), self.norm1(x), self.norm1(x),
                           use_reentrant=False)[0]
        x = x + checkpoint(self.ffn, self.norm2(x),
                           use_reentrant=False)
        return x
```

---

## Why Quantization Reduces Memory

Quantization maps high-precision values to lower-precision
representations. The key insight: model weights follow roughly normal
distributions, so you can represent them with fewer bits without
losing much quality.

```
Quantization: FP16 → INT4

Original weights (FP16):
  [0.0312, -0.0156, 0.0625, -0.0469, 0.0234, ...]
  Each value: 16 bits

Quantized weights (INT4):
  Step 1: Find scale = max(abs(weights)) / 7  (4-bit range: -8 to 7)
  Step 2: Round each weight to nearest integer
  [2, -1, 4, -3, 2, ...]
  Each value: 4 bits

  Memory reduction: 16 bits → 4 bits = 4× smaller

  Quality impact:
  ┌──────────────────────────────────────────┐
  │  FP32 → FP16:  negligible quality loss   │
  │  FP16 → INT8:  ~0.5% quality loss        │
  │  FP16 → INT4:  ~1-3% quality loss        │
  │  FP16 → INT2:  significant quality loss  │
  └──────────────────────────────────────────┘
```

---

## Quick Reference: Memory Estimation

```python
def estimate_training_memory_gb(
    params_billions,
    precision="fp16",
    optimizer="adam",
    batch_size=1,
    seq_len=2048,
    hidden_dim=4096,
    num_layers=32,
    gradient_checkpointing=False,
):
    """Estimate total GPU memory needed for training."""
    P = params_billions * 1e9

    # Parameter memory
    bytes_per_param = {"fp32": 4, "fp16": 2, "bf16": 2, "fp8": 1}[precision]
    param_mem = P * bytes_per_param

    # Gradient memory (same precision as params)
    grad_mem = P * bytes_per_param

    # Optimizer states
    if optimizer == "adam":
        # Momentum + variance in FP32, plus master weights in FP32
        opt_mem = P * (4 + 4 + 4)  # 12 bytes per param
    elif optimizer == "sgd":
        opt_mem = P * 4  # just momentum in FP32
    else:
        opt_mem = 0

    # Activation memory (rough estimate)
    # Each layer stores: attention scores + FFN intermediates
    act_per_layer = batch_size * seq_len * hidden_dim * bytes_per_param * 10
    if gradient_checkpointing:
        act_mem = act_per_layer * (num_layers ** 0.5)  # sqrt(layers)
    else:
        act_mem = act_per_layer * num_layers

    # CUDA overhead
    overhead = 1.5 * 1e9  # ~1.5 GB

    total = param_mem + grad_mem + opt_mem + act_mem + overhead
    return total / (1024**3)

# Examples
models = [
    ("7B",  7,  4096, 32),
    ("13B", 13, 5120, 40),
    ("70B", 70, 8192, 80),
]

print(f"{'Model':<8} {'No Ckpt (GB)':<15} {'With Ckpt (GB)':<15}")
print("-" * 40)
for name, params, hidden, layers in models:
    no_ckpt = estimate_training_memory_gb(params, num_layers=layers,
                                           hidden_dim=hidden)
    with_ckpt = estimate_training_memory_gb(params, num_layers=layers,
                                             hidden_dim=hidden,
                                             gradient_checkpointing=True)
    print(f"{name:<8} {no_ckpt:<15.1f} {with_ckpt:<15.1f}")
```

---

## Exercises

### Exercise 1: Will It Fit?

```
For each scenario, calculate if the model fits in GPU memory:

1. LLaMA-7B inference (FP16) on RTX 4090 (24 GB)
2. LLaMA-7B training (FP16 + Adam) on A100 (80 GB)
3. LLaMA-70B inference (INT4) on RTX 4090 (24 GB)
4. LLaMA-70B inference (FP16) on 4× A100 (320 GB total)
5. GPT-2 (124M) training (FP32 + Adam) on RTX 3060 (12 GB)
```

### Exercise 2: Memory Calculator

```python
def inference_memory_gb(params_billions, precision="fp16",
                         seq_len=2048, batch_size=1):
    """
    TODO: Calculate inference memory:
    - Parameter memory
    - KV cache (estimate as 2 * num_layers * d_model * seq_len * batch * bytes)
    - Overhead (~500 MB)

    Assume: num_layers ≈ params_billions * 4 (rough heuristic)
            d_model ≈ sqrt(params_billions * 1e9 / num_layers / 12)
    """
    pass

# Test with known models
print(inference_memory_gb(7))    # Should be ~14-16 GB for FP16
print(inference_memory_gb(7, "int4"))  # Should be ~4-5 GB
```

### Exercise 3: Precision Trade-offs

```python
import torch

# Create a simple model and compare precision formats
model_size = 1000  # small for demonstration

# TODO: Create random "weights" in FP32
# TODO: Convert to FP16, BF16, and simulate INT8 (round to nearest 1/128)
# TODO: Calculate the mean absolute error for each format vs FP32
# TODO: Calculate memory savings for each format
# TODO: Which format gives the best quality-per-byte?
```

---

Next: [Lesson 08: Multi-GPU and Distributed Compute](./08-multi-gpu-basics.md)
