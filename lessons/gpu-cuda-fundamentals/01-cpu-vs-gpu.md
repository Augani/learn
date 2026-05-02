# Lesson 01: CPU vs GPU Architecture — Why Parallel Processing Matters

Every neural network you have ever used was trained on a GPU. Not because
GPUs are "faster" in the simple sense — a single CPU core is actually
faster than a single GPU core. GPUs win because they have thousands of
cores working simultaneously. Understanding this difference is the
foundation of everything in this track.

---

## The Core Idea

A CPU is designed to do one thing very fast. A GPU is designed to do
thousands of things at the same time.

**Analogy: One professor vs 1,000 students.** Imagine you need to grade
10,000 multiple-choice exams. A CPU is like one brilliant professor who
grades each exam in 1 second — 10,000 seconds total. A GPU is like
1,000 students who each grade 10 exams in 10 seconds — done in 10
seconds total. The professor is smarter and faster per exam, but the
students win by sheer numbers.

```
CPU approach (serial):                GPU approach (parallel):

  Professor                            1,000 Students
  ┌──────┐                             ┌──┐┌──┐┌──┐┌──┐ ... ┌──┐
  │ Exam │ → Grade → Next              │E1││E2││E3││E4│     │En│
  │  1   │                             │  ││  ││  ││  │     │  │
  └──────┘                             └──┘└──┘└──┘└──┘     └──┘
  ┌──────┐                               ↓    ↓    ↓    ↓       ↓
  │ Exam │ → Grade → Next              All graded simultaneously
  │  2   │
  └──────┘
  ... 10,000 times                     Done in ~10 batches

  Time: ~10,000 seconds               Time: ~10 seconds
```

This is the fundamental trade-off in computing: **latency** (how fast
you finish one task) vs **throughput** (how many tasks you finish per
second).

---

## CPU Architecture: Optimized for Latency

A CPU is a latency machine. It is designed to finish each individual
task as fast as possible. To do this, CPUs dedicate most of their
transistor budget to:

- **Large caches** — keep frequently used data close
- **Branch prediction** — guess which instruction comes next
- **Out-of-order execution** — rearrange instructions for speed
- **Complex control logic** — handle any kind of workload

```
CPU Die Layout (simplified):

┌─────────────────────────────────────────────┐
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │          L3 Cache (large)           │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   ┌───────────┐       ┌───────────┐         │
│   │  Core 0   │       │  Core 1   │         │
│   │ ┌───────┐ │       │ ┌───────┐ │         │
│   │ │Control│ │       │ │Control│ │         │
│   │ │ Logic │ │       │ │ Logic │ │         │
│   │ ├───────┤ │       │ ├───────┤ │         │
│   │ │ ALU   │ │       │ │ ALU   │ │         │
│   │ ├───────┤ │       │ ├───────┤ │         │
│   │ │L1/L2  │ │       │ │L1/L2  │ │         │
│   │ │Cache  │ │       │ │Cache  │ │         │
│   │ └───────┘ │       │ └───────┘ │         │
│   └───────────┘       └───────────┘         │
│                                             │
│   ┌───────────┐       ┌───────────┐         │
│   │  Core 2   │       │  Core 3   │         │
│   │   ...     │       │   ...     │         │
│   └───────────┘       └───────────┘         │
│                                             │
│   4-16 cores, each very powerful            │
│   ~70% of die area is cache + control       │
└─────────────────────────────────────────────┘
```

A modern CPU has 4–128 cores, each running at 3–5 GHz. Each core can
handle complex, branching logic — if/else, loops, function calls,
system calls. CPUs are general-purpose workhorses.

---

## GPU Architecture: Optimized for Throughput

A GPU is a throughput machine. It is designed to finish the most total
work per second, even if each individual task takes longer. GPUs
dedicate most of their transistor budget to:

- **Thousands of simple cores** — do the same operation on many data points
- **Minimal control logic per core** — all cores run the same instruction
- **High memory bandwidth** — feed data to all those cores
- **Small caches** — just enough to keep cores busy

