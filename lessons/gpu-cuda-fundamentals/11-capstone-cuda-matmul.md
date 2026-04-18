# Lesson 11: Capstone — CUDA Matrix Multiplication

This is the capstone project for the GPU & CUDA Fundamentals track.
You will write a CUDA matrix multiplication kernel from scratch and
optimize it step by step: naive → tiled → shared memory. Then you will
benchmark your kernels against a CPU implementation and NVIDIA's cuBLAS
library. This exercise ties together everything from the track:
thread indexing, memory hierarchy, shared memory, coalescing, and
profiling.

---

## The Goal

Write three versions of matrix multiplication in CUDA:

```
Optimization Journey:

Version 1: Naive
  Each thread computes one output element.
  Reads from global memory for every multiply.
  Baseline — correct but slow.

Version 2: Tiled
  Threads cooperate to load tiles into shared memory.
  Reduces global memory reads by TILE_SIZE×.
  Major speedup.

Version 3: Tiled + Optimized
  Bank conflict avoidance, loop unrolling,
  double buffering.
  Approaching cuBLAS performance.

Performance target:
┌──────────────────────────────────────────┐
│  CPU (NumPy):        ~1,000 ms           │
│  Naive CUDA:         ~50 ms              │
│  Tiled CUDA:         ~5 ms               │
│  Optimized CUDA:     ~2 ms               │
│  cuBLAS:             ~1 ms               │
│                                          │
│  (for 2048×2048 FP32 matrices)           │
└──────────────────────────────────────────┘
```

---

## Version 1: Naive Matrix Multiply

Each thread computes one element of the output matrix C. Thread (row,
col) computes the dot product of row `row` of A and column `col` of B.

```
Naive Matmul — One Thread Per Output Element:

  Thread (row, col) computes:
  C[row][col] = sum(A[row][k] * B[k][col] for k in range(K))

  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ A        │     │ B        │     │ C        │
  │          │     │          │     │          │
  │ row ──►  │  @  │    │col  │  =  │  ● (r,c) │
  │          │     │    ▼     │     │          │
  └──────────┘     └──────────┘     └──────────┘

  Problem: Thread (row, col) reads K values from A and K values
  from B — all from global memory. For N×N matrices, that is
  2NK global memory reads per thread, N² threads = 2N³ total reads.
  Very memory-inefficient.
```

```c
// Version 1: Naive matrix multiply
__global__ void matmul_naive(float *A, float *B, float *C,
                              int M, int N, int K) {
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;

    if (row < M && col < N) {
        float sum = 0.0f;
        for (int k = 0; k < K; k++) {
            sum += A[row * K + k] * B[k * N + col];
        }
        C[row * N + col] = sum;
    }
}

// Launch configuration
// dim3 block(16, 16);  // 256 threads per block
// dim3 grid((N + 15) / 16, (M + 15) / 16);
// matmul_naive<<<grid, block>>>(d_A, d_B, d_C, M, N, K);
```

---

## Version 2: Tiled Matrix Multiply with Shared Memory

The key optimization: instead of each thread reading from global memory
for every multiply, load a tile of A and B into shared memory, then
compute from shared memory.

```
Tiled Matmul — Shared Memory Reuse:

For each tile:
  1. All threads in block cooperatively load a TILE×TILE
     chunk of A and B into shared memory
  2. __syncthreads()
  3. Each thread computes partial dot product from shared memory
  4. __syncthreads()
  5. Move to next tile

  ┌──────────────────────────────────────────────┐
  │                                              │
  │  A                    B                      │
  │  ┌────┬────┬────┐    ┌────┬────┬────┐       │
  │  │tile│    │    │    │tile│    │    │       │
  │  │ 0  │ 1  │ 2  │    │ 0  │    │    │       │
  │  ├────┤    │    │    ├────┤    │    │       │
  │  │    │    │    │    │tile│    │    │       │
  │  │    │    │    │    │ 1  │    │    │       │
  │  └────┴────┴────┘    ├────┤    │    │       │
  │                       │tile│    │    │       │
  │  Load tile 0 of A     │ 2  │    │    │       │
  │  and tile 0 of B      └────┴────┴────┘       │
  │  into shared memory                          │
  │                                              │
  │  Global memory reads: 2 × N × TILE × N      │
  │  (instead of 2 × N³)                         │
  │  Reduction: TILE× fewer global reads         │
  └──────────────────────────────────────────────┘
```

