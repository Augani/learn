# Reference: Research Engineering Workflow

Checklists, templates, and tool recommendations for the daily
workflow of a research engineer.

---

## Project Setup Checklist

```
Starting a new research project:

  [ ] Create project directory with standard structure
  [ ] Initialize git repo
  [ ] Set up virtual environment (conda or venv)
  [ ] Pin all dependency versions in requirements.txt
  [ ] Create base config YAML
  [ ] Set up experiment tracking (wandb / mlflow)
  [ ] Create .gitignore (data/, checkpoints/, wandb/, __pycache__/)
  [ ] Write a train.py that reads config and runs
  [ ] Verify: can train on one batch and overfit
```

---

## Standard Project Structure

```
project/
├── configs/
│   ├── base.yaml              # Default configuration
│   ├── debug.yaml             # Small/fast for debugging
│   └── sweep.yaml             # Hyperparameter sweep ranges
├── src/
│   ├── __init__.py
│   ├── model.py               # Model architecture
│   ├── data.py                # Data loading + preprocessing
│   ├── train.py               # Training loop
│   ├── evaluate.py            # Evaluation and metrics
│   ├── losses.py              # Custom loss functions
│   └── utils.py               # Shared utilities
├── tests/
│   ├── test_model.py
│   ├── test_data.py
│   └── test_losses.py
├── scripts/
│   ├── train.sh               # Launch training
│   ├── evaluate.sh            # Run evaluation
│   └── sweep.sh               # Run hyperparameter sweep
├── notebooks/
│   ├── 01-explore-data.ipynb
│   └── 02-analyze-results.ipynb
├── results/                   # Experiment outputs (gitignored)
├── requirements.txt
├── pyproject.toml
└── .gitignore
```

---

## Experiment Lifecycle

```
1. PLAN
   - Define hypothesis
   - Choose metrics
   - Design comparison (baseline vs proposed)
   - Estimate compute budget

2. IMPLEMENT
   - Write/modify code
   - Run sanity checks (overfit one batch)
   - Verify shapes and gradients

3. RUN
   - Launch with config file
   - Monitor training curves
   - Check for NaN/divergence early

4. ANALYZE
   - Compare to baselines
   - Run ablations
   - Compute significance
   - Visualize results

5. DECIDE
   - Promising --> iterate, scale up
   - Inconclusive --> more seeds, different config
   - Negative --> document and move on

6. DOCUMENT
   - Log results in experiment tracker
   - Update experiment log
   - Tag git commit
```

---

## Daily Routine

```
Morning (30 min):
  [ ] Check overnight experiment results
  [ ] Kill failed/useless runs early
  [ ] Review yesterday's experiment log

Working session (bulk of day):
  [ ] Launch new experiments
  [ ] Analyze completed experiments
  [ ] Debug issues
  [ ] Iterate on ideas
  [ ] Code quality time (refactor, test)

End of day (15 min):
  [ ] Update experiment log
  [ ] Note what to try tomorrow
  [ ] Commit code changes
  [ ] Verify overnight runs are launched
```

---

## Experiment Log Template

```
## YYYY-MM-DD

### What I tried
[Description of experiment]

### Config
[Config file name or key hyperparameters]

### Results
[Numbers, comparison to baseline]

### Analysis
[What this means, why it worked/didn't]

### Next steps
[What to try based on these results]

### Dead ends
[Approaches that didn't work and why]
```

---

## Config File Template (YAML)

```yaml
experiment:
  name: "experiment_name"
  seed: 42
  output_dir: "results/${experiment.name}"

model:
  name: "model_name"
  hidden_dim: 768
  num_heads: 12
  num_layers: 12
  dropout: 0.1

training:
  optimizer: "adamw"
  learning_rate: 3.0e-4
  weight_decay: 0.01
  batch_size: 32
  num_epochs: 100
  warmup_fraction: 0.1
  gradient_clip: 1.0
  scheduler: "cosine"

data:
  dataset: "dataset_name"
  train_split: "train"
  val_split: "validation"
  max_length: 512
  num_workers: 4

evaluation:
  metrics: ["accuracy", "f1"]
  eval_every_n_epochs: 1
  save_best: true
  early_stopping_patience: 10

compute:
  device: "cuda"
  mixed_precision: true
  num_gpus: 1
```

