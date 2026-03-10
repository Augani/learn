# CORS, CSRF, and Browser Security

## Apartment Building Security

The browser's security model is like apartment building security. Residents (scripts from the same origin) can freely access their apartment (same-origin data). But visitors from outside (cross-origin scripts) need explicit permission from the resident (CORS headers) to enter.

Without this boundary, any website you visit could read your bank's webpage, steal your email, or impersonate you on social media — all silently, because your browser helpfully sends your cookies with every request to those sites.

---

## Same-Origin Policy

The Same-Origin Policy (SOP) is the foundational security boundary of the web. Two URLs have the same origin if and only if they share the same **scheme**, **host**, and **port**.

```
https://example.com:443/page
  │         │         │
  scheme    host     port

Same origin:
  https://example.com/page-a   and   https://example.com/page-b     ✓
  https://example.com:443/page and   https://example.com/page        ✓ (443 is default for https)

Different origin:
  https://example.com  and  http://example.com      ✗ (different scheme)
  https://example.com  and  https://api.example.com  ✗ (different host)
  https://example.com  and  https://example.com:8080 ✗ (different port)
```

### What SOP Blocks

When JavaScript on `https://evil.com` tries to interact with `https://bank.com`:

| Action | Allowed? | Why |
|--------|----------|-----|
| Navigate to bank.com (link, redirect) | Yes | Navigation is always allowed |
| Embed bank.com images, scripts, CSS | Yes | Embedding is allowed (but can't read content) |
| Read bank.com's response from fetch/XHR | No | Cross-origin reads are blocked |
| Read bank.com's cookies from JS | No | Cookies are scoped by domain |
| Submit a form to bank.com | Yes | Form submissions are allowed (this is the CSRF problem) |

The key insight: the browser **sends** the request (with cookies), but **blocks the response** from being read by the script. This is why CSRF works — the request goes through, cookies and all. The attacker doesn't need to read the response; the side effect (money transfer, password change) already happened.

---

## CORS: Cross-Origin Resource Sharing

CORS is the mechanism for relaxing the Same-Origin Policy in a controlled way. It lets the server say "I'm okay with requests from these specific origins."

### Simple Requests

Some requests are "simple" (GET, HEAD, POST with basic content types). The browser sends them directly with an `Origin` header:

```
Browser → Server:
  GET /api/data HTTP/1.1
  Origin: https://frontend.example.com

Server → Browser:
  HTTP/1.1 200 OK
  Access-Control-Allow-Origin: https://frontend.example.com

  {"data": "here"}
```

If the `Access-Control-Allow-Origin` header matches the request's `Origin` (or is `*`), the browser lets JavaScript read the response. If not, the browser blocks it.

### Preflight Requests

For "non-simple" requests (PUT, DELETE, custom headers, JSON content type), the browser sends a preflight OPTIONS request first:

```
Browser → Server (preflight):
  OPTIONS /api/data HTTP/1.1
  Origin: https://frontend.example.com
  Access-Control-Request-Method: PUT
  Access-Control-Request-Headers: Content-Type, Authorization

Server → Browser (preflight response):
  HTTP/1.1 204 No Content
  Access-Control-Allow-Origin: https://frontend.example.com
  Access-Control-Allow-Methods: GET, PUT, DELETE
  Access-Control-Allow-Headers: Content-Type, Authorization
  Access-Control-Max-Age: 86400

Browser → Server (actual request):
  PUT /api/data HTTP/1.1
  Origin: https://frontend.example.com
  Content-Type: application/json
  Authorization: Bearer <token>

  {"key": "value"}
```

The preflight asks "am I allowed to send this kind of request?" If the server says yes, the browser sends the actual request. `Access-Control-Max-Age` caches the preflight result so subsequent requests skip it.

### Credentials (Cookies)

By default, cross-origin requests don't include cookies. To include them:

**Client side:**
```javascript
fetch("https://api.example.com/data", {
  credentials: "include"
});
```

**Server side:**
```
Access-Control-Allow-Origin: https://frontend.example.com  (cannot be *)
Access-Control-Allow-Credentials: true
```

When credentials are included, `Access-Control-Allow-Origin` cannot be `*`. You must specify the exact origin. This prevents any site from reading authenticated responses.

### Common CORS Misconfigurations

**Mistake 1: Reflecting the Origin header (wildcard equivalent)**

```go
func badCORS(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
    w.Header().Set("Access-Control-Allow-Credentials", "true")
}
```

This accepts every origin with credentials. Any site can make authenticated cross-origin requests and read the responses.

**Mistake 2: Allowing null origin**

```
Access-Control-Allow-Origin: null
```

Sandboxed iframes and local files send `Origin: null`. Allowing it opens up attacks from those contexts.

**Mistake 3: Partial domain matching**

```go
origin := r.Header.Get("Origin")
if strings.HasSuffix(origin, ".example.com") {
    w.Header().Set("Access-Control-Allow-Origin", origin)
}
```

This matches `evil-example.com` because it ends in `.example.com`. Always match the full domain.

### Go CORS Configuration

```go
package middleware

import (
    "net/http"
    "slices"
)

type CORSConfig struct {
    AllowedOrigins   []string
    AllowedMethods   []string
    AllowedHeaders   []string
    AllowCredentials bool
    MaxAge           int
}

func CORS(cfg CORSConfig) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            origin := r.Header.Get("Origin")
            if origin == "" {
                next.ServeHTTP(w, r)
                return
            }

            if !slices.Contains(cfg.AllowedOrigins, origin) {
                next.ServeHTTP(w, r)
                return
            }

            w.Header().Set("Access-Control-Allow-Origin", origin)
            w.Header().Set("Vary", "Origin")

            if cfg.AllowCredentials {
                w.Header().Set("Access-Control-Allow-Credentials", "true")
            }

            if r.Method == http.MethodOptions {
                w.Header().Set("Access-Control-Allow-Methods",
                    joinStrings(cfg.AllowedMethods))
                w.Header().Set("Access-Control-Allow-Headers",
                    joinStrings(cfg.AllowedHeaders))
                if cfg.MaxAge > 0 {
                    w.Header().Set("Access-Control-Max-Age",
                        fmt.Sprintf("%d", cfg.MaxAge))
                }
                w.WriteHeader(http.StatusNoContent)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

**Usage:**

```go
corsMiddleware := CORS(CORSConfig{
    AllowedOrigins:   []string{"https://frontend.example.com"},
    AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE"},
    AllowedHeaders:   []string{"Content-Type", "Authorization"},
    AllowCredentials: true,
    MaxAge:           86400,
})

http.ListenAndServe(":8080", corsMiddleware(router))
```

### TypeScript CORS Configuration

```typescript
import cors from "cors";

const allowedOrigins = ["https://frontend.example.com"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);
```

**Manual implementation without the cors package:**

```typescript
function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.sendStatus(204);
  }

  next();
}
```

---

## CSRF: Cross-Site Request Forgery

### The Forged Signature Attack

CSRF is like someone forging your signature while your pen is still warm. The attacker creates a malicious page that makes your browser send a request to a site where you're already logged in. Because your browser automatically includes cookies, the request is indistinguishable from a legitimate one.

### How CSRF Works

1. You log into `https://bank.com` — your browser now has a session cookie
2. You visit `https://evil.com` (maybe you clicked a link in an email)
3. evil.com contains: `<form action="https://bank.com/transfer" method="POST"><input type="hidden" name="to" value="attacker"><input type="hidden" name="amount" value="10000"></form><script>document.forms[0].submit();</script>`
4. Your browser submits the form to bank.com **with your session cookie**
5. bank.com sees a valid authenticated request and processes the transfer
6. You just sent $10,000 to the attacker

