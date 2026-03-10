# Lesson 04: Attention — The Breakthrough Idea

Attention is the single most important concept in modern AI. The paper
that introduced the transformer was literally called "Attention Is All
You Need." Every LLM — GPT-4, Claude, Gemini, Llama — is built on
attention. This lesson breaks it down piece by piece.

In Lesson 03 you saw attention informally: the decoder "looks back" at
encoder states. Now we formalize it with the Query-Key-Value framework
and derive the exact formula used in transformers.

---

## The Cocktail Party Analogy

You are at a loud party. Dozens of conversations are happening
simultaneously. Somehow, you can focus on the person talking to you and
tune out everything else. If someone across the room says your name, your
attention instantly shifts there.

This is attention: the ability to selectively focus on the most relevant
information while ignoring the rest.

A transformer processes a sentence the same way. When it processes the
word "it" in "The cat sat on the mat because it was comfortable," it
focuses its attention on "mat" (or "cat") to figure out what "it" refers
to. It does not give equal weight to every word.

---

## Query, Key, Value — The Library Analogy

Attention uses three concepts: Query, Key, and Value. The library analogy
makes them intuitive.

### The setup

You walk into a library. You have a question (Query). Each book has a title
card in the catalog (Key). Each book has actual content (Value).

```
Your Query:     "I need information about neural networks"

Catalog Keys:                          Relevance:
  "Deep Learning Fundamentals"         → HIGH (very relevant)
  "History of Ancient Rome"            → LOW  (not relevant)
  "Introduction to Machine Learning"   → HIGH (relevant)
  "Cooking with Italian Herbs"         → LOW  (not relevant)
  "Neural Network Architectures"       → VERY HIGH (exactly what you need)

Values (book contents):
  Each book contains the actual information you would read
```

### The attention process

```
Step 1: Compare your Query against every Key
        → "Neural Network Architectures" is the best match
        → "Deep Learning Fundamentals" is also good
        → "Cooking with Italian Herbs" is irrelevant

Step 2: Assign weights based on relevance
        → Neural Network Architectures: 0.50
        → Deep Learning Fundamentals: 0.30
        → Intro to Machine Learning: 0.15
        → History of Ancient Rome: 0.03
        → Cooking with Italian Herbs: 0.02

Step 3: Read the Values, weighted by relevance
        → Mostly read the Neural Networks book
        → Also read some of the Deep Learning book
        → Barely glance at the others

Result: A weighted blend of information, emphasizing the most relevant sources
```

This is exactly how attention works in a transformer, but with vectors
instead of books.

---

## The Three Vectors

In a transformer, every token has three vectors:

```
Query (Q): "What am I looking for?"
Key (K):   "What do I contain?"
Value (V): "What information can I provide?"
```

These are not hand-crafted. They are LEARNED. The model creates Q, K, V
vectors by multiplying the input embedding with three learned weight matrices:

```
Input embedding: x = [0.5, -0.2, 0.8, 0.1]  (the vector for a word)

Q = x * W_Q = [0.3, 0.7, -0.1, 0.4]   (what this word is looking for)
K = x * W_K = [-0.2, 0.5, 0.6, 0.1]   (what this word offers)
V = x * W_V = [0.8, -0.3, 0.2, 0.9]   (the actual information)
```

The weight matrices W_Q, W_K, W_V are parameters of the model — they are
adjusted during training so that the attention mechanism learns to focus
on the right things.

---

## Dot Product as Similarity

How do you measure whether a Query matches a Key? The dot product.

**The analogy:** Two arrows pointing in the same direction have a high dot
product. Two arrows pointing in opposite directions have a negative dot
product. Perpendicular arrows have a dot product of zero.

```
Dot product of two vectors:
  a = [1, 2, 3]
  b = [4, 5, 6]
  a . b = (1*4) + (2*5) + (3*6) = 4 + 10 + 18 = 32

Higher dot product = more similar = more relevant
```

