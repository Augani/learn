# Authorization

## The Building Key Card System

Authentication gets you through the front door. Authorization determines which rooms your key card opens.

If authentication answers "who are you?", authorization answers "what can you do?" These are fundamentally different concerns, and confusing them is one of the most common security mistakes.

A real-world example of the distinction: your driver's license proves your identity (authentication). But whether you can drive a commercial truck depends on the class of license (authorization). Showing any valid ID to the truck rental company doesn't mean they should hand you the keys.

---

## Authentication vs Authorization

| | Authentication | Authorization |
|---|---------------|---------------|
| Question | Who are you? | What can you do? |
| Happens | Once (at login) | On every request |
| Mechanism | Password, MFA, token | Roles, permissions, policies |
| Failure | 401 Unauthorized | 403 Forbidden |
| Stored in | Session/token (who you are) | Database/policy engine (what you can access) |

A 401 means "I don't know who you are." A 403 means "I know who you are, and you're not allowed to do this." Using the wrong status code is a pet peeve of security reviewers, but it also leaks information — a 403 confirms the resource exists.

---

## RBAC: Role-Based Access Control

RBAC is the most common authorization model. Users are assigned roles, roles have permissions. Think of it like job titles in a company — the CEO can access everything, the intern can access the break room.

### How It Works

```
User → Role → Permissions

alice → admin    → [create, read, update, delete]
bob   → editor   → [create, read, update]
carol → viewer   → [read]
```

### Go RBAC Middleware

```go
package middleware

import (
    "context"
    "net/http"
    "slices"
)

type Role string

const (
    RoleAdmin  Role = "admin"
    RoleEditor Role = "editor"
    RoleViewer Role = "viewer"
)

var rolePermissions = map[Role][]string{
    RoleAdmin:  {"create", "read", "update", "delete", "manage_users"},
    RoleEditor: {"create", "read", "update"},
    RoleViewer: {"read"},
}

type contextKey string

const userContextKey contextKey = "user"

type User struct {
    ID   int
    Role Role
}

func RequirePermission(permission string, next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        user, ok := r.Context().Value(userContextKey).(*User)
        if !ok || user == nil {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }

        permissions, exists := rolePermissions[user.Role]
        if !exists {
            http.Error(w, "Forbidden", http.StatusForbidden)
            return
        }

        if !slices.Contains(permissions, permission) {
            http.Error(w, "Forbidden", http.StatusForbidden)
            return
        }

        next.ServeHTTP(w, r)
    }
}

func RequireRole(roles []Role, next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        user, ok := r.Context().Value(userContextKey).(*User)
        if !ok || user == nil {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }

        if !slices.Contains(roles, user.Role) {
            http.Error(w, "Forbidden", http.StatusForbidden)
            return
        }

        next.ServeHTTP(w, r)
    }
}
```

**Using the middleware:**

```go
func main() {
    mux := http.NewServeMux()

    mux.HandleFunc("GET /articles",
        RequirePermission("read", listArticles))

    mux.HandleFunc("POST /articles",
        RequirePermission("create", createArticle))

    mux.HandleFunc("DELETE /articles/{id}",
        RequirePermission("delete", deleteArticle))

    mux.HandleFunc("GET /admin/users",
        RequireRole([]Role{RoleAdmin}, listUsers))

    http.ListenAndServe(":8080", authMiddleware(mux))
}
```

### TypeScript RBAC Middleware

```typescript
type Role = "admin" | "editor" | "viewer";

interface UserPayload {
  id: number;
  role: Role;
}

const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  admin: new Set(["create", "read", "update", "delete", "manage_users"]),
  editor: new Set(["create", "read", "update"]),
  viewer: new Set(["read"]),
};

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const permissions = ROLE_PERMISSIONS[req.user.role];
    if (!permissions || !permissions.has(permission)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}

function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}
```

**Using the middleware:**

```typescript
app.get("/articles", requirePermission("read"), listArticles);
app.post("/articles", requirePermission("create"), createArticle);
app.delete("/articles/:id", requirePermission("delete"), deleteArticle);
app.get("/admin/users", requireRole("admin"), listUsers);
```

### RBAC Limitations

RBAC works well for simple permission structures. It breaks down when:
- You need fine-grained control ("editors can only edit their own articles")
- Permissions depend on context ("managers can approve expenses under $10,000")
- The number of roles explodes to handle edge cases

