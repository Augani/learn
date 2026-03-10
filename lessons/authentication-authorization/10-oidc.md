# Lesson 10: OpenID Connect (OIDC)

> **The one thing to remember**: OpenID Connect is a thin identity
> layer on top of OAuth 2.0. OAuth tells you "this token can access
> the calendar." OIDC tells you "the user is Alice, her email is
> alice@example.com, and she logged in 5 minutes ago." If OAuth is
> a hotel key card, OIDC is a hotel key card plus a guest ID badge.

---

## The Problem OIDC Solves

OAuth 2.0 was designed for **authorization** (granting access), not
**authentication** (proving identity). But everyone started using
it for login anyway. This led to hacks and workarounds that were
inconsistent and sometimes insecure.

```
THE IDENTITY GAP IN OAUTH 2.0

  With plain OAuth 2.0:

  1. User authorizes your app with Google
  2. You get an access token
  3. You call GET /userinfo with the token
  4. You get back: {"name": "Alice", "email": "alice@example.com"}

  Seems fine, right? But:

  - Different providers use different API endpoints
  - Different providers return different fields
  - The access token doesn't PROVE who the user is
  - There's no standard way to get user info
  - Token substitution attacks are possible

  OIDC standardizes ALL of this.
```

---

## How OIDC Builds on OAuth 2.0

OIDC doesn't replace OAuth — it adds to it:

```
OAUTH 2.0 vs OIDC

  OAuth 2.0 gives you:
  ┌─────────────────────────────┐
  │ access_token                │ → For accessing APIs
  │ refresh_token (optional)    │ → For getting new access tokens
  └─────────────────────────────┘

  OIDC adds:
  ┌─────────────────────────────┐
  │ id_token                    │ → WHO the user is (a JWT!)
  │ UserInfo endpoint           │ → Standard way to get profile data
  │ Standard scopes             │ → openid, profile, email, etc.
  │ Discovery document          │ → Auto-configuration
  └─────────────────────────────┘

  OIDC = OAuth 2.0 + ID Token + UserInfo + Standard Scopes + Discovery
```

---

## The ID Token

The ID token is the centerpiece of OIDC. It's a JWT that contains
information about the authentication event and the user:

```
ID TOKEN (decoded)

  Header:
  {
    "alg": "RS256",
    "kid": "key-id-123"        ← Which key signed this
  }

  Payload:
  {
    "iss": "https://accounts.google.com",  ← Who issued this
    "sub": "110169484474386276334",         ← Unique user ID
    "aud": "your-client-id.apps.google",   ← Your application
    "exp": 1705316400,                     ← Expiration
    "iat": 1705312800,                     ← Issued at
    "nonce": "abc123",                     ← Replay protection
    "auth_time": 1705312790,               ← When user authenticated
    "email": "alice@gmail.com",            ← User's email
    "email_verified": true,                ← Email is confirmed
    "name": "Alice Smith",                 ← Display name
    "picture": "https://..."               ← Profile photo URL
  }
```

**Key difference from access token**: The ID token is meant to be
read by your application. The access token is meant to be sent to
resource servers. Don't send ID tokens to APIs. Don't use access
tokens as proof of identity.

```
TOKEN USAGE

  ┌──────────────┬─────────────────────────────────────┐
  │ Token        │ Who reads it        │ What for      │
  ├──────────────┼─────────────────────┼───────────────┤
  │ ID Token     │ YOUR app (client)   │ Know who the  │
  │              │                     │ user is       │
  ├──────────────┼─────────────────────┼───────────────┤
  │ Access Token │ Resource servers    │ Access APIs   │
  │              │ (APIs)              │               │
  └──────────────┴─────────────────────┴───────────────┘

  WRONG: Sending ID token to an API as authorization
  WRONG: Reading access token claims for user identity
  RIGHT: Reading ID token for identity, using access token for APIs
```

---

## OIDC Scopes

OIDC defines standard scopes that control what identity information
you receive:

