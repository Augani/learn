# Lesson 05: Training Large Models

> **Analogy**: Building a skyscraper. A one-story house is
> straightforward -- one crew, one plan. But a 100-story building
> requires different concrete formulations per floor, coordinated
> crane schedules, and redundant structural supports. The techniques
> that work for a 1B model don't scale to 175B. You need new
> engineering patterns -- 3D parallelism, activation checkpointing,
> gradient compression -- the structural engineering of ML.

---

## The Billion-Parameter Threshold

Something qualitatively changes when models cross ~10B parameters.
It's not just "more of the same." New failure modes emerge.

```
Model Size     What Breaks                   What You Need
-----------    ---------------------------   ----------------------
< 1B           Nothing really                Single GPU, DDP
1B - 10B       Memory (optimizer state)      FSDP / ZeRO Stage 2-3
10B - 70B      Memory + communication        3D parallelism
70B - 175B     Everything + stability        Megatron-LM patterns
175B+          Physics (power, cooling)      Custom infrastructure
```

---

## Megatron-LM: The Blueprint for Large Model Training

NVIDIA's Megatron-LM is the reference implementation for training
models above 10B parameters. Nearly every large language model
training codebase borrows its patterns.

### Megatron's Tensor Parallelism

Megatron splits each transformer layer's linear operations
across GPUs. The key insight is how to split MLP and attention
so that only **two all-reduce operations per layer** are needed.

```
Standard MLP:
  Y = GeLU(X @ A) @ B

Megatron MLP (TP=2):

  GPU 0:                      GPU 1:
  X (replicated)              X (replicated)
  |                           |
  A_0 = A[:, :hidden//2]     A_1 = A[:, hidden//2:]
  |                           |
  Y_0 = GeLU(X @ A_0)        Y_1 = GeLU(X @ A_1)
  |                           |
  B_0 = B[:hidden//2, :]     B_1 = B[hidden//2:, :]
  |                           |
  Z_0 = Y_0 @ B_0            Z_1 = Y_1 @ B_1
  |                           |
  +--------- ALL-REDUCE (sum) ---------+
  |                           |
  Z = Z_0 + Z_1              Z = Z_0 + Z_1
  (identical on both GPUs)
```

The trick: GeLU is applied **before** the second linear layer
on partial results. Because GeLU is element-wise, `GeLU(X@A_0)`
is the correct partial result. This wouldn't work with operations
that need the full intermediate representation.

### Megatron's Attention Parallelism

Attention heads are naturally parallel -- each head operates
independently. Megatron assigns head groups to GPUs.

```
Multi-Head Attention with TP=4, 32 heads:

  GPU 0: Heads 0-7    (8 heads, independent computation)
  GPU 1: Heads 8-15
  GPU 2: Heads 16-23
  GPU 3: Heads 24-31

  Each GPU:
    Q_local = X @ W_Q_local    (partial Q matrix)
    K_local = X @ W_K_local
    V_local = X @ W_V_local
    Attn_local = softmax(Q_local @ K_local^T / sqrt(d)) @ V_local
    Out_local = Attn_local @ W_O_local

  All-Reduce (sum) Out_local across GPUs
```

### Sequence Parallelism

Megatron's newer versions add sequence parallelism for
operations that don't benefit from tensor parallelism (LayerNorm,
dropout). These ops are memory-bound, and with TP, every GPU
redundantly computes them on the full sequence.

```
Without Sequence Parallelism:
  LayerNorm: computed on full sequence on every GPU  (redundant)
  TP region: computed on split tensors (parallel)
  Dropout: computed on full sequence on every GPU  (redundant)

With Sequence Parallelism:
  LayerNorm: each GPU handles seq_len/TP portion  (parallel!)
  All-Gather before TP region
  TP region: tensor parallel as before
  Reduce-Scatter after TP region
  Dropout: each GPU handles seq_len/TP portion  (parallel!)

Memory savings: LayerNorm activations and dropout masks are
now 1/TP the size per GPU.
```

---

## 3D Parallelism in Practice

For very large models, you combine tensor, pipeline, and data
parallelism. The key is mapping each dimension to the right
level of the network hierarchy.

