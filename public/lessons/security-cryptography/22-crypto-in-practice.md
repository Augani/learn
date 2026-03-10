# Lesson 22: Cryptography in Practice — Key Management, Rotation, and Envelope Encryption

You know how to encrypt data. AES-256-GCM for symmetric, RSA or Ed25519 for
asymmetric, Argon2 for passwords. The algorithms are solved problems. But
the hardest part of cryptography was never the math — it is managing the
keys. Where do you store them? How do you rotate them without downtime? What
happens when a key is compromised? This lesson is about the engineering of
key management, which is where nearly every cryptographic failure actually
happens.

---

## The Analogy

Key management is like managing master keys for a hotel chain.

- The **master key** (Key Encryption Key, KEK) opens a lockbox on each floor.
  Only the hotel manager carries it. It never leaves the manager's safe.
- Inside each lockbox are **individual room keys** (Data Encryption Keys,
  DEKs). Each room has its own key.
- When a guest checks out, you change the room key. You do not change the
  master key — that would require replacing every lockbox in the hotel.
- When the hotel manager retires, you change the master key and re-encrypt
  all the lockbox contents. This is expensive but rare.
- The master key lives in a **safe** (Hardware Security Module). It never
  exists outside the safe. When you need to open a lockbox, you bring the
  lockbox to the safe, not the key to the lockbox.
- If a room key is compromised, you rotate that one key. If the master key
  is compromised, you rotate everything.

This is envelope encryption, and it is how AWS KMS, GCP KMS, and Azure Key
Vault all work.

---

## The Key Hierarchy

Production systems use a hierarchy of keys, not a single key:

```
┌─────────────────────────────────────────────────┐
│                  Root Key                        │
│          (lives in HSM, never exported)          │
│          Rotated: rarely (years)                 │
└─────────────────────┬───────────────────────────┘
                      │ encrypts
                      ▼
┌─────────────────────────────────────────────────┐
│            Key Encryption Keys (KEKs)            │
│          (stored encrypted by root key)           │
│          Rotated: quarterly to annually           │
└──────────┬──────────────────────┬───────────────┘
           │ encrypts             │ encrypts
           ▼                     ▼
┌──────────────────┐   ┌──────────────────┐
│  Data Encryption │   │  Data Encryption │
│   Key (DEK) #1   │   │   Key (DEK) #2   │
│  For: user data  │   │  For: file store  │
│  Rotated: monthly│   │  Rotated: monthly │
└──────────────────┘   └──────────────────┘
```

**Why a hierarchy?**

- The root key is the most sensitive. It lives in hardware that prevents
  extraction. It is never exposed to software.
- KEKs exist so you can rotate DEKs without touching the root key.
- DEKs are what actually encrypt your data. They are short-lived and
  disposable.
- Compromising a DEK exposes only the data encrypted by that specific key.
  Compromising a KEK exposes all DEKs it protects (but not the data
  encrypted by other KEKs).

---

## Envelope Encryption

Envelope encryption separates the key that encrypts your data from the key
that protects that key. It is the standard approach used by every major cloud
provider.

### How It Works

```
ENCRYPTION:
                                      ┌───────────┐
  1. Generate random DEK  ────────>   │  DEK      │
                                      │  (plain)  │
                                      └─────┬─────┘
                                            │
              ┌─────────────────────────────┤
              │                             │
              ▼                             ▼
  2. Encrypt data with DEK    3. Encrypt DEK with KEK (via KMS)
              │                             │
              ▼                             ▼
     ┌────────────────┐           ┌─────────────────┐
     │ Encrypted Data │           │  Encrypted DEK   │
     └────────────────┘           └─────────────────┘
              │                             │
              └──────────┬──────────────────┘
                         │
                         ▼
              4. Store both together
              ┌──────────────────────────┐
              │ { encrypted_dek: "...",  │
              │   encrypted_data: "..." }│
              └──────────────────────────┘

DECRYPTION:
  1. Retrieve encrypted DEK + encrypted data
  2. Send encrypted DEK to KMS → get plaintext DEK
  3. Decrypt data with plaintext DEK
  4. Discard plaintext DEK from memory immediately
```

