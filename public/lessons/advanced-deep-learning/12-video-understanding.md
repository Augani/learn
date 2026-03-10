# Lesson 12: Video Understanding

> Video is images plus time. A single frame tells you "a person
> is near a ball." A sequence of frames tells you "a person is
> kicking a ball." Temporal reasoning -- understanding how things
> change over time -- is what makes video understanding hard and
> interesting.

---

## Why Video Is Hard

```
Image understanding:
  1 frame  --> "person, ball, field"

Video understanding:
  Frame 1: person standing, ball on ground
  Frame 2: person's leg swinging back
  Frame 3: foot contacting ball
  Frame 4: ball flying through air
  Frame 5: ball entering goal

  --> "person scored a goal"

You need to understand:
  - What's in each frame (spatial)
  - How things change between frames (temporal)
  - What the sequence MEANS (semantic)
```

```
The data problem:

  1 image:   3 x 224 x 224  =    150K values
  1 second:  3 x 224 x 224 x 30 = 4.5M values  (at 30 fps)
  10 seconds:                    = 45M values

  Video is 30x more data per second than a single image.
  You can't just feed every frame into a model.
```

---

## Approach 1: Frame Sampling

Don't use every frame. Sample intelligently.

```
30 fps video (10 seconds = 300 frames):

All frames:
  |||||||||||||||||||||||||||||||||||||||||||||||||...

Uniform sampling (16 frames):
  |   |   |   |   |   |   |   |   |   |   |   |...

Key idea: most adjacent frames are nearly identical.
16 uniformly sampled frames capture the important changes.
```

```python
import torch
import torchvision.io as io


def sample_frames(video_path, num_frames=16):
    video, audio, info = io.read_video(video_path, pts_unit="sec")
    total_frames = video.shape[0]

    if total_frames <= num_frames:
        indices = torch.arange(total_frames)
    else:
        indices = torch.linspace(0, total_frames - 1, num_frames).long()

    return video[indices]


frames = sample_frames("video.mp4", num_frames=16)
print(f"Sampled shape: {frames.shape}")
```

---

## Approach 2: 3D CNNs

Extend 2D convolutions to 3D -- convolve across space AND time.

```
2D Conv (image):            3D Conv (video):

  Filter slides over         Filter slides over
  height and width           height, width, AND time

  +-------+                  +-------+
  |       |                  |  /    /|
  | [3x3] |                 | / [3x3x3]
  |       |                  |/______/|
  +-------+                  +-------+

  Output: spatial features   Output: spatiotemporal features
```

```python
import torch.nn as nn


class Simple3DCNN(nn.Module):
    def __init__(self, num_classes):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv3d(3, 64, kernel_size=3, padding=1),
            nn.BatchNorm3d(64),
            nn.ReLU(),
            nn.MaxPool3d(kernel_size=(1, 2, 2)),
            nn.Conv3d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm3d(128),
            nn.ReLU(),
            nn.MaxPool3d(kernel_size=(2, 2, 2)),
            nn.Conv3d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm3d(256),
            nn.ReLU(),
            nn.AdaptiveAvgPool3d(1),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        return self.classifier(self.features(x))
```

---

## Approach 3: Two-Stream Networks

Process spatial (appearance) and temporal (motion) separately.

```
Video
  |
  +--> Spatial stream (RGB frames)
  |    [What things look like]
  |         |
  |         v
  |    CNN --> spatial features
  |                              \
  |                               +---> Fuse --> classification
  |                              /
  +--> Temporal stream (optical flow)
       [How things move]
            |
            v
       CNN --> motion features

Optical flow: shows movement direction per pixel

  Frame t:        Frame t+1:      Optical flow:
  +--------+      +--------+      +--------+
  |   O    |      |    O   |      |   --> O|  (ball moved right)
  |   |    |      |    |   |      |   --> ||
  |  /\    |      |   /\   |      |   --> /\ |
  +--------+      +--------+      +--------+
```

---

## Approach 4: Video Transformers (TimeSformer, ViViT)

Apply self-attention across both space and time.

```
Video frames --> patch each frame --> add temporal position

  Frame 1:  [p1] [p2] [p3] ... [pN]
  Frame 2:  [p1] [p2] [p3] ... [pN]
  ...
  Frame T:  [p1] [p2] [p3] ... [pN]

TimeSformer attention strategies:

  Space-only:     Each patch attends to patches in same frame
  Time-only:      Each patch attends to same position across frames
  Divided ST:     Alternate space-only and time-only attention
  Joint ST:       Full attention over all patches in all frames
                  (most powerful but most expensive)

  Divided Space-Time (most practical):

  Layer 1: Spatial attention (within each frame)
    Frame 1:  [p1] <-> [p2] <-> [p3]
    Frame 2:  [p1] <-> [p2] <-> [p3]

  Layer 2: Temporal attention (across frames)
    [p1_frame1] <-> [p1_frame2] <-> [p1_frame3]
    [p2_frame1] <-> [p2_frame2] <-> [p2_frame3]
```

