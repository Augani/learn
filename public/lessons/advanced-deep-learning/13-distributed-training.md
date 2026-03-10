# Lesson 13: Distributed Training

> **Analogy**: Splitting a textbook across a study group. One
> person can't read a 1000-page book in a day. But if 8 people
> each read 125 pages and share notes, the group finishes fast.
> Distributed training splits work across multiple GPUs the
> same way.

---

## Why Distribute?

```
Single GPU training:

  Model: 7B parameters = ~28 GB in FP32
  GPU memory: 24 GB (RTX 4090)

  Problem: model doesn't even FIT, let alone train.

  Even if it fits:
  +--------------------------------------------------+
  | Dataset: 1T tokens                                |
  | Single GPU throughput: 1000 tokens/sec            |
  | Time: 1T / 1000 = 1 billion seconds = 31 YEARS   |
  +--------------------------------------------------+

  With 256 GPUs:
  +--------------------------------------------------+
  | Throughput: ~200K tokens/sec                      |
  | Time: ~58 days                                    |
  +--------------------------------------------------+
```

---

## The Two Dimensions of Parallelism

```
  DATA PARALLELISM                MODEL PARALLELISM
  (same model, split data)       (split model, same data)

  GPU 0: Model copy + Batch 0    GPU 0: Layers 0-11
  GPU 1: Model copy + Batch 1    GPU 1: Layers 12-23
  GPU 2: Model copy + Batch 2    GPU 2: Layers 24-35
  GPU 3: Model copy + Batch 3    GPU 3: Layers 36-47

  Like: 4 study groups each      Like: 4 people each reading
  reading the same textbook       different chapters of ONE
  but different problem sets      textbook

  Pro: Simple, scales well        Pro: Handles huge models
  Con: Each GPU needs full model  Con: GPUs wait for each other
```

---

## Data Parallel (DP) -- The Basics

```
  Step 1: Copy model to each GPU
  +-------+  +-------+  +-------+  +-------+
  | Model |  | Model |  | Model |  | Model |
  | copy  |  | copy  |  | copy  |  | copy  |
  +-------+  +-------+  +-------+  +-------+
  GPU 0      GPU 1      GPU 2      GPU 3

  Step 2: Split batch across GPUs
  Full batch: [sample0, sample1, ..., sample31]
  GPU 0: [sample0  .. sample7 ]
  GPU 1: [sample8  .. sample15]
  GPU 2: [sample16 .. sample23]
  GPU 3: [sample24 .. sample31]

  Step 3: Each GPU computes forward + backward pass

  Step 4: ALL-REDUCE gradients (average across GPUs)
  GPU 0 grads --\
  GPU 1 grads ---+-- Average --> Same averaged grads to all GPUs
  GPU 2 grads ---+
  GPU 3 grads --/

  Step 5: Each GPU updates its model copy identically
```

---

## PyTorch DistributedDataParallel (DDP)

```python
import torch
import torch.distributed as dist
import torch.nn as nn
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader, DistributedSampler


def setup(rank, world_size):
    dist.init_process_group("nccl", rank=rank, world_size=world_size)
    torch.cuda.set_device(rank)


def cleanup():
    dist.destroy_process_group()


def train(rank, world_size, epochs=10):
    setup(rank, world_size)

    model = nn.Sequential(
        nn.Linear(784, 512),
        nn.ReLU(),
        nn.Linear(512, 256),
        nn.ReLU(),
        nn.Linear(256, 10),
    ).to(rank)

    ddp_model = DDP(model, device_ids=[rank])

    optimizer = torch.optim.Adam(ddp_model.parameters(), lr=1e-3)
    loss_fn = nn.CrossEntropyLoss()

    dataset = load_your_dataset()
    sampler = DistributedSampler(dataset, num_replicas=world_size, rank=rank)
    dataloader = DataLoader(dataset, batch_size=64, sampler=sampler)

    for epoch in range(epochs):
        sampler.set_epoch(epoch)
        for batch_x, batch_y in dataloader:
            batch_x = batch_x.to(rank)
            batch_y = batch_y.to(rank)

            optimizer.zero_grad()
            output = ddp_model(batch_x)
            loss = loss_fn(output, batch_y)
            loss.backward()
            optimizer.step()

    cleanup()
```

Launch with torchrun:

```bash
torchrun --nproc_per_node=4 train.py
```

---

## The All-Reduce Operation

```
  All-Reduce: every GPU ends up with the SAME averaged result

  Before:               After All-Reduce:
  GPU 0: [1, 2, 3]     GPU 0: [2.5, 3.5, 4.5]
  GPU 1: [4, 5, 6]     GPU 1: [2.5, 3.5, 4.5]

  Ring All-Reduce (how it actually works):

  GPUs arranged in a ring:

       GPU 0
      /     \
   GPU 3   GPU 1
      \     /
       GPU 2

  Phase 1: Reduce-Scatter
    Each GPU sends a chunk to its neighbor
    After N-1 steps, each GPU has the sum of one chunk

  Phase 2: All-Gather
    Each GPU sends its completed chunk around
    After N-1 steps, every GPU has all chunks

  Total data transferred per GPU: 2 * (N-1)/N * model_size
  This is INDEPENDENT of number of GPUs (nearly)
```