For attention:
```
Query:  q = [0.3, 0.7, -0.1, 0.4]   (what word A is looking for)
Key_1:  k1 = [-0.2, 0.5, 0.6, 0.1]  (what word 1 offers)
Key_2:  k2 = [0.4, 0.8, -0.2, 0.3]  (what word 2 offers)
Key_3:  k3 = [-0.5, -0.3, 0.1, -0.7] (what word 3 offers)

Score_1 = q . k1 = (0.3)(-0.2) + (0.7)(0.5) + (-0.1)(0.6) + (0.4)(0.1)
        = -0.06 + 0.35 - 0.06 + 0.04 = 0.27

Score_2 = q . k2 = (0.3)(0.4) + (0.7)(0.8) + (-0.1)(-0.2) + (0.4)(0.3)
        = 0.12 + 0.56 + 0.02 + 0.12 = 0.82   ← HIGHEST

Score_3 = q . k3 = (0.3)(-0.5) + (0.7)(-0.3) + (-0.1)(0.1) + (0.4)(-0.7)
        = -0.15 - 0.21 - 0.01 - 0.28 = -0.65  ← LOWEST
```

Word 2 is most relevant to word A. Word 3 is least relevant.

---

## Softmax: Converting Scores to Weights

Raw dot products can be any number: positive, negative, large, small.
We need weights that:
1. Are all positive (you cannot have negative attention)
2. Sum to 1 (they are probabilities)

Softmax does this.

```
Raw scores:     [0.27, 0.82, -0.65]

Softmax formula: weight_i = e^(score_i) / sum(e^(score_j) for all j)

e^0.27  = 1.31
e^0.82  = 2.27
e^-0.65 = 0.52

Sum = 1.31 + 2.27 + 0.52 = 4.10

Weights:
  w1 = 1.31 / 4.10 = 0.32
  w2 = 2.27 / 4.10 = 0.55   ← gets the most attention
  w3 = 0.52 / 4.10 = 0.13   ← gets the least attention

Sum of weights: 0.32 + 0.55 + 0.13 = 1.00 ✓
```

**The analogy:** Softmax is like grading on a curve. The highest scorer
gets the most credit, the lowest scorer gets the least, and everything
is normalized to sum to 100%.

### What softmax does to different inputs

```
Input:  [1.0,  1.0,  1.0]  → Softmax: [0.33, 0.33, 0.33]  (equal attention)
Input:  [5.0,  1.0,  1.0]  → Softmax: [0.88, 0.06, 0.06]  (concentrated)
Input:  [100,  1.0,  1.0]  → Softmax: [1.00, 0.00, 0.00]  (winner-take-all)
Input:  [-2.0, 3.0,  0.0]  → Softmax: [0.01, 0.95, 0.05]  (ignores negative)
```

When one score is much higher than the rest, softmax concentrates nearly
all the weight on that one item. When scores are similar, attention is
spread evenly.

---

## Weighted Sum of Values

Now we have weights (how much to attend to each word) and Values (the
actual information each word provides). The output is a weighted sum.

```
Weights:   [0.32,       0.55,       0.13]
Values:    [v1,         v2,         v3]

Output = 0.32 * v1  +  0.55 * v2  +  0.13 * v3
```

Concretely, if each value is a 4-dimensional vector:

```
v1 = [0.8, -0.3, 0.2, 0.9]
v2 = [0.1, 0.7, -0.4, 0.3]
v3 = [-0.5, 0.2, 0.6, -0.1]

Output = 0.32 * [0.8, -0.3, 0.2, 0.9]     = [0.256, -0.096, 0.064, 0.288]
       + 0.55 * [0.1, 0.7, -0.4, 0.3]     = [0.055, 0.385, -0.220, 0.165]
       + 0.13 * [-0.5, 0.2, 0.6, -0.1]    = [-0.065, 0.026, 0.078, -0.013]
                                            ───────────────────────────────
                                            = [0.246, 0.315, -0.078, 0.440]
```

