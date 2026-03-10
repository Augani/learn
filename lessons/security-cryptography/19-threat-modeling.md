# Lesson 19: Threat Modeling — Thinking Like an Attacker

You have built the system. It compiles. It passes tests. It handles traffic.
But have you sat down and asked: "How would someone break this?" Most teams
skip this question until after a breach, when the answer arrives as an invoice
from a forensics firm. Threat modeling is the practice of systematically
answering that question before attackers do it for you.

---

## The Analogy

Threat modeling is like hiring a security consultant to walk through a new
building before it opens. The consultant checks every door, every window,
every ventilation shaft, every loading dock. They do not just look at the
front entrance with the fancy deadbolt. They check the bathroom window that
someone left unlocked, the roof access hatch with no alarm, the shared
parking garage that connects to the basement. They ask one question over and
over: "How would a burglar get in?"

Your software has doors (APIs), windows (browser interfaces), ventilation
shafts (third-party integrations), loading docks (file upload endpoints), and
a basement (database). Threat modeling is the systematic walk-through.

---

## What Is Threat Modeling?

Threat modeling is a structured process for identifying security threats to a
system, ranking them by severity, and planning defenses. It is not a one-time
event. You do it when you design a system, when you add a feature, and when
you change your architecture.

The core questions:

1. **What are we building?** (architecture diagram)
2. **What could go wrong?** (threat enumeration)
3. **What are we going to do about it?** (mitigations)
4. **Did we do a good job?** (validation)

If you have ever drawn a system diagram on a whiteboard and someone pointed
at a line between two boxes and said "what if someone intercepts that?" —
congratulations, you have done informal threat modeling.

---

## The STRIDE Framework

Microsoft created STRIDE in the 1990s to give engineers a systematic way to
think about threats. Each letter represents a category of attack:

### S — Spoofing

Pretending to be someone or something you are not.

- A user logs in with stolen credentials
- An API call uses a forged JWT
- A DNS server returns a fake IP address
- An email comes from `ceo@company.com` but is actually from an attacker

**Building analogy:** Someone wearing a stolen employee badge walks into the
building. The badge is real, so the door opens.

### T — Tampering

Modifying data or code without authorization.

- A man-in-the-middle changes an API response in transit
- An attacker modifies a cookie to change their user ID
- A malicious insider alters database records directly
- A compromised CI pipeline injects malware into a build

**Building analogy:** Someone breaks into the mailroom and replaces invoices
with ones that redirect payments to their bank account.

### R — Repudiation

Denying that you did something, and nobody can prove otherwise.

- A user deletes their abusive messages and claims they never sent them
- An admin modifies records without an audit trail
- A transaction occurs but there is no log showing who initiated it
- A contractor accesses sensitive data and no one can prove it

**Building analogy:** A visitor enters the building, steals equipment, and
walks out. There are no security cameras and no sign-in sheet. Nobody can
prove they were ever there.

### I — Information Disclosure

Exposing data to people who should not see it.

- An API returns full user objects including password hashes
- Error messages reveal database schema or internal IP addresses
- Logs contain credit card numbers in plaintext
- An S3 bucket is publicly readable

**Building analogy:** The architect posts the building's blueprints, including
the alarm system layout and safe combinations, on a public notice board.

### D — Denial of Service

Making a system unavailable to legitimate users.

- A flood of requests overwhelms the server
- A regex takes exponential time on crafted input (ReDoS)
- An attacker fills disk space by uploading huge files
- A query with no LIMIT returns 10 million rows and crashes the app

**Building analogy:** Someone parks a truck across the only entrance to the
parking lot. Nobody can get in or out, even though the building itself is fine.

### E — Elevation of Privilege

Gaining permissions you should not have.

- A regular user accesses admin endpoints by guessing the URL
- SQL injection allows running arbitrary queries as the database superuser
- A container escape gives access to the host machine
- A misconfigured IAM role grants `*` permissions

**Building analogy:** A cleaning crew member discovers that the master key
was left in the janitor's closet. Now they can open every room, including the
vault.

---

## The Five-Step Threat Modeling Process

### Step 1: Draw the Architecture Diagram

You cannot find threats in a system you do not understand. Draw a Data Flow
Diagram (DFD) showing:

