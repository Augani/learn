# Asymmetric Encryption

## The Mailbox Analogy

Asymmetric encryption is like a mailbox. Anyone walking by can drop a letter in the slot (encrypt with your public key). But only you have the key to open the mailbox door and read the letters (decrypt with your private key).

Two keys, not one:
- **Public key**: Share it with the world. People use it to encrypt messages to you, or to verify your signatures.
- **Private key**: Guard it with your life. You use it to decrypt messages, or to create signatures.

This solves the key distribution problem from symmetric encryption. You don't need a secure channel to share the public key — it's public. An attacker who has your public key can encrypt messages to you but can't decrypt them. That's the whole point.

---

## The Mathematical Intuition

Asymmetric encryption relies on mathematical operations that are easy in one direction and extremely hard in the other. These are called trapdoor functions.

### RSA: Prime Factoring

Pick two large prime numbers, p and q. Multiply them: n = p * q.

Multiplying two 1024-bit primes takes microseconds. Factoring the 2048-bit product back into those primes takes longer than the age of the universe with current technology.

That's the trapdoor. Multiplication is easy. Factoring is hard.

Your public key includes n (the product). Your private key includes p and q (the factors). Someone who has n can encrypt. Only someone who knows p and q can decrypt.

Think of it like mixing paint. It's trivial to mix yellow and blue to get green. But looking at green paint and determining the exact shade of yellow and blue that were mixed? That's the hard direction.

### Elliptic Curves: The Discrete Logarithm Problem

Elliptic Curve Cryptography (ECC) uses a different trapdoor. On an elliptic curve, you can multiply a point by a number easily (add the point to itself n times). But given the result point and the original point, finding n is computationally infeasible.

The advantage: ECC achieves the same security as RSA with much smaller keys.

| Security Level | RSA Key Size | ECC Key Size | Size Ratio |
|---------------|-------------|-------------|------------|
| 128-bit | 3072 bits (384 bytes) | 256 bits (32 bytes) | 12:1 |
| 192-bit | 7680 bits (960 bytes) | 384 bits (48 bytes) | 20:1 |
| 256-bit | 15360 bits (1920 bytes) | 512 bits (64 bytes) | 30:1 |

A 32-byte ECC key is as secure as a 384-byte RSA key. That matters for embedded systems, mobile devices, QR codes, certificates, and anything bandwidth-constrained.

---

## RSA: How It Actually Works

RSA (Rivest-Shamir-Adleman, 1977) was the first practical public key cryptosystem. Here's the conceptual flow:

### Key Generation

1. Pick two large random primes p and q (each ~1024 bits for RSA-2048)
2. Compute n = p * q (this goes in the public key)
3. Compute the totient: phi(n) = (p-1)(q-1)
4. Choose e (public exponent, almost always 65537)
5. Compute d such that e*d = 1 mod phi(n) (this is the private exponent)
6. Public key: (n, e). Private key: (n, d). Discard p, q, phi(n).

### Encryption

```
ciphertext = plaintext^e mod n
```

Anyone with the public key (n, e) can compute this.

### Decryption

```
plaintext = ciphertext^d mod n
```

Only someone with the private key (n, d) can compute this.

The security relies on: knowing n and e, you can't compute d without factoring n into p and q.

### Key Sizes

| RSA Key Size | Security Level | Status |
|-------------|---------------|--------|
| 1024 bits | ~80-bit | **Broken** — factorable with sufficient resources |
| 2048 bits | ~112-bit | Minimum acceptable, secure until ~2030 |
| 3072 bits | ~128-bit | Recommended for new systems |
| 4096 bits | ~140-bit | High security, slower operations |

**Rule**: RSA-2048 minimum. RSA-3072 or RSA-4096 for new systems. But seriously, use Ed25519 instead unless you have a specific reason to use RSA.

### RSA Padding: OAEP Only

Raw RSA (textbook RSA) is insecure. You need a padding scheme:

- **RSA-OAEP** (Optimal Asymmetric Encryption Padding): Use this. It's provably secure under standard assumptions.
- **RSA-PKCS1v1.5**: Don't use this for encryption. Vulnerable to the Bleichenbacher attack (1998), which allows an attacker to decrypt messages by sending crafted ciphertexts to a server and observing the error responses.

