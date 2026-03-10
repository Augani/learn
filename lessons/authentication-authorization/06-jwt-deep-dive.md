# Lesson 06: JWT Deep Dive

> **The one thing to remember**: A JWT (JSON Web Token) is three
> Base64-encoded chunks separated by dots: header.payload.signature.
> The header says how it's signed, the payload holds the claims
> (user info), and the signature proves nobody tampered with it.
> JWTs are not encrypted — anyone can read the payload. The signature
> only guarantees integrity.

---

## The Sealed Envelope Analogy

```
A JWT IS LIKE A SEALED TRANSPARENT ENVELOPE

  ┌─────────────────────────────────────────────┐
  │ ENVELOPE (transparent — anyone can read it)  │
  │                                              │
  │  ┌────────────────────────────────────────┐  │
  │  │ HEADER (printed on the outside)        │  │
  │  │ "This letter uses wax seal type: HS256"│  │
  │  └────────────────────────────────────────┘  │
  │                                              │
  │  ┌────────────────────────────────────────┐  │
  │  │ PAYLOAD (the actual letter)            │  │
  │  │ "Alice is an admin. Expires at sunset."│  │
  │  └────────────────────────────────────────┘  │
  │                                              │
  │  ┌────────────────────────────────────────┐  │
  │  │ WAX SEAL (signature)                   │  │
  │  │ If anyone changes the letter, the seal │  │
  │  │ won't match. You know it's been        │  │
  │  │ tampered with.                         │  │
  │  └────────────────────────────────────────┘  │
  └─────────────────────────────────────────────┘

  KEY POINT: Everyone can READ the letter (it's not secret).
  But nobody can CHANGE it without breaking the seal.
```

---

## JWT Structure

A JWT looks like this:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsImVtYWlsIjoiYWxpY2VA
ZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MDUzMTI4MDAsImV4cCI6MTcw
NTMxNjQwMH0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

That's three parts separated by dots:

```
JWT = HEADER.PAYLOAD.SIGNATURE

  Part 1: HEADER (Base64URL encoded)
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9

  Decodes to:
  {
    "alg": "HS256",     ← Signing algorithm
    "typ": "JWT"        ← Token type
  }


  Part 2: PAYLOAD (Base64URL encoded)
  eyJzdWIiOiI0MiIsImVtYWlsIjoi...

  Decodes to:
  {
    "sub": "42",                    ← Subject (user ID)
    "email": "alice@example.com",   ← Custom claim
    "role": "admin",                ← Custom claim
    "iat": 1705312800,              ← Issued At
    "exp": 1705316400               ← Expiration
  }


  Part 3: SIGNATURE
  SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

  Created by:
  HMACSHA256(
    base64UrlEncode(header) + "." + base64UrlEncode(payload),
    secret_key
  )
```

**Base64URL** is just Base64 encoding that's safe for URLs (uses `-`
and `_` instead of `+` and `/`, no padding `=`). It's encoding, not
encryption. Anyone can decode it:

```bash
echo "eyJzdWIiOiI0MiJ9" | base64 -d
# Output: {"sub":"42"}
```

---

## Standard Claims

JWT defines registered claim names with specific meanings:

```
REGISTERED CLAIMS

  Claim  Full name         Purpose                      Example
  ─────  ────────────────  ───────────────────────────  ─────────────
  iss    Issuer            Who created this token        "auth.example.com"
  sub    Subject           Who this token is about       "user:42"
  aud    Audience          Who should accept this token  "api.example.com"
  exp    Expiration Time   When the token expires         1705316400
  nbf    Not Before        Token not valid before this    1705312800
  iat    Issued At         When the token was created     1705312800
  jti    JWT ID            Unique identifier for token    "a1b2c3d4"
```

You can add any custom claims you want:

```json
{
  "sub": "42",
  "email": "alice@example.com",
  "role": "admin",
  "permissions": ["read", "write", "delete"],
  "org_id": "org_789",
  "iat": 1705312800,
  "exp": 1705316400
}
```

**Warning**: Don't put sensitive data in the payload. It's only
Base64-encoded, not encrypted. Anyone with the token can decode
and read every claim.

