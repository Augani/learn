# Lesson 03: Distributed Training Patterns

> **Analogy**: You're cooking Thanksgiving dinner for 200 people.
> **Data parallelism** is having 8 kitchens all cooking the same
> recipe with different ingredients. **Model parallelism** is one
> kitchen where different stations handle appetizers, mains, and
> desserts sequentially. **Tensor parallelism** is one station
> where 4 chefs each chop a quarter of the same pile of vegetables.
> **Pipeline parallelism** is a factory assembly line -- station 1
> passes to station 2 as soon as it's done. **Expert parallelism**
> is having specialist chefs who only activate for certain dishes.

---

## The Five Parallelism Strategies

```
+-------------------+----------------+------------------+-----------+
| Strategy          | What's Split   | Communication    | Best For  |
+-------------------+----------------+------------------+-----------+
| Data Parallel     | Batches        | Gradients        | Most      |
|                   |                | (all-reduce)     | cases     |
+-------------------+----------------+------------------+-----------+
| Model Parallel    | Layers         | Activations      | Very deep |
| (Pipeline)        |                | (point-to-point) | models    |
+-------------------+----------------+------------------+-----------+
| Tensor Parallel   | Weight         | Partial results  | Wide      |
|                   | matrices       | (all-reduce)     | layers    |
+-------------------+----------------+------------------+-----------+
| Pipeline Parallel | Layer groups   | Activations      | Deep      |
|                   | + micro-batches| (point-to-point) | models    |
+-------------------+----------------+------------------+-----------+
| Expert Parallel   | Expert         | Routing tokens   | MoE       |
|                   | sub-networks   | (all-to-all)     | models    |
+-------------------+----------------+------------------+-----------+
```

---

## Data Parallelism (DP)

The simplest and most widely used. Every GPU holds a complete
copy of the model. Each GPU processes a different subset of
the batch. Gradients are averaged across GPUs.

```
Step-by-step:

  1. Broadcast model to all GPUs
     GPU 0: Model (source)  --broadcast-->  GPU 1, 2, 3

  2. Split batch
     Full batch: [B0, B1, B2, B3]
     GPU 0: B0    GPU 1: B1    GPU 2: B2    GPU 3: B3

  3. Forward + Backward (independent, parallel)
     GPU 0: grad_0    GPU 1: grad_1    GPU 2: grad_2    GPU 3: grad_3

  4. All-Reduce gradients
     avg_grad = (grad_0 + grad_1 + grad_2 + grad_3) / 4
     All GPUs now have identical avg_grad

  5. Each GPU updates its own copy
     params -= lr * avg_grad
     (identical update => identical models)
```

### When Data Parallelism Works

```
Condition: model + optimizer + gradients + activations fit on 1 GPU

  Model parameters:  P bytes
  Gradients:         P bytes
  Optimizer state:   2P bytes (Adam)
  Activations:       A bytes (depends on batch size, seq_len)

  Total: 4P + A must be < GPU memory

  Example: ResNet-50 (25M params, FP32)
  4 * 25M * 4 bytes = 400 MB
  Activations with batch 256: ~4 GB
  Total: ~4.4 GB -- fits on any modern GPU. Use data parallelism.

  Example: LLaMA 70B (70B params, BF16)
  Parameters alone: 70B * 2 = 140 GB
  Does NOT fit. Need model parallelism.
```

### Communication Cost of All-Reduce

The ring all-reduce algorithm sends `2 * (N-1)/N * D` bytes
per GPU, where N is the number of GPUs and D is the data size.
For large N, this approaches `2 * D`.

```
Example: 7B params in BF16, 64 GPUs

  D = 7B * 2 bytes = 14 GB
  Bytes per GPU: ~2 * 14 GB = 28 GB
  InfiniBand bandwidth: 50 GB/s

  Communication time: 28 GB / 50 GB/s = 0.56 seconds

  If forward+backward takes 2 seconds:
  Communication overhead: 0.56 / 2.56 = 22%

  This is borderline. With gradient compression or overlap,
  it's manageable. Without, you're wasting 22% of your cluster.
```

