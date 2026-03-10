# Advanced Deep Learning - Track Roadmap

Welcome to the **Advanced Deep Learning** track. You already know
the basics of neural networks. Now we go deeper -- literally and
figuratively.

This track takes you from training tricks to generative models
to deploying efficient systems at scale.

---

## How This Track Is Organized

```
Phase 1: Training Mastery        (Lessons 01-04)
Phase 2: Generative Models       (Lessons 05-08)
Phase 3: Vision & Multimodal     (Lessons 09-12)
Phase 4: Scale & Efficiency      (Lessons 13-16)
```

---

## Phase 1: Training Mastery

Get your models to actually converge -- and generalize.

- [ ] **01 - Regularization**
      Dropout, batch norm, weight decay, early stopping
- [ ] **02 - Advanced Optimizers**
      Adam, AdamW, learning rate schedules, warmup
- [ ] **03 - Transfer Learning**
      Freezing layers, fine-tuning pretrained models
- [ ] **04 - Data Augmentation**
      Making small datasets punch above their weight

```
  +-----------+     +------------+     +----------+     +---------+
  | Regularize|---->| Optimize   |---->| Transfer |---->| Augment |
  +-----------+     +------------+     +----------+     +---------+
       01                02                03               04
```

---

## Phase 2: Generative Models

Teach networks to create, not just classify.

- [ ] **05 - Autoencoders & VAEs**
      Compressing and generating data
- [ ] **06 - GANs**
      Generator vs discriminator adversarial training
- [ ] **07 - Diffusion Models**
      How Stable Diffusion and DALL-E work
- [ ] **08 - Image Generation Practice**
      ControlNet, LoRA, Stable Diffusion pipelines

```
  +-------------+     +------+     +-----------+     +----------+
  | Autoencoders|---->| GANs |---->| Diffusion |---->| Practice |
  +-------------+     +------+     +-----------+     +----------+
       05               06             07                08
```

---

## Phase 3: Vision & Multimodal

See the world through a transformer's eyes.

- [ ] **09 - Vision Transformers**
      ViT, CLIP, DINOv2
- [ ] **10 - Object Detection**
      YOLO, segmentation, bounding boxes
- [ ] **11 - Multimodal Models**
      Connecting text, images, and audio
- [ ] **12 - Video Understanding**
      Temporal reasoning and action recognition

```
  +------+     +-----------+     +------------+     +-------+
  | ViTs |---->| Detection |---->| Multimodal |---->| Video |
  +------+     +-----------+     +------------+     +-------+
    09              10                11               12
```

---

## Phase 4: Scale & Efficiency

Make big models fast and small models smart.

- [ ] **13 - Distributed Training**
      Data parallel, model parallel, FSDP, DeepSpeed
- [ ] **14 - Quantization & Mixed Precision**
      INT8, FP16, bitsandbytes
- [ ] **15 - Knowledge Distillation**
      Teaching small models from big ones
- [ ] **16 - Neural Architecture Search**
      Automated model design

```
  +-------------+     +-----------+     +------------+     +-----+
  | Distributed |---->| Quantize  |---->| Distill    |---->| NAS |
  +-------------+     +-----------+     +------------+     +-----+
       13                 14                15               16
```

---

## Reference Materials

These are not lessons -- use them as cheat sheets anytime.

- **reference-architectures.md**
  Key architectures timeline and comparison table
- **reference-training-recipes.md**
  Common training configurations that actually work

---

## Prerequisites

You should be comfortable with:

- Python and PyTorch basics
- How a neural network trains (forward pass, backprop, loss)
- CNNs and basic image classification
- What a transformer is (attention, encoder, decoder)

If any of those feel shaky, revisit the fundamentals track first.

---

## Time Estimate

```
Phase 1:  ~8 hours   (solid training fundamentals)
Phase 2:  ~10 hours  (generative models are deep)
Phase 3:  ~8 hours   (vision + multimodal)
Phase 4:  ~8 hours   (systems and efficiency)
          --------
Total:    ~34 hours
```

Take it at your own pace. Each lesson is self-contained enough
to read on a bus ride.

---

## Ready?

Start with [Lesson 01 - Regularization](./01-regularization.md)

---

*Track version: 2026.03*
