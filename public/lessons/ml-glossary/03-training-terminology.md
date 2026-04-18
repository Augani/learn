# Lesson 03: Training Terminology — The Language of Learning

When a model "trains," what is actually happening? This lesson defines
every term you will encounter in the training loop — from epochs to
overfitting — with visual examples that make each concept concrete.

---

## Epoch

**Plain English:** One complete pass through the entire training
dataset. If you have 1 million examples and the model sees all of
them once, that is one epoch.

**Technical definition:** An epoch is one full iteration over the
training dataset. If the dataset has N examples and the batch size
is B, one epoch consists of ⌈N/B⌉ gradient update steps. Models
typically train for multiple epochs (1–100+, depending on dataset
size and task).

**Example:** Reading a textbook cover to cover is one epoch. Reading
it three times is three epochs. Each time through, you pick up things
you missed before.

```
Epoch visualization:

    Dataset: [A][B][C][D][E][F][G][H]  (8 examples)
    Batch size: 2

    Epoch 1:  [A,B] → [C,D] → [E,F] → [G,H]  (4 steps)
    Epoch 2:  [C,A] → [H,E] → [B,G] → [F,D]  (4 steps, shuffled)
    Epoch 3:  [F,B] → [A,G] → [D,H] → [E,C]  (4 steps, shuffled)

    Total training steps: 12
```

**Cross-reference:** See [ML Fundamentals, Lesson 03: Gradient Descent](../ml-fundamentals/03-gradient-descent.md) for how training steps work.

---

## Batch Size

**Plain English:** How many examples the model looks at before
updating its weights. Larger batches = more stable updates but
more memory.

**Technical definition:** The number of training examples processed
in one forward/backward pass before a parameter update. Affects
gradient noise (smaller batches = noisier gradients), memory usage
(linear in batch size for activations), and training dynamics.
Common values: 32, 64, 256, 1024+.

**Example:** Imagine grading exams. You could update your grading
rubric after every single exam (batch size 1 — noisy, reactive) or
after grading 100 exams (batch size 100 — stable, but slow to adapt).

```
Batch size trade-offs:

    Small batch (e.g., 8):
    ┌──────────────────────────────────┐
    │ + Less GPU memory                │
    │ + Can escape local minima        │
    │ - Noisy gradient estimates       │
    │ - Slower wall-clock time         │
    └──────────────────────────────────┘

    Large batch (e.g., 2048):
    ┌──────────────────────────────────┐
    │ + Stable gradient estimates      │
    │ + Better GPU utilization         │
    │ - More GPU memory                │
    │ - May converge to sharp minima   │
    └──────────────────────────────────┘
```

---

## Learning Rate

**Plain English:** How big a step the model takes when updating its
weights. Too big = overshoots. Too small = takes forever.

**Technical definition:** A scalar hyperparameter (typically 10⁻⁵ to
10⁻¹) that multiplies the gradient before subtracting it from the
weights: w_new = w_old - learning_rate × gradient. Often scheduled
to decrease during training (warmup + decay).

**Example:** Imagine walking downhill in fog. The learning rate is
your step size. Big steps get you down fast but you might step over
the valley. Tiny steps are safe but painfully slow.

```
Learning rate effect on training:

    Loss
    │
    │  ╲                    LR too high: diverges
    │   ╲  ╱╲  ╱╲
    │    ╲╱  ╲╱  ╲╱ ╱╲
    │                 ╲╱
    │
    │  ╲
    │   ╲                   LR just right: converges smoothly
    │    ╲
    │     ╲──────────────
    │
    │  ─────────────────    LR too small: barely moves
    │   ─────────────────
    └──────────────────── Steps
```

**Cross-reference:** See [ML Fundamentals, Lesson 03: Gradient Descent](../ml-fundamentals/03-gradient-descent.md) for learning rate in context.

---

## Loss

**Plain English:** A single number that measures how wrong the model
is. Training tries to make this number as small as possible.

**Technical definition:** A scalar-valued function L(ŷ, y) that
measures the discrepancy between the model's predictions ŷ and the
true labels y. Common loss functions: cross-entropy (classification),
MSE (regression), next-token prediction loss (language models). The
gradient of the loss with respect to parameters drives weight updates.

**Example:** Think of loss as your score in golf — lower is better.
A loss of 0 means perfect predictions. The training process is
trying to minimize this score.

