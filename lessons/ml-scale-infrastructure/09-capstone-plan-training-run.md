# Lesson 09: Capstone — Plan a Training Run

This is the capstone exercise for the Scale & Infrastructure track. You
will plan a complete training run for a hypothetical 3B parameter
language model, applying everything you have learned across all nine
lessons. By the end, you will have a detailed training plan that covers
data, compute, infrastructure, cost, and evaluation.

---

## The Scenario

You are the ML lead at a startup. Your team has been tasked with
training a 3B parameter language model optimized for code generation.
The model should be competitive with similar-sized open models on
coding benchmarks (HumanEval, MBPP) while being cost-effective to
train and serve.

Your constraints:
- **Budget:** $100,000 for GPU compute
- **Timeline:** Must complete training within 4 weeks
- **Hardware access:** Cloud GPUs (H100s at $3.50/GPU-hour)
- **Team:** 3 ML engineers
- **Target:** Competitive HumanEval pass@1 score for a 3B model

```
Your Mission:

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  Design a complete training plan:                │
  │                                                  │
  │  1. Architecture     → How big, what shape?      │
  │  2. Data pipeline    → What data, how much?      │
  │  3. Compute plan     → How many GPUs, how long?  │
  │  4. Infrastructure   → What parallelism strategy? │
  │  5. Cost estimate    → Will it fit the budget?   │
  │  6. Training config  → Hyperparameters?          │
  │  7. Evaluation plan  → How to measure success?   │
  │  8. Risk mitigation  → What could go wrong?      │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

---

## Part 1: Architecture Design

Design the model architecture. A 3B parameter transformer needs
specific dimensions to hit the target parameter count.

```
Architecture Worksheet:

  Target: ~3B parameters

  Parameter count formula (decoder-only transformer):
  P ≈ 12 × L × d² + V × d

  Where:
    L = number of layers
    d = hidden dimension
    V = vocabulary size

  ┌──────────────────────────────────────────────────┐
  │  Hyperparameter    │  Your Choice  │  Reasoning  │
  ├────────────────────┼───────────────┼─────────────┤
  │  Layers (L)        │  ___          │             │
  │  Hidden dim (d)    │  ___          │             │
  │  Attention heads   │  ___          │             │
  │  KV heads (GQA)    │  ___          │             │
  │  FFN multiplier    │  ___          │             │
  │  Vocabulary size   │  ___          │             │
  │  Context length    │  ___          │             │
  │  Normalization     │  ___          │             │
  │  Activation        │  ___          │             │
  │  Position encoding │  ___          │             │
  └────────────────────┴───────────────┴─────────────┘
```

```python
# Verify your parameter count
def count_parameters(layers, hidden_dim, ffn_dim, vocab_size,
                     num_heads, num_kv_heads):
    """
    Count parameters in a decoder-only transformer.
    """
    head_dim = hidden_dim // num_heads

    # Per layer:
    # Attention: Q, K, V projections + output projection
    attn_q = hidden_dim * hidden_dim          # Q projection
    attn_k = hidden_dim * (num_kv_heads * head_dim)  # K (GQA)
    attn_v = hidden_dim * (num_kv_heads * head_dim)  # V (GQA)
    attn_o = hidden_dim * hidden_dim          # Output projection
    attn_total = attn_q + attn_k + attn_v + attn_o

    # FFN (SwiGLU has 3 weight matrices)
    ffn_total = 3 * hidden_dim * ffn_dim

    # Layer norms (2 per layer)
    norm_total = 2 * hidden_dim

    per_layer = attn_total + ffn_total + norm_total

    # Embedding + final layer norm + output head
    embedding = vocab_size * hidden_dim
    final_norm = hidden_dim
    # Output head often shares weights with embedding
    output_head = 0  # Tied weights

    total = layers * per_layer + embedding + final_norm + output_head
    return total

# TODO: Fill in your architecture choices and verify ~3B params
# Example starting point:
params = count_parameters(
    layers=26,
    hidden_dim=2560,
    ffn_dim=6912,       # ~2.7× hidden_dim for SwiGLU
    vocab_size=32000,
    num_heads=20,
    num_kv_heads=4       # GQA with 4 KV heads
)
print(f"Total parameters: {params/1e9:.2f}B")
```

---

## Part 2: Data Pipeline Design

Design the training data pipeline for a code-focused model.

```
Data Pipeline Worksheet:

  ┌──────────────────────────────────────────────────┐
  │  Data Source       │  %    │  Size   │  Quality  │
  ├────────────────────┼───────┼─────────┼───────────┤
  │  GitHub code       │  ___  │  ___    │           │
  │  Web text          │  ___  │  ___    │           │
  │  Stack Overflow    │  ___  │  ___    │           │
  │  Documentation     │  ___  │  ___    │           │
  │  Wikipedia         │  ___  │  ___    │           │
  │  Books             │  ___  │  ___    │           │
  │  (other)           │  ___  │  ___    │           │
  └────────────────────┴───────┴─────────┴───────────┘

  Questions to answer:
  1. How many total tokens will you train on?
     (Chinchilla says 60B, but over-training is common)
  2. What languages will you include in the code data?
  3. How will you filter low-quality code?
  4. What deduplication strategy will you use?
  5. How will you handle PII in code (API keys, passwords)?