### Why This Pattern?

- The KEK (in KMS) never leaves the HSM. It cannot be extracted.
- The DEK is generated locally, so you can encrypt gigabytes of data without
  sending it all to KMS (which would be slow and expensive).
- You store the encrypted DEK alongside the data. The encrypted DEK is
  useless without KMS access.
- Key rotation means generating a new DEK and re-encrypting only the small
  DEK blob with the new KEK — not re-encrypting all your data.

---

## Real-World Breach: Adobe (2013)

**What happened:** Adobe lost 153 million user records. The passwords were
encrypted (not hashed) using 3DES in ECB mode — the same key for every
password, with no unique salt or IV per user.

**What went wrong with key management:**

- Single key used for all 153 million passwords (no per-user DEK)
- ECB mode meant identical passwords produced identical ciphertext — attackers
  could group users by password
- The encryption key was stored on the same infrastructure as the encrypted
  data
- No key rotation had ever been performed
- Passwords should have been hashed (Argon2/bcrypt), not encrypted

**What proper key management would have prevented:**

- Per-user key derivation would make each ciphertext unique
- Key stored in HSM would survive a database breach
- Regular rotation would limit the window of exposure
- But really: passwords should NEVER be encrypted, only hashed. Encryption
  implies you can decrypt them, which means anyone with the key can too.

---

## Secure Random Number Generation

Every cryptographic operation depends on randomness. Key generation, IV
generation, nonce generation, token generation — all of them require
cryptographically secure random numbers. Using the wrong random source is a
catastrophic mistake.

### The Rule

**NEVER use `math/rand` (Go) or `Math.random()` (JavaScript) for anything
security-related.** These are pseudo-random number generators (PRNGs)
designed for simulations and games. They are predictable.

```
WRONG (predictable):
  Go:          math/rand
  JavaScript:  Math.random()
  Python:      random.random()

RIGHT (cryptographically secure):
  Go:          crypto/rand
  JavaScript:  crypto.randomBytes() / crypto.getRandomValues()
  Python:      secrets.token_bytes()
  Rust:        rand::rngs::OsRng
```

### Go: Secure Random Generation

```go
package security

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math/big"
)

func GenerateKey(bits int) ([]byte, error) {
	if bits%8 != 0 || bits < 128 {
		return nil, fmt.Errorf("key size must be a multiple of 8 and at least 128 bits, got %d", bits)
	}
	key := make([]byte, bits/8)
	_, err := rand.Read(key)
	if err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}
	return key, nil
}

func GenerateToken(byteLength int) (string, error) {
	if byteLength < 16 {
		return "", fmt.Errorf("token must be at least 16 bytes, got %d", byteLength)
	}
	b := make([]byte, byteLength)
	_, err := rand.Read(b)
	if err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func GenerateHexToken(byteLength int) (string, error) {
	if byteLength < 16 {
		return "", fmt.Errorf("token must be at least 16 bytes, got %d", byteLength)
	}
	b := make([]byte, byteLength)
	_, err := rand.Read(b)
	if err != nil {
		return "", fmt.Errorf("generate hex token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

func GenerateNonce(byteLength int) ([]byte, error) {
	if byteLength < 12 {
		return nil, fmt.Errorf("nonce must be at least 12 bytes for AES-GCM, got %d", byteLength)
	}
	nonce := make([]byte, byteLength)
	_, err := rand.Read(nonce)
	if err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}
	return nonce, nil
}

func GenerateRandomInt(max int64) (int64, error) {
	if max <= 0 {
		return 0, fmt.Errorf("max must be positive, got %d", max)
	}
	n, err := rand.Int(rand.Reader, big.NewInt(max))
	if err != nil {
		return 0, fmt.Errorf("generate random int: %w", err)
	}
	return n.Int64(), nil
}
```

### TypeScript: Secure Random Generation

