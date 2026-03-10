# Lesson 08: Derivatives

> **Analogy:** Rolling a ball down a hill — the derivative tells you
> which way is downhill and how steep it is.

---

## The Core Question

You're standing on a hill. Which direction makes you go down fastest?

```
  The terrain:

  height
    ^
    |   *
    |  * *
    | *   *
    |*     *         *
    |       *       *
    |        *     *
    |         * * *    <-- minimum!
    |
    +-------------------> x
         you are here ^

  Derivative at your position = slope of the hill
  Negative slope = going downhill (good!)
  Positive slope = going uphill (bad!)
  Zero slope = flat spot (maybe the bottom!)
```

The derivative answers: "If I nudge x a tiny bit,
how much does y change?"

---

## Definition

```
  f'(x) = lim      f(x + h) - f(x)
           h -> 0  -----------------
                          h

  In plain English:
  "Change a tiny amount, measure how much the output changes,
   divide by how much you changed."

  Slope = rise / run

         f(x+h) *
               /|
              / | rise = f(x+h) - f(x)
         f(x)* |
              --|
              run = h
```

---

## Common Derivatives You Need

```
  +-------------------+-------------------+------------------+
  | Function f(x)     | Derivative f'(x)  | Example          |
  +-------------------+-------------------+------------------+
  | c (constant)      | 0                 | 5 -> 0           |
  | x                 | 1                 | x -> 1           |
  | x^n               | n * x^(n-1)      | x^3 -> 3x^2     |
  | e^x               | e^x              | e^x -> e^x       |
  | ln(x)             | 1/x              | ln(x) -> 1/x     |
  | 1/x               | -1/x^2           | 1/x -> -1/x^2   |
  +-------------------+-------------------+------------------+
```

You don't need to memorize these — but recognize them.
They show up in loss functions and activation functions.

---

## Numerical Derivative: Approximate It!

Don't want to do calculus? Just approximate:

```
  f'(x) ~ [f(x + h) - f(x - h)] / (2 * h)

  This is "central differences" — average the forward
  and backward slopes for better accuracy.

      f(x+h)  *
             / |
        f(x)/  |
           / * |
     f(x-h)   |
         |-----|
          2*h
```

---

## Python: Numerical vs Analytical Derivatives

```python
import numpy as np

def f(x):
    return x**3 - 2*x**2 + x

def f_derivative_analytical(x):
    return 3*x**2 - 4*x + 1

def f_derivative_numerical(f, x, h=1e-7):
    return (f(x + h) - f(x - h)) / (2 * h)

x_values = np.array([-1.0, 0.0, 1.0, 2.0, 3.0])

for x in x_values:
    analytical = f_derivative_analytical(x)
    numerical = f_derivative_numerical(f, x)
    print(f"x={x:4.1f}  analytical={analytical:8.4f}  "
          f"numerical={numerical:8.4f}  "
          f"diff={abs(analytical - numerical):.2e}")
```

---

## Finding Minimums: Set Derivative = 0

```
  Loss function L(w) = (w - 3)^2

  L'(w) = 2(w - 3)

  Set L'(w) = 0:
  2(w - 3) = 0
  w = 3        <-- the minimum!

  Check: is it a minimum or maximum?
  L''(w) = 2 > 0  --> it curves UP --> minimum!

  height
    ^
    |*              *
    | *            *
    |  *          *
    |   *        *
    |    *      *
    |     *    *
    |      *  *
    |       **         <-- w = 3, minimum
    +--------+---------> w
             3
```

This is exactly what training does: find the weights
that minimize the loss.

---

## Derivatives of AI Functions

**Sigmoid:**
```
  sigmoid(x) = 1 / (1 + e^(-x))
  sigmoid'(x) = sigmoid(x) * (1 - sigmoid(x))

     1 |          --------
       |        /
  0.5  |      /
       |    /
     0 |----
       +---------+---------> x
                 0

  Derivative is largest at x=0 (steepest part)
  Derivative near 0 at extremes (flat = vanishing gradient!)
```

**ReLU:**
```
  relu(x) = max(0, x)
  relu'(x) = 0 if x < 0, 1 if x > 0

       |        /
       |       /
       |      /
       |     /
  -----+----/-----------> x
       |
       |

  Simple! Either pass gradient through (1) or block it (0).
  This is why ReLU is so popular — easy gradient computation.
```

---

## Python: Activation Function Derivatives

