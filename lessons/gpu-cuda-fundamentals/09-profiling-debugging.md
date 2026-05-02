# Lesson 09: Profiling and Debugging GPU Code — Finding the Bottleneck

Your model is training but it is slow. Is it the GPU compute? Memory
bandwidth? CPU-GPU data transfer? Host-side data loading? You cannot
optimize what you cannot measure. This lesson covers the tools and
techniques for profiling GPU code and debugging the most common CUDA
errors.

---

## The Core Idea

GPU profiling answers one question: **where is the time going?** Most
performance problems fall into a few categories: memory-bound kernels,
CPU bottlenecks (data loading), unnecessary CPU-GPU synchronization,
or simply not using the GPU at all.

**Analogy: A doctor's checkup.** nvidia-smi is like checking your
pulse — a quick health indicator. torch.profiler is like a blood test —
detailed breakdown of what is happening inside. NVIDIA Nsight is like
an MRI — deep, detailed analysis of every kernel.

```
Profiling Tools — From Quick Check to Deep Dive:

Level 1: nvidia-smi (pulse check)
┌──────────────────────────────────────────┐
│ Is the GPU being used at all?            │
│ How much memory is allocated?            │
│ What is the GPU utilization %?           │
└──────────────────────────────────────────┘
         │
         ▼
Level 2: torch.profiler (blood test)
┌──────────────────────────────────────────┐
│ Which operations take the most time?     │
│ How much time is CPU vs GPU?             │
│ Where are the memory allocations?        │
└──────────────────────────────────────────┘
         │
         ▼
Level 3: NVIDIA Nsight Systems/Compute (MRI)
┌──────────────────────────────────────────┐
│ Kernel-level timing and occupancy        │
│ Memory access patterns                   │
│ Warp-level analysis                      │
└──────────────────────────────────────────┘
```

---

## nvidia-smi: The First Tool You Reach For

`nvidia-smi` shows GPU utilization, memory usage, temperature, and
running processes. Run it first whenever something seems wrong.

```
$ nvidia-smi

┌─────────────────────────────────────────────────────────┐
│ NVIDIA-SMI 535.129.03   Driver: 535.129.03   CUDA: 12.2│
├─────────────────────────────────────────────────────────┤
│ GPU  Name        Persistence-M│ Bus-Id   Disp.A │      │
│ Fan  Temp  Perf  Pwr:Usage/Cap│         Memory-Usage │  │
│                                │                      │  │
│  0   NVIDIA A100-SXM4-80GB Off│ 00000000:07:00.0 Off │  │
│  32%  45C   P0    72W / 400W  │  15234MiB / 81920MiB │  │
│                                │                      │  │
├─────────────────────────────────────────────────────────┤
│ Processes:                                              │
│  GPU   PID   Type   Process name          GPU Memory   │
│    0   12345  C     python train.py        15220MiB    │
└─────────────────────────────────────────────────────────┘

Key things to check:
┌──────────────────────────────────────────────────────┐
│ GPU Utilization:                                     │
│   0%   → GPU is idle (CPU bottleneck or bug)         │
│   30%  → Underutilized (data loading bottleneck?)    │
│   90%+ → Good, GPU is busy                           │
│                                                      │
│ Memory Usage:                                        │
│   15 GB / 80 GB → lots of headroom                   │
│   79 GB / 80 GB → close to OOM, reduce batch size    │
│                                                      │
│ Power:                                               │
│   72W / 400W → GPU is not working hard               │
│   380W / 400W → GPU is at full throttle              │
└──────────────────────────────────────────────────────┘
```

```bash
# Watch GPU stats in real-time (updates every 1 second)
nvidia-smi --query-gpu=utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw --format=csv -l 1

# Or use the built-in watch mode
watch -n 1 nvidia-smi
```

---

## torch.profiler: PyTorch's Built-In Profiler

For PyTorch code, `torch.profiler` gives you a breakdown of every
operation — how long it took, whether it ran on CPU or GPU, and how
much memory it used.

