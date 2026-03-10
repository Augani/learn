# Lesson 07: Text Similarity

## Analogy: Measuring Distance Between Ideas

Imagine you're in a library. Two books on the same shelf are
topically similar. Books in the same section are somewhat similar.
Books in different buildings are very different. Text similarity
measures the "distance between ideas."

```
  SIMILAR (close in meaning-space):
    "The cat sat on the mat"
    "A kitten rested on the rug"

  DIFFERENT (far apart):
    "The cat sat on the mat"
    "Stock prices rose sharply today"

  MEANING SPACE:
      "cat on mat"  *----* "kitten on rug"
                     \
                      \  (small distance)
                       \
                        * "dog on bed"

      "stock prices" *--------------------------* (far away)
```

## Cosine Similarity

The fundamental similarity metric. Measures the angle between two
vectors, ignoring magnitude.

```
  COSINE SIMILARITY:

            B
           /|
          / |
         /  |         cos(theta) = A . B / (|A| * |B|)
        / O |
       /    |         Range: -1 to 1
      A-----+         1  = identical direction
                      0  = perpendicular (unrelated)
                      -1 = opposite

  EXAMPLE:
  A = [1, 2, 3]
  B = [1, 2, 3]  -> cosine = 1.000 (identical)
  C = [3, 2, 1]  -> cosine = 0.714 (somewhat similar)
  D = [-1,-2,-3] -> cosine = -1.00 (opposite)
```

```python
import numpy as np

def cosine_similarity(vec_a, vec_b):
    dot_product = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)

a = np.array([1, 2, 3])
b = np.array([1, 2, 3])
c = np.array([3, 2, 1])
d = np.array([0, 0, 1])

print(f"A vs B: {cosine_similarity(a, b):.3f}")
print(f"A vs C: {cosine_similarity(a, c):.3f}")
print(f"A vs D: {cosine_similarity(a, d):.3f}")
```

## TF-IDF Similarity (Lexical)

Measures word overlap -- fast but misses synonyms.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

sentences = [
    "The cat sat on the mat",
    "A kitten rested on the rug",
    "Stock prices rose sharply today",
    "The feline was sitting on a carpet",
]

tfidf = TfidfVectorizer()
vectors = tfidf.fit_transform(sentences)
similarity_matrix = cosine_similarity(vectors)

for i in range(len(sentences)):
    for j in range(i + 1, len(sentences)):
        print(f"  [{similarity_matrix[i][j]:.3f}] "
              f"'{sentences[i][:30]}...' vs '{sentences[j][:30]}...'")
```

The problem: "cat" and "kitten" share zero words, so TF-IDF says
they're unrelated. We need semantic similarity.

## Sentence Transformers (Semantic Similarity)

Sentence transformers encode entire sentences into dense vectors where
similar meanings are close together -- even with different words.

```
  TF-IDF:
  "The dog is happy"    vs "The canine is joyful"  -> LOW similarity
                            (different words!)

  SENTENCE TRANSFORMER:
  "The dog is happy"    vs "The canine is joyful"  -> HIGH similarity
                            (same meaning!)
```

```python
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer('all-MiniLM-L6-v2')

sentences = [
    "The cat sat on the mat",
    "A kitten rested on the rug",
    "Stock prices rose sharply today",
    "The feline was sitting on a carpet",
    "Markets showed strong growth",
]

embeddings = model.encode(sentences)
similarity_matrix = util.cos_sim(embeddings, embeddings)

for i in range(len(sentences)):
    for j in range(i + 1, len(sentences)):
        score = similarity_matrix[i][j].item()
        print(f"  [{score:.3f}] {sentences[i][:35]:35} vs {sentences[j][:35]}")
```

## Bi-Encoders vs Cross-Encoders

Two architectures for computing similarity, with very different
trade-offs.

```
  BI-ENCODER                        CROSS-ENCODER
  +----------+   +----------+       +---------------------+
  | Sentence | | Sentence |       | Sentence A          |
  |    A     |   |    B     |       | [SEP]               |
  +----------+   +----------+       | Sentence B          |
       |              |             +---------------------+
       v              v                      |
  +----------+   +----------+                v
  | Encoder  |   | Encoder  |       +---------------------+
  +----------+   +----------+       | Single Encoder      |
       |              |             +---------------------+
       v              v                      |
    vec_A          vec_B                     v
       \            /                    SCORE: 0.87
        \          /
     cosine(vec_A, vec_B)
         = 0.85

  SPEED: O(n) encode once,          SPEED: O(n^2) must pair
         compare any pair                  every combination
  USE:   Search, retrieval           USE:   Re-ranking top results
```

```python
from sentence_transformers import CrossEncoder

cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

