# 03 - Memory Optimization

## The Analogy

You're packing for a trip, but your suitcase is too small. You have options:

1. **Roll your clothes tighter** (mixed precision -- same items, less space)
2. **Wear some items on the plane** (gradient checkpointing -- recompute instead of store)
3. **Ship some items ahead** (offloading -- use CPU memory as overflow)
4. **Leave stuff you don't need** (in-place operations, clearing caches)

Each technique trades something -- time, complexity, precision -- for memory
savings. The skill is knowing which trades are worth making.

```
  MEMORY OPTIMIZATION DECISION TREE

                  Out of memory?
                       |
              +--------+--------+
              |                 |
         Try mixed          Still OOM?
         precision              |
         (fp16/bf16)    +-------+-------+
                        |               |
                  Try gradient     Still OOM?
                  checkpointing         |
                                 +------+------+
                                 |             |
                           Try memory     Still OOM?
                           efficient           |
                           attention     Reduce batch
                                         size or
                                         offload to CPU
```

## Mixed Precision Training

The biggest bang-for-your-buck memory optimization. Instead of using 32-bit
floats everywhere, use 16-bit floats for most operations and 32-bit only
where numerical precision matters.

### Why It Works

```
  FLOAT FORMATS

  FP32 (float32):  1 sign + 8 exponent + 23 mantissa = 32 bits = 4 bytes
  FP16 (float16):  1 sign + 5 exponent + 10 mantissa = 16 bits = 2 bytes
  BF16 (bfloat16): 1 sign + 8 exponent + 7 mantissa  = 16 bits = 2 bytes
  FP8  (float8):   1 sign + 4 exponent + 3 mantissa  = 8 bits  = 1 byte

  Memory savings:
  FP32 -> FP16/BF16: 2x reduction
  FP32 -> FP8:       4x reduction

  BF16 vs FP16:
  - BF16 has same range as FP32 (8 exponent bits) but less precision
  - FP16 has more precision but smaller range (can overflow/underflow)
  - BF16 is almost always preferred for training because range matters
    more than precision for gradients
```

### Automatic Mixed Precision (AMP)

PyTorch's AMP automatically casts operations to fp16/bf16 where safe and
keeps fp32 where precision matters (like loss computation and weight updates).

```python
from torch.cuda.amp import autocast, GradScaler

scaler = GradScaler()

for inputs, targets in dataloader:
    inputs, targets = inputs.cuda(), targets.cuda()
    optimizer.zero_grad()

    with autocast(dtype=torch.bfloat16):
        outputs = model(inputs)
        loss = criterion(outputs, targets)

    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
```

What happens under the hood:

```
  WITHOUT AMP:
  All operations in fp32

  inputs (fp32) -> linear (fp32) -> relu (fp32) -> linear (fp32) -> loss (fp32)
  4 bytes/element everywhere

  WITH AMP (bf16):
  inputs (fp32) -> cast -> linear (bf16) -> relu (bf16) -> linear (bf16)
                   -> cast -> loss (fp32)
  2 bytes/element for most activations

  Memory for activations: roughly halved
  Compute speed: roughly doubled (tensor cores operate on fp16/bf16)
```

### The GradScaler: Why FP16 Needs It

FP16 has a limited range. Small gradient values (common in deep networks) can
underflow to zero. The GradScaler multiplies the loss by a large factor before
backward, then divides the gradients before the optimizer step. This keeps
small gradients representable in fp16.

```
  GRAD SCALING

  Without scaling:
  loss = 0.001
  gradient for deep layer = 0.0000001 -> FP16 underflow -> 0.0

  With scaling (scale_factor = 1024):
  scaled_loss = 0.001 * 1024 = 1.024
  scaled_gradient = 0.0000001 * 1024 = 0.0001024 -> representable in FP16
  unscaled_gradient = 0.0001024 / 1024 = 0.0000001 -> correct value for update
```

BF16 has the same exponent range as FP32, so it rarely needs grad scaling.
This is why bf16 is simpler to use and preferred on hardware that supports it
(A100, H100, and newer).

### FP8 Training

FP8 is the frontier. NVIDIA H100 and newer GPUs have FP8 tensor cores that
are 2x faster than FP16. The challenge is that 8 bits provide very little
precision, so training requires careful scaling per tensor.

```python
import transformer_engine.pytorch as te

model = te.Linear(1024, 1024, bias=True)

with te.fp8_autocast(enabled=True):
    output = model(input_tensor)
```

NVIDIA's Transformer Engine handles per-tensor scaling automatically. FP8
is production-ready for transformer training on H100+ hardware.

## Gradient Checkpointing

During the forward pass, PyTorch saves intermediate activations so it can
compute gradients during the backward pass. For deep networks, these saved
activations dominate memory usage.

Gradient checkpointing trades memory for compute: instead of saving all
activations, save only a few "checkpoints" and recompute the rest during
backward.

