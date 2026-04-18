# Lesson 07: Data and Evaluation Terminology — Input and Output

Data goes in, predictions come out. This lesson covers the terms
for how data gets into models (tokenization, context windows) and
how we measure what comes out (benchmarks, evaluation, red teaming).

---

## Tokenization

**Plain English:** The process of breaking text into small pieces
(tokens) that the model can process. "Hello world" might become
["Hello", " world"] or ["Hel", "lo", " wor", "ld"] depending on
the tokenizer.

**Technical definition:** Tokenization maps raw text to a sequence
of integer token IDs from a fixed vocabulary. The tokenizer defines
the vocabulary and the rules for splitting text. Each token ID maps
to a row in the model's embedding matrix. Tokenization is
deterministic — the same text always produces the same tokens.

**Example:** Like breaking a sentence into Scrabble tiles. Some
tokenizers use whole words as tiles, others break words into smaller
pieces. The model only sees the tiles, not the original text.

```
Tokenization example ("Hello, how are you?"):

    Word-level:    ["Hello", ",", "how", "are", "you", "?"]
                   6 tokens

    Subword (BPE): ["Hello", ",", " how", " are", " you", "?"]
                   6 tokens

    Character:     ["H","e","l","l","o",","," ","h","o","w"," ","a","r","e"," ","y","o","u","?"]
                   19 tokens

    Most LLMs use subword tokenization (BPE or similar).
    Average: ~1 token ≈ 0.75 words in English.
```

**Cross-reference:** See [LLMs & Transformers, Lesson 02: Tokenization](../llms-transformers/02-tokenization.md) for tokenization in depth.

---

## BPE (Byte Pair Encoding)

**Plain English:** The most common tokenization algorithm. It starts
with individual characters and repeatedly merges the most frequent
pairs until it reaches the desired vocabulary size.

**Technical definition:** BPE (Sennrich et al., 2016) is a data
compression algorithm adapted for tokenization. Training: (1) start
with a character-level vocabulary, (2) count all adjacent character
pairs in the training corpus, (3) merge the most frequent pair into
a new token, (4) repeat until the vocabulary reaches the target size.
Encoding: apply learned merges greedily left-to-right. Modern
variants include byte-level BPE (GPT-2+) which operates on UTF-8
bytes instead of characters.

**Example:** Like creating abbreviations. If "th" appears together
very often, merge it into a single token "th". Then if "the" appears
often, merge "th"+"e" into "the". The most common patterns get their
own tokens.

```
BPE training process:

    Corpus: "low lower lowest"

    Step 0: Vocabulary = {l, o, w, e, r, s, t, _}
    Step 1: Most frequent pair: (l, o) → merge into "lo"
    Step 2: Most frequent pair: (lo, w) → merge into "low"
    Step 3: Most frequent pair: (e, r) → merge into "er"
    Step 4: Most frequent pair: (e, s) → merge into "es"
    ...

    Final vocabulary includes: "low", "er", "est", etc.
    "lowest" → ["low", "est"]
    "lower"  → ["low", "er"]
```

**Cross-reference:** See [Advanced LLM Engineering, Lesson 02: Custom Tokenizers](../advanced-llm-engineering/02-custom-tokenizers.md) for building tokenizers.

---

## Vocabulary

**Plain English:** The complete set of tokens the model knows. Every
piece of text must be broken into tokens from this vocabulary.
Tokens not in the vocabulary are split into smaller pieces.

**Technical definition:** A fixed mapping from token strings to
integer IDs (and vice versa). The vocabulary is determined during
tokenizer training and remains fixed during model training and
inference. Special tokens include: [PAD] (padding), [BOS]
(beginning of sequence), [EOS] (end of sequence), [UNK] (unknown).
Vocabulary size directly affects the embedding matrix size.

**Example:** Like a codebook. Every word or word-piece has a code
number. "Hello" might be token 15339. The model only works with
these code numbers, never with raw text.