```typescript
import { randomBytes, randomInt } from "crypto";

function generateKey(bits: number): Buffer {
  if (bits % 8 !== 0 || bits < 128) {
    throw new Error(`Key size must be a multiple of 8 and at least 128 bits, got ${bits}`);
  }
  return randomBytes(bits / 8);
}

function generateToken(byteLength: number): string {
  if (byteLength < 16) {
    throw new Error(`Token must be at least 16 bytes, got ${byteLength}`);
  }
  return randomBytes(byteLength).toString("base64url");
}

function generateHexToken(byteLength: number): string {
  if (byteLength < 16) {
    throw new Error(`Token must be at least 16 bytes, got ${byteLength}`);
  }
  return randomBytes(byteLength).toString("hex");
}

function generateNonce(byteLength: number): Buffer {
  if (byteLength < 12) {
    throw new Error(`Nonce must be at least 12 bytes for AES-GCM, got ${byteLength}`);
  }
  return randomBytes(byteLength);
}

function generateRandomInt(max: number): number {
  if (max <= 0) {
    throw new Error(`Max must be positive, got ${max}`);
  }
  return randomInt(max);
}
```

---

## Envelope Encryption Implementation

### Go: Envelope Encryption with AES-256-GCM

```go
package envelope

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"fmt"
)

type EncryptedPayload struct {
	EncryptedDEK  []byte `json:"encrypted_dek"`
	Nonce         []byte `json:"nonce"`
	EncryptedData []byte `json:"encrypted_data"`
	KeyVersion    int    `json:"key_version"`
}

type KEKProvider interface {
	Encrypt(plaintext []byte) (ciphertext []byte, keyVersion int, err error)
	Decrypt(ciphertext []byte, keyVersion int) (plaintext []byte, err error)
}

type LocalKEKProvider struct {
	keys       map[int][]byte
	currentVer int
}

func NewLocalKEKProvider(key []byte, version int) *LocalKEKProvider {
	return &LocalKEKProvider{
		keys:       map[int][]byte{version: key},
		currentVer: version,
	}
}

func (p *LocalKEKProvider) AddKeyVersion(key []byte, version int) {
	p.keys[version] = key
	if version > p.currentVer {
		p.currentVer = version
	}
}

func (p *LocalKEKProvider) Encrypt(plaintext []byte) ([]byte, int, error) {
	key, ok := p.keys[p.currentVer]
	if !ok {
		return nil, 0, fmt.Errorf("current key version %d not found", p.currentVer)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, 0, fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, 0, fmt.Errorf("create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, 0, fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, p.currentVer, nil
}

func (p *LocalKEKProvider) Decrypt(ciphertext []byte, version int) ([]byte, error) {
	key, ok := p.keys[version]
	if !ok {
		return nil, fmt.Errorf("key version %d not found", version)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

func Encrypt(data []byte, kek KEKProvider) (*EncryptedPayload, error) {
	dek := make([]byte, 32)
	if _, err := rand.Read(dek); err != nil {
		return nil, fmt.Errorf("generate DEK: %w", err)
	}

	block, err := aes.NewCipher(dek)
	if err != nil {
		return nil, fmt.Errorf("create data cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create data GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("generate data nonce: %w", err)
	}

	encryptedData := gcm.Seal(nil, nonce, data, nil)

	encryptedDEK, keyVersion, err := kek.Encrypt(dek)
	if err != nil {
		return nil, fmt.Errorf("encrypt DEK: %w", err)
	}

	for i := range dek {
		dek[i] = 0
	}

	return &EncryptedPayload{
		EncryptedDEK:  encryptedDEK,
		Nonce:         nonce,
		EncryptedData: encryptedData,
		KeyVersion:    keyVersion,
	}, nil
}

func Decrypt(payload *EncryptedPayload, kek KEKProvider) ([]byte, error) {
	dek, err := kek.Decrypt(payload.EncryptedDEK, payload.KeyVersion)
	if err != nil {
		return nil, fmt.Errorf("decrypt DEK: %w", err)
	}
	defer func() {
		for i := range dek {
			dek[i] = 0
		}
	}()

	block, err := aes.NewCipher(dek)
	if err != nil {
		return nil, fmt.Errorf("create data cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create data GCM: %w", err)
	}

	plaintext, err := gcm.Open(nil, payload.Nonce, payload.EncryptedData, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt data: %w", err)
	}

	return plaintext, nil
}

func (p *EncryptedPayload) MarshalJSON() ([]byte, error) {
	type Alias EncryptedPayload
	return json.Marshal(&struct{ *Alias }{Alias: (*Alias)(p)})
}
```