The Bleichenbacher attack is still exploitable. The ROBOT attack (2017) found that 27 of the top 100 websites were vulnerable to a variant, 19 years after the original disclosure.

---

## Elliptic Curve Cryptography: The Modern Choice

ECC provides the same security guarantees as RSA with dramatically smaller keys and faster operations. The three curves you need to know:

### Ed25519 — Signatures

Ed25519 is a signature scheme built on Curve25519 (a specific elliptic curve chosen by Daniel Bernstein for its security and performance properties).

- **Key size**: 32 bytes (private), 32 bytes (public)
- **Signature size**: 64 bytes
- **Speed**: ~15,000 signatures/second, ~7,000 verifications/second on a laptop
- **Deterministic**: The same message with the same key always produces the same signature (no random nonce needed during signing, eliminating the PlayStation 3 nonce-reuse disaster)

### X25519 — Key Exchange

X25519 is the Diffie-Hellman key exchange on Curve25519. Two parties each generate a Curve25519 key pair, exchange public keys, and compute a shared secret.

- **Key size**: 32 bytes
- **Shared secret**: 32 bytes
- **Use case**: TLS handshakes, Signal Protocol, WireGuard

### P-256 (secp256r1) — The NIST Curve

P-256 is the NIST-standardized elliptic curve. It's widely deployed in TLS, code signing, and government systems.

- **Key size**: 32 bytes
- **Some controversy**: Conspiracy-minded cryptographers note that NIST curves have unexplained parameters, and the NSA was involved in their selection. No attack is known, but Curve25519 was designed specifically to avoid this concern.
- **Use when**: Compliance requires NIST curves, or interoperability demands it.

**Rule**: Use Ed25519 for signatures and X25519 for key exchange. Use P-256 when NIST compliance or broad interoperability is required.

---

## Diffie-Hellman Key Exchange: Agreeing on a Secret in Public

This is the magic trick that makes modern internet security possible. Two people create a shared secret while communicating over a completely public channel, and anyone listening learns nothing.

### The Paint-Mixing Version

1. Alice and Bob publicly agree on a base color: **yellow**. Eve sees this.
2. Alice secretly picks **red**. She mixes red + yellow = **orange**. She sends orange to Bob. Eve sees orange.
3. Bob secretly picks **blue**. He mixes blue + yellow = **green**. He sends green to Alice. Eve sees green.
4. Alice takes Bob's **green** and mixes in her secret **red** = **brown**.
5. Bob takes Alice's **orange** and mixes in his secret **blue** = **brown** (same brown).
6. Eve saw yellow, orange, and green. But she can't unmix the paint to figure out the brown.

The mathematical version uses modular exponentiation (classic DH) or elliptic curve point multiplication (ECDH/X25519), but the principle is identical.

### X25519 Key Exchange in Go

```go
package main

import (
	"crypto/rand"
	"fmt"

	"golang.org/x/crypto/curve25519"
)

type KeyPair struct {
	Private [32]byte
	Public  [32]byte
}

func generateKeyPair() (*KeyPair, error) {
	kp := &KeyPair{}

	if _, err := rand.Read(kp.Private[:]); err != nil {
		return nil, fmt.Errorf("generating private key: %w", err)
	}

	curve25519.ScalarBaseMult(&kp.Public, &kp.Private)
	return kp, nil
}

func computeSharedSecret(myPrivate, theirPublic [32]byte) ([32]byte, error) {
	var shared [32]byte
	result, err := curve25519.X25519(myPrivate[:], theirPublic[:])
	if err != nil {
		return shared, fmt.Errorf("computing shared secret: %w", err)
	}
	copy(shared[:], result)
	return shared, nil
}

func main() {
	alice, err := generateKeyPair()
	if err != nil {
		panic(err)
	}

	bob, err := generateKeyPair()
	if err != nil {
		panic(err)
	}

	aliceShared, err := computeSharedSecret(alice.Private, bob.Public)
	if err != nil {
		panic(err)
	}

	bobShared, err := computeSharedSecret(bob.Private, alice.Public)
	if err != nil {
		panic(err)
	}

	fmt.Printf("Alice's shared secret: %x\n", aliceShared)
	fmt.Printf("Bob's shared secret:   %x\n", bobShared)
	fmt.Printf("Secrets match: %v\n", aliceShared == bobShared)
}
```

