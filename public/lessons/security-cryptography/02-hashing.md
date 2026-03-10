# Hashing

## What Is a Hash Function?

A hash function takes any input — a byte, a book, a 4GB video file — and produces a fixed-size output. Always the same size, regardless of input.

Think of it as a meat grinder. You can turn a cow into ground beef, but you can't turn ground beef back into a cow. And two different cows produce different-looking ground beef. That's hashing:

1. **One-way**: Given the output, you can't reconstruct the input
2. **Deterministic**: Same input always produces the same output
3. **Fixed-size**: Whether you hash "hi" or the entire contents of Wikipedia, you get the same number of bytes out

SHA-256 always produces 256 bits (32 bytes, 64 hex characters). Always.

```
Input: "hello"
SHA-256: 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824

Input: "hello."  (one period added)
SHA-256: 3338c5bf6ffd009de2e40c44444fc612a14a1b6f83e2b0c74c9f6385f1054c50

Input: (entire text of War and Peace)
SHA-256: (still 64 hex characters)
```

The output is called a hash, digest, or fingerprint.

---

## The Three Properties That Matter

### Property 1: Pre-image Resistance (One-Way)

Given a hash output `h`, it's computationally infeasible to find any input `m` such that `hash(m) = h`.

Translation: you can't work backwards. If I give you `2cf24dba...`, you can't figure out that the input was "hello" without trying every possible input until one matches. For SHA-256, that means trying (on average) 2^255 inputs. The sun will die first.

**Why it matters**: Password databases store hashes. If an attacker steals the database, they get hashes, not passwords. Pre-image resistance means they can't reverse the hash to get your password. (They can still try common passwords, which is why we add salt — more on that soon.)

### Property 2: Collision Resistance

It should be computationally infeasible to find two different inputs `m1` and `m2` where `hash(m1) = hash(m2)`.

Think about it: SHA-256 produces 256-bit outputs. There are a finite number of possible outputs (2^256) but infinite possible inputs. So collisions *must* exist mathematically — the pigeonhole principle. Collision resistance means nobody can actually *find* one in practice.

**Why it matters**: If you can find collisions, you can create two different documents with the same hash. One says "I owe you $100," the other says "I owe you $1,000,000." Both produce the same hash. The signature on one is valid for the other.

### Property 3: Avalanche Effect

Changing a single bit of input should change approximately 50% of the output bits. The output should look completely unrelated to the input.

```
"hello"  -> 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
"hellp"  -> 4e7c8e3c26f14c51e36c4bfb3ba5e0eb8f8c8e2a7574e6b9a53e4c1a8eef0135
```

One letter changed. The entire hash is different. There's no pattern, no gradual shift, no way to tell that the inputs were similar.

**Why it matters**: Without this property, you could partially reverse a hash by noting which output bits change when you tweak input bits. The avalanche effect makes every output look like random noise.

---

## Hash Functions: The Lineup

### MD5 — Dead. Do Not Use.

MD5 produces a 128-bit (16-byte) hash. It was designed in 1991 by Ronald Rivest.

**Why it's broken**: Researchers found collision attacks in 2004. By 2012, creating an MD5 collision took seconds on a laptop. The Flame malware (2012) exploited an MD5 collision in Windows Update's certificate system to disguise itself as a legitimate Microsoft update.

Here's how easy collisions are. Two different files, same MD5:

```bash
# These two different inputs produce the same MD5 hash
echo -n "d131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f8955ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5bd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70" | xxd -r -p | md5

echo -n "d131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f8955ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5bd8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70" | xxd -r -p | md5
```

Both produce the same MD5 hash despite being different inputs. Game over for MD5.

**The only acceptable use of MD5 in 2025**: checking if a file download was corrupted in transit (not for security — just convenience). Even then, use SHA-256 instead.

### SHA-256 — The Workhorse

SHA-256 (part of the SHA-2 family) produces a 256-bit hash. It's been the standard since 2001.

No practical collision attacks exist. The best known attack reduces the security from 2^128 to about 2^125 for collision finding — still completely impractical. Every Bitcoin block is secured by SHA-256. The entire SSL/TLS certificate ecosystem relies on it.

