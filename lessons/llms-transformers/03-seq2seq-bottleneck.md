# Lesson 03: Sequence-to-Sequence and the Bottleneck Problem

Before transformers, the best models for translating languages, summarizing
text, and generating responses were sequence-to-sequence (seq2seq) models
built with RNNs. They worked, but they had a fundamental flaw that limited
how good they could get. Understanding this flaw is the key to understanding
why transformers were such a breakthrough.

Prerequisites: You should understand RNNs and LSTMs from Track 7, Lesson 11.

---

## The Problem: Machine Translation

Take this sentence:

```
English: "The cat sat on the mat because it was comfortable."
French:  "Le chat s'est assis sur le tapis parce qu'il etait confortable."
```

The input and output:
- Are different lengths (10 English words, 11 French words)
- Have different word orderings (adjective placement differs)
- Have words that map to multiple words ("sat on" → "s'est assis sur")
- Have long-range dependencies ("it" refers to "mat", not "cat")

You cannot do this with a simple one-to-one mapping. You need to read the
WHOLE input, understand it, then generate the output from that understanding.

This is exactly what sequence-to-sequence models do.

---

## The Encoder-Decoder Architecture

The seq2seq model has two parts: an encoder and a decoder.

**The analogy:** Think of a simultaneous translator at the United Nations.
1. The ENCODER listens to the entire English speech and builds an
   understanding of what was said (in their head)
2. The DECODER uses that understanding to produce the French translation

```
        ENCODER                              DECODER
  (reads English)                       (writes French)

  "The"  "cat"  "sat"  "on"  "the"     "Le"  "chat"  "s'est"  ...
    ↓      ↓      ↓      ↓      ↓        ↓      ↓       ↓
   [h1]→ [h2]→ [h3]→ [h4]→ [h5] ═══> [d1]→  [d2]→   [d3]→  ...
                                  ↑
                           "context vector"
                        (final hidden state)
```

### The Encoder (RNN)

Processes the input sentence word by word, left to right. Each word updates
the hidden state. After reading all words, the final hidden state is a
vector that supposedly captures the meaning of the entire input.

```python
import torch
import torch.nn as nn

class Encoder(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.rnn = nn.LSTM(embed_dim, hidden_dim, batch_first=True)

    def forward(self, source_tokens):
        embedded = self.embedding(source_tokens)
        outputs, (hidden, cell) = self.rnn(embedded)
        return hidden, cell
```

### The Decoder (RNN)

