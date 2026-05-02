# Reference: Distributed Training Patterns & Configs

Quick reference for distributed training configurations.

---

## Parallelism Strategy Decision Tree

```
START: What's your model size vs GPU memory?

  Model (params + gradients + optimizer) fits on 1 GPU?
  │
  ├── YES ──► Data Parallelism (DDP)
  │           torchrun --nproc_per_node=N train.py
  │
  └── NO ──► Optimizer state is the problem?
             │
             ├── YES ──► FSDP SHARD_GRAD_OP (ZeRO Stage 2)
             │           or DeepSpeed ZeRO Stage 2
             │
             └── NO ──► Model itself doesn't fit on 1 GPU?
                        │
                        ├── Fits on 1 node (8 GPUs) ──► FSDP FULL_SHARD
                        │                                or ZeRO Stage 3
                        │
                        └── Doesn't fit on 1 node ──► 3D Parallelism
                                                       TP + PP + DP
```

---

## PyTorch DDP (Simplest)

```python
import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader, DistributedSampler

dist.init_process_group("nccl")
rank = int(os.environ["LOCAL_RANK"])
torch.cuda.set_device(rank)

model = MyModel().to(rank)
model = DDP(model, device_ids=[rank])

sampler = DistributedSampler(dataset)
loader = DataLoader(dataset, batch_size=32, sampler=sampler)

for epoch in range(num_epochs):
    sampler.set_epoch(epoch)
    for batch in loader:
        loss = model(batch.to(rank))
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()

dist.destroy_process_group()
```

```bash
torchrun --nproc_per_node=8 train.py
```

---

## PyTorch FSDP Configurations

### FULL_SHARD (ZeRO Stage 3)

```python
from torch.distributed.fsdp import (
    FullyShardedDataParallel as FSDP,
    MixedPrecision,
    ShardingStrategy,
    BackwardPrefetch,
)
from torch.distributed.fsdp.wrap import transformer_auto_wrap_policy
import functools

bf16_mp = MixedPrecision(
    param_dtype=torch.bfloat16,
    reduce_dtype=torch.bfloat16,
    buffer_dtype=torch.bfloat16,
)

wrap_policy = functools.partial(
    transformer_auto_wrap_policy,
    transformer_layer_cls={TransformerBlock},
)

model = FSDP(
    model,
    sharding_strategy=ShardingStrategy.FULL_SHARD,
    mixed_precision=bf16_mp,
    auto_wrap_policy=wrap_policy,
    backward_prefetch=BackwardPrefetch.BACKWARD_PRE,
    device_id=rank,
    limit_all_gathers=True,
    use_orig_params=True,
)
```

### HYBRID_SHARD (Best for Multi-Node)

```python
from torch.distributed.device_mesh import init_device_mesh

device_mesh = init_device_mesh(
    "cuda",
    (num_nodes, gpus_per_node),
    mesh_dim_names=("replicate", "shard"),
)

model = FSDP(
    model,
    sharding_strategy=ShardingStrategy.HYBRID_SHARD,
    device_mesh=device_mesh,
    mixed_precision=bf16_mp,
    auto_wrap_policy=wrap_policy,
)
```

### FSDP Checkpoint Save/Load

```python
from torch.distributed.fsdp import (
    FullStateDictConfig,
    StateDictType,
)

save_policy = FullStateDictConfig(offload_to_cpu=True, rank0_only=True)
with FSDP.state_dict_type(model, StateDictType.FULL_STATE_DICT, save_policy):
    if rank == 0:
        torch.save(model.state_dict(), "checkpoint.pt")

with FSDP.state_dict_type(model, StateDictType.FULL_STATE_DICT):
    state = torch.load("checkpoint.pt", map_location="cpu")
    model.load_state_dict(state)
```

### FSDP Gradient Accumulation

```python
from contextlib import nullcontext

for micro_step in range(accum_steps):
    is_last = (micro_step == accum_steps - 1)
    ctx = nullcontext() if is_last else model.no_sync()

    with ctx:
        loss = model(batch) / accum_steps
        loss.backward()

optimizer.step()
optimizer.zero_grad()
```

---

## DeepSpeed Configurations

