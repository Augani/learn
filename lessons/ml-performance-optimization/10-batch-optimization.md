# 10 - Batch Optimization

## The Analogy

You're running a laundromat. Each washing machine can handle 1-50 shirts.
Loading takes the same time regardless of how many shirts you put in. Running
the cycle takes slightly longer with more shirts, but not linearly. The
machine's motor, water heating, and spinning are mostly fixed costs.

Putting one shirt per load is absurdly wasteful -- you pay the full fixed
cost for one shirt. Overstuffing with 50 shirts means some don't get clean
(the machine jams, or in GPU terms, you OOM). The sweet spot is somewhere
in between, and finding it requires understanding both the machine and the
shirts.

```
  BATCH SIZE vs GPU UTILIZATION

  Throughput
  (samples/s)
    |
    |                         ___________________
    |                        /
    |                       /
    |                      /
    |                     /  <-- GPU becomes saturated
    |                    /
    |                   /
    |                  /
    |            ____/
    |           /
    |          /  <-- GPU underutilized (small batches)
    |         /
    +---------+------------------------------------> Batch Size
    1    8   16   32   64  128  256  512

  Small batches: kernel launch overhead dominates
  Medium batches: GPU is well-utilized
  Large batches: throughput plateaus (compute-bound), memory fills up
  Too large: OOM
```

## Batch Size Tuning for Training

### The Memory Equation

```
  GPU MEMORY USAGE

  Total = Parameters + Gradients + Optimizer States + Activations(batch_size)

  Fixed costs (don't scale with batch):
  - Parameters:       model_size * dtype_bytes
  - Gradients:        model_size * dtype_bytes
  - Optimizer States: model_size * dtype_bytes * multiplier (Adam=2)

  Variable cost (scales with batch):
  - Activations:      f(batch_size, seq_len, model_width)

  Example: 350M parameter model (fp16 training with Adam)
  Fixed: 350M * 2 + 350M * 2 + 350M * 4 * 2 = ~4.2 GB
  Activations per sample at seq_len=512: ~50 MB
  Batch size 32: 4.2 GB + 1.6 GB = 5.8 GB
  Batch size 128: 4.2 GB + 6.4 GB = 10.6 GB
  Batch size 512: 4.2 GB + 25.6 GB = 29.8 GB
```

### Finding Maximum Batch Size

Binary search for the largest batch size that fits in memory:

```python
import torch
import gc

def find_max_batch_size(
    model_fn,
    input_shape_fn,
    min_batch=1,
    max_batch=1024,
    dtype=torch.float16,
):
    device = 'cuda'
    working_batch = min_batch

    while min_batch <= max_batch:
        mid_batch = (min_batch + max_batch) // 2
        try:
            torch.cuda.empty_cache()
            gc.collect()

            model = model_fn().to(device, dtype=dtype)
            optimizer = torch.optim.Adam(model.parameters())
            inputs = input_shape_fn(mid_batch).to(device, dtype=dtype)

            with torch.cuda.amp.autocast(dtype=dtype):
                outputs = model(inputs)
                loss = outputs.sum()
            loss.backward()
            optimizer.step()

            working_batch = mid_batch
            min_batch = mid_batch + 1

            del model, optimizer, inputs, outputs, loss
        except torch.cuda.OutOfMemoryError:
            max_batch = mid_batch - 1
            del model, optimizer
        finally:
            torch.cuda.empty_cache()
            gc.collect()

    return working_batch

max_bs = find_max_batch_size(
    model_fn=lambda: MyModel(),
    input_shape_fn=lambda bs: torch.randn(bs, 3, 224, 224),
)
print(f"Maximum batch size: {max_bs}")
```

### Batch Size vs Learning Rate

When you increase batch size, you should increase learning rate proportionally
(the linear scaling rule from the "Accurate, Large Minibatch SGD" paper):

```
  LINEAR SCALING RULE

  If batch_size increases by factor k, multiply learning_rate by k.

  Base:    batch_size=32,  lr=0.001
  Scaled:  batch_size=128, lr=0.004   (128/32 = 4x)
  Scaled:  batch_size=512, lr=0.016   (512/32 = 16x)

  WARNING: This breaks down for very large batch sizes (>8192).
  Use warmup to stabilize:

  Learning Rate
       |
  0.016|          _______________
       |         /
       |        /  <-- linear warmup
       |       /
       |      /
  0.001|_____/
       +-----+---+-------------------> Step
       0    500  1000

  Warmup period: ~5% of total steps or 1 epoch, whichever is smaller.
```

