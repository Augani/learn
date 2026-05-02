# Lesson 04: Sessions & Cookies

> **The one thing to remember**: HTTP is stateless — each request is
> independent. Sessions and cookies solve this by giving each user a
> unique token that links their requests together, like a wristband
> at a water park that proves you already paid at the gate.

---

## The Water Park Analogy

```
THE WATER PARK WRISTBAND

  1. ENTRY (Authentication)
     You show your ticket at the gate.
     Staff gives you a wristband with a unique number: #4829

  2. RIDING SLIDES (Subsequent requests)
     At every slide, you show your wristband.
     Staff checks: "Is #4829 valid? Yes. Enjoy the ride."
     You DON'T show your ticket again.

  3. LEAVING (Logout)
     You return the wristband. Number #4829 is deactivated.
     If someone finds your old wristband, it won't work.

  The wristband IS the session.
  The unique number IS the session ID.
  The staff's list of valid wristbands IS the session store.
```

Without sessions, you'd have to show your ticket (send your password)
on every single request. That would be both annoying and dangerous.

---

## How Sessions Work

```
SESSION LIFECYCLE

  Browser                          Server
  ───────                          ──────

  1. POST /login
     {email, password}
     ────────────────────────────► 2. Verify credentials

                                   3. Create session:
                                      session_store["abc123"] = {
                                        user_id: 42,
                                        created: "2024-01-15T10:30:00",
                                        expires: "2024-01-15T11:30:00"
                                      }

  4. Receive cookie              ◄─ Set-Cookie: session=abc123
     Browser stores it
     automatically

  5. GET /dashboard
     Cookie: session=abc123
     ────────────────────────────► 6. Look up "abc123" in session store
                                      Found! User is #42.
                                      Return dashboard for user #42.

  7. GET /profile
     Cookie: session=abc123
     ────────────────────────────► 8. Look up "abc123" again
                                      Still valid. Return profile.

  9. POST /logout
     Cookie: session=abc123
     ────────────────────────────► 10. Delete "abc123" from store
                                       Session is gone.

  11. GET /dashboard
      Cookie: session=abc123
      ────────────────────────────► 12. Look up "abc123"
                                        NOT FOUND. Return 401.
```

---

## Server-Side Session Stores

The server needs to store active sessions somewhere. There are
several options, each with tradeoffs:

```
SESSION STORE OPTIONS

  ┌───────────────┬────────────┬────────────┬─────────────────┐
  │ Store         │ Speed      │ Survives   │ Scales across   │
  │               │            │ restart?   │ multiple servers?│
  ├───────────────┼────────────┼────────────┼─────────────────┤
  │ In-memory     │ Fastest    │ No         │ No              │
  │ (HashMap)     │            │            │                 │
  ├───────────────┼────────────┼────────────┼─────────────────┤
  │ Redis         │ Very fast  │ Optional   │ Yes             │
  │               │            │            │                 │
  ├───────────────┼────────────┼────────────┼─────────────────┤
  │ Database      │ Slower     │ Yes        │ Yes             │
  │ (PostgreSQL)  │            │            │                 │
  ├───────────────┼────────────┼────────────┼─────────────────┤
  │ File system   │ Slow       │ Yes        │ With shared     │
  │               │            │            │ storage only    │
  └───────────────┴────────────┴────────────┴─────────────────┘

  For most production apps: Redis.
  Fast, supports expiration natively, shared across servers.
```

Session storage in Redis looks like this:

```python
import redis
import secrets
import json
from datetime import datetime, timedelta

r = redis.Redis(host='localhost', port=6379)

def create_session(user_id):
    session_id = secrets.token_hex(32)  # 256 bits of randomness
    session_data = json.dumps({
        "user_id": user_id,
        "created": datetime.utcnow().isoformat()
    })
    r.setex(
        f"session:{session_id}",
        timedelta(hours=1),  # Auto-expires after 1 hour
        session_data
    )
    return session_id

def get_session(session_id):
    data = r.get(f"session:{session_id}")
    if data is None:
        return None  # Expired or invalid
    return json.loads(data)

def destroy_session(session_id):
    r.delete(f"session:{session_id}")
```

