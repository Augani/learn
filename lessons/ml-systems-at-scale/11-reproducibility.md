# Lesson 11: Reproducibility

> **Analogy**: Reproducibility is like a recipe. If someone else
> follows your recipe -- same ingredients, same quantities, same
> oven temperature, same timing -- they should get the same dish.
> In ML, the "recipe" includes code, data, hyperparameters,
> hardware, random seeds, library versions, and even the order
> of operations. Miss any one ingredient and you get a different
> dish. At scale, with distributed training across hundreds of
> GPUs, even the concept of "same" gets complicated.

---

## Why Reproducibility Is Hard at Scale

```
Sources of non-determinism in distributed training:

+-----------------------------+----------------------------------+
| Source                      | Why It Happens                   |
+-----------------------------+----------------------------------+
| Floating-point reduction    | GPU all-reduce doesn't guarantee |
| order                       | addition order across GPUs       |
+-----------------------------+----------------------------------+
| cuDNN algorithm selection   | cuDNN auto-tunes and picks       |
|                             | different algorithms per run     |
+-----------------------------+----------------------------------+
| NCCL non-determinism        | Ring reduce timing varies        |
+-----------------------------+----------------------------------+
| Data loading order          | Multi-worker DataLoader order    |
|                             | depends on OS scheduling         |
+-----------------------------+----------------------------------+
| Dropout / random ops        | Different RNG state across       |
|                             | restarts or different GPU counts |
+-----------------------------+----------------------------------+
| Flash Attention             | Non-deterministic by default     |
+-----------------------------+----------------------------------+
| Different GPU counts        | Different batch composition      |
|                             | changes gradient averaging       |
+-----------------------------+----------------------------------+
```

---

## Levels of Reproducibility

```
Level 1: Same code + same hardware + same seed = same result
  Difficulty: Medium
  Requirement: Deterministic algorithms, fixed seeds

Level 2: Same code + different hardware + same seed = similar result
  Difficulty: Hard
  Requirement: Numerical equivalence across GPU architectures

Level 3: Someone else + your instructions = similar result
  Difficulty: Very Hard
  Requirement: Complete documentation, pinned dependencies,
               data versioning

Level 4: Same code + different GPU count = same result
  Difficulty: Nearly Impossible
  Requirement: Different batch composition means different
               training trajectory. Can only match learning
               dynamics, not exact values.
```

---

## Deterministic Training in PyTorch

### Setting All Seeds

```python
import os
import random
import numpy as np
import torch

def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    os.environ['PYTHONHASHSEED'] = str(seed)

set_seed(42)
```

### Enabling Deterministic Mode

```python
torch.use_deterministic_algorithms(True)
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False

os.environ['CUBLAS_WORKSPACE_CONFIG'] = ':4096:8'
```

The `CUBLAS_WORKSPACE_CONFIG` variable is required for
deterministic cuBLAS operations. Without it, matrix
multiplications may use different algorithms between runs.

### The Performance Cost

```
Deterministic mode performance impact:

+----------------------------+-----------+
| Operation                  | Slowdown  |
+----------------------------+-----------+
| cuDNN convolutions         | 10-30%    |
| Scatter/gather ops         | 5-20%     |
| Atomics (embedding lookup) | 20-50%    |
| Overall training           | 10-25%    |
+----------------------------+-----------+

For a 30-day training run at $500/hr:
  Non-deterministic: $360,000
  Deterministic (20% slower): $432,000
  Extra cost: $72,000

  Is reproducibility worth $72,000?

Compromise: Use deterministic mode for debugging and
validation runs. Use non-deterministic for production
training but track all other sources of variation.
```

---

## Experiment Tracking

At scale, you'll run hundreds of experiments. Without systematic
tracking, you'll lose track of what worked and why.

### What to Track

```
Every training run should record:

Code:
  [ ] Git commit hash
  [ ] Git diff (uncommitted changes)
  [ ] Branch name

Configuration:
  [ ] All hyperparameters (lr, batch_size, warmup, etc.)
  [ ] Model architecture config
  [ ] Data configuration (sources, mixture weights)
  [ ] Parallelism config (TP, PP, DP, FSDP settings)
  [ ] Hardware config (GPU type, count, interconnect)

Environment:
  [ ] PyTorch version
  [ ] CUDA version
  [ ] NCCL version
  [ ] Python version
  [ ] All pip/conda package versions
  [ ] GPU driver version
  [ ] OS version

Data:
  [ ] Dataset version / hash
  [ ] Data processing pipeline version
  [ ] Train/val/test split definition
  [ ] Tokenizer version

Training:
  [ ] Random seed
  [ ] Training metrics (loss, grad norm, lr, throughput)
  [ ] Evaluation results per checkpoint
  [ ] Checkpoint locations
  [ ] Total training time and cost
```

