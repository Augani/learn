# Lesson 13: Embeddings — Turning Words into Numbers That Capture Meaning

Neural networks work with numbers. Text is not numbers. You need a way
to convert words into numbers, but not just any numbers — numbers that
capture MEANING. The word "king" should be numerically close to "queen"
and far from "banana."

Embeddings are the solution, and they're the foundation of every
language model.

---

## The Naive Approach: One-Hot Encoding

The simplest way to represent words as numbers: give each word a unique
index, then create a vector of all zeros with a 1 at that index.

```
Vocabulary: ["cat", "dog", "fish", "bird"]

cat  → [1, 0, 0, 0]
dog  → [0, 1, 0, 0]
fish → [0, 0, 1, 0]
bird → [0, 0, 0, 1]
```

**Three problems with one-hot encoding:**

### Problem 1: No Relationships

Every word is equally distant from every other word. Cat is just as
"far" from dog as it is from fish. But cats and dogs are both pets —
they should be closer to each other than to fish.

```
Distance between one-hot vectors (Euclidean):

  cat  to dog:  √2 ≈ 1.414
  cat  to fish: √2 ≈ 1.414
  cat  to bird: √2 ≈ 1.414

All the same! The representation captures NO meaning.
```

### Problem 2: Enormous Vectors

A real vocabulary has 30,000-100,000 words. Each word becomes a vector
with 30,000+ dimensions, with 29,999 zeros and one 1. Massively wasteful.

### Problem 3: No Generalization

If the model learns that "cat sat on the mat" is grammatical, it knows
nothing about "dog sat on the mat." The representations for cat and dog
are completely unrelated, so knowledge about one doesn't transfer to
the other.

**TypeScript analogy:** One-hot is like using an `enum` — each value is
distinct with no inherent relationship between them:

```typescript
enum Word { Cat = 0, Dog = 1, Fish = 2, Bird = 3 }
// Cat and Dog are just as "different" as Cat and Fish
```

---

## The Key Insight: Similar Words Should Have Similar Numbers

What if instead of a sparse vector with one 1, we used a dense vector
of, say, 300 real numbers? And arranged things so that words with
similar meanings end up with similar vectors?

```
One-hot (sparse, high-dimensional, no meaning):
  cat  → [1, 0, 0, 0, 0, 0, 0, ...]       (30,000 dimensions)

Embedding (dense, low-dimensional, meaningful):
  cat  → [0.2, 0.8, -0.1, 0.5, 0.3, ...]  (300 dimensions)
  dog  → [0.3, 0.7, -0.2, 0.4, 0.3, ...]  (CLOSE to cat!)
  fish → [-0.5, 0.1, 0.9, -0.1, 0.7, ...] (FAR from cat)
```

The 300 dimensions don't have predefined meanings. The model discovers
them during training. But they often correspond to interpretable
concepts:

```
Hypothetical learned dimensions (simplified to 5):

             royalty  gender  age  animal  food
king    →   [ 0.9,    0.8,   0.5,  -0.1,  -0.1]
queen   →   [ 0.9,   -0.8,   0.5,  -0.1,  -0.1]
boy     →   [-0.2,    0.7,  -0.8,  -0.1,  -0.1]
girl    →   [-0.2,   -0.7,  -0.8,  -0.1,  -0.1]
cat     →   [-0.5,   -0.1,  -0.1,   0.9,  -0.3]
pizza   →   [-0.3,   -0.1,  -0.1,  -0.5,   0.9]
```

---

## Word2Vec: How to Learn Embeddings

You don't design these vectors by hand. You LEARN them from data.
Word2Vec (Mikolov et al., 2013) introduced a brilliant insight:

**Words that appear in similar contexts have similar meanings.**

"The ___ sat on the mat." Could be cat, dog, kitten, puppy.
These words appear in similar contexts, so they get similar embeddings.

### Skip-Gram: Predicting Context from a Word

Given a word, predict the words that surround it:

