# Lesson 04: Data Augmentation

> **Analogy**: You only have 10 photos of your dog. But you can
> flip them, crop them, change the brightness, rotate them -- now
> you have 100 slightly different views. Your brain still recognizes
> the dog in all of them. Data augmentation teaches a model to do
> the same.

---

## Why Augmentation Works

```
Without augmentation:            With augmentation:

Model sees:                      Model sees:
  [cat photo #1]  x 100 epochs    [cat photo #1, flipped]
  [cat photo #2]  x 100 epochs    [cat photo #1, rotated]
  [cat photo #3]  x 100 epochs    [cat photo #1, darker]
                                   [cat photo #1, cropped]
  Memorizes 3 photos               ... different every epoch
  Fails on photo #4
                                   Learns "cat-ness"
                                   Works on photo #4!
```

Augmentation is **free data**. It doesn't replace having more
real data, but it can double or triple effective dataset size.

---

## Image Augmentation Basics

```
Original    Flip H     Rotate     Crop       Color Jitter
+------+   +------+   +------+   +------+   +------+
|  /\  |   |  /\  |   | /   /|   | /\  |   |  /\  |
| /  \ |   | /  \ |   |/   / |   |/  \ |   | /  \ |
|/    \|   |/    \|   |   /  |   |    \|   |/    \|
+------+   +------+   +------+   +------+   +------+
             <-->        15deg    center     brightness
                                  crop       saturation
```

```python
from torchvision import transforms

train_transform = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(15),
    transforms.ColorJitter(
        brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1
    ),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

val_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])
```

> **Important**: Never augment validation/test data. You want
> to evaluate on clean, consistent images.

---

## Augmentation Strength Guide

```
+---------------------+--------+----------+--------+
| Technique           | Mild   | Medium   | Strong |
+---------------------+--------+----------+--------+
| RandomCrop scale    | 0.9-1  | 0.7-1    | 0.5-1  |
| HorizontalFlip      | p=0.5  | p=0.5    | p=0.5  |
| Rotation            | 5 deg  | 15 deg   | 30 deg |
| ColorJitter bright  | 0.1    | 0.2      | 0.4    |
| Gaussian Blur       | --     | sigma 0.5| sigma 1|
| Erasing             | --     | p=0.1    | p=0.3  |
+---------------------+--------+----------+--------+

Small dataset (< 1k):   Use STRONG augmentation
Medium dataset (1-10k):  Use MEDIUM augmentation
Large dataset (10k+):    Use MILD augmentation
```

---

## Advanced: RandAugment

Instead of hand-picking transforms, RandAugment randomly
applies N transforms from a pool, each at magnitude M.

```
Pool of 14 transforms:
  [rotate, shear_x, shear_y, translate_x, translate_y,
   brightness, contrast, sharpness, color, posterize,
   solarize, equalize, auto_contrast, invert]

Each step: pick N random transforms, apply at magnitude M

N=2, M=9:  "Apply 2 random transforms at medium-high strength"
```

```python
from torchvision.transforms import v2

train_transform = v2.Compose([
    v2.RandomResizedCrop(224),
    v2.RandAugment(num_ops=2, magnitude=9),
    v2.ToTensor(),
    v2.Normalize(mean=[0.485, 0.456, 0.406],
                 std=[0.229, 0.224, 0.225]),
])
```

---

## Advanced: CutOut and Random Erasing

Randomly erase a rectangle in the image. Forces the model
to not rely on any single region.

```
Original:          CutOut:            Random Erasing:
+----------+       +----------+       +----------+
|  [cat]   |       |  [c  ]   |       |  [cat]   |
|  face    |       |  fa##    |       |  face    |
|  body    |       |  bo##    |       |  b###    |
|  tail    |       |  tail    |       |  t###    |
+----------+       +----------+       +----------+
                   Fixed gray          Random noise
                   square              rectangle
```

```python
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
    transforms.RandomErasing(p=0.3, scale=(0.02, 0.33)),
])
```

---

## Advanced: MixUp and CutMix

Combine two training samples into one.

```
MixUp (blend two images):

  Image A (cat, label=1)     Image B (dog, label=0)
  +----------+               +----------+
  |  [cat]   |    lambda=0.7 |  [dog]   |
  +----------+               +----------+
         \                    /
          \                  /
           v                v
       +----------+
       | blurred  |   label = 0.7*cat + 0.3*dog
       | mix      |
       +----------+


CutMix (paste a patch):

  Image A (cat)              Image B (dog)
  +----------+               +----------+
  |  [cat]   |               |  [dog]   |
  +----------+               +----------+
         \                    /
          v                  v
       +----------+
       |  [cat]   |   label = 0.75*cat + 0.25*dog
       |  [d##]   |   (25% of area is from Image B)
       +----------+
```

