# Cryptography Cheat Sheet

Quick reference. Tape this next to the checklist.

---

## Hash Functions

| Algorithm | Output Size | Speed | Use This For | Don't Use For |
|-----------|------------|-------|-------------|---------------|
| **SHA-256** | 256 bits | Fast | File integrity, checksums, HMACs, general purpose | Password hashing (too fast) |
| **SHA-3 (SHA3-256)** | 256 bits | Medium | When you need a SHA-256 alternative, compliance requirements | Password hashing (too fast) |
| **BLAKE3** | 256 bits (variable) | Very Fast | File hashing, checksums, key derivation, when speed matters | Password hashing (too fast) |
| **SHA-512** | 512 bits | Fast | When you need a larger hash, some signature schemes | Password hashing |
| ~~MD5~~ | 128 bits | Very Fast | **NOTHING** | Everything (collisions trivial) |
| ~~SHA-1~~ | 160 bits | Fast | **NOTHING** (git is migrating away) | Everything (collisions demonstrated) |

**Rule of thumb**: SHA-256 for general purpose. BLAKE3 when speed matters. Neither for passwords.

---

## Password Hashing

| Algorithm | Use This? | Parameters | Notes |
|-----------|----------|------------|-------|
| **Argon2id** | Best choice | Memory: 64MB+, Iterations: 3+, Parallelism: 4 | Memory-hard, resists GPU/ASIC attacks |
| **bcrypt** | Good choice | Cost factor: 12+ (aim for ~250ms) | Battle-tested, 72-byte password limit |
| **scrypt** | Acceptable | N: 2^15+, r: 8, p: 1 | Memory-hard, harder to tune than Argon2id |
| ~~PBKDF2~~ | Legacy only | If forced: 600,000+ iterations with SHA-256 | Not memory-hard, GPU-vulnerable |
| ~~MD5/SHA~~ | **NEVER** | N/A | Not password hashing algorithms |

**Rule of thumb**: Argon2id if your platform supports it. bcrypt if it doesn't. Tune parameters so hashing takes 250ms-1s.

### Argon2id Parameter Guide

| Environment | Memory | Iterations | Parallelism | Approx Time |
|-------------|--------|-----------|-------------|-------------|
| Web app (fast response needed) | 64 MB | 3 | 4 | ~250ms |
| Server-side (can tolerate latency) | 256 MB | 4 | 4 | ~500ms |
| High-security (admin passwords) | 1 GB | 5 | 8 | ~1s |
| Disk encryption | 4 GB | 8 | 8 | ~3s |

---

## Symmetric Encryption

| Algorithm | Key Size | Use This? | Notes |
|-----------|---------|----------|-------|
| **AES-256-GCM** | 256 bits | **Yes, this is the one** | Authenticated encryption, fast with hardware support |
| AES-128-GCM | 128 bits | Acceptable | Still secure, slightly faster, less future-proof |
| ChaCha20-Poly1305 | 256 bits | Yes, for software | No hardware acceleration needed, great for mobile |
| ~~AES-ECB~~ | Any | **NEVER** | Patterns visible in ciphertext |
| ~~AES-CBC~~ | Any | Avoid | Padding oracle attacks, not authenticated |
| ~~DES~~ | 56 bits | **NEVER** | Broken since the 1990s |
| ~~3DES~~ | 168 bits | **NEVER** | Slow, small block size, deprecated |
| ~~RC4~~ | Variable | **NEVER** | Broken, biased output |
| ~~Blowfish~~ | Variable | **NEVER** | 64-bit block size, use AES instead |

**Rule of thumb**: AES-256-GCM. If you don't have hardware AES support (embedded/mobile), ChaCha20-Poly1305.

### Nonce/IV Requirements

| Mode | Nonce Size | Can Reuse? | What Happens on Reuse |
|------|-----------|-----------|----------------------|
| AES-GCM | 96 bits (12 bytes) | **NEVER** | Authentication breaks, key recovery possible |
| ChaCha20-Poly1305 | 96 bits (12 bytes) | **NEVER** | Keystream reuse, plaintext recovery |
| AES-CBC | 128 bits (16 bytes) | **NEVER** | Pattern leakage |

