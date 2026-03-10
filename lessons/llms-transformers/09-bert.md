# Lesson 09: BERT — Understanding Text (Encoder-Only)

Now that we've built the transformer and solved position encoding, it's
time to see what happens when you take this architecture, train it on
massive data, and point it at real tasks. BERT was the model that proved
transformers could dominate NLP, and it did it with a beautifully simple
idea: fill in the blanks.

---

## The Big Idea: One Model, Many Tasks

Before BERT (2018), NLP worked like this: for every task (sentiment
analysis, named entity recognition, question answering), you trained
a separate model from scratch. Each model had its own architecture,
its own training data, and its own tricks.

BERT changed this: pretrain ONE model on a massive text corpus, then
fine-tune it for ANY task with minimal effort.

**Analogy:** Before BERT, every NLP task was like hiring a specialist.
Need a plumber? Hire a plumber. Need an electrician? Hire an electrician.
BERT is like training a general contractor who understands buildings,
then specializing them with a week of focused training for any job.

```
Before BERT:                    After BERT:

Sentiment → Custom Model A      Pretrained BERT
NER → Custom Model B                │
QA → Custom Model C           ┌─────┼─────┐
Translation → Custom Model D  │     │     │
                               ▼     ▼     ▼
                             Fine-  Fine-  Fine-
                             tune   tune   tune
                               │     │     │
                               ▼     ▼     ▼
                             Sent.  NER    QA
```

---

## Encoder-Only: Built for Understanding

BERT uses only the ENCODER side of the transformer. No decoder, no
text generation. Why?

An encoder reads the ENTIRE input and produces a rich representation
of what it means. Every token's output vector captures that token's
meaning in the context of the full sentence. This is exactly what you
need for understanding tasks.

```
Input:  "I love this movie, it's amazing"

Encoder (BERT):
  ┌─────────────────────────────────────────────────┐
  │  Every token sees every other token             │
  │  (bidirectional attention)                      │
  │                                                 │
  │  "I" ←→ "love" ←→ "this" ←→ "movie" ←→ ...    │
  │                                                 │
  │  Output: rich vector for each token             │
  │  [CLS] vector = representation of entire input  │
  └─────────────────────────────────────────────────┘
          │
          ▼
  Classification head: "Positive sentiment" (98.5%)
```

The key architectural choice: **bidirectional attention**. Every token
can attend to every other token, in both directions. "love" sees "movie"
to its right. "movie" sees "love" to its left. This gives BERT a
complete picture of the input.

Compare this to GPT (decoder-only), where each token can only see
tokens to its LEFT. GPT's understanding of "love" wouldn't include
any information about "movie" because "movie" comes later.

---

## Training Objective 1: Masked Language Modeling (MLM)

How do you train a model to "understand" text? BERT's answer: play
fill-in-the-blank.

### The Process

1. Take a sentence: "The cat sat on the mat"
2. Randomly mask 15% of tokens: "The [MASK] sat on the [MASK]"
3. Train the model to predict the masked words
4. Loss = how wrong were the predictions for masked positions

```
Input:    "The  [MASK]  sat  on  the  [MASK]"
                  │                     │
                  ▼                     ▼
BERT:     [0.2] [0.8]  [0.1] [0.3] [0.2] [0.9]
                  │                     │
                  ▼                     ▼
Predict:  "cat" (✓)            "mat" (✓)

The model must use surrounding context to figure
out what words are missing.
```

**Analogy:** It's like a language teacher covering words in a textbook
and asking students to fill them in. If the student can reliably fill
in the blanks, they understand the language patterns.

### Why This Works

To predict a masked word, the model must understand:
- **Grammar:** "The [MASK] sat" -- what kind of word fits here?
  (noun, probably an animal or person)
- **Semantics:** "sat on the [MASK]" -- what do you sit on?
  (chair, mat, bench)
- **World knowledge:** "The cat sat on the mat" is a common pattern
- **Context:** The entire sentence gives clues about each blank

### The 80-10-10 Rule

BERT doesn't always use [MASK]. For the 15% of tokens selected:
- 80% are replaced with [MASK]
- 10% are replaced with a random word
- 10% are left unchanged

Why? Because at fine-tuning time, the model never sees [MASK] tokens.
If it only trained on [MASK], it would be confused by real text. The
random replacement and keeping originals help the model handle any
input.

