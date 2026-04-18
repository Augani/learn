# Lesson 06: The Chain Rule and Backpropagation — How Gradients Flow Backward

Neural networks are composed functions — layer after layer stacked
together. The chain rule tells you how to compute the derivative of
composed functions. Backpropagation is just the chain rule applied
systematically from output to input. This is how every neural network
learns.

---

## The Core Idea: Chain Rule

When functions are composed (output of one feeds into the next), the
chain rule says: multiply the derivatives along the chain.

**Analogy: Domino chain.** If the first domino pushes the second twice
as hard, and the second pushes the third three times as hard, then the
first pushes the third 2 × 3 = 6 times as hard. Effects multiply
through the chain.

```
Composed function: f(g(x))

    x ──→ [g] ──→ g(x) ──→ [f] ──→ f(g(x))

Chain rule:
    d/dx f(g(x)) = f'(g(x)) × g'(x)

    "derivative of outer × derivative of inner"


Example: f(g(x)) where g(x) = 3x + 1, f(u) = u²

    d/dx (3x + 1)² = 2(3x + 1) × 3 = 6(3x + 1)
                      ↑              ↑
                   f'(g(x))        g'(x)
```

```python
import numpy as np

# Composed function: f(g(x)) = (3x + 1)²
def g(x):
    return 3 * x + 1

def f(u):
    return u ** 2

def composed(x):
    return f(g(x))

# Chain rule derivative: 2(3x+1) * 3 = 6(3x+1)
def composed_derivative(x):
    return 2 * g(x) * 3  # f'(g(x)) * g'(x)

# Verify numerically
x = 2.0
h = 1e-7
numerical = (composed(x + h) - composed(x - h)) / (2 * h)
analytical = composed_derivative(x)

print(f"Numerical:  {numerical:.6f}")
print(f"Analytical: {analytical:.6f}")
print(f"Match: {abs(numerical - analytical) < 1e-5}")
```

---

## Longer Chains

The chain rule extends to any number of composed functions:

```
h(g(f(x))):

    x ──→ [f] ──→ [g] ──→ [h] ──→ output

    d/dx h(g(f(x))) = h'(g(f(x))) × g'(f(x)) × f'(x)

    Multiply ALL the derivatives along the chain.


Neural network as a chain:

    input ──→ [Layer 1] ──→ [ReLU] ──→ [Layer 2] ──→ [ReLU] ──→ [Layer 3] ──→ loss

    ∂loss/∂W₁ = ∂loss/∂out₃ × ∂out₃/∂relu₂ × ∂relu₂/∂out₂ × ∂out₂/∂relu₁ × ∂relu₁/∂out₁ × ∂out₁/∂W₁

    Each × is the chain rule connecting one link to the next.
```

---

## Computational Graphs

A **computational graph** breaks a computation into individual
operations, making it easy to apply the chain rule.

```
Example: loss = (y - (w*x + b))²

Computational graph:

    w ──→ [×] ──→ wx ──→ [+] ──→ wx+b ──→ [-] ──→ y-(wx+b) ──→ [²] ──→ loss
    x ──↗              b ──↗           y ──↗

Forward pass (left to right): compute the output
Backward pass (right to left): compute the gradients

Backward pass:
    ∂loss/∂loss = 1
    ∂loss/∂(y-ŷ) = 2(y-ŷ)           (derivative of x²)
    ∂loss/∂ŷ = -2(y-ŷ)              (derivative of y-ŷ w.r.t. ŷ)
    ∂loss/∂w = -2(y-ŷ) × x          (derivative of wx+b w.r.t. w)
    ∂loss/∂b = -2(y-ŷ) × 1          (derivative of wx+b w.r.t. b)
```

```python
import numpy as np

# Forward pass
x = 2.0
y = 7.0
w = 1.5
b = 0.5

# Step by step
wx = w * x           # 3.0
wx_plus_b = wx + b   # 3.5
diff = y - wx_plus_b # 3.5
loss = diff ** 2     # 12.25

print(f"Forward pass:")
print(f"  wx = {wx}, wx+b = {wx_plus_b}, diff = {diff}, loss = {loss}")

# Backward pass (chain rule, right to left)
dloss_dloss = 1.0
dloss_ddiff = 2 * diff * dloss_dloss          # 7.0
dloss_dwxb = -1.0 * dloss_ddiff               # -7.0
dloss_dw = x * dloss_dwxb                     # -14.0
dloss_db = 1.0 * dloss_dwxb                   # -7.0

print(f"\nBackward pass:")
print(f"  ∂loss/∂w = {dloss_dw}")
print(f"  ∂loss/∂b = {dloss_db}")

# Verify numerically
h = 1e-7
numerical_dw = ((y - ((w+h)*x + b))**2 - (y - ((w-h)*x + b))**2) / (2*h)
numerical_db = ((y - (w*x + (b+h)))**2 - (y - (w*x + (b-h)))**2) / (2*h)
print(f"\nNumerical verification:")
print(f"  ∂loss/∂w ≈ {numerical_dw:.4f}")
print(f"  ∂loss/∂b ≈ {numerical_db:.4f}")
```

---

## Backpropagation: Chain Rule Applied to Networks

Backpropagation is just the chain rule applied systematically through
a neural network, from the loss back to each weight.

See [Track 7, Lesson 07: Backpropagation](../ml-fundamentals/07-backpropagation.md)
for the full neural network treatment.

