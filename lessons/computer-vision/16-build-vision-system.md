# Lesson 16 — Build a Vision System (Capstone)

## Putting It All Together

You've learned pixels, filters, CNNs, detection, segmentation, transformers,
and deployment. Now build a complete vision pipeline from scratch — the kind
you'd ship in a real product.

The capstone: a **retail shelf analyzer** that detects products, classifies
them, and reports inventory status. You could swap the domain (medical,
agriculture, traffic) — the architecture pattern is the same.

## System Architecture

```
  +===========+     +==========+     +============+     +=========+
  | Camera /  | --> | Detection| --> | Classific- | --> | Results |
  | Image     |     | (YOLO)   |     | ation      |     | & API   |
  | Input     |     |          |     | (CLIP/CNN) |     |         |
  +===========+     +==========+     +============+     +=========+
       |                 |                 |                  |
       v                 v                 v                  v
  Preprocess         Bounding          Per-crop           JSON output
  (resize,           boxes +           class labels       + visualization
   normalize)        confidence        + confidence

  Optional additions:
  +--- Segmentation (mask per product)
  +--- Tracking (video: track products over time)
  +--- Edge export (ONNX for deployment)
```

## Step 1 — Project Structure

```
  vision_system/
  +-- config.py           Settings and paths
  +-- preprocess.py       Image loading and transforms
  +-- detector.py         Object detection wrapper
  +-- classifier.py       Classification wrapper
  +-- pipeline.py         End-to-end orchestration
  +-- export.py           ONNX export and optimization
  +-- visualize.py        Drawing results on images
  +-- evaluate.py         Metrics and evaluation
  +-- main.py             Entry point
  +-- requirements.txt
```

## Step 2 — Configuration

```python
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Config:
    input_size: tuple[int, int] = (640, 640)
    detection_model: str = "yolov8n.pt"
    detection_confidence: float = 0.5
    detection_iou_threshold: float = 0.45
    classification_model: str = "openai/clip-vit-base-patch32"
    class_names: tuple[str, ...] = ("bottle", "can", "box", "bag")
    device: str = "cpu"
    output_dir: Path = Path("outputs")
```

## Step 3 — Preprocessing Module

```python
import cv2
import numpy as np
import torch
from pathlib import Path


def load_image(source):
    if isinstance(source, (str, Path)):
        img = cv2.imread(str(source))
        if img is None:
            raise FileNotFoundError(f"Cannot load {source}")
    elif isinstance(source, np.ndarray):
        img = source
    else:
        raise TypeError(f"Unsupported source type: {type(source)}")

    return img


def preprocess_for_display(img_bgr):
    return cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)


def letterbox(image, target_size, fill_value=114):
    h, w = image.shape[:2]
    target_h, target_w = target_size

    scale = min(target_h / h, target_w / w)
    new_h, new_w = int(h * scale), int(w * scale)
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    canvas = np.full((target_h, target_w, 3), fill_value, dtype=np.uint8)
    top = (target_h - new_h) // 2
    left = (target_w - new_w) // 2
    canvas[top:top + new_h, left:left + new_w] = resized

    return canvas, scale, (top, left)
```

## Step 4 — Detection Module

```python
from dataclasses import dataclass


@dataclass
class Detection:
    bbox: tuple[float, float, float, float]
    confidence: float
    class_id: int
    class_name: str


class Detector:
    def __init__(self, config):
        from ultralytics import YOLO
        self.model = YOLO(config.detection_model)
        self.confidence = config.detection_confidence
        self.iou_threshold = config.detection_iou_threshold

    def detect(self, image):
        results = self.model(image, conf=self.confidence,
                             iou=self.iou_threshold, verbose=False)
        detections = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append(Detection(
                    bbox=(x1, y1, x2, y2),
                    confidence=box.conf[0].item(),
                    class_id=int(box.cls[0].item()),
                    class_name=result.names[int(box.cls[0].item())],
                ))
        return detections

    def crop_detections(self, image, detections):
        crops = []
        for det in detections:
            x1, y1, x2, y2 = [int(v) for v in det.bbox]
            h, w = image.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            crop = image[y1:y2, x1:x2]
            if crop.size > 0:
                crops.append(crop)
            else:
                crops.append(None)
        return crops
```

