# Lesson 04: The Training Loop

You have a tokenizer and a model. Now you need to teach the model to
predict the next token. This lesson implements the complete training
pipeline: data loading, batching, loss computation, optimization, and
learning rate scheduling. Every piece from scratch.

For the theory behind backpropagation and gradient descent, see
[Track 7 Lessons 07-08](../ml-fundamentals/07-backpropagation.md).
This lesson is the hands-on implementation.

---

## The Core Idea

Training a language model is like flashcards — but with millions of
cards and a very fast student.

```
Training Loop — The Big Picture:

  ┌─────────────────────────────────────────────┐
  │  For each batch of token sequences:          │
  │                                              │
  │  1. Feed tokens into model                   │
  │     Input:  [def, ·, fib, (, n, )]          │
  │     Target: [·, fib, (, n, ), :]            │
  │                                              │
  │  2. Model predicts next token at each pos    │
  │     Prediction: probability over vocab       │
  │                                              │
  │  3. Compare prediction to actual next token  │
  │     Loss = cross-entropy(prediction, target) │
  │                                              │
  │  4. Compute gradients (backpropagation)      │
  │                                              │
  │  5. Update weights (optimizer step)          │
  │                                              │
  │  Repeat 50,000 times.                        │
  └─────────────────────────────────────────────┘
```

---

## Step 1: Dataset and Data Loading

The dataset reads tokenized text and creates input/target pairs. For
language modeling, the target is simply the input shifted by one
position.

```python
# training/dataset.py

import torch
from torch.utils.data import Dataset, DataLoader


class TextDataset(Dataset):
    """Dataset for language model training.

    Takes tokenized text and creates fixed-length sequences.
    Target is the input shifted right by one position.
    """

    def __init__(self, token_ids: list[int], seq_len: int):
        self.token_ids = torch.tensor(token_ids, dtype=torch.long)
        self.seq_len = seq_len

    def __len__(self):
        # Number of complete sequences we can extract
        return (len(self.token_ids) - 1) // self.seq_len

    def __getitem__(self, idx):
        start = idx * self.seq_len
        end = start + self.seq_len

        # Input: tokens[start:end]
        # Target: tokens[start+1:end+1] (shifted by 1)
        x = self.token_ids[start:end]
        y = self.token_ids[start + 1:end + 1]

        return x, y


def create_dataloaders(train_tokens, val_tokens, config):
    """Create training and validation data loaders."""
    train_dataset = TextDataset(train_tokens, config.max_seq_len)
    val_dataset = TextDataset(val_tokens, config.max_seq_len)

    train_loader = DataLoader(
        train_dataset,
        batch_size=config.batch_size,
        shuffle=True,
        num_workers=2,
        pin_memory=True,
        drop_last=True,  # Drop incomplete last batch
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=config.batch_size,
        shuffle=False,
        num_workers=2,
        pin_memory=True,
        drop_last=True,
    )

    print(f"Train: {len(train_dataset):,} sequences, {len(train_loader):,} batches")
    print(f"Val:   {len(val_dataset):,} sequences, {len(val_loader):,} batches")

    return train_loader, val_loader
```

```
Data Loading — How Input/Target Pairs Work:

  Tokenized text: [42, 107, 256, 89, 33, 512, 78, 201, ...]

  Sequence length = 4:

  Batch item 0:
    Input:  [42, 107, 256,  89]
    Target: [107, 256,  89,  33]
              ↑    ↑    ↑    ↑
              Each target is the next token

  Batch item 1:
    Input:  [33, 512,  78, 201]
    Target: [512,  78, 201, ...]

  The model learns: given these tokens, predict the next one.
```

---

## Step 2: Learning Rate Scheduling

We use warmup + cosine decay. The learning rate starts at zero, ramps
up linearly during warmup, then decays following a cosine curve.

```python
# training/scheduler.py

import math


class CosineWarmupScheduler:
    """Learning rate scheduler with linear warmup and cosine decay."""

    def __init__(self, optimizer, warmup_steps: int, max_steps: int,
                 max_lr: float, min_lr: float = 1e-6):
        self.optimizer = optimizer
        self.warmup_steps = warmup_steps
        self.max_steps = max_steps
        self.max_lr = max_lr
        self.min_lr = min_lr
        self.current_step = 0

    def get_lr(self) -> float:
        """Calculate learning rate for current step."""
        if self.current_step < self.warmup_steps:
            # Linear warmup: 0 → max_lr
            return self.max_lr * self.current_step / self.warmup_steps
        elif self.current_step >= self.max_steps:
            return self.min_lr
        else:
            # Cosine decay: max_lr → min_lr
            progress = (self.current_step - self.warmup_steps) / \
                       (self.max_steps - self.warmup_steps)
            return self.min_lr + 0.5 * (self.max_lr - self.min_lr) * \
                   (1 + math.cos(math.pi * progress))

    def step(self):
        """Update learning rate."""
        lr = self.get_lr()
        for param_group in self.optimizer.param_groups:
            param_group["lr"] = lr
        self.current_step += 1
        return lr
```

