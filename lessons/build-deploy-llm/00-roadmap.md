# Build & Deploy LLM Capstone Track — From Empty File to Working Product

This is the capstone. You have learned the math, the hardware, the
architectures, and the training theory. Now you build the real thing.

Over the next 9 lessons, you will build a small transformer language
model from scratch in PyTorch, train it on a real dataset, optimize it
for deployment, and ship it two ways: as a browser-based demo and as a
local CLI tool. No Hugging Face. No magic wrappers. Every line of code
is yours.

The task: Python code completion. You will build a model that takes
partial Python code and predicts what comes next. Small enough to train
on a single consumer GPU, useful enough to actually demo.

```
  YOU ARE HERE
      |
      v
+-------------------+     +-------------------+
|   PHASE 1         |     |   PHASE 2         |
|   Foundation      |---->|   Build the Model  |
|   Lessons 01-02   |     |   Lessons 03-04    |
+-------------------+     +-------------------+
                                   |
                                   v
+-------------------+     +-------------------+
|   PHASE 4         |     |   PHASE 3         |
|   Optimize &      |<----|   Train           |
|   Export           |     |   Lesson 05        |
|   Lessons 06-07   |     |                    |
+-------------------+     +-------------------+
         |
         v
+-------------------+
|   PHASE 5         |
|   Deploy           |
|   Lessons 08-09   |
+-------------------+
         |
         v
  ┌──────────────────────────────────┐
  │  TWO WORKING DELIVERABLES:       │
  │  1. Browser demo (HTML/JS/ONNX)  │
  │  2. CLI tool (Python, CPU-only)  │
  └──────────────────────────────────┘
```

---

## Reference Files

- [Deployment Checklist](./reference-deployment-checklist.md) — Export verification, size targets, latency benchmarks, packaging steps

---

## The Roadmap

### Phase 1: Foundation (Hours 1–4)

Set up the project and build the tokenizer. Everything starts with
turning text into numbers.

- [ ] [Lesson 01: Project Setup and Architecture](./01-project-setup.md)
- [ ] [Lesson 02: Building a Tokenizer from Scratch](./02-tokenizer-from-scratch.md)

**You'll build:** A complete BPE tokenizer in pure Python — no libraries.

---

### Phase 2: Build the Model (Hours 5–10)

Implement every component of a decoder-only transformer by hand.
Then wire up the training loop.

- [ ] [Lesson 03: Building the Transformer](./03-transformer-architecture.md)
- [ ] [Lesson 04: The Training Loop](./04-training-loop.md)

**You'll build:** A full transformer architecture and training pipeline from scratch in PyTorch.

---

### Phase 3: Train (Hours 11–14)

Actually train the model. Monitor loss curves, debug problems, and
watch your model learn to write Python.

- [ ] [Lesson 05: Training the Model](./05-training-the-model.md)

**You'll build:** A trained model checkpoint that can generate Python code.

---

### Phase 4: Optimize & Export (Hours 15–18)

Shrink the model with quantization and export it to ONNX for
cross-platform deployment.

- [ ] [Lesson 06: Model Optimization for Deployment](./06-model-optimization.md)
- [ ] [Lesson 07: Exporting to ONNX](./07-export-onnx.md)

**You'll build:** A quantized, ONNX-exported model ready for deployment.

---

### Phase 5: Deploy (Hours 19–24)

Ship it. First to the browser, then as a pip-installable CLI tool.

- [ ] [Lesson 08: Browser Deployment](./08-browser-deployment.md)
- [ ] [Lesson 09: CLI Tool Deployment](./09-cli-tool.md)

**You'll build:** A working browser demo and a local CLI tool — your two final deliverables.

---

## How to Use This Track

```
+--------------------+
|  Read the lesson   |
+--------+-----------+
         |
         v
+--------------------+
| Type every line of |
| code yourself      |
+--------+-----------+
         |
         v
+--------------------+
| Run it. Debug it.  |
| Make it work.      |
+--------+-----------+
         |
         v
+--------------------+
| Check the box      |
| Move to next       |
+--------------------+
```

This is a hands-on capstone. Do not copy-paste. Type the code.
Each lesson builds on the previous one. Do them in order.

Start here: [Lesson 01: Project Setup and Architecture](./01-project-setup.md)

---

## Prerequisites

- [Math Foundations](../math-foundations/00-roadmap.md) — Linear algebra, calculus, probability
- [GPU & CUDA Fundamentals](../gpu-cuda-fundamentals/00-roadmap.md) — GPU architecture, memory, CUDA basics
- [ML Fundamentals (Track 7)](../ml-fundamentals/00-roadmap.md) — Neural networks, training, backpropagation
- [LLMs & Transformers (Track 8)](../llms-transformers/00-roadmap.md) — Transformer architecture, attention, tokenization

---

## Hardware Requirements

```
┌──────────────────────────────────────────────┐
│  MINIMUM:                                     │
│  • GPU with 8GB+ VRAM (RTX 3060 or better)   │
│  • 16GB system RAM                            │
│  • 20GB free disk space                       │
│                                               │
│  RECOMMENDED:                                 │
│  • GPU with 12GB+ VRAM (RTX 3080/4070+)      │
│  • 32GB system RAM                            │
│  • SSD for faster data loading                │
│                                               │
│  CLOUD ALTERNATIVE:                           │
│  • Google Colab Pro (T4/A100 GPU)             │
│  • Lambda Labs, Vast.ai, RunPod              │
└──────────────────────────────────────────────┘
```

---

## Time Estimate

| Phase | Lessons | Hours |
|-------|---------|-------|
| Phase 1: Foundation | 01–02 | ~4 hrs |
| Phase 2: Build the Model | 03–04 | ~6 hrs |
| Phase 3: Train | 05 | ~4 hrs |
| Phase 4: Optimize & Export | 06–07 | ~4 hrs |
| Phase 5: Deploy | 08–09 | ~6 hrs |
| **Total** | **9 lessons** | **~24 hrs** |

---

## What Comes Next

After completing this track, you have built and deployed a language model
from scratch. You are ready to:

- Scale up: revisit [Advanced LLM Engineering](../advanced-llm-engineering/00-roadmap.md) with hands-on experience
- Build production systems: apply what you learned to [AI Engineering](../ai-engineering/00-roadmap.md) projects
- Go deeper: explore [Scale & Infrastructure](../ml-scale-infrastructure/00-roadmap.md) to understand training at massive scale

---

## Recommended Reading

These are optional — the lessons cover everything you need. But if you want to go deeper:

- **"Attention Is All You Need"** by Vaswani et al. (2017) — The original transformer paper
- **"Language Models are Unsupervised Multitask Learners"** (GPT-2 paper) by Radford et al. (2019) — The decoder-only architecture we build
- **"minGPT"** by Andrej Karpathy (GitHub) — A minimal GPT implementation that inspired this track's approach
- **"The Illustrated Transformer"** by Jay Alammar — Visual walkthrough of transformer internals
