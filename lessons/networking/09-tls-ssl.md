# Lesson 09: TLS/SSL -- Encryption and HTTPS

TLS (Transport Layer Security) is the protocol that makes HTTPS secure. It
wraps TCP with encryption so that nobody between you and the server -- your
ISP, the coffee shop Wi-Fi operator, a government -- can read or tamper with
your data.

---

## The Problem

HTTP sends everything in **plaintext**. Anyone on the network path can:

1. **Read** your data (passwords, credit cards, private messages)
2. **Modify** your data (inject ads, malware, redirect you)
3. **Impersonate** the server (phishing, man-in-the-middle attacks)

```
Without TLS:

  You ---[plaintext: password=hunter2]---> Router ---> ISP ---> Server
              ^                                ^
              |                                |
         Coffee shop                     ISP employee
         hacker can                      can read
         read this                       this too

With TLS:

  You ---[encrypted: a7f3b2c9e1d0...]---> Router ---> ISP ---> Server
              ^                                ^
              |                                |
         Cannot read                     Cannot read
         (just random                    (just random
          bytes)                          bytes)
```

### The Postcard vs Sealed Letter Analogy

HTTP is like a **postcard** -- everyone who handles it can read the message.
HTTPS is like a **sealed letter in a locked box** -- only the intended
recipient has the key to open it.

HTTPS = HTTP + TLS. The HTTP request and response are the same; they are just
wrapped in an encrypted tunnel.

---

## Symmetric vs Asymmetric Encryption

TLS uses both types of encryption. Understanding the difference is key.

### Symmetric Encryption

One key for both encrypting and decrypting. Like a padlock where both people
have a copy of the same key.

```
           Same key               Same key
           (abc123)               (abc123)
              |                      |
  Plaintext --+--> Ciphertext ----> -+--> Plaintext
  "Hello"          "a7f3b2"              "Hello"
```

**Pros:** Very fast (AES-256-GCM can encrypt gigabytes per second).
**Cons:** How do you share the key securely? If you send the key over the
network, anyone intercepting it can decrypt everything.

Algorithms: AES-128-GCM, AES-256-GCM, ChaCha20-Poly1305

### Asymmetric Encryption (Public Key Cryptography)

Two keys: a **public key** (everyone can have it) and a **private key** (only
you have it). Data encrypted with the public key can only be decrypted with
the private key.

```
           Public key             Private key
           (anyone has)           (only server has)
              |                      |
  Plaintext --+--> Ciphertext ----> -+--> Plaintext
  "Hello"          "x9k2m1"              "Hello"

  Anyone can LOCK the box (public key = the mail slot).
  Only the owner can UNLOCK it (private key = the mailbox key).
```

### The Mailbox Analogy

Think of a mailbox with a slot:
- **Public key = the mail slot.** Anyone can drop a letter in.
- **Private key = the mailbox key.** Only the owner can open it and read the
  letters.

You publish the mail slot (public key) for anyone to use. But only you have
the key to open the mailbox (private key).

**Pros:** Solves the key distribution problem. You never need to share the
private key.
**Cons:** Very slow (1000x slower than symmetric encryption). Not practical
for encrypting large amounts of data.

Algorithms: RSA, ECDSA, Ed25519, X25519

### The TLS Solution: Best of Both Worlds

TLS uses asymmetric encryption to **exchange a symmetric key**, then uses
symmetric encryption for the actual data. This combines the security of
asymmetric with the speed of symmetric:

```
1. Use SLOW asymmetric crypto to securely exchange a key
2. Use FAST symmetric crypto (with that key) for all actual data

Asymmetric: "Here's a secret key, encrypted with your public key"
Symmetric:  "Now let's use that secret key for everything else"
```

---

## The TLS Handshake

Before encrypted data can flow, client and server perform a TLS handshake.
Here is TLS 1.3 (the current version), simplified:

