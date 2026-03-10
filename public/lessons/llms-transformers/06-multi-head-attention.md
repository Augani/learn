# Lesson 06: Multi-Head Attention — Looking at Text From Multiple Angles

A single self-attention head can only focus on one pattern at a time.
But language has many simultaneous relationships: syntax, semantics,
coreference, position. Multi-head attention runs multiple attention
patterns in parallel, each looking at the text from a different angle.

---

## The Committee Analogy

Imagine you need to understand a legal contract. Instead of one person
reading it alone, you assemble a committee of 8 specialists:

```
Head 1 (Syntax Expert):     Focuses on grammatical structure
                            "subject agrees with verb"

Head 2 (Coreference Expert): Tracks pronoun references
                             "'it' refers to 'the contract'"

Head 3 (Semantic Expert):   Understands meaning relationships
                            "'terminate' relates to 'agreement'"

Head 4 (Positional Expert): Tracks nearby words
                            "the adjacent words modify this noun"

Head 5 (Negation Expert):   Watches for negation patterns
                            "'not liable' reverses meaning"

Head 6 (Temporal Expert):   Tracks time relationships
                            "'before signing' comes first"

Head 7 (Entity Expert):     Tracks who does what
                            "'Party A' is the one who pays"

Head 8 (Global Expert):     Captures overall theme/topic
                            "this paragraph is about liability"
```

Each specialist reads the same text but focuses on different aspects.
After they all finish, you combine their findings into one comprehensive
understanding.

Multi-head attention does exactly this. Instead of one attention pattern
over the sentence, you run 8 (or 12, or 16) attention patterns in parallel,
each learning to focus on different linguistic relationships.

---

## Why One Head Is Not Enough

Consider this sentence:

```
"The cat that the dog chased ran up the tree."
```

A single attention head for the word "ran" faces a dilemma:

```
Option A: Focus on the SUBJECT (who ran?)
  "ran" should attend to "cat" → "The cat ran"

Option B: Focus on the CLAUSE STRUCTURE
  "ran" should attend to "chased" → understanding the relative clause

Option C: Focus on the DESTINATION
  "ran" should attend to "tree" → where did it run?
```

One head can only produce one set of attention weights. It has to compromise
between these different relationships. With multiple heads, each head can
specialize:

```
Head 1 (subject): "ran" → attends to "cat"     (who?)
Head 2 (clause):  "ran" → attends to "chased"  (sentence structure)
Head 3 (object):  "ran" → attends to "tree"    (where?)
```

No compromise needed. All relationships are captured simultaneously.

---

## How It Works: Split, Attend, Concatenate

### The architecture

```
Input: x (shape: [seq_len, d_model])
       d_model = 512 (the full embedding dimension)
       num_heads = 8
       d_k = d_model / num_heads = 64 (dimension per head)

Step 1: Project into Q, K, V (full dimension)
        Q = x @ W_Q     (shape: [seq_len, 512])
        K = x @ W_K     (shape: [seq_len, 512])
        V = x @ W_V     (shape: [seq_len, 512])

Step 2: Split into 8 heads
        Q = [Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8]   each: [seq_len, 64]
        K = [K1, K2, K3, K4, K5, K6, K7, K8]   each: [seq_len, 64]
        V = [V1, V2, V3, V4, V5, V6, V7, V8]   each: [seq_len, 64]

Step 3: Run attention independently in each head
        head1 = Attention(Q1, K1, V1)   (shape: [seq_len, 64])
        head2 = Attention(Q2, K2, V2)   (shape: [seq_len, 64])
        ...
        head8 = Attention(Q8, K8, V8)   (shape: [seq_len, 64])

Step 4: Concatenate all heads
        concat = [head1, head2, ..., head8]   (shape: [seq_len, 512])

Step 5: Final linear projection
        output = concat @ W_O    (shape: [seq_len, 512])
```

### Visual diagram