```
GPU Die Layout (simplified):

┌─────────────────────────────────────────────┐
│                                             │
│  ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐      │
│  │ SM  ││ SM  ││ SM  ││ SM  ││ SM  │ ...  │
│  │┌─┐  ││┌─┐  ││┌─┐  ││┌─┐  ││┌─┐  │      │
│  ││C│x32││C│x32││C│x32││C│x32││C│x32│      │
│  │└─┘  ││└─┘  ││└─┘  ││└─┘  ││└─┘  │      │
│  └─────┘└─────┘└─────┘└─────┘└─────┘      │
│  ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐      │
│  │ SM  ││ SM  ││ SM  ││ SM  ││ SM  │ ...  │
│  │┌─┐  ││┌─┐  ││┌─┐  ││┌─┐  ││┌─┐  │      │
│  ││C│x32││C│x32││C│x32││C│x32││C│x32│      │
│  │└─┘  ││└─┘  ││└─┘  ││└─┘  ││└─┘  │      │
│  └─────┘└─────┘└─────┘└─────┘└─────┘      │
│                                             │
│  SM = Streaming Multiprocessor              │
│  C  = CUDA Core                             │
│  Thousands of cores, each simple            │
│  ~80% of die area is compute cores          │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │     Memory Controllers (wide bus)   │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

A modern GPU has 5,000–20,000+ CUDA cores, each running at 1–2 GHz.
Each core is simple — it cannot handle complex branching well. But when
you need to do the same math on millions of numbers (like matrix
multiplication), nothing beats a GPU.

---

## SIMD vs SIMT: How Parallelism Works

**SIMD (Single Instruction, Multiple Data)** — CPUs use this. One
instruction operates on a small batch of data (4–16 numbers at once
using vector registers like AVX-512).

**SIMT (Single Instruction, Multiple Threads)** — GPUs use this.
One instruction is executed by thousands of threads simultaneously,
each operating on different data.

```
SIMD (CPU):
  One instruction, small batch

  Instruction: ADD
  ┌────┬────┬────┬────┐
  │ a0 │ a1 │ a2 │ a3 │   4 values at once
  ├────┼────┼────┼────┤
  │ b0 │ b1 │ b2 │ b3 │
  ├────┼────┼────┼────┤
  │ c0 │ c1 │ c2 │ c3 │   = a + b
  └────┴────┴────┴────┘


SIMT (GPU):
  One instruction, thousands of threads

  Instruction: ADD
  Thread 0:  c[0]    = a[0]    + b[0]
  Thread 1:  c[1]    = a[1]    + b[1]
  Thread 2:  c[2]    = a[2]    + b[2]
  ...
  Thread 999: c[999] = a[999]  + b[999]

  All threads execute the same ADD instruction
  but on different data elements
```

The key insight: GPUs get their speed from **data parallelism**. When
you have the same operation applied to millions of data points — which
is exactly what matrix multiplication, convolutions, and attention
computations are — GPUs dominate.

---

## The Numbers: CPU vs GPU

Here is a concrete comparison to make this real:

```
                        CPU                    GPU
                    (Intel i9-13900K)     (NVIDIA H100)
                    ─────────────────     ──────────────
Cores               24 (8P + 16E)         16,896 CUDA
                                          + 528 Tensor
Clock Speed         Up to 5.8 GHz         Up to 1.98 GHz
Memory              128 GB DDR5           80 GB HBM3
Memory Bandwidth    89.6 GB/s             3,350 GB/s
FP32 FLOPS          ~1.5 TFLOPS           ~67 TFLOPS
FP16 FLOPS          N/A (no native)       ~1,979 TFLOPS*
Power               253W                  700W
Price               ~$600                 ~$30,000+

