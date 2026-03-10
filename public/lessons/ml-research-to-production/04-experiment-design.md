# Lesson 04: Experiment Design

> **Analogy**: Running ML experiments without a design is like
> testing whether a drug works by giving it to one person and
> seeing if they feel better. Maybe they would have felt better
> anyway. Maybe the thermometer was broken. Good experiment design
> is how you separate "it works" from "I got lucky."

---

## Why Experiment Design Matters

You have a new idea. You implement it. You run it once. The number
goes up. Ship it?

No. That number going up could mean:

- Your idea actually works
- You got a lucky random seed
- Your baseline was undertrained
- Your evaluation has a bug
- Your training data leaked into your test set
- You accidentally tuned hyperparameters on the test set

Good experiment design rules out everything except the first
explanation. Bad experiment design lets you believe whatever you
want.

```
The Experimenter's Dilemma:

  Good result + bad design  =  You don't know anything
  Bad result  + good design =  You learned something valuable
  Good result + good design =  You can trust it and publish it
```

---

## The Experiment Hierarchy

Before running any experiment, know what type you're running and
what it can tell you.

```
+------------------+-------------------+---------------------------+
| Experiment Type  | Question          | Example                   |
+------------------+-------------------+---------------------------+
| Sanity check     | Does it run?      | Overfit one batch         |
| Baseline         | What's the floor? | Train a simple model      |
| Comparison       | Is A better?      | Your method vs baselines  |
| Ablation         | Why does it work? | Remove one component      |
| Scaling          | How does it grow? | Vary data/model/compute   |
| Error analysis   | Where does it     | Look at failure cases     |
|                  | fail?             |                           |
+------------------+-------------------+---------------------------+
```

Run them in this order. Each type builds confidence that the next
one's results are meaningful.

---

## Sanity Checks: Before Anything Else

Before running real experiments, verify your pipeline works.

### The One-Batch Overfit Test

Your model should be able to memorize a single batch perfectly.
If it can't, something is broken.

```python
def sanity_check_overfit_batch(model, dataloader, loss_fn, lr=1e-3, steps=200):
    model.train()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    batch = next(iter(dataloader))
    inputs, targets = batch

    for step in range(steps):
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = loss_fn(outputs, targets)
        loss.backward()
        optimizer.step()

        if step % 50 == 0:
            print(f"Step {step}: loss={loss.item():.6f}")

    final_loss = loss.item()
    if final_loss > 0.01:
        print(f"WARNING: Could not overfit single batch (loss={final_loss})")
        print("Check: loss function, model architecture, data format")
    else:
        print("Sanity check passed")
```

If this fails, your model or loss function has a bug. Don't
proceed until it passes.

### Additional Sanity Checks

```
+----------------------------+--------------------------------------+
| Check                      | What it catches                      |
+----------------------------+--------------------------------------+
| Random labels, same data   | If acc > random, data is leaking     |
| All-zeros input            | Model should predict prior           |
| Single class only          | Loss should equal -log(1/num_classes)|
| Double the data            | Loss should decrease (usually)       |
| Shuffle labels             | Accuracy should drop to random       |
+----------------------------+--------------------------------------+
```

---

## Baselines: Establishing the Floor

A result only means something relative to a baseline. Choose
baselines that are both simple and strong.

### What Makes a Good Baseline?

```
Good Baselines:

  1. Random/majority guess     (absolute floor)
  2. Simple classical method   (logistic regression, k-NN)
  3. Well-tuned standard model (ResNet, BERT-base)
  4. Recent SOTA method        (current best published result)
  5. Your method minus novelty (ablation baseline)

Bad Baselines:

  - Undertrained models (didn't converge)
  - Old methods no one uses (easy to beat)
  - Mismatched compute (your 8-GPU vs their 1-GPU)
  - Wrong hyperparameters (default LR for your method, bad LR for theirs)
```

### Fair Comparison Rules

```
For a comparison to be fair:

  [ ] Same data (exact same train/val/test splits)
  [ ] Same preprocessing (augmentation, normalization)
  [ ] Same compute budget (wall clock or FLOP-matched)
  [ ] Same hyperparameter tuning effort
  [ ] Same evaluation protocol (same metrics, same post-processing)
  [ ] Same number of runs (seeds)
```

If you tune your method for 50 GPU-hours and run the baseline
with default hyperparameters, you haven't shown your method is
better -- you've shown that tuning helps.

---

## Ablation Studies

Ablations answer the most important question in research: **why
does it work?** You remove or modify one component at a time and
measure the impact.

### The Ablation Table

