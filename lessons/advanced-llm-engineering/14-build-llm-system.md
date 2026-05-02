# Lesson 14: Build a Complete LLM System — Capstone Project

This is the capstone. You will build every piece of an LLM pipeline
end-to-end: train a custom tokenizer, fine-tune a model with LoRA,
quantize it, serve it with vLLM, and build an evaluation pipeline. No
magic — just the skills from Lessons 01-13 applied to a real system.

Think of this as building a car from parts. Each lesson gave you a
component — engine, transmission, wheels, electronics. Now you bolt
them together and take it for a drive.

---

## Project Overview

```
Pipeline:

Raw Domain Data
      │
      ▼
[1] Custom Tokenizer ──── Train BPE on domain data
      │
      ▼
[2] LoRA Fine-tuning ──── Adapt a base model to your domain
      │
      ▼
[3] Quantization ──────── Compress for efficient serving
      │
      ▼
[4] Serving (vLLM) ────── Deploy with OpenAI-compatible API
      │
      ▼
[5] Evaluation ────────── Automated + LLM-judge pipeline
```

We will build a domain-specific assistant. Pick a domain you care
about — code, medical, legal, finance, science. The pipeline is the
same regardless.

For this walkthrough, we will build a **Python coding assistant** that
specializes in explaining and generating Python code with a focus on
data engineering (pandas, SQL, ETL patterns).

---

## Step 1: Custom Tokenizer

### Gather Domain Data

```python
import os
import json
from pathlib import Path

def collect_code_data(source_dirs, output_file):
    texts = []

    for source_dir in source_dirs:
        for path in Path(source_dir).rglob("*.py"):
            try:
                content = path.read_text(encoding="utf-8")
                if len(content) > 100 and len(content) < 100000:
                    texts.append(content)
            except (UnicodeDecodeError, PermissionError):
                continue

    with open(output_file, "w") as f:
        for text in texts:
            f.write(text + "\n\n")

    print(f"Collected {len(texts)} files, {os.path.getsize(output_file) / 1e6:.1f} MB")
    return output_file


domain_corpus = collect_code_data(
    source_dirs=[
        "./data/python-repos",
        "./data/pandas-examples",
        "./data/sql-tutorials",
    ],
    output_file="./data/domain_corpus.txt",
)
```

### Train the Tokenizer

```python
from tokenizers import Tokenizer, models, trainers, pre_tokenizers, decoders

def train_domain_tokenizer(corpus_file, vocab_size=32000, output_path="./tokenizer"):
    tokenizer = Tokenizer(models.BPE())

    tokenizer.pre_tokenizer = pre_tokenizers.Sequence([
        pre_tokenizers.Split(
            pattern=r"(?<=[a-z])(?=[A-Z])",
            behavior="isolated",
        ),
        pre_tokenizers.ByteLevel(add_prefix_space=False),
    ])

    trainer = trainers.BpeTrainer(
        vocab_size=vocab_size,
        special_tokens=[
            "<pad>", "<s>", "</s>", "<unk>",
            "<|user|>", "<|assistant|>", "<|system|>", "<|end|>",
        ],
        min_frequency=3,
        show_progress=True,
        initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
    )

    tokenizer.train([corpus_file], trainer)
    tokenizer.decoder = decoders.ByteLevel()

    os.makedirs(output_path, exist_ok=True)
    tokenizer.save(os.path.join(output_path, "tokenizer.json"))

    return tokenizer


tokenizer = train_domain_tokenizer("./data/domain_corpus.txt")
```

### Evaluate the Tokenizer

```python
def evaluate_tokenizer(tokenizer, test_texts, name):
    total_tokens = 0
    total_words = 0
    roundtrip_failures = 0

    for text in test_texts:
        encoded = tokenizer.encode(text)
        total_tokens += len(encoded.ids)
        total_words += len(text.split())

        decoded = tokenizer.decode(encoded.ids)
        if decoded != text:
            roundtrip_failures += 1

    fertility = total_tokens / total_words
    compression = sum(len(t) for t in test_texts) / total_tokens

    print(f"\n{name}:")
    print(f"  Fertility: {fertility:.2f} tokens/word")
    print(f"  Compression: {compression:.2f} chars/token")
    print(f"  Roundtrip failures: {roundtrip_failures}/{len(test_texts)}")


test_texts = [
    "import pandas as pd\ndf = pd.read_csv('data.csv')\ndf.groupby('category').agg({'revenue': 'sum'})",
    "SELECT customer_id, SUM(amount) FROM orders GROUP BY customer_id HAVING SUM(amount) > 1000",
    "def extract_transform_load(source_db, target_db, batch_size=1000):",
]

evaluate_tokenizer(tokenizer, test_texts, "Domain Tokenizer")
```

---

