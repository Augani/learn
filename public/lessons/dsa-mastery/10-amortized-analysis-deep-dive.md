# Lesson 10: Amortized Analysis Deep Dive

> **Analogy**: Think about your monthly budget. Some days you
> spend almost nothing — a coffee here, a snack there. Other
> days you drop a huge amount on rent or a car repair. If
> someone looked only at your worst spending day, they'd think
> you're hemorrhaging money. But averaged over the month, your
> spending is perfectly reasonable. Amortized analysis works the
> same way — it looks at the *average cost per operation over a
> sequence*, not the worst-case cost of any single operation.
> The result is a much more accurate picture of how a data
> structure actually performs in practice.

---

## Why This Matters

In Lesson 03, we saw that appending to a dynamic array is O(1)
amortized, even though individual appends occasionally trigger
an O(n) resize. We hand-waved the argument. Now it's time to
make it rigorous.

Amortized analysis is one of the most important tools in a
computer scientist's toolkit because:

- **Worst-case per operation is misleading**: Many data structures
  have occasional expensive operations (dynamic array resize, hash
  table rehash, splay tree rotation) that are "paid for" by many
  cheap operations. Judging by the worst case alone would make
  these structures look terrible — but they're actually excellent.
- **It explains why standard library data structures work**: Python's
  `list.append()`, Java's `ArrayList.add()`, Rust's `Vec::push()`,
  and C++'s `vector::push_back()` all rely on amortized O(1)
  guarantees. Understanding amortized analysis means understanding
  why these fundamental tools are efficient.
- **It appears in interviews and competitive programming**: Problems
  involving dynamic arrays, hash tables, union-find, and splay
  trees all require amortized reasoning to analyze correctly.
- **It's the bridge to advanced data structures**: Fibonacci heaps,
  splay trees, and link-cut trees all have amortized guarantees
  that are strictly better than their worst-case bounds.

By the end of this lesson, you'll understand three methods for
proving amortized bounds — aggregate, accounting, and potential —
and you'll be able to apply them to dynamic arrays, hash table
rehashing, and get a preview of splay trees.

> **Cross-reference**: We introduced dynamic arrays and their
> resizing behavior in
> [Lesson 03: Arrays and Dynamic Arrays](./03-arrays-and-dynamic-arrays.md).
> We covered hash table rehashing in
> [Lesson 07: Hash Tables](./07-hash-tables.md).

---

## The Core Idea: Sequences, Not Single Operations

Traditional worst-case analysis asks: "What is the most expensive
thing this operation can do?" Amortized analysis asks a different
question: "If I perform n operations in sequence, what is the
total cost, and therefore what is the average cost per operation?"

```
  WORST-CASE vs AMORTIZED — THE KEY DIFFERENCE

  Worst-case analysis:
  ┌─────────────────────────────────────────────────────┐
  │ "What is the maximum cost of ONE operation?"        │
  │                                                     │
  │ Dynamic array append:                               │
  │   Best case:  O(1)  — just write to the next slot   │
  │   Worst case: O(n)  — must resize and copy n items  │
  │                                                     │
  │ Verdict: append is O(n)  ← MISLEADING!              │
  └─────────────────────────────────────────────────────┘

  Amortized analysis:
  ┌─────────────────────────────────────────────────────┐
  │ "What is the total cost of N operations?"           │
  │                                                     │
  │ n appends to a dynamic array:                       │
  │   Total cost: O(n)                                  │
  │   Amortized cost per append: O(n) / n = O(1)        │
  │                                                     │
  │ Verdict: append is O(1) amortized  ← ACCURATE!      │
  └─────────────────────────────────────────────────────┘
```

**Important**: Amortized analysis is NOT average-case analysis.
Average-case analysis assumes a probability distribution over
inputs. Amortized analysis makes no assumptions about inputs —
it guarantees that the total cost of ANY sequence of n operations
is bounded. It's a worst-case guarantee on the sequence, not on
individual operations.

---

## The Monthly Budget Analogy — Deeper