---

## Signing Algorithms

The algorithm in the header determines how the signature is created:

```
SIGNING ALGORITHMS

  SYMMETRIC (shared secret)
  ┌──────────────────────────────────────────────────────┐
  │ HS256 / HS384 / HS512                                │
  │                                                      │
  │ Same key signs AND verifies.                         │
  │                                                      │
  │ Auth Server ──[secret key]──► Sign token             │
  │ API Server  ──[secret key]──► Verify token           │
  │                                                      │
  │ Both servers must share the same secret.             │
  │ Simple, fast, but the secret must be distributed.    │
  └──────────────────────────────────────────────────────┘

  ASYMMETRIC (public/private key pair)
  ┌──────────────────────────────────────────────────────┐
  │ RS256 / RS384 / RS512 (RSA)                          │
  │ ES256 / ES384 / ES512 (ECDSA — recommended)          │
  │ PS256 / PS384 / PS512 (RSA-PSS)                      │
  │                                                      │
  │ Private key signs. Public key verifies.              │
  │                                                      │
  │ Auth Server ──[private key]──► Sign token            │
  │ API Server  ──[public key]───► Verify token          │
  │ Other APIs  ──[public key]───► Verify token          │
  │                                                      │
  │ Only the auth server needs the private key.          │
  │ Anyone can verify with the public key.               │
  │ Better for microservices — no secret sharing needed. │
  └──────────────────────────────────────────────────────┘
```

**When to use which**:

```
ALGORITHM DECISION

  Single server (monolith)?
  └──► HS256 is fine. Simple and fast.

  Multiple services verify tokens?
  └──► RS256 or ES256. Share only the public key.

  ES256 vs RS256?
  └──► ES256 (ECDSA). Smaller keys, smaller signatures, equally secure.
       256-bit EC key ≈ 3072-bit RSA key in security strength.
```

---

## Refresh Tokens

Access tokens should expire quickly (5-15 minutes). But you don't
want users re-entering their password every 15 minutes. Refresh
tokens solve this:

```
ACCESS TOKEN + REFRESH TOKEN FLOW

  Browser                              Server
  ───────                              ──────

  POST /login ────────────────────────► Verify credentials

  ◄──── {
          "access_token": "eyJ...",     (expires: 15 min)
          "refresh_token": "dGhpcyBp..." (expires: 7 days)
        }

  ... 15 minutes pass, access token expires ...

  GET /api/data
  Authorization: Bearer eyJ... ────────► Token expired! 401.

  POST /api/refresh
  {"refresh_token": "dGhpcyBp..."} ────► Validate refresh token
                                          (Check it's in the DB)
                                          Issue NEW access token

  ◄──── {"access_token": "eyJ...NEW"}    (another 15 min)

  GET /api/data
  Authorization: Bearer eyJ...NEW ─────► Valid! Return data.
```

**Critical difference**: The access token is stateless (no DB lookup).
The refresh token IS stored in the database (stateful, revocable).

```python
import jwt
import secrets
from datetime import datetime, timedelta

SECRET_KEY = "your-secret-key"

def create_tokens(user_id, user_role):
    access_token = jwt.encode({
        "sub": str(user_id),
        "role": user_role,
        "type": "access",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=15)
    }, SECRET_KEY, algorithm="HS256")

    refresh_token = secrets.token_hex(32)

    database.store_refresh_token(
        token=refresh_token,
        user_id=user_id,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )

    return access_token, refresh_token


def refresh_access_token(refresh_token):
    stored = database.get_refresh_token(refresh_token)

    if stored is None:
        raise InvalidTokenError("Refresh token not found")

    if stored.expires_at < datetime.utcnow():
        database.delete_refresh_token(refresh_token)
        raise InvalidTokenError("Refresh token expired")

    if stored.revoked:
        database.revoke_all_tokens_for_user(stored.user_id)
        raise InvalidTokenError("Refresh token revoked — possible theft")

    database.delete_refresh_token(refresh_token)
    new_access, new_refresh = create_tokens(stored.user_id, stored.role)
    return new_access, new_refresh
```