```
2-layer network:

    Forward:
    x ──→ [W₁ @ x + b₁] ──→ [ReLU] ──→ [W₂ @ h + b₂] ──→ loss

    Backward (chain rule):
    ∂loss/∂W₂ = ∂loss/∂out × ∂out/∂W₂
    ∂loss/∂W₁ = ∂loss/∂out × ∂out/∂h × ∂h/∂relu × ∂relu/∂z₁ × ∂z₁/∂W₁

    The gradient "flows backward" through the network.

    ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐
    │  W₁  │───→│ ReLU │───→│  W₂  │───→│ Loss │
    └──────┘    └──────┘    └──────┘    └──────┘
        ↑           ↑           ↑           │
        │           │           │           │ ∂L/∂out
        │           │           └───────────┘
        │           │     ∂L/∂W₂ = ∂L/∂out × h
        │           └───────────────────────┘
        │     ∂L/∂h = ∂L/∂out × W₂
        └───────────────────────────────────┘
              ∂L/∂W₁ = ∂L/∂h × relu'(z₁) × x
```

```python
import numpy as np

def relu(x):
    return np.maximum(0, x)

def relu_derivative(x):
    return (x > 0).astype(float)

# Simple 2-layer network: 3 inputs → 4 hidden → 1 output
np.random.seed(42)
W1 = np.random.randn(3, 4) * 0.1
b1 = np.zeros(4)
W2 = np.random.randn(4, 1) * 0.1
b2 = np.zeros(1)

x = np.array([1.0, 0.5, -0.3])
y_true = np.array([1.0])

# === FORWARD PASS ===
z1 = x @ W1 + b1          # pre-activation (3,) @ (3,4) = (4,)
h1 = relu(z1)              # activation
z2 = h1 @ W2 + b2          # output (4,) @ (4,1) = (1,)
loss = np.mean((y_true - z2) ** 2)

print(f"Forward pass:")
print(f"  z1 shape: {z1.shape}, h1 shape: {h1.shape}")
print(f"  z2 shape: {z2.shape}, loss: {loss:.6f}")

# === BACKWARD PASS (chain rule) ===
# ∂loss/∂z2
dloss_dz2 = -2 * (y_true - z2)  # (1,)

# ∂loss/∂W2 = h1^T @ dloss_dz2
dloss_dW2 = h1.reshape(-1, 1) @ dloss_dz2.reshape(1, -1)  # (4,1)
dloss_db2 = dloss_dz2  # (1,)

# ∂loss/∂h1 = dloss_dz2 @ W2^T
dloss_dh1 = dloss_dz2 @ W2.T  # (4,)

# ∂loss/∂z1 = dloss_dh1 * relu'(z1)
dloss_dz1 = dloss_dh1 * relu_derivative(z1)  # (4,)

# ∂loss/∂W1 = x^T @ dloss_dz1
dloss_dW1 = x.reshape(-1, 1) @ dloss_dz1.reshape(1, -1)  # (3,4)
dloss_db1 = dloss_dz1  # (4,)

print(f"\nBackward pass:")
print(f"  ∂loss/∂W2 shape: {dloss_dW2.shape}")
print(f"  ∂loss/∂W1 shape: {dloss_dW1.shape}")

# === UPDATE WEIGHTS ===
lr = 0.01
W2 -= lr * dloss_dW2
b2 -= lr * dloss_db2
W1 -= lr * dloss_dW1
b1 -= lr * dloss_db1

# Check: did the loss decrease?
z1_new = x @ W1 + b1
h1_new = relu(z1_new)
z2_new = h1_new @ W2 + b2
loss_new = np.mean((y_true - z2_new) ** 2)
print(f"\nLoss before: {loss:.6f}")
print(f"Loss after:  {loss_new:.6f}")
print(f"Decreased:   {loss_new < loss}")
```

---

## Why Backprop Is Efficient

```
Naive approach: compute ∂loss/∂wᵢ separately for each of N weights
    → N forward passes
    → O(N²) total work for N weights

Backpropagation: one forward pass + one backward pass
    → computes ALL gradients at once
    → O(N) total work

For a network with 1 million weights:
    Naive:    1,000,000 forward passes
    Backprop: 2 passes (1 forward + 1 backward)

This is why backprop made deep learning practical.
```

---

## Exercises

### Exercise 1: Chain Rule by Hand

```python
import numpy as np

# f(x) = (2x + 3)³
# Compute f'(x) using the chain rule, then verify numerically

# TODO: identify the inner function g(x) = 2x + 3
# TODO: identify the outer function f(u) = u³
# TODO: apply chain rule: f'(x) = 3(2x+3)² × 2 = 6(2x+3)²
# TODO: evaluate at x = 1 (analytically and numerically)
# TODO: do they match?
```

### Exercise 2: Manual Backprop Through a Computation Graph

```python
import numpy as np

# Compute gradients for: loss = (a*b + c)²
# where a=2, b=3, c=1

a, b, c = 2.0, 3.0, 1.0

# TODO: draw the computation graph (on paper or in comments)
# TODO: forward pass: compute each intermediate value
# TODO: backward pass: compute ∂loss/∂a, ∂loss/∂b, ∂loss/∂c
# TODO: verify each gradient numerically
```

### Exercise 3: Backprop Through a 2-Layer Network

```python
import numpy as np
np.random.seed(0)

# Network: 2 inputs → 3 hidden (ReLU) → 1 output
# Loss: MSE

W1 = np.random.randn(2, 3) * 0.5
b1 = np.zeros(3)
W2 = np.random.randn(3, 1) * 0.5
b2 = np.zeros(1)

x = np.array([1.0, -0.5])
y_true = np.array([0.8])

# TODO: implement the forward pass
# TODO: implement the backward pass (compute all gradients)
# TODO: update all weights with learning_rate = 0.01
# TODO: run for 200 steps and print the loss every 50 steps
# TODO: does the network learn to output ~0.8?
```

---

Next: [Lesson 07: Probability and Distributions](./07-probability-distributions.md)
