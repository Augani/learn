# Lesson 03: Transfer Learning

> **Analogy**: Learning Spanish when you already know French.
> You don't start from zero -- you already understand grammar,
> romance language patterns, and many similar words. You just
> need to learn the differences. Transfer learning works the
> same way.

---

## The Core Idea

Training a model from scratch needs:
- Millions of images
- Days of GPU time
- Lots of tuning

Transfer learning needs:
- Hundreds to thousands of images
- Minutes to hours
- A pretrained model as your starting point

```
From scratch:                 Transfer learning:

  Random weights              ImageNet-trained weights
       |                            |
       v                            v
  [  Train on                 [  Fine-tune on
     millions of                 YOUR small
     images for                  dataset for
     days       ]                minutes     ]
       |                            |
       v                            v
  Maybe works                 Usually works!
```

---

## Why It Works

Deep networks learn hierarchical features:

```
Layer 1-2:    Edges, textures      (universal)
Layer 3-5:    Shapes, patterns     (fairly universal)
Layer 6-10:   Object parts         (somewhat specific)
Layer 11+:    Full objects          (task specific)

  Input Image
      |
      v
  +----------+
  | Edges    |  <-- These are the SAME whether you're
  | Textures |      classifying cats, cars, or X-rays
  +----------+
      |
      v
  +----------+
  | Shapes   |  <-- Still pretty universal
  | Patterns |
  +----------+
      |
      v
  +----------+
  | Parts    |  <-- Getting more specific
  | Combos   |
  +----------+
      |
      v
  +----------+
  | Cat? Dog?|  <-- ONLY this part is truly task-specific
  | Car?     |      REPLACE this for your task
  +----------+
```

---

## Strategy 1: Feature Extraction (Freeze Everything)

Use the pretrained model as a fixed feature extractor.
Only train a new classification head.

```
FROZEN (don't update):        TRAINABLE (update):

+------------------+          +------------------+
| Pretrained       |          | Your new head    |
| backbone         |   --->   | nn.Linear(...)   |
| (ResNet, ViT)    |          | nn.Linear(...)   |
+------------------+          +------------------+

When to use:
- Very small dataset (< 1000 images)
- Your domain is similar to ImageNet
- You want fast training
```

```python
import torch
import torch.nn as nn
from torchvision import models

backbone = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)

for param in backbone.parameters():
    param.requires_grad = False

num_classes = 5
backbone.fc = nn.Sequential(
    nn.Linear(2048, 256),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(256, num_classes),
)

optimizer = torch.optim.AdamW(backbone.fc.parameters(), lr=1e-3)
```

---

## Strategy 2: Fine-Tuning (Unfreeze Some Layers)

Freeze early layers, train later layers + new head.

```
+------------------+
| Layer 1-3        |  FROZEN   (edges, textures - keep these)
+------------------+
| Layer 4-6        |  FROZEN   (shapes - still universal)
+------------------+
| Layer 7-9        |  TRAIN    (adapt these to your domain)
+------------------+
| New head         |  TRAIN    (your task-specific classifier)
+------------------+
```

```python
backbone = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)

for param in backbone.parameters():
    param.requires_grad = False

for param in backbone.layer4.parameters():
    param.requires_grad = True

backbone.fc = nn.Sequential(
    nn.Linear(2048, 256),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(256, num_classes),
)

optimizer = torch.optim.AdamW([
    {"params": backbone.layer4.parameters(), "lr": 1e-5},
    {"params": backbone.fc.parameters(), "lr": 1e-3},
], weight_decay=0.01)
```

Notice the **differential learning rates**: backbone layers
get a much smaller lr than the new head.

---

## Strategy 3: Full Fine-Tuning

Unfreeze everything but use a very small learning rate.

```
When to use:
- Medium to large dataset (10k+ images)
- Your domain is DIFFERENT from ImageNet
  (medical images, satellite photos, etc.)
- You have enough compute

Danger: can "forget" pretrained features if lr too high!
```

```python
backbone = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
backbone.fc = nn.Linear(2048, num_classes)

optimizer = torch.optim.AdamW([
    {"params": backbone.layer1.parameters(), "lr": 1e-6},
    {"params": backbone.layer2.parameters(), "lr": 5e-6},
    {"params": backbone.layer3.parameters(), "lr": 1e-5},
    {"params": backbone.layer4.parameters(), "lr": 5e-5},
    {"params": backbone.fc.parameters(), "lr": 1e-3},
], weight_decay=0.01)
```

---

## The Decision Framework

