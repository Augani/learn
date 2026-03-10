# Lesson 03: Matrices

> **Analogy:** Spreadsheets on steroids — rows and columns of numbers
> that can transform data.

---

## What Is a Matrix?

A matrix is a grid of numbers. That's it. Rows and columns.

```
  A spreadsheet:

  Name     Math  Science  English
  Alice     90      85       92
  Bob       78      88       75
  Charlie   95      92       88

  As a matrix (just the numbers):

       [ 90  85  92 ]
  A =  [ 78  88  75 ]      <-- 3x3 matrix
       [ 95  92  88 ]          (3 rows, 3 columns)
```

Think of it as a spreadsheet where you dropped the headers
and kept only the numbers.

---

## Matrix Dimensions

```
  Rows x Columns = "Shape"

       col1  col2  col3  col4
  row1 [  1     2     3     4 ]
  row2 [  5     6     7     8 ]
  row3 [  9    10    11    12 ]

  This is a 3x4 matrix (3 rows, 4 columns)
  Shape: (3, 4)
```

Convention: always say rows FIRST, columns SECOND.

---

## Where Matrices Show Up in AI

```
  +--------------------+-------------------------+
  | AI Concept         | Matrix Shape            |
  +--------------------+-------------------------+
  | Dataset            | (samples, features)     |
  | Image              | (height, width)         |
  | Weight layer       | (inputs, outputs)       |
  | Batch of vectors   | (batch_size, embed_dim) |
  | Attention scores   | (seq_len, seq_len)      |
  +--------------------+-------------------------+
```

A single neural network layer IS a matrix multiplication:

```
  input vector ---> [WEIGHT MATRIX] ---> output vector
     (1x768)          (768x512)           (1x512)
```

---

## Matrices as Transformations

A 2D matrix can rotate, scale, stretch, or skew vectors:

```
  ORIGINAL            SCALED (2x)          ROTATED 90 deg

      *                    *                 *
     /|                   /|                /
    / |                  / |               /
   /  |                 /  |              /
  *---+                *---+             +---*
                                         |  /
  Identity           Scale              |  /
  [1 0]              [2 0]             | /
  [0 1]              [0 2]             *
                                       Rotation
                                       [0 -1]
                                       [1  0]
```

When you multiply a vector by a matrix, you transform it.
Neural networks learn WHICH transformation to apply.

---

## Matrix Addition

Just add matching positions (matrices must be same shape):

```
  [1 2]     [5 6]     [1+5  2+6]     [6  8]
  [3 4]  +  [7 8]  =  [3+7  4+8]  =  [10 12]
```

Like adding two spreadsheets cell by cell.

---

## Scalar Multiplication

Multiply every element by a number:

```
       [1 2]     [3  6]
  3 *  [3 4]  =  [9 12]
```

Like applying a uniform price increase to every item in a catalog.

---

## Python: Matrices with NumPy

```python
import numpy as np

A = np.array([
    [90, 85, 92],
    [78, 88, 75],
    [95, 92, 88]
])

print(f"Shape: {A.shape}")
print(f"Element at row 0, col 2: {A[0, 2]}")
print(f"First row: {A[0]}")
print(f"Second column: {A[:, 1]}")

B = np.array([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
])

print(f"Addition:\n{A + B}")
print(f"Scalar mult:\n{2 * B}")
```

---

## Vectors ARE Matrices

A vector is just a matrix with one dimension = 1:

```
  Row vector (1x3):    [[1, 2, 3]]

  Column vector (3x1): [[1],
                         [2],
                         [3]]

  Regular matrix (3x3): [[1, 2, 3],
                          [4, 5, 6],
                          [7, 8, 9]]
```

This is why NumPy lets you treat vectors and matrices
interchangeably — they're the same data structure.

---

## Data as a Matrix

Every dataset is a matrix:

```
  100 users, each rated 50 movies:

  Users x Movies matrix (100 x 50):

           Movie1  Movie2  Movie3  ...  Movie50
  User1  [  5       3       0     ...    4    ]
  User2  [  0       5       4     ...    1    ]
  User3  [  3       0       5     ...    0    ]
   ...        ...
  User100[  4       2       0     ...    5    ]

  Each ROW = one user's ratings (a vector!)
  Each COLUMN = one movie's ratings across users
```

