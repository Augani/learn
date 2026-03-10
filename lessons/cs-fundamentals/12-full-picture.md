# Lesson 12: Putting It All Together — How a Web Request Actually Works

## The Grand Tour

You type `https://example.com/api/users/42` into your browser and press Enter.

What happens? Everything we've learned in this entire track fires at once — types, binary,
memory, the stack, the heap, garbage collection, compilation, concurrency, processes,
algorithms. All of it. In about 200 milliseconds.

Let's trace the complete journey.

---

## The Complete Journey — Bird's Eye View

```
 YOU                    INTERNET                         SERVER
 ┌──────────┐          ┌──────────┐          ┌──────────────────────────┐
 │ Browser  │          │          │          │  Load Balancer (nginx)   │
 │          │─── 1. ──>│  DNS     │          │         │                │
 │          │<── IP ───│  Server  │          │         v                │
 │          │          │          │          │  ┌──────────────┐        │
 │          │─── 2. TCP handshake ──────────>│  │  App Server  │        │
 │          │<── ACK ──────────────────────  │  │  (Go/Rust)   │        │
 │          │          │          │          │  │     │        │        │
 │          │─── 3. TLS handshake ──────────>│  │     v        │        │
 │          │<── cert + keys ──────────────  │  │  ┌────────┐ │        │
 │          │          │          │          │  │  │Database│ │        │
 │          │─── 4. HTTP request ───────────>│  │  │(Postgres│ │        │
 │          │          │          │          │  │  └────────┘ │        │
 │          │<── 8. HTTP response ──────────  │  └──────────────┘        │
 │          │          │          │          │                          │
 │  9. Render page     │          │          │                          │
 └──────────┘          └──────────┘          └──────────────────────────┘
```

---

## Step 1: DNS Lookup — Translating the Name

Your browser doesn't know where `example.com` is. It needs an IP address — the actual
numerical address on the internet. This is like looking up a restaurant's street address
when you only know its name.

**What happens under the hood:**

The browser builds a DNS query — a small **binary** packet (Lesson 2). The domain name
`example.com` isn't sent as a plain string. It's encoded in a specific binary format:
length-prefixed labels.

```
  DNS wire format for "example.com":

  ┌──────┬─────────────────┬──────┬───────────┬──────┐
  │  07  │ e x a m p l e   │  03  │  c o m    │  00  │
  │(len) │ (7 ASCII bytes) │(len) │(3 bytes)  │(end) │
  └──────┴─────────────────┴──────┴───────────┴──────┘
  Hex: 07 65 78 61 6D 70 6C 65 03 63 6F 6D 00

  Types at play (Lesson 1): each byte is a u8.
  The length prefix is an integer. The labels are byte arrays.
```

