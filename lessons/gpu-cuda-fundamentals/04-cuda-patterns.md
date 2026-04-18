# Lesson 04: CUDA Programming Patterns — Memory Coalescing, Shared Memory, and Reductions

Writing a correct CUDA kernel is step one. Writing a fast one requires
understanding the patterns that make GPUs efficient. This lesson covers
the patterns you will see in every high-performance GPU library: memory
coalescing, shared memory tiling, synchronization, and parallel
reductions.

---

## The Core Idea

GPU performance comes down to two things: **keeping the cores fed with
data** (memory coalescing) and **reusing data once it is loaded**
(shared memory). Every optimization pattern in CUDA is a variation on
these two ideas.

**Analogy: A factory assembly line.** Memory coalescing is like having
workers pick up parts from a conveyor belt in order — efficient. Random
access is like workers running to random shelves — slow. Shared memory
is like a workbench where the team stages parts before assembling —
load once, use many times.

---

## Pattern 1: Memory Coalescing

When threads in a warp access consecutive memory addresses, the GPU
combines those accesses into a single wide memory transaction. This is
called **coalescing** and it is critical for performance.

```
Coalesced Access (GOOD):
Thread 0 reads A[0], Thread 1 reads A[1], Thread 2 reads A[2], ...

  Memory: [ A[0] | A[1] | A[2] | A[3] | ... | A[31] ]
            ↑      ↑      ↑      ↑             ↑
           T0     T1     T2     T3            T31

  → GPU fetches one 128-byte cache line = 32 floats
  → ONE memory transaction for 32 threads


Strided Access (BAD):
Thread 0 reads A[0], Thread 1 reads A[1000], Thread 2 reads A[2000], ...

  Memory: [ A[0] | ... | A[1000] | ... | A[2000] | ... ]
            ↑              ↑                ↑
           T0             T1              T2

  → GPU needs MANY separate memory transactions
  → Up to 32× slower than coalesced access
```

```c
// GOOD: Coalesced access — threads access consecutive elements
__global__ void coalesced(float *data, float *out, int n, int stride) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        out[idx] = data[idx] * 2.0f;  // consecutive addresses
    }
}

// BAD: Strided access — threads access non-consecutive elements
__global__ void strided(float *data, float *out, int n, int stride) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx * stride < n) {
        out[idx] = data[idx * stride] * 2.0f;  // strided addresses
    }
}
```

---

## Pattern 2: Shared Memory Tiling

The idea: load a chunk (tile) of data from slow global memory into fast
shared memory, then have all threads in the block work from shared
memory.

```
Tiled Matrix Multiply:

Instead of each thread reading from global memory for every multiply:

  Global Memory (slow)
  ┌──────────────────────┐
  │  Matrix A    Matrix B │
  │  ┌──────┐   ┌──────┐ │
  │  │      │   │      │ │
  │  │      │   │      │ │
  │  └──────┘   └──────┘ │
  └──────────────────────┘
         │           │
         ▼           ▼
  Load TILE into shared memory (fast):
  ┌──────────────────────┐
  │  Shared Memory       │
  │  ┌────┐    ┌────┐    │
  │  │tile│    │tile│    │
  │  │ A  │    │ B  │    │
  │  └────┘    └────┘    │
  └──────────────────────┘
         │           │
         ▼           ▼
  All threads compute from shared memory
  (many reads, but shared memory is ~80× faster)
```

