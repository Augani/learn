# Lesson 03: Mixture of Experts — Scaling Without Scaling Compute

Imagine a hospital. When you walk in, a triage nurse looks at your
symptoms and sends you to the right specialist — a cardiologist for
chest pain, a dermatologist for a rash. The hospital has hundreds of
doctors, but you only see one or two. The hospital's total knowledge
is enormous, but the cost of treating you is the cost of one visit.

Mixture of Experts (MoE) works exactly the same way. The model has
many specialized sub-networks (experts), but a router sends each
token to only a few of them. Total parameters are huge, but compute
per token stays small.

---

## Why MoE Exists

Dense models have a fundamental problem: every parameter is used for
every token. A 70B parameter dense model does 70B parameters worth of
compute for every single token — including "the" and "and."

```
Dense Model (70B):
  Every token → ALL 70B parameters → Output
  Compute: 70B FLOPs per token

MoE Model (8x7B, top-2 routing):
  Every token → Router → 2 of 8 experts (7B each) → Output
  Total params: ~47B (shared layers + 8 experts)
  Compute: ~14B FLOPs per token (only 2 experts active)

Result: Dense-70B quality at Dense-14B compute cost
```

Mixtral 8x7B demonstrated this beautifully — it matched or exceeded
Llama 2 70B while running at roughly the speed of a 13B model.

---

## MoE Architecture

### Where Experts Live

In a standard transformer, each layer has:
1. Self-attention block
2. Feed-forward network (FFN)

In MoE, the FFN is replaced by multiple expert FFNs plus a router:

```
Standard Transformer Layer:
┌─────────────────────────────────┐
│  Input                          │
│    │                            │
│    ▼                            │
│  [Self-Attention]               │
│    │                            │
│    ▼                            │
│  [Feed-Forward Network]  ◄──── One FFN, always used
│    │                            │
│    ▼                            │
│  Output                         │
└─────────────────────────────────┘

MoE Transformer Layer:
┌─────────────────────────────────────────────┐
│  Input                                      │
│    │                                        │
│    ▼                                        │
│  [Self-Attention]                           │
│    │                                        │
│    ▼                                        │
│  [Router] ──► Expert 0 (FFN)               │
│    │    ──► Expert 1 (FFN)  ◄── Only top-k │
│    │    ──► Expert 2 (FFN)      are used   │
│    │    ──► Expert 3 (FFN)                  │
│    │    ──► Expert 4 (FFN)                  │
│    │    ──► Expert 5 (FFN)                  │
│    │    ──► Expert 6 (FFN)                  │
│    │    ──► Expert 7 (FFN)                  │
│    │                                        │
│    ▼                                        │
│  [Weighted sum of selected expert outputs]  │
│    │                                        │
│    ▼                                        │
│  Output                                     │
└─────────────────────────────────────────────┘
```

The self-attention layer is shared — every token goes through the same
attention. Only the FFN (which contains ~2/3 of a transformer's
parameters) gets the expert treatment.

---

## The Router: How Tokens Choose Experts

The router is a simple linear layer that maps each token's hidden state
to a score for each expert.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class TopKRouter(nn.Module):
    def __init__(self, hidden_size, num_experts, top_k=2):
        super().__init__()
        self.gate = nn.Linear(hidden_size, num_experts, bias=False)
        self.top_k = top_k
        self.num_experts = num_experts

    def forward(self, hidden_states):
        # hidden_states: (batch, seq_len, hidden_size)
        router_logits = self.gate(hidden_states)
        # router_logits: (batch, seq_len, num_experts)

        routing_weights = F.softmax(router_logits, dim=-1)

        top_k_weights, top_k_indices = torch.topk(
            routing_weights, self.top_k, dim=-1
        )

        top_k_weights = top_k_weights / top_k_weights.sum(dim=-1, keepdim=True)

        return top_k_weights, top_k_indices, router_logits