```python
import torch


def mixup_data(x, y, alpha=0.2):
    lam = torch.distributions.Beta(alpha, alpha).sample()
    batch_size = x.size(0)
    index = torch.randperm(batch_size, device=x.device)

    mixed_x = lam * x + (1 - lam) * x[index]
    y_a, y_b = y, y[index]
    return mixed_x, y_a, y_b, lam


def mixup_criterion(criterion, pred, y_a, y_b, lam):
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)


for images, labels in train_loader:
    mixed_images, labels_a, labels_b, lam = mixup_data(images, labels)
    outputs = model(mixed_images)
    loss = mixup_criterion(criterion, outputs, labels_a, labels_b, lam)
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()
```

---

## Text Augmentation

Images aren't the only thing you can augment.

```
+----------------------+-----------------------------------+
| Technique            | Example                           |
+----------------------+-----------------------------------+
| Synonym replacement  | "happy cat" -> "joyful cat"       |
+----------------------+-----------------------------------+
| Random insertion     | "the cat sat" -> "the small cat   |
|                      |  sat"                             |
+----------------------+-----------------------------------+
| Random swap          | "the cat sat" -> "cat the sat"    |
+----------------------+-----------------------------------+
| Random deletion      | "the big cat sat" -> "the cat sat"|
+----------------------+-----------------------------------+
| Back-translation     | EN->FR->EN: "I like dogs" ->      |
|                      | "I love dogs"                     |
+----------------------+-----------------------------------+
```

```python
import random


def random_swap(words, n=1):
    new_words = words.copy()
    for _ in range(n):
        if len(new_words) < 2:
            break
        idx1, idx2 = random.sample(range(len(new_words)), 2)
        new_words[idx1], new_words[idx2] = new_words[idx2], new_words[idx1]
    return new_words


def random_deletion(words, p=0.1):
    if len(words) == 1:
        return words
    return [w for w in words if random.random() > p] or [random.choice(words)]


sentence = "the quick brown fox jumps over the lazy dog"
words = sentence.split()

swapped = random_swap(words, n=2)
deleted = random_deletion(words, p=0.2)

print("Original:", sentence)
print("Swapped: ", " ".join(swapped))
print("Deleted: ", " ".join(deleted))
```

---

## Augmentation for Tabular Data

```
+----------------------+-----------------------------------+
| Technique            | How It Works                      |
+----------------------+-----------------------------------+
| Gaussian noise       | Add small noise to numeric cols   |
+----------------------+-----------------------------------+
| Feature dropout      | Randomly zero out some features   |
+----------------------+-----------------------------------+
| SMOTE                | Generate synthetic minority       |
|                      | samples for imbalanced classes    |
+----------------------+-----------------------------------+
```

```python
def add_gaussian_noise(x, std=0.01):
    noise = torch.randn_like(x) * std
    return x + noise


def feature_dropout(x, p=0.1):
    mask = torch.bernoulli(torch.full_like(x, 1 - p))
    return x * mask
```

---

## The Augmentation Pipeline Decision Tree

```
WHAT DATA TYPE?
|
+-- Images
|   |
|   +-- Small dataset --> Strong augmentation + CutMix
|   +-- Medium dataset --> RandAugment(2, 9)
|   +-- Large dataset --> Mild flips + crops
|
+-- Text
|   |
|   +-- Classification --> Synonym replace + back-translate
|   +-- Generation --> Usually don't augment
|
+-- Tabular
|   |
|   +-- Imbalanced --> SMOTE
|   +-- Balanced --> Light Gaussian noise
|
+-- Audio
    |
    +-- Time stretch + pitch shift + noise injection
```

---

## albumentations: The Power Tool

For serious image augmentation, use albumentations -- it's
faster and more flexible than torchvision transforms.

```python
import albumentations as A
from albumentations.pytorch import ToTensorV2

train_transform = A.Compose([
    A.RandomResizedCrop(224, 224, scale=(0.7, 1.0)),
    A.HorizontalFlip(p=0.5),
    A.ShiftScaleRotate(
        shift_limit=0.1,
        scale_limit=0.2,
        rotate_limit=15,
        p=0.5,
    ),
    A.OneOf([
        A.GaussianBlur(blur_limit=3),
        A.GaussNoise(var_limit=(10, 50)),
    ], p=0.3),
    A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
    A.CoarseDropout(
        max_holes=8, max_height=16, max_width=16, p=0.3
    ),
    A.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]),
    ToTensorV2(),
])
```

---

## Exercises

1. **Augmentation ablation**: Train a ResNet-18 on CIFAR-10 with
   (a) no augmentation, (b) only flips, (c) flips + crops,
   (d) RandAugment. Chart the accuracy differences.

2. **MixUp implementation**: Implement MixUp training from scratch.
   Compare validation accuracy to standard training on a small
   dataset (use STL-10 with only 500 samples per class).

3. **CutMix implementation**: Implement CutMix. Compare it to
   MixUp. Which works better on your dataset?

4. **Text augmentation**: Write a text augmentation pipeline using
   synonym replacement and random deletion. Test it on a sentiment
   classification task with only 100 labeled examples.

5. **Augmentation too strong**: Deliberately over-augment CIFAR-10
   (rotation=90, heavy color jitter, erasing p=0.8). Show that
   the model underfits. Find the sweet spot.

---

**Next**: [Lesson 05 - Autoencoders & VAEs](./05-autoencoders-vaes.md)