```
  WITHOUT CHECKPOINTING (12-layer model):

  Forward: save all activations
  +---+---+---+---+---+---+---+---+---+---+---+---+
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |10 |11 |12 |  <- all in memory
  +---+---+---+---+---+---+---+---+---+---+---+---+
  Memory: O(n) where n = number of layers

  WITH CHECKPOINTING (save every 4th layer):

  Forward: save only checkpoints
  +---+   +   +   +---+   +   +   +---+   +   +   +---+
  | 1 |   .   .   | 4 |   .   .   | 8 |   .   .   |12 |
  +---+   +   +   +---+   +   +   +---+   +   +   +---+
   ^                ^                ^                ^
   checkpoint       checkpoint       checkpoint       checkpoint

  Backward: recompute from last checkpoint
  Need grads for layer 10? Recompute forward from checkpoint 8:
  8 -> 9 -> 10 (recomputed), then compute gradient for 10

  Memory: O(sqrt(n)) checkpoints + O(sqrt(n)) recomputed activations
  Compute: ~33% more (one extra forward pass through each segment)
```

### Implementation in PyTorch

```python
from torch.utils.checkpoint import checkpoint, checkpoint_sequential

class TransformerBlock(nn.Module):
    def __init__(self, dim, heads):
        super().__init__()
        self.attn = nn.MultiheadAttention(dim, heads)
        self.ffn = nn.Sequential(
            nn.Linear(dim, dim * 4),
            nn.GELU(),
            nn.Linear(dim * 4, dim),
        )
        self.norm1 = nn.LayerNorm(dim)
        self.norm2 = nn.LayerNorm(dim)

    def forward(self, x):
        x = x + self.attn(self.norm1(x), self.norm1(x), self.norm1(x))[0]
        x = x + self.ffn(self.norm2(x))
        return x

class CheckpointedTransformer(nn.Module):
    def __init__(self, dim, heads, num_layers):
        super().__init__()
        self.layers = nn.ModuleList([
            TransformerBlock(dim, heads) for _ in range(num_layers)
        ])

    def forward(self, x):
        for layer in self.layers:
            x = checkpoint(layer, x, use_reentrant=False)
        return x
```

The `use_reentrant=False` flag is important. The older reentrant implementation
has subtle bugs with certain autograd patterns. Always use the non-reentrant
version.

### Selective Checkpointing

You don't have to checkpoint every layer. The optimal strategy depends on
memory pressure:

```python
class SelectiveCheckpointTransformer(nn.Module):
    def __init__(self, dim, heads, num_layers, checkpoint_every=2):
        super().__init__()
        self.layers = nn.ModuleList([
            TransformerBlock(dim, heads) for _ in range(num_layers)
        ])
        self.checkpoint_every = checkpoint_every

    def forward(self, x):
        for idx, layer in enumerate(self.layers):
            if idx % self.checkpoint_every == 0:
                x = checkpoint(layer, x, use_reentrant=False)
            else:
                x = layer(x)
        return x
```

Checkpoint the layers with the largest activations first (typically attention
layers with long sequences).

## Memory-Efficient Attention

Standard attention computes the full N x N attention matrix, where N is
sequence length. For N=8192, that's 256MB in fp32 -- per head, per layer.

```
  STANDARD ATTENTION MEMORY

  Q, K, V: (batch, heads, seq_len, head_dim)
  Attention matrix: (batch, heads, seq_len, seq_len)

  For batch=8, heads=32, seq_len=8192:
  Attention matrix = 8 * 32 * 8192 * 8192 * 4 bytes = 64 GB
  (This is why naive attention OOMs on long sequences)
```

### Flash Attention

Flash Attention (Tri Dao, 2022) computes exact attention without materializing
the full attention matrix. It processes the attention in tiles, keeping only
running statistics in fast shared memory.

```python
from torch.nn.functional import scaled_dot_product_attention

output = scaled_dot_product_attention(query, key, value, is_causal=True)
```

PyTorch 2.0+ automatically dispatches to FlashAttention when available. You
get it for free with `scaled_dot_product_attention`.

```
  FLASH ATTENTION MEMORY

  Standard:  O(N^2) for the attention matrix
  Flash:     O(N) -- only stores partial sums in shared memory

  For seq_len=8192:
  Standard: 256 MB per head per batch element
  Flash:    ~few KB per head per batch element (tile size)

  Speed is also better because Flash Attention is IO-aware:
  it minimizes reads/writes to slow global memory.
```

### Memory-Efficient Attention Variants

```python
output = scaled_dot_product_attention(
    query, key, value,
    attn_mask=None,
    dropout_p=0.0,
    is_causal=True,
    scale=None,
)
```

PyTorch picks the best backend automatically:
- **FlashAttention**: fastest, requires specific GPU (Ampere+), no custom mask
- **Memory-efficient attention** (xFormers): broader GPU support, custom masks
- **Math fallback**: standard implementation, any GPU, full mask support

Check which backend is being used:
```python
from torch.backends.cuda import (
    flash_sdp_enabled,
    mem_efficient_sdp_enabled,
    math_sdp_enabled,
)
print(f"Flash: {flash_sdp_enabled()}")
print(f"MemEfficient: {mem_efficient_sdp_enabled()}")
print(f"Math: {math_sdp_enabled()}")
```

