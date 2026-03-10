# Lesson 18: Statistical Testing

> **Analogy:** A courtroom trial. The null hypothesis is
> "innocent until proven guilty." Evidence (data) must be
> strong enough to reject innocence beyond reasonable doubt.

---

## The Courtroom Framework

```
  STATISTICAL TEST = TRIAL
  ========================

  Null Hypothesis (H0):      "The defendant is innocent"
                             "There is no effect"
                             "Model A = Model B"

  Alternative (H1):          "The defendant is guilty"
                             "There IS an effect"
                             "Model A != Model B"

  Evidence:                  Your data / experiment results

  p-value:                   Probability of seeing this evidence
                             IF the defendant were innocent

  Decision:
  ┌────────────────────────────────────────────────┐
  │  p < 0.05:  "Guilty" (reject H0)              │
  │  p >= 0.05: "Not proven" (fail to reject H0)  │
  │                                                 │
  │  NOTE: "fail to reject" != "proven innocent"   │
  │  Just like in court: not guilty != innocent    │
  └────────────────────────────────────────────────┘
```

---

## p-values: What They Actually Mean

```
  p-value = 0.03 means:

  "IF there truly were no difference between the models,
   there's only a 3% chance we'd see results this extreme."

  COMMON MISINTERPRETATIONS (ALL WRONG):
  X "3% chance the null hypothesis is true"
  X "97% chance our result is correct"
  X "The effect size is large"

  CORRECT INTERPRETATION:
  V "This evidence would be unusual (3%) if H0 were true"

  ┌────────────────────────────────────────────────┐
  │  A small p-value means the data is SURPRISING  │
  │  under the null hypothesis.                     │
  │                                                 │
  │  It does NOT tell you HOW MUCH better your     │
  │  model is -- only that the difference is        │
  │  unlikely to be pure chance.                    │
  └────────────────────────────────────────────────┘
```

---

## A/B Testing: Comparing Two Models

```
  YOU HAVE TWO MODELS. WHICH IS BETTER?

  Model A accuracy: 0.847 (on 500 test samples)
  Model B accuracy: 0.862 (on 500 test samples)

  Is B actually better? Or is 0.015 just noise?

  ┌──────────────────────────────────────────┐
  │  Without a test:                          │
  │  "B is 1.5% better, ship it!"            │
  │                                           │
  │  With a test:                             │
  │  "B is 1.5% better, p=0.34. This could  │
  │   easily be random variation. Need more   │
  │   data before deciding."                  │
  └──────────────────────────────────────────┘
```

```python
import numpy as np
from scipy import stats

np.random.seed(42)
n = 500
model_a_correct = np.random.binomial(1, 0.85, n)
model_b_correct = np.random.binomial(1, 0.86, n)

acc_a = model_a_correct.mean()
acc_b = model_b_correct.mean()
print(f"Model A accuracy: {acc_a:.3f}")
print(f"Model B accuracy: {acc_b:.3f}")
print(f"Difference: {acc_b - acc_a:.3f}")

contingency = np.array([
    [model_a_correct.sum(), n - model_a_correct.sum()],
    [model_b_correct.sum(), n - model_b_correct.sum()],
])
chi2, p_value, dof, expected = stats.chi2_contingency(contingency)
print(f"\nChi-squared test: p = {p_value:.4f}")
if p_value < 0.05:
    print("Statistically significant difference!")
else:
    print("No significant difference (could be noise)")
```

---

## Common Statistical Tests

```
  ┌──────────────────┬──────────────────────────────────┐
  │ Test             │ When to Use                      │
  ├──────────────────┼──────────────────────────────────┤
  │ t-test           │ Compare means of two groups      │
  │                  │ (e.g., accuracy on two datasets) │
  ├──────────────────┼──────────────────────────────────┤
  │ Paired t-test    │ Same samples, two measurements   │
  │                  │ (e.g., model A vs B on same data)│
  ├──────────────────┼──────────────────────────────────┤
  │ McNemar's test   │ Two classifiers on same samples  │
  │                  │ (best for comparing models)      │
  ├──────────────────┼──────────────────────────────────┤
  │ Wilcoxon signed  │ Non-parametric paired test       │
  │ rank             │ (no normality assumption)        │
  ├──────────────────┼──────────────────────────────────┤
  │ Bootstrap test   │ When you don't know the          │
  │                  │ distribution (universal fallback)│
  └──────────────────┴──────────────────────────────────┘
```

