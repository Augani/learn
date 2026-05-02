# Lesson 15: Passkeys & WebAuthn

> **The one thing to remember**: Passkeys replace passwords with
> public key cryptography. Instead of typing a secret that can be
> stolen, your device proves its identity by signing a challenge
> with a private key that never leaves the device. It's like a
> lock that only responds to YOUR specific key, and the key can't
> be copied, photographed, or guessed.

---

## The Wax Seal Analogy

```
PASSKEYS ARE LIKE A WAX SEAL RING

  PASSWORD AUTHENTICATION:
  You whisper a secret word to the guard.
  If anyone overhears it, they can impersonate you.

  PASSKEY AUTHENTICATION:
  You seal a letter with YOUR unique wax seal ring.
  The guard checks the seal pattern against the one on file.

  Key differences:
  - You never share the ring itself (private key stays on device)
  - The guard only has the seal PATTERN (public key on server)
  - If someone steals the pattern, they still can't make the seal
  - Every message gets a unique seal (challenge-response)
  - You can't accidentally give your ring to a fake guard
    (domain binding prevents phishing)
```

---

## The Problem with Passwords (That Passkeys Solve)

```
EVERY PROBLEM WITH PASSWORDS

  ┌─────────────────────┬──────────────────────────────────┐
  │ Password Problem    │ How Passkeys Solve It            │
  ├─────────────────────┼──────────────────────────────────┤
  │ Can be guessed      │ No secret to guess               │
  │ Can be phished      │ Cryptographically bound to domain│
  │ Can be stolen from  │ Private key never sent to server │
  │ server database     │ (only public key stored)         │
  │ Reuse across sites  │ Unique key pair per site         │
  │ Need to remember    │ Unlocked by biometric/PIN        │
  │ Can be keylogged    │ No typing involved               │
  │ Weak by default     │ 256-bit cryptographic keys       │
  └─────────────────────┴──────────────────────────────────┘
```

---

## How WebAuthn Works

WebAuthn (Web Authentication) is the browser API that makes passkeys
work. It's part of the FIDO2 standard.

```
FIDO2 STACK

  ┌─────────────────────────────────────────┐
  │ FIDO2                                   │
  │                                         │
  │ ┌───────────────────────────────────┐   │
  │ │ WebAuthn                          │   │
  │ │ (Browser JavaScript API)          │   │
  │ │ navigator.credentials.create()    │   │
  │ │ navigator.credentials.get()       │   │
  │ └───────────────────────────────────┘   │
  │                                         │
  │ ┌───────────────────────────────────┐   │
  │ │ CTAP2                             │   │
  │ │ (Client To Authenticator Protocol)│   │
  │ │ How the browser talks to the      │   │
  │ │ authenticator (USB key, platform  │   │
  │ │ biometric, etc.)                  │   │
  │ └───────────────────────────────────┘   │
  │                                         │
  └─────────────────────────────────────────┘
```

### Registration (Creating a Passkey)

```
PASSKEY REGISTRATION

  User             Browser               Server
  ────             ───────               ──────
     │                 │                    │
     │ "Create passkey"│                    │
     │────────────────►│                    │
     │                 │                    │
     │                 │ GET /webauthn/register/options
     │                 │───────────────────►│
     │                 │                    │
     │                 │ {                  │
     │                 │   challenge: "random bytes",
     │                 │   rp: {name: "MyApp", id: "myapp.com"},
     │                 │   user: {id: "42", name: "alice"},
     │                 │   pubKeyCredParams: [{alg: -7}],
     │                 │   authenticatorSelection: {...}
     │                 │ }                  │
     │                 │◄───────────────────│
     │                 │                    │
     │                 │ navigator.credentials.create(options)
     │                 │                    │
     │ ┌───────────────┤                    │
     │ │ OS prompt:    │                    │
     │ │ "Create a     │                    │
     │ │  passkey for  │                    │
     │ │  myapp.com?"  │                    │
     │ │               │                    │
     │ │ [Touch ID]    │                    │
     │ │ [Use PIN]     │                    │
     │ └───────────────┤                    │
     │                 │                    │
     │ Touch sensor /  │                    │
     │ Enter PIN       │                    │
     │────────────────►│                    │
     │                 │                    │
     │            ┌────┴────────────┐       │
     │            │ Authenticator   │       │
     │            │ generates:      │       │
     │            │ - Key pair      │       │
     │            │   (public +     │       │
     │            │    private)     │       │
     │            │ - Credential ID │       │
     │            │ - Signs the     │       │
     │            │   challenge     │       │
     │            │                 │       │
     │            │ Private key     │       │
     │            │ STAYS HERE      │       │
     │            └────┬────────────┘       │
     │                 │                    │
     │                 │ POST /webauthn/register/verify
     │                 │ {                  │
     │                 │   credentialId,    │
     │                 │   publicKey,       │
     │                 │   signedChallenge  │
     │                 │ }                  │
     │                 │───────────────────►│
     │                 │                    │ Verify signature
     │                 │                    │ Store public key
     │                 │                    │ + credential ID
     │                 │  "Passkey created" │
     │                 │◄───────────────────│
```

