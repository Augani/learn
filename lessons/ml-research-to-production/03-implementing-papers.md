# Lesson 03: Implementing Papers

> **Analogy**: Implementing a paper from math notation is like
> building furniture from an IKEA manual where half the steps are
> in Swedish, the diagrams are tiny, and three screws are missing
> from the bag. The end result works, but the journey requires
> patience and creative interpretation.

---

## Why Implement from Scratch?

Running someone's code teaches you to use their work. Implementing
from scratch teaches you to understand it. There's no shortcut
to this kind of understanding.

```
Understanding Spectrum:

  Use a library     -->  "I can call model.predict()"
  Read the paper    -->  "I know what the model does"
  Run their code    -->  "I can modify hyperparameters"
  Implement it      -->  "I know why every line exists"
                          ^
                          This is where innovation happens
```

When you implement from scratch, you discover all the things the
paper didn't tell you. Those discoveries are where your expertise
grows.

---

## Translating Math to Code

The biggest barrier to implementing papers is the notation. LaTeX
symbols look alien if you haven't built the mapping in your head.
Let's build it.

### The Core LaTeX-to-PyTorch Dictionary

```
+---------------------+---------------------------+----------------------------+
| Math Notation       | Meaning                   | PyTorch                    |
+---------------------+---------------------------+----------------------------+
| x \in R^d           | d-dimensional vector      | x = torch.randn(d)        |
| W \in R^{m x n}     | Weight matrix             | W = nn.Linear(n, m)       |
| \sigma(x)           | Sigmoid activation        | torch.sigmoid(x)          |
| ReLU(x)             | ReLU activation           | F.relu(x)                 |
| softmax(z)          | Softmax over logits       | F.softmax(z, dim=-1)      |
| ||x||_2             | L2 norm                   | torch.norm(x, p=2)        |
| x^T                 | Transpose                 | x.T  or  x.transpose()    |
| X \odot Y           | Element-wise multiply     | X * Y                     |
| X @ Y               | Matrix multiply           | X @ Y  or  torch.matmul() |
| \sum_{i=1}^{N}      | Sum over N elements       | torch.sum()  or  .sum()   |
| \prod_{i}           | Product over elements     | torch.prod()              |
| \arg\max            | Index of maximum          | torch.argmax()            |
| E[x]                | Expected value (mean)     | x.mean()                  |
| \nabla_\theta L     | Gradient of loss wrt      | loss.backward()           |
|                     | parameters                | (autograd handles this)    |
| \mathcal{L}         | Loss function             | loss_fn(pred, target)      |
| \log                | Natural logarithm         | torch.log()               |
| exp(x)              | Exponential               | torch.exp()               |
| \text{concat}(a,b)  | Concatenation             | torch.cat([a, b], dim=?)  |
+---------------------+---------------------------+----------------------------+
```

### Reading Subscripts and Superscripts

```
x_i          --> The i-th element of x          x[i]
x^{(t)}      --> x at time step t               x_t  (variable naming)
W^{(l)}      --> Weight matrix of layer l       layers[l].weight
h_i^{(t)}    --> Hidden state i at time t       h[t, i]  or  h[t][i]
\theta        --> All learnable parameters       model.parameters()
```

### Common Equation Patterns

**Linear transformation:**
```
Math:    z = Wx + b
Code:    z = F.linear(x, W, b)
         # or via nn.Linear (which stores W and b)
         linear = nn.Linear(in_features, out_features)
         z = linear(x)
```

**Attention (scaled dot-product):**
```
Math:    Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V

Code:
def scaled_dot_product_attention(Q, K, V):
    d_k = Q.size(-1)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
    weights = F.softmax(scores, dim=-1)
    return torch.matmul(weights, V)
```

**Cross-entropy loss:**
```
Math:    L = -\sum_{i} y_i \log(\hat{y}_i)

Code:    loss = F.cross_entropy(logits, targets)
         # Note: PyTorch CE expects raw logits, not probabilities
         # It applies softmax internally
```

---

## Building from Pseudocode

Many papers include algorithm boxes. These are your best friend.
They're closer to code than the math sections and give you the
exact control flow.

### Reading Pseudocode

