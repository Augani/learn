# Reference: NumPy Functions for Math Operations

> Every math operation from this course, translated to NumPy.

---

## Vector Operations

```python
import numpy as np

a = np.array([1.0, 2.0, 3.0])
b = np.array([4.0, 5.0, 6.0])

dot = np.dot(a, b)
dot_alt = a @ b

magnitude = np.linalg.norm(a)

cosine_sim = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

unit_a = a / np.linalg.norm(a)

projection = (np.dot(a, b) / np.dot(b, b)) * b

cross = np.cross(a, b)

distance = np.linalg.norm(a - b)
```

---

## Matrix Operations

```python
import numpy as np

A = np.array([[1, 2], [3, 4]])
B = np.array([[5, 6], [7, 8]])

C = A @ B
C_alt = np.matmul(A, B)

AT = A.T

A_inv = np.linalg.inv(A)

det = np.linalg.det(A)

trace = np.trace(A)

rank = np.linalg.matrix_rank(A)

I = np.eye(3)

zeros = np.zeros((3, 4))
ones = np.ones((3, 4))
diag = np.diag([1, 2, 3])

x = np.linalg.solve(A, np.array([1, 2]))
```

---

## Eigenvalues and SVD

```python
import numpy as np

A = np.array([[4, 2], [1, 3]])

eigenvalues, eigenvectors = np.linalg.eig(A)

sym = np.array([[4, 2], [2, 3]])
eigenvalues_sym, eigenvectors_sym = np.linalg.eigh(sym)

U, S, Vt = np.linalg.svd(A)

A_reconstructed = U @ np.diag(S) @ Vt

k = 1
A_approx = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]
```

---

## Calculus Operations

```python
import numpy as np

x = np.linspace(-5, 5, 1000)
y = np.sin(x)

dy = np.gradient(y, x)

area = np.trapezoid(y, x)

def numerical_derivative(f, x, h=1e-7):
    return (f(x + h) - f(x - h)) / (2 * h)

def numerical_gradient(f, params, h=1e-7):
    grad = np.zeros_like(params)
    for i in range(len(params)):
        params_plus = params.copy()
        params_minus = params.copy()
        params_plus[i] += h
        params_minus[i] -= h
        grad[i] = (f(params_plus) - f(params_minus)) / (2 * h)
    return grad
```

---

## Probability and Statistics

```python
import numpy as np

data = np.random.randn(1000)

mean = np.mean(data)
median = np.median(data)
var = np.var(data)
var_unbiased = np.var(data, ddof=1)
std = np.std(data, ddof=1)

percentile_95 = np.percentile(data, 95)
quantiles = np.quantile(data, [0.25, 0.5, 0.75])

correlation_matrix = np.corrcoef(data.reshape(10, 100))
covariance_matrix = np.cov(data.reshape(10, 100))
```

---

## Random Distributions

```python
import numpy as np

rng = np.random.default_rng(42)

uniform = rng.uniform(0, 1, size=1000)

normal = rng.normal(loc=0, scale=1, size=1000)

binomial = rng.binomial(n=10, p=0.5, size=1000)

poisson = rng.poisson(lam=5, size=1000)

multinomial = rng.multinomial(n=1, pvals=[0.3, 0.5, 0.2], size=1000)

categorical = rng.choice([0, 1, 2], size=1000, p=[0.3, 0.5, 0.2])

indices = rng.choice(1000, size=100, replace=False)

rng.shuffle(data)
```

---

## Information Theory

```python
import numpy as np

def entropy(probs):
    probs = np.asarray(probs, dtype=np.float64)
    probs = probs[probs > 0]
    return -np.sum(probs * np.log2(probs))

def entropy_nats(probs):
    probs = np.asarray(probs, dtype=np.float64)
    probs = probs[probs > 0]
    return -np.sum(probs * np.log(probs))

def cross_entropy(p, q):
    p = np.asarray(p, dtype=np.float64)
    q = np.asarray(q, dtype=np.float64)
    q = np.clip(q, 1e-15, 1.0)
    return -np.sum(p * np.log(q))

def kl_divergence(p, q):
    p = np.asarray(p, dtype=np.float64)
    q = np.asarray(q, dtype=np.float64)
    mask = p > 0
    return np.sum(p[mask] * np.log(p[mask] / q[mask]))

def mutual_info(joint_probs):
    p_x = joint_probs.sum(axis=1)
    p_y = joint_probs.sum(axis=0)
    outer = np.outer(p_x, p_y)
    mask = joint_probs > 0
    return np.sum(joint_probs[mask] * np.log(joint_probs[mask] / outer[mask]))
```

