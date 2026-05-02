# Lesson 04: Text Classification

## Analogy: Sorting Mail

A mail sorter looks at each envelope and drops it into the right bin:
bills, personal letters, junk mail. Text classification does the same
thing -- read a piece of text and assign it to a category.

```
  INPUT TEXT                          CLASSIFIER              OUTPUT
  +--------------------------+       +----------+       +------------+
  | "This product is         | ----> | SORTING  | ----> | POSITIVE   |
  |  absolutely wonderful!"  |       | MACHINE  |       | SENTIMENT  |
  +--------------------------+       +----------+       +------------+

  +--------------------------+       +----------+       +------------+
  | "Buy cheap viagra now!!" | ----> | SORTING  | ----> | SPAM       |
  +--------------------------+       | MACHINE  |       +------------+
                                     +----------+
  +--------------------------+       +----------+       +------------+
  | "The Fed raised rates    | ----> | SORTING  | ----> | FINANCE    |
  |  by 0.25% today"        |       | MACHINE  |       +------------+
  +--------------------------+       +----------+
```

## The Classification Pipeline

```
  Raw Text
    |
    v
  +------------------+
  | Preprocess       |  Clean, tokenize, normalize
  +------------------+
    |
    v
  +------------------+
  | Vectorize        |  TF-IDF, embeddings, or tokenizer
  +------------------+
    |
    v
  +------------------+
  | Train Classifier |  Naive Bayes, SVM, or Transformer
  +------------------+
    |
    v
  +------------------+
  | Predict          |  Assign label to new text
  +------------------+
```

## Approach 1: Traditional ML (TF-IDF + Naive Bayes)

Naive Bayes works like a probabilistic mail sorter: it learns which
words are most likely in each category, then uses those probabilities
to classify new text.

```python
from sklearn.datasets import fetch_20newsgroups
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

categories = ['sci.space', 'rec.sport.baseball', 'comp.graphics']
train_data = fetch_20newsgroups(subset='train', categories=categories)
test_data = fetch_20newsgroups(subset='test', categories=categories)

pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(max_features=10000, stop_words='english')),
    ('clf', MultinomialNB()),
])

pipeline.fit(train_data.data, train_data.target)
predictions = pipeline.predict(test_data.data)

print(classification_report(
    test_data.target,
    predictions,
    target_names=test_data.target_names
))
```

## Approach 2: TF-IDF + SVM

SVMs find the optimal boundary between categories. Think of it as
drawing the widest possible line between groups of points.

```
  SVM Decision Boundary:

       o  o              * = Class A
      o  o  o            o = Class B
     o  o  o
    - - - - - - - - -    <-- SVM finds this boundary
         *  *  *
        *  *  *  *
       *  *  *
```

```python
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer

svm_pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(
        max_features=20000,
        ngram_range=(1, 2),
        stop_words='english'
    )),
    ('clf', LinearSVC(max_iter=10000)),
])

svm_pipeline.fit(train_data.data, train_data.target)
svm_predictions = svm_pipeline.predict(test_data.data)

print(classification_report(
    test_data.target,
    svm_predictions,
    target_names=test_data.target_names
))
```

## Approach 3: Transformer Fine-tuning

Transformers understand context. "The bank was steep" vs "The bank
raised rates" -- a transformer knows these are different.

```
  TRADITIONAL ML                    TRANSFORMER
  +------------------+              +------------------+
  | "not bad" ->     |              | "not bad" ->     |
  | "not"=negative   |              | POSITIVE!        |
  | "bad"=negative   |              | (understands     |
  | Result: NEGATIVE |              |  context)        |
  +------------------+              +------------------+
```

```python
from transformers import pipeline

classifier = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english"
)

texts = [
    "This movie was absolutely fantastic!",
    "What a waste of time.",
    "It's not bad, actually quite good.",
    "The acting was terrible but the plot saved it."
]

for text in texts:
    result = classifier(text)[0]
    print(f"  {result['label']:8} ({result['score']:.3f}) | {text}")
```

## Fine-tuning Your Own Classifier

