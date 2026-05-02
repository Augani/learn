# Lesson 12 — Reading Framework Code

> **Analogy:** PyTorch's source code is like a city. Python is the
> tourist-friendly downtown (easy to navigate). The C++ layer is the
> subway system (complex, but powers everything). CUDA is the power
> plant. This lesson gives you a subway map.

## PyTorch's Architecture

```
  YOUR MODEL CODE (Python)
  ═══════════════════════════════════════════════════════
       │
       │  torch.nn, torch.Tensor
       ▼
  ┌──────────────────────────────────────────────────┐
  │                 Python Frontend                  │
  │  torch/nn/modules/linear.py                      │
  │  torch/autograd/function.py                      │
  └──────────────────┬───────────────────────────────┘
                     │  C++ binding layer
                     ▼
  ┌──────────────────────────────────────────────────┐
  │                   ATen Library                    │
  │  aten/src/ATen/                                  │
  │  - Tensor operations (add, matmul, conv)         │
  │  - Dispatch to CPU, CUDA, or other backends      │
  └──────────────────┬───────────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────────┐
  │              Autograd Engine                      │
  │  torch/csrc/autograd/                            │
  │  - Records computation graph                     │
  │  - Computes gradients                            │
  └──────────────────┬───────────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────────┐
  │           Backend Kernels                         │
  │  aten/src/ATen/native/cpu/   (CPU implementations)│
  │  aten/src/ATen/native/cuda/  (CUDA kernels)      │
  │  Links to cuDNN, cuBLAS, MKL                     │
  └──────────────────────────────────────────────────┘
```

## Key Source Directories

```
  pytorch/
  ├── torch/                    Python frontend
  │   ├── nn/                   Neural network modules
  │   ├── autograd/             Autograd Python interface
  │   └── csrc/                 C++ binding code
  │       ├── autograd/         Autograd engine (C++)
  │       └── api/              LibTorch C++ API
  ├── aten/                     ATen: the tensor library
  │   └── src/ATen/
  │       ├── core/             Tensor, Storage, TensorImpl
  │       ├── native/           Operation implementations
  │       │   ├── cpu/          CPU kernels
  │       │   └── cuda/         CUDA kernels
  │       └── TensorBody.h      Tensor class definition
  ├── c10/                      Core utilities
  │   ├── core/                 Fundamental types
  │   │   ├── Scalar.h
  │   │   ├── TensorImpl.h
  │   │   └── Storage.h
  │   └── util/                 Utilities
  └── caffe2/                   Legacy (being merged)
```

## Following a Tensor Operation: torch.add

```
  Step 1: Python
  z = torch.add(x, y)
  │
  Step 2: Dispatch
  │ torch/_C/_VariableFunctions.pyi  (generated binding)
  │ → calls into C++ via pybind11
  │
  Step 3: ATen dispatch
  │ aten/src/ATen/core/dispatch/Dispatcher.h
  │ → looks up which kernel to call based on:
  │   - dtype (float32, float64, ...)
  │   - device (CPU, CUDA, ...)
  │   - layout (strided, sparse, ...)
  │
  Step 4: Native kernel
  │ aten/src/ATen/native/BinaryOps.cpp  (CPU)
  │ aten/src/ATen/native/cuda/BinaryMulKernel.cu  (CUDA)
  │
  Step 5: Actual computation
  │ Loops over elements or launches CUDA kernel
  ▼
  Result tensor z
```

## TensorImpl — Where Tensors Live

```
  When you do: x = torch.tensor([1.0, 2.0, 3.0])

  Python object "x" (thin wrapper)
  │
  └──> TensorImpl (C++ object)
       ├── Storage ──> actual data buffer [1.0, 2.0, 3.0]
       ├── sizes_   = [3]
       ├── strides_ = [1]
       ├── dtype_   = Float
       ├── device_  = CPU
       └── storage_offset_ = 0
```

```
  c10/core/TensorImpl.h contains the actual tensor representation.

  Key fields (simplified):
  - storage_:    where the raw bytes live
  - sizes_:      shape of the tensor
  - strides_:    how to index into the flat buffer
  - dtype_:      data type (float32, int64, etc.)
  - device_:     CPU, CUDA:0, etc.
```

## Storage — The Raw Buffer

```
  Multiple tensors can share the SAME storage:

  Storage: [1.0][2.0][3.0][4.0][5.0][6.0]
                ▲                    ▲
                │                    │
  Tensor A:     │                    │
  offset=0      │                    │
  size=[6]      │                    │
  stride=[1]    │                    │
                │                    │
  Tensor B (view):                   │
  offset=1                           │
  size=[2, 2]                        │
  stride=[2, 1]                      │

  x = torch.tensor([1,2,3,4,5,6])
  y = x[1:5].view(2, 2)
  # y shares storage with x! No data copy.
```

## The Dispatch Mechanism