```
Example: 175B model on 512 GPUs (64 nodes x 8 GPUs)

  Step 1: Choose Tensor Parallelism degree
    TP = 8 (one full node, NVLink)
    Each transformer layer split across 8 GPUs

  Step 2: Choose Pipeline Parallelism degree
    175B model = 96 layers
    PP = 8 (8 pipeline stages, 12 layers each)
    Each stage on a different node

  Step 3: Data Parallelism fills the rest
    DP = 512 / (TP * PP) = 512 / 64 = 8
    8 replicas of the entire pipeline

  Layout:
    Node 0:  TP group for PP stage 0, DP replica 0
    Node 1:  TP group for PP stage 1, DP replica 0
    ...
    Node 7:  TP group for PP stage 7, DP replica 0
    Node 8:  TP group for PP stage 0, DP replica 1
    ...
    Node 63: TP group for PP stage 7, DP replica 7
```

### Choosing the Right Configuration

```
Rule 1: TP <= GPUs per node (NVLink boundary)
  TP=8 for 8-GPU nodes. Never cross nodes with TP.

Rule 2: PP = model_layers / layers_per_stage
  More PP stages = smaller bubble but more pipeline overhead.
  Aim for PP=4-16 for most models.

Rule 3: DP = total_GPUs / (TP * PP)
  More DP = larger effective batch size.
  May need to adjust learning rate.

Rule 4: micro_batches >= 4 * PP
  This keeps the pipeline bubble below ~25%.
  More micro-batches = smaller bubble but more memory for
  storing intermediate activations.
```

### Configuration for Common Models

```
+----------+--------+-------+------+------+-------+-------+
| Model    | Params | GPUs  | TP   | PP   | DP    | Notes |
+----------+--------+-------+------+------+-------+-------+
| LLaMA 7B | 7B     | 8     | 1    | 1    | 8     | DDP   |
| LLaMA 7B | 7B     | 8     | 1    | 1    | 8     | FSDP  |
| LLaMA 13B| 13B    | 16    | 2    | 1    | 8     |       |
| LLaMA 70B| 70B    | 64    | 8    | 2    | 4     |       |
| GPT-3    | 175B   | 512   | 8    | 8    | 8     |       |
| MT-NLG   | 530B   | 2240  | 8    | 35   | 8     |       |
+----------+--------+-------+------+------+-------+-------+
```

---

## Activation Checkpointing

During training, you store activations from the forward pass to
use in the backward pass. For large models, these activations
dominate memory usage.

```
Normal training (no checkpointing):

  Forward:  save all activations for backward
  Layer 0: save A0 (500 MB)
  Layer 1: save A1 (500 MB)
  ...
  Layer 95: save A95 (500 MB)

  Total activation memory: 96 * 500 MB = 48 GB

With activation checkpointing:

  Forward: save only checkpoint activations
  Layer 0:  save A0  (checkpoint)
  Layer 1:  discard
  Layer 2:  discard
  Layer 3:  save A3  (checkpoint)    ← every 4th layer
  ...

  Total activation memory: 24 * 500 MB = 12 GB

  Backward: recompute discarded activations from checkpoints
  Need A2? Recompute from A0 through layers 0,1,2.
  Cost: ~33% extra compute for 75% memory savings.
```

### Implementing Activation Checkpointing

```python
import torch
from torch.utils.checkpoint import checkpoint

class CheckpointedTransformer(torch.nn.Module):
    def __init__(self, config):
        super().__init__()
        self.layers = torch.nn.ModuleList([
            TransformerBlock(config) for _ in range(config.num_layers)
        ])
        self.checkpoint_every = config.checkpoint_every

    def forward(self, x):
        for i, layer in enumerate(self.layers):
            if self.training and i % self.checkpoint_every == 0:
                x = checkpoint(layer, x, use_reentrant=False)
            else:
                x = layer(x)
        return x
```

With DeepSpeed:

```python
import deepspeed

deepspeed.checkpointing.configure(
    num_checkpoints=24,
    partition_activations=True,
    contiguous_memory_optimization=True,
    cpu_checkpointing=False,
)

model = deepspeed.checkpointing.checkpoint(model_fn, *args)
```

