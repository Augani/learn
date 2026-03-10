# Lesson 10: Multi-GPU Inference — Splitting Models Across Hardware

When a model does not fit on one GPU, you split it across several. But
how you split it matters enormously. Think of it like moving a house.
You could cut it in half vertically (tensor parallelism — each GPU does
half the work for every layer) or horizontally (pipeline parallelism —
each GPU handles different floors). Each approach has different
tradeoffs in speed, memory, and communication cost.

---

## Why Multi-GPU?

```
Model size vs GPU memory:

Model          bf16 Size    GPUs Needed (A100-80GB)
─────────────────────────────────────────────────────
7B             14 GB        1 (with room for KV cache)
13B            26 GB        1 (tight) or 2
34B            68 GB        1 (barely) or 2
70B            140 GB       2 minimum, 4 recommended
180B           360 GB       5 minimum, 8 recommended
405B           810 GB       11 minimum, 16 recommended

"GPUs needed" = model weights only. KV cache, activations,
and framework overhead need additional memory.
```

Even with quantization (4-bit reduces memory by 4x), the largest
models still need multiple GPUs. And for serving at scale, multi-GPU
gives you higher throughput even for models that fit on one GPU.

---

## Tensor Parallelism (TP)

Split individual layers across GPUs. Each GPU computes part of every
layer, then they exchange results.

```
Single GPU:
  Input → [Full Linear Layer (D_in × D_out)] → Output

Tensor Parallel (2 GPUs):
  GPU 0: Input → [Half Linear (D_in × D_out/2)] → Output_0
  GPU 1: Input → [Half Linear (D_in × D_out/2)] → Output_1

  AllReduce: Output = Output_0 + Output_1   (or concat, depending on split axis)
```

### Column-Parallel Linear

Split the weight matrix along columns. Each GPU computes a different
part of the output.

```
Weight matrix W (D_in × D_out):

Full:     [W_full]     = D_in × D_out

Split into 2 GPUs:
  GPU 0:  [W_col_0]    = D_in × D_out/2
  GPU 1:  [W_col_1]    = D_in × D_out/2

Forward:
  GPU 0:  Y_0 = X @ W_col_0    (partial output)
  GPU 1:  Y_1 = X @ W_col_1    (partial output)
  Result: Y = [Y_0 | Y_1]       (concatenate)
```

### Row-Parallel Linear

Split along rows. Each GPU processes different input features.

```
Weight matrix W (D_in × D_out):

Split into 2 GPUs:
  GPU 0:  [W_row_0]    = D_in/2 × D_out
  GPU 1:  [W_row_1]    = D_in/2 × D_out

Forward:
  GPU 0:  Y_0 = X_0 @ W_row_0    (partial sum)
  GPU 1:  Y_1 = X_1 @ W_row_1    (partial sum)
  AllReduce: Y = Y_0 + Y_1        (sum the partial results)
```

### How Attention is Split

```
Tensor Parallel Attention (TP=4):

GPU 0: Heads 0-7   (Q0, K0, V0) → Attention → Output_0
GPU 1: Heads 8-15  (Q1, K1, V1) → Attention → Output_1
GPU 2: Heads 16-23 (Q2, K2, V2) → Attention → Output_2
GPU 3: Heads 24-31 (Q3, K3, V3) → Attention → Output_3

Each GPU handles num_heads / TP heads independently.
After attention, AllReduce combines the output projections.

For GQA (8 KV heads, 32 Q heads, TP=4):
  GPU 0: 8 Q heads, 2 KV heads
  GPU 1: 8 Q heads, 2 KV heads
  GPU 2: 8 Q heads, 2 KV heads
  GPU 3: 8 Q heads, 2 KV heads
```

### Full Layer with Tensor Parallelism