```
Common loss functions:

    Cross-Entropy Loss (classification):
    L = -Σ yᵢ log(ŷᵢ)
    Used for: image classification, next-token prediction

    Mean Squared Error (regression):
    L = (1/N) Σ (yᵢ - ŷᵢ)²
    Used for: predicting continuous values

    A typical loss curve during training:

    Loss
    4.0 │╲
        │ ╲
    3.0 │  ╲
        │   ╲
    2.0 │    ╲
        │     ╲───
    1.0 │         ╲────────────────
        │
    0.0 └──────────────────────────
        0    1000   2000   3000  Steps
```

**Cross-reference:** See [ML Fundamentals, Lesson 08: Training](../ml-fundamentals/08-training.md) for loss functions in practice.

---

## Convergence

**Plain English:** When the loss stops decreasing meaningfully —
the model has learned about as much as it can from the data.

**Technical definition:** A model has converged when the loss
function reaches a (local) minimum and additional training steps
produce negligible improvement. In practice, convergence is judged
by monitoring the validation loss — when it plateaus or starts
increasing, training is typically stopped.

**Example:** Like filling a glass of water — at first the level
rises quickly, then it slows down, and eventually it is full.
Continuing to pour just wastes water (compute).

```
Convergence:

    Loss
    │╲
    │ ╲
    │  ╲
    │   ╲
    │    ╲───────────────── ← Converged (loss plateaus)
    │
    └──────────────────────
     0                Steps

    Not converged yet:

    Loss
    │╲
    │ ╲
    │  ╲
    │   ╲
    │    ╲
    │     ╲               ← Still decreasing — keep training!
    └──────────────────────
     0                Steps
```

---

## Overfitting

**Plain English:** When the model memorizes the training data instead
of learning general patterns. It performs great on training data but
poorly on new data.

**Technical definition:** Overfitting occurs when the model's
training loss continues to decrease while the validation loss
increases. The model has learned noise and specific patterns in the
training set that do not generalize. The gap between training and
validation performance is the "generalization gap."

**Example:** Like a student who memorizes every answer in the
practice exam but cannot solve new problems. They "learned" the
specific questions, not the underlying concepts.

```
Overfitting visualized:

    Loss
    │
    │  ╲  Validation loss
    │   ╲──────╱──────────── ← Goes back up!
    │    ╲    ╱
    │     ╲──╱
    │      ╲╱
    │       ╲
    │        ╲  Training loss
    │         ╲──────────── ← Keeps going down
    │
    └──────────────────────
     0                Steps
              ↑
         Overfitting starts here
         (validation loss starts increasing)
```

**Cross-reference:** See [ML Fundamentals, Lesson 07: Backpropagation](../ml-fundamentals/07-backpropagation.md) for overfitting in neural networks.

---

## Underfitting

**Plain English:** When the model is too simple to capture the
patterns in the data. It performs poorly on both training and
validation data.

**Technical definition:** Underfitting occurs when the model has
insufficient capacity (too few parameters, too few layers) or has
not been trained long enough to learn the underlying data
distribution. Both training and validation losses remain high.

**Example:** Like trying to draw a curve using only a straight line.
No matter how you position the line, it cannot capture the shape.

```
Underfitting vs. good fit vs. overfitting:

    Underfitting          Good fit              Overfitting
    (too simple)          (just right)          (too complex)

    ·  ·                  ·  ·                  ·  ·
      ·    ·                ·    ·                ·    ·
    ────────────          ·──╲──·──╱──          ·╲╱·╲╱·╲╱
    ·        ·            ·    ╲╱    ·          ·        ·
      ·  ·                  ·  ·                  ·  ·

    High train loss       Low train loss        Very low train loss
    High val loss         Low val loss          High val loss
```

---

## Regularization

**Plain English:** Techniques that prevent overfitting by
discouraging the model from becoming too complex or memorizing
the training data.

**Technical definition:** Any modification to the learning algorithm
that reduces generalization error without necessarily reducing
training error. Common forms: L2 regularization (weight decay),
dropout, data augmentation, early stopping, batch normalization.

**Example:** Like a teacher who says "explain the concept in your
own words" instead of "recite the textbook." It forces the student
to actually understand, not just memorize.

