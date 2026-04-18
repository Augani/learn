# Lesson 14: Auditing ML Systems

> An unaudited AI system is like an unaudited financial statement — you're trusting it on faith, and faith doesn't scale.

---

## The Financial Audit Analogy

Public companies don't just say "trust us, the numbers are right."
Independent auditors examine their books, verify transactions,
check for irregularities, and issue a formal opinion. The audit
doesn't guarantee perfection, but it provides structured assurance
that someone competent has looked.

ML auditing follows the same logic. An audit systematically
examines an AI system's data, model, outputs, and processes to
verify that it works as claimed and doesn't cause undue harm. Like
financial audits, ML audits can be internal (your team checks your
own work) or external (an independent party checks your work).

```
  FINANCIAL AUDIT                   ML AUDIT
  +------------------+              +------------------+
  | Examine books    |              | Examine data     |
  | Verify numbers   |              | Verify metrics   |
  | Check compliance |              | Check fairness   |
  | Issue opinion    |              | Issue report     |
  | Recommend fixes  |              | Recommend fixes  |
  +------------------+              +------------------+
```

---

## Internal vs External Audits

```
  INTERNAL AUDIT                    EXTERNAL AUDIT
  ┌─────────────────────┐          ┌─────────────────────┐
  │ Done by your team   │          │ Done by independent  │
  │                     │          │ third party          │
  │ Continuous, frequent│          │ Periodic (annual,    │
  │                     │          │ pre-deployment)      │
  │ Deep system access  │          │ May have limited     │
  │                     │          │ access               │
  │ Lower cost          │          │ Higher cost          │
  │                     │          │                      │
  │ Risk: blind spots,  │          │ Risk: less context,  │
  │ conflicts of interest│         │ snapshot in time     │
  │                     │          │                      │
  │ Good for: ongoing   │          │ Good for: compliance,│
  │ monitoring, quick   │          │ credibility, high-   │
  │ iteration           │          │ stakes systems       │
  └─────────────────────┘          └─────────────────────┘

  Best practice: BOTH. Internal audits catch issues early.
  External audits provide independent verification.
```

---

## Audit Methodology

```
  ML AUDIT WORKFLOW

  ┌──────────────────────────────────────────────────┐
  │ 1. SCOPE DEFINITION                              │
  │    What system? What questions? What standards?   │
  ├──────────────────────────────────────────────────┤
  │ 2. DOCUMENTATION REVIEW                          │
  │    Model cards, datasheets, design docs, tests   │
  ├──────────────────────────────────────────────────┤
  │ 3. DATA AUDIT                                    │
  │    Quality, representativeness, bias, provenance  │
  ├──────────────────────────────────────────────────┤
  │ 4. MODEL AUDIT                                   │
  │    Performance, fairness, robustness, explain.   │
  ├──────────────────────────────────────────────────┤
  │ 5. PROCESS AUDIT                                 │
  │    Development practices, testing, monitoring    │
  ├──────────────────────────────────────────────────┤
  │ 6. IMPACT ASSESSMENT                             │
  │    Who is affected? How? Severity?               │
  ├──────────────────────────────────────────────────┤
  │ 7. FINDINGS & RECOMMENDATIONS                    │
  │    Issues found, severity, remediation plan      │
  ├──────────────────────────────────────────────────┤
  │ 8. FOLLOW-UP                                     │
  │    Verify fixes, schedule re-audit               │
  └──────────────────────────────────────────────────┘
```

---

## Automated Audit Pipeline

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_auc_score
)
from datetime import datetime
import json