That's where ABAC comes in.

---

## ABAC: Attribute-Based Access Control

ABAC makes authorization decisions based on attributes of the user, the resource, the action, and the environment. Think of it like an airport security system — your access depends on your ticket class, your destination, the current time, and your security clearance level, all evaluated together.

### How It Works

Instead of checking `user.role == "admin"`, you evaluate a policy:

```
ALLOW IF:
  user.department == resource.department
  AND user.clearance >= resource.classification
  AND action == "read"
  AND environment.time BETWEEN 09:00 AND 17:00
```

### Go ABAC Example

```go
package authz

import "time"

type Subject struct {
    ID         int
    Role       string
    Department string
    Clearance  int
}

type Resource struct {
    ID             int
    OwnerID        int
    Department     string
    Classification int
}

type Environment struct {
    Time      time.Time
    IPAddress string
    IsVPN     bool
}

type Policy struct {
    Name     string
    Evaluate func(subject Subject, resource Resource, action string, env Environment) bool
}

var policies = []Policy{
    {
        Name: "owners can do anything with their resources",
        Evaluate: func(s Subject, r Resource, action string, e Environment) bool {
            return s.ID == r.OwnerID
        },
    },
    {
        Name: "same department can read during business hours",
        Evaluate: func(s Subject, r Resource, action string, e Environment) bool {
            return action == "read" &&
                s.Department == r.Department &&
                e.Time.Hour() >= 9 && e.Time.Hour() < 17
        },
    },
    {
        Name: "high clearance can read anything",
        Evaluate: func(s Subject, r Resource, action string, e Environment) bool {
            return action == "read" && s.Clearance >= r.Classification
        },
    },
    {
        Name: "admins can do anything from VPN",
        Evaluate: func(s Subject, r Resource, action string, e Environment) bool {
            return s.Role == "admin" && e.IsVPN
        },
    },
}

func IsAuthorized(subject Subject, resource Resource, action string, env Environment) bool {
    for _, policy := range policies {
        if policy.Evaluate(subject, resource, action, env) {
            return true
        }
    }
    return false
}
```

### TypeScript ABAC Example

```typescript
interface Subject {
  id: number;
  role: string;
  department: string;
  clearance: number;
}

interface Resource {
  id: number;
  ownerId: number;
  department: string;
  classification: number;
}

interface Environment {
  time: Date;
  ipAddress: string;
  isVPN: boolean;
}

type PolicyFn = (
  subject: Subject,
  resource: Resource,
  action: string,
  env: Environment
) => boolean;

interface Policy {
  name: string;
  evaluate: PolicyFn;
}

const policies: Policy[] = [
  {
    name: "owners can do anything with their resources",
    evaluate: (s, r) => s.id === r.ownerId,
  },
  {
    name: "same department can read during business hours",
    evaluate: (s, r, action, e) =>
      action === "read" &&
      s.department === r.department &&
      e.time.getHours() >= 9 &&
      e.time.getHours() < 17,
  },
  {
    name: "high clearance can read anything",
    evaluate: (s, r, action) =>
      action === "read" && s.clearance >= r.classification,
  },
  {
    name: "admins can do anything from VPN",
    evaluate: (s, _r, _action, e) => s.role === "admin" && e.isVPN,
  },
];

function isAuthorized(
  subject: Subject,
  resource: Resource,
  action: string,
  env: Environment
): boolean {
  return policies.some((policy) =>
    policy.evaluate(subject, resource, action, env)
  );
}
```

### ABAC vs RBAC

| | RBAC | ABAC |
|---|------|------|
| Simplicity | Simple to understand and implement | More complex, needs policy engine |
| Granularity | Coarse (role-level) | Fine-grained (attribute-level) |
| Flexibility | Need new roles for edge cases | Handles any condition |
| Audit | Easy — check role assignments | Harder — trace policy evaluation |
| Best for | Small-medium apps, clear hierarchies | Enterprise, complex access rules |

Many real systems use a hybrid: RBAC for broad categories, ABAC for fine-grained decisions within those categories.

---

## ACLs: Access Control Lists

ACLs attach permissions directly to resources. Think of it like a guest list on each individual door, rather than a master key card system.

