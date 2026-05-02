# Lesson 46: Practice Problems — Strings

> String problems often look different on the surface, but the real
> patterns repeat: counting, grouping, sliding windows, prefix matching,
> palindrome structure, and substring search. The goal here is not to
> memorize titles. It is to learn how to see those patterns quickly.

---

## How to Use This Lesson

Each problem includes:

- the main string pattern
- the brute-force instinct
- the better framing
- a concise optimal solution or key recurrence

This lesson includes:

- 3 easy problems
- 3 medium problems
- 2 hard problems

---

## Easy Problems

---

### Problem 1: Valid Anagram

**Pattern:** frequency counting

**Brute-force instinct:** sort both strings and compare.

**Better framing:** count character frequencies directly.

#### Python

```python
from collections import Counter


def is_anagram(first: str, second: str) -> bool:
    return Counter(first) == Counter(second)
```

---

### Problem 2: Longest Common Prefix

**Pattern:** shared prefix comparison

You can compare strings vertically character by character until a mismatch.

This is a reminder that not every string problem needs a heavy string
algorithm.

---

### Problem 3: Implement `strStr`

**Pattern:** substring search

This is the practice doorway to naive search and, for stronger follow-up,
KMP.

---

## Medium Problems

---

### Problem 4: Longest Substring Without Repeating Characters

**Pattern:** sliding window with last-seen positions

**Brute-force instinct:** check every substring.

**Better framing:** maintain a window with no repeated characters and
move its left edge only when a duplicate appears.

#### TypeScript

```typescript
function lengthOfLongestSubstring(text: string): number {
  const lastSeen = new Map<string, number>();
  let left = 0;
  let best = 0;

  for (let right = 0; right < text.length; right += 1) {
    const current = text[right];
    if (lastSeen.has(current)) {
      left = Math.max(left, (lastSeen.get(current) as number) + 1);
    }
    lastSeen.set(current, right);
    best = Math.max(best, right - left + 1);
  }

  return best;
}
```

---

### Problem 5: Longest Palindromic Substring

**Pattern:** expand around center

The brute-force approach checks every substring and every reverse.

The better framing is that every palindrome expands from a center:

- odd-length center at one character
- even-length center between two characters

This is a good example where a string problem looks DP-ish but a simpler
center-expansion technique is often cleaner.

---

### Problem 6: Group Anagrams

**Pattern:** canonical signature + hashing

Map each word to a signature such as its sorted letters or character
count vector, then group by signature.

#### Rust

```rust
use std::collections::HashMap;

fn group_anagrams(words: &[String]) -> Vec<Vec<String>> {
    let mut groups: HashMap<Vec<u8>, Vec<String>> = HashMap::new();

    for word in words {
        let mut counts = vec![0u8; 26];
        for byte in word.bytes() {
            counts[(byte - b'a') as usize] += 1;
        }
        groups.entry(counts).or_default().push(word.clone());
    }

    groups.into_values().collect()
}
```

---

## Hard Problems

---

### Problem 7: Minimum Window Substring

**Pattern:** sliding window with required counts

**Brute-force instinct:** check every substring and see whether it
contains all target characters.

**Optimal framing:**
Expand the right pointer until the window is valid, then shrink from the
left as much as possible while maintaining validity.

This is one of the best string-window problems because it tests precise
window invariants rather than raw coding difficulty.

---

### Problem 8: Palindrome Pairs

**Pattern:** string decomposition + fast lookup

The key idea is to split each word into left/right parts and ask whether
one side is a palindrome while the reverse of the other side exists.

This is hard because the solution comes from structural case analysis,
not from one obvious standard pattern.

---

## Pattern Identification Table

```
  PROBLEM                           PATTERN

  Valid anagram                     frequency counting
  Longest common prefix             vertical prefix scan
  strStr                            substring matching
  Longest substring no repeat       sliding window
  Longest palindromic substring     center expansion / interval thinking
  Group anagrams                    hashing by canonical signature
  Minimum window substring          constrained sliding window
  Palindrome pairs                  reverse lookup + palindrome checks
```

---

## Brute Force To Optimal Thinking

- `valid anagram`: character permutation reasoning becomes counting.
- `longest substring without repeats`: all substrings becomes one moving
  window.
- `longest palindromic substring`: all substrings becomes center-based
  expansion.
- `minimum window substring`: all candidate substrings becomes maintain a
  valid window and shrink aggressively.
- `palindrome pairs`: checking every pair becomes structural splitting
  and hash lookup.

---

## Exercises

1. Why does `longest substring without repeating characters` fit sliding
   window so naturally?
2. Why is `longest palindromic substring` often cleaner with center
   expansion than with full DP?
3. What makes `group anagrams` a hashing problem?
4. What invariant makes `minimum window substring` work?
5. Why is `palindrome pairs` structurally harder than the other string
   problems in this lesson?

---

## Key Takeaways

- String problems often reduce to a small set of recurring patterns.
- Sliding windows dominate many substring optimization problems.
- Counting and canonical forms make many grouping problems easy.
- Not every string problem needs advanced string data structures.
- The best practice habit is learning to spot the pattern under the text.

Phase 6 is now complete: you can match strings, reason about suffix-based
structures, and recognize common string problem patterns in practice.

---

**Previous**: [Lesson 45 — Advanced String Data Structures](./45-advanced-string-structures.md)
**Next**: [Lesson 47 — Bit Manipulation](./47-bit-manipulation.md)