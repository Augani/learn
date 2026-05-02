# Lesson 12: Build a Research Project (Capstone)

> **Analogy**: This capstone is your thesis defense. Not a 200-page
> tome, but a demonstration that you can take a raw idea from a
> paper, build it with your own hands, prove it works, and package
> it so others can use it. It's everything from this track in one
> project.

---

## The Capstone Challenge

Take a recent ML paper (published in the last 12-18 months),
implement its core contribution from scratch, reproduce the key
results, and then package it as production-ready code.

This is not a tutorial exercise. This is what research engineers
do at their day jobs. The difference is that now you have a
structured process from the previous 11 lessons.

```
The pipeline you've learned:

  Lesson 01: Read the paper         --> Select and understand
  Lesson 02: Reproduce results      --> Match their numbers
  Lesson 03: Implement from scratch --> Build it yourself
  Lesson 04: Design experiments     --> Prove it works
  Lesson 05: Engineering workflow   --> Organize the project
  Lesson 06: Custom training loop   --> Train it properly
  Lesson 07: Custom architecture    --> Build novel components
  Lesson 08: Custom losses          --> Implement their loss
  Lesson 09: Dataset work           --> Handle the data right
  Lesson 10: Benchmarking           --> Compare fairly
  Lesson 11: Production code        --> Ship it
```

---

## Phase 1: Paper Selection (Day 1)

### Criteria for a Good Capstone Paper

```
+-------------------+-----------------------------------------------+
| Criterion         | Why It Matters                                |
+-------------------+-----------------------------------------------+
| Recent            | Shows you can handle current research         |
| Has code          | You can verify your implementation            |
| Clear method      | You can actually understand what to build     |
| Reasonable compute| Reproducible on 1-2 GPUs in < 48 hours       |
| Standard datasets | No need to collect custom data                |
| Interesting to you| You'll spend 3+ weeks on this                 |
+-------------------+-----------------------------------------------+
```

### Recommended Paper Categories

Pick ONE of these categories based on your interests:

```
Computer Vision:
  - A new attention mechanism for ViT
  - An efficient object detection method
  - A self-supervised learning approach

NLP:
  - A parameter-efficient fine-tuning method (LoRA variant)
  - A new decoding strategy for language models
  - A retrieval-augmented generation approach

General ML:
  - A new optimization technique
  - A contrastive learning framework
  - A knowledge distillation method
```

### Selection Checklist

Before committing to a paper, verify:

```
[ ] I can explain the main contribution in one sentence
[ ] The method section is clear enough to implement
[ ] Official code is available (for verification, not copying)
[ ] The main experiment is reproducible on my hardware
[ ] The datasets are publicly available
[ ] I find this paper genuinely interesting
```

---

## Phase 2: Understanding (Days 2-4)

### Three-Pass Reading

Apply the reading method from Lesson 01 for real.

```
Pass 1 (30 min):
  - Read abstract, intro, conclusion
  - Look at all figures
  - Write one-sentence summary
  - Decision: proceed or pick another paper

Pass 2 (2-3 hours):
  - Read entire paper
  - Take structured notes
  - Identify key equations
  - List every hyperparameter mentioned
  - Map the method to code components

Pass 3 (2-3 hours):
  - Work through math derivations
  - Read cited papers for unfamiliar concepts
  - Study the appendix and supplementary material
  - List implementation details NOT in the paper
```

### Implementation Plan

After three passes, create a concrete plan:

```
IMPLEMENTATION PLAN
-------------------

Paper: [Title]
Core contribution: [One sentence]

Components to implement:
  1. [Component A] -- estimated: 4 hours
     - Key equations: [Eq 1, 2]
     - Depends on: nothing
     - Test strategy: shape check + comparison to reference

  2. [Component B] -- estimated: 6 hours
     - Key equations: [Eq 3, 4, 5]
     - Depends on: Component A
     - Test strategy: unit test against paper's Figure 3

  3. [Training procedure] -- estimated: 4 hours
     - Special requirements: [curriculum, multi-task, etc.]
     - Depends on: Components A, B
     - Test strategy: overfit one batch

  4. [Evaluation] -- estimated: 3 hours
     - Metrics: [what the paper reports]
     - Datasets: [which ones]
     - Test strategy: match paper's Table 1

Missing details I need to find:
  - [Hyperparameter X: not mentioned in paper]
  - [Initialization: not specified]
  - [Data preprocessing: partially described]

Where to look:
  - Official codebase
  - Author's other papers
  - Issues on the GitHub repo
```

---

## Phase 3: Implementation (Days 5-12)

### Project Setup

