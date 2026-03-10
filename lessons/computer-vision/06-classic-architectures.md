# Lesson 06 — Classic Architectures

## The Evolution of Vision Networks

CNN architectures evolved like cars. LeNet was the Model T — proved the
concept works. AlexNet was the muscle car — raw power and GPUs. VGG was the
luxury sedan — elegant and uniform. ResNet was the electric vehicle —
fundamentally changed what's possible.

## Timeline

```
  1998      2012       2014      2014       2015       2016
   |         |          |         |          |          |
   v         v          v         v          v          v
  LeNet   AlexNet      VGG    GoogLeNet   ResNet    DenseNet
   5        8          19        22        152        201
  layers   layers     layers    layers    layers     layers
  60K      60M        138M       7M       25M         20M
  params   params     params    params    params     params
```

## LeNet-5 (1998) — The Pioneer

Yann LeCun built this for handwritten digit recognition. It's the ancestor
of every CNN.

```
  Input         Conv    Pool   Conv    Pool   FC    FC   Output
  32x32x1  -->  28x28  14x14  10x10   5x5   120   84    10
               x6      x6     x16    x16

  +========+   +====+  +==+  +====+  +==+  +--+  +--+  +--+
  | 32x32  |-->|5x5 |->|2x|->|5x5 |->|2x|->|FC|->|FC|->|10|
  | input  |   |conv|  |pl|  |conv|  |pl|  |  |  |  |  |  |
  +========+   +====+  +==+  +====+  +==+  +--+  +--+  +--+
```

```python
import torch.nn as nn

class LeNet5(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 6, 5),
            nn.Tanh(),
            nn.AvgPool2d(2),
            nn.Conv2d(6, 16, 5),
            nn.Tanh(),
            nn.AvgPool2d(2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(16 * 5 * 5, 120),
            nn.Tanh(),
            nn.Linear(120, 84),
            nn.Tanh(),
            nn.Linear(84, 10),
        )

    def forward(self, x):
        return self.classifier(self.features(x))
```

## AlexNet (2012) — The GPU Revolution

Won ImageNet by a landslide. Proved that deep learning + GPUs = unstoppable.

Key innovations: ReLU instead of tanh, dropout, data augmentation, GPU
training across two GPUs.

```
  Input: 224x224x3

  Conv1: 96 kernels, 11x11, stride 4  -->  55x55x96
  Pool1: 3x3, stride 2                -->  27x27x96
  Conv2: 256 kernels, 5x5, pad 2      -->  27x27x256
  Pool2: 3x3, stride 2                -->  13x13x256
  Conv3: 384 kernels, 3x3, pad 1      -->  13x13x384
  Conv4: 384 kernels, 3x3, pad 1      -->  13x13x384
  Conv5: 256 kernels, 3x3, pad 1      -->  13x13x256
  Pool3: 3x3, stride 2                -->  6x6x256
  FC1:   4096
  FC2:   4096
  FC3:   1000 (classes)
```

```python
import torchvision.models as models

alexnet = models.alexnet(weights=None)
print(alexnet)
```

## VGG (2014) — Simplicity Wins

Oxford's VGG team asked: "What if we just stack 3x3 convolutions?" The answer
was shockingly effective.

```
  VGG-16 Architecture

  Block 1:  [3x3, 64]  x2  + pool   --> 112x112x64
  Block 2:  [3x3, 128] x2  + pool   --> 56x56x128
  Block 3:  [3x3, 256] x3  + pool   --> 28x28x256
  Block 4:  [3x3, 512] x3  + pool   --> 14x14x512
  Block 5:  [3x3, 512] x3  + pool   --> 7x7x512
  FC:       4096 -> 4096 -> 1000

  Why 3x3?  Two 3x3 convs have the same receptive field as one 5x5,
  but with fewer parameters:

  Two 3x3: 2 * (3*3*C*C) = 18C^2 params
  One 5x5: 1 * (5*5*C*C) = 25C^2 params
```

## GoogLeNet / Inception (2014) — Go Wide

Instead of choosing one kernel size, use ALL of them at once.

```
  Inception Module

                     Input
          /      /       \        \
         v      v         v        v
      [1x1]  [1x1]     [1x1]   [3x3 pool]
        |    [3x3]     [5x5]     [1x1]
        v      v         v        v
         \      \       /        /
          \      \     /        /
           +------+---+--------+
                  |
            Concatenate along
            channel dimension
```

The 1x1 convolutions before 3x3 and 5x5 are **bottleneck layers** —
they reduce channels cheaply before the expensive convolution.