```

Reference: [Lesson 01: Training Data Pipelines](./01-training-data-pipelines.md)
and [Lesson 08: Data Quality and Curation](./08-data-quality-curation.md).

---

## Part 3: Compute Planning

Calculate the compute requirements and verify they fit your budget.

```python
# Compute Planning Worksheet

num_params = 3e9          # Your 3B model
num_tokens = ___          # Your choice from Part 2

# Step 1: Total FLOPS
total_flops = 6 * num_params * num_tokens
print(f"Total FLOPS: {total_flops:.2e}")

# Step 2: GPU-hours
gpu_flops = 990e12        # H100 BF16 peak
mfu = 0.40                # Realistic MFU
effective_flops = gpu_flops * mfu
gpu_hours = total_flops / (effective_flops * 3600)
print(f"GPU-hours: {gpu_hours:,.0f}")

# Step 3: Cost check
cost_per_hour = 3.50
raw_cost = gpu_hours * cost_per_hour
overhead = 1.3            # 30% overhead for failures, tuning
total_cost = raw_cost * overhead
print(f"Estimated cost: ${total_cost:,.0f}")
print(f"Budget: $100,000")
print(f"{'✓ Within budget' if total_cost <= 100000 else '✗ Over budget!'}")

# Step 4: Timeline check
num_gpus = ___            # How many GPUs?
wall_days = gpu_hours / (num_gpus * 24)
print(f"Wall-clock time: {wall_days:.1f} days")
print(f"Deadline: 28 days")
print(f"{'✓ Within timeline' if wall_days <= 28 else '✗ Over deadline!'}")
```

Reference: [Lesson 02: Compute Planning and Scaling Laws](./02-compute-planning.md)
and [Lesson 06: Cost and Resource Estimation](./06-cost-estimation.md).

---

## Part 4: Infrastructure Design

Choose your parallelism strategy and cluster configuration.

```
Infrastructure Worksheet:

  ┌──────────────────────────────────────────────────┐
  │  Question                    │  Your Answer      │
  ├──────────────────────────────┼───────────────────┤
  │  Number of GPUs              │  ___              │
  │  GPUs per node               │  8 (standard)     │
  │  Number of nodes             │  ___              │
  │  Parallelism strategy        │  ___              │
  │  - Data parallel degree      │  ___              │
  │  - Tensor parallel degree    │  ___              │
  │  - Pipeline parallel degree  │  ___              │
  │  ZeRO stage                  │  ___              │
  │  Framework                   │  ___              │
  │  Checkpoint frequency        │  ___              │
  │  Checkpoint storage needed   │  ___              │
  └──────────────────────────────┴───────────────────┘

  Memory estimation:
  ┌──────────────────────────────────────────────────┐
  │  Component              │  Size (BF16 training)  │
  ├─────────────────────────┼────────────────────────┤
  │  Model parameters       │  3B × 2 bytes = 6 GB  │
  │  Gradients              │  3B × 2 bytes = 6 GB  │
  │  Optimizer (Adam FP32)  │  3B × 4 × 2 = 24 GB  │
  │  Activations (est.)     │  ~10-20 GB            │
  │  ──────────────────────────────────────────      │
  │  Total per GPU (no ZeRO)│  ~46-56 GB            │
  │  H100 memory            │  80 GB                │
  │  Fits on single GPU?    │  Yes (barely)         │
  └─────────────────────────┴────────────────────────┘
```

Reference: [Lesson 03: Distributed Training Infrastructure](./03-distributed-training-infra.md).

---

## Part 5: Training Configuration

Specify the complete training hyperparameters.

```
Training Configuration:

  ┌──────────────────────────────────────────────────┐
  │  Hyperparameter        │  Your Choice            │
  ├────────────────────────┼─────────────────────────┤
  │  Batch size (tokens)   │  ___                    │
  │  Sequence length       │  ___                    │
  │  Peak learning rate    │  ___                    │
  │  Min learning rate     │  ___                    │
  │  Warmup steps          │  ___                    │
  │  LR schedule           │  ___                    │
  │  Weight decay          │  ___                    │
  │  Gradient clipping     │  ___                    │
  │  Optimizer             │  ___                    │
  │  Adam β1, β2           │  ___                    │
  │  Precision             │  ___                    │
  │  Total training steps  │  ___                    │
  └────────────────────────┴─────────────────────────┘
