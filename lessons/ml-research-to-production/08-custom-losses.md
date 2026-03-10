# Lesson 08: Custom Loss Functions

> **Analogy**: The loss function is the grade on the exam. Cross-
> entropy says "right or wrong." Focal loss says "right or wrong,
> but I care more about the hard questions." Contrastive loss says
> "I don't care about the answers, just make sure similar students
> sit together." The choice of grading rubric determines what the
> model learns.

---

## Why Custom Losses?

Cross-entropy and MSE handle most supervised learning tasks. But
they have assumptions:

- Cross-entropy assumes balanced classes
- MSE assumes Gaussian noise
- Both assume your labels are perfect
- Neither understands relationships between classes

When those assumptions break, you need a different loss.

```
When to customize your loss:

  Imbalanced classes      --> Focal loss, class weighting
  Noisy labels            --> Label smoothing, symmetric CE
  Learning representations --> Contrastive losses
  Multiple objectives     --> Multi-task loss balancing
  Ranking/retrieval       --> Triplet loss, InfoNCE
  Structured output       --> Custom domain-specific losses
```

---

## Focal Loss

Cross-entropy treats all misclassifications equally. Focal loss
downweights easy examples so the model focuses on hard ones.
Invented for object detection where 99%+ of proposals are
background (easy negatives).

```
Standard CE:      L = -log(p_t)
Focal Loss:       L = -alpha_t * (1 - p_t)^gamma * log(p_t)

Where:
  p_t = model's probability for the correct class
  gamma = focusing parameter (typically 2.0)
  alpha_t = class balancing weight
```

```python
import torch
import torch.nn.functional as F

class FocalLoss(torch.nn.Module):
    def __init__(self, alpha=None, gamma=2.0, reduction="mean"):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, logits, targets):
        ce_loss = F.cross_entropy(logits, targets, reduction="none")
        pt = torch.exp(-ce_loss)
        focal_weight = (1 - pt) ** self.gamma

        if self.alpha is not None:
            if isinstance(self.alpha, (list, torch.Tensor)):
                alpha_t = torch.tensor(self.alpha, device=logits.device)[targets]
            else:
                alpha_t = self.alpha
            focal_weight = alpha_t * focal_weight

        loss = focal_weight * ce_loss

        if self.reduction == "mean":
            return loss.mean()
        elif self.reduction == "sum":
            return loss.sum()
        return loss
```

```
Effect of gamma on loss:

  p_t (confidence) | CE loss | Focal (gamma=2)
  ---------------+----------+------------------
  0.9 (easy)      |  0.105  |  0.001  (100x less!)
  0.5 (medium)    |  0.693  |  0.173  (4x less)
  0.1 (hard)      |  2.303  |  1.866  (barely changed)

  gamma=0: Standard cross-entropy
  gamma=1: Mild focusing
  gamma=2: Strong focusing (default, works well)
  gamma=5: Extreme focusing (rarely needed)
```

---

## Label Smoothing

Instead of training with hard labels (one-hot), distribute some
probability mass to other classes. Prevents overconfident
predictions and acts as a regularizer.

```
Hard labels:     [0, 0, 1, 0, 0]
Smoothed (0.1):  [0.02, 0.02, 0.92, 0.02, 0.02]

Formula:
  y_smooth = (1 - epsilon) * y_hard + epsilon / num_classes
```

```python
class LabelSmoothingCrossEntropy(torch.nn.Module):
    def __init__(self, epsilon=0.1, reduction="mean"):
        super().__init__()
        self.epsilon = epsilon
        self.reduction = reduction

    def forward(self, logits, targets):
        num_classes = logits.size(-1)
        log_probs = F.log_softmax(logits, dim=-1)

        nll_loss = F.nll_loss(log_probs, targets, reduction="none")
        smooth_loss = -log_probs.mean(dim=-1)

        loss = (1 - self.epsilon) * nll_loss + self.epsilon * smooth_loss

        if self.reduction == "mean":
            return loss.mean()
        return loss
```

