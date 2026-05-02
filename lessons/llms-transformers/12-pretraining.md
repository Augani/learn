# Lesson 12: Pretraining — Training an LLM on the Internet

You now know the architecture (transformer), the training objective
(predict the next token), and the scaling laws (bigger + more data =
better). This lesson covers the actual process of pretraining: how you
take a randomly initialized model and turn it into something that
understands language, knows facts, writes code, and reasons about the
world.

---

## The Three Stages of Building a Chat Model

Building something like ChatGPT or Claude happens in three distinct
stages:

```
Stage 1: PRETRAINING (this lesson)
  │  Train on trillions of tokens of internet text
  │  The model learns language, facts, reasoning
  │  Cost: $1M - $100M+
  │  Time: Weeks to months
  │
  ▼
Stage 2: SUPERVISED FINE-TUNING (SFT)
  │  Fine-tune on curated (instruction, response) pairs
  │  The model learns to follow instructions
  │  Cost: $10K - $1M
  │  Time: Days to weeks
  │
  ▼
Stage 3: ALIGNMENT (RLHF / DPO) (Lesson 13)
     Optimize for human preferences
     The model learns to be helpful, harmless, honest
     Cost: $100K - $10M
     Time: Days to weeks
```

Pretraining is by far the most expensive and time-consuming stage.
It's where the model acquires the vast majority of its knowledge and
capabilities. Everything after is refinement.

**Analogy:** Pretraining is like going to school for 16 years (K-12 +
college). SFT is like job orientation ("here's how we do things here").
RLHF is like your first performance review ("here's what good work
looks like, do more of that").

---

## The Training Data

### What Goes In

Modern LLMs are trained on a mixture of text sources:

```
┌────────────────────┬────────────┬──────────────────────────┐
│ Source             │ ~% of Data │ What It Teaches          │
├────────────────────┼────────────┼──────────────────────────┤
│ Web pages          │ 50-60%     │ General knowledge,       │
│ (CommonCrawl)      │            │ conversational patterns  │
├────────────────────┼────────────┼──────────────────────────┤
│ Code repositories  │ 10-20%     │ Programming, logic,      │
│ (GitHub)           │            │ structured thinking      │
├────────────────────┼────────────┼──────────────────────────┤
│ Books              │ 5-10%      │ Long-form reasoning,     │
│                    │            │ narrative, deep topics   │
├────────────────────┼────────────┼──────────────────────────┤
│ Wikipedia          │ 3-5%       │ Factual knowledge,       │
│                    │            │ well-structured text     │
├────────────────────┼────────────┼──────────────────────────┤
│ Academic papers    │ 3-5%       │ Scientific knowledge,    │
│ (arXiv, etc.)      │            │ technical writing        │
├────────────────────┼────────────┼──────────────────────────┤
│ Forums / Q&A       │ 5-10%      │ Conversational patterns, │
│ (Reddit, StackOvfl)│            │ problem-solving          │
├────────────────────┼────────────┼──────────────────────────┤
│ Other              │ 5-10%      │ Specialized domains      │
└────────────────────┴────────────┴──────────────────────────┘
```

### Scale of the Data

```
Model           Training Tokens      Approximate Text Size

GPT-2           ~10 billion          ~40 GB
GPT-3           300 billion          ~570 GB
Chinchilla      1.4 trillion         ~5 TB
Llama 2         2 trillion           ~8 TB
Llama 3         15 trillion          ~60 TB
```

To put this in perspective: 15 trillion tokens is roughly the
equivalent of reading every book ever written... about 50 times over.

### Data Curation: Garbage In, Garbage Out

Raw internet text is messy. Before training, massive effort goes into
cleaning the data:

**Step 1: Deduplication**
Remove exact and near-duplicate content. The internet has enormous
amounts of copied text (boilerplate footers, reproduced articles,
scraped content). Without deduplication, the model memorizes specific
text instead of learning patterns.

```
Before dedup:  100TB of raw web text
After dedup:   ~30TB of unique text (70% was duplicates!)
```

**Step 2: Quality Filtering**
Not all text is equally useful. Quality filters remove:
- Machine-generated spam
- Boilerplate text (cookie notices, navigation menus)
- Very short documents (likely not informative)
- Text with too many special characters or formatting artifacts

A common approach: train a small classifier to predict "is this text
from Wikipedia or a random web page?" and keep only text that scores
highly on the "Wikipedia-like" scale.

```python
def quality_filter(document, classifier):
    score = classifier.predict_quality(document)
    if score < QUALITY_THRESHOLD:
        return None  # discard
    if len(document.split()) < MIN_WORDS:
        return None  # too short
    if document.count('http') / len(document.split()) > 0.1:
        return None  # too many links (likely spam)
    return document
```

**Step 3: Toxicity and PII Removal**
Filter out text that is:
- Hate speech, harassment, explicit content
- Contains personal information (phone numbers, addresses, SSNs)
- Contains malware, hacking instructions, or other dangerous content

This is imperfect -- some toxic content gets through, and some benign
content gets caught. But it significantly reduces the model's exposure
to harmful patterns.

**Step 4: Language and Domain Balancing**
Decide how much weight to give each language, domain, and source.
Training on 90% English makes the model great at English but poor at
other languages. Training on 50% code makes the model great at coding
but might reduce general knowledge.

```
Data mixture (approximate for an English-focused model):

English web text    ████████████████████████████████  55%
Code                ████████████                      20%
Books               ███                                5%
Wikipedia           ██                                 3%
Scientific papers   ██                                 3%
Multilingual text   ██████                            10%
Other               ██                                 4%
```

---

## The Training Process

### Forward and Backward Pass

The core training loop is the same as any neural network:

```
1. Take a batch of text sequences (e.g., 2048 tokens each)
2. FORWARD PASS: Run through the transformer, get predictions
3. COMPUTE LOSS: How wrong were the next-token predictions?
4. BACKWARD PASS: Compute gradients (how to adjust each weight)
5. UPDATE WEIGHTS: Apply gradients with optimizer (AdamW)
6. Repeat billions of times
```

```python
for batch in dataloader:
    tokens = batch['input_ids']        # shape: [batch_size, seq_len]
    targets = tokens[:, 1:]            # shifted by 1 (next token)
    inputs = tokens[:, :-1]

    logits = model(inputs)             # forward pass
    loss = cross_entropy(
        logits.reshape(-1, vocab_size),
        targets.reshape(-1)
    )

    loss.backward()                    # backward pass
    optimizer.step()                   # update weights
    optimizer.zero_grad()

    if step % LOG_INTERVAL == 0:
        print(f"Step {step}, Loss: {loss.item():.4f}")
```

### Training at Scale: Parallelism

A single GPU can't hold a 70B parameter model (it needs ~140GB in
float16, but the best GPUs have 80GB). You need to split the work
across many GPUs. There are three main strategies:

**Data Parallelism:** Each GPU has a full copy of the model, but
processes a different batch of data. Gradients are averaged across
GPUs.

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  GPU 0   │  │  GPU 1   │  │  GPU 2   │  │  GPU 3   │
│          │  │          │  │          │  │          │
│ Full     │  │ Full     │  │ Full     │  │ Full     │
│ Model    │  │ Model    │  │ Model    │  │ Model    │
│          │  │          │  │          │  │          │
│ Batch A  │  │ Batch B  │  │ Batch C  │  │ Batch D  │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │
     └─────────────┴─────────────┴─────────────┘
                    Average gradients
```

Works when the model fits on one GPU. For larger models, we need more.

**Tensor Parallelism:** Split individual layers across GPUs. Each GPU
computes part of the matrix multiplication.

```
One attention layer, split across 4 GPUs:

                Input
                  │
    ┌─────┬───────┼───────┬─────┐
    │     │       │       │     │
  GPU 0  GPU 1  GPU 2  GPU 3
  Head   Head   Head   Head
  0-7    8-15   16-23  24-31
    │     │       │       │
    └─────┴───────┼───────┴─────┘
                  │
              Concatenate
```

**Pipeline Parallelism:** Split different layers across GPUs. GPU 0
has layers 0-11, GPU 1 has layers 12-23, etc.

```
Input → [GPU 0: Layers 0-11] → [GPU 1: Layers 12-23] →
      → [GPU 2: Layers 24-35] → [GPU 3: Layers 36-47] → Output
