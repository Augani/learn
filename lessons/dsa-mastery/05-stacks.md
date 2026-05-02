# Lesson 05: Stacks — Last In, First Out

> **Analogy**: Picture a stack of plates in a cafeteria. You can
> only add a plate to the top, and you can only take a plate from
> the top. You'd never pull a plate from the middle — the whole
> stack would wobble and crash. The last plate placed on top is
> the first one taken off. That's a stack: Last In, First Out.
> It sounds restrictive, but that constraint is exactly what makes
> stacks so powerful. Your computer uses one every time it calls
> a function, every time you hit Ctrl+Z, and every time it checks
> whether your parentheses are balanced.

---

## Why This Matters

A stack is one of the simplest data structures — just an array or
linked list where you only interact with one end. But that
simplicity is deceptive. By constraining access to a single end,
stacks naturally model any process where the most recent thing
matters most:

- **Function call stacks**: Every programming language uses a
  stack to track function calls. When function A calls function B,
  B goes on top. When B returns, it's popped off and A resumes.
  This is why infinite recursion causes a "stack overflow."
- **Undo/redo**: Text editors push each action onto a stack. Undo
  pops the most recent action. Redo uses a second stack.
- **Expression evaluation**: Compilers use stacks to evaluate
  arithmetic expressions and convert between infix, prefix, and
  postfix notation.
- **Balanced parentheses**: Checking whether `({[]})` is valid
  is a classic stack problem — every opener must match the most
  recent unmatched closer.
- **Browser history**: The back button is a stack. Each page you
  visit is pushed on top. Clicking back pops the current page.
- **DFS traversal**: Depth-first search on graphs uses a stack
  (explicitly or via recursion) to track which nodes to visit
  next.

By the end of this lesson, you'll understand:

- What LIFO means and why it's useful
- How to implement a stack with an array and with a linked list
- How the function call stack works during recursion
- Classic stack applications: balanced parentheses, expression
  evaluation, undo/redo
- When a stack is the right tool — and what happens when you
  relax the constraint

> **Cross-reference**: The existing data structures track covers
> stacks and queues together from a Rust-focused perspective. See
> [Stacks & Queues](../data-structures/04-stacks-queues.md)
> for a complementary treatment.

---

## The Cafeteria Plates Analogy — Deeper

Imagine you work in a cafeteria kitchen. Clean plates come out of
the dishwasher and you stack them on a spring-loaded dispenser:

```
  The plate dispenser:

  Step 1: Start empty        Step 2: Add plate A
                              ┌─────────┐
                              │ Plate A │ ← top
  ┌─────────┐                ├─────────┤
  │ (empty) │                │ spring  │
  └─────────┘                └─────────┘

  Step 3: Add plate B        Step 4: Add plate C
  ┌─────────┐                ┌─────────┐
  │ Plate B │ ← top          │ Plate C │ ← top
  ├─────────┤                ├─────────┤
  │ Plate A │                │ Plate B │
  ├─────────┤                ├─────────┤
  │ spring  │                │ Plate A │
  └─────────┘                ├─────────┤
                              │ spring  │
                              └─────────┘

  A customer takes a plate → they get Plate C (the top one).
  The next customer gets Plate B. Then Plate A.
  Last in, first out.
```

Key properties:

- **Push**: Place a plate on top. O(1) — you don't touch any
  other plates.
- **Pop**: Remove the top plate. O(1) — again, no other plates
  are disturbed.
- **Peek**: Look at the top plate without removing it. O(1).
- **No middle access**: You can't grab Plate A without first
  removing C and B. This is the constraint, and it's intentional.

Why is this constraint useful? Because many real-world processes
are naturally LIFO. When you nest function calls, the innermost
call must finish before the outer one can resume. When you type
and undo, you undo the most recent action first. The constraint
isn't a limitation — it's a feature that matches the problem.

---

## LIFO Semantics: The Core Operations

A stack supports exactly three operations:

```
  ┌─────────────────────────────────────────────────────┐
  │                    STACK                             │
  │                                                     │
  │   push(x)  →  Add x to the top          O(1)       │
  │   pop()    →  Remove and return the top  O(1)       │
  │   peek()   →  Return the top (no remove) O(1)       │
  │   isEmpty() → Check if stack is empty    O(1)       │
  │                                                     │
  │   All operations happen at ONE end only (the top)   │
  └─────────────────────────────────────────────────────┘
```