```
Learning Rate Schedule:

  LR
  │
  │     ╭──────╮
  │    ╱        ╲
  │   ╱          ╲
  │  ╱            ╲
  │ ╱              ╲
  │╱                ╲
  │                  ╲___________
  └──────────────────────────────→ Steps
  0   warmup    peak         end

  Warmup (steps 0-500):
    LR ramps from 0 to 3e-4 linearly.
    Prevents early training instability.

  Cosine decay (steps 500-50000):
    LR smoothly decreases from 3e-4 to 1e-6.
    Allows fine-grained learning in later stages.
```

---

## Step 3: The Training Loop

This is the main training function. It ties everything together.

```python
# training/train.py

import torch
import torch.nn as nn
import time
import os
from pathlib import Path

from model.config import MiniLLMConfig
from model.transformer import MiniLLM
from training.dataset import create_dataloaders
from training.scheduler import CosineWarmupScheduler


def train(config: MiniLLMConfig, train_tokens: list[int], val_tokens: list[int],
          checkpoint_dir: str = "checkpoints", log_dir: str = "logs"):
    """Complete training loop."""

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on: {device}")

    # Create model
    model = MiniLLM(config).to(device)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Model parameters: {total_params:,}")

    # Create data loaders
    train_loader, val_loader = create_dataloaders(train_tokens, val_tokens, config)

    # Optimizer: AdamW with weight decay
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=config.learning_rate,
        betas=(0.9, 0.95),
        weight_decay=0.1,
    )

    # Learning rate scheduler
    scheduler = CosineWarmupScheduler(
        optimizer,
        warmup_steps=config.warmup_steps,
        max_steps=config.max_steps,
        max_lr=config.learning_rate,
    )

    # Loss function
    loss_fn = nn.CrossEntropyLoss()

    # Training state
    os.makedirs(checkpoint_dir, exist_ok=True)
    os.makedirs(log_dir, exist_ok=True)
    log_file = open(os.path.join(log_dir, "train_log.csv"), "w")
    log_file.write("step,train_loss,val_loss,lr,tokens_per_sec\n")

    global_step = 0
    best_val_loss = float("inf")

    print(f"\nStarting training for {config.max_steps} steps...")
    print(f"{'Step':>8} {'Train Loss':>12} {'Val Loss':>12} {'LR':>12} {'Tok/s':>10}")
    print("-" * 60)

    model.train()
    train_iter = iter(train_loader)

    for step in range(config.max_steps):
        t0 = time.time()

        # Get next batch (cycle through data)
        try:
            x, y = next(train_iter)
        except StopIteration:
            train_iter = iter(train_loader)
            x, y = next(train_iter)

        x, y = x.to(device), y.to(device)

        # Forward pass
        logits = model(x)  # (B, T, vocab_size)

        # Reshape for cross-entropy: (B*T, vocab_size) vs (B*T,)
        loss = loss_fn(
            logits.view(-1, config.vocab_size),
            y.view(-1)
        )

        # Backward pass
        optimizer.zero_grad()
        loss.backward()

        # Gradient clipping — prevents exploding gradients
        grad_norm = torch.nn.utils.clip_grad_norm_(
            model.parameters(), config.grad_clip
        )

        # Optimizer step
        optimizer.step()
        lr = scheduler.step()

        # Timing
        t1 = time.time()
        tokens_per_sec = config.batch_size * config.max_seq_len / (t1 - t0)

        global_step += 1

        # Logging every 100 steps
        if global_step % 100 == 0:
            val_loss = evaluate(model, val_loader, loss_fn, device)
            model.train()  # Back to training mode

            print(f"{global_step:>8} {loss.item():>12.4f} {val_loss:>12.4f} "
                  f"{lr:>12.6f} {tokens_per_sec:>10.0f}")

            log_file.write(f"{global_step},{loss.item():.4f},{val_loss:.4f},"
                          f"{lr:.6f},{tokens_per_sec:.0f}\n")
            log_file.flush()

            # Save best model
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                save_checkpoint(model, optimizer, scheduler, global_step,
                              val_loss, os.path.join(checkpoint_dir, "best.pt"))

        # Save checkpoint every 5000 steps
        if global_step % 5000 == 0:
            save_checkpoint(model, optimizer, scheduler, global_step,
                          loss.item(),
                          os.path.join(checkpoint_dir, f"step_{global_step}.pt"))

    log_file.close()
    print(f"\nTraining complete. Best val loss: {best_val_loss:.4f}")
    return model


@torch.no_grad()
def evaluate(model, val_loader, loss_fn, device, max_batches=50):
    """Evaluate model on validation set."""
    model.eval()
    total_loss = 0
    n_batches = 0

    for x, y in val_loader:
        if n_batches >= max_batches:
            break

        x, y = x.to(device), y.to(device)
        logits = model(x)
        loss = loss_fn(logits.view(-1, logits.size(-1)), y.view(-1))
        total_loss += loss.item()
        n_batches += 1

    return total_loss / max(n_batches, 1)


def save_checkpoint(model, optimizer, scheduler, step, loss, path):
    """Save training checkpoint."""
    torch.save({
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "scheduler_step": scheduler.current_step,
        "global_step": step,
        "loss": loss,
        "config": model.config,
    }, path)


def load_checkpoint(path, config, device):
    """Load training checkpoint."""
    checkpoint = torch.load(path, map_location=device)
    model = MiniLLM(config).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    return model, checkpoint
```

