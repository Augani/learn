# Lesson 16: Capstone: Ethical AI Audit

> Everything you've learned comes together here — bias detection, fairness metrics, interpretability, governance documentation, and mitigation recommendations in one complete pipeline.

---

## The Full Picture

This capstone ties together every concept from the track into a
single end-to-end ethical audit of an ML system. You'll build a
complete pipeline that a real organization could use.

```
  CAPSTONE PIPELINE

  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
  │  Train   │-->│  Measure │-->│ Explain  │-->│ Document │-->│ Mitigate │
  │  Model   │   │  Bias    │   │  Model   │   │  & Report│   │  & Plan  │
  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
  Lesson 02-03    Lesson 04      Lesson 07-09   Lesson 10-11   Lesson 05-06
  (data, model)   (fairness)     (SHAP, LIME)   (model card)   (mitigation)
```

---

## Step 1: Dataset and Model Setup

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_auc_score, classification_report
)
from sklearn.calibration import calibration_curve
import matplotlib.pyplot as plt
import json
from datetime import datetime

# Load the Adult Income dataset
url = "https://archive.ics.uci.edu/ml/machine-learning-databases/adult/adult.data"
columns = ['age', 'workclass', 'fnlwgt', 'education', 'education_num',
           'marital_status', 'occupation', 'relationship', 'race', 'sex',
           'capital_gain', 'capital_loss', 'hours_per_week',
           'native_country', 'income']
df = pd.read_csv(url, names=columns, skipinitialspace=True)

# Prepare features
df['income_binary'] = (df['income'] == '>50K').astype(int)
df['sex_binary'] = (df['sex'] == 'Male').astype(int)

# Select numeric features (avoiding sensitive attributes as features)
feature_cols = ['age', 'education_num', 'capital_gain', 'capital_loss',
                'hours_per_week']

# Add encoded categorical features
for col in ['workclass', 'occupation', 'marital_status']:
    dummies = pd.get_dummies(df[col], prefix=col, drop_first=True)
    df = pd.concat([df, dummies], axis=1)
    feature_cols.extend(dummies.columns.tolist())

X = df[feature_cols].values
y = df['income_binary'].values
sensitive_sex = df['sex'].values
sensitive_race = df['race'].values

X_train, X_test, y_train, y_test, sex_train, sex_test, race_train, race_test = \
    train_test_split(X, y, sensitive_sex, sensitive_race,
                     test_size=0.3, random_state=42)

# Train the model
model = GradientBoostingClassifier(
    n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42
)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]

print(f"Model accuracy: {accuracy_score(y_test, y_pred):.3f}")
print(f"Model AUC-ROC: {roc_auc_score(y_test, y_prob):.3f}")
```

---

## Step 2: Bias Measurement

```python
def comprehensive_bias_audit(y_true, y_pred, y_prob, sensitive, attr_name):
    """Run a comprehensive bias audit for one sensitive attribute."""
    groups = np.unique(sensitive)
    results = {'attribute': attr_name, 'groups': {}}

    for group in groups:
        mask = sensitive == group
        yt, yp, ypr = y_true[mask], y_pred[mask], y_prob[mask]

        if len(np.unique(yt)) < 2:
            continue

        tn, fp, fn, tp = confusion_matrix(yt, yp, labels=[0, 1]).ravel()

        results['groups'][group] = {
            'n': int(mask.sum()),
            'base_rate': float(yt.mean()),
            'positive_pred_rate': float(yp.mean()),
            'accuracy': float(accuracy_score(yt, yp)),
            'precision': float(tp / (tp + fp)) if (tp + fp) > 0 else 0,
            'recall_tpr': float(tp / (tp + fn)) if (tp + fn) > 0 else 0,
            'fpr': float(fp / (fp + tn)) if (fp + tn) > 0 else 0,
            'fnr': float(fn / (fn + tp)) if (fn + tp) > 0 else 0,
            'auc': float(roc_auc_score(yt, ypr)) if len(np.unique(yt)) == 2 else None,
        }

    # Aggregate fairness metrics
    rates = [g['positive_pred_rate'] for g in results['groups'].values()]
    tprs = [g['recall_tpr'] for g in results['groups'].values()]
    fprs = [g['fpr'] for g in results['groups'].values()]

    results['fairness'] = {
        'disparate_impact_ratio': min(rates) / max(rates) if max(rates) > 0 else 0,
        'demographic_parity_diff': max(rates) - min(rates),
        'equalized_odds_tpr_gap': max(tprs) - min(tprs),
        'equalized_odds_fpr_gap': max(fprs) - min(fprs),
        'four_fifths_rule': 'PASS' if (min(rates) / max(rates) >= 0.8) else 'FAIL',
    }

    return results

# Audit by sex
sex_audit = comprehensive_bias_audit(y_test, y_pred, y_prob, sex_test, 'sex')
print("\n=== BIAS AUDIT: SEX ===")
print(json.dumps(sex_audit['fairness'], indent=2))

