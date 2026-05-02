# Lesson 45: Advanced String Data Structures

> **Analogy**: A normal index at the back of a book tells you where a
> few chosen words occur. Advanced string structures are like building a
> complete index over every suffix of the text so search, prefix lookup,
> and compression-oriented transformations become fast and systematic.

---

## Why This Matters

String matching answers: does this pattern occur? Advanced string
structures answer richer questions efficiently over **large fixed texts**
that are queried many times:

- **Where does a pattern occur?**: return all starting positions, not
  just a yes/no answer
- **How many times does it occur?**: count occurrences without scanning
  the entire text
- **What substrings repeat?**: find longest repeated substrings for
  plagiarism detection or genome analysis
- **How can we support fast substring search over a fixed large text?**
  preprocess once, query many times — essential for search engines and
  databases
- **How can a text be transformed to help compression?**: rearrange text
  so similar contexts cluster, improving run-length and entropy coding

These structures matter most when the text is large (genomes, log files,
web crawls) and queried repeatedly. Preprocessing pays off because each
query becomes logarithmic or linear in pattern length, not text length.

This lesson covers:

- **Suffix arrays**: sort all suffixes for binary-search-based queries
- **Suffix trees**: compress all suffixes into a trie for linear-time
  substring operations
- **Burrows-Wheeler transform (BWT)**: a reversible transform that
  clusters similar characters for better compression

---

## Suffix Arrays

### Core idea

Take every suffix of the string, then sort those suffixes lexicographically.

For string:

```
  banana
```

Suffixes:

```
  0: banana
  1: anana
  2: nana
  3: ana
  4: na
  5: a
```

Sorted suffixes:

```
  5: a
  3: ana
  1: anana
  0: banana
  4: na
  2: nana
```

So the suffix array is:

```
  [5, 3, 1, 0, 4, 2]
```

### Why it helps

If suffixes are sorted, substring search becomes binary search over the
suffix array.

That means a fixed text can support many pattern queries efficiently.

#### Python

```python
def build_suffix_array(text: str) -> list[int]:
    return sorted(range(len(text)), key=lambda index: text[index:])
```

This simple version is not optimal for construction time, but it makes
the idea concrete.

### Search intuition

To search for pattern `ana`, binary-search the sorted suffixes and find
the range whose prefixes start with `ana`.

---

## Longest Common Prefix (LCP)

Suffix arrays become much more useful with the LCP array.

The LCP array stores the length of the common prefix between adjacent
sorted suffixes.

For `banana`, sorted suffixes are:

```
  a
  ana
  anana
  banana
  na
  nana
```

LCP values between adjacent rows are:

```
  -, 1, 3, 0, 0, 2
```

The LCP array is useful for:

- repeated substring analysis
- efficient substring comparison
- suffix-array-based search enhancements

---

## Suffix Trees

### Core idea

A suffix tree compresses all suffixes of a string into a trie-like
structure where repeated prefixes are shared and edges can represent
whole substrings, not just single characters.

### Why this is powerful

With a suffix tree, many substring problems can be solved in time linear
in the query length.

It supports tasks like:

- substring existence queries
- repeated substring discovery
- longest common substring variants

### ASCII intuition

For a small example like `aba$`:

```
  root
   |- aba$
   |- ba$
   |- a$
   |- $
```

After compression, common prefixes share paths.

### Ukkonen's algorithm overview

The full linear-time construction algorithm is advanced and subtle.
For this track, the important takeaway is conceptual:

- suffix trees are compressed suffix tries
- they can be built in linear time with sophisticated algorithms
- they trade implementation complexity for very strong query power

You do not need to memorize Ukkonen step-by-step to benefit from the
data structure at an algorithmic level.

---

## Suffix Array vs Suffix Tree

```
  STRUCTURE        MAIN STRENGTH                  MAIN COST

  Suffix array     simpler, compact               slower construction/query support details
  Suffix tree      very rich substring queries    much more complex to implement
```

In practice, suffix arrays are often favored because they are more
cache-friendly and easier to engineer.

---

## Burrows-Wheeler Transform (BWT)

### Core idea

The BWT rearranges characters so that similar contexts cluster together,
which helps compression.

### Construction outline

For a string with end marker, like `banana$`:

1. list all cyclic rotations
2. sort the rotations lexicographically
3. take the last column of the sorted matrix

### Rotations for `banana$`

```
  banana$
  anana$b
  nana$ba
  ana$ban
  na$bana
  a$banan
  $banana
```

Sort them, then read the last column.

The resulting string is the BWT.

### Why this helps compression

After transformation, characters with similar surrounding context tend
to group together, producing longer runs and more compressible patterns.

BWT is not itself compression. It is a transform that makes later
compression stages more effective.

---

## Practical Applications

- full-text indexing
- genome sequence search
- document search engines
- compression pipelines

These structures matter most when the text is large and queried many
times.

---

## Exercises

1. Build the suffix array for `mississippi` conceptually on paper. List
   all 11 suffixes, sort them lexicographically, and write the suffix
   array indices.
2. Why does a suffix array support binary search for substrings? What is
   the time complexity of searching for a pattern of length `m` in a
   text of length `n`?
3. What extra information does the LCP array provide? How can you use it
   to find the longest repeated substring in `O(n)` time?
4. Why are suffix trees considered powerful but implementation-heavy?
   Compare the space complexity of a suffix tree versus a suffix array.
5. Why does the BWT help compression without itself being compression?
   Explain how it creates runs of similar characters and why that benefits
   run-length encoding or Huffman coding.
6. Given a suffix array, design an algorithm to count how many times a
   pattern occurs in the original text.
7. Explain why the Burrows-Wheeler transform is reversible. What
   information do you need to reconstruct the original string?
8. In bioinformatics, why are suffix arrays and suffix trees essential
   for genome sequence alignment? What makes brute-force scanning
   infeasible for human genomes (3 billion base pairs)?

---

## Key Takeaways

- **Suffix arrays** sort all suffixes lexicographically and support
  efficient substring query patterns over fixed text. A pattern search
  becomes binary search in `O(m log n)` time where `m` is pattern length.
- **The LCP array** enhances suffix arrays by exposing shared prefix
  structure between adjacent sorted suffixes. It enables finding longest
  repeated substrings and counting occurrences efficiently.
- **Suffix trees** compress all suffixes into a trie-like structure where
  shared prefixes collapse. Many substring problems become solvable in
  time linear in the query length, but implementation is complex.
- **Suffix arrays are often preferred in practice** because they are more
  cache-friendly, use less memory, and are easier to implement correctly.
- **The Burrows-Wheeler transform (BWT)** rearranges text so characters
  with similar contexts cluster together, making subsequent compression
  stages more effective. It is reversible and used in tools like `bzip2`.
- **Advanced string structures** are about preprocessing a large text once
  so that later queries become much cheaper. The investment pays off when
  the text is queried many times.

The next lesson turns string ideas into interview-style practice.

---

**Previous**: [Lesson 44 — String Matching Algorithms](./44-string-matching.md)
**Next**: [Lesson 46 — Practice Problems — Strings](./46-practice-strings.md)