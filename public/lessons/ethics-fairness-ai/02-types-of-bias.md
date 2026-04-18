# Lesson 02: Types of Bias in ML

> Bias doesn't announce itself — it hides in your data, your algorithms, and the systems that surround them.

---

## The Biased Jury Pool Analogy

Imagine you're selecting a jury for a trial. If your jury pool is
drawn only from one neighborhood, the jury won't represent the
community. If the selection process favors people who are available
during work hours, you'll over-represent retirees and under-represent
working parents. And if past juries have consistently convicted
certain groups at higher rates, new jurors may unconsciously follow
that pattern.

ML bias works the same way. It enters at data collection (the jury
pool), gets amplified by the algorithm (the selection process), and
reinforces itself through societal feedback loops (historical
patterns shaping future decisions).

```
  BIASED JURY POOL                  BIASED ML PIPELINE
  +------------------+              +------------------+
  | Pool from one    |              | Training data    |
  |  neighborhood    |              |  not representative|
  +--------+---------+              +--------+---------+
           |                                 |
           v                                 v
  +------------------+              +------------------+
  | Selection favors |              | Algorithm amplifies|
  |  certain groups  |              |  existing patterns |
  +--------+---------+              +--------+---------+
           |                                 |
           v                                 v
  +------------------+              +------------------+
  | Past patterns    |              | Predictions feed |
  |  influence new   |              |  back into data  |
  +------------------+              +------------------+
```

---

## The Bias Pipeline

Bias can enter at every stage of the ML pipeline. Understanding
where it comes from is the first step to addressing it.

```
  THE BIAS PIPELINE: Where Bias Enters

  Data Collection    Data Preparation    Model Training    Deployment
  +------------+     +------------+     +------------+    +------------+
  | Selection  |     | Labeling   |     | Represen-  |    | Feedback   |
  |  bias      | --> |  bias      | --> |  tation    | -->|  loops     |
  | Measurement|     | Feature    |     |  bias      |    | Automation |
  |  bias      |     |  choices   |     | Aggregation|    |  bias      |
  | Historical |     | Missing    |     |  bias      |    | Deployment |
  |  bias      |     |  data      |     | Objective  |    |  context   |
  +------------+     +------------+     +------------+    +------------+
       |                  |                  |                  |
       v                  v                  v                  v
  "Who's in the     "How we describe   "What the model   "How the world
   dataset?"         the data"          optimizes for"    reacts"
```

---

## Data Bias

Data bias is the most common source of unfairness. Your model can
only learn from what you show it.

### Selection Bias

The training data doesn't represent the population the model will
serve. This happens when:

- Data is collected from a non-representative source
- Certain groups opt out of data collection
- Historical access patterns skew who appears in the data

**Example:** A medical AI trained mostly on data from academic
hospitals will perform poorly in rural clinics where patient
demographics and conditions differ.

### Measurement Bias

The features or labels are measured differently across groups.

**Example:** Using "number of prior arrests" as a feature for
recidivism prediction. Arrest rates reflect policing patterns, not
actual crime rates — communities with heavier policing will show
more arrests regardless of actual criminal behavior.

### Historical Bias

The data accurately reflects the real world, but the real world
contains historical inequities.

**Example:** Training a hiring model on historical hiring data.
If women were historically underrepresented in engineering roles,
the model learns that being female correlates with not being hired
— even though the historical pattern was the problem, not a signal.

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Demonstrating selection bias in a dataset
np.random.seed(42)

# True population: equal representation
population = pd.DataFrame({
    'age': np.random.normal(40, 15, 10000).clip(18, 80),
    'group': np.random.choice(['A', 'B'], 10000, p=[0.5, 0.5]),
    'income': np.random.normal(50000, 20000, 10000).clip(15000, 200000)
})

# Biased sample: group B is underrepresented (selection bias)
# Simulates collecting data from a source that skews toward group A
mask_a = (population['group'] == 'A')
mask_b = (population['group'] == 'B') & (np.random.random(10000) < 0.3)
biased_sample = population[mask_a | mask_b].copy()

print(f"Population: {population['group'].value_counts().to_dict()}")
print(f"Biased sample: {biased_sample['group'].value_counts().to_dict()}")
# Population: {'A': 5000, 'B': 5000}  (roughly)
# Biased sample: {'A': ~5000, 'B': ~1500}  (B underrepresented)
```

```python
# Visualizing the class imbalance
fig, axes = plt.subplots(1, 2, figsize=(12, 5))

population['group'].value_counts().plot(
    kind='bar', ax=axes[0], color=['steelblue', 'coral']
)
axes[0].set_title('True Population')
axes[0].set_ylabel('Count')

biased_sample['group'].value_counts().plot(
    kind='bar', ax=axes[1], color=['steelblue', 'coral']
)
axes[1].set_title('Biased Sample (Selection Bias)')
axes[1].set_ylabel('Count')