---

## Paired t-test: Comparing CV Scores

```python
import numpy as np
from scipy import stats
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.datasets import make_classification
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

X, y = make_classification(n_samples=1000, n_features=20, random_state=42)

rf = RandomForestClassifier(n_estimators=100, random_state=42)
gb = GradientBoostingClassifier(n_estimators=100, random_state=42)

cv = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)
scores_rf = cross_val_score(rf, X, y, cv=cv, scoring="accuracy")
scores_gb = cross_val_score(gb, X, y, cv=cv, scoring="accuracy")

print(f"RF:  {scores_rf.mean():.3f} +/- {scores_rf.std():.3f}")
print(f"GB:  {scores_gb.mean():.3f} +/- {scores_gb.std():.3f}")

t_stat, p_value = stats.ttest_rel(scores_rf, scores_gb)
print(f"\nPaired t-test: t={t_stat:.3f}, p={p_value:.4f}")

if p_value < 0.05:
    better = "RF" if scores_rf.mean() > scores_gb.mean() else "GB"
    print(f"Significant difference! {better} is better.")
else:
    print("No significant difference between the models.")
```

---

## McNemar's Test: The Right Test for Classifiers

```
  McNEMAR'S TEST
  ==============

  Focus on where models DISAGREE:

                    Model B correct    Model B wrong
  Model A correct  [  Both right  ]   [A right, B wrong]
  Model A wrong    [A wrong, B right] [  Both wrong    ]

  Only the off-diagonal cells matter!
  If A->wrong, B->right happens much more than
  A->right, B->wrong, then B is better.
```

```python
import numpy as np
from scipy import stats

np.random.seed(42)
n = 1000

true_labels = np.random.binomial(1, 0.5, n)
preds_a = (np.random.rand(n) < 0.85).astype(int)
preds_b = (np.random.rand(n) < 0.88).astype(int)

correct_a = (preds_a == true_labels)
correct_b = (preds_b == true_labels)

a_right_b_wrong = np.sum(correct_a & ~correct_b)
a_wrong_b_right = np.sum(~correct_a & correct_b)

print(f"A right, B wrong: {a_right_b_wrong}")
print(f"A wrong, B right: {a_wrong_b_right}")

n_discordant = a_right_b_wrong + a_wrong_b_right
if n_discordant > 25:
    chi2 = (abs(a_right_b_wrong - a_wrong_b_right) - 1) ** 2 / n_discordant
    p_value = 1 - stats.chi2.cdf(chi2, df=1)
else:
    p_value = stats.binom_test(a_right_b_wrong, n_discordant, 0.5)

print(f"McNemar's test: p = {p_value:.4f}")
```

---

## Bootstrap Confidence Intervals

```
  BOOTSTRAP: The Swiss Army Knife
  ================================

  Don't know the distribution? Just resample!

  1. Take your data (n samples)
  2. Resample WITH replacement (n samples)
  3. Compute your statistic
  4. Repeat 10,000 times
  5. The distribution of statistics IS your confidence interval

  ┌─────────────────────────────────────────┐
  │  Original data: [a, b, c, d, e]         │
  │                                         │
  │  Bootstrap 1:   [b, b, d, a, e] -> 0.82│
  │  Bootstrap 2:   [c, a, a, d, b] -> 0.79│
  │  Bootstrap 3:   [e, d, b, b, c] -> 0.85│
  │  ...                                    │
  │  Bootstrap 10000: [a, c, e, e, d]-> 0.81│
  │                                         │
  │  Sort all 10000 statistics.             │
  │  2.5th percentile = CI lower bound      │
  │  97.5th percentile = CI upper bound     │
  └─────────────────────────────────────────┘
```

```python
import numpy as np

def bootstrap_ci(data, statistic_fn, n_bootstrap=10000, ci=0.95, seed=42):
    rng = np.random.RandomState(seed)
    n = len(data)
    stats = np.empty(n_bootstrap)

    for i in range(n_bootstrap):
        sample = data[rng.randint(0, n, size=n)]
        stats[i] = statistic_fn(sample)

    alpha = (1 - ci) / 2
    lower = np.percentile(stats, 100 * alpha)
    upper = np.percentile(stats, 100 * (1 - alpha))
    return lower, upper, stats

np.random.seed(42)
y_true = np.random.binomial(1, 0.5, 500)
y_pred = np.random.binomial(1, 0.5, 500)
correct = (y_true == y_pred).astype(float)

accuracy = correct.mean()
lower, upper, boot_stats = bootstrap_ci(correct, np.mean)

print(f"Accuracy: {accuracy:.3f}")
print(f"95% Bootstrap CI: [{lower:.3f}, {upper:.3f}]")
```

