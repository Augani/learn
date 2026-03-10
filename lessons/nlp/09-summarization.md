# Lesson 09: Summarization

## Analogy: Two Types of Note-Takers

**Extractive** summarization is like a student who highlights the most
important sentences in a textbook and copies them verbatim.

**Abstractive** summarization is like a student who reads the chapter,
closes the book, and writes a summary in their own words.

```
  ORIGINAL TEXT:
  "The global economy grew by 3.2% in 2024. Emerging markets
   led the growth with 4.5% expansion. However, advanced
   economies only managed 1.8%. Inflation remained a concern
   across all regions."

  EXTRACTIVE SUMMARY:
  "The global economy grew by 3.2% in 2024. Inflation
   remained a concern across all regions."
   ^--- copied verbatim from original

  ABSTRACTIVE SUMMARY:
  "Global GDP rose 3.2% in 2024, driven by emerging markets,
   while inflation persisted worldwide."
   ^--- rephrased, condensed, new wording
```

## Extractive vs Abstractive

```
  +------------------+-------------------+-------------------+
  | Feature          | Extractive        | Abstractive       |
  +------------------+-------------------+-------------------+
  | Method           | Select sentences  | Generate new text |
  | Faithfulness     | High (verbatim)   | Can hallucinate   |
  | Fluency          | Can be choppy     | Natural           |
  | Compression      | Limited           | High              |
  | Speed            | Fast              | Slower            |
  | Needs ML model?  | Not necessarily   | Yes (transformer) |
  +------------------+-------------------+-------------------+
```

## TextRank: Extractive Summarization

TextRank is like PageRank for sentences. Sentences that are similar
to many other sentences are considered "central" and important.

```
  SENTENCE GRAPH:

  S1 ---0.8--- S2
  |  \          |
  0.3  0.6    0.7
  |      \      |
  S3 ---0.2--- S4

  S2 has the highest connectivity -> most important
  S4 is also highly connected -> second most important

  Summary = S2 + S4
```

```python
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def textrank_summarize(text, num_sentences=3):
    sentences = text.replace('\n', ' ').split('. ')
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

    if len(sentences) <= num_sentences:
        return '. '.join(sentences)

    tfidf = TfidfVectorizer()
    tfidf_matrix = tfidf.fit_transform(sentences)
    similarity_matrix = cosine_similarity(tfidf_matrix)

    np.fill_diagonal(similarity_matrix, 0)

    scores = np.ones(len(sentences))
    damping = 0.85

    for _ in range(30):
        new_scores = np.zeros(len(sentences))
        for i in range(len(sentences)):
            for j in range(len(sentences)):
                if similarity_matrix[j].sum() > 0:
                    new_scores[i] += (
                        similarity_matrix[i][j]
                        / similarity_matrix[j].sum()
                        * scores[j]
                    )
        scores = (1 - damping) + damping * new_scores

    ranked_indices = np.argsort(scores)[::-1][:num_sentences]
    ranked_indices = sorted(ranked_indices)

    summary = '. '.join(sentences[i] for i in ranked_indices)
    return summary + '.'

text = """
The Amazon rainforest is the largest tropical rainforest in the world.
It covers over 5.5 million square kilometers across nine countries.
Brazil contains about 60% of the Amazon. The forest is home to
approximately 10% of all species on Earth. Deforestation has been a
major threat, with significant losses occurring each year. Scientists
warn that continued deforestation could push the Amazon past a tipping
point. Conservation efforts have increased in recent years. Indigenous
communities play a vital role in protecting the forest. The Amazon also
produces about 20% of the world's oxygen.
"""

print(textrank_summarize(text, num_sentences=3))
```

## Transformer-Based Summarization

```python
from transformers import pipeline

summarizer = pipeline(
    "summarization",
    model="facebook/bart-large-cnn"
)

article = """
The European Space Agency announced Tuesday that its new space telescope
has captured the most detailed images ever taken of distant galaxies.
The telescope, launched in 2023, uses advanced infrared sensors that
can peer through cosmic dust. Scientists say the images reveal
previously unknown structures in galaxies billions of light years away.
The discovery could change our understanding of how galaxies form and
evolve. The research team plans to release the full dataset to the
public next month, allowing astronomers worldwide to analyze the findings.
"""

summary = summarizer(
    article,
    max_length=60,
    min_length=20,
    do_sample=False
)
print(summary[0]['summary_text'])
```

## Controlling Summary Length

