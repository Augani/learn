# 05 - PyTorch Performance

## The Analogy

PyTorch is like a helpful assistant who translates your high-level requests
into GPU instructions. But this assistant has habits -- some efficient, some
not. If you tell her "copy this document, highlight the copies, then throw
away the originals," she'll do it. She won't question whether you could've
just highlighted the originals in place.

Understanding PyTorch's habits -- when it copies data, when it synchronizes,
when it falls back to slow paths -- is the difference between code that's
fast and code that *looks like it should be fast* but isn't.

```
  PYTORCH EXECUTION MODEL

  Your Python code:
  y = x.matmul(w) + b

  What actually happens:

  Python        PyTorch       CUDA Driver       GPU
  ------        -------       -----------       ---
  matmul() -->  dispatch  --> cuLaunchKernel -> [gemm kernel]
    |           overhead       ~5us              ~100us
    v           ~10us
  add()   -->  dispatch  --> cuLaunchKernel -> [add kernel]
    |           ~10us          ~5us              ~2us
    v
  (return)

  Total CPU overhead: ~30us
  Total GPU work: ~102us

  For large tensors: GPU work dominates, overhead is negligible.
  For small tensors: overhead > actual work. Death by a thousand cuts.
```

## Pitfall 1: CPU-GPU Synchronization

The most common hidden performance killer. GPU operations are asynchronous --
when you call `x.matmul(w)`, the CPU queues the operation and returns
immediately. The GPU does the work later. This lets CPU and GPU work in
parallel.

But certain operations force the CPU to wait for the GPU to finish:

```python
x = torch.randn(1000, 1000, device='cuda')
y = x.matmul(x)

print(y.shape)

val = y[0, 0].item()

if y.sum() > 0:
    pass

cpu_tensor = y.cpu()

print(y)
```

Each of these forces **synchronization**: the CPU stops and waits for all
queued GPU operations to complete before continuing.

```
  SYNCHRONIZATION TIMELINE

  WITHOUT accidental sync:
  CPU: [queue op1] [queue op2] [queue op3] [queue op4] [queue op5]
  GPU: [---op1---] [---op2---] [---op3---] [---op4---] [---op5---]
  Total time: max(CPU, GPU) -- they overlap

  WITH accidental sync (e.g., .item() after op2):
  CPU: [queue op1] [queue op2] [....wait for GPU....] [queue op3] [queue op4]
  GPU: [---op1---] [---op2---]                        [---op3---] [---op4---]
                               ^
                               sync point: CPU blocked
  Total time: CPU + GPU -- no overlap, much slower
```

### How to Avoid Unnecessary Syncs

```python
if step % 100 == 0:
    loss_val = loss.item()
    print(f"Step {step}: loss={loss_val:.4f}")

running_loss += loss.detach()
if step % 100 == 0:
    avg = (running_loss / 100).item()
    print(f"Step {step}: loss={avg:.4f}")
    running_loss = 0
```

Keep values on GPU as long as possible. Only move to CPU for logging, and
do that infrequently.

## Pitfall 2: Operations on Wrong Device

Moving data between CPU and GPU is expensive. A single tensor transfer over
PCIe might take microseconds for small tensors or milliseconds for large ones.
But the synchronization overhead is what kills you.

```python
x = torch.randn(1000, 1000, device='cuda')

mask = torch.ones(1000, dtype=torch.bool)
result = x[mask.cuda()]

mask = torch.ones(1000, dtype=torch.bool, device='cuda')
result = x[mask]
```

Common offenders:
- Creating index tensors on CPU and transferring per-batch
- Scalar operations done on CPU that could be done on GPU
- Converting to NumPy mid-pipeline (forces sync + CPU transfer)

```python
np_array = tensor.cpu().numpy()

torch_result = tensor.sum()
```

## Pitfall 3: Non-Contiguous Tensors

A contiguous tensor has elements laid out sequentially in memory. Certain
operations create non-contiguous **views** -- they look like tensors but point
to scattered memory locations.

