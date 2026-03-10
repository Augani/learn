# Lesson 11 — Custom PyTorch Ops

> **Analogy:** PyTorch is a restaurant with a full menu (existing ops).
> Sometimes you want a dish that's not on the menu. Custom ops let you
> walk into the kitchen and cook it yourself — using PyTorch's pans
> (tensors), stove (autograd), and ingredients (CUDA kernels).

## Why Custom Ops?

```
  Standard PyTorch:
  ┌──────────────────────────────────────┐
  │  Python  →  ATen (C++) → cuDNN/cuBLAS│
  │  model       dispatches    actual GPU │
  │  code        to backend    computation│
  └──────────────────────────────────────┘

  Custom Op:
  ┌──────────────────────────────────────┐
  │  Python  →  Your C++/CUDA  → GPU    │
  │  model      (registered       direct │
  │  code        as a PyTorch     kernel │
  │              op)               exec  │
  └──────────────────────────────────────┘
```

## The torch.autograd.Function API

```python
import torch

class MyReLU(torch.autograd.Function):
    @staticmethod
    def forward(ctx, input):
        ctx.save_for_backward(input)
        return input.clamp(min=0)

    @staticmethod
    def backward(ctx, grad_output):
        input, = ctx.saved_tensors
        grad_input = grad_output.clone()
        grad_input[input < 0] = 0
        return grad_input

x = torch.randn(5, requires_grad=True)
y = MyReLU.apply(x)
y.sum().backward()
print(f"input:    {x.data}")
print(f"gradient: {x.grad}")
```

Now let's make the forward and backward run in C++.

## C++ Extension with torch/extension.h

**my_relu.cpp:**
```cpp
#include <torch/extension.h>

torch::Tensor relu_forward(torch::Tensor input) {
    TORCH_CHECK(input.dtype() == torch::kFloat32,
                "Expected float32 tensor");
    return input.clamp_min(0);
}

torch::Tensor relu_backward(torch::Tensor grad_output,
                             torch::Tensor input) {
    auto grad_input = grad_output.clone();
    grad_input.index_put_({input < 0}, 0);
    return grad_input;
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("forward", &relu_forward, "ReLU forward");
    m.def("backward", &relu_backward, "ReLU backward");
}
```

## Building with setup.py

```python
from setuptools import setup
from torch.utils.cpp_extension import BuildExtension, CppExtension

setup(
    name="my_relu",
    ext_modules=[
        CppExtension("my_relu", ["my_relu.cpp"]),
    ],
    cmdclass={"build_ext": BuildExtension},
)
```

```bash
pip install -e .
```

## Using the C++ Op in Python

```python
import torch
import my_relu

class CustomReLU(torch.autograd.Function):
    @staticmethod
    def forward(ctx, input):
        ctx.save_for_backward(input)
        return my_relu.forward(input)

    @staticmethod
    def backward(ctx, grad_output):
        input, = ctx.saved_tensors
        return my_relu.backward(grad_output, input)

x = torch.randn(1000, requires_grad=True)
y = CustomReLU.apply(x)
loss = y.sum()
loss.backward()
print(f"Gradient shape: {x.grad.shape}")
```

## CUDA Extension — GPU Custom Op

**my_relu_cuda.cu:**
```cuda
#include <torch/extension.h>

__global__ void relu_forward_kernel(const float* input,
                                     float* output, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        output[idx] = input[idx] > 0 ? input[idx] : 0;
    }
}

__global__ void relu_backward_kernel(const float* grad_output,
                                      const float* input,
                                      float* grad_input, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        grad_input[idx] = input[idx] > 0 ? grad_output[idx] : 0;
    }
}

torch::Tensor relu_cuda_forward(torch::Tensor input) {
    TORCH_CHECK(input.is_cuda(), "Input must be CUDA tensor");
    TORCH_CHECK(input.dtype() == torch::kFloat32, "Expected float32");

    auto output = torch::empty_like(input);
    int n = input.numel();
    int threads = 256;
    int blocks = (n + threads - 1) / threads;

    relu_forward_kernel<<<blocks, threads>>>(
        input.data_ptr<float>(),
        output.data_ptr<float>(),
        n);

    return output;
}

torch::Tensor relu_cuda_backward(torch::Tensor grad_output,
                                  torch::Tensor input) {
    TORCH_CHECK(grad_output.is_cuda(), "grad must be CUDA tensor");
    auto grad_input = torch::empty_like(input);
    int n = input.numel();
    int threads = 256;
    int blocks = (n + threads - 1) / threads;

    relu_backward_kernel<<<blocks, threads>>>(
        grad_output.data_ptr<float>(),
        input.data_ptr<float>(),
        grad_input.data_ptr<float>(),
        n);

    return grad_input;
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("forward", &relu_cuda_forward, "ReLU CUDA forward");
    m.def("backward", &relu_cuda_backward, "ReLU CUDA backward");
}
```

