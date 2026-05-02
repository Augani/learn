# Computer Vision Track — Roadmap

Welcome to the Computer Vision deep dive. You already know what a CNN is from
ML Fundamentals, and you've seen ViTs in Advanced Deep Learning. This track
takes you from raw pixels to production vision systems.

## What You'll Build

By the end of this track you will be able to:

- Manipulate images programmatically with OpenCV and PyTorch
- Design and train CNN architectures from scratch
- Deploy object detection, segmentation, and classification models
- Work with transformers for vision tasks
- Ship models to mobile and edge devices

## Prerequisites

- Python 3.10+
- PyTorch 2.x
- OpenCV (`pip install opencv-python`)
- Basic linear algebra (matrix operations, dot products)
- Completed ML Fundamentals track (or equivalent)

## Track Map

```
  START
    |
    v
+---------------------------+
| 01  How Computers See     |  Pixels, tensors, color spaces
+---------------------------+
    |
    v
+---------------------------+
| 02  Image Operations      |  OpenCV transforms
+---------------------------+
    |
    v
+---------------------------+
| 03  Filters & Edges       |  Convolution, Sobel, Canny
+---------------------------+
    |
    v
+---------------------------+
| 04  Feature Extraction    |  HOG, SIFT, ORB
+---------------------------+
    |
    v
+---------------------------+
| 05  CNNs Revisited        |  Conv layers, pooling, design
+---------------------------+
    |
    v
+---------------------------+
| 06  Classic Architectures |  LeNet -> ResNet evolution
+---------------------------+
    |
    v
+---------------------------+
| 07  Transfer Learning     |  Pretrained models, fine-tuning
+---------------------------+
    |
    v
+------+--------------------+
| 08  Object Detection      |  YOLO, SSD, Faster R-CNN
+---------------------------+
    |
    v
+---------------------------+
| 09  Semantic Segmentation |  U-Net, DeepLab
+---------------------------+
    |
    v
+---------------------------+
| 10  Instance Segmentation |  Mask R-CNN, panoptic
+---------------------------+
    |
    v
+---------------------------+
| 11  Vision Transformers   |  ViT, Swin
+---------------------------+
    |
    v
+---------------------------+
| 12  Multimodal Vision     |  CLIP, zero-shot
+---------------------------+
    |
    v
+---------------------------+
| 13  Generative Vision     |  GANs, diffusion, style transfer
+---------------------------+
    |
    v
+---------------------------+
| 14  Video Analysis        |  Optical flow, tracking
+---------------------------+
    |
    v
+---------------------------+
| 15  Edge Deployment       |  ONNX, TensorRT, mobile
+---------------------------+
    |
    v
+---------------------------+
| 16  Build a Vision System |  Capstone project
+---------------------------+
    |
   DONE
```

## Reference Material

- [reference-architectures.md](reference-architectures.md) — Model comparison table
- [reference-opencv.md](reference-opencv.md) — OpenCV cheat sheet

## Pacing

Each lesson is designed for 30-60 minutes. Do one per day or binge the whole
track in a weekend — your call.

## Setup

```bash
pip install torch torchvision opencv-python matplotlib numpy pillow
```

Verify everything works:

```python
import torch
import cv2
import torchvision

print(f"PyTorch:      {torch.__version__}")
print(f"TorchVision:  {torchvision.__version__}")
print(f"OpenCV:       {cv2.__version__}")
print(f"CUDA:         {torch.cuda.is_available()}")
```

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Computer Vision: Algorithms and Applications** by Richard Szeliski (Springer, 2nd Edition 2022) — The standard CV textbook. *Free at szeliski.org/Book*
- **Deep Learning for Vision Systems** by Mohamed Elgendy (Manning, 2020) — From CNNs to object detection

---

**Ready? Start with [Lesson 01 — How Computers See](01-how-computers-see.md)**