### Weights & Biases Setup

```python
import wandb
import subprocess
import pkg_resources

def init_experiment_tracking(config):
    git_hash = subprocess.check_output(
        ['git', 'rev-parse', 'HEAD']
    ).decode().strip()

    git_diff = subprocess.check_output(
        ['git', 'diff', '--stat']
    ).decode().strip()

    installed_packages = {
        pkg.key: pkg.version
        for pkg in pkg_resources.working_set
    }

    full_config = {
        **config,
        'git_hash': git_hash,
        'git_diff': git_diff,
        'pytorch_version': torch.__version__,
        'cuda_version': torch.version.cuda,
        'python_version': sys.version,
        'packages': installed_packages,
        'gpu_type': torch.cuda.get_device_name(0),
        'gpu_count': torch.cuda.device_count(),
    }

    wandb.init(
        project="large-model-training",
        config=full_config,
        tags=[
            f"model-{config['model_size']}",
            f"gpus-{config['world_size']}",
            config.get('experiment_tag', 'default'),
        ],
    )

    wandb.save("*.yaml")
    wandb.save("*.json")
```

---

## Configuration Management

Don't pass hyperparameters as command-line arguments. Use
structured configuration files.

### YAML Configuration

```yaml
model:
  name: llama-7b
  num_layers: 32
  hidden_size: 4096
  num_attention_heads: 32
  intermediate_size: 11008
  vocab_size: 32000
  max_seq_length: 4096

training:
  learning_rate: 3.0e-4
  min_learning_rate: 3.0e-5
  weight_decay: 0.1
  warmup_steps: 2000
  total_steps: 100000
  lr_schedule: cosine
  gradient_clip: 1.0
  seed: 42

batch:
  micro_batch_size: 4
  gradient_accumulation_steps: 8
  global_batch_size: 2048

distributed:
  tensor_parallel_size: 1
  pipeline_parallel_size: 1
  data_parallel_size: 8
  backend: nccl
  mixed_precision: bf16

data:
  train_data: /data/train.bin
  val_data: /data/val.bin
  tokenizer: meta-llama/Llama-2-7b-hf

checkpointing:
  save_interval: 1000
  save_dir: /checkpoints/run-001
  keep_last: 5
  activation_checkpointing: true
  checkpoint_every_n_layers: 4

logging:
  log_interval: 10
  eval_interval: 5000
  wandb_project: large-model-training
  wandb_entity: my-team
```

### Configuration Validation

```python
from dataclasses import dataclass, field
from typing import Optional
import yaml

@dataclass
class ModelConfig:
    name: str = "llama-7b"
    num_layers: int = 32
    hidden_size: int = 4096
    num_attention_heads: int = 32
    intermediate_size: int = 11008
    vocab_size: int = 32000
    max_seq_length: int = 4096

    def validate(self):
        if self.hidden_size % self.num_attention_heads != 0:
            raise ValueError(
                f"hidden_size ({self.hidden_size}) must be divisible "
                f"by num_attention_heads ({self.num_attention_heads})"
            )

@dataclass
class TrainingConfig:
    learning_rate: float = 3e-4
    min_learning_rate: float = 3e-5
    weight_decay: float = 0.1
    warmup_steps: int = 2000
    total_steps: int = 100000
    gradient_clip: float = 1.0
    seed: int = 42

    def validate(self):
        if self.min_learning_rate >= self.learning_rate:
            raise ValueError("min_learning_rate must be less than learning_rate")
        if self.warmup_steps >= self.total_steps:
            raise ValueError("warmup_steps must be less than total_steps")

@dataclass
class DistributedConfig:
    tensor_parallel_size: int = 1
    pipeline_parallel_size: int = 1
    data_parallel_size: int = 8
    mixed_precision: str = "bf16"

    def validate(self, world_size):
        expected = (self.tensor_parallel_size *
                    self.pipeline_parallel_size *
                    self.data_parallel_size)
        if expected != world_size:
            raise ValueError(
                f"TP({self.tensor_parallel_size}) * PP({self.pipeline_parallel_size}) "
                f"* DP({self.data_parallel_size}) = {expected} != world_size({world_size})"
            )

def load_config(path):
    with open(path) as f:
        raw = yaml.safe_load(f)

    model_cfg = ModelConfig(**raw.get('model', {}))
    train_cfg = TrainingConfig(**raw.get('training', {}))
    dist_cfg = DistributedConfig(**raw.get('distributed', {}))

    model_cfg.validate()
    train_cfg.validate()

    return model_cfg, train_cfg, dist_cfg
```