---

## Sanity Check Checklist

Run these before any real experiment:

```
Before training:
  [ ] Model forward pass works with dummy input
  [ ] Model backward pass produces gradients
  [ ] All parameters have requires_grad=True (unless frozen)
  [ ] Parameter count matches expectation
  [ ] Data loader produces expected shapes
  [ ] Loss function returns scalar
  [ ] Learning rate schedule looks correct (plot it)

Overfit one batch:
  [ ] Loss decreases to near zero
  [ ] Training accuracy reaches 100%
  [ ] Takes < 200 steps
  [ ] If not: bug in model, loss, or data pipeline

First epoch sanity:
  [ ] Loss is decreasing
  [ ] No NaN or Inf values
  [ ] GPU memory usage is stable
  [ ] Throughput (samples/sec) is reasonable
```

---

## Debugging Flowchart

```
Loss not decreasing?
  |
  +--> Can you overfit one batch?
  |      |
  |    No --> Bug in model, loss, or data pipeline
  |      |     Check: gradients flowing?
  |      |     Check: loss function correct?
  |      |     Check: data labels correct?
  |      |
  |    Yes --> Hyperparameter issue
  |            Check: learning rate too high/low?
  |            Check: batch size appropriate?
  |            Check: regularization too strong?
  |
Loss is NaN?
  |
  +--> Check: log(0) or division by zero?
  +--> Check: learning rate too high?
  +--> Check: gradient clipping enabled?
  +--> Check: mixed precision scaler working?
  |
Loss explodes then NaN?
  |
  +--> Gradient clipping too loose or missing
  +--> Learning rate warmup missing
  +--> Initialization wrong
```

---

## Tool Recommendations

### Experiment Tracking

```
+----------------+----------+--------------------------------------+
| Tool           | Cost     | Best For                             |
+----------------+----------+--------------------------------------+
| Weights & Biases| Free*   | Full-featured, great UI, teams      |
| MLflow         | Free     | Self-hosted, enterprise              |
| TensorBoard    | Free     | Simple, built into PyTorch           |
| Neptune        | Free*    | Collaboration, metadata-heavy        |
| Aim            | Free     | Open-source W&B alternative          |
+----------------+----------+--------------------------------------+
  * Free tier available; paid for teams/storage
```

### Hyperparameter Optimization

```
+----------------+--------------------------------------+
| Tool           | Best For                             |
+----------------+--------------------------------------+
| Optuna         | Bayesian optimization, flexible      |
| Ray Tune       | Distributed sweeps, large-scale      |
| Hydra          | Config management + sweeps           |
| W&B Sweeps     | Integrated with W&B tracking         |
+----------------+--------------------------------------+
```

### Compute Management

```
+----------------+--------------------------------------+
| Tool           | Best For                             |
+----------------+--------------------------------------+
| SLURM          | HPC clusters, university clusters    |
| Kubernetes     | Cloud-native, auto-scaling           |
| Modal          | Serverless GPU, quick experiments     |
| Lambda Labs    | Affordable GPU cloud                 |
| Vast.ai        | Cheapest GPUs (marketplace)          |
+----------------+--------------------------------------+
```

### Data Versioning

```
+----------------+--------------------------------------+
| Tool           | Best For                             |
+----------------+--------------------------------------+
| DVC            | Git-like data versioning             |
| HuggingFace Hub| Model + dataset hosting              |
| Delta Lake     | Large-scale data lakes               |
| lakeFS         | Git-like for data lakes              |
+----------------+--------------------------------------+
```

---

## Git Conventions for Research

### Branch Naming

```
experiment/description        # Throwaway experiments
feat/description              # Features to merge
fix/description               # Bug fixes
refactor/description          # Code cleanup
```

