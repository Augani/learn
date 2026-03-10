# Lesson 09: Other OAuth 2.0 Flows

> **The one thing to remember**: Different situations call for
> different OAuth flows. Server-to-server uses client credentials.
> Smart TVs use device authorization. The implicit flow is deprecated
> because it was never really secure. Pick the flow that matches your
> client type and environment.

---

## Client Credentials Flow

This flow is for **machine-to-machine** communication where no user
is involved. Your backend server needs to talk to another service's API.

```
REAL-WORLD ANALOGY

  Think of it like a business-to-business transaction.

  Your company (the client) has an account with a supplier (API).
  When your ordering system calls the supplier's system, no human
  is involved. The systems authenticate with each other using
  pre-shared credentials (like a business account number).
```

```
CLIENT CREDENTIALS FLOW

  Your Server                    Auth Server
  (Client)                       ───────────
     │
     │  POST /token
     │  grant_type=client_credentials
     │  &client_id=your_app_id
     │  &client_secret=your_app_secret
     │  &scope=read:analytics
     │──────────────────────────────────►│
     │                                   │
     │  {                                │
     │    "access_token": "eyJ...",      │
     │    "token_type": "bearer",        │
     │    "expires_in": 3600             │
     │  }                                │
     │◄──────────────────────────────────│
     │
     │  GET /api/analytics
     │  Authorization: Bearer eyJ...
     │──────────────────────────────────────────► Resource Server
     │
     │  { analytics data }
     │◄──────────────────────────────────────────
```

Notice what's missing: no redirect, no user login, no consent screen.
The client authenticates directly with its own credentials.

```python
import requests

def get_api_token():
    response = requests.post("https://auth.example.com/token", data={
        "grant_type": "client_credentials",
        "client_id": "my_service_id",
        "client_secret": "my_service_secret",
        "scope": "read:analytics"
    })
    return response.json()["access_token"]

def fetch_analytics():
    token = get_api_token()
    response = requests.get(
        "https://api.example.com/analytics",
        headers={"Authorization": f"Bearer {token}"}
    )
    return response.json()
```

**When to use**: Cron jobs, microservice-to-microservice calls,
backend data synchronization, CI/CD pipelines accessing APIs.

**When NOT to use**: Anything involving a user. This flow has no
concept of "acting on behalf of a user."

---

## Device Authorization Flow

How does a smart TV, game console, or CLI tool authenticate when
there's no browser or it's impractical to type on the device?

```
REAL-WORLD ANALOGY

  Think of signing into Netflix on your smart TV.

  The TV shows a code: "Go to netflix.com/activate and enter: ABCD-1234"
  You grab your phone, go to the URL, enter the code, and log in.
  The TV detects you've authorized it and starts working.
```

```
DEVICE AUTHORIZATION FLOW

  Device              Auth Server            User's Phone/Computer
  (Smart TV)          ───────────            ─────────────────────
     │                     │                        │
     │ 1. POST /device/code                         │
     │ client_id=tv_app                              │
     │────────────────────►│                        │
     │                     │                        │
     │ {                   │                        │
     │   "device_code":    │                        │
     │     "GmRhmhcxhZz",│                        │
     │   "user_code":      │                        │
     │     "WDJB-MJHT",   │                        │
     │   "verification_uri":                        │
     │     "https://auth   │                        │
     │     .example.com    │                        │
     │     /device",       │                        │
     │   "interval": 5     │                        │
     │ }                   │                        │
     │◄────────────────────│                        │
     │                     │                        │
     │ 2. Display to user: │                        │
     │ ┌──────────────────┐│                        │
     │ │ Go to:           ││                        │
     │ │ auth.example.com ││                        │
     │ │ /device          ││                        │
     │ │                  ││                        │
     │ │ Enter code:      ││                        │
     │ │ WDJB-MJHT       ││                        │
     │ └──────────────────┘│                        │
     │                     │                        │
     │                     │  3. User visits URL    │
     │                     │  and enters code       │
     │                     │◄───────────────────────│
     │                     │                        │
     │                     │  4. User logs in       │
     │                     │  and approves          │
     │                     │◄───────────────────────│
     │                     │                        │
     │ 5. Poll: POST /token│                        │
     │ grant_type=          │                        │
     │  urn:ietf:params:   │                        │
     │  oauth:grant-type:  │                        │
     │  device_code        │                        │
     │ device_code=GmRhm  │                        │
     │────────────────────►│                        │
     │                     │                        │
     │ (If user hasn't     │                        │
     │  approved yet:)     │                        │
     │ {"error":           │                        │
     │  "authorization_    │                        │
     │   pending"}         │                        │
     │◄────────────────────│                        │
     │                     │                        │
     │ ... wait 5 seconds, poll again ...           │
     │                     │                        │
     │ (After user approves:)                       │
     │ {                   │                        │
     │   "access_token":   │                        │
     │     "eyJ...",       │                        │
     │   "refresh_token":  │                        │
     │     "dGhpcyBp..."   │                        │
     │ }                   │                        │
     │◄────────────────────│                        │
```

