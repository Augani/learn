# Transformer & LLM Glossary

Terms and concepts for everything in these lessons, explained with
everyday analogies.

---

## Architecture Terms

### Transformer
The neural network architecture introduced in "Attention Is All You
Need" (2017). Uses attention mechanisms instead of recurrence (RNNs)
to process sequences. All modern LLMs are based on transformers.

**Analogy:** If RNNs are reading a book one word at a time, a
transformer reads the entire page at once, with every word checking
which other words it should pay attention to.

### Encoder
The half of the transformer that reads input and produces a rich
representation (understanding). Takes tokens in, produces contextualized
vectors out. Each token's output vector captures its meaning in context.

**Analogy:** A translator who listens to an entire paragraph in French
and builds a mental model of the meaning before producing any English.

### Decoder
The half of the transformer that generates output one token at a time.
Uses masked attention so each position can only see earlier positions
(no peeking at the future).

**Analogy:** The translator now speaking the English translation, one
word at a time, choosing each word based on the meaning they understood
plus the words they've already said.

### Encoder-Decoder (Seq2Seq Transformer)
The full original transformer with both encoder and decoder. The encoder
reads the input, the decoder generates the output while attending to
the encoder's representation via cross-attention.

**Examples:** T5, BART, the original transformer for translation.

### Encoder-Only
A transformer with only the encoder stack. Reads input bidirectionally
(every token sees every other token). Produces representations, not
generated text. Used for understanding tasks.

**Examples:** BERT, RoBERTa, DeBERTa.

### Decoder-Only
A transformer with only the decoder stack. Generates text autoregressively
(left to right). Each token can only see previous tokens (causal masking).
This is what GPT, Claude, and most modern LLMs use.

**Examples:** GPT-1/2/3/4, Claude, Llama, Mistral.

---

## Attention Concepts

### Attention
A mechanism that lets the model decide how much focus to place on each
part of the input when processing a particular element. Produces a
weighted combination of values based on how relevant each element is.

**Analogy:** When you read "The cat sat on the mat because it was tired,"
your brain automatically focuses on "cat" when interpreting "it." That
selective focus is attention.

### Self-Attention
Attention where a sequence attends to itself. Each token in the sequence
computes attention scores against every other token in the same sequence.
This is how a transformer understands relationships between words.

### Cross-Attention
Attention where the decoder attends to the encoder's output. The decoder
tokens (queries) look at encoder tokens (keys and values) to access the
input representation. Used in encoder-decoder models for tasks like
translation.

### Causal Attention (Masked Attention)
Self-attention where each position can only attend to earlier positions.
Future tokens are masked out (set to negative infinity before softmax).
This prevents the model from "cheating" by looking at words it hasn't
generated yet.

**Analogy:** Writing an essay where you can re-read what you've already
written, but you can't peek at what you're about to write next.

### Query (Q)
A vector representing "what am I looking for?" Each token produces a
query vector that is compared against all keys to determine what to
attend to.

### Key (K)
A vector representing "what do I contain?" Each token produces a key
vector that is compared against queries. High similarity between a
query and a key means that token is relevant.

### Value (V)
A vector representing "what information do I provide?" Once attention
weights are computed (from Q and K), the output is a weighted sum of
value vectors.

**Analogy (Q, K, V together):** You're at a library (Q = your question,
K = labels on each book's spine, V = the actual content inside each
book). You match your question against the labels, then read the content
of the best-matching books.

### Attention Head
A single attention computation with its own learned Q, K, V projection
matrices. Each head can learn to focus on different types of relationships
(syntactic, semantic, positional, etc.).

### Multi-Head Attention
Running multiple attention heads in parallel, each with different learned
projections, then concatenating and projecting the results. This lets the
model attend to information from different representation subspaces.

**Analogy:** Reading a sentence from multiple perspectives simultaneously
-- one head tracks grammar, another tracks who did what to whom, another
tracks sentiment.

---

## Transformer Components

### Positional Encoding / Positional Embedding
Information added to token embeddings to indicate position in the
sequence. Necessary because self-attention treats input as a set (no
inherent order). Without it, "dog bites man" and "man bites dog" would
look identical.

**Variants:**
- Sinusoidal (original paper)
- Learned embeddings (GPT-2)
- RoPE / Rotary (Llama, modern models)
- ALiBi (BLOOM)

### Residual Connection (Skip Connection)
A shortcut that adds the input of a layer directly to its output:
`output = layer(x) + x`. Prevents the vanishing gradient problem in
deep networks and lets each layer learn a modification rather than a
complete transformation.

**Analogy:** Editing a document. Instead of rewriting the whole thing,
you start with the original and apply tracked changes. The original
content (residual) is always preserved.