- **External entities:** users, third-party services, anything outside your control
- **Processes:** your APIs, workers, microservices
- **Data stores:** databases, caches, file storage, message queues
- **Data flows:** arrows showing how data moves between components
- **Trust boundaries:** lines showing where trust levels change

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET (untrusted)                     │
│                                                                 │
│   ┌──────────┐                           ┌──────────────────┐   │
│   │  Browser  │                           │  Third-Party API │   │
│   │  (User)   │                           │  (Stripe, etc.)  │   │
│   └─────┬─────┘                           └────────┬─────────┘   │
│         │                                          │             │
├─────────┼──────────────────────────────────────────┼─────────────┤
│         │           TRUST BOUNDARY: DMZ            │             │
│         ▼                                          ▼             │
│   ┌───────────┐                           ┌──────────────┐      │
│   │   Load    │                           │   Webhook    │      │
│   │  Balancer │                           │   Receiver   │      │
│   └─────┬─────┘                           └──────┬───────┘      │
│         │                                        │              │
├─────────┼────────────────────────────────────────┼──────────────┤
│         │       TRUST BOUNDARY: INTERNAL NETWORK │              │
│         ▼                                        ▼              │
│   ┌───────────┐    ┌───────────┐    ┌──────────────────┐       │
│   │  API      │───>│  Auth     │    │  Background      │       │
│   │  Server   │    │  Service  │    │  Worker           │       │
│   └─────┬─────┘    └─────┬─────┘    └────────┬─────────┘       │
│         │                │                    │                 │
│         ▼                ▼                    ▼                 │
│   ┌───────────┐    ┌───────────┐    ┌──────────────────┐       │
│   │ PostgreSQL│    │   Redis   │    │   S3 / Blob      │       │
│   │           │    │  (cache)  │    │   Storage         │       │
│   └───────────┘    └───────────┘    └──────────────────┘       │
│                                                                 │
│                TRUST BOUNDARY: DATA LAYER                       │
└─────────────────────────────────────────────────────────────────┘
```

### Step 2: Identify Trust Boundaries

A trust boundary is a line where the level of trust changes. Data crossing a
trust boundary must be validated, authenticated, or encrypted.

Common trust boundaries:

| Boundary | Why It Matters |
|---|---|
| Internet → Load Balancer | Untrusted input enters your system |
| Load Balancer → API Server | Internal network, but LB might not validate |
| API Server → Database | App code becomes database client |
| API Server → Third-Party API | Your data leaves your infrastructure |
| Browser → API | User-controlled client talks to your server |
| Container → Host | Isolation boundary, escape = full compromise |
| Microservice A → Microservice B | Internal service-to-service trust |

### Step 3: Enumerate Threats Per Boundary

Walk each trust boundary and apply STRIDE. For every data flow crossing a
boundary, ask all six questions:

```
Boundary: Browser → API Server
─────────────────────────────

[S] Spoofing:       Can someone impersonate a legitimate user?
[T] Tampering:      Can request data be modified in transit?
[R] Repudiation:    Can a user deny performing an action?
[I] Info Disclosure: Does the API leak internal information in errors?
[D] Denial of Svc:  Can someone flood the API with requests?
[E] Elev of Priv:   Can a regular user access admin endpoints?
```

Do this for EVERY boundary. Yes, it takes time. That is the point.

### Step 4: Rank by Risk

Not all threats are equal. A SQL injection on your login page is more urgent
than a theoretical timing attack on your About page. Use this formula:

```
Risk = Likelihood × Impact
```

**Likelihood factors:**

- How hard is the attack to execute?
- Does it require special access or knowledge?
- Are there known exploits or tools?
- Is the attack surface exposed to the internet?

**Impact factors:**

- What data could be compromised?
- How many users are affected?
- What is the business cost (downtime, fines, reputation)?
- Can the damage be reversed?

Simple risk matrix:

```
                    Impact
                Low    Medium    High
           ┌────────┬──────────┬──────────┐
    High   │ Medium │   High   │ Critical │
Likelihood ├────────┼──────────┼──────────┤
    Medium │  Low   │  Medium  │   High   │
           ├────────┼──────────┼──────────┤
    Low    │  Low   │   Low    │  Medium  │
           └────────┴──────────┴──────────┘
