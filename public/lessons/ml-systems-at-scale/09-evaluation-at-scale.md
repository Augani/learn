# Lesson 09: Evaluation at Scale

> **Analogy**: Grading a PhD candidate. You don't give them one
> multiple-choice quiz and declare them qualified. You test
> breadth (coursework), depth (thesis defense), practical skills
> (teaching), and novel contribution (publications). Evaluating
> large language models is the same -- a single benchmark tells
> you almost nothing. You need a comprehensive evaluation suite
> that tests different capabilities, and you need statistical
> rigor to know whether improvements are real or noise.

---

## Why Evaluation Gets Harder at Scale

```
Small model evaluation:
  Run MNIST test set: 99.2% accuracy. Done.
  Time: 30 seconds. Cost: $0.

Large model evaluation:
  Run 15 benchmarks across 57 tasks:
    MMLU (57 subjects), HumanEval (164 problems),
    HellaSwag, ARC, TruthfulQA, GSM8K, MATH,
    BBH (23 tasks), WinoGrande, PIQA, BoolQ,
    DROP, LAMBADA, NaturalQuestions, TriviaQA

  Time: 4-12 hours per checkpoint on 8 GPUs
  Cost: $50-200 per evaluation run

  During training, you want to eval every 5K steps.
  100K step run = 20 eval points = $1,000-4,000 just for evals.
```

---

## Major Benchmark Suites

```
+------------------+--------+------+----------------------------+
| Benchmark        | Tasks  | Type | What It Tests              |
+------------------+--------+------+----------------------------+
| MMLU             | 57     | MCQ  | World knowledge across     |
|                  |        |      | subjects (STEM to law)     |
+------------------+--------+------+----------------------------+
| HumanEval        | 164    | Code | Python function generation |
+------------------+--------+------+----------------------------+
| MBPP             | 974    | Code | Simpler Python problems    |
+------------------+--------+------+----------------------------+
| HellaSwag        | 10K    | MCQ  | Common sense reasoning     |
+------------------+--------+------+----------------------------+
| ARC              | 7.7K   | MCQ  | Grade-school science       |
+------------------+--------+------+----------------------------+
| GSM8K            | 1.3K   | Math | Grade-school math (chain   |
|                  |        |      | of thought)                |
+------------------+--------+------+----------------------------+
| MATH             | 5K     | Math | Competition math           |
+------------------+--------+------+----------------------------+
| TruthfulQA       | 817    | MCQ  | Factuality and avoiding    |
|                  |        |      | common misconceptions      |
+------------------+--------+------+----------------------------+
| WinoGrande       | 1.7K   | MCQ  | Coreference resolution     |
+------------------+--------+------+----------------------------+
| BBH              | 6.5K   | Mix  | 23 hard BIG-Bench tasks    |
+------------------+--------+------+----------------------------+
| DROP             | 9.5K   | QA   | Discrete reasoning over    |
|                  |        |      | paragraphs                 |
+------------------+--------+------+----------------------------+
```

### MMLU: The Standard Knowledge Test

MMLU (Massive Multitask Language Understanding) tests across
57 academic subjects. It's the most commonly reported benchmark.

```
MMLU format (5-shot):
  Context: 5 example question-answer pairs
  Question: "What is the primary function of mitochondria?"
  Choices: (A) DNA replication (B) Energy production
           (C) Protein synthesis (D) Cell division
  Answer: B

Evaluation: measure accuracy across all 57 subjects.

Typical scores (0-shot / 5-shot):
  GPT-4:          86% / 87%
  LLaMA 70B:      63% / 69%
  LLaMA 13B:      47% / 55%
  LLaMA 7B:       35% / 47%
  Random:          25% (4-way MCQ)
```

### HumanEval: Code Generation

```
HumanEval format:
  Given: function signature + docstring
  Task: generate the function body
  Evaluation: run against unit tests (pass@k)

  pass@1: probability of generating a correct solution in 1 try
  pass@10: probability in 10 tries (at least 1 correct)
  pass@100: probability in 100 tries

  Computing pass@k:
  Generate n >= k samples per problem.
  For each problem, count c correct out of n.
  pass@k = 1 - C(n-c, k) / C(n, k)
```

