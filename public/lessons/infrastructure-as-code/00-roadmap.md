# Infrastructure as Code — Learning Roadmap

> **What you'll learn**: How to define, provision, and manage servers,
> networks, and cloud services using code instead of clicking buttons.
> By the end, you'll be able to build production infrastructure that's
> repeatable, version-controlled, and self-documenting.

---

## Who This Is For

You should be comfortable with:
- Using the command line (cd, ls, editing files)
- Basic programming concepts (variables, functions, loops)
- A general idea of what "the cloud" means (renting someone else's computers)

No prior Terraform or cloud experience required. We start from zero.

---

## The Lessons

### Foundation (Start Here)

- [ ] [01 — Why Infrastructure as Code](./01-why-iac.md)
  The problem IaC solves. ClickOps vs code. Snowflake servers.

- [ ] [02 — Declarative vs Imperative](./02-declarative-vs-imperative.md)
  Two approaches to automation. Terraform vs Ansible vs scripts.

### Terraform Core

- [ ] [03 — Your First Terraform Resource](./03-terraform-first-resource.md)
  Installing Terraform. The init/plan/apply workflow.

- [ ] [04 — Providers and Resources](./04-providers-resources.md)
  AWS, GCP, Azure providers. Resource types and data flow.

- [ ] [05 — Variables and Outputs](./05-variables-outputs.md)
  Input variables, types, validation, outputs, locals.

- [ ] [06 — State Management](./06-state-management.md)
  What state is, why it matters, state commands, importing resources.

- [ ] [07 — Modules](./07-modules.md)
  Reusable infrastructure packages. DRY principles for infra.

- [ ] [08 — Data Sources and Dependencies](./08-data-sources.md)
  Querying existing infra. Implicit vs explicit dependencies.

### Multi-Environment

- [ ] [09 — Workspaces and Environments](./09-workspaces-environments.md)
  Dev/staging/prod separation strategies.

- [ ] [10 — Remote State](./10-remote-state.md)
  Shared state backends. Locking. Team collaboration.

### Advanced

- [ ] [11 — Advanced HCL Patterns](./11-advanced-patterns.md)
  for_each, count, dynamic blocks, conditionals, functions.

- [ ] [12 — Testing Infrastructure Code](./12-testing-iac.md)
  Validation, plan checks, Terratest, linting.

- [ ] [13 — Policy as Code](./13-policy-as-code.md)
  OPA/Rego, Sentinel. Guardrails and compliance automation.

- [ ] [14 — Drift and Remediation](./14-drift-remediation.md)
  Detecting and fixing configuration drift. GitOps for infra.

### Capstone

- [ ] [15 — Build a Multi-Environment Infrastructure](./15-build-infrastructure.md)
  Full project: VPC, EC2, RDS, S3 with modules and CI/CD.

### Quick References

- [ ] [Terraform CLI & HCL Reference](./reference-terraform.md)
- [ ] [Provider Resource Reference (AWS/GCP/Azure)](./reference-providers.md)

---

## How to Use This Course

**Read in order.** Each lesson builds on the previous one. The early
lessons establish mental models you'll use throughout.

**Type the code yourself.** Don't copy-paste. Typing builds muscle
memory and forces you to notice details.

**Break things on purpose.** After each lesson, try modifying the
examples to see what happens. Change a resource name. Remove a required
argument. Introduce a typo. The error messages teach you as much as the
working code.

**Use the capstone.** Lesson 15 ties everything together. If you can
build that project from scratch, you understand IaC.

---

## Recommended Reading

These books go deeper than this course can. If you can access them
through a library or O'Reilly's online platform, they are worth it:

- **Terraform: Up & Running** by Yevgeniy Brikman (O'Reilly, 3rd Edition 2022)
  The best practical guide to Terraform. Covers everything from basics
  to advanced patterns with real-world examples. Pairs perfectly with
  this course — read it alongside lessons 3-15.

- **Infrastructure as Code** by Kief Morris (O'Reilly, 2nd Edition 2020)
  More conceptual and tool-agnostic. Covers the *principles* behind IaC,
  not just Terraform specifics. Read it after finishing this course to
  deepen your understanding of *why* things work the way they do.

Both are available through many public library systems and university
libraries.

---

## Time Estimate

| Section | Lessons | Time |
|---------|---------|------|
| Foundation | 01-02 | 2-3 hours |
| Terraform Core | 03-08 | 8-12 hours |
| Multi-Environment | 09-10 | 3-4 hours |
| Advanced | 11-14 | 6-8 hours |
| Capstone | 15 | 4-6 hours |
| **Total** | | **23-33 hours** |

---

[Start: Lesson 01 — Why Infrastructure as Code](./01-why-iac.md)