# Audit by race
race_audit = comprehensive_bias_audit(y_test, y_pred, y_prob, race_test, 'race')
print("\n=== BIAS AUDIT: RACE ===")
print(json.dumps(race_audit['fairness'], indent=2))
```

```python
# Intersectional analysis
intersectional = np.array([
    f"{s}_{r}" for s, r in zip(sex_test, race_test)
])
intersect_audit = comprehensive_bias_audit(
    y_test, y_pred, y_prob, intersectional, 'sex_x_race'
)

print("\n=== INTERSECTIONAL ANALYSIS ===")
print(f"{'Group':<30} {'N':>6} {'Base Rate':>10} {'Pred Rate':>10} {'TPR':>8}")
print("-" * 70)
for group, metrics in sorted(intersect_audit['groups'].items()):
    print(f"{group:<30} {metrics['n']:>6} {metrics['base_rate']:>10.3f} "
          f"{metrics['positive_pred_rate']:>10.3f} {metrics['recall_tpr']:>8.3f}")
```

---

## Step 3: Interpretability Analysis

```python
import shap

# SHAP analysis
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test[:500])  # Subset for speed

# Summary plot
shap.summary_plot(shap_values, X_test[:500],
                  feature_names=feature_cols, show=False)
plt.title('SHAP Feature Importance')
plt.tight_layout()
plt.savefig('capstone_shap_summary.png', dpi=150)
plt.show()

# Compare SHAP values by group
for group in ['Male', 'Female']:
    mask = sex_test[:500] == group
    if mask.sum() > 0:
        mean_abs_shap = np.abs(shap_values[mask]).mean(axis=0)
        top_features = np.argsort(mean_abs_shap)[-5:][::-1]
        print(f"\nTop 5 features for {group}:")
        for idx in top_features:
            print(f"  {feature_cols[idx]}: {mean_abs_shap[idx]:.4f}")
```

```python
# Explain specific predictions
def explain_prediction(model, explainer, instance, feature_names, true_label):
    """Generate a detailed explanation for one prediction."""
    pred = model.predict(instance.reshape(1, -1))[0]
    prob = model.predict_proba(instance.reshape(1, -1))[0, 1]
    sv = explainer.shap_values(instance.reshape(1, -1))[0]

    explanation = {
        'prediction': int(pred),
        'probability': float(prob),
        'true_label': int(true_label),
        'correct': pred == true_label,
        'base_value': float(explainer.expected_value),
        'top_positive_features': [],
        'top_negative_features': [],
    }

    sorted_idx = np.argsort(sv)
    for idx in sorted_idx[-3:][::-1]:
        if sv[idx] > 0:
            explanation['top_positive_features'].append({
                'feature': feature_names[idx],
                'shap_value': float(sv[idx]),
                'feature_value': float(instance[idx]),
            })
    for idx in sorted_idx[:3]:
        if sv[idx] < 0:
            explanation['top_negative_features'].append({
                'feature': feature_names[idx],
                'shap_value': float(sv[idx]),
                'feature_value': float(instance[idx]),
            })

    return explanation

# Explain a few predictions
for i in [0, 10, 50]:
    exp = explain_prediction(model, explainer, X_test[i], feature_cols, y_test[i])
    print(f"\nInstance {i}: pred={exp['prediction']}, "
          f"prob={exp['probability']:.3f}, correct={exp['correct']}")
    print(f"  Pushing UP: {[f['feature'] for f in exp['top_positive_features']]}")
    print(f"  Pushing DOWN: {[f['feature'] for f in exp['top_negative_features']]}")
```

---

## Step 4: Governance Documentation

```python
def generate_full_audit_report(model_info, performance, sex_audit,
                                race_audit, intersect_audit):
    """Generate a complete ethical audit report."""
    report = []
    report.append("=" * 70)
    report.append("ETHICAL AI AUDIT REPORT")
    report.append("=" * 70)
    report.append(f"Model: {model_info['name']}")
    report.append(f"Date: {datetime.now().strftime('%Y-%m-%d')}")
    report.append(f"Auditor: {model_info.get('auditor', 'Automated Pipeline')}")
    report.append("")

    # Performance summary
    report.append("--- PERFORMANCE SUMMARY ---")
    for metric, value in performance.items():
        report.append(f"  {metric}: {value:.3f}")
    report.append("")

    # Fairness summary
    report.append("--- FAIRNESS SUMMARY ---")
    for audit_name, audit in [('Sex', sex_audit), ('Race', race_audit)]:
        report.append(f"\n  {audit_name}:")
        for metric, value in audit['fairness'].items():
            report.append(f"    {metric}: {value}")
    report.append("")

    # Risk assessment
    report.append("--- RISK ASSESSMENT ---")
    risks = []
    if sex_audit['fairness']['four_fifths_rule'] == 'FAIL':
        risks.append(("HIGH", "Sex-based disparate impact below 0.8 threshold"))
    if race_audit['fairness']['four_fifths_rule'] == 'FAIL':
        risks.append(("HIGH", "Race-based disparate impact below 0.8 threshold"))
    if sex_audit['fairness']['equalized_odds_tpr_gap'] > 0.1:
        risks.append(("MEDIUM", f"Sex TPR gap: {sex_audit['fairness']['equalized_odds_tpr_gap']:.3f}"))
    if race_audit['fairness']['equalized_odds_tpr_gap'] > 0.1:
        risks.append(("MEDIUM", f"Race TPR gap: {race_audit['fairness']['equalized_odds_tpr_gap']:.3f}"))

    if not risks:
        report.append("  No critical risks identified.")
    for severity, desc in risks:
        report.append(f"  [{severity}] {desc}")
    report.append("")

    # Recommendations
    report.append("--- RECOMMENDATIONS ---")
    if any(s == 'HIGH' for s, _ in risks):
        report.append("  1. CRITICAL: Apply bias mitigation before deployment")
        report.append("     - Consider reweighting (Lesson 05) or threshold adjustment (Lesson 06)")
        report.append("  2. Conduct intersectional analysis for compounded disadvantages")
        report.append("  3. Implement ongoing monitoring with automated alerts")
    report.append("  4. Generate model card and datasheet for documentation")
    report.append("  5. Schedule re-audit in 90 days or after any model update")
    report.append("")

    report.append("=" * 70)
    report.append("END OF REPORT")
    report.append("=" * 70)

    return '\n'.join(report)

