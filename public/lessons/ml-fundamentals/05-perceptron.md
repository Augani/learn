# Lesson 05: The Perceptron — A Single Artificial Neuron

Every neural network, no matter how large, is built from one
basic unit: the artificial neuron. Understand this one piece
and the rest is repetition and stacking.

---

## The Biological Neuron Analogy

Your brain has about 86 billion neurons. Each one works like this:

```
Biological neuron:

   Dendrites           Cell Body              Axon
   (inputs)            (processor)            (output)

 signal 1 ──→┐
              │
 signal 2 ──→├──→ [ add up signals ] ──→ fire? ──→ signal out
              │      if total > threshold → YES
 signal 3 ──→┘      if total < threshold → NO


Artificial neuron:

   Inputs              Processing              Output
   (features)          (computation)           (prediction)

 x₁ ──→(×w₁)──→┐
                 │
 x₂ ──→(×w₂)──→├──→ [ sum + bias ] ──→ activation ──→ output
                 │       z = Σ(xᵢwᵢ) + b    f(z)
 x₃ ──→(×w₃)──→┘
```

The key insight: each input is multiplied by a **weight** before being
added up. The weight determines how important that input is.

---

## Weights as Importance Dials

Think of each weight as a volume knob on a mixing board.

```
Audio mixing board analogy:

  Vocals    Guitar    Drums
  ┌──┐      ┌──┐     ┌──┐
  │  │      │  │     │  │
  │▓▓│ 0.8  │▓ │ 0.3 │▓▓│ 0.7    ← weights (volumes)
  │▓▓│      │▓ │     │▓▓│
  │▓▓│      │  │     │▓▓│
  └──┘      └──┘     └──┘

Final sound = 0.8 * Vocals + 0.3 * Guitar + 0.7 * Drums

High weight = "this input matters a lot"
Low weight  = "this input barely matters"
Zero weight = "ignore this input entirely"
Negative weight = "more of this input makes the output LESS likely"
```

```python
import numpy as np

inputs = np.array([0.9, 0.5, 0.8])    # vocals, guitar, drums
weights = np.array([0.8, 0.3, 0.7])   # importance of each

weighted_sum = np.dot(inputs, weights)  # 0.72 + 0.15 + 0.56 = 1.43
print(f"Weighted sum: {weighted_sum}")
```

---

## Bias: The Threshold Adjuster

The bias shifts the decision boundary. Without it, the neuron can only
make decisions that pass through the origin (0,0).

```
Think of a thermostat:

Without bias (threshold at 0):
  "Turn on heat if temperature signal > 0"
  This only works if 0 is the right threshold.

With bias = -68:
  "Turn on heat if temperature + (-68) > 0"
  Which means: "Turn on heat if temperature > 68°F"

The bias lets you set ANY threshold, not just zero.
```

```python
inputs = np.array([0.9, 0.5, 0.8])
weights = np.array([0.8, 0.3, 0.7])
bias = -1.0

z = np.dot(inputs, weights) + bias  # 1.43 + (-1.0) = 0.43
print(f"z = {z}")  # positive → "fire"
```

---

## Activation Functions: Why We Need Nonlinearity

After computing the weighted sum plus bias, we pass it through
an **activation function**. Without this, the entire network
would just be one big linear equation, no matter how many layers.

```
Why nonlinearity matters:

Linear function of a linear function is still linear:
  Layer 1: z₁ = w₁ * x + b₁
  Layer 2: z₂ = w₂ * z₁ + b₂ = w₂ * (w₁ * x + b₁) + b₂ = (w₂*w₁)*x + (w₂*b₁+b₂)

That is just another line! Adding layers does nothing.
You could replace the whole thing with a single line.

Nonlinear activation breaks this:
  Layer 1: a₁ = relu(w₁ * x + b₁)     ← nonlinear!
  Layer 2: a₂ = relu(w₂ * a₁ + b₂)    ← cannot simplify to one line

Now the network can learn curves, not just straight lines.
```

### The Most Common Activation Functions

#### ReLU (Rectified Linear Unit) — The Default Choice

```
relu(z) = max(0, z)

If z > 0: output = z     (pass through)
If z ≤ 0: output = 0     (block)

    output
      │      /
      │     /
      │    /
      │   /
      │──/───────── z
      │ 0
      │
      └──────────────

Like a one-way valve: flow passes through in one direction,
blocked in the other.
```

```python
def relu(z):
    return np.maximum(0, z)

z = np.array([-3, -1, 0, 1, 3])
print(relu(z))  # [0, 0, 0, 1, 3]
```

#### Sigmoid — For Binary Classification Output

```
sigmoid(z) = 1 / (1 + e^(-z))

    output
    1.0 │           ────
        │         /
    0.5 │────────x────
        │       /
    0.0 │──────
        └──────────────── z

Squishes any number to (0, 1).
Used in the output layer for binary classification.
```

#### Tanh — Like Sigmoid But Centered on Zero

```
tanh(z) = (e^z - e^(-z)) / (e^z + e^(-z))

    output
    1.0 │           ────
        │         /
    0.0 │────────x────
        │       /
   -1.0 │──────
        └──────────────── z

Range: (-1, 1) instead of (0, 1).
Centered at zero, which helps with training.
```