```
ALGORITHM 1: Paper's Pseudocode       Your PyTorch Code
---------------------------------     ------------------

Input: dataset D, learning rate α     def train(dataset, lr):
Initialize θ randomly                     model = MyModel()
                                          optimizer = Adam(model.parameters(), lr=lr)
for epoch = 1 to T do                    for epoch in range(T):
    for (x, y) in D do                       for x, y in dataloader:
        z = f_θ(x)                               z = model(x)
        L = loss(z, y)                            loss = loss_fn(z, y)
        θ = θ - α∇_θ L                           optimizer.zero_grad()
                                                  loss.backward()
                                                  optimizer.step()
```

The pseudocode skips things you need to add:
- `optimizer.zero_grad()` before backward
- DataLoader batching
- Device placement (`.to(device)`)
- Gradient clipping
- Logging and checkpointing
- Evaluation loops

### What Pseudocode Hides

```
What pseudocode says:          What you need to handle:

"Sample batch from D"    -->   DataLoader with shuffle, num_workers,
                               pin_memory, drop_last

"Compute gradient"       -->   zero_grad + backward + clip_grad_norm

"Update parameters"      -->   optimizer.step() + scheduler.step()
                               (and which happens first?)

"Until convergence"      -->   Max epochs + early stopping +
                               patience + best model checkpoint

"Normalize features"     -->   Layer norm? Batch norm? L2 norm?
                               Before or after activation?
```

---

## The Implementation Workflow

### Step 1: Build the Skeleton

Start with the forward pass. Get data flowing through the model
before worrying about training.

```python
class PaperModel(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.encoder = self._build_encoder(config)
        self.head = self._build_head(config)

    def _build_encoder(self, config):
        raise NotImplementedError("TODO: Equation 1-3")

    def _build_head(self, config):
        raise NotImplementedError("TODO: Section 3.2")

    def forward(self, x):
        features = self.encoder(x)
        return self.head(features)
```

### Step 2: Implement Equation by Equation

Work through the method section equation by equation. Implement
each one as a testable function.

```python
def equation_1_feature_projection(x, W_proj):
    """
    Paper Eq. 1: z = W_proj @ x + b
    """
    return F.linear(x, W_proj)

def equation_2_similarity(z_i, z_j, temperature):
    """
    Paper Eq. 2: sim(z_i, z_j) = z_i^T z_j / (||z_i|| ||z_j|| tau)
    """
    z_i_norm = F.normalize(z_i, dim=-1)
    z_j_norm = F.normalize(z_j, dim=-1)
    return torch.matmul(z_i_norm, z_j_norm.T) / temperature
```

### Step 3: Test Each Component

Before assembling the full model, test each piece independently.

```python
def test_feature_projection():
    batch_size, in_dim, out_dim = 4, 128, 64
    x = torch.randn(batch_size, in_dim)
    proj = nn.Linear(in_dim, out_dim)

    z = equation_1_feature_projection(x, proj.weight)
    assert z.shape == (batch_size, out_dim), f"Expected ({batch_size}, {out_dim}), got {z.shape}"

def test_similarity_range():
    z = torch.randn(4, 64)
    sim = equation_2_similarity(z, z, temperature=0.1)
    diagonal = sim.diag()
    assert torch.allclose(diagonal, torch.ones_like(diagonal) / 0.1, atol=1e-5)
```

### Step 4: Assemble and Verify Shapes

Shape errors are the most common bugs in ML implementations. Build
a shape-checking pass through the entire model.

```python
def verify_shapes(model, sample_input):
    print(f"Input: {sample_input.shape}")

    hooks = []
    shapes = {}

    def make_hook(name):
        def hook(module, input, output):
            if isinstance(output, torch.Tensor):
                shapes[name] = output.shape
            elif isinstance(output, tuple):
                shapes[name] = [o.shape for o in output if isinstance(o, torch.Tensor)]
        return hook

    for name, module in model.named_modules():
        if name:
            hooks.append(module.register_forward_hook(make_hook(name)))

    with torch.no_grad():
        output = model(sample_input)

    for h in hooks:
        h.remove()

    for name, shape in shapes.items():
        print(f"  {name}: {shape}")
    print(f"Output: {output.shape}")
```

### Step 5: Test Against Paper Figures

Most papers include training curves or example outputs. Reproduce
these before chasing final numbers.

```
Paper Figure 3 shows:                Your training curve:

Loss drops sharply at epoch 5        Loss drops sharply at epoch 5  ✓
Loss plateaus around epoch 20        Loss plateaus around epoch 18  ≈
Final loss ~ 0.35                    Final loss ~ 0.38              ≈

The shape matters more than exact values early on.
```

