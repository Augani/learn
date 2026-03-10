# Lesson 14 — Build an ML Kernel (Capstone)

> **Analogy:** You've learned to drive (C/C++), navigate the factory floor
> (CUDA), and build bridges (pybind11). Now you'll build a complete product:
> a CUDA matrix multiplication kernel, integrated into PyTorch, callable
> from Python. This is exactly what framework developers do.

## The Goal

```
  ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
  │   Python     │     │   C++/CUDA       │     │     GPU     │
  │              │     │                  │     │             │
  │  z = my_    │────>│  dispatch to     │────>│  CUDA kernel│
  │   matmul(   │     │  CUDA kernel     │     │  runs matmul│
  │   x, y)     │<────│  return tensor   │<────│  returns    │
  │              │     │                  │     │             │
  │  z.backward()│────>│  backward kernel │────>│  computes   │
  │              │<────│  return grads    │<────│  gradients  │
  └─────────────┘     └──────────────────┘     └─────────────┘
```

## Step 1: Naive CUDA Matrix Multiply

```cuda
#include <cstdio>
#include <cstdlib>
#include <cmath>

__global__ void matmul_naive(const float* A, const float* B,
                              float* C, int M, int N, int K) {
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

int main() {
    int M = 1024, N = 1024, K = 1024;

    float* h_A = (float*)malloc(M * K * sizeof(float));
    float* h_B = (float*)malloc(K * N * sizeof(float));
    float* h_C = (float*)malloc(M * N * sizeof(float));

    for (int i = 0; i < M * K; i++) h_A[i] = ((float)rand() / RAND_MAX) * 0.01f;
    for (int i = 0; i < K * N; i++) h_B[i] = ((float)rand() / RAND_MAX) * 0.01f;

    float *d_A, *d_B, *d_C;
    cudaMalloc(&d_A, M * K * sizeof(float));
    cudaMalloc(&d_B, K * N * sizeof(float));
    cudaMalloc(&d_C, M * N * sizeof(float));

    cudaMemcpy(d_A, h_A, M * K * sizeof(float), cudaMemcpyHostToDevice);
    cudaMemcpy(d_B, h_B, K * N * sizeof(float), cudaMemcpyHostToDevice);

    dim3 block(16, 16);
    dim3 grid((N + 15) / 16, (M + 15) / 16);

    cudaEvent_t start, stop;
    cudaEventCreate(&start);
    cudaEventCreate(&stop);

    cudaEventRecord(start);
    matmul_naive<<<grid, block>>>(d_A, d_B, d_C, M, N, K);
    cudaEventRecord(stop);
    cudaEventSynchronize(stop);

    float ms;
    cudaEventElapsedTime(&ms, start, stop);
    float gflops = (2.0f * M * N * K) / (ms * 1e6);
    printf("Naive matmul: %.3f ms, %.1f GFLOPS\n", ms, gflops);

    cudaMemcpy(h_C, d_C, M * N * sizeof(float), cudaMemcpyDeviceToHost);
    printf("C[0][0] = %f\n", h_C[0]);

    cudaEventDestroy(start);
    cudaEventDestroy(stop);
    cudaFree(d_A); cudaFree(d_B); cudaFree(d_C);
    free(h_A); free(h_B); free(h_C);
    return 0;
}
```

## Step 2: Tiled Shared-Memory Kernel

```
  Why tiling?

  Naive kernel: each thread reads K values from A and K from B
  = 2*K global memory reads per output element
  = 2 * 1024 * 4 bytes = 8KB per thread... terrible!

  Tiled kernel: load a TILE_SIZE x TILE_SIZE block into shared mem
  All threads in the block reuse those values

  Global reads reduced by factor of TILE_SIZE
  1024 / 32 = 32x fewer global reads!

  ┌─────────────────────────────────────────────────┐
  │  A matrix          B matrix         C matrix    │
  │  ┌───┬───┬───┐    ┌───┬───┬───┐   ┌───────┐   │
  │  │ T0│ T1│...│    │ T0│   │   │   │ block │   │
  │  ├───┼───┼───┤    ├───┤   │   │   │ output│   │
  │  │   │   │   │    │ T1│   │   │   │       │   │
  │  └───┴───┴───┘    ├───┤   │   │   └───────┘   │
  │                    │...│   │   │                │
  │  Load tile by tile └───┴───┴───┘                │
  │  into shared memory                             │
  └─────────────────────────────────────────────────┘
```

```cuda
#define TILE_SIZE 32

__global__ void matmul_tiled(const float* A, const float* B,
                              float* C, int M, int N, int K) {
    __shared__ float As[TILE_SIZE][TILE_SIZE];
    __shared__ float Bs[TILE_SIZE][TILE_SIZE];

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

## Step 3: Wrap as a PyTorch Extension

**matmul_kernel.cu:**
```cuda
#include <torch/extension.h>