The OS creates a **UDP socket** — a file descriptor (Lesson 10) — and sends the query to
the configured DNS server (often `8.8.8.8` or your ISP's resolver). The DNS server
responds with the IP address: `93.184.216.34`.

**CS fundamentals in play:**
- **Binary encoding** (Lesson 2): domain names encoded as length-prefixed byte sequences
- **Types** (Lesson 1): IP addresses are 4 bytes (IPv4) or 16 bytes (IPv6) — not strings
- **Processes** (Lesson 10): your browser process creates a socket (file descriptor) for this
- **Algorithms** (Lesson 11): DNS servers use hash maps and trees for fast lookups

---

## Step 2: TCP Connection — Establishing a Reliable Channel

Now the browser opens a TCP connection to `93.184.216.34` on port 443 (HTTPS).

TCP's three-way handshake is like a phone call:

```
  Browser                               Server
     │                                     │
     │── SYN (seq=1000) ─────────────────>│  "Hi, can we talk?"
     │                                     │
     │<── SYN-ACK (seq=5000, ack=1001) ───│  "Yes! I hear you."
     │                                     │
     │── ACK (ack=5001) ─────────────────>│  "Great, I hear you too."
     │                                     │
     │    ═══ CONNECTION ESTABLISHED ═══   │
```

**What happens at the OS level:**

The browser calls a system call like `connect()`. The OS kernel (Lesson 10) allocates:
- A **socket** structure on the kernel **heap** (Lesson 6)
- A **file descriptor** in the process's FD table (Lesson 10)
- Send and receive **buffers** — memory on the heap to hold outgoing/incoming data
- An entry in the kernel's connection tracking table (**hash map** — Lesson 11)

```
  Browser process FD table after connecting:
  ┌─────┬──────────────────────────────────────┐
  │ FD  │ Points to                             │
  ├─────┼──────────────────────────────────────┤
  │  0  │ stdin                                 │
  │  1  │ stdout                                │
  │  2  │ stderr                                │
  │  3  │ X11 display socket                    │
  │  4  │ TCP socket → 93.184.216.34:443  ← NEW│
  └─────┴──────────────────────────────────────┘
```

---

## Step 3: TLS Handshake — Establishing Trust and Encryption

Before any HTTP data flows, the browser and server perform a TLS handshake to establish
encrypted communication. This is like meeting in a café and agreeing on a secret language
that only you two understand, even though everyone in the café can hear you talking.

```
  Browser                                Server
     │                                      │
     │── ClientHello ──────────────────────>│
     │   (supported cipher suites,          │  "Here's what crypto I know"
     │    random bytes)                     │
     │                                      │
     │<── ServerHello + Certificate ────────│
     │   (chosen cipher, server's           │  "Let's use this cipher.
     │    public key certificate)           │   Here's my ID card."
     │                                      │
     │── Key Exchange ─────────────────────>│
     │   (browser generates pre-master      │  "Here's the secret
     │    secret, encrypted with            │   ingredient for our
     │    server's public key)              │   shared key."
     │                                      │
     │<═══ Both derive shared key ════════>│
     │                                      │
     │   All data from here is encrypted    │
```

**CS fundamentals in play:**
- **Binary** (Lesson 2): The certificate is a DER/ASN.1 binary structure — not
  human-readable. Public keys are just large numbers encoded as byte arrays.
- **Types** (Lesson 1): cryptographic keys are specific-sized byte arrays (256-bit keys,
  2048-bit RSA moduli). Wrong size = broken crypto.
- **Memory** (Lesson 3): key material is allocated on the heap and must be carefully
  zeroed when done (to prevent secrets lingering in memory).
- **Stack** (Lesson 5): the crypto functions create deep call stacks — key derivation
  calls hash functions calls compression functions.

---

## Step 4: HTTP Request — Asking for the Data

Now the browser builds and sends the actual HTTP request through the encrypted channel:

```
  GET /api/users/42 HTTP/1.1
  Host: example.com
  Accept: application/json
  User-Agent: Mozilla/5.0
  Connection: keep-alive
```

This string is first encoded to **bytes** (UTF-8 — Lesson 2), then **encrypted** by TLS,
then packed into **TCP segments**, then into **IP packets**, then into **Ethernet frames**.
Each layer adds its own header — like putting a letter in an envelope, then that envelope
in a bigger envelope.

```
  Application layer:  GET /api/users/42 HTTP/1.1\r\n...
                      ┌──────────────────────────┐
  TLS layer:          │ encrypted blob           │
                      ├──────────────────────────┤
  TCP layer:     ┌────┤ seq=1001, port=443       │
                 │    ├──────────────────────────┤
  IP layer:   ┌──┤    │ src=192.168.1.5          │
              │  │    │ dst=93.184.216.34        │
              │  │    ├──────────────────────────┤
  Ethernet: ┌─┤  │    │ MAC addresses, checksum  │
            │ └──┴────┴──────────────────────────┘
            │        The actual bytes on the wire
```

**Memory in play:** The request bytes live in a **buffer on the heap** (Lesson 6). The OS
copies them into a kernel send buffer (also heap). The network card reads them from kernel
memory via DMA (Direct Memory Access — hardware reading RAM directly).

---

## Step 5: Server Receives the Request — Concurrency in Action

On the server side, an `nginx` load balancer (a **daemon** — Lesson 10) has been waiting
in the **blocked** state (Lesson 10: process states) for incoming connections. The arrival
of data wakes it up.

nginx forwards the request to one of several application server **processes**. The app
server might be written in Go or Rust:

```go
// Go server — each request handled by a goroutine (Lesson 9: concurrency)
func main() {
    http.HandleFunc("/api/users/", handleGetUser)
    http.ListenAndServe(":8080", nil)
}

func handleGetUser(w http.ResponseWriter, r *http.Request) {
    // This runs in its own goroutine — one of potentially thousands
    // executing concurrently on a few OS threads (Lesson 9)

    userID := extractID(r.URL.Path)  // Parse "42" from the URL
    user, err := db.GetUser(userID)  // Query the database
    if err != nil {
        http.Error(w, "not found", 404)
        return
    }
    json.NewEncoder(w).Encode(user)  // Write JSON response
}
```

```rust
// Rust server with async (Lesson 9: concurrency without GC overhead)
async fn handle_get_user(Path(user_id): Path<i64>) -> impl IntoResponse {
    // This runs as an async task on a thread pool
    // No garbage collector — memory managed at compile time (Lesson 7)

    match db::get_user(user_id).await {
        Ok(user) => Json(user).into_response(),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}
```

**Concurrency model (Lesson 9):**
- The Go server spawns a **goroutine** per request — lightweight, scheduled by the Go
  runtime onto OS threads.
- The Rust server uses **async tasks** — even lighter, no GC pauses.
- Both handle thousands of concurrent requests on a handful of CPU cores.

---

## Step 6: Processing the Request — Stack and Heap at Work

When `handleGetUser` runs, the CPU executes a chain of function calls. Each call creates a
**stack frame** (Lesson 5):

```
  Stack (growing downward):
  ┌──────────────────────────┐
  │ main()                   │  ← program entry point
  ├──────────────────────────┤
  │ http.ListenAndServe()    │  ← listening for connections
  ├──────────────────────────┤
  │ handleGetUser()          │  ← our handler function
  │   r *http.Request        │     local variable (pointer to heap)
  │   w http.ResponseWriter  │     local variable (interface)
  │   userID = 42            │     local variable (integer, ON the stack)
  ├──────────────────────────┤
  │ db.GetUser(42)           │  ← database query function
  │   query = "SELECT..."   │     local variable (string → heap data)
  │   conn = <pool entry>    │     borrowed from connection pool
  ├──────────────────────────┤
  │ rows.Scan()              │  ← reading database results
  └──────────────────────────┘

  Heap (lives until freed/GC'd):
  ┌───────────────────────────────────────────┐
  │ http.Request struct (URL, headers, body)  │ ← allocated when request arrived
  │ User{id: 42, name: "Alice", email: "..."}│ ← allocated from DB results
  │ JSON bytes: {"id":42,"name":"Alice",...}  │ ← allocated for response
  │ Connection pool: [conn1, conn2, conn3]    │ ← long-lived, reused
  └───────────────────────────────────────────┘
```

Local variables like `userID = 42` live on the stack (fast, automatic cleanup). Larger
structures like the HTTP request and database results live on the heap (Lesson 6).

In Go, the garbage collector (Lesson 7) will eventually clean up the `User` struct and
JSON bytes after the response is sent. In Rust, they're dropped automatically when they go
out of scope — no GC needed.

---

## Step 7: Database Query — Process-to-Process Communication

The app server talks to PostgreSQL, which is a **separate process** (Lesson 10) — often
on a separate machine entirely. They communicate over a TCP socket (another file
descriptor).

```
  App Server (PID 5001)              PostgreSQL (PID 3001)
  ┌─────────────────┐               ┌─────────────────────┐
  │                  │               │                     │
  │  FD 8: TCP ──────────────────────── FD 12: TCP        │
  │  socket to DB   │  SQL query:   │  socket from app    │
  │                  │  "SELECT *    │                     │
  │                  │   FROM users  │  Parses SQL         │
  │                  │   WHERE id=42"│  Query planner      │
  │                  │               │  picks B-tree index │
  │                  │               │  (Lesson 11)        │
  │                  │               │                     │
  │                  │    result     │  Reads from disk    │
  │  Receives rows <─────────────────  via buffer cache   │
  │                  │               │  (heap memory)      │
  └─────────────────┘               └─────────────────────┘
```

**Algorithms in play (Lesson 11):**

PostgreSQL doesn't scan every row to find user 42. It uses a **B-tree index** — the same
data structure we discussed in Lesson 11. For a table with 10 million users, the B-tree
finds user 42 in about **3-4 disk reads** (O(log n)) instead of scanning all 10 million
rows (O(n)).

PostgreSQL itself is often a JVM-based or C-based process. If it's running on the JVM
(like some extensions), the JVM's **garbage collector** (Lesson 7) might run during the
query, causing a brief GC pause. This is one reason why database tuning includes GC tuning.

PostgreSQL's core is C. It uses manual memory management (Lesson 6) internally — `malloc`
and `free` — with custom memory pools called "memory contexts" that allow bulk
deallocation. When a query finishes, the entire query's memory context is freed at once.

---

## Step 8: Response Sent Back — Compilation Pays Off

The server serializes the `User` struct into JSON, wraps it in an HTTP response, encrypts
it with TLS, and sends it back.

The server code that does all of this was **compiled** (Lesson 8) ahead of time:

```
  Source code (what you wrote):
    user_json, err := json.Marshal(user)

  After compilation (what the CPU actually runs):
    MOV  RAX, [RBP-16]       ; load user pointer from stack
    CALL json.Marshal         ; call the serialization function
    MOV  [RBP-24], RAX       ; store result pointer
    TEST RDX, RDX             ; check error (nil?)
    JNZ  error_handler        ; jump if error
```

In Rust, the compiler (Lesson 8) has already:
- Eliminated bounds checks where it can prove they're safe
- Inlined small functions (no function call overhead)
- Removed dead code (unreachable branches)
- Applied SIMD optimizations for JSON serialization

In Go, the compiler is faster but less aggressive — the runtime compensates with a good
GC and goroutine scheduler.

**The response travels back** through TLS encryption, TCP segments, IP packets, across
routers (each one doing an O(log n) lookup in its routing table — Lesson 11), back to
your browser.

---

## Step 9: Browser Renders the Page — JavaScript, GC, and the GPU

Your browser receives the response and needs to render it. The browser itself is a massive
compiled program (Chrome is ~35 million lines of C++).

```
  Browser engine internals:
  ┌──────────────────────────────────────────────────┐
  │                                                   │
  │  Network layer receives bytes                     │
  │        │                                          │
  │        v                                          │
  │  HTML/CSS parser (stack frames for recursive      │
  │  descent parsing — Lesson 5)                      │
  │        │                                          │
  │        v                                          │
  │  DOM tree (heap allocated — Lesson 6)             │
  │  Each <div>, <p>, <span> is a heap object         │
  │  with pointers to children — a tree structure     │
  │        │                                          │
  │        v                                          │
  │  JavaScript engine (V8)                           │
  │  ├── JIT compiler (Lesson 8): compiles JS to     │
  │  │   machine code ON THE FLY                      │
  │  ├── Garbage collector (Lesson 7): cleans up      │
  │  │   JS objects no longer referenced              │
  │  └── Event loop (Lesson 9): handles async         │
  │      callbacks, promises, setTimeout              │
  │        │                                          │
  │        v                                          │
  │  Layout engine: computes positions (algorithms    │
  │  for box model, flexbox — constraint solving)     │
  │        │                                          │
  │        v                                          │
  │  GPU rendering: pixels painted to screen via      │
  │  hardware acceleration (binary: framebuffer       │
  │  is raw pixel data in memory — Lesson 2)          │
  └──────────────────────────────────────────────────┘
```

**Every lesson shows up:**
- **Types** (Lesson 1): DOM nodes have specific types (Element, Text, Comment).
  JavaScript's dynamic types mean V8 must track type information at runtime.
- **Binary** (Lesson 2): images are decoded from binary formats (PNG, JPEG). The
  framebuffer is raw RGBA pixel data — 4 bytes per pixel.
- **Memory** (Lesson 3): Chrome is infamous for memory usage because each tab is its own
  process (isolation! Lesson 10), each with its own heap.
- **Stack** (Lesson 5): JavaScript's call stack. Stack overflow in JS = too-deep recursion.
- **Heap** (Lesson 6): every JS object, every DOM node, every CSS rule — all on the heap.
- **GC** (Lesson 7): V8 uses a generational garbage collector. Young objects in a "nursery,"
  old objects promoted to "old space." GC pauses can cause visible jank (dropped frames).
- **Compilation** (Lesson 8): V8's JIT compiler optimizes "hot" JavaScript functions from
  bytecode to machine code. Deoptimizes if type assumptions break.
- **Concurrency** (Lesson 9): the event loop, Web Workers (real threads for parallelism),
  async/await for non-blocking I/O.

---

## What Happens When Things Go Wrong

Each layer has its own failure modes. Understanding CS fundamentals helps you diagnose them.

### Memory Leak in the Server (Lesson 6, 7)

```
  Request 1: allocate 1 MB for response buffer. Forget to free it.
  Request 2: allocate 1 MB more. Forget again.
  ...
  Request 100,000: server is using 100 GB. OS kills it (OOM killer).

  ┌──────────────────────────────────────┐
  │           Server Memory              │
  │  ████████████████████████████████    │  ← leaked buffers
  │  ████████████████████████████████    │     piling up
  │  ████████████████████████████████    │
  │  ██████████░░░░░░░░░░░░░░░░░░░░    │  ← OOM! Process killed.
  └──────────────────────────────────────┘

  In Go/Python: GC prevents most leaks, but holding references
  to objects you don't need (e.g., growing a cache without eviction)
  still causes memory to balloon.

  In Rust: compiler catches most leaks. But Rc<RefCell<T>> cycles
  can still leak. Lesson 7's ownership model prevents the rest.
```

### Race Condition in the Request Handler (Lesson 9)

```go
// BUGGY: two goroutines updating a shared counter without synchronization
var requestCount int  // shared mutable state — danger!

func handleRequest(w http.ResponseWriter, r *http.Request) {
    requestCount++  // NOT atomic! Two goroutines can read the same
                    // value, both add 1, and write back — losing a count.
    // 1000 requests might show count = 987
}

// FIXED: use atomic operations or a mutex
var requestCount atomic.Int64

func handleRequest(w http.ResponseWriter, r *http.Request) {
    requestCount.Add(1)  // Atomic — safe for concurrent access
}
```

### Type Mismatch in the API (Lesson 1)

```python
# Server sends: {"user_id": 42, "name": "Alice"}
# Client JavaScript expects: user.userId (camelCase, not snake_case)

# Server sends: {"balance": 19.99}
# Client stores in a float. After arithmetic: 19.990000000000002
# Lesson 1: floating-point representation is approximate!

# Server sends: {"id": 9007199254740993}
# JavaScript's Number can't represent this exactly (> 2^53)
# It becomes 9007199254740992. Off by one. Bug!
# This is why many APIs send large IDs as strings.
```

### Buffer Overflow (Lesson 3, 6)

```c
// C server code with a vulnerability:
void handle_request(char *input) {
    char buffer[256];         // Stack-allocated buffer, 256 bytes
    strcpy(buffer, input);    // Copies input into buffer WITHOUT checking length
    // If input is 300 bytes: stack smashing! The extra 44 bytes
    // overwrite the return address. Attacker controls where the
    // function "returns" to — arbitrary code execution.
}

// This is why Rust doesn't let you do unchecked memory access.
// This is why Go has bounds checking on slices.
// This is why C/C++ servers are the #1 source of security vulnerabilities.
```

```
  Stack before overflow:          Stack after overflow:

  ┌──────────────┐               ┌──────────────┐
  │ return addr  │               │ AAAA AAAA    │ ← overwritten!
  ├──────────────┤               ├──────────────┤   attacker controls
  │ saved RBP    │               │ AAAA AAAA    │   execution now
  ├──────────────┤               ├──────────────┤
  │ buffer[255]  │               │ AAAA         │
  │ ...          │               │ ...          │
  │ buffer[0]    │               │ malicious    │
  └──────────────┘               └──────────────┘
```

---

## The Complete Map — Every Lesson in One Request

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    THE FULL REQUEST JOURNEY                      │
  ├─────────────────────┬───────────────────────────────────────────┤
  │ Step                │ CS Fundamentals                            │
  ├─────────────────────┼───────────────────────────────────────────┤
  │ 1. DNS lookup       │ Types (IP = 4 bytes), Binary (wire        │
  │                     │ format), Algorithms (hash/tree lookup)    │
  ├─────────────────────┼───────────────────────────────────────────┤
  │ 2. TCP connect      │ Processes (socket = file descriptor),     │
  │                     │ Memory (kernel buffers on heap)           │
  ├─────────────────────┼───────────────────────────────────────────┤
  │ 3. TLS handshake    │ Binary (certificate encoding), Memory    │
  │                     │ (keys on heap, zeroed after), Types      │
  │                     │ (key sizes must be exact)                │
  ├─────────────────────┼───────────────────────────────────────────┤
  │ 4. HTTP request     │ Binary (UTF-8 encoding), Memory (send   │
  │                     │ buffers), Stack (system call frames)     │
  ├─────────────────────┼───────────────────────────────────────────┤
  │ 5. Server receives  │ Concurrency (goroutines/async tasks),    │
  │                     │ Processes (daemon, signal handling)       │
  ├─────────────────────┼───────────────────────────────────────────┤
  │ 6. Request handler  │ Stack (call frames), Heap (allocations), │
  │                     │ GC (cleaning up response objects)        │
  ├─────────────────────┼───────────────────────────────────────────┤
  │ 7. Database query   │ Algorithms (B-tree index, O(log n)),     │
  │                     │ Processes (DB = separate process),       │
  │                     │ Memory (connection pools, query buffers) │
  ├─────────────────────┼───────────────────────────────────────────┤
  │ 8. Send response    │ Compilation (optimized machine code),    │
  │                     │ Types (JSON serialization), Binary       │
  │                     │ (TLS encryption)                         │
  ├─────────────────────┼───────────────────────────────────────────┤
  │ 9. Browser renders  │ ALL OF THEM. The browser is a microcosm  │
  │                     │ of everything: JIT compilation, GC,      │
  │                     │ heap allocation, concurrency, binary     │
  │                     │ image decoding, type systems, processes. │
  └─────────────────────┴───────────────────────────────────────────┘
```

---

## The "So What" — Why This All Matters

You might wonder: do I really need to know all this to write a web app?

**No.** You can build things without understanding any of it — the same way you can drive
a car without understanding combustion engines.

But here's what understanding buys you:

1. **Debugging power.** When your server is slow, you can reason about *why*. Is it GC
   pauses? Lock contention? Algorithmic complexity? Memory leaks? Without fundamentals,
   you're guessing. With them, you're diagnosing.

2. **Better design decisions.** Should we use Go or Rust for this service? The answer
   depends on whether GC pauses matter, whether memory usage is constrained, whether you
   need fine-grained concurrency control. Now you can reason about those trade-offs.

3. **Security awareness.** Buffer overflows, integer overflows, race conditions — these
   are the root cause of most security vulnerabilities. Understanding memory layout and
   type representation helps you avoid them.

4. **Performance intuition.** You won't need to profile every function to know that nested
   loops over a million items will be slow. You'll feel it. And when profiling confirms
   your intuition, you'll know exactly what to change.

5. **Communication with your team.** When a senior engineer says "we're seeing contention
   on the mutex in the connection pool," you'll know what every word means and can
   contribute to the solution.

The fundamentals are like a chef understanding chemistry. You don't think about Maillard
reactions every time you sear a steak — but when something goes wrong, or when you want
to innovate, that knowledge is what separates you from someone who only follows recipes.

---

## Exercises

### Exercise 1: Trace a Real Request
Open your browser's developer tools (F12), go to the Network tab, and visit any website.
Pick one request and identify:
- The DNS lookup time (if shown)
- The TCP connection time
- The TLS handshake time
- The time waiting for the server response (TTFB)
- The response size in bytes

What percentage of total time is network vs. server processing?

### Exercise 2: Build a Tiny HTTP Server
Write a simple HTTP server in Go or Python that:
1. Listens on port 8080
2. Handles `GET /users/:id` requests
3. Stores users in a hash map (in-memory "database")
4. Returns JSON responses
5. Logs the PID, goroutine/thread count, and memory usage with each request

```python
# Starter code:
from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os

users = {
    "42": {"id": 42, "name": "Alice", "email": "alice@example.com"},
    "99": {"id": 99, "name": "Bob", "email": "bob@example.com"},
}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse the user ID from the path
        # Look up in the hash map
        # Return JSON or 404
        pass

print(f"Server PID: {os.getpid()}")
HTTPServer(("", 8080), Handler).serve_forever()
```

### Exercise 3: Failure Mode Analysis
For each scenario, identify which CS fundamental is involved and what would happen:

1. Your server allocates a 1 MB buffer per request and never frees it.
2. Two goroutines read and write a shared `map` without a mutex.
3. Your API returns a 64-bit integer ID, and the JavaScript client loses precision.
4. Your database query does a full table scan on 50 million rows.
5. Your server doesn't handle SIGTERM and gets killed during a database write.

### Exercise 4: The Optimization Challenge
You have a slow API endpoint. Profile it (or reason through it) given this pseudocode:

```
function getPopularPosts(allPosts):
    result = []
    for post in allPosts:                    // n = 1,000,000 posts
        for comment in post.comments:        // avg 50 comments each
            if comment.likes > 100:
                if post not in result:       // "not in" on a list = O(n)!
                    result.append(post)
    sort(result, by=post.date)
    return result[:10]
```

What's the Big-O? Identify the bottleneck. Rewrite it to be fast. (Hint: hash set for
deduplication, early termination, sorting only the candidates.)

### Exercise 5: End-to-End Build
Build a complete (tiny) system that exercises multiple fundamentals:
1. A Rust or Go server that handles requests (processes, compilation)
2. An in-memory data store using a hash map (algorithms, memory)
3. Proper signal handling for graceful shutdown (processes, signals)
4. A `/stats` endpoint showing memory usage and uptime (memory, types)
5. Concurrent request handling (concurrency)
6. Proper error responses with typed error codes (types)

### Exercise 6: Teach It Back
Pick any three steps from the request journey and explain them to someone who has never
programmed. Use only analogies — no technical jargon. This is the deepest test of
understanding: if you can explain it simply, you truly understand it.

---

## Summary — The Full Track in One Page

```
  Lesson  1: Types           → The shape of data. Integers, floats, booleans, strings.
  Lesson  2: Binary          → How data is encoded as 1s and 0s in memory and on the wire.
  Lesson  3: Memory Layout   → Stack vs. heap. Where data lives and how it's organized.
  Lesson  4: Pointers        → Addresses in memory. References, indirection, null.
  Lesson  5: The Stack       → Function calls, stack frames, recursion, stack overflow.
  Lesson  6: The Heap        → Dynamic allocation. malloc/free, new/delete, lifetimes.
  Lesson  7: Garbage Collect. → Automatic cleanup. Tracing, reference counting, ownership.
  Lesson  8: Compilation     → Source code → machine code. Compilers, interpreters, JIT.
  Lesson  9: Concurrency     → Doing multiple things. Threads, async, locks, channels.
  Lesson 10: Processes       → Running programs. fork, exec, signals, file descriptors.
  Lesson 11: Algorithms      → Efficiency. Big-O, trade-offs, choosing the right approach.
  Lesson 12: Full Picture    → Everything working together in a real system.
```

These twelve lessons don't make you an expert in any one area. They give you a **mental
model** of the entire system — from the bits in memory to the processes on the OS to the
packets on the wire. With this foundation, every new technology you learn will click into
place faster, because you understand the substrate it's built on.

The recipe book is now yours. Go cook something.
