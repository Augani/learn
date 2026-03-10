# Lesson 10: CNNs — How Computers See Images

In Lesson 09, you built an MNIST classifier that flattened a 28x28
image into a 784-number vector. That works, but it throws away all
spatial information — it doesn't know that pixel (5,5) is next to
pixel (5,6). A CNN preserves that spatial structure.

---

## Images as Grids of Numbers

A computer doesn't "see" an image. It sees a grid of numbers.

```
Grayscale image (5x5):          What the computer sees:

  ░░███                          [0.1, 0.1, 0.9, 0.9, 0.9]
  ░░███                          [0.1, 0.1, 0.9, 0.9, 0.9]
  ░░░░░                          [0.1, 0.1, 0.1, 0.1, 0.1]
  ███░░                          [0.9, 0.9, 0.9, 0.1, 0.1]
  ███░░                          [0.9, 0.9, 0.9, 0.1, 0.1]

Each pixel is a number: 0 = black, 1 = white, values in between = gray.
```

Color images have 3 channels (Red, Green, Blue):

```
Color image shape: (3, height, width)

  Channel 0 (Red):    [0.9, 0.1, ...]
  Channel 1 (Green):  [0.1, 0.9, ...]
  Channel 2 (Blue):   [0.1, 0.1, ...]

A 224x224 color image = 3 × 224 × 224 = 150,528 numbers
```

---

## The Problem with Fully Connected Layers

The MNIST model in Lesson 09 used `nn.Linear(784, 256)`. That's
784 * 256 = 200,704 parameters for just the first layer.

For a 224x224 color image: 150,528 * 256 = 38.5 MILLION parameters
in the first layer alone. That's:
- Wasteful (too many parameters to learn)
- Prone to overfitting
- Ignores spatial structure (neighboring pixels are related!)

**Analogy:** Reading a book by cutting out every word, shuffling them
randomly, and trying to understand the story. You've destroyed the
structure that makes it meaningful.

---

## The Convolution Operation — The Flashlight

Instead of connecting every pixel to every neuron, slide a small
window (called a **kernel** or **filter**) across the image and compute
a weighted sum at each position.

```
Input image (5x5):                 Kernel (3x3):
┌───┬───┬───┬───┬───┐             ┌────┬────┬────┐
│ 1 │ 0 │ 1 │ 0 │ 1 │             │  1 │  0 │ -1 │
├───┼───┼───┼───┼───┤             ├────┼────┼────┤
│ 0 │ 1 │ 1 │ 1 │ 0 │             │  1 │  0 │ -1 │
├───┼───┼───┼───┼───┤             ├────┼────┼────┤
│ 1 │ 1 │ 0 │ 1 │ 1 │             │  1 │  0 │ -1 │
├───┼───┼───┼───┼───┤             └────┴────┴────┘
│ 0 │ 0 │ 1 │ 0 │ 0 │
├───┼───┼───┼───┼───┤
│ 1 │ 0 │ 0 │ 1 │ 0 │
└───┴───┴───┴───┴───┘

Step 1: Place kernel at top-left corner
┌───────────┐
│ 1   0   1 │ 0   1       Multiply element-wise, then sum:
│ 0   1   1 │ 1   0       (1×1)+(0×0)+(1×-1)+
│ 1   1   0 │ 1   1       (0×1)+(1×0)+(1×-1)+
  0   0   1   0   0       (1×1)+(1×0)+(0×-1) = 1+0-1+0+0-1+1+0+0 = 0
  1   0   0   1   0

Step 2: Slide one pixel right
  1 ┌───────────┐
  0 │ 0   1   0 │ 1       Result = (0×1)+(1×0)+(0×-1)+
  1 │ 1   1   1 │ 0                (1×1)+(1×0)+(1×-1)+
  0 │ 1   0   1 │ 1                (1×1)+(0×0)+(1×-1) = 0+0+0+1+0-1+1+0-1 = 0
  1   0   0   1   0

...continue sliding across and down...
```

**Analogy:** Imagine a flashlight that illuminates a small patch of a
wall painting. You slide the flashlight across every part of the painting.
At each position, the flashlight "reacts" to what it sees. An edge-detecting
flashlight brightens when it sees an edge, darkens when it doesn't.

