# Lesson 01 — C for Rust Devs

> **Analogy:** Rust is driving with seatbelts, airbags, and lane-assist.
> C is the same car with all safety features ripped out. Same engine,
> same road — you just feel every bump.

## Rust vs C Mental Model

```
  Rust                              C
  +---------------------------+     +---------------------------+
  | Compiler checks lifetimes |     | You check everything      |
  | Borrow checker at compile |     | No borrow checker at all  |
  | RAII drops automatically  |     | You call free() manually  |
  | No null (Option<T>)      |     | NULL everywhere           |
  | No UB in safe code       |     | UB is a way of life       |
  +---------------------------+     +---------------------------+
```

## Your First C Program

```c
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int x = 42;
    printf("Hello from C: %d\n", x);
    return 0;
}
```

Compile and run:
```bash
gcc -Wall -Wextra -o hello hello.c && ./hello
```

### Mapping to Rust

```
  Rust                          C
  ─────────────────────────     ─────────────────────────
  fn main() {                   int main(void) {
  let x: i32 = 42;             int x = 42;
  println!("{}", x);            printf("%d\n", x);
  }                             return 0; }
```

## Types — Familiar but Dangerous

```
  Rust            C               Size (typical)
  ──────────      ──────────      ──────────────
  i8              char            1 byte
  i32             int             4 bytes
  i64             long long       8 bytes
  f32             float           4 bytes
  f64             double          8 bytes
  bool            _Bool / int     1 byte / 4 bytes
  usize           size_t          platform-dependent
  *const T        const T*        pointer size
  *mut T          T*              pointer size
```

**The trap:** C's `int` is not guaranteed to be 32 bits. Use `<stdint.h>` for
exact sizes: `int32_t`, `uint64_t`, etc.

```c
#include <stdint.h>
#include <stdio.h>

int main(void) {
    int32_t precise = 42;
    uint64_t big = 18446744073709551615ULL;
    printf("precise: %d, big: %lu\n", precise, big);
    return 0;
}
```

## Functions — No Generics, No Traits

```c
#include <stdio.h>

double add(double a, double b) {
    return a + b;
}

void greet(const char* name) {
    printf("Hello, %s\n", name);
}

int main(void) {
    double result = add(3.14, 2.71);
    printf("Sum: %f\n", result);
    greet("ML Engineer");
    return 0;
}
```

In Rust you'd use `&str`. In C, `const char*` is a pointer to a
null-terminated array of bytes. No length info. No bounds checking.

```
  Rust &str:     [ ptr | len ]       "knows its length"
  C char*:       [ ptr ] --> H e l l o \0
                                     "walks until \0"
```

## Structs — No Methods, No Traits

```c
#include <stdio.h>

typedef struct {
    float* data;
    int rows;
    int cols;
} Matrix;

void matrix_print_shape(const Matrix* m) {
    printf("Matrix(%d, %d)\n", m->rows, m->cols);
}

int main(void) {
    float data[] = {1.0f, 2.0f, 3.0f, 4.0f};
    Matrix m = {data, 2, 2};
    matrix_print_shape(&m);
    return 0;
}
```

```
  Rust                              C
  ──────────────────────────        ──────────────────────────
  impl Matrix {                     No impl blocks.
      fn shape(&self) -> ...        Free functions that take
  }                                 a pointer to the struct.
  m.shape()                         matrix_print_shape(&m)
```

## Control Flow — Almost Identical

```c
#include <stdio.h>

int main(void) {
    int n = 10;

    if (n > 5) {
        printf("big\n");
    } else {
        printf("small\n");
    }

    for (int i = 0; i < n; i++) {
        printf("%d ", i);
    }
    printf("\n");

    while (n > 0) {
        n--;
    }

    return 0;
}
```

**Key difference:** C's `if` takes an int, not a bool. Zero is false,
everything else is true. This compiles fine and is a classic bug source:

```c
if (x = 5) {  /* ASSIGNMENT, not comparison! Always true. */
}
```

## Undefined Behavior — The Big Difference

In Rust, safe code cannot trigger UB. In C, you can trigger UB in one line:

```c
#include <stdio.h>

int main(void) {
    int arr[3] = {10, 20, 30};
    printf("%d\n", arr[5]);   /* UB: out of bounds */

    int x = 2147483647;
    x = x + 1;               /* UB: signed integer overflow */

    int* p = NULL;
    *p = 42;                  /* UB: null pointer dereference */

    return 0;
}
```

```
  What the compiler does with UB:

  +------------------+
  | Your code has UB |
  +--------+---------+
           |
           v
  +------------------+
  | ANYTHING can     |
  | happen. Crash,   |
  | wrong answer,    |
  | works "fine",    |
  | formats disk.*   |
  +------------------+

  * Technically allowed by the spec.
```

## Header Files — C's Module System

```
  Rust                              C
  ──────────────────────────        ──────────────────────────
  mod math;                         #include "math.h"
  pub fn add(...)                   Declaration in .h file
  (compiler resolves)               Definition in .c file
                                    Linker glues them together
```

**math.h** — declarations only:
```c
#ifndef MATH_H
#define MATH_H

double add(double a, double b);
double multiply(double a, double b);

#endif
```

**math.c** — definitions:
```c
#include "math.h"

double add(double a, double b) {
    return a + b;
}

double multiply(double a, double b) {
    return a * b;
}
```

**main.c:**
```c
#include <stdio.h>
#include "math.h"

int main(void) {
    printf("%f\n", add(1.0, 2.0));
    return 0;
}
```

```bash
gcc -Wall -o program main.c math.c && ./program
```

## The Preprocessor — Text Substitution

C has a text-processing step before compilation. Rust has macros but
nothing like `#define`.

```c
#include <stdio.h>

#define MAX_LAYERS 128
#define SQUARE(x) ((x) * (x))

int main(void) {
    printf("Max layers: %d\n", MAX_LAYERS);
    printf("5 squared: %d\n", SQUARE(5));
    printf("Bug: %d\n", SQUARE(2 + 3));
    return 0;
}
```

`SQUARE(2 + 3)` expands to `((2 + 3) * (2 + 3))` = 25.
Without the parens it would be `2 + 3 * 2 + 3` = 11. Classic trap.

## Exercises

1. **Type exploration:** Write a program that prints `sizeof(int)`,
   `sizeof(long)`, `sizeof(float)`, `sizeof(double)`, `sizeof(void*)`
   on your machine.

2. **Struct practice:** Define a `Tensor` struct with `float* data`,
   `int ndim`, and `int shape[4]`. Write a function `tensor_numel` that
   returns the total number of elements.

3. **UB hunt:** The following code has 3 UB instances. Find them all:
   ```c
   int main(void) {
       int a[3] = {1, 2, 3};
       int b = a[3];
       int c;
       int d = c + 1;
       int* p = 0;
       int e = *p;
       return 0;
   }
   ```

4. **Header files:** Split a "vector math" library into `vec.h` and
   `vec.c` with functions `vec_dot` and `vec_norm`. Use them from `main.c`.

---

[Next: Lesson 02 — Pointers Deep Dive →](02-pointers-deep-dive.md)
