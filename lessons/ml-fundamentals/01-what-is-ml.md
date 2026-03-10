# Lesson 01: What Machine Learning Actually Is

Traditional programming: you write rules, the computer follows them.
Machine learning: you give data, the computer figures out the rules.

That is the entire idea. Everything else is technique.

---

## Traditional Programming vs Machine Learning

```
Traditional Programming:

    Rules    ──┐
               ├──→ [ Program ] ──→  Answers
    Data     ──┘

    You write: "if square footage > 2000 AND bedrooms >= 3, price = expensive"
    You manually encode every rule.


Machine Learning:

    Data     ──┐
               ├──→ [ Learning Algorithm ] ──→  Rules (Model)
    Answers  ──┘

    You provide: 10,000 houses with their actual prices.
    The algorithm figures out the relationship itself.
```

### The Recipe Analogy

Imagine you want to replicate a famous restaurant's signature dish.

**Traditional programming approach:** You try to reverse-engineer the recipe
yourself. You taste the dish, guess at ingredients, write down exact
measurements, cooking times, temperatures. You are manually encoding rules.

**Machine learning approach:** You give a chef 1,000 plates of the finished
dish along with the ingredient lists. The chef eats them all, notices
patterns, and figures out the recipe. You never wrote a single cooking
instruction — the chef *learned* the rules from examples.

```
Traditional:
    You  ──→  Write recipe  ──→  Chef follows it  ──→  Dish

ML:
    1000 dishes + ingredients  ──→  Chef studies them  ──→  Chef learns recipe
                                          ↑
                                    This is "training"
```

---

## The Three Flavors of ML

### 1. Supervised Learning — "Learning with an Answer Key"

You give the algorithm examples where you KNOW the right answer.

```
Like a student studying with flashcards:

Front (input):        Back (correct answer):
───────────────       ─────────────────────
Photo of a cat   →    "cat"
Photo of a dog   →    "dog"
1500 sqft house  →    $250,000
Spam email text  →    "spam"

After seeing enough examples, the student can answer new questions.
```

The inputs are called **features**. The correct answers are called **labels**.

```python
import numpy as np

features = np.array([
    [1400, 3, 20],   # sqft, bedrooms, age
    [1800, 4, 5],
    [1200, 2, 35],
    [2200, 5, 10],
])

labels = np.array([250000, 350000, 180000, 420000])  # prices
```

Most ML you will encounter is supervised learning.

### 2. Unsupervised Learning — "Finding Hidden Patterns"

No answer key. The algorithm finds structure on its own.

```
Like sorting a bag of mixed LEGO pieces:

Nobody tells you HOW to sort them. But you naturally
group them by color, size, or shape. You discovered
the categories yourself.

Input: [pile of LEGO]
Output: [red pile] [blue pile] [small pile] [wheels pile]
```

Use cases: customer segmentation, anomaly detection, recommendation engines.

### 3. Reinforcement Learning — "Trial and Error"

The algorithm takes actions and gets rewards or penalties.

```
Like training a dog:

Dog sits       →  treat (reward +1)
Dog jumps      →  "no!" (penalty -1)
Dog rolls over →  treat (reward +1)

The dog learns to maximize treats over time.
No one showed the dog a manual — it learned from consequences.
```

Use cases: game AI, robotics, autonomous vehicles.

---

## Features and Labels

These are the two most important terms in supervised ML.

```
Features (X):                          Labels (y):
The information you give the model     The answer you want it to predict

┌──────────────────────────────┐       ┌──────────┐
│ sqft  bedrooms  age  garage  │       │  price   │
├──────────────────────────────┤       ├──────────┤
│ 1400     3      20    yes    │  ──→  │ 250,000  │
│ 1800     4       5    yes    │  ──→  │ 350,000  │
│ 1200     2      35    no     │  ──→  │ 180,000  │
│ 2200     5      10    yes    │  ──→  │ 420,000  │
└──────────────────────────────┘       └──────────┘
        Features (inputs)               Labels (outputs)
```

Feature engineering — choosing WHICH features to use — is often more
important than choosing which algorithm to use.

---

## Training vs Inference

Two distinct phases:

```
Phase 1: TRAINING (learning)
──────────────────────────────
Training data ──→ [ Algorithm ] ──→ Trained Model
                     (slow)          (saved to disk)

"Studying for the exam."
This can take minutes, hours, or weeks.
You do this once (or occasionally retrain).


Phase 2: INFERENCE (using)
──────────────────────────────
New data ──→ [ Trained Model ] ──→ Prediction
                  (fast)

"Taking the exam."
This is fast — milliseconds.
You do this millions of times in production.
```

```python
X_train = np.array([[1400, 3], [1800, 4], [1200, 2], [2200, 5]])
y_train = np.array([250000, 350000, 180000, 420000])

weights = np.array([100, 50000])  # pretend we trained and got these
bias = -10000

X_new = np.array([[1600, 3]])
prediction = X_new @ weights + bias  # inference: fast dot product
```

---

## Overfitting: Memorizing vs Understanding

The most important pitfall in ML.

