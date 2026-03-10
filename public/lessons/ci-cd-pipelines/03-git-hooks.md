# Lesson 03: Git Hooks

> **The one thing to remember**: Git hooks are like the doorman at a
> fancy building. Before your code "enters" the repository (commit)
> or "leaves" for the server (push), the doorman checks your ID. If
> your code doesn't pass inspection — bad formatting, failing tests,
> missing types — the doorman won't let it through.

---

## The Security Guard Analogy

Imagine a jewelry store with a security system:

```
SECURITY CHECKPOINTS IN A JEWELRY STORE

  Employee creates a piece   →   Quality check at workbench
  (you write code)               (pre-commit hook)
                                     |
                                     v
  Piece moves to the vault   →   Security scan before vault
  (you push to remote)              (pre-push hook)
                                     |
                                     v
  Piece displayed in store    →   Final inspection
  (code merged to main)             (CI pipeline)
```

Git hooks are those quality and security checks — scripts that run
automatically at specific points in the Git workflow. You don't have
to remember to run them. Git runs them for you.

---

## What Are Git Hooks?

Git hooks are scripts that live in `.git/hooks/` inside every Git
repository. They fire automatically when certain Git events happen.

```
AVAILABLE GIT HOOKS (most useful ones)

  Hook              When It Fires              Common Use
  ----------------------------------------------------------------
  pre-commit        Before a commit is created  Lint, format, test
  prepare-commit-msg Before editor opens        Add ticket number
  commit-msg        After message is written    Validate format
  pre-push          Before git push executes    Run full test suite
  post-merge        After a merge completes     Install dependencies
  post-checkout     After checkout/switch       Notify, clean cache
```

Here's a basic pre-commit hook — just a shell script:

```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "Running pre-commit checks..."

npm run lint
if [ $? -ne 0 ]; then
  echo "Lint failed. Fix errors before committing."
  exit 1
fi

npm run test -- --bail
if [ $? -ne 0 ]; then
  echo "Tests failed. Fix tests before committing."
  exit 1
fi

echo "All checks passed!"
exit 0
```

The key: if the script exits with a non-zero code (exit 1), Git
**aborts** the operation. The commit or push doesn't happen.

```
HOW PRE-COMMIT WORKS

  git commit -m "feat: add login"
       |
       v
  Run .git/hooks/pre-commit
       |
       ├── exit 0 (success) ──> Commit is created
       |
       └── exit 1 (failure) ──> Commit is BLOCKED
                                "Fix your code first!"
```

---

## The Problem With Raw Git Hooks

Git hooks live in `.git/hooks/`, which is **not tracked by Git**.
That means:

1. They don't get shared when someone clones the repo
2. Every developer has to set them up manually
3. Someone will forget. Someone will skip them.

```
THE SHARING PROBLEM

  Developer A:  Sets up hooks, code is always linted
  Developer B:  Forgot to set up hooks, pushes messy code
  Developer C:  Deleted hooks because they were "annoying"

  Result: Inconsistent code quality
```

This is where Husky comes in.

---

## Husky: Shareable Git Hooks

Husky is a tool that manages Git hooks through your `package.json`.
Since `package.json` IS tracked by Git, hooks are shared with everyone.

**Setting up Husky:**

```bash
cd your-project

npm install --save-dev husky

npx husky init
```

This creates a `.husky/` directory in your project root (tracked by
Git) and configures Git to look for hooks there instead of `.git/hooks/`.

```
PROJECT STRUCTURE WITH HUSKY

  your-project/
  ├── .husky/
  │   ├── pre-commit       <-- Your pre-commit hook
  │   └── pre-push         <-- Your pre-push hook
  ├── package.json         <-- Husky configured here
  ├── src/
  └── ...

  .husky/ is tracked by Git = shared with the whole team
  .git/hooks/ is NOT tracked = only on your machine
```

**Creating a pre-commit hook with Husky:**

```bash
echo "npm run lint && npm run test" > .husky/pre-commit
```

Now every developer who runs `npm install` gets the hooks automatically.

---

## lint-staged: Only Check What Changed

Running the full linter on every commit is slow. If you changed one
file, why lint 500 files? lint-staged solves this by only running
checks on files that are staged for commit.

```
WITHOUT lint-staged              WITH lint-staged

  git add login.js               git add login.js

  pre-commit:                    pre-commit:
  eslint src/**/*.js             eslint login.js (ONLY)
  (checks 500 files)             (checks 1 file)
  Takes 30 seconds               Takes 1 second
```

**Setting up lint-staged:**

