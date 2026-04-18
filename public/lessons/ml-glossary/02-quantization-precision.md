# Lesson 02: Quantization and Precision — Making Models Fit

A 70B parameter model in full precision needs 280 GB of memory.
Most GPUs have 24–80 GB. Quantization is how we bridge that gap —
by using smaller numbers to represent the same model.

This lesson explains every precision format you will encounter and
what quantization actually does to a model.

---

## Numerical Precision Formats

### FP32 (32-bit Floating Point)

**Plain English:** The "full precision" format. Every number gets
32 bits (4 bytes) of storage. Maximum accuracy, maximum memory cost.

**Technical definition:** IEEE 754 single-precision float. 1 sign
bit, 8 exponent bits, 23 mantissa bits. Range: ±3.4 × 10³⁸.
Precision: ~7 decimal digits.

**Example:** Like writing a price as "$19.99" with full cents — you
get exact values but use more ink.

```
FP32 bit layout (32 bits total):

    ┌─┬──────────┬───────────────────────────┐
    │S│ Exponent │        Mantissa            │
    │1│  8 bits  │        23 bits             │
    └─┴──────────┴───────────────────────────┘

    Range:     ±3.4 × 10³⁸
    Precision: ~7 decimal digits
    Memory:    4 bytes per parameter
    7B model:  28 GB
```

---

### FP16 (16-bit Floating Point)

**Plain English:** Half the bits of FP32. Half the memory. Slightly
less precise, but good enough for most ML inference.

**Technical definition:** IEEE 754 half-precision float. 1 sign bit,
5 exponent bits, 10 mantissa bits. Range: ±65,504. Precision: ~3.3
decimal digits. Can underflow/overflow during training.

**Example:** Like rounding prices to the nearest dime — "$20.0"
instead of "$19.99." You lose a little detail but save half the space.

```
FP16 bit layout (16 bits total):

    ┌─┬───────┬──────────────┐
    │S│  Exp  │   Mantissa   │
    │1│ 5 bits│   10 bits    │
    └─┴───────┴──────────────┘

    Range:     ±65,504
    Precision: ~3.3 decimal digits
    Memory:    2 bytes per parameter
    7B model:  14 GB
```

---

### BF16 (Brain Floating Point 16)

**Plain English:** Google's alternative to FP16. Same memory cost,
but trades precision for range. Better for training because it
handles large gradients without overflowing.

**Technical definition:** 1 sign bit, 8 exponent bits, 7 mantissa
bits. Same exponent range as FP32 (±3.4 × 10³⁸) but with only
~2.4 decimal digits of precision. Developed by Google Brain for
TPU training.

**Example:** Like writing prices as "$20" instead of "$19.99" — you
can handle prices up to billions (wide range) but lose the cents
(less precision).

```
BF16 bit layout (16 bits total):

    ┌─┬──────────┬─────────┐
    │S│ Exponent │Mantissa │
    │1│  8 bits  │ 7 bits  │
    └─┴──────────┴─────────┘

    Range:     ±3.4 × 10³⁸ (same as FP32!)
    Precision: ~2.4 decimal digits
    Memory:    2 bytes per parameter
    7B model:  14 GB

    FP16 vs BF16:
    ┌──────────┬───────────────┬───────────────┐
    │          │     FP16      │     BF16      │
    ├──────────┼───────────────┼───────────────┤
    │ Range    │ ±65,504       │ ±3.4 × 10³⁸  │
    │ Precision│ ~3.3 digits   │ ~2.4 digits   │
    │ Training │ Needs scaling │ Works directly│
    │ Memory   │ 2 bytes       │ 2 bytes       │
    └──────────┴───────────────┴───────────────┘
```

**Cross-reference:** See [GPU & CUDA Fundamentals, Lesson 07: Memory Management for ML](../gpu-cuda-fundamentals/07-memory-estimation.md) for mixed-precision training details.

---

### INT8 (8-bit Integer)

**Plain English:** Stores each parameter as a whole number between
-128 and 127. One quarter the memory of FP32. Small quality loss
for most models.

