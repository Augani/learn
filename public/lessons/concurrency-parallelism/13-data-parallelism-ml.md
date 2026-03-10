# Lesson 13: Data Parallelism in ML

> Models are too big for one GPU. Data is too big for one GPU.
> Split the work across many GPUs — but how?

---

## The Analogy

Training a model is like studying for an exam using
1 million flashcards.

**Data parallelism**: 8 students each get 125K cards.
They all study the SAME textbook (model), but different
cards (data). They meet periodically to share what they
learned (synchronize gradients).

**Model parallelism**: The textbook is so big that one
student can't carry it. Split chapters across students.
Each student becomes an expert on their chapters.

**Pipeline parallelism**: Like an assembly line. Student 1
reads chapter 1 of each card and passes it on. Student 2
reads chapter 2, etc.

```
  DATA PARALLEL:
  GPU 0: Full model + batch 0 -> gradients 0
  GPU 1: Full model + batch 1 -> gradients 1
  GPU 2: Full model + batch 2 -> gradients 2
  GPU 3: Full model + batch 3 -> gradients 3
         |      |      |      |
         +------+------+------+
         Average gradients (AllReduce)
         Update all models identically

  MODEL PARALLEL:
  GPU 0: Layers 0-5   } data flows through
  GPU 1: Layers 6-11  } GPUs sequentially
  GPU 2: Layers 12-17 }
  GPU 3: Layers 18-23 }

  PIPELINE PARALLEL:
  GPU 0: Layers 0-5   [batch0][batch1][batch2][batch3]
  GPU 1: Layers 6-11         [batch0][batch1][batch2]
  GPU 2: Layers 12-17               [batch0][batch1]
  GPU 3: Layers 18-23                      [batch0]
```

---

## Data Parallelism Deep Dive

```
  STEP-BY-STEP:

  1. REPLICATE model to all N GPUs
  2. SPLIT mini-batch into N micro-batches
  3. Each GPU computes FORWARD pass on its micro-batch
  4. Each GPU computes BACKWARD pass (local gradients)
  5. ALL-REDUCE: average gradients across all GPUs
  6. Each GPU updates its model with averaged gradients

  MATHEMATICAL EQUIVALENCE:

  Single GPU, batch size B:
  gradient = (1/B) * SUM(grad_i for i in batch)

  N GPUs, each with B/N:
  grad_gpu_k = (N/B) * SUM(grad_i for i in micro_batch_k)
  avg_grad   = (1/N) * SUM(grad_gpu_k for k in 0..N)
             = (1/B) * SUM(grad_i for i in full_batch)

  SAME RESULT! Data parallelism is mathematically identical
  to single-GPU training (with same total batch size).
```

---

## AllReduce: The Communication Pattern

```
  ALL-REDUCE: every GPU ends up with the SUM (or AVG)
  of all GPUs' values.

  NAIVE ALL-REDUCE (collect at one node):
  GPU 0: [g0]  <-- collect all, avg, broadcast
  GPU 1: [g1]  --> GPU 0
  GPU 2: [g2]  --> GPU 0
  GPU 3: [g3]  --> GPU 0

  Bottleneck: GPU 0 receives N-1 messages.
  Communication: O(N * model_size)

  RING ALL-REDUCE (optimal):
  GPUs arranged in a ring. Two phases:

  Phase 1: REDUCE-SCATTER
  Each GPU sends a chunk to its neighbor.
  After N-1 steps, each GPU has the SUM of one chunk.

  GPU0 --> GPU1 --> GPU2 --> GPU3 --> GPU0

  Phase 2: ALL-GATHER
  Each GPU sends its completed chunk around the ring.
  After N-1 steps, everyone has everything.

  Communication per GPU: 2 * (N-1)/N * model_size
  Independent of N for large models!

  +---+        +---+        +---+        +---+
  |GPU|------->|GPU|------->|GPU|------->|GPU|
  | 0 |        | 1 |        | 2 |        | 3 |
  +---+<-------+---+<-------+---+<-------+---+
```

---

## PyTorch Data Parallel

