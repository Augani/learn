# Authentication & Authorization

> **The one thing to remember**: Authentication is "who are you?" and
> authorization is "what are you allowed to do?" Every secure system
> on the internet — from your bank to your email — depends on getting
> both of these right.

---

## Why This Topic Matters

Every time you log into a website, swipe a badge at work, or unlock
your phone with your face, you're using authentication. Every time
a website decides whether you can view a page, edit a document, or
delete an account, that's authorization.

Get it wrong and people's passwords leak. Get it really wrong and
attackers access medical records, bank accounts, or government systems.

This course takes you from zero to building a complete authentication
system. No prior security knowledge required — just basic programming
experience.

---

## Learning Path

### Foundations
- [ ] [01 - Identity Basics](./01-identity-basics.md) — What identity means, AuthN vs AuthZ
- [ ] [02 - Password Authentication](./02-password-auth.md) — How login actually works
- [ ] [03 - Hashing & Salting](./03-hashing-salting.md) — Storing passwords safely
- [ ] [04 - Sessions & Cookies](./04-sessions-cookies.md) — Keeping users logged in
- [ ] [05 - Token Authentication](./05-token-auth.md) — Stateless auth with tokens
- [ ] [06 - JWT Deep Dive](./06-jwt-deep-dive.md) — JSON Web Tokens inside and out

### OAuth 2.0 & OpenID Connect
- [ ] [07 - OAuth 2.0 Big Picture](./07-oauth2-big-picture.md) — Why OAuth exists
- [ ] [08 - Authorization Code Flow](./08-oauth2-auth-code.md) — The most important OAuth flow
- [ ] [09 - Other OAuth Flows](./09-oauth2-other-flows.md) — Client credentials, device flow, and more
- [ ] [10 - OpenID Connect](./10-oidc.md) — Identity layer on top of OAuth

### Enterprise & Access Control
- [ ] [11 - SAML & SSO](./11-saml-sso.md) — Enterprise single sign-on
- [ ] [12 - Role-Based Access Control](./12-rbac.md) — Permissions through roles
- [ ] [13 - Attribute-Based Access Control](./13-abac.md) — Context-aware permissions

### Modern Authentication
- [ ] [14 - Multi-Factor Authentication](./14-mfa.md) — Beyond passwords
- [ ] [15 - Passkeys & WebAuthn](./15-passkeys-webauthn.md) — The passwordless future

### Capstone
- [ ] [16 - Build an Auth System](./16-build-auth-system.md) — Put it all together

### Reference
- [OAuth 2.0 / OIDC Flow Reference](./reference-flows.md) — Quick visual reference
- [Security Checklist](./reference-checklist.md) — Implementation checklist

---

## How to Use This Course

**If you're brand new**: Start at lesson 01 and work through in order.
Each lesson builds on the previous one.

**If you know the basics**: Skip to lesson 07 (OAuth 2.0) or lesson 12
(access control) depending on what you need.

**If you're building something**: Jump to lesson 16 (capstone) and
reference back to earlier lessons as needed. Use the reference files
for quick lookups.

---

## Recommended Reading

These books go deeper than this course can. If you can access them
through a library or other means, they're excellent resources:

- **OAuth 2 in Action** by Justin Richer and Antonio Sanso (Manning, 2017)
  The most practical guide to implementing OAuth 2.0 correctly. Walks
  through building a complete OAuth system with real code.

- **Bulletproof SSL and TLS** by Ivan Ristic (Feisty Duck, 2nd Edition 2022)
  Everything about transport-layer security. Essential for understanding
  how HTTPS protects authentication data in transit.

- **Identity and Data Security for Web Development** by Jonathan LeBlanc
  and Tim Messerschmidt (O'Reilly, 2016)
  Covers modern web identity from passwords to biometrics. Good
  companion to the practical sections of this course.

---

## Prerequisites

- Basic understanding of HTTP (requests, responses, status codes)
- Comfort reading code in at least one language (examples use
  JavaScript/Node.js, Python, and SQL)
- A terminal and text editor

---

[Start: Lesson 01 — Identity Basics](./01-identity-basics.md)