Takes the context vector (encoder's final hidden state) as its starting
point. Generates the output sentence one word at a time, feeding each
generated word as input to the next step.

```python
class Decoder(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.rnn = nn.LSTM(embed_dim, hidden_dim, batch_first=True)
        self.output_layer = nn.Linear(hidden_dim, vocab_size)

    def forward(self, target_token, hidden, cell):
        embedded = self.embedding(target_token.unsqueeze(1))
        output, (hidden, cell) = self.rnn(embedded, (hidden, cell))
        prediction = self.output_layer(output.squeeze(1))
        return prediction, hidden, cell
```

### The full seq2seq model

```python
class Seq2Seq(nn.Module):
    def __init__(self, encoder, decoder):
        super().__init__()
        self.encoder = encoder
        self.decoder = decoder

    def forward(self, source, target):
        hidden, cell = self.encoder(source)

        outputs = []
        current_token = target[:, 0]

        for t in range(1, target.shape[1]):
            prediction, hidden, cell = self.decoder(current_token, hidden, cell)
            outputs.append(prediction)
            current_token = target[:, t]

        return torch.stack(outputs, dim=1)
```

---

## The Bottleneck Problem

Here is the fatal flaw. Look at the architecture again:

```
ENCODER:  word1 → word2 → word3 → ... → wordN
                                          ↓
                                    [context vector]   ← EVERYTHING compressed here
                                          ↓
DECODER:                              output1 → output2 → output3 → ...
```

The ENTIRE input sentence is compressed into a SINGLE fixed-size vector.
Whether the input is 5 words or 500 words, it all gets squeezed into the
same size vector (typically 256 or 512 numbers).

### The telephone game analogy

Remember the telephone game (also called "Chinese whispers")?

```
Person 1 → Person 2 → Person 3 → ... → Person 10 → Person 11
"I saw a    "I saw      "Saw a       "A cat sat"    "Cat on
 beautiful   a pretty     pretty                      a mat?"
 fluffy      fluffy       cat on
 cat on a    cat on a     a mat"
 red mat     mat"
 near the
 window"
```

Each person can only remember a limited amount. Information gets lost
as it passes through the chain.

The RNN encoder is exactly like this. Each hidden state has a fixed
capacity. As new words come in, old information gets pushed out.

```
Encoding "The cat sat on the mat because it was comfortable"

After "The":      [full info about "The"]
After "cat":      [info about "cat", fading info about "The"]
After "sat":      [info about "sat", some "cat", tiny bit of "The"]
...
After "comfortable": [mostly about "comfortable", vague impression
                      of the rest of the sentence]
```

By the time the encoder finishes, the beginning of the sentence has been
through so many RNN steps that its information is degraded.

### Real consequences

Short sentences work fine:
```
"Hello" → "Bonjour"                     ← Easy, one vector is enough
"The cat sat." → "Le chat s'est assis." ← OK, only 3 content words
```

Long sentences fall apart:
```
"The young scientist who had been working at the prestigious research
 laboratory in Cambridge for the past three years finally published her
 groundbreaking paper on quantum computing last Tuesday."

→ All of this compressed into ONE vector of 512 numbers?
  Good luck getting an accurate translation.
```

### The empirical evidence

Translation quality degrades sharply with sentence length:

```
Sentence length vs translation quality (BLEU score, higher = better):

Length (words)    |  Score
─────────────────|──────
5-10             |  ████████████ 35
10-20            |  ████████     25
20-30            |  █████        18
30-40            |  ███          12
40+              |  ██            8
```

This was measured in real experiments. For sentences longer than 20 words,
seq2seq models without attention started producing garbage.

---

## Why RNNs Cannot Fix This

You might think: just make the hidden state bigger. 1024 numbers instead
of 512. Or 4096.

But the problem is not the size of the vector — it is the sequential
processing.

```
RNN processing:
  h0 → h1 → h2 → h3 → ... → h50 → h51 → ... → h100

  Information from word 1 must survive 100 steps of
  multiplication and addition to reach the final state.
```

Even with LSTMs (which have gating mechanisms to help), information degrades
over long sequences. The gradient signal from word 1 has to travel through
100 time steps during backpropagation. This is the vanishing gradient
problem from Track 7.

```
Information survival over time steps:

Step:     1    10    20    50    100
Info:   100%   80%   60%   30%    5%   (approximate)
```

Making the hidden state bigger helps a little, but the fundamental issue —
sequential processing with information decay — remains.

### The other RNN problem: no parallelism

```
RNN processing (sequential — each step depends on the previous):

Time step:    t=1    t=2    t=3    t=4    t=5
              [h1] → [h2] → [h3] → [h4] → [h5]
              ↑      ↑      ↑      ↑      ↑
              w1     w2     w3     w4     w5

Cannot compute h3 until h2 is done.
Cannot compute h2 until h1 is done.
Everything is SEQUENTIAL.
```

With a 500-word input, you need 500 sequential steps. On a GPU designed
for massive parallelism, you are using only one core at a time for the
sequential part. This makes training incredibly slow.

---

## The Seed of the Solution: Attention

In 2014, Bahdanau asked a simple question: why does the decoder have to
rely on just ONE vector? What if it could look back at ALL the encoder
states?

### The breakthrough insight

```
WITHOUT attention:
  Encoder: [h1] → [h2] → [h3] → [h4] → [h5]
                                          ↓
                                    [context vector]  ← just one vector
                                          ↓
  Decoder:                             [d1] → [d2] → [d3]

WITH attention:
  Encoder: [h1]   [h2]   [h3]   [h4]   [h5]
             ↘     ↓      ↓      ↓     ↙
              weighted combination based on
              what the decoder needs right now
                         ↓
  Decoder:            [d1] → [d2] → [d3]
                       ↑
              "Which encoder states are
               relevant for THIS output word?"
```

Instead of one compressed vector, the decoder can ACCESS ALL ENCODER
STATES and decide which ones are relevant for each output word.

### The restaurant analogy

Without attention: You send a friend to order food at a restaurant. They
have to memorize the entire menu, come back, and tell you what is available.
If the menu is long, they will forget items.

With attention: You give your friend a phone. At each moment when you need
information, they can call the restaurant and ask about specific items.
They do not need to memorize the whole menu — they can look up exactly what
they need, when they need it.

---

## Bahdanau Attention (2014)

Here is how it works, step by step.

### Step 1: The encoder produces ALL hidden states

```
Input: "The cat sat on the mat"

Encoder states:
  h1 = encode("The")     → [0.2, -0.1, 0.5, ...]   (512 numbers)
  h2 = encode("cat")     → [0.8, 0.3, -0.2, ...]
  h3 = encode("sat")     → [-0.1, 0.7, 0.4, ...]
  h4 = encode("on")      → [0.3, -0.5, 0.1, ...]
  h5 = encode("the")     → [0.1, 0.0, -0.3, ...]
  h6 = encode("mat")     → [0.6, 0.4, 0.8, ...]
```

We keep ALL of them, not just the last one.

### Step 2: For each decoder step, compute attention scores

When the decoder is about to generate the second French word, it asks:
"Which parts of the English input are most relevant right now?"

```
Decoder state d1 (after generating "Le"):

  Score("The", d1)  = how relevant is "The" for generating word 2?  → 0.1
  Score("cat", d1)  = how relevant is "cat" for generating word 2?  → 0.8  ← high!
  Score("sat", d1)  = how relevant is "sat" for generating word 2?  → 0.2
  Score("on", d1)   = how relevant is "on"  for generating word 2?  → 0.05
  Score("the", d1)  = how relevant is "the" for generating word 2?  → 0.05
  Score("mat", d1)  = how relevant is "mat" for generating word 2?  → 0.1
```

### Step 3: Convert scores to probabilities (softmax)

```
Raw scores:     [0.1,  0.8,  0.2,  0.05, 0.05, 0.1]
After softmax:  [0.08, 0.35, 0.12, 0.06, 0.06, 0.08]  ← sums to ~1.0
                        ↑
                  "cat" gets the most attention
```

### Step 4: Weighted combination of encoder states

```
context = 0.08 * h1 + 0.35 * h2 + 0.12 * h3 + 0.06 * h4 + 0.06 * h5 + 0.08 * h6
          ("The")     ("cat")     ("sat")     ("on")      ("the")     ("mat")
```

The decoder is building a custom context vector for THIS specific output
word, emphasizing the most relevant parts of the input.

### Step 5: Use the context to generate the output word

```
Decoder input: previous output + custom context vector
Output: "chat" (French for "cat")
```

And for the NEXT output word, the attention scores will be different —
maybe emphasizing "sat" and "on" to generate "s'est assis sur."

### Python implementation

```python
class BahdanauAttention(nn.Module):
    def __init__(self, hidden_dim):
        super().__init__()
        self.W_encoder = nn.Linear(hidden_dim, hidden_dim, bias=False)
        self.W_decoder = nn.Linear(hidden_dim, hidden_dim, bias=False)
        self.v = nn.Linear(hidden_dim, 1, bias=False)

    def forward(self, decoder_hidden, encoder_outputs):
        decoder_hidden = decoder_hidden.unsqueeze(1)

        score_inputs = torch.tanh(
            self.W_encoder(encoder_outputs) + self.W_decoder(decoder_hidden)
        )
        scores = self.v(score_inputs).squeeze(-1)

        attention_weights = torch.softmax(scores, dim=-1)

        context = torch.bmm(attention_weights.unsqueeze(1), encoder_outputs)
        context = context.squeeze(1)

        return context, attention_weights
```

---

## Visualizing Attention

One beautiful property of attention: you can see what the model is focusing on.

```
Translating: "The cat sat on the mat" → "Le chat s'est assis sur le tapis"

Generating "Le":
  The[██]  cat[░]  sat[░]  on[░]  the[░]  mat[░]

Generating "chat":
  The[░]  cat[████]  sat[░]  on[░]  the[░]  mat[░]

Generating "s'est":
  The[░]  cat[░]  sat[███]  on[░]  the[░]  mat[░]

Generating "assis":
  The[░]  cat[░]  sat[████]  on[█]  the[░]  mat[░]

Generating "sur":
  The[░]  cat[░]  sat[░]  on[████]  the[░]  mat[░]

Generating "le":
  The[░]  cat[░]  sat[░]  on[░]  the[███]  mat[░]

Generating "tapis":
  The[░]  cat[░]  sat[░]  on[░]  the[░]  mat[████]

(█ = attention weight; more █ = more attention)
```

The model learns sensible alignments. "Chat" (cat) attends to "cat."
"Tapis" (mat) attends to "mat." The model is learning which source words
correspond to which target words, without being explicitly told.

---

## Why Attention Is Not Enough (Yet)

Bahdanau attention was a huge improvement, but it still has the RNN
bottleneck:

```
1. Sequential processing — still processes words one at a time
2. Encoder is still an RNN — information decays over long sequences
3. Only cross-attention — decoder looks at encoder, but words in the
   input don't look at each other through attention
```

The next breakthrough was asking: what if we got rid of the RNN entirely
and used ONLY attention? What if words in the input could attend to EACH
OTHER? What if we could process everything in parallel?

That is the transformer. And it starts with understanding how attention
itself works, without the RNN crutch.

---

## The Journey to Transformers

```
Timeline:

2014: Seq2seq with RNNs
      Problem: bottleneck (one vector for entire input)

2014: Bahdanau attention
      Fix: decoder can look back at all encoder states
      Remaining problem: still using RNNs (sequential, slow)

2015: Luong attention
      Refinement: simpler attention mechanisms (dot product)
      Remaining problem: still using RNNs

2017: Transformer ("Attention Is All You Need")
      Radical fix: throw away RNNs entirely.
      Use ONLY attention. Process everything in parallel.
      Self-attention: words attend to each other, not just
      decoder to encoder.
```

---

## Key Takeaways

```
1. Seq2seq models have an encoder (reads input) and decoder (writes output).

2. The bottleneck problem: the entire input is compressed into one
   fixed-size vector. Long inputs lose information.

3. RNNs process sequentially: slow to train, information decays.

4. Bahdanau attention (2014) was the breakthrough: let the decoder
   look back at ALL encoder states, not just one compressed vector.

5. Attention computes a weighted combination of encoder states,
   with weights based on relevance to the current output word.

6. Attention solved the information loss problem but did not solve
   the sequential processing problem. That took transformers.
```

---

## Exercises

### Exercise 1: The bottleneck intuition
Write a paragraph summarizing what you did today (at least 5 sentences).
Now try to capture the ENTIRE paragraph in a single sentence of exactly
10 words. What information did you lose? This is the bottleneck problem.

### Exercise 2: Where would attention focus?
For each French word in the translation below, which English word(s)
would get the most attention weight? Mark them.

```
English: "The old man who lives next door plays piano beautifully."
French:  "Le vieil homme qui vit a cote joue du piano magnifiquement."
```

### Exercise 3: Sequential vs parallel
Imagine you need to read 100 documents. An RNN approach would be to read
them one after another. How long would this take if each document takes
1 minute? Now imagine you have 10 friends (parallel processors). How long
would it take? What if you could only read document N after finishing
document N-1 (the sequential constraint)? Relate this to why RNNs are
slow on GPUs.

### Exercise 4: Long-range dependencies
Write three sentences where the meaning of the last word depends on a
word near the beginning. For example: "The musician who had been practicing
her violin in the small studio every evening for three months finally
performed her first ___." (Answer depends on "musician" and "violin"
from 15+ words ago.)

### Exercise 5: Attention scores by hand
Given an encoder that produced 4 hidden states:
```
h1 = [1, 0]  (word: "I")
h2 = [0, 1]  (word: "like")
h3 = [1, 1]  (word: "cats")
h4 = [0, 0]  (word: ".")
```
And a decoder state: `d = [0.8, 0.9]`

Compute the dot product of d with each h. Apply softmax. What does the
decoder attend to most?

---

## What is next

We have seen that attention is the key insight: let the model selectively
focus on relevant parts of the input. But we described attention informally.
[Lesson 04](./04-attention.md) formalizes the attention mechanism with the
Query-Key-Value framework and the attention formula that powers every
transformer.

---

[Next: Lesson 04 — Attention](./04-attention.md) | [Back to Roadmap](./00-roadmap.md)
