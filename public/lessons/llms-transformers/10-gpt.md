# Lesson 10: GPT — Generating Text (Decoder-Only)

BERT showed that transformers can understand text. GPT shows that they
can write it. And the simplicity of GPT's approach -- just predict the
next word, over and over -- turned out to be the most important idea
in modern AI.

---

## The Core Idea: Just Predict the Next Token

GPT's training objective is embarrassingly simple: given all the
previous tokens, predict the next one.

```
Training example: "The cat sat on the mat"

Step 1: Given "The"           → predict "cat"
Step 2: Given "The cat"       → predict "sat"
Step 3: Given "The cat sat"   → predict "on"
Step 4: Given "The cat sat on" → predict "the"
Step 5: Given "The cat sat on the" → predict "mat"
```

That's it. No fill-in-the-blank like BERT. No paired sentences. Just
predict what comes next. This is the same language modeling task we
discussed in Lesson 01, but now with a transformer instead of an RNN.

**Analogy:** Imagine autocomplete on your phone, but trained on the
entire internet. After reading trillions of words, the model becomes
so good at predicting what comes next that it can write essays, answer
questions, write code, and hold conversations -- all by "just"
predicting the next token.

---

## Decoder-Only Architecture

GPT uses only the decoder half of the transformer. The critical
difference from BERT: **causal (masked) attention**. Each token can
only attend to tokens at earlier positions.

```
BERT (bidirectional):           GPT (causal/left-to-right):

"The" sees everything           "The" sees only itself
"cat" sees everything           "cat" sees "The", "cat"
"sat" sees everything           "sat" sees "The", "cat", "sat"
"on"  sees everything           "on"  sees "The", "cat", "sat", "on"

Every token attends to          Each token attends ONLY to
ALL other tokens.               tokens at earlier positions.
```

Why the restriction? Because GPT generates text left-to-right. When
predicting the next word, it can't look at future words (they don't
exist yet). The causal mask during training mirrors this constraint.

```
Causal Attention Mask:

             The   cat   sat   on    the   mat
The     [     1     0     0     0     0     0  ]
cat     [     1     1     0     0     0     0  ]
sat     [     1     1     1     0     0     0  ]
on      [     1     1     1     1     0     0  ]
the     [     1     1     1     1     1     0  ]
mat     [     1     1     1     1     1     1  ]

1 = can attend,  0 = masked (set to -infinity before softmax)
```

### The Architecture

```
┌─────────────────────────────────────────────────┐
│                GPT Architecture                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  Input: token sequence                           │
│           │                                      │
│           ▼                                      │
│  Token Embedding + Positional Embedding          │
│           │                                      │
│           ▼                                      │
│  ┌─────────────────────┐                        │
│  │ Transformer Decoder │ × N layers             │
│  │    Layer            │                        │
│  │                     │                        │
│  │  Masked Multi-Head  │                        │
│  │    Self-Attention   │                        │
│  │       ↓             │                        │
│  │  Add & LayerNorm    │                        │
│  │       ↓             │                        │
│  │  Feed-Forward       │                        │
│  │       ↓             │                        │
│  │  Add & LayerNorm    │                        │
│  └─────────────────────┘                        │
│           │                                      │
│           ▼                                      │
│  Linear → Softmax → probability over vocab       │
│                                                  │
│  The LAST token's output predicts the NEXT token │
│                                                  │
└─────────────────────────────────────────────────┘
```

