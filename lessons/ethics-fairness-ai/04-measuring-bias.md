# Lesson 04: Measuring Bias in Models

> You can't fix what you can't measure — a bias audit turns vague concerns into concrete numbers.

---

## The Health Checkup Analogy

A doctor doesn't just ask "are you healthy?" They measure blood
pressure, cholesterol, heart rate, and blood sugar. Each number
tells a different story. High blood pressure with normal cholesterol
requires different treatment than the reverse.

Bias auditing works the same way. You don't just ask "is this model
fair?" You measure disparate impact ratios, confusion matrices by
group, calibration curves, and intersectional breakdowns. Each
metric reveals a different dimension of unfairness, and the
combination tells you where to intervene.

```
  HEALTH CHECKUP                    BIAS AUDIT
  +------------------+              +------------------+
  | Blood pressure   |              | Disparate impact |
  | Cholesterol      |              | Confusion matrix |
  | Heart rate       |              | Calibration curve|
  | Blood sugar      |              | Intersectional   |
  +------------------+              +------------------+
        |                                  |
        v                                  v
  "Multiple metrics               "Multiple metrics
   reveal the full                 reveal the full
   health picture"                 fairness picture"
```

---

## Disparate Impact Ratio

The disparate impact ratio compares the positive outcome rate of
the disadvantaged group to the advantaged group.

**Formula:** DIR = P(Ŷ=1 | A=disadvantaged) / P(Ŷ=1 | A=advantaged)

The "four-fifths rule" (from US employment law) says a ratio below
0.8 indicates potential discrimination.

```
  DISPARATE IMPACT RATIO

  Group A positive rate: 60%
  Group B positive rate: 40%

  DIR = 40% / 60% = 0.67  ← Below 0.8 threshold

  +-----|-----|-----|-----|-----|-----|-----|-----|-----|-----+
  0    0.1   0.2   0.3   0.4   0.5   0.6   0.7   0.8   0.9  1.0
                                ^                 ^
                              0.67              0.80
                           (our model)       (threshold)

  Below 0.8 = potential disparate impact
```

---

## Confusion Matrix by Group

A single confusion matrix hides group-level disparities. Breaking
it down by group reveals where the model fails differently.

```
  OVERALL CONFUSION MATRIX          GROUP A                GROUP B
  ┌──────────┬──────────┐   ┌──────────┬──────────┐  ┌──────────┬──────────┐
  │ TN: 400  │ FP: 50   │   │ TN: 250  │ FP: 20   │  │ TN: 150  │ FP: 30   │
  ├──────────┼──────────┤   ├──────────┼──────────┤  ├──────────┼──────────┤
  │ FN: 30   │ TP: 120  │   │ FN: 10   │ TP: 80   │  │ FN: 20   │ TP: 40   │
  └──────────┴──────────┘   └──────────┴──────────┘  └──────────┴──────────┘

  Overall FPR: 11.1%         Group A FPR: 7.4%        Group B FPR: 16.7%
  Overall FNR: 20.0%         Group A FNR: 11.1%       Group B FNR: 33.3%

  The overall numbers look fine. The group breakdown reveals
  Group B gets more false positives AND more false negatives.
```

---

## Full Bias Audit Pipeline

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, confusion_matrix, classification_report
)
from sklearn.calibration import calibration_curve
import matplotlib.pyplot as plt

# Load a dataset with sensitive attributes
# Using a synthetic version of a lending scenario
np.random.seed(42)
n = 3000

data = pd.DataFrame({
    'income': np.random.lognormal(10.5, 0.5, n),
    'debt_ratio': np.random.beta(2, 5, n),
    'credit_history_years': np.random.exponential(8, n).clip(0, 30),
    'num_accounts': np.random.poisson(4, n),
    'employment_years': np.random.exponential(5, n).clip(0, 25),
    'group': np.random.choice(['A', 'B'], n, p=[0.6, 0.4]),
})

# Create target with group-correlated bias
score = (
    0.3 * (data['income'] / data['income'].max()) +
    0.2 * (1 - data['debt_ratio']) +
    0.2 * (data['credit_history_years'] / 30) +
    0.15 * (data['employment_years'] / 25) +
    0.15 * np.random.random(n)
)
# Introduce historical bias: Group B has a higher threshold
threshold = np.where(data['group'] == 'A', 0.45, 0.55)
data['approved'] = (score > threshold).astype(int)

