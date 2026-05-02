# Digital Signatures

## The Wax Seal

In medieval times, a king sealed letters with a wax seal pressed by his signet ring. Everyone in the kingdom recognized the seal (public knowledge), but only the king had the ring that could create it (private key). If the seal was broken, you knew someone had opened or tampered with the letter.

Digital signatures work the same way:

- **Signing** = pressing the signet ring into wax (private key creates the signature)
- **Verifying** = recognizing the seal (public key confirms it's genuine)
- **Tamper detection** = the seal is broken if anyone changes the message

Three things a digital signature proves:

1. **Authentication**: The signature was created by the holder of the private key
2. **Integrity**: The message hasn't been modified since it was signed
3. **Non-repudiation**: The signer can't deny they signed it (unlike HMAC, where both parties share the key)

---

## How Digital Signatures Work

The process is straightforward:

### Signing

1. Hash the message (SHA-256, SHA-512, etc.) to get a fixed-size digest
2. Encrypt the hash with the signer's private key — this encrypted hash is the signature
3. Send the message + signature to the recipient

### Verification

1. Hash the received message with the same algorithm
2. Decrypt the signature with the signer's public key to get the original hash
3. Compare the two hashes — if they match, the signature is valid

Why hash first? Two reasons:
- **Performance**: Signing/verifying a 32-byte hash is much faster than signing a 100MB file
- **Fixed size**: RSA can only encrypt data smaller than the key size. Hashing first ensures the data fits regardless of original size.

```
Sender:                           Recipient:
Message -----> [Hash] -> digest   Message -----> [Hash] -> digest
                  |                                          |
               [Sign with         Signature -> [Verify with  |
               private key]                    public key]   |
                  |                     |                     |
               signature            original_digest          |
                                        |                    |
                                     [Compare] ------------>
                                   match? -> VALID
                                   no match? -> INVALID
```

---

## Ed25519: The Signature Scheme You Should Use

Ed25519 is the recommended signature algorithm for nearly everything:

| Property | Value |
|----------|-------|
| Private key size | 32 bytes |
| Public key size | 32 bytes |
| Signature size | 64 bytes |
| Security level | ~128-bit |
| Signing speed | ~15,000/sec on a laptop |
| Verification speed | ~7,000/sec on a laptop |
| Deterministic | Yes (same message + key = same signature) |

The "deterministic" property is huge. ECDSA requires a random nonce for every signature. If the nonce is predictable, reused, or has even slightly biased randomness, the private key can be extracted. This has caused real disasters (PlayStation 3, Bitcoin wallets, etc.). Ed25519 derives the nonce from the private key and message, eliminating this entire class of bugs.

---

## Hands-On: Ed25519 Signing in Go

```go
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
)

func main() {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		fmt.Fprintf(os.Stderr, "key generation error: %v\n", err)
		os.Exit(1)
	}

	message := []byte("Release v2.0.0 - production ready")

	signature := ed25519.Sign(privateKey, message)
	fmt.Printf("Message:   %s\n", message)
	fmt.Printf("Signature: %s\n", hex.EncodeToString(signature))
	fmt.Printf("Sig size:  %d bytes\n", len(signature))

	valid := ed25519.Verify(publicKey, message, signature)
	fmt.Printf("Valid signature: %v\n", valid)

	tamperedMessage := []byte("Release v2.0.0 - with backdoor")
	valid = ed25519.Verify(publicKey, tamperedMessage, signature)
	fmt.Printf("Tampered message valid: %v\n", valid)

	signature[0] ^= 0xFF
	valid = ed25519.Verify(publicKey, message, signature)
	fmt.Printf("Tampered signature valid: %v\n", valid)
}
```

Output:
```
Message:   Release v2.0.0 - production ready
Signature: 8a3b... (64 bytes hex encoded)
Sig size:  64 bytes
Valid signature: true
Tampered message valid: false
Tampered signature valid: false
```

The API is beautifully simple. `Sign` takes a private key and message, returns a signature. `Verify` takes a public key, message, and signature, returns a boolean. No modes, no padding, no configuration to get wrong.

---

## Hands-On: Ed25519 Signing in TypeScript

```typescript
import { generateKeyPairSync, sign, verify, KeyObject } from "crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const message = Buffer.from("Release v2.0.0 - production ready");

const signature = sign(null, message, privateKey);
console.log(`Message:   ${message.toString()}`);
console.log(`Signature: ${signature.toString("hex")}`);
console.log(`Sig size:  ${signature.length} bytes`);

const isValid = verify(null, message, publicKey, signature);
console.log(`Valid signature: ${isValid}`);

const tamperedMessage = Buffer.from("Release v2.0.0 - with backdoor");
const isTamperedValid = verify(null, tamperedMessage, publicKey, signature);
console.log(`Tampered message valid: ${isTamperedValid}`);
```

Note: The first argument to `sign` and `verify` is `null` for Ed25519 because Ed25519 has a built-in hash (SHA-512). For RSA or ECDSA, you'd specify the hash algorithm.

---

## ECDSA vs Ed25519

ECDSA (Elliptic Curve Digital Signature Algorithm) is the older ECC signature standard. It's widely deployed but has significant footguns:

| Feature | Ed25519 | ECDSA (P-256) |
|---------|---------|--------------|
| Nonce handling | Deterministic (safe) | Random (dangerous if bad RNG) |
| Speed | Faster | Slower |
| Side-channel resistance | Designed for it | Curve-dependent |
| Standards body | IETF | NIST |
| Adoption | SSH, Signal, WireGuard | TLS, Bitcoin, AWS |

**The ECDSA nonce problem**: Every ECDSA signature requires a unique random value k. If k is ever reused, biased, or predictable, the private key can be mathematically extracted. This isn't a theoretical concern:

- **PlayStation 3 (2010)**: Sony used a constant k for all signatures. The private signing key was extracted in a single afternoon.
- **Android Bitcoin wallets (2013)**: A flaw in Android's SecureRandom produced predictable values. Attackers extracted private keys and stole Bitcoin.
- **Minerva attack (2019)**: Timing side-channels in ECDSA implementations leaked enough nonce bits to reconstruct private keys from ~1000 observed signatures.

Ed25519 eliminates this entirely by deriving k deterministically from the private key and message. Same input always produces the same signature, but the nonce is unpredictable to anyone without the private key.

**Rule**: Use Ed25519 unless you specifically need ECDSA for compatibility.

---

## Use Case: Git Commit Signing

Git commits are unsigned by default. Anyone with write access can create a commit with any author name and email. Signing commits proves that a specific cryptographic key holder made the commit.

### Setup: SSH Signing (Recommended)

SSH signing is the modern approach. No GPG required.

```bash
# Configure git to use SSH signing
git config --global gpg.format ssh
git config --global user.signingKey ~/.ssh/id_ed25519.pub

# Sign all commits automatically
git config --global commit.gpgsign true

# Sign all tags automatically
git config --global tag.gpgsign true
```

Create an allowed signers file for verification:

```bash
# Create the allowed signers file
echo "your.email@example.com $(cat ~/.ssh/id_ed25519.pub)" > ~/.config/git/allowed_signers

# Tell git where to find it
git config --global gpg.ssh.allowedSignersFile ~/.config/git/allowed_signers
```

### Making Signed Commits

```bash
# Sign a single commit
git commit -S -m "feat: add payment processing"

# Verify signatures in log
git log --show-signature

# Verify a specific commit
git verify-commit HEAD
```

### What a Signed Commit Looks Like

```bash
git log --show-signature -1

# commit 8a3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b
# Good "git" signature for your.email@example.com with ED25519 key SHA256:AbCd...
# Author: Your Name <your.email@example.com>
# Date:   Mon Jan 15 10:30:00 2025 -0500
#
#     feat: add payment processing
```

### Setup: GPG Signing (Traditional)

```bash
# Generate a GPG key
gpg --full-generate-key
# Choose: (1) RSA and RSA, 4096 bits, does not expire

# List keys
gpg --list-secret-keys --keyid-format=long
# sec   rsa4096/ABCDEF1234567890 2025-01-15

# Configure git
git config --global user.signingKey ABCDEF1234567890
git config --global commit.gpgsign true

# Upload public key to GitHub
gpg --armor --export ABCDEF1234567890
# Paste the output into GitHub Settings > SSH and GPG keys
```

---

## Use Case: JWTs (JSON Web Tokens)

JWTs are digitally signed JSON payloads. They're used for authentication tokens, API access, and session management.

A JWT has three parts: Header.Payload.Signature

```
eyJhbGciOiJFZDI1NTE5IiwidHlwIjoiSldUIn0.
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsaWNlIiwiaWF0IjoxNjk5MDAwMDAwfQ.
<signature bytes base64url encoded>
```

The signature covers the header and payload. Verification proves:
1. The token was issued by someone with the private key
2. The payload hasn't been modified

### JWT Signing with Ed25519 in Go

```go
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

type JWTHeader struct {
	Algorithm string `json:"alg"`
	Type      string `json:"typ"`
}

type JWTPayload struct {
	Subject  string `json:"sub"`
	Name     string `json:"name"`
	IssuedAt int64  `json:"iat"`
	Expiry   int64  `json:"exp"`
}

func base64URLEncode(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}

func base64URLDecode(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(s)
}

func createJWT(payload JWTPayload, privateKey ed25519.PrivateKey) (string, error) {
	header := JWTHeader{Algorithm: "EdDSA", Type: "JWT"}

	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", fmt.Errorf("marshaling header: %w", err)
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshaling payload: %w", err)
	}

	signingInput := base64URLEncode(headerJSON) + "." + base64URLEncode(payloadJSON)
	signature := ed25519.Sign(privateKey, []byte(signingInput))

	return signingInput + "." + base64URLEncode(signature), nil
}

func verifyJWT(token string, publicKey ed25519.PublicKey) (*JWTPayload, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}

	signingInput := parts[0] + "." + parts[1]

	signature, err := base64URLDecode(parts[2])
	if err != nil {
		return nil, fmt.Errorf("decoding signature: %w", err)
	}

	if !ed25519.Verify(publicKey, []byte(signingInput), signature) {
		return nil, fmt.Errorf("invalid signature")
	}

	payloadJSON, err := base64URLDecode(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decoding payload: %w", err)
	}

	var payload JWTPayload
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		return nil, fmt.Errorf("parsing payload: %w", err)
	}

	if payload.Expiry < time.Now().Unix() {
		return nil, fmt.Errorf("token expired")
	}

	return &payload, nil
}

func main() {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	payload := JWTPayload{
		Subject:  "user-12345",
		Name:     "Alice",
		IssuedAt: time.Now().Unix(),
		Expiry:   time.Now().Add(15 * time.Minute).Unix(),
	}

	token, err := createJWT(payload, privateKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "create error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("JWT: %s\n\n", token)

	verified, err := verifyJWT(token, publicKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "verify error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Verified payload: %+v\n", verified)
}
```

**Important JWT security considerations**:

1. **Always verify the signature before trusting the payload**. The payload is base64-encoded, not encrypted. Anyone can read it. The signature prevents tampering.
2. **Check the `exp` (expiry) claim**. Expired tokens should be rejected.
3. **Use `EdDSA` (Ed25519) or `ES256` (ECDSA P-256)**. Avoid `HS256` (HMAC) for public-facing APIs because it requires sharing the secret key with every verifier.
4. **Never use `alg: "none"`**. Some JWT libraries accept unsigned tokens if the header says `"alg": "none"`. This is a well-known vulnerability.
5. **Keep access tokens short-lived** (5-15 minutes). Use refresh tokens for longer sessions.

---

## Use Case: Software Release Signing

When you download software, how do you know it hasn't been tampered with? Digital signatures.

### Signing a Release Binary

```go
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
)

func signFile(filePath string, privateKey ed25519.PrivateKey) ([]byte, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("reading file: %w", err)
	}

	signature := ed25519.Sign(privateKey, data)
	return signature, nil
}

func verifyFile(filePath string, signature []byte, publicKey ed25519.PublicKey) (bool, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return false, fmt.Errorf("reading file: %w", err)
	}

	return ed25519.Verify(publicKey, data, signature), nil
}

func main() {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	pubKeyHex := hex.EncodeToString(publicKey)
	fmt.Printf("Public key (distribute this): %s\n", pubKeyHex)

	signature, err := signFile("myapp-v2.0.0-linux-amd64", privateKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "signing error: %v\n", err)
		os.Exit(1)
	}

	sigHex := hex.EncodeToString(signature)
	fmt.Printf("Signature: %s\n", sigHex)

	valid, err := verifyFile("myapp-v2.0.0-linux-amd64", signature, publicKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "verify error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Signature valid: %v\n", valid)
}
```

Real-world examples:
- **Go modules**: `go.sum` contains hashes; the Go checksum database signs them
- **Linux packages**: `apt` verifies GPG signatures on `.deb` packages
- **Docker images**: Content trust (Notary) signs image manifests
- **macOS/iOS apps**: Code signing with Apple Developer certificates
- **Windows executables**: Authenticode signatures

---

## Use Case: Webhook Verification

When Stripe, GitHub, or Slack sends you a webhook, how do you know it's really from them and not an attacker? They sign the payload with HMAC or a digital signature, and you verify it.

### Stripe-Style Webhook Verification

Stripe uses HMAC-SHA256 (not a digital signature, but the same verification pattern):

```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func verifyStripeWebhook(payload []byte, header string, secret string) error {
	parts := strings.Split(header, ",")
	var timestamp string
	var signature string

	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			timestamp = kv[1]
		case "v1":
			signature = kv[1]
		}
	}

	if timestamp == "" || signature == "" {
		return fmt.Errorf("missing timestamp or signature")
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid timestamp: %w", err)
	}

	age := time.Since(time.Unix(ts, 0))
	if age > 5*time.Minute || age < -5*time.Minute {
		return fmt.Errorf("timestamp too old or in the future: %v", age)
	}

	signedPayload := timestamp + "." + string(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signedPayload))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
		return fmt.Errorf("signature mismatch")
	}

	return nil
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	const maxBodySize = 1024 * 1024
	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	payload := make([]byte, 0, 4096)
	buf := make([]byte, 4096)
	for {
		n, err := r.Body.Read(buf)
		payload = append(payload, buf[:n]...)
		if err != nil {
			break
		}
	}

	sigHeader := r.Header.Get("Stripe-Signature")
	if sigHeader == "" {
		http.Error(w, "missing signature", http.StatusBadRequest)
		return
	}

	err := verifyStripeWebhook(payload, sigHeader, "whsec_your_webhook_secret")
	if err != nil {
		http.Error(w, "invalid signature", http.StatusForbidden)
		return
	}

	fmt.Printf("Verified webhook: %s\n", string(payload))
	w.WriteHeader(http.StatusOK)
}
```

Key security details:
- **Timestamp check**: Prevents replay attacks. An attacker can't capture a valid webhook and replay it hours later.
- **Constant-time comparison**: `hmac.Equal` prevents timing attacks.
- **Body size limit**: Prevents memory exhaustion from oversized payloads.

---

## Use Case: TLS Certificates

Every HTTPS connection relies on digital signatures. The server's certificate contains:
- The server's public key
- The server's domain name
- The Certificate Authority's digital signature over all of the above

Your browser verifies the CA's signature using the CA's public key (which is pre-installed in your OS/browser). If the signature is valid, the browser trusts that the public key belongs to the claimed domain.

This is the chain of trust: your browser trusts the CA, the CA vouches for the server.

More on this in the Certificates and PKI lesson.

---

## Signature Schemes Comparison

| Scheme | Key Size | Sig Size | Speed | Notes |
|--------|---------|---------|-------|-------|
| Ed25519 | 32 + 32 bytes | 64 bytes | Very fast | Deterministic, no nonce risk |
| ECDSA P-256 | 32 + 64 bytes | ~72 bytes | Fast | Needs good RNG per signature |
| RSA-2048 PSS | 256 + 270 bytes | 256 bytes | Slow | Large keys and signatures |
| RSA-4096 PSS | 512 + 540 bytes | 512 bytes | Very slow | Even larger |

Ed25519 signatures are 4x smaller than RSA-2048 signatures and 8x smaller than RSA-4096 signatures. In a TLS handshake that includes multiple signatures, this adds up.

---

## Real-World Breaches: Signature Failures

### The PlayStation 3 Hack (2010) — ECDSA Nonce Reuse

Sony signed PS3 firmware updates with ECDSA. The security of ECDSA depends on a unique random value k for every signature. Sony used the same k every time.

With two signatures using the same k, the private key can be recovered with simple algebra:

```
s1 = k^(-1)(hash1 + r * privateKey) mod n
s2 = k^(-1)(hash2 + r * privateKey) mod n

s1 - s2 = k^(-1)(hash1 - hash2) mod n
k = (hash1 - hash2)(s1 - s2)^(-1) mod n
privateKey = (s1 * k - hash1) * r^(-1) mod n
```

Once the private key was extracted, anyone could sign custom firmware as if they were Sony. The entire PS3 security model collapsed.

**Lesson**: This is why Ed25519's deterministic nonces are so important. There's no random value to screw up.

### The SolarWinds Attack (2020) — Valid Signatures, Compromised Source

Attackers inserted a backdoor into SolarWinds' Orion build pipeline. The resulting software was legitimately signed by SolarWinds' code signing certificate. The signature was mathematically valid — the code really did come from SolarWinds' build system.

The problem wasn't the cryptography. The problem was that the build system was compromised. The signature proved the software came from SolarWinds, not that SolarWinds' systems were secure.

**Lesson**: Signatures prove provenance, not safety. A signed binary from a compromised build pipeline is a signed, compromised binary.

### JWT "alg: none" Vulnerabilities

Multiple JWT libraries accepted tokens with `"alg": "none"` — meaning no signature at all. An attacker could modify the payload, set the algorithm to "none," remove the signature, and the library would happily validate the token.

```json
{
  "alg": "none",
  "typ": "JWT"
}
.
{
  "sub": "admin",
  "role": "superuser"
}
.
(no signature)
```

This affected Auth0, Microsoft, and many other implementations.

**Lesson**: Always validate the algorithm. Reject tokens that claim `"alg": "none"`. Whitelist the algorithms you accept rather than blacklisting the ones you don't.

### JWT Algorithm Confusion

Some JWT libraries let the token specify whether to use RSA or HMAC. An attacker could:
1. Get the server's RSA public key (which is public)
2. Create a JWT with `"alg": "HS256"` (HMAC)
3. Sign the JWT using the RSA public key as the HMAC secret
4. The server uses the public key to verify — and since it's configured as an HMAC secret, the verification succeeds

The fix: never let the token's header dictate which algorithm to use for verification. Your server should know which algorithm to expect.

---

## Building a Signed Message Protocol

Here's a complete example of a signed messaging protocol:

```go
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"time"
)

type SignedMessage struct {
	Payload   json.RawMessage `json:"payload"`
	Timestamp int64           `json:"timestamp"`
	PublicKey []byte          `json:"public_key"`
	Signature []byte          `json:"signature"`
}

type MessagePayload struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Content string `json:"content"`
}

func createSignedMessage(payload MessagePayload, privateKey ed25519.PrivateKey, publicKey ed25519.PublicKey) (*SignedMessage, error) {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshaling payload: %w", err)
	}

	msg := &SignedMessage{
		Payload:   payloadJSON,
		Timestamp: time.Now().Unix(),
		PublicKey: publicKey,
	}

	dataToSign, err := json.Marshal(struct {
		Payload   json.RawMessage `json:"payload"`
		Timestamp int64           `json:"timestamp"`
	}{
		Payload:   msg.Payload,
		Timestamp: msg.Timestamp,
	})
	if err != nil {
		return nil, fmt.Errorf("marshaling signing data: %w", err)
	}

	msg.Signature = ed25519.Sign(privateKey, dataToSign)
	return msg, nil
}

func verifySignedMessage(msg *SignedMessage, maxAge time.Duration) (*MessagePayload, error) {
	age := time.Since(time.Unix(msg.Timestamp, 0))
	if age > maxAge || age < -1*time.Minute {
		return nil, fmt.Errorf("message too old or from the future: age=%v", age)
	}

	dataToVerify, err := json.Marshal(struct {
		Payload   json.RawMessage `json:"payload"`
		Timestamp int64           `json:"timestamp"`
	}{
		Payload:   msg.Payload,
		Timestamp: msg.Timestamp,
	})
	if err != nil {
		return nil, fmt.Errorf("marshaling verification data: %w", err)
	}

	if !ed25519.Verify(msg.PublicKey, dataToVerify, msg.Signature) {
		return nil, fmt.Errorf("invalid signature")
	}

	var payload MessagePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return nil, fmt.Errorf("unmarshaling payload: %w", err)
	}

	return &payload, nil
}

func main() {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	payload := MessagePayload{
		From:    "alice@example.com",
		To:      "bob@example.com",
		Content: "Meeting at 3pm tomorrow",
	}

	msg, err := createSignedMessage(payload, privateKey, publicKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "signing error: %v\n", err)
		os.Exit(1)
	}

	wire, _ := json.MarshalIndent(msg, "", "  ")
	fmt.Printf("Signed message:\n%s\n\n", wire)

	verified, err := verifySignedMessage(msg, 5*time.Minute)
	if err != nil {
		fmt.Fprintf(os.Stderr, "verification error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Verified message from %s: %s\n", verified.From, verified.Content)
}
```

This demonstrates:
- Signing a structured payload (not just raw bytes)
- Including a timestamp to prevent replay attacks
- Including the public key for self-contained verification
- Verifying age bounds on the timestamp

---

## Common Mistakes

### Mistake 1: Not Verifying Signatures

```go
// WRONG — parsing the JWT without verifying the signature
payload, _ := base64.Decode(strings.Split(token, ".")[1])
json.Unmarshal(payload, &claims)
```

```go
// RIGHT — verify first, then trust the payload
claims, err := verifyJWT(token, publicKey)
if err != nil {
    return fmt.Errorf("invalid token: %w", err)
}
```

### Mistake 2: Letting the Token Choose the Algorithm

```go
// WRONG — trusting the "alg" field from the token header
header := parseJWTHeader(token)
switch header.Algorithm {
case "RS256":
    verify(token, rsaKey)
case "HS256":
    verify(token, hmacSecret)
}
```

```go
// RIGHT — the server decides the algorithm
verify(token, rsaKey, "RS256")
```

### Mistake 3: Using RSA-PKCS1v1.5 for Signatures

```go
// RISKY — PKCS1v1.5 has known weaknesses
rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hash)
```

```go
// BETTER — PSS is the modern RSA signature scheme
rsa.SignPSS(rand.Reader, privateKey, crypto.SHA256, hash, nil)
```

### Mistake 4: Signing Without a Timestamp

Without a timestamp, valid signatures last forever. An attacker who captures a signed message can replay it at any time.

---

## Exercises

1. **Git commit signing**: Set up SSH commit signing on your machine. Make a signed commit, verify it, then modify the commit message with `git filter-branch` and observe that the signature becomes invalid.

2. **JWT from scratch**: Implement JWT creation and verification with Ed25519 (EdDSA) in both Go and TypeScript without using a JWT library. Then try to forge a token — modify the payload and see that verification fails. Try the `"alg": "none"` attack against your own implementation.

3. **Webhook receiver**: Build an HTTP server that receives webhooks and verifies their signatures. Test it by sending both valid and tampered payloads.

4. **File signing tool**: Build a CLI tool that signs files with Ed25519 and produces a `.sig` file. Build the corresponding verification tool. Use it to sign and verify a binary release.

5. **Key compromise simulation**: Sign a message with Ed25519. Then imagine the private key leaks. Show that the attacker can now sign arbitrary messages that verify with the same public key. This demonstrates why key revocation exists.

---

## Key Takeaways

- Digital signatures prove authentication (who), integrity (unmodified), and non-repudiation (can't deny)
- Ed25519 is the recommended signature algorithm — deterministic, fast, small
- ECDSA has a dangerous nonce requirement that has caused real private key compromises
- Always verify signatures before trusting the payload
- Never let the data dictate which algorithm to use for verification
- Signatures prove provenance, not safety — a signed binary from a compromised system is a signed, compromised binary
- Timestamps prevent replay attacks
- Constant-time comparison prevents timing attacks