```
  Client                                          Server
    |                                               |
    |  1. ClientHello                               |
    |  "I support TLS 1.3"                          |
    |  "I support these cipher suites:"             |
    |    - TLS_AES_256_GCM_SHA384                   |
    |    - TLS_CHACHA20_POLY1305_SHA256             |
    |  "Here's my key share (for key exchange)"     |
    |  "Here's a random number (client_random)"     |
    | --------------------------------------------> |
    |                                               |
    |  2. ServerHello                               |
    |  "Let's use TLS_AES_256_GCM_SHA384"           |
    |  "Here's my key share"                        |
    |  "Here's a random number (server_random)"     |
    |                                               |
    |  3. Server Certificate                        |
    |  "Here's my certificate proving I'm           |
    |   example.com, signed by Let's Encrypt"       |
    |                                               |
    |  4. Server Finished                           |
    |  "Handshake complete on my end"               |
    | <-------------------------------------------- |
    |                                               |
    |  [Client verifies certificate]                |
    |  [Both sides derive the same symmetric key    |
    |   from the key shares + randoms]              |
    |                                               |
    |  5. Client Finished                           |
    |  "Handshake complete on my end too"           |
    | --------------------------------------------> |
    |                                               |
    |  ========= ENCRYPTED DATA FLOWS =========    |
    |  (using the symmetric key both sides now have)|
    |                                               |
```

The entire handshake takes **1 round trip** in TLS 1.3 (down from 2 in TLS
1.2). With **0-RTT resumption**, a returning client can send encrypted data
with the very first packet.

### The Handshake as a Diplomatic Meeting

**Analogy — two embassies establishing a secure channel:**

Imagine the US Embassy and the French Embassy need to exchange classified documents. Neither trusts the postal system (the internet).

**Step 1 — Proposal (ClientHello):** The US Embassy sends a messenger to the French Embassy saying: "We'd like to set up a secure communication channel. We can use secret codes A, B, or C. Here's half of a combination lock."

**Step 2 — Agreement (ServerHello + Certificate):** The French Embassy responds: "Let's use code B. Here's the other half of the combination lock. Also, here's my official government ID (certificate) signed by the United Nations (Certificate Authority) to prove I'm really the French Embassy, not a spy pretending to be."

**Step 3 — Verification:** The US Embassy checks the ID with the United Nations (trust store). It's legitimate. Both embassies now combine their halves of the combination lock to create a shared secret key that NO ONE ELSE has — not even the messenger who carried the halves.

**Step 4 — Secure communication:** All future messages are locked with the shared combination. The messenger can carry them, but can't read them.

```
The beauty of this system:
  - The messenger (network) NEVER sees the final key
  - Even if someone recorded ALL the messages, they can't
    derive the key (Diffie-Hellman key exchange)
  - Even if the French Embassy's long-term private key is
    stolen LATER, past conversations are safe
    (this is FORWARD SECRECY)
```

### Forward Secrecy: Why Past Conversations Stay Safe

**Analogy — temporary phone numbers:**

Without forward secrecy, it's like using the same phone number forever. If someone later finds your number in a phone book, they can listen to all your past recorded calls.

With forward secrecy (which TLS 1.3 mandates), it's like using a NEW burner phone for every conversation. Even if someone finds yesterday's burner phone, they can't decrypt last week's conversations — those used a different phone entirely.

```
Without forward secrecy (RSA key exchange, TLS 1.2):
  Server has permanent private key K
  All sessions encrypted with keys derived from K
  If K is stolen → ALL past sessions can be decrypted

With forward secrecy (ECDHE, TLS 1.3):
  Each session generates EPHEMERAL key pair
  Session key = ECDHE(client_ephemeral, server_ephemeral)
  Ephemeral keys are deleted after the session

  Private key stolen → only FUTURE sessions at risk
  Past sessions → keys are gone, cannot be recovered
```

This is why TLS 1.3 removed RSA key exchange entirely and mandates ephemeral Diffie-Hellman (ECDHE).

### What Is a Cipher Suite?

A cipher suite specifies the algorithms used for each part of TLS:

```
TLS_AES_256_GCM_SHA384
 |    |       |    |
 |    |       |    +-- Hash for key derivation (SHA-384)
 |    |       +------- Mode (Galois/Counter Mode - authenticated)
 |    +--------------- Symmetric cipher (AES with 256-bit key)
 +-------------------- Protocol (TLS)

In TLS 1.3, the key exchange algorithm (ECDHE) is negotiated
separately in the supported_groups extension (e.g., X25519).
```

---

## Certificates: Proving Identity

