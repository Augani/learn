# Lesson 02: Advanced Optimizers

> **Analogy**: Adjusting your stride while hiking. On flat ground
> you take big steps. Going uphill you shorten your stride. Near
> the summit you slow down so you don't overshoot. That's what
> learning rate schedules do for your optimizer.

---

## Why SGD Isn't Enough

Plain SGD takes the same-sized step in every direction, every time.

```
SGD on a narrow valley:

     \       /
      \     /
       \   /     <-- SGD bounces side to side
        \ /          instead of rolling down
         v

Adam on the same valley:

     \       /
      \    /
       \  /      <-- Adam adapts per-parameter
        \/           and rolls smoothly to minimum
```

---

## The Optimizer Family Tree

```
SGD
 |
 +-- SGD + Momentum
      |
      +-- RMSProp (adaptive learning rates)
      |    |
      |    +-- Adam (momentum + adaptive rates)
      |         |
      |         +-- AdamW (decoupled weight decay)
      |         |
      |         +-- AdaFactor (memory efficient)
      |
      +-- LARS / LAMB (for large batch training)
```

---

## Adam: The Workhorse

Adam keeps two running averages per parameter:

```
m = momentum      (which direction to go)
v = velocity      (how bumpy the terrain is)

For each parameter w:

  m = beta1 * m + (1 - beta1) * gradient
  v = beta2 * v + (1 - beta2) * gradient^2

  w = w - lr * m / (sqrt(v) + epsilon)
                     ^^^^^^^^
              Adapts step size per parameter:
              - bumpy terrain  -> small steps
              - smooth terrain -> big steps
```

```python
import torch
import torch.nn as nn

model = nn.Linear(784, 10)

optimizer = torch.optim.Adam(
    model.parameters(),
    lr=1e-3,
    betas=(0.9, 0.999),
    eps=1e-8,
)
```

### Adam's Defaults Explained

```
+----------+-------+----------------------------------------+
| Param    | Value | Meaning                                |
+----------+-------+----------------------------------------+
| lr       | 1e-3  | Base step size                         |
| beta1    | 0.9   | Momentum decay (90% old + 10% new)     |
| beta2    | 0.999 | Variance decay (99.9% old + 0.1% new)  |
| eps      | 1e-8  | Prevents division by zero              |
+----------+-------+----------------------------------------+
```

---

## AdamW: Adam Done Right

Original Adam applied weight decay inside the gradient update.
This couples it with the adaptive learning rate, making the
actual decay strength vary per parameter.

AdamW fixes this by applying weight decay **separately**.

```
Adam (L2 regularization baked in):
  gradient += weight_decay * w       <-- mixed in
  w = w - lr * adam_step(gradient)

AdamW (decoupled weight decay):
  w = w - lr * adam_step(gradient)
  w = w - lr * weight_decay * w      <-- separate step
              ^^^^^^^^^^^^^^^^^^
              Same decay for all parameters
              regardless of gradient history
```

```python
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=1e-3,
    weight_decay=0.01,
)
```

> **Rule**: Always use AdamW over Adam when using weight decay.
> There is almost no reason to use Adam + L2 anymore.

---

## Learning Rate Schedules

The learning rate shouldn't be constant. Think of the hike:

```
Start of training:        Middle:              End:
Big steps to cover        Moderate steps       Tiny steps to
ground quickly            to navigate          settle into the
                          the terrain          best spot

  lr                       lr                   lr
  ^                        ^                    ^
  |****                    |  ****              |        ****
  |    ***                 |      ***           |            *
  |       **               |         **         |
  +---------> epoch        +---------> epoch    +---------> epoch

  Constant (bad)           Step decay           Cosine annealing
```

### Cosine Annealing (Most Popular)

```
lr
 ^
 |*
 | *
 |  **
 |    ***
 |       *****
 |            ********
 |                    **********
 +-----------------------------------> step
 0                              T_max

Smoothly decays from max_lr to min_lr
following a half-cosine curve.
```

```python
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)

scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
    optimizer,
    T_max=100,
    eta_min=1e-6,
)

for epoch in range(100):
    train_one_epoch(model, train_loader, optimizer)
    scheduler.step()
```

### OneCycleLR (Fast Convergence)

```
lr
 ^
 |        ***
 |      **   **
 |    **       **
 |  **           ****
 |**                 ********
 +-----------------------------------> step
 0     warmup    decay

Ramps UP then smoothly back DOWN.
Often trains faster than cosine alone.
```

```python
scheduler = torch.optim.lr_scheduler.OneCycleLR(
    optimizer,
    max_lr=1e-3,
    total_steps=len(train_loader) * num_epochs,
    pct_start=0.3,
)

for epoch in range(num_epochs):
    for batch in train_loader:
        loss = train_step(model, batch, optimizer)
        scheduler.step()
```

---

