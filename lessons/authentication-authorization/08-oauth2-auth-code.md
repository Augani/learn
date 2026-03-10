# Lesson 08: OAuth 2.0 Authorization Code Flow

> **The one thing to remember**: The authorization code flow works in
> two steps — first get a short-lived code through the browser, then
> exchange that code for tokens through a secure back-channel. PKCE
> adds a secret handshake that prevents anyone who intercepts the code
> from using it.

---

## The Concert Ticket Analogy

```
THE AUTHORIZATION CODE FLOW IS LIKE BUYING CONCERT TICKETS

  1. You go to the ticket window (authorization endpoint)
  2. You show ID and pay (authenticate and consent)
  3. You get a PICKUP SLIP, not the ticket itself
     (authorization code, not the token)
  4. You go to a different window (token endpoint)
  5. You trade the pickup slip + your receipt for actual tickets
     (exchange code + client secret for tokens)

  Why not just hand you the ticket at window 1?
  Because there's a crowd watching at window 1 (the browser).
  The pickup slip is useless without the receipt (client secret).
  The actual ticket handoff happens in a private back room.
```

---

## Step-by-Step Walkthrough

Let's walk through every step of a real authorization code flow.
The example: a user clicking "Sign in with GitHub" on a website.

### Step 1: User Clicks "Sign in with GitHub"

The website builds an authorization URL and redirects the user:

```
AUTHORIZATION REQUEST

  https://github.com/login/oauth/authorize?
    response_type=code
    &client_id=abc123
    &redirect_uri=https://myapp.com/callback
    &scope=read:user user:email
    &state=xyzRandom789

  ┌──────────────────┬────────────────────────────────────┐
  │ Parameter        │ Purpose                            │
  ├──────────────────┼────────────────────────────────────┤
  │ response_type    │ "code" — we want an auth code      │
  │ client_id        │ Identifies our app to GitHub        │
  │ redirect_uri     │ Where to send the user back        │
  │ scope            │ What access we're requesting       │
  │ state            │ Random value for CSRF protection   │
  └──────────────────┴────────────────────────────────────┘
```

### Step 2: User Authenticates with GitHub

```
USER SEES GITHUB'S CONSENT SCREEN

  ┌────────────────────────────────────────────┐
  │           Sign in to GitHub                │
  │                                            │
  │  Username: [________________]              │
  │  Password: [________________]              │
  │                                            │
  │           [Sign in]                        │
  └────────────────────────────────────────────┘

  Then:
  ┌────────────────────────────────────────────┐
  │   MyApp wants to access your account       │
  │                                            │
  │   ✓ Read your profile information          │
  │   ✓ Read your email addresses              │
  │                                            │
  │   [Authorize MyApp]     [Cancel]           │
  └────────────────────────────────────────────┘
```

### Step 3: GitHub Redirects Back with a Code

```
AUTHORIZATION RESPONSE (redirect)

  HTTP/1.1 302 Found
  Location: https://myapp.com/callback?code=AUTH_CODE_xyz&state=xyzRandom789

  The authorization code is in the URL query parameter.
  The state parameter is echoed back (we MUST verify it matches).
```

### Step 4: Backend Exchanges Code for Tokens

This happens server-to-server. The user's browser is not involved:

```
TOKEN REQUEST (server-to-server)

  POST https://github.com/login/oauth/access_token

  Content-Type: application/x-www-form-urlencoded

  grant_type=authorization_code
  &code=AUTH_CODE_xyz
  &redirect_uri=https://myapp.com/callback
  &client_id=abc123
  &client_secret=SECRET_456
```

```
TOKEN RESPONSE

  {
    "access_token": "gho_16C7e42F292c6912E7710c838347Ae178B4a",
    "token_type": "bearer",
    "scope": "read:user,user:email",
    "refresh_token": "ghr_1234567890abcdef"
  }
```

### Step 5: Use the Token

```
API REQUEST

  GET https://api.github.com/user
  Authorization: Bearer gho_16C7e42F292c6912E7710c838347Ae178B4a

API RESPONSE

  {
    "login": "alice",
    "id": 12345,
    "name": "Alice Smith",
    "email": "alice@example.com"
  }
```

---

## The Complete Flow as a Diagram

