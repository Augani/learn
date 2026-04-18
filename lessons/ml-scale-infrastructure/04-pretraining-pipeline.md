# Lesson 04: The Pre-Training Pipeline — From Raw Data to Base Model

Pre-training is where a language model learns language itself. It is the
most expensive, most compute-intensive, and most consequential phase of
building an LLM. This lesson walks through every stage of the pipeline,
from raw data to a base model that can complete text but does not yet
follow instructions.

---

## The Core Idea

Pre-training is like raising a child through immersion. You do not teach
the child grammar rules explicitly — you expose them to millions of
sentences, and they learn the patterns. A base model learns language the
same way: by predicting the next token, billions of times, across
trillions of tokens of text. The result is a model that "understands"
language but has no particular goal — it just completes text.

```
The Pre-Training Pipeline:

  ┌──────────────┐
  │  Raw Data     │  Common Crawl, books, code, etc.
  │  (petabytes)  │  (See Lesson 01)
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Data         │  Clean, filter, deduplicate, mix
  │  Preprocessing│  (See Lesson 01 & 08)
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Tokenizer    │  Train BPE tokenizer on the corpus
  │  Training     │  Build vocabulary (32K-128K tokens)
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Model        │  Choose architecture, set hyperparams
  │  Init         │  Initialize weights (careful!)
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Training     │  Next-token prediction on all data
  │  Loop         │  Weeks on thousands of GPUs
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Evaluation   │  Track loss, run benchmarks
  │  During       │  during training
  │  Training     │
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Base Model   │  Can complete text, not yet aligned
  │  Checkpoint   │  Ready for post-training
  └──────────────┘
```

---

## Stage 1: Data Preprocessing

This stage was covered in detail in
[Lesson 01: Training Data Pipelines](./01-training-data-pipelines.md).
The key outputs are:

- Clean, deduplicated text from multiple sources
- A defined data mix (e.g., 67% web, 15% code, 4.5% books, etc.)
- Text stored in a format ready for tokenization

The data preprocessing pipeline typically runs once and produces a
static dataset. Some teams re-run it with improved filters between
training runs.

---

## Stage 2: Tokenizer Training

The tokenizer converts raw text into integer token IDs. It is trained
on a representative sample of the training data before model training
begins.

```
Tokenizer Training Pipeline:

  Training corpus sample     BPE Algorithm        Vocabulary
  (~10-50 GB of text)        (merge rules)        (32K-128K tokens)

  "The cat sat"         →    Learn merges    →    {"Th": 100,
  "on the mat"               from frequency       "e": 101,
  "The dog ran"              of byte pairs        " cat": 102,
  ...                                             " sat": 103,
                                                  ...}

  Key decisions:
  ┌──────────────────────────────────────────────────┐
  │  Vocabulary size:                                │
  │    32K  — smaller model, less memory             │
  │    64K  — good balance (LLaMA 2)                 │
  │    128K — better for multilingual (GPT-4)        │
  │                                                  │
  │  Algorithm:                                      │
  │    BPE (Byte Pair Encoding) — most common        │
  │    Unigram — used by some models                 │
  │    WordPiece — used by BERT                      │
  │                                                  │
  │  Special tokens:                                 │
  │    <bos> — beginning of sequence                 │
  │    <eos> — end of sequence                       │
  │    <pad> — padding                               │
  │    <unk> — unknown (ideally never used with BPE) │
  └──────────────────────────────────────────────────┘
```

See [Track 8, Lesson 02: Tokenization](../llms-transformers/02-tokenization.md)
for the algorithmic details of BPE.

---

## Stage 3: Model Initialization

Before training starts, you must choose the architecture and initialize
the weights. Getting initialization wrong can cause training to diverge
immediately.

```
Architecture Decisions:

  ┌──────────────────────────────────────────────────┐
  │  Hyperparameter    │  7B Example  │  70B Example │
  ├────────────────────┼──────────────┼──────────────┤
  │  Layers            │  32          │  80          │
  │  Hidden dimension  │  4096        │  8192        │
  │  Attention heads   │  32          │  64          │
  │  KV heads (GQA)    │  32 or 8     │  8           │
  │  FFN dimension     │  11008       │  28672       │
  │  Vocabulary size   │  32000       │  32000       │
  │  Context length    │  4096        │  4096        │
  │  Normalization     │  RMSNorm     │  RMSNorm     │
  │  Activation        │  SwiGLU      │  SwiGLU      │
  │  Position encoding │  RoPE        │  RoPE        │
  └────────────────────┴──────────────┴──────────────┘
```

**Weight initialization** matters more than you might think:

```python
# Common initialization strategies for transformers

import torch
import torch.nn as nn
import math

def init_weights(module, n_layers):
    """
    Initialize transformer weights.
    Based on GPT-2 / LLaMA initialization strategies.
    """
    if isinstance(module, nn.Linear):
        # Standard normal, scaled by 1/sqrt(hidden_dim)
        std = 0.02
        torch.nn.init.normal_(module.weight, mean=0.0, std=std)
        if module.bias is not None:
            torch.nn.init.zeros_(module.bias)

    elif isinstance(module, nn.Embedding):
        torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)

    # Special: scale residual projections by 1/sqrt(2*n_layers)
    # This prevents the residual stream from growing too large
    # as it passes through many layers
```