---

## Model Parallelism (Naive)

Split the model's layers across GPUs. GPU 0 runs layers 0-11,
GPU 1 runs layers 12-23, etc.

```
Naive Model Parallelism:

  GPU 0         GPU 1         GPU 2         GPU 3
  Layers 0-11   Layers 12-23  Layers 24-35  Layers 36-47

  Forward:
  Time 0: GPU 0 computes    (GPUs 1,2,3 IDLE)
  Time 1: GPU 1 computes    (GPUs 0,2,3 IDLE)
  Time 2: GPU 2 computes    (GPUs 0,1,3 IDLE)
  Time 3: GPU 3 computes    (GPUs 0,1,2 IDLE)

  Backward:
  Time 4: GPU 3 computes    (GPUs 0,1,2 IDLE)
  Time 5: GPU 2 computes    (GPUs 0,1,3 IDLE)
  Time 6: GPU 1 computes    (GPUs 0,2,3 IDLE)
  Time 7: GPU 0 computes    (GPUs 1,2,3 IDLE)

  Utilization: 1/4 = 25%    TERRIBLE.
```

This is called the **pipeline bubble** problem. Only one GPU
is active at a time. Pipeline parallelism (below) fixes this.

---

## Tensor Parallelism (TP)

Instead of splitting layers across GPUs, split individual
weight matrices. Each GPU computes a portion of each layer
and they combine results.

Think of it like splitting a large matrix multiplication:

```
Full computation (single GPU):
  Y = XW    where W is [4096 x 4096]

Tensor parallel across 4 GPUs:
  Split W into 4 column chunks:
  W = [W0 | W1 | W2 | W3]   each Wi is [4096 x 1024]

  GPU 0: Y0 = X @ W0        GPU 1: Y1 = X @ W1
  GPU 2: Y2 = X @ W2        GPU 3: Y3 = X @ W3

  Y = [Y0 | Y1 | Y2 | Y3]  (all-gather to reassemble)
```

### Tensor Parallelism in Transformers

For a transformer, we split the attention heads and the MLP:

```
Self-Attention with TP=4:

  Input X (replicated on all GPUs)
      |
  +---+---+---+---+
  |   |   |   |   |
  v   v   v   v   v
  Q0  Q1  Q2  Q3      (each GPU computes its attention heads)
  K0  K1  K2  K3
  V0  V1  V2  V3
  |   |   |   |
  Attention per head group
  |   |   |   |
  O0  O1  O2  O3
  |   |   |   |
  +---+---+---+
      |
  All-Reduce (sum)
      |
      Y (replicated on all GPUs)

MLP with TP=4:

  Input X (replicated)
      |
  +---+---+---+---+
  |   |   |   |   |
  Column-split Linear (no communication)
  |   |   |   |   |
  GeLU (independent)
  |   |   |   |   |
  Row-split Linear
  |   |   |   |   |
  +---+---+---+---+
      |
  All-Reduce (sum)
      |
      Y (replicated)
```

Each transformer layer requires **2 all-reduce operations**
(one for attention, one for MLP). This is why tensor parallelism
needs NVLink-speed interconnect -- you're doing all-reduce
at every layer.

```python
import torch
import torch.distributed as dist

class ColumnParallelLinear(torch.nn.Module):
    def __init__(self, in_features, out_features, world_size, rank):
        super().__init__()
        self.rank = rank
        self.world_size = world_size
        self.local_out = out_features // world_size
        self.linear = torch.nn.Linear(in_features, self.local_out, bias=False)

    def forward(self, x):
        return self.linear(x)


class RowParallelLinear(torch.nn.Module):
    def __init__(self, in_features, out_features, world_size, rank):
        super().__init__()
        self.rank = rank
        self.world_size = world_size
        self.local_in = in_features // world_size
        self.linear = torch.nn.Linear(self.local_in, out_features, bias=False)

    def forward(self, x):
        local_out = self.linear(x)
        dist.all_reduce(local_out, op=dist.ReduceOp.SUM)
        return local_out
```

