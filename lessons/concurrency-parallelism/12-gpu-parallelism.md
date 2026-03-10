# Lesson 12: GPU Parallelism

> A CPU is a few brilliant workers. A GPU is a stadium
> full of workers who can all do the same thing at once.

---

## The Analogy

**CPU**: A small team of 8 expert chefs. Each can cook any
dish, handle complex recipes, make decisions on the fly.
Great for varied, complex tasks.

**GPU**: A stadium of 10,000 workers, each with an identical
hot plate. Tell them all "fry an egg" and you get 10,000
fried eggs simultaneously. But ask one to make soufflé
while another makes sushi? Doesn't work well.

```
  CPU:                            GPU:
  +----+ +----+ +----+ +----+    +--+--+--+--+--+--+--+--+
  |Core| |Core| |Core| |Core|    |  |  |  |  |  |  |  |  |
  | 1  | | 2  | | 3  | | 4  |    +--+--+--+--+--+--+--+--+
  +----+ +----+ +----+ +----+    |  |  |  |  |  |  |  |  |
  4-16 powerful cores             +--+--+--+--+--+--+--+--+
  Out-of-order execution          |  |  |  |  |  |  |  |  |
  Branch prediction               +--+--+--+--+--+--+--+--+
  Large caches                    |  |  |  |  |  |  |  |  |
                                  +--+--+--+--+--+--+--+--+
                                  Thousands of simple cores
                                  In-order execution
                                  Small caches
                                  Massive parallelism
```

---

## GPU Architecture (NVIDIA CUDA)

```
  GPU
  +--------------------------------------------------+
  | Streaming Multiprocessor (SM) 0                   |
  | +------+------+------+------+------+------+      |
  | |Core 0|Core 1|Core 2| ...  |Core31|      |      |
  | +------+------+------+------+------+------+      |
  | | Shared Memory (48KB-164KB)                |      |
  | | Registers (65536)                          |      |
  | | Warp Schedulers                            |      |
  +--------------------------------------------------+
  | SM 1 (same structure)                             |
  +--------------------------------------------------+
  | SM 2 ...                                          |
  +--------------------------------------------------+
  | ...                                               |
  | SM N (e.g., 84 SMs on A100)                       |
  +--------------------------------------------------+
  | Global Memory (40GB-80GB HBM2/HBM3)              |
  +--------------------------------------------------+

  A100 GPU: 84 SMs x 64 CUDA cores = 6,912 cores
  H100 GPU: 132 SMs x 128 cores = 16,896 cores!
```

---

## CUDA Programming Model

```
  HIERARCHY:

  GRID (the whole job)
  +--------------------------------------------------+
  | Block (0,0)     Block (1,0)     Block (2,0)      |
  | +-----------+   +-----------+   +-----------+    |
  | | Thread 0  |   | Thread 0  |   | Thread 0  |    |
  | | Thread 1  |   | Thread 1  |   | Thread 1  |    |
  | | ...       |   | ...       |   | ...       |    |
  | | Thread 255|   | Thread 255|   | Thread 255|    |
  | +-----------+   +-----------+   +-----------+    |
  |                                                    |
  | Block (0,1)     Block (1,1)     Block (2,1)      |
  | +-----------+   +-----------+   +-----------+    |
  | | Thread 0  |   | Thread 0  |   | Thread 0  |    |
  | | ...       |   | ...       |   | ...       |    |
  | +-----------+   +-----------+   +-----------+    |
  +--------------------------------------------------+

  Grid: collection of blocks (can be 1D, 2D, or 3D)
  Block: collection of threads (max 1024 per block)
  Thread: smallest unit of execution

  Each thread knows its position:
  blockIdx.x, blockIdx.y     (which block)
  threadIdx.x, threadIdx.y   (which thread within block)
  blockDim.x, blockDim.y     (block dimensions)

  Global thread ID = blockIdx.x * blockDim.x + threadIdx.x
```

---

## Warps: The Execution Unit