```

In practice, large model training uses ALL THREE simultaneously:

```
┌──────────────────────────────────────────────────────┐
│            Combined Parallelism Strategy             │
│                                                      │
│  Pipeline parallel: Split layers across GPU groups   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Layers 0-31 │  │ Layers 32-63│  │ Layers 64-95│ │
│  │             │  │             │  │             │ │
│  │ Tensor par: │  │ Tensor par: │  │ Tensor par: │ │
│  │ Split each  │  │ Split each  │  │ Split each  │ │
│  │ layer across│  │ layer across│  │ layer across│ │
│  │ 8 GPUs      │  │ 8 GPUs      │  │ 8 GPUs      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                      │
│  Data parallel: Replicate above across GPU clusters  │
│  Cluster A (above) | Cluster B (copy) | ...          │
└──────────────────────────────────────────────────────┘
```

### Mixed-Precision Training

Training in full float32 (32 bits per number) is slow and memory-
hungry. Mixed-precision training uses float16 or bfloat16 for most
operations (2x faster, 2x less memory) but keeps a float32 copy of
the weights for numerical stability during updates.

```
┌──────────────┬──────────┬───────────────────────────┐
│ Precision    │ Bits     │ Used For                  │
├──────────────┼──────────┼───────────────────────────┤
│ float32      │ 32       │ Master weights, loss      │
│              │          │ scaling, critical ops      │
│ bfloat16     │ 16       │ Forward/backward pass,    │
│              │          │ most computation           │
│ float16      │ 16       │ Alternative to bfloat16   │
│              │          │ (needs loss scaling)       │
└──────────────┴──────────┴───────────────────────────┘

bfloat16 has the same exponent range as float32
(can represent the same scale of numbers) but less
precision. This makes it ideal for training -- values
don't overflow even if they're imprecise.
```

### Training Duration and Checkpointing

Training a large model takes weeks to months. During that time:

- GPUs fail (hardware failures are inevitable at scale)
- Bugs are discovered
- Loss might spike (training instability)

**Checkpointing** saves the model's state periodically so training
can resume from the last checkpoint after a failure.

```
Training timeline:

Step 0          Step 10K        Step 20K        Step 30K
│               │               │               │
▼               ▼               ▼               ▼
Start    Save checkpoint  Save checkpoint  Save checkpoint
                                    │
                              GPU failure!
                                    │
                              Resume from
                              Step 20K checkpoint
                              (lost only 10K steps,
                               not 30K)
```

---

## What the Model Learns

During pretraining, the model learns a remarkable range of capabilities
simply by predicting the next token:

### Layer by Layer

Research has shown that different layers capture different types of
information:

```
Layer 0-2 (early):
  └─ Surface features: word identity, simple patterns

Layer 3-10 (middle-early):
  └─ Syntax: grammar, sentence structure, dependency parsing

Layer 11-20 (middle):
  └─ Semantics: meaning, entity types, relationships

Layer 21-30 (middle-late):
  └─ Facts: world knowledge, associations, common sense

Layer 31+ (late):
  └─ Task-specific: reasoning, complex inference, generation
```

**Analogy:** Learning a foreign language. First you learn the sounds
(early layers). Then grammar rules (middle layers). Then vocabulary
and meaning (later layers). Finally, you can hold conversations and
make arguments (deepest layers).

### What Pretraining DOESN'T Teach

The base model is remarkably capable but has critical limitations:

```
✓ Knows grammar, facts, code patterns, reasoning
✗ Doesn't follow instructions reliably
✗ May generate toxic content
✗ Doesn't know when to stop generating
✗ Doesn't have a consistent personality
✗ May hallucinate confidently
✗ Doesn't distinguish between "complete this text" and "answer this question"
```

This is why pretraining alone produces a "base model" -- powerful
but not ready for users.

---

## The Base Model: Capable but Unaligned

A base model (pretrained only, no fine-tuning) is essentially a text
completion engine. It predicts what text would come next in its
training data.

```
Prompt: "What is the capital of France?"

Base model might generate:
  (a) "What is the capital of Germany? What is the capital of..."
      (continuing a quiz pattern)

  (b) "\n\nParis is the capital of France, located on the Seine..."
      (continuing a Wikipedia-style article)

  (c) "The answer is Paris.\n\nQuestion 2: What is the capital..."
      (continuing an exam)

