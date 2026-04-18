# Lesson 05: The Post-Training Pipeline — From Base Model to Aligned Assistant

A base model can complete text, but it cannot follow instructions, refuse
harmful requests, or have a conversation. Post-training transforms a raw
text predictor into a helpful, harmless assistant. This is where models
go from "impressive autocomplete" to "useful tool."

---

## The Core Idea

Post-training is like training a new employee. They graduated from
university (pre-training) with broad knowledge, but they do not know
your company's processes, communication style, or safety policies. You
first show them examples of good work (SFT), then have experienced
colleagues rate their outputs (reward modeling), and finally let them
practice with feedback (RLHF/DPO). The result is someone who is both
knowledgeable and aligned with your organization's values.

```
The Post-Training Pipeline:

  ┌──────────────┐
  │  Base Model   │  Can complete text, no instruction following
  │  (from pre-   │
  │   training)   │
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Supervised   │  Train on (instruction, response) pairs
  │  Fine-Tuning  │  ~10K-100K high-quality examples
  │  (SFT)        │  1-3 epochs
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Reward Model │  Train a model to score responses
  │  Training     │  Human preference data: A > B
  │               │  ~100K-500K comparisons
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  RLHF / DPO  │  Optimize the model to produce
  │  Alignment    │  responses the reward model scores
  │               │  highly (or directly from preferences)
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Safety       │  Red teaming, safety fine-tuning,
  │  Training     │  refusal training, content filtering
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Evaluation   │  Benchmarks, human evaluation,
  │  & Release    │  A/B testing
  └──────────────┘
```

---

## Stage 1: Supervised Fine-Tuning (SFT)

SFT teaches the model to follow instructions by training on
high-quality (instruction, response) pairs.

```
SFT Data Format:

  ┌──────────────────────────────────────────────┐
  │  System: You are a helpful assistant.        │
  │                                              │
  │  User: Explain photosynthesis in simple      │
  │        terms.                                │
  │                                              │
  │  Assistant: Photosynthesis is how plants     │
  │  make food using sunlight. They take in      │
  │  carbon dioxide from the air and water from  │
  │  the soil, then use sunlight energy to       │
  │  convert these into glucose (sugar) and      │
  │  oxygen. Think of it as the plant's way of   │
  │  cooking — sunlight is the stove, CO2 and    │
  │  water are the ingredients, and sugar is     │
  │  the meal.                                   │
  └──────────────────────────────────────────────┘

  Training signal:
  - Loss computed ONLY on the assistant's response
  - System and user messages are context (no loss)
  - This teaches the model to generate helpful responses
    given instructions
```

**SFT data sources:**
- Human-written demonstrations (~10K-100K examples)
- Distilled from stronger models (with permission)
- Curated from existing datasets (ShareGPT, FLAN, etc.)

**Key SFT hyperparameters:**

```
SFT Training (typical for 7B model):

  ┌──────────────────────────────────────────────────┐
  │  Hyperparameter        │  Typical Value           │
  ├────────────────────────┼──────────────────────────┤
  │  Dataset size          │  10K-100K examples       │
  │  Epochs                │  1-3                     │
  │  Learning rate         │  2e-5 (much lower than   │
  │                        │  pre-training)           │
  │  Batch size            │  128-512 examples        │
  │  Sequence length       │  4096-8192 tokens        │
  │  Training time         │  Hours (not weeks)       │
  │  Compute               │  <1% of pre-training     │
  └────────────────────────┴──────────────────────────┘
```

**Analogy: SFT is like showing a new employee example reports.** They
already know the language and the domain (from pre-training). SFT just
shows them the format and style you expect.

---

## Stage 2: Reward Model Training

A reward model learns to score responses based on human preferences.
It takes a (prompt, response) pair and outputs a scalar score.

```
Reward Model Training Data:

  Prompt: "Write a haiku about coding"

  Response A: "Fingers on the keys     ← Human prefers A
               Bugs emerge from logic
               Coffee fuels the fix"

  Response B: "Code is fun and cool    ← Less preferred
               I like to write programs
               Computers are great"

  Training signal: Score(A) > Score(B)

  ┌──────────────────────────────────────────────────┐
  │  The reward model is typically:                   │
  │  - Same architecture as the base model            │
  │  - With the language modeling head replaced by    │
  │    a scalar output head                           │
  │  - Trained on ~100K-500K preference pairs         │
  │  - Loss: -log(sigmoid(score_A - score_B))         │
  │    (Bradley-Terry model)                          │
  └──────────────────────────────────────────────────┘
```