**Generate nonces with a cryptographically secure random number generator. Always.**

---

## Asymmetric Encryption

| Algorithm | Key Size | Use This? | Notes |
|-----------|---------|----------|-------|
| **Ed25519** | 256 bits | Yes, for signatures | Fast, small keys, deterministic |
| **X25519** | 256 bits | Yes, for key exchange | Diffie-Hellman on Curve25519 |
| **RSA-OAEP** | 2048+ bits | When required | Large keys, slower, well-understood |
| RSA-4096 | 4096 bits | For long-term security | Very large keys, slow |
| ~~RSA-1024~~ | 1024 bits | **NEVER** | Factorable with sufficient resources |
| ~~RSA-PKCS1v1.5~~ | Any | Avoid | Padding oracle attacks (Bleichenbacher) |
| ECDSA (P-256) | 256 bits | Acceptable | Needs good RNG for each signature |
| ~~DSA~~ | Any | **NEVER** | Deprecated, use Ed25519 |
| ~~ElGamal~~ | Any | Rarely | Niche use cases only |

**Rule of thumb**: Ed25519 for signatures. X25519 for key exchange. RSA-2048+ only when interoperability demands it.

### Key Size Equivalence

| Symmetric | RSA | Elliptic Curve | Security Level |
|-----------|-----|---------------|---------------|
| 80 bits | 1024 bits | 160 bits | **Broken** — do not use |
| 112 bits | 2048 bits | 224 bits | Minimum acceptable (until ~2030) |
| 128 bits | 3072 bits | 256 bits | **Recommended** — use this |
| 192 bits | 7680 bits | 384 bits | High security |
| 256 bits | 15360 bits | 512 bits | Maximum practical security |

Translation: a 256-bit elliptic curve key gives you the same security as a 3072-bit RSA key but is 12x smaller.

---

## Digital Signatures

| Algorithm | Use This? | Key Size | Signature Size | Notes |
|-----------|----------|---------|----------------|-------|
| **Ed25519** | Best choice | 32 bytes | 64 bytes | Deterministic, fast, no RNG needed per signature |
| ECDSA (P-256) | Acceptable | 32 bytes | ~72 bytes | Needs secure RNG for every signature |
| RSA-PSS | When required | 256+ bytes | 256+ bytes | Large, slow, well-understood |
| ~~RSA-PKCS1v1.5~~ | Avoid | 256+ bytes | 256+ bytes | Known vulnerabilities |
| ~~DSA~~ | **NEVER** | Variable | Variable | Deprecated |

**Rule of thumb**: Ed25519 everywhere you can. ECDSA when Ed25519 isn't supported.

---

## Key Derivation Functions (KDFs)

| Function | Use This For | Notes |
|----------|-------------|-------|
| **HKDF** | Deriving keys from other keys | Extract-then-expand, use with SHA-256 |
| **Argon2id** | Deriving keys from passwords | Memory-hard |
| **scrypt** | Deriving keys from passwords | Memory-hard, alternative to Argon2id |
| PBKDF2 | Legacy password-based key derivation | Not memory-hard |

---

## Message Authentication Codes (MACs)

| Algorithm | Use This? | Notes |
|-----------|----------|-------|
| **HMAC-SHA256** | Yes | Widely supported, well-understood |
| **Poly1305** | Yes (with ChaCha20) | Part of ChaCha20-Poly1305 AEAD |
| GMAC | Yes (with AES-GCM) | Part of AES-GCM AEAD |
| ~~HMAC-MD5~~ | **NEVER** | MD5 is broken |
| ~~HMAC-SHA1~~ | Avoid | SHA-1 is deprecated |

---

## TLS Configuration

| Setting | Recommended | Notes |
|---------|------------|-------|
| Minimum version | **TLS 1.2** (prefer 1.3) | Disable TLS 1.0, 1.1, SSLv3 |
| Cipher suites (TLS 1.3) | TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 | TLS 1.3 suites are all good |
| Cipher suites (TLS 1.2) | ECDHE-ECDSA-AES256-GCM-SHA384, ECDHE-RSA-AES256-GCM-SHA384 | ECDHE for forward secrecy |
| Key exchange | X25519, then P-256 | X25519 preferred |
| Certificate key | Ed25519 or ECDSA P-256 | RSA-2048 if compatibility needed |
| HSTS | max-age=31536000; includeSubDomains; preload | Always |
| OCSP Stapling | Enabled | Faster certificate validation |

