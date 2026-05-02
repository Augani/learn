# Lesson 04 — Feature Extraction (Classical)

## Before Deep Learning

Before CNNs conquered vision, engineers handcrafted features. They asked:
"What makes a corner a corner? What makes a texture unique?" Then they wrote
math to capture those properties.

Think of it like a detective's sketch artist. Instead of a photograph, you
describe the suspect with specific features: sharp jaw, round eyes, bushy
eyebrows. Classical feature extraction does the same for images.

## Corners — Harris and Shi-Tomasi

A corner is a point where edges meet from multiple directions. Flat areas
and straight edges are boring — corners are distinctive.

```
  Flat area         Edge              Corner
  +--------+        +--------+        +--------+
  |        |        |  |     |        |  +--   |
  |        |        |  |     |        |  |     |
  |        |        |  |     |        |        |
  +--------+        +--------+        +--------+
  Shift window      Shift along edge  Shift any direction
  in any direction:  = no change      = BIG change
  no change         Shift across
                    = change
```

```python
import cv2
import numpy as np

img = cv2.imread("photo.jpg")
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

corners = cv2.goodFeaturesToTrack(gray, maxCorners=100, qualityLevel=0.01,
                                  minDistance=10)

for corner in corners:
    x, y = corner.ravel().astype(int)
    cv2.circle(img, (x, y), 5, (0, 255, 0), -1)
```

## HOG — Histogram of Oriented Gradients

HOG captures the **shape** of objects by looking at gradient directions
in local regions. It was the backbone of pedestrian detection for years.

```
  Image -> Compute gradients -> Divide into cells -> Histogram per cell

  Cell (8x8 pixels)          Histogram of gradient directions

                               |       ___
   / / / / | | \ \             |      |   |
   / / / / | | \ \             |  _   |   |
   / / / / | | \ \             | | |  |   |  _
   / / / / | | \ \             | | |  |   | | |
                               +-+--+--+--+-+---> angle
                                0  45  90 135 180

  Each cell produces a histogram with 9 bins (0-180 degrees).
  Cells are grouped into blocks and normalized for lighting.
```

```python
from skimage.feature import hog
from skimage import io

image = io.imread("person.jpg", as_gray=True)

features, hog_image = hog(image,
                          orientations=9,
                          pixels_per_cell=(8, 8),
                          cells_per_block=(2, 2),
                          visualize=True)

print(f"Feature vector length: {features.shape[0]}")
```

HOG + SVM was the standard pedestrian detector before deep learning. Dalal
and Triggs published it in 2005 and it dominated for nearly a decade.

## SIFT — Scale-Invariant Feature Transform

SIFT finds keypoints that survive rotation, scaling, and lighting changes.
It's the Swiss Army knife of classical features.

```
  Scale Space (Gaussian Pyramid)

  +============+
  |  Original  |  sigma = 1.0
  +============+
       |
  +=========+
  |  Blur 1 |  sigma = 1.6
  +=========+
       |
  +======+
  | Blur2|  sigma = 2.56
  +======+
       |                    At each scale, find pixels that are
  +===+                     local extrema compared to neighbors
  | B3|  sigma = 4.1        in space AND across scales.
  +===+                     Those are SIFT keypoints.

  Each keypoint gets a 128-dim descriptor built from local gradients.
```

```python
import cv2

img = cv2.imread("photo.jpg")
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

sift = cv2.SIFT_create()
keypoints, descriptors = sift.detectAndCompute(gray, None)

print(f"Found {len(keypoints)} keypoints")
print(f"Descriptor shape: {descriptors.shape}")

img_kp = cv2.drawKeypoints(gray, keypoints, None,
                            flags=cv2.DRAW_MATCHES_FLAGS_DRAW_RICH_KEYPOINTS)
```

Each descriptor is a 128-dimensional vector. Two keypoints with similar
descriptors likely represent the same real-world point, even from different
viewpoints.

## ORB — Oriented FAST and Rotated BRIEF

ORB is the open-source, fast alternative to SIFT. It uses binary descriptors
instead of floating-point, making matching much faster.

