# Symmetric Encryption

## The Concept

Symmetric encryption is a combination lock on a shared locker. Both you and your friend know the combination (the key). Either of you can lock it (encrypt) and either of you can unlock it (decrypt). The combination is the same for both operations.

```
Plaintext + Key -> [Encrypt] -> Ciphertext
Ciphertext + Key -> [Decrypt] -> Plaintext
```

Same key for both directions. That's the "symmetric" part.

The obvious question: how do you share the combination securely in the first place? If someone overhears it, they can open the locker too. That's the key distribution problem, and it's why asymmetric encryption was invented. But we'll get there. First, let's understand what happens once both parties have the key.

---

## Block Ciphers vs Stream Ciphers

There are two approaches to encrypting data:

**Block ciphers** chop the plaintext into fixed-size blocks (128 bits for AES) and encrypt each block. If the last block is too short, it gets padded.

Think of it like a stamp press. You feed it a sheet of metal (plaintext block), press the stamp (key), and out comes an embossed piece (ciphertext block). Each sheet is exactly the same size.

**Stream ciphers** generate a continuous stream of pseudorandom bytes from the key and XOR it with the plaintext byte by byte.

Think of it like a one-time pad that's generated from the key. You have a continuous river of random-looking bytes, and you combine them with your message as it flows through.

In practice, you'll almost always use AES (a block cipher) in a mode that makes it behave like a stream cipher (GCM or CTR mode). The distinction matters for understanding why some modes are better than others.

---

## AES: The Standard

AES (Advanced Encryption Standard) won a public competition in 2001. It replaced DES, which was breakable due to its tiny 56-bit key. AES has been analyzed by every cryptographer on the planet for 24+ years and remains unbroken.

AES comes in three key sizes:

| Variant | Key Size | Rounds | Security Level |
|---------|---------|--------|---------------|
| AES-128 | 128 bits (16 bytes) | 10 | 128-bit security |
| AES-192 | 192 bits (24 bytes) | 12 | 192-bit security |
| AES-256 | 256 bits (32 bytes) | 14 | 256-bit security |

All three use 128-bit (16 byte) blocks. The key size determines how many rounds of transformation the data goes through.

**Which one to use**: AES-256 for anything new. The performance difference is negligible on modern hardware (which has dedicated AES instructions), and 256-bit keys provide a larger margin against future attacks, including theoretical quantum computing advances.

Modern CPUs have AES-NI instructions that encrypt at hardware speed. On a typical server, AES-256-GCM processes data at 5-10 GB/s. Encryption is not your bottleneck.

---

## Modes of Operation: This Is Where Things Go Wrong

A block cipher encrypts one block at a time. A "mode of operation" defines how you encrypt a message that's longer than one block. The choice of mode is where most symmetric encryption disasters happen.

### ECB Mode — Never Use This

ECB (Electronic Codebook) is the simplest mode: encrypt each block independently with the same key.

```
Block 1 + Key -> Ciphertext Block 1
Block 2 + Key -> Ciphertext Block 2
Block 3 + Key -> Ciphertext Block 3
```

The fatal flaw: identical plaintext blocks produce identical ciphertext blocks. Patterns in the plaintext are visible in the ciphertext.

The most famous demonstration is the "ECB Penguin." Take a bitmap image of the Linux penguin and encrypt it with AES-ECB:

```
Original image:    You see a penguin
ECB encrypted:     You still see a penguin (in scrambled colors)
CBC/GCM encrypted: You see random noise
```

The penguin's outline is visible in the ECB ciphertext because large areas of the same color (same data) encrypt to the same ciphertext. This isn't a theoretical concern — it reveals structure in the data.

**Real-world damage**: Adobe's 2013 breach stored passwords encrypted (not hashed) with 3DES in ECB mode. Identical passwords produced identical ciphertext, revealing that 1.9 million users chose "123456" without cracking a single password.

