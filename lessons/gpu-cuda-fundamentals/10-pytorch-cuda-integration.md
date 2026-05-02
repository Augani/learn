# Lesson 10: PyTorch and CUDA Integration — How the Framework Talks to the GPU

Every time you write `tensor @ tensor` in PyTorch on a CUDA device,
a chain of events fires: PyTorch's dispatcher selects the right kernel,
cuBLAS or cuDNN executes the operation, and results land in GPU memory.
This lesson opens the hood on that process and introduces torch.compile
and Triton — the future of GPU programming for ML.

---

## The Core Idea

PyTorch is a thin Python layer on top of highly optimized C++ and CUDA
libraries. When you call a PyTorch operation, it does not run Python on
the GPU — it dispatches to pre-compiled CUDA kernels written by NVIDIA
and the PyTorch team.

**Analogy: A restaurant order.** You (Python) tell the waiter (PyTorch
dispatcher) what you want. The waiter passes the order to the kitchen
(CUDA backend). The chef (cuBLAS/cuDNN) does the actual cooking. You
never enter the kitchen, but understanding how it works helps you order
smarter.

```
PyTorch Operation Dispatch:

  Python: C = A @ B
     │
     ▼
  PyTorch Dispatcher
  ┌──────────────────────────────────────┐
  │ 1. Check device (CPU? CUDA? MPS?)   │
  │ 2. Check dtype (float32? float16?)  │
  │ 3. Check shape                       │
  │ 4. Select optimal kernel             │
  └──────────────┬───────────────────────┘
                 │
     ┌───────────┼───────────┐
     ▼           ▼           ▼
  ┌──────┐  ┌──────┐  ┌──────────┐
  │cuBLAS│  │cuDNN │  │Custom    │
  │(GEMM)│  │(conv)│  │CUDA      │
  │      │  │      │  │kernels   │
  └──────┘  └──────┘  └──────────┘
     │           │           │
     ▼           ▼           ▼
  GPU executes the selected kernel
```

---

## The CUDA Backend Libraries

PyTorch does not write most CUDA kernels from scratch. It relies on
NVIDIA's optimized libraries:

```
NVIDIA Libraries Used by PyTorch:

┌──────────────┬──────────────────────────────────────┐
│ Library      │ What It Does                         │
├──────────────┼──────────────────────────────────────┤
│ cuBLAS       │ Matrix multiply (GEMM), the core of  │
│              │ linear layers and attention           │
├──────────────┼──────────────────────────────────────┤
│ cuDNN        │ Convolutions, batch norm, RNNs       │
│              │ Highly optimized for common patterns  │
├──────────────┼──────────────────────────────────────┤
│ cuFFT        │ Fast Fourier Transform               │
├──────────────┼──────────────────────────────────────┤
│ cuRAND       │ Random number generation on GPU      │
├──────────────┼──────────────────────────────────────┤
│ cuSPARSE     │ Sparse matrix operations             │
├──────────────┼──────────────────────────────────────┤
│ NCCL         │ Multi-GPU communication (AllReduce)  │
├──────────────┼──────────────────────────────────────┤
│ Thrust       │ GPU-accelerated algorithms (sort,    │
│              │ scan, reduce)                        │
└──────────────┴──────────────────────────────────────┘

When you write:
  torch.matmul(A, B)     → calls cuBLAS GEMM
  torch.nn.Conv2d(...)   → calls cuDNN convolution
  torch.sort(tensor)     → calls Thrust sort
  dist.all_reduce(...)   → calls NCCL AllReduce
```

---

## CUDA Streams and Asynchronous Execution

CUDA operations are **asynchronous** by default. When Python calls a
CUDA operation, it returns immediately — the GPU works in the
background. This is why you need `torch.cuda.synchronize()` for
accurate timing.

```
Asynchronous Execution:

CPU timeline:
  [launch kernel A] [launch kernel B] [launch kernel C] [sync]
   returns instantly  returns instantly  returns instantly  waits

GPU timeline:
  [         kernel A         ] [    kernel B    ] [ kernel C ]

The CPU is free to prepare the next operation while the GPU
is still working on the current one. This overlap hides latency.

CUDA Streams:
  Default stream: operations execute in order
  Multiple streams: operations can overlap

  Stream 0: [  matmul  ] [  softmax  ] [  matmul  ]
  Stream 1:      [ memcpy H2D ] [ memcpy D2H ]

  Operations on different streams can run concurrently.
```

