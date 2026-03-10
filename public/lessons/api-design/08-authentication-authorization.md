# Lesson 08: Authentication & Authorization

## The Hotel Keycard Analogy

When you check into a hotel:
1. You show your ID at the front desk (**authentication** -- proving who you are)
2. They give you a keycard (**token**)
3. The keycard opens your room but not the penthouse (**authorization** -- what you can do)
4. The keycard expires at checkout (**token expiration**)

```
  AUTHENTICATION                    AUTHORIZATION
  "Who are you?"                    "What can you do?"

  +--------+    ID     +-------+   +--------+   keycard  +--------+
  | Guest  | -------> | Front | -> | Guest  | --------> | Room   |
  |        |          | Desk  |    |        |           | 402    |
  +--------+          +-------+    +--------+           +--------+
                                        |               +--------+
                                        +-----X------> | Penth. |
                                        (access denied) +--------+
```

## API Keys: The Simplest Approach

An API key is like a building pass -- one string that identifies you.

```
  GET /data HTTP/1.1
  Authorization: Bearer sk_live_abc123def456

  +--------+     api key      +--------+     lookup     +--------+
  | Client | --------------> | Server | ------------> | DB     |
  +--------+                  +--------+               +--------+
                                  |
                              valid key?
                              rate limit?
                              permissions?
```

**Good for:** Server-to-server, simple use cases.
**Bad for:** User-facing apps (keys can't represent user sessions).

## OAuth 2.0: The Delegation Framework

OAuth lets users grant limited access to their data without sharing passwords.
Like giving a valet a special key that only starts the car but can't open
the trunk.

### Authorization Code Flow (Most Common)

```
  +--------+                               +----------+
  | User   |                               | Auth     |
  | Browser|                               | Server   |
  +---+----+                               +----+-----+
      |                                         |
      | 1. Click "Login with Google"            |
      |                                         |
      |--------- redirect to auth server ------>|
      |                                         |
      | 2. User logs in + consents              |
      |                                         |
      |<-------- redirect with auth code -------|
      |                                         |
  +---+----+                               +----+-----+
  | Your   |                               | Auth     |
  | Server |                               | Server   |
  +---+----+                               +----+-----+
      |                                         |
      | 3. Exchange code for tokens             |
      |---------- POST /token ----------------->|
      |           (code + client_secret)        |
      |<--------- access_token + refresh_token -|
      |                                         |
      | 4. Use access_token to call APIs        |
      |                                         |
```

### Other OAuth Flows

```
  +-------------------------+----------------------------------------+
  | Flow                    | Use Case                               |
  +-------------------------+----------------------------------------+
  | Authorization Code      | Web apps with a backend                |
  | Auth Code + PKCE        | Mobile / SPA (no client secret)        |
  | Client Credentials      | Machine-to-machine (no user)           |
  | Device Code             | Smart TVs, CLI tools                   |
  +-------------------------+----------------------------------------+

  NEVER USE:
  - Implicit flow (deprecated, insecure)
  - Resource Owner Password (sends password to third party)
```

## JWT: JSON Web Tokens

A JWT is a self-contained token. It carries its own data, like a boarding
pass with your name, seat, and flight info printed on it.

```
  JWT Structure:
  +------------------+------------------+------------------+
  |     HEADER       |     PAYLOAD      |    SIGNATURE     |
  +------------------+------------------+------------------+
  | {"alg":"HS256",  | {"sub":"user42", | HMAC-SHA256(     |
  |  "typ":"JWT"}    |  "role":"admin", |   header.payload,|
  |                  |  "exp":17000000} |   secret_key)    |
  +------------------+------------------+------------------+
        |                   |                    |
     base64url          base64url            base64url
        |                   |                    |
        +---------.---------.-------------------+
                  eyJhbGci...  (the actual token)
```

The server can verify the token without a database lookup because
the signature proves it wasn't tampered with.

## Scopes: Fine-Grained Permissions

Scopes limit what a token can do. Like a hotel keycard that opens the
gym but not the pool.

```
  Token scopes: ["read:users", "write:orders"]

  GET /users       -> allowed (read:users)
  POST /orders     -> allowed (write:orders)
  DELETE /users/42 -> FORBIDDEN (no delete:users scope)

  Common scope patterns:
  read:resource     write:resource    delete:resource
  admin:resource    user:profile      billing:read
```

## Go - JWT Authentication Middleware

```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Claims struct {
	Sub    string   `json:"sub"`
	Role   string   `json:"role"`
	Scopes []string `json:"scopes"`
	Exp    int64    `json:"exp"`
}

var secretKey = []byte("your-256-bit-secret-change-in-production")

func createToken(claims Claims) (string, error) {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))

	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payload := base64.RawURLEncoding.EncodeToString(claimsJSON)

	mac := hmac.New(sha256.New, secretKey)
	mac.Write([]byte(header + "." + payload))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return header + "." + payload + "." + signature, nil
}

func verifyToken(tokenStr string) (*Claims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}

	mac := hmac.New(sha256.New, secretKey)
	mac.Write([]byte(parts[0] + "." + parts[1]))
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(parts[2]), []byte(expectedSig)) {
		return nil, fmt.Errorf("invalid signature")
	}

	claimsJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid payload encoding")
	}

	var claims Claims
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		return nil, fmt.Errorf("invalid claims")
	}

	if time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("token expired")
	}

	return &claims, nil
}

func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing token"}`, http.StatusUnauthorized)
			return
		}

		claims, err := verifyToken(strings.TrimPrefix(auth, "Bearer "))
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusUnauthorized)
			return
		}

		r.Header.Set("X-User-ID", claims.Sub)
		r.Header.Set("X-User-Role", claims.Role)
		next(w, r)
	}
}