### Authentication (Using a Passkey)

```
PASSKEY AUTHENTICATION

  User             Browser               Server
  ────             ───────               ──────
     │                 │                    │
     │ "Sign in"       │                    │
     │────────────────►│                    │
     │                 │                    │
     │                 │ GET /webauthn/login/options
     │                 │───────────────────►│
     │                 │                    │
     │                 │ {                  │
     │                 │   challenge: "new random bytes",
     │                 │   rpId: "myapp.com",
     │                 │   allowCredentials: [{id: "cred123"}]
     │                 │ }                  │
     │                 │◄───────────────────│
     │                 │                    │
     │                 │ navigator.credentials.get(options)
     │                 │                    │
     │ ┌───────────────┤                    │
     │ │ OS prompt:    │                    │
     │ │ "Sign in to   │                    │
     │ │  myapp.com?"  │                    │
     │ │               │                    │
     │ │ [Touch ID]    │                    │
     │ └───────────────┤                    │
     │                 │                    │
     │ Touch sensor    │                    │
     │────────────────►│                    │
     │                 │                    │
     │            ┌────┴────────────┐       │
     │            │ Authenticator   │       │
     │            │ signs the       │       │
     │            │ challenge with  │       │
     │            │ PRIVATE KEY     │       │
     │            └────┬────────────┘       │
     │                 │                    │
     │                 │ POST /webauthn/login/verify
     │                 │ {                  │
     │                 │   credentialId,    │
     │                 │   signedChallenge, │
     │                 │   authenticatorData│
     │                 │ }                  │
     │                 │───────────────────►│
     │                 │                    │ Look up public key
     │                 │                    │ by credential ID
     │                 │                    │ Verify signature
     │                 │                    │ Create session
     │                 │                    │
     │                 │  "Welcome, Alice!" │
     │                 │◄───────────────────│
```

---

## Why Passkeys Can't Be Phished

```
PHISHING RESISTANCE

  Attacker sets up: fake-myapp.com (looks identical to myapp.com)

  WITH PASSWORDS:
  1. User goes to fake-myapp.com
  2. Types password → attacker captures it
  3. Attacker uses password on real myapp.com → SUCCESS

  WITH PASSKEYS:
  1. User goes to fake-myapp.com
  2. Browser calls navigator.credentials.get()
  3. Browser checks: "Do I have a passkey for fake-myapp.com?"
  4. Answer: NO (passkey was registered for myapp.com)
  5. Authentication fails → attacker gets NOTHING

  The browser enforces domain matching.
  The passkey for myapp.com CANNOT be used on fake-myapp.com.
  This check happens automatically — the user doesn't need
  to notice the fake domain.
```

---

## Platform vs Roaming Authenticators

```
AUTHENTICATOR TYPES

  PLATFORM AUTHENTICATOR (built into your device)
  ┌────────────────────────────────────────────────┐
  │ Touch ID / Face ID (Apple)                     │
  │ Windows Hello (Microsoft)                      │
  │ Fingerprint sensor (Android)                   │
  │                                                │
  │ Pros:                                          │
  │ + Nothing extra to carry                       │
  │ + Very convenient (biometric unlock)           │
  │ + Synced across devices (iCloud, Google)        │
  │                                                │
  │ Cons:                                          │
  │ - Tied to device ecosystem                     │
  │ - If you lose all devices, recovery is needed  │
  └────────────────────────────────────────────────┘

  ROAMING AUTHENTICATOR (separate physical device)
  ┌────────────────────────────────────────────────┐
  │ YubiKey (USB / NFC)                            │
  │ Google Titan Key                               │
  │ Feitian keys                                   │
  │                                                │
  │ Pros:                                          │
  │ + Works on any device (USB/NFC)                │
  │ + Not tied to any ecosystem                    │
  │ + Physical possession required                 │
  │                                                │
  │ Cons:                                          │
  │ - Must carry it with you                       │
  │ - Can be lost (need backup key)                │
  │ - Costs $25-70                                 │
  └────────────────────────────────────────────────┘
```

