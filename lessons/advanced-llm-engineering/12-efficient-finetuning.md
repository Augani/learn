# Lesson 12: Efficient Fine-tuning — Adapting Models Without Breaking the Bank

Full fine-tuning of a 70B model requires 8+ A100s and costs thousands
of dollars. Efficient methods like LoRA let you fine-tune the same
model on a single GPU for a few dollars. The quality is usually within
a few percent of full fine-tuning.

Think of it like renovating a house. Full fine-tuning tears the whole
building down and rebuilds from foundation up. LoRA just remodels the
kitchen and bathroom — the rooms that matter most — while leaving the
solid structure untouched.

---

## The PEFT Landscape

```
Parameter-Efficient Fine-Tuning (PEFT) methods:

Method           Trainable Params    Quality     Complexity
────────────────────────────────────────────────────────────
Full fine-tune   100%                Best        High (memory)
LoRA             0.1-1%              Very good   Low
QLoRA            0.1-1%              Good        Very low
DoRA             0.1-1%              Very good   Low
Prefix Tuning    0.01-0.1%           Moderate    Very low
Prompt Tuning    <0.01%              Limited     Lowest
Adapter Layers   1-5%                Good        Moderate

LoRA and its variants dominate. The others are niche.
```

---

## LoRA: Low-Rank Adaptation

The core idea: instead of updating a full weight matrix W, learn a
low-rank update. The original weights stay frozen.

```
Full fine-tuning:
  W_new = W_original + ΔW
  ΔW is (d × d) — same size as W — millions of parameters

LoRA:
  W_new = W_original + B × A
  A is (d × r) and B is (r × d) where r << d
  Total trainable params: 2 × d × r instead of d × d

Example (d=4096, r=16):
  Full ΔW: 4096 × 4096 = 16,777,216 params
  LoRA:    4096 × 16 + 16 × 4096 = 131,072 params
  Ratio:   0.78% of full update
```

```
Visualization:

Full weight update:
┌────────────────┐
│                │
│    ΔW          │  d × d = 16M params
│  (full rank)   │
│                │
└────────────────┘

LoRA update:
┌──┐   ┌────────────────┐
│  │   │                │
│ B│ × │       A        │  = d×r + r×d = 131K params
│  │   │                │
│  │   └────────────────┘
└──┘
d×r          r×d

The product B×A has the same shape as ΔW but is constrained
to rank r. This captures 95%+ of the useful update.
```

### LoRA Implementation

```python
import torch
import torch.nn as nn
import math

class LoRALinear(nn.Module):
    def __init__(self, original_linear, rank=16, alpha=32, dropout=0.05):
        super().__init__()
        self.original = original_linear
        self.original.weight.requires_grad_(False)  # freeze
        if self.original.bias is not None:
            self.original.bias.requires_grad_(False)

        in_features = original_linear.in_features
        out_features = original_linear.out_features

        self.lora_A = nn.Linear(in_features, rank, bias=False)
        self.lora_B = nn.Linear(rank, out_features, bias=False)
        self.scaling = alpha / rank
        self.dropout = nn.Dropout(dropout)

        nn.init.kaiming_uniform_(self.lora_A.weight, a=math.sqrt(5))
        nn.init.zeros_(self.lora_B.weight)  # initialize B to zero

    def forward(self, x):
        original_out = self.original(x)
        lora_out = self.lora_B(self.lora_A(self.dropout(x)))
        return original_out + lora_out * self.scaling
```

### Key LoRA Parameters

```
rank (r):
  Controls the expressiveness of the update.
  r=8:   Minimal update, fast, lowest memory
  r=16:  Standard choice, good for most tasks
  r=64:  More expressive, approaches full fine-tuning
  r=256: Very expressive, use for complex adaptations

alpha (α):
  Scaling factor. Usually set to 2× rank.
  Effective scaling = α / r
  Higher alpha = stronger LoRA influence
  Standard: alpha = 2 × rank (so scaling = 2.0)

target_modules:
  Which layers to apply LoRA to.
  Minimum:  ["q_proj", "v_proj"]           (attention only)
  Standard: ["q_proj", "k_proj", "v_proj", "o_proj"]
  Maximum:  All linear layers including FFN

  More modules = more trainable params = better quality
  Standard attention-only is sufficient for most tasks.
```

### Using LoRA with PEFT and TRL

```python
from peft import LoraConfig, get_peft_model, TaskType
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from trl import SFTTrainer

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3-8B",
    torch_dtype=torch.bfloat16,
    device_map="auto",
)

lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: 6,553,600 || all params: 8,036,098,048 || trainable%: 0.08%

training_args = TrainingArguments(
    output_dir="./lora-output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,         # higher LR than full fine-tuning
    lr_scheduler_type="cosine",
    warmup_ratio=0.1,
    bf16=True,
    logging_steps=10,
    save_strategy="steps",
    save_steps=500,
)

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
    tokenizer=tokenizer,
    max_seq_length=2048,
)
trainer.train()

model.save_pretrained("./lora-adapter")
# saves only the LoRA weights (~25 MB instead of ~16 GB)
```

