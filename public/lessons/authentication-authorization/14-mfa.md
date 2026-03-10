# Lesson 14: Multi-Factor Authentication (MFA)

> **The one thing to remember**: MFA requires two or more different
> types of proof — something you know (password), something you have
> (phone/key), or something you are (fingerprint). A password alone
> is like a door with one lock. MFA adds a deadbolt and a chain.
> An attacker who picks one lock still can't get in.

---

## Why Passwords Alone Aren't Enough

```
THE PROBLEM

  Passwords get compromised through:
  - Data breaches (billions of passwords leaked online)
  - Phishing (fake login pages)
  - Credential stuffing (reused passwords from other sites)
  - Keyloggers and malware
  - Social engineering
  - Weak passwords ("password123")

  STATISTICS:
  - 80%+ of hacking-related breaches involve stolen credentials
  - Average person reuses passwords across 5+ sites
  - Billions of username/password pairs available on the dark web

  Even a STRONG password can be phished.
  MFA means a stolen password alone is NOT enough.
```

---

## The Three Factors

```
AUTHENTICATION FACTORS

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  FACTOR 1: SOMETHING YOU KNOW                           │
  │  ┌─────────────────────────────────────────────┐        │
  │  │ Password, PIN, security question, pattern   │        │
  │  │ Can be forgotten. Can be guessed/stolen.    │        │
  │  └─────────────────────────────────────────────┘        │
  │                                                         │
  │  FACTOR 2: SOMETHING YOU HAVE                           │
  │  ┌─────────────────────────────────────────────┐        │
  │  │ Phone, hardware key, smart card, badge      │        │
  │  │ Can be lost or stolen. Hard to duplicate.   │        │
  │  └─────────────────────────────────────────────┘        │
  │                                                         │
  │  FACTOR 3: SOMETHING YOU ARE                            │
  │  ┌─────────────────────────────────────────────┐        │
  │  │ Fingerprint, face, iris, voice              │        │
  │  │ Can't be forgotten. Hard to fake.           │        │
  │  │ Can't be changed if compromised.            │        │
  │  └─────────────────────────────────────────────┘        │
  │                                                         │
  │  TRUE MFA uses factors from DIFFERENT categories.       │
  │  Password + security question = NOT MFA (both "know")   │
  │  Password + phone code = MFA ("know" + "have")          │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

---

## TOTP: Time-Based One-Time Passwords

TOTP is what Google Authenticator, Authy, and similar apps use.
It generates a 6-digit code that changes every 30 seconds.

```
HOW TOTP WORKS

  SETUP (one time):
  1. Server generates a random SECRET KEY (e.g., "JBSWY3DPEHPK3PXP")
  2. Server shows it as a QR code
  3. User scans QR with authenticator app
  4. Both server and app now share the same secret

  LOGIN (every time):
  ┌──────────────┐              ┌──────────────┐
  │ Auth App     │              │ Server       │
  │              │              │              │
  │ secret +     │              │ secret +     │
  │ current time │              │ current time │
  │      │       │              │      │       │
  │      ▼       │              │      ▼       │
  │ HMAC-SHA1    │              │ HMAC-SHA1    │
  │      │       │              │      │       │
  │      ▼       │              │      ▼       │
  │  "847293"    │  user types  │  "847293"    │
  │              │─────────────►│              │
  │              │              │  Match? ✓    │
  └──────────────┘              └──────────────┘

  The code changes every 30 seconds because the TIME changes.
  Both sides compute the same code independently.
  No network connection needed on the app side.
```

The algorithm:

```python
import hmac
import hashlib
import struct
import time
import base64

