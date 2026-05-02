# Lesson 11: Scaling Laws — Why Bigger Models Are Smarter

GPT-1 had 117 million parameters. GPT-3 had 175 billion. GPT-4 is
rumored to have over a trillion. Why does making models bigger make
them smarter? Is there a pattern? And when does it stop working?

This lesson covers one of the most consequential empirical discoveries
in AI: the scaling laws.

---

## The Discovery: Predictable Improvement

In 2020, researchers at OpenAI (Kaplan et al.) noticed something
remarkable: model performance improves in a **smooth, predictable**
way as you increase three things:

1. **Parameters (N):** The number of weights in the model
2. **Data (D):** The number of tokens the model trains on
3. **Compute (C):** The total floating-point operations used for training

And the relationship follows **power laws** -- straight lines on a
log-log plot.

```
Performance (log scale, lower = better loss)
│
│  ╲
│   ╲
│    ╲
│     ╲
│      ╲
│       ╲
│        ╲
│         ╲
│          ╲
│           ╲
│            ╲
└──────────────────── Parameters (log scale)

On a log-log plot, the relationship is a straight line.
This means: 10x more parameters → fixed amount of improvement.
```

**Analogy:** Imagine you're training for a marathon. Every month of
training, your time improves by a predictable amount. The first month
might shave off 30 minutes, the next 20, the next 15. The improvement
is diminishing but predictable. You can estimate your race time three
months from now with surprising accuracy.

Scaling laws are like that: you can predict how good a model will be
before you spend millions training it.

---

## Power Laws: What Are They?

A power law is a relationship of the form:

```
L(x) = a * x^(-b) + c

Where:
  L = loss (how bad the model is, lower = better)
  x = parameters, data, or compute
  a, b, c = constants fitted to data
```

