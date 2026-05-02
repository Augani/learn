# Lesson 11: Gradient Descent Revisited

> **Analogy:** Blindfolded on a mountain — you can't see the
> bottom, but you CAN feel the slope under your feet. Take small
> steps downhill and you'll eventually reach the valley.

---

## The Algorithm

```
  Gradient Descent:

  1. Start at a random point (initialize weights randomly)
  2. Feel the slope (compute the gradient)
  3. Step downhill (subtract gradient * learning rate)
  4. Repeat until you stop improving

  w = w - lr * gradient(w)

  That's it. That's the whole algorithm.

  Blindfolded hiker:

       START
         *
          \       "I feel the ground sloping left...
           \       I'll step left."
            *
             \
              *    "Still sloping... keep going."
               \
                *  "Flat! I must be at the bottom."
               MINIMUM
```

---

## Learning Rate: Step Size Matters

```
  Too small:                Too large:              Just right:

  *                         *                       *
   .                         \                       \
    .                         \                       \
     .                         \                       *
      .                         *                       \
       .                       /  \                      *
        .                     /    *                      \
         .                   /      \                      *
          .                 *        *                    DONE
        (takes forever)   (bounces around)           (converges!)

  lr = 0.0001              lr = 2.0                lr = 0.01
  100k steps               never converges          50 steps
```

---

## Python: Learning Rate Comparison

```python
import numpy as np

def loss(w):
    return (w - 3)**2 + 1

def gradient(w):
    return 2 * (w - 3)

learning_rates = [0.001, 0.1, 0.5, 0.99, 1.01]

for lr in learning_rates:
    w = 10.0
    history = [w]
    for step in range(50):
        w = w - lr * gradient(w)
        history.append(w)

    converged = abs(w - 3) < 0.01
    print(f"lr={lr:<6} final_w={w:>10.4f} "
          f"loss={loss(w):>10.4f} "
          f"{'CONVERGED' if converged else 'FAILED'}")
```

---

## Stochastic Gradient Descent (SGD)

Computing the gradient over ALL data is expensive.
SGD uses a random SUBSET (mini-batch) each step.

```
  Full gradient descent:
  gradient = average over ALL 1,000,000 samples
  1 step = very accurate, very slow

  SGD (batch_size = 32):
  gradient = average over 32 random samples
  1 step = noisy, but fast!

  Loss over time:

  Full GD:        SGD:
     \               /\
      \             /  \/\
       \           /      \
        \         /   /\   \/\
         \_      /   /  \/    \_
           \__/ /   /          \__
                   /
  (smooth)        (noisy but gets there)
```

The noise in SGD actually HELPS — it can escape local minimums.

---

## Python: SGD vs Full GD

```python
import numpy as np

np.random.seed(42)

n_samples = 1000
X = np.random.randn(n_samples, 3)
true_w = np.array([2.0, -1.0, 0.5])
y = X @ true_w + np.random.randn(n_samples) * 0.1

def mse_loss(X, y, w):
    return np.mean((X @ w - y) ** 2)

def full_gradient(X, y, w):
    return 2 * X.T @ (X @ w - y) / len(y)

def sgd_gradient(X, y, w, batch_size=32):
    idx = np.random.choice(len(y), batch_size, replace=False)
    X_batch, y_batch = X[idx], y[idx]
    return 2 * X_batch.T @ (X_batch @ w - y_batch) / batch_size

w_full = np.zeros(3)
w_sgd = np.zeros(3)
lr = 0.01

for step in range(100):
    w_full -= lr * full_gradient(X, y, w_full)
    w_sgd -= lr * sgd_gradient(X, y, w_sgd)

print(f"True weights:     {true_w}")
print(f"Full GD weights:  {w_full.round(4)}")
print(f"SGD weights:      {w_sgd.round(4)}")
```

---

## Momentum: Rolling Downhill Faster

Plain SGD changes direction every step. Momentum adds inertia,
like a heavy ball rolling downhill.

```
  Without momentum:         With momentum:

     /\                        \
    /  \  /\                    \
   /    \/  \                    \
              \  /\               \
               \/  \               \
                    \_              \_

  (zig-zag path)           (smooth, faster path)

  velocity = beta * velocity + gradient
  w = w - lr * velocity

  beta = 0.9 means "remember 90% of previous direction"
```

---

## Python: Momentum

```python
import numpy as np

def rosenbrock(w):
    x, y = w
    return (1 - x)**2 + 100 * (y - x**2)**2

def rosenbrock_grad(w, h=1e-7):
    grad = np.zeros(2)
    for i in range(2):
        w_plus = w.copy()
        w_minus = w.copy()
        w_plus[i] += h
        w_minus[i] -= h
        grad[i] = (rosenbrock(w_plus) - rosenbrock(w_minus)) / (2*h)
    return grad

w_plain = np.array([-1.0, 1.0])
w_momentum = np.array([-1.0, 1.0])
velocity = np.zeros(2)
lr = 0.001
beta = 0.9

for step in range(2000):
    grad_p = rosenbrock_grad(w_plain)
    w_plain -= lr * grad_p

    grad_m = rosenbrock_grad(w_momentum)
    velocity = beta * velocity + grad_m
    w_momentum -= lr * velocity

print(f"Target: [1.0, 1.0]")
print(f"Plain SGD:  {w_plain.round(4)}, loss={rosenbrock(w_plain):.6f}")
print(f"Momentum:   {w_momentum.round(4)}, loss={rosenbrock(w_momentum):.6f}")
```