def generate_totp(secret, time_step=30, digits=6):
    # Current time divided into 30-second windows
    counter = int(time.time()) // time_step

    # Convert counter to 8-byte big-endian
    counter_bytes = struct.pack('>Q', counter)

    # HMAC-SHA1 of counter using the shared secret
    secret_bytes = base64.b32decode(secret)
    hmac_hash = hmac.new(secret_bytes, counter_bytes, hashlib.sha1).digest()

    # Dynamic truncation: extract 4 bytes at an offset
    offset = hmac_hash[-1] & 0x0F
    code_int = struct.unpack('>I', hmac_hash[offset:offset + 4])[0]
    code_int &= 0x7FFFFFFF  # Remove sign bit

    # Take last 'digits' digits
    code = code_int % (10 ** digits)
    return str(code).zfill(digits)

# Server-side verification (accept current + adjacent windows for clock skew)
def verify_totp(secret, user_code, window=1):
    for offset in range(-window, window + 1):
        counter = (int(time.time()) // 30) + offset
        expected = generate_totp_at_counter(secret, counter)
        if hmac.compare_digest(expected, user_code):
            return True
    return False
```

**Why a window?** Clocks on the user's phone and the server might
be slightly out of sync. Accepting codes from adjacent 30-second
windows (typically +/- 1) compensates for clock drift.

---

## SMS Codes (And Why They're Weak)

SMS-based MFA sends a code via text message. It's better than no MFA,
but it has real vulnerabilities:

```
SMS MFA WEAKNESSES

  1. SIM SWAPPING
     Attacker convinces your carrier to transfer your phone number
     to their SIM card. Now THEY receive your SMS codes.
     This has been used in high-profile cryptocurrency thefts.

  2. SS7 VULNERABILITIES
     The SS7 protocol (used by telecom networks) has known flaws
     that allow intercepting SMS messages. Nation-state level
     attack, but documented and exploited.

  3. PHONE NUMBER RECYCLING
     Carrier reassigns your old phone number to someone else.
     That person now receives your MFA codes.

  4. MALWARE
     Malware on the phone can read incoming SMS messages.

  5. SOCIAL ENGINEERING
     "Hi, this is your bank. We need to verify your identity.
      Please read me the code we just sent to your phone."

  SMS MFA STRENGTH RANKING:

  No MFA          ████░░░░░░░░░░░░  Very weak
  SMS             ████████░░░░░░░░  Moderate
  TOTP            ██████████████░░  Strong
  Push            ██████████████░░  Strong
  Hardware key    ████████████████  Strongest
```

**When SMS is acceptable**: For low-risk accounts where the
alternative is no MFA at all. SMS MFA still stops the vast majority
of automated attacks (credential stuffing, password spraying).

**When SMS is not acceptable**: Banking, cryptocurrency, email
accounts, administrator access, healthcare systems.

---

## Push Notifications

Push-based MFA sends a notification to a trusted device. The user
taps "Approve" or "Deny":

```
PUSH MFA FLOW

  User                     Server                  User's Phone
  (Browser)                ──────                  ────────────
     │                        │                        │
     │ Login with password    │                        │
     │───────────────────────►│                        │
     │                        │                        │
     │                        │ Send push notification │
     │                        │───────────────────────►│
     │                        │                        │
     │  "Check your phone"    │                        │ BUZZ!
     │◄───────────────────────│                        │ "Login attempt
     │                        │                        │  from Chrome
     │                        │                        │  in New York.
     │                        │                        │  Approve?"
     │                        │                        │
     │                        │                        │ [Approve][Deny]
     │                        │                        │
     │                        │ User tapped "Approve"  │
     │                        │◄───────────────────────│
     │                        │                        │
     │ Login successful       │                        │
     │◄───────────────────────│                        │
```

**MFA fatigue attack**: Attackers repeatedly trigger push
notifications hoping the user will tap "Approve" to make them stop.
Defenses: number matching (show a number on the login screen that the
user must enter on their phone), rate limiting push requests, and
requiring biometric confirmation on the phone.

---

## Hardware Security Keys (YubiKey, FIDO2)

Hardware keys are physical devices that connect via USB, NFC, or
Bluetooth. They're the strongest MFA factor:

```
HARDWARE KEY AUTHENTICATION

  ┌─────────────────────────────────────────────┐
  │                                             │
  │  User plugs in YubiKey and touches it       │
  │                                             │
  │  ┌─────────┐                                │
  │  │ YubiKey │                                │
  │  │  ╔═══╗  │ ← Touch sensor                │
  │  │  ║   ║  │                                │
  │  │  ╚═══╝  │                                │
  │  │  USB-A  │                                │
  │  └────┬────┘                                │
  │       │                                     │
  │       ▼                                     │
  │  1. Browser sends challenge from server     │
  │  2. Key signs challenge with PRIVATE key    │
  │  3. Browser sends signed response           │
  │  4. Server verifies with PUBLIC key         │
  │                                             │
  │  The private key NEVER leaves the device.   │
  │  It can't be phished (bound to the domain). │
  │  It can't be remotely stolen.               │
  │  Physical possession + touch required.      │
  │                                             │
  └─────────────────────────────────────────────┘
```

Why hardware keys are phishing-resistant:

```
PHISHING RESISTANCE

  Phishing attack scenario:
  Attacker creates fake-google.com that looks like Google.

  WITH TOTP:
  1. User enters password on fake-google.com
  2. Attacker relays password to real google.com
  3. Google asks for TOTP code
  4. Attacker asks user for TOTP code
  5. User enters TOTP code on fake site
  6. Attacker relays TOTP code → SUCCESS (for attacker)
  TOTP can be phished because the code works on any site.

  WITH HARDWARE KEY:
  1. User enters password on fake-google.com
  2. Attacker relays password to real google.com
  3. Google asks for hardware key challenge
  4. Attacker asks user to tap their key
  5. Key checks: "Am I on google.com? No, I'm on fake-google.com."
  6. Key signs a challenge for fake-google.com, NOT google.com
  7. Attacker sends this to google.com → REJECTED
  Hardware keys are DOMAIN-BOUND. They can't be phished.
```

---

## Backup Codes

Every MFA system needs a recovery path for when the second factor
is lost (phone broke, key lost):

```
BACKUP CODES

  During MFA setup, generate and display:
  ┌─────────────────────────────────────┐
  │  Save these backup codes:           │
  │                                     │
  │  1. a7b3-c9d2-e1f4                 │
  │  2. h8j5-k2m6-n9p1                 │
  │  3. q4r7-s1t3-u6v8                 │
  │  4. w2x5-y8z1-b3c6                 │
  │  5. d9f2-g5h7-j1k4                 │
  │                                     │
  │  Each code can be used ONCE.        │
  │  Store them somewhere safe.         │
  └─────────────────────────────────────┘
```

```python
import secrets
import hashlib

def generate_backup_codes(count=10):
    codes = []
    for _ in range(count):
        code = secrets.token_hex(6)  # e.g., "a7b3c9d2e1f4"
        formatted = f"{code[:4]}-{code[4:8]}-{code[8:]}"
        hashed = hashlib.sha256(code.encode()).hexdigest()
        codes.append({"display": formatted, "hash": hashed})
    return codes

def verify_backup_code(user_id, input_code):
    clean = input_code.replace("-", "")
    hashed = hashlib.sha256(clean.encode()).hexdigest()

    stored_codes = database.get_backup_codes(user_id)
    for stored in stored_codes:
        if hmac.compare_digest(stored.hash, hashed):
            if not stored.used:
                database.mark_code_used(stored.id)
                return True
    return False
```

**Store backup codes as hashes** — just like passwords. If the
database leaks, the backup codes are still protected.

---

## Implementing MFA: The Full Flow

```
MFA LOGIN FLOW

  User                        Server
  ────                        ──────
     │                           │
     │ POST /login               │
     │ {email, password}         │
     │──────────────────────────►│
     │                           │ Verify password ✓
     │                           │ Check: MFA enabled?
     │                           │ YES → Don't create session yet
     │                           │
     │ {"mfa_required": true,    │
     │  "mfa_token": "temp123",  │ Temporary token (short-lived)
     │  "methods": ["totp",      │ Available MFA methods
     │              "backup"]}   │
     │◄──────────────────────────│
     │                           │
     │ POST /login/mfa           │
     │ {mfa_token: "temp123",    │
     │  method: "totp",          │
     │  code: "847293"}          │
     │──────────────────────────►│
     │                           │ Verify TOTP code ✓
     │                           │ Create full session
     │                           │
     │ {"session": "abc...",     │
     │  "user": {...}}           │
     │◄──────────────────────────│
```

```python
@app.route("/login", methods=["POST"])
def login():
    email = request.json["email"]
    password = request.json["password"]

    user = authenticate(email, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    if user.mfa_enabled:
        mfa_token = create_mfa_challenge_token(user.id, ttl=300)
        return jsonify({
            "mfa_required": True,
            "mfa_token": mfa_token,
            "methods": get_user_mfa_methods(user.id)
        })

    session_id = create_session(user.id)
    return jsonify({"user": user.to_dict()}), 200


@app.route("/login/mfa", methods=["POST"])
def verify_mfa():
    mfa_token = request.json["mfa_token"]
    method = request.json["method"]
    code = request.json["code"]

    user_id = validate_mfa_challenge_token(mfa_token)
    if not user_id:
        return jsonify({"error": "Invalid or expired MFA token"}), 401

    if method == "totp":
        valid = verify_totp(get_user_totp_secret(user_id), code)
    elif method == "backup":
        valid = verify_backup_code(user_id, code)
    else:
        return jsonify({"error": "Unknown MFA method"}), 400

    if not valid:
        record_failed_mfa_attempt(user_id)
        return jsonify({"error": "Invalid code"}), 401

    session_id = create_session(user_id)
    return jsonify({"user": get_user(user_id).to_dict()}), 200
```

---

## MFA Method Comparison

```
MFA COMPARISON

  ┌──────────────┬──────────┬────────────┬──────────┬─────────┐
  │ Method       │ Security │ Usability  │ Phishing │ Cost    │
  │              │          │            │ Resistant│         │
  ├──────────────┼──────────┼────────────┼──────────┼─────────┤
  │ SMS          │ Low      │ High       │ No       │ Free    │
  │ TOTP         │ Medium   │ Medium     │ No       │ Free    │
  │ Push         │ Medium   │ High       │ Partial  │ Low     │
  │ Hardware key │ High     │ Medium     │ Yes      │ $25-70  │
  │ Biometric    │ Medium   │ High       │ N/A      │ Device  │
  └──────────────┴──────────┴────────────┴──────────┴─────────┘

  "Phishing Resistant" means: can the code/response be
  intercepted and used on a different site?

  SMS: Yes (attacker can relay the code)
  TOTP: Yes (attacker can relay the code)
  Push: Partially (number matching helps)
  Hardware key: No (cryptographically bound to domain)
```

---

## Exercises

1. **Implement TOTP**: Write a TOTP generator and verifier from
   scratch. Generate a shared secret, create codes, and verify
   them. Test that the code changes every 30 seconds.

2. **MFA enrollment flow**: Design the complete user experience for
   enrolling in TOTP MFA: generating the secret, displaying the
   QR code, verifying the first code, and generating backup codes.

3. **Recovery design**: A user lost their phone with their TOTP app
   and also lost their backup codes. Design a secure recovery
   process. Balance security (preventing account takeover) with
   usability (the user is legitimately locked out).

4. **Threat modeling**: For each MFA method (SMS, TOTP, push,
   hardware key), describe one attack that bypasses it. For each
   attack, suggest a mitigation.

---

[Next: Lesson 15 — Passkeys & WebAuthn](./15-passkeys-webauthn.md)
