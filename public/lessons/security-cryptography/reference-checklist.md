# Pre-Deployment Security Checklist

Use this before every production deploy. Print it. Tape it to your monitor. No shipping until every box is checked.

---

## Authentication

- [ ] Passwords hashed with Argon2id (or bcrypt with cost >= 12)
- [ ] No plaintext passwords anywhere — not in logs, not in databases, not in error messages
- [ ] Password minimum length >= 12 characters
- [ ] Password breach list check (Have I Been Pwned API or similar)
- [ ] Rate limiting on login attempts (max 10/minute per IP, max 5/minute per account)
- [ ] Account lockout or exponential backoff after repeated failures
- [ ] Session tokens are cryptographically random (>= 128 bits of entropy)
- [ ] Session tokens stored server-side or in signed/encrypted cookies
- [ ] Session expiration set (idle timeout + absolute timeout)
- [ ] Session invalidated on logout (server-side, not just cookie deletion)
- [ ] Session invalidated on password change
- [ ] MFA available and enforced for admin accounts
- [ ] MFA recovery codes generated and stored securely
- [ ] TOTP secrets encrypted at rest
- [ ] Password reset tokens are single-use, time-limited (< 1 hour), and cryptographically random
- [ ] Password reset does not reveal whether an account exists
- [ ] Login page does not reveal whether an account exists ("Invalid credentials" not "Invalid password")
- [ ] OAuth/OIDC state parameter used to prevent CSRF
- [ ] JWT tokens have short expiration (< 15 minutes for access tokens)
- [ ] JWT refresh tokens stored securely and rotated on use

---

## Authorization

