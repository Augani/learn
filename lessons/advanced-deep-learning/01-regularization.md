# Lesson 01: Regularization

> **Analogy**: Studying vs cramming. A student who studies a little
> every day generalizes to new exam questions. A student who memorizes
> the answer key aces practice tests but bombs the real thing.
> Regularization is the difference.

---

## What Is Regularization?

Your model is a student. The training data is a practice exam.
Regularization forces the model to **learn principles**, not
memorize answers.

```
Without regularization:        With regularization:

Training loss:  0.001          Training loss:  0.05
Val loss:       0.8            Val loss:       0.07
                ^                              ^
          Memorized!                    Actually learned!
```

---

## The Four Pillars

```
+----------------+------------------+--------------------+
| Technique      | What It Does     | Analogy            |
+----------------+------------------+--------------------+
| Dropout        | Randomly mutes   | Study without your |
|                | neurons          | notes sometimes    |
+----------------+------------------+--------------------+
| Batch Norm     | Normalizes layer | Keep your desk     |
|                | inputs           | organized           |
+----------------+------------------+--------------------+
| Weight Decay   | Penalizes large  | Travel light --    |
|                | weights          | no overpacking     |
+----------------+------------------+--------------------+
| Early Stopping | Stop before      | Leave the casino   |
|                | overfitting      | while you're ahead |
+----------------+------------------+--------------------+
```

---

## 1. Dropout

Randomly zero out neurons during training. Each forward pass
uses a different subset of the network.

```
Training (dropout=0.3):

  [x] [o] [x] [x] [o]     x = active, o = dropped
   |       |   |
   v       v   v
  [x] [x] [o] [x] [x]
   |   |       |   |
   v   v       v   v
       OUTPUT

At test time: ALL neurons active, weights scaled down.
```

Think of it this way: if you can pass the exam even when 30%
of your notes are randomly hidden, you truly understand the
material.

```python
import torch
import torch.nn as nn

class RobustClassifier(nn.Module):
    def __init__(self, input_dim, hidden_dim, num_classes):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, num_classes),
        )

    def forward(self, x):
        return self.net(x)
```

### Dropout Rules of Thumb

```
+----------------------------+------------------+
| Scenario                   | Dropout Rate     |
+----------------------------+------------------+
| Small dataset              | 0.4 - 0.5       |
| Large dataset              | 0.1 - 0.2       |
| After conv layers          | 0.1 - 0.25      |
| After dense layers         | 0.3 - 0.5       |
| Transformers (attention)   | 0.1              |
+----------------------------+------------------+
```

---

## 2. Batch Normalization

Normalize each layer's inputs to have mean=0 and std=1 within
each mini-batch. Then learn a shift and scale.

```
Before BatchNorm:           After BatchNorm:

Layer inputs:               Layer inputs:
  [-12, 0.5, 88, -3]         [-0.8, 0.1, 1.5, -0.3]
       ^                           ^
  Wildly different              Controlled range
  scales across                 = stable training
  training steps
```

Like keeping your desk organized between study sessions --
you don't waste time finding your notes.

```python
class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(),
        )

    def forward(self, x):
        return self.block(x)
```

### BatchNorm vs LayerNorm

```
BatchNorm:  normalize across the BATCH dimension
            (good for CNNs)

LayerNorm:  normalize across the FEATURE dimension
            (good for transformers, RNNs)

  Batch dimension
  |
  v
  +---------+---------+---------+
  | sample1 | sample2 | sample3 |  <-- BatchNorm: across this row
  +---------+---------+---------+
  | feat1   | feat1   | feat1   |
  | feat2   | feat2   | feat2   |
  | feat3   | feat3   | feat3   |
  +---------+---------+---------+
       ^
       |
    LayerNorm: down this column
```

---

## 3. Weight Decay (L2 Regularization)

Add a penalty for large weights to the loss function.

```
Original loss:   L = CrossEntropy(y_pred, y_true)

With weight decay: L = CrossEntropy(y_pred, y_true) + lambda * sum(w^2)
                                                       ^^^^^
                                              Penalizes big weights
```

Like packing for a hike: if everything you carry has a cost,
you only bring what you truly need.

```python
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=1e-3,
    weight_decay=0.01,
)
```