#define TILE_SIZE 32
#define CUDA_CHECK(call) do { \
    cudaError_t err = call; \
    if (err != cudaSuccess) { \
        TORCH_CHECK(false, "CUDA error: ", cudaGetErrorString(err)); \
    } \
} while(0)

__global__ void matmul_forward_kernel(const float* A, const float* B,
                                       float* C, int M, int N, int K) {
    __shared__ float As[TILE_SIZE][TILE_SIZE];
    __shared__ float Bs[TILE_SIZE][TILE_SIZE];

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

        for (int k = 0; k < TILE_SIZE; k++) {
            sum += As[threadIdx.y][k] * Bs[k][threadIdx.x];
        }

        __syncthreads();
    }

    if (row < M && col < N) {
        C[row * N + col] = sum;
    }
}

torch::Tensor matmul_forward(torch::Tensor A, torch::Tensor B) {
    TORCH_CHECK(A.is_cuda() && B.is_cuda(), "Inputs must be CUDA tensors");
    TORCH_CHECK(A.dtype() == torch::kFloat32, "Expected float32");
    TORCH_CHECK(A.dim() == 2 && B.dim() == 2, "Expected 2D tensors");
    TORCH_CHECK(A.size(1) == B.size(0), "Incompatible shapes");

    int M = A.size(0);
    int K = A.size(1);
    int N = B.size(1);

    auto C = torch::zeros({M, N}, A.options());

    dim3 block(TILE_SIZE, TILE_SIZE);
    dim3 grid((N + TILE_SIZE - 1) / TILE_SIZE,
              (M + TILE_SIZE - 1) / TILE_SIZE);

    matmul_forward_kernel<<<grid, block>>>(
        A.data_ptr<float>(),
        B.data_ptr<float>(),
        C.data_ptr<float>(),
        M, N, K);

    CUDA_CHECK(cudaGetLastError());
    return C;
}

std::vector<torch::Tensor> matmul_backward(
    torch::Tensor grad_output,
    torch::Tensor A,
    torch::Tensor B) {
    auto grad_A = matmul_forward(grad_output, B.t());
    auto grad_B = matmul_forward(A.t(), grad_output);
    return {grad_A, grad_B};
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("forward", &matmul_forward, "Custom matmul forward");
    m.def("backward", &matmul_backward, "Custom matmul backward");
}
```

## Step 4: Build System

**setup.py:**
```python
from setuptools import setup
from torch.utils.cpp_extension import BuildExtension, CUDAExtension

setup(
    name="custom_matmul",
    ext_modules=[
        CUDAExtension(
            "custom_matmul",
            ["matmul_kernel.cu"],
            extra_compile_args={"nvcc": ["-O3", "--use_fast_math"]},
        ),
    ],
    cmdclass={"build_ext": BuildExtension},
)
```

```bash
pip install -e .
```

## Step 5: Python Integration with Autograd

**my_matmul.py:**
```python
import torch
import custom_matmul

class CustomMatmul(torch.autograd.Function):
    @staticmethod
    def forward(ctx, A, B):
        ctx.save_for_backward(A, B)
        return custom_matmul.forward(A, B)

    @staticmethod
    def backward(ctx, grad_output):
        A, B = ctx.saved_tensors
        grad_A, grad_B = custom_matmul.backward(grad_output, A, B)
        return grad_A, grad_B

def my_matmul(A, B):
    return CustomMatmul.apply(A, B)
```

## Step 6: Testing

```python
import torch
from my_matmul import my_matmul

def test_correctness():
    A = torch.randn(128, 256, device="cuda")
    B = torch.randn(256, 64, device="cuda")

    expected = torch.matmul(A, B)
    actual = my_matmul(A, B)

    max_diff = (expected - actual).abs().max().item()
    print(f"Max difference: {max_diff:.6e}")
    assert max_diff < 1e-3, f"Too large: {max_diff}"
    print("Forward test PASSED")

def test_backward():
    A = torch.randn(32, 64, device="cuda", dtype=torch.float64,
                     requires_grad=True)
    B = torch.randn(64, 32, device="cuda", dtype=torch.float64,
                     requires_grad=True)

    passed = torch.autograd.gradcheck(
        my_matmul, (A, B), eps=1e-6, atol=1e-4
    )
    print(f"Gradient check: {'PASSED' if passed else 'FAILED'}")

