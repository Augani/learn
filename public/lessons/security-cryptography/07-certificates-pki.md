# Certificates and PKI

## The Passport Analogy

Certificates are like passports. You can't just write "I'm Alice" on a piece of paper and expect anyone to believe it. But if the government (a trusted authority) issues you a passport with your photo, name, and their official stamp, anyone in the world can verify your identity by checking the stamp.

In the digital world:

- **You** = a web server (example.com)
- **The government** = a Certificate Authority (CA) like Let's Encrypt, DigiCert, or Comodo
- **The passport** = an X.509 certificate (contains your public key, your domain name, and the CA's signature)
- **The stamp** = the CA's digital signature over the certificate
- **Checking the stamp** = verifying the signature with the CA's public key (which your browser already has)

If the stamp (signature) is valid, the passport (certificate) is legit, and you know the person (server) is who they claim to be.

---

## X.509 Certificates: What's Inside

An X.509 certificate is a structured document containing:

```
Certificate:
    Data:
        Version: 3
        Serial Number: 04:ab:cd:ef:12:34:56:78
        Signature Algorithm: ecdsa-with-SHA384
        Issuer: CN=Let's Encrypt Authority X3, O=Let's Encrypt, C=US
        Validity:
            Not Before: Jan 15 00:00:00 2025 GMT
            Not After:  Apr 15 23:59:59 2025 GMT
        Subject: CN=example.com
        Subject Public Key Info:
            Public Key Algorithm: id-ecPublicKey
                Public-Key: (256 bit)
                ASN1 OID: prime256v1
                [public key bytes]
        X509v3 Extensions:
            Subject Alternative Name:
                DNS:example.com, DNS:www.example.com, DNS:api.example.com
            Basic Constraints: critical
                CA:FALSE
            Key Usage: critical
                Digital Signature
            Extended Key Usage:
                TLS Web Server Authentication
            Authority Key Identifier:
                keyid:A8:4A:6A:63:04:7D:DD:BA:E6:D1:39:B7:A6:45:65:EF:F3:A8:EC:A1
            Certificate Policies:
                Policy: 2.23.140.1.2.1 (Domain Validated)
            CRL Distribution Points:
                URI:http://crl.example.com/ca.crl
            Authority Information Access:
                OCSP - URI:http://ocsp.example.com
                CA Issuers - URI:http://cert.example.com/ca.crt
    Signature Algorithm: ecdsa-with-SHA384
    Signature Value: [CA's signature over all the above]
```

Let's break down the important fields:

### Subject and Subject Alternative Name (SAN)

The Subject identifies who owns the certificate. In modern certificates, the actual domain names go in the Subject Alternative Name extension:

```
Subject Alternative Name:
    DNS:example.com
    DNS:www.example.com
    DNS:api.example.com
    DNS:*.staging.example.com
```

A certificate can cover multiple domains (SAN) or use wildcards (`*.example.com` covers `www.example.com` and `api.example.com` but not `example.com` itself and not `sub.sub.example.com`).

### Validity Period

Certificates expire. Current maximum validity:
- **Let's Encrypt**: 90 days (short, forces automation)
- **Commercial CAs**: Up to 398 days (13 months)
- **Previously**: Up to 5 years (now forbidden by browser policies)

Shorter validity periods limit the damage window if a private key is compromised.

### Key Usage and Extended Key Usage

These fields restrict what the certificate can be used for:

- **Digital Signature**: Can create TLS signatures
- **Key Encipherment**: Can encrypt keys (RSA key exchange)
- **TLS Web Server Authentication**: Can be used as a server certificate
- **TLS Web Client Authentication**: Can be used as a client certificate (mTLS)

A certificate marked only for "TLS Web Server Authentication" can't be used for client authentication, code signing, or email encryption.

### The Signature

At the bottom is the CA's signature over everything above it. This is the stamp on the passport. Your browser verifies this signature using the CA's public key. If it's valid, the browser trusts that the information in the certificate is accurate.

---

## The Chain of Trust

Certificates form a chain:

```
Root CA Certificate (self-signed, in your OS/browser trust store)
  |
  |--- signs --->  Intermediate CA Certificate
                     |
                     |--- signs --->  Your Server Certificate (end entity)
```

**Root CAs** are self-signed. They sign their own certificates. Your operating system and browser ship with a trust store containing ~150 root CA certificates. These are the ultimate trust anchors.

**Intermediate CAs** are signed by root CAs. They're the ones that actually sign end-entity certificates. Why the extra layer? The root CA's private key is the crown jewel — it's kept offline in a hardware security module (HSM) inside a vault inside a secure facility. It's only used occasionally to sign intermediate certificates. The intermediate CA handles day-to-day certificate issuance.

**End entity certificates** are what your server uses. They're signed by an intermediate CA.

### Chain Validation

When your browser receives a certificate from a server:

1. Read the server's certificate. Find the issuer (intermediate CA).
2. Check if you have the intermediate CA's certificate (the server usually sends it).
3. Verify the intermediate CA's signature on the server's certificate.
4. Find the intermediate CA's issuer (root CA).
5. Check if the root CA is in your trust store.
6. Verify the root CA's signature on the intermediate CA's certificate.
7. All signatures valid? The chain is trusted.

If any link in the chain is missing, expired, revoked, or has an invalid signature, the entire chain fails.

```bash
# See the full chain for any website
openssl s_client -connect github.com:443 -showcerts 2>/dev/null | \
  grep -E "s:|i:" | head -10

# Typical output:
# s:CN = github.com
# i:C = US, O = DigiCert Inc, CN = DigiCert TLS Hybrid ECC SHA384 2020 CA1
# s:C = US, O = DigiCert Inc, CN = DigiCert TLS Hybrid ECC SHA384 2020 CA1
# i:C = US, O = DigiCert Inc, OU = www.digicert.com, CN = DigiCert Global Root CA
```

That's a two-level chain: Root (DigiCert Global Root CA) -> Intermediate (DigiCert TLS Hybrid) -> End entity (github.com).

---

## Certificate Authorities (CAs)

A Certificate Authority is an organization that:
1. Verifies that you control a domain (Domain Validation) or verifies your organizational identity (Organization Validation, Extended Validation)
2. Signs a certificate linking your domain name to your public key
3. Maintains a certificate revocation list (CRL) and OCSP responder

### Validation Levels

| Level | What's Verified | Visual Indicator | Cost | Time |
|-------|----------------|-----------------|------|------|
| **DV (Domain Validation)** | You control the domain | Padlock icon | Free (Let's Encrypt) | Minutes |
| **OV (Organization Validation)** | Domain + organization identity | Padlock icon | $50-200/year | Days |
| **EV (Extended Validation)** | Domain + extensive org verification | Padlock icon (used to show green bar) | $200-1000/year | Weeks |

**Practical advice**: Use DV certificates (Let's Encrypt) for everything. EV certificates used to show a green address bar with the company name, but Chrome and Firefox removed that in 2019. There's no longer a visible difference to users. DV provides the same encryption. Save your money.

### The Trust Problem

The CA system is only as strong as its weakest CA. Your browser trusts ~150 root CAs. If any one of them is compromised, careless, or malicious, they can issue a valid certificate for any domain.

This has happened:
- **DigiNotar (2011)**: A Dutch CA was compromised. Attackers issued fraudulent certificates for google.com, used to intercept Iranian users' Gmail traffic. DigiNotar was removed from all browsers and went bankrupt.
- **Symantec (2017)**: Google discovered Symantec had mis-issued 30,000+ certificates. Chrome gradually distrusted all Symantec certificates over a year-long phase-out.
- **CNNIC (2015)**: The China Internet Network Information Center (a government-operated CA) issued an unauthorized intermediate certificate that was used to intercept Google traffic. CNNIC's root certificate was removed from Chrome and Firefox.

Certificate Transparency (CT) was created to detect this. Every CA must log every certificate they issue to public CT logs. Anyone can monitor these logs and detect unauthorized certificates for their domain.

---

## Let's Encrypt: Free Automated Certificates

Let's Encrypt is a free, automated CA run by the nonprofit ISRG (Internet Security Research Group). It issues DV certificates using the ACME protocol.

### How ACME Works

ACME (Automatic Certificate Management Environment) automates domain validation:

1. Your server (running certbot or similar) contacts Let's Encrypt and requests a certificate for example.com
2. Let's Encrypt responds with a challenge: "Put this specific file at `http://example.com/.well-known/acme-challenge/{token}`" (HTTP-01 challenge) or "Create this DNS TXT record at `_acme-challenge.example.com`" (DNS-01 challenge)
3. Your server creates the file or DNS record
4. Let's Encrypt verifies the challenge (proving you control the domain)
5. Let's Encrypt issues the certificate
6. Your server installs the certificate and configures auto-renewal

### Setting Up Let's Encrypt with Certbot

```bash
# Install certbot
# macOS
brew install certbot

# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# Get a certificate (standalone mode — certbot runs its own web server)
sudo certbot certonly --standalone -d example.com -d www.example.com

# Get a certificate (nginx mode — certbot configures nginx automatically)
sudo certbot --nginx -d example.com -d www.example.com

# Get a certificate (DNS challenge — for wildcards, works with any server)
sudo certbot certonly --manual --preferred-challenges dns \
  -d example.com -d "*.example.com"

# Test auto-renewal
sudo certbot renew --dry-run

# Set up auto-renewal (certbot installs a cron job or systemd timer automatically)
# Verify:
systemctl list-timers | grep certbot
# or
crontab -l | grep certbot
```

Certificate files are stored in `/etc/letsencrypt/live/example.com/`:
- `fullchain.pem` — certificate + intermediate (send this to clients)
- `privkey.pem` — your private key (keep this secret)
- `chain.pem` — intermediate certificate only
- `cert.pem` — your certificate only

### Nginx Configuration with Let's Encrypt

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;

    ssl_session_timeout 1d;
    ssl_session_cache shared:MozSSL:10m;
    ssl_session_tickets off;

    ssl_stapling on;
    ssl_stapling_verify on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
}
```

---

## Self-Signed Certificates

Self-signed certificates aren't signed by a CA. The certificate signs itself. Browsers will show a warning because there's no trusted third party vouching for the certificate.

**When to use self-signed certificates**:
- Local development
- Internal tools where you control all clients
- Testing TLS configuration
- mTLS between services you control (you're your own CA)

**When NOT to use self-signed certificates**:
- Any public-facing website (use Let's Encrypt, it's free)
- APIs accessed by third parties

### Creating a Self-Signed CA

For internal mTLS, you often want your own mini CA:

```bash
# Step 1: Create the CA private key
openssl genpkey -algorithm Ed25519 -out ca.key

# Step 2: Create the CA certificate (self-signed, valid for 10 years)
openssl req -new -x509 -key ca.key -out ca.crt -days 3650 \
  -subj "/CN=My Internal CA/O=My Company"

# Step 3: Create a server private key
openssl genpkey -algorithm Ed25519 -out server.key

# Step 4: Create a Certificate Signing Request (CSR)
openssl req -new -key server.key -out server.csr \
  -subj "/CN=myservice.internal" \
  -addext "subjectAltName=DNS:myservice.internal,DNS:localhost,IP:127.0.0.1"

# Step 5: Sign the server certificate with your CA
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out server.crt -days 365 \
  -copy_extensions copy

# Step 6: Verify the chain
openssl verify -CAfile ca.crt server.crt
# server.crt: OK

# Create a client certificate (for mTLS)
openssl genpkey -algorithm Ed25519 -out client.key

openssl req -new -key client.key -out client.csr \
  -subj "/CN=my-service-client"

openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out client.crt -days 365
```

### Using Your CA in Go

```go
package main

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"os"
)

func main() {
	caCert, err := os.ReadFile("ca.crt")
	if err != nil {
		fmt.Fprintf(os.Stderr, "reading CA cert: %v\n", err)
		os.Exit(1)
	}

	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		fmt.Fprintf(os.Stderr, "failed to parse CA certificate\n")
		os.Exit(1)
	}

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				RootCAs:    caCertPool,
				MinVersion: tls.VersionTLS13,
			},
		},
	}

	resp, err := client.Get("https://myservice.internal:8443/health")
	if err != nil {
		fmt.Fprintf(os.Stderr, "request error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	fmt.Printf("Status: %s\n", resp.Status)
}
```

---

## Certificate Pinning

Certificate pinning means your application only accepts a specific certificate or public key, rather than trusting any certificate signed by any CA.

The problem pinning solves: even with the CA system, a compromised or malicious CA can issue a valid certificate for your domain. If your app trusts all CAs, it will accept the fraudulent certificate.

### Types of Pinning

**Certificate pinning**: Pin the exact certificate. When the certificate rotates, you need to update the pin.

**Public key pinning**: Pin the public key. Even when the certificate is renewed, the public key can stay the same (if you reuse the key during renewal).

### Pinning in Go

```go
package main

import (
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
)

func createPinnedClient(expectedKeyHash string) *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				MinVersion: tls.VersionTLS13,
				VerifyConnection: func(state tls.ConnectionState) error {
					for _, cert := range state.PeerCertificates {
						pubKeyHash := sha256.Sum256(cert.RawSubjectPublicKeyInfo)
						hash := hex.EncodeToString(pubKeyHash[:])

						if hash == expectedKeyHash {
							return nil
						}
					}
					return fmt.Errorf("certificate pin mismatch: none of the certificates matched the expected pin")
				},
			},
		},
	}
}

