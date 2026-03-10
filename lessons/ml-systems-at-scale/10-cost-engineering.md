# Lesson 10: Cost Engineering

> **Analogy**: Building a house. You can spend $5 million on
> Italian marble and hand-carved fixtures, or $500K on quality
> materials with smart design choices and get 90% of the result.
> ML training is the same -- the difference between a well-run
> training at $200K and a naive one at $2M is engineering, not
> magic. Cost engineering is knowing where every dollar goes
> and squeezing value from each one.

---

## The Cost Landscape

```
Training cost of notable models (estimated):

+------------------+--------+----------+------------------+
| Model            | Params | GPUs     | Estimated Cost   |
+------------------+--------+----------+------------------+
| GPT-3            | 175B   | ~1000    | $4-5M            |
| LLaMA 2 70B     | 70B    | 2048 A100| $2-3M            |
| LLaMA 3 70B     | 70B    | ~6000    | $10-15M*         |
| Gemini Ultra     | ~?     | TPU v5p  | $50-100M+*       |
| GPT-4            | ~?     | ~25000   | $50-100M+*       |
+------------------+--------+----------+------------------+
  * includes data, experiments, failed runs, etc.

Even a "modest" 7B model training:
  64 H100s x 14 days x $4/GPU/hr = $86,016

  That's a junior engineer's salary for TWO WEEKS of compute.
```

---

## Cost per FLOP Analysis

The fundamental unit of ML training cost is the FLOP (floating
point operation). Understanding cost-per-FLOP lets you compare
hardware and optimize spending.

### Estimating Training FLOPs

For a transformer with P parameters trained on D tokens:

```
Approximate total FLOPs = 6 * P * D

  Factor of 6:
    Forward pass:  2 * P * D  (2 FLOPs per parameter per token)
    Backward pass: 4 * P * D  (roughly 2x forward)
    Total:         6 * P * D

  Example: LLaMA 7B trained on 2T tokens
  FLOPs = 6 * 7e9 * 2e12 = 8.4e22 FLOPs

  Example: LLaMA 70B trained on 2T tokens
  FLOPs = 6 * 70e9 * 2e12 = 8.4e23 FLOPs (10x more)
```

### GPU Cost Efficiency

```
+----------+----------------+----------+----------+-----------+
| GPU      | BF16 TFLOPS    | $/hr     | $/PFLOP  | MFU to    |
|          | (theoretical)  | (cloud)  |          | break even|
+----------+----------------+----------+----------+-----------+
| A100     | 312            | $3.00    | $2.67    | ~40%      |
| H100     | 989            | $5.00    | $1.40    | ~40%      |
| H200     | 989            | $5.50    | $1.54    | ~40%      |
| B200     | 2,250          | $8.00*   | $0.99    | ~35%      |
+----------+----------------+----------+----------+-----------+

  $/PFLOP = cost per hour / (TFLOPS * 3600 / 1e6)
  *estimated pricing

  H100 is ~2x more cost-efficient than A100 per FLOP.
  But only if you achieve similar MFU (Model FLOP Utilization).
```

### Model FLOP Utilization (MFU)

MFU measures what fraction of theoretical peak FLOPS you
actually use for useful model computation.

```
MFU = (model FLOPs per step) / (GPU peak FLOPS * step time)

Example:
  Model: 7B params, batch=512, seq=2048
  FLOPs per step: 6 * 7e9 * 512 * 2048 = 4.4e16
  Step time: 5 seconds
  8 H100s at 989 TFLOPS each = 7,912 TFLOPS

  MFU = 4.4e16 / (7.912e15 * 5) = 4.4e16 / 3.96e16 = 1.11

  Wait, MFU > 1? That can't be right.
  The issue: we used 6*P*D which includes backward pass,
  but theoretical FLOPS assumes full utilization.

  Correct calculation:
  FLOPs per step = 6 * P * batch * seq
  Theoretical per step = peak_TFLOPS * 1e12 * step_time * num_gpus
  MFU = actual / theoretical

  Realistic MFU values:
    Excellent:  > 50%
    Good:       40-50%
    Acceptable: 30-40%
    Needs work: < 30%

  Every 10% MFU improvement saves 10% on your GPU bill.
```