**Rule**: If you see ECB in production code, it's a vulnerability. Full stop.

### CBC Mode — Okay But Fragile

CBC (Cipher Block Chaining) fixes ECB's pattern problem by XORing each plaintext block with the previous ciphertext block before encryption:

```
Ciphertext[0] = Encrypt(Plaintext[0] XOR IV)
Ciphertext[1] = Encrypt(Plaintext[1] XOR Ciphertext[0])
Ciphertext[2] = Encrypt(Plaintext[2] XOR Ciphertext[1])
```

The IV (Initialization Vector) is a random value used for the first block so that identical plaintexts with different IVs produce different ciphertexts.

CBC solves the pattern problem but has its own issues:

1. **Padding oracle attacks**: CBC requires padding the last block. If the server returns a different error for "bad padding" vs "bad data," an attacker can decrypt the entire message by sending modified ciphertexts and observing which error they get. This broke SSL/TLS (the POODLE attack in 2014) and ASP.NET (2010).

2. **Not authenticated**: CBC doesn't tell you if the ciphertext was tampered with. You need to add a separate MAC (message authentication code), and if you do it wrong (MAC-then-encrypt instead of encrypt-then-MAC), you're vulnerable to the attacks above.

3. **Not parallelizable**: Each block depends on the previous one, so you can't encrypt blocks in parallel.

**Rule**: If you must use CBC, always use encrypt-then-MAC (encrypt first, then HMAC the ciphertext). But you shouldn't need CBC — use GCM instead.

### GCM Mode — Use This

GCM (Galois/Counter Mode) is an **authenticated encryption** mode. It provides both confidentiality (nobody can read the data) and integrity/authentication (nobody can tamper with it without detection) in a single operation.

```
Encrypt: (Key, Nonce, Plaintext, AAD) -> (Ciphertext, Authentication Tag)
Decrypt: (Key, Nonce, Ciphertext, AAD, Tag) -> Plaintext or ERROR
```

GCM uses a counter (CTR) for encryption and a Galois field multiplication for authentication. You don't need to understand the math. What matters:

1. **Authenticated**: If anyone changes even one bit of the ciphertext, decryption fails with an authentication error. No padding oracles. No subtle corruption.
2. **Parallelizable**: Each block can be encrypted independently (CTR mode), so multi-core CPUs process it faster.
3. **AAD support**: Additional Authenticated Data (AAD) is data that isn't encrypted but is authenticated. Example: in a network packet, you might encrypt the payload but authenticate the header — you need the header in plaintext for routing, but you want to detect if someone changed it.

**The tag**: GCM produces a 128-bit authentication tag. This tag is essential — it proves the ciphertext wasn't tampered with. Always store/transmit the tag with the ciphertext. If you lose the tag, you can't verify integrity.

---

## Nonces and IVs: The Most Common Mistake

A nonce (Number Used Once) or IV (Initialization Vector) is a value that makes each encryption operation unique, even with the same key and plaintext.

For AES-GCM, the nonce is 96 bits (12 bytes). It must be unique for every encryption with the same key.

**Why reuse is catastrophic**: In GCM's counter mode, the keystream depends on the key and the nonce. If you encrypt two different messages with the same key and the same nonce, both messages are XORed with the identical keystream. An attacker who XORs the two ciphertexts together gets the XOR of the two plaintexts — and from there, they can often recover both messages. Worse, nonce reuse in GCM breaks the authentication completely, allowing the attacker to forge valid ciphertexts.

The analogy: a nonce is like a unique serial number on each shipment. If you send two shipments with the same serial number, the tracking system breaks and you lose accountability for both.

### How to Generate Nonces Safely

**Option 1: Random nonce** (most common)

```go
nonce := make([]byte, 12)
if _, err := rand.Read(nonce); err != nil {
    return fmt.Errorf("generating nonce: %w", err)
}
```

