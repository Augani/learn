# Why Cryptography Exists

## The Fundamental Problem

Imagine you're passing notes in a classroom. You write "I like pizza" on a piece of paper and hand it to your friend three seats over. The problem: two other kids have to pass that note along. Any one of them could read it, change it, or write a completely new note and pretend it's from you.

That's the internet. Every message you send bounces through routers, ISPs, Wi-Fi access points, and servers you don't control. Any of them could be watching.

Cryptography solves one question: **how do two parties communicate securely when the channel between them is completely insecure?**

This isn't theoretical paranoia. It's Tuesday on the internet.

---

## The Four Pillars

Cryptography gives us four guarantees. Every secure system you've ever used relies on some combination of these.

### 1. Confidentiality — Only the Intended Recipient Can Read It

When you send your credit card number to Amazon, your ISP shouldn't be able to read it. Your company's Wi-Fi admin shouldn't see it. The 47 routers between you and Amazon's server shouldn't see it.

Confidentiality means the message is locked. Only the person with the right key can open it.

**Real-world example**: HTTPS encrypts the content of your web traffic. Your ISP can see that you're connecting to amazon.com, but they can't see what you're buying. (Without HTTPS, they could see everything — your password, your cart, your payment info.)

### 2. Integrity — Nobody Tampered With It

Imagine you wire $100 to a friend, but somewhere between your bank and theirs, someone changes it to $10,000 going to their own account. Integrity means you can detect if a single bit of the message was changed in transit.

**Real-world example**: When you download a Linux ISO, the website shows a SHA-256 checksum. You hash the downloaded file and compare. If they match, the file wasn't corrupted or tampered with during download.

### 3. Authentication — It's Really From Who It Claims

You get an email from your CEO saying "wire $50,000 to this account immediately." Is it really from your CEO? Without authentication, you can't tell. Anyone can put any name in the "From" field.

Authentication proves identity. The message genuinely came from the claimed sender.

**Real-world example**: When you `git pull` from GitHub, TLS certificates prove you're actually talking to GitHub, not an impostor. Your browser checks the certificate chain before showing the padlock icon.

### 4. Non-Repudiation — The Sender Can't Deny Sending It

You sign a contract. Later, the other party claims you never signed it. Non-repudiation is the cryptographic equivalent of a notarized signature — the signer can't later deny they signed.

This is stronger than authentication. Authentication proves who sent a message *to the recipient*. Non-repudiation proves it *to everyone*, including a judge.

**Real-world example**: Digitally signed git commits prove that a specific developer made a specific change. They can't later claim "that wasn't me" because the signature is tied to their private key.

---

## The Locked Box Analogy

Here's the mental model that ties it all together:

Cryptography is like sending a locked box through a postal system run by thieves.

- **Confidentiality**: The box is locked. Thieves can see the box, carry it, even shake it. But they can't open it.
- **Integrity**: The box has a tamper-evident seal. If anyone opens it and closes it again, you'll know.
- **Authentication**: The box has the sender's unique seal stamped on it. You recognize the seal and know it's genuine.
- **Non-repudiation**: The seal is registered with a trusted authority. Even in court, the sender can't deny they sealed that box.

The postal thieves (the internet) can see that a box is being sent from point A to point B. They can see how big it is. But they can't read the contents, change them, forge the sender, or make the sender deny they sent it.

---

## A Brief History (The Parts That Matter)

### Caesar Cipher (~50 BC) — Shift Letters

Julius Caesar shifted each letter in his messages by 3 positions. A became D, B became E, and so on.

```
Plaintext:  ATTACK AT DAWN
Ciphertext: DWWDFN DW GDZQ
```

This is called a substitution cipher. The "key" is the number of positions to shift (3 in this case).

The problem: there are only 25 possible shifts. Try all 25 and you've cracked it. A child can break this. But the concept — transforming plaintext into ciphertext using a key — is the foundation of all encryption.

### The Enigma Machine (1930s-1940s) — Complexity Is Not Security

Nazi Germany used the Enigma machine to encrypt military communications. It used rotating wheels to create a substitution that changed with every keystroke. The number of possible configurations was around 159 quintillion (159 x 10^18).

