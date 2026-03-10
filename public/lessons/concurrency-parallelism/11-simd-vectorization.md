# Lesson 11: SIMD & Vectorization

> One instruction, many data points.
> The CPU's built-in parallel processing.

---

## The Analogy

Regular (scalar) processing: a teacher grades one exam at
a time. Read question 1, check answer, move to the next.

SIMD processing: the teacher has a transparent overlay
with all correct answers. Place it on the exam and check
ALL answers at once.

```
  SCALAR (SISD):                   SIMD:
  Process one element at a time    Process N elements at once

  a[0] + b[0] = c[0]              a[0..3] + b[0..3] = c[0..3]
  a[1] + b[1] = c[1]              (ONE instruction!)
  a[2] + b[2] = c[2]
  a[3] + b[3] = c[3]
  (FOUR instructions)

  +---+---+---+---+    +---+---+---+---+
  | a0| a1| a2| a3| +  | b0| b1| b2| b3|
  +---+---+---+---+    +---+---+---+---+
          |   ONE ADD instruction   |
          v                         v
  +---+---+---+---+
  | c0| c1| c2| c3|
  +---+---+---+---+
```

---

## SIMD Register Sizes

```
  EVOLUTION OF x86 SIMD:

  +----------+--------+-------+------------------------------+
  | Name     | Width  | Year  | Float Elements               |
  +----------+--------+-------+------------------------------+
  | SSE      | 128bit | 1999  | 4 x float32 or 2 x float64  |
  | AVX      | 256bit | 2011  | 8 x float32 or 4 x float64  |
  | AVX-512  | 512bit | 2017  | 16 x float32 or 8 x float64 |
  +----------+--------+-------+------------------------------+

  ARM SIMD:
  +----------+--------+-------+------------------------------+
  | NEON     | 128bit | 2004  | 4 x float32                  |
  | SVE      | 128-   | 2020  | Scalable (hardware decides)  |
  |          | 2048bit|       |                              |
  +----------+--------+-------+------------------------------+

  AVX-256 REGISTER:
  +------+------+------+------+------+------+------+------+
  | f32  | f32  | f32  | f32  | f32  | f32  | f32  | f32  |
  +------+------+------+------+------+------+------+------+
  |<--                  256 bits                       -->|
  8 floats processed per instruction = 8x theoretical speedup
```

---

## Auto-Vectorization

The compiler converts your scalar code to SIMD automatically.

```
  YOUR CODE (scalar):
  for i in range(n):
      c[i] = a[i] + b[i]

  COMPILER OUTPUT (vectorized, conceptual):
  for i in range(0, n, 8):      // step by 8 (AVX width)
      vec_a = load_256(a[i:i+8])
      vec_b = load_256(b[i:i+8])
      vec_c = vec_add_256(vec_a, vec_b)
      store_256(c[i:i+8], vec_c)

  THINGS THAT PREVENT AUTO-VECTORIZATION:
  +---------------------------------------------------+
  | Loop-carried dependencies:                         |
  |   a[i] = a[i-1] + 1  (each element depends on    |
  |                        the previous)               |
  +---------------------------------------------------+
  | Pointer aliasing:                                  |
  |   void add(float* a, float* b, float* c)          |
  |   Compiler can't prove a, b, c don't overlap      |
  |   Fix: use restrict keyword in C                   |
  +---------------------------------------------------+
  | Complex control flow:                              |
  |   if (a[i] > 0) c[i] = a[i] + b[i]              |
  |   else c[i] = a[i] - b[i]                        |
  |   (can be fixed with SIMD masking)                |
  +---------------------------------------------------+
  | Non-contiguous memory access:                      |
  |   c[i] = a[indices[i]]  (gather, slower)          |
  +---------------------------------------------------+
```

---

## C Intrinsics Example

```c
#include <immintrin.h>
#include <stdio.h>

void add_arrays_scalar(float* a, float* b, float* c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];
    }
}

void add_arrays_avx(float* a, float* b, float* c, int n) {
    int i = 0;
    for (; i + 8 <= n; i += 8) {
        __m256 va = _mm256_loadu_ps(&a[i]);
        __m256 vb = _mm256_loadu_ps(&b[i]);
        __m256 vc = _mm256_add_ps(va, vb);
        _mm256_storeu_ps(&c[i], vc);
    }
    for (; i < n; i++) {
        c[i] = a[i] + b[i];
    }
}

int main() {
    const int N = 1024;
    float a[N], b[N], c[N];

    for (int i = 0; i < N; i++) {
        a[i] = (float)i;
        b[i] = (float)(N - i);
    }

    add_arrays_avx(a, b, c, N);

    printf("c[0]=%f, c[511]=%f, c[1023]=%f\n",
           c[0], c[511], c[1023]);
    return 0;
}
```

---

## Rust SIMD

```rust
use std::arch::x86_64::*;

unsafe fn dot_product_avx(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len());
    let n = a.len();
    let mut sum = _mm256_setzero_ps();
    let mut i = 0;

    while i + 8 <= n {
        let va = _mm256_loadu_ps(a.as_ptr().add(i));
        let vb = _mm256_loadu_ps(b.as_ptr().add(i));
        let prod = _mm256_mul_ps(va, vb);
        sum = _mm256_add_ps(sum, prod);
        i += 8;
    }

    let mut result = [0.0f32; 8];
    _mm256_storeu_ps(result.as_mut_ptr(), sum);
    let mut total: f32 = result.iter().sum();

    while i < n {
        total += a[i] * b[i];
        i += 1;
    }

    total
}

fn main() {
    let a: Vec<f32> = (0..1024).map(|x| x as f32).collect();
    let b: Vec<f32> = (0..1024).map(|x| (1024 - x) as f32).collect();

    let result = unsafe { dot_product_avx(&a, &b) };
    println!("Dot product: {}", result);
}
```

