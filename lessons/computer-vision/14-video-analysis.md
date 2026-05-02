# Lesson 14 — Video Analysis

## Images Over Time

A video is just a sequence of images (frames) played fast enough to create
the illusion of motion. A 30fps video gives you 30 chances per second to
analyze the scene. The challenge: leveraging temporal information — how
things change between frames.

```
  Frame 1      Frame 2      Frame 3      Frame 4
  +------+     +------+     +------+     +------+
  |  O   |     |   O  |     |    O |     |     O|
  |      |     |      |     |      |     |      |
  +------+     +------+     +------+     +------+
  Ball at left  Moving right  Still moving  Far right

  Single frame: "there's a ball"
  Multiple frames: "the ball is moving right"
```

## Reading Video with OpenCV

```python
import cv2

cap = cv2.VideoCapture("video.mp4")

if not cap.isOpened():
    raise RuntimeError("Cannot open video")

fps = cap.get(cv2.CAP_PROP_FPS)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

print(f"Resolution: {width}x{height}")
print(f"FPS: {fps}")
print(f"Duration: {total_frames / fps:.1f}s")

frames = []
while True:
    ret, frame = cap.read()
    if not ret:
        break
    frames.append(frame)

cap.release()
print(f"Read {len(frames)} frames")
```

## Optical Flow

Optical flow estimates the motion of each pixel between consecutive frames.
It answers: "Where did each pixel go?"

```
  Frame t          Frame t+1        Flow field

  +------+         +------+         +------+
  |  ##  |         |   ## |         |  ->->|
  |  ##  |         |   ## |         |  ->->|
  |      |         |      |         |      |
  +------+         +------+         +------+

  Each arrow shows the displacement (dx, dy) of that pixel.
  The block moved 1 pixel to the right.
```

**Dense optical flow** computes motion for every pixel. **Sparse optical
flow** tracks only selected points (faster).

```python
import numpy as np

prev_gray = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
curr_gray = cv2.cvtColor(frames[1], cv2.COLOR_BGR2GRAY)

flow = cv2.calcOpticalFlowFarneback(
    prev_gray, curr_gray, None,
    pyr_scale=0.5, levels=3, winsize=15,
    iterations=3, poly_n=5, poly_sigma=1.2, flags=0
)

mag, ang = cv2.cartToPolar(flow[..., 0], flow[..., 1])

hsv = np.zeros((*prev_gray.shape, 3), dtype=np.uint8)
hsv[..., 0] = ang * 180 / np.pi / 2
hsv[..., 1] = 255
hsv[..., 2] = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX)
flow_rgb = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
```

## Sparse Optical Flow — Lucas-Kanade

Track specific feature points across frames:

```python
prev_gray = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)

feature_params = dict(maxCorners=100, qualityLevel=0.3,
                      minDistance=7, blockSize=7)
points = cv2.goodFeaturesToTrack(prev_gray, mask=None, **feature_params)

lk_params = dict(winSize=(15, 15), maxLevel=2,
                 criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT,
                           10, 0.03))

for i in range(1, len(frames)):
    curr_gray = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
    next_points, status, _ = cv2.calcOpticalFlowPyrLK(
        prev_gray, curr_gray, points, None, **lk_params
    )
    good_new = next_points[status == 1]
    good_old = points[status == 1]

    points = good_new.reshape(-1, 1, 2)
    prev_gray = curr_gray
```

## Object Tracking

Tracking follows a specific object across frames after you identify it
in the first frame.

```
  Frame 1            Frame 10           Frame 20
  +----------+       +----------+       +----------+
  | [person] |       |  [person]|       |   [perso |
  |          |       |          |       |   n]     |
  +----------+       +----------+       +----------+
  Initialize         Auto-tracked       Still tracked
  with bbox          (no detection      despite partial
                      needed)           occlusion
```

```python
tracker = cv2.TrackerCSRT_create()

frame = frames[0]
bbox = cv2.selectROI("Select Object", frame, fromCenter=False)
cv2.destroyAllWindows()

tracker.init(frame, bbox)

for frame in frames[1:]:
    success, bbox = tracker.update(frame)
    if success:
        x, y, w, h = [int(v) for v in bbox]
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
```