```
  YOUR MONTHLY SPENDING

  Day  1: $5    (coffee)
  Day  2: $8    (lunch)
  Day  3: $5    (coffee)
  Day  4: $1200 (RENT!)        ← worst-case day
  Day  5: $5    (coffee)
  Day  6: $12   (groceries)
  ...
  Day 30: $5    (coffee)

  Worst-case analysis says: "You spend up to $1200/day!"
  → Implies $36,000/month. Terrifying.

  Amortized analysis says: "Total for the month is $2,400."
  → Average per day: $2,400 / 30 = $80/day. Reasonable.

  The rent payment is expensive, but it only happens once.
  The many cheap days "pay for" the expensive day.
  This is exactly what happens with dynamic array resizes.
```

---

## Method 1: The Aggregate Method

The simplest approach. Count the total cost of n operations,
then divide by n.

### Applied to Dynamic Arrays

Consider a dynamic array that starts empty with capacity 1 and
doubles its capacity when full. We perform n `append` operations.

Each append costs 1 (to write the element) plus, if the array
is full, the cost of copying all existing elements to a new
array of double the size.

```
  DYNAMIC ARRAY — COST OF EACH APPEND (n = 16 appends)

  Append #  │ Size before │ Capacity │ Resize? │ Copy cost │ Total cost
  ──────────┼─────────────┼──────────┼─────────┼───────────┼───────────
      1     │      0      │    1     │   No    │     0     │     1
      2     │      1      │    1     │   YES   │     1     │     2
      3     │      2      │    2     │   YES   │     2     │     3
      4     │      3      │    4     │   No    │     0     │     1
      5     │      4      │    4     │   YES   │     4     │     5
      6     │      5      │    8     │   No    │     0     │     1
      7     │      6      │    8     │   No    │     0     │     1
      8     │      7      │    8     │   No    │     0     │     1
      9     │      8      │    8     │   YES   │     8     │     9
     10     │      9      │   16     │   No    │     0     │     1
     11     │     10      │   16     │   No    │     0     │     1
     12     │     11      │   16     │   No    │     0     │     1
     13     │     12      │   16     │   No    │     0     │     1
     14     │     13      │   16     │   No    │     0     │     1
     15     │     14      │   16     │   No    │     0     │     1
     16     │     15      │   16     │   No    │     0     │     1
  ──────────┼─────────────┼──────────┼─────────┼───────────┼───────────
  TOTAL     │             │          │         │    15     │    31
```

The total cost of 16 appends is 31. The copy costs are
1 + 2 + 4 + 8 = 15 (powers of 2), plus 16 for the writes
themselves. Total = 31.

In general, for n appends:
- Write costs: n (one per append)
- Copy costs: 1 + 2 + 4 + ... + n/2 + n ≤ 2n (geometric series)
- Total: n + 2n = 3n

**Amortized cost per append = 3n / n = 3 = O(1).**

```
  AGGREGATE METHOD — VISUAL

  Cost per operation over 16 appends:

  Cost
   9 │                                    ╻
   8 │                                    ║
   7 │                                    ║
   6 │                                    ║
   5 │                    ╻               ║
   4 │                    ║               ║
   3 │          ╻         ║               ║
   2 │    ╻     ║         ║               ║
   1 │ ╻  ║  ╻  ║  ╻╻╻╻  ║  ╻╻╻╻╻╻╻     ║
   0 ├─┴──┴──┴──┴──┴┴┴┴──┴──┴┴┴┴┴┴┴─────┴──
     1  2  3  4  5 6 7 8  9  . . . . . . 16

  Most operations cost 1. Occasional spikes (resizes) are
  rare and get rarer as the array grows. The average (shown
  by the dashed line at ~2) stays constant.

  Amortized cost ≈ 31/16 ≈ 1.94 = O(1)
```

---

## Method 2: The Accounting Method (Banker's Method)

The idea: charge each operation a fixed "amortized cost" that
may be more than its actual cost. The extra charge is stored as
"credit" on the data structure. When an expensive operation
occurs, we pay for it using accumulated credit.

**Rule**: The total amortized cost must always be ≥ the total
actual cost. Credit can never go negative.

### Applied to Dynamic Arrays

We charge each append an amortized cost of **3 units**:
- 1 unit to pay for the write itself
- 2 units saved as credit (stored "on" the element)

