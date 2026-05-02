# Lesson 01: AI Ethics Foundations

> Before you optimize a model, decide what it should optimize *for* — because algorithms don't have values, but their consequences do.

---

## The Building Codes Analogy

Think about building codes. Before they existed, anyone could
construct a building however they wanted. Some buildings were fine.
Others collapsed, caught fire, or trapped people inside. Building
codes didn't emerge because engineers were evil — they emerged
because well-intentioned people built things that hurt others.

AI is in its "pre-building-code" era. We're constructing systems
that affect millions of people — who gets a loan, who gets hired,
who gets parole — and we're only beginning to establish the safety
standards. AI ethics isn't about slowing down progress. It's about
making sure what we build doesn't collapse on the people inside.

```
  BUILDING CODES                    AI ETHICS
  +------------------+              +------------------+
  | Fire safety      |              | Bias detection   |
  | Structural loads |              | Fairness metrics |
  | Emergency exits  |              | Transparency     |
  | Inspections      |              | Auditing         |
  | Accessibility    |              | Accountability   |
  +------------------+              +------------------+
        |                                  |
        v                                  v
  "We learned from                 "We're learning from
   buildings that                   algorithms that
   hurt people"                     hurt people"
```

---

## Why Ethics in AI Matters

AI systems make decisions that affect real lives. Unlike a
spreadsheet formula, these decisions often appear objective and
authoritative — even when they're deeply flawed.

Three properties make AI ethics uniquely challenging:

1. **Scale** — A biased human interviewer affects dozens of
   candidates. A biased hiring algorithm affects millions.

2. **Opacity** — When a human denies your loan, you can ask why.
   When an algorithm does it, the answer might be "the model said so."

3. **Feedback loops** — A model trained on biased historical data
   produces biased predictions, which generate biased new data,
   which trains an even more biased model.

```
  THE FEEDBACK LOOP PROBLEM

  Biased Historical ──> Train ──> Biased ──> Biased ──> Even More
       Data              Model    Predictions  Outcomes   Biased Data
        ^                                                     |
        |                                                     |
        +─────────────────────────────────────────────────────+
                    The cycle reinforces itself
```

---

## Historical Examples of AI Harm

These aren't hypothetical scenarios. They happened.

### COMPAS Recidivism Scores

In 2016, ProPublica analyzed COMPAS, a tool used by US courts to
predict whether defendants would reoffend. They found that Black
defendants were nearly twice as likely to be incorrectly flagged
as high risk compared to white defendants. The tool's creators
argued it was calibrated correctly — the same score meant the same
reoffending rate regardless of race. Both sides were right, which
reveals a fundamental tension in fairness (we'll explore this in
Lesson 03).

### Amazon's Hiring Algorithm

Amazon built an AI recruiting tool trained on 10 years of hiring
data. The problem: the historical data reflected a male-dominated
tech industry. The model learned to penalize resumes containing
the word "women's" (as in "women's chess club") and downgraded
graduates of all-women's colleges. Amazon scrapped the tool.

### Facial Recognition Disparities

Research by Joy Buolamwini and Timnit Gebru (the "Gender Shades"
study, 2018) showed that commercial facial recognition systems had
error rates of up to 34.7% for darker-skinned women, compared to
0.8% for lighter-skinned men. The training data was overwhelmingly
light-skinned and male.

### Healthcare Algorithm Bias

A 2019 study in Science found that a widely used healthcare
algorithm systematically discriminated against Black patients. The
algorithm used healthcare spending as a proxy for health needs —
but because Black patients historically had less access to
healthcare, they spent less, so the algorithm concluded they were
healthier. At a given risk score, Black patients were considerably
sicker than white patients.

```
  CASE STUDY PATTERN

  +------------------+     +------------------+     +------------------+
  |  Historical      | --> |  Model learns    | --> |  Harm at scale   |
  |  inequality      |     |  the pattern     |     |  looks objective |
  +------------------+     +------------------+     +------------------+

  COMPAS:    Past policing patterns → Predicts reoffending → Reinforces disparities
  Amazon:    Male-dominated hiring  → Penalizes women      → Perpetuates gap
  Face ID:   Unrepresentative data  → High error for some  → Exclusion from services
  Healthcare: Spending ≠ need       → Underestimates need  → Denied care
```

---

## Stakeholder Analysis

Every AI system has multiple stakeholders with different — and
sometimes conflicting — interests.

**Direct stakeholders** — people the system acts on:
- Loan applicants, job candidates, patients, defendants
- They bear the consequences of the model's decisions

**Indirect stakeholders** — people affected by the system's existence:
- Communities where the system is deployed
- People whose data trained the model
- Future users affected by feedback loops

**Decision makers** — people who choose to build and deploy:
- Data scientists and engineers who build the model
- Product managers who define requirements
- Executives who approve deployment
- Regulators who set boundaries

