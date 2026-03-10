# Lesson 07: HTTP/1.1 -- The Protocol That Runs the Web

HTTP (HyperText Transfer Protocol) is the application-layer protocol that
powers the web. Every time you load a page, call an API, or submit a form,
HTTP is carrying your data. It is a request-response text protocol that runs
over TCP.

---

## The HTTP Model

HTTP is simple: a client sends a **request**, a server sends a **response**.
That is one transaction. The client always initiates; the server always
responds.

```
  Client                           Server
    |                                |
    |  --- HTTP Request -----------> |
    |  GET /users/42 HTTP/1.1        |
    |  Host: api.example.com         |
    |                                |
    |  <-- HTTP Response ----------- |
    |  HTTP/1.1 200 OK               |
    |  Content-Type: application/json|
    |  {"id": 42, "name": "Alice"}   |
    |                                |
```

HTTP is **stateless** -- the server does not remember anything about previous
requests. Each request is independent. State is maintained through cookies,
tokens, or other mechanisms layered on top.

---

## HTTP Request Format

An HTTP request has four parts:

```
POST /users HTTP/1.1\r\n              <- Request Line
Host: api.example.com\r\n            <- Headers
Content-Type: application/json\r\n   <-   (one per line)
Content-Length: 27\r\n                <-
Authorization: Bearer abc123\r\n     <-
\r\n                                  <- Blank line (end of headers)
{"name":"Alice","age":30}             <- Body (optional)
```

### The Request Line

```
METHOD   PATH         VERSION
GET      /users/42    HTTP/1.1

METHOD: What action to take
PATH:   Which resource
VERSION: Protocol version (always HTTP/1.1 here)
```

### HTTP Methods

| Method  | Purpose                    | Has Body? | Idempotent? | Safe? |
|---------|----------------------------|-----------|-------------|-------|
| GET     | Retrieve a resource        | No        | Yes         | Yes   |
| POST    | Create a resource / submit | Yes       | No          | No    |
| PUT     | Replace a resource entirely| Yes       | Yes         | No    |
| PATCH   | Partially update resource  | Yes       | No          | No    |
| DELETE  | Remove a resource          | Rarely    | Yes         | No    |
| HEAD    | GET but headers only       | No        | Yes         | Yes   |
| OPTIONS | What methods are allowed?  | No        | Yes         | Yes   |

**Idempotent** means calling it multiple times has the same effect as calling
it once. PUT to `/users/42` with `{"name":"Alice"}` always results in the
same state, no matter how many times you call it. POST to `/users` creates a
new user each time.

**Safe** means it does not modify the resource. GET and HEAD are safe -- they
only read.

---

## HTTP Response Format

```
HTTP/1.1 200 OK\r\n                   <- Status Line
Content-Type: application/json\r\n    <- Headers
Content-Length: 42\r\n                 <-
Cache-Control: max-age=3600\r\n       <-
\r\n                                   <- Blank line
{"id": 42, "name": "Alice", "age": 30} <- Body
```

### Status Codes

The three-digit code tells the client what happened:

```
1xx - Informational    (rare in practice)
2xx - Success
3xx - Redirection
4xx - Client Error     (your fault)
5xx - Server Error     (server's fault)
```

| Code | Meaning                | When You See It                       |
|------|------------------------|---------------------------------------|
| 200  | OK                     | Successful GET/PUT/PATCH              |
| 201  | Created                | Successful POST (new resource)        |
| 204  | No Content             | Successful DELETE (nothing to return)  |
| 301  | Moved Permanently      | URL changed forever (SEO redirect)    |
| 302  | Found (temp redirect)  | Temporary redirect (login flows)      |
| 304  | Not Modified           | Cached version is still valid          |
| 400  | Bad Request            | Malformed request / validation error  |
| 401  | Unauthorized           | Not authenticated (no/bad credentials)|
| 403  | Forbidden              | Authenticated but not authorized      |
| 404  | Not Found              | Resource does not exist                |
| 405  | Method Not Allowed     | Wrong HTTP method for this endpoint   |
| 409  | Conflict               | State conflict (duplicate, version)   |
| 422  | Unprocessable Entity   | Valid syntax but semantic errors       |
| 429  | Too Many Requests      | Rate limited                          |
| 500  | Internal Server Error  | Server crashed / unhandled error      |
| 502  | Bad Gateway            | Proxy/LB got bad response from upstream|
| 503  | Service Unavailable    | Server overloaded or in maintenance   |
| 504  | Gateway Timeout        | Proxy/LB timed out waiting for upstream|

