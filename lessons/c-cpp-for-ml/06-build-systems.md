# Lesson 06 — Build Systems

> **Analogy:** A build system is a recipe book for your compiler.
> A Makefile says "to make the cake (binary), first mix the flour (compile
> source A), then add eggs (compile source B), then bake (link)."
> CMake is the recipe book that generates other recipe books.

## The Compilation Pipeline

```
  Source Files          Compilation           Linking            Executable
  ════════════          ═══════════           ═══════            ══════════

  main.cpp ──┐
             ├──> gcc -c ──> main.o ──┐
  math.cpp ──┘                        ├──> gcc -o program ──> ./program
             ┌──> gcc -c ──> math.o ──┘
  math.cpp ──┘

  Step 1: Preprocess (#include, #define)
  Step 2: Compile (.cpp → .o object files)
  Step 3: Link (.o files → executable)

  Rust equivalent: cargo build handles ALL of this for you.
  C/C++: you manage it yourself (or use CMake).
```

```
  Rust                          C/C++
  ──────────────────────        ──────────────────────
  Cargo.toml                    CMakeLists.txt / Makefile
  cargo build                   cmake --build . / make
  cargo run                     ./build/program
  cargo test                    ctest / ./build/test
  crate                         library (.a / .so / .dylib)
```

## Manual Compilation

```bash
# Single file
g++ -std=c++17 -Wall -Wextra -O2 -o hello hello.cpp

# Multiple files
g++ -std=c++17 -Wall -c main.cpp -o main.o
g++ -std=c++17 -Wall -c math.cpp -o math.o
g++ main.o math.o -o program
```

```
  Flag        Meaning
  ─────────   ──────────────────────────────────
  -std=c++17  Use C++17 standard
  -Wall       Enable common warnings
  -Wextra     Enable extra warnings
  -O2         Optimization level 2
  -g          Include debug symbols
  -c          Compile only (don't link)
  -o name     Output file name
  -I path     Add include search path
  -L path     Add library search path
  -l name     Link library (e.g., -lm for math)
```

## Makefiles — Automating the Recipe

```
  A Makefile defines:
  1. TARGETS  (what to build)
  2. DEPENDENCIES  (what it needs)
  3. RECIPES  (how to build it)

  target: dependencies
      recipe (must use TAB, not spaces!)
```

Create a file called `Makefile`:

```makefile
CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2
LDFLAGS =

SRCS = main.cpp math.cpp utils.cpp
OBJS = $(SRCS:.cpp=.o)
TARGET = program

$(TARGET): $(OBJS)
	$(CXX) $(LDFLAGS) -o $@ $^

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $<

clean:
	rm -f $(OBJS) $(TARGET)

.PHONY: clean
```

```bash
make            # Build the program
make clean      # Remove build artifacts
make -j4        # Build with 4 parallel jobs
```

```
  How Make decides what to rebuild:

  main.cpp ──modified──> main.o needs rebuild ──> program needs relink
  math.cpp ──unchanged─> math.o is fine       ─┘

  Make checks file timestamps. Only rebuilds what changed.
  Like Rust's incremental compilation, but manual.
```

## CMake — The Recipe Book Generator

```
  CMake doesn't build your code directly.
  It generates build files for other tools:

  CMakeLists.txt ──> cmake ──┬──> Makefile (Linux/Mac)
                             ├──> Ninja build files
                             └──> Visual Studio project (Windows)

  Think of CMake as a meta-build system.
  cargo is both the meta-build and the build tool.
```