### Layer Normalization (LayerNorm)
Normalizes the values within a single training example across the
feature dimension. Stabilizes training by keeping values in a
reasonable range. Applied after (or before) each sub-layer in the
transformer.

**Analogy:** Grading on a curve within a single student's scores across
subjects -- making sure no one subject dominates the overall profile.

### Feed-Forward Network (FFN)
A two-layer fully connected network applied independently to each
position. Takes the attention output and transforms it through a wider
hidden layer (usually 4x the model dimension) and back. This is where
much of the model's "knowledge" is stored.

```
FFN(x) = Linear2(GELU(Linear1(x)))
         d_model -> 4*d_model -> d_model
```

**Analogy:** After the attention layer decides which words are related,
the FFN is like a lookup table that retrieves relevant knowledge about
those word combinations.

---

## Model Families

### BERT (Bidirectional Encoder Representations from Transformers)
An encoder-only model trained with Masked Language Modeling (predicting
masked tokens). Reads text bidirectionally. Excellent for understanding
tasks (classification, NER, question answering). Not used for generation.

### GPT (Generative Pre-trained Transformer)
A decoder-only model trained to predict the next token. Reads text
left-to-right (causal). The architecture behind ChatGPT, GPT-4, and
most modern chatbots. The "just predict the next word" approach that
scaled to general intelligence.

### T5 (Text-to-Text Transfer Transformer)
An encoder-decoder model that frames every NLP task as text-to-text.
Input: "translate English to German: Hello" -> Output: "Hallo".
Showed that a unified format works for classification, translation,
summarization, and more.

### RoBERTa
BERT trained better: more data, longer training, no NSP task, larger
batches. Same architecture, better results. Showed that BERT was
undertrained.

### ALBERT
A lightweight BERT with parameter sharing across layers and factorized
embeddings. Fewer parameters, competitive performance.

### DistilBERT
A smaller, faster BERT created through knowledge distillation. 60% the
size, 97% the performance, 2x faster.

### DeBERTa
BERT with disentangled attention (separate content and position
attention) and enhanced mask decoder. Currently one of the best
encoder-only models.

---

## Training Concepts

### Pretraining
The first stage of training where a model learns general language
understanding from massive text corpora. The model learns grammar,
facts, reasoning patterns, and world knowledge by predicting text.
Extremely expensive (millions of dollars in compute).

### Fine-Tuning
Adapting a pretrained model for a specific task by training it further
on task-specific data. Much cheaper than pretraining because the model
already understands language.

**Analogy:** Pretraining is like getting a general education (K-12 +
college). Fine-tuning is like specialized job training.

### Few-Shot Learning
Giving the model a few examples in the prompt and asking it to follow
the pattern. No weight updates -- the model "learns" from the examples
in context. GPT-3 demonstrated this capability.

```
Translate English to French:
sea otter => loutre de mer
cheese => fromage
dog =>
```

### Zero-Shot Learning
Asking the model to perform a task with no examples, relying entirely
on its pretrained knowledge. "Translate 'hello' to French" with no
examples.

### In-Context Learning
The broader phenomenon where LLMs learn from information provided in
the prompt (instructions, examples, context) without any weight
updates. Includes both few-shot and zero-shot.

---

## Alignment & Safety

### RLHF (Reinforcement Learning from Human Feedback)
A training technique where human preferences (ranking model outputs)
are used to train a reward model, which then guides the language
model toward producing outputs humans prefer.

### Reward Model
A model trained to predict which of two outputs a human would prefer.
Used as a proxy for human judgment during RLHF training.

### PPO (Proximal Policy Optimization)
A reinforcement learning algorithm used in RLHF to update the language
model's weights based on the reward model's scores, while preventing
the model from changing too drastically in any single update.

### DPO (Direct Preference Optimization)
An alternative to RLHF that skips the reward model entirely. Directly
optimizes the language model on human preference pairs (chosen vs
rejected outputs). Simpler and more stable than PPO.

### Constitutional AI (CAI)
Anthropic's approach to alignment. Instead of relying solely on human
feedback, the model critiques and revises its own outputs based on a
set of principles (a "constitution"). Used to train Claude.

### SFT (Supervised Fine-Tuning)
Fine-tuning a pretrained model on curated (instruction, response) pairs.
The first step in turning a base model into a chatbot. Teaches the model
to follow instructions rather than just predict text.

---

## Tokenization

### Tokenizer
The component that converts raw text into a sequence of integer token
IDs that the model can process. Also converts token IDs back to text.

### BPE (Byte Pair Encoding)
The most common tokenization algorithm. Starts with individual characters,
then iteratively merges the most frequent pairs into new tokens. Balances
vocabulary size against sequence length.

