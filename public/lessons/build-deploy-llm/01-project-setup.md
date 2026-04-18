# Lesson 01: Project Setup and Architecture

You are about to build a language model from scratch. Not fine-tune one.
Not download one. Build one — tokenizer, transformer, training loop,
deployment — all of it. This lesson sets up the project structure,
chooses the task, selects the dataset, and maps out the full system
architecture so you know exactly where you are headed.

---

## The Big Picture

Think of this project like building a car from parts. You would not
start welding without a blueprint. This lesson is the blueprint.

```
The Full System — What You Will Build:

  Raw Python Code
       │
       ▼
┌──────────────┐
│  TOKENIZER   │  Lesson 02: BPE from scratch
│  (BPE)       │  Turns text → token IDs
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  TRANSFORMER │  Lesson 03: Every component by hand
│  (Decoder)   │  Embeddings → Attention → FFN → Output
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  TRAINING    │  Lessons 04-05: Train on real data
│  LOOP        │  Loss, optimizer, scheduling, debugging
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  OPTIMIZE    │  Lesson 06: Quantization (INT8)
│  & EXPORT    │  Lesson 07: ONNX export
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│  DEPLOY                          │
│  ┌─────────┐    ┌──────────┐    │
│  │ Browser │    │ CLI Tool │    │  Lessons 08-09
│  │ (ONNX   │    │ (Python  │    │
│  │  Web)   │    │  pip pkg)│    │
│  └─────────┘    └──────────┘    │
└──────────────────────────────────┘
```

---

## Choosing the Task: Python Code Completion

We need a task that is:
- **Focused** — one clear input/output format
- **Practical** — something you would actually use
- **Small enough** — trainable on a single consumer GPU

Python code completion fits perfectly. Given partial Python code, the
model predicts what comes next.

```
Input:  "def fibonacci(n):\n    if n <= 1:\n        return"
Output: " n\n    return fibonacci(n-1) + fibonacci(n-2)"
```

Why not general English text? Code has stricter structure — indentation,
syntax rules, common patterns — which makes it easier for a small model
to learn something useful. A 10M parameter model writing English is
gibberish. A 10M parameter model completing Python can be surprisingly
decent.

---

## Dataset Selection

We will use a subset of Python code from publicly available sources.
The key requirements:

```
Dataset Requirements:
┌────────────────────────────────────────────┐
│  Size:     ~50-100MB of Python source code │
│  Format:   Plain .py files, one per line   │
│  Quality:  Deduplicated, syntax-valid      │
│  License:  Permissive (MIT, Apache, BSD)   │
└────────────────────────────────────────────┘
```

**Option A: CodeParrot-clean (recommended)**

A cleaned subset of Python code from GitHub. Already deduplicated and
filtered for quality.

```python
# Download a subset of Python code for training
# We will use a ~100MB sample — enough for our small model

import os
import json
import urllib.request

DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

# Option: Download from Hugging Face datasets (just the data, not the library)
# Or prepare your own dataset from local Python files

def collect_python_files(source_dir, output_file, max_mb=100):
    """Collect Python files into a single training file."""
    total_bytes = 0
    max_bytes = max_mb * 1024 * 1024

    with open(output_file, "w", encoding="utf-8") as out:
        for root, dirs, files in os.walk(source_dir):
            # Skip hidden directories and common non-source dirs
            dirs[:] = [d for d in dirs if not d.startswith(".")]

            for fname in files:
                if not fname.endswith(".py"):
                    continue

                filepath = os.path.join(root, fname)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()

                    # Basic quality filters
                    if len(content) < 50:       # Skip tiny files
                        continue
                    if len(content) > 100_000:  # Skip huge files
                        continue

                    # Write with file separator
                    out.write(content)
                    out.write("\n\n")

                    total_bytes += len(content.encode("utf-8"))
                    if total_bytes >= max_bytes:
                        print(f"Reached {max_mb}MB limit")
                        return

                except (UnicodeDecodeError, PermissionError):
                    continue

    print(f"Collected {total_bytes / 1024 / 1024:.1f}MB of Python code")


# Usage:
# collect_python_files("/path/to/python/repos", "data/train.txt", max_mb=100)
```

