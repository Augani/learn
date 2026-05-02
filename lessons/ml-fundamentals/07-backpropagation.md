# Lesson 07: Backpropagation — How Networks Actually Learn

In Lesson 06, you built a neural network with layers. You saw that it
makes predictions (forward pass) and somehow "learns." But HOW does it
figure out which weights to change, and by how much?

That's backpropagation — the algorithm that makes deep learning possible.

---

## The Blame Assignment Problem

Your neural network made a prediction and it was wrong. The error was 0.8.

The network has hundreds of weights across multiple layers. Which weights
caused the error? How much should each one change?

**Analogy — the assembly line:**

A car rolls off the assembly line with a crooked door. The factory has
50 stations. Which station messed up?

You start at the end (where the defect is visible) and trace backward:
- Final station: door installation — was the door installed wrong?
- Previous station: door alignment — was the frame aligned wrong?
- Earlier station: welding — was the frame welded at a bad angle?
- Even earlier: metal cutting — was the metal cut to wrong dimensions?

You trace the defect backward, assigning blame to each station based on
how much it contributed to the problem. That's backpropagation.

```
FORWARD PASS (building the car):

  Input → [Station 1] → [Station 2] → [Station 3] → Output
  Raw       Cut metal     Weld frame    Install       Finished
  metal                                 door          car

BACKWARD PASS (tracing the defect):

  Input ← [Station 1] ← [Station 2] ← [Station 3] ← Error
          "You cut       "You welded    "You installed  "The door
           2mm too        at wrong       it 3 degrees    is
           wide"          angle"         off"            crooked"
```

---

## The Chain Rule — The Math Behind Blame

Don't panic. The chain rule is simpler than it sounds.

**The idea:** If A affects B, and B affects C, then A affects C
*through* B. The total effect is the product of the individual effects.

**Everyday example:**

You drink coffee → your heart rate increases → you feel jittery.

- Coffee doubles your heart rate effect (2x)
- Heart rate triples your jitter level (3x)
- So coffee increases your jitter by 2 * 3 = 6x

That's the chain rule. Multiply the effects along the chain.

```
                    effect of           effect of           total effect of
                    coffee on    ×      heart rate on   =   coffee on
                    heart rate          jitteriness         jitteriness

                       2x        ×          3x          =       6x
```

**In a neural network:**

```
                    effect of           effect of           total effect of
                    weight on    ×      neuron output  =    weight on
                    neuron output       on loss             loss

                    ∂neuron/∂weight  ×  ∂loss/∂neuron  =   ∂loss/∂weight
```

The ∂ symbol means "partial derivative" — just a fancy way of saying
"how much does this change when that changes." Think of it as a
sensitivity measurement.

---

## Forward Pass: Computing the Output

Let's trace through a tiny network to make this concrete.

```
Network: 1 input, 1 hidden neuron, 1 output

    x ──[w1]──→ (h) ──[w2]──→ (o) ──→ prediction
    input       hidden         output

Forward pass equations:
    h = ReLU(w1 * x + b1)
    o = w2 * h + b2         (output, no activation for regression)
    loss = (o - target)^2   (mean squared error)
```

**With actual numbers:**

```
x = 2.0   (input)
w1 = 0.5, b1 = 0.1   (hidden layer parameters)
w2 = 0.8, b2 = 0.2   (output layer parameters)
target = 1.5          (what we want the output to be)

Step 1: Hidden layer
    z1 = w1 * x + b1 = 0.5 * 2.0 + 0.1 = 1.1
    h = ReLU(1.1) = 1.1   (positive, so passes through)

Step 2: Output layer
    o = w2 * h + b2 = 0.8 * 1.1 + 0.2 = 1.08

Step 3: Loss
    loss = (1.08 - 1.5)^2 = (-0.42)^2 = 0.1764
```

The model predicted 1.08, but the target was 1.5. Loss = 0.1764.
Now we need to figure out how to adjust w1, w2, b1, b2 to reduce
this loss.

---

## Backward Pass: Assigning Blame

We work backward from the loss, computing how much each parameter
contributed to the error.

