# Lesson 05: Derivatives and Gradients — How Machines Know Which Way to Adjust

Derivatives answer the question: "If I nudge this parameter a tiny bit,
how much does the output change?" Gradients extend this to multiple
parameters at once. Together, they are the foundation of how every
neural network learns.

---

## The Core Idea: Derivatives

A **derivative** measures the rate of change of a function. It tells
you the slope — how steep the hill is and which direction is downhill.

**Analogy: Speedometer.** Your car's position changes over time.
The derivative of position is speed — how fast your position is
changing right now. The derivative of speed is acceleration — how
fast your speed is changing.

```
Function f(x) = x²

    f(x)
     │
  16 │            •
     │          /
   9 │        •
     │      /
   4 │    •
     │  /
   1 │•
     │
     └──────────────── x
     0  1  2  3  4

The derivative f'(x) = 2x tells you the slope at any point:
    At x=1: slope = 2  (gentle uphill)
    At x=2: slope = 4  (steeper)
    At x=3: slope = 6  (steeper still)
    At x=0: slope = 0  (flat — this is the minimum!)
```

```python
import numpy as np

# The function
def f(x):
    return x ** 2

# The exact derivative
def f_prime(x):
    return 2 * x

# Numerical derivative (approximation)
def numerical_derivative(func, x, h=1e-7):
    """Approximate the derivative using the limit definition."""
    return (func(x + h) - func(x - h)) / (2 * h)

# Compare exact vs numerical
for x in [0, 1, 2, 3]:
    exact = f_prime(x)
    numerical = numerical_derivative(f, x)
    print(f"x={x}: exact={exact:.4f}, numerical={numerical:.4f}")
```

---

## Common Derivatives You Will See in ML

```
Function          Derivative         Where it appears in ML
─────────────────────────────────────────────────────────────
f(x) = x²        f'(x) = 2x        MSE loss
f(x) = |x|       f'(x) = sign(x)   MAE loss
f(x) = eˣ        f'(x) = eˣ        Softmax
f(x) = ln(x)     f'(x) = 1/x       Cross-entropy loss
f(x) = max(0,x)  f'(x) = 1 if x>0  ReLU activation
                         0 if x≤0
f(x) = 1/(1+e⁻ˣ) f'(x) = f(x)(1-f(x))  Sigmoid activation
```

```python
import numpy as np

# ReLU and its derivative
def relu(x):
    return np.maximum(0, x)

def relu_derivative(x):
    return (x > 0).astype(float)

# Sigmoid and its derivative
def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def sigmoid_derivative(x):
    s = sigmoid(x)
    return s * (1 - s)

x = np.array([-2, -1, 0, 1, 2])
print(f"x:              {x}")
print(f"ReLU(x):        {relu(x)}")
print(f"ReLU'(x):       {relu_derivative(x)}")
print(f"Sigmoid(x):     {np.round(sigmoid(x), 4)}")
print(f"Sigmoid'(x):    {np.round(sigmoid_derivative(x), 4)}")
```

---

## Partial Derivatives

When a function has multiple inputs, a **partial derivative** measures
how the output changes when you nudge just ONE input, holding the
others fixed.

**Analogy: Mixing board knobs.** A DJ has knobs for bass, treble, and
volume. The partial derivative with respect to bass tells you how the
sound changes when you turn just the bass knob, leaving treble and
volume alone.

```
f(x, y) = x² + 3xy + y²

Partial derivative with respect to x (treat y as constant):
    ∂f/∂x = 2x + 3y

Partial derivative with respect to y (treat x as constant):
    ∂f/∂y = 3x + 2y

At the point (x=1, y=2):
    ∂f/∂x = 2(1) + 3(2) = 8    "nudging x increases f by ~8"
    ∂f/∂y = 3(1) + 2(2) = 7    "nudging y increases f by ~7"
```

```python
import numpy as np

def f(x, y):
    return x**2 + 3*x*y + y**2

def numerical_partial_x(func, x, y, h=1e-7):
    return (func(x + h, y) - func(x - h, y)) / (2 * h)

def numerical_partial_y(func, x, y, h=1e-7):
    return (func(x, y + h) - func(x, y - h)) / (2 * h)

x, y = 1.0, 2.0
print(f"f({x}, {y}) = {f(x, y)}")
print(f"∂f/∂x = {numerical_partial_x(f, x, y):.4f}")  # ~8.0
print(f"∂f/∂y = {numerical_partial_y(f, x, y):.4f}")  # ~7.0
```

---

## The Gradient Vector

The **gradient** collects all partial derivatives into a single vector.
It points in the direction of steepest increase.

```
For f(x, y) = x² + 3xy + y²:

    ∇f = [∂f/∂x, ∂f/∂y] = [2x + 3y, 3x + 2y]

At (1, 2):  ∇f = [8, 7]

    The gradient [8, 7] points "uphill" — toward increasing f.
    To DECREASE f (minimize loss), go the OPPOSITE direction: [-8, -7].

    y
    │        ∇f = [8, 7]
    │       ↗  (uphill)
    │      •(1,2)
    │       ↙
    │      -∇f = [-8, -7]
    │      (downhill — this is where gradient descent goes)
    └──────────── x
```

