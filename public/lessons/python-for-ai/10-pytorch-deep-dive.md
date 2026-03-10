# Lesson 10: PyTorch Deep Dive

> PyTorch is like building with electronic LEGO.
> You snap together layers, wire them up, and electricity (gradients) flows.

---

## Tensors: The Foundation

Tensors are NumPy arrays that can live on GPUs and track gradients.
Like NumPy arrays wearing a jet pack and a backpack full of calculus.

```python
import torch

a = torch.tensor([1.0, 2.0, 3.0])
b = torch.zeros(3, 4)
c = torch.ones(2, 3)
d = torch.randn(3, 3)
e = torch.arange(0, 10, 2)

print(f"a: {a}, shape={a.shape}, dtype={a.dtype}")
print(f"d:\n{d}")
```

```
  Tensor Dimensions:
  ─────────────────
  Scalar:  torch.tensor(42)              shape: ()
  Vector:  torch.tensor([1, 2, 3])       shape: (3,)
  Matrix:  torch.randn(3, 4)             shape: (3, 4)
  3D:      torch.randn(2, 3, 4)          shape: (2, 3, 4)
  Batch:   torch.randn(32, 3, 224, 224)  shape: (B, C, H, W)
```

### NumPy Interop

```python
import torch
import numpy as np

np_array = np.array([1.0, 2.0, 3.0])
tensor = torch.from_numpy(np_array)
back_to_np = tensor.numpy()

print(f"Tensor: {tensor}")
print(f"NumPy:  {back_to_np}")

tensor[0] = 99
print(f"Shared memory: np_array[0] = {np_array[0]}")
```

### GPU Operations

```python
import torch

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")

x = torch.randn(3, 3, device=device)
y = torch.randn(3, 3, device=device)
z = x @ y
print(z)
```

---

## Autograd: Automatic Differentiation

Autograd is the engine that powers learning. It watches your
computations like a video recorder, then plays them backward
to compute gradients. Like tracing your steps to figure out
where you made a wrong turn.

```
  Forward pass:
  x ──> [*2] ──> [+3] ──> [**2] ──> y

  Backward pass (chain rule):
  dy/dx <── [2*(2x+3)] <── [1] <── [2] <── 1.0
```

```python
import torch

x = torch.tensor(3.0, requires_grad=True)

y = (2 * x + 3) ** 2

y.backward()

print(f"x = {x.item()}")
print(f"y = {y.item()}")
print(f"dy/dx = {x.grad.item()}")
print(f"Expected: 2 * 2 * (2*3+3) = {2 * 2 * (2*3+3)}")
```

### Gradients with Vectors

```python
import torch

W = torch.randn(3, 3, requires_grad=True)
x = torch.randn(3)
target = torch.tensor([1.0, 0.0, 0.0])

pred = W @ x
loss = ((pred - target) ** 2).sum()
loss.backward()

print(f"Loss: {loss.item():.4f}")
print(f"W.grad shape: {W.grad.shape}")
print(f"W.grad:\n{W.grad}")
```

### Detaching and No-Grad

```python
import torch

x = torch.randn(3, requires_grad=True)
y = x * 2

z = y.detach()
print(f"z requires_grad: {z.requires_grad}")

with torch.no_grad():
    w = x * 3
    print(f"w requires_grad: {w.requires_grad}")
```

---

## nn.Module: Building Models

Every PyTorch model inherits from `nn.Module`. Think of it like
a Russian nesting doll - modules contain other modules, all the
way down to individual layers.

```python
import torch
import torch.nn as nn

class SimpleClassifier(nn.Module):
    def __init__(self, input_dim, hidden_dim, num_classes):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim // 2, num_classes),
        )

    def forward(self, x):
        return self.layers(x)


model = SimpleClassifier(input_dim=784, hidden_dim=256, num_classes=10)
print(model)

total_params = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"Total params: {total_params:,}")
print(f"Trainable: {trainable_params:,}")
```

### Custom Forward Logic

```python
import torch
import torch.nn as nn

class ResidualBlock(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.ff = nn.Sequential(
            nn.Linear(dim, dim),
            nn.ReLU(),
            nn.Linear(dim, dim),
        )
        self.norm = nn.LayerNorm(dim)

    def forward(self, x):
        return self.norm(x + self.ff(x))


class DeepModel(nn.Module):
    def __init__(self, input_dim, hidden_dim, num_blocks, num_classes):
        super().__init__()
        self.input_proj = nn.Linear(input_dim, hidden_dim)
        self.blocks = nn.ModuleList([
            ResidualBlock(hidden_dim) for _ in range(num_blocks)
        ])
        self.head = nn.Linear(hidden_dim, num_classes)

    def forward(self, x):
        x = self.input_proj(x)
        for block in self.blocks:
            x = block(x)
        return self.head(x)


model = DeepModel(784, 128, num_blocks=4, num_classes=10)
dummy = torch.randn(32, 784)
output = model(dummy)
print(f"Output shape: {output.shape}")
```

---

## DataLoader: Feeding the Model

DataLoaders are like a cafeteria serving line. They take your
full dataset and serve it in batches, shuffled and ready to eat.

