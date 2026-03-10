# TLS/SSL: How HTTPS Actually Works

## The Coffee Shop Analogy

The TLS handshake is like meeting a stranger at a coffee shop to exchange secrets:

1. You walk in and say "Hi, I speak English and French" (ClientHello — listing your capabilities)
2. They show you their government-issued ID (certificate — proving identity)
3. You check the ID is real by calling the issuing office (certificate chain validation)
4. You both agree to speak French (cipher suite negotiation)
5. You agree on a secret code word that only you two know (key exchange)
6. Now you can talk privately while everyone else in the shop hears gibberish (encrypted communication)

That's TLS. Every HTTPS request you make goes through this process. It takes about 50ms for TLS 1.2 and about 30ms for TLS 1.3. Let's break down each step.

---

## The TLS 1.2 Handshake (Step by Step)

### Round Trip 1: Hello

**Client -> Server: ClientHello**
```
- TLS version: 1.2
- Random bytes: (32 bytes of cryptographic randomness)
- Session ID: (empty or cached session ID for resumption)
- Cipher suites: [
    TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
    TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
    TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
    ...
  ]
- Extensions: [
    server_name: "example.com" (SNI - tells the server which domain you want),
    supported_groups: [x25519, secp256r1],
    signature_algorithms: [ecdsa_secp256r1_sha256, rsa_pss_sha256, ...],
  ]
```

**Server -> Client: ServerHello**
```
- TLS version: 1.2
- Random bytes: (32 bytes of cryptographic randomness)
- Session ID: (session identifier)
- Selected cipher suite: TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
```

**Server -> Client: Certificate**
```
- Server's certificate (contains public key, domain name, CA signature)
- Intermediate CA certificate
- (Root CA certificate is already in the client's trust store)
```

**Server -> Client: ServerKeyExchange**
```
- Ephemeral ECDHE public key (for forward secrecy)
- Signature over the key exchange parameters (proves the server's identity)
```

**Server -> Client: ServerHelloDone**
```
- "I'm done talking, your turn"
```

### Round Trip 2: Key Exchange and Finish

**Client -> Server: ClientKeyExchange**
```
- Client's ephemeral ECDHE public key
```

At this point, both sides compute the shared secret using ECDHE. From the shared secret, they derive:
- Client write key (encrypts client -> server traffic)
- Server write key (encrypts server -> client traffic)
- Client write IV
- Server write IV

**Client -> Server: ChangeCipherSpec**
```
- "Switching to encrypted mode now"
```

**Client -> Server: Finished**
```
- HMAC of entire handshake (encrypted with the new keys)
- This proves the client has the correct keys and that the handshake wasn't tampered with
```

**Server -> Client: ChangeCipherSpec + Finished**
```
- Same verification from the server side
```

Now both sides have verified each other's keys and the handshake integrity. All subsequent data is encrypted with AES-256-GCM using the derived keys.

**Total: 2 round trips before the first byte of application data can be sent.**

---

## The TLS 1.3 Handshake (Faster)

TLS 1.3 (standardized in 2018) streamlines the handshake to just 1 round trip:

### Round Trip 1: Everything

**Client -> Server: ClientHello**
```
- TLS version: 1.3
- Random bytes
- Cipher suites: [TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256]
- Key share: client's ephemeral X25519 public key (sent immediately, no waiting)
- Supported groups: [x25519, secp256r1]
- Signature algorithms
- Pre-shared key (for 0-RTT resumption, if available)
```

The key difference: the client sends its key share in the first message. It guesses which key exchange algorithm the server will choose (usually X25519) and includes the public key upfront.

**Server -> Client: ServerHello + EncryptedExtensions + Certificate + CertificateVerify + Finished**
```
- Server's key share (X25519 public key)
- Server's certificate + signature
- Finished message (HMAC of handshake)
- All of this (after ServerHello) is already encrypted
```

**Client -> Server: Finished**
```
- Client's verification of the handshake
```

**Total: 1 round trip before application data.** The server can even send data alongside its Finished message (0.5 RTT for server-initiated data).

### 0-RTT Resumption

If the client has connected to this server before, TLS 1.3 supports 0-RTT (zero round trip) resumption:

```
Client -> Server: ClientHello + Pre-shared key + Early application data (encrypted)
```

The client sends application data in the very first message, encrypted with a key from the previous session. The server can process it immediately.