## Warmup: Don't Sprint from Cold

At the start of training, the model weights are random.
Taking huge gradient steps on random weights is chaotic.

Warmup = start with a tiny lr and ramp up gradually.

```
Without warmup:              With warmup:

lr                           lr
 ^                            ^
 |****                        |    ****
 |    ****                    |   *    ****
 |        ****                |  *         ****
 |            ****            | *              ****
 +-------------> step         +-------------------> step

 Large initial steps          Small initial steps
 = unstable gradients         = stable start
```

```python
import torch
from torch.optim.lr_scheduler import LambdaLR


def get_warmup_cosine_scheduler(optimizer, warmup_steps, total_steps):
    def lr_lambda(current_step):
        if current_step < warmup_steps:
            return current_step / warmup_steps
        progress = (current_step - warmup_steps) / (total_steps - warmup_steps)
        return 0.5 * (1.0 + torch.cos(torch.tensor(progress * 3.14159)).item())

    return LambdaLR(optimizer, lr_lambda)


optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
total_steps = len(train_loader) * num_epochs
warmup_steps = int(0.1 * total_steps)

scheduler = get_warmup_cosine_scheduler(optimizer, warmup_steps, total_steps)
```

---

## Putting It Together: A Real Training Loop

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms


transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,)),
])

train_ds = datasets.MNIST("./data", train=True, download=True, transform=transform)
val_ds = datasets.MNIST("./data", train=False, transform=transform)

train_loader = DataLoader(train_ds, batch_size=256, shuffle=True)
val_loader = DataLoader(val_ds, batch_size=256)

model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(784, 256),
    nn.ReLU(),
    nn.Dropout(0.2),
    nn.Linear(256, 10),
)

num_epochs = 20
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.01)
scheduler = torch.optim.lr_scheduler.OneCycleLR(
    optimizer,
    max_lr=3e-4,
    total_steps=len(train_loader) * num_epochs,
)
criterion = nn.CrossEntropyLoss()

for epoch in range(num_epochs):
    model.train()
    for images, labels in train_loader:
        optimizer.zero_grad()
        loss = criterion(model(images), labels)
        loss.backward()
        optimizer.step()
        scheduler.step()

    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for images, labels in val_loader:
            preds = model(images).argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

    print(f"Epoch {epoch+1}: val_acc = {correct/total:.4f}, lr = {scheduler.get_last_lr()[0]:.6f}")
```

---

## Optimizer Selection Guide

```
WHICH OPTIMIZER SHOULD I USE?

Start here
 |
 +-- Fine-tuning a pretrained model?
 |   |
 |   +-- Yes --> AdamW, lr=1e-5 to 5e-5
 |   |
 |   +-- No --> Training from scratch?
 |              |
 |              +-- Small model --> AdamW, lr=1e-3
 |              |
 |              +-- Large model --> AdamW, lr=1e-4 + warmup
 |              |
 |              +-- Very large batch --> LAMB/LARS
 |
 +-- Computer vision from scratch?
     |
     +-- SGD + momentum + cosine LR
         (sometimes still beats Adam for CNNs)
```

---

## Common Mistakes

```
+----------------------------+-----------------------------------+
| Mistake                    | Fix                               |
+----------------------------+-----------------------------------+
| Using Adam with L2 decay   | Switch to AdamW                  |
+----------------------------+-----------------------------------+
| No warmup on transformers  | Add 5-10% warmup steps           |
+----------------------------+-----------------------------------+
| Constant learning rate     | Use cosine or OneCycleLR          |
+----------------------------+-----------------------------------+
| LR too high                | If loss spikes or NaN, reduce LR  |
+----------------------------+-----------------------------------+
| Scheduling per epoch       | OneCycleLR schedules per STEP,    |
| when it should be per step | not per epoch                     |
+----------------------------+-----------------------------------+
```

---

## Exercises

1. **Adam vs SGD**: Train a CNN on CIFAR-10 with Adam(lr=1e-3)
   and SGD(lr=0.1, momentum=0.9). Compare convergence speed
   and final accuracy.

2. **Schedule comparison**: Implement cosine annealing, step
   decay, and OneCycleLR. Plot the learning rate curves for
   100 epochs. Train with each and compare results.

3. **Warmup experiment**: Train a transformer on a text task
   with and without warmup. Compare the training loss curves
   for the first 1000 steps.

4. **Weight decay sweep**: Using AdamW on CIFAR-10, try
   weight_decay values of [0, 1e-4, 1e-2, 0.1, 1.0].
   Which gives the best val accuracy?

5. **Build your own scheduler**: Write a warmup + cosine decay
   scheduler from scratch (no `LambdaLR`). Verify it matches
   the lr curve of `OneCycleLR` with `pct_start=0.1`.

---

**Next**: [Lesson 03 - Transfer Learning](./03-transfer-learning.md)
