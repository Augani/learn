# Lesson 10: The Chain Rule

> **Analogy:** A domino chain of effects — if A affects B and B
> affects C, you can figure out how A affects C by multiplying
> the individual effects.

---

## The Setup: Composed Functions

Neural networks are layers stacked on top of each other.
The output of one feeds into the next.

```
  input --> [Layer 1] --> [Layer 2] --> [Layer 3] --> output
     x         h1            h2            y

  y = f3(f2(f1(x)))

  Like dominos:
  Push x --> h1 falls --> h2 falls --> y falls

  Question: If I nudge x, how much does y change?
```

---

## The Chain Rule

```
  If y = f(g(x)), then:

  dy/dx = dy/dg * dg/dx

  "Rate of change of y with respect to x =
   rate of change of y w.r.t. g  TIMES
   rate of change of g w.r.t. x"

  The domino analogy:

  Domino A     Domino B     Domino C
  (input x)    (middle g)   (output y)

    A pushes B    B pushes C
    with force    with force
    dg/dx         dy/dg

    Total effect of A on C = dg/dx * dy/dg
```

---

## Simple Example

```
  f(x) = (3x + 2)^2

  Let g(x) = 3x + 2     (inner function)
  Let f(g) = g^2         (outer function)

  Chain rule:
  df/dx = df/dg * dg/dx
        = 2g   * 3
        = 2(3x + 2) * 3
        = 6(3x + 2)

  At x = 1:
  df/dx = 6(3*1 + 2) = 6 * 5 = 30
```

---

## Chains Can Be Longer

```
  y = f(g(h(x)))

  dy/dx = dy/dg * dg/dh * dh/dx

  Three dominos: multiply ALL the effects.

  Neural network with 3 layers:

  x --[W1]--> h1 --[W2]--> h2 --[W3]--> y

  dy/dx = dy/dh2 * dh2/dh1 * dh1/dx
        = W3     * W2       * W1

  That's just matrix multiplication!
```

---

## Why Backpropagation Works

Backprop IS the chain rule applied to neural networks.

```
  Forward pass (left to right):
  x --> h1 = W1*x --> h2 = W2*h1 --> loss = L(h2, target)

  Backward pass (right to left, chain rule):

  dL/dW2 = dL/dh2 * dh2/dW2     (how loss changes with W2)
  dL/dW1 = dL/dh2 * dh2/dh1 * dh1/dW1  (chain through h2!)

  Step by step:

  FORWARD:   x -----> h1 -----> h2 -----> Loss
                W1        W2         L

  BACKWARD:  dL/dx <-- dL/dh1 <-- dL/dh2 <-- dL/dL = 1
              *W1^T     *W2^T
```

Start from the loss (= 1), multiply backwards through each layer.

---

## Python: Chain Rule by Hand

```python
import numpy as np

def forward(x, w1, w2):
    h = w1 * x
    y = w2 * h
    return h, y

def backward(x, w1, w2, h, y, target):
    dL_dy = 2 * (y - target)
    dy_dw2 = h
    dy_dh = w2
    dh_dw1 = x

    dL_dw2 = dL_dy * dy_dw2
    dL_dh = dL_dy * dy_dh
    dL_dw1 = dL_dh * dh_dw1

    return dL_dw1, dL_dw2

x = 2.0
target = 10.0
w1 = 0.5
w2 = 0.3

h, y = forward(x, w1, w2)
print(f"Forward: x={x} -> h={h} -> y={y} (target={target})")
print(f"Loss: {(y - target)**2}")

dL_dw1, dL_dw2 = backward(x, w1, w2, h, y, target)
print(f"\nGradients:")
print(f"  dL/dw1 = {dL_dw1}")
print(f"  dL/dw2 = {dL_dw2}")
```

---

## Computation Graph

Every neural network forward pass builds a graph:

```
  x ----+
        |
        v
  w1 --[*]--> h --+
                   |
                   v
  w2 ----------[*]--> y --+
                           |
                           v
  target --------[ L = (y-t)^2 ]--> loss

  Forward: follow arrows left to right
  Backward: follow arrows right to left, multiplying derivatives
```

---

## Python: Computation Graph Simulation

