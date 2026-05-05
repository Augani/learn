# Lesson 08: Pixel Data and Color

> **The one thing to remember**: A digital image is not “a picture” to the computer.
> It is a grid of pixel values, and each pixel is represented by numeric channels such as red, green, blue, and sometimes alpha.

---

## Start With a Mosaic

Imagine a mural made from tiny colored tiles.

From far away, you see one image.
Up close, you see individual tiles.

Digital images work the same way.

- the full image is a grid
- each grid cell is a pixel
- each pixel stores numeric color information

The picture is an interpretation of many small numeric cells.

---

## Pixels Are Samples, Not “Tiny Photos”

A **pixel** is a sample of visual information at a point in the image grid.

It is usually represented by channel values.

Common example:

- red
- green
- blue

This is the familiar **RGB** model.

```
ONE PIXEL IN RGB

  R = 255
  G = 128
  B = 0
```

Those are just numbers. The display system interprets them as a visible color.

---

## Bit Depth

Each channel needs some number of bits.

A common choice is 8 bits per channel.

That means each channel can represent values from:

$$
0 \text{ to } 255
$$

So an 8-bit RGB pixel typically uses:

- 8 bits for red
- 8 bits for green
- 8 bits for blue

for a total of 24 bits, or 3 bytes, per pixel.

More bit depth means more precision and smoother gradients, but also larger data.

---

## RGBA and Alpha

Many images add an **alpha** channel:

- `R` = red
- `G` = green
- `B` = blue
- `A` = alpha, often representing opacity or transparency

This is **RGBA**.

The alpha value lets software blend images, draw overlays, and compose interface elements.

---

## Premultiplied Alpha

One subtle but important concept is **premultiplied alpha**.

In some image pipelines, the RGB channels are already multiplied by alpha.

Why do this?

- blending math can become simpler or more stable
- some graphics APIs and compositors expect it

If one system assumes premultiplied alpha and another assumes straight alpha, images can look wrong even when the raw bytes are “valid.”

This is a classic interpretation bug.

---

## Color Spaces

Not all RGB values mean the same real-world color unless you know the **color space**.

Examples include:

- sRGB
- Display P3
- Adobe RGB

The numeric channels are not enough by themselves. The color space defines how those numbers map to perceived color.

This is why the same image can look different across devices or software if color management is inconsistent.

---

## Image Size Grows Fast

Raw image size is easy to underestimate.

Suppose an image is:

- 1920 by 1080 pixels
- 3 bytes per pixel for RGB

That is already millions of bytes for one frame before compression.

This is one reason image compression is so important.

---

## Raster vs Vector

This lesson is about **raster** images: grids of pixels.

Vector graphics are different. They store shapes, lines, curves, and instructions rather than a fixed pixel grid.

That distinction matters because raster images scale by resampling pixels, while vector images can often scale more cleanly.

---

## Why Developers Should Care

Pixel representation explains:

- why image memory use can be large even for “simple” pictures
- why alpha blending bugs happen
- why color profiles and color spaces matter in graphics work
- why image pipelines often need compression, conversion, and resampling

If you build web apps, game engines, media tools, or ML vision systems, these details matter in practice.

---

## Common Misunderstandings

### “A pixel is just one color name”

No. It is usually several numeric channel values.

### “RGB numbers alone fully define visible color”

Not without understanding the color space.

### “Transparency is just another color” 

No. Alpha affects compositing and blending behavior.

---

## Hands-On Exercise

Inspect a tiny image.

1. Create or download a very small PNG, such as 2x2 or 4x4 pixels.
2. Use an image viewer, scripting tool, or browser dev tool to inspect its pixel values.
3. Change one pixel's RGB or alpha values and observe the visual effect.
4. If possible, compare the file size with the uncompressed raw pixel count.

---

## Recap

- Raster images are grids of pixels.
- Pixels are represented by numeric channels such as RGB and sometimes alpha.
- Bit depth controls precision per channel.
- Color spaces matter because the same numbers can map to different perceived colors.
- Raw pixel data grows quickly, which is why image formats rely heavily on compression.

Next, we apply the same representation mindset to sound: how does a continuous audio waveform become discrete binary data?