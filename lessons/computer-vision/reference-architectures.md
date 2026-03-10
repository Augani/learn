# Reference — Vision Model Architectures

## Classification Models

```
+------------------+------+--------+--------+----------+---------------------------+
| Model            | Year | Params | GFLOPs | Top-1 %  | Key Innovation            |
+------------------+------+--------+--------+----------+---------------------------+
| LeNet-5          | 1998 |  60K   |  0.001 |  N/A     | First practical CNN       |
| AlexNet          | 2012 |  60M   |  0.7   |  56.5    | ReLU, dropout, GPU        |
| VGG-16           | 2014 | 138M   | 15.5   |  71.6    | Uniform 3x3 stacks       |
| GoogLeNet        | 2014 |   7M   |  1.5   |  69.8    | Inception module          |
| ResNet-50        | 2015 |  25M   |  4.1   |  76.1    | Skip connections          |
| ResNet-152       | 2015 |  60M   | 11.6   |  78.3    | Very deep residual        |
| DenseNet-121     | 2016 |   8M   |  2.9   |  74.4    | Dense connections         |
| MobileNetV2      | 2018 |  3.4M  |  0.3   |  72.0    | Inverted residuals        |
| EfficientNet-B0  | 2019 |  5.3M  |  0.4   |  77.1    | Compound scaling          |
| EfficientNet-B4  | 2019 |  19M   |  4.2   |  82.9    | Compound scaling          |
| ViT-B/16         | 2020 |  86M   | 17.6   |  77.9*   | Patch-based transformer   |
| DeiT-S           | 2021 |  22M   |  4.6   |  79.8    | Data-efficient ViT        |
| Swin-T           | 2021 |  28M   |  4.5   |  81.3    | Shifted window attention  |
| ConvNeXt-T       | 2022 |  28M   |  4.5   |  82.1    | Modernized CNN            |
| ConvNeXt-B       | 2022 |  89M   | 15.4   |  83.8    | Modernized CNN            |
+------------------+------+--------+--------+----------+---------------------------+
* ViT-B/16 trained on ImageNet-1K only; with ImageNet-21K pretraining: 84.0%
```

## Object Detection Models

```
+---------------------+------+----------+--------+-----------+----------------+
| Model               | Year | Backbone | Params | COCO mAP  | Speed (GPU ms) |
+---------------------+------+----------+--------+-----------+----------------+
| Faster R-CNN        | 2015 | ResNet50 |  41M   |  37.4     | ~60            |
| SSD300              | 2016 | VGG-16   |  24M   |  25.1     | ~20            |
| YOLOv3              | 2018 | Dark-53  |  62M   |  33.0     | ~30            |
| YOLOv5s             | 2020 | CSP      |   7M   |  37.4     | ~7             |
| YOLOv5x             | 2020 | CSP      |  87M   |  50.7     | ~30            |
| DETR                | 2020 | ResNet50 |  41M   |  42.0     | ~70            |
| YOLOv8n             | 2023 | CSP      |  3.2M  |  37.3     | ~5             |
| YOLOv8x             | 2023 | CSP      |  68M   |  53.9     | ~25            |
| RT-DETR-L           | 2023 | ResNet50 |  32M   |  53.0     | ~10            |
+---------------------+------+----------+--------+-----------+----------------+
Speed measured on NVIDIA V100. Actual speed varies by hardware.
```

## Segmentation Models

```
+---------------------+------+----------+--------+----------+------------------+
| Model               | Year | Type     | Params | mIoU %   | Best For         |
+---------------------+------+----------+--------+----------+------------------+
| FCN                 | 2014 | Semantic |  134M  |  62.2*   | Baseline         |
| U-Net               | 2015 | Semantic |  31M   |  N/A     | Medical imaging  |
| DeepLabV3+          | 2018 | Semantic |  40M   |  82.1*   | General semantic |
| Mask R-CNN          | 2017 | Instance |  44M   |  37.1**  | Instance masks   |
| Panoptic FPN        | 2019 | Panoptic |  46M   |  40.3*** | Unified panoptic |
| SegFormer-B5        | 2021 | Semantic |  84M   |  84.0*   | Transformer seg  |
| SAM (ViT-H)        | 2023 | Instance |  632M  |  N/A     | Zero-shot masks  |
+---------------------+------+----------+--------+----------+------------------+
*  Cityscapes val    ** COCO mask AP    *** COCO PQ
```

## Vision-Language Models

```
+------------------+------+--------+------------------------------------------+
| Model            | Year | Params | Capability                               |
+------------------+------+--------+------------------------------------------+
| CLIP ViT-B/32    | 2021 |  151M  | Image-text alignment, zero-shot classify |
| CLIP ViT-L/14    | 2021 |  428M  | Higher accuracy CLIP                     |
| BLIP-2           | 2023 |  3.4B  | Captioning, VQA, retrieval               |
| LLaVA-1.5        | 2023 |  7-13B | Visual instruction following             |
| SigLIP            | 2023 |  400M  | Improved contrastive learning            |
+------------------+------+--------+------------------------------------------+
```

## Generative Models

```
+---------------------+------+--------+-------+----------------------------+
| Model               | Year | Params | Type  | Key Feature                |
+---------------------+------+--------+-------+----------------------------+
| DCGAN               | 2015 |  ~10M  | GAN   | Stable CNN-based GAN       |
| StyleGAN2           | 2020 |  ~30M  | GAN   | High-quality face gen      |
| DDPM                | 2020 |  ~36M  | Diff  | Denoising diffusion        |
| Stable Diffusion 1  | 2022 |  890M  | Diff  | Latent space diffusion     |
| Stable Diffusion XL | 2023 |  3.5B  | Diff  | Higher resolution          |
| SDXL Turbo          | 2023 |  3.5B  | Diff  | 1-4 step generation        |
+---------------------+------+--------+-------+----------------------------+
```

## Choosing a Model — Decision Tree

```
  What do you need?
       |
       +-- Classify images
       |      |
       |      +-- Small dataset (<5K) --> ResNet-50 + transfer learning
       |      +-- Large dataset (>50K) --> EfficientNet-B4 or ConvNeXt
       |      +-- Zero-shot (no training) --> CLIP
       |      +-- Mobile/edge --> MobileNetV2 or EfficientNet-B0
       |
       +-- Detect objects
       |      |
       |      +-- Real-time needed --> YOLOv8n or YOLOv8s
       |      +-- Accuracy first --> YOLOv8x or RT-DETR
       |      +-- Few-shot --> Grounding DINO
       |
       +-- Segment images
       |      |
       |      +-- Pixel-level classes --> DeepLabV3+
       |      +-- Individual objects --> Mask R-CNN
       |      +-- Interactive/zero-shot --> SAM
       |
       +-- Generate images
              |
              +-- Text-to-image --> Stable Diffusion
              +-- Style transfer --> Neural style transfer
              +-- Super-resolution --> ESRGAN
```

## Input Size Reference

```
+------------------+-------------------+
| Model Family     | Typical Input     |
+------------------+-------------------+
| LeNet            | 32 x 32           |
| AlexNet          | 224 x 224 (crop)  |
| VGG / ResNet     | 224 x 224         |
| EfficientNet-B0  | 224 x 224         |
| EfficientNet-B4  | 380 x 380         |
| ViT-B/16         | 224 x 224         |
| Swin-T           | 224 x 224         |
| YOLO (detection) | 640 x 640         |
| U-Net (seg)      | 256 x 256+        |
| CLIP             | 224 x 224         |
+------------------+-------------------+
```
