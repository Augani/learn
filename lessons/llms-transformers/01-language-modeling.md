# Lesson 01: Language Modeling — Predicting the Next Word

Every large language model — GPT-4, Claude, Llama — is fundamentally doing
one thing: predicting the next word. This lesson explains why that deceptively
simple task leads to something that looks like intelligence.

---

## The Autocomplete Analogy

You already use a language model every day: your phone keyboard.

```
You type:    "Hey, are you coming to the ___"
Phone suggests: "party"  "game"  "meeting"

You type:    "I'll be there in ___"
Phone suggests: "5"  "10"  "a"

You type:    "The weather today is really ___"
Phone suggests: "nice"  "cold"  "bad"
```

Your phone keyboard is a tiny language model. It has seen millions of text
messages and learned patterns: after "coming to the," people usually say
"party" or "meeting." It assigns probabilities to possible next words and
shows you the most likely ones.

GPT-4 and Claude do the exact same thing. They just do it with:
- Way more training data (trillions of words instead of your text history)
- Way more parameters (billions instead of thousands)
- Way more context (thousands of words instead of a few)

That is literally it. The magic is in the scale.

---

## What Is a Language Model?

A language model is a system that assigns probabilities to sequences of words.
Given some context (the words so far), it tells you how likely each possible
next word is.

```
Given: "The cat sat on the"

Probabilities:
  mat     → 0.25  (25%)
  floor   → 0.15  (15%)
  table   → 0.10  (10%)
  roof    → 0.05  (5%)
  the     → 0.01  (1%)
  quantum → 0.0001 (0.01%)
  ...thousands more words with tiny probabilities
```

The model does NOT "understand" cats or mats. It has learned from billions
of sentences that "mat" frequently follows "the cat sat on the." The
probabilities come from patterns in the training data.

Think of it like a weather forecaster. They don't control the weather.
They have seen thousands of weather patterns and can predict what comes
next based on current conditions. A language model is a word forecaster.

---

## N-Grams: The Simplest Language Model

Before neural networks, language models worked by literally counting.

### Bigrams (2-grams): Count pairs of words

Look at this training corpus:
```
"the cat sat on the mat"
"the cat ate the fish"
"the dog sat on the rug"
```

Count every pair of consecutive words:
```
"the cat"  → appears 2 times
"cat sat"  → appears 1 time
"cat ate"  → appears 1 time
"sat on"   → appears 2 times
"on the"   → appears 2 times
"the mat"  → appears 1 time
"the fish" → appears 1 time
"the dog"  → appears 1 time
"the rug"  → appears 1 time
"dog sat"  → appears 1 time
"ate the"  → appears 1 time
```

Now predict: what comes after "the cat"?
- "sat" appeared 1 time after "the cat" → probability 1/2 = 50%
- "ate" appeared 1 time after "the cat" → probability 1/2 = 50%

That is a bigram language model. Simple counting.

### Trigrams, 4-grams, 5-grams

Use more context:

```
Bigram:   P(next | previous 1 word)     "the ___"
Trigram:  P(next | previous 2 words)    "cat sat ___"
4-gram:   P(next | previous 3 words)    "the cat sat ___"
5-gram:   P(next | previous 4 words)    "the cat sat on ___"
```

More context = better predictions. But there is a fatal flaw.

### The curse of sparsity

With 50,000 words in your vocabulary:
```
Bigrams:   50,000^2  =         2.5 billion  possible pairs
Trigrams:  50,000^3  =   125 trillion       possible triples
4-grams:   50,000^4  =   way too many       possible sequences
```

Most of these combinations never appear in your training data. You quickly
run into sequences the model has literally never seen before.

```
"The cat sat on the" → seen many times, good predictions
"The ambassador negotiated with the" → maybe seen once
"The quantum physicist debated the" → never seen, no prediction possible
```

N-gram models are like a student who memorizes exam answers but can not
reason about new questions. They work for common phrases but fall apart
on anything novel.

### Python: Building a simple bigram model

```python
from collections import defaultdict
import random

def build_bigram_model(text):
    words = text.lower().split()
    counts = defaultdict(lambda: defaultdict(int))

    for current_word, next_word in zip(words[:-1], words[1:]):
        counts[current_word][next_word] += 1

    model = {}
    for word, next_words in counts.items():
        total = sum(next_words.values())
        model[word] = {w: c / total for w, c in next_words.items()}

    return model


def predict_next(model, word):
    if word not in model:
        return None
    probs = model[word]
    words = list(probs.keys())
    weights = list(probs.values())
    return random.choices(words, weights=weights, k=1)[0]


def generate(model, start_word, length=10):
    result = [start_word]
    current = start_word
    for _ in range(length):
        next_word = predict_next(model, current)
        if next_word is None:
            break
        result.append(next_word)
        current = next_word
    return " ".join(result)


corpus = """
the cat sat on the mat. the cat ate the fish.
the dog sat on the rug. the cat chased the dog.
the dog ran to the park. the cat slept on the mat.
"""

model = build_bigram_model(corpus)
print(generate(model, "the", length=15))
```

