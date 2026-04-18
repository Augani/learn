# Lesson 08: Multi-GPU and Distributed Compute — Scaling Beyond One GPU

One GPU is not enough for training large models. A 70B parameter model
needs ~140 GB just for parameters in FP16 — more than any single GPU
holds. This lesson covers how to split work across multiple GPUs: the
interconnects that connect them, and the parallelism strategies that
make distributed training possible.

---

## The Core Idea

When a model or dataset is too large for one GPU, you split the work.
There are three fundamental strategies: split the data, split the model,
or split the pipeline. Each has different trade-offs.

**Analogy: Building a house.** Data parallelism is like hiring multiple
identical construction crews, each building a complete house from
different blueprints (data samples), then averaging their techniques.
Model parallelism is like splitting one house among specialized crews —
one does plumbing, one does electrical, one does framing. Pipeline
parallelism is like an assembly line — one crew pours the foundation,
passes it to the framing crew, who passes it to the roofing crew.

```
Three Parallelism Strategies:

Data Parallelism:
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│GPU 0 │  │GPU 1 │  │GPU 2 │  │GPU 3 │
│      │  │      │  │      │  │      │
│Model │  │Model │  │Model │  │Model │
│(copy)│  │(copy)│  │(copy)│  │(copy)│
│      │  │      │  │      │  │      │
│Data  │  │Data  │  │Data  │  │Data  │
│Batch0│  │Batch1│  │Batch2│  │Batch3│
└──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘
   └────┬────┘────┬────┘────┬────┘
        ▼         ▼         ▼
   Average gradients (AllReduce)

Model Parallelism (Tensor):
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│GPU 0 │  │GPU 1 │  │GPU 2 │  │GPU 3 │
│      │  │      │  │      │  │      │
│Layer │  │Layer │  │Layer │  │Layer │
│Part A│  │Part B│  │Part C│  │Part D│
│      │  │      │  │      │  │      │
│Same data flows through all parts   │
└──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘
   └──►───►──┘──►───►──┘──►───►──┘

Pipeline Parallelism:
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│GPU 0 │  │GPU 1 │  │GPU 2 │  │GPU 3 │
│      │  │      │  │      │  │      │
│Layers│  │Layers│  │Layers│  │Layers│
│ 1-8  │──►│ 9-16 │──►│17-24 │──►│25-32 │
│      │  │      │  │      │  │      │
│Micro │  │Micro │  │Micro │  │Micro │
│batch │  │batch │  │batch │  │batch │
└──────┘  └──────┘  └──────┘  └──────┘
```

---

## GPU Interconnects: NVLink vs PCIe

How fast GPUs can talk to each other determines how well parallelism
works. Slow interconnects create bottlenecks.

```
Interconnect Bandwidth Comparison:

┌─────────────────┬────────────┬──────────────────────┐
│ Interconnect    │ Bandwidth  │ Use Case             │
├─────────────────┼────────────┼──────────────────────┤
│ PCIe Gen 4 x16  │ 32 GB/s    │ Consumer GPUs        │
│ PCIe Gen 5 x16  │ 64 GB/s    │ Next-gen consumer    │
│ NVLink 3.0      │ 600 GB/s   │ A100 (12 links)      │
│ NVLink 4.0      │ 900 GB/s   │ H100 (18 links)      │
│ NVLink 5.0      │ 1,800 GB/s │ B200                 │
│ NVSwitch         │ Full bisec.│ DGX systems          │
│ InfiniBand HDR  │ 200 Gb/s   │ Cross-node            │
│ InfiniBand NDR  │ 400 Gb/s   │ Cross-node (H100)    │
└─────────────────┴────────────┴──────────────────────┘

NVLink vs PCIe:

  PCIe (consumer):
  GPU 0 ◄──32 GB/s──► GPU 1
  Enough for inference, slow for training

  NVLink (datacenter):
  GPU 0 ◄──900 GB/s──► GPU 1
  28× faster than PCIe — critical for training

  DGX H100 (8 GPUs fully connected via NVSwitch):
  ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐
  │GPU 0│───│GPU 1│───│GPU 2│───│GPU 3│
  └──┬──┘   └──┬──┘   └──┬──┘   └──┬──┘
     │    ╲    │    ╲    │    ╲    │
     │     ╲   │     ╲   │     ╲   │
  ┌──┴──┐   ┌──┴──┐   ┌──┴──┐   ┌──┴──┐
  │GPU 4│───│GPU 5│───│GPU 6│───│GPU 7│
  └─────┘   └─────┘   └─────┘   └─────┘
  Every GPU can talk to every other at 900 GB/s
```

