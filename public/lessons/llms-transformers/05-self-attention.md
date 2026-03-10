# Lesson 05: Self-Attention — Words Paying Attention to Each Other

In Lesson 04, we learned about attention: one sequence attending to another
(the decoder looking at the encoder). Self-attention is the leap that makes
transformers possible: a sequence attending to ITSELF. Every word looks at
every other word in the same sentence to build a richer understanding.

This is the beating heart of the transformer.

---

## Cross-Attention vs Self-Attention

### Cross-attention (what we learned in Lesson 03-04)

Two different sequences. The decoder attends to the encoder.

```
Encoder (English):  "The"  "cat"  "sat"
                      ↑      ↑      ↑
                      └──────┼──────┘
                             ↓
Decoder (French):  "Le" → [attention] → "chat"

The French word "chat" attends to English words to find "cat."
Two different sequences: English input and French output.
```

### Self-attention (the new idea)

ONE sequence attends to ITSELF.

```
Input: "The"  "cat"  "sat"  "on"  "the"  "mat"
         ↕      ↕      ↕      ↕      ↕      ↕
        Every word looks at every other word
        in the SAME sentence.

"cat" attends to "The", "sat", "on", "the", "mat" (and itself)
"sat" attends to "The", "cat", "on", "the", "mat" (and itself)
... and so on for every word.
```

**The analogy:** Cross-attention is like a translator looking at the source
text. Self-attention is like a reader re-reading a sentence, where each word
considers all the other words to refine its own meaning.

---

## Why Self-Attention Matters: Resolving Ambiguity

Language is full of ambiguity. The meaning of a word depends on its context.
Self-attention lets each word gather context from the entire sentence.

### Example 1: Pronoun resolution

```
"The animal didn't cross the street because it was too tired."

What does "it" refer to?
→ "The animal" (because animals get tired, streets don't)

"The animal didn't cross the street because it was too wide."

What does "it" refer to?
→ "The street" (because streets are wide, not animals)
```

Without self-attention, the word "it" is just a pronoun with no specific
meaning. With self-attention, "it" can attend to other words and figure out
what it refers to:

```
"The animal didn't cross the street because it was too tired."

Self-attention for "it":
  The     → 0.05
  animal  → 0.45  ← HIGH (animals get tired)
  didn't  → 0.02
  cross   → 0.03
  the     → 0.02
  street  → 0.10
  because → 0.01
  it      → 0.05
  was     → 0.02
  too     → 0.05
  tired   → 0.20  ← "tired" helps disambiguate
```

The model learns that when "tired" appears, "it" should attend strongly to
"animal." When "wide" appears, "it" should attend to "street."

### Example 2: Word sense disambiguation

```
"I went to the bank to deposit my check."
  "bank" → financial institution (because of "deposit" and "check")

"I went to the bank to watch the river."
  "bank" → riverbank (because of "river")
```

Self-attention lets "bank" look at the rest of the sentence to determine
which meaning is correct:

```
"bank" in sentence 1:
  deposit → 0.35  ← HIGH (financial context)
  check   → 0.30  ← HIGH (financial context)
  bank    → 0.10
  ...

"bank" in sentence 2:
  river   → 0.40  ← HIGH (nature context)
  watch   → 0.15
  bank    → 0.10
  ...
```

### Example 3: Long-range dependencies

```
"The cat, which had been sleeping on the warm windowsill all
 afternoon while the rain poured outside, finally stretched
 and jumped down."

What "stretched"? The cat. But "cat" is 15 words away.
```

RNNs struggle here because information has to travel through 15 sequential
steps. Self-attention handles it trivially: "stretched" directly attends
to "cat" in one step, regardless of distance.

```
                     15 words apart
"The cat, which ... finally stretched and jumped down."
      ↑                        ↑
      └────── direct attention ─┘
              (just one matrix multiply)
```

---

## How Self-Attention Works

The mechanism is identical to the attention from Lesson 04, but now Q, K,
and V all come from the SAME sequence.

### Step 1: Each word creates its own Q, K, V

Every word takes its embedding and multiplies it by three weight matrices
to create Query, Key, and Value vectors.