```
Training sentence: "the quick brown fox jumps"

For the word "brown" (window size 2):
  Input: "brown"
  Predict: "the", "quick", "fox", "jumps"

For the word "fox":
  Input: "fox"
  Predict: "quick", "brown", "jumps"

The network learns embeddings where words that predict
the same context words end up with similar embeddings.
```

```
┌──────────┐        ┌──────────────┐        ┌──────────┐
│  "brown" │──one──→│  Embedding   │──dense─→│ "quick"  │
│  (input) │  hot   │  layer       │  vector │ "fox"    │
│          │        │  (W: V×300)  │         │ (context)│
└──────────┘        └──────────────┘        └──────────┘

The embedding layer IS the learned representation.
After training, throw away the prediction part — you only
want the embedding vectors.
```

---

## The Famous Example: Vector Arithmetic

The most remarkable property of word embeddings:

```
king - man + woman ≈ queen

In vector space:
  vector("king") - vector("man") + vector("woman")
  = [0.9, 0.8, 0.5] - [0.1, 0.8, 0.5] + [0.1, -0.8, 0.5]
  = [0.9, -0.8, 0.5]
  ≈ vector("queen")
```

The operation `king - man` captures the concept of "royalty without
maleness." Adding `woman` gives you "royalty with femaleness" = queen.

More examples:

```
Paris - France + Italy ≈ Rome        (capital relationship)
walked - walking + swimming ≈ swam   (tense relationship)
bigger - big + small ≈ smaller       (comparative relationship)
```

**Analogy:** Think of it as a coordinate system for meaning. "King"
and "queen" differ only along the gender axis. "King" and "prince"
differ only along the age/status axis. The embedding space organizes
words into meaningful dimensions automatically.

---

## Visualizing Embedding Spaces

300 dimensions are impossible to visualize. We use dimensionality
reduction (t-SNE or PCA) to project them down to 2D:

```
Projected 2D embedding space (simplified):

        royalty
          ↑
  queen ● │ ● king
          │
  woman ● │ ● man
          │
  girl  ● │ ● boy
          │
  ────────┼────────→ gender
          │
  kitten ●│ ● puppy
          │
  cat   ● │ ● dog
          │
        animals

Similar words cluster together.
Gender relationships are parallel vectors.
```

In a real embedding space with 300 dimensions, these clusters and
relationships are much richer, capturing relationships across many
dimensions simultaneously.

---

## Why Embeddings Are Foundational

Every modern NLP model starts with an embedding layer. It's the
first thing that happens to text:

```
Text input: "The cat sat"
      ↓
Tokenization: ["The", "cat", "sat"]
      ↓
Token IDs:    [42, 587, 219]
      ↓
Embedding lookup: [vector_42, vector_587, vector_219]
      ↓
Matrix (3 × 300): each row is a word's embedding
      ↓
Feed into RNN / Transformer / whatever comes next
```

GPT, BERT, Claude — they all start with embeddings. The embedding
layer is typically learned jointly with the rest of the model (not
pre-trained separately), but the concept is identical.

---

## Embeddings Beyond Words

The embedding idea extends to anything discrete:

| Domain | What Gets Embedded | Why |
|--------|-------------------|-----|
| Words | Vocabulary tokens | Capture semantic meaning |
| Users | User IDs | Capture user preferences (recommendations) |
| Products | Product IDs | Capture product similarity |
| Code tokens | Programming tokens | Code search, completion |
| Images | Image patches | Visual representations (Vision Transformers) |
| Nodes | Graph nodes | Social network analysis |

**Go analogy:** An embedding is like a hash function that maps discrete
items to a continuous space, except the "hash" preserves meaning. Items
that are semantically similar end up at similar "addresses."