**Option B: Your own Python projects**

If you have a collection of Python repositories locally, use the
`collect_python_files` function above. This gives you a model trained
on code that looks like yours.

---

## Project Structure

```
mini-llm/
├── data/
│   ├── train.txt              # Training data (Python code)
│   └── val.txt                # Validation data (10% holdout)
│
├── tokenizer/
│   ├── __init__.py
│   ├── bpe.py                 # BPE tokenizer (Lesson 02)
│   └── vocab.json             # Learned vocabulary
│
├── model/
│   ├── __init__.py
│   ├── transformer.py         # Transformer architecture (Lesson 03)
│   ├── attention.py           # Multi-head attention
│   └── config.py              # Model configuration
│
├── training/
│   ├── __init__.py
│   ├── train.py               # Training loop (Lesson 04)
│   ├── dataset.py             # Data loading and batching
│   └── scheduler.py           # Learning rate scheduling
│
├── export/
│   ├── quantize.py            # Quantization (Lesson 06)
│   └── to_onnx.py             # ONNX export (Lesson 07)
│
├── deploy/
│   ├── browser/
│   │   ├── index.html         # Browser demo (Lesson 08)
│   │   ├── app.js
│   │   └── model/             # ONNX model files
│   │
│   └── cli/
│       ├── setup.py           # pip-installable package (Lesson 09)
│       ├── pyproject.toml
│       └── mini_llm_cli/
│           ├── __init__.py
│           ├── __main__.py
│           ├── generate.py
│           └── model/         # Model weights
│
├── checkpoints/               # Training checkpoints
├── logs/                      # Training logs
├── requirements.txt
└── README.md
```

---

## Model Configuration

Our model is deliberately small. The goal is to train it on a single
consumer GPU in a few hours, not to compete with GPT-4.

```python
# model/config.py

from dataclasses import dataclass


@dataclass
class MiniLLMConfig:
    """Configuration for our small transformer model."""

    # Vocabulary
    vocab_size: int = 8192          # BPE vocabulary size
    max_seq_len: int = 256          # Maximum sequence length (context window)

    # Architecture
    n_layers: int = 6               # Number of transformer layers
    n_heads: int = 8                # Number of attention heads
    d_model: int = 512              # Embedding dimension
    d_ff: int = 2048                # Feed-forward hidden dimension
    dropout: float = 0.1            # Dropout rate

    # Training
    batch_size: int = 32            # Sequences per batch
    learning_rate: float = 3e-4     # Peak learning rate
    warmup_steps: int = 500         # LR warmup steps
    max_steps: int = 50_000         # Total training steps
    grad_clip: float = 1.0          # Gradient clipping norm

    @property
    def n_params(self) -> int:
        """Estimate total parameter count."""
        # Embedding: vocab_size * d_model
        embed = self.vocab_size * self.d_model
        # Per layer: attention (4 * d_model^2) + FFN (2 * d_model * d_ff) + norms
        per_layer = 4 * self.d_model**2 + 2 * self.d_model * self.d_ff
        # Output projection: d_model * vocab_size (often tied with embedding)
        output = self.d_model * self.vocab_size
        total = embed + self.n_layers * per_layer + output
        return total


config = MiniLLMConfig()
print(f"Model parameters: {config.n_params:,}")
# Model parameters: ~15,000,000 (15M)
# Memory at FP32: ~60MB
# Memory at FP16: ~30MB
# Trainable on any GPU with 8GB+ VRAM
```

```
Model Size Breakdown:

┌─────────────────────────────────────────┐
│  Component          │  Parameters       │
├─────────────────────┼───────────────────┤
│  Token Embedding    │  8192 × 512 = 4M  │
│  Position Embedding │  256 × 512 = 131K │
│  6 Transformer Layers                   │
│    Attention (×6)   │  6 × 1M = 6M      │
│    FFN (×6)         │  6 × 2M = 12M     │
│    LayerNorm (×6)   │  6 × 1K = 6K      │
│  Output Projection  │  512 × 8192 = 4M  │
├─────────────────────┼───────────────────┤
│  TOTAL              │  ~15M parameters   │
│  FP32 size          │  ~60 MB            │
│  FP16 size          │  ~30 MB            │
│  INT8 size          │  ~15 MB            │
└─────────────────────────────────────────┘
```

