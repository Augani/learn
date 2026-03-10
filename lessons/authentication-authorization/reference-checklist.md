# Reference: Authentication Security Checklist

> Use this checklist when building or auditing an authentication system.
> Every item represents a real vulnerability that has been exploited
> in production systems.

---

## Password Storage

- [ ] Passwords hashed with bcrypt (cost 12+), scrypt, or argon2id
- [ ] NEVER store plaintext passwords
- [ ] NEVER use MD5, SHA-1, or SHA-256 for password hashing
- [ ] Verify password hashing uses per-user unique salts (bcrypt/argon2 handle this automatically)
- [ ] Password comparison uses constant-time comparison function
- [ ] Maximum password length enforced (128 chars) to prevent DoS via extremely long passwords sent to bcrypt

## Password Policy

- [ ] Minimum length of 12 characters
- [ ] Maximum length of 128 characters
- [ ] Check passwords against known breached password databases (e.g., HaveIBeenPwned API)
- [ ] No arbitrary complexity rules (requiring symbols doesn't help as much as length)
- [ ] Block common passwords ("password", "123456", company name)

## Login Flow

- [ ] Same error message for "user not found" and "wrong password" (prevent user enumeration)
- [ ] Rate limiting on login endpoint (by IP and by email)
- [ ] Account lockout after N failed attempts (with automatic unlock after timeout)
- [ ] Log all authentication attempts (success and failure) with timestamp and IP
- [ ] CAPTCHA or proof-of-work after repeated failures
- [ ] No login over plain HTTP (require HTTPS everywhere)

## Registration

- [ ] Email verification before account activation
- [ ] Rate limiting on registration endpoint
- [ ] Validate email format server-side
- [ ] Prevent user enumeration through registration ("check your email" regardless of whether account exists)
- [ ] Sanitize and validate all input fields

## Session Management

- [ ] Session IDs generated with CSPRNG (at least 128 bits of entropy)
- [ ] Session ID regenerated after login (prevent session fixation)
- [ ] HttpOnly flag on session cookies
- [ ] Secure flag on session cookies (HTTPS only)
- [ ] SameSite flag on session cookies (Lax or Strict)
- [ ] Idle timeout (e.g., 15 minutes for sensitive apps)
- [ ] Absolute timeout (e.g., 8 hours regardless of activity)
- [ ] Session destroyed on logout (server-side deletion, not just cookie clearing)
- [ ] Session invalidation when password changes
- [ ] "Log out all devices" functionality available

## JWT / Token Security

- [ ] Signing algorithm explicitly specified during verification (prevent "alg: none" attack)
- [ ] Short access token lifetime (5-15 minutes)
- [ ] Refresh tokens stored securely (HttpOnly cookie or secure storage)
- [ ] Refresh tokens rotated on every use
- [ ] Refresh token reuse detection (revoke family on reuse)
- [ ] Token audience (aud) validated
- [ ] Token issuer (iss) validated
- [ ] Token expiration (exp) validated
- [ ] No sensitive data in JWT payload (it's Base64, not encrypted)
- [ ] Secret key stored in environment variable, not in code
- [ ] Secret key has sufficient entropy (at least 256 bits)

## OAuth 2.0 / OIDC

- [ ] State parameter used and validated (CSRF protection)
- [ ] PKCE used for all clients (not just public clients)
- [ ] Redirect URIs validated exactly (no open redirects)
- [ ] Client secrets stored securely (never in frontend code, never in version control)
- [ ] ID token signature verified using provider's public keys
- [ ] ID token audience matches your client ID
- [ ] ID token issuer matches expected provider
- [ ] Nonce used and validated (replay protection)
- [ ] Access tokens used for APIs only (not for identity)
- [ ] ID tokens used for identity only (not sent to resource servers)

## Multi-Factor Authentication

- [ ] MFA available for all users
- [ ] MFA mandatory for admin accounts
- [ ] Backup codes generated during MFA enrollment
- [ ] Backup codes stored as hashes (like passwords)
- [ ] Each backup code usable only once
- [ ] TOTP uses SHA-1 with 6-digit codes and 30-second window
- [ ] TOTP accepts codes from adjacent windows (clock skew tolerance of +/- 1)
- [ ] Rate limiting on MFA code verification
- [ ] Account recovery process that doesn't bypass MFA entirely
- [ ] Prefer hardware keys (FIDO2) over TOTP over SMS

## SAML (if applicable)

- [ ] Assertion signature validated
- [ ] NotBefore and NotOnOrAfter conditions checked
- [ ] Audience restriction checked
- [ ] Issuer validated
- [ ] Use well-tested SAML library (never parse XML manually)
- [ ] Protection against XML signature wrapping attacks
- [ ] InResponseTo validated for SP-initiated flows

## Authorization / Access Control

- [ ] Authorization checked on every request (not just at login)
- [ ] Check permissions, not roles, in application code
- [ ] Default deny (no permission = no access)
- [ ] Resource-level authorization (user can only access their own data)
- [ ] 401 for unauthenticated, 403 for unauthorized (use correct status codes)
- [ ] Admin functionality on separate routes with additional checks
- [ ] API endpoints validate that the authenticated user can access the requested resource

## Transport Security

- [ ] HTTPS everywhere (no mixed content)
- [ ] HSTS header enabled (Strict-Transport-Security)
- [ ] TLS 1.2 minimum (preferably TLS 1.3)
- [ ] Strong cipher suites configured
- [ ] Certificate pinning for mobile apps (optional, adds complexity)

## HTTP Security Headers

- [ ] Content-Security-Policy configured
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY (or SAMEORIGIN)
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy configured (camera, microphone, geolocation)

## CORS (Cross-Origin Resource Sharing)

- [ ] Allowed origins explicitly listed (not wildcard `*` for authenticated endpoints)
- [ ] Credentials mode properly configured
- [ ] Preflight responses cached appropriately
- [ ] Only necessary HTTP methods and headers allowed

## Password Reset

- [ ] Reset token generated with CSPRNG
- [ ] Reset token expires after short time (15-30 minutes)
- [ ] Reset token is single-use
- [ ] Reset token stored as hash in database (not plaintext)
- [ ] Generic response: "If that email exists, we sent a reset link" (prevent enumeration)
- [ ] All existing sessions invalidated after password reset
- [ ] Old password NOT required for reset (user may not know it)
- [ ] Rate limiting on password reset requests

## Logging and Monitoring

- [ ] Log all authentication events (login, logout, failure, MFA, password change)
- [ ] Log includes timestamp, user ID, IP address, user agent
- [ ] NEVER log passwords, tokens, or session IDs
- [ ] Alert on unusual patterns (brute force, credential stuffing)
- [ ] Alert on admin account login from new IP/device
- [ ] Audit trail for permission changes

## Error Handling

- [ ] No stack traces in production error responses
- [ ] No database error details leaked to client
- [ ] Generic error messages for auth failures
- [ ] Different internal logging vs external error messages

## Dependency Security

- [ ] Authentication libraries kept up to date
- [ ] Regular dependency audits (npm audit, Snyk, etc.)
- [ ] No known CVEs in auth-related dependencies
- [ ] JWT library supports algorithm restriction

---

## Priority Order for New Projects

If you're starting from scratch, implement in this order:

```
PRIORITY 1 (Must have for launch):
  ✓ HTTPS everywhere
  ✓ Proper password hashing (bcrypt/argon2)
  ✓ Session or JWT with correct configuration
  ✓ CSRF protection
  ✓ Rate limiting on auth endpoints
  ✓ Input validation and sanitization
  ✓ Correct HTTP security headers

PRIORITY 2 (Add soon after launch):
  ✓ MFA support (at least TOTP)
  ✓ Password reset flow
  ✓ Audit logging
  ✓ Account lockout
  ✓ Breached password checking

PRIORITY 3 (Add as you scale):
  ✓ OAuth 2.0 social login
  ✓ RBAC with granular permissions
  ✓ Passkey/WebAuthn support
  ✓ SAML SSO (for enterprise customers)
  ✓ Advanced monitoring and alerting
```

---

[Back to Roadmap](./00-roadmap.md)