### When to Use Tensor Parallelism

```
TP degree    Use case
----------------------------------------------------------
TP=1         Model fits on 1 GPU
TP=2         Model barely fits; halving memory per layer helps
TP=4         Standard for models 30B-65B on 8-GPU nodes
TP=8         Large models (65B+) on a single 8-GPU node
TP>8         Rarely used -- crosses node boundary, too slow
```

Rule: **TP should stay within a single NVLink domain** (usually
8 GPUs). If you need more parallelism, use pipeline or data
parallelism across nodes.

---

## Pipeline Parallelism (PP)

Pipeline parallelism is model parallelism done right. Instead
of processing one micro-batch at a time, you split the batch
into micro-batches and pipeline them.

```
Naive Model Parallel (1 micro-batch):

  Time:  1   2   3   4   5   6   7   8
  GPU 0: F               B
  GPU 1:     F               B
  GPU 2:         F               B
  GPU 3:             F               B
  Bubble: 75%

GPipe (4 micro-batches):

  Time:  1   2   3   4   5   6   7   8   9  10
  GPU 0: F0  F1  F2  F3              B3  B2  B1  B0
  GPU 1:     F0  F1  F2  F3          B3  B2  B1  B0
  GPU 2:         F0  F1  F2  F3      B3  B2  B1  B0
  GPU 3:             F0  F1  F2  F3  B3  B2  B1  B0

  Bubble: (p-1)/(p-1+m) where p=stages, m=micro-batches
  With p=4, m=4: 3/7 = 43%   Better, but still large.

  With p=4, m=16: 3/19 = 16%  Acceptable.
  With p=4, m=32: 3/35 = 9%   Good.
```

### 1F1B Schedule (Interleaved)

The 1F1B (one forward, one backward) schedule from PipeDream
reduces memory usage by starting backward passes early:

```
1F1B Schedule (4 stages, 8 micro-batches):

  Time:  1   2   3   4   5   6   7   8   9  10  11
  GPU 0: F0  F1  F2  F3  B0  F4  B1  F5  B2  F6  B3 ...
  GPU 1:     F0  F1  F2  B0  F3  B1  F4  B2  F5  B3 ...
  GPU 2:         F0  F1  B0  F2  B1  F3  B2  F4  B3 ...
  GPU 3:             F0  B0  F1  B1  F2  B2  F3  B3 ...

  Memory: each GPU only holds activations for ~p micro-batches
  (not all m like GPipe)
```

---

## Expert Parallelism (EP)

Used in Mixture-of-Experts (MoE) models like Mixtral. Each GPU
holds different expert sub-networks. A router decides which
tokens go to which experts.

```
MoE Layer (8 experts, 4 GPUs, top-2 routing):

  Input tokens: [t0, t1, t2, t3, t4, t5, t6, t7]

  Router decides:
    t0 -> Expert 2, 5
    t1 -> Expert 0, 3
    t2 -> Expert 1, 7
    ...

  GPU 0: Experts 0, 1    GPU 1: Experts 2, 3
  GPU 2: Experts 4, 5    GPU 3: Experts 6, 7

  All-to-All communication:
    Each GPU sends tokens to the GPU hosting their assigned expert
    GPU 0 sends t0 to GPU 1 (Expert 2) and GPU 2 (Expert 5)
    GPU 0 receives tokens destined for Expert 0, 1

  Each GPU processes its experts' tokens independently

  All-to-All again: send results back to original GPUs
```

The all-to-all communication pattern is fundamentally different
from all-reduce. Every GPU sends unique data to every other GPU.

