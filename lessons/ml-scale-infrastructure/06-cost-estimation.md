# Lesson 06: Cost and Resource Estimation — How Much Does It Actually Cost?

"Can we afford to train this model?" is the first question any ML team
lead asks. This lesson gives you the formulas, the real-world numbers,
and the spreadsheet-style walkthroughs to answer that question for any
model size, on any hardware, with any budget.

---

## The Core Idea

Cost estimation for ML training is like estimating the cost of building
a house. You need to know the size of the house (model parameters), the
quality of materials (data), the labor rate (GPU cost per hour), and how
long construction takes (training time). Just like construction, there
are hidden costs — the architect (engineering time), permits (cloud
setup), and inevitable overruns (failed runs, hyperparameter tuning).

```
Cost Breakdown for a Training Run:

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  ████████████████████████████████  GPU Compute   │
  │  (70-85% of total cost)           (the big one)  │
  │                                                  │
  │  ██████  Storage & Networking (5-10%)             │
  │                                                  │
  │  ████  Engineering Time (5-15%)                   │
  │                                                  │
  │  ██  Failed Runs & Experiments (5-10%)            │
  │                                                  │
  │  █  Data Preparation (1-5%)                       │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

---

## The Cost Formula

The core formula for estimating GPU compute cost:

```
Total Cost = GPU-hours × Cost per GPU-hour

GPU-hours = Total FLOPS / (GPU Peak FLOPS × MFU × 3600)

Total FLOPS = 6 × N × D

Where:
  N = number of parameters
  D = number of training tokens
  GPU Peak FLOPS = hardware-dependent (BF16)
  MFU = Model FLOPS Utilization (0.30-0.55)

Putting it all together:

  Cost = (6 × N × D) / (GPU_FLOPS × MFU × 3600) × $/GPU-hour
```

---

## Cloud GPU Pricing (2024)

```
Cloud GPU Pricing Comparison:

┌──────────────┬──────────┬──────────┬──────────┬──────────┐
│  GPU         │  AWS     │  GCP     │  Azure   │  Lambda  │
│              │  ($/hr)  │  ($/hr)  │  ($/hr)  │  ($/hr)  │
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│  A100 40GB   │  $4.10   │  $3.67   │  $3.40   │  $1.10   │
│  A100 80GB   │  $5.12   │  $5.07   │  $4.50   │  $1.29   │
│  H100 80GB   │  $8.25   │  $8.86   │  $7.35   │  $2.49   │
│  B200        │  TBD     │  TBD     │  TBD     │  TBD     │
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│  Notes       │ On-demand│ On-demand│ On-demand│ On-demand│
│              │ Spot:    │ Spot:    │ Spot:    │          │
│              │ ~60-70%  │ ~60-70%  │ ~60-70%  │          │
│              │ discount │ discount │ discount │          │
└──────────────┴──────────┴──────────┴──────────┴──────────┘

  Reserved instances (1-3 year commitment): 30-60% discount
  Spot/preemptible instances: 60-70% discount (but can be interrupted)

  Note: Prices change frequently. Check current pricing before planning.
```

---

## Walkthrough 1: Training a 7B Model

Let us walk through a complete cost estimation for training a 7B
parameter model on 2 trillion tokens.

```python
def estimate_training_cost(
    num_params,
    num_tokens,
    gpu_type="H100",
    num_gpus=256,
    mfu=0.40,
    cost_per_gpu_hour=3.50,
    overhead_multiplier=1.2
):
    """
    Complete training cost estimation.

    overhead_multiplier accounts for:
    - Failed runs and restarts
    - Hyperparameter tuning
    - Evaluation runs
    - Idle time between jobs
    """
    # GPU specs (BF16 peak FLOPS)
    gpu_specs = {
        "A100_40GB": {"flops": 312e12, "memory": 40},
        "A100_80GB": {"flops": 312e12, "memory": 80},
        "H100":      {"flops": 990e12, "memory": 80},
        "B200":      {"flops": 2250e12, "memory": 192},
    }

    spec = gpu_specs[gpu_type]

    # Step 1: Total FLOPS
    total_flops = 6 * num_params * num_tokens

    # Step 2: GPU-hours
    effective_flops_per_gpu = spec["flops"] * mfu
    total_gpu_seconds = total_flops / effective_flops_per_gpu
    total_gpu_hours = total_gpu_seconds / 3600

    # Step 3: Wall-clock time
    wall_hours = total_gpu_hours / num_gpus
    wall_days = wall_hours / 24

    # Step 4: Raw compute cost
    raw_cost = total_gpu_hours * cost_per_gpu_hour

    # Step 5: Total cost with overhead
    total_cost = raw_cost * overhead_multiplier

    print(f"{'='*50}")
    print(f"Training Cost Estimate")
    print(f"{'='*50}")
    print(f"Model:          {num_params/1e9:.0f}B parameters")
    print(f"Dataset:        {num_tokens/1e12:.1f}T tokens")
    print(f"Hardware:       {num_gpus}× {gpu_type}")
    print(f"MFU:            {mfu:.0%}")
    print(f"{'─'*50}")
    print(f"Total FLOPS:    {total_flops:.2e}")
    print(f"GPU-hours:      {total_gpu_hours:,.0f}")
    print(f"Wall-clock:     {wall_days:.1f} days")
    print(f"{'─'*50}")
    print(f"Raw GPU cost:   ${raw_cost:,.0f}")
    print(f"With overhead:  ${total_cost:,.0f}")
    print(f"{'='*50}")

    return {
        "total_flops": total_flops,
        "gpu_hours": total_gpu_hours,
        "wall_days": wall_days,
        "raw_cost": raw_cost,
        "total_cost": total_cost,
    }