**Technical definition:** 8-bit signed integer. Range: [-128, 127].
Requires a scale factor and zero-point to map floating-point values
to this range (affine quantization). Per-tensor or per-channel
scaling is common.

**Example:** Like rounding every price to the nearest dollar and
storing it as a small number. "$19.99" becomes "20." You lose cents
but save a lot of space.

```
INT8 quantization:

    Original FP32 weights: [0.023, -0.156, 0.891, -0.445, 0.012]

    Step 1: Find range → min=-0.445, max=0.891
    Step 2: Compute scale → scale = (0.891 - (-0.445)) / 255 ≈ 0.00524
    Step 3: Quantize → round(value / scale) + zero_point

    Quantized INT8:        [4, -30, 170, -85, 2]
    Dequantized:           [0.021, -0.157, 0.891, -0.445, 0.010]
    Error:                 [0.002, 0.001, 0.000, 0.000, 0.002]

    Memory: 1 byte per parameter
    7B model: 7 GB
```

---

### INT4 (4-bit Integer)

**Plain English:** Stores each parameter in just 4 bits — 16 possible
values. One eighth the memory of FP32. Some quality loss, but
surprisingly usable for inference.

**Technical definition:** 4-bit integer, typically unsigned [0, 15]
or signed [-8, 7]. Requires careful calibration. Usually quantized
per-group (e.g., groups of 128 weights share a scale factor) to
maintain quality. Common in GPTQ, AWQ, and GGUF formats.

**Example:** Like rating every restaurant on a 1–5 scale instead of
giving a detailed review. You lose nuance but can fit a lot more
ratings in the same space.

```
INT4 quantization:

    Only 16 possible values per parameter!

    ┌─────┐
    │4 bit│ = 0.5 bytes per parameter
    └─────┘

    Memory: 0.5 bytes per parameter
    7B model: 3.5 GB  (fits on a laptop GPU!)
    70B model: 35 GB  (fits on a single A100!)

    Quality impact (typical):
    ┌──────────┬──────────────┬───────────────┐
    │ Format   │ Memory (7B)  │ Quality loss  │
    ├──────────┼──────────────┼───────────────┤
    │ FP16     │ 14 GB        │ Baseline      │
    │ INT8     │ 7 GB         │ ~0.5% on MMLU │
    │ INT4     │ 3.5 GB       │ ~1-3% on MMLU │
    └──────────┴──────────────┴───────────────┘
```

---

### FP8 (8-bit Floating Point)

**Plain English:** A newer format that combines the compactness of
INT8 with the flexibility of floating point. Supported on H100 and
newer GPUs.

**Technical definition:** Two variants: E4M3 (4 exponent, 3 mantissa
bits) for forward pass and E5M2 (5 exponent, 2 mantissa bits) for
gradients. Defined in the FP8 standard (2022). Native hardware
support on NVIDIA H100 tensor cores.

**Example:** A compromise between INT8 and FP16 — like having a
flexible rating system that can handle both "3.5 stars" and "very
large/very small" values.

```
FP8 variants (8 bits total):

    E4M3 (for weights/activations):
    ┌─┬──────┬───────┐
    │S│ Exp  │ Mant  │
    │1│4 bits│3 bits │
    └─┴──────┴───────┘
    Range: ±448, Precision: ~2 digits

    E5M2 (for gradients):
    ┌─┬───────┬──────┐
    │S│  Exp  │ Mant │
    │1│5 bits │2 bits│
    └─┴───────┴──────┘
    Range: ±57,344, Precision: ~1.5 digits

    Memory: 1 byte per parameter (same as INT8)
    Advantage: no separate scale factor needed per group
```

**Cross-reference:** See [Advanced Deep Learning, Lesson 14: Quantization and Mixed Precision](../advanced-deep-learning/14-quantization-mixed-precision.md) for implementation details.

---

## What Quantization Actually Does

**Plain English:** Quantization converts a model's numbers from a
high-precision format (like FP32) to a lower-precision format (like
INT4). The model gets smaller and faster, with some loss in quality.