```
+-----------------------------+----------+--------+
| Configuration               | Accuracy | Delta  |
+-----------------------------+----------+--------+
| Full model (yours)          | 78.3%    |   --   |
| - Remove component A        | 77.1%    | -1.2%  |
| - Remove component B        | 74.5%    | -3.8%  |
| - Remove component C        | 78.1%    | -0.2%  |
| - Replace D with simple ver | 76.8%    | -1.5%  |
| Baseline (no modifications) | 73.2%    | -5.1%  |
+-----------------------------+----------+--------+

Reading this table:
  Component B matters a lot (-3.8%)
  Component C barely matters (-0.2%) -- consider removing it
  The full model improves +5.1% over baseline
  Components account for: 1.2 + 3.8 + 0.2 + 1.5 = 6.7%
    (This is > 5.1% because components interact)
```

### Designing Ablations

Remove one thing at a time. Change one variable per experiment.

```python
ABLATION_CONFIGS = {
    "full_model": {
        "use_component_a": True,
        "use_component_b": True,
        "use_component_c": True,
        "loss_type": "contrastive",
    },
    "no_component_a": {
        "use_component_a": False,
        "use_component_b": True,
        "use_component_c": True,
        "loss_type": "contrastive",
    },
    "no_component_b": {
        "use_component_a": True,
        "use_component_b": False,
        "use_component_c": True,
        "loss_type": "contrastive",
    },
    "simple_loss": {
        "use_component_a": True,
        "use_component_b": True,
        "use_component_c": True,
        "loss_type": "cross_entropy",
    },
}
```

---

## Statistical Significance

One run is not a result. ML experiments have high variance from
random initialization, data shuffling, and stochastic optimization.

### How Many Seeds?

```
Minimum: 3 runs (barely sufficient, reports mean and range)
Good:    5 runs (standard in most venues)
Rigorous: 10+ runs (for small improvements or noisy tasks)

Report: mean +/- standard deviation
  "Our method achieves 78.3 +/- 0.4% accuracy (5 runs)"
  NOT: "Our method achieves 78.8% accuracy" (best of 5 cherry-picked)
```

### Significance Testing

For two methods with results from multiple runs:

```python
from scipy import stats
import numpy as np

method_a_scores = [78.1, 78.5, 77.9, 78.3, 78.6]
method_b_scores = [76.2, 76.8, 76.5, 77.0, 76.3]

t_stat, p_value = stats.ttest_ind(method_a_scores, method_b_scores)
print(f"t-statistic: {t_stat:.3f}")
print(f"p-value: {p_value:.4f}")

if p_value < 0.05:
    print("Difference is statistically significant")
else:
    print("Difference is NOT statistically significant")
    print("You need more runs or the methods are equivalent")
```

```
p-value interpretation:

  p < 0.01:  Strong evidence of difference
  p < 0.05:  Moderate evidence (standard threshold)
  p > 0.05:  Insufficient evidence -- don't claim improvement
  p > 0.10:  The methods are probably equivalent
```

### Effect Size

Statistical significance isn't enough. A difference can be
significant but tiny (and therefore useless in practice).

```
Report both:
  1. Is the difference real?     (p-value)
  2. Is the difference useful?   (absolute improvement)

  "Method A is 0.1% better with p=0.03"
    --> Real, but probably not worth the complexity

  "Method A is 5.2% better with p=0.001"
    --> Real and substantial
```

---

## Compute Budgets

Research without compute accounting is science fiction.

### Tracking Compute

```python
import time

class ComputeTracker:
    def __init__(self):
        self.gpu_hours = 0
        self.start_time = None

    def start(self, num_gpus=1):
        self.num_gpus = num_gpus
        self.start_time = time.time()

    def stop(self):
        elapsed_hours = (time.time() - self.start_time) / 3600
        self.gpu_hours += elapsed_hours * self.num_gpus
        self.start_time = None
        return self.gpu_hours

    def report(self):
        return {
            "gpu_hours": round(self.gpu_hours, 2),
            "estimated_cost_a100": round(self.gpu_hours * 2.50, 2),
            "estimated_co2_kg": round(self.gpu_hours * 0.3, 2),
        }
```

### Compute-Matched Comparisons

The fairest comparison gives each method the same compute budget
and measures who does more with it.

```
Unfair comparison:
  Method A: 100 GPU-hours --> 78% accuracy
  Method B:  10 GPU-hours --> 75% accuracy
  "Method A is better" -- No, it had 10x the compute.

Fair comparison:
  Method A @ 10 GPU-hours:  76% accuracy
  Method B @ 10 GPU-hours:  75% accuracy
  Method A @ 100 GPU-hours: 78% accuracy
  Method B @ 100 GPU-hours: 77% accuracy
  "Method A is consistently ~1% better at matched compute."
```

