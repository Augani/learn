# 14 - Fine-Tuning in Practice

Theory is over. Time to actually fine-tune models. We'll
cover three paths: Hugging Face (full control), Axolotl
(config-driven), and OpenAI API (managed). Pick the one
that fits your situation.

---

## Choose Your Path

```
+------------------+-----------+-----------+-----------+
|                  | HF/PEFT   | Axolotl   | OpenAI    |
+------------------+-----------+-----------+-----------+
| Control          | Full      | Medium    | Low       |
| Setup effort     | High      | Medium    | None      |
| GPU needed       | Yes       | Yes       | No        |
| Cost             | GPU time  | GPU time  | Per token |
| Best for         | Research  | Production| Quick wins|
+------------------+-----------+-----------+-----------+

Need full control? -------> Hugging Face + PEFT
Want config-driven? ------> Axolotl
No GPU / want easy? ------> OpenAI API
```

---

## Path 1: Hugging Face + PEFT

Full control. You manage everything.

```python
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    BitsAndBytesConfig,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer
from datasets import load_dataset
import torch

model_name = "meta-llama/Llama-3.2-1B"

quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
)

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=quantization_config,
    device_map="auto",
)

tokenizer = AutoTokenizer.from_pretrained(model_name)
tokenizer.pad_token = tokenizer.eos_token

model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

dataset = load_dataset("json", data_files={
    "train": "train.jsonl",
    "validation": "val.jsonl",
})


def format_example(example):
    messages = example.get("messages", [])
    text = ""
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        text += f"<|{role}|>\n{content}\n"
    text += "<|end|>"
    return {"text": text}


dataset = dataset.map(format_example)

training_args = TrainingArguments(
    output_dir="./ft_output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    warmup_ratio=0.1,
    logging_steps=10,
    eval_strategy="steps",
    eval_steps=50,
    save_strategy="steps",
    save_steps=50,
    load_best_model_at_end=True,
    fp16=True,
    optim="paged_adamw_8bit",
    report_to="none",
)

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    dataset_text_field="text",
    max_seq_length=512,
    tokenizer=tokenizer,
)

trainer.train()
trainer.save_model("./final_adapter")
```

---

## Path 2: Axolotl (Config-Driven)

Write a YAML config, Axolotl handles the rest. Like using
a recipe instead of cooking from scratch.

```yaml
base_model: meta-llama/Llama-3.2-1B
model_type: LlamaForCausalLM

load_in_4bit: true
adapter: qlora
lora_r: 16
lora_alpha: 32
lora_dropout: 0.05
lora_target_modules:
  - q_proj
  - k_proj
  - v_proj
  - o_proj

datasets:
  - path: training_data.jsonl
    type: sharegpt

sequence_len: 512
sample_packing: true

num_epochs: 3
micro_batch_size: 4
gradient_accumulation_steps: 4
learning_rate: 0.0002
optimizer: paged_adamw_8bit
lr_scheduler: cosine
warmup_ratio: 0.1

output_dir: ./axolotl_output
logging_steps: 10
eval_steps: 50
save_strategy: steps
save_steps: 50
```

```bash
# Install and run
pip install axolotl
accelerate launch -m axolotl.cli.train config.yaml
```

---

## Path 3: OpenAI Fine-Tuning API

No GPU needed. Upload data, click go.

```python
from openai import OpenAI
import json
import time

client = OpenAI()


def prepare_openai_data(input_file: str, output_file: str):
    with open(input_file) as f:
        data = [json.loads(line) for line in f if line.strip()]

    with open(output_file, "w") as f:
        for item in data:
            formatted = {
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a sentiment classifier. Output JSON.",
                    },
                    {"role": "user", "content": item["input"]},
                    {"role": "assistant", "content": item["output"]},
                ]
            }
            f.write(json.dumps(formatted) + "\n")


prepare_openai_data("training_data.jsonl", "openai_train.jsonl")

training_file = client.files.create(
    file=open("openai_train.jsonl", "rb"),
    purpose="fine-tune",
)

job = client.fine_tuning.jobs.create(
    training_file=training_file.id,
    model="gpt-4o-mini-2024-07-18",
    hyperparameters={
        "n_epochs": 3,
        "batch_size": "auto",
        "learning_rate_multiplier": "auto",
    },
)

print(f"Job ID: {job.id}")

while True:
    status = client.fine_tuning.jobs.retrieve(job.id)
    print(f"Status: {status.status}")
    if status.status in ("succeeded", "failed", "cancelled"):
        break
    time.sleep(30)

if status.status == "succeeded":
    model_id = status.fine_tuned_model
    print(f"Fine-tuned model: {model_id}")

    response = client.chat.completions.create(
        model=model_id,
        messages=[
            {"role": "system", "content": "You are a sentiment classifier."},
            {"role": "user", "content": "This product changed my life!"},
        ],
    )
    print(response.choices[0].message.content)
```

