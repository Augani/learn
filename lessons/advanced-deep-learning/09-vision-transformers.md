# Lesson 09: Vision Transformers

> **Analogy**: Reading an image like reading a sentence. A CNN
> slides a small window across the image, like reading one word
> at a time with tunnel vision. A Vision Transformer chops the
> image into patches and lets every patch attend to every other
> patch -- like reading a whole paragraph at once, understanding
> how every word relates to every other word.

---

## From CNNs to Transformers

```
CNN approach:
  +--------+
  | Image  |  --> [3x3 conv] --> [3x3 conv] --> ... --> class
  +--------+
  Each conv sees only a LOCAL region.
  Global context requires many layers stacked.

ViT approach:
  +--------+
  | Image  |  --> [split into patches] --> [self-attention] --> class
  +--------+
  Every patch can attend to every other patch.
  Global context from layer 1.
```

---

## How ViT Works

```
Step 1: Split image into patches

  Original image (224x224):     Patches (14x14 grid of 16x16 patches):

  +---------------------------+   +--+--+--+--+--+--+
  |                           |   |p1|p2|p3|p4|p5|..|
  |       [cat photo]        |   +--+--+--+--+--+--+
  |                           |   |p7|p8|p9|..|  |  |
  |                           |   +--+--+--+--+--+--+
  +---------------------------+   |  |  |  |  |  |  |
                                  +--+--+--+--+--+--+
                                  196 patches total

Step 2: Flatten each patch and project

  Each 16x16x3 patch --> flatten to 768 dims --> linear projection

Step 3: Add position embeddings + [CLS] token

  [CLS] [p1] [p2] [p3] ... [p196]
    +     +    +    +          +
  pos0  pos1 pos2 pos3     pos196

Step 4: Pass through transformer encoder

  [CLS] [p1] [p2] ... [p196]
     |    |    |         |
     v    v    v         v
  +---------------------------+
  | Multi-Head Self-Attention |  x12 layers
  | + FFN + LayerNorm         |
  +---------------------------+
     |    |    |         |
     v    v    v         v
  [CLS] [p1] [p2] ... [p196]

Step 5: Classify using the [CLS] token

  [CLS] --> MLP head --> class prediction
```

---

## ViT Implementation

```python
import torch
import torch.nn as nn


class PatchEmbedding(nn.Module):
    def __init__(self, img_size=224, patch_size=16, in_channels=3, embed_dim=768):
        super().__init__()
        self.num_patches = (img_size // patch_size) ** 2
        self.proj = nn.Conv2d(
            in_channels, embed_dim,
            kernel_size=patch_size, stride=patch_size,
        )

    def forward(self, x):
        x = self.proj(x)
        x = x.flatten(2).transpose(1, 2)
        return x


class ViT(nn.Module):
    def __init__(
        self,
        img_size=224,
        patch_size=16,
        in_channels=3,
        num_classes=1000,
        embed_dim=768,
        depth=12,
        num_heads=12,
        mlp_ratio=4.0,
        dropout=0.1,
    ):
        super().__init__()
        self.patch_embed = PatchEmbedding(img_size, patch_size, in_channels, embed_dim)
        num_patches = self.patch_embed.num_patches

        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        self.pos_embed = nn.Parameter(torch.zeros(1, num_patches + 1, embed_dim))
        self.pos_drop = nn.Dropout(dropout)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim,
            nhead=num_heads,
            dim_feedforward=int(embed_dim * mlp_ratio),
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=depth)
        self.norm = nn.LayerNorm(embed_dim)
        self.head = nn.Linear(embed_dim, num_classes)

        nn.init.trunc_normal_(self.pos_embed, std=0.02)
        nn.init.trunc_normal_(self.cls_token, std=0.02)

    def forward(self, x):
        batch_size = x.size(0)
        patches = self.patch_embed(x)

        cls_tokens = self.cls_token.expand(batch_size, -1, -1)
        x = torch.cat([cls_tokens, patches], dim=1)
        x = x + self.pos_embed
        x = self.pos_drop(x)

        x = self.transformer(x)
        x = self.norm(x)

        cls_output = x[:, 0]
        return self.head(cls_output)
```

---

## ViT Model Sizes

```
+----------+--------+-------+-------+--------+--------+
| Model    | Layers | Heads | Dim   | Params | Patches|
+----------+--------+-------+-------+--------+--------+
| ViT-Tiny |   12   |   3   |  192  |  5.7M  | 16x16  |
| ViT-Small|   12   |   6   |  384  |  22M   | 16x16  |
| ViT-Base |   12   |  12   |  768  |  86M   | 16x16  |
| ViT-Large|   24   |  16   | 1024  | 307M   | 16x16  |
| ViT-Huge |   32   |  16   | 1280  | 632M   | 14x14  |
+----------+--------+-------+-------+--------+--------+
```

---

## Using Pretrained ViT