---

## QLoRA: LoRA on Quantized Models

QLoRA combines 4-bit quantization with LoRA. The base model is loaded
in 4-bit, and LoRA adapters are trained in bf16 on top.

```
Memory comparison (Llama 3 8B):

Full fine-tune (bf16):          32 GB (weights + gradients + optimizer)
LoRA (bf16 base):               18 GB (frozen weights + small trainable)
QLoRA (4-bit base + bf16 LoRA): 6 GB  (quantized weights + small trainable)

QLoRA makes 70B model fine-tuning possible on a single 48GB GPU.
```

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,    # quantize the quantization constants
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3-70B",
    quantization_config=bnb_config,
    device_map="auto",
)

model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=64,             # higher rank compensates for quantization noise
    lora_alpha=128,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
)

model = get_peft_model(model, lora_config)
```

### QLoRA Tips

```
For QLoRA, use higher rank than standard LoRA:
  LoRA on bf16 base:  r=16 is often sufficient
  QLoRA on 4-bit base: r=32-64 recommended (compensates for quantization noise)

Use NF4 quantization type (not INT4):
  NF4 (NormalFloat4) is specifically designed for normally-distributed
  neural network weights. It produces less quantization error than INT4.

Enable double quantization:
  Quantizes the quantization constants themselves. Saves ~0.4 bits per
  parameter with negligible quality impact.
```

---

## DoRA: Weight-Decomposed Low-Rank Adaptation

DoRA decomposes the weight update into magnitude and direction
components, then applies LoRA only to the direction.

```
Standard LoRA:
  W' = W + B × A    (update both magnitude and direction together)

DoRA:
  W' = m × (W + B × A) / ||W + B × A||
  where m is a learnable magnitude vector

Intuition:
  - Direction (what features to attend to) changes a lot during fine-tuning
  - Magnitude (how strongly) changes less
  - Decoupling them lets LoRA focus on the harder part (direction)
```

```python
from peft import LoraConfig

dora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    use_dora=True,  # enable DoRA
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
)
```

DoRA consistently outperforms LoRA at the same rank, typically by
1-2% on benchmarks. The overhead is minimal — one extra vector per
adapted layer.

---

## Prompt Tuning vs Prefix Tuning

### Prompt Tuning

Learn a small set of "virtual tokens" that are prepended to the input.
Only these virtual tokens are trained — the model is completely frozen.

```
Normal input:      [What is the capital of France?]
Prompt-tuned input: [v1 v2 v3 v4 v5] [What is the capital of France?]

v1-v5 are learned embeddings (not real words).
They steer the model's behavior without changing any weights.

Trainable params: num_virtual_tokens × embedding_dim
  = 20 × 4096 = 81,920 params (0.001% of 7B model)
```

```python
from peft import PromptTuningConfig, get_peft_model

config = PromptTuningConfig(
    task_type=TaskType.CAUSAL_LM,
    num_virtual_tokens=20,
    prompt_tuning_init="TEXT",
    prompt_tuning_init_text="Classify this text:",
    tokenizer_name_or_path="meta-llama/Llama-3-8B",
)

model = get_peft_model(model, config)
```

### Prefix Tuning

Like prompt tuning but adds virtual tokens at every layer, not just the
input. More expressive but more parameters.

```
Prompt tuning:
  [virtual tokens] → Layer 0 → Layer 1 → ... → Layer N

Prefix tuning:
  Layer 0: [prefix_0] + [input]
  Layer 1: [prefix_1] + [hidden]
  ...
  Layer N: [prefix_N] + [hidden]

Each layer gets its own learned prefix.
Trainable: num_virtual_tokens × num_layers × 2 × hidden_dim
(× 2 for key and value projections)
```

In practice, prompt tuning and prefix tuning are rarely used for LLMs
because LoRA achieves much better quality with similar parameter
counts. They shine when you need hundreds of task-specific adapters
that must be swapped instantly.

---

## Task Arithmetic: Combining LoRA Adapters

One of LoRA's superpowers: you can combine multiple adapters
arithmetically.

```
Adapter A: trained for code generation
Adapter B: trained for instruction following
Adapter C: trained for mathematical reasoning

Combined: W_new = W_base + α × A_code + β × A_instruct + γ × A_math

By adjusting α, β, γ you control the influence of each task.
```

```python
from peft import PeftModel

base_model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3-8B")

model = PeftModel.from_pretrained(base_model, "code-lora-adapter")
model.load_adapter("instruct-lora-adapter", adapter_name="instruct")
model.load_adapter("math-lora-adapter", adapter_name="math")