---

## Activation Functions

```python
import numpy as np

def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))

def relu(x):
    return np.maximum(0, x)

def leaky_relu(x, alpha=0.01):
    return np.where(x > 0, x, alpha * x)

def softmax(x, axis=-1):
    x_shifted = x - np.max(x, axis=axis, keepdims=True)
    exp_x = np.exp(x_shifted)
    return exp_x / np.sum(exp_x, axis=axis, keepdims=True)

def gelu(x):
    return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x ** 3)))
```

---

## Loss Functions

```python
import numpy as np

def mse(y_true, y_pred):
    return np.mean((y_true - y_pred) ** 2)

def mae(y_true, y_pred):
    return np.mean(np.abs(y_true - y_pred))

def binary_cross_entropy(y_true, y_pred):
    y_pred = np.clip(y_pred, 1e-15, 1 - 1e-15)
    return -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))

def categorical_cross_entropy(y_true_onehot, y_pred):
    y_pred = np.clip(y_pred, 1e-15, 1.0)
    return -np.sum(y_true_onehot * np.log(y_pred)) / len(y_true_onehot)

def huber_loss(y_true, y_pred, delta=1.0):
    error = y_true - y_pred
    abs_error = np.abs(error)
    return np.mean(np.where(abs_error <= delta,
                            0.5 * error ** 2,
                            delta * abs_error - 0.5 * delta ** 2))
```

---

## Distance Functions

```python
import numpy as np

def euclidean(a, b):
    return np.linalg.norm(a - b)

def manhattan(a, b):
    return np.sum(np.abs(a - b))

def cosine_distance(a, b):
    return 1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def pairwise_euclidean(X):
    sq_norms = np.sum(X ** 2, axis=1)
    distances_sq = sq_norms[:, None] + sq_norms[None, :] - 2 * X @ X.T
    return np.sqrt(np.maximum(distances_sq, 0))

def cosine_similarity_matrix(X):
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    X_normalized = X / np.clip(norms, 1e-10, None)
    return X_normalized @ X_normalized.T
```

---

## Normalization

```python
import numpy as np

def min_max_normalize(x, axis=0):
    x_min = np.min(x, axis=axis, keepdims=True)
    x_max = np.max(x, axis=axis, keepdims=True)
    denom = x_max - x_min
    denom = np.where(denom == 0, 1, denom)
    return (x - x_min) / denom

def z_score_normalize(x, axis=0):
    mean = np.mean(x, axis=axis, keepdims=True)
    std = np.std(x, axis=axis, keepdims=True)
    std = np.where(std == 0, 1, std)
    return (x - mean) / std

def l2_normalize(x, axis=-1):
    norms = np.linalg.norm(x, axis=axis, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    return x / norms

def batch_norm(x, gamma=1, beta=0, eps=1e-5):
    mean = np.mean(x, axis=0)
    var = np.var(x, axis=0)
    x_norm = (x - mean) / np.sqrt(var + eps)
    return gamma * x_norm + beta

def layer_norm(x, gamma=1, beta=0, eps=1e-5):
    mean = np.mean(x, axis=-1, keepdims=True)
    var = np.var(x, axis=-1, keepdims=True)
    x_norm = (x - mean) / np.sqrt(var + eps)
    return gamma * x_norm + beta
```

---

## Scipy Extras

```python
from scipy import stats
from scipy.optimize import minimize
from scipy.spatial.distance import cdist

t_stat, p_value = stats.ttest_ind(sample_a, sample_b)

t_stat, p_value = stats.ttest_rel(scores_a, scores_b)

stat, p_value = stats.wilcoxon(scores_a - scores_b)

normal = stats.norm(loc=0, scale=1)
cdf_value = normal.cdf(1.96)
pdf_value = normal.pdf(0)
samples = normal.rvs(size=1000)

result = minimize(loss_fn, x0=initial_params, method="L-BFGS-B")

distances = cdist(X, Y, metric="euclidean")
distances_cos = cdist(X, Y, metric="cosine")
```