## Deep Learning for Tracking — DeepSORT

Modern trackers combine detection with appearance features:

```
  Each frame:
  1. Run object detector (YOLO)
  2. Extract appearance features for each detection
  3. Match detections to existing tracks using:
     - Bounding box IoU (spatial proximity)
     - Appearance similarity (re-ID features)
     - Kalman filter prediction (motion model)
  4. Update tracks, create new ones, remove lost ones

  +=========+     +=========+     +=========+
  | Frame 1 |     | Frame 2 |     | Frame 3 |
  | Det: A,B| --> | Det: A,B| --> | Det: A,C|
  | Track 1=A|    | Track 1=A|    | Track 1=A|
  | Track 2=B|    | Track 2=B|    | Track 2=? (lost B)
  +=========+     +=========+     | Track 3=C|
                                  +=========+
```

## Action Recognition

Classify what action is happening in a video clip. Common approaches:

```
  Approach 1: 3D CNNs (C3D, I3D, SlowFast)

  Video clip (T frames)
       |
  3D Convolutions (process space AND time)
       |
  Temporal pooling
       |
  Classification: "playing basketball"

  Approach 2: Frame-level features + temporal model

  Frame 1 --> CNN --> feat1 \
  Frame 2 --> CNN --> feat2  |-> LSTM/Transformer -> "playing basketball"
  Frame 3 --> CNN --> feat3 /
  ...
```

```python
import torch
from torchvision.models.video import r3d_18

model = r3d_18(weights="DEFAULT")
model.eval()

video_tensor = torch.randn(1, 3, 16, 112, 112)

with torch.no_grad():
    output = model(video_tensor)
    pred_class = output.argmax(1).item()
    print(f"Predicted class: {pred_class}")
```

## Video Classification Pipeline

```python
import torchvision.transforms as T

def load_video_clip(video_path, num_frames=16, size=112):
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    indices = np.linspace(0, total - 1, num_frames, dtype=int)

    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret:
            break
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame = cv2.resize(frame, (size, size))
        frames.append(frame)

    cap.release()

    clip = np.array(frames, dtype=np.float32) / 255.0
    clip = torch.from_numpy(clip).permute(3, 0, 1, 2)
    return clip.unsqueeze(0)
```

## Writing Video Output

```python
def save_video(frames, output_path, fps=30.0):
    if not frames:
        return

    h, w = frames[0].shape[:2]
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_path, fourcc, fps, (w, h))

    for frame in frames:
        writer.write(frame)

    writer.release()
```

## Background Subtraction

Separate moving foreground from static background:

```python
bg_subtractor = cv2.createBackgroundSubtractorMOG2(
    history=500, varThreshold=16, detectShadows=True
)

cap = cv2.VideoCapture("video.mp4")
while True:
    ret, frame = cap.read()
    if not ret:
        break

    fg_mask = bg_subtractor.apply(frame)
    fg_mask = cv2.threshold(fg_mask, 200, 255, cv2.THRESH_BINARY)[1]

cap.release()
```

## Exercises

1. Compute dense optical flow between consecutive frames of a short video.
   Visualize the flow as a color-coded image (hue=direction,
   brightness=magnitude). Save the result as a new video.

2. Implement a simple motion detector: use frame differencing to detect
   regions with significant movement. Draw bounding boxes around moving
   objects.

3. Track an object across a video using OpenCV's CSRT tracker. Count how
   many frames the tracker successfully follows the object before losing it.

4. Sample 16 evenly-spaced frames from a video. Run them through a
   pretrained R3D-18 model. What action does it predict? Try with 3
   different videos.

5. Build a simple "security camera" system: use background subtraction to
   detect motion, save frames with detected motion to disk with timestamps,
   and create an alert log file.

---

**Next: [Lesson 15 — Edge Deployment](15-edge-deployment.md)**
