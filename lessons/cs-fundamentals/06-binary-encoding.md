# Lesson 6: Binary, Bits, and How Data Is Encoded

## Binary: A Language of Light Switches

Imagine a room with 8 light switches on the wall. Each switch is either ON (1)
or OFF (0). There are no dimmer switches, no in-between states — just on and
off.

With 8 switches, how many unique combinations can you make? Each switch has 2
states, so: 2 x 2 x 2 x 2 x 2 x 2 x 2 x 2 = **256 combinations**.

That's one byte. Eight bits. Every piece of data in your computer — every
photo, every song, every email — is encoded as patterns of ones and zeros.
There is literally nothing else.

```
  One byte = 8 bits = 8 light switches

  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
  │ OFF │ OFF │  ON │ OFF │  ON │ OFF │  ON │ OFF │
  │  0  │  0  │  1  │  0  │  1  │  0  │  1  │  0  │
  └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
  128    64    32    16     8     4     2     1

  This pattern = 32 + 8 + 2 = 42

  The number 42 in binary is: 00101010
```

---

## Counting in Binary: The Finger Trick

In decimal, you count with 10 fingers: 0 through 9, then you carry.
Each finger represents one of 10 values.

But what if each finger were a **binary digit** — either up (1) or down (0)?
You have 10 fingers, each with 2 states: 2^10 = **1,024** possible values.

You can count to 1,023 on your fingers in binary!

```
  Decimal counting with fingers (0-9, then you're stuck):
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ... out of fingers

  Binary counting with fingers (each finger = one bit):
  00000 00000 = 0
  00000 00001 = 1
  00000 00010 = 2
  00000 00011 = 3
  00000 00100 = 4
  ...
  11111 11111 = 1023

  Right thumb   = 1
  Right index   = 2
  Right middle  = 4
  Right ring    = 8
  Right pinky   = 16
  Left thumb    = 32
  ...and so on (each finger is worth 2x the previous)
```

---

## Place Values: Why 00101010 = 42

In decimal, each position is worth 10x the previous:
- 42 = (4 x 10) + (2 x 1)

In binary, each position is worth 2x the previous:

```
  Position:   7     6     5     4     3     2     1     0
  Value:     128    64    32    16     8     4     2     1
  Bits:       0     0     1     0     1     0     1     0

  Sum the positions where the bit is 1:
  32 + 8 + 2 = 42  ✓
```

Quick conversions to practice:

```
  Binary        Calculation              Decimal
  ────────────────────────────────────────────────
  00000001      1                        1
  00000010      2                        2
  00000100      4                        4
  00001000      8                        8
  00001111      8+4+2+1                  15
  00010000      16                       16
  01000001      64+1                     65 (ASCII 'A')
  01100001      64+32+1                  97 (ASCII 'a')
  11111111      128+64+32+16+8+4+2+1     255
```

---

## Hexadecimal: A Shorthand for Binary

Binary is hard to read. `11111111101011001101111011101111` — quick, what number
is that? Impossible to parse at a glance.

Hexadecimal (base 16) is a shorthand. Every 4 binary digits map to exactly one
hex digit. It's like Roman numerals being shorthand for counting tally marks.

```
  Binary    Hex     Decimal        Binary    Hex     Decimal
  0000      0       0              1000      8       8
  0001      1       1              1001      9       9
  0010      2       2              1010      A       10
  0011      3       3              1011      B       11
  0100      4       4              1100      C       12
  0101      5       5              1101      D       13
  0110      6       6              1110      E       14
  0111      7       7              1111      F       15
```

Now that monster binary number becomes:

```
  1111 1111 1010 1100 1101 1110 1110 1111
  F    F    A    C    D    E    E    F

  0xFFACDEEF — much more readable!
```

That's why memory addresses, colors, and byte data are shown in hex:
- Memory address: `0x7ffd4a3b1c20`
- HTML color: `#FF5733` (red=FF, green=57, blue=33)
- A byte: `0x2A` = `00101010` = 42

```python
# Python: different bases for the same number
print(42)        # decimal: 42
print(bin(42))   # binary:  0b101010
print(hex(42))   # hex:     0x2a
print(oct(42))   # octal:   0o52
```

