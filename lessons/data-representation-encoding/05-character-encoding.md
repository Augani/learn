# Lesson 05: Character Encoding

> **The one thing to remember**: Text is not stored as letters. It is stored as
> numbers, and an encoding defines how those numbers map to characters.

---

## Start With a Codebook

Imagine two people agree on a codebook:

- `1` means A
- `2` means B
- `3` means C

If both people use the same codebook, the message makes sense.
If they use different codebooks, the same numbers decode into nonsense.

Character encoding works the same way. Text becomes numbers, and software must agree on how to interpret them.

---

## Characters Are Not Bytes by Nature

A character like `A`, `é`, or `你` is an abstract symbol.

A byte is just 8 bits.

The encoding is the bridge between them.

This is a crucial separation:

- **character**: the symbol you mean
- **encoding**: how that symbol becomes bytes

If you skip this distinction, text bugs become mysterious fast.

---

## ASCII: The Early Common Codebook

**ASCII** is one of the earliest widely used character encodings.

It defines characters such as:

- uppercase A-Z
- lowercase a-z
- digits 0-9
- punctuation and control characters

Example:

```text
'A' = 65 = 0x41 = 01000001
```

ASCII uses only 7 bits, which was enough for basic English text and control symbols.

That made it simple and highly influential.

---

## The Problem: The World Has More Than ASCII

ASCII works for basic English text, but not for:

- accented Latin characters
- non-Latin alphabets
- Chinese, Japanese, Korean
- emoji
- mathematical symbols

As software became global, ASCII alone was no longer enough.

---

## Latin-1 and Similar Extensions

Before modern Unicode became dominant, various 8-bit encodings extended ASCII for regional needs.

One example is **Latin-1**.

These encodings often agreed on the first 128 ASCII values, but used the higher byte values differently.

That led to a major problem:

> The same byte sequence could mean different text under different encodings.

This is one of the main historical causes of mojibake, the garbled text you see when bytes are decoded with the wrong encoding.

---

## Unicode: One Shared Character Space

**Unicode** is not just one byte encoding. It is a universal character standard.

Its big idea is:

- define a huge space of **code points** for characters across writing systems and symbols

Examples:

- `U+0041` for `A`
- `U+1F600` for a grinning face emoji

A **code point** identifies the character conceptually.

But a code point is still not the same thing as bytes on disk or on the network.

That requires an encoding such as UTF-8 or UTF-16.

---

## Character Set vs Encoding

This distinction is easy to blur, so make it explicit.

### Character Set / Character Space

What symbols exist?

### Encoding

How are those symbols represented as bytes?

Unicode gives the shared character space.
UTF-8, UTF-16, and UTF-32 are ways of encoding Unicode characters into bytes.

---

## Why Text Corruption Happens

Text often breaks because one system does:

1. encode text using one encoding
2. another system decodes the bytes using a different encoding

Example pattern:

- sender encodes in UTF-8
- receiver assumes Latin-1

The bytes themselves are unchanged. The interpretation is wrong.

This is the same core lesson from earlier:

> The bytes are not self-explanatory. Meaning depends on the agreed encoding.

---

## Why Developers Should Care

Character encoding explains:

- why text looks corrupted even when the bytes arrived intact
- why APIs and file formats should specify encodings explicitly
- why Unicode support matters in modern software
- why string length can be trickier than “number of bytes”

If your software handles user input, files, web content, logs, or databases, encoding is not optional knowledge.

---

## Common Misunderstandings

### “Text is stored as letters directly”

No. It is stored as encoded numeric data.

### “Unicode is the same thing as UTF-8”

No. Unicode is the character standard. UTF-8 is one encoding for it.

### “If text looks broken, the bytes must be damaged” 

Not necessarily. Often the bytes are fine and the decoder used the wrong encoding.

---

## Hands-On Exercise

Take a small word with a non-ASCII character, such as `café`.

1. Save or inspect it as UTF-8 bytes.
2. Look at the bytes in hex.
3. Decode the same bytes incorrectly as Latin-1 or another 8-bit encoding if your tools allow it.
4. Observe how mojibake happens without any byte corruption.

---

## Recap

- Text is represented as numbers, then encoded into bytes.
- ASCII was an early common encoding but is far too limited for global text.
- Unicode defines a shared character space through code points.
- Encodings like UTF-8 turn those code points into bytes.
- Garbled text usually comes from decoding bytes with the wrong encoding.

Next, we go deeper into the most important modern text encoding on the web and in many systems: UTF-8.