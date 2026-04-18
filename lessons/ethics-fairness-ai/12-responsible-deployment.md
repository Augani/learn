# Lesson 12: Responsible Deployment Practices

> Launching an AI system is like launching a rocket — you need checklists before liftoff, telemetry during flight, and the ability to abort if something goes wrong.

---

## The Rocket Launch Analogy

NASA doesn't launch rockets by pressing a button and hoping. There
are pre-launch checklists, staged countdowns, real-time monitoring,
and abort procedures at every stage. If any metric goes out of
range, the launch is scrubbed — no matter how much time and money
has been invested.

Responsible AI deployment follows the same pattern. Pre-deployment
testing catches problems before users are affected. Staged rollouts
limit blast radius. Monitoring detects drift and bias in real time.
And kill switches let you pull the system if something goes wrong.

```
  ROCKET LAUNCH                     AI DEPLOYMENT
  +------------------+              +------------------+
  | Pre-launch       |              | Pre-deployment   |
  |  checklists      |              |  testing         |
  +------------------+              +------------------+
  | Staged countdown |              | Staged rollout   |
  |  (T-10, T-5...) |              |  (1%, 10%, 50%) |
  +------------------+              +------------------+
  | Real-time        |              | Production       |
  |  telemetry       |              |  monitoring      |
  +------------------+              +------------------+
  | Abort capability |              | Kill switch      |
  |  at every stage  |              |  & rollback      |
  +------------------+              +------------------+
```

---

## Pre-Deployment Testing

### Red Teaming

Deliberately try to break the system. Assign a team to find failure
modes, biases, and adversarial inputs before users do.

```
  RED TEAM CHECKLIST

  [ ] Test with adversarial inputs designed to trigger bias
  [ ] Test with edge cases (extreme values, rare categories)
  [ ] Test with out-of-distribution data
  [ ] Test with inputs from underrepresented groups
  [ ] Test for prompt injection (LLM systems)
  [ ] Test for data leakage / memorization
  [ ] Test failure modes: what happens when the model is wrong?
  [ ] Test human-AI interaction: do users over-trust the system?
```

### Adversarial Testing

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# Train a model
np.random.seed(42)
n = 2000
X = pd.DataFrame({
    'income': np.random.lognormal(10.5, 0.5, n),
    'debt_ratio': np.random.beta(2, 5, n),
    'credit_years': np.random.exponential(8, n).clip(0, 30),
    'employment_years': np.random.exponential(5, n).clip(0, 25),
})
y = ((0.3 * (X['income'] / X['income'].max()) +
      0.3 * (1 - X['debt_ratio']) +
      0.2 * (X['credit_years'] / 30) +
      0.2 * np.random.random(n)) > 0.4).astype(int)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
model = GradientBoostingClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# Adversarial testing: probe model boundaries
def adversarial_probe(model, base_instance, feature, values):
    """Test how the model responds to varying one feature."""
    results = []
    for val in values:
        instance = base_instance.copy()
        instance[feature] = val
        prob = model.predict_proba(instance.values.reshape(1, -1))[0, 1]
        results.append({'feature': feature, 'value': val, 'probability': prob})
    return pd.DataFrame(results)

# Probe: how does income affect the decision?
base = X_test.iloc[0].copy()
income_probe = adversarial_probe(
    model, base, 'income',
    np.linspace(X['income'].min(), X['income'].max(), 50)
)
print("Income sensitivity:")
print(income_probe.describe())

# Check for cliff effects (sudden jumps in probability)
prob_diffs = income_probe['probability'].diff().abs()
max_jump = prob_diffs.max()
print(f"\nMax probability jump: {max_jump:.3f}")
if max_jump > 0.2:
    print("WARNING: Cliff effect detected — small input change causes large output change")
```

---

## Staged Rollouts

Never deploy to 100% of users at once. Gradually increase exposure
while monitoring for problems.

```
  STAGED ROLLOUT PLAN

  Stage 1: Shadow Mode (0% live)
  ┌─────────────────────────────────────┐
  │ Model runs alongside existing system│
  │ Predictions logged but NOT used     │
  │ Compare with current system         │
  │ Duration: 2 weeks                   │
  │ Gate: accuracy within 2% of current │
  └─────────────────────────────────────┘
           │ PASS
           v
  Stage 2: Canary (1% live)
  ┌─────────────────────────────────────┐
  │ 1% of traffic uses new model        │
  │ Monitor fairness metrics hourly     │
  │ Duration: 1 week                    │
  │ Gate: no fairness metric regression │
  └─────────────────────────────────────┘
           │ PASS
           v
  Stage 3: Gradual (10% → 50% → 100%)
  ┌─────────────────────────────────────┐
  │ Increase traffic in steps           │
  │ Monitor at each step for 48 hours   │
  │ Gate: all metrics within thresholds │
  │ Rollback if any gate fails          │
  └─────────────────────────────────────┘
```

---

## Monitoring for Drift and Bias

Models degrade over time. Data distributions shift, user behavior
changes, and the world moves on. Monitoring catches these problems
before they cause harm.

```python
from datetime import datetime, timedelta