```
capstone/
├── configs/
│   ├── reproduce.yaml         # Match paper's exact setup
│   ├── small_debug.yaml       # Quick debug runs
│   └── ablation_base.yaml     # Ablation experiments
├── src/
│   ├── __init__.py
│   ├── model.py               # Architecture implementation
│   ├── losses.py              # Custom loss functions
│   ├── data.py                # Dataset and preprocessing
│   ├── train.py               # Training loop
│   ├── evaluate.py            # Evaluation metrics
│   └── utils.py               # Shared utilities
├── tests/
│   ├── test_model.py
│   ├── test_losses.py
│   ├── test_data.py
│   └── test_integration.py
├── scripts/
│   ├── train.sh
│   ├── evaluate.sh
│   └── export.sh
├── notebooks/
│   ├── 01-explore-data.ipynb
│   └── 02-analyze-results.ipynb
├── requirements.txt
├── pyproject.toml
└── MODEL_CARD.md
```

### Implementation Order

Build bottom-up. Test each layer before adding the next.

```
Day 5-6: Data pipeline
  - Download and verify datasets
  - Implement preprocessing (match paper exactly)
  - Write data loader
  - Test: verify batch shapes, sample counts, augmentation

Day 7-8: Model architecture
  - Implement each component (Lesson 07 techniques)
  - Test shapes at every boundary
  - Verify parameter count matches paper
  - Test: forward pass, backward pass, save/load

Day 9: Loss function
  - Implement custom loss (Lesson 08 techniques)
  - Test: known input/output pairs, gradient flow
  - Test: compare to simple reference implementation

Day 10-11: Training loop
  - Implement custom loop (Lesson 06 techniques)
  - Add logging (wandb or similar)
  - Test: overfit one batch (must reach near-zero loss)
  - Run small-scale experiment (small dataset, few epochs)

Day 12: Debug and iterate
  - Compare learning curves to paper's figures
  - Fix any discrepancies
  - Run full-scale training
```

### The Debugging Notebook

Keep a running notebook of issues and solutions:

```
## Implementation Log

### Day 5 - Data Pipeline
- Downloaded ImageNet. Took 6 hours.
- Paper says "standard augmentation" -- looked at official code,
  they use: RandomResizedCrop(224), RandomHorizontalFlip(),
  ColorJitter(0.4, 0.4, 0.4), Normalize(imagenet_mean, imagenet_std)
- val transform: Resize(256), CenterCrop(224), Normalize

### Day 7 - Model
- Parameter count: paper says 86M, I have 87.2M
  - Found the difference: they don't use bias in attention projections
  - After fix: 86.1M (close enough, remaining diff is embedding)
- Shape mismatch in cross-attention: Q and K had swapped dims
  - Root cause: I was transposing before splitting heads instead of after

### Day 10 - Training
- Loss not decreasing after 100 steps
  - Checked: gradients flowing (yes)
  - Checked: learning rate (correct)
  - Found: temperature parameter was too low (0.01 instead of 0.07)
  - After fix: loss starts decreasing immediately
```

---

## Phase 4: Reproduction (Days 13-17)

### Running the Full Experiment

```python
REPRODUCE_CONFIG = {
    "model": {
        "hidden_dim": 768,
        "num_heads": 12,
        "num_layers": 12,
    },
    "training": {
        "learning_rate": 3e-4,
        "warmup_epochs": 10,
        "total_epochs": 100,
        "batch_size": 256,
        "weight_decay": 0.05,
        "optimizer": "adamw",
        "scheduler": "cosine",
    },
    "data": {
        "dataset": "imagenet",
        "image_size": 224,
    },
    "seeds": [42, 123, 456],
}
```

### Results Comparison

```
REPRODUCTION RESULTS
--------------------

Main metric (Top-1 Accuracy on ImageNet):

+------------------+---------+---------+--------+
|                  | Paper   | Ours    | Gap    |
+------------------+---------+---------+--------+
| Seed 42          |   --    | 79.8%   |        |
| Seed 123         |   --    | 79.5%   |        |
| Seed 456         |   --    | 80.1%   |        |
| Mean +/- std     | 80.1%   | 79.8%   | -0.3%  |
|                  | (+/- ?) | (+/- 0.3)|       |
+------------------+---------+---------+--------+

Verdict: Within acceptable range (<0.5% gap).

Training curve comparison:
  - Loss at epoch 10: paper ~2.1, ours 2.15 (match)
  - Loss at epoch 50: paper ~0.8, ours 0.83 (close)
  - Final loss: paper ~0.45, ours 0.47 (acceptable)
```

### If Results Don't Match

```
Gap > 1%? Systematic debugging:

  1. Compare data pipeline line by line against official code
  2. Verify model architecture (parameter count, layer order)
  3. Check learning rate schedule (plot LR over steps)
  4. Compare batch statistics (mean, std of activations)
  5. Try their exact seeds if published
  6. File an issue on their repo (politely)
  7. Check if their reported numbers are average or best-of

Document the gap honestly. A well-documented 2% gap with a clear
explanation is more valuable than a suspicious exact match.
```

---

## Phase 5: Ablation Study (Days 18-20)

Design ablations that test the paper's claims.