---

## Action Recognition

The most common video task: classify what action is happening.

```
Common action recognition datasets:

+------------------+----------+----------+
| Dataset          | Classes  | Videos   |
+------------------+----------+----------+
| Kinetics-400     | 400      | 300K     |
| Kinetics-700     | 700      | 650K     |
| UCF-101          | 101      | 13K      |
| Something-v2     | 174      | 220K     |
| ActivityNet      | 200      | 20K      |
+------------------+----------+----------+
```

```python
from torchvision.models.video import r3d_18, R3D_18_Weights

model = r3d_18(weights=R3D_18_Weights.KINETICS400_V1)
model.eval()

preprocess = R3D_18_Weights.KINETICS400_V1.transforms()

video_clip = sample_frames("action.mp4", num_frames=16)
video_clip = video_clip.permute(3, 0, 1, 2).float() / 255.0
video_clip = preprocess(video_clip).unsqueeze(0)

with torch.no_grad():
    output = model(video_clip)
    pred_class = output.argmax(dim=1).item()
```

---

## Temporal Action Detection

Not just "what" but "when" -- find action segments in long videos.

```
Long video timeline:

  0s    10s    20s    30s    40s    50s    60s
  |------|------|------|------|------|------|
  [nothing] [running] [jumping] [nothing] [waving]

Output:
  ("running",  10s - 22s, confidence=0.9)
  ("jumping",  22s - 32s, confidence=0.85)
  ("waving",   48s - 58s, confidence=0.7)

This is like object detection, but in TIME instead of space.
```

---

## Video-Language Models

Combine video understanding with language.

```
Video + "What is the person doing?" --> "Playing basketball"

  Video frames
       |
       v
  [Video Encoder]  --> temporal visual features
                            |
                            v
  Question -------> [Language Model] --> Answer

Models:
- VideoBERT: BERT with video tokens
- Video-LLaVA: LLaVA extended to video
- InternVideo: large-scale video foundation model
```

```python
from transformers import VideoLlavaProcessor, VideoLlavaForConditionalGeneration
import numpy as np

model_name = "LanguageBind/Video-LLaVA-7B-hf"
processor = VideoLlavaProcessor.from_pretrained(model_name)
model = VideoLlavaForConditionalGeneration.from_pretrained(
    model_name, torch_dtype=torch.float16, device_map="auto"
)

frames = sample_frames("cooking.mp4", num_frames=8)
frames_np = frames.numpy()

prompt = "USER: <video>\nWhat is happening in this video?\nASSISTANT:"

inputs = processor(text=prompt, videos=frames_np, return_tensors="pt").to("cuda")

with torch.no_grad():
    output = model.generate(**inputs, max_new_tokens=100)

response = processor.decode(output[0], skip_special_tokens=True)
print(response)
```

---

## Efficient Video Processing

```
+-------------------------------+----------------------------------+
| Technique                     | Idea                             |
+-------------------------------+----------------------------------+
| Frame sampling                | Use 8-16 frames, not all 300    |
+-------------------------------+----------------------------------+
| Spatial downsampling          | Resize frames to 112x112 or     |
|                               | 224x224                          |
+-------------------------------+----------------------------------+
| Temporal stride               | Process every Nth frame          |
+-------------------------------+----------------------------------+
| Token merging                 | Merge similar patch tokens to   |
|                               | reduce sequence length           |
+-------------------------------+----------------------------------+
| Clip-level processing         | Split video into short clips,   |
|                               | process each, then aggregate    |
+-------------------------------+----------------------------------+
```

```python
def process_long_video(video_path, model, clip_length=16, stride=8):
    video, _, _ = io.read_video(video_path, pts_unit="sec")
    total_frames = video.shape[0]

    all_features = []
    for start in range(0, total_frames - clip_length + 1, stride):
        clip = video[start:start + clip_length]
        clip = clip.permute(3, 0, 1, 2).float().unsqueeze(0) / 255.0

        with torch.no_grad():
            features = model(clip)
        all_features.append(features)

    aggregated = torch.stack(all_features).mean(dim=0)
    return aggregated
```

---

## Exercises

1. **Frame sampling**: Load a video, sample 4, 8, 16, and 32
   frames uniformly. Visualize them. How many frames do you
   need to understand the action?

2. **Action classification**: Use a pretrained R3D-18 to classify
   5 different video clips. Report the top-3 predicted actions
   for each.

3. **3D CNN**: Build the Simple3DCNN above and train it on a
   small video dataset (use UCF-101 subset). Compare to using
   a 2D CNN on individual frames + majority voting.

4. **Temporal detection**: Given a 60-second video, split it
   into 2-second clips, classify each clip, and produce a
   timeline of detected actions.

5. **Video captioning**: Use a video-language model to generate
   captions for 5 videos. Rate the captions for accuracy.
   What temporal relationships does the model capture well?

---

**Next**: [Lesson 13 - Distributed Training](./13-distributed-training.md)
