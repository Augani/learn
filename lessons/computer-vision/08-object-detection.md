# Lesson 08 — Object Detection

## The Where's Waldo Analogy

Classification asks "what's in this image?" Detection asks "what's in this
image AND where is it?" It's the difference between saying "there's a cat"
and drawing a box around the cat.

Like finding Waldo, the detector must scan across the image at multiple
positions and scales, checking each candidate region: "Is this Waldo? No.
This? No. THIS? Yes — and he's right here."

## Bounding Boxes

Every detection is a box defined by four numbers:

```
  (x1, y1) +-----------+
           |           |
           |   CAT     |
           |  0.95     |      Format options:
           +-----------+ (x2, y2)
                                (x1, y1, x2, y2)  — corner format
                                (cx, cy, w, h)     — center format
                                (x, y, w, h)       — COCO format
```

```python
def corner_to_center(x1, y1, x2, y2):
    cx = (x1 + x2) / 2
    cy = (y1 + y2) / 2
    w = x2 - x1
    h = y2 - y1
    return cx, cy, w, h

def center_to_corner(cx, cy, w, h):
    x1 = cx - w / 2
    y1 = cy - h / 2
    x2 = cx + w / 2
    y2 = cy + h / 2
    return x1, y1, x2, y2
```

## IoU — Intersection over Union

IoU measures how much two boxes overlap. It's the fundamental metric for
detection.

```
  Box A        Box B           Intersection         Union

  +------+                     +--+
  |      |   +------+         +|  |+            +------+---+
  |  A   |   |  B   |    =    ||  ||       =    |          |
  |      |   |      |         +|  |+            |          |
  +------+   +------+          +--+             +------+---+

  IoU = Area(Intersection) / Area(Union)

  IoU = 1.0  -> perfect overlap
  IoU = 0.5  -> decent match (common threshold)
  IoU = 0.0  -> no overlap
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

## Anchor Boxes

Instead of searching every possible box, detectors use **anchors** —
predefined boxes at each grid cell. The network learns offsets from these
anchors.

```
  Grid cell anchors (3 per cell):

  +--------+--------+--------+
  |  ---   |  ---   |  ---   |    --- = wide anchor
  |  | |   |  | |   |  | |   |    | | = tall anchor
  |  +-+   |  +-+   |  +-+   |    +-+ = square anchor
  +--------+--------+--------+
  |  ---   |  ---   |  ---   |
  |  | |   |  | |   |  | |   |
  |  +-+   |  +-+   |  +-+   |
  +--------+--------+--------+

  Network predicts for each anchor:
  - Is there an object? (objectness score)
  - What class? (class probabilities)
  - How to adjust the box? (dx, dy, dw, dh offsets)
```

## Non-Maximum Suppression (NMS)

Multiple anchors may detect the same object. NMS removes duplicates.

```
  Before NMS:                  After NMS:

  +-------+                    +-------+
  | 0.95  |+------+           | 0.95  |
  |  +----+| 0.87 |           |       |
  |  |  +--++-----+           +-------+
  +--+--| 0.72 |
     +--+------+               Only highest-scoring box survives
                               for each cluster of overlapping boxes.
```

Algorithm:
1. Sort boxes by confidence
2. Take the highest-scoring box, add to results
3. Remove all boxes with IoU > threshold with that box
4. Repeat from step 2

```python
import torch
from torchvision.ops import nms

boxes = torch.tensor([
    [100, 100, 200, 200],
    [105, 105, 205, 205],
    [300, 300, 400, 400],
], dtype=torch.float32)

scores = torch.tensor([0.95, 0.87, 0.72])

keep = nms(boxes, scores, iou_threshold=0.5)
print(f"Kept indices: {keep}")
```

## YOLO — You Only Look Once

YOLO divides the image into a grid and predicts boxes in one shot. No
region proposals, no two-stage pipeline. Fast.

```
  Input Image                Grid (e.g., 13x13)

  +===================+      +--+--+--+--+--+
  |                   |      |  |  |  |  |  |
  |    [dog]          | ---> +--+--+--+--+--+   Each cell predicts
  |         [cat]     |      |  |**|  |  |  |   B boxes, each with
  |                   |      +--+--+--+--+--+   (x, y, w, h, conf, classes)
  +===================+      |  |  |  |**|  |
                             +--+--+--+--+--+

  ** = cells responsible for detecting objects
     (center of object falls in this cell)