```
ABLATION PLAN
-------------

If the paper claims: "Component X improves performance by 2%"
Then test: Full model vs model without X

+-----------------------------+----------+--------+
| Configuration               | Accuracy | Delta  |
+-----------------------------+----------+--------+
| Full model (reproduced)     | 79.8%    |   --   |
| - Remove novel attention    | 77.5%    | -2.3%  |
| - Remove data augmentation  | 78.9%    | -0.9%  |
| - Replace loss with CE      | 78.1%    | -1.7%  |
| - Use standard position enc | 79.3%    | -0.5%  |
| Simple baseline (ResNet-50) | 76.1%    | -3.7%  |
+-----------------------------+----------+--------+

Run each ablation with 3 seeds.
Report mean +/- std.
Include statistical significance tests.
```

---

## Phase 6: Productionize (Days 21-25)

### Refactoring Checklist

```
[ ] All config extracted to YAML/dataclass
[ ] Input validation on all public methods
[ ] Error handling (no bare exceptions)
[ ] Type hints on all public functions
[ ] Model export (ONNX or TorchScript)
[ ] Inference-only mode (no training code required)
[ ] CPU and GPU support
[ ] Deterministic inference
```

### Test Suite

```python
class TestCapstoneModel:
    def test_forward_shapes(self):
        ...

    def test_backward_gradients(self):
        ...

    def test_save_load_deterministic(self):
        ...

    def test_export_onnx(self):
        ...

    def test_empty_input_handling(self):
        ...

    def test_long_input_handling(self):
        ...

    def test_batch_independence(self):
        ...

    def test_minimum_accuracy(self):
        ...

    def test_inference_latency(self):
        start = time.perf_counter()
        for _ in range(100):
            model.predict(sample_input)
        avg_ms = (time.perf_counter() - start) / 100 * 1000
        assert avg_ms < 50, f"Latency {avg_ms}ms exceeds 50ms target"
```

### API Endpoint

```python
@app.post("/predict")
async def predict(request: PredictionRequest):
    ...

@app.post("/batch_predict")
async def batch_predict(request: BatchRequest):
    ...

@app.get("/health")
async def health():
    ...

@app.get("/model_info")
async def model_info():
    return {
        "paper": "...",
        "architecture": "...",
        "num_parameters": "...",
        "reproduced_accuracy": "...",
        "export_format": "...",
    }
```

---

## Phase 7: Documentation and Delivery (Days 26-28)

### The Deliverables

```
1. Working implementation
   - Clean, tested, documented code
   - Passes all tests
   - Installable as a package

2. Reproduction report
   - Results comparison table
   - Training curves
   - Ablation study
   - Gap analysis (if any)

3. Model card
   - Architecture, data, training details
   - Performance metrics
   - Limitations and intended use
   - Ethical considerations

4. API/serving code
   - FastAPI endpoint
   - Health check
   - Latency benchmarks

5. Experiment artifacts
   - Configs for all experiments
   - Links to wandb runs
   - Checkpoints (or instructions to reproduce)
```

### Self-Evaluation Rubric

```
Score yourself:

Paper Understanding (20%):
  [ ] Can explain the method without looking at the paper
  [ ] Identified unstated assumptions
  [ ] Read and understood key references

Implementation Quality (25%):
  [ ] Clean, modular code
  [ ] Comprehensive test suite
  [ ] No hardcoded values
  [ ] Proper error handling

Reproduction (25%):
  [ ] Results within 1% of paper
  [ ] Multiple seeds with error bars
  [ ] Training curves match
  [ ] Ablation study completed

Production Readiness (20%):
  [ ] Model exports successfully
  [ ] API endpoint works
  [ ] Input validation handles edge cases
  [ ] Latency meets reasonable targets

Documentation (10%):
  [ ] Model card completed
  [ ] Reproduction report written
  [ ] Code has type hints and docstrings on public API
```

---

## Sample Timeline

```
Week 1:  Select paper, read deeply, plan implementation
Week 2:  Implement model, data, training loop
Week 3:  Reproduce results, run ablations
Week 4:  Productionize, test, document, deliver

Daily time: 2-3 hours on weekdays, 4-5 hours on weekends
Total: ~60-80 hours
```

---

## After the Capstone

This project is a portfolio piece. It demonstrates:

- You can read and understand current ML research
- You can implement novel methods from scratch
- You can reproduce published results
- You can write production-quality ML code
- You can design and run proper experiments

Every one of these skills is valuable. Together, they make you
a research engineer who can bridge the gap between papers and
products.

```
What you can do now:

  Read a paper           --> "I should try this on our data"
  Implement it           --> "Here's a working prototype"
  Validate it            --> "It actually improves accuracy by 3%"
  Ship it                --> "It's in production, handling 1M req/day"
  Explain it             --> "Here's why it works and when it doesn't"
```

---

## Key Takeaways

- The capstone integrates everything: reading, implementing,
  experimenting, and shipping
- Budget 4 weeks; most of the time goes to debugging, not coding
- Document the journey, not just the destination -- the debugging
  log is often more valuable than the final code
- A 1-2% reproduction gap is normal and acceptable if documented
- The goal is demonstration of skill, not perfection
- This project is your proof that you can bridge research and
  production

Congratulations. You've completed the ML Research to Production
track.
