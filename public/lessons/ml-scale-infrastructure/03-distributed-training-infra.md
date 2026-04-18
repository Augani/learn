# Lesson 03: Distributed Training Infrastructure — Coordinating Thousands of GPUs

Training a large model on a single GPU would take years. Training on
thousands of GPUs takes weeks — but only if those GPUs can communicate
efficiently, recover from failures, and stay synchronized. This lesson
covers the infrastructure that makes large-scale training possible.

---

## The Core Idea

Distributed training is like building a skyscraper. You cannot have one
worker do everything — you need hundreds of workers coordinating across
different tasks. Some workers pour concrete on different floors
simultaneously (data parallelism). Others specialize — one team does
electrical, another does plumbing (model parallelism). The foreman
(orchestration framework) keeps everyone synchronized, and when someone
drops a tool (hardware failure), the project does not start over from
scratch (checkpointing).

```
Distributed Training Overview:

  ┌─────────────────────────────────────────────────────┐
  │                Training Cluster                      │
  │                                                      │
  │  Node 0              Node 1              Node 2      │
  │  ┌──────────┐       ┌──────────┐       ┌──────────┐ │
  │  │GPU0  GPU1│       │GPU0  GPU1│       │GPU0  GPU1│ │
  │  │GPU2  GPU3│       │GPU2  GPU3│       │GPU2  GPU3│ │
  │  │GPU4  GPU5│       │GPU4  GPU5│       │GPU4  GPU5│ │
  │  │GPU6  GPU7│       │GPU6  GPU7│       │GPU6  GPU7│ │
  │  └────┬─────┘       └────┬─────┘       └────┬─────┘ │
  │       │    NVLink         │    NVLink         │      │
  │       │  (intra-node)     │  (intra-node)     │      │
  │       │                   │                   │      │
  │       └───────────────────┼───────────────────┘      │
  │              InfiniBand / RoCE (inter-node)          │
  │                    400 Gbps+                         │
  └─────────────────────────────────────────────────────┘
```

---

## Networking: The Backbone of Distributed Training

The biggest bottleneck in distributed training is not compute — it is
communication. GPUs need to exchange gradients, activations, and model
parameters constantly. The network determines how fast this happens.

```
Network Hierarchy:

  Within a GPU:
    Registers → Shared Memory → L2 Cache → HBM
    Bandwidth: ~3 TB/s (HBM3 on H100)

  Within a node (8 GPUs):
    NVLink / NVSwitch
    Bandwidth: 900 GB/s (H100 NVLink)

  Between nodes:
    InfiniBand or RoCE
    Bandwidth: 50-100 GB/s (400 Gbps HDR/NDR)

  ┌──────────────────────────────────────────────┐
  │  Level           │  Bandwidth  │  Latency     │
  ├──────────────────┼─────────────┼──────────────┤
  │  GPU HBM         │  3,350 GB/s │  ~ns         │
  │  NVLink (intra)  │  900 GB/s   │  ~μs         │
  │  InfiniBand      │  50-100 GB/s│  ~1-5 μs     │
  │  Ethernet (25G)  │  3 GB/s     │  ~10-50 μs   │
  └──────────────────┴─────────────┴──────────────┘

  Key insight: Inter-node bandwidth is 10-60× lower
  than intra-node. This shapes how you partition work.
```

**InfiniBand** is the gold standard for training clusters. It provides:
- Low latency (~1 μs)
- High bandwidth (400 Gbps per port, multiple ports per node)
- RDMA (Remote Direct Memory Access) — GPU-to-GPU transfer without CPU involvement
- Adaptive routing — automatically avoids congested links

**RoCE (RDMA over Converged Ethernet)** is a cheaper alternative that
runs RDMA over standard Ethernet switches. Lower performance than
InfiniBand but more widely available in cloud environments.

---

## Parallelism Strategies

There are three main ways to distribute training across GPUs:

```
Parallelism Strategies:

1. DATA PARALLELISM
   Each GPU has a full copy of the model.
   Different GPUs process different batches of data.
   Gradients are averaged across GPUs after each step.

   GPU 0: Model copy + Batch 0 → Gradients 0 ─┐
   GPU 1: Model copy + Batch 1 → Gradients 1 ─┤→ Average → Update
   GPU 2: Model copy + Batch 2 → Gradients 2 ─┤
   GPU 3: Model copy + Batch 3 → Gradients 3 ─┘

   ✓ Simple to implement
   ✓ Scales well for models that fit on one GPU
   ✗ Every GPU must hold the full model + optimizer states


2. MODEL PARALLELISM (Tensor Parallelism)
   The model is split across GPUs — each GPU holds part
   of each layer.

   Layer computation split across GPUs:
   GPU 0: First half of weight matrix
   GPU 1: Second half of weight matrix
   → Combine results after each layer

   ✓ Enables models too large for one GPU
   ✗ Requires high-bandwidth interconnect (NVLink)
   ✗ Communication at every layer


3. PIPELINE PARALLELISM
   Different layers of the model live on different GPUs.
   Data flows through GPUs like an assembly line.

   GPU 0: Layers 0-7   → activations →
   GPU 1: Layers 8-15  → activations →
   GPU 2: Layers 16-23 → activations →
   GPU 3: Layers 24-31 → output

   ✓ Lower communication than tensor parallelism
   ✗ Pipeline bubbles (GPUs idle while waiting)
   ✗ Complex scheduling needed (micro-batching)
```

In practice, large training runs use **3D parallelism** — all three
strategies combined:

```
3D Parallelism Example (32 GPUs):

  Pipeline stages (4 stages across nodes):
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Stage 0  │→ │ Stage 1  │→ │ Stage 2  │→ │ Stage 3  │
  │ Layers   │  │ Layers   │  │ Layers   │  │ Layers   │
  │ 0-7      │  │ 8-15     │  │ 16-23    │  │ 24-31    │
  └──────────┘  └──────────┘  └──────────┘  └──────────┘
       │             │             │             │
  Each stage has 8 GPUs:
  ┌────────────────────────┐
  │  Tensor Parallel (2)   │  ← Split layers across 2 GPUs
  │  ┌──────┐  ┌──────┐   │
  │  │GPU 0 │  │GPU 1 │   │
  │  └──────┘  └──────┘   │
  │  ┌──────┐  ┌──────┐   │  ← Data parallel (4 replicas)
  │  │GPU 2 │  │GPU 3 │   │
  │  └──────┘  └──────┘   │
  │  ┌──────┐  ┌──────┐   │
  │  │GPU 4 │  │GPU 5 │   │
  │  └──────┘  └──────┘   │
  │  ┌──────┐  ┌──────┐   │
  │  │GPU 6 │  │GPU 7 │   │
  │  └──────┘  └──────┘   │
  └────────────────────────┘
```

Cross-reference: [ML Systems at Scale, Lessons 03-05](../ml-systems-at-scale/)
for hands-on implementation of these parallelism strategies.

---

## Fault Tolerance and Checkpointing

When you run thousands of GPUs for weeks, hardware failures are not
a possibility — they are a certainty. A typical large training run
experiences:

```
Failure Rates in Large Clusters:

  ┌──────────────────────────────────────────────────┐
  │  Component        │  MTBF*     │  Impact          │
  ├───────────────────┼────────────┼──────────────────┤
  │  Single GPU       │  ~10,000 h │  Training stops  │
  │  Node (8 GPUs)    │  ~1,250 h  │  Training stops  │
  │  Network link     │  ~5,000 h  │  Slowdown/stop   │
  │  Storage          │  ~50,000 h │  Data loss risk  │
  └───────────────────┴────────────┴──────────────────┘
  * MTBF = Mean Time Between Failures

  For a 1,024-GPU cluster running for 30 days:
  Expected GPU failures: ~70
  Expected node failures: ~18
  Expected network issues: ~15

  Without fault tolerance, you would never finish.
```

**Checkpointing** is the primary defense. Save the full training state
periodically so you can resume from the last checkpoint after a failure.

