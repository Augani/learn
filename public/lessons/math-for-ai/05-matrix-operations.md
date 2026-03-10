# Lesson 05: Matrix Operations

> **Analogy:** Undo buttons and mirrors — transpose flips your
> data, inverse undoes a transformation, identity does nothing.

---

## Transpose: The Mirror Flip

Transpose swaps rows and columns. Like rotating a spreadsheet.

```
  ORIGINAL A (2x3)          TRANSPOSE A^T (3x2)

  [1  2  3]                 [1  4]
  [4  5  6]                 [2  5]
                             [3  6]

  Row 0 of A --> Column 0 of A^T
  Row 1 of A --> Column 1 of A^T

  A[i,j] becomes A^T[j,i]
```

Think of it as a mirror placed along the diagonal:

```
  [1  2  3]        [1 | 4]
  [4  5  6]   -->  [2 | 5]
   --------        [3 | 6]
  rows become      columns become
  columns          rows
```

---

## Why Transpose Matters in AI

```
  1. SHAPE COMPATIBILITY
     Need (n,m) but have (m,n)? Transpose!

     x: (1, 768)     W: (768, 512)
     x @ W works!    (1,768) @ (768,512) = (1,512)

     But what if W is stored as (512, 768)?
     x @ W.T works!  (1,768) @ (768,512) = (1,512)

  2. DOT PRODUCT AS MATRIX MULTIPLY
     a . b = a @ b.T   (when a, b are row vectors)

  3. COVARIANCE MATRIX
     cov = X.T @ X     (features x features)
```

---

## Python: Transpose

```python
import numpy as np

A = np.array([[1, 2, 3],
              [4, 5, 6]])

print(f"A shape: {A.shape}")
print(f"A:\n{A}")
print(f"\nA^T shape: {A.T.shape}")
print(f"A^T:\n{A.T}")

v = np.array([[1, 2, 3]])
print(f"\nRow vector: {v}, shape: {v.shape}")
print(f"Col vector:\n{v.T}, shape: {v.T.shape}")

print(f"\nDot via transpose: {v @ v.T}")
print(f"Dot via np.dot:    {np.dot(v.flatten(), v.flatten())}")
```

---

## Identity Matrix: The "Do Nothing" Transformation

```
  The identity matrix is like multiplying by 1.

  [1  0  0]     [a]     [a]
  [0  1  0]  @  [b]  =  [b]
  [0  0  1]     [c]     [c]

  A @ I = A
  I @ A = A

  In 2D:                    In 3D:
  [1  0]                    [1  0  0]
  [0  1]                    [0  1  0]
                             [0  0  1]

  It's the "identity" because it doesn't change anything.
  Like pressing Ctrl+Z then Ctrl+Y — back where you started.
```

---

## Inverse: The Undo Button

If a matrix transforms data one way, its inverse transforms it back.

```
  A @ A^(-1) = I     (the identity)

  Like:
  - Encrypt then decrypt = original message
  - Compress then decompress = original file
  - Rotate 30 degrees then rotate -30 degrees = no rotation

  A @ x = b          "A transformed x into b"
  x = A^(-1) @ b     "Undo A to get x back"
```

Not all matrices have inverses! A matrix without an inverse
is called **singular** — it destroys information that can't
be recovered.

```
  INVERTIBLE                 SINGULAR (no inverse)

  [2  1]                     [1  2]
  [1  1]                     [2  4]  <-- row 2 = 2 * row 1

  Transforms 2D to 2D       Squashes 2D to 1D
  No info lost               Info destroyed!
  Can be undone              Can't be undone
```

---

## Python: Identity and Inverse

```python
import numpy as np

I = np.eye(3)
print(f"Identity:\n{I}")

A = np.array([[2, 1],
              [1, 1]])
A_inv = np.linalg.inv(A)

print(f"\nA:\n{A}")
print(f"A inverse:\n{A_inv}")
print(f"A @ A_inv:\n{A @ A_inv}")

x = np.array([3, 7])
b = A @ x
print(f"\nOriginal x: {x}")
print(f"After A: {b}")
x_recovered = A_inv @ b
print(f"After A_inv: {x_recovered}")
```

---

## Determinant: Can You Undo This?

The determinant tells you if a matrix is invertible.

```
  det(A) != 0  -->  invertible
  det(A) == 0  -->  singular (no inverse)

  For a 2x2 matrix:

  A = [a  b]
      [c  d]

  det(A) = a*d - b*c

  Example:
  [2  1]
  [1  1]   det = 2*1 - 1*1 = 1  (invertible!)

  [1  2]
  [2  4]   det = 1*4 - 2*2 = 0  (singular!)
```

Geometrically, the determinant measures how much the matrix
scales area. If det = 0, it squashes everything flat.

```
  det = 1          det = 2          det = 0

  +----+           +--------+       +---------+
  |    |           |        |       | (a line) |
  |    |           |        |       +---------+
  +----+           |        |
  area = 1         +--------+       area = 0
                   area = 2         SQUASHED!
```

---

## Trace: The Quick Summary

The trace is the sum of diagonal elements.

