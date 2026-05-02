# Lesson 07: The Full Transformer Architecture — Putting It All Together

This is the lesson where everything comes together. You understand attention
(Lesson 04), self-attention (Lesson 05), and multi-head attention (Lesson 06).
Now we assemble them into the full transformer: the architecture from the
2017 paper "Attention Is All You Need" that powers every modern LLM.

---

## The Architecture at a Glance

The original transformer was designed for machine translation (English to
French). It has an encoder (reads the input) and a decoder (writes the output).

```
                    THE TRANSFORMER

 ┌─────────────────────────────────────────────────┐
 │                                                 │
 │   INPUT                          OUTPUT         │
 │  (English)                      (French)        │
 │     │                              ↑            │
 │     ↓                              │            │
 │  ┌──────────┐              ┌──────────────┐     │
 │  │ Input    │              │   Output     │     │
 │  │ Embedding│              │   Embedding  │     │
 │  │ +        │              │   +          │     │
 │  │ Positional│             │   Positional │     │
 │  │ Encoding │              │   Encoding   │     │
 │  └────┬─────┘              └──────┬───────┘     │
 │       │                           │             │
 │       ↓                           ↓             │
 │  ┌─────────┐               ┌───────────┐       │
 │  │         │               │           │       │
 │  │ ENCODER │ ────────────→ │  DECODER  │       │
 │  │         │  (cross-attn) │           │       │
 │  │  x 6    │               │   x 6     │       │
 │  │ layers  │               │  layers   │       │
 │  │         │               │           │       │
 │  └─────────┘               └─────┬─────┘       │
 │                                  │              │
 │                                  ↓              │
 │                           ┌────────────┐        │
 │                           │   Linear   │        │
 │                           │   +        │        │
 │                           │   Softmax  │        │
 │                           └──────┬─────┘        │
 │                                  │              │
 │                                  ↓              │
 │                            Next word             │
 │                           probabilities          │
 └─────────────────────────────────────────────────┘
```

---

## One Encoder Layer (In Detail)

Each encoder layer has TWO sub-components:
1. Multi-head self-attention
2. Position-wise feed-forward network

Each sub-component is wrapped with a residual connection and layer normalization.

```
ONE ENCODER LAYER:

    Input x
      │
      ├───────────────────────┐
      ↓                       │  Residual connection
  ┌────────────────────┐      │  (skip connection)
  │  Multi-Head        │      │
  │  Self-Attention    │      │
  └────────┬───────────┘      │
           ↓                  │
       Add (x + attn_out) ←───┘
           │
           ↓
     Layer Norm
           │
           ├───────────────────────┐
           ↓                       │  Residual connection
  ┌────────────────────┐           │
  │  Feed-Forward      │           │
  │  Network (FFN)     │           │
  └────────┬───────────┘           │
           ↓                       │
       Add (norm_out + ffn_out) ←──┘
           │
           ↓
     Layer Norm
           │
           ↓
      Output (same shape as input)
```

This block is repeated 6 times in the original transformer. Modern models
use 12, 24, 32, or even 96 layers.

---

## One Decoder Layer (In Detail)

Each decoder layer has THREE sub-components:
1. Masked multi-head self-attention (can only see previous tokens)
2. Multi-head cross-attention (attends to encoder output)
3. Position-wise feed-forward network

```
ONE DECODER LAYER:

    Input y (previous decoder output or target embedding)
      │
      ├──────────────────────────┐
      ↓                          │  Residual
  ┌─────────────────────────┐    │
  │  MASKED Multi-Head      │    │
  │  Self-Attention         │    │
  │  (can't see future)     │    │
  └──────────┬──────────────┘    │
             ↓                   │
         Add (y + masked_out) ←──┘
             │
             ↓
       Layer Norm
             │
             ├──────────────────────────┐
             ↓                          │  Residual
  ┌─────────────────────────┐           │
  │  Multi-Head             │           │
  │  Cross-Attention        │ ← Q from decoder
  │  (attends to encoder)   │ ← K, V from encoder output
  └──────────┬──────────────┘           │
             ↓                          │
         Add (norm + cross_out) ←───────┘
             │
             ↓
       Layer Norm
             │
             ├──────────────────────────┐
             ↓                          │  Residual
  ┌─────────────────────────┐           │
  │  Feed-Forward           │           │
  │  Network (FFN)          │           │
  └──────────┬──────────────┘           │
             ↓                          │
         Add (norm + ffn_out) ←─────────┘
             │
             ↓
       Layer Norm
             │
             ↓
        Output (same shape as input)
```