```c
// Tiled matrix multiply using shared memory
#define TILE_SIZE 16

__global__ void matmul_tiled(float *A, float *B, float *C,
                              int M, int N, int K) {
    // Shared memory for tiles
    __shared__ float tile_A[TILE_SIZE][TILE_SIZE];
    __shared__ float tile_B[TILE_SIZE][TILE_SIZE];

    int row = blockIdx.y * TILE_SIZE + threadIdx.y;
    int col = blockIdx.x * TILE_SIZE + threadIdx.x;
    float sum = 0.0f;

    // Loop over tiles
    for (int t = 0; t < (K + TILE_SIZE - 1) / TILE_SIZE; t++) {
        // Load tile from global to shared memory
        if (row < M && t * TILE_SIZE + threadIdx.x < K)
            tile_A[threadIdx.y][threadIdx.x] =
                A[row * K + t * TILE_SIZE + threadIdx.x];
        else
            tile_A[threadIdx.y][threadIdx.x] = 0.0f;

        if (t * TILE_SIZE + threadIdx.y < K && col < N)
            tile_B[threadIdx.y][threadIdx.x] =
                B[(t * TILE_SIZE + threadIdx.y) * N + col];
        else
            tile_B[threadIdx.y][threadIdx.x] = 0.0f;

        // Wait for all threads to finish loading
        __syncthreads();

        // Compute partial dot product from shared memory
        for (int i = 0; i < TILE_SIZE; i++) {
            sum += tile_A[threadIdx.y][i] * tile_B[i][threadIdx.x];
        }

        // Wait before loading next tile
        __syncthreads();
    }

    if (row < M && col < N) {
        C[row * N + col] = sum;
    }
}
```

---

## Pattern 3: Synchronization

Threads within a block can synchronize using `__syncthreads()`. This
creates a barrier — all threads in the block must reach this point
before any can proceed.

```
__syncthreads() barrier:

  Thread 0:  load ──► __syncthreads() ──► compute
  Thread 1:  load ──► __syncthreads() ──► compute
  Thread 2:  load ──────────► wait... ──► compute
  Thread 3:  load ──► __syncthreads() ──► compute

  All threads must finish loading before ANY thread
  starts computing. This ensures shared memory is
  fully populated before anyone reads from it.
```

Rules:
- `__syncthreads()` synchronizes threads **within a block only**
- There is no built-in way to synchronize across blocks
- Never put `__syncthreads()` inside a conditional that not all threads reach

---

## Pattern 4: Parallel Reduction

A **reduction** combines many values into one: sum, max, min, etc.
The naive approach (one thread loops through everything) wastes the GPU.
The parallel approach uses a tree pattern.

```
Parallel Sum Reduction:

Input: [3, 1, 7, 0, 4, 1, 6, 3]

Step 1: 4 threads, each adds 2 adjacent values
        [3+1, 7+0, 4+1, 6+3]  =  [4, 7, 5, 9]

Step 2: 2 threads
        [4+7, 5+9]  =  [11, 14]

Step 3: 1 thread
        [11+14]  =  [25]

        ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
        │ 3 │ │ 1 │ │ 7 │ │ 0 │ │ 4 │ │ 1 │ │ 6 │ │ 3 │
        └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘
          └──┬──┘      └──┬──┘      └──┬──┘      └──┬──┘
          ┌──┴──┐      ┌──┴──┐      ┌──┴──┐      ┌──┴──┐
          │  4  │      │  7  │      │  5  │      │  9  │
          └──┬──┘      └──┬──┘      └──┬──┘      └──┬──┘
             └─────┬─────┘              └─────┬─────┘
                ┌──┴──┐                    ┌──┴──┐
                │ 11  │                    │ 14  │
                └──┬──┘                    └──┬──┘
                   └───────────┬───────────┘
                            ┌──┴──┐
                            │ 25  │
                            └─────┘

  log2(8) = 3 steps instead of 7 sequential additions
```

```c
// Parallel reduction: sum an array
__global__ void reduce_sum(float *input, float *output, int n) {
    __shared__ float sdata[256];

    int tid = threadIdx.x;
    int idx = blockIdx.x * blockDim.x + threadIdx.x;

    // Load into shared memory
    sdata[tid] = (idx < n) ? input[idx] : 0.0f;
    __syncthreads();

    // Tree reduction in shared memory
    for (int stride = blockDim.x / 2; stride > 0; stride >>= 1) {
        if (tid < stride) {
            sdata[tid] += sdata[tid + stride];
        }
        __syncthreads();
    }

    // Thread 0 writes the block's result
    if (tid == 0) {
        output[blockIdx.x] = sdata[0];
    }
}
```

