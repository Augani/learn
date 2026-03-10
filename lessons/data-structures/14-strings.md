# Lesson 14: String Algorithms — Matching, Hashing, Tries

## Why String Algorithms Matter

Strings are the most common data type in application programming. You work with them constantly: searching logs, parsing data, autocomplete, spell checking, DNA sequence analysis, URL routing.

Understanding how string search and string-specialized data structures work lets you choose the right tool and avoid O(n*m) traps when O(n+m) solutions exist.

## Naive String Search

### The Problem

Find all occurrences of a pattern P in a text T.

```
Text:    "ABCABABCABC"
Pattern: "ABCAB"

         ABCABABCABC
         ABCAB        ← match at position 0? Check...
         ↓↓↓↓↓
         ABCAB = ABCAB  ✓ MATCH at position 0!

         ABCABABCABC
          ABCAB       ← match at position 1?
          ↓
          B ≠ A        ✗ no match

         ABCABABCABC
           ABCAB      ← match at position 2?
           ↓
           C ≠ A       ✗ no match

         ...continue checking every position...
```

```rust
fn naive_search(text: &str, pattern: &str) -> Vec<usize> {
    let mut results = Vec::new();
    let text_bytes = text.as_bytes();
    let pattern_bytes = pattern.as_bytes();

    if pattern_bytes.len() > text_bytes.len() {
        return results;
    }

    for i in 0..=(text_bytes.len() - pattern_bytes.len()) {
        let mut matched = true;
        for j in 0..pattern_bytes.len() {
            if text_bytes[i + j] != pattern_bytes[j] {
                matched = false;
                break;
            }
        }
        if matched {
            results.push(i);
        }
    }

    results
}
```

**Time**: O(n * m) worst case, where n = text length, m = pattern length
**Space**: O(1) (excluding output)

Worst case example: text = "AAAAAAAAAB", pattern = "AAAAB". At each position, you compare almost all of the pattern before failing.

## Rabin-Karp: Hash-Based String Search

### The Idea

Instead of comparing characters one by one, compute a **hash** of the pattern and compare it with the hash of each substring of the same length. Hash comparison is O(1). Only do character-by-character comparison when hashes match.

```
Text:    "ABCABABCABC"  (n=11)
Pattern: "ABCAB"        (m=5)

Pattern hash: hash("ABCAB") = 42

Sliding window:
  hash("ABCAB") = 42 → matches pattern hash! → verify: "ABCAB" == "ABCAB" ✓
  hash("BCABA") = 37 → no match, skip
  hash("CABAB") = 29 → no match, skip
  hash("ABABC") = 31 → no match, skip
  ...
```

### Rolling Hash

The key optimization: compute each window's hash in O(1) by **rolling** — subtract the outgoing character, add the incoming character:

```
Rolling hash (simplified):

Window "ABCAB":  hash = A*p⁴ + B*p³ + C*p² + A*p¹ + B*p⁰

Slide right by 1 to get "BCABA":
  Remove A from front:   hash = hash - A*p⁴
  Shift left:            hash = hash * p
  Add A at end:          hash = hash + A*p⁰

This is O(1) per slide instead of O(m) to recompute.
```

```rust
fn rabin_karp(text: &str, pattern: &str) -> Vec<usize> {
    let mut results = Vec::new();
    let text_bytes = text.as_bytes();
    let pattern_bytes = pattern.as_bytes();
    let n = text_bytes.len();
    let m = pattern_bytes.len();

    if m > n {
        return results;
    }

    let base: u64 = 256;
    let modulus: u64 = 1_000_000_007;

    let mut pattern_hash: u64 = 0;
    let mut text_hash: u64 = 0;
    let mut h: u64 = 1;

    for _ in 0..m - 1 {
        h = (h * base) % modulus;
    }

    for i in 0..m {
        pattern_hash = (base * pattern_hash + pattern_bytes[i] as u64) % modulus;
        text_hash = (base * text_hash + text_bytes[i] as u64) % modulus;
    }

    for i in 0..=(n - m) {
        if pattern_hash == text_hash {
            if &text_bytes[i..i + m] == pattern_bytes {
                results.push(i);
            }
        }

        if i < n - m {
            text_hash = (base * (text_hash + modulus - (text_bytes[i] as u64 * h) % modulus)
                + text_bytes[i + m] as u64) % modulus;
        }
    }

    results
}
```

**Time**: O(n + m) average case, O(n * m) worst case (many hash collisions)
**Space**: O(1)

Rabin-Karp is especially useful for **multiple pattern search** — compute hash of each pattern, then scan the text once, checking against all pattern hashes.

## Tries (Prefix Trees)

### The Autocomplete Analogy

When you type in a search bar, the system suggests completions:

```
Type "pro"  →  ["program", "project", "promise", "process"]
Type "prog" →  ["program", "progress"]
Type "proje" → ["project"]
```

A trie stores words as paths in a tree. Each edge is a character, each path from root to a marked node is a stored word.

### Trie Structure

```
Words: ["cat", "car", "card", "care", "do", "dog"]

                 (root)
                /      \
               c        d
              /          \
             a            o
            / \          / \
           t   r        g   ★
           ★  / \       ★
             d   e
             ★   ★

★ = end of word marker

Path root→c→a→t→★ = "cat"
Path root→c→a→r→★ = "car"
Path root→c→a→r→d→★ = "card"
Path root→c→a→r→e→★ = "care"
Path root→d→o→★ = "do"
Path root→d→o→g→★ = "dog"
```

### Trie Operations

```
Search for "car":
  root → 'c' exists? yes → 'a' exists? yes → 'r' exists? yes → is word? yes ✓

Search for "ca":
  root → 'c' exists? yes → 'a' exists? yes → is word? no ✗
  ("ca" is a prefix but not a stored word)

Search for "cup":
  root → 'c' exists? yes → 'u' exists? no ✗

Autocomplete "ca":
  Navigate to node at "ca"
  DFS from there to find all words: ["cat", "car", "card", "care"]
```

### Implementation

```rust
use std::collections::HashMap;

struct TrieNode {
    children: HashMap<char, TrieNode>,
    is_word: bool,
}

struct Trie {
    root: TrieNode,
}

impl TrieNode {
    fn new() -> Self {
        Self {
            children: HashMap::new(),
            is_word: false,
        }
    }
}

impl Trie {
    fn new() -> Self {
        Self { root: TrieNode::new() }
    }

    fn insert(&mut self, word: &str) {
        let mut node = &mut self.root;
        for ch in word.chars() {
            node = node.children.entry(ch).or_insert_with(TrieNode::new);
        }
        node.is_word = true;
    }

    fn search(&self, word: &str) -> bool {
        let mut node = &self.root;
        for ch in word.chars() {
            match node.children.get(&ch) {
                Some(child) => node = child,
                None => return false,
            }
        }
        node.is_word
    }

    fn starts_with(&self, prefix: &str) -> bool {
        let mut node = &self.root;
        for ch in prefix.chars() {
            match node.children.get(&ch) {
                Some(child) => node = child,
                None => return false,
            }
        }
        true
    }

    fn autocomplete(&self, prefix: &str) -> Vec<String> {
        let mut node = &self.root;
        for ch in prefix.chars() {
            match node.children.get(&ch) {
                Some(child) => node = child,
                None => return Vec::new(),
            }
        }

        let mut results = Vec::new();
        self.collect_words(node, &mut prefix.to_string(), &mut results);
        results
    }

    fn collect_words(&self, node: &TrieNode, current: &mut String, results: &mut Vec<String>) {
        if node.is_word {
            results.push(current.clone());
        }
        for (&ch, child) in &node.children {
            current.push(ch);
            self.collect_words(child, current, results);
            current.pop();
        }
    }
}
```

### Trie Complexity

| Operation | Time | Space |
|-----------|------|-------|
| Insert word | O(m) | O(m) per word |
| Search word | O(m) | — |
| Prefix check | O(m) | — |
| Autocomplete | O(m + k) | — |

Where m = word length, k = number of results.

Total space: O(total characters across all words). Can be high, but shared prefixes save space.

### Trie vs HashMap for Word Lookup

| | Trie | HashMap |
|---|---|---|
| Exact lookup | O(m) | O(m) average (hash computation) |
| Prefix search | O(m) + enumerate | O(n) scan all keys |
| Autocomplete | Natural, efficient | Not supported |
| Sorted iteration | Alphabetical DFS | Must sort |
| Space | Can be large (pointers) | More compact |
| Best for | Prefix operations, autocomplete | Exact key-value lookup |

Use a trie when you need prefix operations. Use a HashMap when you only need exact lookups.

### Trie Use Cases

**1. Autocomplete and Search Suggestions**
```
Google search, IDE code completion, phone keyboard predictions
```

**2. Spell Checking**
```
Check if word exists in dictionary → trie lookup O(m)
Suggest corrections → find words within edit distance 1-2
```

**3. IP Routing Tables**
```
Router looks up destination IP: 192.168.1.42
Trie of IP prefixes:
  192.168.* → route to internal network
  10.0.* → route to VPN
  * → route to internet

Longest prefix match = most specific route
```

**4. DNS Resolution**
```
Reverse DNS trie (stored right to left):
  com.google.www → 142.250.80.46
  com.google.maps → 142.250.80.47
  org.wikipedia.en → 208.80.154.224
```

## Rust String Methods

