# Reference: The Math You Need for ML

You do NOT need a math degree. You need to understand a handful of concepts
well enough to read ML code and know what is happening. This reference covers
every piece of math you will encounter in this track.

Every concept gets an everyday analogy, a visual diagram, and a Python example.

---

## Functions: Input Goes In, Output Comes Out

A function is a machine. You put something in, something comes out.

```
Think of a vending machine:

   ┌──────────────────┐
   │   VENDING MACHINE │
   │                    │
   │  Input: $1.50      │──→  Output: Bag of chips
   │                    │
   └──────────────────┘

Same input always gives same output.
$1.50 + button B3 = chips. Every time.
```

In math notation: `f(x) = 2x + 1`

This says: take a number, double it, add 1.

```python
import numpy as np

def f(x):
    return 2 * x + 1

f(3)   # 7
f(10)  # 21
f(0)   # 1
```

In ML, a model IS a function. Data goes in, predictions come out.

```
       ┌──────────────┐
       │    MODEL      │
       │               │
Input: │ house features│──→  Output: predicted price
       │               │
       └──────────────┘
```

---

## Derivatives: The Speedometer of Math

A derivative tells you **how fast something is changing**. That is it.

```
Your car's speedometer analogy:

Position (where you are)  ──→  that is the function
Speed (how fast position changes)  ──→  that is the derivative

If you are driving at 60 mph, your position changes by 60 miles each hour.
The derivative of your position is your speed.
```

Visually, the derivative is the **slope** of a curve at any point:

```
        y
        │      .
        │     /   ← steep here = large derivative
        │    /
        │   .
        │  /  ← less steep = smaller derivative
        │ .
        │. ← nearly flat = derivative close to 0
        └──────────── x
```

For a straight line `y = 3x + 2`, the derivative is always `3`.
The slope never changes — it is always rising at the same rate.

For a curve like `y = x²`:
```
When x = 1:  derivative = 2  (gently rising)
When x = 5:  derivative = 10 (rising fast)
When x = 10: derivative = 20 (rising very fast)
```

The derivative of `x²` is `2x`. You can verify:

```python
def f(x):
    return x ** 2

def derivative_f(x):
    return 2 * x

derivative_f(1)   # 2
derivative_f(5)   # 10
derivative_f(10)  # 20
```

**Why ML cares:** Gradient descent uses derivatives to figure out which
direction reduces error. The derivative points "uphill," so you go the
opposite way.

### Common Derivatives You Will See

```
Function        Derivative       In words
─────────────────────────────────────────────
x²              2x               "speed up as x grows"
x³              3x²              "speed up even faster"
3x + 2          3                "constant speed"
eˣ              eˣ               "the bigger it is, the faster it grows"
ln(x)           1/x              "slows down as x grows"
```

### Partial Derivatives: Multiple Knobs

When a function has multiple inputs, a partial derivative tells you
how much the output changes when you tweak ONE input while holding
the others still.

```
Think of a mixing board in a recording studio:

  Volume   Bass    Treble
    │        │        │
    ▼        ▼        ▼
┌─────────────────────────┐
│      SOUND OUTPUT       │
└─────────────────────────┘

Partial derivative with respect to Volume:
  "If I turn ONLY the volume knob, how much does the sound change?"
  (Bass and Treble stay where they are)
```

```python
def cost(weight, bias):
    return (weight * 3 + bias - 10) ** 2

def d_cost_d_weight(weight, bias):
    return 2 * (weight * 3 + bias - 10) * 3

def d_cost_d_bias(weight, bias):
    return 2 * (weight * 3 + bias - 10)
```

---

## Matrices: Spreadsheets of Numbers

A matrix is a grid of numbers. Think of it as a spreadsheet without headers.

```
A regular spreadsheet:                A matrix:

  Name    Age   Score                 ┌           ┐
  Alice   25    92                    │ 25   92    │
  Bob     30    87                    │ 30   87    │
  Carol   22    95                    │ 22   95    │
                                      └           ┘

                                      This is a 3x2 matrix
                                      (3 rows, 2 columns)
```

```python
import numpy as np

A = np.array([
    [25, 92],
    [30, 87],
    [22, 95]
])

A.shape  # (3, 2) — 3 rows, 2 columns
```

### Why Matrices Matter for ML

Your entire dataset IS a matrix. Each row is one example (one house, one
email, one image). Each column is one feature (square footage, price, pixel).

```
House dataset as a matrix:

         sqft    bedrooms    age    price
House 1 [1400,     3,        20,    250000]
House 2 [1800,     4,        5,     350000]
House 3 [1200,     2,        35,    180000]
House 4 [2200,     5,        10,    420000]

This is a 4x4 matrix. 4 examples, 4 features.
```

### Vectors: A Matrix With One Column (or Row)

A vector is just a list of numbers. A single column or single row.