**Synced passkeys** (available since 2022-2023) are stored in your
platform's credential manager (iCloud Keychain, Google Password
Manager) and sync across your devices. This solves the "lost my
device" problem for platform authenticators.

```
SYNCED PASSKEYS

  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ iPhone   │    │ MacBook  │    │ iPad     │
  │          │    │          │    │          │
  │ Passkey  │◄──►│ Passkey  │◄──►│ Passkey  │
  │ for      │    │ for      │    │ for      │
  │ myapp.com│    │ myapp.com│    │ myapp.com│
  └──────────┘    └──────────┘    └──────────┘
       ▲                ▲               ▲
       └────────────────┼───────────────┘
                        │
                  iCloud Keychain
                  (end-to-end encrypted)

  Create a passkey on your iPhone,
  use it on your MacBook immediately.
  Backed up to iCloud — survives device loss.
```

---

## Code Example: WebAuthn Implementation

Server-side (Node.js with @simplewebauthn/server):

```javascript
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require('@simplewebauthn/server');

const rpName = 'My App';
const rpID = 'myapp.com';
const origin = 'https://myapp.com';

async function startRegistration(user) {
    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: user.id,
        userName: user.email,
        attestationType: 'none',
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
        },
    });

    await storeChallenge(user.id, options.challenge);
    return options;
}

async function finishRegistration(user, response) {
    const expectedChallenge = await getStoredChallenge(user.id);

    const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
    });

    if (verification.verified) {
        const { credentialID, credentialPublicKey, counter } =
            verification.registrationInfo;

        await storeCredential(user.id, {
            credentialID,
            publicKey: credentialPublicKey,
            counter,
        });
    }

    return verification.verified;
}

async function startAuthentication(user) {
    const credentials = await getUserCredentials(user.id);

    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: credentials.map(c => ({
            id: c.credentialID,
            type: 'public-key',
        })),
        userVerification: 'preferred',
    });

    await storeChallenge(user.id, options.challenge);
    return options;
}

async function finishAuthentication(user, response) {
    const expectedChallenge = await getStoredChallenge(user.id);
    const credential = await getCredentialById(response.id);

    const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
            credentialID: credential.credentialID,
            credentialPublicKey: credential.publicKey,
            counter: credential.counter,
        },
    });

    if (verification.verified) {
        await updateCredentialCounter(
            credential.id,
            verification.authenticationInfo.newCounter
        );
    }

    return verification.verified;
}
```

Client-side:

```javascript
import {
    startRegistration,
    startAuthentication
} from '@simplewebauthn/browser';

async function registerPasskey() {
    const optionsResponse = await fetch('/api/webauthn/register/options');
    const options = await optionsResponse.json();

    const credential = await startRegistration(options);

    const verifyResponse = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
    });

    const result = await verifyResponse.json();
    if (result.verified) {
        alert('Passkey created!');
    }
}

async function loginWithPasskey() {
    const optionsResponse = await fetch('/api/webauthn/login/options');
    const options = await optionsResponse.json();

    const assertion = await startAuthentication(options);

    const verifyResponse = await fetch('/api/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
    });

    const result = await verifyResponse.json();
    if (result.verified) {
        window.location.href = '/dashboard';
    }
}
```

---

## The Counter: Detecting Cloned Keys

```
SIGNATURE COUNTER

  Each authenticator maintains a counter that increments
  with every use:

  Registration: counter = 0
  First login:  counter = 1
  Second login: counter = 2
  Third login:  counter = 3

  Server stores the last known counter value.
  If a login comes in with counter <= stored counter,
  the key may have been cloned.

  Login with counter = 2 after seeing counter = 3?
  → REJECT. Possible cloned authenticator.
```

---

## Exercises

1. **Try it**: Go to webauthn.io or passkeys.io and create a passkey.
   Use your browser's developer tools to watch the
   navigator.credentials.create() and navigator.credentials.get()
   calls. What data is sent to the server?

2. **Build registration**: Implement the WebAuthn registration flow.
   Use @simplewebauthn/server (Node.js) or py_webauthn (Python).
   Store the credential in a database and verify it works.

3. **Phishing analysis**: Explain step by step why a passkey created
   for myapp.com cannot be used on evil-myapp.com, even if the
   user is tricked into visiting the evil site. Where in the
   protocol does the check happen?

4. **Migration plan**: You have an existing app with password + TOTP
   authentication. Design a migration path to passkeys that:
   (a) doesn't force users to switch immediately,
   (b) encourages passkey adoption, and
   (c) handles users who can't use passkeys (old browsers).

---

[Next: Lesson 16 — Build an Auth System](./16-build-auth-system.md)
