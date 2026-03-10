# Lesson 07: Speculative Decoding — Using a Small Model to Speed Up a Big One

Autoregressive generation is inherently sequential. Each token depends
on the previous one. You cannot parallelize it. This makes LLM
inference slow — not because the GPU is busy, but because it is mostly
idle, waiting for one token at a time.

Think of speculative decoding like a junior lawyer drafting a contract.
The junior writes quickly but makes some mistakes. The senior partner
reviews the draft in one pass, accepting most paragraphs and rewriting
the few that are wrong. Total time: one fast draft plus one quick
review, instead of the senior writing every word from scratch.

---

## Why LLM Decoding Is Slow

During the decode phase, the model generates one token per forward
pass. Each pass uses the entire model, but the computation is tiny
(matrix-vector multiply instead of matrix-matrix multiply).

```
Single-token decode step:

  Input: 1 token (the last generated token)
  Process: Full model forward pass through all layers
  Output: 1 token (the next prediction)

  GPU utilization: ~5-15%

Why so low?
  - The matmul is (1 × D) @ (D × V) — one vector times a matrix
  - This is memory-bandwidth bound, not compute bound
  - The GPU has thousands of cores but most are idle
  - Loading model weights from memory takes longer than the actual math
```

```
Decode throughput bottleneck:

  A100 compute:  312 TFLOPS (bf16)
  A100 bandwidth: 2 TB/s

  Llama 7B weights: 14 GB
  Time to load weights: 14 GB / 2 TB/s = 7ms
  Time to compute (1 token): <1ms

  The GPU spends 90%+ of its time loading weights, not computing.
  This is called being "memory-bandwidth bound."
```

---

## The Speculative Decoding Idea

Use a small, fast "draft" model to generate several tokens quickly.
Then use the large "target" model to verify all of them in a single
forward pass. The target model processes them in parallel (like
processing a prompt), which is much faster than sequential generation.

```
Traditional decoding (target model only):
  Step 1: Generate token 1 (15ms)
  Step 2: Generate token 2 (15ms)
  Step 3: Generate token 3 (15ms)
  Step 4: Generate token 4 (15ms)
  Step 5: Generate token 5 (15ms)
  Total: 75ms for 5 tokens

Speculative decoding:
  Draft:  Generate 5 tokens with small model (5 × 2ms = 10ms)
  Verify: Run all 5 through target model in one pass (20ms)
  Result: Accept 4 tokens, reject 1, resample 1 (30ms total)
  Total: ~30ms for 5 tokens  ← 2.5x speedup!
```

The key insight: **verification is parallel but generation is
sequential.** A forward pass with 5 tokens takes roughly the same
time as a forward pass with 1 token (for small batch sizes), because
both are memory-bandwidth bound.

---

## The Algorithm

### Step 1: Draft Phase

Run the draft model autoregressively to generate K candidate tokens.

```
Input:    "The capital of France is"
Draft:    "The capital of France is Paris , which is known"
          ← draft generated K=5 tokens: [Paris, ,, which, is, known]
```

### Step 2: Verification Phase

Run the target model on the entire sequence (prompt + draft tokens)
in a single forward pass. This gives you the target model's
probability distribution at each position.

```
Target model processes all at once:

Position:  "...France is [Paris] [,] [which] [is] [known]"
Target P:   P(Paris)=0.85  P(,)=0.70  P(which)=0.60  P(is)=0.30  P(a)=0.40

Draft chose: Paris(✓)      ,(✓)       which(✓)      is(?)       known
```

### Step 3: Accept/Reject

Compare draft tokens against target probabilities using a modified
rejection sampling scheme:

```python
import torch

def speculative_sampling(
    draft_probs,    # draft model probabilities at each position
    target_probs,   # target model probabilities at each position
    draft_tokens,   # tokens chosen by draft model
    temperature=1.0,
):
    accepted = []
    num_draft = len(draft_tokens)

    for i in range(num_draft):
        token = draft_tokens[i]
        p_draft = draft_probs[i][token]
        p_target = target_probs[i][token]

        acceptance_prob = min(1.0, p_target / p_draft)
        r = torch.rand(1).item()

        if r < acceptance_prob:
            accepted.append(token)
        else:
            # reject this and all subsequent tokens
            # resample from adjusted distribution
            adjusted = torch.clamp(target_probs[i] - draft_probs[i], min=0)
            adjusted = adjusted / adjusted.sum()
            new_token = torch.multinomial(adjusted, 1).item()
            accepted.append(new_token)
            break

    # if all K tokens accepted, sample one more from target
    if len(accepted) == num_draft:
        next_token = torch.multinomial(target_probs[num_draft], 1).item()
        accepted.append(next_token)

    return accepted
```

