# Lesson 02: Compute Planning and Scaling Laws — How Much Compute Do You Actually Need?

Before you rent a single GPU, you need to answer a fundamental question:
how much compute will this training run require? Get this wrong and you
either waste millions of dollars on unnecessary hardware, or you run out
of budget before the model converges. Scaling laws give you the formulas
to plan with confidence.

---

## The Core Idea

Compute planning is like planning a road trip. You need to know the
distance (model size × dataset size), your car's fuel efficiency
(GPU throughput), and the price of gas (cloud GPU costs). Scaling laws
are the maps that tell you the optimal route — how to balance model
size and dataset size for the best result given your fuel budget.

```
The Compute Planning Triangle:

         Model Size (N)
        /              \
       /    COMPUTE     \
      /     BUDGET       \
     /      (C)           \
    /________________________\
  Dataset Size (D)    Performance (L)

  C ≈ 6 × N × D    (approximate FLOPS for training)

  N = number of parameters
  D = number of training tokens
  C = total floating point operations
  L = final loss (lower is better)
```

The key insight from scaling laws research: **there is an optimal
balance between model size and dataset size for any given compute
budget.** Spend too much on a big model with too little data, and you
waste compute. Spend too much on data with too small a model, and you
also waste compute.

---

## Estimating FLOPS for Training

The total compute for training a transformer model is approximately:

```
C ≈ 6 × N × D

Where:
  C = total FLOPS (floating point operations)
  N = number of model parameters
  D = number of training tokens

Why 6?
  - Forward pass:  ~2 × N FLOPS per token
    (each parameter participates in one multiply and one add)
  - Backward pass: ~4 × N FLOPS per token
    (roughly 2× the forward pass for gradient computation)
  - Total: ~6 × N FLOPS per token
```

**Example: Estimating compute for a 7B model**

```python
# Compute estimation for a 7B parameter model
N = 7e9          # 7 billion parameters
D = 2e12         # 2 trillion training tokens

C = 6 * N * D
print(f"Total FLOPS: {C:.2e}")
# Total FLOPS: 8.40e+22

# Convert to more readable units
petaflops = C / 1e15
print(f"PetaFLOPS: {petaflops:.0f}")
# PetaFLOPS: 84,000,000

petaflop_days = petaflops / (24 * 3600)
print(f"Petaflop-days: {petaflop_days:.0f}")
# Petaflop-days: 972
```

---

## GPU-Hours Calculation

Once you know the total FLOPS, you can estimate how long training
takes on a given GPU cluster.

```
GPU-Hours Calculation:

  GPU-hours = C / (GPU_FLOPS × MFU × 3600)

  Where:
    C         = total FLOPS needed
    GPU_FLOPS = peak FLOPS of one GPU (e.g., H100 = 990 TFLOPS BF16)
    MFU       = Model FLOPS Utilization (typically 0.30–0.55)
    3600      = seconds per hour

  MFU (Model FLOPS Utilization):
  ┌──────────────────────────────────────────────────┐
  │  What fraction of the GPU's peak FLOPS you       │
  │  actually use during training.                   │
  │                                                  │
  │  Theoretical peak:  100%  (never achieved)       │
  │  Excellent:         50-55%                       │
  │  Good:              40-50%                       │
  │  Typical:           30-40%                       │
  │  Poor:              < 30%                        │
  │                                                  │
  │  Lost to: memory transfers, communication,       │
  │  synchronization, pipeline bubbles, idle time    │
  └──────────────────────────────────────────────────┘
```

**Example: How long to train a 7B model on H100s?**

```python
# Training time estimation
C = 8.4e22              # Total FLOPS (from above)
gpu_flops = 990e12      # H100 BF16 peak FLOPS
mfu = 0.40              # 40% utilization (realistic)

# Single GPU
single_gpu_seconds = C / (gpu_flops * mfu)
single_gpu_hours = single_gpu_seconds / 3600
single_gpu_days = single_gpu_hours / 24
print(f"Single H100: {single_gpu_days:.0f} days")
# Single H100: 2,453 days (~6.7 years)

# With a cluster
num_gpus = 256
cluster_days = single_gpu_days / num_gpus
print(f"256 H100s: {cluster_days:.1f} days")
# 256 H100s: 9.6 days

# Total GPU-hours
total_gpu_hours = single_gpu_hours
print(f"Total GPU-hours: {total_gpu_hours:.0f}")
# Total GPU-hours: 58,869
```

---

## Scaling Laws: The Chinchilla Revolution

In 2022, DeepMind published the **Chinchilla paper** that changed how
the industry thinks about training. The key finding: most models were
trained on too little data for their size.

