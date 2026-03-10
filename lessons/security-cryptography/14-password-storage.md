# Password Storage

## The One-Way Safe Deposit System

Password hashing is like a one-way safe deposit system. When you set up your account, the bank (server) watches you put your key into a special machine that creates a unique lock impression (hash). The bank stores the impression. When you come back, you put your key in again, the machine creates a new impression, and the bank compares it with the stored one. Even the bank manager can't figure out what the key looks like from the impression alone.

This is the core property of cryptographic hashing: easy to compute in one direction, computationally infeasible to reverse.

---

## Why You NEVER Store Plaintext Passwords

This seems obvious. Yet it keeps happening.

**The breach scoreboard:**
- 2019: Facebook stored hundreds of millions of passwords in plaintext, accessible by 20,000 employees
- 2018: T-Mobile stored passwords in plaintext for their customer service reps
- 2013: Adobe stored 153 million passwords with reversible encryption (effectively plaintext)
- 2012: LinkedIn stored 117 million passwords with unsalted SHA-1

When a database is breached (and if you're building software long enough, it will be), the question is not "did they get the passwords?" but "how long until they crack them?"

| Storage Method | Time to Crack All Passwords |
|---------------|---------------------------|
| Plaintext | Already done |
| MD5, no salt | Minutes |
| SHA-256, no salt | Hours |
| SHA-256, with salt | Hours (salt doesn't slow down cracking) |
| bcrypt (cost 10) | Centuries per password |
| Argon2id (tuned) | Centuries per password |

---

## Why Not MD5 or SHA-256?

MD5 and SHA-256 are cryptographic hash functions, but they were designed for **speed**. They're meant to hash large files quickly to verify integrity. That speed is exactly the problem for password storage.

### The Speed Problem

A modern GPU can compute:
- **MD5:** ~40 billion hashes per second
- **SHA-256:** ~5 billion hashes per second
- **bcrypt (cost 12):** ~10,000 hashes per second

With MD5, an attacker can try every possible 8-character password (lowercase + digits) in about 5 minutes. With bcrypt at cost 12, the same attack would take about 200 years.

**Go — Dangerously wrong:**

```go
func hashPasswordWrong(password string) string {
    hash := sha256.Sum256([]byte(password))
    return hex.EncodeToString(hash[:])
}
```

This computes in microseconds. An attacker with a GPU can try billions of guesses per second.

**Go — Also wrong (MD5):**

```go
func hashPasswordAlsoWrong(password string) string {
    hash := md5.Sum([]byte(password))
    return hex.EncodeToString(hash[:])
}
```

Even worse. MD5 has known collision attacks, but for password cracking the issue is pure speed.

---

## Salting

A salt is a unique random value generated for each password. It's stored alongside the hash.

### Why Salts Exist

Without salts, identical passwords produce identical hashes. An attacker can:

1. **Precompute a rainbow table:** A massive lookup table mapping common passwords to their hashes. Hash "password123" once, then look it up instantly for every user in any breach.

2. **Spot duplicate passwords:** If users 42 and 789 have the same hash, they have the same password. Crack one, crack both.

### How Salts Work

```
Without salt:
  hash("password123") → 5f4dcc3b5aa765d61d8327deb882cf99    (same for everyone)

With salt:
  hash("password123" + "a1b2c3") → 9f8e7d6c5b4a3210...  (user A)
  hash("password123" + "x9y8z7") → 1a2b3c4d5e6f7890...  (user B)
```

Same password, different hashes. Rainbow tables are useless because they'd need a separate table for every possible salt.

**Important:** bcrypt and Argon2id generate and embed salts automatically. You don't need to manage salts manually when using these algorithms.

---

## bcrypt: The Veteran

bcrypt was designed specifically for password hashing in 1999. It's intentionally slow, and its cost factor lets you increase the work as hardware gets faster.

### How bcrypt Works

1. Generate a 16-byte random salt
2. Derive an encryption key from the password + salt using the Blowfish cipher, repeated 2^cost times
3. Encrypt a fixed string ("OrpheanBeholderScryDoubt") using the derived key
4. Output: `$2b$cost$salt+hash`

The cost factor is the key parameter. Each increment doubles the computation time:

| Cost | Time (~) | Use Case |
|------|----------|----------|
| 10 | ~100ms | Minimum for production |
| 12 | ~400ms | Good default |
| 14 | ~1.5s | High security |

### Go bcrypt Implementation

```go
package auth

import (
    "fmt"

    "golang.org/x/crypto/bcrypt"
)

const bcryptCost = 12

func HashPassword(password string) (string, error) {
    if len(password) == 0 {
        return "", fmt.Errorf("password cannot be empty")
    }

    if len(password) > 72 {
        return "", fmt.Errorf("password exceeds bcrypt maximum length of 72 bytes")
    }

    hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
    if err != nil {
        return "", fmt.Errorf("hashing password: %w", err)
    }

    return string(hash), nil
}

func VerifyPassword(hash, password string) error {
    return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}
```

**Usage:**

```go
func registerUser(w http.ResponseWriter, r *http.Request) {
    password := r.FormValue("password")

    if err := validatePasswordStrength(password); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    hash, err := HashPassword(password)
    if err != nil {
        http.Error(w, "Registration failed", http.StatusInternalServerError)
        return
    }

    err = db.Exec("INSERT INTO users (email, password_hash) VALUES ($1, $2)",
        r.FormValue("email"), hash)
    if err != nil {
        http.Error(w, "Registration failed", http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusCreated)
}

func loginUser(w http.ResponseWriter, r *http.Request) {
    email := r.FormValue("email")
    password := r.FormValue("password")

    var storedHash string
    err := db.QueryRow("SELECT password_hash FROM users WHERE email = $1", email).Scan(&storedHash)
    if err != nil {
        http.Error(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }

    if err := VerifyPassword(storedHash, password); err != nil {
        http.Error(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }

    createSession(w, r, email)
}
```

### TypeScript bcrypt Implementation

```typescript
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  if (password.length === 0) {
    throw new Error("Password cannot be empty");
  }

  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Usage:**

```typescript
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const strengthError = validatePasswordStrength(password);
  if (strengthError) {
    return res.status(400).json({ error: strengthError });
  }

  const hash = await hashPassword(password);

  try {
    await prisma.user.create({
      data: { email, passwordHash: hash },
    });
    res.status(201).json({ message: "User created" });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    await bcrypt.hash("dummy", BCRYPT_ROUNDS);
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.userId = user.id;
  res.json({ message: "Logged in" });
});
```

Notice the dummy hash when the user doesn't exist. Without it, login attempts for non-existent users return faster than attempts for existing users, leaking which emails are registered (timing attack).

### bcrypt Limitations

- **72-byte limit:** bcrypt truncates passwords longer than 72 bytes. If you accept longer passwords, pre-hash with SHA-256 first: `bcrypt(SHA256(password))`.
- **No memory hardness:** bcrypt is CPU-hard but not memory-hard. Modern password-cracking rigs use ASICs and GPUs that have limited memory but extreme parallelism.

---

## scrypt: Memory-Hard

scrypt was designed to be both CPU-hard and memory-hard. It requires a configurable amount of RAM, which makes it expensive to attack with specialized hardware (GPUs and ASICs have limited memory per core).

### Parameters

- **N:** CPU/memory cost parameter (must be power of 2). Higher = slower + more memory.
- **r:** Block size. Affects memory usage and mixing quality.
- **p:** Parallelism factor.

**Recommended:** N=32768 (2^15), r=8, p=1 for interactive logins.

### Go scrypt

```go
package auth

import (
    "crypto/rand"
    "crypto/subtle"
    "encoding/base64"
    "fmt"
    "strings"

    "golang.org/x/crypto/scrypt"
)

const (
    scryptN      = 32768
    scryptR      = 8
    scryptP      = 1
    scryptKeyLen = 32
    saltLen      = 16
)

func HashPasswordScrypt(password string) (string, error) {
    salt := make([]byte, saltLen)
    if _, err := rand.Read(salt); err != nil {
        return "", fmt.Errorf("generating salt: %w", err)
    }

    hash, err := scrypt.Key([]byte(password), salt, scryptN, scryptR, scryptP, scryptKeyLen)
    if err != nil {
        return "", fmt.Errorf("scrypt: %w", err)
    }

    return fmt.Sprintf("%s$%s",
        base64.RawStdEncoding.EncodeToString(salt),
        base64.RawStdEncoding.EncodeToString(hash),
    ), nil
}

func VerifyPasswordScrypt(stored, password string) (bool, error) {
    parts := strings.SplitN(stored, "$", 2)
    if len(parts) != 2 {
        return false, fmt.Errorf("invalid hash format")
    }

    salt, err := base64.RawStdEncoding.DecodeString(parts[0])
    if err != nil {
        return false, fmt.Errorf("decoding salt: %w", err)
    }

    expectedHash, err := base64.RawStdEncoding.DecodeString(parts[1])
    if err != nil {
        return false, fmt.Errorf("decoding hash: %w", err)
    }

    hash, err := scrypt.Key([]byte(password), salt, scryptN, scryptR, scryptP, scryptKeyLen)
    if err != nil {
        return false, fmt.Errorf("scrypt: %w", err)
    }

    return subtle.ConstantTimeCompare(hash, expectedHash) == 1, nil
}
```

---

## Argon2id: The Gold Standard

Argon2 won the Password Hashing Competition in 2015. Argon2id is the recommended variant — it combines resistance against both GPU attacks (Argon2d) and side-channel attacks (Argon2i).

### Parameters

- **Time (iterations):** How many passes over memory. More = slower.
- **Memory:** How much RAM to use (in KB). More = harder to parallelize on GPUs.
- **Parallelism:** Number of threads. Determines how many CPU cores to use.

### Choosing Parameters

The goal: verification should take about **250ms** on your server hardware.

**Recommended starting point:**
- Memory: 64 MB (65536 KB)
- Time: 3 iterations
- Parallelism: 4 threads

Then benchmark on your actual hardware and adjust:

```go
func benchmarkArgon2(memory uint32, time uint32, threads uint8) time.Duration {
    salt := make([]byte, 16)
    rand.Read(salt)
    password := []byte("benchmark-password-12345")

    start := time.Now()
    argon2.IDKey(password, salt, time, memory, threads, 32)
    return time.Since(start)
}
```

If it's faster than 200ms, increase memory. If it's slower than 400ms, decrease. You're targeting the sweet spot where legitimate logins feel responsive but attackers face an impossible computational burden.

### Go Argon2id Implementation

```go
package auth

import (
    "crypto/rand"
    "crypto/subtle"
    "encoding/base64"
    "fmt"
    "strings"

    "golang.org/x/crypto/argon2"
)

type Argon2Params struct {
    Memory      uint32
    Iterations  uint32
    Parallelism uint8
    SaltLength  uint32
    KeyLength   uint32
}

var DefaultParams = Argon2Params{
    Memory:      64 * 1024,
    Iterations:  3,
    Parallelism: 4,
    SaltLength:  16,
    KeyLength:   32,
}

func HashPasswordArgon2(password string) (string, error) {
    if len(password) == 0 {
        return "", fmt.Errorf("password cannot be empty")
    }

    salt := make([]byte, DefaultParams.SaltLength)
    if _, err := rand.Read(salt); err != nil {
        return "", fmt.Errorf("generating salt: %w", err)
    }

    hash := argon2.IDKey(
        []byte(password),
        salt,
        DefaultParams.Iterations,
        DefaultParams.Memory,
        DefaultParams.Parallelism,
        DefaultParams.KeyLength,
    )

    encodedHash := fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
        argon2.Version,
        DefaultParams.Memory,
        DefaultParams.Iterations,
        DefaultParams.Parallelism,
        base64.RawStdEncoding.EncodeToString(salt),
        base64.RawStdEncoding.EncodeToString(hash),
    )

    return encodedHash, nil
}

