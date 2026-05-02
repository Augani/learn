# Lesson 14: Building a Simple HTTP Server From Scratch

Every web framework you have ever used -- axum, actix-web, Express, Gin --
is a layer of abstraction over raw TCP sockets and HTTP parsing. This lesson
strips away those layers. You will build an HTTP server from a TCP listener,
parsing raw bytes into requests and constructing raw bytes as responses.
After this, you will understand exactly what your framework does for you.

---

## The Plan

We will build this step by step:

```
1. Accept TCP connection (we did this in Lesson 13)
2. Read raw bytes from the socket
3. Parse those bytes into an HTTP request struct
4. Route the request to a handler based on path and method
5. The handler produces an HTTP response struct
6. Serialize the response back to bytes
7. Write the bytes to the socket
```

```
Client                              Our Server
  |                                     |
  |-- TCP connect ------------------>   |  accept()
  |                                     |
  |-- "GET /hello HTTP/1.1\r\n      |
  |    Host: localhost\r\n           |
  |    \r\n" ----------------------->   |  read bytes
  |                                     |  parse into HttpRequest
  |                                     |  route to handler
  |                                     |  handler returns HttpResponse
  |                                     |  serialize to bytes
  |   "HTTP/1.1 200 OK\r\n          |
  |    Content-Length: 13\r\n        |
  |    \r\n                          |
  |    Hello, world!" <-----------------   |  write bytes
  |                                     |
  |-- TCP close -------------------->   |  close
```

---

## The Full Working Code

Here is the complete server. We will break down every piece after.

### Cargo.toml

```toml
[package]
name = "http-from-scratch"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
```

### src/main.rs

