# Lesson 04 — C++ Essentials

> **Analogy:** If C is a manual-transmission car with no safety features,
> C++ is the same car after 40 years of aftermarket upgrades. It has
> automatic wipers (RAII), cruise control (smart pointers), a turbo
> (templates), and a GPS (STL). But the original engine is still there,
> and you can still drive off a cliff if you want.

## C++ for Rust Developers — Mental Map

```
  Rust Feature              C++ Equivalent
  ════════════════════      ════════════════════════════
  Ownership + Drop          RAII + Destructors
  Box<T>                    std::unique_ptr<T>
  Rc<T>                     std::shared_ptr<T>
  Arc<T>                    std::shared_ptr<T> (thread-safe refcount)
  std::move                 std::move (similar but not identical)
  Traits                    Virtual classes / Concepts (C++20)
  Generics                  Templates
  enum (algebraic)          std::variant (C++17)
  Result<T,E>               std::expected (C++23) or exceptions
  match                     std::visit / if constexpr
```

## Classes — Structs with Methods

```cpp
#include <cstdio>
#include <cstring>
#include <cstdlib>

class Tensor {
public:
    float* data;
    int rows;
    int cols;

    Tensor(int r, int c) : data(nullptr), rows(r), cols(c) {
        data = new float[r * c]();
    }

    ~Tensor() {
        delete[] data;
    }

    float& at(int r, int c) {
        return data[r * cols + c];
    }

    void print() const {
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                printf("%.2f ", data[i * cols + j]);
            }
            printf("\n");
        }
    }
};

int main() {
    Tensor t(2, 3);
    t.at(0, 0) = 1.0f;
    t.at(1, 2) = 5.0f;
    t.print();
    return 0;
}
```

```bash
g++ -std=c++17 -Wall -o tensor tensor.cpp && ./tensor
```

## RAII — The Destructor Pattern

```
  RAII = Resource Acquisition Is Initialization

  Rust:                         C++:
  {                             {
      let v = Vec::new();           std::vector<int> v;
      v.push(1);                    v.push_back(1);
  }                             }
  // Drop::drop called          // ~vector() called
  // memory freed               // memory freed

  Same idea, different mechanism.
  Rust: Drop trait              C++: Destructor (~ClassName)
```

```cpp
#include <cstdio>

class FileHandle {
    FILE* fp;
public:
    FileHandle(const char* path, const char* mode) : fp(nullptr) {
        fp = fopen(path, mode);
    }

    ~FileHandle() {
        if (fp) {
            fclose(fp);
            printf("File closed automatically\n");
        }
    }

    bool is_valid() const { return fp != nullptr; }

    void write(const char* text) {
        if (fp) fprintf(fp, "%s", text);
    }
};

int main() {
    FileHandle f("test.txt", "w");
    if (!f.is_valid()) return 1;
    f.write("Hello RAII\n");
    return 0;
}
```

## Smart Pointers — Automated Ownership

### unique_ptr (like Box<T>)

```
  unique_ptr: ONE owner. When it dies, the object dies.

  ┌──────────────┐         ┌──────────┐
  │ unique_ptr<T> │ ------> │ T on heap│
  └──────────────┘         └──────────┘
       sole owner           freed when ptr dies
```

```cpp
#include <memory>
#include <cstdio>

struct Layer {
    const char* name;
    int units;

    Layer(const char* n, int u) : name(n), units(u) {
        printf("Layer %s created\n", name);
    }

    ~Layer() {
        printf("Layer %s destroyed\n", name);
    }
};

int main() {
    auto fc1 = std::make_unique<Layer>("fc1", 512);
    printf("Units: %d\n", fc1->units);

    auto fc2 = std::move(fc1);
    printf("fc1 is now null: %s\n", fc1 ? "no" : "yes");
    printf("fc2 name: %s\n", fc2->name);

    return 0;
}
```

### shared_ptr (like Rc<T> / Arc<T>)

```
  shared_ptr: MANY owners. Object dies when last owner dies.

  ┌──────────────┐
  │ shared_ptr A  │──┐
  └──────────────┘  │    ┌──────────────┐
                    ├──> │ T on heap    │
  ┌──────────────┐  │    │ refcount: 2  │
  │ shared_ptr B  │──┘    └──────────────┘
  └──────────────┘
```

```cpp
#include <memory>
#include <cstdio>

struct Weights {
    float* data;
    int size;

    Weights(int n) : data(new float[n]()), size(n) {
        printf("Weights allocated (%d floats)\n", n);
    }

    ~Weights() {
        delete[] data;
        printf("Weights freed\n");
    }
};

int main() {
    auto w = std::make_shared<Weights>(1024);
    printf("refcount: %ld\n", w.use_count());

    {
        auto w2 = w;
        printf("refcount: %ld\n", w.use_count());
    }

    printf("refcount: %ld\n", w.use_count());
    return 0;
}
```

