# Reference: Key Neural Network Architectures

A timeline and comparison of architectures that shaped deep learning.

---

## Architecture Timeline

```
  2012  2013  2014  2015  2016  2017  2018  2019  2020  2021  2022  2023
  |     |     |     |     |     |     |     |     |     |     |     |
  AlexNet     VGG   ResNet      Transformer     BERT  GPT-2 ViT   GPT-4
        |     GoogLeNet   DenseNet    |     GPT  |     |     CLIP  LLaMA
        |           |     UNet  GAN+  |     |    |     Diff. DALL-E SAM
        |           |           |     |     |    |     Models  |    Mamba
        v           v           v     v     v    v       v     v      v
  CNN era    Deeper+Skip     Attention era    Foundation model era
```

---

## Convolutional Architectures

```
  +----------------+------+--------+--------+-------------------------+
  | Architecture   | Year | Params | Top-1  | Key Innovation          |
  +----------------+------+--------+--------+-------------------------+
  | AlexNet        | 2012 | 60M    | 63.3%  | Deep CNN + GPU training |
  | VGG-16         | 2014 | 138M   | 74.5%  | Uniform 3x3 convs      |
  | GoogLeNet      | 2014 | 6.8M   | 74.8%  | Inception modules       |
  | ResNet-50      | 2015 | 25.6M  | 76.1%  | Skip connections        |
  | ResNet-152     | 2015 | 60.2M  | 78.3%  | Very deep with residuals|
  | DenseNet-121   | 2017 | 8M     | 74.4%  | Dense connections       |
  | MobileNetV2    | 2018 | 3.4M   | 72.0%  | Inverted residuals      |
  | EfficientNet-B0| 2019 | 5.3M   | 77.3%  | Compound scaling (NAS)  |
  | EfficientNet-B7| 2019 | 66M    | 84.4%  | Scaled up B0            |
  | ConvNeXt       | 2022 | 89M    | 84.1%  | Modernized ResNet       |
  +----------------+------+--------+--------+-------------------------+
```

```
  ResNet Block:                  DenseNet Block:

  x ----+                        x ----+----+----+
  |     |                        |     |    |    |
  [conv]|                        [conv]|    |    |
  |     |                        |  |  |    |    |
  [conv]|                        |  +--v    |    |
  |     |                        [conv]     |    |
  + <---+  (add)                 |  |  |    |    |
  |                              |  +--+----v    |
  v                              [conv]          |
  output                         |  |  |    |    |
                                 |  +--+----+----v
                                 [conv]
                                 output (concatenate all)
```

---

## Transformer Architectures

```
  +-------------------+------+--------+----------------------------+
  | Architecture      | Year | Params | Key Innovation             |
  +-------------------+------+--------+----------------------------+
  | Transformer       | 2017 | ~65M   | Self-attention mechanism   |
  | BERT-base         | 2018 | 110M   | Bidirectional pretraining  |
  | BERT-large        | 2018 | 340M   | Scaled BERT                |
  | GPT-2             | 2019 | 1.5B   | Autoregressive, large scale|
  | T5-base           | 2020 | 220M   | Text-to-text framework     |
  | GPT-3             | 2020 | 175B   | In-context learning        |
  | PaLM              | 2022 | 540B   | Pathways system            |
  | LLaMA-7B          | 2023 | 7B     | Efficient open LLM         |
  | LLaMA-2-70B       | 2023 | 70B    | RLHF alignment             |
  | Mistral-7B        | 2023 | 7B     | Sliding window attention   |
  | Mixtral 8x7B      | 2024 | 47B*   | Mixture of experts         |
  +-------------------+------+--------+----------------------------+
  * active parameters per token: ~13B

  Encoder-only:  BERT, RoBERTa, DeBERTa
                 Best for: classification, NER, embeddings

  Decoder-only:  GPT series, LLaMA, Mistral
                 Best for: text generation, code, reasoning

  Encoder-Decoder: T5, BART, mBART
                   Best for: translation, summarization
```

---

## Vision Transformer Family

```
  +-------------------+------+--------+--------+----------------------+
  | Architecture      | Year | Params | Top-1  | Key Innovation       |
  +-------------------+------+--------+--------+----------------------+
  | ViT-B/16          | 2020 | 86M    | 81.8%  | Patches as tokens    |
  | DeiT-B            | 2021 | 86M    | 83.1%  | Distillation token   |
  | Swin-B            | 2021 | 88M    | 83.5%  | Shifted windows      |
  | BEiT              | 2022 | 86M    | 83.2%  | Masked image modeling|
  | MAE               | 2022 | 86M    | 83.6%  | 75% masking pretrain |
  | DINOv2            | 2023 | 86M    | 84.5%  | Self-supervised ViT  |
  | SAM (ViT-H)       | 2023 | 636M   | N/A    | Segment Anything     |
  +-------------------+------+--------+--------+----------------------+
```

---

## Generative Architectures

```
  +-------------------+------+-----------------------------------+
  | Architecture      | Year | Key Innovation                    |
  +-------------------+------+-----------------------------------+
  | VAE               | 2014 | Learned latent space              |
  | GAN               | 2014 | Adversarial training              |
  | StyleGAN          | 2019 | Style-based generation            |
  | StyleGAN2         | 2020 | Better training stability         |
  | DDPM              | 2020 | Denoising diffusion               |
  | DALL-E            | 2021 | Text-to-image (discrete VAE)      |
  | Stable Diffusion  | 2022 | Latent diffusion, open source     |
  | DALL-E 3          | 2023 | Better prompt following           |
  | SDXL              | 2023 | Higher resolution diffusion       |
  | Sora              | 2024 | Video generation (DiT)            |
  +-------------------+------+-----------------------------------+

  GAN:                        Diffusion:
  Generator <-> Discriminator  Noise --> Denoise x T steps --> Image

  z --> G(z) --> fake image    x_T --> x_{T-1} --> ... --> x_0
                   |                     |
              D: real or fake?     Learned denoising
```

