# ML Research to Production - Track Roadmap

Welcome to the **ML Research to Production** track. You can train
models and ship code. Now learn the messy middle ground: reading
papers, reproducing results, implementing novel architectures, and
turning research prototypes into production systems.

This track is for engineers who are tired of waiting for someone
else to implement the latest paper.

---

## How This Track Is Organized

```
Phase 1: Research Literacy       (Lessons 01-03)
Phase 2: Experiment Craft        (Lessons 04-06)
Phase 3: Custom Components       (Lessons 07-09)
Phase 4: Production Bridge       (Lessons 10-12)
```

---

## Phase 1: Research Literacy

Read papers, reproduce them, implement them from scratch.

- [ ] **01 - Reading ML Papers**
      Three-pass method, paper anatomy, critical reading
- [ ] **02 - Reproducing Results**
      Setting up experiments, matching numbers, debugging gaps
- [ ] **03 - Implementing Papers**
      LaTeX to PyTorch, pseudocode to working code

```
  +---------------+     +------------+     +------------+
  | Read Papers   |---->| Reproduce  |---->| Implement  |
  +---------------+     +------------+     +------------+
       01                    02                 03
```

---

## Phase 2: Experiment Craft

Design experiments like a scientist, work like an engineer.

- [ ] **04 - Experiment Design**
      Ablations, baselines, statistical significance
- [ ] **05 - Research Engineering Workflow**
      Jupyter to production, version control for experiments
- [ ] **06 - Custom Training Loops**
      Beyond model.fit(), gradient surgery, multi-task training

```
  +------------+     +------------+     +----------------+
  | Design     |---->| Workflow   |---->| Training Loops |
  +------------+     +------------+     +----------------+
       04                 05                   06
```

---

## Phase 3: Custom Components

Build the pieces that don't exist in any library yet.

- [ ] **07 - Custom Architectures**
      Novel layers, attention variants, debugging shapes
- [ ] **08 - Custom Losses**
      Contrastive, focal, multi-task loss balancing
- [ ] **09 - Dataset Creation**
      Collection, annotation, quality control, documentation

```
  +----------------+     +--------+     +----------+
  | Architectures  |---->| Losses |---->| Datasets |
  +----------------+     +--------+     +----------+
       07                    08              09
```

---

## Phase 4: Production Bridge

Cross the valley from "it works on my machine" to "it works."

- [ ] **10 - Benchmarking**
      Fair comparisons, compute-matched evaluations
- [ ] **11 - Prototype to Production**
      Refactoring research code, testing ML systems
- [ ] **12 - Build a Research Project (Capstone)**
      Implement a paper end-to-end and ship it

```
  +-------------+     +------------+     +-----------+
  | Benchmarks  |---->| Production |---->| Capstone  |
  +-------------+     +------------+     +-----------+
       10                  11                 12
```

---

## The Full Pipeline

```
  Paper on arXiv
       |
       v
  +---------------+
  | Read & Assess |  <-- Is this worth pursuing?
  +---------------+
       |
       v
  +---------------+
  | Reproduce     |  <-- Can I match their numbers?
  +---------------+
       |
       v
  +---------------+
  | Implement     |  <-- Build it from scratch
  +---------------+
       |
       v
  +---------------+
  | Experiment    |  <-- Ablate, measure, iterate
  +---------------+
       |
       v
  +---------------+
  | Harden        |  <-- Tests, edge cases, docs
  +---------------+
       |
       v
  +---------------+
  | Ship          |  <-- Production-ready code
  +---------------+
```

---

## Prerequisites

- Python fluency (you write Python daily)
- PyTorch basics (tensors, autograd, nn.Module)
- ML fundamentals (loss functions, gradient descent, overfitting)
- Git proficiency (branching, rebasing, PRs)
- Comfort reading math (linear algebra, probability)

---

## Recommended Reading

These two books are excellent companions for this track:

- **Machine Learning Engineering** by Andriy Burkov (True Positive Inc., 2020)
  Covers the full lifecycle of ML systems from planning through
  deployment and maintenance. Practical and opinionated.

- **Designing Machine Learning Systems** by Chip Huyen (O'Reilly, 2022)
  Focuses on the system design aspects: data engineering, feature
  stores, model serving, monitoring. Essential for anyone shipping
  ML to production.

---

## Reference Sheets

- **reference-paper-reading.md** -- Paper reading strategies, common
  notation, arXiv tips
- **reference-workflow.md** -- Research engineering workflow checklist
  and tools

---

## Time Estimate

```
Phase 1: ~3 weeks  (heavy reading + coding)
Phase 2: ~3 weeks  (experiment-heavy)
Phase 3: ~3 weeks  (implementation-heavy)
Phase 4: ~3 weeks  (capstone project)
Total:   ~12 weeks at 8-10 hours/week
```

Start with Lesson 01. Read a real paper alongside it.