**Use SHA-256 when**: You need a general-purpose hash for integrity checks, digital signatures, HMAC, Merkle trees, or any non-password purpose.

### SHA-3 — The Backup Standard

SHA-3 uses a completely different internal design (Keccak sponge construction) from SHA-2. It was chosen through a public competition in 2012 specifically to have a fallback if SHA-2 is ever broken.

**Use SHA-3 when**: Compliance requires it, or you want a belt-and-suspenders approach where you don't want both hashes to share the same weakness.

### BLAKE3 — The Speed Demon

BLAKE3 is the fastest cryptographic hash function on modern hardware. It's parallelizable — it can use all your CPU cores to hash a single file. It produces 256-bit output by default but can produce any length.

Benchmarks on a modern machine:
- MD5: ~5 GB/s
- SHA-256: ~2 GB/s
- SHA-3: ~1.5 GB/s
- BLAKE3: ~10+ GB/s (with parallelism)

**Use BLAKE3 when**: You need speed — file hashing, content-addressable storage, checksum verification. It's a newer standard but well-analyzed and increasingly adopted.

---

## Use Cases: Where Hashing Shows Up

### File Integrity (Checksums)

Every Linux distribution publishes SHA-256 checksums for their ISO files:

```bash
# Download the ISO
wget https://releases.ubuntu.com/22.04/ubuntu-22.04-desktop-amd64.iso

# Verify it wasn't corrupted or tampered with
sha256sum ubuntu-22.04-desktop-amd64.iso
# Compare the output with the published checksum
```

If even a single byte was changed during download — corruption, man-in-the-middle attack — the hash won't match.

### Data Structures (Hash Maps)

You already know this from TypeScript and Go. A hash map uses a hash function to convert keys into array indices. The hash function needs to be fast and distribute keys evenly, but it doesn't need to be cryptographic (no one-way or collision-resistance requirements). `Map` in JS and `map` in Go use non-cryptographic hashes internally.

The key insight: cryptographic hash functions and hash map hash functions serve different purposes. Don't use SHA-256 for a hash map (too slow). Don't use a hash map's hash function for security (not collision-resistant).

### Git Commits (Content-Addressable Storage)

Every git object — commits, trees, blobs — is identified by its SHA-1 hash. When you `git commit`, git hashes the commit content (author, message, tree hash, parent hash, timestamp) to produce a commit ID.

```bash
git log --oneline
# a1b2c3d feat: add user authentication
# e4f5g6h fix: resolve race condition in worker pool
```

Those hex strings are the first 7 characters of SHA-1 hashes. The entire git history is a Merkle tree (a tree of hashes) where each commit references its parent by hash. Changing any bit in any historical commit changes its hash, which changes the child commit's hash, which cascades all the way to HEAD.