---

## Multiple Comparisons Problem

```
  THE PROBLEM
  ===========

  You compare 20 models pairwise.
  That's 190 comparisons.
  At p<0.05, you expect 190 * 0.05 = 9.5 false positives!

  SOLUTION: Bonferroni Correction
  ===============================

  New threshold = 0.05 / number_of_comparisons

  20 comparisons: threshold = 0.05/20 = 0.0025

  Or use Benjamini-Hochberg (FDR control):
  Less conservative, controls false discovery rate.
```

```python
import numpy as np
from scipy import stats

np.random.seed(42)
n_tests = 20
p_values = []
for _ in range(n_tests):
    a = np.random.randn(100)
    b = np.random.randn(100)
    _, p = stats.ttest_ind(a, b)
    p_values.append(p)

p_values = np.array(p_values)
bonferroni_threshold = 0.05 / n_tests

print(f"Uncorrected (p < 0.05): {np.sum(p_values < 0.05)} significant")
print(f"Bonferroni (p < {bonferroni_threshold:.4f}): "
      f"{np.sum(p_values < bonferroni_threshold)} significant")

sorted_p = np.sort(p_values)
bh_thresholds = 0.05 * np.arange(1, n_tests + 1) / n_tests
bh_significant = np.sum(sorted_p < bh_thresholds)
print(f"Benjamini-Hochberg: {bh_significant} significant")
```

---

## Confidence Intervals for Model Metrics

```python
import numpy as np
from scipy import stats


def wilson_ci(successes, total, confidence=0.95):
    z = stats.norm.ppf(1 - (1 - confidence) / 2)
    p_hat = successes / total
    denominator = 1 + z ** 2 / total
    center = (p_hat + z ** 2 / (2 * total)) / denominator
    margin = z * np.sqrt(p_hat * (1 - p_hat) / total + z ** 2 / (4 * total ** 2)) / denominator
    return center - margin, center + margin


accuracy = 0.85
n = 200
correct = int(accuracy * n)

lower, upper = wilson_ci(correct, n)
print(f"Accuracy: {accuracy:.3f}")
print(f"Wilson 95% CI: [{lower:.3f}, {upper:.3f}]")

for sample_size in [50, 100, 500, 1000, 5000]:
    correct = int(accuracy * sample_size)
    lo, hi = wilson_ci(correct, sample_size)
    width = hi - lo
    print(f"n={sample_size:>5d}: CI=[{lo:.3f}, {hi:.3f}], width={width:.3f}")
```

---

## Practical Checklist

```
  WHEN COMPARING TWO MODELS
  ==========================
  ┌───┬─────────────────────────────────────────┐
  │ 1 │ Use the SAME test set for both          │
  │ 2 │ Use paired tests (same samples)          │
  │ 3 │ McNemar's for classification             │
  │ 4 │ Paired t-test for CV fold scores         │
  │ 5 │ Bootstrap CI if unsure about assumptions│
  │ 6 │ Report effect size, not just p-value     │
  │ 7 │ Correct for multiple comparisons         │
  │ 8 │ Consider practical significance too      │
  └───┴─────────────────────────────────────────┘

  A statistically significant 0.1% improvement
  might not be worth the extra complexity!
```

---

## Exercises

**Exercise 1:** Train two models on the Titanic dataset. Use McNemar's
test to determine if the difference in accuracy is statistically
significant. Report the p-value and your conclusion.

**Exercise 2:** Compute bootstrap confidence intervals for precision,
recall, and F1 score of a classifier. Which metric has the widest CI?

**Exercise 3:** Run an A/B test simulation. Generate 1000 experiments
where the null hypothesis is true (no real difference). Count how
many times p < 0.05. Verify it is about 50 out of 1000.

**Exercise 4:** Compare 5 models using 10-fold CV. Apply Bonferroni
correction to all pairwise comparisons. How many significant
differences remain after correction vs without?

**Exercise 5:** Determine the minimum sample size needed to detect
a 2% accuracy improvement (from 85% to 87%) with 80% power at
the 5% significance level. Use a power analysis.

---

[Next: Reference - Key Formulas ->](reference-formulas.md)
