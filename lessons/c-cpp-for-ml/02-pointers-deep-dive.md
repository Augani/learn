# Lesson 02 — Pointers Deep Dive

> **Analogy:** Pointers are street addresses. The variable is the house,
> the pointer is the address written on a piece of paper. You can have
> many papers with the same address, pass the address around, and even
> have an address that points to another piece of paper (double pointer).

## Pointers as Addresses

```
  MEMORY (a city)
  ═══════════════════════════════════════
  Address   House Contents
  ────────  ────────────────
  0x1000    [  42  ]  <-- int x = 42;
  0x1004    [  ???  ]
  0x1008    [ 0x1000 ]  <-- int* p = &x;  (p holds x's address)
  ═══════════════════════════════════════

  "p" is a piece of paper that says "go to 0x1000"
  "*p" means "go to that address and look inside" → 42
  "&x" means "what's the address of house x?" → 0x1000
```

```c
#include <stdio.h>

int main(void) {
    int x = 42;
    int* p = &x;

    printf("x lives at:   %p\n", (void*)&x);
    printf("p contains:   %p\n", (void*)p);
    printf("*p (value):   %d\n", *p);

    *p = 100;
    printf("x is now:     %d\n", x);

    return 0;
}
```

### Rust Translation

```
  Rust                          C
  ──────────────────────        ──────────────────────
  let x: i32 = 42;             int x = 42;
  let p: &i32 = &x;            int* p = &x;     (immutable)
  let p: &mut i32 = &mut x;    int* p = &x;     (mutable! C doesn't care)
  *p                            *p
```

In Rust, `&` and `&mut` are different types. In C, any `T*` can read
and write. Use `const T*` if you want read-only.

## Pointer Arithmetic — Walking Down the Street

```
  Array in memory (contiguous houses on a street):

  Address:  0x100  0x104  0x108  0x10C  0x110
            +------+------+------+------+------+
  arr:      | 10   | 20   | 30   | 40   | 50   |
            +------+------+------+------+------+
  Index:      [0]    [1]    [2]    [3]    [4]

  arr       → points to 0x100
  arr + 1   → points to 0x104  (moved by sizeof(int) = 4 bytes)
  arr + 3   → points to 0x10C
  *(arr+2)  → value at 0x108 → 30
```

```c
#include <stdio.h>

int main(void) {
    int arr[] = {10, 20, 30, 40, 50};
    int* p = arr;

    for (int i = 0; i < 5; i++) {
        printf("*(p+%d) = %d, p[%d] = %d, addr = %p\n",
               i, *(p + i), i, p[i], (void*)(p + i));
    }

    printf("\nPointer subtraction: %ld elements apart\n",
           (p + 4) - p);

    return 0;
}
```

**Key insight:** `arr[i]` is literally `*(arr + i)`. Array indexing IS
pointer arithmetic with syntactic sugar.

```
  arr[i]  <==>  *(arr + i)  <==>  *(i + arr)  <==>  i[arr]

  Yes, i[arr] compiles. Don't use it. But know it works.
```

## Void Pointers — The "Any Address" Envelope

```
  A void* is an envelope that can hold ANY address.
  You can't open it (dereference) without knowing
  what's inside (casting to a typed pointer).

  +------------------+
  | void* envelope   |
  | contains: 0x1000 |
  | type: ???        |
  +------------------+
       |
       | (cast to int*)
       v
  +------------------+
  | int* typed_ptr   |
  | contains: 0x1000 |
  | type: int        |
  +------------------+
       |
       | (dereference)
       v
     [ 42 ]
```

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void print_bytes(const void* data, size_t len) {
    const unsigned char* bytes = (const unsigned char*)data;
    for (size_t i = 0; i < len; i++) {
        printf("%02x ", bytes[i]);
    }
    printf("\n");
}

int main(void) {
    int x = 0x01020304;
    float f = 3.14f;

    printf("int bytes:   ");
    print_bytes(&x, sizeof(x));

    printf("float bytes: ");
    print_bytes(&f, sizeof(f));

    void* generic = malloc(sizeof(int));
    *(int*)generic = 42;
    printf("value: %d\n", *(int*)generic);
    free(generic);

    return 0;
}
```

**ML context:** `void*` is how CUDA's `cudaMalloc` returns GPU memory.
It doesn't know if you're storing `float` or `int` — you cast it.

## Function Pointers — Addresses of Code

```
  Regular pointer:   address of DATA   (where a value lives)
  Function pointer:  address of CODE   (where a function lives)

  Like having a phone number (function pointer) vs. a street
  address (data pointer). One connects you to a service,
  the other to a location.
```

```c
#include <stdio.h>

