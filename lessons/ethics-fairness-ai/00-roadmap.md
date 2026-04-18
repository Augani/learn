# Ethics, Fairness & Responsible AI - Track Roadmap

Welcome to the Ethics, Fairness & Responsible AI track. Building
models that work is only half the job — building models that work
*fairly* is the other half, and it's the half most courses skip.

This track bridges the gap between the brief coverage of bias in
Applied ML and the production safety focus in AI Engineering. You'll
learn to detect and measure bias, apply fairness metrics that
actually mean something, explain model decisions to stakeholders,
navigate the evolving regulatory landscape, and deploy AI systems
responsibly. Every lesson connects ethics to engineering — because
fairness isn't a checkbox, it's a design constraint.

```
  +----------------------------------------------------------+
  |       ETHICS, FAIRNESS & RESPONSIBLE AI                  |
  |                                                          |
  |   Understand --> Measure --> Explain --> Govern --> Ship  |
  |      |             |           |          |          |   |
  |    Ethics        Fairness   Interpret   Regulate   Deploy|
  +----------------------------------------------------------+
```

---

## Phase 1: Foundations (~4 hrs)

Why ethics matters in AI, and the many ways bias creeps into
machine learning systems.

- [ ] [01 - AI Ethics Foundations](01-ai-ethics-foundations.md)
- [ ] [02 - Types of Bias in ML](02-types-of-bias.md)

```
  Phase 1 Focus:
  +-----------+     +-----------+
  |  Why      | --> |  Where    |
  |  Ethics   |     |  Bias     |
  |  Matters  |     |  Hides    |
  +-----------+     +-----------+
```

---

## Phase 2: Fairness (~8 hrs)

Defining fairness mathematically, measuring it rigorously, and
mitigating bias through pre-processing, in-processing, and
post-processing techniques.

- [ ] [03 - Fairness Definitions and Metrics](03-fairness-definitions.md)
- [ ] [04 - Measuring Bias in Models](04-measuring-bias.md)
- [ ] [05 - Bias Mitigation: Pre-processing](05-bias-mitigation-preprocessing.md)
- [ ] [06 - Bias Mitigation: In-processing and Post-processing](06-bias-mitigation-inprocessing.md)

```
  Phase 2 Focus:
  +-----------+     +-----------+     +-----------+     +-----------+
  |  Define   | --> |  Measure  | --> |   Pre-    | --> |  In/Post  |
  |  Fairness |     |   Bias    |     | process   |     | process   |
  |  Metrics  |     |  Audits   |     | Mitigate  |     | Mitigate  |
  +-----------+     +-----------+     +-----------+     +-----------+
```

---

## Phase 3: Interpretability (~6 hrs)

Making models explain themselves — from simple feature importance
to SHAP values, LIME, and deep learning visualization.

- [ ] [07 - Model Interpretability Basics](07-interpretability-basics.md)
- [ ] [08 - SHAP and LIME](08-shap-lime.md)
- [ ] [09 - Interpreting Deep Learning Models](09-deep-learning-interpretability.md)

```
  Phase 3 Focus:
  +-----------+     +-----------+     +-----------+
  |  Feature  | --> |  SHAP &   | --> |  Deep     |
  | Importance|     |   LIME    |     | Learning  |
  |   & PDP   |     | Explainers|     | Grad-CAM  |
  +-----------+     +-----------+     +-----------+
```

---

## Phase 4: Governance & Regulation (~4 hrs)

Frameworks, standards, and laws that shape how AI systems must
be built, documented, and deployed.

- [ ] [10 - AI Governance Frameworks](10-ai-governance-frameworks.md)
- [ ] [11 - The EU AI Act and Regulatory Landscape](11-eu-ai-act-regulation.md)

```
  Phase 4 Focus:
  +-----------+     +-----------+
  | Governance| --> | EU AI Act |
  | Frameworks|     | & Global  |
  | & Standards|    | Regulation|
  +-----------+     +-----------+
```

---

## Phase 5: Practice (~10 hrs)

Responsible deployment, privacy, auditing, LLM-specific ethics,
and a capstone project that ties everything together.

- [ ] [12 - Responsible Deployment Practices](12-responsible-deployment.md)
- [ ] [13 - Privacy and Data Protection in ML](13-privacy-data-protection.md)
- [ ] [14 - Auditing ML Systems](14-auditing-ml-systems.md)
- [ ] [15 - Ethics of Large Language Models](15-llm-ethics.md)
- [ ] [16 - Capstone: Ethical AI Audit](16-capstone-ethical-audit.md)

```
  Phase 5 Focus:
  +-----------+     +-----------+     +-----------+     +-----------+     +-----------+
  | Responsible| --> |  Privacy  | --> |  Audit    | --> |   LLM     | --> | Capstone  |
  | Deployment |     |  & Data   |     |   ML      |     |  Ethics   |     |  Ethical  |
  |  Practices |     | Protection|     |  Systems  |     |  Issues   |     |   Audit   |
  +-----------+     +-----------+     +-----------+     +-----------+     +-----------+
```

---

## Reference Materials

Quick-look resources you will keep coming back to.

- [Governance Frameworks Reference](./reference-frameworks.md) — Comparison of NIST AI RMF, ISO 42001, OECD Principles, EU AI Act
- [Fairness & Interpretability Tools Reference](./reference-tools.md) — fairlearn, aif360, SHAP, LIME, Captum, InterpretML compared

---

## How to Use This Track

```
  +---------------------------------------------------+
  |  1. Read the lesson on your phone/tablet          |
  |  2. Try the code examples in a Jupyter notebook   |
  |  3. Do the exercises with real datasets            |
  |  4. Check the box when you feel confident          |
  |  5. Move to the next lesson                        |
  +---------------------------------------------------+
```

**Time estimate:** ~28-32 hours total (4-5 weeks at ~1 hour per day)

**Prerequisites:**
- ML Fundamentals (understanding of model training and evaluation)
- Applied ML recommended (model deployment, bias awareness basics)
- Basic Python (pandas, scikit-learn)

**Tools you will need:**
- Python 3.8+
- pip install pandas numpy matplotlib scikit-learn fairlearn aif360 shap lime interpret captum opacus

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Fairness and Machine Learning: Limitations and Opportunities** by Solon Barocas, Moritz Hardt, and Arvind Narayanan (MIT Press, 2023) — The definitive technical reference. *Free at fairmlbook.org*
- **Weapons of Math Destruction** by Cathy O'Neil (Crown, 2016) — Accessible introduction to algorithmic harm and why it matters
- **The Alignment Problem** by Brian Christian (W.W. Norton, 2020) — AI alignment, values, and the challenge of building systems that do what we mean

---

[Start with Lesson 01: AI Ethics Foundations -->](01-ai-ethics-foundations.md)
