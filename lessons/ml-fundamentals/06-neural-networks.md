# Lesson 06: Neural Networks — Layers of Neurons

A neural network is many perceptrons organized in layers, where each
layer transforms the data and passes its output to the next layer.
That is the entire architecture. No magic, just stacked linear
transformations with nonlinear activations in between.

---

## The Factory Assembly Line Analogy

Think of a factory that processes raw materials into finished products.

```
Raw           Station 1        Station 2        Station 3        Finished
Materials ──→ (Cut & Shape) ──→ (Assemble) ──→ (Paint & QC) ──→ Product

Each station:
  - Takes input from the previous station
  - Transforms it in a specific way
  - Passes output to the next station
  - Specializes in one type of transformation


Neural network:

Input       Hidden          Hidden          Output
Layer  ──→  Layer 1    ──→  Layer 2    ──→  Layer     ──→  Prediction

Each layer:
  - Takes input from the previous layer
  - Multiplies by weights, adds bias (linear)
  - Applies activation function (nonlinear)
  - Passes output to the next layer
  - Learns to extract specific features
```

---

## Network Architecture

```
A neural network with 2 hidden layers:

Input Layer        Hidden Layer 1      Hidden Layer 2      Output Layer
(3 neurons)        (4 neurons)         (4 neurons)         (1 neuron)

   x₁ ──────────→ h₁₁ ──────────→ h₂₁ ──────────→
                 ╲  ↑ ╲          ╲  ↑ ╲
   x₂ ──────────→ h₁₂ ──────────→ h₂₂ ──────────→  output
                 ╲  ↑ ╲          ╲  ↑ ╲
   x₃ ──────────→ h₁₃ ──────────→ h₂₃ ──────────→
                 ╲    ╲          ╲    ╲
                   h₁₄ ──────────→ h₂₄

Every neuron in one layer connects to EVERY neuron in the next layer.
Each connection has its own weight.
This is called a "fully connected" or "dense" network.

Connections:
  Input → Hidden 1:  3 × 4 = 12 weights + 4 biases = 16 parameters
  Hidden 1 → Hidden 2: 4 × 4 = 16 weights + 4 biases = 20 parameters
  Hidden 2 → Output: 4 × 1 = 4 weights + 1 bias = 5 parameters
  Total: 41 learnable parameters
```

Terminology:

```
Term            Meaning
──────────────────────────────────────────────────
Input layer     The raw features (not learned, just data)
Hidden layer    Any layer between input and output (where the magic happens)
Output layer    Final layer producing the prediction
Depth           Number of layers (more layers = "deeper")
Width           Number of neurons per layer
Architecture    The specific arrangement of layers and sizes
```

---

## The Forward Pass: Data Flows Through

The forward pass computes the output by sending data through each layer
in sequence. Each layer does the same two steps: linear transformation,
then activation.

```
Forward pass for one example, step by step:

Input: x = [0.5, 0.8, 0.2]

Layer 1:
  z₁ = W₁ @ x + b₁     ← matrix multiplication + bias
  a₁ = relu(z₁)         ← activation

Layer 2:
  z₂ = W₂ @ a₁ + b₂    ← uses output of layer 1 as input
  a₂ = relu(z₂)

Output layer:
  z₃ = W₃ @ a₂ + b₃
  output = sigmoid(z₃)  ← sigmoid for binary classification

Each layer's computation:

    ┌──────────────────────────────────────────┐
    │  input ──→ W @ input + b ──→ activation ──→ output  │
    │           (linear)         (nonlinear)              │
    └──────────────────────────────────────────┘
```

In matrix form:

```
Layer 1: a₁ = relu(W₁ @ x + b₁)

Where:
  x  = column vector of inputs          (3 × 1)
  W₁ = weight matrix                    (4 × 3)
  b₁ = bias vector                      (4 × 1)
  z₁ = W₁ @ x + b₁                     (4 × 1)
  a₁ = relu(z₁)                         (4 × 1)

  ┌              ┐   ┌     ┐   ┌     ┐     ┌     ┐
  │ w₁₁ w₁₂ w₁₃ │   │ x₁  │   │ b₁  │     │ a₁  │
  │ w₂₁ w₂₂ w₂₃ │ @ │ x₂  │ + │ b₂  │ ──→ │ a₂  │
  │ w₃₁ w₃₂ w₃₃ │   │ x₃  │   │ b₃  │     │ a₃  │
  │ w₄₁ w₄₂ w₄₃ │   └     ┘   │ b₄  │     │ a₄  │
  └              ┘              └     ┘     └     ┘
     W₁ (4×3)       x (3×1)    b₁ (4×1)   a₁ (4×1)
```

---

## Why Depth Matters: Hierarchical Feature Learning

Each layer learns to extract increasingly abstract features.

### The Image Recognition Example

```
Layer 1 learns:     Edges and simple patterns
    ─  │  ╱  ╲     horizontal, vertical, diagonal edges

Layer 2 learns:     Combinations of edges = shapes
    ○  □  △  ◇     circles, squares, triangles

Layer 3 learns:     Combinations of shapes = parts
    👁  👃  👄     eyes, noses, mouths (face parts)

Layer 4 learns:     Combinations of parts = objects
    🐱  🐶  👤    cat face, dog face, human face


Visual hierarchy:

Raw pixels ──→ Edges ──→ Shapes ──→ Parts ──→ Objects

    ░░██░░       ╱╲        △         👃        🐱
    ░████░      │  │       ○○        👁👁
    ██████  →   │  │   →   ─  →      👄   →   "cat"
    ░████░      │  │       ○○
    ░░██░░       ╲╱
```

Each layer cannot "see" the raw input. It only sees the output of
the previous layer. So it HAS to build on top of what earlier layers
discovered. This is why deeper networks learn more complex concepts.

---

## The Universal Approximation Theorem

A neural network with enough neurons in a single hidden layer can
approximate ANY continuous function to arbitrary precision.

```
In plain English:

"If you give me a function — any function — I can build a neural
 network that mimics it as closely as you want. I just need
 enough neurons."

This is like saying:
"With enough LEGO bricks, you can build any shape."

True, but:
- You might need billions of bricks (neurons)
- It says nothing about how to FIND the right configuration
- In practice, deeper networks work better than wider ones
```

```
One wide layer vs multiple deep layers:

Wide (1 hidden layer, 1000 neurons):
  Input ──→ [████████████████████████] ──→ Output
  Needs MANY neurons. Hard to train. Memorizes.

Deep (4 hidden layers, 50 neurons each):
  Input ──→ [████] ──→ [████] ──→ [████] ──→ [████] ──→ Output
  Fewer total neurons. Learns hierarchy. Generalizes better.

Same total parameters, but depth wins because it learns
compositional features.
```

---

## Implementing a Neural Network From Scratch

A complete, working neural network using only numpy.