The output is a blend of all the Values, weighted by how relevant each
one is. It is mostly v2 (weight 0.55) with some v1 (0.32) and a bit
of v3 (0.13).

---

## The Attention Formula

Now we can state the full attention formula. This is the exact formula
from "Attention Is All You Need":

```
Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V
```

Let us break down every piece.

### The formula, step by step

```
Step 1: Q * K^T
  Compute the dot product of every query with every key.
  Result: a matrix of attention scores.

  If Q has shape [seq_len, d_k] and K has shape [seq_len, d_k]:
  Q * K^T has shape [seq_len, seq_len]
  Entry (i, j) = how much word i should attend to word j

Step 2: / sqrt(d_k)
  Divide all scores by the square root of the key dimension.
  This is the SCALING FACTOR. We will explain why shortly.

Step 3: softmax(...)
  Apply softmax to each ROW of the score matrix.
  Each row sums to 1 — it is the attention distribution for one word.

Step 4: * V
  Multiply the attention weights by the Value matrix.
  Each word's output is a weighted combination of all Values.
```

### Visual walkthrough

```
Input sentence: "The cat sat"   (3 words)
Each word has embedding dimension d_k = 4

Q = [q_the, q_cat, q_sat]    shape: [3, 4]
K = [k_the, k_cat, k_sat]    shape: [3, 4]
V = [v_the, v_cat, v_sat]    shape: [3, 4]

Step 1: Q * K^T (score matrix)

              k_the  k_cat  k_sat
    q_the  [  2.1    0.5    0.3  ]   "The" attends most to "The"
    q_cat  [  0.4    1.8    0.9  ]   "cat" attends most to "cat"
    q_sat  [  0.2    1.2    1.5  ]   "sat" attends most to "sat"

Step 2: Divide by sqrt(d_k) = sqrt(4) = 2

              k_the  k_cat  k_sat
    q_the  [  1.05   0.25   0.15 ]
    q_cat  [  0.20   0.90   0.45 ]
    q_sat  [  0.10   0.60   0.75 ]

Step 3: Softmax (each row independently)

              k_the  k_cat  k_sat
    q_the  [  0.53   0.24   0.22 ]   sum = 1.0
    q_cat  [  0.17   0.43   0.39 ]   sum = 1.0
    q_sat  [  0.14   0.37   0.49 ]   sum = 1.0

Step 4: Multiply by V

    output_the = 0.53 * v_the + 0.24 * v_cat + 0.22 * v_sat
    output_cat = 0.17 * v_the + 0.43 * v_cat + 0.39 * v_sat
    output_sat = 0.14 * v_the + 0.37 * v_cat + 0.49 * v_sat
```

Each output word is now an attention-weighted blend of ALL input words.
The word "cat" gets an output that is mostly its own value (0.43) but
enriched with context from "sat" (0.39) and "The" (0.17).

---

## Why sqrt(d_k)? The Scaling Factor

This is the most commonly asked "why?" in attention.

### The problem without scaling

When d_k (the dimension of keys) is large, dot products become large
numbers. Large numbers going into softmax create extreme distributions:

```
d_k = 64 (typical):
  Dot products might be in range [-50, 50]

  softmax([50, 1, 1, 1]) ≈ [1.0, 0.0, 0.0, 0.0]
  ↑ Nearly ALL attention on one word. Almost binary.
    Gradient is nearly zero everywhere except the peak.
    Model cannot learn smoothly.
```

### Why dot products grow with dimension

Each element of the dot product is a multiplication of two random-ish
numbers. If each element has variance 1, the sum of d_k such elements
has variance d_k. The standard deviation is sqrt(d_k).

```
d_k = 4:   dot product std ≈ 2     → scores are small, softmax works well
d_k = 64:  dot product std ≈ 8     → scores are moderate
d_k = 512: dot product std ≈ 22.6  → scores are huge, softmax saturates
```

