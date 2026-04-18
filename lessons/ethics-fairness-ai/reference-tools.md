# Fairness & Interpretability Tools Reference

> Quick-reference comparison of the major open-source tools for fairness assessment, bias mitigation, and model interpretability.

---

## Tools Comparison Table

| Tool | Purpose | Language | Maintained By | License |
|------|---------|----------|---------------|---------|
| fairlearn | Fairness metrics & mitigation | Python | Microsoft | MIT |
| AI Fairness 360 (aif360) | Fairness metrics & mitigation | Python, R | IBM | Apache 2.0 |
| SHAP | Feature attribution (Shapley) | Python | Community | MIT |
| LIME | Local model explanations | Python | Community | BSD 2 |
| Captum | PyTorch model interpretability | Python | Meta | BSD 3 |
| InterpretML | Interpretable ML & explanations | Python | Microsoft | MIT |

---

## Fairlearn

**Purpose:** Assess and improve fairness of ML models

**Strengths:**
- Clean, well-documented API
- MetricFrame for group-level metric analysis
- Multiple mitigation algorithms (ExponentiatedGradient, ThresholdOptimizer, GridSearch)
- Active development and community
- Integrates well with scikit-learn

**Limitations:**
- Focused on binary classification and regression
- Limited deep learning support
- Mitigation algorithms can be slow on large datasets

**Key Features:**
- `MetricFrame` — compute any metric broken down by sensitive groups
- `ExponentiatedGradient` — in-processing fairness constraints
- `ThresholdOptimizer` — post-processing threshold adjustment
- `GridSearch` — grid search over fairness-constrained models
- Built-in fairness metrics: demographic parity, equalized odds, etc.

**Install:**
```bash
pip install fairlearn
```

**Quick Start:**
```python
from fairlearn.metrics import MetricFrame, demographic_parity_difference
from fairlearn.reductions import ExponentiatedGradient, DemographicParity

# Measure fairness
mf = MetricFrame(metrics={'accuracy': accuracy_score},
                 y_true=y_test, y_pred=y_pred,
                 sensitive_features=sensitive)
print(mf.by_group)

# Mitigate bias
mitigator = ExponentiatedGradient(
    estimator=LogisticRegression(),
    constraints=DemographicParity()
)
mitigator.fit(X_train, y_train, sensitive_features=s_train)
```

**Docs:** fairlearn.org

---

## AI Fairness 360 (aif360)

**Purpose:** Comprehensive fairness toolkit with 70+ metrics and 10+ algorithms

**Strengths:**
- Most comprehensive fairness toolkit available
- Pre-processing, in-processing, and post-processing algorithms
- Extensive metric library (70+ fairness metrics)
- Built-in datasets for fairness research
- Academic backing and citations

**Limitations:**
- Steeper learning curve than fairlearn
- Custom dataset format (BinaryLabelDataset) can be cumbersome
- Some algorithms are research-grade, not production-ready
- Slower development pace

**Key Features:**
- `BinaryLabelDataset` / `StandardDataset` — fairness-aware data containers
- `Reweighing` — pre-processing reweighting
- `AdversarialDebiasing` — in-processing adversarial approach
- `CalibratedEqOddsPostprocessing` — post-processing calibration
- `ClassificationMetric` — comprehensive fairness metrics

**Install:**
```bash
pip install aif360
```

**Quick Start:**
```python
from aif360.datasets import BinaryLabelDataset
from aif360.metrics import ClassificationMetric
from aif360.algorithms.preprocessing import Reweighing

# Create dataset
dataset = BinaryLabelDataset(df=df, label_names=['income'],
                              protected_attribute_names=['sex'])

# Measure fairness
metric = ClassificationMetric(dataset, classified_dataset,
                               unprivileged_groups=[{'sex': 0}],
                               privileged_groups=[{'sex': 1}])
print(f"Disparate impact: {metric.disparate_impact():.3f}")
```

**Docs:** aif360.readthedocs.io

---

## SHAP (SHapley Additive exPlanations)

**Purpose:** Explain individual predictions using Shapley values from game theory

**Strengths:**
- Mathematically grounded (Shapley values guarantee fairness properties)
- Multiple explainer types optimized for different models
- Rich visualization library (waterfall, summary, dependence, force plots)
- Both local and global explanations
- TreeExplainer is exact and fast for tree models

**Limitations:**
- KernelExplainer is slow for large datasets
- Can be memory-intensive for large models
- Assumes feature independence (can be misleading with correlated features)
- Deep learning support less mature than tree support

**Key Explainers:**

| Explainer | Best For | Speed | Exact? |
|-----------|----------|-------|--------|
| TreeExplainer | XGBoost, LightGBM, RF, GBM | Fast | Yes |
| LinearExplainer | Linear/logistic regression | Fast | Yes |
| DeepExplainer | Deep learning (PyTorch, TF) | Medium | Approximate |
| KernelExplainer | Any model | Slow | Approximate |

**Install:**
```bash
pip install shap
```