It depends on what pattern the model recognizes in the prompt.
None of these are "answering" the question -- they're all
"completing" a text that starts with that sentence.
```

**Analogy:** A base model is like a method actor who has studied
thousands of characters. If you give them a line, they'll continue
in whatever character the line suggests. But they won't reliably play
the character YOU want unless you direct them clearly.

---

## Instruction Tuning: The Bridge to Chat

Between pretraining and RLHF sits **instruction tuning** (also called
supervised fine-tuning or SFT). This step trains the model on
curated (instruction, response) pairs:

```
Training examples for instruction tuning:

{
  "instruction": "What is the capital of France?",
  "response": "The capital of France is Paris."
}

{
  "instruction": "Write a Python function to reverse a string.",
  "response": "def reverse_string(s):\n    return s[::-1]"
}

{
  "instruction": "Summarize the following text in 3 bullets: [text]",
  "response": "- Point 1\n- Point 2\n- Point 3"
}
```

These examples are created by:
- Human annotators writing high-quality responses
- Filtering and curating existing Q&A data
- Using a stronger model to generate training data (distillation)

### The Effect of Instruction Tuning

```
Before SFT (base model):
  Input:  "Explain quantum computing simply."
  Output: "Explain quantum computing simply to a
           five-year-old. Explain quantum computing..."
           (continues the instruction, doesn't answer)

After SFT:
  Input:  "Explain quantum computing simply."
  Output: "Quantum computing uses quantum mechanics
           to process information. Regular computers
           use bits (0 or 1). Quantum computers use
           qubits that can be both 0 and 1 at the
           same time..."
           (actually answers the question)
```

Instruction tuning is relatively cheap (thousands of examples, days
of training) compared to pretraining (trillions of tokens, months).
But it makes a dramatic difference in usability.

---

## The Training Loss Curve

During pretraining, you monitor the loss (how wrong the predictions
are) over time. A healthy training run looks like this:

```
Loss
│
│ ╲
│  ╲
│   ╲
│    ╲
│     ╲
│      ╲
│       ╲                    Healthy training:
│        ╲╲                  smooth, decreasing loss
│          ╲╲
│            ╲╲╲
│               ╲╲╲╲
│                   ╲╲╲╲╲╲╲╲──────
│
└──────────────────────────────────── Training steps

Common problems:

│ ╲╲╲╲╲╲╲╲──────────────        Plateaued: learning rate
│                                too low or model saturated

│ ╲╲╲╲╲╲╲    ╱╲╲╲╲╲╲╲╲         Loss spike: bad batch,
│              ╲                 numerical instability

│ ╲╲╲╲╲╲╲╲╲╲╲╱╱╱╱╱╱╱╱╱         Divergence: learning rate
│                                too high, training broken
```

### Loss Spikes

During training, the loss occasionally spikes -- sometimes dramatically.
These spikes can be caused by:
- Unusual data batches (very long sequences, unusual formatting)
- Numerical instability (gradients too large or too small)
- Hardware issues (corrupted computation on a failing GPU)

Teams monitor training 24/7 and may need to restart from a checkpoint
if a spike doesn't recover.

---

## Training Infrastructure: The Full Picture

```
┌───────────────────────────────────────────────────────┐
│                Training Infrastructure                 │
├───────────────────────────────────────────────────────┤
│                                                        │
│  Data Pipeline:                                        │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │Raw Data │→│ Clean &  │→│ Tokenize │→│ Batch  ││
│  │(100TB+) │  │ Filter   │  │          │  │ & Shard││
│  └─────────┘  └──────────┘  └──────────┘  └────┬───┘│
│                                                  │    │
│  Training Loop:                                  │    │
│  ┌──────────────────────────────────────────────┐│    │
│  │                                              ││    │
│  │  ┌─────────────────────────────────────┐     ││    │
│  │  │     GPU Cluster (1000s of GPUs)     │     ││    │
│  │  │                                     │     ││    │
│  │  │  Forward → Loss → Backward → Update │     ││    │
│  │  │                                     │     ││    │
│  │  └─────────────────────────────────────┘     ││    │
│  │         │              │                     ││    │
│  │    Checkpoints    Metrics/Logs               ││    │
│  │         │              │                     ││    │
│  │         ▼              ▼                     ││    │
│  │  ┌──────────┐  ┌──────────────┐             ││    │
│  │  │ Storage  │  │ Monitoring   │             ││    │
│  │  │ (PB)     │  │ (Weights &   │             ││    │
│  │  │          │  │  Biases, etc)│             ││    │
│  │  └──────────┘  └──────────────┘             ││    │
│  └──────────────────────────────────────────────┘│    │
│                                                        │
│  Team: 10-50+ ML engineers, infra engineers,           │
│        data engineers, researchers                      │
│                                                        │
└───────────────────────────────────────────────────────┘
```

---

## Pretraining Hyperparameters

Key decisions that affect training:

```
┌───────────────────┬──────────────────┬──────────────────────┐
│ Hyperparameter    │ Typical Range    │ Effect               │
├───────────────────┼──────────────────┼──────────────────────┤
│ Learning rate     │ 1e-4 to 6e-4    │ Too high: diverges   │
│                   │                  │ Too low: slow        │
│                   │                  │                      │
│ Batch size        │ 2M - 16M tokens │ Larger: more stable  │
│                   │                  │ Smaller: faster start│
│                   │                  │                      │
│ Warmup steps      │ 1000-5000       │ Gradually increase   │
│                   │                  │ learning rate        │
│                   │                  │                      │
│ LR schedule       │ Cosine decay    │ Decrease LR over     │
│                   │                  │ training             │
│                   │                  │                      │
│ Weight decay      │ 0.01 - 0.1      │ Regularization       │
│                   │                  │                      │
│ Sequence length   │ 2048 - 8192     │ Longer = more context│
│                   │                  │ but more memory      │
└───────────────────┴──────────────────┴──────────────────────┘
```

### The Learning Rate Schedule

Most models use a warmup + cosine decay schedule:

```
Learning Rate
│
│         ╱╲
│       ╱    ╲
│     ╱       ╲╲
│   ╱            ╲╲
│ ╱                 ╲╲╲
│╱                      ╲╲╲╲╲
│                             ╲╲╲╲╲╲╲╲────
└───────────────────────────────────────────
  Warmup     Peak        Cosine Decay
  (1-5K      (max LR)    (gradually decrease
   steps)                 to ~10% of peak)
```

---

## Thought Experiments

1. **Data Quality vs Quantity:** You have two options: 1 trillion tokens
   of unfiltered web text, or 200 billion tokens of curated, high-quality
   text. Which would produce a better model? Why might the answer
   depend on model size?

2. **The Code Effect:** Models trained with code in the data mixture
   perform better at reasoning and math, even on non-code tasks. Why
   might learning to predict code tokens improve general reasoning?

3. **Memorization vs Generalization:** A model trained on 2 trillion
   tokens has seen each token roughly once (one epoch). A model trained
   on 100 billion tokens for 20 epochs has seen each token 20 times.
   Which is more likely to memorize specific text? Which generalizes
   better?

4. **The Instruction Gap:** Why can't pretraining alone produce a
   good chatbot? The internet contains millions of conversations.
   Wouldn't the model learn conversational patterns from that data?

5. **Training Failure:** You're monitoring a 70B parameter training
   run on day 45 of a 90-day run. The loss suddenly spikes and doesn't
   recover after 6 hours. You have checkpoints from day 44. What do
   you do? What could have caused the spike?

---

## Key Takeaways

1. **Pretraining is the foundation** -- the model learns language,
   facts, and reasoning from trillions of tokens of text.
2. **Data curation is critical** -- filtering, deduplication, and
   quality control determine what the model learns.
3. **Training requires massive infrastructure** -- thousands of GPUs,
   sophisticated parallelism, months of computation.
4. **Mixed-precision training** balances speed and numerical stability.
5. **The base model is capable but unaligned** -- it predicts text well
   but doesn't follow instructions or behave helpfully.
6. **Instruction tuning (SFT)** bridges the gap from text completion
   to instruction following, but alignment (RLHF) is still needed.

Next: [Lesson 13 — RLHF: Teaching Models to Be Helpful](./13-rlhf.md)
