# Lesson 05: Research Engineering Workflow

> **Analogy**: A research engineer's workflow is like a potter's.
> You start with a lump of clay (idea), shape it roughly (prototype),
> test if it holds water (validate), fire it in the kiln (harden),
> then sell it at the market (ship). Most lumps of clay never make
> it past the shaping stage. That's normal.

---

## The Research Engineer's Identity Crisis

You're not a pure researcher (you need to ship). You're not a pure
engineer (you need to explore). You live in the uncomfortable
middle where messy notebooks become production services.

```
Researcher:                Research Engineer:         Software Engineer:
  "Does it work?"            "Does it work AND         "Does it scale,
                              can we ship it?"          deploy, and
                                                        monitor?"
   Jupyter notebooks          Jupyter --> scripts        Production code
   One-off experiments        Reproducible runs          CI/CD pipelines
   Paper as deliverable       Working system             Reliable service
```

The daily challenge: move fast enough to explore (like a researcher)
while building robustly enough to ship (like an engineer).

---

## The Four-Phase Pipeline

Every research idea follows this path. The art is knowing when to
advance and when to kill.

```
  +------------+    +------------+    +---------+    +--------+
  | Prototype  |--->| Validate   |--->| Harden  |--->| Ship   |
  +------------+    +------------+    +---------+    +--------+
     1-3 days         1-2 weeks       1-2 weeks      1 week
      Jupyter          Scripts         Package        Deploy
      Messy            Clean-ish       Tested         Monitored
      Quick            Measured        Robust         Reliable

  Kill rate:  50%         30%            10%           ~0%
  (Most ideas die in prototype. That's fine.)
```

### Phase 1: Prototype (1-3 days)

Goal: Find out if the idea has any signal at all.

Rules:
- Jupyter notebooks are fine
- Hardcoded paths are fine
- Copy-paste code is fine
- No tests, no docs, no code review
- Small dataset, small model, few epochs

```python
# prototype.ipynb -- this is THROWAWAY code

import torch
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(768, 256),
    nn.ReLU(),
    nn.Linear(256, 10),
)

for epoch in range(10):
    for batch in small_dataloader:
        loss = F.cross_entropy(model(batch["input"]), batch["label"])
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
    print(f"Epoch {epoch}: loss={loss.item():.4f}")
```

Kill criteria: If there's no signal after 2-3 days on a small
dataset, the idea probably won't work at scale. Move on.

### Phase 2: Validate (1-2 weeks)

Goal: Confirm the signal is real and measure it properly.

Rules:
- Move to Python scripts (not notebooks)
- Full dataset, proper train/val/test splits
- Multiple seeds (at least 3)
- Compare against baselines
- Log everything to wandb or similar

```
Project structure at validation phase:

  experiment/
  ├── configs/
  │   ├── baseline.yaml
  │   └── proposed.yaml
  ├── train.py
  ├── evaluate.py
  ├── model.py
  └── data.py
```

Kill criteria: If your method isn't better than baselines after
proper comparison with error bars, it's not better. Don't torture
the hyperparameters until it works.

### Phase 3: Harden (1-2 weeks)

Goal: Make the validated code production-worthy.

Rules:
- Add type hints and input validation
- Write tests (unit + integration)
- Handle edge cases
- Document public interfaces
- Code review

```
What changes from validation to hardening:

  Validation code:                 Hardened code:
  assert x.shape[0] > 0           if x.shape[0] == 0:
                                       raise ValueError("Empty batch")
  model = MyModel(768, 10)        model = MyModel(config)
  lr = 1e-4                       lr = config.learning_rate
  results = {}                    results: Dict[str, float] = {}
  # magic number                  MAX_SEQUENCE_LENGTH = 512
```

### Phase 4: Ship (1 week)

Goal: Deploy and monitor.

Rules:
- Package as a service or library
- Add monitoring and alerting
- Write a deployment runbook
- Set up A/B testing or staged rollout

---

## Jupyter to Production Pipeline

Notebooks are where ideas are born. They're also where code goes
to die. Here's how to extract value from notebooks without letting
them become unmaintainable.

### The Notebook Rules