The output is a **feature map** — a new grid where each position tells
you "how much did this pattern appear here?"

```
Input (5×5)    ──[3×3 kernel]──→    Feature Map (3×3)
                                    ┌───┬───┬───┐
                                    │ 0 │ 0 │ 2 │
                                    ├───┼───┼───┤
                                    │-1 │ 1 │ 0 │
                                    ├───┼───┼───┤
                                    │ 1 │-1 │ 0 │
                                    └───┴───┴───┘
```

---

## What Filters Detect

Different kernel values detect different patterns:

```
EDGE DETECTION              BLUR                    SHARPEN
(vertical edges)            (averaging)             (enhance details)

┌────┬────┬────┐           ┌─────┬─────┬─────┐    ┌────┬────┬────┐
│ -1 │  0 │  1 │           │ 1/9 │ 1/9 │ 1/9 │    │  0 │ -1 │  0 │
├────┼────┼────┤           ├─────┼─────┼─────┤    ├────┼────┼────┤
│ -1 │  0 │  1 │           │ 1/9 │ 1/9 │ 1/9 │    │ -1 │  5 │ -1 │
├────┼────┼────┤           ├─────┼─────┼─────┤    ├────┼────┼────┤
│ -1 │  0 │  1 │           │ 1/9 │ 1/9 │ 1/9 │    │  0 │ -1 │  0 │
└────┴────┴────┘           └─────┴─────┴─────┘    └────┴────┴────┘
```

In a CNN, you don't design these filters by hand. The network LEARNS
them through backpropagation. Early layers typically learn edge detectors.
Deeper layers learn more complex patterns.

---

## Why CNNs Work: Two Key Insights

### 1. Parameter Sharing

The same kernel slides across the ENTIRE image. Instead of learning
separate parameters for each position, one small kernel (e.g., 3x3 = 9
parameters) covers the whole image.

```
Fully connected (784 → 256):  200,704 parameters
Conv layer (3×3 kernel, 32 filters): 3 × 3 × 32 = 288 parameters

That's 700x fewer parameters!
```

**Analogy:** Instead of hiring one inspector per square meter of a
factory floor (fully connected), you hire one inspector who walks
the entire floor (convolution). Same inspection quality, far fewer
employees.

### 2. Spatial Hierarchy

Each layer detects increasingly complex patterns by combining the
patterns detected by the previous layer:

```
Layer 1:  Edges        ─, |, /, \
Layer 2:  Textures     ═══, |||, ╳╳╳
Layer 3:  Parts        eye, nose, ear
Layer 4:  Objects      face, car, dog

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  ─  │  \ │     │ ╔═╗  ╱╲ │     │  👁  👃  │     │   😀     │
│  |  │  / │     │ ║ ║  ╲╱ │     │  👂  👄  │     │   🐕     │
│  edges   │     │ textures │     │  parts   │     │ objects  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     └──combines──→──┘└──combines──→──┘└──combines──→──┘
```

---

## Pooling — Summarizing Regions

After convolution, pooling reduces the spatial dimensions by summarizing
small regions. The most common is **max pooling**.

```
Feature Map (4×4):                After Max Pooling (2×2, stride 2):

┌───┬───┬───┬───┐               ┌───┬───┐
│ 1 │ 3 │ 2 │ 1 │               │ 4 │ 6 │    max of top-left 2×2 = 4
├───┼───┼───┼───┤               ├───┼───┤    max of top-right 2×2 = 6
│ 4 │ 2 │ 6 │ 4 │               │ 8 │ 5 │    max of bottom-left 2×2 = 8
├───┼───┼───┼───┤               └───┴───┘    max of bottom-right 2×2 = 5
│ 8 │ 1 │ 3 │ 5 │
├───┼───┼───┼───┤
│ 2 │ 7 │ 1 │ 3 │
└───┴───┴───┴───┘
```

**Why pool?**
- Reduces computation (fewer numbers to process in later layers)
- Provides translation invariance (a feature detected at pixel 10,10
  vs 11,11 gives the same pooled result)
- Forces the network to focus on "what" not "where"