# Generate the report
performance = {
    'accuracy': accuracy_score(y_test, y_pred),
    'precision': precision_score(y_test, y_pred),
    'recall': recall_score(y_test, y_pred),
    'f1': f1_score(y_test, y_pred),
    'auc_roc': roc_auc_score(y_test, y_prob),
}

report = generate_full_audit_report(
    {'name': 'Income Prediction Model v1', 'auditor': 'Ethics Team'},
    performance, sex_audit, race_audit, intersect_audit
)
print(report)
```

---

## Step 5: Mitigation and Re-evaluation

```python
from fairlearn.reductions import ExponentiatedGradient, DemographicParity
from fairlearn.postprocessing import ThresholdOptimizer
from sklearn.linear_model import LogisticRegression

# Apply mitigation: Exponentiated Gradient with Demographic Parity
mitigator = ExponentiatedGradient(
    estimator=LogisticRegression(max_iter=1000),
    constraints=DemographicParity(),
)
mitigator.fit(X_train, y_train, sensitive_features=sex_train)
y_pred_fair = mitigator.predict(X_test)

# Re-audit the mitigated model
print("\n=== POST-MITIGATION AUDIT ===")
print(f"Original accuracy: {accuracy_score(y_test, y_pred):.3f}")
print(f"Mitigated accuracy: {accuracy_score(y_test, y_pred_fair):.3f}")

# Compare fairness
for name, preds in [('Original', y_pred), ('Mitigated', y_pred_fair)]:
    rates = {}
    for group in ['Male', 'Female']:
        mask = sex_test == group
        rates[group] = preds[mask].mean()
    gap = abs(rates['Male'] - rates['Female'])
    dir_ratio = min(rates.values()) / max(rates.values())
    print(f"\n{name}:")
    print(f"  Male rate: {rates['Male']:.3f}, Female rate: {rates['Female']:.3f}")
    print(f"  Gap: {gap:.3f}, DIR: {dir_ratio:.3f}")
```

---

## Complete Audit Checklist

```
  CAPSTONE AUDIT CHECKLIST

  DATA ANALYSIS
  [✓] Dataset loaded and explored
  [✓] Sensitive attributes identified
  [✓] Base rates computed by group

  BIAS MEASUREMENT
  [✓] Disparate impact ratio computed
  [✓] Equalized odds gaps computed
  [✓] Intersectional analysis performed
  [✓] Calibration curves by group plotted

  INTERPRETABILITY
  [✓] SHAP values computed
  [✓] Feature importance by group compared
  [✓] Individual predictions explained

  GOVERNANCE
  [✓] Audit report generated
  [✓] Risk assessment completed
  [✓] Recommendations documented

  MITIGATION
  [✓] Bias mitigation applied
  [✓] Post-mitigation audit performed
  [✓] Fairness-accuracy trade-off documented
```

---

## Exercises

### Exercise 1: Full Audit on Your Own Model

Choose a dataset and model of your choice (or use a Kaggle
competition dataset) and perform the complete ethical audit:

1. Train a model and establish baseline performance
2. Run the full bias audit across all available sensitive attributes
3. Perform intersectional analysis
4. Generate SHAP explanations and compare across groups
5. Apply at least two mitigation techniques
6. Generate a complete audit report
7. Write a model card for the final model

### Exercise 2: Audit Presentation

Prepare a 5-minute presentation of your audit findings for a
non-technical audience (e.g., a company's board of directors):

1. What does the model do and who does it affect?
2. What biases were found? (Use visualizations, not jargon)
3. How severe are the issues? (Use real-world analogies)
4. What was done to fix them?
5. What risks remain and how will they be monitored?

---

Congratulations on completing the Ethics, Fairness & Responsible AI track!

You now have the tools to build AI systems that are not just
accurate, but fair, transparent, and accountable. The field is
evolving rapidly — stay current with the [Governance Frameworks
Reference](./reference-frameworks.md) and [Tools Reference](./reference-tools.md).
