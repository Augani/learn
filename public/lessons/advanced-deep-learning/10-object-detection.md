# Lesson 10: Object Detection

> **Analogy**: Playing Where's Waldo with a robot. Classification
> says "there's a Waldo somewhere in this picture." Detection says
> "Waldo is RIGHT HERE" and draws a box around him. Segmentation
> goes further and outlines his exact silhouette, pixel by pixel.

---

## Three Levels of Understanding

```
Classification:          Detection:              Segmentation:
"there is a cat"         "cat at (50,30,200,180)" "these exact pixels are cat"

+----------+            +----------+            +----------+
|          |            |  +----+  |            |  xxxxxx  |
|   cat    |            |  |cat |  |            |  xxxxxxx |
|          |            |  +----+  |            |  xxxxxxx |
|          |            |          |            |  xxxxx   |
+----------+            +----------+            +----------+
  One label               Box + label            Pixel-level mask
  per image               per object             per object
```

---

## Object Detection: The Task

```
Input: An image
Output: A list of (class, confidence, x1, y1, x2, y2) for each object

Example output:
  [
    ("cat",    0.95, 50, 30, 200, 180),
    ("dog",    0.88, 300, 50, 450, 250),
    ("person", 0.76, 100, 10, 180, 300),
  ]

Bounding box format:
  (x1, y1) = top-left corner
  (x2, y2) = bottom-right corner

  (x1,y1)
    +------------------+
    |                  |
    |    [object]      |
    |                  |
    +------------------+
                   (x2,y2)
```

---

## Two-Stage vs One-Stage Detectors

```
Two-stage (R-CNN family):
  Step 1: "Where MIGHT objects be?" --> region proposals
  Step 2: "What IS each proposal?"  --> classify each region

  Image --> [Region Proposal] --> [Classify each] --> Boxes
            (~2000 regions)       (run CNN 2000x)

  Accurate but SLOW.

One-stage (YOLO family):
  Single pass: "What's where?" --> boxes + classes at once

  Image --> [Single CNN pass] --> Boxes + classes
            (one shot)

  Fast but (historically) less accurate.
  Modern YOLO is both fast AND accurate.
```

---

## YOLO: You Only Look Once

```
YOLO divides the image into a grid:

  +----+----+----+----+----+
  |    |    |    |    |    |
  +----+----+----+----+----+
  |    |    | ** |    |    |    ** = cell containing object center
  +----+----+----+----+----+
  |    |    |    |    |    |
  +----+----+----+----+----+

Each grid cell predicts:
  - B bounding boxes (x, y, w, h, confidence)
  - C class probabilities

The cell containing the object CENTER is responsible
for detecting that object.

For each bounding box:
  x, y   = offset from cell corner (0-1)
  w, h   = width, height relative to image
  conf   = P(object) * IoU(pred, truth)
  class  = probability for each class
```

---

## Using YOLOv8 (Ultralytics)

```python
from ultralytics import YOLO

model = YOLO("yolov8n.pt")

results = model("image.jpg")

for result in results:
    boxes = result.boxes
    for box in boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        confidence = box.conf[0].item()
        class_id = int(box.cls[0].item())
        class_name = model.names[class_id]
        print(f"{class_name}: {confidence:.2f} at ({x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f})")
```

### YOLO Model Sizes

```
+----------+--------+----------+---------+
| Model    | Params | mAP@50   | Speed   |
+----------+--------+----------+---------+
| YOLOv8n  | 3.2M   | Good     | Fastest |
| YOLOv8s  | 11.2M  | Better   | Fast    |
| YOLOv8m  | 25.9M  | Great    | Medium  |
| YOLOv8l  | 43.7M  | Excellent| Slower  |
| YOLOv8x  | 68.2M  | Best     | Slowest |
+----------+--------+----------+---------+

n = nano, s = small, m = medium, l = large, x = extra large
```

---

## IoU: Intersection over Union

How we measure if a predicted box matches the ground truth.

```
Ground truth:            Prediction:
+----------+             +----------+
|          |             |          |
|  [cat]   |             |   [cat]  |
|          |             |          |
+----------+             +----------+

Overlap:
+----------+
|    +-----+----+
|    | *** |    |
|    | *** |    |
+----+-----+    |
     +----------+

IoU = Area of intersection (***) / Area of union (all shaded)

IoU = 0.0  --> no overlap (terrible prediction)
IoU = 0.5  --> decent overlap
IoU = 1.0  --> perfect overlap

Typically IoU > 0.5 counts as a correct detection.
```

```python
def compute_iou(box1, box2):
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    intersection = max(0, x2 - x1) * max(0, y2 - y1)

    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection

    if union == 0:
        return 0.0
    return intersection / union
```

---

## Non-Maximum Suppression (NMS)

The model predicts many overlapping boxes for the same object.
NMS keeps only the best one.

```
Before NMS:                After NMS:
+---+                      +---+
|+--+-+                    |   |
||  | |  3 overlapping     |cat|  1 best box
|+--+ |  boxes for         |   |
+---+-+  the same cat      +---+

Algorithm:
1. Sort boxes by confidence (highest first)
2. Take the top box, add to output
3. Remove all boxes that overlap with it (IoU > threshold)
4. Repeat with remaining boxes
```

