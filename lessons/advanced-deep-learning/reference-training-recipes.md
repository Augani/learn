# Reference: Training Recipes

Common training configurations that work well in practice. These are
starting points -- tune from here, don't start from scratch.

---

## Image Classification (CNN)

```
  Model: ResNet-50 / ConvNeXt on ImageNet-scale data

  +-----------------------------+-------------------------------+
  | Setting                     | Value                         |
  +-----------------------------+-------------------------------+
  | Optimizer                   | AdamW                         |
  | Learning rate               | 4e-3 (with warmup)            |
  | Weight decay                | 0.05                          |
  | Batch size                  | 1024-4096 (across GPUs)       |
  | Epochs                      | 300                           |
  | LR schedule                 | Cosine decay                  |
  | Warmup epochs               | 20                            |
  | Label smoothing             | 0.1                           |
  | Mixup alpha                 | 0.8                           |
  | CutMix alpha                | 1.0                           |
  | RandAugment                 | (9, 0.5)                      |
  | Random erasing prob         | 0.25                          |
  | Stochastic depth            | 0.1                           |
  | EMA decay                   | 0.9999                        |
  | Gradient clipping           | None (or 1.0)                 |
  +-----------------------------+-------------------------------+
```

```python
import torch
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR, LinearLR, SequentialLR

model = build_resnet50()
optimizer = AdamW(model.parameters(), lr=4e-3, weight_decay=0.05)

warmup_scheduler = LinearLR(optimizer, start_factor=0.01, total_iters=20)
cosine_scheduler = CosineAnnealingLR(optimizer, T_max=280, eta_min=1e-6)
scheduler = SequentialLR(
    optimizer,
    schedulers=[warmup_scheduler, cosine_scheduler],
    milestones=[20],
)
```

---

## Image Classification (ViT)

```
  Model: ViT-B/16 on ImageNet

  +-----------------------------+-------------------------------+
  | Setting                     | Value                         |
  +-----------------------------+-------------------------------+
  | Optimizer                   | AdamW                         |
  | Learning rate               | 1e-3                          |
  | Weight decay                | 0.3                           |
  | Batch size                  | 1024                          |
  | Epochs                      | 300                           |
  | LR schedule                 | Cosine decay                  |
  | Warmup epochs               | 5-40                          |
  | Label smoothing             | 0.1                           |
  | Mixup alpha                 | 0.8                           |
  | CutMix alpha                | 1.0                           |
  | RandAugment                 | (9, 0.5)                      |
  | Stochastic depth            | 0.1                           |
  | Gradient clipping           | 1.0                           |
  +-----------------------------+-------------------------------+

  ViTs need MORE regularization than CNNs because they
  have fewer inductive biases (no built-in translation invariance).
```

---

## Fine-Tuning Pretrained Models (Transfer Learning)

```
  Model: Any pretrained model on a new dataset

  +-----------------------------+-------------------------------+
  | Setting                     | Value                         |
  +-----------------------------+-------------------------------+
  | Optimizer                   | AdamW                         |
  | Learning rate               | 1e-5 to 5e-5 (much lower!)   |
  | Weight decay                | 0.01                          |
  | Batch size                  | 16-64                         |
  | Epochs                      | 3-20 (less data = fewer)      |
  | LR schedule                 | Linear warmup + linear decay  |
  | Warmup                      | 6% of total steps             |
  | Gradient clipping           | 1.0                           |
  | Freeze strategy             | See below                     |
  +-----------------------------+-------------------------------+

  Freeze strategies:
  +------------------------------------+---------------------------+
  | Strategy                           | When to use               |
  +------------------------------------+---------------------------+
  | Train all layers                   | Large dataset, big GPU    |
  | Freeze backbone, train head        | Very small dataset        |
  | Gradual unfreezing (top -> bottom) | Medium dataset            |
  | Different LR per layer group       | Best of both worlds       |
  +------------------------------------+---------------------------+
```

```python
def create_layer_groups(model, backbone_lr=1e-5, head_lr=5e-4):
    param_groups = [
        {"params": model.backbone.parameters(), "lr": backbone_lr},
        {"params": model.head.parameters(), "lr": head_lr},
    ]
    return param_groups

optimizer = AdamW(create_layer_groups(model), weight_decay=0.01)
```

---

