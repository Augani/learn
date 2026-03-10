# Reference — OpenCV Operations Cheat Sheet

## Reading and Writing

```python
img = cv2.imread("photo.jpg")
img = cv2.imread("photo.jpg", cv2.IMREAD_GRAYSCALE)
img = cv2.imread("photo.jpg", cv2.IMREAD_UNCHANGED)

cv2.imwrite("output.jpg", img)
cv2.imwrite("output.png", img)
cv2.imwrite("output.jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 95])
```

## Color Conversions

```python
rgb   = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
hsv   = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
lab   = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
bgr   = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
```

## Resize

```python
resized = cv2.resize(img, (width, height))
resized = cv2.resize(img, None, fx=0.5, fy=0.5)
resized = cv2.resize(img, (w, h), interpolation=cv2.INTER_CUBIC)
resized = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
resized = cv2.resize(img, (w, h), interpolation=cv2.INTER_LANCZOS4)
```

## Crop, Flip, Rotate

```python
cropped = img[y1:y2, x1:x2]

flipped_h = cv2.flip(img, 1)
flipped_v = cv2.flip(img, 0)
flipped_both = cv2.flip(img, -1)

rotated_90  = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
rotated_180 = cv2.rotate(img, cv2.ROTATE_180)
rotated_270 = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)

h, w = img.shape[:2]
M = cv2.getRotationMatrix2D((w // 2, h // 2), angle=30, scale=1.0)
rotated = cv2.warpAffine(img, M, (w, h))
```

## Padding

```python
padded = cv2.copyMakeBorder(img, top, bottom, left, right,
                             cv2.BORDER_CONSTANT, value=(0, 0, 0))
padded = cv2.copyMakeBorder(img, 10, 10, 10, 10, cv2.BORDER_REFLECT)
padded = cv2.copyMakeBorder(img, 10, 10, 10, 10, cv2.BORDER_REPLICATE)
```

## Blurring

```python
blur      = cv2.blur(img, (5, 5))
gauss     = cv2.GaussianBlur(img, (5, 5), 0)
median    = cv2.medianBlur(img, 5)
bilateral = cv2.bilateralFilter(img, 9, 75, 75)
```

## Edge Detection

```python
edges = cv2.Canny(gray, threshold1=50, threshold2=150)

sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)

laplacian = cv2.Laplacian(gray, cv2.CV_64F)
```

## Thresholding

```python
_, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
_, binary_inv = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
_, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                  cv2.THRESH_BINARY, 11, 2)
```

## Morphological Operations

```python
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

eroded  = cv2.erode(binary, kernel, iterations=1)
dilated = cv2.dilate(binary, kernel, iterations=1)
opened  = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
closed  = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
gradient = cv2.morphologyEx(binary, cv2.MORPH_GRADIENT, kernel)
```

## Contours

```python
contours, hierarchy = cv2.findContours(binary, cv2.RETR_EXTERNAL,
                                        cv2.CHAIN_APPROX_SIMPLE)

cv2.drawContours(img, contours, -1, (0, 255, 0), 2)

for cnt in contours:
    area = cv2.contourArea(cnt)
    perimeter = cv2.arcLength(cnt, closed=True)
    x, y, w, h = cv2.boundingRect(cnt)
    (cx, cy), radius = cv2.minEnclosingCircle(cnt)
    M = cv2.moments(cnt)
```

## Histogram

```python
hist = cv2.calcHist([gray], [0], None, [256], [0, 256])

equalized = cv2.equalizeHist(gray)

clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
cl_img = clahe.apply(gray)
```

## Drawing

```python
cv2.line(img, (x1, y1), (x2, y2), (0, 255, 0), thickness=2)
cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), thickness=2)
cv2.circle(img, (cx, cy), radius, (0, 0, 255), thickness=-1)
cv2.ellipse(img, (cx, cy), (a, b), angle, 0, 360, (255, 0, 0), 2)
cv2.putText(img, "text", (x, y), cv2.FONT_HERSHEY_SIMPLEX, 1.0,
            (255, 255, 255), 2)

pts = np.array([[10, 10], [50, 50], [10, 50]], np.int32)
cv2.polylines(img, [pts], isClosed=True, color=(0, 255, 0), thickness=2)
cv2.fillPoly(img, [pts], color=(0, 255, 0))
```