When a resize happens, each element that needs to be copied
uses 1 unit of its stored credit to pay for the copy.

```
  ACCOUNTING METHOD — DYNAMIC ARRAY

  Charge each append 3 coins:
  • 1 coin: pay for the write (immediate cost)
  • 1 coin: save on THIS element (to pay for its future copy)
  • 1 coin: save on a MATCHING OLD element (to pay for its copy)

  After 4 appends (capacity = 4, all slots full):

  Index:    [  0  ] [  1  ] [  2  ] [  3  ]
  Credits:     1       1       1       1
               ↑       ↑       ↑       ↑
          These credits will pay for copying
          when we resize to capacity 8.

  Append #5 triggers resize (copy 4 elements → new array of 8):
  • Copy cost = 4 (paid by the 4 stored credits)
  • Write cost = 1 (paid by 1 of the 3 coins charged for append #5)
  • 2 coins left over → stored as credit on new elements

  Credits never go negative → amortized cost of 3 per append is valid.
  3 = O(1). ✓
```

Why does this work? When the array doubles from capacity k to 2k,
we need to copy k elements. Since the last resize (at capacity
k/2), we've performed k/2 new appends. Each append deposited 2
credits, giving us k credits total — exactly enough to pay for
copying k elements.

---

## Method 3: The Potential Method (Physicist's Method)

The most powerful and general method. Define a "potential
function" Φ that maps the state of the data structure to a
non-negative number. The amortized cost of an operation is:

```
  amortized cost = actual cost + ΔΦ
                 = actual cost + (Φ_after - Φ_before)
```

If the potential increases (ΔΦ > 0), the operation "stores
energy" for later. If the potential decreases (ΔΦ < 0), the
operation "releases stored energy" to help pay for itself.

**Requirement**: Φ must be non-negative and Φ(initial state) = 0.
This ensures total amortized cost ≥ total actual cost.

### Applied to Dynamic Arrays

Define the potential function:

```
  Φ(array) = 2 × size - capacity

  where:
  • size     = number of elements currently stored
  • capacity = total allocated slots
```

This potential is 0 right after a resize (size = capacity/2,
so Φ = 2 × capacity/2 - capacity = 0) and grows to equal the
capacity just before the next resize (size = capacity, so
Φ = 2 × capacity - capacity = capacity).

```
  POTENTIAL FUNCTION — VISUAL

  Φ (potential)
   8 │                              ╱
   7 │                            ╱
   6 │                          ╱
   5 │                        ╱
   4 │              ╱───╲   ╱        ← potential drops to 0
   3 │            ╱       ╱            at each resize, then
   2 │      ╱───╲       ╱              climbs back up
   1 │    ╱       ╱───╱
   0 │──╱───╲──╱──────────────────
     ├──┬──┬──┬──┬──┬──┬──┬──┬──→ appends
     1  2  3  4  5  6  7  8  9

  The potential builds up between resizes (cheap appends
  "charge" the potential) and drops sharply at each resize
  (the stored potential pays for the expensive copy).
```

**Case 1: No resize** (size < capacity)

```
  actual cost = 1 (just write)
  ΔΦ = (2(size+1) - capacity) - (2×size - capacity) = 2

  amortized cost = 1 + 2 = 3
```

**Case 2: Resize** (size = capacity = k, new capacity = 2k)

```
  actual cost = 1 + k (write + copy k elements)
  Φ_before = 2k - k = k
  Φ_after  = 2(k+1) - 2k = 2

  ΔΦ = 2 - k

  amortized cost = (1 + k) + (2 - k) = 3
```

In both cases, the amortized cost is exactly 3 = O(1). ✓

---

## Amortized Analysis of Hash Table Rehashing

Hash tables rehash (resize and reinsert all elements) when the
load factor exceeds a threshold (typically 0.75). This is
analogous to dynamic array resizing.