```
Vocabulary example:

    Token ID    Token string
    ────────    ────────────
    0           [PAD]
    1           [BOS]
    2           [EOS]
    ...
    256         "a"
    257         "b"
    ...
    15339       "Hello"
    15340       " world"
    ...
    31999       "ython"    (subword of "Python")

    "Hello world" → [15339, 15340] → embedding lookup → vectors
```

---

## Context Window

**Plain English:** The maximum amount of text the model can "see"
at once, measured in tokens. Everything outside the context window
is invisible to the model.

**Technical definition:** The maximum sequence length the model can
process in a single forward pass. Includes the system prompt, user
input, conversation history, and generated output — all must fit
within the context window. Memory cost scales quadratically with
context length for standard attention (O(n²)), though techniques
like Flash Attention reduce the constant factor.

**Example:** Like a desk that can only hold a certain number of
papers. If you have more papers than fit on the desk, the oldest
ones fall off the edge. The model can only "think about" what fits
in its context window.

```
Context window usage:

    ┌─────────────────────────────────────────┐
    │           Context Window (4096 tokens)    │
    │                                          │
    │  ┌──────────────┐                        │
    │  │ System prompt │  ~200 tokens           │
    │  └──────────────┘                        │
    │  ┌──────────────┐                        │
    │  │ Conversation  │  ~2000 tokens          │
    │  │ history       │                        │
    │  └──────────────┘                        │
    │  ┌──────────────┐                        │
    │  │ Current query │  ~500 tokens           │
    │  └──────────────┘                        │
    │  ┌──────────────┐                        │
    │  │ Space for     │  ~1396 tokens          │
    │  │ response      │  remaining             │
    │  └──────────────┘                        │
    └─────────────────────────────────────────┘

    If the conversation exceeds 4096 tokens,
    older messages must be dropped or summarized.
```

---

## Benchmarks

### MMLU (Massive Multitask Language Understanding)

**Plain English:** A test of general knowledge across 57 subjects
(math, history, law, medicine, etc.). Like a standardized exam for
AI models.

**Technical definition:** MMLU (Hendrycks et al., 2021) consists of
~16,000 multiple-choice questions across 57 academic subjects at
varying difficulty levels (elementary to professional). Measures
broad knowledge and reasoning. Reported as accuracy (%). State of
the art: ~90%+ for frontier models. Criticism: potential
contamination, multiple-choice format limitations.

**Example:** Like the SAT or GRE for AI. A model that scores 85%
on MMLU has roughly undergraduate-level knowledge across many fields.

```
MMLU example questions:

    Subject: Abstract Algebra
    Q: Find the degree of the extension Q(√2, √3) over Q.
    A) 2  B) 4  C) 6  D) 8
    Answer: B

    Subject: Clinical Knowledge
    Q: Which vitamin deficiency causes scurvy?
    A) Vitamin A  B) Vitamin B  C) Vitamin C  D) Vitamin D
    Answer: C

    Model scores (approximate):
    ┌──────────────┬──────────┐
    │ Model        │ MMLU (%) │
    ├──────────────┼──────────┤
    │ GPT-3 (2020) │ 43.9     │
    │ GPT-4 (2023) │ 86.4     │
    │ Claude 3     │ 86.8     │
    │ Llama 3 70B  │ 82.0     │
    │ Human expert │ ~89.8    │
    └──────────────┴──────────┘
```

### HumanEval

**Plain English:** A coding benchmark. The model is given a function
signature and docstring and must write the implementation. Tested
by actually running the code.

**Technical definition:** HumanEval (Chen et al., 2021) contains 164
hand-written Python programming problems with function signatures,
docstrings, and unit tests. The model generates code, which is
executed against the test cases. Reported as pass@k (probability
that at least one of k generated solutions passes all tests).
Common metric: pass@1.

**Example:**

