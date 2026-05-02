# 12 - LoRA & QLoRA

Fine-tuning a full model is like renovating an entire house
when you only need to repaint one room. LoRA lets you make
small, targeted modifications without touching the whole model.

---

## The Problem with Full Fine-Tuning

```
Full fine-tuning a 7B model:
  - Update ALL 7 billion parameters
  - Need 28+ GB GPU memory (FP32)
  - Slow training
  - Creates a full copy of the model

             7B parameters
         +------------------+
         |##################|  <-- ALL modified
         |##################|      28GB+ GPU needed
         |##################|
         +------------------+

LoRA fine-tuning a 7B model:
  - Freeze original 7B parameters
  - Add ~0.1% new trainable parameters
  - Need 6-8 GB GPU memory
  - Creates a tiny adapter file

             7B parameters (frozen)
         +------------------+
         |                  |  <-- Untouched
         |   +--+   +--+   |
         |   |LA|   |LA|   |  <-- Small adapters (~7M params)
         |   +--+   +--+   |      6GB GPU is enough
         +------------------+
```

---

## How LoRA Works

Think of it like this: instead of rewriting a whole textbook,
you add sticky notes with corrections. The original book
stays intact. The sticky notes are tiny but targeted.

```
Original weight matrix W (4096 x 4096 = 16M params):

+------------------------------------------+
|                                          |
|              W (frozen)                  |
|              16M params                  |
|                                          |
+------------------------------------------+

LoRA adds two small matrices A and B:

W_new = W + B * A

Where:
  A is 4096 x 8  (32K params)  <-- "Down project"
  B is 8 x 4096  (32K params)  <-- "Up project"
  Total: 64K params instead of 16M

  That's 0.4% of the original!

+------------------------------------------+
|                                          |
|              W (frozen)                  |
|                                          |
+-----+    +--+    +--+    +--------------+
      |--->| A|--->| B|--->|  (added back)
      |    +--+    +--+    |
+-----+--------------------+--------------+

The rank 'r' (8 in this example) controls
how much the adapter can learn.
  r=4:   Very small, less expressive
  r=8:   Good default
  r=16:  More capacity
  r=64:  Almost like full fine-tuning
```

---

## QLoRA: Even Cheaper

QLoRA = Quantized LoRA. Shrink the base model to 4-bit
precision, THEN add LoRA adapters. Like photocopying the
textbook at low quality (saves paper) and adding high-quality
sticky notes.

```
Model memory comparison:

Full FP32:     7B x 4 bytes = 28 GB
Full FP16:     7B x 2 bytes = 14 GB
QLoRA (4-bit): 7B x 0.5 bytes = 3.5 GB + adapters

+------------------+---------+------------------+
| Method           | GPU RAM | Can Run On       |
+------------------+---------+------------------+
| Full fine-tune   | 28+ GB  | A100 80GB        |
| LoRA (FP16)      | 14+ GB  | RTX 4090         |
| QLoRA (4-bit)    | 6-8 GB  | RTX 3060, T4     |
| QLoRA (tiny)     | 4-5 GB  | Free Colab GPU   |
+------------------+---------+------------------+
```

---

## LoRA with Hugging Face PEFT

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model, TaskType
import torch

model_name = "meta-llama/Llama-3.2-1B"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,
    device_map="auto",
)

lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=8,
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules=["q_proj", "v_proj"],
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
```

---

## QLoRA Setup

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
import torch

model_name = "meta-llama/Llama-3.2-1B"

quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=quantization_config,
    device_map="auto",
)

model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    bias="none",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
```

---

## Training Loop

```python
from transformers import TrainingArguments, Trainer
from datasets import load_dataset

dataset = load_dataset("json", data_files="training_data.jsonl")

tokenizer.pad_token = tokenizer.eos_token


def tokenize(example):
    text = f"### Input:\n{example['input']}\n\n### Output:\n{example['output']}"
    tokens = tokenizer(
        text,
        truncation=True,
        max_length=512,
        padding="max_length",
    )
    tokens["labels"] = tokens["input_ids"].copy()
    return tokens


tokenized = dataset["train"].map(tokenize, remove_columns=dataset["train"].column_names)

training_args = TrainingArguments(
    output_dir="./lora_output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    warmup_steps=100,
    logging_steps=25,
    save_strategy="epoch",
    fp16=True,
    optim="paged_adamw_8bit",
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized,
)

trainer.train()

model.save_pretrained("./lora_adapter")
tokenizer.save_pretrained("./lora_adapter")
```

---

## Loading and Using the Adapter

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import torch

base_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-1B",
    torch_dtype=torch.float16,
    device_map="auto",
)

model = PeftModel.from_pretrained(base_model, "./lora_adapter")
tokenizer = AutoTokenizer.from_pretrained("./lora_adapter")

prompt = "### Input:\nClassify this review: Great product!\n\n### Output:\n"
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

with torch.no_grad():
    outputs = model.generate(
        **inputs,
        max_new_tokens=50,
        temperature=0.1,
    )

print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

---

## Hyperparameter Guide

```
+------------------+----------+-----------------------------------+
| Parameter        | Default  | Notes                             |
+------------------+----------+-----------------------------------+
| r (rank)         | 8        | Higher = more capacity, more RAM  |
|                  |          | Start with 8, increase if needed  |
+------------------+----------+-----------------------------------+
| lora_alpha       | 16-32    | Scaling factor. Rule of thumb:    |
|                  |          | alpha = 2 * r                     |
+------------------+----------+-----------------------------------+
| lora_dropout     | 0.05     | Regularization. Increase if       |
|                  |          | overfitting                       |
+------------------+----------+-----------------------------------+
| target_modules   | q,v      | Which layers to adapt.            |
|                  |          | More modules = more capacity      |
+------------------+----------+-----------------------------------+
| learning_rate    | 2e-4     | Higher than full fine-tuning      |
|                  |          | because fewer params              |
+------------------+----------+-----------------------------------+
| epochs           | 3-5      | Monitor eval loss for overfitting |
+------------------+----------+-----------------------------------+

Rank selection:
  r=4:    Simple tasks (classification, yes/no)
  r=8:    Most tasks (good default)
  r=16:   Complex tasks (code gen, reasoning)
  r=32+:  Very complex / large style changes
```

---

## Adapter Merging

Ship one model instead of base + adapter.

```python
from transformers import AutoModelForCausalLM
from peft import PeftModel

base = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-1B")
model = PeftModel.from_pretrained(base, "./lora_adapter")

merged = model.merge_and_unload()
merged.save_pretrained("./merged_model")
```

---

## Exercises

**Exercise 1: LoRA Config Explorer**
Write a script that tries different LoRA configs (r=4,8,16;
alpha=16,32; targets=q_proj vs all) on a small dataset.
Log trainable params, training time, and eval loss for each.

**Exercise 2: QLoRA on Free GPU**
Fine-tune a 1B model on Google Colab (free tier) using
QLoRA. Use a small dataset (100-500 examples). Measure:
before vs after accuracy on 20 test cases.

**Exercise 3: Adapter Hot-Swap**
Train 2 different LoRA adapters (e.g., formal style and
casual style). Build a system that loads the base model
once and swaps adapters based on user preference.

**Exercise 4: Training Monitor**
Build a training script with Weights & Biases logging
that tracks: loss curve, learning rate, GPU memory usage,
and eval metrics per epoch. Save the best adapter checkpoint.

---

Next: [13 - Dataset Preparation](13-dataset-preparation.md)