```
Sentence: "The cat sat"

Embeddings:
  x_the = [0.5, -0.2, 0.8, 0.1]
  x_cat = [0.7, 0.3, -0.1, 0.6]
  x_sat = [-0.3, 0.8, 0.4, -0.2]

Weight matrices (shared across ALL words):
  W_Q, W_K, W_V   (learned during training)

Queries:
  q_the = x_the @ W_Q    "What is 'The' looking for?"
  q_cat = x_cat @ W_Q    "What is 'cat' looking for?"
  q_sat = x_sat @ W_Q    "What is 'sat' looking for?"

Keys:
  k_the = x_the @ W_K    "What does 'The' offer?"
  k_cat = x_cat @ W_K    "What does 'cat' offer?"
  k_sat = x_sat @ W_K    "What does 'sat' offer?"

Values:
  v_the = x_the @ W_V    "What information does 'The' carry?"
  v_cat = x_cat @ W_V    "What information does 'cat' carry?"
  v_sat = x_sat @ W_V    "What information does 'sat' carry?"
```

**Key insight:** W_Q, W_K, W_V are the SAME for every word. The model
learns one set of transformations that work for all positions. It is the
different input embeddings that create different Q, K, V vectors.

### Step 2: Compute the attention score matrix

Every word computes its attention score with every other word:

```
Score matrix = Q @ K^T (then scale by sqrt(d_k))

               k_the   k_cat   k_sat
  q_the  [     0.8     0.3     0.1   ]  "The" attends most to itself
  q_cat  [     0.2     0.9     0.7   ]  "cat" attends to itself and "sat"
  q_sat  [     0.1     0.6     0.5   ]  "sat" attends to "cat"
```

### Step 3: Softmax (each row independently)

```
               k_the   k_cat   k_sat
  q_the  [     0.52    0.27    0.21  ]   sum = 1.0
  q_cat  [     0.15    0.40    0.45  ]   sum = 1.0
  q_sat  [     0.14    0.41    0.45  ]   sum = 1.0
```

### Step 4: Weighted sum of Values

```
  output_the = 0.52 * v_the + 0.27 * v_cat + 0.21 * v_sat
  output_cat = 0.15 * v_the + 0.40 * v_cat + 0.45 * v_sat
  output_sat = 0.14 * v_the + 0.41 * v_cat + 0.45 * v_sat
```

Each word's output is a blend of ALL words' values, weighted by relevance.
The word "cat" now contains information about "The" and "sat" — its
representation has been enriched with context from the whole sentence.

---

## The Attention Matrix: Visualizing Self-Attention

The attention weight matrix (after softmax) tells you exactly what each word
is looking at. You can visualize it as a heatmap.

```
"The cat didn't cross the street because it was too tired"

Attention matrix for the word "it":

The      ████░░░░░░  0.40  ← "it" strongly attends to...
cat      ░░░░░░░░░░  0.02
didn't   ░░░░░░░░░░  0.01
cross    ░░░░░░░░░░  0.02
the      ░░░░░░░░░░  0.01
street   ██░░░░░░░░  0.12
because  ░░░░░░░░░░  0.01
it       █░░░░░░░░░  0.08
was      ░░░░░░░░░░  0.03
too      █░░░░░░░░░  0.05
tired    ██░░░░░░░░  0.25  ← ..."The" (40%) and "tired" (25%)
```

The model has learned that "it" + "tired" context points to an animate
noun, so "it" attends strongly to "The" (as a proxy for "The animal").

### Full attention heatmap

```
         The  cat  sat  on  the  mat
The    [ .50  .20  .10  .05  .10  .05 ]
cat    [ .10  .30  .25  .05  .05  .25 ]
sat    [ .05  .30  .25  .15  .05  .20 ]
on     [ .05  .05  .10  .30  .20  .30 ]
the    [ .10  .05  .05  .10  .40  .30 ]
mat    [ .05  .15  .15  .20  .20  .25 ]

Legend: higher number = more attention
```

Each ROW is one word's attention distribution over all words. Each row
sums to 1.0. This matrix is the core output of self-attention — it captures
how words relate to each other.