---

## Artifact Versioning

### Data Versioning

```python
import hashlib
import json
import os

def compute_dataset_hash(data_dir, sample_size=1000):
    files = sorted(os.listdir(data_dir))
    hasher = hashlib.sha256()

    hasher.update(str(len(files)).encode())
    hasher.update(str(sum(os.path.getsize(os.path.join(data_dir, f)) for f in files)).encode())

    import random
    random.seed(0)
    sampled = random.sample(files, min(sample_size, len(files)))

    for fname in sorted(sampled):
        filepath = os.path.join(data_dir, fname)
        with open(filepath, 'rb') as f:
            chunk = f.read(4096)
            hasher.update(chunk)

    return hasher.hexdigest()

def create_data_manifest(data_dir, output_path):
    manifest = {
        'data_dir': data_dir,
        'hash': compute_dataset_hash(data_dir),
        'num_files': len(os.listdir(data_dir)),
        'total_size_bytes': sum(
            os.path.getsize(os.path.join(data_dir, f))
            for f in os.listdir(data_dir)
        ),
        'created_at': datetime.now().isoformat(),
    }

    with open(output_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    return manifest
```

### Model Checkpoint Versioning

```python
import torch
import json
import os
from datetime import datetime

class VersionedCheckpointManager:
    def __init__(self, base_dir, run_id):
        self.base_dir = os.path.join(base_dir, run_id)
        self.manifest_path = os.path.join(self.base_dir, "manifest.json")
        os.makedirs(self.base_dir, exist_ok=True)

        if os.path.exists(self.manifest_path):
            with open(self.manifest_path) as f:
                self.manifest = json.load(f)
        else:
            self.manifest = {
                'run_id': run_id,
                'checkpoints': [],
                'created_at': datetime.now().isoformat(),
            }

    def save(self, model, optimizer, scheduler, step, metrics, config):
        ckpt_name = f"step-{step:08d}"
        ckpt_dir = os.path.join(self.base_dir, ckpt_name)
        os.makedirs(ckpt_dir, exist_ok=True)

        torch.save(model.state_dict(), os.path.join(ckpt_dir, "model.pt"))
        torch.save(optimizer.state_dict(), os.path.join(ckpt_dir, "optimizer.pt"))
        torch.save(scheduler.state_dict(), os.path.join(ckpt_dir, "scheduler.pt"))

        with open(os.path.join(ckpt_dir, "config.yaml"), 'w') as f:
            yaml.dump(config, f)

        entry = {
            'step': step,
            'path': ckpt_dir,
            'metrics': metrics,
            'timestamp': datetime.now().isoformat(),
        }
        self.manifest['checkpoints'].append(entry)

        with open(self.manifest_path, 'w') as f:
            json.dump(self.manifest, f, indent=2)
```

---

## Environment Reproducibility

### Docker for Exact Environment

```dockerfile
FROM nvcr.io/nvidia/pytorch:24.01-py3

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

RUN pip freeze > /opt/frozen-requirements.txt

COPY . /workspace
WORKDIR /workspace

RUN python -c "import torch; print(f'PyTorch {torch.__version__}, CUDA {torch.version.cuda}')"
```

### requirements.txt with Exact Versions

```
torch==2.2.0
transformers==4.38.1
deepspeed==0.13.1
flash-attn==2.5.0
wandb==0.16.3
numpy==1.26.3
sentencepiece==0.1.99
tokenizers==0.15.1
datasets==2.16.1
accelerate==0.26.1
safetensors==0.4.1
```

Never use `>=` or `~=` in production training requirements.
Pin exact versions. A minor version bump in any dependency can
change numerical behavior.

