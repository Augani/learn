# Math Foundations — Formula Cheat Sheet

Every formula from this track with its NumPy equivalent.
Bookmark this page for quick reference.

---

## Linear Algebra

### Vectors (Lesson 01)

| Operation | Formula | NumPy |
|---|---|---|
| Vector addition | **a** + **b** = [a₁+b₁, a₂+b₂, ...] | `a + b` |
| Scalar multiplication | k**a** = [ka₁, ka₂, ...] | `k * a` |
| Element-wise multiply | **a** ⊙ **b** = [a₁b₁, a₂b₂, ...] | `a * b` |
| Magnitude (L2 norm) | \|\|**a**\|\| = √(a₁² + a₂² + ... + aₙ²) | `np.linalg.norm(a)` |
| Unit vector | **â** = **a** / \|\|**a**\|\| | `a / np.linalg.norm(a)` |

### Dot Product and Similarity (Lesson 02)

| Operation | Formula | NumPy |
|---|---|---|
| Dot product | **a** · **b** = Σ aᵢbᵢ | `np.dot(a, b)` or `a @ b` |
| Geometric dot product | **a** · **b** = \|\|**a**\|\| \|\|**b**\|\| cos(θ) | — |
| Cosine similarity | cos(θ) = (**a** · **b**) / (\|\|**a**\|\| \|\|**b**\|\|) | `np.dot(a,b) / (np.linalg.norm(a) * np.linalg.norm(b))` |

### Matrix Multiplication (Lesson 03)

| Operation | Formula | NumPy |
|---|---|---|
| Matrix multiply | C = A @ B, where C[i,j] = Σₖ A[i,k] × B[k,j] | `A @ B` or `np.matmul(A, B)` |
| Dimension rule | (m×k) @ (k×n) = (m×n) | — |
| Matrix-vector multiply | **y** = W**x** + **b** | `W @ x + b` |
| Batch forward pass | Y = XW + **b** | `X @ W + b` |

### Transpose and Decomposition (Lesson 04)

| Operation | Formula | NumPy |
|---|---|---|
| Transpose | A^T[i,j] = A[j,i] | `A.T` |
| Transpose of product | (AB)^T = B^T A^T | — |
| Eigendecomposition | A**v** = λ**v** | `np.linalg.eig(A)` |
| SVD | A = UΣV^T | `np.linalg.svd(A)` |
| Covariance matrix | C = (1/n) X^T X (centered) | `np.cov(X.T)` |

---

## Calculus

### Derivatives and Gradients (Lesson 05)

| Operation | Formula | NumPy |
|---|---|---|
| Derivative (limit) | f'(x) = lim[h→0] (f(x+h) - f(x)) / h | — |
| Numerical derivative | f'(x) ≈ (f(x+h) - f(x-h)) / 2h | `(f(x+h) - f(x-h)) / (2*h)` |
| Gradient | ∇f = [∂f/∂x₁, ∂f/∂x₂, ..., ∂f/∂xₙ] | — |
| Gradient descent | θ = θ - α∇L | `theta -= lr * gradient` |

### Common Derivatives

| Function | Derivative | ML Context |
|---|---|---|
| f(x) = xⁿ | f'(x) = nxⁿ⁻¹ | Polynomial features |
| f(x) = eˣ | f'(x) = eˣ | Softmax |
| f(x) = ln(x) | f'(x) = 1/x | Cross-entropy loss |
| f(x) = max(0, x) | f'(x) = 1 if x > 0, else 0 | ReLU activation |
| f(x) = σ(x) = 1/(1+e⁻ˣ) | f'(x) = σ(x)(1 - σ(x)) | Sigmoid activation |

### Chain Rule (Lesson 06)

| Operation | Formula | NumPy |
|---|---|---|
| Chain rule (single) | d/dx f(g(x)) = f'(g(x)) × g'(x) | — |
| Chain rule (multi) | d/dx h(g(f(x))) = h' × g' × f' | — |
| Backprop update | ∂L/∂W = ∂L/∂y × ∂y/∂W | `dL_dW = dL_dy @ x.T` |

---

## Probability & Statistics

### Probability Basics (Lesson 07)

| Operation | Formula | NumPy |
|---|---|---|
| Probability sum | Σ P(xᵢ) = 1 | `probs.sum() == 1.0` |
| Conditional probability | P(A\|B) = P(A∩B) / P(B) | — |
| Bayes' theorem | P(A\|B) = P(B\|A)P(A) / P(B) | — |
| Softmax | softmax(xᵢ) = eˣⁱ / Σⱼ eˣʲ | `np.exp(x - x.max()) / np.exp(x - x.max()).sum()` |
| Temperature scaling | softmax(xᵢ/T) | `np.exp(x/T - max) / sum(...)` |

### Common Distributions

| Distribution | PDF/PMF | NumPy Sampling |
|---|---|---|
| Uniform(a, b) | P(x) = 1/(b-a) | `np.random.uniform(a, b, size)` |
| Normal(μ, σ²) | P(x) = (1/σ√2π) e^(-(x-μ)²/2σ²) | `np.random.normal(mu, sigma, size)` |
| Bernoulli(p) | P(1) = p, P(0) = 1-p | `np.random.binomial(1, p, size)` |

### Expectation, Variance, and MLE (Lesson 08)

| Operation | Formula | NumPy |
|---|---|---|
| Expected value (discrete) | E[X] = Σ xᵢ P(xᵢ) | `np.sum(x * p)` |
| Expected value (sample) | x̄ = (1/n) Σ xᵢ | `data.mean()` |
| Variance | Var(X) = E[(X - μ)²] = E[X²] - (E[X])² | `data.var()` |
| Standard deviation | σ = √Var(X) | `data.std()` |
| MLE mean (Gaussian) | μ̂ = (1/n) Σ xᵢ | `data.mean()` |
| MLE variance (Gaussian) | σ̂² = (1/n) Σ (xᵢ - μ̂)² | `np.mean((data - data.mean())**2)` |

### Loss Functions (MLE Connection)

| Loss | Formula | NumPy | MLE For |
|---|---|---|---|
| MSE | (1/n) Σ (yᵢ - ŷᵢ)² | `np.mean((y - y_hat)**2)` | Gaussian |
| Cross-entropy | -(1/n) Σ log P(yᵢ) | `-np.mean(np.log(probs[range(n), labels]))` | Categorical |
| Binary cross-entropy | -[y log(p) + (1-y) log(1-p)] | `-np.mean(y*np.log(p) + (1-y)*np.log(1-p))` | Bernoulli |

---

## Quick NumPy Reference

```python
import numpy as np

# Creating arrays
v = np.array([1, 2, 3])              # vector
M = np.array([[1, 2], [3, 4]])       # matrix
I = np.eye(3)                         # identity matrix
Z = np.zeros((3, 4))                  # zero matrix
R = np.random.randn(3, 4)            # random normal matrix

# Shapes
v.shape                                # (3,)
M.shape                                # (2, 2)
M.reshape(4, 1)                        # reshape
M.flatten()                            # to 1D

# Operations
A @ B                                  # matrix multiply
A.T                                    # transpose
np.linalg.norm(v)                      # vector magnitude
np.linalg.eig(M)                       # eigenvalues/vectors
np.linalg.svd(M)                       # SVD
np.linalg.inv(M)                       # matrix inverse

# Statistics
data.mean()                            # mean
data.var()                             # variance
data.std()                             # standard deviation
np.cov(data.T)                         # covariance matrix
```