**Analogy:** Reading a paragraph and summarizing it in one sentence.
You keep the key points and drop the details.

---

## A Complete CNN Architecture

```
Input Image (1×28×28)          ← grayscale MNIST digit
        │
        ▼
┌─────────────────┐
│ Conv2d(1→32, 3×3)│           ← 32 filters, each 3×3
│ ReLU             │           ← activation
│ MaxPool2d(2×2)   │           ← shrink spatial dimensions by half
└─────────────────┘
        │  output: 32×13×13
        ▼
┌─────────────────┐
│ Conv2d(32→64, 3×3)│          ← 64 filters, each 3×3×32
│ ReLU              │
│ MaxPool2d(2×2)    │
└─────────────────┘
        │  output: 64×5×5
        ▼
┌─────────────────┐
│ Flatten           │           ← reshape to 1D: 64×5×5 = 1600
│ Linear(1600→128)  │           ← fully connected
│ ReLU              │
│ Linear(128→10)    │           ← 10 digit classes
└─────────────────┘
        │
        ▼
    Output (10 scores, one per digit)
```

### The Dimension Math

Understanding how dimensions change through a CNN:

```
Input:           1 × 28 × 28    (channels × height × width)

Conv2d(1,32,3):  32 × 26 × 26   (28 - 3 + 1 = 26)
MaxPool2d(2):    32 × 13 × 13   (26 / 2 = 13)

Conv2d(32,64,3): 64 × 11 × 11   (13 - 3 + 1 = 11)
MaxPool2d(2):    64 × 5 × 5     (11 / 2 = 5, rounded down)

Flatten:         1600            (64 × 5 × 5)
Linear(1600,128):128
Linear(128,10):  10
```

Formula: output_size = (input_size - kernel_size + 2*padding) / stride + 1

With padding=1, stride=1, kernel=3: output_size = input_size (dimensions preserved).

---

## Padding and Stride

### Padding

Adding zeros around the border of the input so the output has the same
spatial dimensions as the input.

```
Without padding (3×3 kernel on 5×5 input → 3×3 output):
  The kernel can only fit in 3 positions horizontally and vertically.

With padding=1 (add 1 row/col of zeros on each side):
  5×5 input → 7×7 padded → 3×3 kernel → 5×5 output (same size!)

┌───┬───┬───┬───┬───┬───┬───┐
│ 0 │ 0 │ 0 │ 0 │ 0 │ 0 │ 0 │  ← padded zeros
├───┼───┼───┼───┼───┼───┼───┤
│ 0 │ 1 │ 0 │ 1 │ 0 │ 1 │ 0 │
├───┼───┼───┼───┼───┼───┼───┤
│ 0 │ 0 │ 1 │ 1 │ 1 │ 0 │ 0 │  ← original data in the middle
├───┼───┼───┼───┼───┼───┼───┤
│ 0 │ 1 │ 1 │ 0 │ 1 │ 1 │ 0 │
├───┼───┼───┼───┼───┼───┼───┤
│ 0 │ 0 │ 0 │ 1 │ 0 │ 0 │ 0 │
├───┼───┼───┼───┼───┼───┼───┤
│ 0 │ 1 │ 0 │ 0 │ 1 │ 0 │ 0 │
├───┼───┼───┼───┼───┼───┼───┤
│ 0 │ 0 │ 0 │ 0 │ 0 │ 0 │ 0 │  ← padded zeros
└───┴───┴───┴───┴───┴───┴───┘
```

### Stride

How far the kernel moves at each step. Stride=1 moves one pixel at a
time. Stride=2 skips every other position, halving the output size.

```
Stride=1:  Check every position.        Output ≈ same size
Stride=2:  Check every other position.  Output ≈ half size
```

---

## A Brief History of CNN Architectures

| Year | Architecture | Key Innovation | Depth |
|------|-------------|---------------|-------|
| 1998 | LeNet-5 | First successful CNN (handwritten digits) | 5 layers |
| 2012 | AlexNet | Won ImageNet, proved deep CNNs work, used GPUs | 8 layers |
| 2014 | VGG | Simple architecture: just stack 3×3 convolutions | 16-19 layers |
| 2014 | GoogLeNet | Inception modules (parallel filters of different sizes) | 22 layers |
| 2015 | ResNet | Skip connections (solved vanishing gradient for deep nets) | 152 layers |

