# Lesson 22: Tries — Prefix Trees

> **Analogy**: Imagine a phone book organized letter by letter.
> Instead of storing each full name separately and repeatedly, you
> store common beginnings only once. Everyone whose name starts
> with `Car...` shares the same path until the names diverge.
> That is what a trie does: it turns shared prefixes into shared
> structure.

---

## Why This Matters

Hash tables are excellent for exact lookup. But they know nothing
about prefixes.

If you ask a hash table:

- does the exact word `cat` exist?

it is happy.

If you ask:

- what words start with `ca`?
- is there any word with prefix `trans`?
- give me autocomplete suggestions for `prog`

it has no direct structural help to offer.

Tries are designed for exactly those questions.

They matter in:

- autocomplete
- spell checking
- routing tables
- dictionaries and lexicons
- prefix matching for strings and URLs
- IP routing via bitwise prefix trees

By the end of this lesson, you will understand:

- how trie structure works
- insertion, search, prefix check, and delete
- why tries beat hash tables for prefix operations
- the cost of storing characters one edge at a time
- how radix trees / Patricia tries compress long chains

---

## The Core Idea

A trie stores strings as root-to-node paths.

- each edge corresponds to a character
- each marked node can represent a complete word
- shared prefixes are stored once

### Example

Words:

```
  cat
  car
  card
  care
  dog
  do
```

Trie:

```
                 (root)
                /      \
               c        d
               |        |
               a        o
              / \      / \
             t   r    g   ★
             ★  / \
               d   e
               ★   ★

  ★ means: a word ends here
```

This structure stores `car`, `card`, and `care` by sharing the
prefix path `c -> a -> r`.

That is the main win.

---

## Search and Prefix Matching

### Exact Search

To search for a word, follow the characters one by one.

Example: search for `car`

```
  root -> c -> a -> r

  path exists
  final node is marked as a complete word
  therefore "car" exists ✓
```

Example: search for `ca`

```
  root -> c -> a

  path exists
  but final node is not marked as a complete word
  therefore "ca" is only a prefix, not a stored word ✗
```

### Prefix Search

Now check whether any word starts with `ca`.

```
  root -> c -> a

  path exists
  that is enough
  therefore some word has prefix "ca" ✓
```

This distinction is one of the reasons tries are so useful:

- exact-word lookup
- prefix-existence lookup

are both natural operations.

---

## Insertion

Insert works by walking the path and creating missing nodes.

### Insert `care`

Suppose the trie already contains `car`.

```
  Existing:
  root -> c -> a -> r -> ★

  Insert "care":
  c exists
  a exists
  r exists
  e missing -> create node e
  mark e as a complete word
```

Result:

```
  root
   |
   c
   |
   a
   |
   r ★
   |
   e ★
```

The shared prefix is reused; only the missing suffix is added.

---

## Delete

Deletion is trickier than search or insertion because a word may
share prefix nodes with other words.

### Example 1: Delete `card`

If the trie contains `car`, `card`, and `care`, then deleting
`card` should remove only the `d` branch.

```
  Before:
  c -> a -> r ★
             / \
            d★  e★

  Delete "card":
  unmark/remove the d branch

  After:
  c -> a -> r ★
               \
               e★
```

### Example 2: Delete `car`

If `car` is deleted but `card` and `care` remain, the node for
`r` must stay because it is still needed as a prefix node.

```
  Before:
  c -> a -> r ★
             / \
            d★  e★

  Delete "car":
  only remove the word marker at r

  After:
  c -> a -> r
             / \
            d★  e★
```

That is the key rule:

- remove nodes only when they are no longer needed by any other word

---

## Why Tries Beat Hash Tables for Prefix Operations

Suppose you want autocomplete suggestions for `prog`.

In a trie:

1. follow `p -> r -> o -> g`
2. once you reach that node, all completions are in its subtree

That is very direct.

In a hash table:

- keys are scattered by hash value
- strings with similar prefixes are not near each other
- to find all words with prefix `prog`, you may have to scan all keys

That is why tries outperform hash tables for prefix-based queries.

### Complexity intuition

If the word length is `m`:

- exact search in a trie: O(m)
- prefix check in a trie: O(m)

This cost depends on key length, not on the total number of stored
words.

That is extremely valuable for long dictionaries.

---

## Autocomplete

Autocomplete is one of the most intuitive trie applications.

### Example

Words:

```
  program
  progress
  project
  promise
  prompt
```

Query prefix: `pro`

```
  root -> p -> r -> o

  Once we reach the node for "pro",
  explore all descendants:

  program
  progress
  project
  promise
  prompt
```

So autocomplete is:

1. prefix navigation
2. subtree enumeration

That is a perfect structural match for tries.

---

## Compressed Tries: Radix Trees / Patricia Trees

A regular trie can waste space when many nodes have only one
child.

