# Lesson 10: Parallel Algorithms

> Not all problems can be parallelized equally.
> The art is knowing which ones can and how to structure them.

---

## The Analogy

You need to paint a fence with 100 boards.

**Embarrassingly parallel**: Give 10 painters 10 boards each.
No coordination needed. 10x speedup.

**Partially parallel**: Painters share one paint bucket.
They work in parallel but must take turns dipping.
Less than 10x speedup (contention).

**Sequential**: Each board must be a different shade,
and each shade depends on the previous board's color.
Can't parallelize at all. 1x "speedup."

```
  AMDAHL'S LAW:

  Speedup = 1 / (S + P/N)

  S = serial fraction
  P = parallel fraction (P = 1 - S)
  N = number of processors

  If 5% of your code is serial:
  N=2:   speedup = 1.90x
  N=4:   speedup = 3.48x
  N=16:  speedup = 9.14x
  N=inf: speedup = 20x   (the ceiling!)

  +------+      Even infinite cores can't
  |      |      beat the serial bottleneck.
  | 20x  |. . . . . . . . . . . . . . . . .
  |      |              .
  |      |         .
  | 10x  |     .
  |      |   .
  |      |  .
  |  1x  +.----+----+----+----+----+----+
          1    4    8   16   32   64  cores
```

---

## Map-Reduce

Split the work, process in parallel, combine results.

```
  MAP PHASE:                      REDUCE PHASE:
  Split data into chunks          Combine partial results

  Input: [1,2,3,4,5,6,7,8]

  Chunk 1: [1,2]  -> map(square) -> [1,4]    \
  Chunk 2: [3,4]  -> map(square) -> [9,16]    > reduce(sum) -> 204
  Chunk 3: [5,6]  -> map(square) -> [25,36]  /
  Chunk 4: [7,8]  -> map(square) -> [49,64] /

  Map: embarrassingly parallel (no communication)
  Reduce: tree-structured combining
```

```python
from multiprocessing import Pool
from functools import reduce

def square(x):
    return x * x

def parallel_map_reduce(data, map_fn, reduce_fn, num_workers=4):
    chunk_size = max(1, len(data) // num_workers)
    chunks = [
        data[i:i + chunk_size]
        for i in range(0, len(data), chunk_size)
    ]

    with Pool(num_workers) as pool:
        mapped_chunks = pool.map(
            lambda chunk: [map_fn(x) for x in chunk],
            chunks,
        )

    flat = [item for chunk in mapped_chunks for item in chunk]
    return reduce(reduce_fn, flat)


data = list(range(1, 1_000_001))

with Pool(4) as pool:
    squared = pool.map(square, data)
    total = sum(squared)
    print(f"Sum of squares: {total}")
```

---

## Parallel Prefix (Scan)

Compute all prefixes of an operation in parallel.
Input: [a, b, c, d, e, f, g, h]
Output: [a, a+b, a+b+c, a+b+c+d, ...]

```
  SEQUENTIAL PREFIX SUM: O(N)
  [3, 1, 4, 1, 5, 9, 2, 6]
  [3, 4, 8, 9, 14, 23, 25, 31]

  PARALLEL PREFIX (Blelloch scan): O(N/P + log N)

  STEP 1: UP-SWEEP (reduce)
  [3, 1, 4, 1, 5, 9, 2, 6]
      \+/    \+/    \+/    \+/
  [_, 4, _, 5, _, 14, _, 8]
          \+/          \+/
  [_, _, _, 9, _, _, _, 22]
                  \+/
  [_, _, _, _, _, _, _, 31]

  STEP 2: DOWN-SWEEP (distribute)
  Replace root with 0, propagate:
  [_, _, _, _, _, _, _, 0]
              /           \
  [_, _, _, 0, _, _, _, 9]
        /     \      /     \
  [_, 0, _, 4, _, 9, _, 23]
    / \  / \  / \  / \
  [0, 3, 4, 8, 9, 14, 23, 25]

  WORK: O(N)        same as sequential
  SPAN: O(log N)    parallel depth
  SPEEDUP: O(N / log N)
```

```python
def parallel_prefix_sum(arr):
    n = len(arr)
    if n == 0:
        return []

    result = list(arr)

    offset = 1
    while offset < n:
        for i in range(offset - 1, n, offset * 2):
            right = i + offset
            if right < n:
                result[right] += result[i]
        offset *= 2

    result[n - 1] = 0

    offset = n // 2
    while offset >= 1:
        for i in range(offset - 1, n, offset * 2):
            right = i + offset
            if right < n:
                temp = result[i]
                result[i] = result[right]
                result[right] += temp
        offset //= 2

    return result


data = [3, 1, 4, 1, 5, 9, 2, 6]
print("Input:", data)
print("Exclusive prefix sum:", parallel_prefix_sum(data))
```

---

## Work Stealing

Dynamic load balancing for irregular workloads.

```
  PROBLEM: static partitioning wastes cores on uneven work.

  Thread 1: [task task task task]     (heavy)
  Thread 2: [task task]               (light, idle!)
  Thread 3: [task task task]          (medium)
  Thread 4: [task]                    (light, idle!)

  WORK STEALING:
  Each thread has a DEQUE (double-ended queue) of tasks.
  - Owner pushes/pops from the BOTTOM (stack-like, cache-friendly)
  - Thieves steal from the TOP (opposite end, less contention)

  Thread 1: [task task task task]  <-- Thread 4 steals from here
  Thread 2: [task task]
  Thread 3: [task task task]       <-- Thread 2 steals from here
  Thread 4: [stolen task]

  WHY DEQUE?
  +------------------------------------------+
  | Owner works on recently pushed tasks      |
  | (likely in cache = fast)                  |
  |                                           |
  | Thief steals oldest tasks                 |
  | (likely biggest subtrees = worth stealing)|
  |                                           |
  | Owner and thief rarely conflict           |
  | (opposite ends of the deque)              |
  +------------------------------------------+
```

