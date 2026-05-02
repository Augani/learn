# GPU & CUDA Fundamentals Track — The Hardware That Makes ML Possible

Welcome to GPU & CUDA Fundamentals. This track takes you from "why are
GPUs important?" to writing CUDA kernels and understanding the hardware
that powers every large language model, diffusion model, and neural
network in production today.

You do not need prior GPU programming experience. You need the math
foundations (vectors, matrices, matrix multiplication) and basic Python.
This track handles the rest.

```
  YOU ARE HERE
      |
      v
+---------------------+     +---------------------+
|   PHASE 1           |     |   PHASE 2           |
|   Architecture      |---->|   CUDA Programming   |
|   Foundations        |     |   Lessons 03-05      |
|   Lessons 01-02     |     |                      |
+---------------------+     +---------------------+
                                       |
                                       v
+---------------------+     +---------------------+
|   PHASE 4           |     |   PHASE 3           |
|   Multi-GPU &       |<----|   ML Hardware        |
|   Operations        |     |   Lessons 06-07      |
|   Lessons 08-10     |     |                      |
+---------------------+     +---------------------+
         |
         v
+---------------------+
|   PHASE 5           |
|   Capstone          |
|   Lesson 11         |
+---------------------+
```

---

## Reference Files

- [GPU Specs Reference](./reference-gpu-specs.md) — Comparison table of GPU/accelerator specs, memory, FLOPS, and pricing

---

## The Roadmap

### Phase 1: Architecture Foundations (Hours 1–4)

Why GPUs exist and how they think differently from CPUs. The memory
hierarchy that determines whether your code is fast or painfully slow.

- [ ] [Lesson 01: CPU vs GPU Architecture](./01-cpu-vs-gpu.md)
- [ ] [Lesson 02: GPU Memory Hierarchy](./02-gpu-memory-hierarchy.md)

**You'll learn:** Why a GPU with 10,000 cores beats a CPU with 16 cores for ML, and why memory bandwidth matters more than raw compute.

---

### Phase 2: CUDA Programming (Hours 5–12)

Hands-on GPU programming. You will write kernels, launch threads, and
understand the programming model that powers PyTorch, TensorFlow, and
every ML framework under the hood.

- [ ] [Lesson 03: CUDA Programming Basics](./03-cuda-hello-world.md)
- [ ] [Lesson 04: CUDA Programming Patterns](./04-cuda-patterns.md)
- [ ] [Lesson 05: Tensor Operations on GPU](./05-tensor-ops-on-gpu.md)

**You'll build:** A vector addition kernel, a parallel reduction, a tiled matrix multiply, and understand how PyTorch talks to CUDA.

---

### Phase 3: ML Hardware (Hours 13–16)

The hardware landscape for ML. Which GPUs exist, what their specs mean,
and how to estimate whether your model fits in memory.

- [ ] [Lesson 06: ML Hardware Landscape](./06-ml-hardware-landscape.md)
- [ ] [Lesson 07: Memory Management for ML](./07-memory-estimation.md)

**You'll learn:** How to read a GPU spec sheet, estimate memory for any model, and understand mixed precision and quantization from a hardware perspective.

---

### Phase 4: Multi-GPU & Operations (Hours 17–22)

Scaling beyond one GPU. Parallelism strategies, profiling tools, and
how PyTorch integrates with CUDA at a deep level.

- [ ] [Lesson 08: Multi-GPU and Distributed Compute](./08-multi-gpu-basics.md)
- [ ] [Lesson 09: Profiling and Debugging GPU Code](./09-profiling-debugging.md)
- [ ] [Lesson 10: PyTorch and CUDA Integration](./10-pytorch-cuda-integration.md)

**You'll learn:** Data parallelism vs model parallelism, how to use nvidia-smi and profilers, and how PyTorch dispatches operations to CUDA.

---

### Phase 5: Capstone (Hours 23–26)

Put it all together. Write a CUDA matrix multiplication kernel from
scratch and optimize it step by step.

- [ ] [Lesson 11: Capstone — CUDA Matrix Multiplication](./11-capstone-cuda-matmul.md)

**You'll build:** A CUDA matmul kernel optimized from naive to tiled to shared memory, benchmarked against CPU and cuBLAS.

---

## How to Use This Track

```
+------------------+
|  Read the lesson |
+--------+---------+
         |
         v
+------------------+
| Run the examples |
+--------+---------+
         |
         v
+------------------+
| Do the exercises |
+--------+---------+
         |
         v
+------------------+
| Check the box    |
| Move to next     |
+------------------+
```

Each lesson is designed to be completed in 2–3 hours.
Do them in order. The concepts build on each other.

Start here: [Lesson 01: CPU vs GPU Architecture](./01-cpu-vs-gpu.md)

---

## Prerequisites

- [Math Foundations Track](../math-foundations/00-roadmap.md) (especially linear algebra: vectors, matrices, matrix multiplication)
- [ML Fundamentals (Track 7)](../ml-fundamentals/00-roadmap.md) — helpful but not strictly required; can be taken in parallel
- Python 3.10+
- Basic comfort with the command line

### Hardware Requirements

You do NOT need a GPU to learn from this track. Most lessons explain
concepts with diagrams and pseudocode. For the CUDA programming lessons
(03-05, 11), you have options:

- **Google Colab** (free tier) — provides NVIDIA T4 GPUs
- **A local NVIDIA GPU** — any CUDA-capable GPU works (GTX 1060+)
- **Cloud GPU instances** — AWS, GCP, or Lambda Labs

```
# Check if you have CUDA available
python -c "import torch; print(torch.cuda.is_available())"

# Or check NVIDIA driver
nvidia-smi
```

---

## Time Estimate

| Phase | Lessons | Hours |
|-------|---------|-------|
| Phase 1: Architecture Foundations | 01–02 | ~4 hrs |
| Phase 2: CUDA Programming | 03–05 | ~8 hrs |
| Phase 3: ML Hardware | 06–07 | ~4 hrs |
| Phase 4: Multi-GPU & Operations | 08–10 | ~6 hrs |
| Phase 5: Capstone | 11 | ~4 hrs |
| **Total** | **11 lessons** | **~26 hrs** |

---

## What Comes Next

After completing this track, continue to:

- **[ML Fundamentals (Track 7)](../ml-fundamentals/00-roadmap.md)** — Apply your hardware knowledge to training neural networks
- **[LLMs & Transformers (Track 8)](../llms-transformers/00-roadmap.md)** — Understand the models that push GPUs to their limits
- **[ML Performance Optimization](../ml-performance-optimization/00-roadmap.md)** — Deep dive into making ML code fast

---

## Recommended Reading

These are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Programming Massively Parallel Processors** by Kirk & Hwu (Morgan Kaufmann, 2022) — The definitive CUDA programming textbook
- **CUDA by Example** by Sanders & Kandrot (Addison-Wesley, 2010) — Gentle introduction with practical examples
- **NVIDIA CUDA Programming Guide** (online) — The official reference documentation