Run this a few times. The output is grammatical-ish but incoherent. That is
the limitation of looking at only one previous word.

---

## Why Context Matters

Consider this sentence:

```
"The doctor told the patient that ___ needed to rest."
```

What fills the blank? "she" or "he" — but which one? You need to know something
about the doctor or patient mentioned earlier in the conversation.

```
"Sarah went to the hospital. The doctor told the patient that ___ needed to rest."
```

Now "she" is more likely. But that context is 10+ words back. A bigram model
only sees the word "that" and has no idea about Sarah.

This is the fundamental challenge: language has LONG-RANGE DEPENDENCIES.
The meaning of a word can depend on context from paragraphs ago.

```
Context window needed:

Bigram:      1 word    → "the ___"
5-gram:      4 words   → "told the patient that ___"
RNN:         ~100 words (in theory, less in practice)
Transformer: 4,000-200,000+ words
```

Modern transformers can use thousands of words of context. That is why they
are so much better than n-grams.

---

## Perplexity: Measuring How Good a Language Model Is

Perplexity measures how "surprised" a model is by the text it sees. Lower
perplexity = better model.

**The analogy:** Imagine you are guessing the next card in a deck.

- If there are 52 equally likely cards, your perplexity is 52. Very surprised.
- If you know it is a red card, your perplexity drops to 26. Less surprised.
- If you know it is the ace of spades, your perplexity is 1. Not surprised at all.

For language models:
```
Model A sees "The cat sat on the ___"
  → assigns P("mat") = 0.5
  → perplexity for this word: 1/0.5 = 2

Model B sees "The cat sat on the ___"
  → assigns P("mat") = 0.01
  → perplexity for this word: 1/0.01 = 100
```

Model A is less surprised (perplexity 2) — it predicted "mat" was likely.
Model B is very surprised (perplexity 100) — it did not see "mat" coming.

Over an entire text, perplexity is the geometric mean of these per-word
surprises. A perplexity of 20 means the model is, on average, as uncertain
as if it were choosing between 20 equally likely words at each position.

```
Typical perplexity values:
  Random guessing (50k vocab):   ~50,000
  Simple n-gram model:           ~200-1000
  Good LSTM:                     ~60-80
  GPT-2 (1.5B params):           ~20-30
  GPT-3 (175B params):           ~15-20
```

Lower = the model is a better word predictor = it understands language better.

### The math (simplified)

```
Perplexity = 2^(cross-entropy)

Cross-entropy = -1/N * sum(log2(P(word_i | context)))

Where N = number of words in the test text
```

You do not need to memorize this. Just remember: perplexity = how surprised
the model is. Less surprise = better model.

---

## Neural Language Models: Using Networks Instead of Counting

The breakthrough: instead of counting word sequences, use a neural network
to predict the next word.

```
N-gram approach:
  Input:  "the cat sat on the"
  Method: Look up this exact sequence in a giant table of counts
  Problem: If this exact sequence was never seen, no prediction

Neural approach:
  Input:  "the cat sat on the"
  Method: Convert words to vectors, feed through neural network
  Output: Probability distribution over ALL possible next words
  Advantage: Can generalize — even if it never saw this exact sequence,
             it learned that "sat on the" patterns are often followed
             by furniture/surface words
```

The key insight: neural networks GENERALIZE. They do not just memorize;
they learn patterns.

```
                    +-----------+
 "the" ──→ [vec] ──┤           │
 "cat" ──→ [vec] ──┤  Neural   ├──→ P("mat") = 0.25
 "sat" ──→ [vec] ──┤  Network  ├──→ P("floor") = 0.15
 "on"  ──→ [vec] ──┤           ├──→ P("table") = 0.10
 "the" ──→ [vec] ──┤           ├──→ P("roof") = 0.05
                    +-----------+    P(...) = ...
                                     (50,000 probabilities)
```

Each word is converted to a vector (embedding), the vectors are fed through
the network, and the output is a probability for every word in the vocabulary.

This is Bengio's 2003 insight. RNNs and LSTMs improved on it (Track 7).
Transformers revolutionized it (the rest of this track).

---

## Why Next-Word Prediction Is Surprisingly Powerful

This is the most counterintuitive part. How does "just predict the next word"
lead to something that can write essays, answer questions, write code, and
reason about problems?

### To predict well, you must understand

Consider predicting the next word in these sentences:

```
"The capital of France is ___"
→ To predict "Paris", you need world knowledge

"If x + 3 = 7, then x = ___"
→ To predict "4", you need arithmetic

"The function returns None because the list is ___"
→ To predict "empty", you need programming knowledge

"She felt sad because her dog had ___"
→ To predict "died" or "run away", you need emotional reasoning

"The author argues that climate change is caused by ___"
→ To predict well, you need to understand argumentation
```

A model that perfectly predicts the next word in ALL human text would
need to understand essentially everything humans write about: math, science,
emotions, logic, code, history, culture.