```
AUTHORIZATION CODE FLOW — COMPLETE

  User            Browser/Client         Auth Server          Resource
  (Alice)         (myapp.com)            (github.com)         Server
  ───────         ──────────────         ───────────          (api.github)
     │                  │                     │                   │
     │ 1. Click         │                     │                   │
     │ "Sign in"        │                     │                   │
     │─────────────────►│                     │                   │
     │                  │                     │                   │
     │                  │ 2. 302 Redirect     │                   │
     │                  │ to auth endpoint    │                   │
     │◄─────────────────│                     │                   │
     │                  │                     │                   │
     │ 3. Browser follows redirect            │                   │
     │───────────────────────────────────────►│                   │
     │                  │                     │                   │
     │ 4. Login page    │                     │                   │
     │◄──────────────────────────────────────│                   │
     │                  │                     │                   │
     │ 5. Enter creds + consent              │                   │
     │───────────────────────────────────────►│                   │
     │                  │                     │                   │
     │ 6. 302 Redirect to callback?code=XYZ  │                   │
     │◄──────────────────────────────────────│                   │
     │                  │                     │                   │
     │ 7. Browser follows redirect to myapp  │                   │
     │─────────────────►│                     │                   │
     │                  │                     │                   │
     │                  │ 8. POST /token      │                   │
     │                  │ code=XYZ            │                   │
     │                  │ client_secret=...   │                   │
     │                  │────────────────────►│                   │
     │                  │                     │                   │
     │                  │ 9. {access_token}   │                   │
     │                  │◄────────────────────│                   │
     │                  │                     │                   │
     │                  │ 10. GET /api/user                       │
     │                  │ Bearer: token                           │
     │                  │────────────────────────────────────────►│
     │                  │                                         │
     │                  │ 11. {user data}                         │
     │                  │◄────────────────────────────────────────│
     │                  │                     │                   │
     │ 12. "Welcome,    │                     │                   │
     │     Alice!"      │                     │                   │
     │◄─────────────────│                     │                   │
```

---

## The State Parameter: CSRF Protection

The `state` parameter prevents cross-site request forgery on the
callback URL:

```
CSRF ATTACK WITHOUT STATE

  1. Attacker starts OAuth flow with their OWN GitHub account
  2. Attacker gets a callback URL:
     https://myapp.com/callback?code=ATTACKERS_CODE
  3. Attacker tricks victim into clicking this URL
  4. MyApp exchanges ATTACKER'S code for ATTACKER'S token
  5. Victim's MyApp account is now linked to ATTACKER'S GitHub!

  The attacker can now "Sign in with GitHub" to access
  the victim's MyApp account.

DEFENSE: STATE PARAMETER

  1. Before redirect, MyApp generates a random state:
     state = "a7b3c9d2e1f4" (stored in user's session)

  2. MyApp includes state in the auth URL:
     ...&state=a7b3c9d2e1f4

  3. GitHub echoes it back:
     /callback?code=XYZ&state=a7b3c9d2e1f4

  4. MyApp checks: does the returned state match what's
     in THIS user's session?
     - If yes → continue (this user started this flow)
     - If no → reject (someone injected a foreign callback)
```

```python
import secrets

def start_oauth():
    state = secrets.token_hex(16)
    session["oauth_state"] = state

    return redirect(
        f"https://github.com/login/oauth/authorize"
        f"?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&scope=read:user"
        f"&state={state}"
    )

def oauth_callback(request):
    if request.args["state"] != session.pop("oauth_state", None):
        return error(403, "Invalid state parameter — possible CSRF")

    code = request.args["code"]
    # ... exchange code for token ...
```

---

## PKCE: Protection for Public Clients

PKCE (Proof Key for Code Exchange, pronounced "pixie") solves a
problem: public clients (SPAs, mobile apps) can't keep a
client_secret. Without it, anyone who intercepts the authorization
code can exchange it for tokens.

```
THE PROBLEM PKCE SOLVES

  Without PKCE (public client, no client_secret):

  1. App redirects user to auth server
  2. User authenticates, gets code in redirect URL
  3. ATTACKER intercepts the code (malicious app, URL scheme hijack)
  4. ATTACKER exchanges code for token (no secret needed!)

  With PKCE:

  1. App generates a random CODE VERIFIER (secret)
  2. App creates a CODE CHALLENGE (hash of the verifier)
  3. App sends CODE CHALLENGE with the auth request
  4. User authenticates, gets code in redirect
  5. ATTACKER intercepts the code BUT...
  6. App sends code + CODE VERIFIER to token endpoint
  7. Auth server verifies: hash(verifier) == stored challenge
  8. ATTACKER can't exchange the code — they don't have the verifier!
```

