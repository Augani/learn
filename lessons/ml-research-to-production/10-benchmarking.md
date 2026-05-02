# Lesson 10: Benchmarking

> **Analogy**: Benchmarking is like judging a cooking competition.
> If one chef gets 3 hours and premium ingredients while another gets
> 30 minutes and canned food, the comparison is meaningless. Fair
> benchmarking means everyone gets the same pantry, the same clock,
> and the same judges. Most published benchmarks are the unfair
> cooking competition.

---

## Why Benchmarking Is Hard

You'd think comparing two models is simple: run them both, check
the numbers. But nearly every comparison you see in papers is
unfair in at least one way.

```
Common ways benchmarks lie:

  1. Compute mismatch     (your 1000 GPU-hours vs their 10)
  2. Data mismatch        (you used more/better data)
  3. Tuning mismatch      (you tuned 50 hyperparameters, they used defaults)
  4. Evaluation mismatch  (different metrics, test sets, or protocols)
  5. Cherry-picking       (report the best result, not the average)
  6. Moving goalposts     (change the benchmark when you're winning)
```

A disciplined benchmark is one of the hardest things to do well
in ML. It's also one of the most valuable.

---

## Fair Comparison Methodology

### The Golden Rules

```
1. Same data:          Exact same train/val/test splits
2. Same compute:       Same GPU-hours or FLOP budget
3. Same tuning:        Same hyperparameter search budget
4. Same evaluation:    Same metrics, same protocol
5. Same seeds:         Same number of runs, report mean +/- std
6. Same infrastructure: Same framework, similar hardware
```

### Compute-Matched Comparisons

The most important and most frequently violated rule. If method A
uses 10x the compute of method B, you're not comparing methods --
you're comparing budgets.

```
Approach 1: Fix compute, measure performance

  Budget: 100 GPU-hours per method
  Method A @ 100 hrs: 82.1% accuracy
  Method B @ 100 hrs: 81.8% accuracy
  Method C @ 100 hrs: 83.5% accuracy
  --> Method C wins at this budget

Approach 2: Fix performance, measure compute

  Target: 82% accuracy
  Method A: reached 82% in 45 GPU-hours
  Method B: reached 82% in 80 GPU-hours
  Method C: reached 82% in 30 GPU-hours
  --> Method C is most efficient

Approach 3: Plot the Pareto frontier

  Accuracy
  84% |            x C
  83% |        x C
  82% |    x A   x C
  81% |  x A  x B
  80% | x B
      +--+--+--+--+---> GPU-hours
        20  40  60  80  100
```

The Pareto frontier is the most honest comparison. It shows where
each method excels across the compute spectrum.

### Hyperparameter Tuning Budget

```
Fair tuning approaches:

  1. Fixed budget: Each method gets N hyperparameter trials
     (e.g., 20 random search trials for each)

  2. Default settings: Use the best settings from each method's
     original paper (no additional tuning)

  3. Auto-tuned: Use the same AutoML tool for all methods
     (e.g., Optuna with same number of trials)

  Unfair: Hand-tune your method for weeks, use paper defaults
  for baselines.
```

```python
import optuna

def create_fair_study(method_name, n_trials=20):
    study = optuna.create_study(
        direction="maximize",
        study_name=f"benchmark_{method_name}",
        sampler=optuna.samplers.TPESampler(seed=42),
    )
    return study

def benchmark_method(method_class, dataset, n_trials=20, n_seeds=3):
    study = create_fair_study(method_class.__name__, n_trials)

    def objective(trial):
        config = method_class.suggest_hyperparameters(trial)
        scores = []
        for seed in range(n_seeds):
            config["seed"] = seed
            model = method_class(config)
            score = train_and_evaluate(model, dataset)
            scores.append(score)
        return sum(scores) / len(scores)

    study.optimize(objective, n_trials=n_trials)
    return study.best_trial
```

---

## Benchmark Design

### Choosing What to Benchmark

```
A good benchmark tests:

  1. The specific claim you're making
     "Our method is better at X" --> Test X directly

  2. Generalization
     "It works in general" --> Test on multiple domains

  3. Robustness
     "It handles edge cases" --> Test on adversarial/OOD data

  4. Efficiency
     "It's practical" --> Measure latency, memory, throughput
```