---

## Model Parallelism -- Pipeline Parallel

```
  Split model layers across GPUs:

  Input --> [GPU 0: Layers 0-5] --> [GPU 1: Layers 6-11] --> Output

  Problem: Naive approach wastes time (bubble problem)

  Naive Pipeline (X = computing, . = idle):
  Time -->  1  2  3  4  5  6  7  8
  GPU 0:    X  .  .  .  X  .  .  .
  GPU 1:    .  X  .  .  .  X  .  .
  GPU 2:    .  .  X  .  .  .  X  .
  GPU 3:    .  .  .  X  .  .  .  X

  GPipe micro-batching (split batch into micro-batches):
  Time -->  1  2  3  4  5  6  7
  GPU 0:    M1 M2 M3 M4 .  .  .
  GPU 1:    .  M1 M2 M3 M4 .  .
  GPU 2:    .  .  M1 M2 M3 M4 .
  GPU 3:    .  .  .  M1 M2 M3 M4

  Much less idle time (smaller "bubble")
```

---

## Tensor Parallelism

Split individual layers across GPUs:

```
  A single large matrix multiply:

  Y = X @ W    where W is [4096 x 4096]

  Split W across 4 GPUs by columns:
  GPU 0: Y0 = X @ W[:, 0:1024]
  GPU 1: Y1 = X @ W[:, 1024:2048]
  GPU 2: Y2 = X @ W[:, 2048:3072]
  GPU 3: Y3 = X @ W[:, 3072:4096]

  Then concatenate: Y = [Y0, Y1, Y2, Y3]

  For attention heads (naturally parallel):
  GPU 0: heads 0-7
  GPU 1: heads 8-15
  GPU 2: heads 16-23
  GPU 3: heads 24-31
```

---

## FSDP: Fully Sharded Data Parallelism

```
  DDP Problem:
  Each GPU stores FULL model + optimizer states
  7B model: ~28GB weights + ~56GB optimizer = ~84GB per GPU

  FSDP Solution:
  SHARD everything across GPUs

  4 GPUs with FSDP:
  +----------+  +----------+  +----------+  +----------+
  | Params   |  | Params   |  | Params   |  | Params   |
  | shard 0  |  | shard 1  |  | shard 2  |  | shard 3  |
  | Grads    |  | Grads    |  | Grads    |  | Grads    |
  | shard 0  |  | shard 1  |  | shard 2  |  | shard 3  |
  | Optim    |  | Optim    |  | Optim    |  | Optim    |
  | shard 0  |  | shard 1  |  | shard 2  |  | shard 3  |
  +----------+  +----------+  +----------+  +----------+

  Memory per GPU: total_memory / num_gpus

  When a layer needs to compute:
  1. All-gather: collect full parameters from all GPUs
  2. Compute forward/backward
  3. Reduce-scatter: distribute gradients back to shards
  4. Each GPU updates only its shard
```

```python
import torch
from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
from torch.distributed.fsdp import ShardingStrategy


def train_with_fsdp(rank, world_size):
    setup(rank, world_size)

    model = build_large_model()

    fsdp_model = FSDP(
        model,
        sharding_strategy=ShardingStrategy.FULL_SHARD,
        device_id=rank,
        use_orig_params=True,
    )

    optimizer = torch.optim.AdamW(fsdp_model.parameters(), lr=1e-4)

    for epoch in range(num_epochs):
        for batch in dataloader:
            optimizer.zero_grad()
            loss = fsdp_model(batch)
            loss.backward()
            optimizer.step()

    cleanup()
```

---

## DeepSpeed ZeRO Stages

```
  ZeRO = Zero Redundancy Optimizer

  Stage 0: Standard DDP (full replication)
  Memory per GPU: params + grads + optimizer
  Example (7B): 28 + 28 + 56 = 112 GB

  Stage 1: Shard optimizer states
  Memory per GPU: params + grads + optimizer/N
  Example (7B, 4 GPUs): 28 + 28 + 14 = 70 GB

  Stage 2: Shard optimizer + gradients
  Memory per GPU: params + grads/N + optimizer/N
  Example (7B, 4 GPUs): 28 + 7 + 14 = 49 GB

  Stage 3: Shard everything (same as FSDP)
  Memory per GPU: params/N + grads/N + optimizer/N
  Example (7B, 4 GPUs): 7 + 7 + 14 = 28 GB

  +--------+----------+----------+--------------+
  | Stage  | Shards   | Memory   | Communication|
  +--------+----------+----------+--------------+
  | 0      | Nothing  | Highest  | Lowest       |
  | 1      | Optim    | High     | Low          |
  | 2      | Opt+Grad | Medium   | Medium       |
  | 3      | All      | Lowest   | Highest      |
  +--------+----------+----------+--------------+
```