```
GRADIENT FLOW (backward):

    loss = 0.1764
      │
      │  ∂loss/∂o = 2 * (o - target) = 2 * (-0.42) = -0.84
      ▼
    output (o = 1.08)
      │
      ├── ∂loss/∂w2 = ∂loss/∂o * ∂o/∂w2 = -0.84 * h = -0.84 * 1.1 = -0.924
      ├── ∂loss/∂b2 = ∂loss/∂o * ∂o/∂b2 = -0.84 * 1 = -0.84
      │
      │  ∂loss/∂h = ∂loss/∂o * ∂o/∂h = -0.84 * w2 = -0.84 * 0.8 = -0.672
      ▼
    hidden (h = 1.1)
      │
      ├── ∂loss/∂w1 = ∂loss/∂h * ∂h/∂w1 = -0.672 * x = -0.672 * 2.0 = -1.344
      └── ∂loss/∂b1 = ∂loss/∂h * ∂h/∂b1 = -0.672 * 1 = -0.672
```

**Reading the gradients:**

| Parameter | Gradient | Meaning |
|-----------|----------|---------|
| w2 | -0.924 | Increasing w2 decreases the loss. Push w2 up. |
| b2 | -0.84 | Increasing b2 decreases the loss. Push b2 up. |
| w1 | -1.344 | Increasing w1 decreases the loss. Push w1 up. |
| b1 | -0.672 | Increasing b1 decreases the loss. Push b1 up. |

All gradients are negative, so the loss decreases when we increase
these parameters. That makes sense — our prediction (1.08) was too
low (target is 1.5), so all weights need to increase.

---

## The Update Step

With a learning rate of 0.01:

```
new_w2 = w2 - lr * gradient = 0.8 - 0.01 * (-0.924) = 0.8 + 0.00924 = 0.80924
new_b2 = b2 - lr * gradient = 0.2 - 0.01 * (-0.84)  = 0.2 + 0.0084  = 0.2084
new_w1 = w1 - lr * gradient = 0.5 - 0.01 * (-1.344) = 0.5 + 0.01344 = 0.51344
new_b1 = b1 - lr * gradient = 0.1 - 0.01 * (-0.672) = 0.1 + 0.00672 = 0.10672
```

Let's verify — forward pass with new parameters:

```
h = ReLU(0.51344 * 2.0 + 0.10672) = ReLU(1.1336) = 1.1336
o = 0.80924 * 1.1336 + 0.2084 = 1.1259
loss = (1.1259 - 1.5)^2 = 0.1400
```

Loss went from 0.1764 to 0.1400. The model improved. Repeat this
thousands of times and the loss approaches zero.

---

## The Full Picture

```
┌─────────────────────────────────────────────────────────┐
│                   TRAINING LOOP                          │
│                                                          │
│   1. FORWARD PASS                                        │
│      Input ──→ Layer 1 ──→ Layer 2 ──→ ... ──→ Output    │
│                                                          │
│   2. COMPUTE LOSS                                        │
│      loss = how_wrong(prediction, target)                │
│                                                          │
│   3. BACKWARD PASS                                       │
│      Loss ──→ Layer N gradients ──→ ... ──→ Layer 1      │
│      (chain rule computes gradient for every parameter)  │
│                                                          │
│   4. UPDATE PARAMETERS                                   │
│      new_param = old_param - learning_rate * gradient     │
│                                                          │
│   5. REPEAT from step 1                                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**TypeScript analogy for the whole flow:**

```typescript
// Pseudocode — the training loop is like a retry loop
while (loss > acceptable) {
    const prediction = model.forward(input);    // step 1
    const loss = computeLoss(prediction, label); // step 2
    const gradients = model.backward(loss);      // step 3
    model.updateParams(gradients, learningRate); // step 4
}
```

---

## Vanishing Gradients — When Blame Gets Diluted

Remember the chain rule: multiply effects along the chain.

With many layers, you're multiplying many small numbers together:

```
gradient at layer 1 = effect₁ × effect₂ × effect₃ × ... × effectₙ

