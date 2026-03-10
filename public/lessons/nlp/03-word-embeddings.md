# Lesson 03: Word Embeddings

## Analogy: Words as GPS Coordinates

Imagine every word has a "location" in meaning-space, like GPS coordinates
on a map. Cities close together on the map are similar; words close
together in embedding space are semantically related.

```
  MEANING SPACE (simplified to 2D)

        ^ formality
        |
        |   "physician"
        |        *
        |               "doctor"
        |                  *
        |
        |   "cat"    "dog"
        |     *        *
        |
        |          "puppy"
        |             *
        |
        +--------------------------> animal-ness

  Close in this space = similar meaning
```

## From Sparse to Dense

BoW and TF-IDF create sparse vectors (mostly zeros, 50,000+ dimensions).
Embeddings create dense vectors (all non-zero, 100-300 dimensions).

```
  SPARSE (BoW):   [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, ...]
                   ^--- 50,000 dimensions, mostly zeros

  DENSE (Embedding): [0.23, -0.45, 0.89, 0.12, -0.67, ...]
                      ^--- 300 dimensions, all meaningful
```

## Word2Vec: Learning from Context

Word2Vec learns embeddings by predicting context. The core idea:
"You shall know a word by the company it keeps."

Two architectures:

```
  CBOW (Continuous Bag of Words)    Skip-gram
  Predict center from context       Predict context from center

  "the [cat] sat on"               "the [cat] sat on"

  Input: the, sat, on              Input: cat
  Output: cat                       Output: the, sat, on

  +------+                          +------+
  | the  |--+                       |      |---> the
  | sat  |--+--> [cat]              | cat  |---> sat
  | on   |--+                       |      |---> on
  +------+                          +------+

  Better for frequent words         Better for rare words
```

```python
from gensim.models import Word2Vec

sentences = [
    ["the", "cat", "sat", "on", "the", "mat"],
    ["the", "dog", "lay", "on", "the", "rug"],
    ["cats", "and", "dogs", "are", "pets"],
    ["the", "cat", "chased", "the", "dog"],
    ["dogs", "and", "cats", "play", "together"],
]

model = Word2Vec(
    sentences,
    vector_size=50,
    window=3,
    min_count=1,
    sg=1,
    epochs=100
)

print("Vector for 'cat':", model.wv['cat'][:5], "...")
print("Most similar to 'cat':", model.wv.most_similar('cat', topn=3))
```

## Word Analogies

The famous property of embeddings: vector arithmetic captures
relationships.

```
  king - man + woman = queen

  +--------+          +--------+
  | king   |          | queen  |
  +--------+          +--------+
       |  \                |  \
       |   \  "royalty"    |   \  "royalty"
       |    \              |    \
  +--------+ \       +--------+ \
  | man    |  |      | woman  |  |
  +--------+  |      +--------+  |
       "gender"           "gender"

  The "gender" direction is the same for both pairs!
```

```python
from gensim.models import KeyedVectors

model = KeyedVectors.load_word2vec_format(
    'GoogleNews-vectors-negative300.bin',
    binary=True,
    limit=100000
)

result = model.most_similar(
    positive=['king', 'woman'],
    negative=['man'],
    topn=3
)
print("king - man + woman =", result)

result = model.most_similar(
    positive=['paris', 'germany'],
    negative=['france'],
    topn=3
)
print("paris - france + germany =", result)
```

## GloVe: Global Vectors

GloVe uses word co-occurrence statistics across the entire corpus,
rather than sliding windows like Word2Vec.

```
  CO-OCCURRENCE MATRIX
                ice   steam  water  fashion
  solid      [  5      0      3       0   ]
  gas        [  0      7      2       0   ]
  liquid     [  1      1      8       0   ]
  clothing   [  0      0      0       9   ]

  GloVe factors this matrix into word vectors
  such that dot(word_i, word_j) ~ log(co-occurrence)
```

```python
import numpy as np

def load_glove(path, dim=100):
    embeddings = {}
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split()
            word = parts[0]
            vector = np.array(parts[1:], dtype=np.float32)
            if len(vector) == dim:
                embeddings[word] = vector
    return embeddings

def find_similar(word, embeddings, top_k=5):
    if word not in embeddings:
        return []
    target = embeddings[word]
    scores = []
    for other_word, vec in embeddings.items():
        if other_word == word:
            continue
        similarity = np.dot(target, vec) / (
            np.linalg.norm(target) * np.linalg.norm(vec)
        )
        scores.append((other_word, similarity))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_k]
```

