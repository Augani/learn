# DSA Mastery — From Zero to Hard LeetCode

The complete data structures and algorithms track. No CS degree required.
No prior knowledge assumed. Just you, a programming language, and the
willingness to think deeply about why things work.

Python, TypeScript, and Rust code examples throughout.

```
  +================================================================+
  |                    DSA MASTERY TRACK                            |
  |                                                                |
  |  Phase 1        Phase 2        Phase 3        Phase 4          |
  |  Foundations --> Sorting &  --> Trees      --> Graphs           |
  |  (10 lessons)   Searching      (9 lessons)    (10 lessons)     |
  |                 (6 lessons)                                    |
  |                                                                |
  |  Phase 5        Phase 6        Phase 7        Phase 8          |
  |  Algorithm  --> Strings    --> Advanced & --> LeetCode          |
  |  Paradigms      (3 lessons)    Expert         Mastery          |
  |  (8 lessons)                   (8 lessons)    (11 lessons)     |
  +================================================================+
```

**Prerequisites:** None. You need basic familiarity with at least one
programming language — Python, TypeScript, or Rust. That's it. Every
concept is built from the ground up.

**End goal:** You can confidently solve hard LeetCode problems because
you deeply understand the underlying principles — not because you
memorized patterns.

**Time estimate:** ~120–160 hours depending on your pace and how many
practice problems you work through.

```
  Track Progression:

  You are       After         After         After         After
  here          Phase 2       Phase 4       Phase 6       Phase 8
  |             |             |             |             |
  v             v             v             v             v
  Zero    -->  Easy     -->  Medium   -->  Medium+  -->  Hard
  knowledge    LeetCode      LeetCode      LeetCode      LeetCode
               comfort       comfort       comfort       mastery
```

---

> **Relationship to the existing `data-structures/` track:**
> The [Data Structures track](../data-structures/00-roadmap.md) covers
> 16 lessons in Rust only, focused on practical data structure usage.
> This DSA Mastery track is significantly broader and deeper — it covers
> everything in that track plus dynamic programming, greedy algorithms,
> backtracking, tries, segment trees, union-find, topological sort,
> network flow, string algorithms, computational geometry, randomized
> algorithms, NP-completeness, and a full LeetCode mastery phase.
> Where topics overlap, lessons cross-reference each other.

---

## Reference Files

- [Complexity Cheat Sheet](./reference-complexity.md) — Big-O for every data structure and algorithm in this track
- [Decision Guide](./reference-decision-guide.md) — Which data structure or algorithm to use, organized by problem type
- [Patterns Catalog](./reference-patterns.md) — Every LeetCode pattern with descriptions and when to apply each
- [Problem-Solving Checklist](./reference-problem-solving.md) — Step-by-step methodology for approaching any problem

---

## The Roadmap

### Phase 1: Absolute Fundamentals (Hours 1–30)

Everything starts here. We assume you know nothing about data structures
or algorithms. By the end of this phase you will have a solid mental
model of how data lives in memory and why different organizations exist.

- [ ] [Lesson 01: What Are Data Structures and Why Do They Matter?](./01-what-are-data-structures.md)
- [ ] [Lesson 02: Computational Complexity — Big-O and Beyond](./02-computational-complexity.md)
- [ ] [Lesson 03: Arrays and Dynamic Arrays](./03-arrays-and-dynamic-arrays.md)
- [ ] [Lesson 04: Linked Lists — Singly, Doubly, and Circular](./04-linked-lists.md)
- [ ] [Lesson 05: Stacks — Last In, First Out](./05-stacks.md)
- [ ] [Lesson 06: Queues, Deques, and Circular Buffers](./06-queues-and-deques.md)
- [ ] [Lesson 07: Hash Tables — O(1) Lookup Magic](./07-hash-tables.md)
- [ ] [Lesson 08: Hash Sets, Multisets, and Bloom Filters](./08-hash-sets-and-multisets.md)
- [ ] [Lesson 09: Practice Problems — Fundamentals](./09-practice-fundamentals.md)
- [ ] [Lesson 10: Amortized Analysis Deep Dive](./10-amortized-analysis-deep-dive.md)