```
  torch.add(x, y)
  │
  ▼
  ┌─────────────────────────────┐
  │      Dispatcher             │
  │  "Which kernel should I     │
  │   call for add(float,CPU)?" │
  └───────────┬─────────────────┘
              │
    ┌─────────┼─────────┬──────────┐
    ▼         ▼         ▼          ▼
  CPU       CUDA      MPS       Autograd
  kernel    kernel    kernel    wrapper
  (native)  (native)  (native)  (records grad)

  The dispatcher is like a phone switchboard.
  It routes each operation to the right implementation
  based on the tensor's type and device.
```

## Autograd — Recording the Tape

```
  Forward pass: PyTorch records a DAG of operations.

  z = x * y + b

  ┌───┐    ┌───┐
  │ x │    │ y │
  └─┬─┘    └─┬─┘
    │        │
    └──┬─────┘
       ▼
  ┌─────────┐
  │ MulNode │ ──> saves x, y for backward
  └────┬────┘
       │        ┌───┐
       │        │ b │
       └──┬─────┘
          ▼
  ┌─────────┐
  │ AddNode │ ──> saves inputs for backward
  └────┬────┘
       ▼
  ┌─────────┐
  │    z    │
  └─────────┘

  z.backward() walks this graph in reverse,
  calling each node's backward function.
```

```
  torch/csrc/autograd/ contains:

  engine.cpp         The main backward execution engine
  function.h         Base class for autograd functions
  variable.h         Tensor + gradient tracking
  graph_task.h       Represents a backward pass
  saved_variable.h   How tensors are saved for backward
```

## Native Functions YAML — The Registration System

```
  aten/src/ATen/native/native_functions.yaml

  This file is the MASTER REGISTRY of all ~2000 PyTorch ops.
  Each entry says: name, signature, dispatch keys.

  Example entry (simplified):
  - func: add.Tensor(Tensor self, Tensor other, ...) -> Tensor
    dispatch:
      CPU: add_stub
      CUDA: add_stub
      SparseCPU: add_sparse
```

## Memory Allocator

```
  PyTorch doesn't call cudaMalloc for every tensor.
  It uses a CACHING ALLOCATOR:

  ┌────────────────────────────────────┐
  │         Caching Allocator          │
  │                                    │
  │  Large pool:  [====][====][====]   │
  │  Small pool:  [==][==][==][==]     │
  │                                    │
  │  alloc(100MB) → find a free block  │
  │  free(ptr)    → return to pool     │
  │               (don't call cudaFree)│
  └────────────────────────────────────┘

  Why? cudaMalloc is SLOW (~1ms).
  The caching allocator makes alloc nearly free after warmup.

  c10/cuda/CUDACachingAllocator.h
```

## How to Read Framework Code — Strategy

```
  1. START from Python
     torch.nn.functional.relu(x)
     → Find the Python source (torch/nn/functional.py)

  2. FOLLOW the binding
     → Look for the C++ registration (native_functions.yaml)

  3. FIND the kernel
     → aten/src/ATen/native/... (search for the op name)

  4. READ the dispatch
     → CPU impl in cpu/ folder, CUDA impl in cuda/ folder

  Tips:
  - Use grep/ripgrep liberally
  - native_functions.yaml is your Rosetta Stone
  - Most ops follow the same pattern
```

### Example: Following torch.relu

```bash
rg "def relu" torch/nn/functional.py
rg "relu" aten/src/ATen/native/native_functions.yaml
rg "relu" aten/src/ATen/native/Activation.cpp
rg "relu" aten/src/ATen/native/cuda/Activation.cu
```

## Reading Real Code — Linear Layer

```
  torch.nn.Linear:

  Python (torch/nn/modules/linear.py):
    forward(input) → F.linear(input, self.weight, self.bias)

  F.linear (torch/nn/functional.py):
    → calls torch._C._nn.linear(input, weight, bias)

  C++ (aten/src/ATen/native/Linear.cpp):
    → calls at::matmul(input, weight.t()) + bias

  at::matmul dispatches to:
    CPU: MKL or native BLAS
    CUDA: cuBLAS (cublasGemmEx)
```

## Exercises

1. **Trace torch.relu:** Starting from `torch.relu(x)` in Python, trace
   through the source code and list every file touched until you reach
   the actual computation.

2. **Find the CUDA kernel:** Locate the CUDA kernel for `torch.softmax`.
   Read the kernel code and describe the optimization techniques used.

3. **Dispatch experiment:** Use `torch._C._dispatch_print_key_set(tensor)`
   (or similar introspection) to see what dispatch keys are active for
   different tensor types (CPU float, CUDA float, sparse).

4. **Allocator stats:** Write a Python script that creates and frees
   many CUDA tensors, then prints `torch.cuda.memory_stats()`. Identify
   how the caching allocator reuses memory.

5. **native_functions.yaml:** Find 5 operations in native_functions.yaml
   and for each, locate the corresponding CPU and CUDA implementations.
   Note which ones dispatch to external libraries (cuDNN, cuBLAS).

---

[Next: Lesson 13 — Performance Optimization →](13-performance-optimization.md)
