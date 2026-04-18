# Lesson 06: Model Optimization for Deployment

Your model is trained. It works. But at 60MB in FP32, it is too large
for comfortable browser deployment and slower than it needs to be.
This lesson shrinks the model using quantization and measures the
impact on both speed and quality.

For the theory behind quantization, see
[Advanced Deep Learning Lesson 14: Quantization and Mixed Precision](../advanced-deep-learning/14-quantization-mixed-precision.md)
and [Advanced LLM Engineering Lesson 08: Model Quantization Advanced](../advanced-llm-engineering/08-model-quantization-advanced.md).

---

## The Core Idea

Quantization is like reducing the resolution of a photograph. A 4K
image looks great but takes 24MB. A 720p version looks almost as good
and takes 2MB. For most uses, you cannot tell the difference.

```
Quantization — Reducing Numerical Precision:

  FP32 (32-bit float):
  ┌────────────────────────────────┐
  │ 1 bit sign │ 8 bits exp │ 23 bits mantissa │
  └────────────────────────────────┘
  Range: ±3.4 × 10^38, Precision: ~7 decimal digits
  Size per parameter: 4 bytes

  FP16 (16-bit float):
  ┌──────────────────┐
  │ 1 │ 5 │ 10 bits  │
  └──────────────────┘
  Size per parameter: 2 bytes (2× smaller)

  INT8 (8-bit integer):
  ┌──────────┐
  │ 8 bits   │
  └──────────┘
  Range: -128 to 127 (256 values)
  Size per parameter: 1 byte (4× smaller)

  Our model:
  ┌──────────────────────────────────────┐
  │  FP32:  15M params × 4 bytes = 60MB │
  │  FP16:  15M params × 2 bytes = 30MB │
  │  INT8:  15M params × 1 byte  = 15MB │
  └──────────────────────────────────────┘
```

---

## Dynamic Quantization with PyTorch

Dynamic quantization converts weights to INT8 at save time and
quantizes activations on-the-fly during inference. It is the simplest
form of quantization and works well for our use case.

```python
# export/quantize.py

import torch
import torch.quantization
import time
import os

from model.config import MiniLLMConfig
from model.transformer import MiniLLM
from tokenizer.bpe import BPETokenizer
from training.train import load_checkpoint


def quantize_model(checkpoint_path: str, output_path: str):
    """Apply dynamic quantization to the trained model."""
    device = torch.device("cpu")  # Quantization works on CPU

    # Load the trained model
    config = MiniLLMConfig()
    model, checkpoint = load_checkpoint(checkpoint_path, config, device)
    model.eval()

    print(f"Original model size: {get_model_size(model):.1f} MB")

    # Apply dynamic quantization
    # This quantizes Linear layers to INT8
    quantized_model = torch.quantization.quantize_dynamic(
        model,
        {torch.nn.Linear},  # Which layers to quantize
        dtype=torch.qint8,   # Target dtype
    )

    print(f"Quantized model size: {get_model_size(quantized_model):.1f} MB")

    # Save quantized model
    torch.save({
        "model_state_dict": quantized_model.state_dict(),
        "config": config,
    }, output_path)

    print(f"Saved quantized model to {output_path}")
    return quantized_model


def get_model_size(model) -> float:
    """Get model size in MB."""
    param_size = sum(p.nelement() * p.element_size() for p in model.parameters())
    buffer_size = sum(b.nelement() * b.element_size() for b in model.buffers())
    return (param_size + buffer_size) / 1024 / 1024
```

---

## Measuring Inference Latency

Speed matters for deployment. Let us measure how fast the model
generates tokens before and after quantization.

```python
# export/benchmark.py

import torch
import time


def benchmark_inference(model, tokenizer, prompt, n_tokens=50, n_runs=5):
    """Benchmark inference speed."""
    device = next(model.parameters()).device
    model.eval()

    token_ids = tokenizer.encode(prompt)

    # Warmup
    with torch.no_grad():
        model.generate(token_ids, max_new_tokens=10)

    # Benchmark
    times = []
    for _ in range(n_runs):
        t0 = time.perf_counter()
        with torch.no_grad():
            generated = model.generate(token_ids, max_new_tokens=n_tokens)
        t1 = time.perf_counter()
        times.append(t1 - t0)

    avg_time = sum(times) / len(times)
    tokens_per_sec = n_tokens / avg_time

    return {
        "avg_time_sec": avg_time,
        "tokens_per_sec": tokens_per_sec,
        "total_tokens": len(generated),
    }


def compare_models(original_model, quantized_model, tokenizer):
    """Compare original and quantized model performance."""
    prompt = "def fibonacci(n):\n"

    print("Benchmarking original model (FP32)...")
    orig_results = benchmark_inference(original_model, tokenizer, prompt)

    print("Benchmarking quantized model (INT8)...")
    quant_results = benchmark_inference(quantized_model, tokenizer, prompt)

    speedup = orig_results["avg_time_sec"] / quant_results["avg_time_sec"]

    print(f"\n{'Metric':<25} {'FP32':>12} {'INT8':>12} {'Change':>12}")
    print("-" * 65)
    print(f"{'Inference time (s)':<25} {orig_results['avg_time_sec']:>12.3f} "
          f"{quant_results['avg_time_sec']:>12.3f} {speedup:>11.1f}x")
    print(f"{'Tokens/sec':<25} {orig_results['tokens_per_sec']:>12.1f} "
          f"{quant_results['tokens_per_sec']:>12.1f}")
    print(f"{'Model size (MB)':<25} {get_model_size(original_model):>12.1f} "
          f"{get_model_size(quantized_model):>12.1f}")

    return orig_results, quant_results
```