## In-Place Operations

In-place operations modify tensors without allocating new memory. Use them
carefully -- they can break autograd if used on tensors that need gradients.

```python
x = torch.randn(1000, 1000, device='cuda')

y = x + 1
x.add_(1)

y = torch.relu(x)
torch.relu_(x)
x = torch.nn.functional.relu(x, inplace=True)
```

Safe places for in-place operations:
- Activation functions in the forward pass (ReLU, GELU inplace variants)
- Operations on tensors you won't need again
- `optimizer.zero_grad(set_to_none=True)` instead of `zero_grad()` -- sets
  gradients to None instead of zeroing, saving memory

```python
optimizer.zero_grad(set_to_none=True)
```

This single change can reduce peak memory by the size of all gradients during
the forward pass (because gradients don't exist as zero tensors).

## Clearing Caches and Freeing Memory

```python
del output, loss
torch.cuda.empty_cache()
```

`del` removes the Python reference. If no other references exist, PyTorch's
allocator marks the memory as free (but keeps it in the cache).
`torch.cuda.empty_cache()` returns cached memory back to CUDA.

```
  MEMORY FLOW

  Tensor alive:     [PyTorch allocator] -> [Tensor data in VRAM]
  After del:        [PyTorch allocator] -> [Free block in cache]
  After empty_cache:[Free CUDA memory -- available for any allocation]

  Don't call empty_cache() in a tight loop -- it forces CUDA
  synchronization and causes the allocator to re-request memory
  from CUDA on the next allocation, which is slow.
```

### Garbage Collection

Python's garbage collector can delay freeing GPU tensors. In memory-tight
situations, force collection:

```python
import gc

del large_tensor
gc.collect()
torch.cuda.empty_cache()
```

## Handling OOM

When you hit an OOM error, here's the systematic approach:

### Step 1: Know Your Budget

```python
total_memory = torch.cuda.get_device_properties(0).total_mem / 1024**3
print(f"Total GPU memory: {total_memory:.1f} GB")
```

### Step 2: Apply Optimizations in Order

```
  OOM RECOVERY CHECKLIST (in order of effort/impact)

  1. [ ] Enable mixed precision (bf16/fp16)        -> saves ~50% memory
  2. [ ] Use set_to_none=True in zero_grad          -> saves gradient memory
  3. [ ] Use Flash Attention                        -> saves O(N^2) attention mem
  4. [ ] Enable gradient checkpointing              -> saves activation memory
  5. [ ] Reduce batch size (use grad accumulation)  -> linear memory reduction
  6. [ ] Offload optimizer states to CPU             -> saves 2-3x params memory
  7. [ ] Use 8-bit optimizers (bitsandbytes)        -> saves optimizer memory
  8. [ ] Use model parallelism (split across GPUs)  -> access more memory
```

### Step 3: 8-Bit Optimizers

The `bitsandbytes` library provides 8-bit Adam that uses 4x less memory for
optimizer states:

```python
import bitsandbytes as bnb

optimizer = bnb.optim.Adam8bit(model.parameters(), lr=1e-4)
```

Adam normally stores 2 fp32 states per parameter (momentum and variance).
For a 7B parameter model, that's 56GB. 8-bit Adam reduces this to 14GB.

### Step 4: CPU Offloading

When GPU memory is exhausted, offload optimizer states or even model layers
to CPU memory:

```python
from deepspeed.ops.adam import DeepSpeedCPUAdam

optimizer = DeepSpeedCPUAdam(model.parameters(), lr=1e-4)
```

This keeps optimizer states in CPU memory and transfers them to GPU only
during the optimizer step. The tradeoff is slower optimizer steps due to
PCIe transfers.

## Putting It All Together

Here's a training loop with all major memory optimizations applied:

```python
import torch
from torch.cuda.amp import autocast, GradScaler
from torch.utils.checkpoint import checkpoint

model = build_model().cuda()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
scaler = GradScaler()

gradient_accumulation_steps = 4
effective_batch_size = 32
micro_batch_size = effective_batch_size // gradient_accumulation_steps

for epoch in range(num_epochs):
    for step, (inputs, targets) in enumerate(dataloader):
        inputs, targets = inputs.cuda(), targets.cuda()

        with autocast(dtype=torch.bfloat16):
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss = loss / gradient_accumulation_steps

        scaler.scale(loss).backward()

        if (step + 1) % gradient_accumulation_steps == 0:
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad(set_to_none=True)
```

## Exercises

1. Measure peak memory with and without mixed precision (bf16). What's the
   actual reduction? Is it close to the theoretical 2x?

2. Enable gradient checkpointing on a 12-layer transformer. How much memory
   does it save? How much slower is each training step?

3. Compare `optimizer.zero_grad()` vs `optimizer.zero_grad(set_to_none=True)`.
   Log memory after each. What's the difference?

4. Implement gradient accumulation with micro-batches. Verify that the
   gradients match a single large batch (within floating point tolerance).