```
Tensor Parallel Transformer Layer (TP=4):

Input (replicated on all 4 GPUs)
  │
  ├─── GPU 0: Attention (heads 0-7)
  ├─── GPU 1: Attention (heads 8-15)
  ├─── GPU 2: Attention (heads 16-23)
  └─── GPU 3: Attention (heads 24-31)
  │
  AllReduce ◄─── Communication point 1
  │
  ├─── GPU 0: FFN (columns 0-25%)
  ├─── GPU 1: FFN (columns 25-50%)
  ├─── GPU 2: FFN (columns 50-75%)
  └─── GPU 3: FFN (columns 75-100%)
  │
  AllReduce ◄─── Communication point 2
  │
Output (replicated on all 4 GPUs)

Each layer requires 2 AllReduce operations.
For a 32-layer model with TP=4: 64 AllReduce calls per forward pass.
```

```python
import torch
import torch.distributed as dist

class TensorParallelLinear(torch.nn.Module):
    def __init__(self, in_features, out_features, world_size, rank, split="column"):
        super().__init__()
        self.world_size = world_size
        self.rank = rank
        self.split = split

        if split == "column":
            self.local_out = out_features // world_size
            self.weight = torch.nn.Parameter(
                torch.randn(self.local_out, in_features) * 0.01
            )
        else:  # row
            self.local_in = in_features // world_size
            self.weight = torch.nn.Parameter(
                torch.randn(out_features, self.local_in) * 0.01
            )

    def forward(self, x):
        if self.split == "column":
            output = torch.nn.functional.linear(x, self.weight)
            # output is partial — concatenation happens outside
            return output
        else:
            local_x = x[..., self.rank * self.local_in:(self.rank + 1) * self.local_in]
            output = torch.nn.functional.linear(local_x, self.weight)
            dist.all_reduce(output, op=dist.ReduceOp.SUM)
            return output
```

---

## Pipeline Parallelism (PP)

Split the model by layers. Each GPU handles a consecutive block of
layers.

```
Pipeline Parallel (4 GPUs, 32 layers):

GPU 0: Layers 0-7   (embedding + first 8 layers)
GPU 1: Layers 8-15
GPU 2: Layers 16-23
GPU 3: Layers 24-31 (last 8 layers + LM head)

Forward pass:
  Input → GPU 0 → transfer → GPU 1 → transfer → GPU 2 → transfer → GPU 3 → Output

Each transfer sends: (batch_size, seq_len, hidden_dim) activations
For Llama 70B (hidden=8192), batch=1, seq=4096:
  Transfer: 4096 × 8192 × 2 bytes = 64 MB per transfer
```

### The Pipeline Bubble Problem

With simple pipeline parallelism, GPUs sit idle most of the time:

```
Pipeline bubble (batch_size=1):

Time ──────────────────────────────────────────►

GPU 0: [████]  idle   idle   idle
GPU 1:  idle  [████]  idle   idle
GPU 2:  idle   idle  [████]  idle
GPU 3:  idle   idle   idle  [████]

Only 1 GPU active at a time! 75% waste with 4 GPUs.
```

### Micro-batching: Reducing the Bubble

Split the batch into micro-batches. While GPU 1 processes micro-batch 1,
GPU 0 starts on micro-batch 2.

```
Pipeline with 4 micro-batches:

Time ──────────────────────────────────────────►

GPU 0: [mb1] [mb2] [mb3] [mb4]  idle  idle  idle
GPU 1:  idle [mb1] [mb2] [mb3] [mb4]  idle  idle
GPU 2:  idle  idle [mb1] [mb2] [mb3] [mb4]  idle
GPU 3:  idle  idle  idle [mb1] [mb2] [mb3] [mb4]

Better! But still a startup/drain bubble at the beginning and end.
Efficiency = num_microbatches / (num_microbatches + num_stages - 1)
           = 4 / (4 + 4 - 1) = 57%

With 16 micro-batches: 16/19 = 84%
```

---

## Tensor Parallel vs Pipeline Parallel

```
                Tensor Parallel         Pipeline Parallel
────────────────────────────────────────────────────────────────
Communication   AllReduce every layer   Point-to-point between stages
Frequency       High (2× per layer)     Low (1× between stages)
Bandwidth need  Very high               Moderate
Latency impact  Moderate                High (pipeline bubbles)
Memory balance  Even                    Even (by layer count)
Best for        Fast interconnect       Slow interconnect
                (NVLink within node)    (across nodes)
GPU utilization High                    Moderate (bubbles)
```