```
                        Input (x)
                    [seq_len, d_model=512]
                           │
              ┌────────────┼────────────┐
              ↓            ↓            ↓
           x @ W_Q      x @ W_K     x @ W_V
              ↓            ↓            ↓
          Q [n, 512]   K [n, 512]   V [n, 512]
              │            │            │
       ┌──┬──┼──┬──┐ ┌──┬──┼──┬──┐ ┌──┬──┼──┬──┐
       ↓  ↓  ↓  ↓  ↓ ↓  ↓  ↓  ↓  ↓ ↓  ↓  ↓  ↓  ↓   Split into
      Q1 Q2 Q3 ... Q8 K1 K2 K3...K8 V1 V2 V3...V8    8 heads
       ↓  ↓  ↓      ↓  ↓  ↓  ↓     ↓  ↓  ↓  ↓   ↓    (64 dims each)
       └──┼──┘      └──┼──┘        └──┼──┘
          ↓             ↓              ↓
        Attn(Q1,K1,V1) Attn(Q2,K2,V2) ... Attn(Q8,K8,V8)
          ↓             ↓                   ↓
         h1            h2                  h8
          ↓             ↓                   ↓
          └─────────────┼───────────────────┘
                        ↓
                    Concatenate
                  [seq_len, 512]
                        ↓
                     x @ W_O
                        ↓
                  Output [seq_len, 512]
```

### The dimensionality breakdown

```
d_model = 512                    (total model dimension)
num_heads = 8                    (number of attention heads)
d_k = d_model / num_heads = 64  (dimension per head)

Total parameters for attention:
  W_Q: 512 x 512 = 262,144
  W_K: 512 x 512 = 262,144
  W_V: 512 x 512 = 262,144
  W_O: 512 x 512 = 262,144
  Total: ~1 million parameters per multi-head attention layer
```

**Key insight:** The total computation is roughly the same as a single
large attention head of size d_model. We are not doing 8x the work —
we are splitting the work into 8 parallel streams, each working on a
smaller dimension (64 instead of 512).

---

## Why Splitting Works Better Than One Big Head

### The specialization argument

With one 512-dimensional attention head:
```
Single head: Must encode ALL relationships in one set of 512-dim Q, K, V
  "cat" → attention weights: [0.1, 0.3, 0.2, 0.15, 0.1, 0.15]
  This is a COMPROMISE between subject tracking, coreference, etc.
```

With eight 64-dimensional attention heads:
```
Head 1: Learns to track subjects     → weights: [0.8, 0.1, ...]
Head 2: Learns to resolve pronouns   → weights: [0.1, 0.6, ...]
Head 3: Learns semantic similarity   → weights: [0.2, 0.2, ...]
...
Each head gets SHARP, specialized attention patterns.
```

**The analogy:** Imagine painting with one big brush vs eight small
brushes. The big brush covers the same area but can only do broad strokes.
The small brushes can each paint fine details in different ways.

### The capacity argument

A single head has d_k^2 effective capacity in its attention scores.
With d_k = 512, that is 262,144 potential score patterns. But many of
these are wasted trying to encode multiple relationships at once.

Eight heads with d_k = 64 each have 64^2 = 4,096 score patterns, but
they are INDEPENDENT. The effective capacity is 8 * 4,096 = 32,768
SPECIALIZED patterns, which turns out to be more useful than 262,144
compromised patterns.

---

## What Different Heads Actually Learn

Researchers have visualized attention heads in trained transformers and
found they develop specialized roles.

### Observed head specializations

```
Head type: "Positional"
  Attends to: the previous word, or the next word
  Pattern:    diagonal stripe in the attention matrix
  Use:        local context, bigram-like patterns

  ┌──────────────┐
  │ ░ █ ░ ░ ░ ░  │  Attention matrix:
  │ ░ ░ █ ░ ░ ░  │  Each word attends to
  │ ░ ░ ░ █ ░ ░  │  the NEXT word
  │ ░ ░ ░ ░ █ ░  │  (diagonal pattern)
  │ ░ ░ ░ ░ ░ █  │
  │ ░ ░ ░ ░ ░ ░  │
  └──────────────┘

Head type: "Syntactic"
  Attends to: syntactically related words (subject-verb, noun-adjective)
  Pattern:    specific connections based on grammar
  Use:        understanding sentence structure

  ┌──────────────┐
  │ ░ ░ ░ ░ ░ ░  │  "The big red cat sat"
  │ ░ ░ ░ █ ░ ░  │  "big" → attends to "cat"
  │ ░ ░ ░ █ ░ ░  │  "red" → attends to "cat"
  │ ░ ░ ░ ░ █ ░  │  "cat" → attends to "sat"
  │ ░ ░ ░ ░ ░ ░  │
  └──────────────┘

Head type: "Coreference"
  Attends to: the entity a pronoun refers to
  Pattern:    pronoun tokens attend to their referent
  Use:        resolving "it," "they," "she," etc.

Head type: "Rare token"
  Attends to: the [BOS] token or punctuation
  Pattern:    uniform attention (almost like averaging)
  Use:        collecting general sentence-level information

Head type: "Delimiter"
  Attends to: separator tokens between segments
  Pattern:    strong attention to [SEP] or period tokens
  Use:        boundary detection between sentence parts
```