features = ['income', 'debt_ratio', 'credit_history_years',
            'num_accounts', 'employment_years']
X = data[features]
y = data['approved']
sensitive = data['group']

X_train, X_test, y_train, y_test, s_train, s_test = train_test_split(
    X, y, sensitive, test_size=0.3, random_state=42
)

model = GradientBoostingClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]
```

```python
# Bias audit: group-level metrics
def bias_audit(y_true, y_pred, y_prob, sensitive):
    """Run a comprehensive bias audit."""
    report = {}

    groups = sorted(sensitive.unique())
    for group in groups:
        mask = sensitive == group
        yt, yp, ypr = y_true[mask], y_pred[mask], y_prob[mask]

        tn, fp, fn, tp = confusion_matrix(yt, yp).ravel()

        report[group] = {
            'n': mask.sum(),
            'base_rate': yt.mean(),
            'positive_pred_rate': yp.mean(),
            'accuracy': accuracy_score(yt, yp),
            'tpr': tp / (tp + fn) if (tp + fn) > 0 else 0,
            'fpr': fp / (fp + tn) if (fp + tn) > 0 else 0,
            'fnr': fn / (fn + tp) if (fn + tp) > 0 else 0,
            'precision': tp / (tp + fp) if (tp + fp) > 0 else 0,
        }

    # Compute disparate impact ratio
    rates = {g: r['positive_pred_rate'] for g, r in report.items()}
    min_rate = min(rates.values())
    max_rate = max(rates.values())
    report['disparate_impact_ratio'] = min_rate / max_rate if max_rate > 0 else 0

    return report

audit = bias_audit(y_test, y_pred, y_prob, s_test)

print("=" * 60)
print("BIAS AUDIT REPORT")
print("=" * 60)
for group in ['A', 'B']:
    print(f"\nGroup {group} (n={audit[group]['n']}):")
    print(f"  Base rate:           {audit[group]['base_rate']:.3f}")
    print(f"  Positive pred rate:  {audit[group]['positive_pred_rate']:.3f}")
    print(f"  Accuracy:            {audit[group]['accuracy']:.3f}")
    print(f"  TPR (recall):        {audit[group]['tpr']:.3f}")
    print(f"  FPR:                 {audit[group]['fpr']:.3f}")
    print(f"  FNR:                 {audit[group]['fnr']:.3f}")

print(f"\nDisparate Impact Ratio: {audit['disparate_impact_ratio']:.3f}")
print(f"Four-fifths rule: {'PASS' if audit['disparate_impact_ratio'] >= 0.8 else 'FAIL'}")
```

```python
# Calibration curves by group
fig, ax = plt.subplots(1, 1, figsize=(8, 6))

for group in ['A', 'B']:
    mask = s_test == group
    prob_true, prob_pred = calibration_curve(
        y_test[mask], y_prob[mask], n_bins=10, strategy='uniform'
    )
    ax.plot(prob_pred, prob_true, marker='o', label=f'Group {group}')

ax.plot([0, 1], [0, 1], 'k--', label='Perfect calibration')
ax.set_xlabel('Mean predicted probability')
ax.set_ylabel('Fraction of positives')
ax.set_title('Calibration Curves by Group')
ax.legend()
plt.tight_layout()
plt.savefig('calibration_by_group.png', dpi=150)
plt.show()
```

---

## Intersectional Analysis

Single-attribute analysis can miss compounded disadvantages.
Intersectional analysis examines combinations of sensitive
attributes.

```python
# Intersectional analysis example
# Add a second sensitive attribute
data['age_group'] = pd.cut(
    data['credit_history_years'],
    bins=[0, 5, 15, 30],
    labels=['young', 'mid', 'senior']
)

# Recompute on test set
from fairlearn.metrics import MetricFrame

# Create intersectional groups
intersectional = s_test.astype(str) + '_' + data.loc[
    X_test.index, 'age_group'
].astype(str)

metric_frame = MetricFrame(
    metrics={
        'accuracy': accuracy_score,
        'selection_rate': lambda y, p: p.mean(),
    },
    y_true=y_test,
    y_pred=y_pred,
    sensitive_features=intersectional
)

