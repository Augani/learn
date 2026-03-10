# Lesson 01: Identity Basics

> **The one thing to remember**: Authentication asks "who are you?"
> Authorization asks "what can you do?" They're different questions
> that happen at different times, and confusing them is one of the
> most common security mistakes.

---

## The Nightclub Analogy

Imagine you're going to a nightclub. There are two checkpoints:

```
THE NIGHTCLUB MODEL

  You ──► [ BOUNCER #1 ]  ──► [ BOUNCER #2 ] ──► Inside
           "Show me ID"        "Are you on the
           (Authentication)     VIP list?"
                               (Authorization)

  Step 1: PROVE WHO YOU ARE
    - You show your driver's license
    - The bouncer checks: Is this a real ID? Does the photo match?
    - This is AUTHENTICATION (AuthN)

  Step 2: CHECK WHAT YOU'RE ALLOWED TO DO
    - The bouncer checks the VIP list
    - "You can enter the main floor, but not the VIP lounge"
    - This is AUTHORIZATION (AuthZ)
```

These are two separate steps. You can authenticate successfully
(prove who you are) but still be denied authorization (not allowed
to do something). Your ID is valid, but you're not on the VIP list.

---

## Authentication (AuthN): "Who Are You?"

Authentication is the process of verifying someone's identity. It
answers one question: **is this person really who they claim to be?**

There are three fundamental ways to prove your identity:

```
THE THREE FACTORS OF AUTHENTICATION

  +-------------------+-------------------+-------------------+
  | SOMETHING YOU     | SOMETHING YOU     | SOMETHING YOU     |
  | KNOW              | HAVE              | ARE               |
  +-------------------+-------------------+-------------------+
  | Password          | Phone             | Fingerprint       |
  | PIN               | Hardware key      | Face              |
  | Security question | Smart card        | Iris              |
  | Secret phrase     | Badge             | Voice             |
  +-------------------+-------------------+-------------------+

  Using one factor:    "Single-factor authentication"
  Using two factors:   "Two-factor authentication" (2FA)
  Using two or more:   "Multi-factor authentication" (MFA)
```

Your bank ATM uses two factors: something you have (the card) and
something you know (the PIN). If someone steals your card, they still
need the PIN. If someone sees your PIN, they still need the card.