```
  [1  2  3]
  [4  5  6]     trace = 1 + 5 + 9 = 15
  [7  8  9]

  Useful properties:
  - trace(A + B) = trace(A) + trace(B)
  - trace(A @ B) = trace(B @ A)
  - trace(I_n) = n
```

The trace shows up in loss functions and matrix calculus.

---

## Matrix Rank: How Much Info Is There?

Rank = number of "independent" rows (or columns).

```
  FULL RANK (rank = 2)           RANK DEFICIENT (rank = 1)

  [1  0]                         [1  2]
  [0  1]                         [2  4]  <-- row 2 = 2 * row 1

  Both rows are                  Only 1 independent row
  independent                    Row 2 adds no new info
  2 dimensions of info           1 dimension of info
```

In AI, low-rank matrices are everywhere:
- LoRA (Low-Rank Adaptation) for fine-tuning
- Matrix factorization for recommendations
- Compression techniques

---

## Python: Determinant, Trace, Rank

```python
import numpy as np

A = np.array([[2, 1],
              [1, 1]])

B = np.array([[1, 2],
              [2, 4]])

print(f"A determinant: {np.linalg.det(A):.4f}")
print(f"B determinant: {np.linalg.det(B):.4f}")

C = np.array([[1, 2, 3],
              [4, 5, 6],
              [7, 8, 9]])

print(f"\nTrace of C: {np.trace(C)}")
print(f"Rank of C: {np.linalg.matrix_rank(C)}")
print(f"Rank of identity: {np.linalg.matrix_rank(np.eye(3))}")
```

---

## Solving Systems of Equations

```
  2x + y = 5
   x + y = 3

  As a matrix equation:  A @ x = b

  [2  1] @ [x]  =  [5]
  [1  1]   [y]     [3]

  Solution: x = A^(-1) @ b
```

```python
import numpy as np

A = np.array([[2, 1],
              [1, 1]])
b = np.array([5, 3])

x = np.linalg.solve(A, b)
print(f"Solution: x={x[0]}, y={x[1]}")

x_inv = np.linalg.inv(A) @ b
print(f"Via inverse: x={x_inv[0]}, y={x_inv[1]}")
```

---

## Symmetric Matrices

A symmetric matrix equals its transpose: `A = A^T`

```
  [1  2  3]         [1  2  3]
  [2  5  6]    =    [2  5  6]     A == A^T
  [3  6  9]         [3  6  9]

  The matrix is mirrored across the diagonal.

  Where they show up:
  - Covariance matrices (always symmetric)
  - Distance matrices (dist A->B = dist B->A)
  - Kernel matrices
```

---

## Orthogonal Matrices

Rows (and columns) are all perpendicular unit vectors.

```
  Properties of orthogonal matrix Q:
  - Q^T @ Q = I       (transpose IS the inverse!)
  - Q @ Q^T = I
  - Preserves lengths and angles
  - det(Q) = +1 or -1

  Like rotating or reflecting — no stretching or squashing.

  Example (90 degree rotation):
  [0  -1]
  [1   0]

  Cheap to invert — just transpose it!
```

---

## Operations Summary

```
  +-------------------+------------------+------------------+
  |  Operation        |  What It Does    |  AI Use Case     |
  +-------------------+------------------+------------------+
  |  Transpose A^T    |  Swap rows/cols  |  Shape fixing    |
  |  Inverse A^(-1)   |  Undo transform  |  Solving systems |
  |  Identity I       |  Do nothing      |  Skip connections|
  |  Determinant      |  Scale factor    |  Check invertible|
  |  Trace            |  Diagonal sum    |  Loss functions  |
  |  Rank             |  Info dimensions |  LoRA, compress  |
  +-------------------+------------------+------------------+
```

---

## Key Takeaways

```
  +-----------------------------------------------------+
  |  TRANSPOSE = flip rows <-> columns                    |
  |  INVERSE = undo the transformation                    |
  |  IDENTITY = the "do nothing" matrix                   |
  |  DETERMINANT = 0 means info is destroyed              |
  |  RANK = how many independent dimensions               |
  |  These ops are the building blocks of everything else |
  +-----------------------------------------------------+
```

---

## Exercises

**Exercise 1:** Transpose a 3x5 matrix. What's the new shape?

**Exercise 2:** Find the inverse of `[[3, 1], [5, 2]]` by hand
using the 2x2 formula: `(1/det) * [[d, -b], [-c, a]]`.
Verify with NumPy.

**Exercise 3:** Create a 4x4 matrix where row 3 = row 1 + row 2.
What's its rank? What's its determinant?

**Exercise 4:** Verify that for any square matrix A:
`trace(A) == trace(A.T)`

**Exercise 5:** Create an orthogonal matrix (hint: rotation matrix)
and verify that `Q.T @ Q` equals the identity.

```python
import numpy as np

theta = np.pi / 4
Q = np.array([[np.cos(theta), -np.sin(theta)],
              [np.sin(theta),  np.cos(theta)]])

pass
```

---

[Next: Lesson 06 - Eigenvalues & Eigenvectors ->](06-eigenvalues-eigenvectors.md)
