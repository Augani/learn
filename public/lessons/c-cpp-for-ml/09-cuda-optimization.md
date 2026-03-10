# Lesson 09 — CUDA Optimization

> **Analogy:** You've got the factory running. Now it's time to optimize
> the assembly line. Workers shouldn't be idle (occupancy), should grab
> materials from the conveyor belt in order (coalesced access), shouldn't
> argue about what to do next (warp divergence), and the supply chain
> should keep up with demand (memory bandwidth).

## Memory Coalescing — The Conveyor Belt

```
  COALESCED (good):
  Thread 0 reads addr[0], Thread 1 reads addr[1], Thread 2 reads addr[2]...
  Hardware merges into ONE 128-byte transaction.

  ┌───────────────────────────────────────────────┐
  │  Memory bus (128 bytes = 32 floats)           │
  │  [0][1][2][3][4][5][6][7]...[31]              │
  │   t0 t1 t2 t3 t4 t5 t6 t7 ... t31            │
  │          ONE transaction                       │
  └───────────────────────────────────────────────┘

  STRIDED (bad):
  Thread 0 reads addr[0], Thread 1 reads addr[32], Thread 2 reads addr[64]
  Hardware needs 32 SEPARATE transactions.

  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │ [0]     │  │ [32]    │  │ [64]    │  ...32 transactions!
  │  t0     │  │  t1     │  │  t2     │
  └─────────┘  └─────────┘  └─────────┘

  Like a conveyor belt: if all workers grab the next item in line,
  the belt moves smoothly. If workers grab random items, the belt
  stops and starts constantly.
```

### Coalescing in Practice

```cuda
#include <cstdio>

__global__ void coalesced_read(const float* matrix, float* output,
                                int rows, int cols) {
    int col = blockIdx.x * blockDim.x + threadIdx.x;
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    if (row < rows && col < cols) {
        output[row * cols + col] = matrix[row * cols + col] * 2.0f;
    }
}

__global__ void strided_read(const float* matrix, float* output,
                              int rows, int cols) {
    int row = blockIdx.x * blockDim.x + threadIdx.x;
    int col = blockIdx.y * blockDim.y + threadIdx.y;
    if (row < rows && col < cols) {
        output[col * rows + row] = matrix[col * rows + row] * 2.0f;
    }
}

int main() {
    int rows = 4096, cols = 4096;
    size_t bytes = rows * cols * sizeof(float);

    float *d_in, *d_out;
    cudaMalloc(&d_in, bytes);
    cudaMalloc(&d_out, bytes);
    cudaMemset(d_in, 1, bytes);

    dim3 block(32, 32);
    dim3 grid((cols + 31) / 32, (rows + 31) / 32);

    cudaEvent_t start, stop;
    cudaEventCreate(&start);
    cudaEventCreate(&stop);

    cudaEventRecord(start);
    coalesced_read<<<grid, block>>>(d_in, d_out, rows, cols);
    cudaEventRecord(stop);
    cudaEventSynchronize(stop);
    float ms1;
    cudaEventElapsedTime(&ms1, start, stop);

    cudaEventRecord(start);
    strided_read<<<grid, block>>>(d_in, d_out, rows, cols);
    cudaEventRecord(stop);
    cudaEventSynchronize(stop);
    float ms2;
    cudaEventElapsedTime(&ms2, start, stop);

    printf("Coalesced: %.3f ms\n", ms1);
    printf("Strided:   %.3f ms\n", ms2);
    printf("Speedup:   %.1fx\n", ms2 / ms1);

    cudaEventDestroy(start);
    cudaEventDestroy(stop);
    cudaFree(d_in);
    cudaFree(d_out);
    return 0;
}
```

## Warp Divergence — Workers Arguing

```
  A warp = 32 threads executing the SAME instruction at the SAME time.

  NO DIVERGENCE (all threads agree):
  ┌────────────────────────────────┐
  │ Warp: if (true) { path_A }    │  All 32 go path A
  │ Time: ████████████████         │  1 pass
  └────────────────────────────────┘

  DIVERGENCE (threads disagree):
  ┌────────────────────────────────┐
  │ Warp: if (tid % 2 == 0)       │
  │ Time: ████████ (path A, even)  │  Pass 1: even threads active
  │       ████████ (path B, odd)   │  Pass 2: odd threads active
  └────────────────────────────────┘
  Takes 2x as long! Idle threads still consume a slot.

  Like a team that must do everything together.
  If half want pizza and half want sushi, they eat
  pizza first (sushi people wait), then sushi (pizza people wait).
```