```rust
fn main() {
    let x: u8 = 42;
    println!("decimal: {}", x);       // 42
    println!("binary:  {:08b}", x);   // 00101010
    println!("hex:     {:02x}", x);   // 2a
    println!("octal:   {:o}", x);     // 52
}
```

```go
package main

import "fmt"

func main() {
    x := 42
    fmt.Printf("decimal: %d\n", x)   // 42
    fmt.Printf("binary:  %08b\n", x) // 00101010
    fmt.Printf("hex:     %02x\n", x) // 2a
    fmt.Printf("octal:   %o\n", x)   // 52
}
```

---

## How Text Is Stored: From ASCII to UTF-8

Computers only understand numbers. So how do we store the letter 'A'?

We agree on a lookup table. ASCII (1963) assigned a number to each English
character:

```
  ASCII Table (selected characters):

  Dec   Bin         Char     Dec   Bin         Char
  ─────────────────────────────────────────────────
  32    00100000    (space)  65    01000001    A
  33    00100001    !        66    01000010    B
  48    00110000    0        90    01011010    Z
  49    00110001    1        97    01100001    a
  57    00111001    9        122   01111010    z

  "Hi" in memory:
  ┌──────────┬──────────┬──────────┐
  │ 01001000 │ 01101001 │ 00000000 │
  │  H (72)  │  i (105) │ null (0) │
  └──────────┴──────────┴──────────┘
```

ASCII uses 7 bits (128 characters). Enough for English, digits, punctuation.
But what about Chinese, Arabic, Hindi, emoji?

### Unicode and UTF-8

Unicode assigns a **code point** (a number) to every character in every writing
system: U+0041 = A, U+4E16 = shi (world in Chinese), U+1F600 = a smiley face.
There are over 150,000 characters.

But how do you store these numbers efficiently? If every character used 4 bytes
(enough for any code point), English text would waste 3 bytes per character.

**UTF-8** is a clever variable-width encoding — like shipping boxes of
different sizes. Small items (English letters) get small boxes (1 byte). Larger
items (Chinese characters) get bigger boxes (3 bytes). Emoji get the biggest
boxes (4 bytes).

```
  UTF-8 encoding rules:

  Code Point Range    Bytes   Bit Pattern
  ──────────────────────────────────────────────────────
  U+0000 - U+007F    1       0xxxxxxx              (ASCII compatible!)
  U+0080 - U+07FF    2       110xxxxx 10xxxxxx
  U+0800 - U+FFFF    3       1110xxxx 10xxxxxx 10xxxxxx
  U+10000 - U+10FFFF 4       11110xxx 10xxxxxx 10xxxxxx 10xxxxxx

  Examples:
  'A'  = U+0041 = 01000001                          (1 byte)
  'e'  = U+00E9 = 11000011 10101001                  (2 bytes)
  'shi'= U+4E16 = 11100100 10111000 10010110         (3 bytes)
  '😀' = U+1F600= 11110000 10011111 10011000 10000000 (4 bytes)
```

The genius of UTF-8: English text is **byte-for-byte identical** to ASCII.
Existing ASCII files are already valid UTF-8. The entire internet adopted it
because of this backward compatibility.

```python
# Python: strings are Unicode by default
text = "Hello, 世界! 😀"
print(len(text))                    # 11 (characters / code points)
print(len(text.encode('utf-8')))    # 18 (bytes in UTF-8)
# 'H','e','l','l','o',',',' ' = 7 bytes (1 each)
# '世','界' = 6 bytes (3 each)
# '!' = 1 byte, ' ' = 1 byte
# '😀' = 4 bytes
# Total: 7 + 6 + 1 + 4 = 18 bytes  (plus space = 18, one less comma)
```

```rust
fn main() {
    let text = "Hello, 世界! 😀";
    println!("chars: {}", text.chars().count());  // 11
    println!("bytes: {}", text.len());            // 18

    // Iterate over bytes vs chars:
    for b in "A世".bytes() {
        print!("{:08b} ", b);
    }
    // 01000001 11100100 10111000 10010110
    // A(1 byte)  世 (3 bytes)
}
```

---

## How Integers Are Stored

### Unsigned Integers

Straightforward binary. An `u8` uses all 8 bits for the value: range 0 to 255.

### Signed Integers: Two's Complement

