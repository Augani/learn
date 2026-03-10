# Lesson 03: Gradient Descent — How Machines Learn From Mistakes

In Lesson 02 we used a closed-form formula to find the best line.
That formula works for linear regression, but it does NOT scale to
neural networks with millions of parameters. We need a general method
for finding the best parameters for ANY model.

That method is gradient descent.

---

## The Blindfolded Hill-Walking Analogy

Imagine you are blindfolded on a hilly landscape. Your goal is to reach
the lowest valley. You cannot see, but you CAN feel the ground under
your feet.

```
The loss landscape:

    Loss
     │\        .
     │ \      / \       /\
     │  \    /   \     /  \
     │   \  /     \   /    \.
     │    \/       \_/       ← you want to get here (lowest point)
     │
     └──────────────────────── parameter value

You are standing at some random point.
You feel which direction slopes downward.
You take a step that direction.
Repeat until you reach the bottom.
```

Strategy:
1. Feel which direction is downhill (compute the gradient)
2. Take a step in that direction (update your parameters)
3. Repeat until you stop descending (loss stops decreasing)

That is gradient descent. It is the most important algorithm in ML.

---

## The Math Behind "Feeling Downhill"

The gradient is the derivative of the loss with respect to each parameter.
It tells you the direction of steepest INCREASE. Go the opposite way
to decrease the loss.

```
For our linear model y = w * x + b:

Loss = MSE = (1/n) * Σ(yᵢ - (w * xᵢ + b))²

Derivative with respect to w:
∂Loss/∂w = (-2/n) * Σ xᵢ * (yᵢ - (w * xᵢ + b))

Derivative with respect to b:
∂Loss/∂b = (-2/n) * Σ (yᵢ - (w * xᵢ + b))
```

Do not memorize these. The pattern is always the same: compute how much
the loss changes when you nudge each parameter a tiny bit.

```
Intuition for the derivative:

Parameter too big:           Parameter too small:

    Loss                         Loss
     │ .                           .  │
     │  \                         /   │
     │   \  ← you are here      / ← you are here
     │    \                     /     │
     │     \_                 _/      │
     │                                │
     └──── parameter              └──── parameter

Gradient is negative          Gradient is positive
(slope goes down to right)    (slope goes up to right)
Go RIGHT (increase param)    Go LEFT (decrease param)

Update rule: param = param - learning_rate * gradient
The minus sign flips the direction — you always go DOWNHILL.
```

---

## Learning Rate: How Big Are Your Steps?

The learning rate controls step size. It is the most important
hyperparameter in ML.

```
Too large (learning rate = 10):        Just right (lr = 0.01):

    Loss                                    Loss
     │ .   .   .                             │ .
     │  \ / \ / \                            │  \
     │   X   X   \  ← overshooting!         │   \.
     │      / \   /                          │    \.
     │         \_/                           │     \.___  ← converges
     └──────────── steps                     └──────────── steps

Bounces back and forth,                  Smoothly descends to minimum.
never settles down.

Too small (learning rate = 0.000001):

    Loss
     │ .
     │  .
     │   .
     │    .
     │     .............  ← barely moving, will take forever
     └──────────────────── steps (thousands needed)
```

```python
import numpy as np

learning_rates = [0.001, 0.01, 0.1, 1.0]
```

In practice, common starting values are 0.01 or 0.001.

---

## Implementing Gradient Descent From Scratch

Let us train a linear regression using gradient descent instead of
the closed-form solution.

```python
import numpy as np

np.random.seed(42)
X = np.linspace(0, 10, 100)
y_true = 3 * X + 7 + np.random.randn(100) * 2

w = 0.0
b = 0.0
learning_rate = 0.01
epochs = 100

losses = []

for epoch in range(epochs):
    predictions = w * X + b
    errors = y_true - predictions
    loss = np.mean(errors ** 2)
    losses.append(loss)

    dw = (-2 / len(X)) * np.sum(X * errors)
    db = (-2 / len(X)) * np.sum(errors)

    w = w - learning_rate * dw
    b = b - learning_rate * db

    if epoch % 20 == 0:
        print(f"Epoch {epoch:3d}: loss={loss:.4f}, w={w:.4f}, b={b:.4f}")

print(f"\nFinal: w={w:.4f} (true: 3.0), b={b:.4f} (true: 7.0)")
```

```
What this code does, step by step:

Epoch 0:   w=0.0,  b=0.0   →  predictions are all 0  →  huge loss
Epoch 20:  w=1.8,  b=4.2   →  getting closer
Epoch 40:  w=2.5,  b=5.9   →  getting better
Epoch 60:  w=2.8,  b=6.6   →  almost there
Epoch 80:  w=2.9,  b=6.8   →  very close
Epoch 100: w=3.0,  b=7.0   →  converged!

Each epoch: compute loss → compute gradients → update parameters
```