```python
import numpy as np
from collections import defaultdict

def estimate_pass_at_k(num_samples, num_correct, k):
    if num_correct >= num_samples:
        return 1.0

    return 1.0 - np.prod(
        1.0 - k / np.arange(num_samples - num_correct + 1, num_samples + 1)
    )

def compute_pass_at_k(results, k_values=[1, 10, 100]):
    metrics = {}
    for k in k_values:
        scores = []
        for problem_id, outcomes in results.items():
            n = len(outcomes)
            c = sum(outcomes)
            if n >= k:
                scores.append(estimate_pass_at_k(n, c, k))
        metrics[f"pass@{k}"] = np.mean(scores)
    return metrics
```

---

## Evaluation Harnesses

Don't build evaluation from scratch. Use established frameworks.

### lm-evaluation-harness (EleutherAI)

The de facto standard for LLM evaluation:

```bash
pip install lm-eval

lm_eval --model hf \
  --model_args pretrained=meta-llama/Llama-2-7b-hf \
  --tasks mmlu,hellaswag,arc_challenge,winogrande,truthfulqa_mc2 \
  --batch_size 16 \
  --num_fewshot 5 \
  --device cuda \
  --output_path results/llama-7b/
```

### Running Evaluation During Training

```python
import subprocess
import json
import os

def run_evaluation(checkpoint_path, step, eval_tasks, output_dir):
    result_path = os.path.join(output_dir, f"eval_step_{step}")

    cmd = [
        "lm_eval",
        "--model", "hf",
        "--model_args", f"pretrained={checkpoint_path}",
        "--tasks", ",".join(eval_tasks),
        "--batch_size", "auto",
        "--num_fewshot", "5",
        "--device", "cuda",
        "--output_path", result_path,
    ]

    subprocess.run(cmd, check=True)

    results_file = os.path.join(result_path, "results.json")
    with open(results_file) as f:
        results = json.load(f)

    return results

EVAL_TASKS = [
    "mmlu", "hellaswag", "arc_challenge",
    "winogrande", "gsm8k", "truthfulqa_mc2",
]

EVAL_EVERY_N_STEPS = 5000

for step in range(total_steps):
    train_step(...)

    if step > 0 and step % EVAL_EVERY_N_STEPS == 0:
        save_checkpoint(f"checkpoints/step_{step}")
        results = run_evaluation(
            f"checkpoints/step_{step}",
            step,
            EVAL_TASKS,
            "eval_results/"
        )
        log_eval_results(results, step)
```

### Custom Evaluation Tasks

Sometimes standard benchmarks don't test what you care about.
lm-evaluation-harness supports custom tasks:

```yaml
task: my_domain_qa
dataset_path: my_org/domain_qa_dataset
dataset_name: null
output_type: multiple_choice
training_split: train
validation_split: test
test_split: null
doc_to_text: "Question: {{question}}\nAnswer:"
doc_to_target: "{{answer}}"
doc_to_choice: ["A", "B", "C", "D"]
metric_list:
  - metric: acc
    aggregation: mean
    higher_is_better: true
  - metric: acc_norm
    aggregation: mean
    higher_is_better: true
num_fewshot: 5
```

---

## Statistical Significance

A 0.5% improvement on MMLU might be noise. You need statistical
tests to tell the difference.

### The Problem

```
Model A on MMLU: 68.3%
Model B on MMLU: 68.8%

Is B better? Maybe. Or maybe:
- B got lucky on the specific questions
- The 57 subjects have different difficulties
- Random seed for few-shot examples matters

With 14,042 questions, binomial standard error:
  SE = sqrt(p * (1-p) / n)
  SE = sqrt(0.68 * 0.32 / 14042) = 0.0039 = 0.39%

  95% CI for Model A: 68.3% ± 0.78%  = [67.5%, 69.1%]
  95% CI for Model B: 68.8% ± 0.78%  = [68.0%, 69.6%]

  Overlapping CIs -> difference may not be significant!
```

### Bootstrap Confidence Intervals

