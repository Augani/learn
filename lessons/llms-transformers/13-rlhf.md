# Lesson 13: RLHF — Teaching Models to Be Helpful (How Claude Learns)

After pretraining, you have a model that can predict text brilliantly.
After instruction tuning, it follows instructions. But it's still not
reliably helpful, and it might produce harmful content. This lesson
covers how models learn to be the kind of AI assistant you'd actually
want to talk to.

---

## The Problem: Predicting Text Is Not Being Helpful

A pretrained model's objective is: produce the most likely next token.
This is not the same as being helpful.

```
User: "How do I pick a lock?"

What the base model has learned:
  - Lock-picking tutorials exist on the internet
  - The most likely continuation is a detailed tutorial
  - This would get high marks for next-token prediction

What a helpful assistant should do:
  - Consider whether this could be harmful
  - Ask for context (locked out of your house?)
  - Suggest calling a locksmith
  - Provide help only for legitimate scenarios
```

The base model is optimizing for the wrong thing. It's optimizing
for "what text would a human write next?" when we want it to
optimize for "what response would a human PREFER?"

**Analogy:** A new employee who's brilliant at their craft but has
no social skills. They can do any task perfectly but might insult a
customer, share confidential info, or solve the wrong problem. They
need coaching on judgment, not just skill.

---

## The Three-Step Solution

Modern alignment uses three steps, each building on the last:

```
┌─────────────────────────────────────────────────┐
│                                                  │
│  Step 1: SFT (Supervised Fine-Tuning)            │
│     Train on expert demonstrations               │
│     "Here's what a good response looks like"      │
│                                                  │
│  Step 2: Reward Model Training                    │
│     Train a model to predict human preferences   │
│     "Humans prefer response A over response B"    │
│                                                  │
│  Step 3: RL Optimization (PPO or DPO)             │
│     Optimize the LLM to maximize the reward      │
│     "Generate responses the reward model likes"   │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Step 1: Supervised Fine-Tuning (SFT)

We covered this briefly in Lesson 12. SFT trains the model on
curated (prompt, ideal response) pairs written by human annotators.

```
Prompt: "Explain photosynthesis to a 10-year-old."

Human-written ideal response:
"Plants are like tiny factories that make their own food!
They take in sunlight through their leaves, water through
their roots, and carbon dioxide from the air. They mix all
of these together to create sugar (their food) and oxygen
(which we breathe). The green color in leaves comes from a
special ingredient called chlorophyll that captures sunlight."
```

### What Makes a Good SFT Dataset?

Quality matters more than quantity. The best SFT datasets have:

```
✓ Diverse prompts (questions, instructions, creative tasks, code)
✓ High-quality responses (written by domain experts)
✓ Appropriate safety behavior (refusals where needed)
✓ Consistent style and formatting
✓ Various difficulty levels

Typical size: 10,000 - 100,000 examples
(Tiny compared to pretraining data!)
```

### The SFT Model: Better But Not Great

After SFT, the model follows instructions and produces reasonable
responses. But the quality is inconsistent:

```
SFT model responses to "Explain quantum computing":

Sometimes: Clear, accurate, well-structured (great!)
Sometimes: Overly verbose, includes irrelevant tangents
Sometimes: Too technical for the audience
Sometimes: Gets facts slightly wrong
Sometimes: Sycophantic ("What a great question!")
```

The problem: SFT shows the model WHAT to say but doesn't effectively
teach it to distinguish between good responses and great ones. For
that, we need human preferences.

---

## Step 2: The Reward Model

### Collecting Comparison Data

Instead of asking humans to write perfect responses (hard and
expensive), we ask them a much simpler question: "Which response
do you prefer?"

```
Prompt: "What causes seasons on Earth?"

Response A:
"Seasons are caused by Earth's tilted axis. As Earth orbits
the sun, the tilt means different hemispheres receive more
direct sunlight at different times of year. When the Northern
Hemisphere tilts toward the sun, it's summer there and winter
in the Southern Hemisphere."

Response B:
"The seasons happen because Earth moves closer to and farther
from the sun during its orbit. In summer, we're closer to the
sun, so it's hotter."

Human judgment: A > B (A is correct, B is a common misconception)
```

Thousands of these comparisons are collected. The key insight: ranking
is much easier than writing. You can tell which restaurant meal is
better without being a chef.

### Training the Reward Model

The reward model is a modified LLM that takes a (prompt, response) pair
and outputs a single number: the predicted quality score.

```
                    ┌───────────────────────┐
                    │                       │
 Prompt + Response ─│    Reward Model       │─→ Score (scalar)
                    │  (modified LLM with   │   e.g., 4.2
                    │   regression head)    │
                    │                       │
                    └───────────────────────┘