How do you represent negative numbers with only 1s and 0s? The most common
answer is **two's complement** — and the analogy is a car odometer.

Imagine an odometer that shows 3 digits: 000 to 999. When you're at 000 and
drive backward 1 mile, it rolls to 999. Drive backward 2 miles, it shows 998.

We treat the top half of the range as negative numbers:

```
  Two's complement for i8 (8 bits):

  Binary      Unsigned    Signed (two's complement)
  ──────────────────────────────────────────────────
  0000 0000   0           0
  0000 0001   1           1
  0111 1110   126         126
  0111 1111   127         127       ← max positive
  1000 0000   128        -128       ← min negative (rolls over!)
  1000 0001   129        -127
  1111 1110   254        -2
  1111 1111   255        -1         ← odometer rolled back 1

  The leading bit (MSB) indicates sign:
  0 = positive, 1 = negative
```

To negate a number in two's complement: flip all bits, add 1.

```
  5 in binary:   0000 0101
  Flip all bits:  1111 1010
  Add 1:          1111 1011  = -5

  Verify: 0000 0101 + 1111 1011 = 1 0000 0000
  (the carry overflows out, leaving 0000 0000 = 0)  ✓
```

---

## How Floating Point Works: Scientific Notation in Binary

How does a computer store 3.14? Or 0.000001? Or 6.022 x 10^23?

It uses the same trick you learned in science class: **scientific notation**.
In decimal, 3.14 = 3.14 x 10^0 = 0.314 x 10^1. You store the significant
digits (mantissa) and the exponent separately.

IEEE 754 (the universal standard) does this in binary:

```
  A 64-bit float (f64) has three parts:

  ┌──────┬─────────────┬──────────────────────────────────────────────────┐
  │ Sign │  Exponent   │                  Mantissa                       │
  │ 1 bit│  11 bits    │                  52 bits                        │
  └──────┴─────────────┴──────────────────────────────────────────────────┘
   bit 63  bits 62-52    bits 51-0

  Sign:     0 = positive, 1 = negative
  Exponent: how far to shift the decimal point (biased by 1023)
  Mantissa: the significant digits (with an implicit leading 1)


  A 32-bit float (f32):

  ┌──────┬──────────┬───────────────────────────┐
  │ Sign │ Exponent │         Mantissa           │
  │ 1 bit│  8 bits  │         23 bits            │
  └──────┴──────────┴───────────────────────────┘
```

### Why 0.1 + 0.2 != 0.3

In decimal, 1/3 = 0.33333... forever. You can't write it exactly in decimal.

Similarly, 0.1 in binary is 0.000110011001100110011... repeating forever. A
64-bit float can only store 52 bits of mantissa, so it rounds. This tiny
rounding error is why:

```
  0.1 (stored) = 0.1000000000000000055511151231257827021181583404541015625
  0.2 (stored) = 0.2000000000000000111022302462515654042363166809082031250
  Sum          = 0.3000000000000000444089209850062616169452667236328125000
  0.3 (stored) = 0.2999999999999999888977697537484345957636833190917968750

  0.1 + 0.2 ≠ 0.3 because of accumulated rounding errors
```

This is not a bug. It's a fundamental limitation of representing infinite
decimal fractions in finite binary.

```python
print(0.1 + 0.2)           # 0.30000000000000004
print(0.1 + 0.2 == 0.3)    # False

# For exact decimal arithmetic (money!):
from decimal import Decimal
print(Decimal('0.1') + Decimal('0.2') == Decimal('0.3'))  # True
```

```rust
fn main() {
    let x: f64 = 0.1 + 0.2;
    println!("{:.20}", x);         // 0.30000000000000004441
    println!("{}", x == 0.3);      // false

    // Use epsilon comparison:
    println!("{}", (x - 0.3).abs() < f64::EPSILON);  // true (usually)
}
```

---

## Endianness: Which End Do You Start Reading?

The number 0x12345678 is 4 bytes: 12, 34, 56, 78. But which order do you store
them in memory?

Think of a phone number: 555-1234. You could write it left-to-right (as we
normally do) or right-to-left. Both represent the same number, but you need
to agree on the convention.