### The fix

Divide by sqrt(d_k) to bring the variance back to 1, regardless of
the dimension:

```
score / sqrt(d_k)

d_k = 4:   score / 2     → normalized std ≈ 1
d_k = 64:  score / 8     → normalized std ≈ 1
d_k = 512: score / 22.6  → normalized std ≈ 1
```

**The analogy:** Imagine you are comparing test scores, but one test is out
of 100 and another is out of 10,000. You need to normalize them to the same
scale before comparing. The sqrt(d_k) does the same thing for dot product
scores — it normalizes them so softmax behaves consistently regardless of
dimension.

---

## Implementing Attention in Python

### Pure numpy implementation

```python
import numpy as np

def attention(Q, K, V):
    d_k = Q.shape[-1]

    scores = Q @ K.T

    scaled_scores = scores / np.sqrt(d_k)

    def softmax(x):
        exp_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
        return exp_x / np.sum(exp_x, axis=-1, keepdims=True)

    weights = softmax(scaled_scores)

    output = weights @ V

    return output, weights


np.random.seed(42)
seq_len = 4
d_k = 8

Q = np.random.randn(seq_len, d_k)
K = np.random.randn(seq_len, d_k)
V = np.random.randn(seq_len, d_k)

output, weights = attention(Q, K, V)

print("Attention weights (each row sums to 1):")
print(np.round(weights, 3))
print(f"\nRow sums: {np.round(weights.sum(axis=-1), 3)}")
print(f"\nOutput shape: {output.shape}")
```

### PyTorch implementation

```python
import torch
import torch.nn.functional as F

def scaled_dot_product_attention(Q, K, V, mask=None):
    d_k = Q.shape[-1]

    scores = torch.matmul(Q, K.transpose(-2, -1)) / (d_k ** 0.5)

    if mask is not None:
        scores = scores.masked_fill(mask == 0, float('-inf'))

    weights = F.softmax(scores, dim=-1)

    output = torch.matmul(weights, V)

    return output, weights


seq_len = 5
d_k = 64

Q = torch.randn(seq_len, d_k)
K = torch.randn(seq_len, d_k)
V = torch.randn(seq_len, d_k)

output, weights = scaled_dot_product_attention(Q, K, V)

print(f"Output shape: {output.shape}")
print(f"Weights shape: {weights.shape}")
print(f"Weight row sums: {weights.sum(dim=-1)}")
```

---

## A Complete Worked Example

Let us trace attention through a concrete 3-word sentence: "I love cats"

### Setup

```
Vocabulary: {"I": 0, "love": 1, "cats": 2}
Embedding dim: 4
Key/Query dim: 3

Embeddings (pretend these are learned):
  "I"    → e0 = [1.0, 0.0, 0.5, -0.2]
  "love" → e1 = [0.3, 0.8, -0.1, 0.6]
  "cats" → e2 = [0.7, 0.2, 0.9, 0.1]

Weight matrices (pretend these are learned):
  W_Q = [[0.1, 0.2, 0.0],
         [0.3, -0.1, 0.2],
         [-0.2, 0.4, 0.1],
         [0.0, 0.1, -0.3]]

  W_K = [[0.2, -0.1, 0.3],
         [0.0, 0.3, -0.2],
         [0.1, 0.1, 0.4],
         [-0.3, 0.2, 0.0]]

  W_V = [[0.4, 0.0, -0.1],
         [-0.2, 0.3, 0.2],
         [0.1, -0.1, 0.5],
         [0.0, 0.2, -0.3]]
```

### Step 1: Compute Q, K, V for each word

```
q_I    = e0 @ W_Q = [1.0, 0.0, 0.5, -0.2] @ W_Q = [0.0, 0.4, 0.11]
q_love = e1 @ W_Q = [0.3, 0.8, -0.1, 0.6] @ W_Q = [0.27, 0.06, -0.04]
q_cats = e2 @ W_Q = [0.7, 0.2, 0.9, 0.1]  @ W_Q = [-0.05, 0.51, 0.13]
```

