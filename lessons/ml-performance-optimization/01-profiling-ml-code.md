# 01 - Profiling ML Code

## The Analogy

You're a doctor. A patient says "I feel slow." You don't immediately prescribe
medication. You run tests -- blood work, imaging, stress tests. You find out
*what's actually wrong* before treating anything.

Performance optimization works the same way. The number one mistake is guessing
where the bottleneck is. Engineers spend days rewriting a matrix multiplication
kernel when the real problem was a Python `for` loop doing preprocessing on the
CPU while the GPU sat idle.

```
  THE OPTIMIZATION WORKFLOW

  +----------+     +----------+     +----------+     +----------+
  | Profile  |---->| Identify |---->| Optimize |---->| Measure  |
  | (measure)|     | bottlenck|     | (fix it) |     | (verify) |
  +----------+     +----------+     +----------+     +----+-----+
       ^                                                   |
       |                                                   |
       +---------------------------------------------------+
                    repeat until satisfied
```

## Where Time Goes in ML

A typical training step has several phases, and the bottleneck can be
anywhere:

```
  TRAINING STEP TIMELINE

  CPU:  [data load] [preprocess] [.........waiting.........] [loss calc] [log]
  GPU:  [...waiting...........] [forward] [backward] [optim] [..idle..]
  IO:   [disk read] [............................idle..........................]

  Time --->

  In this example:
  - GPU is starved: it waits for data from CPU
  - Data loading is the bottleneck, not the model
  - Optimizing the model would have zero effect
```

The four main bottleneck categories:

1. **CPU-bound**: Data preprocessing, tokenization, augmentation, Python overhead
2. **GPU compute-bound**: Large matrix multiplications, convolutions, attention
3. **Memory-bound**: GPU memory bandwidth saturation, OOM forcing small batches
4. **IO-bound**: Disk reads, network transfers, slow data formats

The profiling tools you use depend on which category you suspect.

## Python Profilers: The Starting Point

### cProfile: Built-in, Always Available

cProfile measures function call counts and cumulative time. It's blunt but
useful for finding CPU-side bottlenecks.

```python
import cProfile
import pstats

def train_epoch(model, dataloader, optimizer, criterion):
    model.train()
    for batch in dataloader:
        inputs, targets = batch
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()

profiler = cProfile.Profile()
profiler.enable()
train_epoch(model, dataloader, optimizer, criterion)
profiler.disable()

stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(20)
```

The output shows you which functions eat the most time. Look for surprises --
data loading functions ranking higher than model operations means your pipeline
is the bottleneck.

**Limitation**: cProfile adds overhead and doesn't understand GPU operations.
GPU calls are asynchronous, so cProfile sees `torch.cuda` calls returning
instantly even though the GPU work hasn't finished.

### py-spy: Sampling Profiler with Flame Graphs

py-spy is a sampling profiler that attaches to a running process without
modifying your code. It's particularly good at showing you *where time is
actually spent* in production-like scenarios.

```bash
pip install py-spy

py-spy record -o profile.svg -- python train.py

py-spy top -- python train.py
```

The `record` command produces a flame graph -- a visualization where the width
of each bar represents time spent in that function. Wider bars = more time.

```
  FLAME GRAPH (simplified)

  |  train_epoch                                                    |
  |  +-----------------------+-------------------------------------+
  |  | dataloader.__next__   | model.forward                       |
  |  | +---+------+--------+ | +----------+---------+----------+   |
  |  | |   | coll | decode  | | | linear   | attn    | norm     |   |
  |  | |pin| ate  |         | | |          |         |          |   |
  |  +-+---+------+---------+ +-+----------+---------+----------+   |

  Width = time proportion. This tells you data loading takes ~40% of time.
```

py-spy is your first tool for any optimization investigation. It answers:
"What is my Python process spending its time on?"

## PyTorch Profiler: GPU-Aware Profiling

The Python profilers above can't see GPU operations. PyTorch's built-in
profiler bridges this gap. It traces both CPU and GPU activity.

```python
import torch
from torch.profiler import profile, record_function, ProfilerActivity

with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    with record_function("training_step"):
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()

print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=20))
```

The output table shows each operation, its CPU time, CUDA time, and memory
usage. Critical columns:

- **Self CUDA time**: Time the GPU spent on this specific operation
- **CUDA total**: Including child operations
- **CPU total**: Time the CPU spent dispatching this operation
- **Input shapes**: The tensor dimensions involved