With 96-bit random nonces and AES-256-GCM, you can encrypt about 2^32 (~4 billion) messages with the same key before the collision probability becomes concerning (birthday paradox). If you need more, rotate your key.

**Option 2: Counter nonce** (for high-volume)

If you're encrypting more than a few billion messages with the same key, use a counter. Start at 0, increment for each message. The counter must never repeat, and you must ensure no two processes use the same counter value (harder in distributed systems).

**What NOT to do**:
- Never use a timestamp as a nonce (two messages in the same millisecond = collision)
- Never use a hash of the message as a nonce (deterministic = not unique if the message repeats)
- Never use `Math.random()` or any non-cryptographic RNG
- Never hardcode a nonce

---

## AEAD: Authenticated Encryption with Associated Data

AEAD is the modern standard for symmetric encryption. AES-256-GCM and ChaCha20-Poly1305 are both AEAD constructions.

AEAD takes four inputs:
1. **Key**: The shared secret
2. **Nonce**: Unique per encryption (never reuse with the same key)
3. **Plaintext**: The data to encrypt
4. **Associated Data**: Data to authenticate but not encrypt (e.g., headers, metadata)

And produces:
1. **Ciphertext**: The encrypted data
2. **Tag**: Authentication proof (usually appended to ciphertext)

On decryption, if the ciphertext or the associated data has been modified, decryption fails entirely. You can't get corrupted plaintext — you get an error. This is the correct behavior.

---

## Hands-On: AES-256-GCM in Go

```go
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
)

func encrypt(plaintext []byte, key []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("key must be 32 bytes for AES-256")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("generating nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

func decrypt(ciphertext []byte, key []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("key must be 32 bytes for AES-256")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce := ciphertext[:nonceSize]
	ciphertextBody := ciphertext[nonceSize:]

	plaintext, err := gcm.Open(nil, nonce, ciphertextBody, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypting: %w", err)
	}

	return plaintext, nil
}

func generateKey() ([]byte, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("generating key: %w", err)
	}
	return key, nil
}

func main() {
	key, err := generateKey()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	message := []byte("launch codes: go go go")

	encrypted, err := encrypt(message, key)
	if err != nil {
		fmt.Fprintf(os.Stderr, "encrypt error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Ciphertext (base64): %s\n", base64.StdEncoding.EncodeToString(encrypted))

	decrypted, err := decrypt(encrypted, key)
	if err != nil {
		fmt.Fprintf(os.Stderr, "decrypt error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Decrypted: %s\n", string(decrypted))

	encrypted[len(encrypted)-1] ^= 0xFF
	_, err = decrypt(encrypted, key)
	if err != nil {
		fmt.Printf("Tamper detected (expected): %v\n", err)
	}
}
```

Key details about this code:

- `gcm.Seal(nonce, nonce, plaintext, nil)` — The first argument is where to put the output (prepending to nonce means the nonce is stored with the ciphertext). The last `nil` is where AAD would go.
- The nonce is prepended to the ciphertext. On decryption, we strip it off first.
- If anyone flips even one bit of the ciphertext, `gcm.Open` returns an error. No corrupted plaintext leaks.
- The key is 32 bytes of cryptographic randomness. Not a password. Not a hash of a password. Raw random bytes.

---

## Hands-On: AES-256-GCM in TypeScript

```typescript
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";

function encrypt(plaintext: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error("Key must be 32 bytes for AES-256");
  }

  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);

  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([nonce, tag, encrypted]);
}

function decrypt(ciphertext: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error("Key must be 32 bytes for AES-256");
  }

  if (ciphertext.length < 28) {
    throw new Error("Ciphertext too short");
  }

  const nonce = ciphertext.subarray(0, 12);
  const tag = ciphertext.subarray(12, 28);
  const encrypted = ciphertext.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted;
}

const key = randomBytes(32);
const message = Buffer.from("launch codes: go go go");

const encrypted = encrypt(message, key);
console.log(`Ciphertext (base64): ${encrypted.toString("base64")}`);

const decrypted = decrypt(encrypted, key);
console.log(`Decrypted: ${decrypted.toString("utf-8")}`);

encrypted[encrypted.length - 1] ^= 0xff;
try {
  decrypt(encrypted, key);
} catch (err) {
  console.log(`Tamper detected (expected): ${err}`);
}
```