```
  A WARP = 32 threads that execute THE SAME instruction
  at the same time (SIMT: Single Instruction Multiple Thread)

  Block of 256 threads = 8 warps

  Warp 0: threads 0-31    (all execute instruction A)
  Warp 1: threads 32-63   (all execute instruction B)
  Warp 2: threads 64-95   (all execute instruction A)
  ...

  WARP DIVERGENCE:
  What happens with an if/else?

  if (threadIdx.x < 16) {
      do_A();
  } else {
      do_B();
  }

  Warp executes BOTH branches:
  Step 1: threads 0-15 execute do_A(), threads 16-31 idle
  Step 2: threads 0-15 idle, threads 16-31 execute do_B()
  RESULT: 50% efficiency!

  +---+---+---+---+---+---+---+---+
  | 0 | 1 | 2 |...| 15| 16|...| 31|
  +---+---+---+---+---+---+---+---+
  | A | A | A |...| A | - |...| - |  step 1 (50% active)
  | - | - | - |...| - | B |...| B |  step 2 (50% active)
  +---+---+---+---+---+---+---+---+

  RULE: minimize divergence within warps!
```

---

## Memory Hierarchy

```
  FASTEST
  +---+---+---+---+---+---+
  | Registers              |  Per-thread, ~1 cycle
  +------------------------+
  | Shared Memory          |  Per-block, ~5 cycles, 48-164KB
  +------------------------+
  | L1 Cache               |  Per-SM, ~30 cycles
  +------------------------+
  | L2 Cache               |  Per-GPU, ~200 cycles, 6-50MB
  +------------------------+
  | Global Memory (HBM)    |  Per-GPU, ~400 cycles, 40-80GB
  +------------------------+
  | CPU Memory (via PCIe)  |  ~10,000 cycles, system RAM
  +------------------------+
  SLOWEST

  BANDWIDTH:
  +---------------------+------------------+
  | Shared Memory       | ~19 TB/s         |
  | L2 Cache            | ~6 TB/s          |
  | HBM (Global)        | 1.5-3.3 TB/s     |
  | PCIe 4.0 (CPU<->GPU)| ~32 GB/s         |
  +---------------------+------------------+

  GPU global memory bandwidth is 10-20x CPU RAM bandwidth!
  But CPU<->GPU transfer (PCIe) is the bottleneck.
```

---

## CUDA Kernel Example (Conceptual Python/C)

```python
import numpy as np

try:
    import cupy as cp

    n = 10_000_000
    a_gpu = cp.random.randn(n, dtype=cp.float32)
    b_gpu = cp.random.randn(n, dtype=cp.float32)

    c_gpu = a_gpu + b_gpu

    c_cpu = cp.asnumpy(c_gpu)

    print(f"GPU result: {c_cpu[:5]}")

except ImportError:
    print("CuPy not installed. Showing conceptual CUDA C instead.")
    print("""
// CUDA C kernel:
__global__ void add_arrays(float* a, float* b, float* c, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        c[idx] = a[idx] + b[idx];
    }
}

// Launch:
int threads_per_block = 256;
int blocks = (n + threads_per_block - 1) / threads_per_block;
add_arrays<<<blocks, threads_per_block>>>(d_a, d_b, d_c, n);
""")
```

---

## Coalesced Memory Access

```
  COALESCED (good):
  Thread 0 reads address 0
  Thread 1 reads address 4
  Thread 2 reads address 8
  ...
  Thread 31 reads address 124

  Hardware merges into ONE 128-byte transaction!

  +---+---+---+---+---+---+---+---+
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | ... 128 bytes
  +---+---+---+---+---+---+---+---+
  ^   ^   ^   ^   ^   ^   ^   ^
  T0  T1  T2  T3  T4  T5  T6  T7    ONE transaction

  UNCOALESCED (bad):
  Thread 0 reads address 0
  Thread 1 reads address 1024
  Thread 2 reads address 2048

  Each thread causes a SEPARATE memory transaction.
  32 transactions instead of 1!
  32x slower for memory-bound kernels.

  STRIDE PATTERN:
  Stride-1: coalesced (optimal)
  Stride-2: 2x transactions
  Stride-N: N transactions (worst case)
```