---

## Component 1: Residual Connections (Skip Connections)

### The highway bypass analogy

Imagine a highway with a town along the route. You can either:
A. Drive through the town (processing through the sublayer)
B. Take the bypass (skip the town entirely)
C. Both: drive through town AND keep the bypass route available

A residual connection is option C. The output is the ORIGINAL input PLUS
what the sublayer computed.

```
output = x + SubLayer(x)
         │     │
         │     └── what the sublayer added (new information)
         └── original input preserved (nothing lost)
```

### Why residual connections matter

Without residual connections, deep networks (many layers) struggle to train.
The gradient signal has to pass through every layer during backpropagation.
With 6 or more layers, the gradient can vanish or explode.

```
Without residual connections:
  Layer 1 → Layer 2 → Layer 3 → ... → Layer 6
  Gradient must pass through ALL 6 layers sequentially.
  By layer 1, the gradient may be tiny (vanishing gradient).

With residual connections:
  Layer 1 → Layer 2 → Layer 3 → ... → Layer 6
       ↓         ↓         ↓              ↓
  SHORTCUT → SHORTCUT → SHORTCUT → ... → SHORTCUT
  The gradient can flow directly through shortcuts.
  Even if the layer computations degrade the gradient,
  the shortcuts provide an unobstructed path.
```

**The analogy:** Imagine a relay race where each runner might drop the baton.
A residual connection is like having a backup runner who carries a copy of
the baton alongside each leg of the race. Even if runner 3 drops the baton,
the backup still has a copy.

```python
class ResidualConnection(nn.Module):
    def __init__(self, sublayer, d_model):
        super().__init__()
        self.sublayer = sublayer
        self.norm = nn.LayerNorm(d_model)

    def forward(self, x, *args, **kwargs):
        return self.norm(x + self.sublayer(x, *args, **kwargs))
```

---

## Component 2: Layer Normalization

### The problem

As data flows through many layers, the values can drift: some dimensions
become very large, others become very small. This makes training unstable.

### The thermostat analogy

Layer normalization is like a thermostat for each layer. No matter how hot
or cold the input gets (large or small values), the thermostat brings
everything back to a comfortable range (mean near 0, standard deviation
near 1).

```
Before LayerNorm: [-500, 0.001, 3000, -0.05, 1200]
After LayerNorm:  [-1.2, 0.0, 1.4, -0.01, 0.6]  (roughly)

Each vector is normalized to have mean ≈ 0 and std ≈ 1
```

### How it works

For each token's vector independently:
1. Compute the mean of all dimensions
2. Compute the standard deviation
3. Subtract the mean, divide by the standard deviation
4. Scale and shift with learned parameters (gamma, beta)

```
LayerNorm(x) = gamma * (x - mean(x)) / std(x) + beta

Where gamma and beta are learned parameters (dimension d_model).
The model can learn to undo the normalization if it wants to.
```

```python
class LayerNorm(nn.Module):
    def __init__(self, d_model, epsilon=1e-6):
        super().__init__()
        self.gamma = nn.Parameter(torch.ones(d_model))
        self.beta = nn.Parameter(torch.zeros(d_model))
        self.epsilon = epsilon

    def forward(self, x):
        mean = x.mean(dim=-1, keepdim=True)
        std = x.std(dim=-1, keepdim=True)
        return self.gamma * (x - mean) / (std + self.epsilon) + self.beta
```

### Pre-norm vs Post-norm

The original paper puts LayerNorm AFTER the residual addition (post-norm):
```
output = LayerNorm(x + SubLayer(x))
```

Most modern models use pre-norm (LayerNorm BEFORE the sublayer):
```
output = x + SubLayer(LayerNorm(x))
```

Pre-norm trains more stably, especially for very deep models. GPT-2 and
later models use pre-norm.

---

## Component 3: The Feed-Forward Network (FFN)

After attention, each token passes through a simple feed-forward network.
This is the same network applied independently to each position.