## LLM Pre-Training

```
  Model: LLaMA-style 7B parameter model

  +-----------------------------+-------------------------------+
  | Setting                     | Value                         |
  +-----------------------------+-------------------------------+
  | Optimizer                   | AdamW                         |
  | Learning rate               | 3e-4                          |
  | Beta1, Beta2                | 0.9, 0.95                     |
  | Weight decay                | 0.1                           |
  | Batch size (tokens)         | 4M tokens                     |
  | Total tokens                | 1-2T tokens                   |
  | LR schedule                 | Cosine with warmup            |
  | Warmup steps                | 2000                          |
  | Min LR                      | 3e-5 (10% of max)             |
  | Gradient clipping           | 1.0                           |
  | Precision                   | BF16 mixed precision          |
  | Sequence length              | 2048-4096                     |
  | Parallelism                 | FSDP or 3D parallel           |
  +-----------------------------+-------------------------------+
```

```python
import math

optimizer = AdamW(
    model.parameters(),
    lr=3e-4,
    betas=(0.9, 0.95),
    weight_decay=0.1,
)

def cosine_with_warmup(step, warmup_steps=2000, total_steps=100000, min_lr=3e-5, max_lr=3e-4):
    if step < warmup_steps:
        return max_lr * step / warmup_steps

    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    return min_lr + 0.5 * (max_lr - min_lr) * (1 + math.cos(math.pi * progress))
```

---

## LLM Fine-Tuning (SFT)

```
  Model: Supervised fine-tuning of pretrained LLM

  +-----------------------------+-------------------------------+
  | Setting                     | Value                         |
  +-----------------------------+-------------------------------+
  | Optimizer                   | AdamW                         |
  | Learning rate               | 2e-5                          |
  | Weight decay                | 0.0                           |
  | Batch size                  | 128 (gradient accumulation)   |
  | Epochs                      | 1-3                           |
  | LR schedule                 | Cosine with warmup            |
  | Warmup ratio                | 0.03                          |
  | Gradient clipping           | 1.0                           |
  | Precision                   | BF16                          |
  | Max sequence length          | 2048-4096                     |
  +-----------------------------+-------------------------------+
```

---

## QLoRA Fine-Tuning

```
  Model: QLoRA for resource-efficient fine-tuning

  +-----------------------------+-------------------------------+
  | Setting                     | Value                         |
  +-----------------------------+-------------------------------+
  | Base model quantization     | NF4 (4-bit)                   |
  | LoRA rank (r)               | 16-64                         |
  | LoRA alpha                  | 32 (2x rank)                  |
  | LoRA dropout                | 0.05                          |
  | Target modules              | q_proj, k_proj, v_proj, o_proj|
  | Optimizer                   | paged_adamw_8bit              |
  | Learning rate               | 2e-4                          |
  | Batch size                  | 4 per GPU                     |
  | Gradient accumulation       | 4                             |
  | Epochs                      | 1-3                           |
  | LR schedule                 | Cosine                        |
  | Warmup ratio                | 0.03                          |
  | Max sequence length          | 2048                          |
  +-----------------------------+-------------------------------+
```

```python
from peft import LoraConfig
from transformers import TrainingArguments

lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

training_args = TrainingArguments(
    output_dir="./output",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    num_train_epochs=3,
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.03,
    bf16=True,
    logging_steps=10,
    save_strategy="epoch",
    optim="paged_adamw_8bit",
    gradient_checkpointing=True,
    max_grad_norm=1.0,
)
```

---

## Object Detection

```
  Model: YOLO v8 / DETR

  +-----------------------------+-------------------------------+
  | Setting                     | Value                         |
  +-----------------------------+-------------------------------+
  | Optimizer                   | SGD (YOLO) / AdamW (DETR)     |
  | Learning rate               | 0.01 (SGD) / 1e-4 (AdamW)    |
  | Momentum (SGD)              | 0.937                         |
  | Weight decay                | 5e-4 (SGD) / 1e-4 (AdamW)    |
  | Batch size                  | 16-64                         |
  | Epochs                      | 300 (YOLO) / 50 (DETR)       |
  | LR schedule                 | Cosine (YOLO) / Step (DETR)  |
  | Image size                  | 640 (YOLO) / 800 (DETR)      |
  | Augmentation                | Mosaic, mixup, HSV            |
  | Warmup epochs               | 3                             |
  +-----------------------------+-------------------------------+
```