```

### Step 5: Decide on Mitigations

For each threat, you have four options:

1. **Mitigate:** Implement a control (add authentication, encrypt data, add rate limiting)
2. **Transfer:** Move the risk to someone else (buy insurance, use a managed service)
3. **Accept:** Acknowledge the risk and do nothing (low likelihood, low impact)
4. **Avoid:** Remove the feature that creates the risk

Most threats get mitigated. The key is being explicit about which threats you
are accepting and why.

---

## DREAD Scoring

DREAD provides a more granular scoring system than the simple risk matrix.
Rate each factor from 1 (low) to 10 (high):

| Factor | Question | Example (SQL Injection) |
|---|---|---|
| **D**amage | How bad is it if the attack succeeds? | 10 — full database access |
| **R**eproducibility | How easy to reproduce? | 10 — same payload works every time |
| **E**xploitability | How easy to execute? | 8 — automated tools exist |
| **A**ffected Users | How many users impacted? | 10 — all users in the database |
| **D**iscoverability | How easy to find the vulnerability? | 7 — scanners detect it |

**DREAD Score = (D + R + E + A + D) / 5**

For SQL injection: (10 + 10 + 8 + 10 + 7) / 5 = **9.0** (Critical)

Compare with a less severe threat — an error message that reveals the
framework version:

| Factor | Score |
|---|---|
| Damage | 2 — only reveals info, no direct compromise |
| Reproducibility | 10 — trigger an error, done |
| Exploitability | 3 — info is useful only for further attacks |
| Affected Users | 1 — no users directly affected |
| Discoverability | 10 — any error triggers it |

DREAD Score: (2 + 10 + 3 + 1 + 10) / 5 = **5.2** (Medium)

DREAD helps you have data-driven conversations about where to spend your
limited security engineering time.

---

## Attack Trees

An attack tree is a hierarchical diagram showing all the ways an attacker
could achieve a goal. The root is the attacker's objective, and each branch
is a different path to get there.

```
                    ┌──────────────────────┐
                    │  Steal User Data     │
                    │  (attacker's goal)   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
       │ Compromise  │  │ Compromise │  │ Intercept   │
       │ Application │  │ Database   │  │ Network     │
       └──────┬──────┘  └─────┬──────┘  └──────┬──────┘
              │               │                │
        ┌─────┼─────┐    ┌───┼───┐       ┌────┼────┐
        │     │     │    │   │   │       │    │    │
       ┌▼┐   ┌▼┐  ┌▼┐  ┌▼┐ ┌▼┐ ┌▼┐   ┌▼┐  ┌▼┐  ┌▼┐
       │A│   │B│  │C│  │D│ │E│ │F│   │G│  │H│  │I│
       └─┘   └─┘  └─┘  └─┘ └─┘ └─┘   └─┘  └─┘  └─┘

A = SQL injection          D = Stolen DB creds    G = Man-in-the-middle
B = Broken auth (session)  E = Exposed backup     H = DNS hijacking
C = IDOR vulnerability     F = SQL dump on S3     I = WiFi sniffing
```

Each leaf node becomes a specific threat to evaluate and mitigate. Attack
trees make it visual — you can see that blocking SQL injection removes one
entire branch, but the attacker still has two other paths.

---

## Real-World Breach: Capital One (2019)

**What happened:** A former AWS employee exploited a misconfigured WAF
(Web Application Firewall) to access EC2 metadata via a Server-Side Request
Forgery (SSRF) attack. This gave her temporary AWS credentials, which she
used to access S3 buckets containing 100 million customer records.

**What a threat model would have caught:**

- Trust boundary between WAF and application was not analyzed
- The WAF had permissions to access the EC2 metadata endpoint
- SSRF was a known threat for applications running on cloud infrastructure
- The IAM role attached to the application was overly permissive
- No one asked: "What happens if the WAF itself is compromised?"

**STRIDE analysis would flag:**

- **Spoofing:** WAF spoofed as the application to access metadata
- **Elevation of Privilege:** WAF's IAM role had access far beyond what it needed
- **Information Disclosure:** 100M records exposed via S3

---

## Hands-On: Threat Model a Web Application

Let us threat model a realistic web application: an e-commerce API with
user authentication, product catalog, order management, and payment
processing.

### The Architecture

```
┌──────────┐     HTTPS      ┌───────────┐     HTTP     ┌───────────┐
│  React   │ ──────────────> │   Nginx   │ ───────────> │  Go API   │
│  SPA     │ <────────────── │   Proxy   │ <─────────── │  Server   │
└──────────┘                 └───────────┘              └─────┬─────┘
                                                              │
                              ┌────────────────┬──────────────┤
                              │                │              │
                         ┌────▼────┐    ┌──────▼────┐  ┌─────▼──────┐
                         │ Postgres│    │   Redis   │  │   Stripe   │
                         │   DB    │    │  Sessions │  │    API     │
                         └─────────┘    └───────────┘  └────────────┘
```

### Trust Boundaries

1. **Internet → Nginx:** Untrusted users hit the proxy
2. **Nginx → Go API:** Proxy to application server
3. **Go API → PostgreSQL:** App to database
4. **Go API → Redis:** App to session store
5. **Go API → Stripe:** App to payment processor
6. **Browser → SPA:** User to client-side code

### Threat Enumeration (13 Threats)

| # | Boundary | STRIDE | Threat | DREAD Score |
|---|---|---|---|---|
| T1 | Internet→Nginx | S | Attacker uses stolen session cookie | 8.2 |
| T2 | Internet→Nginx | D | DDoS overwhelms Nginx, takes down site | 7.0 |
| T3 | Internet→Nginx | T | Request body tampered (price changed) | 6.4 |
| T4 | Browser→SPA | I | Sensitive data in JavaScript bundle | 5.0 |
| T5 | SPA→API | S | Forged JWT bypasses authentication | 8.8 |
| T6 | SPA→API | E | Regular user accesses `/admin/*` endpoints | 9.0 |
| T7 | SPA→API | T | User modifies order after submission (race condition) | 6.8 |
| T8 | SPA→API | R | User disputes purchase, no audit trail | 5.6 |
| T9 | API→Postgres | I | SQL injection leaks customer data | 9.4 |
| T10 | API→Postgres | T | Mass assignment allows modifying `is_admin` field | 7.6 |
| T11 | API→Redis | S | Session fixation — attacker sets victim's session ID | 7.4 |
| T12 | API→Stripe | I | Stripe secret key leaked in error logs | 8.0 |
| T13 | API→Stripe | T | Webhook from Stripe not verified, attacker sends fake | 7.8 |

### Prioritized Mitigations

```
CRITICAL (Score >= 9.0):
━━━━━━━━━━━━━━━━━━━━━━━━
T9  — SQL injection
      Mitigation: Parameterized queries everywhere. Use sqlx/pgx with
                  query parameters, never string concatenation.
                  Add WAF rules for common SQL injection patterns.

T6  — Privilege escalation to admin
      Mitigation: Authorization middleware on every route.
                  Role check at the handler level, not just URL pattern.
                  Separate admin API with additional auth factor.

HIGH (Score 7.0 - 8.9):
━━━━━━━━━━━━━━━━━━━━━━━
T5  — Forged JWT
      Mitigation: Validate signature on every request. Use RS256 not HS256
                  for asymmetric verification. Short expiry (15 min).
                  Reject none algorithm.

T1  — Stolen session
      Mitigation: HttpOnly, Secure, SameSite=Strict cookies.
                  Bind session to IP/User-Agent fingerprint.
                  Session rotation on privilege change.

T12 — Stripe key in logs
      Mitigation: Structured logging with field redaction.
                  Never log full request/response to Stripe.
                  Secret scanning in CI.

T13 — Fake Stripe webhook
      Mitigation: Verify webhook signature using Stripe's signing secret.
                  Reject requests without valid signature.
                  Timestamp tolerance to prevent replay.

T10 — Mass assignment
      Mitigation: Explicit field allowlists on every endpoint.
                  Separate DTOs for create/update — never bind directly
                  to the database model.

T11 — Session fixation
      Mitigation: Regenerate session ID on login.
                  Reject client-supplied session IDs.
                  Use server-generated cryptographic random IDs.

T2  — DDoS
      Mitigation: Rate limiting per IP. Cloudflare or AWS Shield.
                  Connection limits in Nginx. Request size limits.

MEDIUM (Score 5.0 - 6.9):
━━━━━━━━━━━━━━━━━━━━━━━━━
T7  — Race condition on orders
      Mitigation: Database-level locking (SELECT FOR UPDATE).
                  Idempotency keys on payment endpoints.

T3  — Price tampering
      Mitigation: Server-side price lookup — never trust client-sent prices.
                  Validate totals server-side before charging.

T8  — No audit trail
      Mitigation: Append-only audit log for all purchases.
                  Log user ID, action, timestamp, IP, request details.

T4  — Secrets in JS bundle
      Mitigation: Never put API keys or secrets in frontend code.
                  Use backend-for-frontend pattern for sensitive calls.
```

---

## Building the Threat Model in Code

Here is a Go struct that represents a threat model programmatically, useful
for tracking threats in version control alongside your code:

```go
package threatmodel

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"time"
)

type Severity string

const (
	SeverityCritical Severity = "CRITICAL"
	SeverityHigh     Severity = "HIGH"
	SeverityMedium   Severity = "MEDIUM"
	SeverityLow      Severity = "LOW"
)

type DREADScore struct {
	Damage          int `json:"damage"`
	Reproducibility int `json:"reproducibility"`
	Exploitability  int `json:"exploitability"`
	AffectedUsers   int `json:"affected_users"`
	Discoverability int `json:"discoverability"`
}

func (d DREADScore) Average() float64 {
	sum := d.Damage + d.Reproducibility + d.Exploitability + d.AffectedUsers + d.Discoverability
	return float64(sum) / 5.0
}

func (d DREADScore) Severity() Severity {
	avg := d.Average()
	switch {
	case avg >= 9.0:
		return SeverityCritical
	case avg >= 7.0:
		return SeverityHigh
	case avg >= 5.0:
		return SeverityMedium
	default:
		return SeverityLow
	}
}

type STRIDECategory string

const (
	Spoofing             STRIDECategory = "Spoofing"
	Tampering            STRIDECategory = "Tampering"
	Repudiation          STRIDECategory = "Repudiation"
	InformationDisclosure STRIDECategory = "Information Disclosure"
	DenialOfService      STRIDECategory = "Denial of Service"
	ElevationOfPrivilege STRIDECategory = "Elevation of Privilege"
)

type MitigationStatus string

const (
	StatusOpen       MitigationStatus = "OPEN"
	StatusInProgress MitigationStatus = "IN_PROGRESS"
	StatusMitigated  MitigationStatus = "MITIGATED"
	StatusAccepted   MitigationStatus = "ACCEPTED"
)

type Threat struct {
	ID          string           `json:"id"`
	Title       string           `json:"title"`
	Description string           `json:"description"`
	Boundary    string           `json:"boundary"`
	Category    STRIDECategory   `json:"stride_category"`
	DREAD       DREADScore       `json:"dread"`
	Mitigation  string           `json:"mitigation"`
	Status      MitigationStatus `json:"status"`
	Owner       string           `json:"owner"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

type ThreatModel struct {
	Name        string    `json:"name"`
	Version     string    `json:"version"`
	Description string    `json:"description"`
	Boundaries  []string  `json:"trust_boundaries"`
	Threats     []Threat  `json:"threats"`
	ReviewedAt  time.Time `json:"reviewed_at"`
	ReviewedBy  string    `json:"reviewed_by"`
}

func (tm *ThreatModel) SortByRisk() {
	sort.Slice(tm.Threats, func(i, j int) bool {
		return tm.Threats[i].DREAD.Average() > tm.Threats[j].DREAD.Average()
	})
}

func (tm *ThreatModel) OpenThreats() []Threat {
	var open []Threat
	for _, t := range tm.Threats {
		if t.Status == StatusOpen || t.Status == StatusInProgress {
			open = append(open, t)
		}
	}
	return open
}

func (tm *ThreatModel) PrintReport() {
	tm.SortByRisk()
	fmt.Printf("Threat Model: %s (v%s)\n", tm.Name, tm.Version)
	fmt.Printf("Last reviewed: %s by %s\n\n", tm.ReviewedAt.Format("2006-01-02"), tm.ReviewedBy)

	for _, t := range tm.Threats {
		fmt.Printf("[%s] %s (DREAD: %.1f — %s)\n",
			t.Status, t.Title, t.DREAD.Average(), t.DREAD.Severity())
		fmt.Printf("  Boundary: %s | Category: %s\n", t.Boundary, t.Category)
		fmt.Printf("  Mitigation: %s\n\n", t.Mitigation)
	}
}

func (tm *ThreatModel) SaveToFile(path string) error {
	data, err := json.MarshalIndent(tm, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal threat model: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}

func LoadThreatModel(path string) (*ThreatModel, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read threat model: %w", err)
	}
	var tm ThreatModel
	if err := json.Unmarshal(data, &tm); err != nil {
		return nil, fmt.Errorf("unmarshal threat model: %w", err)
	}
	return &tm, nil
}
```

And the TypeScript equivalent for teams that track threat models in their
Node.js projects:

```typescript
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

type STRIDECategory =
  | "Spoofing"
  | "Tampering"
  | "Repudiation"
  | "Information Disclosure"
  | "Denial of Service"
  | "Elevation of Privilege";

type MitigationStatus = "OPEN" | "IN_PROGRESS" | "MITIGATED" | "ACCEPTED";

interface DREADScore {
  damage: number;
  reproducibility: number;
  exploitability: number;
  affectedUsers: number;
  discoverability: number;
}

interface Threat {
  id: string;
  title: string;
  description: string;
  boundary: string;
  category: STRIDECategory;
  dread: DREADScore;
  mitigation: string;
  status: MitigationStatus;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

interface ThreatModel {
  name: string;
  version: string;
  description: string;
  trustBoundaries: string[];
  threats: Threat[];
  reviewedAt: string;
  reviewedBy: string;
}

function dreadAverage(score: DREADScore): number {
  const sum =
    score.damage +
    score.reproducibility +
    score.exploitability +
    score.affectedUsers +
    score.discoverability;
  return sum / 5;
}

function dreadSeverity(score: DREADScore): Severity {
  const avg = dreadAverage(score);
  if (avg >= 9) return "CRITICAL";
  if (avg >= 7) return "HIGH";
  if (avg >= 5) return "MEDIUM";
  return "LOW";
}

function sortByRisk(threats: Threat[]): Threat[] {
  return [...threats].sort(
    (a, b) => dreadAverage(b.dread) - dreadAverage(a.dread)
  );
}

function openThreats(model: ThreatModel): Threat[] {
  return model.threats.filter(
    (t) => t.status === "OPEN" || t.status === "IN_PROGRESS"
  );
}

function printReport(model: ThreatModel): void {
  const sorted = sortByRisk(model.threats);
  console.log(`Threat Model: ${model.name} (v${model.version})`);
  console.log(`Last reviewed: ${model.reviewedAt} by ${model.reviewedBy}\n`);

  for (const threat of sorted) {
    const avg = dreadAverage(threat.dread);
    const sev = dreadSeverity(threat.dread);
    console.log(`[${threat.status}] ${threat.title} (DREAD: ${avg.toFixed(1)} — ${sev})`);
    console.log(`  Boundary: ${threat.boundary} | Category: ${threat.category}`);
    console.log(`  Mitigation: ${threat.mitigation}\n`);
  }
}

function buildExampleModel(): ThreatModel {
  return {
    name: "E-Commerce API",
    version: "1.0",
    description: "Threat model for the main e-commerce platform",
    trustBoundaries: [
      "Internet → Nginx",
      "Nginx → Go API",
      "Go API → PostgreSQL",
      "Go API → Redis",
      "Go API → Stripe",
    ],
    reviewedAt: new Date().toISOString(),
    reviewedBy: "security-team",
    threats: [
      {
        id: "T9",
        title: "SQL injection on search endpoint",
        description: "User-controlled input in product search is concatenated into SQL",
        boundary: "Go API → PostgreSQL",
        category: "Information Disclosure",
        dread: {
          damage: 10,
          reproducibility: 10,
          exploitability: 8,
          affectedUsers: 10,
          discoverability: 9,
        },
        mitigation: "Use parameterized queries via pgx. Add sqlc for type-safe SQL.",
        status: "OPEN",
        owner: "backend-team",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "T6",
        title: "Privilege escalation to admin",
        description: "No authorization middleware on /admin routes",
        boundary: "Nginx → Go API",
        category: "Elevation of Privilege",
        dread: {
          damage: 10,
          reproducibility: 9,
          exploitability: 8,
          affectedUsers: 10,
          discoverability: 8,
        },
        mitigation: "Add RBAC middleware. Require admin role for all /admin/* endpoints.",
        status: "IN_PROGRESS",
        owner: "backend-team",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}
```

---

## Threat Modeling Template

Copy this template for every new system or major feature:

```markdown
# Threat Model: [System/Feature Name]

**Version:** 1.0
**Date:** YYYY-MM-DD
**Author:** [Name]
**Reviewers:** [Names]
**Status:** Draft | In Review | Approved

## 1. System Description

[2-3 sentences describing what the system does and who uses it.]

## 2. Architecture Diagram

[Paste ASCII diagram or link to diagram tool export]

## 3. Trust Boundaries

| # | Boundary | Description |
|---|---|---|
| B1 | Internet → API Gateway | Untrusted user traffic enters the system |
| B2 | API → Database | Application accesses persistent storage |
| ... | ... | ... |

## 4. Assets

[What are we protecting?]

- User PII (names, emails, addresses)
- Payment information
- Authentication credentials
- Business logic (pricing algorithms, etc.)

## 5. Threat Enumeration

| ID | Boundary | STRIDE | Threat | DREAD | Severity | Status |
|----|----------|--------|--------|-------|----------|--------|
| T1 | B1 | S | ... | 8.2 | HIGH | OPEN |
| T2 | B1 | D | ... | 7.0 | HIGH | MITIGATED |
| ... | ... | ... | ... | ... | ... | ... |

## 6. Mitigations

| Threat ID | Mitigation | Owner | Deadline | Status |
|-----------|------------|-------|----------|--------|
| T1 | Implement rate limiting | @eng | Q1 | OPEN |
| ... | ... | ... | ... | ... |

## 7. Accepted Risks

| Threat ID | Risk | Justification |
|-----------|------|---------------|
| T99 | Low-volume scraping | Cost of mitigation exceeds damage |

## 8. Review Schedule

- [ ] Initial review: [Date]
- [ ] Quarterly review: [Date]
- [ ] Post-incident review: As needed
- [ ] Architecture change review: As needed
```

---

## When to Threat Model

- **New system design:** Before writing code, when changes are cheap
- **New feature:** Especially if it touches auth, payments, or user data
- **Architecture changes:** New services, new dependencies, new data flows
- **After a breach:** Update the model with what you missed
- **Quarterly:** Review existing models for staleness

The biggest mistake teams make is treating threat modeling as a one-time
checkbox. Threats evolve. Your system evolves. Your threat model must evolve
with them.

---

## Real-World Breach: Equifax (2017)

**What happened:** Equifax failed to patch a known Apache Struts vulnerability
(CVE-2017-5638) for over two months after the patch was available. Attackers
exploited it to access 147 million personal records.

**What a threat model would have caught:**

- The trust boundary between the internet and the Apache Struts application
  was high-risk
- The DREAD score for an unpatched RCE vulnerability would be 10/10/10/10/10
  — a perfect 10
- Patch management was not listed as a mitigation for the public-facing
  web application
- The attack tree for "steal customer data" would include "exploit known
  CVE in web framework" as the very first leaf node

Threat modeling does not prevent all breaches. But it makes it very hard to
miss the obvious ones. And the obvious ones are how most companies get
compromised.

---

## Exercises

1. **Threat model your current project.** Draw the architecture diagram,
   identify trust boundaries, enumerate at least 10 threats using STRIDE,
   score them with DREAD, and write mitigations.

2. **Build an attack tree** for the goal "gain unauthorized access to the
   database." Include at least three major branches with two or more leaf
   nodes each.

3. **Score these threats with DREAD:** (a) XSS on a profile page, (b) SSRF
   in an image proxy, (c) hardcoded AWS credentials in a public repo,
   (d) timing attack on password comparison. Rank them and justify your
   ranking.

4. **Review the Capital One breach.** Using the threat model template above,
   write the threat model that should have existed before the breach. What
   threats would it have caught? Which mitigations would have prevented the
   breach?

5. **Automate threat tracking.** Use the Go or TypeScript code above to
   create a threat model for your project, serialize it to JSON, and commit
   it to your repo. Write a CI check that fails if any CRITICAL threats have
   status "OPEN" for more than 7 days.

---

## Key Takeaways

- Threat modeling is systematic, not ad hoc. Use frameworks (STRIDE, DREAD)
  to avoid gaps.
- Draw the diagram first. You cannot find threats in a system you have not
  mapped.
- Trust boundaries are where attacks happen. Focus your analysis there.
- Not all threats are equal. Score them and fix the critical ones first.
- Threat models are living documents. Review them regularly and update them
  when the system changes.
- The best time to threat model is during design. The second-best time is now.
