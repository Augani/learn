# Lesson 07: Singular Value Decomposition (SVD)

> **Analogy:** Summarizing a book into key themes — SVD finds the
> most important patterns and throws away the noise.

---

## The Big Idea

SVD breaks ANY matrix into three simpler pieces:

```
  A = U @ S @ V^T

  Where:
  A = original matrix     (m x n)
  U = left patterns       (m x m)  "how rows relate to themes"
  S = importance scores   (m x n)  diagonal, sorted by importance
  V^T = right patterns    (n x n)  "how columns relate to themes"

  Book analogy:
  A   = the full book (users x movies, words x documents, etc.)
  U   = reader profiles (which themes each reader cares about)
  S   = theme importance (how significant each theme is)
  V^T = theme content (what each theme is about)
```

---

## Visual Decomposition

```
  Original Matrix          =    U    @    S    @   V^T

  +----------+              +----+   +------+   +----------+
  |          |              |    |   |s1    |   |          |
  |   m x n  |       =     | m  | @ |  s2  | @ |   n x n  |
  |          |              | x  |   |   s3 |   |          |
  |          |              | m  |   |      |   +----------+
  +----------+              +----+   +------+

  s1 >= s2 >= s3 >= ...  (sorted by importance!)

  The singular values s1, s2, s3 tell you:
  "Theme 1 is THIS important, theme 2 is THIS important..."
```

---

## Why SVD Beats Eigendecomposition

```
  Eigendecomposition:
  - Only works on SQUARE matrices
  - Might have complex eigenvalues

  SVD:
  - Works on ANY matrix (any shape!)
  - Always has real, non-negative singular values
  - Always exists

  +--------------------+-------------------+
  | Eigendecomposition | SVD               |
  +--------------------+-------------------+
  | Square only        | Any shape         |
  | A = V D V^(-1)     | A = U S V^T       |
  | Eigenvalues        | Singular values   |
  | Can be complex     | Always real >= 0  |
  +--------------------+-------------------+
```

---

## Python: Basic SVD

```python
import numpy as np

A = np.array([[1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
              [10, 11, 12]])

U, s, Vt = np.linalg.svd(A, full_matrices=False)

print(f"A shape:  {A.shape}")
print(f"U shape:  {U.shape}")
print(f"s values: {s}")
print(f"Vt shape: {Vt.shape}")

S = np.diag(s)
A_reconstructed = U @ S @ Vt
print(f"\nReconstruction error: {np.linalg.norm(A - A_reconstructed):.10f}")
```

---

## Low-Rank Approximation: The Killer Feature

Keep only the top k singular values to COMPRESS the matrix:

```
  Original: 1000 x 500 matrix = 500,000 numbers

  Full SVD:  U (1000x500) @ S (500x500) @ Vt (500x500)

  Keep top 10:
  U_10 (1000x10) @ S_10 (10x10) @ Vt_10 (10x500)
  = 10,000 + 100 + 5,000 = 15,100 numbers

  Compression ratio: 500,000 / 15,100 = 33x smaller!
  And it captures the most important patterns!

  Singular values: [100, 50, 20, 10, 5, 2, 1, 0.5, ...]
                    ^^^^^^^^^^^^^^^^^^^^^^
                    These capture 95% of the info!
                                          ^^^^^^^^^^
                                          This is noise
```

---

## Visual: Image Compression with SVD

```
  Original image (grayscale = matrix of pixel values):

  +------------------+
  |   Full detail    |   rank = 500
  |   500x500 pixel  |   250,000 values
  +------------------+

  Rank 50 approximation:
  +------------------+
  |  Slightly blurry |   50 components
  |  but recognizable|   ~50,000 values (5x compression)
  +------------------+

  Rank 10 approximation:
  +------------------+
  |    Very blurry   |   10 components
  |  main shapes only|   ~10,000 values (25x compression)
  +------------------+

  Rank 1 approximation:
  +------------------+
  |  Just the        |   1 component
  |  average color   |   ~1,000 values (250x compression)
  +------------------+
```

---

## Python: Image Compression

```python
import numpy as np

np.random.seed(42)
image = np.random.rand(100, 100)
image += np.outer(np.sin(np.linspace(0, 3, 100)),
                  np.cos(np.linspace(0, 3, 100))) * 2

U, s, Vt = np.linalg.svd(image, full_matrices=False)

ranks = [1, 5, 10, 50]
for k in ranks:
    approx = U[:, :k] @ np.diag(s[:k]) @ Vt[:k, :]
    error = np.linalg.norm(image - approx) / np.linalg.norm(image)
    storage = k * (100 + 1 + 100)
    original = 100 * 100
    print(f"Rank {k:2d}: error={error:.4f}, "
          f"storage={storage:5d}/{original} "
          f"({storage/original*100:.1f}%)")
```

---

## Recommendation Systems

```
  Users x Movies rating matrix (lots of zeros = unrated):

             Movie1  Movie2  Movie3  Movie4  Movie5
  User1    [  5       0       3       0       4    ]
  User2    [  0       4       0       5       0    ]
  User3    [  4       0       4       0       3    ]
  User4    [  0       5       0       4       0    ]

  SVD finds hidden "themes":
  - Theme 1: "Action lover" (high for action movies + users who like them)
  - Theme 2: "Romance fan"  (high for romance movies + those users)

  To predict User2's rating of Movie1:
  1. Find User2's theme preferences (from U)
  2. Find Movie1's theme content (from V^T)
  3. Combine using importance weights (from S)
  4. That's the predicted rating!
```

