# 12 - Build an Optimized Pipeline (Capstone)

## The Mission

You have a slow ML pipeline. Your job: make it 10x faster.

This lesson walks through a complete optimization project from start to
finish. We'll take a realistic training pipeline, profile it systematically,
identify every bottleneck, apply targeted optimizations, and verify the
results. This is what the entire track has been building toward.

```
  THE OPTIMIZATION JOURNEY

  Step 1: Baseline          "How slow is it, exactly?"
  Step 2: Profile           "Where does the time go?"
  Step 3: Prioritize        "What gives the biggest bang per buck?"
  Step 4: Optimize          "Apply targeted fixes"
  Step 5: Verify            "Did it actually get faster?"
  Step 6: Repeat            "Is there more to squeeze?"

  +--------+    +--------+    +--------+    +--------+
  |Baseline|--->|Profile |--->|Optimize|--->| Verify |---+
  | 100s   |    |        |    |        |    |        |   |
  +--------+    +--------+    +--------+    +--------+   |
                                                         |
                +--------+    +--------+    +--------+   |
                | 10s!   |<---| Verify |<---| More?  |<--+
                | Done!  |    |        |    |        |
                +--------+    +--------+    +--------+
```

## The Slow Pipeline

Here's our starting point -- a transformer-based vision model training
pipeline that has every common performance problem:

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from PIL import Image
import os
import time
import json

class ImageDataset(Dataset):
    def __init__(self, root_dir, transform=None):
        self.root_dir = root_dir
        self.transform = transform
        self.samples = []
        for class_dir in os.listdir(root_dir):
            class_path = os.path.join(root_dir, class_dir)
            if os.path.isdir(class_path):
                for img_name in os.listdir(class_path):
                    self.samples.append((
                        os.path.join(class_path, img_name),
                        int(class_dir),
                    ))

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        image = Image.open(path).convert('RGB')
        if self.transform:
            image = self.transform(image)
        return image, label

    def __len__(self):
        return len(self.samples)

class VisionTransformer(nn.Module):
    def __init__(self, img_size=224, patch_size=16, dim=768,
                 depth=12, heads=12, num_classes=1000):
        super().__init__()
        num_patches = (img_size // patch_size) ** 2
        self.patch_embed = nn.Conv2d(3, dim, patch_size, stride=patch_size)
        self.cls_token = nn.Parameter(torch.randn(1, 1, dim))
        self.pos_embed = nn.Parameter(torch.randn(1, num_patches + 1, dim))
        self.blocks = nn.ModuleList([
            nn.TransformerEncoderLayer(
                d_model=dim, nhead=heads, dim_feedforward=dim * 4,
                dropout=0.1, activation='gelu', batch_first=True,
            )
            for _ in range(depth)
        ])
        self.norm = nn.LayerNorm(dim)
        self.head = nn.Linear(dim, num_classes)

    def forward(self, x):
        x = self.patch_embed(x)
        x = x.flatten(2).transpose(1, 2)
        cls = self.cls_token.expand(x.shape[0], -1, -1)
        x = torch.cat([cls, x], dim=1)
        x = x + self.pos_embed
        for block in self.blocks:
            x = block(x)
        x = self.norm(x[:, 0])
        return self.head(x)


def train_slow():
    transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    dataset = ImageDataset("data/imagenet/train", transform=transform)
    dataloader = DataLoader(dataset, batch_size=32, shuffle=True, num_workers=0)

    model = VisionTransformer().cuda()
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)

    model.train()
    total_loss = 0
    start = time.time()

    for step, (images, labels) in enumerate(dataloader):
        images = images.cuda()
        labels = labels.cuda()

        outputs = model(images)
        loss = criterion(outputs, labels)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
        if step % 10 == 0:
            print(f"Step {step}, Loss: {loss.item():.4f}, "
                  f"Time: {time.time() - start:.1f}s")

        if step >= 200:
            break

    elapsed = time.time() - start
    throughput = (step + 1) * 32 / elapsed
    print(f"\nBaseline: {throughput:.0f} images/sec, {elapsed:.1f}s total")
    return throughput