print("Intersectional Analysis:")
print(metric_frame.by_group.sort_values('selection_rate'))
# This often reveals that the most disadvantaged subgroup
# is at the intersection of multiple attributes
```

```
  INTERSECTIONAL ANALYSIS

  Single-attribute view:          Intersectional view:
  Group A: 65% approved           A + young:  55% approved
  Group B: 50% approved           A + senior: 72% approved
                                  B + young:  35% approved  ← worst off
                                  B + senior: 60% approved

  The B + young intersection faces compounded disadvantage
  that neither single-attribute analysis reveals.
```

---

## Audit Methodology

A structured approach to bias auditing:

```
  BIAS AUDIT WORKFLOW

  1. DEFINE SCOPE
  +-----------+
  | What model?        What decisions?        What groups?
  | What metrics?      What thresholds?       What time period?
  +-----------+
       |
       v
  2. COLLECT DATA
  +-----------+
  | Predictions        Ground truth           Sensitive attributes
  | Confidence scores  Deployment context     Historical outcomes
  +-----------+
       |
       v
  3. COMPUTE METRICS
  +-----------+
  | Disparate impact   Confusion by group     Calibration by group
  | Fairness metrics   Intersectional cuts    Statistical tests
  +-----------+
       |
       v
  4. INTERPRET RESULTS
  +-----------+
  | Which groups are disadvantaged?           How severe?
  | Is it statistically significant?          Root cause?
  +-----------+
       |
       v
  5. REPORT & RECOMMEND
  +-----------+
  | Document findings  Recommend mitigations  Set monitoring plan
  | Assign ownership   Define re-audit cadence
  +-----------+
```

---

## Generating a Bias Report

```python
def generate_bias_report(audit_results, model_name, date):
    """Generate a formatted bias audit report."""
    report = []
    report.append(f"# Bias Audit Report: {model_name}")
    report.append(f"Date: {date}")
    report.append(f"")
    report.append(f"## Summary")
    dir_val = audit_results['disparate_impact_ratio']
    status = "PASS" if dir_val >= 0.8 else "FAIL"
    report.append(f"Disparate Impact Ratio: {dir_val:.3f} ({status})")
    report.append(f"")
    report.append(f"## Group-Level Metrics")
    report.append(f"| Metric | Group A | Group B | Difference |")
    report.append(f"|--------|---------|---------|------------|")

    for metric in ['base_rate', 'positive_pred_rate', 'accuracy',
                   'tpr', 'fpr', 'fnr']:
        a = audit_results['A'][metric]
        b = audit_results['B'][metric]
        diff = abs(a - b)
        report.append(f"| {metric:20s} | {a:.3f}   | {b:.3f}   | {diff:.3f}      |")

    report.append(f"")
    report.append(f"## Recommendations")
    if dir_val < 0.8:
        report.append(f"- CRITICAL: Disparate impact ratio below 0.8 threshold")
        report.append(f"- Consider pre-processing or post-processing mitigation")
    if abs(audit_results['A']['fpr'] - audit_results['B']['fpr']) > 0.05:
        report.append(f"- WARNING: FPR differs by >5% between groups")
    if abs(audit_results['A']['tpr'] - audit_results['B']['tpr']) > 0.05:
        report.append(f"- WARNING: TPR differs by >5% between groups")

    return '\n'.join(report)

report_text = generate_bias_report(audit, "Lending Model v1", "2024-01-15")
print(report_text)
```

---

## Exercises

### Exercise 1: Full Bias Audit

Perform a complete bias audit on the Adult Income dataset:

```python
# 1. Train a GradientBoostingClassifier on the Adult dataset
# 2. Compute all fairness metrics by sex and by race
# 3. Generate calibration curves by group
# 4. Perform intersectional analysis (sex × race)
# 5. Generate a bias report with recommendations
# 6. Which group is most disadvantaged? At which intersection?
```

### Exercise 2: Audit Methodology Design

Design a bias audit plan for a real-world scenario: a bank is
deploying a loan approval model. Define:

1. Which sensitive attributes to audit
2. Which fairness metrics to compute
3. What thresholds constitute a "pass" vs "fail"
4. How often to re-audit
5. What actions to take when a metric fails

---

Next: [Lesson 05: Bias Mitigation: Pre-processing](./05-bias-mitigation-preprocessing.md)
