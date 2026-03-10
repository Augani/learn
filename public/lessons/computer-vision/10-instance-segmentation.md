# Lesson 10 — Instance Segmentation

## Beyond Semantic Segmentation

Semantic segmentation labels every pixel with a class but treats all objects
of the same class as one blob. Instance segmentation separates individual
objects — two overlapping cats get two distinct masks.

```
  Photo: Two cats on a couch

  Semantic Segmentation         Instance Segmentation

  +==================+         +==================+
  | CCCCCC  CCCCCC   |         | 111111  222222   |
  | CCCCCC  CCCCCC   |         | 111111  222222   |
  | CCCCCCCCCCCCC    |         | 111111  222222   |
  |   SSSSSSSSSSSS   |         |   SSSSSSSSSSSS   |
  |   SSSSSSSSSSSS   |         |   SSSSSSSSSSSS   |
  +==================+         +==================+

  C = cat (same label!)         1 = cat #1, 2 = cat #2
  S = sofa                      Each instance gets a unique ID
```

## Mask R-CNN

Mask R-CNN extends Faster R-CNN by adding a mask prediction branch. For
each detected object, it also predicts a binary mask.

```
  Input Image
       |
  Backbone (ResNet + FPN)
       |
  Feature Maps
       |
  +--- Region Proposal Network ---+
  |                                |
  v                                v
  Proposals                    Anchors
       |
  RoI Align (crop features for each proposal)
       |
       +----------+-----------+
       |          |           |
       v          v           v
    Class      Box Reg     Mask Head
    Head       Head        (per-instance
    (FC)       (FC)        binary mask)
       |          |           |
       v          v           v
    "cat"     [x1,y1,      28x28
    0.97      x2,y2]       binary mask
```

The mask head produces a small (28x28) binary mask for each detection,
which is then resized to the bounding box dimensions.

## RoI Align vs. RoI Pool

Mask R-CNN uses RoI Align instead of RoI Pool to avoid misalignment from
quantization.

```
  RoI Pool (Faster R-CNN)          RoI Align (Mask R-CNN)

  Feature map grid:                Feature map grid:
  +--+--+--+--+                    +--+--+--+--+
  |  |  |  |  |                    |  |  |  |  |
  +--+--+--+--+                    +--+--+--+--+
  |  |XX|XX|  |  RoI snaps         |  | x| x|  |  RoI uses bilinear
  +--+--+--+--+  to grid           +--+--+--+--+  interpolation at
  |  |XX|XX|  |  boundaries        |  | x| x|  |  exact floating-point
  +--+--+--+--+  (loses precision) +--+--+--+--+  positions
  |  |  |  |  |                    |  |  |  |  |
  +--+--+--+--+                    +--+--+--+--+

  RoI Align preserves spatial accuracy = better masks.
```

## Using Mask R-CNN in PyTorch

```python
import torch
import torchvision
from torchvision.models.detection import maskrcnn_resnet50_fpn_v2

model = maskrcnn_resnet50_fpn_v2(weights="DEFAULT")
model.eval()

img = torchvision.io.read_image("photo.jpg").float() / 255.0

with torch.no_grad():
    predictions = model([img])

pred = predictions[0]
for idx in range(len(pred["boxes"])):
    score = pred["scores"][idx].item()
    if score < 0.5:
        continue

    label = pred["labels"][idx].item()
    box = pred["boxes"][idx].tolist()
    mask = pred["masks"][idx, 0].numpy()

    print(f"Class {label}: {score:.2f}")
    print(f"  Box: {[f'{v:.0f}' for v in box]}")
    print(f"  Mask shape: {mask.shape}")
    print(f"  Mask coverage: {(mask > 0.5).sum()} pixels")
```

## Visualizing Instance Masks

```python
import cv2
import numpy as np

def visualize_instances(image, predictions, threshold=0.5):
    result = image.copy()
    colors = np.random.randint(0, 255, size=(100, 3), dtype=np.uint8)

    masks = predictions["masks"].numpy()
    scores = predictions["scores"].numpy()
    boxes = predictions["boxes"].numpy()
    labels = predictions["labels"].numpy()

    for idx in range(len(scores)):
        if scores[idx] < threshold:
            continue

        color = colors[idx % len(colors)].tolist()
        mask = (masks[idx, 0] > 0.5).astype(np.uint8)

        colored_mask = np.zeros_like(result)
        colored_mask[mask == 1] = color
        result = cv2.addWeighted(result, 1.0, colored_mask, 0.5, 0)

        x1, y1, x2, y2 = boxes[idx].astype(int)
        cv2.rectangle(result, (x1, y1), (x2, y2), color, 2)

    return result
```

