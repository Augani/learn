# Lesson 12: The Problems with RNNs — Why We Needed Something Better

LSTMs were a massive improvement over vanilla RNNs. For years (2014-2017),
they dominated sequence processing: machine translation, text generation,
speech recognition. But they have fundamental limitations that eventually
motivated the creation of the Transformer — the architecture behind
GPT, BERT, Claude, and every modern language model.

This lesson explains what those limitations are and why they matter.

---

## Problem 1: Sequential Processing — No Parallelism

An RNN MUST process tokens one at a time. Step 5 depends on step 4,
which depends on step 3, and so on. You can't skip ahead.

```
Token 1 → [RNN] → h₁
                    ↓
Token 2 ────────→ [RNN] → h₂
                            ↓
Token 3 ──────────────────→ [RNN] → h₃
                                      ↓
Token 4 ────────────────────────────→ [RNN] → h₄

Each step WAITS for the previous step.
Total time = N × (time per step)
```

**Go analogy:** This is like a goroutine pipeline where each stage
depends on the previous stage's output. You can't parallelize it.
The throughput is limited by the slowest stage.

```go
// RNN is like a sequential pipeline — can't parallelize
for _, token := range sequence {
    hiddenState = rnnStep(hiddenState, token) // must wait for previous
}
```

On a GPU, this is devastating. GPUs are designed for massive
parallelism — doing the same operation on thousands of data points
simultaneously. But RNNs force sequential computation.

```
GPU with 1000 cores:

  CNN:  All pixels processed in parallel.     GPU utilization: HIGH
  RNN:  One token at a time.                  GPU utilization: LOW

  A 500-word sentence takes 500 sequential steps on an RNN.
  A CNN could process all 500 words simultaneously.
```

**Real-world impact:** Training an LSTM language model on a large
corpus takes weeks. The same model as a Transformer takes days (or
hours with enough GPUs).

---

## Problem 2: Long-Range Dependencies

Even LSTMs struggle with very long sequences. Consider this sentence:

```
"The author who wrote the bestselling novel that was adapted into a
critically acclaimed film starring several award-winning actors and
was subsequently nominated for multiple Academy Awards including
Best Picture and Best Director ... was born in a small town."

The subject: "author" (word 2)
The verb: "was born" (word 40+)

The LSTM must carry information about "author" through 40+ time steps.
```

LSTMs handle this MUCH better than vanilla RNNs, but the cell state
still degrades over very long sequences. Information gets diluted,
overwritten, or simply lost as new information competes for space in
the fixed-size hidden state.

**Analogy:** You're reading a 500-page book, and you can only keep
notes on a single index card. By page 300, you've erased and rewritten
your notes so many times that details from chapter 1 are gone.

---

## Problem 3: The Information Bottleneck

In sequence-to-sequence tasks (like machine translation), the
traditional approach was:

```
ENCODER-DECODER ARCHITECTURE:

Encoder (reads the source sentence):
"The cat sat on the mat"
  ↓    ↓    ↓   ↓   ↓    ↓
[LSTM][LSTM][LSTM][LSTM][LSTM][LSTM] → context vector (single vector!)
                                            ↓
Decoder (generates the translation):       ↓
                                      ┌────┘
                                      ↓
                               [LSTM] → "Le"
                                  ↓
                               [LSTM] → "chat"
                                  ↓
                               [LSTM] → "s'est"
                                  ↓
                               [LSTM] → "assis"
                                  ...
```

**The bottleneck:** The ENTIRE source sentence is compressed into a
single fixed-size vector (typically 256-1024 numbers). This single
vector must contain ALL the information needed to translate the
sentence.

For short sentences, this works fine. For long sentences or paragraphs,
it's like trying to summarize a book in a single tweet. Too much
information is lost.

**Go analogy:** Imagine encoding an entire HTTP request into a single
`[256]byte` array. Short requests fit fine, but long requests with
headers, body, and attachments? You're losing information.

```
Short sentence:  "Hi" → [0.2, 0.5, ...] → "Salut"
                 (easy, little information to compress)

Long paragraph:  "The economic implications of..." → [0.2, 0.5, ...]
                 (impossible to fit everything into 256 numbers)
```

---

## Problem 4: Difficulty Training Deep RNNs

