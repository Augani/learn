# Lesson 08: Positional Encoding — How Transformers Know Word Order

Self-attention treats every position identically. It computes attention
between all pairs of words, but nothing in the mechanism tells the model
WHERE a word appears. Without positional encoding, "the dog bit the man"
and "the man bit the dog" would produce identical outputs.

This lesson explains how transformers solve this with positional encoding.

---

## The Problem: Self-Attention Has No Sense of Order

### Why RNNs did not have this problem

RNNs process words one at a time, left to right. Position is built into
the computation: word 1 is processed first, word 2 second, etc.

```
RNN:  "The" -> "cat" -> "sat" -> "on" -> "the" -> "mat"
       t=0      t=1      t=2      t=3     t=4      t=5

Each hidden state h_t depends on h_{t-1}.
Order is implicit in the sequential processing.
```

### Why transformers DO have this problem

Self-attention processes all positions simultaneously. Every word attends
to every other word through dot products of Q, K, V. The computation is
permutation-invariant: shuffling the input order produces the same
attention scores.

```
Self-attention sees:
  {word_A, word_B, word_C, word_D}    ← a SET, not a sequence

NOT:
  [word_A at position 0, word_B at position 1, ...]

Without position, these are the same:
  "The dog bit the man"   (dog bites man)
  "The man bit the dog"   (man bites dog -- very different!)
```

**The analogy:** Imagine a group project where everyone submits their work
via email (no timestamps). You receive all the pieces but have no idea what
order they go in. Without timestamps (positional encoding), you cannot
assemble the final document correctly.

---

## The Solution: Add Position Information to Embeddings

The fix is simple in concept: add a position-dependent signal to each
word embedding BEFORE feeding it into the transformer.

```
Final input = Word embedding + Positional encoding

For "The cat sat":
  Position 0: embed("The") + pos_encoding(0)
  Position 1: embed("cat") + pos_encoding(1)
  Position 2: embed("sat") + pos_encoding(2)
```

Now "The" at position 0 has a different input vector than "The" at position
4, even though the word is the same. The model can learn that position
matters.

```
                Word        Positional      Final
               Embedding  +  Encoding    =  Input
"The" (pos 0): [0.5, -0.2]  [0.0, 1.0]    [0.5, 0.8]
"cat" (pos 1): [0.7, 0.3]   [0.84, 0.54]  [1.54, 0.84]
"sat" (pos 2): [-0.3, 0.8]  [0.91, -0.42] [0.61, 0.38]
```

But what should these position vectors look like? There are four main
approaches, each with different tradeoffs.

---

## Approach 1: Sinusoidal Positional Encoding (The Original)

The original "Attention Is All You Need" paper used a mathematical function
to generate positional encodings. No learning required.

### The formula

```
PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))

Where:
  pos = position in the sequence (0, 1, 2, ...)
  i = dimension index (0, 1, 2, ..., d_model/2)
  d_model = embedding dimension (512 in original paper)
```

Even dimensions use sine, odd dimensions use cosine.

### The clock tower analogy

Think of a clock tower with multiple clocks, each running at a different
speed:

```
Clock 1 (fast):    ticks every second     -> changes rapidly
Clock 2 (medium):  ticks every minute     -> changes moderately
Clock 3 (slow):    ticks every hour       -> changes slowly
Clock 4 (slower):  ticks every day        -> changes very slowly
```

If you look at all four clocks simultaneously, you get a unique combination
for any point in time. 3:47:22 PM on Tuesday has a unique pattern across
all four clocks.

Sinusoidal positional encoding works the same way. Each dimension is a
"clock" running at a different frequency:

```
Dimension 0-1:     Very fast oscillation   (captures fine position)
Dimension 2-3:     Fast oscillation
Dimension 4-5:     Medium oscillation
...
Dimension 510-511: Very slow oscillation   (captures coarse position)
```

Position 0, position 1, position 2, etc., each get a unique pattern
across all dimensions -- like a unique timestamp from multiple clocks.

### Visualizing sinusoidal encoding