---

## Data Parallelism (DP / DDP)

The simplest and most common strategy. Each GPU has a complete copy of
the model and processes a different batch of data. After computing
gradients, all GPUs synchronize via AllReduce.

```
Data Parallelism Step-by-Step:

1. Copy model to all GPUs
   GPU 0: model (copy)    GPU 1: model (copy)

2. Split batch across GPUs
   GPU 0: batch[0:16]     GPU 1: batch[16:32]

3. Forward pass (independent)
   GPU 0: loss_0          GPU 1: loss_1

4. Backward pass (independent)
   GPU 0: grads_0         GPU 1: grads_1

5. AllReduce: average gradients across GPUs
   GPU 0: avg_grads       GPU 1: avg_grads
   (both GPUs now have identical averaged gradients)

6. Update weights (independent, same result)
   GPU 0: updated model   GPU 1: updated model
   (models stay in sync)
```

```python
import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

# PyTorch DDP example (simplified)
# In practice, you launch this with torchrun

def train_ddp(rank, world_size):
    # Initialize process group
    dist.init_process_group("nccl", rank=rank, world_size=world_size)

    # Create model and wrap with DDP
    model = MyModel().to(rank)
    model = DDP(model, device_ids=[rank])

    # Training loop — DDP handles gradient sync automatically
    for batch in dataloader:
        loss = model(batch)
        loss.backward()       # DDP syncs gradients here (AllReduce)
        optimizer.step()
        optimizer.zero_grad()

# Launch: torchrun --nproc_per_node=4 train.py
```

**Limitation:** Every GPU needs a full copy of the model. A 70B model
in FP16 = 140 GB — does not fit on any single GPU.

---

## Model Parallelism (Tensor Parallelism)

Split individual layers across GPUs. Each GPU holds a slice of each
weight matrix and computes a slice of the output.

```
Tensor Parallelism for a Linear Layer:

  Full layer: Y = X @ W    where W is (4096 × 4096)

  Split W across 4 GPUs (column-wise):

  GPU 0: W[:, 0:1024]     → Y_0 = X @ W_0   (partial output)
  GPU 1: W[:, 1024:2048]  → Y_1 = X @ W_1
  GPU 2: W[:, 2048:3072]  → Y_2 = X @ W_2
  GPU 3: W[:, 3072:4096]  → Y_3 = X @ W_3

  Concatenate: Y = [Y_0, Y_1, Y_2, Y_3]

  Each GPU stores 1/4 of the weights
  Requires fast interconnect (NVLink) for the concatenation step
```

**When to use:** When the model is too large for one GPU's memory.
Requires NVLink — too slow over PCIe.

---

## Pipeline Parallelism

Split the model by layers. GPU 0 runs layers 1-8, GPU 1 runs layers
9-16, etc. Data flows through the pipeline.

```
Pipeline Parallelism (naive):

Time →
GPU 0: [Forward L1-8 ] [          idle          ] [Backward L1-8 ]
GPU 1: [    idle      ] [Forward L9-16] [  idle  ] [Backward L9-16]
GPU 2: [    idle      ] [    idle     ] [Fwd L17-24] [Bwd L17-24 ]

Problem: "pipeline bubble" — GPUs sit idle waiting for data

Pipeline Parallelism (micro-batching):

Time →
GPU 0: [F_mb1][F_mb2][F_mb3][F_mb4][B_mb4][B_mb3][B_mb2][B_mb1]
GPU 1:        [F_mb1][F_mb2][F_mb3][F_mb4][B_mb4][B_mb3][B_mb2]
GPU 2:               [F_mb1][F_mb2][F_mb3][F_mb4][B_mb4][B_mb3]

Split the batch into micro-batches to keep GPUs busy.
Still some bubble, but much less idle time.
```