* With tensor cores (specialized matrix multiply hardware)
```

The GPU has:
- **700× more cores** (but each is simpler)
- **37× more memory bandwidth** (critical for feeding those cores)
- **45× more FP32 compute** (raw floating point operations)
- **1,300× more FP16 compute** (with tensor cores for ML workloads)

---

## Why This Matters for ML

Machine learning workloads are almost entirely **matrix multiplication
and element-wise operations** — exactly the kind of data-parallel work
GPUs excel at.

```
Neural network forward pass:

  Input        Weights       Output
  (batch)      (matrix)      (batch)

  ┌─────┐     ┌─────────┐   ┌─────┐
  │ x0  │     │ w w w w │   │ y0  │
  │ x1  │  @  │ w w w w │ = │ y1  │
  │ x2  │     │ w w w w │   │ y2  │
  │ ... │     │ w w w w │   │ ... │
  │ xN  │     │         │   │ yN  │
  └─────┘     └─────────┘   └─────┘

  Every row of the output can be computed independently.
  → Perfect for GPU parallelism.

  A batch of 1024 inputs through a 4096×4096 weight matrix:
  CPU: ~50 ms
  GPU: ~0.1 ms (500× faster)
```

Training a model like GPT-3 (175 billion parameters) required
~3,640 petaflop-days of compute. On a single CPU, that would take
roughly 36,000 years. On 1,024 A100 GPUs, it took about 34 days.

---

## Design Philosophy Summary

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   CPU: "Do one thing FAST"                           │
│   ┌──────────────────────────────────────────┐       │
│   │ ● Few powerful cores (4-128)             │       │
│   │ ● High clock speed (3-5 GHz)            │       │
│   │ ● Large caches                           │       │
│   │ ● Complex control logic                  │       │
│   │ ● Great at: branching, OS tasks,         │       │
│   │   sequential algorithms, single-thread   │       │
│   └──────────────────────────────────────────┘       │
│                                                      │
│   GPU: "Do many things AT ONCE"                      │
│   ┌──────────────────────────────────────────┐       │
│   │ ● Thousands of simple cores              │       │
│   │ ● Lower clock speed (1-2 GHz)           │       │
│   │ ● Small caches, huge bandwidth           │       │
│   │ ● Minimal control logic                  │       │
│   │ ● Great at: matrix math, convolutions,   │       │
│   │   attention, any data-parallel workload  │       │
│   └──────────────────────────────────────────┘       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: Parallelism Intuition

Think about these tasks. For each one, decide whether a CPU or GPU
approach would be faster, and explain why:

1. Sorting a list of 1 million numbers
2. Adding two vectors of 10 million floats element-wise
3. Running a web server handling 1 request at a time (complex logic)
4. Computing the dot product of 1,000 pairs of vectors simultaneously
5. Training a neural network on a batch of 256 images

### Exercise 2: Compute the Speedup

```python
import numpy as np
import time

# Matrix multiplication: CPU timing
size = 4096
A = np.random.randn(size, size).astype(np.float32)
B = np.random.randn(size, size).astype(np.float32)

start = time.time()
C = A @ B
cpu_time = time.time() - start
print(f"CPU matmul ({size}x{size}): {cpu_time:.3f} seconds")

# If you have PyTorch + CUDA:
# import torch
# A_gpu = torch.randn(size, size, device='cuda')
# B_gpu = torch.randn(size, size, device='cuda')
# torch.cuda.synchronize()
# start = time.time()
# C_gpu = A_gpu @ B_gpu
# torch.cuda.synchronize()
# gpu_time = time.time() - start
# print(f"GPU matmul ({size}x{size}): {gpu_time:.3f} seconds")
# print(f"Speedup: {cpu_time / gpu_time:.1f}x")
```

### Exercise 3: Count the Operations

A single matrix multiplication of two (N × N) matrices requires
approximately 2N³ floating point operations (N² dot products, each
requiring N multiplies and N-1 adds).

```python
# TODO: Calculate the FLOPS for a 4096×4096 matrix multiply
# TODO: If a CPU does 1.5 TFLOPS and a GPU does 67 TFLOPS (FP32),
#       how long should each take in theory?
# TODO: Why is the actual speedup often less than 67/1.5 = 44.7x?
#       (Hint: think about memory bandwidth)
```

---

Next: [Lesson 02: GPU Memory Hierarchy](./02-gpu-memory-hierarchy.md)
