# Lesson 14: Anomaly Detection in Time Series

> A smoke detector for your data — catch the unusual before it becomes a disaster.

---

## The Smoke Detector Analogy

A smoke detector doesn't know what's burning or why. It just knows
that the air composition is abnormal. Time series anomaly detection
works the same way — it learns what "normal" looks like and flags
anything that deviates significantly.

The challenge: what counts as "abnormal" depends on context. A
spike in web traffic might be an attack or a viral marketing win.
The detector flags it; a human decides what it means.

```
  NORMAL BEHAVIOR                   ANOMALY DETECTED

  |     ~  ~  ~  ~  ~              |     ~  ~  *  ~  ~
  |  ~  ~  ~  ~  ~  ~  ~          |  ~  ~  ~ /|\ ~  ~  ~
  | ~  ~  ~  ~  ~  ~  ~  ~        | ~  ~  ~ / | \ ~  ~  ~
  +----------------------------    +----------------------------
                                              ↑
                                         Something unusual!
```

---

## Types of Time Series Anomalies

```
  ANOMALY TYPES
  +------------------+----------------------------------+
  | Type             | Description                      |
  +------------------+----------------------------------+
  | Point anomaly    | Single unusual value             |
  |                  | (spike or dip)                   |
  +------------------+----------------------------------+
  | Contextual       | Normal value, wrong time         |
  | anomaly          | (high sales on a Tuesday)        |
  +------------------+----------------------------------+
  | Collective       | Sequence of values that are      |
  | anomaly          | abnormal together                |
  +------------------+----------------------------------+

  Point:       ~ ~ ~ * ~ ~ ~     (one spike)
  Contextual:  ~ ~ ~ ~ ~ * ~ ~   (normal value, wrong context)
  Collective:  ~ ~ *** ~ ~ ~     (abnormal sequence)
```

---

## Statistical Methods

### Z-Score on Residuals

Fit a model, compute residuals, flag large residuals.

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from statsmodels.tsa.seasonal import STL

# Generate data with anomalies
np.random.seed(42)
n = 365
t = np.arange(n)
trend = 50 + 0.1 * t
seasonal = 10 * np.sin(2 * np.pi * t / 7)
noise = np.random.randn(n) * 2
values = trend + seasonal + noise

# Inject anomalies
values[100] += 30   # point anomaly (spike)
values[200] -= 25   # point anomaly (dip)
values[300:305] += 15  # collective anomaly

dates = pd.date_range('2024-01-01', periods=n, freq='D')
ts = pd.Series(values, index=dates)

# Decompose and get residuals
stl = STL(ts, period=7, robust=True)
result = stl.fit()
residuals = result.resid

# Z-score anomaly detection
z_scores = (residuals - residuals.mean()) / residuals.std()
threshold = 3.0
anomalies = ts[np.abs(z_scores) > threshold]

print(f"Detected {len(anomalies)} anomalies")
print(anomalies)

# Plot
plt.figure(figsize=(14, 5))
plt.plot(ts, label='Data', alpha=0.7)
plt.scatter(anomalies.index, anomalies.values, color='red', s=100,
            zorder=5, label=f'Anomalies (|z| > {threshold})')
plt.legend()
plt.title('Z-Score Anomaly Detection')
plt.show()
```

### IQR Method on Residuals

More robust to outliers than z-scores.

```python
Q1 = residuals.quantile(0.25)
Q3 = residuals.quantile(0.75)
IQR = Q3 - Q1
lower = Q1 - 1.5 * IQR
upper = Q3 + 1.5 * IQR

anomalies_iqr = ts[(residuals < lower) | (residuals > upper)]
print(f"IQR method detected {len(anomalies_iqr)} anomalies")
```

---

## Isolation Forest

An ML approach that isolates anomalies by randomly partitioning
the feature space. Anomalies are easier to isolate (fewer splits
needed).

```python
from sklearn.ensemble import IsolationForest

# Create features for isolation forest
features = pd.DataFrame({
    'value': ts.values,
    'rolling_mean_7': ts.rolling(7).mean().values,
    'rolling_std_7': ts.rolling(7).std().values,
    'diff': ts.diff().values,
    'day_of_week': ts.index.dayofweek,
})
features = features.dropna()

