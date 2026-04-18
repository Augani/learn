# Lesson 04: Transpose, Eigenvalues, and Decomposition — Seeing Inside Matrices

Some matrices hide structure. Transpose flips rows and columns.
Eigenvalues reveal the directions a matrix stretches space.
Decomposition breaks a matrix into simpler pieces. These tools
show up in PCA, dimensionality reduction, and understanding what
neural networks learn.

---

## The Core Idea: Transpose

The **transpose** of a matrix flips it along its diagonal — rows
become columns and columns become rows.

**Analogy: Rotating a spreadsheet.** If your spreadsheet has students
as rows and subjects as columns, the transpose gives you subjects as
rows and students as columns. Same data, different view.

```
Original A (2×3):          Transpose A^T (3×2):

┌         ┐                ┌      ┐
│ 1  2  3 │                │ 1  4 │
│ 4  5  6 │                │ 2  5 │
└         ┘                │ 3  6 │
                           └      ┘

Rule: A^T[i, j] = A[j, i]

Row 0 of A → Column 0 of A^T
Row 1 of A → Column 1 of A^T
```

```python
import numpy as np

A = np.array([[1, 2, 3],
              [4, 5, 6]])

print(f"A shape:   {A.shape}")     # (2, 3)
print(f"A:\n{A}")

AT = A.T
print(f"\nA^T shape: {AT.shape}")  # (3, 2)
print(f"A^T:\n{AT}")

# Transpose of a vector
v = np.array([1, 2, 3])
print(f"\nVector shape: {v.shape}")  # (3,) — 1D, no change
# For explicit row/column:
row = v.reshape(1, -1)   # (1, 3) row vector
col = v.reshape(-1, 1)   # (3, 1) column vector
print(f"Row: {row.shape}, Col: {col.shape}")
```

### Transpose Properties

```
(A^T)^T = A                    Double transpose = original
(A + B)^T = A^T + B^T          Transpose distributes over addition
(A @ B)^T = B^T @ A^T          Transpose reverses multiplication order!
(k × A)^T = k × A^T            Scalars pass through
```

### Where Transpose Appears in ML

```
Attention formula:  scores = Q @ K^T / √d
                                 ↑
                          transpose of keys!

This computes dot products between every query and every key.

    Q (seq_len × d)  @  K^T (d × seq_len)  =  scores (seq_len × seq_len)
```

---

## Eigenvalues and Eigenvectors

An **eigenvector** of a matrix is a special direction that the matrix
only stretches (or shrinks), never rotates. The **eigenvalue** tells
you how much it stretches.

**Analogy: Principal axes of an ellipse.** Imagine stretching a rubber
circle into an ellipse. The two axes of the ellipse are the eigenvectors.
How much each axis stretched is the eigenvalue.

```
Matrix A acts on vector v:

    A @ v = λ × v

    v = eigenvector (the direction that doesn't rotate)
    λ = eigenvalue (how much it stretches in that direction)


Geometric picture:

    Before (unit circle):        After (A applied):

         ╭───╮                      ╭─────────╮
        ╱     ╲                    ╱           ╲
       │   •   │        →        │      •       │
        ╲     ╱                    ╲           ╱
         ╰───╯                      ╰─────────╯

    Eigenvector 1: → (horizontal)   eigenvalue = 3 (stretched 3×)
    Eigenvector 2: ↑ (vertical)     eigenvalue = 1 (unchanged)
```

```python
import numpy as np

# A matrix that stretches horizontally
A = np.array([[3, 0],
              [0, 1]])

eigenvalues, eigenvectors = np.linalg.eig(A)

print(f"Eigenvalues:  {eigenvalues}")    # [3. 1.]
print(f"Eigenvectors:\n{eigenvectors}")  # [[1,0],[0,1]] (horizontal and vertical)

# Verify: A @ v = λ * v
for i in range(len(eigenvalues)):
    v = eigenvectors[:, i]
    lam = eigenvalues[i]
    Av = A @ v
    lam_v = lam * v
    print(f"\nEigenvector {i}: {v}")
    print(f"  A @ v   = {Av}")
    print(f"  λ × v   = {lam_v}")
    print(f"  Match: {np.allclose(Av, lam_v)}")
```

---

## A More Interesting Example

```python
import numpy as np

# A matrix that both stretches and rotates
A = np.array([[2, 1],
              [1, 3]])

eigenvalues, eigenvectors = np.linalg.eig(A)

print(f"Eigenvalues: {eigenvalues}")
# [1.382, 3.618] — two different stretch factors

print(f"\nEigenvectors:\n{eigenvectors}")
# Two special directions where A only stretches

# The larger eigenvalue tells you the direction of maximum stretch
max_idx = np.argmax(eigenvalues)
print(f"\nDirection of maximum stretch: {eigenvectors[:, max_idx]}")
print(f"Stretch factor: {eigenvalues[max_idx]:.3f}")
```

---

## Singular Value Decomposition (SVD)

SVD breaks any matrix into three simpler matrices:

```
A = U @ Σ @ V^T

Where:
    U  = left singular vectors (what the output space looks like)
    Σ  = singular values (how much each component matters)
    V^T = right singular vectors (what the input space looks like)

    ┌─────┐     ┌───┐   ┌───┐   ┌─────┐
    │     │     │   │   │ σ │   │     │
    │  A  │  =  │ U │ @ │  σ│ @ │ V^T │
    │     │     │   │   │   │   │     │
    └─────┘     └───┘   └───┘   └─────┘
    (m × n)    (m × m) (m × n) (n × n)

The singular values σ₁ ≥ σ₂ ≥ ... are sorted largest to smallest.
The first few capture most of the "information" in the matrix.
```

```python
import numpy as np

# A simple matrix
A = np.array([[1, 2, 3],
              [4, 5, 6],
              [7, 8, 9]])

U, sigma, VT = np.linalg.svd(A)

print(f"U shape:     {U.shape}")      # (3, 3)
print(f"Sigma:       {sigma}")         # singular values
print(f"V^T shape:   {VT.shape}")     # (3, 3)

# Reconstruct A from SVD
Sigma_matrix = np.diag(sigma)
A_reconstructed = U @ Sigma_matrix @ VT
print(f"\nReconstruction matches: {np.allclose(A, A_reconstructed)}")

# The singular values tell you how much each component matters
print(f"\nSingular values: {sigma}")
print(f"First value captures {sigma[0]/sigma.sum()*100:.1f}% of total")
```

---

## Connection to ML: PCA

**Principal Component Analysis (PCA)** uses eigenvalues to find the
most important directions in your data. It is the most common
dimensionality reduction technique.

```
PCA intuition:

    Original data (2D):              After PCA:

    y                                PC2 (less important)
    │    · ·  ·                       │
    │  ·  · ·  ·                      │    ·
    │ · ·  ·  · ·                     │  · · ·
    │  ·  · ·  ·                      │ · · · ·  ·
    │    · ·                          │  · · ·
    └──────────── x                   │    ·
                                      └──────────── PC1 (most important)

    PCA finds the direction of maximum variance (PC1)
    and the perpendicular direction (PC2).

    If PC1 captures 95% of the variance, you can drop PC2
    and go from 2D to 1D with minimal information loss.
```

```python
import numpy as np

# Generate correlated 2D data
np.random.seed(42)
n = 200
x = np.random.randn(n)
y = 0.8 * x + 0.3 * np.random.randn(n)  # correlated with x
data = np.column_stack([x, y])

# Step 1: Center the data (subtract mean)
data_centered = data - data.mean(axis=0)

# Step 2: Compute covariance matrix
cov_matrix = np.cov(data_centered.T)
print(f"Covariance matrix:\n{cov_matrix}")

# Step 3: Eigenvalue decomposition
eigenvalues, eigenvectors = np.linalg.eig(cov_matrix)

# Sort by eigenvalue (largest first)
idx = np.argsort(eigenvalues)[::-1]
eigenvalues = eigenvalues[idx]
eigenvectors = eigenvectors[:, idx]

print(f"\nEigenvalues: {eigenvalues}")
print(f"Variance explained: {eigenvalues / eigenvalues.sum() * 100}")

# Step 4: Project data onto first principal component (dimensionality reduction)
pc1 = eigenvectors[:, 0]  # direction of maximum variance
projected_1d = data_centered @ pc1

print(f"\nOriginal data shape: {data.shape}")        # (200, 2)
print(f"Projected shape:     {projected_1d.shape}")  # (200,)
print(f"Reduced from 2D to 1D!")
```

---

## Exercises

### Exercise 1: Transpose Practice

```python
import numpy as np

A = np.array([[1, 2, 3],
              [4, 5, 6]])

# TODO: compute A^T
# TODO: verify that (A^T)^T = A
# TODO: compute A @ A^T — what is the shape? Is it symmetric?
# TODO: compute A^T @ A — what is the shape? Is it symmetric?
```

### Exercise 2: Eigenvalue Exploration

```python
import numpy as np

# A symmetric matrix (common in ML — covariance matrices are symmetric)
A = np.array([[4, 2],
              [2, 3]])

# TODO: compute eigenvalues and eigenvectors
# TODO: verify A @ v = λ * v for each eigenvector
# TODO: are the eigenvectors perpendicular? (check their dot product)
# TODO: what does the largest eigenvalue tell you about this matrix?
```

### Exercise 3: PCA on a Small Dataset

```python
import numpy as np
np.random.seed(42)

# Generate 3D data where most variance is in 2 dimensions
n = 300
t = np.random.randn(n)
data = np.column_stack([
    2 * t + np.random.randn(n) * 0.1,
    t + np.random.randn(n) * 0.1,
    np.random.randn(n) * 0.1  # this dimension is mostly noise
])

# TODO: center the data
# TODO: compute the covariance matrix
# TODO: find eigenvalues and eigenvectors
# TODO: how much variance does each component explain?
# TODO: project the data onto the top 2 principal components
# TODO: what is the shape before and after? How much information did you lose?
```

---

Next: [Lesson 05: Derivatives and Gradients](./05-derivatives-gradients.md)