```
  BIG-ENDIAN: most significant byte first (the "big end" goes first)
  Like writing a number normally: left to right

  Address:  0x00   0x01   0x02   0x03
           ┌──────┬──────┬──────┬──────┐
           │  12  │  34  │  56  │  78  │
           └──────┴──────┴──────┴──────┘
           Most                 Least
           significant          significant


  LITTLE-ENDIAN: least significant byte first (the "little end" goes first)
  Like writing a number backward: right to left

  Address:  0x00   0x01   0x02   0x03
           ┌──────┬──────┬──────┬──────┐
           │  78  │  56  │  34  │  12  │
           └──────┴──────┴──────┴──────┘
           Least                Most
           significant          significant
```

Most modern CPUs (x86, ARM) are **little-endian**. Network protocols (TCP/IP)
are **big-endian** (also called "network byte order"). This is why you
sometimes need to convert between the two when sending data over a network.

The names come from Gulliver's Travels, where two factions fought over which
end of a boiled egg to crack open. It's equally arbitrary for bytes.

```rust
fn main() {
    let x: u32 = 0x12345678;
    let bytes = x.to_le_bytes();  // little-endian
    println!("LE: {:02x} {:02x} {:02x} {:02x}", bytes[0], bytes[1], bytes[2], bytes[3]);
    // LE: 78 56 34 12

    let bytes = x.to_be_bytes();  // big-endian
    println!("BE: {:02x} {:02x} {:02x} {:02x}", bytes[0], bytes[1], bytes[2], bytes[3]);
    // BE: 12 34 56 78
}
```

```go
package main

import (
    "encoding/binary"
    "fmt"
)

func main() {
    buf := make([]byte, 4)

    binary.LittleEndian.PutUint32(buf, 0x12345678)
    fmt.Printf("LE: %02x %02x %02x %02x\n", buf[0], buf[1], buf[2], buf[3])
    // LE: 78 56 34 12

    binary.BigEndian.PutUint32(buf, 0x12345678)
    fmt.Printf("BE: %02x %02x %02x %02x\n", buf[0], buf[1], buf[2], buf[3])
    // BE: 12 34 56 78
}
```

---

## Bitwise Operations: Flipping Switches

Bitwise operations work on individual bits. Think of them as operations on
rows of light switches.

```
  AND (&): both switches must be ON for the result to be ON
  "Do you have a key AND a badge? Then enter."

    1010 1100
  & 1111 0000
  ──────────
    1010 0000   (keeps the top 4 bits, zeros the bottom 4)


  OR (|): either switch ON means the result is ON
  "Do you have a key OR a badge? Either works."

    1010 1100
  | 1111 0000
  ──────────
    1111 1100   (sets all the top bits, keeps the bottom bits)


  XOR (^): result is ON if switches are DIFFERENT
  "Flip the switch if the other one is on"

    1010 1100
  ^ 1111 0000
  ──────────
    0101 1100   (flips the top 4 bits, keeps the bottom 4)


  NOT (~): flip every switch
    ~1010 1100
  ──────────
     0101 0011


  LEFT SHIFT (<<): slide all switches left, fill with OFF
    1010 1100 << 2
  ──────────
    1011 0000 00   (multiplies by 4, i.e., 2^2)


  RIGHT SHIFT (>>): slide all switches right
    1010 1100 >> 2
  ──────────
    0010 1011      (divides by 4, i.e., 2^2)
```

### Practical Uses

**Permission flags** (like Unix file permissions):

```python
# Each bit represents a permission
READ    = 0b100   # 4
WRITE   = 0b010   # 2
EXECUTE = 0b001   # 1

# Combine permissions with OR:
user_perms = READ | WRITE   # 0b110 = 6 (read + write)

# Check a permission with AND:
can_read = user_perms & READ    # 0b100 (truthy — yes, can read)
can_exec = user_perms & EXECUTE # 0b000 (falsy — no, can't execute)

# Add a permission with OR:
user_perms = user_perms | EXECUTE  # 0b111 = 7 (read + write + execute)

# Remove a permission with AND + NOT:
user_perms = user_perms & ~WRITE   # 0b101 = 5 (read + execute, no write)
```

