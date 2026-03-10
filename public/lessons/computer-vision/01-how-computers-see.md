# Lesson 01 — How Computers See

## The Mosaic Analogy

Imagine a Roman mosaic on a villa floor. Step close and you see individual
colored tiles. Step back and those tiles become a dolphin, a ship, a face.

Digital images work the same way. Each tiny tile is a **pixel** — a single
number (grayscale) or a triplet of numbers (color). Pack enough pixels together
and the grid becomes a photograph.

```
 A 4x4 grayscale "image"        What we see (zoomed out)

 +----+----+----+----+           +================+
 | 20 | 20 | 200| 200|          |  dark  | light  |
 +----+----+----+----+           |  left  | right  |
 | 20 | 20 | 200| 200|          |        |        |
 +----+----+----+----+           +================+
 | 20 | 20 | 200| 200|
 +----+----+----+----+
 | 20 | 20 | 200| 200|
 +----+----+----+----+

 0 = black   255 = white
```

## Pixels and Channels

A grayscale pixel is one number: 0 (black) to 255 (white).

A color pixel has three channels:

```
            +-----+
  Red   --> | 231 |
  Green --> |  76 |
  Blue  --> |  42 |
            +-----+
            One pixel = warm orange
```

An image with width W and height H has shape `(H, W, 3)` in OpenCV
or `(3, H, W)` in PyTorch. That difference matters — a lot.

```
  OpenCV layout (HWC)           PyTorch layout (CHW)

  height                         channel
    |                              |
    v                              v
  [ [ [R,G,B], [R,G,B] ],       [ [[R,R],[R,R]],   <-- all reds
    [ [R,G,B], [R,G,B] ] ]        [[G,G],[G,G]],   <-- all greens
                                   [[B,B],[B,B]] ]  <-- all blues
      width --->                      height x width
```

## Loading Images in Python

```python
import cv2
import numpy as np
import torch

img_bgr = cv2.imread("photo.jpg")

print(type(img_bgr))
print(img_bgr.shape)
print(img_bgr.dtype)

img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
```

OpenCV loads images in **BGR** order, not RGB. Every beginner gets bitten by
this at least once. Think of it as OpenCV's little hazing ritual.

## Color Spaces

RGB isn't the only way to represent color. Different spaces highlight different
information.

```
  RGB                HSV                    Grayscale
  +---+---+---+      +---+---+---+          +---+
  | R | G | B |      | H | S | V |          | I |
  +---+---+---+      +---+---+---+          +---+

  H = Hue (color wheel angle 0-179)
  S = Saturation (0=gray, 255=vivid)
  V = Value (brightness)
```

HSV is great for color-based filtering. Want to find all red objects? Filter
on hue. In RGB you'd need complicated combinations of all three channels.

```python
img_hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
img_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

lower_red = np.array([0, 120, 70])
upper_red = np.array([10, 255, 255])
mask = cv2.inRange(img_hsv, lower_red, upper_red)
```

## Images as Tensors

Neural networks don't eat NumPy arrays — they eat tensors. Here's the
conversion pipeline:

```
  OpenCV (BGR, uint8, HWC)
         |
         | cv2.cvtColor -> RGB
         v
  NumPy (RGB, uint8, HWC)
         |
         | /255.0 -> float, transpose -> CHW
         v
  PyTorch Tensor (RGB, float32, CHW)
         |
         | .unsqueeze(0) -> add batch dim
         v
  Batch Tensor (RGB, float32, NCHW)
```

```python
import torchvision.transforms as T

transform = T.Compose([
    T.ToPILImage(),
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]),
])

img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
tensor = transform(img_rgb)
print(tensor.shape)
batch = tensor.unsqueeze(0)
print(batch.shape)
```

`T.ToTensor()` does two things: converts HWC uint8 to CHW float32, and
scales values from [0, 255] to [0.0, 1.0].

The normalization values above are ImageNet statistics. Almost every pretrained
vision model expects them.

## Manual Tensor Conversion

Sometimes you want control without torchvision:

```python
img_float = img_rgb.astype(np.float32) / 255.0
tensor = torch.from_numpy(img_float).permute(2, 0, 1)
print(tensor.shape)
```

`permute(2, 0, 1)` swaps `(H, W, C)` to `(C, H, W)`.

## Visualizing Tensors

Going backward — tensor to displayable image:

```python
import matplotlib.pyplot as plt

def show_tensor(t):
    if t.dim() == 4:
        t = t[0]
    img = t.permute(1, 2, 0).numpy()
    img = np.clip(img, 0, 1)
    plt.imshow(img)
    plt.axis("off")
    plt.show()

show_tensor(tensor)
```

## Creating Synthetic Images

You don't always need files. Make images from scratch:

```python
black = np.zeros((100, 100, 3), dtype=np.uint8)

gradient = np.zeros((100, 256), dtype=np.uint8)
for col in range(256):
    gradient[:, col] = col

checkerboard = np.zeros((200, 200), dtype=np.uint8)
checkerboard[0:100, 0:100] = 255
checkerboard[100:200, 100:200] = 255
```

## Key Takeaways

```
  +---------------------------------------------------+
  | 1. Images = grids of numbers (mosaic tiles)        |
  | 2. Color = 3 channels (RGB or BGR)                 |
  | 3. OpenCV uses BGR + HWC, PyTorch uses RGB + CHW   |
  | 4. Always normalize before feeding to a model      |
  | 5. uint8 [0,255] for display, float32 [0,1] for NN|
  +---------------------------------------------------+
```

## Exercises

1. Load any image with OpenCV. Print its shape, dtype, and the RGB value of
   the pixel at position (50, 50). What color is it?

2. Convert the image to HSV. Create a mask that isolates pixels of a single
   color (e.g., blue sky). Display the mask.

3. Write a function `numpy_to_tensor(img_bgr)` that takes a BGR OpenCV image
   and returns a normalized PyTorch tensor of shape `(1, 3, 224, 224)` using
   ImageNet stats. Do it manually — no torchvision.

4. Create a 256x256 synthetic image where the red channel is a horizontal
   gradient, green is a vertical gradient, and blue is constant at 128.
   Display it with matplotlib.

5. Load the same image with both OpenCV and PIL. Verify that after converting
   OpenCV's BGR to RGB, the pixel values match PIL's output exactly.

---

**Next: [Lesson 02 — Image Operations](02-image-operations.md)**
