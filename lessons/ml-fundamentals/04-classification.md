# Lesson 04: Classification — Yes/No Decisions

Linear regression predicts a number (house price, temperature, salary).
Classification predicts a category (spam/not spam, cat/dog, malignant/benign).

Same learning loop, different output and loss function.

---

## Regression vs Classification

```
Regression:                          Classification:

Input: house features                Input: email text
Output: $347,500 (a number)         Output: spam (a category)

Input: patient vitals                Input: medical scan
Output: 120/80 mmHg (numbers)       Output: malignant/benign (categories)

The line can go anywhere:            The answer is one of a few buckets:

    y │        /                         Spam │  ■ ■    ■
      │      /                               │■  ■  ■ ■
      │    /                          ───────┼──────────
      │  /                          Not Spam │● ● ●
      │/                                     │  ●  ● ●
      └────── x                              └──────────
```

---

## The Problem With Using Linear Regression for Classification

Why not just use a line and say "above 0.5 = spam, below 0.5 = not spam"?

```
Problem: a linear model outputs any number, not just 0-1.

    Output
      3 │         /
        │       /
      1 │─────/──── what does output = 2.7 mean?
    0.5 │───/────── threshold
      0 │─/────────
        │/
     -2 │
        └────────── input

The output can be -100 or +500. That is not a probability.
We need to SQUISH the output into the range [0, 1].
```

---

## The Sigmoid Function: Squishing Any Number to 0-1

The sigmoid function takes any number and maps it to a value between 0 and 1.
Think of it as a dimmer switch that smoothly transitions between "off" and "on."

```
                    1
sigmoid(z) = ──────────────
              1 + e^(-z)

    Output
    1.0 │              ────────────
        │            /
    0.5 │──────────x──────────────   ← inflection point at z=0
        │          /
    0.0 │─────────                   ← never actually reaches 0 or 1
        └──────────────────────────
       -6  -4  -2   0   2   4   6
                    z

Key properties:
- sigmoid(0) = 0.5    (middle)
- sigmoid(large positive) → 1.0
- sigmoid(large negative) → 0.0
- Output is ALWAYS between 0 and 1
```

```python
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

print(sigmoid(0))      # 0.5
print(sigmoid(5))      # 0.9933 — very confident "yes"
print(sigmoid(-5))     # 0.0067 — very confident "no"
print(sigmoid(100))    # 1.0 (practically)
print(sigmoid(-100))   # 0.0 (practically)
```

**The dimmer switch analogy:**

```
A regular light switch:  OFF ──── click ──── ON  (binary)
A dimmer switch:         OFF ──smooth──── ON  (gradual)

Linear model output:     -∞ ───────────── +∞  (any number)
After sigmoid:           0 ──────────────  1   (probability)

sigmoid(z) = how confident are we that the answer is "yes"?
```

---

## Logistic Regression: Linear Model + Sigmoid

Despite the name, logistic regression is used for CLASSIFICATION, not regression.

```
Linear regression:        y = w * x + b                (outputs any number)
Logistic regression:      p = sigmoid(w * x + b)       (outputs probability)

Step 1: compute z = w * x + b          (linear combination)
Step 2: compute p = sigmoid(z)          (squish to 0-1)
Step 3: classify: if p > 0.5 → class 1, else → class 0
```

```
The full pipeline:

Features     Weights        Linear         Sigmoid         Prediction
              & bias       combination
[x₁,x₂,x₃] → [w₁,w₂,w₃,b] → z = w·x+b → p = σ(z) → { 1 if p>0.5
                                                         { 0 if p≤0.5
```

---

## Decision Boundaries

The decision boundary is the line (or surface) where the model switches
from predicting class 0 to class 1.

```
2D example (two features):

    Feature 2
        │  ● ● ●      ■ ■ ■
        │    ●  ●    ■  ■
        │  ● ●  ╱ ■ ■ ■        ● = class 0  (not spam)
        │  ●  ╱  ■ ■            ■ = class 1  (spam)
        │   ╱ ■ ■
        │ ╱● ■                   ╱ = decision boundary
        └──────────────── Feature 1

Left of the line: model predicts class 0
Right of the line: model predicts class 1

The line is where sigmoid(w₁x₁ + w₂x₂ + b) = 0.5
which means w₁x₁ + w₂x₂ + b = 0
```

---

## Binary Cross-Entropy Loss

We cannot use MSE for classification. Here is why:

```
With MSE and sigmoid, the loss surface has flat regions where
gradients are near zero, making learning painfully slow.

Instead we use cross-entropy loss, which is derived from probability theory.
```

**The intuition:**

```
If the true label is 1 (positive):
  Model predicts 0.99 → small penalty:  -log(0.99) = 0.01
  Model predicts 0.50 → medium penalty: -log(0.50) = 0.69
  Model predicts 0.01 → HUGE penalty:   -log(0.01) = 4.61

If the true label is 0 (negative):
  Model predicts 0.01 → small penalty:  -log(1-0.01) = 0.01
  Model predicts 0.50 → medium penalty: -log(1-0.50) = 0.69
  Model predicts 0.99 → HUGE penalty:   -log(1-0.99) = 4.61

The log function naturally penalizes CONFIDENT WRONG answers very harshly.
```

