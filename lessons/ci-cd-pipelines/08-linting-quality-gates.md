# Lesson 08: Linting & Quality Gates

> **The one thing to remember**: Quality gates are like the bouncer at
> a club. No matter how much your code wants to get into the main
> branch, if it doesn't meet the dress code (formatting), pass the ID
> check (type safety), and behave properly (lint rules), it's not
> getting in. No exceptions.

---

## The Nightclub Bouncer Analogy

```
GETTING INTO CLUB MAIN-BRANCH

  Your code arrives at the door
       |
       v
  Bouncer 1: FORMATTER (Prettier)
  "Is your formatting consistent?"
       |
       ├── Messy indentation → REJECTED
       └── Clean formatting  → proceed
                |
                v
  Bouncer 2: LINTER (ESLint)
  "Do you follow the rules?"
       |
       ├── Unused variables → REJECTED
       ├── Console.log → REJECTED
       └── Clean code → proceed
                |
                v
  Bouncer 3: TYPE CHECKER (TypeScript)
  "Are your types correct?"
       |
       ├── Type errors → REJECTED
       └── Types check out → proceed
                |
                v
  Bouncer 4: TESTS
  "Does everything work?"
       |
       ├── Test failures → REJECTED
       └── All pass → WELCOME TO MAIN
```

Each bouncer is a **quality gate**: an automated check that must pass
before code can merge. If any gate fails, the merge is blocked.

---

## What Each Tool Does

```
QUALITY TOOLS COMPARISON

  Tool         What It Checks             Example Issue
  ---------------------------------------------------------------
  Formatter    Code style consistency     Tabs vs spaces, semicolons
  (Prettier)   HOW the code looks         Line length, trailing commas

  Linter       Code quality patterns      Unused variables,
  (ESLint)     POTENTIAL bugs             missing error handling,
                                          deprecated APIs

  Type Checker Type correctness           Passing string where
  (TypeScript) GUARANTEED bug classes     number expected,
                                          missing properties

  Tests        Behavior correctness       Function returns wrong
  (Vitest)     ACTUAL functionality       result, edge case fails
```

Think of it as increasingly strict levels:

```
STRICTNESS LEVELS

  Formatter:    "Your code looks messy"      (style)
  Linter:       "Your code smells bad"       (patterns)
  Type checker: "Your code has contradictions" (logic)
  Tests:        "Your code is wrong"           (behavior)

  Each level catches things the previous can't.
```

---

## Formatters: Ending Style Debates

A formatter rewrites your code to follow consistent style rules. There
is no "wrong" style — the point is that everyone uses the SAME style.

**Prettier (JavaScript/TypeScript/CSS/HTML/JSON/Markdown):**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80
}
```

```
BEFORE PRETTIER                       AFTER PRETTIER

  const x= {                           const x = {
    name : "Alice",                       name: 'Alice',
      age:30,                             age: 30,
    hobbies: ["reading",                  hobbies: [
    "coding"  , "hiking"],                  'reading',
  }                                         'coding',
                                            'hiking',
                                          ],
                                        };
```

**Other formatters by language:**

```
FORMATTERS BY LANGUAGE

  Language       Formatter        Config File
  -----------------------------------------------
  JavaScript     Prettier         .prettierrc
  Python         Black            pyproject.toml
  Rust           rustfmt          rustfmt.toml
  Go             gofmt            (no config, one style)
  Java           google-java-fmt  (no config)
  C/C++          clang-format     .clang-format
```

Go's approach is the ideal: `gofmt` has zero configuration. There's
one way to format Go code. No debates, no config files, no PRs about
style preferences.

---

## Linters: Catching Bad Patterns

Linters analyze code for potential problems without running it:

**ESLint (JavaScript/TypeScript):**

```javascript
// eslint.config.js (flat config)
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    rules: {
      'no-console': 'error',
      'no-unused-vars': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  }
);
```

```
WHAT ESLINT CATCHES

  Rule                          What It Prevents
  ---------------------------------------------------------------
  no-console                    Leftover debug logging in production
  no-unused-vars                Dead code that confuses readers
  prefer-const                  Accidental mutation of variables
  no-explicit-any               Type safety holes in TypeScript
  no-floating-promises          Unhandled async errors (silent failures)
  no-implicit-coercion          "2" + 2 = "22" type bugs
  eqeqeq                       == instead of === (type coercion bugs)
```

**Linters by language:**

```
LINTERS BY LANGUAGE

  Language       Linter           What It Catches
  ---------------------------------------------------
  JavaScript     ESLint           Bad patterns, style
  TypeScript     ESLint + TS      Type-aware linting
  Python         Ruff             Fast, replaces flake8/pylint
  Rust           Clippy           Idiomatic Rust violations
  Go             golangci-lint    Aggregates 50+ Go linters
  Shell          ShellCheck       Bash scripting mistakes
```

---

## Type Checkers: Mathematical Correctness

Type checkers prove certain classes of bugs are impossible:

```typescript
// TypeScript catches this AT BUILD TIME, not at runtime
function greet(name: string): string {
  return `Hello, ${name}`;
}

greet(42);
// Error: Argument of type 'number' is not assignable to parameter of type 'string'