```
OIDC SCOPES

  ┌──────────┬────────────────────────────────────────────┐
  │ Scope    │ Claims returned                            │
  ├──────────┼────────────────────────────────────────────┤
  │ openid   │ sub (required — makes it an OIDC request) │
  │          │ Without this, it's plain OAuth, not OIDC   │
  ├──────────┼────────────────────────────────────────────┤
  │ profile  │ name, family_name, given_name, nickname,   │
  │          │ picture, gender, birthdate, zoneinfo,      │
  │          │ locale, updated_at                         │
  ├──────────┼────────────────────────────────────────────┤
  │ email    │ email, email_verified                      │
  ├──────────┼────────────────────────────────────────────┤
  │ address  │ address (formatted, street, city, etc.)    │
  ├──────────┼────────────────────────────────────────────┤
  │ phone    │ phone_number, phone_number_verified        │
  └──────────┴────────────────────────────────────────────┘

  Example authorization request:
  /authorize?
    response_type=code
    &client_id=your_app
    &scope=openid profile email    ← Request identity + profile + email
    &redirect_uri=...
    &state=...
```

The `openid` scope is the magic switch. Including it tells the
authorization server "this is an OIDC request, give me an ID token."
Without it, you get plain OAuth 2.0 behavior.

---

## The UserInfo Endpoint

In addition to claims in the ID token, OIDC provides a standard
endpoint for fetching user profile data:

```
USERINFO ENDPOINT

  GET /userinfo
  Authorization: Bearer {access_token}

  Response:
  {
    "sub": "110169484474386276334",
    "name": "Alice Smith",
    "given_name": "Alice",
    "family_name": "Smith",
    "email": "alice@gmail.com",
    "email_verified": true,
    "picture": "https://lh3.googleusercontent.com/..."
  }
```

**When to use UserInfo vs ID token claims**: The ID token contains
claims at the time of authentication. The UserInfo endpoint returns
current data. If a user changes their name after logging in, the
ID token still has the old name, but UserInfo returns the new name.

```
ID TOKEN vs USERINFO

  ID Token:
  + Available immediately (no extra API call)
  + Signed (tamper-proof)
  + Captures the auth moment (auth_time, nonce)
  - Snapshot at login time (might be stale)
  - Limited size (it's in every response)

  UserInfo:
  + Always current data
  + Can return more claims
  - Requires an API call
  - Requires a valid access token
  - Not signed (trusting the HTTPS connection)
```

---

## Discovery: Automatic Configuration

OIDC providers publish a discovery document that tells your app
everything it needs to know:

```
DISCOVERY DOCUMENT

  GET https://accounts.google.com/.well-known/openid-configuration

  {
    "issuer": "https://accounts.google.com",
    "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
    "token_endpoint": "https://oauth2.googleapis.com/token",
    "userinfo_endpoint": "https://openidconnect.googleapis.com/v1/userinfo",
    "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs",
    "scopes_supported": ["openid", "email", "profile"],
    "response_types_supported": ["code", "token", "id_token"],
    "id_token_signing_alg_values_supported": ["RS256"],
    ...
  }
```

This means your app can auto-configure itself. Just give it the
issuer URL, and it can discover everything else:

```python
import requests

def discover_oidc(issuer_url):
    discovery_url = f"{issuer_url}/.well-known/openid-configuration"
    config = requests.get(discovery_url).json()

    return {
        "auth_endpoint": config["authorization_endpoint"],
        "token_endpoint": config["token_endpoint"],
        "userinfo_endpoint": config["userinfo_endpoint"],
        "jwks_uri": config["jwks_uri"],
    }

google = discover_oidc("https://accounts.google.com")
# Now you know all the URLs without hardcoding them
```

The `jwks_uri` points to the JSON Web Key Set — the public keys used
to verify ID token signatures. Your app fetches these keys and uses
them to verify that the ID token was really signed by the provider.

---

## Complete OIDC Flow