### TypeScript: Envelope Encryption

```typescript
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";

interface EncryptedPayload {
  encryptedDek: Buffer;
  nonce: Buffer;
  encryptedData: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

interface KEKProvider {
  encrypt(plaintext: Buffer): { ciphertext: Buffer; keyVersion: number };
  decrypt(ciphertext: Buffer, keyVersion: number): Buffer;
}

function createLocalKEKProvider(initialKey: Buffer, initialVersion: number): KEKProvider {
  const keys = new Map<number, Buffer>();
  keys.set(initialVersion, initialKey);
  let currentVersion = initialVersion;

  return {
    encrypt(plaintext: Buffer): { ciphertext: Buffer; keyVersion: number } {
      const key = keys.get(currentVersion);
      if (!key) {
        throw new Error(`Current key version ${currentVersion} not found`);
      }
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const ciphertext = Buffer.concat([nonce, authTag, encrypted]);
      return { ciphertext, keyVersion: currentVersion };
    },

    decrypt(ciphertext: Buffer, keyVersion: number): Buffer {
      const key = keys.get(keyVersion);
      if (!key) {
        throw new Error(`Key version ${keyVersion} not found`);
      }
      const nonce = ciphertext.subarray(0, 12);
      const authTag = ciphertext.subarray(12, 28);
      const data = ciphertext.subarray(28);
      const decipher = createDecipheriv("aes-256-gcm", key, nonce);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(data), decipher.final()]);
    },
  };
}

function envelopeEncrypt(data: Buffer, kek: KEKProvider): EncryptedPayload {
  const dek = randomBytes(32);

  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dek, nonce);
  const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const { ciphertext: encryptedDek, keyVersion } = kek.encrypt(dek);

  dek.fill(0);

  return {
    encryptedDek,
    nonce,
    encryptedData,
    authTag,
    keyVersion,
  };
}

function envelopeDecrypt(payload: EncryptedPayload, kek: KEKProvider): Buffer {
  const dek = kek.decrypt(payload.encryptedDek, payload.keyVersion);

  try {
    const decipher = createDecipheriv("aes-256-gcm", dek, payload.nonce);
    decipher.setAuthTag(payload.authTag);
    return Buffer.concat([decipher.update(payload.encryptedData), decipher.final()]);
  } finally {
    dek.fill(0);
  }
}
```

---

## Key Rotation

Key rotation means replacing an active key with a new one. You rotate keys
because:

- **Limiting exposure:** If a key is compromised, rotation limits how much
  data the attacker can decrypt (only data encrypted since the last rotation)
- **Compliance:** PCI-DSS, HIPAA, and SOC 2 all require periodic key rotation
- **Best practice:** Keys, like passwords, get weaker over time as computing
  power increases

### Rotation Strategy

```
Time ──────────────────────────────────────────────────>

Key v1: ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░
        active             retired (can decrypt, cannot encrypt)

Key v2: ░░░░░░░░░░░░░░░░░░░████████████████████░░░░░░░
                           active             retired

Key v3: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██████
                                               active
```

- **Active:** Used for new encryptions AND decryptions
- **Retired:** Used for decryption only (old data still needs to be read)
- **Destroyed:** Removed entirely (after all data is re-encrypted with newer key)

### Go: Key Rotation Manager