**The prediction task is a proxy for understanding.** You cannot be a perfect
next-word predictor without being a perfect understander.

### The compression analogy

Think of it this way: predicting the next word is equivalent to compressing
text. If you can predict the next word perfectly, you can compress text to
zero bits (you already know what it says). Good prediction = good compression =
deep understanding of the patterns in the data.

A model trained on all of Wikipedia, all of Reddit, all of StackOverflow,
all published books — to predict the next word well on ALL of that — must
build an internal model of the world that these texts describe.

### The unreasonable effectiveness

This is why scaling works. You do not need to explicitly teach the model
grammar rules, facts, reasoning strategies, or social norms. You just need
to give it enough text and enough parameters, and it learns all of these
things because they help it predict the next word better.

```
Small model (1M params):
  Can learn simple grammar patterns
  "The cat ___ on the mat" → "sat" (common pattern)

Medium model (100M params):
  Can learn facts and some reasoning
  "The capital of France is ___" → "Paris"

Large model (100B params):
  Can learn complex reasoning, coding, math
  "def fibonacci(n): ___" → correct implementation

Very large model (1T+ params):
  Can do things nobody explicitly trained it to do
  Multi-step reasoning, creative writing, nuanced analysis
```

Each increase in scale unlocks qualitatively new capabilities. This was
unexpected and is still not fully understood.

---

## How GPT Works (The Spoiler)

Here is the punchline for this entire track. GPT (Generative Pre-trained
Transformer) is a language model. It predicts the next word. That is all.

```
GPT generating a response:

User:  "What is the capital of France?"
GPT:   (What word comes next after this question?)
       → "The"
       (What comes after "...France? The"?)
       → "capital"
       (What comes after "...France? The capital"?)
       → "of"
       (What comes after "...France? The capital of"?)
       → "France"
       (What comes after "...France? The capital of France"?)
       → "is"
       (What comes after "...France? The capital of France is"?)
       → "Paris"
       (What comes after "...Paris"?)
       → "."
```

Every word in the response is generated one at a time, left to right, by
predicting the most likely next word given everything that came before.

When you have a conversation with Claude or ChatGPT, the model sees your
entire conversation history as its context and predicts what a helpful
assistant would say next, one word at a time.

```
The full pipeline (simplified):

1. PRETRAIN: Show the model trillions of words from the internet.
             Train it to predict the next word.
             → Model learns language, facts, reasoning patterns.

2. FINE-TUNE: Show the model examples of helpful conversations.
              Train it to predict what a helpful assistant says.
              → Model learns to be helpful.

3. ALIGN (RLHF): Have humans rate model responses.
                  Train the model to produce responses humans prefer.
                  → Model learns to be safe, honest, and actually useful.

4. INFERENCE: User types a prompt.
              Model generates one word at a time.
              Each word is the predicted "most likely next word."
              → You get a response.
```

The rest of this track explains each of these steps in detail, starting
with how text is converted to numbers (tokenization) and building up to
the transformer architecture that makes all of this possible.

---

## The Key Takeaways

```
1. A language model predicts the next word given context.

2. N-grams do this by counting. Neural models do it by learning patterns.

3. Neural models generalize — they handle sequences never seen in training.

4. Perplexity measures prediction quality. Lower = better.

5. Next-word prediction is surprisingly powerful because good prediction
   requires deep understanding of language and the world.

6. GPT, Claude, and every modern LLM are "just" very large, very good
   next-word predictors.
```

---

## Exercises

### Exercise 1: Build intuition for n-grams
Take any paragraph of text. Write out all the bigrams (consecutive word
pairs). For each word, list what words follow it and how often. Try to
predict the next word using only your bigram table. Where does it fail?

### Exercise 2: The context game
For each sentence below, identify the minimum context needed to predict
the blank. How many words back do you need to look?

```
a) "She put the book on the ___"
b) "The Python function raised a ValueError because the input ___"
c) "Although the weather was terrible, they decided to ___"
d) "The variable x, which was initialized on line 3, is used on line 47 to ___"
```

### Exercise 3: Why prediction requires understanding
Come up with three sentences where predicting the next word correctly
requires:
1. Factual knowledge about the world
2. Mathematical or logical reasoning
3. Understanding of social context or emotions

### Exercise 4: Run the bigram model
Run the Python bigram model above with different corpora. Try:
- Song lyrics
- A programming tutorial
- A news article
How does the generated text differ? Why?

### Exercise 5: Perplexity intuition
A model has perplexity 100 on a test set. What does this mean in plain
English? If you improved the model and perplexity dropped to 20, how
much better is the model at prediction?

---

## What is next

We said the model needs to turn words into numbers. But how exactly?
You cannot just assign word #1, word #2, word #3. The representation
matters enormously. [Lesson 02](./02-tokenization.md) covers tokenization:
how text becomes the numbers that the model actually works with.

---

[Next: Lesson 02 — Tokenization](./02-tokenization.md) | [Back to Roadmap](./00-roadmap.md)
