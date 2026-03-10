# Image Security

## The Food Safety Analogy

Image security is like food safety. When you eat at a restaurant, you trust that:

- Every ingredient came from a reputable supplier (base images from official sources)
- Nothing was tampered with between the farm and your plate (image signing)
- The ingredients haven't expired or been recalled (vulnerability scanning)
- You can trace every ingredient back to its source (SBOM)
- The kitchen staff didn't leave knives in the soup (no embedded secrets)

A single contaminated ingredient can poison the entire dish. A single compromised base image can compromise every container built on top of it.

---

## Vulnerability Scanning

Containers ship with operating system packages, libraries, and runtime dependencies. Any of these can have known vulnerabilities (CVEs). Scanning finds them before attackers do.

### Docker Scout

Docker Scout is Docker's built-in scanning tool. It analyzes your image layers and compares packages against vulnerability databases.

```bash
docker scout quickview myapp:latest
```

```
    i New version 1.14.0 available (installed version is 1.13.1)

  Target     myapp:latest
    digest   sha256:abc123...
    platform linux/amd64

  Vulnerabilities
    Critical     2
    High         8
    Medium      14
    Low         23
```

Get detailed CVE information:

```bash
docker scout cves myapp:latest
```

```
  CVE-2024-1234  Critical  openssl 3.0.2
    Fixed in 3.0.14
    CVSS: 9.8
    A buffer overflow in the X.509 certificate verification...

  CVE-2024-5678  High  libcurl 7.81.0
    Fixed in 7.88.1
    CVSS: 7.5
    An HTTP/2 stream cancellation can lead to...
```

Compare your image against a known-good baseline:

```bash
docker scout compare myapp:latest --to myapp:v1.2.3
```

Filter by severity:

```bash
docker scout cves myapp:latest --only-severity critical,high
```

### Trivy

Trivy is an open-source scanner from Aqua Security. It's fast, works offline, and scans more than just container images.

```bash
brew install trivy

trivy image myapp:latest
```

```
myapp:latest (debian 12.4)
============================
Total: 47 (UNKNOWN: 0, LOW: 23, MEDIUM: 14, HIGH: 8, CRITICAL: 2)

+-----------+------------------+----------+-------------------+---------------+
|  LIBRARY  |  VULNERABILITY   | SEVERITY | INSTALLED VERSION | FIXED VERSION |
+-----------+------------------+----------+-------------------+---------------+
| openssl   | CVE-2024-1234    | CRITICAL | 3.0.2             | 3.0.14        |
| libcurl   | CVE-2024-5678    | HIGH     | 7.81.0            | 7.88.1        |
| zlib      | CVE-2024-9012    | MEDIUM   | 1.2.13            | 1.2.14        |
+-----------+------------------+----------+-------------------+---------------+
```

Scan and fail CI if critical vulnerabilities are found:

```bash
trivy image --exit-code 1 --severity CRITICAL myapp:latest
```

Scan a Dockerfile before building:

```bash
trivy config Dockerfile
```

Scan your local filesystem (useful for Go/Node projects):

```bash
trivy fs --security-checks vuln,secret .
```

This catches vulnerabilities in your `go.sum`, `package-lock.json`, and even accidentally committed secrets.

### Snyk

Snyk integrates deeply with development workflows. It scans images, source code, and infrastructure-as-code.

```bash
npm install -g snyk
snyk auth

snyk container test myapp:latest
```

```
Testing myapp:latest...

Organization:      your-org
Package manager:   deb
Project name:      docker-image|myapp
Docker image:      myapp:latest
Platform:          linux/amd64

Tested 142 dependencies for known issues.

Issues found:
  ✗ Critical severity: Buffer Overflow in openssl
    Introduced through: openssl@3.0.2
    Fixed in: 3.0.14

  ✗ High severity: HTTP Request Smuggling in libcurl
    Introduced through: curl@7.81.0-1
    Fixed in: 7.88.1
```

Snyk also monitors continuously:

```bash
snyk container monitor myapp:latest
```

This watches for NEW vulnerabilities discovered after you've deployed.