```
Position:  0    1    2    3    4    5    6    7    8    9

Dim 0:   [ 0.0  0.8  0.9  0.1 -0.8 -1.0 -0.3  0.7  1.0  0.4]  fast wave
Dim 1:   [ 1.0  0.5 -0.4 -1.0 -0.7  0.0  0.9  0.7 -0.1 -0.9]
Dim 2:   [ 0.0  0.1  0.2  0.3  0.4  0.5  0.6  0.6  0.7  0.8]  slower wave
Dim 3:   [ 1.0  1.0  1.0  1.0  0.9  0.9  0.8  0.8  0.7  0.7]
...
Dim 510: [ 0.0  0.0  0.0  0.0  0.0  0.0  0.0  0.0  0.0  0.0]  very slow
Dim 511: [ 1.0  1.0  1.0  1.0  1.0  1.0  1.0  1.0  1.0  1.0]
```

Lower dimensions change rapidly between positions (fine-grained position).
Higher dimensions change slowly (coarse-grained position). Together, they
uniquely identify each position.

### Why sinusoidal encoding is clever

**Property 1: Unique encoding for each position**
No two positions have the same encoding vector. The combination of sines
and cosines at different frequencies guarantees uniqueness.

**Property 2: Relative position through linear transformation**
The encoding for position `pos + k` can be expressed as a linear function
of the encoding for position `pos`. This means the model can learn to
attend to "the word 3 positions back" without hardcoding it.

```
PE(pos + k) = f(PE(pos))   where f is a linear transformation

This means the model can learn patterns like:
  "attend to the word 2 positions before me"
  "attend to the word 5 positions after me"
by learning the appropriate weight matrices.
```

**Property 3: Bounded values**
Sine and cosine always produce values between -1 and 1. The positional
encoding does not grow unboundedly with position, which keeps values
in a manageable range.

**Property 4: Generalizes to unseen lengths**
Since the formula works for any position, the model can handle sequences
longer than any it saw during training (in theory). Position 1000 gets a
valid encoding even if training only used sequences up to 512.

### Implementation

```python
import torch
import numpy as np
import math

def sinusoidal_positional_encoding(max_seq_len, d_model):
    pe = torch.zeros(max_seq_len, d_model)

    position = torch.arange(0, max_seq_len).unsqueeze(1).float()
    div_term = torch.exp(
        torch.arange(0, d_model, 2).float() * -(math.log(10000.0) / d_model)
    )

    pe[:, 0::2] = torch.sin(position * div_term)
    pe[:, 1::2] = torch.cos(position * div_term)

    return pe


pe = sinusoidal_positional_encoding(max_seq_len=100, d_model=512)
print(f"Shape: {pe.shape}")
print(f"Position 0: {pe[0, :8].numpy().round(3)}")
print(f"Position 1: {pe[1, :8].numpy().round(3)}")
print(f"Position 2: {pe[2, :8].numpy().round(3)}")
```

```
Shape: torch.Size([100, 512])
Position 0: [ 0.     1.     0.     1.     0.     1.     0.     1.   ]
Position 1: [ 0.841  0.54   0.029  1.     0.001  1.     0.     1.   ]
Position 2: [ 0.909 -0.416  0.058  0.998  0.002  1.     0.     1.   ]
```

Notice how the first few dimensions change rapidly between positions
(high frequency), while later dimensions barely change (low frequency).

### Adding to embeddings

```python
import torch.nn as nn

class SinusoidalEmbedding(nn.Module):
    def __init__(self, vocab_size, d_model, max_len, dropout=0.1):
        super().__init__()
        self.token_embedding = nn.Embedding(vocab_size, d_model)
        self.dropout = nn.Dropout(dropout)
        self.scale = d_model ** 0.5

        pe = sinusoidal_positional_encoding(max_len, d_model)
        self.register_buffer('positional_encoding', pe)

    def forward(self, token_ids):
        seq_len = token_ids.size(1)
        token_emb = self.token_embedding(token_ids) * self.scale
        pos_emb = self.positional_encoding[:seq_len]
        return self.dropout(token_emb + pos_emb)
```

The `* self.scale` multiplier is important: token embeddings are scaled by
sqrt(d_model) so the position signal does not dominate the token signal.
Without scaling, the position information could overwhelm the word meaning.

---

## Approach 2: Learned Positional Embeddings (GPT, BERT)