```

For each token:
1. Compute a score for every expert
2. Pick the top-k experts (usually k=1 or k=2)
3. Normalize the weights of selected experts so they sum to 1
4. Run the token through selected experts
5. Combine outputs using the normalized weights

---

## Top-k Gating Strategies

### Top-1: Each Token Gets One Expert

Used by Switch Transformer. Simplest and fastest.

```
Token "the"         → Expert 3 (weight: 1.0)
Token "transformer" → Expert 7 (weight: 1.0)
Token "uses"        → Expert 1 (weight: 1.0)
```

Pro: Maximum compute savings (only 1 expert per token).
Con: Fragile — if the router makes a bad choice, there is no backup.

### Top-2: Each Token Gets Two Experts

Used by Mixtral. The standard choice.

```
Token "the"         → Expert 3 (0.6) + Expert 5 (0.4)
Token "transformer" → Expert 7 (0.8) + Expert 2 (0.2)
Token "uses"        → Expert 1 (0.7) + Expert 4 (0.3)
```

Pro: More robust. Two experts provide complementary information.
Con: 2x the compute of top-1 (but still much less than dense).

### Expert Choice: Experts Pick Tokens

Flipped model — instead of tokens choosing experts, experts choose
which tokens to process. Each expert selects its top-k tokens.

```
Expert 0 picks: tokens [3, 7, 12, 45, ...]  (top capacity tokens)
Expert 1 picks: tokens [1, 5, 22, 38, ...]
...