**The catch**: 0-RTT data can be replayed by an attacker. If an attacker records the 0-RTT data and resends it, the server might process the request twice. This means 0-RTT is only safe for idempotent requests (GET, HEAD) — not for POST or PUT. Most implementations disable 0-RTT by default.

---

## TLS 1.2 vs 1.3: What Changed

| Feature | TLS 1.2 | TLS 1.3 |
|---------|---------|---------|
| Handshake round trips | 2 RTT | 1 RTT (0 RTT with resumption) |
| Key exchange | RSA or ECDHE | ECDHE only (forward secrecy mandatory) |
| Cipher suites | ~300 options (many insecure) | 5 options (all secure) |
| Static RSA | Allowed (no forward secrecy) | Removed |
| Compression | Allowed (CRIME attack) | Removed |
| Renegotiation | Allowed (attack surface) | Removed |
| Handshake encryption | Plaintext until Finished | Encrypted after ServerHello |
| Session resumption | Session IDs, session tickets | PSK (pre-shared keys) |

TLS 1.3 is faster, simpler, and more secure. It removes everything that was a source of vulnerabilities in TLS 1.2.

---

## Cipher Suites: What's Being Negotiated

A cipher suite is a combination of algorithms for each cryptographic operation:

```
TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
 |     |      |         |    |     |
 |     |      |         |    |     Hash for PRF (key derivation)
 |     |      |         |    Authentication mode (GCM = AEAD)
 |     |      |         Symmetric cipher (AES-256)
 |     |      Authentication (ECDSA certificate)
 |     Key exchange (Ephemeral Elliptic Curve Diffie-Hellman)
 Protocol
```

### TLS 1.3 Cipher Suites (The Only Ones That Matter)

```
TLS_AES_256_GCM_SHA384        - AES-256-GCM, best security
TLS_AES_128_GCM_SHA256        - AES-128-GCM, slightly faster
TLS_CHACHA20_POLY1305_SHA256  - ChaCha20, great without AES hardware
```

TLS 1.3 separates the key exchange from the cipher suite. Key exchange is always ECDHE (with X25519 or P-256). Authentication is always the certificate's algorithm (Ed25519, ECDSA, or RSA-PSS).

### What to Configure on Your Server

```
Minimum TLS version: 1.2 (preferably 1.3)
Disable: SSLv3, TLS 1.0, TLS 1.1

TLS 1.3 cipher suites (all good, prefer in this order):
  TLS_AES_256_GCM_SHA384
  TLS_CHACHA20_POLY1305_SHA256
  TLS_AES_128_GCM_SHA256

TLS 1.2 cipher suites (if supporting 1.2):
  ECDHE-ECDSA-AES256-GCM-SHA384
  ECDHE-RSA-AES256-GCM-SHA384
  ECDHE-ECDSA-CHACHA20-POLY1305
  ECDHE-RSA-CHACHA20-POLY1305
  ECDHE-ECDSA-AES128-GCM-SHA256
  ECDHE-RSA-AES128-GCM-SHA256

Key exchange groups: X25519, then P-256
```

**Disable everything else.** No RSA key exchange (no forward secrecy). No CBC mode (padding oracle attacks). No SHA-1 (collision attacks). No 3DES (small block size).

---

## Perfect Forward Secrecy (PFS)

Without PFS: The server has a static RSA key pair. The client encrypts the session key with the server's public key. If the server's private key is ever compromised (even years later), an attacker who recorded the encrypted traffic can decrypt every session.

With PFS: Each session uses a fresh, ephemeral Diffie-Hellman key pair. The session key is derived from the ephemeral exchange, not from the server's static key. The ephemeral keys are discarded after the session. Even if the server's long-term private key is compromised, past sessions can't be decrypted because the ephemeral keys no longer exist.

The analogy: without PFS, all your locks use the same key. Lose that key and every door opens. With PFS, each door has a unique one-time lock. Lose a key and only one door opens.

**TLS 1.3 mandates PFS.** All cipher suites use ephemeral key exchange. This is one of the biggest security improvements over TLS 1.2.

---

## The Role of Certificates

During the handshake, the server sends its certificate. The client verifies:

1. **The certificate is signed by a trusted CA** (chain of trust up to a root CA)
2. **The certificate is not expired** (validity period check)
3. **The certificate's domain matches the requested domain** (example.com != evil.com)
4. **The certificate hasn't been revoked** (OCSP or CRL check)

Without certificate verification, TLS is vulnerable to man-in-the-middle attacks. Anyone could generate a key pair, claim to be google.com, and intercept your traffic. Certificates are the authentication layer that prevents this.