**The catch**: Git uses SHA-1, which has known collisions (the SHAttered attack in 2017). Git is migrating to SHA-256 (git's `hash-function-transition` plan), but it's a slow process because every tool in the ecosystem needs to support it.

### Password Storage (Preview)

Hashing passwords is so important and so often done wrong that it gets its own special treatment. The key insight: regular hash functions (SHA-256, BLAKE3) are **too fast** for passwords. An attacker with a GPU can try billions of SHA-256 hashes per second. You need a hash function that's intentionally slow — bcrypt, scrypt, or Argon2id. More on this in a later lesson.

For now, remember: **SHA-256 is for files, Argon2id is for passwords.**

---

## Hands-On: Hashing in Go

```go
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

func hashString(input string) string {
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}

func hashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("opening file: %w", err)
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", fmt.Errorf("reading file: %w", err)
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

func main() {
	fmt.Println(hashString("hello"))

	fmt.Println(hashString("hello."))

	digest, err := hashFile("somefile.txt")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("File hash: %s\n", digest)
}
```

Key details:
- `sha256.Sum256()` returns a `[32]byte` array, not a slice. Use `h[:]` to convert.
- For large files, use `sha256.New()` and stream with `io.Copy` — don't load the entire file into memory.
- `hex.EncodeToString` converts the raw bytes to the hex string you're used to seeing.

---

## Hands-On: Hashing in TypeScript

```typescript
import { createHash, createReadStream } from "crypto";

function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

console.log(hashString("hello"));
// 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824

console.log(hashString("hello."));
// completely different hash

const digest = await hashFile("somefile.txt");
console.log(`File hash: ${digest}`);
```

Same pattern: for strings, hash in one shot. For files, stream the data through the hash function.

You can swap `"sha256"` for `"sha512"`, `"sha3-256"`, or `"md5"` (don't) — the API is the same.

---

## Hands-On: How Git Uses Hashes

Git creates a blob object like this:

```bash
# What git does internally when you add a file
echo -n "hello" | git hash-object --stdin
# ce013625030ba8dba906f756967f9e9ca394464a

# That's: SHA-1("blob 5\0hello")
# Format: "blob " + content_length + null_byte + content
echo -ne "blob 5\0hello" | sha1sum
# ce013625030ba8dba906f756967f9e9ca394464a  -
```

Let's verify this in Go:

```go
package main

import (
	"crypto/sha1"
	"fmt"
)

func gitBlobHash(content string) string {
	header := fmt.Sprintf("blob %d\x00", len(content))
	data := header + content
	h := sha1.Sum([]byte(data))
	return fmt.Sprintf("%x", h)
}

func main() {
	fmt.Println(gitBlobHash("hello"))
}
```

And in TypeScript:

```typescript
import { createHash } from "crypto";

function gitBlobHash(content: string): string {
  const header = `blob ${Buffer.byteLength(content)}\0`;
  return createHash("sha1")
    .update(header + content)
    .digest("hex");
}

console.log(gitBlobHash("hello"));
// ce013625030ba8dba906f756967f9e9ca394464a
```

This is content-addressable storage: the content determines the address (hash). Same content always gets the same address. Different content always gets a different address (assuming no collisions).

---

## Salting: Why Identical Inputs Need Different Outputs

Here's the problem with hashing passwords directly:

```
User A password: "password123" -> SHA-256 -> ef92b778...
User B password: "password123" -> SHA-256 -> ef92b778...
```

Same password, same hash. An attacker who cracks one has cracked both. Worse, attackers precompute hashes for common passwords (rainbow tables) — millions of password-to-hash mappings ready to look up instantly.

The fix is a **salt**: a random string prepended to each password before hashing.

```
User A: salt="x7k9m2" -> SHA-256("x7k9m2" + "password123") -> 3a5b1c...
User B: salt="p4q8r1" -> SHA-256("p4q8r1" + "password123") -> 9d8e7f...
```

Same password, different salt, completely different hash. Rainbow tables are useless because the attacker would need a separate table for every possible salt.

The salt is stored in plaintext next to the hash. It's not a secret — its job is to make each hash unique, not to be secret.

```go
package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

func generateSalt(size int) ([]byte, error) {
	salt := make([]byte, size)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("generating salt: %w", err)
	}
	return salt, nil
}

func hashWithSalt(password string, salt []byte) string {
	h := sha256.New()
	h.Write(salt)
	h.Write([]byte(password))
	return hex.EncodeToString(salt) + ":" + hex.EncodeToString(h.Sum(nil))
}

func main() {
	salt, err := generateSalt(16)
	if err != nil {
		panic(err)
	}

	fmt.Println(hashWithSalt("password123", salt))

	salt2, err := generateSalt(16)
	if err != nil {
		panic(err)
	}

	fmt.Println(hashWithSalt("password123", salt2))
}
```

**Important**: This is for illustration. In production, use Argon2id or bcrypt, which handle salting automatically. Don't build your own password hashing scheme.

---

## HMAC: When You Need Authentication With Your Hash

A plain hash verifies integrity (was the data corrupted?) but not authenticity (did it come from who I think?). Anyone can compute SHA-256("hello").

HMAC (Hash-based Message Authentication Code) adds a secret key. Only someone with the key can compute (or verify) the HMAC.

```
HMAC-SHA256(key, message) = SHA-256((key XOR opad) || SHA-256((key XOR ipad) || message))
```

You don't need to understand the internals. What matters:

- HMAC takes a key and a message
- Only someone with the key can produce a valid HMAC
- Changing any bit of the message or using the wrong key produces a completely different result
- It's immune to length-extension attacks (a vulnerability of plain SHA-256)

```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

func computeHMAC(message, key string) string {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}

func verifyHMAC(message, key, expectedMAC string) bool {
	actualMAC := computeHMAC(message, key)
	return hmac.Equal([]byte(actualMAC), []byte(expectedMAC))
}

func main() {
	key := "my-secret-key"
	message := "transfer $100 to Alice"

	mac := computeHMAC(message, key)
	fmt.Printf("HMAC: %s\n", mac)

	fmt.Printf("Valid: %v\n", verifyHMAC(message, key, mac))
	fmt.Printf("Tampered: %v\n", verifyHMAC("transfer $10000 to Eve", key, mac))
}
```

```typescript
import { createHmac, timingSafeEqual } from "crypto";

function computeHMAC(message: string, key: string): string {
  return createHmac("sha256", key).update(message).digest("hex");
}

function verifyHMAC(
  message: string,
  key: string,
  expectedMAC: string
): boolean {
  const actualMAC = computeHMAC(message, key);
  return timingSafeEqual(Buffer.from(actualMAC), Buffer.from(expectedMAC));
}

const key = "my-secret-key";
const message = "transfer $100 to Alice";

const mac = computeHMAC(message, key);
console.log(`HMAC: ${mac}`);

console.log(`Valid: ${verifyHMAC(message, key, mac)}`);
console.log(`Tampered: ${verifyHMAC("transfer $10000 to Eve", key, mac)}`);
```

**Critical detail**: Use `hmac.Equal` (Go) or `timingSafeEqual` (Node.js) for comparison, never `===` or `==`. String comparison can be vulnerable to timing attacks — an attacker can measure how long the comparison takes to determine how many leading bytes matched, then crack the MAC byte by byte.

---

## Real-World Use Cases for HMAC

- **Webhook verification**: Stripe, GitHub, and Slack sign webhook payloads with HMAC. You verify the signature to ensure the webhook is legitimate.
- **JWT signatures**: HS256 JWTs use HMAC-SHA256 to sign the token payload.
- **API authentication**: AWS Signature V4 uses HMAC-SHA256 to sign API requests.
- **Cookie integrity**: Signed cookies use HMAC to prevent tampering.

---

## Merkle Trees: Hashing at Scale

A Merkle tree is a tree of hashes. The leaves are hashes of individual data blocks. Each parent node is the hash of its children concatenated.

```
        Root Hash
       /         \
    Hash(AB)    Hash(CD)
    /    \       /    \
 Hash(A) Hash(B) Hash(C) Hash(D)
   |       |       |       |
 Block A Block B Block C Block D
```

Why this is powerful:

1. **Efficient verification**: To verify Block B is unchanged, you only need Hash(A), Hash(CD), and the root hash — not the entire dataset. You recompute Hash(B), then Hash(AB), then the root, and compare.

2. **Tamper detection**: Changing any block changes its hash, which changes its parent's hash, which cascades to the root. The root hash is a fingerprint of the entire dataset.

Where Merkle trees show up:
- **Git**: The entire repository is a Merkle tree. Commits reference trees, trees reference blobs, everything by hash.
- **Bitcoin/Ethereum**: Transactions in a block are organized as a Merkle tree. The block header contains only the root hash.
- **Certificate Transparency**: Certificate logs use Merkle trees so anyone can verify a certificate was logged without downloading the entire log.

---

## The Length-Extension Attack (Why Raw SHA-256 Isn't Always Enough)

Here's a subtle flaw. If you compute `SHA-256(secret + message)` as a MAC (instead of using HMAC), an attacker who knows the length of the secret can compute a valid hash for `secret + message + padding + attacker_data` without knowing the secret.

This is called a length-extension attack. SHA-256, SHA-512, and SHA-1 are all vulnerable because of how their internal state works (Merkle-Damgard construction).

```
You compute:  SHA-256("secret" + "amount=100")
Attacker computes: SHA-256("secret" + "amount=100" + padding + "&to=eve")
... without knowing "secret"
```

The fix: Use HMAC. HMAC is specifically designed to prevent this. Or use SHA-3/BLAKE3, which use different internal constructions (sponge/tree) that aren't vulnerable.

This has caused real vulnerabilities. Flickr's API signing was vulnerable to this attack in 2009.

---

## Performance: How Fast Are These Things?

On a modern machine (2024 MacBook Pro, single core):

| Algorithm | Speed | Hash of 1 GB |
|-----------|-------|-------------|
| MD5 | ~5 GB/s | ~0.2 seconds |
| SHA-1 | ~3 GB/s | ~0.33 seconds |
| SHA-256 | ~2 GB/s | ~0.5 seconds |
| SHA-512 | ~2.5 GB/s | ~0.4 seconds |
| SHA-3 | ~1.5 GB/s | ~0.67 seconds |
| BLAKE3 | ~10 GB/s (parallel) | ~0.1 seconds |

For password hashing (intentionally slow):

| Algorithm | Target Time | Hashes/sec |
|-----------|------------|------------|
| Argon2id (64MB, 3 iterations) | ~250ms | ~4 |
| bcrypt (cost 12) | ~250ms | ~4 |
| SHA-256 (for comparison) | ~0.5 microseconds | ~2,000,000 |

The difference is the point. File checksums need to be fast. Password hashing needs to be slow. A factor of 500,000x makes brute-force cracking economically impossible.

---

## Common Mistakes

### Mistake 1: Using SHA-256 for Passwords

```go
// WRONG — SHA-256 is too fast for passwords
hash := sha256.Sum256([]byte(password))
```

An attacker with a GPU can try 10+ billion SHA-256 hashes per second. That's every 8-character alphanumeric password in about 3 hours.

```go
// RIGHT — Argon2id is intentionally slow and memory-hard
import "golang.org/x/crypto/argon2"

hash := argon2.IDKey([]byte(password), salt, 3, 64*1024, 4, 32)
```

### Mistake 2: Comparing Hashes With ==

```go
// WRONG — timing attack vulnerability
if computedMAC == expectedMAC {
    // ...
}
```

String comparison short-circuits on the first different byte. An attacker can time the comparison to learn how many leading bytes match, then crack the MAC byte by byte.

```go
// RIGHT — constant-time comparison
if hmac.Equal([]byte(computedMAC), []byte(expectedMAC)) {
    // ...
}
```

### Mistake 3: Not Salting Passwords

```go
// WRONG — rainbow tables will crack these instantly
hash := sha256.Sum256([]byte(password))
```

```go
// RIGHT — unique salt per password (Argon2id handles this for you)
salt := make([]byte, 16)
rand.Read(salt)
hash := argon2.IDKey([]byte(password), salt, 3, 64*1024, 4, 32)
```

### Mistake 4: Using MD5 or SHA-1 for Anything Security-Related

```typescript
// WRONG — MD5 has trivial collisions
createHash("md5").update(data).digest("hex");
```

```typescript
// RIGHT
createHash("sha256").update(data).digest("hex");
```

---

## Exercises

1. **Hash collision demo**: Write a program that tries random 4-character strings until it finds two that produce the same first 4 bytes of their SHA-256 hash (a partial collision). How many attempts does it take? (Expected: ~65,000 due to the birthday paradox.)

2. **File integrity checker**: Write a tool that takes a directory, hashes every file with SHA-256, and stores the hashes. Run it again later and report which files changed. This is the core of tools like `tripwire`.

3. **Webhook verifier**: Implement Stripe-style webhook verification. The sender computes `HMAC-SHA256(secret, payload)` and sends it in a header. The receiver recomputes and compares using constant-time comparison.

4. **Git hash verification**: Pick a file in a git repo, compute its git blob hash manually (using the `blob {size}\0{content}` format), and verify it matches `git hash-object`.

---

## Key Takeaways

- Hash functions are one-way: input to output is instant, output to input is impossible
- SHA-256 for general purpose, BLAKE3 when speed matters, Argon2id for passwords
- MD5 and SHA-1 are broken — do not use them for security
- Salt every password hash with a unique random salt
- Use HMAC (not raw hashing) when you need authentication
- Compare hashes with constant-time functions, never with `==`
- Fast hashing is a feature for files, a bug for passwords
