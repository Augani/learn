# Lesson 03: Hashing & Salting

> **The one thing to remember**: A hash function turns a password into
> a fixed-length string that can't be reversed. Salting adds random
> data before hashing so that two users with the same password get
> different hashes. Use bcrypt, scrypt, or argon2 — never MD5 or SHA
> for passwords.

---

## The Meat Grinder Analogy

A hash function is like a meat grinder:

```
THE MEAT GRINDER

  Steak ──► [GRINDER] ──► Ground beef

  Properties:
  1. ONE-WAY: You can't turn ground beef back into a steak
  2. DETERMINISTIC: Same steak always produces the same output
  3. SMALL CHANGES, BIG DIFFERENCES: A slightly different steak
     produces completely different ground beef
  4. FIXED OUTPUT SIZE: Whether you feed in a chicken or a whole
     cow, you get the same size output container
```

In the digital world:

```
HASH FUNCTION IN ACTION

  "password123"  ──► SHA-256 ──► ef92b778bafe771e89245b89ecbc08a44a4e166c...
  "password124"  ──► SHA-256 ──► 5765cb37b7fdc45343e6dab0e35c0e2e37d7bbee...
  "password123"  ──► SHA-256 ──► ef92b778bafe771e89245b89ecbc08a44a4e166c...
                                 ▲ Same input always = same output

  Changing ONE CHARACTER produces a completely different hash.
  There's no way to go from the hash back to the password.
```

---

## Why Plain Hashing Isn't Enough

If we just hash passwords and store them, we have a problem:

```
PLAIN HASHING PROBLEM

  users table:
  ┌─────────┬──────────────────────────────────┐
  │ email   │ password_hash                    │
  ├─────────┼──────────────────────────────────┤
  │ alice   │ ef92b778bafe771e89245b89ecbc08a4 │  ◄─ Same
  │ bob     │ ef92b778bafe771e89245b89ecbc08a4 │  ◄─ hash!
  │ carol   │ 5765cb37b7fdc45343e6dab0e35c0e2e │
  └─────────┴──────────────────────────────────┘

  Alice and Bob have the same hash → they have the same password!
  An attacker who cracks one automatically gets both.
```

This also enables **rainbow table attacks**: precomputed tables mapping
common passwords to their hashes.

```
RAINBOW TABLE (simplified)

  ┌────────────────┬──────────────────────────────────┐
  │ Password       │ SHA-256 Hash                     │
  ├────────────────┼──────────────────────────────────┤
  │ password       │ 5e884898da28047151d0e56f8dc6292... │
  │ password123    │ ef92b778bafe771e89245b89ecbc08a... │
  │ 123456         │ 8d969eef6ecad3c29a3a629280e686c... │
  │ letmein        │ 1c8bfe8f801d79745c4631d09fff36c... │
  │ ... millions   │ ... precomputed ...               │
  │ more           │                                   │
  └────────────────┴──────────────────────────────────┘

  An attacker with this table can instantly look up any hash
  and find the password. No cracking needed.
```

Rainbow tables for SHA-256 of common passwords fit on a USB drive.
An attacker doesn't need to crack anything — they just look it up.

---

## Salting: The Fix

A **salt** is a random string added to the password before hashing:

```
SALTING

  Without salt:
    hash("password123") → ef92b778...

  With salt:
    hash("a9f3k2m1" + "password123") → 7b2f19c4...
    hash("x8j4n7p2" + "password123") → d1e5a3b8...
         ▲ different salt                ▲ different hash!

  Same password, different salts → different hashes.
  Rainbow tables are now USELESS because every password
  has a unique salt.
```

Each user gets their own random salt, stored alongside the hash:

```
SALTED PASSWORD STORAGE

  users table:
  ┌─────────┬──────────┬──────────────────────────────────┐
  │ email   │ salt     │ password_hash                    │
  ├─────────┼──────────┼──────────────────────────────────┤
  │ alice   │ a9f3k2m1 │ 7b2f19c4e8a1d3b5f6c7e9a2d4b8f1 │
  │ bob     │ x8j4n7p2 │ d1e5a3b8c2f4e6a7b9d1c3e5f7a8b2 │
  │ carol   │ m2p5r8t1 │ 3c7f2a9e1d5b8c4f6e2a7d3b9f1c5 │
  └─────────┴──────────┴──────────────────────────────────┘

  Even if Alice and Bob have the same password,
  their hashes are completely different.
  An attacker would need a separate rainbow table
  for EVERY salt — which defeats the purpose of
  rainbow tables entirely.
```

