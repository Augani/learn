# Lesson 06: Custom Training Loops

> **Analogy**: Using `model.fit()` is like using cruise control on
> a highway. It's great for straightforward drives. But when the
> road has hairpin turns, construction zones, and one lane that
> goes through a car wash, you need your hands on the wheel. Custom
> training loops give you the steering wheel back.

---

## Why Custom Loops?

Standard training loops (`model.fit()` in Keras, `Trainer` in
HuggingFace) handle 80% of cases. The other 20% includes:

- Gradient manipulation (clipping, accumulation, surgery)
- Multi-task learning with different loss weights
- Curriculum learning (changing data difficulty over time)
- Adversarial training (GAN-style)
- Custom learning rate schedules
- Mixed-objective training
- Meta-learning inner loops
- Reinforcement learning from human feedback (RLHF)

If you're implementing a paper, you'll almost certainly need a
custom loop. Papers rarely fit neatly into `model.fit()`.

```
Complexity vs Control:

  model.fit()          Simple, limited
       |
  Trainer + callbacks  More control, still constrained
       |
  Custom loop          Full control, full responsibility
       |
  Custom autograd      You probably don't need this
```

---

## The Minimal Custom Loop

Start here. This is the skeleton every custom loop builds on.

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

def train(model, train_loader, val_loader, config):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=config.learning_rate,
        weight_decay=config.weight_decay,
    )
    loss_fn = nn.CrossEntropyLoss()

    for epoch in range(config.num_epochs):
        model.train()
        total_loss = 0.0
        num_batches = 0

        for batch in train_loader:
            inputs = batch["input"].to(device)
            targets = batch["target"].to(device)

            optimizer.zero_grad()
            outputs = model(inputs)
            loss = loss_fn(outputs, targets)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), config.grad_clip)
            optimizer.step()

            total_loss += loss.item()
            num_batches += 1

        avg_loss = total_loss / num_batches

        val_metrics = evaluate(model, val_loader, device)
        print(f"Epoch {epoch}: train_loss={avg_loss:.4f}, "
              f"val_acc={val_metrics['accuracy']:.4f}")
```

Every custom loop is a variation of this pattern:
**zero_grad → forward → loss → backward → clip → step**.

---

## Gradient Manipulation

### Gradient Accumulation

When your batch doesn't fit in GPU memory, accumulate gradients
over multiple mini-batches.

```python
def train_with_accumulation(model, loader, optimizer, loss_fn,
                            accumulation_steps=4, device="cuda"):
    model.train()
    optimizer.zero_grad()

    for step, batch in enumerate(loader):
        inputs = batch["input"].to(device)
        targets = batch["target"].to(device)

        outputs = model(inputs)
        loss = loss_fn(outputs, targets)
        loss = loss / accumulation_steps
        loss.backward()

        if (step + 1) % accumulation_steps == 0:
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            optimizer.zero_grad()
```

```
Without accumulation (batch=256, 1 GPU with 16GB):
  Can't fit 256 samples --> OOM error

With accumulation (micro_batch=64, accumulate=4):
  Step 1: Forward 64 samples, backward, accumulate grads
  Step 2: Forward 64 samples, backward, accumulate grads
  Step 3: Forward 64 samples, backward, accumulate grads
  Step 4: Forward 64 samples, backward, accumulate grads, STEP
  --> Effective batch size = 64 * 4 = 256
  --> Fits in 16GB
```

**Key detail**: divide the loss by `accumulation_steps` before
backward. Otherwise your effective learning rate is multiplied by
the accumulation factor.

### Gradient Clipping

Prevent exploding gradients. Two flavors:

```python
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

torch.nn.utils.clip_grad_value_(model.parameters(), clip_value=0.5)
```

```
clip_grad_norm_ (by total norm):
  If ||grad||_2 > max_norm:
    grad = grad * (max_norm / ||grad||_2)
  Scales all gradients proportionally.
  Most common. Use this by default.

