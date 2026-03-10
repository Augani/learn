# Lesson 09: Dataset Creation

> **Analogy**: Your model is only as good as its training data, the
> same way a chef is only as good as their ingredients. You can have
> the most sophisticated recipe (architecture) in the world, but if
> your tomatoes are rotten (data is noisy), your sauce will be bad.
> Most ML failures are data failures in disguise.

---

## Why Build Your Own Dataset?

Public benchmarks are great for comparing methods. They're terrible
for solving real problems. Your specific problem almost certainly
doesn't have a perfect dataset already.

```
Public datasets:              Your problem:
  Clean labels                  Noisy, ambiguous labels
  Standard categories           Domain-specific categories
  Balanced classes              Wildly imbalanced
  Fixed distribution            Shifting distribution
  English text                  Mixed language, jargon
  Stock photos                  Factory floor images at 3am
```

Building a good dataset is often the highest-leverage work you can
do. A simple model on great data beats a complex model on mediocre
data almost every time.

---

## Data Collection Strategies

### Strategy 1: Scraping and Public Sources

The cheapest approach, but you get what you get.

```
Sources:
  Web scraping        --> High volume, noisy, legal concerns
  APIs (Twitter, etc) --> Structured, rate-limited
  Open datasets       --> Clean, but may not fit your domain
  Government data     --> Often high quality, specific domains
  Academic datasets   --> Well-documented, narrow scope

Quality pyramid:
                  /\
                 /  \  Curated (expensive, high quality)
                /    \
               /------\
              / Filtered\ (moderate cost, decent quality)
             /   from    \
            /   scraping  \
           /----------------\
          / Raw scraped data  \ (cheap, low quality)
         /                      \
        /--------------------------\
```

### Strategy 2: Synthetic Data Generation

When real data is scarce, expensive, or privacy-sensitive.

```python
import random

def generate_synthetic_receipt(template_params):
    store_names = ["GROCERY MART", "FRESH FOODS", "CORNER STORE"]
    items = ["Milk 2%", "Bread Wheat", "Eggs Large", "Apples Gala",
             "Chicken Breast", "Rice Brown", "Pasta Penne"]

    store = random.choice(store_names)
    num_items = random.randint(2, 8)
    selected = random.sample(items, min(num_items, len(items)))

    receipt_lines = [store, "=" * 20]
    total = 0.0
    for item in selected:
        price = round(random.uniform(1.99, 15.99), 2)
        total += price
        receipt_lines.append(f"{item:<20} ${price:.2f}")

    receipt_lines.append("-" * 20)
    receipt_lines.append(f"{'TOTAL':<20} ${total:.2f}")

    return {
        "text": "\n".join(receipt_lines),
        "labels": {
            "store": store,
            "items": selected,
            "total": total,
        }
    }
```

```
When synthetic data works well:
  - Document processing (generate infinite variations)
  - Robotics (simulation before real-world)
  - Rare events (fraud, defects)
  - Privacy-sensitive domains (medical, financial)
  - Data augmentation (extending small real datasets)

When it doesn't:
  - The real distribution is too complex to model
  - Edge cases in reality aren't captured
  - Domain gap between synthetic and real is too large
```

### Strategy 3: Active Learning

Let the model tell you which samples to label next. Label the ones
the model is most uncertain about.

```python
def active_learning_loop(model, unlabeled_pool, labeled_set,
                         oracle, num_rounds=10, samples_per_round=100):
    for round_num in range(num_rounds):
        model = train_model(model, labeled_set)

        uncertainties = compute_uncertainty(model, unlabeled_pool)

        top_indices = uncertainties.argsort(descending=True)[:samples_per_round]
        selected = [unlabeled_pool[i] for i in top_indices]

        labeled = oracle.annotate(selected)
        labeled_set.extend(labeled)

        for idx in sorted(top_indices, reverse=True):
            unlabeled_pool.pop(idx)

        accuracy = evaluate(model, test_set)
        print(f"Round {round_num}: {len(labeled_set)} labels, "
              f"accuracy={accuracy:.4f}")

    return model, labeled_set


def compute_uncertainty(model, data, method="entropy"):
    model.eval()
    uncertainties = []
    with torch.no_grad():
        for sample in data:
            logits = model(sample["input"].unsqueeze(0))
            probs = F.softmax(logits, dim=-1)

            if method == "entropy":
                entropy = -(probs * torch.log(probs + 1e-8)).sum()
                uncertainties.append(entropy.item())
            elif method == "margin":
                sorted_probs = probs.sort(descending=True).values
                margin = (sorted_probs[0, 0] - sorted_probs[0, 1]).item()
                uncertainties.append(-margin)

    return torch.tensor(uncertainties)
```

```
Active learning efficiency:

  Labels needed vs accuracy:

  Acc
  90% |                     xxxxxxxx  <-- Active learning
  85% |                xxxxx
  80% |           xxxxx.........xxx   <-- Random sampling
  75% |      xxxx....xxxx
  70% | xxxxx.xxxx
      +--+---+---+---+---+---+---> Labels
        100  500 1K  2K  5K  10K

  Active learning reaches 90% with ~3K labels.
  Random sampling needs ~8K for the same accuracy.
```

