# Lesson 44: String Matching Algorithms

> **Analogy**: Searching for a word in a book can be done the naive way:
> start at every position and compare letter by letter. But smarter
> algorithms remember structure. KMP remembers how much of the pattern is
> still useful after a mismatch. Rabin-Karp turns substrings into rolling
> fingerprints. Boyer-Moore uses mismatches to jump far ahead. String
> matching is about avoiding redundant comparison.

---

## Why This Matters

Strings are everywhere:

- log search
- autocomplete
- DNA matching
- code search
- plagiarism detection
- search engines

Naively matching a pattern of length `m` inside a text of length `n`
can cost $O(nm)$. That is acceptable for tiny inputs and disastrous at
scale.

This lesson covers four core ideas:

- brute-force string search
- KMP
- Rabin-Karp
- Boyer-Moore

Each wins by avoiding work the naive method repeats.

---

## The Naive Baseline

### Problem

Find all occurrences of pattern `P` in text `T`.

### Idea

Try aligning the pattern at every possible starting position.

```
  Text:    ABABACABA
  Pattern: ABAC

  Alignment 0:
  ABABACABA
  ABAC
  AB A mismatch at 3rd character

  Alignment 1:
  ABABACABA
   ABAC
   B mismatch immediately

  Alignment 2:
  ABABACABA
    ABAC
    ABAC match
```

### Worst-case pain

If the text and pattern share long repeated prefixes, the algorithm can
redo almost the same comparisons many times.

Example:

```
  text    = AAAAAAAAAAB
  pattern = AAAAAB
```

At each alignment the algorithm nearly matches the whole pattern before
failing.

#### Python

```python
def naive_search(text: str, pattern: str) -> list[int]:
    matches: list[int] = []
    n = len(text)
    m = len(pattern)

    if m == 0:
        return list(range(n + 1))
    if m > n:
        return matches

    for start in range(n - m + 1):
        if text[start:start + m] == pattern:
            matches.append(start)

    return matches
```

Time:

$$
O(nm)
$$

This baseline matters because all smarter algorithms are really answers
to the question: what repeated work is the naive method doing?

---

## KMP: Knuth-Morris-Pratt

### Core idea

When a mismatch happens, do not restart the pattern from scratch.
Instead, use information about the pattern's own prefix/suffix overlap
to know how much of the previous work is still relevant.

### The failure function / LPS array

For each pattern index, compute the length of the **longest proper
prefix that is also a suffix** of the pattern prefix ending there.

For pattern:

```
  A B A B A C
  0 1 2 3 4 5
```

The LPS array is:

```
  index: 0 1 2 3 4 5
  char:  A B A B A C
  lps:   0 0 1 2 3 0
```

### Why this matters

Suppose you matched `ABABA` and then fail on the next character.

You already know the last `ABA` is a useful suffix that also matches the
pattern prefix `ABA`, so you can continue from there instead of starting
over at pattern index 0.

### ASCII mismatch trace

```
  Text:    A B A B A B A C
  Pattern: A B A B A C

  Match A B A B A
  Next comparison: text has B, pattern expects C -> mismatch

  Naive approach:
  restart from next text position

  KMP approach:
  lps[4] = 3, so keep the fact that ABA still matches
  Shift pattern without rechecking those characters
```

#### Python

```python
def build_lps(pattern: str) -> list[int]:
    lps = [0] * len(pattern)
    length = 0
    index = 1

    while index < len(pattern):
        if pattern[index] == pattern[length]:
            length += 1
            lps[index] = length
            index += 1
        elif length > 0:
            length = lps[length - 1]
        else:
            lps[index] = 0
            index += 1

    return lps


def kmp_search(text: str, pattern: str) -> list[int]:
    if pattern == "":
        return list(range(len(text) + 1))

    matches: list[int] = []
    lps = build_lps(pattern)
    text_index = 0
    pattern_index = 0

    while text_index < len(text):
        if text[text_index] == pattern[pattern_index]:
            text_index += 1
            pattern_index += 1
            if pattern_index == len(pattern):
                matches.append(text_index - pattern_index)
                pattern_index = lps[pattern_index - 1]
        elif pattern_index > 0:
            pattern_index = lps[pattern_index - 1]
        else:
            text_index += 1

    return matches
```

### Complexity

- build LPS: $O(m)$
- search: $O(n)$

Total:

$$
O(n + m)
$$

The key win is that text indices never move backward, and pattern
fallback is driven by precomputed structure.

---

