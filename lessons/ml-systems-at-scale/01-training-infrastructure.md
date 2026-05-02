# Lesson 01: Training Infrastructure

> **Analogy**: Think of a GPU like a factory floor. The workers
> (CUDA cores) are incredibly fast, but they're useless if the
> loading dock (memory bandwidth) can't bring in raw materials
> fast enough, or if the highways between factories (interconnects)
> are clogged. Scaling ML training is less about buying more
> factories and more about making sure the highways and docks
> can keep up.

---

## The GPU Landscape in 2024

If you've been training on a single RTX 4090 or even a single
A100, you've been driving on local roads. Scaling to hundreds
of GPUs puts you on the interstate -- and the rules change.

```
+------------------+--------+--------+--------+--------+--------+
| Spec             | A100   | H100   | H200   | B200   | TPU v5p|
+------------------+--------+--------+--------+--------+--------+
| FP16 TFLOPS      | 312    | 989    | 989    | 2,250  | 459    |
| BF16 TFLOPS      | 312    | 989    | 989    | 2,250  | 459    |
| FP8 TFLOPS       | --     | 1,979  | 1,979  | 4,500  | --     |
| HBM              | 80 GB  | 80 GB  | 141 GB | 192 GB | 95 GB  |
| HBM Bandwidth    | 2 TB/s | 3.35   | 4.8    | 8 TB/s | 2.76   |
|                  |        | TB/s   | TB/s   |        | TB/s   |
| TDP (Watts)      | 400W   | 700W   | 700W   | 1000W  | ~200W  |
| Interconnect     | NVLink | NVLink | NVLink | NVLink | ICI    |
|                  | 600    | 900    | 900    | 1800   |        |
|                  | GB/s   | GB/s   | GB/s   | GB/s   |        |
+------------------+--------+--------+--------+--------+--------+
```

The jump from A100 to H100 wasn't just more cores. NVIDIA
redesigned the memory system, added the Transformer Engine
(hardware-level FP8 support), and doubled NVLink bandwidth.
Each generation reshapes what training strategies are viable.

---

## Memory Hierarchy: Where Your Training Actually Stalls

Here's the thing nobody tells you when you start scaling:
**compute is almost never the bottleneck**. Memory bandwidth is.

Think of it like a restaurant kitchen. You can have 50 chefs
(CUDA cores), but if there's only one narrow door to the pantry
(memory bandwidth), most chefs are standing around waiting.

```
Memory Hierarchy of an H100:

  +-------------------------+  Fastest, smallest
  |  Registers              |  <-- 256 KB per SM, ~10 TB/s
  +-------------------------+
  |  L1 Cache / Shared Mem  |  <-- 256 KB per SM, ~30 TB/s aggregate
  +-------------------------+
  |  L2 Cache               |  <-- 50 MB total, ~12 TB/s
  +-------------------------+
  |  HBM3 (Global Memory)   |  <-- 80 GB, 3.35 TB/s
  +-------------------------+
  |  NVLink (other GPUs)    |  <-- 900 GB/s bidirectional
  +-------------------------+
  |  PCIe Gen5              |  <-- 128 GB/s bidirectional
  +-------------------------+
  |  InfiniBand (network)   |  <-- 400 Gb/s = 50 GB/s
  +-------------------------+  Slowest, largest
```

Every level down is roughly 10x slower and 10x larger. Your
training code's performance depends on where the data lives
when the compute cores need it.

### The Arithmetic Intensity Problem

The key metric is **arithmetic intensity**: FLOPs per byte of
memory accessed. If an operation has low arithmetic intensity,
it's memory-bound -- the cores finish computing before the next
chunk of data arrives.

```
Operation              FLOPs/Byte    Bottleneck
----------------------------------------------------
Matrix multiply        ~100-1000     Compute-bound (good!)
(large batch)

Layer norm             ~5-10         Memory-bound
Activation functions   ~1-2          Memory-bound
Attention softmax      ~10-20        Memory-bound (small seqs)
                                     Compute-bound (long seqs)
Optimizer step         ~2-5          Memory-bound
```

This is why fusing operations matters so much at scale. Flash
Attention isn't just clever -- it moves attention from memory-bound
to compute-bound by doing everything in a single pass through SRAM.

```python
import torch
from flash_attn import flash_attn_func

query = torch.randn(batch, seqlen, nheads, headdim, device='cuda', dtype=torch.bfloat16)
key = torch.randn(batch, seqlen, nheads, headdim, device='cuda', dtype=torch.bfloat16)
value = torch.randn(batch, seqlen, nheads, headdim, device='cuda', dtype=torch.bfloat16)

output = flash_attn_func(query, key, value, causal=True)
```

Without Flash Attention, the attention matrix for sequence length
8192 with batch size 4 would be `4 * 8192 * 8192 * 2 bytes =
~1 GB` just for one layer. Flash Attention never materializes
this matrix -- it streams tiles through SRAM.

---

