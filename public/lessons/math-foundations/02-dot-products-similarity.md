# Lesson 02: Dot Products and Similarity — Measuring How Alike Things Are

The dot product is the single most important operation in machine learning.
Attention mechanisms use it. Embedding similarity uses it. Every neural
network layer uses it. Once you understand the dot product, you understand
the core computation behind transformers.

---

## The Core Idea

The **dot product** takes two vectors of the same length, multiplies
corresponding elements, and sums the results. One number comes out.

**Analogy: Shopping cart total.** You have a list of item quantities
`[2, 1, 3]` and a list of prices `[$5, $10, $3]`. Your total is
`2×$5 + 1×$10 + 3×$3 = $29`. That is a dot product.

```
Dot product of a and b:

    a = [2,  1,  3]
    b = [5, 10,  3]

    a · b = (2×5) + (1×10) + (3×3)
          =  10   +   10   +   9
          =  29

    Multiply element-wise, then sum.
```

```python
import numpy as np

a = np.array([2, 1, 3])
b = np.array([5, 10, 3])

# Three ways to compute the dot product
dot1 = np.dot(a, b)
dot2 = a @ b
dot3 = np.sum(a * b)

print(f"np.dot:  {dot1}")   # 29
print(f"a @ b:   {dot2}")   # 29
print(f"sum(a*b): {dot3}")  # 29
```

---

## Geometric Interpretation

The dot product also measures how much two vectors point in the
same direction.

```
a · b = |a| × |b| × cos(θ)

where θ is the angle between the vectors.

Same direction (θ = 0°):     cos(0°) = 1    → large positive dot product
Perpendicular (θ = 90°):     cos(90°) = 0   → dot product is 0
Opposite direction (θ = 180°): cos(180°) = -1 → large negative dot product


    Same direction:        Perpendicular:        Opposite:

        a →                    a →                  a →
        b →                    ↑ b                  ← b

    dot product > 0        dot product = 0       dot product < 0
    "similar"              "unrelated"           "opposite"
```

---

## Cosine Similarity

The dot product depends on vector length — longer vectors give bigger
dot products even if they point the same direction. **Cosine similarity**
fixes this by normalizing:

```
cosine_similarity(a, b) = (a · b) / (|a| × |b|)

Result is always between -1 and 1:
    1  = identical direction
    0  = perpendicular (unrelated)
   -1  = opposite direction
```

```python
import numpy as np

def cosine_similarity(a, b):
    """Compute cosine similarity between two vectors."""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    return dot / (norm_a * norm_b)

# Similar vectors
v1 = np.array([1, 2, 3])
v2 = np.array([2, 4, 6])  # same direction, different magnitude
print(f"Same direction:  {cosine_similarity(v1, v2):.4f}")  # 1.0

# Perpendicular vectors
v3 = np.array([1, 0])
v4 = np.array([0, 1])
print(f"Perpendicular:   {cosine_similarity(v3, v4):.4f}")  # 0.0

# Opposite vectors
v5 = np.array([1, 2, 3])
v6 = np.array([-1, -2, -3])
print(f"Opposite:        {cosine_similarity(v5, v6):.4f}")  # -1.0

# Somewhat similar
v7 = np.array([1, 2, 3])
v8 = np.array([1, 2, 4])
print(f"Somewhat similar: {cosine_similarity(v7, v8):.4f}")  # ~0.99
```

---

## Why This Matters for ML

### Embedding Similarity

Word embeddings map words to vectors. Similar words have similar vectors.
Cosine similarity measures how related two words are.

```
Word embedding space (simplified to 2D):

    meaning
      ↑
      │     • king
      │           • queen
      │
      │  • man
      │        • woman
      │
      │                    • car
      │                  • truck
      │
      └──────────────────────────→ another dimension

    cosine_similarity(king, queen) ≈ 0.85  (very similar)
    cosine_similarity(king, car)   ≈ 0.15  (not similar)
```

