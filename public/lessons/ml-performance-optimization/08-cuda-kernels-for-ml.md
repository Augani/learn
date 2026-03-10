# 08 - CUDA Kernels for ML

## The Analogy

You've been using a food delivery app to get meals. It's convenient -- you
tap a button, food arrives. But sometimes the menu doesn't have what you need.
Maybe you want a very specific dish, or you need to feed 10,000 people and
the delivery service can't scale.

So you learn to cook. It's more work, but now you can make exactly what you
need, optimized precisely for your situation.

CUDA programming is learning to cook on the GPU. PyTorch is the delivery app --
it provides pre-built operations. But when those operations don't exist, aren't
fast enough, or don't combine the way you need, you write custom CUDA kernels.

```
  CUDA EXECUTION MODEL

  GPU
  +------------------------------------------------------------------+
  |  SM 0              SM 1              SM 2              SM N       |
  |  +--------------+  +--------------+  +--------------+  +------+  |
  |  | Block (0,0)  |  | Block (1,0)  |  | Block (2,0)  |  | ...  |  |
  |  | [T0][T1]...  |  | [T0][T1]...  |  | [T0][T1]...  |  |      |  |
  |  | [T32][T33]...|  | [T32][T33]...|  | [T32][T33]...|  |      |  |
  |  +--------------+  +--------------+  +--------------+  +------+  |
  |                                                                  |
  |  Global Memory (HBM): 40-80 GB                                   |
  +------------------------------------------------------------------+

  Thread: smallest unit of execution
  Warp: 32 threads executing in lockstep (SIMT)
  Block: group of threads sharing shared memory (up to 1024 threads)
  Grid: all blocks in a kernel launch
  SM: Streaming Multiprocessor (hardware that runs blocks)
```

## Kernel Launch Basics

A CUDA kernel is a function that runs on thousands of GPU threads
simultaneously. Each thread knows its position via built-in variables.

```cpp
// kernel.cu

__global__ void vector_add(float* a, float* b, float* c, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        c[idx] = a[idx] + b[idx];
    }
}
```

The `__global__` keyword means "this runs on the GPU, called from the CPU."
`blockIdx.x` and `threadIdx.x` are built-in variables telling each thread
its position.

```
  THREAD-BLOCK-GRID MAPPING

  Grid (1D example, 4 blocks of 256 threads each):

  Block 0              Block 1              Block 2              Block 3
  [T0..T255]          [T256..T511]         [T512..T767]         [T768..T1023]

  Thread 500:
  blockIdx.x = 1       (500 / 256 = 1)
  threadIdx.x = 244    (500 % 256 = 244)
  global_idx = 1 * 256 + 244 = 500

  Each thread computes one element of the output.
  Total threads = grid_size * block_size >= n
```

### Launching from Python via PyTorch

The easiest way to integrate custom CUDA with PyTorch is through the
`torch.utils.cpp_extension` module:

```python
from torch.utils.cpp_extension import load_inline

cuda_source = """
__global__ void vector_add_kernel(
    const float* __restrict__ a,
    const float* __restrict__ b,
    float* __restrict__ c,
    int n
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        c[idx] = a[idx] + b[idx];
    }
}

torch::Tensor vector_add(torch::Tensor a, torch::Tensor b) {
    TORCH_CHECK(a.device().is_cuda(), "a must be on CUDA");
    TORCH_CHECK(b.device().is_cuda(), "b must be on CUDA");
    TORCH_CHECK(a.sizes() == b.sizes(), "size mismatch");

    auto c = torch::empty_like(a);
    int n = a.numel();
    int threads = 256;
    int blocks = (n + threads - 1) / threads;

    vector_add_kernel<<<blocks, threads>>>(
        a.data_ptr<float>(),
        b.data_ptr<float>(),
        c.data_ptr<float>(),
        n
    );

    return c;
}
"""

cpp_source = """
torch::Tensor vector_add(torch::Tensor a, torch::Tensor b);
"""

custom_ops = load_inline(
    name="custom_ops",
    cpp_sources=cpp_source,
    cuda_sources=cuda_source,
    functions=["vector_add"],
    verbose=True,
)

a = torch.randn(1000000, device='cuda')
b = torch.randn(1000000, device='cuda')
c = custom_ops.vector_add(a, b)
```

`load_inline` compiles the CUDA code at runtime and creates a Python module.
The first call is slow (compilation), subsequent calls use the cached binary.

## Custom Attention Kernel

Let's build a simplified scaled dot-product attention kernel to understand
how real attention implementations work. This is educational -- in production,
use Flash Attention.