## Rabin-Karp

### Core idea

Compare hashes before comparing characters.

If a window hash differs from the pattern hash, the window cannot match.
If the hashes match, verify with a direct string comparison to guard
against collisions.

### Rolling hash

For a length-`m` window:

```
  current window hash
  -> remove outgoing character contribution
  -> shift remaining positions
  -> add incoming character contribution
```

This update is $O(1)$ per window.

### Why it helps

You replace many full substring comparisons with much cheaper integer
hash comparisons.

#### TypeScript

```typescript
function rabinKarp(text: string, pattern: string): number[] {
  const matches: number[] = [];
  const n = text.length;
  const m = pattern.length;
  if (m === 0) {
    return Array.from({ length: n + 1 }, (_, index) => index);
  }
  if (m > n) {
    return matches;
  }

  const base = 256;
  const mod = 1_000_000_007;
  let power = 1;
  let patternHash = 0;
  let windowHash = 0;

  for (let index = 0; index < m - 1; index += 1) {
    power = (power * base) % mod;
  }

  for (let index = 0; index < m; index += 1) {
    patternHash = (patternHash * base + pattern.charCodeAt(index)) % mod;
    windowHash = (windowHash * base + text.charCodeAt(index)) % mod;
  }

  for (let start = 0; start <= n - m; start += 1) {
    if (patternHash === windowHash && text.slice(start, start + m) === pattern) {
      matches.push(start);
    }

    if (start < n - m) {
      const outgoing = (text.charCodeAt(start) * power) % mod;
      windowHash = (windowHash - outgoing + mod) % mod;
      windowHash = (windowHash * base + text.charCodeAt(start + m)) % mod;
    }
  }

  return matches;
}
```

### Complexity

- average: $O(n + m)$
- worst case with many collisions: $O(nm)$

Rabin-Karp is especially appealing when searching for many patterns or
when hash-based filtering is naturally useful.

---

## Boyer-Moore

### Core idea

Instead of comparing pattern characters left-to-right, compare from the
end of the pattern and use mismatch information to jump ahead far.

Two famous heuristics:

- bad character rule
- good suffix rule

### Bad character intuition

If a mismatch happens on character `X`, and `X` appears farther left in
the pattern, shift the pattern so that occurrence lines up. If `X` does
not appear in the pattern, skip past it completely.

### Why Boyer-Moore is powerful in practice

On natural language text and large alphabets, mismatches often let it
skip many positions at once.

This is why it performs so well in many real-world search systems even
though its details are more complex than KMP.

---

## Which Matching Algorithm When?

```
  SITUATION                           GOOD CHOICE

  simple baseline / tiny inputs       naive
  guaranteed linear single-pattern    KMP
  hashing / many patterns             Rabin-Karp
  practical large-text skipping       Boyer-Moore
```

There is no universally best string matcher. The best choice depends on
what structure you can exploit.

---

## What If We Just Used Brute Force Every Time?

Sometimes that is fine. But as inputs grow, repeated comparison waste
starts to dominate.

- KMP avoids rechecking pattern structure
- Rabin-Karp avoids many substring comparisons via hashes
- Boyer-Moore avoids many alignments entirely via large skips

The whole field of string matching exists because naive matching does
too much redundant work.

---

## Cross-Reference

For a more introductory strings lesson, see
[../data-structures/14-strings.md](../data-structures/14-strings.md).

---

## Exercises

1. Give a worst-case input where naive matching wastes many repeated
   comparisons.
2. What does the LPS array in KMP actually encode?
3. Why does KMP stay linear even after mismatches?
4. Why must Rabin-Karp still verify characters after a hash match?
5. Why can Boyer-Moore skip much farther than naive matching?
6. Which algorithm would you consider first for searching many patterns
   in a very long text and why?

---

## Key Takeaways

- String matching is about eliminating redundant comparison.
- KMP uses pattern self-overlap to avoid restarting from scratch.
- Rabin-Karp uses rolling hashes to filter candidate matches quickly.
- Boyer-Moore uses mismatch information to jump ahead aggressively.
- Naive matching is important as a baseline because it reveals what the
  smarter algorithms are improving.

The next lesson moves from matching to advanced string structures such
as suffix arrays, suffix trees, and the Burrows-Wheeler transform.

---

**Previous**: [Lesson 43 — Choosing the Right Paradigm](./43-paradigm-selection.md)
**Next**: [Lesson 45 — Advanced String Data Structures](./45-advanced-string-structures.md)