```python
# Reward model loss (simplified)
import torch
import torch.nn.functional as F

def reward_model_loss(score_chosen, score_rejected):
    """
    Bradley-Terry preference loss.
    Trains the model so chosen responses score higher
    than rejected responses.
    """
    return -F.logsigmoid(score_chosen - score_rejected).mean()
```

---

## Stage 3: RLHF (Reinforcement Learning from Human Feedback)

RLHF uses the reward model to optimize the language model's outputs.
The model generates responses, the reward model scores them, and the
model is updated to produce higher-scoring responses.

```
RLHF Training Loop:

  ┌──────────────┐     ┌──────────────┐
  │  Prompt       │────>│  LM (policy) │──── Generate ────┐
  │  "Explain..." │     │              │                   │
  └──────────────┘     └──────────────┘                   │
                                                           v
                       ┌──────────────┐            ┌──────────────┐
                       │  Reward      │<───────────│  Response     │
                       │  Model       │            │  "Plants use  │
                       └──────┬───────┘            │   sunlight..." │
                              │                    └──────────────┘
                              v
                       ┌──────────────┐
                       │  Score: 0.85 │
                       └──────┬───────┘
                              │
                              v
                       ┌──────────────┐
                       │  PPO Update  │  Update LM to increase
                       │              │  probability of high-
                       │              │  scoring responses
                       └──────────────┘

  Key constraint: KL divergence penalty
  ┌──────────────────────────────────────────────────┐
  │  The model must not drift too far from the SFT   │
  │  model. A KL penalty keeps it close:             │
  │                                                  │
  │  Reward_total = Reward_model - β × KL(π || π_ref)│
  │                                                  │
  │  Without this, the model "hacks" the reward      │
  │  model by generating degenerate text that scores │
  │  high but is nonsensical.                        │
  └──────────────────────────────────────────────────┘
```

---

## Stage 3 (Alternative): DPO (Direct Preference Optimization)

DPO is a simpler alternative to RLHF that skips the reward model
entirely. It directly optimizes the language model on preference data.

```
DPO vs RLHF:

  RLHF Pipeline:
  Preferences → Reward Model → RL (PPO) → Updated LM
  (3 models in memory: LM, reward model, reference LM)

  DPO Pipeline:
  Preferences → Direct optimization → Updated LM
  (2 models in memory: LM, reference LM)

  ┌──────────────────────────────────────────────────┐
  │  DPO Loss:                                       │
  │                                                  │
  │  L = -log σ(β × (log π(y_w|x)/π_ref(y_w|x)     │
  │              - log π(y_l|x)/π_ref(y_l|x)))      │
  │                                                  │
  │  Where:                                          │
  │    y_w = preferred (winning) response            │
  │    y_l = rejected (losing) response              │
  │    π = current model                             │
  │    π_ref = reference model (frozen SFT model)    │
  │    β = temperature parameter                     │
  │                                                  │
  │  Intuition: Increase probability of preferred    │
  │  responses, decrease probability of rejected     │
  │  ones, relative to the reference model.          │
  └──────────────────────────────────────────────────┘
```

**DPO advantages:** Simpler, more stable, no reward model needed, less compute.
**DPO disadvantages:** Less flexible, cannot iterate on reward signal, may underperform RLHF on complex tasks.

In practice, many teams now use DPO or variants (IPO, KTO, ORPO) instead
of full RLHF.

Cross-reference: [Advanced LLM Engineering, Lesson 11: Training and Alignment](../advanced-llm-engineering/11-training-alignment.md)
for implementation details.

---

## Stage 4: Safety Training

Safety training ensures the model refuses harmful requests, avoids
generating toxic content, and behaves responsibly.

```
Safety Training Components:

  ┌──────────────────────────────────────────────────┐
  │  1. Red Teaming                                  │
  │     Human testers try to make the model produce  │
  │     harmful outputs. Successful attacks become   │
  │     training data for safety fine-tuning.        │
  │                                                  │
  │  2. Safety SFT                                   │
  │     Train on examples of refusing harmful        │
  │     requests while remaining helpful for         │
  │     legitimate ones.                             │
  │                                                  │
  │  3. Safety RLHF/DPO                              │
  │     Preference data where safe responses are     │
  │     preferred over unsafe ones.                  │
  │                                                  │
  │  4. Constitutional AI (Anthropic)                │
  │     The model critiques its own outputs against  │
  │     a set of principles, then revises them.      │
  │     Self-improvement loop.                       │
  └──────────────────────────────────────────────────┘

  The Helpfulness-Safety Trade-off:

  Helpful ←──────────────────────────→ Safe
  │                                        │
  │  "Here's how to pick a lock"           │  "I can't help with that"
  │  (too helpful, unsafe)                 │  (too safe, unhelpful)
  │                                        │
  │           ┌──────────┐                 │
  │           │  GOAL:   │                 │
  │           │  Helpful │                 │
  │           │  AND     │                 │
  │           │  Safe    │                 │
  │           └──────────┘                 │
```

