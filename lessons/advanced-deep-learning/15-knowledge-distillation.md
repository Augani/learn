# Lesson 15: Knowledge Distillation

> A world-class expert spends decades mastering a field, then writes
> a textbook that lets a student learn the essentials in a semester.
> The student won't know everything the expert knows, but they'll
> know the right things. That's knowledge distillation: a big model
> (teacher) trains a small model (student) to be surprisingly good.

---

## Why Distillation?

```
  The deployment problem:

  Teacher model (GPT-4 class):
  +---------------------------+
  | 1.8 trillion parameters   |
  | Runs on 8x A100 cluster   |
  | 200ms per inference        |
  | $0.03 per query            |
  +---------------------------+

  Student model (distilled):
  +---------------------------+
  | 1.5 billion parameters    |
  | Runs on 1 consumer GPU    |
  | 15ms per inference         |
  | $0.0003 per query          |
  +---------------------------+

  1000x cheaper, 13x faster, 90% of the quality
```

---

## Hard Labels vs Soft Labels

```
  Classification: "Is this a cat, dog, or bird?"

  Hard labels (one-hot, from ground truth):
    Cat: [1, 0, 0]
    Dog: [0, 1, 0]

  Soft labels (from teacher model):
    Cat: [0.85, 0.13, 0.02]
    Dog: [0.05, 0.90, 0.05]

  Why soft labels are RICHER:

  Image of a tabby cat:
    Hard label: "cat"  (that's ALL the info)
    Soft label: [cat=0.85, dog=0.13, bird=0.02]

    The teacher is saying:
    "This is a cat, but I can see why someone might
     think it looks a bit like a dog. Definitely not
     a bird though."

  This "dark knowledge" teaches the student about
  RELATIONSHIPS between classes that hard labels miss.

  A Siamese cat photo:
    Soft: [cat=0.70, dog=0.25, bird=0.05]
    Teacher reveals: "Siamese cats look somewhat dog-like"

  A Persian cat photo:
    Soft: [cat=0.95, dog=0.03, bird=0.02]
    Teacher reveals: "This is very obviously a cat"
```

---

## Temperature Scaling

```
  Softmax with temperature T:

  softmax(z_i / T) = exp(z_i / T) / sum(exp(z_j / T))

  Logits: [5.0, 2.0, 0.5]

  T=1 (standard):   [0.92, 0.05, 0.03]  <-- very peaked
  T=2:              [0.73, 0.17, 0.10]  <-- softer
  T=5:              [0.47, 0.30, 0.23]  <-- much softer
  T=20:             [0.36, 0.33, 0.31]  <-- nearly uniform

  Low temperature:  Confident, peaked distributions
  High temperature: Soft, spread-out distributions

  For distillation:
  - Use T=1 for final inference
  - Use T=3-20 during distillation to reveal dark knowledge
  - Higher T exposes more of the teacher's uncertainty

  Analogy:
  T=1:  Expert says "Cat." (just the answer)
  T=5:  Expert says "Mostly cat, somewhat dog-like"
  T=20: Expert says "Could be anything, slight cat lean"
```

---

## Standard Knowledge Distillation

```
  +------------------+
  | Teacher (frozen) |
  +--------+---------+
           |
     soft predictions (T=high)
           |
           v
  +--------+---------+     +------------------+
  | Distillation     |     | Ground truth     |
  | loss (KL div)    |     | loss (CE)        |
  +--------+---------+     +--------+---------+
           |                        |
           +--- alpha ---+--- (1-alpha) ---+
                         |
                    Total loss
                         |
                         v
               +-------------------+
               | Student (trains)  |
               +-------------------+

  Total loss = alpha * T^2 * KL(teacher_soft, student_soft)
             + (1-alpha) * CE(ground_truth, student_hard)
```

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class DistillationLoss(nn.Module):
    def __init__(self, temperature=4.0, alpha=0.7):
        super().__init__()
        self.temperature = temperature
        self.alpha = alpha
        self.ce_loss = nn.CrossEntropyLoss()

    def forward(self, student_logits, teacher_logits, targets):
        soft_teacher = F.softmax(teacher_logits / self.temperature, dim=-1)
        soft_student = F.log_softmax(student_logits / self.temperature, dim=-1)

        distill_loss = F.kl_div(
            soft_student, soft_teacher, reduction="batchmean"
        ) * (self.temperature ** 2)

        hard_loss = self.ce_loss(student_logits, targets)

        return self.alpha * distill_loss + (1 - self.alpha) * hard_loss