```python
import torch
from torchvision.ops import nms

boxes = torch.tensor([
    [100, 100, 210, 210],
    [105, 105, 215, 215],
    [200, 200, 310, 310],
], dtype=torch.float32)

scores = torch.tensor([0.9, 0.75, 0.8])

keep = nms(boxes, scores, iou_threshold=0.5)
print(f"Kept indices: {keep.tolist()}")
```

---

## Instance Segmentation

Not just a box -- an exact pixel mask for each object.

```
Detection:                  Instance Segmentation:
+----------+                +----------+
|  +----+  |                |  xxxxxx  |  Each instance gets
|  |cat |  |                |  xxxxxxx |  its own color/mask
|  +----+  |                |  xxxx    |
|     +---+|                |    ooooo |
|     |dog||                |    oooooo|
|     +---+|                |    ooo   |
+----------+                +----------+
```

```python
from ultralytics import YOLO

model = YOLO("yolov8n-seg.pt")
results = model("image.jpg")

for result in results:
    if result.masks is not None:
        for mask, box in zip(result.masks.data, result.boxes):
            class_name = model.names[int(box.cls[0])]
            confidence = box.conf[0].item()
            print(f"{class_name} ({confidence:.2f}): mask shape = {mask.shape}")
```

---

## Semantic Segmentation

Every pixel gets a class label, but we don't distinguish
between individual instances.

```
Instance segmentation:        Semantic segmentation:
+----------+                  +----------+
| xxxxx    |  cat1 = blue     | xxxxx    |  all cats = blue
|    ooooo |  cat2 = green    |    xxxxx |  all cats = blue
| **       |  dog  = red      | **       |  all dogs = red
+----------+                  +----------+

"Two cats and a dog"           "Cat pixels and dog pixels"
```

---

## Fine-Tuning YOLO on Custom Data

```
Dataset structure:
  dataset/
    images/
      train/
        img001.jpg
        img002.jpg
      val/
        img101.jpg
    labels/
      train/
        img001.txt    <-- one row per object
        img002.txt
      val/
        img101.txt

Label format (YOLO):
  class_id  x_center  y_center  width  height
  0         0.5       0.4       0.3    0.6

  All values normalized to [0, 1] relative to image size.
```

```python
from ultralytics import YOLO

model = YOLO("yolov8n.pt")

results = model.train(
    data="dataset.yaml",
    epochs=50,
    imgsz=640,
    batch=16,
    lr0=0.01,
    patience=10,
)
```

### dataset.yaml

```yaml
path: /path/to/dataset
train: images/train
val: images/val

names:
  0: cat
  1: dog
  2: bird
```

---

## Detection Metrics

```
+-------------------+------------------------------------------+
| Metric            | Meaning                                  |
+-------------------+------------------------------------------+
| Precision         | Of all predictions, how many were correct|
+-------------------+------------------------------------------+
| Recall            | Of all real objects, how many were found  |
+-------------------+------------------------------------------+
| mAP@50            | Mean Average Precision at IoU=0.5        |
+-------------------+------------------------------------------+
| mAP@50:95         | mAP averaged over IoU thresholds         |
|                   | 0.50, 0.55, ..., 0.95 (stricter)         |
+-------------------+------------------------------------------+

Precision = TP / (TP + FP)    "How trustworthy are my detections?"
Recall    = TP / (TP + FN)    "How many objects did I miss?"

TP = correct detection (IoU > threshold)
FP = false detection (no matching ground truth)
FN = missed object (no matching prediction)
```

---

## Modern Detection Architectures

```
Timeline:
2014  R-CNN         (two-stage, slow)
2015  Fast R-CNN    (shared features, faster)
2015  Faster R-CNN  (learned proposals)
2016  SSD           (one-stage, multi-scale)
2016  YOLOv1        (one-stage, real-time)
2020  DETR          (transformer-based, no NMS needed)
2023  YOLOv8        (state-of-art one-stage)
2024  RT-DETR       (real-time transformer detection)

DETR is notable: it uses a transformer decoder to directly
predict a SET of objects. No anchors, no NMS.
```

---

## Exercises

1. **YOLO inference**: Run YOLOv8n on 10 images from the internet.
   Print all detected objects with their confidence scores. Try
   images with multiple objects.

2. **IoU implementation**: Implement IoU from scratch. Test with
   overlapping, touching, and non-overlapping box pairs.

3. **NMS from scratch**: Implement non-maximum suppression without
   using torchvision.ops.nms. Verify it matches the library version.

4. **Custom detection**: Fine-tune YOLOv8n on a small custom dataset
   (you can use Roboflow to find one). Report mAP@50 on the val set.

5. **Speed benchmark**: Compare inference speed of YOLOv8n, YOLOv8m,
   and YOLOv8x on the same set of 100 images. Plot speed vs accuracy.

---

**Next**: [Lesson 11 - Multimodal Models](./11-multimodal-models.md)