Encryption alone is not enough. You need to know you are talking to the
**real** server, not an impersonator. Certificates solve this.

### What Is a Certificate?

A TLS certificate is a digitally signed document that says:

```
"The holder of this certificate is the owner of example.com.
 Their public key is [key data].
 This certificate was signed by Let's Encrypt.
 It is valid from 2024-01-01 to 2024-03-31."

+-------------------------------------------------+
|                  CERTIFICATE                     |
|                                                  |
|  Subject: CN=example.com                        |
|  Issuer:  CN=Let's Encrypt Authority X3         |
|  Valid:   2024-01-01 to 2024-03-31              |
|  Public Key: [RSA 2048 bit]                     |
|                                                  |
|  Signature: [signed by Let's Encrypt's          |
|              private key]                        |
+-------------------------------------------------+
```

### Certificate Authorities (CAs)

A CA is a trusted third party that vouches for certificates. Your
browser/OS ships with a list of trusted CAs (the "trust store"). If a
certificate is signed by a trusted CA, the browser accepts it.

```
The Trust Chain:

  Root CA (trusted by your OS/browser)
    |
    +-- signs --> Intermediate CA certificate
                    |
                    +-- signs --> example.com certificate

Your browser verifies:
  1. example.com cert is signed by Intermediate CA  (check)
  2. Intermediate CA cert is signed by Root CA       (check)
  3. Root CA is in the trust store                   (check)
  4. Certificate is not expired                      (check)
  5. Certificate hostname matches the URL            (check)

All checks pass = green lock icon.
Any check fails = security warning.
```

### Certificate Pinning: Extra Trust Verification

Standard certificate verification trusts ANY CA in your trust store (~150 CAs). If any one of them is compromised, they could issue a fake certificate for your domain.

**Analogy — knowing your friend's actual signature:**

Certificate verification is like accepting any notarized document. Certificate pinning is like saying "I know what my friend's actual signature looks like — I'll verify it myself, regardless of who notarized it."

```
Standard verification:
  "Is this certificate signed by ANY trusted CA?" → Accept

Certificate pinning:
  "Is this the EXACT certificate (or public key) I expect
   for this server?" → Accept only if it matches

Used by:
  - Mobile banking apps (pin the bank's certificate)
  - High-security APIs (pin the API server's public key)

Risk: if you rotate certificates, pinned clients break.
That's why key pinning (pin the public key, not the cert)
is preferred — keys survive certificate rotation.
```

### Let's Encrypt

Let's Encrypt is a free, automated, open Certificate Authority. It issues
certificates for any domain you can prove you control. Before Let's Encrypt
(founded 2014), certificates cost $50-$300/year, which is why many sites did
not use HTTPS.

How it works:
1. You prove you own the domain (by placing a specific file on your server
   or adding a DNS record)
2. Let's Encrypt verifies the proof
3. Let's Encrypt issues a certificate (valid for 90 days)
4. Your server automatically renews it before expiration