```python
import torch
import time

if torch.cuda.is_available():
    A = torch.randn(4096, 4096, device='cuda')
    B = torch.randn(4096, 4096, device='cuda')

    # WRONG way to time GPU operations
    start = time.time()
    C = A @ B
    wrong_time = time.time() - start
    print(f"Wrong timing: {wrong_time*1000:.2f} ms")
    # This measures kernel LAUNCH time, not execution time!

    # RIGHT way to time GPU operations
    torch.cuda.synchronize()
    start = time.time()
    C = A @ B
    torch.cuda.synchronize()  # Wait for GPU to finish
    right_time = time.time() - start
    print(f"Right timing: {right_time*1000:.2f} ms")

    # Even better: use CUDA events
    start_event = torch.cuda.Event(enable_timing=True)
    end_event = torch.cuda.Event(enable_timing=True)

    start_event.record()
    C = A @ B
    end_event.record()
    torch.cuda.synchronize()
    print(f"Event timing: {start_event.elapsed_time(end_event):.2f} ms")
```

---

## torch.compile: The Future of PyTorch Performance

`torch.compile` (introduced in PyTorch 2.0) automatically optimizes
your model by fusing operations, eliminating unnecessary memory reads,
and generating optimized GPU kernels.

```
What torch.compile does:

Before (eager mode):
  Each operation launches a separate CUDA kernel:

  [ReLU kernel] → write to memory → [Add kernel] → write to memory →
  [LayerNorm kernel] → write to memory → [Linear kernel]

  4 kernel launches, 3 unnecessary memory round-trips

After (compiled):
  Fused into fewer kernels:

  [Fused ReLU+Add+LayerNorm kernel] → [Linear kernel]

  2 kernel launches, 1 memory round-trip
  Memory-bound operations are fused → big speedup
```

```python
import torch

model = torch.nn.Sequential(
    torch.nn.Linear(1024, 4096),
    torch.nn.GELU(),
    torch.nn.LayerNorm(4096),
    torch.nn.Linear(4096, 4096),
    torch.nn.GELU(),
    torch.nn.LayerNorm(4096),
    torch.nn.Linear(4096, 1024),
).cuda()

# Compile the model
compiled_model = torch.compile(model)

# First call is slow (compilation), subsequent calls are fast
x = torch.randn(64, 1024, device='cuda')

# Warm up (triggers compilation)
_ = compiled_model(x)

# Benchmark
torch.cuda.synchronize()
import time
start = time.time()
for _ in range(100):
    _ = compiled_model(x)
torch.cuda.synchronize()
compiled_time = (time.time() - start) / 100

# Compare with eager mode
torch.cuda.synchronize()
start = time.time()
for _ in range(100):
    _ = model(x)
torch.cuda.synchronize()
eager_time = (time.time() - start) / 100

print(f"Eager:    {eager_time*1000:.2f} ms")
print(f"Compiled: {compiled_time*1000:.2f} ms")
print(f"Speedup:  {eager_time/compiled_time:.2f}x")
```

---

## Triton: Writing Custom GPU Kernels in Python

Triton is an open-source language by OpenAI that lets you write GPU
kernels in Python-like syntax. It is what `torch.compile` uses under
the hood for kernel fusion.

```python
import triton
import triton.language as tl
import torch

@triton.jit
def add_kernel(
    x_ptr, y_ptr, output_ptr,
    n_elements,
    BLOCK_SIZE: tl.constexpr,
):
    """A simple vector addition kernel in Triton."""
    # Each program instance handles BLOCK_SIZE elements
    pid = tl.program_id(axis=0)
    block_start = pid * BLOCK_SIZE
    offsets = block_start + tl.arange(0, BLOCK_SIZE)

    # Mask for bounds checking
    mask = offsets < n_elements

    # Load, compute, store
    x = tl.load(x_ptr + offsets, mask=mask)
    y = tl.load(y_ptr + offsets, mask=mask)
    output = x + y
    tl.store(output_ptr + offsets, output, mask=mask)

# Usage
def triton_add(x: torch.Tensor, y: torch.Tensor):
    output = torch.empty_like(x)
    n = output.numel()
    grid = lambda meta: (triton.cdiv(n, meta['BLOCK_SIZE']),)
    add_kernel[grid](x, y, output, n, BLOCK_SIZE=1024)
    return output

# Test
if torch.cuda.is_available():
    x = torch.randn(1_000_000, device='cuda')
    y = torch.randn(1_000_000, device='cuda')
    result = triton_add(x, y)
    expected = x + y
    print(f"Max error: {(result - expected).abs().max():.6f}")
```

