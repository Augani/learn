# MLOps & Production ML - Track Roadmap

```
  +---------------------------------------------------------+
  |            MLOps & Production ML                        |
  |                                                         |
  |   From Jupyter Notebook  --->  Production System        |
  |   "It works on my machine" --> "It works for millions"  |
  +---------------------------------------------------------+
```

Welcome to the MLOps track. Think of this like learning to run a
restaurant -- knowing how to cook (build models) is only half the
battle. You also need supply chains, quality control, health
inspections, and a system that keeps running when you're not there.

---

## Phase 1: Serving Models (Lessons 1-5)

Getting your model out of a notebook and into the real world.

```
  Notebook --> [Serialize] --> [API] --> [Server] --> Users
```

- [ ] 01 - Model Serialization (saving your game progress)
- [ ] 02 - Serving with FastAPI (your model's front door)
- [ ] 03 - Model Servers (industrial-grade serving)
- [ ] 04 - Batch vs Real-Time (restaurant orders vs buffet)
- [ ] 05 - GPU Management (driving a race car)

---

## Phase 2: Experiment & Data Management (Lessons 6-9)

Keeping track of what you tried, what worked, and what data you used.

```
  Data --> [Version] --> [Pipeline] --> [Features] --> [Experiment]
               |              |             |              |
               v              v             v              v
           Reproducible   Automated    Ready-to-use    Tracked
```

- [ ] 06 - Experiment Tracking (lab notebook for scientists)
- [ ] 07 - Data Versioning (git for your data)
- [ ] 08 - ML Pipelines (factory assembly lines)
- [ ] 09 - Feature Stores (pre-prepped ingredients)

---

## Phase 3: Testing & Monitoring (Lessons 10-14)

Making sure your model stays healthy in production.

```
  Deploy --> [CI/CD] --> [Monitor] --> [Alert] --> [Respond]
               |             |            |            |
               v             v            v            v
           Validated    Watched       Notified     Fixed
```

- [ ] 10 - CI/CD for ML (quality gates for models)
- [ ] 11 - Model Monitoring (check engine light)
- [ ] 12 - A/B Testing ML (measuring real impact)
- [ ] 13 - Data Quality Monitoring (food safety inspections)
- [ ] 14 - Incident Response ML (fire drills)

---

## Phase 4: Infrastructure & Scale (Lessons 15-18)

Running ML at scale without burning money or losing sleep.

```
  Cloud --> [Cluster] --> [LLMs] --> [Full System]
    |           |            |            |
    v           v            v            v
  Managed   Cost-Opt    Specialized   End-to-End
```

- [ ] 15 - Cloud ML Services (renting vs building)
- [ ] 16 - GPU Clusters & Cost (smart spending)
- [ ] 17 - LLM Deployment (the new frontier)
- [ ] 18 - End-to-End MLOps (putting it all together)

---

## Reference Materials

- [Tools Comparison Matrix](reference-tools.md)
- [Production Deployment Checklist](reference-checklist.md)

---

## Prerequisites

Before starting this track, you should be comfortable with:

```
  +------------------+     +------------------+
  | Python basics    |     | ML fundamentals  |
  | (functions,      |     | (training,       |
  |  classes, async)  |     |  evaluation,     |
  |                  |     |  common models)  |
  +------------------+     +------------------+
          |                        |
          +--------+   +-----------+
                   |   |
                   v   v
          +------------------+
          | Docker basics    |
          | (images,         |
          |  containers,     |
          |  compose)        |
          +------------------+
                   |
                   v
          +------------------+
          | This Track       |
          +------------------+
```

---

## How to Use This Track

1. **Read on the go** -- lessons are mobile-friendly
2. **Try the exercises** -- each lesson ends with hands-on tasks
3. **Check the boxes** -- track your progress above
4. **Use the references** -- checklists and tool matrices

```
  Estimated time: 4-6 weeks at ~1 lesson per day
  Difficulty:     Intermediate to Advanced
  Output:         Production-ready ML deployment skills
```

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Designing Machine Learning Systems** by Chip Huyen (O'Reilly, 2022) — End-to-end ML system design for production
- **Introducing MLOps** by Mark Treveil and the Dataiku Team (O'Reilly, 2020) — MLOps principles and practices

---

[Start with Lesson 01: Model Serialization -->](01-model-serialization.md)