```python
import numpy as np

def bootstrap_accuracy_ci(predictions, labels, n_bootstrap=10000, ci=0.95):
    n_samples = len(predictions)
    correct = (np.array(predictions) == np.array(labels)).astype(float)
    observed_acc = correct.mean()

    bootstrap_accs = []
    for _ in range(n_bootstrap):
        indices = np.random.choice(n_samples, size=n_samples, replace=True)
        bootstrap_accs.append(correct[indices].mean())

    bootstrap_accs = np.array(bootstrap_accs)
    lower = np.percentile(bootstrap_accs, (1 - ci) / 2 * 100)
    upper = np.percentile(bootstrap_accs, (1 + ci) / 2 * 100)

    return {
        'accuracy': observed_acc,
        'ci_lower': lower,
        'ci_upper': upper,
        'std': bootstrap_accs.std(),
    }

def paired_bootstrap_test(preds_a, preds_b, labels, n_bootstrap=10000):
    correct_a = (np.array(preds_a) == np.array(labels)).astype(float)
    correct_b = (np.array(preds_b) == np.array(labels)).astype(float)
    n_samples = len(labels)

    observed_diff = correct_b.mean() - correct_a.mean()

    diff_boots = []
    for _ in range(n_bootstrap):
        indices = np.random.choice(n_samples, size=n_samples, replace=True)
        diff = correct_b[indices].mean() - correct_a[indices].mean()
        diff_boots.append(diff)

    diff_boots = np.array(diff_boots)
    p_value = (diff_boots <= 0).mean()

    return {
        'observed_diff': observed_diff,
        'p_value': p_value,
        'significant_at_005': p_value < 0.05,
        'ci_lower': np.percentile(diff_boots, 2.5),
        'ci_upper': np.percentile(diff_boots, 97.5),
    }
```

### Multiple Comparisons Problem

If you test on 15 benchmarks and use p < 0.05 as your threshold,
you'd expect ~0.75 false positives even with no real improvement.

```
Bonferroni correction:
  15 benchmarks, desired overall significance: 0.05
  Per-benchmark threshold: 0.05 / 15 = 0.0033

  Much stricter, but controls false positive rate.

Alternatively, report ALL benchmark results.
  Don't cherry-pick the ones where your model wins.
```

---

## Multi-Task Evaluation Strategy

### The Evaluation Matrix

```
             Knowledge  Reasoning  Code  Math  Safety  Speed
             ---------  ---------  ----  ----  ------  -----
Checkpoint 1    65%        72%      28%   15%    85%    100
Checkpoint 2    67%        73%      30%   17%    84%    100
Checkpoint 3    68%        71%      35%   20%    83%    100  ← safety dip
Checkpoint 4    69%        74%      38%   22%    85%    100

Questions:
- Did safety really dip at checkpoint 3, or is it noise?
- Is the math improvement worth the temporary reasoning plateau?
- At what point is the model "good enough" to ship?
```

### Aggregate Scoring

```python
def compute_aggregate_score(results, weights=None):
    if weights is None:
        weights = {task: 1.0 for task in results}

    total_weight = sum(weights.values())
    normalized_weights = {k: v / total_weight for k, v in weights.items()}

    weighted_sum = sum(
        results[task] * normalized_weights.get(task, 0)
        for task in results
        if task in normalized_weights
    )

    return weighted_sum

weights = {
    'mmlu': 2.0,
    'humaneval': 2.0,
    'gsm8k': 1.5,
    'hellaswag': 1.0,
    'arc_challenge': 1.0,
    'winogrande': 0.5,
    'truthfulqa': 1.5,
}

aggregate = compute_aggregate_score(checkpoint_results, weights)
```

---

## Evaluation Infrastructure

### Parallel Evaluation Across GPUs

```python
import torch.multiprocessing as mp

def eval_task_on_gpu(task_name, model_path, gpu_id, results_queue):
    import torch
    torch.cuda.set_device(gpu_id)

    from lm_eval import evaluator
    results = evaluator.simple_evaluate(
        model="hf",
        model_args=f"pretrained={model_path},device=cuda:{gpu_id}",
        tasks=[task_name],
        batch_size="auto",
    )

    results_queue.put((task_name, results['results']))

def parallel_evaluation(model_path, tasks, num_gpus=8):
    results_queue = mp.Queue()
    processes = []

    for i, task in enumerate(tasks):
        gpu_id = i % num_gpus
        p = mp.Process(
            target=eval_task_on_gpu,
            args=(task, model_path, gpu_id, results_queue),
        )
        p.start()
        processes.append(p)

    for p in processes:
        p.join()

    all_results = {}
    while not results_queue.empty():
        task, result = results_queue.get()
        all_results[task] = result

    return all_results
```

