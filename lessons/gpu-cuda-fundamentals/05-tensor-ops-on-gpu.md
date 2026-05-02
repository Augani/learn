# Lesson 05: Tensor Operations on GPU — Why Transformers Love GPUs

Every operation in a neural network — matrix multiplies, attention
scores, softmax, layer norm — maps to GPU primitives. This lesson
connects the CUDA programming model you just learned to the actual
operations that run when you train or run a transformer. You will
understand why GPUs and transformers are a perfect match.

---

## The Core Idea

A transformer is, at its core, a sequence of **batched matrix
multiplications** with some element-wise operations in between. Matrix
multiplication is the most GPU-friendly operation that exists — it has
high arithmetic intensity and maps perfectly to the thread-block model.

**Analogy: A restaurant kitchen.** Matrix multiplication is like a
well-organized kitchen where every cook (thread) has a clear station
and a clear task. Element-wise operations (ReLU, add) are like
everyone just adding salt to their own plate — simple but limited by
how fast you can pass plates around (memory bandwidth).

```
Transformer Forward Pass — Operation Types:

┌─────────────────────────────────────────────────┐
│                                                 │
│  Input Embeddings                               │
│       │                                         │
│       ▼                                         │
│  ┌─────────────────────┐                        │
│  │ Q = X @ W_Q         │  ← Matrix multiply     │
│  │ K = X @ W_K         │  ← Matrix multiply     │
│  │ V = X @ W_V         │  ← Matrix multiply     │
│  └─────────┬───────────┘                        │
│            ▼                                    │
│  ┌─────────────────────┐                        │
│  │ scores = Q @ K^T    │  ← Matrix multiply     │
│  │ scores = scores / √d│  ← Element-wise (cheap)│
│  │ weights = softmax() │  ← Reduction (moderate) │
│  │ attn = weights @ V  │  ← Matrix multiply     │
│  └─────────┬───────────┘                        │
│            ▼                                    │
│  ┌─────────────────────┐                        │
│  │ LayerNorm           │  ← Reduction + elem-wise│
│  │ FFN: X @ W1 + b1    │  ← Matrix multiply     │
│  │ GELU activation     │  ← Element-wise        │
│  │ FFN: X @ W2 + b2    │  ← Matrix multiply     │
│  │ LayerNorm           │  ← Reduction + elem-wise│
│  └─────────────────────┘                        │
│                                                 │
│  ~80% of compute time is matrix multiplication  │
│  ~20% is memory-bound ops (softmax, layernorm)  │
└─────────────────────────────────────────────────┘
```

---

## How Matrix Multiplication Maps to GPU Parallelism

Matrix multiplication is embarrassingly parallel. Each element of the
output matrix can be computed independently.

```
C = A @ B    where A is (M×K) and B is (K×N)

Output C is (M×N) — that's M×N independent dot products.

  A (M×K)          B (K×N)          C (M×N)
  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ row 0    │     │ col0 col1│     │ C[0,0]   │
  │ row 1    │  @  │          │  =  │ C[0,1]   │
  │ row 2    │     │          │     │ ...      │
  │ ...      │     │          │     │ C[M-1,N-1]│
  └──────────┘     └──────────┘     └──────────┘

  C[i,j] = dot(A[i,:], B[:,j])

  Each C[i,j] is independent → assign one thread (or thread group)
  to each output element.

  For a 4096×4096 matmul:
  - Output has 16,777,216 elements
  - Each needs 4096 multiply-adds
  - Total: ~137 billion operations
  - GPU with 16,000 cores: done in milliseconds
```

---

## Attention Is Batched Matrix Multiply

The self-attention mechanism is just a sequence of matrix multiplies
with a softmax in between. This is why transformers scale so well on
GPUs.

