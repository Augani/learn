# Lesson 09: Partial Derivatives

> **Analogy:** Hiking on a mountain — at every point you can go
> north/south or east/west. The partial derivatives tell you
> how steep each direction is separately.

---

## From 1D to Multiple Dimensions

In Lesson 08, we had one knob to turn (x).
Neural networks have MILLIONS of knobs (weights).

```
  1D:  f(x) = x^2
       One slope, one direction.

  2D:  f(x, y) = x^2 + y^2
       A bowl! Slopes in two directions.

       "Mountain" view:        "Top-down" view:

           /\                   . . . . .
          /  \                  .       .
         / __ \                 .   *   .  <-- minimum
        / /  \ \                .       .
       /_/    \_\               . . . . .
```

A partial derivative = the slope in ONE direction while
holding everything else constant.

---

## Definition

```
  f(x, y) = x^2 + 3xy + y^2

  Partial derivative with respect to x (treat y as constant):
  df/dx = 2x + 3y

  Partial derivative with respect to y (treat x as constant):
  df/dy = 3x + 2y

  It's just a regular derivative — but you pretend
  the other variables are fixed numbers.
```

Like hiking: "How steep is the north-south direction?"
means you only move north-south, holding east-west fixed.

---

## The Gradient: All Partial Derivatives Together

```
  The gradient is a VECTOR of all partial derivatives:

  f(x, y) = x^2 + y^2

  gradient = [ df/dx ]  =  [ 2x ]
             [ df/dy ]     [ 2y ]

  At point (3, 4):

  gradient = [6, 8]

  This vector points in the direction of STEEPEST ASCENT.
  Negate it for steepest DESCENT.

  Mountain top-down view:

          N
          ^
          |  gradient
    W <---+---> E
          |
          v
          S

  gradient = [6, 8] points toward the peak
  -gradient = [-6, -8] points downhill (where we want to go!)
```

---

## The Gradient Points Uphill

```
  f(x, y) = x^2 + y^2   (a bowl)

  Gradient at various points:

     y
     ^
     |  <--  <--  |  -->  -->
     |  <--  <--  |  -->  -->
     |  <--  <--  *  -->  -->   <-- arrows show gradient
     |  <--  <--  |  -->  -->       direction at each point
     |  <--  <--  |  -->  -->
     +-----------------------------> x

  Every gradient arrow points AWAY from the center (minimum).
  To minimize: go OPPOSITE the gradient.
```

---

## Python: Computing Gradients

```python
import numpy as np

def f(x, y):
    return x**2 + 3*x*y + y**2

def gradient_analytical(x, y):
    df_dx = 2*x + 3*y
    df_dy = 3*x + 2*y
    return np.array([df_dx, df_dy])

def gradient_numerical(f, x, y, h=1e-7):
    df_dx = (f(x + h, y) - f(x - h, y)) / (2 * h)
    df_dy = (f(x, y + h) - f(x, y - h)) / (2 * h)
    return np.array([df_dx, df_dy])

point = (3.0, 4.0)
grad_a = gradient_analytical(*point)
grad_n = gradient_numerical(f, *point)

print(f"Point: {point}")
print(f"Analytical gradient: {grad_a}")
print(f"Numerical gradient:  {grad_n}")
print(f"Difference: {np.linalg.norm(grad_a - grad_n):.2e}")
```

---

## Gradient Descent in 2D

```
  Start somewhere random on the mountain.
  Repeat:
    1. Compute gradient (which way is UP?)
    2. Step in the OPPOSITE direction (go downhill)
    3. Stop when gradient is near zero (flat = minimum)

  Path down the mountain:

     *  Start here
      \
       \
        \
         *  Step 1
          \
           \
            * Step 2
             \
              *  Almost there
               .
                * Minimum!
```

---

## Python: Gradient Descent in 2D

```python
import numpy as np

def f(params):
    x, y = params
    return (x - 2)**2 + (y + 1)**2 + 0.5*x*y

def gradient(params, h=1e-7):
    grad = np.zeros_like(params)
    for i in range(len(params)):
        params_plus = params.copy()
        params_minus = params.copy()
        params_plus[i] += h
        params_minus[i] -= h
        grad[i] = (f(params_plus) - f(params_minus)) / (2 * h)
    return grad

params = np.array([10.0, -10.0])
lr = 0.1

print(f"Step  0: x={params[0]:+.4f} y={params[1]:+.4f} "
      f"loss={f(params):.4f}")

for step in range(1, 21):
    grad = gradient(params)
    params = params - lr * grad
    if step % 5 == 0 or step == 1:
        print(f"Step {step:2d}: x={params[0]:+.4f} y={params[1]:+.4f} "
              f"loss={f(params):.4f} |grad|={np.linalg.norm(grad):.4f}")

print(f"\nFinal position: ({params[0]:.4f}, {params[1]:.4f})")
print(f"Final loss: {f(params):.6f}")
```

---

## Neural Network Gradients

A neural network with 2 weights:

```
  input: x
  weights: w1, w2
  prediction: y_hat = w2 * relu(w1 * x)
  loss: L = (y_hat - y_true)^2

  Gradient:
  [ dL/dw1 ]   "How does loss change if I tweak w1?"
  [ dL/dw2 ]   "How does loss change if I tweak w2?"

  GPT-3 has 175 BILLION weights.
  That's a gradient vector with 175 billion entries.
  Every training step computes ALL of them.
```

