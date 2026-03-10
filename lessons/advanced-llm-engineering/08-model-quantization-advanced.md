# Lesson 08: Advanced Model Quantization — Shrinking Models Without Losing Their Minds

Quantization is like compressing a high-resolution photo to JPEG. You
lose some detail, but the image is still recognizable — and it takes up
a fraction of the storage. A 70B parameter model in bf16 needs 140 GB
of memory. Quantize it to 4-bit and it fits in 35 GB — running on a
single GPU instead of four.

This lesson goes beyond the basics of "use 4-bit." We cover the
algorithms that determine which bits to keep, how to measure what you
lose, and when to push quantization further or pull back.

---

## Quantization Fundamentals

### The Core Idea

Map continuous floating-point values to a smaller set of discrete
values. The fewer bits, the fewer possible values, the more information
you lose.

```
bf16 (16 bits):  65,536 possible values per weight
int8 (8 bits):   256 possible values per weight
int4 (4 bits):   16 possible values per weight
int3 (3 bits):   8 possible values per weight
int2 (2 bits):   4 possible values per weight

Model size:
  bf16:  2 bytes/param  → 70B model = 140 GB
  int8:  1 byte/param   → 70B model = 70 GB
  int4:  0.5 byte/param → 70B model = 35 GB
  int3:  0.375 byte     → 70B model = 26 GB
```

### Symmetric vs Asymmetric Quantization

```
Symmetric (zero-centered):
  quantized = round(value / scale)
  dequantized = quantized × scale

  scale = max(abs(values)) / (2^(bits-1) - 1)

  Example (int8, values range -1.0 to 1.0):
    scale = 1.0 / 127
    value 0.5 → round(0.5 / 0.00787) = round(63.5) = 64
    dequant: 64 × 0.00787 = 0.504  (error: 0.004)

Asymmetric (arbitrary range):
  quantized = round((value - zero_point) / scale)
  dequantized = quantized × scale + zero_point

  Handles non-zero-centered distributions better.
  Costs one extra parameter (zero_point) per group.
```

### Granularity: Per-Tensor vs Per-Channel vs Per-Group

```
Per-tensor: One scale for the entire weight matrix
  [████████████████████████] → 1 scale value
  Cheapest, least accurate

Per-channel: One scale per output channel (row)
  [████████]  → scale 1
  [████████]  → scale 2
  [████████]  → scale 3
  Better accuracy, small overhead

Per-group: One scale per group of G weights
  [████][████]  → scale 1, scale 2
  [████][████]  → scale 3, scale 4
  Best accuracy, most overhead. G=128 is common.
```

---

## GPTQ: The Pioneer

GPTQ (GPT Quantization) was the first method to make 4-bit LLM
quantization practical. It is based on Optimal Brain Quantization —
quantizing weights one at a time and adjusting remaining weights to
compensate for the error.

### How GPTQ Works

```
For each column of the weight matrix:
  1. Quantize this column to int4
  2. Calculate the error introduced
  3. Spread that error across remaining (not yet quantized) columns
  4. Use the inverse Hessian to determine optimal error distribution

This is like a row of dominoes — when you "break" one weight by
quantizing it, you adjust its neighbors to absorb the damage.
```

```python
# Simplified GPTQ algorithm (conceptual)
import torch

def gptq_quantize_layer(weight, hessian_inv, bits=4):
    """
    weight: (out_features, in_features) — the weight matrix
    hessian_inv: inverse of the Hessian (X^T X)^{-1}
    """
    rows, cols = weight.shape
    quantized = torch.zeros_like(weight)
    group_size = 128

    for col_start in range(0, cols, group_size):
        col_end = min(col_start + group_size, cols)

        for col in range(col_start, col_end):
            w = weight[:, col].clone()

            # find scale for this group
            max_val = w.abs().max()
            scale = max_val / (2 ** (bits - 1) - 1)

            # quantize
            q = torch.clamp(
                torch.round(w / scale),
                -(2 ** (bits - 1)),
                2 ** (bits - 1) - 1,
            )
            quantized[:, col] = q

            # compute error
            error = w - q * scale

            # spread error to remaining columns using Hessian
            if col + 1 < cols:
                h_diag = hessian_inv[col, col]
                update = error.unsqueeze(1) * hessian_inv[col, col + 1:].unsqueeze(0) / h_diag
                weight[:, col + 1:] -= update

    return quantized, scale
```

