# Lesson 03: Matrix Multiplication — The Engine of Neural Networks

Matrix multiplication is the single most expensive operation in deep
learning. Every forward pass through a neural network, every attention
computation in a transformer, every embedding lookup — they all boil
down to matrix multiplication. Understanding it is understanding the
engine that powers ML.

---

## The Core Idea

Matrix multiplication takes two matrices and produces a new one.
Each element in the result is a **dot product** between a row of the
first matrix and a column of the second.

**Analogy: Assembly line.** Imagine a factory where each worker (row)
has a set of skills, and each job (column) requires certain skills.
The output tells you how well each worker matches each job — computed
by multiplying skills against requirements and summing up.

```
Matrix multiplication (2×3) @ (3×2) = (2×2):

    A (2×3)          B (3×2)          C (2×2)
    ┌         ┐      ┌      ┐        ┌         ┐
    │ 1  2  3 │  @   │ 7  8 │   =    │ 58   64 │
    │ 4  5  6 │      │ 9 10 │        │139  154 │
    └         ┘      │11 12 │        └         ┘
                     └      ┘

    C[0,0] = row 0 of A · col 0 of B
           = 1×7 + 2×9 + 3×11 = 7 + 18 + 33 = 58

    C[0,1] = row 0 of A · col 1 of B
           = 1×8 + 2×10 + 3×12 = 8 + 20 + 36 = 64

    C[1,0] = row 1 of A · col 0 of B
           = 4×7 + 5×9 + 6×11 = 28 + 45 + 66 = 139

    C[1,1] = row 1 of A · col 1 of B
           = 4×8 + 5×10 + 6×12 = 32 + 50 + 72 = 154
```

---

## The Dimension Rule

The inner dimensions must match. The outer dimensions give the result shape.

```
    (m × k) @ (k × n) = (m × n)
         ↑       ↑
         └───┬───┘
         must match!

Examples:
    (2 × 3) @ (3 × 4) = (2 × 4)  ✓  inner = 3
    (5 × 2) @ (2 × 7) = (5 × 7)  ✓  inner = 2
    (3 × 4) @ (2 × 5) = ERROR     ✗  4 ≠ 2

Think of it as:
    (rows_A × cols_A) @ (rows_B × cols_B) = (rows_A × cols_B)
    cols_A must equal rows_B
```

```python
import numpy as np

A = np.array([[1, 2, 3],
              [4, 5, 6]])     # shape (2, 3)

B = np.array([[7, 8],
              [9, 10],
              [11, 12]])      # shape (3, 2)

# Matrix multiplication with @ operator
C = A @ B                     # shape (2, 2)
print(f"A shape: {A.shape}")  # (2, 3)
print(f"B shape: {B.shape}")  # (3, 2)
print(f"C shape: {C.shape}")  # (2, 2)
print(f"C =\n{C}")
# [[ 58  64]
#  [139 154]]

# This would fail — inner dimensions don't match:
# D = np.array([[1, 2], [3, 4]])  # shape (2, 2)
# A @ D  # ERROR: (2,3) @ (2,2) — 3 ≠ 2
```

---

## Matrix-Vector Multiplication

A special case: multiplying a matrix by a vector. This is what a
neural network layer does.

```
Matrix-vector multiplication:

    W (3×4)              x (4,)           y (3,)
    ┌              ┐     ┌   ┐           ┌     ┐
    │ w w w w      │     │ x │           │  y  │
    │ w w w w      │  @  │ x │     =     │  y  │
    │ w w w w      │     │ x │           │  y  │
    └              ┘     │ x │           └     ┘
                         └   ┘

    Each output element = dot product of one row of W with x
    y[0] = W[0,:] · x
    y[1] = W[1,:] · x
    y[2] = W[2,:] · x
```

```python
import numpy as np
np.random.seed(42)

# Neural network layer: 4 inputs → 3 outputs
W = np.random.randn(3, 4) * 0.1   # weight matrix
x = np.array([1.0, 0.5, -0.3, 0.8])  # input vector
b = np.zeros(3)                     # bias

# Forward pass through one layer
y = W @ x + b
print(f"Input shape:  {x.shape}")   # (4,)
print(f"Weight shape: {W.shape}")   # (3, 4)
print(f"Output shape: {y.shape}")   # (3,)
print(f"Output: {y}")
```

---

## Batch Operations

In practice, you process many inputs at once (a batch). This turns
the vector into a matrix, and the operation becomes matrix-matrix
multiplication.

```
Single input:     x (4,)    @ W.T (4×3) = y (3,)
Batch of 32:      X (32×4)  @ W.T (4×3) = Y (32×3)

    X (batch × features)    W.T (features × outputs)    Y (batch × outputs)
    ┌──────────────┐        ┌──────────┐                ┌──────────┐
    │ x₁ x₁ x₁ x₁│        │ w  w  w  │                │ y₁ y₁ y₁│
    │ x₂ x₂ x₂ x₂│   @    │ w  w  w  │       =        │ y₂ y₂ y₂│
    │ ...          │        │ w  w  w  │                │ ...      │
    │ x₃₂ ...     │        │ w  w  w  │                │ y₃₂ ... │
    └──────────────┘        └──────────┘                └──────────┘
      32 × 4                  4 × 3                       32 × 3

    All 32 inputs processed simultaneously!
    This is why GPUs are fast — they do this in parallel.
```