**The salt is not secret**. It's stored right next to the hash. That's
fine — the salt's job isn't to be secret. Its job is to make each hash
unique so precomputed tables don't work.

---

## Why MD5 and SHA Are Wrong for Passwords

MD5 and SHA (SHA-1, SHA-256, SHA-512) are **general-purpose hash
functions**. They're designed to be fast. That's great for checking
file integrity. It's terrible for passwords.

```
SPEED COMPARISON

  Algorithm     Hashes per second    Time to crack
              (modern GPU)         "password123"
  ───────────  ──────────────────  ─────────────────
  MD5          ~40 billion/sec     Instant
  SHA-256      ~5 billion/sec      Instant
  bcrypt       ~30,000/sec         41 years (for random)
  scrypt       ~20,000/sec         62 years (for random)
  argon2       ~10,000/sec         124 years (for random)

  Fast hashing = attacker can try billions of guesses per second.
  Slow hashing = attacker can try thousands per second at best.
```

The numbers for "time to crack" assume a random 10-character password.
Common passwords are cracked instantly regardless, because attackers
try dictionary words first.

**The key insight**: For passwords, slow is good. You want each guess
to cost time. A user logging in waits 100ms once — no big deal. An
attacker trying a billion guesses suffers enormously.

---

## The Right Algorithms: bcrypt, scrypt, argon2

These are **password hashing functions** — designed specifically for
storing passwords. They have two critical properties:

1. **Deliberately slow**: They include a "work factor" you can tune
2. **Built-in salt**: They generate and store the salt automatically

### bcrypt

The most widely used password hash. Been around since 1999, battle-tested.

```python
import bcrypt

password = b"hunter42"
hashed = bcrypt.hashpw(password, bcrypt.gensalt(rounds=12))
# Result: $2b$12$LJ3m4ys3Lk9Dm3bKm0sAO.ZmRnVmsJKLkqQQFpDNzVhGfN3mYz7S6

# To verify:
if bcrypt.checkpw(password, hashed):
    print("Password matches!")
```

The output `$2b$12$LJ3m...` encodes everything:

```
BCRYPT HASH FORMAT

  $2b$12$LJ3m4ys3Lk9Dm3bKm0sAO.ZmRnVmsJKLkqQQFpDNzVhGfN3mYz7S6

  $2b$     → bcrypt version
  12$      → cost factor (2^12 = 4096 iterations)
  LJ3m...  → 22 characters of salt (128 bits)
  ZmRn...  → 31 characters of hash (184 bits)

  Everything needed to verify is in ONE string.
  No separate salt column needed.
```

### scrypt

Adds memory-hardness to the mix. Not only is it slow to compute,
it requires a lot of RAM, making it expensive to crack with GPUs
or custom hardware (ASICs).

```javascript
const crypto = require('crypto');

const password = 'hunter42';
const salt = crypto.randomBytes(16);

crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
    const hash = derivedKey.toString('hex');
    // Store salt + hash
});
```

### argon2

The newest and recommended choice. Won the Password Hashing Competition
in 2015. Comes in three variants:

```
ARGON2 VARIANTS

  ┌───────────┬─────────────────────────────────────────┐
  │ Variant   │ Use case                                │
  ├───────────┼─────────────────────────────────────────┤
  │ argon2d   │ Resists GPU attacks (data-dependent     │
  │           │ memory access). Vulnerable to            │
  │           │ side-channel attacks.                    │
  │ argon2i   │ Resists side-channel attacks. Better     │
  │           │ for password hashing in general.         │
  │ argon2id  │ RECOMMENDED. Hybrid of both.             │
  │           │ Best of both worlds.                     │
  └───────────┴─────────────────────────────────────────┘
```

