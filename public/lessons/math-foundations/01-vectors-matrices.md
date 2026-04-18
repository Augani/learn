# Lesson 01: Vectors and Matrices — The Language of Data

Every piece of data in machine learning lives inside a vector or a matrix.
An image is a matrix of pixel values. A word embedding is a vector of
numbers. A neural network's weights are matrices. If you understand
vectors and matrices, you understand the containers that hold everything
in ML.

---

## The Core Idea

A **vector** is a list of numbers. A **matrix** is a grid of numbers.
That is it.

**Analogy: Spreadsheets.** Think of a vector as a single row (or column)
in a spreadsheet. A matrix is the entire spreadsheet — rows and columns
of numbers.

```
A vector (shape: 3):

    ┌     ┐
    │  2  │
    │  5  │
    │ -1  │
    └     ┘

    Just a list: [2, 5, -1]
    "3-dimensional vector" = a list of 3 numbers


A matrix (shape: 2×3):

    ┌            ┐
    │  1   2   3 │   ← row 0
    │  4   5   6 │   ← row 1
    └            ┘
       ↑   ↑   ↑
      col col col
       0   1   2

    A grid: 2 rows, 3 columns
    "2×3 matrix" = 2 rows and 3 columns
```

---

## Shapes and Indexing

The **shape** of a vector or matrix tells you its dimensions.
This matters constantly in ML — shape mismatches are the #1 source
of bugs.

```
Shape examples:

    Vector: [2, 5, -1]           → shape: (3,)
    Row vector: [[2, 5, -1]]     → shape: (1, 3)
    Column vector: [[2],[5],[-1]] → shape: (3, 1)

    Matrix:  [[1, 2, 3],
              [4, 5, 6]]         → shape: (2, 3)

    3D Tensor: a stack of matrices → shape: (batch, rows, cols)
```

**Indexing** starts at 0 (like Python):

```
Matrix A (shape 2×3):

    ┌            ┐
    │  1   2   3 │
    │  4   5   6 │
    └            ┘

    A[0, 0] = 1    (row 0, col 0)
    A[0, 2] = 3    (row 0, col 2)
    A[1, 1] = 5    (row 1, col 1)
```

```python
import numpy as np

# Creating vectors
v = np.array([2, 5, -1])
print(f"Vector: {v}")
print(f"Shape:  {v.shape}")      # (3,)
print(f"v[0]:   {v[0]}")         # 2
print(f"v[2]:   {v[2]}")         # -1

# Creating matrices
A = np.array([[1, 2, 3],
              [4, 5, 6]])
print(f"\nMatrix:\n{A}")
print(f"Shape:  {A.shape}")      # (2, 3)
print(f"A[0,0]: {A[0, 0]}")     # 1
print(f"A[1,2]: {A[1, 2]}")     # 6

# Slicing — grab a whole row or column
print(f"\nRow 0:    {A[0, :]}")  # [1, 2, 3]
print(f"Column 1: {A[:, 1]}")   # [2, 5]
```

---

## Basic Vector Operations

Vectors support element-wise arithmetic and scaling:

```
Addition (element-wise):

    [2, 5, -1]  +  [1, 0, 3]  =  [3, 5, 2]

Scalar multiplication:

    3 × [2, 5, -1]  =  [6, 15, -3]

Element-wise multiplication (Hadamard product):

    [2, 5, -1]  *  [1, 0, 3]  =  [2, 0, -3]
```

```python
import numpy as np

a = np.array([2, 5, -1])
b = np.array([1, 0, 3])

# Addition
print(f"a + b = {a + b}")           # [3, 5, 2]

# Scalar multiplication
print(f"3 * a = {3 * a}")           # [6, 15, -3]

# Element-wise multiplication
print(f"a * b = {a * b}")           # [2, 0, -3]

# Magnitude (length) of a vector
magnitude = np.linalg.norm(a)
print(f"|a| = {magnitude:.4f}")     # 5.4772

# Unit vector (length = 1, same direction)
unit_a = a / np.linalg.norm(a)
print(f"unit(a) = {unit_a}")
print(f"|unit(a)| = {np.linalg.norm(unit_a):.4f}")  # 1.0
```

---

## Basic Matrix Operations

```
Matrix addition (element-wise, same shape required):

    ┌       ┐     ┌       ┐     ┌       ┐
    │ 1   2 │  +  │ 5   6 │  =  │ 6   8 │
    │ 3   4 │     │ 7   8 │     │ 10  12 │
    └       ┘     └       ┘     └       ┘

Scalar multiplication:

    2 × ┌       ┐  =  ┌        ┐
        │ 1   2 │     │  2   4 │
        │ 3   4 │     │  6   8 │
        └       ┘     └        ┘
```

```python
import numpy as np

A = np.array([[1, 2], [3, 4]])
B = np.array([[5, 6], [7, 8]])

print(f"A + B =\n{A + B}")
# [[ 6  8]
#  [10 12]]

print(f"\n2 * A =\n{2 * A}")
# [[2 4]
#  [6 8]]
```

---

## Special Matrices

A few matrix shapes come up constantly in ML:

```
Identity matrix (I):           Zero matrix:
┌         ┐                    ┌         ┐
│ 1  0  0 │                   │ 0  0  0 │
│ 0  1  0 │                   │ 0  0  0 │
│ 0  0  1 │                   │ 0  0  0 │
└         ┘                    └         ┘
A × I = A (does nothing)       A + 0 = A (does nothing)

Diagonal matrix:               Random matrix (common for initialization):
┌         ┐                    ┌                  ┐
│ 3  0  0 │                   │ 0.12  -0.45  0.78│
│ 0  7  0 │                   │-0.33   0.91  0.05│
│ 0  0  2 │                   │ 0.67  -0.22  0.44│
└         ┘                    └                  ┘
```

