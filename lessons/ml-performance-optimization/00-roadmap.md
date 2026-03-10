# ML Performance Optimization Track

## The Big Picture

You have an ML model that works. It trains. It produces results. But it takes
four hours per epoch, eats 80GB of VRAM, and your inference server can only
handle 12 requests per second. This track is about making all of that *fast*.

Performance optimization is detective work. You measure, form hypotheses, apply
targeted fixes, and measure again. The biggest mistake engineers make is
optimizing the wrong thing -- spending a week writing a custom CUDA kernel
when the real bottleneck was the data loader reading from a network mount.

```
  YOU ARE HERE
      |
      v
+-----+------------------------------------------------------+
|           ML PERFORMANCE OPTIMIZATION                       |
|                                                             |
|  Profiling         Memory           Compute       Pipeline  |
|  --------         ------           -------       --------   |
|  01 Profiling     02 GPU Memory    06 Compile    04 Data    |
|  ref-profiling    03 Memory Opt    07 Fusion     10 Batch   |
|                                    08 CUDA       11 Infer   |
|                   PyTorch          09 TensorRT   12 Capstone|
|                   -------                                   |
|                   05 PyTorch Perf  ref-optimization          |
+-------------------------------------------------------------+
```

## Prerequisites

You should be comfortable with:
- **Python and PyTorch** -- building and training models (see: ML Fundamentals)
- **Basic GPU concepts** -- what a kernel is, CUDA threads (see: Concurrency Track, lesson 12)
- **Linux command line** -- profiling tools live here
- **Basic C/C++** -- helpful for CUDA lessons (see: C/C++ for ML Track)

This track assumes you've trained models on GPUs before. We go deeper into
*why* things are slow and *how* to fix them systematically.

## Lesson Map

| #  | Lesson                        | Key Concept                        |
|----|-------------------------------|------------------------------------|
| 01 | Profiling ML Code             | Finding the real bottleneck        |
| 02 | GPU Memory Deep Dive          | Memory hierarchy and access patterns|
| 03 | Memory Optimization           | Gradient checkpointing, mixed prec |
| 04 | Data Pipeline Optimization    | DataLoader, IO, prefetching        |
| 05 | PyTorch Performance           | Avoiding common PyTorch pitfalls   |
| 06 | torch.compile Deep Dive       | Dynamo, AOTAutograd, Inductor      |
| 07 | Operator Fusion               | Fused kernels, Triton, Flash Attn  |
| 08 | CUDA Kernels for ML           | Writing custom GPU operations      |
| 09 | TensorRT Optimization         | High-performance inference engine  |
| 10 | Batch Optimization            | Batch size tuning and strategies   |
| 11 | Inference Optimization        | Pruning, quantization, serving     |
| 12 | Build an Optimized Pipeline   | Capstone: 10x speedup project      |

## Reference Material

- [Profiling Quick Reference](reference-profiling.md)
- [Optimization Checklist](reference-optimization.md)

## How to Use This Track

1. **Start with lesson 01** -- profiling. Always measure before optimizing.
2. Lessons 02-03 cover **memory** -- do them in order.
3. Lesson 04 covers **data pipelines** -- a common hidden bottleneck.
4. Lesson 05 covers **PyTorch-specific** patterns -- essential for everyone.
5. Lessons 06-08 cover **compute optimization** -- do them in order.
6. Lessons 09-11 cover **deployment** -- pick based on need.
7. Lesson 12 is a **capstone** -- do it last.

Each lesson is 10-20 minutes of focused reading with code examples you
can run directly.

## What You'll Be Able to Do

After completing this track you will:
- Profile any ML workload and identify the actual bottleneck
- Cut GPU memory usage by 2-4x without changing model architecture
- Speed up training with compilation, fusion, and mixed precision
- Write custom CUDA kernels when existing ops aren't fast enough
- Optimize inference throughput by 5-10x for production serving
- Build a systematic optimization workflow you can apply to any project

## Recommended Reading

Two books stand above the rest for the topics in this track:

- **Programming Massively Parallel Processors** by David Kirk and Wen-mei Hwu
  (Morgan Kaufmann, 4th Edition 2022) -- The definitive guide to GPU
  programming. Covers CUDA from first principles through advanced memory
  patterns and parallel algorithms. Essential reading for lessons 02, 07, 08.

- **Systems Performance** by Brendan Gregg (Pearson, 2nd Edition 2020) -- The
  bible of performance engineering. Covers profiling methodology, CPU/memory/IO
  analysis, and observability tools. Directly applicable to lessons 01, 04,
  and the capstone project. Gregg's USE method (Utilization, Saturation,
  Errors) is a framework you'll use constantly.

Both books are dense but reward careful reading. You don't need to read them
cover-to-cover -- start with the chapters relevant to your current lesson.