---

## GPU vs CPU: When to Use What

```
  USE GPU WHEN:                    USE CPU WHEN:
  +---------------------------+    +---------------------------+
  | Same operation on millions|    | Complex branching logic   |
  | of data points            |    |                           |
  | Matrix math               |    | Small data (< 10K elems) |
  | Deep learning             |    |                           |
  | Image/video processing    |    | Sequential algorithms    |
  | Physics simulation        |    |                           |
  | Crypto hashing            |    | I/O bound tasks          |
  +---------------------------+    |                           |
                                   | Irregular data structures |
                                   | (linked lists, trees)     |
                                   +---------------------------+

  DATA TRANSFER COST:
  Transferring data CPU <-> GPU takes ~microseconds.
  The computation must be large enough to justify the transfer.

  RULE OF THUMB:
  If computation takes < 100 microseconds, stay on CPU.
  GPU overhead (kernel launch + transfer) is ~10-50 us.
```

---

## Common GPU Patterns

```
  PATTERN 1: ELEMENT-WISE (embarrassingly parallel)
  c[i] = f(a[i], b[i])
  Each thread processes one element. Simplest pattern.

  PATTERN 2: REDUCTION (sum, max, min)
  Step 1: each thread reduces a chunk
  Step 2: threads within a block reduce via shared memory
  Step 3: final reduction across blocks

  Block 0:           Block 1:
  [a b c d] -> a+b+c+d  [e f g h] -> e+f+g+h
        \                    /
         sum_block0 + sum_block1 = total

  PATTERN 3: MATRIX MULTIPLY (tiled)
  Use shared memory to load tiles of the matrices.
  Each block computes one tile of the output.
  Reuse data from shared memory (100x faster than global).

  PATTERN 4: STENCIL (convolution)
  Each output element depends on a neighborhood of inputs.
  Use shared memory for the halo/ghost cells.
```

---

## Exercises

### Exercise 1: GPU Speedup Estimation

For a 1M element array operation that takes 5ms on CPU:
1. Estimate transfer time (CPU -> GPU -> CPU) via PCIe 4.0
2. Estimate computation time on GPU with 5000 cores
3. Is the GPU faster? What's the minimum array size where GPU wins?

### Exercise 2: Warp Divergence Analysis

Given this kernel, calculate the efficiency:
```
if (threadIdx.x % 4 == 0) {
    expensive_op_A();
} else {
    cheap_op_B();
}
```
How many threads are active in each phase? What's warp utilization?

### Exercise 3: Memory Coalescing

Two kernels access the same 2D array:
- Kernel A: `data[threadIdx.x][threadIdx.y]` (row-major access by rows)
- Kernel B: `data[threadIdx.y][threadIdx.x]` (row-major access by columns)
Which is coalesced? Why? Draw the memory access pattern.

### Exercise 4: CuPy/NumPy Benchmark

If you have a GPU, compare NumPy (CPU) vs CuPy (GPU) for:
1. Matrix multiplication (1000x1000)
2. Element-wise operations on 10M array
3. Sorting 10M elements
4. Find the crossover point where GPU becomes faster

---

## Key Takeaways

```
  1. GPUs have thousands of simple cores vs CPU's few complex cores
  2. CUDA hierarchy: Grid -> Blocks -> Threads
  3. Warp = 32 threads executing the same instruction
  4. Warp divergence (branching) reduces efficiency
  5. Memory coalescing: adjacent threads should access adjacent memory
  6. Shared memory is 100x faster than global memory
  7. CPU<->GPU transfer is the main bottleneck for small workloads
  8. GPUs excel at data-parallel, regular computation
  9. CPUs excel at branchy, irregular, sequential work
  10. Matrix multiply is the poster child for GPU acceleration
```

---

Next: [Lesson 13 — Data Parallelism in ML](./13-data-parallelism-ml.md)
