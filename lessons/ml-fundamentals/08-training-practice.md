# Lesson 08: Training in Practice — Loss Functions, Optimizers, and All the Tricks

Backpropagation tells you HOW to update weights. This lesson covers
everything else: what to optimize, how fast to move, how to split your
data, and how to avoid memorizing the training set.

This is the "engineering" side of training neural networks.

---

## Loss Functions — Measuring How Wrong You Are

The loss function defines your model's goal. Different problems need
different loss functions.

### MSE (Mean Squared Error) — For Predicting Numbers

When your output is a continuous number (price, temperature, score):

```
MSE = average of (prediction - actual)²

predictions: [2.5, 0.5, 2.1]
actuals:     [3.0, 0.5, 1.5]
errors:      [-0.5, 0.0, 0.6]
squared:     [0.25, 0.0, 0.36]
MSE:         (0.25 + 0.0 + 0.36) / 3 = 0.203
```

Why square the error? Two reasons:
1. Makes all errors positive (can't cancel out)
2. Penalizes large errors much more than small ones (0.1² = 0.01 but 10² = 100)

```python
import numpy as np

def mse_loss(predictions, targets):
    return np.mean((predictions - targets) ** 2)

def mse_gradient(predictions, targets):
    return 2 * (predictions - targets) / len(targets)
```

### Cross-Entropy — For Classification

When your output is a category (cat/dog, spam/not-spam, digit 0-9):

**Intuition:** Cross-entropy measures how *surprised* the model is by
the correct answer. If the model says "95% chance it's a cat" and it IS
a cat, low surprise (low loss). If the model says "5% chance it's a cat"
and it IS a cat, high surprise (high loss).

```
Binary Cross-Entropy (2 classes):
    loss = -(target * log(prediction) + (1-target) * log(1-prediction))

If target = 1 (it IS a cat):
    prediction = 0.95 → loss = -log(0.95) = 0.05  (confident & correct: low loss)
    prediction = 0.50 → loss = -log(0.50) = 0.69  (uncertain: medium loss)
    prediction = 0.05 → loss = -log(0.05) = 3.00  (confident & WRONG: high loss)
```

**Analogy:** A weather forecaster's credibility score. If they say
"90% chance of rain" and it rains, they look good. If they say "10%
chance of rain" and it rains, they look terrible. Cross-entropy is
exactly this scoring system.

```python
def binary_cross_entropy(predictions, targets):
    epsilon = 1e-15
    predictions = np.clip(predictions, epsilon, 1 - epsilon)
    return -np.mean(
        targets * np.log(predictions) +
        (1 - targets) * np.log(1 - predictions)
    )
```

### When to Use Which

| Problem | Output | Loss Function | Output Activation |
|---------|--------|--------------|-------------------|
| Predict a number | Single number | MSE | None (linear) |
| Yes/No decision | Probability (0-1) | Binary Cross-Entropy | Sigmoid |
| Choose 1 of N classes | N probabilities | Cross-Entropy | Softmax |

---

## Optimizers — How to Walk Downhill Smarter

Gradient descent says "go downhill." But there are smarter ways to
walk downhill than just following the steepest slope.

### SGD (Stochastic Gradient Descent)

The simplest optimizer. Compute the gradient, take a step.

```
new_weight = old_weight - learning_rate * gradient
```

Problems with plain SGD:
- Gets stuck in "ravines" (narrow valleys) — oscillates back and forth
- Same learning rate for all parameters (some might need bigger steps)
- Can get stuck in local minima

### SGD with Momentum

**Analogy:** A ball rolling downhill. It doesn't just follow the steepest
slope at each point — it builds up speed (momentum) in the direction
it's been rolling. This helps it plow through small bumps and narrow
ravines.

```
velocity = momentum * old_velocity + gradient
new_weight = old_weight - learning_rate * velocity
```

Typical momentum value: 0.9 (remember 90% of previous velocity).

```
WITHOUT momentum:          WITH momentum:
(oscillates in ravine)     (momentum smooths the path)

    /\  /\  /\                 ___
   /  \/  \/  \___           /     \___
  /                          /
 /                          /
```

### Adam (Adaptive Moment Estimation)

The most popular optimizer. Combines two ideas:

1. **Momentum** — remembers past gradients (first moment)
2. **Adaptive learning rates** — each parameter gets its own learning
   rate based on how much it's been changing (second moment)

**Analogy — the smart hiker:**

SGD is a hiker who always takes the same size steps, regardless of
terrain. Adam is a hiker who:
- Remembers which direction they've been heading (momentum)
- Takes bigger steps on flat ground and smaller steps on steep slopes
- Adjusts step size per dimension (moves fast in directions with
  consistent gradients, slow in noisy directions)

```python
# In practice, you just pick the optimizer:
# optimizer = torch.optim.SGD(model.parameters(), lr=0.01)
# optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
```

### Which Optimizer to Use

Start with Adam. It works well for most problems without much tuning.

| Optimizer | When to Use |
|-----------|-------------|
| SGD + Momentum | When you need best final accuracy (with patience to tune) |
| Adam | Default choice. Good out of the box. |
| AdamW | Adam with proper weight decay. Current best practice. |

---

## Learning Rate Schedules — Start Fast, Slow Down

The learning rate doesn't have to be constant. Often it's better to
start with a larger rate (explore quickly) and shrink it over time
(fine-tune carefully).

**Analogy:** Searching for your keys. First, you quickly check every room
(high learning rate). Once you know it's in the bedroom, you search
that room carefully (low learning rate).

### Common Schedules

```
Step Decay:
learning_rate          Reduce by half every N epochs
1.0  |████
0.5  |    ████
0.25 |        ████
0.125|            ████
     └─────────────────→ epochs


Cosine Annealing:
learning_rate          Smooth cosine curve
1.0  |██
0.75 |  ██
0.5  |    ███
0.25 |       ████
0.0  |           ████████
     └──────────────────→ epochs


Warmup + Decay:
learning_rate          Start low, ramp up, then decay
0.001|█
0.01 | ██
0.001|   ████
0.0001|      ████████
     └──────────────────→ epochs
```

```python
# PyTorch learning rate schedulers (preview — more in Lesson 09):
# scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=30, gamma=0.1)
# scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=100)
```

---

## Batches and Mini-Batches

### Why Not Use All Data at Once?

If you have 1 million training examples, computing the gradient on ALL
of them before making ONE parameter update is:
- Slow (tons of computation per step)
- Memory-hungry (all data must fit in GPU memory)
- Wasteful (the first 100 examples already give a decent gradient estimate)

### Three Approaches

```
                         Batch Size     Updates per Epoch
Full Batch GD:           All data       1 (very accurate but slow)
Stochastic GD:           1 example      N (noisy but fast)
Mini-Batch GD:           32-512         N/batch_size (best tradeoff)
```

**Analogy — polling voters:**

| Approach | Analogy | Tradeoff |
|----------|---------|----------|
| Full batch | Ask every voter → accurate but takes months | Slow, memory-heavy |
| Stochastic (size 1) | Ask 1 random person → fast but noisy | Fast, very noisy |
| Mini-batch (32-512) | Ask 200 random people → fast AND reliable | Best of both worlds |

### Choosing Batch Size

| Batch Size | Pros | Cons |
|------------|------|------|
| Small (16-32) | More updates per epoch, regularization effect | Noisy gradients, can't fully use GPU |
| Medium (64-256) | Good balance | The sweet spot for most problems |
| Large (512-4096) | Stable gradients, full GPU utilization | Fewer updates, may generalize worse |

Common default: **32 or 64** for starting out.

---

## Epochs — How Many Passes?

One epoch = one complete pass through all training data.

How many epochs do you need? It depends. You train until:
- The validation loss stops improving, OR
- You hit your compute budget

Typical ranges:
- Simple problems: 10-50 epochs
- Image classification: 50-200 epochs
- Fine-tuning pretrained models: 3-10 epochs

---

## Train / Validation / Test Split

This is the most important concept for building models that work in
the real world.

```
┌──────────────────────────────────────────────────────────┐
│                    YOUR FULL DATASET                      │
├────────────────────────┬────────────┬────────────────────┤
│    Training Set        │ Validation │    Test Set         │
│    (70-80%)            │ (10-15%)   │    (10-15%)         │
│                        │            │                     │
│  Model learns from     │ You check  │  Final grade.       │
│  these examples.       │ progress   │  Touch this ONCE    │
│                        │ here.      │  at the very end.   │
│                        │ Tune       │                     │
│                        │ hyperparams│                     │
│                        │ here.      │                     │
└────────────────────────┴────────────┴────────────────────┘
```

**Analogy — studying for an exam:**

| Set | Analogy | Purpose |
|-----|---------|---------|
| Training | The textbook | Learn from it |
| Validation | Practice exams | Check if you're actually learning (not just memorizing) |
| Test | The real final exam | True measure of knowledge. Only taken once. |

```python
from sklearn.model_selection import train_test_split

X_train_val, X_test, y_train_val, y_test = train_test_split(
    X, y, test_size=0.15, random_state=42
)

X_train, X_val, y_train, y_val = train_test_split(
    X_train_val, y_train_val, test_size=0.176, random_state=42
)
# 0.176 of 0.85 ≈ 0.15, so we get roughly 70/15/15

print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
```

**Critical rule:** If you tune your model based on test set performance,
the test set becomes a validation set and your results are unreliable.
The test set is for ONE final evaluation.

---

## Overfitting Detection

The most common training failure. Your model memorizes the training data
instead of learning general patterns.

```
Loss
│
│  ████                          ← training loss keeps dropping
│      ████
│          ████
│              ████
│                  ████────────  ← keeps going down
│
│  ████                          ← validation loss drops at first...
│      ████
│          ████
│              ████████
│                      ████████  ← ...then starts RISING
│                              ████████
│
└────────────────────────────────────→ Epochs
          ↑
     Start of overfitting
     (stop training here)
```

**How to detect it:** Track both training and validation loss every
epoch. When validation loss starts increasing while training loss keeps
decreasing, you're overfitting.

**TypeScript analogy:** Imagine a type system that only works for your
test files but breaks on production code. You over-fitted your types
to the tests.

---

## Fighting Overfitting — Regularization

### Dropout

During training, randomly set some neurons to zero. Different neurons
are disabled each batch.

```
Without dropout:           With dropout (p=0.5):
(all neurons active)       (random neurons disabled)

[n1] [n2] [n3] [n4]       [n1] [  ] [n3] [  ]
  ↓    ↓    ↓    ↓          ↓         ↓
[n5] [n6] [n7] [n8]       [  ] [n6] [n7] [  ]
  ↓    ↓    ↓    ↓                ↓    ↓
      output                    output
```

**Analogy:** A team where random members call in sick each day. The team
can't rely on any single person, so everyone learns to be a generalist.
The team becomes more robust.

At inference time (making predictions), all neurons are active, but
their outputs are scaled down by the dropout probability.

### Weight Decay (L2 Regularization)

Add a penalty for large weights to the loss function:

```
total_loss = prediction_loss + lambda * sum(weights²)
```

This pushes weights toward zero, keeping the model simpler.

**Analogy:** A tax on complexity. The model has to justify every large
weight — is it really necessary, or is it just memorizing noise?

### Early Stopping

Stop training when validation loss starts increasing. Simple and effective.

```python
best_val_loss = float('inf')
patience = 10
patience_counter = 0

for epoch in range(1000):
    train_loss = train_one_epoch(model, train_loader)
    val_loss = evaluate(model, val_loader)

    if val_loss < best_val_loss:
        best_val_loss = val_loss
        patience_counter = 0
        save_model(model)
    else:
        patience_counter += 1
        if patience_counter >= patience:
            print(f"Early stopping at epoch {epoch}")
            break
```

### Data Augmentation

Create more training data by transforming existing data. For images:

| Augmentation | What It Does |
|-------------|-------------|
| Horizontal flip | Mirror the image left-right |
| Random crop | Cut out a random portion |
| Rotation | Rotate by a few degrees |
| Color jitter | Slightly change brightness/contrast |
| Random noise | Add small random perturbations |

**Analogy:** You have 100 photos of cats. By flipping, rotating, and
cropping each one, you now have 500 photos of cats. The model sees more
variety without needing more real data.

For text: synonym replacement, random insertion, back-translation.

---

## Hyperparameter Tuning

The parameters you set BEFORE training. No algorithm learns these for
you — you have to experiment.

### The Key Hyperparameters

| Hyperparameter | Typical Range | Effect |
|----------------|--------------|--------|
| Learning rate | 1e-5 to 1e-1 | Most important. Too high = diverge. Too low = slow. |
| Batch size | 16 to 512 | Affects training speed and generalization |
| Hidden layer size | 32 to 1024 | Model capacity (too small = underfit, too large = overfit) |
| Number of layers | 1 to 20+ | Depth of the network |
| Dropout rate | 0.1 to 0.5 | How much regularization |
| Weight decay | 1e-5 to 1e-2 | How much to penalize large weights |

### Tuning Strategy

1. **Start with published defaults** — use what worked for similar problems
2. **Tune learning rate first** — it has the biggest impact
3. **Use a validation set** — never tune on the test set
4. **Try coarse-to-fine** — first try 0.1, 0.01, 0.001. Then narrow
   down around the best one (e.g., 0.003, 0.005, 0.008)

```python
learning_rates = [0.1, 0.01, 0.001, 0.0001]
results = {}

for lr in learning_rates:
    model = create_model()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    val_loss = train_and_evaluate(model, optimizer, train_data, val_data)
    results[lr] = val_loss
    print(f"LR={lr:.4f} → Val Loss={val_loss:.4f}")
```

---

## Putting It All Together — A Complete Training Pipeline

```python
import numpy as np

np.random.seed(42)

N = 1000
X = np.random.randn(N, 2)
y = ((X[:, 0] ** 2 + X[:, 1] ** 2) < 1).astype(float).reshape(-1, 1)

split1 = int(0.7 * N)
split2 = int(0.85 * N)
X_train, X_val, X_test = X[:split1], X[split1:split2], X[split2:]
y_train, y_val, y_test = y[:split1], y[split1:split2], y[split2:]

def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))

def relu(z):
    return np.maximum(0, z)

def relu_derivative(z):
    return (z > 0).astype(float)

input_dim = 2
hidden_dim = 16
output_dim = 1
lr = 0.01

W1 = np.random.randn(input_dim, hidden_dim) * np.sqrt(2.0 / input_dim)
b1 = np.zeros((1, hidden_dim))
W2 = np.random.randn(hidden_dim, output_dim) * np.sqrt(2.0 / hidden_dim)
b2 = np.zeros((1, output_dim))

batch_size = 32
best_val_loss = float('inf')
patience = 20
patience_counter = 0
train_losses = []
val_losses = []

for epoch in range(500):
    indices = np.random.permutation(len(X_train))
    epoch_loss = 0
    num_batches = 0

    for start in range(0, len(X_train), batch_size):
        batch_idx = indices[start:start + batch_size]
        X_batch = X_train[batch_idx]
        y_batch = y_train[batch_idx]

        z1 = X_batch @ W1 + b1
        a1 = relu(z1)
        z2 = a1 @ W2 + b2
        a2 = sigmoid(z2)

        epsilon = 1e-15
        a2_clipped = np.clip(a2, epsilon, 1 - epsilon)
        loss = -np.mean(
            y_batch * np.log(a2_clipped) +
            (1 - y_batch) * np.log(1 - a2_clipped)
        )
        epoch_loss += loss
        num_batches += 1

        d_z2 = a2 - y_batch
        d_W2 = a1.T @ d_z2 / batch_size
        d_b2 = np.mean(d_z2, axis=0, keepdims=True)
        d_a1 = d_z2 @ W2.T
        d_z1 = d_a1 * relu_derivative(z1)
        d_W1 = X_batch.T @ d_z1 / batch_size
        d_b1 = np.mean(d_z1, axis=0, keepdims=True)

        W2 -= lr * d_W2
        b2 -= lr * d_b2
        W1 -= lr * d_W1
        b1 -= lr * d_b1

    train_loss = epoch_loss / num_batches
    train_losses.append(train_loss)

    z1_val = X_val @ W1 + b1
    a1_val = relu(z1_val)
    z2_val = a1_val @ W2 + b2
    a2_val = sigmoid(z2_val)
    a2_val_clipped = np.clip(a2_val, epsilon, 1 - epsilon)
    val_loss = -np.mean(
        y_val * np.log(a2_val_clipped) +
        (1 - y_val) * np.log(1 - a2_val_clipped)
    )
    val_losses.append(val_loss)

    if val_loss < best_val_loss:
        best_val_loss = val_loss
        patience_counter = 0
        best_W1, best_b1 = W1.copy(), b1.copy()
        best_W2, best_b2 = W2.copy(), b2.copy()
    else:
        patience_counter += 1

    if epoch % 50 == 0:
        print(f"Epoch {epoch:3d} | Train: {train_loss:.4f} | Val: {val_loss:.4f}")

    if patience_counter >= patience:
        print(f"\nEarly stopping at epoch {epoch}")
        break

W1, b1, W2, b2 = best_W1, best_b1, best_W2, best_b2
z1_test = X_test @ W1 + b1
a1_test = relu(z1_test)
z2_test = a1_test @ W2 + b2
predictions = sigmoid(z2_test)
accuracy = np.mean((predictions > 0.5) == y_test)
print(f"\nTest Accuracy: {accuracy:.2%}")
```

---

## The Training Checklist

```
Before Training:
  □ Split data into train / val / test
  □ Choose loss function (MSE for regression, cross-entropy for classification)
  □ Choose optimizer (start with Adam)
  □ Set initial learning rate (start with 0.001)
  □ Set batch size (start with 32 or 64)

During Training:
  □ Monitor train and val loss every epoch
  □ Watch for overfitting (val loss rising)
  □ Track learning rate if using a schedule

If Overfitting:
  □ Add dropout
  □ Add weight decay
  □ Reduce model size
  □ Add data augmentation
  □ Use early stopping

If Underfitting:
  □ Increase model size (more neurons/layers)
  □ Train longer
  □ Reduce regularization
  □ Check that your data is correct
```

---

## Key Takeaways

1. **MSE for numbers, cross-entropy for categories** — match the loss
   function to your problem.
2. **Adam is the default optimizer** — it adapts learning rates per
   parameter and uses momentum.
3. **Mini-batches (32-64)** give the best tradeoff between speed and
   gradient quality.
4. **Train/val/test split is essential** — never evaluate on training data.
5. **Watch for overfitting** — training loss drops but validation loss
   rises. Fight it with dropout, weight decay, early stopping, and
   data augmentation.
6. **Learning rate is the most important hyperparameter** — tune it first.

---

## Exercises

1. **Loss function comparison:** Generate regression data (y = 2x + noise).
   Train with MSE loss, then try cross-entropy. What happens when you
   use the wrong loss function?

2. **Optimizer shootout:** Using the circle classifier code above, compare
   SGD (lr=0.01), SGD with momentum (0.9), and Adam. Plot the training
   curves. Which converges fastest?

3. **Overfitting on purpose:** Reduce the training set to 20 examples
   but keep the model large (hidden_dim=64). Watch training vs. validation
   loss. Then add dropout and compare.

4. **Learning rate finder:** Train for 1 epoch with learning rates from
   1e-5 to 10 (increasing exponentially). Plot loss vs. learning rate.
   The best learning rate is usually just before the loss starts
   exploding.

5. **Batch size experiment:** Train the circle classifier with batch
   sizes of 1, 8, 32, 128, and 700 (full batch). Compare training
   speed (wall clock time) and final accuracy.

---

Next: [Lesson 09 — PyTorch: Building Neural Networks with Real Tools](./09-pytorch.md)