```go
package rotation

import (
	"fmt"
	"sync"
	"time"
)

type KeyState string

const (
	KeyStateActive    KeyState = "active"
	KeyStateRetired   KeyState = "retired"
	KeyStateDestroyed KeyState = "destroyed"
)

type ManagedKey struct {
	Version   int
	Key       []byte
	State     KeyState
	CreatedAt time.Time
	RetiredAt *time.Time
}

type KeyRotationManager struct {
	mu             sync.RWMutex
	keys           map[int]*ManagedKey
	activeVersion  int
	rotationPeriod time.Duration
}

func NewKeyRotationManager(initialKey []byte, rotationPeriod time.Duration) *KeyRotationManager {
	now := time.Now()
	return &KeyRotationManager{
		keys: map[int]*ManagedKey{
			1: {
				Version:   1,
				Key:       initialKey,
				State:     KeyStateActive,
				CreatedAt: now,
			},
		},
		activeVersion:  1,
		rotationPeriod: rotationPeriod,
	}
}

func (krm *KeyRotationManager) ActiveKey() (*ManagedKey, error) {
	krm.mu.RLock()
	defer krm.mu.RUnlock()

	key, ok := krm.keys[krm.activeVersion]
	if !ok {
		return nil, fmt.Errorf("active key version %d not found", krm.activeVersion)
	}
	return key, nil
}

func (krm *KeyRotationManager) GetKey(version int) (*ManagedKey, error) {
	krm.mu.RLock()
	defer krm.mu.RUnlock()

	key, ok := krm.keys[version]
	if !ok {
		return nil, fmt.Errorf("key version %d not found", version)
	}
	if key.State == KeyStateDestroyed {
		return nil, fmt.Errorf("key version %d has been destroyed", version)
	}
	return key, nil
}

func (krm *KeyRotationManager) Rotate(newKey []byte) (int, error) {
	krm.mu.Lock()
	defer krm.mu.Unlock()

	now := time.Now()

	oldKey := krm.keys[krm.activeVersion]
	oldKey.State = KeyStateRetired
	oldKey.RetiredAt = &now

	newVersion := krm.activeVersion + 1
	krm.keys[newVersion] = &ManagedKey{
		Version:   newVersion,
		Key:       newKey,
		State:     KeyStateActive,
		CreatedAt: now,
	}
	krm.activeVersion = newVersion

	return newVersion, nil
}

func (krm *KeyRotationManager) NeedsRotation() bool {
	krm.mu.RLock()
	defer krm.mu.RUnlock()

	key := krm.keys[krm.activeVersion]
	return time.Since(key.CreatedAt) > krm.rotationPeriod
}

func (krm *KeyRotationManager) DestroyKey(version int) error {
	krm.mu.Lock()
	defer krm.mu.Unlock()

	if version == krm.activeVersion {
		return fmt.Errorf("cannot destroy the active key")
	}

	key, ok := krm.keys[version]
	if !ok {
		return fmt.Errorf("key version %d not found", version)
	}

	for i := range key.Key {
		key.Key[i] = 0
	}
	key.Key = nil
	key.State = KeyStateDestroyed

	return nil
}
```

---

## Encrypting Data at Rest in a Database

A common pattern: encrypt sensitive fields before storing them in the
database. Each row gets its own DEK, encrypted by the KEK. If the database
is dumped, the attacker gets ciphertext.

### Go: Field-Level Encryption for Database Rows

