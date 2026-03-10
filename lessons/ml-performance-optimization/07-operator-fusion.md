# 07 - Operator Fusion

## The Analogy

You're building a house. You need to paint a wall, then apply a sealant coat.
If you hire two separate contractors, each one shows up independently: the
painter drives to the site, sets up scaffolding, paints, cleans up, and
leaves. Then the sealant person drives in, sets up the same scaffolding,
applies sealant, cleans up, and leaves.

**Fused operation**: One person does both. They set up scaffolding once,
paint, immediately apply sealant while the wall is accessible, and clean up
once. Half the setup, half the cleanup, and no waiting between steps.

On a GPU, "setup" means loading data from slow global memory into fast
registers. If two operations touch the same data, fusing them means loading
the data once instead of twice. For memory-bound operations, this is a 2x
speedup.

```
  UNFUSED: relu(layer_norm(x))

  Step 1: Layer Norm kernel
  Global Memory --> [Load x] --> [compute norm] --> [Store result] --> Global Memory
                    300 cycles                       300 cycles

  Step 2: ReLU kernel
  Global Memory --> [Load norm_x] --> [relu] --> [Store result] --> Global Memory
                    300 cycles                     300 cycles

  Total memory transactions: 4 (2 loads + 2 stores)
  Total memory cycles: 1200


  FUSED: fused_relu_layernorm(x)

  Single kernel:
  Global Memory --> [Load x] --> [compute norm] --> [relu] --> [Store result] --> Global Memory
                    300 cycles    (in registers)               300 cycles

  Total memory transactions: 2 (1 load + 1 store)
  Total memory cycles: 600

  2x faster for zero extra compute.
```

## Why Separate Kernels Are Slow

Every CUDA kernel launch has overhead:

```
  KERNEL LAUNCH COSTS

  1. CPU-side dispatch:         ~5-10 microseconds
  2. Kernel launch on GPU:      ~3-5 microseconds
  3. Memory load:               ~200-400 cycles (per element, from global mem)
  4. Computation:               varies
  5. Memory store:              ~200-400 cycles (per element, to global mem)

  For element-wise ops (relu, add, multiply):
  - Compute: ~1 cycle
  - Memory: ~400 cycles load + ~400 cycles store
  - Memory is 800x more expensive than compute

  Two separate element-wise ops:
  Load -> Compute1 -> Store -> Load -> Compute2 -> Store
  800        1         400     400        1         400   = 2002 cycles

  One fused op:
  Load -> Compute1 -> Compute2 -> Store
  400        1           1        400   = 802 cycles

  2.5x faster.
```

For large models with dozens of element-wise operations (activation functions,
normalizations, residual connections), fusion is the single most impactful
optimization after mixed precision.

## torch.compile: Automatic Fusion

The easiest way to get fusion is through `torch.compile` (see lesson 06).
The Inductor backend automatically identifies fusible operations and generates
fused Triton kernels.

```python
import torch

def unfused_block(x, weight, bias, residual):
    y = torch.nn.functional.linear(x, weight, bias)
    y = torch.nn.functional.layer_norm(y, [y.shape[-1]])
    y = torch.nn.functional.gelu(y)
    y = y + residual
    return y

fused_block = torch.compile(unfused_block)

x = torch.randn(32, 512, device='cuda')
w = torch.randn(512, 512, device='cuda')
b = torch.randn(512, device='cuda')
r = torch.randn(32, 512, device='cuda')

for _ in range(10):
    _ = fused_block(x, w, b, r)
```

Under the hood, Inductor fuses the layer_norm + gelu + add into a single
Triton kernel. The linear (matmul) stays separate because it uses cuBLAS
which is already highly optimized.

To see what got fused:
```python
TORCH_COMPILE_DEBUG=1 python your_script.py
```

Look at the generated Triton code in `torch_compile_debug/`. You'll see
fused kernels that combine multiple operations.

## Triton: Custom Fused Kernels

When `torch.compile` doesn't fuse what you need, or you want more control,
Triton lets you write GPU kernels in Python. It's dramatically easier than
CUDA for element-wise and reduction operations.

### Triton Basics