---

## Experiment Logging

Every experiment should be automatically logged. You will forget
what you ran three weeks ago.

### What to Log

```
+-------------------+-----------------------------------------------+
| Category          | What to Record                                |
+-------------------+-----------------------------------------------+
| Config            | All hyperparameters, model architecture,      |
|                   | data paths, random seeds                      |
+-------------------+-----------------------------------------------+
| Environment       | GPU type, CUDA version, library versions,     |
|                   | git commit hash                               |
+-------------------+-----------------------------------------------+
| Training curves   | Loss, accuracy, LR at every step/epoch        |
+-------------------+-----------------------------------------------+
| Evaluation        | All metrics on val and test sets               |
+-------------------+-----------------------------------------------+
| Compute           | Wall clock time, GPU utilization, memory       |
+-------------------+-----------------------------------------------+
| Artifacts         | Model checkpoints, predictions, plots          |
+-------------------+-----------------------------------------------+
```

### Experiment Config Pattern

```python
from dataclasses import dataclass, asdict
import json
import hashlib

@dataclass
class ExperimentConfig:
    model_name: str
    learning_rate: float
    batch_size: int
    num_epochs: int
    seed: int
    dataset: str
    optimizer: str = "adamw"
    weight_decay: float = 0.01
    warmup_steps: int = 1000
    gradient_clip: float = 1.0

    @property
    def experiment_id(self):
        config_str = json.dumps(asdict(self), sort_keys=True)
        return hashlib.md5(config_str.encode()).hexdigest()[:8]

    def save(self, path):
        with open(path, "w") as f:
            json.dump(asdict(self), f, indent=2)

    @classmethod
    def load(cls, path):
        with open(path) as f:
            return cls(**json.load(f))
```

### Using Weights & Biases (wandb)

```python
import wandb

def train_with_logging(config):
    wandb.init(
        project="my-research",
        name=f"exp-{config.experiment_id}",
        config=asdict(config),
    )

    model = build_model(config)
    optimizer = build_optimizer(model, config)

    for epoch in range(config.num_epochs):
        train_loss = train_one_epoch(model, optimizer, train_loader)
        val_metrics = evaluate(model, val_loader)

        wandb.log({
            "epoch": epoch,
            "train/loss": train_loss,
            "val/accuracy": val_metrics["accuracy"],
            "val/loss": val_metrics["loss"],
            "lr": optimizer.param_groups[0]["lr"],
        })

    wandb.finish()
```

---

## What to Measure and Report

### Standard Metrics by Task

```
+-------------------+------------------------------------------+
| Task              | Primary Metrics                          |
+-------------------+------------------------------------------+
| Classification    | Accuracy, F1, Precision, Recall, AUC    |
| Detection         | mAP@50, mAP@50:95, FPS                  |
| Segmentation      | mIoU, pixel accuracy                    |
| Generation        | FID, IS, CLIP score                     |
| NLP (general)     | BLEU, ROUGE, BERTScore                  |
| Retrieval         | Recall@k, MRR, nDCG                     |
| Regression        | MSE, MAE, R-squared                     |
+-------------------+------------------------------------------+
```

### What Reviewers Look For

```
Minimum viable experiment section:

  1. Clear baselines (at least 2-3)
  2. Results on standard benchmarks (not toy datasets)
  3. Error bars or confidence intervals
  4. Ablation study (what does each component contribute?)
  5. Compute/cost analysis
  6. Failure cases or limitations

Bonus points:
  - Scaling analysis (how does performance change with data/compute?)
  - Transfer to other tasks/domains
  - Qualitative examples (good AND bad)
  - Hyperparameter sensitivity analysis
```

---

## Practical Exercise

Design an experiment plan for this scenario:

You've modified the attention mechanism in a vision transformer.
Your modification adds a spatial bias term. You want to prove
it helps.

Write out:
1. Sanity check plan (what do you verify first?)
2. Baselines (what do you compare against?)
3. Ablation table (what rows does it have?)
4. Seed strategy (how many runs, which seeds?)
5. Compute budget (how do you ensure fairness?)
6. Metrics (what do you measure?)

---

## Key Takeaways

- Always overfit one batch before running real experiments
- Fair baselines mean equal compute, equal tuning, equal data
- Ablations tell you *why* something works, not just *that* it works
- One run is an anecdote; five runs with error bars is evidence
- Log everything -- your future self will thank you
- Report compute costs alongside accuracy gains

Next lesson: the daily workflow of a research engineer who ships.
