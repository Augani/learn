# Lesson 07: Custom Architectures

> **Analogy**: Building a custom neural network architecture is like
> designing a building. You can use standard floor plans (ResNet,
> ViT) or design something bespoke. Either way, the laws of physics
> (linear algebra, gradient flow) still apply. The fanciest design
> in the world collapses if the foundation is wrong.

---

## When You Need Custom Architectures

Most of the time, you don't. A pretrained ViT or ResNet with a
task-specific head handles the majority of problems. You need
custom architectures when:

- A paper introduces a new attention mechanism you want to try
- Your data has structure that standard architectures don't exploit
  (graphs, 3D point clouds, irregular time series)
- You need to meet strict latency or memory constraints
- You're combining modalities in a novel way
- You're doing architecture research

```
Decision tree:

  Does a standard architecture work?
       |
   Yes-+--No
   |       |
   Use it  Does a minor modification work?
            |
        Yes-+--No
        |       |
      Modify   Build custom
```

---

## Custom Layers in PyTorch

Every custom architecture is built from custom layers. A PyTorch
layer is just a class that inherits from `nn.Module` and implements
`forward()`.

### The nn.Module Contract

```python
import torch
import torch.nn as nn

class CustomLayer(nn.Module):
    def __init__(self, in_features, out_features):
        super().__init__()
        self.weight = nn.Parameter(torch.randn(out_features, in_features))
        self.bias = nn.Parameter(torch.zeros(out_features))

    def forward(self, x):
        return x @ self.weight.T + self.bias
```

Rules:
1. All learnable parameters go in `__init__` as `nn.Parameter` or
   via other `nn.Module` submodules
2. `forward()` defines the computation
3. Don't store tensors as plain attributes -- they won't move to
   GPU with `.to(device)`

```
Common mistake:

  class Bad(nn.Module):
      def __init__(self):
          super().__init__()
          self.mask = torch.ones(10, 10)     # NOT a parameter
                                              # Won't move to GPU!

  class Good(nn.Module):
      def __init__(self):
          super().__init__()
          self.register_buffer("mask", torch.ones(10, 10))  # Moves with model
```

---

## Attention Variants

Attention is the most customized component in modern ML. Every
other week, someone publishes a new variant. Here's how to
implement any of them.

### Standard Multi-Head Attention (Reference)

```python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads, dropout=0.0):
        super().__init__()
        assert d_model % num_heads == 0

        self.d_model = d_model
        self.num_heads = num_heads
        self.head_dim = d_model // num_heads

        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, query, key, value, mask=None):
        batch_size = query.size(0)

        Q = self.W_q(query).view(batch_size, -1, self.num_heads, self.head_dim).transpose(1, 2)
        K = self.W_k(key).view(batch_size, -1, self.num_heads, self.head_dim).transpose(1, 2)
        V = self.W_v(value).view(batch_size, -1, self.num_heads, self.head_dim).transpose(1, 2)

        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.head_dim ** 0.5)

        if mask is not None:
            scores = scores.masked_fill(mask == 0, float("-inf"))

        attn_weights = torch.softmax(scores, dim=-1)
        attn_weights = self.dropout(attn_weights)

        context = torch.matmul(attn_weights, V)
        context = context.transpose(1, 2).contiguous().view(batch_size, -1, self.d_model)

        return self.W_o(context)
```

```
Shape flow through multi-head attention:

  Input query:  (B, Seq, D)
       |
  W_q linear:   (B, Seq, D)
       |
  Reshape:      (B, Seq, H, D/H)
       |
  Transpose:    (B, H, Seq, D/H)     <-- heads become batch-like
       |
  Q @ K^T:      (B, H, Seq, Seq)     <-- attention scores
       |
  Softmax:      (B, H, Seq, Seq)     <-- attention weights
       |
  @ V:          (B, H, Seq, D/H)     <-- weighted values
       |
  Transpose:    (B, Seq, H, D/H)
       |
  Reshape:      (B, Seq, D)          <-- concatenated heads
       |
  W_o linear:   (B, Seq, D)          <-- output projection
```

### Grouped Query Attention (GQA)

Used in Llama 2 and other efficient models. Shares K and V across
groups of query heads, reducing memory for KV cache.

