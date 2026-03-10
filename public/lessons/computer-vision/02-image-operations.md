# Lesson 02 — Image Operations

## The Photo Editor in Code

Every photo editor has the same basic tools — crop, resize, rotate, adjust
brightness. OpenCV gives you those same tools as function calls. Think of
this lesson as learning Photoshop, but you type instead of click.

## Resizing

Resizing changes the grid dimensions. Upscaling invents new pixels.
Downscaling throws pixels away.

```
  Original 6x4         Downscaled 3x2

  +--+--+--+--+--+--+     +----+----+----+
  |  |  |  |  |  |  |     |    |    |    |
  +--+--+--+--+--+--+     +----+----+----+
  |  |  |  |  |  |  |     |    |    |    |
  +--+--+--+--+--+--+     +----+----+----+
  |  |  |  |  |  |  |
  +--+--+--+--+--+--+
  |  |  |  |  |  |  |
  +--+--+--+--+--+--+
```

```python
import cv2

img = cv2.imread("photo.jpg")

resized = cv2.resize(img, (224, 224))

half = cv2.resize(img, None, fx=0.5, fy=0.5)

resized_cubic = cv2.resize(img, (224, 224), interpolation=cv2.INTER_CUBIC)
```

**Interpolation methods:**

```
  INTER_NEAREST  — fast, blocky (good for masks)
  INTER_LINEAR   — default, decent quality
  INTER_CUBIC    — slower, smoother (good for upscaling)
  INTER_AREA     — best for downscaling
  INTER_LANCZOS4 — highest quality, slowest
```

## Cropping

Cropping is just array slicing. No special function needed.

```
  Original                Cropped (rows 50-150, cols 100-300)

  +========================+    +============+
  |                        |    |  selected  |
  |     +-----------+      |    |   region   |
  |     |  THIS BIT |      | => +============+
  |     +-----------+      |
  |                        |
  +========================+
```

```python
cropped = img[50:150, 100:300]
print(cropped.shape)
```

Remember: NumPy indexing is `[rows, cols]` which means `[y, x]`, not `[x, y]`.

## Rotation

```
  Original        Rotated 45 degrees

  +--------+         /\
  |   ->   |        /  \
  |  face  |       / -> \
  +--------+      /  face\
                  +--------+
```

```python
h, w = img.shape[:2]
center = (w // 2, h // 2)

rotation_matrix = cv2.getRotationMatrix2D(center, angle=45, scale=1.0)
rotated = cv2.warpAffine(img, rotation_matrix, (w, h))
```

For simple 90-degree rotations, use:

```python
rotated_90 = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
rotated_180 = cv2.rotate(img, cv2.ROTATE_180)
rotated_270 = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
```

## Flipping

```python
flipped_h = cv2.flip(img, 1)
flipped_v = cv2.flip(img, 0)
flipped_both = cv2.flip(img, -1)
```

```
  Original     Flip H      Flip V      Flip Both
  A B          B A          C D          D C
  C D          D C          A B          B A
```

## Color Conversion

You've seen BGR to RGB. Here's the full menu:

```python
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
```

**LAB color space** separates lightness (L) from color (A, B). It's useful
for histogram equalization that doesn't mess up colors.

## Brightness and Contrast

Think of brightness as adding a constant, contrast as multiplying.

```
  pixel_new = alpha * pixel_old + beta

  alpha = contrast (1.0 = no change, >1 = more contrast)
  beta  = brightness (0 = no change, +50 = brighter)
```

```python
adjusted = cv2.convertScaleAbs(img, alpha=1.3, beta=40)
```

## Histogram Equalization

A histogram shows how pixel values are distributed. Equalization spreads
them out so the image uses the full range.

```
  Before equalization          After equalization

  Count                        Count
  |   ___                      |
  |  |   |                     | _   _   _   _
  |  |   |                     || | | | | | | |
  | _|   |_                    || | | | | | | |
  +---------> value            +---------------> value
  Dark  Bright                 Evenly spread
```

```python
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
equalized = cv2.equalizeHist(gray)
```

For color images, equalize only the lightness channel:

```python
lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
l_channel, a_channel, b_channel = cv2.split(lab)
l_equalized = cv2.equalizeHist(l_channel)
lab_equalized = cv2.merge([l_equalized, a_channel, b_channel])
result = cv2.cvtColor(lab_equalized, cv2.COLOR_LAB2BGR)
```

## CLAHE — Adaptive Equalization

Regular equalization is global — it can wash out local detail. CLAHE works
on small tiles and blends the results.

```python
clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
l_clahe = clahe.apply(l_channel)
```

## Drawing on Images

Useful for visualizing detections later.

```python
canvas = img.copy()

cv2.rectangle(canvas, (50, 50), (200, 200), (0, 255, 0), 2)
cv2.circle(canvas, (300, 300), 50, (0, 0, 255), -1)
cv2.line(canvas, (0, 0), (400, 400), (255, 0, 0), 3)
cv2.putText(canvas, "Hello", (50, 30), cv2.FONT_HERSHEY_SIMPLEX,
            1, (255, 255, 255), 2)
```

## Blurring

Blurring smooths out noise. It's a preprocessing step for almost everything.

```python
blur_avg = cv2.blur(img, (5, 5))
blur_gauss = cv2.GaussianBlur(img, (5, 5), 0)
blur_median = cv2.medianBlur(img, 5)
blur_bilateral = cv2.bilateralFilter(img, 9, 75, 75)
```

```
  Average   — simple, fast, very blurry
  Gaussian  — weighted average, natural-looking blur
  Median    — kills salt-and-pepper noise, preserves edges
  Bilateral — smooths flat areas, keeps edges sharp (slow)
```

## Thresholding

Converts a grayscale image to binary — black or white, nothing in between.

```python
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

_, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
_, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                  cv2.THRESH_BINARY, 11, 2)
```

Otsu automatically picks the best threshold. Adaptive thresholding handles
uneven lighting.

## Putting It Together — A Preprocessing Pipeline

```python
def preprocess(path, target_size=(224, 224)):
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Cannot load {path}")

    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    h, w = img.shape[:2]
    scale = min(target_size[0] / h, target_size[1] / w)
    new_h, new_w = int(h * scale), int(w * scale)
    img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    pad_h = target_size[0] - new_h
    pad_w = target_size[1] - new_w
    top, left = pad_h // 2, pad_w // 2
    img = cv2.copyMakeBorder(img, top, pad_h - top, left, pad_w - left,
                              cv2.BORDER_CONSTANT, value=(0, 0, 0))

    return img
```

## Exercises

1. Write a function that takes an image and returns five augmented versions:
   horizontal flip, 15-degree rotation, brightness +30, Gaussian blur, and
   a random crop of 75% area.

2. Load a photo with uneven lighting (e.g., half in shadow). Apply CLAHE
   and compare the result to regular histogram equalization.

3. Create a function `letterbox_resize(img, size)` that resizes an image to
   fit inside a square of the given size while maintaining aspect ratio,
   padding the remainder with gray (128, 128, 128).

4. Use HSV thresholding to count the number of red M&Ms in a photo of
   mixed-color M&Ms. Draw a green circle around each detected blob.

5. Build a batch preprocessing pipeline that loads all `.jpg` files from a
   directory, resizes to 224x224, and saves them as a single NumPy array
   of shape `(N, 224, 224, 3)`.

---

**Next: [Lesson 03 — Filters & Edges](03-filters-edges.md)**