The trend: deeper networks with clever tricks to make depth work.

---

## Building a CNN in PyTorch

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

train_dataset = datasets.MNIST(root='./data', train=True, download=True, transform=transform)
test_dataset = datasets.MNIST(root='./data', train=False, download=True, transform=transform)
train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
test_loader = DataLoader(test_dataset, batch_size=1000, shuffle=False)


class MNISTConvNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv_layers = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
        )
        self.fc_layers = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64 * 7 * 7, 128),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(128, 10),
        )

    def forward(self, x):
        x = self.conv_layers(x)
        x = self.fc_layers(x)
        return x


model = MNISTConvNet().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

total_params = sum(p.numel() for p in model.parameters())
print(f"Total parameters: {total_params:,}")


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


for epoch in range(5):
    train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer)
    test_acc = evaluate(model, test_loader)
    print(f"Epoch {epoch+1} | Loss: {train_loss:.4f} | "
          f"Train: {train_acc:.2%} | Test: {test_acc:.2%}")
```

Expected output:

```
Total parameters: 421,642
Epoch 1 | Loss: 0.1542 | Train: 95.32% | Test: 98.57%
Epoch 2 | Loss: 0.0523 | Train: 98.39% | Test: 98.96%
Epoch 3 | Loss: 0.0373 | Train: 98.83% | Test: 99.09%
Epoch 4 | Loss: 0.0287 | Train: 99.08% | Test: 99.12%
Epoch 5 | Loss: 0.0236 | Train: 99.23% | Test: 99.17%
```

The CNN reaches ~99.2% accuracy compared to ~97.9% for the fully
connected network in Lesson 09 — with FEWER parameters.

---

## CNN vs Fully Connected — A Direct Comparison

| Property | Fully Connected (Lesson 09) | CNN (This Lesson) |
|----------|---------------------------|-------------------|
| Parameters | ~200K | ~420K (but scales much better) |
| Test Accuracy (MNIST) | ~97.9% | ~99.2% |
| Spatial awareness | None (pixels are shuffled) | Yes (preserves 2D structure) |
| Scales to large images | No (params explode) | Yes (kernel size stays small) |
| Translation invariant | No | Yes (same kernel everywhere) |

---

## Key Takeaways

1. **Images are grids of numbers** — pixel values arranged in a matrix.
2. **Convolution** slides a small kernel across the image, computing
   weighted sums. This preserves spatial structure.
3. **Filters are learned** — the network discovers edge detectors,
   texture detectors, and more through backpropagation.
4. **Pooling** shrinks spatial dimensions and provides translation
   invariance.
5. **CNNs build a hierarchy** — edges combine into textures, textures
   into parts, parts into objects.
6. **Parameter sharing** makes CNNs vastly more efficient than fully
   connected layers for image data.
7. **Padding** preserves spatial dimensions. **Stride** controls how
   much the output shrinks.

---

## Exercises

1. **Visualization:** After training the CNN, extract and visualize
   the 32 learned kernels from the first conv layer. Are any of them
   recognizable as edge detectors? (Hint: `model.conv_layers[0].weight.data`)

2. **Architecture experiment:** Add a third conv layer
   `Conv2d(64, 128, 3, padding=1)` with ReLU and MaxPool. What
   happens to the dimensions? Adjust the fully connected layer
   accordingly. Does accuracy improve?

3. **Without pooling:** Remove the MaxPool2d layers (and adjust the
   linear layer input size). How does performance change? Why is the
   model much larger?

4. **Fashion MNIST:** Swap `datasets.MNIST` for `datasets.FashionMNIST`.
   Can you beat 90% accuracy? Try adding batch normalization
   (`nn.BatchNorm2d`) after each conv layer.

5. **Stride vs pooling:** Replace MaxPool2d(2) with
   `Conv2d(stride=2)` (strided convolution). Compare results. Modern
   architectures often prefer strided convolutions over pooling.

---

Next: [Lesson 11 — RNNs and LSTMs: Learning from Sequences](./11-rnns-lstms.md)