```python
import time
import requests

def device_auth_flow():
    device_response = requests.post(
        "https://auth.example.com/device/code",
        data={
            "client_id": "tv_app_id",
            "scope": "read:content"
        }
    ).json()

    print(f"Go to: {device_response['verification_uri']}")
    print(f"Enter code: {device_response['user_code']}")

    interval = device_response["interval"]
    device_code = device_response["device_code"]

    while True:
        time.sleep(interval)

        token_response = requests.post(
            "https://auth.example.com/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": device_code,
                "client_id": "tv_app_id"
            }
        ).json()

        if "access_token" in token_response:
            return token_response["access_token"]

        if token_response.get("error") == "authorization_pending":
            continue
        elif token_response.get("error") == "slow_down":
            interval += 5
            continue
        elif token_response.get("error") == "expired_token":
            raise TimeoutError("User did not authorize in time")
        else:
            raise RuntimeError(f"Error: {token_response['error']}")
```

**When to use**: Smart TVs, game consoles, printers, CLI tools,
IoT devices — anything without a good browser or keyboard.

---

## Implicit Flow (Deprecated)

The implicit flow was designed for SPAs before PKCE existed. It
returned the access token directly in the redirect URL. This was
always a security compromise:

```
IMPLICIT FLOW (DON'T USE THIS)

  Browser                    Auth Server
  ───────                    ───────────
     │                           │
     │ GET /authorize            │
     │ response_type=token       │  ← "token" instead of "code"
     │──────────────────────────►│
     │                           │
     │ User logs in + consents   │
     │                           │
     │ 302 Redirect:             │
     │ myapp.com/callback        │
     │ #access_token=eyJ...      │  ← Token in URL fragment!
     │◄──────────────────────────│
     │                           │
     │ JavaScript reads the      │
     │ token from the URL hash   │

  PROBLEMS:
  1. Token is in the URL → visible in browser history
  2. Token in URL → can leak via Referer header
  3. No refresh tokens (spec forbids it for implicit)
  4. No way to verify token came from legitimate request
  5. Vulnerable to token injection attacks
```

**The fix**: Use authorization code flow with PKCE instead. It works
perfectly for SPAs and solves all the implicit flow's problems.

```
IMPLICIT vs AUTHORIZATION CODE + PKCE

  Implicit (deprecated):
  Browser ──► Auth Server ──► #token in URL ──► Browser reads it

  Auth Code + PKCE (recommended):
  Browser ──► Auth Server ──► ?code in URL ──► Browser exchanges
  code for token using PKCE verifier. Token never touches the URL.
```

---

## Choosing the Right Flow

```
DECISION TREE

  Is a user involved?
  ├── NO → Client Credentials
  │        (machine-to-machine)
  │
  └── YES → Does the device have a browser?
             ├── NO → Device Authorization Flow
             │        (smart TV, CLI, IoT)
             │
             └── YES → Authorization Code + PKCE
                        (web apps, SPAs, mobile apps)
                        │
                        Is it a confidential client?
                        ├── YES → Also send client_secret
                        │         in token exchange
                        └── NO → PKCE alone is sufficient
```