### Commit Message Format

```
type: short description

Types:
  feat:      New feature or model component
  fix:       Bug fix
  exp:       Experiment results or configs
  refactor:  Code restructuring
  test:      Adding or updating tests
  data:      Data pipeline changes
  docs:      Documentation updates

Examples:
  feat: add grouped query attention
  fix: correct learning rate warmup calculation
  exp: run ablation on attention variants (see wandb/abc123)
  refactor: extract training loop into separate module
```

### Tagging Experiments

```bash
# Tag a successful experiment
git tag -a exp/v1.0 -m "Baseline results: 78.3% accuracy
Config: configs/baseline.yaml
Wandb: https://wandb.ai/..."

# Tag a milestone
git tag -a exp/reproduced -m "Successfully reproduced paper results
Gap: 0.3% (within noise)"
```

---

## Reproduction Checklist

```
Before starting:
  [ ] Read paper three times (three-pass method)
  [ ] List every hyperparameter mentioned
  [ ] Find official code repository
  [ ] Check for errata or updated versions

Environment:
  [ ] Pin Python version
  [ ] Pin PyTorch + CUDA versions
  [ ] Pin all library versions
  [ ] Set random seeds everywhere
  [ ] Enable deterministic mode

Data:
  [ ] Same dataset version as paper
  [ ] Same preprocessing pipeline
  [ ] Same train/val/test splits
  [ ] Verify dataset statistics match

Model:
  [ ] Parameter count matches paper
  [ ] Architecture matches (pre-norm vs post-norm, etc.)
  [ ] Initialization matches
  [ ] All components present (residuals, norms, etc.)

Training:
  [ ] Same optimizer and all its hyperparameters
  [ ] Same learning rate schedule
  [ ] Same batch size (effective, accounting for GPUs)
  [ ] Same number of epochs/steps
  [ ] Same gradient clipping

Evaluation:
  [ ] Same metrics
  [ ] Same evaluation protocol (single/multi crop, etc.)
  [ ] Same test set
  [ ] Multiple seeds (3-5 minimum)
```

---

## Production Readiness Checklist

```
Code quality:
  [ ] Type hints on all public functions
  [ ] Input validation on all entry points
  [ ] No hardcoded values (all in config)
  [ ] Error handling (no bare except)
  [ ] Tests (unit + integration + ML-specific)

Model:
  [ ] Exports to ONNX or TorchScript
  [ ] Inference works on CPU and GPU
  [ ] Deterministic in eval mode
  [ ] Save/load produces identical outputs
  [ ] Handles variable-length inputs

Serving:
  [ ] API endpoint with input validation
  [ ] Health check endpoint
  [ ] Latency within SLA
  [ ] Graceful error responses
  [ ] Batch inference supported

Monitoring:
  [ ] Prediction latency logged
  [ ] Prediction distribution tracked
  [ ] Error rate monitored
  [ ] Input/output samples saved for debugging

Documentation:
  [ ] Model card completed
  [ ] API documented
  [ ] Deployment runbook written
  [ ] Known limitations listed
```

---

## Quick Reference: PyTorch Patterns

### Set Seeds

```python
def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
```

### Save/Load Checkpoint

```python
def save_checkpoint(model, optimizer, epoch, path):
    torch.save({
        "epoch": epoch,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
    }, path)

def load_checkpoint(model, optimizer, path, device):
    ckpt = torch.load(path, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"])
    optimizer.load_state_dict(ckpt["optimizer_state_dict"])
    return ckpt["epoch"]
```

### Count Parameters

```python
def count_parameters(model):
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return {"total": total, "trainable": trainable}
```

### Profile Memory

```python
def profile_memory(model, input_shape, device="cuda"):
    torch.cuda.reset_peak_memory_stats()
    x = torch.randn(*input_shape, device=device)
    output = model(x)
    loss = output.sum()
    loss.backward()
    peak_mb = torch.cuda.max_memory_allocated() / (1024 ** 2)
    return f"Peak memory: {peak_mb:.1f} MB"
```