More on certificates in the next lesson.

---

## Mutual TLS (mTLS)

Standard TLS only authenticates the server. The client proves nothing about itself — any client can connect. mTLS adds client certificates: the client also presents a certificate, and the server verifies it.

```
Standard TLS:
  Client -> verifies -> Server certificate -> "I trust this server"
  Server -> trusts -> anyone who connects

mTLS:
  Client -> verifies -> Server certificate -> "I trust this server"
  Server -> verifies -> Client certificate -> "I trust this client"
```

Use cases:
- **Service-to-service communication**: In a microservices architecture, services authenticate each other with mTLS (service mesh like Istio, Linkerd)
- **API authentication**: Instead of API keys, require client certificates
- **Zero-trust networks**: Every connection is authenticated, even on internal networks
- **IoT devices**: Devices authenticate to the cloud with device certificates

### mTLS in Go

```go
package main

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"os"
)

func createMTLSServer(certFile, keyFile, clientCAFile, addr string) error {
	clientCACert, err := os.ReadFile(clientCAFile)
	if err != nil {
		return fmt.Errorf("reading client CA: %w", err)
	}

	clientCAPool := x509.NewCertPool()
	if !clientCAPool.AppendCertsFromPEM(clientCACert) {
		return fmt.Errorf("failed to parse client CA certificate")
	}

	tlsConfig := &tls.Config{
		ClientAuth: tls.RequireAndVerifyClientCert,
		ClientCAs:  clientCAPool,
		MinVersion: tls.VersionTLS13,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if len(r.TLS.PeerCertificates) > 0 {
			clientCN := r.TLS.PeerCertificates[0].Subject.CommonName
			fmt.Fprintf(w, "Hello, %s! Your identity is verified.\n", clientCN)
		}
	})

	server := &http.Server{
		Addr:      addr,
		Handler:   mux,
		TLSConfig: tlsConfig,
	}

	return server.ListenAndServeTLS(certFile, keyFile)
}

func createMTLSClient(clientCertFile, clientKeyFile, serverCAFile string) (*http.Client, error) {
	clientCert, err := tls.LoadX509KeyPair(clientCertFile, clientKeyFile)
	if err != nil {
		return nil, fmt.Errorf("loading client cert: %w", err)
	}

	serverCACert, err := os.ReadFile(serverCAFile)
	if err != nil {
		return nil, fmt.Errorf("reading server CA: %w", err)
	}

	serverCAPool := x509.NewCertPool()
	if !serverCAPool.AppendCertsFromPEM(serverCACert) {
		return nil, fmt.Errorf("failed to parse server CA certificate")
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{clientCert},
		RootCAs:      serverCAPool,
		MinVersion:   tls.VersionTLS13,
	}

	return &http.Client{
		Transport: &http.Transport{TLSClientConfig: tlsConfig},
	}, nil
}
```

---

## Hands-On: Inspecting a TLS Connection

### With openssl s_client

```bash
# Connect to a site and see the entire TLS handshake
openssl s_client -connect example.com:443 -servername example.com

# Just the certificate chain
openssl s_client -connect example.com:443 -showcerts 2>/dev/null | \
  openssl x509 -noout -subject -issuer -dates

# Check specific TLS version support
openssl s_client -connect example.com:443 -tls1_3
openssl s_client -connect example.com:443 -tls1_2

# See the negotiated cipher suite
openssl s_client -connect example.com:443 2>/dev/null | grep "Cipher is"
```

### With curl

```bash
# Verbose TLS information
curl -vI https://example.com 2>&1 | grep -E "SSL|TLS|cipher|subject|issuer|expire"

# Force specific TLS version
curl --tlsv1.3 https://example.com
```

### With nmap

```bash
# Enumerate all supported cipher suites
nmap --script ssl-enum-ciphers -p 443 example.com
```

---

## Hands-On: Creating Self-Signed Certificates

For development and testing:

```bash
# Generate a private key
openssl genpkey -algorithm Ed25519 -out server.key

# Generate a self-signed certificate (valid for 365 days)
openssl req -new -x509 -key server.key -out server.crt -days 365 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Verify the certificate
openssl x509 -in server.crt -noout -text
```