```c
// Version 2: Tiled matrix multiply
#define TILE_SIZE 32

__global__ void matmul_tiled(float *A, float *B, float *C,
                              int M, int N, int K) {
    __shared__ float As[TILE_SIZE][TILE_SIZE];
    __shared__ float Bs[TILE_SIZE][TILE_SIZE];

    int row = blockIdx.y * TILE_SIZE + threadIdx.y;
    int col = blockIdx.x * TILE_SIZE + threadIdx.x;

    float sum = 0.0f;

    // Loop over tiles along the K dimension
    for (int t = 0; t < (K + TILE_SIZE - 1) / TILE_SIZE; t++) {
        // Cooperatively load tiles into shared memory
        int a_col = t * TILE_SIZE + threadIdx.x;
        int b_row = t * TILE_SIZE + threadIdx.y;

        if (row < M && a_col < K)
            As[threadIdx.y][threadIdx.x] = A[row * K + a_col];
        else
            As[threadIdx.y][threadIdx.x] = 0.0f;

        if (b_row < K && col < N)
            Bs[threadIdx.y][threadIdx.x] = B[b_row * N + col];
        else
            Bs[threadIdx.y][threadIdx.x] = 0.0f;

        __syncthreads();

        // Compute partial dot product from shared memory
        for (int k = 0; k < TILE_SIZE; k++) {
            sum += As[threadIdx.y][k] * Bs[k][threadIdx.x];
        }

        __syncthreads();
    }

    if (row < M && col < N) {
        C[row * N + col] = sum;
    }
}
```

---

## Version 3: Optimized Tiled Matmul

Further optimizations on top of tiling:

```
Optimization Techniques:

1. Avoid shared memory bank conflicts
   - Pad shared memory: float As[TILE_SIZE][TILE_SIZE + 1]
   - Prevents threads in a warp from hitting the same bank

2. Loop unrolling
   - #pragma unroll on the inner loop
   - Compiler generates more efficient code

3. Register blocking
   - Each thread computes multiple output elements
   - Reduces shared memory reads per output element

4. Double buffering
   - Load next tile while computing current tile
   - Overlaps memory access with computation
```

```c
// Version 3: Optimized tiled matmul
#define TILE_SIZE 32

__global__ void matmul_optimized(float *A, float *B, float *C,
                                  int M, int N, int K) {
    // Padded shared memory to avoid bank conflicts
    __shared__ float As[TILE_SIZE][TILE_SIZE + 1];
    __shared__ float Bs[TILE_SIZE][TILE_SIZE + 1];

    int row = blockIdx.y * TILE_SIZE + threadIdx.y;
    int col = blockIdx.x * TILE_SIZE + threadIdx.x;

    float sum = 0.0f;

    for (int t = 0; t < (K + TILE_SIZE - 1) / TILE_SIZE; t++) {
        int a_col = t * TILE_SIZE + threadIdx.x;
        int b_row = t * TILE_SIZE + threadIdx.y;

        As[threadIdx.y][threadIdx.x] =
            (row < M && a_col < K) ? A[row * K + a_col] : 0.0f;
        Bs[threadIdx.y][threadIdx.x] =
            (b_row < K && col < N) ? B[b_row * N + col] : 0.0f;

        __syncthreads();

        // Unrolled inner loop
        #pragma unroll
        for (int k = 0; k < TILE_SIZE; k++) {
            sum += As[threadIdx.y][k] * Bs[k][threadIdx.x];
        }

        __syncthreads();
    }

    if (row < M && col < N) {
        C[row * N + col] = sum;
    }
}
```

---

## Benchmarking: The Full Comparison

Here is a complete benchmarking program you can run:

```python
import numpy as np
import time

def benchmark_cpu(M, N, K, num_runs=5):
    """Benchmark CPU matrix multiply using NumPy."""
    A = np.random.randn(M, K).astype(np.float32)
    B = np.random.randn(K, N).astype(np.float32)

    # Warmup
    _ = A @ B

    times = []
    for _ in range(num_runs):
        start = time.time()
        C = A @ B
        times.append(time.time() - start)

    return np.median(times) * 1000  # ms

def benchmark_gpu(M, N, K, num_runs=20):
    """Benchmark GPU matrix multiply using PyTorch."""
    import torch
    if not torch.cuda.is_available():
        return None

    A = torch.randn(M, K, device='cuda', dtype=torch.float32)
    B = torch.randn(K, N, device='cuda', dtype=torch.float32)

    # Warmup
    for _ in range(5):
        _ = A @ B
    torch.cuda.synchronize()

    # Benchmark with CUDA events
    start_event = torch.cuda.Event(enable_timing=True)
    end_event = torch.cuda.Event(enable_timing=True)

    times = []
    for _ in range(num_runs):
        start_event.record()
        C = A @ B
        end_event.record()
        torch.cuda.synchronize()
        times.append(start_event.elapsed_time(end_event))

    return np.median(times)  # ms

# Run benchmarks
sizes = [512, 1024, 2048, 4096]

print(f"{'Size':<10} {'CPU (ms)':<12} {'GPU (ms)':<12} {'Speedup':<10}")
print("-" * 45)
for size in sizes:
    cpu_time = benchmark_cpu(size, size, size)
    gpu_time = benchmark_gpu(size, size, size)
    if gpu_time:
        speedup = cpu_time / gpu_time
        print(f"{size:<10} {cpu_time:<12.2f} {gpu_time:<12.2f} {speedup:<10.1f}x")
    else:
        print(f"{size:<10} {cpu_time:<12.2f} {'N/A':<12} {'N/A':<10}")
```