A useful mental model:
- **401** = "Who are you?" (identity unknown)
- **403** = "I know who you are, but you can't do that" (insufficient permission)

---

## Important HTTP Headers

### Request Headers

| Header          | Purpose                              | Example                        |
|-----------------|--------------------------------------|--------------------------------|
| Host            | Which domain (required in HTTP/1.1)  | `Host: api.example.com`        |
| Content-Type    | Format of the body                   | `Content-Type: application/json`|
| Content-Length   | Size of body in bytes               | `Content-Length: 42`            |
| Authorization   | Credentials                          | `Authorization: Bearer abc123` |
| Accept          | What format you want back            | `Accept: application/json`     |
| Cookie          | Session/auth cookies                 | `Cookie: session=xyz`          |
| User-Agent      | Client identification                | `User-Agent: curl/7.88.1`      |
| Accept-Encoding | Compression you support              | `Accept-Encoding: gzip, br`    |
| If-None-Match   | Conditional GET (caching)            | `If-None-Match: "etag123"`     |

### Response Headers

| Header           | Purpose                            | Example                         |
|------------------|------------------------------------|---------------------------------|
| Content-Type     | Format of the response body        | `Content-Type: application/json`|
| Content-Length    | Size of response body              | `Content-Length: 256`           |
| Set-Cookie       | Tell client to store a cookie      | `Set-Cookie: session=xyz; HttpOnly`|
| Cache-Control    | How to cache this response         | `Cache-Control: max-age=3600`  |
| ETag             | Version identifier for caching     | `ETag: "abc123"`               |
| Location         | Where to redirect (3xx responses)  | `Location: /users/43`          |
| Access-Control-* | CORS headers                       | `Access-Control-Allow-Origin: *`|
| Content-Encoding | Compression used                   | `Content-Encoding: gzip`       |

---

## Cookies: State in a Stateless Protocol

HTTP is stateless -- the server forgets you after every request. Cookies solve
this by having the server give the client a small piece of data to send back
with every subsequent request.

```
First request (no cookie):

  Client                                Server
    |  GET /login                         |
    |  (no cookies)                       |
    | ----------------------------------> |
    |                                     |
    |  200 OK                             |
    |  Set-Cookie: session=abc123;        |
    |    HttpOnly; Secure; Path=/         |
    | <---------------------------------- |
    |                                     |
    |  (browser stores the cookie)        |

Every subsequent request:

    |  GET /dashboard                     |
    |  Cookie: session=abc123             |
    | ----------------------------------> |
    |                                     |
    |  Server looks up session abc123     |
    |  "Ah, this is Alice"               |
    |                                     |
    |  200 OK                             |
    |  (personalized dashboard)           |
    | <---------------------------------- |
```

### Cookie Flags

| Flag     | Purpose                                                |
|----------|--------------------------------------------------------|
| HttpOnly | JavaScript cannot access (prevents XSS cookie theft)   |
| Secure   | Only sent over HTTPS                                   |
| SameSite | Controls cross-site sending (Lax, Strict, None)        |
| Path     | Which URL paths the cookie applies to                  |
| Domain   | Which domains the cookie applies to                    |
| Max-Age  | How long until the cookie expires (seconds)            |

---

## Keep-Alive: Reusing TCP Connections

In HTTP/1.0, every request opened a new TCP connection (3-way handshake +
TLS handshake + request/response + teardown). For a page with 50 resources,
that is 50 TCP handshakes.

HTTP/1.1 introduced **persistent connections** (keep-alive) as the default.
The TCP connection stays open for multiple requests:

```
HTTP/1.0 (one connection per request):

  [TCP handshake] -> GET /page.html -> [close]
  [TCP handshake] -> GET /style.css -> [close]
  [TCP handshake] -> GET /app.js   -> [close]
  [TCP handshake] -> GET /logo.png -> [close]

  4 TCP handshakes. Slow.


HTTP/1.1 (keep-alive, default):

  [TCP handshake] -> GET /page.html
                  -> GET /style.css
                  -> GET /app.js
                  -> GET /logo.png
                  -> [close when done]

  1 TCP handshake. Much faster.
```

However, HTTP/1.1 still has a problem: **head-of-line blocking**. Requests
on the same connection are serialized. The second request cannot be sent until
the first response is received. Browsers work around this by opening 6-8
parallel TCP connections per domain. HTTP/2 solves this properly (Lesson 08).

---

## Content Negotiation

The client tells the server what formats it can handle using `Accept` headers.
The server picks the best match.

```
Client request:
  GET /data
  Accept: application/json, text/html;q=0.9, */*;q=0.1

  "I prefer JSON. I'll take HTML. As a last resort, anything."

  q= is the quality factor (0.0 to 1.0). Default is 1.0.

Server response:
  Content-Type: application/json
  (server chose JSON because it had the highest quality factor)
```

Other content negotiation headers:
- `Accept-Encoding: gzip, br` -- what compression you support
- `Accept-Language: en-US, en;q=0.9` -- what language you prefer

---

## CORS: Cross-Origin Resource Sharing

Browsers enforce the **same-origin policy**: JavaScript on `app.example.com`
cannot make requests to `api.different.com` unless the server explicitly
allows it.

CORS is the mechanism servers use to grant that permission.

### How CORS Works

```
1. Browser makes a "preflight" OPTIONS request:

   OPTIONS /api/data HTTP/1.1
   Origin: https://app.example.com
   Access-Control-Request-Method: POST
   Access-Control-Request-Headers: Content-Type, Authorization

2. Server responds with what is allowed:

   HTTP/1.1 204 No Content
   Access-Control-Allow-Origin: https://app.example.com
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE
   Access-Control-Allow-Headers: Content-Type, Authorization
   Access-Control-Max-Age: 86400

3. If allowed, browser sends the actual request:

   POST /api/data HTTP/1.1
   Origin: https://app.example.com
   Content-Type: application/json
   Authorization: Bearer abc123
   {"key": "value"}

4. Server includes CORS headers in response:

   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: https://app.example.com
```

**CORS only applies to browsers.** `curl`, server-to-server requests, and
mobile apps are not restricted by CORS. It is purely a browser security
mechanism.

### Common CORS Headers

| Header                           | Purpose                          |
|----------------------------------|----------------------------------|
| Access-Control-Allow-Origin      | Which origins can access          |
| Access-Control-Allow-Methods     | Which HTTP methods are allowed    |
| Access-Control-Allow-Headers     | Which request headers are allowed |
| Access-Control-Allow-Credentials | Whether cookies can be sent       |
| Access-Control-Max-Age           | How long to cache preflight       |

---

## REST Conventions

REST (Representational State Transfer) is a set of conventions for designing
HTTP APIs. It is not a protocol -- it is a style guide.

```
Resource: /users

GET    /users          List all users
GET    /users/42       Get user 42
POST   /users          Create a new user
PUT    /users/42       Replace user 42 entirely
PATCH  /users/42       Partially update user 42
DELETE /users/42       Delete user 42

Nested resources:
GET    /users/42/posts       List user 42's posts
POST   /users/42/posts       Create a post for user 42
GET    /users/42/posts/7     Get post 7 by user 42

Query parameters for filtering/pagination:
GET    /users?role=admin&page=2&limit=20
GET    /users?sort=created_at&order=desc
```

REST conventions:
- **Nouns, not verbs** in URLs: `/users` not `/getUsers`
- **HTTP methods convey the action**: GET reads, POST creates, etc.
- **Status codes convey the result**: 200 success, 404 not found, etc.
- **JSON is the standard body format** (though not required)
- **Stateless**: every request contains all information needed