```python
def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))

z_values = np.linspace(-6, 6, 100)
relu_values = np.maximum(0, z_values)
sigmoid_values = sigmoid(z_values)
tanh_values = np.tanh(z_values)
```

### When to Use Which

```
Activation     Range      Best for                  Gotchas
──────────────────────────────────────────────────────────────
ReLU           [0, ∞)     Hidden layers (default)   "Dead neurons" at z<0
Sigmoid        (0, 1)     Binary output layer       Vanishing gradients
Tanh           (-1, 1)    Hidden layers (alt)       Vanishing gradients
Softmax        (0, 1)     Multi-class output        Not per-neuron
```

---

## A Single Neuron: The Complete Picture

```
                ┌─────────────────────────────────────┐
                │          SINGLE NEURON               │
                │                                      │
  x₁ ──(×w₁)──→│                                      │
                │──→ z = w₁x₁ + w₂x₂ + w₃x₃ + b     │
  x₂ ──(×w₂)──→│                                      │──→ a = f(z) ──→ output
                │──→ a = activation(z)                 │
  x₃ ──(×w₃)──→│                                      │
                │          bias: b                     │
                └─────────────────────────────────────┘

Step 1: weighted sum      z = w · x + b     (dot product + bias)
Step 2: activation        a = f(z)           (nonlinearity)
Step 3: output            the activated value IS the output
```

---

## Implementing a Perceptron From Scratch

```python
import numpy as np

class Perceptron:
    def __init__(self, n_features, activation="sigmoid"):
        self.weights = np.random.randn(n_features) * 0.1
        self.bias = 0.0
        self.activation = activation

    def _activate(self, z):
        if self.activation == "sigmoid":
            return 1 / (1 + np.exp(-np.clip(z, -500, 500)))
        elif self.activation == "relu":
            return np.maximum(0, z)
        elif self.activation == "step":
            return (z > 0).astype(float)
        return z

    def forward(self, X):
        z = X @ self.weights + self.bias
        return self._activate(z)

    def train(self, X, y, learning_rate=0.1, epochs=100):
        losses = []
        for epoch in range(epochs):
            predictions = self.forward(X)

            eps = 1e-15
            predictions_clipped = np.clip(predictions, eps, 1 - eps)
            loss = -np.mean(y * np.log(predictions_clipped) +
                           (1 - y) * np.log(1 - predictions_clipped))
            losses.append(loss)

            errors = predictions - y
            self.weights -= learning_rate * (X.T @ errors) / len(X)
            self.bias -= learning_rate * np.mean(errors)

            if epoch % 20 == 0:
                accuracy = np.mean((predictions > 0.5) == y)
                print(f"Epoch {epoch:3d}: loss={loss:.4f}, accuracy={accuracy:.2%}")

        return losses


np.random.seed(42)
n = 200
X_pos = np.random.randn(n // 2, 2) + np.array([2, 2])
X_neg = np.random.randn(n // 2, 2) + np.array([-1, -1])
X = np.vstack([X_pos, X_neg])
y = np.array([1] * (n // 2) + [0] * (n // 2))

shuffle = np.random.permutation(n)
X, y = X[shuffle], y[shuffle]

p = Perceptron(n_features=2)
losses = p.train(X, y, learning_rate=0.1, epochs=100)

print(f"\nWeights: {p.weights}")
print(f"Bias: {p.bias:.4f}")
```

---

## The AND/OR Problem: What One Neuron Can Learn

A single perceptron can learn any LINEARLY SEPARABLE problem.
That means it can draw a straight line to separate the two classes.

### AND Gate

```
AND truth table:

x₁   x₂   Output
 0    0      0
 0    1      0
 1    0      0
 1    1      1     ← only both 1 gives 1

  x₂
  1 │ ○       ●      ○ = output 0
    │              ● = output 1
    │ ╱────────
  0 │○    ○          A line can separate them!
    └─────────── x₁
    0         1
```

### OR Gate

```
OR truth table:

x₁   x₂   Output
 0    0      0
 0    1      1
 1    0      1
 1    1      1

  x₂
  1 │ ●       ●
    │──────╱
    │            A line can separate them!
  0 │○    ●
    └─────────── x₁
    0         1
```

```python
np.random.seed(42)

X_and = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
y_and = np.array([0, 0, 0, 1])

p_and = Perceptron(n_features=2)
p_and.train(X_and, y_and, learning_rate=1.0, epochs=200)
print("\nAND predictions:", (p_and.forward(X_and) > 0.5).astype(int))

X_or = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
y_or = np.array([0, 1, 1, 1])

p_or = Perceptron(n_features=2)
p_or.train(X_or, y_or, learning_rate=1.0, epochs=200)
print("OR predictions:", (p_or.forward(X_or) > 0.5).astype(int))
```

---

## The XOR Problem: Why We Need Multiple Neurons

XOR is the most important failure case. A single perceptron CANNOT learn it.

