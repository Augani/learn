# Computer Architecture — No Degree Required

This track explains what the CPU is actually doing while your code runs.
If words like cache miss, branch prediction, SIMD, pipeline stall, or TLB
feel like black magic, this is the missing layer.

You do not need an electrical engineering background. We will build the
mental model from the ground up: first the simple CPU-and-memory picture,
then the modern reality of pipelines, caches, speculation, and multicore.

---

## Why This Track Matters

Most developers eventually run into performance problems they cannot explain:

- Why a simple loop can be fast in one layout and slow in another
- Why branches sometimes hurt more than expected
- Why random memory access destroys throughput
- Why atomics and memory barriers exist
- Why vectorized code can be dramatically faster

Computer architecture is the bridge between source code and physical machine
behavior. Once you understand it, performance advice stops feeling like cargo
cult and starts making sense.

---

## How This Track Is Organized

```
Phase 1: The Basic Machine         (Lessons 01-04)
Phase 2: Pipeline and Execution    (Lessons 05-08)
Phase 3: Memory Hierarchy          (Lessons 09-12)
Phase 4: Parallelism and Trends    (Lessons 13-16)
```

Each lesson follows the same pattern:

1. Start with an intuition you can hold in your head
2. Add the real hardware mechanism underneath it
3. Connect it to software behavior you already know
4. End with a practical exercise, simulator, or observation task

---

## Phase 1: The Basic Machine (Lessons 01–04)

- [ ] **01 - Von Neumann Architecture**
      Stored-program idea, CPU/memory/bus model, the von Neumann bottleneck
- [ ] **02 - Instruction Set Architecture**
      ISA vs microarchitecture, opcodes, operands, x86 vs ARM, RISC vs CISC
- [ ] **03 - Registers and the Register File**
      General-purpose registers, special registers, why registers are precious
- [ ] **04 - The Fetch-Decode-Execute Cycle**
      What one instruction really goes through, one clock at a time

```
  +-------------+     +-----------+     +-----------+     +-----------+
  | Von Neumann |---->| ISA Model |---->| Registers |---->| F/D/E Loop |
  +-------------+     +-----------+     +-----------+     +-----------+
         01                02               03                04
```

---

## Phase 2: Pipeline and Execution (Lessons 05–08)

- [ ] **05 - Pipelining**
      Overlapping work, pipeline stages, hazards, bubbles, stalls
- [ ] **06 - Branch Prediction**
      Why branches break flow, speculation, correct vs incorrect guesses
- [ ] **07 - Out-of-Order Execution**
      Reordering instructions safely, reservation stations, reorder buffers
- [ ] **08 - Superscalar and VLIW**
      Multiple execution units, instruction-level parallelism, issue width

```
  +-----------+     +----------+     +--------------+     +------------+
  | Pipeline  |---->| Branches |---->| Out-of-Order |---->| Superscalar |
  +-----------+     +----------+     +--------------+     +------------+
        05               06               07                 08
```

---

## Phase 3: Memory Hierarchy (Lessons 09–12)

- [ ] **09 - Cache Hierarchy (L1, L2, L3)**
      Why caches exist, cache lines, associativity, inclusive vs exclusive
- [ ] **10 - Cache Behavior and Performance**
      Spatial locality, temporal locality, misses, false sharing
- [ ] **11 - Virtual Memory and the TLB**
      Pages, address translation, page walks, translation lookaside buffers
- [ ] **12 - Memory Ordering and Barriers**
      Reordering, store buffers, hardware memory models, synchronization

```
  +---------+     +----------------+     +---------+     +----------+
  | Caches  |---->| Cache Behavior |---->| VM/TLB  |---->| Ordering |
  +---------+     +----------------+     +---------+     +----------+
      09                10                11              12
```

---

## Phase 4: Parallelism and Trends (Lessons 13–16)

- [ ] **13 - SIMD and Vector Processing**
      Data parallelism, vector lanes, auto-vectorization, SSE/AVX/NEON
- [ ] **14 - Multicore and Cache Coherence**
      Shared memory, MESI intuition, coherence traffic, scaling limits
- [ ] **15 - Power, Thermals, and Frequency**
      Clock speed, heat, turbo boost, energy efficiency, dark silicon
- [ ] **16 - Modern CPU Trends**
      Chiplets, heterogeneous cores, Apple Silicon, RISC-V, where CPUs are going

```
  +--------+     +-----------+     +---------------+     +--------+
  | SIMD   |---->| Multicore |---->| Power/Thermal |---->| Trends |
  +--------+     +-----------+     +---------------+     +--------+
      13              14                15               16
```

---

## Who This Track Is For

- Self-taught developers who know how to code but not what the CPU is doing
- Backend and systems developers who want performance intuition
- ML engineers who want to understand vectorization, memory access, and hardware limits
- Anyone who has heard architecture terms and wants a real mental model instead of buzzwords

## Prerequisites

You should be comfortable with:

- Basic programming in any language
- Variables, loops, functions, and arrays
- The high-level idea that programs run on a CPU and use memory

Helpful but not required:

- [CS Fundamentals](../cs-fundamentals/00-roadmap.md)
- [Concurrency & Parallelism](../concurrency-parallelism/00-roadmap.md)
- [Operating Systems](../os-concepts/00-roadmap.md)

---

## What You Will Be Able To Explain After This Track

- Why a cache-friendly program can beat a more "clever" algorithm in practice
- Why branches, pointer chasing, and poor locality hurt performance
- Why CPUs reorder work and how they still preserve correctness
- Why multicore programming is hard even when threads look simple in code
- Why hardware details shape compilers, runtimes, databases, and ML systems

---

## Time Estimate

```
Phase 1:  ~6 hours   (core machine model)
Phase 2:  ~8 hours   (pipeline and execution)
Phase 3:  ~8 hours   (memory hierarchy and ordering)
Phase 4:  ~6 hours   (parallelism and modern trends)
          --------
Total:    ~28 hours
```

Take this slowly. Architecture clicks when you revisit it from different angles.
Reading one lesson, then looking at real code or profiler output, works better
than trying to memorize terminology in one sitting.

---

## Recommended Reading

These books are optional — the lessons above are designed to stand on their own.

- **Code: The Hidden Language of Computer Hardware and Software** by Charles Petzold (Microsoft Press, 2nd Edition 2022) — The best bridge from hardware intuition to software reality
- **Computer Systems: A Programmer's Perspective** by Randal Bryant and David O'Hallaron (Pearson, 3rd Edition 2015) — Excellent for connecting architecture to real programs
- **Computer Organization and Design ARM Edition** by David Patterson and John Hennessy (Morgan Kaufmann, 2nd Edition 2020) — A clear modern architecture text with strong diagrams
- **What Every Programmer Should Know About Memory** by Ulrich Drepper (2007) — A classic free deep dive on memory behavior

---

*Track version: 2026.05*