```python
import torch
import torch.nn as nn
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader, DistributedSampler
import os

def setup(rank, world_size):
    os.environ['MASTER_ADDR'] = 'localhost'
    os.environ['MASTER_PORT'] = '12355'
    dist.init_process_group("nccl", rank=rank, world_size=world_size)
    torch.cuda.set_device(rank)

def cleanup():
    dist.destroy_process_group()

class SimpleModel(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, output_dim),
        )

    def forward(self, x):
        return self.layers(x)

def train(rank, world_size, epochs=10):
    setup(rank, world_size)

    model = SimpleModel(784, 256, 10).to(rank)
    ddp_model = DDP(model, device_ids=[rank])

    optimizer = torch.optim.Adam(ddp_model.parameters(), lr=0.001)
    criterion = nn.CrossEntropyLoss()

    dataset = torch.utils.data.TensorDataset(
        torch.randn(10000, 784),
        torch.randint(0, 10, (10000,)),
    )
    sampler = DistributedSampler(dataset, num_replicas=world_size, rank=rank)
    dataloader = DataLoader(dataset, batch_size=64, sampler=sampler)

    for epoch in range(epochs):
        sampler.set_epoch(epoch)
        total_loss = 0.0
        for batch_x, batch_y in dataloader:
            batch_x = batch_x.to(rank)
            batch_y = batch_y.to(rank)

            optimizer.zero_grad()
            output = ddp_model(batch_x)
            loss = criterion(output, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if rank == 0:
            print(f"Epoch {epoch}, Loss: {total_loss:.4f}")

    cleanup()
```

---

## Model Parallelism

```
  WHEN DATA PARALLELISM ISN'T ENOUGH:
  Model too big for one GPU's memory.

  GPT-3: 175 billion parameters
  175B * 4 bytes (fp32) = 700 GB
  A100 GPU: 80 GB
  Need at least 9 GPUs just to HOLD the model!

  TENSOR PARALLELISM:
  Split individual layers across GPUs.

  Linear layer: Y = XW + b
  Split W column-wise across 4 GPUs:

  GPU 0: Y0 = X * W0    (W0 = first quarter of columns)
  GPU 1: Y1 = X * W1
  GPU 2: Y2 = X * W2
  GPU 3: Y3 = X * W3

  Y = concat(Y0, Y1, Y2, Y3)

  +---+   +----+----+----+----+   +----+
  |   |   | W0 | W1 | W2 | W3 |   | Y0 |
  | X | x |    |    |    |    | = | Y1 |
  |   |   |    |    |    |    |   | Y2 |
  +---+   +----+----+----+----+   | Y3 |
            GPU0 GPU1 GPU2 GPU3   +----+

  USED BY: Megatron-LM (NVIDIA)
```

---

## Pipeline Parallelism

```
  NAIVE PIPELINE:
  GPU 0 computes layers 0-5,  passes activations to GPU 1.
  GPU 1 computes layers 6-11, passes to GPU 2.
  While GPU 1 works, GPU 0 is IDLE.

  TIME -->
  GPU 0: [===F0===]                    [===F1===]
  GPU 1:          [===F0===]                    [===F1===]
  GPU 2:                   [===F0===]
  GPU 3:                            [===F0===]

  BUBBLE: 75% of GPU time is wasted!

  GPIPE: micro-batching
  Split batch into 4 micro-batches (m0, m1, m2, m3).
  Pipeline them through the stages.

  GPU 0: [m0][m1][m2][m3]
  GPU 1:    [m0][m1][m2][m3]
  GPU 2:       [m0][m1][m2][m3]
  GPU 3:          [m0][m1][m2][m3]

  Bubble shrinks to (stages-1)/(stages+microbatches-1).
  With 4 stages and 16 micro-batches: bubble = 3/19 = 16%.

  1F1B SCHEDULE (PipeDream):
  Interleave forward and backward passes.

  GPU 0: [F0][F1][F2][F3][B0][B1][B2][B3]
  GPU 1:    [F0][F1][F2][B0][B1][B2][B3]
  GPU 2:       [F0][F1][B0][B1][B2][B3]
  GPU 3:          [F0][B0][B1][B2][B3]

  Even less idle time. Used in practice.
```

---

## 3D Parallelism (Combining All Three)