```
A column vector:     A row vector:

┌    ┐
│ 3  │               [3,  7,  2]
│ 7  │
│ 2  │
└    ┘
```

```python
v = np.array([3, 7, 2])
v.shape  # (3,)
```

---

## Matrix Multiplication: The Assembly Line

Matrix multiplication is NOT multiplying each element by the corresponding
element. It is a specific pattern of multiply-and-add.

```
Think of an assembly line:

Matrix A = workers          Matrix B = tasks
Each row is one worker      Each column is one task
Each column is a skill      Each row is a skill needed

The result tells you: how well does each worker handle each task?
```

The rule: to get position (row i, column j) of the result, take row i from
the first matrix and column j from the second matrix, multiply corresponding
elements, and add them up.

```
    A (2x3)          B (3x2)            Result (2x2)

┌          ┐    ┌        ┐         ┌              ┐
│ 1  2  3  │    │ 7   10 │         │ 1*7+2*8+3*9  │
│ 4  5  6  │  x │ 8   11 │    =    │ ...          │
└          ┘    │ 9   12 │         └              ┘
                └        ┘

Position (0,0):  1*7 + 2*8 + 3*9  = 7 + 16 + 27 = 50
Position (0,1):  1*10 + 2*11 + 3*12 = 10 + 22 + 36 = 68
Position (1,0):  4*7 + 5*8 + 6*9  = 28 + 40 + 54 = 122
Position (1,1):  4*10 + 5*11 + 6*12 = 40 + 55 + 72 = 167

Result:
┌          ┐
│  50   68 │
│ 122  167 │
└          ┘
```

The key constraint: **columns of A must equal rows of B**.

```
(2 x 3) @ (3 x 2) = (2 x 2)  ← works, inner dimensions match
      ↑       ↑
      └───────┘ these must be equal
```

```python
A = np.array([[1, 2, 3],
              [4, 5, 6]])

B = np.array([[7, 10],
              [8, 11],
              [9, 12]])

result = A @ B   # or np.matmul(A, B)
# array([[ 50,  68],
#        [122, 167]])
```

**Why ML cares:** A neural network layer is literally a matrix multiplication.
Your input data (matrix) gets multiplied by the weights (another matrix) to
produce the output. That is it. The entire forward pass is matrix math.

---

## Dot Product: Multiply and Add

The dot product takes two lists of equal length, multiplies each pair of
corresponding elements, and sums the results.

```
Think of a shopping cart:

Items:    [3 apples,  2 bananas,  1 orange]
Prices:   [$1.00,     $0.50,      $2.00   ]

Total = 3*$1.00 + 2*$0.50 + 1*$2.00 = $3.00 + $1.00 + $2.00 = $6.00

That is a dot product! Items dot Prices = Total cost.
```

```python
items = np.array([3, 2, 1])
prices = np.array([1.00, 0.50, 2.00])

total = np.dot(items, prices)  # 6.0
```

**Why ML cares:** Every neuron computes a dot product.
Inputs dot weights = neuron's output (before activation).

```
Neuron computation:

Inputs:   [x1, x2, x3]   =  [0.5,  0.8,  0.2]
Weights:  [w1, w2, w3]   =  [0.3,  0.7,  0.1]

Output = x1*w1 + x2*w2 + x3*w3
       = 0.5*0.3 + 0.8*0.7 + 0.2*0.1
       = 0.15 + 0.56 + 0.02
       = 0.73
```

---

## Exponentials and Logarithms: Growth and Decay

### Exponentials: Runaway Growth

```
Think of a rumor spreading:

Day 0: 1 person knows         (2⁰ = 1)
Day 1: 2 people know           (2¹ = 2)
Day 2: 4 people know           (2² = 4)
Day 3: 8 people know           (2³ = 8)
Day 10: 1,024 people know      (2¹⁰ = 1024)
Day 20: 1,048,576 people know  (2²⁰)

Each day it DOUBLES. That is exponential growth.
```