```bash
npm install --save-dev lint-staged
```

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.{js,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{css,scss}": [
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

Update your Husky pre-commit hook:

```bash
echo "npx lint-staged" > .husky/pre-commit
```

Now when you commit:

```
WHAT HAPPENS ON git commit

  1. You: git add src/login.js src/auth.ts
  2. Git triggers pre-commit hook
  3. Hook runs: npx lint-staged
  4. lint-staged sees staged files: login.js, auth.ts
  5. Runs eslint --fix on login.js and auth.ts ONLY
  6. Runs prettier --write on login.js and auth.ts ONLY
  7. If fixes were applied, re-stages the files
  8. If errors remain, commit is BLOCKED
  9. If all passes, commit proceeds
```

---

## Practical Hook Recipes

### Recipe 1: Lint + Format + Type Check on Commit

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --max-warnings=0",
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
npx tsc --noEmit
```

### Recipe 2: Run Tests on Push

```bash
# .husky/pre-push
npm run test -- --bail --silent
```

The `--bail` flag stops on the first failure (fail fast). Tests before
push ensures you never push broken code.

### Recipe 3: Validate Commit Messages

Conventional commit messages (`feat:`, `fix:`, `docs:`) make
changelogs and versioning automatic. Enforce them:

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

Create `commitlint.config.js`:

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
};
```

```bash
echo "npx --no -- commitlint --edit \$1" > .husky/commit-msg
```

Now invalid commit messages are blocked:

```
git commit -m "fixed stuff"
  ✖ subject may not be empty
  ✖ type may not be empty

git commit -m "fix: resolve login redirect loop"
  ✔ All good!
```

### Recipe 4: Auto-install Dependencies After Pull

```bash
# .husky/post-merge
npm install
```

This ensures that after pulling new code that added dependencies,
they get installed automatically.

---

## Hooks in Other Languages

Husky is for JavaScript/Node projects. Other ecosystems have their
own tools:

```
HOOK TOOLS BY LANGUAGE

  Language      Tool              Config File
  ---------------------------------------------------
  JavaScript    Husky             package.json / .husky/
  Python        pre-commit        .pre-commit-config.yaml
  Rust          cargo-husky       Cargo.toml
  Go            lefthook          lefthook.yml
  Any language  lefthook          lefthook.yml
  Any language  pre-commit (py)   .pre-commit-config.yaml
```

**Python example with pre-commit framework:**

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/psf/black
    rev: 24.4.2
    hooks:
      - id: black

  - repo: https://github.com/pycqa/flake8
    rev: 7.0.0
    hooks:
      - id: flake8

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.10.0
    hooks:
      - id: mypy
```

```bash
pip install pre-commit
pre-commit install
```

**Rust example with cargo-husky:**

```toml
# Cargo.toml
[dev-dependencies]
cargo-husky = { version = "1", features = ["precommit-hook", "run-cargo-fmt", "run-cargo-clippy"] }
```

---

## Bypassing Hooks (And When It's OK)

Sometimes you need to skip hooks:

```bash
git commit --no-verify -m "wip: experimental thing"
git push --no-verify
```

The `--no-verify` flag skips hooks. Use it sparingly:

```
WHEN TO SKIP HOOKS

  OK to skip:
  - WIP commits on your personal branch
  - Emergency hotfix (but fix it properly later)
  - Documentation-only changes (if hooks run full tests)

  NEVER skip:
  - When pushing to main
  - When creating a PR
  - "Because the hook is annoying" (fix the hook instead)
```

Your CI pipeline is the safety net. Even if someone bypasses local
hooks, CI will catch the issues before code reaches main.

```
DEFENSE IN DEPTH

  Layer 1: Git hooks (local, fast feedback)
      |
      v
  Layer 2: CI pipeline (server, comprehensive)
      |
      v
  Layer 3: Branch protection (won't merge unless CI passes)

  Skipping Layer 1 is forgivable.
  Layers 2 and 3 are non-negotiable.
```

---

## Complete Setup Walkthrough

Here's a full setup from scratch for a TypeScript project:

```bash
# Start a new project
mkdir my-app && cd my-app
git init
npm init -y

# Install dev dependencies
npm install --save-dev \
  typescript \
  eslint \
  prettier \
  husky \
  lint-staged \
  @commitlint/cli \
  @commitlint/config-conventional

# Initialize Husky
npx husky init

# Set up pre-commit: lint staged files
echo "npx lint-staged" > .husky/pre-commit

# Set up pre-push: run tests
echo "npm run test" > .husky/pre-push

# Set up commit-msg: validate message format
echo 'npx --no -- commitlint --edit $1' > .husky/commit-msg

# Configure lint-staged in package.json
# (add the lint-staged config from above)

# Test it!
git add .
git commit -m "bad message"      # BLOCKED by commitlint
git commit -m "feat: initial setup"  # PASSES
```

---

## Exercises

1. **Set up Husky**: Create a new Node project, install Husky, and
   create a pre-commit hook that runs `echo "Hook is working!"`.
   Verify it fires on commit.

2. **Add lint-staged**: Install ESLint and lint-staged. Configure
   lint-staged to run ESLint on `.js` files. Create a file with a
   lint error and verify the commit is blocked.

3. **Commit message validation**: Set up commitlint. Try committing
   with messages like "fixed stuff" and "fix: resolve bug". See which
   passes.

4. **Multi-language hooks**: If you work in Python, set up the
   pre-commit framework with black and flake8. If Rust, try
   cargo-husky.

---

[Next: Lesson 04 — GitHub Actions Intro](./04-github-actions-intro.md)
