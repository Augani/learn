# Lesson 5: Pointers and References — Addresses in Memory

## What Is a Pointer?

You write your friend's home address on a sticky note: "742 Evergreen Terrace."
The sticky note is **not** the house. It doesn't contain the house. It's a
small piece of paper that tells you **where to find** the house.

A pointer is that sticky note. It's a variable whose value is a **memory
address** — the location of some other data.

```
  Sticky note (pointer)          The house (data)
  ┌─────────────────┐           ┌──────────────────────┐
  │ 0x7ffd4a3b      │──────────▶│ "Hello, world!"      │
  │ (8 bytes)       │           │ (actual data)        │
  └─────────────────┘           └──────────────────────┘

  The pointer is always 8 bytes on a 64-bit system,
  regardless of what it points to — a single byte
  or a gigabyte of data.
```

---

## Why Pointers Exist: The Photo Analogy

Imagine you have a 1MB photo on your phone. Your friend asks for it. You have
two options:

1. **Copy the entire photo** and send it over text (value semantics)
2. **Send a Google Drive link** — a tiny URL that points to the photo (pointer semantics)

Option 1 duplicates the data. If the photo is large, this is slow and wastes
memory. Option 2 sends a tiny reference. Fast, efficient, but now two people
are looking at the **same** photo — if one edits it, the other sees the change.

This is the fundamental tradeoff of pointers:

```
  VALUE SEMANTICS (copy)              POINTER SEMANTICS (reference)
  ┌───────────┐  copy  ┌──────────┐  ┌────────┐        ┌──────────┐
  │ Photo A   │───────▶│ Photo B  │  │ Link 1 │───┐    │          │
  │ (1 MB)    │        │ (1 MB)   │  │ (8 B)  │   ├───▶│ Photo    │
  └───────────┘        └──────────┘  ├────────┤   │    │ (1 MB)   │
                                     │ Link 2 │───┘    │          │
  Total memory: 2 MB                 │ (8 B)  │        └──────────┘
                                     └────────┘
                                     Total memory: ~1 MB + 16 bytes
```

---

## Pointer Arithmetic: Walking Down a Street

Imagine a street where every house is exactly 4 meters wide. If house #0
starts at position 0, then:
- House #1 is at position 4
- House #2 is at position 8
- House #N is at position N * 4

That's pointer arithmetic. If you have a pointer to the first element of an
array, you can find any element by adding `index * element_size` to the base
address.

```
  Array of i32 (4 bytes each), starting at address 0x1000:

  Address:  0x1000    0x1004    0x1008    0x100C    0x1010
           ┌─────────┬─────────┬─────────┬─────────┬─────────┐
           │  10     │  20     │  30     │  40     │  50     │
           │ arr[0]  │ arr[1]  │ arr[2]  │ arr[3]  │ arr[4]  │
           └─────────┴─────────┴─────────┴─────────┴─────────┘

  &arr[0] = 0x1000
  &arr[2] = 0x1000 + (2 * 4) = 0x1008
  &arr[4] = 0x1000 + (4 * 4) = 0x1010

  "Walk 2 houses down" = "add 2 * house_size to the address"
```

In C, you do this directly. In Rust and Go, the language handles it for you
when you index into a slice or array — but the underlying mechanism is identical.

---

## Stack and Heap: Where Pointers Point

Most pointers in real programs point from the **stack** to the **heap**.
Here's what that looks like with actual (simplified) addresses:

```
  STACK (fast, automatic)              HEAP (flexible, manual-ish)
  High addresses                       Scattered locations
  ┌──────────────────────┐
  │ main()               │
  │  ┌─────────────────┐ │            ┌─────────────────────────┐
  │  │ name: String     │ │            │ Address: 0x55a3_bc10    │
  │  │  ptr:  0x55a3──────────────────▶│ │H│e│l│l│o│,│ │w│o│r│  │
  │  │  len:  12        │ │            │ │l│d│!│ │ │ │ │ │ │ │  │
  │  │  cap:  16        │ │            └─────────────────────────┘
  │  └─────────────────┘ │
  │  ┌─────────────────┐ │            ┌─────────────────────────┐
  │  │ scores: Vec<i32> │ │            │ Address: 0x55a3_de40    │
  │  │  ptr:  0x55a3──────────────────▶│ │95│87│92│88│76│        │
  │  │  len:  5         │ │            └─────────────────────────┘
  │  │  cap:  8         │ │
  │  └─────────────────┘ │
  └──────────────────────┘
```