> **Key insight**: AdamW decouples weight decay from the gradient
> update. Use AdamW, not Adam + L2. We cover this in Lesson 02.

### How Much Weight Decay?

```
+-------------------+------------------+
| Model Size        | Weight Decay     |
+-------------------+------------------+
| Small (< 1M)     | 1e-4 to 1e-3    |
| Medium (1-100M)   | 1e-3 to 1e-2    |
| Large (100M+)     | 1e-2 to 1e-1    |
+-------------------+------------------+
```

---

## 4. Early Stopping

Monitor validation loss. When it stops improving for N epochs,
stop training.

```
Loss
 ^
 |  \
 |   \  training loss keeps going down
 |    \______________________________
 |
 |   \
 |    \   val loss
 |     \___/````\___
 |                  \______  <-- stop here!
 |                         \___  (overfitting starts)
 +-------------------------------------> Epochs
         ^
         |
    "patience" = how many epochs
    to wait after best val loss
```

```python
class EarlyStopping:
    def __init__(self, patience=5, min_delta=1e-4):
        self.patience = patience
        self.min_delta = min_delta
        self.best_loss = float("inf")
        self.counter = 0
        self.should_stop = False

    def step(self, val_loss):
        if val_loss < self.best_loss - self.min_delta:
            self.best_loss = val_loss
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.should_stop = True


stopper = EarlyStopping(patience=5)

for epoch in range(100):
    train_loss = train_one_epoch(model, train_loader, optimizer)
    val_loss = validate(model, val_loader)

    stopper.step(val_loss)
    if stopper.should_stop:
        print(f"Early stop at epoch {epoch}")
        break
```

---

## Combining Them All

In practice you use multiple techniques together:

```python
class WellRegularizedModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.Dropout2d(0.1),
            nn.Conv2d(64, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 10),
        )

    def forward(self, x):
        return self.classifier(self.features(x))


model = WellRegularizedModel()

optimizer = torch.optim.AdamW(
    model.parameters(), lr=1e-3, weight_decay=0.01
)

stopper = EarlyStopping(patience=7)
```

---

## When Regularization Hurts

```
+----------------------------+--------------------------------+
| Situation                  | Problem                        |
+----------------------------+--------------------------------+
| Very large dataset         | May not need much -- you have  |
|                            | enough data to generalize      |
+----------------------------+--------------------------------+
| Too much dropout           | Underfitting -- model can't    |
|                            | learn anything useful          |
+----------------------------+--------------------------------+
| BatchNorm + tiny batch     | Statistics are noisy, training |
|                            | becomes unstable               |
+----------------------------+--------------------------------+
| Early stopping too eager   | Stops before model converges   |
+----------------------------+--------------------------------+
```

---

## Quick Reference

```
REGULARIZATION DECISION TREE:

Is the model overfitting?
|
+-- No  --> You're fine. Maybe add light weight decay.
|
+-- Yes --> How bad?
            |
            +-- Mild gap --> Add Dropout(0.2) + weight_decay=1e-3
            |
            +-- Large gap --> Dropout(0.4) + weight_decay=1e-2
            |                 + data augmentation (Lesson 04)
            |
            +-- Still bad --> Early stopping + reduce model size
```

---

## Exercises

1. **Dropout experiment**: Train a 3-layer MLP on MNIST with
   dropout rates of 0.0, 0.3, 0.5, and 0.8. Plot training vs
   validation accuracy for each. At what rate does underfitting
   start?

2. **BatchNorm placement**: Try placing BatchNorm before ReLU
   and after ReLU. Which gives better accuracy on CIFAR-10?
   Why do you think so?

3. **Weight decay sweep**: Using AdamW on a small CNN, try
   weight_decay values of 0, 1e-4, 1e-2, and 0.1. Plot the
   validation loss curves. Find the sweet spot.

4. **Early stopping implementation**: Extend the EarlyStopping
   class to also save and restore the best model weights.

5. **Combination challenge**: Start with a model that overfits
   CIFAR-10. Apply regularization techniques one at a time and
   record the effect of each. Which single technique helped most?

---

**Next**: [Lesson 02 - Advanced Optimizers](./02-advanced-optimizers.md)