```
  Phase 1 Focus:
  +-----------+     +-----------+     +-----------+     +-----------+
  |   What    | --> |   How to  | --> |   Core    | --> |  Practice |
  |  are DS?  |     |  measure  |     |   data    |     |  & deeper |
  |  Big-O    |     | efficiency|     | structures|     |  analysis |
  +-----------+     +-----------+     +-----------+     +-----------+
```

---

### Phase 2: Sorting and Searching (Hours 31–50)

How to put things in order and find things fast. Includes the
theoretical limits of comparison sorting and practical hybrid
algorithms used in real languages.

- [ ] [Lesson 11: Comparison-Based Sorting](./11-comparison-sorting.md)
- [ ] [Lesson 12: Non-Comparison Sorting — Breaking the O(n log n) Barrier](./12-non-comparison-sorting.md)
- [ ] [Lesson 13: Searching Algorithms](./13-searching-algorithms.md)
- [ ] [Lesson 14: Two Pointers and Sliding Window](./14-two-pointers-sliding-window.md)
- [ ] [Lesson 15: Practice Problems — Sorting and Searching](./15-practice-sorting-searching.md)
- [ ] [Lesson 16: Sorting in Practice — Hybrid Algorithms and Real-World Considerations](./16-sorting-in-practice.md)

```
  Phase 2 Focus:
  +-----------+     +-----------+     +-----------+
  | Comparison| --> |   Non-    | --> | Searching |
  |  sorting  |     | comparison|     | & patterns|
  | (6 algos) |     |  sorting  |     |           |
  +-----------+     +-----------+     +-----------+
```

---

### Phase 3: Tree Data Structures (Hours 51–75)

From basic binary trees through balanced trees, heaps, B-trees, tries,
and segment trees. Deep reasoning about why balancing matters and how
different tree designs serve different purposes.

- [ ] [Lesson 17: Binary Trees and Traversals](./17-binary-trees.md)
- [ ] [Lesson 18: Binary Search Trees](./18-binary-search-trees.md)
- [ ] [Lesson 19: Balanced Binary Search Trees — AVL and Red-Black Trees](./19-balanced-trees.md)
- [ ] [Lesson 20: Heaps and Priority Queues](./20-heaps-and-priority-queues.md)
- [ ] [Lesson 21: B-Trees and B+ Trees — Disk-Oriented Search Trees](./21-b-trees.md)
- [ ] [Lesson 22: Tries — Prefix Trees](./22-tries.md)
- [ ] [Lesson 23: Segment Trees and Fenwick Trees](./23-segment-trees-fenwick.md)
- [ ] [Lesson 24: Practice Problems — Trees](./24-practice-trees.md)
- [ ] [Lesson 25: Tree Techniques — LCA, Morris Traversal, and Tree DP](./25-tree-techniques.md)

```
  Phase 3 Focus:
  +-----------+     +-----------+     +-----------+     +-----------+
  |  Binary   | --> | Balanced  | --> |Specialized| --> | Advanced  |
  |  trees &  |     | BSTs &    |     | trees     |     | tree      |
  |  BSTs     |     | heaps     |     | (B, trie) |     | techniques|
  +-----------+     +-----------+     +-----------+     +-----------+
```

---

### Phase 4: Graph Algorithms (Hours 76–100)

Graphs model relationships. This phase covers representations,
traversals, shortest paths, spanning trees, topological ordering,
union-find, network flow, and strongly connected components.

- [ ] [Lesson 26: Graph Representations](./26-graph-representations.md)
- [ ] [Lesson 27: Graph Traversals — BFS and DFS](./27-bfs-dfs.md)
- [ ] [Lesson 28: Shortest Path Algorithms](./28-shortest-paths.md)
- [ ] [Lesson 29: Minimum Spanning Trees — Kruskal's and Prim's](./29-minimum-spanning-trees.md)
- [ ] [Lesson 30: Topological Sort](./30-topological-sort.md)
- [ ] [Lesson 31: Union-Find (Disjoint Set Union)](./31-union-find.md)
- [ ] [Lesson 32: Network Flow](./32-network-flow.md)
- [ ] [Lesson 33: Strongly Connected Components](./33-strongly-connected-components.md)
- [ ] [Lesson 34: Practice Problems — Graphs](./34-practice-graphs.md)
- [ ] [Lesson 35: Graph Modeling Techniques](./35-graph-modeling.md)