The attacker never sees your cookie or bank.com's response. They don't need to. The side effect (the transfer) is enough.

### CSRF Defense 1: SameSite Cookies

The simplest and most effective defense. SameSite controls when cookies are sent with cross-origin requests:

| Value | Behavior |
|-------|----------|
| `Strict` | Cookie only sent on same-site requests. Never sent on cross-site navigation. |
| `Lax` | Cookie sent on same-site requests AND cross-site top-level navigation (clicking a link). Not sent on cross-site POST/PUT/DELETE/AJAX. |
| `None` | Cookie always sent (requires `Secure` flag). |

```go
http.SetCookie(w, &http.Cookie{
    Name:     "session",
    Value:    sessionID,
    HttpOnly: true,
    Secure:   true,
    SameSite: http.SameSiteLaxMode,
    Path:     "/",
    MaxAge:   3600,
})
```

```typescript
res.cookie("session", sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: 3600000,
});
```

`Lax` is the default in modern browsers and blocks CSRF POST attacks while allowing normal link navigation. `Strict` blocks everything cross-site, which can break legitimate flows (user clicks a link to your site from an email and isn't logged in).

### CSRF Defense 2: CSRF Tokens

For defense in depth (and to support older browsers), use CSRF tokens. The server generates a random token, embeds it in the form, and validates it on submission. The attacker can't include the correct token because they can't read responses from your origin.

**Go CSRF Token Implementation:**

```go
package csrf

import (
    "crypto/rand"
    "encoding/hex"
    "net/http"
    "sync"
)

type CSRFProtection struct {
    tokens map[string]bool
    mu     sync.RWMutex
}

func New() *CSRFProtection {
    return &CSRFProtection{
        tokens: make(map[string]bool),
    }
}

func (c *CSRFProtection) GenerateToken() (string, error) {
    buf := make([]byte, 32)
    if _, err := rand.Read(buf); err != nil {
        return "", err
    }

    token := hex.EncodeToString(buf)

    c.mu.Lock()
    c.tokens[token] = true
    c.mu.Unlock()

    return token, nil
}

func (c *CSRFProtection) ValidateToken(token string) bool {
    c.mu.Lock()
    defer c.mu.Unlock()

    valid := c.tokens[token]
    if valid {
        delete(c.tokens, token)
    }
    return valid
}

func (c *CSRFProtection) Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.Method == http.MethodGet || r.Method == http.MethodHead {
            token, err := c.GenerateToken()
            if err != nil {
                http.Error(w, "Internal error", http.StatusInternalServerError)
                return
            }

            http.SetCookie(w, &http.Cookie{
                Name:     "csrf_token",
                Value:    token,
                HttpOnly: false,
                Secure:   true,
                SameSite: http.SameSiteStrictMode,
                Path:     "/",
            })

            next.ServeHTTP(w, r)
            return
        }

        token := r.Header.Get("X-CSRF-Token")
        if token == "" {
            token = r.FormValue("csrf_token")
        }

        if !c.ValidateToken(token) {
            http.Error(w, "Invalid CSRF token", http.StatusForbidden)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

The cookie isn't HttpOnly because JavaScript needs to read it to include it in AJAX request headers. The attacker can't read the cookie from a different origin (Same-Origin Policy prevents it), so they can't forge the header.

**TypeScript CSRF Token Implementation:**

```typescript
import crypto from "crypto";

const csrfTokens = new Map<string, number>();

function generateCSRFToken(): string {
  const token = crypto.randomBytes(32).toString("hex");
  csrfTokens.set(token, Date.now());
  return token;
}

function validateCSRFToken(token: string): boolean {
  const timestamp = csrfTokens.get(token);
  if (!timestamp) {
    return false;
  }

  csrfTokens.delete(token);

  const maxAge = 3600 * 1000;
  if (Date.now() - timestamp > maxAge) {
    return false;
  }

  return true;
}

function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD") {
    const token = generateCSRFToken();
    res.cookie("csrf_token", token, {
      httpOnly: false,
      secure: true,
      sameSite: "strict",
    });
    return next();
  }

  const token =
    req.headers["x-csrf-token"] || (req.body && req.body.csrf_token);

  if (typeof token !== "string" || !validateCSRFToken(token)) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
}
```

**Client-side usage:**

```javascript
async function submitForm(data) {
  const csrfToken = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrf_token="))
    ?.split("=")[1];

  const response = await fetch("/api/transfer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  return response.json();
}
```

### CSRF Defense 3: Checking the Origin Header

The `Origin` and `Referer` headers indicate where a request came from. If the origin doesn't match your domain, reject the request:

```go
func checkOrigin(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.Method == http.MethodGet || r.Method == http.MethodHead {
            next.ServeHTTP(w, r)
            return
        }

        origin := r.Header.Get("Origin")
        if origin == "" {
            origin = r.Header.Get("Referer")
        }

        if origin == "" {
            http.Error(w, "Missing origin", http.StatusForbidden)
            return
        }

        allowedOrigins := []string{
            "https://example.com",
            "https://www.example.com",
        }

        originAllowed := false
        for _, allowed := range allowedOrigins {
            if strings.HasPrefix(origin, allowed) {
                originAllowed = true
                break
            }
        }

        if !originAllowed {
            http.Error(w, "Invalid origin", http.StatusForbidden)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

This isn't sufficient alone (some browsers or privacy extensions strip these headers), but it's a good additional layer.

---

## Clickjacking

### The Invisible Frame Attack

Clickjacking is like putting a transparent sheet over a door handle so when you think you're pressing an elevator button, you're actually pressing the fire alarm.

The attacker embeds your site in a transparent iframe on their page. They position it so that when the user clicks what looks like a harmless button on the attacker's page, they're actually clicking a button on your site (which they're authenticated to).

### The Attack

```html
<!-- evil.com -->
<style>
  iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    z-index: 2;
  }
  .bait {
    position: absolute;
    top: 300px;
    left: 400px;
    z-index: 1;
  }
</style>

<div class="bait">
  <h1>Click here to win a prize!</h1>
</div>

<iframe src="https://bank.com/settings?action=delete_account"></iframe>
```

The user sees "Click here to win a prize!" but actually clicks a button on bank.com.

### Defense: X-Frame-Options and CSP

**X-Frame-Options (legacy but widely supported):**

```go
w.Header().Set("X-Frame-Options", "DENY")
```

| Value | Behavior |
|-------|----------|
| `DENY` | Cannot be framed by any site |
| `SAMEORIGIN` | Can only be framed by same-origin pages |

**CSP frame-ancestors (modern, more flexible):**

```go
w.Header().Set("Content-Security-Policy", "frame-ancestors 'none'")
```

```go
w.Header().Set("Content-Security-Policy", "frame-ancestors 'self' https://trusted.example.com")
```

**TypeScript:**

```typescript
import helmet from "helmet";

app.use(
  helmet({
    frameguard: { action: "deny" },
    contentSecurityPolicy: {
      directives: {
        frameAncestors: ["'none'"],
      },
    },
  })
);
```

---

## Putting It All Together: Security Headers

A properly secured application should send all of these headers:

**Go:**

```go
func securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'")

        w.Header().Set("X-Content-Type-Options", "nosniff")

        w.Header().Set("X-Frame-Options", "DENY")

        w.Header().Set("Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload")

        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

        w.Header().Set("Permissions-Policy",
            "camera=(), microphone=(), geolocation=()")

        next.ServeHTTP(w, r)
    })
}
```

**TypeScript:**

```typescript
import helmet from "helmet";

app.use(helmet());

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  })
);

app.use(
  helmet.hsts({
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  })
);

app.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));

app.use(
  helmet.permittedCrossDomainPolicies({
    permittedPolicies: "none",
  })
);
```

### Header Reference

| Header | Purpose |
|--------|---------|
| `Content-Security-Policy` | Controls what resources the browser can load |
| `X-Content-Type-Options: nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options: DENY` | Prevents clickjacking |
| `Strict-Transport-Security` | Forces HTTPS for all future requests |
| `Referrer-Policy` | Controls how much referrer info is sent |
| `Permissions-Policy` | Restricts browser feature access (camera, mic, etc.) |

---

## Quick Reference: Defense Matrix

| Attack | Primary Defense | Additional Layers |
|--------|----------------|-------------------|
| Cross-origin data theft | Same-Origin Policy + proper CORS | Don't reflect Origin, validate origins |
| CSRF | SameSite cookies (Lax/Strict) | CSRF tokens, Origin header check |
| Clickjacking | CSP frame-ancestors / X-Frame-Options | JavaScript frame-busting (legacy) |
| XSS (enabling CSRF bypass) | CSP, output encoding | HttpOnly cookies, input validation |
| Session hijacking | HttpOnly + Secure cookies | Short session lifetime, binding to IP/UA |

These defenses stack. No single mechanism is foolproof, but together they create a defense that's hard to breach. A CSRF attack bypasses SameSite? The CSRF token catches it. XSS bypasses the CSRF token? CSP blocks the injected script. Each layer protects against the failure of the layers before it.