```
FFN(x) = ReLU(x @ W1 + b1) @ W2 + b2

Where:
  W1: [d_model, d_ff]     (expand)
  W2: [d_ff, d_model]     (contract)
  d_ff = 4 * d_model      (typically)
```

### The expansion-contraction pattern

```
Input:  [seq_len, 512]     (d_model = 512)
  │
  ↓ Linear (W1): 512 → 2048
  │
Expanded: [seq_len, 2048]   (d_ff = 2048 = 4 * 512)
  │
  ↓ ReLU (set negatives to zero)
  │
After ReLU: [seq_len, 2048]
  │
  ↓ Linear (W2): 2048 → 512
  │
Output: [seq_len, 512]      (back to d_model)
```

### Why does the FFN exist?

Self-attention is great at mixing information BETWEEN tokens. But it is
linear — it is just weighted sums. The FFN adds nonlinearity and gives
each token a chance to "think" independently.

**The analogy:** Self-attention is like a meeting where everyone shares
information. The FFN is like going back to your desk afterward and
processing what you heard — combining it with your own knowledge, making
decisions, forming conclusions. The meeting (attention) collects information;
the desk work (FFN) processes it.

Research has shown that the FFN acts as a kind of key-value memory:
```
W1 columns ≈ "keys" (patterns the FFN recognizes)
W2 rows    ≈ "values" (information the FFN adds when the pattern matches)
ReLU       ≈ gating (only activate for matching patterns)
```

For example, one column of W1 might activate for tokens in a "capital city"
context, and the corresponding row of W2 adds "geographic entity" information
to the representation.

```python
class FeedForward(nn.Module):
    def __init__(self, d_model, d_ff):
        super().__init__()
        self.linear1 = nn.Linear(d_model, d_ff)
        self.linear2 = nn.Linear(d_ff, d_model)
        self.relu = nn.ReLU()

    def forward(self, x):
        return self.linear2(self.relu(self.linear1(x)))
```

Modern models often use GELU or SwiGLU instead of ReLU, which give slightly
better results.

---

## Component 4: Masked Self-Attention in the Decoder

During training, the decoder sees the entire target sequence at once (for
efficiency). But during generation, it produces one word at a time. To
simulate this during training, we MASK future positions.

### Why masking?

```
Target: "Le chat s'est assis"

Without masking (cheating):
  When predicting "chat", the model can see "s'est assis" (the answer!)
  This is like taking a test with the answer key visible.

With masking (correct):
  When predicting "chat", the model can only see "Le"
  When predicting "s'est", the model can see "Le chat"
  Each position can only attend to itself and earlier positions.
```

### The mask matrix

```
Causal mask for sequence length 5:

          pos0  pos1  pos2  pos3  pos4
pos0  [    1     0     0     0     0  ]   pos0 sees only itself
pos1  [    1     1     0     0     0  ]   pos1 sees pos0 and itself
pos2  [    1     1     1     0     0  ]   pos2 sees pos0-2
pos3  [    1     1     1     1     0  ]   pos3 sees pos0-3
pos4  [    1     1     1     1     1  ]   pos4 sees everything

1 = can attend, 0 = blocked (set to -infinity before softmax)
```

### Implementation

```python
def create_causal_mask(seq_len):
    mask = torch.tril(torch.ones(seq_len, seq_len))
    return mask

mask = create_causal_mask(5)
print(mask)
```

In the attention computation, we apply the mask before softmax:
```python
scores = Q @ K.T / sqrt(d_k)
scores = scores.masked_fill(mask == 0, float('-inf'))
weights = softmax(scores)
```

Setting masked positions to -infinity ensures softmax gives them weight 0:
```
softmax([2.1, 0.5, -inf, -inf]) = [0.83, 0.17, 0.00, 0.00]
```

---

## The Full Encoder