## Step 2: LoRA Fine-tuning

### Prepare Training Data

Format your domain data as instruction-response pairs.

```python
import json

def prepare_training_data(raw_data_path, output_path):
    training_examples = []

    with open(raw_data_path) as f:
        raw_data = json.load(f)

    for item in raw_data:
        example = {
            "messages": [
                {"role": "system", "content": "You are an expert Python data engineer. You write clean, efficient code and explain your reasoning clearly."},
                {"role": "user", "content": item["question"]},
                {"role": "assistant", "content": item["answer"]},
            ]
        }
        training_examples.append(example)

    with open(output_path, "w") as f:
        for ex in training_examples:
            f.write(json.dumps(ex) + "\n")

    print(f"Prepared {len(training_examples)} training examples")
    return output_path


prepare_training_data("./data/qa_pairs.json", "./data/train.jsonl")
```

### Fine-tune with LoRA

```python
import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    BitsAndBytesConfig,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training, TaskType
from trl import SFTTrainer
from datasets import load_dataset

BASE_MODEL = "meta-llama/Llama-3-8B-Instruct"

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    quantization_config=bnb_config,
    device_map="auto",
    torch_dtype=torch.bfloat16,
)
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
tokenizer.pad_token = tokenizer.eos_token

model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=32,
    lora_alpha=64,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
    use_dora=True,
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

dataset = load_dataset("json", data_files="./data/train.jsonl", split="train")

training_args = TrainingArguments(
    output_dir="./checkpoints",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.1,
    bf16=True,
    logging_steps=10,
    save_strategy="steps",
    save_steps=200,
    evaluation_strategy="steps",
    eval_steps=200,
    load_best_model_at_end=True,
    report_to="none",
    max_grad_norm=1.0,
)

def formatting_func(examples):
    outputs = []
    for messages in examples["messages"]:
        text = tokenizer.apply_chat_template(messages, tokenize=False)
        outputs.append(text)
    return outputs

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
    tokenizer=tokenizer,
    max_seq_length=2048,
    formatting_func=formatting_func,
)

trainer.train()

model.save_pretrained("./lora-adapter")
tokenizer.save_pretrained("./lora-adapter")
print("LoRA adapter saved.")
```

### Merge the Adapter (for easier serving)

```python
from peft import PeftModel

base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)

model = PeftModel.from_pretrained(base_model, "./lora-adapter")
merged_model = model.merge_and_unload()

merged_model.save_pretrained("./merged-model")
tokenizer.save_pretrained("./merged-model")
print("Merged model saved.")
```

---

## Step 3: Quantization

Quantize the merged model for efficient serving.

```python
from awq import AutoAWQForCausalLM
from transformers import AutoTokenizer

model = AutoAWQForCausalLM.from_pretrained("./merged-model", device_map="auto")
tokenizer = AutoTokenizer.from_pretrained("./merged-model")

quant_config = {
    "zero_point": True,
    "q_group_size": 128,
    "w_bit": 4,
    "version": "GEMM",
}

model.quantize(
    tokenizer,
    quant_config=quant_config,
    calib_data="pileval",
    calib_data_nsamples=256,
)

model.save_quantized("./quantized-model")
tokenizer.save_pretrained("./quantized-model")
print("Quantized model saved.")
```

### Verify Quantization Quality

```python
def quick_quality_check(model_path, test_prompts):
    from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

    model = AutoModelForCausalLM.from_pretrained(model_path, device_map="auto")
    tokenizer = AutoTokenizer.from_pretrained(model_path)

    pipe = pipeline("text-generation", model=model, tokenizer=tokenizer)

    for prompt in test_prompts:
        output = pipe(
            prompt,
            max_new_tokens=256,
            temperature=0.1,
            do_sample=True,
        )
        print(f"Prompt: {prompt[:80]}...")
        print(f"Output: {output[0]['generated_text'][len(prompt):200]}...")
        print("---")

test_prompts = [
    "Write a Python function that reads a CSV file with pandas and returns the top 10 rows by revenue:",
    "Explain how to implement a slowly changing dimension (SCD Type 2) in a data warehouse:",
    "Write a SQL query to find duplicate records in a customers table:",
]

print("=== Checking merged model ===")
quick_quality_check("./merged-model", test_prompts)

print("\n=== Checking quantized model ===")
quick_quality_check("./quantized-model", test_prompts)
```

---

## Step 4: Serving with vLLM

### Deploy the Model

```bash
python -m vllm.entrypoints.openai.api_server \
  --model ./quantized-model \
  --port 8000 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --enable-prefix-caching
```

### Test the API