### Using GPTQ in Practice

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, GPTQConfig

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3-70B")

quantization_config = GPTQConfig(
    bits=4,
    group_size=128,
    dataset="c4",  # calibration dataset
    desc_act=True,  # quantize in order of activation magnitude
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3-70B",
    quantization_config=quantization_config,
    device_map="auto",
)
model.save_pretrained("Llama-3-70B-GPTQ-4bit")
```

GPTQ requires a calibration dataset (typically 128-1024 samples) to
compute the Hessian. The calibration data should be representative
of the model's typical input.

---

## AWQ: Activation-Aware Weight Quantization

AWQ's key insight: not all weights are equally important. Some weights
correspond to channels that produce large activations — quantization
errors in these weights have an outsized impact on output quality.

```
Standard quantization:
  Treat all weights equally → uniform quantization error

AWQ observation:
  1% of weight channels produce 50%+ of the activation magnitude.
  Protecting these channels from quantization error has a huge impact.

AWQ strategy:
  Don't skip channels — instead, scale them up before quantization
  so they get more of the quantization grid's resolution.
```

```
Example (int4, 16 possible values):

Without AWQ:
  Important weight: 0.847 → quantize → 0.857  (error: 0.010)
  Regular weight:   0.123 → quantize → 0.143  (error: 0.020)

With AWQ (scale important channel by 4x):
  Important weight: 0.847 × 4 = 3.388 → quantize → 3.429 → /4 = 0.857
  (error: 0.010... but now spread over more quant levels in the important range)

  The scale factor gives important weights finer resolution.
```

```python
from awq import AutoAWQForCausalLM
from transformers import AutoTokenizer