```

## Step 1: Establish the Baseline

Before changing anything, measure. You need a number to beat.

```python
def benchmark_pipeline(train_fn, name, num_steps=200):
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()

    torch.cuda.synchronize()
    start = time.perf_counter()

    throughput = train_fn()

    torch.cuda.synchronize()
    elapsed = time.perf_counter() - start
    peak_memory = torch.cuda.max_memory_allocated() / 1024**3

    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"  Throughput: {throughput:.0f} images/sec")
    print(f"  Wall time:  {elapsed:.1f}s")
    print(f"  Peak memory: {peak_memory:.2f} GB")
    print(f"{'='*60}\n")

    return {"throughput": throughput, "time": elapsed, "memory": peak_memory}

baseline = benchmark_pipeline(train_slow, "BASELINE")
```

## Step 2: Profile

Use the systematic profiling approach from lesson 01:

```python
def profile_pipeline():
    model = VisionTransformer().cuda()
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)

    dataset = ImageDataset("data/imagenet/train", transform=transform)
    dataloader = DataLoader(dataset, batch_size=32, shuffle=True, num_workers=0)

    model.train()

    with torch.profiler.profile(
        activities=[
            torch.profiler.ProfilerActivity.CPU,
            torch.profiler.ProfilerActivity.CUDA,
        ],
        schedule=torch.profiler.schedule(wait=5, warmup=5, active=10),
        on_trace_ready=torch.profiler.tensorboard_trace_handler('./log/baseline'),
        record_shapes=True,
        profile_memory=True,
        with_stack=True,
    ) as prof:
        for step, (images, labels) in enumerate(dataloader):
            if step >= 20:
                break
            images, labels = images.cuda(), labels.cuda()
            outputs = model(images)
            loss = criterion(outputs, labels)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            prof.step()

    print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=20))
    return prof
```

### Interpreting the Profile

Let's break down what we expect to find:

```
  EXPECTED PROFILING RESULTS (slow pipeline)

  Phase           Time (ms)   % of Step   Bottleneck?
  -------------------------------------------------------
  Data loading    150-300     50-70%      YES - num_workers=0!
  H2D transfer    5-10        2-3%        No
  Forward pass    30-50       10-15%      Possibly
  Backward pass   40-60       12-18%      Possibly
  Optimizer       10-15       3-5%        No
  loss.item()     5-15        2-5%        YES - sync per step!
  Python overhead 10-20       3-7%        Yes (per-op dispatch)
  -------------------------------------------------------
  Total step:     250-470ms

  Primary bottleneck: DATA LOADING (num_workers=0)
  Secondary: CPU-GPU sync from loss.item() every step
  Tertiary: No mixed precision, no compilation
```

## Step 3: Apply Optimizations (Iterative)

### Round 1: Fix the Data Pipeline

The biggest win first. This addresses lesson 04 patterns.

```python
def train_v1_data_fixed():
    transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    dataset = ImageDataset("data/imagenet/train", transform=transform)
    dataloader = DataLoader(
        dataset,
        batch_size=32,
        shuffle=True,
        num_workers=8,
        pin_memory=True,
        persistent_workers=True,
        prefetch_factor=2,
    )

    model = VisionTransformer().cuda()
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)

    model.train()
    running_loss = 0.0
    start = time.perf_counter()

    for step, (images, labels) in enumerate(dataloader):
        images = images.cuda(non_blocking=True)
        labels = labels.cuda(non_blocking=True)

        outputs = model(images)
        loss = criterion(outputs, labels)

        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        optimizer.step()

        running_loss += loss.detach()
        if step % 50 == 0:
            torch.cuda.synchronize()
            avg_loss = (running_loss / max(step, 1)).item()
            print(f"Step {step}, Loss: {avg_loss:.4f}")
            running_loss = 0.0

        if step >= 200:
            break

    torch.cuda.synchronize()
    elapsed = time.perf_counter() - start
    throughput = (step + 1) * 32 / elapsed
    return throughput
```

Changes:
- `num_workers=8` with `persistent_workers=True`
- `pin_memory=True` with `non_blocking=True` transfers
- `set_to_none=True` in zero_grad
- Removed per-step `loss.item()` sync (log every 50 steps instead)

**Expected speedup: 2-4x** (data loading was the bottleneck)

### Round 2: Mixed Precision

```python
def train_v2_mixed_precision():
    dataloader = get_optimized_dataloader()

    model = VisionTransformer().cuda()
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
    scaler = torch.cuda.amp.GradScaler()

    model.train()
    start = time.perf_counter()

    for step, (images, labels) in enumerate(dataloader):
        images = images.cuda(non_blocking=True)
        labels = labels.cuda(non_blocking=True)

        with torch.cuda.amp.autocast(dtype=torch.bfloat16):
            outputs = model(images)
            loss = criterion(outputs, labels)

        optimizer.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        if step >= 200:
            break

    torch.cuda.synchronize()
    elapsed = time.perf_counter() - start
    return (step + 1) * 32 / elapsed
