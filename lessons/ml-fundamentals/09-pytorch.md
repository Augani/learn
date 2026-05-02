# Lesson 09: PyTorch — Building Neural Networks with Real Tools

You've built neural networks from scratch with numpy. You understand
forward passes, backpropagation, and gradient descent. Now it's time to
use a real framework that does the tedious parts for you.

---

## Why PyTorch

Three major frameworks exist:

| Framework | Backed By | Style | Best For |
|-----------|-----------|-------|----------|
| PyTorch | Meta | Pythonic, imperative | Research, learning, most new projects |
| TensorFlow | Google | Graph-based (originally) | Production deployment, mobile |
| JAX | Google | Functional, numpy-like | Research, high-performance computing |

We use PyTorch because:
- Most research papers use it (easier to follow along)
- It feels like regular Python (no "compilation" step)
- Debugging is straightforward (use standard Python debugger)
- The API is clean and consistent

**Go analogy:** TensorFlow is like writing SQL — you declare what you
want and the engine figures out how to do it. PyTorch is like writing
Go — you explicitly write the steps and can inspect every value.

---

## Tensors — The Foundation

A tensor is a multi-dimensional array. Like numpy arrays, but they can
run on GPUs and track gradients automatically.

```python
import torch

scalar = torch.tensor(3.14)
vector = torch.tensor([1.0, 2.0, 3.0])
matrix = torch.tensor([[1, 2], [3, 4], [5, 6]])
tensor_3d = torch.randn(2, 3, 4)

print(f"Scalar shape: {scalar.shape}")        # torch.Size([])
print(f"Vector shape: {vector.shape}")        # torch.Size([3])
print(f"Matrix shape: {matrix.shape}")        # torch.Size([3, 2])
print(f"3D tensor shape: {tensor_3d.shape}")  # torch.Size([2, 3, 4])
```

### Tensor Operations

```python
a = torch.tensor([1.0, 2.0, 3.0])
b = torch.tensor([4.0, 5.0, 6.0])

print(a + b)          # tensor([5., 7., 9.])
print(a * b)          # tensor([ 4., 10., 18.])    element-wise
print(a @ b)          # tensor(32.)                 dot product
print(a.mean())       # tensor(2.)
print(a.sum())        # tensor(6.)

M = torch.randn(3, 4)
v = torch.randn(4)
print((M @ v).shape)  # torch.Size([3])   matrix-vector multiply
```

### Tensor vs Numpy

```python
import numpy as np

np_array = np.array([1.0, 2.0, 3.0])
tensor = torch.from_numpy(np_array)
back_to_numpy = tensor.numpy()

# Key difference: tensors can live on GPU
if torch.cuda.is_available():
    gpu_tensor = tensor.to('cuda')
elif torch.backends.mps.is_available():
    gpu_tensor = tensor.to('mps')    # Apple Silicon
```

**TypeScript analogy:** A numpy array is like a regular JavaScript array.
A PyTorch tensor is like a typed array (Float32Array) that can also run
on the GPU. Same data, more capabilities.

---

## Autograd — Automatic Differentiation

This is the killer feature. PyTorch tracks every operation on tensors
and can automatically compute gradients. No more manual backprop.

```python
x = torch.tensor(3.0, requires_grad=True)
y = x ** 2 + 2 * x + 1     # y = x² + 2x + 1

y.backward()                 # compute dy/dx automatically

print(x.grad)                # tensor(8.)
# dy/dx = 2x + 2 = 2(3) + 2 = 8  ✓
```

### How It Works

When `requires_grad=True`, PyTorch builds a computation graph as you
do math. When you call `.backward()`, it walks the graph backward
(backpropagation!) and fills in the `.grad` attribute.

```
Computation Graph (built during forward pass):

  x (3.0)
    │
    ├──→ x² ──→ + ──→ y (16.0)
    │           ↑
    └──→ 2x ───┘
              ↑
         + 1 ─┘

Backward pass (.backward()):
  Walks this graph in reverse, computing gradients via chain rule.
  Result: x.grad = 8.0
```

