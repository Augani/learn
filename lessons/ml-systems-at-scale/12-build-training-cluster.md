# Lesson 12: Build a Training Cluster (Capstone)

> **Analogy**: This is your final exam -- except instead of a
> written test, you're building a real machine. Everything from
> the previous lessons comes together: hardware knowledge, data
> pipelines, distributed training, stability, orchestration,
> evaluation, and cost awareness. Think of it like building a
> car from parts -- you've learned about each component, now
> you assemble and drive.

---

## The Project

Design and run a multi-GPU training pipeline for a 1.3B parameter
language model. This capstone covers:

```
+-----------------------------------------------------------+
|                    CAPSTONE PIPELINE                       |
|                                                           |
|  1. Data Loading        (Lesson 02)                       |
|  2. Distributed Training with FSDP (Lessons 03-04)       |
|  3. Training Stability  (Lesson 06)                       |
|  4. Checkpointing       (Lesson 06)                       |
|  5. Monitoring           (Lesson 06)                       |
|  6. Evaluation           (Lesson 09)                       |
|  7. Cost Tracking        (Lesson 10)                       |
+-----------------------------------------------------------+
```

Why 1.3B? It's large enough to require real distributed training
techniques but small enough to run on a single 8-GPU node in
reasonable time. The patterns transfer directly to 7B, 13B,
and 70B -- only the parallelism configuration changes.

---

## Phase 1: Model Architecture

We'll use a standard decoder-only transformer with modern
architectural choices.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

class RMSNorm(nn.Module):
    def __init__(self, dim, eps=1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x):
        norm = torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps)
        return x * norm * self.weight