```
FLOW COMPARISON TABLE

  ┌────────────────┬──────────┬────────────┬──────────────┬──────────┐
  │ Feature        │ Auth Code│ Client     │ Device Auth  │ Implicit │
  │                │ + PKCE   │ Credentials│              │(obsolete)│
  ├────────────────┼──────────┼────────────┼──────────────┼──────────┤
  │ User involved  │ Yes      │ No         │ Yes          │ Yes      │
  │ Browser needed │ Yes      │ No         │ No (on device│ Yes      │
  │                │          │            │  but yes on  │          │
  │                │          │            │  phone)      │          │
  │ Refresh tokens │ Yes      │ Usually no │ Yes          │ No       │
  │ Client secret  │ Optional │ Required   │ Optional     │ No       │
  │ Back-channel   │ Yes      │ Yes        │ Yes (polling)│ No       │
  │ token exchange │          │            │              │          │
  │ Security       │ High     │ High       │ Medium       │ Low      │
  └────────────────┴──────────┴────────────┴──────────────┴──────────┘
```

---

## Resource Owner Password Grant (Deprecated)

For completeness: this flow lets the client collect the user's
username and password directly and exchange them for a token.

```
RESOURCE OWNER PASSWORD GRANT (DON'T USE)

  POST /token
  grant_type=password
  &username=alice@example.com
  &password=hunter42
  &client_id=my_app

  WHY IT EXISTS: For migrating legacy apps that already
  collect passwords to OAuth 2.0 infrastructure.

  WHY IT'S BAD:
  - Client gets the user's password (defeats OAuth's purpose)
  - No consent screen — user can't limit scope
  - Encourages password collection by third parties
  - Breaks for any system using MFA

  USE INSTEAD: Authorization code flow with PKCE.
```

---

## Practical Patterns

### Caching Client Credentials Tokens

Don't request a new token for every API call:

```python
import time
import threading

class TokenCache:
    def __init__(self, client_id, client_secret, token_url):
        self._client_id = client_id
        self._client_secret = client_secret
        self._token_url = token_url
        self._token = None
        self._expires_at = 0
        self._lock = threading.Lock()

    def get_token(self):
        with self._lock:
            if self._token and time.time() < self._expires_at - 60:
                return self._token

            response = requests.post(self._token_url, data={
                "grant_type": "client_credentials",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
            }).json()

            self._token = response["access_token"]
            self._expires_at = time.time() + response["expires_in"]
            return self._token
```

### Handling Device Flow Timeout Gracefully

```python
MAX_WAIT_SECONDS = 300

def device_flow_with_timeout():
    start = time.time()

    # ... get device code ...

    while time.time() - start < MAX_WAIT_SECONDS:
        time.sleep(interval)
        result = poll_for_token(device_code)

        if result.get("access_token"):
            return result["access_token"]
        if result.get("error") == "authorization_pending":
            elapsed = int(time.time() - start)
            print(f"Waiting for authorization... ({elapsed}s)")
            continue
        if result.get("error") == "expired_token":
            break

    print("Authorization timed out. Please try again.")
    return None
```

---

## Exercises

1. **Client credentials**: Register an OAuth app with a service
   (GitHub, Auth0, or any provider). Use the client credentials
   flow to get a token and make an API call. No browser involved.

2. **Device flow simulation**: Implement the device authorization
   flow. For testing, you can use GitHub's device flow (docs at
   docs.github.com). Watch the polling mechanism in action.

3. **Flow matching**: For each scenario, choose the correct flow:
   - A weather API called by your backend cron job
   - A Roku streaming app signing into a user's account
   - A React app letting users connect their Spotify
   - A Python script deploying to a cloud provider
   - A CLI tool for managing a SaaS platform

4. **Migration plan**: You have a legacy app that collects usernames
   and passwords to call an API (resource owner password grant).
   Design a step-by-step plan to migrate to authorization code flow
   without disrupting existing users.

---

[Next: Lesson 10 — OpenID Connect](./10-oidc.md)
