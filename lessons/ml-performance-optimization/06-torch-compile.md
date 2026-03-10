# 06 - torch.compile Deep Dive

## The Analogy

Imagine you're a translator at the UN. A speaker gives a speech, and you
translate it sentence by sentence, in real time. Each sentence is independent --
you hear it, translate it, and speak it.

Now imagine you get the whole speech ahead of time. You can read through it,
restructure sentences for the target language, combine related ideas, and
eliminate redundancies. The result is a much better translation because you
have *context*.

Standard PyTorch operates like the live translator -- each operation is
dispatched independently. `torch.compile` reads the whole "speech" (your
model code) ahead of time and produces an optimized version that fuses
operations, eliminates overhead, and generates efficient GPU code.

```
  EAGER MODE (standard PyTorch):

  Python code:         y = relu(linear(x))
                       z = relu(linear(y))

  Execution:           [dispatch] [linear kernel] [dispatch] [relu kernel]
                       [dispatch] [linear kernel] [dispatch] [relu kernel]

  Each op: Python -> C++ dispatch -> CUDA kernel launch
  Overhead: ~10us per op * many ops = significant


  COMPILED MODE (torch.compile):

  Python code:         y = relu(linear(x))
                       z = relu(linear(y))

  Compilation:         Analyze graph -> Fuse ops -> Generate code

  Execution:           [fused_linear_relu_kernel] [fused_linear_relu_kernel]

  Fewer kernel launches, no Python overhead in the hot path.
  Typical speedup: 1.3x-2x for transformers.
```

## How torch.compile Works

`torch.compile` is a composition of three systems:

```
  torch.compile ARCHITECTURE

  Your Python Code
        |
        v
  +------------------+
  | TorchDynamo      |  Captures Python bytecode into a graph
  | (graph capture)   |  Handles Python control flow, closures, etc.
  +--------+---------+
           |
           v  FX Graph (Python-level ops)
  +--------+---------+
  | AOTAutograd       |  Traces both forward AND backward
  | (autograd trace)  |  Decomposes to primitive ops (aten ops)
  +--------+---------+
           |
           v  Aten IR (lowered ops, forward + backward)
  +--------+---------+
  | Inductor          |  Generates optimized GPU code
  | (code gen)        |  Triton kernels for GPU, C++ for CPU
  +--------+---------+
           |
           v
  Optimized compiled code (Triton/C++)
```

### TorchDynamo: The Graph Capturer

Dynamo is the key innovation. Previous attempts at PyTorch compilation
(TorchScript, `torch.jit.trace`) required you to rewrite code or accept
severe limitations. Dynamo works by intercepting Python bytecode execution
and building a graph *as your code runs*.

It handles things that broke previous compilers:
- Data-dependent control flow (partially)
- Python closures and free variables
- Dynamic shapes
- Third-party library calls (by falling back to eager mode)

```python
import torch

model = MyTransformer()
compiled_model = torch.compile(model)

output = compiled_model(input_tensor)
```

That's it. One line to compile. The first forward pass triggers compilation
(which can take 30-120 seconds), then subsequent calls use the compiled code.

### AOTAutograd: Forward + Backward

AOTAutograd traces through both the forward pass AND the backward pass at
compile time. This is important because it enables:
- Optimizing the backward pass (not just forward)
- Fusing operations across the forward-backward boundary
- Eliminating unnecessary saved tensors

```
  WITHOUT AOTAutograd:
  Forward:  optimized
  Backward: eager (Python dispatch for every op)

  WITH AOTAutograd:
  Forward:  optimized
  Backward: also optimized (compiled as one fused graph)
```

### Inductor: The Code Generator

Inductor takes the optimized graph and generates actual GPU code. For GPU
targets, it generates Triton kernels (a Python-like GPU programming language).
For CPU, it generates C++ with OpenMP.

```python
TORCH_COMPILE_DEBUG=1 python train.py
```

This dumps the generated code to `torch_compile_debug/`. You can read the
actual Triton kernels it generated.

## Compilation Modes

```python
compiled = torch.compile(model, mode="default")

compiled = torch.compile(model, mode="reduce-overhead")

compiled = torch.compile(model, mode="max-autotune")
```

