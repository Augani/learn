# Lesson 05 — CNNs Revisited

## From Filters to Learning

In Lesson 03 you hand-designed kernels. In Lesson 04 you hand-designed
feature pipelines. CNNs automate both — they learn the kernels AND the
classifier simultaneously from data.

Think of a CNN as a factory assembly line. Raw materials (pixels) enter one
end. Each station (layer) transforms them. Finished products (predictions)
come out the other end.

## Convolution Layer — The Core

A conv layer has multiple learnable kernels. Each kernel produces one
**feature map**.

```
  Input: 1 channel (grayscale)     3 kernels      3 feature maps
  +================+             +---+ +---+ +---+  +===+ +===+ +===+
  |                |      *      |K1 | |K2 | |K3 |  |F1 | |F2 | |F3 |
  |   28 x 28     |             +---+ +---+ +---+  +===+ +===+ +===+
  |                |              3x3   3x3   3x3    26x26 each
  +================+

  Input: C channels, K kernels, each kernel is (C x kH x kW)
  Output: K feature maps
```

```python
import torch
import torch.nn as nn

conv = nn.Conv2d(in_channels=1, out_channels=16, kernel_size=3, padding=1)

x = torch.randn(1, 1, 28, 28)
out = conv(x)
print(out.shape)
```

## Output Size Formula

```
  Output size = floor((Input + 2*Padding - Kernel) / Stride) + 1

  Example: Input=28, Kernel=3, Padding=1, Stride=1
  = floor((28 + 2 - 3) / 1) + 1
  = 28

  Example: Input=28, Kernel=3, Padding=0, Stride=2
  = floor((28 + 0 - 3) / 2) + 1
  = 13
```

## Padding and Stride

```
  No padding, stride=1         Padding=1, stride=1       Stride=2, no padding
  Input: 5x5, Kernel: 3x3     Input: 5x5, Kernel: 3x3   Input: 6x6, Kernel: 3x3

  +---+---+---+---+---+       0 0 0 0 0 0 0              +---+---+---+---+---+---+
  | * | * | * |   |   |       0|*|*|*|  |  |0             | * | * | * |   |   |   |
  +---+---+---+---+---+       0|*|*|*|  |  |0             +---+---+---+---+---+---+
  | * | * | * |   |   |       0|*|*|*|  |  |0             |   |   |   |   |   |   |
  +---+---+---+---+---+       0|  |  |  |  |  |0          +---+---+---+---+---+---+
  | * | * | * |   |   |       0|  |  |  |  |  |0          | * | * | * |   |   |   |
  +---+---+---+---+---+       0 0 0 0 0 0 0              +---+---+---+---+---+---+
  |   |   |   |   |   |                                   |   |   |   |   |   |   |
  +---+---+---+---+---+       Output: 5x5 (same!)         +---+---+---+---+---+---+
  |   |   |   |   |   |                                   | * | * | * |   |   |   |
  +---+---+---+---+---+                                   +---+---+---+---+---+---+
                                                          |   |   |   |   |   |   |
  Output: 3x3                                             +---+---+---+---+---+---+

                                                          Output: 2x2 (halved!)
```

## Pooling — Downsampling

Pooling reduces spatial size, making computation cheaper and features more
robust to small shifts.

```
  Max Pooling (2x2, stride=2)

  +----+----+----+----+        +----+----+
  |  1 |  3 |  5 |  2 |       |  4 |  6 |   Take the max from
  +----+----+----+----+  -->   +----+----+   each 2x2 block
  |  4 |  2 |  6 |  1 |       |  8 |  7 |
  +----+----+----+----+        +----+----+
  |  8 |  5 |  7 |  3 |
  +----+----+----+----+
  |  1 |  0 |  2 |  4 |
  +----+----+----+----+

  Average Pooling: take the mean instead of max
  Global Average Pooling: average entire feature map to 1 value
```

```python
pool = nn.MaxPool2d(kernel_size=2, stride=2)
x = torch.randn(1, 16, 28, 28)
out = pool(x)
print(out.shape)
```

## Receptive Field

The receptive field is how much of the original image each output neuron
"sees." It grows with depth.

