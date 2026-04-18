# Lesson 07: Exporting to ONNX

Your model lives in PyTorch. But browsers do not run PyTorch. CLI tools
should not require CUDA. To deploy anywhere, you need a portable format.
ONNX (Open Neural Network Exchange) is that format — it captures your
model's computation graph in a way that any runtime can execute.

---

## The Core Idea

Think of ONNX like a PDF for models. You write a document in Word
(PyTorch), but you export it as PDF (ONNX) so anyone can open it —
regardless of what software they have.

```
ONNX Export Pipeline:

  PyTorch Model (.pt)
       │
       │  torch.onnx.export()
       │  Traces the computation graph
       ▼
  ONNX Model (.onnx)
       │
       ├──→ ONNX Runtime (Python, C++, Java)
       ├──→ ONNX Runtime Web (Browser, JavaScript)
       ├──→ TensorRT (NVIDIA GPU optimization)
       └──→ CoreML (Apple devices)

  One export, many runtimes.
```

---

## Step 1: Prepare the Model for Export

ONNX export traces your model's forward pass with example inputs.
We need to handle a few things first:

1. The model must be in eval mode
2. The generate function uses loops — ONNX cannot trace loops
3. We export only the forward pass (one step of generation)

```python
# export/to_onnx.py

import torch
import torch.onnx
import os

from model.config import MiniLLMConfig
from model.transformer import MiniLLM
from training.train import load_checkpoint


class MiniLLMForExport(torch.nn.Module):
    """Wrapper that makes the model ONNX-exportable.

    ONNX cannot trace the generate() loop, so we export only
    the forward pass: given token IDs, return logits.
    The generation loop will be implemented in the runtime
    (JavaScript for browser, Python for CLI).
    """

    def __init__(self, model: MiniLLM):
        super().__init__()
        self.model = model

    def forward(self, input_ids: torch.Tensor) -> torch.Tensor:
        """Single forward pass: token IDs → logits."""
        return self.model(input_ids)


def export_to_onnx(checkpoint_path: str, output_path: str,
                    seq_len: int = 256):
    """Export trained model to ONNX format."""
    device = torch.device("cpu")
    config = MiniLLMConfig()

    # Load model
    model, _ = load_checkpoint(checkpoint_path, config, device)
    model.eval()

    # Wrap for export
    export_model = MiniLLMForExport(model)
    export_model.eval()

    # Create example input
    # Shape: (batch_size=1, seq_len)
    example_input = torch.randint(0, config.vocab_size, (1, seq_len))

    # Export
    print(f"Exporting to ONNX: {output_path}")
    torch.onnx.export(
        export_model,
        example_input,
        output_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["input_ids"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch_size", 1: "sequence_length"},
            "logits": {0: "batch_size", 1: "sequence_length"},
        },
    )

    # Check file size
    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"ONNX model size: {size_mb:.1f} MB")

    return output_path
```

```
ONNX Export — What Happens:

  1. PyTorch traces the forward pass with example input
     → Records every operation (matmul, add, softmax, etc.)

  2. Builds a computation graph
     ┌──────────┐
     │ input_ids │
     └─────┬────┘
           │
     ┌─────▼────┐
     │ Embedding │
     └─────┬────┘
           │
     ┌─────▼────────┐
     │ Transformer   │ ×6 layers
     │ Block         │
     └─────┬────────┘
           │
     ┌─────▼────┐
     │ LayerNorm │
     └─────┬────┘
           │
     ┌─────▼────┐
     │ Linear   │
     └─────┬────┘
           │
     ┌─────▼────┐
     │ logits   │
     └──────────┘

  3. Saves graph + weights to .onnx file

  4. dynamic_axes allows variable batch size and
     sequence length at inference time
```

---

## Step 2: Verify the Export

Always verify that the ONNX model produces the same outputs as the
PyTorch model.

```python
# export/verify_onnx.py

import numpy as np
import onnxruntime as ort
import torch

from model.config import MiniLLMConfig
from model.transformer import MiniLLM
from training.train import load_checkpoint


def verify_onnx_export(checkpoint_path: str, onnx_path: str,
                        n_tests: int = 5, tolerance: float = 1e-4):
    """Verify ONNX model matches PyTorch model output."""
    device = torch.device("cpu")
    config = MiniLLMConfig()

    # Load PyTorch model
    model, _ = load_checkpoint(checkpoint_path, config, device)
    model.eval()

    # Load ONNX model
    session = ort.InferenceSession(onnx_path)

    print(f"Verifying ONNX export ({n_tests} tests)...")
    all_passed = True

    for i in range(n_tests):
        # Random input with varying sequence length
        seq_len = np.random.randint(10, config.max_seq_len)
        input_ids = torch.randint(0, config.vocab_size, (1, seq_len))

        # PyTorch output
        with torch.no_grad():
            pytorch_logits = model(input_ids).numpy()

        # ONNX output
        onnx_logits = session.run(
            ["logits"],
            {"input_ids": input_ids.numpy()},
        )[0]

        # Compare
        max_diff = np.max(np.abs(pytorch_logits - onnx_logits))
        passed = max_diff < tolerance

        status = "✓" if passed else "✗"
        print(f"  Test {i+1}: seq_len={seq_len:3d}, max_diff={max_diff:.6f} {status}")

        if not passed:
            all_passed = False

    if all_passed:
        print(f"\n✓ All {n_tests} tests passed (tolerance={tolerance})")
    else:
        print(f"\n✗ Some tests failed! Check model export.")

    return all_passed
```