## Panoptic Segmentation

Panoptic segmentation unifies semantic and instance segmentation. Every
pixel gets both a class label AND an instance ID.

```
  Semantic:   "This pixel is a car"
  Instance:   "This pixel belongs to car #3"
  Panoptic:   "This pixel is car #3" (both at once)

  Stuff classes (sky, road, grass) = no instances, just class
  Thing classes (car, person, dog) = class + instance ID

  +==================+
  | sky     sky  sky |   Stuff: no instance IDs
  | car#1  car#2     |   Thing: unique instance IDs
  | road   road road |   Stuff: no instance IDs
  | person#1 person#2|   Thing: unique instance IDs
  +==================+
```

## Panoptic Quality Metric

```
  PQ = SQ * RQ

  SQ (Segmentation Quality) = average IoU of matched segments
  RQ (Recognition Quality)  = F1 score of detection

  For each class:
    PQ_c = (sum of IoU for matched pairs) / (TP + 0.5*FP + 0.5*FN)

  PQ = mean of PQ_c across all classes
```

## Fine-Tuning Mask R-CNN

```python
import torchvision
from torchvision.models.detection import MaskRCNN
from torchvision.models.detection.rpn import AnchorGenerator

backbone = torchvision.models.mobilenet_v2(weights="DEFAULT").features
backbone.out_channels = 1280

anchor_generator = AnchorGenerator(
    sizes=((32, 64, 128, 256, 512),),
    aspect_ratios=((0.5, 1.0, 2.0),),
)

model = MaskRCNN(
    backbone,
    num_classes=3,
    rpn_anchor_generator=anchor_generator,
    min_size=800,
)
```

## Dataset Format for Instance Segmentation

Each training sample needs: image, bounding boxes, labels, AND masks.

```python
class InstanceDataset(torch.utils.data.Dataset):
    def __init__(self, image_paths, annotation_paths):
        self.image_paths = image_paths
        self.annotation_paths = annotation_paths

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img = torchvision.io.read_image(self.image_paths[idx]).float() / 255.0

        boxes, labels, masks = self._load_annotations(idx)

        target = {
            "boxes": torch.as_tensor(boxes, dtype=torch.float32),
            "labels": torch.as_tensor(labels, dtype=torch.int64),
            "masks": torch.as_tensor(masks, dtype=torch.uint8),
        }

        return img, target

    def _load_annotations(self, idx):
        raise NotImplementedError
```

## Comparing Segmentation Types

```
  +-----------------------+----------+----------+----------+
  | Property              | Semantic | Instance | Panoptic |
  +-----------------------+----------+----------+----------+
  | Per-pixel class       |   Yes    |   Yes    |   Yes    |
  | Separate instances    |   No     |   Yes    |   Yes    |
  | Covers ALL pixels     |   Yes    |   No*    |   Yes    |
  | Stuff classes          |   Yes    |   No     |   Yes    |
  | Thing classes          |   Yes    |   Yes    |   Yes    |
  +-----------------------+----------+----------+----------+
  * Instance only covers detected objects
```

## Exercises

1. Run Mask R-CNN on 5 images. Visualize the output with colored instance
   masks overlaid on the original image. Each instance should have a unique
   color.

2. Extract the binary mask for the largest detected object in an image.
   Compute its area in pixels and as a percentage of the total image area.

3. Given two overlapping instance masks, compute their IoU. How does the
   model handle heavily overlapping instances of the same class?

4. Modify the fine-tuning example to work with 2 custom classes (e.g.,
   "cat" and "dog"). Create a dummy dataset with synthetic rectangular
   masks and verify the training loop runs.

5. Compare the masks produced by Mask R-CNN at different confidence
   thresholds (0.3, 0.5, 0.7, 0.9). At what threshold do you get the best
   visual results?

---

**Next: [Lesson 11 — Vision Transformers](11-vision-transformers.md)**