- [ ] Role-Based Access Control (RBAC) implemented
- [ ] Principle of least privilege: users get minimum permissions needed
- [ ] Every API endpoint has an authorization check (not just authentication)
- [ ] Authorization checked on the server, never trust the client
- [ ] No direct object references without ownership verification (IDOR prevention)
- [ ] Admin endpoints on separate routes or behind additional auth
- [ ] Feature flags checked server-side
- [ ] File uploads restricted by type, size, and stored outside webroot
- [ ] Uploaded files renamed (never trust user-provided filenames)
- [ ] No path traversal possible in file access (`../../etc/passwd`)
- [ ] Horizontal privilege escalation tested (user A can't access user B's resources)
- [ ] Vertical privilege escalation tested (regular user can't access admin functions)

---

## Input Validation

- [ ] All user input validated on the server (client validation is UX, not security)
- [ ] Input length limits enforced
- [ ] SQL queries use parameterized statements (never string concatenation)
- [ ] ORM used with parameterized queries (ORMs can still be vulnerable to injection)
- [ ] HTML output encoded/escaped to prevent XSS
- [ ] Content Security Policy (CSP) header set
- [ ] JSON/XML parsing has depth and size limits
- [ ] File upload content validated (not just extension — check magic bytes)
- [ ] Email addresses validated on format AND domain
- [ ] URLs validated before server-side requests (SSRF prevention)
- [ ] No `eval()` or equivalent with user input
- [ ] Regular expressions checked for ReDoS vulnerability
- [ ] Deserialization of untrusted data avoided (or using safe alternatives)
- [ ] GraphQL queries have depth and complexity limits

---

## HTTP Security Headers

- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- [ ] `Content-Security-Policy` configured (start strict, loosen as needed)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY` (or `SAMEORIGIN` if you need iframes)
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` (or stricter)
- [ ] `Permissions-Policy` set to disable unused browser features
- [ ] `Cache-Control: no-store` on sensitive pages
- [ ] No `X-Powered-By` header (remove framework identification)
- [ ] CORS configured with specific origins (never `Access-Control-Allow-Origin: *` with credentials)
- [ ] CORS `Access-Control-Allow-Methods` restricted to needed methods
- [ ] CORS `Access-Control-Allow-Headers` restricted to needed headers
- [ ] Preflight requests cached with appropriate `Access-Control-Max-Age`

---

## Cookies

- [ ] `Secure` flag set (HTTPS only)
- [ ] `HttpOnly` flag set (no JavaScript access)
- [ ] `SameSite=Lax` or `SameSite=Strict` set
- [ ] Cookie `Path` scoped appropriately
- [ ] Cookie `Domain` scoped appropriately (not too broad)
- [ ] Session cookies have no `Expires`/`Max-Age` (session-only)
- [ ] CSRF tokens used for state-changing requests (or SameSite=Strict)
- [ ] Cookie names don't reveal technology stack

---

## Secrets Management

- [ ] No hardcoded secrets in source code (grep for them: API keys, passwords, tokens)
- [ ] No secrets in git history (if found, rotate immediately — removing from history isn't enough)
- [ ] Secrets loaded from environment variables or a vault (HashiCorp Vault, AWS Secrets Manager, etc.)
- [ ] `.env` files in `.gitignore`
- [ ] Different secrets for each environment (dev, staging, prod)
- [ ] Secrets rotated on a schedule
- [ ] Secrets rotated immediately when a team member leaves
- [ ] API keys scoped to minimum required permissions
- [ ] Database credentials use dedicated service accounts (not root/admin)
- [ ] Encryption keys stored separately from encrypted data
- [ ] No secrets in Docker images or container environment inspection
- [ ] CI/CD secrets stored in platform's secret management (not in config files)
- [ ] Pre-commit hook scanning for secrets (gitleaks, trufflehog, or similar)

---

## Dependencies

- [ ] `npm audit` / `go mod verify` / `cargo audit` run with zero critical/high vulnerabilities
- [ ] Lock files committed (`package-lock.json`, `go.sum`, `Cargo.lock`)
- [ ] Dependabot or Snyk configured for automated vulnerability alerts
- [ ] No dependencies with known critical vulnerabilities
- [ ] Dependencies reviewed before adding (check maintenance status, download count, known issues)
- [ ] Pinned dependency versions (no `*` or `latest`)
- [ ] Sub-dependency vulnerabilities checked (not just direct dependencies)
- [ ] License compliance verified
- [ ] No unnecessary dependencies (each one is an attack surface)
- [ ] Private registry configured if using internal packages

---

## Infrastructure

- [ ] TLS 1.2+ everywhere (TLS 1.3 preferred)
- [ ] SSL/TLS certificates valid and not expiring within 30 days
- [ ] Certificate auto-renewal configured (Let's Encrypt + certbot)
- [ ] HTTP redirects to HTTPS (301, not 302)
- [ ] HSTS preload submitted
- [ ] Firewall rules: deny all, allow specific
- [ ] Database not exposed to public internet
- [ ] SSH key-based authentication only (no password SSH)
- [ ] SSH on non-default port (security through obscurity helps a tiny bit)
- [ ] IAM roles follow least privilege
- [ ] No root/admin credentials used for application access
- [ ] Cloud storage buckets are private by default
- [ ] Backups encrypted and tested for restoration
- [ ] DDoS protection configured (Cloudflare, AWS Shield, etc.)
- [ ] Container images scanned for vulnerabilities
- [ ] Container runs as non-root user
- [ ] Kubernetes/orchestration RBAC configured
- [ ] Network policies restrict pod-to-pod communication
- [ ] DNS configured with DNSSEC

---

## Logging and Monitoring

- [ ] Authentication events logged (login, logout, failed attempts, password changes)
- [ ] Authorization failures logged
- [ ] Input validation failures logged
- [ ] Application errors logged (with stack traces in dev, without in prod)
- [ ] No PII in logs (no passwords, tokens, credit cards, SSNs)
- [ ] No secrets in logs
- [ ] Logs stored centrally (ELK, Datadog, CloudWatch, etc.)
- [ ] Log retention policy defined and implemented
- [ ] Alerting configured for anomalous patterns (spike in 401s, login failures, etc.)
- [ ] Audit trail for admin actions
- [ ] Logs are immutable (append-only, tamper-evident)
- [ ] Log access restricted to operations team
- [ ] Request IDs for tracing across services

---

## API Security

- [ ] Authentication required on all non-public endpoints
- [ ] Rate limiting per user/IP/API key
- [ ] Request size limits enforced
- [ ] Pagination enforced (no unbounded queries)
- [ ] Input validation on all parameters
- [ ] Response doesn't leak internal details (stack traces, SQL errors, internal IPs)
- [ ] API versioning strategy in place
- [ ] Deprecated endpoints have sunset dates
- [ ] OpenAPI/Swagger spec matches actual implementation
- [ ] HTTPS only (no HTTP fallback)
- [ ] API keys rotatable without downtime
- [ ] Webhook endpoints verify signatures
- [ ] GraphQL introspection disabled in production
- [ ] Batch endpoints have item count limits

---

## Data Protection

- [ ] Sensitive data encrypted at rest (database, backups, files)
- [ ] Sensitive data encrypted in transit (TLS)
- [ ] PII inventory documented (know what you store and where)
- [ ] Data retention policy defined and automated
- [ ] User data exportable (GDPR right to data portability)
- [ ] User data deletable (GDPR right to erasure)
- [ ] Encryption keys managed properly (rotation, separation, access control)
- [ ] Database backups encrypted
- [ ] Temporary files cleaned up
- [ ] Debug/development data not present in production

---

## Incident Response

- [ ] Incident response plan documented
- [ ] Contact list for security incidents
- [ ] Process for rotating all credentials quickly
- [ ] Process for deploying emergency patches
- [ ] Post-incident review template ready
- [ ] Communication plan for affected users
- [ ] Legal/compliance team contact information available
- [ ] Backup restoration tested within last 90 days

---

## Before You Ship

Run these commands:

```bash
# Check for secrets in code
gitleaks detect --source . --verbose

# Check dependencies
npm audit --production        # Node.js
go list -m -json all | nancy  # Go (nancy for vulnerability check)
cargo audit                   # Rust

# Check security headers (after deployment)
curl -I https://yourdomain.com | grep -iE "strict-transport|content-security|x-content-type|x-frame"

# Test TLS configuration
nmap --script ssl-enum-ciphers -p 443 yourdomain.com

# Check certificate
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## The 5-Minute Version

If you only have 5 minutes before deploy, check these non-negotiables:

1. [ ] No hardcoded secrets in code or git history
2. [ ] All user input validated server-side
3. [ ] SQL injection impossible (parameterized queries everywhere)
4. [ ] Passwords hashed with Argon2id/bcrypt (never MD5/SHA)
5. [ ] HTTPS everywhere with valid certificates
6. [ ] Authentication and authorization on every endpoint
7. [ ] Security headers set (HSTS, CSP, nosniff)
8. [ ] Dependencies audited for known vulnerabilities
9. [ ] No sensitive data in logs
10. [ ] Rate limiting on authentication endpoints

If any of these fail, you are not ready to ship.
