# Lesson 03: Building the Transformer

Now you build the brain. In this lesson, you implement a decoder-only
transformer from scratch in PyTorch — every component by hand. No
`nn.TransformerDecoder`. No shortcuts. Token embeddings, positional
encoding, multi-head self-attention, feed-forward networks, layer
normalization, residual connections — all of it.

For the theory behind each component, see
[Track 8 Lessons 05-08](../llms-transformers/05-self-attention.md).
This lesson is pure implementation.

---

## The Architecture

Our model is a GPT-style decoder-only transformer. It reads tokens
left-to-right and predicts the next token at each position.

```
Decoder-Only Transformer Architecture:

  Input Token IDs: [def, ·, fib, (, n, )]
       │
       ▼
  ┌─────────────────────────────────┐
  │  Token Embedding + Position     │
  │  Embedding                      │
  │  token_ids → vectors (d_model)  │
  └──────────────┬──────────────────┘
                 │
       ┌─────────┴─────────┐
       │  Transformer Block │ ×N_LAYERS
       │  ┌───────────────┐ │
       │  │ Layer Norm    │ │
       │  │ Multi-Head    │ │
       │  │ Self-Attention│ │
       │  │ + Residual    │ │
       │  ├───────────────┤ │
       │  │ Layer Norm    │ │
       │  │ Feed-Forward  │ │
       │  │ Network       │ │
       │  │ + Residual    │ │
       │  └───────────────┘ │
       └─────────┬─────────┘
                 │
       ┌─────────┴──────────┐
       │  Final Layer Norm   │
       │  Linear → vocab_size│
       │  (logits)           │
       └─────────────────────┘
                 │
                 ▼
  Output: probability over next token
```

---

## Component 1: Token and Position Embeddings

Every token ID becomes a vector. Every position gets its own vector.
We add them together.

```python
# model/transformer.py — Part 1: Embeddings

import torch
import torch.nn as nn
import torch.nn.functional as F
import math

from model.config import MiniLLMConfig


class TokenEmbedding(nn.Module):
    """Converts token IDs to dense vectors."""

    def __init__(self, config: MiniLLMConfig):
        super().__init__()
        self.embedding = nn.Embedding(config.vocab_size, config.d_model)
        self.d_model = config.d_model

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Scale embeddings by sqrt(d_model) — standard transformer practice
        # This keeps the embedding magnitudes in a reasonable range
        return self.embedding(x) * math.sqrt(self.d_model)


class PositionalEncoding(nn.Module):
    """Adds position information using learned embeddings."""

    def __init__(self, config: MiniLLMConfig):
        super().__init__()
        self.position_embedding = nn.Embedding(config.max_seq_len, config.d_model)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (batch_size, seq_len, d_model)
        seq_len = x.size(1)
        positions = torch.arange(seq_len, device=x.device).unsqueeze(0)  # (1, seq_len)
        x = x + self.position_embedding(positions)
        return self.dropout(x)
```

```
Embedding Process:

  Token IDs:    [  42,  107,  256,   89 ]
                  │      │      │      │
                  ▼      ▼      ▼      ▼
  Token Embed:  [v42]  [v107] [v256] [v89]   ← lookup in embedding table
       +           +      +      +      +
  Pos Embed:    [p0]   [p1]   [p2]   [p3]    ← lookup by position
       =           =      =      =      =
  Result:       [e0]   [e1]   [e2]   [e3]    ← combined vectors

  Each vector has d_model=512 dimensions
```

---

## Component 2: Multi-Head Self-Attention

This is the core of the transformer. Each token looks at all previous
tokens (but not future ones — that is the causal mask) and decides
what information to gather.