---

## Annotation Tools and Workflows

### Choosing an Annotation Tool

```
+------------------+--------------+--------------------------------+
| Tool             | Best For     | Notes                          |
+------------------+--------------+--------------------------------+
| Label Studio     | Everything   | Open-source, self-hosted       |
| Prodigy          | NLP, fast    | By spaCy team, active learning |
| CVAT             | Computer     | Open-source, video support     |
|                  | vision       |                                |
| Labelbox         | Enterprise   | Managed, expensive             |
| Amazon SageMaker | Crowd        | Mechanical Turk integration    |
| Ground Truth     | sourcing     |                                |
| Doccano          | Text/NLP     | Simple, open-source            |
+------------------+--------------+--------------------------------+
```

### Annotation Guidelines

The most important document you'll write. Annotators need to make
consistent decisions across thousands of examples.

```
Good annotation guideline structure:

  1. Task description (what are we labeling?)
  2. Label definitions (what does each label mean?)
  3. Decision rules (when to choose X over Y)
  4. Edge cases (ambiguous examples with correct answers)
  5. Common mistakes (what NOT to do)
  6. Examples (10-20 labeled examples covering all labels)
```

Example guideline for sentiment classification:

```
TASK: Classify customer reviews as positive, negative, or neutral.

DEFINITIONS:
  Positive: Customer expresses satisfaction with product/service
  Negative: Customer expresses dissatisfaction
  Neutral:  Factual statement, question, or mixed sentiment

DECISION RULES:
  - If both positive and negative, choose whichever is STRONGER
  - Sarcasm should be labeled by INTENDED meaning, not literal
  - Star ratings don't determine label (5-star with complaints = negative)

EDGE CASES:
  "Works fine." --> Neutral (factual, no strong sentiment)
  "It's okay I guess." --> Negative (implies disappointment)
  "Best purchase ever!!" --> Positive (clear enthusiasm)
  "5 stars but the shipping was terrible" --> Negative (complaint focus)
```

### Measuring Annotation Quality

```
Inter-Annotator Agreement (IAA):

  Have 2+ annotators label the same samples.
  Measure agreement with Cohen's Kappa or Fleiss' Kappa.

  Kappa interpretation:
    0.81 - 1.00:  Almost perfect (ready to use)
    0.61 - 0.80:  Substantial (acceptable for most tasks)
    0.41 - 0.60:  Moderate (need better guidelines)
    0.21 - 0.40:  Fair (serious problems)
    0.00 - 0.20:  Slight (task may be ill-defined)
```

```python
from sklearn.metrics import cohen_kappa_score

def measure_agreement(annotator_a, annotator_b):
    kappa = cohen_kappa_score(annotator_a, annotator_b)
    agreement_pct = sum(a == b for a, b in zip(annotator_a, annotator_b)) / len(annotator_a)
    print(f"Raw agreement: {agreement_pct:.1%}")
    print(f"Cohen's Kappa: {kappa:.3f}")

    if kappa < 0.6:
        print("WARNING: Low agreement. Review annotation guidelines.")
        disagreements = [
            (i, a, b) for i, (a, b) in enumerate(zip(annotator_a, annotator_b))
            if a != b
        ]
        print(f"Disagreements: {len(disagreements)} / {len(annotator_a)}")
    return kappa
```

---

## Quality Control

### Catching Bad Labels

```python
def find_suspicious_labels(model, dataset, threshold=0.95):
    """
    Find samples where a trained model strongly disagrees with the label.
    These are likely mislabeled.
    """
    model.eval()
    suspicious = []

    with torch.no_grad():
        for idx, (input_data, label) in enumerate(dataset):
            logits = model(input_data.unsqueeze(0))
            probs = F.softmax(logits, dim=-1)
            predicted_prob = probs[0, label].item()
            predicted_class = probs.argmax(dim=-1).item()

            if predicted_prob < (1 - threshold) and predicted_class != label:
                suspicious.append({
                    "index": idx,
                    "given_label": label,
                    "predicted_label": predicted_class,
                    "confidence": probs[0, predicted_class].item(),
                })

    suspicious.sort(key=lambda x: x["confidence"], reverse=True)
    return suspicious
```

### The Confident Learning Approach

Train a model, then use its predictions to find label errors.
From the cleanlab library and research.

```
The idea:

  1. Train a model on noisy data
  2. Get predicted probabilities for each sample
  3. Estimate the noise matrix (which labels get confused)
  4. Identify samples likely to be mislabeled
  5. Fix or remove those samples
  6. Retrain on cleaner data

  Accuracy before cleaning: 87%
  Accuracy after cleaning:  92%  (just by fixing ~5% of labels!)
```

---

## Handling Bias

Every dataset has biases. The question is whether you've identified
them and what you're doing about them.

### Common Dataset Biases