```go
// Conceptual model (not real code):
type EmbeddingTable map[string][]float64

embeddings := EmbeddingTable{
    "cat":  {0.2, 0.8, -0.1, ...},
    "dog":  {0.3, 0.7, -0.2, ...},
    "fish": {-0.5, 0.1, 0.9, ...},
}
// Similar to a lookup table, but the values are learned to capture meaning
```

---

## Implementing Embeddings in PyTorch

### Basic Embedding Layer

```python
import torch
import torch.nn as nn

vocab_size = 10000
embedding_dim = 300

embedding = nn.Embedding(vocab_size, embedding_dim)

word_indices = torch.tensor([42, 587, 219])
vectors = embedding(word_indices)
print(vectors.shape)  # torch.Size([3, 300])
```

Under the hood, `nn.Embedding` is just a lookup table: a matrix of
shape `(vocab_size, embedding_dim)`. Given an index, it returns the
corresponding row. Gradients flow through the lookup during
backpropagation, so the embedding vectors get updated during training.

### Word Similarity with Embeddings

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

vocab = ["king", "queen", "man", "woman", "cat", "dog", "pizza", "burger"]
word_to_idx = {word: i for i, word in enumerate(vocab)}

embedding = nn.Embedding(len(vocab), 50)

nn.init.normal_(embedding.weight, mean=0, std=0.1)

def get_vector(word):
    idx = torch.tensor([word_to_idx[word]])
    return embedding(idx).squeeze()

def cosine_similarity(word1, word2):
    v1 = get_vector(word1)
    v2 = get_vector(word2)
    return F.cosine_similarity(v1.unsqueeze(0), v2.unsqueeze(0)).item()

print("Before training (random embeddings):")
print(f"  king vs queen: {cosine_similarity('king', 'queen'):.3f}")
print(f"  king vs pizza: {cosine_similarity('king', 'pizza'):.3f}")
print("  (Both roughly the same — no meaning learned yet)")
```

After training on real text, king-queen similarity would be much
higher than king-pizza similarity.

### Using Embeddings in a Model

```python
class TextClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, num_classes):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.fc1 = nn.Linear(embed_dim, 64)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(64, num_classes)

    def forward(self, x):
        embedded = self.embedding(x)        # (batch, seq_len, embed_dim)
        pooled = embedded.mean(dim=1)       # (batch, embed_dim) — average over sequence
        out = self.fc1(pooled)
        out = self.relu(out)
        out = self.fc2(out)
        return out

model = TextClassifier(vocab_size=10000, embed_dim=100, num_classes=2)

batch_of_sentences = torch.randint(0, 10000, (8, 20))
output = model(batch_of_sentences)
print(output.shape)  # torch.Size([8, 2]) — 8 sentences, 2 classes
```

The `embedded.mean(dim=1)` step averages all word embeddings in the
sentence to get a fixed-size sentence representation. This is a simple
approach — LSTMs and Transformers use more sophisticated methods.

---

## Pre-Trained Embeddings

Training embeddings from scratch requires a LOT of text. For smaller
projects, you can use pre-trained embeddings that someone else trained
on billions of words:

| Embeddings | Trained On | Dimensions | Key Feature |
|-----------|-----------|------------|-------------|
| Word2Vec | Google News (100B words) | 300 | Original word embeddings |
| GloVe | Wikipedia + web text (6B/42B) | 50-300 | Global co-occurrence statistics |
| fastText | Wikipedia (157 languages) | 300 | Handles subwords (can embed unknown words) |

```python
# Using pre-trained GloVe with torchtext (simplified):
# from torchtext.vocab import GloVe
# glove = GloVe(name='6B', dim=300)
# vector = glove['cat']     # pre-trained 300d vector for "cat"
# similar = glove.get_vecs_by_tokens(['cat', 'dog', 'fish'])
```

**When to use pre-trained embeddings:**
- Small dataset (not enough text to learn good embeddings from scratch)
- Task where general word meaning matters
- Want a quick baseline

**When to train from scratch:**
- Domain-specific vocabulary (medical, legal, code)
- Very large dataset available
- Using a model that trains embeddings end-to-end (like BERT/GPT)

---

## From Word Embeddings to Contextual Embeddings

Classical embeddings (Word2Vec, GloVe) give each word ONE fixed vector,
regardless of context:

```
"I went to the bank to deposit money."
"I sat on the bank of the river."