pairs = [
    ("How to learn Python?", "Best resources for Python programming"),
    ("How to learn Python?", "The weather is nice today"),
    ("Machine learning basics", "Introduction to ML algorithms"),
]

scores = cross_encoder.predict(pairs)
for pair, score in zip(pairs, scores):
    print(f"  [{score:.3f}] '{pair[0]}' vs '{pair[1]}'")
```

## Semantic Search

The killer app for text similarity: find relevant documents for a query.

```
  QUERY: "How do I train a neural network?"

  CORPUS:                                   SIMILARITY
  +--------------------------------------+-----------+
  | "Deep learning training techniques"  |   0.82    | <-- top result
  | "Neural network optimization guide"  |   0.79    |
  | "Installing Python on Windows"       |   0.12    |
  | "Best restaurants in Paris"          |   0.03    |
  +--------------------------------------+-----------+
```

```python
from sentence_transformers import SentenceTransformer, util
import numpy as np

model = SentenceTransformer('all-MiniLM-L6-v2')

corpus = [
    "Deep learning uses neural networks with many layers",
    "Natural language processing deals with text data",
    "Computer vision focuses on image understanding",
    "Reinforcement learning trains agents through rewards",
    "Transfer learning reuses pre-trained model knowledge",
    "Data preprocessing cleans and prepares raw data",
    "Gradient descent optimizes neural network weights",
    "Tokenization splits text into smaller units",
]

corpus_embeddings = model.encode(corpus, convert_to_tensor=True)

def search(query, top_k=3):
    query_embedding = model.encode(query, convert_to_tensor=True)
    scores = util.cos_sim(query_embedding, corpus_embeddings)[0]
    top_indices = scores.argsort(descending=True)[:top_k]

    print(f"\n  Query: '{query}'")
    for idx in top_indices:
        print(f"    [{scores[idx]:.3f}] {corpus[idx]}")

search("How do neural networks learn?")
search("Working with text in AI")
search("Preparing data for machine learning")
```

## Two-Stage Retrieval: Bi-Encoder + Cross-Encoder

For production systems, combine both: use bi-encoder for fast initial
retrieval, then cross-encoder for precise re-ranking.

```
  QUERY
    |
    v
  +-------------------+
  | Bi-Encoder        |  Fast: retrieve top 100 from millions
  | (retrieve top-k)  |
  +-------------------+
    |
    v
  +-------------------+
  | Cross-Encoder     |  Precise: re-rank top 100 -> top 10
  | (re-rank)         |
  +-------------------+
    |
    v
  Final Top 10 Results
```

```python
from sentence_transformers import SentenceTransformer, CrossEncoder, util

bi_encoder = SentenceTransformer('all-MiniLM-L6-v2')
cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

corpus = [
    "Python is a popular programming language",
    "Machine learning requires large datasets",
    "Deep learning models need GPU computing",
    "Natural language processing analyzes text",
    "Computer vision processes visual data",
    "Data science combines statistics and coding",
    "AI systems can learn from experience",
    "Programming languages include Java and C++",
]

corpus_embeddings = bi_encoder.encode(corpus, convert_to_tensor=True)

query = "What programming languages are used in data science?"

query_embedding = bi_encoder.encode(query, convert_to_tensor=True)
bi_scores = util.cos_sim(query_embedding, corpus_embeddings)[0]
top_k_indices = bi_scores.argsort(descending=True)[:5]

candidates = [(corpus[idx], bi_scores[idx].item()) for idx in top_k_indices]

cross_input = [[query, doc] for doc, _ in candidates]
cross_scores = cross_encoder.predict(cross_input)

reranked = sorted(
    zip(candidates, cross_scores),
    key=lambda x: x[1],
    reverse=True
)

print("After re-ranking:")
for (doc, bi_score), cross_score in reranked:
    print(f"  bi={bi_score:.3f} cross={cross_score:.3f} | {doc}")
```

## Exercises

1. Build a FAQ matcher: given 10 FAQ questions and their answers, find
   the most relevant FAQ for a user query using sentence transformers.
   Test with 5 different phrasings of the same question.

2. Compare TF-IDF similarity and sentence transformer similarity on
   these pairs: ("happy dog", "joyful puppy"), ("bank river", "bank
   money"), ("car automobile", "car vehicle"). Which method captures
   synonyms better?

3. Implement a two-stage retrieval system over a corpus of 50 sentences.
   Measure the time difference between bi-encoder-only retrieval and
   bi-encoder + cross-encoder re-ranking.

4. Build a "find similar sentences" tool: given a sentence, find the
   top 3 most similar sentences in a corpus of 20. Visualize the
   similarity scores as a heatmap.

---

**Next:** [08 - Topic Modeling](08-topic-modeling.md)