Notice: no cross-attention (there's no encoder to attend to) and no
[CLS] token. The output at each position predicts the token at the
NEXT position.

---

## The Simplicity Is the Genius

The history of AI is full of clever, complex training schemes. GPT's
insight was that you don't need any of them. Just predict the next
token, and the model learns everything it needs:

```
To predict the next word, the model must learn:

"The capital of France is ___"
→ Facts (geography: "Paris")

"She didn't want to go because she ___"
→ Reasoning (cause and effect: "was tired")

"def fibonacci(n):\n    if n <= 1:\n        return ___"
→ Code (programming: "n")

"The patient presents with fever, cough, and ___"
→ Domain knowledge (medicine: "shortness of breath")

"2 + 3 = ___"
→ Arithmetic (math: "5")

"Translate to French: hello → ___"
→ Translation (multilingual: "bonjour")
```

The model doesn't have separate modules for facts, reasoning, code,
and translation. It's ALL just next-token prediction. The training
data contains examples of all these patterns, and the model learns
to replicate them.

**Analogy:** A child doesn't learn grammar rules explicitly. They hear
thousands of sentences and eventually internalize the patterns. GPT
does the same thing, but with trillions of tokens from the entire
internet.

---

## The Evolution of GPT

### GPT-1 (2018): Proof of Concept

```
Parameters:  117 million
Layers:      12
d_model:     768
Training:    BooksCorpus (4.5 GB of text)
Innovation:  Proved pretraining + fine-tuning works for generation
```

GPT-1 was modest. It showed that an unsupervised language model
(predict the next word on books) could be fine-tuned for specific
tasks and match or beat supervised models. Same idea as BERT, but
for generation.

The paper was titled "Improving Language Understanding by Generative
Pre-Training." Note the irony: a generative model was used to
improve understanding.

### GPT-2 (2019): Emergent Abilities at Scale

```
Parameters:  1.5 billion (13x GPT-1)
Layers:      48
d_model:     1600
Training:    WebText (40 GB, 8M web pages)
Innovation:  Zero-shot task performance, no fine-tuning needed
```

GPT-2 was the model that made the world pay attention. OpenAI
initially refused to release the full model, calling it "too
dangerous" due to its ability to generate convincing fake text.

The key discovery: **GPT-2 could perform tasks it was never explicitly
trained for.** Given a prompt like "Translate English to French:
cheese =>", it would output "fromage" -- despite never being trained
on a translation task. The model learned task patterns from the
internet text.

This was the first hint of **emergent abilities**: capabilities that
appear at scale without being explicitly trained.

### GPT-3 (2020): The In-Context Learning Revolution

```
Parameters:  175 billion (100x GPT-2)
Layers:      96
d_model:     12288
Attention:   96 heads
Training:    300 billion tokens (570 GB of filtered text)
Cost:        Estimated $4.6 million in compute
Innovation:  Few-shot learning, in-context learning
```

GPT-3 changed everything. It introduced **in-context learning**: the
model could learn new tasks from examples provided in the prompt,
with no weight updates at all.

```
Zero-shot (no examples):
  "Translate English to French: cheese =>"

One-shot (one example):
  "Translate English to French:
   sea otter => loutre de mer
   cheese =>"

Few-shot (several examples):
  "Translate English to French:
   sea otter => loutre de mer
   peppermint => menthe poivrée
   plush giraffe => girafe en peluche
   cheese =>"
```

With few-shot prompting, GPT-3 matched or exceeded fine-tuned models
on many benchmarks. The more examples you gave it, the better it
performed -- up to a point.

### The Scaling Jump

```
Model     Parameters    Relative Size

GPT-1     117M          ■
GPT-2     1.5B          ■■■■■■■■■■■■■
GPT-3     175B          ■■■■■■■■■■■■■ × 117 (too big to draw)

Each step: roughly 10-100x bigger
Each step: qualitatively new capabilities
```

---

## In-Context Learning: The Prompt as Programming

GPT-3's most surprising ability was in-context learning. Instead of
fine-tuning the model (changing its weights), you write a prompt that
demonstrates the task.

```python
prompt = """
Classify the sentiment of each review.

Review: "This product is amazing, I love it!"
Sentiment: Positive

Review: "Terrible quality, broke after one day."
Sentiment: Negative

Review: "It's okay, nothing special."
Sentiment: Neutral

Review: "Best purchase I've ever made!"
Sentiment:"""

# GPT-3 completes with "Positive"
```

The model doesn't update its weights. It "learns" the pattern from
the examples in the prompt and applies it to the new input. This is
fundamentally different from traditional machine learning.

**Analogy:** Imagine giving someone a job on their first day. Fine-tuning
is like sending them through a three-month training program. In-context
learning is like saying "here are some examples of what we do, now you
try" -- and they nail it immediately.

### Why Does In-Context Learning Work?

This is still an active area of research. The best theories:

1. **Pattern matching:** The model recognizes the prompt format from
   training data (it's seen many "input → output" patterns)
2. **Implicit Bayesian inference:** The model infers what task is being
   described and applies its pretrained knowledge
3. **Gradient descent in disguise:** Some research suggests attention
   layers implement a form of gradient descent on the in-context
   examples

The honest answer: we don't fully understand it yet. But it works.

---

## How Text Generation Actually Works

When GPT generates text, it follows a simple loop:

```
Step 1: Process the prompt
        "Tell me a joke about"
                │
                ▼
        Model outputs probability distribution
        over entire vocabulary for the NEXT token

Step 2: Sample from the distribution
        "programming" (0.12)
        "cats"        (0.08)
        "dogs"        (0.06)
        "a"           (0.05)
        ...
        → Sample: "programming"

Step 3: Append the sampled token to the input
        "Tell me a joke about programming"

Step 4: Feed the extended sequence back in
        Repeat from Step 1

Step 5: Continue until:
        - Model outputs the end-of-sequence token
        - Maximum length is reached
        - Application-specific stopping criteria
```

This is called **autoregressive generation**: each new token depends
on all previous tokens.

```
Input:   "Tell me a joke"
                │
                ▼
         ┌─────────────┐
         │    GPT       │ → p("about") = 0.12
         └─────────────┘   p(":")     = 0.09
                            p(".")     = 0.05
                            ...
         Sample → "about"
                │
                ▼
Input:   "Tell me a joke about"
                │
                ▼
         ┌─────────────┐
         │    GPT       │ → p("programming") = 0.08
         └─────────────┘   p("a")            = 0.07
                            ...
         Sample → "a"
                │
                ▼
Input:   "Tell me a joke about a"
                │
                ... (continues)
```

### The Probability Distribution

At each step, the model outputs a vector of logits (raw scores) with
one value per token in the vocabulary. Softmax converts these to
probabilities:

```python
import torch
import torch.nn.functional as F

logits = model(input_tokens)
last_token_logits = logits[:, -1, :]
probabilities = F.softmax(last_token_logits, dim=-1)

next_token = torch.multinomial(probabilities, num_samples=1)
```

With a vocabulary of 50,000 tokens, the model produces 50,000
probabilities at every single step. Generation is choosing which
probability to follow.

---

## Why Decoder-Only Won

The transformer paper introduced an encoder-decoder architecture.
BERT used encoder-only. GPT used decoder-only. For general-purpose
AI, decoder-only won decisively. Why?

### 1. Simplicity

Decoder-only has one training objective (next token), one architecture
(stacked decoder layers), and one inference mode (autoregressive
generation). No encoder, no cross-attention, no [CLS] token, no
masking strategy decisions.

### 2. Flexibility

A decoder-only model can handle ANY text task by framing it as
text completion:

```
Classification: "Review: 'Great movie!' Sentiment:" → "Positive"
Translation:    "English: Hello French:" → "Bonjour"
Summarization:  "Article: [long text] Summary:" → "[short text]"
Code:           "# Function to sort a list\ndef" → "sort_list(..."
QA:             "Q: What is the capital of France? A:" → "Paris"
```

BERT needs a different head (output layer) for each task type. GPT
uses the same model and the same inference for everything.

### 3. Scaling

As models get bigger, decoder-only models improve at everything
simultaneously. A bigger GPT is better at classification AND
generation AND reasoning AND code. Encoder-only models mainly
improve at understanding tasks.

### 4. In-Context Learning

Only decoder-only models (autoregressive models) naturally support
in-context learning. You can't put examples in a BERT prompt the
same way -- BERT doesn't generate; it classifies.

```
The Winner's Architecture:

2018: BERT (encoder) vs GPT-1 (decoder)
      BERT wins on benchmarks

2019: GPT-2 shows zero-shot abilities
      Decoder catches up

2020: GPT-3 shows in-context learning
      Decoder takes the lead

2022+: ChatGPT, Claude, Llama, Gemini
       All decoder-only
       Decoder wins decisively
```

---

## From GPT-3 to ChatGPT: The Missing Piece

GPT-3 was impressive but hard to use. It would complete text, but it
wouldn't follow instructions reliably. Ask it a question, and it
might respond with another question, or continue with a Wikipedia
article, or generate random text.

```
User: "What is the capital of France?"

GPT-3 (base model) might respond:
  "What is the capital of Germany? What is the capital of Spain?
   These are common geography quiz questions..."

  (It's completing a list of questions, not ANSWERING the question)
```

The base model is a text completion engine. It predicts what text
would come next in its training data. If the training data contained
quiz questions in lists, it'll generate more quiz questions.

The missing piece: **alignment**. Teaching the model to be helpful,
follow instructions, and have conversations. This is what turns
GPT-3 into ChatGPT (covered in Lesson 13: RLHF).

```
Base GPT-3               ChatGPT (GPT-3.5 + RLHF)
┌──────────────┐         ┌──────────────┐
│ Predicts     │         │ Follows      │
│ next token   │  ──→    │ instructions │
│              │  SFT    │              │
│ Unreliable   │  +      │ Helpful      │
│ for tasks    │  RLHF   │ and safe     │
└──────────────┘         └──────────────┘
```

---

## Implementing a Minimal GPT

Here's the core of GPT in PyTorch, stripped to its essentials:

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class CausalSelfAttention(nn.Module):
    def __init__(self, d_model, num_heads, max_len):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = d_model // num_heads

        self.qkv = nn.Linear(d_model, 3 * d_model)
        self.proj = nn.Linear(d_model, d_model)

        mask = torch.triu(
            torch.ones(max_len, max_len), diagonal=1
        ).bool()
        self.register_buffer('mask', mask)

    def forward(self, x):
        batch, seq_len, d_model = x.shape
        qkv = self.qkv(x)
        q, k, v = qkv.chunk(3, dim=-1)

        q = q.view(batch, seq_len, self.num_heads, self.head_dim)
        k = k.view(batch, seq_len, self.num_heads, self.head_dim)
        v = v.view(batch, seq_len, self.num_heads, self.head_dim)

        q = q.transpose(1, 2)
        k = k.transpose(1, 2)
        v = v.transpose(1, 2)

        scores = (q @ k.transpose(-2, -1)) / (self.head_dim ** 0.5)
        scores.masked_fill_(self.mask[:seq_len, :seq_len], float('-inf'))
        attn = F.softmax(scores, dim=-1)

        out = attn @ v
        out = out.transpose(1, 2).contiguous().view(batch, seq_len, d_model)
        return self.proj(out)


class GPTBlock(nn.Module):
    def __init__(self, d_model, num_heads, max_len):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = CausalSelfAttention(d_model, num_heads, max_len)
        self.ln2 = nn.LayerNorm(d_model)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, 4 * d_model),
            nn.GELU(),
            nn.Linear(4 * d_model, d_model),
        )

    def forward(self, x):
        x = x + self.attn(self.ln1(x))
        x = x + self.ffn(self.ln2(x))
        return x


