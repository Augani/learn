# Lesson 02: Version Control Workflows

> **The one thing to remember**: A branching strategy is like a traffic
> system for your code. Trunk-based development is a highway with no
> stoplights — fast but requires discipline. Gitflow is a complex
> interchange — safe but slow. GitHub Flow is the middle ground most
> teams should start with.

---

## The Highway Analogy

Think of your codebase as a road system:

- **main branch** = the highway (production-ready code)
- **feature branches** = on-ramps (new work being prepared)
- **merge** = merging onto the highway
- **merge conflict** = two cars trying to merge into the same lane

The question every team faces: how do we organize traffic so nobody
crashes?

```
THE FUNDAMENTAL PROBLEM

  Developer A is building a login page
  Developer B is building a payment page
  Both need to change the same user model

  How do they work without stepping on each other?

  Answer: Branches. But WHICH branching strategy?
```

---

## Strategy 1: Trunk-Based Development

Everyone commits directly to the main branch (the "trunk"). No
long-lived branches. Feature branches, if used at all, live less
than a day.

```
TRUNK-BASED DEVELOPMENT

  main: ──●──●──●──●──●──●──●──●──●──●──●──●───>
           |     |        |  |        |
           |     |        |  |        |
           ●─────●        ●──●        ●
           (2 hrs)        (4 hrs)     (1 hr)
           short-lived feature branches

  Rules:
  - Branches live < 1 day
  - Everyone integrates to main at least daily
  - main is ALWAYS deployable
  - Use feature flags to hide incomplete work
```

**How it works in practice:**

```bash
git checkout main
git pull
git checkout -b add-email-validation

# ... write code for 2-4 hours max ...

git add .
git commit -m "feat: add email validation"
git push origin add-email-validation

# Open PR, get quick review, merge same day
# Delete branch immediately after merge
```

**When to use trunk-based development:**
- Experienced teams with good test coverage
- Teams practicing continuous deployment
- When you want maximum deployment speed
- Google, Facebook, and Netflix use this

**When to avoid it:**
- Teams without automated testing
- When you need strict release control
- Junior teams still learning git

---

## Strategy 2: GitHub Flow

One main branch. Feature branches for all work. PRs for code review.
Merge to main. Deploy from main.

```
GITHUB FLOW

  main: ──●──────────●──────────────●──────●───>
           \        /                \    /
            \      /                  \  /
             ●──●──●                   ●──●
             feature/login             fix/typo
             (2-3 days)                (1 day)

  Rules:
  - main is always deployable
  - Create a branch for every change
  - Open a PR for code review
  - Merge to main when approved + CI passes
  - Deploy immediately after merge
```

**How it works in practice:**

```bash
git checkout main
git pull origin main
git checkout -b feature/user-profile

# ... work for 1-3 days ...

git add .
git commit -m "feat: add user profile page"
git push origin feature/user-profile

# Open PR on GitHub
# CI runs automatically
# Team reviews code
# Merge when green + approved
# Deploy automatically
```

**When to use GitHub Flow:**
- Most web applications
- Teams of 2-20 developers
- When you deploy frequently (daily or weekly)
- The default recommendation for most teams

**When to avoid it:**
- When you need to maintain multiple release versions
- When you need formal release branches

---

## Strategy 3: Gitflow

A structured model with dedicated branches for features, releases,
hotfixes, and development.

```
GITFLOW

  main:    ──●───────────────────●──────────────●───>
              \                 / \             /
  release:     \          ●──●──●  \     ●──●──●
                \        /          \   /
  develop: ──●───●──●──●────●──●──●──●──●──●──●──●───>
               \   /   \       /       \     /
  feature:      ●─●     ●──●─●         ●──●──●
                f1        f2              f3

  Branches:
  - main:     Production code. Tagged releases only.
  - develop:  Integration branch. Features merge here.
  - feature:  One per feature. Branch from develop.
  - release:  Prep for release. Branch from develop.
  - hotfix:   Emergency fixes. Branch from main.
```

**How it works in practice:**

```bash
# Start a new feature
git checkout develop
git pull origin develop
git checkout -b feature/shopping-cart

# ... work for days/weeks ...

git push origin feature/shopping-cart
# PR into develop (not main!)

# When ready to release:
git checkout develop
git checkout -b release/1.2.0

# Fix any release bugs on the release branch
git commit -m "fix: correct tax calculation"

# Merge release into main AND develop
git checkout main
git merge release/1.2.0
git tag v1.2.0

git checkout develop
git merge release/1.2.0
```

**When to use Gitflow:**
- Software with formal release cycles (mobile apps, desktop software)
- When you need to maintain multiple versions (v1.x and v2.x)
- Regulated industries requiring release documentation
- Open-source projects with scheduled releases