class BiasMonitor:
    """Monitor fairness metrics in production."""

    def __init__(self, model, sensitive_attr, thresholds=None):
        self.model = model
        self.sensitive_attr = sensitive_attr
        self.thresholds = thresholds or {
            'disparate_impact_ratio': 0.8,
            'max_tpr_gap': 0.10,
            'max_fpr_gap': 0.10,
        }
        self.history = []

    def check(self, X, y_true, sensitive):
        """Run a bias check on a batch of predictions."""
        y_pred = self.model.predict(X)
        timestamp = datetime.now()

        groups = np.unique(sensitive)
        metrics = {}

        for group in groups:
            mask = sensitive == group
            yt, yp = y_true[mask], y_pred[mask]
            tp = ((yt == 1) & (yp == 1)).sum()
            fp = ((yt == 0) & (yp == 1)).sum()
            fn = ((yt == 1) & (yp == 0)).sum()
            tn = ((yt == 0) & (yp == 0)).sum()

            metrics[group] = {
                'positive_rate': yp.mean(),
                'tpr': tp / (tp + fn) if (tp + fn) > 0 else 0,
                'fpr': fp / (fp + tn) if (fp + tn) > 0 else 0,
            }

        # Compute aggregate fairness metrics
        rates = [m['positive_rate'] for m in metrics.values()]
        tprs = [m['tpr'] for m in metrics.values()]
        fprs = [m['fpr'] for m in metrics.values()]

        result = {
            'timestamp': timestamp,
            'disparate_impact_ratio': min(rates) / max(rates) if max(rates) > 0 else 0,
            'tpr_gap': max(tprs) - min(tprs),
            'fpr_gap': max(fprs) - min(fprs),
            'group_metrics': metrics,
        }

        # Check against thresholds
        alerts = []
        if result['disparate_impact_ratio'] < self.thresholds['disparate_impact_ratio']:
            alerts.append(f"ALERT: Disparate impact ratio "
                         f"{result['disparate_impact_ratio']:.3f} "
                         f"< {self.thresholds['disparate_impact_ratio']}")
        if result['tpr_gap'] > self.thresholds['max_tpr_gap']:
            alerts.append(f"ALERT: TPR gap {result['tpr_gap']:.3f} "
                         f"> {self.thresholds['max_tpr_gap']}")
        if result['fpr_gap'] > self.thresholds['max_fpr_gap']:
            alerts.append(f"ALERT: FPR gap {result['fpr_gap']:.3f} "
                         f"> {self.thresholds['max_fpr_gap']}")

        result['alerts'] = alerts
        self.history.append(result)

        return result

# Usage
sensitive = np.random.choice(['A', 'B'], len(X_test), p=[0.6, 0.4])
monitor = BiasMonitor(model, 'group')
result = monitor.check(X_test.values, y_test.values, sensitive)

print(f"Disparate Impact Ratio: {result['disparate_impact_ratio']:.3f}")
print(f"TPR Gap: {result['tpr_gap']:.3f}")
print(f"FPR Gap: {result['fpr_gap']:.3f}")
for alert in result['alerts']:
    print(alert)
```

---

## Data Drift Detection

```python
from scipy import stats

class DriftDetector:
    """Detect distribution shifts between training and production data."""

    def __init__(self, reference_data, feature_names):
        self.reference = reference_data
        self.feature_names = feature_names

    def check_drift(self, new_data, threshold=0.05):
        """Run KS test for each feature to detect drift."""
        results = []
        for i, feature in enumerate(self.feature_names):
            ref_values = self.reference[:, i]
            new_values = new_data[:, i]

            statistic, p_value = stats.ks_2samp(ref_values, new_values)
            drifted = p_value < threshold

            results.append({
                'feature': feature,
                'ks_statistic': statistic,
                'p_value': p_value,
                'drifted': drifted,
            })

        return pd.DataFrame(results)

# Usage
detector = DriftDetector(X_train.values, X_train.columns.tolist())

# Simulate production data with drift in one feature
X_production = X_test.copy()
X_production['income'] = X_production['income'] * 1.3  # income inflation

drift_report = detector.check_drift(X_production.values)
print(drift_report.to_string(index=False))
```

---

## Human-in-the-Loop and Kill Switches

```
  HUMAN OVERSIGHT LEVELS

  Level 1: HUMAN-IN-THE-LOOP
  ┌─────────────────────────────────────┐
  │ Human reviews every AI decision     │
  │ AI suggests, human decides          │
  │ Use: high-stakes, low-volume        │
  │ Example: medical diagnosis          │
  └─────────────────────────────────────┘

  Level 2: HUMAN-ON-THE-LOOP
  ┌─────────────────────────────────────┐
  │ AI decides, human monitors          │
  │ Human can intervene when needed     │
  │ Use: medium-stakes, medium-volume   │
  │ Example: content moderation         │
  └─────────────────────────────────────┘

  Level 3: HUMAN-OVER-THE-LOOP
  ┌─────────────────────────────────────┐
  │ AI operates autonomously            │
  │ Human sets policies and reviews     │
  │ Use: low-stakes, high-volume        │
  │ Example: spam filtering             │
  └─────────────────────────────────────┘

  KILL SWITCH: At every level, there must be a way to
  immediately disable the AI system and fall back to
  a non-AI process.
```

---

## Exercises

### Exercise 1: Build a Monitoring Dashboard

Create a monitoring system that:

```python
# 1. Simulates production data arriving in daily batches
# 2. Runs bias checks on each batch
# 3. Runs drift detection on each batch
# 4. Logs results and generates alerts
# 5. Plots fairness metrics over time
# 6. Identifies the day when bias exceeds thresholds
```

### Exercise 2: Deployment Plan

Write a complete deployment plan for an AI system that screens
loan applications. Include:

1. Pre-deployment testing checklist
2. Staged rollout plan with specific gates
3. Monitoring metrics and alert thresholds
4. Human oversight design (which level and why)
5. Kill switch procedure and fallback process
6. Re-training trigger criteria

---

Next: [Lesson 13: Privacy and Data Protection in ML](./13-privacy-data-protection.md)
