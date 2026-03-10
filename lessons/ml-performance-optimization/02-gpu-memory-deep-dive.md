# 02 - GPU Memory Deep Dive

## The Analogy

Think of a GPU like a factory with a very particular layout.

The **registers** are the tools in each worker's hands -- instant access, but
each worker can only hold a few. **Shared memory** is the workbench in the
middle of each team's station -- everyone on the team can grab from it quickly,
but it's small. **Global memory** (VRAM) is the warehouse out back -- huge,
stores everything, but walking there and back takes 100x longer than reaching
for a tool in your hands.

The entire game of GPU performance is keeping data as close to the workers
(CUDA threads) as possible and minimizing trips to the warehouse.

```
  GPU MEMORY HIERARCHY

  Speed:  FAST <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< SLOW
  Size:   TINY >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> HUGE

  +-----------+     +---------------+     +------------------+
  | Registers |     | Shared Memory |     | Global Memory    |
  | (per      |     | (per block,   |     | (VRAM, all SMs,  |
  |  thread)  |     |  one SM)      |     |  off-chip)       |
  +-----------+     +---------------+     +------------------+
    ~1 cycle          ~5 cycles             ~200-400 cycles
    64KB/SM           48-228KB/SM           16-80 GB
    per thread:       per block:            per GPU:
    255 registers     configurable          your model lives
                                            here

  Also:
  +----------+     +-----------+
  | L1 Cache |     | L2 Cache  |
  | (per SM,  |     | (shared,  |
  |  merged   |     |  all SMs) |
  |  w/shared)|     |           |
  +----------+     +-----------+
    ~5 cycles        ~30 cycles
    128-256KB/SM     4-50 MB
```

## Global Memory: Where Your Tensors Live

When you do `x = torch.randn(1024, 1024).cuda()`, that tensor lands in global
memory (HBM -- High Bandwidth Memory). This is the 16-80GB you see in
`nvidia-smi`.

Global memory has enormous bandwidth -- an A100 has 2 TB/s -- but it still
takes 200-400 clock cycles to service a single request. The key insight: you
need to access global memory in patterns that let the hardware *coalesce*
many small requests into a few large ones.

### Memory Coalescing

When 32 threads in a warp each request consecutive 4-byte addresses, the
hardware combines those 32 requests into a single 128-byte transaction. This
is **coalescing** -- and it's the difference between getting full memory
bandwidth and getting 1/32nd of it.

```
  COALESCED ACCESS (good)

  Thread 0 reads addr 0x000    \
  Thread 1 reads addr 0x004     |
  Thread 2 reads addr 0x008     |-- Hardware combines into
  Thread 3 reads addr 0x00C     |   ONE 128-byte transaction
  ...                           |
  Thread 31 reads addr 0x07C   /

  Effective bandwidth: 2 TB/s on A100


  STRIDED ACCESS (bad)

  Thread 0 reads addr 0x000    --> separate transaction
  Thread 1 reads addr 0x400    --> separate transaction
  Thread 2 reads addr 0x800    --> separate transaction
  Thread 3 reads addr 0xC00    --> separate transaction
  ...

  Effective bandwidth: 2 TB/s / 32 = 62.5 GB/s  (wasting 97% of bandwidth)
```

**Why this matters for PyTorch**: Tensor memory layout determines access
patterns. A row-major tensor accessed column-wise produces strided accesses.
This is why `tensor.contiguous()` exists and why transposed tensors can be
slower than you expect.

```python
x = torch.randn(1000, 1000, device='cuda')
y = x.t()

assert x.is_contiguous()
assert not y.is_contiguous()

y_contig = y.contiguous()
assert y_contig.is_contiguous()
```

### Memory Bandwidth: The Roofline

Most ML operations are **memory-bound**, not compute-bound. A matmul with
large matrices might be compute-bound, but element-wise operations (ReLU,
LayerNorm, addition) are almost always memory-bound.

The arithmetic intensity of an operation is:

```
  Arithmetic Intensity = FLOPs / Bytes Transferred

  For element-wise add of two float32 tensors:
  - Read 2 values (8 bytes), write 1 value (4 bytes) = 12 bytes
  - Perform 1 FLOP
  - Intensity = 1/12 = 0.083 FLOPs/byte

  For matmul of (M,K) x (K,N):
  - ~2*M*K*N FLOPs
  - ~4*(M*K + K*N + M*N) bytes (float32)
  - For large square matrices: ~2*N^3 / (12*N^2) = N/6 FLOPs/byte
  - N=4096: intensity = 682 FLOPs/byte
```

The **roofline model** shows whether an operation is limited by compute or
memory bandwidth:

```
  ROOFLINE MODEL (A100)

  Peak Compute (FP32): 19.5 TFLOPS
  Peak Bandwidth: 2 TB/s
  Ridge Point: 19500/2000 = 9.75 FLOPs/byte

  Performance
  (TFLOPS)
    |
 19 |                    __________________ compute bound
    |                   /
    |                  /
    |                 /
    |                /
    |               /
    |              /
    |             /   <-- memory bound
    |            /
    |           /
    +----------+----------------------------> Arithmetic
    0     9.75                                Intensity
          ridge                              (FLOPs/byte)
          point

  Below the ridge point: you're limited by how fast you can
  feed data to the cores. Above: you're limited by compute.

  Most element-wise ops: intensity < 1 (deeply memory-bound)
  Large matmuls: intensity > 100 (compute-bound)
  Small matmuls, attention: somewhere in between
```

## Shared Memory: The Fast Scratchpad

Shared memory is on-chip SRAM that's shared among all threads in a block.
It's roughly 20-40x faster than global memory. CUDA programmers use it as a
manually managed cache.

In ML, shared memory is critical for:
- **Tiled matrix multiplication**: Load tiles of the input matrices into shared
  memory, compute on them, then load the next tiles
- **Reduction operations**: Summing across threads in a block
- **Attention kernels**: Flash Attention keeps running sums in shared memory
  to avoid reading/writing the full attention matrix from global memory

```
  TILED MATMUL WITH SHARED MEMORY

  Global Memory (slow):
  +----+----+----+----+     +----+----+----+----+
  | A00| A01| A02| A03|     | B00| B01| B02| B03|
  | A10| A11| A12| A13|  x  | B10| B11| B12| B13|
  | A20| A21| A22| A23|     | B20| B21| B22| B23|
  | A30| A31| A32| A33|     | B30| B31| B32| B33|
  +----+----+----+----+     +----+----+----+----+

  Step 1: Load tile into shared memory (fast):
  Shared Mem Block (0,0):
  +----+----+     +----+----+
  | A00| A01|     | B00| B01|
  | A10| A11|     | B10| B11|
  +----+----+     +----+----+

  Step 2: Compute partial results from shared memory (very fast)
  Step 3: Load next tile, accumulate
  Step 4: Repeat until done

  Result: Most computation reads from shared memory (~5 cycles)
  instead of global memory (~300 cycles)
```

### Bank Conflicts

Shared memory is divided into 32 banks. When two threads in the same warp
access different addresses that map to the same bank, they must serialize --
this is a **bank conflict**.

```
  SHARED MEMORY BANKS (32 banks)

  Bank:   0    1    2    3    4   ...   31
        +----+----+----+----+----+    +----+
  Addr: | 0  | 4  | 8  | 12 | 16 |...| 124|
        | 128| 132| 136| 140| 144|...| 252|
        | 256| 260| 264| 268| 272|...| 380|
        +----+----+----+----+----+    +----+

  NO CONFLICT (each thread hits different bank):
  Thread 0 -> Bank 0 (addr 0)
  Thread 1 -> Bank 1 (addr 4)
  Thread 2 -> Bank 2 (addr 8)
  ...all 32 threads served simultaneously

  2-WAY CONFLICT (two threads hit same bank):
  Thread 0 -> Bank 0 (addr 0)
  Thread 1 -> Bank 0 (addr 128)  <-- same bank as Thread 0!
  Thread 2 -> Bank 1 (addr 4)
  ...takes 2 serial accesses instead of 1
```

Bank conflicts are a subtle performance killer in custom CUDA kernels.
Nsight Compute reports them in its shared memory analysis section. The fix
is usually padding your shared memory arrays:

```cuda
// Bank conflict prone:
__shared__ float tile[32][32];

// Padded to avoid conflicts:
__shared__ float tile[32][33];  // extra column breaks the stride pattern
```

## Registers: The Fastest Memory

Each CUDA thread has access to a private register file. Registers are the
fastest memory on the GPU -- single cycle access. But they're limited: each
SM has 65536 registers shared among all active threads.

If your kernel uses too many registers, the GPU can run fewer threads
concurrently (lower **occupancy**). The compiler tries to minimize register
usage, but complex kernels can spill registers to local memory (which is
actually in slow global memory).

```
  OCCUPANCY vs REGISTER USAGE (simplified for a GPU with 65536 regs/SM)

  Registers/Thread    Max Threads/SM    Occupancy
  ------------------------------------------------
  32                  2048              100%
  64                  1024              50%
  128                 512               25%
  256                 256               12.5%

  More registers per thread = fewer concurrent threads
  Fewer concurrent threads = less ability to hide memory latency
```

You rarely manage registers directly in ML work, but understanding this
tradeoff explains why Nsight Compute reports occupancy metrics and why some
kernels perform better than expected (they hide latency with high occupancy).

## Where PyTorch Tensors Live

Understanding PyTorch's memory model is essential for diagnosing OOM errors
and optimizing memory usage.

```python
import torch

x_cpu = torch.randn(1000, 1000)
x_gpu = x_cpu.cuda()
x_gpu_direct = torch.randn(1000, 1000, device='cuda')

print(x_cpu.device)
print(x_gpu.device)
print(x_gpu.data_ptr())
```

