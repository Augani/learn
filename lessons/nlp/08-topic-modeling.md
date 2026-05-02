# Lesson 08: Topic Modeling

## Analogy: Sorting a Pile of Unlabeled Photos

Imagine dumping 10,000 photos on a table and being asked to organize
them into groups WITHOUT being told what groups to use. You'd naturally
create piles: "beach photos", "family dinners", "work events." Topic
modeling does the same thing with documents -- discovers hidden themes
without being told what to look for.

```
  UNSORTED DOCUMENTS                    DISCOVERED TOPICS
  +----+----+----+----+               +------------------+
  |doc1|doc2|doc3|doc4|               | Topic 1: SPORTS  |
  +----+----+----+----+               |   game, team,    |
  |doc5|doc6|doc7|doc8|   -------->   |   score, player  |
  +----+----+----+----+               +------------------+
  |doc9|....|....|....|               | Topic 2: TECH    |
  +----+----+----+----+               |   data, model,   |
  No labels!                          |   algorithm, AI  |
                                      +------------------+
                                      | Topic 3: FOOD    |
                                      |   recipe, cook,  |
                                      |   ingredient     |
                                      +------------------+
```

## LDA: Latent Dirichlet Allocation

LDA assumes every document is a mixture of topics, and every topic
is a mixture of words.

```
  DOCUMENT = MIXTURE OF TOPICS

  "I enjoyed the game at the stadium.
   The food there was also great."

  +--Topic Distribution--+
  | Sports:  60%         |
  | Food:    30%         |
  | Travel:  10%         |
  +----------------------+

  TOPIC = MIXTURE OF WORDS

  Topic "Sports":
  +---+---+---+---+---+---+
  |game|team|score|win|play|...|
  |0.15|0.12|0.10|0.09|0.08|...|
  +---+---+---+---+---+---+
```

```python
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.feature_extraction.text import CountVectorizer

documents = [
    "The team scored three goals in the championship game",
    "Players trained hard for the upcoming tournament match",
    "The recipe calls for fresh basil and mozzarella cheese",
    "Cooking pasta requires boiling water and salt",
    "Neural networks learn patterns from training data",
    "Deep learning models require GPU for faster training",
    "The goalkeeper saved a penalty kick in overtime",
    "Bake the cake at 350 degrees for 30 minutes",
    "Machine learning algorithms optimize loss functions",
    "The chef prepared a five course dinner menu",
]

vectorizer = CountVectorizer(
    max_features=1000,
    stop_words='english',
    max_df=0.9,
    min_df=2
)
doc_term_matrix = vectorizer.fit_transform(documents)

lda = LatentDirichletAllocation(
    n_components=3,
    random_state=42,
    max_iter=20
)
lda.fit(doc_term_matrix)

feature_names = vectorizer.get_feature_names_out()

for topic_idx, topic in enumerate(lda.components_):
    top_words_idx = topic.argsort()[-5:][::-1]
    top_words = [feature_names[i] for i in top_words_idx]
    print(f"  Topic {topic_idx}: {', '.join(top_words)}")
```

### Document-Topic Distribution

```python
doc_topics = lda.transform(doc_term_matrix)

for idx, (doc, topics) in enumerate(zip(documents, doc_topics)):
    dominant_topic = topics.argmax()
    print(f"  Doc {idx} -> Topic {dominant_topic} "
          f"({topics[dominant_topic]:.2f}) | {doc[:50]}...")
```

## BERTopic: Modern Topic Modeling

BERTopic uses transformer embeddings + clustering for much better
topics than LDA. It understands meaning, not just word counts.

```
  LDA APPROACH:                     BERTOPIC APPROACH:
  +------------------+              +------------------+
  | Count words      |              | Embed documents  |
  | in each document |              | with transformers|
  +------------------+              +------------------+
         |                                  |
         v                                  v
  +------------------+              +------------------+
  | Statistical       |              | Reduce dimensions|
  | decomposition     |              | with UMAP        |
  +------------------+              +------------------+
         |                                  |
         v                                  v
  +------------------+              +------------------+
  | Word-based topics |              | Cluster with     |
  | (misses synonyms) |              | HDBSCAN          |
  +------------------+              +------------------+
                                           |
                                           v
                                    +------------------+
                                    | Extract topic    |
                                    | words with c-TF-IDF|
                                    +------------------+
```

```python
from bertopic import BERTopic

documents = [
    "The stock market crashed due to inflation fears",
    "Investors pulled money from tech stocks",
    "The Federal Reserve raised interest rates again",
    "Bitcoin price dropped below 30000 dollars",
    "Scientists discovered a new species in the Amazon",
    "Climate change affects biodiversity worldwide",
    "New research on gene editing shows promise",
    "The Mars rover found evidence of ancient water",
    "Liverpool won the Champions League final",
    "The Olympics will be held in Paris next year",
    "Tennis star retired after 20 years of competition",
    "World Cup qualifiers begin next month",
]

topic_model = BERTopic(
    nr_topics="auto",
    min_topic_size=2,
    verbose=False
)

topics, probabilities = topic_model.fit_transform(documents)

topic_info = topic_model.get_topic_info()
print(topic_info[['Topic', 'Count', 'Name']])

for topic_id in set(topics):
    if topic_id == -1:
        continue
    print(f"\n  Topic {topic_id}:")
    for word, score in topic_model.get_topic(topic_id)[:5]:
        print(f"    {word:20} ({score:.4f})")
```