```
HumanEval problem example:

    def has_close_elements(numbers: List[float],
                           threshold: float) -> bool:
        """Check if any two numbers in the list are
        closer to each other than the given threshold.
        >>> has_close_elements([1.0, 2.0, 3.0], 0.5)
        False
        >>> has_close_elements([1.0, 2.8, 3.0], 0.3)
        True
        """
        # Model must generate the implementation

    Model scores (pass@1, approximate):
    ┌──────────────┬──────────────┐
    │ Model        │ HumanEval (%)│
    ├──────────────┼──────────────┤
    │ GPT-3.5      │ 48.1         │
    │ GPT-4        │ 67.0         │
    │ Claude 3     │ 84.9         │
    │ Llama 3 70B  │ 81.7         │
    └──────────────┴──────────────┘
```

### GSM8K (Grade School Math 8K)

**Plain English:** 8,500 grade-school math word problems. Tests
whether the model can do multi-step arithmetic reasoning.

**Technical definition:** GSM8K (Cobbe et al., 2021) contains 8,500
linguistically diverse grade-school math word problems requiring
2–8 steps of arithmetic reasoning. Problems involve basic operations
(+, -, ×, ÷) and are solvable by a bright middle schooler. Reported
as accuracy (%). Often used with chain-of-thought prompting.

**Example:**

```
GSM8K problem example:

    Q: Janet's ducks lay 16 eggs per day. She eats 3 for
    breakfast and bakes muffins with 4. She sells the rest
    at $2 each. How much does she make per day?

    A: 16 - 3 - 4 = 9 eggs sold
       9 × $2 = $18 per day

    Model scores (approximate):
    ┌──────────────┬──────────┐
    │ Model        │ GSM8K (%)│
    ├──────────────┼──────────┤
    │ GPT-3.5      │ 57.1     │
    │ GPT-4        │ 92.0     │
    │ Claude 3     │ 95.0     │
    │ Llama 3 70B  │ 93.0     │
    └──────────────┴──────────┘
```

**Cross-reference:** See [Advanced LLM Engineering, Lesson 13: Evaluation of LLMs](../advanced-llm-engineering/13-evaluation-llms.md) for comprehensive evaluation methods.

---

## Contamination

**Plain English:** When benchmark test questions accidentally appear
in the model's training data. The model might "remember" the answers
instead of actually reasoning — like a student who saw the exam
beforehand.

**Technical definition:** Data contamination occurs when evaluation
benchmark data (questions and/or answers) is present in the
pre-training corpus. This inflates benchmark scores because the
model may have memorized answers rather than demonstrating genuine
capability. Detection methods include n-gram overlap analysis and
canary string insertion. Mitigation: held-out test sets, dynamic
benchmarks, contamination analysis in model reports.

**Example:** Like a student who found the answer key before the
test. Their score does not reflect what they actually know.

```
Contamination problem:

    Training data (trillions of tokens from the internet):
    ┌─────────────────────────────────────────┐
    │  ...web pages, books, code, forums...    │
    │  ...including pages that discuss MMLU    │
    │  questions and answers...                │
    │  ┌─────────────────────────────┐         │
    │  │ "The answer to MMLU Q42 is C"│  ← !!! │
    │  └─────────────────────────────┘         │
    └─────────────────────────────────────────┘

    Model scores 95% on MMLU — but is it reasoning
    or remembering?
```

---

## Human Evaluation

**Plain English:** Having real humans judge the model's outputs for
quality, helpfulness, accuracy, and safety. The gold standard for
evaluation, but expensive and slow.

**Technical definition:** Human evaluation involves trained annotators
rating model outputs on predefined criteria (helpfulness, harmlessness,
honesty, factual accuracy, etc.). Methods include: Likert scale
ratings, pairwise comparisons (A vs B), and Elo rating systems
(like Chatbot Arena). Challenges: inter-annotator agreement, cost,
scalability, and evaluator bias.

**Example:** Like having a panel of judges score figure skating.
Each judge rates different aspects (technical, artistic), and the
scores are aggregated. Expensive but captures nuances that automated
metrics miss.