```
  Layer 1 (3x3 conv): each neuron sees 3x3 pixels
  Layer 2 (3x3 conv): each neuron sees 5x5 pixels (3+2)
  Layer 3 (3x3 conv): each neuron sees 7x7 pixels (5+2)
  After 2x2 pool:     receptive field doubles

  +-------+     +---------+     +-----------+
  | 3 x 3 | --> | 5 x 5   | --> | 7 x 7     |
  | sees   |    | sees     |    | sees       |
  +-------+     +---------+     +-----------+
  Layer 1        Layer 2         Layer 3

  Deeper layers see bigger patterns:
  L1: edges        L2: textures      L3: parts of objects
```

## Batch Normalization

BatchNorm normalizes activations within each mini-batch. It's like
recalibrating instruments between measurements.

```python
class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = nn.Conv2d(in_ch, out_ch, 3, padding=1)
        self.bn = nn.BatchNorm2d(out_ch)
        self.relu = nn.ReLU()

    def forward(self, x):
        return self.relu(self.bn(self.conv(x)))
```

## Building a CNN from Scratch

```python
class SimpleCNN(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.features = nn.Sequential(
            ConvBlock(3, 32),
            nn.MaxPool2d(2),
            ConvBlock(32, 64),
            nn.MaxPool2d(2),
            ConvBlock(64, 128),
            nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128, num_classes),
        )

    def forward(self, x):
        x = self.features(x)
        return self.classifier(x)

model = SimpleCNN(num_classes=10)
dummy = torch.randn(2, 3, 32, 32)
print(model(dummy).shape)
```

## Visualizing Feature Maps

```python
def get_feature_maps(model, image_tensor):
    activations = []

    def hook_fn(module, input, output):
        activations.append(output.detach())

    hooks = []
    for layer in model.features:
        if isinstance(layer, ConvBlock):
            hooks.append(layer.register_forward_hook(hook_fn))

    with torch.no_grad():
        model(image_tensor.unsqueeze(0))

    for h in hooks:
        h.remove()

    return activations
```

## Architecture Design Rules of Thumb

```
  +-----------------------------------------------------------+
  | RULE                           | WHY                      |
  +-----------------------------------------------------------+
  | Double channels when halving   | Keeps computation        |
  | spatial size                   | roughly constant         |
  +-----------------------------------------------------------+
  | Use 3x3 kernels               | Two 3x3 = one 5x5 with  |
  |                                | fewer parameters         |
  +-----------------------------------------------------------+
  | BatchNorm after every conv     | Faster training,         |
  |                                | better gradients         |
  +-----------------------------------------------------------+
  | ReLU after BatchNorm           | Standard ordering        |
  +-----------------------------------------------------------+
  | Global avg pool before FC      | No fixed input size      |
  |                                | needed                   |
  +-----------------------------------------------------------+
  | Dropout in classifier only     | Regularize the FC layers |
  +-----------------------------------------------------------+
```

## Parameter Counting

```python
def count_params(model):
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Total:     {total:,}")
    print(f"Trainable: {trainable:,}")

count_params(model)
```

A Conv2d(64, 128, 3) has `64 * 128 * 3 * 3 + 128 = 73,856` parameters.
Formula: `in_ch * out_ch * kH * kW + out_ch` (the `+ out_ch` is the bias).

## Exercises

1. Build a CNN that classifies CIFAR-10 to >70% accuracy. Use only Conv2d,
   BatchNorm2d, ReLU, MaxPool2d, and Linear. Train for 20 epochs.

2. Calculate the receptive field after 5 stacked 3x3 convolutions with no
   pooling. Then recalculate with a 2x2 max pool after layer 3.

3. Visualize the feature maps of your trained model's first and last conv
   layers. What differences do you see?

4. Compare two architectures on CIFAR-10: one with 3x3 kernels only, one
   with a mix of 3x3 and 5x5. Which trains faster? Which gets better
   accuracy?

5. Modify `SimpleCNN` to accept variable input sizes by replacing fixed
   pooling with `AdaptiveAvgPool2d`. Verify it works with 32x32, 64x64,
   and 128x128 inputs.

---

**Next: [Lesson 06 — Classic Architectures](06-classic-architectures.md)**