```
Document "Q3 Report":
  alice: read, write
  bob: read
  finance-team: read, write

Document "Board Minutes":
  ceo: read, write
  board-members: read
```

ACLs are common in file systems (Unix permissions, Windows ACLs), cloud storage (S3 bucket policies), and collaborative tools (Google Docs sharing).

**Go ACL Example:**

```go
type Permission int

const (
    PermRead Permission = 1 << iota
    PermWrite
    PermDelete
    PermShare
)

type ACLEntry struct {
    SubjectID   string
    SubjectType string
    Permissions Permission
}

type ACL struct {
    ResourceID string
    Entries    []ACLEntry
}

func (acl *ACL) HasPermission(subjectID string, groups []string, perm Permission) bool {
    for _, entry := range acl.Entries {
        matchesSubject := entry.SubjectID == subjectID
        matchesGroup := entry.SubjectType == "group" && contains(groups, entry.SubjectID)

        if (matchesSubject || matchesGroup) && entry.Permissions&perm != 0 {
            return true
        }
    }
    return false
}

func contains(slice []string, item string) bool {
    for _, s := range slice {
        if s == item {
            return true
        }
    }
    return false
}
```

---

## OAuth 2.0 Deep Dive

OAuth 2.0 is primarily an authorization framework. It lets a user grant a third-party application limited access to their resources without sharing their password.

### The Valet Key Analogy

A valet key for your car lets the valet drive it, but it won't open the trunk or glove compartment. OAuth works the same way — it grants limited, scoped access to specific resources.

### Authorization Code Flow (The Secure Way)

This is the flow used by "Login with Google," "Login with GitHub," etc.

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐
│  Browser  │     │  Your Server │     │ Auth Provider  │
│  (User)   │     │  (Client)    │     │ (Google, etc.) │
└─────┬─────┘     └──────┬───────┘     └───────┬────────┘
      │                  │                      │
      │ 1. Click "Login  │                      │
      │    with Google"  │                      │
      │─────────────────>│                      │
      │                  │                      │
      │ 2. Redirect to   │                      │
      │    Google         │                      │
      │<─────────────────│                      │
      │                  │                      │
      │ 3. User logs in  │                      │
      │    at Google,     │                      │
      │    grants consent │                      │
      │──────────────────────────────────────────>│
      │                  │                      │
      │ 4. Google redirects back                │
      │    with auth code │                      │
      │<──────────────────────────────────────────│
      │                  │                      │
      │ 5. Browser sends │                      │
      │    code to server│                      │
      │─────────────────>│                      │
      │                  │ 6. Exchange code      │
      │                  │    for tokens         │
      │                  │    (server-to-server) │
      │                  │─────────────────────>│
      │                  │                      │
      │                  │ 7. Access token       │
      │                  │    + Refresh token    │
      │                  │<─────────────────────│
      │                  │                      │
      │ 8. Logged in!    │                      │
      │<─────────────────│                      │
```

**Step 2 — The Authorization URL:**

```
https://accounts.google.com/o/oauth2/auth?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://yourapp.com/callback&
  scope=openid email profile&
  state=random_csrf_token
```

- `response_type=code` — we want an authorization code
- `client_id` — identifies your application
- `redirect_uri` — where to send the user after approval
- `scope` — what access we're requesting
- `state` — CSRF protection (random value, verified on callback)

### PKCE: Proof Key for Code Exchange

The basic authorization code flow has a vulnerability: if an attacker intercepts the authorization code (possible on mobile or through browser history), they can exchange it for tokens.

PKCE (pronounced "pixie") adds a challenge that proves the party exchanging the code is the same party that requested it.

**How PKCE works:**

```
1. Client generates a random string: code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
2. Client hashes it: code_challenge = BASE64URL(SHA256(code_verifier))
                                    = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
3. Client sends code_challenge in the authorization request
4. Auth server stores code_challenge with the authorization code
5. Client sends code_verifier in the token exchange
6. Auth server hashes code_verifier and compares with stored code_challenge
```

An interceptor who captures the authorization code doesn't have the `code_verifier`, so they can't complete the exchange.

**Go OAuth 2.0 + PKCE Implementation:**

```go
package main

import (
    "crypto/rand"
    "crypto/sha256"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "os"
    "strings"
)

