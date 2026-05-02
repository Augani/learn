# Governance Frameworks Reference

> Quick-reference comparison of major AI governance frameworks, standards, and regulations.

---

## Framework Comparison Table

| Framework | Issuing Body | Year | Scope | Mandatory? | Focus |
|-----------|-------------|------|-------|------------|-------|
| NIST AI RMF | US NIST | 2023 | US-focused, any AI | Voluntary | Risk management |
| ISO/IEC 42001 | ISO/IEC | 2023 | Global, any AI | Voluntary* | Management system |
| OECD AI Principles | OECD | 2019 | 46 countries | Principles | Values & trust |
| EU AI Act | European Union | 2024 | EU market | Mandatory | Risk categories |
| IEEE 7000 | IEEE | 2021 | Global, any system | Voluntary | Ethical design |
| Singapore FEAT | MAS | 2018 | Singapore, finance | Voluntary | Financial AI |

\* ISO 42001 is voluntary but may be required by contracts or procurement standards.

---

## NIST AI Risk Management Framework (AI RMF 1.0)

**Published:** January 2023
**Scope:** Voluntary framework for any organization developing or deploying AI

**Core Functions:**

| Function | Purpose | Key Activities |
|----------|---------|----------------|
| GOVERN | Establish accountability | Policies, roles, culture, oversight |
| MAP | Identify context and risks | Risk identification, stakeholder analysis, impact assessment |
| MEASURE | Assess and track risks | Metrics, testing, monitoring, evaluation |
| MANAGE | Prioritize and act | Mitigation, response, documentation, improvement |

**Trustworthiness Characteristics:**
- Valid and reliable
- Safe
- Secure and resilient
- Accountable and transparent
- Explainable and interpretable
- Privacy-enhanced
- Fair with harmful bias managed

**Link:** [NIST AI RMF](https://www.nist.gov/artificial-intelligence/executive-order-safe-secure-and-trustworthy-artificial-intelligence)

---

## ISO/IEC 42001: AI Management System

**Published:** December 2023
**Scope:** International standard for establishing, implementing, and improving an AI management system

**Key Requirements:**

| Clause | Requirement | Description |
|--------|-------------|-------------|
| 4 | Context | Understand organization and stakeholder needs |
| 5 | Leadership | AI policy, roles, responsibilities |
| 6 | Planning | Risk assessment, objectives, change planning |
| 7 | Support | Resources, competence, awareness, communication |
| 8 | Operation | AI system lifecycle, data management, third parties |
| 9 | Performance | Monitoring, measurement, internal audit, review |
| 10 | Improvement | Nonconformity, corrective action, continual improvement |

**Related Standards:**
- ISO/IEC 23894 — AI risk management guidance
- ISO/IEC 38507 — Governance of AI
- ISO/IEC 5338 — AI system lifecycle processes

---

## EU AI Act

**Entered into force:** August 2024
**Full application:** August 2026 (phased)
**Scope:** Any AI system placed on the EU market or affecting EU residents

**Risk Categories:**

| Risk Level | Examples | Requirements |
|------------|----------|-------------|
| Unacceptable | Social scoring, real-time biometric surveillance | Banned |
| High | Hiring AI, credit scoring, medical devices, law enforcement | Full compliance: risk management, data governance, documentation, human oversight, accuracy, robustness, cybersecurity |
| Limited | Chatbots, deepfakes, emotion recognition | Transparency: disclose AI use |
| Minimal | Spam filters, game AI, recommendations | No requirements (voluntary codes) |

**Key Deadlines:**
- Feb 2025: Banned practices take effect
- Aug 2025: General-purpose AI rules apply
- Aug 2026: High-risk system rules apply
- Aug 2027: Full enforcement for all systems

**Penalties:** Up to €35 million or 7% of global annual turnover

---

## OECD AI Principles

**Adopted:** May 2019 (updated 2024)
**Scope:** 46 member and partner countries

**Five Principles:**

| Principle | Description |
|-----------|-------------|
| Inclusive growth | AI should benefit people and the planet |
| Human-centered values | Respect human rights, fairness, transparency |
| Transparency | Meaningful information about AI systems |
| Robustness | Secure, safe, and accountable throughout lifecycle |
| Accountability | Organizations responsible for proper functioning |

---

## IEEE 7000: Ethical Design of Autonomous and Intelligent Systems

**Published:** 2021
**Scope:** Process standard for ethical design of any autonomous/intelligent system

**Key Processes:**
1. Concept of operations and ethical values identification
2. Ethical requirements definition
3. Ethical risk analysis
4. Ethical design and development
5. Ethical validation and verification

---

## Compliance Checklist Template

```
FRAMEWORK COMPLIANCE TRACKER

Organization: _______________
System: _______________
Date: _______________

NIST AI RMF
[ ] GOVERN functions implemented
[ ] MAP functions implemented
[ ] MEASURE functions implemented
[ ] MANAGE functions implemented

ISO 42001
[ ] AI policy established
[ ] Risk assessment process defined
[ ] Data management controls in place
[ ] Performance monitoring active
[ ] Internal audit scheduled

EU AI Act (if applicable)
[ ] Risk category determined
[ ] Conformity assessment planned
[ ] Technical documentation prepared
[ ] Human oversight designed
[ ] Post-market monitoring planned
[ ] Registration in EU database (high-risk)

DOCUMENTATION
[ ] Model card created
[ ] Datasheet for dataset created
[ ] Impact assessment completed
[ ] Audit trail maintained
```

---

## Sector-Specific Frameworks

| Sector | Framework/Regulation | Jurisdiction | Key Requirements |
|--------|---------------------|-------------|-----------------|
| Healthcare | FDA AI/ML SaMD | US | Clinical validation, predetermined change control |
| Healthcare | MDR/IVDR | EU | CE marking, clinical evidence, post-market surveillance |
| Finance | SR 11-7 | US | Model risk management, validation, governance |
| Finance | FEAT Principles | Singapore | Fairness, ethics, accountability, transparency |
| Employment | NYC Local Law 144 | NYC | Bias audit for automated employment decisions |
| Employment | Illinois AIVI Act | Illinois | Consent for AI video interview analysis |
| General | Colorado AI Act | Colorado | Disclosure, impact assessment for high-risk AI |

---

## Further Reading

- NIST AI RMF: nist.gov/artificial-intelligence
- ISO 42001: iso.org/standard/81230.html
- EU AI Act: artificialintelligenceact.eu
- OECD AI Policy Observatory: oecd.ai
- IEEE 7000: standards.ieee.org/ieee/7000/6781/