### Evaluation Caching

Large model evaluation is expensive. Cache results aggressively:

```python
import hashlib
import json
import os

class EvalCache:
    def __init__(self, cache_dir="eval_cache"):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def _cache_key(self, model_path, task, num_fewshot):
        key_str = f"{model_path}_{task}_{num_fewshot}"
        return hashlib.sha256(key_str.encode()).hexdigest()

    def get(self, model_path, task, num_fewshot):
        key = self._cache_key(model_path, task, num_fewshot)
        path = os.path.join(self.cache_dir, f"{key}.json")
        if os.path.exists(path):
            with open(path) as f:
                return json.load(f)
        return None

    def put(self, model_path, task, num_fewshot, results):
        key = self._cache_key(model_path, task, num_fewshot)
        path = os.path.join(self.cache_dir, f"{key}.json")
        with open(path, 'w') as f:
            json.dump(results, f)
```

---

## Evaluation Anti-Patterns

```
Anti-Pattern 1: Evaluating only on benchmarks the model was
  trained on. If MMLU data leaked into pretraining, MMLU
  scores are meaningless. Always check for data contamination.

Anti-Pattern 2: Comparing models with different prompts.
  "Model A gets 70% on MMLU with our custom prompt" vs
  "Model B gets 65% with the default prompt." Not comparable.
  Use the same evaluation harness and settings.

Anti-Pattern 3: Ignoring variance.
  "Our model improved from 68.3% to 68.8%." Was this over
  multiple seeds? Different few-shot examples? Report confidence
  intervals.

Anti-Pattern 4: Optimizing for benchmarks.
  If you tune hyperparameters to maximize MMLU score, you're
  overfitting to the benchmark, not improving the model. Use a
  held-out set of benchmarks for model selection.

Anti-Pattern 5: Single-number summaries.
  "Our model scores 75% average across 15 benchmarks."
  This hides that it scores 95% on HellaSwag (easy) and
  15% on MATH (hard). Always report per-task results.
```

---

## Contamination Detection

```python
from datasketch import MinHash, MinHashLSH

def check_contamination(train_data_sample, eval_dataset, threshold=0.8):
    lsh = MinHashLSH(threshold=threshold, num_perm=128)

    for i, eval_item in enumerate(eval_dataset):
        mh = MinHash(num_perm=128)
        for word in eval_item['text'].lower().split():
            mh.update(word.encode('utf-8'))
        lsh.insert(f"eval_{i}", mh)

    contaminated = []
    for train_item in train_data_sample:
        mh = MinHash(num_perm=128)
        for word in train_item['text'].lower().split():
            mh.update(word.encode('utf-8'))
        matches = lsh.query(mh)
        if matches:
            contaminated.extend(matches)

    contamination_rate = len(set(contaminated)) / len(eval_dataset)
    return contamination_rate, set(contaminated)
```

---

## Exercises

1. **Benchmark suite**: Set up lm-evaluation-harness and evaluate
   a 7B model on MMLU, HumanEval, HellaSwag, and GSM8K. Compare
   5-shot vs 0-shot performance. Calculate bootstrap confidence
   intervals for each benchmark.

2. **Statistical testing**: Take two model checkpoints that differ
   by 0.5% on MMLU. Use the paired bootstrap test to determine
   if the difference is statistically significant.

3. **Contamination check**: Write a contamination detector that
   checks if any HumanEval problems appear in a sample of your
   training data. Use both exact match and fuzzy matching.

4. **Evaluation pipeline**: Build an automated evaluation pipeline
   that triggers on new checkpoints, runs 8 benchmarks in parallel
   across GPUs, computes aggregate scores with weights, and logs
   results to Weights & Biases.