Alice and Bob each generate a key pair. They exchange public keys over an insecure channel. Each computes the shared secret using their own private key and the other's public key. The shared secrets are identical. Eve, who saw both public keys, cannot compute the shared secret.

### X25519 Key Exchange in TypeScript

```typescript
import { createECDH, createHash } from "crypto";

function generateKeyPair() {
  const ecdh = createECDH("x25519");
  ecdh.generateKeys();
  return {
    privateKey: ecdh.getPrivateKey(),
    publicKey: ecdh.getPublicKey(),
    ecdh,
  };
}

const alice = generateKeyPair();
const bob = generateKeyPair();

const aliceShared = alice.ecdh.computeSecret(bob.publicKey);
const bobShared = bob.ecdh.computeSecret(alice.publicKey);

console.log(`Alice's shared secret: ${aliceShared.toString("hex")}`);
console.log(`Bob's shared secret:   ${bobShared.toString("hex")}`);
console.log(`Secrets match: ${aliceShared.equals(bobShared)}`);
```

The shared secret is 32 bytes of raw key material. In practice, you'd run it through a KDF (like HKDF) to derive specific keys for encryption and MAC operations.

---

## Hybrid Encryption: Best of Both Worlds

Asymmetric encryption is slow (RSA: ~1000 operations/second). Symmetric encryption is fast (AES-GCM: ~10 GB/second). The solution: use asymmetric encryption to exchange a symmetric key, then use the symmetric key for the actual data.

This is called hybrid encryption, and it's how every real-world system works:

1. Alice generates a random AES-256 key (the session key)
2. Alice encrypts the session key with Bob's public key (asymmetric, slow, but the key is tiny)
3. Alice encrypts the actual message with the session key (symmetric, fast)
4. Alice sends both the encrypted session key and the encrypted message to Bob
5. Bob decrypts the session key with his private key
6. Bob decrypts the message with the session key

```go
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
)

func hybridEncrypt(plaintext []byte, recipientPublicKey *rsa.PublicKey) ([]byte, []byte, error) {
	sessionKey := make([]byte, 32)
	if _, err := rand.Read(sessionKey); err != nil {
		return nil, nil, fmt.Errorf("generating session key: %w", err)
	}

	encryptedSessionKey, err := rsa.EncryptOAEP(
		sha256.New(),
		rand.Reader,
		recipientPublicKey,
		sessionKey,
		nil,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("encrypting session key: %w", err)
	}

	block, err := aes.NewCipher(sessionKey)
	if err != nil {
		return nil, nil, fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("creating GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, nil, fmt.Errorf("generating nonce: %w", err)
	}

	encryptedMessage := gcm.Seal(nonce, nonce, plaintext, nil)

	for i := range sessionKey {
		sessionKey[i] = 0
	}

	return encryptedSessionKey, encryptedMessage, nil
}

func hybridDecrypt(encryptedSessionKey, encryptedMessage []byte, privateKey *rsa.PrivateKey) ([]byte, error) {
	sessionKey, err := rsa.DecryptOAEP(
		sha256.New(),
		rand.Reader,
		privateKey,
		encryptedSessionKey,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("decrypting session key: %w", err)
	}

	defer func() {
		for i := range sessionKey {
			sessionKey[i] = 0
		}
	}()

	block, err := aes.NewCipher(sessionKey)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(encryptedMessage) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce := encryptedMessage[:nonceSize]
	ciphertext := encryptedMessage[nonceSize:]

	return gcm.Open(nil, nonce, ciphertext, nil)
}

func main() {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	publicKey := &privateKey.PublicKey

	message := []byte("This is a secret message that could be megabytes long")

	encSessionKey, encMessage, err := hybridEncrypt(message, publicKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "encrypt error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Encrypted session key: %d bytes\n", len(encSessionKey))
	fmt.Printf("Encrypted message: %d bytes\n", len(encMessage))

	decrypted, err := hybridDecrypt(encSessionKey, encMessage, privateKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "decrypt error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Decrypted: %s\n", string(decrypted))
}
```

This is exactly what TLS does (with more protocol negotiation). The asymmetric part handles a few hundred bytes (the session key). The symmetric part handles gigabytes of data.

---

## Key Generation: Ed25519

### Go

```go
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"fmt"
	"os"
)