```
  SIFT descriptor: [0.12, 0.05, 0.89, ..., 0.31]  128 floats
  ORB descriptor:  [1, 0, 1, 1, 0, ..., 1, 0]     256 bits

  Matching SIFT: Euclidean distance (slow)
  Matching ORB:  Hamming distance = count different bits (fast!)
```

```python
orb = cv2.ORB_create(nfeatures=500)
keypoints, descriptors = orb.detectAndCompute(gray, None)

print(f"Found {len(keypoints)} keypoints")
print(f"Descriptor shape: {descriptors.shape}")
print(f"Descriptor dtype: {descriptors.dtype}")
```

## Feature Matching

The power of features is **matching**. Find the same object in two different
images:

```
  Image A                    Image B
  +-----------+              +-----------+
  |     *     |              |        *  |
  |   * | *   |    match     |      * |* |
  |     *     |   ======>    |        *  |
  |  *     *  |              |     *   * |
  +-----------+              +-----------+
  Keypoints                  Same object, different angle
```

```python
img1 = cv2.imread("book1.jpg", cv2.IMREAD_GRAYSCALE)
img2 = cv2.imread("book2.jpg", cv2.IMREAD_GRAYSCALE)

orb = cv2.ORB_create(nfeatures=1000)
kp1, des1 = orb.detectAndCompute(img1, None)
kp2, des2 = orb.detectAndCompute(img2, None)

bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
matches = bf.match(des1, des2)
matches = sorted(matches, key=lambda m: m.distance)

result = cv2.drawMatches(img1, kp1, img2, kp2, matches[:20], None,
                          flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS)
```

For SIFT, use `cv2.NORM_L2` instead of `cv2.NORM_HAMMING`, and consider
Lowe's ratio test:

```python
sift = cv2.SIFT_create()
kp1, des1 = sift.detectAndCompute(img1, None)
kp2, des2 = sift.detectAndCompute(img2, None)

bf = cv2.BFMatcher(cv2.NORM_L2)
raw_matches = bf.knnMatch(des1, des2, k=2)

good_matches = []
for m, n in raw_matches:
    if m.distance < 0.75 * n.distance:
        good_matches.append(m)
```

## Homography — Finding Transformations

With enough good matches, you can compute the geometric transformation
between two views:

```python
if len(good_matches) >= 4:
    src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches])
    dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches])

    src_pts = src_pts.reshape(-1, 1, 2)
    dst_pts = dst_pts.reshape(-1, 1, 2)

    H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
    print(f"Homography matrix:\n{H}")
```

This is how panorama stitching works — find matching features in overlapping
photos, compute homographies, warp and blend.

## Classical vs. Learned Features

```
  +------------------+-------------------+--------------------+
  | Property         | Classical (SIFT)  | Learned (CNN)      |
  +------------------+-------------------+--------------------+
  | Design           | Hand-crafted      | Data-driven        |
  | Speed            | Fast at inference | Needs GPU          |
  | Interpretable    | Yes               | Mostly no          |
  | Task-specific    | General-purpose   | Task-optimized     |
  | Data needed      | None              | Lots               |
  | Accuracy (2024)  | Good              | State of the art   |
  +------------------+-------------------+--------------------+
```

Classical features aren't dead. They're used in SLAM, AR, and anywhere
you need real-time matching without a GPU.

## Exercises

1. Detect SIFT keypoints on a photo taken from two different angles. Match
   the keypoints and draw the top 30 matches. How many survive the ratio
   test?

2. Compare ORB and SIFT on the same image pair. Time both with
   `time.perf_counter()`. Which is faster? Which produces better matches?

3. Use `cv2.goodFeaturesToTrack` on a chessboard image. Do the detected
   corners align with the actual board corners?

4. Compute HOG features for 10 images of cats and 10 images of dogs. Train
   an SVM classifier on the HOG vectors. What accuracy do you get?

5. Build a simple panorama stitcher: take two overlapping photos, find
   matches, compute homography, warp one onto the other, and blend.

---

**Next: [Lesson 05 — CNNs Revisited](05-cnns-revisited.md)**