---

## Portable SIMD with Python (NumPy)

NumPy uses SIMD internally. Writing NumPy idiomatically
gives you SIMD for free.

```python
import numpy as np
import time

n = 10_000_000

a = np.random.randn(n).astype(np.float32)
b = np.random.randn(n).astype(np.float32)

start = time.perf_counter()
c_numpy = a + b
numpy_time = time.perf_counter() - start

start = time.perf_counter()
c_loop = np.empty(n, dtype=np.float32)
for i in range(n):
    c_loop[i] = a[i] + b[i]
loop_time = time.perf_counter() - start

print(f"NumPy (SIMD):  {numpy_time:.4f}s")
print(f"Python loop:   {loop_time:.4f}s")
print(f"Speedup:       {loop_time / numpy_time:.1f}x")
```

---

## SIMD Patterns

```
  PATTERN 1: REDUCTION (sum, max, min)
  [a0, a1, a2, a3, a4, a5, a6, a7]
  Load into vector, accumulate partial sums,
  horizontal add at the end.

  PATTERN 2: FILTERING (select elements matching condition)
  Compare: mask = a[i] > threshold
  Compress: gather matching elements contiguously

  PATTERN 3: STRUCTURE OF ARRAYS (SoA)
  BAD for SIMD (Array of Structs):
  [{x,y,z}, {x,y,z}, {x,y,z}, {x,y,z}]
  Memory: x y z x y z x y z x y z (interleaved)

  GOOD for SIMD (Struct of Arrays):
  {xx: [x,x,x,x], yy: [y,y,y,y], zz: [z,z,z,z]}
  Memory: x x x x | y y y y | z z z z (contiguous)

  Load 4 x-values at once: perfect SIMD load!

  PATTERN 4: LOOP UNROLLING
  Process 2 or 4 vector widths per iteration.
  Reduces loop overhead, enables instruction pipelining.
```

---

## Checking Vectorization

```
  GCC:   gcc -O3 -fopt-info-vec -fopt-info-vec-missed
  Clang: clang -O3 -Rpass=loop-vectorize
  Rust:  RUSTFLAGS="-C target-cpu=native" cargo build --release
  Intel: icc -O3 -qopt-report=5

  GODBOLT COMPILER EXPLORER:
  Paste your code at godbolt.org
  Look for: vaddps, vmulps, vmovups (AVX instructions)
  If you see: addss, mulss (scalar), it's NOT vectorized.

  EXAMPLE OUTPUT:
  .L3:
      vmovups ymm0, [rdi+rax]      <-- load 8 floats from a
      vaddps  ymm0, ymm0, [rsi+rax] <-- add 8 floats from b
      vmovups [rdx+rax], ymm0       <-- store 8 floats to c
      add     rax, 32
      cmp     rax, rcx
      jne     .L3
                                     VECTORIZED!
```

---

## Performance Expectations

```
  THEORETICAL SPEEDUP:
  +----------+----------+--------------------+
  | SIMD     | Width    | Speedup (f32)      |
  +----------+----------+--------------------+
  | SSE      | 128-bit  | 4x                 |
  | AVX      | 256-bit  | 8x                 |
  | AVX-512  | 512-bit  | 16x                |
  +----------+----------+--------------------+

  REAL-WORLD SPEEDUP (accounting for overhead):
  +---------------------+--------------+
  | Operation           | Actual       |
  +---------------------+--------------+
  | Array addition      | 4-8x         |
  | Dot product         | 3-6x         |
  | String search       | 2-4x         |
  | Complex branching   | 1-2x         |
  | Random access       | 1-1.5x       |
  +---------------------+--------------+

  Memory bandwidth is often the bottleneck,
  not compute. SIMD helps most when data is
  in L1/L2 cache.
```

---

## Exercises

### Exercise 1: Vectorized Max

Write a function that finds the maximum value in an array
using SIMD intrinsics (C/Rust) or verify that NumPy's
`np.max()` is vectorized by comparing with a Python loop.

### Exercise 2: SoA vs AoS

Benchmark processing 1M 3D points:
- AoS: `[{x,y,z}, {x,y,z}, ...]`
- SoA: `{xs: [...], ys: [...], zs: [...]}`
Compute the distance from the origin for each point.
Measure the speedup from SoA layout.

### Exercise 3: Auto-Vectorization Blockers

Write a simple loop in C, compile with `-O3 -fopt-info-vec`,
then intentionally break vectorization by:
1. Adding a loop-carried dependency
2. Using non-contiguous memory access
3. Adding a function call inside the loop
Verify the compiler reports each as "not vectorized."

### Exercise 4: SIMD String Search

Implement a function that searches for a byte value in a
large buffer using SIMD comparison (compare 32 bytes at
once with AVX2). Compare performance with `memchr`.

---

## Key Takeaways

```
  1. SIMD: one instruction processes multiple data elements
  2. AVX processes 8 floats per instruction (256-bit)
  3. Auto-vectorization: compiler does it for simple loops
  4. Dependencies, aliasing, branches prevent vectorization
  5. Structure of Arrays (SoA) is SIMD-friendly
  6. Intrinsics give explicit control but reduce portability
  7. NumPy/libraries use SIMD internally
  8. Memory bandwidth often limits real-world SIMD gains
  9. Check compiler output to verify vectorization
  10. Real speedups are 2-8x, not the theoretical maximum
```

---

Next: [Lesson 12 — GPU Parallelism](./12-gpu-parallelism.md)
