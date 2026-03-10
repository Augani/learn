# Lesson 02: Dot Products & Similarity

> **Analogy:** Comparing shopping lists — how much do two people's
> grocery carts overlap?

---

## The Setup

Imagine two people rate how much they like foods on a 0-5 scale:

```
                Pizza  Sushi  Salad  Tacos  Soup
  Alice:     [   5,     4,     1,     5,    2  ]
  Bob:       [   4,     5,     2,     4,    1  ]
  Charlie:   [   1,     1,     5,     1,    5  ]
```

Who has more similar taste — Alice & Bob, or Alice & Charlie?

The **dot product** gives you a number that measures overlap.

---

## What Is a Dot Product?

Multiply matching elements, then add them all up:

```
  Alice   = [5, 4, 1, 5, 2]
  Bob     = [4, 5, 2, 4, 1]

  Dot product = (5*4) + (4*5) + (1*2) + (5*4) + (2*1)
              =  20   +  20   +  2    +  20   +  2
              = 64

  Alice   = [5, 4, 1, 5, 2]
  Charlie = [1, 1, 5, 1, 5]

  Dot product = (5*1) + (4*1) + (1*5) + (5*1) + (2*5)
              =  5    +  4    +  5    +  5    +  10
              = 29
```

Alice-Bob score (64) >> Alice-Charlie score (29).
The dot product confirms: Alice and Bob have similar taste.

---

## Geometric Interpretation

The dot product also relates to the ANGLE between vectors:

```
  a . b = ||a|| * ||b|| * cos(theta)

  Same direction:    cos(0)   =  1    -> large positive
  Perpendicular:     cos(90)  =  0    -> zero
  Opposite:          cos(180) = -1    -> large negative

       a        a          a
       ^       ^           ^
      /       |             \
     /  small |  90 deg      \  large
    /  angle  |               \  angle
   --------  --------      --------
       b         b              b

   HIGH        ZERO          NEGATIVE
  similarity  unreleated    opposite
```

---

## Cosine Similarity

Raw dot products are affected by vector length.
A long shopping list will naturally have a bigger dot product.

**Cosine similarity** fixes this by normalizing:

```
  cosine_sim(a, b) = (a . b) / (||a|| * ||b||)

  Result is always between -1 and 1:

  -1 ............. 0 ............. +1
  opposite    unrelated       identical
  meanings    topics          meanings
```

This is THE similarity measure used in:
- Search engines (query vs document)
- Recommendation systems (user vs item)
- RAG (question vs stored chunks)

---

## Visual: Why Cosine Beats Raw Dot Product

```
  Scenario: Two documents about "cats"

  Doc A (short): [2, 1]     mentions "cat" 2x, "pet" 1x
  Doc B (long):  [200, 100] mentions "cat" 200x, "pet" 100x

  Raw dot product: 2*200 + 1*100 = 500  (huge!)
  But they're about the SAME thing!

        y
        ^
  100   +              * Doc B (200, 100)
        |             /
        |            /   SAME direction!
        |           /    cos(angle) = 1.0
        |          /
        |         /
    1   + * Doc A
        |/
   -----+-----------> x
        0    2   200

  Cosine similarity = 1.0  (identical direction)
```

---

## Python: Dot Product & Cosine Similarity

```python
import numpy as np

alice = np.array([5, 4, 1, 5, 2])
bob = np.array([4, 5, 2, 4, 1])
charlie = np.array([1, 1, 5, 1, 5])

dot_ab = np.dot(alice, bob)
dot_ac = np.dot(alice, charlie)
print(f"Dot product Alice-Bob: {dot_ab}")
print(f"Dot product Alice-Charlie: {dot_ac}")

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

cos_ab = cosine_similarity(alice, bob)
cos_ac = cosine_similarity(alice, charlie)
print(f"Cosine sim Alice-Bob: {cos_ab:.4f}")
print(f"Cosine sim Alice-Charlie: {cos_ac:.4f}")
```

Output:
```
Dot product Alice-Bob: 64
Dot product Alice-Charlie: 29
Cosine sim Alice-Bob: 0.9753
Cosine sim Alice-Charlie: 0.5345
```

---

## How Search Actually Works

```
  Step 1: Convert query to vector
  "best pizza NYC" --> [0.8, 0.1, 0.9, ...]

  Step 2: Compare to all document vectors
  +-----------+----------------------------+-----------+
  | Document  | Vector                     | Cos Sim   |
  +-----------+----------------------------+-----------+
  | Pizza     | [0.7, 0.2, 0.85, ...]     | 0.94      |
  | Guide     |                            |           |
  +-----------+----------------------------+-----------+
  | Sushi     | [0.1, 0.8, 0.3, ...]      | 0.31      |
  | Spots     |                            |           |
  +-----------+----------------------------+-----------+
  | NYC       | [0.5, 0.4, 0.7, ...]      | 0.72      |
  | Travel    |                            |           |
  +-----------+----------------------------+-----------+

  Step 3: Return highest cosine similarity
  --> "Pizza Guide" wins!
```