These specializations emerge AUTOMATICALLY during training. Nobody tells
head 3 to focus on syntax — it discovers that this specialization helps
predict the next word.

---

## The Output Projection (W_O)

After concatenating all heads, there is a final linear projection:

```
concat = [head1 | head2 | ... | head8]    (shape: [seq_len, 512])
output = concat @ W_O                     (shape: [seq_len, 512])
```

Why is W_O needed?

1. **Mixing head outputs:** Each head attends to different aspects.
   W_O learns how to COMBINE these aspects into a unified representation.

2. **Dimensionality matching:** Ensures the output dimension matches
   the input dimension (both d_model = 512), so multi-head attention
   can be a drop-in component.

3. **Learned combination:** Not all heads are equally useful for all
   tasks. W_O learns to weight heads differently in different contexts.

**The analogy:** The 8 committee members each write a summary. W_O is the
editor who reads all summaries and produces one coherent report, knowing
which expert's input matters most for each section.

---

## Implementing Multi-Head Attention in PyTorch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        assert d_model % num_heads == 0, "d_model must be divisible by num_heads"

        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads

        self.W_Q = nn.Linear(d_model, d_model, bias=False)
        self.W_K = nn.Linear(d_model, d_model, bias=False)
        self.W_V = nn.Linear(d_model, d_model, bias=False)
        self.W_O = nn.Linear(d_model, d_model, bias=False)

    def forward(self, x, mask=None):
        batch_size, seq_len, _ = x.shape

        Q = self.W_Q(x)
        K = self.W_K(x)
        V = self.W_V(x)

        Q = Q.view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        K = K.view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        V = V.view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)

        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.d_k ** 0.5)

        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))

        weights = F.softmax(scores, dim=-1)

        attended = torch.matmul(weights, V)

        attended = attended.transpose(1, 2).contiguous().view(
            batch_size, seq_len, self.d_model
        )

        output = self.W_O(attended)

        return output, weights


d_model = 512
num_heads = 8
seq_len = 10
batch_size = 2

mha = MultiHeadAttention(d_model, num_heads)
x = torch.randn(batch_size, seq_len, d_model)

output, weights = mha(x)

print(f"Input shape:   {x.shape}")
print(f"Output shape:  {output.shape}")
print(f"Weights shape: {weights.shape}")
print(f"  batch={weights.shape[0]}, heads={weights.shape[1]}, "
      f"seq={weights.shape[2]}, seq={weights.shape[3]}")
```

### Breaking down the reshape trick

The key trick is how we split into heads without separate weight matrices.

```python
Q = self.W_Q(x)
```

This produces Q with shape `[batch, seq_len, d_model]`, e.g., `[2, 10, 512]`.

```python
Q = Q.view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
```

This reshapes:
```
[2, 10, 512]                    (batch, seq, d_model)
→ [2, 10, 8, 64]               (batch, seq, heads, d_k)  ← view
→ [2, 8, 10, 64]               (batch, heads, seq, d_k)  ← transpose
```

Now we can do attention on the last two dims `[10, 64]` independently
for each of the 8 heads, all in one matrix multiplication.

```
scores = Q @ K^T
[2, 8, 10, 64] @ [2, 8, 64, 10] → [2, 8, 10, 10]
  batch  heads  seq  d_k              attention scores:
                                      one 10x10 matrix per head