class MLAuditPipeline:
    """Automated ML system audit pipeline."""

    def __init__(self, model, X_test, y_test, sensitive_features,
                 model_name="unnamed"):
        self.model = model
        self.X_test = X_test
        self.y_test = y_test
        self.sensitive = sensitive_features
        self.model_name = model_name
        self.findings = []

    def run_full_audit(self):
        """Run all audit checks and generate report."""
        report = {
            'model_name': self.model_name,
            'audit_date': datetime.now().isoformat(),
            'dataset_size': len(self.y_test),
        }

        report['performance'] = self._audit_performance()
        report['fairness'] = self._audit_fairness()
        report['robustness'] = self._audit_robustness()
        report['findings'] = self.findings
        report['severity_summary'] = self._summarize_severity()

        return report

    def _audit_performance(self):
        """Audit model performance metrics."""
        y_pred = self.model.predict(self.X_test)
        y_prob = self.model.predict_proba(self.X_test)[:, 1]

        metrics = {
            'accuracy': accuracy_score(self.y_test, y_pred),
            'precision': precision_score(self.y_test, y_pred, zero_division=0),
            'recall': recall_score(self.y_test, y_pred, zero_division=0),
            'f1': f1_score(self.y_test, y_pred, zero_division=0),
            'auc_roc': roc_auc_score(self.y_test, y_prob),
        }

        # Check for concerning performance
        if metrics['accuracy'] < 0.7:
            self._add_finding('HIGH', 'Performance',
                            f"Accuracy below 70%: {metrics['accuracy']:.1%}")
        if metrics['auc_roc'] < 0.75:
            self._add_finding('MEDIUM', 'Performance',
                            f"AUC-ROC below 0.75: {metrics['auc_roc']:.3f}")

        return metrics

    def _audit_fairness(self):
        """Audit fairness across sensitive groups."""
        y_pred = self.model.predict(self.X_test)
        groups = np.unique(self.sensitive)
        group_metrics = {}

        for group in groups:
            mask = self.sensitive == group
            yt = self.y_test[mask]
            yp = y_pred[mask]

            tn, fp, fn, tp = confusion_matrix(yt, yp, labels=[0, 1]).ravel()

            group_metrics[str(group)] = {
                'n': int(mask.sum()),
                'positive_rate': float(yp.mean()),
                'accuracy': float(accuracy_score(yt, yp)),
                'tpr': float(tp / (tp + fn)) if (tp + fn) > 0 else 0,
                'fpr': float(fp / (fp + tn)) if (fp + tn) > 0 else 0,
            }

        # Compute disparities
        rates = [m['positive_rate'] for m in group_metrics.values()]
        tprs = [m['tpr'] for m in group_metrics.values()]
        fprs = [m['fpr'] for m in group_metrics.values()]

        dir_ratio = min(rates) / max(rates) if max(rates) > 0 else 0
        tpr_gap = max(tprs) - min(tprs)
        fpr_gap = max(fprs) - min(fprs)

        fairness = {
            'group_metrics': group_metrics,
            'disparate_impact_ratio': dir_ratio,
            'tpr_gap': tpr_gap,
            'fpr_gap': fpr_gap,
        }

        # Flag issues
        if dir_ratio < 0.8:
            self._add_finding('HIGH', 'Fairness',
                            f"Disparate impact ratio {dir_ratio:.3f} < 0.8")
        if tpr_gap > 0.1:
            self._add_finding('HIGH', 'Fairness',
                            f"TPR gap {tpr_gap:.3f} > 0.10")
        if fpr_gap > 0.1:
            self._add_finding('MEDIUM', 'Fairness',
                            f"FPR gap {fpr_gap:.3f} > 0.10")

        return fairness

    def _audit_robustness(self):
        """Audit model robustness to input perturbations."""
        y_pred_original = self.model.predict(self.X_test)

        # Add small noise and check prediction stability
        noise_levels = [0.01, 0.05, 0.1]
        stability = {}

        for noise in noise_levels:
            X_noisy = self.X_test + np.random.normal(0, noise, self.X_test.shape)
            y_pred_noisy = self.model.predict(X_noisy)
            flip_rate = (y_pred_original != y_pred_noisy).mean()
            stability[f'noise_{noise}'] = float(flip_rate)

            if flip_rate > 0.1:
                self._add_finding('MEDIUM', 'Robustness',
                                f"Noise level {noise}: {flip_rate:.1%} predictions flipped")

        return stability

    def _add_finding(self, severity, category, description):
        self.findings.append({
            'severity': severity,
            'category': category,
            'description': description,
        })

    def _summarize_severity(self):
        severities = [f['severity'] for f in self.findings]
        return {
            'HIGH': severities.count('HIGH'),
            'MEDIUM': severities.count('MEDIUM'),
            'LOW': severities.count('LOW'),
            'total': len(self.findings),
        }