```
OIDC AUTHORIZATION CODE FLOW

  Browser          Your App              Google Auth         Google APIs
  ───────          ────────              ───────────         ───────────
     │                 │                      │                   │
     │  Click "Login   │                      │                   │
     │  with Google"   │                      │                   │
     │────────────────►│                      │                   │
     │                 │                      │                   │
     │                 │ Redirect to Google    │                   │
     │                 │ scope=openid email    │                   │
     │◄────────────────│                      │                   │
     │                 │                      │                   │
     │ Follow redirect ──────────────────────►│                   │
     │                 │                      │                   │
     │ Login + consent │                      │                   │
     │────────────────────────────────────────►│                   │
     │                 │                      │                   │
     │ Redirect with code                     │                   │
     │◄───────────────────────────────────────│                   │
     │                 │                      │                   │
     │ code=XYZ        │                      │                   │
     │────────────────►│                      │                   │
     │                 │                      │                   │
     │                 │ Exchange code         │                   │
     │                 │ for tokens            │                   │
     │                 │─────────────────────►│                   │
     │                 │                      │                   │
     │                 │ {                     │                   │
     │                 │   access_token,       │                   │
     │                 │   id_token,     ← NEW!│                   │
     │                 │   refresh_token       │                   │
     │                 │ }                     │                   │
     │                 │◄─────────────────────│                   │
     │                 │                      │                   │
     │                 │ Verify ID token:      │                   │
     │                 │ - Check signature     │                   │
     │                 │ - Check iss, aud, exp │                   │
     │                 │ - Check nonce         │                   │
     │                 │ - Extract user info   │                   │
     │                 │                      │                   │
     │                 │ (Optional) GET /userinfo                  │
     │                 │──────────────────────────────────────────►│
     │                 │                                           │
     │                 │ {name, email, picture}                    │
     │                 │◄──────────────────────────────────────────│
     │                 │                      │                   │
     │ "Welcome, Alice!│                      │                   │
     │  (alice@gmail)" │                      │                   │
     │◄────────────────│                      │                   │
```

---

## ID Token Verification

You must verify the ID token before trusting it:

```python
import jwt
import requests
from jwt import PyJWKClient

GOOGLE_ISSUER = "https://accounts.google.com"
CLIENT_ID = "your-client-id"

jwks_client = PyJWKClient(
    "https://www.googleapis.com/oauth2/v3/certs"
)

def verify_id_token(id_token, expected_nonce):
    signing_key = jwks_client.get_signing_key_from_jwt(id_token)

    payload = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=CLIENT_ID,
        issuer=GOOGLE_ISSUER,
        options={"require": ["exp", "iss", "sub", "aud", "iat"]}
    )

    if payload.get("nonce") != expected_nonce:
        raise ValueError("Invalid nonce — possible replay attack")

    return {
        "user_id": payload["sub"],
        "email": payload.get("email"),
        "name": payload.get("name"),
        "email_verified": payload.get("email_verified", False)
    }
```

```
ID TOKEN VERIFICATION CHECKLIST

  ✓ Verify the signature using the provider's public keys (JWKS)
  ✓ Check iss (issuer) matches the expected provider
  ✓ Check aud (audience) matches YOUR client ID
  ✓ Check exp (expiration) — token must not be expired
  ✓ Check iat (issued at) — token should be recent
  ✓ Check nonce matches what you sent (prevents replay attacks)
  ✓ Check auth_time if you require recent authentication
```

---

## The Nonce: Preventing Replay Attacks

The nonce works like the state parameter but for ID tokens:

```
NONCE FLOW

  1. Your app generates a random nonce: "n-abc123"
  2. Store it in the user's session
  3. Include it in the auth request: &nonce=n-abc123
  4. The ID token includes: {"nonce": "n-abc123"}
  5. Your app verifies: token nonce == session nonce

  If an attacker replays an old ID token, the nonce won't match
  the current session, and you'll reject it.
```

---

## OIDC vs Plain OAuth for Login

```
"LOGIN WITH GOOGLE" — THE RIGHT WAY vs THE WRONG WAY

  WRONG (plain OAuth):
  1. Get access token
  2. Call GET /userinfo API
  3. Use the email as identity
  Problem: Access token might be for a different user!
           (Token substitution attack)

  RIGHT (OIDC):
  1. Get access token AND id_token
  2. Verify id_token signature, audience, issuer
  3. Read identity from the verified id_token
  4. Optionally call UserInfo for extra data
  The id_token is cryptographically bound to YOUR app
  and the specific authentication event.
```

---

## Exercises

1. **Inspect an ID token**: Use Google's OAuth Playground
   (developers.google.com/oauthplayground) to get an ID token.
   Decode it at jwt.io. What claims are present? What's the issuer?
   What's the audience?

2. **Discovery exploration**: Fetch the discovery document for three
   providers: Google, Microsoft (login.microsoftonline.com/common/v2.0),
   and Auth0 (your-tenant.auth0.com). Compare what scopes and
   response types each supports.

3. **Build OIDC login**: Extend the OAuth code from Lesson 08 to
   request the `openid email profile` scopes, receive an ID token,
   verify it, and display the user's name and email.

4. **Token confusion**: Explain why you should never send an ID token
   to a resource server API. What could go wrong if an API accepted
   ID tokens as authorization?

---

[Next: Lesson 11 — SAML & SSO](./11-saml-sso.md)