```python
import torch
from torch.profiler import profile, record_function, ProfilerActivity

model = MyModel().cuda()
optimizer = torch.optim.Adam(model.parameters())
input_data = torch.randn(32, 512, device='cuda')

# Profile a few training steps
with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    for step in range(5):
        with record_function("forward"):
            output = model(input_data)
            loss = output.sum()

        with record_function("backward"):
            loss.backward()

        with record_function("optimizer"):
            optimizer.step()
            optimizer.zero_grad()

# Print summary sorted by GPU time
print(prof.key_averages().table(
    sort_by="cuda_time_total",
    row_limit=20
))

# Export for visualization in Chrome trace viewer
prof.export_chrome_trace("trace.json")
# Open chrome://tracing in Chrome and load trace.json
```

```
Example profiler output:

Name                    CPU total   CUDA total   # Calls
──────────────────────  ─────────   ──────────   ───────
aten::mm                  2.1 ms     45.3 ms       120
aten::addmm               1.8 ms     38.2 ms        60
aten::softmax             0.3 ms     12.1 ms        30
aten::layer_norm          0.5 ms      8.7 ms        60
aten::gelu                0.2 ms      4.3 ms        30
forward                   8.2 ms     95.0 ms         5
backward                 12.1 ms    110.0 ms         5
optimizer                  3.5 ms     15.0 ms         5

Key insight: aten::mm (matrix multiply) dominates GPU time.
This is expected for transformer models.
```

---

## NVIDIA Nsight Systems

Nsight Systems gives you a timeline view of everything happening on
the CPU and GPU. It shows kernel launches, memory transfers, and idle
gaps.

```
Nsight Systems Timeline (conceptual):

Time ──────────────────────────────────────────────►

CPU:  [DataLoad][  ][Kernel Launch][  ][Kernel Launch][DataLoad]
       ████████  ░░  ████████████  ░░  ████████████  ████████

GPU:  [  idle  ][matmul_kernel][softmax][matmul_kernel][idle]
       ░░░░░░░░  ██████████████  ████  ██████████████  ░░░░

                 ↑                                      ↑
                 GPU starts after                       GPU idle
                 CPU launches kernel                    waiting for
                                                        next launch

Common patterns to look for:
┌──────────────────────────────────────────────────┐
│ 1. Large GPU idle gaps → CPU is the bottleneck   │
│    Fix: use more DataLoader workers, pin_memory  │
│                                                  │
│ 2. Many tiny kernels → kernel launch overhead    │
│    Fix: use torch.compile or fuse operations     │
│                                                  │
│ 3. cudaMemcpy between kernels → unnecessary sync │
│    Fix: keep data on GPU, avoid .cpu() calls     │
│                                                  │
│ 4. One kernel dominates → optimize that kernel   │
│    Fix: check if using tensor cores (FP16/BF16)  │
└──────────────────────────────────────────────────┘
```

```bash
# Profile with Nsight Systems
nsys profile -o my_profile python train.py

# Open the .nsys-rep file in Nsight Systems GUI
nsys-ui my_profile.nsys-rep
```

---

## Common CUDA Errors and How to Fix Them

```
Error 1: CUDA Out of Memory (OOM)
──────────────────────────────────
RuntimeError: CUDA out of memory. Tried to allocate 2.00 GiB

Causes:
  - Model too large for GPU memory
  - Batch size too large
  - Memory leak (tensors not freed)
  - Accumulating computation graph

Fixes:
  ┌──────────────────────────────────────────┐
  │ 1. Reduce batch size                     │
  │ 2. Use gradient checkpointing            │
  │ 3. Use mixed precision (FP16/BF16)       │
  │ 4. Use gradient accumulation             │
  │ 5. Clear cache: torch.cuda.empty_cache() │
  │ 6. Check for memory leaks:               │
  │    torch.cuda.memory_summary()           │
  └──────────────────────────────────────────┘
```