```
DO:
  - Use notebooks for exploration and visualization
  - Keep notebooks short (< 20 cells)
  - Name notebooks with numbers: 01-explore-data.ipynb
  - Clear all outputs before committing
  - Move reusable code to .py files immediately

DON'T:
  - Train production models in notebooks
  - Import between notebooks
  - Keep 47 versions of "Untitled.ipynb"
  - Copy-paste the same function across notebooks
  - Commit notebooks with 500MB of output cells
```

### The Extraction Pattern

When a notebook experiment works, extract the code:

```
Notebook cell:                      Python module:

# In[1]:                            # data.py
df = pd.read_csv("data.csv")       def load_data(path: str) -> Dataset:
df = df.dropna()                        df = pd.read_csv(path)
ds = Dataset.from_pandas(df)            df = df.dropna()
                                        return Dataset.from_pandas(df)

# In[2]:                            # model.py
class MyModel(nn.Module):           class MyModel(nn.Module):
    def __init__(self):                 def __init__(self, config: ModelConfig):
        # ... (identical)                   # ... (parameterized)

# In[3]:                            # train.py
for epoch in range(10):             def train(config: TrainConfig):
    # training loop                     # same loop, but configurable
```

---

## Version Control for Experiments

Git isn't designed for ML experiments. You need conventions on top
of it.

### Branch Strategy

```
main
  │
  ├── experiment/spatial-attention-v1
  │     ├── commit: "add spatial bias to attention"
  │     ├── commit: "sweep learning rates"
  │     └── commit: "final results: +2.1% over baseline"
  │
  ├── experiment/contrastive-pretraining
  │     ├── commit: "implement NT-Xent loss"
  │     └── commit: "results inconclusive, parking"
  │
  └── feat/spatial-attention  (promoted from experiment branch)
        ├── commit: "clean up spatial attention module"
        ├── commit: "add tests for spatial attention"
        └── commit: "integrate into training pipeline"
```

Experiment branches are cheap and disposable. If an experiment
works, promote it to a feature branch and clean up.

### What to Version Control

```
+---------------------+-------------------+
| Track in git        | Track elsewhere   |
+---------------------+-------------------+
| Source code          | Datasets          |
| Config files         | Model checkpoints |
| Small notebooks      | Large outputs     |
| Requirements files   | Wandb logs        |
| Training scripts     | GPU logs          |
+---------------------+-------------------+
```

### Experiment Tagging

```bash
git tag -a exp/spatial-attn/v1 -m "Spatial attention experiment v1
Results: 78.3 +/- 0.4% on ImageNet
Config: configs/spatial_attn_v1.yaml
Wandb: https://wandb.ai/team/project/runs/abc123"

git tag -a exp/spatial-attn/v2 -m "Spatial attention v2 (larger model)
Results: 79.1 +/- 0.3% on ImageNet
Config: configs/spatial_attn_v2.yaml"
```

---

## Project Organization

A research project that might go to production needs structure from
the start. Not enterprise architecture -- just enough to not get
lost.

```
project/
├── configs/                  # Experiment configurations
│   ├── base.yaml
│   ├── ablation_no_component_a.yaml
│   └── production.yaml
├── src/
│   ├── __init__.py
│   ├── model.py              # Model architecture
│   ├── data.py               # Data loading and processing
│   ├── train.py              # Training loop
│   ├── evaluate.py           # Evaluation logic
│   └── losses.py             # Custom loss functions
├── scripts/
│   ├── train.sh              # Launch training
│   ├── evaluate.sh           # Run evaluation
│   └── sweep.sh              # Hyperparameter sweep
├── tests/
│   ├── test_model.py
│   ├── test_data.py
│   └── test_losses.py
├── notebooks/
│   ├── 01-explore-data.ipynb
│   └── 02-analyze-results.ipynb
├── results/                  # Experiment outputs (gitignored)
│   └── .gitkeep
├── requirements.txt
└── pyproject.toml
```

### Config-Driven Experiments

Never hardcode experiment parameters. Use config files so every
run is reproducible.

```yaml
model:
  name: "spatial_vit"
  hidden_dim: 768
  num_heads: 12
  num_layers: 12
  spatial_bias: true

training:
  learning_rate: 3.0e-4
  weight_decay: 0.01
  batch_size: 256
  num_epochs: 90
  warmup_epochs: 5
  scheduler: "cosine"
  gradient_clip: 1.0

data:
  dataset: "imagenet"
  image_size: 224
  augmentation: "standard"

eval:
  metrics: ["top1", "top5"]
  eval_every: 5

compute:
  num_gpus: 4
  mixed_precision: "bf16"
  seed: 42
```

