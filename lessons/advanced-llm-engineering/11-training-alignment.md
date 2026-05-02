# Lesson 11: Training Alignment — Teaching Models to Follow Instructions

A pre-trained LLM is like a brilliant student who has read the entire
internet. They know everything but have no social skills. Ask them a
question and they might continue the text like a Wikipedia article, or
auto-complete your sentence into something unrelated, or produce
something harmful. Alignment teaches the model to be helpful, follow
instructions, and refuse dangerous requests.

Think of alignment as the difference between a search engine and an
assistant. The search engine finds information. The assistant
understands what you need and presents it appropriately.

---

## The Alignment Pipeline

```
Pre-trained Model (knows language, no manners)
        │
        ▼
Supervised Fine-tuning (SFT)
  Learn instruction-following format
        │
        ▼
Reward Model Training
  Learn what "good" and "bad" responses look like
        │
        ▼
RLHF / DPO / Other
  Optimize the model to produce preferred responses
        │
        ▼
Aligned Model (helpful, harmless, honest)
```

Each step builds on the previous one. SFT gives the model the format.
RLHF/DPO teaches it to prefer better responses within that format.

---

## Step 1: Supervised Fine-Tuning (SFT)

Take the pre-trained model and fine-tune it on high-quality
instruction-response pairs.

```
Training data format:

<|system|>You are a helpful assistant.<|end|>
<|user|>What is the capital of France?<|end|>
<|assistant|>The capital of France is Paris.<|end|>
```

SFT data quality matters more than quantity. A few thousand
high-quality examples outperform millions of noisy ones.

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from trl import SFTTrainer

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3-8B",
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3-8B")

training_args = TrainingArguments(
    output_dir="./sft-output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-5,
    lr_scheduler_type="cosine",
    warmup_ratio=0.1,
    bf16=True,
    logging_steps=10,
    save_strategy="epoch",
)

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=sft_dataset,
    tokenizer=tokenizer,
    max_seq_length=2048,
)
trainer.train()
```

### SFT Data Sources

```
Source                  Size        Quality    Notes
──────────────────────────────────────────────────────────
OpenAssistant           ~100K       Medium     Community-generated
Dolly                   ~15K        Medium     Databricks employees
LIMA                    ~1,000      High       Carefully curated
UltraChat               ~1.5M       Medium     LLM-generated, filtered
ShareGPT (cleaned)      ~90K        Varies     Real user conversations
Custom (your domain)    ~1-10K      Highest    Domain experts write these
```

The LIMA paper showed that as few as 1,000 carefully chosen examples
can produce strong instruction-following. Quality dominates quantity.

---

## Step 2: Reward Model Training

A reward model learns to score responses. Given a prompt and two
responses, it predicts which one a human would prefer.

```
Input to reward model:

Prompt:    "Explain quantum computing simply"
Response A: "Quantum computing uses qubits that can be 0 and 1
            simultaneously, unlike classical bits..."
Response B: "Quantum computing is a paradigm leveraging quantum
            mechanical phenomena such as superposition and
            entanglement to perform computations on quantum bits..."

Human preference: A > B (simpler, as requested)

Reward model learns: score(A) > score(B)
```

### Architecture

The reward model is usually the same architecture as the LLM, but
with the language modeling head replaced by a scalar value head.

```python
import torch
import torch.nn as nn
from transformers import AutoModelForCausalLM

class RewardModel(nn.Module):
    def __init__(self, base_model_name):
        super().__init__()
        self.backbone = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            torch_dtype=torch.bfloat16,
        )
        self.backbone.lm_head = nn.Identity()  # remove LM head
        hidden_size = self.backbone.config.hidden_size
        self.value_head = nn.Linear(hidden_size, 1)

    def forward(self, input_ids, attention_mask=None):
        outputs = self.backbone(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_hidden_states=True,
        )
        last_hidden = outputs.hidden_states[-1]

        # use the last token's hidden state as the sequence representation
        if attention_mask is not None:
            last_token_idx = attention_mask.sum(dim=1) - 1
            last_hidden = last_hidden[
                torch.arange(last_hidden.size(0)), last_token_idx
            ]
        else:
            last_hidden = last_hidden[:, -1]

        reward = self.value_head(last_hidden).squeeze(-1)
        return reward
```

### Training the Reward Model

```python
def reward_model_loss(reward_model, chosen_ids, rejected_ids, chosen_mask, rejected_mask):
    chosen_reward = reward_model(chosen_ids, chosen_mask)
    rejected_reward = reward_model(rejected_ids, rejected_mask)

    # Bradley-Terry model: P(chosen > rejected) = sigmoid(r_chosen - r_rejected)
    loss = -torch.nn.functional.logsigmoid(chosen_reward - rejected_reward).mean()
    accuracy = (chosen_reward > rejected_reward).float().mean()

    return loss, accuracy
```

### Preference Data Collection

```
Methods for collecting preference data:

1. Human annotation:
   - Show annotators prompt + 2 responses
   - Ask which is better (and optionally why)
   - Expensive ($0.5-2 per comparison) but highest quality
   - Need 50K-500K comparisons