func VerifyPasswordArgon2(encoded, password string) (bool, error) {
    params, salt, hash, err := parseArgon2Hash(encoded)
    if err != nil {
        return false, fmt.Errorf("parsing hash: %w", err)
    }

    computedHash := argon2.IDKey(
        []byte(password),
        salt,
        params.Iterations,
        params.Memory,
        params.Parallelism,
        params.KeyLength,
    )

    return subtle.ConstantTimeCompare(hash, computedHash) == 1, nil
}

func parseArgon2Hash(encoded string) (*Argon2Params, []byte, []byte, error) {
    parts := strings.Split(encoded, "$")
    if len(parts) != 6 {
        return nil, nil, nil, fmt.Errorf("invalid hash format")
    }

    if parts[1] != "argon2id" {
        return nil, nil, nil, fmt.Errorf("unsupported algorithm: %s", parts[1])
    }

    var version int
    _, err := fmt.Sscanf(parts[2], "v=%d", &version)
    if err != nil {
        return nil, nil, nil, fmt.Errorf("parsing version: %w", err)
    }

    params := &Argon2Params{}
    _, err = fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d",
        &params.Memory, &params.Iterations, &params.Parallelism)
    if err != nil {
        return nil, nil, nil, fmt.Errorf("parsing params: %w", err)
    }

    salt, err := base64.RawStdEncoding.DecodeString(parts[4])
    if err != nil {
        return nil, nil, nil, fmt.Errorf("decoding salt: %w", err)
    }

    hash, err := base64.RawStdEncoding.DecodeString(parts[5])
    if err != nil {
        return nil, nil, nil, fmt.Errorf("decoding hash: %w", err)
    }

    params.KeyLength = uint32(len(hash))
    params.SaltLength = uint32(len(salt))

    return params, salt, hash, nil
}
```

The encoded format (`$argon2id$v=19$m=65536,t=3,p=4$salt$hash`) is the PHC string format. It embeds all parameters alongside the hash, so you can verify passwords even if you change parameters later (new passwords get new params, old passwords still verify with their original params).

---

## Algorithm Comparison

| Algorithm | CPU Hard | Memory Hard | Max Password Length | Recommendation |
|-----------|----------|-------------|---------------------|----------------|
| bcrypt | Yes | No | 72 bytes | Good. Wide support, battle-tested. |
| scrypt | Yes | Yes | Unlimited | Good. Better than bcrypt if configured properly. |
| Argon2id | Yes | Yes | Unlimited | Best. Use for new projects. |

**If you're starting a new project:** Use Argon2id.
**If you're maintaining an existing system:** bcrypt is fine. Migrate to Argon2id on password change.
**If you're using anything else:** Stop. Migrate now.

---

## Password Requirements That Actually Work

The old rules (must include uppercase, lowercase, number, and special character) are actively harmful. They lead to passwords like `P@ssw0rd!` — passes every complexity check, cracked in seconds.

### What the Research Says (NIST SP 800-63B)

**Do:**
- Minimum 8 characters, recommend 12+
- Maximum at least 64 characters
- Check against breached password lists (Have I Been Pwned has a free API)
- Allow all printable ASCII and Unicode characters
- Allow paste into password fields (password managers need this)

**Don't:**
- Require specific character types (uppercase, special chars)
- Force periodic password rotation (causes weaker passwords)
- Use password hints or security questions (easily guessable)
- Truncate passwords silently

### Go Password Strength Validation

```go
package auth