---

## Evaluation After Fine-Tuning

Always compare before and after.

```python
from openai import OpenAI
import json

client = OpenAI()


def evaluate_model(model: str, test_cases: list[dict]) -> dict:
    correct = 0
    results = []

    for case in test_cases:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a sentiment classifier. Output JSON."},
                {"role": "user", "content": case["input"]},
            ],
        )

        output = response.choices[0].message.content.strip()

        try:
            predicted = json.loads(output)
            expected = json.loads(case["output"])
            match = predicted.get("sentiment") == expected.get("sentiment")
        except json.JSONDecodeError:
            match = False

        if match:
            correct += 1

        results.append({
            "input": case["input"][:50],
            "expected": case["output"],
            "actual": output,
            "correct": match,
        })

    accuracy = correct / len(test_cases) if test_cases else 0
    return {"accuracy": accuracy, "results": results}


test_data = load_jsonl("test.jsonl")

print("Base model:")
base_results = evaluate_model("gpt-4o-mini", test_data)
print(f"  Accuracy: {base_results['accuracy']:.2%}")

print("\nFine-tuned model:")
ft_results = evaluate_model("ft:gpt-4o-mini:my-org::abc123", test_data)
print(f"  Accuracy: {ft_results['accuracy']:.2%}")

improvement = ft_results["accuracy"] - base_results["accuracy"]
print(f"\nImprovement: {improvement:+.2%}")
```

---

## Training Monitoring

```
Watch these during training:

Training loss:
  Epoch 1: ████████████████  2.45
  Epoch 2: ██████████        1.32
  Epoch 3: ████████          0.89   <-- Good: decreasing

Validation loss:
  Epoch 1: ████████████████  2.51
  Epoch 2: ██████████        1.45
  Epoch 3: ██████████████    1.62   <-- BAD: increasing!
                                        = OVERFITTING

The gap between train and val loss tells you:
  Small gap:  Learning well
  Big gap:    Overfitting (memorizing, not generalizing)
  Both high:  Underfitting (needs more capacity or data)
```

---

## Common Problems and Fixes

```
+-------------------+------------------------------------+
| Problem           | Fix                                |
+-------------------+------------------------------------+
| Loss not dropping | Increase learning rate             |
|                   | Check data format                  |
+-------------------+------------------------------------+
| Overfitting       | Add more data                      |
|                   | Increase dropout                   |
|                   | Reduce epochs                      |
|                   | Lower rank (r)                     |
+-------------------+------------------------------------+
| Outputs garbled   | Check tokenizer / chat template    |
|                   | Verify data format matches model   |
+-------------------+------------------------------------+
| OOM errors        | Reduce batch size                  |
|                   | Use gradient accumulation          |
|                   | Use QLoRA instead of LoRA          |
+-------------------+------------------------------------+
| Catastrophic      | Lower learning rate                |
| forgetting        | Fewer epochs                       |
|                   | Mix in general instruction data    |
+-------------------+------------------------------------+
```

---

## Exercises

**Exercise 1: Fine-Tune a Classifier**
Prepare 200 labeled examples (use synthetic data from
Lesson 13 if needed). Fine-tune using any of the three
paths. Measure accuracy before and after on 50 test cases.

**Exercise 2: Hyperparameter Sweep**
Train 4 models with different settings: (r=8, epochs=2),
(r=8, epochs=5), (r=16, epochs=2), (r=16, epochs=5).
Compare eval loss and test accuracy. Which combo wins?

**Exercise 3: A/B Test Models**
Fine-tune a model for a specific task. Run 30 test cases
through both the base model and fine-tuned model. Build
a comparison table with accuracy, format compliance, and
average latency.

**Exercise 4: Full Pipeline**
End-to-end: collect data, clean it, validate it, split it,
fine-tune a model, evaluate it, and write a short report
with metrics. This is what a real fine-tuning project looks
like.

---

Next: [15 - AI Agents](15-ai-agents.md)