```python
import numpy as np

# Identity matrix
I = np.eye(3)
print(f"Identity:\n{I}")

# Zero matrix
Z = np.zeros((3, 3))
print(f"\nZeros:\n{Z}")

# Random matrix (used for weight initialization in neural nets)
W = np.random.randn(3, 3) * 0.01
print(f"\nRandom weights:\n{W}")
```

---

## Reshaping: Changing the Container

The same numbers can be arranged in different shapes. Reshaping is
something you do constantly in ML — flattening images, reshaping
batches, converting between row and column vectors.

```
Reshape (12 numbers, different arrangements):

    Shape (12,):    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

    Shape (3, 4):   ┌              ┐
                    │ 1  2   3   4 │
                    │ 5  6   7   8 │
                    │ 9  10  11  12│
                    └              ┘

    Shape (4, 3):   ┌           ┐
                    │ 1   2   3 │
                    │ 4   5   6 │
                    │ 7   8   9 │
                    │ 10  11  12│
                    └           ┘

    Shape (2, 2, 3): Two 2×3 matrices stacked
```

```python
import numpy as np

data = np.arange(1, 13)  # [1, 2, 3, ..., 12]
print(f"Original shape: {data.shape}")  # (12,)

# Reshape to 3×4
matrix_3x4 = data.reshape(3, 4)
print(f"\n3×4:\n{matrix_3x4}")

# Reshape to 4×3
matrix_4x3 = data.reshape(4, 3)
print(f"\n4×3:\n{matrix_4x3}")

# Flatten back to 1D
flat = matrix_3x4.flatten()
print(f"\nFlattened: {flat}")

# Use -1 to let NumPy figure out one dimension
auto = data.reshape(2, -1)  # 2 rows, NumPy figures out 6 columns
print(f"\nAuto reshape (2, -1):\n{auto}")
print(f"Shape: {auto.shape}")  # (2, 6)
```

---

## Connection to ML

**Embeddings are vectors.** When an LLM processes the word "cat", it
converts it to a vector like `[0.12, -0.45, 0.78, ..., 0.33]` with
hundreds or thousands of dimensions. Similar words have similar vectors.

**Weight matrices are matrices.** A neural network layer is essentially
a matrix multiplication: `output = input @ weights + bias`. The weights
matrix holds everything the network has learned.

```
Neural network layer as matrix operation:

    Input vector     Weight matrix      Output vector
    (4 features)     (4×3)              (3 features)

    ┌      ┐         ┌            ┐     ┌      ┐
    │ 0.5  │         │ w w w      │     │  ?   │
    │ 0.3  │    @    │ w w w      │  =  │  ?   │
    │ 0.8  │         │ w w w      │     │  ?   │
    │ 0.1  │         │ w w w      │     └      ┘
    └      ┘         └            ┘

    4 inputs → 3 outputs
    The weight matrix has 4 × 3 = 12 learnable parameters
```

```python
import numpy as np

# Simulating a neural network layer
np.random.seed(42)

input_vector = np.array([0.5, 0.3, 0.8, 0.1])  # 4 features
weights = np.random.randn(4, 3) * 0.01           # 4 inputs → 3 outputs
bias = np.zeros(3)

output = input_vector @ weights + bias
print(f"Input shape:  {input_vector.shape}")  # (4,)
print(f"Weight shape: {weights.shape}")       # (4, 3)
print(f"Output shape: {output.shape}")        # (3,)
print(f"Output: {output}")
print(f"Parameters in this layer: {weights.size + bias.size}")  # 15
```

---

## Exercises

### Exercise 1: Vector Operations

```python
import numpy as np

# Create two vectors
a = np.array([3, -1, 4, 1, 5])
b = np.array([2, 7, -1, 8, 2])

# TODO: compute a + b
# TODO: compute 2 * a - b
# TODO: compute the magnitude (length) of a
# TODO: compute the unit vector of b
# TODO: verify the unit vector has magnitude 1
```

### Exercise 2: Matrix Shapes and Reshaping

```python
import numpy as np

# A batch of 8 grayscale images, each 28×28 pixels
images = np.random.randn(8, 28, 28)

# TODO: what is the shape of images?
# TODO: flatten each image to a 1D vector (shape should be (8, 784))
# TODO: reshape back to (8, 28, 28) and verify it matches the original
# TODO: how many total numbers are in this batch?
```

### Exercise 3: Neural Network Weight Representation

```python
import numpy as np
np.random.seed(0)

# A simple 2-layer neural network:
#   Input: 784 features (flattened 28×28 image)
#   Hidden layer: 128 neurons
#   Output layer: 10 neurons (10 digit classes)

# TODO: create weight matrices W1 (784→128) and W2 (128→10)
#        with small random values (multiply by 0.01)
# TODO: create bias vectors b1 (128,) and b2 (10,) initialized to zeros
# TODO: compute the total number of parameters in this network
# TODO: simulate a forward pass: given a random input of shape (784,),
#        compute hidden = input @ W1 + b1, then output = hidden @ W2 + b2
# TODO: what are the shapes at each step?
```

---

Next: [Lesson 02: Dot Products and Similarity](./02-dot-products-similarity.md)