import (
    "crypto/sha1"
    "encoding/hex"
    "fmt"
    "io"
    "net/http"
    "strings"
    "unicode/utf8"
)

func ValidatePasswordStrength(password string) error {
    length := utf8.RuneCountInString(password)

    if length < 12 {
        return fmt.Errorf("password must be at least 12 characters")
    }

    if length > 128 {
        return fmt.Errorf("password must be at most 128 characters")
    }

    commonPasswords := []string{
        "password123456", "123456789012", "qwertyuiopas",
    }
    lower := strings.ToLower(password)
    for _, common := range commonPasswords {
        if lower == common {
            return fmt.Errorf("this password is too common")
        }
    }

    breached, err := checkHaveIBeenPwned(password)
    if err != nil {
        return nil
    }
    if breached {
        return fmt.Errorf("this password has appeared in a data breach")
    }

    return nil
}

func checkHaveIBeenPwned(password string) (bool, error) {
    hash := sha1.Sum([]byte(password))
    hashStr := strings.ToUpper(hex.EncodeToString(hash[:]))

    prefix := hashStr[:5]
    suffix := hashStr[5:]

    resp, err := http.Get("https://api.pwnedpasswords.com/range/" + prefix)
    if err != nil {
        return false, fmt.Errorf("checking pwned passwords: %w", err)
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return false, fmt.Errorf("reading response: %w", err)
    }

    lines := strings.Split(string(body), "\r\n")
    for _, line := range lines {
        parts := strings.SplitN(line, ":", 2)
        if len(parts) == 2 && parts[0] == suffix {
            return true, nil
        }
    }

    return false, nil
}
```

The Have I Been Pwned API uses k-anonymity: you send only the first 5 characters of the SHA-1 hash, and it returns all suffixes matching that prefix. Your full password hash never leaves your server.

### TypeScript Password Strength Validation

```typescript
import crypto from "crypto";