```
HOW MUCH DATA DO YOU HAVE?

< 500 samples
 |
 +---> Feature extraction (freeze all)
       lr = 1e-3 for head only

500 - 5000 samples
 |
 +---> Fine-tune last few layers
       lr = 1e-5 for backbone, 1e-3 for head

5000 - 50000 samples
 |
 +---> Fine-tune most layers
       Differential learning rates

50000+ samples
 |
 +---> Full fine-tune OR train from scratch
       (pretrained still often helps)
```

---

## Transfer Learning with Vision Transformers

ViTs transfer even better than CNNs because attention is
more flexible than convolutions.

```python
from torchvision.models import vit_b_16, ViT_B_16_Weights

vit = vit_b_16(weights=ViT_B_16_Weights.IMAGENET1K_V1)

for param in vit.parameters():
    param.requires_grad = False

for param in vit.encoder.layers[-2:].parameters():
    param.requires_grad = True

vit.heads = nn.Linear(768, num_classes)

optimizer = torch.optim.AdamW([
    {"params": vit.encoder.layers[-2:].parameters(), "lr": 1e-5},
    {"params": vit.heads.parameters(), "lr": 1e-3},
])
```

---

## Transfer Learning for NLP

Same principle. BERT/GPT learned language structure.
You fine-tune for your specific task.

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer

model_name = "bert-base-uncased"
model = AutoModelForSequenceClassification.from_pretrained(
    model_name, num_labels=3
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

optimizer = torch.optim.AdamW(model.parameters(), lr=2e-5, weight_decay=0.01)
```

```
Common fine-tuning learning rates:

+------------------+------------------+
| Model            | Learning Rate    |
+------------------+------------------+
| BERT-base        | 2e-5 to 5e-5    |
| BERT-large       | 1e-5 to 3e-5    |
| GPT-2            | 1e-5 to 5e-5    |
| ViT-B/16         | 1e-5 to 1e-4    |
| ResNet-50        | 1e-4 to 1e-3    |
+------------------+------------------+
```

---

## Practical Tips

```
+------------------------------+------------------------------------+
| Tip                          | Why                                |
+------------------------------+------------------------------------+
| Always use pretrained        | Even if domains differ, it helps   |
+------------------------------+------------------------------------+
| Warmup the learning rate     | Sudden large updates destroy       |
|                              | pretrained features                |
+------------------------------+------------------------------------+
| Lower lr for earlier layers  | They hold more general features    |
+------------------------------+------------------------------------+
| Match preprocessing          | Use SAME normalization as the      |
|                              | pretrained model was trained with  |
+------------------------------+------------------------------------+
| Start frozen, then unfreeze  | Train head first, then gradually   |
|                              | unfreeze backbone layers           |
+------------------------------+------------------------------------+
```

### Gradual Unfreezing

```
Epoch 1-3:    Only head trainable
Epoch 4-6:    Unfreeze last block
Epoch 7-10:   Unfreeze last 2 blocks
Epoch 11+:    Unfreeze everything (tiny lr)

This avoids catastrophic forgetting.
```

```python
def unfreeze_layers(model, layers):
    for name, param in model.named_parameters():
        for layer_name in layers:
            if layer_name in name:
                param.requires_grad = True
```

---

## Common Pitfalls

```
+----------------------------------+-------------------------------+
| Pitfall                          | Fix                           |
+----------------------------------+-------------------------------+
| Forgot model.eval() at test time | BN and Dropout behave        |
|                                  | differently in eval mode      |
+----------------------------------+-------------------------------+
| Wrong input preprocessing        | Match pretrained model's      |
|                                  | transforms exactly            |
+----------------------------------+-------------------------------+
| Learning rate too high           | Start at 1e-5 for backbone    |
+----------------------------------+-------------------------------+
| Not enough epochs for head       | Train head alone for a few    |
|                                  | epochs before unfreezing      |
+----------------------------------+-------------------------------+
```

---

## Exercises

1. **Feature extraction**: Load a pretrained ResNet-18 and use
   it as a feature extractor on a small dataset (e.g., Flowers102).
   Only train the final linear layer. Report accuracy.

2. **Fine-tuning comparison**: Compare three strategies on the
   same dataset: (a) freeze all, (b) fine-tune last block,
   (c) fine-tune everything. Which wins? Why?

3. **Differential learning rates**: Implement a training loop
   with 3 different learning rate groups for a ResNet-50. Plot
   the learning rate per group over epochs.

4. **Gradual unfreezing**: Implement a schedule that unfreezes
   one block every 3 epochs. Compare against fine-tuning all
   at once.

5. **Cross-domain transfer**: Fine-tune an ImageNet model on
   medical images (use MedMNIST). How does accuracy compare
   to training from scratch?

---

**Next**: [Lesson 04 - Data Augmentation](./04-data-augmentation.md)