```
  CONTIGUOUS TENSOR (row-major):
  Logical:  [[1, 2, 3],      Memory: [1, 2, 3, 4, 5, 6, 7, 8, 9]
             [4, 5, 6],               ^---------^---------^-------
             [7, 8, 9]]              sequential, fast access

  TRANSPOSED TENSOR (non-contiguous view):
  Logical:  [[1, 4, 7],      Memory: [1, 2, 3, 4, 5, 6, 7, 8, 9]
             [2, 5, 8],               ^     ^     ^  (stride=3)
             [3, 6, 9]]              scattered, slow access
```

Operations that produce non-contiguous tensors:
- `.t()` and `.transpose()`
- `.permute()`
- Narrow slicing: `x[:, ::2]`
- `.expand()`

```python
x = torch.randn(1000, 1000, device='cuda')

xt = x.t()
assert not xt.is_contiguous()
print(xt.stride())

xt_contig = xt.contiguous()
assert xt_contig.is_contiguous()
```

Non-contiguous tensors can be slower because:
1. Memory accesses aren't coalesced on the GPU (see lesson 02)
2. Some CUDA kernels have fast paths only for contiguous inputs
3. Certain operations (like `.view()`) require contiguity and will fail

```python
x = torch.randn(3, 4, device='cuda')
xt = x.t()

xt.view(12)

xt.reshape(12)
xt.contiguous().view(12)
```

`.reshape()` handles non-contiguous tensors (it copies if needed), but
`.view()` fails. Use `.reshape()` when you're not sure about contiguity,
but know that it might silently copy your data.

## Pitfall 4: View vs Copy

Understanding when PyTorch copies data vs creates a view is crucial for
both performance and correctness.

```python
x = torch.randn(10, device='cuda')

y = x[2:5]
y[0] = 999
assert x[2] == 999

z = x[torch.tensor([2, 3, 4])]
z[0] = 999
assert x[2] != 999
```

**Views** (no copy, shared memory):
- Basic slicing: `x[2:5]`, `x[:, 1]`
- `.view()`, `.reshape()` (when contiguous)
- `.t()`, `.transpose()`, `.permute()`
- `.expand()`, `.narrow()`
- `.detach()`

**Copies** (new memory allocation):
- Advanced indexing: `x[tensor_indices]`
- `.clone()`
- `.contiguous()` (when already non-contiguous)
- `.to()` (when changing device or dtype)
- Boolean masking: `x[mask]`

Views are fast (O(1)) but create aliasing. Copies are slow (O(n)) but give
you independent data.

## Pitfall 5: Gradient Tracking Overhead

Autograd adds bookkeeping to every operation on tensors that require gradients.
During inference or evaluation, this overhead is pure waste.

```python
model.eval()
with torch.no_grad():
    outputs = model(inputs)

model.eval()
with torch.inference_mode():
    outputs = model(inputs)
```

`torch.inference_mode()` is stricter and faster than `torch.no_grad()`:

```
  torch.no_grad():
  - Disables gradient computation
  - Tensors still have requires_grad=False set
  - You CAN accidentally enable gradients inside
  - Moderate overhead reduction

  torch.inference_mode():
  - Disables gradient computation AND version tracking
  - Tensors are marked as inference-only
  - Trying to use them in autograd raises an error
  - Maximum overhead reduction (~5-10% faster inference)
```

Always use `inference_mode()` for inference unless you have a specific reason
to use `no_grad()`.

## Pitfall 6: Python-Level Loops

Python loops over tensor elements are catastrophically slow compared to
vectorized operations.

```python
x = torch.randn(10000, device='cuda')

total = 0
for i in range(len(x)):
    total += x[i].item()

total = x.sum()
```

The loop version does 10,000 CPU-GPU synchronizations (`.item()` on each
element). The vectorized version does one GPU kernel launch.

Less obvious example:

```python
results = []
for i in range(batch_size):
    results.append(process_single(x[i]))
output = torch.stack(results)

output = process_batch(x)
```