## Move Semantics — Transfer, Don't Copy

```
  COPY:   Make a duplicate of everything.
          Like photocopying a 100-page document.

  MOVE:   Hand over the original. Source becomes empty.
          Like giving someone your notebook.

  Rust:   Move is the DEFAULT. Copy requires #[derive(Copy)].
  C++:    Copy is the DEFAULT. Move requires std::move().
```

```cpp
#include <vector>
#include <cstdio>
#include <utility>

int main() {
    std::vector<float> weights(1000000, 1.0f);
    printf("weights size: %zu\n", weights.size());

    std::vector<float> transferred = std::move(weights);
    printf("transferred size: %zu\n", transferred.size());
    printf("weights size after move: %zu\n", weights.size());

    return 0;
}
```

## References — C++'s Safer Pointers

```
  C pointer:     int* p = &x;    (can be NULL, can be reseated)
  C++ reference: int& r = x;     (never NULL, never reseated)
  Rust reference: let r = &x;    (like C++ reference + lifetime)
```

```cpp
#include <cstdio>

void scale(float& value, float factor) {
    value *= factor;
}

void print_array(const float* data, int n) {
    for (int i = 0; i < n; i++) {
        printf("%.1f ", data[i]);
    }
    printf("\n");
}

int main() {
    float x = 3.14f;
    scale(x, 2.0f);
    printf("x = %.2f\n", x);
    return 0;
}
```

## Templates — Compile-Time Generics

```
  Rust generics:           C++ templates:
  fn add<T: Add>(a: T)    template<typename T>
                           T add(T a, T b)

  Both generate code for each type at compile time.
  C++ templates are more powerful (and more dangerous).
```

```cpp
#include <cstdio>

template<typename T>
T clamp(T value, T low, T high) {
    if (value < low) return low;
    if (value > high) return high;
    return value;
}

template<typename T>
void fill(T* arr, int n, T value) {
    for (int i = 0; i < n; i++) {
        arr[i] = value;
    }
}

int main() {
    printf("clamp(15, 0, 10) = %d\n", clamp(15, 0, 10));
    printf("clamp(3.14, 0.0, 1.0) = %.2f\n", clamp(3.14, 0.0, 1.0));

    float data[5];
    fill(data, 5, 0.0f);
    for (int i = 0; i < 5; i++) printf("%.1f ", data[i]);
    printf("\n");

    return 0;
}
```

## Namespaces — Organizing Code

```cpp
#include <cstdio>

namespace nn {
    struct Linear {
        int in_features;
        int out_features;
    };

    Linear create(int in_f, int out_f) {
        return {in_f, out_f};
    }
}

int main() {
    auto layer = nn::create(784, 256);
    printf("Linear(%d, %d)\n", layer.in_features, layer.out_features);
    return 0;
}
```

```
  Rust:   mod nn { pub struct Linear {...} }
  C++:    namespace nn { struct Linear {...}; }
```

## Exceptions vs Result Types

```
  C++: throw/catch (default error handling)
  Rust: Result<T, E> (no exceptions)

  PyTorch C++ internals use BOTH:
  - Exceptions for programmer errors
  - Status codes for runtime errors
```

```cpp
#include <stdexcept>
#include <cstdio>

float safe_divide(float a, float b) {
    if (b == 0.0f) {
        throw std::runtime_error("division by zero");
    }
    return a / b;
}

int main() {
    try {
        printf("10 / 3 = %.2f\n", safe_divide(10.0f, 3.0f));
        printf("10 / 0 = %.2f\n", safe_divide(10.0f, 0.0f));
    } catch (const std::runtime_error& e) {
        printf("Error: %s\n", e.what());
    }
    return 0;
}
```

## Exercises

1. **RAII practice:** Write a `GPUBuffer` class that allocates memory in
   the constructor and frees it in the destructor. Verify no leaks with
   Valgrind.

2. **Smart pointers:** Rewrite the `Tensor` class to use `unique_ptr<float[]>`
   instead of raw `new/delete`. Implement move constructor and move
   assignment.

3. **Templates:** Write a `template<typename T> class Matrix` with
   `at(row, col)`, `fill(value)`, and `print()`. Test with `float`,
   `double`, and `int`.

4. **Shared weights:** Create a `Layer` class where multiple layers can
   share the same `shared_ptr<Weights>`. Print reference counts as you
   add and remove layers.

5. **Namespace design:** Design a `namespace ml` with sub-namespaces
   `ml::nn`, `ml::optim`, and `ml::data`. Put at least one class in each.

---

[Next: Lesson 05 — STL Containers →](05-stl-containers.md)