## Step 5 — Classification Module

```python
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel


class Classifier:
    def __init__(self, config):
        self.model = CLIPModel.from_pretrained(config.classification_model)
        self.processor = CLIPProcessor.from_pretrained(
            config.classification_model
        )
        self.class_names = config.class_names
        self.templates = [
            "a photo of a {}",
            "a product photo of a {}",
            "a {} on a store shelf",
        ]
        self.model.eval()

    @torch.no_grad()
    def classify(self, crop_bgr):
        if crop_bgr is None:
            return "unknown", 0.0

        crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(crop_rgb)

        all_probs = []
        for template in self.templates:
            texts = [template.format(name) for name in self.class_names]
            inputs = self.processor(text=texts, images=pil_image,
                                     return_tensors="pt", padding=True)
            outputs = self.model(**inputs)
            probs = outputs.logits_per_image.softmax(dim=-1)
            all_probs.append(probs)

        avg_probs = torch.stack(all_probs).mean(dim=0).squeeze()
        best_idx = avg_probs.argmax().item()
        return self.class_names[best_idx], avg_probs[best_idx].item()
```

## Step 6 — Visualization

```python
import cv2
import numpy as np


COLORS = [
    (0, 255, 0), (255, 0, 0), (0, 0, 255), (255, 255, 0),
    (255, 0, 255), (0, 255, 255), (128, 255, 0), (255, 128, 0),
]


def draw_results(image, detections, classifications):
    result = image.copy()

    for idx, (det, (cls_name, cls_conf)) in enumerate(
        zip(detections, classifications)
    ):
        color = COLORS[idx % len(COLORS)]
        x1, y1, x2, y2 = [int(v) for v in det.bbox]
        cv2.rectangle(result, (x1, y1), (x2, y2), color, 2)

        label = f"{cls_name} ({cls_conf:.0%})"
        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX,
                                      0.5, 1)[0]
        cv2.rectangle(result, (x1, y1 - label_size[1] - 10),
                       (x1 + label_size[0], y1), color, -1)
        cv2.putText(result, label, (x1, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    return result
```

## Step 7 — Pipeline Orchestration

```python
import json
import time
from pathlib import Path


class VisionPipeline:
    def __init__(self, config):
        self.config = config
        self.detector = Detector(config)
        self.classifier = Classifier(config)
        config.output_dir.mkdir(parents=True, exist_ok=True)

    def process(self, image_source):
        start_time = time.perf_counter()

        image = load_image(image_source)
        detections = self.detector.detect(image)
        crops = self.detector.crop_detections(image, detections)

        classifications = []
        for crop in crops:
            cls_name, cls_conf = self.classifier.classify(crop)
            classifications.append((cls_name, cls_conf))

        elapsed = time.perf_counter() - start_time

        result_image = draw_results(image, detections, classifications)

        report = {
            "num_detections": len(detections),
            "processing_time_ms": round(elapsed * 1000, 1),
            "objects": [],
        }
        for det, (cls_name, cls_conf) in zip(detections, classifications):
            report["objects"].append({
                "detection_class": det.class_name,
                "detection_confidence": round(det.confidence, 3),
                "fine_class": cls_name,
                "fine_confidence": round(cls_conf, 3),
                "bbox": [round(v, 1) for v in det.bbox],
            })

        return result_image, report

    def process_batch(self, image_sources):
        results = []
        for source in image_sources:
            result_image, report = self.process(source)
            results.append((source, result_image, report))
        return results
```

## Step 8 — ONNX Export

```python
import torch


def export_detector_onnx(config, output_path="detector.onnx"):
    from ultralytics import YOLO
    model = YOLO(config.detection_model)
    model.export(format="onnx", imgsz=config.input_size[0])


def export_classifier_onnx(config, output_path="classifier.onnx"):
    model = CLIPModel.from_pretrained(config.classification_model)
    model.eval()

    dummy_pixel = torch.randn(1, 3, 224, 224)
    dummy_ids = torch.randint(0, 1000, (1, 77))
    dummy_mask = torch.ones(1, 77, dtype=torch.long)

    torch.onnx.export(
        model,
        (dummy_ids, dummy_pixel, dummy_mask),
        output_path,
        input_names=["input_ids", "pixel_values", "attention_mask"],
        output_names=["logits_per_image", "logits_per_text"],
        dynamic_axes={
            "input_ids": {0: "batch"},
            "pixel_values": {0: "batch"},
            "attention_mask": {0: "batch"},
        },
        opset_version=17,
    )
```

