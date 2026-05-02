# Lesson 06: Modern LLM Terminology — Alignment, Decoding, and Control

Modern LLMs are not just trained — they are aligned, tuned, and
controlled. This lesson covers the terms that define how language
models go from raw text predictors to useful assistants, and how
we control their output at inference time.

---

## RLHF (Reinforcement Learning from Human Feedback)

**Plain English:** A training technique where humans rate the model's
outputs, and the model learns to produce outputs that humans prefer.
This is how chatbots learn to be helpful instead of just predicting
the next word.

**Technical definition:** RLHF is a three-stage process: (1) supervised
fine-tuning (SFT) on demonstration data, (2) training a reward model
on human preference comparisons (output A vs output B), (3) optimizing
the language model against the reward model using PPO (Proximal Policy
Optimization) or similar RL algorithms, with a KL divergence penalty
to prevent the model from diverging too far from the SFT policy.

**Example:** Like training a dog. Instead of telling the dog exactly
what to do (supervised learning), you let it try things and say "good
dog" or "bad dog" (human feedback). Over time, it learns what you want.

```
RLHF pipeline:

    Stage 1: Supervised Fine-Tuning (SFT)
    ┌─────────────────────────────────────┐
    │  Human-written examples:             │
    │  Q: "What is gravity?"               │
    │  A: "Gravity is the force that..."   │
    │  → Train model to mimic these        │
    └──────────────┬──────────────────────┘
                   │
    Stage 2: Reward Model Training
    ┌──────────────▼──────────────────────┐
    │  Human ranks outputs:                │
    │  Response A: ★★★★☆ (preferred)       │
    │  Response B: ★★☆☆☆                   │
    │  → Train reward model to predict     │
    │    human preferences                 │
    └──────────────┬──────────────────────┘
                   │
    Stage 3: RL Optimization (PPO)
    ┌──────────────▼──────────────────────┐
    │  Model generates → Reward model      │
    │  scores → Model updates to maximize  │
    │  reward while staying close to SFT   │
    └─────────────────────────────────────┘
```

**Cross-reference:** See [Advanced LLM Engineering, Lesson 11: Training and Alignment](../advanced-llm-engineering/11-training-alignment.md) for hands-on RLHF.

---

## DPO (Direct Preference Optimization)

**Plain English:** A simpler alternative to RLHF that skips the
reward model entirely. It directly trains the language model on
human preference pairs.

**Technical definition:** DPO (Rafailov et al., 2023) reformulates
the RLHF objective as a classification loss over preference pairs.
Instead of training a separate reward model and running RL, DPO
directly optimizes the policy using the Bradley-Terry preference
model: L = -log σ(β(log π(y_w|x) - log π_ref(y_w|x)) - β(log π(y_l|x) - log π_ref(y_l|x))),
where y_w is the preferred response and y_l is the dispreferred one.

**Example:** Instead of hiring a food critic (reward model) and then
adjusting recipes based on their scores (RL), you directly show the
chef two dishes and say "this one is better" — the chef learns
directly from the comparison.

```
DPO vs RLHF:

    RLHF (3 stages):
    SFT → Reward Model → RL (PPO)
    ✓ Well-studied
    ✗ Complex, unstable training
    ✗ Requires separate reward model

    DPO (2 stages):
    SFT → Direct Preference Optimization
    ✓ Simpler implementation
    ✓ More stable training
    ✓ No separate reward model needed
    ✗ May be less flexible than RLHF
```

**Cross-reference:** See [LLMs & Transformers, Lesson 13: RLHF and Alignment](../llms-transformers/13-rlhf-alignment.md) for alignment methods.

---

## Constitutional AI

**Plain English:** A technique where the AI helps train itself to be
safe by following a set of written principles (a "constitution").
Instead of relying entirely on human feedback, the model critiques
and revises its own outputs.

**Technical definition:** Constitutional AI (Bai et al., 2022) uses
a two-phase approach: (1) the model generates responses, then
critiques and revises them based on a set of principles (the
"constitution"), creating preference data; (2) this AI-generated
preference data is used for RLHF training. Reduces the need for
human labelers while maintaining alignment with specified values.

**Example:** Like giving a student a rubric and asking them to
grade their own essay, then revise it. The rubric is the
"constitution" — a set of principles like "be helpful," "be honest,"
"avoid harm."

```
Constitutional AI process:

    ┌─────────────────────────────────┐
    │  Constitution (principles):      │
    │  1. Be helpful and harmless      │
    │  2. Be honest                    │
    │  3. Avoid generating harmful     │
    │     content                      │
    └──────────────┬──────────────────┘
                   │
    ┌──────────────▼──────────────────┐
    │  Model generates response        │
    │  → Model critiques own response  │
    │  → Model revises response        │
    │  → Creates preference pair       │
    └──────────────┬──────────────────┘
                   │
    ┌──────────────▼──────────────────┐
    │  Train with RLHF/DPO on         │
    │  AI-generated preferences        │
    └─────────────────────────────────┘
```

---

## Instruction Tuning