```python
class EncoderLayer(nn.Module):
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.self_attention = MultiHeadAttention(d_model, num_heads)
        self.feed_forward = FeedForward(d_model, d_ff)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, mask=None):
        attn_output, _ = self.self_attention(x, mask=mask)
        x = self.norm1(x + self.dropout(attn_output))

        ff_output = self.feed_forward(x)
        x = self.norm2(x + self.dropout(ff_output))

        return x


class Encoder(nn.Module):
    def __init__(self, num_layers, d_model, num_heads, d_ff, vocab_size,
                 max_seq_len, dropout=0.1):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = nn.Embedding(max_seq_len, d_model)
        self.layers = nn.ModuleList([
            EncoderLayer(d_model, num_heads, d_ff, dropout)
            for _ in range(num_layers)
        ])
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, mask=None):
        seq_len = x.shape[1]
        positions = torch.arange(seq_len, device=x.device).unsqueeze(0)

        x = self.embedding(x) + self.pos_encoding(positions)
        x = self.dropout(x)

        for layer in self.layers:
            x = layer(x, mask)

        return x
```

---

## The Full Decoder

```python
class DecoderLayer(nn.Module):
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.masked_self_attention = MultiHeadAttention(d_model, num_heads)
        self.cross_attention = MultiHeadAttention(d_model, num_heads)
        self.feed_forward = FeedForward(d_model, d_ff)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, encoder_output, src_mask=None, tgt_mask=None):
        masked_attn_output, _ = self.masked_self_attention(x, mask=tgt_mask)
        x = self.norm1(x + self.dropout(masked_attn_output))

        cross_attn_output, _ = self.cross_attention(
            x, encoder_output=encoder_output, mask=src_mask
        )
        x = self.norm2(x + self.dropout(cross_attn_output))

        ff_output = self.feed_forward(x)
        x = self.norm3(x + self.dropout(ff_output))

        return x
```

Note: The cross-attention layer uses Q from the decoder and K, V from
the encoder. This is how the decoder "looks at" the input sentence. The
`MultiHeadAttention` class would need a minor modification to accept
separate inputs for Q vs K, V — omitted for clarity.

---

## Parameter Count Breakdown

For the original transformer (d_model=512, num_heads=8, d_ff=2048, 6 layers):

```
ENCODER (per layer):
  Multi-Head Self-Attention:
    W_Q: 512 x 512 =    262,144
    W_K: 512 x 512 =    262,144
    W_V: 512 x 512 =    262,144
    W_O: 512 x 512 =    262,144
    Subtotal:          1,048,576  (~1M)

  LayerNorm (x2):
    gamma, beta:           2,048

  Feed-Forward:
    W1: 512 x 2048 =  1,048,576
    b1: 2048       =      2,048
    W2: 2048 x 512 =  1,048,576
    b2: 512        =        512
    Subtotal:          2,099,712  (~2M)

  Total per encoder layer: ~3.15M parameters
  Total encoder (6 layers): ~18.9M parameters

DECODER (per layer):
  Masked Self-Attention:     ~1M
  Cross-Attention:           ~1M
  Feed-Forward:              ~2M
  LayerNorms:                ~3K
  Total per decoder layer:   ~4.2M parameters
  Total decoder (6 layers):  ~25.2M parameters

EMBEDDINGS:
  Source embedding: vocab_size x 512
  Target embedding: vocab_size x 512
  (often shared, ~37K vocab x 512 = ~19M)

TOTAL ORIGINAL TRANSFORMER: ~65M parameters
```

Compare to modern models:
```
Model          Parameters    Layers    d_model    Heads
────────────   ──────────    ──────    ───────    ─────
Transformer    65M           6+6       512        8
BERT-base      110M          12        768        12
GPT-2          1.5B          48        1600       25
GPT-3          175B          96        12288      96
Llama 2 7B     7B            32        4096       32
Llama 2 70B    70B           80        8192       64
```

The architecture is the same. The difference is scale.

---

## Why This Architecture Is So Powerful

### 1. Parallel training

Every position in the sequence is processed simultaneously. Unlike RNNs,
there is no sequential bottleneck. On a GPU, training is massively parallel.

```
RNN:    process token 1, then 2, then 3, ... then N  (N steps)
Trafo:  process ALL tokens simultaneously             (1 step)
```

### 2. Global context

Self-attention connects every position to every other position in one step.
No information decay over distance. A word at position 1 can directly
interact with a word at position 1000.

### 3. Stackable

Each layer refines the representations. Layer 1 might capture basic syntax.
Layer 3 might capture semantics. Layer 6 might capture complex reasoning.
Deeper = more abstract understanding.