```
  MODE COMPARISON

  Mode              Compile Time   Runtime Speed   Memory
  -------------------------------------------------------
  default           Medium         Good            Normal
  reduce-overhead   Medium         Better          Slightly more
  max-autotune      Very long      Best            Varies

  default: good balance, safe choice
  reduce-overhead: uses CUDA graphs to eliminate kernel launch overhead
  max-autotune: tries multiple kernel implementations, picks the fastest
                (can take 10-30 minutes to compile)
```

### reduce-overhead: CUDA Graphs Under the Hood

`reduce-overhead` mode wraps compiled code in CUDA graphs. A CUDA graph
captures a sequence of GPU operations once, then replays the entire sequence
with a single CPU-side call. This eliminates per-kernel launch overhead.

```
  NORMAL EXECUTION:
  CPU: [launch k1] [launch k2] [launch k3] [launch k4] [launch k5]
  GPU: [----k1----] [----k2----] [----k3----] [----k4----] [----k5----]
       ~5us gap      ~5us gap      ~5us gap      ~5us gap

  CUDA GRAPH:
  CPU: [launch graph once]
  GPU: [k1][k2][k3][k4][k5]   <-- no gaps between kernels
       entire graph replays with near-zero CPU overhead
```

The limitation: CUDA graphs require static shapes and control flow. If your
input sizes change, the graph must be recaptured.

### max-autotune: Brute Force Optimization

`max-autotune` mode benchmarks multiple implementations of each operation
and selects the fastest. For matrix multiplications, it tries different tiling
strategies, different Triton kernel configurations, and even cuBLAS vs custom
implementations.

```python
compiled = torch.compile(model, mode="max-autotune")

for _ in range(10):
    output = compiled(dummy_input)

for batch in dataloader:
    output = compiled(batch)
```

Use `max-autotune` when:
- You're deploying to production and compilation time doesn't matter
- The model runs thousands of times (amortizing the long compile)
- You've profiled and confirmed the model itself (not data loading) is the bottleneck

## Graph Breaks: The Compilation Killer

A graph break occurs when Dynamo encounters code it can't compile. It splits
the graph at that point, compiles the parts it can, and falls back to eager
Python for the rest.

```
  GRAPH BREAK EXAMPLE

  def forward(self, x):
      y = self.linear1(x)          # compiled region 1
      y = torch.relu(y)            # compiled region 1
      print(f"Shape: {y.shape}")   # <-- GRAPH BREAK (print with tensor)
      z = self.linear2(y)          # compiled region 2
      return z                     # compiled region 2

  Result: Two small compiled graphs instead of one large one.
  Each break adds Python dispatch overhead and prevents cross-break fusion.
```

### Common Causes of Graph Breaks

```python
print(tensor)
print(f"loss: {loss.item()}")

if tensor.sum() > 0:
    pass

np_array = tensor.numpy()

x.append(new_item)

import pdb; pdb.set_trace()
```

### Finding Graph Breaks

```python
torch._dynamo.config.verbose = True

compiled = torch.compile(model)
output = compiled(input_tensor)
```

Or use the `explain` helper:

```python
explanation = torch._dynamo.explain(model)(input_tensor)
print(explanation)
```

This prints every graph break, its location, and the reason. Fix the most
impactful breaks first (those in the hot loop).

### Fixing Graph Breaks

**Replace `print()` with logging that doesn't touch tensors:**
```python
print(f"Step: {step}")
```

**Move data-dependent branching outside compiled code:**
```python
compiled_forward = torch.compile(model.forward)
compiled_backward_variant = torch.compile(model.backward_variant)

if condition_known_at_compile_time:
    output = compiled_forward(x)
```

**Replace Python containers with torch equivalents:**
```python
results = torch.empty(num_steps, dim, device='cuda')
for i in range(num_steps):
    results[i] = step_fn(x)
```

**Use `torch._dynamo.allow_in_graph` for custom functions:**
```python
@torch._dynamo.allow_in_graph
def custom_op(x):
    return x * 2 + 1
```

Only use this if the function is genuinely safe to include in the graph
(no side effects, no Python data structures).

## Benchmarking Compiled Models

