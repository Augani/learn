# ML Systems at Scale - Track Roadmap

Welcome to the **ML Systems at Scale** track. You know how to train
a model on a single GPU. Now we make it work at the scale where
real breakthroughs happen -- hundreds of GPUs, petabytes of data,
and models with billions of parameters.

This track is for engineers who have shipped models to production
and now need to understand what changes when the numbers get very
large.

---

## How This Track Is Organized

```
Phase 1: Hardware & Data Foundations     (Lessons 01-02)
Phase 2: Distributed Training            (Lessons 03-05)
Phase 3: Stability & Operations          (Lessons 06-08)
Phase 4: Evaluation, Cost & Rigor        (Lessons 09-11)
Capstone: Build a Training Cluster       (Lesson 12)
```

---

## Phase 1: Hardware & Data Foundations

Understand what you are building on before you start building.

- [ ] **01 - Training Infrastructure**
      GPU/TPU landscape, memory hierarchy, interconnects
- [ ] **02 - Data Loading at Scale**
      Streaming pipelines, WebDataset, petabyte-scale data

```
  +-------------------+     +-----------------+
  | Hardware &        |---->| Data Loading    |
  | Interconnects     |     | at Scale        |
  +-------------------+     +-----------------+
        01                        02
```

---

## Phase 2: Distributed Training

The core of scaling -- splitting work across machines without
losing your mind (or your gradients).

- [ ] **03 - Distributed Training Patterns**
      Data/model/tensor/pipeline/expert parallelism
- [ ] **04 - DeepSpeed & FSDP**
      ZeRO stages, sharding strategies, practical configs
- [ ] **05 - Training Large Models**
      Billion-parameter training, 3D parallelism, Megatron-LM

```
  +-------------+     +---------------+     +---------------+
  | Parallelism |---->| DeepSpeed &   |---->| Large Model   |
  | Patterns    |     | FSDP          |     | Training      |
  +-------------+     +---------------+     +---------------+
       03                   04                    05
```

---

## Phase 3: Stability & Operations

Training runs at scale are fragile. Hardware fails. Gradients
explode. Clusters get preempted. This phase teaches you to survive.

- [ ] **06 - Training Stability**
      Loss spikes, NaN debugging, learning rate at scale
- [ ] **07 - Training Orchestration**
      Slurm, Kubernetes, fault tolerance, elastic training
- [ ] **08 - Large-Scale Data Processing**
      Spark, Ray, deduplication, tokenization pipelines

```
  +------------+     +---------------+     +--------------+
  | Stability  |---->| Orchestration |---->| Data         |
  | & Debugging|     | & Scheduling  |     | Processing   |
  +------------+     +---------------+     +--------------+
       06                  07                    08
```

---

## Phase 4: Evaluation, Cost & Rigor

Scaling isn't just about making things bigger. It's about making
things worth the money and reproducible.

- [ ] **09 - Evaluation at Scale**
      Benchmark suites, evaluation harnesses, statistical rigor
- [ ] **10 - Cost Engineering**
      GPU economics, spot instances, rent vs build
- [ ] **11 - Reproducibility**
      Deterministic training, experiment tracking, artifact versioning

```
  +------------+     +---------------+     +----------------+
  | Evaluation |---->| Cost          |---->| Reproducibility|
  | at Scale   |     | Engineering   |     | & Rigor        |
  +------------+     +---------------+     +----------------+
       09                  10                    11
```

---

## Capstone

- [ ] **12 - Build a Training Cluster**
      Design and run a multi-GPU pipeline end-to-end

```
  +-----------------------------------------------------+
  |  CAPSTONE: Multi-GPU Training Pipeline               |
  |  Data Loading -> FSDP Training -> Checkpointing ->  |
  |  Monitoring -> Evaluation                            |
  +-----------------------------------------------------+
                          12
```

---

## Reference Material

- **reference-hardware.md** -- GPU/TPU specs, memory, interconnects
- **reference-distributed.md** -- Distributed patterns, DeepSpeed/FSDP configs

---

## Prerequisites

Before starting this track, you should be comfortable with:

- PyTorch (writing custom training loops, not just using `Trainer`)
- Basic distributed systems concepts (processes, networking)
- Linux command line and SSH
- At least one successful model training project

---

## Recommended Reading

These two books provide excellent complementary perspectives.
Read them alongside this track for maximum depth.

- **Efficient Processing of Deep Neural Networks** by Vivienne Sze,
  Yu-Hsin Chen, Tien-Ju Yang, and Joel Emer (Morgan & Claypool, 2020)
  -- The definitive reference on hardware-aware deep learning.
  Covers dataflow, memory hierarchy, and hardware/software co-design.
  Essential for understanding WHY certain parallelism strategies
  work better on certain hardware.

- **Designing Machine Learning Systems** by Chip Huyen
  (O'Reilly, 2022) -- Covers the full ML system lifecycle from
  data engineering to monitoring. Particularly strong on data
  distribution shifts, feature engineering at scale, and the
  operational side of ML that most training-focused resources skip.

---

## How Long Will This Take?

```
+-------------------+------------------+
| Experience Level  | Estimated Time   |
+-------------------+------------------+
| Senior ML Eng     | 3-4 weeks        |
| ML Eng (2+ yrs)  | 5-6 weeks        |
| SWE moving to ML  | 8-10 weeks       |
+-------------------+------------------+
```

Each lesson has real code you can run if you have access to
multi-GPU machines. If you don't, the conceptual understanding
still transfers -- you'll know what to do when you get the
hardware.