The Allies broke it. Alan Turing and the team at Bletchley Park exploited weaknesses in the machine's design and in how operators used it (they were lazy — some started every message with "HEIL HITLER," which gave the codebreakers a known plaintext to work with).

Lessons:
1. Complexity alone doesn't make something secure
2. Human behavior is always the weakest link
3. Known plaintext is devastating (if an attacker knows part of the message, they can deduce the rest)

### Diffie-Hellman (1976) — The Revolution

Here's the problem that stumped everyone for centuries: if encryption requires a shared key, how do two people agree on a key when someone is listening to every word they say?

It's like trying to agree on a secret password while shouting across a crowded room.

Whitfield Diffie and Martin Hellman solved it. Their key exchange protocol lets two parties create a shared secret over a completely public channel, and anyone listening learns nothing useful.

The paint-mixing analogy:

1. Alice and Bob publicly agree on a common color (say, yellow). Eve the eavesdropper sees this.
2. Alice secretly picks a private color (red) and mixes it with yellow to get orange. She sends orange to Bob.
3. Bob secretly picks a private color (blue) and mixes it with yellow to get green. He sends green to Alice.
4. Alice takes Bob's green and mixes in her secret red. She gets a brownish color.
5. Bob takes Alice's orange and mixes in his secret blue. He gets the *same* brownish color.
6. Eve saw yellow, orange, and green. But she can't unmix the colors to figure out the shared brown.

The mathematical version uses modular exponentiation instead of paint, but the principle is identical. This was the breakthrough that made modern internet security possible.

### RSA (1977) — Public Key Encryption

Ron Rivest, Adi Shamir, and Leonard Adleman took the Diffie-Hellman concept further. They created a system with two keys:

- A **public key** you share with everyone (like publishing your phone number)
- A **private key** you keep secret (like the password to your voicemail)

Anyone can encrypt a message with your public key. Only you can decrypt it with your private key. This is the mathematical equivalent of the locked mailbox — anyone can drop a letter in, only you can open it.

RSA is based on a simple asymmetry: multiplying two large prime numbers is easy, but factoring the result back into those primes is extremely hard. Your public key is the product. Your private key is the primes.

### AES (2001) — The Modern Standard

The US government ran a public competition to replace DES (the previous standard, with a laughably small 56-bit key). Fifteen algorithms from around the world competed. After three years of public analysis, Rijndael — designed by two Belgian cryptographers, Joan Daemen and Vincent Rijmen — won.

AES has three variants: AES-128, AES-192, and AES-256 (the numbers are key sizes in bits). AES-256 has a key space of 2^256 possible keys. To put that in perspective: if every atom in the observable universe (about 10^80 atoms) was a computer trying a billion keys per second, it would take longer than the age of the universe to try them all.

AES is used everywhere: HTTPS, SSH, disk encryption (FileVault, BitLocker), VPNs, Signal, WhatsApp, and pretty much every encrypted communication on the planet. It's the workhorse of modern cryptography.

### The Timeline

Here's the compressed version of crypto history that matters for practitioners:

```
~50 BC    Caesar cipher (substitution)
1500s     Vigenere cipher (polyalphabetic substitution)
1918      One-time pad proven perfectly secure (but impractical for most uses)
1930s     Enigma machine (rotor-based mechanical encryption)
1945      Allies break Enigma, ending WWII faster
1976      Diffie-Hellman key exchange (public key revolution)
1977      RSA public key encryption
1977      DES adopted as federal standard (56-bit key)
1991      PGP released (brings crypto to the masses)
1994      SSL 1.0 (never released publicly due to flaws)
1995      SSL 2.0 (Netscape, first HTTPS)
1999      TLS 1.0 (standardized SSL)
2001      AES replaces DES
2005      SHA-1 collision attacks become theoretical
2008      Bitcoin whitepaper (crypto-based digital currency)
2013      Snowden revelations (mass surveillance exposed)
2014      Heartbleed (OpenSSL memory leak)
2017      SHA-1 collision demonstrated (SHAttered)
2018      TLS 1.3 standardized (major security/speed improvements)
2024      NIST standardizes post-quantum algorithms (ML-KEM, ML-DSA)
```