Step by step:

```
PKCE FLOW

  Client                          Auth Server
  ──────                          ───────────

  1. Generate random code_verifier:
     "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

  2. Create code_challenge:
     SHA256(code_verifier) → Base64URL encode
     = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

  3. Authorization request includes challenge:
     /authorize?
       response_type=code
       &client_id=abc123
       &code_challenge=E9Melhoa2OwvF...
       &code_challenge_method=S256
       &redirect_uri=...
     ────────────────────────────────► Stores challenge

  4. User authenticates
     ◄──── code=AUTH_CODE_xyz

  5. Token request includes verifier:
     POST /token
       grant_type=authorization_code
       &code=AUTH_CODE_xyz
       &code_verifier=dBjftJeZ4CVP...
     ────────────────────────────────► Computes SHA256(verifier)
                                       Compares to stored challenge
                                       MATCH → issue token

  6. ◄──── {access_token: "..."}
```

```javascript
const crypto = require('crypto');

function generatePKCE() {
    const verifier = crypto.randomBytes(32)
        .toString('base64url');

    const challenge = crypto.createHash('sha256')
        .update(verifier)
        .digest('base64url');

    return { verifier, challenge };
}

const { verifier, challenge } = generatePKCE();

// Step 3: Include challenge in auth URL
const authUrl = `https://auth.example.com/authorize?` +
    `response_type=code&` +
    `client_id=${CLIENT_ID}&` +
    `code_challenge=${challenge}&` +
    `code_challenge_method=S256&` +
    `redirect_uri=${REDIRECT_URI}`;

// Step 5: Include verifier in token exchange
const tokenResponse = await fetch('https://auth.example.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        code_verifier: verifier,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID
    })
});
```

**PKCE is now recommended for ALL clients**, not just public ones.
Even confidential clients benefit from the extra protection.

---

## Complete Implementation Example

```python
import secrets
import hashlib
import base64
import requests
from flask import Flask, redirect, request, session

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

CLIENT_ID = "your_client_id"
CLIENT_SECRET = "your_client_secret"
REDIRECT_URI = "http://localhost:5000/callback"
AUTH_URL = "https://github.com/login/oauth/authorize"
TOKEN_URL = "https://github.com/login/oauth/access_token"
API_URL = "https://api.github.com"


@app.route("/login")
def login():
    state = secrets.token_hex(16)
    session["oauth_state"] = state

    verifier = secrets.token_urlsafe(32)
    session["code_verifier"] = verifier
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()

    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "read:user user:email",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return redirect(f"{AUTH_URL}?{query}")


@app.route("/callback")
def callback():
    if request.args.get("state") != session.pop("oauth_state", None):
        return "Invalid state", 403

    if "error" in request.args:
        return f"OAuth error: {request.args['error']}", 400

    code = request.args["code"]
    verifier = session.pop("code_verifier", None)

    token_response = requests.post(TOKEN_URL, data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code_verifier": verifier,
    }, headers={"Accept": "application/json"})

    tokens = token_response.json()
    access_token = tokens["access_token"]

    user_response = requests.get(f"{API_URL}/user", headers={
        "Authorization": f"Bearer {access_token}"
    })
    user = user_response.json()

    session["user"] = {"id": user["id"], "login": user["login"]}
    return redirect("/dashboard")
```

---

## Exercises

1. **Trace the flow**: Open your browser's Network tab and sign in
   to a site using "Sign in with Google/GitHub." Watch the redirects.
   Identify: the authorization request, the callback with the code,
   and (if visible) the consent screen.

2. **Build it**: Implement the authorization code flow with PKCE
   using your language of choice. Register a test OAuth app with
   GitHub (Settings → Developer Settings → OAuth Apps).

3. **State attack**: If you remove the state parameter check from
   your callback handler, demonstrate how an attacker could link
   their GitHub account to a victim's session on your site.

4. **PKCE math**: Manually create a PKCE verifier and challenge.
   Hash the verifier with SHA-256, Base64URL-encode it, and verify
   it matches your challenge. Try with a different verifier — does
   the challenge match? (It shouldn't.)

---

[Next: Lesson 09 — Other OAuth Flows](./09-oauth2-other-flows.md)