```python
from argon2 import PasswordHasher

ph = PasswordHasher(
    time_cost=3,      # Number of iterations
    memory_cost=65536, # 64 MB of memory
    parallelism=4      # 4 parallel threads
)

hash = ph.hash("hunter42")
# Result: $argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$...

try:
    ph.verify(hash, "hunter42")
    print("Password matches!")
except VerifyMismatchError:
    print("Wrong password")
```

---

## Timing Attacks

There's a subtle vulnerability in how you compare hashes. Look at this code:

```python
# VULNERABLE to timing attack
def check_password(input_hash, stored_hash):
    return input_hash == stored_hash
```

The `==` operator for strings compares character by character and
returns `False` as soon as one character doesn't match. An attacker
can measure how long the comparison takes:

```
TIMING ATTACK

  Stored hash: "abcdef"

  Guess: "xbcdef" → Fails at position 0 → FAST response (0.1ms)
  Guess: "axcdef" → Fails at position 1 → Slightly slower (0.2ms)
  Guess: "abxdef" → Fails at position 2 → Even slower (0.3ms)

  By measuring response times, the attacker can figure out
  the hash one character at a time!
```

The fix is **constant-time comparison** — a function that always
takes the same amount of time regardless of where the mismatch is:

```python
import hmac

# SAFE: constant-time comparison
def check_password(input_hash, stored_hash):
    return hmac.compare_digest(input_hash, stored_hash)
```

In practice, bcrypt and argon2 libraries handle this for you. Their
`verify` functions use constant-time comparison internally. But if
you ever compare secrets manually, use the constant-time version.

---

## Choosing Your Algorithm

```
DECISION GUIDE

  Building a new system?
  └──► Use argon2id (best available)

  Existing system with bcrypt?
  └──► Keep bcrypt, increase rounds to 12+
       (migrate to argon2id when convenient)

  Stuck with a framework's default?
  └──► bcrypt is fine. scrypt is fine. argon2 is fine.
       MD5 or SHA is NOT fine. Upgrade immediately.

  PARAMETER RECOMMENDATIONS (2024):

  bcrypt:   rounds = 12 (minimum 10)
  scrypt:   N = 2^15, r = 8, p = 1
  argon2id: time_cost = 3, memory_cost = 64MB, parallelism = 4

  Tune so that hashing takes 100-500ms on your server.
  Too fast = attacker can guess faster.
  Too slow = users notice login delays.
```

---

## Migrating from Bad Hashing

If you inherited a system using MD5 or SHA for passwords, you can
migrate without forcing all users to reset:

```
MIGRATION STRATEGY

  Old system:   MD5(password) → stored_hash
  New system:   bcrypt(password) → new_hash

  Step 1: Add a "hash_version" column to users table

  ┌────┬───────┬──────────────┬──────────────┐
  │ id │ email │ password_hash│ hash_version │
  ├────┼───────┼──────────────┼──────────────┤
  │ 1  │ alice │ 5f4dcc3b...  │ md5          │
  │ 2  │ bob   │ $2b$12$...   │ bcrypt       │
  └────┴───────┴──────────────┴──────────────┘

  Step 2: On login, if hash_version is "md5":
    a. Verify with MD5
    b. If valid, re-hash with bcrypt
    c. Update the stored hash and version
    d. User never knows the migration happened

  Step 3: After 6 months, force remaining MD5 users
          to reset their passwords.
```

---

## Exercises

1. **Hash exploration**: Use your language's crypto library to hash
   "hello" with MD5, SHA-256, and bcrypt. Note the output size of
   each. Change one character to "Hello" and hash again. How much
   did the output change?

2. **Salt reasoning**: If salts are stored in plaintext alongside the
   hash, why do they help? What specific attack do they prevent?
   Would encryption of the salt add meaningful security?

3. **Cost tuning**: Write a script that hashes a password with bcrypt
   at cost factors 8, 10, 12, and 14. Time each one. At what cost
   factor does hashing take about 250ms on your machine?

4. **Design question**: Your database of 10 million users uses
   unsalted SHA-256. You need to migrate to argon2. Design the
   migration plan. Consider: can you rehash without the original
   passwords? (Hint: what about bcrypt(sha256(password))?)

---

[Next: Lesson 04 — Sessions & Cookies](./04-sessions-cookies.md)
