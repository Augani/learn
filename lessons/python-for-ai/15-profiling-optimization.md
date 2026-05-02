# Lesson 15: Profiling & Optimization

> You wouldn't tune a car engine without a dashboard.
> Profiling is your speedometer for code.

---

## The Golden Rule

```
  DON'T GUESS. MEASURE.

  ┌──────────────────────────────────────────────┐
  │  "Premature optimization is the root of      │
  │   all evil" -- Donald Knuth                   │
  │                                               │
  │  Step 1: Write correct code                   │
  │  Step 2: Profile to find bottlenecks          │
  │  Step 3: Optimize ONLY the slow parts         │
  │  Step 4: Measure again to confirm improvement │
  └──────────────────────────────────────────────┘

  Time distribution in typical ML code:
  ┌────────────────────────────────────┐
  │ Data loading    ████████░░ 40%     │
  │ Preprocessing   ████░░░░░░ 20%     │
  │ Model training  ██████░░░░ 30%     │
  │ Evaluation      ██░░░░░░░░ 10%     │
  └────────────────────────────────────┘
  Fix data loading first -- biggest payoff!
```

---

## Quick Timing: time and timeit

```python
import time
import timeit
import numpy as np

data = np.random.randn(1_000_000)

start = time.perf_counter()
result = np.sort(data)
elapsed = time.perf_counter() - start
print(f"np.sort: {elapsed:.4f}s")

t = timeit.timeit(lambda: np.sort(data), number=10)
print(f"np.sort avg: {t / 10:.4f}s")

t_list = timeit.timeit(lambda: sorted(data.tolist()), number=10)
print(f"sorted() avg: {t_list / 10:.4f}s")
```

---

## cProfile: The Full Picture

cProfile shows you where every second goes.
Like a detailed receipt of how your code spent its time.

```python
import cProfile
import pstats
import numpy as np
from io import StringIO


def slow_pipeline():
    data = np.random.randn(100_000, 50)

    normalized = np.zeros_like(data)
    for i in range(data.shape[1]):
        col = data[:, i]
        normalized[:, i] = (col - col.mean()) / col.std()

    distances = np.zeros((1000, 1000))
    subset = normalized[:1000]
    for i in range(1000):
        for j in range(i + 1, 1000):
            diff = subset[i] - subset[j]
            distances[i, j] = np.sqrt(np.sum(diff ** 2))
            distances[j, i] = distances[i, j]

    return distances


profiler = cProfile.Profile()
profiler.enable()
result = slow_pipeline()
profiler.disable()

stream = StringIO()
stats = pstats.Stats(profiler, stream=stream)
stats.sort_stats("cumulative")
stats.print_stats(20)
print(stream.getvalue())
```

```bash
python -m cProfile -s cumulative my_script.py

python -m cProfile -o profile.out my_script.py
```

---

## Reading cProfile Output

```
  ncalls  tottime  percall  cumtime  percall  filename:lineno(function)
  ──────  ───────  ───────  ───────  ───────  ─────────────────────────
  1       0.001    0.001    12.345   12.345   script.py:10(slow_pipeline)
  499500  8.200    0.000    11.100   0.000    script.py:20(<loop body>)
  50      0.800    0.016    0.800    0.016    {built-in method numpy.core}
  1       0.200    0.200    0.200    0.200    script.py:12(<normalize>)

  KEY:
  ncalls  = number of times the function was called
  tottime = time spent IN this function (not in subfunctions)
  cumtime = time spent in this function AND all subfunctions
  percall = time per call

  Look for:
  1. High tottime  --> function itself is slow
  2. High ncalls   --> function called too often
  3. Big gap between tottime and cumtime --> slow subfunctions
```

---

## line_profiler: Line-by-Line Detail

```bash
pip install line_profiler
```

```python
import numpy as np


def process_data(data):
    means = np.mean(data, axis=0)
    stds = np.std(data, axis=0)
    normalized = (data - means) / stds

    results = []
    for row in normalized:
        results.append(np.sum(row ** 2))

    return np.array(results)
```

```bash
kernprof -l -v my_script.py
```