### ZeRO Stage 1

```json
{
  "bf16": {"enabled": true},
  "zero_optimization": {
    "stage": 1,
    "overlap_comm": true,
    "reduce_bucket_size": 5e8
  },
  "gradient_accumulation_steps": 4,
  "train_micro_batch_size_per_gpu": 8
}
```

### ZeRO Stage 2

```json
{
  "bf16": {"enabled": true},
  "zero_optimization": {
    "stage": 2,
    "overlap_comm": true,
    "contiguous_gradients": true,
    "reduce_bucket_size": 5e8
  },
  "gradient_accumulation_steps": 8,
  "train_micro_batch_size_per_gpu": 4,
  "gradient_clipping": 1.0
}
```

### ZeRO Stage 3

```json
{
  "bf16": {"enabled": true},
  "zero_optimization": {
    "stage": 3,
    "overlap_comm": true,
    "contiguous_gradients": true,
    "reduce_bucket_size": 5e8,
    "stage3_prefetch_bucket_size": 5e8,
    "stage3_param_persistence_threshold": 1e6,
    "stage3_max_live_parameters": 1e9,
    "stage3_gather_16bit_weights_on_model_save": true
  },
  "gradient_accumulation_steps": 16,
  "train_micro_batch_size_per_gpu": 2,
  "gradient_clipping": 1.0
}
```

### ZeRO Stage 3 + CPU Offloading

```json
{
  "bf16": {"enabled": true},
  "zero_optimization": {
    "stage": 3,
    "offload_optimizer": {
      "device": "cpu",
      "pin_memory": true
    },
    "offload_param": {
      "device": "cpu",
      "pin_memory": true
    },
    "overlap_comm": true,
    "contiguous_gradients": true,
    "stage3_gather_16bit_weights_on_model_save": true
  },
  "gradient_accumulation_steps": 32,
  "train_micro_batch_size_per_gpu": 1,
  "gradient_clipping": 1.0
}
```

### DeepSpeed Training Script Template

```python
import deepspeed

parser = argparse.ArgumentParser()
parser.add_argument('--local_rank', type=int, default=-1)
parser = deepspeed.add_config_arguments(parser)
args = parser.parse_args()

model = build_model()

model_engine, optimizer, loader, _ = deepspeed.initialize(
    args=args,
    model=model,
    training_data=dataset,
)

for batch in loader:
    outputs = model_engine(batch.to(model_engine.device))
    loss = outputs.loss
    model_engine.backward(loss)
    model_engine.step()
```

```bash
deepspeed --num_gpus=8 train.py --deepspeed_config config.json
```

---

## Communication Primitives

```
ALL-REDUCE (gradient averaging in DDP):
  dist.all_reduce(tensor, op=dist.ReduceOp.SUM)
  tensor /= world_size

ALL-GATHER (parameter reconstruction in FSDP):
  gathered = [torch.empty_like(local) for _ in range(world_size)]
  dist.all_gather(gathered, local)
  full = torch.cat(gathered)

REDUCE-SCATTER (gradient sharding in FSDP):
  output = torch.empty(local_size, device=device)
  dist.reduce_scatter(output, list_of_tensors, op=dist.ReduceOp.SUM)

BROADCAST (initial model distribution):
  dist.broadcast(tensor, src=0)

ALL-TO-ALL (expert parallelism):
  output = torch.empty_like(input)
  dist.all_to_all_single(output, input)
```

### Communication Costs

```
For N GPUs, D bytes of data, bandwidth B:

  All-Reduce (ring):    2 * D * (N-1)/N / B
  All-Gather:           D * (N-1)/N / B
  Reduce-Scatter:       D * (N-1)/N / B
  Broadcast:            D / B (approx, tree-based)
  All-to-All:           D * (N-1)/N / B
```

---

## NCCL Environment Variables

```bash
export NCCL_DEBUG=WARN
export NCCL_SOCKET_IFNAME=ib0
export NCCL_IB_DISABLE=0

export NCCL_IB_HCA=mlx5
export NCCL_IB_TIMEOUT=23
export NCCL_IB_RETRY_CNT=7

export NCCL_NVLS_ENABLE=1

export NCCL_P2P_LEVEL=NVL
export NCCL_SHM_DISABLE=0
export NCCL_BUFFSIZE=8388608
```