Each breakthrough solved a problem the previous generation couldn't. Each failure taught us something about what not to do.

---

## Cryptographic Randomness: The Foundation

Every cryptographic operation — key generation, nonce creation, salt generation, initialization vectors — requires random numbers. Not pseudo-random. Not "random enough." Cryptographically random.

The difference matters enormously:

**`Math.random()` (JavaScript) / `math/rand` (Go)**: Uses a deterministic algorithm seeded with limited entropy (often just the current time). Given the same seed, it produces the exact same sequence. An attacker who can guess or observe a few outputs can predict all future outputs. This is a PRNG (Pseudo-Random Number Generator), not suitable for any security purpose.

**`crypto.getRandomValues()` (JavaScript) / `crypto/rand` (Go)**: Draws entropy from the operating system's cryptographic random number generator (`/dev/urandom` on Linux/macOS, `CryptGenRandom` on Windows). The OS collects entropy from hardware events — mouse movements, keyboard timing, disk I/O timing, CPU temperature fluctuations, hardware RNG instructions. The output is computationally indistinguishable from true randomness.

```go
import "crypto/rand"

key := make([]byte, 32)
_, err := rand.Read(key)
```

```typescript
import { randomBytes } from "crypto";
const key = randomBytes(32);
```

**The Debian OpenSSL disaster (2006-2008)**: A Debian maintainer commented out two lines of code in OpenSSL's random number generator because a code analysis tool flagged them as using uninitialized memory. This removed almost all entropy from the RNG. For two years, every SSL key, SSH key, and certificate generated on Debian and Ubuntu systems had only 32,767 possible values. Any of them could be brute-forced in seconds.

This single bug compromised every server, every SSH connection, and every certificate generated on the most popular Linux distribution for two years. Randomness is foundational — if it breaks, everything built on top of it breaks.

---

## Kerckhoffs's Principle

In 1883, Auguste Kerckhoffs stated a rule that defines modern cryptography:

**A cryptosystem should be secure even if everything about the system, except the key, is public knowledge.**

This is the opposite of "security through obscurity." The algorithm should be published, peer-reviewed, attacked by the best cryptographers in the world, and still hold up. The only secret is the key.

Why this matters:

- **Enigma violated this**. Its security relied partly on the machine's design being secret. Once the Allies captured a machine, the only thing protecting messages was the daily key settings.
- **AES follows this**. The AES algorithm is completely public. Published in 2001. Studied by thousands of researchers. Still unbroken. The only secret is your specific key.

Think of it like a padlock. Everyone knows how padlocks work. You can buy one at any hardware store and study the mechanism. That doesn't help you open a locked one without the key. The security is in the key, not in the mechanism being secret.

**The contrapositive is also important**: if a system's security depends on the algorithm being secret, it's probably not secure. This is why "proprietary encryption" is a red flag. If a company says "we use our own encryption algorithm but we can't tell you how it works," run.

---

## Where You Already Use Cryptography

You use cryptography dozens of times a day without thinking about it. Here's what's actually happening:

### HTTPS (Every Web Request)

When you visit `https://github.com`:

1. Your browser and GitHub's server perform a TLS handshake (Diffie-Hellman key exchange + certificate verification)
2. They agree on a shared symmetric key (AES-256-GCM typically)
3. Every byte of data between you and GitHub is encrypted with that key
4. Each message includes a MAC (message authentication code) to detect tampering
5. GitHub's certificate, signed by a Certificate Authority, proves you're talking to the real GitHub

All of this happens in about 50 milliseconds. You see a padlock icon.

### SSH (Every Time You Deploy)

When you `ssh user@server`:

1. Your client verifies the server's public key (that "fingerprint" you accepted the first time)
2. A key exchange creates a shared session key
3. Everything you type and everything the server sends back is encrypted
4. Your private key authenticates you to the server (instead of a password, if you set up key-based auth)

### Git Commit Signing

When you sign a git commit:

```bash
git commit -S -m "feat: add payment processing"
```