---

## HTTP in Rust

### Minimal HTTP Server (No Framework)

```rust
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;

fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080")?;
    println!("Listening on http://127.0.0.1:8080");

    for stream in listener.incoming() {
        let mut stream = stream?;
        let reader = BufReader::new(&stream);

        let request_line = reader.lines().next()
            .unwrap_or(Ok(String::new()))?;
        println!("Request: {}", request_line);

        let response = match request_line.as_str() {
            "GET / HTTP/1.1" => {
                "HTTP/1.1 200 OK\r\n\
                 Content-Type: text/plain\r\n\
                 Content-Length: 13\r\n\
                 \r\n\
                 Hello, world!"
            }
            "GET /health HTTP/1.1" => {
                "HTTP/1.1 200 OK\r\n\
                 Content-Type: application/json\r\n\
                 Content-Length: 15\r\n\
                 \r\n\
                 {\"status\":\"ok\"}"
            }
            _ => {
                "HTTP/1.1 404 Not Found\r\n\
                 Content-Type: text/plain\r\n\
                 Content-Length: 9\r\n\
                 \r\n\
                 Not Found"
            }
        };

        stream.write_all(response.as_bytes())?;
    }
    Ok(())
}
```

This server is terrible (single-threaded, no proper parsing, no keep-alive)
but it demonstrates that HTTP is just text over TCP. You can build an HTTP
server from raw sockets.

---

## Exercises

### Exercise 1: Make HTTP Requests with curl

```bash
# GET request:
curl -v https://httpbin.org/get

# POST with JSON:
curl -X POST https://httpbin.org/post \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "age": 30}'

# See just headers:
curl -I https://httpbin.org/get

# Follow redirects:
curl -L http://github.com   # HTTP -> HTTPS redirect

# Examine the -v output carefully:
# Lines starting with > are what you sent
# Lines starting with < are what you received
# Lines starting with * are curl's status messages
```

### Exercise 2: Build a Raw HTTP Request with netcat

```bash
# Connect to a server and type the HTTP request by hand:
nc httpbin.org 80

# Then type (exactly, including the blank line at the end):
GET /get HTTP/1.1
Host: httpbin.org
Connection: close

# (press Enter twice after the last header)
# You will see the raw HTTP response.
```

### Exercise 3: Inspect Headers

```bash
# Look at caching headers:
curl -I https://example.com
# Find: Cache-Control, ETag, Last-Modified

# Look at security headers:
curl -I https://github.com
# Find: Strict-Transport-Security, X-Frame-Options,
#       Content-Security-Policy

# Look at CORS headers:
curl -I https://api.github.com
# Find: Access-Control-Allow-Origin
```

### Exercise 4: Examine Cookies

```bash
# Save cookies to a file:
curl -c cookies.txt -v https://httpbin.org/cookies/set/user/alice

# Send cookies back:
curl -b cookies.txt https://httpbin.org/cookies

# Look at the cookies.txt file:
cat cookies.txt
```

### Exercise 5: Run the Rust HTTP Server

Compile and run the minimal HTTP server from this lesson, then test it:

```bash
# In another terminal:
curl http://localhost:8080/
curl http://localhost:8080/health
curl http://localhost:8080/nonexistent

# Try the raw netcat approach too:
echo -e "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n" | nc localhost 8080
```

### Exercise 6: Explore Status Codes

```bash
# httpbin.org returns whatever status code you ask for:
curl -v https://httpbin.org/status/200
curl -v https://httpbin.org/status/301
curl -v https://httpbin.org/status/404
curl -v https://httpbin.org/status/500

# Watch how curl handles redirects:
curl -v https://httpbin.org/redirect/3
# (redirects 3 times, curl stops without -L)

curl -v -L https://httpbin.org/redirect/3
# (follows all 3 redirects)
```

---

Next: [Lesson 08: HTTP/2 and HTTP/3 -- What Changed and Why](./08-http2-http3.md)
