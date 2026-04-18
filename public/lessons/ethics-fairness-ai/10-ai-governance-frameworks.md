# Lesson 10: AI Governance Frameworks

> Governance frameworks are the building codes of AI — they tell you what to document, what to test, and what to disclose before you ship.

---

## The Food Safety Analogy

Restaurants don't just cook food and hope for the best. They follow
food safety regulations: temperature logs, ingredient sourcing
records, hygiene inspections, allergen labeling. These frameworks
exist because the consequences of getting it wrong are serious.

AI governance works the same way. Frameworks like NIST AI RMF and
ISO 42001 define what organizations must document, test, and
monitor when building AI systems. Model cards are like nutrition
labels. Datasheets are like ingredient lists. Impact assessments
are like health inspections.

```
  FOOD SAFETY                       AI GOVERNANCE
  +------------------+              +------------------+
  | Temperature logs |              | Model cards      |
  | Ingredient lists |              | Datasheets       |
  | Hygiene audits   |              | Bias audits      |
  | Allergen labels  |              | Risk assessments |
  | Recall procedures|              | Incident response|
  +------------------+              +------------------+
        |                                  |
        v                                  v
  "Document everything.            "Document everything.
   Test regularly.                  Test regularly.
   Be ready to pull it."           Be ready to pull it."
```

---

## Major AI Governance Frameworks

### NIST AI Risk Management Framework (AI RMF)

The US National Institute of Standards and Technology released the
AI RMF in January 2023. It's voluntary but widely adopted.

```
  NIST AI RMF: FOUR CORE FUNCTIONS

  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │  GOVERN   │     │   MAP    │     │  MEASURE  │     │  MANAGE  │
  │           │     │          │     │           │     │          │
  │ Policies  │     │ Context  │     │ Assess    │     │ Mitigate │
  │ Roles     │ --> │ Risks    │ --> │ Monitor   │ --> │ Respond  │
  │ Culture   │     │ Impacts  │     │ Evaluate  │     │ Improve  │
  │ Oversight │     │ Stakehldrs│    │ Track     │     │ Document │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘

  GOVERN: Establish policies and accountability
  MAP:    Identify and contextualize AI risks
  MEASURE: Assess and track identified risks
  MANAGE: Prioritize and act on risks
```

**Key characteristics:**
- Voluntary, not regulatory
- Risk-based approach (not one-size-fits-all)
- Applicable to any AI system
- Emphasizes trustworthiness characteristics: valid, reliable,
  safe, secure, accountable, transparent, explainable, fair

### ISO/IEC 42001: AI Management System

The international standard for AI management systems, published
in 2023. Think of it as ISO 9001 (quality management) but for AI.

**Key requirements:**
- AI policy and objectives
- Risk assessment process
- Data management controls
- Model lifecycle management
- Performance monitoring
- Continual improvement

### OECD AI Principles

Adopted by 46 countries. Five principles for trustworthy AI:

1. **Inclusive growth** — AI should benefit people and the planet
2. **Human-centered values** — Respect human rights and fairness
3. **Transparency** — Meaningful information about AI systems
4. **Robustness** — Secure, safe, and accountable
5. **Accountability** — Organizations are responsible for their AI

```
  FRAMEWORK COMPARISON

  Framework     Scope        Mandatory?   Focus
  ───────────   ──────────   ──────────   ──────────────────
  NIST AI RMF   US-focused   Voluntary    Risk management
  ISO 42001     Global       Voluntary*   Management system
  OECD AI       46 countries Principles   Values & principles
  EU AI Act     EU           Mandatory    Risk categories
  (Lesson 11)

  * ISO 42001 is voluntary but may be required by contracts
    or industry standards
```

---

## Model Cards

Model cards (Mitchell et al., 2019) are standardized documentation
for ML models — like a nutrition label for AI.

