# Lesson 03 — Filters & Edges

## The Texture Analogy

Close your eyes and run your fingertips across a table. Smooth, smooth,
smooth — then a sudden bump where the table meets the edge. Your fingers
detected a **gradient** — a rapid change in height.

Edge detection does the same thing with pixel intensities. Smooth areas have
small gradients. Edges — where objects meet backgrounds — have large gradients.

## What Is Convolution?

Convolution slides a small grid of numbers (a **kernel**) across the image,
multiplying and summing at every position. It's like a tiny magnifying glass
that asks one question at each spot.

```
  Image patch        Kernel         Output pixel
  (3x3 window)       (3x3)

  +---+---+---+    +----+----+----+
  | 10| 20| 30|    | -1 |  0 |  1 |     Multiply element-wise,
  +---+---+---+  * +----+----+----+  =  then sum all 9 products
  | 40| 50| 60|    | -2 |  0 |  2 |     = one number
  +---+---+---+    +----+----+----+
  | 70| 80| 90|    | -1 |  0 |  1 |
  +---+---+---+    +----+----+----+

  (-1*10)+(0*20)+(1*30)+(-2*40)+(0*50)+(2*60)+(-1*70)+(0*80)+(1*90)
  = -10 + 0 + 30 - 80 + 0 + 120 - 70 + 0 + 90
  = 80
```

Slide this kernel across every pixel and you get a new image where each
value measures "how much the brightness changes left-to-right."

## Convolution by Hand

Let's work through a full 5x5 image with a 3x3 kernel:

```
  Image (5x5)                  Kernel (3x3)
  +---+---+---+---+---+       +----+----+----+
  |  0|  0|  0|  0|  0|       |  1 |  1 |  1 |
  +---+---+---+---+---+       +----+----+----+
  |  0|  0|  0|  0|  0|       |  1 | -8 |  1 |   Laplacian
  +---+---+---+---+---+       +----+----+----+   (edge detector)
  |  0|  0|255|  0|  0|       |  1 |  1 |  1 |
  +---+---+---+---+---+       +----+----+----+
  |  0|  0|  0|  0|  0|
  +---+---+---+---+---+
  |  0|  0|  0|  0|  0|
  +---+---+---+---+---+

  Center the kernel on pixel (2,2) which is 255:
  Sum = (0+0+0+0+(-8*255)+0+0+0+0) = -2040

  Center on pixel (1,2) which is 0:
  Sum = (0+0+0+0+(-8*0)+0+0+255+0) = 255

  The kernel LIGHTS UP near the bright dot = edge detected!
```

## Common Kernels

```
  Identity        Sharpen         Box Blur (3x3)
  +---+---+---+   +----+----+----+  +-----+-----+-----+
  | 0 | 0 | 0 |   |  0 | -1 |  0|  | 1/9 | 1/9 | 1/9 |
  +---+---+---+   +----+----+----+  +-----+-----+-----+
  | 0 | 1 | 0 |   | -1 |  5 | -1|  | 1/9 | 1/9 | 1/9 |
  +---+---+---+   +----+----+----+  +-----+-----+-----+
  | 0 | 0 | 0 |   |  0 | -1 |  0|  | 1/9 | 1/9 | 1/9 |
  +---+---+---+   +----+----+----+  +-----+-----+-----+
```

## Implementing Convolution from Scratch

```python
import numpy as np

def convolve2d(image, kernel):
    ih, iw = image.shape
    kh, kw = kernel.shape
    pad_h, pad_w = kh // 2, kw // 2

    padded = np.pad(image, ((pad_h, pad_h), (pad_w, pad_w)), mode="constant")
    output = np.zeros_like(image, dtype=np.float64)

    for y in range(ih):
        for x in range(iw):
            region = padded[y:y + kh, x:x + kw]
            output[y, x] = np.sum(region * kernel)

    return output
```

This is painfully slow. OpenCV and PyTorch use optimized C++ and GPU code.
But understanding the loop matters.

## Sobel Operator — Directional Edges

Sobel detects edges in one direction at a time.

```
  Sobel X (horizontal edges)    Sobel Y (vertical edges)
  +----+----+----+              +----+----+----+
  | -1 |  0 |  1 |              | -1 | -2 | -1 |
  +----+----+----+              +----+----+----+
  | -2 |  0 |  2 |              |  0 |  0 |  0 |
  +----+----+----+              +----+----+----+
  | -1 |  0 |  1 |              |  1 |  2 |  1 |
  +----+----+----+              +----+----+----+

  Gradient magnitude = sqrt(Gx^2 + Gy^2)
  Gradient direction = arctan(Gy / Gx)
```