Rust has excellent built-in string search:

```rust
let text = "Hello, world! Hello, Rust!";

text.contains("world");              // true — O(n)
text.find("Hello");                  // Some(0) — first occurrence
text.rfind("Hello");                 // Some(14) — last occurrence
text.starts_with("Hello");           // true — O(m)
text.ends_with("Rust!");             // true — O(m)

text.matches("Hello").count();       // 2
text.match_indices("Hello").collect::<Vec<_>>();
// [(0, "Hello"), (14, "Hello")]

text.replace("Hello", "Hi");         // "Hi, world! Hi, Rust!"
text.replacen("Hello", "Hi", 1);     // "Hi, world! Hello, Rust!"

let words: Vec<&str> = text.split_whitespace().collect();
let parts: Vec<&str> = text.split(", ").collect();
```

For regex-based search, use the `regex` crate:

```rust
// Add to Cargo.toml: regex = "1"
use regex::Regex;

let re = Regex::new(r"\b\w+@\w+\.\w+\b").unwrap();
let text = "Contact alice@example.com or bob@test.org";

for mat in re.find_iter(text) {
    println!("Found email: {}", mat.as_str());
}
```

## Cross-Language Comparison

| Operation | Rust | Go | TypeScript |
|-----------|------|-----|------------|
| Contains | `str.contains()` | `strings.Contains()` | `str.includes()` |
| Find | `str.find()` | `strings.Index()` | `str.indexOf()` |
| Replace | `str.replace()` | `strings.ReplaceAll()` | `str.replaceAll()` |
| Split | `str.split()` | `strings.Split()` | `str.split()` |
| Regex | `regex` crate | `regexp` stdlib | `RegExp` built-in |
| Trie | Implement or crate | Implement or package | Implement or npm |

## Exercises

### Exercise 1: Implement a Trie for Autocomplete

Build a trie that supports insert, search, and autocomplete:

```rust
fn main() {
    let mut trie = Trie::new();
    let words = [
        "apple", "application", "apply", "banana", "band",
        "bandana", "can", "canada", "candy", "candle",
    ];
    for word in &words {
        trie.insert(word);
    }

    assert!(trie.search("apple"));
    assert!(!trie.search("app"));
    assert!(trie.starts_with("app"));

    let suggestions = trie.autocomplete("can");
    println!("Suggestions for 'can': {:?}", suggestions);
    // Should include: can, canada, candy, candle

    let suggestions = trie.autocomplete("app");
    println!("Suggestions for 'app': {:?}", suggestions);
    // Should include: apple, application, apply
}
```

### Exercise 2: Word Search with Trie

Given a grid of characters and a list of words, find all words that can be formed by following adjacent cells (up/down/left/right):

```rust
fn find_words(board: &[Vec<char>], words: &[&str]) -> Vec<String> {
    // 1. Build a trie from the word list
    // 2. DFS from each cell, following trie paths
    // 3. When you reach a word end in the trie, add to results
    todo!()
}

fn main() {
    let board = vec![
        vec!['o', 'a', 'a', 'n'],
        vec!['e', 't', 'a', 'e'],
        vec!['i', 'h', 'k', 'r'],
        vec!['i', 'f', 'l', 'v'],
    ];
    let words = vec!["oath", "pea", "eat", "rain"];
    let found = find_words(&board, &words);
    println!("Found: {:?}", found);
    // Expected: ["oath", "eat"]
}
```

### Exercise 3: Implement Rabin-Karp

Build the Rabin-Karp algorithm and test it against Rust's built-in `str.find()`:

```rust
fn rabin_karp_search(text: &str, pattern: &str) -> Vec<usize> {
    todo!()
}

fn main() {
    let text = "AABAACAADAABAABA";
    let pattern = "AABA";

    let positions = rabin_karp_search(text, pattern);
    println!("Found at positions: {:?}", positions);
    // Expected: [0, 9, 12]

    // Verify against built-in
    let builtin: Vec<usize> = text.match_indices(pattern).map(|(i, _)| i).collect();
    assert_eq!(positions, builtin);
}
```

### Exercise 4: Spell Checker

Build a simple spell checker using a trie:

```rust
struct SpellChecker {
    trie: Trie,
}

impl SpellChecker {
    fn new(dictionary: &[&str]) -> Self { todo!() }

    fn is_correct(&self, word: &str) -> bool { todo!() }

    fn suggest(&self, word: &str, max_distance: usize) -> Vec<String> {
        // Find words in dictionary within `max_distance` edit distance
        // Edit distance = insertions + deletions + substitutions
        // This is a DFS through the trie, allowing up to max_distance errors
        todo!()
    }
}
```

---

Next: [Lesson 15: Caching Strategies](./15-caching.md)