### Vocabulary
The fixed set of tokens a model knows. Typically 32K-100K tokens. Every
word, subword, or character the model can represent must be in (or
decomposable into pieces in) its vocabulary.

### Token
The basic unit of text for a model. Can be a word ("hello"), subword
("un" + "break" + "able"), or character. On average, one token is about
3/4 of an English word, or roughly 4 characters.

### Context Window
The maximum number of tokens a model can process in a single forward
pass. Everything the model can "see" at once -- both the prompt and the
response must fit within this limit.

| Model | Context Window |
|-------|---------------|
| GPT-3 | 2,048 tokens |
| GPT-3.5 Turbo | 16,384 tokens |
| GPT-4 | 8,192-32,768 tokens |
| GPT-4 Turbo | 128,000 tokens |
| Claude 3 | 200,000 tokens |
| Gemini 1.5 | 1,000,000 tokens |

---

## Generation & Sampling

### Temperature
A parameter that controls randomness in text generation. Divides the
logits by the temperature value before softmax. Lower temperature
(0.0-0.3) = more deterministic/focused. Higher temperature (0.7-1.5)
= more creative/random.

**Analogy:** Temperature 0 is like a conservative writer who always
picks the most obvious word. Temperature 1.5 is like a poet who
reaches for unexpected words.

### Top-k Sampling
Only consider the k most likely next tokens when sampling. If k=50,
the model picks randomly from the 50 most probable tokens (with their
relative probabilities preserved).

### Top-p / Nucleus Sampling
Only consider the smallest set of tokens whose cumulative probability
exceeds p. If p=0.9, keep adding the most likely tokens until their
probabilities sum to 90%, then sample from just those tokens.

**Advantage over top-k:** Adapts to the distribution. When the model is
confident (one token has 95% probability), very few tokens are
considered. When uncertain, more tokens are included.

### Greedy Decoding
Always pick the single most probable next token. Deterministic but
often produces repetitive, bland text. Temperature = 0 is effectively
greedy decoding.

### Beam Search
Track the top-b most probable sequences simultaneously, expanding each
at every step and keeping the best b overall. More thorough than greedy,
but still tends toward safe/generic outputs.

---

## Inference & Optimization

### Inference
The process of running a trained model to get predictions. For LLMs,
this means generating text from a prompt. Distinct from training (where
weights are updated).

### KV Cache
Cached key and value tensors from previous tokens during autoregressive
generation. Since past tokens don't change, their K and V vectors can
be stored and reused, avoiding redundant computation.

**Analogy:** When writing a long email, you don't re-read the entire
email from the beginning before writing each new word. The KV cache
is your memory of what you've already processed.

### Speculative Decoding
Using a small, fast "draft" model to generate several candidate tokens,
then verifying them in parallel with the large model. If the large model
agrees with the draft, you get multiple tokens for the cost of one
large-model forward pass.

### Quantization
Reducing the precision of model weights (e.g., float32 -> int8 or int4)
to use less memory and compute faster. Some quality is lost, but modern
quantization techniques minimize the impact.

| Precision | Bits per Weight | ~Memory for 70B Model |
|-----------|-----------------|----------------------|
| float32 | 32 | 280 GB |
| float16 | 16 | 140 GB |
| int8 | 8 | 70 GB |
| int4 | 4 | 35 GB |

### LoRA (Low-Rank Adaptation)
A fine-tuning technique that freezes the original model weights and adds
small trainable matrices (adapters) to each layer. Dramatically reduces
the memory and compute needed for fine-tuning.

**Analogy:** Instead of repainting an entire house (full fine-tuning),
you add a few accent walls (LoRA adapters) that change the look.

### QLoRA
LoRA applied to a quantized (4-bit) base model. Enables fine-tuning
70B+ parameter models on a single consumer GPU.

### Knowledge Distillation
Training a small "student" model to mimic a large "teacher" model.
The student learns from the teacher's output probabilities (soft labels)
rather than just the hard labels, capturing more nuanced knowledge.

---

## Retrieval & Context

### Hallucination
When a model generates text that sounds confident and plausible but is
factually incorrect. The model is not "lying" -- it is generating the
most probable continuation, which may not be true.

**Analogy:** A student who studied hard but mis-remembers a fact on the
exam and writes the wrong answer with full confidence.

### Grounding
Connecting model outputs to verifiable sources of truth. A grounded
response cites its sources or is constrained by retrieved documents.

### RAG (Retrieval-Augmented Generation)
A pattern where relevant documents are retrieved from a database and
included in the prompt before the model generates a response. Reduces
hallucination by giving the model actual source material.