### Selective Activation Checkpointing

Not all layers use the same amount of activation memory. Attention
layers with long sequences use much more than MLP layers.

```
Memory per layer (batch=4, seq=4096, hidden=4096, BF16):

  Attention activations:
    Q, K, V: 3 * 4 * 4096 * 4096 * 2 bytes = 384 MB
    Attention scores: 4 * 32 * 4096 * 4096 * 2 = 4 GB  ← HUGE
    (with Flash Attention: ~0, recomputed in backward)

  MLP activations:
    Intermediate: 4 * 4096 * 16384 * 2 = 512 MB

Strategy: Checkpoint attention layers, skip MLP layers.
Or better: use Flash Attention (recomputes in backward by design).
```

---

## Gradient Compression

When you have 64 data-parallel replicas all-reducing gradients
over InfiniBand, communication time matters. Gradient compression
reduces the bytes sent.

### PowerSGD

PowerSGD approximates the gradient matrix using a low-rank
decomposition. Instead of sending the full gradient, send two
small matrices whose product approximates it.

```
Full gradient: G is [m x n]          m*n values to send
PowerSGD rank r: G ≈ P @ Q^T
  P is [m x r], Q is [n x r]        (m+n)*r values to send

  With m=n=4096, r=4:
  Full: 16.7M values
  Compressed: 32K values
  Compression ratio: 512x

  But: approximate, so convergence may be affected.
```

```python
from torch.distributed.algorithms.ddp_comm_hooks import (
    powerSGD_hook as powerSGD
)

state = powerSGD.PowerSGDState(
    process_group=dist.group.WORLD,
    matrix_approximation_rank=4,
    start_powerSGD_iter=1000,
    min_compression_rate=2,
    orthogonalization_epsilon=1e-6,
)

ddp_model.register_comm_hook(state, powerSGD.powerSGD_hook)
```

### Top-K Sparsification

Only send the largest K% of gradient values. The rest are
accumulated locally and sent when they become large enough.

```
Gradient: [0.01, 5.2, -0.003, 0.8, -3.1, 0.02, 0.001, 1.5]

Top-25% (K=2):
  Send: [(1, 5.2), (4, -3.1)]  ← index + value pairs
  Accumulate locally: [0.01, 0, -0.003, 0.8, 0, 0.02, 0.001, 1.5]

  Next step, local accumulation is added to new gradients.
  Eventually the small values accumulate enough to be sent.
```

---

## Memory Optimization Techniques

### CPU Offloading

Move optimizer state (and optionally parameters) to CPU RAM
when not in use. The GPU only holds what it needs right now.

```
GPU memory timeline with offloading:

  Forward pass, Layer i:
    1. Prefetch layer i params from CPU -> GPU
    2. Compute forward
    3. Offload layer i params GPU -> CPU (if needed for space)

  Optimizer step:
    1. Gradients are on GPU
    2. Optimizer state on CPU
    3. Copy gradients to CPU
    4. Update on CPU (slower, but free GPU memory)
    5. Copy updated params to GPU

  Trade-off: PCIe bandwidth (32 GB/s) vs GPU memory
```

DeepSpeed ZeRO-Offload config:

```json
{
  "zero_optimization": {
    "stage": 3,
    "offload_optimizer": {
      "device": "cpu",
      "pin_memory": true,
      "fast_init": true
    },
    "offload_param": {
      "device": "cpu",
      "pin_memory": true
    }
  }
}
```

### NVMe Offloading (ZeRO-Infinity)

When even CPU RAM isn't enough, offload to NVMe SSDs:

```
Memory hierarchy for ZeRO-Infinity:

  GPU HBM:   80 GB   (active computation)
  CPU RAM:   1-2 TB  (buffering)
  NVMe SSD:  4-16 TB (cold storage for params/optimizer)

  Throughput:
  GPU HBM:    3.35 TB/s
  CPU RAM:    ~200 GB/s
  NVMe SSD:  ~7 GB/s (per drive, can RAID for more)

  With 8 NVMe drives in RAID 0: ~50 GB/s
  Still 67x slower than HBM, but effectively infinite capacity.
```