Pro: Guarantees perfect load balance (every expert gets same #tokens)
Con: Some tokens might not be picked by any expert (need fallback)
```

---

## Load Balancing: The Critical Challenge

Without load balancing, MoE training collapses. The router learns to
send everything to one or two experts. The others starve and their
weights become useless. This is called the "rich get richer" problem.

```
Bad: Collapsed routing
Expert 0: ████████████████████████ 80% of tokens
Expert 1: ███ 10%
Expert 2: ██ 7%
Expert 3: █ 3%
Expert 4-7: (empty)

Good: Balanced routing
Expert 0: ████████████ 12.5%
Expert 1: ████████████ 12.5%
Expert 2: ████████████ 12.5%
Expert 3: ████████████ 12.5%
Expert 4: ████████████ 12.5%
Expert 5: ████████████ 12.5%
Expert 6: ████████████ 12.5%
Expert 7: ████████████ 12.5%
```

### Auxiliary Load Balancing Loss

The standard fix: add a loss term that penalizes imbalanced routing.

```python
def load_balancing_loss(router_logits, top_k_indices, num_experts):
    # router_logits: (batch * seq_len, num_experts)
    # top_k_indices: (batch * seq_len, top_k)

    routing_probs = F.softmax(router_logits, dim=-1)

    # fraction of tokens assigned to each expert
    # (how much work each expert does)
    expert_mask = F.one_hot(top_k_indices, num_experts).sum(dim=1)
    tokens_per_expert = expert_mask.float().mean(dim=0)

    # average routing probability for each expert
    # (how much the router "wants" to use each expert)
    router_prob_per_expert = routing_probs.mean(dim=0)

    # the loss is high when some experts get many tokens AND
    # the router gives them high probability
    aux_loss = (tokens_per_expert * router_prob_per_expert).sum() * num_experts

    return aux_loss
```

This loss encourages the router to spread tokens evenly. The
coefficient is typically 0.01 — high enough to prevent collapse but
low enough not to override the language modeling objective.

### Router Z-Loss

ST-MoE introduced an additional regularizer that penalizes large
router logits, preventing the router from becoming too confident:

```python
def router_z_loss(router_logits):
    # Penalize large logits to keep routing soft
    log_z = torch.logsumexp(router_logits, dim=-1)
    z_loss = (log_z ** 2).mean()
    return z_loss
```

---

## Expert Specialization

Do experts actually specialize? Yes — research shows clear patterns:

```
Typical specialization patterns in language MoE:

Expert 0: Punctuation, syntax, function words
Expert 1: Named entities, proper nouns
Expert 2: Numbers, dates, quantities
Expert 3: Technical/scientific vocabulary
Expert 4: Code and markup
Expert 5: Conversational language
Expert 6: Formal/academic writing
Expert 7: Multilingual (non-English tokens)

Note: This is illustrative. Real patterns vary by model and training.
```

Specialization emerges naturally — you do not need to force it. The
router learns to send tokens to the expert that handles them best.

---

## The MoE Expert Module

Each expert is just a standard FFN, identical in architecture:

```python
class Expert(nn.Module):
    def __init__(self, hidden_size, intermediate_size):
        super().__init__()
        self.gate_proj = nn.Linear(hidden_size, intermediate_size, bias=False)
        self.up_proj = nn.Linear(hidden_size, intermediate_size, bias=False)
        self.down_proj = nn.Linear(intermediate_size, hidden_size, bias=False)

    def forward(self, x):
        return self.down_proj(F.silu(self.gate_proj(x)) * self.up_proj(x))


class MoELayer(nn.Module):
    def __init__(self, hidden_size, intermediate_size, num_experts, top_k):
        super().__init__()
        self.router = TopKRouter(hidden_size, num_experts, top_k)
        self.experts = nn.ModuleList([
            Expert(hidden_size, intermediate_size)
            for _ in range(num_experts)
        ])
        self.num_experts = num_experts
        self.top_k = top_k

    def forward(self, hidden_states):
        batch_size, seq_len, hidden_size = hidden_states.shape
        flat_hidden = hidden_states.view(-1, hidden_size)

        weights, indices, router_logits = self.router(hidden_states)
        weights = weights.view(-1, self.top_k)
        indices = indices.view(-1, self.top_k)

        final_output = torch.zeros_like(flat_hidden)

        for expert_idx in range(self.num_experts):
            expert = self.experts[expert_idx]

            # find all (token, slot) pairs routed to this expert
            mask = (indices == expert_idx)
            token_indices = mask.any(dim=-1).nonzero(as_tuple=True)[0]

            if token_indices.numel() == 0:
                continue

            expert_input = flat_hidden[token_indices]
            expert_output = expert(expert_input)

            # weight by router confidence
            expert_weights = (weights * mask.float())[token_indices].sum(dim=-1, keepdim=True)
            final_output[token_indices] += expert_output * expert_weights

        return final_output.view(batch_size, seq_len, hidden_size), router_logits
```

This naive loop-over-experts implementation is slow. Production
systems use custom CUDA kernels that batch the work efficiently.
Megablocks and ScatterMoE are two libraries that provide fast
MoE implementations.

---

## Key MoE Models

### Switch Transformer (Google, 2021)

The paper that made MoE practical for transformers.

```
Key ideas:
  - Top-1 routing (simplest possible)
  - Capacity factor: limit max tokens per expert
  - Auxiliary load balancing loss
  - Showed MoE scales better than dense at same compute
```

### Mixtral 8x7B (Mistral AI, 2024)

Proved MoE works at production scale.

```
Architecture:
  - 8 experts per layer, top-2 routing
  - Each expert is ~7B parameters (FFN only)
  - Shared attention layers
  - Total: ~47B parameters
  - Active per token: ~13B parameters
  - Context: 32K tokens

Performance: Matches Llama 2 70B at ~3x less compute
```

### DeepSeek-V2 (DeepSeek, 2024)

Pushed MoE further with fine-grained experts.

```
Architecture:
  - 160 experts per layer, top-6 routing
  - Small experts (reduces granularity)
  - Shared experts (always active, no routing)
  - Multi-head latent attention (compressed KV cache)
  - 236B total parameters, ~21B active
```

The shared expert idea is powerful: some knowledge should be available
for every token (basic grammar, common patterns). Only specialized
knowledge needs routing.

---

## Training MoE Models: Practical Considerations

### Memory Requirements

MoE trades compute for memory. All experts must be in memory even
though only a few are active per token.

```
Dense 13B:
  Parameters in memory: 13B × 2 bytes (bf16) = 26 GB

MoE 8×7B (Mixtral-style):
  Parameters in memory: ~47B × 2 bytes = 94 GB
  But compute per token ≈ 13B model

You need 4x more memory for the same compute speed.
```

This is why MoE models often require multi-GPU setups even at
moderate sizes. Expert parallelism — placing different experts on
different GPUs — is the standard approach.

### Expert Parallelism

```
GPU 0: Attention (shared) + Experts 0,1
GPU 1: Attention (shared) + Experts 2,3
GPU 2: Attention (shared) + Experts 4,5
GPU 3: Attention (shared) + Experts 6,7

Token routing requires all-to-all communication:
  GPU 0 has tokens for Expert 4 → send to GPU 2
  GPU 2 has tokens for Expert 1 → send to GPU 0
```

The all-to-all communication is the bottleneck. Fast interconnects
(NVLink, InfiniBand) are essential for MoE training.

### Capacity Factor

Limit how many tokens each expert can process per batch:

```python
capacity_factor = 1.25  # each expert handles at most 125% of fair share

tokens_per_batch = batch_size * seq_len
fair_share = tokens_per_batch / num_experts
capacity = int(fair_share * capacity_factor)

# tokens beyond capacity are dropped (processed by a default path)
```

Setting capacity too low drops too many tokens. Setting it too high
wastes memory on padding. 1.0-1.5 is typical.

---

## MoE Inference Challenges

### The Memory Problem

At inference time, you need all experts in memory but only use 1-2
per token. This means most of your GPU memory is "wasted" on inactive
experts.

```
Mixtral 8x7B inference:
  Need: 94 GB for all experts in bf16
  Use:  ~26 GB worth of compute per token

Solutions:
  1. Expert offloading: keep inactive experts on CPU, swap in as needed
  2. Quantization: GPTQ/AWQ the experts to 4-bit → ~24 GB total
  3. Multi-GPU: spread experts across GPUs
```

### Expert Offloading

```
CPU Memory: [Expert 0] [Expert 1] [Expert 2] [Expert 3] ... [Expert 7]
                ↕           ↕
GPU Memory: [Expert 0] [Expert 3] [Attention] [KV Cache]

Router says token needs Expert 5:
  1. Copy Expert 5 from CPU → GPU
  2. Run token through Expert 5
  3. Evict Expert 0 from GPU (LRU)
```

This works because routing patterns have locality — consecutive tokens
often go to the same experts. With good caching, the hit rate is high.

---

## Key Takeaways

1. **MoE gives you more knowledge at the same compute cost.** Total
   parameters scale, but active parameters per token stay fixed.

2. **Load balancing is critical.** Without auxiliary losses, routing
   collapses to a few experts and you have wasted all that memory.

3. **MoE trades memory for compute.** You need all experts in memory
   but only use a few. This changes your hardware requirements.

4. **Top-2 routing is the standard.** Top-1 is fragile, top-2 gives
   robustness. Expert Choice guarantees balance but is harder to
   implement.

5. **Expert specialization is real.** Experts naturally learn to handle
   different types of tokens. This is emergent, not forced.

6. **All-to-all communication is the bottleneck.** For distributed
   training, fast interconnects are essential.

---

## Exercises

1. **Build a toy MoE layer.** Implement the router, experts, and load
   balancing loss. Train on a small dataset and visualize which tokens
   go to which experts.

2. **Measure the routing collapse.** Train an MoE model without
   load balancing loss. Observe how quickly routing degenerates.
   Then add the loss and compare.

3. **Expert analysis.** Load Mixtral 8x7B and run a diverse set of
   prompts. Log which experts are selected for different token types.
   Do you see specialization patterns?