Here's a step-by-step trace of push and pop operations:

```
  PUSH/POP TRACE

  Operation        Stack (top →)     Returned
  ─────────        ──────────────    ────────
  push(10)         [10]
  push(20)         [10, 20]
  push(30)         [10, 20, 30]
  peek()           [10, 20, 30]     30
  pop()            [10, 20]         30
  pop()            [10]             20
  push(40)         [10, 40]
  pop()            [10]             40
  pop()            []               10
  pop()            []               ERROR: stack empty!
```

Notice the order: we pushed 10, 20, 30 but popped them as
30, 20, 10. Last in, first out.

---

## Implementation 1: Array-Based Stack

The simplest stack implementation uses a dynamic array. The "top"
of the stack is the end of the array:

```
  Array-based stack — the top is the last element:

  push(10):  [10]
              ↑ top (index 0)

  push(20):  [10, 20]
                   ↑ top (index 1)

  push(30):  [10, 20, 30]
                       ↑ top (index 2)

  pop():     [10, 20]         → returns 30
                   ↑ top (index 1)

  Why use the END of the array?
  • Appending to the end is O(1) amortized (dynamic array)
  • Removing from the end is O(1) (no shifting needed)
  • If we used the FRONT, push/pop would be O(n) due to shifting
```

This is the most common implementation because:

1. **Cache-friendly**: Array elements are contiguous in memory,
   so the CPU cache can prefetch them efficiently.
2. **No pointer overhead**: Unlike a linked list, there are no
   extra pointers per element.
3. **Amortized O(1)**: Dynamic array resizing (doubling) gives
   amortized O(1) push, as we saw in Lesson 03.

The only downside: if the array needs to resize, a single push
can take O(n) time (copying all elements to a new array). But
amortized over many operations, it's still O(1) per push.

---

## Implementation 2: Linked-List-Based Stack

You can also build a stack using a singly linked list. The "top"
of the stack is the head of the list:

```
  Linked-list-based stack — the top is the head:

  push(10):
  top
   │
   ▼
  [10] ──► null

  push(20):
  top
   │
   ▼
  [20] ──► [10] ──► null

  push(30):
  top
   │
   ▼
  [30] ──► [20] ──► [10] ──► null

  pop():  remove head, return 30
  top
   │
   ▼
  [20] ──► [10] ──► null
```

Push = prepend to head (O(1)). Pop = remove head (O(1)). No
resizing ever needed. But each node carries a pointer overhead,
and nodes are scattered in memory (cache-unfriendly).

### When to Use Which?

```
  ┌──────────────────────┬──────────────┬──────────────────┐
  │ Consideration        │ Array-based  │ Linked-list-based│
  ├──────────────────────┼──────────────┼──────────────────┤
  │ Push/Pop time        │ O(1) amort.  │ O(1) worst-case  │
  │ Memory per element   │ Just data    │ Data + pointer   │
  │ Cache performance    │ Excellent    │ Poor             │
  │ Max size known?      │ Pre-allocate │ Grows freely     │
  │ Worst-case push      │ O(n) resize  │ O(1) always      │
  │ Memory fragmentation │ None         │ Per-node alloc   │
  └──────────────────────┴──────────────┴──────────────────┘

  In practice: array-based stacks win for almost all use cases.
  Linked-list stacks are useful when you need guaranteed O(1)
  worst-case (e.g., real-time systems) or when memory is highly
  fragmented.
```

---

## The Function Call Stack

Every time your program calls a function, the runtime pushes a
**stack frame** onto the call stack. Each frame contains the
function's local variables, parameters, and the return address
(where to resume when the function finishes).

