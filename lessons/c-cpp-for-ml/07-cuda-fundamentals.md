# Lesson 07 — CUDA Fundamentals

> **Analogy:** A CPU is like a brilliant professor who can solve any problem
> but works alone. A GPU is a factory floor with 10,000 workers — each one
> can only do simple tasks, but they all work simultaneously. Training a
> neural network? That's millions of simple multiply-and-add operations.
> Perfect factory work.

## CPU vs GPU Architecture

```
  CPU (few powerful cores)              GPU (many simple cores)
  ═══════════════════════               ═══════════════════════

  ┌─────┐ ┌─────┐                     ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐
  │ ALU │ │ ALU │                     │ ││ ││ ││ ││ ││ ││ ││ │
  │     │ │     │  4-16 cores         │ ││ ││ ││ ││ ││ ││ ││ │
  │ Big │ │ Big │  each very fast     │ ││ ││ ││ ││ ││ ││ ││ │
  │cache│ │cache│  complex logic      │ ││ ││ ││ ││ ││ ││ ││ │
  └─────┘ └─────┘                     └─┘└─┘└─┘└─┘└─┘└─┘└─┘└─┘
                                      ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐
  Good at:                            │ ││ ││ ││ ││ ││ ││ ││ │
  - Complex branching                 └─┘└─┘└─┘└─┘└─┘└─┘└─┘└─┘
  - Sequential logic                  ... thousands of cores
  - Operating system tasks            Each core: simple, slow alone
                                      Together: massive throughput
                                      Good at: data parallelism
```

## CUDA Execution Model

```
  YOUR CODE                   GPU HARDWARE
  ═════════                   ════════════

  Grid                        GPU
  ┌─────────────────────┐     ┌─────────────────────┐
  │ Block(0,0) Block(1,0)│     │  SM 0    SM 1       │
  │ Block(0,1) Block(1,1)│     │  SM 2    SM 3       │
  └─────────────────────┘     │  ...     SM N       │
                              └─────────────────────┘
  Each Block:
  ┌───────────────────┐       Each SM (Streaming Multiprocessor):
  │ Thread Thread ... │       - Has its own shared memory
  │ Thread Thread ... │       - Executes one or more blocks
  │ Thread Thread ... │       - Threads execute in warps of 32
  └───────────────────┘

  Grid    = all the work
  Block   = a team of workers (up to 1024 threads)
  Thread  = one worker doing one piece of the job
  Warp    = 32 threads that move in lockstep
```

### The Hierarchy

```
  Grid
  ├── Block (0,0)
  │   ├── Thread 0
  │   ├── Thread 1
  │   ├── ...
  │   └── Thread 255
  ├── Block (1,0)
  │   ├── Thread 0
  │   └── ...
  └── Block (N,M)
      └── ...

  Like an army:
  Grid   = the entire army
  Block  = a platoon
  Thread = a soldier
  Warp   = a squad (always 32)
```

## Your First CUDA Kernel

```cuda
#include <cstdio>

__global__ void hello_kernel() {
    int tid = threadIdx.x + blockIdx.x * blockDim.x;
    printf("Hello from thread %d (block %d, thread-in-block %d)\n",
           tid, blockIdx.x, threadIdx.x);
}

int main() {
    hello_kernel<<<2, 4>>>();
    cudaDeviceSynchronize();
    return 0;
}
```

```bash
nvcc -o hello hello.cu && ./hello
```

```
  kernel<<<numBlocks, threadsPerBlock>>>()

  hello_kernel<<<2, 4>>>()
  means: 2 blocks, 4 threads per block = 8 threads total

  Block 0: threads 0,1,2,3
  Block 1: threads 4,5,6,7

  <<<>>> is CUDA's special syntax. No C++ equivalent.
```

### Thread Indexing

```
  For a 1D grid:
  global_id = blockIdx.x * blockDim.x + threadIdx.x

  ┌───────────────┬───────────────┬───────────────┐
  │   Block 0     │   Block 1     │   Block 2     │
  │ t0 t1 t2 t3  │ t0 t1 t2 t3  │ t0 t1 t2 t3  │
  │ g0 g1 g2 g3  │ g4 g5 g6 g7  │ g8 g9 g10 g11 │
  └───────────────┴───────────────┴───────────────┘

  blockIdx.x  = which block am I in? (0, 1, or 2)
  blockDim.x  = how many threads per block? (4)
  threadIdx.x = which thread am I within my block? (0-3)
  global_id   = my unique ID across ALL threads
```

## Vector Addition — The "Hello World" of CUDA

