# Lesson 01: Vectors

> **Analogy:** GPS coordinates — a list of numbers that tells you
> exactly where something is.

---

## What Is a Vector?

A vector is just an ordered list of numbers. That's it.

```
  A GPS coordinate:    (40.7128, -74.0060)   <-- 2D vector
  An RGB color:        (255, 128, 0)          <-- 3D vector
  A word embedding:    (0.2, -0.5, 0.8, ...) <-- 768D vector!
```

Think of your GPS location. Two numbers — latitude and longitude —
pin you to an exact spot on Earth. A vector does the same thing
but in any number of dimensions.

---

## Vectors in 2D

```
        y
        ^
        |       * (3, 4)
    4   +      /
        |     /
    3   +    /
        |   /
    2   +  /
        | /
    1   +/
        |
   -----+-------> x
        0  1  2  3
```

The vector `[3, 4]` is an arrow from the origin to the point (3, 4).

It has two properties:
- **Direction** — which way it points
- **Magnitude** — how long it is

---

## Magnitude (Length)

The magnitude is just the distance formula you learned in school.

For vector `v = [3, 4]`:

```
  ||v|| = sqrt(3^2 + 4^2)
        = sqrt(9 + 16)
        = sqrt(25)
        = 5

  Think of it as a right triangle:

        *  (3, 4)
       /|
    5 / |  4
     /  |
    *---+
      3
```

For any vector, it's the Pythagorean theorem generalized.

---

## Why AI Cares About Vectors

Everything in AI gets turned into vectors:

```
  Words       -->  [0.2, -0.5, 0.8, 0.1, ...]   (embeddings)
  Images      -->  [0.9, 0.1, 0.3, 0.7, ...]   (pixel features)
  Users       -->  [0.4, 0.6, 0.2, 0.8, ...]   (preference scores)
  Documents   -->  [0.1, 0.3, 0.7, 0.2, ...]   (TF-IDF or embeddings)
```

Why? Because once things are vectors, we can do MATH on them:
- Measure similarity (how close are two vectors?)
- Average them (what's the "center" of a group?)
- Transform them (rotate, scale, project)

---

## Vector Addition

Adding vectors = combining movements.

```
  Walk 3 blocks east, 4 blocks north:  [3, 4]
  Then  1 block east, 2 blocks south:  [1, -2]
  Total:                                [4, 2]

        y
        ^
    4   +       * A = [3,4]
        |      /  \
    3   +     /    \
        |    /      v
    2   +   /        * A + B = [4,2]
        |  /        ^
    1   + /        / B = [1,-2]
        |/        /
   -----+--------+---> x
        0  1  2  3  4
```

Just add element by element: `[3+1, 4+(-2)] = [4, 2]`

---

## Scalar Multiplication

Multiply every element by the same number (a "scalar"):

```
  v     = [2, 3]
  2 * v = [4, 6]     <-- same direction, twice as long

        y
        ^
    6   +           * 2v
        |          /
    4   +         /
        |        /
    3   +   * v /
        |  /   /
    2   + /   /
        |/   /
   -----+---+-----> x
        0 2  4
```

This is how "weights" work in neural networks — they scale inputs.

---

## Unit Vectors

A unit vector has magnitude = 1. It captures direction only.

```
  v     = [3, 4]       magnitude = 5
  v_hat = [3/5, 4/5]   magnitude = 1
        = [0.6, 0.8]

  To normalize: divide each element by the magnitude.
```

This is called **normalization** — extremely common in AI.
When you normalize embeddings before comparing them, you're
making sure you compare direction, not size.

---

## Higher Dimensions

You can't draw 768 dimensions, but the math works the same:

```
  2D:  [x, y]              GPS coordinates
  3D:  [x, y, z]           3D space
  768D: [x1, x2, ..., x768]  BERT embeddings

  Addition:     element by element
  Magnitude:    sqrt(x1^2 + x2^2 + ... + xn^2)
  Normalization: divide each by magnitude
```

The leap from 2D to 768D is purely conceptual.
The operations stay identical.

---

## Python: Vectors with NumPy

```python
import numpy as np

v = np.array([3, 4])

magnitude = np.linalg.norm(v)
print(f"Magnitude: {magnitude}")

unit_v = v / magnitude
print(f"Unit vector: {unit_v}")
print(f"Unit magnitude: {np.linalg.norm(unit_v):.4f}")

a = np.array([3, 4])
b = np.array([1, -2])
print(f"Addition: {a + b}")
print(f"Scalar mult: {2 * a}")
```

Output:
```
Magnitude: 5.0
Unit vector: [0.6 0.8]
Unit magnitude: 1.0000
Addition: [4 2]
Scalar mult: [6 8]
```

---

## Python: Simulating Word Embeddings

```python
import numpy as np

king = np.array([0.8, 0.6, 0.9, 0.1])
queen = np.array([0.7, 0.65, 0.2, 0.9])
man = np.array([0.9, 0.5, 0.95, 0.05])
woman = np.array([0.75, 0.6, 0.15, 0.95])

result = king - man + woman
print(f"king - man + woman = {result}")
print(f"queen               = {queen}")

distance = np.linalg.norm(result - queen)
print(f"Distance to queen: {distance:.4f}")
```

This is the famous "king - man + woman ~ queen" analogy.
Vectors make word arithmetic possible.

---

## Key Takeaways

```
  +-----------------------------------------------+
  |  VECTOR = ordered list of numbers              |
  |  MAGNITUDE = length (Pythagorean theorem)      |
  |  UNIT VECTOR = direction only, length = 1      |
  |  NORMALIZATION = divide by magnitude           |
  |  Everything in AI becomes a vector first       |
  +-----------------------------------------------+
```

---

## Exercises

**Exercise 1:** Compute the magnitude of `[1, 2, 2]` by hand,
then verify with NumPy.

**Exercise 2:** Normalize the vector `[5, 0, 0]`. What do you get?
Why does this make intuitive sense?

**Exercise 3:** Given vectors `a = [1, 3]` and `b = [4, -1]`,
compute `a + b`, `a - b`, and `3 * a`.

**Exercise 4:** Write a function that takes a list of vectors and
returns the one with the largest magnitude.

```python
import numpy as np

def largest_vector(vectors):
    pass

vecs = [np.array([1, 2]), np.array([3, 4]), np.array([0, 5])]
print(largest_vector(vecs))
```

**Exercise 5:** Create 5 random 100-dimensional vectors using
`np.random.randn(100)`. Normalize all of them. Verify each has
magnitude 1.

---

[Next: Lesson 02 - Dot Products & Similarity ->](02-dot-products-similarity.md)