**Go analogy:** Imagine every arithmetic operation secretly appends to a
log. When you call `.backward()`, it replays the log in reverse, computing
derivatives at each step. It's like a transaction log that can be "rolled
back" to compute derivatives instead of undoing changes.

### A More Realistic Example

```python
W = torch.randn(3, 2, requires_grad=True)
b = torch.randn(2, requires_grad=True)
x = torch.randn(3)
target = torch.tensor([1.0, 0.0])

prediction = x @ W + b
loss = ((prediction - target) ** 2).mean()

loss.backward()

print(f"Loss: {loss.item():.4f}")
print(f"W gradient shape: {W.grad.shape}")   # torch.Size([3, 2])
print(f"b gradient shape: {b.grad.shape}")   # torch.Size([2])
```

No manual derivative computation. No chain rule by hand. PyTorch did
it all.

---

## nn.Module — Building Blocks

`nn.Module` is the base class for all neural network components. Think
of it as an interface that says "I have parameters and I can process
input."

### Your First Module

```python
import torch.nn as nn

class SimpleClassifier(nn.Module):
    def __init__(self, input_size, hidden_size, output_size):
        super().__init__()
        self.layer1 = nn.Linear(input_size, hidden_size)
        self.activation = nn.ReLU()
        self.layer2 = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        x = self.layer1(x)
        x = self.activation(x)
        x = self.layer2(x)
        return x

model = SimpleClassifier(input_size=784, hidden_size=128, output_size=10)
print(model)
```

Output:
```
SimpleClassifier(
  (layer1): Linear(in_features=784, out_features=128, bias=True)
  (activation): ReLU()
  (layer2): Linear(in_features=128, out_features=10, bias=True)
)
```

**TypeScript analogy:** `nn.Module` is like an abstract class with a
`forward()` method you must implement. `nn.Linear` is like a pre-built
class that does `y = Wx + b`. You compose them like React components.

```typescript
// TypeScript mental model (NOT real code):
interface NNModule {
    forward(input: Tensor): Tensor;
    parameters(): Tensor[];
}
```

### nn.Sequential — Quick and Dirty

For simple stacked architectures, skip the class:

```python
model = nn.Sequential(
    nn.Linear(784, 256),
    nn.ReLU(),
    nn.Linear(256, 128),
    nn.ReLU(),
    nn.Linear(128, 10)
)

x = torch.randn(1, 784)
output = model(x)
print(output.shape)  # torch.Size([1, 10])
```

### Key Layers

| Layer | What It Does | Analogy |
|-------|-------------|---------|
| `nn.Linear(in, out)` | y = Wx + b | A weighted sum + offset |
| `nn.ReLU()` | max(0, x) | A filter that blocks negatives |
| `nn.Sigmoid()` | Squash to 0-1 | A confidence meter |
| `nn.Softmax(dim=1)` | Probabilities that sum to 1 | "Pick one" output |
| `nn.Dropout(p=0.5)` | Randomly zero out neurons | Builds redundancy |
| `nn.BatchNorm1d(n)` | Normalize layer outputs | Keeps values stable |

---

## DataLoader — Batching and Shuffling

You don't manually slice your data into batches. PyTorch handles it.

```python
from torch.utils.data import DataLoader, TensorDataset

X_tensor = torch.randn(1000, 784)
y_tensor = torch.randint(0, 10, (1000,))

dataset = TensorDataset(X_tensor, y_tensor)
train_loader = DataLoader(dataset, batch_size=32, shuffle=True)

for batch_X, batch_y in train_loader:
    print(f"Batch shape: {batch_X.shape}, Labels shape: {batch_y.shape}")
    break
# Batch shape: torch.Size([32, 784]), Labels shape: torch.Size([32])
```

`shuffle=True` randomizes the order each epoch — important for training
quality. Without shuffling, the model sees the same sequence every epoch
and might learn spurious patterns from the ordering.

---

## The Training Loop Pattern

