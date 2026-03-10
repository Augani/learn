# LLMs & Transformers — How ChatGPT and Claude Actually Work

From "Attention Is All You Need" to modern LLMs.
How the transformer architecture changed everything, and what goes
into building systems like GPT-4 and Claude.

Prerequisite: Track 7 (ML Fundamentals) — you need to understand
neural networks and embeddings first.

---

## Reference Files

- [Timeline](./reference-timeline.md) — Key milestones from Word2Vec to GPT-4
- [Glossary](./reference-glossary.md) — Transformer and LLM terms explained
- [Prompting vs RAG vs Fine-Tuning](./reference-prompting-rag-finetuning.md) — Which lever to pull for which product problem

---

## The Roadmap

### Phase 1: Before Transformers — The Problems (Hours 1–6)
- [ ] [Lesson 01: Language modeling — predicting the next word](./01-language-modeling.md)
- [ ] [Lesson 02: Tokenization — how text becomes numbers](./02-tokenization.md)
- [ ] [Lesson 03: Sequence-to-sequence and the bottleneck problem](./03-seq2seq-bottleneck.md)

### Phase 2: The Transformer (Hours 7–18)
- [ ] [Lesson 04: Attention — the breakthrough idea](./04-attention.md)
- [ ] [Lesson 05: Self-attention — words paying attention to each other](./05-self-attention.md)
- [ ] [Lesson 06: Multi-head attention — looking at text from multiple angles](./06-multi-head-attention.md)
- [ ] [Lesson 07: The full transformer architecture — putting it all together](./07-transformer-architecture.md)
- [ ] [Lesson 08: Positional encoding — how transformers know word order](./08-positional-encoding.md)

### Phase 3: From Transformers to ChatGPT (Hours 19–30)
- [ ] [Lesson 09: BERT — understanding text (encoder-only)](./09-bert.md)
- [ ] [Lesson 10: GPT — generating text (decoder-only)](./10-gpt.md)
- [ ] [Lesson 11: Scaling laws — why bigger models are smarter](./11-scaling-laws.md)
- [ ] [Lesson 12: Training an LLM — pretraining on the internet](./12-pretraining.md)
- [ ] [Lesson 13: RLHF — teaching models to be helpful (how Claude learns)](./13-rlhf.md)

### Phase 4: How Modern LLMs Work (Hours 31–40)
- [ ] [Lesson 14: Inference — how an LLM generates a response](./14-inference.md)
- [ ] [Lesson 15: Context windows, RAG, and memory](./15-context-rag.md)
- [ ] [Lesson 16: The modern LLM landscape — a late-2024 snapshot](./16-modern-landscape.md)

---

## How to use these lessons

Every lesson has:
1. Concept explained with everyday analogies
2. Visual diagrams of the architecture
3. Python code where helpful (PyTorch for attention, etc.)
4. "What would happen if..." thought experiments
5. Connection to real systems (GPT, Claude, etc.)