```
  HASH TABLE REHASHING — AGGREGATE METHOD

  Start with capacity 4, load factor threshold = 0.75.
  Rehash when size > capacity × 0.75.

  Insert #  │ Size │ Capacity │ Rehash? │ Cost
  ──────────┼──────┼──────────┼─────────┼──────
      1     │   1  │    4     │   No    │   1
      2     │   2  │    4     │   No    │   1
      3     │   3  │    4     │   No    │   1
      4     │   4  │    4     │   YES   │ 1 + 4 = 5
            │      │    8     │         │ (rehash to 8)
      5     │   5  │    8     │   No    │   1
      6     │   6  │    8     │   No    │   1
      7     │   7  │    8     │   YES   │ 1 + 7 = 8
            │      │   16     │         │ (rehash to 16)
      8     │   8  │   16     │   No    │   1
      ...   │      │          │         │
     12     │  12  │   16     │   No    │   1
     13     │  13  │   16     │   YES   │ 1 + 13 = 14
            │      │   32     │         │ (rehash to 32)

  Rehash costs form a geometric-like series:
  4 + 7 + 13 + ... ≤ 2n (similar to dynamic array analysis)

  Total cost of n insertions ≤ n + 2n = 3n
  Amortized cost per insertion = O(1)  ✓
```

The potential method works here too. Define:

```
  Φ(table) = 2 × size - capacity × load_factor_threshold

  This captures the "pressure" building toward the next rehash.
  Each cheap insert increases Φ by 2. Each rehash drops Φ back
  toward 0, and the released potential pays for the rehash cost.
```

---

## Splay Trees: A Preview of Amortized Elegance

Splay trees are binary search trees that "splay" (rotate to the
root) the most recently accessed node. Individual operations can
take O(n) in the worst case (if the tree is degenerate), but any
sequence of m operations on an n-node splay tree takes O(m log n)
total — giving O(log n) amortized per operation.

```
  SPLAY TREE — THE IDEA

  Before accessing node X          After splaying X to root
  (X is deep in the tree):         (tree is more balanced):

        A                                X
       / \                              / \
      B   C                            /   \
     / \                              B     A
    D   E                            / \   / \
   /                                D   F E   C
  X                                    / \
   \                                  G   H
    F
   / \
  G   H

  The splay operation is expensive (O(depth of X)), but it
  restructures the tree so that future operations are cheaper.
  The potential method proves this balances out to O(log n)
  amortized.
```

The potential function for splay trees uses the **rank** of each
node (log of its subtree size):

```
  Φ(tree) = Σ rank(x) for all nodes x
  where rank(x) = log₂(size of subtree rooted at x)

  Splaying a deep node decreases the total potential
  significantly (the tree becomes more balanced), which
  "pays for" the expensive rotations.
```

We'll cover splay trees in full detail in Lesson 51 (Advanced
Data Structures). For now, the key insight is that amortized
analysis via the potential method is what makes splay trees'
O(log n) guarantee possible — worst-case analysis alone would
only give O(n).

---

## Comparing the Three Methods

```
  ┌──────────────────┬────────────────────────────────────────────────┐
  │ Method           │ Description                                    │
  ├──────────────────┼────────────────────────────────────────────────┤
  │ Aggregate        │ Count total cost of n operations, divide by n. │
  │                  │ Simplest. All operations get the same          │
  │                  │ amortized cost.                                │
  ├──────────────────┼────────────────────────────────────────────────┤
  │ Accounting       │ Assign each operation a fixed "charge."        │
  │ (Banker's)       │ Overcharges are saved as credit. Expensive     │
  │                  │ operations spend saved credit. Different       │
  │                  │ operations can have different amortized costs.  │
  ├──────────────────┼────────────────────────────────────────────────┤
  │ Potential        │ Define a potential function Φ on the data      │
  │ (Physicist's)    │ structure state. Amortized cost = actual cost  │
  │                  │ + ΔΦ. Most general and powerful. Required for  │
  │                  │ splay trees, Fibonacci heaps, etc.             │
  └──────────────────┴────────────────────────────────────────────────┘

  When to use which:
  • Aggregate:   When all operations are the same type (e.g., appends)
  • Accounting:  When you want intuitive "credit" reasoning
  • Potential:   When you need mathematical rigor or have multiple
                 operation types with different costs
```

---

## Technical Deep-Dive: Amortized Dynamic Array in Code

Let's implement a dynamic array that tracks the actual cost of
each operation, so we can verify the amortized analysis
empirically.