### Benchmark Suite Structure

```python
BENCHMARK_SUITE = {
    "core": {
        "imagenet_1k": {
            "task": "classification",
            "metrics": ["top1_accuracy", "top5_accuracy"],
            "split": "val",
        },
        "coco_2017": {
            "task": "detection",
            "metrics": ["mAP_50", "mAP_50_95"],
            "split": "val",
        },
    },
    "robustness": {
        "imagenet_c": {
            "task": "classification",
            "metrics": ["mCE"],
            "corruptions": ["gaussian_noise", "blur", "weather", "digital"],
        },
        "imagenet_a": {
            "task": "classification",
            "metrics": ["top1_accuracy"],
        },
    },
    "efficiency": {
        "metrics": ["throughput_imgs_per_sec", "latency_ms", "peak_memory_mb",
                     "flops", "num_parameters"],
        "hardware": ["a100", "v100", "cpu"],
    },
}
```

### Efficiency Benchmarking

Performance numbers without efficiency numbers are incomplete.

```python
import time
import torch

def benchmark_throughput(model, input_shape, device="cuda",
                         warmup_steps=50, measure_steps=200):
    model = model.to(device).eval()
    dummy_input = torch.randn(*input_shape, device=device)

    for _ in range(warmup_steps):
        with torch.no_grad():
            _ = model(dummy_input)
    torch.cuda.synchronize()

    start = time.perf_counter()
    for _ in range(measure_steps):
        with torch.no_grad():
            _ = model(dummy_input)
    torch.cuda.synchronize()
    elapsed = time.perf_counter() - start

    batch_size = input_shape[0]
    throughput = (measure_steps * batch_size) / elapsed
    latency = elapsed / measure_steps * 1000

    return {
        "throughput_samples_per_sec": throughput,
        "latency_ms": latency,
        "batch_size": batch_size,
    }


def benchmark_memory(model, input_shape, device="cuda"):
    model = model.to(device).eval()

    torch.cuda.reset_peak_memory_stats()
    dummy_input = torch.randn(*input_shape, device=device)

    with torch.no_grad():
        _ = model(dummy_input)
    torch.cuda.synchronize()

    peak_memory = torch.cuda.max_memory_allocated() / (1024 ** 2)

    param_memory = sum(p.numel() * p.element_size() for p in model.parameters()) / (1024 ** 2)

    return {
        "peak_memory_mb": peak_memory,
        "parameter_memory_mb": param_memory,
    }
```

---

## Benchmark Design Pitfalls

### Dataset Contamination

The most dangerous pitfall. If your training data contains test
set examples, your benchmark is invalid.

```
Common contamination sources:

  Web-crawled data:     May contain benchmark answers
  Pretraining corpora:  May include test set text
  Fine-tuning data:     May overlap with evaluation set
  Data augmentation:    May create near-duplicates of test data

Detection:
  - Check for exact and near-duplicate matches
  - Use n-gram overlap metrics
  - Test on truly held-out data from after your data collection cutoff
```

### Overfitting to Benchmarks

```
Goodhart's Law: "When a measure becomes a target,
                 it ceases to be a good measure."

MNIST accuracy:      99.8%  (solved, not useful)
ImageNet accuracy:   ~91%   (saturating, methods matter less)
GLUE score:          ~92    (super-human, now use SuperGLUE)

Signs your benchmark is overfitted:
  - Small improvements require large compute increases
  - Methods that win on benchmark fail on real tasks
  - Everyone uses tricks specific to the benchmark
  - Human performance has been exceeded
```

### Reporting Results Honestly

```
DO:
  - Report mean +/- standard deviation over multiple seeds
  - Include compute cost (GPU-hours, FLOPs)
  - Show full results tables (not just where you win)
  - Report failure cases and limitations
  - Include training curves, not just final numbers
  - Provide code and checkpoints for reproduction

DON'T:
  - Report only the best seed
  - Compare your tuned model to untuned baselines
  - Use different evaluation protocols for different methods
  - Round numbers to make differences look bigger
  - Omit methods that beat yours from the comparison
  - Claim SOTA without checking the latest results
```