```
  SHORT (1 sentence):     max_length=30
  "ESA telescope captures unprecedented galaxy images."

  MEDIUM (2-3 sentences): max_length=80
  "ESA's new telescope captured the most detailed galaxy images
   ever. The discovery may change our understanding of galaxy
   formation."

  LONG (paragraph):       max_length=150
  "The European Space Agency announced that its new space
   telescope has captured unprecedented images of distant
   galaxies using infrared sensors. Scientists say the images
   reveal unknown structures that could transform our
   understanding of galaxy evolution. The full dataset will
   be released publicly next month."
```

```python
for length in [30, 60, 120]:
    result = summarizer(article, max_length=length, min_length=10, do_sample=False)
    print(f"\n  max_length={length}:")
    print(f"  {result[0]['summary_text']}")
```

## Summarizing Long Documents

Transformers have a token limit (512-1024 tokens typically). For long
documents, you need a chunking strategy.

```
  LONG DOCUMENT (5000 tokens)
  +-----+-----+-----+-----+-----+
  |Chunk|Chunk|Chunk|Chunk|Chunk|
  |  1  |  2  |  3  |  4  |  5  |
  +-----+-----+-----+-----+-----+
     |     |     |     |     |
     v     v     v     v     v
  +-----+-----+-----+-----+-----+
  |Sum 1|Sum 2|Sum 3|Sum 4|Sum 5|  <- summarize each chunk
  +-----+-----+-----+-----+-----+
     \     \    |    /     /
      \     \   |   /     /
       v     v  v  v     v
       +-----------------+
       | FINAL SUMMARY   |         <- summarize the summaries
       +-----------------+
```

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

def chunk_text(text, max_chunk_size=500):
    words = text.split()
    chunks = []
    current_chunk = []
    current_size = 0

    for word in words:
        current_chunk.append(word)
        current_size += 1
        if current_size >= max_chunk_size:
            chunks.append(' '.join(current_chunk))
            current_chunk = []
            current_size = 0

    if current_chunk:
        chunks.append(' '.join(current_chunk))
    return chunks

def summarize_long_document(text, max_chunk_size=400, final_max_length=150):
    chunks = chunk_text(text, max_chunk_size)

    if len(chunks) == 1:
        result = summarizer(chunks[0], max_length=final_max_length, min_length=30)
        return result[0]['summary_text']

    chunk_summaries = []
    for chunk in chunks:
        if len(chunk.split()) < 30:
            chunk_summaries.append(chunk)
            continue
        result = summarizer(chunk, max_length=100, min_length=20, do_sample=False)
        chunk_summaries.append(result[0]['summary_text'])

    combined = ' '.join(chunk_summaries)

    if len(combined.split()) > max_chunk_size:
        return summarize_long_document(combined, max_chunk_size, final_max_length)

    result = summarizer(combined, max_length=final_max_length, min_length=30)
    return result[0]['summary_text']
```

## Evaluating Summaries

```
  GOOD SUMMARY:                      BAD SUMMARY:
  +----------------------------+     +----------------------------+
  | Covers key points          |     | Misses main idea           |
  | Accurate to source         |     | Introduces false info      |
  | Concise                    |     | Too long or too short      |
  | Coherent flow              |     | Choppy, disconnected       |
  +----------------------------+     +----------------------------+
```

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(
    ['rouge1', 'rouge2', 'rougeL'],
    use_stemmer=True
)

reference = "The telescope captured detailed galaxy images that may change astronomy."
generated = "ESA's new telescope took unprecedented photos of distant galaxies."

scores = scorer.score(reference, generated)
for metric, values in scores.items():
    print(f"  {metric}: precision={values.precision:.3f} "
          f"recall={values.recall:.3f} f1={values.fmeasure:.3f}")
```

## Exercises

1. Implement TextRank from scratch (no libraries for the ranking part).
   Test it on 3 different articles and compare with the transformers
   summarizer output.

2. Summarize the same article at 3 different compression ratios (25%,
   50%, 75% of original length). Which ratio produces the best summary?

3. Build a long-document summarizer that handles text over 2000 words.
   Use the chunking strategy above. Test on a long Wikipedia article.

4. Compare extractive (TextRank) and abstractive (BART) summaries on
   5 news articles. Rate each on faithfulness (1-5) and fluency (1-5).
   Which method wins on each dimension?

---

**Next:** [10 - Machine Translation](10-machine-translation.md)
