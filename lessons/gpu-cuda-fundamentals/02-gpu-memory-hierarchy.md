# Lesson 02: GPU Memory Hierarchy — Why Memory Is the Real Bottleneck

You might think GPU performance is all about compute — more cores, more
FLOPS. In practice, the bottleneck is almost always **memory**. Getting
data to the cores fast enough is the hard part. Understanding the GPU
memory hierarchy is the difference between code that crawls and code
that flies.

---

## The Core Idea

A GPU has multiple levels of memory, each with different speed, size,
and scope. Faster memory is smaller and closer to the cores. Slower
memory is larger and farther away.

**Analogy: Your desk, filing cabinet, and warehouse.**

- **Registers** = the paper on your desk. Instant access, but you can
  only have a few sheets at a time.
- **Shared memory** = the filing cabinet in your office. Fast to reach,
  shared with your officemates, limited space.
- **L1/L2 cache** = the supply closet down the hall. Pretty fast, but
  you have to walk there.
- **Global memory (HBM)** = the warehouse across town. Huge capacity,
  but it takes a long time to get anything.

```
GPU Memory Hierarchy:

Speed       Memory Level          Size        Scope
─────       ────────────          ────        ─────

FASTEST ──► Registers             ~256 KB     Per thread
  │         (per SM)
  │
  │    ──► Shared Memory /        48-228 KB   Per thread block
  │         L1 Cache (per SM)
  │
  │    ──► L2 Cache               6-60 MB     All SMs
  │
  │
SLOWEST ──► Global Memory (HBM)   16-80 GB    All threads
            (off-chip)

            ┌─────────────────────────────────────┐
            │  Registers:    ~1 cycle    (~0.5 ns) │
            │  Shared/L1:   ~5 cycles   (~2.5 ns)  │
            │  L2 Cache:    ~30 cycles  (~15 ns)    │
            │  Global/HBM:  ~400 cycles (~200 ns)   │
            └─────────────────────────────────────┘
```

The difference between registers and global memory is roughly **400×**
in latency. This is why memory access patterns matter so much.

---

## Global Memory (HBM)

Global memory is the main memory of the GPU — the large pool that holds
your model weights, input data, and output results. On modern GPUs, this
is **HBM (High Bandwidth Memory)**.

```
Global Memory:

┌─────────────────────────────────────────┐
│                                         │
│          Global Memory (HBM)            │
│                                         │
│   ┌──────────┐  ┌──────────┐            │
│   │  Model   │  │  Input   │            │
│   │  Weights │  │  Data    │            │
│   │  (GB)    │  │  (MB-GB) │            │
│   └──────────┘  └──────────┘            │
│   ┌──────────┐  ┌──────────┐            │
│   │  Output  │  │ Gradients│            │
│   │  Data    │  │          │            │
│   └──────────┘  └──────────┘            │
│                                         │
│   Size: 16-80 GB                        │
│   Bandwidth: 900-3,350 GB/s             │
│   Latency: ~400 cycles (~200 ns)        │
│                                         │
│   Accessible by: ALL threads            │
└─────────────────────────────────────────┘
```

Key facts:
- **Size:** 16 GB (RTX 4080) to 80 GB (A100/H100)
- **Bandwidth:** 900 GB/s (RTX 4090) to 3,350 GB/s (H100)
- **Latency:** ~200 ns (400+ clock cycles)
- **Accessible by:** Every thread on the GPU

Global memory is where your PyTorch tensors live when you call
`.to('cuda')`. Every `torch.matmul` reads weights from here.

---

## Shared Memory

Shared memory is a small, fast, programmer-managed cache that is shared
among all threads in a **thread block**. Think of it as a scratchpad
that a team of threads can use to collaborate.

```
Shared Memory (per Streaming Multiprocessor):

┌─────────────────────────────────┐
│     Streaming Multiprocessor    │
│                                 │
│  ┌───────────────────────────┐  │
│  │     Shared Memory         │  │
│  │     48-228 KB             │  │
│  │                           │  │
│  │  Thread 0 ──► read/write  │  │
│  │  Thread 1 ──► read/write  │  │
│  │  Thread 2 ──► read/write  │  │
│  │  ...                      │  │
│  │  Thread 31 ──► read/write │  │
│  │                           │  │
│  │  All threads in the block │  │
│  │  can see the same data    │  │
│  └───────────────────────────┘  │
│                                 │
│  Latency: ~5 cycles (~2.5 ns)  │
│  ~80× faster than global mem   │
└─────────────────────────────────┘
```

