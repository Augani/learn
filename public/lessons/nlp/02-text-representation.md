# Lesson 02: Text Representation

## Analogy: Summarizing a Book by Word Frequency

Imagine you read a 300-page novel and someone asks "what's it about?"
You could answer: "The word 'murder' appears 47 times, 'detective' 38
times, 'knife' 22 times." That's crude, but it gives a rough picture.
That's exactly what Bag of Words does -- summarizing text by counting.

```
  "the cat sat on the mat"

  HUMAN UNDERSTANDING         MACHINE UNDERSTANDING
  +------------------+        +---+---+---+---+---+
  | A cat is sitting |        |the|cat|sat| on|mat|
  | on a mat         |        +---+---+---+---+---+
  +------------------+        | 2 | 1 | 1 | 1 | 1 |
                               +---+---+---+---+---+
                               Numbers! Machines love these.
```

## Why Represent Text as Numbers?

ML models can't read English. They need numerical vectors. The question
is HOW to turn text into numbers while preserving meaning.

```
  TEXT -----> ??? -----> NUMBERS
           ^
           |
  This lesson covers three approaches:
  1. Bag of Words (counting)
  2. TF-IDF (weighted counting)
  3. N-grams (counting phrases)
```

## Bag of Words (BoW)

Build a vocabulary from all documents, then count how many times each
word appears in each document.

```
  Doc 1: "I love NLP"
  Doc 2: "I love cats"
  Doc 3: "NLP loves cats"

  VOCABULARY: [I, love, NLP, cats, loves]

  DOCUMENT-TERM MATRIX:
            I   love  NLP  cats  loves
  Doc 1  [  1    1     1    0     0  ]
  Doc 2  [  1    1     0    1     0  ]
  Doc 3  [  0    0     1    1     1  ]
```

```python
from sklearn.feature_extraction.text import CountVectorizer

documents = [
    "I love NLP",
    "I love cats",
    "NLP loves cats"
]

vectorizer = CountVectorizer()
bow_matrix = vectorizer.fit_transform(documents)

print("Vocabulary:", vectorizer.get_feature_names_out())
print("Matrix:\n", bow_matrix.toarray())
```

### Limitations of BoW

```
  PROBLEM 1: Word Order Lost
  "dog bites man" == "man bites dog"  (same counts!)

  PROBLEM 2: Common Words Dominate
  "the" appears 100 times, "quantum" appears 1 time
  But "quantum" is far more informative

  PROBLEM 3: Sparse Vectors
  Vocabulary of 50,000 words -> 50,000-dimensional vectors
  Most entries are zero
```

## TF-IDF: Smarter Counting

TF-IDF fixes Problem 2 by weighting words. Words that appear in EVERY
document (like "the") get downweighted. Rare, distinctive words get
boosted.

```
  TF-IDF = TF(t,d) x IDF(t)

  TF  = Term Frequency     = count of term in document
                              / total terms in document

  IDF = Inverse Document    = log(total documents
        Frequency              / documents containing term)

  +-----------+--------+--------+---------+
  | Word      | TF     | IDF    | TF-IDF  |
  +-----------+--------+--------+---------+
  | "the"     | 0.05   | 0.00   | 0.00    |  <- in every doc
  | "quantum" | 0.01   | 2.30   | 0.023   |  <- rare = valuable
  | "physics" | 0.02   | 1.60   | 0.032   |  <- somewhat rare
  +-----------+--------+--------+---------+
```

Think of it like this: if a word appears in a restaurant review but
appears in EVERY restaurant review (like "food"), it's not helpful
for distinguishing reviews. But if "truffle" appears, that's distinctive.

```python
from sklearn.feature_extraction.text import TfidfVectorizer

documents = [
    "the cat sat on the mat",
    "the dog sat on the log",
    "cats and dogs are great pets"
]

tfidf = TfidfVectorizer()
tfidf_matrix = tfidf.fit_transform(documents)

feature_names = tfidf.get_feature_names_out()

import numpy as np
for idx, doc in enumerate(documents):
    scores = tfidf_matrix[idx].toarray().flatten()
    top_indices = np.argsort(scores)[::-1][:3]
    top_words = [(feature_names[i], round(scores[i], 3)) for i in top_indices]
    print(f"Doc {idx}: {top_words}")
```

### TF-IDF for Document Similarity

