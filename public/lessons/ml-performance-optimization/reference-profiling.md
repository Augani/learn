# Profiling Quick Reference

## Tool Selection

```
  WHICH PROFILER DO I NEED?

  "My training is slow"
  |
  +-- Where is the time going?
  |   --> py-spy (flame graph of CPU time)
  |   --> PyTorch profiler (CPU + GPU timeline)
  |
  +-- Is the GPU underutilized?
  |   --> nvidia-smi dmon (real-time GPU utilization)
  |   --> Nsight Systems (detailed timeline)
  |
  +-- Is a specific kernel slow?
  |   --> Nsight Compute (per-kernel analysis)
  |
  +-- Is memory the issue?
  |   --> torch.cuda.memory_summary()
  |   --> torch.cuda.memory._record_memory_history()
  |
  +-- Is the data pipeline the bottleneck?
      --> iostat / iotop (disk IO)
      --> Timed DataLoader benchmark
```

## py-spy Commands

```bash
# Flame graph (SVG output)
py-spy record -o profile.svg -- python train.py

# Live top-like view
py-spy top -- python train.py

# Attach to running process
py-spy record -o profile.svg --pid 12345

# Include native C/C++ frames
py-spy record --native -o profile.svg -- python train.py

# Specific sampling rate (default 100)
py-spy record -r 200 -o profile.svg -- python train.py
```

## PyTorch Profiler

### Basic Usage

```python
from torch.profiler import profile, ProfilerActivity

with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    # ... your code ...
    pass

# Print top ops by CUDA time
print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=20))

# Print top ops by CPU time
print(prof.key_averages().table(sort_by="cpu_time_total", row_limit=20))

# Print top ops by memory
print(prof.key_averages().table(sort_by="self_cuda_memory_usage", row_limit=20))
```

### Scheduled Profiling (Multiple Steps)

```python
with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    schedule=torch.profiler.schedule(
        wait=2,      # skip first 2 steps
        warmup=2,    # warmup for 2 steps (results discarded)
        active=6,    # profile for 6 steps
        repeat=1,    # repeat once
    ),
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./log/profile'),
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    for step, batch in enumerate(dataloader):
        if step >= (2 + 2 + 6):
            break
        train_step(batch)
        prof.step()
```

### Export Flame Graph Stacks

```python
# CPU time stacks
prof.export_stacks("/tmp/cpu_stacks.txt", "self_cpu_time_total")

# CUDA time stacks
prof.export_stacks("/tmp/cuda_stacks.txt", "self_cuda_time_total")

# Then generate SVG:
# git clone https://github.com/brendangregg/FlameGraph
# ./FlameGraph/flamegraph.pl /tmp/cuda_stacks.txt > cuda_flame.svg
```

### Chrome Trace Export

```python
prof.export_chrome_trace("trace.json")
# Open chrome://tracing in Chrome, load trace.json
```

## NVIDIA Tools

### nvidia-smi

```bash
# One-shot GPU status
nvidia-smi

# Continuous monitoring (1 second interval)
nvidia-smi dmon -s u -d 1

# Detailed monitoring (utilization, memory, temperature, power)
nvidia-smi dmon -s umt -d 1

# Process-level GPU memory usage
nvidia-smi pmon -s um -d 1

# Query specific metrics
nvidia-smi --query-gpu=utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw --format=csv -l 1
```

### Nsight Systems

```bash
# Basic profile
nsys profile python train.py

# With statistics summary
nsys profile --stats=true python train.py

# Named output file
nsys profile -o my_profile python train.py

# Profile specific CUDA APIs only
nsys profile --trace=cuda,nvtx python train.py

# Limit profiling duration (seconds)
nsys profile --duration 30 python train.py

# Delayed start (seconds)
nsys profile --delay 10 python train.py

# Open in GUI
nsys-ui my_profile.nsys-rep
```

### Nsight Compute

```bash
# Full kernel analysis
ncu --set full python train.py

# Named output
ncu --set full -o kernel_profile python train.py

# Profile specific kernel by name (regex)
ncu --kernel-name "gemm" python train.py

# Limit number of kernel launches to profile
ncu --launch-count 10 python train.py

# Skip first N kernel launches
ncu --launch-skip 100 --launch-count 10 python train.py

# Open in GUI
ncu-ui kernel_profile.ncu-rep
```