You're creating a digital signature over the commit contents using your private key. Anyone can verify it with your public key:

```bash
git log --show-signature
```

This proves:
- You (the holder of that private key) made that commit
- The commit contents haven't been tampered with since you signed it
- You can't deny making that commit

### Password Storage

When you create an account on a properly built website:

1. You type your password
2. The server hashes it with a slow, memory-hard function (Argon2id) plus a random salt
3. Only the hash is stored in the database
4. When you log in, they hash your input the same way and compare hashes

If the database gets stolen, attackers get hashes, not passwords. The hashing is intentionally slow and memory-intensive, making brute-force cracking economically impractical for strong passwords.

### Everyday Encryption You Don't See

- **Signal/WhatsApp**: End-to-end encryption using the Signal Protocol (Double Ratchet algorithm, X25519, AES-256-CBC, HMAC-SHA256)
- **FileVault/BitLocker**: Full-disk encryption (AES-256-XTS) so a stolen laptop is a useless brick
- **Apple Pay/Google Pay**: Tokenized payment with asymmetric crypto so the merchant never sees your actual card number
- **DNS over HTTPS (DoH)**: Encrypts your DNS queries so your ISP can't see which domains you're looking up
- **VPNs**: Create an encrypted tunnel so your traffic looks like gibberish to anyone between you and the VPN server

---

## Symmetric vs Asymmetric: The Two Families

All of cryptography splits into two families. Understanding when to use each is half the battle.

### Symmetric Cryptography (One Key)

Both sides share the same secret key. Fast. Simple. The problem: how do you share the key securely?

- **AES-256-GCM**: The standard for encrypting data
- **ChaCha20-Poly1305**: The alternative when hardware AES support isn't available
- **HMAC-SHA256**: Proving a message hasn't been tampered with (when both sides share a key)

Analogy: A combination lock on a shared locker. Both you and your friend know the combo. Either of you can lock or unlock it.

### Asymmetric Cryptography (Two Keys)

A public key and a private key. The public key encrypts or verifies. The private key decrypts or signs. Slower than symmetric, but solves the key distribution problem.

- **RSA**: The original. Large keys. Still used for backward compatibility.
- **Ed25519**: Modern signature scheme. Small keys, fast, deterministic.
- **X25519**: Modern key exchange. Used in TLS 1.3, Signal, WireGuard.

Analogy: A mailbox. Anyone can drop a letter in (public key encrypts), but only you have the key to open it (private key decrypts).

### The Key Distribution Problem: Crypto's Chicken-and-Egg

Symmetric encryption has a fatal flaw: both sides need the same key. But
how do you share that key in the first place?

**Analogy — the locked box problem:**

Alice wants to send Bob a secret message. She puts it in a box and locks
it. But Bob doesn't have the key! She can't mail the key — the thieving
postal workers will copy it. She can't call Bob — the phone is tapped.
She can't meet in person — they're on different continents.

This is the key distribution problem, and it stumped cryptographers for
thousands of years. Every symmetric cipher has this weakness: the key
itself must somehow be shared securely.

Diffie-Hellman solved it in 1976 (the paint-mixing protocol above). But
even today, the key distribution problem haunts systems. If your key is
compromised, ALL past and future messages encrypted with it are exposed.

This led to **Forward Secrecy** — the idea that you should generate a
NEW key for every session. If your key from Tuesday leaks, only
Tuesday's messages are compromised. Monday's and Wednesday's are safe
because they used different keys.

**Analogy — a hotel room key:** The hotel gives you a new key card for
each stay. If someone steals Tuesday's key card, they can only access
the room during that stay. They can't get into the room you had last
month (different key) or next month (key not yet created).

TLS 1.3 enforces forward secrecy by default. Every connection generates
a fresh set of ephemeral keys using X25519, and the keys are discarded
when the connection closes. Even if an attacker records all your encrypted
traffic AND later steals the server's private key, they STILL can't
decrypt the recorded traffic. The ephemeral keys are gone forever.

### Side-Channel Attacks: When the Math is Perfect but Physics Betrays You

Sometimes the cryptographic algorithm is mathematically unbreakable, but
the IMPLEMENTATION leaks information through unexpected channels.

