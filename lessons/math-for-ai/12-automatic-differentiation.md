# Lesson 12: Automatic Differentiation

> **Analogy:** A receipt tape that tracks every operation — when
> you need the derivative, just read the tape backwards.

---

## The Problem

```
  Computing gradients by hand: error-prone, tedious
  Numerical gradients: slow (2 function calls per parameter!)
  Symbolic diff (like Wolfram): expressions explode in size

  175 billion parameters in GPT-3.
  Computing numerical gradients = 350 billion function calls PER STEP.
  That's not happening.

  We need: exact derivatives, computed automatically, FAST.
  Solution: AUTOMATIC DIFFERENTIATION (autodiff)
```

---

## How It Works: The Tape

Every operation gets recorded on a "tape":

```
  Forward pass: compute and RECORD each operation

  a = 3         tape: [a = 3]
  b = 2         tape: [a = 3, b = 2]
  c = a * b     tape: [..., c = a*b, dc/da = b, dc/db = a]
  d = c + 5     tape: [..., d = c+5, dd/dc = 1]
  e = d ** 2    tape: [..., e = d^2, de/dd = 2*d]

  Backward pass: read tape in REVERSE

  de/dd = 2*d = 2*11 = 22
  de/dc = de/dd * dd/dc = 22 * 1 = 22
  de/da = de/dc * dc/da = 22 * b = 22 * 2 = 44
  de/db = de/dc * dc/db = 22 * a = 22 * 3 = 66
```

Like a receipt that tracks everything you bought,
so you can retrace your spending.

---

## Forward Mode vs Reverse Mode

```
  FORWARD MODE:
  - Compute derivatives alongside values (left to right)
  - Efficient when: few inputs, many outputs
  - Cost: one pass per INPUT variable

  REVERSE MODE:
  - Compute values forward, derivatives backward
  - Efficient when: many inputs, few outputs (like loss!)
  - Cost: one forward + one backward pass total!

  Neural networks: millions of inputs (weights), ONE output (loss)
  --> REVERSE MODE wins by a landslide

  This is why PyTorch/TensorFlow use reverse mode autodiff.
```

---

## Building a Mini Autodiff Engine

```python
import numpy as np

class Tensor:
    def __init__(self, data, requires_grad=False):
        self.data = np.array(data, dtype=float)
        self.grad = np.zeros_like(self.data)
        self.requires_grad = requires_grad
        self._backward = lambda: None
        self._prev = set()

    def __repr__(self):
        return f"Tensor({self.data}, grad={self.grad})"

    def __add__(self, other):
        other = other if isinstance(other, Tensor) else Tensor(other)
        out = Tensor(self.data + other.data, requires_grad=True)
        out._prev = {self, other}
        def _backward():
            if self.requires_grad:
                self.grad += out.grad
            if other.requires_grad:
                other.grad += out.grad
        out._backward = _backward
        return out

    def __mul__(self, other):
        other = other if isinstance(other, Tensor) else Tensor(other)
        out = Tensor(self.data * other.data, requires_grad=True)
        out._prev = {self, other}
        def _backward():
            if self.requires_grad:
                self.grad += other.data * out.grad
            if other.requires_grad:
                other.grad += self.data * out.grad
        out._backward = _backward
        return out

    def sum(self):
        out = Tensor(self.data.sum(), requires_grad=True)
        out._prev = {self}
        def _backward():
            if self.requires_grad:
                self.grad += np.ones_like(self.data) * out.grad
        out._backward = _backward
        return out

    def backward(self):
        topo = []
        visited = set()
        def build(node):
            if node not in visited:
                visited.add(node)
                for child in node._prev:
                    build(child)
                topo.append(node)
        build(self)
        self.grad = np.ones_like(self.data)
        for node in reversed(topo):
            node._backward()
```

---

## Using Our Mini Engine

```python
x = Tensor([2.0, 3.0], requires_grad=True)
w = Tensor([0.5, -0.5], requires_grad=True)
b = Tensor([0.1], requires_grad=True)

y = x * w
z = y + b
loss = z.sum()

loss.backward()

print(f"x = {x.data}")
print(f"w = {w.data}")
print(f"loss = {loss.data}")
print(f"dL/dx = {x.grad}")
print(f"dL/dw = {w.grad}")
print(f"dL/db = {b.grad}")
```

---

## How PyTorch Does It

```
  PyTorch wraps tensors with gradient tracking:

  1. Create tensors with requires_grad=True
  2. Do math normally (PyTorch records the graph)
  3. Call .backward() on the loss
  4. Read .grad on each parameter

  That's it. The framework does ALL the calculus.

  +----------------------------------------------------+
  |  You NEVER need to derive gradients by hand.        |
  |  PyTorch's autograd does it automatically.          |
  |  Understanding HOW it works makes you a better      |
  |  debugger when things go wrong.                     |
  +----------------------------------------------------+
```