```
When to use label smoothing:

  Almost always for classification.
  epsilon = 0.1 is a good default.

  Especially useful when:
  - You have noisy labels
  - Classes are subjective (sentiment, style)
  - You want calibrated confidence scores
  - Training a teacher model for distillation
```

---

## Contrastive Losses

Contrastive losses learn representations by pulling similar items
together and pushing different items apart. They don't need class
labels -- just pairs of positive (similar) and negative (different)
examples.

### Triplet Loss

The simplest contrastive loss. Takes an anchor, a positive (same
class), and a negative (different class).

```
Goal: d(anchor, positive) < d(anchor, negative) - margin

  anchor ----[close]---- positive
     \
      \---[far]----- negative
```

```python
class TripletLoss(torch.nn.Module):
    def __init__(self, margin=1.0):
        super().__init__()
        self.margin = margin

    def forward(self, anchor, positive, negative):
        d_pos = F.pairwise_distance(anchor, positive)
        d_neg = F.pairwise_distance(anchor, negative)
        loss = torch.clamp(d_pos - d_neg + self.margin, min=0.0)
        return loss.mean()
```

Problem with triplet loss: **triplet mining is hard**. Most random
triplets are too easy (loss = 0). You need to find hard negatives
that are close to the anchor but from a different class.

```python
def hard_negative_mining(anchors, positives, all_embeddings, all_labels, anchor_labels):
    distances = torch.cdist(anchors, all_embeddings)

    hard_negatives = []
    for i in range(anchors.size(0)):
        different_class = all_labels != anchor_labels[i]
        masked_distances = distances[i].clone()
        masked_distances[~different_class] = float("inf")
        hardest_neg_idx = masked_distances.argmin()
        hard_negatives.append(all_embeddings[hardest_neg_idx])

    return torch.stack(hard_negatives)
```

### NT-Xent (Normalized Temperature-scaled Cross-Entropy)