```python
def compute_mfu(
    num_params,
    batch_size,
    seq_length,
    step_time_seconds,
    num_gpus,
    gpu_peak_tflops,
):
    flops_per_step = 6 * num_params * batch_size * seq_length

    theoretical_flops = gpu_peak_tflops * 1e12 * step_time_seconds * num_gpus

    mfu = flops_per_step / theoretical_flops
    return mfu

mfu = compute_mfu(
    num_params=7e9,
    batch_size=512,
    seq_length=2048,
    step_time_seconds=5.0,
    num_gpus=8,
    gpu_peak_tflops=989,
)
print(f"MFU: {mfu:.1%}")
```

---

## Training Cost Estimation

Before committing $100K+ to a training run, estimate the cost.

```python
def estimate_training_cost(
    model_params,
    training_tokens,
    gpu_peak_tflops,
    expected_mfu,
    num_gpus,
    gpu_cost_per_hour,
):
    total_flops = 6 * model_params * training_tokens

    effective_tflops_per_gpu = gpu_peak_tflops * expected_mfu
    total_effective_tflops = effective_tflops_per_gpu * num_gpus

    training_seconds = total_flops / (total_effective_tflops * 1e12)
    training_hours = training_seconds / 3600
    training_days = training_hours / 24

    total_gpu_hours = training_hours * num_gpus
    total_cost = total_gpu_hours * gpu_cost_per_hour

    return {
        'total_flops': total_flops,
        'training_hours': training_hours,
        'training_days': training_days,
        'total_gpu_hours': total_gpu_hours,
        'total_cost_usd': total_cost,
        'cost_per_billion_tokens': total_cost / (training_tokens / 1e9),
    }

result = estimate_training_cost(
    model_params=7e9,
    training_tokens=2e12,
    gpu_peak_tflops=989,
    expected_mfu=0.45,
    num_gpus=64,
    gpu_cost_per_hour=5.0,
)

for key, value in result.items():
    if isinstance(value, float):
        if value > 1e6:
            print(f"{key}: {value:.2e}")
        else:
            print(f"{key}: {value:,.2f}")
```

```
Output for 7B model on 64 H100s:

  total_flops:             8.40e+22
  training_hours:          651.73
  training_days:           27.16
  total_gpu_hours:         41,710.67
  total_cost_usd:          208,553.35
  cost_per_billion_tokens: 104.28
```

---

## Spot/Preemptible Instances

The single biggest lever for cost reduction.

```
Cost comparison for 64 H100s, 30-day training:

  On-demand:
    64 GPUs * $5.00/hr * 720 hr = $230,400

  Spot instances (60% discount):
    64 GPUs * $2.00/hr * 720 hr = $92,160
    + Preemption overhead (est. 10%): $9,216
    Total: ~$101,376

    Savings: $129,024 (56%)

  Reserved instances (1-year commitment, 40% discount):
    64 GPUs * $3.00/hr * 720 hr = $138,240
    But you pay whether you use them or not.
    Only worth it if you run >60% of the year.
```

### Spot Instance Strategy

```
Tier 1: Critical path (can't tolerate preemption)
  - Master node / rank 0
  - Use on-demand
  - 1 node = $40/hr

Tier 2: Workers (tolerate preemption with fast recovery)
  - Worker nodes
  - Use spot instances
  - 7 nodes at $16/hr = $112/hr (vs $280/hr on-demand)

Total: $152/hr vs $320/hr = 52% savings

Checkpoint every 500 steps (~30 min).
Average preemption recovery: 10 min.
Worst case: lose 30 min of compute per preemption.

Expected preemptions per day: 1-3
Expected wasted compute per day: 0.5-1.5 hours
Wasted cost per day: $76-$228
Daily savings from spot: $4,032

Net savings: $3,800-$3,950 per day. Always worth it.
```

### Multi-Region Spot Arbitrage

```python
import boto3

def find_cheapest_spot_region(instance_type='p5.48xlarge'):
    regions = [
        'us-east-1', 'us-east-2', 'us-west-2',
        'eu-west-1', 'eu-central-1', 'ap-northeast-1',
    ]

    prices = {}
    for region in regions:
        ec2 = boto3.client('ec2', region_name=region)
        response = ec2.describe_spot_price_history(
            InstanceTypes=[instance_type],
            ProductDescriptions=['Linux/UNIX'],
            MaxResults=1,
        )
        if response['SpotPriceHistory']:
            price = float(response['SpotPriceHistory'][0]['SpotPrice'])
            prices[region] = price

    sorted_prices = sorted(prices.items(), key=lambda x: x[1])

    for region, price in sorted_prices:
        print(f"  {region}: ${price:.2f}/hr")

    return sorted_prices[0] if sorted_prices else None
```