```python
import numpy as np

def gradient(x, y):
    """Gradient of f(x,y) = x² + 3xy + y²"""
    df_dx = 2*x + 3*y
    df_dy = 3*x + 2*y
    return np.array([df_dx, df_dy])

# At point (1, 2)
grad = gradient(1.0, 2.0)
print(f"Gradient at (1,2): {grad}")  # [8, 7]
print(f"Direction of steepest increase: {grad}")
print(f"Direction of steepest decrease: {-grad}")  # [-8, -7]
```

---

## Gradient Descent: Using Gradients to Minimize

This is the connection to ML. Training a neural network means
minimizing a loss function. The gradient tells you which direction
to adjust the parameters.

See [Track 7, Lesson 03: Gradient Descent](../ml-fundamentals/03-gradient-descent.md)
for the full treatment.

```
Gradient descent algorithm:

    1. Start at a random point
    2. Compute the gradient (which way is uphill?)
    3. Take a step in the opposite direction (go downhill)
    4. Repeat until you reach the bottom

    parameters = parameters - learning_rate × gradient

    ┌──────────────────────────────────┐
    │  Compute gradient ∇L             │
    │         │                        │
    │         ▼                        │
    │  Update: θ = θ - α × ∇L         │
    │         │                        │
    │         ▼                        │
    │  Loss decreased? ──── No ──→ Adjust α │
    │         │ Yes                    │
    │         ▼                        │
    │  Converged? ──── No ──→ Loop    │
    │         │ Yes                    │
    │         ▼                        │
    │  Done!                           │
    └──────────────────────────────────┘
```

```python
import numpy as np

def loss(x, y):
    """A simple loss function with minimum at (0, 0)."""
    return x**2 + y**2

def loss_gradient(x, y):
    """Gradient of the loss function."""
    return np.array([2*x, 2*y])

# Gradient descent
point = np.array([5.0, 3.0])  # start here
learning_rate = 0.1

print(f"Start: ({point[0]:.4f}, {point[1]:.4f}), loss = {loss(*point):.4f}")

for step in range(20):
    grad = loss_gradient(*point)
    point = point - learning_rate * grad

    if step % 5 == 0 or step == 19:
        print(f"Step {step:2d}: ({point[0]:.4f}, {point[1]:.4f}), "
              f"loss = {loss(*point):.4f}")

print(f"\nFinal point is near (0, 0) — the minimum!")
```

---

## Numerical Differentiation in Practice

When you do not have an analytical derivative, you can always
approximate it numerically:

```python
import numpy as np

def numerical_gradient(func, params, h=1e-5):
    """Compute gradient numerically for any function."""
    grad = np.zeros_like(params)
    for i in range(len(params)):
        params_plus = params.copy()
        params_minus = params.copy()
        params_plus[i] += h
        params_minus[i] -= h
        grad[i] = (func(params_plus) - func(params_minus)) / (2 * h)
    return grad

# Test with a known function
def my_loss(params):
    x, y, z = params
    return x**2 + 2*y**2 + 3*z**2

params = np.array([1.0, 2.0, 3.0])
grad = numerical_gradient(my_loss, params)
print(f"Numerical gradient: {grad}")
# Expected: [2*1, 4*2, 6*3] = [2, 8, 18]
```

---

## Exercises

### Exercise 1: Derivative Practice

```python
import numpy as np

# TODO: implement these functions and their derivatives
# f(x) = 3x² + 2x - 5
# g(x) = sin(x)  (use np.sin, derivative is np.cos)
# h(x) = e^x     (use np.exp, derivative is np.exp)

# TODO: for each function, compute the derivative at x = 0, 1, 2
#        both analytically and numerically
# TODO: verify they match (within floating point tolerance)
```

### Exercise 2: Gradient Descent on a Simple Function

```python
import numpy as np

def rosenbrock(x, y):
    """The Rosenbrock function — a classic optimization test.
    Minimum is at (1, 1) where f = 0."""
    return (1 - x)**2 + 100 * (y - x**2)**2

# TODO: compute the gradient of the Rosenbrock function
#        ∂f/∂x = -2(1-x) - 400x(y - x²)
#        ∂f/∂y = 200(y - x²)
# TODO: implement gradient descent starting from (-1, -1)
# TODO: use learning_rate = 0.001 and run for 10000 steps
# TODO: does it converge to (1, 1)?
# TODO: plot the loss over time
```

### Exercise 3: Gradient of a Neural Network Loss

```python
import numpy as np
np.random.seed(42)

# Single neuron: y_pred = sigmoid(w * x + b)
# Loss = (y_true - y_pred)²

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

x = 2.0       # input
y_true = 1.0  # target
w = 0.5       # weight
b = -0.1      # bias

# TODO: compute y_pred = sigmoid(w * x + b)
# TODO: compute loss = (y_true - y_pred)²
# TODO: compute ∂loss/∂w numerically (nudge w by h=1e-7)
# TODO: compute ∂loss/∂b numerically (nudge b by h=1e-7)
# TODO: use gradient descent to update w and b for 100 steps
# TODO: does the loss decrease? Does y_pred approach y_true?
```

---

Next: [Lesson 06: The Chain Rule and Backpropagation](./06-chain-rule-backprop.md)
