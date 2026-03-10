# C/C++ for ML Engineers — Track Roadmap

> You know Rust and Python. Now learn just enough C/C++ to understand
> what's under PyTorch, write CUDA kernels, and build Python extensions.

```
  YOU ARE HERE
       |
       v
  +============+     +============+     +============+
  |  C & C++   | --> |    CUDA    | --> | Integration|
  |  Basics    |     | Programming|     | & Capstone |
  +============+     +============+     +============+
   Lessons 1-6        Lessons 7-9       Lessons 10-14
```

## Why This Track Exists

If you've trained a model in PyTorch, you've already run millions of lines
of C++ and CUDA. This track pulls back the curtain.

Think of it like being a race-car driver who finally learns how the engine
works — not to become a mechanic, but to go faster.

## Track Map

```
  FOUNDATIONS (Lessons 1-6)
  ========================
  01  C for Rust Devs .............. "Driving without seatbelts"
  02  Pointers Deep Dive ........... "City addresses & navigation"
  03  Memory Management ............ "Manual garbage collection"
  04  C++ Essentials ............... "Rust's older sibling"
  05  STL Containers ............... "The C++ standard toolbox"
  06  Build Systems ................ "Recipe books & ingredient lists"

  CUDA (Lessons 7-9)
  ========================
  07  CUDA Fundamentals ............ "The GPU factory floor"
  08  CUDA Programming ............. "Writing GPU assembly lines"
  09  CUDA Optimization ............ "Squeezing every FLOP"

  INTEGRATION & CAPSTONE (Lessons 10-14)
  ========================
  10  pybind11 ..................... "Building bridges to Python"
  11  Custom PyTorch Ops ........... "Extending the framework"
  12  Reading Framework Code ....... "Inside PyTorch's engine room"
  13  Performance Optimization ..... "Cache-friendly, SIMD, profiling"
  14  Build an ML Kernel ........... "Capstone: GPU matmul in PyTorch"
```

## What You'll Build

By the end of this track you will have:

1. A mental model of C/C++ memory that maps to what Rust protects you from
2. Working CUDA kernels you wrote from scratch
3. A custom PyTorch operator backed by your own CUDA kernel
4. The ability to read PyTorch's C++ internals without drowning

## Prerequisites

```
  Required                    Helpful but not required
  +-----------------------+   +-------------------------+
  | Rust (ownership,      |   | Linear algebra basics   |
  |  borrowing, lifetimes)|   | PyTorch model training  |
  | Python (comfortable)  |   | Basic GPU awareness     |
  +-----------------------+   +-------------------------+
```

## How Each Lesson Works

- **Analogy first** — every concept starts with a real-world comparison
- **Rust ↔ C/C++ mapping** — you already know this, here's the C version
- **Runnable code** — copy, compile, run, break things
- **Exercises** — practice at the end of each lesson

## Suggested Pace

| Week | Lessons | Focus |
|------|---------|-------|
| 1 | 01-03 | C fundamentals and memory |
| 2 | 04-06 | C++ and build systems |
| 3 | 07-09 | CUDA programming |
| 4 | 10-14 | Integration and capstone |

## Reference Materials

- [C++ Cheatsheet for Rust Devs](reference-cpp-cheatsheet.md)
- [CUDA Quick Reference](reference-cuda.md)

---

**Ready? Let's go.**

[Start Lesson 01 — C for Rust Devs →](01-c-for-rust-devs.md)
