# Reference: Timeline of Key Milestones — From Neural Language Models to Modern LLMs

How we got from "what if a neural network could predict words?" to ChatGPT and Claude.

---

## 2003 — Neural Language Models (Bengio et al.)

**Paper:** "A Neural Probabilistic Language Model"

Before this, language models just counted how often word sequences appeared
(n-grams). Bengio showed you could use a neural network to predict the next
word AND learn word representations (embeddings) at the same time.

**Why it mattered:** First proof that neural networks could model language.
The idea of learned word vectors started here, even though it took a decade
for hardware to catch up.

---

## 2013 — Word2Vec (Mikolov et al., Google)

**Paper:** "Efficient Estimation of Word Representations in Vector Space"

Words become vectors (lists of numbers) where similar words are close together.
The famous result: king - man + woman = queen.

**Why it mattered:** Showed that word meaning could be captured mathematically.
Every NLP system started using Word2Vec vectors as input. Made embeddings
mainstream. Fast to train (ran on a single machine in hours, not weeks).

---

## 2014 — Sequence-to-Sequence with Attention (Bahdanau et al.)

**Paper:** "Neural Machine Translation by Jointly Learning to Align and Translate"

Machine translation with RNNs had a bottleneck: the entire input sentence
was squeezed into a single fixed-size vector. Bahdanau added attention — the
decoder could look back at specific parts of the input when generating each
output word.

**Why it mattered:** Birth of the attention mechanism. Instead of compressing
everything into one vector, the model could selectively focus on relevant parts
of the input. This single idea eventually led to the transformer.

---

## 2014 — GANs (Goodfellow et al.)

**Paper:** "Generative Adversarial Networks"

Two neural networks competing: a generator creates fake data, a discriminator
tries to tell fake from real. They push each other to improve.

**Why it mattered:** Showed neural networks could generate realistic content
(images, later text). The generator/discriminator framework influenced later
generative AI research. Not directly related to transformers, but part of the
"neural networks can create things" revolution.

---

## 2015 — Attention Mechanism Matures

**Paper:** "Effective Approaches to Attention-based Neural Machine Translation" (Luong et al.)

Refined attention for translation. Introduced different attention score
functions (dot product, general, concatenation) and "global" vs "local"
attention.

**Why it mattered:** Made attention practical and showed multiple ways to
compute it. The dot-product attention from this work became the basis for
transformer attention. Researchers realized attention was the most valuable
part of their translation models.

---

## 2017 — "Attention Is All You Need" (Vaswani et al., Google)

**Paper:** "Attention Is All You Need"

**THE transformer paper.** Threw away RNNs and convolutions entirely. Built
a model using ONLY attention mechanisms (self-attention + cross-attention),
feed-forward layers, and residual connections.

```
Key innovations:
- Self-attention (words attend to each other, not just decoder to encoder)
- Multi-head attention (multiple attention patterns in parallel)
- Positional encoding (since there's no recurrence to track position)
- Parallel training (no sequential bottleneck like RNNs)
```

**Why it mattered:** Changed everything. Faster to train than RNNs (parallel
processing). Better at capturing long-range dependencies. Every major language
model since then is built on this architecture. The single most important
paper in modern AI.

---

## 2018 — GPT-1 (OpenAI)

**Paper:** "Improving Language Understanding by Generative Pre-Training"

Take the transformer decoder, pretrain it on a massive text corpus (predict
the next word), then fine-tune on specific tasks. 117M parameters.

**Why it mattered:** Proved the "pretrain then fine-tune" paradigm. A single
model pretrained on general text could be adapted to many different tasks
(classification, question answering, etc.) with minimal task-specific data.

---

## 2018 — BERT (Google)

**Paper:** "BERT: Pre-training of Deep Bidirectional Transformers"

Used the transformer encoder (not decoder). Trained by masking random words
and predicting them (masked language modeling). Bidirectional — sees context
from both left and right. 340M parameters.

**Why it mattered:** Dominated NLP benchmarks overnight. Showed that
bidirectional context (seeing the whole sentence at once) was powerful for
understanding tasks. BERT became the default for search, classification,
and question answering. Google used it in Search starting in 2019.

---

## 2019 — GPT-2 (OpenAI)

**Paper:** "Language Models are Unsupervised Multitask Learners"

GPT-1 scaled up to 1.5B parameters. Could generate coherent paragraphs of
text. OpenAI initially refused to release the full model, calling it "too
dangerous" due to potential misuse.

**Why it mattered:** First model that generated text good enough to fool
casual readers. The "too dangerous to release" framing sparked public
debate about AI safety. Showed that just making the model bigger and giving
it more data produced qualitatively different behavior. Demonstrated
zero-shot capabilities (performing tasks it was never explicitly trained on).

---

## 2020 — GPT-3 (OpenAI)