```
  THE CALL STACK DURING RECURSION

  Consider: factorial(4)

  def factorial(n):
      if n <= 1:
          return 1
      return n * factorial(n - 1)

  Step 1: main() calls factorial(4)
  ┌──────────────────┐
  │ factorial(4)     │ ← top
  │   n = 4          │
  ├──────────────────┤
  │ main()           │
  └──────────────────┘

  Step 2: factorial(4) calls factorial(3)
  ┌──────────────────┐
  │ factorial(3)     │ ← top
  │   n = 3          │
  ├──────────────────┤
  │ factorial(4)     │
  │   n = 4          │
  ├──────────────────┤
  │ main()           │
  └──────────────────┘

  Step 3: factorial(3) calls factorial(2)
  ┌──────────────────┐
  │ factorial(2)     │ ← top
  │   n = 2          │
  ├──────────────────┤
  │ factorial(3)     │
  │   n = 3          │
  ├──────────────────┤
  │ factorial(4)     │
  │   n = 4          │
  ├──────────────────┤
  │ main()           │
  └──────────────────┘

  Step 4: factorial(2) calls factorial(1)
  ┌──────────────────┐
  │ factorial(1)     │ ← top (base case! returns 1)
  │   n = 1          │
  ├──────────────────┤
  │ factorial(2)     │
  │   n = 2          │
  ├──────────────────┤
  │ factorial(3)     │
  │   n = 3          │
  ├──────────────────┤
  │ factorial(4)     │
  │   n = 4          │
  ├──────────────────┤
  │ main()           │
  └──────────────────┘

  Now the stack UNWINDS (pops):

  Step 5: factorial(1) returns 1     → pop
  Step 6: factorial(2) returns 2 * 1 = 2   → pop
  Step 7: factorial(3) returns 3 * 2 = 6   → pop
  Step 8: factorial(4) returns 4 * 6 = 24  → pop
  Step 9: main() receives 24
```

This is why infinite recursion causes a **stack overflow** — the
call stack has a fixed size (typically 1-8 MB), and each recursive
call adds a frame. If you never hit a base case, the stack fills
up and the program crashes.

---

## Application: Balanced Parentheses

One of the most classic stack problems: given a string of
brackets, determine if every opener has a matching closer in the
correct order.

```
  BALANCED PARENTHESES — STEP BY STEP

  Input: "({[]})"

  Char    Action              Stack
  ────    ──────              ─────
  (       push '('            [(]
  {       push '{'            [(, {]
  [       push '['            [(, {, []
  ]       pop → '[', matches  [(, {]
  }       pop → '{', matches  [(]
  )       pop → '(', matches  []
  END     stack empty → ✓ VALID

  Input: "({[})"

  Char    Action              Stack
  ────    ──────              ─────
  (       push '('            [(]
  {       push '{'            [(, {]
  [       push '['            [(, {, []
  }       pop → '[', expected ']' but got '}' → ✗ INVALID
```

The key insight: when you encounter a closing bracket, it must
match the *most recently opened* bracket — which is exactly what
the top of the stack gives you. LIFO order matches the nesting
order of brackets.

---

## Application: Expression Evaluation

Stacks power how compilers evaluate arithmetic expressions. The
**shunting-yard algorithm** (by Dijkstra) converts infix notation
(`3 + 4 * 2`) to postfix notation (`3 4 2 * +`), and then a
simple stack evaluates the postfix expression:

```
  POSTFIX EVALUATION: 3 4 2 * +

  Token   Action                    Stack
  ─────   ──────                    ─────
  3       push 3                    [3]
  4       push 4                    [3, 4]
  2       push 2                    [3, 4, 2]
  *       pop 2 and 4, push 4*2=8  [3, 8]
  +       pop 8 and 3, push 3+8=11 [11]
  END     result = pop → 11        []

  Why postfix? No parentheses needed, no operator precedence
  rules — just scan left to right and use a stack.
```

---

## Application: Undo/Redo

Text editors typically use two stacks:

```
  UNDO/REDO WITH TWO STACKS

  Action Stack (undo)          Redo Stack
  ─────────────────            ──────────

  Type "H":
  [type H]                     []

  Type "i":
  [type H, type i]             []

  Type "!":
  [type H, type i, type !]    []

  Undo (Ctrl+Z):
  Pop "type !" from action stack, push to redo stack
  [type H, type i]             [type !]

  Undo again:
  [type H]                     [type !, type i]

  Redo (Ctrl+Y):
  Pop "type i" from redo stack, push to action stack
  [type H, type i]             [type !]

  New action (type "a") — clears redo stack:
  [type H, type i, type a]    []  ← redo history lost
```

---

## Technical Deep-Dive: Implementing Stacks

### Python

