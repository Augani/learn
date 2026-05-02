# Math Foundations Track — The Math You Actually Need for ML

Welcome to Math Foundations. This track gives you the mathematical
toolkit for machine learning — linear algebra, calculus, and probability —
without the fluff. Every concept connects directly to something you will
build or use in later tracks.

You do not need a math degree. You need basic algebra (variables,
equations, functions). This track handles the rest.

If you want deeper dives into any topic, the full treatment lives in
the [Math for AI track](../math-for-ai/00-roadmap.md) (18 lessons).
This track is the fast on-ramp.

```
  YOU ARE HERE
      |
      v
+------------------+     +------------------+
|   PHASE 1        |     |   PHASE 2        |
|   Linear Algebra |---->|   Calculus        |
|   Lessons 01-04  |     |   Lessons 05-06  |
+------------------+     +------------------+
                                  |
                                  v
+------------------+     +------------------+
|   PHASE 4        |     |   PHASE 3        |
|   Connecting     |<----|   Probability &   |
|   It All         |     |   Statistics      |
|   Lesson 09      |     |   Lessons 07-08   |
+------------------+     +------------------+
```

---

## Reference Files

- [Formula Cheat Sheet](./reference-formulas.md) — Every formula in this track with NumPy equivalents

---

## The Roadmap

### Phase 1: Linear Algebra (Hours 1–8)

The language of data. Vectors hold your data, matrices transform it,
and every neural network is just matrix multiplication all the way down.

- [ ] [Lesson 01: Vectors and Matrices](./01-vectors-matrices.md)
- [ ] [Lesson 02: Dot Products and Similarity](./02-dot-products-similarity.md)
- [ ] [Lesson 03: Matrix Multiplication](./03-matrix-multiplication.md)
- [ ] [Lesson 04: Transpose, Eigenvalues, and Decomposition](./04-transpose-eigenvalues.md)

**You'll build:** Vector operations from scratch, then connect them to neural network weight representations.

---

### Phase 2: Calculus (Hours 9–12)

How machines learn. Derivatives tell you which direction to adjust,
and the chain rule makes backpropagation possible.

- [ ] [Lesson 05: Derivatives and Gradients](./05-derivatives-gradients.md)
- [ ] [Lesson 06: The Chain Rule and Backpropagation](./06-chain-rule-backprop.md)

**You'll build:** Gradient descent on a simple function, then manual backprop through a 2-layer network.

---

### Phase 3: Probability & Statistics (Hours 13–16)

How models make decisions under uncertainty. Probability distributions
drive everything from softmax outputs to sampling in LLMs.

- [ ] [Lesson 07: Probability and Distributions](./07-probability-distributions.md)
- [ ] [Lesson 08: Expectation, Variance, and MLE](./08-expectation-variance-mle.md)

**You'll build:** Softmax from scratch, MLE for a Gaussian, and connect both to real ML training.

---

### Phase 4: Connecting It All (Hours 17–18)

The payoff. A complete map from every math concept in this track to
where it appears in the ML/AI curriculum.

- [ ] [Lesson 09: The Math-to-ML Map](./09-math-to-ml-map.md)

**You'll build:** A mental model connecting math foundations to neural networks, transformers, and training.

---

## How to Use This Track

```
+------------------+
|  Read the lesson |
+--------+---------+
         |
         v
+------------------+
| Run the examples |
+--------+---------+
         |
         v
+------------------+
| Do the exercises |
+--------+---------+
         |
         v
+------------------+
| Check the box    |
| Move to next     |
+------------------+
```

Each lesson is designed to be completed in 1.5–2 hours.
Do them in order. The exercises build on each other.

Start here: [Lesson 01: Vectors and Matrices](./01-vectors-matrices.md)

---

## Prerequisites

- Basic algebra (variables, equations, functions)
- Python 3.10+
- A terminal you are comfortable in

```
pip install numpy matplotlib
```

---

## Time Estimate

| Phase | Lessons | Hours |
|-------|---------|-------|
| Phase 1: Linear Algebra | 01–04 | ~8 hrs |
| Phase 2: Calculus | 05–06 | ~4 hrs |
| Phase 3: Probability & Statistics | 07–08 | ~4 hrs |
| Phase 4: Connecting It All | 09 | ~2 hrs |
| **Total** | **9 lessons** | **~18 hrs** |

---

## What Comes Next

After completing this track, continue to:

- **[ML Fundamentals (Track 7)](../ml-fundamentals/00-roadmap.md)** — Apply these math concepts to build neural networks from scratch
- **[GPU & CUDA Fundamentals](../gpu-cuda-fundamentals/00-roadmap.md)** — Understand the hardware that makes ML fast

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Mathematics for Machine Learning** by Deisenroth, Faisal & Ong (Cambridge, 2020) — The full mathematical treatment, free PDF available online
- **Linear Algebra and Its Applications** by Gilbert Strang (Cengage, 2005) — The classic linear algebra textbook
- **3Blue1Brown: Essence of Linear Algebra** (YouTube series) — Beautiful visual intuition for linear algebra concepts