type OAuthConfig struct {
    ClientID     string
    ClientSecret string
    AuthURL      string
    TokenURL     string
    RedirectURI  string
    Scopes       []string
}

type TokenResponse struct {
    AccessToken  string `json:"access_token"`
    TokenType    string `json:"token_type"`
    ExpiresIn    int    `json:"expires_in"`
    RefreshToken string `json:"refresh_token"`
    IDToken      string `json:"id_token"`
}

var config = OAuthConfig{
    ClientID:     os.Getenv("OAUTH_CLIENT_ID"),
    ClientSecret: os.Getenv("OAUTH_CLIENT_SECRET"),
    AuthURL:      "https://accounts.google.com/o/oauth2/auth",
    TokenURL:     "https://oauth2.googleapis.com/token",
    RedirectURI:  "https://yourapp.com/callback",
    Scopes:       []string{"openid", "email", "profile"},
}

func generatePKCE() (verifier, challenge string, err error) {
    buf := make([]byte, 32)
    if _, err := rand.Read(buf); err != nil {
        return "", "", fmt.Errorf("generating random bytes: %w", err)
    }

    verifier = base64.RawURLEncoding.EncodeToString(buf)

    hash := sha256.Sum256([]byte(verifier))
    challenge = base64.RawURLEncoding.EncodeToString(hash[:])

    return verifier, challenge, nil
}