```go
package fieldcrypt

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
)

type EncryptedField struct {
	EncryptedDEK  string `json:"k"`
	Nonce         string `json:"n"`
	Ciphertext    string `json:"c"`
	AuthTag       string `json:"t"`
	KeyVersion    int    `json:"v"`
}

type FieldEncryptor struct {
	kek KEKProvider
}

func NewFieldEncryptor(kek KEKProvider) *FieldEncryptor {
	return &FieldEncryptor{kek: kek}
}

func (fe *FieldEncryptor) EncryptField(plaintext string) (string, error) {
	payload, err := Encrypt([]byte(plaintext), fe.kek)
	if err != nil {
		return "", fmt.Errorf("encrypt field: %w", err)
	}

	field := EncryptedField{
		EncryptedDEK: base64.StdEncoding.EncodeToString(payload.EncryptedDEK),
		Nonce:        base64.StdEncoding.EncodeToString(payload.Nonce),
		Ciphertext:   base64.StdEncoding.EncodeToString(payload.EncryptedData),
		KeyVersion:   payload.KeyVersion,
	}

	encoded, err := json.Marshal(field)
	if err != nil {
		return "", fmt.Errorf("marshal encrypted field: %w", err)
	}
	return string(encoded), nil
}

func (fe *FieldEncryptor) DecryptField(encoded string) (string, error) {
	var field EncryptedField
	if err := json.Unmarshal([]byte(encoded), &field); err != nil {
		return "", fmt.Errorf("unmarshal encrypted field: %w", err)
	}

	encDEK, err := base64.StdEncoding.DecodeString(field.EncryptedDEK)
	if err != nil {
		return "", fmt.Errorf("decode DEK: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(field.Nonce)
	if err != nil {
		return "", fmt.Errorf("decode nonce: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(field.Ciphertext)
	if err != nil {
		return "", fmt.Errorf("decode ciphertext: %w", err)
	}

	payload := &EncryptedPayload{
		EncryptedDEK:  encDEK,
		Nonce:         nonce,
		EncryptedData: ciphertext,
		KeyVersion:    field.KeyVersion,
	}

	plaintext, err := Decrypt(payload, fe.kek)
	if err != nil {
		return "", fmt.Errorf("decrypt field: %w", err)
	}

	return string(plaintext), nil
}

type UserRepository struct {
	db        *sql.DB
	encryptor *FieldEncryptor
}

func (r *UserRepository) CreateUser(name, email, ssn string) error {
	encryptedSSN, err := r.encryptor.EncryptField(ssn)
	if err != nil {
		return fmt.Errorf("encrypt SSN: %w", err)
	}

	_, err = r.db.Exec(
		"INSERT INTO users (name, email, ssn_encrypted) VALUES ($1, $2, $3)",
		name, email, encryptedSSN,
	)
	return err
}

func (r *UserRepository) GetUser(id string) (*User, error) {
	var user User
	var encryptedSSN string

	err := r.db.QueryRow(
		"SELECT id, name, email, ssn_encrypted FROM users WHERE id = $1", id,
	).Scan(&user.ID, &user.Name, &user.Email, &encryptedSSN)
	if err != nil {
		return nil, fmt.Errorf("query user: %w", err)
	}

	ssn, err := r.encryptor.DecryptField(encryptedSSN)
	if err != nil {
		return nil, fmt.Errorf("decrypt SSN: %w", err)
	}
	user.SSN = ssn

	return &user, nil
}

type User struct {
	ID    string
	Name  string
	Email string
	SSN   string
}
```

### TypeScript: Field-Level Encryption

```typescript
interface EncryptedField {
  k: string;
  n: string;
  c: string;
  t: string;
  v: number;
}

function createFieldEncryptor(kek: KEKProvider) {
  return {
    encryptField(plaintext: string): string {
      const payload = envelopeEncrypt(Buffer.from(plaintext, "utf-8"), kek);

      const field: EncryptedField = {
        k: payload.encryptedDek.toString("base64"),
        n: payload.nonce.toString("base64"),
        c: payload.encryptedData.toString("base64"),
        t: payload.authTag.toString("base64"),
        v: payload.keyVersion,
      };

      return JSON.stringify(field);
    },

    decryptField(encoded: string): string {
      const field: EncryptedField = JSON.parse(encoded);

      const payload: EncryptedPayload = {
        encryptedDek: Buffer.from(field.k, "base64"),
        nonce: Buffer.from(field.n, "base64"),
        encryptedData: Buffer.from(field.c, "base64"),
        authTag: Buffer.from(field.t, "base64"),
        keyVersion: field.v,
      };

      return envelopeDecrypt(payload, kek).toString("utf-8");
    },
  };
}

async function createUserExample(pool: Pool, encryptor: ReturnType<typeof createFieldEncryptor>) {
  const ssn = "123-45-6789";
  const encryptedSSN = encryptor.encryptField(ssn);

  await pool.query(
    "INSERT INTO users (name, email, ssn_encrypted) VALUES ($1, $2, $3)",
    ["Jane Doe", "jane@example.com", encryptedSSN]
  );
}

async function getUserExample(pool: Pool, encryptor: ReturnType<typeof createFieldEncryptor>) {
  const result = await pool.query(
    "SELECT id, name, email, ssn_encrypted FROM users WHERE id = $1",
    ["user-123"]
  );

  const row = result.rows[0];
  const ssn = encryptor.decryptField(row.ssn_encrypted);

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    ssn,
  };
}
```