```
The formula:

Loss = -(1/n) * Σ [ yᵢ * log(pᵢ) + (1-yᵢ) * log(1-pᵢ) ]

Where:
  yᵢ = actual label (0 or 1)
  pᵢ = predicted probability

When yᵢ=1: only the log(pᵢ) term survives    → penalizes low p
When yᵢ=0: only the log(1-pᵢ) term survives  → penalizes high p
```

```python
def binary_cross_entropy(y_true, y_pred):
    epsilon = 1e-15
    y_pred = np.clip(y_pred, epsilon, 1 - epsilon)
    return -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))
```

The `np.clip` prevents `log(0)` which is negative infinity.

---

## Implementing a Classifier From Scratch

```python
import numpy as np

np.random.seed(42)

n = 200
X_class0 = np.random.randn(n // 2, 2) + np.array([2, 2])
X_class1 = np.random.randn(n // 2, 2) + np.array([5, 5])

X = np.vstack([X_class0, X_class1])
y = np.array([0] * (n // 2) + [1] * (n // 2))

shuffle_idx = np.random.permutation(n)
X, y = X[shuffle_idx], y[shuffle_idx]

split = int(0.8 * n)
X_train, X_test = X[:split], X[split:]
y_train, y_test = y[:split], y[split:]

def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))

def binary_cross_entropy(y_true, y_pred):
    eps = 1e-15
    y_pred = np.clip(y_pred, eps, 1 - eps)
    return -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))

w = np.zeros(2)
b = 0.0
lr = 0.1
epochs = 200
losses = []

for epoch in range(epochs):
    z = X_train @ w + b
    predictions = sigmoid(z)

    loss = binary_cross_entropy(y_train, predictions)
    losses.append(loss)

    errors = predictions - y_train
    dw = (1 / len(X_train)) * (X_train.T @ errors)
    db = (1 / len(X_train)) * np.sum(errors)

    w = w - lr * dw
    b = b - lr * db

    if epoch % 40 == 0:
        accuracy = np.mean((predictions > 0.5) == y_train)
        print(f"Epoch {epoch:3d}: loss={loss:.4f}, accuracy={accuracy:.2%}")

test_predictions = sigmoid(X_test @ w + b)
test_accuracy = np.mean((test_predictions > 0.5) == y_test)
print(f"\nTest accuracy: {test_accuracy:.2%}")
```

---

## Multi-Class Classification: More Than Two Categories

Binary classification: spam or not spam (2 classes).
Multi-class: cat, dog, bird, fish (4 classes).

### Softmax: Sigmoid's Multi-Class Cousin

Instead of squishing to a single probability, softmax produces a
probability DISTRIBUTION across all classes.

```
Softmax takes a vector of numbers and converts them to probabilities:

Raw scores (logits):     [2.0,  1.0,  0.1]

                              e^2.0
Softmax for class 0:  ─────────────────── = 0.659
                       e^2.0 + e^1.0 + e^0.1

                              e^1.0
Softmax for class 1:  ─────────────────── = 0.242
                       e^2.0 + e^1.0 + e^0.1

                              e^0.1
Softmax for class 2:  ─────────────────── = 0.099
                       e^2.0 + e^1.0 + e^0.1

Sum: 0.659 + 0.242 + 0.099 = 1.000  ← always sums to 1
```

```python
def softmax(z):
    exp_z = np.exp(z - np.max(z))
    return exp_z / np.sum(exp_z)

scores = np.array([2.0, 1.0, 0.1])
probs = softmax(scores)
print(probs)         # [0.659, 0.242, 0.099]
print(np.sum(probs)) # 1.0
```

The `np.max(z)` subtraction prevents numerical overflow. It does not
change the result because softmax is shift-invariant.

---

## Evaluation Metrics: Beyond Accuracy

Accuracy alone can be misleading.

### The Spam Filter Analogy

```
Imagine a spam filter for your email:

100 emails total:
  95 are legitimate (not spam)
   5 are actual spam

A model that ALWAYS predicts "not spam" gets 95% accuracy.
But it catches zero spam. Useless.
```

### The Confusion Matrix

```
                    Predicted
                 Spam    Not Spam
              ┌────────┬────────┐
Actual  Spam  │  TP=4  │  FN=1  │   TP = True Positive (correctly caught)
              ├────────┼────────┤   FN = False Negative (missed spam)
    Not Spam  │  FP=3  │  TN=92 │   FP = False Positive (wrongly blocked)
              └────────┴────────┘   TN = True Negative (correctly allowed)
```

### Precision and Recall

```
                    Of everything we FLAGGED as spam,
                    how many actually were?
Precision = TP / (TP + FP) = 4 / (4 + 3) = 57%

"When the filter says spam, it is right 57% of the time."
Problem: too many false positives → legitimate emails blocked.


                    Of all ACTUAL spam,
                    how much did we catch?
Recall = TP / (TP + FN) = 4 / (4 + 1) = 80%

"The filter catches 80% of all spam."
Problem: misses 20% of spam.
```