### Which Scanner Should You Use?

| Feature | Docker Scout | Trivy | Snyk |
|---------|-------------|-------|------|
| Cost | Free tier | Free/OSS | Free tier |
| Speed | Fast | Very fast | Moderate |
| Offline | No | Yes | No |
| CI integration | Docker-native | Excellent | Excellent |
| Fix suggestions | Yes | No | Yes |
| Monitoring | Yes | Manual | Yes |

For most teams: run Trivy in CI (it's fast and free), use Snyk for monitoring production images.

---

## Image Signing

Scanning tells you WHAT is in an image. Signing tells you WHO built it and WHETHER it was tampered with.

Think of it like a wax seal on a letter. If the seal is broken, you know someone opened it.

### Docker Content Trust (DCT)

DCT uses Notary to sign images. When enabled, Docker only pulls signed images.

```bash
export DOCKER_CONTENT_TRUST=1

docker pull nginx:latest
```

If the image isn't signed, Docker refuses to pull it:

```
Error: remote trust data does not exist for docker.io/malicious/image
```

Sign your own images:

```bash
export DOCKER_CONTENT_TRUST=1

docker build -t myregistry.com/myapp:v1.0.0 .
docker push myregistry.com/myapp:v1.0.0
```

On first push, Docker generates a signing key:

```
Enter passphrase for new root key with ID abc1234:
Enter passphrase for new repository key with ID def5678:
```

Guard these keys like your SSH keys. Losing the root key means you can never sign images for that repository again.

### Cosign (Sigstore)

Cosign is the modern approach. It's part of the Sigstore project and uses keyless signing with OIDC (like "Sign in with Google" for image signatures).

```bash
brew install cosign

cosign sign myregistry.com/myapp@sha256:abc123def456...
```

With keyless signing (uses your identity provider):

```bash
COSIGN_EXPERIMENTAL=1 cosign sign myregistry.com/myapp@sha256:abc123def456...
```

This opens a browser, you authenticate, and the signature is stored in a transparency log. No keys to manage.

Verify a signed image:

```bash
cosign verify myregistry.com/myapp@sha256:abc123def456... \
  --certificate-identity=you@company.com \
  --certificate-oidc-issuer=https://accounts.google.com
```

```
Verification for myregistry.com/myapp@sha256:abc123def456... --
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - The signature was verified against the specified public key
```

Sign in CI with GitHub Actions OIDC:

```yaml
- name: Sign image
  run: |
    cosign sign myregistry.com/myapp@${{ steps.build.outputs.digest }} \
      --certificate-identity-regexp="https://github.com/myorg/*" \
      --certificate-oidc-issuer="https://token.actions.githubusercontent.com"
  env:
    COSIGN_EXPERIMENTAL: 1
```

### DCT vs Cosign

| Feature | DCT | Cosign |
|---------|-----|--------|
| Key management | Manual (painful) | Keyless option |
| Transparency log | No | Yes (Rekor) |
| CI integration | Moderate | Excellent |
| Ecosystem | Docker only | Any OCI registry |
| Adoption trend | Legacy | Growing fast |

Use cosign for new projects.

---

## Supply Chain Attacks

### What Happens When a Base Image Is Compromised

Imagine you build your app on `node:20-alpine`. Thousands of teams do the same. If an attacker compromises that base image, every container built on it is now a trojan horse.

This isn't theoretical. The SolarWinds attack (2020) compromised build systems. The `event-stream` npm attack (2018) injected malicious code into a dependency used by millions.

**Attack Vector 1: Compromised base image**

```dockerfile
FROM node:20-alpine
COPY . .
RUN npm install
CMD ["node", "server.js"]
```

If `node:20-alpine` is compromised, the attacker's code runs BEFORE yours. They could:
- Exfiltrate environment variables (database passwords, API keys)
- Install a backdoor
- Modify your application code during the build

**Attack Vector 2: Compromised build dependency**

```dockerfile
FROM golang:1.22 AS builder
RUN go install github.com/attacker/useful-tool@latest
COPY . .
RUN go build -o /app
```

That "useful tool" could modify your compiled binary.

**Attack Vector 3: Typosquatting**

```dockerfile
FROM noed:20-alpine
```

Notice the typo? `noed` instead of `node`. An attacker registers `noed` on Docker Hub with a modified image. Your CI builds happily using it.

### Defending Against Supply Chain Attacks

Pin images by digest, not tag:

```dockerfile
# BAD: tag can be overwritten
FROM node:20-alpine

# GOOD: digest is immutable
FROM node:20-alpine@sha256:a1b2c3d4e5f6...
```

Verify signatures before building:

```bash
cosign verify docker.io/library/node:20-alpine \
  --certificate-identity-regexp=".*" \
  --certificate-oidc-issuer="https://accounts.google.com"
```

Use a private registry mirror that you control:

```dockerfile
FROM registry.internal.company.com/node:20-alpine@sha256:a1b2c3d4e5f6...
```

---

## Software Bill of Materials (SBOM)

An SBOM is an ingredient list for your software. Just like food packaging lists every ingredient, an SBOM lists every package, library, and dependency in your image.

Generate an SBOM with Docker Scout:

```bash
docker scout sbom myapp:latest
```

Generate with Trivy in SPDX format:

```bash
trivy image --format spdx-json --output sbom.json myapp:latest
```

Generate with syft (another popular tool):

```bash
syft myapp:latest -o spdx-json > sbom.json
```

An SBOM in SPDX format looks like:

```json
{
  "spdxVersion": "SPDX-2.3",
  "name": "myapp:latest",
  "packages": [
    {
      "name": "openssl",
      "versionInfo": "3.0.2",
      "supplier": "Organization: Debian",
      "downloadLocation": "https://packages.debian.org/openssl"
    },
    {
      "name": "express",
      "versionInfo": "4.18.2",
      "supplier": "Organization: npm",
      "downloadLocation": "https://www.npmjs.com/package/express"
    }
  ]
}
```

### Why SBOMs Matter

When Log4Shell hit (CVE-2021-44228), organizations scrambled to find which of their systems used Log4j. Teams with SBOMs answered in minutes. Teams without spent weeks.

Attach an SBOM to your signed image:

```bash
syft myapp:latest -o spdx-json > sbom.json

cosign attest myregistry.com/myapp@sha256:abc123... \
  --predicate sbom.json \
  --type spdxjson
```

Now anyone pulling your image can verify exactly what's inside AND that you (the builder) attest to it.

---

## Best Practices

### Pin Versions

```dockerfile
# BAD: "latest" changes without warning
FROM node:latest
RUN npm install express

# GOOD: pinned versions everywhere
FROM node:20.11.0-alpine3.19@sha256:a1b2c3d4...
RUN npm install express@4.18.2
```

Think of `latest` like saying "get me whatever bread is on the shelf." You might get sourdough one day and rye the next. Pin versions for reproducible builds.

### Use Official Images

```dockerfile
# BAD: random user's image
FROM randomuser123/node-custom:latest

# GOOD: official image
FROM node:20-alpine

# ALSO GOOD: verified publisher
FROM bitnami/postgresql:16
```

Official images are maintained by Docker and the upstream project. They get security patches quickly.

### Minimal Base Images

```dockerfile
# 1.1 GB — full Debian with everything
FROM node:20

# 180 MB — slim Debian, no extras
FROM node:20-slim

# 50 MB — Alpine Linux, bare minimum
FROM node:20-alpine

# 0 MB base — just your binary (for compiled languages)
FROM scratch
```

For Go applications, you can build FROM scratch:

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server .

FROM scratch
COPY --from=builder /server /server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
ENTRYPOINT ["/server"]
```

This produces an image with ONLY your binary and TLS certificates. Attack surface: nearly zero.

For Node/TypeScript, use distroless:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["dist/server.js"]
```

Distroless has no shell, no package manager, no utilities an attacker could exploit.

### Never Embed Secrets in Images

```dockerfile
# CATASTROPHICALLY BAD
ENV DATABASE_URL=postgres://admin:p4ssw0rd@db:5432/myapp
ENV API_KEY=sk-1234567890abcdef

COPY .env /app/.env
```

Even if you delete the secret in a later layer, it's still in the image history:

```bash
docker history myapp:latest
```

```
IMAGE          CREATED        CREATED BY                                      SIZE
abc123         2 hours ago    ENV DATABASE_URL=postgres://admin:p4ss...        0B
```

Anyone who pulls the image can extract every secret from every layer.

Use BuildKit secrets for build-time secrets:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) npm install
```

```bash
docker build --secret id=npm_token,src=.npmrc .
```

The secret is available during the build but NEVER written to a layer.

For runtime secrets, use environment variables or Docker secrets (covered in lesson 14).

---

## Practical Exercise: Securing an Image

Start with this intentionally insecure Dockerfile:

```dockerfile
FROM node:latest
WORKDIR /app
ENV DB_PASSWORD=supersecret123
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "server.js"]
```

Problems:
1. `latest` tag — unpredictable
2. Full `node` image — huge attack surface
3. Secret baked into image
4. Running as root (default)
5. No health check
6. `npm install` without lockfile

Secured version:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20.11.0-alpine3.19@sha256:a1b2c3d4e5f6... AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY . .

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app .
USER nonroot
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s \
  CMD ["/nodejs/bin/node", "-e", "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
CMD ["server.js"]
```