```python
from torchvision.models import vit_b_16, ViT_B_16_Weights

model = vit_b_16(weights=ViT_B_16_Weights.IMAGENET1K_V1)

model.heads = nn.Linear(768, num_classes)

for param in model.parameters():
    param.requires_grad = False
for param in model.encoder.layers[-2:].parameters():
    param.requires_grad = True
for param in model.heads.parameters():
    param.requires_grad = True
```

---

## CLIP: Connecting Vision and Language

CLIP trains a vision encoder and a text encoder to produce
matching embeddings for image-text pairs.

```
Image: [photo of a dog]    Text: "a photo of a dog"
        |                            |
        v                            v
  Image Encoder              Text Encoder
  (ViT or ResNet)            (Transformer)
        |                            |
        v                            v
  Image embedding            Text embedding
  [0.2, -0.5, ...]          [0.2, -0.5, ...]
        \                          /
         \                        /
          --> Cosine similarity <--
              Should be HIGH for matching pairs
              Should be LOW for non-matching pairs


Training uses contrastive loss on a batch:

          Text 1   Text 2   Text 3   Text 4
Image 1 [ HIGH     low      low      low   ]
Image 2 [ low      HIGH     low      low   ]
Image 3 [ low      low      HIGH     low   ]
Image 4 [ low      low      low      HIGH  ]
```

```python
import torch
from transformers import CLIPModel, CLIPProcessor

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

from PIL import Image

image = Image.open("dog.jpg")
texts = ["a photo of a dog", "a photo of a cat", "a photo of a car"]

inputs = processor(text=texts, images=image, return_tensors="pt", padding=True)

outputs = model(**inputs)
logits_per_image = outputs.logits_per_image
probs = logits_per_image.softmax(dim=1)

for text, prob in zip(texts, probs[0]):
    print(f"{text}: {prob.item():.3f}")
```

---

## CLIP for Zero-Shot Classification

```
No training needed! Just describe the classes in text.

Classes: ["dog", "cat", "bird", "fish"]

1. Encode all class descriptions with text encoder
2. Encode the image with image encoder
3. Find highest cosine similarity

Works for ANY class, even ones CLIP never saw during training!
```

```python
def zero_shot_classify(image, class_names, model, processor):
    texts = [f"a photo of a {name}" for name in class_names]
    inputs = processor(text=texts, images=image, return_tensors="pt", padding=True)

    with torch.no_grad():
        outputs = model(**inputs)

    probs = outputs.logits_per_image.softmax(dim=1)
    best_idx = probs.argmax(dim=1).item()
    return class_names[best_idx], probs[0][best_idx].item()
```

---

## DINOv2: Self-Supervised Vision

DINOv2 learns visual features WITHOUT labels.

```
DINO training:

  Original image
       |
       +--> [global crop]  --> Teacher network --> embedding_t
       |                                               |
       +--> [local crop 1] --> Student network --> embedding_s1
       +--> [local crop 2] --> Student network --> embedding_s2

  Loss: student embeddings should match teacher embeddings

  Teacher = exponential moving average of student
  No labels needed!

Result: incredible features that transfer to any vision task.
```

```python
import torch

dinov2 = torch.hub.load("facebookresearch/dinov2", "dinov2_vitb14")
dinov2.eval()

from torchvision import transforms

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

image_tensor = transform(image).unsqueeze(0)

with torch.no_grad():
    features = dinov2(image_tensor)
```

---

## ViT vs CNN: When to Use What

```
+-------------------+-------------------+-------------------+
| Factor            | ViT               | CNN               |
+-------------------+-------------------+-------------------+
| Small dataset     | Needs pretraining | Works from scratch|
| (<10k images)     |                   |                   |
+-------------------+-------------------+-------------------+
| Large dataset     | Best performance  | Still competitive |
| (>100k images)    |                   |                   |
+-------------------+-------------------+-------------------+
| Global context    | From layer 1      | Needs many layers |
+-------------------+-------------------+-------------------+
| Local features    | Weaker            | Strong (by design)|
+-------------------+-------------------+-------------------+
| Compute cost      | Quadratic in      | Linear in image   |
|                   | patch count       | size              |
+-------------------+-------------------+-------------------+
| Transfer learning | Excellent         | Good              |
+-------------------+-------------------+-------------------+
```

---

## Exercises

1. **ViT from scratch**: Implement the ViT above and train it
   on CIFAR-10 (resize to 224x224). Compare accuracy to a
   ResNet-18. Which needs more data to converge?

2. **CLIP zero-shot**: Use CLIP to classify images from 5
   categories it was never fine-tuned on. Try creative class
   descriptions like "a professional photo" vs "an amateur photo".

3. **Feature extraction**: Use DINOv2 to extract features from
   100 images of 5 classes. Train a simple linear classifier
   on the features. How does it compare to fine-tuning ResNet?

4. **Patch size experiment**: Train ViT with patch sizes of 8,
   16, and 32 on the same dataset. How does patch size affect
   accuracy and training speed?

5. **Attention visualization**: Extract and visualize the attention
   maps from a pretrained ViT. Which patches attend to which?
   Do the attention patterns make semantic sense?

---

**Next**: [Lesson 10 - Object Detection](./10-object-detection.md)