# Fit isolation forest
iso_forest = IsolationForest(
    contamination=0.02,  # expect ~2% anomalies
    random_state=42
)
features['anomaly'] = iso_forest.fit_predict(features)
# -1 = anomaly, 1 = normal

anomalies_if = features[features['anomaly'] == -1]
print(f"Isolation Forest detected {len(anomalies_if)} anomalies")

# Plot
plt.figure(figsize=(14, 5))
plt.plot(ts.iloc[6:], label='Data', alpha=0.7)  # align with features
plt.scatter(
    ts.index[6:][features['anomaly'] == -1],
    ts.values[6:][features['anomaly'].values == -1],
    color='red', s=100, zorder=5, label='Anomalies'
)
plt.legend()
plt.title('Isolation Forest Anomaly Detection')
plt.show()
```

---

## Autoencoder for Anomaly Detection

Train a neural network to reconstruct normal patterns. High
reconstruction error = anomaly.

```python
import torch
import torch.nn as nn

class TimeSeriesAutoencoder(nn.Module):
    def __init__(self, seq_len, hidden_dim=32):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(seq_len, 64),
            nn.ReLU(),
            nn.Linear(64, hidden_dim),
            nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(hidden_dim, 64),
            nn.ReLU(),
            nn.Linear(64, seq_len),
        )

    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded

# Create sliding windows
SEQ_LEN = 14
windows = []
for i in range(len(ts) - SEQ_LEN):
    windows.append(ts.values[i:i + SEQ_LEN])
windows = np.array(windows)

# Normalize
from sklearn.preprocessing import StandardScaler
scaler = StandardScaler()
windows_scaled = scaler.fit_transform(windows)

# Train on "normal" data (exclude known anomaly periods)
X_train = torch.FloatTensor(windows_scaled[:80])  # first 80 windows

model = TimeSeriesAutoencoder(SEQ_LEN)
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = nn.MSELoss()

for epoch in range(100):
    model.train()
    output = model(X_train)
    loss = criterion(output, X_train)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

# Compute reconstruction error for all windows
model.eval()
with torch.no_grad():
    all_windows = torch.FloatTensor(windows_scaled)
    reconstructed = model(all_windows)
    errors = torch.mean((all_windows - reconstructed) ** 2, dim=1).numpy()

# Flag anomalies where error exceeds threshold
threshold = np.percentile(errors, 98)
anomaly_mask = errors > threshold
print(f"Autoencoder detected {anomaly_mask.sum()} anomalous windows")
```

```
  AUTOENCODER ANOMALY DETECTION

  Normal window:  Input ──> Encode ──> Decode ──> Low error ✓
  Anomaly window: Input ──> Encode ──> Decode ──> High error ✗

  The model learns to reconstruct normal patterns.
  Anomalies produce high reconstruction error because
  the model has never seen patterns like them.
```

---

## Threshold Tuning

The hardest part of anomaly detection: setting the right threshold.

```python
# Plot error distribution
plt.figure(figsize=(12, 4))
plt.hist(errors, bins=50, alpha=0.7)
plt.axvline(threshold, color='red', linestyle='--', label=f'Threshold (98th percentile)')
plt.xlabel('Reconstruction Error')
plt.ylabel('Count')
plt.legend()
plt.title('Reconstruction Error Distribution')
plt.show()
```

```
  THRESHOLD TRADE-OFF

  Low threshold:  Many alerts, many false positives
  High threshold: Few alerts, might miss real anomalies

  ← More sensitive          Less sensitive →
  ← More false alarms       Fewer false alarms →
```

---

## Exercises

### Exercise 1: Anomaly Detection Pipeline

Build a complete anomaly detection pipeline:
1. Load a time series (sensor data, server metrics, or synthetic)
2. Apply STL decomposition to extract residuals
3. Use both z-score and Isolation Forest to detect anomalies
4. Compare the results — do they agree? Where do they disagree?

### Exercise 2: Autoencoder Tuning

Train the autoencoder from this lesson on a real dataset. Experiment
with:
1. Different `hidden_dim` values (8, 16, 32, 64)
2. Different `SEQ_LEN` values (7, 14, 28)
3. Different threshold percentiles (95th, 98th, 99th)

Plot precision vs recall for different thresholds (if you have
labeled anomalies) or visually inspect the flagged points.

---

Next: [Lesson 15: Domain Applications](./15-domain-applications.md)