```

**Expected additional speedup: 1.5-2x** (half-precision tensor cores)

### Round 3: torch.compile

```python
def train_v3_compiled():
    dataloader = get_optimized_dataloader()

    model = VisionTransformer().cuda()
    compiled_model = torch.compile(model, mode="reduce-overhead")
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
    scaler = torch.cuda.amp.GradScaler()

    compiled_model.train()

    print("Warming up (compilation)...")
    warmup_data = torch.randn(32, 3, 224, 224, device='cuda')
    warmup_labels = torch.randint(0, 1000, (32,), device='cuda')
    with torch.cuda.amp.autocast(dtype=torch.bfloat16):
        warmup_out = compiled_model(warmup_data)
        warmup_loss = criterion(warmup_out, warmup_labels)
    scaler.scale(warmup_loss).backward()
    optimizer.zero_grad(set_to_none=True)
    print("Compilation complete.")

    start = time.perf_counter()

    for step, (images, labels) in enumerate(dataloader):
        images = images.cuda(non_blocking=True)
        labels = labels.cuda(non_blocking=True)

        with torch.cuda.amp.autocast(dtype=torch.bfloat16):
            outputs = compiled_model(images)
            loss = criterion(outputs, labels)

        optimizer.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        if step >= 200:
            break

    torch.cuda.synchronize()
    elapsed = time.perf_counter() - start
    return (step + 1) * 32 / elapsed
```

**Expected additional speedup: 1.3-1.8x** (fused kernels, reduced dispatch)

### Round 4: Larger Batch Size

With mixed precision and compilation saving memory, we can increase batch size:

```python
def train_v4_larger_batch():
    dataloader = DataLoader(
        dataset,
        batch_size=128,
        shuffle=True,
        num_workers=8,
        pin_memory=True,
        persistent_workers=True,
        prefetch_factor=2,
    )

    model = VisionTransformer().cuda()
    compiled_model = torch.compile(model, mode="reduce-overhead")
    criterion = nn.CrossEntropyLoss()

    scaled_lr = 1e-4 * (128 / 32)
    optimizer = torch.optim.Adam(model.parameters(), lr=scaled_lr)
    scaler = torch.cuda.amp.GradScaler()

    compiled_model.train()

    warmup_and_compile(compiled_model, criterion, scaler, batch_size=128)

    start = time.perf_counter()
    total_images = 0

    for step, (images, labels) in enumerate(dataloader):
        images = images.cuda(non_blocking=True)
        labels = labels.cuda(non_blocking=True)

        with torch.cuda.amp.autocast(dtype=torch.bfloat16):
            outputs = compiled_model(images)
            loss = criterion(outputs, labels)

        optimizer.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        total_images += images.shape[0]
        if total_images >= 200 * 32:
            break

    torch.cuda.synchronize()
    elapsed = time.perf_counter() - start
    return total_images / elapsed
```

**Expected additional speedup: 1.5-2x** (better GPU utilization)

## Step 4: Verify and Compare

```python
def run_optimization_comparison():
    results = {}

    print("\n" + "="*60)
    print("OPTIMIZATION COMPARISON")
    print("="*60)

    configs = [
        ("Baseline (slow)", train_slow),
        ("V1: Data pipeline fixed", train_v1_data_fixed),
        ("V2: + Mixed precision", train_v2_mixed_precision),
        ("V3: + torch.compile", train_v3_compiled),
        ("V4: + Larger batch", train_v4_larger_batch),
    ]

    for name, train_fn in configs:
        result = benchmark_pipeline(train_fn, name)
        results[name] = result

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    baseline_tp = results["Baseline (slow)"]["throughput"]
    for name, result in results.items():
        speedup = result["throughput"] / baseline_tp
        print(f"  {name:35s} {result['throughput']:6.0f} img/s  ({speedup:.1f}x)")
    print("="*60)