```python
import torch
import torch.distributed as dist

def expert_parallel_forward(tokens, router_logits, experts, num_experts_per_gpu):
    routing_weights = torch.softmax(router_logits, dim=-1)
    top_k_weights, top_k_indices = torch.topk(routing_weights, k=2, dim=-1)

    dispatched = torch.zeros_like(tokens).repeat(num_experts_per_gpu, 1, 1)
    for expert_idx in range(num_experts_per_gpu):
        mask = (top_k_indices == expert_idx + dist.get_rank() * num_experts_per_gpu).any(dim=-1)
        dispatched[expert_idx][mask] = tokens[mask]

    received = torch.empty_like(dispatched)
    dist.all_to_all_single(received, dispatched)

    expert_outputs = torch.zeros_like(received)
    for i, expert in enumerate(experts):
        expert_outputs[i] = expert(received[i])

    final = torch.empty_like(expert_outputs)
    dist.all_to_all_single(final, expert_outputs)

    return final
```

---

## Communication Primitives

Every distributed strategy builds on a few primitives:

```
ALL-REDUCE: Everyone contributes, everyone gets the result
  GPU 0: [1,2]  GPU 1: [3,4]  GPU 2: [5,6]  GPU 3: [7,8]
  After all-reduce (sum):
  GPU 0: [16,20] GPU 1: [16,20] GPU 2: [16,20] GPU 3: [16,20]

  Used by: Data parallelism (gradient averaging)

ALL-GATHER: Everyone contributes a piece, everyone gets the whole
  GPU 0: [A]  GPU 1: [B]  GPU 2: [C]  GPU 3: [D]
  After all-gather:
  GPU 0: [A,B,C,D]  GPU 1: [A,B,C,D]  GPU 2: [A,B,C,D]  GPU 3: [A,B,C,D]

  Used by: FSDP (reconstructing parameters before forward pass)

REDUCE-SCATTER: Everyone contributes, each gets a reduced piece
  GPU 0: [1,2,3,4]  GPU 1: [5,6,7,8]  GPU 2: [9,10,11,12]  GPU 3: [13,14,15,16]
  After reduce-scatter (sum):
  GPU 0: [28]  GPU 1: [32]  GPU 2: [36]  GPU 3: [40]

  Used by: FSDP (sharding gradients after backward pass)

ALL-TO-ALL: Everyone sends unique data to everyone else
  GPU 0: [A0,A1,A2,A3]  GPU 1: [B0,B1,B2,B3]
  GPU 2: [C0,C1,C2,C3]  GPU 3: [D0,D1,D2,D3]
  After all-to-all:
  GPU 0: [A0,B0,C0,D0]  GPU 1: [A1,B1,C1,D1]
  GPU 2: [A2,B2,C2,D2]  GPU 3: [A3,B3,C3,D3]

  Used by: Expert parallelism (routing tokens to experts)

BROADCAST: One GPU sends to all others
  GPU 0: [DATA]  GPU 1: []  GPU 2: []  GPU 3: []
  After broadcast from GPU 0:
  GPU 0: [DATA]  GPU 1: [DATA]  GPU 2: [DATA]  GPU 3: [DATA]

  Used by: Initial model distribution
```

### Bandwidth Cost Comparison

```
For N GPUs, each with D bytes of data:

+-------------------+----------------------+------------------+
| Operation         | Bytes per GPU        | Total across net |
+-------------------+----------------------+------------------+
| All-Reduce        | 2D * (N-1)/N ≈ 2D   | 2D * (N-1)       |
| All-Gather        | D * (N-1)/N ≈ D     | D * (N-1)        |
| Reduce-Scatter    | D * (N-1)/N ≈ D     | D * (N-1)        |
| All-to-All        | D * (N-1)/N ≈ D     | D * (N-1)        |
| Broadcast         | D                    | D * (N-1)        |
+-------------------+----------------------+------------------+

Note: All-Reduce = Reduce-Scatter + All-Gather
```

---

## Combining Strategies: 3D Parallelism

Real large-model training uses multiple strategies simultaneously:

```
3D Parallelism for a 175B model on 512 GPUs:

  512 GPUs = 64 nodes * 8 GPUs/node

  Tensor Parallel (TP=8):  within a node (NVLink)
  Pipeline Parallel (PP=8): across 8 node-groups
  Data Parallel (DP=8):     across 8 replicas

  TP=8 * PP=8 * DP=8 = 512 GPUs  ✓

  +------ DP Group 0 ------+  +------ DP Group 1 ------+
  |                         |  |                         |
  | PP Stage 0 (TP=8)      |  | PP Stage 0 (TP=8)      |
  | [GPU 0-7 on Node 0]    |  | [GPU 0-7 on Node 8]    |
  |         |               |  |         |               |
  | PP Stage 1 (TP=8)      |  | PP Stage 1 (TP=8)      |
  | [GPU 0-7 on Node 1]    |  | [GPU 0-7 on Node 9]    |
  |         |               |  |         |               |
  |        ...              |  |        ...              |
  |         |               |  |         |               |
  | PP Stage 7 (TP=8)      |  | PP Stage 7 (TP=8)      |
  | [GPU 0-7 on Node 7]    |  | [GPU 0-7 on Node 15]   |
  |                         |  |                         |
  +-------------------------+  +-------------------------+
               DP sync (all-reduce) across groups
```

### Decision Matrix

```
+-----------------------------------+-------------------------------+
| Situation                         | Strategy                      |
+-----------------------------------+-------------------------------+
| Model fits on 1 GPU               | Data Parallel (DDP)           |
| Model fits with optimizer sharding | FSDP / DeepSpeed ZeRO        |
| Model doesn't fit on 1 GPU        | TP within node + PP across    |
| Very large model (100B+)          | 3D: TP + PP + DP              |
| MoE model                         | EP + DP (+ optionally TP/PP)  |
| Training with limited network     | Maximize DP, minimize TP      |
| Training with NVLink/NVSwitch     | TP=8 within node is standard  |
+-----------------------------------+-------------------------------+
```

---

## Overlapping Communication and Computation

The real performance wins come from hiding communication behind
computation. Modern frameworks do this automatically, but
understanding the principle helps you debug slow training.

```
Without overlap:
  |--Compute--|--Communicate--|--Compute--|--Communicate--|
  Total: T_compute + T_communicate per step

With overlap (backward pass):
  Layer N backward:   |--Compute grads--|
  Layer N-1 all-reduce:                  |--Communicate--|
  Layer N-1 backward:                    |--Compute grads--|
  Layer N-2 all-reduce:                                   |--Comm--|

  As each layer's gradients are computed, the PREVIOUS layer's
  gradients are being communicated simultaneously.
  Total: max(T_compute, T_communicate)  (if balanced)
```

PyTorch DDP does this automatically by bucketing gradients and
starting all-reduce for each bucket as soon as it's ready:

```python
ddp_model = DDP(
    model,
    device_ids=[rank],
    bucket_cap_mb=25,
    gradient_as_bucket_view=True,
    static_graph=True,
)
```

---

## Exercises

1. **Memory calculation**: For a 13B transformer (40 layers,
   hidden_dim=5120, 40 heads) with BF16 training and Adam:
   (a) Calculate memory with pure DP on 8 GPUs
   (b) Calculate memory with TP=4 + DP=2 on 8 GPUs
   (c) Calculate memory with TP=8 on 8 GPUs

2. **Communication analysis**: For 70B params in BF16, compute
   the all-reduce time for DP=64 over 400 Gb/s InfiniBand.
   Compare with TP=8 (NVLink 900 GB/s) per-layer overhead for
   hidden_dim=8192.

3. **Pipeline bubble**: Calculate the bubble fraction for PP=8
   with m=4, 8, 16, 32 micro-batches. At what point is the
   bubble acceptable (<10%)?

4. **Design exercise**: You have 256 H100 GPUs (32 nodes) and
   need to train a 65B parameter model. Propose a 3D parallelism
   configuration and justify your choices.