```

After attention, we transpose and reshape back:
```
[2, 8, 10, 64]                   (batch, heads, seq, d_k)
→ [2, 10, 8, 64]                 (batch, seq, heads, d_k)  ← transpose
→ [2, 10, 512]                   (batch, seq, d_model)     ← view (concatenate)
```

This is the same as concatenating 8 heads of size 64, but done with
a single reshape operation instead of 8 separate computations.

---

## Number of Heads in Practice

```
Model                d_model    num_heads    d_k
──────────────────   ───────    ─────────    ────
Transformer (orig)   512        8            64
BERT-base            768        12           64
BERT-large           1024       16           64
GPT-2 (small)        768        12           64
GPT-2 (large)        1280       20           64
GPT-3                12288      96           128
Llama 2 (7B)         4096       32           128
Llama 2 (70B)        8192       64           128
```

Notice that d_k stays around 64-128 regardless of model size. To make
bigger models, you add more heads (and increase d_model proportionally),
not bigger heads.

---

## Common Misconceptions

### "Each head has its own W_Q, W_K, W_V"

Technically true, but implemented as ONE big matrix that is then split.
Instead of 8 separate 512x64 matrices, we have one 512x512 matrix and
reshape. Same math, more efficient on GPUs.

### "More heads is always better"

Not necessarily. After a point, heads with only a tiny d_k (like 16 or 8)
do not have enough capacity to learn useful patterns. There is a sweet spot.

### "Heads learn completely independent things"

Not exactly. Because they all share the same input and their outputs are
combined through W_O, there is implicit coordination. Some heads learn
redundant patterns. Research shows you can often prune 30-40% of heads
after training without much quality loss.

### "The committee members never talk to each other"

Within a single multi-head attention layer, heads are independent. But
across layers, the output of all heads (combined by W_O) feeds into the
next layer's input. So heads in layer 2 can build on the combined output
of ALL heads in layer 1.

---

## Grouped Query Attention (Modern Optimization)

Modern large models like Llama 2 use a variant called Grouped Query
Attention (GQA) to reduce memory during inference.

```
Standard Multi-Head Attention:
  8 queries, 8 keys, 8 values  (each head has its own K, V)

Grouped Query Attention:
  8 queries, 2 keys, 2 values  (groups of 4 queries share K, V)

Multi-Query Attention (extreme):
  8 queries, 1 key, 1 value    (ALL queries share one K, V)
```

Why? During text generation, the model caches K and V for all previous
tokens (the "KV cache"). With 8 independent K, V per head, this cache
gets very large. Sharing K, V across groups of heads reduces cache size
by 4x with minimal quality loss.

```
Memory savings:
  Standard (h=8):  8 * seq_len * d_k per layer
  GQA (g=2):       2 * seq_len * d_k per layer   (4x less)
  MQA (g=1):       1 * seq_len * d_k per layer   (8x less)
```

---

## Key Takeaways

```
1. Multi-head attention runs multiple attention patterns in parallel.
   Each head can specialize in different linguistic relationships.

2. Implementation: project to Q, K, V (full dim), split into heads,
   run attention per head, concatenate, project back.

3. d_model = num_heads * d_k. Total computation stays the same
   as single-head attention of the same d_model.

4. Different heads learn different roles: positional, syntactic,
   coreference, semantic. This emerges automatically during training.

5. The output projection (W_O) combines all heads' findings into
   one unified representation.

6. Modern models use 8 to 96+ heads with d_k around 64-128.

7. The reshape trick (view + transpose) makes multi-head attention
   efficient on GPUs without separate weight matrices per head.
```

---

## Exercises

### Exercise 1: Dimension calculation
A model has d_model = 1024 and num_heads = 16. What is d_k?
If you increase to 32 heads, what is d_k? What might be the problem
with 128 heads?

### Exercise 2: What would each head focus on?
For the sentence "Although the chef who prepared the dish was French,
she used Japanese techniques," describe what 4 different heads might
focus on. What would each head's attention pattern look like for the
word "she"?

### Exercise 3: Parameter count
Calculate the total number of parameters in one multi-head attention layer
for a model with d_model = 768 and num_heads = 12. Include W_Q, W_K, W_V,
and W_O. How does this compare to a single-head attention with d_k = 768?

### Exercise 4: Run the implementation
Use the PyTorch MultiHeadAttention implementation above. Pass in a batch
of 2 sequences, each 10 tokens long, with d_model = 256 and 4 heads.
Print the attention weights for each head (shape [10, 10]) for the first
sequence. Are the attention patterns different across heads? (Hint: with
random weights before training, they will be somewhat random, but still
different.)

### Exercise 5: Pruning intuition
If a trained model has 8 attention heads and you remove head 3, what
happens to the output? What if head 3 was the only head that learned
coreference ("it" → "cat")? What mechanism might allow the model to
compensate for the missing head?

---

## What is next

We have covered the core attention mechanisms: single attention (Lesson 04),
self-attention (Lesson 05), and multi-head attention (Lesson 06). Now it is
time to put all the pieces together into the full transformer architecture.
[Lesson 07](./07-transformer-architecture.md) walks through the complete
"Attention Is All You Need" architecture — multi-head attention plus
feed-forward networks, residual connections, layer normalization, and the
encoder-decoder structure.

---

[Next: Lesson 07 — The Transformer Architecture](./07-transformer-architecture.md) | [Back to Roadmap](./00-roadmap.md)