class GPT(nn.Module):
    def __init__(self, vocab_size, d_model, num_heads, num_layers, max_len):
        super().__init__()
        self.token_emb = nn.Embedding(vocab_size, d_model)
        self.pos_emb = nn.Embedding(max_len, d_model)
        self.blocks = nn.Sequential(
            *[GPTBlock(d_model, num_heads, max_len)
              for _ in range(num_layers)]
        )
        self.ln_final = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, vocab_size, bias=False)

    def forward(self, token_ids):
        batch, seq_len = token_ids.shape
        positions = torch.arange(seq_len, device=token_ids.device)

        x = self.token_emb(token_ids) + self.pos_emb(positions)
        x = self.blocks(x)
        x = self.ln_final(x)
        logits = self.head(x)
        return logits

    def generate(self, token_ids, max_new_tokens, temperature=1.0):
        for _ in range(max_new_tokens):
            logits = self(token_ids)
            next_logits = logits[:, -1, :] / temperature
            probs = F.softmax(next_logits, dim=-1)
            next_token = torch.multinomial(probs, num_samples=1)
            token_ids = torch.cat([token_ids, next_token], dim=1)
        return token_ids
```

This is roughly 70 lines for a functional GPT. The real GPT-3 has
the same core architecture -- just 96 layers instead of a few, and
12,288 dimensions instead of a few hundred.

---

## Thought Experiments

1. **The Parrot Problem:** Critics say GPT is "just a fancy autocomplete"
   or a "stochastic parrot." If a model can write working code,
   prove math theorems, and explain complex topics -- all by predicting
   the next token -- is it "just" autocomplete? Where's the line between
   pattern matching and understanding?

2. **Why Not Bidirectional Generation?** If bidirectional attention
   (BERT) gives better understanding, why not generate text
   bidirectionally? What fundamental problem makes left-to-right
   generation necessary?

3. **The Training Data Question:** GPT learns from internet text. It has
   seen correct answers AND incorrect answers, good code AND buggy code.
   How does it learn to produce correct answers more often than
   incorrect ones? (Hint: think about frequency in training data and
   RLHF alignment.)

4. **Emergent Math:** GPT wasn't trained on a math curriculum. It saw
   math problems and solutions scattered across the internet. Yet it
   can solve novel math problems. How might "just predicting the next
   token" lead to mathematical reasoning?

5. **The Context Length Dilemma:** GPT-2 has a 1024-token context.
   GPT-3 has 4096. Why can't you just make it infinite? What are the
   computational, architectural, and training constraints?

---

## Key Takeaways

1. **GPT's training is simple:** predict the next token. This simplicity
   is its greatest strength.
2. **Causal (masked) attention** ensures the model can only see past
   tokens, mirroring the generation process.
3. **Scale unlocks abilities:** GPT-2 showed zero-shot performance,
   GPT-3 showed in-context learning. Bigger models = new capabilities.
4. **In-context learning** lets GPT-3 perform tasks from examples in
   the prompt, without updating weights.
5. **Decoder-only won** over encoder-only and encoder-decoder for
   general AI because of its simplicity, flexibility, and scaling.
6. **Base models predict text, they don't follow instructions.** The gap
   between GPT-3 and ChatGPT is alignment (RLHF), not architecture.

Next: [Lesson 11 — Scaling Laws: Why Bigger Models Are Smarter](./11-scaling-laws.md)