---

## Stage 5: Evaluation

After post-training, the model is evaluated on multiple dimensions:

```
Post-Training Evaluation:

  ┌──────────────────────────────────────────────────┐
  │  Dimension        │  Method                       │
  ├───────────────────┼───────────────────────────────┤
  │  Helpfulness      │  Human ratings, MT-Bench,     │
  │                   │  AlpacaEval                   │
  │  Safety           │  Red team success rate,       │
  │                   │  toxicity benchmarks          │
  │  Factuality       │  TruthfulQA, fact-checking    │
  │  Reasoning        │  GSM8K, MATH, ARC             │
  │  Coding           │  HumanEval, MBPP              │
  │  Knowledge        │  MMLU, TriviaQA               │
  │  Instruction      │  IFEval, instruction-         │
  │  following        │  following benchmarks         │
  └───────────────────┴───────────────────────────────┘
```

See [Lesson 07: Model Evaluation at Scale](./07-evaluation-at-scale.md)
for a deep dive into evaluation methods.

Cross-reference: [Advanced LLM Engineering, Lesson 13: Evaluating LLMs](../advanced-llm-engineering/13-evaluation-llms.md)
for evaluation implementation.

---

## The Complete Post-Training Timeline

```
Post-Training Timeline (7B model):

  Week 1: SFT
  ├── Curate/collect SFT dataset (~50K examples)
  ├── Train SFT model (hours on 8-16 GPUs)
  ├── Evaluate SFT model
  └── Iterate on data quality

  Week 2: Preference Data Collection
  ├── Generate responses from SFT model
  ├── Human annotators rank response pairs
  ├── Quality control on annotations
  └── ~100K preference pairs

  Week 3: Alignment (RLHF or DPO)
  ├── Train reward model (if RLHF)
  ├── Run RLHF/DPO training (hours to days)
  ├── Evaluate aligned model
  └── Iterate on hyperparameters

  Week 4: Safety
  ├── Red teaming sessions
  ├── Safety fine-tuning
  ├── Safety evaluation
  └── Final model selection

  Total: ~4 weeks, ~1-5% of pre-training compute
```

---

## Connection to ML

Post-training builds on several concepts from earlier tracks:

- **Fine-tuning** fundamentals. See [Advanced LLM Engineering, Lesson 12](../advanced-llm-engineering/12-efficient-finetuning.md).
- **Alignment techniques** (RLHF, DPO). See [Advanced LLM Engineering, Lesson 11](../advanced-llm-engineering/11-training-alignment.md).
- **Evaluation methods**. See [Advanced LLM Engineering, Lesson 13](../advanced-llm-engineering/13-evaluation-llms.md).

---

## Exercises

### Exercise 1: SFT Data Design

Design 5 high-quality SFT examples for a coding assistant. Each example
should include a system prompt, user instruction, and assistant response.
Consider:
- What makes a response "high quality"?
- How detailed should responses be?
- Should the assistant explain its reasoning?

### Exercise 2: Preference Ranking

Given this prompt and three responses, rank them from best to worst
and explain your reasoning:

**Prompt:** "How do I sort a list in Python?"

**Response A:** "Use `sorted(my_list)` for a new sorted list, or
`my_list.sort()` to sort in place."

**Response B:** "There are many ways to sort in Python. The built-in
`sorted()` function returns a new sorted list. The `.sort()` method
sorts in place. For custom sorting, pass a `key` function:
`sorted(items, key=lambda x: x.name)`. For reverse order, use
`reverse=True`."

**Response C:** "Sorting is a fundamental computer science concept
dating back to the 1950s. The most common algorithms include bubble
sort, merge sort, and quicksort. In Python, the Timsort algorithm
is used, which was invented by Tim Peters in 2002..."

### Exercise 3: DPO Loss Calculation

```python
import torch
import torch.nn.functional as F

# Given log probabilities from the current model and reference model:
# For a preferred response y_w and rejected response y_l

log_prob_chosen_current = torch.tensor(-2.5)    # log π(y_w|x)
log_prob_rejected_current = torch.tensor(-3.0)  # log π(y_l|x)
log_prob_chosen_ref = torch.tensor(-2.8)        # log π_ref(y_w|x)
log_prob_rejected_ref = torch.tensor(-3.2)      # log π_ref(y_l|x)
beta = 0.1

# TODO: Calculate the DPO loss
# TODO: What does a negative loss value mean?
# TODO: How does increasing beta affect training?
```

---

Next: [Lesson 06: Cost and Resource Estimation](./06-cost-estimation.md)