The most important exponential in ML is `e` (Euler's number, approximately 2.718):

```python
np.exp(0)    # 1.0
np.exp(1)    # 2.718...
np.exp(2)    # 7.389...
np.exp(5)    # 148.41...
np.exp(-1)   # 0.368...  (negative exponents give small numbers)
np.exp(-5)   # 0.0067... (very small)
```

```
eˣ graph:

        y
    150 │                    .
        │                   /
    100 │                  /
        │                 /
     50 │               /
        │             /
      1 │─────────./
        └──────────────────── x
       -5    0    1  2  3  4  5

Key insight: always positive, grows FAST for positive x,
approaches 0 (but never reaches it) for negative x.
```

### Logarithms: The Undo Button for Exponentials

If exponentials are "how much do I have after this many doublings,"
logarithms ask "how many doublings did it take to reach this amount?"

```
Exponential: 2¹⁰ = 1024    "10 doublings give 1024"
Logarithm:   log₂(1024) = 10  "it took 10 doublings to reach 1024"

They are inverses:
exp(x) and log(x) cancel each other out.
log(exp(x)) = x
exp(log(x)) = x
```

The natural logarithm `ln` (or `log` in numpy) uses base `e`:

```python
np.log(1)        # 0.0       (e⁰ = 1)
np.log(2.718)    # ~1.0      (e¹ ≈ 2.718)
np.log(10)       # 2.302...
np.log(0.5)      # -0.693... (logs of numbers < 1 are negative)
np.log(0.01)     # -4.605... (very negative for tiny numbers)
```

```
ln(x) graph:

        y
      3 │              .──────
        │           ./
      1 │       ./
      0 │───./ ──────────────── x
        │  /    1    2    5   10
     -1 │/
        │
     -3 │

Key insight: grows very slowly, is 0 at x=1,
negative for x < 1, undefined for x ≤ 0.
```

**Why ML cares:** The log-loss function uses logarithms. When a model
predicts 0.99 probability for the correct class, `log(0.99) = -0.01`
(small penalty). When it predicts 0.01 for the correct class,
`log(0.01) = -4.6` (huge penalty). Logarithms naturally penalize
confident wrong answers very harshly.

---

## Probability Basics

Probability is a number between 0 and 1 that represents how likely
something is to happen.

```
0 = impossible     0.5 = coin flip     1 = certain

├──────────┼──────────┤
0         0.5         1
impossible   maybe    certain
```

### Key Rules

**All probabilities of all possible outcomes add to 1:**

```
Rolling a die:

P(1) + P(2) + P(3) + P(4) + P(5) + P(6) = 1
1/6  + 1/6  + 1/6  + 1/6  + 1/6  + 1/6  = 1

Classification model output (3 classes):

P(cat) + P(dog) + P(bird) = 1
0.70   + 0.25   + 0.05    = 1.0
```

**Conditional probability — P(A | B) means "probability of A given B":**

```
P(umbrella | raining)  = high
P(umbrella | sunny)    = low

"Given that it is raining, what is the probability someone has an umbrella?"
```

```python
outcomes = np.array([0.70, 0.25, 0.05])
np.sum(outcomes)  # 1.0 — probabilities sum to 1
```

**Why ML cares:** Classification models output probabilities. A model does
not say "this is a cat." It says "probability of cat: 0.92, dog: 0.06,
bird: 0.02." Training adjusts these probabilities to be correct.

---

## Summation Notation: Compact Addition

The sigma symbol (Greek capital S) is shorthand for "add up a bunch of things."

```
 n
 Σ  xᵢ  =  x₁ + x₂ + x₃ + ... + xₙ
i=1

Translation: "Add up all the x values, from the first to the nth."
```

This is just a for loop:

```python
values = [10, 20, 30, 40, 50]

total = sum(values)  # 150

total = 0
for x_i in values:
    total += x_i
# total = 150
```

### Mean (Average)

```
         1   n
Mean  =  ─   Σ  xᵢ
         n  i=1

Translation: "Add up all values, divide by how many there are."
```

```python
values = np.array([10, 20, 30, 40, 50])
mean = np.sum(values) / len(values)   # 30.0
# or: np.mean(values)
```

### Mean Squared Error (MSE)

```
         1   n
MSE  =   ─   Σ  (yᵢ - ŷᵢ)²
         n  i=1

Translation:
"For each prediction, find the error (actual minus predicted).
 Square each error (makes them all positive, punishes big errors).
 Average them."
```

```python
actual    = np.array([100, 200, 300])
predicted = np.array([110, 190, 320])

errors = actual - predicted              # [-10, 10, -20]
squared_errors = errors ** 2             # [100, 100, 400]
mse = np.mean(squared_errors)            # 200.0
```

---

## Quick Reference Table

```
Symbol      Name                    Python              What it means
───────────────────────────────────────────────────────────────────────
f(x)        Function                def f(x):           input → output
f'(x)       Derivative              (manual calc)       rate of change
∂f/∂x       Partial derivative      (manual calc)       rate of change of one variable
Σ           Summation               sum() / np.sum()    add things up
e^x         Exponential             np.exp(x)           rapid growth
ln(x)       Natural log             np.log(x)           inverse of e^x
A @ B       Matrix multiply         A @ B               rows-dot-columns
a · b       Dot product             np.dot(a, b)        multiply and sum
|x|         Absolute value          np.abs(x)           distance from zero
x²          Square                  x ** 2              multiply by itself
√x          Square root             np.sqrt(x)          inverse of squaring
```

---

You do not need to memorize any of this. Come back to this page whenever
you see unfamiliar notation in the lessons. Each concept will also be
re-explained in context when it first appears.