Stacking LSTM layers helps but introduces its own problems:

```
Input
  ↓
[LSTM Layer 1] ─→ time steps ─→
  ↓
[LSTM Layer 2] ─→ time steps ─→     Gradient must flow through
  ↓                                  BOTH depth AND time.
[LSTM Layer 3] ─→ time steps ─→     This compounds the vanishing
  ↓                                  gradient problem.
[LSTM Layer 4] ─→ time steps ─→
  ↓
Output
```

In practice, LSTM networks rarely go beyond 2-4 layers. Deeper
networks become very difficult to train. Compare this to CNNs, which
can be 50-150+ layers deep thanks to skip connections.

---

## The Attention Breakthrough

In 2015, Bahdanau et al. proposed a simple but powerful fix for the
bottleneck problem: instead of compressing the entire input into one
vector, let the decoder LOOK BACK at all encoder states and focus on
the relevant ones.

```
WITHOUT attention (bottleneck):

  Encoder: "The" "cat" "sat" "on" "the" "mat"
               ↓    ↓    ↓    ↓    ↓    ↓
            [LSTM][LSTM][LSTM][LSTM][LSTM][LSTM] → single vector
                                                       ↓
  Decoder:                                         "Le chat..."

WITH attention (look back):

  Encoder: "The" "cat" "sat" "on" "the" "mat"
               ↓    ↓    ↓    ↓    ↓    ↓
            [h₁]  [h₂]  [h₃]  [h₄]  [h₅]  [h₆]  ← ALL states saved
              ↑     ↑↑    ↑     ↑     ↑     ↑
              └─────┘│└───┘─────┘─────┘─────┘
                     │
  Decoder:    "Le" → [LSTM] → "Which encoder states matter for 'chat'?"
                              → Focus on h₂ ("cat"!) with high weight
                              → Output: "chat"
```

**Analogy:** Without attention, you read an entire chapter, close the
book, and try to answer a question from memory. With attention, you can
flip back through the chapter and focus on the relevant paragraphs.

Attention assigns a **weight** to each encoder state: "How relevant is
this word for the word I'm currently generating?"

```
Generating "chat" (French for "cat"):

  Attention weights:
    "The" → 0.05  (not relevant)
    "cat" → 0.80  (very relevant!)
    "sat" → 0.05  (not relevant)
    "on"  → 0.02  (not relevant)
    "the" → 0.03  (not relevant)
    "mat" → 0.05  (not relevant)

  Context = 0.05 × h₁ + 0.80 × h₂ + 0.05 × h₃ + ...
  (weighted average of encoder states, heavily weighted toward "cat")
```

This is a massive improvement, but it still uses an LSTM underneath.
The sequential processing problem remains.

---

## The Transformer: Attention Is All You Need

In 2017, Vaswani et al. asked: what if we ONLY use attention, without
any RNN at all?

```
RNN + Attention:     Still sequential, attention helps but doesn't fix speed
Transformer:         ONLY attention, fully parallel, no recurrence at all
```

The key insight: **self-attention** lets every token look at every other
token simultaneously. No sequential processing needed.

```
RNN processing "The cat sat on the mat":
  Step 1: Process "The"  (1 step)
  Step 2: Process "cat"  (waits for step 1)
  Step 3: Process "sat"  (waits for step 2)
  Step 4: Process "on"   (waits for step 3)
  Step 5: Process "the"  (waits for step 4)
  Step 6: Process "mat"  (waits for step 5)
  Total: 6 sequential steps

Transformer processing "The cat sat on the mat":
  All 6 words processed simultaneously!
  Each word attends to all other words in one parallel step.
  Total: 1 step (parallelized across the GPU)
```

Transformers are covered in depth in Track 8. Here's the preview:

| Property | LSTM | Transformer |
|----------|------|-------------|
| Processing | Sequential | Parallel |
| Long-range dependencies | Hard (information decays) | Easy (direct attention) |
| Training speed | Slow | Fast (parallelizable) |
| Max practical sequence | ~500-1000 tokens | 2K-128K+ tokens |
| Depth | 2-4 layers typical | 12-96+ layers |
| Dominant era | 2014-2017 | 2017-present |

---

## The Timeline: From RNNs to ChatGPT

