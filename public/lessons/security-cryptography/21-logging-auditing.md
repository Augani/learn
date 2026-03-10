# Lesson 21: Security Logging, Auditing, and Incident Response

When something goes wrong — and it will — your logs are the difference
between "we detected and contained the breach in 20 minutes" and "we found
out 6 months later when a journalist called." Security logging is not the
same as application logging. Application logs tell you what your code did.
Security logs tell you what happened to your system and who did it.

---

## The Analogy

Security logging is like the security camera system in a bank:

- **Cameras record everything.** Every person who enters, every transaction,
  every access to the vault. (Comprehensive security logging.)
- **Footage is stored in a tamper-proof vault.** The cameras feed to a
  locked room that even the bank manager cannot edit. If someone tampers
  with the footage, you can tell. (Log integrity with hash chains.)
- **A monitoring station watches feeds in real time.** A guard notices if
  someone is behaving suspiciously — casing the vault, trying doors, wearing
  a mask. (SIEM alerts and anomaly detection.)
- **When something goes wrong, you review the footage.** Who entered when?
  Where did they go? What did they take? (Forensic investigation.)
- **You lock down the building.** Block the exits, secure the vault, call
  the police. (Incident containment.)
- **You catch the thief and repair the damage.** (Eradication and recovery.)
- **You update your security plan.** More cameras? Better locks? Different
  procedures? (Post-mortem and improvements.)

Without the cameras, you have no idea what happened, when it happened, or
who did it. You are operating blind.

---

## What to Log for Security

Every security-relevant event needs a log entry. Here is the complete list:

### Authentication Events

- Successful login (who, when, from where)
- Failed login (who tried, from where, how many times)
- Password change
- Password reset request
- MFA enrollment, use, and failure
- Session creation and destruction
- Token generation and revocation
- Account lockout and unlock

### Authorization Events