### The CUDA Memory Allocator

PyTorch doesn't call `cudaMalloc` for every tensor. It uses a **caching
allocator** that requests large blocks from CUDA and subdivides them. This
avoids the overhead of frequent `cudaMalloc`/`cudaFree` calls.

```
  PYTORCH CACHING ALLOCATOR

  CUDA Driver sees:
  +-------------------------------------------------------+
  | One large allocation (e.g., 2 GB)                     |
  +-------------------------------------------------------+

  PyTorch allocator subdivides:
  +-------+-----+---+-----------+--------+----+-----------+
  | tensor| free| t | tensor C  | free   | t  | free      |
  | A     |     | B |           |        | D  |           |
  | 100MB |50MB |20M| 300MB     | 200MB  |80M | 1250MB    |
  +-------+-----+---+-----------+--------+----+-----------+

  When you del a tensor, the memory goes back to the cache
  (not to CUDA). This is why nvidia-smi shows more memory
  used than your tensors actually need.
```

### torch.cuda.memory_summary()

This is your primary tool for understanding GPU memory usage:

```python
print(torch.cuda.memory_summary(device='cuda:0', abbreviated=False))
```

Key metrics in the output:

```
  |                     |  Cur Usage  |  Peak Usage  |  Allocated  |  Freed  |
  |------------------------------------------------------------------------- |
  | Allocated memory    |   4096 MB   |   12288 MB   |   38.5 GB   | 34.4 GB |
  | Active memory       |   3584 MB   |   11776 MB   |   38.5 GB   | 34.9 GB |
  | Reserved memory     |   14336 MB  |   14336 MB   |   14336 MB  |    0 B  |

  Current Usage: what's allocated right now
  Peak Usage: maximum ever allocated (this is your high-water mark)
  Reserved: what PyTorch's caching allocator holds from CUDA
  (Reserved > Allocated because of the caching)
```

### Tracking Memory by Tensor

To find which tensors are eating your memory:

```python
torch.cuda.memory._record_memory_history(max_entries=100000)

outputs = model(inputs)
loss = criterion(outputs, targets)
loss.backward()

torch.cuda.memory._dump_snapshot("memory_snapshot.pickle")
torch.cuda.memory._record_memory_history(enabled=None)
```

View the snapshot at `https://pytorch.org/memory_viz` by uploading the pickle
file. It shows every allocation, its size, and its Python stack trace.

### Common Memory Consumers in Training

```
  WHERE GPU MEMORY GOES DURING TRAINING

  +----------------------------------+
  |     Model Parameters    (1x)     |  Weights of the model
  +----------------------------------+
  |     Gradients           (1x)     |  Same size as parameters
  +----------------------------------+
  |     Optimizer States   (2-3x)    |  Adam: momentum + variance
  +----------------------------------+
  |     Activations        (varies)  |  Saved for backward pass
  +----------------------------------+  (biggest variable)
  |     Temp Buffers       (varies)  |  Intermediate computations
  +----------------------------------+

  Example: 1B parameter model (fp32)
  Parameters:   4 GB
  Gradients:    4 GB
  Adam states:  8 GB (2x for momentum + variance)
  Activations:  8-40 GB (depends on batch size and sequence length)
  -----------------------------------------
  Total:        24-56 GB

  This is why a 1B parameter model can OOM on a 40GB A100.
```

## Practical Memory Investigation

Here's how to diagnose a memory issue step by step:

```python
def log_memory(tag):
    allocated = torch.cuda.memory_allocated() / 1024**3
    reserved = torch.cuda.memory_reserved() / 1024**3
    print(f"[{tag}] Allocated: {allocated:.2f} GB, Reserved: {reserved:.2f} GB")

log_memory("start")

model = build_model().cuda()
log_memory("after model load")

inputs = get_batch().cuda()
log_memory("after data load")

outputs = model(inputs)
log_memory("after forward")

loss = criterion(outputs, targets)
loss.backward()
log_memory("after backward")

optimizer.step()
log_memory("after optimizer step")

optimizer.zero_grad()
del outputs, loss
torch.cuda.empty_cache()
log_memory("after cleanup")
```

This tells you exactly where memory grows and whether cleanup reclaims it.

## Exercises

1. Run `torch.cuda.memory_summary()` at various points during training.
   Where is the peak memory usage? What phase causes the biggest jump?

2. Create two tensors: one contiguous and one transposed. Benchmark a
   reduction operation on both. How much does contiguity affect speed?

3. Use `torch.cuda.memory._record_memory_history()` to capture a memory
   snapshot during training. Upload it to the PyTorch memory visualizer.
   Which activations consume the most memory?

4. Calculate the theoretical memory requirement for your model: parameters
   + gradients + optimizer states + estimated activations. Compare with
   the actual peak usage from `memory_summary()`.