# combine adapters with custom weights
model.add_weighted_adapter(
    adapters=["default", "instruct", "math"],
    weights=[0.5, 0.3, 0.2],
    adapter_name="combined",
)
model.set_adapter("combined")
```

---

## Model Merging: TIES and DARE

### TIES (Trim, Elect Sign, Merge)

Merge multiple fine-tuned models by resolving conflicts in their
weight updates.

```
Problem with naive averaging:
  Model A says: increase weight[42] by +0.5
  Model B says: decrease weight[42] by -0.3
  Average: +0.1 (neither model's intent is preserved)

TIES process:
  1. Trim: Remove small updates (below threshold) — they are noise
  2. Elect sign: For each parameter, vote on whether it should
     increase or decrease. Majority wins.
  3. Merge: Average only the updates that agree with the elected sign

Result: Cleaner merge that preserves each model's strongest opinions.
```

```python
import torch

def ties_merge(task_vectors, density=0.5):
    merged = {}

    for key in task_vectors[0].keys():
        vectors = [tv[key] for tv in task_vectors]

        # Step 1: Trim — zero out small values
        trimmed = []
        for v in vectors:
            threshold = torch.quantile(v.abs().float(), 1 - density)
            mask = v.abs() >= threshold
            trimmed.append(v * mask)

        stacked = torch.stack(trimmed)

        # Step 2: Elect sign — majority vote
        signs = torch.sign(stacked)
        elected_sign = torch.sign(signs.sum(dim=0))

        # Step 3: Merge — average values that agree with elected sign
        for i in range(len(trimmed)):
            disagree_mask = torch.sign(trimmed[i]) != elected_sign
            trimmed[i][disagree_mask] = 0

        stacked = torch.stack(trimmed)
        nonzero_count = (stacked != 0).sum(dim=0).clamp(min=1)
        merged[key] = stacked.sum(dim=0) / nonzero_count

    return merged
```

### DARE (Drop And REscale)

A simpler approach: randomly drop most of the fine-tuning updates,
then rescale the remaining ones.

```
DARE process:
  1. For each fine-tuned model, randomly set (1-p) fraction of
     weight deltas to zero (p = keep probability, e.g., 0.1)
  2. Rescale remaining deltas by 1/p to maintain expected magnitude
  3. Average the sparsified models

Why this works:
  Fine-tuning changes are highly redundant. You can drop 90% of
  them and the model still works. The randomness means different
  models drop different parts, so the average recovers the signal.
```

```python
def dare_merge(task_vectors, keep_probability=0.1):
    merged = {}

    for key in task_vectors[0].keys():
        rescaled = []
        for tv in task_vectors:
            v = tv[key]
            mask = torch.bernoulli(
                torch.full_like(v, keep_probability)
            ).bool()
            sparse = v * mask / keep_probability  # rescale
            rescaled.append(sparse)

        merged[key] = torch.stack(rescaled).mean(dim=0)

    return merged
```

### Merging in Practice

```bash
# Using mergekit (the standard tool for model merging)
pip install mergekit

# config.yml
models:
  - model: code-finetuned-llama
    parameters:
      weight: 0.5
      density: 0.5
  - model: instruct-finetuned-llama
    parameters:
      weight: 0.3
      density: 0.5
  - model: math-finetuned-llama
    parameters:
      weight: 0.2
      density: 0.5

merge_method: ties
base_model: meta-llama/Llama-3-8B
dtype: bfloat16
```

```bash
mergekit-yaml config.yml ./merged-model --cuda
```

---

## Choosing the Right Method

```
Decision tree:

Do you have enough GPUs for full fine-tuning?
  ├── Yes: Do you need maximum quality?
  │    ├── Yes: Full fine-tuning
  │    └── No: LoRA (faster, easier, nearly as good)
  └── No: How much VRAM do you have?
       ├── 24-48 GB: LoRA (bf16 base for 7-8B models)
       ├── 12-24 GB: QLoRA (4-bit base + LoRA)
       └── <12 GB: QLoRA on smaller model, or prompt tuning

Do you need to serve many task-specific variants?
  ├── Yes: LoRA (swap adapters at serving time, ~25 MB each)
  └── No: Whatever gives best quality

Is your task simple (classification, extraction)?
  ├── Yes: Prompt tuning might be enough
  └── No: LoRA or full fine-tuning
```

---

## Key Takeaways

1. **LoRA is the default.** It gets 95% of full fine-tuning quality at
   1% of the parameter count. Start here.

2. **QLoRA enables fine-tuning on consumer hardware.** A 70B model
   fine-tuned on a single 48GB GPU is remarkable.

3. **DoRA is a free upgrade over LoRA.** Enable it with one flag for
   consistent 1-2% improvement.

4. **Model merging combines capabilities.** TIES and DARE let you merge
   a code model, a math model, and a chat model into one.

5. **LoRA adapters are small and swappable.** Serve one base model with
   many 25MB adapters for different tasks.

6. **Higher rank and more target modules improve quality.** When in
   doubt, increase rank and add FFN layers to targets.

---

## Exercises

1. **LoRA vs full fine-tune.** Fine-tune Llama 3 8B on the same
   dataset with full fine-tuning and LoRA (r=8, r=32, r=128). Compare
   quality, training time, and memory usage.

2. **QLoRA on a large model.** Fine-tune Llama 3 70B on a
   domain-specific dataset using QLoRA. Measure performance vs the
   base model.

3. **Model merging.** Fine-tune three separate LoRA adapters (code,
   math, conversation). Merge them using TIES and evaluate. Compare
   against a single adapter trained on all three datasets.