```
Chinchilla Scaling Law:

  For a compute-optimal model:
    D ≈ 20 × N

  Where:
    N = number of parameters
    D = number of training tokens

  This means:
  ┌──────────────────────────────────────────────────┐
  │  Model Size  │  Optimal Tokens  │  Previous Norm │
  ├──────────────┼──────────────────┼────────────────┤
  │  1B params   │  20B tokens      │  ~5B tokens    │
  │  7B params   │  140B tokens     │  ~30B tokens   │
  │  13B params  │  260B tokens     │  ~50B tokens   │
  │  70B params  │  1.4T tokens     │  ~300B tokens  │
  │  175B params │  3.5T tokens     │  ~300B tokens  │
  └──────────────┴──────────────────┴────────────────┘

  GPT-3 (175B) was trained on only 300B tokens.
  Chinchilla (70B) matched GPT-3's performance with
  4× fewer parameters but 4.7× more tokens.
```

**Analogy: Studying for an exam.** Imagine you have 100 hours to
prepare. You could read one massive textbook very carefully (big model,
little data), or read several textbooks at a reasonable pace (right-sized
model, lots of data). Chinchilla showed that the second approach
consistently wins.

```
Before Chinchilla:              After Chinchilla:
"Make the model bigger"         "Balance model and data"

  Model ████████████████         Model ████████
  Data  ████                     Data  ████████████████

  Same compute budget,           Same compute budget,
  worse performance              better performance
```

---

## Beyond Chinchilla: Inference-Optimal Scaling

Chinchilla optimizes for training compute. But in practice, you also
care about inference cost — a smaller model is cheaper to serve.

```
The Inference Trade-off:

  Chinchilla-optimal:
    Train a 7B model on 140B tokens
    Training cost: $X
    Inference cost per query: $Y

  Over-trained (LLaMA approach):
    Train a 7B model on 2T tokens (14× more data)
    Training cost: ~10× more than Chinchilla-optimal
    Inference cost per query: same $Y, but model is better

  Why over-train?
  ┌──────────────────────────────────────────────────┐
  │  Training is a one-time cost.                    │
  │  Inference happens millions of times.            │
  │                                                  │
  │  If you serve 1 billion queries:                 │
  │    70B model: 1B × inference_cost_70B            │
  │     7B model: 1B × inference_cost_7B             │
  │                                                  │
  │  The 7B model (over-trained) can match the 70B   │
  │  model's quality at 1/10th the inference cost.   │
  │  The extra training cost pays for itself quickly. │
  └──────────────────────────────────────────────────┘
```

This is why LLaMA 2 (7B) was trained on 2 trillion tokens — far beyond
Chinchilla-optimal — and why LLaMA 3 (8B) was trained on 15 trillion
tokens. The extra training compute is a one-time investment that reduces
ongoing inference costs.

---

## The Scaling Laws Formulas

The original scaling laws (Kaplan et al., 2020) and Chinchilla
(Hoffmann et al., 2022) give us power-law relationships:

```
Loss as a function of compute:

  L(C) = A / C^α + L_irreducible

  Where:
    L = cross-entropy loss
    C = compute (FLOPS)
    A = constant (fit from experiments)
    α ≈ 0.05 (Chinchilla) — very slow improvement
    L_irreducible = minimum achievable loss (entropy of language)

  Key insight: Loss decreases as a POWER LAW of compute.
  Each 10× increase in compute gives roughly the same
  absolute improvement in loss.

  ┌─────────────────────────────────────────────┐
  │  Loss                                       │
  │  │                                          │
  │  │╲                                         │
  │  │ ╲                                        │
  │  │  ╲                                       │
  │  │   ╲                                      │
  │  │    ╲                                     │
  │  │     ╲___                                 │
  │  │         ╲___                             │
  │  │             ╲_____                       │
  │  │                   ╲________              │
  │  │                            ╲_________    │
  │  │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ L_irreducible
  │  └──────────────────────────────────────→   │
  │                  Compute (log scale)        │
  └─────────────────────────────────────────────┘
```

---

## Practical Compute Planning Worksheet

Here is a step-by-step process for planning a training run:

```python
def plan_training_run(
    num_params,
    num_tokens,
    gpu_type="H100",
    num_gpus=1,
    mfu=0.40,
    cost_per_gpu_hour=3.50
):
    """
    Plan a training run: estimate time and cost.

    Args:
        num_params: Number of model parameters
        num_tokens: Number of training tokens
        gpu_type: GPU type (for display)
        num_gpus: Number of GPUs in cluster
        mfu: Model FLOPS Utilization (0.0-1.0)
        cost_per_gpu_hour: Cloud cost per GPU per hour
    """
    # GPU peak FLOPS (BF16) lookup
    gpu_flops = {
        "A100": 312e12,
        "H100": 990e12,
        "B200": 2250e12,
    }

    peak = gpu_flops.get(gpu_type, 990e12)

    # Step 1: Total FLOPS
    total_flops = 6 * num_params * num_tokens

    # Step 2: Effective FLOPS per GPU
    effective_flops = peak * mfu

    # Step 3: Training time
    total_gpu_seconds = total_flops / effective_flops
    total_gpu_hours = total_gpu_seconds / 3600
    wall_clock_hours = total_gpu_hours / num_gpus
    wall_clock_days = wall_clock_hours / 24

    # Step 4: Cost
    total_cost = total_gpu_hours * cost_per_gpu_hour

    # Step 5: Chinchilla check
    chinchilla_tokens = 20 * num_params
    chinchilla_ratio = num_tokens / chinchilla_tokens

    print(f"=== Training Run Plan ===")
    print(f"Model: {num_params/1e9:.1f}B parameters")
    print(f"Data:  {num_tokens/1e12:.1f}T tokens")
    print(f"")
    print(f"Total FLOPS:     {total_flops:.2e}")
    print(f"GPU:             {num_gpus}× {gpu_type}")
    print(f"MFU:             {mfu:.0%}")
    print(f"")
    print(f"Total GPU-hours: {total_gpu_hours:,.0f}")
    print(f"Wall-clock time: {wall_clock_days:.1f} days")
    print(f"Estimated cost:  ${total_cost:,.0f}")
    print(f"")
    print(f"Chinchilla ratio: {chinchilla_ratio:.1f}×")
    if chinchilla_ratio < 0.5:
        print(f"  ⚠ Under-trained: consider more data")
    elif chinchilla_ratio > 5:
        print(f"  ℹ Over-trained: optimizing for inference cost")
    else:
        print(f"  ✓ Near Chinchilla-optimal")

# Example: Plan a 7B model training run
plan_training_run(
    num_params=7e9,
    num_tokens=2e12,
    gpu_type="H100",
    num_gpus=256,
    mfu=0.40,
    cost_per_gpu_hour=3.50
)
```

---

## Connection to ML

Scaling laws connect directly to several concepts from earlier tracks:

- **Loss functions** — Scaling laws predict the final training loss as a function of compute. See [Track 7, Lesson 08](../ml-fundamentals/08-training-neural-networks.md).
- **Transformer architecture** — The parameter count N depends on the architecture choices (layers, heads, hidden dim). See [Track 8, Lesson 07](../llms-transformers/07-transformer-architecture.md).
- **GPU hardware** — The GPU FLOPS and MFU determine how fast you can spend your compute budget. See [GPU & CUDA Fundamentals, Lesson 06](../gpu-cuda-fundamentals/06-ml-hardware-landscape.md).

For cost estimation with real-world cloud pricing, see
[Lesson 06: Cost and Resource Estimation](./06-cost-estimation.md).

---

## Exercises

### Exercise 1: Compute Estimation

```python
# Calculate the compute requirements for these models:
models = [
    {"name": "GPT-2",    "params": 1.5e9,  "tokens": 40e9},
    {"name": "GPT-3",    "params": 175e9,  "tokens": 300e9},
    {"name": "LLaMA-2",  "params": 70e9,   "tokens": 2e12},
    {"name": "LLaMA-3",  "params": 8e9,    "tokens": 15e12},
]

# TODO: For each model, calculate:
# 1. Total FLOPS (C = 6 × N × D)
# 2. Petaflop-days
# 3. GPU-hours on H100 (assume 40% MFU)
# 4. Chinchilla ratio (actual tokens / 20N)
# 5. Which models are over-trained? Under-trained?
```

### Exercise 2: Scaling Law Prediction

```python
# Given these data points from training runs at different scales:
# (compute in FLOPS, final loss)
data_points = [
    (1e17, 3.8),
    (1e18, 3.4),
    (1e19, 3.1),
    (1e20, 2.85),
    (1e21, 2.65),
]

# TODO: Fit a power law: L = A * C^(-alpha) + L_min
# TODO: Predict the loss at 1e22 and 1e23 FLOPS
# TODO: How much compute would you need to reach loss = 2.0?
# Hint: Use scipy.optimize.curve_fit or manual log-log fitting
```

### Exercise 3: Budget Optimization

You have a budget of $1 million for cloud GPU training on H100s at
$3.50/GPU-hour. What is the largest model you can train to
Chinchilla-optimal? Show your work:

```python
# TODO: Given budget = $1,000,000 and cost_per_gpu_hour = $3.50
# 1. Calculate total GPU-hours available
# 2. Calculate total FLOPS available (H100, 40% MFU)
# 3. Using C = 6 × N × D and D = 20 × N (Chinchilla):
#    C = 6 × N × 20N = 120 × N²
#    Solve for N
# 4. What is the optimal model size and dataset size?
```

---

Next: [Lesson 03: Distributed Training Infrastructure](./03-distributed-training-infra.md)