**Why multiple factors matter**: Each factor has different weaknesses.
Passwords can be guessed. Phones can be stolen. Fingerprints can be
copied (though it's hard). Combining factors from different categories
makes it exponentially harder for an attacker.

---

## Authorization (AuthZ): "What Can You Do?"

Once the system knows who you are, it needs to decide what you're
allowed to do. This is authorization.

```
AUTHORIZATION IN A FILE SYSTEM

  User: alice

  /home/alice/         → READ, WRITE, DELETE  (her own files)
  /home/bob/           → NO ACCESS            (not her files)
  /shared/project/     → READ, WRITE          (team folder)
  /etc/passwd          → READ                 (system file)
  /etc/shadow          → NO ACCESS            (root only)

  Same person, different permissions depending on the RESOURCE.
```

Authorization is usually about three things:
- **Who** is requesting access (the subject)
- **What** are they trying to access (the resource)
- **How** are they trying to access it (the action: read, write, delete)

```
AUTHORIZATION DECISION

  Subject  +  Action  +  Resource  =  Allow or Deny?

  alice    +  read    +  /shared/  =  ALLOW
  alice    +  delete  +  /shared/  =  DENY
  admin    +  delete  +  /shared/  =  ALLOW
```

---

## Why People Confuse Them

Authentication and authorization often happen at the same time, so
people conflate them. Here's a scenario that shows why they're different:

**Scenario: Google Docs**

1. You log into Google (authentication)
2. You open a shared document (authorization check: can you view it?)
3. You try to edit (authorization check: can you edit it?)
4. You try to delete (authorization check: can you delete it?)

You authenticated once. Authorization was checked three times, with
potentially different answers each time. Your identity didn't change,
but your permissions varied by action.

```
TIMELINE: AuthN vs AuthZ

  Time ──────────────────────────────────────────────►

  LOGIN          VIEW DOC       EDIT DOC       DELETE DOC
  ┌──────┐       ┌──────┐      ┌──────┐       ┌──────┐
  │ AuthN │       │ AuthZ│      │ AuthZ│       │ AuthZ│
  │ ✓     │       │ ✓    │      │ ✓    │       │ ✗    │
  └──────┘       └──────┘      └──────┘       └──────┘

  Authenticated   Authorized    Authorized     NOT Authorized
  once            to view       to edit        to delete
```

---

## Identity: The Foundation

Before authentication or authorization can happen, there must be a
concept of **identity** — a way to distinguish one user from another.

In the digital world, identity is established through:

```
IDENTITY SYSTEMS

  +-----------------+----------------------------------+
  | Identifier      | Example                          |
  +-----------------+----------------------------------+
  | Username        | alice                            |
  | Email           | alice@example.com                |
  | Phone number    | +1-555-0100                      |
  | Employee ID     | EMP-2847                         |
  | UUID            | 550e8400-e29b-41d4-a716-446655440000 |
  +-----------------+----------------------------------+

  An identifier is NOT proof of identity.
  Knowing someone's email doesn't prove you ARE them.
  That's what authentication is for.
```

**The key distinction**:
- **Identification**: "I am alice@example.com" (a claim)
- **Authentication**: "Here's proof I'm alice@example.com" (verification)
- **Authorization**: "alice@example.com can edit this document" (permission)

---

## Why This Is Hard

Authentication and authorization seem simple in theory. In practice,
they're some of the hardest problems in computer security:

**1. Passwords are terrible**
People reuse passwords. They choose weak ones. They write them on
sticky notes. Every password database is a target for attackers.

**2. Sessions need management**
After authentication, you need to "remember" that a user is logged in.
This creates session tokens that can be stolen, forged, or hijacked.

**3. Distributed systems are complex**
When your app talks to 10 different services, each one needs to know
who the user is and what they can do. Passing identity across service
boundaries is a major challenge.

**4. The threat landscape is vast**
Phishing, credential stuffing, session hijacking, privilege escalation,
token theft, replay attacks, man-in-the-middle attacks — the list of
things that can go wrong is enormous.

**5. Usability vs security**
The most secure system would require a retinal scan, a hardware key,
a 64-character password, and a blood sample. Nobody would use it.
Every security decision is a tradeoff against convenience.

```
THE SECURITY-USABILITY SPECTRUM

  ← More Usable                        More Secure →

  No password    Simple      Strong      Password +    Password +
  at all         4-digit     password    2FA           hardware key +
                 PIN                                   biometric

  Anyone can     Easy to     Decent      Good          Excellent
  get in         guess       security    security      security

  The trick: find the sweet spot for YOUR use case.
  A banking app needs to be further right.
  A recipe blog can be further left.
```

---

## Real-World Authentication Flow

Here's what happens when you log into a typical website, at a high level.
We'll break each part down in later lessons:

```
SIMPLIFIED LOGIN FLOW

  Browser                        Server
  ──────                        ──────
     │                              │
     │  1. GET /login               │
     │─────────────────────────────►│
     │                              │
     │  2. HTML login form          │
     │◄─────────────────────────────│
     │                              │
     │  3. POST /login              │
     │  {email, password}           │
     │─────────────────────────────►│
     │                         ┌────┴────┐
     │                         │ VERIFY  │
     │                         │ Look up │
     │                         │ user,   │
     │                         │ check   │
     │                         │ password│
     │                         └────┬────┘
     │  4. Set-Cookie: session=abc  │
     │◄─────────────────────────────│
     │                              │
     │  5. GET /dashboard           │
     │  Cookie: session=abc         │
     │─────────────────────────────►│
     │                         ┌────┴────┐
     │                         │ AuthZ:  │
     │                         │ Can this│
     │                         │ session │
     │                         │ access  │
     │                         │ /dash?  │
     │                         └────┬────┘
     │  6. 200 OK (dashboard)       │
     │◄─────────────────────────────│
```

Steps 3-4 are **authentication**: proving who you are and getting a session.
Step 5's server check is **authorization**: can this user access this page?

---

## Exercises

1. **Classify each scenario** as authentication, authorization, or both:
   - Entering your PIN at an ATM
   - A firewall blocking traffic to port 22
   - Scanning your badge to enter a building
   - A file permission preventing you from deleting /etc/passwd
   - Logging into Netflix, then seeing different content than another user

2. **Design an identity system** for a small library. What identifier
   would you use for patrons? What authentication method? What
   resources need authorization (checking out books, accessing
   digital content, using computers)?

3. **Find the bug**: A web app checks if a user is logged in before
   showing the admin page, but doesn't check if the user is actually
   an admin. Is this an authentication bug or an authorization bug?

4. **Think about tradeoffs**: Your company wants to secure a new
   internal tool. Employees complain that 2FA is annoying. The tool
   handles customer PII (personally identifiable information). What
   do you recommend and why?

---

[Next: Lesson 02 — Password Authentication](./02-password-auth.md)