```python
# model/attention.py — Multi-Head Self-Attention

import torch
import torch.nn as nn
import torch.nn.functional as F
import math


class MultiHeadAttention(nn.Module):
    """Multi-head self-attention with causal masking."""

    def __init__(self, config):
        super().__init__()
        assert config.d_model % config.n_heads == 0, \
            f"d_model ({config.d_model}) must be divisible by n_heads ({config.n_heads})"

        self.n_heads = config.n_heads
        self.d_model = config.d_model
        self.head_dim = config.d_model // config.n_heads

        # Q, K, V projections — one big linear layer, then split
        self.qkv_proj = nn.Linear(config.d_model, 3 * config.d_model, bias=False)

        # Output projection
        self.out_proj = nn.Linear(config.d_model, config.d_model, bias=False)

        self.dropout = nn.Dropout(config.dropout)

        # Causal mask — registered as buffer (not a parameter)
        # Upper triangular matrix of -inf values
        mask = torch.triu(torch.ones(config.max_seq_len, config.max_seq_len), diagonal=1)
        mask = mask.masked_fill(mask == 1, float("-inf"))
        self.register_buffer("causal_mask", mask)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch_size, seq_len, d_model = x.shape

        # Project to Q, K, V
        qkv = self.qkv_proj(x)  # (B, T, 3*D)
        q, k, v = qkv.chunk(3, dim=-1)  # Each: (B, T, D)

        # Reshape for multi-head: (B, T, D) → (B, n_heads, T, head_dim)
        q = q.view(batch_size, seq_len, self.n_heads, self.head_dim).transpose(1, 2)
        k = k.view(batch_size, seq_len, self.n_heads, self.head_dim).transpose(1, 2)
        v = v.view(batch_size, seq_len, self.n_heads, self.head_dim).transpose(1, 2)

        # Scaled dot-product attention
        # scores = (Q @ K^T) / sqrt(head_dim)
        scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.head_dim)

        # Apply causal mask (prevent attending to future tokens)
        scores = scores + self.causal_mask[:seq_len, :seq_len]

        # Softmax and dropout
        attn_weights = F.softmax(scores, dim=-1)
        attn_weights = self.dropout(attn_weights)

        # Weighted sum of values
        attn_output = torch.matmul(attn_weights, v)  # (B, n_heads, T, head_dim)

        # Reshape back: (B, n_heads, T, head_dim) → (B, T, D)
        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, seq_len, d_model)

        # Output projection
        return self.out_proj(attn_output)
```

```
Multi-Head Attention — What Happens:

  Input: (batch=32, seq_len=256, d_model=512)
    │
    ├─→ Q projection ─→ (32, 256, 512) ─→ reshape ─→ (32, 8, 256, 64)
    ├─→ K projection ─→ (32, 256, 512) ─→ reshape ─→ (32, 8, 256, 64)
    └─→ V projection ─→ (32, 256, 512) ─→ reshape ─→ (32, 8, 256, 64)
                                                          │
                              Q @ K^T / sqrt(64)          │
                              ─────────────────           │
                              (32, 8, 256, 256)  ← scores │
                                      │                   │
                              + causal mask               │
                              softmax                     │
                                      │                   │
                              @ V ────┘                   │
                              (32, 8, 256, 64)            │
                                      │                   │
                              reshape → (32, 256, 512)    │
                              output projection           │
                                      │
                              Output: (32, 256, 512)

  Causal Mask (4×4 example):
  ┌─────────────────────┐
  │  0   -∞   -∞   -∞  │  Token 0 sees only itself
  │  0    0   -∞   -∞  │  Token 1 sees tokens 0-1
  │  0    0    0   -∞  │  Token 2 sees tokens 0-2
  │  0    0    0    0  │  Token 3 sees tokens 0-3
  └─────────────────────┘
```

---

## Component 3: Feed-Forward Network

After attention gathers information, the feed-forward network processes
it. Two linear layers with a GELU activation in between.

```python
# model/transformer.py — Part 2: Feed-Forward Network

class FeedForward(nn.Module):
    """Position-wise feed-forward network."""

    def __init__(self, config: MiniLLMConfig):
        super().__init__()
        self.fc1 = nn.Linear(config.d_model, config.d_ff)
        self.fc2 = nn.Linear(config.d_ff, config.d_model)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # (B, T, d_model) → (B, T, d_ff) → (B, T, d_model)
        x = self.fc1(x)
        x = F.gelu(x)
        x = self.dropout(x)
        x = self.fc2(x)
        return x
```

