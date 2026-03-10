# Lesson 11 — Vision Transformers

## From Sequences to Images

Transformers were built for text — sequences of words. Images aren't
sequences... unless you cut them into pieces. That's exactly what Vision
Transformers do: chop the image into patches and treat each patch like a
word.

Think of it as reading a comic strip. Each panel (patch) tells part of the
story. The transformer reads all panels and understands the whole page.

## ViT — Vision Transformer

```
  Input Image (224x224)
       |
  Split into 16x16 patches (14x14 = 196 patches)
       |
  Flatten each patch to a vector (16*16*3 = 768 dims)
       |
  Linear projection (patch embedding)
       |
  Add position embeddings + [CLS] token
       |
       v
  +--+--+--+--+--+--+--+--+--+--+
  |CLS| P1| P2| P3| P4| ... |P196|
  +--+--+--+--+--+--+--+--+--+--+
       |
  Transformer Encoder (12 layers)
       |
  Take [CLS] token output
       |
  MLP Head -> Class prediction
```

```
  Patch extraction:

  +----+----+----+----+
  | P1 | P2 | P3 | P4 |     224x224 image
  +----+----+----+----+     with 16x16 patches
  | P5 | P6 | P7 | P8 |     = 14x14 = 196 patches
  +----+----+----+----+
  | P9 |P10 |P11 |P12 |     Each patch: 16x16x3 = 768 values
  +----+----+----+----+      -> project to D dimensions
  |P13 |P14 |P15 |P16 |
  +----+----+----+----+
```

## Implementing Patch Embedding

```python
import torch
import torch.nn as nn

class PatchEmbedding(nn.Module):
    def __init__(self, img_size=224, patch_size=16, in_channels=3,
                 embed_dim=768):
        super().__init__()
        self.num_patches = (img_size // patch_size) ** 2
        self.proj = nn.Conv2d(in_channels, embed_dim, kernel_size=patch_size,
                              stride=patch_size)

    def forward(self, x):
        x = self.proj(x)
        x = x.flatten(2).transpose(1, 2)
        return x

patch_embed = PatchEmbedding()
dummy = torch.randn(1, 3, 224, 224)
patches = patch_embed(dummy)
print(patches.shape)
```

The Conv2d with kernel_size=stride=16 is a clever way to extract
non-overlapping patches and project them in one operation.

## Position Embeddings

Without position information, the transformer can't tell if a patch is in
the top-left or bottom-right. Position embeddings fix this.

```
  Patch tokens:     [P1, P2, P3, ..., P196]
  Position embeds:  [E1, E2, E3, ..., E196]   (learnable vectors)

  Input to transformer = patch_tokens + position_embeds
```

```python
class ViT(nn.Module):
    def __init__(self, img_size=224, patch_size=16, in_channels=3,
                 embed_dim=768, depth=12, num_heads=12, num_classes=1000):
        super().__init__()
        self.patch_embed = PatchEmbedding(img_size, patch_size, in_channels,
                                          embed_dim)
        num_patches = self.patch_embed.num_patches

        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        self.pos_embed = nn.Parameter(torch.zeros(1, num_patches + 1,
                                                   embed_dim))
        self.pos_drop = nn.Dropout(0.1)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim, nhead=num_heads,
            dim_feedforward=embed_dim * 4,
            dropout=0.1, activation="gelu",
            batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer,
                                              num_layers=depth)
        self.norm = nn.LayerNorm(embed_dim)
        self.head = nn.Linear(embed_dim, num_classes)

    def forward(self, x):
        B = x.shape[0]
        x = self.patch_embed(x)

        cls_tokens = self.cls_token.expand(B, -1, -1)
        x = torch.cat([cls_tokens, x], dim=1)
        x = self.pos_drop(x + self.pos_embed)

        x = self.encoder(x)
        x = self.norm(x[:, 0])

        return self.head(x)

model = ViT(img_size=224, patch_size=16, num_classes=10)
dummy = torch.randn(2, 3, 224, 224)
print(model(dummy).shape)
```

## Self-Attention in Vision

Each patch attends to every other patch. This is how ViT captures long-range
dependencies that CNNs struggle with.

