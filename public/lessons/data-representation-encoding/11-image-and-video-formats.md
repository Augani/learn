# Lesson 11: Image and Video Formats

> **The one thing to remember**: File formats are engineering tradeoffs wrapped
> in standards. PNG, JPEG, and H.264 are not just containers for bytes; they each optimize for different kinds of data, quality expectations, and use cases.

---

## Start With the Wrong Question

Beginners often ask:

“Which format is best?”

That is usually the wrong question.

The better question is:

> Best for what?

Because image and video formats optimize for different goals:

- exactness
- file size
- transparency support
- decoding cost
- photographic realism
- editing friendliness
- streaming efficiency

---

## PNG: Lossless and Pixel-Faithful

PNG is a lossless image format.

That makes it good when you care about exact pixel reproduction, such as:

- screenshots
- UI assets
- diagrams
- graphics with text or sharp edges
- transparency support

PNG usually works less well than JPEG for photographs because exactness costs more bits.

---

## JPEG: Lossy and Photo-Oriented

JPEG is designed around the fact that photographic images contain a lot of detail the human visual system can tolerate being approximated.

That makes JPEG good for:

- photos
- web image delivery when small size matters

But JPEG is usually bad for:

- sharp UI edges
- line art
- repeated editing and re-saving

Because it is lossy, repeated re-encoding can accumulate visible damage.

---

## Why PNG and JPEG Feel So Different

This difference now makes sense:

- PNG preserves exact pixel data better
- JPEG sacrifices some accuracy for much smaller size on photographic content

So the format choice is really a choice about what you value.

---

## Video Is Harder Than Images

Video is not just one image. It is a sequence of frames over time, often with audio and timing metadata too.

If every frame were stored raw, the data size would be enormous.

So video compression exploits not only patterns **within** a frame, but also patterns **across** frames.

That is one reason video compression can be so powerful and so complex.

---

## H.264 Intuition

H.264 is one of the most widely used video compression standards.

At a beginner level, the key intuition is:

- some frames are encoded more independently
- many later frames encode changes relative to earlier or nearby frames
- this avoids storing every frame from scratch

That works well because much of a scene often stays similar from one frame to the next.

---

## Containers vs Codecs

Another important distinction:

### Codec

How the media data is encoded and compressed.

### Container

The file wrapper that may hold video, audio, subtitles, timing metadata, and more.

For example, a file extension like `.mp4` often refers to a container, not a single guaranteed codec choice.

This distinction matters because two files with the same extension may not behave identically across software if the underlying codec support differs.

---

## Why Developers Should Care

Formats explain:

- why screenshots should usually not be saved as JPEG
- why photos often compress dramatically as JPEG compared with PNG
- why video streaming depends so heavily on codecs and containers
- why transcoding pipelines can lose quality or take significant CPU time

If your app uploads, resizes, transcodes, or streams media, format choice is a product and performance decision.

---

## Common Misunderstandings

### “A file extension tells me everything important”

No. Containers, codecs, and internal settings all matter.

### “JPEG is just a smaller PNG”

No. They make fundamentally different compression tradeoffs.

### “Video is just many JPEGs in a row” 

Not in modern compressed formats. Video codecs exploit temporal relationships between frames.

---

## Hands-On Exercise

Compare media formats.

1. Save the same screenshot or graphic as PNG and JPEG.
2. Compare file size and visible quality around text or sharp edges.
3. Save a photo as PNG and JPEG and compare again.
4. If possible, inspect a short video file with a media-info tool and note the container and codec separately.

---

## Recap

- Formats are tradeoffs, not universal winners.
- PNG is lossless and well suited for exact graphics and transparency.
- JPEG is lossy and well suited for many photographic images.
- Video compression exploits both spatial and temporal redundancy.
- Containers and codecs are different layers of media representation.

Next, we finish the track by stepping from media files into APIs and protocols: how structured data becomes bytes on the wire.