The classic pattern: load a tile of data from global memory into shared
memory once, then have all threads in the block read from shared memory
many times. This is the core idea behind **tiled matrix multiplication**.

---

## Registers

Registers are the fastest memory on the GPU. Each thread has its own
private registers — no sharing with other threads.

```
Registers (per thread):

  Thread 0          Thread 1          Thread 2
  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ reg0: 3.14│    │ reg0: 2.71│    │ reg0: 1.41│
  │ reg1: 0.5 │    │ reg1: 0.3 │    │ reg1: 0.7 │
  │ reg2: ... │    │ reg2: ... │    │ reg2: ... │
  │ (private) │    │ (private) │    │ (private) │
  └──────────┘     └──────────┘     └──────────┘

  Latency: ~1 cycle (~0.5 ns)
  Size: ~255 registers per thread (32-bit each)
  Scope: private to each thread
```

When you write `float x = a + b;` in CUDA, `x`, `a`, and `b` likely
live in registers. The compiler tries to keep frequently used variables
in registers automatically.

---

## L1 and L2 Cache

The L1 cache sits on each Streaming Multiprocessor (SM) alongside
shared memory — on some architectures they share the same physical
SRAM and you can configure the split. The L2 cache is shared across
all SMs.

```
Cache Hierarchy:

  ┌──────────────────────────────────────────┐
  │              GPU Chip                     │
  │                                          │
  │  ┌──────────┐  ┌──────────┐              │
  │  │   SM 0   │  │   SM 1   │   ...        │
  │  │ ┌──────┐ │  │ ┌──────┐ │              │
  │  │ │L1/Sh │ │  │ │L1/Sh │ │              │
  │  │ │Mem   │ │  │ │Mem   │ │              │
  │  │ └──────┘ │  │ └──────┘ │              │
  │  └──────────┘  └──────────┘              │
  │         \           /                    │
  │          \         /                     │
  │       ┌──────────────┐                   │
  │       │   L2 Cache   │                   │
  │       │   6-60 MB    │                   │
  │       └──────────────┘                   │
  │              │                           │
  │       ┌──────────────┐                   │
  │       │ Global (HBM) │                   │
  │       │  16-80 GB    │                   │
  │       └──────────────┘                   │
  └──────────────────────────────────────────┘
```

Unlike shared memory, caches are **hardware-managed** — you do not
explicitly load data into them. The hardware automatically caches
recently accessed global memory.

---

## Memory Bandwidth: The Real Bottleneck

Here is the key insight that most beginners miss: **most GPU operations
are memory-bound, not compute-bound.**

```
The Roofline Model (simplified):

Performance
(FLOPS)
    │
    │                    ╱ Compute bound
    │                  ╱   (matmul, convolutions)
    │                ╱
    │    ──────────╱──── Peak compute
    │            ╱
    │          ╱
    │        ╱  Memory bound
    │      ╱    (element-wise ops, softmax, layer norm)
    │    ╱
    │  ╱
    │╱
    └──────────────────────────
         Arithmetic Intensity
         (FLOPS per byte loaded)
```

**Arithmetic intensity** = FLOPS ÷ bytes loaded from memory.

- **Matrix multiplication:** High arithmetic intensity. For large
  matrices, you load N² numbers but do ~2N³ operations. Compute-bound.
- **Element-wise operations** (ReLU, add, multiply): Low arithmetic
  intensity. You load each number, do 1 operation, write it back.
  Memory-bound.
- **Softmax, layer norm:** Low arithmetic intensity. Memory-bound.

This is why a huge fraction of GPU optimization is about **reducing
memory traffic** — not about doing fewer computations.

```python
import torch
import time

if torch.cuda.is_available():
    device = 'cuda'
    N = 4096

    # Compute-bound: matrix multiplication
    A = torch.randn(N, N, device=device)
    B = torch.randn(N, N, device=device)
    torch.cuda.synchronize()
    start = time.time()
    for _ in range(10):
        C = A @ B
    torch.cuda.synchronize()
    matmul_time = (time.time() - start) / 10
    print(f"Matmul {N}x{N}: {matmul_time*1000:.2f} ms")

    # Memory-bound: element-wise addition
    torch.cuda.synchronize()
    start = time.time()
    for _ in range(10):
        C = A + B
    torch.cuda.synchronize()
    add_time = (time.time() - start) / 10
    print(f"Add {N}x{N}:    {add_time*1000:.2f} ms")

    # The add is much simpler but not proportionally faster
    # because it's limited by memory bandwidth, not compute
```