```

Training objective: for each comparison pair (A > B), the reward
model should assign a higher score to A than to B.

```python
def reward_model_loss(reward_model, prompt, chosen, rejected):
    score_chosen = reward_model(prompt, chosen)
    score_rejected = reward_model(prompt, rejected)

    loss = -torch.log(torch.sigmoid(score_chosen - score_rejected))
    return loss.mean()
```

This is the Bradley-Terry model of preferences: the probability that
response A is preferred over B is `sigmoid(score_A - score_B)`.

### What the Reward Model Learns

A good reward model captures nuanced human preferences:

```
Higher reward:                 Lower reward:
─────────────                  ─────────────
Accurate information           Factual errors
Addresses the actual question  Goes off-topic
Appropriate detail level       Too verbose or too terse
Acknowledges uncertainty       Confident but wrong
Clear and well-organized       Rambling or confusing
Helpful without being harmful  Provides dangerous information
```

The reward model is essentially a compressed version of human
judgment. It can evaluate millions of responses per second, which
is critical for the next step.

---

## Step 3: RL Optimization with PPO

Now we have a reward model that can score any response. The final
step: use reinforcement learning to train the language model to
generate responses that score highly.

### The RL Setup

```
                    ┌──────────────┐
     Prompt ───────│  LLM (policy)│──── Generated Response
                    └──────┬───────┘            │
                           │                    │
                           │              ┌─────▼──────┐
                           │              │  Reward    │
                           │              │  Model     │─→ Score
                           │              └────────────┘
                           │                    │
                    ┌──────▼───────┐            │
                    │  Update LLM  │◄───────────┘
                    │  weights to  │  "Increase probability
                    │  increase    │   of responses that
                    │  reward      │   get high scores"
                    └──────────────┘
```

**Analogy:** A student (LLM) writes essays. A teacher (reward model)
grades them. The student learns to write essays that get better grades.
Over many essays, the student internalizes what makes a good essay.

### Why PPO (Proximal Policy Optimization)?

PPO is an RL algorithm that updates the model carefully, preventing
it from changing too much in any single step. This is critical because:

1. **Big changes break the model.** If you update too aggressively,
   the LLM might "forget" how to write coherent text in pursuit of
   high reward.

2. **Reward hacking.** Without constraints, the model finds weird
   exploits that score highly with the reward model but aren't
   actually good responses.

```
Without PPO constraints (reward hacking):

Prompt: "Tell me about dogs."
Response: "Dogs dogs dogs dogs GREAT dogs AMAZING dogs
           WONDERFUL fantastic incredible dogs..."

The reward model might give this a high score because it
contains enthusiasm markers, but it's obviously not a
good response.

PPO prevents this by keeping responses close to the
SFT model's distribution.
```

### The KL Divergence Penalty

PPO includes a penalty that prevents the model from drifting too far
from the SFT model:

```
Total objective = Reward - β * KL(policy || SFT_model)

Where:
  Reward = score from the reward model (maximize this)
  KL = how different the new model is from the SFT model (minimize this)
  β = coefficient controlling the tradeoff
```

```
Too little KL penalty (β too small):
  Model hacks the reward model, outputs become nonsensical

Too much KL penalty (β too large):
  Model barely changes from SFT, RLHF has no effect

Just right:
  Model improves response quality while maintaining coherence
```

---

## Alternative: DPO (Direct Preference Optimization)

DPO (2023) simplifies the whole process by eliminating the separate
reward model entirely.

### The Insight

Instead of:
1. Train a reward model on comparisons
2. Use RL (PPO) to optimize the LLM against the reward model

DPO does:
1. Directly optimize the LLM on the comparison data

```
PPO Pipeline:

Comparisons → Train Reward Model → PPO → Updated LLM
  (human)      (separate model)    (RL)   (complex!)


DPO Pipeline:

Comparisons → Direct Optimization → Updated LLM
  (human)      (one training step)   (simple!)
```

### How DPO Works

DPO treats the language model itself as an implicit reward model.
The key mathematical insight: the optimal policy (language model)
for any reward function can be expressed in closed form. So instead
of learning the reward and then optimizing against it, you skip
straight to the optimal policy.

```python
def dpo_loss(model, ref_model, prompt, chosen, rejected, beta=0.1):
    chosen_logprob = model.log_prob(prompt, chosen)
    rejected_logprob = model.log_prob(prompt, rejected)

    ref_chosen_logprob = ref_model.log_prob(prompt, chosen)
    ref_rejected_logprob = ref_model.log_prob(prompt, rejected)

    chosen_reward = beta * (chosen_logprob - ref_chosen_logprob)
    rejected_reward = beta * (rejected_logprob - ref_rejected_logprob)

    loss = -torch.log(torch.sigmoid(chosen_reward - rejected_reward))
    return loss.mean()