```
  Phase 4 Focus:
  +-----------+     +-----------+     +-----------+     +-----------+
  |  Represent| --> | Traverse  | --> | Shortest  | --> | Advanced  |
  |  graphs   |     | BFS/DFS   |     | paths &   |     | (flow,    |
  |           |     |           |     | MST       |     |  SCC)     |
  +-----------+     +-----------+     +-----------+     +-----------+
```

---

### Phase 5: Algorithm Design Paradigms (Hours 101–120)

The core paradigms: recursion, divide and conquer, dynamic programming,
greedy algorithms, and backtracking. Understanding when and why each
paradigm works is the key to solving unfamiliar problems.

- [ ] [Lesson 36: Recursion and Recurrence Relations](./36-recursion-recurrences.md)
- [ ] [Lesson 37: Divide and Conquer](./37-divide-and-conquer.md)
- [ ] [Lesson 38: Dynamic Programming Fundamentals](./38-dp-fundamentals.md)
- [ ] [Lesson 39: Advanced Dynamic Programming](./39-dp-advanced.md)
- [ ] [Lesson 40: Greedy Algorithms](./40-greedy-algorithms.md)
- [ ] [Lesson 41: Backtracking](./41-backtracking.md)
- [ ] [Lesson 42: Practice Problems — Algorithm Design Paradigms](./42-practice-paradigms.md)
- [ ] [Lesson 43: Choosing the Right Paradigm](./43-paradigm-selection.md)

```
  Phase 5 Focus:
  +-----------+     +-----------+     +-----------+     +-----------+
  | Recursion | --> |    DP     | --> |  Greedy & | --> |  Choose   |
  | & divide  |     | (fund. +  |     | backtrack |     |  the right|
  | & conquer |     |  advanced)|     |           |     |  paradigm |
  +-----------+     +-----------+     +-----------+     +-----------+
```

---

### Phase 6: String Algorithms (Hours 121–128)

Dedicated string algorithm coverage — pattern matching, advanced string
data structures, and practice problems.

- [ ] [Lesson 44: String Matching Algorithms](./44-string-matching.md)
- [ ] [Lesson 45: Advanced String Data Structures](./45-advanced-string-structures.md)
- [ ] [Lesson 46: Practice Problems — Strings](./46-practice-strings.md)

```
  Phase 6 Focus:
  +-----------+     +-----------+
  |  Pattern  | --> |  Suffix   |
  |  matching |     |  arrays & |
  | KMP/Rabin |     |  trees    |
  +-----------+     +-----------+
```

---

### Phase 7: Advanced and Expert Topics (Hours 129–145)

Expert-level material: bit manipulation, randomized algorithms,
computational geometry, NP-completeness, advanced data structures,
and cache-friendly algorithms.

- [ ] [Lesson 47: Bit Manipulation](./47-bit-manipulation.md)
- [ ] [Lesson 48: Randomized Algorithms](./48-randomized-algorithms.md)
- [ ] [Lesson 49: Computational Geometry](./49-computational-geometry.md)
- [ ] [Lesson 50: NP-Completeness and Computational Complexity](./50-np-completeness.md)
- [ ] [Lesson 51: Advanced Data Structures](./51-advanced-data-structures.md)
- [ ] [Lesson 52: Cache-Friendly Algorithms](./52-cache-friendly-algorithms.md)
- [ ] [Lesson 53: Practice Problems — Advanced Topics](./53-practice-advanced.md)
- [ ] [Lesson 54: Mock Interview — Expert Round](./54-mock-interview-expert.md)