```
  MODEL CARD STRUCTURE

  ┌─────────────────────────────────────────┐
  │ MODEL CARD: Loan Approval Model v2.1    │
  ├─────────────────────────────────────────┤
  │ Model Details                           │
  │   - Developer: Risk Analytics Team      │
  │   - Type: GradientBoosting Classifier   │
  │   - Version: 2.1 (2024-01-15)          │
  │   - License: Internal use only          │
  ├─────────────────────────────────────────┤
  │ Intended Use                            │
  │   - Primary: Loan pre-screening         │
  │   - Out-of-scope: Final approval        │
  ├─────────────────────────────────────────┤
  │ Training Data                           │
  │   - Source: Internal loan records       │
  │   - Size: 500K applications             │
  │   - Date range: 2019-2023              │
  ├─────────────────────────────────────────┤
  │ Performance                             │
  │   - Overall AUC: 0.87                   │
  │   - Group A AUC: 0.89                   │
  │   - Group B AUC: 0.83                   │
  ├─────────────────────────────────────────┤
  │ Fairness Metrics                        │
  │   - Demographic parity diff: 0.08       │
  │   - Equalized odds diff: 0.05           │
  │   - Disparate impact ratio: 0.85        │
  ├─────────────────────────────────────────┤
  │ Limitations & Risks                     │
  │   - Not validated for applicants < 21   │
  │   - Performance degrades for rural areas│
  │   - Requires quarterly bias re-audit    │
  └─────────────────────────────────────────┘
```

```python
import json
from datetime import datetime

def generate_model_card(model_info):
    """Generate a model card as structured documentation."""
    card = {
        "schema_version": "1.0",
        "model_details": {
            "name": model_info.get("name", "Unnamed Model"),
            "version": model_info.get("version", "1.0"),
            "type": model_info.get("type", "Unknown"),
            "developer": model_info.get("developer", "Unknown"),
            "date": datetime.now().isoformat(),
            "license": model_info.get("license", "Internal"),
            "description": model_info.get("description", ""),
        },
        "intended_use": {
            "primary_uses": model_info.get("primary_uses", []),
            "out_of_scope": model_info.get("out_of_scope", []),
            "users": model_info.get("users", []),
        },
        "training_data": {
            "source": model_info.get("data_source", ""),
            "size": model_info.get("data_size", ""),
            "date_range": model_info.get("data_date_range", ""),
            "preprocessing": model_info.get("preprocessing", ""),
        },
        "performance": {
            "metrics": model_info.get("metrics", {}),
            "group_metrics": model_info.get("group_metrics", {}),
        },
        "fairness": {
            "sensitive_attributes_tested": model_info.get("sensitive_attrs", []),
            "fairness_metrics": model_info.get("fairness_metrics", {}),
            "mitigation_applied": model_info.get("mitigation", "None"),
        },
        "limitations": model_info.get("limitations", []),
        "ethical_considerations": model_info.get("ethical_considerations", []),
    }
    return card

# Example usage
card = generate_model_card({
    "name": "Loan Pre-screening Model",
    "version": "2.1",
    "type": "GradientBoostingClassifier",
    "developer": "Risk Analytics Team",
    "description": "Pre-screens loan applications for manual review",
    "primary_uses": ["Loan application pre-screening"],
    "out_of_scope": ["Final loan approval", "Credit limit setting"],
    "users": ["Loan officers", "Risk managers"],
    "data_source": "Internal loan application database",
    "data_size": "500,000 applications",
    "data_date_range": "2019-01 to 2023-12",
    "metrics": {"auc": 0.87, "accuracy": 0.82, "f1": 0.79},
    "group_metrics": {"group_a_auc": 0.89, "group_b_auc": 0.83},
    "sensitive_attrs": ["race", "sex", "age"],
    "fairness_metrics": {
        "demographic_parity_diff": 0.08,
        "equalized_odds_diff": 0.05,
        "disparate_impact_ratio": 0.85,
    },
    "limitations": [
        "Not validated for applicants under 21",
        "Performance degrades for rural zip codes",
        "Requires quarterly bias re-audit",
    ],
    "ethical_considerations": [
        "Model may perpetuate historical lending disparities",
        "Proxy features for race not fully removed",
    ],
})

print(json.dumps(card, indent=2))
```

---

## Datasheets for Datasets

Datasheets (Gebru et al., 2021) document datasets the way
datasheets document electronic components.