Word2Vec: "bank" → same vector in both sentences!
          It can't distinguish financial bank from river bank.
```

Modern models (BERT, GPT) produce **contextual embeddings** — different
vectors for the same word depending on its context. This is one of the
key advances that made LLMs so powerful.

```
BERT:
  "I went to the bank to deposit money."
  "bank" → [0.8, -0.1, 0.9, ...]  (financial meaning)

  "I sat on the bank of the river."
  "bank" → [-0.3, 0.7, 0.2, ...]  (river meaning)

  Different vectors! BERT understands the word in context.
```

This is covered in detail in Track 8.

---

## The Embedding Lookup as Matrix Multiplication

Under the hood, an embedding lookup is equivalent to multiplying a
one-hot vector by the embedding matrix:

```
One-hot vector for word index 2:  [0, 0, 1, 0, 0]

Embedding matrix (5 words × 3 dimensions):
┌─────────────────┐
│ 0.1   0.3   0.5 │  word 0
│ 0.7   0.2   0.1 │  word 1
│ 0.4   0.8   0.6 │  word 2  ← this row
│ 0.9   0.1   0.3 │  word 3
│ 0.2   0.5   0.7 │  word 4
└─────────────────┘

[0, 0, 1, 0, 0] × matrix = [0.4, 0.8, 0.6]

The one-hot vector "selects" row 2 — equivalent to a lookup.
```

But PyTorch's `nn.Embedding` does this as a direct index lookup (not
an actual matrix multiplication), which is much faster.

---

## Key Takeaways

1. **One-hot encoding** gives every word an equal, meaningless
   representation. It doesn't capture relationships.
2. **Embeddings** are dense vectors where similar items are close
   together in vector space.
3. **Word2Vec** learns embeddings by predicting context words —
   words in similar contexts get similar vectors.
4. **Vector arithmetic** works: king - man + woman = queen. The
   embedding space captures semantic relationships as directions.
5. **Embeddings are the foundation** of all NLP models. Every
   Transformer starts with an embedding layer.
6. **Pre-trained embeddings** (GloVe, fastText) provide good
   starting representations for small datasets.
7. **Contextual embeddings** (BERT, GPT) produce different vectors
   for the same word in different contexts — a major advance over
   fixed embeddings.
8. **Embeddings apply beyond words** — users, products, images, code
   tokens can all be embedded.

---

## Exercises

1. **Embedding similarity:** Create a small vocabulary of 20 words
   (mix of animals, foods, countries). Initialize random embeddings.
   Compute cosine similarity between all pairs. Now train a simple
   model on sentences containing these words. Do the similarities
   change to reflect meaning?

2. **Vector arithmetic:** If you have pre-trained embeddings (load
   GloVe), verify the famous analogies:
   - king - man + woman ≈ queen
   - Paris - France + Germany ≈ Berlin
   - bigger - big + small ≈ smaller
   How close are the results to the expected answers?

3. **Embedding dimensions:** Train a text classifier with embedding
   dimensions of 10, 50, 100, and 300. How does dimension size affect
   accuracy? Is there a point of diminishing returns?

4. **Visualize embeddings:** Train embeddings on a small text corpus.
   Use PCA or t-SNE (from sklearn) to project them to 2D.
   Plot the words. Do semantically similar words cluster together?

5. **Embedding for recommendation:** Create embeddings for 100 movies
   and 50 users. Each user rates some movies 1-5. Train the embeddings
   so that `user_embedding · movie_embedding ≈ rating`. This is the
   core of collaborative filtering recommendation systems.

---

Next: [Lesson 14 — The ML Landscape](./14-ml-landscape.md)
