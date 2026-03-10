# Lesson 03 — Memory Management

> **Analogy:** In Rust, you have a personal assistant (the borrow checker)
> who cleans up after you, returns your library books, and locks your doors.
> In C, you live alone. If you don't wash the dishes, they pile up forever.
> If you lose your house key, that house is gone. Welcome to manual memory.

## The Memory Layout

```
  HIGH ADDRESSES
  ┌─────────────────────┐
  │       Stack          │  Local variables, function args
  │  (grows downward ↓)  │  Automatic: allocated/freed per function call
  ├─────────────────────┤
  │         ...          │  (unused space)
  ├─────────────────────┤
  │       Heap           │  malloc/free territory
  │  (grows upward ↑)    │  Manual: YOU allocate, YOU free
  ├─────────────────────┤
  │       BSS            │  Uninitialized global/static vars
  ├─────────────────────┤
  │       Data           │  Initialized global/static vars
  ├─────────────────────┤
  │       Text           │  Your compiled code (read-only)
  └─────────────────────┘
  LOW ADDRESSES
```

```
  Rust                              C
  ──────────────────────────        ──────────────────────────
  let x = 5;        → stack        int x = 5;         → stack
  Box::new(5)        → heap         malloc(sizeof(int)) → heap
  (drop auto)        → free         free(ptr)           → manual
  Vec::new()         → heap+grow    realloc()           → manual
```

## malloc, calloc, realloc, free — The Core Four

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
    int* a = (int*)malloc(5 * sizeof(int));
    if (!a) {
        fprintf(stderr, "malloc failed\n");
        return 1;
    }
    for (int i = 0; i < 5; i++) a[i] = i * 10;

    int* b = (int*)calloc(5, sizeof(int));
    if (!b) {
        free(a);
        return 1;
    }

    int* c = (int*)realloc(a, 10 * sizeof(int));
    if (!c) {
        free(a);
        free(b);
        return 1;
    }
    a = c;
    for (int i = 5; i < 10; i++) a[i] = i * 10;

    printf("a: ");
    for (int i = 0; i < 10; i++) printf("%d ", a[i]);
    printf("\nb: ");
    for (int i = 0; i < 5; i++) printf("%d ", b[i]);
    printf("\n");

    free(a);
    free(b);
    return 0;
}
```

```
  malloc(n)     Allocate n bytes. Contents = garbage.
  calloc(n, s)  Allocate n*s bytes. Contents = zero.
  realloc(p, n) Resize allocation. May move data.
  free(p)       Release memory. p is now dangling.

  +----------+     +----------+     +----------+
  | malloc() | --> | use it   | --> | free()   |
  | get ptr  |     | read/    |     | return   |
  +----------+     | write    |     | memory   |
                   +----------+     +----------+

  Skip free()? Memory leak.
  Use after free()? Undefined behavior.
  Free twice? Undefined behavior.
```

## Memory Leak — Losing Your Keys

```c
#include <stdlib.h>

void leaky_function(void) {
    int* data = (int*)malloc(1000 * sizeof(int));
    if (!data) return;

    return;
}

int main(void) {
    for (int i = 0; i < 1000000; i++) {
        leaky_function();
    }
    return 0;
}
```

```
  What happens:

  Iteration 1:  malloc → data = 0x1000  → return (no free!)
  Iteration 2:  malloc → data = 0x2000  → return (no free!)
  Iteration 3:  malloc → data = 0x3000  → return (no free!)
  ...
  Iteration N:  malloc → NULL (out of memory!)

  Each call allocates 4KB. After 1M calls = ~4GB leaked.
  Like renting storage units and losing the key each time.
```

**Rust prevents this:** `Box`, `Vec`, `String` all implement `Drop`.
When they go out of scope, memory is freed. In C, nothing happens.

## Use-After-Free — Visiting a Demolished House

```c
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int* p = (int*)malloc(sizeof(int));
    if (!p) return 1;

    *p = 42;
    printf("Before free: %d\n", *p);

    free(p);

    printf("After free: %d\n", *p);

    return 0;
}
```

This might print 42, or garbage, or crash. It's UB. The house was
demolished but the address still exists on your paper.

**Fix:** Set pointers to NULL after freeing:
```c
free(p);
p = NULL;
```

## Double Free — Demolishing Rubble

```c
int* p = (int*)malloc(sizeof(int));
free(p);
free(p);
```

The second `free` tries to demolish a house that's already gone.
Heap corruption, crashes, or security vulnerabilities.

## Buffer Overflow — Writing Past the Fence

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
    char* buffer = (char*)malloc(8);
    if (!buffer) return 1;

    strcpy(buffer, "This string is way too long for 8 bytes");

    printf("%s\n", buffer);
    free(buffer);
    return 0;
}
```