```python
import numpy as np

class NeuralNetwork:
    def __init__(self, layer_sizes):
        self.weights = []
        self.biases = []

        for i in range(len(layer_sizes) - 1):
            fan_in = layer_sizes[i]
            fan_out = layer_sizes[i + 1]
            w = np.random.randn(fan_in, fan_out) * np.sqrt(2.0 / fan_in)
            b = np.zeros(fan_out)
            self.weights.append(w)
            self.biases.append(b)

    def relu(self, z):
        return np.maximum(0, z)

    def relu_derivative(self, z):
        return (z > 0).astype(float)

    def sigmoid(self, z):
        return 1 / (1 + np.exp(-np.clip(z, -500, 500)))

    def forward(self, X):
        self.activations = [X]
        self.z_values = []

        current = X
        for i in range(len(self.weights) - 1):
            z = current @ self.weights[i] + self.biases[i]
            self.z_values.append(z)
            current = self.relu(z)
            self.activations.append(current)

        z_final = current @ self.weights[-1] + self.biases[-1]
        self.z_values.append(z_final)
        output = self.sigmoid(z_final)
        self.activations.append(output)

        return output

    def backward(self, y):
        m = len(y)
        gradients_w = []
        gradients_b = []

        delta = self.activations[-1] - y.reshape(-1, 1)

        for i in range(len(self.weights) - 1, -1, -1):
            dw = (self.activations[i].T @ delta) / m
            db = np.mean(delta, axis=0)
            gradients_w.insert(0, dw)
            gradients_b.insert(0, db)

            if i > 0:
                delta = (delta @ self.weights[i].T) * self.relu_derivative(self.z_values[i - 1])

        return gradients_w, gradients_b

    def train(self, X, y, learning_rate=0.01, epochs=100, batch_size=32):
        losses = []
        n = len(X)

        for epoch in range(epochs):
            indices = np.random.permutation(n)
            X_shuffled = X[indices]
            y_shuffled = y[indices]

            epoch_loss = 0
            batches = 0

            for start in range(0, n, batch_size):
                end = min(start + batch_size, n)
                X_batch = X_shuffled[start:end]
                y_batch = y_shuffled[start:end]

                output = self.forward(X_batch)

                eps = 1e-15
                output_clipped = np.clip(output, eps, 1 - eps)
                y_col = y_batch.reshape(-1, 1)
                loss = -np.mean(y_col * np.log(output_clipped) +
                               (1 - y_col) * np.log(1 - output_clipped))
                epoch_loss += loss
                batches += 1

                grads_w, grads_b = self.backward(y_batch)

                for j in range(len(self.weights)):
                    self.weights[j] -= learning_rate * grads_w[j]
                    self.biases[j] -= learning_rate * grads_b[j]

            avg_loss = epoch_loss / batches
            losses.append(avg_loss)

            if epoch % (epochs // 10) == 0:
                preds = (self.forward(X) > 0.5).astype(int).flatten()
                accuracy = np.mean(preds == y)
                print(f"Epoch {epoch:4d}: loss={avg_loss:.4f}, accuracy={accuracy:.2%}")

        return losses

    def predict(self, X):
        return (self.forward(X) > 0.5).astype(int).flatten()
```

### Training on the XOR Problem

Remember: a single perceptron CANNOT learn XOR. A neural network can.

```python
np.random.seed(42)

X_xor = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
y_xor = np.array([0, 1, 1, 0], dtype=float)

X_train = np.tile(X_xor, (250, 1))
y_train = np.tile(y_xor, 250)

nn = NeuralNetwork([2, 8, 4, 1])

losses = nn.train(X_train, y_train, learning_rate=0.5, epochs=500, batch_size=32)

print("\nXOR predictions:")
for x, y_true in zip(X_xor, y_xor):
    pred = nn.forward(x.reshape(1, -1))[0, 0]
    print(f"  {x} → {pred:.4f} (expected {y_true})")
```

```
Architecture: [2, 8, 4, 1]

Input (2) → Hidden (8) → Hidden (4) → Output (1)

Layer 1: 2×8 = 16 weights + 8 biases = 24 params
Layer 2: 8×4 = 32 weights + 4 biases = 36 params
Layer 3: 4×1 = 4 weights + 1 bias = 5 params
Total: 65 parameters to learn XOR (4 data points)

This is overkill for XOR, but it demonstrates the architecture.
A [2, 4, 1] network would also work.
```

---

## Backpropagation: How Gradients Flow Backward

The backward pass is how the network figures out which weights
need to change and by how much. It propagates the error backward
through the layers using the chain rule from calculus.

```
Forward pass (left to right):
  Input → Layer 1 → Layer 2 → Output → Loss

Backward pass (right to left):
  Loss → ∂/∂Output → ∂/∂Layer2 → ∂/∂Layer1 → weight updates

Think of it like tracing blame:

"The prediction was wrong by 0.3."
"How much did the output layer contribute?" → adjust output weights
"How much did hidden layer 2 contribute?"   → adjust layer 2 weights
"How much did hidden layer 1 contribute?"   → adjust layer 1 weights

Each layer's adjustment is proportional to its contribution to the error.
```