For RSA (when Ed25519 isn't supported):

```bash
# Generate RSA key and certificate in one command
openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt \
  -days 365 -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

---

## Hands-On: TLS Server in Go

```go
package main

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello, TLS!\n")
		fmt.Fprintf(w, "Protocol: %s\n", r.TLS.Version)
		fmt.Fprintf(w, "Cipher: %s\n", tls.CipherSuiteName(r.TLS.CipherSuite))
	})

	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS13,
		CurvePreferences: []tls.CurveID{
			tls.X25519,
			tls.CurveP256,
		},
	}

	server := &http.Server{
		Addr:      ":8443",
		Handler:   mux,
		TLSConfig: tlsConfig,
	}

	fmt.Println("Starting TLS server on :8443")
	err := server.ListenAndServeTLS("server.crt", "server.key")
	if err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
```

The `HandleFunc` accesses `r.TLS` to get information about the connection: TLS version, negotiated cipher suite, client certificates (for mTLS), etc.

---

## Hands-On: TLS Server in Node.js

```typescript
import { createServer } from "https";
import { readFileSync } from "fs";

const options = {
  key: readFileSync("server.key"),
  cert: readFileSync("server.crt"),
  minVersion: "TLSv1.3" as const,
};

const server = createServer(options, (req, res) => {
  const socket = req.socket as import("tls").TLSSocket;
  const protocol = socket.getProtocol();
  const cipher = socket.getCipher();

  res.writeHead(200);
  res.end(
    `Hello, TLS!\nProtocol: ${protocol}\nCipher: ${cipher?.name}\n`
  );
});

server.listen(8443, () => {
  console.log("TLS server running on https://localhost:8443");
});
```

---

## Hands-On: Testing Your TLS Configuration

After deploying, verify your configuration:

```bash
# Test with SSL Labs (comprehensive, public-facing servers)
# Visit: https://www.ssllabs.com/ssltest/

# Test locally with testssl.sh
# Install: brew install testssl (macOS) or apt install testssl.sh (Ubuntu)
testssl --protocols --ciphers --vulnerabilities https://yourdomain.com

# Quick checks
# Verify TLS 1.3 support
curl -I --tlsv1.3 https://yourdomain.com

# Verify TLS 1.0 is disabled (should fail)
curl -I --tlsv1.0 --tls-max 1.0 https://yourdomain.com

# Check certificate expiration
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Check HSTS header
curl -sI https://yourdomain.com | grep -i strict-transport
```

---

## Real-World Breaches: TLS Failures

### Heartbleed (2014) — OpenSSL Memory Leak

A bug in OpenSSL's heartbeat extension allowed anyone to read 64KB of server memory per request. That memory could contain private keys, session tokens, passwords, and any other data the server was processing.

The attack was trivial: send a heartbeat request claiming your payload is 64KB but only send 1 byte. The server copies 64KB from its memory into the response, including whatever happens to be adjacent in memory.

300,000+ servers were vulnerable. The NSA reportedly knew about and exploited the bug for two years before public disclosure.

**Lesson**: Use forward secrecy. If your private key leaks (Heartbleed), PFS means recorded past traffic can't be decrypted. Also: keep OpenSSL updated.

### POODLE (2014) — SSL 3.0 Padding Oracle

POODLE exploited a padding oracle vulnerability in SSL 3.0's CBC mode. An attacker who could manipulate the network (e.g., a malicious Wi-Fi hotspot) could force a browser to downgrade from TLS to SSL 3.0, then exploit the padding oracle to decrypt cookies and session tokens one byte at a time.

**Lesson**: Disable legacy protocol versions. SSL 3.0, TLS 1.0, and TLS 1.1 should all be disabled.

### DROWN (2016) — Cross-Protocol Attack

Even if your server only supports TLS 1.2, if the same RSA key is used on another server that supports SSLv2, an attacker can use the SSLv2 server to decrypt TLS 1.2 traffic. 33% of all HTTPS servers were vulnerable because they shared keys with SSLv2-enabled servers.

**Lesson**: Never reuse keys across servers with different TLS configurations. Disable SSLv2 everywhere.

### Goto Fail (2014) — Apple's TLS Bug

A typo in Apple's SSL implementation:

```c
if ((err = SSLHashSHA1.update(&hashCtx, &signedParams)) != 0)
    goto fail;
    goto fail;  // <-- This line always executes, skipping verification
if ((err = SSLHashSHA1.final(&hashCtx, &hashOut)) != 0)
    goto fail;