Tools: `certbot` (the official Let's Encrypt client), integrated support in
Caddy (automatic HTTPS), and many hosting platforms.

---

## What TLS Protects Against

| Attack                    | Without TLS          | With TLS              |
|---------------------------|----------------------|-----------------------|
| Eavesdropping             | Read all your data   | Encrypted (unreadable)|
| Data tampering            | Modify data in transit| Detected (integrity) |
| Impersonation (MITM)      | Possible             | Certificate verification|
| Credential theft          | Passwords in plaintext| Encrypted            |
| Session hijacking         | Steal session cookies | Encrypted             |

### What TLS Does NOT Protect Against

- **Server-side compromise:** If the server itself is hacked, TLS does not help.
- **Malware on your machine:** A keylogger sees your keystrokes before encryption.
- **The server seeing your data:** TLS protects data in transit, not at rest.
  The server decrypts and processes your data.
- **Traffic analysis:** An observer can see you are connecting to example.com
  (via SNI in TLS 1.2, or DNS queries), even if they cannot read the content.
  Encrypted Client Hello (ECH) in TLS 1.3 mitigates this.

### HSTS: Preventing the Downgrade Attack

**Analogy — "always lock the door, even if someone says it's safe":**

Without HSTS, an attacker on your network can intercept your first HTTP request (before the redirect to HTTPS) and strip the encryption entirely. You THINK you're on HTTPS, but the attacker is translating between HTTP (you) and HTTPS (the server). This is an **SSL stripping attack**.

```
Without HSTS (vulnerable):
  You → http://bank.com → Attacker intercepts!
  Attacker → https://bank.com (pretends to be you)
  You see http:// but don't notice. Attacker sees all your data.

With HSTS:
  First visit: Server sends header:
    Strict-Transport-Security: max-age=31536000; includeSubDomains

  Browser remembers: "ALWAYS use HTTPS for bank.com for 1 year"

  Next visit: You type bank.com → browser auto-upgrades to HTTPS
  Attacker can't strip the TLS because the browser REFUSES HTTP.
```

Major sites are on the **HSTS preload list** — browsers ship with a built-in list of domains that should ONLY be accessed via HTTPS, even on the very first visit. Submit your domain at hstspreload.org.

---

## mTLS: Mutual TLS

In standard TLS, only the server proves its identity (with a certificate).
The client is anonymous at the TLS level (authentication happens at the
application layer via passwords, tokens, etc.).

**mTLS (Mutual TLS)** requires **both sides** to present certificates:

```
Standard TLS:
  Client: "Prove you're example.com"     -> Server shows certificate
  Server: "OK you're connected"          -> Client is anonymous at TLS level

Mutual TLS:
  Client: "Prove you're example.com"     -> Server shows certificate
  Server: "Prove you're an authorized client" -> Client shows certificate
```

mTLS is commonly used in:
- **Microservices:** Service A proves its identity to Service B (zero-trust)
- **API authentication:** Instead of API keys, use client certificates
- **Corporate networks:** VPN and internal service authentication

---

## TLS Versions

| Version  | Year | Status       | Notes                              |
|----------|------|--------------|------------------------------------|
| SSL 2.0  | 1995 | Broken       | Severely insecure. Never use.      |
| SSL 3.0  | 1996 | Broken       | POODLE attack. Never use.          |
| TLS 1.0  | 1999 | Deprecated   | BEAST attack. Avoid.               |
| TLS 1.1  | 2006 | Deprecated   | No known major attacks but old.    |
| TLS 1.2  | 2008 | Still OK     | Widely used. Secure if configured. |
| TLS 1.3  | 2018 | Current      | Fastest, most secure. Use this.    |

TLS 1.3 improvements over TLS 1.2:
- Removed insecure algorithms (RSA key exchange, CBC mode, RC4, SHA-1)
- Handshake reduced from 2 RTT to 1 RTT
- 0-RTT resumption for repeat connections
- Simplified cipher suite negotiation
- Forward secrecy is mandatory (if keys are stolen later, past traffic
  cannot be decrypted)

---

## TLS in Rust

### TLS Client with rustls

```rust
// Cargo.toml:
// [dependencies]
// rustls = "0.23"
// webpki-roots = "0.26"

use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Arc;
use rustls::{ClientConfig, ClientConnection, StreamOwned};
use rustls::pki_types::ServerName;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut root_store = rustls::RootCertStore::empty();
    root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());

    let config = ClientConfig::builder()
        .with_root_certificates(root_store)
        .with_no_client_auth();

    let server_name = ServerName::try_from("example.com")?;
    let conn = ClientConnection::new(Arc::new(config), server_name)?;

    let tcp_stream = TcpStream::connect("example.com:443")?;
    let mut tls_stream = StreamOwned::new(conn, tcp_stream);

    let request = "GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n";
    tls_stream.write_all(request.as_bytes())?;

    let mut response = String::new();
    tls_stream.read_to_string(&mut response)?;

    let first_line = response.lines().next().unwrap_or("");
    println!("Response: {}", first_line);
    println!("Total bytes: {}", response.len());

    Ok(())
}
```

This creates a TLS-encrypted connection to example.com:443, sends an HTTP
request, and reads the response. All the certificate verification, key
exchange, and encryption happens transparently through the `rustls` library.

---

## Inspecting TLS in Practice

### View a Site's Certificate

```bash
# Using openssl:
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null | \
  openssl x509 -noout -subject -issuer -dates

# Output:
# subject=CN = example.com
# issuer=C = US, O = DigiCert Inc, CN = DigiCert TLS RSA SHA256 2020 CA1
# notBefore=Jan 13 00:00:00 2024 GMT
# notAfter=Feb 13 23:59:59 2025 GMT
```

### See the Full Handshake

```bash
# Verbose connection showing every handshake step:
openssl s_client -connect example.com:443 -servername example.com

# Look for:
# - Protocol version (TLSv1.3)
# - Cipher suite selected
# - Certificate chain
# - Session details
```

### Check Certificate Chain

```bash
# Show the full certificate chain:
openssl s_client -connect example.com:443 -servername example.com -showcerts

# You'll see:
# Certificate 0: the server certificate (example.com)
# Certificate 1: the intermediate CA certificate
# (Root CA is not sent - your OS already has it)
```

---

## Common TLS Issues

### 1. Certificate Expiration

Certificates expire (Let's Encrypt: 90 days, others: 1 year). If not renewed,
browsers show a scary warning page. Automate renewal with certbot or Caddy.

### 2. Certificate Hostname Mismatch

The certificate says `example.com` but you are connecting to `api.example.com`.
The browser rejects it. Use a wildcard certificate (`*.example.com`) or Subject
Alternative Names (SANs) that list all valid hostnames.

### 3. Mixed Content

An HTTPS page loads a resource over HTTP. The browser may block it or show a
warning. Ensure all resources (images, scripts, CSS) use HTTPS.

### 4. Self-Signed Certificates

You created a certificate but it was not signed by a trusted CA. Browsers will
warn users. Fine for development; use Let's Encrypt for production.

### 5. Weak Cipher Suites

Server configured to allow old, insecure algorithms. Use a tool like
`testssl.sh` or SSL Labs to audit your configuration.

---

## Exercises

### Exercise 1: Inspect a TLS Certificate

```bash
# Pick any HTTPS website and examine its certificate:
echo | openssl s_client -connect github.com:443 -servername github.com 2>/dev/null | \
  openssl x509 -noout -text | head -30

# Find:
# 1. Who issued the certificate (Issuer)
# 2. When it expires (Not After)
# 3. What names it is valid for (Subject Alternative Name)
# 4. What signature algorithm was used
```

### Exercise 2: Compare TLS Versions

```bash
# Try connecting with different TLS versions:
openssl s_client -connect example.com:443 -tls1_2 2>&1 | grep "Protocol"
openssl s_client -connect example.com:443 -tls1_3 2>&1 | grep "Protocol"

# Which version does the server prefer?
# Does it still support TLS 1.2?
```

### Exercise 3: See the Cipher Suite

```bash
# Connect and see which cipher suite was negotiated:
openssl s_client -connect example.com:443 2>&1 | grep "Cipher"

# What cipher suite is in use?
# Is it using AES-GCM or ChaCha20-Poly1305?
```

### Exercise 4: curl with Verbose TLS Output

```bash
# curl -v shows the TLS handshake:
curl -v https://example.com 2>&1 | grep -E "^(\*|<)" | head -20

# Look for:
# * TLSv1.3
# * ALPN: server accepted h2 (or http/1.1)
# * Server certificate:
# *  subject: CN=example.com
# *  issuer: ...
```

### Exercise 5: Generate a Self-Signed Certificate

```bash
# Generate a self-signed certificate for testing:
openssl req -x509 -newkey rsa:4096 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/CN=localhost"

# Examine it:
openssl x509 -in cert.pem -noout -text | head -20

# Use it with a local server (e.g., with openssl s_server):
openssl s_server -key key.pem -cert cert.pem -accept 4433

# In another terminal, connect to it:
openssl s_client -connect localhost:4433

# Note the "self-signed certificate" warning.
# Clean up:
rm key.pem cert.pem
```

### Exercise 6: Test a Server's TLS Configuration

```bash
# Use nmap to check supported TLS versions and ciphers:
nmap --script ssl-enum-ciphers -p 443 example.com

# Or use the SSL Labs online tool:
# https://www.ssllabs.com/ssltest/

# Check your own server or a popular site.
# Look for:
# - What TLS versions are supported
# - What cipher suites are offered
# - Whether forward secrecy is enabled
# - The overall grade (A+ is best)
```

---

Next: [Lesson 10: WebSockets](./10-websockets.md)