```python
class InceptionModule(nn.Module):
    def __init__(self, in_ch, ch1x1, ch3x3_reduce, ch3x3,
                 ch5x5_reduce, ch5x5, pool_proj):
        super().__init__()
        self.branch1 = nn.Sequential(
            nn.Conv2d(in_ch, ch1x1, 1),
            nn.ReLU(),
        )
        self.branch2 = nn.Sequential(
            nn.Conv2d(in_ch, ch3x3_reduce, 1),
            nn.ReLU(),
            nn.Conv2d(ch3x3_reduce, ch3x3, 3, padding=1),
            nn.ReLU(),
        )
        self.branch3 = nn.Sequential(
            nn.Conv2d(in_ch, ch5x5_reduce, 1),
            nn.ReLU(),
            nn.Conv2d(ch5x5_reduce, ch5x5, 5, padding=2),
            nn.ReLU(),
        )
        self.branch4 = nn.Sequential(
            nn.MaxPool2d(3, stride=1, padding=1),
            nn.Conv2d(in_ch, pool_proj, 1),
            nn.ReLU(),
        )

    def forward(self, x):
        import torch
        return torch.cat([
            self.branch1(x), self.branch2(x),
            self.branch3(x), self.branch4(x)
        ], dim=1)
```

## ResNet (2015) — Skip Connections Change Everything

The problem: very deep networks (>20 layers) performed WORSE than shallow
ones. Not because of overfitting — training loss was higher too. Gradients
were vanishing.

The fix: skip connections. Let layers learn the **residual** (the difference)
instead of the full transformation.

```
  Standard block:           Residual block:

  x --> [Conv] --> [Conv] --> out     x --+--> [Conv] --> [Conv] --> (+) --> out
                                         |                          ^
                                         |                          |
                                         +--------------------------+
                                              skip connection

  Without skip: layer must learn F(x)
  With skip:    layer learns F(x) - x  (the residual)
                output = F(x) + x

  If the optimal transformation is close to identity,
  learning "do nothing" (F(x)=0) is much easier than
  learning F(x)=x from scratch.
```

```python
class ResidualBlock(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1)
        self.bn2 = nn.BatchNorm2d(channels)
        self.relu = nn.ReLU()

    def forward(self, x):
        residual = x
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = self.relu(out + residual)
        return out
```

When dimensions change (more channels, smaller spatial size), use a 1x1
convolution in the skip connection:

```python
class ResidualBlockDown(nn.Module):
    def __init__(self, in_ch, out_ch, stride=2):
        super().__init__()
        self.conv1 = nn.Conv2d(in_ch, out_ch, 3, stride=stride, padding=1)
        self.bn1 = nn.BatchNorm2d(out_ch)
        self.conv2 = nn.Conv2d(out_ch, out_ch, 3, padding=1)
        self.bn2 = nn.BatchNorm2d(out_ch)
        self.downsample = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 1, stride=stride),
            nn.BatchNorm2d(out_ch),
        )
        self.relu = nn.ReLU()

    def forward(self, x):
        residual = self.downsample(x)
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return self.relu(out + residual)
```

## Architecture Comparison

```
  +------------+-------+--------+--------+-----------+
  | Model      | Year  | Depth  | Params | Top-5 Err |
  +------------+-------+--------+--------+-----------+
  | LeNet-5    | 1998  |   5    |  60K   |  N/A      |
  | AlexNet    | 2012  |   8    |  60M   |  16.4%    |
  | VGG-16     | 2014  |  16    | 138M   |   7.3%    |
  | GoogLeNet  | 2014  |  22    |   7M   |   6.7%    |
  | ResNet-50  | 2015  |  50    |  25M   |   3.6%    |
  | ResNet-152 | 2015  | 152    |  60M   |   3.0%    |
  +------------+-------+--------+--------+-----------+
```

## Loading Pretrained Models

```python
import torchvision.models as models

resnet50 = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
vgg16 = models.vgg16(weights=models.VGG16_Weights.DEFAULT)

resnet50.eval()
```

## Exercises

1. Implement LeNet-5 and train it on MNIST. What accuracy do you achieve?
   How fast does it train compared to a simple MLP?

2. Build a mini-VGG (3 blocks of 2 conv layers each, channels 32->64->128)
   and train on CIFAR-10. Compare to the SimpleCNN from Lesson 05.

3. Implement `ResidualBlock` and build a 10-layer ResNet for CIFAR-10.
   Compare training curves with an identical network that has no skip
   connections. At what depth does the non-residual network start struggling?

4. Count parameters for VGG-16, GoogLeNet, and ResNet-50 using the
   `count_params` function from Lesson 05. Which is most parameter-efficient?

5. Write a function that takes a model and an input tensor, then prints the
   output shape after every layer. Use `register_forward_hook`.

---

**Next: [Lesson 07 — Transfer Learning for Vision](07-transfer-learning-vision.md)**