```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="not-needed",
)

def query_model(prompt, system_prompt=None):
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model="./quantized-model",
        messages=messages,
        temperature=0.7,
        max_tokens=1024,
    )
    return response.choices[0].message.content


system = "You are an expert Python data engineer."
result = query_model(
    "Write a function to incrementally load data from a PostgreSQL table to S3 in parquet format.",
    system_prompt=system,
)
print(result)
```

### Streaming Response

```python
def stream_query(prompt, system_prompt=None):
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    stream = client.chat.completions.create(
        model="./quantized-model",
        messages=messages,
        temperature=0.7,
        max_tokens=1024,
        stream=True,
    )

    full_response = ""
    for chunk in stream:
        if chunk.choices[0].delta.content:
            content = chunk.choices[0].delta.content
            print(content, end="", flush=True)
            full_response += content

    print()
    return full_response
```

---

## Step 5: Evaluation Pipeline

### Build the Eval Suite

```python
import json
import time

class LLMEvalPipeline:
    def __init__(self, model_client, judge_client=None):
        self.model = model_client
        self.judge = judge_client
        self.results = []

    def add_test_suite(self, name, tests):
        self.test_suites = getattr(self, "test_suites", {})
        self.test_suites[name] = tests

    def run_accuracy_tests(self, suite_name):
        tests = self.test_suites[suite_name]
        passed = 0

        for test in tests:
            response = query_model(test["prompt"])
            matches = any(
                expected.lower() in response.lower()
                for expected in test["expected_contains"]
            )
            passed += int(matches)
            self.results.append({
                "suite": suite_name,
                "prompt": test["prompt"],
                "response": response[:500],
                "passed": matches,
                "type": "accuracy",
            })

        rate = passed / len(tests)
        print(f"{suite_name}: {passed}/{len(tests)} = {rate:.1%}")
        return rate

    def run_quality_tests(self, suite_name):
        tests = self.test_suites[suite_name]
        scores = []

        for test in tests:
            response = query_model(test["prompt"])
            score = self.judge_quality(test["prompt"], response)
            scores.append(score)
            self.results.append({
                "suite": suite_name,
                "prompt": test["prompt"],
                "response": response[:500],
                "score": score,
                "type": "quality",
            })

        avg = sum(scores) / len(scores)
        print(f"{suite_name} quality: {avg:.1f}/10")
        return avg

    def judge_quality(self, prompt, response):
        judge_prompt = f"""Rate this response 1-10.

Prompt: {prompt}

Response: {response}

Criteria: accuracy, helpfulness, code quality (if code), clarity.
Output only a number 1-10."""

        if self.judge:
            result = self.judge.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": judge_prompt}],
                temperature=0,
                max_tokens=5,
            )
            try:
                return int(result.choices[0].message.content.strip())
            except ValueError:
                return 5
        return 5  # fallback if no judge

    def run_latency_tests(self, prompts, num_runs=10):
        ttft_times = []
        total_times = []

        for prompt in prompts[:num_runs]:
            start = time.time()
            first_token_time = None

            stream = self.model.chat.completions.create(
                model="./quantized-model",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=256,
                stream=True,
            )

            token_count = 0
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    if first_token_time is None:
                        first_token_time = time.time()
                    token_count += 1

            end = time.time()

            if first_token_time:
                ttft_times.append(first_token_time - start)
                total_times.append(end - start)

        avg_ttft = sum(ttft_times) / len(ttft_times)
        avg_total = sum(total_times) / len(total_times)
        print(f"TTFT: {avg_ttft*1000:.0f}ms avg")
        print(f"Total: {avg_total*1000:.0f}ms avg")
        return {"ttft_ms": avg_ttft * 1000, "total_ms": avg_total * 1000}

    def generate_report(self, output_path="eval_report.json"):
        report = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "total_tests": len(self.results),
            "accuracy_tests": [r for r in self.results if r["type"] == "accuracy"],
            "quality_tests": [r for r in self.results if r["type"] == "quality"],
        }

        accuracy_results = [r for r in self.results if r["type"] == "accuracy"]
        if accuracy_results:
            report["accuracy_rate"] = sum(
                r["passed"] for r in accuracy_results
            ) / len(accuracy_results)

        quality_results = [r for r in self.results if r["type"] == "quality"]
        if quality_results:
            report["avg_quality_score"] = sum(
                r["score"] for r in quality_results
            ) / len(quality_results)

        with open(output_path, "w") as f:
            json.dump(report, f, indent=2)

        print(f"\nReport saved to {output_path}")
        return report
```

### Run the Full Eval