### Minimize Divergence

```cuda
#include <cstdio>

__global__ void divergent_kernel(float* data, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        if (idx % 2 == 0) {
            data[idx] = data[idx] * 2.0f;
        } else {
            data[idx] = data[idx] + 1.0f;
        }
    }
}

__global__ void non_divergent_kernel(float* data, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        int warp_id = idx / 32;
        if (warp_id % 2 == 0) {
            data[idx] = data[idx] * 2.0f;
        } else {
            data[idx] = data[idx] + 1.0f;
        }
    }
}
```

```
  divergent_kernel: within each warp, half go left, half go right
  non_divergent_kernel: entire warps go one way → no divergence
```

## Occupancy — Keeping Workers Busy

```
  Occupancy = active warps / max possible warps per SM

  Low occupancy:
  ┌──────────────────────────┐
  │ SM: [active][active][  ][  ][  ][  ][  ][  ]  │  25%
  └──────────────────────────┘

  High occupancy:
  ┌──────────────────────────┐
  │ SM: [active][active][active][active][act][act] │  75%
  └──────────────────────────┘

  What limits occupancy:
  1. Threads per block (too few = wasted slots)
  2. Registers per thread (too many = fewer concurrent warps)
  3. Shared memory per block (too much = fewer concurrent blocks)
```

### Checking Occupancy

```cuda
#include <cstdio>

__global__ void my_kernel(float* data, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        data[idx] = data[idx] * 2.0f;
    }
}

int main() {
    int block_size = 256;
    int min_grid_size;
    int optimal_block_size;

    cudaOccupancyMaxPotentialBlockSize(&min_grid_size,
                                        &optimal_block_size,
                                        my_kernel, 0, 0);
    printf("Optimal block size: %d\n", optimal_block_size);
    printf("Min grid size for full occupancy: %d\n", min_grid_size);

    int max_active_blocks;
    cudaOccupancyMaxActiveBlocksPerMultiprocessor(
        &max_active_blocks, my_kernel, block_size, 0);
    printf("Max active blocks per SM with %d threads: %d\n",
           block_size, max_active_blocks);

    return 0;
}
```

## Shared Memory Tiling — The Optimization Pattern

```
  Problem: Matrix multiply needs to read the same data many times.
  Solution: Load a TILE into shared memory, compute from there.

  Without tiling:
  Each thread reads from GLOBAL memory every multiply → SLOW

  With tiling:
  ┌──────────┐    ┌──────────┐
  │  A tile   │    │  B tile   │
  │ (shared)  │    │ (shared)  │
  └─────┬────┘    └─────┬────┘
        │               │
        └───── compute ─┘
              (fast!)

  Load tile from global → shared (one read per element)
  Compute using shared memory (many reads, fast)
  Load next tile...
```