```python
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
)
import numpy as np
from sklearn.metrics import accuracy_score

dataset = load_dataset("imdb")
tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")

def tokenize_fn(examples):
    return tokenizer(
        examples["text"],
        padding="max_length",
        truncation=True,
        max_length=256
    )

tokenized = dataset.map(tokenize_fn, batched=True)

small_train = tokenized["train"].shuffle(seed=42).select(range(2000))
small_test = tokenized["test"].shuffle(seed=42).select(range(500))

model = AutoModelForSequenceClassification.from_pretrained(
    "distilbert-base-uncased",
    num_labels=2
)

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {"accuracy": accuracy_score(labels, preds)}

training_args = TrainingArguments(
    output_dir="./results",
    num_train_epochs=3,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=64,
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=small_train,
    eval_dataset=small_test,
    compute_metrics=compute_metrics,
)

trainer.train()
```

## Multi-label Classification

Sometimes text belongs to multiple categories at once. A news article
can be both "politics" AND "economy".

```
  SINGLE-LABEL:   text -> [politics]
  MULTI-LABEL:    text -> [politics, economy, international]

  +-----------------------------------+
  | "The EU imposed tariffs on        |
  |  Chinese steel imports today"     |
  +-----------------------------------+
           |
           v
    [x] politics
    [x] economy
    [x] international
    [ ] sports
    [ ] entertainment
```

```python
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.multiclass import OneVsRestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer

texts = [
    "stock market crashed due to political tensions",
    "new basketball league announced for next season",
    "government budget affects healthcare spending",
    "celebrity wedding at luxury resort",
    "trade war impacts global economy",
]
labels = [
    ["finance", "politics"],
    ["sports"],
    ["politics", "health"],
    ["entertainment"],
    ["finance", "politics"],
]

mlb = MultiLabelBinarizer()
y = mlb.fit_transform(labels)

tfidf = TfidfVectorizer(max_features=5000)
X = tfidf.fit_transform(texts)

clf = OneVsRestClassifier(LogisticRegression(max_iter=1000))
clf.fit(X, y)

new_text = ["economic policy debate in congress"]
new_X = tfidf.transform(new_text)
prediction = clf.predict(new_X)
print("Predicted labels:", mlb.inverse_transform(prediction))
```

## Choosing Your Approach

```
  +--------------------+--------+--------+---------+----------+
  | Method             | Data   | Speed  | Accuracy| Context  |
  |                    | Needed |        |         | Aware?   |
  +--------------------+--------+--------+---------+----------+
  | Naive Bayes        | Small  | Fast   | Good    | No       |
  | SVM + TF-IDF       | Medium | Fast   | Better  | No       |
  | Logistic Regression| Medium | Fast   | Better  | No       |
  | Fine-tuned BERT    | Medium | Slow   | Best    | Yes      |
  | Zero-shot (LLM)    | None   | Medium | Good    | Yes      |
  +--------------------+--------+--------+---------+----------+
```

## Zero-shot Classification

No training data? Use a model that already understands language.

```python
from transformers import pipeline

classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the Fed announced lower rates"
candidate_labels = ["finance", "sports", "technology", "politics"]

result = classifier(text, candidate_labels)
for label, score in zip(result['labels'], result['scores']):
    print(f"  {label:12} {score:.3f}")
```

## Exercises

1. Build a spam detector using TF-IDF + Naive Bayes. Create a dataset
   of 20 spam and 20 non-spam messages. Report precision, recall, and
   F1 score.

2. Compare Naive Bayes, SVM, and Logistic Regression on the 20
   Newsgroups dataset (all 20 categories). Which performs best? Which
   trains fastest?

3. Use zero-shot classification to categorize 10 news headlines into
   ["technology", "health", "sports", "politics", "entertainment"].
   How accurate is it without any training?

4. Fine-tune a DistilBERT model on a small sentiment dataset (100
   examples per class). Compare its accuracy to a TF-IDF + SVM baseline.

---

**Next:** [05 - Named Entity Recognition](05-named-entity-recognition.md)
