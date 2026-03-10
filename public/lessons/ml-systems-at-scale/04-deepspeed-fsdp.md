# Lesson 04: DeepSpeed & FSDP

> **Analogy**: Moving apartments with friends. **DDP** is everyone
> carrying a complete copy of your furniture (wasteful -- 4 copies
> of the same couch). **ZeRO Stage 1** is everyone carrying the
> same furniture but splitting the moving truck's gas receipts
> (optimizer state). **Stage 2** adds splitting the packing
> materials (gradients). **Stage 3** splits the furniture itself
> (parameters) -- nobody has a complete set until they need it,
> then they borrow pieces from friends. FSDP is PyTorch's version
> of Stage 3.

---

## Why DDP Isn't Enough

Standard DDP replicates everything on every GPU:

```
DDP Memory per GPU (7B model, BF16 + FP32 Adam):

  Parameters (BF16):        14 GB
  Gradients (BF16):         14 GB
  Optimizer state (FP32):
    Master weights:          28 GB
    Momentum:                28 GB
    Variance:                28 GB
  Total:                    112 GB per GPU  ← same on ALL GPUs

  With 8 GPUs: 8 * 112 GB = 896 GB total memory used
  But unique data: only 112 GB
  Redundancy: 8x  ← pure waste
```

ZeRO and FSDP eliminate this redundancy.

---

## DeepSpeed ZeRO: Three Stages

ZeRO (Zero Redundancy Optimizer) progressively shards different
components across GPUs.

### Stage 1: Shard Optimizer State

```
ZeRO Stage 1 (8 GPUs, 7B model):

  Each GPU still holds:
    Full parameters (BF16):    14 GB
    Full gradients (BF16):     14 GB

  But optimizer state is sharded:
    Master weights (FP32):     28 GB / 8 = 3.5 GB per GPU
    Momentum (FP32):           28 GB / 8 = 3.5 GB per GPU
    Variance (FP32):           28 GB / 8 = 3.5 GB per GPU

  Total per GPU: 14 + 14 + 10.5 = 38.5 GB  (was 112 GB)
  Savings: 66%
```

Communication: same as DDP (all-reduce gradients). The optimizer
step is local -- each GPU updates only its shard of optimizer
state, then all-gathers the updated parameters.

### Stage 2: Shard Optimizer State + Gradients

```
ZeRO Stage 2 (8 GPUs, 7B model):

  Each GPU holds:
    Full parameters (BF16):    14 GB
    Sharded gradients:         14 GB / 8 = 1.75 GB per GPU
    Sharded optimizer state:   10.5 GB (same as Stage 1)

  Total per GPU: 14 + 1.75 + 10.5 = 26.25 GB  (was 112 GB)
  Savings: 77%
```

Communication changes: instead of all-reduce, use reduce-scatter
for gradients (each GPU only keeps its shard). Then all-gather
updated parameters after the optimizer step.

```
Stage 2 communication flow:

  Backward pass completes --> Gradients on all GPUs
       |
  Reduce-Scatter:
    GPU 0 gets reduced grads for params 0-874M
    GPU 1 gets reduced grads for params 875M-1749M
    ...
       |
  Optimizer step (local, on each GPU's shard only)
       |
  All-Gather updated parameters
    All GPUs reconstruct full parameter set
```

### Stage 3: Shard Everything

```
ZeRO Stage 3 (8 GPUs, 7B model):

  Each GPU holds:
    Sharded parameters:        14 GB / 8 = 1.75 GB
    Sharded gradients:         14 GB / 8 = 1.75 GB
    Sharded optimizer state:   10.5 GB

  Total per GPU: 1.75 + 1.75 + 10.5 = 14 GB  (was 112 GB)
  Savings: 87.5%
```

The catch: parameters must be gathered before each forward/backward
pass. This means more communication.

```
Stage 3 forward pass:

  For each layer:
    1. All-gather this layer's parameters from all GPUs
    2. Compute forward pass
    3. Discard gathered parameters (free memory)

  For each layer (backward):
    1. All-gather this layer's parameters again
    2. Compute backward pass
    3. Reduce-scatter gradients to shards
    4. Discard gathered parameters
```

---