---

## Step 3: Test Inference with ONNX Runtime

Now implement generation using ONNX Runtime instead of PyTorch:

```python
# export/onnx_generate.py

import numpy as np
import onnxruntime as ort


class ONNXGenerator:
    """Generate text using ONNX Runtime."""

    def __init__(self, onnx_path: str):
        self.session = ort.InferenceSession(onnx_path)

    def generate(self, token_ids: list[int], max_new_tokens: int = 100,
                 temperature: float = 0.8, top_k: int = 50) -> list[int]:
        """Autoregressive generation with ONNX Runtime."""
        tokens = list(token_ids)

        for _ in range(max_new_tokens):
            # Prepare input
            input_array = np.array([tokens], dtype=np.int64)

            # Run model
            logits = self.session.run(
                ["logits"],
                {"input_ids": input_array},
            )[0]

            # Get logits for last position
            next_logits = logits[0, -1, :] / temperature

            # Top-k filtering
            if top_k > 0:
                top_k_indices = np.argsort(next_logits)[-top_k:]
                mask = np.full_like(next_logits, -np.inf)
                mask[top_k_indices] = next_logits[top_k_indices]
                next_logits = mask

            # Softmax
            exp_logits = np.exp(next_logits - np.max(next_logits))
            probs = exp_logits / exp_logits.sum()

            # Sample
            next_token = np.random.choice(len(probs), p=probs)
            tokens.append(int(next_token))

        return tokens


# Usage:
# generator = ONNXGenerator("model.onnx")
# tokens = generator.generate(tokenizer.encode("def hello():"), max_new_tokens=50)
# print(tokenizer.decode(tokens))
```

---

## Troubleshooting Common Export Issues

```
Common ONNX Export Problems:

  ┌─────────────────────────────────────────────────────┐
  │  Problem: "Unsupported operator"                     │
  │  Cause:   Some PyTorch ops have no ONNX equivalent  │
  │  Fix:     Use opset_version=14 or higher             │
  │           Or rewrite the op using supported ops      │
  │                                                       │
  │  Problem: "Dynamic control flow"                     │
  │  Cause:   if/else or loops that depend on tensor     │
  │           values cannot be traced                     │
  │  Fix:     Move control flow outside the model        │
  │           (we did this with MiniLLMForExport)        │
  │                                                       │
  │  Problem: "Shape mismatch at inference"              │
  │  Cause:   Forgot to set dynamic_axes                 │
  │  Fix:     Add dynamic_axes for batch and seq dims    │
  │                                                       │
  │  Problem: "Large file size"                          │
  │  Cause:   Weights stored in FP32                     │
  │  Fix:     Quantize before export, or use             │
  │           onnxruntime quantization tools              │
  └─────────────────────────────────────────────────────┘
```

---

## Complete Export Script

```python
# run_export.py

from export.to_onnx import export_to_onnx
from export.verify_onnx import verify_onnx_export
from export.onnx_generate import ONNXGenerator
from tokenizer.bpe import BPETokenizer


def main():
    checkpoint_path = "checkpoints/best.pt"
    onnx_path = "deploy/model.onnx"

    # Step 1: Export
    export_to_onnx(checkpoint_path, onnx_path)

    # Step 2: Verify
    verify_onnx_export(checkpoint_path, onnx_path)

    # Step 3: Test generation
    tokenizer = BPETokenizer.load("tokenizer/vocab.json")
    generator = ONNXGenerator(onnx_path)

    prompt = "def fibonacci(n):\n"
    token_ids = tokenizer.encode(prompt)
    generated = generator.generate(token_ids, max_new_tokens=50)
    text = tokenizer.decode(generated)

    print(f"\nONNX Generation Test:")
    print(f"Prompt: {prompt}")
    print(f"Output:\n{text}")

    print("\n✓ ONNX export complete and verified!")


if __name__ == "__main__":
    main()
```

---

## Exercises

### Exercise 1: Export and Verify

Run the complete export script. Verify:
- ONNX file is created and smaller than the PyTorch checkpoint
- All verification tests pass with tolerance < 1e-4
- ONNX generation produces reasonable output

### Exercise 2: Quantized ONNX Export

Export the quantized model (from Lesson 06) to ONNX. Compare file
sizes:
- PyTorch FP32 checkpoint
- ONNX FP32 export
- ONNX from quantized model

### Exercise 3: Benchmark ONNX vs PyTorch

Compare inference speed between PyTorch (CPU) and ONNX Runtime (CPU)
for generating 50 tokens. Which is faster? By how much?

```python
import time

# PyTorch timing
t0 = time.perf_counter()
pytorch_output = model.generate(token_ids, max_new_tokens=50)
pytorch_time = time.perf_counter() - t0

# ONNX timing
t0 = time.perf_counter()
onnx_output = generator.generate(token_ids, max_new_tokens=50)
onnx_time = time.perf_counter() - t0

print(f"PyTorch: {pytorch_time:.3f}s")
print(f"ONNX:    {onnx_time:.3f}s")
print(f"Speedup: {pytorch_time / onnx_time:.1f}x")
```

---

Next: [Lesson 08: Browser Deployment](./08-browser-deployment.md)