### Python

```python
# Python — dynamic array with cost tracking
class AmortizedDynamicArray:
    """Dynamic array that tracks per-operation costs for analysis."""

    def __init__(self):
        self._capacity = 1
        self._size = 0
        self._data = [None] * self._capacity
        self._total_cost = 0
        self._op_count = 0

    def append(self, value) -> int:
        """Append a value. Returns the actual cost of this operation."""
        cost = 1  # cost to write the element

        if self._size == self._capacity:
            # Resize: double capacity, copy all elements
            cost += self._size  # copying cost
            new_capacity = self._capacity * 2
            new_data = [None] * new_capacity
            for i in range(self._size):
                new_data[i] = self._data[i]
            self._data = new_data
            self._capacity = new_capacity

        self._data[self._size] = value
        self._size += 1
        self._total_cost += cost
        self._op_count += 1
        return cost

    def potential(self) -> int:
        """Φ(array) = 2 * size - capacity"""
        return 2 * self._size - self._capacity

    @property
    def amortized_cost(self) -> float:
        """Average cost per operation so far."""
        if self._op_count == 0:
            return 0.0
        return self._total_cost / self._op_count

    @property
    def size(self) -> int:
        return self._size


# Demonstrate amortized analysis
arr = AmortizedDynamicArray()
print(f"{'Append':>6} {'Actual':>6} {'Total':>6} {'Amortized':>9} {'Φ':>4}")
print("-" * 40)

for i in range(1, 33):
    cost = arr.append(i)
    phi = arr.potential()
    print(f"{i:>6} {cost:>6} {arr._total_cost:>6} {arr.amortized_cost:>9.2f} {phi:>4}")

# Output shows amortized cost converges to ~2-3, confirming O(1)
```

### TypeScript

```typescript
// TypeScript — dynamic array with cost tracking
class AmortizedDynamicArray<T> {
  private data: (T | undefined)[];
  private capacity: number;
  private _size: number;
  private totalCost: number;
  private opCount: number;

  constructor() {
    this.capacity = 1;
    this._size = 0;
    this.data = new Array(1);
    this.totalCost = 0;
    this.opCount = 0;
  }

  append(value: T): number {
    let cost = 1; // cost to write the element

    if (this._size === this.capacity) {
      // Resize: double capacity, copy all elements
      cost += this._size;
      const newCapacity = this.capacity * 2;
      const newData = new Array<T | undefined>(newCapacity);
      for (let i = 0; i < this._size; i++) {
        newData[i] = this.data[i];
      }
      this.data = newData;
      this.capacity = newCapacity;
    }

    this.data[this._size] = value;
    this._size++;
    this.totalCost += cost;
    this.opCount++;
    return cost;
  }

  potential(): number {
    // Φ(array) = 2 * size - capacity
    return 2 * this._size - this.capacity;
  }

  get amortizedCost(): number {
    if (this.opCount === 0) return 0;
    return this.totalCost / this.opCount;
  }

  get size(): number {
    return this._size;
  }

  get total(): number {
    return this.totalCost;
  }
}

// Demonstrate amortized analysis
const arr = new AmortizedDynamicArray<number>();
console.log("Append | Actual | Total | Amortized |  Φ");
console.log("-".repeat(45));

for (let i = 1; i <= 32; i++) {
  const cost = arr.append(i);
  const phi = arr.potential();
  console.log(
    `${String(i).padStart(6)} | ` +
    `${String(cost).padStart(6)} | ` +
    `${String(arr.total).padStart(5)} | ` +
    `${arr.amortizedCost.toFixed(2).padStart(9)} | ` +
    `${String(phi).padStart(3)}`
  );
}
```

### Rust

