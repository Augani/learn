# Lesson 09 — Semantic Segmentation

## The Coloring Book Analogy

Detection draws boxes around objects. Segmentation colors in every pixel.
It's like a coloring book — each region gets its own color, and you stay
perfectly inside the lines.

```
  Input Photo              Detection              Segmentation

  +=================+    +=================+    +=================+
  |  sky            |    |  +---------+    |    |  SSSSSSSSSSSSS  |
  |   ___           |    |  |  tree   |    |    |  SSTTTTTTTSSS   |
  |  /   \          |    |  +---------+    |    |  STTTTTTTTSS    |
  | | tree|         |    |                 |    |  STTTTTTTTS     |
  |  \___/          |    |  +---------+    |    |  GGGGGGGGGGGG   |
  |  grass          |    |  |  grass  |    |    |  GGGGCCCGGGGG   |
  |      ___        |    |  +---------+    |    |  GGGCCCCGGGG    |
  |     | c |       |    |                 |    |  GGGGGGGGGGG    |
  +=================+    +=================+    +=================+

  S=sky  T=tree  G=grass  C=car
  Every single pixel gets a class label.
```

## How It Works

The network outputs a class prediction for every pixel. If the input is
H x W and there are C classes, the output is C x H x W — a probability
map for each class.

```
  Input: (3, 512, 512)
         |
    Encoder (downsample, extract features)
         |
    Decoder (upsample, recover spatial detail)
         |
  Output: (C, 512, 512)
         |
    argmax across C
         |
  Prediction: (512, 512)  <-- each pixel = class index
```

## U-Net — The Workhorse

U-Net was designed for medical image segmentation where you have very few
labeled images. Its key insight: **skip connections** from encoder to decoder
preserve fine spatial details.

```
  U-Net Architecture (the "U" shape)

  Input                                          Output
  64   +--+                                +--+  64
       |  | -------- skip connection ----> |  |
  128  +--+                                +--+  128
       |  | -------- skip connection ----> |  |
  256  +--+                                +--+  256
       |  | -------- skip connection ----> |  |
  512  +--+                                +--+  512
       |  | -------- skip connection ----> |  |
  1024 +--+                                +--+  1024
            Bottleneck

  Left side:  Encoder (conv + pool = shrink spatial, grow channels)
  Right side: Decoder (upsample + conv = grow spatial, shrink channels)
  Arrows:     Skip connections (concatenate encoder features to decoder)
```

```python
import torch
import torch.nn as nn

class DoubleConv(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.net(x)


class UNet(nn.Module):
    def __init__(self, in_ch=3, num_classes=21):
        super().__init__()
        self.enc1 = DoubleConv(in_ch, 64)
        self.enc2 = DoubleConv(64, 128)
        self.enc3 = DoubleConv(128, 256)
        self.enc4 = DoubleConv(256, 512)
        self.bottleneck = DoubleConv(512, 1024)

        self.up4 = nn.ConvTranspose2d(1024, 512, 2, stride=2)
        self.dec4 = DoubleConv(1024, 512)
        self.up3 = nn.ConvTranspose2d(512, 256, 2, stride=2)
        self.dec3 = DoubleConv(512, 256)
        self.up2 = nn.ConvTranspose2d(256, 128, 2, stride=2)
        self.dec2 = DoubleConv(256, 128)
        self.up1 = nn.ConvTranspose2d(128, 64, 2, stride=2)
        self.dec1 = DoubleConv(128, 64)

        self.final = nn.Conv2d(64, num_classes, 1)
        self.pool = nn.MaxPool2d(2)

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        e4 = self.enc4(self.pool(e3))
        b = self.bottleneck(self.pool(e4))

        d4 = self.dec4(torch.cat([self.up4(b), e4], dim=1))
        d3 = self.dec3(torch.cat([self.up3(d4), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))

        return self.final(d1)

model = UNet(in_ch=3, num_classes=21)
dummy = torch.randn(1, 3, 256, 256)
print(model(dummy).shape)
```

## Upsampling Methods

The decoder needs to grow spatial dimensions. Three common approaches:

```
  Bilinear Interpolation      Transposed Convolution      Pixel Shuffle
  (nn.Upsample)               (nn.ConvTranspose2d)        (nn.PixelShuffle)

  +--+--+    +--+--+--+--+    +--+--+    +--+--+--+--+   Rearranges channels
  | A| B| -> | A| .|. | B|    | A| B| -> |  |  |  |  |   into spatial dims.
  +--+--+    +--+--+--+--+    +--+--+    +--+--+--+--+   Used more in
  | C| D|    | .| .| .| .|    | C| D|    |  |  |  |  |   super-resolution.
  +--+--+    +--+--+--+--+    +--+--+    +--+--+--+--+
             | .| .| .| .|               |  |  |  |  |
             +--+--+--+--+               +--+--+--+--+
             | C| .| .| D|               |  |  |  |  |
             +--+--+--+--+               +--+--+--+--+

  Simple, no params           Learnable, can cause         Clean, efficient
                              checkerboard artifacts
```

## DeepLab — Dilated Convolutions

DeepLab uses **atrous (dilated) convolutions** to increase the receptive
field without losing resolution.

```
  Standard 3x3 conv (rate=1)     Dilated 3x3 conv (rate=2)

  * . *                           *  .  *
  . . .                           .  .  .
  * . *                           .  .  .
                                  *  .  *
  Receptive field: 3x3            Receptive field: 5x5
                                  Same number of parameters!
```

DeepLab also uses **ASPP** (Atrous Spatial Pyramid Pooling) — parallel
dilated convolutions at different rates to capture multi-scale context.

```python
class ASPP(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv1x1 = nn.Conv2d(in_ch, out_ch, 1)
        self.conv3x3_r6 = nn.Conv2d(in_ch, out_ch, 3, padding=6, dilation=6)
        self.conv3x3_r12 = nn.Conv2d(in_ch, out_ch, 3, padding=12, dilation=12)
        self.conv3x3_r18 = nn.Conv2d(in_ch, out_ch, 3, padding=18, dilation=18)
        self.pool = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Conv2d(in_ch, out_ch, 1),
        )
        self.project = nn.Conv2d(out_ch * 5, out_ch, 1)

    def forward(self, x):
        size = x.shape[2:]
        pooled = nn.functional.interpolate(
            self.pool(x), size=size, mode="bilinear", align_corners=False
        )
        out = torch.cat([
            self.conv1x1(x),
            self.conv3x3_r6(x),
            self.conv3x3_r12(x),
            self.conv3x3_r18(x),
            pooled,
        ], dim=1)
        return self.project(out)
```

## Loss Functions for Segmentation

Standard cross-entropy, applied per-pixel:

```python
criterion = nn.CrossEntropyLoss()

pred = torch.randn(1, 21, 256, 256)
target = torch.randint(0, 21, (1, 256, 256))
loss = criterion(pred, target)
```

For imbalanced classes (background dominates), use Dice loss:

```python
def dice_loss(pred, target, num_classes, smooth=1.0):
    pred_soft = torch.softmax(pred, dim=1)
    target_onehot = nn.functional.one_hot(target, num_classes)
    target_onehot = target_onehot.permute(0, 3, 1, 2).float()

    intersection = (pred_soft * target_onehot).sum(dim=(2, 3))
    union = pred_soft.sum(dim=(2, 3)) + target_onehot.sum(dim=(2, 3))

    dice = (2 * intersection + smooth) / (union + smooth)
    return 1 - dice.mean()
```

## Metrics — mIoU

Mean Intersection over Union, computed per-class then averaged:

```
  For each class c:
    IoU_c = TP_c / (TP_c + FP_c + FN_c)

  mIoU = mean of all IoU_c
```

## Using Pretrained Segmentation Models

```python
from torchvision.models.segmentation import deeplabv3_resnet50

model = deeplabv3_resnet50(weights="DEFAULT")
model.eval()

img = torch.randn(1, 3, 520, 520)
with torch.no_grad():
    output = model(img)["out"]
    prediction = output.argmax(1).squeeze()

print(prediction.shape)
print(prediction.unique())
```

## Exercises

1. Implement the UNet class above. Train it on the Oxford-IIIT Pet dataset
   (torchvision provides it) for foreground/background segmentation. Report
   mIoU.

2. Visualize segmentation predictions as colored overlays on the original
   image. Use a different color for each class.

3. Compare bilinear upsampling vs. transposed convolution in the UNet
   decoder. Does one produce smoother boundaries?

4. Implement Dice loss and combine it with cross-entropy (0.5 * CE + 0.5 *
   Dice). Does this improve results on an imbalanced dataset?

5. Run a pretrained DeepLabV3 on 5 images. Visualize the per-class
   probability maps for the top 3 classes in each image.

---

**Next: [Lesson 10 — Instance Segmentation](10-instance-segmentation.md)**