```
2011  ┤ RNNs revived for speech recognition (Graves)
      │
2014  ┤ Seq2Seq with LSTMs for machine translation (Sutskever)
      │ GRU introduced as simpler alternative (Cho)
      │
2015  ┤ Attention mechanism for translation (Bahdanau)
      │ "Attention solves the bottleneck, but still uses LSTMs"
      │
2017  ┤ "Attention Is All You Need" paper (Vaswani)
      │ Transformer architecture — no RNNs at all
      │ "This changes everything" (it did)
      │
2018  ┤ BERT (Google) — bidirectional transformer for understanding
      │ GPT-1 (OpenAI) — transformer for text generation
      │
2019  ┤ GPT-2 — larger, generated surprisingly coherent text
      │
2020  ┤ GPT-3 — 175 billion parameters, few-shot learning
      │
2022  ┤ ChatGPT — GPT-3.5 fine-tuned with RLHF
      │ AI goes mainstream
      │
2023  ┤ GPT-4, Claude, Llama, Gemini, Mistral
      │ Foundation model era
      │
2024  ┤ Scaling continues, reasoning models emerge
      │
```

Every model from 2017 onward is a Transformer. RNNs and LSTMs are
essentially legacy technology for language tasks. They're still used
for some specialized time series applications, but the Transformer
dominates.

---

## Are RNNs Dead?

Not entirely. RNNs still have niches:

| Use Case | Why RNN/LSTM Still Used |
|----------|----------------------|
| Low-resource embedded systems | Simpler to deploy, lower memory |
| Streaming real-time data | Can process one sample at a time naturally |
| Very long sequences (100K+) | Some RNN variants scale linearly with sequence length |
| Edge devices | Smaller model size |

But for most NLP and sequence tasks, Transformers have won decisively.

Recent research (2023-2024) has explored RNN-like architectures that
can be parallelized during training but process sequentially during
inference: RWKV, Mamba (state space models), and others. These aim to
combine the RNN's efficiency at inference with the Transformer's
training speed.

---

## What You Should Take Away

The evolution from RNNs to Transformers is one of the most important
stories in ML:

1. **RNNs** introduced the idea of processing sequences with memory
2. **LSTMs** solved the vanishing gradient problem with gates
3. **Attention** solved the bottleneck by letting the decoder look back
4. **Transformers** eliminated sequential processing entirely

Each step solved a real, painful limitation of the previous approach.
Understanding this progression helps you understand WHY modern LLMs
work the way they do.

---

## Key Takeaways

1. **RNNs are sequential** — they can't parallelize across time steps,
   making training slow on GPUs.
2. **Long-range dependencies** are hard even for LSTMs — information
   degrades over many steps.
3. **The information bottleneck** forces the entire input into one
   fixed-size vector, losing information on long sequences.
4. **Attention** solved the bottleneck by letting the decoder look back
   at all encoder states.
5. **Transformers** removed the RNN entirely, using only attention.
   Fully parallel, handles long-range dependencies natively.
6. **Everything since 2017** (BERT, GPT, Claude) is a Transformer.

---

## Exercises

1. **Sequential bottleneck measurement:** Time how long it takes to
   process a sequence of length 10, 100, 500, and 1000 through an
   LSTM in PyTorch. Plot sequence length vs. time. Is it linear?

2. **Attention intuition:** Given the sentence "The bank by the river
   was flooded," manually assign attention weights for predicting
   the word "flooded." Which words should get high attention? Which
   should get low attention?

3. **Information bottleneck experiment:** Train an LSTM encoder-decoder
   to reverse a sequence of numbers (input: [1,2,3] → output: [3,2,1]).
   Test with sequences of length 5, 10, 20, 50. At what length does
   accuracy drop? This demonstrates the bottleneck.

4. **Research reading:** Find the "Attention Is All You Need" paper
   (Vaswani et al., 2017). Read the abstract and introduction. What
   problem were they trying to solve? What was their key insight?

5. **Timeline reflection:** For each step in the timeline (RNN → LSTM →
   Attention → Transformer), write one sentence explaining what
   problem it solved and what problem remained.

---

Next: [Lesson 13 — Embeddings: Turning Words into Numbers](./13-embeddings.md)