---

## torchrun Launch Patterns

### Single Node

```bash
torchrun --nproc_per_node=8 train.py
```

### Multi-Node (static)

```bash
torchrun \
  --nnodes=4 \
  --nproc_per_node=8 \
  --node_rank=$RANK \
  --master_addr=$MASTER \
  --master_port=29500 \
  train.py
```

### Multi-Node (elastic)

```bash
torchrun \
  --nnodes=4:8 \
  --nproc_per_node=8 \
  --max_restarts=3 \
  --rdzv_id=my_job \
  --rdzv_backend=c10d \
  --rdzv_endpoint=$MASTER:29500 \
  train.py
```

### Slurm + torchrun

```bash
srun torchrun \
  --nnodes=$SLURM_NNODES \
  --nproc_per_node=8 \
  --rdzv_id=$SLURM_JOB_ID \
  --rdzv_backend=c10d \
  --rdzv_endpoint=$MASTER_ADDR:29500 \
  train.py
```

---

## Common Configuration Patterns

### 7B Model on 8 GPUs (1 Node)

```
Parallelism: FSDP FULL_SHARD (or ZeRO Stage 3)
TP=1, PP=1, DP=8
Micro-batch: 4
Accum steps: 8
Global batch: 256
Mixed precision: BF16
Activation checkpointing: Every 4 layers
```

### 13B Model on 16 GPUs (2 Nodes)

```
Parallelism: FSDP HYBRID_SHARD
TP=1, PP=1, DP=16 (shard within node, replicate across)
Micro-batch: 2
Accum steps: 16
Global batch: 512
Mixed precision: BF16
Activation checkpointing: Every 2 layers
```

### 70B Model on 64 GPUs (8 Nodes)

```
Parallelism: 3D (Megatron-LM style)
TP=8 (within node), PP=2, DP=4
Micro-batch: 1
Accum steps: 64
Global batch: 256
Mixed precision: BF16
Activation checkpointing: All layers
Sequence parallelism: Enabled
```

### 175B Model on 512 GPUs (64 Nodes)

```
Parallelism: 3D
TP=8 (within node), PP=8 (8 stages), DP=8
Micro-batch: 1
Accum steps: 32
Global batch: 256
Pipeline micro-batches: 32 (1F1B schedule)
Mixed precision: BF16
Activation checkpointing: All layers
Sequence parallelism: Enabled
Gradient compression: Optional (PowerSGD rank 4)
```

---

## Debugging Checklist

```
Training won't start:
  [ ] NCCL_DEBUG=INFO to see initialization logs
  [ ] Check all nodes can reach MASTER_ADDR:MASTER_PORT
  [ ] Verify CUDA_VISIBLE_DEVICES is set correctly
  [ ] Check NCCL_SOCKET_IFNAME matches network interface

Training hangs:
  [ ] Set NCCL timeout: dist.init_process_group(timeout=timedelta(minutes=30))
  [ ] Check for deadlocks: different code paths on different ranks
  [ ] Verify all ranks call same collective operations in same order
  [ ] Check for OOM on one rank (others hang waiting)

OOM errors:
  [ ] Reduce micro_batch_size first
  [ ] Enable activation checkpointing
  [ ] Switch to FULL_SHARD if using SHARD_GRAD_OP
  [ ] Enable CPU offloading as last resort
  [ ] Check for memory leaks: torch.cuda.memory_summary()

Slow training:
  [ ] Profile with torch.profiler or nsys
  [ ] Check GPU utilization: nvidia-smi -l 1
  [ ] Measure NCCL time vs compute time
  [ ] Verify data loading isn't bottleneck (prefetch_factor)
  [ ] Check for excessive Python overhead (compile if possible)

Loss doesn't decrease:
  [ ] Verify data pipeline (print samples, check tokenization)
  [ ] Check learning rate schedule (too high? no warmup?)
  [ ] Verify gradient accumulation divides loss by accum_steps
  [ ] Check model initialization
  [ ] Ensure model.train() is called
```