```

---

## Full Distillation Training Loop

```python
import torch
from torch.utils.data import DataLoader


def distill(
    teacher,
    student,
    train_loader,
    optimizer,
    loss_fn,
    epochs=20,
    device="cuda",
):
    teacher.eval()
    teacher.to(device)
    student.to(device)

    for epoch in range(epochs):
        student.train()
        total_loss = 0.0
        correct = 0
        total = 0

        for inputs, targets in train_loader:
            inputs = inputs.to(device)
            targets = targets.to(device)

            with torch.no_grad():
                teacher_logits = teacher(inputs)

            student_logits = student(inputs)
            loss = loss_fn(student_logits, teacher_logits, targets)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            preds = student_logits.argmax(dim=-1)
            correct += (preds == targets).sum().item()
            total += targets.size(0)

        accuracy = correct / total
        avg_loss = total_loss / len(train_loader)
        print(f"Epoch {epoch+1}: loss={avg_loss:.4f}, acc={accuracy:.4f}")

    return student
```

---

## Feature-Based Distillation

Transfer knowledge from intermediate layers, not just outputs.

```
  Output-based:               Feature-based:
  Teacher                     Teacher
    |                           |     |     |
    output --> loss             L4    L8    L12 --> output
                                |     |     |       |
                                v     v     v       v
                               loss  loss  loss   loss
                                |     |     |       |
                                L2    L4    L6 --> output
                              Student

  The student learns to mimic the teacher's
  INTERNAL representations, not just final answers.
```

```python
class FeatureDistillationLoss(nn.Module):
    def __init__(self, teacher_dims, student_dims):
        super().__init__()
        self.projectors = nn.ModuleList([
            nn.Linear(s_dim, t_dim)
            for s_dim, t_dim in zip(student_dims, teacher_dims)
        ])

    def forward(self, student_features, teacher_features):
        total_loss = 0.0
        for proj, s_feat, t_feat in zip(
            self.projectors, student_features, teacher_features
        ):
            projected = proj(s_feat)
            total_loss += F.mse_loss(projected, t_feat.detach())
        return total_loss
```

---

## Distilling Language Models

```
  Teacher: Large LLM (70B parameters)
  Student: Small LLM (7B parameters)

  Strategy 1: Logit distillation
  - Run teacher on training text
  - Train student to match teacher's next-token probabilities
  - Need access to teacher weights

  Strategy 2: Data distillation (when teacher is an API)
  - Generate training data FROM the teacher
  - Train student on teacher-generated data
  - No teacher weights needed!

  +----------------+     +-------------------+
  | "Explain       | --> | Teacher generates |
  |  photosynthesis|     | detailed response |
  |  simply"       |     +--------+----------+
  +----------------+              |
                                  v
                    +----------------------------+
                    | (prompt, response) dataset  |
                    +-------------+--------------+
                                  |
                                  v
                    +----------------------------+
                    | Train student on this data  |
                    +----------------------------+
```

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import json


def generate_distillation_data(
    teacher_model, tokenizer, prompts, max_new_tokens=256
):
    teacher_model.eval()
    dataset = []

    for prompt in prompts:
        inputs = tokenizer(prompt, return_tensors="pt").to(teacher_model.device)

        with torch.no_grad():
            outputs = teacher_model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=0.7,
                do_sample=True,
            )

        response = tokenizer.decode(
            outputs[0][inputs.input_ids.shape[1]:],
            skip_special_tokens=True,
        )

        dataset.append({"prompt": prompt, "response": response})

    return dataset


def save_distillation_data(dataset, path):
    with open(path, "w") as f:
        for item in dataset:
            f.write(json.dumps(item) + "\n")
```