- Access denied (who tried to access what)
- Permission changes (who granted what to whom)
- Role changes (who was promoted/demoted)
- Resource access across ownership boundaries (user A accessed user B's data)

### Administrative Actions

- User creation and deletion
- Configuration changes
- Feature flag changes
- Deployment events
- Database migrations
- Secret rotation
- Firewall rule changes

### Data Access

- Bulk data exports
- API queries returning large result sets
- Access to sensitive data (PII, financial records)
- Database admin tool usage

### System Events

- Application startup and shutdown
- Health check failures
- Rate limit triggers
- Input validation failures (often a sign of probing)
- Error spikes (may indicate attack in progress)
- Certificate expiration warnings

---

## What NOT to Log

This is equally important. Logging the wrong things creates new
vulnerabilities:

| Never Log | Why |
|---|---|
| Passwords (even failed ones) | If logs leak, all passwords are compromised |
| Session tokens | Attackers can hijack sessions from log files |
| API keys / secrets | Leaked logs = leaked credentials |
| Credit card numbers | PCI-DSS violation, massive liability |
| Social Security numbers | PII violation, legal liability |
| Full request bodies with PII | May contain forms with sensitive fields |
| JWT tokens | Contains claims and can be replayed |
| Encryption keys | Defeats the purpose of encryption entirely |
| Medical records (PHI) | HIPAA violation |

### The Rule

Log the **event** and **metadata**, never the **sensitive content**.

```
BAD:  User login failed with password "hunter2" from 192.168.1.1
GOOD: Login failed for user_id=12345 from ip=192.168.1.1 reason=invalid_password attempt=3
```

```
BAD:  API call with key "sk_live_abc123xyz..." returned 200
GOOD: API call authenticated via api_key_id=key_7a3b from ip=10.0.0.5 returned 200
```

---

## Structured Security Logs

Plain text logs are hard to search and impossible to analyze at scale. Use
structured logging (JSON) with consistent fields:

```json
{
  "timestamp": "2024-03-15T14:23:01.456Z",
  "level": "warn",
  "event": "authentication.login_failed",
  "actor": {
    "user_id": "user_12345",
    "ip": "203.0.113.42",
    "user_agent": "Mozilla/5.0..."
  },
  "target": {
    "resource": "session",
    "action": "create"
  },
  "context": {
    "reason": "invalid_password",
    "attempt_count": 3,
    "account_locked": false
  },
  "request": {
    "id": "req_abc123",
    "method": "POST",
    "path": "/api/auth/login"
  },
  "service": {
    "name": "auth-service",
    "version": "1.4.2",
    "environment": "production"
  }
}
```

### Required Fields for Every Security Log

| Field | Purpose |
|---|---|
| `timestamp` | When (ISO 8601, UTC always) |
| `event` | What happened (namespaced: `auth.login_failed`) |
| `actor.user_id` | Who did it (or "anonymous") |
| `actor.ip` | Where they came from |
| `target.resource` | What was affected |
| `target.action` | What they tried to do |
| `request.id` | Trace across services |
| `level` | Severity (info, warn, error) |

---

## Real-World Breach: SolarWinds (2020)

**What happened:** Attackers compromised SolarWinds' build pipeline and
injected a backdoor into the Orion software update. The malicious update
was distributed to 18,000 organizations including US government agencies.
The attack went undetected for over 9 months.

**Why logging matters here:**

- The attackers specifically targeted logging systems to avoid detection
- They mimicked legitimate SolarWinds network traffic patterns
- Insufficient logging at the build pipeline level meant no one noticed the
  code modification
- Organizations that had comprehensive DNS logging and network traffic
  analysis detected the anomalous C2 (command and control) traffic faster
- FireEye (the company that discovered it) found it because they detected
  unauthorized access to their own Red Team tools — through their security
  monitoring

The lesson: even nation-state attackers can be detected if your logging is
thorough enough and your alerting is tuned correctly.

---

## Security Audit Logging Middleware in Go

```go
package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

type EventType string

const (
	EventAuthLogin         EventType = "auth.login"
	EventAuthLoginFailed   EventType = "auth.login_failed"
	EventAuthLogout        EventType = "auth.logout"
	EventAuthPasswordChange EventType = "auth.password_change"
	EventAccessDenied      EventType = "authz.access_denied"
	EventDataAccess        EventType = "data.access"
	EventDataExport        EventType = "data.export"
	EventAdminAction       EventType = "admin.action"
	EventConfigChange      EventType = "config.change"
	EventRateLimited       EventType = "security.rate_limited"
	EventInputValidation   EventType = "security.input_validation"
)

type Actor struct {
	UserID    string `json:"user_id,omitempty"`
	IP        string `json:"ip"`
	UserAgent string `json:"user_agent,omitempty"`
	SessionID string `json:"session_id,omitempty"`
}

type Target struct {
	Resource   string `json:"resource"`
	ResourceID string `json:"resource_id,omitempty"`
	Action     string `json:"action"`
}

type AuditEntry struct {
	Timestamp   time.Time              `json:"timestamp"`
	Level       string                 `json:"level"`
	Event       EventType              `json:"event"`
	Actor       Actor                  `json:"actor"`
	Target      Target                 `json:"target"`
	Context     map[string]interface{} `json:"context,omitempty"`
	RequestID   string                 `json:"request_id"`
	ServiceName string                 `json:"service"`
	Success     bool                   `json:"success"`
}

type AuditLogger struct {
	mu          sync.Mutex
	writer      io.Writer
	serviceName string
}

func NewAuditLogger(writer io.Writer, serviceName string) *AuditLogger {
	return &AuditLogger{
		writer:      writer,
		serviceName: serviceName,
	}
}

func (al *AuditLogger) Log(entry AuditEntry) error {
	entry.Timestamp = time.Now().UTC()
	entry.ServiceName = al.serviceName

	data, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("marshal audit entry: %w", err)
	}

	al.mu.Lock()
	defer al.mu.Unlock()

	_, err = al.writer.Write(append(data, '\n'))
	return err
}

type contextKey string

const (
	requestIDKey contextKey = "request_id"
	actorKey     contextKey = "actor"
)

func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey, id)
}

func RequestIDFromContext(ctx context.Context) string {
	id, ok := ctx.Value(requestIDKey).(string)
	if !ok {
		return "unknown"
	}
	return id
}

func WithActor(ctx context.Context, actor Actor) context.Context {
	return context.WithValue(ctx, actorKey, actor)
}

func ActorFromContext(ctx context.Context) Actor {
	actor, ok := ctx.Value(actorKey).(Actor)
	if !ok {
		return Actor{UserID: "anonymous"}
	}
	return actor
}

func AuditMiddleware(logger *AuditLogger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestID := r.Header.Get("X-Request-ID")
			if requestID == "" {
				requestID = generateRequestID()
			}

			actor := Actor{
				IP:        extractIP(r),
				UserAgent: r.UserAgent(),
			}

			ctx := WithRequestID(r.Context(), requestID)
			ctx = WithActor(ctx, actor)
			r = r.WithContext(ctx)

			recorder := &statusRecorder{ResponseWriter: w, status: 200}

			next.ServeHTTP(recorder, r)

			if recorder.status == http.StatusUnauthorized || recorder.status == http.StatusForbidden {
				logger.Log(AuditEntry{
					Level: "warn",
					Event: EventAccessDenied,
					Actor: actor,
					Target: Target{
						Resource: r.URL.Path,
						Action:   r.Method,
					},
					Context: map[string]interface{}{
						"status_code": recorder.status,
					},
					RequestID: requestID,
					Success:   false,
				})
			}
		})
	}
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func extractIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		return forwarded
	}
	return r.RemoteAddr
}

func generateRequestID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("req_%x", b)
}
```

Using the audit logger in authentication handlers:

```go
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	user, err := h.userStore.Authenticate(req.Email, req.Password)
	if err != nil {
		h.audit.Log(AuditEntry{
			Level: "warn",
			Event: EventAuthLoginFailed,
			Actor: ActorFromContext(r.Context()),
			Target: Target{
				Resource: "session",
				Action:   "create",
			},
			Context: map[string]interface{}{
				"email":  req.Email,
				"reason": "invalid_credentials",
			},
			RequestID: RequestIDFromContext(r.Context()),
			Success:   false,
		})

		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	h.audit.Log(AuditEntry{
		Level: "info",
		Event: EventAuthLogin,
		Actor: Actor{
			UserID:    user.ID,
			IP:        extractIP(r),
			UserAgent: r.UserAgent(),
		},
		Target: Target{
			Resource: "session",
			Action:   "create",
		},
		RequestID: RequestIDFromContext(r.Context()),
		Success:   true,
	})

	h.createSession(w, user)
}
```

---

## Security Audit Logging in TypeScript

```typescript
import { randomBytes } from "crypto";
import { Request, Response, NextFunction } from "express";

type SecurityEvent =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.password_change"
  | "authz.access_denied"
  | "data.access"
  | "data.export"
  | "admin.action"
  | "config.change"
  | "security.rate_limited"
  | "security.input_validation";

interface Actor {
  userId?: string;
  ip: string;
  userAgent?: string;
  sessionId?: string;
}

interface Target {
  resource: string;
  resourceId?: string;
  action: string;
}

interface AuditEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  event: SecurityEvent;
  actor: Actor;
  target: Target;
  context?: Record<string, unknown>;
  requestId: string;
  service: string;
  success: boolean;
}

type AuditWriter = (entry: AuditEntry) => void;

function createAuditLogger(serviceName: string, writer: AuditWriter) {
  return {
    log(
      event: SecurityEvent,
      level: AuditEntry["level"],
      actor: Actor,
      target: Target,
      success: boolean,
      requestId: string,
      context?: Record<string, unknown>
    ): void {
      const entry: AuditEntry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        actor,
        target,
        context,
        requestId,
        service: serviceName,
        success,
      };
      writer(entry);
    },
  };
}

const stdoutWriter: AuditWriter = (entry) => {
  process.stdout.write(JSON.stringify(entry) + "\n");
};

const auditLogger = createAuditLogger("auth-service", stdoutWriter);

function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId =
    (req.headers["x-request-id"] as string) ||
    `req_${randomBytes(8).toString("hex")}`;

  (req as any).requestId = requestId;
  (req as any).actor = {
    ip: req.ip || req.socket.remoteAddress || "unknown",
    userAgent: req.headers["user-agent"],
  };

  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      auditLogger.log(
        "authz.access_denied",
        "warn",
        (req as any).actor,
        { resource: req.path, action: req.method },
        false,
        requestId,
        { statusCode: res.statusCode }
      );
    }
    return originalEnd.apply(this, args);
  } as any;

  next();
}

function logLogin(req: Request, userId: string): void {
  auditLogger.log(
    "auth.login",
    "info",
    { userId, ip: req.ip || "unknown", userAgent: req.headers["user-agent"] },
    { resource: "session", action: "create" },
    true,
    (req as any).requestId
  );
}

function logLoginFailed(req: Request, email: string, reason: string): void {
  auditLogger.log(
    "auth.login_failed",
    "warn",
    (req as any).actor,
    { resource: "session", action: "create" },
    false,
    (req as any).requestId,
    { email, reason }
  );
}

function logDataExport(req: Request, userId: string, recordCount: number): void {
  auditLogger.log(
    "data.export",
    "info",
    { userId, ip: req.ip || "unknown" },
    { resource: "users", action: "export" },
    true,
    (req as any).requestId,
    { recordCount }
  );
}
```

---

## Log Integrity: Hash Chains

If an attacker gains access to your system, the first thing they do is try
to cover their tracks by modifying or deleting logs. Hash chains make log
tampering detectable.

The concept is the same as a blockchain: each log entry includes a hash of
the previous entry. If anyone modifies an older entry, all subsequent hashes
break.

```
Entry 1: { data: "login success", hash: SHA256("" + data) }
                                          ↓
Entry 2: { data: "file access",   hash: SHA256(entry1.hash + data) }
                                          ↓
Entry 3: { data: "logout",        hash: SHA256(entry2.hash + data) }
```

If an attacker modifies Entry 2, Entry 3's hash no longer matches because it
was computed from the original Entry 2 hash.

### Hash Chain Implementation in Go

```go
package hashchain

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"
)

type ChainedLogEntry struct {
	Sequence     uint64    `json:"sequence"`
	Timestamp    time.Time `json:"timestamp"`
	Data         string    `json:"data"`
	PreviousHash string    `json:"previous_hash"`
	Hash         string    `json:"hash"`
}

type HashChainLogger struct {
	mu           sync.Mutex
	writer       io.Writer
	previousHash string
	sequence     uint64
}

func NewHashChainLogger(writer io.Writer) *HashChainLogger {
	return &HashChainLogger{
		writer:       writer,
		previousHash: "genesis",
		sequence:     0,
	}
}

func (hcl *HashChainLogger) Write(data string) error {
	hcl.mu.Lock()
	defer hcl.mu.Unlock()

	hcl.sequence++

	hashInput := fmt.Sprintf("%d|%s|%s", hcl.sequence, hcl.previousHash, data)
	hash := sha256.Sum256([]byte(hashInput))
	hashHex := hex.EncodeToString(hash[:])

	entry := ChainedLogEntry{
		Sequence:     hcl.sequence,
		Timestamp:    time.Now().UTC(),
		Data:         data,
		PreviousHash: hcl.previousHash,
		Hash:         hashHex,
	}

	hcl.previousHash = hashHex

	encoded, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("marshal chained entry: %w", err)
	}

	_, err = hcl.writer.Write(append(encoded, '\n'))
	return err
}

func VerifyChain(entries []ChainedLogEntry) (bool, int) {
	if len(entries) == 0 {
		return true, -1
	}

	for i, entry := range entries {
		expectedPrev := "genesis"
		if i > 0 {
			expectedPrev = entries[i-1].Hash
		}

		if entry.PreviousHash != expectedPrev {
			return false, i
		}

		hashInput := fmt.Sprintf("%d|%s|%s", entry.Sequence, entry.PreviousHash, entry.Data)
		computed := sha256.Sum256([]byte(hashInput))
		computedHex := hex.EncodeToString(computed[:])

		if entry.Hash != computedHex {
			return false, i
		}
	}

	return true, -1
}
```

### Hash Chain in TypeScript

```typescript
import { createHash } from "crypto";

interface ChainedLogEntry {
  sequence: number;
  timestamp: string;
  data: string;
  previousHash: string;
  hash: string;
}

function computeHash(sequence: number, previousHash: string, data: string): string {
  const input = `${sequence}|${previousHash}|${data}`;
  return createHash("sha256").update(input).digest("hex");
}

function createHashChainLogger() {
  let previousHash = "genesis";
  let sequence = 0;
  const entries: ChainedLogEntry[] = [];

  return {
    write(data: string): ChainedLogEntry {
      sequence++;
      const hash = computeHash(sequence, previousHash, data);

      const entry: ChainedLogEntry = {
        sequence,
        timestamp: new Date().toISOString(),
        data,
        previousHash,
        hash,
      };

      previousHash = hash;
      entries.push(entry);
      process.stdout.write(JSON.stringify(entry) + "\n");
      return entry;
    },

    getEntries(): ChainedLogEntry[] {
      return [...entries];
    },
  };
}

function verifyChain(entries: ChainedLogEntry[]): { valid: boolean; brokenAt: number } {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrev = i === 0 ? "genesis" : entries[i - 1].hash;

    if (entry.previousHash !== expectedPrev) {
      return { valid: false, brokenAt: i };
    }

    const computedHash = computeHash(entry.sequence, entry.previousHash, entry.data);
    if (entry.hash !== computedHash) {
      return { valid: false, brokenAt: i };
    }
  }

  return { valid: true, brokenAt: -1 };
}
```

---

## Brute Force Detection

One of the most common and most detectable attacks. The pattern is simple:
many failed login attempts for the same account or from the same IP in a
short time window.

### Go Implementation

```go
package bruteforce

import (
	"sync"
	"time"
)

type AttemptRecord struct {
	Count     int
	FirstSeen time.Time
	LastSeen  time.Time
	Locked    bool
	LockUntil time.Time
}

type BruteForceDetector struct {
	mu              sync.RWMutex
	attempts        map[string]*AttemptRecord
	maxAttempts     int
	windowDuration  time.Duration
	lockoutDuration time.Duration
}

func NewBruteForceDetector(maxAttempts int, window, lockout time.Duration) *BruteForceDetector {
	detector := &BruteForceDetector{
		attempts:        make(map[string]*AttemptRecord),
		maxAttempts:     maxAttempts,
		windowDuration:  window,
		lockoutDuration: lockout,
	}
	go detector.cleanup()
	return detector
}

func (bfd *BruteForceDetector) RecordFailure(key string) bool {
	bfd.mu.Lock()
	defer bfd.mu.Unlock()

	now := time.Now()
	record, exists := bfd.attempts[key]

	if !exists {
		bfd.attempts[key] = &AttemptRecord{
			Count:     1,
			FirstSeen: now,
			LastSeen:  now,
		}
		return false
	}

	if record.Locked && now.Before(record.LockUntil) {
		return true
	}

	if now.Sub(record.FirstSeen) > bfd.windowDuration {
		record.Count = 1
		record.FirstSeen = now
		record.LastSeen = now
		record.Locked = false
		return false
	}

	record.Count++
	record.LastSeen = now

	if record.Count >= bfd.maxAttempts {
		record.Locked = true
		record.LockUntil = now.Add(bfd.lockoutDuration)
		return true
	}

	return false
}

func (bfd *BruteForceDetector) IsLocked(key string) bool {
	bfd.mu.RLock()
	defer bfd.mu.RUnlock()

	record, exists := bfd.attempts[key]
	if !exists {
		return false
	}

	return record.Locked && time.Now().Before(record.LockUntil)
}

func (bfd *BruteForceDetector) RecordSuccess(key string) {
	bfd.mu.Lock()
	defer bfd.mu.Unlock()
	delete(bfd.attempts, key)
}

func (bfd *BruteForceDetector) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		bfd.mu.Lock()
		now := time.Now()
		for key, record := range bfd.attempts {
			if now.Sub(record.LastSeen) > bfd.windowDuration*2 {
				delete(bfd.attempts, key)
			}
		}
		bfd.mu.Unlock()
	}
}
```

Using it in a login handler:

```go
var loginDetector = NewBruteForceDetector(
	5,
	15*time.Minute,
	30*time.Minute,
)

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	accountKey := fmt.Sprintf("account:%s", req.Email)
	ipKey := fmt.Sprintf("ip:%s", extractIP(r))

	if loginDetector.IsLocked(accountKey) {
		h.audit.Log(AuditEntry{
			Level:   "warn",
			Event:   EventRateLimited,
			Actor:   ActorFromContext(r.Context()),
			Target:  Target{Resource: "session", Action: "create"},
			Context: map[string]interface{}{"reason": "account_locked", "email": req.Email},
		})
		http.Error(w, "Account temporarily locked", http.StatusTooManyRequests)
		return
	}

	if loginDetector.IsLocked(ipKey) {
		h.audit.Log(AuditEntry{
			Level:   "warn",
			Event:   EventRateLimited,
			Actor:   ActorFromContext(r.Context()),
			Target:  Target{Resource: "session", Action: "create"},
			Context: map[string]interface{}{"reason": "ip_locked"},
		})
		http.Error(w, "Too many attempts", http.StatusTooManyRequests)
		return
	}

	user, err := h.userStore.Authenticate(req.Email, req.Password)
	if err != nil {
		locked := loginDetector.RecordFailure(accountKey)
		loginDetector.RecordFailure(ipKey)

		h.audit.Log(AuditEntry{
			Level: "warn",
			Event: EventAuthLoginFailed,
			Actor: ActorFromContext(r.Context()),
			Target: Target{Resource: "session", Action: "create"},
			Context: map[string]interface{}{
				"email":          req.Email,
				"account_locked": locked,
			},
		})

		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	loginDetector.RecordSuccess(accountKey)
	loginDetector.RecordSuccess(ipKey)

	h.createSession(w, user)
}
```

### TypeScript Brute Force Detector

```typescript
interface AttemptRecord {
  count: number;
  firstSeen: number;
  lastSeen: number;
  locked: boolean;
  lockUntil: number;
}

function createBruteForceDetector(
  maxAttempts: number,
  windowMs: number,
  lockoutMs: number
) {
  const attempts = new Map<string, AttemptRecord>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of attempts) {
      if (now - record.lastSeen > windowMs * 2) {
        attempts.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  return {
    recordFailure(key: string): boolean {
      const now = Date.now();
      const record = attempts.get(key);

      if (!record) {
        attempts.set(key, {
          count: 1,
          firstSeen: now,
          lastSeen: now,
          locked: false,
          lockUntil: 0,
        });
        return false;
      }

      if (record.locked && now < record.lockUntil) {
        return true;
      }

      if (now - record.firstSeen > windowMs) {
        record.count = 1;
        record.firstSeen = now;
        record.lastSeen = now;
        record.locked = false;
        return false;
      }

      record.count++;
      record.lastSeen = now;

      if (record.count >= maxAttempts) {
        record.locked = true;
        record.lockUntil = now + lockoutMs;
        return true;
      }

      return false;
    },

    isLocked(key: string): boolean {
      const record = attempts.get(key);
      if (!record) return false;
      return record.locked && Date.now() < record.lockUntil;
    },

    recordSuccess(key: string): void {
      attempts.delete(key);
    },
  };
}
```

---

## Centralized Logging and SIEM

Individual servers should not store their own logs. Logs should flow to a
centralized system where they can be correlated, searched, and alerted on.

```
┌──────────┐   ┌──────────┐   ┌──────────┐
│  API-1   │   │  API-2   │   │  Worker  │
│  Server  │   │  Server  │   │  Server  │
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     │    stdout/structured JSON   │
     │              │              │
     ▼              ▼              ▼
┌────────────────────────────────────────┐
│     Log Aggregator (Fluentd/Vector)    │
└───────────────────┬────────────────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
    ┌────▼────┐ ┌───▼───┐ ┌───▼────┐
    │   SIEM  │ │  Cold  │ │ Alert  │
    │ (ELK/   │ │Storage │ │ Engine │
    │ Splunk/ │ │ (S3)   │ │(PagerDuty│
    │Datadog) │ │        │ │ Slack) │
    └─────────┘ └────────┘ └────────┘
```

### SIEM Alert Rules

Configure alerts for patterns that indicate attacks:

| Alert | Pattern | Severity |
|---|---|---|
| Brute force | > 10 failed logins for same account in 5 minutes | High |
| Credential stuffing | > 50 failed logins from same IP in 5 minutes | High |
| Impossible travel | Login from US, then login from Russia 10 min later | Critical |
| Privilege escalation | User role changed to admin | Critical |
| Data exfiltration | API response > 10MB or > 10K records exported | High |
| Off-hours access | Admin action between 2am-5am local time | Medium |
| Account takeover | Password changed + email changed within 5 minutes | Critical |
| Scanner detection | > 100 404s from same IP in 1 minute | Medium |

---

## Incident Response Plan

When (not if) a security incident occurs, you need a plan. Improvising during
a breach is how small incidents become catastrophic ones.

### The Five Phases

```
┌──────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌────────────┐
│ 1.DETECT │──>│2.CONTAIN │──>│3.ERADICATE│──>│4.RECOVER │──>│5.POST-     │
│          │   │          │   │           │   │          │   │  MORTEM     │
└──────────┘   └──────────┘   └───────────┘   └──────────┘   └────────────┘
```

### Phase 1: Detect

Identify that an incident is occurring. Sources:

- SIEM alerts fire
- Customer reports suspicious activity
- Security researcher discloses a vulnerability
- Monitoring detects anomalous patterns
- External notification (law enforcement, journalist, breached partner)

**Time is everything.** The median time to detect a breach is 197 days
(IBM Cost of a Data Breach Report). Every day that number decreases saves
money and limits damage.

### Phase 2: Contain

Stop the bleeding without destroying evidence.

- Isolate affected systems (do not shut them down — preserve memory for forensics)
- Revoke compromised credentials
- Block attacker IP addresses
- Disable compromised accounts
- Enable enhanced logging on related systems
- Preserve all logs and system state

**Do not:**

- Reboot servers (destroys volatile memory)
- Delete attacker's tools (you need them for forensics)
- Alert the attacker that you know (they may accelerate damage)
- Communicate on channels the attacker may have compromised

### Phase 3: Eradicate

Remove the attacker's access completely.

- Identify all entry points (there are usually more than one)
- Patch the vulnerability that allowed initial access
- Remove backdoors, malware, and unauthorized accounts
- Rotate ALL credentials (not just the ones you think are compromised)
- Update firewall rules
- Rebuild compromised systems from known-good backups

### Phase 4: Recover

Restore normal operations.

- Restore from verified clean backups
- Monitor intensely for signs of re-compromise
- Gradually lift containment measures
- Verify system integrity before going fully live
- Notify affected users as required by law (GDPR: 72 hours)

### Phase 5: Post-Mortem

The most important phase. Without it, you will get breached the same way
again.

- **Timeline:** Reconstruct exactly what happened, when, and how
- **Root cause:** What was the underlying vulnerability? Not just the CVE,
  but the process failure that allowed it
- **Detection gap:** Why did it take X hours/days to detect? How can you
  detect faster next time?
- **What went well:** What parts of the response worked?
- **What went poorly:** Where did the response break down?
- **Action items:** Specific, assigned, and deadline-driven improvements

**Post-mortem template:**

```
# Security Incident Post-Mortem: [Incident Title]

**Date:** YYYY-MM-DD
**Severity:** Critical / High / Medium / Low
**Duration:** Detection to full recovery
**Impact:** Number of users affected, data exposed, downtime

## Timeline (UTC)
- HH:MM — [Event]
- HH:MM — [Event]
- HH:MM — [Event]

## Root Cause
[What was the vulnerability? How was it exploited?]

## Detection
[How was the incident detected? How long from compromise to detection?]

## Response
[What containment, eradication, and recovery steps were taken?]

## Impact Assessment
[What data was accessed? What systems were affected?]

## Lessons Learned
[What went well? What went poorly?]

## Action Items
| # | Action | Owner | Deadline | Status |
|---|--------|-------|----------|--------|
| 1 | ... | @name | Date | Open |
```

---

## Real-World Breach: Target (2013)

**What happened:** Attackers gained access through an HVAC vendor's
credentials. They moved laterally through the network, installed malware on
point-of-sale systems, and exfiltrated 40 million credit card numbers over
two weeks.

**What proper logging would have changed:**

- Target's SIEM (FireEye) actually DID detect the malware installation and
  generated alerts
- The security team did not respond to the alerts — they were lost in the
  noise of thousands of daily alerts
- Proper alert tuning and escalation procedures would have caught the breach
  on day one instead of day fourteen
- Network segmentation logging would have flagged an HVAC vendor connecting
  to POS systems

The lesson is not just "have logs" — it is "have good alerts on those logs
and a team that responds to them."

---

## Exercises

1. **Implement the audit logger** from this lesson in your current project.
   Add security logging to authentication, authorization, and data access
   endpoints. Verify that passwords, tokens, and PII are never logged.

2. **Build a hash chain.** Write 100 log entries using the hash chain logger.
   Modify entry #50 and run the verification function. Verify it detects the
   tampering and reports the correct entry number.

3. **Set up brute force detection** on your login endpoint. Test it by
   sending 10 failed login attempts in a row. Verify the account is locked
   and a proper audit log entry is generated.

4. **Write SIEM alert rules** for your application. Define at least 5 alerts
   with their trigger conditions, severity levels, and response procedures.

5. **Run a tabletop exercise.** Simulate a security incident (e.g., "an
   engineer's laptop was stolen with an active VPN session"). Walk through
   the five phases of incident response. Write the post-mortem.

6. **Audit your existing logs** for sensitive data. Search for patterns that
   might indicate leaked passwords, tokens, or PII. Fix any violations.

---

## Key Takeaways

- Log security events comprehensively: auth, authz, admin actions, data
  access, system events. Miss one category and that is where the attacker
  hides.
- Never log passwords, tokens, keys, or PII. The event metadata tells the
  story without the sensitive content.
- Use structured JSON logs with consistent fields. You cannot run queries on
  unstructured text at 2am during a breach.
- Hash chains make log tampering detectable. If an attacker modifies a log
  entry, the chain breaks.
- Centralize your logs. Individual servers get compromised. A centralized,
  append-only SIEM survives.
- Alert on patterns, not just events. A single failed login is noise. Fifty
  failed logins in five minutes is an attack.
- Have an incident response plan before you need it. Improvising during a
  breach turns a bad day into a catastrophe.
- The post-mortem is the most valuable artifact. Without it, the next breach
  will look exactly like the last one.