Note the difference from Go: Node.js requires you to manually get and set the auth tag. In Go, `gcm.Seal` and `gcm.Open` handle it automatically. Both produce the same cryptographic result.

The wire format is: `[12 bytes nonce][16 bytes auth tag][N bytes encrypted data]`. This is a common convention, but not standardized — document your format.

---

## AEAD with Associated Data: A Practical Example

Say you're encrypting API request bodies. You want to encrypt the payload but authenticate the URL path and HTTP method (so an attacker can't redirect an encrypted request to a different endpoint).

```go
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"os"
)

func encryptWithAAD(plaintext, aad, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, aad)
	return ciphertext, nil
}

func decryptWithAAD(ciphertext, aad, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce := ciphertext[:nonceSize]
	ct := ciphertext[nonceSize:]

	return gcm.Open(nil, nonce, ct, aad)
}

func main() {
	key := make([]byte, 32)
	rand.Read(key)

	payload := []byte(`{"amount": 100, "to": "alice"}`)
	requestContext := []byte("POST /api/v1/transfer")

	encrypted, err := encryptWithAAD(payload, requestContext, key)
	if err != nil {
		fmt.Fprintf(os.Stderr, "encrypt error: %v\n", err)
		os.Exit(1)
	}

	decrypted, err := decryptWithAAD(encrypted, requestContext, key)
	if err != nil {
		fmt.Fprintf(os.Stderr, "decrypt error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Valid context: %s\n", string(decrypted))

	_, err = decryptWithAAD(encrypted, []byte("POST /api/v1/withdraw"), key)
	if err != nil {
		fmt.Printf("Wrong context detected: %v\n", err)
	}
}
```