```cuda
#include <cstdio>

#define TILE_SIZE 16

__global__ void matmul_tiled(const float* A, const float* B,
                              float* C, int N) {
    __shared__ float As[TILE_SIZE][TILE_SIZE];
    __shared__ float Bs[TILE_SIZE][TILE_SIZE];

    int row = blockIdx.y * TILE_SIZE + threadIdx.y;
    int col = blockIdx.x * TILE_SIZE + threadIdx.x;

    float sum = 0.0f;

    for (int t = 0; t < (N + TILE_SIZE - 1) / TILE_SIZE; t++) {
        int a_col = t * TILE_SIZE + threadIdx.x;
        int b_row = t * TILE_SIZE + threadIdx.y;

        As[threadIdx.y][threadIdx.x] =
            (row < N && a_col < N) ? A[row * N + a_col] : 0.0f;
        Bs[threadIdx.y][threadIdx.x] =
            (b_row < N && col < N) ? B[b_row * N + col] : 0.0f;

        __syncthreads();

        for (int k = 0; k < TILE_SIZE; k++) {
            sum += As[threadIdx.y][k] * Bs[k][threadIdx.x];
        }

        __syncthreads();
    }

    if (row < N && col < N) {
        C[row * N + col] = sum;
    }
}

int main() {
    int N = 1024;
    size_t bytes = N * N * sizeof(float);

    float *d_A, *d_B, *d_C;
    cudaMalloc(&d_A, bytes);
    cudaMalloc(&d_B, bytes);
    cudaMalloc(&d_C, bytes);

    float* h_A = (float*)malloc(bytes);
    for (int i = 0; i < N * N; i++) h_A[i] = 1.0f;
    cudaMemcpy(d_A, h_A, bytes, cudaMemcpyHostToDevice);
    cudaMemcpy(d_B, h_A, bytes, cudaMemcpyHostToDevice);

    dim3 block(TILE_SIZE, TILE_SIZE);
    dim3 grid((N + TILE_SIZE - 1) / TILE_SIZE,
              (N + TILE_SIZE - 1) / TILE_SIZE);

    cudaEvent_t start, stop;
    cudaEventCreate(&start);
    cudaEventCreate(&stop);

    cudaEventRecord(start);
    matmul_tiled<<<grid, block>>>(d_A, d_B, d_C, N);
    cudaEventRecord(stop);
    cudaEventSynchronize(stop);

    float ms;
    cudaEventElapsedTime(&ms, start, stop);
    float gflops = (2.0f * N * N * N) / (ms * 1e6);
    printf("Tiled matmul: %.3f ms, %.1f GFLOPS\n", ms, gflops);

    cudaEventDestroy(start);
    cudaEventDestroy(stop);
    cudaFree(d_A);
    cudaFree(d_B);
    cudaFree(d_C);
    free(h_A);
    return 0;
}
```

## Profiling with Nsight

```bash
# Nsight Compute (kernel profiling)
ncu --set full ./my_program

# Nsight Systems (timeline profiling)
nsys profile --stats=true ./my_program

# Key metrics to watch:
#   - Memory throughput (% of peak bandwidth)
#   - Compute throughput (% of peak FLOPS)
#   - Occupancy achieved
#   - Warp stall reasons
```

```
  Nsight output tells you:

  ┌─────────────────────────────────────────┐
  │ Metric                  Value    Target │
  │ ──────────────────────  ─────    ────── │
  │ Memory throughput       45%      >60%   │
  │ Compute throughput      30%      >60%   │
  │ Achieved occupancy      62%      >50%   │
  │ Warp stall: memory      55%      <30%   │
  └─────────────────────────────────────────┘

  This kernel is MEMORY BOUND.
  Fix: coalesce accesses, use shared memory, reduce reads.
```

## Register Pressure

```
  Each thread has a limited number of registers (~255 max).
  More registers per thread = fewer threads per SM = lower occupancy.

  Control with:
  __launch_bounds__(maxThreadsPerBlock, minBlocksPerSM)

  Or compiler flag:
  nvcc --maxrregcount=32 ...
```

```cuda
__global__ __launch_bounds__(256, 4)
void optimized_kernel(float* data, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        data[idx] = data[idx] * 2.0f;
    }
}
```

## Optimization Checklist

```
  Priority  Optimization             Impact
  ════════  ═══════════════════════  ══════
  1         Coalesced memory access  10-100x
  2         Sufficient occupancy     2-5x
  3         Shared memory tiling     2-10x
  4         Minimize divergence      1.5-2x
  5         Reduce register usage    1.2-2x
  6         Use streams for overlap  1.5-3x
  7         Vectorized loads (float4) 1.5-2x
  8         Loop unrolling           1.1-1.5x
```

## Exercises

1. **Coalescing test:** Write two kernels: one that reads a 2D matrix
   row-major and one column-major. Time both and measure the difference.

2. **Divergence benchmark:** Write kernels with various branching patterns
   (per-thread, per-warp, per-block) and measure performance differences.

3. **Occupancy tuning:** Experiment with block sizes from 32 to 1024 for
   a simple element-wise kernel. Plot occupancy vs. performance.

4. **Tiled transpose:** Implement matrix transpose using shared memory
   tiles. Compare performance with a naive transpose kernel.

5. **Profile a kernel:** Use `nvcc -Xptxas -v` to see register usage and
   shared memory for the tiled matmul. Try reducing registers with
   `--maxrregcount` and measure the effect.

---

[Next: Lesson 10 — pybind11 →](10-pybind11.md)
