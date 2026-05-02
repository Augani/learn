# Lesson 09: Practice Problems — Fundamentals

> You've built the toolkit: arrays, linked lists, stacks, queues,
> hash tables, and hash sets. Now it's time to use them. This
> lesson presents 8 problems — 3 easy, 3 medium, 2 hard — each
> drawn from real coding interviews. Every problem tells you
> *which* fundamental concept it tests, gives you graduated hints,
> and walks you through the full solution in Python, TypeScript,
> and Rust. The easy problems build confidence. The medium problems
> push you to combine data structures. The hard problems demand
> that you design something new from the pieces you already know.

---

## How to Use This Lesson

For each problem:

1. **Read the problem statement** and try to solve it yourself
   before looking at hints.
2. **Use the hints** if you're stuck — they're graduated from
   subtle to direct.
3. **Study the solution walkthrough** — understand *why* each
   step works, not just *what* the code does.
4. **Identify the concept** — each problem maps to a specific
   data structure or technique from Phase 1.

---

## Easy Problems

---

### Problem 1: Reverse a Linked List

**Concepts tested:** Linked lists (Lesson 04), pointer manipulation

**Problem statement:**
Given the head of a singly linked list, reverse the list and
return the new head. The reversal must be done in-place — do not
create a new list.

```
  Input:  1 → 2 → 3 → 4 → 5 → null
  Output: 5 → 4 → 3 → 2 → 1 → null

  Input:  1 → 2 → null
  Output: 2 → 1 → null

  Input:  null (empty list)
  Output: null
```

**Hints:**

1. Think about what happens to each node's `next` pointer. Where
   should it point after reversal?