## Step 9 — Evaluation

```python
import numpy as np


def compute_detection_metrics(predictions, ground_truths, iou_threshold=0.5):
    tp, fp, fn = 0, 0, 0

    for pred_boxes, gt_boxes in zip(predictions, ground_truths):
        matched_gt = set()

        for pred in pred_boxes:
            best_iou = 0.0
            best_gt_idx = -1

            for gt_idx, gt in enumerate(gt_boxes):
                iou = compute_iou(pred, gt)
                if iou > best_iou and gt_idx not in matched_gt:
                    best_iou = iou
                    best_gt_idx = gt_idx

            if best_iou >= iou_threshold:
                tp += 1
                matched_gt.add(best_gt_idx)
            else:
                fp += 1

        fn += len(gt_boxes) - len(matched_gt)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)
          if (precision + recall) > 0 else 0.0)

    return {"precision": precision, "recall": recall, "f1": f1}
```

## Step 10 — Main Entry Point

```python
from pathlib import Path
import json


def main():
    config = Config(
        device="cuda" if torch.cuda.is_available() else "cpu",
        output_dir=Path("outputs"),
    )

    pipeline = VisionPipeline(config)

    image_path = "test_image.jpg"
    result_image, report = pipeline.process(image_path)

    output_path = config.output_dir / "result.jpg"
    cv2.imwrite(str(output_path), result_image)

    report_path = config.output_dir / "report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"Detections: {report['num_detections']}")
    print(f"Time: {report['processing_time_ms']} ms")
    for obj in report["objects"]:
        print(f"  {obj['fine_class']} ({obj['fine_confidence']:.0%})")


if __name__ == "__main__":
    main()
```

## Capstone Exercises

These are larger projects. Pick at least two.

1. **Build the full system.** Implement all modules above. Test on 20 images.
   Generate a JSON report summarizing all detections and classifications.
   Include processing time per image.

2. **Add segmentation.** Replace or augment the bounding box detector with
   Mask R-CNN. Visualize instance masks on the output images. How does this
   affect processing time?

3. **Deploy to ONNX.** Export both the detector and classifier to ONNX.
   Replace PyTorch inference with ONNX Runtime. Benchmark FP32 vs INT8
   quantized. Report speedup.

4. **Video pipeline.** Extend the system to process video. Add object
   tracking (DeepSORT or ByteTrack) so that each object gets a persistent
   ID across frames. Output an annotated video.

5. **Full evaluation.** Create a small labeled test set (30+ images with
   ground truth boxes and classes). Compute precision, recall, F1, and mAP.
   Write a summary of where the system succeeds and fails.

## What You've Learned

```
  +----------------------------------------------+
  | Lesson | Topic                                |
  +--------+--------------------------------------+
  | 01     | Pixels, tensors, color spaces        |
  | 02     | OpenCV image operations               |
  | 03     | Convolution, Sobel, Canny            |
  | 04     | HOG, SIFT, ORB features              |
  | 05     | CNN architecture and design          |
  | 06     | LeNet to ResNet evolution             |
  | 07     | Transfer learning and fine-tuning     |
  | 08     | Object detection (YOLO, Faster R-CNN)|
  | 09     | Semantic segmentation (U-Net)        |
  | 10     | Instance segmentation (Mask R-CNN)   |
  | 11     | Vision Transformers (ViT, Swin)      |
  | 12     | CLIP, multimodal, zero-shot          |
  | 13     | GANs, diffusion, style transfer      |
  | 14     | Video analysis and tracking          |
  | 15     | ONNX, quantization, mobile deploy    |
  | 16     | End-to-end vision system (this one)  |
  +--------+--------------------------------------+
```

You now have the skills to build production vision systems. Go build
something that sees.

---

**Track complete. Return to [Track Overview](00-roadmap.md)**
