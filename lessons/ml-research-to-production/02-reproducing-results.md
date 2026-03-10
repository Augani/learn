# Lesson 02: Reproducing Results

> **Analogy**: Reproducing a paper is like following a recipe from a
> Michelin-star chef. The recipe says "season to taste" and "cook
> until done." The photo looks incredible. Your version looks like
> a crime scene. The gap between what's written and what's needed
> is where all the real learning happens.

---

## Why Reproduction Matters

You read a paper. The results look promising. You want to use the
method. But can you actually trust those numbers?

Reproduction is the bridge between "I read about it" and "I
understand it." Until you've matched (or failed to match) someone
else's results, you don't truly know what the method does.

```
Confidence Ladder:

  "I read the abstract"          |  1%  confidence
  "I read the whole paper"       | 20%  confidence
  "I ran their code"             | 50%  confidence
  "I reproduced their results"   | 80%  confidence
  "I reimplemented from scratch" | 95%  confidence
  "I reproduced AND extended"    | 99%  confidence
```

Reproduction also protects you from building on quicksand. The
reproducibility crisis in ML is real -- some studies suggest 20-40%
of published results are difficult to reproduce.

---

## Common Reproducibility Failures

Before you start, know what can go wrong. These are the most
frequent reasons reproduction fails, ranked by how often they bite.

### 1. Missing Hyperparameters

Papers report the hyperparameters the authors think matter. They
often skip the ones they think are "obvious" -- but those defaults
differ across frameworks, versions, and even random seeds.

```
What the paper says:           What you actually need:

"lr = 0.001"                   lr = 0.001
"Adam optimizer"               Adam with beta1=0.9, beta2=0.999
                               epsilon=1e-8 (or was it 1e-7?)
                               weight_decay=0 (or 0.01?)
"batch size 256"               batch_size=256 (across how many GPUs?)
"trained for 90 epochs"        90 epochs with what scheduler?
                               Linear warmup? Cosine decay?
                               Warmup for how many steps?
```

### 2. Data Processing Differences

The same dataset processed differently gives different results.
Normalization, tokenization, augmentation, train/val splits -- any
of these can shift results by several percentage points.

```
ImageNet "standard" preprocessing:

  Paper A:       Resize(256) -> CenterCrop(224)
  Paper B:       Resize(224)
  Paper C:       RandomResizedCrop(224)
  Your attempt:  Resize(256) -> CenterCrop(224)

  Same dataset, same model, different numbers.
```

### 3. Framework and Library Versions

PyTorch 1.x and PyTorch 2.x have different default behaviors.
cuDNN versions affect numerical results. Even NumPy random number
generation changed between versions.

```
The version stack that matters:

  Python:      3.8 vs 3.10 vs 3.11
  PyTorch:     1.13 vs 2.0 vs 2.1
  CUDA:        11.7 vs 11.8 vs 12.1
  cuDNN:       8.6 vs 8.9
  NumPy:       1.23 vs 1.25
  Transformers: 4.28 vs 4.35

  Any one of these changing can shift results.
```

### 4. Random Seed Sensitivity

Some methods are highly sensitive to initialization. The paper
reports results from the best seed (or average of 3 seeds, but
which 3?).

### 5. Hardware Differences

Batch normalization statistics differ with batch size. If the paper
used 8 GPUs with batch size 32 per GPU (effective batch 256) and
you use 1 GPU with batch size 256, the results may differ because
batch norm computes statistics per-GPU.

```
Paper setup:     8x A100, batch 32/GPU  = effective batch 256
Your setup:      1x 3090, batch 256     = effective batch 256

Same effective batch size, DIFFERENT batch norm behavior.
```

---

## The Reproduction Workflow

### Step 1: Find Existing Implementations

Don't start from scratch. Check in this order:

```
  1. Official repo (linked in paper)          <-- Best
  2. Papers With Code listings                <-- Usually good
  3. Author's GitHub profile                  <-- Check forks
  4. HuggingFace model hub                    <-- Pre-trained
  5. Community reimplementations              <-- Verify first
```