```
Common regularization techniques:

    ┌──────────────┬──────────────────────────────────────┐
    │ Technique    │ What it does                         │
    ├──────────────┼──────────────────────────────────────┤
    │ Weight decay │ Penalizes large weights              │
    │ (L2 reg)    │ Loss += λ × Σ w²                     │
    ├──────────────┼──────────────────────────────────────┤
    │ Dropout      │ Randomly zeros out neurons during    │
    │              │ training (e.g., 10-50% dropout rate) │
    ├──────────────┼──────────────────────────────────────┤
    │ Early        │ Stop training when validation loss   │
    │ stopping     │ starts increasing                    │
    ├──────────────┼──────────────────────────────────────┤
    │ Data         │ Create variations of training data   │
    │ augmentation │ (flip, rotate, crop images)          │
    └──────────────┴──────────────────────────────────────┘

    Dropout visualization:

    Without dropout:        With dropout (p=0.5):
    ○ ─── ○ ─── ○          ○ ─── ● ─── ○
    ○ ─── ○ ─── ○          ● ─── ○ ─── ○
    ○ ─── ○ ─── ○          ○ ─── ○ ─── ●

    ○ = active neuron      ● = dropped (zeroed out)
```

**Cross-reference:** See [Advanced Deep Learning, Lesson 01: Regularization](../advanced-deep-learning/01-regularization.md) for advanced regularization techniques.

---

## Gradient

**Plain English:** The direction and magnitude of the steepest
increase in loss. Training goes in the opposite direction (downhill).

**Technical definition:** The gradient ∇L is a vector of partial
derivatives of the loss function with respect to each parameter.
It points in the direction of steepest ascent. Gradient descent
subtracts the gradient (scaled by the learning rate) from the
parameters to minimize the loss.

**Example:** Standing on a hillside, the gradient tells you which
direction is steepest uphill. You walk the opposite way to go
downhill (toward lower loss).

```
Gradient descent in 2D:

    Loss surface (contour plot):

         ╭───────╮
        ╱  high   ╲
       │   loss    │
       │  ╭───╮   │
       │ │ low │   │
       │ │loss │   │
       │  ╰─●─╯   │    ● = current position
        ╲   ↓  ↙  ╱    arrows = negative gradient
         ╰───────╯      (direction of steepest descent)
```

**Cross-reference:** See [Math Foundations, Lesson 05: Derivatives and Gradients](../math-foundations/05-derivatives-gradients.md) for the math behind gradients.

---

## Concept Check Exercises

### Exercise 1: Training Arithmetic

```
A dataset has 50,000 training examples.
Batch size: 256
Number of epochs: 3

a) Steps per epoch: ⌈50,000 / 256⌉ = ___
b) Total training steps: ___ × 3 = ___
c) Total examples seen: 50,000 × 3 = ___
d) If each step takes 0.1 seconds, total training time: ___ seconds = ___ minutes
```

### Exercise 2: Diagnose the Problem

```
Look at these training curves and diagnose the issue:

Scenario A:
    Training loss:   2.5 → 0.01
    Validation loss: 2.5 → 1.8
    Diagnosis: _______________

Scenario B:
    Training loss:   2.5 → 2.3
    Validation loss: 2.5 → 2.4
    Diagnosis: _______________

Scenario C:
    Training loss:   2.5 → 0.3
    Validation loss: 2.5 → 0.35
    Diagnosis: _______________
```

### Exercise 3: Learning Rate Experiment

```python
import numpy as np

# Simple gradient descent on f(x) = x²
# Minimum is at x = 0

def gradient(x):
    return 2 * x  # derivative of x²

# TODO: Start at x = 5.0
# TODO: Run 20 steps of gradient descent with learning_rate = 0.1
# TODO: Print x at each step. Does it converge?
# TODO: Repeat with learning_rate = 1.1. What happens?
# TODO: Repeat with learning_rate = 0.001. What happens?
```

### Exercise 4: Batch Size and Memory

```
A model processes images of shape (3, 224, 224) = 150,528 floats per image.
Each float is 4 bytes (FP32).

a) Memory per image: 150,528 × 4 = ___ bytes = ___ MB
b) Memory for batch size 32: ___ MB
c) Memory for batch size 256: ___ MB
d) If your GPU has 8 GB free for activations, what is the
   maximum batch size? ___

(Note: this is just input memory — actual activation memory
 during training is much larger due to intermediate values)
```

---

Next: [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)
