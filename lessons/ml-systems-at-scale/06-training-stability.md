# Lesson 06: Training Stability

> **Analogy**: Training a large model is like balancing on a
> tightrope while juggling. At small scale, the rope is thick
> and forgiving -- you can stumble and recover. At scale, the
> rope is a wire, and any wobble amplifies. A loss spike at step
> 50K of a $2 million training run isn't an academic problem --
> it's a career-defining moment. This lesson teaches you how to
> keep your balance.

---

## Why Training Gets Unstable at Scale

Three things change when you scale up:

```
1. LARGER BATCH SIZES
   Small scale: batch 32-256
   Large scale: batch 2048-65536
   Effect: Sharper minima, harder to generalize, need LR tuning

2. MORE PARAMETERS
   Small scale: 100M params
   Large scale: 70B params
   Effect: More dimensions for gradients to misbehave,
           more layers for signals to vanish/explode

3. LONGER TRAINING
   Small scale: hours
   Large scale: weeks to months
   Effect: Rare numerical events become inevitable.
           A 1-in-a-million NaN happens every few hours.
```

---

## Loss Spikes: The Silent Killer

A loss spike is a sudden, dramatic increase in training loss
that may or may not recover. At large scale, they're common
and expensive.

```
Normal training loss:

  Loss
  10 |
     |\.
   5 |  \.
     |    \...
   2 |       \.....
     |            \...........
   1 |                        \.........
     +-------+-------+-------+-------+---> Steps
     0      10K     20K     30K     40K

Loss spike at 25K:

  Loss
  10 |                  *
     |\.               / \
   5 |  \.            /   \
     |    \...       /     \
   2 |       \......*       \.....
     |                           \.........
   1 |
     +-------+-------+-------+-------+---> Steps
     0      10K     20K     30K     40K

  * = spike. Cost: 5K steps of wasted compute if you don't recover.
  At $500/hr on 64 GPUs: potentially $50K+ down the drain.
```

### Common Causes of Loss Spikes

```
+---------------------------+----------------------------------+
| Cause                     | Evidence                         |
+---------------------------+----------------------------------+
| Bad data batch            | Spike correlates with specific   |
|                           | data shard; not reproducible     |
+---------------------------+----------------------------------+
| Learning rate too high    | Spikes happen periodically,      |
|                           | especially after warmup          |
+---------------------------+----------------------------------+
| Gradient explosion        | Gradient norm spikes just before |
|                           | loss spike                       |
+---------------------------+----------------------------------+
| Numerical instability     | NaN/Inf in specific layers;      |
|                           | often in attention or LayerNorm  |
+---------------------------+----------------------------------+
| Embedding instability     | Large embedding norms correlate  |
|                           | with spikes                      |
+---------------------------+----------------------------------+
| Data distribution shift   | Spike correlates with new data   |
|                           | source in curriculum             |
+---------------------------+----------------------------------+
```

---

## Gradient Explosions and Vanishing

### Detecting Gradient Problems

```python
import torch

def monitor_gradients(model, step, threshold=10.0):
    total_norm = 0.0
    layer_norms = {}

    for name, param in model.named_parameters():
        if param.grad is not None:
            param_norm = param.grad.data.norm(2).item()
            total_norm += param_norm ** 2
            layer_norms[name] = param_norm

            if param_norm > threshold:
                print(f"WARNING step {step}: {name} grad norm = {param_norm:.4f}")

            if torch.isnan(param.grad).any():
                print(f"CRITICAL step {step}: NaN gradient in {name}")

            if torch.isinf(param.grad).any():
                print(f"CRITICAL step {step}: Inf gradient in {name}")

    total_norm = total_norm ** 0.5
    return total_norm, layer_norms
```

### Gradient Clipping: Your First Line of Defense

```python
max_grad_norm = 1.0

torch.nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)

optimizer.step()
```

But how do you choose `max_grad_norm`? Profile it:

```python
def find_grad_norm_baseline(model, loader, num_steps=1000):
    norms = []
    for step, batch in enumerate(loader):
        if step >= num_steps:
            break
        loss = model(batch).loss
        loss.backward()

        norm = torch.nn.utils.clip_grad_norm_(model.parameters(), float('inf'))
        norms.append(norm.item())

        optimizer.step()
        optimizer.zero_grad()

    import numpy as np
    p50 = np.percentile(norms, 50)
    p99 = np.percentile(norms, 99)
    print(f"Gradient norm P50: {p50:.4f}, P99: {p99:.4f}")
    print(f"Suggested max_grad_norm: {p99:.1f}")
    return norms
```