```

A duplicated `goto fail` line meant the certificate signature was never verified. Any certificate was accepted as valid. Any man-in-the-middle attack would succeed against every iPhone, iPad, and Mac.

**Lesson**: Code review. Linting. Tests that check the failure case, not just the success case. This is why Go's `if err != nil` pattern, while verbose, is less error-prone than C's approach.

### Cloudflare Superfish/eDellRoot — Trust Store Poisoning

Lenovo shipped laptops with a Superfish root CA certificate installed in the Windows trust store. Dell did the same with eDellRoot. Both included the private key alongside the certificate. Anyone could use the private key to generate valid certificates for any domain. HTTPS was completely broken on affected machines.

**Lesson**: Never install root CA certificates from untrusted sources. The trust store is the foundation — compromise it and everything above it falls.

---

## TLS Best Practices Checklist

```
[ ] TLS 1.3 as preferred version, TLS 1.2 as minimum
[ ] SSLv3, TLS 1.0, TLS 1.1 disabled
[ ] Only AEAD cipher suites (GCM, ChaCha20-Poly1305)
[ ] Forward secrecy mandatory (ECDHE only, no static RSA key exchange)
[ ] X25519 preferred for key exchange, P-256 as fallback
[ ] HSTS enabled with long max-age (31536000 seconds = 1 year)
[ ] HSTS preload submitted (hstspreload.org)
[ ] Certificate from a trusted CA (Let's Encrypt is free)
[ ] Certificate auto-renewal configured
[ ] OCSP stapling enabled
[ ] HTTP -> HTTPS redirect (301)
[ ] No mixed content (all resources loaded over HTTPS)
[ ] Certificate Transparency monitoring
```

---

## Common Mistakes

### Mistake 1: Disabling Certificate Verification

```go
// WRONG — disables ALL certificate checks, any MITM attack succeeds
tlsConfig := &tls.Config{InsecureSkipVerify: true}
```

```go
// RIGHT — verify certificates (default behavior, just don't override it)
tlsConfig := &tls.Config{MinVersion: tls.VersionTLS13}
```

Developers often disable verification "just for testing" and it ends up in production. If you need to trust a self-signed cert, add it to the trust store explicitly.

### Mistake 2: Supporting Legacy Protocol Versions

```nginx
# WRONG — supporting insecure versions
ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
```

```nginx
# RIGHT — modern versions only
ssl_protocols TLSv1.2 TLSv1.3;
```

### Mistake 3: Not Using HSTS

Without HSTS, the first request might be HTTP (before the redirect to HTTPS). An attacker can intercept that first request (SSL stripping attack).

```nginx
# Add this header
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### Mistake 4: Expired Certificates

Certificates expire. If you're not using auto-renewal, you will forget. The result: your site shows a scary browser warning and users can't connect.

```bash
# Check when your cert expires
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | \
  openssl x509 -noout -enddate

# Set up a monitoring alert for 30 days before expiration
```

---

## Exercises

1. **TLS inspection**: Use `openssl s_client` to inspect the TLS configuration of 5 popular websites (GitHub, Google, your bank, etc.). Compare their TLS versions, cipher suites, and certificate chains.

2. **Self-signed TLS server**: Create a self-signed certificate and set up a TLS server in both Go and Node.js. Connect to it with `curl --cacert server.crt` to verify it works.

3. **mTLS setup**: Create a mini CA, generate server and client certificates signed by it, and set up an mTLS server that only accepts clients with valid certificates.

4. **TLS version testing**: Configure a server that supports TLS 1.2 and 1.3. Use `openssl s_client -tls1_2` and `-tls1_3` to verify both work. Then disable TLS 1.2 and confirm only 1.3 works.

5. **Certificate expiration monitor**: Write a script that checks the expiration date of a list of domains and alerts if any certificate expires within 30 days.

---

## Key Takeaways

- TLS 1.3 is faster (1 RTT vs 2) and more secure (no legacy baggage) than TLS 1.2
- Forward secrecy is mandatory in TLS 1.3 — ephemeral keys protect past sessions even if the long-term key is compromised
- Cipher suites define the combination of key exchange, authentication, encryption, and hash algorithms
- Use only AEAD cipher suites (GCM, ChaCha20-Poly1305) — no CBC, no RC4, no 3DES
- Certificates authenticate the server (and optionally the client with mTLS)
- HSTS prevents SSL stripping attacks on the first request
- Never disable certificate verification in production
- Auto-renew certificates (Let's Encrypt + certbot)
- Test your configuration with SSL Labs, testssl.sh, or openssl