// Without TypeScript, this crashes at RUNTIME for some users
```

```
WHAT TYPE CHECKERS PREVENT

  Bug                                 Without Types    With Types
  ------------------------------------------------------------------
  Calling function with wrong args    Runtime crash     Compile error
  Accessing property that doesn't     "undefined"       Compile error
  exist                               at runtime
  Returning wrong type from function  Silent bug        Compile error
  Missing switch/case branch          Wrong behavior    Compile error
  Null/undefined access               "Cannot read      Compile error
                                       property of
                                       undefined"
```

---

## Setting Up Quality Gates in CI

### The Workflow

```yaml
name: Quality Gates

on:
  pull_request:
    branches: [main]

jobs:
  format-check:
    name: Formatting
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx prettier --check .

  lint:
    name: Linting
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx eslint . --max-warnings=0

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    name: Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
```

Notice `--max-warnings=0`. This means even warnings block the merge.
Without this, warnings accumulate forever because nobody fixes them.

### Branch Protection: Making Gates Mandatory

On GitHub:
1. Go to Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Enable "Require status checks to pass before merging"
4. Select: format-check, lint, typecheck, test

```
BRANCH PROTECTION + QUALITY GATES

  Developer opens PR
       |
       v
  GitHub runs all quality gate jobs
       |
       ├── format-check: ✓ pass
       ├── lint:          ✗ FAIL (2 errors)
       ├── typecheck:     ✓ pass
       └── test:          ✓ pass
              |
              v
  MERGE BLOCKED (lint failed)
  "Some checks were not successful"

  Developer fixes lint errors, pushes again
       |
       v
  All gates: ✓ pass
       |
       v
  MERGE ALLOWED
```

---

## Code Review Automation

Beyond format/lint/type/test, you can automate parts of code review:

### Auto-assign Reviewers

```yaml
# .github/workflows/auto-assign.yml
name: Auto Assign

on:
  pull_request:
    types: [opened]

jobs:
  assign:
    runs-on: ubuntu-latest
    steps:
      - uses: kentaro-m/auto-assign-action@v2
        with:
          configuration-path: .github/auto-assign.yml
```

### PR Size Labels

```yaml
# .github/workflows/pr-size.yml
name: PR Size

on:
  pull_request:

jobs:
  size-label:
    runs-on: ubuntu-latest
    steps:
      - uses: codelytv/pr-size-labeler@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          xs_max_size: 10
          s_max_size: 50
          m_max_size: 200
          l_max_size: 500
```

```
PR SIZE LABELS

  Lines Changed    Label      Meaning
  ------------------------------------------
  1-10             XS         Quick fix, typo
  11-50            S          Small change
  51-200           M          Normal feature
  201-500          L          Large change (review carefully)
  500+             XL         Too big! Split this PR.
```

Large PRs are hard to review well. Labeling them makes the problem
visible.

---

## The Complete Quality Stack

Here's how all these tools work together:

```
LOCAL DEVELOPMENT → CI → MERGE

  Developer writes code
       |
  [LOCAL] Editor: real-time lint errors, format-on-save
       |
  [LOCAL] Pre-commit hook: lint-staged (format + lint changed files)
       |
  [LOCAL] Pre-push hook: type check + fast tests
       |
  git push
       |
  [CI] Format check (prettier --check)
  [CI] Lint (eslint --max-warnings=0)
  [CI] Type check (tsc --noEmit)
  [CI] Unit tests
  [CI] Integration tests
  [CI] Coverage threshold
       |
  [GITHUB] Branch protection: all checks must pass
  [GITHUB] Required reviewers: 1+ human approval
       |
  MERGE TO MAIN
```

Each layer catches different things:
- **Editor**: Instant feedback while typing
- **Pre-commit hooks**: Catch before commit (fast, staged files only)
- **Pre-push hooks**: Catch before sharing (more thorough)
- **CI**: Authoritative check (clean environment, can't be skipped)
- **Branch protection**: Enforcement (can't merge without passing)

---

## Common Pitfalls

```
PITFALL                              FIX
---------------------------------------------------------------
Warnings don't block merge           Use --max-warnings=0
Formatter and linter conflict        Use eslint-config-prettier
New rules added but old code          Add rules one at a time,
not fixed ("grandfathered in")        fix existing violations first
Type errors suppressed with           Ban @ts-ignore in lint rules
@ts-ignore
CI is slow because every gate        Run gates in parallel jobs
runs sequentially
```

---

## Exercises

1. **Set up Prettier**: Add Prettier to a project. Run
   `npx prettier --check .` to see what's not formatted. Then run
   `npx prettier --write .` to fix everything. Commit the changes.

2. **Set up ESLint**: Add ESLint with the recommended config. Fix all
   errors. Then add `--max-warnings=0` and fix all warnings too.

3. **Create quality gates**: Create a GitHub Actions workflow with
   format, lint, typecheck, and test jobs. Enable branch protection
   requiring all to pass.

4. **Break each gate**: Open a PR that fails each gate individually.
   See what the error messages look like. Learn to read them quickly.

5. **Add PR size labels**: Set up the PR size labeler. Open PRs of
   different sizes and verify the labels are applied.

---

[Next: Lesson 09 — Artifacts & Caching](./09-artifacts-caching.md)