---

## Watching the Loss Decrease

Plotting the loss over time is how you know training is working.

```python
import matplotlib.pyplot as plt

plt.figure(figsize=(10, 5))
plt.plot(losses)
plt.xlabel("Epoch")
plt.ylabel("Loss (MSE)")
plt.title("Loss Over Training")
plt.grid(True, alpha=0.3)
plt.savefig("loss_curve.png", dpi=100, bbox_inches="tight")
plt.show()
```

```
What a healthy loss curve looks like:

Loss
 │\
 │ \
 │  \
 │   \.
 │    \.__
 │       \.______________________  ← plateaus (converged)
 │
 └──────────────────────────────── Epoch
 0    20    40    60    80    100

If the loss goes UP → learning rate too high
If the loss barely moves → learning rate too low
If the loss oscillates wildly → learning rate way too high
```

---

## The Loss Landscape in 2D

With two parameters (w and b), the loss landscape is a 3D surface.
Looking from above, it forms contour lines like a topographic map.

```
Contour plot of loss (bird's eye view):

    b
    │         ╭───╮
    │       ╭─┤   ├─╮
    │     ╭─┤ │ * │ ├─╮        * = minimum (goal)
    │   ╭─┤ │ │   │ │ ├─╮
    │ ╭─┤ │ │ └───┘ │ │ ├─╮
    │ │ │ │ └───────┘ │ │ │
    │ │ │ └───────────┘ │ │    Each ring = same loss value
    │ │ └───────────────┘ │    Inner = lower loss
    │ └───────────────────┘
    └──────────────────────── w

Gradient descent path:

    b
    │
    │     .
    │      \
    │       \.
    │        \.__
    │           \.__
    │              *.   ← arrived at minimum
    │
    └──────────────────── w
```

---

## Local Minima: Getting Stuck in the Wrong Valley

For linear regression, the loss landscape is a smooth bowl with one
minimum (convex). You always reach the best answer.

But for neural networks, the landscape has many valleys:

```
A non-convex loss landscape:

    Loss
     │\        .
     │ \      / \       /\
     │  \    /   \     /  \
     │   \  /     \   /    \.
     │    \/       \_/       ← GLOBAL minimum (the best)
     │     ↑
     │   LOCAL minimum
     │   (not the best, but gradient descent
     │    might stop here)
     └──────────────────────── parameter

If you start on the left side, you roll into the local minimum.
If you start on the right side, you roll into the global minimum.
Where you start (initialization) matters.
```

In practice, for deep networks, local minima are not as bad as they
sound. Most local minima are nearly as good as the global minimum.
The bigger problem is **saddle points** (flat regions where the gradient
is near zero but you are not at a minimum).

---

## Stochastic Gradient Descent (SGD)

Regular gradient descent computes the gradient using ALL data points.
With millions of examples, that is slow.

```
Batch Gradient Descent:
  Use ALL 1,000,000 examples to compute ONE gradient update.
  Accurate but slow.

Stochastic Gradient Descent (SGD):
  Use ONE random example to compute one gradient update.
  Noisy but fast.

Mini-batch Gradient Descent:
  Use a small batch (32-256 examples) to compute one gradient update.
  Best of both worlds. This is what everyone actually uses.
```

```
         Batch GD              SGD                Mini-batch
         (all data)          (1 example)          (32 examples)

Path:    ────────→            /\/\/\/\→           ~~──~~──→
         (smooth)            (noisy)              (slightly noisy)

Speed:   slow per step       fast per step        fast per step
Accuracy: exact gradient     very noisy           good estimate
Used in:  small datasets     rarely alone         EVERYTHING
```

```python
import numpy as np

def mini_batch_gd(X, y, batch_size=32, learning_rate=0.01, epochs=100):
    n_samples = len(X)
    w = np.zeros(X.shape[1])
    b = 0.0
    losses = []

    for epoch in range(epochs):
        indices = np.random.permutation(n_samples)
        X_shuffled = X[indices]
        y_shuffled = y[indices]

        epoch_loss = 0
        n_batches = 0

        for start in range(0, n_samples, batch_size):
            end = min(start + batch_size, n_samples)
            X_batch = X_shuffled[start:end]
            y_batch = y_shuffled[start:end]

            predictions = X_batch @ w + b
            errors = y_batch - predictions

            dw = (-2 / len(X_batch)) * (X_batch.T @ errors)
            db = (-2 / len(X_batch)) * np.sum(errors)

            w = w - learning_rate * dw
            b = b - learning_rate * db

            epoch_loss += np.mean(errors ** 2)
            n_batches += 1

        losses.append(epoch_loss / n_batches)

        if epoch % 20 == 0:
            print(f"Epoch {epoch:3d}: loss={losses[-1]:.4f}")

    return w, b, losses

np.random.seed(42)
n = 1000
X = np.random.randn(n, 3)
true_w = np.array([2.0, -1.0, 3.0])
y = X @ true_w + 5.0 + np.random.randn(n) * 0.5

w, b, losses = mini_batch_gd(X, y, batch_size=32, learning_rate=0.01, epochs=200)
print(f"\nLearned weights: {w}")
print(f"True weights:    {true_w}")
print(f"Learned bias:    {b:.4f} (true: 5.0)")
```