```python
from sklearn.metrics.pairwise import cosine_similarity

documents = [
    "machine learning is a branch of artificial intelligence",
    "deep learning uses neural networks for AI tasks",
    "the weather today is sunny and warm",
    "neural networks are inspired by the human brain"
]

tfidf = TfidfVectorizer()
matrix = tfidf.fit_transform(documents)

similarity = cosine_similarity(matrix)

for i in range(len(documents)):
    for j in range(i + 1, len(documents)):
        print(f"Doc {i} vs Doc {j}: {similarity[i][j]:.3f}")
```

## N-grams: Capturing Word Order

N-grams partially solve the word-order problem by looking at sequences
of N consecutive words.

```
  "the cat sat on the mat"

  UNIGRAMS (n=1):  ["the", "cat", "sat", "on", "the", "mat"]
  BIGRAMS  (n=2):  ["the cat", "cat sat", "sat on", "on the", "the mat"]
  TRIGRAMS (n=3):  ["the cat sat", "cat sat on", "sat on the", "on the mat"]

  +--------------------------------------------------+
  |  n=1: Individual words      (least context)      |
  |  n=2: Word pairs            (some context)        |
  |  n=3: Word triplets         (more context)        |
  |  n=4+: Longer phrases       (sparse, expensive)   |
  +--------------------------------------------------+
```

```python
from sklearn.feature_extraction.text import CountVectorizer

documents = [
    "New York is a great city",
    "I love New York pizza",
    "York is in England"
]

unigram_vec = CountVectorizer(ngram_range=(1, 1))
bigram_vec = CountVectorizer(ngram_range=(1, 2))

unigram_matrix = unigram_vec.fit_transform(documents)
bigram_matrix = bigram_vec.fit_transform(documents)

print("Unigram features:", unigram_vec.get_feature_names_out())
print("Bigram features:", bigram_vec.get_feature_names_out())
```

Notice how bigrams capture "new york" as a single feature -- much more
meaningful than "new" and "york" separately.

## Combining TF-IDF with N-grams

```python
tfidf_ngram = TfidfVectorizer(
    ngram_range=(1, 2),
    max_features=1000,
    min_df=2,
    max_df=0.95
)
```

```
  PARAMETER        WHAT IT DOES
  +---------------+-------------------------------------------+
  | ngram_range   | (1,2) means unigrams + bigrams            |
  | max_features  | Keep only top 1000 features               |
  | min_df        | Ignore words in < 2 documents             |
  | max_df        | Ignore words in > 95% of documents        |
  +---------------+-------------------------------------------+
```

## Practical Example: Document Search Engine

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

corpus = [
    "Python is a popular programming language for data science",
    "JavaScript is used for web development and frontend",
    "Machine learning algorithms learn patterns from data",
    "Web frameworks like Django and Flask use Python",
    "Neural networks are a type of machine learning model",
    "React and Vue are JavaScript frontend frameworks"
]

tfidf = TfidfVectorizer(ngram_range=(1, 2), stop_words='english')
doc_vectors = tfidf.fit_transform(corpus)

def search(query, top_k=3):
    query_vec = tfidf.transform([query])
    scores = cosine_similarity(query_vec, doc_vectors).flatten()
    ranked = np.argsort(scores)[::-1][:top_k]
    results = []
    for idx in ranked:
        if scores[idx] > 0:
            results.append((corpus[idx], round(scores[idx], 3)))
    return results

for doc, score in search("python data science"):
    print(f"  [{score}] {doc}")
```

## Comparison of Approaches

```
  +------------------+----------+-----------+-------------+
  | Method           | Speed    | Captures  | Best For    |
  |                  |          | Meaning?  |             |
  +------------------+----------+-----------+-------------+
  | Bag of Words     | Fast     | No        | Baselines   |
  | TF-IDF           | Fast     | Slightly  | Search, IR  |
  | N-gram TF-IDF    | Medium   | Somewhat  | Classification|
  | Word Embeddings  | Slower   | Yes       | Next lesson!|
  +------------------+----------+-----------+-------------+
```

## Exercises

1. Build a TF-IDF search engine over a collection of 10 news headlines.
   Test it with 3 different queries and print the top 2 results for each.

2. Compare unigram, bigram, and trigram BoW representations for these
   sentences: "New York Times", "York is old", "New times ahead".
   Show why bigrams help disambiguate "New York".

3. Given a dataset of 5 movie reviews, compute the TF-IDF matrix and
   find the 3 most distinctive words per review. Explain why TF-IDF
   highlights those words.

4. Build a duplicate detector: given a list of 10 sentences, use TF-IDF
   cosine similarity to find all pairs with similarity > 0.5.

---

**Next:** [03 - Word Embeddings](03-word-embeddings.md)