```python
import numpy as np

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def sigmoid_derivative(x):
    s = sigmoid(x)
    return s * (1 - s)

def relu(x):
    return np.maximum(0, x)

def relu_derivative(x):
    return (x > 0).astype(float)

x = np.linspace(-5, 5, 11)

print("Sigmoid and its derivative:")
for xi in x:
    print(f"  x={xi:5.1f}  sig={sigmoid(xi):.4f}  "
          f"sig'={sigmoid_derivative(xi):.4f}")

print("\nReLU and its derivative:")
for xi in x:
    print(f"  x={xi:5.1f}  relu={relu(xi):.1f}  "
          f"relu'={relu_derivative(xi):.1f}")
```

---

## The Loss Landscape

Training a neural network = finding the lowest point:

```
  Loss
    ^
    | *                     *
    |  *   *               *
    |   * * *             *
    |       *   *        *
    |        * * *      *
    |             *    *
    |              *  *
    |               **    <-- global minimum (we want this!)
    |
    +---------------------------------> weights

  The derivative tells you:
  - Negative derivative: go RIGHT (you're heading downhill)
  - Positive derivative: go LEFT (you're heading downhill)
  - Zero derivative: you're at a minimum (or saddle point)
```

---

## Derivative Rules

```
  SUM RULE:      (f + g)' = f' + g'
  PRODUCT RULE:  (f * g)' = f' * g + f * g'
  QUOTIENT RULE: (f / g)' = (f' * g - f * g') / g^2
  CHAIN RULE:    (f(g(x)))' = f'(g(x)) * g'(x)  [Next lesson!]

  Constant multiple: (c * f)' = c * f'

  These let you break complex derivatives into simple pieces.
```

---

## Python: Visualizing the Slope

```python
import numpy as np

def f(x):
    return x**4 - 4*x**2 + 2

def f_prime(x):
    return 4*x**3 - 8*x

x_range = np.linspace(-2.5, 2.5, 50)

print("x      | f(x)    | f'(x)   | direction")
print("-------+---------+---------+----------")
for x in [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0]:
    slope = f_prime(x)
    if abs(slope) < 0.1:
        direction = "FLAT (min/max)"
    elif slope < 0:
        direction = "going down -->"
    else:
        direction = "<-- going up"
    print(f"{x:+5.1f}  | {f(x):+7.3f} | {slope:+7.3f} | {direction}")
```

---

## Why This Matters for AI

```
  Neural network training loop:

  1. Forward pass:  predictions = model(inputs)
  2. Compute loss:  L = loss_fn(predictions, targets)
  3. DERIVATIVE:    dL/dw = how loss changes with each weight
  4. Update:        w = w - learning_rate * dL/dw

  Step 3 is ALL derivatives.

  If dL/dw is positive:  increasing w increases loss -> DECREASE w
  If dL/dw is negative:  increasing w decreases loss -> INCREASE w

  Always move OPPOSITE to the derivative. Downhill!
```

---

## Key Takeaways

```
  +-----------------------------------------------------+
  |  DERIVATIVE = rate of change = slope                  |
  |  Negative slope = going downhill                      |
  |  Zero slope = at a min/max                            |
  |  Numerical approx: (f(x+h) - f(x-h)) / 2h           |
  |  ReLU derivative = 0 or 1 (dead simple)               |
  |  Sigmoid derivative = sig(x) * (1 - sig(x))          |
  |  Training = follow negative derivative downhill        |
  +-----------------------------------------------------+
```

---

## Exercises

**Exercise 1:** Find the derivative of `f(x) = 3x^2 + 2x - 5`
by hand. Verify numerically.

**Exercise 2:** Find where `f(x) = x^3 - 6x^2 + 9x + 1` has
zero slope (set derivative = 0). Are these minimums or maximums?

**Exercise 3:** Implement `tanh` and its derivative. Plot values
at x = -3, -2, -1, 0, 1, 2, 3.

```python
import numpy as np

def tanh(x):
    return np.tanh(x)

def tanh_derivative(x):
    pass
```

**Exercise 4:** Write a function that finds the minimum of any
single-variable function using the derivative:

```python
def find_minimum(f, x_start, lr=0.01, steps=1000, h=1e-7):
    pass
```

Test it on `f(x) = (x - 3)^2 + 1`.

**Exercise 5:** Compare sigmoid, ReLU, and tanh derivatives at
x = -10, -1, 0, 1, 10. Which has the largest gradient at x = 0?
Which has vanishing gradients at the extremes?

---

[Next: Lesson 09 - Partial Derivatives ->](09-partial-derivatives.md)