Now scan it:

```bash
docker build -t myapp:secured .

trivy image --severity HIGH,CRITICAL myapp:secured

cosign sign myregistry.com/myapp:secured@sha256:...

syft myapp:secured -o spdx-json > sbom.json
```

---

## Exercises

### Exercise 1: Scan and Fix

Pull `nginx:1.24` and scan it with Trivy. Identify all critical vulnerabilities. Find the fixed versions and write a Dockerfile that uses an updated base image.

```bash
trivy image nginx:1.24

docker build -t nginx:1.24-fixed .
trivy image nginx:1.24-fixed
```

### Exercise 2: Sign and Verify

Build an image, sign it with cosign, and verify the signature. Then tamper with the image (rebuild with a small change but same tag) and show that verification fails.

### Exercise 3: SBOM Investigation

Generate an SBOM for a Node.js application image. Find a specific package in the SBOM and look up whether it has known vulnerabilities.

```bash
syft myapp:latest -o spdx-json > sbom.json
cat sbom.json | jq '.packages[] | select(.name == "openssl")'
trivy sbom sbom.json
```

### Exercise 4: Supply Chain Simulation

Create two Dockerfiles — one using a pinned digest and one using `latest`. Demonstrate how the `latest` tag can silently change by:

1. Building `mybase:latest` with a benign payload
2. Building `myapp` FROM `mybase:latest`
3. Rebuilding `mybase:latest` with a different payload
4. Rebuilding `myapp` and showing the contents changed

---

## What Would Happen If...

**...you pushed an image with a database password baked in?**

Anyone with pull access to the registry can extract it. Even if you delete the image, cached copies may exist on CI servers, developer machines, and deployment nodes. You'd need to rotate the credential immediately.

**...a base image maintainer's account was compromised?**

Every image built FROM that base picks up the malicious code. This is why you pin digests — a compromised tag push doesn't affect images pinned to the old digest.

**...you skipped vulnerability scanning for "just this one deploy"?**

That's exactly when the critical CVE lands. Scanning must be automated in CI, not optional. A single unscanned deployment could expose your entire infrastructure.

**...you used a random Docker Hub image instead of the official one?**

You're trusting a stranger's kitchen. That image could contain cryptocurrency miners, backdoors, or data exfiltration tools. Stick to official images or build your own from scratch.

---

## Key Takeaways

1. Scan every image, every build — automate it in CI
2. Sign images so consumers can verify origin and integrity
3. Pin base images by digest, not tag
4. Generate SBOMs so you can respond quickly to new CVEs
5. Use minimal base images to reduce attack surface
6. Never bake secrets into images — they persist in layer history
7. Trust is a chain — verify every link from base image to deployment