If each effect is 0.2:
  10 layers: 0.2^10 = 0.0000001024
  20 layers: 0.2^20 ≈ 0.0000000000001
```

The gradient at early layers becomes essentially zero. Those layers
stop learning. This is the **vanishing gradient problem**.

**Analogy:** A game of telephone with 20 people. By the time the
message reaches the first person in line (working backward), it's
been diluted to nothing. Early layers get no useful signal.

**Why it happens:** Sigmoid and tanh activations squash outputs
to small ranges. Their derivatives are always < 1. Multiply many
numbers < 1 together and you get basically zero.

**Solutions:**

| Solution | How It Helps |
|----------|-------------|
| ReLU activation | Derivative is 1 for positive inputs (no squashing) |
| Residual connections (skip connections) | Gradient can flow directly through shortcuts |
| Batch normalization | Keeps values in a reasonable range |
| LSTM gates (for sequences) | Selective memory prevents gradient decay |
| Careful initialization | Start weights at values that preserve gradient magnitude |

---

## Exploding Gradients — When Blame Gets Amplified

The opposite problem. If effects are > 1, multiplying them makes
gradients enormous:

```
If each effect is 3.0:
  10 layers: 3^10 = 59,049
  20 layers: 3^20 = 3,486,784,401
```

Weights jump wildly. The model can't converge.

**Analogy:** Feedback from a microphone pointed at its own speaker.
The sound gets amplified each loop until it's a deafening screech.

**Solutions:**

| Solution | How It Helps |
|----------|-------------|
| Gradient clipping | Cap the gradient magnitude at a max value |
| Weight initialization | Start weights at values that keep gradients stable |
| Batch normalization | Normalizes layer outputs to prevent runaway values |

---

## Implementing Backprop from Scratch

Let's implement a complete 2-layer network with backpropagation:

```python
import numpy as np

np.random.seed(42)

X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
y = np.array([[0], [1], [1], [0]])  # XOR problem

input_size = 2
hidden_size = 4
output_size = 1
learning_rate = 0.5

W1 = np.random.randn(input_size, hidden_size) * 0.5
b1 = np.zeros((1, hidden_size))
W2 = np.random.randn(hidden_size, output_size) * 0.5
b2 = np.zeros((1, output_size))

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

def sigmoid_derivative(a):
    return a * (1 - a)

losses = []
for epoch in range(10000):
    # === FORWARD PASS ===
    z1 = X @ W1 + b1
    a1 = sigmoid(z1)

    z2 = a1 @ W2 + b2
    a2 = sigmoid(z2)

    # === COMPUTE LOSS ===
    loss = np.mean((y - a2) ** 2)
    if epoch % 2000 == 0:
        print(f"Epoch {epoch:5d} | Loss: {loss:.6f}")
    losses.append(loss)

    # === BACKWARD PASS ===
    # Output layer gradients
    d_loss_a2 = -(y - a2)                     # ∂loss/∂a2
    d_a2_z2 = sigmoid_derivative(a2)          # ∂a2/∂z2
    delta2 = d_loss_a2 * d_a2_z2              # ∂loss/∂z2

    d_loss_W2 = a1.T @ delta2                 # ∂loss/∂W2
    d_loss_b2 = np.sum(delta2, axis=0, keepdims=True)

    # Hidden layer gradients (chain rule continues)
    d_loss_a1 = delta2 @ W2.T                 # ∂loss/∂a1
    d_a1_z1 = sigmoid_derivative(a1)          # ∂a1/∂z1
    delta1 = d_loss_a1 * d_a1_z1              # ∂loss/∂z1

    d_loss_W1 = X.T @ delta1                  # ∂loss/∂W1
    d_loss_b1 = np.sum(delta1, axis=0, keepdims=True)

    # === UPDATE PARAMETERS ===
    W2 -= learning_rate * d_loss_W2
    b2 -= learning_rate * d_loss_b2
    W1 -= learning_rate * d_loss_W1
    b1 -= learning_rate * d_loss_b1

