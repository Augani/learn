# Security & Cryptography — Defending Systems You Build

Every system you build will be attacked. This track teaches you how
attacks work so you can defend against them — from the math behind
encryption to the OWASP Top 10 to authentication systems to securing
your infrastructure.

Think of it as: you've learned to build houses (code) and cities (systems).
Now learn how locks, safes, alarm systems, and security guards work —
because someone WILL try to break in.

Prerequisites: Track 6 (Networking), Track 2 (Databases). Helpful: Track 9 (Docker), Track 11 (System Design)

---

## Reference Files

- [Security Checklist](./reference-checklist.md) — Pre-deployment security checklist
- [Crypto Cheat Sheet](./reference-crypto.md) — Algorithms, key sizes, when to use what

---

## The Roadmap

### Phase 1: Cryptography Foundations (Hours 1–14)
- [ ] [Lesson 01: Why cryptography exists — the trust problem](./01-why-crypto.md)
- [ ] [Lesson 02: Hashing — fingerprints for data](./02-hashing.md)
- [ ] [Lesson 03: Symmetric encryption — one key to lock and unlock](./03-symmetric-encryption.md)
- [ ] [Lesson 04: Asymmetric encryption — public and private keys](./04-asymmetric-encryption.md)
- [ ] [Lesson 05: Digital signatures — proving who sent it](./05-digital-signatures.md)
- [ ] [Lesson 06: TLS/SSL — how HTTPS actually works](./06-tls-ssl.md)
- [ ] [Lesson 07: Certificates and PKI — the web of trust](./07-certificates-pki.md)

### Phase 2: Application Security (Hours 15–28)
- [ ] [Lesson 08: OWASP Top 10 — the attacks that actually happen](./08-owasp-top10.md)
- [ ] [Lesson 09: Injection attacks — SQL injection, XSS, command injection](./09-injection-attacks.md)
- [ ] [Lesson 10: Authentication — passwords, sessions, tokens](./10-authentication.md)
- [ ] [Lesson 11: Authorization — RBAC, ABAC, OAuth 2.0, OpenID Connect](./11-authorization.md)
- [ ] [Lesson 12: JWTs — how they work, when to use them, common mistakes](./12-jwts.md)
- [ ] [Lesson 13: CORS, CSRF, and browser security](./13-cors-csrf.md)
- [ ] [Lesson 14: Password storage — bcrypt, argon2, and why MD5 is dead](./14-password-storage.md)

### Phase 3: Infrastructure Security (Hours 29–38)
- [ ] [Lesson 15: Secrets management — Vault, env vars, sealed secrets](./15-secrets-management.md)
- [ ] [Lesson 16: Network security — firewalls, VPNs, zero trust](./16-network-security.md)
- [ ] [Lesson 17: Container and cloud security — IAM, security groups, scanning](./17-cloud-security.md)
- [ ] [Lesson 18: Supply chain security — dependencies, SBOMs, signing](./18-supply-chain.md)

### Phase 4: Advanced Topics (Hours 39–48)
- [ ] [Lesson 19: Threat modeling — thinking like an attacker](./19-threat-modeling.md)
- [ ] [Lesson 20: Security headers and hardening — CSP, HSTS, and friends](./20-security-headers.md)
- [ ] [Lesson 21: Logging, auditing, and incident response](./21-logging-auditing.md)
- [ ] [Lesson 22: Cryptography in practice — key management, rotation, envelope encryption](./22-crypto-in-practice.md)

---

## How to use these lessons

Every lesson has:
1. Concept explained with everyday analogies
2. How the attack/defense actually works under the hood
3. Code examples in Go and TypeScript showing both vulnerable and secure versions
4. Hands-on exercises (safely — against your own local systems)
5. Real-world breach examples showing why this matters