Always benchmark properly -- compilation introduces warmup overhead:

```python
import torch
from torch.utils.benchmark import Timer

model = MyModel().cuda()
compiled_model = torch.compile(model, mode="reduce-overhead")

dummy = torch.randn(32, 512, device='cuda')

print("Warming up (this triggers compilation)...")
for _ in range(10):
    _ = compiled_model(dummy)
torch.cuda.synchronize()

eager_timer = Timer(
    stmt="model(x)",
    globals={"model": model, "x": dummy},
)
compiled_timer = Timer(
    stmt="model(x)",
    globals={"model": compiled_model, "x": dummy},
)

eager_result = eager_timer.timeit(100)
compiled_result = compiled_timer.timeit(100)

print(f"Eager:    {eager_result.mean*1000:.3f}ms")
print(f"Compiled: {compiled_result.mean*1000:.3f}ms")
print(f"Speedup:  {eager_result.mean/compiled_result.mean:.2f}x")
```

Typical speedups for common architectures:

```
  COMPILATION SPEEDUPS (approximate)

  Architecture         Speedup      Notes
  --------------------------------------------------
  ResNet-50            1.1-1.3x     Already uses efficient cuDNN ops
  BERT-base            1.3-1.6x     Many fusible ops
  GPT-2                1.4-1.8x     Attention fusion helps
  ViT-Large            1.3-1.5x     Good mix of matmul and element-wise
  Custom LSTM          1.5-2.5x     Huge Python overhead to eliminate
  Simple MLP           2-3x         Small ops dominate, fusion helps most
```

Models with many small operations benefit most from compilation. Models
dominated by large matmuls benefit less (cuBLAS is already near-optimal).

## Compilation for Training

```python
model = MyModel().cuda()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)

@torch.compile(mode="reduce-overhead")
def train_step(model, inputs, targets, criterion):
    outputs = model(inputs)
    loss = criterion(outputs, targets)
    loss.backward()
    return loss

for epoch in range(num_epochs):
    for inputs, targets in dataloader:
        inputs, targets = inputs.cuda(), targets.cuda()
        optimizer.zero_grad(set_to_none=True)
        loss = train_step(model, inputs, targets, criterion)
        optimizer.step()
```

Compiling the entire training step (forward + loss + backward) enables the
most fusion opportunities. AOTAutograd will optimize the backward pass too.

**Important**: Don't include `optimizer.step()` in the compiled function
unless you're using a simple optimizer. Complex optimizers (Adam with
weight decay) may cause graph breaks.

## Limitations and Gotchas

### Dynamic Shapes

By default, Dynamo recompiles whenever input shapes change. For variable-length
sequences, this means constant recompilation:

```python
compiled = torch.compile(model, dynamic=True)
```

`dynamic=True` generates code with symbolic shapes that handles varying
dimensions without recompilation. The tradeoff: slightly slower generated code
because the compiler can't hardcode dimensions.

### Recompilation

If Dynamo keeps recompiling (you see warnings about recompilation), it means
the "guards" -- assumptions about input shapes, dtypes, and values -- keep
changing. Common causes:
- Varying batch sizes at the end of epochs
- Dynamic sequence lengths without `dynamic=True`
- Changing model structure (e.g., dropout in train vs eval)

Monitor recompilation:
```python
torch._dynamo.config.cache_size_limit = 64
torch._dynamo.config.suppress_errors = False
```

### What torch.compile Can't Do

- **Custom CUDA extensions** may not be capturable
- **Distributed training** requires `torch.compile` per-rank
- **Model-parallel** operations may cause graph breaks
- **Very dynamic control flow** (data-dependent branching) forces graph breaks

## Exercises

1. Compile your model with default mode. What's the speedup? Now try
   `reduce-overhead` and `max-autotune`. How do they compare?

2. Run `torch._dynamo.explain(model)(input)`. How many graph breaks exist?
   Fix the top 3 breaks and re-measure the speedup.

3. Benchmark compiled inference with fixed shapes vs dynamic shapes
   (`dynamic=True`). What's the performance difference?

4. Compile an entire training step (forward + loss + backward). Compare
   training throughput with and without compilation.