---

## The Benchmark Report Template

```
# Benchmark Report: [Method Name]

## Setup
- Hardware: [GPU type, count]
- Framework: [PyTorch version, CUDA version]
- Training compute: [GPU-hours per run]
- Tuning budget: [number of hyperparameter trials]
- Seeds: [list of seeds used]
- Code: [link to repository]

## Results

### Main Comparison
+------------------+-------+-------+-------+-----------+
| Method           | Acc   | F1    | Lat.  | GPU-hours |
+------------------+-------+-------+-------+-----------+
| Baseline A       | 78.3  | 77.1  | 5ms   |     24    |
|   (± std)        | (0.4) | (0.5) |       |           |
| Baseline B       | 79.1  | 78.2  | 8ms   |     48    |
|   (± std)        | (0.3) | (0.4) |       |           |
| Ours             | 80.2  | 79.5  | 6ms   |     30    |
|   (± std)        | (0.2) | (0.3) |       |           |
+------------------+-------+-------+-------+-----------+

### Statistical Significance
- Ours vs Baseline A: p=0.001 (significant)
- Ours vs Baseline B: p=0.02  (significant)

### Compute Efficiency
- At 24 GPU-hours (matched to Baseline A): Ours = 79.5%
- Ours reaches Baseline B accuracy (79.1%) in 20 GPU-hours

### Ablation Study
[see Lesson 04]

### Robustness
[results on distribution shift / adversarial data]

## Limitations
- [What scenarios does the method NOT work well in?]
- [What assumptions does it make?]
```

---

## Automated Benchmarking

For ongoing development, automate your benchmark suite.

```python
import json
from pathlib import Path
from datetime import datetime

class BenchmarkRunner:
    def __init__(self, output_dir="benchmark_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def run_suite(self, model_factory, config, suite):
        results = {
            "model": config.model_name,
            "timestamp": datetime.now().isoformat(),
            "config": vars(config),
            "benchmarks": {},
        }

        for bench_name, bench_config in suite.items():
            print(f"Running benchmark: {bench_name}")
            dataset = load_benchmark_dataset(bench_config)
            metrics = evaluate_on_benchmark(
                model_factory(config), dataset, bench_config["metrics"]
            )
            results["benchmarks"][bench_name] = metrics
            print(f"  {metrics}")

        output_path = self.output_dir / f"{config.model_name}_{datetime.now():%Y%m%d_%H%M}.json"
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)

        return results

    def compare(self, result_files):
        all_results = []
        for f in result_files:
            with open(f) as fh:
                all_results.append(json.load(fh))

        print(f"{'Model':<20}", end="")
        benchmarks = list(all_results[0]["benchmarks"].keys())
        for b in benchmarks:
            print(f"{b:<15}", end="")
        print()

        for result in all_results:
            print(f"{result['model']:<20}", end="")
            for b in benchmarks:
                metrics = result["benchmarks"].get(b, {})
                primary = list(metrics.values())[0] if metrics else "N/A"
                print(f"{primary:<15}", end="")
            print()
```

---

## Practical Exercise

Design and run a small benchmark comparing three approaches
to text classification:

1. **TF-IDF + Logistic Regression** (simple baseline)
2. **Fine-tuned DistilBERT** (medium complexity)
3. **Fine-tuned BERT-base** (higher complexity)

For each:
- Use the same 3 datasets (e.g., SST-2, AG News, IMDB)
- Report accuracy with 3 seeds
- Measure throughput (samples/sec) and latency
- Create a compute-matched comparison (fix GPU-hours)
- Plot the Pareto frontier (accuracy vs compute)

Write the full benchmark report using the template above.

---

## Key Takeaways

- Fair benchmarks require same data, compute, tuning, and
  evaluation protocol for all methods
- Compute-matched comparisons are the single most important
  fairness criterion
- Report mean +/- std over multiple seeds, never best-of
- Include efficiency metrics alongside accuracy
- Automate your benchmark suite for reproducibility
- Be honest about limitations and failure cases
- Benchmarks are tools for understanding, not trophies for claiming

Next lesson: your model works, your benchmarks are solid. Now let's
make it production-ready.