---

## Implementation Debugging

### The Shape Mismatch Cascade

Shape errors are the most common implementation bug. They cascade:
one wrong dimension propagates through the whole model.

```
Debugging Strategy:

  1. Print shapes at every layer boundary
  2. Work forward from input to first error
  3. Compare expected shape (from paper) vs actual shape
  4. Common causes:
     - Forgot to transpose (batch_first=True/False)
     - Wrong dimension in reshape/view
     - Missing squeeze/unsqueeze
     - Convolution output size miscalculated

Common shape formula for convolutions:
  out_size = floor((in_size + 2*padding - kernel_size) / stride) + 1
```

### Numerical Debugging

When shapes are correct but values are wrong:

```python
def debug_numerics(tensor, name=""):
    print(f"{name}: shape={tensor.shape}, "
          f"min={tensor.min():.4f}, max={tensor.max():.4f}, "
          f"mean={tensor.mean():.4f}, std={tensor.std():.4f}, "
          f"has_nan={tensor.isnan().any()}, "
          f"has_inf={tensor.isinf().any()}")
```

Common numerical issues:

```
+-----------------------+----------------------------------+
| Symptom               | Likely Cause                     |
+-----------------------+----------------------------------+
| Loss = NaN            | Log of zero or negative value    |
|                       | Division by zero                 |
|                       | Learning rate too high            |
+-----------------------+----------------------------------+
| Loss = Inf            | Overflow in exp() or softmax     |
|                       | Missing gradient clipping        |
+-----------------------+----------------------------------+
| Loss doesn't decrease | Wrong loss function              |
|                       | Frozen parameters (requires_grad)|
|                       | Learning rate too low             |
|                       | Bug in forward pass              |
+-----------------------+----------------------------------+
| Gradients all zero    | Dead ReLUs                       |
|                       | Detached computation graph       |
|                       | Missing .backward()              |
+-----------------------+----------------------------------+
| Gradients explode     | No gradient clipping             |
|                       | Bad initialization               |
|                       | Architecture instability         |
+-----------------------+----------------------------------+
```

### The Gradient Check

When your loss isn't decreasing and you've checked everything else,
verify gradients are flowing:

```python
def check_gradients(model):
    model.train()
    for name, param in model.named_parameters():
        if param.grad is not None:
            grad_norm = param.grad.norm().item()
            if grad_norm == 0:
                print(f"ZERO GRAD: {name}")
            elif grad_norm > 100:
                print(f"EXPLODING: {name} (norm={grad_norm:.2f})")
            else:
                print(f"OK: {name} (norm={grad_norm:.4f})")
        else:
            print(f"NO GRAD: {name}")
```

---

## Common Paper-to-Code Gotchas

```
1. "We use LayerNorm"
   Pre-norm (before attention) or post-norm (after)?
   These give very different training dynamics.

2. "We use dropout with p=0.1"
   Applied where? After attention? After FFN? Both? On residual?

3. "We initialize weights with Xavier"
   Xavier uniform or Xavier normal? Applied to all layers?
   What about biases?

4. "Temperature parameter tau=0.07"
   Is this learned or fixed? If learned, what's the init?

5. "We use a linear warmup"
   Over how many steps? From what starting LR? To what peak?

6. "We train with mixed precision"
   FP16 or BF16? With loss scaling? What's the scaler config?
```

---

## Practical Exercise

Implement scaled dot-product attention from the "Attention Is All
You Need" paper. This is one of the most-implemented equations in
ML and makes excellent practice.

```
Target equation (Paper Section 3.2.1):

  Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V
```

1. Implement the function
2. Add a causal mask option (for decoder self-attention)
3. Add dropout on attention weights
4. Test with known input/output pairs
5. Compare your output to `torch.nn.functional.scaled_dot_product_attention`

Then extend it to multi-head attention (Section 3.2.2):

```
MultiHead(Q, K, V) = Concat(head_1, ..., head_h) W^O
  where head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)
```

---

## Key Takeaways

- Build a mental dictionary mapping math notation to code
- Implement equation by equation, testing each component
- Shape mismatches are the most common bugs -- print shapes early
  and often
- Papers hide critical details in notation choices -- read carefully
- Test against paper figures and intermediate results, not just
  final numbers
- When stuck, compare your code line-by-line against a reference
  implementation

Next lesson: you can implement papers. Now let's learn to design
experiments that actually prove something.