```
  Your allocation:    [........]  (8 bytes)
  What you wrote:     [This string is way too...]
                      ^^^^^^^^ yours
                              ^^^^^^^^^^^^^^^^^ someone else's memory!

  Like building an extension that goes into your neighbor's yard.
```

**ML context:** This is why PyTorch tensors track their sizes. A wrong
shape can write into adjacent tensor memory silently.

## Valgrind — The Memory Detective

Compile with debug symbols and run through Valgrind:

```bash
gcc -g -o leaky leaky.c
valgrind --leak-check=full ./leaky
```

Valgrind output looks like:
```
  ==12345== HEAP SUMMARY:
  ==12345==   in use at exit: 4,000,000 bytes in 1,000 blocks
  ==12345==   total heap usage: 1,000 allocs, 0 frees
  ==12345==
  ==12345== LEAK SUMMARY:
  ==12345==   definitely lost: 4,000,000 bytes in 1,000 blocks
```

## AddressSanitizer — Faster Alternative

```bash
gcc -fsanitize=address -g -o program program.c
./program
```

ASan catches buffer overflows, use-after-free, and double-free at
runtime with much less overhead than Valgrind.

## A Correct Dynamic Array

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    float* data;
    size_t len;
    size_t capacity;
} FloatVec;

FloatVec floatvec_new(void) {
    FloatVec v = {NULL, 0, 0};
    return v;
}

int floatvec_push(FloatVec* v, float val) {
    if (v->len == v->capacity) {
        size_t new_cap = v->capacity == 0 ? 4 : v->capacity * 2;
        float* new_data = (float*)realloc(v->data, new_cap * sizeof(float));
        if (!new_data) return -1;
        v->data = new_data;
        v->capacity = new_cap;
    }
    v->data[v->len++] = val;
    return 0;
}

void floatvec_free(FloatVec* v) {
    free(v->data);
    v->data = NULL;
    v->len = 0;
    v->capacity = 0;
}

int main(void) {
    FloatVec v = floatvec_new();

    for (int i = 0; i < 100; i++) {
        if (floatvec_push(&v, (float)i * 0.5f) != 0) {
            fprintf(stderr, "allocation failed\n");
            floatvec_free(&v);
            return 1;
        }
    }

    printf("len=%zu, cap=%zu\n", v.len, v.capacity);
    printf("first=%f, last=%f\n", v.data[0], v.data[v.len - 1]);

    floatvec_free(&v);
    return 0;
}
```

This is basically what `Vec<f32>` does in Rust — except Rust's version
calls `floatvec_free` automatically via `Drop`.

## What Rust Protects You From — Summary

```
  Bug                    Rust                 C
  ──────────────────     ──────────────────   ──────────────
  Memory leak            Drop trait           Your problem
  Use-after-free         Borrow checker       Your problem
  Double free            Ownership system     Your problem
  Buffer overflow        Bounds checking      Your problem
  Null dereference       Option<T>            Your problem
  Data races             Send/Sync traits     Your problem
  Dangling pointers      Lifetimes            Your problem
```

## Exercises

1. **Leak hunter:** Write a program that allocates a 2D matrix
   (`float**` with `malloc` for rows and each row). Free it correctly.
   Run with Valgrind to confirm zero leaks.

2. **Safe string:** Implement `char* safe_concat(const char* a, const char* b)`
   that allocates exactly the right amount of memory, copies both strings
   in, and returns the result. The caller must free it.

3. **Ring buffer:** Implement a fixed-size ring buffer using `malloc`.
   Support `push` and `pop`. Free all memory on destruction.

4. **ASan practice:** Write a program with an intentional buffer overflow.
   Compile with `-fsanitize=address` and read the error report.

5. **ML context:** Write a function `float* flatten_2d(float** matrix,
   int rows, int cols)` that allocates a new flat array and copies a 2D
   matrix into it in row-major order. Handle all allocation failures.

---

[Next: Lesson 04 — C++ Essentials →](04-cpp-essentials.md)