```
  STAKEHOLDER MAP

                    +------------------+
                    |   Regulators     |
                    |  (set boundaries)|
                    +--------+---------+
                             |
  +------------------+       |       +------------------+
  |   Developers     |-------+-------|   Executives     |
  |  (build it)      |               |  (approve it)    |
  +--------+---------+               +--------+---------+
           |                                  |
           +----------------+-----------------+
                            |
                   +--------v---------+
                   |   THE AI SYSTEM  |
                   +--------+---------+
                            |
           +----------------+-----------------+
           |                                  |
  +--------v---------+               +--------v---------+
  | Direct subjects  |               | Indirect affected|
  | (scored, ranked, |               | (communities,    |
  |  classified)     |               |  data subjects)  |
  +------------------+               +------------------+
```

---

## Ethical Frameworks Applied to AI

Philosophy gives us three major frameworks for thinking about
ethics. Each leads to different conclusions about AI systems.

### Consequentialism (Outcomes Matter)

Judge an AI system by its outcomes. Does it produce more good than
harm? A consequentialist asks: "What happens when we deploy this?"

- **Strength:** Practical, measurable, focuses on real impact
- **Weakness:** Hard to predict all consequences; who defines "good"?
- **AI example:** A medical diagnosis AI that saves 1,000 lives but
  misdiagnoses 10 patients — is the net outcome acceptable?

### Deontology (Rules Matter)

Judge an AI system by whether it follows ethical rules, regardless
of outcomes. A deontologist asks: "Does this respect people's rights?"

- **Strength:** Protects individual rights even when violating them
  would benefit the majority
- **Weakness:** Rules can conflict; rigid in edge cases
- **AI example:** Using personal data without consent is wrong even
  if the resulting model saves lives

### Virtue Ethics (Character Matters)

Judge an AI system by whether it reflects the values we want to
embody. A virtue ethicist asks: "Is this the kind of system a
responsible organization would build?"

- **Strength:** Holistic, considers organizational culture
- **Weakness:** Subjective, hard to operationalize
- **AI example:** Even if a surveillance system is legal and
  effective, does building it reflect who we want to be?

```
  THREE LENSES ON THE SAME AI SYSTEM

  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
  │ CONSEQUENTIALISM │  │   DEONTOLOGY    │  │  VIRTUE ETHICS  │
  │                  │  │                 │  │                 │
  │ "Does it produce │  │ "Does it follow │  │ "Does it reflect│
  │  more good than  │  │  ethical rules  │  │  the values we  │
  │  harm?"          │  │  and respect    │  │  want to        │
  │                  │  │  rights?"       │  │  embody?"       │
  │ Measure outcomes │  │ Check principles│  │ Examine intent  │
  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

In practice, responsible AI requires all three lenses. Measure
outcomes (consequentialism), respect rights (deontology), and
build systems that reflect good values (virtue ethics).

---

## The Responsibility Gap

When an AI system causes harm, who is responsible?

- The data scientist who trained the model?
- The product manager who defined the requirements?
- The company that deployed it?
- The regulator who approved it?
- The user who relied on it?

This "responsibility gap" is one of the central challenges in AI
ethics. Traditional accountability assumes a human decision-maker.
When decisions are automated, accountability diffuses.

```
  WHO IS RESPONSIBLE?

  Data Scientist: "I just built what was specified"
  Product Manager: "I didn't know the data was biased"
  Company: "We followed industry standards"
  Regulator: "We can't audit every model"
  User: "I trusted the system"

  Result: Nobody is responsible → Harm continues
```

The solution isn't to assign blame to one person — it's to build
accountability into the process at every stage. That's what the
rest of this track teaches you to do.

---

## Exercises

### Exercise 1: Stakeholder Analysis

Pick an AI system you interact with regularly (recommendation
algorithm, spam filter, navigation app, credit scoring). Map out:

1. Who are the direct stakeholders?
2. Who are the indirect stakeholders?
3. What could go wrong for each group?
4. Who benefits most? Who bears the most risk?

### Exercise 2: Framework Application

Consider this scenario: A hospital wants to deploy an AI system
that predicts which patients are likely to miss appointments, so
it can send reminders or overbook slots. The model is more accurate
for some demographic groups than others.

Analyze this scenario through all three ethical frameworks:
1. What would a consequentialist focus on?
2. What would a deontologist focus on?
3. What would a virtue ethicist focus on?
4. Do the frameworks agree or conflict? Where?

### Exercise 3: Case Study Deep Dive

Choose one of the historical examples from this lesson (COMPAS,
Amazon hiring, facial recognition, or healthcare algorithm). Read
the original source material and write a one-page analysis:

1. What was the intended purpose of the system?
2. What went wrong and why?
3. Who was harmed and how?
4. What could have been done differently?

---

Next: [Lesson 02: Types of Bias in ML](./02-types-of-bias.md)