---

## Cookies: The Delivery Mechanism

A cookie is a small piece of data the server asks the browser to store
and send back with every request. For sessions, the cookie holds the
session ID.

```
COOKIE FLOW

  Server Response:
  HTTP/1.1 200 OK
  Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict; Max-Age=3600; Path=/

  Browser stores this cookie. On EVERY subsequent request to the same
  domain, the browser automatically includes:

  GET /anything HTTP/1.1
  Cookie: session=abc123
```

### Cookie Attributes That Matter

```
COOKIE SECURITY ATTRIBUTES

  Attribute     What it does              Why it matters
  ──────────    ────────────────────────  ──────────────────────────
  HttpOnly      JavaScript can't read     Prevents XSS from stealing
                the cookie                the session ID

  Secure        Only sent over HTTPS      Prevents network sniffing
                                          of the session ID

  SameSite      Controls when cookie      Prevents CSRF attacks
                is sent cross-site

  Max-Age       Cookie expires after      Limits the window for
                N seconds                 session theft

  Path          Cookie only sent for      Limits cookie scope
                matching URL paths

  Domain        Which domains receive     Controls cookie sharing
                the cookie                across subdomains
```

Let's look at `SameSite` in detail, because it's the most confusing:

```
SAMESITE VALUES

  SameSite=Strict
  ├── Cookie ONLY sent for same-site requests
  ├── If you click a link from email to your-bank.com,
  │   the cookie is NOT sent (it's a cross-site navigation)
  └── Most secure, but can be annoying for users

  SameSite=Lax (browser default)
  ├── Cookie sent for same-site requests AND top-level navigations
  ├── Clicking a link from email → cookie IS sent
  ├── Form POST from evil-site.com → cookie is NOT sent
  └── Good balance of security and usability

  SameSite=None
  ├── Cookie sent on ALL requests, even cross-site
  ├── MUST also set Secure flag
  └── Only use for legitimate cross-site scenarios (embedded widgets)
```

The recommended session cookie:

```python
response.set_cookie(
    "session",
    session_id,
    httponly=True,      # No JavaScript access
    secure=True,        # HTTPS only
    samesite="Lax",     # Prevent most CSRF
    max_age=3600,       # 1 hour
    path="/",           # All paths
)
```

---

## Session Hijacking

If an attacker gets your session ID, they become you. No password
needed — the server just sees a valid session.

```
SESSION HIJACKING METHODS

  1. NETWORK SNIFFING (solved by HTTPS + Secure flag)
     ┌──────┐      ┌──────────┐      ┌──────┐
     │ User │─────►│ Attacker │─────►│Server│
     └──────┘      │ reads    │      └──────┘
                   │ session  │
                   │ cookie   │
                   └──────────┘

  2. CROSS-SITE SCRIPTING (XSS) (mitigated by HttpOnly)
     Attacker injects JavaScript: document.cookie
     If HttpOnly is set, JavaScript CAN'T read the cookie.

  3. MALWARE / BROWSER EXTENSION
     Malicious software on the user's machine reads cookies
     directly. Hard to prevent at the application level.

  4. PHYSICAL ACCESS
     Someone opens the browser and copies cookies from
     the developer tools. Lock your computer.
```

Defenses beyond cookie flags:

```python
def validate_session(session_id, request):
    session = get_session(session_id)
    if session is None:
        return None

    # Check if the IP address changed (optional, can break mobile users)
    if session.get("ip") != request.remote_addr:
        destroy_session(session_id)
        return None

    # Check if the user agent changed
    if session.get("user_agent") != request.headers.get("User-Agent"):
        destroy_session(session_id)
        return None

    # Rotate session ID periodically to limit hijacking window
    if session_age(session) > timedelta(minutes=15):
        new_session_id = rotate_session(session_id, session)
        return session, new_session_id

    return session, None
```