**Technical definition:** Quantization maps continuous floating-point
values to a discrete set of values representable in a lower bit-width
format. This involves choosing a scale factor (and optionally a
zero-point) that maps the floating-point range to the integer range.
The process introduces quantization error — the difference between
the original and dequantized values.

**Example:** Like converting a high-resolution photo to a thumbnail.
The image gets much smaller, and you lose some detail, but you can
still tell what it is.

```
The quantization pipeline:

    Original model (FP32, 28 GB for 7B)
         │
         ▼
    ┌─────────────────────┐
    │  Calibration        │  Run sample data through the model
    │  (optional)         │  to find the range of each layer's
    │                     │  weights and activations
    └─────────┬───────────┘
              │
              ▼
    ┌─────────────────────┐
    │  Quantize           │  Map FP32 values to INT8/INT4
    │                     │  using scale factors
    └─────────┬───────────┘
              │
              ▼
    Quantized model (INT4, 3.5 GB for 7B)
         │
         ▼
    ┌─────────────────────┐
    │  Inference           │  Dequantize on-the-fly during
    │                      │  computation (or use integer math)
    └──────────────────────┘
```

---

## How Quantization Affects Quality

```
Quality vs. size trade-off (typical for a 7B model):

    Quality (benchmark score)
    100% ┤ ████████████████████████  FP32 (28 GB)
     99% ┤ ███████████████████████   FP16 (14 GB)
     98% ┤ ██████████████████████    INT8 (7 GB)
     96% ┤ ████████████████████      INT4-group (3.5 GB)
     90% ┤ ██████████████            INT4-naive (3.5 GB)
     80% ┤ ██████████                INT2 (1.75 GB)
         └────────────────────────────────────────
          Smaller ◄──── Model Size ────► Larger

    Key insight: INT4 with group quantization (groups of 128)
    loses only 1-4% quality while using 8× less memory than FP32.
```

---

## Relationship to Hardware

Different GPU generations support different precision formats
natively in their tensor cores:

```
Hardware precision support:

    ┌──────────┬──────┬──────┬──────┬──────┬──────┐
    │ GPU      │ FP32 │ FP16 │ BF16 │ INT8 │ FP8  │
    ├──────────┼──────┼──────┼──────┼──────┼──────┤
    │ V100     │  ✓   │  ✓   │  ✗   │  ✗   │  ✗   │
    │ A100     │  ✓   │  ✓   │  ✓   │  ✓   │  ✗   │
    │ H100     │  ✓   │  ✓   │  ✓   │  ✓   │  ✓   │
    │ TPU v4   │  ✓   │  ✗   │  ✓   │  ✓   │  ✗   │
    │ Apple M2 │  ✓   │  ✓   │  ✗   │  ✗   │  ✗   │
    └──────────┴──────┴──────┴──────┴──────┴──────┘

    Tensor cores accelerate lower-precision math:
    H100 FP8 tensor core throughput: ~2× FP16 throughput
    A100 INT8 tensor core throughput: ~2× FP16 throughput
```

**Cross-reference:** See [GPU & CUDA Fundamentals, Lesson 06: ML Hardware Landscape](../gpu-cuda-fundamentals/06-ml-hardware-landscape.md) for full hardware comparison.

---

## Common Quantization Methods

```
Popular quantization approaches:

    ┌──────────┬────────────┬──────────────────────────────┐
    │ Method   │ Bit width  │ How it works                 │
    ├──────────┼────────────┼──────────────────────────────┤
    │ GPTQ     │ 4-bit      │ Layer-by-layer, uses         │
    │          │            │ calibration data             │
    ├──────────┼────────────┼──────────────────────────────┤
    │ AWQ      │ 4-bit      │ Protects "salient" weights   │
    │          │            │ that matter most             │
    ├──────────┼────────────┼──────────────────────────────┤
    │ GGUF     │ 2-8 bit    │ CPU-friendly format for      │
    │          │            │ llama.cpp                    │
    ├──────────┼────────────┼──────────────────────────────┤
    │ bitsand  │ 4/8-bit    │ Hugging Face integration,    │
    │ bytes    │            │ NF4 data type                │
    ├──────────┼────────────┼──────────────────────────────┤
    │ Dynamic  │ 8-bit      │ PyTorch built-in, no         │
    │ quant    │            │ calibration needed           │
    └──────────┴────────────┴──────────────────────────────┘
```

