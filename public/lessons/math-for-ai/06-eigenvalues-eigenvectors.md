# Lesson 06: Eigenvalues & Eigenvectors

> **Analogy:** Finding the "main direction" of a cloud of points —
> like finding the axis a football spins around.

---

## The Core Idea

Most vectors change direction when you multiply by a matrix.
But SOME special vectors only get scaled — they keep pointing
the same way.

```
  Regular vector:          Eigenvector:

  A @ v = w                A @ v = lambda * v
  (new direction!)         (SAME direction, just scaled!)

      w                        lambda * v
     ^                         ^
    /                         /
   /  v changed              / v stayed on
  /   direction             /  the same line
  *                        *
```

These special vectors are **eigenvectors**.
The scaling factor is the **eigenvalue** (lambda).

---

## Visual: What Eigenvectors Look Like

```
  Matrix A stretches space horizontally:

  BEFORE                      AFTER (multiply by A)

      |  * *  |                   |     * *     |
      | * * * |                   |   * * * *   |
      |* * * *|       A -->       | * * * * * * |
      | * * * |                   |   * * * *   |
      |  * *  |                   |     * *     |
      ---------                   ---------------

  The HORIZONTAL direction didn't change -- it's an eigenvector!
  The VERTICAL direction didn't change -- it's an eigenvector!

  Horizontal eigenvector: scaled by 2 (eigenvalue = 2)
  Vertical eigenvector: scaled by 1 (eigenvalue = 1)
```

---

## The Math

```
  A @ v = lambda * v

  Where:
  - A is a square matrix (n x n)
  - v is the eigenvector (not zero!)
  - lambda is the eigenvalue (a scalar)

  An n x n matrix has n eigenvalue/eigenvector pairs.

  Example:
  A = [2  1]      v1 = [1]   lambda1 = 3
      [1  2]           [1]

                   v2 = [1]   lambda2 = 1
                        [-1]

  Check: A @ v1 = [2+1] = [3] = 3 * [1] ✓
                   [1+2]   [3]       [1]
```

---

## Why AI Cares: PCA

PCA (Principal Component Analysis) finds the directions of
maximum variance in your data. Those directions ARE eigenvectors.

```
  Your data is a cloud of points:

        *  *
      *  *  *  *
    *  *  *  *  *  *     <-- data is spread along a diagonal
      *  *  *  *
        *  *

  PCA finds:

        *  *
      *  *  *  *
    *  *  *  *  *  *
      *  *  *  *
        *  *
       /
      / <-- eigenvector 1: direction of MOST spread
     /      eigenvalue 1: HOW MUCH spread

    And perpendicular:
      |
      | <-- eigenvector 2: direction of LEAST spread
      |     eigenvalue 2: much smaller
```

The eigenvector with the LARGEST eigenvalue points in the
direction your data varies the most.

---

## PCA Step by Step

```
  1. Center the data (subtract mean)
  2. Compute covariance matrix C = X^T @ X / n
  3. Find eigenvectors and eigenvalues of C
  4. Sort by eigenvalue (largest first)
  5. Keep top k eigenvectors
  6. Project data onto those eigenvectors

  768 dimensions --> top 50 eigenvectors --> 50 dimensions!
  (kept the 50 directions with the most information)
```

---

## Python: Finding Eigenvalues & Eigenvectors

```python
import numpy as np

A = np.array([[2, 1],
              [1, 2]])

eigenvalues, eigenvectors = np.linalg.eig(A)

print(f"Eigenvalues: {eigenvalues}")
print(f"Eigenvectors (columns):\n{eigenvectors}")

for i in range(len(eigenvalues)):
    v = eigenvectors[:, i]
    lam = eigenvalues[i]
    Av = A @ v
    lam_v = lam * v
    print(f"\nEigenvector {i}: {v}")
    print(f"  A @ v     = {Av}")
    print(f"  lambda * v = {lam_v}")
    print(f"  Match: {np.allclose(Av, lam_v)}")
```

---

## Python: PCA from Scratch

```python
import numpy as np

np.random.seed(42)
mean = [0, 0]
cov = [[3, 2],
       [2, 2]]
data = np.random.multivariate_normal(mean, cov, 200)

data_centered = data - data.mean(axis=0)
cov_matrix = (data_centered.T @ data_centered) / len(data_centered)

eigenvalues, eigenvectors = np.linalg.eig(cov_matrix)

sorted_idx = np.argsort(eigenvalues)[::-1]
eigenvalues = eigenvalues[sorted_idx]
eigenvectors = eigenvectors[:, sorted_idx]

print(f"Eigenvalues: {eigenvalues}")
print(f"Variance explained: {eigenvalues / eigenvalues.sum() * 100}")
print(f"Principal direction: {eigenvectors[:, 0]}")

projected = data_centered @ eigenvectors[:, 0:1]
print(f"\nOriginal shape: {data.shape}")
print(f"Projected shape: {projected.shape}")
```