print("\nPredictions after training:")
print(np.round(a2, 3))
print(f"Expected: {y.flatten()}")
```

Expected output:

```
Epoch     0 | Loss: 0.274191
Epoch  2000 | Loss: 0.241670
Epoch  4000 | Loss: 0.007231
Epoch  6000 | Loss: 0.002516
Epoch  8000 | Loss: 0.001455

Predictions after training:
[[0.039]
 [0.966]
 [0.966]
 [0.035]]
Expected: [0 1 1 0]
```

The XOR problem is solved. This is a result that a single perceptron
cannot achieve (Lesson 05), but a 2-layer network with backprop can.

---

## How the Gradient Flows — A Visual

```
FORWARD (left to right):
data flows through the network, producing a prediction

   x₁ ─w₁─┐         ┌──w₃──┐
            ├─→ [h₁]─┤      ├─→ [o] ──→ loss
   x₂ ─w₂─┘         └──w₄──┘

BACKWARD (right to left):
gradients flow back, telling each weight how to change

   x₁ ←∂w₁─┐         ┌─∂w₃──┐
            ├── [h₁]←─┤      ├── [o] ←── ∂loss
   x₂ ←∂w₂─┘         └─∂w₄──┘

Layer 2 gradients:  ∂loss/∂w₃, ∂loss/∂w₄
Layer 1 gradients:  ∂loss/∂w₃ × ∂w₃/∂w₁ = ∂loss/∂w₁  (CHAIN RULE)
                    ∂loss/∂w₄ × ∂w₄/∂w₂ = ∂loss/∂w₂  (CHAIN RULE)
```

Each layer's gradient depends on the gradient from the layer after it.
That's why we call it back-propagation — the error signal propagates
from the output back through each layer, one at a time.

---

## Why This Matters

Backpropagation (published 1986, popularized by Rumelhart, Hinton,
and Williams) is the algorithm that made deep learning possible.

Without backprop, you'd have to compute gradients by trial and error —
wiggle each weight slightly, see if the loss goes up or down. For a
network with 1 million parameters, that means 1 million forward passes
per update. Completely impractical.

Backprop computes ALL gradients in a single backward pass. One forward
pass + one backward pass = gradients for every parameter. This is why
neural networks can scale to billions of parameters.

**The good news:** You'll almost never implement backprop by hand.
PyTorch does it automatically with `loss.backward()`. But understanding
what's happening under the hood helps you debug training problems.

---

## Key Takeaways

1. **Backprop assigns blame** — it figures out how much each weight
   contributed to the error.
2. **The chain rule** multiplies effects along the chain to compute
   how distant parameters affect the loss.
3. **Forward pass** computes the output. **Backward pass** computes
   the gradients.
4. **Vanishing gradients** happen when effects < 1 multiply together
   through many layers, making early-layer gradients tiny.
5. **Exploding gradients** happen when effects > 1 multiply together,
   making gradients enormous.
6. **ReLU and skip connections** largely solved the vanishing gradient
   problem.
7. **In practice, PyTorch does backprop for you** — but understanding
   the mechanics helps you debug.

---

## Exercises

1. **Trace by hand:** Given x=3, w1=0.4, b1=0, w2=0.6, b2=0, target=2.0,
   and using ReLU activation, compute the forward pass, the loss (MSE),
   and the gradient for each parameter.

2. **Modify the XOR code:** Change the hidden layer size from 4 to 2.
   Does it still learn XOR? What about hidden_size=1? Why?

3. **Gradient clipping:** Add gradient clipping to the XOR code.
   After computing gradients, clip any gradient larger than 1.0 to 1.0
   (and smaller than -1.0 to -1.0). Does training still work? Is it
   slower or faster?

4. **Vanishing gradient experiment:** Replace sigmoid with a function
   that squashes outputs to a very small range (e.g., output * 0.01).
   Watch what happens to the gradients after many layers.

5. **Learning rate experiment:** Run the XOR code with learning rates
   of 0.01, 0.1, 0.5, 1.0, and 5.0. Plot the loss curves. Which
   converges fastest? Which one explodes?

---

Next: [Lesson 08 — Training in Practice](./08-training-practice.md)