Instead of a fixed formula, just LEARN the positional encodings as
parameters, the same way you learn word embeddings.

```
Learned position embeddings:
  pos_0 -> [0.12, -0.34, 0.67, ...]   <- learned during training
  pos_1 -> [-0.23, 0.45, 0.11, ...]   <- learned during training
  pos_2 -> [0.78, -0.12, -0.56, ...]  <- learned during training
  ...
  pos_1023 -> [0.33, 0.22, -0.91, ...]
```

### Implementation

```python
class LearnedPositionalEmbedding(nn.Module):
    def __init__(self, vocab_size, d_model, max_len):
        super().__init__()
        self.token_embedding = nn.Embedding(vocab_size, d_model)
        self.position_embedding = nn.Embedding(max_len, d_model)

    def forward(self, token_ids):
        seq_len = token_ids.size(1)
        positions = torch.arange(seq_len, device=token_ids.device)
        token_emb = self.token_embedding(token_ids)
        pos_emb = self.position_embedding(positions)
        return token_emb + pos_emb
```

### Sinusoidal vs learned: tradeoffs

```
                    Sinusoidal          Learned
──────────────────  ─────────────       ──────────────
Parameters:         0 (fixed formula)   max_seq_len * d_model
Generalization:     Any length          Only up to max_seq_len
Performance:        Slightly worse      Slightly better
Flexibility:        Fixed formula       Adapts to data
Used by:            Original paper      GPT-2, BERT, most modern
```

The big limitation of learned embeddings: if you train with max_len=1024,
the model has never seen position 1025. It literally has no embedding for
that position. This is why GPT-2 had a hard context length limit of 1024
tokens.

In practice, learned embeddings work slightly better and are simpler to
implement. Most practitioners prefer them despite the length limitation.

---

## Approach 3: RoPE -- Rotary Positional Encoding (Modern Standard)

Modern models like Llama, Mistral, GPT-NeoX, and many others use Rotary
Positional Encoding (RoPE). Instead of adding position to the embedding,
RoPE encodes position INTO the attention mechanism itself.

### The core idea

Instead of adding a position vector to the embedding, RoPE ROTATES the
Query and Key vectors based on their position. Two tokens at positions m
and n will have their Q and K rotated differently, and the dot product
Q_m . K_n naturally depends on the relative distance (m - n).

```
Standard attention:   score = Q_m . K_n
  Q and K have position info added to the embedding
  The dot product does not directly capture relative position

RoPE attention:       score = rotate(Q, m) . rotate(K, n)
  Rotation is designed so that:
  rotate(Q, m) . rotate(K, n) = f(Q, K, m - n)
  The score DIRECTLY depends on relative position (m - n)!
```

### The rotating walk analogy

Imagine you are on a circular track. Your starting position determines
your angle. If person A starts at position 3 and person B starts at
position 7, the angle between them (4 positions apart) is the same as if
A started at position 10 and B at position 14. RoPE captures this
relative distance through rotation.

### How it works

Group the embedding dimensions into pairs. For each pair, apply a
2D rotation by an angle that depends on the position:

```
For dimension pair (i, i+1) at position pos:

  x_i'     =  cos(pos * theta_i) * x_i  -  sin(pos * theta_i) * x_{i+1}
  x_{i+1}' =  sin(pos * theta_i) * x_i  +  cos(pos * theta_i) * x_{i+1}

where theta_i = 1 / 10000^(2i/d_model)
```

The rotation angle increases with position, and different dimension
pairs rotate at different speeds (just like sinusoidal encoding).

### Visual intuition

```
Position 0:  Rotate by 0 degrees      (no rotation)
Position 1:  Rotate by theta degrees  (small rotation)
Position 2:  Rotate by 2*theta        (more rotation)
Position 3:  Rotate by 3*theta        (even more rotation)

Attention between pos 1 and pos 3:
  Relative distance = 2 positions
  Angular difference = 2*theta

Attention between pos 5 and pos 7:
  Relative distance = 2 positions
  Angular difference = 2*theta  (same! relative position is what matters)
```

### Why RoPE is popular