```python
class GroupedQueryAttention(nn.Module):
    def __init__(self, d_model, num_heads, num_kv_heads, dropout=0.0):
        super().__init__()
        assert num_heads % num_kv_heads == 0

        self.num_heads = num_heads
        self.num_kv_heads = num_kv_heads
        self.num_groups = num_heads // num_kv_heads
        self.head_dim = d_model // num_heads

        self.W_q = nn.Linear(d_model, num_heads * self.head_dim, bias=False)
        self.W_k = nn.Linear(d_model, num_kv_heads * self.head_dim, bias=False)
        self.W_v = nn.Linear(d_model, num_kv_heads * self.head_dim, bias=False)
        self.W_o = nn.Linear(num_heads * self.head_dim, d_model, bias=False)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, mask=None):
        B, S, _ = x.shape

        Q = self.W_q(x).view(B, S, self.num_heads, self.head_dim).transpose(1, 2)
        K = self.W_k(x).view(B, S, self.num_kv_heads, self.head_dim).transpose(1, 2)
        V = self.W_v(x).view(B, S, self.num_kv_heads, self.head_dim).transpose(1, 2)

        K = K.unsqueeze(2).expand(-1, -1, self.num_groups, -1, -1)
        K = K.reshape(B, self.num_heads, S, self.head_dim)
        V = V.unsqueeze(2).expand(-1, -1, self.num_groups, -1, -1)
        V = V.reshape(B, self.num_heads, S, self.head_dim)

        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.head_dim ** 0.5)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float("-inf"))
        attn = torch.softmax(scores, dim=-1)
        attn = self.dropout(attn)

        out = torch.matmul(attn, V)
        out = out.transpose(1, 2).contiguous().view(B, S, -1)
        return self.W_o(out)
```

```
MHA vs GQA memory comparison (during inference):

  MHA:  num_heads=32, d_head=128
        KV cache per layer: 2 * 32 * 128 * seq_len * 2 bytes
        = 16384 * seq_len bytes

  GQA:  num_heads=32, num_kv_heads=8, d_head=128
        KV cache per layer: 2 * 8 * 128 * seq_len * 2 bytes
        = 4096 * seq_len bytes

  4x memory savings for KV cache!
```

### Sliding Window Attention

For very long sequences, limit attention to a local window.
Reduces quadratic complexity to linear.

```python
class SlidingWindowAttention(nn.Module):
    def __init__(self, d_model, num_heads, window_size, dropout=0.0):
        super().__init__()
        self.window_size = window_size
        self.num_heads = num_heads
        self.head_dim = d_model // num_heads

        self.W_qkv = nn.Linear(d_model, 3 * d_model)
        self.W_o = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        B, S, D = x.shape
        qkv = self.W_qkv(x).view(B, S, 3, self.num_heads, self.head_dim)
        Q, K, V = qkv.unbind(dim=2)
        Q = Q.transpose(1, 2)
        K = K.transpose(1, 2)
        V = V.transpose(1, 2)

        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.head_dim ** 0.5)

        window_mask = torch.ones(S, S, device=x.device, dtype=torch.bool)
        for i in range(S):
            start = max(0, i - self.window_size // 2)
            end = min(S, i + self.window_size // 2 + 1)
            window_mask[i, :start] = False
            window_mask[i, end:] = False

        scores = scores.masked_fill(~window_mask.unsqueeze(0).unsqueeze(0), float("-inf"))
        attn = torch.softmax(scores, dim=-1)
        attn = self.dropout(attn)

        out = torch.matmul(attn, V)
        out = out.transpose(1, 2).contiguous().view(B, S, D)
        return self.W_o(out)
```

---

## Positional Encodings

Transformers are permutation-invariant without positional info.
Different tasks need different position encodings.

### Sinusoidal (Fixed)

```python
class SinusoidalPositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=5000):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len).unsqueeze(1).float()
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x):
        return x + self.pe[:, :x.size(1)]
```

### Rotary Position Embedding (RoPE)

Used in Llama, GPT-NeoX, and most modern LLMs. Encodes position
by rotating query and key vectors.

```python
class RotaryPositionalEmbedding(nn.Module):
    def __init__(self, head_dim, max_len=8192, base=10000.0):
        super().__init__()
        inv_freq = 1.0 / (base ** (torch.arange(0, head_dim, 2).float() / head_dim))
        self.register_buffer("inv_freq", inv_freq)

        t = torch.arange(max_len).float()
        freqs = torch.outer(t, inv_freq)
        emb = torch.cat([freqs, freqs], dim=-1)
        self.register_buffer("cos_cached", emb.cos().unsqueeze(0).unsqueeze(0))
        self.register_buffer("sin_cached", emb.sin().unsqueeze(0).unsqueeze(0))

    def forward(self, q, k, seq_len):
        cos = self.cos_cached[:, :, :seq_len, :]
        sin = self.sin_cached[:, :, :seq_len, :]
        q_embed = (q * cos) + (self._rotate_half(q) * sin)
        k_embed = (k * cos) + (self._rotate_half(k) * sin)
        return q_embed, k_embed

    def _rotate_half(self, x):
        x1, x2 = x.chunk(2, dim=-1)
        return torch.cat([-x2, x1], dim=-1)
```

```
RoPE intuition:

  Position is encoded by rotating vectors in 2D subspaces.
  q at position m and k at position n:
    The attention score q^T k depends on (m - n), the relative position.
    No matter where in the sequence, the same relative distance
    gives the same attention bias.

  This is why RoPE generalizes to longer sequences than training length.
```

---

## Debugging Shape Mismatches

The most common implementation bug. Here's a systematic approach.

### The Shape Assertion Pattern