clip_grad_value_ (by element):
  Clamp each gradient element to [-clip_value, clip_value].
  More aggressive. Destroys gradient direction.
  Use only if norm clipping isn't enough.
```

### Gradient Surgery

Sometimes you need to modify gradients directly. This is common in
multi-task learning where task gradients conflict.

```python
def project_conflicting_gradients(grad_task_a, grad_task_b):
    """
    If gradients conflict (negative cosine similarity),
    project task_b's gradient onto the normal plane of task_a.
    From "Gradient Surgery for Multi-Task Learning" (Yu et al., 2020)
    """
    dot = torch.sum(grad_task_a * grad_task_b)

    if dot < 0:
        proj = dot / (torch.sum(grad_task_a * grad_task_a) + 1e-8)
        grad_task_b = grad_task_b - proj * grad_task_a

    return grad_task_b


def multi_task_backward(model, loss_a, loss_b):
    model.zero_grad()
    loss_a.backward(retain_graph=True)
    grads_a = [p.grad.clone() for p in model.parameters() if p.grad is not None]

    model.zero_grad()
    loss_b.backward()
    grads_b = [p.grad.clone() for p in model.parameters() if p.grad is not None]

    for param, ga, gb in zip(
        (p for p in model.parameters() if p.requires_grad), grads_a, grads_b
    ):
        gb_projected = project_conflicting_gradients(ga, gb)
        param.grad = ga + gb_projected
```

---

## Custom Learning Rate Schedules

### Warmup + Cosine Decay

The most common schedule in modern ML. Linear warmup prevents
early instability; cosine decay provides smooth convergence.

```python
import math

class WarmupCosineScheduler:
    def __init__(self, optimizer, warmup_steps, total_steps, min_lr=0.0):
        self.optimizer = optimizer
        self.warmup_steps = warmup_steps
        self.total_steps = total_steps
        self.base_lrs = [group["lr"] for group in optimizer.param_groups]
        self.min_lr = min_lr
        self.current_step = 0

    def step(self):
        self.current_step += 1

        if self.current_step <= self.warmup_steps:
            scale = self.current_step / self.warmup_steps
        else:
            progress = (self.current_step - self.warmup_steps) / (
                self.total_steps - self.warmup_steps
            )
            scale = 0.5 * (1 + math.cos(math.pi * progress))

        for param_group, base_lr in zip(self.optimizer.param_groups, self.base_lrs):
            param_group["lr"] = self.min_lr + (base_lr - self.min_lr) * scale

    def get_lr(self):
        return [group["lr"] for group in self.optimizer.param_groups]
```

```
Learning Rate Over Time:

  LR
  ^
  |     /\
  |    /  \
  |   /    \           <- cosine decay
  |  /      \
  | /        \___
  |/             \___
  +--+---+---+---+---> steps
    ^               ^
  warmup          total
```

### Per-Parameter Learning Rates

Different parts of the model may need different learning rates.
Common when fine-tuning: small LR for pretrained backbone, large
LR for new head.

```python
def get_parameter_groups(model, base_lr, backbone_lr_scale=0.1):
    backbone_params = []
    head_params = []

    for name, param in model.named_parameters():
        if not param.requires_grad:
            continue
        if "backbone" in name or "encoder" in name:
            backbone_params.append(param)
        else:
            head_params.append(param)

    return [
        {"params": backbone_params, "lr": base_lr * backbone_lr_scale},
        {"params": head_params, "lr": base_lr},
    ]

optimizer = torch.optim.AdamW(
    get_parameter_groups(model, base_lr=1e-3, backbone_lr_scale=0.1)
)
```

---

## Multi-Task Training

Train one model on multiple tasks simultaneously. The challenge:
balancing the losses so one task doesn't dominate.

### Fixed Weights

The simplest approach. Usually good enough to start.

```python
def multi_task_loss(outputs, targets, weights=None):
    if weights is None:
        weights = {"classification": 1.0, "regression": 1.0, "detection": 1.0}

    loss_cls = F.cross_entropy(outputs["classification"], targets["labels"])
    loss_reg = F.mse_loss(outputs["regression"], targets["values"])
    loss_det = detection_loss(outputs["detection"], targets["boxes"])

    total = (
        weights["classification"] * loss_cls
        + weights["regression"] * loss_reg
        + weights["detection"] * loss_det
    )

    return total, {
        "classification": loss_cls.item(),
        "regression": loss_reg.item(),
        "detection": loss_det.item(),
    }
