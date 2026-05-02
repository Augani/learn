# Lesson 03: Slices & Maps

## Slices: Go's Workhorse Collection

A slice is a view into an underlying array. Think of it like a window
into a row of mailboxes — the window can slide and resize, but the
mailboxes are always there underneath.

```
Array (fixed, rarely used directly):
+---+---+---+---+---+
| 1 | 2 | 3 | 4 | 5 |
+---+---+---+---+---+

Slice (a window into the array):
        +---+---+---+
        | 2 | 3 | 4 |   <-- slice = {ptr, len:3, cap:4}
        +---+---+---+
          ^
          |
    pointer to element [1]
```

In Rust, you have `Vec<T>` (owned, growable) and `&[T]` (borrowed
slice). Go's slice is like a `Vec<T>` that secretly holds a pointer,
length, and capacity — all in one type.

### Slice Internals

```
+-------------------+
| Slice Header      |
|                   |
|  ptr  --------->  +---+---+---+---+---+
|  len = 3          | a | b | c | . | . |
|  cap = 5          +---+---+---+---+---+
+-------------------+    ^           ^
                         |           |
                       len=3       cap=5
```

---

## Creating Slices

```go
package main

import "fmt"

func main() {
    literal := []int{1, 2, 3, 4, 5}

    withMake := make([]int, 3)

    withMakeCap := make([]int, 0, 10)

    var nilSlice []int

    fmt.Println(literal)
    fmt.Println(withMake)
    fmt.Println(withMakeCap, len(withMakeCap), cap(withMakeCap))
    fmt.Println(nilSlice == nil)
}
```

```
make([]T, length)           -- len elements, all zero
make([]T, length, capacity) -- len zeros, but room for cap
[]T{1, 2, 3}               -- literal
var s []T                   -- nil slice (len=0, cap=0)
```

### make vs new

```
make([]int, 5)   --> initialized slice, ready to use
new(int)         --> pointer to zero-valued int

make is for: slices, maps, channels
new is for:  allocating zeroed memory, returns pointer
```

You'll use `make` 99% of the time. `new` is rare in idiomatic Go.

---

## Working with Slices

### Append

```go
package main

import "fmt"

func main() {
    s := []int{1, 2, 3}
    s = append(s, 4)
    s = append(s, 5, 6, 7)

    other := []int{8, 9}
    s = append(s, other...)

    fmt.Println(s)
}
```

Always reassign: `s = append(s, ...)`. Append may allocate a new
backing array if capacity is exceeded.

```
Before append (cap=4):
+---+---+---+---+
| 1 | 2 | 3 | _ |   <-- room for 1 more
+---+---+---+---+

After append(s, 4) -- fits:
+---+---+---+---+
| 1 | 2 | 3 | 4 |
+---+---+---+---+

After append(s, 5) -- new array allocated (cap doubles):
+---+---+---+---+---+---+---+---+
| 1 | 2 | 3 | 4 | 5 | _ | _ | _ |
+---+---+---+---+---+---+---+---+
```

### Slicing

```go
package main

import "fmt"

func main() {
    s := []int{0, 1, 2, 3, 4, 5}

    fmt.Println(s[1:4])
    fmt.Println(s[:3])
    fmt.Println(s[3:])
    fmt.Println(s[:])
}
```

Slicing creates a new slice header pointing to the same backing
array. Modifying one affects the other. This catches everyone once.

### The Slice Gotcha

```go
package main

import "fmt"

func main() {
    original := []int{1, 2, 3, 4, 5}
    sub := original[1:3]
    sub[0] = 99

    fmt.Println(original)
    fmt.Println(sub)
}
```

Output: `[1 99 3 4 5]` and `[99 3]`. They share memory.

To make an independent copy:

```go
package main

import "fmt"

func main() {
    original := []int{1, 2, 3, 4, 5}
    copied := make([]int, len(original))
    copy(copied, original)

    copied[0] = 99
    fmt.Println(original)
    fmt.Println(copied)
}
```

### Iterating