```rust
/// Rust — dynamic array with cost tracking
struct AmortizedDynamicArray<T: Clone + Default> {
    data: Vec<T>,
    capacity: usize,
    size: usize,
    total_cost: usize,
    op_count: usize,
}

impl<T: Clone + Default> AmortizedDynamicArray<T> {
    fn new() -> Self {
        AmortizedDynamicArray {
            data: vec![T::default(); 1],
            capacity: 1,
            size: 0,
            total_cost: 0,
            op_count: 0,
        }
    }

    fn append(&mut self, value: T) -> usize {
        let mut cost: usize = 1; // cost to write the element

        if self.size == self.capacity {
            // Resize: double capacity, copy all elements
            cost += self.size;
            let new_capacity = self.capacity * 2;
            let mut new_data = vec![T::default(); new_capacity];
            for i in 0..self.size {
                new_data[i] = self.data[i].clone();
            }
            self.data = new_data;
            self.capacity = new_capacity;
        }

        self.data[self.size] = value;
        self.size += 1;
        self.total_cost += cost;
        self.op_count += 1;
        cost
    }

    /// Φ(array) = 2 * size - capacity
    fn potential(&self) -> isize {
        2 * self.size as isize - self.capacity as isize
    }

    fn amortized_cost(&self) -> f64 {
        if self.op_count == 0 {
            return 0.0;
        }
        self.total_cost as f64 / self.op_count as f64
    }
}

fn main() {
    let mut arr = AmortizedDynamicArray::<i32>::new();
    println!("{:>6} {:>6} {:>6} {:>9} {:>4}", "Append", "Actual", "Total", "Amortized", "Φ");
    println!("{}", "-".repeat(40));

    for i in 1..=32 {
        let cost = arr.append(i);
        let phi = arr.potential();
        println!(
            "{:>6} {:>6} {:>6} {:>9.2} {:>4}",
            i, cost, arr.total_cost, arr.amortized_cost(), phi
        );
    }
    // Output confirms amortized cost converges to ~2-3 = O(1)
}
```

Note: In Rust, `Vec::push()` already uses a doubling strategy
internally. The implementation above manually manages capacity
to make the cost tracking explicit. In production Rust code,
you'd just use `Vec` and trust its amortized O(1) guarantee.
Python's `list` and TypeScript's `Array` similarly handle
resizing automatically under the hood.

---


## What If We Only Looked at Worst-Case Per Operation?

This is the natural question. If we analyze each operation in
isolation, what picture do we get — and why is it wrong?

### Dynamic Array: The Misleading Verdict

If we only look at worst-case per operation:

```
  WORST-CASE ANALYSIS OF DYNAMIC ARRAY

  append():
    Worst case: O(n) — must resize and copy n elements
    Best case:  O(1) — just write to the next slot

  If we use worst-case analysis for a sequence of n appends:
    Total cost ≤ n × O(n) = O(n²)

  But the ACTUAL total cost is O(n).

  The worst-case analysis overestimates by a factor of n!

  ┌─────────────────────────────────────────────────────────┐
  │ n appends    │ Worst-case estimate │ Actual total cost   │
  ├──────────────┼─────────────────────┼─────────────────────┤
  │ 1,000        │ 1,000,000           │ ~3,000              │
  │ 1,000,000    │ 1,000,000,000,000   │ ~3,000,000          │
  │ 10,000,000   │ 100,000,000,000,000 │ ~30,000,000         │
  └──────────────┴─────────────────────┴─────────────────────┘

  The worst-case estimate is off by a factor of 333x to
  3,333,333x. That's not a rounding error — it's a
  fundamentally wrong conclusion.
```

### The Consequences of Worst-Case-Only Thinking

If engineers only used worst-case per-operation analysis:

1. **Dynamic arrays would be "too slow"**: O(n) per append means
   you'd avoid `list.append()` in Python, `push_back()` in C++,
   and `Vec::push()` in Rust. You'd use fixed-size arrays
   everywhere, wasting memory and adding complexity.

2. **Hash tables would be "too slow"**: O(n) per insert (due to
   rehashing) means you'd avoid `dict` in Python, `HashMap` in
   Rust, and `Map` in JavaScript. You'd use balanced BSTs for
   everything — slower in practice due to cache misses.

3. **Splay trees would be "useless"**: O(n) per operation means
   you'd never use them. But splay trees have remarkable
   properties (like the dynamic optimality conjecture) that make
   them excellent in practice for certain access patterns.