---

## Session Fixation

A different attack: instead of stealing your session, the attacker
*gives* you a session they already know:

```
SESSION FIXATION ATTACK

  1. Attacker visits the site, gets session ID "evil789"

  2. Attacker sends victim a link:
     https://bank.com/login?session=evil789

  3. Victim clicks the link and logs in.
     The server associates "evil789" with the victim's account.

  4. Attacker already knows session "evil789"
     → Attacker is now logged in as the victim!

DEFENSE: Always create a NEW session ID after login.
         Never reuse a pre-authentication session for
         a post-authentication session.
```

```python
def login(request):
    # ... verify credentials ...

    # CRITICAL: Destroy old session and create a new one
    old_session_id = request.cookies.get("session")
    if old_session_id:
        destroy_session(old_session_id)

    # Create a completely new session ID
    new_session_id = create_session(user.id)
    response.set_cookie("session", new_session_id, ...)
```

This is called **session regeneration** and it's one of the most
important defenses in session management.

---

## Session Best Practices

```
SESSION SECURITY CHECKLIST

  ✓ Generate session IDs with a CSPRNG (cryptographically secure
    pseudorandom number generator) — at least 128 bits of entropy

  ✓ Set HttpOnly, Secure, and SameSite on session cookies

  ✓ Regenerate the session ID after login (prevent fixation)

  ✓ Set reasonable expiration (1 hour for sensitive apps,
    24 hours for low-risk apps)

  ✓ Implement absolute timeout (max session lifetime regardless
    of activity) AND idle timeout (expires after inactivity)

  ✓ Destroy session on logout (don't just clear the cookie —
    delete from the server-side store)

  ✓ Store sessions server-side (Redis, database) — not in the
    cookie itself (unless using signed/encrypted JWT, covered later)

  ✓ Log session creation and destruction for audit trails
```

```
SESSION TIMEOUT TYPES

  ┌──────────────────────────────────────────────────────────┐
  │ Time ───────────────────────────────────────────────►    │
  │                                                          │
  │ Login        Activity     Activity      Idle      Expire │
  │  │              │            │         timeout      │    │
  │  ▼              ▼            ▼           │          ▼    │
  │  ├──────────────┼────────────┼───────────┤               │
  │  │   active     │   active   │  inactive │  expired      │
  │  │              │            │           │               │
  │  │◄─────────── Absolute timeout ─────────┤               │
  │  │              │            │           │               │
  │  │              │◄── Idle ──►│◄── Idle ──►               │
  │  │              │  resets    │  expires!  │               │
  │  │              │  on use    │            │               │
  └──────────────────────────────────────────────────────────┘

  Idle timeout: expires after period of inactivity (e.g., 15 min)
  Absolute timeout: expires regardless (e.g., 8 hours)

  A banking app might use: idle=5min, absolute=30min
  A social media app might use: idle=24h, absolute=30days
```

---

## Exercises

1. **Build it**: Implement a simple session system using your
   language of choice and an in-memory dictionary. Create
   endpoints for login, logout, and a protected route that
   requires a valid session. Test with curl.

2. **Cookie inspection**: Open your browser's developer tools,
   go to any website you're logged into, and examine the cookies.
   Which ones have HttpOnly? Secure? What SameSite values do
   they use? (Application tab → Cookies in Chrome DevTools)

3. **Session fixation**: Your web framework accepts session IDs
   from URL parameters (like `?session=abc`). Explain step by step
   how an attacker would exploit this. What's the fix?

4. **Scaling sessions**: Your app runs on 4 servers behind a load
   balancer. Users keep getting logged out randomly. Why? What are
   two different ways to fix this? (Hint: think about where sessions
   are stored and where requests go.)

---

[Next: Lesson 05 — Token Authentication](./05-token-auth.md)