## Memory Profiling

### Quick Memory Check

```python
# Current and peak usage
allocated = torch.cuda.memory_allocated() / 1024**3
peak = torch.cuda.max_memory_allocated() / 1024**3
reserved = torch.cuda.memory_reserved() / 1024**3
print(f"Allocated: {allocated:.2f} GB, Peak: {peak:.2f} GB, Reserved: {reserved:.2f} GB")

# Reset peak stats
torch.cuda.reset_peak_memory_stats()
```

### Detailed Memory Summary

```python
print(torch.cuda.memory_summary(device='cuda:0', abbreviated=False))
```

### Memory Snapshot (Visual)

```python
torch.cuda.memory._record_memory_history(max_entries=100000)

# ... run your code ...

torch.cuda.memory._dump_snapshot("memory_snapshot.pickle")
torch.cuda.memory._record_memory_history(enabled=None)

# Upload memory_snapshot.pickle to https://pytorch.org/memory_viz
```

### Track Memory by Phase

```python
def log_memory(tag):
    alloc = torch.cuda.memory_allocated() / 1024**3
    reserved = torch.cuda.memory_reserved() / 1024**3
    print(f"[{tag}] Allocated: {alloc:.2f} GB, Reserved: {reserved:.2f} GB")
```

## IO and System Profiling

```bash
# Disk IO statistics (1 second interval)
iostat -x 1

# Top processes by IO
iotop -aoP

# CPU utilization per core
mpstat -P ALL 1

# System-wide performance counters
perf stat python train.py

# Memory usage
free -h
vmstat 1

# Network bandwidth test
iperf3 -c storage-server

# Check if data loading hits page cache
pcstat /path/to/data/*
```

## Quick Timing in Code

### GPU-Aware Timing

```python
import torch
import time

# WRONG (GPU ops are async):
start = time.time()
output = model(input)
print(f"Time: {time.time() - start}")  # measures dispatch time, not GPU time

# CORRECT:
torch.cuda.synchronize()
start = time.perf_counter()
output = model(input)
torch.cuda.synchronize()
print(f"Time: {time.perf_counter() - start}")
```

### CUDA Events (Most Accurate)

```python
start_event = torch.cuda.Event(enable_timing=True)
end_event = torch.cuda.Event(enable_timing=True)

start_event.record()
output = model(input)
end_event.record()

torch.cuda.synchronize()
elapsed_ms = start_event.elapsed_time(end_event)
print(f"GPU time: {elapsed_ms:.3f}ms")
```

### torch.utils.benchmark (Statistical)

```python
from torch.utils.benchmark import Timer

timer = Timer(
    stmt="model(x)",
    globals={"model": model, "x": input_tensor},
    num_threads=1,
)
result = timer.timeit(100)
print(result)  # includes mean, median, IQR
```

## Interpreting Results

### Flame Graph Patterns

```
  WIDE BAR AT TOP = function takes a lot of total time
  WIDE BAR AT BOTTOM = leaf function that does actual work
  TALL NARROW TOWER = deep call stack, not necessarily slow
  FLAT WIDE PLATEAU = time spread across many calls to same function

  Look for:
  - Unexpectedly wide bars (surprising time sinks)
  - Data loading functions wider than model functions
  - Python overhead functions (especially in loops)
```

### PyTorch Profiler Table

```
  Key columns:
  - Self CPU time: time in this function only (not children)
  - CPU total: time including children
  - Self CUDA time: GPU time for this kernel only
  - CUDA total: GPU time including children
  - # Calls: how many times this op was called

  Red flags:
  - aten::to or aten::copy_ near the top (unnecessary transfers)
  - High call count for small ops (dispatch overhead)
  - Large gap between CPU total and CUDA total (sync stalls)
  - aten::item anywhere (forces CPU-GPU sync)
```

### GPU Utilization Patterns

```
  Steady 95-100%: Good. GPU is well-fed.
  Oscillating 0-100%: GPU starvation. Data pipeline or CPU bottleneck.
  Steady 50%: Possible memory bandwidth bottleneck or small batch.
  Spikes with gaps: Kernel launches with sync points between them.
```