plt.tight_layout()
plt.savefig('selection_bias.png', dpi=150)
plt.show()
```

---

## Algorithmic Bias

Even with perfect data, the algorithm itself can introduce or
amplify bias.

### Representation Bias

The model performs well on average but poorly for minority groups
because it optimizes for overall accuracy.

**Example:** A model with 95% accuracy overall but 70% accuracy
for a minority group that makes up 5% of the data. The overall
metric hides the disparity.

### Aggregation Bias

Treating all groups as a single population when the relationship
between features and outcomes differs across groups.

**Example:** A diabetes prediction model trained on a combined
dataset. HbA1c levels have different clinical significance across
ethnic groups, but a single model treats the feature identically
for everyone.

### Objective Function Bias

The loss function optimizes for something that doesn't align with
fairness goals.

**Example:** Optimizing for click-through rate in a job ad system.
If men click on high-paying job ads more often (due to societal
factors), the algorithm learns to show those ads less to women —
maximizing clicks while reinforcing inequality.

```python
# Demonstrating representation bias
from sklearn.datasets import make_classification
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

np.random.seed(42)

# Create a dataset with a majority and minority group
n_majority = 950
n_minority = 50

# Majority group: easy to classify
X_maj, y_maj = make_classification(
    n_samples=n_majority, n_features=5, n_informative=3,
    random_state=42, class_sep=2.0
)

# Minority group: harder to classify (different distribution)
X_min, y_min = make_classification(
    n_samples=n_minority, n_features=5, n_informative=3,
    random_state=99, class_sep=0.5
)

# Combine
X = np.vstack([X_maj, X_min])
y = np.hstack([y_maj, y_min])
groups = np.array(['majority'] * n_majority + ['minority'] * n_minority)

# Train a simple model
model = LogisticRegression(random_state=42)
model.fit(X, y)
preds = model.predict(X)

# Overall accuracy looks great
print(f"Overall accuracy: {accuracy_score(y, preds):.1%}")

# But break it down by group
maj_mask = groups == 'majority'
min_mask = groups == 'minority'
print(f"Majority group accuracy: {accuracy_score(y[maj_mask], preds[maj_mask]):.1%}")
print(f"Minority group accuracy: {accuracy_score(y[min_mask], preds[min_mask]):.1%}")
# Overall: ~95%  |  Majority: ~96%  |  Minority: ~70%
```

---

## Societal Bias

Bias that exists in the broader social context and gets encoded
into AI systems through data and deployment.

### Feedback Loops

The model's predictions influence future data, creating a
self-reinforcing cycle.

**Example:** Predictive policing. The model sends more officers to
neighborhoods with high historical arrest rates. More officers means
more arrests. More arrests means the model predicts even more crime
there. The cycle continues regardless of actual crime rates.

### Automation Bias

Humans over-trust automated systems, even when the system is wrong.

**Example:** A doctor using an AI diagnostic tool. Studies show
that when the AI suggests a diagnosis, doctors are less likely to
consider alternatives — even when the AI is clearly wrong. The
authority of "the computer said so" overrides clinical judgment.

### Deployment Context Bias

A model that's fair in one context becomes unfair in another.

**Example:** A credit scoring model developed and validated in
urban areas is deployed in rural communities where economic
patterns differ. The model's assumptions no longer hold, but it's
treated as equally valid.

```
  FEEDBACK LOOP IN PREDICTIVE POLICING

  Historical crime ──> Model predicts ──> More police ──> More arrests
       data              "hot spots"       sent there      recorded
        ^                                                     |
        |                                                     |
        +─────────────── New "crime data" ────────────────────+

  The model doesn't detect crime.
  It detects policing patterns.
```

---

## Identifying Bias: A Checklist

Before training any model, ask these questions:

```
  BIAS DETECTION CHECKLIST

  DATA COLLECTION
  [ ] Who collected the data and why?
  [ ] Who is represented? Who is missing?
  [ ] Are there historical inequities in the data?
  [ ] How were labels assigned? By whom?

  FEATURES
  [ ] Do any features serve as proxies for protected attributes?
  [ ] Are features measured consistently across groups?
  [ ] Could any feature encode historical discrimination?

  MODEL
  [ ] Does performance vary across demographic groups?
  [ ] What does the model optimize for? Does that align with fairness?
  [ ] Are minority groups large enough for reliable evaluation?

  DEPLOYMENT
  [ ] Is the deployment context the same as the training context?
  [ ] Could the model's predictions create feedback loops?
  [ ] Will humans over-trust the model's outputs?
```

---

## Exercises

### Exercise 1: Bias Identification

Load the Adult Income dataset (UCI ML Repository) and investigate
potential biases:

```python
# Starter code
import pandas as pd

url = "https://archive.ics.uci.edu/ml/machine-learning-databases/adult/adult.data"
columns = ['age', 'workclass', 'fnlwgt', 'education', 'education_num',
           'marital_status', 'occupation', 'relationship', 'race', 'sex',
           'capital_gain', 'capital_loss', 'hours_per_week',
           'native_country', 'income']
df = pd.read_csv(url, names=columns, skipinitialspace=True)

# 1. What is the distribution of race and sex?
# 2. What is the income distribution by race? By sex?
# 3. Are there features that could serve as proxies for protected attributes?
# 4. What selection biases might exist in this dataset?
```

### Exercise 2: Feedback Loop Analysis

Design a feedback loop diagram for one of these systems:
1. A content recommendation algorithm on social media
2. A resume screening tool for job applications
3. A loan approval model for a bank

For your chosen system, identify:
- Where does the initial bias come from?
- How does the model's output become future training data?
- What would happen after 5 cycles of this loop?
- How could you break the loop?

---

Next: [Lesson 03: Fairness Definitions and Metrics](./03-fairness-definitions.md)