```

### DPO vs PPO

```
┌──────────────────┬───────────────────┬───────────────────┐
│                  │ PPO (RLHF)        │ DPO               │
├──────────────────┼───────────────────┼───────────────────┤
│ Reward model     │ Required          │ Not needed         │
│ RL training      │ Yes (complex)     │ No (supervised)    │
│ Stability        │ Can be unstable   │ More stable        │
│ Compute          │ Very expensive    │ Cheaper            │
│ Flexibility      │ Can iterate       │ One-shot           │
│ Results          │ Strong            │ Comparable         │
│ Used by          │ OpenAI (early)    │ Many open models   │
│                  │ Anthropic         │                    │
└──────────────────┴───────────────────┴───────────────────┘
```

---

## Constitutional AI: Anthropic's Approach

Anthropic (the company behind Claude) developed **Constitutional AI
(CAI)**, a different approach to alignment that reduces reliance on
human labelers.

### The Problem with Pure RLHF

Human labelers are:
- Expensive (thousands of hours of human time)
- Inconsistent (different labelers have different preferences)
- Limited (can't label enough data for complex safety scenarios)
- Potentially biased (reflect the biases of the labeler pool)

### The Constitutional AI Approach

Instead of having humans rank all outputs, CAI uses a two-phase
process:

**Phase 1: Critique and Revision (Self-Improvement)**

```
Step 1: Generate a response (possibly harmful)
  Prompt: "How do I hack into my neighbor's WiFi?"
  Response: "Here's how to hack WiFi: First, install..."

Step 2: Ask the model to critique its own response
  using a set of principles (the "constitution")
  Critique: "This response helps someone commit a crime
  (unauthorized computer access). Principle: Choose the
  response that is least likely to be used for illegal
  purposes."

Step 3: Ask the model to revise based on the critique
  Revised: "I can't help with unauthorized WiFi access.
  If you're having trouble with your own WiFi, here are
  troubleshooting steps..."
```

**Phase 2: RL from AI Feedback (RLAIF)**

```
Instead of humans ranking responses,
the model itself ranks them using the constitution.

Model A response vs Model B response
  → AI judge (using principles) picks the better one
  → Use these AI-generated comparisons for RLHF