### The Rule of Thumb

```
Within a node (NVLink): Use Tensor Parallelism
  - 4-8 GPUs connected by NVLink (900 GB/s on A100)
  - AllReduce is fast, latency is low

Across nodes (InfiniBand): Use Pipeline Parallelism
  - Nodes connected by InfiniBand (400 Gb/s)
  - Point-to-point transfers tolerate higher latency

Combined (TP + PP):
  Node 1: GPU 0-3 (TP=4, handling layers 0-15)
  Node 2: GPU 4-7 (TP=4, handling layers 16-31)

  Within each node: Tensor Parallel (fast NVLink)
  Between nodes: Pipeline Parallel (network)
```

---

## Inter-GPU Communication

### NVLink vs PCIe vs InfiniBand

```
Interconnect    Bandwidth      Latency    Typical Use
──────────────────────────────────────────────────────────────
NVLink 4.0      900 GB/s       ~1μs       Within node (A100)
NVLink 5.0      1800 GB/s      ~1μs       Within node (H100)
PCIe 5.0        64 GB/s        ~5μs       GPU to CPU
InfiniBand HDR  50 GB/s        ~1μs       Between nodes
InfiniBand NDR  100 GB/s       ~1μs       Between nodes
Ethernet 100G   12.5 GB/s      ~10μs      Between nodes (budget)

NVLink is 9-18x faster than InfiniBand.
This is why TP works within a node but not across nodes.
```

### AllReduce Operations

The dominant communication pattern in tensor parallelism.

```
AllReduce (sum) with 4 GPUs:

Before:
  GPU 0: [A0]    GPU 1: [A1]    GPU 2: [A2]    GPU 3: [A3]

After:
  GPU 0: [A0+A1+A2+A3]
  GPU 1: [A0+A1+A2+A3]
  GPU 2: [A0+A1+A2+A3]
  GPU 3: [A0+A1+A2+A3]

All GPUs end up with the sum. Implemented as Ring AllReduce:
  - Each GPU sends 1/N of its data to neighbor
  - After N-1 steps, all GPUs have the full sum
  - Total data moved: 2 × (N-1)/N × data_size
```

### Communication Overhead

```python
def estimate_allreduce_time(data_size_bytes, num_gpus, bandwidth_gbps):
    bandwidth_bytes = bandwidth_gbps * 1e9 / 8
    # ring allreduce: 2 * (N-1)/N * data_size / bandwidth
    factor = 2 * (num_gpus - 1) / num_gpus
    time_seconds = factor * data_size_bytes / bandwidth_bytes
    return time_seconds

# Llama 70B, one AllReduce, TP=4
hidden_size = 8192
data_size = 1 * 4096 * hidden_size * 2  # batch=1, seq=4096, bf16

# NVLink (within node)
t_nvlink = estimate_allreduce_time(data_size, 4, 900 * 8)  # 900 GB/s
print(f"NVLink AllReduce: {t_nvlink*1000:.2f} ms")  # ~0.01 ms

# InfiniBand (across nodes)
t_ib = estimate_allreduce_time(data_size, 4, 50 * 8)  # 50 GB/s
print(f"IB AllReduce: {t_ib*1000:.2f} ms")  # ~0.2 ms
```

---

## Model Sharding Strategies

### Expert Parallelism (for MoE Models)

Place different experts on different GPUs. Covered in Lesson 03 but
worth mentioning here in the context of multi-GPU inference.

```
MoE model (8 experts, 4 GPUs):

GPU 0: Shared attention + Expert 0, 1
GPU 1: Shared attention + Expert 2, 3
GPU 2: Shared attention + Expert 4, 5
GPU 3: Shared attention + Expert 6, 7

Communication: All-to-all for token routing
Each token goes to the GPU(s) holding its selected experts.
```

### Combining TP + PP + EP

For the largest models, you combine all three:

```
8-node cluster, 8 GPUs per node (64 GPUs total):

Llama 3 405B serving:

Node 0-1 (16 GPUs): TP=8 across GPUs, PP stage 0 (layers 0-15)
Node 2-3 (16 GPUs): TP=8 across GPUs, PP stage 1 (layers 16-31)
Node 4-5 (16 GPUs): TP=8 across GPUs, PP stage 2 (layers 32-47)
Node 6-7 (16 GPUs): TP=8 across GPUs, PP stage 3 (layers 48-63)

Within each node: Tensor parallelism (NVLink, fast)
Between node pairs: Pipeline parallelism (InfiniBand, slower)
```

---

## Latency vs Throughput Tradeoffs

```
Single-request latency (Llama 70B):

Configuration     TTFT      ITL       Total (512 tokens)
───────────────────────────────────────────────────────────
1× A100 (int4)    120ms     30ms      15.5s
2× A100 (TP=2)    80ms      18ms      9.3s
4× A100 (TP=4)    50ms      12ms      6.2s
8× A100 (TP=8)    40ms      9ms       4.7s

Diminishing returns: 2x GPUs ≠ 2x faster
Communication overhead grows with more GPUs.
```

```
Throughput scaling:

Configuration     Throughput (tokens/s)    Cost/Token
───────────────────────────────────────────────────────
1× A100 (int4)    35                       $0.028/1K
2× A100 (TP=2)    60                       $0.033/1K  (less efficient)
4× A100 (TP=4)    100                      $0.040/1K
8× A100 (TP=8)    160                      $0.050/1K

More GPUs = more throughput but higher cost per token.
TP is latency-optimized, not cost-optimized.
```

### When to Add More GPUs

```
Decision framework:

Need lower latency?
  → Add GPUs with tensor parallelism (within node)
  → Diminishing returns beyond TP=8

Need more throughput?
  → Add more replicas (each with minimal TP)
  → Scale horizontally, not vertically

Model doesn't fit on one GPU?
  → Use minimum TP to fit the model
  → Then scale replicas for throughput

Budget constrained?
  → Quantize first (4-bit = 4x less memory)
  → Then add GPUs only if needed
```

---

## Practical Setup with vLLM

```bash
# Tensor parallelism (4 GPUs in one node)
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3-70B-Instruct \
  --tensor-parallel-size 4 \
  --port 8000

# Pipeline parallelism (2 nodes, 4 GPUs each)
# Node 0:
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3-405B-Instruct \
  --tensor-parallel-size 4 \
  --pipeline-parallel-size 2 \
  --distributed-executor-backend ray \
  --port 8000

# Combined (8 GPUs: TP=4, PP=2)
# Requires 2 nodes with 4 GPUs each connected by InfiniBand
```

---

## Key Takeaways

1. **Tensor parallelism for latency**, within a single node using
   NVLink. This is the standard approach for serving large models.

2. **Pipeline parallelism for scale**, across nodes using InfiniBand.
   Use it when the model spans multiple machines.

3. **Communication bandwidth determines strategy.** NVLink (900 GB/s)
   enables TP. InfiniBand (50-100 GB/s) limits you to PP across nodes.

4. **More GPUs does not mean proportionally faster.** Communication
   overhead grows. Use the minimum number of GPUs needed.

5. **Quantize before scaling.** 4-bit quantization often eliminates the
   need for multi-GPU inference entirely.

6. **For throughput, scale replicas, not tensor parallelism.** Two
   2-GPU replicas often beat one 4-GPU replica for throughput.

---

## Exercises

1. **Profile TP scaling.** Deploy a 70B model with TP=1 (quantized),
   TP=2, TP=4, and TP=8. Measure TTFT, ITL, and throughput. Plot the
   scaling efficiency.

2. **TP vs replicas.** Compare 4-GPU TP=4 (one replica) vs 4-GPU
   TP=2 (two replicas). Which configuration wins for latency? For
   throughput? At what concurrency level does the answer change?

3. **Communication profiling.** Use NCCL profiling tools to measure
   AllReduce times at different message sizes and GPU counts. Plot
   bandwidth utilization vs message size.