Typically, set `max_grad_norm` to the 99th percentile of observed
gradient norms during early training. This clips only the extreme
outliers.

---

## NaN Debugging: A Systematic Approach

When NaN appears in your loss or gradients, you need to find
exactly where it originates. NaN propagates forward -- once
a single value is NaN, everything downstream is NaN.

### Step 1: Enable Anomaly Detection

```python
torch.autograd.set_detect_anomaly(True)

loss.backward()
```

This adds checks at every operation but is **very slow**. Only
enable it during debugging. It will print a stack trace pointing
to the exact operation that produced the NaN.

### Step 2: Bisect with NaN Checks

```python
def nan_check_hook(module, input, output):
    if isinstance(output, torch.Tensor):
        if torch.isnan(output).any():
            raise RuntimeError(f"NaN detected in output of {module.__class__.__name__}")
        if torch.isinf(output).any():
            raise RuntimeError(f"Inf detected in output of {module.__class__.__name__}")
    elif isinstance(output, tuple):
        for i, o in enumerate(output):
            if isinstance(o, torch.Tensor) and torch.isnan(o).any():
                raise RuntimeError(
                    f"NaN in output[{i}] of {module.__class__.__name__}"
                )

for name, module in model.named_modules():
    module.register_forward_hook(nan_check_hook)
```

### Step 3: Common NaN Sources and Fixes

```
+---------------------------+----------------------------------+
| Source                    | Fix                              |
+---------------------------+----------------------------------+
| Softmax with large inputs | Pre-subtract max (standard)      |
|                           | Use scaled_dot_product_attention  |
+---------------------------+----------------------------------+
| Log of zero or negative   | Add epsilon: log(x + 1e-8)      |
|                           | Use log_softmax instead of       |
|                           | log(softmax(...))                |
+---------------------------+----------------------------------+
| Division by zero in       | Add epsilon to denominator       |
| LayerNorm                 | (most impls already do this)     |
+---------------------------+----------------------------------+
| FP16 overflow (>65504)    | Switch to BF16 or add loss       |
|                           | scaling                          |
+---------------------------+----------------------------------+
| Extreme embeddings        | Add embedding norm constraint or |
|                           | use post-embedding LayerNorm     |
+---------------------------+----------------------------------+
| Cross-entropy with bad    | Clip logits before softmax       |
| logit values              | Add label smoothing              |
+---------------------------+----------------------------------+
```

### The Nuclear Option: Skip Bad Batches

Sometimes a single corrupted data sample causes NaN. Rather
than crashing the entire run, skip it:

```python
def safe_training_step(model, batch, optimizer, max_loss=100.0):
    optimizer.zero_grad()
    outputs = model(batch['input_ids'], labels=batch['labels'])
    loss = outputs.loss

    if torch.isnan(loss) or torch.isinf(loss) or loss.item() > max_loss:
        print(f"Skipping batch: loss={loss.item()}")
        optimizer.zero_grad()
        return None

    loss.backward()

    grad_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    if torch.isnan(grad_norm) or torch.isinf(grad_norm):
        print(f"Skipping batch: grad_norm={grad_norm.item()}")
        optimizer.zero_grad()
        return None

    optimizer.step()
    return loss.item()
```

---

## Learning Rate Schedules at Scale

The learning rate is the single most important hyperparameter for
training stability. At scale, the relationship between batch size
and learning rate becomes critical.

### Linear Scaling Rule

```
Principle: When you scale batch size by k, scale learning rate by k.

  Base:   batch_size=256,  lr=1e-4
  Scaled: batch_size=2048, lr=8e-4  (8x batch, 8x lr)

  Why? Gradient noise decreases with larger batches (averaging
  more samples). Higher LR compensates for the reduced noise.

  BUT: This only works up to a point. Beyond some critical batch
  size, scaling LR further hurts convergence.

  Practical limit: sqrt scaling works better for very large batches.
  sqrt rule: scale lr by sqrt(k) instead of k.
```

### Warmup: Non-Negotiable at Scale

```
Without warmup:
  Step 0: lr=8e-4, random weights, gradients are noisy
  Result: Immediate divergence. Gradient norms are huge at init.

With warmup:
  Step 0-2000: lr linearly increases from 0 to 8e-4
  Step 2001+: lr follows cosine/linear decay

  The model "eases into" training. Early updates are small,
  letting the model find a reasonable region of parameter space
  before taking large steps.
```