2. AI feedback (Constitutional AI approach):
   - Use a strong LLM to compare responses
   - Define principles ("Choose the more helpful response")
   - Cheaper and faster, but introduces model bias
   - Good for bootstrapping before human annotation

3. Implicit feedback:
   - User regenerations (rejected previous response)
   - Upvotes/downvotes
   - Conversation continuation (did user engage?)
   - Noisiest signal but free and abundant
```

---

## Step 3: RLHF (Reinforcement Learning from Human Feedback)

Use the reward model to guide the LLM. The LLM generates responses,
the reward model scores them, and the LLM is updated to produce
higher-scoring responses.

```
RLHF Loop:

┌─── Generate response to prompt ───┐
│                                    │
│  Policy (LLM) ──► Response         │
│       │                            │
│       ▼                            │
│  Reward Model ──► Score            │
│       │                            │
│       ▼                            │
│  PPO Update ──► Better Policy      │
│       │                            │
└───────┴── Repeat ─────────────────┘
```

### PPO (Proximal Policy Optimization)

The standard RL algorithm for RLHF. It updates the policy (LLM) to
maximize the reward while staying close to the original SFT model.

```python
from trl import PPOConfig, PPOTrainer, AutoModelForCausalLMWithValueHead

config = PPOConfig(
    model_name="sft-model",
    learning_rate=1.41e-5,
    batch_size=64,
    mini_batch_size=16,
    gradient_accumulation_steps=4,
    ppo_epochs=4,
    kl_penalty="kl",
    init_kl_coef=0.2,    # initial KL penalty coefficient
    target_kl=6.0,        # target KL divergence
)

model = AutoModelForCausalLMWithValueHead.from_pretrained("sft-model")
ref_model = AutoModelForCausalLMWithValueHead.from_pretrained("sft-model")

ppo_trainer = PPOTrainer(
    config=config,
    model=model,
    ref_model=ref_model,  # frozen copy for KL computation
    tokenizer=tokenizer,
    dataset=prompt_dataset,
)

for batch in ppo_trainer.dataloader:
    query_tensors = batch["input_ids"]

    response_tensors = ppo_trainer.generate(
        query_tensors,
        max_new_tokens=256,
        temperature=0.7,
    )

    rewards = compute_rewards(reward_model, query_tensors, response_tensors)

    stats = ppo_trainer.step(query_tensors, response_tensors, rewards)
    print(f"Mean reward: {stats['ppo/mean_scores']:.3f}")
```

### The KL Divergence Constraint

The most critical part of RLHF. Without it, the model "hacks" the
reward model — finding degenerate outputs that score high on the reward
model but are actually terrible.

```
Without KL constraint:
  Model learns: "I'd be happy to help! That's a great question!
  Let me provide a comprehensive answer..."
  (Sycophantic, verbose, but scores high on reward model)

With KL constraint:
  Model stays close to SFT behavior
  Only makes targeted improvements to quality
  KL divergence = how different the new policy is from the reference

Reward function:
  R_total = R_reward_model - β × KL(policy || reference)

β controls the tradeoff:
  High β: Stay very close to SFT (safe, small improvements)
  Low β:  Diverge more from SFT (risky, potentially reward hacking)
```

---

## DPO: Direct Preference Optimization

DPO skips the reward model entirely. It directly optimizes the LLM
using preference pairs, deriving the reward implicitly from the
policy itself.

```
RLHF pipeline:
  SFT → Train Reward Model → PPO Training → Aligned Model
  (3 separate training phases, complex)

DPO pipeline:
  SFT → DPO Training → Aligned Model
  (1 training phase, simple)
```

### The DPO Loss

```python
import torch
import torch.nn.functional as F

def dpo_loss(
    policy_model,
    reference_model,
    chosen_ids,
    rejected_ids,
    chosen_mask,
    rejected_mask,
    beta=0.1,
):
    # get log probabilities from policy model
    with torch.no_grad():
        ref_chosen_logps = get_log_probs(reference_model, chosen_ids, chosen_mask)
        ref_rejected_logps = get_log_probs(reference_model, rejected_ids, rejected_mask)

    policy_chosen_logps = get_log_probs(policy_model, chosen_ids, chosen_mask)
    policy_rejected_logps = get_log_probs(policy_model, rejected_ids, rejected_mask)

    # DPO: the implicit reward is the log-ratio of policy to reference
    chosen_reward = beta * (policy_chosen_logps - ref_chosen_logps)
    rejected_reward = beta * (policy_rejected_logps - ref_rejected_logps)

    # maximize: log sigmoid(reward_chosen - reward_rejected)
    loss = -F.logsigmoid(chosen_reward - rejected_reward).mean()

    # metrics
    with torch.no_grad():
        reward_margin = (chosen_reward - rejected_reward).mean()
        accuracy = (chosen_reward > rejected_reward).float().mean()

    return loss, reward_margin, accuracy