```
  Line #  Hits    Time     Per Hit  % Time  Line Contents
  ======  ====    ====     =======  ======  =============
  5       1       1200     1200.0   2.4     means = np.mean(data, axis=0)
  6       1       1100     1100.0   2.2     stds = np.std(data, axis=0)
  7       1       800      800.0    1.6     normalized = (data - means) / stds
  9       1       5        5.0      0.0     results = []
  10      100000  35000    0.4      70.0    for row in normalized:  <-- BOTTLENECK
  11      100000  12000    0.1      24.0        results.append(...)
  13      1       50       50.0     0.1     return np.array(results)

  The Python loop is 94% of the time!
  Replace it with vectorized NumPy.
```

---

## memory_profiler: RAM Usage

```bash
pip install memory_profiler
```

```python
import numpy as np
from memory_profiler import profile


@profile
def memory_hog():
    big_list = [i ** 2 for i in range(10_000_000)]
    big_array = np.array(big_list)
    del big_list
    result = big_array.sum()
    del big_array
    return result
```

```
  Line #    Mem usage    Increment   Contents
  ======    =========    =========   ========
  6         50.0 MiB     0.0 MiB    def memory_hog():
  7         430.0 MiB    380.0 MiB      big_list = [...]    <-- 380 MB!
  8         506.0 MiB    76.0 MiB       big_array = np.array(big_list)
  9         126.0 MiB    -380.0 MiB     del big_list
  10        126.0 MiB    0.0 MiB        result = big_array.sum()
  11        50.0 MiB     -76.0 MiB      del big_array

  Python list of ints: 380 MB
  NumPy array of same: 76 MB  (5x smaller!)
```

---

## Common Bottlenecks and Fixes

```
  BOTTLENECK                   FIX
  ──────────────────────       ────────────────────────────
  Python for loops over data   Vectorize with NumPy
  Repeated DataFrame copies    Use inplace or views
  Loading full dataset to RAM  Use chunked reading
  String operations in loops   Use pandas vectorized str
  Appending to lists in loop   Pre-allocate arrays
  Recomputing same values      Cache / memoize
  Single-threaded I/O          Use concurrent.futures
  GIL-bound CPU work           Use multiprocessing
```

---

## Vectorization: The Biggest Win

```python
import numpy as np
import timeit

data = np.random.randn(1_000_000)

def python_loop(arr):
    result = np.empty_like(arr)
    for i in range(len(arr)):
        if arr[i] > 0:
            result[i] = arr[i]
        else:
            result[i] = 0.0
    return result

def numpy_vectorized(arr):
    return np.where(arr > 0, arr, 0.0)

t_loop = timeit.timeit(lambda: python_loop(data), number=1)
t_vec = timeit.timeit(lambda: numpy_vectorized(data), number=1)

print(f"Python loop: {t_loop:.3f}s")
print(f"NumPy vectorized: {t_vec:.5f}s")
print(f"Speedup: {t_loop / t_vec:.0f}x")
```

```
  Typical results:
  Python loop:     1.200s
  NumPy vectorized: 0.003s
  Speedup: 400x

  WHY?
  ┌──────────────────────────────────────┐
  │ Python loop: interpreter overhead    │
  │   per element -- type checks,        │
  │   bounds checks, function calls      │
  │                                      │
  │ NumPy: single C function call,       │
  │   operates on contiguous memory,     │
  │   no per-element Python overhead     │
  └──────────────────────────────────────┘
```

---

## Caching and Memoization

```python
from functools import lru_cache
import numpy as np
import time


@lru_cache(maxsize=128)
def expensive_computation(n: int) -> float:
    time.sleep(0.1)
    return sum(i ** 2 for i in range(n))


start = time.perf_counter()
result1 = expensive_computation(1000)
first_call = time.perf_counter() - start

start = time.perf_counter()
result2 = expensive_computation(1000)
cached_call = time.perf_counter() - start

print(f"First call: {first_call:.3f}s")
print(f"Cached call: {cached_call:.6f}s")
```

---

## Multiprocessing for CPU-Bound Work