```python
from torch.optim.lr_scheduler import LambdaLR
import math

def get_cosine_schedule_with_warmup(optimizer, warmup_steps, total_steps, min_lr_ratio=0.1):
    def lr_lambda(step):
        if step < warmup_steps:
            return step / warmup_steps
        progress = (step - warmup_steps) / (total_steps - warmup_steps)
        cosine_decay = 0.5 * (1 + math.cos(math.pi * progress))
        return min_lr_ratio + (1 - min_lr_ratio) * cosine_decay

    return LambdaLR(optimizer, lr_lambda)

scheduler = get_cosine_schedule_with_warmup(
    optimizer,
    warmup_steps=2000,
    total_steps=100000,
    min_lr_ratio=0.1,
)
```

### WSD (Warmup-Stable-Decay) Schedule

Increasingly popular for large model training:

```
         Warmup   Stable              Decay
  LR   /--------+------------------+--------\
  max  /         |                  |         \
      /          |                  |          \
     /           |  Constant LR    |           \
    /            |  (most of       |            \
   /             |   training)     |             \
  +------+-------+------------------+-------+-----> Steps
  0    2000    2000              90000    100000

  Advantages over pure cosine:
  - Easier to extend training (just extend the stable phase)
  - Can do LR rewarmup for continued pretraining
  - Multiple decay phases for different data mixtures
```

---

## Checkpoint Recovery

When training fails (and it will), you need to recover. The
quality of your checkpointing determines how much compute you lose.

### Checkpoint Strategy

```
Checkpoint frequency trade-offs:

  Too infrequent (every 10K steps):
    Failure at step 9999 -> lose 9999 steps of compute
    At $500/hr, 9999 steps could be 50+ hours = $25,000

  Too frequent (every 10 steps):
    Checkpoint save takes 5-30 minutes for large models
    If you checkpoint every 10 steps, you're saving more than training

  Sweet spot:
    Save every 500-2000 steps depending on model size
    Keep last 3-5 checkpoints (rotating)
    Keep milestone checkpoints permanently (every 10K steps)
```

```python
import os
import torch
import torch.distributed as dist

class CheckpointManager:
    def __init__(self, save_dir, keep_last=5, keep_milestones_every=10000):
        self.save_dir = save_dir
        self.keep_last = keep_last
        self.milestone_interval = keep_milestones_every
        self.recent_checkpoints = []

    def save(self, model, optimizer, scheduler, step, loss):
        if dist.get_rank() != 0:
            dist.barrier()
            return

        checkpoint = {
            'step': step,
            'model_state_dict': model.state_dict(),
            'optimizer_state_dict': optimizer.state_dict(),
            'scheduler_state_dict': scheduler.state_dict(),
            'loss': loss,
            'rng_state': torch.random.get_rng_state(),
            'cuda_rng_state': torch.cuda.get_rng_state_all(),
        }

        path = os.path.join(self.save_dir, f'checkpoint-{step}.pt')
        torch.save(checkpoint, path)

        is_milestone = (step % self.milestone_interval == 0)

        if not is_milestone:
            self.recent_checkpoints.append(path)
            while len(self.recent_checkpoints) > self.keep_last:
                old = self.recent_checkpoints.pop(0)
                if os.path.exists(old):
                    os.remove(old)

        dist.barrier()

    def load_latest(self):
        checkpoints = sorted(
            [f for f in os.listdir(self.save_dir) if f.startswith('checkpoint-')],
            key=lambda x: int(x.split('-')[1].split('.')[0])
        )
        if not checkpoints:
            return None
        path = os.path.join(self.save_dir, checkpoints[-1])
        return torch.load(path, map_location='cpu')
```

### Recovering RNG State

For reproducibility, you must save and restore the random state:

```python
def save_rng_states():
    return {
        'python': random.getstate(),
        'numpy': np.random.get_state(),
        'torch': torch.random.get_rng_state(),
        'cuda': torch.cuda.get_rng_state_all(),
    }

def restore_rng_states(states):
    random.setstate(states['python'])
    np.random.set_state(states['numpy'])
    torch.random.set_rng_state(states['torch'])
    torch.cuda.set_rng_state_all(states['cuda'])
```

---

## Training Run Monitoring

You can't fix what you can't see. Monitor everything.

### Essential Metrics