```python
import random

def mask_tokens(tokens, vocab_size, mask_token_id, mask_prob=0.15):
    masked_tokens = tokens.copy()
    labels = [-100] * len(tokens)

    for i in range(len(tokens)):
        if random.random() < mask_prob:
            labels[i] = tokens[i]
            roll = random.random()
            if roll < 0.8:
                masked_tokens[i] = mask_token_id
            elif roll < 0.9:
                masked_tokens[i] = random.randint(0, vocab_size - 1)

    return masked_tokens, labels
```

---

## Training Objective 2: Next Sentence Prediction (NSP)

BERT's second task: given two sentences, predict whether sentence B
actually follows sentence A in the original text.

```
Input A: "The cat sat on the mat."
Input B: "It purred contentedly."
Label:   IsNext ✓

Input A: "The cat sat on the mat."
Input B: "Stock prices rose 3% today."
Label:   NotNext ✗
```

50% of training pairs are real consecutive sentences, 50% are random.

### The [CLS] Token

BERT prepends a special [CLS] (classification) token to every input.
After processing, the [CLS] token's output vector is used as a
summary of the entire input. For NSP, a simple classifier on top
of [CLS] predicts IsNext or NotNext.

### The Input Format

```
[CLS] The cat sat on the mat [SEP] It purred contentedly [SEP]

Token type:  A  A   A   A  A  A   A    B   B       B        B
Position:    0  1   2   3  4  5   6    7   8       9       10
```

- [CLS] = classification token (summary of the whole input)
- [SEP] = separator between sentences
- Token type IDs = which sentence each token belongs to (A or B)

### NSP's Legacy

Later research (RoBERTa) showed that NSP doesn't actually help much
and can even hurt performance. RoBERTa dropped it entirely and got
better results. But the [CLS] token and the two-sentence input format
stuck around.

---

## BERT's Architecture Details

```
┌─────────────────────────────────────────────────┐
│                  BERT Architecture               │
├─────────────────────────────────────────────────┤
│                                                  │
│  Input: [CLS] tokens... [SEP] tokens... [SEP]   │
│           │                                      │
│           ▼                                      │
│  Token Embedding + Position Embedding            │
│  + Segment Embedding (sentence A vs B)           │
│           │                                      │
│           ▼                                      │
│  ┌─────────────────────┐                        │
│  │ Transformer Encoder │ × 12 (base)            │
│  │    Layer            │   or 24 (large)        │
│  │                     │                        │
│  │  Multi-Head Attn    │   12 heads (base)      │
│  │       ↓             │   16 heads (large)     │
│  │  Add & LayerNorm    │                        │
│  │       ↓             │                        │
│  │  Feed-Forward       │   d_ff = 3072 (base)   │
│  │       ↓             │                        │
│  │  Add & LayerNorm    │                        │
│  └─────────────────────┘                        │
│           │                                      │
│           ▼                                      │
│  Output: One vector per token                    │
│  [CLS] vector = whole-input representation       │
│                                                  │
└─────────────────────────────────────────────────┘

BERT-base:  110M parameters,  d_model=768,  12 layers, 12 heads
BERT-large: 340M parameters, d_model=1024, 24 layers, 16 heads
```

### Pretraining Data

BERT was pretrained on:
- BooksCorpus (800M words) -- 11,000 unpublished books
- English Wikipedia (2,500M words) -- text only, no tables or lists

Total: about 3.3 billion words. Training took 4 days on 64 TPUs.

---

## Fine-Tuning BERT for Downstream Tasks

The magic of BERT: after pretraining, you add a tiny task-specific
layer on top and fine-tune the whole model on your task's labeled data.

### Task 1: Sentiment Classification

```
Input:  [CLS] This movie was terrible [SEP]
            │
            ▼
         BERT (12 layers)
            │
            ▼
     [CLS] output vector (768 dims)
            │
            ▼
     Linear layer (768 → 2)
            │
            ▼
     [Negative: 0.92, Positive: 0.08]
```

The [CLS] vector captures the meaning of the whole input.
A single linear layer maps it to class probabilities.

### Task 2: Named Entity Recognition (NER)