**When to avoid it:**
- Web applications that deploy continuously
- Small teams (the overhead isn't worth it)
- When fast feedback is more important than release ceremony

---

## Comparing the Three Strategies

```
COMPARISON TABLE

  Criteria              Trunk-Based    GitHub Flow    Gitflow
  ----------------------------------------------------------------
  Complexity            Low            Low-Medium     High
  Deploy frequency      Multiple/day   Daily/weekly   Weekly/monthly
  Branch lifetime       Hours          Days           Days-weeks
  Team size sweet spot  Any (w/skill)  2-20           5-50
  Merge conflicts       Rare (small)   Occasional     Common (long)
  CI/CD fit             Perfect        Great          Okay
  Release control       Feature flags  Deploy = rel.  Formal
  Learning curve        Low            Low            Medium-High
```

```
DECISION FLOWCHART

  Do you deploy to production continuously?
     |                          |
    YES                        NO
     |                          |
     v                          v
  Do you have strong          Do you maintain multiple
  automated tests?            release versions?
     |          |                |            |
    YES        NO               YES          NO
     |          |                |            |
     v          v                v            v
  Trunk-     GitHub            Gitflow     GitHub
  Based      Flow                          Flow
```

---

## Branch Naming Conventions

Whatever strategy you choose, consistent naming helps:

```
BRANCH NAMING PATTERNS

  feature/user-authentication    New functionality
  fix/login-redirect-loop        Bug fix
  hotfix/security-patch-cve123   Urgent production fix
  chore/update-dependencies      Maintenance
  docs/api-reference             Documentation
  refactor/extract-auth-service  Code restructuring
  test/add-payment-tests         Adding tests

  Pattern: type/short-description
  Use hyphens, not underscores
  Keep it under 50 characters
```

---

## Merge Strategies

When you merge a branch, Git offers several strategies:

```
MERGE COMMIT (git merge --no-ff)

  Before:                        After:
  main:   ──A──B──               main:   ──A──B──────M──
               \                              \      /
  feature:      C──D──           feature:      C──D──

  Creates a merge commit M.
  Preserves full branch history.
  Easy to revert entire feature (revert M).


SQUASH MERGE (git merge --squash)

  Before:                        After:
  main:   ──A──B──               main:   ──A──B──S──
               \
  feature:      C──D──E──        (C+D+E squashed into S)

  Combines all branch commits into one.
  Clean main history.
  Loses individual commit history.


REBASE (git rebase main, then fast-forward merge)

  Before:                        After:
  main:   ──A──B──               main:   ──A──B──C'──D'──
               \
  feature:      C──D──

  Replays commits on top of main.
  Linear history (no merge commits).
  Rewrites commit hashes (C becomes C').
```

**Which merge strategy to use:**

```
MERGE STRATEGY GUIDE

  Squash merge:  Default for feature branches into main.
                 One clean commit per feature.
                 Best for most teams using GitHub Flow.

  Merge commit:  When you want to preserve branch history.
                 Good for Gitflow release branches.
                 Makes git log --graph readable.

  Rebase:        When you want linear history.
                 Good for personal branches before PR.
                 NEVER rebase shared branches.
```

---

## Protecting Your Main Branch

Regardless of strategy, protect the main branch:

```
BRANCH PROTECTION RULES (GitHub)

  +------------------------------------------+
  |  Branch Protection for: main              |
  |                                          |
  |  [x] Require pull request reviews (1+)   |
  |  [x] Require status checks to pass       |
  |      [x] ci/tests                        |
  |      [x] ci/lint                         |
  |  [x] Require branches up to date         |
  |  [x] Restrict who can push               |
  |  [ ] Allow force pushes (NEVER!)         |
  |  [ ] Allow deletions (NEVER!)            |
  +------------------------------------------+
```

These rules mean:
- No one can push directly to main
- Every change goes through a PR
- CI must pass before merging
- At least one person must review the code

---

## Common Mistakes

```
MISTAKE                              FIX
----------------------------------------------------------------
Long-lived branches (weeks)          Merge daily, use feature flags
Not pulling main before branching    Always: git checkout main && git pull
Force-pushing shared branches        Only force-push YOUR branches
Not deleting merged branches         Auto-delete in GitHub settings
Merging without CI passing           Enforce required status checks
Rebasing shared branches             Only rebase local/personal branches
```

---

## Exercises

1. **Draw your workflow**: Sketch the branching strategy your current
   project uses. Does it match one of the three strategies? Is it a
   mix?

2. **Try GitHub Flow**: Create a repository. Make a branch, add a
   commit, open a PR, merge it. Do this 5 times until the flow is
   muscle memory.

3. **Conflict practice**: Create two branches that edit the same line
   of the same file. Merge one, then try to merge the other. Resolve
   the conflict manually.

4. **Branch protection**: Set up branch protection rules on a test
   repository. Try pushing directly to main — verify it's blocked.

---

[Next: Lesson 03 — Git Hooks](./03-git-hooks.md)