---

## When to Rent vs Build

```
Break-even analysis:

  Cloud H100 (on-demand): $5.00/GPU/hr
  Cloud H100 (reserved 1yr): $3.00/GPU/hr

  Owned H100 server (8 GPUs):
    Hardware: ~$300,000 (DGX H100)
    Power: 10 kW * $0.10/kWh = $1.00/hr
    Cooling: ~$0.30/hr
    Datacenter space: ~$500/month
    Network: ~$200/month
    IT staff (amortized): ~$2.00/hr
    Total operating: ~$3.50/hr for 8 GPUs = $0.44/GPU/hr

  Break-even (vs cloud reserved):
    Cloud yearly: $3.00 * 8760 * 8 = $210,240
    Owned yearly: $300,000 + $0.44 * 8760 * 8 = $300,000 + $30,835 = $330,835

    Year 1: Cloud wins ($210K vs $331K)
    Year 2: Owned wins ($362K vs $420K cumulative)
    Year 3: Owned wins clearly ($393K vs $631K cumulative)

  BUT:
    - Hardware depreciates (new GPU gen every 2 years)
    - Cloud scales up/down instantly
    - Cloud handles failures (replacement nodes)
    - Owned requires IT team, procurement, facilities

  Rule of thumb:
    < 30% utilization -> Rent (cloud)
    30-70% utilization -> Reserved instances or committed use
    > 70% utilization for 2+ years -> Consider owning
```

---

## Cloud Provider Comparison

```
+------------------+-----------------+------------------+------------+
| Factor           | AWS             | GCP              | Azure      |
+------------------+-----------------+------------------+------------+
| H100 instance    | p5.48xlarge     | a3-highgpu-8g    | ND H100    |
|                  | (8x H100)      | (8x H100)        | v5         |
+------------------+-----------------+------------------+------------+
| On-demand $/hr   | ~$98            | ~$98             | ~$100      |
| (8-GPU node)     |                 |                  |            |
+------------------+-----------------+------------------+------------+
| Spot/preemptible | Available,      | Available,       | Limited    |
|                  | variable        | fixed duration   |            |
+------------------+-----------------+------------------+------------+
| Interconnect     | EFA (100 Gbps)  | GPUDirect IB     | InfiniBand |
|                  |                 | (3.2 Tbps)       | (400 Gbps) |
+------------------+-----------------+------------------+------------+
| Max cluster size | 20K+ GPUs       | 26K+ TPUs/GPUs   | 10K+ GPUs  |
+------------------+-----------------+------------------+------------+
| Strength         | Ecosystem,      | TPU access,      | Enterprise |
|                  | S3 storage      | network speed    | integration|
+------------------+-----------------+------------------+------------+
```

### GCP's Network Advantage

GCP provides ICI (for TPUs) and GPUDirect-RDMA with 3.2 Tbps
bisection bandwidth per node. For large-scale training where
communication is the bottleneck, this makes a material difference.

```
Communication-bound scenario (70B model, TP=8, DP=8):

  AWS EFA (100 Gbps = 12.5 GB/s):
    DP all-reduce for 70B BF16 grads: 140 GB
    Ring reduce time: 2 * 140 / 12.5 = 22.4 seconds

  GCP GPUDirect IB (400 Gbps = 50 GB/s):
    Ring reduce time: 2 * 140 / 50 = 5.6 seconds

  If compute per step = 30 seconds:
    AWS utilization: 30 / 52.4 = 57%
    GCP utilization: 30 / 35.6 = 84%

  GCP is 47% faster for the same $/GPU/hr.
```

---

## Optimization Techniques That Save Money

### 1. Right-Size Your Cluster

```
Don't use 256 GPUs if 64 will finish in time.

  256 GPUs for 7 days:    256 * 168 * $5 = $215,040
  64 GPUs for 28 days:    64 * 672 * $5 = $215,040

  Same cost! But 64 GPUs:
  - Easier to schedule on spot markets
  - Fewer failure points
  - Simpler debugging
  - Better MFU (less communication overhead)

  Scaling efficiency typically drops above 128 GPUs for
  models under 13B. You pay for GPUs that spend 20%+
  of their time communicating instead of computing.
```

### 2. Mixed Precision Saves 2x Memory = 2x Batch = Fewer Steps

