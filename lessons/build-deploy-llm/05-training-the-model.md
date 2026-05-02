# Lesson 05: Training the Model

Time to train. You have the tokenizer, the model, and the training
loop. This lesson is about actually running training, monitoring what
happens, debugging when things go wrong, and knowing when to stop.

---

## The Core Idea

Training a model is like baking. You set the temperature, put it in
the oven, and watch through the glass. If the bread is burning, you
adjust. If it is not rising, something is wrong with the recipe.

The "oven glass" for ML is the loss curve. Everything you need to know
about training health is in that curve.

```
What the Loss Curve Tells You:

  HEALTHY TRAINING:
  Loss
  9.0 │●
      │ ●
  6.0 │  ●●
      │    ●●●
  3.0 │       ●●●●●●
      │              ●●●●●●●●●●●●
  1.5 │                            ●●●●●●
      └──────────────────────────────────→ Steps
  ✓ Starts high, drops fast, then slowly converges

  LOSS NOT DECREASING:
  Loss
  9.0 │●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●
      │
      └──────────────────────────────────→ Steps
  ✗ Learning rate too low, or bug in data pipeline

  LOSS EXPLODES:
  Loss
  9.0 │●
      │ ●
  6.0 │  ●
      │   ●
  3.0 │    ●
      │     ●
  NaN │      💥
      └──────────────────────────────────→ Steps
  ✗ Learning rate too high, or numerical instability

  OVERFITTING:
  Loss
      │         Train ──────────
  3.0 │●●●●●●●●●●●●●●●●●●●●●●●
      │        Val ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  2.0 │●●●●●●●●●●
      │          ●●●●●●●●●●●●●●●●●●●●●
  1.0 │
      └──────────────────────────────────→ Steps
  ✗ Train loss keeps dropping, val loss stops or rises
```

---

## Running the Full Training

```python
# run_full_training.py

import torch
from model.config import MiniLLMConfig
from tokenizer.bpe import BPETokenizer
from training.train import train


def main():
    config = MiniLLMConfig(
        vocab_size=8192,
        max_seq_len=256,
        n_layers=6,
        n_heads=8,
        d_model=512,
        d_ff=2048,
        dropout=0.1,
        batch_size=32,
        learning_rate=3e-4,
        warmup_steps=500,
        max_steps=50_000,
        grad_clip=1.0,
    )

    # Load tokenizer
    tokenizer = BPETokenizer.load("tokenizer/vocab.json")

    # Load and tokenize data
    with open("data/train.txt", "r") as f:
        train_tokens = tokenizer.encode(f.read())
    with open("data/val.txt", "r") as f:
        val_tokens = tokenizer.encode(f.read())

    print(f"Config: {config}")
    print(f"Train tokens: {len(train_tokens):,}")
    print(f"Val tokens:   {len(val_tokens):,}")
    print(f"Estimated GPU memory: ~{config.n_params * 4 * 4 / 1024**3:.1f} GB")

    # Train
    model = train(config, train_tokens, val_tokens)


if __name__ == "__main__":
    main()
```

```
Expected Training Output:

  Training on: cuda
  Model parameters: 14,943,232
  Train: 52,340 sequences, 1,635 batches
  Val:   5,812 sequences, 181 batches

  Starting training for 50000 steps...
      Step   Train Loss     Val Loss           LR      Tok/s
  ------------------------------------------------------------
       100       7.2341       7.3012     0.000060      85000
       200       6.1823       6.2451     0.000120      86000
       500       4.8912       4.9234     0.000300      85000
      1000       3.9123       3.9876     0.000300      86000
      2000       3.2145       3.3012     0.000298      85000
      5000       2.5678       2.7123     0.000280      86000
     10000       2.1234       2.3456     0.000245      85000
     20000       1.7890       2.0123     0.000170      86000
     30000       1.5678       1.8901     0.000095      85000
     40000       1.4321       1.8234     0.000035      86000
     50000       1.3890       1.8012     0.000001      85000

  Training complete. Best val loss: 1.7823
```

---

## Monitoring Training

### Loss Curves

Plot training and validation loss after training (or during, if you
want live monitoring):