Used in SimCLR. Given a batch of N items, each with two augmented
views, create 2N examples. Each example has 1 positive pair (its
other view) and 2(N-1) negatives (everyone else's views).

```python
class NTXentLoss(torch.nn.Module):
    def __init__(self, temperature=0.5):
        super().__init__()
        self.temperature = temperature

    def forward(self, z_i, z_j):
        batch_size = z_i.size(0)
        z = torch.cat([z_i, z_j], dim=0)
        z = F.normalize(z, dim=-1)

        sim_matrix = torch.matmul(z, z.T) / self.temperature

        mask = torch.eye(2 * batch_size, device=z.device, dtype=torch.bool)
        sim_matrix = sim_matrix.masked_fill(mask, float("-inf"))

        pos_indices = torch.cat([
            torch.arange(batch_size, 2 * batch_size),
            torch.arange(0, batch_size),
        ]).to(z.device)

        loss = F.cross_entropy(sim_matrix, pos_indices)
        return loss
```

```
NT-Xent with batch of 4 (8 views total):

  Similarity matrix (8x8):

       z1  z2  z3  z4  z1' z2' z3' z4'
  z1  [-∞  .   .   .   +   .   .   .  ]   <-- z1' is positive
  z2  [ .  -∞  .   .   .   +   .   .  ]
  z3  [ .   .  -∞  .   .   .   +   .  ]
  z4  [ .   .   .  -∞  .   .   .   +  ]
  z1' [ +   .   .   .  -∞  .   .   .  ]
  z2' [ .   +   .   .   .  -∞  .   .  ]
  z3' [ .   .   +   .   .   .  -∞  .  ]
  z4' [ .   .   .   +   .   .   .  -∞ ]

  + = positive pair, . = negative, -∞ = self (masked)
  Apply cross-entropy: maximize + relative to all .
```

### InfoNCE

The theoretical foundation behind NT-Xent and many modern
contrastive losses. Maximizes mutual information between positive
pairs.

```python
class InfoNCELoss(torch.nn.Module):
    def __init__(self, temperature=0.07):
        super().__init__()
        self.temperature = temperature

    def forward(self, query, positive_key, negative_keys):
        query = F.normalize(query, dim=-1)
        positive_key = F.normalize(positive_key, dim=-1)
        negative_keys = F.normalize(negative_keys, dim=-1)

        pos_score = torch.sum(query * positive_key, dim=-1, keepdim=True)
        neg_scores = torch.matmul(query, negative_keys.T)

        logits = torch.cat([pos_score, neg_scores], dim=-1)
        logits = logits / self.temperature

        labels = torch.zeros(query.size(0), dtype=torch.long, device=query.device)
        return F.cross_entropy(logits, labels)
```

```
Contrastive loss comparison:

  +----------+-------------+------------------+------------------+
  | Loss     | Pairs       | Key Idea         | Used By          |
  +----------+-------------+------------------+------------------+
  | Triplet  | Anchor,+,-  | Margin-based     | FaceNet          |
  | NT-Xent  | In-batch    | Temperature      | SimCLR           |
  | InfoNCE  | Query + keys| Mutual info      | CLIP, MoCo       |
  | SupCon   | In-batch    | Label-aware      | Supervised       |
  |          |             | contrastive      | contrastive      |
  +----------+-------------+------------------+------------------+
```

---

## Multi-Task Loss Balancing

When your model optimizes multiple objectives, balancing them is
both art and science.

### The Problem

```
Task A loss:  ~0.5  (classification)
Task B loss:  ~50.0 (regression with large values)
Task C loss:  ~0.01 (binary prediction)

Simple sum: 0.5 + 50.0 + 0.01 = 50.51
  --> Task B dominates! Tasks A and C are invisible.
```

### Strategy 1: Normalize by Initial Loss

```python
class NormalizedMultiTaskLoss(torch.nn.Module):
    def __init__(self, num_tasks):
        super().__init__()
        self.initial_losses = None

    def forward(self, losses):
        if self.initial_losses is None:
            self.initial_losses = {k: v.item() for k, v in losses.items()}

        total = 0.0
        for name, loss in losses.items():
            normalized = loss / (self.initial_losses[name] + 1e-8)
            total += normalized
        return total
```

### Strategy 2: GradNorm

Dynamically balance gradient magnitudes across tasks. From the
GradNorm paper (Chen et al., 2018).

```python
class GradNormBalancer:
    def __init__(self, num_tasks, alpha=1.5):
        self.task_weights = torch.ones(num_tasks, requires_grad=True)
        self.alpha = alpha
        self.initial_losses = None

    def compute_weighted_loss(self, losses):
        if self.initial_losses is None:
            self.initial_losses = [loss.item() for loss in losses]

        weighted = sum(w * loss for w, loss in zip(self.task_weights, losses))
        return weighted

    def update_weights(self, losses, shared_params):
        loss_ratios = torch.tensor([
            loss.item() / (init + 1e-8)
            for loss, init in zip(losses, self.initial_losses)
        ])

        avg_ratio = loss_ratios.mean()
        target_grad_norms = avg_ratio ** self.alpha

        with torch.no_grad():
            self.task_weights.data = self.task_weights * target_grad_norms / loss_ratios
            self.task_weights.data = self.task_weights / self.task_weights.sum() * len(losses)
```

### Strategy 3: Dynamic Weight Average (DWA)

Use the rate of loss decrease to weight tasks. Tasks that improve
slowly get more weight.

```python
class DynamicWeightAverage:
    def __init__(self, num_tasks, temperature=2.0):
        self.temperature = temperature
        self.prev_losses = None
        self.weights = [1.0] * num_tasks

    def update(self, current_losses):
        if self.prev_losses is not None:
            ratios = [curr / (prev + 1e-8)
                      for curr, prev in zip(current_losses, self.prev_losses)]
            exp_ratios = [math.exp(r / self.temperature) for r in ratios]
            total = sum(exp_ratios)
            self.weights = [len(ratios) * r / total for r in exp_ratios]

        self.prev_losses = list(current_losses)
        return self.weights
```

---

## Loss Landscape Visualization

Understanding what the loss surface looks like helps debug training
and choose optimizers.

### 1D Loss Slice

Plot loss along the direction between two parameter vectors
(e.g., random init and trained).

```python
def plot_loss_1d(model, dataloader, loss_fn, direction, device,
                 num_points=50, range_val=2.0):
    original_params = {name: p.clone() for name, p in model.named_parameters()}
    alphas = torch.linspace(-range_val, range_val, num_points)
    losses = []

    for alpha in alphas:
        with torch.no_grad():
            for name, param in model.named_parameters():
                param.copy_(original_params[name] + alpha * direction[name])

        total_loss = 0.0
        count = 0
        with torch.no_grad():
            for batch in dataloader:
                inputs = batch["input"].to(device)
                targets = batch["target"].to(device)
                outputs = model(inputs)
                total_loss += loss_fn(outputs, targets).item()
                count += 1

        losses.append(total_loss / count)

    with torch.no_grad():
        for name, param in model.named_parameters():
            param.copy_(original_params[name])

    return alphas.numpy(), losses
```

### 2D Loss Surface

```python
def plot_loss_2d(model, dataloader, loss_fn, dir1, dir2, device,
                 num_points=20, range_val=1.0):
    original_params = {name: p.clone() for name, p in model.named_parameters()}
    alphas = torch.linspace(-range_val, range_val, num_points)
    betas = torch.linspace(-range_val, range_val, num_points)
    loss_grid = torch.zeros(num_points, num_points)

    for i, alpha in enumerate(alphas):
        for j, beta in enumerate(betas):
            with torch.no_grad():
                for name, param in model.named_parameters():
                    param.copy_(
                        original_params[name]
                        + alpha * dir1[name]
                        + beta * dir2[name]
                    )

            total_loss = 0.0
            count = 0
            with torch.no_grad():
                for batch in dataloader:
                    inputs = batch["input"].to(device)
                    targets = batch["target"].to(device)
                    outputs = model(inputs)
                    total_loss += loss_fn(outputs, targets).item()
                    count += 1

            loss_grid[i, j] = total_loss / count

    with torch.no_grad():
        for name, param in model.named_parameters():
            param.copy_(original_params[name])

    return alphas.numpy(), betas.numpy(), loss_grid.numpy()
```

```
Loss landscape visualization tells you:

  Smooth, single basin:     Easy to optimize. Adam works fine.
  Sharp minima:             Model may not generalize. Add regularization.
  Many local minima:        Consider larger batch size or SGD with restarts.
  Flat regions + cliffs:    Gradient clipping is essential.
  Chaotic surface:          Your loss function may have issues.
```

---

## Practical Exercise

Implement and compare three losses on CIFAR-10:

1. **Standard cross-entropy** (baseline)
2. **Focal loss** (gamma=2.0)
3. **Label-smoothed cross-entropy** (epsilon=0.1)

For each:
- Train a ResNet-18 for 50 epochs
- Plot the training/validation loss curves
- Report final test accuracy
- Measure calibration (expected calibration error)

Then implement NT-Xent loss for a simple self-supervised
pretraining experiment:
4. Pretrain a ResNet encoder with SimCLR on CIFAR-10 (no labels)
5. Fine-tune a linear classifier on top
6. Compare to the supervised baselines

---

## Key Takeaways

- Focal loss is the go-to for imbalanced classification
- Label smoothing is nearly free and improves calibration
- Contrastive losses (NT-Xent, InfoNCE) are the foundation of
  self-supervised and multimodal learning
- Multi-task loss balancing is crucial -- unbalanced losses lead to
  one task dominating
- Loss landscape visualization helps you understand training
  dynamics and choose optimizers
- Temperature parameters in contrastive losses are surprisingly
  important -- sweep them

Next lesson: the best model means nothing without good data. Let's
build datasets.