def get_log_probs(model, input_ids, attention_mask):
    outputs = model(input_ids=input_ids, attention_mask=attention_mask)
    logits = outputs.logits[:, :-1]
    labels = input_ids[:, 1:]
    log_probs = F.log_softmax(logits, dim=-1)
    token_log_probs = log_probs.gather(2, labels.unsqueeze(2)).squeeze(2)
    mask = attention_mask[:, 1:]
    return (token_log_probs * mask).sum(dim=1) / mask.sum(dim=1)
```

### Using TRL for DPO

```python
from trl import DPOConfig, DPOTrainer
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("sft-model", torch_dtype=torch.bfloat16)
ref_model = AutoModelForCausalLM.from_pretrained("sft-model", torch_dtype=torch.bfloat16)
tokenizer = AutoTokenizer.from_pretrained("sft-model")

dpo_config = DPOConfig(
    output_dir="dpo-output",
    beta=0.1,
    learning_rate=5e-7,
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    bf16=True,
    logging_steps=10,
    warmup_ratio=0.1,
    lr_scheduler_type="cosine",
    max_length=2048,
    max_prompt_length=1024,
)

trainer = DPOTrainer(
    model=model,
    ref_model=ref_model,
    args=dpo_config,
    train_dataset=preference_dataset,  # needs "prompt", "chosen", "rejected" columns
    tokenizer=tokenizer,
)
trainer.train()
```

### RLHF vs DPO

```
                    RLHF (PPO)              DPO
──────────────────────────────────────────────────────
Complexity          High (3 models)          Low (2 models)
Training stability  Tricky (RL tuning)       More stable
Compute cost        High (generation loop)   Lower (standard training)
Quality at scale    Best (with tuning)       Very good
Reward hacking      Possible                 Less prone
Online learning     Yes (generates new data) No (fixed dataset)
```

DPO has largely replaced RLHF in practice for most teams because it is
simpler and more stable. RLHF with PPO remains the gold standard for
frontier labs that can afford the engineering complexity.

---

## Constitutional AI (CAI)

Anthropic's approach. Instead of relying entirely on human preferences,
define a set of principles (a "constitution") and have the AI critique
and revise its own outputs.

```
Constitutional AI process:

1. Generate: Model produces a response
2. Critique: Model evaluates its response against principles
   "Does this response violate the principle of being helpful?"
   "Does this response contain harmful content?"
3. Revise: Model rewrites the response to address critiques
4. Train: Use (original, revised) as preference pair

Principles (simplified):
  - Be helpful and informative
  - Avoid harmful or misleading content
  - Respect user privacy
  - Be honest about uncertainty
  - Refuse genuinely dangerous requests
```

The key advantage: scales preference data generation without expensive
human annotation. The constitution provides a consistent standard.

---

## The Alignment Tax

Alignment is not free. It costs model capability.

```
The alignment tax:

Pre-trained model (raw capability):
  ████████████████████████  100%

After SFT:
  ██████████████████████    ~95% (slight degradation on benchmarks)

After RLHF/DPO:
  ████████████████████      ~90% (more degradation)

This is measured on raw capability benchmarks (MMLU, coding, math).
On instruction-following benchmarks, aligned models are much better.
```

The alignment tax is real but acceptable. A model that is 10% worse at
raw reasoning but actually follows instructions is far more useful than
a brilliant model that ignores your questions.

### Mitigating the Alignment Tax

```
Strategies:
  1. Use LoRA for alignment (preserves base capabilities better)
  2. Lower beta in DPO (less aggressive alignment)
  3. High-quality, diverse preference data (avoid over-fitting to patterns)
  4. Mix capability data with alignment data during training
  5. Evaluate on both capability AND alignment benchmarks
```

---

## Key Takeaways

1. **SFT teaches format, RLHF/DPO teaches quality.** Both steps are
   necessary. SFT alone produces instruction-following but mediocre
   responses.

2. **DPO is the practical default.** Simpler, more stable, and nearly
   as good as PPO-based RLHF. Use DPO unless you have the engineering
   resources for full RLHF.

3. **KL divergence is the safety valve.** Without it, the model hacks
   the reward signal and produces sycophantic or degenerate outputs.

4. **Preference data quality matters.** 10K high-quality preference pairs
   outperform 100K noisy ones. Invest in annotation quality.

5. **Alignment has a cost.** Expect 5-10% capability regression on raw
   benchmarks. This is an acceptable tradeoff for most applications.

6. **Constitutional AI scales preference data** without human
   annotation. Define clear principles and let the model self-critique.

---

## Exercises

1. **SFT experiment.** Fine-tune a 7B model on 1000 high-quality
   instruction pairs (LIMA-style). Compare against fine-tuning on
   100K noisy pairs. Evaluate on MT-Bench.

2. **DPO training.** Take your SFT model, train DPO with UltraFeedback
   preference data. Vary beta (0.05, 0.1, 0.5) and measure the
   tradeoff between alignment quality and capability retention.

3. **Build a reward model.** Train a reward model on preference data.
   Score 100 model responses and compare to human preferences. What
   is the agreement rate?