```
The chain rule in action:

∂Loss     ∂Loss    ∂output    ∂z₃
───── = ─────── × ──────── × ────
∂w₂      ∂output    ∂z₃      ∂w₂

Each step answers: "if I change this variable slightly,
how much does the next variable change?"

Multiply them all together to get:
"if I change this weight slightly, how much does the loss change?"
```

You do NOT need to derive these formulas yourself. Every ML framework
(PyTorch, TensorFlow, JAX) computes gradients automatically using
a technique called **automatic differentiation**. But understanding
that gradients flow backward through the network helps you debug
training problems.

---

## Matrix Operations: Why GPUs Matter

The core computation of a neural network layer is a matrix multiplication:

```
z = W @ x + b

For one example: W is (hidden × input) @ x is (input × 1)
For a batch of 32: W is (hidden × input) @ X is (input × 32)

The second case does 32 examples AT THE SAME TIME.
Same number of operations, but done in parallel.
```

```
CPU vs GPU:

CPU (4-16 cores):                 GPU (thousands of cores):

Core 1: example 1                 Core 1:    example 1
Core 2: example 2                 Core 2:    example 2
Core 3: example 3                 Core 3:    example 3
Core 4: example 4                 Core 4:    example 4
   ...wait...                     Core 5:    example 5
Core 1: example 5                 ...
Core 2: example 6                 Core 32:   example 32
   ...                            Core 33:   example 33
                                  ...
Total: 8 rounds for 32 examples   Core 1000: ...

                                  Total: 1 round for 32+ examples
```

Matrix multiplication is "embarrassingly parallel" — every element
of the result can be computed independently. GPUs have thousands of
simple cores designed exactly for this kind of work. That is why
ML training uses GPUs: a forward pass through a large network is
just a chain of matrix multiplications, and GPUs do those 10-100x
faster than CPUs.

```python
import numpy as np
import time

A = np.random.randn(1000, 1000)
B = np.random.randn(1000, 1000)

start = time.time()
for _ in range(100):
    C = A @ B
elapsed = time.time() - start
print(f"100 matrix multiplications (1000x1000): {elapsed:.2f}s")
print(f"Per multiplication: {elapsed*10:.2f}ms")
```

---

## A Larger Example: Classifying Circles

A problem that linear models CANNOT solve: data arranged in concentric circles.

```
Outer circle = class 1
Inner circle = class 0

    . . . . .
  .   .     .   .
 .  ○ ○ ○ ○  .
 . ○         ○ .
 . ○    .    ○ .        . = class 1 (outer)
 . ○         ○ .        ○ = class 0 (inner)
 .  ○ ○ ○ ○  .
  .           .
    . . . . .

No straight line can separate them.
A neural network with hidden layers can.
```

```python
np.random.seed(42)

n = 500
theta = np.random.uniform(0, 2 * np.pi, n)
r_inner = np.random.uniform(0, 1, n // 2)
r_outer = np.random.uniform(1.5, 2.5, n // 2)

X_inner = np.column_stack([r_inner * np.cos(theta[:n//2]),
                            r_inner * np.sin(theta[:n//2])])
X_outer = np.column_stack([r_outer * np.cos(theta[n//2:]),
                            r_outer * np.sin(theta[n//2:])])

X = np.vstack([X_inner, X_outer])
y = np.array([0] * (n // 2) + [1] * (n // 2))

shuffle = np.random.permutation(n)
X, y = X[shuffle], y[shuffle]

split = int(0.8 * n)
X_train, X_test = X[:split], X[split:]
y_train, y_test = y[:split], y[split:]

nn = NeuralNetwork([2, 16, 8, 1])
losses = nn.train(X_train, y_train, learning_rate=0.1, epochs=300, batch_size=32)

test_preds = nn.predict(X_test)
test_accuracy = np.mean(test_preds == y_test)
print(f"\nTest accuracy: {test_accuracy:.2%}")
```

---

## Common Architectures in Practice

