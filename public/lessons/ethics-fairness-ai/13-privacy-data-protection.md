# Lesson 13: Privacy and Data Protection in ML

> Your vote counts but stays private — differential privacy brings that same guarantee to machine learning.

---

## The Voting Booth Analogy

In a democratic election, your individual vote is secret, but the
aggregate result is public. The voting booth ensures that no one
can determine how you specifically voted, even though the overall
outcome reflects everyone's choices.

Differential privacy works the same way for ML. Individual data
points are protected by adding carefully calibrated noise, but the
model still learns useful patterns from the aggregate data. The
math guarantees that no one can reverse-engineer whether your
specific data was in the training set.

```
  VOTING BOOTH                      DIFFERENTIAL PRIVACY
  +------------------+              +------------------+
  | Your vote is     |              | Your data is     |
  |  secret          |              |  protected       |
  +------------------+              +------------------+
  | Aggregate result |              | Model learns     |
  |  is public       |              |  useful patterns |
  +------------------+              +------------------+
  | Can't determine  |              | Can't determine  |
  |  your vote from  |              |  if your data    |
  |  the total       |              |  was in training |
  +------------------+              +------------------+
```

---

## Why Privacy Matters in ML

ML models can memorize and leak training data:

```
  PRIVACY RISKS IN ML

  ┌─────────────────────────────────────────────┐
  │ MEMBERSHIP INFERENCE                        │
  │ "Was this person's data in the training set?"│
  │ → Reveals participation in sensitive datasets│
  ├─────────────────────────────────────────────┤
  │ MODEL INVERSION                             │
  │ "Can I reconstruct training data from the   │
  │  model's outputs?"                          │
  │ → Can recover faces, text, medical records  │
  ├─────────────────────────────────────────────┤
  │ DATA EXTRACTION                             │
  │ "Can I get the model to output memorized    │
  │  training data?"                            │
  │ → LLMs can regurgitate training text        │
  ├─────────────────────────────────────────────┤
  │ ATTRIBUTE INFERENCE                         │
  │ "Can I infer sensitive attributes from      │
  │  model predictions?"                        │
  │ → Predict health conditions from behavior   │
  └─────────────────────────────────────────────┘
```

---

## Differential Privacy

### The Core Idea

A mechanism M is ε-differentially private if for any two datasets
D and D' that differ in one record, and any output S:

P(M(D) ∈ S) ≤ e^ε × P(M(D') ∈ S)

**In plain English:** Adding or removing one person's data barely
changes the output. The parameter ε (epsilon) controls how much
"barely" means — smaller ε = stronger privacy.

```
  EPSILON (ε) TRADE-OFF

  ε = 0.1  ──── Very strong privacy, noisy model
  ε = 1.0  ──── Good privacy, moderate noise
  ε = 10   ──── Weak privacy, accurate model

  Privacy ◄────────────────────────► Accuracy
  (small ε)                          (large ε)

  There is no free lunch: more privacy = more noise = less accuracy
```

### Differential Privacy with Opacus (PyTorch)

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np

# Create a simple dataset
np.random.seed(42)
n = 5000
X = np.random.randn(n, 10).astype(np.float32)
y = ((X[:, 0] + 0.5 * X[:, 1] + np.random.randn(n) * 0.3) > 0).astype(np.float32)

dataset = TensorDataset(torch.from_numpy(X), torch.from_numpy(y))
dataloader = DataLoader(dataset, batch_size=64, shuffle=True)

# Simple model
model = nn.Sequential(
    nn.Linear(10, 32),
    nn.ReLU(),
    nn.Linear(32, 1),
    nn.Sigmoid()
)

# Standard training (no privacy)
def train_standard(model, dataloader, epochs=10):
    optimizer = optim.Adam(model.parameters(), lr=0.01)
    criterion = nn.BCELoss()

    for epoch in range(epochs):
        total_loss = 0
        for X_batch, y_batch in dataloader:
            pred = model(X_batch).squeeze()
            loss = criterion(pred, y_batch)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

    return total_loss / len(dataloader)

model_standard = nn.Sequential(
    nn.Linear(10, 32), nn.ReLU(), nn.Linear(32, 1), nn.Sigmoid()
)
loss = train_standard(model_standard, dataloader)
print(f"Standard training final loss: {loss:.4f}")
```

```python
# Training with differential privacy using Opacus
from opacus import PrivacyEngine

model_private = nn.Sequential(
    nn.Linear(10, 32), nn.ReLU(), nn.Linear(32, 1), nn.Sigmoid()
)
optimizer = optim.Adam(model_private.parameters(), lr=0.01)
criterion = nn.BCELoss()

# Attach privacy engine
privacy_engine = PrivacyEngine()
model_private, optimizer, dataloader_private = privacy_engine.make_private_with_epsilon(
    module=model_private,
    optimizer=optimizer,
    data_loader=dataloader,
    epochs=10,
    target_epsilon=1.0,       # Privacy budget
    target_delta=1e-5,        # Failure probability
    max_grad_norm=1.0,        # Gradient clipping bound
)

# Train with DP
for epoch in range(10):
    total_loss = 0
    for X_batch, y_batch in dataloader_private:
        pred = model_private(X_batch).squeeze()
        loss = criterion(pred, y_batch)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

epsilon = privacy_engine.get_epsilon(delta=1e-5)
print(f"DP training final loss: {total_loss / len(dataloader_private):.4f}")
print(f"Privacy budget spent (ε): {epsilon:.2f}")
```

---

## Federated Learning

Train a model across multiple devices or organizations without
sharing raw data. Each participant trains locally and shares only
model updates (gradients), not data.

```
  FEDERATED LEARNING

  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Hospital │  │ Hospital │  │ Hospital │
  │    A     │  │    B     │  │    C     │
  │ [data A] │  │ [data B] │  │ [data C] │
  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │              │              │
       │  gradients   │  gradients   │  gradients
       │              │              │
       v              v              v
  ┌─────────────────────────────────────┐
  │         CENTRAL SERVER              │
  │   Aggregates gradients              │
  │   Updates global model              │
  │   Sends updated model back          │
  │                                     │
  │   Data NEVER leaves hospitals       │
  └─────────────────────────────────────┘
```

```python
# Simplified federated learning simulation
import copy

def federated_training(global_model, client_data, rounds=5, local_epochs=3):
    """Simulate federated learning with multiple clients."""

    for round_num in range(rounds):
        client_models = []

        for client_id, (X_client, y_client) in enumerate(client_data):
            # Each client gets a copy of the global model
            local_model = copy.deepcopy(global_model)
            optimizer = optim.SGD(local_model.parameters(), lr=0.01)
            criterion = nn.BCELoss()

            # Train locally
            X_t = torch.FloatTensor(X_client)
            y_t = torch.FloatTensor(y_client)

            for _ in range(local_epochs):
                pred = local_model(X_t).squeeze()
                loss = criterion(pred, y_t)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

            client_models.append(local_model)

        # Aggregate: average model parameters (FedAvg)
        with torch.no_grad():
            for param_idx, param in enumerate(global_model.parameters()):
                avg_param = torch.stack([
                    list(cm.parameters())[param_idx].data
                    for cm in client_models
                ]).mean(dim=0)
                param.data = avg_param

        # Evaluate global model
        all_X = torch.FloatTensor(np.vstack([d[0] for d in client_data]))
        all_y = torch.FloatTensor(np.hstack([d[1] for d in client_data]))
        with torch.no_grad():
            preds = (global_model(all_X).squeeze() > 0.5).float()
            acc = (preds == all_y).float().mean()
        print(f"Round {round_num + 1}: Global accuracy = {acc:.3f}")

    return global_model

# Simulate 3 clients with different data
client_data = [
    (X[:1500], y[:1500]),
    (X[1500:3500], y[1500:3500]),
    (X[3500:], y[3500:]),
]

global_model = nn.Sequential(
    nn.Linear(10, 32), nn.ReLU(), nn.Linear(32, 1), nn.Sigmoid()
)
trained_model = federated_training(global_model, client_data, rounds=10)
```

---

## Data Anonymization Techniques

```
  ANONYMIZATION SPECTRUM

  Least Private                              Most Private
  ├──────────┼──────────┼──────────┼──────────┤
  Raw data   Pseudonym-  k-Anonymity  l-Diversity  Differential
             ization                               Privacy

  Pseudonymization: Replace identifiers with fake ones
  k-Anonymity: Each record is indistinguishable from k-1 others
  l-Diversity: Each group has l distinct sensitive values
  Differential Privacy: Mathematical guarantee of privacy
```

```python
# k-Anonymity example
def check_k_anonymity(df, quasi_identifiers, k):
    """Check if a dataset satisfies k-anonymity."""
    groups = df.groupby(quasi_identifiers).size()
    min_group = groups.min()
    violations = (groups < k).sum()

    print(f"Minimum group size: {min_group}")
    print(f"Groups violating {k}-anonymity: {violations}/{len(groups)}")
    print(f"Satisfies {k}-anonymity: {min_group >= k}")

    return min_group >= k

import pandas as pd

# Sample data
data = pd.DataFrame({
    'age': [25, 25, 30, 30, 35, 35, 40, 40],
    'zip': ['10001', '10001', '10002', '10002', '10001', '10001', '10002', '10002'],
    'diagnosis': ['flu', 'cold', 'flu', 'diabetes', 'cold', 'flu', 'diabetes', 'cold'],
})

check_k_anonymity(data, ['age', 'zip'], k=2)
```

---

## GDPR and the Right to Explanation

The EU's General Data Protection Regulation has specific
implications for ML:

```
  GDPR IMPLICATIONS FOR ML

  ┌─────────────────────────────────────────────┐
  │ Article 22: Right not to be subject to      │
  │ automated decision-making                   │
  │ → Individuals can request human review      │
  ├─────────────────────────────────────────────┤
  │ Articles 13-15: Right to explanation        │
  │ → "Meaningful information about the logic   │
  │    involved" in automated decisions         │
  │ → Drives need for interpretability          │
  ├─────────────────────────────────────────────┤
  │ Article 17: Right to erasure                │
  │ → "Right to be forgotten"                   │
  │ → Can you remove someone's influence from   │
  │    a trained model? (Machine unlearning)    │
  ├─────────────────────────────────────────────┤
  │ Article 25: Data protection by design       │
  │ → Privacy must be built in, not bolted on   │
  │ → Drives adoption of DP and federated       │
  │    learning                                 │
  └─────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: Differential Privacy Trade-off

Train the same model with different epsilon values and measure the
privacy-accuracy trade-off:

```python
# 1. Train with ε = 0.1, 0.5, 1.0, 5.0, 10.0, and no DP
# 2. For each, measure test accuracy
# 3. Plot accuracy vs epsilon
# 4. At what epsilon does accuracy become "acceptable"?
# 5. What epsilon would you choose for medical data? Financial data?
```

### Exercise 2: Federated Learning Experiment

Simulate federated learning with non-IID data (each client has a
different data distribution):

1. Split data so Client A has mostly positive examples, Client B
   has mostly negative, and Client C has a balanced mix
2. Train with federated averaging
3. Compare the global model's accuracy on each client's data
4. How does non-IID data affect federated learning?
5. What strategies could mitigate this?

---

Next: [Lesson 14: Auditing ML Systems](./14-auditing-ml-systems.md)