```

```python
from ultralytics import YOLO

model = YOLO("yolov8n.pt")

results = model("street.jpg")

for result in results:
    for box in result.boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        conf = box.conf[0].item()
        cls = int(box.cls[0].item())
        name = result.names[cls]
        print(f"{name}: {conf:.2f} at ({x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f})")
```

## Faster R-CNN — Two-Stage Detection

Two-stage detectors are slower but more accurate. Stage 1 proposes regions.
Stage 2 classifies and refines them.

```
  Input --> Backbone CNN --> Feature Map
                               |
                +--- Region Proposal Network (RPN)
                |              |
                v              v
            ~2000 proposals    Anchors + offsets
                |
                v
            RoI Pooling (crop features for each proposal)
                |
                v
            FC Layers --> Class + Box refinement
```

```python
import torchvision
from torchvision.models.detection import fasterrcnn_resnet50_fpn_v2

model = fasterrcnn_resnet50_fpn_v2(weights="DEFAULT")
model.eval()

img = torchvision.io.read_image("street.jpg").float() / 255.0

with torch.no_grad():
    predictions = model([img])

pred = predictions[0]
for idx in range(len(pred["boxes"])):
    if pred["scores"][idx] > 0.5:
        box = pred["boxes"][idx].tolist()
        label = pred["labels"][idx].item()
        score = pred["scores"][idx].item()
        print(f"Class {label}: {score:.2f} at {box}")
```

## SSD — Single Shot MultiBox Detector

SSD detects at multiple scales from different layers of the backbone:

```
  Backbone feature maps at different scales:

  38x38  --> detect small objects (more spatial detail)
  19x19  --> detect medium objects
  10x10  --> detect medium-large objects
   5x5   --> detect large objects
   3x3   --> detect very large objects
   1x1   --> detect image-filling objects

  Each scale has its own set of anchor boxes.
```

## mAP — Mean Average Precision

The standard detection metric. For each class, compute precision-recall
curve, then take the area under it.

```
  Precision = TP / (TP + FP)   "Of things I detected, how many are real?"
  Recall    = TP / (TP + FN)   "Of real objects, how many did I find?"

  AP = area under precision-recall curve (for one class)
  mAP = mean of AP across all classes

  mAP@0.5     = using IoU threshold of 0.5
  mAP@0.5:0.95 = average mAP at IoU thresholds 0.5, 0.55, ..., 0.95
```

## Visualizing Detections

```python
import cv2
import numpy as np

def draw_detections(image, boxes, labels, scores, class_names,
                    threshold=0.5):
    result = image.copy()

    for box, label, score in zip(boxes, labels, scores):
        if score < threshold:
            continue

        x1, y1, x2, y2 = [int(v) for v in box]
        name = class_names.get(label, str(label))
        color = (0, 255, 0)

        cv2.rectangle(result, (x1, y1), (x2, y2), color, 2)
        text = f"{name}: {score:.2f}"
        cv2.putText(result, text, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    return result
```

## Exercises

1. Implement `compute_iou` for batches of boxes using only PyTorch tensor
   operations (no loops). Test it against the loop version.

2. Run YOLOv8 on 10 images of your choice. Adjust the confidence threshold
   from 0.1 to 0.9 in steps of 0.1. How does the number of detections change?

3. Implement NMS from scratch (no `torchvision.ops.nms`). Verify your output
   matches the library version on a test set of boxes.

4. Compare YOLOv8 and Faster R-CNN on the same set of images. Measure speed
   (images/second) and visually compare detection quality.

5. Fine-tune YOLOv8 on a small custom dataset (use Roboflow or LabelImg to
   annotate 50-100 images of a single object class). Report mAP@0.5.

---

**Next: [Lesson 09 — Semantic Segmentation](09-semantic-segmentation.md)**