```python
def generate_datasheet(dataset_info):
    """Generate a datasheet for a dataset."""
    datasheet = {
        "motivation": {
            "purpose": dataset_info.get("purpose", ""),
            "creators": dataset_info.get("creators", ""),
            "funding": dataset_info.get("funding", ""),
        },
        "composition": {
            "instances": dataset_info.get("instance_description", ""),
            "count": dataset_info.get("count", 0),
            "missing_data": dataset_info.get("missing_data", ""),
            "confidential": dataset_info.get("confidential", False),
            "sensitive": dataset_info.get("sensitive_data", ""),
        },
        "collection": {
            "method": dataset_info.get("collection_method", ""),
            "who_collected": dataset_info.get("collectors", ""),
            "timeframe": dataset_info.get("timeframe", ""),
            "consent": dataset_info.get("consent", ""),
        },
        "preprocessing": {
            "steps": dataset_info.get("preprocessing_steps", []),
            "raw_available": dataset_info.get("raw_available", False),
        },
        "uses": {
            "intended": dataset_info.get("intended_uses", []),
            "not_suitable": dataset_info.get("not_suitable", []),
        },
        "distribution": {
            "license": dataset_info.get("license", ""),
            "access": dataset_info.get("access", ""),
        },
        "maintenance": {
            "owner": dataset_info.get("owner", ""),
            "update_frequency": dataset_info.get("update_frequency", ""),
            "contact": dataset_info.get("contact", ""),
        },
    }
    return datasheet

datasheet = generate_datasheet({
    "purpose": "Train loan approval prediction models",
    "creators": "Data Engineering Team",
    "instance_description": "One row per loan application",
    "count": 500000,
    "missing_data": "3.2% of income values, 1.1% of employment years",
    "sensitive_data": "Contains race, sex, age (used for fairness auditing only)",
    "collection_method": "Extracted from production loan application system",
    "timeframe": "January 2019 to December 2023",
    "consent": "Applicants consented to data use in application terms",
    "intended_uses": ["Loan pre-screening model training", "Fairness research"],
    "not_suitable": ["Marketing targeting", "Insurance pricing"],
    "license": "Internal use only",
    "owner": "Data Governance Team",
    "update_frequency": "Quarterly",
})

print(json.dumps(datasheet, indent=2))
```

---

## AI Impact Assessments

Before deploying an AI system, conduct an impact assessment to
identify and mitigate potential harms.

```
  AI IMPACT ASSESSMENT TEMPLATE

  1. SYSTEM DESCRIPTION
     - What does the system do?
     - Who are the users?
     - Who are the subjects (people affected)?

  2. RISK IDENTIFICATION
     - What could go wrong?
     - Who could be harmed?
     - How severe would the harm be?
     - How likely is it?

  3. FAIRNESS ANALYSIS
     - Which groups could be disproportionately affected?
     - What fairness metrics were computed?
     - Were any disparities found?

  4. TRANSPARENCY
     - Can the system's decisions be explained?
     - Is there a process for people to contest decisions?
     - What documentation exists?

  5. MITIGATION PLAN
     - What steps will reduce identified risks?
     - Who is responsible for each step?
     - What is the timeline?

  6. MONITORING PLAN
     - How will the system be monitored post-deployment?
     - What triggers a re-assessment?
     - How often will audits occur?
```

---

## Building a Governance Program

```
  GOVERNANCE PROGRAM COMPONENTS

  ┌─────────────────────────────────────────────────┐
  │                 AI GOVERNANCE                    │
  ├─────────────────────────────────────────────────┤
  │                                                 │
  │  PEOPLE           PROCESS          TECHNOLOGY   │
  │  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
  │  │ AI Ethics │    │ Risk     │    │ Fairness │  │
  │  │ Board     │    │ Assessment│   │ Tools    │  │
  │  │           │    │ Process  │    │          │  │
  │  │ Responsible│   │          │    │ Monitoring│ │
  │  │ AI Lead   │    │ Review   │    │ Dashboards│ │
  │  │           │    │ Gates    │    │          │  │
  │  │ Training  │    │          │    │ Audit    │  │
  │  │ Programs  │    │ Incident │    │ Pipelines│  │
  │  │           │    │ Response │    │          │  │
  │  └──────────┘    └──────────┘    └──────────┘  │
  └─────────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: Write a Model Card

Choose a model you've built (or use a scikit-learn example model)
and write a complete model card using the template above. Include:

1. Model details and intended use
2. Training data description
3. Performance metrics (overall and by group)
4. Fairness metrics
5. Limitations and ethical considerations

### Exercise 2: Conduct an Impact Assessment

Pick one of these scenarios and complete a full AI impact assessment:

1. A hospital deploying an AI triage system in the emergency room
2. A city using AI to allocate social services
3. A company using AI to screen job applications

For your chosen scenario, fill out all six sections of the impact
assessment template.

---

Next: [Lesson 11: The EU AI Act and Regulatory Landscape](./11-eu-ai-act-regulation.md)
