# C++ Quick Reference for Rust Developers

## Types

```
  Rust            C               C++              Bytes
  ──────────      ──────────      ──────────       ─────
  i8              int8_t          int8_t           1
  u8              uint8_t         uint8_t          1
  i16             int16_t         int16_t          2
  i32             int32_t         int32_t          4
  i64             int64_t         int64_t          8
  f32             float           float            4
  f64             double          double           8
  bool            _Bool           bool             1
  usize           size_t          size_t           4/8
  char            char            char             1
  &str            const char*     std::string_view varies
  String          N/A             std::string      varies
```

## Pointers and References

```
  Rust                    C                   C++
  ────────────────        ────────────────    ────────────────
  &T                      const T*            const T& or const T*
  &mut T                  T*                  T& or T*
  *const T                const T*            const T*
  *mut T                  T*                  T*
  Box<T>                  N/A                 std::unique_ptr<T>
  Rc<T>                   N/A                 std::shared_ptr<T>
  Arc<T>                  N/A                 std::shared_ptr<T>
  Weak<T>                 N/A                 std::weak_ptr<T>
  Option<&T>              T* (NULL = none)    std::optional<T>
```

## Memory Management

```
  Rust                    C                   C++
  ────────────────        ────────────────    ────────────────
  Box::new(x)             malloc(sizeof(T))   std::make_unique<T>(x)
  (drop)                  free(ptr)           (destructor)
  Vec::new()              N/A                 std::vector<T>()
  vec.push(x)             N/A                 vec.push_back(x)
  Vec::with_capacity(n)   malloc(n*size)      vec.reserve(n)
  vec.len()               N/A                 vec.size()
  &vec[i]                 ptr + i             vec[i] / vec.at(i)
```

## Control Flow

```
  Rust                    C/C++
  ────────────────        ────────────────────────────
  if x > 0 { }           if (x > 0) { }
  if let Some(v) = x     if (auto v = x; v.has_value())  (C++17)
  match x { ... }         switch (x) { case 1: ...; break; }
  for i in 0..n           for (int i = 0; i < n; i++)
  for &x in &vec          for (const auto& x : vec)
  loop { }                while (true) { }
  while cond { }          while (cond) { }
  break / continue        break / continue
```

## Error Handling

```
  Rust                    C                   C++
  ────────────────        ────────────────    ────────────────
  Result<T, E>            return -1/NULL      throw exception
  Ok(v)                   return v            return v
  Err(e)                  return -1           throw runtime_error(e)
  x?                      if (x<0) return x   (auto-propagates)
  match result {          if (ret == -1) {    try { ... }
    Ok(v) => ...            handle error        catch (...) { ... }
    Err(e) => ...         }                   }
  }
  panic!()                abort()             std::terminate()
```

## Structs and Classes

```
  Rust                          C++
  ──────────────────────        ──────────────────────
  struct Foo {                  struct Foo {    // or class
      x: i32,                      int x;
      y: f64,                      double y;
  }                             };

  impl Foo {                    struct Foo {
      fn new(x: i32) -> Self        Foo(int x) : x(x), y(0) {}
      fn method(&self)              void method() const;
      fn mutate(&mut self)          void mutate();
  }                             };

  trait Bar {                   class Bar {
      fn do_thing(&self);       public:
  }                                 virtual void do_thing() = 0;
                                    virtual ~Bar() = default;
  impl Bar for Foo {            };
      fn do_thing(&self) {}     class Foo : public Bar {
  }                                 void do_thing() override {}
                                };
```

## Ownership and Lifetime Patterns

```
  Rust                          C++
  ──────────────────────        ──────────────────────
  let x = val;       (move)    auto x = std::move(val);
  let x = val.clone();(copy)   auto x = val;  (copy by default)
  &val                (borrow) const auto& ref = val;
  &mut val           (mut bor) auto& ref = val;
  'a lifetime        (compile) (no equivalent, be careful)
  Drop trait         (destr)   ~ClassName() destructor
```

## Common STL Containers

