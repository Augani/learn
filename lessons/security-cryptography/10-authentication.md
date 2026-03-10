# Authentication

## Getting Into the VIP Club

Authentication is like getting into a VIP club. You need to prove you're on the list before anyone lets you in. The bouncer doesn't care what you can do inside — that's authorization (lesson 11). Authentication is simply answering one question: **who are you?**

There are three ways to prove identity:
- **Something you know** — a password, a PIN
- **Something you have** — a phone, a security key, a smart card
- **Something you are** — a fingerprint, a face scan

The history of web authentication is a story of each method's weaknesses driving adoption of the next.

---

## Password-Based Authentication

### How It Works

1. User registers with a username and password
2. Server stores a hash of the password (lesson 14)
3. On login, user sends username + password
4. Server hashes the provided password, compares with stored hash
5. If they match, the user is authenticated

### The Problems

**Password reuse:** The average person has 100+ online accounts and reuses passwords across them. When one site gets breached, attackers try those credentials everywhere else. This is credential stuffing, and it works on roughly 0.1-2% of attempts — enough to compromise millions of accounts.

**Phishing:** Create a convincing fake login page, send the link, harvest credentials. Google found that phishing is the number one cause of account takeovers.

**Database breaches:** Even with proper hashing, weak passwords can be cracked. The 2012 LinkedIn breach exposed 117 million password hashes. Because they used unsalted SHA-1, most were cracked within days.

**Brute force:** Without rate limiting, attackers can try thousands of passwords per second against a login endpoint.

Despite all this, passwords remain the dominant authentication method because they're simple, free, and universally understood.

---

## Session-Based Authentication

After a user proves their identity with a password, you don't want them re-entering it on every page load. Session-based auth solves this with a wristband system.

### How It Works (The Wristband Analogy)

1. You show your ID at the door (login with password)
2. The bouncer gives you a wristband (session cookie)
3. For the rest of the night, you just show the wristband (cookie sent automatically)
4. The wristband has a number that maps to your entry in the guest list (server-side session store)
5. When you leave (logout), the wristband is destroyed

### The Flow

```
Client                          Server
  |                               |
  |-- POST /login (credentials) ->|
  |                               | Verify password
  |                               | Create session {id: "abc", user: 42, role: "admin"}
  |                               | Store in session store (Redis/DB)
  |<- Set-Cookie: sid=abc --------|
  |                               |
  |-- GET /dashboard              |
  |   Cookie: sid=abc ----------->|
  |                               | Look up session "abc"
  |                               | Found: user 42, admin
  |<- 200 OK (dashboard HTML) ---|
  |                               |
  |-- POST /logout                |
  |   Cookie: sid=abc ----------->|
  |                               | Delete session "abc"
  |<- Set-Cookie: sid=; expired --|
```

### Session Attacks

**Session Fixation:**

The attacker sets the victim's session ID before they log in:

1. Attacker visits the site, gets session ID `evil123`
2. Attacker tricks victim into using `evil123` (via URL parameter or injecting cookie)
3. Victim logs in with session `evil123`
4. Now the attacker knows the session ID of an authenticated user

**Defense:** Always regenerate the session ID after successful login.

**Session Hijacking:**

Stealing an existing session cookie through:
- XSS (inject script that reads `document.cookie`)
- Network sniffing (if not using HTTPS)
- Access to the user's machine

