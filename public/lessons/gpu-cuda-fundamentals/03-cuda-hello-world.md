# Lesson 03: CUDA Programming Basics — Kernels, Threads, Blocks, and Grids

Time to write GPU code. CUDA is NVIDIA's programming model for GPUs.
It extends C/C++ with a few keywords that let you launch thousands of
threads on the GPU. Every PyTorch operation, every transformer forward
pass, every training step — they all compile down to CUDA kernels.

---

## The Core Idea

A **kernel** is a function that runs on the GPU. When you launch a
kernel, you specify how many threads to create. Each thread runs the
same code but operates on different data.

**Analogy: Assigning seats in a stadium.** Imagine a stadium with
sections (blocks), rows, and seats. Every person (thread) has a unique
address: section 3, row 5, seat 12. When you announce "everyone in your
seat, add the two numbers on your card," all 50,000 people do it
simultaneously. That is a kernel launch.

```
CUDA Execution Model:

Grid (the whole stadium)
┌─────────────────────────────────────────────┐
│                                             │
│  Block (0,0)      Block (1,0)      Block (2,0)
│  ┌───────────┐   ┌───────────┐   ┌───────────┐
│  │ T0 T1 T2  │   │ T0 T1 T2  │   │ T0 T1 T2  │
│  │ T3 T4 T5  │   │ T3 T4 T5  │   │ T3 T4 T5  │
│  │ T6 T7 T8  │   │ T6 T7 T8  │   │ T6 T7 T8  │
│  └───────────┘   └───────────┘   └───────────┘
│                                             │
│  Block (0,1)      Block (1,1)      Block (2,1)
│  ┌───────────┐   ┌───────────┐   ┌───────────┐
│  │ T0 T1 T2  │   │ T0 T1 T2  │   │ T0 T1 T2  │
│  │ T3 T4 T5  │   │ T3 T4 T5  │   │ T3 T4 T5  │
│  │ T6 T7 T8  │   │ T6 T7 T8  │   │ T6 T7 T8  │
│  └───────────┘   └───────────┘   └───────────┘
│                                             │
│  Grid: 3×2 blocks                           │
│  Block: 3×3 threads = 9 threads per block   │
│  Total: 3×2 × 9 = 54 threads               │
└─────────────────────────────────────────────┘
```

---

## Thread Indexing: Finding Your Seat

Every thread needs to know which piece of data it should work on.
CUDA provides built-in variables for this:

- `threadIdx.x` — thread's position within its block
- `blockIdx.x` — which block this thread belongs to
- `blockDim.x` — how many threads per block

The **global thread index** (your unique seat number) is:

```
globalIdx = blockIdx.x * blockDim.x + threadIdx.x

Example: 4 blocks of 8 threads each = 32 threads total

Block 0          Block 1          Block 2          Block 3
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 0 1 2 3 4 5 6 7│ 0 1 2 3 4 5 6 7│ 0 1 2 3 4 5 6 7│ 0 1 2 3 4 5 6 7│
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
  threadIdx.x      threadIdx.x      threadIdx.x      threadIdx.x

Global index:
  0 1 2 3 4 5 6 7  8 9 ...15  16 17 ...23  24 25 ...31

Thread in Block 2, position 3:
  globalIdx = 2 * 8 + 3 = 19
```

---

## Hello World: A CUDA Kernel

Here is the simplest possible CUDA program. The `__global__` keyword
marks a function as a kernel that runs on the GPU.

```c
// hello_cuda.cu
#include <stdio.h>

// __global__ means this function runs on the GPU
// and is called from the CPU
__global__ void hello_kernel() {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    printf("Hello from thread %d (block %d, thread %d)\n",
           idx, blockIdx.x, threadIdx.x);
}

int main() {
    // Launch kernel: 2 blocks, 4 threads per block = 8 threads
    //                <<<numBlocks, threadsPerBlock>>>
    hello_kernel<<<2, 4>>>();

    // Wait for GPU to finish
    cudaDeviceSynchronize();

    printf("Done!\n");
    return 0;
}
```

```
Compile and run:
$ nvcc hello_cuda.cu -o hello
$ ./hello

Output (order may vary — threads run in parallel!):
Hello from thread 0 (block 0, thread 0)
Hello from thread 1 (block 0, thread 1)
Hello from thread 2 (block 0, thread 2)
Hello from thread 3 (block 0, thread 3)
Hello from thread 4 (block 1, thread 0)
Hello from thread 5 (block 1, thread 1)
Hello from thread 6 (block 1, thread 2)
Hello from thread 7 (block 1, thread 3)
Done!
```