The stack variables are small and fixed-size (24 bytes each for `String` and
`Vec`). The actual data they manage lives on the heap and can be any size.

---

## References: Safe Pointers

A **raw pointer** is like having a copy of someone's house key. You can go in
any time, change things, even after they've moved out (dangling pointer). There
are no rules.

A **reference** is like a library card. The library controls access. You can
borrow a book, but the library tracks who has it, enforces return dates, and
won't let two people write in the same book at the same time.

### Rust's References

Rust has two kinds of references, and the rules are strict:

```rust
let mut book = String::from("Draft v1");

// Shared reference (&T): read-only, can have many
let reader1 = &book;       // OK
let reader2 = &book;       // OK — multiple readers allowed
println!("{}, {}", reader1, reader2);

// Mutable reference (&mut T): read-write, can have only ONE
let editor = &mut book;    // OK — but now no other references allowed
editor.push_str(" - revised");
// println!("{}", reader1);  // ERROR: can't read while someone's editing
```

The rule in plain English: **many readers OR one writer, never both.**

Think of it like a whiteboard in a meeting room:
- Many people can **read** the whiteboard at once (shared references `&T`)
- But if someone is **erasing and rewriting** (mutable reference `&mut T`),
  everyone else must wait — otherwise they'd read half-erased nonsense

```
  SHARED REFERENCES (&T)              MUTABLE REFERENCE (&mut T)
  "Many readers allowed"              "One writer, exclusive access"

  ┌──────────┐                        ┌──────────┐
  │ reader 1 │───┐                    │ writer   │──────┐
  └──────────┘   │  ┌──────────┐      └──────────┘      │  ┌──────────┐
  ┌──────────┐   ├─▶│  data    │                         └─▶│  data    │
  │ reader 2 │───┤  │ (frozen) │      ┌──────────┐         │ (mutable)│
  └──────────┘   │  └──────────┘      │ reader   │──╳      └──────────┘
  ┌──────────┐   │                    └──────────┘
  │ reader 3 │───┘                    BLOCKED — can't read while
  └──────────┘                        writer has exclusive access
```

### Go's Pointers

Go has pointers but no reference/borrow system. It's simpler but less safe.

```go
package main

import "fmt"

func addExcitement(msg *string) {
    *msg = *msg + "!!!"     // dereference and modify
}

func main() {
    greeting := "Hello"
    addExcitement(&greeting) // pass pointer (address-of)
    fmt.Println(greeting)    // "Hello!!!"
}
```

```python
# Python: everything is a reference (but you rarely think about it)
# Variables are names that point to objects

a = [1, 2, 3]
b = a           # b points to the SAME list, not a copy
b.append(4)
print(a)        # [1, 2, 3, 4] — a changed too!

# To actually copy:
c = a.copy()    # or a[:] or list(a)
c.append(5)
print(a)        # [1, 2, 3, 4] — a is unaffected
```

---

## Null Pointers: The Billion-Dollar Mistake

> "I call it my billion-dollar mistake. It was the invention of the null
> reference in 1965." — Tony Hoare, inventor of null

A null pointer is like a GPS address that leads to an **empty lot**. You drive
there expecting a building, but there's nothing. If you try to "enter" the
building (dereference the pointer), your program crashes.

```
  Valid pointer:                    Null pointer:
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ ptr: 0x42│───▶│ data: 99 │    │ ptr: 0x0 │───▶│ NOTHING  │
  └──────────┘    └──────────┘    └──────────┘    │ CRASH!   │
                                                   └──────────┘
```

Null pointer dereferences are one of the most common bugs in C, C++, Go, Java,
and many other languages. They cause crashes, security vulnerabilities, and
endless debugging sessions.

### How Rust Eliminates Null

Rust doesn't have null. Instead, it uses `Option<T>` — a type that explicitly
says "this value might be absent."