The payload is encrypted. The request context (`POST /api/v1/transfer`) is authenticated but not encrypted (it's the AAD). If an attacker intercepts the request and tries to replay it against `/api/v1/withdraw`, decryption fails because the AAD doesn't match.

---

## ChaCha20-Poly1305: The Alternative

ChaCha20-Poly1305 is the other AEAD standard. It was designed by Daniel Bernstein and adopted in TLS 1.3 as an alternative to AES-GCM.

When to use it instead of AES-GCM:
- **No hardware AES support**: Mobile devices, embedded systems, older CPUs without AES-NI. ChaCha20 is fast in pure software.
- **Timing attack concerns**: AES without hardware support can leak timing information through cache behavior. ChaCha20 uses only constant-time operations.
- **Defense in depth**: If you're worried about AES ever being broken, use ChaCha20 as a hedge.

On modern server CPUs with AES-NI, AES-GCM is typically 2-5x faster. On mobile ARM chips without hardware AES, ChaCha20-Poly1305 is typically 3x faster. TLS 1.3 supports both, and the client and server negotiate which to use based on hardware capabilities.

```go
package main

import (
	"crypto/rand"
	"fmt"
	"os"

	"golang.org/x/crypto/chacha20poly1305"
)

func encryptChaCha(plaintext, key []byte) ([]byte, error) {
	aead, err := chacha20poly1305.NewX(key)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	return aead.Seal(nonce, nonce, plaintext, nil), nil
}

func decryptChaCha(ciphertext, key []byte) ([]byte, error) {
	aead, err := chacha20poly1305.NewX(key)
	if err != nil {
		return nil, err
	}

	nonceSize := aead.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce := ciphertext[:nonceSize]
	ct := ciphertext[nonceSize:]

	return aead.Open(nil, nonce, ct, nil)
}

func main() {
	key := make([]byte, chacha20poly1305.KeySize)
	rand.Read(key)

	encrypted, err := encryptChaCha([]byte("secret message"), key)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	decrypted, err := decryptChaCha(encrypted, key)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Decrypted: %s\n", string(decrypted))
}
```

Note: `chacha20poly1305.NewX` creates the XChaCha20 variant with a 192-bit (24-byte) nonce. The larger nonce makes random generation safer — you can encrypt 2^64 messages before worrying about collisions (vs. 2^32 for AES-GCM's 96-bit nonce).

---

## Key Management: The Hard Part

The encryption algorithm is the easy part. Key management is where systems actually break.

### Key Generation

Keys must be generated with a cryptographically secure random number generator:

```go
key := make([]byte, 32)
if _, err := crypto_rand.Read(key); err != nil {
    panic(err)
}
```

```typescript
import { randomBytes } from "crypto";
const key = randomBytes(32);
```

**Never**: derive a key from a password using a regular hash (SHA-256). If you must derive from a password, use a KDF:

```go
import "golang.org/x/crypto/argon2"

key := argon2.IDKey([]byte(password), salt, 3, 64*1024, 4, 32)
```

### Key Storage

- **Development**: Environment variables or `.env` files (in `.gitignore`)
- **Production**: HashiCorp Vault, AWS KMS, GCP Cloud KMS, Azure Key Vault
- **Never**: In source code, in config files committed to git, in database columns accessible to the application

### Key Rotation

Keys should be rotated periodically. This means:
1. Generate a new key
2. Re-encrypt data with the new key (or keep old key available for decryption)
3. Update all systems using the key
4. Retire the old key after all data is re-encrypted

Envelope encryption simplifies this: encrypt your data with a data encryption key (DEK), then encrypt the DEK with a key encryption key (KEK) stored in a vault. To rotate, re-encrypt only the DEK, not all the data.

---

## Real-World Breaches: Symmetric Encryption Gone Wrong

### The Adobe Breach (2013) — ECB Mode

153 million user records stolen. Passwords were encrypted (not hashed) with 3DES in ECB mode. Identical passwords produced identical ciphertext. The password hint was stored in plaintext next to the encrypted password. By cross-referencing hints and identical ciphertexts, attackers could deduce passwords for millions of accounts without even breaking the encryption.

**Lesson**: ECB mode leaks patterns. Encryption is not hashing. Passwords should be hashed, not encrypted.

### WannaCry Ransomware (2017) — Symmetric Key Left in Memory

WannaCry encrypted files with AES-128-CBC and a unique key per file. The per-file key was encrypted with an RSA public key. But early versions left the AES key in process memory, allowing recovery tools to decrypt files if the machine hadn't been rebooted.

**Lesson**: Key lifetime matters. Wipe keys from memory as soon as you're done with them. In Go, you can zero out a byte slice:

```go
func wipeKey(key []byte) {
	for i := range key {
		key[i] = 0
	}
}
```

In practice, the Go garbage collector and memory optimizer make this unreliable — the key may have been copied. Rust's `zeroize` crate is more reliable because it prevents the optimizer from eliding the zeroing. This is a genuinely hard problem.

### PlayStation 3 (2010) — Nonce Reuse

Sony used ECDSA to sign PS3 firmware, but they used the same random value (nonce) for every signature. In ECDSA, reusing a nonce with the same key reveals the private key mathematically. The hacker George Hotz (geohot) extracted Sony's private signing key, allowing anyone to sign homebrew code as if it were an official Sony release.

**Lesson**: Nonce reuse is catastrophic. Not "slightly weakens security." Catastrophic. Total key compromise.

---

## Common Mistakes

### Mistake 1: Generating Keys from Passwords Without a KDF

```go
// WRONG — predictable, low entropy
key := sha256.Sum256([]byte("my-password"))
```

```go
// RIGHT — use a proper KDF
key := argon2.IDKey([]byte("my-password"), salt, 3, 64*1024, 4, 32)
```

### Mistake 2: Using ECB Mode

```typescript
// WRONG — patterns visible in ciphertext
createCipheriv("aes-256-ecb", key, null);
```

```typescript
// RIGHT — authenticated encryption
createCipheriv("aes-256-gcm", key, randomBytes(12));
```

### Mistake 3: Reusing Nonces

```go
// WRONG — same nonce every time
nonce := []byte("my-fixed-nonce!!")
gcm.Seal(nil, nonce, plaintext, nil)
```

```go
// RIGHT — random nonce every time
nonce := make([]byte, gcm.NonceSize())
rand.Read(nonce)
gcm.Seal(nil, nonce, plaintext, nil)
```

### Mistake 4: Ignoring the Authentication Tag

```typescript
// WRONG — encrypting with CBC and no MAC
const cipher = createCipheriv("aes-256-cbc", key, iv);
// No integrity check — vulnerable to padding oracle attacks
```

```typescript
// RIGHT — GCM provides authentication automatically
const cipher = createCipheriv("aes-256-gcm", key, nonce);
// Auth tag proves ciphertext wasn't tampered with
```

### Mistake 5: Using Math.random() for Cryptographic Purposes

```typescript
// WRONG — predictable, not cryptographically secure
const key = Buffer.from(
  Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))
);
```

```typescript
// RIGHT — cryptographically secure
const key = randomBytes(32);
```

`Math.random()` uses a PRNG seeded with limited entropy. An attacker can predict future outputs after observing a few values. `crypto.randomBytes()` uses the OS's cryptographic RNG (`/dev/urandom` on Linux, `CryptGenRandom` on Windows).

---

## The Key Distribution Problem

We've been assuming both parties have the same key. But how did they get it?

- You can't send the key over the internet in plaintext (someone will intercept it)
- You can't encrypt the key (you'd need another key to encrypt this key, and another key to encrypt that key...)
- You can't meet in person every time (the internet is supposed to eliminate that)

This is the fundamental limitation of symmetric encryption. It's fast, efficient, and secure — but only if both parties already share the key.

The solution is asymmetric encryption (next lesson). In practice, systems use asymmetric encryption to exchange a symmetric key, then use the symmetric key for the actual data encryption. This is called a hybrid cryptosystem, and it's how TLS, SSH, Signal, and every other modern secure protocol works.

The key exchange takes a few milliseconds of expensive asymmetric crypto. The data transfer uses fast symmetric crypto. Best of both worlds.

---

## Exercises

1. **ECB visualization**: Write a program that encrypts a BMP image with AES-ECB and AES-GCM. Compare the encrypted images visually. The ECB version should show patterns; the GCM version should look like random noise.

2. **Nonce reuse attack**: Encrypt two different messages with AES-CTR (not GCM) using the same key and nonce. XOR the two ciphertexts together. Notice that you get the XOR of the two plaintexts — and from there, if one plaintext is known (or partially known), you can recover the other.

3. **File encryption tool**: Build a CLI tool that encrypts and decrypts files using AES-256-GCM. Derive the key from a user-provided password using Argon2id. Store the salt, nonce, and auth tag alongside the ciphertext. This is essentially what GPG symmetric encryption does.

4. **Key rotation**: Extend the file encryption tool to support key rotation — re-encrypt a file with a new password without exposing the plaintext to disk (decrypt and re-encrypt in memory).

---

## Key Takeaways

- AES-256-GCM is your default choice for symmetric encryption
- ECB mode is broken — never use it
- Nonce reuse is catastrophic — always generate random nonces with a crypto RNG
- AEAD (AES-GCM, ChaCha20-Poly1305) gives you encryption AND integrity in one operation
- The hard part isn't the algorithm — it's key management
- Symmetric encryption requires both parties to share a key, which leads us to asymmetric encryption
