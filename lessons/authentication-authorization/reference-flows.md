# Reference: OAuth 2.0 & OIDC Flows

> Quick visual reference for all OAuth 2.0 and OpenID Connect flows.
> Print this out, bookmark it, refer back to it when implementing.

---

## Authorization Code Flow (+ PKCE)

**Use for**: Web apps, SPAs, mobile apps — any scenario with a user.

```
  User           Client              Auth Server         Resource Server
  ────           ──────              ───────────         ───────────────
    │               │                     │                    │
    │ 1. Click      │                     │                    │
    │ "Login"       │                     │                    │
    │──────────────►│                     │                    │
    │               │                     │                    │
    │               │ 2. Generate PKCE    │                    │
    │               │ code_verifier +     │                    │
    │               │ code_challenge      │                    │
    │               │                     │                    │
    │ 3. Redirect   │                     │                    │
    │◄──────────────│                     │                    │
    │               │                     │                    │
    │ 4. GET /authorize?                  │                    │
    │    response_type=code               │                    │
    │    &client_id=...                   │                    │
    │    &code_challenge=...              │                    │
    │    &state=...                       │                    │
    │    &scope=openid email              │                    │
    │────────────────────────────────────►│                    │
    │               │                     │                    │
    │ 5. Login + Consent                  │                    │
    │◄───────────────────────────────────►│                    │
    │               │                     │                    │
    │ 6. Redirect to callback?code=XYZ&state=...              │
    │◄────────────────────────────────────│                    │
    │               │                     │                    │
    │ 7. Forward    │                     │                    │
    │──────────────►│                     │                    │
    │               │                     │                    │
    │               │ 8. POST /token      │                    │
    │               │   grant_type=       │                    │
    │               │    authorization_code                    │
    │               │   code=XYZ          │                    │
    │               │   code_verifier=... │                    │
    │               │   client_secret=... │                    │
    │               │   (if confidential) │                    │
    │               │────────────────────►│                    │
    │               │                     │                    │
    │               │ 9. {access_token,   │                    │
    │               │     id_token,       │                    │
    │               │     refresh_token}  │                    │
    │               │◄────────────────────│                    │
    │               │                     │                    │
    │               │ 10. GET /api/resource                    │
    │               │   Authorization:    │                    │
    │               │   Bearer {token}    │                    │
    │               │─────────────────────────────────────────►│
    │               │                     │                    │
    │               │ 11. {resource data} │                    │
    │               │◄─────────────────────────────────────────│
    │               │                     │                    │
    │ 12. Display   │                     │                    │
    │◄──────────────│                     │                    │
```

**Key parameters**:
- `response_type=code`
- `code_challenge` + `code_challenge_method=S256` (PKCE)
- `state` (CSRF protection)
- `scope=openid ...` (for OIDC)

---

## Client Credentials Flow

**Use for**: Server-to-server, no user involved.

```
  Your Server                         Auth Server
  (Client)                            ───────────
     │                                     │
     │  POST /token                        │
     │  grant_type=client_credentials      │
     │  &client_id=...                     │
     │  &client_secret=...                 │
     │  &scope=...                         │
     │────────────────────────────────────►│
     │                                     │
     │  {                                  │
     │    "access_token": "eyJ...",        │
     │    "token_type": "bearer",          │
     │    "expires_in": 3600               │
     │  }                                  │
     │◄────────────────────────────────────│
     │                                     │
     │  GET /api/resource                  │
     │  Authorization: Bearer eyJ...       │
     │─────────────────────────────────────────► Resource Server
     │                                     │
     │  {resource data}                    │
     │◄─────────────────────────────────────────
```

**Key point**: No redirect, no user interaction. Direct POST.

---

## Device Authorization Flow

**Use for**: Smart TVs, CLI tools, IoT devices.