```rust
use std::collections::HashMap;
use std::path::Path;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

// ── Request ──

#[derive(Debug)]
struct HttpRequest {
    method: String,
    path: String,
    query_params: HashMap<String, String>,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

// ── Response ──

struct HttpResponse {
    status_code: u16,
    status_text: String,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

impl HttpResponse {
    fn new(status_code: u16, status_text: &str) -> Self {
        Self {
            status_code,
            status_text: status_text.to_string(),
            headers: HashMap::new(),
            body: Vec::new(),
        }
    }

    fn ok() -> Self {
        Self::new(200, "OK")
    }

    fn not_found() -> Self {
        let mut resp = Self::new(404, "Not Found");
        resp.body = b"404 Not Found".to_vec();
        resp.headers.insert("Content-Type".to_string(), "text/plain".to_string());
        resp
    }

    fn bad_request(message: &str) -> Self {
        let mut resp = Self::new(400, "Bad Request");
        resp.body = message.as_bytes().to_vec();
        resp.headers.insert("Content-Type".to_string(), "text/plain".to_string());
        resp
    }

    fn method_not_allowed() -> Self {
        let mut resp = Self::new(405, "Method Not Allowed");
        resp.body = b"405 Method Not Allowed".to_vec();
        resp.headers.insert("Content-Type".to_string(), "text/plain".to_string());
        resp
    }

    fn internal_error(message: &str) -> Self {
        let mut resp = Self::new(500, "Internal Server Error");
        resp.body = message.as_bytes().to_vec();
        resp.headers.insert("Content-Type".to_string(), "text/plain".to_string());
        resp
    }

    fn with_text(mut self, text: &str) -> Self {
        self.body = text.as_bytes().to_vec();
        self.headers.insert("Content-Type".to_string(), "text/plain".to_string());
        self
    }

    fn with_html(mut self, html: &str) -> Self {
        self.body = html.as_bytes().to_vec();
        self.headers.insert("Content-Type".to_string(), "text/html".to_string());
        self
    }

    fn with_json(mut self, json: &str) -> Self {
        self.body = json.as_bytes().to_vec();
        self.headers.insert(
            "Content-Type".to_string(),
            "application/json".to_string(),
        );
        self
    }

    fn to_bytes(&self) -> Vec<u8> {
        let mut output = Vec::new();

        let status_line = format!(
            "HTTP/1.1 {} {}\r\n",
            self.status_code, self.status_text
        );
        output.extend_from_slice(status_line.as_bytes());

        let mut headers = self.headers.clone();
        headers
            .entry("Content-Length".to_string())
            .or_insert_with(|| self.body.len().to_string());
        headers
            .entry("Connection".to_string())
            .or_insert_with(|| "close".to_string());

        for (key, value) in &headers {
            let header_line = format!("{}: {}\r\n", key, value);
            output.extend_from_slice(header_line.as_bytes());
        }

        output.extend_from_slice(b"\r\n");
        output.extend_from_slice(&self.body);

        output
    }
}

// ── Parsing ──

fn parse_request(raw: &[u8]) -> Result<HttpRequest, String> {
    let raw_str = std::str::from_utf8(raw).map_err(|e| format!("invalid UTF-8: {}", e))?;

    let header_end = raw_str
        .find("\r\n\r\n")
        .ok_or("incomplete request: no header terminator")?;

    let header_section = &raw_str[..header_end];
    let body_bytes = &raw[header_end + 4..];

    let mut lines = header_section.lines();

    let request_line = lines.next().ok_or("empty request")?;
    let parts: Vec<&str> = request_line.split_whitespace().collect();

    if parts.len() != 3 {
        return Err(format!("malformed request line: {}", request_line));
    }

    let method = parts[0].to_uppercase();
    let full_path = parts[1];

    let (path, query_params) = parse_path_and_query(full_path);

    let mut headers = HashMap::new();
    for line in lines {
        if let Some(colon_pos) = line.find(':') {
            let key = line[..colon_pos].trim().to_lowercase();
            let value = line[colon_pos + 1..].trim().to_string();
            headers.insert(key, value);
        }
    }

    let content_length: usize = headers
        .get("content-length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let body = body_bytes[..content_length.min(body_bytes.len())].to_vec();

    Ok(HttpRequest {
        method,
        path,
        query_params,
        headers,
        body,
    })
}

fn parse_path_and_query(full_path: &str) -> (String, HashMap<String, String>) {
    let mut params = HashMap::new();

    let (path, query) = match full_path.split_once('?') {
        Some((p, q)) => (p.to_string(), Some(q)),
        None => (full_path.to_string(), None),
    };

    if let Some(query_str) = query {
        for pair in query_str.split('&') {
            if let Some((key, value)) = pair.split_once('=') {
                params.insert(key.to_string(), value.to_string());
            }
        }
    }

    (path, params)
}

// ── Routing ──

fn route(request: &HttpRequest) -> HttpResponse {
    match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/") => handle_root(),
        ("GET", "/hello") => handle_hello(request),
        ("GET", "/health") => handle_health(),
        ("GET", "/users") => handle_list_users(),
        ("POST", "/users") => handle_create_user(request),
        ("GET", path) if path.starts_with("/static/") => handle_static_file(path),
        _ => HttpResponse::not_found(),
    }
}

// ── Handlers ──

fn handle_root() -> HttpResponse {
    HttpResponse::ok().with_html(
        "<html><body><h1>HTTP Server From Scratch</h1>\
         <p>Routes: /, /hello, /hello?name=You, /health, /users, /static/*</p>\
         </body></html>",
    )
}

fn handle_hello(request: &HttpRequest) -> HttpResponse {
    let name = request
        .query_params
        .get("name")
        .map(|s| s.as_str())
        .unwrap_or("World");

    HttpResponse::ok().with_text(&format!("Hello, {}!", name))
}

fn handle_health() -> HttpResponse {
    HttpResponse::ok().with_json(r#"{"status":"healthy"}"#)
}

fn handle_list_users() -> HttpResponse {
    let json = r#"{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}"#;
    HttpResponse::ok().with_json(json)
}

fn handle_create_user(request: &HttpRequest) -> HttpResponse {
    if request.body.is_empty() {
        return HttpResponse::bad_request("request body is required");
    }

    let body_str = match std::str::from_utf8(&request.body) {
        Ok(s) => s,
        Err(_) => return HttpResponse::bad_request("body must be valid UTF-8"),
    };

    let response_json = format!(
        r#"{{"message":"user created","received":{}}}"#,
        body_str
    );

    let mut resp = HttpResponse::new(201, "Created");
    resp.headers.insert(
        "Content-Type".to_string(),
        "application/json".to_string(),
    );
    resp.body = response_json.into_bytes();
    resp
}

fn handle_static_file(path: &str) -> HttpResponse {
    let relative = path.strip_prefix("/static/").unwrap_or("");

    if relative.contains("..") {
        return HttpResponse::bad_request("invalid path");
    }

    let file_path = format!("./static/{}", relative);
    let path_ref = Path::new(&file_path);

    match std::fs::read(path_ref) {
        Ok(contents) => {
            let content_type = guess_content_type(relative);
            let mut resp = HttpResponse::ok();
            resp.body = contents;
            resp.headers
                .insert("Content-Type".to_string(), content_type.to_string());
            resp
        }
        Err(_) => HttpResponse::not_found(),
    }
}

fn guess_content_type(filename: &str) -> &str {
    if filename.ends_with(".html") {
        "text/html"
    } else if filename.ends_with(".css") {
        "text/css"
    } else if filename.ends_with(".js") {
        "application/javascript"
    } else if filename.ends_with(".json") {
        "application/json"
    } else if filename.ends_with(".png") {
        "image/png"
    } else if filename.ends_with(".jpg") || filename.ends_with(".jpeg") {
        "image/jpeg"
    } else if filename.ends_with(".txt") {
        "text/plain"
    } else {
        "application/octet-stream"
    }
}

// ── Server ──

async fn handle_connection(mut stream: tokio::net::TcpStream) {
    let peer = match stream.peer_addr() {
        Ok(addr) => addr,
        Err(_) => return,
    };

    let mut buffer = vec![0u8; 8192];
    let n = match stream.read(&mut buffer).await {
        Ok(0) => return,
        Ok(n) => n,
        Err(_) => return,
    };

    let request = match parse_request(&buffer[..n]) {
        Ok(req) => req,
        Err(err) => {
            let resp = HttpResponse::bad_request(&err);
            let _ = stream.write_all(&resp.to_bytes()).await;
            return;
        }
    };

    println!(
        "{} {} {} (from {})",
        request.method, request.path,
        if request.query_params.is_empty() {
            String::new()
        } else {
            format!("?{}", request.query_params.iter()
                .map(|(k, v)| format!("{}={}", k, v))
                .collect::<Vec<_>>()
                .join("&"))
        },
        peer
    );

    let response = route(&request);

    let response_bytes = response.to_bytes();
    let _ = stream.write_all(&response_bytes).await;
}

#[tokio::main]
async fn main() {
    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(addr).await.unwrap();
    println!("HTTP server listening on http://{}", addr);
    println!("Try: curl http://localhost:8080/hello?name=Rustacean");

    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                tokio::spawn(handle_connection(stream));
            }
            Err(err) => eprintln!("accept error: {}", err),
        }
    }
}
```