---

## Bidirectional: Every Word Sees Everything

Unlike RNNs, which process left-to-right (or right-to-left), self-attention
is inherently BIDIRECTIONAL. Every word can attend to every other word,
regardless of position.

```
RNN (left-to-right):
  "The" → "cat" → "sat" → "on" → "the" → "mat"
   ↑
  "mat" has info about all previous words.
  "The" has info about NOTHING that comes after it.

Self-attention:
  "The" ←→ "cat" ←→ "sat" ←→ "on" ←→ "the" ←→ "mat"
   ↑
  Every word sees every other word. "The" has info about
  ALL words, including "mat" at the end.
```

**The analogy:** An RNN is like reading a book page by page, left to right.
When you reach page 100, you might have forgotten page 3. Self-attention is
like having the entire book open on a table, where you can see all pages
simultaneously and compare any two pages instantly.

**Note:** In GPT-style (decoder-only) models, self-attention is MASKED so
that words can only attend to previous words, not future ones. This is
called causal or autoregressive masking. We cover this in Lesson 07.

---

## Parallel Computation: Why Transformers Are Fast

This is the practical reason transformers replaced RNNs.

### RNN: Sequential

```
Time step 1: Process word 1, get h1
Time step 2: Process word 2 with h1, get h2  (needs h1 first!)
Time step 3: Process word 3 with h2, get h3  (needs h2 first!)
...
Time step N: Process word N with h_{N-1}

Total: N sequential steps. Cannot parallelize.
A 500-word sentence takes 500 sequential steps.
```

### Self-attention: Parallel

```
Time step 1: Compute ALL Q, K, V simultaneously (matrix multiply)
Time step 2: Compute ALL attention scores simultaneously (matrix multiply)
Time step 3: Compute ALL outputs simultaneously (matrix multiply)

Total: 3 steps, regardless of sequence length.
A 500-word sentence takes the SAME number of steps as a 5-word sentence.
```

**The analogy:** An RNN is like a single cashier processing a line of 500
customers one at a time. Self-attention is like 500 self-checkout machines
processing everyone simultaneously.

On a GPU with thousands of parallel cores, this is a massive speedup.
Training a transformer on a large dataset can be 10-100x faster than
training an equivalent RNN.

```
Training time comparison (approximate):

Task: Machine translation, same quality level

RNN (LSTM):     2-4 weeks on 8 GPUs
Transformer:    3-4 days on 8 GPUs

That's a ~5-10x speedup, which enables:
  - Bigger models
  - More training data
  - Faster iteration
  - Better results
```

---

## Step-by-Step Self-Attention Computation

Let us trace through self-attention with actual numbers for a tiny example.

### Setup

```
Sentence: "I like cats"  (3 tokens)
Embedding dimension: 4
Q/K/V dimension (d_k): 3

Embeddings:
  x_I     = [1.0, 0.5, -0.3, 0.8]
  x_like  = [0.2, -0.1, 0.7, 0.4]
  x_cats  = [-0.5, 0.9, 0.2, -0.1]
```

### Weight matrices

```
W_Q = [[ 0.1,  0.3, -0.2],
       [ 0.4, -0.1,  0.5],
       [-0.3,  0.2,  0.1],
       [ 0.0,  0.6, -0.4]]

W_K = [[ 0.3, -0.2,  0.1],
       [-0.1,  0.4,  0.3],
       [ 0.5,  0.0, -0.3],
       [ 0.2, -0.1,  0.6]]

W_V = [[ 0.2,  0.1,  0.4],
       [-0.3,  0.5, -0.1],
       [ 0.1, -0.2,  0.3],
       [ 0.4,  0.0, -0.5]]
```

### Step 1: Compute Q, K, V

