# CI/CD Pipelines — Learning Roadmap

> **What you'll learn**: How to automate the journey from code on your
> laptop to software running in production. By the end, you'll build
> a complete pipeline that tests, builds, and deploys your code every
> time you push — with zero manual steps and zero downtime.

---

## Why This Topic Matters

Imagine you're a baker. You've perfected a cake recipe. But every time
a customer orders one, you have to:

1. Handwrite the recipe from memory
2. Manually check you have all ingredients
3. Bake it, taste-test it yourself
4. Carry it across town on foot
5. Hope you don't trip

That's how most teams deploy software without CI/CD. It's slow, scary,
and error-prone. CI/CD is the industrial bakery: automated, consistent,
and reliable.

```
WITHOUT CI/CD                          WITH CI/CD

Developer writes code                  Developer writes code
       |                                      |
       v                                      v
"Works on my machine" ----+            Push to Git
       |                  |                   |
       v                  |                   v
Manual testing            |            Automated tests run
       |                  |                   |
       v                  |                   v
SSH into server           |            Auto-build & package
       |                  |                   |
       v                  |                   v
Copy files manually       |            Auto-deploy (blue-green)
       |                  |                   |
       v                  v                   v
Pray it works          2-4 hours       Done in 5 minutes
Cross fingers          of stress       with confidence
```

---

## Lessons

### Foundations
- [ ] [01 — Why CI/CD](./01-why-cicd.md) — The cost of manual deployments, deploy fear, and feedback loops
- [ ] [02 — Version Control Workflows](./02-version-control-workflows.md) — Trunk-based dev, gitflow, GitHub flow with branch diagrams
- [ ] [03 — Git Hooks](./03-git-hooks.md) — Pre-commit, pre-push hooks, Husky, lint-staged

### GitHub Actions
- [ ] [04 — GitHub Actions Intro](./04-github-actions-intro.md) — Workflows, events, runners, your first workflow
- [ ] [05 — Workflows, Jobs, and Steps](./05-workflows-jobs-steps.md) — Job dependencies, matrix builds, reusable workflows

### Building & Testing
- [ ] [06 — Build Automation](./06-build-automation.md) — Build tools, reproducible builds, caching
- [ ] [07 — Automated Testing in CI](./07-automated-testing-ci.md) — Tests in CI, parallelization, flaky test detection
- [ ] [08 — Linting & Quality Gates](./08-linting-quality-gates.md) — Linters, formatters, quality gates that block merges
- [ ] [09 — Artifacts & Caching](./09-artifacts-caching.md) — Build artifacts, dependency caching, speeding up pipelines
- [ ] [10 — Environment Variables & Secrets](./10-env-vars-secrets.md) — Secret management, Vault, never hardcode secrets

### Deployment Strategies
- [ ] [11 — Blue-Green Deployment](./11-deployment-blue-green.md) — Zero-downtime deployments, rollback strategies
- [ ] [12 — Canary & Rolling Deployments](./12-canary-rolling.md) — Progressive delivery, traffic shifting
- [ ] [13 — Feature Flags](./13-feature-flags.md) — Feature toggles, trunk-based dev + flags, kill switches

### Production Operations
- [ ] [14 — Monitoring Deployments](./14-monitoring-deployments.md) — Health checks, auto-rollback, deployment metrics
- [ ] [15 — Multi-Environment Pipelines](./15-multi-env-pipelines.md) — Dev/staging/prod, promotion workflows

### Capstone
- [ ] [16 — Build a Pipeline Project](./16-build-pipeline-project.md) — Build a complete CI/CD pipeline from scratch

### Quick References
- [ ] [Reference — GitHub Actions](./reference-github-actions.md) — Syntax, common actions, workflow patterns
- [ ] [Reference — Deployment Patterns](./reference-deployment-patterns.md) — Comparing deployment strategies

---

## How to Use This Roadmap

1. **Go in order** — Each lesson builds on the one before it
2. **Type the code** — Don't copy-paste. Typing builds muscle memory
3. **Break things** — The best way to learn CI/CD is to watch a pipeline fail, then fix it
4. **Check boxes** — Edit this file and mark lessons complete as you go

---

## Recommended Reading

These books go deeper than any tutorial can. If you can access a library
or find used copies, they are worth your time:

- **Continuous Delivery** by Jez Humble and David Farley (Addison-Wesley, 2010) — The foundational text on CI/CD. Covers everything from version control to deployment pipelines to release strategies. Dense but essential.

- **The Phoenix Project** by Gene Kim, Kevin Behr, and George Spafford (IT Revolution Press, 2013) — A novel (yes, a story) about an IT organization in crisis. Makes DevOps concepts click through narrative. Great first read.

- **Accelerate** by Nicole Forsgren, Jez Humble, and Gene Kim (IT Revolution Press, 2018) — The science behind high-performing engineering teams. Backed by data from thousands of organizations. Shows why CI/CD practices actually matter.

---

[Start Learning: Lesson 01 — Why CI/CD](./01-why-cicd.md)