```python
import yaml
from dataclasses import dataclass

@dataclass
class Config:
    model_name: str
    hidden_dim: int
    learning_rate: float
    batch_size: int
    num_epochs: int
    seed: int

    @classmethod
    def from_yaml(cls, path: str) -> "Config":
        with open(path) as f:
            raw = yaml.safe_load(f)
        flat = {}
        for section in raw.values():
            if isinstance(section, dict):
                flat.update(section)
            else:
                flat.update(raw)
                break
        return cls(**{k: v for k, v in flat.items() if k in cls.__dataclass_fields__})
```

---

## Collaboration Patterns

### The Research Team Dynamic

```
  PI/Lead:     "Let's try approach X"
                    |
                    v
  Researcher:  Prototypes in notebook, finds signal
                    |
                    v
  Res. Eng.:   Validates, scales up, runs proper experiments
                    |
                    v
  ML Eng.:     Hardens, tests, deploys
                    |
                    v
  SRE/Ops:     Monitors, maintains

In smaller teams, one person does multiple roles.
The research engineer often does all of it.
```

### Code Handoff Checklist

When handing code from research to production:

```
[ ] All hyperparameters in config (no magic numbers)
[ ] Training reproduces claimed results
[ ] Tests pass
[ ] Inference works on single examples (not just batches)
[ ] Model can be exported (ONNX, TorchScript, etc.)
[ ] Memory requirements documented
[ ] Latency requirements documented
[ ] Edge cases identified and handled
[ ] Data pipeline documented
[ ] README with quickstart
```

---

## Daily Workflow

### Morning Routine

```
1. Check overnight experiment results      (5 min)
   - Did anything crash?
   - Are curves progressing as expected?
   - Any runs to kill early?

2. Review experiment log                   (5 min)
   - What was I trying yesterday?
   - What did I learn?
   - What's the plan for today?

3. Triage new papers/results               (15 min)
   - Skim arXiv for relevant new work
   - Check if anyone published something similar
```

### Working Session

```
4. Run experiments                         (bulk of day)
   - Launch new runs
   - Analyze completed runs
   - Debug failed runs
   - Iterate on ideas

5. Code quality time                       (30-60 min)
   - Refactor messy prototype code
   - Write tests for validated components
   - Update documentation
```

### End of Day

```
6. Log what happened                       (10 min)
   - What experiments ran?
   - What were the results?
   - What should I try tomorrow?
   - Any dead ends to note?
```

### The Experiment Log

Keep a running document. A plain text file works fine.

```
## 2024-03-15

Ran spatial attention ablation on CIFAR-100.
- Full model: 82.3% (+/- 0.4)
- No spatial bias: 80.1% (+/- 0.3)
- Conclusion: spatial bias contributes ~2.2%

Next: try on ImageNet to see if the effect scales.
Config: configs/spatial_attn_imagenet.yaml
Launched 3 seeds on cluster, expect results by tomorrow morning.

## 2024-03-14

Debugging NaN loss in contrastive pretraining.
Root cause: temperature parameter going to 0 during training.
Fix: clamp temperature to minimum of 0.01.
This was not in the paper. Took 4 hours to find.
```

---

## Practical Exercise

Set up a research project from scratch:

1. Create the directory structure shown above
2. Write a base config YAML for a simple image classification task
3. Write a training script that reads the config and logs to
   wandb (or stdout if no wandb)
4. Write a `run_experiment.sh` script that takes a config path
5. Run the one-batch overfit sanity check

---

## Key Takeaways

- The prototype-validate-harden-ship pipeline keeps you honest
  about what's exploration vs what's production
- Most experiments die in prototype phase -- that's working as
  designed
- Notebooks for exploration, scripts for validation, packages for
  production
- Log everything: experiments, results, dead ends, surprises
- Config-driven experiments make reproduction trivial
- Git tags on experiment branches create a searchable history

Next lesson: when `model.fit()` isn't enough, you write your own
training loop.