```
Why Triton matters:

┌──────────────────────────────────────────────────┐
│ CUDA C/C++:                                      │
│   ● Full control over every detail               │
│   ● Steep learning curve                         │
│   ● Manual memory management                     │
│   ● Hard to get right                            │
│                                                  │
│ Triton:                                          │
│   ● Python-like syntax                           │
│   ● Automatic memory coalescing                  │
│   ● Automatic shared memory management           │
│   ● ~80-90% of hand-tuned CUDA performance       │
│   ● Much easier to write and maintain            │
│                                                  │
│ torch.compile uses Triton to generate fused      │
│ kernels automatically from your PyTorch code.    │
└──────────────────────────────────────────────────┘
```

---

## Custom CUDA Extensions

For maximum performance, you can write custom CUDA kernels and load
them into PyTorch using `torch.utils.cpp_extension`.

```python
# my_kernel.cu
"""
#include <torch/extension.h>

__global__ void my_relu_kernel(float* input, float* output, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        output[idx] = input[idx] > 0 ? input[idx] : 0;
    }
}

torch::Tensor my_relu(torch::Tensor input) {
    auto output = torch::empty_like(input);
    int n = input.numel();
    int threads = 256;
    int blocks = (n + threads - 1) / threads;
    my_relu_kernel<<<blocks, threads>>>(
        input.data_ptr<float>(),
        output.data_ptr<float>(),
        n
    );
    return output;
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("my_relu", &my_relu, "Custom ReLU");
}
"""

# Load and use in Python
from torch.utils.cpp_extension import load

my_module = load(
    name="my_cuda_ops",
    sources=["my_kernel.cu"],
    verbose=True,
)

x = torch.randn(1000, device='cuda')
y = my_module.my_relu(x)
```

For deeper coverage of PyTorch performance optimization, see:
- [ML Performance Optimization Lessons 06-08](../ml-performance-optimization/)

---

## Exercises

### Exercise 1: Dispatch Investigation

```python
import torch

# TODO: For each operation below, determine which NVIDIA library
# PyTorch dispatches to (cuBLAS, cuDNN, custom kernel, etc.)

x = torch.randn(64, 512, 768, device='cuda')
w = torch.randn(768, 768, device='cuda')

# 1. y = x @ w                    → Library: ___
# 2. y = torch.nn.functional.relu(x)  → Library: ___
# 3. y = torch.sort(x, dim=-1)    → Library: ___
# 4. y = torch.nn.functional.conv2d(...)  → Library: ___

# Hint: use torch.profiler to see the actual kernel names
```

### Exercise 2: torch.compile Benchmark

```python
import torch
import time

# Create a model with many small operations (benefits from fusion)
class SmallOpsModel(torch.nn.Module):
    def __init__(self, d):
        super().__init__()
        self.linear1 = torch.nn.Linear(d, d)
        self.linear2 = torch.nn.Linear(d, d)
        self.norm1 = torch.nn.LayerNorm(d)
        self.norm2 = torch.nn.LayerNorm(d)

    def forward(self, x):
        x = self.norm1(torch.nn.functional.gelu(self.linear1(x)) + x)
        x = self.norm2(torch.nn.functional.gelu(self.linear2(x)) + x)
        return x

if torch.cuda.is_available():
    model = SmallOpsModel(1024).cuda()
    x = torch.randn(64, 1024, device='cuda')

    # TODO: Benchmark eager mode (100 iterations)
    # TODO: Compile the model with torch.compile
    # TODO: Benchmark compiled mode (100 iterations)
    # TODO: What speedup do you observe?
    # TODO: Try different torch.compile modes: "default", "reduce-overhead", "max-autotune"
```

### Exercise 3: Timing GPU Operations Correctly

```python
import torch
import time

if torch.cuda.is_available():
    sizes = [128, 512, 1024, 2048, 4096]

    for size in sizes:
        A = torch.randn(size, size, device='cuda')
        B = torch.randn(size, size, device='cuda')

        # TODO: Time A @ B using three methods:
        # 1. Naive (no sync) — shows why this is wrong
        # 2. With torch.cuda.synchronize()
        # 3. With CUDA events (most accurate)
        # TODO: Compare the three timings. Why do they differ?
        pass
```

---

Next: [Lesson 11: Capstone — CUDA Matrix Multiplication](./11-capstone-cuda-matmul.md)