## DeepSpeed Configuration

### Stage 1 Config

```json
{
  "bf16": {
    "enabled": true
  },
  "zero_optimization": {
    "stage": 1,
    "overlap_comm": true,
    "reduce_bucket_size": 5e8,
    "allgather_bucket_size": 5e8
  },
  "gradient_accumulation_steps": 4,
  "train_micro_batch_size_per_gpu": 8,
  "wall_clock_breakdown": true
}
```

### Stage 2 Config

```json
{
  "bf16": {
    "enabled": true
  },
  "zero_optimization": {
    "stage": 2,
    "overlap_comm": true,
    "contiguous_gradients": true,
    "reduce_bucket_size": 5e8,
    "allgather_bucket_size": 5e8
  },
  "gradient_accumulation_steps": 8,
  "train_micro_batch_size_per_gpu": 4
}
```

### Stage 3 Config

```json
{
  "bf16": {
    "enabled": true
  },
  "zero_optimization": {
    "stage": 3,
    "overlap_comm": true,
    "contiguous_gradients": true,
    "reduce_bucket_size": 5e8,
    "stage3_prefetch_bucket_size": 5e8,
    "stage3_param_persistence_threshold": 1e6,
    "stage3_max_live_parameters": 1e9,
    "stage3_max_reuse_distance": 1e9,
    "stage3_gather_16bit_weights_on_model_save": true
  },
  "gradient_accumulation_steps": 16,
  "train_micro_batch_size_per_gpu": 2
}
```

Key Stage 3 parameters:
- `stage3_prefetch_bucket_size`: how much to prefetch during
  forward/backward. Larger = more memory, less latency.
- `stage3_param_persistence_threshold`: params smaller than this
  stay replicated (not sharded). Small params aren't worth the
  communication cost.
- `stage3_max_live_parameters`: memory cap for gathered parameters.
  Controls the peak memory during forward pass.

### Training Script with DeepSpeed

```python
import deepspeed
import torch
import argparse

def train():
    parser = argparse.ArgumentParser()
    parser.add_argument('--local_rank', type=int, default=-1)
    parser = deepspeed.add_config_arguments(parser)
    args = parser.parse_args()

    torch.cuda.set_device(args.local_rank)

    model = build_model()
    train_dataset = build_dataset()

    model_engine, optimizer, train_loader, _ = deepspeed.initialize(
        args=args,
        model=model,
        training_data=train_dataset,
    )

    for epoch in range(num_epochs):
        for batch in train_loader:
            inputs = batch['input_ids'].to(model_engine.device)
            labels = batch['labels'].to(model_engine.device)

            outputs = model_engine(inputs, labels=labels)
            loss = outputs.loss

            model_engine.backward(loss)
            model_engine.step()
```

```bash
deepspeed --num_gpus=8 train.py --deepspeed_config ds_config.json
```

---

## PyTorch FSDP

FSDP (Fully Sharded Data Parallel) is PyTorch's native
implementation of ZeRO Stage 3. It's built into PyTorch core,
so no external library needed.

### Basic FSDP Setup

```python
import torch
import torch.distributed as dist
from torch.distributed.fsdp import (
    FullyShardedDataParallel as FSDP,
    MixedPrecision,
    ShardingStrategy,
    BackwardPrefetch,
    CPUOffload,
)
from torch.distributed.fsdp.wrap import (
    transformer_auto_wrap_policy,
    size_based_auto_wrap_policy,
)
import functools

def setup_fsdp_model(model, rank):
    bf16_policy = MixedPrecision(
        param_dtype=torch.bfloat16,
        reduce_dtype=torch.bfloat16,
        buffer_dtype=torch.bfloat16,
    )

    wrap_policy = functools.partial(
        transformer_auto_wrap_policy,
        transformer_layer_cls={TransformerBlock},
    )

    fsdp_model = FSDP(
        model,
        sharding_strategy=ShardingStrategy.FULL_SHARD,
        mixed_precision=bf16_policy,
        auto_wrap_policy=wrap_policy,
        backward_prefetch=BackwardPrefetch.BACKWARD_PRE,
        device_id=rank,
        limit_all_gathers=True,
        use_orig_params=True,
    )

    return fsdp_model
```