## NVLink, NVSwitch, and InfiniBand

When you move to multi-GPU training, communication speed becomes
the dominant factor. Three interconnects matter.

### NVLink: GPU-to-GPU within a Node

NVLink is a direct GPU-to-GPU link, bypassing the CPU entirely.

```
DGX H100 Node (8x H100):

  GPU0 ====NVLink==== GPU1
   ||                  ||
  GPU2 ====NVLink==== GPU3
   ||                  ||
  GPU4 ====NVLink==== GPU5
   ||                  ||
  GPU6 ====NVLink==== GPU7

  Each ==== is 900 GB/s bidirectional (H100)
  vs PCIe Gen5: 128 GB/s bidirectional

  NVLink is 7x faster than PCIe.
```

### NVSwitch: Full Bisection Bandwidth

In a DGX H100, an NVSwitch connects all 8 GPUs so any GPU can
talk to any other GPU at full NVLink speed simultaneously. Without
NVSwitch, GPUs would have to relay messages through intermediaries.

```
Without NVSwitch (ring topology):
  GPU0 -> GPU1 -> GPU2 -> GPU3
  Latency to GPU3: 3 hops

With NVSwitch (full mesh):
  GPU0 -> NVSwitch -> GPU3
  Latency to GPU3: 1 hop
  Every pair at full bandwidth simultaneously
```

This matters hugely for all-reduce operations. With 8 GPUs doing
an all-reduce over NVSwitch, you get the full 900 GB/s between
every pair. On a ring, you'd be limited by the slowest link.

### InfiniBand: Node-to-Node

Once you go beyond 8 GPUs, you need to cross node boundaries.
InfiniBand is the standard for ML clusters.

```
Multi-Node Training:

  Node 0 (8x H100)          Node 1 (8x H100)
  +------------------+      +------------------+
  | GPU0 ... GPU7    |      | GPU0 ... GPU7    |
  | NVLink: 900 GB/s |      | NVLink: 900 GB/s |
  +--------+---------+      +---------+--------+
           |                          |
           +--- InfiniBand (400 Gb/s = 50 GB/s) ---+
           |                          |
  +--------+---------+      +---------+--------+
  | GPU0 ... GPU7    |      | GPU0 ... GPU7    |
  | NVLink: 900 GB/s |      | NVLink: 900 GB/s |
  +------------------+      +------------------+
  Node 2 (8x H100)          Node 3 (8x H100)
```

Notice the massive bandwidth cliff: 900 GB/s within a node vs
50 GB/s between nodes. That's an 18x difference. This single
fact shapes almost every decision in distributed training:

- **Tensor parallelism**: keep within a node (needs high bandwidth)
- **Pipeline parallelism**: can cross nodes (lower bandwidth OK)
- **Data parallelism**: can cross nodes (gradient sync is periodic)

### RoCE vs InfiniBand

Some cloud providers use RoCE (RDMA over Converged Ethernet)
instead of InfiniBand. Same speeds on paper but significantly
higher tail latency under congestion. If your cloud provider
offers InfiniBand, pay for it. The difference in training
throughput at scale (256+ GPUs) is 15-30%.

---

## TPU Architecture: A Different Philosophy

Google's TPUs take a fundamentally different approach. Instead
of general-purpose GPUs with tensor cores bolted on, TPUs are
purpose-built matrix multiplication engines.

```
GPU Philosophy:             TPU Philosophy:
+--------------------+     +--------------------+
| Thousands of small |     | One massive matrix |
| cores, flexible    |     | unit (MXU), fixed  |
| instructions       |     | operations         |
+--------------------+     +--------------------+
| Good at everything |     | Great at matmul,   |
| Great at matmul    |     | mediocre at rest   |
+--------------------+     +--------------------+
```

### TPU v4 and v5p

```
TPU v4 Pod:
  +--------+--------+--------+--------+
  | Chip 0 | Chip 1 | Chip 2 | Chip 3 |
  +--------+--------+--------+--------+
  | Chip 4 | Chip 5 | Chip 6 | Chip 7 |
  +--------+--------+--------+--------+
       ...  (up to 4096 chips in a pod)

  Each chip: 2 TensorCores, 32 GB HBM2e
  Inter-chip: ICI (Inter-Chip Interconnect) at 4.8 Tb/s
  Pod-level bisection bandwidth: 1.1 Tb/s per chip
```

Key differences from NVIDIA's approach:

1. **Torus topology**: TPU pods use a 3D torus interconnect.
   Every chip connects to 6 neighbors. This means communication
   patterns must be torus-aware.

2. **No NVLink equivalent**: ICI is fast but you program against
   it differently. XLA handles the mapping.

3. **JAX-native**: While PyTorch/XLA exists, TPUs shine with JAX.
   If your team is PyTorch-native, the migration cost is real.

