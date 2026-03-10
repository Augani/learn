# Lesson 05: Token-Based Authentication

> **The one thing to remember**: Token-based authentication replaces
> server-side sessions with a self-contained token the client sends
> with every request. The server doesn't need to look anything up —
> it just validates the token. Think of it as a signed letter of
> introduction instead of a wristband the park has to check against
> a list.

---

## The Letter of Introduction Analogy

```
SESSIONS vs TOKENS

  SESSION (wristband model):
  ┌─────────────────────────────────────────────────┐
  │ Server has a LIST of valid wristband numbers.   │
  │ Every request: look up the number in the list.  │
  │ Logout: remove the number from the list.        │
  │                                                 │
  │ The wristband ITSELF has no information.        │
  │ All information is on the SERVER.               │
  └─────────────────────────────────────────────────┘

  TOKEN (letter model):
  ┌─────────────────────────────────────────────────┐
  │ The king writes a letter:                       │
  │ "Bearer of this letter is Alice, a trusted      │
  │  advisor. She may access the treasury.          │
  │  Valid until sunset."                           │
  │                                                 │
  │ Signed with the royal seal (can't be forged).   │
  │                                                 │
  │ Any guard can READ the letter and verify the    │
  │ seal. No need to check with the castle.         │
  │                                                 │
  │ The letter ITSELF contains all the information. │
  │ Nothing stored on the server.                   │
  └─────────────────────────────────────────────────┘
```

---

## How Token Auth Works

```
TOKEN AUTHENTICATION FLOW

  Browser/Client                      Server
  ──────────────                      ──────

  1. POST /login
     {email, password}
     ──────────────────────────────► 2. Verify credentials

                                     3. Create token:
                                        Encode user info + sign it
                                        (NO server-side storage needed)

  4. Receive token                 ◄── {"token": "eyJhbGciOi..."}
     Client stores it
     (localStorage, memory, etc.)

  5. GET /api/data
     Authorization: Bearer eyJhbGciOi...
     ──────────────────────────────► 6. Validate token signature
                                        Read user info FROM the token
                                        (NO database lookup needed)
                                        Return data.

  7. GET /api/other
     Authorization: Bearer eyJhbGciOi...
     ──────────────────────────────► 8. Same: validate, read, respond.
                                        Still no lookup.
```

Notice the critical difference: with sessions, step 6 requires a
database or Redis lookup. With tokens, step 6 just validates a
cryptographic signature. The user's identity is embedded in the token
itself.

---

## Bearer Tokens

The word "Bearer" in `Authorization: Bearer <token>` means: "whoever
bears (carries) this token is authorized." It's like a movie ticket —
whoever holds it gets in, regardless of who bought it.

```
HTTP HEADER FORMAT

  GET /api/users HTTP/1.1
  Host: api.example.com
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

  ┌─────────────┬────────────────────────────────────────┐
  │ Scheme      │ Token                                  │
  │ "Bearer"    │ The actual token value                 │
  └─────────────┴────────────────────────────────────────┘
```

**Important**: Because the token is all that's needed, it must be
protected like a password. If someone intercepts it, they can make
requests as that user. Always transmit tokens over HTTPS.

---

## Stateless vs Stateful Tokens

```
STATELESS TOKENS

  Token contains all necessary information.
  Server validates by checking the signature.
  Nothing stored on the server.

  ┌──────────────────────────────────┐
  │ Token payload:                   │
  │   user_id: 42                    │
  │   role: "admin"                  │
  │   exp: 1705312800                │
  │   signature: [cryptographic]     │
  └──────────────────────────────────┘

  Pros:                          Cons:
  + No database lookup           - Can't revoke individual tokens
  + Scales easily                - Token size grows with claims
  + Works across services        - Info is readable (just encoded)
  + No shared session store      - Must wait for expiration


STATEFUL TOKENS

  Token is just an opaque identifier.
  Server looks up the identifier in a store.
  Functionally identical to sessions.

  ┌──────────────────────────────────┐
  │ Token: "a8f3k2m1x9j4n7p2"       │
  │                                  │
  │ Server store:                    │
  │   "a8f3k2m1x9j4n7p2" → {        │
  │     user_id: 42,                 │
  │     role: "admin",               │
  │     expires: ...                 │
  │   }                              │
  └──────────────────────────────────┘

  Pros:                          Cons:
  + Can revoke instantly          - Requires database lookup
  + Small token size              - Need shared store for scaling
  + Information stays private     - Single point of failure
```

---

## Tokens vs Sessions: Head-to-Head

```
COMPARISON TABLE

  Feature           │ Sessions            │ Tokens (Stateless)
  ──────────────────┼─────────────────────┼──────────────────────
  Storage location  │ Server (Redis, DB)  │ Client (header)
  State             │ Stateful            │ Stateless
  Scalability       │ Need shared store   │ Any server can validate
  Revocation        │ Delete from store   │ Hard (need blocklist)
  Size              │ Small cookie        │ Larger (contains data)
  Cross-domain      │ Complicated (CORS)  │ Easy (just a header)
  Mobile-friendly   │ Cookies are awkward │ Headers work everywhere
  CSRF vulnerable?  │ Yes (cookies auto-  │ No (not auto-sent)
                    │ sent by browser)    │
  XSS vulnerable?   │ Mitigated by        │ Depends on storage
                    │ HttpOnly cookie     │ (see below)
```