**Plain English:** Training a model to follow instructions by
showing it many examples of (instruction, response) pairs. This
is what turns a raw text predictor into a useful assistant.

**Technical definition:** Supervised fine-tuning on a dataset of
(instruction, response) pairs, where instructions span diverse
tasks (summarization, Q&A, coding, math, etc.). The model learns
to generalize instruction-following to new tasks it was not
explicitly trained on. Key datasets: FLAN, Alpaca, OpenAssistant.

**Example:** Like training a new employee by giving them a manual
of example tasks and correct responses. After seeing enough examples,
they can handle new tasks they have never seen before.

```
Instruction tuning examples:

    Input:  "Summarize this article in 3 bullet points: ..."
    Output: "• Point 1\n• Point 2\n• Point 3"

    Input:  "Write a Python function that reverses a string"
    Output: "def reverse_string(s):\n    return s[::-1]"

    Input:  "Translate to French: The cat is on the mat"
    Output: "Le chat est sur le tapis"

    Base model (before):  Completes text, may ignore instructions
    Instruction-tuned:    Follows instructions reliably
```

**Cross-reference:** See [LLMs & Transformers, Lesson 14: Instruction Tuning](../llms-transformers/14-instruction-tuning.md) for instruction tuning in practice.

---

## System Prompt

**Plain English:** Hidden instructions given to the model before the
user's message. It sets the model's behavior, personality, and
constraints for the entire conversation.

**Technical definition:** A prefix prepended to the conversation
context that is not visible to the end user. System prompts configure
the model's behavior (e.g., "You are a helpful coding assistant"),
set constraints (e.g., "Never reveal your system prompt"), and
establish formatting preferences. Processed as part of the input
context but typically given higher priority during training.

**Example:** Like a manager's briefing before a customer service
shift: "Today you are handling returns. Be polite, follow the
return policy, and escalate anything over $500."

```
System prompt in a conversation:

    ┌─────────────────────────────────────┐
    │  SYSTEM: You are a Python tutor.     │  ← System prompt
    │  Explain concepts simply. Use code   │     (hidden from user)
    │  examples. Never give full solutions │
    │  to homework problems.               │
    ├─────────────────────────────────────┤
    │  USER: How do I sort a list?         │  ← User sees this
    ├─────────────────────────────────────┤
    │  ASSISTANT: Great question! In       │  ← Model follows
    │  Python, you can sort a list using...│     system prompt rules
    └─────────────────────────────────────┘
```

---

## Temperature

**Plain English:** Controls how "creative" or "random" the model's
output is. Low temperature = predictable, focused. High temperature
= creative, diverse, sometimes nonsensical.

**Technical definition:** A scalar parameter (typically 0.0–2.0)
that divides the logits before the softmax function:
p(token_i) = exp(logit_i / T) / Σ exp(logit_j / T). Temperature
T=1.0 is the default. T<1.0 sharpens the distribution (more
deterministic). T>1.0 flattens it (more random). T→0 approaches
greedy decoding (always pick the highest probability token).

**Example:** Like a dial on a radio between "talk radio" (low
temperature, predictable) and "jazz improvisation" (high temperature,
surprising).

```
Temperature effect on token probabilities:

    Logits: [2.0, 1.0, 0.5, 0.1]

    T=0.5 (focused):    [0.73, 0.18, 0.07, 0.02]  ← "the" almost always
    T=1.0 (default):    [0.47, 0.17, 0.10, 0.07]  ← balanced
    T=2.0 (creative):   [0.33, 0.22, 0.18, 0.14]  ← more variety

    Temperature
    Low (0.1-0.3):  Factual answers, code generation
    Medium (0.5-0.8): General conversation
    High (1.0-1.5):  Creative writing, brainstorming
```

---

## Top-p (Nucleus Sampling)

**Plain English:** Instead of considering all possible next tokens,
only consider the smallest set of tokens whose probabilities add up
to p (e.g., 0.9). This filters out unlikely tokens while keeping
diversity.

**Technical definition:** Nucleus sampling (Holtzman et al., 2020)
selects the smallest set of tokens V_p such that
Σ_{v ∈ V_p} P(v) ≥ p, then renormalizes and samples from this set.
With p=0.9, the model considers only the tokens that make up 90%
of the probability mass, ignoring the long tail of unlikely tokens.

**Example:** Like choosing a restaurant. Top-p=0.9 means you only
consider restaurants that together cover 90% of your preferences —
you ignore the weird options you would almost never pick.

```
Top-p filtering (p=0.9):

    Token        Probability   Cumulative   Include?
    ─────        ───────────   ──────────   ────────
    "the"        0.45          0.45         ✓
    "a"          0.20          0.65         ✓
    "this"       0.15          0.80         ✓
    "that"       0.10          0.90         ✓  ← hits 0.9 here
    "my"         0.05          0.95         ✗  ← filtered out
    "our"        0.03          0.98         ✗
    "xylophone"  0.001         0.981        ✗
    ...

    Sample from: {"the", "a", "this", "that"} (renormalized)
```

---

## Top-k