```
q_I = x_I @ W_Q
    = [1.0, 0.5, -0.3, 0.8] @ W_Q
    = [(1.0)(0.1) + (0.5)(0.4) + (-0.3)(-0.3) + (0.8)(0.0),
       (1.0)(0.3) + (0.5)(-0.1) + (-0.3)(0.2) + (0.8)(0.6),
       (1.0)(-0.2) + (0.5)(0.5) + (-0.3)(0.1) + (0.8)(-0.4)]
    = [0.39, 0.67, -0.35]

q_like = x_like @ W_Q
       = [(0.2)(0.1)+(-0.1)(0.4)+(0.7)(-0.3)+(0.4)(0.0),
          (0.2)(0.3)+(-0.1)(-0.1)+(0.7)(0.2)+(0.4)(0.6),
          (0.2)(-0.2)+(-0.1)(0.5)+(0.7)(0.1)+(0.4)(-0.4)]
       = [-0.23, 0.45, -0.14]

q_cats = x_cats @ W_Q
       = [(-0.5)(0.1)+(0.9)(0.4)+(0.2)(-0.3)+(-0.1)(0.0),
          (-0.5)(0.3)+(0.9)(-0.1)+(0.2)(0.2)+(-0.1)(0.6),
          (-0.5)(-0.2)+(0.9)(0.5)+(0.2)(0.1)+(-0.1)(-0.4)]
       = [0.25, -0.20, 0.61]
```

(Similar computation for K and V — each word multiplied by W_K and W_V.)

### Step 2: Score matrix

```
Scores = Q @ K^T  (shape: [3, 3])

For each pair (i, j): score = q_i . k_j

Let's say after computation:
                k_I     k_like   k_cats
  q_I     [    0.42     0.15    -0.08  ]
  q_like  [   -0.11     0.38     0.27  ]
  q_cats  [    0.05     0.22     0.51  ]
```

### Step 3: Scale by sqrt(d_k) = sqrt(3) = 1.73

```
                k_I     k_like   k_cats
  q_I     [    0.24     0.09    -0.05  ]
  q_like  [   -0.06     0.22     0.16  ]
  q_cats  [    0.03     0.13     0.29  ]
```

### Step 4: Softmax (each row)

```
                k_I     k_like   k_cats
  q_I     [    0.39     0.33     0.28  ]  ← "I" attends somewhat evenly
  q_like  [    0.26     0.39     0.35  ]  ← "like" attends to itself and "cats"
  q_cats  [    0.27     0.31     0.42  ]  ← "cats" attends most to itself
```

### Step 5: Output = Weights @ V

```
  output_I    = 0.39 * v_I  + 0.33 * v_like  + 0.28 * v_cats
  output_like = 0.26 * v_I  + 0.39 * v_like  + 0.35 * v_cats
  output_cats = 0.27 * v_I  + 0.31 * v_like  + 0.42 * v_cats
```

Each word's output is a weighted blend. "like" gets enriched with
information about what it likes (cats) and who does the liking (I).

---

## Self-Attention in Python

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class SelfAttention(nn.Module):
    def __init__(self, embed_dim, head_dim):
        super().__init__()
        self.W_Q = nn.Linear(embed_dim, head_dim, bias=False)
        self.W_K = nn.Linear(embed_dim, head_dim, bias=False)
        self.W_V = nn.Linear(embed_dim, head_dim, bias=False)
        self.head_dim = head_dim

    def forward(self, x, mask=None):
        Q = self.W_Q(x)
        K = self.W_K(x)
        V = self.W_V(x)

        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.head_dim ** 0.5)

        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))

        weights = F.softmax(scores, dim=-1)

        output = torch.matmul(weights, V)

        return output, weights


embed_dim = 64
head_dim = 32
seq_len = 5
batch_size = 1

attention = SelfAttention(embed_dim, head_dim)

x = torch.randn(batch_size, seq_len, embed_dim)

output, weights = attention(x)

print(f"Input shape:   {x.shape}")
print(f"Output shape:  {output.shape}")
print(f"Weights shape: {weights.shape}")
print(f"\nAttention weights for first token:")
print(weights[0, 0].detach().numpy().round(3))
print(f"Sum: {weights[0, 0].sum().item():.3f}")
```

---

## What Self-Attention Learns

After training on billions of words, different positions in the attention
matrix learn to capture different linguistic relationships:

```
Patterns self-attention discovers:

1. Subject-verb agreement:
   "The cats ___" → "are" (not "is")
   "cats" attends to "The" and the verb position