---

## Hardware Security Modules (HSMs)

An HSM is a dedicated hardware device for key management. The defining
feature: keys generated inside an HSM never leave the HSM. All cryptographic
operations happen inside the hardware.

```
Without HSM:
  Key stored in file → loaded into application memory → used for encryption
  (Key exists in software. Can be copied, dumped from memory, stolen.)

With HSM:
  Key generated inside HSM → never leaves HSM
  Application sends data to HSM → HSM encrypts it → returns ciphertext
  (Key never exists in software. Cannot be extracted even by root user.)
```

### Cloud HSM Options

| Provider | Service | Use Case |
|---|---|---|
| AWS | KMS (software-backed) | Default key management, most workloads |
| AWS | CloudHSM (hardware-backed) | Compliance requiring FIPS 140-2 Level 3 |
| GCP | Cloud KMS | Default key management |
| GCP | Cloud HSM | FIPS 140-2 Level 3 compliance |
| Azure | Key Vault | Default key management |
| Azure | Dedicated HSM | Hardware-level isolation |

For most applications, cloud KMS (software-backed) is sufficient. You only
need hardware HSM for compliance requirements (financial, healthcare,
government) or when your threat model includes a compromised cloud
provider.

### AWS KMS Integration (Go)

```go
package awskms

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/kms"
)

type AWSKMSProvider struct {
	client *kms.Client
	keyID  string
}

func NewAWSKMSProvider(keyID string) (*AWSKMSProvider, error) {
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		return nil, fmt.Errorf("load AWS config: %w", err)
	}

	return &AWSKMSProvider{
		client: kms.NewFromConfig(cfg),
		keyID:  keyID,
	}, nil
}

func (p *AWSKMSProvider) Encrypt(plaintext []byte) ([]byte, int, error) {
	result, err := p.client.Encrypt(context.Background(), &kms.EncryptInput{
		KeyId:     &p.keyID,
		Plaintext: plaintext,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("KMS encrypt: %w", err)
	}

	return result.CiphertextBlob, 0, nil
}

func (p *AWSKMSProvider) Decrypt(ciphertext []byte, _ int) ([]byte, error) {
	result, err := p.client.Decrypt(context.Background(), &kms.DecryptInput{
		CiphertextBlob: ciphertext,
	})
	if err != nil {
		return nil, fmt.Errorf("KMS decrypt: %w", err)
	}

	return result.Plaintext, nil
}

func (p *AWSKMSProvider) GenerateDataKey() (plaintext, encrypted []byte, err error) {
	result, err := p.client.GenerateDataKey(context.Background(), &kms.GenerateDataKeyInput{
		KeyId:   &p.keyID,
		KeySpec: "AES_256",
	})
	if err != nil {
		return nil, nil, fmt.Errorf("KMS generate data key: %w", err)
	}

	return result.Plaintext, result.CiphertextBlob, nil
}
```

---

## Common Cryptographic Mistakes

### 1. Storing Keys Next to Encrypted Data

```
BAD:  /data/users.db.enc  +  /data/encryption.key
      (attacker who gets disk access gets both)

GOOD: Data in database, key in KMS/Vault/HSM
      (attacker needs to compromise two systems)
```

### 2. Using the Same Key Forever

A key that has been in use for 5 years has encrypted so much data that
compromising it exposes everything. Rotate regularly.

### 3. Predictable IVs/Nonces

```
BAD:  nonce = counter++  (predictable, enables chosen-plaintext attacks)
BAD:  nonce = timestamp  (predictable, collisions on fast systems)
GOOD: nonce = crypto/rand (unpredictable, unique)
```

For AES-GCM specifically: nonce reuse with the same key completely breaks
the encryption. Two messages encrypted with the same key and nonce allow
the attacker to XOR the ciphertexts and recover both plaintexts.

### 4. Rolling Your Own Crypto