# Example: 7B model on H100s
estimate_training_cost(
    num_params=7e9,
    num_tokens=2e12,
    gpu_type="H100",
    num_gpus=256,
    mfu=0.40,
    cost_per_gpu_hour=3.50
)
```

---

## Walkthrough 2: Published Training Costs

Here are published or estimated training costs for well-known models:

```
Published / Estimated Training Costs:

┌──────────────┬────────┬─────────┬──────────┬──────────────┐
│  Model       │ Params │ Tokens  │ GPU-hrs  │ Est. Cost    │
├──────────────┼────────┼─────────┼──────────┼──────────────┤
│  GPT-3      │  175B  │  300B   │ 3.6M*   │ $4-12M       │
│  Chinchilla │  70B   │  1.4T   │ ~500K   │ $1-3M        │
│  LLaMA 1    │  65B   │  1.4T   │ 1M      │ $2-5M        │
│  LLaMA 2    │  70B   │  2T     │ 1.7M    │ $3-7M        │
│  LLaMA 3    │  70B   │  15T    │ ~7M     │ $15-30M      │
│  Mistral 7B │  7B    │  ~8T    │ ~200K   │ $0.5-1M      │
│  GPT-4      │  ~1.8T*│  ~13T*  │ ~50M*   │ $50-100M*    │
│  Gemini     │  ~1T*  │  ~10T*  │ TPU     │ $50-100M*    │
└──────────────┴────────┴─────────┴──────────┴──────────────┘

  * Estimated / rumored — not officially published
  Costs are for GPU compute only, not including engineering,
  data preparation, or failed experiments.

  Key observations:
  - Cost scales roughly linearly with N × D
  - LLaMA 3 (70B, 15T tokens) cost ~5× LLaMA 2 (70B, 2T tokens)
    because it used 7.5× more tokens
  - Frontier models (GPT-4, Gemini) cost $50-100M+
```

---

## Cloud vs On-Premise

```
Cloud vs On-Premise Trade-offs:

┌──────────────────┬──────────────────┬──────────────────┐
│                  │  Cloud           │  On-Premise      │
├──────────────────┼──────────────────┼──────────────────┤
│  Upfront cost    │  $0              │  $250K-$1M+      │
│                  │                  │  per node        │
├──────────────────┼──────────────────┼──────────────────┤
│  Ongoing cost    │  $3-9/GPU-hr     │  Power + cooling │
│                  │                  │  + staff         │
├──────────────────┼──────────────────┼──────────────────┤
│  Break-even      │  N/A             │  ~6-18 months    │
│                  │                  │  at high util.   │
├──────────────────┼──────────────────┼──────────────────┤
│  Flexibility     │  Scale up/down   │  Fixed capacity  │
│                  │  instantly       │                  │
├──────────────────┼──────────────────┼──────────────────┤
│  GPU availability│  May be limited  │  Always available│
│                  │  (H100 shortage) │  (once purchased)│
├──────────────────┼──────────────────┼──────────────────┤
│  Best for        │  Experiments,    │  Continuous      │
│                  │  variable load,  │  training,       │
│                  │  small teams     │  large orgs      │
└──────────────────┴──────────────────┴──────────────────┘

  On-premise cost example (8×H100 node):
  ┌──────────────────────────────────────────────────┐
  │  Hardware:     ~$300,000 (8×H100 + server)       │
  │  Power:        ~$3,000/month (10 kW × $0.10/kWh) │
  │  Cooling:      ~$1,000/month                     │
  │  Staff:        ~$5,000/month (shared)            │
  │  ─────────────────────────────────────           │
  │  Monthly:      ~$9,000                           │
  │  Effective $/GPU-hr: ~$1.50                      │
  │  (at 100% utilization)                           │
  │                                                  │
  │  Cloud equivalent: 8 × $3.50 × 730 hrs = $20,440│
  │  Break-even: ~15 months                          │
  └──────────────────────────────────────────────────┘