```python
import deepspeed

ds_config = {
    "train_batch_size": 256,
    "gradient_accumulation_steps": 4,
    "fp16": {"enabled": True},
    "zero_optimization": {
        "stage": 2,
        "offload_optimizer": {"device": "cpu"},
        "allgather_partitions": True,
        "reduce_scatter": True,
        "overlap_comm": True,
    },
}

model = build_large_model()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)

model_engine, optimizer, _, _ = deepspeed.initialize(
    model=model,
    optimizer=optimizer,
    config=ds_config,
)

for batch in dataloader:
    loss = model_engine(batch)
    model_engine.backward(loss)
    model_engine.step()
```

---

## 3D Parallelism -- Combining Everything

```
  For training models like GPT-4 / Llama 70B:

  +---------------------------------------------------+
  |               3D Parallelism                       |
  |                                                    |
  |  Tensor Parallel (within a node):                  |
  |    Split layers across 8 GPUs in one machine       |
  |                                                    |
  |  Pipeline Parallel (across nodes):                 |
  |    Split layer groups across machines              |
  |                                                    |
  |  Data Parallel (across replica groups):            |
  |    Multiple copies of the full pipeline            |
  +---------------------------------------------------+

  Example: 256 GPUs
  - 8-way tensor parallel (within each node)
  - 4-way pipeline parallel (4 stages)
  - 8-way data parallel (8 replicas)
  - 8 x 4 x 8 = 256 GPUs

  Node 0 (8 GPUs): TP group, Pipeline Stage 0, DP replica 0
  Node 1 (8 GPUs): TP group, Pipeline Stage 1, DP replica 0
  Node 2 (8 GPUs): TP group, Pipeline Stage 2, DP replica 0
  Node 3 (8 GPUs): TP group, Pipeline Stage 3, DP replica 0
  Node 4 (8 GPUs): TP group, Pipeline Stage 0, DP replica 1
  ...
```

---

## Gradient Accumulation

When you can't fit a large batch in memory, accumulate over steps:

```python
accumulation_steps = 8
effective_batch_size = per_gpu_batch * num_gpus * accumulation_steps

optimizer.zero_grad()
for step, batch in enumerate(dataloader):
    loss = model(batch) / accumulation_steps
    loss.backward()

    if (step + 1) % accumulation_steps == 0:
        optimizer.step()
        optimizer.zero_grad()
```

```
  Without accumulation (batch=8, want effective=64):
  Need 8x more GPU memory  --> OOM!

  With accumulation (8 steps of batch=8):
  Step 1: forward+backward, accumulate grads
  Step 2: forward+backward, accumulate grads
  ...
  Step 8: forward+backward, accumulate grads, UPDATE

  Same math as batch=64, fits in memory of batch=8
```

---

## Communication Overhead

```
  +------------------------------------------+
  |  Interconnect speeds matter enormously    |
  +------------------------------------------+
  | PCIe Gen4 x16:  ~32 GB/s                |
  | NVLink 3.0:     ~600 GB/s               |
  | NVLink 4.0:     ~900 GB/s               |
  | InfiniBand HDR: ~200 Gb/s (~25 GB/s)    |
  | Ethernet 100G:  ~12.5 GB/s              |
  +------------------------------------------+

  Rule of thumb:
  - Tensor parallel: needs NVLink (within node)
  - Data parallel: works over InfiniBand (across nodes)
  - Pipeline parallel: moderate bandwidth needed

  Communication-to-compute ratio:
  If compute takes 100ms and communication takes 50ms:
    Efficiency = 100 / (100 + 50) = 67%

  Goal: overlap communication with computation
```

---

## Practical Scaling Strategy

```
  Decision tree:

  Model fits on 1 GPU?
  +-- YES --> Use single GPU (fastest iteration)
  +-- NO
       |
       Model fits on 1 node (8 GPUs)?
       +-- YES --> FSDP or ZeRO Stage 2/3
       +-- NO
            |
            How many nodes?
            +-- 2-8 nodes --> FSDP across nodes
            +-- 8+ nodes --> 3D parallelism (TP + PP + DP)
```

---

## Exercises

1. **DDP basics**: Take a single-GPU training script and convert
   it to use DistributedDataParallel. Train on 2+ GPUs and verify
   you get the same loss curve as single-GPU with matching
   effective batch size.

2. **Gradient accumulation**: Implement gradient accumulation to
   simulate a batch size of 256 using per-GPU batch size of 16.
   Verify loss matches training with actual batch size 256.

3. **FSDP**: Wrap a model with FSDP and measure peak memory per
   GPU vs DDP. How much memory does sharding save?

4. **DeepSpeed config**: Write DeepSpeed configs for ZeRO Stage 1,
   2, and 3. Benchmark throughput (samples/sec) for each stage
   on the same model.

5. **Scaling efficiency**: Train a model on 1, 2, 4, and 8 GPUs.
   Plot throughput vs GPU count. Calculate scaling efficiency
   (actual speedup / ideal speedup). Where does communication
   become a bottleneck?

---

**Next**: [Lesson 14 - Quantization & Mixed Precision](./14-quantization-mixed-precision.md)