### Sharding Strategies

```
+-------------------+------------------+-------------------+---------+
| Strategy          | Equivalent       | Memory Savings    | Comms   |
+-------------------+------------------+-------------------+---------+
| FULL_SHARD        | ZeRO Stage 3     | Maximum           | Highest |
| SHARD_GRAD_OP     | ZeRO Stage 2     | Medium            | Medium  |
| NO_SHARD          | DDP              | None              | Lowest  |
| HYBRID_SHARD      | Stage 3 intra-   | High within node, | Medium  |
|                   | node, DDP across | DDP across        |         |
+-------------------+------------------+-------------------+---------+
```

`HYBRID_SHARD` is often the best choice for multi-node training.
It does full sharding within each node (fast NVLink) and DDP
across nodes (slower InfiniBand). This minimizes cross-node
communication.

```python
from torch.distributed.fsdp import ShardingStrategy
from torch.distributed.device_mesh import init_device_mesh

device_mesh = init_device_mesh(
    "cuda",
    (num_nodes, gpus_per_node),
    mesh_dim_names=("replicate", "shard"),
)

fsdp_model = FSDP(
    model,
    sharding_strategy=ShardingStrategy.HYBRID_SHARD,
    device_mesh=device_mesh,
    mixed_precision=bf16_policy,
    auto_wrap_policy=wrap_policy,
)
```

### FSDP Wrapping Policies

How you wrap layers determines the granularity of sharding.
Wrap too coarsely and you don't save memory. Wrap too finely
and communication overhead dominates.

```
Wrapping granularity:

  Too coarse (wrap entire model):
    One big shard. All-gather reconstructs entire model.
    Peak memory: nearly same as DDP. BAD.

  Just right (wrap each transformer layer):
    Each layer is independently sharded.
    All-gather reconstructs one layer at a time.
    Peak memory: 1 layer's full params + sharded rest. GOOD.

  Too fine (wrap every linear layer):
    Hundreds of tiny all-gathers.
    Overhead of each gather dominates. SLOW.
```

```python
from torch.distributed.fsdp.wrap import transformer_auto_wrap_policy
import functools

wrap_policy = functools.partial(
    transformer_auto_wrap_policy,
    transformer_layer_cls={
        LlamaDecoderLayer,
    },
)
```

---

## Mixed Precision with Distributed Training

Mixed precision interacts subtly with sharding. Getting it wrong
causes silent accuracy loss or training instability.

```
Mixed Precision Memory Layout:

  Forward/Backward (BF16):
    Activations: BF16 (half memory)
    Weights: BF16 (half memory)
    Gradients: BF16 (half memory)

  Optimizer Step (FP32):
    Master weights: FP32 (full precision copy)
    Adam momentum: FP32
    Adam variance: FP32
    Gradient cast to FP32 for the update

  After optimizer step:
    Cast updated FP32 master weights back to BF16 for next forward
```

### The BF16 vs FP16 Decision

```
+----------+----------+----------+----------------------------+
| Format   | Exponent | Mantissa | Practical Effect           |
+----------+----------+----------+----------------------------+
| FP32     | 8 bits   | 23 bits  | Full precision reference   |
| FP16     | 5 bits   | 10 bits  | Small dynamic range,       |
|          |          |          | needs loss scaling          |
| BF16     | 8 bits   | 7 bits   | Same range as FP32,        |
|          |          |          | less precision, NO scaling  |
+----------+----------+----------+----------------------------+

For large-scale training: USE BF16.

FP16 requires loss scaling (dynamic or static) because gradients
can underflow. BF16 has the same exponent range as FP32, so loss
scaling is unnecessary. One less thing to debug at 3 AM when your
training run is failing.
```

### DeepSpeed Mixed Precision Config

```json
{
  "bf16": {
    "enabled": true
  },
  "fp16": {
    "enabled": false
  },
  "zero_optimization": {
    "stage": 2
  },
  "gradient_clipping": 1.0
}
```

If you must use FP16 (older hardware without BF16 support):

```json
{
  "fp16": {
    "enabled": true,
    "loss_scale": 0,
    "initial_scale_power": 16,
    "loss_scale_window": 1000,
    "hysteresis": 2,
    "min_loss_scale": 1
  }
}
```