The key property: on a log-log plot, power laws appear as straight
lines. This means there's no "magic threshold" where models suddenly
get better. Improvement is smooth and continuous (with some caveats
we'll discuss later).

```
Linear scale:                Log-log scale:

Loss                         Log(Loss)
│                            │
│╲                           │╲
│ ╲                          │  ╲
│  ╲                         │    ╲
│   ╲                        │      ╲
│    ──╲                     │        ╲
│       ───╲                 │          ╲
│           ────╲            │            ╲
│                ───────     │              ╲
└──────────── Parameters     └──────── Log(Parameters)

Curved on linear scale       Straight line on log-log scale
(diminishing returns)         (predictable relationship)
```

### What This Means in Practice

If 10x more parameters reduces loss by 0.1:
- 100 million params → loss 2.5
- 1 billion params → loss 2.4
- 10 billion params → loss 2.3
- 100 billion params → loss 2.2
- 1 trillion params → loss 2.1

The improvement per 10x gets smaller in absolute terms but remains
proportional in relative terms.

---

## The Three Scaling Dimensions

### Dimension 1: Parameters (Model Size)

More parameters = more capacity to store patterns and knowledge.

```
Model           Parameters    Relative Loss

GPT-2 Small     117M          2.85
GPT-2 Medium    345M          2.65
GPT-2 Large     762M          2.52
GPT-2 XL        1.5B          2.40
GPT-3           175B          ~1.70

Each row: roughly 2-3x more parameters, steady loss decrease
```

**Analogy:** A bigger brain has more neurons and connections. A rat's
brain can learn to navigate a maze. A dog's brain can learn commands.
A human's brain can learn calculus. More neurons (parameters) enable
more complex capabilities.

But there's a catch: if you only increase parameters without increasing
training data, you eventually overfit. The model memorizes the training
data instead of learning general patterns.

### Dimension 2: Training Data

More data = more patterns to learn from, and less overfitting.

```
Training Data     Effect on a 1B Parameter Model

1 billion tokens  Severe overfitting, memorizes training data
10B tokens        Some overfitting, decent generalization
100B tokens       Good generalization, still improving
1T tokens         Near-optimal for this model size
10T tokens        Diminishing returns (model too small to use all data)
```

**Analogy:** Learning to cook. If you only ever make 5 recipes, you'll
be great at those 5 but terrible at anything new. If you make 500
different recipes, you develop general cooking intuition -- knowing
which flavors pair well, what temperature to use, when something is
done.

### Dimension 3: Compute

Compute = parameters * data * training steps. It's the total
computational budget.

```
C ≈ 6 * N * D

Where:
  C = compute (FLOPS)
  N = parameters
  D = training tokens
  6 = constant (forward + backward pass operations per parameter per token)
```

The scaling laws ultimately say: given a fixed compute budget, there's
an optimal way to split it between model size and data.

---

## Chinchilla: The Data Efficiency Revolution (2022)

The original Kaplan scaling laws suggested: for a fixed compute budget,
make the model as big as possible and train it on "enough" data. This
led to GPT-3 (175B parameters trained on 300B tokens).

Then DeepMind trained **Chinchilla** and overturned this wisdom.

### The Chinchilla Finding

For compute-optimal training, parameters and data should scale
roughly equally. The optimal ratio is approximately:

```
D ≈ 20 * N

Training tokens should be ~20x the parameter count.
```

This means GPT-3, with 175B parameters trained on 300B tokens, was
**massively undertrained**. It should have been trained on ~3.5
trillion tokens.

```
┌────────────────┬────────────┬─────────────┬──────────────┐
│ Model          │ Parameters │ Tokens      │ Ratio (D/N)  │
├────────────────┼────────────┼─────────────┼──────────────┤
│ GPT-3          │ 175B       │ 300B        │ 1.7x         │
│ Chinchilla     │ 70B        │ 1.4T        │ 20x          │
│ Llama          │ 65B        │ 1.4T        │ 21.5x        │
│ Llama 2        │ 70B        │ 2T          │ 28.6x        │
│ Llama 3        │ 70B        │ 15T         │ 214x         │
└────────────────┴────────────┴─────────────┴──────────────┘
```

Chinchilla (70B params, 1.4T tokens) **outperformed** GPT-3 (175B
params, 300B tokens) despite being 2.5x smaller. The secret: it was
trained on 4.7x more data.

### Why This Matters

1. **Smaller models can match bigger ones** with more training data
2. **Inference is cheaper** with smaller models (you serve the model
   to users millions of times, so smaller = massive savings)
3. **Training cost shifts** from parameters to data

```
Before Chinchilla:                After Chinchilla:

"Make the model HUGE"             "Train the model LONGER"
175B params, 300B tokens          70B params, 1.4T tokens
Expensive to train AND serve      Cheaper to train AND serve
Underfits the data                Fits the data well
```

**Analogy:** Imagine building a factory. The Kaplan approach said "build
the biggest factory possible." Chinchilla said "build a right-sized
factory and run it at full capacity." A smaller factory running 24/7
outproduces a huge factory running one shift.

### Beyond Chinchilla: Overtrained Models

Modern models (Llama 3, Mistral) go even further: they train MUCH
longer than the Chinchilla-optimal ratio. Why? Because the one-time
training cost matters less than the ongoing inference cost. A smaller
model that's been trained 10x longer is cheaper to serve to millions
of users.

```
Chinchilla-optimal (minimize training cost):
  70B params × 1.4T tokens = X compute

Inference-optimal (minimize serving cost):
  7B params × 14T tokens = same X compute
  → Cheaper to serve, same quality!
```

---

## Emergent Abilities: Sudden Jumps

While scaling laws show smooth, predictable improvement in loss, the
capabilities that emerge from that improvement are anything but smooth.

**Emergent abilities** are capabilities that are essentially absent in
smaller models but appear suddenly at a certain scale.

```
Capability vs Model Size:

Capability
present?
│
│                              ┌─────────
│                              │
│                              │
│                              │
│  ─────────────────────────── │
│  (ability absent)            (suddenly present)
└──────────────────────────────────────────
                              ↑
                     Critical threshold
                     (varies by task)
```

### Examples of Emergence

**Chain-of-thought reasoning** -- the ability to solve multi-step
problems by showing work:

```
Small model (< 10B params):
  Q: "If John has 3 apples and gives away 1, then buys 5 more,
      how many does he have?"
  A: "8" or "3" (random, unreliable)

Large model (> 100B params):
  Q: Same question, with "Let's think step by step."
  A: "John starts with 3 apples. He gives away 1, leaving 2.
      He buys 5 more, giving him 2 + 5 = 7 apples."
```

**Other emergent abilities:**
- Three-digit addition (appears at ~13B params)
- Word unscrambling (appears at ~50B params)
- Understanding sarcasm (appears at ~100B params)
- Multi-step logical reasoning (appears at ~100B+ params)

### Are Emergent Abilities Real?

There's a debate. Some researchers argue that what looks like
"emergence" is actually smooth improvement in the underlying
capability, but our evaluation metrics (accuracy, pass/fail) create
the illusion of a sharp threshold.

```
Underlying capability (smooth):

Accuracy
│           ╱
│         ╱
│       ╱
│     ╱
│   ╱
│ ╱
└──────────── Size

Measured accuracy (step-like):

Accuracy
│                 ┌──────
│                 │
│                 │
│  ───────────────│
│                 │
│                 │
└──────────── Size

If you need 90% token-level accuracy to get a
math problem right, it looks like a step function
even though the underlying skill improves smoothly.
```

This doesn't diminish the practical importance: there IS a scale
below which certain tasks are impossible and above which they work.

---

## The Compute Cost of Scaling

Training large models is enormously expensive:

```
┌──────────────────┬──────────────┬──────────────────┐
│ Model            │ Est. Cost    │ Training Time      │
├──────────────────┼──────────────┼──────────────────┤
│ BERT             │ ~$10K        │ 4 days, 64 TPUs   │
│ GPT-2            │ ~$50K        │ 1 week             │
│ GPT-3            │ ~$4.6M       │ ~1 month           │
│ Chinchilla (70B) │ ~$3-5M       │ ~2 months          │
│ Llama 2 (70B)    │ ~$5-10M      │ ~2 months          │
│ GPT-4            │ ~$100M+      │ ~3-6 months        │
│ Gemini Ultra     │ ~$100-200M+  │ Months             │
└──────────────────┴──────────────┴──────────────────┘

Note: These are rough estimates. Actual costs depend on
hardware availability, engineering efficiency, and pricing.
```

### The Hardware

Training GPT-4-scale models requires:
- Thousands of GPUs (NVIDIA A100 or H100) or TPUs
- High-speed networking between GPUs (NVLink, InfiniBand)
- Massive storage for training data and checkpoints
- Months of continuous operation
- Teams of engineers managing the infrastructure

```
A typical training cluster:

┌─────────┐ ┌─────────┐ ┌─────────┐     ┌─────────┐
│ Node 1  │ │ Node 2  │ │ Node 3  │ ... │ Node N  │
│ 8× H100 │ │ 8× H100 │ │ 8× H100 │     │ 8× H100 │
│ 640GB   │ │ 640GB   │ │ 640GB   │     │ 640GB   │
│ GPU mem │ │ GPU mem │ │ GPU mem │     │ GPU mem │
└────┬────┘ └────┬────┘ └────┬────┘     └────┬────┘
     │           │           │               │
     └───────────┴───────────┴───────────────┘
              High-speed interconnect
              (400 Gbps InfiniBand)

For GPT-4-scale: thousands of nodes = 10,000+ GPUs
```

---

## The Scaling Debate: Is More All You Need?

### The Scaling Maximalists

"Just make models bigger. Intelligence is a function of compute."

**Arguments for:**
- Every capability so far has appeared at sufficient scale
- Scaling laws have been remarkably consistent
- No fundamental ceiling has been observed
- GPT-4 is qualitatively better than GPT-3, which was better than GPT-2

### The Scaling Skeptics

"We need new ideas, not just bigger models."

**Arguments against:**
- We're running out of high-quality training data
- The cost is becoming prohibitive (hundreds of millions of dollars)
- Energy consumption is a real concern
- Some capabilities might require architectural innovations
- Diminishing returns are real -- each 10x costs more but delivers less

### The Reality: Probably Both

The trend in 2024-2025 suggests both camps are partly right:

```
Pure scaling (2020-2022):
  "Just make it bigger" → GPT-3, GPT-4

Scaling + innovation (2023+):
  Better architectures    → Mixture of Experts (MoE)
  Better training data    → Synthetic data, curation
  Better training methods → DPO, RLHF improvements
  Better inference        → Chain-of-thought, extended thinking
  Smaller but smarter     → Llama 3 70B matches GPT-3.5
```

The frontier labs are doing both: scaling up AND innovating on
architecture, data, and training methods.

---

## What About Diminishing Returns?

Power laws have a harsh reality: each order of magnitude improvement
costs 10x more compute, but delivers less and less absolute
improvement.

```
Getting from loss 2.5 to 2.0:  Costs X compute
Getting from loss 2.0 to 1.5:  Costs 100X compute
Getting from loss 1.5 to 1.0:  Costs 10,000X compute

Each step: 100x more expensive for the same loss reduction
```

This doesn't mean it's not worth it. The difference between loss 2.0
and loss 1.5 might be the difference between "can do arithmetic
sometimes" and "can do calculus reliably." The improvements in
capability can be transformative even if the loss curve is flattening.

**Analogy:** The difference between running a 4-hour marathon and a
3-hour marathon is huge in effort but "only" one hour. The difference
between a 3-hour and a 2-hour marathon is practically impossible for
a human. But if you were building a delivery robot, that last hour
matters enormously.

---

## Implications for Developers

Understanding scaling laws helps you make practical decisions:

### 1. Model Selection

```
Task Complexity              Recommended Size

Simple classification        7B (or fine-tuned smaller)
Standard Q&A                 13-70B
Complex reasoning            70B+
Research-frontier tasks      GPT-4/Claude-class
```

### 2. The "Good Enough" Principle

A 7B model fine-tuned on your specific task often outperforms a 70B
general model. Fine-tuning is cheaper than scaling.

```
General 70B model on your task:        85% accuracy
Fine-tuned 7B model on your task:      92% accuracy
Cost difference:                       10x cheaper inference
```

### 3. Understanding Cost vs Quality Tradeoffs

```
API cost (approximate):

Model          Input ($/1M tokens)   Output ($/1M tokens)
Small (7B)     $0.10                 $0.10
Medium (70B)   $0.50                 $1.50
Large (GPT-4)  $10.00                $30.00

100x cost for the best model. Is it worth it for your use case?
```

---

## Thought Experiments

1. **The Data Wall:** We're running low on high-quality internet text.
   There are roughly 10-15 trillion tokens of good text on the
   internet. Once models have trained on all of it, what happens?
   Can you scale further without more data? What are the alternatives?

2. **Compute Prediction:** Using the scaling law `L = 10.6 * C^(-0.05)`,
   if a model trained with 10^23 FLOPS achieves loss 1.8, what loss
   would you expect from 10^24 FLOPS (10x more compute)?

3. **The Emergence Puzzle:** Why might chain-of-thought reasoning
   emerge at 100B parameters but not at 10B? What changes in the
   model's representation as it scales? Is it learning new algorithms,
   or just applying existing ones more reliably?

4. **Small vs Large:** You're building a customer support chatbot.
   A 70B model gives 95% customer satisfaction, a 7B model gives
   88%, and a fine-tuned 7B model gives 93%. The 70B model costs 10x
   more to run. What do you choose and why?

5. **Energy and Ethics:** Training GPT-4 reportedly used as much energy
   as 100 homes use in a year. Is this justifiable? At what point does
   the environmental cost of scaling outweigh the benefits? How might
   this change as hardware becomes more efficient?

---

## Key Takeaways

1. **Scaling is predictable:** Model performance follows power laws with
   respect to parameters, data, and compute.
2. **Chinchilla changed the game:** Train models for longer on more
   data, not just with more parameters. The optimal ratio is
   roughly 20 tokens per parameter.
3. **Emergent abilities appear at scale:** Some capabilities (reasoning,
   chain-of-thought) suddenly work at sufficient scale.
4. **Cost grows exponentially:** Each 10x improvement costs ~100x more.
5. **Scaling alone isn't enough:** Modern progress combines scaling with
   architectural innovation, better data, and better training methods.
6. **Practical implication:** For most tasks, a well-fine-tuned smaller
   model beats a generic larger model.

Next: [Lesson 12 — Pretraining: Training an LLM on the Internet](./12-pretraining.md)