```rust
// In languages with null:
//   user = find_user(42)    // might return null
//   print(user.name)        // CRASH if user is null

// In Rust:
fn find_user(id: u32) -> Option<User> {
    if id == 42 {
        Some(User { name: String::from("Alice") })
    } else {
        None  // explicitly "no user found"
    }
}

// The compiler FORCES you to handle the None case:
match find_user(42) {
    Some(user) => println!("Found: {}", user.name),
    None => println!("User not found"),
}

// This WON'T compile — you can't accidentally ignore None:
// let user = find_user(99);
// println!("{}", user.name);  // ERROR: Option<User> has no field `name`
```

The key insight: the **type system** encodes the possibility of absence. You
can't forget to handle it because the compiler won't let your code build.

---

## Smart Pointers: Different Library Cards

Rust has several "smart pointer" types — pointers that carry extra behavior,
like library cards with different rules.

```
  ┌─────────────────────────────────────────────────────────────┐
  │  Smart Pointer     Analogy                    Use Case      │
  │  ──────────────────────────────────────────────────────────  │
  │  Box<T>            A storage locker key.      Put data on   │
  │                    One owner, one key.        the heap.     │
  │                                                             │
  │  Rc<T>             A shared library card.     Multiple      │
  │                    Tracks how many people     owners in a   │
  │                    borrowed it. Last one       single thread.│
  │                    returns it → book is gone.               │
  │                                                             │
  │  Arc<T>            Like Rc but works across   Multiple      │
  │                    library branches (threads). owners across │
  │                    Uses atomic counting.       threads.      │
  │                                                             │
  │  RefCell<T>        A book with a sign-out     Runtime       │
  │                    sheet — checked at          borrow        │
  │                    runtime, not compile time.  checking.     │
  └─────────────────────────────────────────────────────────────┘
```

```rust
use std::rc::Rc;

// Box: single ownership, heap-allocated
let boxed = Box::new(42);
println!("{}", boxed);  // 42

// Rc: reference-counted, shared ownership
let shared = Rc::new(String::from("shared data"));
let clone1 = Rc::clone(&shared);  // increment reference count
let clone2 = Rc::clone(&shared);  // increment again

println!("Reference count: {}", Rc::strong_count(&shared));  // 3
// When all clones are dropped, the data is freed.
```

---

## Value vs Pointer Semantics: Paintings and Photographs

**Value semantics**: You commission an artist to paint a copy of the Mona Lisa
for your house. Now there are two paintings. If you spill coffee on yours, the
original in the Louvre is fine.

**Pointer semantics**: You get a photograph of the Mona Lisa, with a note
saying "the real one is at the Louvre, Room 711." If someone vandalizes the
original, your photo now references a damaged painting.

```go
// Go: structs are VALUE types (copied by default)
type Point struct {
    X, Y int
}

a := Point{1, 2}
b := a            // b is a COPY
b.X = 99
fmt.Println(a.X)  // 1 — a is unchanged

// Use a pointer to share:
c := &a           // c points to a
c.X = 99
fmt.Println(a.X)  // 99 — a changed!
```

```rust
// Rust: most types are moved, not copied
let a = String::from("hello");
let b = a;           // a is MOVED to b — a is no longer valid
// println!("{}", a); // ERROR: value used after move

// Types that implement Copy are duplicated:
let x: i32 = 42;
let y = x;           // x is copied (i32 implements Copy)
println!("{}", x);   // fine — x is still valid

// Clone for explicit deep copy:
let s1 = String::from("hello");
let s2 = s1.clone(); // explicit copy
println!("{}, {}", s1, s2); // both valid
```

---

## Double Indirection: A Note About a Note

Sometimes a pointer points to another pointer. It's like leaving a note on
your door that says: "The delivery instructions are on a note in the kitchen."
You follow two levels of redirection to find the actual instructions.

```
  Double indirection (**T in C, Box<Box<T>> in Rust):

  ptr1          ptr2          data
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ 0xA000   │─▶│ 0xB000   │─▶│ 42       │
  └──────────┘  └──────────┘  └──────────┘
  "address of    "address of    the actual
   the note"      the data"     data
```