```

Expected final results:

```
  OPTIMIZATION RESULTS

  Configuration                        Throughput    Speedup
  -----------------------------------------------------------
  Baseline (slow)                      120 img/s     1.0x
  V1: Data pipeline fixed              380 img/s     3.2x
  V2: + Mixed precision                680 img/s     5.7x
  V3: + torch.compile                  920 img/s     7.7x
  V4: + Larger batch                   1350 img/s    11.3x
  -----------------------------------------------------------

  Total speedup: 11.3x
  Memory reduction: ~40% (mixed precision)

  Per-optimization contribution:
  Data pipeline:     3.2x (biggest single win)
  Mixed precision:   1.8x
  Compilation:       1.4x
  Larger batch:      1.5x
  Compound effect:   3.2 * 1.8 * 1.4 * 1.5 = 12.1x (theoretical)
```

## Common Gotchas in Optimization Projects

### Gotcha 1: Measuring Wrong

```python
torch.cuda.synchronize()
start = time.perf_counter()
# ... work ...
torch.cuda.synchronize()
end = time.perf_counter()
```

Without synchronization, GPU async execution makes timings meaningless.

### Gotcha 2: Optimizing the Wrong Thing

If data loading is 60% of your time and you spend a week optimizing the
model's forward pass (25% of time), even a 2x forward pass speedup only
gives 1.14x total speedup:

```
  AMDAHL'S LAW

  Speedup = 1 / ((1 - fraction_improved) + fraction_improved / improvement)

  Data loading: 60% of time, Model: 25%, Other: 15%

  Optimizing model by 2x:
  Speedup = 1 / (0.75 + 0.25/2) = 1 / 0.875 = 1.14x

  Optimizing data by 5x:
  Speedup = 1 / (0.40 + 0.60/5) = 1 / 0.52 = 1.92x

  Always optimize the biggest fraction first.
```

### Gotcha 3: Not Verifying Correctness

After every optimization, verify the model still produces correct results:

```python
def verify_correctness(model_a, model_b, input_tensor, rtol=1e-3, atol=1e-5):
    model_a.eval()
    model_b.eval()

    with torch.inference_mode():
        out_a = model_a(input_tensor)
        out_b = model_b(input_tensor)

    if torch.allclose(out_a, out_b, rtol=rtol, atol=atol):
        max_diff = (out_a - out_b).abs().max().item()
        print(f"PASS: max difference = {max_diff:.2e}")
    else:
        max_diff = (out_a - out_b).abs().max().item()
        print(f"FAIL: max difference = {max_diff:.2e}")
        diverged = (out_a - out_b).abs() > atol + rtol * out_b.abs()
        print(f"  {diverged.sum().item()} / {diverged.numel()} elements diverged")
```

### Gotcha 4: Forgetting Warmup

The first iteration is always slow due to CUDA context initialization,
kernel compilation, and JIT caching. Always warm up before measuring:

```python
for _ in range(10):
    _ = model(dummy_input)
torch.cuda.synchronize()
```

## Your Optimization Checklist

Use this for every optimization project:

```
  PRE-OPTIMIZATION
  [ ] Establish baseline (throughput, latency, memory)
  [ ] Profile with PyTorch profiler
  [ ] Profile with py-spy (CPU side)
  [ ] Identify primary bottleneck

  DATA PIPELINE
  [ ] num_workers > 0
  [ ] pin_memory + non_blocking
  [ ] persistent_workers
  [ ] Data in efficient format
  [ ] Local SSD storage

  COMPUTE
  [ ] Mixed precision (bf16/fp16)
  [ ] torch.compile
  [ ] Flash Attention enabled
  [ ] No unnecessary CPU-GPU syncs
  [ ] Optimal batch size

  MEMORY
  [ ] set_to_none=True for zero_grad
  [ ] Gradient checkpointing (if memory-limited)
  [ ] No memory leaks (monitor over time)

  INFERENCE-SPECIFIC
  [ ] inference_mode()
  [ ] model.eval()
  [ ] KV-cache for autoregressive
  [ ] Request batching
  [ ] TensorRT or torch.compile

  VERIFICATION
  [ ] Correctness check after each optimization
  [ ] Benchmark with warmup
  [ ] Multiple runs for statistical significance
  [ ] GPU utilization monitoring
```

## Exercises

1. Take one of your own training scripts and apply the full optimization
   workflow. Establish a baseline, profile, optimize, and measure. What
   total speedup do you achieve?

2. Create a presentation-ready benchmark report showing the impact of each
   optimization layer (like the table above). Include memory usage.

3. Identify an optimization that this capstone didn't cover (e.g., gradient
   checkpointing, TensorRT for inference). Apply it and measure the impact.

4. Profile the optimized pipeline. Where is the bottleneck now? What would
   you need to do for another 2x speedup beyond the 10x?