model = AutoAWQForCausalLM.from_pretrained(
    "meta-llama/Llama-3-70B",
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3-70B")

quant_config = {
    "zero_point": True,
    "q_group_size": 128,
    "w_bit": 4,
    "version": "GEMM",
}

model.quantize(
    tokenizer,
    quant_config=quant_config,
    calib_data="pileval",
)
model.save_quantized("Llama-3-70B-AWQ-4bit")
```

### AWQ vs GPTQ

```
                GPTQ                AWQ
────────────────────────────────────────────────────
Method          Error compensation   Activation-aware scaling
Calibration     128-1024 samples     128-256 samples
Speed           Slower to quantize   Faster to quantize
Inference       Requires custom      Standard int4 kernels
                GPTQ kernels
Quality (4-bit) Good                 Slightly better
Quality (3-bit) Degrades             More robust
```

AWQ generally produces slightly better quality at the same bit width,
and it is faster to quantize. GPTQ was first and has broader
compatibility.

---

## GGUF: The Llama.cpp Format

GGUF is the quantization format used by llama.cpp and its ecosystem
(Ollama, LM Studio, etc.). It supports a wider range of quantization
schemes than GPTQ or AWQ.

```
GGUF quantization types:

Name    Bits/weight   Method              Quality
──────────────────────────────────────────────────────
Q2_K    2.5           K-quant, mixed      Poor
Q3_K_S  3.4           K-quant, small      Usable
Q3_K_M  3.9           K-quant, medium     Decent
Q4_0    4.5           Simple round        Good
Q4_K_M  4.8           K-quant, medium     Very good
Q5_K_M  5.7           K-quant, medium     Near-lossless
Q6_K    6.6           K-quant             Near-lossless
Q8_0    8.5           Simple round        Lossless (practically)

"K-quant" = different layers get different bit widths based on
importance. More bits for important layers, fewer for unimportant ones.
```

```bash
# Quantize using llama.cpp
./quantize \
  model-f16.gguf \
  model-Q4_K_M.gguf \
  Q4_K_M

# This produces a single file that includes the model and tokenizer.
# Run it directly:
./main -m model-Q4_K_M.gguf -p "Hello, world" -n 128
```

### GGUF's K-Quant Strategy

K-quant assigns different bit widths to different layers based on
their sensitivity to quantization:

```
Layer importance analysis:

Attention layers:
  Q, K projections: HIGH importance (affect attention patterns)
  V, O projections: MEDIUM importance

FFN layers:
  Gate, Up projections: MEDIUM importance
  Down projection: LOW importance

First/last layers: HIGH importance (initial/final representations)
Middle layers: LOWER importance

K-quant example (Q4_K_M for 7B model):
  Important layers: 6-bit quantization
  Regular layers: 4-bit quantization
  Unimportant layers: 4-bit with less overhead
  Average: ~4.8 bits per weight
```

---

## Calibration Strategies

All post-training quantization methods need calibration data to
measure weight importance or compute error corrections.

### What Makes Good Calibration Data?

```
Good calibration data:
  ✓ Representative of deployment use case
  ✓ 128-1024 diverse samples
  ✓ Mix of long and short sequences
  ✓ Covers the model's vocabulary well

Bad calibration data:
  ✗ Random noise or lorem ipsum
  ✗ Only one language when model is multilingual
  ✗ Only one domain when model is general-purpose
  ✗ Too few samples (<32)
```

```python
from datasets import load_dataset

def prepare_calibration_data(tokenizer, num_samples=256, seq_len=2048):
    dataset = load_dataset("allenai/c4", "en", split="validation", streaming=True)

    calibration_data = []
    for sample in dataset:
        tokenized = tokenizer(
            sample["text"],
            truncation=True,
            max_length=seq_len,
            return_tensors="pt",
        )
        if tokenized["input_ids"].shape[1] >= seq_len // 2:
            calibration_data.append(tokenized["input_ids"])

        if len(calibration_data) >= num_samples:
            break

    return calibration_data
```

### Calibration for Domain-Specific Models

If you are quantizing a medical model, calibrate on medical text.
If you are quantizing a code model, calibrate on code. Mismatched
calibration data can increase quantization error by 2-3x.

---

## Mixed-Precision Inference

Not every layer needs the same precision. Sensitive layers get more
bits, insensitive layers get fewer. This is formalized in mixed-precision
quantization.

```
Sensitivity analysis workflow:

1. Quantize each layer independently to target bit width
2. Measure perplexity change for each layer
3. Rank layers by sensitivity
4. Allocate bits: more bits to sensitive layers, fewer to others

Example result for a 7B model (target: average 4 bits):

Layer 0  (embed):  8-bit  ← very sensitive
Layer 1-3:         6-bit  ← early layers sensitive
Layer 4-25:        4-bit  ← bulk of the model
Layer 26-30:       4-bit
Layer 31 (head):   8-bit  ← output layer sensitive
Average: 4.3 bits
```

```python
def sensitivity_analysis(model, calibration_data, target_bits=4):
    baseline_ppl = evaluate_perplexity(model, calibration_data)
    sensitivities = {}

    for name, module in model.named_modules():
        if not isinstance(module, nn.Linear):
            continue

        original_weight = module.weight.data.clone()
        module.weight.data = quantize_dequantize(module.weight.data, target_bits)
        quantized_ppl = evaluate_perplexity(model, calibration_data)
        module.weight.data = original_weight

        sensitivities[name] = quantized_ppl - baseline_ppl
        print(f"{name}: +{sensitivities[name]:.4f} perplexity")

    return sensitivities
```

---

## Quality Degradation Measurement

How do you know if your quantized model is still good enough?

### Perplexity

The standard metric. Lower is better. Measure on a held-out dataset.

```
Typical perplexity changes (Llama 3 8B on WikiText-2):

Precision    Perplexity    Change from bf16
─────────────────────────────────────────────
bf16         6.14          baseline
int8         6.15          +0.01 (negligible)
int4 (GPTQ)  6.28          +0.14 (small)
int4 (AWQ)   6.22          +0.08 (small)
int3 (GPTQ)  6.95          +0.81 (noticeable)
int2          9.40          +3.26 (significant)
```

### Task-Specific Evaluation

Perplexity does not tell the whole story. Always evaluate on your
actual use case:

```python
def compare_quantized_quality(original_model, quantized_model, test_prompts):
    results = {"match": 0, "total": 0, "original_scores": [], "quantized_scores": []}

    for prompt in test_prompts:
        orig_output = generate(original_model, prompt, temperature=0)
        quant_output = generate(quantized_model, prompt, temperature=0)

        results["total"] += 1
        if orig_output == quant_output:
            results["match"] += 1

        orig_score = evaluate_quality(orig_output)  # task-specific metric
        quant_score = evaluate_quality(quant_output)
        results["original_scores"].append(orig_score)
        results["quantized_scores"].append(quant_score)

    match_rate = results["match"] / results["total"]
    avg_orig = sum(results["original_scores"]) / len(results["original_scores"])
    avg_quant = sum(results["quantized_scores"]) / len(results["quantized_scores"])

    print(f"Exact match rate: {match_rate:.2%}")
    print(f"Original avg score: {avg_orig:.4f}")
    print(f"Quantized avg score: {avg_quant:.4f}")
    print(f"Quality retention: {avg_quant/avg_orig:.2%}")
```

---

## Quantization-Aware Training (QAT)

Post-training quantization (PTQ) quantizes after training. QAT
simulates quantization during training so the model learns to be
robust to it.

```
PTQ: Train in fp32 → Quantize to int4 → Hope it works
QAT: Train in fp32 with fake quantization → Real quantize to int4 → Better quality
```

```python
import torch

class FakeQuantize(torch.autograd.Function):
    @staticmethod
    def forward(ctx, x, scale, bits):
        qmin = -(2 ** (bits - 1))
        qmax = 2 ** (bits - 1) - 1
        x_q = torch.clamp(torch.round(x / scale), qmin, qmax)
        x_deq = x_q * scale
        return x_deq

    @staticmethod
    def backward(ctx, grad_output):
        # Straight-through estimator: gradients pass through unchanged
        return grad_output, None, None


class QATLinear(nn.Module):
    def __init__(self, in_features, out_features, bits=4):
        super().__init__()
        self.linear = nn.Linear(in_features, out_features)
        self.bits = bits
        self.scale = nn.Parameter(torch.ones(1))

    def forward(self, x):
        fake_q_weight = FakeQuantize.apply(
            self.linear.weight, self.scale, self.bits
        )
        return nn.functional.linear(x, fake_q_weight, self.linear.bias)
```

QAT produces better quality at the same bit width but requires
retraining. For large models, this is often done during fine-tuning
rather than pre-training.

---

## Practical Decision Framework

```
When to use which method:

Need                           Method           Bits
──────────────────────────────────────────────────────────
Quick experimentation          GGUF Q4_K_M       ~4.8
Production serving (GPU)       AWQ 4-bit         4
Production serving (GPU)       GPTQ 4-bit        4
Maximum compression (GPU)      AWQ/GPTQ 3-bit    3
CPU/laptop inference           GGUF Q4_K_M       ~4.8
Best quality at 4-bit          QAT               4
Memory-constrained edge        GGUF Q2_K         ~2.5
Near-lossless                  int8 (bitsandbytes) 8

Quality priority: QAT > AWQ ≈ GPTQ > GGUF K-quant > simple round-to-nearest
Speed priority:   AWQ ≈ GPTQ (GPU kernels) > GGUF (CPU optimized)
```

---

## Key Takeaways

1. **4-bit quantization is production-ready.** AWQ and GPTQ produce
   models with <1% quality loss on most tasks. This is a 4x memory
   reduction for free.

2. **Calibration data matters.** Use data representative of your
   deployment use case. Mismatched calibration = worse quality.

3. **AWQ is slightly better than GPTQ** in most benchmarks, and faster
   to quantize. GPTQ has wider ecosystem support.

4. **GGUF is best for CPU/edge.** K-quant's mixed precision approach
   gives excellent quality for its compression ratio.

5. **QAT beats PTQ at the same bit width** but requires retraining.
   Worth it if you are pushing to 3 bits or lower.

6. **Always measure on your task.** Perplexity is a rough guide.
   Evaluate the quantized model on your actual use case before
   deploying.

---

## Exercises

1. **Quantize and compare.** Take Llama 3 8B. Quantize with GPTQ
   4-bit, AWQ 4-bit, and GGUF Q4_K_M. Measure perplexity on
   WikiText-2 and inference speed on 100 diverse prompts.

2. **Sensitivity analysis.** For a 7B model, quantize each layer
   independently and measure perplexity impact. Which layers are
   most sensitive? Does this match the theoretical expectation?

3. **Push the limits.** Quantize a model to 3-bit and 2-bit. At what
   point does it become unusable for your task? Compare PTQ vs QAT
   at these extreme compression levels.