### Build CUDA Extension

```python
from setuptools import setup
from torch.utils.cpp_extension import BuildExtension, CUDAExtension

setup(
    name="my_relu_cuda",
    ext_modules=[
        CUDAExtension("my_relu_cuda", ["my_relu_cuda.cu"]),
    ],
    cmdclass={"build_ext": BuildExtension},
)
```

## JIT Compilation — No setup.py Needed

```python
from torch.utils.cpp_extension import load

my_relu = load(
    name="my_relu",
    sources=["my_relu.cpp"],
    verbose=True,
)

x = torch.randn(100)
y = my_relu.forward(x)
```

For CUDA:
```python
my_relu_cuda = load(
    name="my_relu_cuda",
    sources=["my_relu_cuda.cu"],
    verbose=True,
)
```

## Accessing Tensor Properties in C++

```cpp
#include <torch/extension.h>

void inspect_tensor(torch::Tensor t) {
    printf("dtype:   %s\n",
           t.dtype().name().c_str());
    printf("device:  %s\n",
           t.device().str().c_str());
    printf("shape:   [");
    for (int i = 0; i < t.dim(); i++) {
        if (i > 0) printf(", ");
        printf("%ld", t.size(i));
    }
    printf("]\n");
    printf("numel:   %ld\n", t.numel());
    printf("contiguous: %s\n",
           t.is_contiguous() ? "yes" : "no");
}
```

```
  PyTorch Tensor C++ API    Python equivalent
  ════════════════════════   ═════════════════
  t.data_ptr<float>()       t.data_ptr()
  t.size(0)                 t.shape[0]
  t.numel()                 t.numel()
  t.dim()                   t.dim()
  t.is_cuda()               t.is_cuda
  t.is_contiguous()         t.is_contiguous()
  t.to(torch::kCUDA)        t.cuda()
  torch::empty_like(t)      torch.empty_like(t)
  torch::zeros({3, 4})      torch.zeros(3, 4)
```

## Dispatch to CPU or CUDA

```cpp
#include <torch/extension.h>

torch::Tensor my_op_cpu(torch::Tensor input);
torch::Tensor my_op_cuda(torch::Tensor input);

torch::Tensor my_op(torch::Tensor input) {
    if (input.is_cuda()) {
        return my_op_cuda(input);
    }
    return my_op_cpu(input);
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("my_op", &my_op, "Dispatches to CPU or CUDA");
}
```

```
  Python call:
  my_module.my_op(tensor)
       │
       ├── tensor.is_cuda? ──yes──> my_op_cuda()
       │
       └── no ──> my_op_cpu()
```

## Testing Custom Ops

```python
import torch
import my_relu_cuda

def test_relu_forward():
    x = torch.tensor([-1.0, 0.0, 1.0, 2.0], device="cuda")
    y = my_relu_cuda.forward(x)
    expected = torch.tensor([0.0, 0.0, 1.0, 2.0], device="cuda")
    assert torch.allclose(y, expected)

def test_relu_backward():
    x = torch.tensor([-1.0, 0.0, 1.0, 2.0], device="cuda")
    grad = torch.ones_like(x)
    gx = my_relu_cuda.backward(grad, x)
    expected = torch.tensor([0.0, 0.0, 1.0, 1.0], device="cuda")
    assert torch.allclose(gx, expected)

def test_gradcheck():
    x = torch.randn(20, dtype=torch.double, device="cuda",
                     requires_grad=True)
    assert torch.autograd.gradcheck(
        CustomReLU.apply, (x,), eps=1e-6, atol=1e-4
    )

test_relu_forward()
test_relu_backward()
print("All tests passed")
```

## Exercises

1. **Leaky ReLU:** Write a custom C++ op for Leaky ReLU with configurable
   negative slope. Include forward and backward. Test with `gradcheck`.

2. **CUDA softmax:** Write a CUDA kernel for softmax (forward only).
   Compare output and speed with `torch.softmax`.

3. **Fused operation:** Write a single CUDA kernel that computes
   `ReLU(x * W + b)` for a 1D input. This fuses multiply, add, and
   activation — reducing memory round-trips.

4. **Custom loss:** Implement Huber loss as a custom op with C++ forward
   and backward. Verify with `torch.autograd.gradcheck`.

5. **Benchmarking:** Compare your CUDA ReLU vs PyTorch's built-in ReLU
   on tensors of size 1K, 1M, and 100M. Plot kernel time vs tensor size.

---

[Next: Lesson 12 — Reading Framework Code →](12-reading-framework-code.md)