```
+-------------------+------------------------------------------+
| Bias Type         | Example                                  |
+-------------------+------------------------------------------+
| Selection bias    | Training on English Wikipedia misses     |
|                   | non-English knowledge                    |
+-------------------+------------------------------------------+
| Label bias        | Annotators from one culture disagree     |
|                   | with annotators from another             |
+-------------------+------------------------------------------+
| Representation    | Face datasets overrepresenting certain   |
| bias              | demographics                             |
+-------------------+------------------------------------------+
| Measurement bias  | Sensor quality varies across locations   |
+-------------------+------------------------------------------+
| Historical bias   | Data reflects past discrimination        |
+-------------------+------------------------------------------+
| Survivorship bias | Only successful examples are in the data |
+-------------------+------------------------------------------+
```

### Bias Audit Checklist

```
For any dataset:

  [ ] Who collected this data? (What were their incentives?)
  [ ] Who is represented? Who is missing?
  [ ] What time period? (Distribution shift since then?)
  [ ] What geography/language/culture?
  [ ] Were annotators diverse?
  [ ] Are there proxy variables for protected attributes?
  [ ] Have you tested model performance across subgroups?
  [ ] Is the label definition culturally dependent?
```

### Measuring Representation

```python
def audit_representation(dataset, attribute_column, expected_distribution=None):
    from collections import Counter

    counts = Counter(sample[attribute_column] for sample in dataset)
    total = sum(counts.values())

    print(f"Attribute: {attribute_column}")
    print(f"Total samples: {total}")
    print(f"Unique values: {len(counts)}")
    print()

    for value, count in counts.most_common():
        pct = count / total * 100
        bar = "#" * int(pct / 2)
        expected = ""
        if expected_distribution and value in expected_distribution:
            expected = f" (expected: {expected_distribution[value]:.1f}%)"
        print(f"  {value:>20}: {count:>6} ({pct:5.1f}%){expected} {bar}")
```

---

## Dataset Documentation

A dataset without documentation is a liability. Two standard
formats exist.

### Datasheets for Datasets

From Gebru et al., 2021. Answer these questions:

```
MOTIVATION:
  Why was this dataset created?
  Who created it and on behalf of whom?
  Who funded the creation?

COMPOSITION:
  What do the instances represent?
  How many instances are there?
  What data does each instance consist of?
  Is there a label or target associated with each instance?
  Are there missing values?
  Are there relationships between instances?

COLLECTION PROCESS:
  How was the data collected?
  Who was involved in the collection?
  Over what time frame?
  Were there ethical review processes?

PREPROCESSING:
  Was any preprocessing applied?
  Was the raw data saved in addition to preprocessed?

USES:
  What tasks has the dataset been used for?
  What tasks should it NOT be used for?

DISTRIBUTION:
  Will the dataset be distributed? How?
  When was it first released?
  What license?

MAINTENANCE:
  Who maintains the dataset?
  How can errors be reported?
  Will it be updated?
```

### Data Cards (Shorter Format)

```yaml
dataset_name: "Customer Support Tickets v2"
version: "2.0.0"
release_date: "2024-03-01"
size: "150,000 tickets"
languages: ["en", "es", "fr"]
license: "Internal use only"

task: "Multi-label classification"
labels:
  - billing (23%)
  - technical (31%)
  - account (18%)
  - shipping (15%)
  - other (13%)

collection:
  source: "Zendesk export, Jan 2023 - Dec 2023"
  preprocessing: "PII removed, URLs normalized"
  annotation: "2 annotators, kappa=0.78"

known_issues:
  - "Holiday season overrepresented (Nov-Dec = 35% of data)"
  - "Spanish tickets only from Mexico, not Spain"
  - "'Other' category is a catch-all, may contain distinct subtypes"

ethical_considerations:
  - "Contains customer complaints -- not representative of general satisfaction"
  - "Demographic information not collected; cannot audit for demographic bias"
```

---

## Practical Exercise

Build a small text classification dataset from scratch:

1. **Define the task**: Pick 3-4 categories for short text (tweets,
   headlines, or product reviews)
2. **Write annotation guidelines**: Include definitions, decision
   rules, and 10 examples
3. **Collect data**: Gather 200-500 samples (scrape, API, or manual)
4. **Label it**: Have two people label independently
5. **Measure agreement**: Compute Cohen's Kappa
6. **Clean it**: Find and fix label errors
7. **Document it**: Write a data card
8. **Split it**: Create train/val/test splits (stratified)

This exercise teaches you more about ML than implementing five
papers.

---

## Key Takeaways

- Building the right dataset is often the highest-leverage ML work
- Annotation guidelines determine label quality -- invest time here
- Measure inter-annotator agreement before training anything
- Use confident learning to find and fix label errors in existing
  datasets
- Every dataset has biases -- the question is whether you've
  identified them
- Document your datasets with datasheets or data cards
- Active learning can dramatically reduce labeling costs

Next lesson: you've built models and datasets. Now let's benchmark
them fairly.