```
  Container                   Use When
  ─────────────────────       ────────────────────────────
  std::vector<T>              Default dynamic array
  std::array<T, N>            Fixed-size array
  std::string                 Text
  std::unordered_map<K,V>     Hash map (fast lookup)
  std::map<K,V>               Sorted map (ordered iteration)
  std::unordered_set<T>       Hash set
  std::set<T>                 Sorted set
  std::deque<T>               Double-ended queue
  std::queue<T>               FIFO queue
  std::stack<T>               LIFO stack
  std::optional<T>            Maybe a value (C++17)
  std::variant<A,B,C>         Tagged union / enum (C++17)
  std::tuple<A,B,C>           Product type
  std::pair<A,B>              Two values
```

## Common Algorithms

```
  #include <algorithm>
  #include <numeric>

  std::sort(v.begin(), v.end());
  std::sort(v.begin(), v.end(), std::greater<>());
  std::reverse(v.begin(), v.end());
  std::find(v.begin(), v.end(), target);
  std::count(v.begin(), v.end(), target);
  std::count_if(v.begin(), v.end(), pred);
  std::accumulate(v.begin(), v.end(), 0.0f);
  std::transform(v.begin(), v.end(), out.begin(), func);
  std::copy_if(v.begin(), v.end(), back_inserter(out), pred);
  std::min_element(v.begin(), v.end());
  std::max_element(v.begin(), v.end());
  std::fill(v.begin(), v.end(), value);
  std::iota(v.begin(), v.end(), start);  // 0,1,2,3,...
```

## Smart Pointer Usage

```cpp
auto p = std::make_unique<MyClass>(args);
auto p = std::make_shared<MyClass>(args);

p->method();
*p;
p.get();
p.reset();
if (p) { ... }

std::unique_ptr<MyClass> p2 = std::move(p);
std::shared_ptr<MyClass> p3 = p_shared;
```

## Lambda Syntax

```
  [capture](params) -> return_type { body }

  []()       { }     // capture nothing
  [x]()     { }     // capture x by copy
  [&x]()    { }     // capture x by reference
  [=]()     { }     // capture all by copy
  [&]()     { }     // capture all by reference
  [this]()  { }     // capture this pointer
```

## Templates

```cpp
template<typename T>
T max_val(T a, T b) {
    return a > b ? a : b;
}

template<typename T, int N>
struct FixedArray {
    T data[N];
    T& operator[](int i) { return data[i]; }
};
```

## Compiler Commands

```bash
# C
gcc -std=c11 -Wall -Wextra -O2 -o prog prog.c
gcc -g -fsanitize=address -o prog prog.c

# C++
g++ -std=c++17 -Wall -Wextra -O2 -o prog prog.cpp
g++ -g -fsanitize=address -o prog prog.cpp

# CUDA
nvcc -std=c++17 -O2 -o prog prog.cu

# With CMake
mkdir build && cd build && cmake .. && make -j$(nproc)
```

## Preprocessor

```
  #include <header>       System header
  #include "header"       Local header
  #define NAME value      Constant
  #define MACRO(x) ((x)*2) Function-like macro
  #ifdef / #ifndef        Conditional compilation
  #pragma once            Include guard (non-standard but universal)
```

## Common Header Includes

```
  <cstdio>       printf, fprintf, sprintf
  <cstdlib>      malloc, free, exit, atoi
  <cstring>      memcpy, memset, strlen, strcmp
  <cmath>        sqrt, exp, log, sin, cos
  <cassert>      assert()
  <stdint.h>     int32_t, uint64_t, etc.

  <vector>       std::vector
  <string>       std::string
  <map>          std::map
  <unordered_map> std::unordered_map
  <memory>       unique_ptr, shared_ptr
  <algorithm>    sort, find, transform
  <numeric>      accumulate, iota
  <iostream>     std::cout, std::cin
  <fstream>      file I/O
  <chrono>       timing
  <functional>   std::function
  <optional>     std::optional (C++17)
  <variant>      std::variant (C++17)
```