```cuda
#include <cstdio>
#include <cstdlib>

__global__ void vec_add(const float* a, const float* b, float* c, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        c[idx] = a[idx] + b[idx];
    }
}

int main() {
    int n = 1000000;
    size_t bytes = n * sizeof(float);

    float* h_a = (float*)malloc(bytes);
    float* h_b = (float*)malloc(bytes);
    float* h_c = (float*)malloc(bytes);

    for (int i = 0; i < n; i++) {
        h_a[i] = 1.0f;
        h_b[i] = 2.0f;
    }

    float *d_a, *d_b, *d_c;
    cudaMalloc(&d_a, bytes);
    cudaMalloc(&d_b, bytes);
    cudaMalloc(&d_c, bytes);

    cudaMemcpy(d_a, h_a, bytes, cudaMemcpyHostToDevice);
    cudaMemcpy(d_b, h_b, bytes, cudaMemcpyHostToDevice);

    int threads_per_block = 256;
    int num_blocks = (n + threads_per_block - 1) / threads_per_block;
    vec_add<<<num_blocks, threads_per_block>>>(d_a, d_b, d_c, n);

    cudaMemcpy(h_c, d_c, bytes, cudaMemcpyDeviceToHost);

    printf("c[0] = %f, c[999999] = %f\n", h_c[0], h_c[999999]);

    cudaFree(d_a);
    cudaFree(d_b);
    cudaFree(d_c);
    free(h_a);
    free(h_b);
    free(h_c);

    return 0;
}
```

## GPU Memory Hierarchy

```
  SPEED                          SIZE
  (fastest)                      (smallest)

  ┌──────────────────┐
  │    Registers     │  Per thread.   ~255 registers.   Fastest.
  ├──────────────────┤
  │  Shared Memory   │  Per block.    ~48-164 KB.       Very fast.
  ├──────────────────┤
  │   L1/L2 Cache    │  Per SM/GPU.   Hardware managed.
  ├──────────────────┤
  │  Global Memory   │  Entire GPU.   8-80 GB.          Slow (HBM).
  ├──────────────────┤
  │   Host Memory    │  CPU RAM.      GBs-TBs.          Slowest path.
  └──────────────────┘

  The #1 optimization: minimize global memory access.
  The #2 optimization: use shared memory as a manual cache.

  Think of it like:
  Registers    = notes in your hand
  Shared mem   = whiteboard in your team's room
  Global mem   = filing cabinet across the building
  Host mem     = warehouse in another city
```

## Memory Transfer — The Bottleneck

```
  CPU (Host)                    GPU (Device)
  ┌──────────┐   PCIe Bus      ┌──────────┐
  │          │ ═══════════════> │          │
  │  h_data  │  cudaMemcpy     │  d_data  │
  │          │  H2D             │          │
  │          │ <═══════════════ │          │
  │          │  cudaMemcpy     │          │
  │          │  D2H             │          │
  └──────────┘                  └──────────┘

  PCIe bandwidth: ~12-32 GB/s
  GPU HBM bandwidth: ~900-3000 GB/s

  The transfer over PCIe is often the bottleneck!
  Like shipping materials to the factory takes longer
  than the factory processing them.
```

## CUDA Error Checking

```cuda
#include <cstdio>
#include <cstdlib>

#define CUDA_CHECK(call) do { \
    cudaError_t err = call; \
    if (err != cudaSuccess) { \
        fprintf(stderr, "CUDA error at %s:%d: %s\n", \
                __FILE__, __LINE__, cudaGetErrorString(err)); \
        exit(1); \
    } \
} while(0)

int main() {
    float* d_data;
    CUDA_CHECK(cudaMalloc(&d_data, 1024 * sizeof(float)));
    CUDA_CHECK(cudaMemset(d_data, 0, 1024 * sizeof(float)));
    CUDA_CHECK(cudaFree(d_data));

    printf("All CUDA calls succeeded\n");
    return 0;
}
```

## Querying GPU Properties

```cuda
#include <cstdio>

int main() {
    int device_count;
    cudaGetDeviceCount(&device_count);
    printf("Found %d CUDA device(s)\n", device_count);

    for (int i = 0; i < device_count; i++) {
        cudaDeviceProp prop;
        cudaGetDeviceProperties(&prop, i);
        printf("\nDevice %d: %s\n", i, prop.name);
        printf("  Compute capability: %d.%d\n", prop.major, prop.minor);
        printf("  SMs: %d\n", prop.multiProcessorCount);
        printf("  Max threads/block: %d\n", prop.maxThreadsPerBlock);
        printf("  Global memory: %.1f GB\n",
               prop.totalGlobalMem / 1e9);
        printf("  Shared mem/block: %zu KB\n",
               prop.sharedMemPerBlock / 1024);
        printf("  Warp size: %d\n", prop.warpSize);
    }
    return 0;
}
```

## Exercises

1. **Thread ID printer:** Write a kernel with 3 blocks of 8 threads each.
   Print `blockIdx.x`, `threadIdx.x`, and the global thread ID from each
   thread.

2. **Element-wise operations:** Write CUDA kernels for `vec_multiply`,
   `vec_relu` (max(0, x)), and `vec_scale` (multiply by a scalar).
   Test with 1M elements.

3. **2D grid:** Write a kernel that uses a 2D grid to process a 2D matrix.
   Each thread computes one element. Use `blockIdx.x/y`, `threadIdx.x/y`.

4. **GPU properties:** Query your GPU's properties and calculate the
   theoretical max threads that can run simultaneously
   (SMs * max_threads_per_SM).

5. **Bandwidth test:** Measure the time to copy 100MB from host to device
   and back. Calculate the achieved bandwidth in GB/s. Compare to the
   theoretical PCIe bandwidth.

---

[Next: Lesson 08 — CUDA Programming →](08-cuda-programming.md)