```
  Device              Auth Server           User's Phone/Browser
  ──────              ───────────           ────────────────────
     │                     │                       │
     │  POST /device/code  │                       │
     │  client_id=...      │                       │
     │────────────────────►│                       │
     │                     │                       │
     │  {device_code,      │                       │
     │   user_code: "ABCD",│                       │
     │   verification_uri, │                       │
     │   interval: 5}      │                       │
     │◄────────────────────│                       │
     │                     │                       │
     │  Display:           │                       │
     │  "Go to example.com │                       │
     │   /device           │                       │
     │   Enter: ABCD"      │                       │
     │                     │                       │
     │                     │  User visits URL       │
     │                     │  and enters code       │
     │                     │◄──────────────────────│
     │                     │                       │
     │                     │  User logs in +        │
     │                     │  approves              │
     │                     │◄──────────────────────│
     │                     │                       │
     │  POST /token        │                       │
     │  grant_type=        │                       │
     │  urn:ietf:params:   │                       │
     │  oauth:grant-type:  │                       │
     │  device_code        │                       │
     │  &device_code=...   │                       │
     │────────────────────►│                       │
     │                     │                       │
     │  (Poll until:)      │                       │
     │  {access_token,     │                       │
     │   refresh_token}    │                       │
     │◄────────────────────│                       │
```

**Key point**: Device polls `/token` every `interval` seconds.

---

## Token Refresh Flow

**Use for**: Getting new access tokens without re-authentication.

```
  Client                              Auth Server
  ──────                              ───────────
     │                                     │
     │  POST /token                        │
     │  grant_type=refresh_token           │
     │  &refresh_token=dGhpcyBp...        │
     │  &client_id=...                     │
     │  &client_secret=...  (if conf.)     │
     │────────────────────────────────────►│
     │                                     │
     │  {                                  │
     │    "access_token": "eyJ...(new)",   │
     │    "refresh_token": "abc...(new)",  │
     │    "expires_in": 900                │
     │  }                                  │
     │◄────────────────────────────────────│
```

**Key point**: Rotate the refresh token on every use.

---

## OIDC: What's Added to OAuth 2.0

```
PLAIN OAUTH 2.0                    OIDC (OAuth 2.0 + Identity)
──────────────                     ────────────────────────────

scope=calendar.read                scope=openid email profile
                                         ▲
                                         │ "openid" triggers OIDC

Token response:                    Token response:
{                                  {
  access_token,                      access_token,
  refresh_token                      refresh_token,
}                                    id_token          ← NEW
                                   }

No standard user endpoint          GET /userinfo       ← Standard

No discovery                       GET /.well-known/   ← Standard
                                     openid-configuration

No user identity                   ID token contains:
                                     sub, email, name,
                                     iss, aud, exp, nonce
```

---

## Quick Decision Matrix

```
┌──────────────────────────────┬─────────────────────────────┐
│ I need to...                 │ Use this flow               │
├──────────────────────────────┼─────────────────────────────┤
│ Let users log in via browser │ Auth Code + PKCE            │
│ Call an API from my backend  │ Client Credentials          │
│ Auth on a smart TV / CLI     │ Device Authorization        │
│ Get user identity (name,     │ Auth Code + PKCE + OIDC     │
│   email) after login         │ (scope=openid)              │
│ Refresh an expired token     │ Refresh Token grant         │
│ Let users log in via mobile  │ Auth Code + PKCE            │
│   app                        │                             │
└──────────────────────────────┴─────────────────────────────┘
```

---

## SAML SP-Initiated Flow (For Comparison)

```
  User           Service Provider        Identity Provider
  ────           ────────────────        ─────────────────
    │                  │                       │
    │ Visit SP         │                       │
    │─────────────────►│                       │
    │                  │                       │
    │ Redirect with    │                       │
    │ SAML AuthnRequest│                       │
    │◄─────────────────│                       │
    │                  │                       │
    │ Forward to IdP   │                       │
    │─────────────────────────────────────────►│
    │                  │                       │
    │ Login page       │                       │
    │◄────────────────────────────────────────│
    │                  │                       │
    │ Enter credentials│                       │
    │─────────────────────────────────────────►│
    │                  │                       │
    │ POST to SP ACS   │                       │
    │ (SAML Response   │                       │
    │  with Assertion) │                       │
    │◄────────────────────────────────────────│
    │                  │                       │
    │ Auto-submit      │                       │
    │─────────────────►│                       │
    │                  │ Verify assertion      │
    │                  │ Create session        │
    │ Welcome!         │                       │
    │◄─────────────────│                       │
```

---

[Back to Roadmap](./00-roadmap.md)