```python
# Debugging OOM
import torch

# Check current memory usage
print(f"Allocated: {torch.cuda.memory_allocated() / 1e9:.2f} GB")
print(f"Reserved:  {torch.cuda.memory_reserved() / 1e9:.2f} GB")
print(f"Max allocated: {torch.cuda.max_memory_allocated() / 1e9:.2f} GB")

# Detailed memory summary
print(torch.cuda.memory_summary())

# Common memory leak: forgetting to detach tensors
losses = []
for batch in dataloader:
    loss = model(batch)
    # BAD: stores entire computation graph!
    losses.append(loss)
    # GOOD: detach from graph
    losses.append(loss.detach().item())
```

```
Error 2: Illegal Memory Access
───────────────────────────────
CUDA error: an illegal memory access was encountered

Causes:
  - Out-of-bounds array access in CUDA kernel
  - Using a freed tensor
  - Race condition in custom CUDA code

Fix:
  CUDA_LAUNCH_BLOCKING=1 python train.py
  (makes CUDA synchronous — slower but shows exact error location)


Error 3: Device-Side Assert
────────────────────────────
RuntimeError: CUDA error: device-side assert triggered

Causes:
  - Index out of range (common in embedding layers)
  - NaN in loss computation
  - Label index >= num_classes

Fix:
  CUDA_LAUNCH_BLOCKING=1 python train.py
  Check your label indices: assert labels.max() < num_classes


Error 4: NCCL Timeout (Multi-GPU)
──────────────────────────────────
RuntimeError: NCCL communicator was aborted

Causes:
  - One GPU crashed or hung
  - Network issue between nodes
  - Deadlock in distributed code

Fix:
  NCCL_DEBUG=INFO python train.py
  Check that all processes reach the same collective operations
```

---

## Quick Profiling Checklist

```
Performance Debugging Flowchart:

Is GPU utilization > 80%?
├── YES → GPU is busy, check:
│         ├── Are you using tensor cores? (FP16/BF16)
│         ├── Is the bottleneck matmul or memory-bound ops?
│         └── Can you increase batch size?
│
└── NO → GPU is underutilized, check:
          ├── Is data loading the bottleneck?
          │   └── Increase num_workers, use pin_memory=True
          ├── Are there CPU-GPU sync points?
          │   └── Avoid .item(), .cpu(), print(tensor)
          ├── Are kernels too small?
          │   └── Use torch.compile to fuse operations
          └── Is there unnecessary data transfer?
              └── Keep tensors on GPU, avoid round-trips
```

---

## Exercises

### Exercise 1: Read nvidia-smi

```
Given this nvidia-smi output, diagnose the problem:

GPU Util: 15%
Memory:   72000 MiB / 81920 MiB
Power:    85W / 400W
Process:  python train.py (72000 MiB)

Questions:
1. Is the GPU being fully utilized?
2. Is memory the bottleneck?
3. What is likely causing low utilization?
4. What would you check first?
```

### Exercise 2: Profile a Training Step

```python
import torch
from torch.profiler import profile, ProfilerActivity

# Simple model for profiling
model = torch.nn.Sequential(
    torch.nn.Linear(1024, 4096),
    torch.nn.GELU(),
    torch.nn.Linear(4096, 4096),
    torch.nn.GELU(),
    torch.nn.Linear(4096, 1024),
).cuda()

x = torch.randn(64, 1024, device='cuda')

# TODO: Profile the forward and backward pass
# TODO: Print the top 10 operations by CUDA time
# TODO: What percentage of time is matrix multiply vs activation?
# TODO: Would switching to FP16 help? Why or why not?
```

### Exercise 3: Memory Leak Detection

```python
import torch

model = torch.nn.Linear(1024, 1024).cuda()
optimizer = torch.optim.Adam(model.parameters())

# This code has a memory leak. Find it.
all_losses = []
for i in range(100):
    x = torch.randn(256, 1024, device='cuda')
    y = model(x)
    loss = y.sum()
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()

    all_losses.append(loss)  # <-- Is this a problem?

    if i % 10 == 0:
        mem = torch.cuda.memory_allocated() / 1e9
        print(f"Step {i}: {mem:.2f} GB allocated")

# TODO: Fix the memory leak
# TODO: Add proper memory monitoring
```

---

Next: [Lesson 10: PyTorch and CUDA Integration](./10-pytorch-cuda-integration.md)