---

## Breaking It Down

### Step 1: Accept TCP Connection

This is identical to Lesson 13. `TcpListener::bind` creates a listening
socket, and `listener.accept()` waits for incoming connections.

### Step 2: Read Raw Bytes

```rust
let mut buffer = vec![0u8; 8192];
let n = stream.read(&mut buffer).await?;
```

The client sends its HTTP request as raw bytes over the TCP connection.
We read up to 8192 bytes into a buffer. For a real server, you would read
until you see the `\r\n\r\n` header terminator, then read `Content-Length`
more bytes for the body. Our simplified version assumes the entire request
fits in one read.

### Step 3: Parse the HTTP Request

An HTTP request looks like this on the wire:

```
GET /hello?name=World HTTP/1.1\r\n
Host: localhost:8080\r\n
User-Agent: curl/8.1.2\r\n
Accept: */*\r\n
\r\n
```

The parser:
1. Finds `\r\n\r\n` (the blank line separating headers from body)
2. Splits the first line into method, path, and HTTP version
3. Parses the path into path and query parameters
4. Parses each subsequent header line into key-value pairs
5. Reads the body based on Content-Length

```
Raw bytes:
"GET /hello?name=World HTTP/1.1\r\nHost: localhost\r\n\r\n"
  |      |              |           |                  |
  v      v              v           v                  v
method  path+query    version     headers          end of headers

Parsed:
  method: "GET"
  path: "/hello"
  query_params: {"name": "World"}
  headers: {"host": "localhost"}
  body: []
```

### Step 4: Route to Handler

The `route` function matches on `(method, path)` and calls the appropriate
handler. This is a simple pattern match -- real frameworks use more
sophisticated routers with path parameters, middleware, and regex patterns.

```rust
match (request.method.as_str(), request.path.as_str()) {
    ("GET", "/")      => handle_root(),
    ("GET", "/hello") => handle_hello(request),
    ("POST", "/users") => handle_create_user(request),
    _                  => HttpResponse::not_found(),
}
```

### Step 5: Build the Response

An HTTP response looks like this:

```
HTTP/1.1 200 OK\r\n
Content-Type: application/json\r\n
Content-Length: 27\r\n
Connection: close\r\n
\r\n
{"status":"healthy"}
```

The `to_bytes` method constructs this from the `HttpResponse` struct:

```
HttpResponse {
  status_code: 200,
  status_text: "OK",
  headers: {"Content-Type": "application/json"},
  body: [123, 34, 115, ...]    // {"status":"healthy"}
}
     |
     v
"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 20\r\n\r\n{\"status\":\"healthy\"}"
```

