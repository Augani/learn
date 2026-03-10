# Lesson 04: Matrix Multiplication

> **Analogy:** A factory assembly line — each station transforms
> the product, and stations chain together.

---

## Why GPUs Exist

GPUs are fast at one thing: matrix multiplication.

```
  CPU: Does one thing at a time (really well)
  GPU: Does thousands of things at once (okay each)

  Matrix multiply = thousands of dot products
  Each dot product is independent
  = PERFECT for parallel execution

  CPU:  [dot1] -> [dot2] -> [dot3] -> ... -> [dot1000]
  GPU:  [dot1]
        [dot2]
        [dot3]     ALL AT THE SAME TIME
        [...]
        [dot1000]
```

This is why AI needs GPUs. Every neural network forward pass
is matrix multiplication.

---

## The Rule

To multiply A (m x n) times B (n x p):

```
  The INNER dimensions must match!

  A:  (m x n)     B:  (n x p)     Result:  (m x p)
          ^--match--^

  (2x3) * (3x4) = (2x4)    OK!
  (2x3) * (4x3) = ???       ERROR! 3 != 4
```

Think of it as a factory:
- Station A produces 3 things
- Station B needs to accept 3 things
- If the sizes don't match, the assembly line breaks.

---

## How It Works: Row-by-Column Dot Products

```
  A (2x3)        B (3x2)         C (2x2)

  [1  2  3]      [7  10]         [?  ?]
  [4  5  6]  *   [8  11]    =    [?  ?]
                  [9  12]

  C[0,0] = Row 0 of A . Col 0 of B
         = [1,2,3] . [7,8,9]
         = 1*7 + 2*8 + 3*9 = 50

  C[0,1] = Row 0 of A . Col 1 of B
         = [1,2,3] . [10,11,12]
         = 1*10 + 2*11 + 3*12 = 68

  C[1,0] = Row 1 of A . Col 0 of B
         = [4,5,6] . [7,8,9]
         = 4*7 + 5*8 + 6*9 = 122

  C[1,1] = Row 1 of A . Col 1 of B
         = [4,5,6] . [10,11,12]
         = 4*10 + 5*11 + 6*12 = 167

  Result:
  [  50   68 ]
  [ 122  167 ]
```

---

## Visual: The Dot Product Pattern

```
  For each element C[i,j]:

  Take ROW i from A:       Take COL j from B:

  [. . .]                  [.]
  [> > >]  <-- this row    [v]  <-- this column
  [. . .]                  [.]

  Dot product them --> C[i,j]

  A                B                 C
  +-----+         +---+            +---+
  |     |         | | |            | X |  <- row 1 . col 1
  |-----|    *    | | |     =      |---|
  |     |         | | |            |   |
  +-----+         +---+            +---+
```

---

## Python: Matrix Multiplication

```python
import numpy as np

A = np.array([[1, 2, 3],
              [4, 5, 6]])

B = np.array([[7, 10],
              [8, 11],
              [9, 12]])

C = A @ B
print(f"A shape: {A.shape}")
print(f"B shape: {B.shape}")
print(f"Result shape: {C.shape}")
print(f"Result:\n{C}")

C_alt = np.matmul(A, B)
C_dot = np.dot(A, B)
print(f"\nAll methods give same result: {np.allclose(C, C_alt) and np.allclose(C, C_dot)}")
```

Output:
```
A shape: (2, 3)
B shape: (3, 2)
Result shape: (2, 2)
Result:
[[ 50  68]
 [122 167]]
All methods give same result: True
```

---

## The Assembly Line Analogy

```
  Factory: Raw materials -> Station A -> Station B -> Product

  AI:      Input data -> Layer 1 (matrix) -> Layer 2 (matrix) -> Output

  Input: [x1, x2, x3]    (1x3)

  Layer 1 weights:  W1 (3x4)     "Extract features"
  Layer 2 weights:  W2 (4x2)     "Make prediction"

  Forward pass:
  hidden = input @ W1           (1x3) @ (3x4) = (1x4)
  output = hidden @ W2          (1x4) @ (4x2) = (1x2)

  Each "station" transforms the data into a new shape.
```

---

## Python: Neural Network Forward Pass

```python
import numpy as np

np.random.seed(42)

input_data = np.array([[0.5, 0.3, 0.8]])

W1 = np.random.randn(3, 4) * 0.1
W2 = np.random.randn(4, 2) * 0.1

hidden = input_data @ W1
print(f"Input shape:  {input_data.shape}")
print(f"W1 shape:     {W1.shape}")
print(f"Hidden shape: {hidden.shape}")
print(f"Hidden:       {hidden}")

output = hidden @ W2
print(f"\nW2 shape:     {W2.shape}")
print(f"Output shape: {output.shape}")
print(f"Output:       {output}")
```