---

## Adam: The Default Optimizer

Adam combines momentum with adaptive learning rates per parameter.

```
  Adam keeps track of:
  - m: running average of gradients (momentum)
  - v: running average of squared gradients (scale)

  Parameters that get big gradients --> smaller steps
  Parameters that get small gradients --> bigger steps

  Like giving each weight its own personalized learning rate.

  +--------------------------------------------------+
  | Adam is the DEFAULT in almost all deep learning.  |
  | When in doubt, use Adam.                          |
  +--------------------------------------------------+
```

---

## Python: Adam from Scratch

```python
import numpy as np

def quadratic(w):
    return 0.5 * w[0]**2 + 5 * w[1]**2

def quadratic_grad(w):
    return np.array([w[0], 10 * w[1]])

def adam(grad_fn, w_init, lr=0.01, beta1=0.9, beta2=0.999,
         eps=1e-8, steps=1000):
    w = w_init.copy()
    m = np.zeros_like(w)
    v = np.zeros_like(w)

    for t in range(1, steps + 1):
        g = grad_fn(w)
        m = beta1 * m + (1 - beta1) * g
        v = beta2 * v + (1 - beta2) * g**2
        m_hat = m / (1 - beta1**t)
        v_hat = v / (1 - beta2**t)
        w = w - lr * m_hat / (np.sqrt(v_hat) + eps)

    return w

w_init = np.array([10.0, 10.0])
w_final = adam(quadratic_grad, w_init)
print(f"Start:  {w_init}, loss={quadratic(w_init):.4f}")
print(f"Final:  {w_final.round(6)}, loss={quadratic(w_final):.6f}")
```

---

## Local Minima and Saddle Points

```
  In high dimensions, saddle points are MORE common
  than local minima:

  Local minimum:       Saddle point:

       \    /              \  |  /
        \  /                \ | /
         \/                  \|/
     (trapped!)           ----*----
                             /|\
                            / | \

  In 2D: many local minima
  In 100D+: mostly saddle points (SGD noise helps escape!)

  Good news: in practice, most local minima in deep networks
  have similar loss to the global minimum.
```

---

## Learning Rate Schedules

```
  Start with a large lr, shrink it over time:

  lr
  ^
  |****
  |    ****
  |        ****
  |            ****
  |                ****
  |                    ********
  +-----------------------------> epoch

  Common schedules:
  - Step decay: halve lr every N epochs
  - Cosine annealing: smooth decrease following cosine curve
  - Warmup: start small, increase, then decrease
```

---

## Python: Learning Rate Schedule

```python
import numpy as np

def cosine_schedule(step, total_steps, lr_max=0.01, lr_min=1e-6):
    return lr_min + 0.5 * (lr_max - lr_min) * (
        1 + np.cos(np.pi * step / total_steps))

def warmup_cosine(step, total_steps, warmup_steps=100, lr_max=0.01):
    if step < warmup_steps:
        return lr_max * step / warmup_steps
    return cosine_schedule(step - warmup_steps,
                           total_steps - warmup_steps, lr_max)

total = 1000
print("Step | Cosine LR  | Warmup+Cosine LR")
print("-----+------------+-----------------")
for step in [0, 50, 100, 250, 500, 750, 999]:
    cos_lr = cosine_schedule(step, total)
    warm_lr = warmup_cosine(step, total)
    print(f"{step:4d} | {cos_lr:.6f}   | {warm_lr:.6f}")
```

---

## Optimizer Comparison

```
  +------------+------------------+----------------------------+
  | Optimizer  | Key Idea         | When to Use                |
  +------------+------------------+----------------------------+
  | SGD        | Basic, no frills | Simple problems, baselines |
  | SGD+Mom    | Add inertia      | When SGD zig-zags          |
  | Adam       | Adaptive per-w   | Default choice, always     |
  | AdamW      | Adam + weight    | Transformers, LLMs         |
  |            | decay fix        |                            |
  +------------+------------------+----------------------------+
```

---

## Key Takeaways

```
  +------------------------------------------------------+
  |  GD = w = w - lr * gradient (the whole algorithm)     |
  |  Learning rate too big = diverge, too small = slow     |
  |  SGD = use mini-batches for speed                      |
  |  Momentum = remember previous direction                |
  |  Adam = adaptive per-parameter learning rates          |
  |  LR schedules = start big, shrink over time            |
  |  When in doubt: Adam + cosine schedule                 |
  +------------------------------------------------------+
```

---

## Exercises

**Exercise 1:** Implement SGD with momentum from scratch. Compare
convergence on `f(w) = w[0]^2 + 100*w[1]^2` starting from (10,10).

**Exercise 2:** Implement a step-decay learning rate schedule that
halves the lr every 100 steps. Compare to constant lr on any
optimization problem.

**Exercise 3:** Train a simple linear regression `y = w*x + b`
using gradient descent on 100 random data points. Plot loss
over training steps.

**Exercise 4:** Implement Adam optimizer. Compare with plain SGD on
the Rosenbrock function `(1-x)^2 + 100(y-x^2)^2`.

**Exercise 5:** Demonstrate the effect of batch size on SGD noise.
Run SGD with batch sizes 1, 8, 32, 128, and full dataset.
Print the loss variance across 10 steps for each.

---

[Next: Lesson 12 - Automatic Differentiation ->](12-automatic-differentiation.md)