func main() {
	pinHash := "a1b2c3d4e5f6..." // SHA-256 of the server's public key DER encoding
	client := createPinnedClient(pinHash)

	resp, err := client.Get("https://api.example.com/data")
	if err != nil {
		fmt.Fprintf(os.Stderr, "request error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	fmt.Printf("Status: %s\n", resp.Status)
}
```

### Getting the Pin Hash

```bash
# Get the SHA-256 pin hash from a live server
openssl s_client -connect example.com:443 2>/dev/null | \
  openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256
```

### Pinning Caveats

- **Always pin a backup key** — if your primary key is compromised and you only pinned that key, you're locked out of your own service
- **Mobile apps**: Pinning is common in mobile apps to prevent corporate proxies and government surveillance from intercepting traffic
- **HPKP is dead**: HTTP Public Key Pinning (HPKP) was a browser header for pinning. It was removed from Chrome in 2018 because it was too easy to brick a domain permanently if the pin was misconfigured. Certificate Transparency is the preferred alternative.

---

## Certificate Revocation

What happens when a private key is compromised? You need to revoke the certificate — tell the world "don't trust this certificate anymore, even though it hasn't expired."

### CRL (Certificate Revocation List)

The CA publishes a list of revoked certificate serial numbers. Clients download the list and check if the certificate is on it.

**Problems**: CRLs can be huge (millions of entries). Downloading and checking them adds latency. Most browsers soft-fail — if they can't download the CRL, they accept the certificate anyway (which defeats the purpose).

### OCSP (Online Certificate Status Protocol)

Instead of downloading the entire list, the client asks the CA "Is this specific certificate revoked?" and gets a real-time yes/no response.

**Problems**: Privacy (the CA knows every site you visit, since you're asking about every certificate). Latency (extra network request). Soft-fail (same problem as CRL).

### OCSP Stapling

The server itself periodically fetches its own OCSP response from the CA and includes it in the TLS handshake. The client doesn't need to contact the CA.

**Advantages**: No privacy leak (the client doesn't contact the CA). No extra latency (the OCSP response is part of the handshake). The OCSP response is signed by the CA, so the server can't forge it.

```nginx
# Enable OCSP stapling in nginx
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

### OCSP Must-Staple

A certificate extension that tells the client "I promise to always staple an OCSP response. If there's no stapled response, reject me." This turns soft-fail into hard-fail.

Let's Encrypt supports OCSP Must-Staple:
```bash
certbot certonly --must-staple -d example.com
```

---

## Certificate Transparency (CT)

Certificate Transparency is a system of public, append-only logs where every CA must record every certificate they issue. Anyone can monitor these logs.

**How it works**:
1. When a CA issues a certificate, it submits it to multiple CT logs
2. The CT log returns a Signed Certificate Timestamp (SCT)
3. The SCT is included in the certificate or the TLS handshake
4. Browsers require valid SCTs (Chrome requires SCTs from at least 2 different log operators)
5. Domain owners can monitor CT logs for unauthorized certificates

**Monitoring your domain**:
```bash
# Check CT logs for certificates issued for your domain
# Using crt.sh (a public CT log search engine)
curl "https://crt.sh/?q=example.com&output=json" | python3 -m json.tool

# Using the certspotter tool
# go install github.com/SSLMate/certspotter/cmd/certspotter@latest
certspotter example.com
```

**Why CT matters**: If a rogue CA issues a certificate for your domain, it will show up in CT logs. Services like SSLMate's Cert Spotter or Facebook's CT monitoring tool can alert you within minutes.

---

## Hands-On: Inspecting Certificates

### View a Remote Certificate

```bash
# Full certificate details
echo | openssl s_client -connect github.com:443 -servername github.com 2>/dev/null | \
  openssl x509 -noout -text

# Just the interesting parts
echo | openssl s_client -connect github.com:443 -servername github.com 2>/dev/null | \
  openssl x509 -noout -subject -issuer -dates -fingerprint -ext subjectAltName
```

### View a Local Certificate

```bash
# View a PEM certificate
openssl x509 -in server.crt -noout -text

# View a DER certificate
openssl x509 -in server.crt -inform DER -noout -text

# View a PKCS#12 bundle (common for Java/Windows)
openssl pkcs12 -in bundle.p12 -noout -info
```

### Verify a Certificate Chain

```bash
# Verify against the system trust store
openssl verify server.crt

# Verify against a specific CA
openssl verify -CAfile ca.crt server.crt

# Verify the full chain
openssl verify -CAfile root.crt -untrusted intermediate.crt server.crt
```

### Inspect Certificate in Go

```go
package main

import (
	"crypto/tls"
	"fmt"
	"os"
)

func inspectCertificate(host string) error {
	conn, err := tls.Dial("tcp", host+":443", &tls.Config{
		MinVersion: tls.VersionTLS13,
	})
	if err != nil {
		return fmt.Errorf("connecting: %w", err)
	}
	defer conn.Close()

	state := conn.ConnectionState()

	fmt.Printf("TLS Version: %s\n", tlsVersionName(state.Version))
	fmt.Printf("Cipher Suite: %s\n", tls.CipherSuiteName(state.CipherSuite))
	fmt.Printf("Server Name: %s\n", state.ServerName)
	fmt.Printf("Certificate Chain Length: %d\n\n", len(state.PeerCertificates))

	for i, cert := range state.PeerCertificates {
		fmt.Printf("Certificate %d:\n", i)
		fmt.Printf("  Subject: %s\n", cert.Subject)
		fmt.Printf("  Issuer: %s\n", cert.Issuer)
		fmt.Printf("  Not Before: %s\n", cert.NotBefore)
		fmt.Printf("  Not After: %s\n", cert.NotAfter)
		fmt.Printf("  DNS Names: %v\n", cert.DNSNames)
		fmt.Printf("  Is CA: %v\n", cert.IsCA)
		fmt.Printf("  Signature Algorithm: %s\n", cert.SignatureAlgorithm)
		fmt.Println()
	}

	return nil
}

func tlsVersionName(version uint16) string {
	switch version {
	case tls.VersionTLS13:
		return "TLS 1.3"
	case tls.VersionTLS12:
		return "TLS 1.2"
	case tls.VersionTLS11:
		return "TLS 1.1"
	case tls.VersionTLS10:
		return "TLS 1.0"
	default:
		return fmt.Sprintf("Unknown (0x%04x)", version)
	}
}

func main() {
	host := "github.com"
	if len(os.Args) > 1 {
		host = os.Args[1]
	}

	if err := inspectCertificate(host); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
```

---

## Real-World Breaches: Certificate Failures

### DigiNotar (2011) — Complete CA Compromise

An Iranian attacker compromised DigiNotar, a Dutch CA. They issued fraudulent certificates for google.com, *.google.com, mozilla.org, yahoo.com, and hundreds of other domains. The certificates were used to intercept 300,000+ Iranian Gmail users via man-in-the-middle attacks on Iran's national internet infrastructure.

Google detected it because Chrome has certificate pinning for Google domains — the fraudulent certificate was valid according to the CA system but didn't match Chrome's hardcoded pins.

DigiNotar was removed from every browser's trust store. The company went bankrupt within weeks.

**Lesson**: The CA system has a systemic weakness — any CA can issue certificates for any domain. Certificate Transparency and certificate pinning are the mitigations.

### Superfish/eDellRoot (2015) — Trusting Malicious Root CAs

Lenovo pre-installed Superfish adware on consumer laptops. Superfish installed its own root CA certificate and used it to MITM all HTTPS traffic (to inject ads into encrypted pages). The Superfish root CA private key was the same on every laptop and was easily extracted.

Anyone who extracted the key could generate valid certificates for any domain and MITM any Superfish-infected laptop. The attacker wouldn't even trigger a browser warning because the Superfish CA was in the trust store.

Dell did the same thing with eDellRoot for "support purposes."

**Lesson**: Only trust root CAs from your OS vendor. Review what's in your trust store. Tools like Superfish violate the entire TLS trust model.

### Let's Encrypt DST Root CA X3 Expiration (2021)

Let's Encrypt's original root certificate (cross-signed by IdenTrust's DST Root CA X3) expired on September 30, 2021. Older devices that didn't have Let's Encrypt's own ISRG Root X1 in their trust store suddenly couldn't verify Let's Encrypt certificates.

Affected: Android 7.0 and earlier, older IoT devices, some enterprise systems.

**Lesson**: Certificate chains and trust store updates matter. Plan for root CA transitions. Test on older platforms.

---

## Certificate Lifecycle Management

### The Cycle

```
1. Generate key pair
2. Create CSR (Certificate Signing Request)
3. Submit CSR to CA
4. CA validates domain ownership
5. CA issues certificate
6. Install certificate on server
7. Monitor expiration
8. Renew before expiration (go to step 2)
```

### Automation is Non-Negotiable

Manual certificate management doesn't scale. Certificates expire, humans forget, sites go down.

```bash
# Certbot handles the entire lifecycle:
certbot certonly --nginx -d example.com

# Auto-renewal (runs twice daily by default):
certbot renew

# The renewal process:
# 1. Checks if any certificates expire within 30 days
# 2. If yes, requests new certificates via ACME
# 3. Installs new certificates
# 4. Reloads the web server
```

### Certificate Monitoring

```bash
#!/bin/bash

DOMAINS=("example.com" "api.example.com" "dashboard.example.com")
THRESHOLD_DAYS=30

for domain in "${DOMAINS[@]}"; do
    expiry=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | \
             openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

    if [ -z "$expiry" ]; then
        echo "ALERT: Could not check certificate for $domain"
        continue
    fi

    expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry" +%s 2>/dev/null)
    now_epoch=$(date +%s)
    days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

    if [ "$days_left" -lt "$THRESHOLD_DAYS" ]; then
        echo "WARNING: $domain certificate expires in $days_left days ($expiry)"
    else
        echo "OK: $domain certificate expires in $days_left days"
    fi
done
```

---

## Common Mistakes

### Mistake 1: Not Sending the Intermediate Certificate

```nginx
# WRONG — only sending the end-entity certificate
ssl_certificate /etc/letsencrypt/live/example.com/cert.pem;
```

```nginx
# RIGHT — sending the full chain (end-entity + intermediate)
ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
```

If you don't send the intermediate certificate, clients that don't have it cached will fail to validate the chain. This causes intermittent failures that are maddening to debug — some clients work, others don't, depending on what's in their certificate cache.

### Mistake 2: Using the Wrong Domain in the Certificate

```bash
# Certificate is for "example.com" but server is accessed as "www.example.com"
# Solution: include both in the SAN
certbot certonly -d example.com -d www.example.com
```

### Mistake 3: Not Automating Renewal

```bash
# Manual renewal = guaranteed outage when you forget
# WRONG: renewal is a calendar reminder you'll ignore

# RIGHT: certbot handles it automatically
# Verify the timer is active:
systemctl status certbot.timer
```

### Mistake 4: Storing Private Keys Insecurely

```bash
# WRONG — world-readable private key
chmod 644 server.key

# RIGHT — only readable by the server process
chmod 600 server.key
chown www-data:www-data server.key
```

### Mistake 5: Ignoring Certificate Transparency

If someone obtains a fraudulent certificate for your domain, you won't know unless you're monitoring CT logs.

```bash
# Set up monitoring (free):
# - https://sslmate.com/certspotter/ (free for 5 domains)
# - https://developers.facebook.com/tools/ct/ (Facebook CT monitoring)
# - Subscribe to crt.sh RSS feed for your domain
```

---

## Exercises

1. **Certificate inspection**: Use `openssl s_client` and the Go inspection tool to examine the certificate chains of 5 different websites. Document the chain depth, signature algorithms, validity periods, and whether they use ECDSA or RSA.

2. **Build a mini CA**: Create a root CA, sign an intermediate CA, use the intermediate to sign a server certificate. Set up a Go or Node.js HTTPS server that uses the server certificate. Connect with `curl --cacert root.crt` and verify the chain.

3. **Let's Encrypt setup**: On a server you control (even a $5 VPS), set up Let's Encrypt with certbot. Verify auto-renewal works with `certbot renew --dry-run`.

4. **CT monitoring**: Search crt.sh for certificates issued for your domain (or a domain you're interested in). Look at how many certificates have been issued and by which CAs.

5. **Certificate expiration checker**: Build the monitoring script above into a proper tool (in Go or TypeScript) that takes a list of domains from a config file and sends alerts (Slack, email, or just stdout) when certificates are within 30 days of expiration.

6. **mTLS service mesh**: Create a CA, generate certificates for two services, and set up mTLS between them. Service A only accepts connections from Service B (verified by client certificate CN), and vice versa.

---

## Key Takeaways

- X.509 certificates bind a public key to an identity (domain name), vouched for by a Certificate Authority
- Certificates form a chain of trust: Root CA -> Intermediate CA -> End Entity
- Let's Encrypt provides free, automated certificates — there's no excuse for not using HTTPS
- Certificate Transparency logs help detect unauthorized certificates for your domain
- OCSP Stapling is the best revocation checking mechanism — enable it on your server
- Certificate pinning adds protection against CA compromise but requires careful management
- Automate certificate renewal — manual processes lead to outages
- The CA system's weakness is that any trusted CA can issue certificates for any domain — CT and pinning mitigate this
- Private keys must be protected with strict file permissions and never committed to version control