```json
{
  "zero_optimization": {
    "stage": 3,
    "offload_optimizer": {
      "device": "nvme",
      "nvme_path": "/local_nvme",
      "pin_memory": true,
      "buffer_count": 4,
      "buffer_size": 1e9
    },
    "offload_param": {
      "device": "nvme",
      "nvme_path": "/local_nvme",
      "pin_memory": true,
      "buffer_count": 5,
      "buffer_size": 1e8,
      "max_in_cpu": 1e10
    },
    "aio": {
      "block_size": 1048576,
      "queue_depth": 32,
      "thread_count": 1,
      "single_submit": false,
      "overlap_events": true
    }
  }
}
```

---

## Putting It All Together: Training a 70B Model

Here's a realistic configuration for training a 70B model on
64 H100 GPUs (8 nodes):

```
Model: 70B parameters, 80 layers, hidden=8192, 64 heads
Hardware: 8 nodes x 8 H100 (80GB) = 64 GPUs

Parallelism:
  TP = 8 (within each node)
  PP = 2 (2 pipeline stages, 40 layers each)
  DP = 4 (4 data-parallel replicas)

  64 = 8 * 2 * 4  ✓

Memory per GPU:
  Parameters (TP=8): 70B * 2 bytes / 8 = 17.5 GB
  Gradients (TP=8):  17.5 GB
  Optimizer (DP=4, FSDP within DP group):
    FP32 master + Adam: 70B * 12 bytes / 8 (TP) / 4 (DP shard) = 26.25 GB
  Activations (per micro-batch, with checkpointing):
    ~4 GB per micro-batch, 2 micro-batches in flight = 8 GB
  Total: ~69 GB  (fits in 80 GB with headroom)

Training config:
  Global batch size: 2048 sequences
  Micro-batch per GPU: 2
  Gradient accumulation: 2048 / (4 * 2) = 256 steps
  Sequence length: 4096
  Learning rate: 3e-4 with cosine decay
  Warmup: 2000 steps
```

```bash
#!/bin/bash
#SBATCH --job-name=train-70b
#SBATCH --nodes=8
#SBATCH --ntasks-per-node=8
#SBATCH --gpus-per-node=8
#SBATCH --time=720:00:00
#SBATCH --exclusive

export MASTER_ADDR=$(scontrol show hostname $SLURM_NODELIST | head -n1)
export MASTER_PORT=29500

srun torchrun \
  --nnodes=8 \
  --nproc_per_node=8 \
  --rdzv_id=$SLURM_JOB_ID \
  --rdzv_backend=c10d \
  --rdzv_endpoint=$MASTER_ADDR:$MASTER_PORT \
  train_70b.py \
  --tensor-parallel-size 8 \
  --pipeline-parallel-size 2 \
  --num-layers 80 \
  --hidden-size 8192 \
  --num-attention-heads 64 \
  --seq-length 4096 \
  --micro-batch-size 2 \
  --global-batch-size 2048 \
  --lr 3e-4 \
  --min-lr 3e-5 \
  --lr-warmup-iters 2000 \
  --lr-decay-style cosine \
  --bf16 \
  --checkpoint-activations \
  --checkpoint-num-layers 4 \
  --save-interval 500 \
  --log-interval 10
```

---

## Exercises

1. **Memory budget**: Calculate the per-GPU memory breakdown for
   a 13B model with TP=4, PP=2, DP=4 on 32 GPUs. Include
   parameters, gradients, optimizer state, and activations
   (batch=4, seq=2048).

2. **Checkpoint strategy**: For a 40-layer model on 4 GPUs with
   PP=4, design a selective activation checkpointing strategy that
   uses Flash Attention (no attention activation storage) and
   checkpoints every 3rd MLP. Calculate total activation memory.

3. **Compression analysis**: Calculate the all-reduce time for
   70B BF16 gradients with DP=8 over 400 Gb/s InfiniBand.
   Then calculate the time with PowerSGD rank=4. Is the compression
   worth the approximation error?

4. **Design exercise**: You need to train a 175B model. You have
   128 A100 80GB GPUs (16 nodes). Design the full parallelism
   configuration, justify your choices, and estimate per-GPU memory.