func main() {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Private key (%d bytes): %x\n", len(privateKey), privateKey)
	fmt.Printf("Public key (%d bytes): %x\n", len(publicKey), publicKey)

	privatePEM := pem.EncodeToMemory(&pem.Block{
		Type:  "ED25519 PRIVATE KEY",
		Bytes: privateKey,
	})
	fmt.Printf("\n%s", privatePEM)
}
```

### TypeScript

```typescript
import { generateKeyPairSync } from "crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

console.log(privateKey);
console.log(publicKey);
```

Ed25519 key generation is effectively instant (microseconds). RSA-2048 key generation takes 100ms-1s because it needs to find large primes.

---

## The Man-in-the-Middle Problem

Diffie-Hellman solves the key exchange problem, but it has a weakness: it doesn't authenticate the parties. Without authentication, an attacker can intercept the exchange:

1. Alice sends her public key to Bob. Eve intercepts it.
2. Eve sends her own public key to Bob, pretending to be Alice.
3. Bob sends his public key to Alice. Eve intercepts it.
4. Eve sends her own public key to Alice, pretending to be Bob.
5. Now Eve has a shared secret with Alice and a different shared secret with Bob.
6. Eve decrypts Alice's messages, reads them, re-encrypts them for Bob, and forwards them. Neither Alice nor Bob knows Eve is in the middle.

This is the Man-in-the-Middle (MITM) attack. The fix: authenticate the public keys. That's what certificates and PKI do (covered in a later lesson). It's also why SSH asks you to verify the server's fingerprint the first time you connect — you're authenticating the public key.

```
The authenticity of host 'example.com (93.184.216.34)' can't be established.
ED25519 key fingerprint is SHA256:AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdef.
Are you sure you want to continue connecting (yes/no)?
```

That fingerprint is the hash of the server's public key. You're being asked to manually authenticate it. In practice, most people type "yes" without checking, which is why SSH has known_hosts and why TLS has certificates.

---

## Forward Secrecy: Protecting Past Conversations

Consider this scenario: You record all encrypted traffic between Alice and Bob for years. Then one day, you steal Bob's private key. Can you go back and decrypt all the recorded conversations?

**Without forward secrecy (static RSA key exchange)**: Yes. Each session's encryption key was encrypted with Bob's static RSA key. With his private key, you can decrypt every session key, and therefore every conversation. Ever.

**With forward secrecy (ephemeral Diffie-Hellman)**: No. Each session generates fresh, temporary DH key pairs. The session key is computed from ephemeral keys that are discarded after the session. Even with Bob's long-term private key, you can't reconstruct the ephemeral keys.

This is called Perfect Forward Secrecy (PFS), and it's critical:

- TLS 1.3 requires PFS (all cipher suites use ephemeral key exchange)
- TLS 1.2 supports it with ECDHE cipher suites (the "E" stands for "ephemeral")
- Signal Protocol generates new keys for every single message (the Double Ratchet algorithm)

**Real-world impact**: After the Snowden revelations (2013), it became clear that intelligence agencies were recording encrypted traffic and storing it, waiting for the day they could obtain the private keys. Forward secrecy means recorded traffic stays encrypted even if the server's key is eventually compromised.

---

## Asymmetric Encryption vs Digital Signatures

The two keys can be used in two directions:

| Operation | Which Key | Purpose |
|-----------|----------|---------|
| Encrypt | Public key | Only the private key holder can read it |
| Decrypt | Private key | Read messages encrypted to you |
| Sign | Private key | Prove you created/approved something |
| Verify | Public key | Confirm the signature is from the private key holder |

Encryption and signing are different operations, even though they both use the same key pair:

- **Encryption** is about confidentiality: hiding the message content
- **Signing** is about authentication and integrity: proving who sent it and that it wasn't modified

RSA technically uses the same mathematical operation for both (exponentiation), but the keys are used in opposite directions. ECC uses different algorithms for encryption (ECDH) and signing (Ed25519/ECDSA).

---

## Real-World Breaches: Asymmetric Crypto Gone Wrong

### Debian OpenSSL Bug (2008) — Bad Random Numbers

A Debian maintainer accidentally removed a line of code from OpenSSL that seeded the random number generator. For two years (2006-2008), every SSL key, SSH key, and certificate generated on Debian and Ubuntu systems used predictable "random" numbers. There were only 32,767 possible keys for any given key type and size.

An attacker could generate all 32,767 possible keys in under an hour and try each one. Every affected server was completely compromised.

**Lesson**: Cryptographic randomness is foundational. Without it, every algorithm built on top fails. This is why you use `crypto/rand`, never `math/rand`, and why you never modify cryptographic library internals.

### ROCA (2017) — Predictable RSA Primes

RSA keys generated by Infineon smartchips (used in Estonian ID cards, TPMs, YubiKeys) had a flaw: the primes p and q were generated using a method that made them predictable. An attacker could factor the RSA key in minutes to hours, depending on key size.

760,000 Estonian national ID cards had to be replaced. The vulnerability affected RSA-2048 keys, which should have been safe for decades.

**Lesson**: Even hardware vendors get crypto implementation wrong. The algorithm was fine — the implementation was flawed.

### FREAK Attack (2015) — Export Cipher Downgrade

In the 1990s, US export regulations required software sold abroad to use weak encryption (512-bit RSA, 40-bit symmetric keys). Servers kept support for these "export-grade" cipher suites long after the regulations were lifted. The FREAK attack forced servers to use export-grade RSA key exchange — and 512-bit RSA keys can be factored in about 7 hours on Amazon EC2 for about $100.

One in three HTTPS servers were vulnerable, including NSA.gov (yes, the NSA's own website).

**Lesson**: Disable legacy cryptography. Weak cipher suites exist for backward compatibility, and attackers will force a downgrade if you let them.

---

## Quantum Computing: Should You Worry?

Shor's algorithm, run on a sufficiently powerful quantum computer, can factor large numbers and compute discrete logarithms efficiently. This would break RSA, ECDSA, Ed25519, and Diffie-Hellman.

**Current state (2025)**: The largest number factored by a quantum computer is about 21 (yes, twenty-one). Factoring a 2048-bit RSA key requires a quantum computer with roughly 4,000 logical qubits. We're at about 1,000 noisy physical qubits. We're not there yet.

**Post-quantum cryptography**: NIST has standardized post-quantum algorithms (ML-KEM/Kyber for key exchange, ML-DSA/Dilithium for signatures). Chrome and Signal already use hybrid key exchange (X25519 + ML-KEM) so that traffic is protected even if quantum computers arrive.

**What to do now**:
1. Don't panic
2. Use forward secrecy everywhere (protects recorded traffic against future quantum attacks)
3. Keep key sizes at 256-bit symmetric / 3072-bit RSA minimum
4. Watch the NIST post-quantum migration timeline
5. For long-lived secrets (data that must stay confidential for 30+ years), start evaluating hybrid approaches

---

## Exercises

1. **RSA key generation**: Generate RSA-2048 and Ed25519 key pairs in both Go and TypeScript. Compare the key sizes and generation times. RSA should take ~100ms; Ed25519 should be nearly instant.

2. **Diffie-Hellman key exchange**: Implement X25519 key exchange between two parties. Verify the shared secrets match. Then implement a simplified MITM attack (a third party intercepts and establishes separate shared secrets with each party).

3. **Hybrid encryption**: Encrypt a large file (> 100MB) using hybrid encryption. Time the operation and compare with pure RSA encryption (which would require chunking the file into blocks smaller than the key size).

4. **SSH key fingerprinting**: Write a program that reads an SSH public key file and computes its fingerprint (SHA-256 of the base64-decoded key). Compare with `ssh-keygen -l -f key.pub`.

---

## Key Takeaways

- Asymmetric encryption uses two keys: public (encrypt/verify) and private (decrypt/sign)
- RSA is based on the difficulty of factoring large numbers; ECC is based on the discrete logarithm problem on elliptic curves
- Ed25519 for signatures, X25519 for key exchange, RSA only when required for compatibility
- Diffie-Hellman lets two parties agree on a shared secret over a public channel
- Hybrid encryption combines fast symmetric encryption with secure asymmetric key exchange
- Forward secrecy protects past communications even if the private key is later compromised
- Authentication is needed alongside key exchange to prevent man-in-the-middle attacks