```python
import cv2
import numpy as np

img = cv2.imread("photo.jpg", cv2.IMREAD_GRAYSCALE)

sobel_x = cv2.Sobel(img, cv2.CV_64F, 1, 0, ksize=3)
sobel_y = cv2.Sobel(img, cv2.CV_64F, 0, 1, ksize=3)

magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
magnitude = np.clip(magnitude, 0, 255).astype(np.uint8)
```

## Canny Edge Detection

Canny is the gold standard. It chains multiple steps:

```
  Input Image
       |
       v
  [1] Gaussian Blur      — reduce noise
       |
       v
  [2] Sobel Gradients    — find edge strength + direction
       |
       v
  [3] Non-Max Suppression — thin edges to 1 pixel wide
       |
       v
  [4] Hysteresis Threshold — keep strong edges, trace weak
       |                     ones only if connected to strong
       v
  Clean Edge Map
```

```
  Non-Max Suppression explained:

  Before:                After:
  . . X X X . .          . . . X . . .
  . X X X X X .          . . . X . . .
  . . X X X . .          . . . X . . .

  Only the local maximum along the gradient direction survives.
```

```python
edges = cv2.Canny(img, threshold1=50, threshold2=150)
```

The two thresholds control sensitivity:
- Pixels above `threshold2` = definitely an edge
- Pixels below `threshold1` = definitely not an edge
- Pixels between = edge only if connected to a definite edge

## Choosing Canny Thresholds

A common heuristic uses the image median:

```python
def auto_canny(image, sigma=0.33):
    median = np.median(image)
    lower = int(max(0, (1.0 - sigma) * median))
    upper = int(min(255, (1.0 + sigma) * median))
    return cv2.Canny(image, lower, upper)
```

## Laplacian — Edges in All Directions

Laplacian detects edges regardless of direction by computing the second
derivative:

```python
laplacian = cv2.Laplacian(img, cv2.CV_64F)
laplacian = np.uint8(np.absolute(laplacian))
```

It's noisier than Canny but sometimes useful for detecting blobs.

## Convolution in PyTorch

In deep learning, kernels are **learned**, not hand-crafted. But the
operation is the same:

```python
import torch
import torch.nn.functional as F

img_tensor = torch.from_numpy(img).float().unsqueeze(0).unsqueeze(0)

sobel_x_kernel = torch.tensor([[-1, 0, 1],
                                [-2, 0, 2],
                                [-1, 0, 1]], dtype=torch.float32)
sobel_x_kernel = sobel_x_kernel.unsqueeze(0).unsqueeze(0)

edges = F.conv2d(img_tensor, sobel_x_kernel, padding=1)
print(edges.shape)
```

The connection: hand-designed filters (Sobel, Laplacian) were state of the
art for decades. CNNs replaced them by learning the optimal kernels directly
from data. But the math underneath is identical.

## Comparison Pipeline

```python
import matplotlib.pyplot as plt

img = cv2.imread("photo.jpg", cv2.IMREAD_GRAYSCALE)

results = {
    "Original": img,
    "Sobel X": cv2.convertScaleAbs(cv2.Sobel(img, cv2.CV_64F, 1, 0)),
    "Sobel Y": cv2.convertScaleAbs(cv2.Sobel(img, cv2.CV_64F, 0, 1)),
    "Laplacian": cv2.convertScaleAbs(cv2.Laplacian(img, cv2.CV_64F)),
    "Canny": cv2.Canny(img, 50, 150),
}

fig, axes = plt.subplots(1, 5, figsize=(20, 4))
for ax, (name, result) in zip(axes, results.items()):
    ax.imshow(result, cmap="gray")
    ax.set_title(name)
    ax.axis("off")
plt.tight_layout()
plt.show()
```

## Exercises

1. Implement `convolve2d` from scratch and apply the sharpening kernel to a
   blurry image. Compare your output to `cv2.filter2D`.

2. Apply Sobel X and Sobel Y to a photo. Compute the gradient magnitude and
   direction. Visualize the direction as a color map (hint: use HSV where
   hue = direction, value = magnitude).

3. Use Canny with different threshold pairs: (10, 50), (50, 150), (100, 200).
   Create a 1x3 grid showing how sensitivity changes.

4. Write `auto_canny` and test it on 5 different images. Does the sigma=0.33
   heuristic produce reasonable edges for all of them?

5. Create a custom "emboss" kernel and apply it with `cv2.filter2D`:
   ```
   [-2, -1, 0]
   [-1,  1, 1]
   [ 0,  1, 2]
   ```
   Why does this create a 3D-looking effect?

---

**Next: [Lesson 04 — Feature Extraction](04-feature-extraction.md)**