```

Reference: [Lesson 04: The Pre-Training Pipeline](./04-pretraining-pipeline.md).

---

## Part 6: Evaluation Plan

Design your evaluation strategy.

```
Evaluation Plan:

  During training (automated):
  ┌──────────────────────────────────────────────────┐
  │  Metric              │  Frequency  │  Threshold  │
  ├──────────────────────┼─────────────┼─────────────┤
  │  Training loss       │  ___        │  ___        │
  │  Validation loss     │  ___        │  ___        │
  │  HumanEval pass@1    │  ___        │  ___        │
  │  MBPP pass@1         │  ___        │  ___        │
  │  Gradient norm       │  ___        │  ___        │
  └──────────────────────┴─────────────┴─────────────┘

  After training (comprehensive):
  ┌──────────────────────────────────────────────────┐
  │  Benchmark           │  Target Score             │
  ├──────────────────────┼──────────────────────────┤
  │  HumanEval pass@1    │  ___                      │
  │  MBPP pass@1         │  ___                      │
  │  MMLU (general)      │  ___                      │
  │  GSM8K (math)        │  ___                      │
  │  Human evaluation    │  ___                      │
  └──────────────────────┴──────────────────────────┘
```

Reference: [Lesson 07: Model Evaluation at Scale](./07-evaluation-at-scale.md).

---

## Part 7: Risk Mitigation

Identify risks and plan mitigations.

```
Risk Register:

  ┌──────────────────────────────────────────────────┐
  │  Risk                │  Likelihood │  Mitigation  │
  ├──────────────────────┼─────────────┼──────────────┤
  │  GPU failure during  │  High       │  ___         │
  │  training            │             │              │
  ├──────────────────────┼─────────────┼──────────────┤
  │  Loss spike / NaN    │  Medium     │  ___         │
  │                      │             │              │
  ├──────────────────────┼─────────────┼──────────────┤
  │  Over budget         │  Medium     │  ___         │
  │                      │             │              │
  ├──────────────────────┼─────────────┼──────────────┤
  │  Data quality issues │  Medium     │  ___         │
  │  discovered late     │             │              │
  ├──────────────────────┼─────────────┼──────────────┤
  │  Model underperforms │  Medium     │  ___         │
  │  on benchmarks       │             │              │
  └──────────────────────┴─────────────┴──────────────┘
```

---

## Part 8: Executive Summary

Compile your plan into a one-page summary.

```
Training Run Plan: 3B Code Generation Model
════════════════════════════════════════════

Architecture:
  ___ layers, ___ hidden dim, ___ heads
  Total parameters: ___B

Data:
  ___ total tokens from ___ sources
  Primary: ___ (___%), Secondary: ___ (___%)

Compute:
  ___ × H100 GPUs for ___ days
  Total GPU-hours: ___
  MFU target: ___%

Cost:
  GPU compute:    $___
  Overhead (30%): $___
  Total:          $___
  Budget:         $100,000
  Margin:         $___

Timeline:
  Week 1: Data preparation + tokenizer training
  Week 2: Training (first half)
  Week 3: Training (second half)
  Week 4: Evaluation + post-training

Success Criteria:
  HumanEval pass@1 ≥ ___
  MBPP pass@1 ≥ ___
  Total cost ≤ $100,000
```

---

## Deliverables

When you complete this capstone, you should have:

1. A filled-out architecture worksheet with verified parameter count
2. A data pipeline design with sources, ratios, and filtering strategy
3. A compute plan showing FLOPS, GPU-hours, and wall-clock time
4. An infrastructure design with parallelism strategy
5. A complete training configuration
6. An evaluation plan with benchmarks and targets
7. A risk register with mitigations
8. A one-page executive summary

This is the same process that real ML teams follow when planning
training runs. The numbers and trade-offs you work through here are
the same ones that shaped LLaMA, Mistral, and every other open model.

---

## Connection to ML

This capstone integrates every lesson in the track:

- [Lesson 01](./01-training-data-pipelines.md) — Data pipeline design
- [Lesson 02](./02-compute-planning.md) — Compute planning and scaling laws
- [Lesson 03](./03-distributed-training-infra.md) — Infrastructure and parallelism
- [Lesson 04](./04-pretraining-pipeline.md) — Pre-training pipeline and hyperparameters
- [Lesson 05](./05-post-training-pipeline.md) — Post-training considerations
- [Lesson 06](./06-cost-estimation.md) — Cost estimation and budgeting
- [Lesson 07](./07-evaluation-at-scale.md) — Evaluation strategy
- [Lesson 08](./08-data-quality-curation.md) — Data quality and curation

Use the [Cost Calculator Reference](./reference-cost-calculator.md) for
quick lookups during your planning.