```python
from torch.optim.lr_scheduler import LinearLR, CosineAnnealingLR, SequentialLR

base_lr = 0.001
batch_factor = new_batch_size / base_batch_size
scaled_lr = base_lr * batch_factor

optimizer = torch.optim.AdamW(model.parameters(), lr=scaled_lr)

warmup = LinearLR(optimizer, start_factor=0.1, total_iters=warmup_steps)
cosine = CosineAnnealingLR(optimizer, T_max=total_steps - warmup_steps)
scheduler = SequentialLR(optimizer, [warmup, cosine], milestones=[warmup_steps])
```

## Gradient Accumulation

When you can't fit the desired batch size in memory, simulate it by
accumulating gradients across multiple micro-batches:

```python
effective_batch_size = 256
micro_batch_size = 32
accumulation_steps = effective_batch_size // micro_batch_size

optimizer.zero_grad(set_to_none=True)

for micro_step in range(accumulation_steps):
    inputs, targets = get_micro_batch(micro_batch_size)
    inputs, targets = inputs.cuda(), targets.cuda()

    with torch.cuda.amp.autocast(dtype=torch.bfloat16):
        outputs = model(inputs)
        loss = criterion(outputs, targets) / accumulation_steps

    loss.backward()

if (step + 1) % accumulation_steps == 0:
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    optimizer.step()
    optimizer.zero_grad(set_to_none=True)
```

```
  GRADIENT ACCUMULATION

  Micro-batch 1: forward -> backward -> accumulate grads
  Micro-batch 2: forward -> backward -> accumulate grads
  Micro-batch 3: forward -> backward -> accumulate grads
  Micro-batch 4: forward -> backward -> accumulate grads
  --> optimizer.step() (uses accumulated gradients)
  --> zero_grad()

  Memory: only micro_batch_size in GPU at once
  Effective batch: micro_batch_size * accumulation_steps
  Tradeoff: more kernel launches, slightly slower per sample
```

**Critical detail**: divide the loss by `accumulation_steps` so the
accumulated gradients have the same magnitude as a single large batch.
Without this, your effective learning rate is `accumulation_steps` times
too high.

## Dynamic Batching for Inference

Training uses fixed batch sizes. Inference handles variable load -- sometimes
one request, sometimes hundreds. Dynamic batching groups incoming requests
into batches on the fly.

```python
import asyncio
import time
from collections import deque

class DynamicBatcher:
    def __init__(self, model, max_batch_size=64, max_wait_ms=10):
        self.model = model
        self.max_batch_size = max_batch_size
        self.max_wait_ms = max_wait_ms
        self.queue = deque()
        self.running = True

    async def predict(self, input_tensor):
        future = asyncio.get_event_loop().create_future()
        self.queue.append((input_tensor, future))
        return await future

    async def batch_processor(self):
        while self.running:
            if not self.queue:
                await asyncio.sleep(0.001)
                continue

            deadline = time.perf_counter() + self.max_wait_ms / 1000
            batch_items = []

            while (
                len(batch_items) < self.max_batch_size
                and time.perf_counter() < deadline
            ):
                if self.queue:
                    batch_items.append(self.queue.popleft())
                else:
                    await asyncio.sleep(0.001)

            if not batch_items:
                continue

            inputs = torch.stack([item[0] for item in batch_items]).cuda()
            with torch.inference_mode():
                outputs = self.model(inputs)

            for idx, (_, future) in enumerate(batch_items):
                future.set_result(outputs[idx])
```

```
  DYNAMIC BATCHING

  Requests arrive:     t=0ms  t=2ms  t=5ms  t=7ms  t=10ms
                        r1     r2     r3     r4     batch!

  Without batching:    [r1] [r2] [r3] [r4]  (4 kernel launches)
  With batching:       [r1, r2, r3, r4]      (1 kernel launch)

  Tradeoff: each request waits up to max_wait_ms for the batch to fill.
  - Low latency requirement: small max_wait_ms (1-5ms)
  - High throughput requirement: larger max_wait_ms (10-50ms)
```

## Micro-Batching for Pipeline Parallelism

When using model parallelism across multiple GPUs, micro-batching keeps all
GPUs busy:

```
  WITHOUT MICRO-BATCHING (2 GPUs):

  GPU 0: [Forward layers 1-6] [................idle.................]
  GPU 1: [.......idle.........] [Forward layers 7-12] [Backward 7-12]
  GPU 0: [Backward 1-6]

  One GPU is always idle. 50% utilization.


  WITH MICRO-BATCHING (4 micro-batches):

  GPU 0: [F1] [F2] [F3] [F4] [B4] [B3] [B2] [B1]
  GPU 1:      [F1] [F2] [F3] [F4] [B4] [B3] [B2] [B1]

  F = forward micro-batch, B = backward micro-batch
  Both GPUs stay busy (pipeline is full).
  More micro-batches = better utilization = higher throughput.
```

```python
from torch.distributed.pipelining import ScheduleGPipe, SplitPoint

pipe = pipeline(
    model,
    mb_args=(micro_batch_input,),
    split_spec={
        "layer6": SplitPoint.END,
    },
)

schedule = ScheduleGPipe(pipe, n_microbatches=4)
output = schedule.step(input_batch)
```

## Batch Size Search Strategies

### Strategy 1: Power-of-Two Search

```python
def power_of_two_search(model, input_fn, criterion):
    results = {}
    for exp in range(0, 12):
        bs = 2 ** exp
        try:
            torch.cuda.empty_cache()
            throughput = measure_throughput(model, input_fn, criterion, bs)
            results[bs] = throughput
            print(f"BS={bs:5d}: {throughput:.0f} samples/s")
        except torch.cuda.OutOfMemoryError:
            print(f"BS={bs:5d}: OOM")
            break
    return results
```

### Strategy 2: Throughput-Optimal Search

The optimal batch size maximizes throughput (samples/second), not just
GPU utilization:

```python
def find_optimal_batch_size(model, input_fn, criterion):
    max_bs = find_max_batch_size(model, input_fn)
    safe_bs = int(max_bs * 0.9)

    best_throughput = 0
    best_bs = 1
    results = {}

    for bs in [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, safe_bs]:
        if bs > safe_bs:
            break
        throughput = measure_throughput(model, input_fn, criterion, bs)
        results[bs] = throughput
        if throughput > best_throughput:
            best_throughput = throughput
            best_bs = bs

    return best_bs, results

def measure_throughput(model, input_fn, criterion, batch_size, num_steps=50):
    model.train()
    optimizer = torch.optim.Adam(model.parameters())

    for _ in range(5):
        x = input_fn(batch_size).cuda()
        loss = criterion(model(x), torch.zeros(batch_size, device='cuda'))
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()

    torch.cuda.synchronize()
    start = time.perf_counter()
    for _ in range(num_steps):
        x = input_fn(batch_size).cuda()
        loss = criterion(model(x), torch.zeros(batch_size, device='cuda'))
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
    torch.cuda.synchronize()
    elapsed = time.perf_counter() - start

    return batch_size * num_steps / elapsed
```

### Strategy 3: Critical Batch Size

There's a theory-backed concept called the **critical batch size** -- the
batch size where the gradient noise equals the gradient signal. Below this
size, larger batches give proportional speedup. Above it, larger batches
give diminishing returns.

```
  CRITICAL BATCH SIZE

  Training efficiency
  (lower is better)
      |
      |  \
      |    \
      |      \
      |        \______________________________
      |         ^
      |         critical batch size
      |
      +-------------------------------------------> Batch Size

  Below critical: doubling batch nearly halves time-to-accuracy
  Above critical: doubling batch barely helps (wasted compute)

  Estimate critical batch size:
  B_crit = B_noise / B_simple

  Where B_noise = trace(gradient covariance) / ||mean gradient||^2
  This requires computing gradient statistics across multiple batches.
```

## Exercises

1. Run the batch size search on your model. Plot throughput vs batch size.
   Where is the knee of the curve?

2. Implement gradient accumulation with 4 micro-batches. Verify that the
   final gradients match a single forward/backward with 4x batch size
   (within floating point tolerance).

3. Implement a simple dynamic batcher for inference. Measure latency and
   throughput at various request rates. How does max_wait_ms affect the
   latency-throughput tradeoff?

4. Measure the impact of batch size on convergence. Train the same model
   with batch sizes 32, 128, and 512 (with linear scaling rule + warmup).
   Do they reach the same final accuracy? How many total samples does each
   see to converge?