---

## Memory Bandwidth by GPU Generation

```
GPU Memory Bandwidth Comparison:

GPU              Memory    Bandwidth    Bandwidth per $
─────────────    ──────    ─────────    ───────────────
GTX 1080 Ti      11 GB     484 GB/s     ~0.7 GB/s/$
RTX 3090         24 GB     936 GB/s     ~0.6 GB/s/$
RTX 4090         24 GB    1,008 GB/s    ~0.6 GB/s/$
A100 (80GB)      80 GB    2,039 GB/s    ~0.1 GB/s/$
H100 (SXM)       80 GB    3,350 GB/s    ~0.1 GB/s/$

HBM (High Bandwidth Memory) vs GDDR:
┌──────────────────────────────────────────┐
│  GDDR6X (consumer):  ~1,000 GB/s        │
│  HBM2e (A100):       ~2,000 GB/s        │
│  HBM3 (H100):        ~3,350 GB/s        │
│  HBM3e (B200):       ~8,000 GB/s        │
└──────────────────────────────────────────┘
```

---

## Putting It All Together

When a PyTorch operation runs on GPU, here is what happens:

```
torch.matmul(A, B) execution flow:

1. A and B live in Global Memory (HBM)
   ┌──────────────────────────┐
   │  Global Memory           │
   │  A: [4096 x 4096] float  │
   │  B: [4096 x 4096] float  │
   └──────────┬───────────────┘
              │
2. Tiles loaded into Shared Memory
   ┌──────────┴───────────────┐
   │  Shared Memory (per SM)  │
   │  tile_A: [32 x 32]       │
   │  tile_B: [32 x 32]       │
   └──────────┬───────────────┘
              │
3. Threads compute using Registers
   ┌──────────┴───────────────┐
   │  Registers (per thread)  │
   │  accumulator: float      │
   │  a_val, b_val: float     │
   └──────────┬───────────────┘
              │
4. Results written back to Global Memory
   ┌──────────┴───────────────┐
   │  Global Memory           │
   │  C: [4096 x 4096] float  │
   └──────────────────────────┘
```

The goal of GPU optimization: **minimize trips to global memory** by
reusing data in shared memory and registers as much as possible.

---

## Exercises

### Exercise 1: Memory Hierarchy Math

```
Given an NVIDIA A100 GPU:
- Global memory: 80 GB HBM2e
- Global memory bandwidth: 2,039 GB/s
- Shared memory: 164 KB per SM, 108 SMs
- L2 cache: 40 MB
- Registers: 65,536 per SM (32-bit each)

TODO:
1. How long does it take to read a 7B parameter model (FP16)
   from global memory? (Hint: 7B params × 2 bytes = 14 GB)
2. What is the total shared memory across all SMs?
3. If a tiled matmul loads 32×32 tiles into shared memory,
   how many bytes is each tile (FP32)? Does it fit?
4. How many 32-bit registers does each SM have in total bytes?
```

### Exercise 2: Arithmetic Intensity

```python
import numpy as np

# Calculate arithmetic intensity for these operations:

# 1. Vector addition: C[i] = A[i] + B[i], N elements (FP32)
#    Bytes loaded: ?  FLOPS: ?  Intensity: ?

# 2. Matrix multiply: C = A @ B, both NxN (FP32)
#    Bytes loaded: ?  FLOPS: ?  Intensity: ?

# 3. Softmax over a vector of N elements
#    Bytes loaded: ?  FLOPS (approx): ?  Intensity: ?

# Which operations are memory-bound vs compute-bound on a GPU
# with 2,000 GB/s bandwidth and 300 TFLOPS compute?
```

### Exercise 3: Memory Access Patterns

```python
# Consider two ways to access a 2D array stored in row-major order:

import numpy as np

N = 1024
A = np.random.randn(N, N).astype(np.float32)

# Pattern 1: Row-major access (good for GPU)
total = 0.0
for i in range(N):
    for j in range(N):
        total += A[i, j]  # consecutive memory addresses

# Pattern 2: Column-major access (bad for GPU)
total = 0.0
for j in range(N):
    for i in range(N):
        total += A[i, j]  # strided memory addresses

# TODO: Explain why Pattern 1 is faster on a GPU.
# Hint: Think about "memory coalescing" — when adjacent threads
# access adjacent memory addresses, the GPU can combine those
# accesses into a single wide memory transaction.
```

---

Next: [Lesson 03: CUDA Programming Basics](./03-cuda-hello-world.md)