---

## Common Pitfalls and Debugging Tips

```
Common CUDA Mistakes:

┌──────────────────────────────────────────────────────┐
│ 1. Forgetting bounds checks                          │
│    if (idx < n) { ... }                              │
│    Without this, threads access out-of-bounds memory │
│                                                      │
│ 2. Missing __syncthreads()                           │
│    Reading shared memory before all threads wrote    │
│    → Race condition, wrong results                   │
│                                                      │
│ 3. Warp divergence                                   │
│    if (threadIdx.x % 2 == 0) { path_A } else { B }  │
│    Both paths execute, halving performance           │
│                                                      │
│ 4. Non-coalesced memory access                       │
│    Accessing data[threadIdx.x * stride] with large   │
│    stride → many memory transactions                 │
│                                                      │
│ 5. Shared memory bank conflicts                      │
│    32 banks, stride-32 access → all threads hit      │
│    same bank → serialized                            │
│                                                      │
│ 6. Forgetting cudaDeviceSynchronize()                │
│    Kernel launches are async — CPU continues before  │
│    GPU finishes. Must sync before reading results.   │
└──────────────────────────────────────────────────────┘
```

```c
// Error checking macro — use this after every CUDA call
#define CUDA_CHECK(call) do { \
    cudaError_t err = call; \
    if (err != cudaSuccess) { \
        printf("CUDA error at %s:%d: %s\n", \
               __FILE__, __LINE__, cudaGetErrorString(err)); \
        exit(1); \
    } \
} while(0)

// Usage:
CUDA_CHECK(cudaMalloc(&d_a, bytes));
CUDA_CHECK(cudaMemcpy(d_a, h_a, bytes, cudaMemcpyHostToDevice));
```

---

## Exercises

### Exercise 1: Identify the Pattern

For each operation, identify which CUDA pattern(s) would be most
important:

```
1. Computing the sum of a 10-million element array
   → Pattern: _______________

2. Multiplying two 4096×4096 matrices
   → Pattern: _______________

3. Applying ReLU (max(0, x)) to every element of a tensor
   → Pattern: _______________

4. Finding the maximum value in an array
   → Pattern: _______________
```

### Exercise 2: Fix the Bug

```c
// This kernel has a bug. Find and fix it.
__global__ void buggy_kernel(float *a, float *b, int n) {
    __shared__ float temp[256];
    int idx = blockIdx.x * blockDim.x + threadIdx.x;

    temp[threadIdx.x] = a[idx];
    // BUG: what's missing here?
    b[idx] = temp[threadIdx.x] + temp[threadIdx.x + 1];
}
```

### Exercise 3: Parallel Reduction in Python

```python
import numpy as np

def parallel_reduce_sum(arr):
    """
    Simulate a parallel tree reduction for summing an array.
    At each step, pair up adjacent elements and add them.
    Return the final sum and the number of steps taken.
    """
    data = arr.copy()
    steps = 0

    # TODO: implement the tree reduction pattern
    # Hint: at each step, the active array size halves
    # Keep going until you have one element

    while len(data) > 1:
        # TODO: pair up and add adjacent elements
        pass
        steps += 1

    return data[0], steps

# Test
arr = np.array([3, 1, 7, 0, 4, 1, 6, 3], dtype=np.float32)
result, steps = parallel_reduce_sum(arr)
print(f"Sum: {result} (expected {arr.sum()})")
print(f"Steps: {steps} (expected {int(np.log2(len(arr)))})")
```

---

Next: [Lesson 05: Tensor Operations on GPU](./05-tensor-ops-on-gpu.md)