Notice the **refresh token rotation**: every time a refresh token is
used, the old one is deleted and a new one is issued. If an attacker
tries to use a stolen refresh token after the real user has already
used it, the server detects the reuse and revokes everything.

---

## Common JWT Pitfalls

### Pitfall 1: The "alg: none" Attack

```
THE NONE ALGORITHM ATTACK

  Normal token header:
  {"alg": "HS256", "typ": "JWT"}

  Attacker changes it to:
  {"alg": "none", "typ": "JWT"}

  If the server blindly trusts the "alg" field, it will
  accept the token WITHOUT verifying any signature.

  FIX: ALWAYS specify the allowed algorithm(s) when verifying:

  # VULNERABLE:
  jwt.decode(token, SECRET_KEY)  # Uses alg from the token header!

  # SAFE:
  jwt.decode(token, SECRET_KEY, algorithms=["HS256"])  # Explicit!
```

### Pitfall 2: Key Confusion (RSA/HMAC)

```
THE KEY CONFUSION ATTACK

  Server expects: RS256 (asymmetric, public/private key)
  Attacker sends: HS256 (symmetric, shared secret)

  The server has a PUBLIC KEY for RS256 verification.
  If it switches to HS256, it uses the PUBLIC KEY as the HMAC secret.
  The attacker KNOWS the public key (it's public!) and can sign
  tokens with it.

  FIX: Same as above — explicitly specify allowed algorithms.
  jwt.decode(token, public_key, algorithms=["RS256"])
```

### Pitfall 3: Stuffing Too Much in the Payload

```
TOKEN SIZE MATTERS

  Every HTTP request includes the token.
  A 200-byte token adds 200 bytes to every API call.

  Bad idea:
  {
    "sub": "42",
    "permissions": ["read:users", "write:users", "delete:users",
                    "read:posts", "write:posts", ... 50 more ...],
    "profile": {"name": "Alice", "avatar": "base64...(2KB)"},
    "preferences": { ... }
  }

  This token could be 5KB+. That's 5KB on EVERY request.

  Good idea:
  {
    "sub": "42",
    "role": "admin",
    "exp": 1705316400
  }

  Look up permissions from the role on the server side.
```

### Pitfall 4: Using JWT for Sessions

```
JWT IS NOT A SESSION REPLACEMENT

  JWTs can't be individually revoked (without a blocklist).
  JWTs are larger than a session ID cookie.
  JWTs send all claims on every request.

  If you need revocation, server-side data, or small cookies:
  just use sessions. It's not a failure. It's the right tool.

  JWTs shine for:
  - Cross-service authentication (microservices)
  - Short-lived access tokens paired with refresh tokens
  - Stateless API authentication
  - Third-party integrations
```

---

## JWT Verification Checklist

```python
def verify_jwt(token, expected_audience):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=["HS256"],         # Explicit algorithm
            audience=expected_audience,    # Check audience
            issuer="auth.example.com",    # Check issuer
            options={
                "require": ["exp", "iss", "sub", "aud"],  # Required claims
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": True,
            }
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthError("Token expired")
    except jwt.InvalidAudienceError:
        raise AuthError("Token not intended for this service")
    except jwt.InvalidIssuerError:
        raise AuthError("Token from untrusted issuer")
    except jwt.InvalidTokenError:
        raise AuthError("Invalid token")
```

---

## Exercises

1. **Decode a JWT**: Go to jwt.io and paste this token:
   `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`
   What's the subject? When was it issued? What algorithm?

2. **Build refresh rotation**: Implement the access + refresh token
   pattern. When a refresh token is used, issue a new pair and
   invalidate the old refresh token. Test: what happens if the old
   refresh token is used again?

3. **Algorithm attack**: Write code that creates a JWT with `alg: none`.
   Then write verification code that's vulnerable to it, and fix it.

4. **Size analysis**: Create a JWT with 5 claims vs 50 claims. Measure
   the token sizes. If your API handles 10,000 requests/second, how
   much extra bandwidth does the larger token consume per day?

---

[Next: Lesson 07 — OAuth 2.0 Big Picture](./07-oauth2-big-picture.md)