If you are implementing your own encryption algorithm, you are doing it
wrong. Use established libraries:

- Go: `crypto/aes`, `crypto/cipher`, `crypto/rand` (standard library)
- Node.js: `crypto` module (standard library)
- Rust: `ring`, `aes-gcm` crates
- General: libsodium (NaCl)

### 5. Using Encryption When You Need Hashing

- Passwords: hash (Argon2id), never encrypt
- File integrity: hash (SHA-256), never encrypt
- Data you need to recover: encrypt (AES-256-GCM)

Encryption is reversible. Hashing is not. Using encryption where you need
hashing means anyone with the key can reverse the operation.

### 6. Ignoring Key Zeroing

After you use a key, zero it out from memory. This limits the window where a
memory dump or core dump could expose the key:

```go
defer func() {
    for i := range key {
        key[i] = 0
    }
}()
```

```typescript
try {
  // use the key
} finally {
  key.fill(0);
}
```

This is not bulletproof (the Go and Node.js garbage collectors may copy the
key in memory before you zero it), but it significantly reduces the exposure
window.

---

## Real-World Breach: Heartbleed (2014)

**What happened:** A bug in OpenSSL's heartbeat extension allowed attackers
to read 64KB of server memory per request. This memory could contain private
keys, session keys, passwords, and other secrets.

**Key management lessons:**

- After Heartbleed was disclosed, every TLS private key on affected servers
  had to be considered compromised
- Organizations that used HSMs were partially protected — the private key
  was in the HSM, not in server memory
- Certificate rotation and revocation processes were tested at scale for the
  first time — and many failed
- Key zeroing after use would have reduced (but not eliminated) the exposure

The fix was not just patching OpenSSL. It was revoking every certificate,
generating new keys, and issuing new certificates. Organizations without
automated key rotation procedures took weeks to fully recover.

---

## Exercises

1. **Implement envelope encryption.** Use the Go or TypeScript code from
   this lesson to encrypt a file. Verify you can decrypt it. Then simulate
   key rotation by creating a new KEK version and re-encrypting the DEK.

2. **Build a key rotation system.** Encrypt 10 records with key version 1.
   Rotate to version 2. Verify you can still decrypt old records (backwards
   compatibility). Encrypt 10 new records with version 2. Verify both old
   and new records decrypt correctly.

3. **Encrypt sensitive database fields.** Take a database table with PII
   (SSN, phone number, address) and encrypt those fields at the application
   level. Verify the database stores only ciphertext. Verify your
   application can still read the data.

4. **Audit your random number usage.** Grep your codebase for `math/rand`
   (Go) or `Math.random()` (JavaScript). Replace any security-related usage
   with `crypto/rand` or `crypto.randomBytes()`.

5. **Set up AWS KMS** (or GCP KMS). Create a customer-managed key. Use it
   to implement envelope encryption for a simple CRUD application. Measure
   the latency of KMS calls and explain why you should NOT send all data
   through KMS directly.

6. **Simulate a key compromise.** Your DEK for the users table has been
   leaked. Walk through the incident response: generate a new DEK, re-encrypt
   all affected rows, destroy the old key, and verify no data is still
   encrypted with the compromised key.

---

## Key Takeaways

- The algorithm is the easy part. Key management is where cryptographic
  systems actually fail in production.
- Use a key hierarchy: root key → KEK → DEK. Never encrypt everything with
  a single key.
- Envelope encryption lets you rotate KEKs without re-encrypting all data.
  Only the small DEK blob needs re-encryption.
- Keys belong in HSMs or KMS, not in config files, environment variables, or
  source code. The key must be harder to steal than the data it protects.
- Rotate keys on a schedule and on compromise. Old keys should be retired
  (decrypt only) and eventually destroyed.
- Use `crypto/rand` (Go) or `crypto.randomBytes()` (Node.js) for ALL
  security-related randomness. `math/rand` and `Math.random()` are
  predictable and will get you breached.
- Zero keys from memory after use. It is not perfect protection, but it
  shrinks the attack window significantly.
- Never roll your own crypto. Use established libraries and follow their
  documentation exactly.