## Affine and Perspective Transforms

```python
src = np.float32([[50, 50], [200, 50], [50, 200]])
dst = np.float32([[10, 100], [200, 50], [100, 250]])
M = cv2.getAffineTransform(src, dst)
result = cv2.warpAffine(img, M, (w, h))

src = np.float32([[56, 65], [368, 52], [28, 387], [389, 390]])
dst = np.float32([[0, 0], [300, 0], [0, 300], [300, 300]])
M = cv2.getPerspectiveTransform(src, dst)
result = cv2.warpPerspective(img, M, (300, 300))
```

## Feature Detection

```python
sift = cv2.SIFT_create()
kp, des = sift.detectAndCompute(gray, None)

orb = cv2.ORB_create(nfeatures=500)
kp, des = orb.detectAndCompute(gray, None)

corners = cv2.goodFeaturesToTrack(gray, maxCorners=100,
                                   qualityLevel=0.01, minDistance=10)
```

## Feature Matching

```python
bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
matches = bf.match(des1, des2)
matches = sorted(matches, key=lambda m: m.distance)

bf = cv2.BFMatcher(cv2.NORM_L2)
matches = bf.knnMatch(des1, des2, k=2)
good = [m for m, n in matches if m.distance < 0.75 * n.distance]

result = cv2.drawMatches(img1, kp1, img2, kp2, matches[:20], None)
```

## Video

```python
cap = cv2.VideoCapture("video.mp4")
cap = cv2.VideoCapture(0)

fps = cap.get(cv2.CAP_PROP_FPS)
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

ret, frame = cap.read()
cap.set(cv2.CAP_PROP_POS_FRAMES, 100)
cap.release()

fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter("out.mp4", fourcc, fps, (w, h))
writer.write(frame)
writer.release()
```

## Color Filtering (HSV)

```python
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

lower = np.array([hue_min, sat_min, val_min])
upper = np.array([hue_max, sat_max, val_max])
mask = cv2.inRange(hsv, lower, upper)

result = cv2.bitwise_and(img, img, mask=mask)
```

Common HSV ranges (OpenCV uses H: 0-179, S: 0-255, V: 0-255):

```
+----------+----------+----------+
| Color    | Lower    | Upper    |
+----------+----------+----------+
| Red      | [0,120,70]   | [10,255,255]  |
| Red (2)  | [170,120,70] | [180,255,255] |
| Orange   | [10,100,100] | [25,255,255]  |
| Yellow   | [25,100,100] | [35,255,255]  |
| Green    | [35,100,100] | [85,255,255]  |
| Blue     | [85,100,100] | [130,255,255] |
| Purple   | [130,100,100]| [170,255,255] |
+----------+----------+----------+
```

## Optical Flow

```python
flow = cv2.calcOpticalFlowFarneback(prev_gray, curr_gray, None,
                                     0.5, 3, 15, 3, 5, 1.2, 0)

lk_params = dict(winSize=(15, 15), maxLevel=2,
                 criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT,
                           10, 0.03))
next_pts, status, err = cv2.calcOpticalFlowPyrLK(prev_gray, curr_gray,
                                                  prev_pts, None, **lk_params)
```

## Background Subtraction

```python
bg_sub = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=16)
bg_sub = cv2.createBackgroundSubtractorKNN(history=500, dist2Threshold=400)

fg_mask = bg_sub.apply(frame)
```

## Object Tracking

```python
tracker = cv2.TrackerCSRT_create()
tracker = cv2.TrackerKCF_create()

tracker.init(frame, (x, y, w, h))
success, bbox = tracker.update(frame)
```

## Useful NumPy Operations for Images

```python
blank = np.zeros((h, w, 3), dtype=np.uint8)
white = np.ones((h, w, 3), dtype=np.uint8) * 255

merged = cv2.addWeighted(img1, 0.7, img2, 0.3, 0)
masked = cv2.bitwise_and(img, img, mask=mask)
inverted = cv2.bitwise_not(img)

b, g, r = cv2.split(img)
img = cv2.merge([b, g, r])

img_float = img.astype(np.float32) / 255.0
img_uint8 = (img_float * 255).clip(0, 255).astype(np.uint8)
```