2. You need to track three things as you walk the list: the
   previous node, the current node, and the next node (so you
   don't lose the rest of the list when you flip a pointer).
3. Initialize `prev = null`, `curr = head`. At each step: save
   `next = curr.next`, set `curr.next = prev`, advance
   `prev = curr`, `curr = next`. When `curr` is null, `prev`
   is the new head.

**Solution walkthrough:**

The key insight is that reversing a linked list means flipping
every `next` pointer to point backward instead of forward. We
walk the list once, flipping one pointer at a time.

```
  STEP-BY-STEP REVERSAL

  Start:  prev=null  curr=1
          null   1 → 2 → 3 → null

  Step 1: save next=2, flip 1→null, advance
          null ← 1   2 → 3 → null
          prev=1  curr=2

  Step 2: save next=3, flip 2→1, advance
          null ← 1 ← 2   3 → null
          prev=2  curr=3

  Step 3: save next=null, flip 3→2, advance
          null ← 1 ← 2 ← 3
          prev=3  curr=null  ← DONE

  Return prev (3), which is the new head.
```

**Time:** O(n) — single pass through the list
**Space:** O(1) — only three pointers

#### Python

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def reverse_list(head: ListNode | None) -> ListNode | None:
    prev = None
    curr = head
    while curr:
        next_node = curr.next   # Save next before we break the link
        curr.next = prev        # Flip the pointer
        prev = curr             # Advance prev
        curr = next_node        # Advance curr
    return prev                 # prev is the new head
```

#### TypeScript

```typescript
class ListNode {
  val: number;
  next: ListNode | null;
  constructor(val = 0, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

function reverseList(head: ListNode | null): ListNode | null {
  let prev: ListNode | null = null;
  let curr = head;
  while (curr !== null) {
    const next = curr.next;   // Save next
    curr.next = prev;         // Flip pointer
    prev = curr;              // Advance prev
    curr = next;              // Advance curr
  }
  return prev;                // New head
}
```

#### Rust

```rust
#[derive(Debug)]
struct ListNode {
    val: i32,
    next: Option<Box<ListNode>>,
}

fn reverse_list(head: Option<Box<ListNode>>) -> Option<Box<ListNode>> {
    let mut prev: Option<Box<ListNode>> = None;
    let mut curr = head;
    while let Some(mut node) = curr {
        curr = node.next.take();   // Save and detach next
        node.next = prev;          // Flip pointer to previous
        prev = Some(node);         // This node becomes the new prev
    }
    prev  // New head
}
```

---

### Problem 2: Valid Parentheses

**Concepts tested:** Stacks (Lesson 05), LIFO matching

**Problem statement:**
Given a string containing only the characters `(`, `)`, `{`,
`}`, `[`, and `]`, determine if the input string is valid.

A string is valid if:
- Open brackets are closed by the same type of bracket.
- Open brackets are closed in the correct order.
- Every close bracket has a corresponding open bracket.

```
  Input: "()"        → true
  Input: "()[]{}"    → true
  Input: "(]"        → false
  Input: "([)]"      → false
  Input: "{[]}"      → true
  Input: ""          → true (empty string is valid)
```

**Hints:**

1. When you see an opening bracket, you need to remember it so
   you can match it later. What data structure is perfect for
   "remember the most recent thing first"?
2. Use a stack. Push opening brackets. When you see a closing
   bracket, pop from the stack and check if it matches.
3. Edge cases: the stack is empty when you see a closing bracket
   (unmatched closer), or the stack is non-empty after processing
   all characters (unmatched opener).

**Solution walkthrough:**

A stack naturally handles nested matching because the most
recently opened bracket must be closed first — that's exactly
LIFO order.

```
  TRACE: "{[()]}"

  Char  Action          Stack (top→right)
  ────  ──────────────  ─────────────────
  {     push {          { 
  [     push [          { [
  (     push (          { [ (
  )     pop (, match )  { [
  ]     pop [, match ]  {
  }     pop {, match }  (empty)

  Stack empty at end → VALID ✓


  TRACE: "([)]"

  Char  Action          Stack
  ────  ──────────────  ─────
  (     push (          (
  [     push [          ( [
  )     pop [, match )  MISMATCH! [ ≠ ) → INVALID ✗
```

**Time:** O(n) — single pass through the string
**Space:** O(n) — stack can hold up to n/2 opening brackets

#### Python

```python
def is_valid(s: str) -> bool:
    stack = []
    matching = {')': '(', ']': '[', '}': '{'}

    for char in s:
        if char in '([{':
            stack.append(char)
        elif char in ')]}':
            if not stack or stack[-1] != matching[char]:
                return False
            stack.pop()

    return len(stack) == 0
```

#### TypeScript

```typescript
function isValid(s: string): boolean {
  const stack: string[] = [];
  const matching: Record<string, string> = {
    ')': '(', ']': '[', '}': '{'
  };

  for (const char of s) {
    if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
    } else {
      if (stack.length === 0 || stack[stack.length - 1] !== matching[char]) {
        return false;
      }
      stack.pop();
    }
  }

  return stack.length === 0;
}
```

#### Rust

```rust
fn is_valid(s: &str) -> bool {
    let mut stack = Vec::new();

    for ch in s.chars() {
        match ch {
            '(' | '[' | '{' => stack.push(ch),
            ')' => if stack.pop() != Some('(') { return false; },
            ']' => if stack.pop() != Some('[') { return false; },
            '}' => if stack.pop() != Some('{') { return false; },
            _ => {}
        }
    }

    stack.is_empty()
}
```

---

### Problem 3: Two Sum

**Concepts tested:** Hash tables (Lesson 07), O(1) lookup

**Problem statement:**
Given an array of integers `nums` and an integer `target`, return
the indices of the two numbers that add up to `target`. You may
assume each input has exactly one solution, and you may not use
the same element twice.

```
  Input: nums = [2, 7, 11, 15], target = 9
  Output: [0, 1]   (because nums[0] + nums[1] = 2 + 7 = 9)

  Input: nums = [3, 2, 4], target = 6
  Output: [1, 2]   (because nums[1] + nums[2] = 2 + 4 = 6)

  Input: nums = [3, 3], target = 6
  Output: [0, 1]
```

**Hints:**

1. The brute force approach checks every pair — O(n²). Can you
   do better by avoiding redundant work?
2. For each number `x`, you need to find if `target - x` exists
   in the array. What data structure gives you O(1) lookup?
3. Use a hash map that maps each number to its index. As you
   iterate, check if the complement (`target - nums[i]`) is
   already in the map. If yes, you found the pair. If no, add
   the current number to the map.

**Solution walkthrough:**

The brute force checks all pairs in O(n²). The hash map approach
reduces this to O(n) by trading space for time: for each element,
we ask "have I already seen my complement?"

```
  TRACE: nums = [2, 7, 11, 15], target = 9

  i=0: num=2, complement=9-2=7
       Map: {}  → 7 not found
       Add 2→0: {2: 0}

  i=1: num=7, complement=9-7=2
       Map: {2: 0}  → 2 FOUND at index 0!
       Return [0, 1] ✓
```

**Time:** O(n) — single pass, each lookup is O(1)
**Space:** O(n) — hash map stores up to n entries

#### Python

```python
def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}  # value → index
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []  # Should not reach here per problem guarantee
```

#### TypeScript

```typescript
function twoSum(nums: number[], target: number): number[] {
  const seen = new Map<number, number>(); // value → index

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement)!, i];
    }
    seen.set(nums[i], i);
  }

  return []; // Should not reach here
}
```

#### Rust

```rust
use std::collections::HashMap;

fn two_sum(nums: &[i32], target: i32) -> Vec<usize> {
    let mut seen: HashMap<i32, usize> = HashMap::new();

    for (i, &num) in nums.iter().enumerate() {
        let complement = target - num;
        if let Some(&j) = seen.get(&complement) {
            return vec![j, i];
        }
        seen.insert(num, i);
    }

    vec![] // Should not reach here
}
```

---

## Medium Problems

---

### Problem 4: LRU Cache

**Concepts tested:** Hash tables (Lesson 07), doubly linked lists (Lesson 04), combining data structures

**Problem statement:**
Design a data structure that follows the constraints of a
Least Recently Used (LRU) cache.

Implement the `LRUCache` class:
- `LRUCache(capacity)` — initialize with positive capacity.
- `get(key)` — return the value if the key exists, otherwise
  return -1. Mark the key as recently used.
- `put(key, value)` — update or insert the value. If the number
  of keys exceeds capacity, evict the least recently used key.

Both operations must run in O(1) time.

```
  Input:
  LRUCache(2)
  put(1, 1)       → cache: {1=1}
  put(2, 2)       → cache: {1=1, 2=2}
  get(1)          → returns 1, cache: {2=2, 1=1} (1 is now most recent)
  put(3, 3)       → evicts key 2, cache: {1=1, 3=3}
  get(2)          → returns -1 (not found)
  put(4, 4)       → evicts key 1, cache: {3=3, 4=4}
  get(1)          → returns -1 (not found)
  get(3)          → returns 3
  get(4)          → returns 4
```

**Graduated hints:**

1. *Subtle*: You need O(1) lookup AND O(1) removal of the least
   recently used item. No single data structure gives you both.
   What if you combined two?
2. *Medium*: A hash map gives O(1) lookup. A linked list gives
   O(1) removal from any position (if you have a reference to
   the node). What if the hash map pointed to linked list nodes?
3. *Direct*: Use a hash map `key → node` and a doubly linked
   list ordered by recency. The head is least recent, the tail
   is most recent. On `get` or `put`, move the node to the tail.
   On eviction, remove the head.

**Brute-force-to-optimal walkthrough:**

*Brute force*: Use an array of (key, value, timestamp) tuples.
`get` scans the array — O(n). Eviction finds the minimum
timestamp — O(n). This is too slow.

*Better*: Use a hash map for O(1) lookup plus a separate ordered
structure for recency. An array sorted by recency still requires
O(n) to move an element to the end.

*Optimal*: Hash map + doubly linked list. The hash map gives O(1)
lookup. The doubly linked list gives O(1) move-to-end and O(1)
remove-from-front. The hash map values point directly to list
nodes, so we can jump to any node in O(1) and reposition it.

```
  LRU CACHE STRUCTURE

  Hash Map                    Doubly Linked List
  ┌─────────────────┐        (least recent) ←→ ... ←→ (most recent)
  │ key=1 → node_1  │──────→ ┌──────┐   ┌──────┐   ┌──────┐
  │ key=3 → node_3  │──┐     │ D: 2 │←→│ D: 1 │←→│ D: 3 │
  │ key=2 → node_2  │─┐│     │ k=2  │   │ k=1  │   │ k=3  │
  └─────────────────┘ ││     └──────┘   └──────┘   └──────┘
                       │└──────────────────────────────↑
                       └──────↑
  
  get(1): map lookup → node_1 → move to tail → O(1)
  evict:  remove head (node_2) → delete from map → O(1)
```

**Time:** O(1) for both `get` and `put`
**Space:** O(capacity)

**Pattern:** Hash map + doubly linked list for O(1) ordered access

#### Python

```python
class DLLNode:
    """Doubly linked list node for LRU cache."""
    def __init__(self, key: int = 0, val: int = 0):
        self.key = key
        self.val = val
        self.prev: DLLNode | None = None
        self.next: DLLNode | None = None

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache: dict[int, DLLNode] = {}
        # Sentinel nodes simplify edge cases
        self.head = DLLNode()  # Dummy head (least recent side)
        self.tail = DLLNode()  # Dummy tail (most recent side)
        self.head.next = self.tail
        self.tail.prev = self.head

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        node = self.cache[key]
        self._move_to_tail(node)
        return node.val

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            node = self.cache[key]
            node.val = value
            self._move_to_tail(node)
        else:
            node = DLLNode(key, value)
            self.cache[key] = node
            self._add_before_tail(node)
            if len(self.cache) > self.capacity:
                lru = self.head.next
                self._remove(lru)
                del self.cache[lru.key]

    def _add_before_tail(self, node: DLLNode) -> None:
        prev = self.tail.prev
        prev.next = node
        node.prev = prev
        node.next = self.tail
        self.tail.prev = node

    def _remove(self, node: DLLNode) -> None:
        node.prev.next = node.next
        node.next.prev = node.prev

    def _move_to_tail(self, node: DLLNode) -> None:
        self._remove(node)
        self._add_before_tail(node)
```

#### TypeScript

```typescript
class DLLNode {
  key: number;
  val: number;
  prev: DLLNode | null = null;
  next: DLLNode | null = null;

  constructor(key = 0, val = 0) {
    this.key = key;
    this.val = val;
  }
}

class LRUCache {
  private capacity: number;
  private cache = new Map<number, DLLNode>();
  private head = new DLLNode(); // Dummy head (least recent)
  private tail = new DLLNode(); // Dummy tail (most recent)

  constructor(capacity: number) {
    this.capacity = capacity;
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: number): number {
    const node = this.cache.get(key);
    if (!node) return -1;
    this.moveToTail(node);
    return node.val;
  }

  put(key: number, value: number): void {
    const existing = this.cache.get(key);
    if (existing) {
      existing.val = value;
      this.moveToTail(existing);
    } else {
      const node = new DLLNode(key, value);
      this.cache.set(key, node);
      this.addBeforeTail(node);
      if (this.cache.size > this.capacity) {
        const lru = this.head.next!;
        this.removeNode(lru);
        this.cache.delete(lru.key);
      }
    }
  }

  private addBeforeTail(node: DLLNode): void {
    const prev = this.tail.prev!;
    prev.next = node;
    node.prev = prev;
    node.next = this.tail;
    this.tail.prev = node;
  }

  private removeNode(node: DLLNode): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private moveToTail(node: DLLNode): void {
    this.removeNode(node);
    this.addBeforeTail(node);
  }
}
```

#### Rust

```rust
use std::collections::HashMap;

struct DLLNode {
    key: i32,
    val: i32,
    prev: usize,  // Index into arena
    next: usize,  // Index into arena
}

/// LRU Cache using a hash map + doubly linked list (arena-allocated).
/// Rust's ownership model makes pointer-based DLLs tricky, so we use
/// an arena (Vec) where each node is identified by its index.
struct LRUCache {
    capacity: usize,
    map: HashMap<i32, usize>,   // key → arena index
    arena: Vec<DLLNode>,
    head: usize,                // Sentinel: least recent side
    tail: usize,                // Sentinel: most recent side
}

impl LRUCache {
    fn new(capacity: usize) -> Self {
        let mut arena = Vec::new();
        // Index 0: head sentinel, Index 1: tail sentinel
        arena.push(DLLNode { key: 0, val: 0, prev: 0, next: 1 });
        arena.push(DLLNode { key: 0, val: 0, prev: 0, next: 1 });
        LRUCache { capacity, map: HashMap::new(), arena, head: 0, tail: 1 }
    }

    fn get(&mut self, key: i32) -> i32 {
        if let Some(&idx) = self.map.get(&key) {
            self.move_to_tail(idx);
            self.arena[idx].val
        } else {
            -1
        }
    }

    fn put(&mut self, key: i32, value: i32) {
        if let Some(&idx) = self.map.get(&key) {
            self.arena[idx].val = value;
            self.move_to_tail(idx);
        } else {
            let idx = self.arena.len();
            self.arena.push(DLLNode { key, val: value, prev: 0, next: 0 });
            self.add_before_tail(idx);
            self.map.insert(key, idx);

            if self.map.len() > self.capacity {
                let lru = self.arena[self.head].next;
                self.remove_node(lru);
                let lru_key = self.arena[lru].key;
                self.map.remove(&lru_key);
            }
        }
    }

    fn add_before_tail(&mut self, idx: usize) {
        let prev = self.arena[self.tail].prev;
        self.arena[prev].next = idx;
        self.arena[idx].prev = prev;
        self.arena[idx].next = self.tail;
        self.arena[self.tail].prev = idx;
    }

    fn remove_node(&mut self, idx: usize) {
        let prev = self.arena[idx].prev;
        let next = self.arena[idx].next;
        self.arena[prev].next = next;
        self.arena[next].prev = prev;
    }

    fn move_to_tail(&mut self, idx: usize) {
        self.remove_node(idx);
        self.add_before_tail(idx);
    }
}
```

Note: Rust's ownership rules make traditional pointer-based doubly
linked lists awkward. The arena approach (storing nodes in a `Vec`
and using indices instead of pointers) is the idiomatic workaround.
In production, consider the `lru` crate.

---

### Problem 5: Implement Queue Using Stacks

**Concepts tested:** Stacks (Lesson 05), queues (Lesson 06), using one ADT to simulate another

**Problem statement:**
Implement a first-in-first-out (FIFO) queue using only two
stacks. The queue should support:
- `push(x)` — push element to the back of the queue.
- `pop()` — remove and return the front element.
- `peek()` — return the front element without removing it.
- `empty()` — return true if the queue is empty.

You may only use standard stack operations: push to top, pop
from top, peek at top, and check if empty.

```
  Input:
  push(1), push(2), peek() → 1, pop() → 1, empty() → false
```

**Graduated hints:**

1. *Subtle*: A stack reverses order. What happens if you reverse
   the reversed order?
2. *Medium*: If you push elements onto stack A, then pop them all
   into stack B, the order in B is reversed — which is exactly
   FIFO order. You don't need to transfer every time though.
3. *Direct*: Use an "input" stack and an "output" stack. Push
   always goes to the input stack. Pop/peek come from the output
   stack. Only transfer from input to output when the output
   stack is empty. This gives amortized O(1) per operation.

**Brute-force-to-optimal walkthrough:**

*Naive*: Transfer all elements between stacks on every operation.
Push is O(1), but pop is O(n) every time because you move
everything to reverse the order, pop one, then move everything
back.

*Optimal (lazy transfer)*: Only transfer when the output stack is
empty. Each element is moved at most twice (once into input, once
into output), so the amortized cost per operation is O(1).

```
  TRACE: push(1), push(2), push(3), pop(), push(4), pop()

  push(1): input=[1]        output=[]
  push(2): input=[1,2]      output=[]
  push(3): input=[1,2,3]    output=[]

  pop():   output is empty → transfer input to output
           input=[]          output=[3,2,1]
           pop from output → returns 1
           input=[]          output=[3,2]

  push(4): input=[4]        output=[3,2]

  pop():   output not empty → pop directly
           returns 2
           input=[4]        output=[3]
```

**Time:** Amortized O(1) per operation
**Space:** O(n) total across both stacks

#### Python

```python
class MyQueue:
    def __init__(self):
        self.input_stack = []   # New elements go here
        self.output_stack = []  # Elements ready to dequeue

    def push(self, x: int) -> None:
        self.input_stack.append(x)

    def pop(self) -> int:
        self._transfer_if_needed()
        return self.output_stack.pop()

    def peek(self) -> int:
        self._transfer_if_needed()
        return self.output_stack[-1]

    def empty(self) -> bool:
        return not self.input_stack and not self.output_stack

    def _transfer_if_needed(self) -> None:
        """Move elements from input to output only when output is empty."""
        if not self.output_stack:
            while self.input_stack:
                self.output_stack.append(self.input_stack.pop())
```

#### TypeScript

```typescript
class MyQueue {
  private inputStack: number[] = [];
  private outputStack: number[] = [];

  push(x: number): void {
    this.inputStack.push(x);
  }

  pop(): number {
    this.transferIfNeeded();
    return this.outputStack.pop()!;
  }

  peek(): number {
    this.transferIfNeeded();
    return this.outputStack[this.outputStack.length - 1];
  }

  empty(): boolean {
    return this.inputStack.length === 0 && this.outputStack.length === 0;
  }

  private transferIfNeeded(): void {
    if (this.outputStack.length === 0) {
      while (this.inputStack.length > 0) {
        this.outputStack.push(this.inputStack.pop()!);
      }
    }
  }
}
```

#### Rust

```rust
struct MyQueue {
    input_stack: Vec<i32>,
    output_stack: Vec<i32>,
}

impl MyQueue {
    fn new() -> Self {
        MyQueue {
            input_stack: Vec::new(),
            output_stack: Vec::new(),
        }
    }

    fn push(&mut self, x: i32) {
        self.input_stack.push(x);
    }

    fn pop(&mut self) -> i32 {
        self.transfer_if_needed();
        self.output_stack.pop().unwrap()
    }

    fn peek(&mut self) -> i32 {
        self.transfer_if_needed();
        *self.output_stack.last().unwrap()
    }

    fn empty(&self) -> bool {
        self.input_stack.is_empty() && self.output_stack.is_empty()
    }

    fn transfer_if_needed(&mut self) {
        if self.output_stack.is_empty() {
            while let Some(val) = self.input_stack.pop() {
                self.output_stack.push(val);
            }
        }
    }
}
```

---

### Problem 6: Group Anagrams

**Concepts tested:** Hash tables (Lesson 07), hash sets/multisets (Lesson 08), string hashing

**Problem statement:**
Given an array of strings, group the anagrams together. You can
return the answer in any order. An anagram is a word formed by
rearranging the letters of another word, using all the original
letters exactly once.

```
  Input:  ["eat", "tea", "tan", "ate", "nat", "bat"]
  Output: [["eat","tea","ate"], ["tan","nat"], ["bat"]]

  Input:  [""]
  Output: [[""]]

  Input:  ["a"]
  Output: [["a"]]
```

**Graduated hints:**

1. *Subtle*: Two strings are anagrams if and only if they have
   the same characters with the same frequencies. How can you
   create a "fingerprint" that's identical for all anagrams?
2. *Medium*: One fingerprint: sort the characters. "eat" → "aet",
   "tea" → "aet", "ate" → "aet". All anagrams sort to the same
   string. Use this sorted string as a hash map key.
3. *Direct*: Create a hash map where the key is the sorted string
   and the value is a list of original strings. Iterate through
   the input, sort each string, and append it to the correct
   group. Alternatively, use a character frequency tuple as the
   key (avoids sorting — O(k) instead of O(k log k) per string).

**Brute-force-to-optimal walkthrough:**

*Brute force*: For each pair of strings, check if they're
anagrams by comparing sorted versions. Group them. O(n² · k log k)
where k is the max string length.

*Better (sort-based key)*: Sort each string to create a canonical
form. Group by this key using a hash map. O(n · k log k).

*Optimal (frequency-based key)*: Instead of sorting, count
character frequencies. Use the frequency tuple as the key.
O(n · k) where k is the max string length.

```
  TRACE (sort-based): ["eat", "tea", "tan", "ate", "nat", "bat"]

  "eat" → sorted "aet" → map["aet"] = ["eat"]
  "tea" → sorted "aet" → map["aet"] = ["eat", "tea"]
  "tan" → sorted "ant" → map["ant"] = ["tan"]
  "ate" → sorted "aet" → map["aet"] = ["eat", "tea", "ate"]
  "nat" → sorted "ant" → map["ant"] = ["tan", "nat"]
  "bat" → sorted "abt" → map["abt"] = ["bat"]

  Result: [["eat","tea","ate"], ["tan","nat"], ["bat"]]
```

**Time:** O(n · k log k) with sorting, O(n · k) with frequency counting
**Space:** O(n · k) for the hash map

**Pattern:** Canonical form as hash key

#### Python

```python
from collections import defaultdict

def group_anagrams(strs: list[str]) -> list[list[str]]:
    """Group anagrams using sorted string as key."""
    groups: dict[str, list[str]] = defaultdict(list)
    for s in strs:
        key = "".join(sorted(s))
        groups[key].append(s)
    return list(groups.values())


def group_anagrams_optimal(strs: list[str]) -> list[list[str]]:
    """Group anagrams using character frequency tuple as key.
    Avoids sorting — O(n*k) instead of O(n*k*log(k)).
    """
    groups: dict[tuple, list[str]] = defaultdict(list)
    for s in strs:
        # Count frequency of each letter (assuming lowercase a-z)
        freq = [0] * 26
        for ch in s:
            freq[ord(ch) - ord('a')] += 1
        groups[tuple(freq)].append(s)
    return list(groups.values())
```

#### TypeScript

```typescript
function groupAnagrams(strs: string[]): string[][] {
  const groups = new Map<string, string[]>();

  for (const s of strs) {
    // Sort-based key
    const key = s.split('').sort().join('');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  return [...groups.values()];
}

function groupAnagramsOptimal(strs: string[]): string[][] {
  const groups = new Map<string, string[]>();

  for (const s of strs) {
    // Frequency-based key — avoids sorting
    const freq = new Array(26).fill(0);
    for (const ch of s) {
      freq[ch.charCodeAt(0) - 97]++;
    }
    const key = freq.join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  return [...groups.values()];
}
```

#### Rust

```rust
use std::collections::HashMap;

fn group_anagrams(strs: Vec<String>) -> Vec<Vec<String>> {
    let mut groups: HashMap<String, Vec<String>> = HashMap::new();

    for s in strs {
        let mut chars: Vec<char> = s.chars().collect();
        chars.sort();
        let key: String = chars.into_iter().collect();
        groups.entry(key).or_default().push(s);
    }

    groups.into_values().collect()
}

fn group_anagrams_optimal(strs: Vec<String>) -> Vec<Vec<String>> {
    let mut groups: HashMap<[u8; 26], Vec<String>> = HashMap::new();

    for s in strs {
        let mut freq = [0u8; 26];
        for b in s.bytes() {
            freq[(b - b'a') as usize] += 1;
        }
        groups.entry(freq).or_default().push(s);
    }

    groups.into_values().collect()
}
```

---

## Hard Problems

---

### Problem 7: Merge K Sorted Lists

**Concepts tested:** Linked lists (Lesson 04), comparing approaches, priority queues (preview of Lesson 20)

**Why this problem is hard:**
You're not just merging two lists — you're merging `k` lists
simultaneously. The naive approach of repeatedly finding the
minimum across all `k` list heads is O(n·k), which is too slow
when `k` is large. The challenge is efficiently selecting the
next smallest element from `k` candidates at each step.

**Problem statement:**
You are given an array of `k` linked lists, each sorted in
ascending order. Merge all the linked lists into one sorted
linked list and return it.

```
  Input:  [[1,4,5], [1,3,4], [2,6]]
  Output: [1,1,2,3,4,4,5,6]

  Input:  []
  Output: []

  Input:  [[]]
  Output: []
```

**Key insight hints:**

1. You need to repeatedly pick the smallest element from `k`
   candidates. What data structure gives you the minimum in
   O(log k) time?
2. A min-heap (priority queue) holding one node from each list
   lets you extract the minimum in O(log k). After extracting,
   push the next node from that same list.
3. Alternative approach: divide and conquer. Merge lists in pairs,
   like merge sort. k lists → k/2 merged lists → k/4 → ... → 1.
   This is O(n log k) with O(1) extra space (no heap needed).

**Common mistakes:**
- Forgetting to handle empty lists in the input array.
- Not advancing the pointer after extracting a node from a list.
- Using O(n·k) by scanning all k heads on every step.

**Solution walkthrough — Min-Heap approach:**

Maintain a min-heap of size k. Initially, push the head of each
non-empty list. Repeatedly extract the minimum, add it to the
result, and push the extracted node's next (if it exists).

```
  TRACE: lists = [[1,4,5], [1,3,4], [2,6]]

  Heap (min at top):
  Initial: push heads → heap = [1(list0), 1(list1), 2(list2)]

  Extract 1(list0) → result: [1]
    push 4(list0) → heap = [1(list1), 2(list2), 4(list0)]

  Extract 1(list1) → result: [1,1]
    push 3(list1) → heap = [2(list2), 3(list1), 4(list0)]

  Extract 2(list2) → result: [1,1,2]
    push 6(list2) → heap = [3(list1), 4(list0), 6(list2)]

  Extract 3(list1) → result: [1,1,2,3]
    push 4(list1) → heap = [4(list0), 4(list1), 6(list2)]

  Extract 4(list0) → result: [1,1,2,3,4]
    push 5(list0) → heap = [4(list1), 5(list0), 6(list2)]

  Extract 4(list1) → result: [1,1,2,3,4,4]
    list1 exhausted → heap = [5(list0), 6(list2)]

  Extract 5(list0) → result: [1,1,2,3,4,4,5]
    list0 exhausted → heap = [6(list2)]

  Extract 6(list2) → result: [1,1,2,3,4,4,5,6]
    list2 exhausted → heap = []  DONE ✓
```

**Time:** O(n log k) where n = total elements, k = number of lists
**Space:** O(k) for the heap

**Solution walkthrough — Divide and Conquer approach:**

Merge lists pairwise, reducing k lists to k/2, then k/4, etc.
Each level processes all n elements, and there are log k levels.

```
  DIVIDE AND CONQUER: k=4 lists

  Level 0: [L1] [L2] [L3] [L4]
  Level 1: [L1+L2]   [L3+L4]      ← merge pairs
  Level 2: [L1+L2+L3+L4]          ← merge the two halves

  log2(4) = 2 levels, each processing n elements → O(n log k)
```

#### Python

```python
import heapq

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def merge_k_lists(lists: list[ListNode | None]) -> ListNode | None:
    """Min-heap approach: O(n log k) time, O(k) space."""
    heap = []
    # Push the head of each non-empty list
    # Use index as tiebreaker (ListNode isn't comparable)
    for i, head in enumerate(lists):
        if head:
            heapq.heappush(heap, (head.val, i, head))

    dummy = ListNode()
    curr = dummy

    while heap:
        val, i, node = heapq.heappop(heap)
        curr.next = node
        curr = curr.next
        if node.next:
            heapq.heappush(heap, (node.next.val, i, node.next))

    return dummy.next


def merge_k_lists_dc(lists: list[ListNode | None]) -> ListNode | None:
    """Divide and conquer approach: O(n log k) time, O(1) extra space."""
    if not lists:
        return None

    def merge_two(l1, l2):
        dummy = ListNode()
        curr = dummy
        while l1 and l2:
            if l1.val <= l2.val:
                curr.next = l1
                l1 = l1.next
            else:
                curr.next = l2
                l2 = l2.next
            curr = curr.next
        curr.next = l1 or l2
        return dummy.next

    while len(lists) > 1:
        merged = []
        for i in range(0, len(lists), 2):
            l1 = lists[i]
            l2 = lists[i + 1] if i + 1 < len(lists) else None
            merged.append(merge_two(l1, l2))
        lists = merged

    return lists[0]
```

#### TypeScript

```typescript
class ListNode {
  val: number;
  next: ListNode | null;
  constructor(val = 0, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

/**
 * Divide and conquer approach — no heap needed.
 * O(n log k) time, O(1) extra space.
 */
function mergeKLists(lists: (ListNode | null)[]): ListNode | null {
  if (lists.length === 0) return null;

  function mergeTwoLists(
    l1: ListNode | null,
    l2: ListNode | null
  ): ListNode | null {
    const dummy = new ListNode();
    let curr = dummy;
    while (l1 && l2) {
      if (l1.val <= l2.val) {
        curr.next = l1;
        l1 = l1.next;
      } else {
        curr.next = l2;
        l2 = l2.next;
      }
      curr = curr.next;
    }
    curr.next = l1 ?? l2;
    return dummy.next;
  }

  while (lists.length > 1) {
    const merged: (ListNode | null)[] = [];
    for (let i = 0; i < lists.length; i += 2) {
      const l1 = lists[i];
      const l2 = i + 1 < lists.length ? lists[i + 1] : null;
      merged.push(mergeTwoLists(l1, l2));
    }
    lists = merged;
  }

  return lists[0];
}
```

#### Rust

```rust
use std::cmp::Ordering;
use std::collections::BinaryHeap;

#[derive(Debug, Clone)]
struct ListNode {
    val: i32,
    next: Option<Box<ListNode>>,
}

/// Wrapper for BinaryHeap (which is a max-heap in Rust).
/// We reverse the ordering to get a min-heap.
struct HeapEntry(i32, usize, Option<Box<ListNode>>);

impl PartialEq for HeapEntry {
    fn eq(&self, other: &Self) -> bool { self.0 == other.0 }
}
impl Eq for HeapEntry {}
impl PartialOrd for HeapEntry {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for HeapEntry {
    fn cmp(&self, other: &Self) -> Ordering {
        other.0.cmp(&self.0) // Reversed for min-heap behavior
    }
}

fn merge_k_lists(lists: Vec<Option<Box<ListNode>>>) -> Option<Box<ListNode>> {
    let mut heap = BinaryHeap::new();

    for (i, head) in lists.into_iter().enumerate() {
        if let Some(node) = head {
            heap.push(HeapEntry(node.val, i, Some(node)));
        }
    }

    let mut dummy = ListNode { val: 0, next: None };
    let mut tail = &mut dummy;

    while let Some(HeapEntry(val, idx, node_opt)) = heap.pop() {
        let mut node = node_opt.unwrap();
        let next = node.next.take();
        if let Some(next_node) = next {
            heap.push(HeapEntry(next_node.val, idx, Some(next_node)));
        }
        tail.next = Some(Box::new(ListNode { val, next: None }));
        tail = tail.next.as_mut().unwrap();
    }

    dummy.next
}
```

Note: Rust's `BinaryHeap` is a max-heap. We reverse the `Ord`
implementation to get min-heap behavior. In production, consider
the `min-heap` pattern or a crate like `priority-queue`.

---

### Problem 8: LFU Cache

**Concepts tested:** Hash tables (Lesson 07), doubly linked lists (Lesson 04), designing composite data structures

**Why this problem is hard:**
LRU cache evicts the *least recently* used item — you only track
recency. LFU cache evicts the *least frequently* used item, and
breaks ties by recency. This means you need to track two
dimensions simultaneously: how many times each key has been
accessed, and among keys with the same frequency, which was used
least recently. Designing a data structure that handles both in
O(1) is the core challenge.

**Problem statement:**
Design a data structure for a Least Frequently Used (LFU) cache.

Implement the `LFUCache` class:
- `LFUCache(capacity)` — initialize with positive capacity.
- `get(key)` — return the value if the key exists (and increment
  its frequency), otherwise return -1.
- `put(key, value)` — update or insert the value (incrementing
  frequency). If inserting causes the cache to exceed capacity,
  evict the least frequently used key. If there's a tie, evict
  the least recently used among those.

Both operations must run in O(1) time.

```
  Input:
  LFUCache(2)
  put(1, 1)       → freq(1)=1
  put(2, 2)       → freq(2)=1
  get(1)          → returns 1, freq(1)=2
  put(3, 3)       → evicts key 2 (freq=1, least recent among freq-1 keys)
  get(2)          → returns -1 (evicted)
  get(3)          → returns 3, freq(3)=2
  put(4, 4)       → evicts key 1 (freq=2) vs key 3 (freq=2)
                    → tie! evict key 1 (least recent among freq-2 keys)
  get(1)          → returns -1 (evicted)
  get(3)          → returns 3, freq(3)=3
  get(4)          → returns 4, freq(4)=2
```

**Key insight hints:**

1. You need O(1) access to the least-frequency group, and within
   that group, O(1) access to the least recently used item.
2. Maintain a hash map from frequency → doubly linked list of
   keys at that frequency (ordered by recency). Also maintain a
   hash map from key → node (for O(1) lookup). Track the current
   minimum frequency.
3. When a key's frequency increases from f to f+1, remove it from
   the frequency-f list and add it to the frequency-(f+1) list.
   If the frequency-f list becomes empty and f was the minimum
   frequency, increment the minimum frequency.

**Common mistakes:**
- Forgetting to update `min_freq` when the minimum frequency
  list becomes empty.
- Not handling the case where `put` updates an existing key
  (which should increment frequency, not reset it).
- Setting `min_freq = 1` on every new insertion (correct, because
  a new key always has frequency 1).

**Solution walkthrough:**

The key data structures:
1. `key_map`: key → (value, frequency, node reference)
2. `freq_map`: frequency → doubly linked list of keys (LRU order)
3. `min_freq`: the current minimum frequency

```
  LFU CACHE STRUCTURE

  key_map                freq_map
  ┌──────────────┐       ┌─────┬──────────────────────────┐
  │ key=1 → info │       │ f=1 │ [key2] ←→ [key5]        │ ← LRU order
  │ key=2 → info │       │ f=2 │ [key1] ←→ [key3]        │
  │ key=3 → info │       │ f=3 │ [key4]                   │
  │ key=4 → info │       └─────┴──────────────────────────┘
  │ key=5 → info │       min_freq = 1
  └──────────────┘
                          Eviction: remove head of freq_map[min_freq]
                          → removes key2 (least recent in freq=1 group)

  On access (get/put existing):
  1. Remove key from freq_map[f]
  2. Add key to tail of freq_map[f+1]
  3. If freq_map[f] is empty and f == min_freq, min_freq++
```

**Time:** O(1) for both `get` and `put`
**Space:** O(capacity)

#### Python

```python
from collections import defaultdict

class DLLNode:
    def __init__(self, key: int = 0, val: int = 0):
        self.key = key
        self.val = val
        self.freq = 1
        self.prev: DLLNode | None = None
        self.next: DLLNode | None = None

class DLinkedList:
    """Doubly linked list with sentinel nodes for a frequency bucket."""
    def __init__(self):
        self.head = DLLNode()  # Dummy head (least recent)
        self.tail = DLLNode()  # Dummy tail (most recent)
        self.head.next = self.tail
        self.tail.prev = self.head
        self.size = 0

    def add_to_tail(self, node: DLLNode) -> None:
        prev = self.tail.prev
        prev.next = node
        node.prev = prev
        node.next = self.tail
        self.tail.prev = node
        self.size += 1

    def remove(self, node: DLLNode) -> None:
        node.prev.next = node.next
        node.next.prev = node.prev
        self.size -= 1

    def pop_head(self) -> DLLNode:
        """Remove and return the least recently used node."""
        node = self.head.next
        self.remove(node)
        return node

    def is_empty(self) -> bool:
        return self.size == 0


class LFUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.key_map: dict[int, DLLNode] = {}
        self.freq_map: dict[int, DLinkedList] = defaultdict(DLinkedList)
        self.min_freq = 0

    def get(self, key: int) -> int:
        if key not in self.key_map:
            return -1
        node = self.key_map[key]
        self._increment_freq(node)
        return node.val

    def put(self, key: int, value: int) -> None:
        if self.capacity == 0:
            return

        if key in self.key_map:
            node = self.key_map[key]
            node.val = value
            self._increment_freq(node)
        else:
            if len(self.key_map) >= self.capacity:
                # Evict least frequently used (LRU among ties)
                lfu_list = self.freq_map[self.min_freq]
                evicted = lfu_list.pop_head()
                del self.key_map[evicted.key]

            node = DLLNode(key, value)
            self.key_map[key] = node
            self.freq_map[1].add_to_tail(node)
            self.min_freq = 1  # New key always has freq=1

    def _increment_freq(self, node: DLLNode) -> None:
        """Move node from freq bucket f to f+1."""
        f = node.freq
        self.freq_map[f].remove(node)

        # If this was the min_freq bucket and it's now empty, bump min_freq
        if f == self.min_freq and self.freq_map[f].is_empty():
            self.min_freq += 1

        node.freq += 1
        self.freq_map[node.freq].add_to_tail(node)
```

#### TypeScript

```typescript
class LFUNode {
  key: number;
  val: number;
  freq: number;
  prev: LFUNode | null = null;
  next: LFUNode | null = null;

  constructor(key = 0, val = 0) {
    this.key = key;
    this.val = val;
    this.freq = 1;
  }
}

class FreqList {
  head = new LFUNode();
  tail = new LFUNode();
  size = 0;

  constructor() {
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  addToTail(node: LFUNode): void {
    const prev = this.tail.prev!;
    prev.next = node;
    node.prev = prev;
    node.next = this.tail;
    this.tail.prev = node;
    this.size++;
  }

  remove(node: LFUNode): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
    this.size--;
  }

  popHead(): LFUNode {
    const node = this.head.next!;
    this.remove(node);
    return node;
  }

  isEmpty(): boolean {
    return this.size === 0;
  }
}

class LFUCache {
  private capacity: number;
  private keyMap = new Map<number, LFUNode>();
  private freqMap = new Map<number, FreqList>();
  private minFreq = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: number): number {
    const node = this.keyMap.get(key);
    if (!node) return -1;
    this.incrementFreq(node);
    return node.val;
  }

  put(key: number, value: number): void {
    if (this.capacity === 0) return;

    const existing = this.keyMap.get(key);
    if (existing) {
      existing.val = value;
      this.incrementFreq(existing);
    } else {
      if (this.keyMap.size >= this.capacity) {
        const lfuList = this.freqMap.get(this.minFreq)!;
        const evicted = lfuList.popHead();
        this.keyMap.delete(evicted.key);
      }

      const node = new LFUNode(key, value);
      this.keyMap.set(key, node);
      this.getFreqList(1).addToTail(node);
      this.minFreq = 1;
    }
  }

  private incrementFreq(node: LFUNode): void {
    const f = node.freq;
    this.freqMap.get(f)!.remove(node);

    if (f === this.minFreq && this.freqMap.get(f)!.isEmpty()) {
      this.minFreq++;
    }

    node.freq++;
    this.getFreqList(node.freq).addToTail(node);
  }

  private getFreqList(freq: number): FreqList {
    if (!this.freqMap.has(freq)) {
      this.freqMap.set(freq, new FreqList());
    }
    return this.freqMap.get(freq)!;
  }
}
```

#### Rust

```rust
use std::collections::HashMap;

struct LFUNode {
    key: i32,
    val: i32,
    freq: usize,
    prev: usize,
    next: usize,
}

struct FreqBucket {
    head: usize,  // Sentinel index (least recent)
    tail: usize,  // Sentinel index (most recent)
    size: usize,
}

/// LFU Cache using arena-allocated doubly linked lists per frequency.
/// Each frequency bucket is an independent DLL. Nodes move between
/// buckets as their frequency increases.
struct LFUCache {
    capacity: usize,
    arena: Vec<LFUNode>,
    key_map: HashMap<i32, usize>,          // key → arena index
    freq_map: HashMap<usize, FreqBucket>,  // freq → bucket
    min_freq: usize,
}

impl LFUCache {
    fn new(capacity: usize) -> Self {
        LFUCache {
            capacity,
            arena: Vec::new(),
            key_map: HashMap::new(),
            freq_map: HashMap::new(),
            min_freq: 0,
        }
    }

    fn get(&mut self, key: i32) -> i32 {
        if let Some(&idx) = self.key_map.get(&key) {
            self.increment_freq(idx);
            self.arena[idx].val
        } else {
            -1
        }
    }

    fn put(&mut self, key: i32, value: i32) {
        if self.capacity == 0 { return; }

        if let Some(&idx) = self.key_map.get(&key) {
            self.arena[idx].val = value;
            self.increment_freq(idx);
        } else {
            if self.key_map.len() >= self.capacity {
                // Evict from min_freq bucket
                let bucket = self.freq_map.get(&self.min_freq).unwrap();
                let head = bucket.head;
                let evict_idx = self.arena[head].next;
                self.remove_node(evict_idx);
                let evict_key = self.arena[evict_idx].key;
                self.key_map.remove(&evict_key);
                // Clean up empty bucket
                let bucket = self.freq_map.get(&self.min_freq).unwrap();
                if bucket.size == 0 {
                    // Bucket is empty but we'll overwrite min_freq below
                }
            }

            let idx = self.arena.len();
            self.arena.push(LFUNode {
                key, val: value, freq: 1, prev: 0, next: 0,
            });
            self.ensure_bucket(1);
            self.add_to_tail(1, idx);
            self.key_map.insert(key, idx);
            self.min_freq = 1;
        }
    }

    fn increment_freq(&mut self, idx: usize) {
        let f = self.arena[idx].freq;
        self.remove_node(idx);

        let bucket = self.freq_map.get(&f).unwrap();
        if f == self.min_freq && bucket.size == 0 {
            self.min_freq += 1;
        }

        self.arena[idx].freq = f + 1;
        self.ensure_bucket(f + 1);
        self.add_to_tail(f + 1, idx);
    }

    fn ensure_bucket(&mut self, freq: usize) {
        if !self.freq_map.contains_key(&freq) {
            // Create sentinel pair for this frequency
            let head_idx = self.arena.len();
            self.arena.push(LFUNode {
                key: -1, val: -1, freq: 0, prev: 0, next: 0,
            });
            let tail_idx = self.arena.len();
            self.arena.push(LFUNode {
                key: -1, val: -1, freq: 0, prev: head_idx, next: 0,
            });
            self.arena[head_idx].next = tail_idx;
            self.arena[tail_idx].prev = head_idx;
            self.freq_map.insert(freq, FreqBucket {
                head: head_idx, tail: tail_idx, size: 0,
            });
        }
    }

    fn add_to_tail(&mut self, freq: usize, idx: usize) {
        let bucket = self.freq_map.get_mut(&freq).unwrap();
        let tail = bucket.tail;
        let prev = self.arena[tail].prev;
        self.arena[prev].next = idx;
        self.arena[idx].prev = prev;
        self.arena[idx].next = tail;
        self.arena[tail].prev = idx;
        bucket.size += 1;
    }

    fn remove_node(&mut self, idx: usize) {
        let prev = self.arena[idx].prev;
        let next = self.arena[idx].next;
        self.arena[prev].next = next;
        self.arena[next].prev = prev;
        let freq = self.arena[idx].freq;
        if let Some(bucket) = self.freq_map.get_mut(&freq) {
            bucket.size -= 1;
        }
    }
}
```

Note: The Rust implementation uses the same arena pattern as the
LRU cache. Each frequency bucket gets its own sentinel pair in
the arena. This avoids the complexity of `Rc<RefCell<>>` or
`unsafe` pointer manipulation.

---

## Concept Map

Every problem in this lesson maps back to Phase 1 concepts:

```
  ┌─────────────────────────────┬──────────────────────────────────┐
  │ Problem                     │ Core Concepts                    │
  ├─────────────────────────────┼──────────────────────────────────┤
  │ 1. Reverse Linked List      │ Linked lists, pointer manipulation│
  │ 2. Valid Parentheses        │ Stacks, LIFO matching            │
  │ 3. Two Sum                  │ Hash tables, O(1) lookup         │
  │ 4. LRU Cache                │ Hash table + doubly linked list  │
  │ 5. Queue Using Stacks       │ Stacks, queues, amortized O(1)  │
  │ 6. Group Anagrams           │ Hash tables, canonical forms     │
  │ 7. Merge K Sorted Lists     │ Linked lists, heaps (preview)   │
  │ 8. LFU Cache                │ Hash tables + multiple DLLs     │
  └─────────────────────────────┴──────────────────────────────────┘
```

**Key takeaway:** The hard problems aren't about knowing exotic
algorithms — they're about *combining* the fundamental data
structures you already know in creative ways. An LRU cache is
just a hash map married to a doubly linked list. An LFU cache
adds a frequency dimension. Merge K sorted lists is just the
merge step of merge sort, scaled up with a heap. Master the
fundamentals, and the hard problems become compositions of
familiar pieces.

---

## Exercises

1. **Reverse linked list — recursive**: Implement the reverse
   linked list problem recursively instead of iteratively. What
   is the space complexity of the recursive approach?

2. **Valid parentheses — extended**: Extend the valid parentheses
   solution to also handle the case where the string contains
   non-bracket characters (just ignore them).

3. **Two sum — sorted input**: If the input array is already
   sorted, can you solve two sum without a hash map? What
   technique from Lesson 14 (Two Pointers) would you use?

4. **LRU cache — test it**: Write a sequence of 10+ get/put
   operations and trace through the cache state by hand. Verify
   your trace matches the code output.

5. **Group anagrams — complexity**: Prove that the frequency-based
   approach is O(n·k) while the sort-based approach is
   O(n·k·log k). For what values of k does the difference matter?

6. **Merge K sorted lists — complexity proof**: Why is the divide
   and conquer approach O(n log k)? Draw the merge tree and count
   the total work at each level.

7. **LFU cache — edge case**: What happens when you `put` a key
   that already exists? Trace through the frequency update logic
   carefully. What if the updated key was the only one at the
   minimum frequency?

8. **Design challenge**: Design a cache that evicts the key with
   the *oldest* insertion time (not access time). How is this
   simpler than LRU? What data structures do you need?
