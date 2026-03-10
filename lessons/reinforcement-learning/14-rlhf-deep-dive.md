# Lesson 14: RLHF Deep Dive

> How language models learn to be helpful, harmless, and honest.
> The bridge between raw text generation and useful AI assistants.

---

## The Three-Stage Pipeline

```
  STAGE 1: PRETRAINING
  Train on internet text. Learn language patterns.
  Result: base model that completes text (not answers questions).

  STAGE 2: SUPERVISED FINE-TUNING (SFT)
  Train on (prompt, ideal_response) pairs written by humans.
  Result: model that follows instructions, but imperfectly.

  STAGE 3: RLHF
  Use human preferences to further refine the model.
  Result: model that gives responses humans actually prefer.

  BASE MODEL --> SFT MODEL --> RLHF MODEL
  "The cat"     "The capital   "The capital of
  -> "sat on"    of France is   France is Paris.
                  Paris"         It's known for
                                the Eiffel Tower
                                and rich cultural
                                heritage."
```

---

## Stage 2: Supervised Fine-Tuning (SFT)

```
  TRAINING DATA:
  Human experts write ideal responses to prompts.

  Prompt: "Explain quantum entanglement simply."
  Response: "Imagine two coins that are magically linked.
  When you flip one and get heads, the other instantly
  becomes tails, no matter how far apart they are..."

  LOSS: standard cross-entropy on the response tokens.
  L = -SUM log P(token_t | prompt, token_1..t-1)

  SCALE: typically 10K-100K high-quality examples.
  Much less data than pretraining (trillions of tokens).

  RESULT: model can follow instructions but:
  - Sometimes verbose or unhelpful
  - Can produce harmful content
  - Quality varies significantly
  - No way to express "I prefer response A over B"
```

---

## Stage 3a: Reward Model Training

```
  HUMAN COMPARISON DATA:
  For each prompt, generate TWO (or more) responses.
  Human ranks them: which is better?

  Prompt: "How do I make pasta?"
  Response A: "Boil water, add salt, cook pasta 8-10 min..."
  Response B: "Pasta is a type of food made from flour..."

  Human says: A > B (A is better)

  REWARD MODEL:
  r(prompt, response) -> scalar score

  TRAINING:
  Bradley-Terry model (pairwise preference):

  P(A > B) = sigmoid(r(A) - r(B))

  Loss = -log(sigmoid(r(winner) - r(loser)))

  For each comparison pair:
  Push r(winner) up, push r(loser) down.

  +----------+     +-----------+
  | Prompt + |     |           |
  | Response | --> | Reward    | --> score (scalar)
  |          |     | Model     |
  +----------+     +-----------+

  Architecture: typically same as the LLM
  but with a scalar output head instead of vocab head.
```

```python
import torch
import torch.nn as nn

class RewardModel(nn.Module):
    def __init__(self, base_model):
        super().__init__()
        self.base = base_model
        self.reward_head = nn.Linear(base_model.hidden_size, 1)

    def forward(self, input_ids, attention_mask):
        outputs = self.base(input_ids, attention_mask=attention_mask)
        last_hidden = outputs.last_hidden_state[:, -1, :]
        reward = self.reward_head(last_hidden)
        return reward.squeeze(-1)

def reward_model_loss(reward_model, chosen_ids, chosen_mask, rejected_ids, rejected_mask):
    r_chosen = reward_model(chosen_ids, chosen_mask)
    r_rejected = reward_model(rejected_ids, rejected_mask)
    loss = -torch.log(torch.sigmoid(r_chosen - r_rejected)).mean()
    return loss
```

---

## Stage 3b: PPO Optimization