```python
import openai

model_client = openai.OpenAI(base_url="http://localhost:8000/v1", api_key="x")
judge_client = openai.OpenAI()  # uses OPENAI_API_KEY env var

pipeline = LLMEvalPipeline(model_client, judge_client)

pipeline.add_test_suite("pandas_accuracy", [
    {
        "prompt": "How do you read a CSV file with pandas?",
        "expected_contains": ["pd.read_csv", "pandas"],
    },
    {
        "prompt": "How do you group by a column and aggregate in pandas?",
        "expected_contains": ["groupby", "agg"],
    },
    {
        "prompt": "How do you merge two DataFrames on a common column?",
        "expected_contains": ["merge", "pd.merge"],
    },
    {
        "prompt": "How do you handle missing values in a DataFrame?",
        "expected_contains": ["fillna", "dropna", "isna"],
    },
])

pipeline.add_test_suite("sql_accuracy", [
    {
        "prompt": "Write a SQL query to find the top 5 customers by total spend.",
        "expected_contains": ["SELECT", "ORDER BY", "LIMIT"],
    },
    {
        "prompt": "Explain the difference between INNER JOIN and LEFT JOIN.",
        "expected_contains": ["INNER", "LEFT", "NULL"],
    },
])

pipeline.add_test_suite("code_quality", [
    {"prompt": "Write a Python ETL function that extracts data from a REST API, transforms it, and loads it into PostgreSQL."},
    {"prompt": "Write a data validation function that checks a DataFrame for missing values, type mismatches, and range violations."},
    {"prompt": "Explain how to optimize a slow pandas operation that processes 10 million rows."},
])

print("=== Accuracy Tests ===")
pipeline.run_accuracy_tests("pandas_accuracy")
pipeline.run_accuracy_tests("sql_accuracy")

print("\n=== Quality Tests ===")
pipeline.run_quality_tests("code_quality")

print("\n=== Latency Tests ===")
test_prompts = [
    "Write a Python function to deduplicate records in a DataFrame.",
    "Explain window functions in SQL with examples.",
    "How do you implement incremental data loading?",
]
pipeline.run_latency_tests(test_prompts)

report = pipeline.generate_report()
```

---

## Step 6: Iterate

The first version will not be perfect. Use eval results to improve.

```
Iteration cycle:

1. Run eval pipeline → identify weaknesses
2. Collect more training data targeting weak areas
3. Re-train LoRA adapter (or merge with existing)
4. Re-quantize
5. Re-deploy
6. Re-evaluate
7. Repeat until quality targets are met

Common issues and fixes:

Issue                       Fix
──────────────────────────────────────────────────────
Poor code quality           Add more high-quality code examples to training
Hallucinated APIs           Add negative examples ("this API does not exist")
Verbose responses           Add concise examples to training data
Won't say "I don't know"    Add examples where the correct answer is uncertainty
Format inconsistency        Standardize output format in training data
```

---

## Project Architecture Summary

```
Directory structure:

project/
├── data/
│   ├── domain_corpus.txt       # raw text for tokenizer training
│   ├── qa_pairs.json           # instruction-response pairs
│   └── train.jsonl             # formatted training data
├── tokenizer/
│   └── tokenizer.json          # custom BPE tokenizer
├── lora-adapter/
│   ├── adapter_config.json     # LoRA configuration
│   └── adapter_model.safetensors  # LoRA weights (~50 MB)
├── merged-model/
│   ├── model.safetensors       # full merged weights
│   └── tokenizer files
├── quantized-model/
│   ├── model.safetensors       # AWQ 4-bit weights
│   └── quantize_config.json
├── eval/
│   ├── eval_pipeline.py        # evaluation code
│   ├── test_suites.json        # test cases
│   └── eval_report.json        # results
└── serve/
    └── run_server.sh           # vLLM launch script
```

---

## Key Takeaways

1. **The pipeline is straightforward.** Tokenizer, fine-tune, quantize,
   serve, evaluate. Each step is well-supported by existing tools.

2. **Data quality drives everything.** Invest most of your time in
   preparing good training data and thorough evaluation.

3. **QLoRA makes this accessible.** Fine-tuning a 70B model on a
   single GPU is real. You do not need a cluster.

4. **Evaluation must be automated.** Build the pipeline once, run it
   every time you change the model. Catch regressions early.

5. **Iteration is the game.** The first version will be mediocre.
   Identify weaknesses, add targeted training data, and re-train.
   Three iterations usually gets you to production quality.

6. **Quantization is nearly free.** AWQ 4-bit gives you 4x memory
   savings with <1% quality loss. Always quantize for serving.

---

## Extension Ideas

Once the basic pipeline works, extend it:

- **Multi-turn conversation:** Train on dialogue data, evaluate
  conversation quality
- **RAG integration:** Add retrieval from documentation
- **Streaming metrics:** Monitor quality in production with sampled
  LLM-judge scoring
- **A/B testing:** Serve two model versions and compare user engagement
- **Model merging:** Merge your domain adapter with a general
  instruction-following adapter using TIES
- **Speculative decoding:** Add a small draft model for 2-3x latency
  improvement