If there's official code, start by running it unmodified. If you
can't reproduce results with their own code, the problem is either
environment-related or the paper's results were optimistic.

### Step 2: Set Up the Environment

Pin everything. Reproducibility starts with determinism.

```python
import torch
import numpy as np
import random

def set_seed(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False

set_seed(42)
```

Create an environment file:

```yaml
name: reproduce_paper_xyz
channels:
  - pytorch
  - nvidia
  - conda-forge
dependencies:
  - python=3.10.12
  - pytorch=2.1.0
  - torchvision=0.16.0
  - cuda-toolkit=11.8
  - numpy=1.25.2
  - pip:
    - transformers==4.35.0
    - wandb==0.16.0
```

### Step 3: Match the Data Pipeline Exactly

This is where most reproduction attempts fail silently. Get the
exact same data and process it the exact same way.

```python
import torchvision.transforms as T

paper_transform = T.Compose([
    T.RandomResizedCrop(224, scale=(0.08, 1.0)),
    T.RandomHorizontalFlip(),
    T.ColorJitter(0.4, 0.4, 0.4),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]),
])

your_transform = T.Compose([
    T.Resize(256),
    T.CenterCrop(224),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]),
])
```

Spot the difference? `RandomResizedCrop` with `scale=(0.08, 1.0)`
is very different from `Resize(256) -> CenterCrop(224)`. This
alone can cause a 2-3% gap in accuracy.

### Step 4: Run with Paper Hyperparameters

Don't tune anything. Use exactly what the paper says. If a
hyperparameter isn't mentioned, check:

1. The appendix
2. The supplementary material
3. The official codebase
4. The framework defaults for the paper's stated version

```
Hyperparameter Checklist:

  [ ] Learning rate (initial value)
  [ ] Learning rate schedule (warmup, decay)
  [ ] Optimizer (and ALL its parameters)
  [ ] Batch size (per-GPU and effective)
  [ ] Number of epochs/steps
  [ ] Weight initialization scheme
  [ ] Regularization (dropout, weight decay, label smoothing)
  [ ] Data augmentation (exact transforms and parameters)
  [ ] Model size (layers, hidden dims, heads)
  [ ] Gradient clipping (max norm)
  [ ] EMA decay rate (if used)
  [ ] Random seed(s)
```

### Step 5: Compare at Checkpoints, Not Just Final

Don't wait until training is done to check if you're on track.
Compare learning curves at intermediate points.

```
Paper reported:                Your reproduction:

Epoch 10:  loss=2.1            Epoch 10:  loss=2.3  (close enough)
Epoch 30:  loss=1.2            Epoch 30:  loss=1.8  (diverging...)
Epoch 90:  acc=76.5%           Epoch 90:  acc=73.1% (3.4% gap)
                                                     ^
                                              Something went wrong
                                              between epoch 10-30
```

If your curve diverges early, the problem is likely data processing
or initialization. If it diverges late, it's likely learning rate
schedule or regularization.

---

## When Results Don't Match

They won't match exactly. The question is: how close is close
enough?

```
Gap Analysis:

  < 0.5%:  Success. Noise from hardware/seeds.
  0.5-2%:  Likely a minor detail. Check data pipeline.
  2-5%:    Something is meaningfully different. Investigate.
  > 5%:    Something is fundamentally wrong. Start debugging.
```

### Debugging the Gap

Work through these in order:

```
1. Data pipeline
   - Verify dataset size (num samples, image sizes)
   - Compare a batch visually
   - Check normalization values
   - Verify train/val/test splits match

2. Model architecture
   - Print model and compare parameter count
   - Verify layer ordering, activation functions
   - Check for subtle differences (pre-norm vs post-norm)

3. Training procedure
   - Log learning rate at each step, compare to paper's schedule
   - Verify batch size behavior (gradient accumulation?)
   - Check loss function implementation details

4. Evaluation
   - Use the same metrics (accuracy vs top-5 accuracy)
   - Same evaluation protocol (single crop vs multi-crop)
   - Same test set (some papers use val as test)
```