4. **Union-Find would be "quadratic"**: Without amortized analysis,
   union-find with path compression looks like O(n) per find in
   the worst case. The amortized bound is O(α(n)) ≈ O(1), which
   is what makes Kruskal's algorithm efficient.

### When Worst-Case Per Operation IS Appropriate

Amortized analysis isn't always what you want:

- **Real-time systems**: If you're controlling a robot arm or
  processing audio, you need guaranteed low latency for EVERY
  operation. An occasional O(n) resize is unacceptable even if
  the average is O(1). Use fixed-size buffers instead.

- **Interactive applications**: If one frame takes 100ms because
  of a hash table rehash, the user sees a stutter. Amortized
  O(1) doesn't help if the spike is noticeable.

- **Adversarial settings**: If an attacker can trigger worst-case
  behavior (e.g., by crafting inputs that cause repeated
  rehashes), amortized guarantees may not hold in practice.

```
  WHEN TO USE WHICH ANALYSIS

  ┌─────────────────────────────┬──────────────────────────────┐
  │ Use WORST-CASE per op when: │ Use AMORTIZED analysis when: │
  ├─────────────────────────────┼──────────────────────────────┤
  │ • Real-time constraints     │ • Throughput matters more     │
  │ • Latency-sensitive apps    │   than individual latency     │
  │ • Adversarial inputs        │ • Batch processing            │
  │ • Safety-critical systems   │ • General-purpose code        │
  │                             │ • Library data structures     │
  │                             │ • Algorithm analysis          │
  └─────────────────────────────┴──────────────────────────────┘
```

---

## Summary: The Three Methods at a Glance

```
  ┌─────────────────────────────────────────────────────────────┐
  │                  AMORTIZED ANALYSIS CHEAT SHEET             │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  Core idea: Average cost per operation over a SEQUENCE,     │
  │  not a probability distribution. It's a worst-case          │
  │  guarantee on the total, not on individual operations.      │
  │                                                             │
  │  1. AGGREGATE: Total cost / n operations                    │
  │     → Simple, all ops get same amortized cost               │
  │                                                             │
  │  2. ACCOUNTING: Charge fixed amount per op, save credit     │
  │     → Intuitive, different ops can have different costs     │
  │                                                             │
  │  3. POTENTIAL: amortized = actual + ΔΦ                      │
  │     → Most powerful, needed for complex structures          │
  │                                                             │
  │  Key results:                                               │
  │  • Dynamic array append:    O(1) amortized                  │
  │  • Hash table insert:       O(1) amortized                  │
  │  • Splay tree operations:   O(log n) amortized              │
  │  • Union-Find (with path                                    │
  │    compression + rank):     O(α(n)) ≈ O(1) amortized       │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

---

## Exercises

1. **Aggregate method by hand**: A dynamic array starts with
   capacity 1 and doubles on resize. Compute the exact total
   cost of 17 appends. What is the amortized cost per append?
   Compare with the theoretical bound of 3.

2. **Accounting method for a stack with multipop**: Consider a
   stack that supports `push(x)` (cost 1) and `multipop(k)`
   (pops min(k, size) elements, cost = number of elements
   popped). Assign an amortized cost of 2 to each push and 0
   to each multipop. Prove that credits never go negative.
   What is the amortized cost of any sequence of n push and
   multipop operations?

3. **Potential method for a binary counter**: A k-bit binary
   counter supports an `increment()` operation that flips bits.
   The actual cost of an increment is the number of bits
   flipped. Define Φ(counter) = number of 1-bits. Show that
   the amortized cost of increment is O(1).

4. **Hash table load factor experiment**: Modify the Python
   dynamic array code to simulate a hash table with load factor
   threshold 0.75. Track the cost of each insert (1 for normal,
   1 + n for rehash). Verify that the amortized cost per insert
   converges to O(1).

5. **Tripling vs doubling**: What if a dynamic array tripled its
   capacity instead of doubling? Use the aggregate method to
   find the amortized cost per append. Is it still O(1)? What
   about growing by a factor of 1.5 (like some real
   implementations)?

6. **When amortized analysis fails**: Describe a scenario where
   amortized O(1) for dynamic array append is NOT good enough.
   What data structure or strategy would you use instead? Think
   about real-time audio processing or game rendering.
