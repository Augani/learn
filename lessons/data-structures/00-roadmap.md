# Data Structures & Algorithms — The Practical Ones

Not LeetCode grind. Understanding how data is organized in memory so you
can make informed decisions about performance.

Implemented in Rust. Focused on what you'll actually use.

---

## Reference Files

- [Big-O Cheat Sheet](./reference-big-o.md) — Time/space complexity quick reference
- [When To Use What](./reference-decision-guide.md) — Data structure decision flowchart

---

## The Roadmap

### Phase 1: How Data Lives in Memory (Hours 1–8)
- [ ] [Lesson 01: Arrays and memory layout — contiguous vs scattered](./01-arrays-memory.md)
- [ ] [Lesson 02: Big-O notation — how to think about performance](./02-big-o.md)
- [ ] [Lesson 03: Linked lists — when and why (spoiler: rarely in Rust)](./03-linked-lists.md)
- [ ] [Lesson 04: Stacks and queues — LIFO and FIFO](./04-stacks-queues.md)

### Phase 2: Searching and Sorting (Hours 9–18)
- [ ] [Lesson 05: Searching — linear, binary, and why sorted data matters](./05-searching.md)
- [ ] [Lesson 06: Sorting — the practical algorithms you need to know](./06-sorting.md)
- [ ] [Lesson 07: Hash maps — how they work inside (the most important data structure)](./07-hash-maps.md)
- [ ] [Lesson 08: Hash sets and bloom filters](./08-hash-sets-bloom.md)

### Phase 3: Trees and Graphs (Hours 19–30)
- [ ] [Lesson 09: Binary trees and BSTs](./09-binary-trees.md)
- [ ] [Lesson 10: Balanced trees — B-trees and red-black trees (how databases use them)](./10-balanced-trees.md)
- [ ] [Lesson 11: Heaps and priority queues](./11-heaps.md)
- [ ] [Lesson 12: Graphs — representation, BFS, DFS](./12-graphs.md)
- [ ] [Lesson 13: Shortest path — Dijkstra's algorithm](./13-shortest-path.md)

### Phase 4: Practical Patterns (Hours 31–40)
- [ ] [Lesson 14: String algorithms — matching, hashing, tries](./14-strings.md)
- [ ] [Lesson 15: Caching strategies — LRU, LFU, TTL](./15-caching.md)
- [ ] [Lesson 16: Choosing the right data structure — real-world scenarios](./16-choosing.md)

---

## How to use these lessons

Every lesson has:
1. The concept with visual diagrams
2. Why it matters in real systems (not just theory)
3. Implementation in Rust (build it yourself)
4. Std library equivalent (what Rust gives you for free)
5. Exercises

Focus is on UNDERSTANDING, not memorizing algorithms. If you understand
WHY a hash map is O(1) and a linear search is O(n), you'll make better
decisions forever.

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Introduction to Algorithms** by Cormen, Leiserson, Rivest, and Stein (MIT Press, 4th Edition 2022) — The comprehensive algorithms reference (CLRS)
- **The Algorithm Design Manual** by Steven Skiena (Springer, 3rd Edition 2020) — Practical algorithm design
- **Grokking Algorithms** by Aditya Bhargava (Manning, 2nd Edition 2024) — Visual, beginner-friendly algorithms