# Run the audit
np.random.seed(42)
n = 2000
X = np.random.randn(n, 6)
sensitive = np.random.choice(['A', 'B'], n, p=[0.6, 0.4])
y = ((X[:, 0] + 0.5 * X[:, 1] - 0.5 * (sensitive == 'B').astype(float)
      + np.random.randn(n) * 0.5) > 0).astype(int)

X_train, X_test, y_train, y_test, s_train, s_test = train_test_split(
    X, y, sensitive, test_size=0.3, random_state=42
)

model = GradientBoostingClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

audit = MLAuditPipeline(model, X_test, y_test, s_test, "Lending Model v1")
report = audit.run_full_audit()

print(json.dumps(report, indent=2, default=str))
```

---

## Documentation Requirements

```
  AUDIT DOCUMENTATION CHECKLIST

  MODEL DOCUMENTATION
  [ ] Model card (Lesson 10)
  [ ] Training data datasheet (Lesson 10)
  [ ] Architecture and hyperparameter choices
  [ ] Training procedure and convergence evidence

  TESTING DOCUMENTATION
  [ ] Test dataset description and representativeness
  [ ] Performance metrics (overall and by group)
  [ ] Fairness metrics and thresholds used
  [ ] Robustness testing results
  [ ] Edge case and adversarial testing results

  PROCESS DOCUMENTATION
  [ ] Development team and roles
  [ ] Review and approval process
  [ ] Version control and reproducibility
  [ ] Change management procedures

  DEPLOYMENT DOCUMENTATION
  [ ] Deployment plan and rollout strategy
  [ ] Monitoring plan and alert thresholds
  [ ] Incident response procedures
  [ ] Rollback procedures
  [ ] Re-training schedule
```

---

## Reproducibility

An audit is only as good as its reproducibility. If someone else
can't reproduce your results, the audit has limited value.

```
  REPRODUCIBILITY CHECKLIST

  [ ] Random seeds set and documented
  [ ] Data version pinned (hash or version number)
  [ ] Model version pinned (serialized or version-controlled)
  [ ] Library versions recorded (requirements.txt / lock file)
  [ ] Hardware environment documented (GPU type, memory)
  [ ] Training script version-controlled
  [ ] Evaluation script version-controlled
  [ ] Results match when re-run from scratch
```

---

## Algorithmic Impact Assessments

A structured evaluation of an AI system's potential societal impact,
conducted before deployment.

```
  ALGORITHMIC IMPACT ASSESSMENT

  ┌─────────────────────────────────────────────┐
  │ SYSTEM OVERVIEW                             │
  │ What does it do? Who uses it? Who's affected?│
  ├─────────────────────────────────────────────┤
  │ NECESSITY & PROPORTIONALITY                 │
  │ Is AI necessary? Are less invasive options  │
  │ available? Is the benefit proportional to   │
  │ the risk?                                   │
  ├─────────────────────────────────────────────┤
  │ DATA ASSESSMENT                             │
  │ Source, quality, representativeness, consent │
  ├─────────────────────────────────────────────┤
  │ BIAS & FAIRNESS                             │
  │ Protected groups, metrics, disparities found│
  ├─────────────────────────────────────────────┤
  │ TRANSPARENCY & EXPLAINABILITY               │
  │ Can decisions be explained? To whom?        │
  ├─────────────────────────────────────────────┤
  │ ACCOUNTABILITY                              │
  │ Who is responsible? What's the appeals      │
  │ process? How are complaints handled?        │
  ├─────────────────────────────────────────────┤
  │ RISK MITIGATION                             │
  │ What steps reduce identified risks?         │
  │ What residual risks remain?                 │
  └─────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: Run an Automated Audit

Using the `MLAuditPipeline` class above:

```python
# 1. Train a model on the Adult Income dataset
# 2. Run the full audit with sex as the sensitive attribute
# 3. Run again with race as the sensitive attribute
# 4. Which audit reveals more issues?
# 5. Write a one-page audit summary with recommendations
```

### Exercise 2: Design an Audit Process

You're the head of AI governance at a mid-size company. Design a
complete audit process:

1. When should audits happen? (pre-deployment, periodic, triggered)
2. Who conducts them? (internal team, external firm, both)
3. What's the minimum scope for each audit type?
4. How are findings prioritized and tracked?
5. What happens when a critical finding is discovered?
6. How do you ensure reproducibility?

---

Next: [Lesson 15: Ethics of Large Language Models](./15-llm-ethics.md)