```python
import numpy as np

class Value:
    def __init__(self, data, label=""):
        self.data = data
        self.grad = 0.0
        self.label = label
        self._backward = lambda: None
        self._children = []

    def __mul__(self, other):
        out = Value(self.data * other.data, f"({self.label}*{other.label})")
        out._children = [self, other]
        def _backward():
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad
        out._backward = _backward
        return out

    def __sub__(self, other):
        out = Value(self.data - other.data, f"({self.label}-{other.label})")
        out._children = [self, other]
        def _backward():
            self.grad += 1.0 * out.grad
            other.grad += -1.0 * out.grad
        out._backward = _backward
        return out

    def square(self):
        out = Value(self.data ** 2, f"{self.label}^2")
        out._children = [self]
        def _backward():
            self.grad += 2 * self.data * out.grad
        out._backward = _backward
        return out

x = Value(2.0, "x")
w1 = Value(0.5, "w1")
w2 = Value(0.3, "w2")
target = Value(10.0, "t")

h = x * w1
y = h * w2
diff = y - target
loss = diff.square()

loss.grad = 1.0
loss._backward()
diff._backward()
y._backward()
h._backward()

print(f"Loss: {loss.data}")
print(f"Gradients:")
print(f"  dL/dw1 = {w1.grad}")
print(f"  dL/dw2 = {w2.grad}")
print(f"  dL/dx  = {x.grad}")
```

---

## The Vanishing Gradient Problem

```
  Chain rule = multiply derivatives together.

  If each derivative is small (< 1), multiplying many of them:

  0.5 * 0.5 * 0.5 * 0.5 * 0.5 = 0.03125

  10 layers deep with sigmoid:
  0.25^10 = 0.000001

  Gradients become TINY --> weights barely update
  --> early layers stop learning!

  This is why:
  - ReLU replaced sigmoid (gradient = 0 or 1, not 0.25)
  - Skip connections exist (add shortcuts past layers)
  - Batch normalization helps (keeps values in good range)

  SIGMOID                    RELU
  gradient <= 0.25           gradient = 0 or 1
  10 layers: 0.25^10         10 layers: 1^10 = 1
           = 0.000001        No vanishing!
```

---

## Multivariate Chain Rule

With vectors and matrices, the chain rule uses Jacobians:

```
  f: R^n -> R^m
  g: R^m -> R^k

  d(g(f(x)))/dx = J_g @ J_f

  Where J_g and J_f are Jacobian matrices.

  Neural network version:
  dL/dW1 = dL/dy @ dy/dh2 @ dh2/dh1 @ dh1/dW1

  It's just a chain of matrix multiplications!
```

---

## Python: Verify Chain Rule Numerically

```python
import numpy as np

def layer1(x, W1):
    return np.maximum(0, x @ W1)

def layer2(h, W2):
    return h @ W2

def loss_fn(y, target):
    return np.sum((y - target) ** 2)

np.random.seed(42)
x = np.array([[1.0, 2.0, 3.0]])
W1 = np.random.randn(3, 4) * 0.5
W2 = np.random.randn(4, 2) * 0.5
target = np.array([[1.0, 0.0]])

h = layer1(x, W1)
y = layer2(h, W2)
loss = loss_fn(y, target)
print(f"Loss: {loss:.4f}")

grad_W2 = np.zeros_like(W2)
eps = 1e-5
for i in range(W2.shape[0]):
    for j in range(W2.shape[1]):
        W2_plus = W2.copy()
        W2_plus[i, j] += eps
        loss_plus = loss_fn(layer2(h, W2_plus), target)
        W2_minus = W2.copy()
        W2_minus[i, j] -= eps
        loss_minus = loss_fn(layer2(h, W2_minus), target)
        grad_W2[i, j] = (loss_plus - loss_minus) / (2 * eps)

print(f"\nNumerical gradient dL/dW2:\n{grad_W2.round(4)}")
```

---

## Key Takeaways

```
  +------------------------------------------------------+
  |  CHAIN RULE: dy/dx = dy/dg * dg/dx                    |
  |  BACKPROP = chain rule applied layer by layer          |
  |  Forward pass: compute outputs left to right           |
  |  Backward pass: compute gradients right to left        |
  |  Vanishing gradients: small derivatives multiply       |
  |  ReLU + skip connections fix vanishing gradients       |
  +------------------------------------------------------+
```

---

## Exercises

**Exercise 1:** Apply the chain rule to find dy/dx for:
`y = sin(x^2 + 1)`. Verify numerically at x = 2.

**Exercise 2:** For a 3-layer network `y = W3 @ relu(W2 @ relu(W1 @ x))`,
write out the chain rule expression for dL/dW1.

**Exercise 3:** Demonstrate vanishing gradients: multiply 0.25
by itself for layers 1 through 20. At what depth does the
gradient become less than 1e-6?

**Exercise 4:** Extend the `Value` class to support addition.
Build a computation graph for `loss = (w1*x + w2*x^2 - target)^2`
and backpropagate.

**Exercise 5:** Numerically compute dL/dW1 for a 2-layer network:
```python
import numpy as np
np.random.seed(42)
x = np.random.randn(1, 5)
W1 = np.random.randn(5, 3)
W2 = np.random.randn(3, 1)
target = np.array([[1.0]])

pass
```

---

[Next: Lesson 11 - Gradient Descent Revisited ->](11-gradient-descent-revisited.md)
