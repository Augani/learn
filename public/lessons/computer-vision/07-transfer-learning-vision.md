# Lesson 07 — Transfer Learning for Vision

## The Language Analogy

Learning French from scratch takes years. But if you already speak Spanish,
you can leverage shared vocabulary, grammar patterns, and Latin roots to
learn faster. Transfer learning is the same idea — a model trained on
ImageNet already knows edges, textures, and shapes. You just teach it
your specific task.

## Two Strategies

```
  Strategy 1: Feature Extraction         Strategy 2: Fine-Tuning

  +==============+  FROZEN               +==============+  UNFROZEN
  | Pretrained   |  (no gradient)        | Pretrained   |  (small lr)
  | Conv Layers  |                       | Conv Layers  |
  +==============+                       +==============+
         |                                      |
  +------+-------+  TRAINABLE            +------+-------+  TRAINABLE
  | New FC Head  |  (normal lr)          | New FC Head  |  (normal lr)
  +--------------+                       +--------------+

  Use when:                              Use when:
  - Small dataset (<1K images)           - Medium dataset (1K-100K)
  - Task similar to ImageNet             - Task differs from ImageNet
  - Quick results needed                 - Accuracy matters most
```

## Feature Extraction

Freeze the pretrained backbone. Only train a new classification head.

```python
import torch
import torch.nn as nn
import torchvision.models as models

backbone = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)

for param in backbone.parameters():
    param.requires_grad = False

num_features = backbone.fc.in_features
backbone.fc = nn.Sequential(
    nn.Linear(num_features, 256),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(256, 5),
)

trainable = sum(p.numel() for p in backbone.parameters() if p.requires_grad)
total = sum(p.numel() for p in backbone.parameters())
print(f"Training {trainable:,} of {total:,} parameters")
```

## Fine-Tuning

Unfreeze all or part of the backbone. Train everything with a small learning
rate to avoid destroying pretrained knowledge.

```python
model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)

num_features = model.fc.in_features
model.fc = nn.Sequential(
    nn.Linear(num_features, 256),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(256, 5),
)

optimizer = torch.optim.Adam([
    {"params": model.layer4.parameters(), "lr": 1e-4},
    {"params": model.fc.parameters(), "lr": 1e-3},
], weight_decay=1e-4)
```

## Discriminative Learning Rates

Different layers need different learning rates. Early layers (general
features) should change slowly. Later layers (task-specific) can change
faster.

```
  +================+    lr = 1e-6    (barely move)
  | Conv Layers 1-3|
  +================+
         |
  +================+    lr = 1e-5
  | Conv Layer 4   |
  +================+
         |
  +================+    lr = 1e-3    (learn fast)
  | New FC Head    |
  +================+
```

```python
param_groups = [
    {"params": model.conv1.parameters(), "lr": 1e-6},
    {"params": model.layer1.parameters(), "lr": 1e-6},
    {"params": model.layer2.parameters(), "lr": 1e-5},
    {"params": model.layer3.parameters(), "lr": 1e-5},
    {"params": model.layer4.parameters(), "lr": 1e-4},
    {"params": model.fc.parameters(), "lr": 1e-3},
]
optimizer = torch.optim.Adam(param_groups, weight_decay=1e-4)
```

## Gradual Unfreezing

Start with feature extraction. Then unfreeze layers one at a time from top
to bottom:

```
  Epoch 1-3:    Only FC head trains
  Epoch 4-6:    Unfreeze layer4 + FC
  Epoch 7-10:   Unfreeze layer3 + layer4 + FC
  Epoch 11+:    Everything unfrozen
```

```python
def unfreeze_from(model, layer_name):
    found = False
    for name, param in model.named_parameters():
        if layer_name in name:
            found = True
        param.requires_grad = found
```

## Data Pipeline for Transfer Learning

Pretrained models expect specific preprocessing:

```python
import torchvision.transforms as T
from torchvision.datasets import ImageFolder
from torch.utils.data import DataLoader

train_transform = T.Compose([
    T.RandomResizedCrop(224),
    T.RandomHorizontalFlip(),
    T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]),
])

val_transform = T.Compose([
    T.Resize(256),
    T.CenterCrop(224),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]),
])

train_dataset = ImageFolder("data/train", transform=train_transform)
val_dataset = ImageFolder("data/val", transform=val_transform)

train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True,
                          num_workers=4, pin_memory=True)
val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False,
                        num_workers=4, pin_memory=True)
```

## Training Loop

```python
def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, predicted = outputs.max(1)
        correct += predicted.eq(labels).sum().item()
        total += labels.size(0)

    return running_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        loss = criterion(outputs, labels)

        running_loss += loss.item() * images.size(0)
        _, predicted = outputs.max(1)
        correct += predicted.eq(labels).sum().item()
        total += labels.size(0)

    return running_loss / total, correct / total
```

## Which Backbone to Choose?

```
  +----------------+--------+---------+----------+---------+
  | Model          | Params | Speed   | Accuracy | Memory  |
  +----------------+--------+---------+----------+---------+
  | ResNet-18      |  11M   | Fast    | Good     | Low     |
  | ResNet-50      |  25M   | Medium  | Great    | Medium  |
  | EfficientNet-B0|   5M   | Fast    | Great    | Low     |
  | EfficientNet-B4|  19M   | Medium  | Excellent| Medium  |
  | ConvNeXt-Tiny  |  28M   | Medium  | Excellent| Medium  |
  | ViT-B/16       |  86M   | Slow    | Excellent| High    |
  +----------------+--------+---------+----------+---------+

  Rule of thumb:
  - Quick prototype?     -> ResNet-18
  - Production quality?  -> EfficientNet-B4 or ConvNeXt
  - State of the art?    -> ViT (needs more data)
```

## Common Pitfalls

```
  MISTAKE                         FIX
  +---------------------------------+----------------------------------+
  | Forgetting to set eval mode     | model.eval() before inference    |
  | Using wrong normalization       | Must match pretrained model      |
  | Training too long frozen        | Unfreeze after 3-5 epochs       |
  | Learning rate too high          | Start at 1e-4 for fine-tuning   |
  | No data augmentation            | Always augment small datasets   |
  | Training on test set            | Keep test set completely hidden |
  +---------------------------------+----------------------------------+
```

## Exercises

1. Download a small dataset (Flowers102, Food101, or OxfordPets from
   torchvision). Train a classifier using ResNet-50 as a frozen feature
   extractor. Report accuracy.

2. Now fine-tune the same ResNet-50 with discriminative learning rates.
   Compare accuracy and training time to exercise 1.

3. Implement gradual unfreezing. Plot validation accuracy vs. epoch. Mark
   the epochs where you unfroze each layer group.

4. Compare three backbones (ResNet-18, EfficientNet-B0, ConvNeXt-Tiny) on
   the same dataset. Measure accuracy, training time, and inference time.
   Which offers the best tradeoff?

5. Extract features from the pretrained backbone (without the FC head) for
   your entire dataset. Save them as a NumPy array. Train a simple sklearn
   SVM or LogisticRegression on these features. How does it compare to
   end-to-end training?

---

**Next: [Lesson 08 — Object Detection](08-object-detection.md)**