```
Expected Benchmark Results (CPU inference):

  Metric                       FP32         INT8       Change
  -----------------------------------------------------------------
  Inference time (s)          2.340        1.170         2.0x
  Tokens/sec                   21.4         42.7
  Model size (MB)              57.0         16.2

  Note: Exact numbers depend on your CPU. The key takeaway
  is that INT8 is roughly 2× faster and 3.5× smaller.
```

---

## Comparing Generation Quality

Quantization should not noticeably degrade output quality for our
small model. Let us verify.

```python
# export/quality_check.py

def compare_generation_quality(original_model, quantized_model, tokenizer):
    """Compare generation quality between original and quantized models."""
    prompts = [
        "def fibonacci(n):\n",
        "class Stack:\n    def __init__(self):\n",
        "import os\n\ndef list_files(directory):\n",
        "# Binary search\ndef binary_search(arr, target):\n",
    ]

    print("Generation Quality Comparison")
    print("=" * 70)

    for prompt in prompts:
        token_ids = tokenizer.encode(prompt)

        with torch.no_grad():
            # Use same seed for fair comparison
            torch.manual_seed(42)
            orig_ids = original_model.generate(token_ids, max_new_tokens=80,
                                                temperature=0.7, top_k=40)
            torch.manual_seed(42)
            quant_ids = quantized_model.generate(token_ids, max_new_tokens=80,
                                                  temperature=0.7, top_k=40)

        orig_text = tokenizer.decode(orig_ids)
        quant_text = tokenizer.decode(quant_ids)

        print(f"\nPrompt: {prompt.strip()}")
        print(f"\n  FP32 output:")
        for line in orig_text.split("\n")[:8]:
            print(f"    {line}")
        print(f"\n  INT8 output:")
        for line in quant_text.split("\n")[:8]:
            print(f"    {line}")
        print("-" * 70)
```

```
Quality Comparison — What to Expect:

  For a 15M parameter model with INT8 quantization:
  ┌──────────────────────────────────────────────┐
  │  Outputs are usually identical or very close  │
  │                                               │
  │  Why? Small models have less redundancy,      │
  │  but INT8 still has 256 distinct values per   │
  │  weight — enough to preserve the learned      │
  │  patterns for a model this size.              │
  │                                               │
  │  If quality degrades noticeably:              │
  │  → Try quantizing only the FFN layers         │
  │  → Or use FP16 instead of INT8                │
  └──────────────────────────────────────────────┘
```

---

## Complete Optimization Script

```python
# run_optimization.py

import torch
from model.config import MiniLLMConfig
from model.transformer import MiniLLM
from tokenizer.bpe import BPETokenizer
from training.train import load_checkpoint
from export.quantize import quantize_model, get_model_size
from export.benchmark import compare_models


def main():
    device = torch.device("cpu")
    config = MiniLLMConfig()
    tokenizer = BPETokenizer.load("tokenizer/vocab.json")

    # Load original model
    print("Loading original model...")
    original_model, _ = load_checkpoint("checkpoints/best.pt", config, device)
    original_model.eval()

    # Quantize
    print("\nQuantizing model...")
    quantized_model = quantize_model("checkpoints/best.pt",
                                      "checkpoints/quantized.pt")

    # Compare performance
    print("\nComparing performance...")
    compare_models(original_model, quantized_model, tokenizer)

    # Compare quality
    from export.quality_check import compare_generation_quality
    print("\nComparing generation quality...")
    compare_generation_quality(original_model, quantized_model, tokenizer)

    print("\n✓ Optimization complete!")
    print(f"  Original:  {get_model_size(original_model):.1f} MB")
    print(f"  Quantized: {get_model_size(quantized_model):.1f} MB")
    print(f"  Reduction: {get_model_size(original_model) / get_model_size(quantized_model):.1f}x")


if __name__ == "__main__":
    main()
```

---

## Exercises

### Exercise 1: Quantize and Benchmark

Run the complete optimization script. Record:
- Model size before and after (in MB)
- Inference speed before and after (tokens/sec)
- Any noticeable quality differences

### Exercise 2: Selective Quantization

Modify the quantization to only quantize the feed-forward layers
(not the attention layers). Compare size and quality against full
quantization.

```python
# Hint: use a custom qconfig_mapping or manually quantize specific modules
quantized_model = torch.quantization.quantize_dynamic(
    model,
    {torch.nn.Linear},  # Try being more selective
    dtype=torch.qint8,
)
```

### Exercise 3: FP16 vs INT8

Compare three versions:
1. Original FP32
2. FP16 (half precision)
3. INT8 (dynamic quantization)

For each, measure size, speed, and generation quality on the same
prompts. Which gives the best trade-off?

```python
# FP16 conversion is simple:
fp16_model = model.half()  # Convert all parameters to FP16
```

---

Next: [Lesson 07: Exporting to ONNX](./07-export-onnx.md)