func requireScope(scope string, next http.HandlerFunc) http.HandlerFunc {
	return requireAuth(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		claims, _ := verifyToken(token)
		for _, s := range claims.Scopes {
			if s == scope {
				next(w, r)
				return
			}
		}
		http.Error(w, `{"error":"insufficient scope"}`, http.StatusForbidden)
	})
}

func main() {
	token, _ := createToken(Claims{
		Sub:    "user42",
		Role:   "admin",
		Scopes: []string{"read:users", "write:users"},
		Exp:    time.Now().Add(1 * time.Hour).Unix(),
	})
	fmt.Printf("Test token: %s\n\n", token)

	http.HandleFunc("GET /users", requireScope("read:users", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"users":[],"requested_by":"%s"}`, r.Header.Get("X-User-ID"))
	}))

	fmt.Println("Server on :8080")
	http.ListenAndServe(":8080", nil)
}
```

## Token Refresh Flow

Access tokens are short-lived (15 min). Refresh tokens are long-lived (days).

```
  +--------+                              +--------+
  | Client |                              | Auth   |
  +---+----+                              +---+----+
      |                                       |
      | --- request with access_token ------->|
      | <-- 401 Unauthorized (expired) -------|
      |                                       |
      | --- POST /token (refresh_token) ----->|
      | <-- new access_token + refresh_token -|
      |                                       |
      | --- retry with new access_token ----->|
      | <-- 200 OK --------------------------|
```

## Exercises

1. **Run the Go server.** Use the printed token to call `GET /users`:
   ```bash
   curl -H "Authorization: Bearer <token>" http://localhost:8080/users
   ```

2. **Test expiration.** Create a token with `Exp` set to 1 second from now.
   Wait 2 seconds and try to use it.

3. **Add a scope check.** Add a `DELETE /users/{id}` endpoint that
   requires the `delete:users` scope.

4. **Explain OAuth to a non-technical person.** Use the hotel analogy:
   you (user), hotel (auth server), room service (API), keycard (token).

---

[Next: Lesson 09 - Rate Limiting & Throttling ->](09-rate-limiting-throttling.md)