---

## The Jacobian Matrix

When your function has multiple OUTPUTS too:

```
  f: R^n -> R^m  (n inputs, m outputs)

  Jacobian = matrix of all partial derivatives

  f(x, y) = [ x^2 + y  ]    (2 inputs, 2 outputs)
             [ x + y^2  ]

  Jacobian = [ df1/dx  df1/dy ]  =  [ 2x  1  ]
             [ df2/dx  df2/dy ]     [ 1   2y ]

  Each row = gradient of one output
  Each col = how one input affects all outputs
```

---

## Python: Jacobian

```python
import numpy as np

def f(params):
    x, y = params
    return np.array([x**2 + y, x + y**2])

def jacobian_numerical(f, params, h=1e-7):
    n = len(params)
    f0 = f(params)
    m = len(f0)
    J = np.zeros((m, n))
    for i in range(n):
        params_plus = params.copy()
        params_minus = params.copy()
        params_plus[i] += h
        params_minus[i] -= h
        J[:, i] = (f(params_plus) - f(params_minus)) / (2 * h)
    return J

params = np.array([3.0, 4.0])
J = jacobian_numerical(f, params)
print(f"Jacobian at (3, 4):\n{J}")
print(f"\nExpected:\n[[6, 1],\n [1, 8]]")
```

---

## Gradient Properties

```
  +--------------------------------------------------+
  |  The gradient:                                     |
  |  - Points in the direction of steepest INCREASE    |
  |  - Its magnitude = how steep                       |
  |  - Perpendicular to level curves (contour lines)   |
  +--------------------------------------------------+

  Contour plot (like a topographic map):

      y
      ^     .  .
      |   .      .
      |  .  ----  .
      | .  | min|  .     <-- contour lines
      |  .  ----  .          (constant height)
      |   .      .
      |     .  .
      +------------------> x

  Gradient arrows are PERPENDICULAR to these circles.
  They point straight up the hill.
```

---

## The Hessian: Second Derivatives

```
  The Hessian matrix = second partial derivatives

  H = [ d2f/dx2    d2f/dxdy ]
      [ d2f/dydx   d2f/dy2  ]

  What it tells you:
  - Curvature of the loss landscape
  - Is this a minimum, maximum, or saddle point?
  - How to pick a better learning rate

  All eigenvalues of H > 0 --> minimum
  All eigenvalues of H < 0 --> maximum
  Mixed signs --> saddle point
```

---

## Python: Hessian

```python
import numpy as np

def f(x, y):
    return x**4 + y**4 - 2*x**2 - 2*y**2

def hessian_numerical(f, x, y, h=1e-5):
    H = np.zeros((2, 2))
    H[0, 0] = (f(x+h, y) - 2*f(x, y) + f(x-h, y)) / h**2
    H[1, 1] = (f(x, y+h) - 2*f(x, y) + f(x, y-h)) / h**2
    H[0, 1] = (f(x+h, y+h) - f(x+h, y-h) - f(x-h, y+h) + f(x-h, y-h)) / (4*h**2)
    H[1, 0] = H[0, 1]
    return H

points = [(0.0, 0.0), (1.0, 1.0), (-1.0, -1.0)]
for x, y in points:
    H = hessian_numerical(f, x, y)
    eigenvalues = np.linalg.eigvals(H)
    print(f"Point ({x}, {y}): eigenvalues = {eigenvalues.round(2)}")
    if all(eigenvalues > 0):
        print(f"  --> MINIMUM")
    elif all(eigenvalues < 0):
        print(f"  --> MAXIMUM")
    else:
        print(f"  --> SADDLE POINT")
```

---

## Key Takeaways

```
  +------------------------------------------------------+
  |  PARTIAL DERIVATIVE = slope in one direction           |
  |  GRADIENT = vector of all partial derivatives          |
  |  Gradient points UPHILL, negate for downhill           |
  |  JACOBIAN = matrix version (multiple outputs)          |
  |  HESSIAN = second derivatives (curvature)              |
  |  Neural network training = gradient descent on millions|
  |  of parameters simultaneously                          |
  +------------------------------------------------------+
```

---

## Exercises

**Exercise 1:** Find the gradient of `f(x, y) = 3x^2 - xy + y^3`
analytically. Verify at point (1, 2) numerically.

**Exercise 2:** Implement gradient descent to minimize
`f(x, y) = (x - 3)^2 + (y + 2)^2`. Start at (10, 10).
How many steps to get within 0.01 of the minimum?

**Exercise 3:** Compute the Jacobian of:
```
f(x, y, z) = [x*y + z, x^2 + y*z, x + y + z]
```
at the point (1, 2, 3). Verify numerically.

**Exercise 4:** Find all critical points (gradient = 0) of
`f(x, y) = x^3 - 3x + y^2`. Classify each as min/max/saddle.

**Exercise 5:** Implement gradient descent for a function with 10
parameters: `f(w) = sum((w_i - i)^2)` for i = 0..9.
The minimum should be at `w = [0, 1, 2, ..., 9]`.

---

[Next: Lesson 10 - Chain Rule ->](10-chain-rule.md)