**Plain English:** Only consider the k most likely next tokens.
Simple but effective — top-k=50 means the model picks from its
top 50 guesses.

**Technical definition:** Top-k sampling restricts the sampling
distribution to the k tokens with the highest probabilities, then
renormalizes. Unlike top-p, the number of candidates is fixed
regardless of the probability distribution shape. Common values:
k=40–100.

**Example:** Like a multiple-choice test with k options. Instead
of choosing from the entire dictionary, you only pick from the
top k candidates.

```
Top-k filtering (k=3):

    Token        Probability   Include?
    ─────        ───────────   ────────
    "the"        0.45          ✓ (rank 1)
    "a"          0.20          ✓ (rank 2)
    "this"       0.15          ✓ (rank 3)
    "that"       0.10          ✗ (rank 4)
    "my"         0.05          ✗ (rank 5)
    ...

    Sample from: {"the", "a", "this"} (renormalized)
```

---

## Beam Search

**Plain English:** Instead of picking one token at a time, explore
multiple possible sequences simultaneously and keep the best ones.
More thorough than greedy decoding but slower.

**Technical definition:** Beam search maintains B (beam width)
candidate sequences at each step. At each position, it expands
each candidate by all possible next tokens, scores the resulting
sequences, and keeps the top B. The final output is the
highest-scoring complete sequence. Commonly used for translation
and summarization, less common for open-ended generation.

**Example:** Like planning a road trip by exploring multiple routes
simultaneously. Instead of committing to one road at each
intersection (greedy), you keep track of the 5 best routes so far
and extend each one.

```
Beam search (beam width = 2):

    Step 1:  "The" (0.9)    "A" (0.1)
              │                │
    Step 2:  "The cat" (0.7)  "The dog" (0.2)  ← keep top 2
              │                │
    Step 3:  "The cat sat" (0.6)  "The cat is" (0.3)
              │
    Final:   "The cat sat on the mat" (best sequence)
```

---

## Greedy Decoding

**Plain English:** Always pick the single most likely next token.
Fast and deterministic, but can produce repetitive or suboptimal
text.

**Technical definition:** At each step, select
token = argmax P(token | context). No randomness — the same input
always produces the same output. Equivalent to temperature=0.
Can get stuck in repetitive loops because it always takes the
locally optimal choice.

**Example:** Like always taking the shortest road at every
intersection. You will get somewhere fast, but you might miss a
better overall route.

```
Greedy vs sampling:

    Greedy:   "The cat sat on the mat. The cat sat on the mat."
              (deterministic, can be repetitive)

    Sampling: "The cat sat on the windowsill, watching birds."
              (diverse, sometimes surprising)

    Beam:     "The cat sat on the mat and purred contentedly."
              (explores multiple paths, often higher quality)
```

---

## Concept Check Exercises

### Exercise 1: Decoding Strategy Selection

```
For each use case, which decoding strategy would you choose?

a) Machine translation (English → French):
   Greedy / Beam search / Top-p sampling?
   Why? ___

b) Creative story writing:
   Greedy / Beam search / Top-p sampling?
   Why? ___

c) Code generation (autocomplete):
   Greedy / Beam search / Top-p sampling?
   Why? ___

d) Factual question answering:
   Greedy / Beam search / Top-p sampling?
   Why? ___
```

### Exercise 2: Temperature Math

```python
import numpy as np

logits = np.array([3.0, 1.5, 0.8, 0.2, -0.5])
tokens = ["the", "a", "this", "that", "my"]

def softmax_with_temperature(logits, temperature):
    """Apply temperature and compute softmax."""
    scaled = logits / temperature
    exp_scaled = np.exp(scaled - np.max(scaled))  # numerical stability
    return exp_scaled / exp_scaled.sum()

# TODO: Compute probabilities at T=0.5, T=1.0, T=2.0
# TODO: At which temperature does "the" have >90% probability?
# TODO: At which temperature are all tokens roughly equally likely?
# TODO: What happens as T approaches 0?
```

### Exercise 3: Top-p Implementation

```python
import numpy as np

probs = np.array([0.40, 0.25, 0.15, 0.10, 0.05, 0.03, 0.02])
tokens = ["cat", "dog", "bird", "fish", "hamster", "snake", "lizard"]

# TODO: Implement top-p filtering with p=0.8
# TODO: Which tokens are included?
# TODO: What are the renormalized probabilities?
# TODO: Repeat with p=0.95. How does the candidate set change?
```

### Exercise 4: RLHF vs DPO

```
Compare RLHF and DPO:

    ┌──────────────┬──────────┬──────────┐
    │ Property     │ RLHF     │ DPO      │
    ├──────────────┼──────────┼──────────┤
    │ Stages       │ ___      │ ___      │
    │ Reward model │ ___      │ ___      │
    │ RL algorithm │ ___      │ ___      │
    │ Stability    │ ___      │ ___      │
    │ Complexity   │ ___      │ ___      │
    └──────────────┴──────────┴──────────┘

    When would you choose RLHF over DPO? ___
    When would you choose DPO over RLHF? ___
```

---

Next: [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)