## FastText: Subword Embeddings

FastText breaks words into character n-grams. This means it can handle
words it has never seen before.

```
  "unhappiness"

  Character 3-grams: <un, unh, nha, hap, app, ppi, pin, ine, nes, ess, ss>
  Character 4-grams: <unh, unha, nhap, happ, appi, ppin, pine, ines, ness, ess>

  Final embedding = average of all subword embeddings

  WHY THIS MATTERS:
  +-------------------------------------------+
  | Word2Vec: "unhappiness" = unknown word!    |
  | FastText:  "unhappiness" = combines "un",  |
  |            "happy", "ness" subwords        |
  +-------------------------------------------+
```

```python
from gensim.models import FastText

sentences = [
    ["the", "cat", "sat", "on", "the", "mat"],
    ["the", "dog", "lay", "on", "the", "rug"],
    ["cats", "and", "dogs", "are", "pets"],
    ["unhappy", "cats", "scratched", "furniture"],
    ["happiness", "comes", "from", "pets"],
]

ft_model = FastText(
    sentences,
    vector_size=50,
    window=3,
    min_count=1,
    epochs=100
)

print("Known word 'cat':", ft_model.wv.most_similar('cat', topn=2))
print("Unknown word 'catlike':", ft_model.wv.most_similar('catlike', topn=2))
```

## Comparison of Embedding Methods

```
  +----------+------------+------------+-------------+----------+
  | Method   | Handles    | Training   | Pre-trained | Context  |
  |          | OOV Words? | Speed      | Available?  | Aware?   |
  +----------+------------+------------+-------------+----------+
  | Word2Vec | No         | Fast       | Yes (Google)| No       |
  | GloVe    | No         | Medium     | Yes (Stanford)| No     |
  | FastText | Yes        | Medium     | Yes (Facebook)| No     |
  | BERT     | Yes        | Slow       | Yes (HF)    | Yes      |
  +----------+------------+------------+-------------+----------+

  OOV = Out of Vocabulary
  HF  = Hugging Face
```

## Visualizing Embeddings with t-SNE

```python
from sklearn.manifold import TSNE
import numpy as np

words = ["king", "queen", "man", "woman", "prince", "princess",
         "cat", "dog", "puppy", "kitten",
         "car", "truck", "bicycle", "motorcycle"]

vectors = np.array([model.wv[w] for w in words])

tsne = TSNE(n_components=2, random_state=42, perplexity=5)
coords = tsne.fit_transform(vectors)

for word, (x, y) in zip(words, coords):
    print(f"  {word:12} ({x:6.1f}, {y:6.1f})")
```

```
  EXPECTED CLUSTERS IN 2D:

       princess *   * queen
                  * king
        prince *    * woman
                * man
  - - - - - - - - - - - - - - - -
        kitten *  * cat
         puppy *  * dog
  - - - - - - - - - - - - - - - -
           car *  * truck
       bicycle *  * motorcycle
```

## Using Pre-trained Embeddings in Practice

```python
from gensim.models import KeyedVectors

glove_path = "glove.6B.100d.txt"

def load_glove_as_w2v(path):
    from gensim.scripts.glove2word2vec import glove2word2vec
    import tempfile, os
    tmp = tempfile.mktemp()
    glove2word2vec(path, tmp)
    model = KeyedVectors.load_word2vec_format(tmp)
    os.remove(tmp)
    return model

def get_document_embedding(text, model, dim=100):
    words = text.lower().split()
    vectors = [model[w] for w in words if w in model]
    if not vectors:
        return np.zeros(dim)
    return np.mean(vectors, axis=0)

doc_vec = get_document_embedding("natural language processing is fun", model)
print("Document vector shape:", doc_vec.shape)
```

## Exercises

1. Train a Word2Vec model on a corpus of song titles (use any 50+
   titles). Find the 5 most similar words to "love", "night", and
   "dance". Do the results make sense?

2. Implement the analogy function from scratch: given vectors for A, B,
   and C, find D such that A:B :: C:D. Test with at least 3 analogy
   pairs.

3. Compare Word2Vec and FastText on handling misspelled words. Train
   both on the same corpus, then query "helo" (misspelling of "hello"),
   "runing" (misspelling of "running"). Which handles typos better?

4. Build a simple document similarity system using averaged word
   embeddings. Given 10 short documents, find the most similar pair.

---

**Next:** [04 - Text Classification](04-text-classification.md)