**Cross-reference:** See [Advanced LLM Engineering, Lesson 08: Model Quantization Advanced](../advanced-llm-engineering/08-model-quantization-advanced.md) for hands-on quantization.

---

## Concept Check Exercises

### Exercise 1: Size Reduction Calculation

```
Calculate the size reduction when quantizing from FP32 to INT4:

    Original model: 13B parameters in FP32
    a) Original size: 13B × ___ bytes = ___ GB
    b) INT4 size:     13B × ___ bytes = ___ GB
    c) Reduction factor: ___ / ___ = ___×
    d) Percentage saved: ____%

    Answers:
    a) 13 × 4 = 52 GB
    b) 13 × 0.5 = 6.5 GB
    c) 52 / 6.5 = 8×
    d) (52 - 6.5) / 52 × 100 = 87.5%
```

### Exercise 2: Will It Fit?

```
You have a GPU with 24 GB of memory (e.g., RTX 4090).
Which of these models can you load for inference?

    a) 7B model in FP32:   7 × 4 = ___ GB   → Fits? ___
    b) 7B model in FP16:   7 × 2 = ___ GB   → Fits? ___
    c) 13B model in INT8:  13 × 1 = ___ GB  → Fits? ___
    d) 13B model in INT4:  13 × 0.5 = ___ GB → Fits? ___
    e) 70B model in INT4:  70 × 0.5 = ___ GB → Fits? ___

    (Remember: you need some extra memory for activations
     during inference — roughly 1-2 GB overhead)
```

### Exercise 3: Precision Comparison

```
Fill in the table:

    ┌──────────┬───────┬───────────┬──────────┬──────────┐
    │ Format   │ Bits  │ Bytes/    │ 7B model │ 70B model│
    │          │       │ param     │ size     │ size     │
    ├──────────┼───────┼───────────┼──────────┼──────────┤
    │ FP32     │ 32    │ ___       │ ___ GB   │ ___ GB   │
    │ BF16     │ 16    │ ___       │ ___ GB   │ ___ GB   │
    │ INT8     │ 8     │ ___       │ ___ GB   │ ___ GB   │
    │ INT4     │ 4     │ ___       │ ___ GB   │ ___ GB   │
    │ FP8      │ 8     │ ___       │ ___ GB   │ ___ GB   │
    └──────────┴───────┴───────────┴──────────┴──────────┘
```

### Exercise 4: Quantization Error

```python
import numpy as np

# Simulate quantization
np.random.seed(42)
weights = np.random.randn(1000) * 0.1  # typical weight distribution

def quantize_int8(values):
    """Quantize float values to INT8 and back."""
    vmin, vmax = values.min(), values.max()
    scale = (vmax - vmin) / 255
    zero_point = round(-vmin / scale)
    quantized = np.clip(np.round(values / scale) + zero_point, 0, 255).astype(np.uint8)
    dequantized = (quantized.astype(float) - zero_point) * scale
    return dequantized

def quantize_int4(values):
    """Quantize float values to INT4 (16 levels) and back."""
    vmin, vmax = values.min(), values.max()
    scale = (vmax - vmin) / 15
    quantized = np.clip(np.round((values - vmin) / scale), 0, 15).astype(np.uint8)
    dequantized = quantized.astype(float) * scale + vmin
    return dequantized

# TODO: Compute the mean absolute error for INT8 and INT4 quantization
# TODO: What percentage of the original range does the error represent?
# TODO: Which quantization level would you choose for a chatbot? Why?
```

---

Next: [Lesson 03: Training Terminology](./03-training-terminology.md)