```
  Phase 7 Focus:
  +-----------+     +-----------+     +-----------+     +-----------+
  |   Bits &  | --> | Geometry  | --> |    NP &   | --> | Advanced  |
  | randomized|     | & sweep   |     | complexity|     |    DS &   |
  | algorithms|     |   line    |     |  theory   |     |   cache   |
  +-----------+     +-----------+     +-----------+     +-----------+
```

---

### Phase 8: LeetCode Mastery (Hours 146–160)

The final phase. Problem-solving methodology, pattern recognition,
brute-force-to-optimal thinking, and hard-problem strategies. This is
where everything comes together.

- [ ] [Lesson 55: Problem-Solving Methodology](./55-problem-solving-methodology.md)
- [ ] [Lesson 56: Recognizing Common LeetCode Patterns](./56-common-patterns.md)
- [ ] [Lesson 57: Brute Force to Optimal](./57-brute-force-to-optimal.md)
- [ ] [Lesson 58: Advanced LeetCode Patterns](./58-advanced-patterns.md)
- [ ] [Lesson 59: Solution Analysis and Optimization](./59-solution-analysis.md)
- [ ] [Lesson 60: Hard-Problem Strategies](./60-hard-problem-strategies.md)
- [ ] [Lesson 61: Practice Problems — Easy Tier](./61-practice-easy.md)
- [ ] [Lesson 62: Practice Problems — Medium Tier](./62-practice-medium.md)
- [ ] [Lesson 63: Practice Problems — Hard Tier](./63-practice-hard.md)
- [ ] [Lesson 64: Capstone — 10 Hard Problems Combining Everything](./64-capstone-hard.md)
- [ ] [Lesson 65: What's Next — Competitive Programming and Beyond](./65-whats-next.md)

```
  Phase 8 Focus:
  +-----------+     +-----------+     +-----------+     +-----------+
  | Methodology| --> | Pattern  | --> | Practice  | --> | Capstone  |
  | & pattern  |     | mastery  |     | easy →    |     | 10 hard   |
  | recognition|     | & optim. |     | med → hard|     | problems  |
  +-----------+     +-----------+     +-----------+     +-----------+
```

---

## How to Use This Track

```
  +---------------------------------------------------+
  |  1. Read the lesson — understand the "why"        |
  |  2. Study the ASCII diagrams and traces           |
  |  3. Run the code examples in your language         |
  |  4. Try the exercises before looking at solutions  |
  |  5. Work through the practice problems each phase  |
  |  6. Check the box when you feel confident          |
  |  7. Move to the next lesson                        |
  +---------------------------------------------------+
```

Every lesson has:
1. A concept explained with everyday analogies
2. ASCII diagrams showing how things work in memory
3. Deep "why" explanations — not just what, but why it works
4. "What If We Tried X Instead?" explorations that build intuition
5. Code you can run in Python, TypeScript, or Rust
6. Exercises to solidify understanding

The practice problem lessons at the end of each phase follow a
difficulty progression: easy → medium → hard. Medium and hard problems
include brute-force-to-optimal walkthroughs showing how to go from a
naive solution to the optimal one step by step.

**Pick your language.** Every code example appears in Python, TypeScript,
and Rust. You don't need to know all three — pick the one you're most
comfortable with and use the others for reference.

**Don't skip the "why."** The deep explanations are what separate this
track from pattern memorization. Understanding why an algorithm works
means you can solve problems you've never seen before.

---

## Recommended Reading

These books are optional — the lessons above cover everything you need.
But if you want to go deeper:

- **Introduction to Algorithms (CLRS)** by Cormen, Leiserson, Rivest, and Stein (MIT Press, 4th Edition 2022) — The definitive algorithms textbook. Dense but comprehensive. Use it as a reference alongside the lessons.
- **The Algorithm Design Manual** by Steven Skiena (Springer, 3rd Edition 2020) — More practical and readable than CLRS. Excellent "war stories" showing how algorithms are used in practice.
- **Competitive Programming** by Steven Halim and Felix Halim (4th Edition 2020) — If you want to go beyond LeetCode into competitive programming. Covers advanced techniques and contest strategies.

---

[Start with Lesson 01: What Are Data Structures and Why Do They Matter? →](./01-what-are-data-structures.md)