```
Expected results (approximate, varies by hardware):

Size       CPU (ms)     GPU (ms)     Speedup
─────────  ──────────   ──────────   ────────
512        15.2         0.08         190x
1024       120.5        0.35         344x
2048       980.3        2.10         467x
4096       7850.0       15.50        506x

The speedup increases with size because:
1. Larger matrices have higher arithmetic intensity
2. More parallelism to exploit
3. GPU overhead (launch, sync) is amortized
```

---

## FLOPS Calculation

```
Matrix multiply C = A @ B where A is (M×K) and B is (K×N):

  FLOPS = 2 × M × N × K
  (each output element needs K multiplies and K-1 adds ≈ 2K ops)

Example: 4096 × 4096 matmul
  FLOPS = 2 × 4096 × 4096 × 4096 = 137.4 GFLOPS

If GPU takes 15.5 ms:
  Throughput = 137.4 GFLOPS / 0.0155 s = 8.9 TFLOPS

H100 peak FP32: 67 TFLOPS
  Efficiency = 8.9 / 67 = 13.3%

cuBLAS typically achieves 60-80% of peak.
Our tiled kernel achieves 10-20% of peak.
The gap is due to advanced optimizations in cuBLAS:
  - Register blocking (each thread computes 4×4 or 8×8 output)
  - Warp-level matrix operations (WMMA)
  - Tensor core utilization
  - Software pipelining
```

---

## Exercises

### Exercise 1: Implement and Benchmark

```python
# If you have a CUDA GPU, implement the full benchmark:

# 1. CPU baseline (NumPy)
# 2. PyTorch GPU (cuBLAS under the hood)
# 3. PyTorch GPU with FP16 (tensor cores)

import torch
import numpy as np
import time

M, N, K = 2048, 2048, 2048

# TODO: Benchmark all three and calculate:
# - Time in milliseconds
# - GFLOPS achieved
# - Percentage of peak GPU performance
# - Speedup of FP16 over FP32 (tensor cores vs CUDA cores)
```

### Exercise 2: Tiled Matmul in Python (Simulation)

```python
import numpy as np

def matmul_tiled_simulation(A, B, tile_size=32):
    """
    Simulate tiled matrix multiplication.
    Count the number of global memory reads vs naive approach.
    """
    M, K = A.shape
    K2, N = B.shape
    assert K == K2
    C = np.zeros((M, N), dtype=np.float32)

    global_reads_naive = 0
    global_reads_tiled = 0

    # Naive: each output element reads K values from A and K from B
    global_reads_naive = M * N * K * 2

    # Tiled: each tile loads tile_size × tile_size from A and B
    num_tiles = (K + tile_size - 1) // tile_size

    for i in range(0, M, tile_size):
        for j in range(0, N, tile_size):
            for t in range(num_tiles):
                # Load tiles (simulated)
                global_reads_tiled += tile_size * tile_size * 2

                # Compute from "shared memory"
                k_start = t * tile_size
                k_end = min(k_start + tile_size, K)
                C[i:i+tile_size, j:j+tile_size] += (
                    A[i:i+tile_size, k_start:k_end] @
                    B[k_start:k_end, j:j+tile_size]
                )

    reduction = global_reads_naive / global_reads_tiled
    print(f"Naive global reads:  {global_reads_naive:,}")
    print(f"Tiled global reads:  {global_reads_tiled:,}")
    print(f"Reduction factor:    {reduction:.1f}x")

    return C

# Test
A = np.random.randn(256, 256).astype(np.float32)
B = np.random.randn(256, 256).astype(np.float32)
C_tiled = matmul_tiled_simulation(A, B, tile_size=32)
C_numpy = A @ B
print(f"Max error: {np.abs(C_tiled - C_numpy).max():.6f}")
```

### Exercise 3: Analyze the Performance Gap

```
Your tiled CUDA kernel achieves 8.9 TFLOPS on an H100 (peak: 67 TFLOPS).
cuBLAS achieves 50 TFLOPS on the same hardware.

TODO:
1. What is the efficiency of your kernel? (8.9 / 67 = ?)
2. What is the efficiency of cuBLAS? (50 / 67 = ?)
3. List three specific optimizations cuBLAS uses that your
   tiled kernel does not.
4. If you switched to FP16 and used tensor cores (peak: 1,979 TFLOPS),
   what throughput would you expect from cuBLAS at 75% efficiency?
5. Why is the gap between naive and tiled much larger than
   the gap between tiled and cuBLAS?
```

---

Congratulations! You have completed the GPU & CUDA Fundamentals track.
You now understand GPU architecture, memory hierarchy, CUDA programming,
ML hardware, and how to profile and optimize GPU code.

Continue your journey:
- **[ML Fundamentals (Track 7)](../ml-fundamentals/00-roadmap.md)** — Apply your hardware knowledge to training neural networks
- **[LLMs & Transformers (Track 8)](../llms-transformers/00-roadmap.md)** — Understand the models that push GPUs to their limits
- **[ML Performance Optimization](../ml-performance-optimization/00-roadmap.md)** — Deep dive into making ML code fast