### Basic CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.16)
project(ml_kernels LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(main
    src/main.cpp
    src/math.cpp
    src/utils.cpp
)

target_include_directories(main PRIVATE include)
target_compile_options(main PRIVATE -Wall -Wextra)
```

### Project Structure

```
  my_project/
  ├── CMakeLists.txt
  ├── include/
  │   ├── math.h
  │   └── utils.h
  ├── src/
  │   ├── main.cpp
  │   ├── math.cpp
  │   └── utils.cpp
  └── build/          (generated, gitignored)
      ├── Makefile
      └── main
```

```bash
mkdir build && cd build
cmake ..
make -j$(nproc)
./main
```

## Libraries — Static and Shared

```
  STATIC LIBRARY (.a on Unix, .lib on Windows)
  ═══════════════════════════════════════════
  Code is COPIED into the final binary at link time.
  Like photocopying a chapter and binding it into your book.

  math.o + utils.o ──> ar ──> libmymath.a
  main.o + libmymath.a ──> linker ──> program (self-contained)

  SHARED LIBRARY (.so on Linux, .dylib on Mac, .dll on Windows)
  ═══════════════════════════════════════════
  Code lives in a separate file, loaded at runtime.
  Like referencing a library book — everyone shares one copy.

  math.o + utils.o ──> g++ -shared ──> libmymath.so
  main.o + libmymath.so ──> linker ──> program (needs .so at runtime)
```

### CMake Library Example

```cmake
cmake_minimum_required(VERSION 3.16)
project(ml_lib LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)

add_library(mlops STATIC
    src/tensor.cpp
    src/activation.cpp
)
target_include_directories(mlops PUBLIC include)

add_library(mlops_shared SHARED
    src/tensor.cpp
    src/activation.cpp
)
target_include_directories(mlops_shared PUBLIC include)

add_executable(train src/main.cpp)
target_link_libraries(train PRIVATE mlops)
```

```bash
mkdir build && cd build
cmake ..
make -j$(nproc)
ls -la libmlops.a libmlops_shared.so  # or .dylib on Mac
```

## Finding External Libraries

```cmake
find_package(OpenMP REQUIRED)
find_package(Threads REQUIRED)

add_executable(train src/main.cpp)
target_link_libraries(train PRIVATE OpenMP::OpenMP_CXX Threads::Threads)
```

## CMake for CUDA (Preview for Lesson 07)

```cmake
cmake_minimum_required(VERSION 3.18)
project(gpu_kernels LANGUAGES CXX CUDA)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CUDA_STANDARD 17)

add_executable(matmul
    src/main.cpp
    src/matmul.cu
)

set_target_properties(matmul PROPERTIES
    CUDA_SEPARABLE_COMPILATION ON
    CUDA_ARCHITECTURES "70;80;86"
)
```

## pkg-config — Finding Installed Libraries

```bash
pkg-config --cflags --libs opencv4
# Output: -I/usr/include/opencv4 -lopencv_core -lopencv_imgproc ...
```

In a Makefile:
```makefile
CXXFLAGS += $(shell pkg-config --cflags opencv4)
LDFLAGS += $(shell pkg-config --libs opencv4)
```

## Compiler Explorer — Quick Testing

For quick experiments without setting up a build system, use
[godbolt.org](https://godbolt.org). Paste code, see assembly, share links.

## Common Build Errors and Fixes

```
  Error                         Fix
  ═══════════════════           ═══════════════════════════════
  "undefined reference to"      Missing .o file or library in link step
  "cannot find -lfoo"           Library not installed or wrong -L path
  "no such file: foo.h"         Missing -I include path
  "multiple definition"         Function defined in .h (use inline)
  "DSO missing from cmd line"   Add library to target_link_libraries
```

```
  Rust                          C++
  ──────────────────            ──────────────────
  cargo build → error           cmake + make → error
  "use of undeclared crate"     "cannot find -lfoo"
  "unresolved import"           "no such file: foo.h"
  Error messages are clear.     Error messages are cryptic novels.
```

## Exercises

1. **Makefile:** Create a project with 3 source files and a Makefile.
   Add `debug` and `release` targets with different optimization flags.

2. **CMake project:** Create a CMake project with a static library
   (`libml.a`) containing `tensor.cpp` and `activation.cpp`, and a
   `main` executable that links against it.

3. **Shared library:** Modify exercise 2 to also build a shared library.
   Use `ldd` (Linux) or `otool -L` (Mac) to see the runtime dependency.

4. **External dependency:** Write a CMake project that finds and links
   against pthreads. Create a simple multi-threaded program.

5. **CUDA skeleton:** Write a CMakeLists.txt that compiles both `.cpp`
   and `.cu` files. You don't need a GPU — just verify it configures
   correctly with `cmake ..` (install CUDA toolkit first, or skip if
   no GPU available).

---

[Next: Lesson 07 — CUDA Fundamentals →](07-cuda-fundamentals.md)