```python
# plot_training.py

import csv
import matplotlib.pyplot as plt


def plot_training_log(log_path="logs/train_log.csv"):
    """Plot training and validation loss curves."""
    steps, train_losses, val_losses, lrs = [], [], [], []

    with open(log_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            steps.append(int(row["step"]))
            train_losses.append(float(row["train_loss"]))
            val_losses.append(float(row["val_loss"]))
            lrs.append(float(row["lr"]))

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))

    # Loss curves
    ax1.plot(steps, train_losses, label="Train Loss", alpha=0.8)
    ax1.plot(steps, val_losses, label="Val Loss", alpha=0.8)
    ax1.set_xlabel("Step")
    ax1.set_ylabel("Loss")
    ax1.set_title("Training Progress")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Learning rate
    ax2.plot(steps, lrs, color="orange")
    ax2.set_xlabel("Step")
    ax2.set_ylabel("Learning Rate")
    ax2.set_title("Learning Rate Schedule")
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig("training_curves.png", dpi=150)
    print("Saved training_curves.png")


plot_training_log()
```

---

## Debugging Common Issues

### Problem 1: Loss Not Decreasing

```
Symptom: Loss stays at ~9.0 (random) after 1000+ steps

Checklist:
┌──────────────────────────────────────────────────┐
│  □ Is the data pipeline correct?                  │
│    → Print a batch: are x and y shifted by 1?     │
│    → Are token IDs in range [0, vocab_size)?      │
│                                                    │
│  □ Is the learning rate too low?                  │
│    → Try 1e-3 instead of 3e-4                     │
│    → Check warmup: is LR still near 0?            │
│                                                    │
│  □ Is the model receiving gradients?              │
│    → Check: any(p.grad is not None for p in       │
│             model.parameters())                    │
│                                                    │
│  □ Is the loss function correct?                  │
│    → Verify shapes: logits (B*T, V) vs y (B*T)   │
│    → Check: loss at step 0 ≈ log(vocab_size)      │
└──────────────────────────────────────────────────┘
```

```python
# Debug: verify data pipeline
for x, y in train_loader:
    print(f"x shape: {x.shape}, y shape: {y.shape}")
    print(f"x[0][:10]: {x[0][:10].tolist()}")
    print(f"y[0][:10]: {y[0][:10].tolist()}")
    # y should be x shifted by 1 position
    assert (x[0][1:] == y[0][:-1]).all(), "Data pipeline is broken!"
    print("Data pipeline OK")
    break
```

### Problem 2: NaN Gradients

```
Symptom: Loss becomes NaN after some steps

Checklist:
┌──────────────────────────────────────────────────┐
│  □ Is the learning rate too high?                 │
│    → Reduce to 1e-4 or 5e-5                      │
│                                                    │
│  □ Is gradient clipping working?                  │
│    → Print grad_norm each step                    │
│    → If grad_norm > 100, something is wrong       │
│                                                    │
│  □ Are there inf/nan in the input?                │
│    → Check: torch.isnan(x).any()                  │
│    → Check: torch.isinf(logits).any()             │
│                                                    │
│  □ Is softmax overflowing?                        │
│    → Check max logit value before softmax         │
│    → Consider using mixed precision (FP16)        │
└──────────────────────────────────────────────────┘
```

```python
# Debug: NaN detection hook
def nan_hook(module, input, output):
    if isinstance(output, torch.Tensor) and torch.isnan(output).any():
        print(f"NaN detected in {module.__class__.__name__}")
        raise RuntimeError("NaN in forward pass")

for module in model.modules():
    module.register_forward_hook(nan_hook)
```

### Problem 3: Overfitting

```
Symptom: Train loss keeps dropping, val loss plateaus or rises

Fixes (in order of preference):
┌──────────────────────────────────────────────────┐
│  1. Get more data                                 │
│     → Collect more Python files                   │
│     → This is almost always the best fix          │
│                                                    │
│  2. Increase dropout                              │
│     → Try 0.2 instead of 0.1                      │
│                                                    │
│  3. Reduce model size                             │
│     → Fewer layers (4 instead of 6)               │
│     → Smaller d_model (256 instead of 512)        │
│                                                    │
│  4. Add weight decay                              │
│     → Already using 0.1 in AdamW                  │
│     → Try increasing to 0.2                       │
│                                                    │
│  5. Early stopping                                │
│     → Stop when val loss hasn't improved          │
│       for 5000 steps                              │
└──────────────────────────────────────────────────┘
```

---

## Evaluating Generation Quality

Numbers are not everything. You should also look at what the model
generates during training.