---

## Development Environment Setup

```bash
# Create a virtual environment
python -m venv mini-llm-env
source mini-llm-env/bin/activate  # Linux/Mac
# mini-llm-env\Scripts\activate   # Windows

# Install dependencies
pip install torch torchvision torchaudio  # PyTorch with CUDA
pip install numpy matplotlib tqdm

# For deployment (install later when needed)
# pip install onnx onnxruntime
```

```python
# Verify your setup
import torch

print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")

if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_mem / 1024**3:.1f} GB")
else:
    print("WARNING: No GPU detected. Training will be very slow.")
    print("Consider using Google Colab or a cloud GPU provider.")
```

---

## Data Preparation

Split your collected Python code into training and validation sets:

```python
# prepare_data.py

import random


def prepare_data(input_file, train_file, val_file, val_ratio=0.1):
    """Split collected Python code into train/val sets."""
    with open(input_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Split on double newlines (file boundaries)
    chunks = content.split("\n\n")
    chunks = [c.strip() for c in chunks if len(c.strip()) > 50]

    # Shuffle and split
    random.seed(42)
    random.shuffle(chunks)

    split_idx = int(len(chunks) * (1 - val_ratio))
    train_chunks = chunks[:split_idx]
    val_chunks = chunks[split_idx:]

    with open(train_file, "w", encoding="utf-8") as f:
        f.write("\n\n".join(train_chunks))

    with open(val_file, "w", encoding="utf-8") as f:
        f.write("\n\n".join(val_chunks))

    print(f"Train: {len(train_chunks)} chunks, {sum(len(c) for c in train_chunks) / 1024 / 1024:.1f}MB")
    print(f"Val:   {len(val_chunks)} chunks, {sum(len(c) for c in val_chunks) / 1024 / 1024:.1f}MB")


prepare_data("data/raw.txt", "data/train.txt", "data/val.txt")
```

---

## Connection to Other Tracks

This project ties together concepts from across the curriculum:

| Concept | Where You Learned It | How We Use It Here |
|---------|---------------------|--------------------|
| Matrix multiplication | [Math Foundations Lesson 03](../math-foundations/03-matrix-multiplication.md) | Attention computation, linear layers |
| Gradients & chain rule | [Math Foundations Lessons 05-06](../math-foundations/05-derivatives-gradients.md) | Backpropagation during training |
| GPU memory | [GPU & CUDA Lesson 07](../gpu-cuda-fundamentals/07-memory-estimation.md) | Estimating VRAM for our model |
| Neural network training | [ML Fundamentals Lessons 07-08](../ml-fundamentals/07-backpropagation.md) | Training loop, loss, optimization |
| Transformer architecture | [LLMs & Transformers Lessons 05-08](../llms-transformers/05-self-attention.md) | The model we build from scratch |
| Tokenization | [LLMs & Transformers Lesson 02](../llms-transformers/02-tokenization.md) | BPE tokenizer we implement |

---

## Exercises

### Exercise 1: Set Up Your Project

Create the full project directory structure shown above. Initialize
each `__init__.py` as an empty file. Create `requirements.txt` with
the dependencies listed.

### Exercise 2: Collect Your Dataset

Use the `collect_python_files` function to gather at least 50MB of
Python source code. Run `prepare_data` to create your train/val split.
Report the number of chunks and total size for each split.

### Exercise 3: Verify the Config

Instantiate `MiniLLMConfig` and verify the parameter count. Calculate
by hand: how much GPU memory will this model need during training?
(Hint: training needs ~4× the model size for gradients and optimizer
states at FP32.)

---

Next: [Lesson 02: Building a Tokenizer from Scratch](./02-tokenizer-from-scratch.md)
