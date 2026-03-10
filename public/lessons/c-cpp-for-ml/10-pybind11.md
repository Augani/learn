# Lesson 10 — pybind11

> **Analogy:** pybind11 is a translator who sits between C++ and Python.
> C++ speaks fast but in a strict language. Python speaks slowly but
> everyone understands it. pybind11 translates in real-time, handling
> type conversions, memory layout, and error mapping so both sides
> understand each other perfectly.

## Why pybind11?

```
  Python                           C++
  ┌──────────────────┐            ┌──────────────────┐
  │ Easy to write    │            │ Fast execution    │
  │ NumPy ecosystem  │  pybind11  │ GPU access (CUDA) │
  │ PyTorch frontend │ <========> │ Low-level control │
  │ Slow inner loops │            │ Hard to prototype │
  └──────────────────┘            └──────────────────┘

  pybind11 lets you:
  1. Write performance-critical code in C++
  2. Call it from Python like a normal function
  3. Pass NumPy arrays directly (zero-copy!)
```

```
  Rust equivalent: PyO3
  pybind11 : C++ :: PyO3 : Rust
```

## Setup

```bash
pip install pybind11
```

## Your First Binding

**example.cpp:**
```cpp
#include <pybind11/pybind11.h>

namespace py = pybind11;

double add(double a, double b) {
    return a + b;
}

int factorial(int n) {
    if (n < 0) throw std::invalid_argument("n must be >= 0");
    if (n <= 1) return 1;
    int result = 1;
    for (int i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

PYBIND11_MODULE(example, m) {
    m.doc() = "Example module";
    m.def("add", &add, "Add two numbers",
          py::arg("a"), py::arg("b"));
    m.def("factorial", &factorial, "Compute factorial",
          py::arg("n"));
}
```

### Build and Use

```bash
c++ -O3 -Wall -shared -std=c++17 -fPIC \
    $(python3 -m pybind11 --includes) \
    example.cpp -o example$(python3-config --extension-suffix)
```

```python
import example
print(example.add(1.5, 2.5))
print(example.factorial(10))
```

## NumPy Integration — Zero-Copy Arrays

```
  NumPy array in memory:
  ┌──────────────────────────────────────┐
  │ ndarray object                       │
  │  .data ──> [1.0][2.0][3.0][4.0]     │
  │  .shape = (4,)                       │
  │  .dtype = float64                    │
  └──────────────────────────────────────┘

  pybind11 gives C++ a pointer to the SAME data.
  No copy. No conversion. Just a typed view.

  ┌────────────┐         ┌──────────────────┐
  │ Python     │         │ C++              │
  │ np.array   │ ──ptr──>│ py::array_t<T>   │
  │            │         │ accesses same mem│
  └────────────┘         └──────────────────┘
```

```cpp
#include <pybind11/pybind11.h>
#include <pybind11/numpy.h>
#include <cmath>

namespace py = pybind11;

py::array_t<float> relu(py::array_t<float> input) {
    auto buf = input.request();
    if (buf.ndim != 1) {
        throw std::runtime_error("Expected 1D array");
    }

    auto result = py::array_t<float>(buf.size);
    auto result_buf = result.request();

    float* in_ptr = static_cast<float*>(buf.ptr);
    float* out_ptr = static_cast<float*>(result_buf.ptr);

    for (ssize_t i = 0; i < buf.size; i++) {
        out_ptr[i] = in_ptr[i] > 0 ? in_ptr[i] : 0;
    }

    return result;
}

void scale_inplace(py::array_t<float> arr, float factor) {
    auto buf = arr.mutable_unchecked<1>();
    for (ssize_t i = 0; i < buf.shape(0); i++) {
        buf(i) *= factor;
    }
}

PYBIND11_MODULE(mlops, m) {
    m.def("relu", &relu, "ReLU activation");
    m.def("scale_inplace", &scale_inplace, "Scale array in-place");
}
```

```python
import numpy as np
import mlops

x = np.array([-1.0, 0.5, -0.3, 2.0], dtype=np.float32)
print(mlops.relu(x))

mlops.scale_inplace(x, 2.0)
print(x)
```

## Binding Classes