```rust
fn main() {
    let read: u8    = 0b100;
    let write: u8   = 0b010;
    let execute: u8 = 0b001;

    let mut perms = read | write;  // 0b110

    // Check permission:
    if perms & read != 0 {
        println!("Can read!");    // prints
    }

    // Toggle permission with XOR:
    perms ^= execute;  // 0b111 (added execute)
    perms ^= execute;  // 0b110 (removed execute)

    println!("Permissions: {:03b}", perms);  // 110
}
```

```go
package main

import "fmt"

const (
    Read    = 1 << 2  // 4 = 0b100
    Write   = 1 << 1  // 2 = 0b010
    Execute = 1 << 0  // 1 = 0b001
)

func main() {
    perms := Read | Write  // 0b110

    if perms & Read != 0 {
        fmt.Println("Can read!")
    }

    // Add execute
    perms |= Execute   // 0b111
    fmt.Printf("Permissions: %03b\n", perms)  // 111
}
```

---

## Why This All Matters

You might wonder: "I write Python. Why do I need to know about bits and bytes?"

Because at some point, you'll hit one of these:

- **Network protocols**: TCP headers, IP addresses, port numbers — all defined
  as specific bit patterns. Parsing a packet means reading bytes.
- **File formats**: PNG, PDF, MP3 — all start with specific "magic bytes" that
  identify the format. `89 50 4E 47` = PNG.
- **Cryptography**: hashing, encryption, and digital signatures all operate on
  bytes and bits.
- **Performance**: understanding that an `i32` is 4 bytes helps you estimate
  memory usage. A million integers = 4 MB. Simple.
- **Debugging**: memory dumps, core dumps, hex editors — all show raw bytes.
  Knowing hex and binary lets you read them.
- **Interop**: sending data between languages, systems, or architectures
  requires agreeing on byte order, encoding, and sizes.

```
  ┌─────────────────────────────────────────────────────────────┐
  │  YOUR CODE                                                  │
  │  ┌───────────────────────────────────────────────────────┐  │
  │  │  x = "Hello" + " " + name                            │  │
  │  └───────────────────────────────────────────────────────┘  │
  │                        │                                    │
  │                 compiled / interpreted                      │
  │                        ▼                                    │
  │  ┌───────────────────────────────────────────────────────┐  │
  │  │  Machine code: allocate, copy bytes, concatenate      │  │
  │  └───────────────────────────────────────────────────────┘  │
  │                        │                                    │
  │                   executed on                               │
  │                        ▼                                    │
  │  ┌───────────────────────────────────────────────────────┐  │
  │  │  CPU + RAM: voltage patterns on silicon               │  │
  │  │  01001000 01100101 01101100 01101100 01101111 ...      │  │
  │  └───────────────────────────────────────────────────────┘  │
  │                                                             │
  │  It's bits all the way down.                                │
  └─────────────────────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: Binary Conversion
Convert these by hand (no calculator), then verify with code:
- 13 to binary
- 200 to binary
- `10110011` to decimal
- `0xFF` to decimal and binary

### Exercise 2: UTF-8 Exploration
Write a program in any language that takes a string and prints:
- The number of characters (code points)
- The number of bytes in UTF-8
- Each character with its Unicode code point and UTF-8 byte sequence

Test with: `"Hello, 世界! 🦀"`

### Exercise 3: Two's Complement
Using 8-bit two's complement (i8):
- What is the binary representation of -1?
- What is the binary representation of -128?
- What happens if you add 1 to 127 (`0111 1111`)?
- Verify your answers in Rust with `i8` operations.

### Exercise 4: Bitwise Permissions
Build a simple permissions system using bitwise flags. Define at least 4
permissions (READ, WRITE, EXECUTE, ADMIN). Write functions to:
- Grant a permission
- Revoke a permission
- Check if a permission is set
- Display all active permissions

Implement in Rust or Go.

### Exercise 5: Float Dissection
Write a Rust program that takes an `f64` value and prints:
- Its raw bytes in hex
- The sign bit, exponent bits, and mantissa bits separately
- Whether it's normal, subnormal, infinity, or NaN

Test with: `1.0`, `-1.0`, `0.1`, `f64::INFINITY`, `f64::NAN`, `0.0`

Hint: use `f64::to_bits()` to get the raw `u64` representation.

### Exercise 6: Endianness Detector
Write a program that determines whether your system is big-endian or
little-endian by storing a multi-byte integer and inspecting the first byte.
Implement in both Rust and Go.
