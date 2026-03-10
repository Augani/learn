# Lesson 02: Password Authentication

> **The one thing to remember**: Password authentication is the most
> common way to prove identity online, and the most commonly broken.
> Understanding exactly how login works — from keystroke to database
> lookup — is the first step to building it securely.

---

## The Post Office Analogy

Think of password authentication like renting a PO Box:

```
PO BOX REGISTRATION

  1. You go to the post office
  2. You choose a PO Box number (username)
  3. You set a combination (password)
  4. The post office records: "Box 42 → combination 7-23-15"

PO BOX LOGIN

  1. You walk up to Box 42
  2. You enter combination 7-23-15
  3. The lock mechanism checks: does this match?
  4. If yes → box opens (access granted)
  5. If no → box stays locked (access denied)
```

The digital version works the same way, but instead of a physical
lock mechanism, the check happens on a server by comparing what you
typed against what's stored in a database.

---

## How Login Works End-to-End

Let's trace every step of a login, from the moment you click "Sign In"
to the moment you see your dashboard:

```
COMPLETE LOGIN FLOW

  Browser                    Network                   Server
  ───────                    ───────                   ──────

  1. User types email
     and password into
     the login form

  2. User clicks "Sign In"

  3. Browser builds an
     HTTP POST request:
     ┌──────────────────┐
     │ POST /api/login  │
     │ Content-Type:    │
     │  application/json│
     │                  │
     │ {"email":"alice  │
     │  @example.com",  │
     │  "password":     │
     │  "hunter42"}     │
     └────────┬─────────┘
              │
              │ HTTPS encrypts
              │ everything in
              │ transit (TLS)
              │
              ▼
     ┌──────────────────┐
     │ Encrypted packet │──────────────►  4. Server receives
     │ Nobody can read  │                    the request
     │ this in transit  │
     └──────────────────┘                 5. Server looks up
                                             alice@example.com
                                             in the database

                                          6. Server checks:
                                             does the password
                                             match the stored
                                             hash?

                                          7. If YES:
                                             - Create a session
                                             - Send session cookie

                                          8. If NO:
                                             - Return 401
                                             - Log the attempt
```

Here's what the actual HTTP request looks like:

```http
POST /api/login HTTP/1.1
Host: example.com
Content-Type: application/json
Origin: https://example.com

{
  "email": "alice@example.com",
  "password": "hunter42"
}
```

And the server's response on success:

```http
HTTP/1.1 200 OK
Set-Cookie: session=abc123def456; HttpOnly; Secure; SameSite=Strict
Content-Type: application/json

{
  "user": {
    "id": 42,
    "email": "alice@example.com",
    "name": "Alice"
  }
}
```

---

## The Server Side: What Happens on Login

Here's what a typical login handler does, step by step:

```python
def login(request):
    email = request.body["email"]
    password = request.body["password"]

    # Step 1: Find the user by email
    user = database.find_user_by_email(email)

    if user is None:
        # Don't reveal that the email doesn't exist!
        # Say "invalid credentials" — not "user not found"
        return error(401, "Invalid email or password")

    # Step 2: Check the password against the stored hash
    if not verify_password(password, user.password_hash):
        log_failed_attempt(email, request.ip)
        return error(401, "Invalid email or password")

    # Step 3: Create a session
    session_id = generate_random_token(32)  # 256 bits of randomness
    store_session(session_id, user.id, expires_in=3600)

    # Step 4: Send the session cookie
    response = success({"user": {"id": user.id, "name": user.name}})
    response.set_cookie("session", session_id,
                        httponly=True, secure=True, samesite="Strict")
    return response
```

**Critical detail**: The error message is the same whether the email
doesn't exist or the password is wrong. This is intentional. If you
say "user not found," an attacker can use your login page to discover
which emails are registered (this is called **user enumeration**).

---

## Registration: Creating the Account

Before login can work, the user must register. Registration is where
the password first gets stored:

```
REGISTRATION FLOW

  Browser                               Server
  ───────                               ──────
     │                                     │
     │  POST /api/register                 │
     │  {email, password, name}            │
     │────────────────────────────────────►│
     │                                     │
     │                              ┌──────┴──────┐
     │                              │ VALIDATE:   │
     │                              │ - Email     │
     │                              │   format?   │
     │                              │ - Password  │
     │                              │   strong    │
     │                              │   enough?   │
     │                              │ - Email     │
     │                              │   already   │
     │                              │   taken?    │
     │                              └──────┬──────┘
     │                                     │
     │                              ┌──────┴──────┐
     │                              │ HASH the    │
     │                              │ password    │
     │                              │ (NEVER store│
     │                              │ plaintext!) │
     │                              └──────┬──────┘
     │                                     │
     │                              ┌──────┴──────┐
     │                              │ INSERT INTO │
     │                              │ users:      │
     │                              │ email,      │
     │                              │ hash,       │
     │                              │ name        │
     │                              └──────┬──────┘
     │                                     │
     │  201 Created                        │
     │◄────────────────────────────────────│
```

```python
def register(request):
    email = request.body["email"]
    password = request.body["password"]
    name = request.body["name"]

    if not is_valid_email(email):
        return error(400, "Invalid email format")

    if len(password) < 12:
        return error(400, "Password must be at least 12 characters")

    if database.find_user_by_email(email):
        # Again, be careful about user enumeration
        # Some apps send a "check your email" message regardless
        return error(409, "Email already registered")

    password_hash = bcrypt.hash(password, rounds=12)

    user = database.create_user(
        email=email,
        password_hash=password_hash,
        name=name
    )

    return success({"message": "Account created"}, status=201)
```

---

## Why Plaintext Passwords Are Catastrophic

**Never, ever store passwords in plaintext**. Here's why:

```
WHAT'S IN THE DATABASE

  ❌ WRONG: Storing plaintext passwords

  users table:
  ┌────┬─────────────────────┬──────────────┐
  │ id │ email               │ password     │
  ├────┼─────────────────────┼──────────────┤
  │ 1  │ alice@example.com   │ hunter42     │
  │ 2  │ bob@example.com     │ password123  │
  │ 3  │ carol@example.com   │ ilovecats    │
  └────┴─────────────────────┴──────────────┘

  If an attacker gets this database, EVERY user's password
  is instantly compromised. They can log in as anyone.
  Since people reuse passwords, they can probably log into
  those users' bank accounts, email, and social media too.


  ✓ RIGHT: Storing hashed passwords

  users table:
  ┌────┬─────────────────────┬─────────────────────────────┐
  │ id │ email               │ password_hash               │
  ├────┼─────────────────────┼─────────────────────────────┤
  │ 1  │ alice@example.com   │ $2b$12$LJ3m4ys3Lk...       │
  │ 2  │ bob@example.com     │ $2b$12$9xKp2rQm7n...       │
  │ 3  │ carol@example.com   │ $2b$12$Wv8yTfKm2p...       │
  └────┴─────────────────────┴─────────────────────────────┘

  If an attacker gets this database, they get HASHES.
  They can't reverse a hash to get the password.
  Each password would take years to crack individually.
```

This isn't theoretical. Major companies have been caught storing
plaintext passwords:

- Facebook stored hundreds of millions of passwords in plaintext (2019)
- Adobe leaked 153 million accounts with weak encryption (2013)
- LinkedIn stored passwords with unsalted SHA-1 (2012)

When databases get breached (and they do — it's a matter of when,
not if), hashed passwords are the last line of defense.

---

## Password Strength: What Actually Matters

Password strength is about **entropy** — how many possible combinations
an attacker would need to try:

```
PASSWORD ENTROPY COMPARISON

  Password         Characters  Entropy   Time to Crack
  ──────────────   ──────────  ────────  ──────────────
  "1234"           10^4        ~13 bits  Instant
  "password"       (common)    ~0 bits   Instant (dictionary)
  "Tr0ub4dor&3"    ~70 chars   ~28 bits  Hours
  "correct horse   26^4 words  ~44 bits  Years
   battery staple"

  Entropy formula: log2(possible_combinations)
  A 4-digit PIN: log2(10^4) = 13.3 bits
  A random 4-word passphrase: log2(7776^4) = 51.7 bits
```

**The key insight**: Length beats complexity. A 20-character passphrase
made of common words is harder to crack than an 8-character password
with symbols. Attackers try dictionary words and common patterns first,
then brute-force short passwords. Long random strings or passphrases
resist both strategies.

---

## Common Attacks on Password Auth

```
ATTACK LANDSCAPE

  ┌─────────────────────┬────────────────────────────────┐
  │ Attack              │ How it works                   │
  ├─────────────────────┼────────────────────────────────┤
  │ Brute force         │ Try every possible password    │
  │ Dictionary attack   │ Try common passwords from a    │
  │                     │ wordlist                       │
  │ Credential stuffing │ Use leaked passwords from      │
  │                     │ other breaches                 │
  │ Phishing            │ Trick user into typing password│
  │                     │ on a fake site                 │
  │ Keylogger           │ Malware records keystrokes     │
  │ Shoulder surfing    │ Watch someone type their       │
  │                     │ password                       │
  └─────────────────────┴────────────────────────────────┘
```

**Credential stuffing** is especially dangerous because people reuse
passwords. If your password for a gaming forum leaks, attackers will
try that same email/password combination on banking sites, email
providers, and everything else.

---

## Defenses

```
DEFENSE LAYERS

  Attack              │ Defense
  ────────────────────┼──────────────────────────────
  Brute force         │ Rate limiting, account lockout,
                      │ CAPTCHA after N failures
  Dictionary attack   │ Require strong passwords,
                      │ check against known breached
                      │ password lists
  Credential stuffing │ Rate limiting by IP, require
                      │ MFA, notify on new device login
  Phishing            │ MFA (especially hardware keys),
                      │ user education
  Database breach     │ Hash passwords with bcrypt/argon2,
                      │ use unique salts
```

In code, rate limiting looks like this:

```python
FAILED_ATTEMPTS = {}  # In production, use Redis or similar

def check_rate_limit(email, ip_address):
    key = f"{email}:{ip_address}"
    attempts = FAILED_ATTEMPTS.get(key, {"count": 0, "first_attempt": None})

    if attempts["count"] >= 5:
        elapsed = now() - attempts["first_attempt"]
        if elapsed < timedelta(minutes=15):
            return False  # Locked out for 15 minutes
        else:
            FAILED_ATTEMPTS[key] = {"count": 0, "first_attempt": None}

    return True  # Allow attempt

def record_failed_attempt(email, ip_address):
    key = f"{email}:{ip_address}"
    attempts = FAILED_ATTEMPTS.get(key, {"count": 0, "first_attempt": None})
    if attempts["count"] == 0:
        attempts["first_attempt"] = now()
    attempts["count"] += 1
    FAILED_ATTEMPTS[key] = attempts
```

---

## Exercises

1. **Trace the flow**: Draw the complete HTTP request/response cycle
   for a failed login attempt. What status code should the server
   return? What should the error message say (and not say)?

2. **User enumeration**: Your registration endpoint returns "Email
   already registered" when someone tries to register with an existing
   email. How could an attacker exploit this? What's a better approach?

3. **Rate limiting design**: Design a rate limiting strategy that
   blocks brute force attacks but doesn't lock out legitimate users
   who just forgot their password. Consider: what key do you rate
   limit on — email, IP, or both?

4. **Password policy**: A client asks you to require passwords with
   "at least one uppercase, one lowercase, one number, one symbol."
   Explain why minimum length (12+ characters) is more important
   than character class requirements.

---

[Next: Lesson 03 — Hashing & Salting](./03-hashing-salting.md)