---

## Eigenvalues Tell You Importance

```
  Eigenvalue magnitude = importance of that direction

  Eigenvalues: [45.2, 3.1, 0.8, 0.01]
  Variance %:  [92%,  6%,  1.6%, 0.02%]

  Interpretation:
  +---------+----------+--------+
  | Eigen   | Variance | Keep?  |
  +---------+----------+--------+
  | 45.2    | 92%      | YES    |
  | 3.1     | 6%       | YES    |
  | 0.8     | 1.6%     | Maybe  |
  | 0.01    | 0.02%    | NO     |
  +---------+----------+--------+

  Keep directions with big eigenvalues.
  Drop directions with tiny eigenvalues.
  That's dimensionality reduction!
```

---

## Eigendecomposition

Any square matrix with distinct eigenvalues can be decomposed:

```
  A = V @ D @ V^(-1)

  Where:
  V = matrix of eigenvectors (as columns)
  D = diagonal matrix of eigenvalues
  V^(-1) = inverse of V

  [2  1]     [1   1]   [3  0]   [1   1]^(-1)
  [1  2]  =  [1  -1] @ [0  1] @ [1  -1]

  This is called EIGENDECOMPOSITION.

  Why care?
  - Makes computing A^100 easy (just raise D to 100th power)
  - Reveals the "skeleton" of a transformation
  - Foundation for SVD (next lesson!)
```

---

## Python: Eigendecomposition

```python
import numpy as np

A = np.array([[2, 1],
              [1, 2]])

eigenvalues, V = np.linalg.eig(A)
D = np.diag(eigenvalues)

A_reconstructed = V @ D @ np.linalg.inv(V)
print(f"Original:\n{A}")
print(f"Reconstructed:\n{A_reconstructed}")
print(f"Match: {np.allclose(A, A_reconstructed)}")

A_squared = V @ np.diag(eigenvalues**2) @ np.linalg.inv(V)
A_squared_direct = A @ A
print(f"\nA^2 via eigen: \n{A_squared}")
print(f"A^2 direct:    \n{A_squared_direct}")
print(f"Match: {np.allclose(A_squared, A_squared_direct)}")
```

---

## Real-World Uses

```
  +---------------------+----------------------------------+
  | Application         | How Eigenvalues Help             |
  +---------------------+----------------------------------+
  | PCA                 | Find main directions of data     |
  | Google PageRank     | Dominant eigenvector = rankings   |
  | Spectral clustering | Group data using eigenvectors    |
  | Stability analysis  | Eigenvalues show system behavior |
  | Quantum mechanics   | Energy levels = eigenvalues      |
  +---------------------+----------------------------------+
```

---

## Intuition Check

```
  Q: What does it MEAN when a matrix has
     eigenvalues [5, 0.1]?

  A: It stretches a lot in one direction (5x)
     and squishes in another (0.1x).

     Like taking a circle and turning it
     into a long, thin ellipse:

     Before:    After:

       OOO      ooooooooooo
      OOOOO     ooooooooooo
       OOO      ooooooooooo

     The eigenvectors tell you WHICH directions.
     The eigenvalues tell you HOW MUCH.
```

---

## Key Takeaways

```
  +-----------------------------------------------------+
  |  EIGENVECTOR = direction that doesn't change          |
  |  EIGENVALUE = how much it scales                      |
  |  PCA = keep eigenvectors with largest eigenvalues     |
  |  Big eigenvalue = important direction                 |
  |  Tiny eigenvalue = safe to discard                    |
  |  Eigendecomposition = V @ D @ V^(-1)                  |
  +-----------------------------------------------------+
```

---

## Exercises

**Exercise 1:** For the matrix `[[4, 2], [1, 3]]`, find
eigenvalues and eigenvectors. Verify `A @ v = lambda * v`.

**Exercise 2:** Generate 500 points from a 2D Gaussian with
covariance `[[5, 3], [3, 2]]`. Run PCA and find the principal
direction. What percentage of variance does it capture?

**Exercise 3:** Create a 10x10 random symmetric matrix
(`A = X + X.T` where X is random). Find its eigenvalues.
Are they all real numbers? (They should be for symmetric matrices.)

**Exercise 4:** Implement PCA to reduce 100-dimensional data to 5
dimensions. Generate 1000 random 100D points, apply PCA, and
report how much variance the top 5 components capture.

**Exercise 5:** The identity matrix `I` has all eigenvalues = 1.
Verify this with NumPy for a 5x5 identity. What are its
eigenvectors?

---

[Next: Lesson 07 - SVD ->](07-svd.md)