```
Input:  [CLS] Barack Obama visited Paris [SEP]
                │      │      │      │
                ▼      ▼      ▼      ▼
             BERT (12 layers)
                │      │      │      │
                ▼      ▼      ▼      ▼
             Linear (768 → num_labels) per token
                │      │      │      │
                ▼      ▼      ▼      ▼
            B-PER  I-PER    O   B-LOC
```

For token-level tasks, use each token's output vector separately.

### Task 3: Question Answering (Extractive)

```
Input:  [CLS] What is the capital of France? [SEP]
        Paris is the capital of France. [SEP]

BERT output for each token in the passage:
  Paris  is  the  capital  of  France  .
   │     │    │     │      │    │      │
   ▼     ▼    ▼     ▼      ▼    ▼      ▼
 Start  -    -      -      -    End    -
 score                          score

Answer span: "Paris ... France" → "Paris is the capital of France"
```

Two linear layers predict the start and end positions of the answer
in the passage. BERT doesn't generate the answer -- it highlights
where the answer already exists in the text.

### Fine-Tuning Is Cheap

```
┌────────────────┬────────────────┬───────────────────┐
│                │ Pretraining    │ Fine-tuning        │
├────────────────┼────────────────┼───────────────────┤
│ Data           │ Billions of    │ Thousands of       │
│                │ words          │ labeled examples   │
│ Time           │ Days on TPUs   │ Hours on 1 GPU     │
│ Cost           │ $$$$$          │ $                  │
│ Done by        │ Google/labs    │ Anyone             │
└────────────────┴────────────────┴───────────────────┘
```

You don't need massive resources to use BERT. Google pretrained it
once, released the weights, and millions of people fine-tuned it for
their specific tasks on a single GPU.

---

## Why Bidirectional Matters

Consider the word "bank" in two sentences:

```
Sentence 1: "I deposited money in the bank."
                                       ^^^^
Left context:  "deposited money in the" → financial institution
Right context: "." → end of sentence

Sentence 2: "I sat by the river bank."
                              ^^^^
Left context:  "sat by the river" → edge of a river
Right context: "." → end of sentence
```

A left-to-right model (like GPT) reading "bank" in Sentence 1 would
see "deposited money in the" and guess correctly. But for Sentence 2,
by the time it reaches "bank," it hasn't seen "river" yet if "bank"
comes before "river" in processing order.

BERT sees EVERYTHING. When processing "bank," it simultaneously sees
"deposited money" OR "river" and can disambiguate perfectly.

```
Unidirectional (GPT):        Bidirectional (BERT):

"I deposited money in the"   "I deposited money in the bank ."
         → bank (?)                         ↕
                              full context in both directions
                              → bank = financial institution ✓
```

---

## BERT vs GPT: Understanding vs Generating

```
┌──────────────────┬──────────────────┬──────────────────┐
│                  │ BERT             │ GPT              │
│                  │ (Encoder-only)   │ (Decoder-only)   │
├──────────────────┼──────────────────┼──────────────────┤
│ Direction        │ Bidirectional    │ Left-to-right    │
│ Training         │ Masked tokens    │ Next token       │
│ Strength         │ Understanding    │ Generating       │
│ Output           │ Vectors/labels   │ Text             │
│ Use cases        │ Classification,  │ Chatbots, code,  │
│                  │ NER, QA, search  │ writing, reason  │
│ Can generate?    │ No               │ Yes              │
│ Can classify?    │ Yes (excellent)  │ Yes (with prompt)│
└──────────────────┴──────────────────┴──────────────────┘
```

Think of it this way:
- BERT is a **reader** -- it reads and understands text
- GPT is a **writer** -- it generates new text

Both are valuable. Modern search engines still use BERT-like models
to understand queries and rank documents. But for general-purpose AI
assistants, GPT-style models won because generation is more flexible
than classification.

---

## The BERT Family Tree

BERT spawned a family of encoder-only models:

### RoBERTa (2019) — BERT Done Right
- Dropped NSP (didn't help)
- Trained longer with more data
- Bigger batches, dynamic masking
- Same architecture, significantly better results
- Lesson: BERT was undertrained, not underdesigned

### ALBERT (2019) — Smaller BERT
- Shares parameters across layers (12 layers share one set of weights)
- Factorizes the embedding matrix (vocab_size -> small -> d_model)
- 89% fewer parameters than BERT-large, competitive performance

### DistilBERT (2019) — Fast BERT
- 40% smaller, 60% faster, 97% of BERT's performance
- Created via knowledge distillation (small model mimics large model)
- Great for production where speed matters

### DeBERTa (2020) — Better Attention
- Disentangles content and position in attention computation
- Instead of one attention score, computes separate content-to-content,
  content-to-position, and position-to-content scores
- Enhanced mask decoder for pretraining
- Currently the strongest encoder-only model

```
Evolution of Encoder-Only Models:

BERT (2018) ──→ RoBERTa (2019) ──→ DeBERTa (2020)
  │                                    (best quality)
  ├──→ ALBERT (2019)
  │    (parameter efficient)
  │
  └──→ DistilBERT (2019)
       (fastest inference)
```

---

## BERT's Lasting Impact

Even though decoder-only models (GPT, Claude) dominate the headlines,
BERT's influence is everywhere:

1. **Transfer learning for NLP** -- BERT proved pretrain-then-fine-tune
   works, changing the entire field
2. **Search engines** -- Google uses BERT-like models to understand
   search queries
3. **Embedding models** -- Modern text embeddings (for RAG, similarity
   search) often use encoder architectures derived from BERT
4. **Sentence transformers** -- Models like all-MiniLM-L6 that produce
   sentence-level embeddings are BERT descendants
5. **Classification in production** -- When you need fast, accurate
   classification, fine-tuned BERT models are still hard to beat

---

## Hands-On: Using BERT with Hugging Face

```python
from transformers import BertTokenizer, BertForMaskedLM
import torch

tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
model = BertForMaskedLM.from_pretrained('bert-base-uncased')

text = "The cat [MASK] on the mat."
inputs = tokenizer(text, return_tensors='pt')

with torch.no_grad():
    outputs = model(**inputs)

mask_index = (inputs['input_ids'] == tokenizer.mask_token_id).nonzero()[0, 1]
logits = outputs.logits[0, mask_index]
top_5 = torch.topk(logits, 5)

for score, idx in zip(top_5.values, top_5.indices):
    token = tokenizer.decode(idx)
    print(f"  {token:>10s}  (score: {score:.2f})")
```

```
       sat  (score: 12.45)
       was  (score: 10.21)
      slept  (score: 8.77)
       lay  (score: 8.34)
     landed  (score: 7.89)
```

BERT knows that cats sit on mats. This simple fill-in-the-blank
capability, scaled up, produces genuine language understanding.

---

## Thought Experiments

1. **Bidirectional Advantage:** Take the sentence "The bass swam
   upstream." Could BERT tell that "bass" means a fish? What about
   a left-to-right model that hasn't seen "swam" yet? Now try "The
   bass guitar was out of tune." How does each direction of context help?

2. **Masking Strategy:** What would happen if you masked 50% of tokens
   instead of 15%? Too easy or too hard? What about 5%?

3. **Why Not Generate?** BERT sees all tokens bidirectionally. Why
   can't you use BERT to generate text? What happens if you try to
   predict the next word after the last token -- what information
   does BERT have that it shouldn't?

4. **Transfer Learning Power:** BERT was trained on Wikipedia and books
   in English. How well would it work for classifying legal documents?
   Medical texts? Tweets? What factors determine how well pretraining
   transfers?

5. **The Classification Shortcut:** For sentiment classification, BERT
   just uses the [CLS] token. But [CLS] appears at position 0 -- how
   does it "know" about words at position 20? Trace the information
   flow through self-attention.

---

## Key Takeaways

1. **BERT proved transfer learning works for NLP** -- pretrain once,
   fine-tune for any task.
2. **Masked Language Modeling** (fill-in-the-blank) is a simple but
   powerful training objective.
3. **Bidirectional attention** gives BERT a complete picture of the
   input, making it excellent for understanding.
4. **The [CLS] token** provides a whole-input representation for
   classification tasks.
5. **Fine-tuning is cheap** -- take pretrained BERT, add one layer,
   train for hours instead of days.
6. **BERT can't generate text** -- it's built for understanding, not
   writing. For generation, we need GPT.

Next: [Lesson 10 — GPT: Generating Text (Decoder-Only)](./10-gpt.md)