```cpp
// Simple scaled dot-product attention for one head
// Q, K, V: (seq_len, head_dim)
// Output: (seq_len, head_dim)

__global__ void simple_attention_kernel(
    const float* __restrict__ Q,
    const float* __restrict__ K,
    const float* __restrict__ V,
    float* __restrict__ output,
    int seq_len,
    int head_dim,
    float scale
) {
    int row = blockIdx.x;
    int col = threadIdx.x;

    if (row >= seq_len || col >= head_dim) return;

    extern __shared__ float shared_mem[];
    float* scores = shared_mem;

    float score_val = 0.0f;
    for (int k = 0; k < head_dim; k++) {
        score_val += Q[row * head_dim + k] * K[col * head_dim + k];
    }

    if (col < seq_len) {
        scores[col] = score_val * scale;
    }
    __syncthreads();

    if (col == 0) {
        float max_val = -INFINITY;
        for (int j = 0; j < seq_len; j++) {
            max_val = fmaxf(max_val, scores[j]);
        }
        shared_mem[seq_len] = max_val;
    }
    __syncthreads();

    float max_val = shared_mem[seq_len];
    if (col < seq_len) {
        scores[col] = expf(scores[col] - max_val);
    }
    __syncthreads();

    if (col == 0) {
        float sum = 0.0f;
        for (int j = 0; j < seq_len; j++) {
            sum += scores[j];
        }
        shared_mem[seq_len + 1] = sum;
    }
    __syncthreads();

    float sum = shared_mem[seq_len + 1];
    float result = 0.0f;
    for (int j = 0; j < seq_len; j++) {
        float attn_weight = scores[j] / sum;
        result += attn_weight * V[j * head_dim + col];
    }

    output[row * head_dim + col] = result;
}
```

This is intentionally naive -- it illustrates the structure. Real
implementations (Flash Attention) use tiling, online softmax, and careful
memory management to be 5-10x faster.

**Key patterns to notice:**
- `__syncthreads()` synchronizes all threads in a block
- `extern __shared__ float shared_mem[]` declares shared memory
- The softmax is computed in-place in shared memory
- Each thread handles one output element

## Custom Loss Kernel

Custom losses are a great use case for CUDA kernels because they're often
element-wise with reductions -- perfect for fusion.

```cpp
__global__ void focal_loss_kernel(
    const float* __restrict__ logits,
    const int64_t* __restrict__ targets,
    float* __restrict__ output,
    int batch_size,
    int num_classes,
    float gamma,
    float alpha
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= batch_size) return;

    const float* logit_row = logits + idx * num_classes;
    int target = targets[idx];

    float max_logit = logit_row[0];
    for (int c = 1; c < num_classes; c++) {
        max_logit = fmaxf(max_logit, logit_row[c]);
    }

    float sum_exp = 0.0f;
    for (int c = 0; c < num_classes; c++) {
        sum_exp += expf(logit_row[c] - max_logit);
    }

    float log_softmax = logit_row[target] - max_logit - logf(sum_exp);
    float pt = expf(log_softmax);

    output[idx] = -alpha * powf(1.0f - pt, gamma) * log_softmax;
}
```

This fused focal loss kernel:
1. Computes log-softmax (numerically stable)
2. Computes the focal weighting
3. Returns the loss per sample

All in one kernel, with one read from global memory. The unfused PyTorch
equivalent would be 5-6 separate kernels.

## Integration with PyTorch Autograd

For training, you need gradients. Integrate custom kernels with PyTorch's
autograd by defining a `Function`:

```python
class FusedFocalLoss(torch.autograd.Function):
    @staticmethod
    def forward(ctx, logits, targets, gamma=2.0, alpha=0.25):
        ctx.save_for_backward(logits, targets)
        ctx.gamma = gamma
        ctx.alpha = alpha

        output = torch.empty(logits.shape[0], device=logits.device)
        threads = 256
        blocks = (logits.shape[0] + threads - 1) // threads

        custom_ops.focal_loss_forward(
            logits, targets, output,
            logits.shape[0], logits.shape[1],
            gamma, alpha,
            blocks, threads,
        )
        return output

    @staticmethod
    def backward(ctx, grad_output):
        logits, targets = ctx.saved_tensors
        grad_logits = torch.empty_like(logits)

        threads = 256
        blocks = (logits.shape[0] + threads - 1) // threads

        custom_ops.focal_loss_backward(
            grad_output, logits, targets, grad_logits,
            logits.shape[0], logits.shape[1],
            ctx.gamma, ctx.alpha,
            blocks, threads,
        )
        return grad_logits, None, None, None
```

## Thread/Block/Grid Design

Choosing the right thread configuration is critical for performance.

```
  RULES OF THUMB

  1. Block size should be a multiple of 32 (warp size)
     Good: 128, 256, 512
     Bad: 100, 200, 300

  2. Total threads >= number of elements to process
     blocks = ceil(n_elements / block_size)

  3. For 2D problems (matrices):
     Block: (16, 16) or (32, 32) -- 256 or 1024 threads
     Grid: (ceil(cols/16), ceil(rows/16))

  4. More blocks is generally better (keeps all SMs busy)
     Minimum: num_SMs (e.g., 108 on A100)
     Ideal: several thousand
```

For matrix operations:

```cpp
// 2D grid for matrix operations
dim3 block(16, 16);
dim3 grid(
    (num_cols + block.x - 1) / block.x,
    (num_rows + block.y - 1) / block.y
);
my_kernel<<<grid, block>>>(args...);
```