```
+----------------------------+------------------+------------------+
| Metric                     | Normal Range     | Alert If         |
+----------------------------+------------------+------------------+
| Training loss              | Decreasing       | Spike > 3x mean  |
| Gradient norm              | Stable, 0.1-10   | > 100 or = 0     |
| Learning rate              | Per schedule     | Unexpected change|
| GPU memory                 | Stable           | Within 5% of max |
| GPU utilization            | > 85%            | < 70%            |
| Tokens/sec (throughput)    | Stable           | Drop > 20%       |
| Loss per data source       | Decreasing       | One source stuck |
| Parameter norm             | Slowly growing   | Sudden change    |
| Activation magnitudes      | Stable           | Layer diverging  |
+----------------------------+------------------+------------------+
```

### Weights & Biases Integration

```python
import wandb
import torch.distributed as dist

def init_monitoring(config):
    if dist.get_rank() == 0:
        wandb.init(
            project="large-model-training",
            config=config,
            name=f"run-{config['model_size']}-{config['world_size']}gpu",
        )

def log_training_step(step, loss, grad_norm, lr, throughput, model):
    if dist.get_rank() != 0:
        return

    metrics = {
        "train/loss": loss,
        "train/grad_norm": grad_norm,
        "train/learning_rate": lr,
        "train/throughput_tokens_per_sec": throughput,
        "train/step": step,
    }

    if step % 100 == 0:
        for name, param in model.named_parameters():
            if 'weight' in name and param.requires_grad:
                metrics[f"params/{name}_norm"] = param.data.norm().item()
                if param.grad is not None:
                    metrics[f"grads/{name}_norm"] = param.grad.data.norm().item()

    wandb.log(metrics, step=step)
```

### Automated Alerting

```python
class TrainingMonitor:
    def __init__(self, window_size=100, spike_threshold=3.0):
        self.loss_history = []
        self.grad_norm_history = []
        self.window_size = window_size
        self.spike_threshold = spike_threshold

    def check(self, step, loss, grad_norm):
        self.loss_history.append(loss)
        self.grad_norm_history.append(grad_norm)

        if len(self.loss_history) < self.window_size:
            return

        recent_mean = sum(self.loss_history[-self.window_size:]) / self.window_size

        if loss > self.spike_threshold * recent_mean:
            self._alert(f"Loss spike at step {step}: {loss:.4f} vs mean {recent_mean:.4f}")

        if grad_norm > 100.0:
            self._alert(f"Gradient explosion at step {step}: norm={grad_norm:.4f}")

        if grad_norm == 0.0:
            self._alert(f"Zero gradient at step {step} -- possible dead model")

    def _alert(self, message):
        print(f"ALERT: {message}")
        try:
            import requests
            requests.post(
                "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
                json={"text": f":rotating_light: {message}"},
                timeout=5,
            )
        except Exception:
            pass
```

---

## Stability Techniques Checklist

```
Before training starts:
  [ ] BF16 mixed precision (not FP16 unless hardware requires it)
  [ ] Gradient clipping (max_norm=1.0 as starting point)
  [ ] Warmup schedule (2000+ steps for large models)
  [ ] Weight initialization (scaled according to depth)
  [ ] Pre-LayerNorm architecture (more stable than post-LayerNorm)

During training:
  [ ] Monitor gradient norms per layer
  [ ] Monitor loss with spike detection
  [ ] Save checkpoints every 500-2000 steps
  [ ] Log RNG states with checkpoints
  [ ] Test checkpoint recovery before long runs

If training destabilizes:
  [ ] Roll back to last good checkpoint
  [ ] Reduce learning rate by 2x
  [ ] Skip the problematic data range
  [ ] Check for data corruption in recent shards
  [ ] Enable gradient anomaly detection temporarily
```

---

## Exercises

1. **Spike diagnosis**: Given a training log where loss spikes at
   step 45,231, describe the debugging procedure. What metrics
   would you check first? How would you determine if it's a data
   issue vs a numerical issue?

2. **LR schedule design**: For a 13B model training on 64 GPUs
   with global batch size 2048, design a WSD schedule. Calculate
   the peak LR using linear scaling from a base of lr=1e-4 at
   batch_size=256.

3. **Monitoring implementation**: Set up a training monitor that
   tracks gradient norms per layer group (embeddings, attention,
   MLP, output) and sends a Slack alert if any group's norm
   deviates more than 5x from its running average.

4. **Checkpoint math**: For a 70B model with FP32 optimizer state,
   calculate the checkpoint size. If saving takes 3 minutes and
   you checkpoint every 1000 steps at 10 steps/minute, what
   fraction of training time is spent checkpointing?