---

## Vector Addition: Your First Real Kernel

Vector addition is the "hello world" of GPU computing. Each thread
adds one pair of elements.

```
Vector Addition on GPU:

  A:  [ 1.0  2.0  3.0  4.0  5.0  6.0  7.0  8.0 ]
  B:  [ 0.1  0.2  0.3  0.4  0.5  0.6  0.7  0.8 ]
       ─┬──  ─┬──  ─┬──  ─┬──  ─┬──  ─┬──  ─┬──  ─┬──
        T0    T1    T2    T3    T4    T5    T6    T7
       ─┴──  ─┴──  ─┴──  ─┴──  ─┴──  ─┴──  ─┴──  ─┴──
  C:  [ 1.1  2.2  3.3  4.4  5.5  6.6  7.7  8.8 ]

  Each thread computes: C[i] = A[i] + B[i]
  All threads run simultaneously
```

```c
// vector_add.cu
#include <stdio.h>
#include <stdlib.h>

__global__ void vector_add(float *a, float *b, float *c, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;

    // Bounds check — we might launch more threads than elements
    if (idx < n) {
        c[idx] = a[idx] + b[idx];
    }
}

int main() {
    int n = 1000000;  // 1 million elements
    size_t bytes = n * sizeof(float);

    // Allocate host (CPU) memory
    float *h_a = (float*)malloc(bytes);
    float *h_b = (float*)malloc(bytes);
    float *h_c = (float*)malloc(bytes);

    // Initialize data on CPU
    for (int i = 0; i < n; i++) {
        h_a[i] = (float)i;
        h_b[i] = (float)i * 2.0f;
    }

    // Allocate device (GPU) memory
    float *d_a, *d_b, *d_c;
    cudaMalloc(&d_a, bytes);
    cudaMalloc(&d_b, bytes);
    cudaMalloc(&d_c, bytes);

    // Copy data from CPU to GPU
    cudaMemcpy(d_a, h_a, bytes, cudaMemcpyHostToDevice);
    cudaMemcpy(d_b, h_b, bytes, cudaMemcpyHostToDevice);

    // Launch kernel
    int threads_per_block = 256;
    int num_blocks = (n + threads_per_block - 1) / threads_per_block;
    vector_add<<<num_blocks, threads_per_block>>>(d_a, d_b, d_c, n);

    // Copy result back to CPU
    cudaMemcpy(h_c, d_c, bytes, cudaMemcpyDeviceToHost);

    // Verify
    for (int i = 0; i < 5; i++) {
        printf("c[%d] = %.1f (expected %.1f)\n",
               i, h_c[i], h_a[i] + h_b[i]);
    }

    // Free memory
    cudaFree(d_a); cudaFree(d_b); cudaFree(d_c);
    free(h_a); free(h_b); free(h_c);

    return 0;
}
```

---

## The CPU-GPU Data Flow

Notice the pattern: allocate on GPU, copy data to GPU, run kernel,
copy results back. This is the fundamental CPU-GPU workflow.

```
CPU-GPU Data Flow:

  CPU (Host)                    GPU (Device)
  ──────────                    ────────────

  1. Allocate CPU memory
     h_a = malloc(...)

  2. Fill with data
     h_a[i] = ...
                          ───►
  3. Allocate GPU memory         cudaMalloc(&d_a, ...)
                          ───►
  4. Copy to GPU                 cudaMemcpy(d_a, h_a, ...)
                                 H2D (Host to Device)

  5. Launch kernel         ───►  kernel<<<blocks, threads>>>()
     (CPU continues              (GPU runs in parallel)
      or waits)

  6. Copy results back    ◄───   cudaMemcpy(h_c, d_c, ...)
                                 D2H (Device to Host)

  7. Use results on CPU
     printf(h_c[i])
```

This copy overhead is why you want to keep data on the GPU as long as
possible. Moving data between CPU and GPU is slow (PCIe bandwidth is
~32 GB/s vs ~3,000 GB/s GPU memory bandwidth).

---

## Choosing Block and Grid Sizes

How many threads per block? How many blocks? Rules of thumb:

```
Thread Block Size:
┌──────────────────────────────────────────────┐
│ ● Must be a multiple of 32 (warp size)       │
│ ● Common choices: 128, 256, 512              │
│ ● Maximum: 1024 threads per block            │
│ ● 256 is a safe default for most kernels     │
└──────────────────────────────────────────────┘

Grid Size (number of blocks):
┌──────────────────────────────────────────────┐
│ num_blocks = ceil(N / threads_per_block)     │
│                                              │
│ Example: N = 1,000,000 elements              │
│          threads_per_block = 256             │
│          num_blocks = ceil(1M / 256) = 3907  │
│          total threads = 3907 × 256          │
│                        = 1,000,192           │
│          (192 extra threads do nothing —     │
│           the bounds check handles this)     │
└──────────────────────────────────────────────┘
```

---

## Warps: The True Unit of Execution

Threads do not execute individually. They execute in groups of 32
called **warps**. All 32 threads in a warp execute the same instruction
at the same time.

```
A block of 256 threads = 8 warps:

Block
┌─────────────────────────────────────────────┐
│ Warp 0:  threads  0-31   (execute together) │
│ Warp 1:  threads 32-63   (execute together) │
│ Warp 2:  threads 64-95   (execute together) │
│ Warp 3:  threads 96-127  (execute together) │
│ Warp 4:  threads 128-159 (execute together) │
│ Warp 5:  threads 160-191 (execute together) │
│ Warp 6:  threads 192-223 (execute together) │
│ Warp 7:  threads 224-255 (execute together) │
└─────────────────────────────────────────────┘

If threads in a warp take different branches (if/else),
BOTH branches execute and results are masked.
This is called "warp divergence" — avoid it!
```

---

## Python/PyTorch Equivalent

You do not always need to write raw CUDA. PyTorch handles kernel
launches for you. But understanding what happens underneath helps you
write faster code.

```python
import torch

# PyTorch vector addition — this launches a CUDA kernel internally
if torch.cuda.is_available():
    n = 1_000_000
    a = torch.randn(n, device='cuda')
    b = torch.randn(n, device='cuda')

    # This single line launches a CUDA kernel with ~4000 blocks
    c = a + b

    print(f"c[:5] = {c[:5]}")
    print(f"Device: {c.device}")

    # You can also write custom CUDA-like operations with Numba
    from numba import cuda
    import numpy as np

    @cuda.jit
    def vector_add_numba(a, b, c):
        idx = cuda.grid(1)  # shorthand for blockIdx.x * blockDim.x + threadIdx.x
        if idx < a.size:
            c[idx] = a[idx] + b[idx]

    # Allocate and run
    a_np = np.random.randn(n).astype(np.float32)
    b_np = np.random.randn(n).astype(np.float32)
    c_np = np.zeros(n, dtype=np.float32)

    threads = 256
    blocks = (n + threads - 1) // threads
    vector_add_numba[blocks, threads](a_np, b_np, c_np)
    print(f"Numba result[:5] = {c_np[:5]}")
```

---

## Exercises

### Exercise 1: Thread Index Calculation

```
Given a kernel launch: my_kernel<<<8, 128>>>()

TODO:
1. How many total threads are launched?
2. What is the global index of thread 50 in block 3?
3. If you have an array of 900 elements, how many threads
   will do no work (because of the bounds check)?
4. What is the warp count per block?
```

### Exercise 2: Write a CUDA Kernel (Pseudocode)

```
Write a kernel that computes the element-wise square of a vector:
  C[i] = A[i] * A[i]

Pseudocode:
__global__ void square_kernel(float *a, float *c, int n) {
    // TODO: compute global index
    // TODO: bounds check
    // TODO: compute c[idx] = a[idx] * a[idx]
}

How would you launch this for an array of 2,000,000 elements?
```

### Exercise 3: PyTorch GPU Operations

```python
import torch

if torch.cuda.is_available():
    # TODO: Create two random tensors of shape (1000, 1000) on GPU
    # TODO: Multiply them (matrix multiply, not element-wise)
    # TODO: Time the operation (use torch.cuda.synchronize() before timing)
    # TODO: Move the result to CPU and print the shape
    # TODO: Compare timing with the same operation on CPU
    pass
else:
    print("No CUDA GPU available — try Google Colab!")
```

---

Next: [Lesson 04: CUDA Programming Patterns](./04-cuda-patterns.md)