```python
import numpy as np
np.random.seed(42)

# Batch of 32 inputs, each with 4 features
batch_size = 32
X = np.random.randn(batch_size, 4)

# Weight matrix: 4 inputs → 3 outputs
W = np.random.randn(4, 3) * 0.1
b = np.zeros(3)

# Forward pass for the entire batch at once
Y = X @ W + b
print(f"Batch input shape:  {X.shape}")   # (32, 4)
print(f"Weight shape:       {W.shape}")   # (4, 3)
print(f"Batch output shape: {Y.shape}")   # (32, 3)
```

---

## Connection to ML

### Neural Network Forward Pass

A neural network is just stacked matrix multiplications with
nonlinearities (activation functions) in between:

```
Forward pass through a 3-layer network:

    Input (784)
        │
        ▼
    [  X @ W1 + b1  ]  →  ReLU  →  hidden1 (256)
        │
        ▼
    [ h1 @ W2 + b2  ]  →  ReLU  →  hidden2 (128)
        │
        ▼
    [ h2 @ W3 + b3  ]  →  softmax → output (10)

    Each arrow is a matrix multiplication.
    The entire network is: matmul → activate → matmul → activate → matmul
```

```python
import numpy as np

def relu(x):
    return np.maximum(0, x)

def softmax(x):
    exp_x = np.exp(x - np.max(x))
    return exp_x / exp_x.sum()

np.random.seed(42)

# Network architecture: 784 → 256 → 128 → 10
W1 = np.random.randn(784, 256) * 0.01
b1 = np.zeros(256)
W2 = np.random.randn(256, 128) * 0.01
b2 = np.zeros(128)
W3 = np.random.randn(128, 10) * 0.01
b3 = np.zeros(10)

# Forward pass
x = np.random.randn(784)          # one flattened 28×28 image

h1 = relu(x @ W1 + b1)            # (784,) @ (784,256) = (256,)
h2 = relu(h1 @ W2 + b2)           # (256,) @ (256,128) = (128,)
output = softmax(h2 @ W3 + b3)    # (128,) @ (128,10)  = (10,)

print(f"Input:   {x.shape}")       # (784,)
print(f"Hidden1: {h1.shape}")      # (256,)
print(f"Hidden2: {h2.shape}")      # (128,)
print(f"Output:  {output.shape}")  # (10,)
print(f"Predictions sum to: {output.sum():.4f}")  # 1.0
print(f"Predicted class: {output.argmax()}")

total_params = W1.size + b1.size + W2.size + b2.size + W3.size + b3.size
print(f"Total parameters: {total_params:,}")  # 235,146
```

### Attention Computation

The attention mechanism in transformers is fundamentally matrix
multiplication: `Attention(Q, K, V) = softmax(Q @ K.T / √d) @ V`.
See [Track 8, Lesson 05: Self-Attention](../llms-transformers/05-self-attention.md).

---

## Exercises

### Exercise 1: Matrix Multiplication by Hand

```python
import numpy as np

A = np.array([[1, 2],
              [3, 4],
              [5, 6]])   # shape (3, 2)

B = np.array([[7, 8, 9],
              [10, 11, 12]])  # shape (2, 3)

# TODO: compute A @ B by hand (on paper), then verify with NumPy
# TODO: what is the shape of the result?
# TODO: can you compute B @ A? What shape would that be?
# TODO: is A @ B the same as B @ A? (matrix multiplication is NOT commutative)
```

### Exercise 2: Implement Matrix Multiplication From Scratch

```python
import numpy as np

def matmul(A, B):
    """Multiply two matrices without using np.dot or @."""
    rows_A, cols_A = A.shape
    rows_B, cols_B = B.shape
    assert cols_A == rows_B, f"Shape mismatch: {A.shape} @ {B.shape}"

    # TODO: create a result matrix of zeros with shape (rows_A, cols_B)
    # TODO: fill in each element using the row-dot-column rule
    #        C[i, j] = sum of A[i, k] * B[k, j] for all k
    # TODO: return the result
    pass

# Test your implementation
A = np.random.randn(3, 4)
B = np.random.randn(4, 5)
result = matmul(A, B)
expected = A @ B
print(f"Match: {np.allclose(result, expected)}")  # Should be True
```

### Exercise 3: Forward Pass Is Just Matrix Multiplication

```python
import numpy as np
np.random.seed(42)

# Build a 2-layer network and run a forward pass
# Architecture: 10 inputs → 5 hidden → 3 outputs

# TODO: create weight matrices and bias vectors
# TODO: create a random input vector of shape (10,)
# TODO: compute the forward pass:
#        hidden = relu(input @ W1 + b1)
#        output = input @ W2 + b2
# TODO: print shapes at each step
# TODO: how many total parameters does this network have?
# TODO: now run a batch of 16 inputs — what changes?
```

---

Next: [Lesson 04: Transpose, Eigenvalues, and Decomposition](./04-transpose-eigenvalues.md)