---

## Gradient Accumulation

When your per-GPU batch size is too small for good convergence
but you can't fit a larger batch in memory, accumulate gradients
over multiple forward-backward passes before updating.

```
Without gradient accumulation:
  Step 1: forward(batch_0) -> backward -> update
  Step 2: forward(batch_1) -> backward -> update
  Effective batch size = micro_batch_size * world_size

With gradient accumulation (steps=4):
  Step 1: forward(batch_0) -> backward (accumulate)
  Step 1: forward(batch_1) -> backward (accumulate)
  Step 1: forward(batch_2) -> backward (accumulate)
  Step 1: forward(batch_3) -> backward -> update
  Effective batch size = micro_batch_size * world_size * accum_steps
```

### Critical: Sync Gradients Only on the Last Accumulation Step

```python
from contextlib import nullcontext

def train_step(model, batches, optimizer, accum_steps):
    optimizer.zero_grad()

    for i, batch in enumerate(batches):
        is_last_step = (i == accum_steps - 1)

        if is_last_step:
            context = nullcontext()
        else:
            context = model.no_sync()

        with context:
            outputs = model(batch['input_ids'], labels=batch['labels'])
            loss = outputs.loss / accum_steps
            loss.backward()

    optimizer.step()
```

The `model.no_sync()` context manager skips the all-reduce
during intermediate accumulation steps. Without it, you'd do
`accum_steps` all-reduces instead of 1, wasting communication.

DeepSpeed handles this automatically through its config:

```json
{
  "gradient_accumulation_steps": 8,
  "train_micro_batch_size_per_gpu": 4
}
```

---

## Practical: Full FSDP Training Script

```python
import os
import torch
import torch.distributed as dist
from torch.distributed.fsdp import (
    FullyShardedDataParallel as FSDP,
    MixedPrecision,
    ShardingStrategy,
    BackwardPrefetch,
    FullStateDictConfig,
    StateDictType,
)
from torch.distributed.fsdp.wrap import transformer_auto_wrap_policy
import functools
from torch.utils.data import DataLoader, DistributedSampler
from transformers import AutoModelForCausalLM, AutoTokenizer

def setup():
    dist.init_process_group("nccl")
    rank = int(os.environ["LOCAL_RANK"])
    torch.cuda.set_device(rank)
    return rank

def create_fsdp_model(model_name, rank):
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.bfloat16,
        use_cache=False,
    )

    bf16_policy = MixedPrecision(
        param_dtype=torch.bfloat16,
        reduce_dtype=torch.bfloat16,
        buffer_dtype=torch.bfloat16,
    )

    from transformers.models.llama.modeling_llama import LlamaDecoderLayer
    wrap_policy = functools.partial(
        transformer_auto_wrap_policy,
        transformer_layer_cls={LlamaDecoderLayer},
    )

    fsdp_model = FSDP(
        model,
        sharding_strategy=ShardingStrategy.FULL_SHARD,
        mixed_precision=bf16_policy,
        auto_wrap_policy=wrap_policy,
        backward_prefetch=BackwardPrefetch.BACKWARD_PRE,
        device_id=rank,
        limit_all_gathers=True,
        use_orig_params=True,
    )

    return fsdp_model

def save_checkpoint(model, optimizer, epoch, path):
    save_policy = FullStateDictConfig(offload_to_cpu=True, rank0_only=True)
    with FSDP.state_dict_type(model, StateDictType.FULL_STATE_DICT, save_policy):
        state = {
            'model': model.state_dict(),
            'optimizer': optimizer.state_dict(),
            'epoch': epoch,
        }
        if dist.get_rank() == 0:
            torch.save(state, path)

def train():
    rank = setup()
    world_size = dist.get_world_size()

    model = create_fsdp_model("meta-llama/Llama-2-7b-hf", rank)
    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-5, weight_decay=0.01)

    dataset = build_dataset()
    sampler = DistributedSampler(dataset, num_replicas=world_size, rank=rank)
    loader = DataLoader(dataset, batch_size=4, sampler=sampler, num_workers=4,
                        pin_memory=True)

    accum_steps = 8

    for epoch in range(3):
        sampler.set_epoch(epoch)
        model.train()

        for step, batch in enumerate(loader):
            input_ids = batch['input_ids'].to(rank)
            labels = batch['labels'].to(rank)

            is_accum_step = ((step + 1) % accum_steps != 0)
            ctx = model.no_sync() if is_accum_step else nullcontext()

            with ctx:
                outputs = model(input_ids, labels=labels)
                loss = outputs.loss / accum_steps
                loss.backward()

            if not is_accum_step:
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                optimizer.zero_grad()

                if rank == 0 and step % 100 == 0:
                    print(f"Epoch {epoch}, Step {step}, Loss: {loss.item() * accum_steps:.4f}")

        save_checkpoint(model, optimizer, epoch, f"checkpoint_epoch_{epoch}.pt")

    dist.destroy_process_group()

if __name__ == "__main__":
    train()
```