```python
import triton
import triton.language as tl

@triton.jit
def fused_add_relu_kernel(
    x_ptr,
    y_ptr,
    output_ptr,
    n_elements,
    BLOCK_SIZE: tl.constexpr,
):
    pid = tl.program_id(axis=0)
    block_start = pid * BLOCK_SIZE
    offsets = block_start + tl.arange(0, BLOCK_SIZE)
    mask = offsets < n_elements

    x = tl.load(x_ptr + offsets, mask=mask)
    y = tl.load(y_ptr + offsets, mask=mask)

    result = x + y
    result = tl.where(result > 0, result, 0.0)

    tl.store(output_ptr + offsets, result, mask=mask)


def fused_add_relu(x, y):
    output = torch.empty_like(x)
    n_elements = output.numel()
    grid = lambda meta: (triton.cdiv(n_elements, meta['BLOCK_SIZE']),)
    fused_add_relu_kernel[grid](x, y, output, n_elements, BLOCK_SIZE=1024)
    return output

x = torch.randn(1000000, device='cuda')
y = torch.randn(1000000, device='cuda')
result = fused_add_relu(x, y)
```

### Fused Softmax: A Practical Example

Standard softmax reads global memory 5 times (max, subtract, exp, sum,
divide). A fused version reads once and writes once.

```python
@triton.jit
def fused_softmax_kernel(
    output_ptr,
    input_ptr,
    input_row_stride,
    output_row_stride,
    n_cols,
    BLOCK_SIZE: tl.constexpr,
):
    row_idx = tl.program_id(0)
    row_start_ptr = input_ptr + row_idx * input_row_stride
    col_offsets = tl.arange(0, BLOCK_SIZE)
    input_ptrs = row_start_ptr + col_offsets
    mask = col_offsets < n_cols

    row = tl.load(input_ptrs, mask=mask, other=-float('inf'))

    row_max = tl.max(row, axis=0)
    numerator = tl.exp(row - row_max)
    denominator = tl.sum(numerator, axis=0)
    softmax_output = numerator / denominator

    output_row_start_ptr = output_ptr + row_idx * output_row_stride
    output_ptrs = output_row_start_ptr + col_offsets
    tl.store(output_ptrs, softmax_output, mask=mask)


def fused_softmax(x):
    n_rows, n_cols = x.shape
    BLOCK_SIZE = triton.next_power_of_2(n_cols)
    output = torch.empty_like(x)
    fused_softmax_kernel[(n_rows,)](
        output, x,
        x.stride(0), output.stride(0),
        n_cols,
        BLOCK_SIZE=BLOCK_SIZE,
    )
    return output
```

This fused softmax does one global memory read and one write per row,
compared to five reads and three writes for separate PyTorch ops.

### Triton Autotuning

Triton can automatically try different kernel configurations:

```python
@triton.autotune(
    configs=[
        triton.Config({'BLOCK_SIZE': 128}, num_warps=4),
        triton.Config({'BLOCK_SIZE': 256}, num_warps=4),
        triton.Config({'BLOCK_SIZE': 512}, num_warps=8),
        triton.Config({'BLOCK_SIZE': 1024}, num_warps=8),
    ],
    key=['n_elements'],
)
@triton.jit
def autotuned_kernel(x_ptr, output_ptr, n_elements, BLOCK_SIZE: tl.constexpr):
    pid = tl.program_id(axis=0)
    offsets = pid * BLOCK_SIZE + tl.arange(0, BLOCK_SIZE)
    mask = offsets < n_elements
    x = tl.load(x_ptr + offsets, mask=mask)
    output = tl.math.sqrt(x)
    tl.store(output_ptr + offsets, output, mask=mask)
```

The `@triton.autotune` decorator benchmarks each configuration and caches
the fastest one.

## Flash Attention: The Flagship Fusion

Flash Attention (Tri Dao, 2022) is the most impactful operator fusion in ML.
It fuses the entire attention computation -- QK^T, scaling, masking, softmax,
dropout, and V multiplication -- into a single kernel that never materializes
the N x N attention matrix.