```
1. Relative position:  score depends on (m - n), not absolute positions
2. Decays with distance: attention naturally decreases for far-away tokens
3. Better extrapolation: can handle longer sequences than training length
4. No extra parameters: positions encoded through rotation, not learned
```

### Implementation

```python
def precompute_rope_frequencies(dim, max_len, theta=10000.0):
    freqs = 1.0 / (theta ** (torch.arange(0, dim, 2).float() / dim))
    positions = torch.arange(max_len)
    angles = torch.outer(positions, freqs)
    return torch.cos(angles), torch.sin(angles)


def apply_rope(x, cos_cached, sin_cached):
    d = x.shape[-1]
    x1 = x[..., :d // 2]
    x2 = x[..., d // 2:]

    seq_len = x.shape[-2]
    cos_part = cos_cached[:seq_len]
    sin_part = sin_cached[:seq_len]

    rotated_x1 = x1 * cos_part - x2 * sin_part
    rotated_x2 = x1 * sin_part + x2 * cos_part

    return torch.cat([rotated_x1, rotated_x2], dim=-1)
```

RoPE is applied to Q and K AFTER projection but BEFORE computing attention
scores. It is NOT applied to Value vectors:

```
  Input embedding
      |
      +-- Linear -> Q -- apply_rope(Q, pos) --+
      |                                        +-- Attention scores
      +-- Linear -> K -- apply_rope(K, pos) --+
      |
      +-- Linear -> V ----------------------------> Values
```

---

## Approach 4: ALiBi -- Attention with Linear Biases

ALiBi (used in BLOOM) takes a completely different approach: it does not
modify the embeddings at all. Instead, it adds a bias directly to the
attention scores.

```
Standard:  score = Q . K^T / sqrt(d_k)
ALiBi:     score = Q . K^T / sqrt(d_k) - m * |i - j|

Where:
  i, j = positions of the query and key tokens
  m = a slope parameter (different per head, fixed, not learned)
  |i - j| = distance between tokens
```

The bias penalizes attention to distant tokens proportionally to their
distance. Each head uses a different slope, so some heads focus locally
(steep penalty) and others focus globally (gentle penalty).

```
Head 1 (m=1.0):    Strongly prefers nearby tokens
Head 2 (m=0.5):    Moderate distance preference
Head 3 (m=0.25):   Gentle preference, can attend far
Head 4 (m=0.125):  Almost no distance penalty
```

### Why ALiBi is interesting

- No extra parameters: just a simple bias added to attention scores
- Excellent extrapolation: trains on 1K tokens, works on 4K+
- Simple to implement: a few lines of code

---

## Comparing All Approaches

```
Method         How it works                 Used by            Extrapolation
────────────   ─────────────────────────    ────────────────   ─────────────
Sinusoidal     Add fixed sin/cos to embed   Original paper     Good (theory)
Learned        Learn position embeddings    GPT-2, BERT        Poor
RoPE           Rotate Q, K by position      Llama, Mistral     Good
ALiBi          Bias attention by distance   BLOOM              Very good
```

The trend in modern models is toward approaches that capture RELATIVE
position (RoPE, ALiBi) rather than absolute position (sinusoidal, learned).
Relative position generalizes better: "the word 3 positions back" is more
useful than "the word at position 47."

RoPE is the current winner by adoption. Most open-source LLMs use it.

---

## Why Position Encoding Matters for Context Windows

Positional encoding directly determines a model's context window -- how
much text it can process at once.

```
GPT-2:     1,024 tokens  (learned positions, hard limit)
GPT-3:     2,048 tokens
GPT-4:     8,192 or 32,768 tokens
Claude 3:  up to 200,000 tokens
Llama 2:   4,096 tokens  (RoPE, can be extended)
```

With learned positional embeddings, the model literally has no embedding
for position 1025 if trained with max_seq_len=1024. With RoPE or ALiBi,
there is a formula that works for any position, enabling extrapolation.

### Extending context length with RoPE

Models trained with RoPE on 4K tokens can be extended to much longer
sequences through frequency scaling techniques:

```
Original RoPE:           Trained on 4K tokens
                                |
        +-------+-------+------+
        |               |             |
  Position          NTK-Aware        YaRN
  Interpolation     Scaling      (Yet another RoPE
  (compress freqs)  (scale base)  extension)
        |               |             |
    Works OK        Works better    Works best
```