---

## The Computation Graph in Detail

```
  Forward pass builds the graph:

      w ----+
            |
            v
      x -->[mul]---> h --+
                          |
                          v
      b ----------->[add]---> y -->[loss_fn]---> L
                                       ^
      target -------------------------+

  Backward pass traverses it in reverse:

      dL/dw <--+
               |
               v
      dL/dx <-[mul]<--- dL/dh <--+
                                   |
                                   v
      dL/db <----------[add]<--- dL/dy <--[loss_fn]<--- dL/dL = 1
```

Each node remembers what it needs for the backward pass.

---

## Gradient Checking: Trust but Verify

Always verify autodiff with numerical gradients:

```python
import numpy as np

def gradient_check(f, params, eps=1e-5):
    analytical = params.grad.copy()
    numerical = np.zeros_like(params.data)

    for i in range(len(params.data)):
        old = params.data[i]

        params.data[i] = old + eps
        loss_plus = f().data

        params.data[i] = old - eps
        loss_minus = f().data

        numerical[i] = (loss_plus - loss_minus) / (2 * eps)
        params.data[i] = old

    diff = np.abs(analytical - numerical)
    print(f"Max difference: {diff.max():.2e}")
    return diff.max() < 1e-5

w = Tensor([1.0, 2.0, 3.0], requires_grad=True)
target = Tensor([2.0, 3.0, 4.0])

def compute_loss():
    diff = w + Tensor(-1.0) * target
    return (diff * diff).sum()

loss = compute_loss()
loss.backward()

passed = gradient_check(compute_loss, w)
print(f"Gradient check: {'PASSED' if passed else 'FAILED'}")
```

---

## Common Pitfalls

```
  1. FORGETTING to zero gradients:
     Gradients ACCUMULATE by default!
     Always zero them before each backward pass.

  2. IN-PLACE operations:
     x += 1    BAD (breaks the graph)
     x = x + 1 OK  (creates new node)

  3. DETACHING from graph:
     Sometimes you WANT to stop gradient flow.
     Use .detach() to cut the tape.

  4. MEMORY:
     The graph stores all intermediate values.
     Use torch.no_grad() during inference to save memory.
```

---

## Forward Mode: A Brief Look

```
  Forward mode: compute df/dx alongside f(x)

  x = 3,       dx = 1   (seed: we want df/dx)
  a = x * x,   da = x*dx + dx*x = 2*x*1 = 6
  b = a + x,   db = da + dx = 6 + 1 = 7
  c = b * 2,   dc = db * 2 = 14

  Each operation carries its derivative forward.

  Pro: Simple, good for few inputs
  Con: Need one pass PER input variable
       (terrible for neural networks with millions of weights)
```

---

## Why Reverse Mode Wins for Deep Learning

```
  Network: 1 million weights --> 1 loss value

  Forward mode: 1,000,000 passes (one per weight)
  Reverse mode: 1 forward + 1 backward = 2 passes

  Speedup: 500,000x

  This is the fundamental reason deep learning is possible.
  Without reverse mode autodiff, we couldn't train large models.
```

---

## Key Takeaways

```
  +------------------------------------------------------+
  |  AUTODIFF = exact derivatives, computed automatically  |
  |  Forward pass records operations on a "tape"           |
  |  Backward pass reads tape in reverse (chain rule)      |
  |  REVERSE MODE = 1 forward + 1 backward for ALL grads  |
  |  PyTorch/JAX/TensorFlow all use reverse mode autodiff  |
  |  Always gradient-check your custom operations          |
  |  Zero gradients between steps!                         |
  +------------------------------------------------------+
```

---

## Exercises

**Exercise 1:** Add a `__pow__` method to the Tensor class for
exponentiation. Test it: `x = Tensor(3.0); y = x ** 2` should
give gradient 6.0.

**Exercise 2:** Add a `relu` method to Tensor. The backward pass
should pass gradients through where data > 0 and block where <= 0.

**Exercise 3:** Build a 2-layer neural network using the Tensor
class. Forward pass: `y = relu(x * W1) * W2`. Compute loss and
backpropagate.

**Exercise 4:** Implement gradient checking for a more complex
function: `f(w) = sum(relu(w * x))` where x is fixed data.

**Exercise 5:** Compare the number of operations needed for forward
mode vs reverse mode autodiff for a function with 100 inputs and
1 output. Write code that counts the operations for each approach.

---

[Next: Lesson 13 - Probability Basics ->](13-probability-basics.md)
