# ML Glossary Track — The Terms You Need, Demystified

Machine learning is drowning in jargon. "10B parameters." "INT4
quantization." "Chinchilla-optimal." "RLHF." Every paper, blog post,
and model card throws around terms that assume you already know what
they mean.

This track fixes that. It is a thematic glossary — not a dictionary
dump, but organized lessons where related terms are explained together,
with plain-English definitions, technical depth, concrete examples,
and cross-references to the lessons where each concept is taught in
full.

**This is a companion reference, not a sequential course.** You do not
need to read it front to back. Jump to the lesson that covers the
terms you are confused about. Use it alongside any other ML/AI track
on this platform.

```
HOW TO USE THIS TRACK

    Working through Track 7 (ML Fundamentals)?
         │
         ├──→ Confused by "learning rate"?
         │         └──→ Jump to Lesson 03: Training Terminology
         │
         ├──→ Confused by "7B parameters"?
         │         └──→ Jump to Lesson 01: Model Sizes and Parameters
         │
         └──→ Need a quick one-line definition?
                   └──→ Jump to Quick Lookup Reference
```

---

## Reference Files

- [Quick Lookup Reference](./reference-quick-lookup.md) — Alphabetical index of every term with a one-line definition and link to the full explanation

---

## The Roadmap

### Theme 1: Numbers and Scale (Lessons 01–02)

What the numbers mean. Parameter counts, model sizes, memory
requirements, and the precision formats that make it all fit on a GPU.

- [ ] [Lesson 01: Model Sizes and Parameters](./01-model-sizes-parameters.md)
- [ ] [Lesson 02: Quantization and Precision](./02-quantization-precision.md)

```
+---------------------------+     +---------------------------+
|  THEME 1: Numbers & Scale |     |  THEME 2: Training        |
|  Lessons 01-02            |     |  Lesson 03                |
|  Parameters, memory,      |     |  Epochs, loss, learning   |
|  quantization, precision  |     |  rate, overfitting        |
+---------------------------+     +---------------------------+
              |                               |
              v                               v
+---------------------------+     +---------------------------+
|  THEME 3: Architecture    |     |  THEME 4: Scale & Compute |
|  Lesson 04                |     |  Lesson 05                |
|  Layers, heads, context   |     |  FLOPS, GPU-hours,        |
|  length, encoder/decoder  |     |  scaling laws, throughput  |
+---------------------------+     +---------------------------+
              |                               |
              v                               v
+---------------------------+     +---------------------------+
|  THEME 5: Modern LLMs     |     |  THEME 6: Data & Eval     |
|  Lesson 06                |     |  Lesson 07                |
|  RLHF, DPO, temperature,  |     |  Tokenization, BPE,       |
|  top-p, beam search       |     |  benchmarks, red teaming  |
+---------------------------+     +---------------------------+
```

---

### Theme 2: Training (Lesson 03)

The vocabulary of the training loop — what happens when a model learns.

- [ ] [Lesson 03: Training Terminology](./03-training-terminology.md)

---

### Theme 3: Architecture (Lesson 04)

The building blocks of neural networks and transformers — what each
piece is called and where it lives.

- [ ] [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)

---

### Theme 4: Scale and Compute (Lesson 05)

The language of scale — how we measure compute, speed, and efficiency.

- [ ] [Lesson 05: Scaling and Compute Terminology](./05-scaling-compute-terminology.md)

---

### Theme 5: Modern LLMs (Lesson 06)

The terms that define how modern language models are built, aligned,
and controlled.

- [ ] [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)

---

### Theme 6: Data and Evaluation (Lesson 07)

How data gets into models and how we measure what comes out.

- [ ] [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)

---

## How to Use This Track

```
+---------------------------+
|  Hit an unfamiliar term   |
|  in another track         |
+-------------+-------------+
              |
              v
+---------------------------+
|  Check the Quick Lookup   |
|  Reference for a one-line |
|  definition               |
+-------------+-------------+
              |
              v
+---------------------------+
|  Want more depth? Follow  |
|  the link to the thematic |
|  lesson                   |
+-------------+-------------+
              |
              v
+---------------------------+
|  Want the full treatment? |
|  Follow the cross-ref to  |
|  the original track lesson|
+---------------------------+
```

This track is designed to be used **alongside** other ML/AI tracks:

- **While studying ML Fundamentals (Track 7):** Reference Lessons 01, 03, 04
- **While studying LLMs & Transformers (Track 8):** Reference Lessons 04, 05, 06, 07
- **While studying Advanced Deep Learning:** Reference Lessons 01, 02, 05
- **While studying Advanced LLM Engineering:** Reference Lessons 02, 05, 06, 07
- **While studying Scale & Infrastructure:** Reference Lessons 01, 02, 05

You can also read it front to back as a terminology boot camp before
diving into the ML/AI tracks — but that is optional, not required.

---

## Prerequisites

- None. This track is accessible to anyone.
- Familiarity with basic math (arithmetic, percentages) helps with the concept check exercises.

---

## Time Estimate

| Theme | Lessons | Hours |
|-------|---------|-------|
| Theme 1: Numbers and Scale | 01–02 | ~3 hrs |
| Theme 2: Training | 03 | ~2 hrs |
| Theme 3: Architecture | 04 | ~2 hrs |
| Theme 4: Scale and Compute | 05 | ~2 hrs |
| Theme 5: Modern LLMs | 06 | ~2 hrs |
| Theme 6: Data and Evaluation | 07 | ~2 hrs |
| **Total** | **7 lessons** | **~13 hrs** |

(Less if you are using it as a reference. More if you do every concept check exercise.)

---

## What Comes Next

This track is a companion — it does not have a single "next track."
Instead, it supports your journey through:

- **[ML Fundamentals (Track 7)](../ml-fundamentals/00-roadmap.md)** — Where you build neural networks from scratch
- **[LLMs & Transformers (Track 8)](../llms-transformers/00-roadmap.md)** — Where you learn how modern language models work
- **[Scale & Infrastructure](../ml-scale-infrastructure/00-roadmap.md)** — Where you learn what it takes to train models at scale

---

## Recommended Reading

These are optional — the lessons above cover everything you need:

- **The Illustrated Transformer** by Jay Alammar — Visual explanations of transformer architecture terminology
- **Hugging Face Documentation: Glossary** — Industry-standard definitions for modern ML terms
- **Chip Huyen: Machine Learning Systems Design** (2022) — Practical terminology in context