---

## Step 4: The Main Training Script

```python
# run_training.py — Ties everything together

from model.config import MiniLLMConfig
from tokenizer.bpe import BPETokenizer
from training.train import train


def main():
    # Load config
    config = MiniLLMConfig()

    # Load tokenizer
    tokenizer = BPETokenizer.load("tokenizer/vocab.json")

    # Load and tokenize data
    print("Loading training data...")
    with open("data/train.txt", "r", encoding="utf-8") as f:
        train_text = f.read()
    with open("data/val.txt", "r", encoding="utf-8") as f:
        val_text = f.read()

    print("Tokenizing...")
    train_tokens = tokenizer.encode(train_text)
    val_tokens = tokenizer.encode(val_text)
    print(f"Train tokens: {len(train_tokens):,}")
    print(f"Val tokens:   {len(val_tokens):,}")

    # Train
    model = train(config, train_tokens, val_tokens)

    print("\nDone! Model saved to checkpoints/best.pt")


if __name__ == "__main__":
    main()
```

---

## Understanding the Loss

Cross-entropy loss measures how surprised the model is by the correct
answer. Lower loss = better predictions.

```
Cross-Entropy Loss:

  Model predicts probability distribution over vocabulary:
    P("return") = 0.35
    P("if")     = 0.20
    P("for")    = 0.15
    P("def")    = 0.10
    P(...)      = 0.20

  Actual next token: "return"

  Loss = -log(P("return")) = -log(0.35) = 1.05

  If model was more confident:
    P("return") = 0.90 → Loss = -log(0.90) = 0.11  (much lower!)

  If model was wrong:
    P("return") = 0.01 → Loss = -log(0.01) = 4.61  (very high!)

  Random guessing (vocab_size=8192):
    P(any token) = 1/8192 → Loss = -log(1/8192) = 9.01

  So initial loss should be ~9.0 and decrease during training.
```

```
Expected Loss Curve:

  Loss
  9.0 │ ●
      │  ●
  7.0 │   ●
      │    ●●
  5.0 │      ●●
      │        ●●●
  3.0 │           ●●●●●
      │                ●●●●●●●●
  1.5 │                        ●●●●●●●●●●●●
      │
  0.0 └──────────────────────────────────────→ Steps
      0    5K   10K   20K   30K   40K   50K
```

---

## Exercises

### Exercise 1: Implement and Run

Implement all the training code shown above. Run a short training
session (1000 steps) and verify:
- Loss starts near 9.0 (random guessing for vocab_size=8192)
- Loss decreases over the first 1000 steps
- Learning rate follows the warmup schedule

### Exercise 2: Plot the Learning Rate

Use the `CosineWarmupScheduler` to generate learning rates for all
50,000 steps. Plot the curve with matplotlib. Verify it matches the
diagram above.

```python
import matplotlib.pyplot as plt

scheduler = CosineWarmupScheduler(None, warmup_steps=500,
                                   max_steps=50000, max_lr=3e-4)
# Note: pass a dummy optimizer or modify to work standalone
lrs = []
for step in range(50000):
    lrs.append(scheduler.get_lr())
    scheduler.current_step += 1

plt.plot(lrs)
plt.xlabel("Step")
plt.ylabel("Learning Rate")
plt.title("Cosine Warmup Schedule")
plt.savefig("lr_schedule.png")
```

### Exercise 3: Batch Size Experiment

Run 500 steps with batch_size=16, 32, and 64. Compare:
- Tokens per second
- Loss at step 500
- GPU memory usage (check with `torch.cuda.max_memory_allocated()`)

Which batch size gives the best trade-off for your GPU?

---

Next: [Lesson 05: Training the Model](./05-training-the-model.md)