```
XOR truth table:

x₁   x₂   Output
 0    0      0
 0    1      1
 1    0      1
 1    1      0

  x₂
  1 │ ●       ○
    │
    │   NO straight line can
    │   separate ● from ○
  0 │ ○       ●
    └─────────── x₁
    0         1

The classes are diagonally opposite.
A single line cannot divide them.
```

```python
X_xor = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
y_xor = np.array([0, 1, 1, 0])

p_xor = Perceptron(n_features=2)
p_xor.train(X_xor, y_xor, learning_rate=1.0, epochs=500)
print("\nXOR predictions:", (p_xor.forward(X_xor) > 0.5).astype(int))
print("Expected:       [0 1 1 0]")
print("A single neuron CANNOT learn XOR.")
```

### How to Solve XOR: Multiple Neurons

```
XOR = (x₁ OR x₂) AND NOT (x₁ AND x₂)

We need TWO neurons in a hidden layer, then one output neuron:

    x₁ ──→ [Neuron A: OR]  ──→┐
    x₂ ──→ [Neuron B: NAND] ──→├──→ [Neuron C: AND] ──→ output
           (not-and)

Layer 1 transforms the input space:
  (0,0) → (0, 1) → class 0
  (0,1) → (1, 1) → class 1
  (1,0) → (1, 1) → class 1
  (1,1) → (1, 0) → class 0

Now the points ARE linearly separable in the transformed space!
Neuron C (AND) draws a line in this new space to separate them.
```

This is the fundamental insight that led to neural networks:
**stack multiple neurons in layers** so each layer transforms the
data into a space where the NEXT layer can work with it.

---

## The Perceptron Learning Algorithm: Historical Version

The original perceptron (1958, Frank Rosenblatt) used a simpler
update rule without gradient descent:

```
For each training example:
  1. Compute output = step(w · x + b)
  2. If correct: do nothing
  3. If wrong:
     - If predicted 0 but should be 1: w += x  (make weights more like this example)
     - If predicted 1 but should be 0: w -= x  (make weights less like this example)
```

```python
def perceptron_learning(X, y, epochs=100):
    w = np.zeros(X.shape[1])
    b = 0.0

    for epoch in range(epochs):
        errors = 0
        for xi, yi in zip(X, y):
            prediction = 1 if np.dot(w, xi) + b > 0 else 0
            error = yi - prediction
            if error != 0:
                w += error * xi
                b += error
                errors += 1
        if errors == 0:
            print(f"Converged at epoch {epoch}")
            break
    return w, b

w, b = perceptron_learning(X_and, y_and)
print(f"AND gate: w={w}, b={b}")
```

This is guaranteed to converge for linearly separable problems.
But it will loop forever on non-separable ones (like XOR).

---

## Summary: One Neuron Is Just the Beginning

```
What one neuron can do:
  ✓ Linear classification (AND, OR)
  ✓ Linear regression (with linear activation)
  ✓ Logistic regression (with sigmoid activation)

What one neuron CANNOT do:
  ✗ XOR or any non-linearly-separable problem
  ✗ Learn complex patterns
  ✗ Image recognition, language understanding, etc.

The solution: stack neurons into layers.
That is what the next lesson covers.
```

---

## Exercises

### Exercise 1: Learn All Logic Gates

```python
# TODO: train a perceptron for each gate:
#   AND:  [0,0]→0  [0,1]→0  [1,0]→0  [1,1]→1
#   OR:   [0,0]→0  [0,1]→1  [1,0]→1  [1,1]→1
#   NAND: [0,0]→1  [0,1]→1  [1,0]→1  [1,1]→0
#   NOR:  [0,0]→1  [0,1]→0  [1,0]→0  [1,1]→0

# Which converge? Which do not? Why?
```

### Exercise 2: Visualize Decision Boundaries

```python
# TODO: for each logic gate that converges, plot:
#   - The four data points (colored by class)
#   - The decision boundary line (where w·x + b = 0)
#   - The decision regions (shaded)
```

### Exercise 3: Solve XOR with a Hidden Layer

```python
# TODO: manually set weights for a 2-layer network that solves XOR:
#   Hidden layer: 2 neurons (one computes OR, one computes NAND)
#   Output layer: 1 neuron (computes AND of the hidden outputs)
#   Use step activation (threshold at 0.5)

# Hint: OR weights can be [1, 1] with bias -0.5
#        NAND weights can be [-1, -1] with bias 1.5
#        AND weights can be [1, 1] with bias -1.5

X_xor = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
y_xor = np.array([0, 1, 1, 0])

# TODO: implement the forward pass through both layers
# TODO: verify it produces [0, 1, 1, 0]
```

### Exercise 4: Compare Activation Functions

```python
np.random.seed(42)
X = np.random.randn(200, 2)
y = ((X[:, 0] > 0) & (X[:, 1] > 0)).astype(float)

# TODO: train three perceptrons on the same data, each with a
#       different activation: sigmoid, relu, step
# TODO: compare convergence speed (epochs to reach 90% accuracy)
# TODO: plot the loss curves on the same chart
# TODO: which activation works best for this problem? why?
```

---

Next: [Lesson 06: Neural Networks](./06-neural-networks.md)