**Critical property:** This algorithm produces the exact same
distribution as the target model. It is not an approximation. The
output is mathematically identical to sampling from the target model
directly.

---

## Why Rejection Sampling Works

The acceptance criterion ensures correctness:

```
If p_target(token) >= p_draft(token):
  Accept with probability 1 (target wanted it at least as much)

If p_target(token) < p_draft(token):
  Accept with probability p_target/p_draft
  (proportional to how much the target agrees)

On rejection: sample from (p_target - p_draft), normalized
  This fills in the probability mass that the draft "used up"
  incorrectly, ensuring the overall distribution matches p_target.
```

The result: every token in the output is distributed according to
p_target. The draft model only determines speed, never quality.

---

## Choosing the Draft Model

The draft model determines your speedup. It needs to be:
1. **Fast** — much faster than the target model
2. **Accurate** — high agreement rate with the target model
3. **Compatible** — same vocabulary and tokenizer

```
Common draft-target pairs:

Draft Model        Target Model      Acceptance Rate    Speedup
──────────────────────────────────────────────────────────────────
Llama 3 1B         Llama 3 70B       60-70%            2.0-2.5x
Llama 3 8B         Llama 3 70B       70-80%            1.8-2.2x
CodeLlama 7B       CodeLlama 34B     75-85%            1.5-2.0x
Phi-3 mini         Phi-3 medium      65-75%            2.0-2.5x

Rule of thumb: draft model should be 5-10x smaller than target.
Larger draft = higher acceptance but slower drafting.
```

### Acceptance Rate Analysis

```
The speedup depends on the acceptance rate α:

If draft generates K tokens:
  Expected accepted tokens = K × α (approximately)

Time without speculation: K × t_target
Time with speculation: K × t_draft + t_target (one verify pass)

Speedup ≈ (K × α + 1) × t_target / (K × t_draft + t_target)

For K=5, α=0.75, t_draft=2ms, t_target=15ms:
  Without: 5 × 15 = 75ms for ~5 tokens
  With:    5 × 2 + 15 = 25ms for ~4.75 tokens (3.75 accepted + 1 resampled)
  Speedup: ~3x

Diminishing returns with larger K:
  K=3:  speedup ≈ 2.5x  (safe, works well)
  K=5:  speedup ≈ 3.0x  (good sweet spot)
  K=8:  speedup ≈ 3.2x  (marginal gains, longer drafts get rejected more)
  K=15: speedup ≈ 3.0x  (too many rejections, actually slower)
```

---

## Medusa Heads: Self-Speculation

What if you do not want a separate draft model? Medusa adds extra
prediction heads to the target model itself. Each head predicts a
different future token position.

```
Standard LLM:
  Hidden state → Head 0 → next token (position +1)

Medusa LLM:
  Hidden state → Head 0 → token at position +1
               → Head 1 → token at position +2
               → Head 2 → token at position +3
               → Head 3 → token at position +4
               → Head 4 → token at position +5

Each Medusa head is a small MLP:
  head_k = Linear(hidden_dim, vocab_size)
```

```python
import torch.nn as nn

class MedusaHead(nn.Module):
    def __init__(self, hidden_size, vocab_size, num_heads=5):
        super().__init__()
        self.heads = nn.ModuleList([
            nn.Sequential(
                nn.Linear(hidden_size, hidden_size),
                nn.SiLU(),
                nn.Linear(hidden_size, vocab_size),
            )
            for _ in range(num_heads)
        ])

    def forward(self, hidden_states):
        # hidden_states: (batch, seq_len, hidden_dim)
        # Returns predictions for positions +1, +2, ..., +num_heads
        return [head(hidden_states) for head in self.heads]
```

### Training Medusa Heads

Medusa heads are trained on top of a frozen base model. Only the
heads are trained, not the base model weights.

```python
def train_medusa_step(model, medusa_heads, input_ids, optimizer):
    with torch.no_grad():
        outputs = model(input_ids, output_hidden_states=True)
        hidden_states = outputs.hidden_states[-1]

    predictions = medusa_heads(hidden_states)

    loss = 0
    for k, head_logits in enumerate(predictions):
        shift = k + 1
        target = input_ids[:, shift:]
        pred = head_logits[:, :-shift]
        loss += nn.functional.cross_entropy(
            pred.reshape(-1, pred.size(-1)),
            target.reshape(-1),
        )

    loss = loss / len(predictions)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    return loss.item()
```

Training takes just a few hours on a single GPU with a moderate
dataset (100K-1M examples).

---

## Tree-Based Verification

Instead of a single chain of draft tokens, generate a tree of
candidates. Each branch represents a different possible continuation.

```
Linear speculation (K=4):
  "is" → "Paris" → "," → "the"
  One path, 4 candidates

Tree speculation (branching factor 2, depth 3):
            "is"
           /    \
       "Paris"  "the"
       /  \      /  \
     ","  "."  "cap" "city"

  One root, 6 candidates, but only 3 deep
  Verify all branches in parallel
  Pick the longest accepted path
```