```
Task                  Input → Architecture → Output
────────────────────────────────────────────────────────────
Binary classification   n features → [n, 64, 32, 1]     sigmoid
Multi-class (10)        n features → [n, 128, 64, 10]   softmax
Regression              n features → [n, 64, 32, 1]     linear (no activation)
Image classification    784 pixels → [784, 256, 128, 10] softmax
Sentiment analysis      vocab_size → [embedding, 128, 2] softmax

Rules of thumb:
- Start simple. Add complexity if needed.
- Hidden layers: 1-3 is usually enough for tabular data
- Width: 32-256 neurons per layer for most problems
- Deeper is not always better (harder to train)
- More data → can afford more parameters
```

---

## What We Built vs What Frameworks Provide

```
From scratch (this lesson):         With PyTorch:
─────────────────────────           ───────────────────
Manual weight initialization        torch.nn.Linear
Manual forward pass                  model(x)
Manual backward pass                 loss.backward()
Manual gradient descent              optimizer.step()
Manual batching                      DataLoader
Manual loss computation              torch.nn.BCELoss

The concepts are IDENTICAL.
Frameworks just automate the tedious parts.

What frameworks add:
- Automatic differentiation (no manual gradient math)
- GPU acceleration (move tensors to GPU with .cuda())
- Optimizers (Adam, RMSProp — better than plain SGD)
- Regularization (dropout, batch normalization)
- Model saving/loading
- Distributed training across multiple GPUs
```

---

## Exercises

### Exercise 1: XOR With Different Architectures

```python
# TODO: try solving XOR with each architecture:
#   [2, 2, 1]    — minimum possible
#   [2, 4, 1]    — slightly larger
#   [2, 8, 4, 1] — deeper
#   [2, 16, 1]   — wider single hidden layer
#
# For each:
#   - Does it converge? How many epochs?
#   - What is the final accuracy?
#   - Run each 5 times with different seeds — how consistent is it?
```

### Exercise 2: Decision Boundary Visualization

```python
# TODO: using the circles dataset and a trained network:
#   1. Create a grid of points covering the feature space
#   2. Run each grid point through the network
#   3. Plot the decision boundary using plt.contourf
#   4. Overlay the actual data points
#   5. Compare with what a logistic regression boundary would look like
```

### Exercise 3: Build a Multi-Class Network

```python
# TODO: modify the NeuralNetwork class to support multi-class classification:
#   - Change the output layer to use softmax instead of sigmoid
#   - Change the loss to cross-entropy for multiple classes
#   - Use one-hot encoding for the labels
#   - Test on a 3-class or 4-class dataset
#
# Generate a spiral dataset:
np.random.seed(42)
n_classes = 3
n_per_class = 200
X_spiral = []
y_spiral = []
for c in range(n_classes):
    theta = np.linspace(c * 4, (c + 1) * 4, n_per_class) + np.random.randn(n_per_class) * 0.2
    r = np.linspace(0.5, 2.5, n_per_class)
    X_spiral.append(np.column_stack([r * np.cos(theta), r * np.sin(theta)]))
    y_spiral.extend([c] * n_per_class)
X_spiral = np.vstack(X_spiral)
y_spiral = np.array(y_spiral)
```

### Exercise 4: The Effect of Depth and Width

```python
# TODO: on the circles dataset, systematically compare:
#   Depth experiment (fixed total params ~200):
#     [2, 200, 1]          — 1 hidden layer, wide
#     [2, 14, 14, 1]       — 2 hidden layers
#     [2, 8, 8, 8, 1]      — 3 hidden layers
#     [2, 6, 6, 6, 6, 1]   — 4 hidden layers
#
#   Width experiment (fixed depth = 2 hidden layers):
#     [2, 4, 4, 1]         — narrow
#     [2, 16, 16, 1]       — medium
#     [2, 64, 64, 1]       — wide
#     [2, 256, 256, 1]     — very wide
#
# Plot training curves for all. Which converge fastest?
# Which achieve the highest test accuracy?
# Do any overfit (train accuracy >> test accuracy)?
```

---

Next lesson: Backpropagation and training deep networks.