```python
import numpy as np

# Simulated word embeddings (in reality these are 300-1536 dimensions)
embeddings = {
    "king":   np.array([0.8, 0.9, 0.1, 0.2]),
    "queen":  np.array([0.7, 0.85, 0.15, 0.25]),
    "man":    np.array([0.6, 0.7, 0.05, 0.1]),
    "woman":  np.array([0.5, 0.65, 0.1, 0.15]),
    "car":    np.array([0.1, 0.05, 0.9, 0.8]),
    "truck":  np.array([0.15, 0.1, 0.85, 0.75]),
}

def cosine_sim(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# Compare pairs
pairs = [("king", "queen"), ("king", "car"), ("car", "truck"), ("man", "woman")]
for w1, w2 in pairs:
    sim = cosine_sim(embeddings[w1], embeddings[w2])
    print(f"  {w1:6s} ↔ {w2:6s}: {sim:.4f}")
```

### Attention Scores

In transformers, the attention mechanism computes dot products between
query and key vectors to determine which tokens to pay attention to.
See [Track 8, Lesson 05: Self-Attention](../llms-transformers/05-self-attention.md)
for the full picture.

```
Attention as dot products:

    Query: "What should I focus on?"
    Keys:  "Here's what each token offers"

    score(query, key) = query · key

    High dot product → "pay attention to this token"
    Low dot product  → "ignore this token"

    ┌─────────┐     ┌──────┐     ┌────────┐
    │  Query  │  ·  │ Key₁ │  =  │ Score₁ │  → high (attend)
    │  vector │     │ Key₂ │  =  │ Score₂ │  → low  (ignore)
    │         │     │ Key₃ │  =  │ Score₃ │  → high (attend)
    └─────────┘     └──────┘     └────────┘
```

---

## Dot Product Properties

A few properties that come up in ML:

```
1. Commutative:     a · b = b · a
2. Distributive:    a · (b + c) = a · b + a · c
3. Scalar factor:   (k × a) · b = k × (a · b)
4. Self dot product: a · a = |a|²  (squared magnitude)
```

```python
import numpy as np

a = np.array([1, 2, 3])
b = np.array([4, 5, 6])
c = np.array([7, 8, 9])

# Commutative
print(f"a·b = {a @ b}, b·a = {b @ a}")  # Both 32

# Distributive
print(f"a·(b+c) = {a @ (b+c)}, a·b + a·c = {a@b + a@c}")  # Both 80

# Self dot product = squared magnitude
print(f"a·a = {a @ a}, |a|² = {np.linalg.norm(a)**2:.1f}")  # Both 14
```

---

## Exercises

### Exercise 1: Dot Product by Hand and Code

```python
import numpy as np

a = np.array([3, -2, 5, 1])
b = np.array([1, 4, -1, 2])

# TODO: compute the dot product by hand (on paper), then verify with NumPy
# TODO: compute the cosine similarity between a and b
# TODO: are these vectors more similar or more different? Why?
```

### Exercise 2: Embedding Similarity Search

```python
import numpy as np

# Simulated document embeddings (768 dimensions in real life)
np.random.seed(42)
documents = {
    "python_tutorial": np.random.randn(50),
    "java_tutorial":   np.random.randn(50),
    "cooking_recipe":  np.random.randn(50),
    "baking_guide":    np.random.randn(50),
}

# Make related documents actually similar
documents["java_tutorial"] = documents["python_tutorial"] + np.random.randn(50) * 0.3
documents["baking_guide"] = documents["cooking_recipe"] + np.random.randn(50) * 0.3

query = documents["python_tutorial"] + np.random.randn(50) * 0.1

# TODO: compute cosine similarity between the query and every document
# TODO: rank documents by similarity (most similar first)
# TODO: which document is most similar to the query? Does it make sense?
```

### Exercise 3: Attention Score Simulation

```python
import numpy as np

# Simulate attention: a query attends to 5 keys
np.random.seed(0)
query = np.random.randn(8)   # 8-dimensional query vector
keys = np.random.randn(5, 8) # 5 key vectors, each 8-dimensional

# TODO: compute the dot product of the query with each key
# TODO: which key gets the highest attention score?
# TODO: apply softmax to the scores to get attention weights (they should sum to 1)
#        softmax(x) = exp(x) / sum(exp(x))
# TODO: compute the weighted sum of the keys using the attention weights
#        (this is what attention actually outputs)
```

---

Next: [Lesson 03: Matrix Multiplication](./03-matrix-multiplication.md)