---

## Where to Store Tokens on the Client

This is one of the most debated topics in web security:

```
TOKEN STORAGE OPTIONS

  ┌─────────────────┬──────────────────┬─────────────────────┐
  │ Location        │ XSS Risk         │ CSRF Risk           │
  ├─────────────────┼──────────────────┼─────────────────────┤
  │ localStorage    │ HIGH             │ None                │
  │                 │ JS can read it   │ Not auto-sent       │
  ├─────────────────┼──────────────────┼─────────────────────┤
  │ sessionStorage  │ HIGH             │ None                │
  │                 │ JS can read it   │ Not auto-sent       │
  ├─────────────────┼──────────────────┼─────────────────────┤
  │ HttpOnly Cookie │ LOW              │ Medium              │
  │                 │ JS can't read it │ Auto-sent (use      │
  │                 │                  │ SameSite to mitigate)│
  ├─────────────────┼──────────────────┼─────────────────────┤
  │ In-memory       │ LOW              │ None                │
  │ (JS variable)   │ Lost on refresh  │ Not auto-sent       │
  └─────────────────┴──────────────────┴─────────────────────┘
```

**The pragmatic answer**: For web apps, store the token in an HttpOnly
cookie. You get CSRF protection from SameSite and XSS protection from
HttpOnly. Yes, this is basically "sessions with a JWT" — and that's
often the right answer.

For mobile apps and SPAs calling APIs: store in memory and use refresh
tokens (covered in the JWT lesson) to get new access tokens.

```
RECOMMENDED PATTERN FOR WEB APPS

  Browser                              Server
  ───────                              ──────

  POST /login ────────────────────────► Verify credentials
                                        Create tokens

  ◄──── Set-Cookie: access_token=eyJ...
        HttpOnly; Secure; SameSite=Strict; Max-Age=900

  ◄──── Set-Cookie: refresh_token=eyJ...
        HttpOnly; Secure; SameSite=Strict; Path=/api/refresh

  GET /api/data
  Cookie: access_token=eyJ... ────────► Validate token from cookie
                                        Return data

  No JavaScript touches the tokens.
  No localStorage. No sessionStorage.
  Browser handles everything automatically.
```

---

## When to Use Which

```
DECISION TREE

  Is your app a traditional server-rendered website?
  └──► Use sessions + cookies. Simpler, well-understood.

  Is your app a SPA calling your own API?
  └──► Use tokens in HttpOnly cookies. Best of both worlds.

  Is your app a mobile app?
  └──► Use tokens. Store in secure storage (Keychain/Keystore).

  Are you building a public API for third parties?
  └──► Use tokens (OAuth 2.0 specifically). Standard approach.

  Do you have microservices that need to verify identity?
  └──► Use stateless tokens. Each service can validate independently.

  Do you need instant revocation (e.g., banking)?
  └──► Use short-lived tokens + refresh tokens, OR
       stateful tokens, OR tokens with a revocation list.
```

---

## Token Revocation: The Hard Problem

The biggest downside of stateless tokens: you can't "delete" them.
They're valid until they expire. If a user's token is stolen, you
can't invalidate it (unlike sessions, where you just delete the entry).

Solutions:

```
REVOCATION STRATEGIES

  1. SHORT EXPIRATION (recommended)
     Access tokens expire in 15 minutes.
     Use refresh tokens to get new access tokens.
     Even if stolen, the window is small.

  2. TOKEN BLOCKLIST
     Keep a list of revoked token IDs.
     Check the blocklist on each request.
     (This partly defeats the "stateless" advantage.)

  3. TOKEN VERSIONING
     Store a "token_version" per user in the database.
     Include version in the token.
     Increment version to invalidate all existing tokens.
     (One DB read per request, but simple.)

  ┌──────────────────────────────────────────────────────┐
  │ IN PRACTICE: Most apps use approach #1.              │
  │                                                      │
  │ Access token: 15 min lifetime, stateless             │
  │ Refresh token: 7 days, stored in DB (revocable)      │
  │                                                      │
  │ Stolen access token? Valid for max 15 minutes.       │
  │ Stolen refresh token? Revoke it immediately.         │
  └──────────────────────────────────────────────────────┘
```

---

## Code Example: Token Auth Middleware

```javascript
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, SECRET_KEY);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role
        };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Usage:
app.get('/api/profile', authMiddleware, (req, res) => {
    // req.user is populated by the middleware
    res.json({ user: req.user });
});
```

---

## Exercises

1. **Compare overhead**: Your app gets 10,000 requests per second.
   Calculate the Redis lookups needed for session-based auth vs
   token-based auth. What if Redis goes down — what happens in
   each case?

2. **Storage decision**: You're building a banking app as a SPA.
   Where would you store the authentication token? Why? What if
   it were a recipe-sharing app instead?

3. **Build token auth**: Implement a simple token system without
   using JWT libraries. Generate a random token on login, store
   it in an in-memory map, and validate it on protected routes.
   Then think about: what would you need to add to make this
   stateless?

4. **Revocation scenario**: A user reports their laptop was stolen.
   They were logged into your app. You use stateless JWTs with a
   1-hour expiration. What can you do right now? Design a system
   that would let you handle this better.

---

[Next: Lesson 06 — JWT Deep Dive](./06-jwt-deep-dive.md)