```cpp
#include <pybind11/pybind11.h>
#include <pybind11/numpy.h>
#include <pybind11/stl.h>
#include <vector>
#include <cstdio>

namespace py = pybind11;

class Tensor {
    std::vector<float> data_;
    std::vector<int> shape_;

public:
    Tensor(std::vector<int> shape) : shape_(shape) {
        int total = 1;
        for (int s : shape_) total *= s;
        data_.resize(total, 0.0f);
    }

    void fill(float value) {
        for (auto& d : data_) d = value;
    }

    float get(int idx) const {
        if (idx < 0 || idx >= (int)data_.size()) {
            throw std::out_of_range("Index out of bounds");
        }
        return data_[idx];
    }

    void set(int idx, float value) {
        if (idx < 0 || idx >= (int)data_.size()) {
            throw std::out_of_range("Index out of bounds");
        }
        data_[idx] = value;
    }

    int numel() const { return data_.size(); }
    std::vector<int> shape() const { return shape_; }

    py::array_t<float> numpy() {
        return py::array_t<float>(
            {(ssize_t)data_.size()},
            {sizeof(float)},
            data_.data(),
            py::cast(this)
        );
    }
};

PYBIND11_MODULE(tensor_lib, m) {
    py::class_<Tensor>(m, "Tensor")
        .def(py::init<std::vector<int>>())
        .def("fill", &Tensor::fill)
        .def("get", &Tensor::get)
        .def("set", &Tensor::set)
        .def("numel", &Tensor::numel)
        .def("shape", &Tensor::shape)
        .def("numpy", &Tensor::numpy)
        .def("__repr__", [](const Tensor& t) {
            auto s = t.shape();
            std::string repr = "Tensor(shape=[";
            for (size_t i = 0; i < s.size(); i++) {
                if (i > 0) repr += ", ";
                repr += std::to_string(s[i]);
            }
            repr += "])";
            return repr;
        });
}
```

```python
from tensor_lib import Tensor

t = Tensor([3, 4])
t.fill(1.0)
t.set(5, 99.0)
print(t)
print(f"numel: {t.numel()}, shape: {t.shape()}")
arr = t.numpy()
print(arr)
```

## Using setup.py / CMake

**setup.py:**
```python
from pybind11.setup_helpers import Pybind11Extension, build_ext
from setuptools import setup

ext_modules = [
    Pybind11Extension(
        "mlops",
        ["src/mlops.cpp"],
        extra_compile_args=["-O3"],
    ),
]

setup(
    name="mlops",
    ext_modules=ext_modules,
    cmdclass={"build_ext": build_ext},
)
```

```bash
pip install -e .
```

### CMake Alternative

```cmake
cmake_minimum_required(VERSION 3.16)
project(mlops LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)

find_package(pybind11 REQUIRED)
pybind11_add_module(mlops src/mlops.cpp)
```

## Error Handling — C++ Exceptions Become Python Exceptions

```
  C++ Exception                     Python Exception
  ═══════════════                   ═════════════════
  std::runtime_error         →      RuntimeError
  std::invalid_argument      →      ValueError
  std::out_of_range          →      IndexError
  std::domain_error          →      ValueError
  std::bad_alloc             →      MemoryError
```

```cpp
void validate_shape(int rows, int cols) {
    if (rows <= 0 || cols <= 0) {
        throw std::invalid_argument("Shape dimensions must be positive");
    }
    if ((long long)rows * cols > 1000000000LL) {
        throw std::runtime_error("Tensor too large");
    }
}
```

## STL Type Conversions

```
  Include <pybind11/stl.h> for automatic conversions:

  C++                          Python
  ═══════════════              ═══════════════
  std::vector<T>          ↔    list
  std::map<K,V>           ↔    dict
  std::set<T>             ↔    set
  std::pair<A,B>          ↔    tuple
  std::optional<T>        ↔    Optional[T]
  std::string             ↔    str
```

## Exercises

1. **Basic module:** Create a pybind11 module with `dot_product(a, b)`
   and `l2_norm(a)` that operate on NumPy float32 arrays. Benchmark
   against pure NumPy versions.

2. **Matrix class:** Bind a C++ `Matrix` class with `__init__`, `at(r,c)`,
   `fill`, `transpose`, and `__repr__`. Return a NumPy view from a
   `to_numpy()` method.

3. **Batch normalization:** Implement batch normalization in C++ (compute
   mean, variance, normalize) and bind it. Compare speed with a NumPy
   implementation for 1M elements.

4. **Enum and config:** Bind a C++ enum `ActivationType {RELU, SIGMOID,
   TANH}` and a config struct. Create a Python-friendly API:
   `apply_activation(array, ActivationType.RELU)`.

5. **Error handling:** Write a bound function that validates tensor shapes
   and raises appropriate Python exceptions for invalid inputs. Test all
   error paths from Python.

---

[Next: Lesson 11 — Custom PyTorch Ops →](11-custom-pytorch-ops.md)
