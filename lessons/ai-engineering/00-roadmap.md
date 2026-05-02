# AI Engineering Track - Roadmap

Welcome to AI Engineering. This track takes you from writing your first
prompt to deploying production AI systems. Every lesson has code you
can run and something you can build.

```
  YOU ARE HERE
      |
      v
+------------------+     +------------------+     +------------------+
|   PHASE 1        |     |   PHASE 2        |     |   PHASE 3        |
|   Foundations     |---->|   RAG Systems    |---->|   Fine-Tuning    |
|   Lessons 01-04  |     |   Lessons 05-10  |     |   Lessons 11-14  |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
                         +------------------+     +------------------+
                         |   PHASE 5        |     |   PHASE 4        |
                         |   Production     |<----|   Agents         |
                         |   Lessons 18-20  |     |   Lessons 15-17  |
                         +------------------+     +------------------+
```

---

## Phase 1: Foundations (Talk to Models Like a Pro)

Think of this like learning to drive. Before you build a car,
you need to steer one.

- [ ] [01 - Prompt Engineering](01-prompt-engineering.md)
- [ ] [02 - Structured Outputs](02-structured-outputs.md)
- [ ] [03 - Evaluation](03-evaluation.md)
- [ ] [04 - Prompt Testing](04-prompt-testing.md)

**You'll build:** A prompt library with automated tests

---

## Phase 2: RAG Systems (Give Models Memory)

Like giving someone a textbook before an exam instead of
hoping they memorized everything.

- [ ] [05 - Embeddings in Practice](05-embeddings-in-practice.md)
- [ ] [06 - Vector Databases](06-vector-databases.md)
- [ ] [07 - Chunking Strategies](07-chunking-strategies.md)
- [ ] [08 - RAG Pipeline](08-rag-pipeline.md)
- [ ] [09 - Advanced RAG](09-advanced-rag.md)
- [ ] [10 - Evaluating RAG](10-evaluating-rag.md)

**You'll build:** A "chat with your docs" system with evaluation

---

## Phase 3: Fine-Tuning (Teach Models New Tricks)

Like hiring someone with general skills and then training them
on your company's specific processes.

- [ ] [11 - When to Fine-Tune](11-when-to-finetune.md)
- [ ] [12 - LoRA & QLoRA](12-lora-qlora.md)
- [ ] [13 - Dataset Preparation](13-dataset-preparation.md)
- [ ] [14 - Fine-Tuning in Practice](14-finetuning-practice.md)

**You'll build:** A fine-tuned model for a specific task

---

## Phase 4: Agents (Give Models Hands)

Like upgrading from a consultant who gives advice to an
employee who can actually do the work.

- [ ] [15 - AI Agents](15-ai-agents.md)
- [ ] [16 - Function Calling & MCP](16-function-calling-mcp.md)
- [ ] [17 - Multi-Agent Systems](17-multi-agent-systems.md)

**You'll build:** An agent that can research and take actions

---

## Phase 5: Production (Ship It)

The gap between a demo and production is where most AI
projects die. Don't let yours.

- [ ] [18 - Production AI Apps](18-production-ai-apps.md)
- [ ] [19 - Cost Optimization](19-cost-optimization.md)
- [ ] [20 - AI Safety & Guardrails](20-ai-safety-guardrails.md)

**You'll build:** A production-ready AI application

---

## Reference Materials

- [Model Comparison Table](reference-models.md)
- [AI Engineering Tools Guide](reference-tools.md)

---

## Prerequisites

- Python 3.10+
- Basic understanding of APIs
- A terminal you're comfortable in
- An OpenAI or Anthropic API key

```
pip install openai anthropic sentence-transformers \
  chromadb tiktoken pydantic datasets transformers \
  ragas langchain pinecone-client
```

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

Each lesson is designed to be completed in 30-60 minutes.
Do them in order. The exercises build on each other.

Start here: [01 - Prompt Engineering](01-prompt-engineering.md)

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Designing Machine Learning Systems** by Chip Huyen (O'Reilly, 2022) — Production ML system design
- **Build a Large Language Model (From Scratch)** by Sebastian Raschka (Manning, 2024) — Understand what's under the hood
