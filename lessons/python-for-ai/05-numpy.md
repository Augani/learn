# Lesson 05: NumPy

> NumPy is like switching from a hand calculator to a spreadsheet.
> Same math, but you operate on entire columns at once instead of cell by cell.

---

## Why NumPy Exists

Python loops are slow. NumPy moves the loops into compiled C code.
It's like hiring a factory to stamp out parts instead of hand-carving
each one.

```python
import numpy as np
import time

size = 1_000_000

python_list = list(range(size))
start = time.perf_counter()
result_py = [x * 2 for x in python_list]
py_time = time.perf_counter() - start

np_array = np.arange(size)
start = time.perf_counter()
result_np = np_array * 2
np_time = time.perf_counter() - start

print(f"Python list: {py_time:.4f}s")
print(f"NumPy array: {np_time:.4f}s")
print(f"NumPy is {py_time / np_time:.0f}x faster")
```

```
  Python list:              NumPy array:
  ┌───┬───┬───┬───┐        ┌───┬───┬───┬───┐
  │ 1 │ 2 │ 3 │ 4 │        │ 1 │ 2 │ 3 │ 4 │
  └─┬─┴─┬─┴─┬─┴─┬─┘        └───┴───┴───┴───┘
    │   │   │   │           Contiguous C array
    v   v   v   v           One type, packed tight
   obj obj obj obj          CPU cache-friendly
   (scattered in memory)
```

---

## Creating Arrays

```python
import numpy as np

a = np.array([1, 2, 3, 4, 5])
print(f"1D: {a}")

b = np.array([[1, 2, 3], [4, 5, 6]])
print(f"2D:\n{b}")

print(f"Shape: {b.shape}")
print(f"Dtype: {b.dtype}")
print(f"Ndim: {b.ndim}")
print(f"Size: {b.size}")
```

### Factory Functions

```python
import numpy as np

print(np.zeros((3, 4)))
print(np.ones((2, 3)))
print(np.full((2, 2), 7.0))
print(np.eye(3))
print(np.arange(0, 10, 2))
print(np.linspace(0, 1, 5))

rng = np.random.default_rng(42)
print(rng.standard_normal((3, 3)))
print(rng.integers(0, 10, size=(2, 4)))
```

---

## Indexing and Slicing

Like spreadsheet cell references. Row first, column second.
Same as matrix notation in math class.

```python
import numpy as np

m = np.array([[10, 20, 30],
              [40, 50, 60],
              [70, 80, 90]])

print(f"Element [1,2]: {m[1, 2]}")
print(f"Row 0: {m[0]}")
print(f"Col 1: {m[:, 1]}")
print(f"Submatrix:\n{m[0:2, 1:3]}")
```

```
  m = [[10, 20, 30],
       [40, 50, 60],
       [70, 80, 90]]

       col 0  col 1  col 2
        │      │      │
  row 0─┤  10  │  20  │  30
  row 1─┤  40  │  50  │  60
  row 2─┤  70  │  80  │  90

  m[1, 2]    = 60        (row 1, col 2)
  m[:, 1]    = [20,50,80] (all rows, col 1)
  m[0:2, 1:] = [[20,30],  (rows 0-1, cols 1+)
                 [50,60]]
```

### Boolean Indexing

Like filtering rows in a spreadsheet with a formula.

```python
import numpy as np

scores = np.array([85, 92, 78, 95, 67, 88])
names = np.array(["Alice", "Bob", "Carol", "Dave", "Eve", "Frank"])

passed = scores >= 80
print(f"Mask: {passed}")
print(f"Passed: {names[passed]}")
print(f"Scores: {scores[passed]}")

scores[scores < 80] = 80
print(f"Curved: {scores}")
```

### Fancy Indexing

```python
import numpy as np

data = np.array([10, 20, 30, 40, 50])

indices = np.array([0, 3, 4])
print(f"Selected: {data[indices]}")

order = np.array([4, 2, 0, 3, 1])
print(f"Reordered: {data[order]}")
```

