# Lesson 10: Compression Fundamentals

> **The one thing to remember**: Compression works by exploiting structure.
> If data has redundancy or perceptual irrelevance, we can encode it more compactly.
> Lossless compression preserves exact data; lossy compression preserves what matters enough for the use case.

---

## Start With Repetition

Suppose a message says:

```text
AAAAAAAAAA
```

You could store it literally as ten characters.
Or you could store something like:

```text
10 times 'A'
```

That is the core intuition of compression: represent the same useful information with fewer bits when the data contains structure.

---

## Why Compression Exists

Raw media and raw data can be large:

- images contain many pixels
- audio contains many samples
- video contains many frames
- logs and structured data repeat patterns constantly

Compression reduces:

- storage cost
- network bandwidth use
- transmission time

Sometimes it also improves cache and memory behavior because less data has to move.

---

## Lossless Compression

**Lossless** means you can reconstruct the exact original data.

Examples include ideas used in:

- ZIP
- PNG
- many general-purpose compressors

Lossless compression works well when data has patterns or redundancy.

Examples:

- repeated values
- predictable symbols
- recurring substrings

If you decompress a lossless format, you get the exact original bytes back.

---

## Lossy Compression

**Lossy** means the decompressed result is not bit-for-bit identical to the original.

Instead, it is an approximation chosen to keep the most important perceptual information while throwing away some detail.

This is common for:

- JPEG images
- MP3 or AAC audio
- H.264 or H.265 video

Lossy compression is powerful because human perception does not treat every detail as equally important.

---

## Redundancy and Entropy Intuition

Compression is easiest when data has redundancy.

Examples:

- long repeated sequences
- symbols that appear much more often than others
- neighboring values that are similar

If data is already highly random-looking, good compression becomes much harder.

That is the intuitive role of **entropy** here: some data is inherently more compressible than other data.

---

## Common Lossless Ideas

You do not need to master full algorithms yet, but two famous ideas are worth naming:

### Huffman-like Coding

Common symbols get shorter codes; rare symbols get longer codes.

### Dictionary / LZ-style Compression

Repeated substrings are replaced with references to earlier occurrences.

These are different strategies for exploiting repeated structure.

---

## Common Lossy Ideas

Lossy media compression often works by:

- transforming data into a more compressible form
- quantizing away less important detail
- exploiting perceptual limits in vision or hearing

The key beginner insight is:

> Lossy compression is not random damage. It is selective approximation.

Whether the tradeoff is acceptable depends on the use case.

---

## Compression Is a Tradeoff Triangle

Compression choices often balance:

- size
- quality or fidelity
- encoding/decoding speed

There is no single universally best format.

That is why different domains choose different formats depending on what they value.

---

## Why Developers Should Care

Compression explains:

- why PNG and JPEG behave so differently
- why archived text can shrink dramatically while encrypted data often does not
- why media pipelines trade quality against bandwidth and storage
- why CPU time may increase to save network or storage cost

If your systems store logs, send images, stream media, or handle large payloads, compression is part of real engineering tradeoffs.

---

## Common Misunderstandings

### “Compression just removes extra bytes”

It exploits patterns and encoding choices. The original logical information is not stored in the same literal way.

### “Lossy compression is always bad quality”

Not necessarily. It can be visually or audibly acceptable for many uses.

### “All data compresses well” 

No. Random-looking or already-compressed data may compress poorly.

---

## Hands-On Exercise

Compare file types.

1. Take a text file and compress it into ZIP.
2. Take an already-compressed JPEG or MP3 and compress it again.
3. Compare how much size changes in each case.
4. Explain why structured text compresses better than already-compressed media.

---

## Recap

- Compression reduces size by exploiting structure in data.
- Lossless compression preserves exact original bytes.
- Lossy compression preserves useful perception while discarding some detail.
- Redundancy makes compression easier; high-entropy data is harder to compress.
- Compression always involves tradeoffs among size, fidelity, and compute cost.

Next, we apply these ideas to real image and video formats developers encounter constantly.