```python
class TreeSpeculation:
    def __init__(self, draft_model, branching_factor=2, max_depth=4):
        self.draft_model = draft_model
        self.branching_factor = branching_factor
        self.max_depth = max_depth

    def generate_tree(self, prefix_ids):
        tree = {"token": None, "children": [], "logits": None}

        def expand(node, ids, depth):
            if depth >= self.max_depth:
                return

            logits = self.draft_model(ids)
            probs = torch.softmax(logits[:, -1], dim=-1)
            top_tokens = torch.topk(probs, self.branching_factor).indices[0]

            for token in top_tokens:
                child = {
                    "token": token.item(),
                    "prob": probs[0, token].item(),
                    "children": [],
                }
                node["children"].append(child)
                new_ids = torch.cat([ids, token.unsqueeze(0).unsqueeze(0)], dim=1)
                expand(child, new_ids, depth + 1)

        expand(tree, prefix_ids, 0)
        return tree
```

Tree verification is used by Medusa v2 and EAGLE. It increases the
expected number of accepted tokens per verification step, at the cost
of processing more candidates.

---

## EAGLE: Another Self-Speculation Approach

EAGLE (Extrapolation Algorithm for Greater Language-model Efficiency)
trains a lightweight draft head that takes the hidden states AND the
token embedding of the last generated token as input. This gives it
more information than Medusa heads.

```
Medusa:  hidden_state → next token
EAGLE:   hidden_state + last_token_embedding → next hidden_state → next token

EAGLE predicts at the hidden state level, not the token level.
This gives higher acceptance rates (typically 70-85%).
```

EAGLE achieves 2.5-3.5x speedup on common tasks, making it one of
the fastest speculation methods available.

---

## Implementation with vLLM

vLLM supports speculative decoding out of the box:

```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Llama-3-70B-Instruct",
    speculative_model="meta-llama/Llama-3-8B-Instruct",
    num_speculative_tokens=5,
    tensor_parallel_size=4,
)

params = SamplingParams(temperature=0.7, max_tokens=512)
outputs = llm.generate(["Explain quantum computing:"], params)
```

For Medusa-style self-speculation:

```python
llm = LLM(
    model="meta-llama/Llama-3-8B-Instruct",
    speculative_model="[medusa]",  # uses attached Medusa heads
    num_speculative_tokens=5,
)
```

---

## When Speculative Decoding Helps (and Hurts)

```
Helps most:
  ✓ Single-request latency (interactive use)
  ✓ Large target models (70B+)
  ✓ Tasks with predictable outputs (code, structured data, translations)
  ✓ Temperature = 0 (greedy decoding, highest acceptance rate)

Helps less:
  △ High temperature sampling (more randomness = lower acceptance)
  △ Very diverse outputs (creative writing)
  △ Small target models (draft model overhead is proportionally larger)

Hurts:
  ✗ High-throughput batch inference (already GPU-saturated)
  ✗ When draft model is too slow (poor draft-target size ratio)
  ✗ When memory for draft model displaces batch capacity
```

```
Acceptance rate by task type:

Code completion:      80-90%  (very predictable patterns)
Translation:          75-85%  (structured output)
Factual QA:           70-80%  (common knowledge)
Summarization:        65-75%  (somewhat predictable)
Creative writing:     50-65%  (less predictable)
High-temperature:     40-55%  (intentionally random)
```

---

## Key Takeaways

1. **Speculative decoding gives 2-3x speedup** for latency-sensitive
   single-request inference. It is free quality — output distribution
   is mathematically identical to the target model.

2. **The draft model choice is critical.** Same tokenizer, 5-10x
   smaller, highest possible agreement with the target.

3. **K=5 is a good starting point** for speculation length. Profile
   your specific use case to find the optimum.

4. **Medusa/EAGLE avoid needing a separate model.** Small additional
   heads on the target model itself, trained cheaply.

5. **Tree verification beats linear speculation** for higher acceptance
   rates, at the cost of more candidates to process.

6. **Does not help batch throughput.** When the GPU is already saturated
   with parallel requests, speculation adds overhead without benefit.

---

## Exercises

1. **Implement basic speculative decoding.** Use a small GPT-2 as
   draft and GPT-2 Large as target. Measure acceptance rate and
   speedup at different temperatures.

2. **Train Medusa heads.** Add 3 Medusa heads to a small model. Train
   them for 1000 steps. Compare acceptance rate against a separate
   draft model approach.

3. **Measure the crossover point.** At what batch size does speculative
   decoding stop helping? Profile with batch sizes 1, 4, 16, 64 and
   plot latency per token.