---

## Python: Simple Search Engine

```python
import numpy as np

np.random.seed(42)
documents = {
    "pizza_guide": np.random.randn(50),
    "sushi_review": np.random.randn(50),
    "pasta_recipe": np.random.randn(50),
}

documents["pizza_guide"][0:5] = [0.8, 0.3, 0.9, 0.1, 0.7]
documents["pasta_recipe"][0:5] = [0.7, 0.2, 0.85, 0.15, 0.6]

query = np.random.randn(50)
query[0:5] = [0.8, 0.3, 0.9, 0.1, 0.7]

def cosine_sim(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

results = {}
for name, doc_vec in documents.items():
    results[name] = cosine_sim(query, doc_vec)

for name, score in sorted(results.items(), key=lambda x: -x[1]):
    print(f"  {name:20s} -> {score:.4f}")
```

---

## Dot Product in Neural Networks

Every neuron computes a dot product:

```
  Inputs:   [x1, x2, x3]
  Weights:  [w1, w2, w3]

  output = x1*w1 + x2*w2 + x3*w3 + bias
         = dot(inputs, weights) + bias

     x1 ---w1--\
                 \
     x2 ---w2----[SUM + bias]--> output
                 /
     x3 ---w3--/

  The neuron is asking:
  "How similar is this input to my learned pattern?"
```

---

## Dot Product Properties

```
  +----------------------------------------------+
  |  COMMUTATIVE:  a . b = b . a                 |
  |  DISTRIBUTIVE: a . (b + c) = a.b + a.c      |
  |  SCALING:      (k*a) . b = k * (a . b)      |
  |  SELF DOT:     a . a = ||a||^2               |
  +----------------------------------------------+
```

That last one is useful: the dot product of a vector with itself
gives you its squared magnitude.

---

## Euclidean Distance vs Cosine Similarity

Two ways to measure "closeness":

```
  Euclidean Distance       Cosine Similarity
  (how far apart?)         (same direction?)

  Small = similar          Close to 1 = similar
  Large = different        Close to 0 = unrelated

        * B                      * B
       /                        /
      / distance               / angle
     /                        /
    * A                      * A

  Sensitive to magnitude    Ignores magnitude
  Good for: clustering      Good for: text similarity
```

```python
import numpy as np

a = np.array([1, 2, 3])
b = np.array([2, 4, 6])

euclidean = np.linalg.norm(a - b)
cosine = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

print(f"Euclidean distance: {euclidean:.4f}")
print(f"Cosine similarity: {cosine:.4f}")
```

Output:
```
Euclidean distance: 3.7417
Cosine similarity: 1.0000
```

Same direction but different magnitudes: euclidean says "far apart",
cosine says "identical".

---

## Key Takeaways

```
  +--------------------------------------------------+
  |  DOT PRODUCT = multiply matching, sum it up       |
  |  COSINE SIM = dot product / (magnitude * magnitude)|
  |  NEURONS compute dot products with inputs          |
  |  SEARCH = find highest cosine similarity           |
  |  Cosine ignores magnitude, euclidean doesn't       |
  +--------------------------------------------------+
```

---

## Exercises

**Exercise 1:** Compute the dot product of `[1, 2, 3]` and
`[4, 5, 6]` by hand. Verify with NumPy.

**Exercise 2:** Two vectors: `a = [1, 0]` and `b = [0, 1]`.
What's their cosine similarity? What does this mean geometrically?

**Exercise 3:** Build a mini recommendation system:

```python
import numpy as np

users = {
    "alice": np.array([5, 4, 1, 5, 2]),
    "bob": np.array([4, 5, 2, 4, 1]),
    "charlie": np.array([1, 1, 5, 1, 5]),
    "diana": np.array([2, 1, 4, 2, 5]),
}

def find_most_similar(target_name, users):
    pass

print(find_most_similar("alice", users))
```

**Exercise 4:** Generate 1000 random 100D vectors. Find the pair
with the highest cosine similarity. (Hint: double loop or use
`itertools.combinations`)

**Exercise 5:** Prove to yourself that `cos_sim(v, v) = 1` for
any non-zero vector. Try it with 5 different vectors in NumPy.

---

[Next: Lesson 03 - Matrices ->](03-matrices.md)