```
Imagine two students preparing for a math exam:

Student A (overfit):
  - Memorized every practice problem and its exact answer
  - Scores 100% on practice problems
  - Scores 40% on the actual exam (different questions)
  - Memorized the answers, did not learn the concepts

Student B (good fit):
  - Understood the underlying methods
  - Scores 90% on practice problems
  - Scores 88% on the actual exam
  - Learned the patterns, not the specific answers
```

```
Overfitting visualized:

Good fit (generalizes):          Overfit (memorizes):

    y │    . .                      y │    . .
      │   / .  .                      │   /\./ \.
      │  / .                          │  / .    \
      │ /.                            │ /. .     \.
      │/.  .                          │/  .  .    .
      └──────── x                     └──────── x

Simple line through the            Wiggly line hitting every point.
general trend. Misses some          Perfect on training data.
training points. Generalizes.       Terrible on new data.
```

You detect overfitting by splitting your data:

```
Full dataset (1000 examples)
├── Training set (800 examples)   ← model learns from these
└── Test set (200 examples)       ← model is evaluated on these

If training accuracy = 99% but test accuracy = 60%  →  OVERFITTING
If training accuracy = 92% and test accuracy = 89%  →  GOOD FIT
```

```python
np.random.seed(42)
indices = np.random.permutation(len(X))
split = int(0.8 * len(X))

X_train, X_test = X[indices[:split]], X[indices[split:]]
y_train, y_test = y[indices[:split]], y[indices[split:]]
```

---

## A Simple Example: Predicting House Prices

Let us put it all together. We have houses with one feature (square footage)
and we want to predict price.

```python
import numpy as np

np.random.seed(42)

sqft = np.array([800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600])
prices = np.array([150, 200, 240, 280, 330, 360, 400, 440, 470, 520]) * 1000

sqft_mean = np.mean(sqft)
sqft_std = np.std(sqft)
sqft_normalized = (sqft - sqft_mean) / sqft_std

X = sqft_normalized
y = prices

numerator = np.sum((X - np.mean(X)) * (y - np.mean(y)))
denominator = np.sum((X - np.mean(X)) ** 2)
weight = numerator / denominator
bias = np.mean(y) - weight * np.mean(X)

predictions = weight * X + bias

errors = y - predictions
mse = np.mean(errors ** 2)
print(f"Weight: {weight:.0f}")
print(f"Bias: {bias:.0f}")
print(f"MSE: {mse:.0f}")

new_sqft = np.array([1500, 1900, 2300])
new_normalized = (new_sqft - sqft_mean) / sqft_std
new_predictions = weight * new_normalized + bias
for s, p in zip(new_sqft, new_predictions):
    print(f"  {s} sqft → ${p:,.0f}")
```

```
What this code does:

1. Define our data (10 houses with sqft and prices)
2. Normalize the features (center around 0, scale to similar range)
3. Calculate the best weight and bias using a closed-form formula
4. Make predictions on new houses

This is a complete ML pipeline:
  Data → Preprocessing → Training → Inference
```

---

## Key Vocabulary Cheat Sheet

```
Term              Meaning                                    Analogy
──────────────────────────────────────────────────────────────────────
Model             A function that maps inputs to outputs     A recipe
Training          Finding the best parameters                Studying
Inference         Using the trained model on new data        Taking the exam
Features (X)      Input variables                            Exam questions
Labels (y)        Correct answers                            Answer key
Parameters        Numbers the model learns (weights, bias)   Knowledge gained
Overfitting       Memorizing training data                   Memorizing flashcards
Underfitting      Model too simple for the data              Using a ruler for curves
Train/Test split  Holding out data to check generalization   Practice vs real exam
```

---

## Exercises

### Exercise 1: Classify the Problem Type

For each scenario, decide if it is supervised, unsupervised, or reinforcement:

1. Predicting whether an email is spam given 10,000 labeled emails
2. Grouping customers by purchasing behavior (no predefined groups)
3. Teaching a robot to walk by rewarding forward motion
4. Predicting stock prices given historical data
5. Finding unusual transactions in credit card data (no labels for "fraud")

### Exercise 2: Feature Engineering

You want to predict whether a student will pass an exam. List 5 features
you would collect. Which would be most predictive? Which might cause
overfitting if included?

### Exercise 3: Implement Train/Test Split

```python
import numpy as np

np.random.seed(42)
X = np.random.randn(100, 3)
y = X @ np.array([2, -1, 3]) + np.random.randn(100) * 0.5

# TODO: split into 80% train, 20% test
# TODO: compute weights using ONLY training data
# TODO: evaluate MSE on BOTH train and test sets
# TODO: compare the two MSE values — what does the difference tell you?
```

### Exercise 4: The Overfitting Experiment

Generate data from a simple line (`y = 2x + noise`). Then fit increasingly
complex models:
- A line (1 parameter for slope)
- A parabola (2 parameters)
- A degree-10 polynomial (10 parameters)

Which fits the training data best? Which generalizes best to new data?
Use `np.polyfit` and `np.polyval` to experiment.

---

Next: [Lesson 02: Linear Regression](./02-linear-regression.md)