func generateState() (string, error) {
    buf := make([]byte, 16)
    if _, err := rand.Read(buf); err != nil {
        return "", fmt.Errorf("generating state: %w", err)
    }
    return base64.RawURLEncoding.EncodeToString(buf), nil
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
    verifier, challenge, err := generatePKCE()
    if err != nil {
        http.Error(w, "Internal error", http.StatusInternalServerError)
        return
    }

    state, err := generateState()
    if err != nil {
        http.Error(w, "Internal error", http.StatusInternalServerError)
        return
    }

    session, _ := store.Get(r, "oauth-session")
    session.Values["pkce_verifier"] = verifier
    session.Values["oauth_state"] = state
    session.Save(r, w)

    params := url.Values{
        "response_type":         {"code"},
        "client_id":             {config.ClientID},
        "redirect_uri":          {config.RedirectURI},
        "scope":                 {strings.Join(config.Scopes, " ")},
        "state":                 {state},
        "code_challenge":        {challenge},
        "code_challenge_method": {"S256"},
    }

    authURL := config.AuthURL + "?" + params.Encode()
    http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func callbackHandler(w http.ResponseWriter, r *http.Request) {
    session, _ := store.Get(r, "oauth-session")

    savedState, ok := session.Values["oauth_state"].(string)
    if !ok || savedState != r.URL.Query().Get("state") {
        http.Error(w, "Invalid state parameter", http.StatusBadRequest)
        return
    }

    if errMsg := r.URL.Query().Get("error"); errMsg != "" {
        http.Error(w, "OAuth error: "+errMsg, http.StatusBadRequest)
        return
    }

    code := r.URL.Query().Get("code")
    if code == "" {
        http.Error(w, "Missing authorization code", http.StatusBadRequest)
        return
    }

    verifier, ok := session.Values["pkce_verifier"].(string)
    if !ok {
        http.Error(w, "Missing PKCE verifier", http.StatusBadRequest)
        return
    }

    tokenResp, err := exchangeCode(code, verifier)
    if err != nil {
        http.Error(w, "Token exchange failed", http.StatusInternalServerError)
        return
    }

    delete(session.Values, "pkce_verifier")
    delete(session.Values, "oauth_state")
    session.Values["access_token"] = tokenResp.AccessToken
    session.Save(r, w)

    http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
}

func exchangeCode(code, verifier string) (*TokenResponse, error) {
    data := url.Values{
        "grant_type":    {"authorization_code"},
        "code":          {code},
        "redirect_uri":  {config.RedirectURI},
        "client_id":     {config.ClientID},
        "client_secret": {config.ClientSecret},
        "code_verifier": {verifier},
    }

    resp, err := http.PostForm(config.TokenURL, data)
    if err != nil {
        return nil, fmt.Errorf("token request: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("token endpoint returned %d", resp.StatusCode)
    }

    var tokenResp TokenResponse
    if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
        return nil, fmt.Errorf("decoding token response: %w", err)
    }

    return &tokenResp, nil
}
```

### Scopes

Scopes limit what the access token can do. They're the valet key restrictions:

```
openid        → Basic identity information
email         → User's email address
profile       → Name, picture
drive.readonly → Read Google Drive files (can't modify)
repo          → Full access to GitHub repositories
```

Always request the minimum scopes needed. Users are more likely to approve limited access, and a compromised token can do less damage.

### Refresh Tokens

Access tokens expire quickly (typically 1 hour). Refresh tokens are long-lived tokens used to get new access tokens without re-prompting the user.

```
Access Token:  Short-lived pass (1 hour) → use for API calls
Refresh Token: Long-lived master key     → use to get new access tokens
```

```go
func refreshAccessToken(refreshToken string) (*TokenResponse, error) {
    data := url.Values{
        "grant_type":    {"refresh_token"},
        "refresh_token": {refreshToken},
        "client_id":     {config.ClientID},
        "client_secret": {config.ClientSecret},
    }

    resp, err := http.PostForm(config.TokenURL, data)
    if err != nil {
        return nil, fmt.Errorf("refresh request: %w", err)
    }
    defer resp.Body.Close()

    var tokenResp TokenResponse
    if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
        return nil, fmt.Errorf("decoding response: %w", err)
    }

    return &tokenResp, nil
}
```

---

## OpenID Connect (OIDC)

OAuth 2.0 is about authorization (accessing resources). OpenID Connect is an identity layer built on top of OAuth 2.0 that adds authentication (proving who the user is).

### What OIDC Adds

- **ID Token:** A JWT that contains user identity claims (name, email, etc.)
- **UserInfo Endpoint:** A standardized endpoint to fetch user profile data
- **Discovery:** A `.well-known/openid-configuration` endpoint that describes the provider's capabilities

The ID token is the key addition. It's a JWT signed by the identity provider that says "this person is alice@example.com, and I verified it."

```json
{
  "iss": "https://accounts.google.com",
  "sub": "1234567890",
  "aud": "your-client-id",
  "exp": 1700000000,
  "iat": 1699996400,
  "email": "alice@example.com",
  "email_verified": true,
  "name": "Alice Smith"
}
```

### OAuth 2.0 vs OpenID Connect

| | OAuth 2.0 | OpenID Connect |
|---|----------|----------------|
| Purpose | Authorization (access to resources) | Authentication (prove identity) |
| Token | Access token (opaque) | ID token (JWT with claims) |
| Scope | Custom (repo, drive.readonly) | Standardized (openid, profile, email) |
| User info | No standard | Standardized UserInfo endpoint |
| Use case | "Let app X access my photos" | "Login with Google" |

In practice, "Login with Google" uses both: OIDC for identity (the ID token tells you who the user is) and OAuth 2.0 for authorization (the access token lets you read their profile).

---

## Authorization Design Principles

### 1. Default Deny

Never default to allowing access. Every resource should be inaccessible unless explicitly permitted:

```go
func authorize(user *User, resource *Resource, action string) error {
    if user == nil {
        return ErrUnauthorized
    }

    if !hasExplicitPermission(user, resource, action) {
        return ErrForbidden
    }

    return nil
}
```

### 2. Enforce at the Right Layer

Check authorization as close to the data as possible. UI-level checks are supplements, not replacements:

```
UI Layer:        Hide the "Delete" button for non-admins (UX, not security)
API Layer:       Check permissions on every request (security)
Data Layer:      Filter queries by ownership (defense in depth)
```

### 3. Don't Roll Your Own (For Complex Needs)

For simple RBAC, a middleware function is fine. For complex authorization logic, consider dedicated tools:

- **OPA (Open Policy Agent)** — Policy-as-code engine, great for microservices
- **Casbin** — Library that supports RBAC, ABAC, ACLs in one interface
- **Zanzibar** — Google's global authorization system (SpiceDB is the open-source implementation)

### 4. Audit Everything

Every authorization decision should be logged:

```go
func authorizeAndLog(user *User, resource *Resource, action string) error {
    err := authorize(user, resource, action)

    log.Printf("authz decision: user=%d resource=%s action=%s result=%v",
        user.ID, resource.ID, action, err == nil)

    return err
}
```

When a breach happens, the first question is always "who accessed what?" Without authorization logs, you can't answer it.
