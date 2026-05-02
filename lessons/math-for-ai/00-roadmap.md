# Math for AI - Track Roadmap

> The math you actually need to understand AI — no PhD required.

```
    MATH FOR AI
    ===========

    Phase 1          Phase 2          Phase 3          Phase 4
  Linear Algebra    Calculus &      Probability &    Information
  & Vectors        Optimization    Statistics       Theory
       |                |               |               |
   [01]-[07]        [08]-[12]       [13]-[16]       [17]-[18]
       |                |               |               |
  Vectors, Dots,   Derivatives,    Bayes, Distri-   Entropy,
  Matrices, SVD    Gradients,      butions, MLE     Cross-Entropy,
                   Backprop                         A/B Testing
```

---

## Phase 1: Linear Algebra (Lessons 01-07)

The language AI speaks. Every model, every embedding, every weight
matrix lives here.

- [ ] [01 - Vectors](01-vectors.md)
- [ ] [02 - Dot Products & Similarity](02-dot-products-similarity.md)
- [ ] [03 - Matrices](03-matrices.md)
- [ ] [04 - Matrix Multiplication](04-matrix-multiplication.md)
- [ ] [05 - Matrix Operations](05-matrix-operations.md)
- [ ] [06 - Eigenvalues & Eigenvectors](06-eigenvalues-eigenvectors.md)
- [ ] [07 - SVD](07-svd.md)

**After this phase you'll understand:**
- Why word embeddings work
- How search engines find similar documents
- What happens inside a neural network layer
- How PCA reduces dimensions

---

## Phase 2: Calculus & Optimization (Lessons 08-12)

How models learn. Every training loop uses these ideas.

- [ ] [08 - Derivatives](08-derivatives.md)
- [ ] [09 - Partial Derivatives](09-partial-derivatives.md)
- [ ] [10 - Chain Rule](10-chain-rule.md)
- [ ] [11 - Gradient Descent Revisited](11-gradient-descent-revisited.md)
- [ ] [12 - Automatic Differentiation](12-automatic-differentiation.md)

**After this phase you'll understand:**
- Why we minimize loss functions
- How backpropagation actually works
- Why learning rate matters
- How PyTorch tracks gradients

---

## Phase 3: Probability & Statistics (Lessons 13-16)

Dealing with uncertainty. Language models output probabilities,
not certainties.

- [ ] [13 - Probability Basics](13-probability-basics.md)
- [ ] [14 - Distributions](14-distributions.md)
- [ ] [15 - Expected Value & Variance](15-expected-value-variance.md)
- [ ] [16 - Maximum Likelihood](16-maximum-likelihood.md)

**After this phase you'll understand:**
- Why softmax outputs probabilities
- What "temperature" does in LLMs
- How models pick the best parameters
- Why we use log-likelihood as loss

---

## Phase 4: Information Theory & Testing (Lessons 17-18)

The finishing touches. Cross-entropy loss finally makes sense.

- [ ] [17 - Information Theory](17-information-theory.md)
- [ ] [18 - Statistical Testing](18-statistical-testing.md)

**After this phase you'll understand:**
- Why cross-entropy is THE loss function for classification
- What KL divergence measures
- How to run a proper A/B test
- When results are statistically significant

---

## Reference Sheets

Quick lookups when you need them:

- [ ] [Formula Reference](reference-formulas.md)
- [ ] [NumPy Math Reference](reference-numpy-math.md)

---

## How to Use This Track

```
  +------------------------------------------+
  |  1. Read the lesson on your phone/tablet |
  |  2. Study the ASCII diagrams             |
  |  3. Run the Python examples              |
  |  4. Do the exercises                     |
  |  5. Check the box, move on               |
  +------------------------------------------+
```

**Time estimate:** ~2-3 hours per lesson, 36-54 hours total

**Prerequisites:** Basic algebra (you remember y = mx + b, right?)

**Tools needed:** Python 3.x with NumPy installed
(`pip install numpy`)

---

## The Big Picture

```
  INPUT DATA          MODEL              OUTPUT
  ==========        ========           ========
  [vectors]  --->  [matrices]  --->  [probabilities]
      ^               ^                    ^
      |               |                    |
  Phase 1         Phase 1+2           Phase 3+4
  Lessons 1-2     Lessons 3-12        Lessons 13-18
```

Everything connects. Linear algebra gives you the data structures.
Calculus tells you how to improve. Probability tells you how
confident to be. Information theory tells you how to measure it.

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Mathematics for Machine Learning** by Marc Peter Deisenroth, A. Aldo Faisal, and Cheng Soon Ong (Cambridge University Press, 2020) — Linear algebra, calculus, and probability for ML. *Free at mml-book.github.io*
- **An Introduction to Statistical Learning (ISLR)** by James, Witten, Hastie, and Tibshirani (Springer, 2nd Edition 2021) — Statistical foundations with R/Python labs. *Free PDF available*

---

[Start the track -> Lesson 01: Vectors](01-vectors.md)