**Why initialization matters:**
- Too large → gradients explode, loss goes to NaN
- Too small → gradients vanish, model does not learn
- The `1/sqrt(2*n_layers)` scaling for residual connections is critical for deep models

---

## Stage 4: The Training Loop

The core of pre-training is the next-token prediction loop. The model
sees a sequence of tokens and tries to predict each next token. The
loss is cross-entropy between the predicted distribution and the actual
next token.

```
Next-Token Prediction:

  Input tokens:    [The] [cat] [sat] [on] [the]
  Target tokens:   [cat] [sat] [on] [the] [mat]

  For each position, the model predicts a probability
  distribution over the entire vocabulary:

  Position 0: P("cat") = 0.02, P("dog") = 0.01, ...
  Position 1: P("sat") = 0.01, P("ran") = 0.008, ...
  ...

  Loss = -mean(log P(correct_token))

  ┌──────────────────────────────────────────────┐
  │  Training Step:                               │
  │                                               │
  │  1. Load batch of token sequences             │
  │  2. Forward pass: compute predictions         │
  │  3. Compute cross-entropy loss                │
  │  4. Backward pass: compute gradients          │
  │  5. All-reduce: average gradients across GPUs │
  │  6. Optimizer step: update weights            │
  │  7. Log metrics, maybe checkpoint             │
  │  8. Repeat                                    │
  └──────────────────────────────────────────────┘
```

**Key training hyperparameters:**

```
Training Hyperparameters (typical for 7B model):

  ┌──────────────────────────────────────────────────┐
  │  Hyperparameter        │  Typical Value           │
  ├────────────────────────┼──────────────────────────┤
  │  Batch size (tokens)   │  4M tokens               │
  │  Sequence length       │  4096 tokens             │
  │  Learning rate (peak)  │  3e-4                    │
  │  LR schedule           │  Cosine with warmup      │
  │  Warmup steps          │  2000                    │
  │  Weight decay          │  0.1                     │
  │  Gradient clipping     │  1.0                     │
  │  Optimizer             │  AdamW                   │
  │  Adam β1, β2           │  0.9, 0.95               │
  │  Precision             │  BF16 mixed precision    │
  │  Total steps           │  ~500K (for 2T tokens)   │
  └────────────────────────┴──────────────────────────┘
```

```python
# Simplified pre-training loop (pseudocode)
import torch

def pretrain_step(model, batch, optimizer, scaler):
    """One step of pre-training."""
    input_ids = batch['input_ids']        # [batch, seq_len]
    targets = batch['targets']            # [batch, seq_len]

    # Forward pass (mixed precision)
    with torch.cuda.amp.autocast(dtype=torch.bfloat16):
        logits = model(input_ids)         # [batch, seq_len, vocab]
        loss = torch.nn.functional.cross_entropy(
            logits.view(-1, logits.size(-1)),
            targets.view(-1),
            ignore_index=-100
        )

    # Backward pass
    loss.backward()

    # Gradient clipping
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

    # Optimizer step
    optimizer.step()
    optimizer.zero_grad()

    return loss.item()
```

---

## Stage 5: Learning Rate Schedule

The learning rate schedule is one of the most important hyperparameters.
Almost all modern LLM training uses **cosine decay with linear warmup**:

```
Learning Rate Schedule:

  LR
  │
  │     peak (3e-4)
  │    ╱╲
  │   ╱  ╲
  │  ╱    ╲
  │ ╱      ╲___
  │╱            ╲___
  │  warmup         ╲___
  │                      ╲___
  │                          ╲___  min (3e-5)
  └──────────────────────────────────→ Steps
  0   2K                          500K

  Warmup (0 → 2K steps):
    LR increases linearly from 0 to peak
    Prevents early instability

  Cosine decay (2K → 500K steps):
    LR decreases following a cosine curve
    Ends at ~10% of peak (min_lr)
```

```python
import math

def cosine_lr_schedule(step, warmup_steps, total_steps,
                       peak_lr, min_lr):
    """Cosine learning rate schedule with linear warmup."""
    if step < warmup_steps:
        # Linear warmup
        return peak_lr * step / warmup_steps
    elif step >= total_steps:
        return min_lr
    else:
        # Cosine decay
        progress = (step - warmup_steps) / (total_steps - warmup_steps)
        return min_lr + 0.5 * (peak_lr - min_lr) * (
            1 + math.cos(math.pi * progress)
        )
```

---

## Stage 6: Evaluation During Training

You do not wait until training is done to check if the model is
learning. Evaluation happens continuously:

```
Evaluation During Training:

  ┌──────────────────────────────────────────────────┐
  │  Metric              │  Frequency  │  Purpose     │
  ├──────────────────────┼─────────────┼──────────────┤
  │  Training loss       │  Every step │  Basic health│
  │  Validation loss     │  Every 1K   │  Overfitting │
  │  Perplexity          │  Every 1K   │  Quality     │
  │  Benchmark evals     │  Every 10K  │  Capability  │
  │  Generation samples  │  Every 10K  │  Qualitative │
  │  Gradient norm       │  Every step │  Stability   │
  │  Learning rate       │  Every step │  Schedule    │
  └──────────────────────┴─────────────┴──────────────┘

  Loss Curve (healthy training):

  Loss
  │
  │╲
  │ ╲
  │  ╲
  │   ╲
  │    ╲___
  │        ╲___
  │            ╲_____
  │                  ╲________
  │                           ╲___________
  └──────────────────────────────────────→ Steps

  Warning signs:
  - Loss spikes: may need to reduce LR or skip bad batch
  - Loss plateau: model may be too small for the data
  - Loss NaN: initialization or LR too high
  - Val loss increasing while train loss decreasing: overfitting
```

---

## Stage 7: Checkpoint Management

Training produces checkpoints — snapshots of the full training state.
Managing these checkpoints is critical:

```
Checkpoint Strategy:

  Training timeline:
  ──●────●────●────●────●────●────●────●──→
    C1   C2   C3   C4   C5   C6   C7   C8

  Keep policy:
  - Last 3 checkpoints always (for recovery)
  - Every 10th checkpoint permanently (for analysis)
  - Best validation loss checkpoint (for deployment)

  Storage requirements (7B model):
  - Each checkpoint: ~70 GB
  - 3 rolling + 5 permanent = ~560 GB
  - For 70B model: multiply by 10
```

---

## The Complete Timeline

Here is what a real pre-training run looks like end-to-end:

```
Pre-Training Timeline (7B model, 2T tokens, 256 H100s):

  Week -4 to -1: Data preparation
  ├── Collect and filter data
  ├── Train tokenizer
  ├── Tokenize full dataset
  └── Validate data pipeline

  Day 0: Launch
  ├── Initialize model
  ├── Verify distributed setup
  ├── Run 100 steps, check loss is decreasing
  └── Full speed training begins

  Day 1-3: Early training
  ├── Loss drops rapidly
  ├── Monitor for instabilities
  └── First benchmark evaluations

  Day 4-8: Main training
  ├── Loss decreases steadily
  ├── Regular checkpointing
  ├── Handle any hardware failures
  └── Periodic benchmark evaluations

  Day 9-10: Final phase
  ├── Learning rate approaching minimum
  ├── Loss curve flattening
  ├── Final evaluations
  └── Save final checkpoint

  Day 11+: Post-processing
  ├── Run full benchmark suite
  ├── Select best checkpoint
  └── Prepare for post-training (Lesson 05)
```

---

## Connection to ML

Pre-training is where all the foundational concepts come together:

- **Backpropagation** drives the learning. See [Track 7, Lesson 07](../ml-fundamentals/07-backpropagation.md).
- **Transformer architecture** defines the model. See [Track 8, Lesson 07](../llms-transformers/07-transformer-architecture.md).
- **Distributed training** makes it feasible. See [Lesson 03](./03-distributed-training-infra.md).
- **Scaling laws** determine the optimal configuration. See [Lesson 02](./02-compute-planning.md).

---

## Exercises

### Exercise 1: Training Step Calculation

```python
# A 7B model is trained with:
# - Batch size: 4M tokens
# - Total tokens: 2T
# - Sequence length: 4096

# TODO: How many training steps total?
# TODO: How many sequences per batch?
# TODO: If each step takes 2 seconds on 256 H100s,
#       how many days does training take?
```

### Exercise 2: Loss Curve Analysis

```python
# Given these training loss values at different steps:
steps =  [0,    1000,  5000,  10000, 50000, 100000, 200000, 500000]
losses = [11.2, 7.5,   5.8,   4.9,   3.8,   3.4,    3.1,    2.85]

# TODO: Plot the loss curve
# TODO: At what step does the loss improvement slow down?
# TODO: Estimate the loss at 1M steps (extrapolate)
# TODO: Is this model likely over-trained or under-trained
#       for its size? (Hint: check Chinchilla ratios)
```

### Exercise 3: Design a Pre-Training Config

Design a complete pre-training configuration for a 3B parameter model.
Specify:
- Architecture: layers, hidden dim, heads, FFN dim
- Training: batch size, learning rate, schedule, total tokens
- Infrastructure: GPU type, number of GPUs, parallelism strategy
- Estimate: total FLOPS, training time, cost

Use the formulas from [Lesson 02](./02-compute-planning.md) and the
GPU specs from [GPU & CUDA Fundamentals Reference](../gpu-cuda-fundamentals/reference-gpu-specs.md).

---

Next: [Lesson 05: The Post-Training Pipeline](./05-post-training-pipeline.md)