```
  USED FOR: GPT-3, PaLM, Llama at scale

  DATA PARALLEL       x  TENSOR PARALLEL  x  PIPELINE PARALLEL
  (across nodes)         (within node)        (across nodes)

  Node 0 (8 GPUs):
  +---+---+---+---+---+---+---+---+
  | GPU0-3: Stage 0 (TP=4)        |  Data parallel
  | GPU4-7: Stage 1 (TP=4)        |  replica 0
  +---+---+---+---+---+---+---+---+

  Node 1 (8 GPUs):
  +---+---+---+---+---+---+---+---+
  | GPU0-3: Stage 0 (TP=4)        |  Data parallel
  | GPU4-7: Stage 1 (TP=4)        |  replica 1
  +---+---+---+---+---+---+---+---+

  COMMUNICATION PATTERN:
  - Tensor parallel: within node (fast NVLink)
  - Pipeline parallel: between stages (across nodes)
  - Data parallel: between replicas (AllReduce)
```

---

## Memory Optimization Techniques

```
  PROBLEM: even ONE GPU copy of a large model may not fit.

  TECHNIQUE 1: MIXED PRECISION (FP16/BF16)
  Store model in FP16 (2 bytes vs 4 bytes = 50% memory)
  Keep FP32 master copy for updates (prevents precision loss)
  A100 Tensor Cores: 2x throughput for FP16 vs FP32

  TECHNIQUE 2: GRADIENT CHECKPOINTING
  Don't store all activations during forward pass.
  Recompute them during backward pass.
  Trade: 30% more compute for 60% less memory.

  Forward (normal):    store all activations = O(layers * batch)
  Forward (checkpoint): store every Kth = O(layers/K * batch)
  Backward: recompute missing activations from checkpoints

  TECHNIQUE 3: ZeRO (Zero Redundancy Optimizer)
  In data parallelism, each GPU holds full model + optimizer.
  WASTEFUL: optimizer state is 12 bytes/param (Adam)!

  ZeRO Stage 1: partition optimizer states
  ZeRO Stage 2: + partition gradients
  ZeRO Stage 3: + partition model parameters

  4 GPUs, 10B param model:
  Normal DP: each GPU holds 10B params = 40GB each
  ZeRO-3: each GPU holds 2.5B params = 10GB each
```

---

## Scaling Laws

```
  LINEAR SCALING RULE:
  When multiplying batch size by K, multiply learning rate by K.

  WHY: larger batch = more accurate gradient estimate.
  Can take bigger steps.

  WARMUP:
  Large learning rates can destabilize early training.
  Start small, ramp up over first ~1000 steps.

  LR
  |        _______________
  |       /
  |      /
  |     /
  |    /
  +---+---+---+---+---+---+
      warmup   training

  DIMINISHING RETURNS:
  2 GPUs: ~1.9x speedup
  4 GPUs: ~3.6x speedup
  8 GPUs: ~7.0x speedup
  64 GPUs: ~50x speedup
  256 GPUs: ~150x speedup (communication overhead grows)
```

---

## Exercises

### Exercise 1: Communication Cost

Calculate the AllReduce communication time:
- Model: 1 billion parameters (float32)
- 8 GPUs connected by NVLink (300 GB/s per link)
- Ring AllReduce
What fraction of training time is communication?

### Exercise 2: Memory Budget

For a 7B parameter model:
- Calculate memory needed for: model params, optimizer (Adam),
  gradients, activations (batch=32, seq=2048)
- Which memory optimization brings the most savings?

### Exercise 3: Pipeline Bubble

Calculate the pipeline bubble fraction for:
1. 4 stages, 4 micro-batches (GPipe)
2. 4 stages, 16 micro-batches (GPipe)
3. 4 stages, 16 micro-batches (1F1B schedule)

### Exercise 4: Choose a Strategy

For each scenario, recommend the parallelism strategy:
1. ResNet-50 (25M params) on 8 GPUs, large dataset
2. GPT-3 (175B params) on 1024 GPUs
3. BERT-base (110M params) on 2 GPUs, fine-tuning
4. Diffusion model (2B params) on 64 GPUs

---

## Key Takeaways

```
  1. Data parallelism: replicate model, split data, sync gradients
  2. AllReduce (ring) is the efficient gradient sync method
  3. Model parallelism: split layers across GPUs (too big to fit)
  4. Tensor parallelism: split individual layers across GPUs
  5. Pipeline parallelism: stages process micro-batches in pipeline
  6. 3D parallelism combines all three for largest models
  7. Mixed precision halves memory and doubles throughput
  8. Gradient checkpointing trades compute for memory
  9. ZeRO eliminates redundant optimizer state
  10. Linear scaling rule: scale LR with batch size
```

---

Next: [Lesson 14 — Common Bugs](./14-common-bugs.md)