```go
package main

import "fmt"

func main() {
    fruits := []string{"apple", "banana", "cherry"}

    for index, value := range fruits {
        fmt.Printf("%d: %s\n", index, value)
    }

    for _, value := range fruits {
        fmt.Println(value)
    }

    for index := range fruits {
        fmt.Println(index)
    }
}
```

`_` discards a value, just like in Rust.

---

## Maps

Maps are Go's hash maps. Like Rust's `HashMap<K, V>`, but built
into the language.

Think of a map as a phone book: you look up a name (key) and get
a number (value).

### Creating Maps

```go
package main

import "fmt"

func main() {
    ages := map[string]int{
        "Alice": 30,
        "Bob":   25,
    }

    scores := make(map[string]float64)
    scores["math"] = 95.5

    fmt.Println(ages)
    fmt.Println(scores)
}
```

### Reading and Checking

```go
package main

import "fmt"

func main() {
    m := map[string]int{"a": 1, "b": 2}

    val := m["a"]
    fmt.Println(val)

    val2 := m["missing"]
    fmt.Println(val2)

    val3, ok := m["b"]
    if ok {
        fmt.Println("found:", val3)
    }

    if v, ok := m["missing"]; !ok {
        fmt.Println("not found, got zero:", v)
    }
}
```

The comma-ok idiom is essential. A missing key returns the zero
value — you can't tell "key exists with value 0" from "key missing"
without the second return.

### Deleting and Iterating

```go
package main

import "fmt"

func main() {
    m := map[string]int{"a": 1, "b": 2, "c": 3}

    delete(m, "b")

    for key, value := range m {
        fmt.Printf("%s: %d\n", key, value)
    }
}
```

Map iteration order is randomized in Go. Never depend on it.

---

## Nil Gotchas

```
+-------------------+--------+--------+--------+
|                   | nil?   | len()  | safe?  |
+-------------------+--------+--------+--------+
| var s []int       | yes    | 0      | yes*   |
| s := []int{}      | no     | 0      | yes    |
| var m map[K]V     | yes    | 0      | read   |
| m := map[K]V{}    | no     | 0      | yes    |
+-------------------+--------+--------+--------+

* nil slices work with append, len, cap, range
  nil maps PANIC on write but are safe to read
```

```go
package main

import "fmt"

func main() {
    var s []int
    s = append(s, 1)
    fmt.Println(s, len(s))

    var m map[string]int
    fmt.Println(len(m))
    fmt.Println(m["anything"])

}
```

Golden rule: always initialize maps before writing to them.

---

## Practical Patterns

### Filtering a Slice

```go
package main

import "fmt"

func filter(nums []int, predicate func(int) bool) []int {
    result := make([]int, 0, len(nums))
    for _, n := range nums {
        if predicate(n) {
            result = append(result, n)
        }
    }
    return result
}

func main() {
    nums := []int{1, 2, 3, 4, 5, 6, 7, 8}
    evens := filter(nums, func(n int) bool {
        return n%2 == 0
    })
    fmt.Println(evens)
}
```

### Counting with Maps

```go
package main

import "fmt"

func wordCount(words []string) map[string]int {
    counts := make(map[string]int)
    for _, w := range words {
        counts[w]++
    }
    return counts
}

func main() {
    words := []string{"go", "is", "go", "fast", "go"}
    fmt.Println(wordCount(words))
}
```

---

## Exercises

1. Write a function `removeDuplicates(s []int) []int` that returns
   a new slice with duplicates removed

2. Write a function `invertMap(m map[string]int) map[int]string`
   that swaps keys and values

3. Write a function `intersection(a, b []int) []int` that returns
   elements common to both slices

4. Pre-allocate a slice of 1000 elements and benchmark it against
   starting with an empty slice and appending. Observe the difference

5. Demonstrate the shared-backing-array gotcha: create a slice,
   take a sub-slice, modify the sub-slice, and print both

---

[Next: Lesson 04 - Structs & Methods ->](04-structs-methods.md)