```
  NOW USE PPO TO OPTIMIZE THE LANGUAGE MODEL
  AGAINST THE REWARD MODEL:

  FOR each batch of prompts:
    1. Generate responses using current policy pi
    2. Score responses using reward model: r(prompt, response)
    3. Compute KL penalty: KL(pi || pi_ref)
    4. Total reward: R = r(prompt, response) - beta * KL
    5. Compute advantages using GAE
    6. PPO clipped update on the policy

  THE RL FORMULATION:
  +----------+------------------------------------------+
  | State    | Prompt + tokens generated so far         |
  | Action   | Next token to generate                   |
  | Reward   | 0 for all tokens except last             |
  |          | Last token: reward_model(full_response)   |
  |          | - beta * KL_penalty                       |
  | Episode  | One complete prompt -> response           |
  +----------+------------------------------------------+

  PROMPT                    GENERATED RESPONSE
  "How to cook rice?"  ->  "First wash the rice..." [REWARD: 0.8]
                           - beta * KL(new_dist || ref_dist)
```

---

## The KL Penalty: Why It's Critical

```
  WITHOUT KL PENALTY:
  Agent finds "reward hacks" — outputs that score
  high on reward model but are actually nonsensical.

  Example reward hack:
  Prompt: "What is 2+2?"
  Response: "That's a great question! I'm so glad you asked!
  The answer is absolutely, definitely, certainly 4!
  You're so smart for asking! Here are 10 more facts..."

  Excessively enthusiastic and verbose because the reward
  model gives high scores to confident, detailed responses.

  WITH KL PENALTY:
  R = r(response) - beta * KL(pi_new || pi_sft)

  KL penalty says: "don't drift too far from the SFT model."
  If the policy starts generating weird responses that the
  SFT model would never produce -> high KL -> low total reward.

  ADAPTIVE KL:
  If KL too high: increase beta (more conservative)
  If KL too low: decrease beta (allow more learning)
  Target: KL ≈ 6-10 nats
```

---

## RLHF Training Loop (Pseudocode)

```python
class RLHFTrainer:
    def __init__(self, policy_model, ref_model, reward_model, kl_beta=0.1):
        self.policy = policy_model
        self.ref = ref_model
        self.reward_fn = reward_model
        self.beta = kl_beta
        self.target_kl = 6.0

    def compute_rewards(self, prompts, responses):
        rm_scores = self.reward_fn.score(prompts, responses)

        policy_logprobs = self.policy.log_probs(prompts, responses)
        ref_logprobs = self.ref.log_probs(prompts, responses)
        kl_div = (policy_logprobs - ref_logprobs).sum(dim=-1)

        rewards = rm_scores - self.beta * kl_div
        return rewards, rm_scores, kl_div

    def update_kl_beta(self, mean_kl):
        if mean_kl > 1.5 * self.target_kl:
            self.beta *= 1.5
        elif mean_kl < 0.5 * self.target_kl:
            self.beta /= 1.5

    def train_step(self, prompts):
        responses = self.policy.generate(prompts)

        rewards, rm_scores, kl_div = self.compute_rewards(prompts, responses)

        advantages = self.compute_gae(rewards)

        ppo_loss = self.ppo_update(prompts, responses, advantages)

        self.update_kl_beta(kl_div.mean().item())

        return {
            "reward": rm_scores.mean().item(),
            "kl": kl_div.mean().item(),
            "loss": ppo_loss,
        }
```

---

## DPO: Direct Preference Optimization

```
  PROBLEM WITH RLHF: complex pipeline.
  Need to train reward model + run PPO + tune KL penalty.

  DPO: skip the reward model entirely!
  Directly optimize the policy from preference data.

  DPO LOSS:
  L = -log sigmoid(beta * (log pi(y_w|x)/pi_ref(y_w|x)
                          - log pi(y_l|x)/pi_ref(y_l|x)))

  y_w = preferred response
  y_l = dispreferred response
  pi_ref = reference (SFT) model
  beta = temperature parameter

  INTUITION:
  Increase probability of preferred response.
  Decrease probability of dispreferred response.
  Relative to the reference model.

  RLHF:                              DPO:
  1. Collect preferences              1. Collect preferences
  2. Train reward model               2. Optimize policy directly
  3. Run PPO against RM                  (one supervised step!)
  4. Tune KL penalty

  DPO IS SIMPLER but may be less effective for
  very large-scale training. Both are used in practice.
```