If `process_single` involves GPU operations, you're launching `batch_size`
separate kernels instead of one. Vectorize your operations to work on entire
batches.

## Pitfall 7: Unnecessary Tensor Creation

Every `torch.tensor()` call allocates memory. In hot loops, this adds up:

```python
for step in range(1000000):
    threshold = torch.tensor(0.5, device='cuda')
    mask = x > threshold

threshold = torch.tensor(0.5, device='cuda')
for step in range(1000000):
    mask = x > threshold
```

Even better, use Python scalars when PyTorch supports them:

```python
mask = x > 0.5
```

PyTorch automatically broadcasts Python scalars without creating a tensor.

## Performance Patterns

### Pattern: Efficient Tensor Concatenation

```python
parts = []
for batch in dataloader:
    result = model(batch)
    parts.append(result)
all_results = torch.cat(parts, dim=0)

all_results = torch.empty(total_size, dim, device='cuda')
offset = 0
for batch in dataloader:
    result = model(batch)
    batch_len = result.shape[0]
    all_results[offset:offset + batch_len] = result
    offset += batch_len
```

The second version avoids creating many small tensors and one big concat.
For very large numbers of parts, this matters.

### Pattern: Fused Operations

```python
x = x * 0.1 + y * 0.9

x = torch.lerp(y, x, 0.1)

x = x / x.norm(dim=-1, keepdim=True)

x = torch.nn.functional.normalize(x, dim=-1)
```

Fused operations launch fewer kernels and read memory fewer times. PyTorch
provides many: `addmm`, `baddbmm`, `lerp`, `addcmul`, `normalize`, etc.

### Pattern: Avoiding Repeated Computation

```python
for i in range(num_steps):
    normed = layer_norm(x)
    out1 = head1(normed)
    out2 = head2(normed)
    out3 = head3(normed)
```

Looks fine, but if `layer_norm` is called once and all heads use the same
result, make sure the autograd graph isn't computing the norm three times
during backward.

### Pattern: Efficient Attention Masks

```python
mask = torch.triu(torch.ones(seq_len, seq_len, device='cuda'), diagonal=1).bool()
for batch in dataloader:
    output = attention(q, k, v, attn_mask=mask)

output = torch.nn.functional.scaled_dot_product_attention(
    q, k, v, is_causal=True
)
```

`is_causal=True` uses an optimized path that doesn't need an explicit mask
tensor at all.

## Benchmarking PyTorch Operations

Always warm up before benchmarking. The first call to any CUDA operation
triggers compilation and caching:

```python
import torch
from torch.utils.benchmark import Timer

def benchmark_op(fn, desc, num_runs=100):
    for _ in range(10):
        fn()
    torch.cuda.synchronize()

    timer = Timer(stmt="fn()", globals={"fn": fn})
    result = timer.timeit(num_runs)
    print(f"{desc}: {result.mean*1000:.3f}ms +/- {result.times_std*1000:.3f}ms")

x = torch.randn(4096, 4096, device='cuda')

benchmark_op(lambda: x @ x, "matmul 4096x4096")
benchmark_op(lambda: x + x, "add 4096x4096")
benchmark_op(lambda: x.sum(), "sum 4096x4096")
```

`torch.utils.benchmark.Timer` handles warmup, synchronization, and
statistical analysis properly. Never use `time.time()` for GPU benchmarks
without manual synchronization.

## Exercises

1. Add `torch.cuda.synchronize()` before and after every major operation in
   your training loop. How much time does synchronization overhead add?
   Now remove unnecessary syncs (like `.item()` calls) and re-measure.

2. Find all non-contiguous tensors in your model's forward pass. Make them
   contiguous and benchmark. Does it matter?

3. Replace `torch.no_grad()` with `torch.inference_mode()` in your
   inference code. Benchmark the difference.

4. Profile your code for CPU-GPU transfers. Use `torch.profiler` and look
   for `aten::to` and `aten::copy_` operations. Are any unnecessary?