(Similar computation for K and V — each word gets its own Q, K, V triple.)

### Step 2: Compute scores (Q * K^T)

```
For word "I" (using q_I against all keys):
  score(I, I)    = q_I . k_I    = ...
  score(I, love) = q_I . k_love = ...
  score(I, cats) = q_I . k_cats = ...
```

### Step 3: Scale, softmax, weighted sum

The same procedure we described above, producing an output vector for each word
that blends information from all other words based on relevance.

The point is: this is all matrix multiplication. No loops. Fully
parallelizable. A GPU can compute attention for thousands of words
simultaneously. This is the key advantage over RNNs.

---

## Attention vs RNNs: The Fundamental Difference

```
RNN:
  word1 → word2 → word3 → ... → word100
  ↑
  To connect word1 and word100, information must travel
  through 99 sequential steps. Signal degrades.

Attention:
  word1 ←────────────────────→ word100
  ↑
  Direct connection! One matrix multiplication.
  No information degradation. No sequential bottleneck.
```

```
                    RNN              Attention
Sequential ops:    O(n)             O(1)
Max path length:   O(n)             O(1)
Parallelizable:    No (sequential)  Yes (matrix multiply)
Long-range deps:   Hard (decay)     Easy (direct)
Computation:       O(n * d^2)       O(n^2 * d)
```

The O(n^2) cost of attention means it gets expensive for very long sequences
(every word attends to every other word). But for typical sequence lengths,
the parallelism advantage far outweighs this cost.

---

## Key Takeaways

```
1. Attention = selectively focus on relevant information.

2. Query, Key, Value:
   - Query: what am I looking for?
   - Key: what do I offer?
   - Value: what information do I contain?

3. Attention score = dot product of Query and Key.
   Higher dot product = more similar = more attention.

4. Softmax converts scores to weights (positive, sum to 1).

5. Output = weighted sum of Values.

6. The formula: Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) * V

7. sqrt(d_k) scaling prevents softmax from saturating with
   high-dimensional vectors.

8. Attention gives direct connections between any two words
   (unlike RNNs, which require sequential processing).
```

---

## Exercises

### Exercise 1: Attention by hand
Given:
```
Q = [[1, 0],
     [0, 1]]

K = [[1, 0],
     [0, 1],
     [1, 1]]

V = [[10, 0],
     [0, 10],
     [5, 5]]
```

Compute the attention output for each query. d_k = 2, so sqrt(d_k) = 1.41.
Show all intermediate steps (scores, scaled scores, softmax weights, output).

### Exercise 2: Softmax temperature
What happens to the attention weights if you divide by sqrt(d_k * 4)
instead of sqrt(d_k)? What about sqrt(d_k / 4)? How does the "temperature"
affect whether attention is concentrated or spread out?

### Exercise 3: Implement and visualize
Use the numpy attention implementation above. Create Q, K, V for a 6-word
sentence. Plot the attention weight matrix as a heatmap (use matplotlib).
What patterns do you see?

### Exercise 4: Why not just average?
Instead of attention, what if you just averaged all the Value vectors
equally? Implement this and compare the output. Why is attention better
than simple averaging?

### Exercise 5: Masked attention
Modify the PyTorch implementation to support a causal mask: word i can only
attend to words 0 through i (not future words). Create the mask matrix
and verify that the attention weights for future positions are zero.

---

## What is next

So far, we have described attention where one sequence attends to another
(cross-attention). But the real power of transformers comes from SELF-attention:
a sequence attending to itself. [Lesson 05](./05-self-attention.md) explains
how self-attention works and why it is the core mechanism that makes
transformers so powerful.

---

[Next: Lesson 05 — Self-Attention](./05-self-attention.md) | [Back to Roadmap](./00-roadmap.md)