```python
# Python — array-based stack
class Stack:
    def __init__(self):
        self._items = []

    def push(self, item):
        """Add item to top — O(1) amortized."""
        self._items.append(item)

    def pop(self):
        """Remove and return top item — O(1)."""
        if self.is_empty():
            raise IndexError("pop from empty stack")
        return self._items.pop()

    def peek(self):
        """Return top item without removing — O(1)."""
        if self.is_empty():
            raise IndexError("peek at empty stack")
        return self._items[-1]

    def is_empty(self):
        return len(self._items) == 0

    def __len__(self):
        return len(self._items)

    def __repr__(self):
        return f"Stack({self._items})"


# Balanced parentheses checker
def is_balanced(s: str) -> bool:
    stack = Stack()
    matching = {')': '(', '}': '{', ']': '['}

    for char in s:
        if char in '({[':
            stack.push(char)
        elif char in ')}]':
            if stack.is_empty() or stack.pop() != matching[char]:
                return False

    return stack.is_empty()


# Usage
stack = Stack()
stack.push(10)
stack.push(20)
stack.push(30)
print(stack.peek())  # 30
print(stack.pop())   # 30
print(stack.pop())   # 20
print(len(stack))    # 1

print(is_balanced("({[]})"))  # True
print(is_balanced("({[})"))   # False
```

Note: In practice, Python lists already behave as stacks —
`list.append()` and `list.pop()` are O(1) amortized. The class
above just wraps a list with a cleaner interface. For
thread-safe stacks, use `queue.LifoQueue`.

### TypeScript

```typescript
// TypeScript — array-based stack
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T {
    if (this.isEmpty()) {
      throw new Error("pop from empty stack");
    }
    return this.items.pop()!;
  }

  peek(): T {
    if (this.isEmpty()) {
      throw new Error("peek at empty stack");
    }
    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  get length(): number {
    return this.items.length;
  }

  toString(): string {
    return `Stack([${this.items.join(", ")}])`;
  }
}

// Balanced parentheses checker
function isBalanced(s: string): boolean {
  const stack = new Stack<string>();
  const matching: Record<string, string> = {
    ")": "(",
    "}": "{",
    "]": "[",
  };

  for (const char of s) {
    if ("({[".includes(char)) {
      stack.push(char);
    } else if (")}]".includes(char)) {
      if (stack.isEmpty() || stack.pop() !== matching[char]) {
        return false;
      }
    }
  }

  return stack.isEmpty();
}

// Usage
const stack = new Stack<number>();
stack.push(10);
stack.push(20);
stack.push(30);
console.log(stack.peek()); // 30
console.log(stack.pop());  // 30
console.log(stack.pop());  // 20
console.log(stack.length); // 1

console.log(isBalanced("({[]})")); // true
console.log(isBalanced("({[})")); // false
```

### Rust

```rust
// Rust — array-based stack using Vec
struct Stack<T> {
    items: Vec<T>,
}

impl<T> Stack<T> {
    fn new() -> Self {
        Stack { items: Vec::new() }
    }

    fn push(&mut self, item: T) {
        self.items.push(item);
    }

    fn pop(&mut self) -> Option<T> {
        self.items.pop()
    }

    fn peek(&self) -> Option<&T> {
        self.items.last()
    }

    fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    fn len(&self) -> usize {
        self.items.len()
    }
}

// Balanced parentheses checker
fn is_balanced(s: &str) -> bool {
    let mut stack = Stack::new();

    for ch in s.chars() {
        match ch {
            '(' | '{' | '[' => stack.push(ch),
            ')' | '}' | ']' => {
                let expected = match ch {
                    ')' => '(',
                    '}' => '{',
                    ']' => '[',
                    _ => unreachable!(),
                };
                match stack.pop() {
                    Some(top) if top == expected => {}
                    _ => return false,
                }
            }
            _ => {} // ignore non-bracket characters
        }
    }

    stack.is_empty()
}

fn main() {
    let mut stack = Stack::new();
    stack.push(10);
    stack.push(20);
    stack.push(30);
    println!("{:?}", stack.peek()); // Some(30)
    println!("{:?}", stack.pop());  // Some(30)
    println!("{:?}", stack.pop());  // Some(20)
    println!("{}", stack.len());    // 1

    println!("{}", is_balanced("({[]})")); // true
    println!("{}", is_balanced("({[})"));  // false
}
```

Note: Rust's `Vec` already provides `push()` and `pop()` with
stack semantics. The wrapper above adds a clean interface. In
production Rust, you'd typically just use a `Vec<T>` directly
as your stack.

---

## Operation Complexity Summary

