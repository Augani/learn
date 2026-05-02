# Lesson 11: The EU AI Act and Regulatory Landscape

> AI regulation is coming whether you're ready or not — understanding the rules now saves you from scrambling later.

---

## The Traffic Laws Analogy

Traffic laws don't treat all vehicles the same. A bicycle has
different rules than a car, which has different rules than a
semi-truck carrying hazardous materials. The higher the risk, the
stricter the rules.

The EU AI Act works the same way. A spam filter (minimal risk) has
almost no requirements. A medical diagnosis AI (high risk) needs
extensive documentation, testing, and monitoring. A social scoring
system (unacceptable risk) is banned outright. The risk determines
the rules.

```
  TRAFFIC LAWS                      EU AI ACT
  +------------------+              +------------------+
  | Bicycle:         |              | Minimal risk:    |
  |  few rules       |              |  no requirements |
  +------------------+              +------------------+
  | Car:             |              | Limited risk:    |
  |  license, tests  |              |  transparency    |
  +------------------+              +------------------+
  | Truck:           |              | High risk:       |
  |  special license,|              |  full compliance |
  |  inspections     |              |  requirements    |
  +------------------+              +------------------+
  | Hazmat truck:    |              | Unacceptable:    |
  |  banned on some  |              |  banned          |
  |  roads           |              |                  |
  +------------------+              +------------------+
```

---

## The EU AI Act: Risk Categories

The EU AI Act (entered into force August 2024, with phased
compliance deadlines through 2027) classifies AI systems into
four risk tiers.

```
  EU AI ACT RISK PYRAMID

          /\
         /  \         UNACCEPTABLE RISK
        / ✗✗ \        Banned. Social scoring, real-time
       /______\       biometric surveillance (with exceptions)
      /        \
     / HIGH RISK\     Strict requirements: conformity
    /   ██████   \    assessment, documentation, monitoring,
   /______________\   human oversight, data governance
  /                \
 / LIMITED RISK     \ Transparency obligations:
/   ░░░░░░░░░░░░░░  \ disclose AI use to users
/____________________\
|                      |
|   MINIMAL RISK       | No specific requirements.
|   (most AI systems)  | Voluntary codes of conduct.
|______________________|
```

### Unacceptable Risk (Banned)

- Social scoring by governments
- Real-time remote biometric identification in public spaces
  (with narrow law enforcement exceptions)
- Manipulation of vulnerable groups
- Emotion recognition in workplaces and schools
- Untargeted scraping of facial images for databases

### High Risk

AI systems in these areas must comply with strict requirements:

- **Biometric identification** (non-real-time)
- **Critical infrastructure** (energy, water, transport)
- **Education** (admissions, grading, exam proctoring)
- **Employment** (hiring, promotion, termination)
- **Essential services** (credit scoring, insurance, social benefits)
- **Law enforcement** (risk assessment, evidence evaluation)
- **Migration** (visa processing, border control)
- **Justice** (sentencing assistance)

### Limited Risk

Systems that interact with people must disclose they are AI:
- Chatbots must identify themselves as AI
- Deepfakes must be labeled
- AI-generated content must be marked

### Minimal Risk

Everything else — spam filters, video game AI, recommendation
systems (with some exceptions). No specific requirements, but
voluntary codes of conduct are encouraged.

---

## High-Risk Compliance Requirements

```
  HIGH-RISK AI SYSTEM REQUIREMENTS

  ┌─────────────────────────────────────────────────────┐
  │ 1. RISK MANAGEMENT SYSTEM                          │
  │    Continuous risk identification and mitigation     │
  ├─────────────────────────────────────────────────────┤
  │ 2. DATA GOVERNANCE                                 │
  │    Training data must be relevant, representative,  │
  │    and free from errors                             │
  ├─────────────────────────────────────────────────────┤
  │ 3. TECHNICAL DOCUMENTATION                         │
  │    Detailed docs before market placement            │
  ├─────────────────────────────────────────────────────┤
  │ 4. RECORD-KEEPING                                  │
  │    Automatic logging of system operation            │
  ├─────────────────────────────────────────────────────┤
  │ 5. TRANSPARENCY                                    │
  │    Clear instructions for deployers                 │
  ├─────────────────────────────────────────────────────┤
  │ 6. HUMAN OVERSIGHT                                 │
  │    Designed for effective human supervision          │
  ├─────────────────────────────────────────────────────┤
  │ 7. ACCURACY, ROBUSTNESS, CYBERSECURITY             │
  │    Appropriate levels throughout lifecycle          │
  ├─────────────────────────────────────────────────────┤
  │ 8. CONFORMITY ASSESSMENT                           │
  │    Before placing on market (self or third-party)   │
  └─────────────────────────────────────────────────────┘
```

---

## Global Regulatory Landscape

The EU isn't alone. AI regulation is emerging worldwide.