```
Layer 1: "is this a noun or verb?"
Layer 2: "what role does this noun play in the sentence?"
Layer 3: "what entity does this pronoun refer to?"
Layer 4: "what is the sentiment of this clause?"
Layer 5: "what is the logical relationship between clauses?"
Layer 6: "what is the overall meaning and intent?"
```

### 4. Simple and elegant

The entire architecture is built from just a few components: attention,
linear layers, normalization, and activation functions. No complex gating
mechanisms (like LSTMs), no recurrence, no convolutions. This simplicity
makes it easier to scale, optimize, and understand.

---

## The Original Use Case: Machine Translation

The 2017 paper used this architecture for English-to-German and
English-to-French translation. Results:

```
English → German (WMT 2014):
  Previous best:  26.36 BLEU
  Transformer:    28.4 BLEU   (+2 points, huge improvement)

English → French (WMT 2014):
  Previous best:  41.0 BLEU
  Transformer:    41.0 BLEU   (matched with MUCH less training)

Training time:
  Previous best:  weeks on many GPUs
  Transformer:    3.5 days on 8 GPUs  (10x faster)
```

But the real impact was not translation quality. It was that this
architecture turned out to be GENERAL PURPOSE. The same architecture
(with minor modifications) can do:
- Text generation (GPT)
- Text understanding (BERT)
- Image recognition (Vision Transformer)
- Code generation (Codex, GitHub Copilot)
- Music generation
- Protein structure prediction (AlphaFold)
- Anything that can be framed as a sequence-to-sequence problem

---

## A Minimal Transformer Block in PyTorch

Putting it all together with a simplified but working implementation.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        self.num_heads = num_heads
        self.d_k = d_model // num_heads
        self.W_qkv = nn.Linear(d_model, 3 * d_model, bias=False)
        self.W_o = nn.Linear(d_model, d_model, bias=False)

    def forward(self, x, mask=None):
        batch, seq_len, d_model = x.shape

        qkv = self.W_qkv(x)
        qkv = qkv.view(batch, seq_len, 3, self.num_heads, self.d_k)
        qkv = qkv.permute(2, 0, 3, 1, 4)
        Q, K, V = qkv[0], qkv[1], qkv[2]

        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.d_k ** 0.5)

        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))

        weights = F.softmax(scores, dim=-1)
        attended = torch.matmul(weights, V)

        attended = attended.transpose(1, 2).contiguous().view(
            batch, seq_len, d_model
        )
        return self.W_o(attended)


class TransformerBlock(nn.Module):
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.attention = MultiHeadAttention(d_model, num_heads)
        self.ff = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Linear(d_ff, d_model),
        )
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, mask=None):
        normed = self.norm1(x)
        x = x + self.dropout(self.attention(normed, mask))

        normed = self.norm2(x)
        x = x + self.dropout(self.ff(normed))

        return x


class MiniTransformer(nn.Module):
    def __init__(self, vocab_size, d_model, num_heads, d_ff,
                 num_layers, max_seq_len, dropout=0.1):
        super().__init__()
        self.token_embedding = nn.Embedding(vocab_size, d_model)
        self.position_embedding = nn.Embedding(max_seq_len, d_model)
        self.blocks = nn.ModuleList([
            TransformerBlock(d_model, num_heads, d_ff, dropout)
            for _ in range(num_layers)
        ])
        self.norm = nn.LayerNorm(d_model)
        self.output_head = nn.Linear(d_model, vocab_size, bias=False)

    def forward(self, token_ids, mask=None):
        batch, seq_len = token_ids.shape
        positions = torch.arange(seq_len, device=token_ids.device)

        x = self.token_embedding(token_ids) + self.position_embedding(positions)

        for block in self.blocks:
            x = block(x, mask)

        x = self.norm(x)
        logits = self.output_head(x)
        return logits


vocab_size = 10000
d_model = 256
num_heads = 8
d_ff = 1024
num_layers = 4
max_seq_len = 512
batch_size = 2
seq_len = 20

model = MiniTransformer(vocab_size, d_model, num_heads, d_ff,
                        num_layers, max_seq_len)
tokens = torch.randint(0, vocab_size, (batch_size, seq_len))
causal_mask = torch.tril(torch.ones(seq_len, seq_len)).unsqueeze(0).unsqueeze(0)