---

## Self-Distillation

The model is both teacher and student.

```
  Epoch 1: Train model normally
  Epoch 2: Use epoch-1 model as teacher for epoch-2 model
  Epoch 3: Use epoch-2 model as teacher for epoch-3 model

  OR: deeper layers teach shallower layers

  +------------+
  | Layer 12   | <-- "teacher" (deeper = more refined)
  +------------+
       |
       v  (soft targets)
  +------------+
  | Layer 8    | <-- "student"
  +------------+
       |
       v  (soft targets)
  +------------+
  | Layer 4    | <-- "student"
  +------------+

  Benefit: model regularizes itself, often improves accuracy
  with ZERO additional cost at inference time
```

---

## Distillation for Specific Tasks

```
  Task-specific distillation pipeline:

  Step 1: Fine-tune large teacher on your task
  +-------------------+     +-------------------+
  | GPT-4 / Llama 70B | --> | Fine-tuned on     |
  | (general)         |     | your task data    |
  +-------------------+     +-------------------+

  Step 2: Generate labeled data with teacher
  +-------------------+     +-------------------+
  | Your unlabeled    | --> | Teacher labels    |
  | data (cheap!)     |     | everything        |
  +-------------------+     +-------------------+

  Step 3: Train small student on labeled data
  +-------------------+     +-------------------+
  | Labeled data      | --> | Small student     |
  | (from teacher)    |     | (deployable)      |
  +-------------------+     +-------------------+

  Real example: sentiment analysis
  Teacher (70B, $0.03/query): 94% accuracy
  Student (125M, $0.0001/query): 91% accuracy
  Cost reduction: 300x for 3% accuracy drop
```

---

## Choosing Distillation Hyperparameters

```
  Temperature (T):
  +------+-----------------------------------------------+
  | T    | Effect                                         |
  +------+-----------------------------------------------+
  | 1-2  | Close to hard labels, minimal dark knowledge  |
  | 3-5  | Good balance, most common choice               |
  | 5-10 | Very soft, lots of inter-class info            |
  | 10+  | Too soft, signal washes out                    |
  +------+-----------------------------------------------+

  Alpha (weight of distillation vs hard loss):
  +----------+----------------------------------------------+
  | Alpha    | Effect                                        |
  +----------+----------------------------------------------+
  | 0.0      | No distillation, just hard labels             |
  | 0.3-0.5  | Balanced, good when labels are reliable       |
  | 0.7-0.9  | Distillation dominant, good for noisy labels  |
  | 1.0      | Pure distillation, ignore ground truth        |
  +----------+----------------------------------------------+

  Student size:
  - Too small: can't learn the teacher's knowledge
  - Sweet spot: 1/4 to 1/10 of teacher size
  - Diminishing returns below 1/20 of teacher
```

---

## Exercises

1. **Basic distillation**: Train a large CNN (ResNet-50) on
   CIFAR-10 as teacher. Distill to a small CNN (4-layer). Compare
   student accuracy with and without distillation.

2. **Temperature sweep**: Using the setup from exercise 1, try
   temperatures [1, 2, 4, 8, 16, 32]. Plot student accuracy vs
   temperature. Where is the sweet spot?

3. **Alpha sweep**: Fix temperature at 4. Vary alpha from 0 to 1
   in steps of 0.1. Which alpha gives the best student accuracy?

4. **Feature distillation**: Implement feature-based distillation
   where the student matches intermediate representations of the
   teacher. Compare to output-only distillation.

5. **LLM distillation**: Use a large LLM (via API) to generate
   a dataset of 1000 question-answer pairs on a topic. Fine-tune
   a small model on this data. Evaluate against the teacher's
   responses.

---

**Next**: [Lesson 16 - Neural Architecture Search](./16-neural-architecture-search.md)