```
  Attention map for one patch:

  Query: patch at position (7,7) — center of image

  +----+----+----+----+----+
  | .1 | .1 | .2 | .1 | .1 |    Low attention to
  +----+----+----+----+----+    background patches
  | .1 | .3 | .5 | .3 | .1 |
  +----+----+----+----+----+    High attention to
  | .2 | .5 |[.9]| .5 | .2 |    nearby + semantically
  +----+----+----+----+----+    similar patches
  | .1 | .3 | .5 | .8 | .1 |
  +----+----+----+----+----+    Can attend to distant
  | .1 | .1 | .2 | .1 | .1 |    patches if relevant
  +----+----+----+----+----+
```

## DeiT — Data-Efficient Image Transformers

ViT needs huge datasets (ImageNet-21K or JFT-300M). DeiT makes ViT work
with just ImageNet-1K by using better training recipes: strong augmentation,
distillation from a CNN teacher, and regularization.

```python
model = torch.hub.load("facebookresearch/deit:main",
                        "deit_small_patch16_224", pretrained=True)
model.eval()
```

## Swin Transformer — Hierarchical Vision

Swin Transformer brings back the hierarchical structure of CNNs by using
**shifted windows**.

```
  Standard ViT:               Swin Transformer:
  All patches attend           Patches attend within
  to ALL patches               local windows, then
                               windows shift and merge.

  Global attention             Window attention
  O(n^2) for all patches       O(n^2) within window only

  +--+--+--+--+--+--+--+--+   +--+--+--+--+--+--+--+--+
  |  ALL PATCHES ATTEND     |   | Win1  | Win2  | Win3  |
  |  TO EACH OTHER          |   +--+--+--+--+--+--+--+--+
  |  (expensive!)           |   | Win4  | Win5  | Win6  |
  +--+--+--+--+--+--+--+--+   +--+--+--+--+--+--+--+--+

  Stage 1: 56x56 patches, 96-dim   (4x4 patches)
  Stage 2: 28x28 patches, 192-dim  (merge 2x2 patches)
  Stage 3: 14x14 patches, 384-dim
  Stage 4: 7x7 patches, 768-dim
```

This hierarchical design means Swin can be used as a backbone for detection
and segmentation — just like a CNN.

## CNN vs. ViT — When to Use What

```
  +--------------------+------------------+------------------+
  | Property           | CNN              | ViT              |
  +--------------------+------------------+------------------+
  | Inductive bias     | Strong (locality)| Weak (global)    |
  | Small data (<10K)  | Better           | Worse            |
  | Large data (>1M)   | Good             | Better           |
  | Long-range deps    | Needs depth      | Built-in         |
  | Computation        | Efficient        | Quadratic in seq |
  | Hierarchical       | Natural          | Needs Swin-like  |
  | Transfer learning  | Excellent        | Excellent        |
  +--------------------+------------------+------------------+

  Rule of thumb:
  - Small dataset + limited compute -> CNN (ResNet, EfficientNet)
  - Large dataset + GPU budget      -> ViT or Swin
  - Detection/segmentation backbone -> Swin or ConvNeXt
```

## Using Pretrained ViT

```python
import timm

model = timm.create_model("vit_base_patch16_224", pretrained=True,
                           num_classes=10)

model.eval()
dummy = torch.randn(1, 3, 224, 224)
with torch.no_grad():
    output = model(dummy)
print(output.shape)
```

## Attention Visualization

```python
def get_attention_maps(model, img_tensor):
    attention_maps = []

    def hook_fn(module, input, output):
        attention_maps.append(output[1])

    hooks = []
    for block in model.blocks:
        hooks.append(block.attn.register_forward_hook(hook_fn))

    with torch.no_grad():
        model(img_tensor.unsqueeze(0))

    for h in hooks:
        h.remove()

    return attention_maps
```

## Exercises

1. Implement the `ViT` class above. Train it on CIFAR-10 (resize to 224x224)
   with patch_size=16, embed_dim=256, depth=6, num_heads=8. Compare accuracy
   to a ResNet-18 baseline.

2. Visualize the learned position embeddings as a cosine similarity matrix.
   Do nearby patches have similar position embeddings?

3. Extract attention maps from a pretrained ViT. For a given image, visualize
   which patches the [CLS] token attends to most in the last layer. Do the
   high-attention patches correspond to the main object?

4. Compare inference speed (images/second) of ViT-B/16, Swin-Tiny, and
   ResNet-50 on the same hardware. Which is fastest?

5. Try different patch sizes (8, 16, 32) on the same image. How does patch
   size affect the number of tokens, memory usage, and classification
   accuracy?

---

**Next: [Lesson 12 — Multimodal Vision](12-multimodal-vision.md)**