---

## Python: Simple Recommender

```python
import numpy as np

ratings = np.array([
    [5, 4, 1, 1, 2],
    [4, 5, 1, 2, 1],
    [1, 1, 5, 4, 5],
    [2, 1, 4, 5, 4],
    [1, 2, 5, 4, 4],
])

U, s, Vt = np.linalg.svd(ratings, full_matrices=False)

k = 2
U_k = U[:, :k]
S_k = np.diag(s[:k])
Vt_k = Vt[:k, :]

approx = U_k @ S_k @ Vt_k
print(f"Original ratings:\n{ratings}")
print(f"\nSVD approximation (rank {k}):\n{np.round(approx, 1)}")

print(f"\nSingular values: {np.round(s, 2)}")
print(f"Top {k} capture {s[:k].sum()/s.sum()*100:.1f}% of total")
```

---

## Latent Semantic Analysis (LSA)

SVD on a term-document matrix finds hidden topics:

```
  Terms x Documents matrix:

            Doc1  Doc2  Doc3  Doc4
  "cat"   [  3     0     2     0  ]
  "dog"   [  2     0     3     0  ]
  "car"   [  0     4     0     3  ]
  "truck" [  0     3     0     4  ]

  SVD discovers:
  Theme 1: "Pets"     (cat, dog cluster together)
  Theme 2: "Vehicles" (car, truck cluster together)

  Now you can find similar documents even if they
  share NO words — because they share themes!
```

---

## Python: Simple LSA

```python
import numpy as np

term_doc = np.array([
    [3, 0, 2, 0],
    [2, 0, 3, 0],
    [0, 4, 0, 3],
    [0, 3, 0, 4],
    [1, 1, 1, 1],
])
terms = ["cat", "dog", "car", "truck", "the"]

U, s, Vt = np.linalg.svd(term_doc, full_matrices=False)

k = 2
doc_themes = (np.diag(s[:k]) @ Vt[:k, :]).T

print("Documents in theme space:")
for i in range(4):
    print(f"  Doc{i+1}: [{doc_themes[i, 0]:+.2f}, {doc_themes[i, 1]:+.2f}]")

def cosine_sim(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

print(f"\nDoc1 vs Doc3 (both about pets): {cosine_sim(doc_themes[0], doc_themes[2]):.4f}")
print(f"Doc1 vs Doc2 (pets vs vehicles): {cosine_sim(doc_themes[0], doc_themes[1]):.4f}")
```

---

## Truncated SVD vs Full SVD

```
  Full SVD:
  A (m x n) = U (m x m) @ S (m x n) @ V^T (n x n)
  Exact reconstruction.

  Truncated SVD (rank k):
  A_k = U_k (m x k) @ S_k (k x k) @ V_k^T (k x n)
  Best rank-k approximation!
  (Eckart-Young theorem guarantees this)

  In practice, you almost always use truncated SVD.
  Full SVD is too expensive for large matrices.
```

---

## Connection to Eigendecomposition

```
  If A = U @ S @ V^T, then:

  A^T @ A = V @ S^2 @ V^T    (eigendecomposition!)
  A @ A^T = U @ S^2 @ U^T    (eigendecomposition!)

  Singular values = square roots of eigenvalues of A^T @ A

  So SVD generalizes eigendecomposition to non-square matrices.
```

---

## Key Takeaways

```
  +------------------------------------------------------+
  |  SVD: A = U @ S @ V^T  (works on ANY matrix)         |
  |  Singular values = importance of each component       |
  |  Low-rank approx = keep top k components = compress   |
  |  Recommendations = SVD on ratings matrix               |
  |  LSA = SVD on term-document matrix                     |
  |  Best rank-k approximation guaranteed!                 |
  +------------------------------------------------------+
```

---

## Exercises

**Exercise 1:** Compute the SVD of `[[1, 2], [3, 4], [5, 6]]`.
Reconstruct it from U, S, Vt and verify.

**Exercise 2:** Create a 50x50 matrix that's actually rank 3
(hint: sum of 3 outer products). Run SVD and verify only 3
singular values are significant.

```python
import numpy as np
np.random.seed(42)

a1, b1 = np.random.randn(50), np.random.randn(50)
a2, b2 = np.random.randn(50), np.random.randn(50)
a3, b3 = np.random.randn(50), np.random.randn(50)

A = np.outer(a1, b1) + np.outer(a2, b2) + np.outer(a3, b3)
pass
```

**Exercise 3:** Build a recommendation system. Create a 20x10
user-movie matrix with some missing values (zeros). Use rank-2
SVD to predict the missing ratings.

**Exercise 4:** Compute the reconstruction error for ranks
1, 2, 5, 10, 20 on a random 100x50 matrix. Plot or print
how error decreases with rank.

**Exercise 5:** Verify that the singular values of A are the
square roots of the eigenvalues of `A.T @ A`.

---

[Next: Lesson 08 - Derivatives ->](08-derivatives.md)