```
  SAMPLE OUTPUT (simplified)

  Name                    CPU total   CUDA total   # Calls
  -------------------------------------------------------
  aten::mm                  2.1ms      45.3ms        24
  aten::scaled_dot_product  1.8ms      38.7ms        12
  aten::layer_norm          0.9ms      12.1ms        12
  aten::add_                0.3ms       8.4ms        48
  Optimizer.step            1.2ms       6.2ms         1
  aten::copy_               0.8ms       4.1ms        36
  -------------------------------------------------------

  This tells you: matrix multiplies and attention dominate GPU time.
  Optimizing layer_norm would have minimal impact.
```

### Exporting to TensorBoard

For visual analysis, export the trace to TensorBoard:

```python
with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    schedule=torch.profiler.schedule(wait=1, warmup=1, active=3, repeat=1),
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./log/perf'),
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    for step, (inputs, targets) in enumerate(dataloader):
        if step >= (1 + 1 + 3) * 1:
            break
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()
        prof.step()
```

Then view with:
```bash
tensorboard --logdir=./log/perf
```

The TensorBoard trace view shows a timeline of CPU and GPU operations. You
can see gaps (where hardware is idle), overlap (where CPU and GPU work
simultaneously), and stalls (where one waits for the other).

## NVIDIA Nsight: The Deep Dive

When PyTorch profiler isn't enough -- when you need to see individual CUDA
kernels, memory transactions, and warp-level behavior -- you use NVIDIA Nsight.

### Nsight Systems: System-Level View

Nsight Systems shows the entire system timeline: CPU threads, GPU kernels,
memory copies, and CUDA API calls.

```bash
nsys profile --stats=true python train.py

nsys profile -o profile_output python train.py

nsys-ui profile_output.nsys-rep
```

The timeline view in nsys-ui is incredibly powerful:

```
  NSIGHT SYSTEMS TIMELINE (simplified)

  CPU Thread 0:  [Python] [cuLaunchKernel] [Python] [cuLaunchKernel] ...
  CPU Thread 1:  [DataLoader worker 0: read + decode + collate] ...
  CPU Thread 2:  [DataLoader worker 1: read + decode + collate] ...

  CUDA Stream:   [...wait..] [gemm] [softmax] [gemm] [...wait..] [gemm] ...

  MemCpy D2H:    .........................[copy]..........................
  MemCpy H2D:    ....[copy]..............................[copy]...........

  Time --->

  Gaps in the CUDA stream = GPU starvation.
  Overlapping CPU/GPU = good pipeline utilization.
```

Key things to look for in Nsight Systems:
- **GPU idle gaps**: The GPU is waiting. Why? Usually data transfer or CPU work.
- **Kernel duration**: Are any kernels surprisingly slow?
- **Memory copy overlap**: Are H2D transfers overlapping with compute?
- **CPU thread utilization**: Are DataLoader workers busy or idle?

### Nsight Compute: Kernel-Level Analysis

Nsight Compute profiles individual CUDA kernels in extreme detail: memory
throughput, compute utilization, occupancy, warp stalls.

```bash
ncu --set full -o kernel_profile python train.py

ncu-ui kernel_profile.ncu-rep
```

You use Nsight Compute when you've identified a specific kernel as the
bottleneck and need to understand *why* it's slow. It tells you whether the
kernel is compute-bound or memory-bound, what percentage of peak throughput
you're achieving, and where the warp stalls are.

This level of detail matters when writing custom CUDA kernels (lesson 08) or
evaluating whether a kernel can be optimized further.

## Flame Graphs for ML

Flame graphs are the single most effective visualization for performance
analysis. Brendan Gregg (author of Systems Performance) invented them, and
they work brilliantly for ML code.

The concept: each function call is a horizontal bar. Width represents time.
Stacked bars show the call hierarchy. You can instantly see which code paths
dominate execution time.

```
  READING A FLAME GRAPH

  +-------------------------------------------------------------------+
  | train_epoch (100%)                                                 |
  +---------------------------+---------------------------------------+
  | data_loading (35%)        | model_step (65%)                      |
  +---+--------+--------------+--+----------+---------+-------+-------+
  |   | collate| decode (20%) |  | forward  | backward| optim | zero  |
  |pin| (5%)   |              |  | (25%)    | (30%)   | (8%)  | (2%)  |
  +---+--------+--------------+--+----+-----+---------+-------+-------+
                                      |
                              +-------+-------+
                              | attn  | ffn   |
                              | (15%) | (10%) |
                              +-------+-------+

  Immediate insight: data loading is 35% of total time.
  Before optimizing the model, fix the data pipeline.
```