```
Feed-Forward Network:

  Input:  (B, T, 512)
     │
     ▼
  Linear: 512 → 2048    (expand)
     │
     ▼
  GELU activation        (non-linearity)
     │
     ▼
  Dropout
     │
     ▼
  Linear: 2048 → 512    (compress back)
     │
     ▼
  Output: (B, T, 512)

  Why GELU instead of ReLU?
  GELU is smoother — it does not have the hard
  cutoff at zero. Most modern transformers use it.
```

---

## Component 4: Transformer Block

One transformer block = layer norm + attention + residual + layer norm
+ feed-forward + residual. We use Pre-Norm (layer norm before each
sub-layer), which is more stable during training.

```python
# model/transformer.py — Part 3: Transformer Block

class TransformerBlock(nn.Module):
    """A single transformer block with pre-norm architecture."""

    def __init__(self, config: MiniLLMConfig):
        super().__init__()
        self.ln1 = nn.LayerNorm(config.d_model)
        self.attn = MultiHeadAttention(config)
        self.ln2 = nn.LayerNorm(config.d_model)
        self.ff = FeedForward(config)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Pre-norm attention with residual connection
        x = x + self.dropout(self.attn(self.ln1(x)))

        # Pre-norm feed-forward with residual connection
        x = x + self.dropout(self.ff(self.ln2(x)))

        return x
```

```
Transformer Block (Pre-Norm):

  Input x
    │
    ├──────────────────────┐
    │                      │ (residual)
    ▼                      │
  LayerNorm                │
    │                      │
    ▼                      │
  Multi-Head Attention     │
    │                      │
    ▼                      │
  Dropout                  │
    │                      │
    + ◄────────────────────┘
    │
    ├──────────────────────┐
    │                      │ (residual)
    ▼                      │
  LayerNorm                │
    │                      │
    ▼                      │
  Feed-Forward             │
    │                      │
    ▼                      │
  Dropout                  │
    │                      │
    + ◄────────────────────┘
    │
    ▼
  Output

  Why residual connections?
  They let gradients flow directly through the network.
  Without them, deep networks (6+ layers) are very hard to train.
```

---

## Component 5: The Complete Model

Stack everything together: embeddings → N transformer blocks → output.