```python
# evaluate_generation.py

import torch
from model.config import MiniLLMConfig
from model.transformer import MiniLLM
from tokenizer.bpe import BPETokenizer
from training.train import load_checkpoint


def evaluate_generation(checkpoint_path, tokenizer_path, prompts):
    """Generate text from a checkpoint and display results."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    tokenizer = BPETokenizer.load(tokenizer_path)
    config = MiniLLMConfig()
    model, checkpoint = load_checkpoint(checkpoint_path, config, device)
    model.eval()

    print(f"Checkpoint: step {checkpoint['global_step']}, "
          f"loss {checkpoint['loss']:.4f}")
    print("=" * 60)

    for prompt in prompts:
        token_ids = tokenizer.encode(prompt)
        generated_ids = model.generate(
            token_ids,
            max_new_tokens=100,
            temperature=0.8,
            top_k=50,
        )
        generated_text = tokenizer.decode(generated_ids)

        print(f"\nPrompt: {prompt}")
        print(f"Generated:\n{generated_text}")
        print("-" * 60)


# Test prompts for Python code completion
prompts = [
    "def fibonacci(n):\n",
    "class LinkedList:\n    def __init__(self):\n",
    "import os\nimport sys\n\ndef main():\n",
    "# Sort a list of integers\ndef sort_list(",
]

evaluate_generation("checkpoints/best.pt", "tokenizer/vocab.json", prompts)
```

```
Expected Output (after full training):

  Checkpoint: step 47200, loss 1.7823
  ============================================================

  Prompt: def fibonacci(n):
  Generated:
  def fibonacci(n):
      if n <= 1:
          return n
      return fibonacci(n - 1) + fibonacci(n - 2)

  ------------------------------------------------------------

  Prompt: class LinkedList:
      def __init__(self):
  Generated:
  class LinkedList:
      def __init__(self):
          self.head = None
          self.size = 0

      def append(self, value):
          new_node = Node(value)
          if self.head is None:
              self.head = new_node
          ...

  Note: Output quality depends on dataset size and training
  duration. A 15M parameter model trained on 100MB of code
  will produce reasonable but imperfect completions.
```

---

## Checkpointing Strategy

```
Checkpointing — What to Save and When:

  ┌─────────────────────────────────────────────┐
  │  Every 5000 steps: save full checkpoint      │
  │    → model weights                           │
  │    → optimizer state                          │
  │    → scheduler state                          │
  │    → step number and loss                     │
  │                                               │
  │  On best val loss: save "best.pt"            │
  │    → This is the model you deploy             │
  │                                               │
  │  Keep last 3 checkpoints + best              │
  │    → Delete older ones to save disk space     │
  └─────────────────────────────────────────────┘

  Checkpoint sizes for our model:
    Full checkpoint (model + optimizer): ~180 MB
    Model-only checkpoint: ~60 MB
```

```python
# Checkpoint cleanup — keep only recent checkpoints
import glob

def cleanup_checkpoints(checkpoint_dir, keep=3):
    """Keep only the N most recent checkpoints plus best.pt."""
    checkpoints = sorted(glob.glob(os.path.join(checkpoint_dir, "step_*.pt")))
    for old_ckpt in checkpoints[:-keep]:
        os.remove(old_ckpt)
        print(f"Removed old checkpoint: {old_ckpt}")
```

---

## Training Timeline

```
What to Expect During Training:

  Steps 0-500 (Warmup):
    Loss drops from ~9.0 to ~5.0
    Model learns basic token frequencies
    Generated text: random garbage

  Steps 500-5000:
    Loss drops from ~5.0 to ~2.5
    Model learns Python syntax (indentation, colons, parentheses)
    Generated text: syntactically plausible but semantically wrong

  Steps 5000-20000:
    Loss drops from ~2.5 to ~1.8
    Model learns common patterns (def, class, if/else, for loops)
    Generated text: recognizable Python, sometimes correct

  Steps 20000-50000:
    Loss drops from ~1.8 to ~1.4
    Model refines predictions, learns less common patterns
    Generated text: reasonable code completions

  Total time on RTX 3080 (12GB): ~3-4 hours
  Total time on RTX 4090 (24GB): ~1.5-2 hours
  Total time on Google Colab T4: ~6-8 hours
```

---

## Exercises

### Exercise 1: Train the Model

Run the full training for 50,000 steps. Monitor:
- Does loss start near 9.0?
- Does it drop below 2.0 by step 20,000?
- Is there a gap between train and val loss? How big?

Save the training curves plot.

### Exercise 2: Generation Checkpoints

Evaluate generation quality at steps 1000, 5000, 10000, 25000, and
50000. For each checkpoint, generate completions for the same 4 prompts.
Document how quality improves over training.

### Exercise 3: Hyperparameter Experiment

Pick ONE hyperparameter to change and train for 10,000 steps:
- Learning rate: 1e-4 vs 3e-4 vs 1e-3
- Batch size: 16 vs 32 vs 64
- Model size: 4 layers vs 6 layers vs 8 layers

Compare loss curves. Which change had the biggest impact?

---

Next: [Lesson 06: Model Optimization for Deployment](./06-model-optimization.md)