---

## What NOT to Use — The Wall of Shame

| Algorithm | Why Not | What to Use Instead |
|-----------|---------|-------------------|
| MD5 | Collisions trivial since 2004 | SHA-256 or BLAKE3 |
| SHA-1 | Collisions demonstrated (SHAttered, 2017) | SHA-256 or SHA-3 |
| DES | 56-bit key, brute-forced in hours | AES-256 |
| 3DES | 64-bit block, slow, deprecated | AES-256 |
| RC4 | Biased output, broken in TLS | AES-GCM or ChaCha20 |
| Blowfish | 64-bit block size | AES-256 |
| AES-ECB | Patterns visible in ciphertext | AES-GCM |
| RSA-1024 | Factorable | RSA-2048+ or Ed25519 |
| RSA-PKCS1v1.5 (encrypt) | Bleichenbacher attack | RSA-OAEP |
| DSA | Deprecated, nonce reuse catastrophic | Ed25519 |
| PBKDF2 (< 600k iterations) | GPU-vulnerable | Argon2id |
| MD5/SHA for passwords | Way too fast | Argon2id or bcrypt |
| Custom/homegrown crypto | You are not a cryptographer | Use established libraries |
| `Math.random()` for crypto | Not cryptographically secure | `crypto.getRandomValues()` |
| Reused nonces/IVs | Breaks encryption completely | Always generate fresh random nonces |

---

## Quick Decision Flowchart

**"I need to hash something"**
- Is it a password? -> Argon2id
- Is it a file checksum? -> SHA-256 or BLAKE3
- Is it for an HMAC? -> HMAC-SHA256
- Is it for a hash table? -> You already know this one

**"I need to encrypt something"**
- Do both sides share a key? -> AES-256-GCM
- Do I need to send a key securely? -> X25519 key exchange, then AES-256-GCM
- Do I need to encrypt for a specific recipient? -> Their public key + X25519/RSA-OAEP

**"I need to sign something"**
- Do I control both sides? -> Ed25519
- Do I need broad compatibility? -> ECDSA P-256
- Am I stuck with RSA? -> RSA-PSS with SHA-256

**"I need to set up TLS"**
- Use TLS 1.3 if possible, TLS 1.2 minimum
- Get a certificate from Let's Encrypt
- Enable HSTS

**"I need to store a secret"**
- In development? -> `.env` file (in `.gitignore`)
- In production? -> HashiCorp Vault, AWS Secrets Manager, or platform equivalent
- In CI/CD? -> Platform's secret management (GitHub Secrets, GitLab CI Variables)
- In code? -> **ABSOLUTELY NOT**

---

## Common Library Reference

### Go

```
crypto/sha256       - SHA-256 hashing
crypto/aes          - AES encryption
crypto/cipher       - GCM mode, AEAD
crypto/ed25519      - Ed25519 signatures
crypto/rand         - Cryptographic random numbers
crypto/tls          - TLS configuration
golang.org/x/crypto/argon2    - Argon2id password hashing
golang.org/x/crypto/bcrypt    - bcrypt password hashing
golang.org/x/crypto/chacha20poly1305 - ChaCha20-Poly1305
```

### TypeScript/Node.js

```
crypto (built-in)         - Everything (hashing, encryption, signatures)
crypto.subtle (WebCrypto) - Browser-compatible crypto
argon2 (npm)              - Argon2id password hashing
bcrypt (npm)              - bcrypt password hashing
jose (npm)                - JWT/JWS/JWE operations
```

### Rust

```
sha2          - SHA-256/SHA-512
blake3        - BLAKE3 hashing
aes-gcm       - AES-256-GCM
ed25519-dalek - Ed25519 signatures
x25519-dalek  - X25519 key exchange
argon2        - Argon2id password hashing
ring          - General-purpose crypto
rustls        - TLS implementation
```