**Analogy — the poker tell:** A poker player's cards are hidden, but they
always fidget with their chips when they have a good hand. The cards are
secure; the player's behavior leaks the secret.

Real side channels:

- **Timing attacks:** A password comparison that returns faster for "wrong
  first character" than "wrong last character" leaks how many characters
  are correct. Attackers measure response time to guess one character at a
  time.

- **Power analysis:** A smart card's power consumption spikes differently
  when processing a 1-bit vs a 0-bit. With an oscilloscope, an attacker
  can literally watch the key being processed.

- **Cache attacks:** On shared hardware (cloud servers), one VM can
  observe another VM's memory access patterns through CPU cache timing.
  This has been used to extract AES keys from co-hosted VMs.

This is why cryptographic code uses "constant-time" implementations —
operations that take the same amount of time regardless of the data.
Comparing passwords byte-by-byte and returning early on mismatch is
fast but insecure. Comparing ALL bytes and then checking is slower but
doesn't leak timing information.

### The Hybrid Approach (How It Actually Works)

In practice, every real system uses both:

1. Asymmetric crypto exchanges a symmetric key (expensive, but the key is small)
2. Symmetric crypto encrypts the actual data (cheap, and the data can be huge)

TLS does exactly this: X25519 key exchange (asymmetric) establishes a shared AES-256-GCM key (symmetric), which encrypts all your web traffic. You get the security of asymmetric key exchange with the speed of symmetric encryption.

---

## Why This Matters for You

As a developer, you're not going to invent new cryptographic algorithms. That's for mathematicians with PhDs and decades of experience. What you will do:

1. **Choose the right primitives** — Pick the correct algorithm for the job (hashing vs. encryption vs. signing)
2. **Configure them correctly** — A good algorithm with bad parameters is a bad algorithm
3. **Avoid classic mistakes** — Reusing nonces, using ECB mode, rolling your own crypto
4. **Understand what breaks** — When a breach happens, understand why and how to prevent it in your systems
5. **Read the room** — Know when something is a real security threat vs. security theater

The rest of this module teaches you how to do all five.

---

## Real-World Breaches: What Happens When Crypto Goes Wrong

### Adobe (2013) — Bad Password Hashing

Adobe stored 153 million passwords encrypted with 3DES in ECB mode (not even hashed — encrypted, and with the worst possible mode). ECB mode means identical passwords produce identical ciphertext. Attackers could see that 1.9 million users had the password "123456" without cracking a single one — they all had the same encrypted value.

**The fix**: Hash passwords with Argon2id. Each password gets a unique salt, so identical passwords produce completely different hashes.

### Heartbleed (2014) — Memory Leak in TLS

A bug in OpenSSL let anyone read 64KB of server memory per request. That memory could contain private keys, session tokens, passwords — anything the server was processing. Attackers could silently read encrypted traffic and impersonate servers.

**The fix**: Update OpenSSL (this was a bug, not a crypto weakness). Use Perfect Forward Secrecy so that even if a private key leaks, past recorded traffic can't be decrypted.

### Equifax (2017) — Everything Wrong