```
Multi-Head Self-Attention (batch_size=B, seq_len=S, d_model=D, heads=H):

Step 1: Project Q, K, V (three matrix multiplies)
  Q = X @ W_Q    →  (B, S, D) @ (D, D) = (B, S, D)
  K = X @ W_K    →  (B, S, D) @ (D, D) = (B, S, D)
  V = X @ W_V    →  (B, S, D) @ (D, D) = (B, S, D)

Step 2: Reshape for multi-head
  Q → (B, H, S, D/H)
  K → (B, H, S, D/H)
  V → (B, H, S, D/H)

Step 3: Attention scores (batched matrix multiply)
  scores = Q @ K^T  →  (B, H, S, D/H) @ (B, H, D/H, S) = (B, H, S, S)

Step 4: Softmax (element-wise + reduction, memory-bound)
  weights = softmax(scores / √(D/H))

Step 5: Weighted values (batched matrix multiply)
  output = weights @ V  →  (B, H, S, S) @ (B, H, S, D/H) = (B, H, S, D/H)

Step 6: Project output (matrix multiply)
  output = output @ W_O  →  (B, S, D) @ (D, D) = (B, S, D)

Total: 4 large matrix multiplies + 1 softmax per layer
```

```python
import torch

# Simulating attention on GPU
if torch.cuda.is_available():
    B, S, D, H = 8, 512, 768, 12  # batch, seq_len, d_model, heads
    d_k = D // H  # 64

    X = torch.randn(B, S, D, device='cuda')
    W_Q = torch.randn(D, D, device='cuda')
    W_K = torch.randn(D, D, device='cuda')
    W_V = torch.randn(D, D, device='cuda')

    # Step 1: Project (3 matrix multiplies)
    Q = X @ W_Q  # (8, 512, 768)
    K = X @ W_K
    V = X @ W_V

    # Step 2: Reshape for multi-head
    Q = Q.view(B, S, H, d_k).transpose(1, 2)  # (8, 12, 512, 64)
    K = K.view(B, S, H, d_k).transpose(1, 2)
    V = V.view(B, S, H, d_k).transpose(1, 2)

    # Step 3: Attention scores (batched matmul)
    scores = Q @ K.transpose(-2, -1) / (d_k ** 0.5)  # (8, 12, 512, 512)

    # Step 4: Softmax
    weights = torch.softmax(scores, dim=-1)

    # Step 5: Weighted values (batched matmul)
    output = weights @ V  # (8, 12, 512, 64)

    print(f"Q shape: {Q.shape}")
    print(f"Scores shape: {scores.shape}")
    print(f"Output shape: {output.shape}")
```

---

## PyTorch `.to('cuda')` Under the Hood

When you write `tensor.to('cuda')`, PyTorch:

1. Allocates GPU global memory via `cudaMalloc`
2. Copies data from CPU RAM to GPU HBM via `cudaMemcpy`
3. Returns a new tensor object pointing to GPU memory

```
model.to('cuda') — what actually happens:

  CPU Memory                          GPU Memory (HBM)
  ┌──────────────────┐                ┌──────────────────┐
  │ model.weight     │   cudaMemcpy   │ model.weight     │
  │ [4096 × 4096]    │ ─────────────► │ [4096 × 4096]    │
  │ 67 MB (FP32)     │   PCIe bus     │ 67 MB (FP32)     │
  │                  │   ~32 GB/s     │                  │
  │ model.bias       │ ─────────────► │ model.bias       │
  │ [4096]           │                │ [4096]           │
  └──────────────────┘                └──────────────────┘

  After .to('cuda'):
  - All parameters live in GPU memory
  - All operations dispatch to CUDA kernels
  - Results stay on GPU (no automatic copy back)
```

```python
import torch

# The journey of a tensor
x = torch.randn(1000, 1000)          # Lives in CPU RAM
print(f"Before: {x.device}")          # cpu

x_gpu = x.to('cuda')                  # Copied to GPU HBM
print(f"After:  {x_gpu.device}")       # cuda:0

# Operations on GPU tensors run CUDA kernels
y_gpu = x_gpu @ x_gpu.T               # Runs cuBLAS GEMM kernel
print(f"Result: {y_gpu.device}")       # cuda:0 (stays on GPU)

# Only copy back when you need the values on CPU
y_cpu = y_gpu.cpu()                    # Copied back to CPU RAM
print(f"Back:   {y_cpu.device}")       # cpu
```

---

## Why Transformers Are GPU-Friendly

Not all neural network architectures are equally GPU-friendly.
Transformers are particularly well-suited because:

```
GPU-Friendliness Comparison:

Architecture     Parallelism    Memory Pattern    GPU Fit
────────────     ───────────    ──────────────    ───────
Transformer      Excellent      Regular matmuls   ★★★★★
  - All tokens processed in parallel
  - Attention = batched matmul
  - FFN = large matmul

CNN              Good           Regular convs     ★★★★
  - Spatial parallelism
  - Convolution = matrix multiply (im2col)
  - Regular memory access

RNN/LSTM         Poor           Sequential        ★★
  - Each timestep depends on previous
  - Cannot parallelize across time
  - Small matrix multiplies

Graph Neural Net Moderate       Irregular         ★★★
  - Sparse, irregular access patterns
  - Harder to coalesce memory
```

The key insight: transformers replaced RNNs not just because attention
works better, but because **attention is parallelizable** and RNNs are
not. This made transformers dramatically faster to train on GPUs.

---

## Tensor Cores: Hardware for Matrix Multiply

Modern NVIDIA GPUs have **tensor cores** — specialized hardware units
that compute small matrix multiplies (4×4 or 8×8) in a single
operation. This is why FP16 matrix multiply is so much faster than
FP32 on modern GPUs.

```
Tensor Core Operation:

  D = A × B + C

  Where A, B, C, D are small matrices (e.g., 4×4)

  Regular CUDA cores:
    4×4 matmul = 64 multiply-adds = 64 clock cycles

  Tensor cores:
    4×4 matmul = 1 operation = 1 clock cycle

  Speedup: ~64× for this operation

  ┌─────────────────────────────────────────┐
  │  GPU          CUDA Cores    Tensor Cores │
  │  V100         5,120         640          │
  │  A100         6,912         432          │
  │  H100         16,896        528          │
  │                                          │
  │  FP32 (CUDA cores only):                 │
  │    H100: ~67 TFLOPS                      │
  │                                          │
  │  FP16 (with tensor cores):               │
  │    H100: ~1,979 TFLOPS                   │
  │                                          │
  │  That's ~30× more throughput for FP16!   │
  └─────────────────────────────────────────┘
```

This is why mixed-precision training (FP16 for most operations, FP32
for accumulation) is standard practice — it is not just about saving
memory, it is about using tensor cores.

---

## Exercises

### Exercise 1: Count the FLOPS

```python
# For a single transformer layer with these dimensions:
B = 8       # batch size
S = 2048    # sequence length
D = 4096    # model dimension (d_model)
H = 32      # number of attention heads
d_k = D // H  # 128, dimension per head

# TODO: Calculate FLOPS for each operation:
# 1. Q projection: (B, S, D) @ (D, D) = ?
# 2. Attention scores: (B, H, S, d_k) @ (B, H, d_k, S) = ?
# 3. FFN layer 1: (B, S, D) @ (D, 4*D) = ?
# 4. Total FLOPS for one transformer layer?
#
# Hint: matmul of (M, K) @ (K, N) = 2*M*K*N FLOPS
```

### Exercise 2: GPU vs CPU Timing

```python
import torch
import time

sizes = [256, 512, 1024, 2048, 4096]

for size in sizes:
    # CPU timing
    a_cpu = torch.randn(size, size)
    b_cpu = torch.randn(size, size)
    start = time.time()
    c_cpu = a_cpu @ b_cpu
    cpu_time = time.time() - start

    # TODO: If you have a GPU, time the same operation on CUDA
    # Remember to call torch.cuda.synchronize() before timing!
    # TODO: Calculate and print the speedup for each size
    # TODO: At what size does the GPU start winning? Why?

    print(f"Size {size}: CPU = {cpu_time*1000:.2f} ms")
```

### Exercise 3: Memory vs Compute Bound

```python
import torch

if torch.cuda.is_available():
    N = 4096

    # Operation 1: Matrix multiply (compute-bound)
    A = torch.randn(N, N, device='cuda')
    B = torch.randn(N, N, device='cuda')

    # Operation 2: Element-wise add (memory-bound)
    # Operation 3: Softmax (memory-bound)

    # TODO: Time each operation 100 times
    # TODO: Calculate arithmetic intensity for each:
    #   intensity = FLOPS / bytes_accessed
    # TODO: Which operations are compute-bound vs memory-bound?
    # TODO: How does this explain where GPU optimization effort
    #       should focus in a transformer?
```

---

Next: [Lesson 06: ML Hardware Landscape](./06-ml-hardware-landscape.md)