Every PyTorch training loop follows the same structure:

```python
model = SimpleClassifier(784, 128, 10)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

for epoch in range(num_epochs):
    model.train()
    total_loss = 0

    for batch_X, batch_y in train_loader:
        optimizer.zero_grad()              # 1. Clear old gradients

        predictions = model(batch_X)       # 2. Forward pass

        loss = criterion(predictions, batch_y)  # 3. Compute loss

        loss.backward()                    # 4. Backward pass (compute gradients)

        optimizer.step()                   # 5. Update parameters

        total_loss += loss.item()

    avg_loss = total_loss / len(train_loader)
    print(f"Epoch {epoch+1}/{num_epochs}, Loss: {avg_loss:.4f}")
```

**The five sacred steps** (memorize these):

```
1. optimizer.zero_grad()    ← Reset gradients (they accumulate by default!)
2. output = model(input)    ← Forward pass
3. loss = criterion(output, target)  ← Measure error
4. loss.backward()          ← Backpropagation (autograd does the work)
5. optimizer.step()         ← Update weights using computed gradients
```

**Why zero_grad?** PyTorch accumulates gradients by default (useful for
some advanced techniques). If you don't clear them, gradients from the
previous batch add to the current batch's gradients. Almost always wrong.

---

## GPU Acceleration

Neural networks run dramatically faster on GPUs. PyTorch makes this
easy — just move your model and data to the GPU.

```python
device = torch.device(
    'cuda' if torch.cuda.is_available()       # NVIDIA GPU
    else 'mps' if torch.backends.mps.is_available()  # Apple Silicon
    else 'cpu'
)
print(f"Using device: {device}")

model = SimpleClassifier(784, 128, 10).to(device)

for batch_X, batch_y in train_loader:
    batch_X = batch_X.to(device)
    batch_y = batch_y.to(device)
    output = model(batch_X)
```

**The rule:** Model AND data must be on the same device. If the model
is on GPU but data is on CPU, you'll get an error.

**Go analogy:** Think of `.to(device)` like serializing data and sending
it over a network to a worker. The GPU is a separate computer that's
really fast at matrix math.

---

## Saving and Loading Models

```python
torch.save(model.state_dict(), 'model_weights.pth')

loaded_model = SimpleClassifier(784, 128, 10)
loaded_model.load_state_dict(torch.load('model_weights.pth'))
loaded_model.eval()
```

`state_dict()` is just a dictionary of parameter names to tensors.
Save the weights, not the whole model — it's more portable.

```python
print(model.state_dict().keys())
# odict_keys(['layer1.weight', 'layer1.bias', 'layer2.weight', 'layer2.bias'])
```

---

## Complete Working Example: MNIST Digit Classifier

MNIST is the "hello world" of ML — 70,000 handwritten digit images
(28x28 pixels, grayscale). Classify each image as 0-9.

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

device = torch.device(
    'cuda' if torch.cuda.is_available()
    else 'mps' if torch.backends.mps.is_available()
    else 'cpu'
)

transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,))
])

train_dataset = datasets.MNIST(
    root='./data', train=True, download=True, transform=transform
)
test_dataset = datasets.MNIST(
    root='./data', train=False, download=True, transform=transform
)

train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
test_loader = DataLoader(test_dataset, batch_size=1000, shuffle=False)


class MNISTClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.flatten = nn.Flatten()
        self.network = nn.Sequential(
            nn.Linear(28 * 28, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 10)
        )

    def forward(self, x):
        x = self.flatten(x)
        return self.network(x)


model = MNISTClassifier().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)


def train_epoch(model, loader, criterion, optimizer):
    model.train()
    total_loss = 0
    correct = 0
    total = 0

    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
        _, predicted = outputs.max(1)
        total += labels.size(0)
        correct += predicted.eq(labels).sum().item()

    return total_loss / len(loader), correct / total


def evaluate(model, loader):
    model.eval()
    correct = 0
    total = 0

    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()

    return correct / total