**Paper:** "Language Models are Few-Shot Learners"

175 BILLION parameters. Trained on a huge slice of the internet. Could
perform tasks with just a few examples in the prompt (few-shot learning)
or even zero examples (zero-shot). No fine-tuning needed.

```
GPT-3 in context:
- GPT-1:    117M parameters
- GPT-2:    1.5B parameters
- GPT-3:    175B parameters (117x bigger than GPT-2)
```

**Why it mattered:** Proved that scale alone could unlock capabilities.
In-context learning (learning from examples in the prompt) was a surprise.
Made "prompt engineering" a thing. API access let developers build products
on top of it. The starting gun for the modern AI industry.

---

## 2020 — Scaling Laws (Kaplan et al., OpenAI)

**Paper:** "Scaling Laws for Neural Language Models"

Discovered predictable mathematical relationships between model performance
and three factors: model size (parameters), dataset size, and compute budget.
Performance improves as a power law with each factor.

**Why it mattered:** Turned model training from art into science. You could
now PREDICT how good a model would be before training it. Showed that bigger
models are more sample-efficient (learn more per training example). Gave
companies a roadmap: spend X dollars on compute, get Y improvement. This
paper is why everyone started building bigger models.

---

## 2022 — InstructGPT & ChatGPT (OpenAI)

**Paper:** "Training language models to follow instructions with human feedback"

GPT-3.5 + RLHF (Reinforcement Learning from Human Feedback). Three steps:
1. Fine-tune on human-written examples of helpful responses
2. Train a reward model on human preferences (which response is better?)
3. Use RL (PPO) to optimize the language model against the reward model

ChatGPT launched November 30, 2022. Reached 100 million users in 2 months.

**Why it mattered:** Turned a text prediction engine into a conversational
assistant. RLHF was the key innovation — it aligned the model's outputs
with what humans actually want (helpful, harmless, honest). Raw language
models are weird and unpredictable; RLHF-trained models feel like talking
to a helpful person. This is what made AI mainstream.

---

## 2023 — GPT-4 (OpenAI)

Multimodal (text + images). Massive improvement in reasoning, coding,
and following complex instructions. Exact parameter count not disclosed
(rumored mixture-of-experts with ~1.8T total parameters).

**Why it mattered:** First widely-available model that felt genuinely
useful for complex work. Passed the bar exam, scored well on AP tests.
Multimodal input (understanding images) opened new use cases. Set the
bar that every other lab raced to match.

---

## 2023 — The Competition Arrives

- **Claude (Anthropic):** Focus on safety, Constitutional AI (RLAIF),
  long context windows. Founded by former OpenAI researchers.
- **Llama (Meta):** Open-source/open-weights models. Llama 2 released
  with permissive license. Sparked the open-source LLM ecosystem.
- **Gemini (Google DeepMind):** Google's multimodal model, successor to
  PaLM. Natively multimodal (trained on text, images, audio, video).

**Why it mattered:** Broke OpenAI's monopoly. Open-source models meant
anyone could run LLMs locally. Competition drove rapid improvement.
Different labs pursued different approaches (safety-focused, open-source,
multimodal-first).

---

## 2024 — The Open-Source Explosion and Continued Scaling

- **Claude 3 family (Anthropic):** Haiku, Sonnet, Opus. Long context
  (200K tokens). Competitive with GPT-4 on many benchmarks.
- **Llama 3 (Meta):** 8B and 70B parameter models. Open weights.
  Performance rivaling closed models from a year prior.
- **Mixtral, Mistral (Mistral AI):** Efficient mixture-of-experts models
  from a French startup. Showed you don't need Google-scale compute.
- **Phi, Gemma, Qwen:** Small but capable models from Microsoft, Google,
  Alibaba. Proved smaller models can punch above their weight.

**Why it mattered:** LLMs became a commodity. You could run capable models
on a laptop. Fine-tuning became accessible. The gap between open and closed
models narrowed dramatically. Focus shifted from "can we build it?" to
"how do we use it effectively?"

---

## The Big Picture

```
2003-2016:  The foundations
            Neural language models, word vectors, attention mechanism

2017:       The breakthrough
            Transformers ("Attention Is All You Need")

2018-2020:  Scaling up
            GPT-1 → GPT-2 → GPT-3, BERT, scaling laws

2022:       The alignment breakthrough
            RLHF turns prediction engines into conversational AI

2023-2024:  The explosion
            Competition, open-source, multimodal, widespread adoption
```

Every modern LLM — GPT-4, Claude, Gemini, Llama — is a transformer at
its core, trained with variations of the pretrain-then-align pipeline.
The differences are in training data, scale, alignment techniques, and
architectural tweaks. The fundamental architecture from the 2017 paper
remains remarkably unchanged.

---

[Back to Roadmap](./00-roadmap.md)