You see this in practice with:
- Linked lists: each node has a pointer to the next node
- Dynamic dispatch: a pointer to a vtable (table of function pointers)
- Nested data structures: `Vec<Vec<i32>>` is essentially double indirection

---

## Common Pointer Bugs

### 1. Null Dereference (The empty lot)
Trying to access data through a null pointer. The #1 cause of crashes in
C/C++/Java/Go.

### 2. Dangling Pointer (The demolished house)
The data was freed, but a pointer still holds the old address. Like having
directions to a building that was torn down last week.

```
  BEFORE free:                    AFTER free:
  ┌──────────┐  ┌──────────┐    ┌──────────┐  ┌──────────┐
  │ ptr      │─▶│ data: 42 │    │ ptr      │─▶│ ?????? │
  └──────────┘  └──────────┘    └──────────┘  │ freed! │
                                               └──────────┘
                                 Dereferencing ptr now is
                                 undefined behavior.
```

Rust prevents this at compile time — the borrow checker ensures no reference
outlives the data it points to.

### 3. Wild Pointer (Random GPS coordinates)
An uninitialized pointer that contains a random address. Like typing random
numbers into a GPS — you'll end up somewhere unexpected.

### 4. Memory Leak (Losing the key to a storage unit)
You allocated memory (rented a storage unit) but lost all pointers to it
(lost the key). The memory stays occupied until the program ends, but nothing
can ever access or free it.

```
  ┌──────────┐  ┌──────────┐    ┌──────────┐  ┌──────────┐
  │ ptr      │─▶│ data     │    │ ptr = ??? │  │ data     │
  └──────────┘  └──────────┘    └──────────┘  │ leaked!  │
                                               │ (no way  │
  Normal: ptr points to data     Lost: nothing │  to free)│
                                  points here  └──────────┘
```

---

## Language Comparison

```
  ┌──────────────────────────────────────────────────────────────┐
  │ Feature         Rust         Go          C           Python  │
  │ ─────────────────────────────────────────────────────────────│
  │ Raw pointers    unsafe only  yes (*)     yes (*)     no      │
  │ References      & and &mut   no          no          all vars│
  │ Null            no (Option)  nil         NULL        None    │
  │ Pointer arith   unsafe only  no          yes         no      │
  │ Smart pointers  Box,Rc,Arc   GC          manual      GC      │
  │ Dangling ptrs   impossible*  possible    common      no      │
  │ Memory leaks    rare         possible    common      rare    │
  │                                                              │
  │ * without unsafe code                                        │
  └──────────────────────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: Follow the Pointer
Draw a memory diagram (on paper or in a text file) for this Rust code. Show
the stack and heap, with arrows for pointers:
```rust
let a = Box::new(42);
let b = String::from("hello");
let c = vec![1, 2, 3];
```

### Exercise 2: Reference Rules
Which of these Rust snippets compile? Explain why or why not:
```rust
// Snippet A
let mut x = 5;
let r1 = &x;
let r2 = &x;
println!("{} {}", r1, r2);

// Snippet B
let mut x = 5;
let r1 = &x;
let r2 = &mut x;
println!("{} {}", r1, r2);

// Snippet C
let mut x = 5;
let r1 = &mut x;
*r1 += 1;
println!("{}", x);
```

### Exercise 3: Go Pointers
Write a Go function `swap(a, b *int)` that swaps the values of two integers
using pointers. Call it from `main` and verify the swap worked.

### Exercise 4: The Billion-Dollar Mistake
Write a Rust function `find_in_list(list: &[i32], target: i32) -> Option<usize>`
that returns the index of the target or None. Then use `match`, `if let`,
`unwrap_or`, and `map` to handle the result — four different approaches.

### Exercise 5: Ownership Transfer
Predict the output (or compile error) of this Rust code. Then verify:
```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;
    let s3 = s2.clone();
    println!("{}", s2);
    println!("{}", s3);
    // println!("{}", s1);  // what happens if you uncomment this?
}
```

### Exercise 6: Python Reference Trap
Predict the output of this Python code. Then run it:
```python
a = [[0] * 3] * 3
a[0][0] = 1
print(a)
# Why does the output look wrong? Fix it.
```
Hint: `[[0] * 3] * 3` doesn't do what you think. It creates three references
to the **same** inner list.
