# Data Representation & Encoding — No Degree Required

This track explains how numbers, text, images, audio, and structured data
become bits. If you have ever been surprised by `0.1 + 0.2`, mojibake,
endianness bugs, broken file formats, or serialization mismatches, this is the
missing foundation.

You do not need a math degree or a computer engineering background. We start
with everyday intuition and build up to the representations that modern
software systems actually use.

---

## Why This Track Matters

Many “weird bugs” are really representation bugs:

- numbers overflow or lose precision
- floating-point comparisons fail unexpectedly
- text arrives corrupted because bytes were decoded incorrectly
- image or audio data looks wrong because the format assumptions are wrong
- networked systems disagree because they serialize data differently

This track makes those problems explainable instead of mysterious.

---

## How This Track Is Organized

```
Phase 1: Numeric Foundations       (Lessons 01-04)
Phase 2: Text and Bytes            (Lessons 05-07)
Phase 3: Media and Compression     (Lessons 08-11)
Phase 4: Structured Data on the Wire (Lessons 12)
```

Each lesson starts with the everyday intuition, then shows the actual binary
representation, then ends with why developers care and one hands-on exercise.

---

## Phase 1: Numeric Foundations (Lessons 01–04)

- [ ] **01 - Why Binary**
      Voltage levels, noise margins, place value, why computers prefer two states
- [ ] **02 - Integer Representation**
      Unsigned integers, two's complement, sign extension, overflow
- [ ] **03 - Floating Point (IEEE 754)**
      Sign, exponent, mantissa, normalization, precision and range
- [ ] **04 - Floating Point Pitfalls**
      Why `0.1 + 0.2 != 0.3`, comparison strategies, decimal vs binary fractions

```
  +---------+     +----------+     +---------------+     +----------+
  | Binary  |---->| Integers |---->| IEEE 754      |---->| Pitfalls |
  +---------+     +----------+     +---------------+     +----------+
      01              02                03                 04
```

---

## Phase 2: Text and Bytes (Lessons 05–07)

- [ ] **05 - Character Encoding**
      ASCII, Latin-1, Unicode code points, encoding vs character set
- [ ] **06 - UTF-8 and Beyond**
      Variable-width encoding, surrogate pairs, normalization, grapheme clusters
- [ ] **07 - Endianness**
      Big vs little endian, network byte order, when byte order matters

```
  +----------+     +----------+     +------------+
  | Encoding |---->| UTF-8+   |---->| Endianness |
  +----------+     +----------+     +------------+
      05              06              07
```

---

## Phase 3: Media and Compression (Lessons 08–11)

- [ ] **08 - Pixel Data and Color**
      RGB, RGBA, bit depth, color spaces, alpha and premultiplication
- [ ] **09 - Audio Representation**
      Sampling, bit depth, PCM, Nyquist intuition, channels
- [ ] **10 - Compression Fundamentals**
      Lossless vs lossy, redundancy, entropy intuition, transform coding
- [ ] **11 - Image and Video Formats**
      JPEG, PNG, H.264, what each format optimizes for

```
  +--------+     +--------+     +-------------+     +---------------+
  | Pixels |---->| Audio  |---->| Compression |---->| Image/Video   |
  +--------+     +--------+     +-------------+     +---------------+
      08             09              10                11
```

---

## Phase 4: Structured Data on the Wire (Lesson 12)

- [ ] **12 - Serialization and Wire Formats**
      JSON, Protobuf, MessagePack, schema vs flexibility, bytes on the wire

```
  +----------------+
  | Serialization  |
  +----------------+
         12
```

---

## Who This Track Is For

- Self-taught developers who know how to program but want to understand data at the byte level
- Backend developers working with APIs, protocols, and storage formats
- Frontend developers dealing with text encodings, media, and browser data
- Systems, ML, and data engineers who want a stronger mental model for numerical and binary behavior

## Prerequisites

You should be comfortable with:

- variables and basic arithmetic
- strings and arrays in at least one language
- the idea that files and network messages are made of bytes

Helpful but not required:

- [CS Fundamentals](../cs-fundamentals/00-roadmap.md)
- [Computer Architecture](../computer-architecture/00-roadmap.md)

---

## What You Will Be Able To Explain After This Track

- Why integers overflow the way they do
- Why floating point loses precision and how to compare safely
- Why text encoding bugs happen and how UTF-8 actually works
- Why byte order matters in protocols and binary formats
- How image, audio, and compressed formats trade quality, size, and speed
- How structured data becomes raw bytes for storage and transmission

---

## Time Estimate

```
Phase 1:  ~8 hours   (numbers and precision)
Phase 2:  ~6 hours   (text and bytes)
Phase 3:  ~8 hours   (media and compression)
Phase 4:  ~3 hours   (serialization and protocols)
          --------
Total:    ~25 hours
```

Take this track slowly and actively. The best way to learn representation is to
look at real bytes, hex dumps, encoded text, and serialized messages.

---

## Recommended Reading

These books are optional — the lessons are designed to stand on their own.

- **Code: The Hidden Language of Computer Hardware and Software** by Charles Petzold (Microsoft Press, 2nd Edition 2022) — Great for connecting binary representation to real systems
- **Computer Systems: A Programmer's Perspective** by Randal Bryant and David O'Hallaron (Pearson, 3rd Edition 2015) — Strong coverage of data representation and low-level effects
- **Unicode Explained** by Jukka K. Korpela (O'Reilly, 2006) — Still useful for understanding the text-encoding landscape
- **Understanding JPEG** by Richard F. Lyon (1991) — Older but useful for building intuition about image compression

---

*Track version: 2026.05*