async function validatePasswordStrength(password: string): Promise<string | null> {
  if (password.length < 12) {
    return "Password must be at least 12 characters";
  }

  if (password.length > 128) {
    return "Password must be at most 128 characters";
  }

  const breached = await checkHaveIBeenPwned(password);
  if (breached) {
    return "This password has appeared in a data breach";
  }

  return null;
}

async function checkHaveIBeenPwned(password: string): Promise<boolean> {
  const hash = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();

  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`
    );
    const body = await response.text();

    return body.split("\r\n").some((line) => {
      const [hashSuffix] = line.split(":");
      return hashSuffix === suffix;
    });
  } catch {
    return false;
  }
}
```

---

## Credential Stuffing Defense

Credential stuffing is the automated use of stolen username/password pairs from one breach against other services. It works because people reuse passwords.

### Defense Layers

**1. Rate limiting per IP and per account:**

```go
type RateLimiter struct {
    attempts map[string][]time.Time
    mu       sync.Mutex
}

func (rl *RateLimiter) IsAllowed(key string, maxAttempts int, window time.Duration) bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()

    now := time.Now()
    cutoff := now.Add(-window)

    attempts := rl.attempts[key]
    valid := make([]time.Time, 0, len(attempts))
    for _, t := range attempts {
        if t.After(cutoff) {
            valid = append(valid, t)
        }
    }

    if len(valid) >= maxAttempts {
        return false
    }

    rl.attempts[key] = append(valid, now)
    return true
}
```

**2. Account lockout (temporary):**

After 5 failed attempts, lock the account for 15 minutes. Don't permanently lock — that enables denial of service (attacker locks out your users).

**3. Device fingerprinting:**

Flag logins from new devices/locations and require additional verification.

**4. Breached credential detection:**

On login, check the user's password against Have I Been Pwned. If it's breached, force a password change.

---

## Upgrading Hashes Over Time

When you migrate from a weaker algorithm (like SHA-256) to a stronger one (like Argon2id), you can't just rehash — you don't have the plaintext passwords.

**The migration pattern:**

1. Wrap the old hash: `argon2id(sha256_hash)` — this upgrades protection immediately
2. When users log in, hash their password with the new algorithm directly
3. Update the stored hash
4. Track which format each hash uses

```go
type HashFormat int

const (
    FormatLegacySHA256 HashFormat = iota
    FormatBcrypt
    FormatArgon2id
)

func VerifyAndUpgrade(storedHash string, password string, userID int) (bool, error) {
    format := detectHashFormat(storedHash)

    switch format {
    case FormatLegacySHA256:
        sha := sha256.Sum256([]byte(password))
        shaHex := hex.EncodeToString(sha[:])
        if shaHex != storedHash {
            return false, nil
        }

    case FormatBcrypt:
        if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(password)); err != nil {
            return false, nil
        }

    case FormatArgon2id:
        valid, err := VerifyPasswordArgon2(storedHash, password)
        if err != nil || !valid {
            return false, err
        }
        return true, nil

    default:
        return false, fmt.Errorf("unknown hash format")
    }

    newHash, err := HashPasswordArgon2(password)
    if err != nil {
        return true, nil
    }

    go updateStoredHash(userID, newHash)

    return true, nil
}
```

This transparently upgrades every user's password hash as they log in. Users with old formats are still protected by the wrapping strategy until they authenticate.

---

## Summary: Password Storage Decision Tree

```
Starting a new project?
  → Use Argon2id (memory=64MB, time=3, parallelism=4)
  → Benchmark on your hardware, target ~250ms verification

Maintaining existing bcrypt system?
  → Keep bcrypt, it's fine
  → Optionally migrate to Argon2id on next password change

Using MD5/SHA-1/SHA-256?
  → Migrate immediately
  → Wrap existing hashes: argon2id(old_hash)
  → Rehash on next login

Choosing password policy?
  → Minimum 12 characters
  → No complexity requirements
  → Check against breached password lists
  → Allow paste (password managers)
  → No forced rotation
```

The password you hash is only as strong as the weakest link. The best Argon2id parameters in the world don't help if you accept "password123" as a valid password. Layer your defenses: strong algorithm + strong policy + breach detection + rate limiting.