```python
def assert_shape(tensor, expected, name=""):
    actual = tuple(tensor.shape)
    if actual != expected:
        raise ValueError(
            f"Shape mismatch in {name}: expected {expected}, got {actual}"
        )

class DebuggedBlock(nn.Module):
    def forward(self, x):
        B, S, D = x.shape
        assert_shape(x, (B, S, D), "input")

        attn_out = self.attention(x)
        assert_shape(attn_out, (B, S, D), "after attention")

        x = x + attn_out
        ffn_out = self.ffn(x)
        assert_shape(ffn_out, (B, S, D), "after FFN")

        return x + ffn_out
```

### Common Shape Bugs

```
+-------------------------------+-----------------------------------+
| Symptom                       | Likely Cause                      |
+-------------------------------+-----------------------------------+
| (B, S, D) becomes (B, D, S)  | Missing or wrong transpose        |
| (B, H, S, d) becomes (B*H,..)| view() vs reshape() difference    |
| Dimension mismatch in matmul  | Forgot to transpose K in QK^T    |
| Off-by-one in sequence dim    | Padding/CLS token not accounted   |
| D doesn't divide evenly by H  | head_dim = D // H has remainder   |
+-------------------------------+-----------------------------------+
```

### The Shape Tracing Decorator

```python
import functools

def trace_shapes(method):
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        input_shapes = [a.shape for a in args if isinstance(a, torch.Tensor)]
        result = method(self, *args, **kwargs)
        if isinstance(result, torch.Tensor):
            output_shape = result.shape
        elif isinstance(result, tuple):
            output_shape = [r.shape for r in result if isinstance(r, torch.Tensor)]
        else:
            output_shape = type(result)
        print(f"{self.__class__.__name__}.{method.__name__}: "
              f"{input_shapes} -> {output_shape}")
        return result
    return wrapper
```

---

## Building a Complete Custom Architecture

Let's build a small custom transformer with all the pieces.

```python
class CustomTransformerBlock(nn.Module):
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.norm1 = nn.LayerNorm(d_model)
        self.attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.norm2 = nn.LayerNorm(d_model)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),
            nn.Dropout(dropout),
        )

    def forward(self, x, mask=None):
        x = x + self.attn(self.norm1(x), self.norm1(x), self.norm1(x), mask)
        x = x + self.ffn(self.norm2(x))
        return x


class CustomTransformer(nn.Module):
    def __init__(self, vocab_size, d_model, num_heads, d_ff,
                 num_layers, max_len, num_classes, dropout=0.1):
        super().__init__()
        self.token_embed = nn.Embedding(vocab_size, d_model)
        self.pos_embed = SinusoidalPositionalEncoding(d_model, max_len)
        self.blocks = nn.ModuleList([
            CustomTransformerBlock(d_model, num_heads, d_ff, dropout)
            for _ in range(num_layers)
        ])
        self.norm = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, num_classes)
        self.dropout = nn.Dropout(dropout)

    def forward(self, input_ids, mask=None):
        x = self.token_embed(input_ids)
        x = self.pos_embed(x)
        x = self.dropout(x)

        for block in self.blocks:
            x = block(x, mask)

        x = self.norm(x)
        cls_output = x[:, 0]
        return self.head(cls_output)
```

---

## Architecture Validation Checklist

Before training, verify:

```
[ ] Parameter count matches expectation
[ ] Forward pass works with dummy input
[ ] Backward pass produces gradients for all parameters
[ ] Output shape is correct for all input sizes
[ ] No parameters left on CPU when model is on GPU
[ ] No buffers missing from state_dict
[ ] Model can be saved and loaded correctly
```

```python
def validate_architecture(model, sample_input, device="cpu"):
    model = model.to(device)
    sample_input = sample_input.to(device)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Total params: {total_params:,}")
    print(f"Trainable params: {trainable_params:,}")

    output = model(sample_input)
    print(f"Output shape: {output.shape}")

    loss = output.sum()
    loss.backward()
    for name, param in model.named_parameters():
        if param.requires_grad and param.grad is None:
            print(f"WARNING: {name} has no gradient!")

    state_dict = model.state_dict()
    model2 = type(model)(**model_config)
    model2.load_state_dict(state_dict)
    output2 = model2(sample_input)
    assert torch.allclose(output, output2, atol=1e-6), "Save/load mismatch!"
    print("All checks passed")
```

---

## Practical Exercise

Implement a vision transformer (ViT) from scratch:

1. Patch embedding layer (split image into patches, linear project)
2. CLS token and positional embeddings
3. Transformer encoder blocks
4. Classification head

Test it on CIFAR-10 with:
- Image size: 32x32
- Patch size: 4x4 (64 patches)
- d_model: 256
- num_heads: 8
- num_layers: 6

Verify that your parameter count matches the expected calculation.

---

## Key Takeaways

- Use standard architectures unless you have a clear reason not to
- Every custom layer follows the nn.Module pattern: `__init__` for
  parameters, `forward` for computation
- Use `register_buffer` for non-learned tensors that must move with
  the model
- Attention variants (GQA, sliding window) trade off capability for
  efficiency
- RoPE is now the default positional encoding for LLMs
- Debug shapes systematically: add assertions, trace through the
  forward pass, check parameter counts

Next lesson: the loss function is often the most impactful thing
you can customize.