```
User question
    |
    v
[Embed question] -> [Search vector DB] -> [Get relevant chunks]
    |
    v
[Add chunks to prompt] -> [LLM generates grounded answer]
```

---

## Prompt Engineering

### Prompt Engineering
The practice of crafting inputs (prompts) to get better outputs from
LLMs. Includes instruction design, example selection, output format
specification, and strategic structuring.

### System Prompt
A special prompt section that sets the model's behavior, persona, and
constraints. Processed before the user's message. "You are a helpful
coding assistant. Always provide working code examples."

### Chain-of-Thought (CoT)
Prompting the model to show its reasoning step by step before giving
a final answer. Dramatically improves performance on math, logic, and
multi-step reasoning tasks.

```
Without CoT: "What is 23 * 47?" -> "1081" (often wrong)
With CoT: "What is 23 * 47? Think step by step." ->
  "23 * 47 = 23 * 40 + 23 * 7 = 920 + 161 = 1081" (more reliable)
```

---

## Scale & Compute

### Parameter Count
The number of trainable weights in a model. Measured in millions (M)
or billions (B). GPT-3 has 175B parameters. Roughly correlates with
model capability, but architecture and training data matter too.

### FLOPS (Floating Point Operations Per Second)
A measure of computational speed. Training large models requires
exaflops (10^18 FLOPS) of compute. Used to calculate training costs.

### Compute Budget
The total amount of computation available for training, measured in
FLOP-seconds or GPU-hours. Determines how large a model can be and
how much data it can train on.

---

## Model Types

### Foundation Model
A large model trained on broad data that can be adapted for many tasks.
GPT-4, Claude, and Llama are foundation models. The term emphasizes
that one model serves as the "foundation" for many applications.

### Base Model
A foundation model after pretraining but before any fine-tuning or
alignment. Predicts text well but doesn't follow instructions and may
produce harmful outputs. Not suitable for direct user interaction.

### Chat Model / Instruct Model
A base model that has been fine-tuned (SFT) and aligned (RLHF/DPO) to
follow instructions, engage in conversation, and behave helpfully and
safely. ChatGPT, Claude, and Llama-Chat are chat models.

### Fine-Tuned Model
A base or chat model further trained on domain-specific data. A
medical LLM fine-tuned on clinical notes, or a code model fine-tuned
on a company's codebase.

### Open Source vs Closed Source
- **Open source / open weights:** Model weights are publicly available.
  Anyone can download, run, fine-tune, and modify. Examples: Llama,
  Mistral, Falcon.
- **Closed source:** Only accessible via API. Weights are proprietary.
  Examples: GPT-4, Claude, Gemini.

**Tradeoffs:** Open models offer transparency and customization. Closed
models tend to be more capable (more compute, more data, more RLHF)
and have stronger safety guardrails.

---

## Quick Reference: Model Family Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                    Transformer Variants                         │
├──────────────┬──────────────────┬───────────────────────────────┤
│ Encoder-Only │ Encoder-Decoder  │ Decoder-Only                  │
├──────────────┼──────────────────┼───────────────────────────────┤
│ BERT         │ T5               │ GPT-1/2/3/4                   │
│ RoBERTa      │ BART             │ Claude                        │
│ DeBERTa      │ mT5              │ Llama / Llama 2 / Llama 3     │
│ ALBERT       │ Flan-T5          │ Mistral / Mixtral             │
│ DistilBERT   │ UL2              │ Gemini                        │
│ ELECTRA      │                  │ Falcon                        │
├──────────────┼──────────────────┼───────────────────────────────┤
│ Best for:    │ Best for:        │ Best for:                     │
│ Understand-  │ Seq-to-seq tasks │ Text generation,              │
│ ing, classif-│ (translation,    │ conversation, coding,         │
│ ication, NER │ summarization)   │ reasoning, general AI         │
└──────────────┴──────────────────┴───────────────────────────────┘
```

---

## Quick Reference: Training Pipeline

```
Raw Internet Text (terabytes)
        │
        ▼
┌─────────────────┐
│   PRETRAINING   │  Predict next token on massive text
│  (weeks/months) │  Cost: $1M - $100M+
└────────┬────────┘
         │
         ▼
    Base Model (capable but unaligned)
         │
         ▼
┌─────────────────┐
│       SFT       │  Fine-tune on (instruction, response) pairs
│  (days/weeks)   │  Teach: follow instructions
└────────┬────────┘
         │
         ▼
    SFT Model (follows instructions, inconsistent quality)
         │
         ▼
┌─────────────────┐
│  RLHF / DPO     │  Optimize for human preferences
│  (days/weeks)   │  Teach: be helpful, harmless, honest
└────────┬────────┘
         │
         ▼
    Chat Model (aligned, ready for users)
```