```

---

## Hidden Costs

The GPU compute cost is the biggest line item, but it is not the only
one:

```
Hidden Costs Checklist:

  ┌──────────────────────────────────────────────────┐
  │  Category          │  Typical % of Total         │
  ├────────────────────┼─────────────────────────────┤
  │  Failed runs       │  10-30% (especially early)  │
  │  Hyperparameter    │  5-20% (grid search, etc.)  │
  │  tuning            │                             │
  │  Data preparation  │  5-10% (compute for         │
  │                    │  filtering, dedup)           │
  │  Evaluation runs   │  2-5%                       │
  │  Storage           │  2-5% (checkpoints, data)   │
  │  Networking        │  1-3% (data transfer)       │
  │  Engineering time  │  Hard to quantify           │
  │  Post-training     │  1-5% of pre-training cost  │
  └────────────────────┴─────────────────────────────┘

  Rule of thumb: Multiply raw GPU cost by 1.5-2×
  for total project cost.
```

---

## Quick Cost Estimation Table

For quick back-of-envelope calculations:

```
Quick Cost Reference (H100, $3.50/hr, 40% MFU):

┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  Model   │ Chinchilla│ GPU-hrs  │ 256 GPUs │ Est Cost │
│  Size    │ Tokens   │          │ (days)   │          │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│  1B      │  20B     │  840     │  0.1     │  $3K     │
│  3B      │  60B     │  7,600   │  1.2     │  $27K    │
│  7B      │  140B    │  41,000  │  6.7     │  $144K   │
│  13B     │  260B    │  142,000 │  23      │  $497K   │
│  30B     │  600B    │  756,000 │  123     │  $2.6M   │
│  70B     │  1.4T    │  4.1M    │  670     │  $14.4M  │
│  175B    │  3.5T    │  25.7M   │  4,180   │  $90M    │
└──────────┴──────────┴──────────┴──────────┴──────────┘

  Note: These are Chinchilla-optimal estimates.
  Over-training (e.g., LLaMA-style) multiplies cost
  by the over-training factor.
```

---

## Connection to ML

Cost estimation ties together everything in this track:

- **Scaling laws** determine the optimal model/data balance. See [Lesson 02](./02-compute-planning.md).
- **GPU hardware** determines the cost per FLOP. See [GPU & CUDA Fundamentals, Lesson 06](../gpu-cuda-fundamentals/06-ml-hardware-landscape.md).
- **Infrastructure choices** affect MFU and therefore cost. See [Lesson 03](./03-distributed-training-infra.md).
- **Data pipeline** costs are a small but real fraction. See [Lesson 01](./01-training-data-pipelines.md).

For quick-reference cost tables and formulas, see the
[Cost Calculator Reference](./reference-cost-calculator.md).

---

## Exercises

### Exercise 1: Cost Comparison

```python
# Compare the cost of training the same 7B model on different hardware:
configs = [
    {"gpu": "A100_80GB", "flops": 312e12, "cost_hr": 5.12, "gpus": 256},
    {"gpu": "H100",      "flops": 990e12, "cost_hr": 3.50, "gpus": 256},
    {"gpu": "H100",      "flops": 990e12, "cost_hr": 2.49, "gpus": 256},  # Lambda
    {"gpu": "B200",      "flops": 2250e12,"cost_hr": 8.00, "gpus": 128},  # est.
]

num_params = 7e9
num_tokens = 2e12
mfu = 0.40

# TODO: For each config, calculate:
# 1. Total GPU-hours
# 2. Wall-clock days
# 3. Total cost
# 4. Cost per trillion tokens
# Which option is cheapest? Which is fastest?
```

### Exercise 2: Budget Planning

Your startup has raised $500K for ML training. You want to train the
best possible model. Using the cost formulas:

```python
# TODO: What is the largest Chinchilla-optimal model you can train
#       on H100s at $3.50/hr with a $500K budget?
# TODO: What if you use spot instances at $1.50/hr?
# TODO: What if you over-train a smaller model (like LLaMA)?
#       Compare: 7B model on 2T tokens vs 3B model on 2T tokens
#       Which gives better performance per dollar?
```

### Exercise 3: Real-World Cost Verification

```python
# LLaMA 2 (70B) was trained on 2T tokens using A100 GPUs.
# Meta reported using 1.7M GPU-hours.

# TODO: Verify this number using the formula C = 6 × N × D
# TODO: What MFU does this imply?
# TODO: At $5/GPU-hr (A100 cloud), what would this cost?
# TODO: Meta owns their GPUs. If their effective cost is
#       $1.50/GPU-hr, what did they actually spend?
```

---

Next: [Lesson 07: Model Evaluation at Scale](./07-evaluation-at-scale.md)