for epoch in range(10):
    train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer)
    test_acc = evaluate(model, test_loader)
    print(f"Epoch {epoch+1:2d} | Loss: {train_loss:.4f} | "
          f"Train Acc: {train_acc:.2%} | Test Acc: {test_acc:.2%}")

torch.save(model.state_dict(), 'mnist_classifier.pth')
print("\nModel saved.")
```

Expected output (approximate):

```
Epoch  1 | Loss: 0.3421 | Train Acc: 89.64% | Test Acc: 95.82%
Epoch  2 | Loss: 0.1543 | Train Acc: 95.41% | Test Acc: 96.85%
Epoch  3 | Loss: 0.1142 | Train Acc: 96.52% | Test Acc: 97.22%
...
Epoch 10 | Loss: 0.0471 | Train Acc: 98.55% | Test Acc: 97.89%
```

~98% accuracy with a simple feedforward network. Not bad for 10 lines
of model definition.

### Key Details in the Code

**`model.train()` vs `model.eval()`:**
- `train()` — enables dropout, batch norm uses batch statistics
- `eval()` — disables dropout, batch norm uses running statistics
Always switch modes appropriately.

**`torch.no_grad()`:**
During evaluation, we don't need gradients. `torch.no_grad()` tells
PyTorch to skip gradient tracking, saving memory and computation.

**`transforms.Normalize((0.1307,), (0.3081,))`:**
These are the mean and standard deviation of the MNIST dataset.
Normalizing inputs to zero mean and unit variance helps training
converge faster.

---

## The PyTorch Mental Model

```
┌─────────────────────────────────────────────────────────┐
│  Your Code                                               │
│                                                          │
│  model = MNISTClassifier()     ← define architecture    │
│  criterion = CrossEntropyLoss()← define what to optimize│
│  optimizer = Adam(lr=0.001)    ← define how to optimize │
│                                                          │
│  for epoch in range(10):                                 │
│      for X, y in loader:       ← DataLoader gives batches│
│          pred = model(X)       ← forward pass (you write)│
│          loss = criterion(pred, y)  ← loss (automatic)  │
│          loss.backward()       ← backprop (automatic!)  │
│          optimizer.step()      ← update (automatic!)    │
│                                                          │
│  torch.save(model.state_dict())← save the learned params│
└─────────────────────────────────────────────────────────┘

You define the WHAT (architecture, loss, optimizer).
PyTorch handles the HOW (gradients, updates, GPU).
```

---

## Key Takeaways

1. **Tensors** are GPU-capable numpy arrays that track gradients.
2. **Autograd** eliminates manual backpropagation — call `.backward()`
   and gradients appear in `.grad`.
3. **nn.Module** is the building block — compose layers to build models.
4. **The training loop** is always: zero_grad → forward → loss →
   backward → step.
5. **DataLoader** handles batching and shuffling.
6. **GPU training** just requires `.to(device)` on model and data.
7. **model.train() and model.eval()** switch between training and
   inference modes.

---

## Exercises

1. **Modify the MNIST model:** Add a third hidden layer (64 neurons)
   and increase dropout to 0.3. Does accuracy improve?

2. **Optimizer comparison:** Train MNIST with SGD (lr=0.01) vs Adam
   (lr=0.001). Plot the loss curves. How many epochs does each need
   to reach 97% accuracy?

3. **Learning rate experiment:** Train with learning rates of 0.1,
   0.01, 0.001, and 0.0001 using Adam. Which works best? What happens
   with lr=0.1?

4. **Build from scratch:** Create a model for the Fashion-MNIST
   dataset (same format as MNIST but clothing items instead of digits).
   Use `datasets.FashionMNIST` instead of `datasets.MNIST`. Can you
   get above 88% accuracy?

5. **Inspect the model:** After training, examine the learned weights.
   `model.network[0].weight.data` gives the first layer's weights.
   What's the range? Are there dead neurons (all-zero rows)?

---

Next: [Lesson 10 — CNNs: How Computers See Images](./10-cnns.md)