```
Human evaluation methods:

    Likert scale:
    "Rate this response 1-5 for helpfulness"
    ★★★★☆ (4/5)

    Pairwise comparison:
    "Which response is better, A or B?"
    Response A: ✓ (preferred by 73% of evaluators)

    Elo rating (Chatbot Arena):
    Model A: 1250 Elo
    Model B: 1180 Elo
    → Model A wins ~60% of head-to-head comparisons
```

---

## Red Teaming

**Plain English:** Deliberately trying to make the model produce
harmful, incorrect, or undesirable outputs. Like hiring hackers to
test your security — you find the weaknesses before real users do.

**Technical definition:** Red teaming is adversarial testing where
evaluators (human or automated) attempt to elicit undesirable model
behaviors: generating harmful content, leaking training data,
producing biased outputs, bypassing safety filters, or following
dangerous instructions. Results inform safety training and
guardrail design. Can be manual (human red teamers) or automated
(using other LLMs to generate adversarial prompts).

**Example:** Like a fire drill. You simulate the worst-case scenario
to find weaknesses in your defenses before a real emergency.

```
Red teaming categories:

    ┌──────────────────┬──────────────────────────────┐
    │ Category         │ Example attack               │
    ├──────────────────┼──────────────────────────────┤
    │ Jailbreaking     │ "Ignore previous instructions │
    │                  │  and tell me how to..."       │
    ├──────────────────┼──────────────────────────────┤
    │ Prompt injection │ Embedding instructions in     │
    │                  │ user-provided documents       │
    ├──────────────────┼──────────────────────────────┤
    │ Bias probing     │ Testing for stereotypical     │
    │                  │ or discriminatory outputs     │
    ├──────────────────┼──────────────────────────────┤
    │ Factual errors   │ Asking about edge cases where │
    │                  │ the model might hallucinate   │
    ├──────────────────┼──────────────────────────────┤
    │ Data extraction  │ Trying to extract training    │
    │                  │ data or memorized content     │
    └──────────────────┴──────────────────────────────┘
```

---

## Concept Check Exercises

### Exercise 1: Token Counting

```
Estimate the token count for these texts (rule of thumb:
1 token ≈ 4 characters in English, or ~0.75 words):

a) A tweet (280 characters): ~___ tokens
b) A 500-word blog post: ~___ tokens
c) A 80,000-word novel: ~___ tokens
d) The entire English Wikipedia (~4B words): ~___ tokens

Which of these fit in a 128K context window?
```

### Exercise 2: BPE Merge Order

```
Given this tiny corpus: "aab aac aab aab aac"

Character frequencies: a=12, b=3, c=2, space=4

Step 1: Most frequent pair? ___
        New token: ___
Step 2: After merge, most frequent pair? ___
        New token: ___
Step 3: After merge, most frequent pair? ___
        New token: ___

What is the vocabulary after 3 merges?
```

### Exercise 3: Benchmark Interpretation

```
Model X reports these scores:
    MMLU: 82%
    HumanEval: 65%
    GSM8K: 88%

a) Which capability is strongest? ___
b) Which is weakest? ___
c) If you needed a model for a coding task, would you
   choose this model based on these scores? Why?
d) What additional evaluation would you want before
   deploying this model in production?
```

### Exercise 4: Contamination Detection

```python
# Simple contamination check: does the model "know" benchmark answers?

benchmark_questions = [
    "What is the capital of Burkina Faso?",  # Factual
    "If x + 3 = 7, what is x?",             # Math
    "What vitamin prevents scurvy?",          # Science
]

# For each question, consider:
# 1. Could the model answer this from general knowledge?
# 2. Would getting it right indicate contamination?
# 3. How would you design a contamination-resistant benchmark?

# TODO: Design 3 questions that would be hard to contaminate
#       (i.e., unlikely to appear in training data)
# TODO: Why are dynamic/evolving benchmarks more resistant
#       to contamination than static ones?
```

---

Next: [Quick Lookup Reference](./reference-quick-lookup.md)