---

## Documenting Training Runs

### Run Report Template

```markdown
# Training Run Report: {run_id}

## Summary
- Model: {model_name} ({num_params} parameters)
- Dataset: {dataset_name} ({num_tokens} tokens)
- Hardware: {num_gpus}x {gpu_type}
- Duration: {training_days} days
- Final loss: {final_loss}
- Cost: ${total_cost}

## Configuration
- Config file: {config_path} (git hash: {git_hash})
- Parallelism: TP={tp}, PP={pp}, DP={dp}
- Batch: micro={micro_bs}, accum={accum}, global={global_bs}
- LR: {peak_lr} with {schedule} schedule, {warmup} warmup steps

## Key Metrics
| Benchmark | Score | Previous Best |
|-----------|-------|---------------|
| MMLU      | X%    | Y%            |
| HumanEval | X%    | Y%            |
| ...       | ...   | ...           |

## Issues Encountered
- Step 45K: Loss spike, recovered by rolling back 500 steps
- Node 12: GPU 3 ECC error at step 67K, replaced node

## Artifacts
- Checkpoints: {checkpoint_location}
- Logs: {log_location}
- Eval results: {eval_location}
- Data manifest: {data_manifest_path}
```

### Automated Report Generation

```python
def generate_run_report(run_dir, wandb_run_id):
    manifest_path = os.path.join(run_dir, "manifest.json")
    with open(manifest_path) as f:
        manifest = json.load(f)

    config_path = os.path.join(run_dir, "config.yaml")
    with open(config_path) as f:
        config = yaml.safe_load(f)

    api = wandb.Api()
    run = api.run(f"my-team/large-model-training/{wandb_run_id}")
    history = run.history()

    final_loss = history['train/loss'].iloc[-1]
    peak_throughput = history['throughput/tokens_per_second'].max()
    total_steps = len(history)

    report = f"""# Training Run Report: {manifest['run_id']}

## Summary
- Model: {config['model']['name']}
- Training steps: {total_steps}
- Final loss: {final_loss:.4f}
- Peak throughput: {peak_throughput:.0f} tokens/sec

## Checkpoints
"""
    for ckpt in manifest['checkpoints']:
        report += f"- Step {ckpt['step']}: loss={ckpt['metrics'].get('loss', 'N/A')}\n"

    return report
```

---

## Reproducing Others' Results

When trying to reproduce a paper or blog post:

```
Checklist for reproduction:

  1. Exact same data?
     [ ] Same dataset version (not just name)
     [ ] Same preprocessing pipeline
     [ ] Same tokenizer and vocab
     [ ] Same data ordering / shuffling

  2. Exact same model?
     [ ] Same architecture (check hidden details)
     [ ] Same initialization
     [ ] Same normalization (pre-norm vs post-norm)
     [ ] Same activation function (GeLU vs SiLU vs ReLU)

  3. Exact same training?
     [ ] Same optimizer and hyperparameters
     [ ] Same learning rate schedule (including warmup shape)
     [ ] Same batch size and accumulation
     [ ] Same gradient clipping value
     [ ] Same mixed precision settings
     [ ] Same parallelism strategy (can affect numerics)

  4. Exact same evaluation?
     [ ] Same evaluation harness version
     [ ] Same number of few-shot examples
     [ ] Same prompt format
     [ ] Same decoding strategy (greedy vs sampling)

  Common gotcha: Papers report 5-shot MMLU but don't specify
  WHICH 5 examples. Different selections can swing results 1-2%.
```

---

## Exercises

1. **Deterministic training**: Take a simple training loop and
   make it fully deterministic. Verify by running twice with the
   same seed and comparing loss at every step. Then enable
   distributed training and identify which operations break
   determinism.

2. **Experiment tracking**: Set up Weights & Biases tracking
   that captures all items from the "What to Track" checklist.
   Run 3 experiments with different learning rates and create
   a comparison view.

3. **Configuration management**: Create a config validation
   system that catches common errors (mismatched parallelism
   degrees, impossible batch sizes, invalid LR schedules)
   before training starts.

4. **Reproduction exercise**: Pick a published training recipe
   (e.g., from a LLaMA paper or technical report) and attempt
   to reproduce the reported benchmark scores at a smaller scale
   (e.g., 1B params instead of 7B). Document every deviation
   from the original recipe and its impact.