```
The tradeoff:

High precision, low recall:        High recall, low precision:
"Only flag what you are SURE        "Flag EVERYTHING suspicious"
 is spam"

Catches less spam, but rarely       Catches almost all spam, but
blocks legitimate emails.           also blocks some good emails.

Medical diagnosis parallel:
High precision: "only diagnose cancer when you are certain"
High recall: "flag every suspicious scan for review"

For cancer: high recall is more important (do not miss cases)
For spam: depends on the user's preference
```

### F1 Score: Balancing Precision and Recall

```
F1 = 2 * (precision * recall) / (precision + recall)

F1 is the harmonic mean — it punishes extreme imbalances.

Precision=0.9, Recall=0.9 → F1=0.90  (balanced, good)
Precision=1.0, Recall=0.5 → F1=0.67  (imbalanced, penalized)
Precision=0.5, Recall=1.0 → F1=0.67  (imbalanced, penalized)
```

```python
def compute_metrics(y_true, y_pred):
    tp = np.sum((y_pred == 1) & (y_true == 1))
    fp = np.sum((y_pred == 1) & (y_true == 0))
    fn = np.sum((y_pred == 0) & (y_true == 1))
    tn = np.sum((y_pred == 0) & (y_true == 0))

    accuracy = (tp + tn) / (tp + fp + fn + tn)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }

y_true = np.array([1, 1, 1, 1, 1, 0, 0, 0, 0, 0])
y_pred = np.array([1, 1, 1, 0, 0, 0, 0, 0, 1, 0])

metrics = compute_metrics(y_true, y_pred)
for name, value in metrics.items():
    print(f"{name:>10}: {value:.2%}")
```

---

## The Threshold: Where Do You Draw the Line?

The default threshold is 0.5, but you can adjust it.

```
Lower threshold (0.3):              Higher threshold (0.7):
"Be more aggressive at flagging"    "Only flag when very confident"

More true positives  (good)          Fewer false positives  (good)
More false positives (bad)           More false negatives   (bad)
Higher recall                        Higher precision

For medical screening: use 0.3       For email spam: use 0.7
(do not want to miss disease)        (do not want to block real email)
```

```python
thresholds = [0.3, 0.5, 0.7, 0.9]

for threshold in thresholds:
    predictions_binary = (test_predictions > threshold).astype(int)
    metrics = compute_metrics(y_test, predictions_binary)
    print(f"Threshold {threshold}: precision={metrics['precision']:.2f}, "
          f"recall={metrics['recall']:.2f}, f1={metrics['f1']:.2f}")
```

---

## Exercises

### Exercise 1: Implement Logistic Regression

```python
import numpy as np

np.random.seed(42)
n = 300
X_class0 = np.random.randn(n // 2, 2) * 0.8 + np.array([1, 1])
X_class1 = np.random.randn(n // 2, 2) * 0.8 + np.array([3, 3])
X = np.vstack([X_class0, X_class1])
y = np.array([0] * (n // 2) + [1] * (n // 2))

# TODO: shuffle and split 80/20
# TODO: implement logistic regression with gradient descent
# TODO: train for 300 epochs, plot the loss curve
# TODO: compute accuracy, precision, recall, F1 on the test set
```

### Exercise 2: Visualize the Decision Boundary

```python
# TODO: using the trained model from Exercise 1,
#       create a grid of points covering the feature space
# TODO: predict the class for every grid point
# TODO: use plt.contourf to show the decision regions
# TODO: overlay the actual data points
# The boundary should be a straight line (logistic regression is linear)
```

### Exercise 3: Multi-Class Classification

```python
np.random.seed(42)
n_per_class = 100
X_0 = np.random.randn(n_per_class, 2) * 0.5 + np.array([0, 3])
X_1 = np.random.randn(n_per_class, 2) * 0.5 + np.array([3, 0])
X_2 = np.random.randn(n_per_class, 2) * 0.5 + np.array([0, 0])

X = np.vstack([X_0, X_1, X_2])
y = np.array([0] * n_per_class + [1] * n_per_class + [2] * n_per_class)

# TODO: implement softmax classification using one-hot encoded labels
# TODO: use cross-entropy loss for 3 classes
# TODO: train with gradient descent
# TODO: report per-class precision and recall
```

### Exercise 4: The Imbalanced Dataset Problem

```python
np.random.seed(42)
n_majority = 950
n_minority = 50
X_maj = np.random.randn(n_majority, 2) + np.array([0, 0])
X_min = np.random.randn(n_minority, 2) + np.array([3, 3])
X = np.vstack([X_maj, X_min])
y = np.array([0] * n_majority + [1] * n_minority)

# TODO: train a classifier on this imbalanced data
# TODO: what accuracy does the "always predict 0" baseline get?
# TODO: is accuracy a good metric here? why or why not?
# TODO: compute precision, recall, and F1
# TODO: try adjusting the threshold — can you improve recall?
```

---

Next: [Lesson 05: The Perceptron](./05-perceptron.md)