### Example of Wasted Chains

If the trie stores only:

```
  transport
```

then an ordinary trie might look like:

```
  root -> t -> r -> a -> n -> s -> p -> o -> r -> t
```

That is a long skinny chain.

### Compression Idea

Merge single-child chains into one edge labeled with a string.

```
  REGULAR TRIE                    RADIX TREE

  root                            root
   |                               |
   t                               "transport"
   |                               |
   r                               ★
   |
   a
   |
   n
   |
   s
   |
   p
   |
   o
   |
   r
   |
   t
   |
   ★
```

### Shared-Prefix Compression Example

Words:

```
  team
  teach
  teacher
```

Compressed form:

```
  root
   |
  "tea"
   /   \
 "m"★  "ch"★
           \
          "er"★
```

Compressed tries reduce memory overhead and height, which is why
Patricia tries are widely used in routing and systems software.

---

## Technical Deep-Dive: Implementations

### Python

```python
class TrieNode:
    def __init__(self):
        self.children: dict[str, TrieNode] = {}
        self.is_word = False


class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str) -> None:
        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
        node.is_word = True

    def search(self, word: str) -> bool:
        node = self.root
        for char in word:
            if char not in node.children:
                return False
            node = node.children[char]
        return node.is_word

    def starts_with(self, prefix: str) -> bool:
        node = self.root
        for char in prefix:
            if char not in node.children:
                return False
            node = node.children[char]
        return True
```

### TypeScript

```typescript
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isWord = false;
}

class Trie {
  private readonly root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    node.isWord = true;
  }

  search(word: string): boolean {
    let node = this.root;
    for (const char of word) {
      const next = node.children.get(char);
      if (next === undefined) {
        return false;
      }
      node = next;
    }
    return node.isWord;
  }

  startsWith(prefix: string): boolean {
    let node = this.root;
    for (const char of prefix) {
      const next = node.children.get(char);
      if (next === undefined) {
        return false;
      }
      node = next;
    }
    return true;
  }
}
```

### Rust

```rust
use std::collections::HashMap;

#[derive(Default)]
struct TrieNode {
    children: HashMap<char, TrieNode>,
    is_word: bool,
}

#[derive(Default)]
struct Trie {
    root: TrieNode,
}

impl Trie {
    fn insert(&mut self, word: &str) {
        let mut node = &mut self.root;
        for ch in word.chars() {
            node = node.children.entry(ch).or_default();
        }
        node.is_word = true;
    }

    fn search(&self, word: &str) -> bool {
        let mut node = &self.root;
        for ch in word.chars() {
            let Some(next) = node.children.get(&ch) else {
                return false;
            };
            node = next;
        }
        node.is_word
    }

    fn starts_with(&self, prefix: &str) -> bool {
        let mut node = &self.root;
        for ch in prefix.chars() {
            let Some(next) = node.children.get(&ch) else {
                return false;
            };
            node = next;
        }
        true
    }
}
```

---

## What If We Used a Hash Map of All Prefixes Instead?

That sounds tempting.

For every word, store every prefix in a hash map.

Example:

```
  word = "care"

  store:
  c
  ca
  car
  care
```

This can answer prefix-existence quickly, but it has major costs:

- duplicated storage of many prefixes
- awkward deletion bookkeeping
- poor support for structured traversal of completions

Most importantly, it throws away the elegant prefix sharing that
tries naturally exploit.

So while a prefix hash map can be useful in narrow cases, it is
not as structurally natural as a trie for dictionary-like prefix
workloads.

---

## Exercises

1. Insert `cat`, `car`, `care`, and `dog` into an empty trie and
   draw the resulting structure.
2. Explain why `starts_with("ca")` can return true while
   `search("ca")` returns false.
3. Delete `car` from a trie that also contains `card` and `care`.
   Which nodes remain?
4. Why is trie search complexity typically written as O(m), where
   `m` is the string length, rather than in terms of the number of
   stored words?
5. Compress a regular trie for `in`, `inn`, `inner`, and `input`
   into a radix-tree style representation.
6. Compare tries and hash tables for exact lookup versus prefix
   lookup.

---

## Key Takeaways

- Tries store strings as paths and share common prefixes.
- Exact search and prefix search are both natural trie operations.
- Tries outperform hash tables for prefix-based queries because the
  structure itself encodes prefixes.
- Deletion must preserve shared prefix nodes needed by other words.
- Compressed tries merge long single-child chains to reduce space.
- Radix and Patricia tries are practical refinements of the basic
  idea.

The next lesson turns from prefix structure to range-aggregation
structure: segment trees and Fenwick trees.

---

**Previous**: [Lesson 21 — B-Trees and B+ Trees — Disk-Oriented Search Trees](./21-b-trees.md)
**Next**: [Lesson 23 — Segment Trees and Fenwick Trees](./23-segment-trees-fenwick.md)