```bash
torchrun --nproc_per_node=8 --nnodes=4 \
  --node_rank=$NODE_RANK \
  --master_addr=$MASTER_ADDR \
  --master_port=29500 \
  train_fsdp.py
```

---

## DeepSpeed vs FSDP: When to Choose Which

```
+---------------------+-------------------+--------------------+
| Factor              | DeepSpeed         | FSDP               |
+---------------------+-------------------+--------------------+
| PyTorch native      | No (separate lib) | Yes                |
| ZeRO Stage 1/2      | Better tuned      | SHARD_GRAD_OP      |
| ZeRO Stage 3        | More features     | Simpler API        |
| CPU offloading      | Mature, fast      | Available          |
| NVMe offloading     | Yes (ZeRO-Inf)    | No                 |
| Inference           | DeepSpeed-Inf     | Not designed for   |
| HuggingFace Trainer | Well integrated   | Well integrated    |
| Custom training     | Engine API        | Standard PyTorch   |
| Debugging           | Harder (wrapper)  | Easier (native)    |
| Activation ckpt     | Built-in          | torch.utils.ckpt   |
+---------------------+-------------------+--------------------+

Rule of thumb:
  - New project, PyTorch native: FSDP
  - Need CPU/NVMe offloading: DeepSpeed
  - Using HuggingFace Trainer: Either works, try both
  - Maximum control: FSDP (it's just PyTorch)
```

---

## Common Gotchas

1. **OOM on rank 0 only**: Rank 0 often handles logging, saving,
   and metric computation. This extra memory usage can push it
   over the limit while other ranks are fine. Fix: offload
   checkpoint saving to CPU (`offload_to_cpu=True`).

2. **Hanging during initialization**: FSDP wrapping must happen
   in the same order on all ranks. If any rank takes a different
   code path during model construction, it hangs forever waiting
   for a collective operation.

3. **Loss doesn't decrease with gradient accumulation**: You
   forgot to divide by `accum_steps`. The effective learning
   rate is `lr * accum_steps` without the division.

4. **Checkpoints are huge or slow**: Use `ShardedStateDictConfig`
   for large models -- each rank saves its own shard. Reassemble
   at load time. Much faster than gathering everything to rank 0.

5. **Different results with different GPU counts**: The effective
   batch size changes with world_size. Scale the learning rate
   proportionally (linear scaling rule) or keep the global batch
   size constant by adjusting micro-batch and accumulation steps.

---

## Exercises

1. **Memory calculation**: For a 13B model with BF16 + FP32 Adam,
   calculate per-GPU memory for ZeRO stages 1, 2, and 3 on 8 GPUs
   and 64 GPUs.

2. **Config tuning**: Start with the Stage 2 config above. Train
   a model and progressively reduce `train_micro_batch_size_per_gpu`
   while increasing `gradient_accumulation_steps`. Measure throughput
   at each setting.

3. **FSDP sharding**: Implement FSDP with `HYBRID_SHARD` on 2 nodes.
   Compare throughput with `FULL_SHARD` and measure the cross-node
   communication difference.

4. **Checkpoint experiment**: Save a checkpoint with `FULL_STATE_DICT`
   and `SHARDED_STATE_DICT`. Compare save time, disk usage, and load
   time for a 7B parameter model on 8 GPUs.