Generate flame graphs from PyTorch profiler data:

```python
prof.export_stacks("/tmp/profiler_stacks.txt", "self_cuda_time_total")
```

Then convert with Brendan Gregg's FlameGraph tools:
```bash
git clone https://github.com/brendangregg/FlameGraph
cd FlameGraph
./flamegraph.pl /tmp/profiler_stacks.txt > cuda_flamegraph.svg
```

## Finding the Real Bottleneck

Here's the systematic approach:

### Step 1: Is it CPU or GPU?

```python
import time
import torch

torch.cuda.synchronize()
start = time.perf_counter()

for batch in dataloader:
    inputs, targets = batch[0].cuda(), batch[1].cuda()
    outputs = model(inputs)
    loss = criterion(outputs, targets)
    loss.backward()
    optimizer.step()

torch.cuda.synchronize()
end = time.perf_counter()

print(f"Total: {end - start:.2f}s")
```

Now add `torch.cuda.synchronize()` inside the loop after each major phase:

```python
for batch in dataloader:
    torch.cuda.synchronize()
    t0 = time.perf_counter()

    inputs, targets = batch[0].cuda(), batch[1].cuda()
    torch.cuda.synchronize()
    t1 = time.perf_counter()

    outputs = model(inputs)
    torch.cuda.synchronize()
    t2 = time.perf_counter()

    loss = criterion(outputs, targets)
    loss.backward()
    torch.cuda.synchronize()
    t3 = time.perf_counter()

    optimizer.step()
    torch.cuda.synchronize()
    t4 = time.perf_counter()

    print(f"Data: {t1-t0:.3f}  Fwd: {t2-t1:.3f}  Bwd: {t3-t2:.3f}  Opt: {t4-t3:.3f}")
```

**Critical**: Without `torch.cuda.synchronize()`, GPU timings are meaningless.
GPU operations are launched asynchronously -- the CPU returns immediately while
the GPU is still working. Synchronize forces the CPU to wait until all GPU
work finishes, giving you accurate wall-clock times.

### Step 2: Dig Into the Bottleneck

Once you know *which phase* is slow:

- **Data loading slow** -> Profile the DataLoader workers, check IO bandwidth,
  examine data format (see lesson 04)
- **Forward pass slow** -> Use PyTorch profiler to find which ops dominate.
  Large attention computations? Use Flash Attention. Many small ops? Consider
  fusion (lesson 07) or compilation (lesson 06)
- **Backward pass slow** -> Usually proportional to forward. If disproportionately
  slow, check for expensive gradient computations or custom autograd functions
- **Optimizer slow** -> Fused optimizers (like NVIDIA Apex) can help

### Step 3: Check GPU Utilization

```bash
nvidia-smi dmon -s u -d 1
```

This shows GPU utilization every second. If it's bouncing between 0% and 100%,
you have a starvation problem -- the GPU keeps running out of work. Steady
high utilization is what you want.

```python
print(torch.cuda.utilization())

print(torch.cuda.memory_summary())
```

### Step 4: Look for Low-Hanging Fruit

Before going deep, check the basics:

```python
assert next(model.parameters()).is_cuda, "Model not on GPU!"
assert inputs.is_cuda, "Inputs not on GPU!"
assert not torch.is_grad_enabled() or model.training, "Grad enabled during eval!"

for name, param in model.named_parameters():
    assert param.is_contiguous(), f"{name} is not contiguous"
```

These four checks alone catch a shocking number of "my training is slow" issues.

## Exercises

1. Profile your own training script with py-spy. Generate a flame graph.
   What percentage of time is spent in data loading vs model computation?

2. Use the PyTorch profiler to profile a single training step. Which CUDA
   operations take the most time? Are any operations suspiciously slow?

3. Run `nsys profile` on a training run. Look at the timeline. Can you see
   gaps where the GPU is idle? What's the CPU doing during those gaps?

4. Add synchronization-based timing to your training loop (Step 1 above).
   Which phase dominates? Does the answer match your profiler results?