```python
def verify_model_matches(your_model, reference_model):
    your_params = sum(p.numel() for p in your_model.parameters())
    ref_params = sum(p.numel() for p in reference_model.parameters())
    print(f"Your model:      {your_params:,} parameters")
    print(f"Reference model: {ref_params:,} parameters")

    if your_params != ref_params:
        print("MISMATCH -- check architecture")
        for (name_y, param_y), (name_r, param_r) in zip(
            your_model.named_parameters(),
            reference_model.named_parameters()
        ):
            if param_y.shape != param_r.shape:
                print(f"  {name_y}: {param_y.shape} vs {name_r}: {param_r.shape}")
```

### The "Close Enough" Decision

```
Ask yourself:

  1. Is my reproduction within the paper's stated variance?
     (If they report 76.5 +/- 0.3 and I get 76.1, that's fine.)

  2. Is the relative ordering preserved?
     (If method A > method B in the paper, same for me?)

  3. Is the gap explainable?
     (Different hardware, fewer GPUs, different library version?)

If yes to all three --> your reproduction is valid.
If no to any --> keep debugging.
```

---

## Official vs Community Implementations

```
+--------------------+-------------------+---------------------+
| Source             | Pros              | Cons                |
+--------------------+-------------------+---------------------+
| Official repo      | Matches paper     | Often messy code    |
|                    | Author-maintained | May be abandoned    |
|                    | Has pretrained    | Tied to one setup   |
+--------------------+-------------------+---------------------+
| Community (GitHub) | Cleaner code      | May have bugs       |
|                    | Better docs       | Subtle differences  |
|                    | Multiple versions | Unclear provenance  |
+--------------------+-------------------+---------------------+
| Library (HF, etc) | Well-tested       | May be simplified   |
|                    | Easy to use       | Missing options     |
|                    | Maintained        | Abstracted away     |
+--------------------+-------------------+---------------------+
```

Golden rule: if you need to match numbers exactly, use the official
repo. If you need production-quality code, use a maintained library
implementation. If you need to understand how it works, build it
yourself.

---

## Reproduction Report Template

Every reproduction attempt should produce a brief document:

```
Paper: [Title and arXiv link]
Date: [When you ran the reproduction]
Hardware: [GPUs, memory, etc.]

Environment:
  - Python: 3.10.12
  - PyTorch: 2.1.0
  - CUDA: 11.8

Implementation source: [Official/community/yours]

Results comparison:
  +------------------+--------+--------+------+
  | Metric           | Paper  | Ours   | Gap  |
  +------------------+--------+--------+------+
  | Top-1 Accuracy   | 76.5%  | 76.1%  | 0.4% |
  | Top-5 Accuracy   | 93.2%  | 93.0%  | 0.2% |
  | Training time    | 24hrs  | 28hrs  |      |
  +------------------+--------+--------+------+

Deviations from paper:
  - Used 4x A100 instead of 8x V100
  - PyTorch 2.1 instead of 1.12

Unresolved discrepancies:
  - [none / list them]

Notes:
  - [anything you learned]
```

---

## Practical Exercise

1. Pick a paper with official code and reported numbers
2. Clone the repo and set up the environment
3. Run the provided training script without modifications
4. Compare your numbers to the paper's Table 1
5. If there's a gap > 1%, investigate using the debugging checklist

Good starter papers for reproduction practice: ResNet, BERT
fine-tuning on GLUE, or a ViT variant. These have well-documented
reference implementations and widely reproduced results.

---

## Key Takeaways

- Reproduction is how you convert "I read about it" into "I
  understand it"
- Environment pinning is non-negotiable -- pin every version
- Data pipeline differences cause most silent failures
- Compare learning curves at intermediate points, not just final
  numbers
- A 1-2% gap is usually fine; >5% means something is fundamentally
  wrong
- Document every reproduction attempt, even failed ones

Next lesson: you've reproduced someone else's work. Now let's
implement a paper from scratch.
