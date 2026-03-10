# Applied Machine Learning - Track Roadmap

Welcome to the Applied ML track. This is not a theory-heavy academic
course. You will build things, break things, and learn why real-world
ML is 80% data work and 20% modeling.

```
  +---------------------------------------------+
  |        APPLIED MACHINE LEARNING              |
  |                                              |
  |   Data --> Features --> Model --> Evaluate    |
  |     |         |          |          |        |
  |   Clean    Engineer    Train     Deploy      |
  +---------------------------------------------+
```

---

## Phase 1: Data Foundations

The foundation everything else rests on. Skip this and your models
will be built on sand.

- [ ] [01 - Data Collection & Quality](01-data-collection-quality.md)
- [ ] [02 - Exploratory Data Analysis](02-exploratory-data-analysis.md)
- [ ] [03 - Feature Engineering](03-feature-engineering.md)
- [ ] [04 - Handling Messy Data](04-handling-messy-data.md)
- [ ] [05 - Feature Scaling & Encoding](05-feature-scaling-encoding.md)

```
  Phase 1 Focus:
  +-----------+     +-----------+     +-----------+
  |  Collect  | --> |   Clean   | --> |  Prepare  |
  |   Data    |     |   Data    |     | Features  |
  +-----------+     +-----------+     +-----------+
```

---

## Phase 2: Supervised Learning

The bread and butter of applied ML. These are the algorithms that
solve most real-world business problems.

- [ ] [06 - Decision Trees](06-decision-trees.md)
- [ ] [07 - Random Forests & Boosting](07-random-forests-boosting.md)
- [ ] [08 - XGBoost & LightGBM](08-xgboost-lightgbm.md)
- [ ] [09 - Support Vector Machines](09-svms.md)

```
  Phase 2 Focus:
  +-----------+     +-----------+     +-----------+
  | Features  | --> |   Train   | --> | Predict   |
  |   (X)     |     |   Model   |     |   (y)     |
  +-----------+     +-----------+     +-----------+
```

---

## Phase 3: Unsupervised Learning

When you have data but no labels. Discover hidden structure and
reduce complexity.

- [ ] [10 - Clustering](10-clustering.md)
- [ ] [11 - Dimensionality Reduction](11-dimensionality-reduction.md)

```
  Phase 3 Focus:
  +-----------+     +-----------+
  | Unlabeled | --> | Discover  |
  |   Data    |     | Structure |
  +-----------+     +-----------+
```

---

## Phase 4: Model Evaluation & Tuning

Building a model is easy. Building a *good* model requires rigorous
evaluation and systematic tuning.

- [ ] [12 - Metrics That Matter](12-metrics-that-matter.md)
- [ ] [13 - Cross-Validation](13-cross-validation.md)
- [ ] [14 - Hyperparameter Tuning](14-hyperparameter-tuning.md)

```
  Phase 4 Focus:
  +-----------+     +-----------+     +-----------+
  |  Measure  | --> |  Validate | --> |   Tune    |
  |   Right   |     |  Properly |     |  Smartly  |
  +-----------+     +-----------+     +-----------+
```

---

## Phase 5: Real-World ML

The skills that separate notebook warriors from production ML
engineers.

- [ ] [15 - Bias, Fairness & Interpretability](15-bias-fairness-interpretability.md)
- [ ] [16 - Time Series](16-time-series.md)
- [ ] [17 - Recommendation Systems](17-recommendation-systems.md)
- [ ] [18 - End-to-End Project](18-end-to-end-project.md)

```
  Phase 5 Focus:
  +-----------+     +-----------+     +-----------+
  | Explain   | --> | Specialize| --> |  Ship It  |
  |  Models   |     |  Domains  |     |           |
  +-----------+     +-----------+     +-----------+
```

---

## Reference Materials

Quick-look resources you will keep coming back to.

- [Algorithm Comparison Table](reference-algorithms.md)
- [Metrics Reference](reference-metrics.md)

---

## How to Use This Track

```
  +---------------------------------------------------+
  |  1. Read the lesson on your phone/tablet          |
  |  2. Try the code examples in a Jupyter notebook   |
  |  3. Do the exercises with real datasets            |
  |  4. Check the box when you feel confident          |
  |  5. Move to the next lesson                        |
  +---------------------------------------------------+
```

**Time estimate:** 4-6 weeks at ~1 hour per day

**Prerequisites:**
- Basic Python (loops, functions, classes)
- Basic statistics (mean, median, standard deviation)
- Willingness to get your hands dirty with data

**Tools you will need:**
- Python 3.8+
- pip install scikit-learn pandas numpy matplotlib seaborn xgboost lightgbm shap

---

> "In theory, there is no difference between theory and practice.
> In practice, there is." - Yogi Berra

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **An Introduction to Statistical Learning (ISLR)** by James, Witten, Hastie, and Tibshirani (Springer, 2nd Edition 2021) — Practical statistical learning. *Free PDF available*
- **The Elements of Statistical Learning** by Hastie, Tibshirani, and Friedman (Springer, 2nd Edition 2009) — Advanced reference. *Free PDF available*

---

[Start with Lesson 01: Data Collection & Quality -->](01-data-collection-quality.md)