### Step 6: Write Bytes Back

```rust
stream.write_all(&response.to_bytes()).await?;
```

The response bytes go back over the same TCP connection to the client.

---

## Testing With curl

```bash
# Start the server
cargo run

# Test the root page
curl http://localhost:8080/
# <html><body><h1>HTTP Server From Scratch</h1>...

# Test hello with query parameter
curl http://localhost:8080/hello?name=Rustacean
# Hello, Rustacean!

# Test JSON endpoint
curl http://localhost:8080/users
# {"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}

# Test POST with a body
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Charlie"}'
# {"message":"user created","received":{"name":"Charlie"}}

# Test 404
curl http://localhost:8080/nonexistent
# 404 Not Found

# See full request/response headers
curl -v http://localhost:8080/health
```

---

## Serving Static Files

The `/static/` route serves files from a `./static/` directory:

```bash
mkdir static
echo "<h1>Hello from a file!</h1>" > static/index.html
echo "body { color: blue; }" > static/style.css

curl http://localhost:8080/static/index.html
# <h1>Hello from a file!</h1>

curl http://localhost:8080/static/style.css
# body { color: blue; }
```

The path traversal check (`..`) prevents directory escape attacks:

```bash
curl http://localhost:8080/static/../../etc/passwd
# 400 Bad Request: invalid path
```

---

## What Real Frameworks Add

Our server works, but a production framework like axum adds:

| Feature | Our Server | axum/actix |
|---|---|---|
| Request parsing | Basic, one-read | Full HTTP/1.1 spec, chunked encoding |
| Routing | Manual match | Pattern matching, path parameters `/users/:id` |
| Middleware | None | Logging, auth, CORS, compression |
| Body parsing | Manual bytes | Automatic JSON deserialization with serde |
| Error handling | Manual | Typed error responses, error handlers |
| Keep-alive | Connection: close | Persistent connections, pipelining |
| HTTP/2 | No | Yes (via hyper) |
| TLS | No | Yes (via rustls/openssl) |
| Static files | Basic | Caching, ETags, range requests |
| WebSocket | No | Built-in upgrade |

Understanding our from-scratch server makes every framework feature a
recognizable concept rather than magic.

---

## The Layer Diagram

```
What you write with axum:

  #[axum::get("/hello")]                    <-- Your code
  async fn hello() -> &str { "Hello!" }

What axum does for you:

  +----------------------------------------+
  |  Route matching (/hello -> handler)     |  <-- Router
  +----------------------------------------+
  |  Parse HTTP request from bytes          |  <-- hyper (HTTP library)
  +----------------------------------------+
  |  Read/write bytes on TCP connection     |  <-- tokio (async runtime)
  +----------------------------------------+
  |  TCP socket (accept, read, write)       |  <-- OS kernel
  +----------------------------------------+

What you built in this lesson:

  +----------------------------------------+
  |  Route matching (manual match)          |  <-- route()
  +----------------------------------------+
  |  Parse HTTP request from bytes          |  <-- parse_request()
  +----------------------------------------+
  |  Read/write bytes on TCP connection     |  <-- tokio TcpListener
  +----------------------------------------+
  |  TCP socket (accept, read, write)       |  <-- OS kernel
  +----------------------------------------+
```

---

## Exercises

1. **Run it.** Build the server and test every route with curl. Verify
   that GET, POST, query parameters, and static files all work.

2. **Add path parameters.** Implement a route `/users/:id` that returns
   JSON for a specific user. Parse the ID from the path (e.g., `/users/42`
   extracts `42`). Return 404 if the ID is not a valid number.

3. **Handle query parameters on /users.** Make `GET /users?role=admin`
   filter the hardcoded user list by role. Add a `role` field to the user
   JSON.

4. **Serve an HTML page.** Create a `static/index.html` with a form that
   POSTs to `/users`. After creating a user, redirect back to the form
   (return a 303 See Other with a `Location` header).

5. **Add request logging middleware.** Measure the time each request takes
   (from receiving bytes to sending the response) and print it:
   `GET /hello 200 (1.2ms)`.

6. **Content negotiation.** Make `/users` return JSON when the `Accept`
   header contains `application/json` and HTML when it contains `text/html`.

7. **Persistent connections.** Remove `Connection: close` and implement
   HTTP keep-alive: after sending a response, read the next request from
   the same connection instead of closing it. Use a loop around the
   read-parse-route-respond cycle.

---

Next: [Lesson 15: Non-Blocking I/O, Event Loops, and Why Async Matters](./15-nonblocking-io.md)
