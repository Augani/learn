# Scale & Infrastructure Track — What It Actually Takes to Train a Large Model

You have learned how neural networks work, how transformers process
language, and how GPUs accelerate computation. Now the question becomes:
how do you go from a research idea to a trained model with billions of
parameters?

This track covers the "why and how much" of training at scale. Data
pipelines that process petabytes of text. Compute budgets that cost
millions of dollars. Distributed systems that coordinate thousands of
GPUs. Cost estimation that determines whether a project is even feasible.

If the [ML Systems at Scale track](../ml-systems-at-scale/00-roadmap.md)
teaches you *how to run* distributed training, this track teaches you
*how to plan, budget, and architect* the entire pipeline from raw data
to deployed model.

```
  YOU ARE HERE
      |
      v
+-------------------+     +-------------------+
|   PHASE 1         |     |   PHASE 2         |
|   Data            |---->|   Compute & Cost   |
|   Foundations      |     |   Lessons 02, 06   |
|   Lessons 01, 08  |     |                    |
+-------------------+     +-------------------+
                                   |
                                   v
+-------------------+     +-------------------+
|   PHASE 4         |     |   PHASE 3         |
|   The Full        |<----|   Infrastructure   |
|   Pipeline        |     |   Lesson 03        |
|   Lessons 04-05   |     |                    |
+-------------------+     +-------------------+
         |
         v
+-------------------+
|   PHASE 5         |
|   Evaluation &    |
|   Capstone        |
|   Lessons 07, 09  |
+-------------------+
```

---

## Reference Files

- [Cost Calculator Reference](./reference-cost-calculator.md) — GPU cost tables, FLOPS-per-dollar, training cost formulas

---

## The Roadmap

### Phase 1: Data Foundations (Hours 1–4)

Before you train anything, you need data. Lots of it. And it needs to
be clean, deduplicated, and properly mixed. These lessons cover the
full data pipeline from raw web crawls to training-ready tokens.

- [ ] [Lesson 01: Training Data Pipelines](./01-training-data-pipelines.md)
- [ ] [Lesson 08: Data Quality and Curation](./08-data-quality-curation.md)

**You'll learn:** How Common Crawl becomes training data, deduplication at scale, quality filtering, and data mixing strategies.

---

### Phase 2: Compute & Cost (Hours 5–8)

How much compute do you need? How much will it cost? These lessons
give you the formulas and frameworks to answer those questions for
any model size.

- [ ] [Lesson 02: Compute Planning and Scaling Laws](./02-compute-planning.md)
- [ ] [Lesson 06: Cost and Resource Estimation](./06-cost-estimation.md)

**You'll learn:** Chinchilla scaling laws, FLOPS estimation, GPU-hours calculation, and real-world training cost breakdowns.

---

### Phase 3: Infrastructure (Hours 9–11)

Thousands of GPUs need to talk to each other. This lesson covers the
networking, fault tolerance, and orchestration that makes large-scale
training possible.

- [ ] [Lesson 03: Distributed Training Infrastructure](./03-distributed-training-infra.md)

**You'll learn:** InfiniBand networking, checkpointing strategies, DeepSpeed, Megatron-LM, and FSDP.

---

### Phase 4: The Full Pipeline (Hours 12–15)

End-to-end walkthroughs of both the pre-training and post-training
pipelines. From raw data to a base model, then from base model to
an aligned assistant.

- [ ] [Lesson 04: The Pre-Training Pipeline](./04-pretraining-pipeline.md)
- [ ] [Lesson 05: The Post-Training Pipeline](./05-post-training-pipeline.md)

**You'll learn:** Every stage of building a model — data preprocessing, tokenizer training, model initialization, RLHF, DPO, and safety training.

---

### Phase 5: Evaluation & Capstone (Hours 16–19)

How do you know if your model is any good? And can you put it all
together to plan a real training run?

- [ ] [Lesson 07: Model Evaluation at Scale](./07-evaluation-at-scale.md)
- [ ] [Lesson 09: Capstone — Plan a Training Run](./09-capstone-plan-training-run.md)

**You'll learn:** Benchmark suites, contamination concerns, red teaming, and how to plan a complete training run from scratch.

---

## How to Use This Track

```
+--------------------+
|  Read the lesson   |
+--------+-----------+
         |
         v
+--------------------+
| Study the diagrams |
| and calculations   |
+--------+-----------+
         |
         v
+--------------------+
| Do the exercises   |
+--------+-----------+
         |
         v
+--------------------+
| Check the box      |
| Move to next       |
+--------------------+
```

Each lesson is designed to be completed in 1.5–2.5 hours.
Follow the phase order. The capstone ties everything together.

Start here: [Lesson 01: Training Data Pipelines](./01-training-data-pipelines.md)

---

## Prerequisites

- [GPU & CUDA Fundamentals](../gpu-cuda-fundamentals/00-roadmap.md) — Understanding GPU architecture and memory
- [ML Fundamentals (Track 7)](../ml-fundamentals/00-roadmap.md) — Neural networks, training, backpropagation
- [LLMs & Transformers (Track 8)](../llms-transformers/00-roadmap.md) — Transformer architecture, attention, tokenization

---

## Time Estimate

| Phase | Lessons | Hours |
|-------|---------|-------|
| Phase 1: Data Foundations | 01, 08 | ~4 hrs |
| Phase 2: Compute & Cost | 02, 06 | ~4 hrs |
| Phase 3: Infrastructure | 03 | ~3 hrs |
| Phase 4: The Full Pipeline | 04–05 | ~4 hrs |
| Phase 5: Evaluation & Capstone | 07, 09 | ~4 hrs |
| **Total** | **9 lessons** | **~19 hrs** |

---

## What Comes Next

After completing this track, continue to:

- **[Advanced LLM Engineering](../advanced-llm-engineering/00-roadmap.md)** — Deep dive into serving, optimization, and advanced training techniques
- **[Build & Deploy LLM Capstone](../build-deploy-llm/00-roadmap.md)** — Build a small language model from scratch and deploy it

---

## Recommended Reading

These are optional — the lessons cover everything you need. But if you want to go deeper:

- **"Scaling Data-Constrained Language Models"** by Muennighoff et al. (2023) — How to handle data constraints at scale
- **"Training Compute-Optimal Large Language Models"** (Chinchilla paper) by Hoffmann et al. (2022) — The scaling laws that changed how we think about training budgets
- **"LLaMA: Open and Efficient Foundation Language Models"** by Touvron et al. (2023) — Practical details of training a large open model
- **"The Pile: An 800GB Dataset of Diverse Text"** by Gao et al. (2020) — How a large-scale training dataset is constructed