---

## Challenges in RLHF

```
  1. REWARD MODEL QUALITY
  The RM is only as good as the human labels.
  Inconsistent labelers -> noisy reward signal.
  Solution: multiple labelers, calibration, inter-annotator agreement.

  2. REWARD OVEROPTIMIZATION
  As training progresses, the policy exploits weaknesses
  in the reward model. RM score goes up, but actual
  quality plateaus or drops.

  RM score: +++++ -> ++++++++ -> ++++++++++++
  Real quality: +++++ -> ++++++ -> +++++
  The policy found RM blind spots!

  3. MODE COLLAPSE
  Policy converges to a narrow set of "safe" responses.
  Everything sounds the same. Diversity drops.
  Solution: entropy bonus, diverse prompts, higher temperature.

  4. ALIGNMENT TAX
  RLHF can reduce capabilities while improving alignment.
  The model becomes safer but less knowledgeable.
  Solution: balance alignment with capability benchmarks.
```

---

## RLHF in Practice

```
  +-------------------+------------------------------------------+
  | System            | RLHF Approach                            |
  +-------------------+------------------------------------------+
  | ChatGPT (OpenAI)  | SFT + RM + PPO (original RLHF pipeline) |
  | Claude (Anthropic)| RLHF + Constitutional AI (RLAIF)        |
  | Gemini (Google)    | RLHF with diverse human feedback        |
  | Llama 2 (Meta)    | SFT + RM + PPO (2 reward models)        |
  | Zephyr             | DPO (direct preference optimization)     |
  +-------------------+------------------------------------------+

  CONSTITUTIONAL AI (RLAIF):
  Instead of human labelers, use an AI to provide feedback
  based on a "constitution" (set of principles).

  1. Generate responses
  2. AI evaluates: "Does this follow the principle:
     'Be helpful and harmless'?"
  3. Use AI evaluations as preference data
  4. Train with RLHF/DPO

  Scales better than human labeling!
```

---

## Exercises

### Exercise 1: Train a Reward Model

Create a simple reward model for text quality:
1. Generate pairs of responses (one good, one bad)
2. Train a model to predict which is better
3. Evaluate on held-out comparisons
4. Measure accuracy and calibration

### Exercise 2: KL Penalty Experiment

Using a simple bandit setting (no language model needed):
1. Reference policy: uniform over 10 actions
2. Reward model: action 3 gives reward 10, others give 1
3. Train with PPO + KL penalty (beta = 0, 0.1, 1.0, 10.0)
4. Plot: final policy vs reference policy for each beta

### Exercise 3: DPO vs PPO

On a simple preference learning task:
1. Generate preference pairs from a known reward function
2. Train with PPO (reward model + RL)
3. Train with DPO (direct preference optimization)
4. Compare: sample efficiency, final performance, training time

### Exercise 4: Reward Overoptimization

Demonstrate reward overoptimization:
1. Train a reward model on 1000 preferences
2. Use PPO to optimize against it for many steps
3. Plot RM score over training (should keep going up)
4. Plot actual quality (use the TRUE reward, not RM)
5. Show the divergence between RM score and true quality

---

## Key Takeaways

```
  1. RLHF pipeline: pretraining -> SFT -> reward model -> PPO
  2. Reward model: trained on human pairwise preferences
  3. Bradley-Terry model: P(A>B) = sigmoid(r(A) - r(B))
  4. PPO optimizes policy against reward model
  5. KL penalty prevents reward hacking (stay near SFT model)
  6. Adaptive KL: increase beta when KL too high
  7. DPO: skip reward model, optimize directly from preferences
  8. Reward overoptimization: RM score up, real quality down
  9. Constitutional AI: AI provides feedback instead of humans
  10. RLHF is how raw language models become useful assistants
```

---

Next: [Lesson 15 — Real-World RL](./15-real-world-rl.md)