2. Coreference:
   "John said he would..." → "he" attends to "John"

3. Modifier-noun:
   "big red ball" → "ball" attends to "big" and "red"

4. Dependency structure:
   "The cat that I saw yesterday was black"
   → "was" attends to "cat" (subject), skipping the relative clause

5. Semantic similarity:
   "doctor" and "patient" attend to each other more than
   "doctor" and "table"
```

The model is not told these rules. It discovers them because they help
predict the next word.

---

## The Computational Cost

Self-attention has a cost that is important to understand.

```
Sequence length: n
Attention dimension: d

Score matrix: Q @ K^T
  Q shape: [n, d]
  K^T shape: [d, n]
  Result: [n, n]

Computation: n * n * d = O(n^2 * d)
Memory: n * n = O(n^2) for the attention matrix
```

The n^2 cost means:
```
n = 100 tokens:     10,000 attention pairs      (fast)
n = 1,000 tokens:   1,000,000 attention pairs    (manageable)
n = 10,000 tokens:  100,000,000 attention pairs  (getting heavy)
n = 100,000 tokens: 10,000,000,000 pairs         (very expensive)
```

This is why context windows have limits. A model with a 200,000 token
context window needs to compute a 200,000 x 200,000 attention matrix.
Various tricks (sparse attention, flash attention, sliding window attention)
help manage this cost in practice.

---

## Key Takeaways

```
1. Self-attention: a sequence attends to itself.
   Every word looks at every other word in the same sentence.

2. Each word creates Q, K, V by multiplying its embedding with
   learned weight matrices (shared across all positions).

3. The attention matrix shows which words each word focuses on.
   It captures linguistic relationships like coreference,
   subject-verb agreement, and semantic similarity.

4. Bidirectional: every word sees every other word simultaneously.
   Unlike RNNs, which process sequentially.

5. Parallel: all positions are computed simultaneously using
   matrix multiplication. 500 words take the same number of
   steps as 5 words. This is why transformers are fast.

6. Cost is O(n^2) in sequence length, which limits context size.

7. Self-attention is the core mechanism of the transformer.
   Everything else (multi-head, feed-forward, etc.) builds on this.
```

---

## Exercises

### Exercise 1: Pronoun resolution
For each sentence, which word(s) should "it" attend to most strongly?
1. "The trophy didn't fit in the suitcase because it was too big."
2. "The trophy didn't fit in the suitcase because it was too small."
3. "The computer crashed because it ran out of memory."

### Exercise 2: Self-attention vs RNN
A sentence has 50 words. Word 1 and word 50 need to interact.
- In an RNN, how many sequential steps must information travel?
- In self-attention, how many steps?
What does this mean for learning long-range patterns?

### Exercise 3: Compute self-attention
Given these 3-word embeddings and weight matrices, compute the full
self-attention output by hand:
```
x = [[1, 0],    (word 1)
     [0, 1],    (word 2)
     [1, 1]]    (word 3)

W_Q = W_K = W_V = [[1, 0],
                    [0, 1]]  (identity for simplicity)
```

### Exercise 4: Attention visualization
Run the SelfAttention PyTorch code above with a sequence of 8 tokens.
Visualize the attention weight matrix using matplotlib's `imshow`. Do you
see any patterns? What if you make the embeddings for tokens 1 and 5
identical — how does the attention pattern change?

### Exercise 5: Quadratic cost
Calculate the number of attention scores (n^2) for these context lengths:
512, 2048, 8192, 32768, 131072. Plot these on a graph. At what point does
n^2 become a problem? (Assume a GPU can handle ~10 billion operations per
forward pass.)

---

## What is next

Self-attention is powerful, but a single attention pattern is limited. What
if you could have MULTIPLE attention patterns simultaneously — one focusing
on syntax, another on semantics, another on coreference? That is multi-head
attention, and it is what makes transformers truly flexible.
[Lesson 06](./06-multi-head-attention.md) explains how.

---

[Next: Lesson 06 — Multi-Head Attention](./06-multi-head-attention.md) | [Back to Roadmap](./00-roadmap.md)