```

### Uncertainty Weighting

Learn the weights automatically using task uncertainty. From
Kendall et al., "Multi-Task Learning Using Uncertainty to Weigh
Losses for Scene Geometry and Semantics."

```python
class UncertaintyWeightedLoss(nn.Module):
    def __init__(self, num_tasks):
        super().__init__()
        self.log_sigma_sq = nn.Parameter(torch.zeros(num_tasks))

    def forward(self, losses):
        total = 0.0
        weighted = {}
        for i, (name, loss) in enumerate(losses.items()):
            precision = torch.exp(-self.log_sigma_sq[i])
            total += precision * loss + self.log_sigma_sq[i]
            weighted[name] = (precision * loss).item()
        return total, weighted
```

```
How uncertainty weighting works:

  Task A (easy, low loss):
    sigma_A is small --> precision is high --> less weight
    (Already doing well, don't over-optimize)

  Task B (hard, high loss):
    sigma_B is large --> precision is low --> less weight
    (Too hard right now, don't let it dominate)

  The log_sigma parameters are learned alongside model weights.
```

---

## Curriculum Learning

Present training data in a meaningful order, typically easy to hard.

```python
class CurriculumDataLoader:
    def __init__(self, dataset, difficulty_fn, num_epochs):
        self.dataset = dataset
        self.difficulties = [difficulty_fn(sample) for sample in dataset]
        self.num_epochs = num_epochs

    def get_loader(self, epoch, batch_size):
        fraction = min(1.0, 0.3 + 0.7 * (epoch / self.num_epochs))

        sorted_indices = sorted(
            range(len(self.dataset)),
            key=lambda i: self.difficulties[i]
        )
        num_samples = int(len(sorted_indices) * fraction)
        selected_indices = sorted_indices[:num_samples]

        subset = torch.utils.data.Subset(self.dataset, selected_indices)
        return DataLoader(subset, batch_size=batch_size, shuffle=True)
```

```
Curriculum schedule:

  Epoch 1:   [easy easy easy ............]  30% of data
  Epoch 5:   [easy easy easy medium ......]  50% of data
  Epoch 10:  [easy medium hard ...........]  75% of data
  Epoch 20:  [easy medium hard very_hard .] 100% of data
```

---

## Mixed-Objective Training

Some training procedures alternate between different objectives.
GANs are the classic example, but this pattern appears in many
recent methods.

```python
def train_alternating(generator, discriminator, dataloader,
                      opt_g, opt_d, device, steps_d=5):
    for real_batch in dataloader:
        real = real_batch.to(device)
        batch_size = real.size(0)

        for _ in range(steps_d):
            noise = torch.randn(batch_size, 128, device=device)
            fake = generator(noise).detach()

            d_real = discriminator(real)
            d_fake = discriminator(fake)
            loss_d = -torch.mean(d_real) + torch.mean(d_fake)

            opt_d.zero_grad()
            loss_d.backward()
            opt_d.step()

        noise = torch.randn(batch_size, 128, device=device)
        fake = generator(noise)
        loss_g = -torch.mean(discriminator(fake))

        opt_g.zero_grad()
        loss_g.backward()
        opt_g.step()
```

```
Alternating training timeline:

  Step 1: [D] [D] [D] [D] [D] [G]    (train D 5 times, G once)
  Step 2: [D] [D] [D] [D] [D] [G]
  Step 3: [D] [D] [D] [D] [D] [G]

  Why 5:1 ratio?
  D needs to be good enough for G to learn from.
  If D is too weak, G gets no useful gradient signal.
  If D is too strong, G gets overwhelmed.
```

---

## Mixed Precision Training

Use FP16 or BF16 for speed and memory savings. The training loop
needs gradient scaling to prevent underflow.

```python
from torch.amp import GradScaler, autocast

def train_mixed_precision(model, loader, optimizer, loss_fn, device):
    scaler = GradScaler()

    for batch in loader:
        inputs = batch["input"].to(device)
        targets = batch["target"].to(device)

        optimizer.zero_grad()

        with autocast(device_type="cuda", dtype=torch.float16):
            outputs = model(inputs)
            loss = loss_fn(outputs, targets)

        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(optimizer)
        scaler.update()
```

```
Why gradient scaling?

  FP16 range:   ±65504 (with subnormals down to ~6e-8)
  FP32 range:   ±3.4e38

  Small gradients in FP16 can underflow to 0.
  GradScaler multiplies loss by a large factor before backward,
  then divides gradients by the same factor before step.

  Loss * 1024 --> backward --> grad / 1024 --> step
  ^                                ^
  Prevents underflow               Restores correct magnitude
```

**BF16 alternative**: If your GPU supports BF16 (A100, H100),
use it instead. BF16 has the same exponent range as FP32, so you
don't need gradient scaling at all.

```python
with autocast(device_type="cuda", dtype=torch.bfloat16):
    outputs = model(inputs)
    loss = loss_fn(outputs, targets)
loss.backward()
optimizer.step()
```

---

## Putting It All Together

A production-grade custom loop combining multiple techniques:

```python
def train_full(model, train_loader, val_loader, config, device):
    optimizer = torch.optim.AdamW(
        get_parameter_groups(model, config.lr, config.backbone_lr_scale),
        weight_decay=config.weight_decay,
    )
    scheduler = WarmupCosineScheduler(
        optimizer, config.warmup_steps, config.total_steps
    )
    scaler = GradScaler() if config.use_fp16 else None
    best_metric = 0.0
    global_step = 0

    for epoch in range(config.num_epochs):
        model.train()

        for batch_idx, batch in enumerate(train_loader):
            inputs = batch["input"].to(device)
            targets = batch["target"].to(device)

            if config.use_fp16:
                with autocast(device_type="cuda", dtype=torch.float16):
                    outputs = model(inputs)
                    loss = compute_loss(outputs, targets) / config.accumulation_steps
                scaler.scale(loss).backward()
            else:
                outputs = model(inputs)
                loss = compute_loss(outputs, targets) / config.accumulation_steps
                loss.backward()

            if (batch_idx + 1) % config.accumulation_steps == 0:
                if config.use_fp16:
                    scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), config.grad_clip)
                if config.use_fp16:
                    scaler.step(optimizer)
                    scaler.update()
                else:
                    optimizer.step()
                optimizer.zero_grad()
                scheduler.step()
                global_step += 1

        val_metrics = evaluate(model, val_loader, device)

        if val_metrics["accuracy"] > best_metric:
            best_metric = val_metrics["accuracy"]
            torch.save(model.state_dict(), config.checkpoint_path)

    return best_metric
```

---

## Practical Exercise

Write a custom training loop that:

1. Uses gradient accumulation (effective batch size 512 from
   micro-batches of 64)
2. Applies warmup + cosine LR schedule
3. Trains a simple model on CIFAR-10
4. Logs loss and accuracy every 100 steps
5. Saves the best checkpoint based on validation accuracy

Then modify it to add:
6. Mixed precision training
7. Different LR for feature extractor vs classifier head

---

## Key Takeaways

- Custom loops are necessary when your training procedure doesn't
  fit the standard pattern
- Start with the minimal loop and add complexity incrementally
- Gradient accumulation simulates large batches on small GPUs
- Multi-task loss balancing is an active research area -- start
  with fixed weights, try uncertainty weighting next
- Mixed precision gives 2x speedup for free on modern GPUs
- Always include gradient clipping -- it costs nothing and prevents
  catastrophic failures

Next lesson: when the architecture you need doesn't exist in any
library, you build it yourself.