```python
import multiprocessing as mp
import numpy as np
import time


def process_chunk(chunk: np.ndarray) -> float:
    result = 0.0
    for val in chunk:
        result += np.sin(val) ** 2 + np.cos(val) ** 2
    return result


def sequential(data, n_chunks):
    chunks = np.array_split(data, n_chunks)
    return sum(process_chunk(c) for c in chunks)


def parallel(data, n_chunks):
    chunks = np.array_split(data, n_chunks)
    with mp.Pool(processes=n_chunks) as pool:
        results = pool.map(process_chunk, chunks)
    return sum(results)


if __name__ == "__main__":
    data = np.random.randn(500_000)
    n_cores = mp.cpu_count()

    start = time.perf_counter()
    r1 = sequential(data, n_cores)
    t_seq = time.perf_counter() - start

    start = time.perf_counter()
    r2 = parallel(data, n_cores)
    t_par = time.perf_counter() - start

    print(f"Sequential: {t_seq:.3f}s")
    print(f"Parallel ({n_cores} cores): {t_par:.3f}s")
    print(f"Speedup: {t_seq / t_par:.1f}x")
```

---

## Cython Basics

Cython compiles Python to C. Like turbocharging your engine.

```python
# save as fast_math.pyx
import numpy as np
cimport numpy as np
cimport cython

@cython.boundscheck(False)
@cython.wraparound(False)
def fast_distance(double[:] a, double[:] b):
    cdef int n = a.shape[0]
    cdef double total = 0.0
    cdef int i
    for i in range(n):
        total += (a[i] - b[i]) ** 2
    return total ** 0.5
```

```python
# setup.py
from setuptools import setup
from Cython.Build import cythonize
import numpy as np

setup(
    ext_modules=cythonize("fast_math.pyx"),
    include_dirs=[np.get_include()],
)
```

```bash
python setup.py build_ext --inplace
```

```
  PERFORMANCE LADDER
  ==================

  Pure Python loop:     1x       (baseline)
  NumPy vectorized:     100x     (usually enough)
  Cython:               200x     (when NumPy can't help)
  C extension:          250x     (maximum effort)

  Rule of thumb:
  Try NumPy first. Only reach for Cython if
  your inner loop can't be vectorized.
```

---

## Practical Optimization Checklist

```
  ┌───┬──────────────────────────────────────────┐
  │ 1 │ Profile first -- find the actual hotspot  │
  │ 2 │ Vectorize loops with NumPy                │
  │ 3 │ Use appropriate data types (float32)       │
  │ 4 │ Pre-allocate arrays instead of append      │
  │ 5 │ Cache repeated computations                │
  │ 6 │ Use generators for large data streams      │
  │ 7 │ Parallelize I/O with threads               │
  │ 8 │ Parallelize CPU with multiprocessing       │
  │ 9 │ Consider Cython for tight inner loops      │
  │10 │ Last resort: rewrite hotspot in C/Rust     │
  └───┴──────────────────────────────────────────┘
```

---

## Exercises

**Exercise 1:** Profile a function that computes pairwise Euclidean
distances between 5000 points in 50 dimensions using nested Python
loops. Identify the bottleneck, then rewrite using NumPy broadcasting.
Compare times.

**Exercise 2:** Use memory_profiler to track a function that reads a
1GB CSV in one shot. Refactor it to use chunked reading with pandas
`read_csv(chunksize=...)`. Compare peak memory.

**Exercise 3:** Write a data preprocessing pipeline with 5 steps.
Profile it with cProfile. Find which step is slowest. Optimize it.
Verify the speedup with timeit.

**Exercise 4:** Take a function with a Python loop that can't be
easily vectorized (e.g., a state machine over a sequence). Speed
it up using either Cython or numba (`@njit`). Benchmark both.

**Exercise 5:** Build a parallel data loader using
`concurrent.futures.ProcessPoolExecutor` that loads and preprocesses
10 CSV files simultaneously. Compare with sequential loading.

---

[Next: Lesson 16 - Packaging & Distribution ->](16-packaging-distribution.md)