---

## Combining Strategies: 3D Parallelism

Large-scale training (GPT-3, LLaMA, etc.) uses all three strategies
simultaneously:

```
3D Parallelism (example: 64 GPUs):

┌─────────────────────────────────────────────┐
│  Data Parallel Group 1    (8 GPUs)          │
│  ┌─────────────────────────────────────┐    │
│  │ Pipeline Stage 1  │ Pipeline Stage 2│    │
│  │ ┌───┐ ┌───┐       │ ┌───┐ ┌───┐    │    │
│  │ │TP0│ │TP1│       │ │TP0│ │TP1│    │    │
│  │ └───┘ └───┘       │ └───┘ └───┘    │    │
│  │ ┌───┐ ┌───┐       │ ┌───┐ ┌───┐    │    │
│  │ │TP2│ │TP3│       │ │TP2│ │TP3│    │    │
│  │ └───┘ └───┘       │ └───┘ └───┘    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Data Parallel Group 2    (8 GPUs)          │
│  (same structure, different data)           │
│  ...                                        │
│                                             │
│  × 8 data parallel groups = 64 GPUs total   │
└─────────────────────────────────────────────┘

Tensor Parallel: 4 GPUs per layer (within a node, NVLink)
Pipeline Parallel: 2 stages (across nodes, InfiniBand)
Data Parallel: 8 replicas (across nodes, InfiniBand)
```

For deeper coverage of distributed training strategies, see:
- [Advanced Deep Learning Lesson 13: Distributed Training](../advanced-deep-learning/13-distributed-training.md)
- [Advanced LLM Engineering Lesson 10: Multi-GPU Inference](../advanced-llm-engineering/10-multi-gpu-inference.md)

---

## Exercises

### Exercise 1: Choose the Strategy

```
For each scenario, which parallelism strategy (or combination)
would you use?

1. Training a 1B model on 4× RTX 4090 (24 GB each, PCIe)
2. Training a 70B model on 8× H100 (80 GB each, NVLink)
3. Inference for a 13B model on 2× RTX 3090 (24 GB each, PCIe)
4. Training a 175B model on 512 GPUs across 64 nodes
```

### Exercise 2: Communication Cost

```
Calculate the communication overhead for AllReduce:

Model: 7B parameters in FP16 = 14 GB of gradients

1. With 4 GPUs connected via PCIe Gen 4 (32 GB/s):
   AllReduce sends ~2× the data (ring AllReduce).
   Time = 2 × 14 GB / 32 GB/s = ___ seconds

2. With 4 GPUs connected via NVLink 4.0 (900 GB/s):
   Time = 2 × 14 GB / 900 GB/s = ___ seconds

3. If one training step takes 500 ms of compute,
   what percentage is communication overhead in each case?
```

### Exercise 3: Memory Planning

```python
def plan_parallelism(
    model_params_billions,
    num_gpus,
    gpu_memory_gb,
    interconnect="nvlink",
):
    """
    TODO: Given a model size and hardware setup, recommend a
    parallelism strategy.

    Rules of thumb:
    - If model fits on one GPU (FP16): use Data Parallelism
    - If model fits on one GPU (INT4): use Data Parallelism + quantization
    - If model needs 2-8 GPUs: use Tensor Parallelism (if NVLink)
      or Pipeline Parallelism (if PCIe)
    - If model needs >8 GPUs: use 3D Parallelism

    Return: recommended strategy and memory per GPU
    """
    pass

# Test cases
plan_parallelism(7, 4, 24, "pcie")      # 4× RTX 4090
plan_parallelism(70, 8, 80, "nvlink")    # 8× H100
plan_parallelism(175, 64, 80, "nvlink")  # 64× H100
```

---

Next: [Lesson 09: Profiling and Debugging GPU Code](./09-profiling-debugging.md)