class RotaryEmbedding(nn.Module):
    def __init__(self, dim, max_seq_len=4096):
        super().__init__()
        inv_freq = 1.0 / (10000 ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer('inv_freq', inv_freq)

        t = torch.arange(max_seq_len).float()
        freqs = torch.outer(t, inv_freq)
        self.register_buffer('cos_cached', freqs.cos())
        self.register_buffer('sin_cached', freqs.sin())

    def forward(self, seq_len):
        return self.cos_cached[:seq_len], self.sin_cached[:seq_len]


def apply_rotary_emb(x, cos, sin):
    d = x.shape[-1] // 2
    x1, x2 = x[..., :d], x[..., d:]
    return torch.cat([
        x1 * cos - x2 * sin,
        x2 * cos + x1 * sin,
    ], dim=-1)


class Attention(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.num_heads = config.num_heads
        self.head_dim = config.hidden_dim // config.num_heads

        self.q_proj = nn.Linear(config.hidden_dim, config.hidden_dim, bias=False)
        self.k_proj = nn.Linear(config.hidden_dim, config.hidden_dim, bias=False)
        self.v_proj = nn.Linear(config.hidden_dim, config.hidden_dim, bias=False)
        self.o_proj = nn.Linear(config.hidden_dim, config.hidden_dim, bias=False)

        self.rotary = RotaryEmbedding(self.head_dim, config.max_seq_len)

    def forward(self, x, mask=None):
        batch, seq_len, _ = x.shape

        q = self.q_proj(x).view(batch, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(batch, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(batch, seq_len, self.num_heads, self.head_dim).transpose(1, 2)

        cos, sin = self.rotary(seq_len)
        cos = cos.unsqueeze(0).unsqueeze(0)
        sin = sin.unsqueeze(0).unsqueeze(0)
        q = apply_rotary_emb(q, cos, sin)
        k = apply_rotary_emb(k, cos, sin)

        out = F.scaled_dot_product_attention(q, k, v, is_causal=True)

        out = out.transpose(1, 2).contiguous().view(batch, seq_len, -1)
        return self.o_proj(out)


class MLP(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.gate_proj = nn.Linear(config.hidden_dim, config.intermediate_dim, bias=False)
        self.up_proj = nn.Linear(config.hidden_dim, config.intermediate_dim, bias=False)
        self.down_proj = nn.Linear(config.intermediate_dim, config.hidden_dim, bias=False)

    def forward(self, x):
        return self.down_proj(F.silu(self.gate_proj(x)) * self.up_proj(x))


class TransformerBlock(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.attention = Attention(config)
        self.mlp = MLP(config)
        self.attn_norm = RMSNorm(config.hidden_dim)
        self.mlp_norm = RMSNorm(config.hidden_dim)

    def forward(self, x):
        x = x + self.attention(self.attn_norm(x))
        x = x + self.mlp(self.mlp_norm(x))
        return x


class LanguageModel(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.embed = nn.Embedding(config.vocab_size, config.hidden_dim)
        self.layers = nn.ModuleList([
            TransformerBlock(config) for _ in range(config.num_layers)
        ])
        self.norm = RMSNorm(config.hidden_dim)
        self.head = nn.Linear(config.hidden_dim, config.vocab_size, bias=False)

        self.head.weight = self.embed.weight

        self.apply(self._init_weights)

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, input_ids, labels=None):
        x = self.embed(input_ids)

        for layer in self.layers:
            x = layer(x)

        x = self.norm(x)
        logits = self.head(x)

        loss = None
        if labels is not None:
            shift_logits = logits[..., :-1, :].contiguous()
            shift_labels = labels[..., 1:].contiguous()
            loss = F.cross_entropy(
                shift_logits.view(-1, self.config.vocab_size),
                shift_labels.view(-1),
            )

        return loss, logits
```

### Model Configuration

```python
from dataclasses import dataclass

@dataclass
class ModelConfig:
    hidden_dim: int = 2048
    intermediate_dim: int = 5504
    num_layers: int = 24
    num_heads: int = 16
    vocab_size: int = 32000
    max_seq_len: int = 2048

    @property
    def num_params(self):
        embed = self.vocab_size * self.hidden_dim
        attn = 4 * self.hidden_dim * self.hidden_dim * self.num_layers
        mlp = 3 * self.hidden_dim * self.intermediate_dim * self.num_layers
        norm = 2 * self.hidden_dim * self.num_layers + self.hidden_dim
        return embed + attn + mlp + norm
```

```
1.3B model configuration:
  hidden_dim:       2048
  intermediate_dim: 5504  (2.7x hidden)
  num_layers:       24
  num_heads:        16
  head_dim:         128
  vocab_size:       32000
  max_seq_len:      2048

  Parameter count:
    Embeddings:      65.5M
    Attention:       402M  (24 layers * 4 * 2048^2)
    MLP:             792M  (24 layers * 3 * 2048 * 5504)
    Norms:           0.1M
    Total:           ~1.26B (close enough to 1.3B)
```

---

## Phase 2: Data Pipeline

```python
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader, DistributedSampler

class TokenDataset(Dataset):
    def __init__(self, data_path, seq_length):
        self.data = np.memmap(data_path, dtype=np.uint16, mode='r')
        self.seq_length = seq_length

    def __len__(self):
        return (len(self.data) - 1) // self.seq_length

    def __getitem__(self, idx):
        start = idx * self.seq_length
        end = start + self.seq_length + 1
        chunk = torch.from_numpy(self.data[start:end].astype(np.int64))
        return {
            'input_ids': chunk[:-1],
            'labels': chunk[1:],
        }


def create_dataloader(data_path, seq_length, batch_size, rank, world_size, num_workers=4):
    dataset = TokenDataset(data_path, seq_length)
    sampler = DistributedSampler(
        dataset,
        num_replicas=world_size,
        rank=rank,
        shuffle=True,
        seed=42,
    )
    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        sampler=sampler,
        num_workers=num_workers,
        pin_memory=True,
        persistent_workers=True,
        prefetch_factor=4,
    )
    return loader, sampler
```

### Preparing the Data

```bash
pip install tiktoken datasets

python prepare_data.py
```

```python
import numpy as np
import tiktoken

def prepare_openwebtext():
    from datasets import load_dataset

    dataset = load_dataset("openwebtext", split="train")
    enc = tiktoken.get_encoding("gpt2")

    all_tokens = []
    for i, example in enumerate(dataset):
        tokens = enc.encode_ordinary(example['text'])
        tokens.append(enc.eot_token)
        all_tokens.extend(tokens)

        if (i + 1) % 100000 == 0:
            print(f"Processed {i+1} documents, {len(all_tokens):,} tokens")

    all_tokens = np.array(all_tokens, dtype=np.uint16)

    n = len(all_tokens)
    train_tokens = all_tokens[:int(n * 0.99)]
    val_tokens = all_tokens[int(n * 0.99):]

    train_tokens.tofile("data/train.bin")
    val_tokens.tofile("data/val.bin")

    print(f"Train: {len(train_tokens):,} tokens")
    print(f"Val: {len(val_tokens):,} tokens")

if __name__ == "__main__":
    prepare_openwebtext()
```

---

## Phase 3: FSDP Training Loop

```python
import os
import time
import math
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
from contextlib import nullcontext

def setup_distributed():
    dist.init_process_group("nccl")
    rank = int(os.environ["LOCAL_RANK"])
    world_size = dist.get_world_size()
    torch.cuda.set_device(rank)
    return rank, world_size


def wrap_model_fsdp(model, rank):
    bf16_policy = MixedPrecision(
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
        mixed_precision=bf16_policy,
        auto_wrap_policy=wrap_policy,
        backward_prefetch=BackwardPrefetch.BACKWARD_PRE,
        device_id=rank,
        limit_all_gathers=True,
        use_orig_params=True,
    )

    return model


def get_lr(step, warmup_steps, max_lr, min_lr, total_steps):
    if step < warmup_steps:
        return max_lr * step / warmup_steps

    if step >= total_steps:
        return min_lr

    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    cosine_decay = 0.5 * (1.0 + math.cos(math.pi * progress))
    return min_lr + (max_lr - min_lr) * cosine_decay


def save_checkpoint(model, optimizer, step, loss, save_dir, rank):
    os.makedirs(save_dir, exist_ok=True)

    save_policy = FullStateDictConfig(offload_to_cpu=True, rank0_only=True)
    with FSDP.state_dict_type(model, StateDictType.FULL_STATE_DICT, save_policy):
        state = {
            'step': step,
            'model': model.state_dict(),
            'optimizer': optimizer.state_dict(),
            'loss': loss,
        }
        if rank == 0:
            path = os.path.join(save_dir, f"checkpoint-{step}.pt")
            torch.save(state, path)
            print(f"Saved checkpoint to {path}")

    dist.barrier()


def train():
    rank, world_size = setup_distributed()

    config = ModelConfig()
    if rank == 0:
        print(f"Model parameters: {config.num_params:,}")

    max_lr = 3e-4
    min_lr = 3e-5
    warmup_steps = 1000
    total_steps = 50000
    micro_batch_size = 8
    accum_steps = 4
    seq_length = 2048
    save_every = 2000
    eval_every = 1000
    log_every = 10
    save_dir = "checkpoints/capstone"
    gradient_clip = 1.0

    global_batch_size = micro_batch_size * accum_steps * world_size
    tokens_per_step = global_batch_size * seq_length

    if rank == 0:
        print(f"Global batch size: {global_batch_size}")
        print(f"Tokens per step: {tokens_per_step:,}")
        import wandb
        wandb.init(
            project="capstone-1.3b",
            config={
                "model_params": config.num_params,
                "max_lr": max_lr,
                "warmup_steps": warmup_steps,
                "total_steps": total_steps,
                "global_batch_size": global_batch_size,
                "world_size": world_size,
            },
        )

    model = LanguageModel(config)
    model = wrap_model_fsdp(model, rank)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=max_lr,
        betas=(0.9, 0.95),
        weight_decay=0.1,
        fused=True,
    )

    train_loader, train_sampler = create_dataloader(
        "data/train.bin", seq_length, micro_batch_size, rank, world_size
    )
    val_loader, _ = create_dataloader(
        "data/val.bin", seq_length, micro_batch_size, rank, world_size
    )

    train_iter = iter(train_loader)
    step = 0
    total_tokens = 0
    start_time = time.time()

    while step < total_steps:
        model.train()
        optimizer.zero_grad()

        loss_accum = 0.0

        for micro_step in range(accum_steps):
            try:
                batch = next(train_iter)
            except StopIteration:
                train_sampler.set_epoch(train_sampler.epoch + 1)
                train_iter = iter(train_loader)
                batch = next(train_iter)

            input_ids = batch['input_ids'].to(rank)
            labels = batch['labels'].to(rank)

            is_last = (micro_step == accum_steps - 1)
            ctx = nullcontext() if is_last else model.no_sync()

            with ctx:
                loss, _ = model(input_ids, labels)
                scaled_loss = loss / accum_steps
                scaled_loss.backward()

            loss_accum += loss.item() / accum_steps

        grad_norm = torch.nn.utils.clip_grad_norm_(
            model.parameters(), gradient_clip
        )

        lr = get_lr(step, warmup_steps, max_lr, min_lr, total_steps)
        for param_group in optimizer.param_groups:
            param_group['lr'] = lr

        optimizer.step()

        total_tokens += tokens_per_step
        elapsed = time.time() - start_time
        tokens_per_sec = total_tokens / elapsed

        if rank == 0 and step % log_every == 0:
            print(
                f"Step {step:6d} | Loss {loss_accum:.4f} | "
                f"LR {lr:.2e} | Grad norm {grad_norm:.4f} | "
                f"Tokens/s {tokens_per_sec:,.0f}"
            )
            wandb.log({
                "train/loss": loss_accum,
                "train/lr": lr,
                "train/grad_norm": grad_norm.item() if isinstance(grad_norm, torch.Tensor) else grad_norm,
                "train/tokens_per_sec": tokens_per_sec,
                "train/total_tokens": total_tokens,
            }, step=step)

        if step > 0 and step % eval_every == 0:
            val_loss = evaluate(model, val_loader, rank, max_batches=50)
            if rank == 0:
                print(f"Step {step} | Val loss: {val_loss:.4f}")
                wandb.log({"val/loss": val_loss}, step=step)

        if step > 0 and step % save_every == 0:
            save_checkpoint(model, optimizer, step, loss_accum, save_dir, rank)

        step += 1

    save_checkpoint(model, optimizer, step, loss_accum, save_dir, rank)

    if rank == 0:
        total_time = time.time() - start_time
        print(f"\nTraining complete!")
        print(f"Total time: {total_time/3600:.2f} hours")
        print(f"Total tokens: {total_tokens:,}")
        print(f"Average throughput: {total_tokens/total_time:,.0f} tokens/sec")
        wandb.finish()

    dist.destroy_process_group()


@torch.no_grad()
def evaluate(model, val_loader, rank, max_batches=50):
    model.eval()
    total_loss = 0.0
    count = 0

    for i, batch in enumerate(val_loader):
        if i >= max_batches:
            break

        input_ids = batch['input_ids'].to(rank)
        labels = batch['labels'].to(rank)

        loss, _ = model(input_ids, labels)
        total_loss += loss.item()
        count += 1

    avg_loss = torch.tensor(total_loss / max(count, 1), device=rank)
    dist.all_reduce(avg_loss, op=dist.ReduceOp.AVG)
    model.train()
    return avg_loss.item()


if __name__ == "__main__":
    train()
```

---

## Phase 4: Launch Script

```bash
#!/bin/bash

export CUDA_VISIBLE_DEVICES=0,1,2,3,4,5,6,7
export NCCL_DEBUG=WARN
export TORCH_NCCL_ASYNC_ERROR_HANDLING=1

torchrun \
    --nproc_per_node=8 \
    --nnodes=1 \
    --node_rank=0 \
    --master_addr=localhost \
    --master_port=29500 \
    train_capstone.py
```

For multi-node:

```bash
#!/bin/bash
#SBATCH --job-name=capstone-1.3b
#SBATCH --nodes=2
#SBATCH --ntasks-per-node=1
#SBATCH --gpus-per-node=8
#SBATCH --cpus-per-task=96
#SBATCH --time=24:00:00
#SBATCH --exclusive

export MASTER_ADDR=$(scontrol show hostname $SLURM_NODELIST | head -n1)
export MASTER_PORT=29500

MAX_RESTARTS=3
RESTART_COUNT=0

while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
    srun torchrun \
        --nnodes=$SLURM_NNODES \
        --nproc_per_node=8 \
        --rdzv_id=$SLURM_JOB_ID \
        --rdzv_backend=c10d \
        --rdzv_endpoint=$MASTER_ADDR:$MASTER_PORT \
        train_capstone.py

    if [ $? -eq 0 ]; then
        echo "Training completed successfully"
        exit 0
    fi

    RESTART_COUNT=$((RESTART_COUNT + 1))
    echo "Restarting (attempt $RESTART_COUNT/$MAX_RESTARTS)..."
    sleep 30
done

echo "Training failed after $MAX_RESTARTS restarts"
exit 1
```

---

## Phase 5: Monitoring Dashboard

Set up these W&B panels:

```
Dashboard layout:

  Row 1: Training Progress
  +-------------------+-------------------+
  | Loss curve        | Learning rate     |
  | (train + val)     | schedule          |
  +-------------------+-------------------+

  Row 2: Health Metrics
  +-------------------+-------------------+
  | Gradient norm     | Tokens/sec        |
  | (per step)        | throughput        |
  +-------------------+-------------------+

  Row 3: Cost
  +-------------------+-------------------+
  | Estimated cost    | Cost per 1B       |
  | (cumulative $)    | tokens            |
  +-------------------+-------------------+
```

---

## Phase 6: Evaluation

After training completes, run evaluation:

```bash
lm_eval --model hf \
    --model_args pretrained=checkpoints/capstone/final,tokenizer=gpt2 \
    --tasks hellaswag,arc_easy,arc_challenge,piqa,winogrande,boolq \
    --batch_size auto \
    --output_path eval_results/capstone/
```

### Expected Results for 1.3B Model

```
+------------------+----------------------+
| Benchmark        | Expected Range       |
+------------------+----------------------+
| HellaSwag        | 55-65%               |
| ARC-Easy         | 60-70%               |
| ARC-Challenge    | 30-40%               |
| PIQA             | 72-78%               |
| WinoGrande       | 55-62%               |
| BoolQ            | 60-68%               |
+------------------+----------------------+

If your numbers are significantly below these ranges,
check:
  1. Training data quality (did tokenization work?)
  2. Training loss convergence (did loss plateau?)
  3. Evaluation setup (correct prompt format?)
```

---

## Grading Rubric

```
Component             Points   What to Check
---------------------------------------------------
Data pipeline works     15     Memmap loads correctly,
                               DataLoader sustains throughput

FSDP training runs      20     All GPUs utilized,
                               gradients synced correctly

Training converges      15     Loss decreases monotonically
                               (after warmup)

Checkpointing works     10     Can resume from checkpoint,
                               loss matches at resume point

Monitoring active       10     W&B dashboard with all metrics,
                               gradient norms tracked

Evaluation pipeline     10     Benchmark results computed,
                               scores in expected range

Stability handling      10     Gradient clipping active,
                               NaN detection present

Code quality            10     Clean structure, no hardcoded
                               paths, config-driven

Total                  100
```

---

## Extension Challenges

Once the basic pipeline works, try these:

```
Challenge 1: Scale to 2 nodes
  - Set up multi-node training
  - Verify throughput scales >85% linearly
  - Handle node failure gracefully

Challenge 2: Add activation checkpointing
  - Implement selective checkpointing
  - Double the batch size with the freed memory
  - Measure throughput impact

Challenge 3: Implement HYBRID_SHARD
  - Use device mesh for intra-node sharding
  - Compare throughput with FULL_SHARD on 2 nodes

Challenge 4: Add data mixing
  - Combine OpenWebText with code data (The Stack)
  - Implement weighted sampling
  - Track per-source loss

Challenge 5: Continuous evaluation
  - Auto-evaluate every 5000 steps
  - Plot eval metrics alongside training loss
  - Implement early stopping based on eval
```

---

## What You've Built

By completing this capstone, you have a production-grade
training pipeline that:

```
  [Data Pipeline]
       |
       v
  [FSDP Distributed Training]
       |
       +---> [Gradient Clipping + NaN Detection]
       |
       +---> [Cosine LR Schedule with Warmup]
       |
       +---> [Checkpointing with Resume]
       |
       +---> [W&B Monitoring + Cost Tracking]
       |
       v
  [Evaluation Harness]
       |
       v
  [Trained 1.3B Language Model]
```

The exact same architecture scales to 7B, 13B, 70B by changing:
- Model config (layers, hidden_dim)
- Parallelism strategy (add TP, PP as needed)
- Cluster size
- Training duration and data

The code structure and operational patterns remain the same.
That's the whole point -- **good infrastructure scales**.