```
  STANDARD ATTENTION:

  Q, K: (batch, heads, seq_len, head_dim)

  Step 1: S = Q @ K^T         -> (batch, heads, seq_len, seq_len)  WRITE to HBM
  Step 2: S = S / sqrt(d)     -> read from HBM, WRITE to HBM
  Step 3: P = softmax(S)      -> read from HBM, WRITE to HBM
  Step 4: O = P @ V           -> read P from HBM, final output

  Memory: O(N^2) for the attention matrix
  HBM accesses: ~4 * N^2 * d reads/writes


  FLASH ATTENTION:

  Process in tiles. For each tile of Q:
    Load Q_tile into shared memory
    For each tile of K, V:
      Load K_tile, V_tile into shared memory
      Compute S_tile = Q_tile @ K_tile^T    (in shared memory)
      Update running softmax statistics    (in registers)
      Accumulate O_tile += softmax(S_tile) @ V_tile  (in registers)
    Write O_tile to HBM

  Memory: O(N) -- no full attention matrix
  HBM accesses: ~O(N^2 * d / M) where M = shared memory size
  This is 2-4x fewer HBM accesses than standard attention.
```

The key insight is the **online softmax** algorithm. Standard softmax requires
two passes: one to find the max (for numerical stability), one to compute
exp and normalize. Flash Attention maintains running statistics that allow
computing softmax in a single streaming pass:

```
  ONLINE SOFTMAX (simplified)

  Maintain per-row: max_so_far, sum_of_exps_so_far, accumulated_output

  For each new tile of scores:
    new_max = max(max_so_far, max(new_scores))
    correction = exp(max_so_far - new_max)
    sum_of_exps = sum_of_exps * correction + sum(exp(new_scores - new_max))
    accumulated_output = accumulated_output * correction + exp(new_scores - new_max) @ V_tile

  This gives EXACT softmax without storing the full matrix.
```

Using Flash Attention in PyTorch:

```python
from torch.nn.functional import scaled_dot_product_attention

output = scaled_dot_product_attention(
    query, key, value,
    is_causal=True,
    dropout_p=0.0,
)
```

PyTorch automatically uses the FlashAttention backend when the inputs are on
an Ampere+ GPU in half precision.

### Flash Attention Performance

```
  FLASH ATTENTION BENCHMARKS (approximate, A100)

  Sequence Length    Standard (ms)    Flash (ms)    Speedup    Memory Saved
  -----------------------------------------------------------------------
  512                2.1              1.8           1.2x       4x
  1024               8.5              4.2           2.0x       16x
  2048               34               9.8           3.5x       64x
  4096               135              25            5.4x       256x
  8192               OOM              62            inf        1024x

  Speedup grows with sequence length because the memory savings
  compound (N^2 term eliminated).
```

## TorchScript Fusion

Before `torch.compile`, TorchScript provided some fusion capabilities. It's
still relevant for deployment scenarios where you need a serialized model.

```python
@torch.jit.script
def fused_gelu(x):
    return x * 0.5 * (1.0 + torch.tanh(
        0.7978845608028654 * (x + 0.044715 * x * x * x)
    ))

scripted_model = torch.jit.script(model)
torch.jit.save(scripted_model, "model.pt")
loaded = torch.jit.load("model.pt")
```

TorchScript's NVFuser backend fuses element-wise operations, but it's less
powerful than `torch.compile` + Inductor. For new code, prefer `torch.compile`.

## When to Write Custom Fused Kernels

Use this decision framework:

```
  SHOULD I WRITE A CUSTOM KERNEL?

  Does torch.compile fuse it?
  |-- YES --> Use torch.compile. Done.
  |-- NO
      |
      Is it a known pattern with an existing library?
      |-- YES --> Use the library (Flash Attention, xFormers, etc.)
      |-- NO
          |
          Is the operation memory-bound with multiple passes?
          |-- YES --> Write a Triton kernel. Good ROI.
          |-- NO
              |
              Is it a complex parallel algorithm needing low-level control?
              |-- YES --> Write a CUDA kernel (lesson 08).
              |-- NO  --> Probably not worth custom code. Profile again.
```

## Exercises

1. Use `torch.compile` on a transformer block. Inspect the generated Triton
   code (use `TORCH_COMPILE_DEBUG=1`). Which operations got fused?

2. Write a Triton kernel that fuses LayerNorm + GELU + Dropout into one
   kernel. Benchmark against three separate PyTorch ops.

3. Compare `scaled_dot_product_attention` with and without Flash Attention
   (disable it with `torch.backends.cuda.enable_flash_sdp(False)`).
   Measure both speed and memory at various sequence lengths.

4. Profile an unfused transformer block with `torch.profiler`. Count the
   number of kernel launches. Then compile it and count again. How many
   kernels were eliminated by fusion?