**Defense:** HttpOnly cookies (can't read from JS), Secure flag (HTTPS only), short expiry.

### Implementation in Go (gorilla/sessions)

```go
package main

import (
    "encoding/gob"
    "net/http"
    "os"

    "github.com/gorilla/sessions"
)

type SessionData struct {
    UserID int
    Role   string
}

func init() {
    gob.Register(SessionData{})
}

var store = sessions.NewCookieStore([]byte(os.Getenv("SESSION_SECRET")))

func init() {
    store.Options = &sessions.Options{
        Path:     "/",
        MaxAge:   3600,
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteStrictMode,
    }
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    username := r.FormValue("username")
    password := r.FormValue("password")

    user, err := authenticateUser(username, password)
    if err != nil {
        http.Error(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }

    session, err := store.Get(r, "app-session")
    if err != nil {
        http.Error(w, "Session error", http.StatusInternalServerError)
        return
    }

    session.Values["data"] = SessionData{
        UserID: user.ID,
        Role:   user.Role,
    }

    if err := session.Save(r, w); err != nil {
        http.Error(w, "Failed to save session", http.StatusInternalServerError)
        return
    }

    http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
}

func requireAuth(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        session, err := store.Get(r, "app-session")
        if err != nil {
            http.Error(w, "Session error", http.StatusInternalServerError)
            return
        }

        data, ok := session.Values["data"].(SessionData)
        if !ok || data.UserID == 0 {
            http.Redirect(w, r, "/login", http.StatusSeeOther)
            return
        }

        next.ServeHTTP(w, r)
    }
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
    session, err := store.Get(r, "app-session")
    if err != nil {
        http.Error(w, "Session error", http.StatusInternalServerError)
        return
    }

    session.Options.MaxAge = -1
    session.Values = make(map[interface{}]interface{})

    if err := session.Save(r, w); err != nil {
        http.Error(w, "Failed to destroy session", http.StatusInternalServerError)
        return
    }

    http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func dashboardHandler(w http.ResponseWriter, r *http.Request) {
    session, _ := store.Get(r, "app-session")
    data := session.Values["data"].(SessionData)
    w.Write([]byte("Welcome, user " + string(rune(data.UserID))))
}

func main() {
    http.HandleFunc("/login", loginHandler)
    http.HandleFunc("/logout", logoutHandler)
    http.HandleFunc("/dashboard", requireAuth(dashboardHandler))
    http.ListenAndServeTLS(":443", "cert.pem", "key.pem", nil)
}
```

### Implementation in TypeScript (express-session)

```typescript
import express from "express";
import session from "express-session";
import RedisStore from "connect-redis";
import { createClient } from "redis";
import bcrypt from "bcryptjs";

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect();

const app = express();
app.use(express.urlencoded({ extended: false }));

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
  }
}

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "strict",
      maxAge: 3600000,
    },
  })
);

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const user = await findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: "Session error" });
    }

    req.session.userId = user.id;
    req.session.role = user.role;

    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: "Session save error" });
      }
      res.redirect("/dashboard");
    });
  });
});

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  next();
}

app.get("/dashboard", requireAuth, (req, res) => {
  res.send(`Welcome, user ${req.session.userId}`);
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});
```

Notice `session.regenerate()` after login — this prevents session fixation by creating a new session ID.

---

## Token-Based Authentication (JWT Preview)

Sessions require server-side storage. Every request means a database or Redis lookup. JWTs (JSON Web Tokens) offer a stateless alternative — the token itself contains all the information.

Think of it like a conference badge. The badge has your name, company, and access level printed on it. A holographic sticker proves it hasn't been forged. Anyone can read the badge without checking a central database.

The full JWT deep dive is in lesson 12. The key tradeoff:

| | Sessions | JWTs |
|---|---------|------|
| Storage | Server-side | Client-side |
| Revocation | Delete from store | Wait for expiry (or maintain blocklist) |
| Scalability | Requires shared session store | Stateless, any server can verify |
| Size | Small cookie (~32 bytes) | Larger token (~300+ bytes) |

---

## Multi-Factor Authentication (MFA)

MFA requires two or more authentication factors. Even if an attacker steals your password, they need your phone (or fingerprint, or security key) too.

### TOTP: How Google Authenticator Works

TOTP (Time-based One-Time Password) is the system behind Google Authenticator, Authy, and similar apps.

**The setup:**

1. Server generates a random secret key (usually 160 bits, base32 encoded)
2. Server displays it as a QR code
3. User scans with authenticator app
4. Both server and app now share the same secret

**Generating a code:**

```
code = HMAC-SHA1(secret, floor(current_unix_time / 30))
```

Then take the last 4 bits of the hash as an offset, extract 4 bytes at that offset, and take modulo 1,000,000 to get a 6-digit code.

The math in plain English:
1. Take the current time, divide by 30 (new code every 30 seconds)
2. HMAC that time value with the shared secret
3. Extract a 6-digit number from the result

Both the server and your phone compute the same code because they share the same secret and (roughly) the same clock. The server accepts the current code plus the previous and next codes to handle clock drift.

**Go TOTP Verification:**

```go
package auth

import (
    "crypto/hmac"
    "crypto/sha1"
    "encoding/binary"
    "math"
    "time"
)

func GenerateTOTP(secret []byte, t time.Time) uint32 {
    counter := uint64(t.Unix()) / 30

    buf := make([]byte, 8)
    binary.BigEndian.PutUint64(buf, counter)

    mac := hmac.New(sha1.New, secret)
    mac.Write(buf)
    hash := mac.Sum(nil)

    offset := hash[len(hash)-1] & 0x0f
    truncated := binary.BigEndian.Uint32(hash[offset:offset+4]) & 0x7fffffff

    return truncated % uint32(math.Pow10(6))
}

func VerifyTOTP(secret []byte, code uint32) bool {
    now := time.Now()

    for _, offset := range []int{-1, 0, 1} {
        t := now.Add(time.Duration(offset) * 30 * time.Second)
        if GenerateTOTP(secret, t) == code {
            return true
        }
    }

    return false
}
```

**TypeScript TOTP Verification:**

```typescript
import crypto from "crypto";

function generateTOTP(secret: Buffer, time: Date): number {
  const counter = Math.floor(time.getTime() / 1000 / 30);

  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", secret);
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const truncated =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return truncated % 1000000;
}

function verifyTOTP(secret: Buffer, code: number): boolean {
  const now = new Date();

  for (const offset of [-1, 0, 1]) {
    const time = new Date(now.getTime() + offset * 30 * 1000);
    if (generateTOTP(secret, time) === code) {
      return true;
    }
  }

  return false;
}
```

### Security Considerations for TOTP

- Store recovery codes (one-time use) in case the user loses their device
- Rate limit TOTP verification (only 1,000,000 possible codes)
- Use constant-time comparison to prevent timing attacks
- The shared secret must be stored securely on the server (encrypted at rest)

---

## WebAuthn / Passkeys (The Future)

WebAuthn (Web Authentication API) uses public key cryptography to authenticate users. No shared secrets. No passwords to steal or phish.

### How It Works

1. **Registration:**
   - Server sends a challenge (random bytes)
   - Browser asks the authenticator (security key, fingerprint sensor, phone) to generate a key pair
   - The private key stays on the device, never leaves
   - The public key is sent to the server

2. **Authentication:**
   - Server sends a challenge
   - Browser asks the authenticator to sign the challenge with the private key
   - Server verifies the signature with the stored public key

**Why this is better than passwords:**

- Nothing to phish — the private key is bound to the origin (domain). A fake login page on `evii.com` can't request a signature for `evil.com` can't impersonate `bank.com`
- Nothing to steal from the server — public keys are, well, public
- Nothing to reuse — each site gets a unique key pair
- Resistant to brute force — you can't guess a private key

**Passkeys** are the consumer-friendly evolution of WebAuthn. They sync across devices via iCloud Keychain (Apple), Google Password Manager, or Windows Hello. The user experience: tap to log in, authenticate with biometric. No password, no codes.

### The Adoption Challenge

WebAuthn/passkeys are technically superior to every other method. Adoption is growing but not universal. For now, most applications should support passkeys as an option alongside traditional methods, with passwords + TOTP as the fallback.

---

## OAuth 2.0 (Delegated Authentication)

OAuth 2.0 is how "Login with Google" works. It's delegated authentication — you're outsourcing the identity verification to a provider the user already trusts.

### The Apartment Buzzer Analogy

Imagine you're visiting a friend's apartment building:
1. You press the buzzer (click "Login with Google")
2. Your friend (Google) asks "Do you know this person?" over the intercom
3. You prove your identity to your friend (enter Google password + MFA)
4. Your friend buzzes you in (Google redirects back with an authorization code)
5. The building (your app) now knows you're legitimate because your friend vouched for you

### The OAuth 2.0 Authorization Code Flow

```
User        Your App        Google
 |              |              |
 |-- Click "Login with Google" |
 |              |              |
 |<-- Redirect to Google ------|
 |              |              |
 |-- Login at Google --------->|
 |              |              |
 |<-- Redirect back with code -|
 |              |              |
 |-- Send code to Your App --->|
 |              |              |
 |              |-- Exchange code for tokens -->|
 |              |<-- Access token + ID token ---|
 |              |              |
 |              |-- GET /userinfo (access token) -->|
 |              |<-- User profile data -------------|
 |              |              |
 |<-- Logged in! --------------|
```

The critical security property: the access token is exchanged server-to-server. The user's browser never sees it. More on OAuth 2.0 in lesson 11 (authorization code flow + PKCE).

---

## Choosing an Authentication Strategy

| Application Type | Recommended Approach |
|-----------------|---------------------|
| Traditional web app (server-rendered) | Sessions + CSRF tokens |
| SPA + API backend | OAuth 2.0 / JWT (with refresh tokens in HttpOnly cookies) |
| Mobile app | OAuth 2.0 + PKCE |
| Microservice-to-microservice | Mutual TLS or JWT |
| High-security (banking, health) | Passkeys or FIDO2 + MFA mandatory |

### The Defense Layers

1. **Strong passwords** — minimum 12 characters, check against breached lists
2. **Proper storage** — bcrypt/Argon2id (lesson 14)
3. **Secure sessions** — HttpOnly, Secure, SameSite cookies
4. **MFA** — TOTP at minimum, passkeys preferred
5. **Rate limiting** — prevent brute force
6. **Monitoring** — alert on unusual login patterns (new device, new location, rapid failures)

Authentication is the front door to your application. A steel door doesn't help if the frame is made of cardboard. Every layer matters.