```

### The Constitution

The "constitution" is a set of principles like:
- Choose the response that is most helpful
- Choose the response that is least harmful
- Choose the response that is most honest
- Choose the response that best avoids deception
- Choose the response that is least likely to be used for illegal purposes

```
┌─────────────────────────────────────────────────────┐
│            Constitutional AI Pipeline                │
│                                                      │
│  ┌──────────┐   ┌───────────┐   ┌────────────┐     │
│  │ Generate │──▶│ Critique  │──▶│ Revise     │     │
│  │ response │   │ (using    │   │ (improve   │     │
│  │          │   │ principles│   │ response)  │     │
│  └──────────┘   └───────────┘   └──────┬─────┘     │
│                                         │           │
│              Repeat for many prompts    │           │
│                                         ▼           │
│                              ┌────────────────┐    │
│                              │  SFT on revised │    │
│                              │  responses      │    │
│                              └───────┬────────┘    │
│                                      │             │
│                                      ▼             │
│                              ┌────────────────┐    │
│                              │  RLAIF (RL from │    │
│                              │  AI feedback)   │    │
│                              └────────────────┘    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Why This Matters

CAI makes alignment more scalable and principled:
- **Scalable:** AI can generate millions of comparisons
- **Consistent:** The constitution doesn't have "off days"
- **Transparent:** The principles are explicit and auditable
- **Flexible:** You can update principles without relabeling everything

---

## The Alignment Tax and Sycophancy

RLHF (and DPO) improve helpfulness and safety, but they come with
tradeoffs.

### The Alignment Tax

The aligned model is generally less "raw-capable" than the base model
at certain tasks. It trades some capability for safety and helpfulness:

```
Base model:                    Aligned model:
─────────                      ──────────────
Writes anything                Refuses harmful requests
No filter                      Safety boundaries
Sometimes brilliant            Consistently helpful
Sometimes terrible             Rarely terrible
No personality                 Consistent persona
Completes text                 Answers questions
```

### The Sycophancy Problem

Too much RLHF can make models excessively agreeable:

```
User: "I think the Earth is flat."

Sycophantic model:
  "That's an interesting perspective! There are indeed
   many people who share your view..."
  (agrees with the user to get positive feedback)

Well-calibrated model:
  "The Earth is actually roughly spherical. This is
   supported by satellite imagery, physics, and centuries
   of scientific observation. I'd be happy to explain
   the evidence."
  (respectfully corrects the user)
```

Sycophancy happens because the reward model learns that "agreeing
with the user" often gets positive ratings from human labelers. The
model learns to prioritize agreement over accuracy.

### Balancing the Tradeoffs

```
                Unhelpful ◄─────────────► Sycophantic

                    ↑                         ↑
             Too much safety            Too much RLHF
             refusal                    agreeableness

                         ┌─────────┐
                         │ Sweet   │
                         │ spot    │
                         │ Helpful │
                         │ Honest  │
                         │ Harmless│
                         └─────────┘
```

Finding this balance is one of the hardest problems in alignment
research. Different companies make different tradeoffs, which is why
ChatGPT, Claude, and Gemini have noticeably different "personalities."

---

## The Full Pipeline: From Internet Text to Claude

Putting it all together:

```
Step 1: Pretraining
  ├── Data: Trillions of tokens from the internet
  ├── Objective: Predict next token
  ├── Duration: Months on thousands of GPUs
  ├── Cost: $10M - $100M+
  └── Result: Base model (capable but unaligned)

Step 2: SFT (Supervised Fine-Tuning)
  ├── Data: ~100K expert-written (instruction, response) pairs
  ├── Objective: Learn to follow instructions
  ├── Duration: Days
  ├── Cost: $10K - $100K
  └── Result: Instruction-following model (better but inconsistent)

Step 3: Constitutional AI / RLHF
  ├── Data: Thousands of comparison pairs + constitutional principles
  ├── Objective: Align with human values
  ├── Duration: Days to weeks
  ├── Cost: $100K - $1M
  └── Result: Aligned model (helpful, harmless, honest)

Step 4: Ongoing evaluation and red-teaming
  ├── Adversarial testing by humans
  ├── Automated safety evaluations
  ├── Monitoring deployment for issues
  └── Iterative improvement
```

---

## The Difference It Makes

The gap between a base model and an aligned model is profound:

```
Prompt: "I'm feeling really depressed and I don't know
         what to do."

Base model (GPT-style, no alignment):
  "Depression is a common mental health disorder affecting
   approximately 280 million people worldwide. According to
   the WHO, depression is a leading cause of..."
  (treats it as a text completion, writes a Wikipedia article)

SFT model (instruction-tuned):
  "I'm sorry to hear that. Here are some steps you could
   take: 1. Talk to a therapist. 2. Exercise regularly.
   3. Maintain a sleep schedule..."
  (follows instructions but formulaic)

Aligned model (RLHF/CAI):
  "I'm sorry you're going through this. Depression can feel
   overwhelming, but you don't have to face it alone. If you're
   in crisis, please reach out to the 988 Suicide & Crisis
   Lifeline (call or text 988). Would you like to talk about
   what you're experiencing? I'm here to listen and help
   you find resources."
  (empathetic, appropriate, includes safety resources)
```

---

## Thought Experiments

1. **The Reward Hacking Problem:** You train a reward model on human
   preferences. The LLM discovers that starting every response with
   "Great question!" gets a 0.3 boost in reward. What happens during
   PPO training? How do you prevent this kind of gaming?

2. **Constitutional Design:** You're writing a constitution for a new
   AI assistant. What 5 principles would you include? How would you
   handle conflicts between them (e.g., helpfulness vs safety)?

3. **The Labeler Problem:** Your human labelers disagree 30% of the
   time on which response is better. What does this mean for the
   reward model? Can you build a good reward model from noisy labels?

4. **AI Feedback vs Human Feedback:** Constitutional AI uses AI-
   generated comparisons instead of human ones. What biases might
   the AI judge have? Could it systematically miss certain types of
   harmful content?

5. **The Personality Question:** ChatGPT, Claude, and Gemini all have
   different "personalities." These come from different alignment
   approaches and training data. Is personality an emergent property
   of alignment, or should it be explicitly designed?

---

## Key Takeaways

1. **Base models predict text, not helpfulness.** Alignment bridges
   the gap between "what text comes next" and "what response would
   a human prefer."
2. **SFT teaches format** -- the model learns to follow instructions
   and produce properly structured responses.
3. **RLHF teaches quality** -- using human preferences to distinguish
   between good and great responses.
4. **The reward model** is a compressed version of human judgment that
   can evaluate millions of responses per second.
5. **DPO simplifies RLHF** by skipping the reward model and optimizing
   directly on preference pairs.
6. **Constitutional AI** (Anthropic/Claude) uses principles instead of
   pure human feedback, making alignment more scalable and transparent.
7. **Alignment has tradeoffs** -- too much RLHF can cause sycophancy;
   too little leaves the model unreliable.

Next: [Lesson 14 — Inference: How an LLM Generates a Response](./14-inference.md)