```python
import torch
from torch.utils.data import Dataset, DataLoader

class SyntheticDataset(Dataset):
    def __init__(self, num_samples, input_dim, num_classes):
        self.X = torch.randn(num_samples, input_dim)
        self.y = torch.randint(0, num_classes, (num_samples,))

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]


dataset = SyntheticDataset(1000, input_dim=20, num_classes=5)
loader = DataLoader(dataset, batch_size=32, shuffle=True, num_workers=0)

for batch_X, batch_y in loader:
    print(f"Batch X: {batch_X.shape}, Batch y: {batch_y.shape}")
    break
```

---

## The Training Loop

The training loop is the heartbeat of deep learning.
Like a student studying: read (forward), check answers (loss),
learn from mistakes (backward), update knowledge (optimizer step).

```
  Training Loop:
  ┌────────────────────────────────────────┐
  │  for each epoch:                       │
  │    for each batch:                     │
  │      1. Forward pass  (predictions)    │
  │      2. Compute loss  (how wrong?)     │
  │      3. Backward pass (gradients)      │
  │      4. Optimizer step (update weights)│
  │      5. Zero gradients (reset)         │
  │    Validate on val set                 │
  └────────────────────────────────────────┘
```

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

torch.manual_seed(42)

X_train = torch.randn(800, 20)
y_train = torch.randint(0, 5, (800,))
X_val = torch.randn(200, 20)
y_val = torch.randint(0, 5, (200,))

train_loader = DataLoader(TensorDataset(X_train, y_train), batch_size=32, shuffle=True)
val_loader = DataLoader(TensorDataset(X_val, y_val), batch_size=64)

model = nn.Sequential(
    nn.Linear(20, 64),
    nn.ReLU(),
    nn.Linear(64, 32),
    nn.ReLU(),
    nn.Linear(32, 5),
)

criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

for epoch in range(10):
    model.train()
    total_loss = 0
    correct = 0
    total = 0

    for batch_X, batch_y in train_loader:
        optimizer.zero_grad()
        logits = model(batch_X)
        loss = criterion(logits, batch_y)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * batch_X.size(0)
        correct += (logits.argmax(dim=1) == batch_y).sum().item()
        total += batch_X.size(0)

    train_loss = total_loss / total
    train_acc = correct / total

    model.eval()
    val_correct = 0
    val_total = 0
    with torch.no_grad():
        for batch_X, batch_y in val_loader:
            logits = model(batch_X)
            val_correct += (logits.argmax(dim=1) == batch_y).sum().item()
            val_total += batch_X.size(0)

    val_acc = val_correct / val_total
    print(f"Epoch {epoch+1:2d}: loss={train_loss:.4f} train_acc={train_acc:.3f} val_acc={val_acc:.3f}")
```

---

## Learning Rate Schedulers

```python
import torch
import torch.nn as nn

model = nn.Linear(10, 1)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=100)

lrs = []
for epoch in range(100):
    lrs.append(optimizer.param_groups[0]["lr"])
    optimizer.step()
    scheduler.step()

print(f"Start LR: {lrs[0]:.6f}")
print(f"Mid LR:   {lrs[50]:.6f}")
print(f"End LR:   {lrs[-1]:.6f}")
```

---

## Saving and Loading

```python
import torch
import torch.nn as nn

model = nn.Sequential(nn.Linear(10, 5), nn.ReLU(), nn.Linear(5, 2))
optimizer = torch.optim.Adam(model.parameters())

torch.save({
    "epoch": 10,
    "model_state_dict": model.state_dict(),
    "optimizer_state_dict": optimizer.state_dict(),
    "loss": 0.234,
}, "checkpoint.pt")

checkpoint = torch.load("checkpoint.pt", weights_only=False)
model.load_state_dict(checkpoint["model_state_dict"])
print(f"Resumed from epoch {checkpoint['epoch']}, loss={checkpoint['loss']}")
```

---

## Common Patterns

### Weight Initialization

```python
import torch.nn as nn

def init_weights(module):
    if isinstance(module, nn.Linear):
        nn.init.kaiming_normal_(module.weight, mode="fan_out", nonlinearity="relu")
        if module.bias is not None:
            nn.init.zeros_(module.bias)

model = nn.Sequential(nn.Linear(20, 64), nn.ReLU(), nn.Linear(64, 10))
model.apply(init_weights)
```

### Gradient Clipping

```python
import torch
import torch.nn as nn

model = nn.Linear(10, 10)
optimizer = torch.optim.SGD(model.parameters(), lr=0.01)

x = torch.randn(5, 10)
loss = model(x).sum()
loss.backward()

torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
optimizer.step()
```

---

## Exercises

1. **Custom Dataset**: Create a `Dataset` class that generates
   XOR data (2D inputs, binary labels). Train a 2-layer network
   to solve it. Plot the decision boundary.

2. **Training with Logging**: Write a training loop that logs
   train/val loss and accuracy per epoch. Implement early stopping
   that saves the best model and restores it at the end.

3. **Model Surgery**: Load a pretrained model. Freeze all layers
   except the last one. Fine-tune on new data with a smaller
   learning rate. Compare frozen vs unfrozen performance.

4. **Custom Loss**: Implement focal loss as a custom `nn.Module`.
   Train with both cross-entropy and focal loss on an imbalanced
   dataset. Compare results.

5. **Multi-GPU Prep**: Wrap a model with `nn.DataParallel` or
   `DistributedDataParallel` (if GPUs available). If not, write
   the code that would handle it and test on CPU with the wrapper.

---

[Next: Lesson 11 - Hugging Face ->](11-hugging-face.md)