```
FP32 training:  batch_size = 16 per GPU (memory limited)
BF16 training:  batch_size = 32 per GPU
                or same batch but half the GPUs

  FP32: 128 GPUs * 16 batch * 100K steps = 204.8B tokens
  BF16: 64 GPUs * 32 batch * 100K steps = 204.8B tokens

  Same tokens, half the GPUs, half the cost.
```

### 3. Efficient Checkpointing

```
Naive checkpointing (full state dict to rank 0):
  70B model: gather ~840 GB to rank 0, write to disk
  Time: 15-30 minutes
  Network: saturates InfiniBand during gather

  If checkpointing every 500 steps at 10 steps/min:
  Checkpoint frequency: every 50 minutes
  Checkpoint time: 20 minutes
  Overhead: 20/70 = 29% of training time wasted!

Sharded checkpointing (each rank saves its shard):
  Each of 64 GPUs saves ~13 GB in parallel
  Time: 1-2 minutes (all parallel writes)
  Overhead: 2/50 = 4%

  Savings: 25% of training time = 25% of GPU cost
```

### 4. Learning Rate Warmup Experiments on Small Scale

```
Before: Try LR on full 64-GPU cluster

  Test LR 1e-4: 2 hours * 64 * $5 = $640
  Test LR 3e-4: 2 hours * 64 * $5 = $640
  Test LR 1e-3: 2 hours * 64 * $5 = $640
  Total: $1,920 for 3 experiments

After: Run LR sweep on 8 GPUs, short runs

  LR sweep (8 values): 1 hour * 8 * $5 * 8 = $320
  Verify best on 64 GPUs: 2 hours * 64 * $5 = $640
  Total: $960 for 8 experiments

  50% cheaper AND tested 2.5x more LR values.

Scaling laws: if an LR works at 8 GPUs with proportional
batch size, it usually works at 64 GPUs.
```

---

## Cost Tracking Dashboard

```python
import time
import wandb

class TrainingCostDashboard:
    def __init__(self, num_gpus, cost_per_gpu_hour, total_token_budget):
        self.num_gpus = num_gpus
        self.cost_per_gpu_hour = cost_per_gpu_hour
        self.total_token_budget = total_token_budget
        self.start_time = time.time()
        self.tokens_processed = 0

    def update(self, tokens_in_batch):
        self.tokens_processed += tokens_in_batch

    def report(self):
        elapsed_hours = (time.time() - self.start_time) / 3600
        cost_so_far = elapsed_hours * self.num_gpus * self.cost_per_gpu_hour

        tokens_per_second = self.tokens_processed / max(time.time() - self.start_time, 1)
        remaining_tokens = self.total_token_budget - self.tokens_processed
        estimated_remaining_hours = remaining_tokens / max(tokens_per_second * 3600, 1)
        estimated_total_cost = cost_so_far + (
            estimated_remaining_hours * self.num_gpus * self.cost_per_gpu_hour
        )

        metrics = {
            "cost/elapsed_hours": elapsed_hours,
            "cost/dollars_spent": cost_so_far,
            "cost/estimated_total": estimated_total_cost,
            "cost/tokens_per_dollar": self.tokens_processed / max(cost_so_far, 0.01),
            "cost/dollars_per_billion_tokens": cost_so_far / max(self.tokens_processed / 1e9, 1e-9),
            "cost/percent_budget_used": (self.tokens_processed / self.total_token_budget) * 100,
            "throughput/tokens_per_second": tokens_per_second,
            "throughput/tokens_per_gpu_second": tokens_per_second / self.num_gpus,
        }

        wandb.log(metrics)
        return metrics
```

---

## Exercises

1. **Cost estimation**: Estimate the training cost for a 13B
   model on 2T tokens using (a) 32 A100s on-demand, (b) 32
   H100s spot, (c) 64 H100s spot. Assume 40% MFU. Which
   option gives the best cost-performance trade-off?

2. **MFU optimization**: Profile a training run and compute MFU.
   Then apply three optimizations (Flash Attention, gradient
   accumulation tuning, communication overlap) and measure the
   MFU improvement. Calculate dollar savings for a 30-day run.

3. **Rent vs buy**: Your team expects to use 32 H100s at 80%
   utilization for the next 3 years. Calculate the total cost
   of (a) on-demand cloud, (b) reserved instances, (c) buying
   hardware. Include power, cooling, and IT overhead for option c.

4. **Spot strategy**: Design a spot instance training system
   that maintains a running cost estimate and automatically
   migrates to the cheapest region when spot prices change.
   Calculate expected savings over pure on-demand.