---

## Broadcasting

Broadcasting is NumPy's killer feature. It's like a smart projector
that automatically scales images to fit the screen. When array shapes
don't match, NumPy stretches the smaller one to fit.

```python
import numpy as np

a = np.array([[1, 2, 3],
              [4, 5, 6]])
b = np.array([10, 20, 30])

print(a + b)
```

```
  Broadcasting Rules:
  1. Compare shapes from the RIGHT
  2. Dimensions match if they're equal OR one of them is 1
  3. Missing dimensions are treated as 1

  a.shape = (2, 3)
  b.shape =    (3,)  -> treated as (1, 3)

  Step 1: (2, 3) vs (1, 3) -> 3 == 3 ✓, 2 vs 1 -> stretch!
  Result: (2, 3)

  a = [[1, 2, 3],     b = [[10, 20, 30],    a+b = [[11, 22, 33],
       [4, 5, 6]]          [10, 20, 30]]           [14, 25, 36]]
                       (b stretched to 2 rows)
```

### Common Broadcasting Patterns

```python
import numpy as np

data = np.array([[1.0, 200.0, 0.5],
                 [2.0, 400.0, 0.8],
                 [3.0, 100.0, 0.3]])

col_means = data.mean(axis=0)
col_stds = data.std(axis=0)
normalized = (data - col_means) / col_stds
print(f"Means after: {normalized.mean(axis=0)}")
print(f"Stds after: {normalized.std(axis=0)}")

row_vector = np.array([[1, 2, 3]])
col_vector = np.array([[10], [20], [30]])
outer = row_vector + col_vector
print(f"Outer sum:\n{outer}")
```

---

## Vectorized Operations

Think of vectorized operations as conveyor belts. Instead of
picking up each item, transforming it, and putting it down,
you run the whole belt through the machine at once.

```python
import numpy as np

a = np.array([1, 2, 3, 4])
b = np.array([5, 6, 7, 8])

print(f"Add: {a + b}")
print(f"Multiply: {a * b}")
print(f"Power: {a ** 2}")
print(f"Dot: {np.dot(a, b)}")
print(f"Sum: {a.sum()}")
print(f"Mean: {a.mean()}")
print(f"Std: {a.std()}")
```

### Matrix Operations

```python
import numpy as np

A = np.array([[1, 2], [3, 4]])
B = np.array([[5, 6], [7, 8]])

print(f"Element-wise multiply:\n{A * B}")
print(f"Matrix multiply:\n{A @ B}")
print(f"Transpose:\n{A.T}")
print(f"Inverse:\n{np.linalg.inv(A)}")
print(f"Determinant: {np.linalg.det(A):.1f}")

eigenvalues, eigenvectors = np.linalg.eig(A)
print(f"Eigenvalues: {eigenvalues}")
```

---

## Reshaping

Reshaping is like rearranging books on a shelf. Same books,
different arrangement. The total number of elements must stay the same.

```python
import numpy as np

a = np.arange(12)
print(f"Original: {a}")

b = a.reshape(3, 4)
print(f"3x4:\n{b}")

c = a.reshape(2, 2, 3)
print(f"2x2x3:\n{c}")

d = a.reshape(4, -1)
print(f"4x? (auto):\n{d}")

flat = b.ravel()
print(f"Flattened: {flat}")
```

```
  reshape(12,) -> (3, 4):
  [0,1,2,3,4,5,6,7,8,9,10,11]
       │
       v
  [[ 0,  1,  2,  3],
   [ 4,  5,  6,  7],
   [ 8,  9, 10, 11]]

  -1 means "figure it out":
  reshape(4, -1)  ->  12/4 = 3  ->  (4, 3)
```

---

## Views vs Copies

This is critical. Slicing creates a view (shared memory),
not a copy. Like looking through a window vs taking a photo.