logits = model(tokens, mask=causal_mask)

print(f"Input shape:  {tokens.shape}")
print(f"Output shape: {logits.shape}")

total_params = sum(p.numel() for p in model.parameters())
print(f"Total parameters: {total_params:,}")
```

This is a working GPT-style (decoder-only) transformer. With enough data
and training, it would learn to predict the next word.

---

## Encoder-Only vs Decoder-Only vs Encoder-Decoder

The original transformer has both encoder and decoder. But modern models
often use just one:

```
ENCODER-ONLY (BERT):
  Reads the entire input bidirectionally (no masking).
  Good for: understanding, classification, question answering.
  "What does this text mean?"

DECODER-ONLY (GPT, Claude, Llama):
  Reads left-to-right with causal masking.
  Good for: text generation, conversation, coding.
  "What comes next?"

ENCODER-DECODER (T5, original Transformer):
  Encoder reads input, decoder generates output.
  Good for: translation, summarization.
  "Convert this input to that output."

Most modern LLMs (GPT-4, Claude, Llama) are DECODER-ONLY.
They frame everything as "generate the next word":
  - Translation: "Translate to French: ..." → generate French
  - Q&A: "Question: ... Answer:" → generate answer
  - Summarization: "Summarize: ..." → generate summary
```

---

## Key Takeaways

```
1. The transformer has encoder (reads input) and decoder (writes output).
   Modern LLMs mostly use decoder-only architecture.

2. Each layer has: multi-head attention + feed-forward network,
   both wrapped with residual connections and layer normalization.

3. Residual connections (skip connections) let gradients flow through
   deep networks. output = x + SubLayer(x).

4. Layer normalization keeps values in a stable range across layers.

5. The feed-forward network adds nonlinear "thinking" capacity.
   It expands to 4x the dimension, applies ReLU/GELU, contracts back.

6. Masked attention in the decoder prevents looking at future tokens
   during training, simulating autoregressive generation.

7. The architecture is simple: attention + linear + normalization.
   Power comes from scale (more layers, bigger dimensions, more data).

8. The same architecture works for translation, generation,
   understanding, code, images, protein folding — remarkably general.
```

---

## Exercises

### Exercise 1: Trace through a transformer block
Take a single token embedding (a vector of 512 numbers). Trace it through
one encoder layer, describing what happens at each step:
a) Multi-head self-attention
b) Residual connection + LayerNorm
c) Feed-forward network
d) Residual connection + LayerNorm
What shape is the vector at each stage?

### Exercise 2: Parameter counting
For a decoder-only transformer with:
- d_model = 1024, num_heads = 16, d_ff = 4096, num_layers = 24
- vocab_size = 50,000, max_seq_len = 2048

Calculate:
a) Parameters per attention layer (W_Q + W_K + W_V + W_O)
b) Parameters per FFN (W1 + b1 + W2 + b2)
c) Total parameters per transformer block
d) Total parameters for all blocks
e) Embedding parameters
f) Grand total

### Exercise 3: Masking experiment
Using the MiniTransformer code above:
a) Run with a causal mask (lower triangular)
b) Run without a mask (full attention)
c) Compare the logits. Are they different? Why?

### Exercise 4: Why residual connections?
Stack 6 linear layers (without residual connections) where each multiplies
by 0.9. What happens to a value of 1.0 after 6 layers? (1.0 * 0.9^6 = ?)
Now add residual connections: each layer computes x + 0.9*x. What is the
value after 6 layers? Why is this better for gradient flow?

### Exercise 5: Design your own transformer
If you were building a transformer for a specific task (pick one: code
completion, sentiment analysis, or summarization), would you use encoder-only,
decoder-only, or encoder-decoder? How many layers? What d_model? Justify
your choices.

---

## What is next

We have built the full transformer, but we skipped one critical detail:
how does the transformer know word ORDER? Self-attention treats all positions
identically — it has no notion of first, second, third. Without some way
to encode position, "the cat sat on the mat" and "the mat sat on the cat"
would look the same. [Lesson 08](./08-positional-encoding.md) explains
positional encoding — the clever trick that gives transformers a sense
of word order.

---

[Next: Lesson 08 — Positional Encoding](./08-positional-encoding.md) | [Back to Roadmap](./00-roadmap.md)