```python
import jax
import jax.numpy as jnp
from jax.sharding import Mesh, PartitionSpec, NamedSharding

devices = jax.devices('tpu')
mesh = Mesh(devices, axis_names=('data',))

@jax.jit
def train_step(params, batch):
    def loss_fn(p):
        logits = model_apply(p, batch['input'])
        return cross_entropy(logits, batch['target'])

    grads = jax.grad(loss_fn)(params)
    grads = jax.lax.pmean(grads, axis_name='data')
    new_params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
    return new_params
```

---

## How Hardware Shapes Training Strategy

Here's the decision tree that experienced ML engineers use:

```
START: How big is your model?

  Model fits on 1 GPU with room for activations?
  |
  +-- YES --> Data Parallelism (DDP)
  |           Use as many GPUs as your budget allows.
  |           Each GPU holds full model + optimizer.
  |
  +-- NO  --> Model fits on 1 GPU without optimizer state?
              |
              +-- YES --> FSDP / DeepSpeed ZeRO-3
              |           Shard optimizer + gradients + params.
              |           Still data-parallel at the batch level.
              |
              +-- NO  --> Model doesn't fit on 1 GPU at all?
                          |
                          +-- YES --> Tensor + Pipeline Parallelism
                                      Split model across GPUs.
                                      Combine with data parallelism.
                                      This is 3D parallelism.
```

### Rule of Thumb: Memory Budget

For a transformer with P parameters:

```
Memory needed for training (FP32 everywhere):
  Parameters:          4P bytes
  Gradients:           4P bytes
  Optimizer (Adam):    8P bytes  (momentum + variance)
  Activations:         Variable (depends on batch, seq_len)

  Total without activations: 16P bytes

  Example: 7B parameter model
  16 * 7B = 112 GB  <-- doesn't fit on one 80GB GPU

With mixed precision (BF16 params/grads, FP32 optimizer):
  Parameters:          2P bytes
  Gradients:           2P bytes
  Optimizer (Adam):    8P bytes  (still FP32)
  Total: 12P bytes

  Example: 7B model
  12 * 7B = 84 GB  <-- still doesn't fit on one 80GB GPU

With FSDP/ZeRO-3 across 8 GPUs:
  Each GPU holds: 84 GB / 8 = 10.5 GB of sharded state
  Plus activations for its micro-batch
  Fits comfortably on 80 GB GPUs!
```

---

## Profiling Your Hardware

Before scaling to a cluster, profile what you have. NVIDIA's
Nsight tools are essential.

```bash
nsys profile --trace=cuda,nvtx,osrt \
  --output=training_profile \
  python train.py --num_steps=100

ncu --set full \
  --target-processes all \
  -o kernel_profile \
  python train.py --num_steps=10
```

What to look for:

```
+---------------------------+-----------------------------------+
| Metric                    | What It Tells You                 |
+---------------------------+-----------------------------------+
| GPU Utilization           | Are cores actually busy?          |
| Memory Bandwidth Util     | Is memory the bottleneck?         |
| SM Occupancy              | Are enough warps in flight?       |
| PCIe/NVLink throughput    | Is communication saturating?      |
| Kernel launch latency     | Is the CPU falling behind?        |
| Time in NCCL ops          | % time spent on communication     |
+---------------------------+-----------------------------------+
```

A healthy training run on a DGX node looks like:

```
GPU Utilization:        > 85%
Memory Bandwidth Util:  > 70%
Time in NCCL:           < 15%
Kernel launch gap:      < 5 microseconds
```

If your NCCL time exceeds 30%, your communication strategy
needs work. If GPU utilization is below 70%, you likely have
a data loading bottleneck (see Lesson 02).

---

## Key Takeaways

1. **Memory bandwidth matters more than FLOPS** for most
   training workloads. The H100's 3.35 TB/s HBM bandwidth
   is what makes it meaningfully better than A100, not just
   the higher TFLOPS.

2. **The intra-node vs inter-node bandwidth gap (18x)** is the
   single most important architectural constraint. Design your
   parallelism strategy around it.

3. **TPUs are not just "Google's GPUs"** -- they have fundamentally
   different interconnect topology and programming model. Choose
   based on your team's framework expertise and workload shape.

4. **Profile before you scale.** A 10% inefficiency on 1 GPU
   becomes a 10% inefficiency multiplied by 256 GPUs and 30 days
   of training. That's real money.

---

## Exercises

1. **Memory budget calculation**: For a 13B parameter model
   with BF16 mixed precision and Adam optimizer, calculate the
   per-GPU memory needed with (a) DDP on 8 GPUs, (b) FSDP
   ZeRO-3 on 8 GPUs, (c) FSDP ZeRO-3 on 64 GPUs.

2. **Profile a training run**: Use `nsys` to profile a simple
   transformer training loop. Identify the top 3 time-consuming
   kernels and classify each as compute-bound or memory-bound.

3. **Bandwidth estimation**: If you need to all-reduce 13B
   FP32 gradients across 32 nodes connected by 400 Gb/s
   InfiniBand, estimate the communication time using the
   ring all-reduce algorithm.