---

## Architecture Comparison by Use Case

```
  +------------------------+------------------------------+
  | Task                   | Recommended Architecture     |
  +------------------------+------------------------------+
  | Image classification   | ConvNeXt, EfficientNet, ViT  |
  | Object detection       | YOLO v8, DETR, Faster R-CNN  |
  | Semantic segmentation  | SegFormer, UNet, Mask2Former |
  | Text classification    | BERT, DeBERTa, RoBERTa       |
  | Text generation        | LLaMA, Mistral, GPT          |
  | Translation            | T5, mBART, NLLB              |
  | Speech recognition     | Whisper, wav2vec 2.0          |
  | Image generation       | Stable Diffusion, DALL-E 3   |
  | Video understanding    | TimeSformer, VideoMAE         |
  | Multimodal             | CLIP, LLaVA, GPT-4V          |
  | Tabular data           | XGBoost, TabNet, FT-Trans.   |
  | Time series            | PatchTST, TimesNet, Informer |
  | Recommendation         | Two-tower, DLRM               |
  +------------------------+------------------------------+
```

---

## Scaling Laws

```
  How performance scales with model size:

  Loss ~ C * N^(-alpha)

  Where N = number of parameters, C = constant, alpha ~ 0.07

  +----------+-------------+---------------------------+
  | Size     | Params      | Typical capability        |
  +----------+-------------+---------------------------+
  | Tiny     | < 100M      | Single task, narrow       |
  | Small    | 100M - 1B   | Good at trained tasks     |
  | Medium   | 1B - 10B    | Reasonable generalization |
  | Large    | 10B - 100B  | Strong few-shot learning  |
  | Massive  | 100B+       | Emergent abilities        |
  +----------+-------------+---------------------------+

  Chinchilla scaling (compute-optimal):
  For a compute budget C:
    Optimal model size N ~ C^0.5
    Optimal data size D ~ C^0.5

  Translation: double compute -> ~1.4x bigger model + ~1.4x more data
```

---

## Architecture Building Blocks

```
  +-----------------------------+----------------------------------+
  | Block                       | Used In                          |
  +-----------------------------+----------------------------------+
  | Residual connection         | ResNet, Transformer, most modern |
  | Multi-head self-attention   | All transformers                 |
  | Feed-forward network (FFN)  | All transformers                 |
  | Layer normalization          | Transformers (Pre-LN or Post-LN)|
  | RMSNorm                     | LLaMA, Mistral                  |
  | Rotary position embeddings  | LLaMA, Mistral, GPT-NeoX        |
  | Grouped query attention     | LLaMA-2, Mistral                |
  | Mixture of Experts (MoE)    | Mixtral, Switch Transformer     |
  | Depthwise separable conv    | MobileNet, EfficientNet         |
  | Squeeze-and-excitation      | SENet, EfficientNet             |
  | Flash Attention              | All modern LLMs (implementation)|
  +-----------------------------+----------------------------------+
```

---

## Memory and Compute Requirements

```
  Model inference (FP16):
  +-------------------+---------+----------+------------------+
  | Model             | VRAM    | Latency  | Hardware needed  |
  +-------------------+---------+----------+------------------+
  | BERT-base (110M)  | 0.5 GB  | ~5ms     | Any GPU          |
  | ResNet-50 (25M)   | 0.2 GB  | ~3ms     | Any GPU          |
  | LLaMA-7B          | 14 GB   | ~30ms/tok| 1x RTX 4090      |
  | LLaMA-7B (4-bit)  | 4 GB    | ~25ms/tok| 1x RTX 3060      |
  | LLaMA-70B         | 140 GB  | ~50ms/tok| 2x A100 80GB     |
  | LLaMA-70B (4-bit) | 40 GB   | ~40ms/tok| 1x A100 80GB     |
  | Stable Diff. XL   | 7 GB    | ~3s/img  | 1x RTX 3090      |
  +-------------------+---------+----------+------------------+

  Model training (FP16 + optimizer states):
  +-------------------+---------+---------------------------+
  | Model             | VRAM    | Hardware needed           |
  +-------------------+---------+---------------------------+
  | BERT-base         | 12 GB   | 1x consumer GPU           |
  | LLaMA-7B (full)   | 120 GB  | 2x A100 80GB (FSDP)      |
  | LLaMA-7B (QLoRA)  | 10 GB   | 1x RTX 4090              |
  | LLaMA-70B (full)  | 1.2 TB  | 16x A100 80GB             |
  | LLaMA-70B (QLoRA) | 48 GB   | 1x A100 80GB              |
  +-------------------+---------+---------------------------+
```

---

## Quick Selection Guide

```
  START HERE:
  |
  What's your task?
  |
  +-- Text understanding --> BERT / DeBERTa (fine-tune)
  |
  +-- Text generation --> LLaMA / Mistral (fine-tune or prompt)
  |
  +-- Image classification
  |   +-- Need speed --> EfficientNet / MobileNet
  |   +-- Need accuracy --> ConvNeXt / ViT
  |
  +-- Object detection --> YOLO v8 (speed) / DETR (accuracy)
  |
  +-- Image generation --> Stable Diffusion
  |
  +-- Multimodal --> CLIP (retrieval) / LLaVA (understanding)
  |
  +-- Tabular --> Start with XGBoost, try TabNet/FT-Transformer
  |
  +-- Audio --> Whisper (speech) / wav2vec (representation)
```