```
Checkpoint Contents:

  ┌─────────────────────────────────────────┐
  │  Checkpoint (for a 7B model)            │
  │                                         │
  │  Model weights:        ~14 GB (BF16)    │
  │  Optimizer states:     ~56 GB (FP32)    │
  │  Learning rate state:  ~1 KB            │
  │  RNG states:           ~1 KB            │
  │  Data loader position: ~1 KB            │
  │  Step counter:         ~1 KB            │
  │  ─────────────────────────────          │
  │  Total:                ~70 GB           │
  │                                         │
  │  For 1024-GPU training with ZeRO-3:    │
  │  Distributed across all GPUs            │
  │  Gathered to storage: ~70 GB total      │
  │  Time to save: 1-5 minutes              │
  │  Frequency: every 100-1000 steps        │
  └─────────────────────────────────────────┘
```

**Checkpoint strategies:**
- **Synchronous checkpointing:** All GPUs pause, save state, resume. Simple but wastes training time.
- **Asynchronous checkpointing:** Save in background while training continues. Complex but faster.
- **Elastic training:** Automatically adjust to GPU failures — remove failed nodes and continue with fewer GPUs.

---

## Training Orchestration Frameworks

Three major frameworks handle the complexity of distributed training:

```
Framework Comparison:

┌──────────────┬──────────────┬──────────────┬──────────────┐
│              │  DeepSpeed   │  Megatron-LM │  FSDP        │
│              │  (Microsoft) │  (NVIDIA)    │  (PyTorch)   │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Parallelism  │ Data, ZeRO,  │ Tensor,      │ Data (ZeRO-  │
│              │ Pipeline,    │ Pipeline,    │ style shard- │
│              │ Tensor       │ Data, Expert │ ing)         │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Key Feature  │ ZeRO stages  │ Optimized    │ Native       │
│              │ (1,2,3)      │ tensor       │ PyTorch      │
│              │              │ parallelism  │ integration  │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Best For     │ General      │ Very large   │ PyTorch-     │
│              │ purpose,     │ models,      │ native       │
│              │ easy start   │ NVIDIA HW    │ workflows    │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Complexity   │ Medium       │ High         │ Low-Medium   │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Used By      │ Many open    │ NVIDIA,      │ Meta (LLaMA) │
│              │ source       │ large labs   │ PyTorch      │
│              │ projects     │              │ ecosystem    │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**DeepSpeed ZeRO** (Zero Redundancy Optimizer) is particularly
important. It eliminates memory redundancy across data-parallel GPUs:

```
ZeRO Stages:

  Standard Data Parallelism (no ZeRO):
  Each GPU holds: Model + Gradients + Optimizer States
  Memory per GPU: ~16× model size (FP32 optimizer)

  ZeRO Stage 1: Partition optimizer states
  Each GPU holds: Model + Gradients + 1/N Optimizer States
  Memory savings: ~4×

  ZeRO Stage 2: + Partition gradients
  Each GPU holds: Model + 1/N Gradients + 1/N Optimizer States
  Memory savings: ~8×

  ZeRO Stage 3: + Partition model parameters
  Each GPU holds: 1/N Model + 1/N Gradients + 1/N Optimizer States
  Memory savings: ~N× (linear with GPU count)

  ┌──────────────────────────────────────────────┐
  │  Example: 7B model, 8 GPUs                   │
  │                                               │
  │  No ZeRO:  ~112 GB per GPU  (won't fit!)     │
  │  ZeRO-1:   ~84 GB per GPU   (still tight)    │
  │  ZeRO-2:   ~70 GB per GPU   (barely fits)    │
  │  ZeRO-3:   ~14 GB per GPU   (fits easily)    │
  └──────────────────────────────────────────────┘
```

---

## Cluster Architecture

A production training cluster is more than just GPUs. Here is a
typical setup:

```
Production Training Cluster:

  ┌─────────────────────────────────────────────────────┐
  │                  Cluster Architecture                │
  │                                                      │
  │  ┌──────────────────────────────────────────────┐   │
  │  │              Head Node / Scheduler             │   │
  │  │  (SLURM, Kubernetes, or custom scheduler)     │   │
  │  └──────────────────┬───────────────────────────┘   │
  │                     │                                │
  │  ┌──────────────────┼───────────────────────────┐   │
  │  │           InfiniBand Fabric                   │   │
  │  │         (fat-tree topology)                   │   │
  │  └──┬──────────┬──────────┬──────────┬──────────┘   │
  │     │          │          │          │               │
  │  ┌──┴───┐  ┌──┴───┐  ┌──┴───┐  ┌──┴───┐           │
  │  │Node 0│  │Node 1│  │Node 2│  │Node 3│  ...       │
  │  │8×H100│  │8×H100│  │8×H100│  │8×H100│           │
  │  │NVLink│  │NVLink│  │NVLink│  │NVLink│           │
  │  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘           │
  │     │          │          │          │               │
  │  ┌──┴──────────┴──────────┴──────────┴──────────┐   │
  │  │          Parallel File System                 │   │
  │  │     (Lustre, GPFS, or cloud storage)         │   │
  │  │     Checkpoints, data, logs                   │   │
  │  └──────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────┘
```

**Key components:**
- **Scheduler (SLURM):** Allocates GPU nodes to training jobs, manages queues
- **InfiniBand fabric:** Fat-tree topology for non-blocking communication
- **NVSwitch:** Within each node, connects 8 GPUs at full NVLink bandwidth
- **Parallel file system:** High-throughput storage for checkpoints and data
- **Monitoring:** GPU utilization, temperature, memory, network throughput

---

## Connection to ML

Distributed training infrastructure is the bridge between "I have a
model architecture" and "I have a trained model." The choices you make
here directly affect:

- **Training speed** — Better parallelism = faster convergence
- **Cost** — Better MFU = less wasted compute = lower cost
- **Reliability** — Better checkpointing = less lost work
- **Scale** — Better infrastructure = larger models possible

Cross-reference: [ML Systems at Scale, Lessons 03-05](../ml-systems-at-scale/)
for hands-on implementation of distributed training.

Cross-reference: [GPU & CUDA Fundamentals, Lesson 08](../gpu-cuda-fundamentals/08-multi-gpu-basics.md)
for the hardware foundations of multi-GPU communication.

---

## Exercises

### Exercise 1: Communication Cost

```python
# Calculate the communication overhead for gradient synchronization
# in data-parallel training.

num_gpus = 64
model_params = 7e9       # 7B parameters
bytes_per_param = 2      # BF16
interconnect_bw = 50e9   # 50 GB/s (InfiniBand)

# In an all-reduce operation, each GPU sends and receives
# approximately 2 × (N-1)/N × data_size bytes total
# (where N = number of GPUs)

# TODO: Calculate the total data each GPU must send
# TODO: Calculate the time for one all-reduce
# TODO: If a training step takes 500ms of compute,
#       what fraction is communication?
# TODO: How does this change with 256 GPUs? 1024 GPUs?
```

### Exercise 2: Parallelism Strategy

You need to train a 70B parameter model. Each GPU has 80 GB of memory.
The model in BF16 takes 140 GB. Optimizer states (Adam, FP32) take
another 560 GB.

```python
# TODO: Can you use pure data parallelism? Why or why not?
# TODO: With ZeRO Stage 3 on 8 GPUs, how much memory per GPU?
# TODO: Design a 3D parallelism strategy for 64 GPUs:
#       - How many pipeline stages?
#       - What tensor parallelism degree?
#       - What data parallelism degree?
#       - Verify: pipeline × tensor × data = 64
```

### Exercise 3: Checkpoint Planning

```python
# You are training a 13B model on 256 H100 GPUs.
# Training will take approximately 14 days.

model_size_bf16 = 13e9 * 2          # bytes
optimizer_size = 13e9 * 4 * 3       # Adam: params + momentum + variance
checkpoint_size = model_size_bf16 + optimizer_size

# TODO: Calculate total checkpoint size in GB
# TODO: If checkpointing takes 3 minutes and you checkpoint
#       every 30 minutes, what fraction of training time is
#       spent checkpointing?
# TODO: If a GPU failure occurs on average every 2 days,
#       and you checkpoint every 30 minutes, how much work
#       do you lose per failure on average?
# TODO: What if you checkpoint every 2 hours instead?
#       Calculate the trade-off.
```

---

Next: [Lesson 04: The Pre-Training Pipeline](./04-pretraining-pipeline.md)