## Choosing Number of Topics

```
  TOO FEW TOPICS:          JUST RIGHT:           TOO MANY TOPICS:
  +---------------+        +----------+           +-----+
  | Everything    |        | Sports   |           |Golf |
  | lumped        |        | Finance  |           |Tennis|
  | together      |        | Science  |           |Soccer|
  +---------------+        +----------+           |Swim |
                                                  |Track|
  Useless                  Interpretable          +-----+
                                                  Fragmented
```

```python
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.feature_extraction.text import CountVectorizer
import numpy as np

def find_optimal_topics(documents, min_topics=2, max_topics=10):
    vectorizer = CountVectorizer(stop_words='english', max_df=0.9, min_df=2)
    dtm = vectorizer.fit_transform(documents)

    results = []
    for n in range(min_topics, max_topics + 1):
        lda = LatentDirichletAllocation(
            n_components=n,
            random_state=42,
            max_iter=20
        )
        lda.fit(dtm)
        perplexity = lda.perplexity(dtm)
        results.append((n, perplexity))
        print(f"  Topics={n:2d} | Perplexity={perplexity:.1f}")

    return results
```

## Topic Modeling at Scale

```python
from bertopic import BERTopic
from sentence_transformers import SentenceTransformer

embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

topic_model = BERTopic(
    embedding_model=embedding_model,
    nr_topics=20,
    calculate_probabilities=False,
    verbose=True
)
```

## Visualizing Topics

```python
def print_topic_summary(topic_model, documents, topics):
    topic_counts = {}
    for topic_id in topics:
        topic_counts[topic_id] = topic_counts.get(topic_id, 0) + 1

    for topic_id in sorted(topic_counts.keys()):
        if topic_id == -1:
            label = "OUTLIERS"
        else:
            words = [w for w, _ in topic_model.get_topic(topic_id)[:3]]
            label = " | ".join(words)

        count = topic_counts[topic_id]
        bar = "#" * min(count, 40)
        print(f"  Topic {topic_id:3d} [{count:4d}] {bar} {label}")
```

```
  EXAMPLE OUTPUT:

  Topic  -1 [  23] ####################### OUTLIERS
  Topic   0 [ 145] ################################ stock | market | price
  Topic   1 [  98] ######################## climate | carbon | emission
  Topic   2 [  87] ###################### game | player | team
  Topic   3 [  56] ############## recipe | cook | ingredient
  Topic   4 [  34] ######### neural | network | training
```

## Dynamic Topic Modeling

Track how topics evolve over time.

```python
from bertopic import BERTopic

timestamps = [
    "2023-01", "2023-01", "2023-02", "2023-02",
    "2023-03", "2023-03", "2023-04", "2023-04",
]

documents = [
    "AI chatbot launched by tech company",
    "New language model breaks benchmarks",
    "Concerns about AI safety grow",
    "Regulators discuss AI governance",
    "AI used in healthcare diagnosis",
    "AI art generators face copyright issues",
    "AI coding assistants boost productivity",
    "AI regulation bill proposed in congress",
]

topic_model = BERTopic(min_topic_size=2, verbose=False)
topics, _ = topic_model.fit_transform(documents)

topics_over_time = topic_model.topics_over_time(
    documents,
    timestamps,
    nr_bins=4
)
print(topics_over_time)
```

## LDA vs BERTopic Comparison

```
  +------------------+--------------+----------------+
  | Feature          | LDA          | BERTopic       |
  +------------------+--------------+----------------+
  | Input            | Word counts  | Embeddings     |
  | Understands      | No           | Yes            |
  |   Synonyms?      |              |                |
  | Speed            | Fast         | Slower         |
  | Topic Quality    | Decent       | Excellent      |
  | Interpretability | High         | High           |
  | Needs # Topics?  | Yes          | No (auto)      |
  | Handles Short    | Poorly       | Well           |
  |   Text?          |              |                |
  +------------------+--------------+----------------+
```

## Exercises

1. Run LDA on a collection of 50+ news headlines from different
   categories (use the `fetch_20newsgroups` dataset or collect your
   own). Do the discovered topics match the actual categories?

2. Use BERTopic on a set of product reviews. What themes emerge? Are
   they useful for understanding customer feedback?

3. Compare LDA with 5 topics vs BERTopic (auto topics) on the same
   corpus of 100+ documents. Which produces more interpretable topics?

4. Implement dynamic topic modeling on a dataset with timestamps.
   Track how topic popularity changes over time and print a timeline
   showing which topics grow or shrink.

---

**Next:** [09 - Summarization](09-summarization.md)