---

## Fork-Join

Recursive divide-and-conquer with parallel execution.

```
  PATTERN:
  1. FORK: split the problem into subproblems
  2. Solve subproblems in parallel (recursively)
  3. JOIN: combine the results

  PARALLEL MERGE SORT:

  [8, 3, 1, 5, 4, 2, 7, 6]
           |
      fork / \ fork
          /   \
  [8,3,1,5]   [4,2,7,6]
     / \          / \
  [8,3] [1,5]  [4,2] [7,6]    <-- 4 tasks in parallel
    |     |      |     |
  [3,8] [1,5]  [2,4] [6,7]    <-- sort each
    \   /          \   /
  [1,3,5,8]    [2,4,6,7]      <-- merge (join)
       \          /
  [1,2,3,4,5,6,7,8]           <-- final merge (join)
```

```python
from concurrent.futures import ThreadPoolExecutor, Future
from typing import List

def parallel_merge_sort(arr: List[int], pool: ThreadPoolExecutor, threshold: int = 1000) -> List[int]:
    if len(arr) <= threshold:
        return sorted(arr)

    mid = len(arr) // 2
    left_future = pool.submit(parallel_merge_sort, arr[:mid], pool, threshold)
    right = parallel_merge_sort(arr[mid:], pool, threshold)
    left = left_future.result()

    return merge(left, right)

def merge(left: List[int], right: List[int]) -> List[int]:
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result


import random
data = [random.randint(0, 1_000_000) for _ in range(100_000)]

with ThreadPoolExecutor(max_workers=4) as pool:
    sorted_data = parallel_merge_sort(data, pool, threshold=10_000)
    assert sorted_data == sorted(data)
    print(f"Sorted {len(data)} elements")
```

---

## Parallel Patterns Summary

```
  +-----------------+----------+--------+-----------------------+
  | Pattern         | Work     | Span   | Best For              |
  +-----------------+----------+--------+-----------------------+
  | Map             | O(N)     | O(1)   | Independent items     |
  | Reduce          | O(N)     | O(lgN) | Aggregation           |
  | Map-Reduce      | O(N)     | O(lgN) | Transform + aggregate |
  | Prefix Scan     | O(N)     | O(lgN) | Running totals        |
  | Fork-Join       | O(NlgN) | O(lgN) | Divide and conquer    |
  | Pipeline        | O(N)     | O(N/P) | Streaming stages      |
  | Work Stealing   | varies   | varies | Irregular workloads   |
  +-----------------+----------+--------+-----------------------+

  WORK = total operations (sequential cost)
  SPAN = longest chain of dependencies (parallel depth)
  PARALLELISM = Work / Span
```

---

## Gustafson's Law

```
  AMDAHL: fixed problem size, add more processors.
  "How much faster with more cores?"

  GUSTAFSON: fixed time, scale problem size with processors.
  "How much MORE WORK with more cores?"

  Scaled Speedup = N - S * (N - 1)

  N = processors, S = serial fraction

  With S=0.05, N=64:
  Amdahl: speedup = 15.4x
  Gustafson: scaled speedup = 60.85x

  GUSTAFSON IS MORE REALISTIC:
  In practice, when you get more cores,
  you solve BIGGER problems, not the same one faster.
```

---

## Exercises

### Exercise 1: Parallel Word Count

Implement a parallel word counter using map-reduce:
1. Map: each worker counts words in its chunk of text
2. Reduce: combine word counts from all workers
3. Compare performance with 1, 2, 4, 8 workers

### Exercise 2: Parallel Prefix in Practice

Use parallel prefix sum to solve:
Given an array of 0s and 1s, compute for each element
the number of 1s that appear before it (exclusive).

### Exercise 3: Work Stealing Simulator

Build a work-stealing simulator:
1. 4 threads, each with a deque of tasks
2. Tasks have random durations (1-100ms)
3. When a thread's deque is empty, steal from a random peer
4. Track total idle time and compare vs static partitioning

### Exercise 4: Fork-Join Fibonacci

Implement parallel Fibonacci using fork-join:
- fib(n) = fork(fib(n-1)) + fib(n-2)
- Add a sequential cutoff (below n=20, compute sequentially)
- Measure speedup vs naive recursive Fibonacci

---

## Key Takeaways

```
  1. Amdahl's Law: serial fraction limits maximum speedup
  2. Gustafson's Law: scale problem size, not just speed
  3. Map-Reduce: split, transform, combine
  4. Parallel prefix: O(log N) span for cumulative ops
  5. Work stealing: dynamic load balancing via deques
  6. Fork-join: recursive parallel divide-and-conquer
  7. Work = total ops, Span = parallel depth
  8. Parallelism = Work / Span
  9. Always have a sequential cutoff for small subproblems
  10. Embarrassingly parallel = no communication = best case
```

---

Next: [Lesson 11 — SIMD & Vectorization](./11-simd-vectorization.md)