**Quick Start:**
```python
import shap

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

# Summary plot (global)
shap.summary_plot(shap_values, X_test)

# Waterfall plot (local)
shap.plots.waterfall(shap.Explanation(
    values=shap_values[0],
    base_values=explainer.expected_value,
    data=X_test[0]
))
```

**Docs:** shap.readthedocs.io

---

## LIME (Local Interpretable Model-agnostic Explanations)

**Purpose:** Explain individual predictions by fitting local linear models

**Strengths:**
- Truly model-agnostic (works with any model)
- Intuitive explanations (linear weights)
- Supports tabular, text, and image data
- Fast for individual explanations
- Easy to explain to non-technical audiences

**Limitations:**
- Explanations can vary between runs (instability)
- No mathematical guarantees (unlike SHAP)
- Local only — no global view
- Neighborhood sampling can miss important patterns
- Sensitive to hyperparameters (kernel width, num_samples)

**Install:**
```bash
pip install lime
```

**Quick Start:**
```python
import lime.lime_tabular

explainer = lime.lime_tabular.LimeTabularExplainer(
    training_data=X_train,
    feature_names=feature_names,
    class_names=['rejected', 'approved'],
    mode='classification'
)

explanation = explainer.explain_instance(
    X_test[0], model.predict_proba, num_features=5
)
explanation.show_in_notebook()
```

**Docs:** github.com/marcotcr/lime

---

## Captum

**Purpose:** Model interpretability for PyTorch models

**Strengths:**
- Deep integration with PyTorch
- Comprehensive attribution methods (20+)
- Supports gradient-based, perturbation-based, and layer-based methods
- Built-in visualization tools
- Active development by Meta

**Limitations:**
- PyTorch only (no TensorFlow/scikit-learn support)
- Steeper learning curve for advanced methods
- Some methods are computationally expensive

**Key Methods:**

| Method | Type | Best For |
|--------|------|----------|
| IntegratedGradients | Gradient | General attribution |
| GradientShap | Gradient | SHAP-like for neural nets |
| DeepLift | Gradient | Reference-based attribution |
| GradCAM | Layer | CNN visualization |
| LayerConductance | Layer | Layer-level attribution |
| FeatureAblation | Perturbation | Model-agnostic |

**Install:**
```bash
pip install captum
```

**Quick Start:**
```python
from captum.attr import IntegratedGradients

ig = IntegratedGradients(model)
attributions = ig.attribute(input_tensor, target=predicted_class)
```

**Docs:** captum.ai

---

## InterpretML

**Purpose:** Interpretable ML models and model explanations

**Strengths:**
- Explainable Boosting Machine (EBM) — glass-box model with near-black-box accuracy
- Unified API for multiple explanation methods
- Interactive dashboard for exploration
- Both intrinsic and post-hoc interpretability
- Good for regulated industries

**Limitations:**
- EBM training can be slow
- Dashboard requires Jupyter
- Smaller community than SHAP/LIME
- Limited deep learning support

**Key Features:**
- `ExplainableBoostingClassifier` — interpretable boosting model
- `EBMExplanation` — global and local explanations for EBM
- Wrappers for SHAP, LIME, and other methods
- Interactive visualization dashboard

**Install:**
```bash
pip install interpret
```

**Quick Start:**
```python
from interpret.glassbox import ExplainableBoostingClassifier
from interpret import show

ebm = ExplainableBoostingClassifier()
ebm.fit(X_train, y_train)

# Global explanation
ebm_global = ebm.explain_global()
show(ebm_global)

# Local explanation
ebm_local = ebm.explain_local(X_test[:5], y_test[:5])
show(ebm_local)
```

**Docs:** interpret.ml

---

## Tool Selection Guide

```
WHICH TOOL SHOULD I USE?

Need to MEASURE fairness?
├── Quick metrics → fairlearn (MetricFrame)
└── Comprehensive audit → aif360 (ClassificationMetric)

Need to MITIGATE bias?
├── In-processing constraints → fairlearn (ExponentiatedGradient)
├── Pre-processing → aif360 (Reweighing)
└── Post-processing → fairlearn (ThresholdOptimizer)

Need to EXPLAIN a prediction?
├── Tree model → SHAP (TreeExplainer) — fast, exact
├── Any model, quick → LIME — simple, model-agnostic
├── PyTorch model → Captum — deep integration
└── Want a glass-box model → InterpretML (EBM)

Need GLOBAL understanding?
├── Feature importance → SHAP (summary plot)
├── Interpretable model → InterpretML (EBM)
└── Partial dependence → scikit-learn (built-in)

Need to satisfy REGULATORS?
├── Documentation → fairlearn + SHAP (comprehensive)
├── Glass-box model → InterpretML (inherently interpretable)
└── Full audit → aif360 + fairlearn + SHAP (combined)
```

---

## Installation Summary

Install all tools at once:

```bash
pip install fairlearn aif360 shap lime captum interpret
```

Minimal install (most common tools):

```bash
pip install fairlearn shap lime
```