Unpatched Apache Struts vulnerability (a known CVE, patched two months before the breach), unencrypted PII in the database, expired SSL certificates on their monitoring tools (so they couldn't see the data leaving), and a default admin/admin username-password on a portal. 147 million people's Social Security numbers, birth dates, and addresses exposed.

**The fix**: Literally everything on the security checklist. Patch management, encryption at rest, certificate monitoring, strong credentials, network monitoring.

### SolarWinds (2020) — Supply Chain Attack

Attackers compromised the build system for SolarWinds Orion software. They injected a backdoor into a signed, legitimate software update. 18,000 organizations installed it, including the US Treasury, Department of Homeland Security, and major Fortune 500 companies. The update was digitally signed, so nobody questioned it.

**The lesson**: Digital signatures prove the software came from SolarWinds. They don't prove SolarWinds wasn't compromised. Supply chain security requires securing the entire build pipeline, not just the final artifact.

### LinkedIn (2012) — Unsalted SHA-1 Passwords

LinkedIn stored 6.5 million passwords as unsalted SHA-1 hashes. When the database was stolen, 60% of the passwords were cracked within days using rainbow tables (precomputed hash-to-password mappings). Without salt, every user with the password "linkedin123" had the exact same hash, and the hash was already in every rainbow table on the internet.

**The fix**: Use Argon2id with a unique random salt per password. Salting defeats rainbow tables. Slow hashing defeats brute force.

### Target (2013) — Network Segmentation Failure

Attackers compromised an HVAC vendor's VPN credentials, pivoted to Target's internal network, moved laterally to the point-of-sale systems, and installed RAM-scraping malware that captured credit card numbers in plaintext as they were processed. 40 million credit card numbers stolen. The card numbers were encrypted at rest, but they had to be decrypted in memory for processing — and that memory wasn't protected.

**The lesson**: Encryption at rest isn't enough. You also need encryption in transit between internal services, network segmentation to limit lateral movement, and monitoring to detect unusual access patterns.

---

## What Good Crypto Looks Like in Practice

Here's a sketch of how a well-built web application uses cryptography:

```
User's Browser                    Your Server                    Database
     |                                |                              |
     |--- HTTPS (TLS 1.3) ---------->|                              |
     |    - X25519 key exchange       |                              |
     |    - AES-256-GCM encryption    |                              |
     |    - Certificate verification  |                              |
     |                                |                              |
     |    POST /login                 |                              |
     |    {email, password}           |                              |
     |                                |--- Argon2id(password, salt) -|
     |                                |    Compare with stored hash  |
     |                                |                              |
     |    200 OK                      |                              |
     |    Set-Cookie: session=<signed>|                              |
     |    (HMAC-SHA256 signed cookie) |                              |
     |                                |                              |
     |    GET /api/secrets            |                              |
     |    Cookie: session=<signed>    |                              |
     |                                |--- Verify HMAC on cookie    |
     |                                |--- Check authorization      |
     |                                |--- Decrypt data (AES-256-GCM)|
     |    200 OK (encrypted in TLS)   |                              |
```

Layer by layer:
- **TLS**: Encrypts everything between browser and server (confidentiality + integrity)
- **Argon2id**: Hashes passwords so they can't be reversed if the DB is stolen (pre-image resistance)
- **HMAC**: Signs session cookies so they can't be forged (authentication + integrity)
- **AES-256-GCM**: Encrypts sensitive data at rest in the database (confidentiality at rest)

Each layer has a specific job. Remove any one and you have a vulnerability.

---

## The Rules

Before we dive into the technical details, here are the rules you'll see repeated throughout this module:

1. **Never roll your own crypto.** Use established, audited libraries. You are not smarter than the thousands of researchers who built and attacked AES for 25+ years.

2. **Never invent your own protocol.** Use TLS. Use the Signal Protocol. Use what exists.

3. **The key is the secret, not the algorithm.** If your security depends on the algorithm being secret, you don't have security.

4. **Crypto is the easy part.** Key management, configuration, and human behavior are where things actually break.

5. **Fast hashing is a feature for integrity, a bug for passwords.** You want file checksums to be fast. You want password hashing to be slow.

6. **Random numbers must be cryptographically random.** `Math.random()` is not random. `crypto.getRandomValues()` is. This distinction has caused real breaches.

7. **Nonce reuse destroys security.** If an algorithm asks for a nonce (number used once), it means *once*. Not "once per session." Not "once per user." Once. Period.

Now let's learn how each piece works.

---

## What's Next

The lessons ahead follow the building blocks:

- **Hashing** — One-way functions. The meat grinder of cryptography.
- **Symmetric Encryption** — One key, both sides know it. The combination lock.
- **Asymmetric Encryption** — Two keys, one public, one private. The mailbox.
- **Digital Signatures** — Proving authorship and integrity. The wax seal.
- **TLS/SSL** — How all of these combine to secure the web.
- **Certificates and PKI** — The trust infrastructure that makes it all work at scale.

Each lesson includes Go and TypeScript code you can run. No toy examples — real code you'd actually use in production.

Let's go.