---

## Why the Noise in SGD Actually Helps

The noise from using random mini-batches is not just a necessary evil.
It actually helps in two ways:

```
1. Escaping local minima:

    Batch GD:                    SGD:

    Loss                         Loss
     │    \/                      │    \/
     │    stuck!                  │    /\  ← noise kicks it out
     │                            │   /  \___
     │         \_                 │         \_  ← finds better minimum
     └─────────── param           └─────────── param

2. Regularization effect:

The noise prevents the model from fitting the training data TOO perfectly.
This actually helps generalization (reduces overfitting).
```

---

## Learning Rate Schedules

Instead of keeping the learning rate fixed, you can decrease it over time:

```
Start with big steps (explore broadly)
End with small steps (fine-tune the position)

Like searching for your keys:
  First: walk around the room quickly (big steps)
  Then: carefully check under cushions (small steps)
```

```python
def lr_schedule(initial_lr, epoch, decay=0.95):
    return initial_lr * (decay ** epoch)

for epoch in [0, 10, 20, 50, 100]:
    lr = lr_schedule(0.01, epoch)
    print(f"Epoch {epoch:3d}: lr = {lr:.6f}")

# Epoch   0: lr = 0.010000
# Epoch  10: lr = 0.005987
# Epoch  20: lr = 0.003585
# Epoch  50: lr = 0.000769
# Epoch 100: lr = 0.000059
```

---

## Putting It All Together

```
The full training loop:

┌──────────────────────────────────────────────┐
│  1. Initialize parameters (random w, b=0)    │
│  2. Pick a mini-batch of training data       │
│  3. Forward pass: compute predictions        │
│  4. Compute loss (how wrong are we?)         │
│  5. Backward pass: compute gradients         │
│  6. Update parameters: p = p - lr * gradient │
│  7. Repeat 2-6 until loss converges          │
└──────────────────────────────────────────────┘

Every ML framework — PyTorch, TensorFlow, JAX — does exactly this.
The differences are in how they compute gradients (automatic
differentiation) and what optimizers they use (Adam, RMSProp, etc.).
```

---

## Exercises

### Exercise 1: Learning Rate Experiment

```python
import numpy as np

np.random.seed(42)
X = np.linspace(0, 10, 100)
y = 2.5 * X + 4 + np.random.randn(100) * 1.5

# TODO: run gradient descent with these learning rates: 0.0001, 0.001, 0.01, 0.1
# TODO: for each, record the loss at every epoch for 200 epochs
# TODO: plot all four loss curves on the same chart
# TODO: which learning rate converges fastest?
# TODO: does any learning rate diverge (loss goes to infinity)?
```

### Exercise 2: Gradient Descent vs Closed-Form

```python
np.random.seed(42)
X = np.random.randn(100, 5)
true_w = np.array([1, -2, 3, -4, 5])
y = X @ true_w + 10 + np.random.randn(100) * 0.5

# TODO: find weights using closed-form (np.linalg.lstsq)
# TODO: find weights using gradient descent (your implementation)
# TODO: compare the results — how close are they?
# TODO: which is faster for 100 data points?
# TODO: try with 100,000 data points — which scales better?
```

### Exercise 3: Implement Mini-Batch SGD With Momentum

Momentum keeps a running average of past gradients to smooth out noise:

```
velocity = momentum * velocity + gradient
parameter = parameter - learning_rate * velocity

Think of a ball rolling down a hill:
without momentum: stops at every bump
with momentum: rolls past small bumps, reaches better valleys
```

```python
# TODO: modify the mini_batch_gd function to include momentum
# TODO: compare convergence with momentum=0 vs momentum=0.9
# TODO: plot both loss curves
```

### Exercise 4: Visualize the Descent Path

For a 2-parameter model (w and b), create a contour plot of the loss
surface and overlay the path that gradient descent takes:

```python
# TODO: create a grid of (w, b) values
# TODO: compute the loss at each grid point
# TODO: plot the contour lines
# TODO: run gradient descent and record (w, b) at each step
# TODO: plot the path on top of the contours
# TODO: try different starting points — do they all reach the same minimum?
```

---

Next: [Lesson 04: Classification](./04-classification.md)
