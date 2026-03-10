# Lesson 07: OAuth 2.0 — The Big Picture

> **The one thing to remember**: OAuth 2.0 lets a user grant a
> third-party application limited access to their resources without
> giving away their password. It's like giving your house key to a
> dog walker, but the key only opens the back door and only works
> on Tuesdays.

---

## The Problem OAuth Solves

Before OAuth, if you wanted an app to access your Google Calendar,
you had to give that app your Google password. This was terrible:

```
THE WORLD BEFORE OAUTH

  You want "CoolCalendar App" to read your Google Calendar.

  Old way:
  ┌──────────┐                              ┌──────────┐
  │ You      │──── Google password ────────►│ CoolCal  │
  │          │                              │ App      │
  └──────────┘                              │          │
                                            │ Now has  │
                                            │ your     │
                                            │ Google   │
                                            │ password!│
                                            └─────┬────┘
                                                  │
                         Uses your password to ───┘
                         access Google Calendar,
                         Gmail, Drive, YouTube,
                         EVERYTHING.

  Problems:
  1. CoolCal has FULL access to your Google account
  2. You can't limit what CoolCal can do
  3. If CoolCal gets hacked, your Google password leaks
  4. To revoke access, you must change your Google password
     (which breaks EVERY other app using it)
```

OAuth fixes every one of these problems:

```
THE WORLD WITH OAUTH 2.0

  ┌──────────┐                              ┌──────────┐
  │ You      │──── "Yes, CoolCal can ──────►│ Google   │
  │          │      read my calendar"       │ Auth     │
  └──────────┘                              │ Server   │
                                            └────┬─────┘
                                                 │
                                    Limited token │
                                    (calendar     │
                                     read only)   │
                                                 ▼
                                            ┌──────────┐
                                            │ CoolCal  │
                                            │ App      │
                                            │          │
                                            │ Has a    │
                                            │ TOKEN    │
                                            │ (not a   │
                                            │ password)│
                                            └──────────┘

  CoolCal can ONLY read your calendar.
  CoolCal NEVER sees your password.
  You can revoke CoolCal's access without changing your password.
  If CoolCal gets hacked, only the limited token leaks.
```

---

## The Four Roles

OAuth 2.0 defines four roles. These names are specific and important:

```
OAUTH 2.0 ROLES

  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │  RESOURCE OWNER (You)                                   │
  │  The human who owns the data.                           │
  │  "I own my Google Calendar."                            │
  │                                                         │
  │  CLIENT (CoolCal App)                                   │
  │  The application that wants access.                     │
  │  "I want to read Alice's calendar."                     │
  │                                                         │
  │  AUTHORIZATION SERVER (Google Auth)                     │
  │  Authenticates the resource owner and issues tokens.    │
  │  "Alice, do you approve CoolCal? OK, here's a token."  │
  │                                                         │
  │  RESOURCE SERVER (Google Calendar API)                  │
  │  Hosts the protected resources.                         │
  │  "This token is valid for calendar:read. Here's data."  │
  │                                                         │
  └─────────────────────────────────────────────────────────┘

  In practice, the Authorization Server and Resource Server
  are often run by the same company (Google runs both),
  but they're logically separate.
```

Real-world mapping:

```
ROLE MAPPING EXAMPLES

  Scenario: "Log in with GitHub" on a coding site

  Resource Owner:      You (the GitHub user)
  Client:              The coding site (e.g., Vercel)
  Authorization Server: GitHub (accounts.github.com)
  Resource Server:     GitHub API (api.github.com)

  Scenario: "Connect Slack" in a project management tool

  Resource Owner:      You (the Slack user)
  Client:              The project tool (e.g., Trello)
  Authorization Server: Slack (slack.com/oauth)
  Resource Server:     Slack API (api.slack.com)
```

---

## Grant Types Overview

OAuth 2.0 defines several ways (called "grant types" or "flows") for
the client to get a token. Each is designed for different situations:

```
GRANT TYPES

  ┌──────────────────────────┬─────────────────────────────────────┐
  │ Grant Type               │ When to use                         │
  ├──────────────────────────┼─────────────────────────────────────┤
  │ Authorization Code       │ Web apps, mobile apps, SPAs.        │
  │ (+ PKCE)                 │ The most common and most secure.    │
  │                          │ User is present and interactive.    │
  ├──────────────────────────┼─────────────────────────────────────┤
  │ Client Credentials       │ Server-to-server. No user involved. │
  │                          │ "My backend needs to call your API."│
  ├──────────────────────────┼─────────────────────────────────────┤
  │ Device Authorization     │ Devices without browsers (smart TV, │
  │                          │ CLI tools, IoT devices).            │
  ├──────────────────────────┼─────────────────────────────────────┤
  │ Implicit (DEPRECATED)    │ Don't use. Was for SPAs before PKCE │
  │                          │ existed. Insecure by design.        │
  ├──────────────────────────┼─────────────────────────────────────┤
  │ Resource Owner Password  │ Don't use. Only for migration from  │
  │ (DEPRECATED)             │ legacy systems.                     │
  └──────────────────────────┴─────────────────────────────────────┘
```

---

## The Big Picture Flow (Authorization Code)

This is the most important flow. We'll cover it in detail next lesson,
but here's the overview:

```
AUTHORIZATION CODE FLOW (simplified)

  User          Client           Auth Server       Resource Server
  (Browser)     (CoolCal)        (Google Auth)     (Google Calendar)
  ────────      ──────────       ────────────      ────────────────

  1. Click "Connect Google Calendar"
  ──────────►

  2. Redirect to Google
              ─────────────────►
              "CoolCal wants to read
               your calendar. Allow?"

  3. User clicks "Allow"
  ──────────────────────────────►
                                 "OK. Here's an
                                  authorization CODE."

  4. Redirect back to CoolCal with CODE
              ◄─────────────────
              (via user's browser)

  5. CoolCal exchanges CODE for TOKEN
              ─────────────────►
              "Here's the code +
               my client secret"
                                 "Valid. Here's an
                                  access token."

  6. CoolCal uses TOKEN to access calendar
              ──────────────────────────────────────►
              "Bearer: token123"
                                                     "Here's the
                                                      calendar data."
```

**Why the code exchange?** Why doesn't Google just give the token
directly in step 4? Because step 4 happens through the user's browser
(a redirect URL). The browser URL is visible, logged in history, and
potentially leaked via the Referer header. The code is short-lived
and useless without the client secret. The actual token exchange
happens server-to-server (step 5), where it's safe.

---

## Scopes: Limiting Access

Scopes define what the client can do with the token:

```
SCOPES

  When CoolCal redirects to Google, it requests specific scopes:

  https://accounts.google.com/o/oauth2/auth?
    client_id=coolcal-123
    &scope=calendar.readonly         ← Only read calendar
    &redirect_uri=https://coolcal.com/callback
    &response_type=code

  Google shows the user:
  ┌────────────────────────────────────────────┐
  │ CoolCal wants to:                          │
  │                                            │
  │  ✓ View your Google Calendar events        │
  │                                            │
  │  [Allow]              [Deny]               │
  └────────────────────────────────────────────┘

  The resulting token can ONLY read calendar data.
  It can't read email, modify calendar, or access Drive.

  COMMON SCOPE EXAMPLES:
  ┌───────────────────────┬────────────────────────┐
  │ Provider  │ Scope     │ What it allows         │
  ├───────────┼───────────┼────────────────────────┤
  │ Google    │ calendar  │ Read/write calendar    │
  │ Google    │ calendar  │ Read-only calendar     │
  │           │ .readonly │                        │
  │ GitHub    │ repo      │ Full repo access       │
  │ GitHub    │ read:user │ Read user profile      │
  │ Slack     │ chat:write│ Post messages          │
  │ Spotify   │ playlist- │ Read playlists         │
  │           │ read-     │                        │
  │           │ private   │                        │
  └───────────┴───────────┴────────────────────────┘
```

---

## Tokens in OAuth 2.0

OAuth 2.0 issues two types of tokens:

```
ACCESS TOKEN vs REFRESH TOKEN

  ACCESS TOKEN
  ┌──────────────────────────────────────────┐
  │ Short-lived (minutes to hours)           │
  │ Sent with every API request              │
  │ Usually a JWT (but doesn't have to be)   │
  │ Contains scopes and expiration           │
  │                                          │
  │ Like a visitor badge that expires at 5pm │
  └──────────────────────────────────────────┘

  REFRESH TOKEN
  ┌──────────────────────────────────────────┐
  │ Long-lived (days to months)              │
  │ Used ONLY to get new access tokens       │
  │ NEVER sent to resource servers           │
  │ Stored securely, can be revoked          │
  │                                          │
  │ Like a membership card — show it at the  │
  │ front desk to get a new visitor badge    │
  └──────────────────────────────────────────┘

  Access token expires → Use refresh token to get a new one
  Refresh token revoked → User must re-authenticate
```

---

## Client Registration

Before a client can use OAuth, it must register with the authorization
server. This gives it:

```
CLIENT REGISTRATION

  ┌──────────────────────────────────────────────────┐
  │ Client ID:     coolcal-abc123                    │
  │ Client Secret: sk_live_7x9m2p4r8t1v3w5y         │
  │ Redirect URIs: https://coolcal.com/callback      │
  │ Allowed Scopes: calendar.readonly, calendar      │
  └──────────────────────────────────────────────────┘

  Client ID:     Public identifier. Included in URLs.
  Client Secret: PRIVATE. Never exposed to browsers.
                 Used in server-to-server token exchange.
  Redirect URIs: Where the auth server sends users back.
                 Must match EXACTLY to prevent redirect attacks.
```

**Confidential vs Public Clients**:

```
CLIENT TYPES

  CONFIDENTIAL CLIENT
  Can keep a secret (has a backend server).
  Examples: traditional web apps, backend services.
  Uses client_id + client_secret for token exchange.

  PUBLIC CLIENT
  CANNOT keep a secret (code is visible to users).
  Examples: SPAs (JavaScript), mobile apps, desktop apps.
  Uses PKCE instead of client_secret (covered next lesson).
```

---

## OAuth 2.0 Is NOT Authentication

This is the most common misconception. OAuth 2.0 is an
**authorization** framework. It grants access to resources.

```
WHAT OAUTH 2.0 TELLS YOU

  ✓ "This token has permission to read the calendar."
  ✗ "The user is Alice."

  OAuth 2.0 gives you a token for accessing resources.
  It does NOT give you information about WHO the user is.

  For authentication (identity), you need OpenID Connect (OIDC),
  which is a layer built ON TOP of OAuth 2.0.
  (Covered in Lesson 10)
```

When people say "Log in with Google," they're actually using
OpenID Connect, not plain OAuth 2.0. OIDC adds an ID token that
contains user identity information.

---

## Security Fundamentals

```
OAUTH 2.0 SECURITY REQUIREMENTS

  1. ALWAYS use HTTPS
     Tokens in URLs and headers MUST be encrypted in transit.

  2. VALIDATE redirect URIs exactly
     An open redirect lets attackers steal authorization codes.

  3. USE the state parameter
     Prevents CSRF attacks on the callback URL.

  4. KEEP client secrets secret
     Never in frontend code, never in version control.

  5. USE PKCE for public clients
     Prevents authorization code interception attacks.

  6. VALIDATE tokens on the resource server
     Don't trust tokens blindly — verify signature and claims.

  7. USE short-lived access tokens
     15 minutes is a good default. Use refresh tokens for longevity.
```

---

## Exercises

1. **Map the roles**: Pick three apps you use that have "Sign in with
   Google/GitHub/Facebook." For each, identify the four OAuth roles
   (resource owner, client, auth server, resource server).

2. **Scope design**: You're building a photo storage service. Design
   the OAuth scopes you'd offer to third-party apps. Consider:
   read photos, upload photos, delete photos, read albums, share
   albums. How granular should scopes be?

3. **Pre-OAuth thinking**: Before OAuth existed, how would you let a
   third-party app access your email? What are all the problems with
   that approach?

4. **Client types**: Classify each as confidential or public client:
   (a) Node.js web server, (b) React SPA, (c) iOS app,
   (d) Python CLI tool, (e) Raspberry Pi IoT device.
   Which can use client_secret? Which need PKCE?

---

[Next: Lesson 08 — Authorization Code Flow](./08-oauth2-auth-code.md)