```
┌──────────────────────┬──────────────┬──────────────────┐
│ Operation            │ Array-based  │ Linked-list-based│
├──────────────────────┼──────────────┼──────────────────┤
│ push(x)              │ O(1) amort.  │ O(1)             │
│ pop()                │ O(1)         │ O(1)             │
│ peek()               │ O(1)         │ O(1)             │
│ isEmpty()            │ O(1)         │ O(1)             │
│ search(x)            │ O(n)         │ O(n)             │
│ Space                │ O(n)         │ O(n)             │
│ Space per element    │ Just data    │ Data + pointer   │
└──────────────────────┴──────────────┴──────────────────┘

Note: "search" is not a standard stack operation. If you need
to search, a stack is probably the wrong data structure.
```

---

## What If We Allowed Access from Both Ends?

A stack restricts access to one end. What if we relaxed that
constraint and allowed push and pop from *both* ends?

### You'd Get a Deque (Double-Ended Queue)

A **deque** (pronounced "deck") supports:

- `push_front(x)` — add to the front
- `push_back(x)` — add to the back
- `pop_front()` — remove from the front
- `pop_back()` — remove from the back

```
  Stack vs Deque:

  Stack (one end only):
                    push/pop
                       ↕
  ┌────┬────┬────┬────┐
  │ 10 │ 20 │ 30 │ 40 │
  └────┴────┴────┴────┘
  bottom              top

  Deque (both ends):
  push/pop                    push/pop
     ↕                           ↕
  ┌────┬────┬────┬────┐
  │ 10 │ 20 │ 30 │ 40 │
  └────┴────┴────┴────┘
  front               back
```

### Why Not Always Use a Deque?

If a deque can do everything a stack can (and more), why bother
with stacks at all?

1. **Clarity of intent**: When you use a stack, anyone reading
   your code immediately knows the access pattern is LIFO. A
   deque is more general, so the reader has to figure out which
   ends you're actually using.

2. **Correctness by constraint**: If your algorithm requires LIFO
   order, using a stack *prevents* accidental access from the
   wrong end. A deque would silently allow bugs.

3. **Simpler implementation**: A stack backed by a dynamic array
   is trivial. A deque requires either a circular buffer or a
   doubly linked list — more complex, more memory overhead.

4. **Performance**: For pure LIFO workloads, a stack (backed by
   a contiguous array) has better cache locality than a deque
   backed by a linked list.

### When You Actually Need a Deque

- **Sliding window maximum**: Maintain a monotonic deque to find
  the maximum in every window of size k in O(n) total.
- **BFS with 0-1 weights**: Use a deque instead of a priority
  queue for graphs where edge weights are only 0 or 1.
- **Work-stealing schedulers**: Threads push work to one end and
  steal from the other end.

We'll explore deques fully in the next lesson.

### The Takeaway

Constraints are features, not limitations. A stack's restriction
to one end is what makes it the perfect tool for LIFO problems.
Relaxing that constraint gives you a deque — more flexible, but
also more complex and less communicative about intent. Choose the
most constrained data structure that solves your problem.

---

## Exercises

1. **Trace push/pop**: Starting with an empty stack, trace the
   state after each operation: `push(5)`, `push(3)`, `push(8)`,
   `pop()`, `push(1)`, `pop()`, `pop()`, `pop()`. What value
   does each `pop()` return? What happens on the last `pop()`?

2. **Reverse a string**: Write a function that uses a stack to
   reverse a string. Push each character, then pop them all.
   What is the time and space complexity?

3. **Min stack**: Design a stack that supports `push`, `pop`,
   `peek`, and `getMin` — all in O(1) time. Hint: use an
   auxiliary stack that tracks the current minimum at each level.

4. **Postfix evaluator**: Write a function that evaluates a
   postfix expression like `["3", "4", "+", "2", "*"]` using a
   stack. The result should be `(3 + 4) * 2 = 14`.

5. **Daily temperatures**: Given an array of daily temperatures,
   return an array where each element is the number of days you
   have to wait for a warmer temperature. Use a stack of indices.
   Example: `[73, 74, 75, 71, 69, 72, 76, 73]` →
   `[1, 1, 4, 2, 1, 1, 0, 0]`.

6. **Two-stack queue**: Implement a queue using two stacks. Your
   queue should support `enqueue` and `dequeue` in amortized O(1)
   time. Hint: use one stack for incoming elements and one for
   outgoing elements. (This is a preview of the next lesson!)

---

**Previous**: [Lesson 04 — Linked Lists](./04-linked-lists.md)
**Next**: [Lesson 06 — Queues, Deques, and Circular Buffers](./06-queues-and-deques.md)