```python
import numpy as np

original = np.array([1, 2, 3, 4, 5])

view = original[1:4]
view[0] = 99
print(f"Original after view change: {original}")

copy = original[1:4].copy()
copy[0] = 0
print(f"Original after copy change: {original}")
```

---

## Aggregations Along Axes

The `axis` parameter is like choosing which direction to
collapse in a spreadsheet. `axis=0` collapses rows (downward),
`axis=1` collapses columns (rightward).

```python
import numpy as np

data = np.array([[1, 2, 3],
                 [4, 5, 6],
                 [7, 8, 9]])

print(f"Sum all: {data.sum()}")
print(f"Sum rows (axis=0): {data.sum(axis=0)}")
print(f"Sum cols (axis=1): {data.sum(axis=1)}")
print(f"Max per row: {data.max(axis=1)}")
print(f"Argmax per col: {data.argmax(axis=0)}")
```

```
  axis=0 (collapse rows, result has columns)
  ┌───┬───┬───┐
  │ 1 │ 2 │ 3 │ ──┐
  ├───┼───┼───┤   │ sum
  │ 4 │ 5 │ 6 │ ──┤ down
  ├───┼───┼───┤   │
  │ 7 │ 8 │ 9 │ ──┘
  └───┴───┴───┘
  [12, 15, 18]

  axis=1 (collapse cols, result has rows)
  ┌───┬───┬───┐
  │ 1 │ 2 │ 3 │──> 6
  ├───┼───┼───┤
  │ 4 │ 5 │ 6 │──> 15
  ├───┼───┼───┤
  │ 7 │ 8 │ 9 │──> 24
  └───┴───┴───┘
```

---

## Stacking and Splitting

```python
import numpy as np

a = np.array([1, 2, 3])
b = np.array([4, 5, 6])

print(f"vstack:\n{np.vstack([a, b])}")
print(f"hstack: {np.hstack([a, b])}")
print(f"column_stack:\n{np.column_stack([a, b])}")

big = np.arange(12).reshape(4, 3)
parts = np.split(big, 2, axis=0)
print(f"Split:\n{parts[0]}\n---\n{parts[1]}")
```

---

## Practical: Feature Normalization

```python
import numpy as np

rng = np.random.default_rng(42)
features = rng.standard_normal((100, 4)) * np.array([1, 100, 0.01, 50])
features += np.array([5, 200, 0.5, 100])

print(f"Before - means: {features.mean(axis=0).round(2)}")
print(f"Before - stds:  {features.std(axis=0).round(2)}")

means = features.mean(axis=0)
stds = features.std(axis=0)
normalized = (features - means) / stds

print(f"After  - means: {normalized.mean(axis=0).round(4)}")
print(f"After  - stds:  {normalized.std(axis=0).round(4)}")
```

---

## Exercises

1. **Matrix Math**: Create a 5x5 random matrix. Compute its transpose,
   determinant, inverse (if it exists), and eigenvalues. Verify that
   `A @ A_inv` is approximately the identity matrix.

2. **Broadcasting Challenge**: Given a (100, 3) array of RGB pixel values
   (0-255), normalize each channel independently to 0-1 using broadcasting.
   Then apply gamma correction: `pixel ** (1/2.2)`.

3. **Boolean Masking**: Generate 1000 random test scores (0-100).
   Find the mean score of students who scored above the 75th percentile.
   Replace all scores below 60 with 60 (grade curving).

4. **Image Manipulation**: Create a 64x64 "image" (2D array). Draw a
   white border (1), black center (0), and a diagonal line of 0.5 values.
   Use only NumPy operations, no loops.

5. **Performance Race**: Implement dot product three ways: Python loop,
   list comprehension with sum, and `np.dot`. Time each with arrays
   of 1 million elements. Report the speedup factors.

---

[Next: Lesson 06 - Pandas ->](06-pandas.md)