This is how models like Llama (originally 4K context) have been extended
to 100K+ tokens. The positional encoding is the key bottleneck -- and
the key enabler -- of long-context models.

---

## The Full Pipeline with Position Encoding

```
Input text:  "The cat sat on the mat"

Step 1: Tokenize
  -> [464, 3797, 3332, 319, 464, 2603]

Step 2: Look up word embeddings
  -> [[0.5, -0.2, ...], [0.7, 0.3, ...], ...]   (6 vectors, d_model dims each)

Step 3: Add positional encoding (sinusoidal/learned)
  -> word_embed + pos_encode for each position
     OR apply RoPE later to Q, K in attention

Step 4: Feed into transformer layers
  -> Self-attention now uses position-aware representations
  -> The model knows "The" is at position 0, "cat" at position 1, etc.

Step 5: Output
  -> Probability distribution over vocabulary for the next token
```

Without positional encoding, the transformer is a powerful but
order-blind processor. With it, the model understands that "The cat"
at the beginning and "the mat" at the end have different roles in the
sentence, even though "the" appears twice.

---

## Key Takeaways

```
1. Self-attention is permutation-invariant: without positional encoding,
   word order is lost. "dog bit man" = "man bit dog".

2. Positional encoding adds position information so the model knows
   word order. Added to embeddings or applied to Q, K in attention.

3. Sinusoidal encoding: fixed sin/cos waves at different frequencies.
   Each position gets a unique "fingerprint." No learnable parameters.

4. Learned positional embeddings: treat positions like words and learn
   a vector for each position. Simple, effective, hard limit on length.

5. RoPE: rotates Q and K vectors by position. Captures relative position.
   Used by Llama and most modern open-source models. The current winner.

6. ALiBi: adds distance-based bias to attention scores. Great extrapolation.

7. The trend is toward relative position encoding (RoPE, ALiBi) which
   generalizes better to unseen sequence lengths.

8. Context window length is directly tied to positional encoding design.
   Extending RoPE frequencies is how models get 100K+ token windows.
```

---

## Exercises

### Exercise 1: Why position matters
Write two sentences that use the exact same words but have completely
different meanings due to word order. For each, explain which word's
position changes the meaning.

### Exercise 2: Generate sinusoidal encodings
Use the Python implementation above to generate positional encodings for
positions 0-99 with d_model=64. Plot dimensions 0, 1, 30, and 31 across
all positions using matplotlib. What do you notice about the frequencies?

### Exercise 3: Uniqueness check
Generate sinusoidal encodings for positions 0-999 with d_model=128.
Compute the cosine similarity between every pair of adjacent positions
(0-1, 1-2, ..., 998-999). Is it constant? What about the similarity
between position 0 and position 500?

### Exercise 4: The length limit problem
A model trained with learned positional embeddings has max_seq_len=512.
A user sends a 600-token input. What happens? How would sinusoidal encoding
handle this? How would RoPE handle this?

### Exercise 5: Design your own
If you were designing a positional encoding for code (where indentation
level and scope nesting matter), what properties would you want? How might
you encode "this token is inside a for loop at nesting depth 3"? Would
you use absolute or relative position encoding? Why?

### Exercise 6: The binary counter connection
Sinusoidal encoding is like a binary counter with smooth transitions.
Binary: position 0 = [0,0,0], position 1 = [1,0,0], position 2 = [0,1,0],
position 3 = [1,1,0]. Why might having smooth continuous waves be better
than discrete binary digits for a neural network?

---

## What is next

With positional encoding, we have covered every component of the transformer
architecture: tokenization (Lesson 02), self-attention (Lesson 05),
multi-head attention (Lesson 06), feed-forward networks, residual connections,
layer normalization (Lesson 07), and positional encoding (this lesson).

The next section of this track shifts from "how the architecture works" to
"how it is used." [Lesson 09](./09-bert.md) covers BERT -- the first model
to show that a pretrained transformer encoder could be fine-tuned for almost
any NLP task, revolutionizing the field.

---

[Next: Lesson 09 -- BERT](./09-bert.md) | [Back to Roadmap](./00-roadmap.md)