def benchmark():
    sizes = [128, 256, 512, 1024, 2048]
    for n in sizes:
        A = torch.randn(n, n, device="cuda")
        B = torch.randn(n, n, device="cuda")

        for _ in range(10):
            my_matmul(A, B)
        torch.cuda.synchronize()

        start = torch.cuda.Event(enable_timing=True)
        end = torch.cuda.Event(enable_timing=True)
        start.record()
        for _ in range(100):
            my_matmul(A, B)
        end.record()
        torch.cuda.synchronize()
        custom_ms = start.elapsed_time(end) / 100

        start.record()
        for _ in range(100):
            torch.matmul(A, B)
        end.record()
        torch.cuda.synchronize()
        torch_ms = start.elapsed_time(end) / 100

        gflops_custom = (2 * n * n * n) / (custom_ms * 1e6)
        gflops_torch = (2 * n * n * n) / (torch_ms * 1e6)

        print(f"N={n:4d}: custom={custom_ms:.3f}ms "
              f"({gflops_custom:.0f} GFLOPS), "
              f"torch={torch_ms:.3f}ms "
              f"({gflops_torch:.0f} GFLOPS), "
              f"ratio={torch_ms/custom_ms:.2f}x")

test_correctness()
benchmark()
```

## Step 7: Using in a Neural Network

```python
import torch
import torch.nn as nn
from my_matmul import my_matmul

class CustomLinear(nn.Module):
    def __init__(self, in_features, out_features):
        super().__init__()
        self.weight = nn.Parameter(
            torch.randn(out_features, in_features) * 0.01
        )
        self.bias = nn.Parameter(torch.zeros(out_features))

    def forward(self, x):
        return my_matmul(x, self.weight.t()) + self.bias

class SimpleNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = CustomLinear(784, 256)
        self.fc2 = CustomLinear(256, 10)

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        return self.fc2(x)

model = SimpleNet().cuda()
x = torch.randn(32, 784, device="cuda")
y = model(x)
loss = y.sum()
loss.backward()
print(f"Output shape: {y.shape}")
print(f"fc1.weight.grad shape: {model.fc1.weight.grad.shape}")
```

## Performance Analysis

```
  Typical performance hierarchy for matmul (N=1024):

  Implementation              GFLOPS    % of peak
  ═══════════════════════     ══════    ═════════
  Naive CUDA kernel           ~50       ~0.5%
  Tiled shared memory         ~500      ~5%
  + register tiling           ~2000     ~20%
  + vectorized loads          ~5000     ~50%
  cuBLAS (torch.matmul)       ~10000    ~95%

  Our tiled kernel is ~5-10% of cuBLAS.
  cuBLAS uses register tiling, warp-level primitives,
  and hand-tuned assembly. Years of optimization.

  The point is NOT to beat cuBLAS.
  The point is to UNDERSTAND what it does and to be
  able to write custom kernels for ops cuBLAS doesn't have.
```

## What You've Accomplished

```
  Lesson 01: C fundamentals
  Lesson 02: Pointer mastery
  Lesson 03: Manual memory management
  Lesson 04: C++ RAII, smart pointers, templates
  Lesson 05: STL containers
  Lesson 06: Build systems (CMake, Make)
  Lesson 07: GPU architecture & CUDA model
  Lesson 08: CUDA kernels, shared memory, streams
  Lesson 09: CUDA optimization techniques
  Lesson 10: pybind11 for Python bindings
  Lesson 11: Custom PyTorch operators
  Lesson 12: Reading PyTorch internals
  Lesson 13: CPU performance optimization
  Lesson 14: Full pipeline: CUDA kernel → PyTorch → Python
       |
       v
  You can now:
  [x] Read PyTorch's C++ source code
  [x] Write CUDA kernels from scratch
  [x] Create custom PyTorch operators
  [x] Profile and optimize GPU code
  [x] Build C++ Python extensions
```

## Exercises

1. **Optimize further:** Add register tiling to the matmul kernel (each
   thread computes a TILE_M x TILE_N sub-block, not just one element).
   Measure the GFLOPS improvement.

2. **Custom activation:** Write a full CUDA kernel for GELU activation
   (forward + backward), wrap it as a PyTorch op, and use it in a model.

3. **Fused linear + ReLU:** Write a single CUDA kernel that computes
   `ReLU(x @ W^T + b)` without writing the intermediate result to memory.
   Compare latency with separate matmul + ReLU.

4. **Batch matmul:** Extend the kernel to support batched matrix
   multiplication (3D tensors). This is what attention layers need.

5. **Full model:** Build a 3-layer MLP using only your custom kernels
   (matmul + GELU + matmul + GELU + matmul). Train on MNIST and verify
   it converges.

---

## Where to Go Next

- **Triton:** OpenAI's compiler for GPU kernels — write CUDA-level
  performance in Python syntax
- **FlashAttention:** Study how fused attention kernels achieve 2-4x
  speedup over standard attention
- **cutlass:** NVIDIA's template library for high-performance GEMM
- **TVM / MLIR:** Compiler frameworks for ML workloads

---

[Back to Track Overview →](00-roadmap.md)

**Reference Materials:**
- [C++ Cheatsheet for Rust Devs](reference-cpp-cheatsheet.md)
- [CUDA Quick Reference](reference-cuda.md)