---

## Batch Processing: The Real Power

One input at a time is slow. Batch them!

```
  Single input:     (1 x 768)  @ (768 x 512) = (1 x 512)
  Batch of 32:     (32 x 768)  @ (768 x 512) = (32 x 512)
  Batch of 1024: (1024 x 768)  @ (768 x 512) = (1024 x 512)

  Same weight matrix, process ALL inputs at once!

  [input_1 ]            [ output_1 ]
  [input_2 ]            [ output_2 ]
  [input_3 ]   @ W  =   [ output_3 ]
  [  ...   ]            [   ...    ]
  [input_32]            [ output_32]

  32 separate dot products, all independent,
  all running in parallel on the GPU.
```

---

## Python: Batch Processing

```python
import numpy as np

np.random.seed(42)

batch = np.random.randn(32, 768)
W = np.random.randn(768, 512)

output = batch @ W

print(f"Batch shape:  {batch.shape}")
print(f"Weight shape: {W.shape}")
print(f"Output shape: {output.shape}")

import time

batch_large = np.random.randn(1000, 768)

start = time.time()
for i in range(1000):
    result_i = batch_large[i:i+1] @ W
elapsed_loop = time.time() - start

start = time.time()
result_batch = batch_large @ W
elapsed_batch = time.time() - start

print(f"\nLoop time:  {elapsed_loop:.4f}s")
print(f"Batch time: {elapsed_batch:.4f}s")
print(f"Speedup:    {elapsed_loop / elapsed_batch:.1f}x")
```

---

## Order Matters!

Matrix multiplication is NOT commutative:

```
  A * B  !=  B * A     (usually)

  (2x3) * (3x4) = (2x4)
  (3x4) * (2x3) = ERROR!  (4 != 2)

  Even when both are square:
  [1 2]   [5 6]     [19 22]
  [3 4] * [7 8]  =  [43 50]

  [5 6]   [1 2]     [23 34]
  [7 8] * [3 4]  =  [31 46]

  Different results!
```

But it IS associative: `(A * B) * C = A * (B * C)`

This matters because you can group operations efficiently.

---

## Computational Cost

```
  Multiplying (m x n) by (n x p):
  - Total multiplications: m * n * p
  - Total additions: m * (n-1) * p

  Example: (1000 x 768) @ (768 x 512)
  - Multiplications: 1000 * 768 * 512 = 393,216,000
  - That's ~400 million operations for ONE layer!

  GPT-3 has 96 layers, each with multiple matrix multiplies.
  Now you see why GPUs with thousands of cores are essential.
```

---

## Matrix-Vector Multiplication

A special case that happens constantly:

```
  Matrix (3x3)    Vector (3x1)    Result (3x1)

  [2  0  1]       [1]             [2*1 + 0*3 + 1*5]     [ 7]
  [0  3  0]   *   [3]          =  [0*1 + 3*3 + 0*5]  =  [ 9]
  [1  0  2]       [5]             [1*1 + 0*3 + 2*5]     [11]

  Each row of the matrix does a dot product with the vector.
  3 dot products -> 3 outputs.
```

---

## Key Takeaways

```
  +------------------------------------------------------+
  |  MATMUL = many dot products in parallel               |
  |  Inner dimensions must match: (m,n) @ (n,p) = (m,p)  |
  |  ORDER MATTERS: A @ B != B @ A                        |
  |  Batching = process many inputs with one matmul       |
  |  Neural network = chain of matrix multiplications      |
  |  GPUs exist because matmul is parallelizable           |
  +------------------------------------------------------+
```

---

## Exercises

**Exercise 1:** Multiply by hand:
```
[1 2]     [5 6]
[3 4]  @  [7 8]
```
Then verify with NumPy.

**Exercise 2:** Can you multiply a (3x2) matrix by a (3x4) matrix?
Why or why not? What would you need to change?

**Exercise 3:** Simulate a 3-layer neural network:
```python
import numpy as np
np.random.seed(42)

x = np.random.randn(1, 10)
W1 = np.random.randn(10, 8)
W2 = np.random.randn(8, 4)
W3 = np.random.randn(4, 2)

pass
```

**Exercise 4:** Time the difference between processing 10,000
vectors one at a time vs as a single batch matrix multiply.

**Exercise 5:** Verify that `(A @ B) @ C` equals `A @ (B @ C)`
for random 4x4 matrices A, B, C. Use `np.allclose()`.

---

[Next: Lesson 05 - Matrix Operations ->](05-matrix-operations.md)