```python
# model/transformer.py — Part 4: Complete Model

from model.attention import MultiHeadAttention


class MiniLLM(nn.Module):
    """A small decoder-only transformer language model."""

    def __init__(self, config: MiniLLMConfig):
        super().__init__()
        self.config = config

        # Embeddings
        self.token_embedding = TokenEmbedding(config)
        self.position_encoding = PositionalEncoding(config)

        # Transformer blocks
        self.blocks = nn.ModuleList([
            TransformerBlock(config) for _ in range(config.n_layers)
        ])

        # Output
        self.ln_final = nn.LayerNorm(config.d_model)
        self.output_proj = nn.Linear(config.d_model, config.vocab_size, bias=False)

        # Weight tying: share weights between token embedding and output projection
        # This is a common trick that reduces parameters and improves performance
        self.output_proj.weight = self.token_embedding.embedding.weight

        # Initialize weights
        self._init_weights()

    def _init_weights(self):
        """Initialize weights using Xavier/Glorot uniform."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
            elif isinstance(module, nn.Embedding):
                nn.init.normal_(module.weight, mean=0.0, std=0.02)
            elif isinstance(module, nn.LayerNorm):
                nn.init.ones_(module.weight)
                nn.init.zeros_(module.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.

        Args:
            x: Token IDs, shape (batch_size, seq_len)

        Returns:
            Logits over vocabulary, shape (batch_size, seq_len, vocab_size)
        """
        # Embeddings
        x = self.token_embedding(x)       # (B, T) → (B, T, D)
        x = self.position_encoding(x)     # (B, T, D) → (B, T, D)

        # Transformer blocks
        for block in self.blocks:
            x = block(x)                  # (B, T, D) → (B, T, D)

        # Output
        x = self.ln_final(x)             # (B, T, D) → (B, T, D)
        logits = self.output_proj(x)     # (B, T, D) → (B, T, vocab_size)

        return logits

    @torch.no_grad()
    def generate(self, token_ids: list[int], max_new_tokens: int = 100,
                 temperature: float = 0.8, top_k: int = 50) -> list[int]:
        """Generate new tokens autoregressively."""
        self.eval()
        device = next(self.parameters()).device
        tokens = torch.tensor([token_ids], dtype=torch.long, device=device)

        for _ in range(max_new_tokens):
            # Crop to max sequence length
            tokens_cropped = tokens[:, -self.config.max_seq_len:]

            # Forward pass
            logits = self(tokens_cropped)

            # Get logits for the last position
            logits = logits[:, -1, :] / temperature

            # Top-k filtering
            if top_k > 0:
                top_k_values, _ = torch.topk(logits, top_k)
                min_top_k = top_k_values[:, -1].unsqueeze(-1)
                logits[logits < min_top_k] = float("-inf")

            # Sample from the distribution
            probs = F.softmax(logits, dim=-1)
            next_token = torch.multinomial(probs, num_samples=1)

            # Append to sequence
            tokens = torch.cat([tokens, next_token], dim=1)

        return tokens[0].tolist()
```

---

## Verification: Does It Work?

Before training, verify the model runs and produces the right shapes:

```python
# test_model.py — Smoke test

from model.config import MiniLLMConfig
from model.transformer import MiniLLM

config = MiniLLMConfig()
model = MiniLLM(config)

# Count parameters
total_params = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"Total parameters: {total_params:,}")
print(f"Trainable parameters: {trainable_params:,}")

# Test forward pass
import torch
batch = torch.randint(0, config.vocab_size, (2, 128))  # 2 sequences, 128 tokens
logits = model(batch)
print(f"Input shape:  {batch.shape}")
print(f"Output shape: {logits.shape}")
assert logits.shape == (2, 128, config.vocab_size)
print("Forward pass: OK")

# Test generation (random weights — output will be garbage, but shapes should work)
generated = model.generate([100, 200, 300], max_new_tokens=10)
print(f"Generated {len(generated)} tokens: {generated}")
print("Generation: OK")
```

```
Expected Output:

  Total parameters: 14,943,232
  Trainable parameters: 14,943,232
  Input shape:  torch.Size([2, 128])
  Output shape: torch.Size([2, 128, 8192])
  Forward pass: OK
  Generated 13 tokens: [100, 200, 300, 4521, 7832, ...]
  Generation: OK
```

---

## Exercises

### Exercise 1: Build and Test

Implement all five components in the files shown above. Run the smoke
test. Verify parameter count matches the config estimate.

### Exercise 2: Trace the Shapes

Add print statements inside each component's `forward` method to trace
tensor shapes through the entire model. Draw the shape at each step
for a batch of (4, 64) — 4 sequences of 64 tokens.

### Exercise 3: Attention Visualization

Modify `MultiHeadAttention` to optionally return attention weights.
Feed in a short sequence and visualize the attention pattern for each
head using matplotlib. What does the causal mask look like in practice?

```python
# Hint: return attn_weights alongside attn_output
# Then plot with:
import matplotlib.pyplot as plt
fig, axes = plt.subplots(2, 4, figsize=(16, 8))
for i, ax in enumerate(axes.flat):
    ax.imshow(attn_weights[0, i].detach().cpu(), cmap="viridis")
    ax.set_title(f"Head {i}")
plt.tight_layout()
plt.savefig("attention_patterns.png")
```

---

Next: [Lesson 04: The Training Loop](./04-training-loop.md)