---

## Diffusion Models

```
  Model: Stable Diffusion / DDPM

  +-----------------------------+-------------------------------+
  | Setting                     | Value                         |
  +-----------------------------+-------------------------------+
  | Optimizer                   | AdamW                         |
  | Learning rate               | 1e-4                          |
  | Beta1, Beta2                | 0.9, 0.999                    |
  | Weight decay                | 0.01                          |
  | Batch size                  | 256-2048                      |
  | Training steps              | 500K - 1M                     |
  | LR schedule                 | Constant with warmup          |
  | Warmup steps                | 10000                         |
  | EMA decay                   | 0.9999                        |
  | Noise schedule              | Linear or cosine              |
  | Timesteps                   | 1000                          |
  | Precision                   | FP32 (training), FP16 (infer) |
  | Gradient clipping           | 1.0                           |
  +-----------------------------+-------------------------------+
```

---

## GAN Training

```
  Model: StyleGAN2 / DCGAN

  +-----------------------------+-------------------------------+
  | Setting                     | Value                         |
  +-----------------------------+-------------------------------+
  | Optimizer (G & D)           | Adam                          |
  | Learning rate (G)           | 1e-4 to 2e-4                  |
  | Learning rate (D)           | 1e-4 to 4e-4                  |
  | Beta1, Beta2                | 0.0, 0.99                     |
  | Batch size                  | 32-64                         |
  | D steps per G step          | 1 (DCGAN) / 1 (StyleGAN2)    |
  | Gradient penalty            | R1 penalty, gamma=10          |
  | Spectral normalization      | Optional (in D)               |
  | EMA decay (G weights)       | 0.999                         |
  | Training images (K)         | 25K-70K kimg                  |
  +-----------------------------+-------------------------------+

  GAN training is notoriously unstable. Key tips:
  - Use spectral normalization in discriminator
  - Use R1 gradient penalty instead of WGAN-GP
  - Monitor FID during training, not just loss
  - Generator EMA significantly improves quality
```

---

## Common Mistakes and Fixes

```
  +-------------------------------+-------------------------------+
  | Symptom                       | Likely Fix                    |
  +-------------------------------+-------------------------------+
  | Loss explodes to NaN          | Lower LR, add gradient clip   |
  | Loss plateaus early           | Increase LR, add warmup       |
  | Train great, val bad          | More regularization, dropout  |
  | Val loss increases midway     | Early stopping, reduce epochs |
  | Training too slow             | Mixed precision, larger batch |
  | OOM errors                    | Gradient accumulation, AMP    |
  | Fine-tune destroys pretrained | Lower LR, freeze layers first |
  | Unstable GAN training         | Spectral norm, R1 penalty     |
  | LLM generates repetitive text| Increase temperature, top-p   |
  | Model underfits               | Larger model, more epochs     |
  +-------------------------------+-------------------------------+
```

---

## Learning Rate Schedules Visual

```
  Constant:           Step decay:          Cosine:
  lr|____             lr|__                lr|__
    |                   |  |__               |   \
    |                   |     |__            |    \
    +-----> step        +-------> step       +--___> step

  Linear warmup        Cosine with          One-cycle:
  + linear decay:      warmup:
  lr|  /\              lr|  /--\             lr|    /\
    | /  \               | /    \              |   /  \
    |/    \              |/      \             |  /    \
    +------> step        +--------> step       +/------\> step

  Most common for LLMs: cosine with warmup
  Most common for fine-tuning: linear warmup + linear decay
  Most common for GANs: constant
```

---

## Batch Size Guidelines

```
  +---------------------+----------------------------+
  | Batch Size          | Notes                      |
  +---------------------+----------------------------+
  | 8-32                | Good for fine-tuning       |
  | 32-128              | Standard for most tasks    |
  | 256-1024            | Large-scale image training |
  | 1024-4096           | ImageNet from scratch      |
  | 1M-4M tokens        | LLM pretraining            |
  +---------------------+----------------------------+

  Linear scaling rule:
  If you double batch size, double learning rate.

  Exception: for very large batches (>8K), use
  square root scaling: LR_new = LR_base * sqrt(BS_new / BS_base)
```