```
  GLOBAL AI REGULATION MAP

  ┌──────────────┬────────────────────────────────────────┐
  │ Region       │ Approach                               │
  ├──────────────┼────────────────────────────────────────┤
  │ EU           │ Comprehensive risk-based regulation    │
  │              │ (EU AI Act — mandatory)                │
  ├──────────────┼────────────────────────────────────────┤
  │ US           │ Sector-specific + executive orders     │
  │              │ NIST AI RMF (voluntary)                │
  │              │ State laws (Colorado AI Act, etc.)     │
  │              │ Agency guidance (FDA, FTC, EEOC)       │
  ├──────────────┼────────────────────────────────────────┤
  │ China        │ Algorithm recommendation regulation    │
  │              │ Deep synthesis (deepfake) regulation   │
  │              │ Generative AI regulation               │
  ├──────────────┼────────────────────────────────────────┤
  │ UK           │ Pro-innovation, sector-specific        │
  │              │ No single AI law; existing regulators  │
  │              │ apply AI principles to their domains   │
  ├──────────────┼────────────────────────────────────────┤
  │ Canada       │ AIDA (Artificial Intelligence and      │
  │              │ Data Act) — proposed                   │
  ├──────────────┼────────────────────────────────────────┤
  │ Brazil       │ AI regulatory framework — proposed     │
  └──────────────┴────────────────────────────────────────┘
```

---

## Sector-Specific Rules

Some industries have additional AI-specific requirements:

```
  SECTOR-SPECIFIC AI REGULATION

  HEALTHCARE
  ├── FDA: AI/ML-based Software as Medical Device (SaMD)
  ├── Predetermined change control plans
  └── Clinical validation requirements

  FINANCE
  ├── Fair lending laws (ECOA, Fair Housing Act)
  ├── Model risk management (SR 11-7)
  ├── Adverse action notice requirements
  └── Anti-discrimination in credit decisions

  EMPLOYMENT
  ├── EEOC guidance on AI in hiring
  ├── NYC Local Law 144 (automated employment decisions)
  ├── Illinois AI Video Interview Act
  └── EU AI Act high-risk classification

  AUTONOMOUS VEHICLES
  ├── NHTSA guidelines
  ├── State-level regulations
  └── EU type-approval requirements
```

---

## Compliance Checklist

```
  EU AI ACT COMPLIANCE CHECKLIST (High-Risk Systems)

  CLASSIFICATION
  [ ] Determined risk category of AI system
  [ ] Identified applicable sector-specific rules
  [ ] Documented classification rationale

  DATA GOVERNANCE
  [ ] Training data is documented (datasheet)
  [ ] Data quality measures in place
  [ ] Bias in training data assessed
  [ ] Data representativeness verified

  DOCUMENTATION
  [ ] Technical documentation complete
  [ ] Model card created
  [ ] Risk assessment conducted
  [ ] Instructions for use written

  TESTING
  [ ] Accuracy metrics computed and documented
  [ ] Fairness metrics computed across groups
  [ ] Robustness testing performed
  [ ] Cybersecurity assessment done

  HUMAN OVERSIGHT
  [ ] Human oversight mechanisms designed
  [ ] Override capabilities implemented
  [ ] Operator training materials prepared

  MONITORING
  [ ] Post-deployment monitoring plan
  [ ] Incident reporting process defined
  [ ] Re-assessment triggers identified
  [ ] Logging and record-keeping active

  TRANSPARENCY
  [ ] Users informed system is AI-powered
  [ ] Explanation capability available
  [ ] Contact information for complaints
```

---

## Preparing for Compliance

Even if your organization isn't currently subject to the EU AI Act,
preparing now is wise — regulation is expanding globally.

```
  COMPLIANCE PREPARATION ROADMAP

  NOW (regardless of jurisdiction)
  ├── Inventory all AI systems
  ├── Classify by risk level
  ├── Start documenting (model cards, datasheets)
  └── Establish fairness testing practices

  SHORT TERM (6-12 months)
  ├── Implement bias auditing pipeline
  ├── Create governance policies
  ├── Train teams on responsible AI
  └── Set up monitoring infrastructure

  MEDIUM TERM (12-24 months)
  ├── Conduct conformity assessments
  ├── Implement human oversight mechanisms
  ├── Establish incident response procedures
  └── Prepare for regulatory audits
```

---

## Exercises

### Exercise 1: Risk Classification

Classify each of these AI systems under the EU AI Act and explain
your reasoning:

1. A chatbot that helps customers find products on an e-commerce site
2. An AI system that scores job applicants' resumes
3. An AI that detects defects in manufactured products
4. A social media content recommendation algorithm
5. An AI system that determines eligibility for social benefits
6. A real-time facial recognition system in a shopping mall
7. An AI tutor that adapts to student learning styles

### Exercise 2: Compliance Gap Analysis

Pick an AI system you've worked with (or a well-known public one)
and complete the compliance checklist above. For each unchecked
item, write a brief plan for how you would address it. Estimate
the effort required for full compliance.

---

Next: [Lesson 12: Responsible Deployment Practices](./12-responsible-deployment.md)