```
  2D GRID MAPPING (for 64x64 matrix with 16x16 blocks)

  Grid:
  +--------+--------+--------+--------+
  |(0,0)   |(1,0)   |(2,0)   |(3,0)   |
  |16x16   |16x16   |16x16   |16x16   |
  +--------+--------+--------+--------+
  |(0,1)   |(1,1)   |(2,1)   |(3,1)   |
  |16x16   |16x16   |16x16   |16x16   |
  +--------+--------+--------+--------+
  |(0,2)   |(1,2)   |(2,2)   |(3,2)   |
  |16x16   |16x16   |16x16   |16x16   |
  +--------+--------+--------+--------+
  |(0,3)   |(1,3)   |(2,3)   |(3,3)   |
  |16x16   |16x16   |16x16   |16x16   |
  +--------+--------+--------+--------+

  Each block handles a 16x16 tile of the output matrix.
  4x4 = 16 blocks total.
```

## Performance Optimization Patterns

### Pattern: Shared Memory Tiling

```cpp
// Tiled matrix multiply: each block computes a TILE_SIZExTILE_SIZE output tile
#define TILE_SIZE 32

__global__ void matmul_tiled(
    const float* A, const float* B, float* C,
    int M, int N, int K
) {
    __shared__ float As[TILE_SIZE][TILE_SIZE];
    __shared__ float Bs[TILE_SIZE][TILE_SIZE];

    int row = blockIdx.y * TILE_SIZE + threadIdx.y;
    int col = blockIdx.x * TILE_SIZE + threadIdx.x;
    float sum = 0.0f;

    for (int t = 0; t < (K + TILE_SIZE - 1) / TILE_SIZE; t++) {
        int a_col = t * TILE_SIZE + threadIdx.x;
        int b_row = t * TILE_SIZE + threadIdx.y;

        As[threadIdx.y][threadIdx.x] = (row < M && a_col < K) ?
            A[row * K + a_col] : 0.0f;
        Bs[threadIdx.y][threadIdx.x] = (b_row < K && col < N) ?
            B[b_row * N + col] : 0.0f;

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

This is the canonical tiled matmul. Each iteration loads one tile of A and B
into shared memory (one global memory read), then performs TILE_SIZE multiply-
accumulate operations from shared memory (fast). The ratio of compute to
memory access is TILE_SIZE:1.

### Pattern: Warp-Level Reduction

```cpp
__inline__ __device__ float warp_reduce_sum(float val) {
    for (int offset = 16; offset > 0; offset /= 2) {
        val += __shfl_down_sync(0xffffffff, val, offset);
    }
    return val;
}

__global__ void row_sum_kernel(
    const float* input, float* output,
    int rows, int cols
) {
    int row = blockIdx.x;
    if (row >= rows) return;

    float sum = 0.0f;
    for (int col = threadIdx.x; col < cols; col += blockDim.x) {
        sum += input[row * cols + col];
    }

    sum = warp_reduce_sum(sum);

    if (threadIdx.x % 32 == 0) {
        atomicAdd(&output[row], sum);
    }
}
```

`__shfl_down_sync` exchanges values between threads in a warp without using
shared memory -- it's the fastest possible communication between threads.

## Building a PyTorch Extension

For production use, build a proper extension instead of `load_inline`:

```
my_extension/
  setup.py
  csrc/
    kernels.cu
    bindings.cpp
```

```python
# setup.py
from setuptools import setup
from torch.utils.cpp_extension import BuildExtension, CUDAExtension

setup(
    name='my_extension',
    ext_modules=[
        CUDAExtension(
            'my_extension',
            ['csrc/bindings.cpp', 'csrc/kernels.cu'],
            extra_compile_args={
                'cxx': ['-O3'],
                'nvcc': ['-O3', '--use_fast_math'],
            },
        ),
    ],
    cmdclass={'build_ext': BuildExtension},
)
```

```cpp
// csrc/bindings.cpp
#include <torch/extension.h>

torch::Tensor my_kernel_wrapper(torch::Tensor input);

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("my_kernel", &my_kernel_wrapper, "My custom kernel");
}
```

Install with `pip install -e .` and use as `import my_extension`.

## When CUDA vs Triton

```
  TRITON                              CUDA
  ----------------------------------  ----------------------------------
  Python syntax                       C++ syntax
  Auto-vectorization                  Manual vectorization
  Auto memory management              Manual shared memory management
  Good for element-wise + reductions  Good for everything
  Limited control over warps          Full warp-level control
  Faster development                  More optimization potential
  ~80-95% of hand-tuned CUDA perf    100% ceiling

  Use Triton for: fusing element-wise ops, custom losses, simple reductions
  Use CUDA for: tiled matmul, attention kernels, complex parallel algorithms
```

## Exercises

1. Write a CUDA kernel that computes GELU activation fused with a bias add.
   Benchmark against `torch.nn.functional.gelu(x + bias)`.

2. Implement a tiled matrix multiply kernel. Compare its performance against
   `torch.matmul` for various matrix sizes. At what size does cuBLAS win?

3. Write a custom kernel for RMSNorm (used in LLaMA). Fuse the norm
   computation and scaling into one kernel.

4. Build a PyTorch extension with a custom kernel. Write a `Function` class
   that provides both forward and backward. Verify gradients with
   `torch.autograd.gradcheck`.