double relu(double x) {
    return x > 0 ? x : 0;
}

double sigmoid(double x) {
    return 1.0 / (1.0 + __builtin_exp(-x));
}

void apply(double* arr, int n, double (*activation)(double)) {
    for (int i = 0; i < n; i++) {
        arr[i] = activation(arr[i]);
    }
}

int main(void) {
    double data[] = {-2.0, -1.0, 0.0, 1.0, 2.0};

    apply(data, 5, relu);
    printf("After ReLU: ");
    for (int i = 0; i < 5; i++) printf("%.1f ", data[i]);
    printf("\n");

    double data2[] = {-2.0, -1.0, 0.0, 1.0, 2.0};
    apply(data2, 5, sigmoid);
    printf("After sigmoid: ");
    for (int i = 0; i < 5; i++) printf("%.3f ", data2[i]);
    printf("\n");

    return 0;
}
```

### Rust Translation

```
  Rust                              C
  ──────────────────────────        ──────────────────────────
  fn apply(arr: &mut [f64],        void apply(double* arr,
           f: fn(f64) -> f64)                 int n,
                                              double (*f)(double))
```

## Double Pointers — Address of an Address

```
  MEMORY
  ══════════════════════════════════════════
  0x300:  [ 42 ]         <-- int x = 42
  0x200:  [ 0x300 ]      <-- int* p = &x
  0x100:  [ 0x200 ]      <-- int** pp = &p
  ══════════════════════════════════════════

  pp        → 0x200
  *pp       → 0x300  (the pointer p)
  **pp      → 42     (the value x)

  Like a treasure map that leads to another treasure map
  that leads to the treasure.
```

```c
#include <stdio.h>
#include <stdlib.h>

void allocate_array(int** out, int n) {
    *out = (int*)malloc(n * sizeof(int));
    for (int i = 0; i < n; i++) {
        (*out)[i] = i * 10;
    }
}

int main(void) {
    int* arr = NULL;

    allocate_array(&arr, 5);

    for (int i = 0; i < 5; i++) {
        printf("%d ", arr[i]);
    }
    printf("\n");

    free(arr);
    return 0;
}
```

**Why double pointers?** When a function needs to *change* what a pointer
points to (not just the data it points at), you need a pointer to the
pointer. Like giving someone your address book so they can update an
entry in it.

```
  Want to change...        You need...
  ────────────────         ──────────────
  an int                   int*
  what a pointer points to int**
  a pointer to a pointer   int***  (rare, don't go here)
```

## Arrays of Pointers — The Directory

```c
#include <stdio.h>

int main(void) {
    const char* layers[] = {"conv1", "relu", "pool", "fc"};
    int n = sizeof(layers) / sizeof(layers[0]);

    printf("Model layers:\n");
    for (int i = 0; i < n; i++) {
        printf("  [%d] %s\n", i, layers[i]);
    }

    return 0;
}
```

```
  layers (array of char*):
  +--------+--------+--------+--------+
  | 0x500  | 0x510  | 0x520  | 0x528  |
  +--------+--------+--------+--------+
     |        |        |        |
     v        v        v        v
  "conv1"  "relu"   "pool"   "fc"
```

## Const Correctness — Read-Only Addresses

```
  const int* p        →  "I promise not to change the VALUE at this address"
  int* const p        →  "I promise not to change the ADDRESS itself"
  const int* const p  →  "I change nothing. I am a monk."
```

```c
#include <stdio.h>

void print_array(const int* arr, int n) {
    for (int i = 0; i < n; i++) {
        printf("%d ", arr[i]);
    }
    printf("\n");
}

int main(void) {
    int data[] = {1, 2, 3, 4, 5};
    print_array(data, 5);
    return 0;
}
```

## Exercises

1. **Pointer arithmetic:** Write a function `void reverse(int* arr, int n)`
   that reverses an array in-place using only pointer arithmetic (no `[]`).

2. **Function pointer table:** Create an array of function pointers for
   `relu`, `sigmoid`, and `tanh`. Write a function that takes an
   activation name as a string and returns the matching function pointer.

3. **Double pointer:** Write `void split_array(const int* arr, int n,
   int** evens, int* n_evens, int** odds, int* n_odds)` that separates
   even and odd numbers into newly allocated arrays.

4. **Byte inspector:** Write a function that takes a `void*` and a size,
   and prints the memory as both hex bytes and ASCII characters (like
   a hex dump tool).

5. **ML context:** Write a `Tensor` struct with `float* data` and
   `int shape[4]`. Implement `tensor_get(Tensor* t, int i, int j)` using
   pointer arithmetic for 2D indexing into the flat data array.

---

[Next: Lesson 03 — Memory Management →](03-memory-management.md)