---

## Python: Working with Data Matrices

```python
import numpy as np

np.random.seed(42)
ratings = np.random.randint(0, 6, size=(5, 4))
print("User-Movie ratings:")
print(ratings)

print(f"\nUser 0's ratings: {ratings[0]}")
print(f"Movie 2's ratings: {ratings[:, 2]}")
print(f"Average rating per user: {ratings.mean(axis=1)}")
print(f"Average rating per movie: {ratings.mean(axis=0)}")
print(f"Overall average: {ratings.mean():.2f}")
```

---

## Special Matrices

```
  IDENTITY MATRIX          ZERO MATRIX          DIAGONAL MATRIX
  (the "do nothing")       (all zeros)          (only diagonal)

  [1 0 0]                  [0 0 0]              [3 0 0]
  [0 1 0]                  [0 0 0]              [0 7 0]
  [0 0 1]                  [0 0 0]              [0 0 2]

  A * I = A                A + 0 = A            Scales each
  (like multiplying        (like adding 0)      dimension
   by 1)                                        independently
```

The identity matrix is like a mirror — whatever goes in, comes out
unchanged. It's the matrix equivalent of multiplying by 1.

---

## Weight Matrices in Neural Networks

```
  Layer 1: 4 inputs -> 3 outputs

  Input: [x1, x2, x3, x4]     (1x4 vector)

  Weight matrix W (4x3):
       out1  out2  out3
  x1 [ 0.2   0.5  -0.1 ]
  x2 [ 0.7  -0.3   0.4 ]
  x3 [-0.5   0.8   0.2 ]
  x4 [ 0.1   0.6  -0.3 ]

  Output = Input * W = [y1, y2, y3]   (1x3 vector)

  Each column of W is a "filter" or "detector"
  that looks for a different pattern in the input.
```

Training a neural network = finding the right numbers
for these weight matrices.

---

## Reshaping

AI constantly reshapes matrices:

```python
import numpy as np

a = np.arange(12)
print(f"1D: {a}")
print(f"Shape: {a.shape}")

b = a.reshape(3, 4)
print(f"\n3x4:\n{b}")

c = a.reshape(4, 3)
print(f"\n4x3:\n{c}")

d = a.reshape(2, 2, 3)
print(f"\n2x2x3 (3D tensor):\n{d}")
```

Same 12 numbers, different arrangements. The data doesn't
change — only how you look at it.

---

## Tensors: Beyond Matrices

```
  Scalar:  5                0 dimensions  (a single number)
  Vector:  [1, 2, 3]       1 dimension   (a list)
  Matrix:  [[1,2],[3,4]]   2 dimensions  (a grid)
  Tensor:  [[[1,2],[3,4]], 3+ dimensions  (a cube or beyond)
            [[5,6],[7,8]]]

  A color image is a 3D tensor:
  (height, width, 3)  <-- 3 for RGB channels

  A batch of images is a 4D tensor:
  (batch_size, height, width, 3)
```

"Tensor" is just the general name. Scalars, vectors, and matrices
are all special cases of tensors.

---

## Key Takeaways

```
  +---------------------------------------------------+
  |  MATRIX = grid of numbers (rows x columns)         |
  |  DATA = matrix where rows are samples              |
  |  WEIGHTS = matrix that transforms inputs           |
  |  IDENTITY = "do nothing" matrix                    |
  |  TENSOR = generalization beyond 2D                 |
  |  Neural network layer = matrix transformation      |
  +---------------------------------------------------+
```

---

## Exercises

**Exercise 1:** Create a 4x3 matrix of random integers 1-10.
Extract the second row and third column.

**Exercise 2:** Create two 3x3 matrices. Add them and multiply
each by a scalar. Verify the results.

**Exercise 3:** Create a 5x3 "student grades" matrix. Compute
the average grade per student and per subject.

**Exercise 4:** Create the 3x3 identity matrix using `np.eye(3)`.
Multiply it by any 3x3 matrix. What happens?

**Exercise 5:** Create a vector of 24 elements and reshape it into:
- A 4x6 matrix
- A 6x4 matrix
- A 2x3x4 tensor

Verify all have the same elements.

---

[Next: Lesson 04 - Matrix Multiplication ->](04-matrix-multiplication.md)
