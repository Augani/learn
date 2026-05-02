# Lesson 16: Serialization Formats -- JSON, Protobuf, MessagePack, CBOR

Every time data crosses a boundary -- network, disk, process -- it must be
converted from in-memory structures to a sequence of bytes and back. This
conversion is serialization (to bytes) and deserialization (from bytes). The
format you choose affects speed, size, debuggability, and interoperability.

---

## What Is Serialization?

Serialization is translating a data structure into a format that can be
stored or transmitted and later reconstructed.

```
In-Memory Struct                      Bytes on the Wire
+------------------+                  +------------------+
| User {           |  serialize -->   | 7b 22 69 64 22   |
|   id: 42,        |                  | 3a 34 32 2c ...  |
|   name: "Alice", |  <-- deserialize | ...              |
|   active: true   |                  +------------------+
| }                |
+------------------+

The bytes might be:
  JSON:     {"id":42,"name":"Alice","active":true}
  Protobuf: 08 2a 12 05 41 6c 69 63 65 18 01
  MsgPack:  83 a2 69 64 2a a4 6e 61 6d 65 a5 ...
```

### The Analogy

Think of serialization as packing a suitcase. Your clothes (data) exist in a
closet (memory) in a convenient arrangement. To travel (transmit), you must
pack them into a suitcase (byte format). Different suitcases have different
trade-offs: a transparent suitcase (JSON) lets anyone see what is inside, but
wastes space. A vacuum-sealed bag (protobuf) is compact but you need the
right tool to unpack it.

---

## Text Formats

### JSON (JavaScript Object Notation)

The universal format for web APIs and configuration that needs to be human-
readable.

```json
{
  "id": 42,
  "name": "Alice Chen",
  "email": "alice@example.com",
  "roles": ["admin", "developer"],
  "settings": {
    "theme": "dark",
    "notifications": true
  }
}
```

**Strengths:**
- Human readable and writable
- Every language has a JSON library
- Every browser understands it natively
- Easy to debug (just print it)
- Self-describing (field names are in the data)

**Weaknesses:**
- Verbose (field names repeated in every message)
- Slow to parse (text scanning, string allocation)
- Numbers have no fixed type (is 42 an i32? u64? f64?)
- No binary data support (must base64-encode)
- No schema enforcement (the format does not tell you what fields are required)

**When to use:** Public APIs, browser communication, configuration files,
anything where a human might read the data.

### YAML / TOML

Configuration formats, not wire formats. Rarely used for network communication.

```yaml
# YAML -- popular for Kubernetes, CI/CD configs
server:
  host: "0.0.0.0"
  port: 8080
  workers: 4
```

```toml
# TOML -- popular for Rust (Cargo.toml), Python (pyproject.toml)
[server]
host = "0.0.0.0"
port = 8080
workers = 4
```

---

## Binary Formats

### Protocol Buffers (protobuf)

Google's schema-based binary format. Covered in depth in Lesson 11. The key
points for comparison:

```protobuf
message User {
  uint64 id = 1;
  string name = 2;
  string email = 3;
  repeated string roles = 4;
}
```

```
Wire format for User{id:42, name:"Alice"}:

Field 1 (id), varint:   08 2a           (2 bytes for key+value)
Field 2 (name), string: 12 05 41 6c 69 63 65  (7 bytes: key + length + "Alice")

Total: 9 bytes  vs  JSON: ~30 bytes
```

**Strengths:**
- Very compact (2-10x smaller than JSON)
- Very fast to parse (no text scanning)
- Strong typing via schema
- Code generation for every major language
- Backward/forward compatible (add fields without breaking old code)

**Weaknesses:**
- Not human readable (binary)
- Requires a schema (`.proto` file) to decode
- Code generation step adds build complexity
- Not self-describing (without the schema, the bytes are meaningless)

**When to use:** Internal service-to-service communication, gRPC, storage of
structured data where space and speed matter.

### MessagePack

"Like JSON but binary." No schema needed -- the format is self-describing
like JSON, but encoded in binary for compactness and speed.

```
JSON:     {"id":42,"name":"Alice","active":true}
          44 bytes (ASCII text)

MessagePack equivalent:
          83                     (fixmap, 3 entries)
          a2 69 64               (fixstr "id")
          2a                     (positive fixint 42)
          a4 6e 61 6d 65         (fixstr "name")
          a5 41 6c 69 63 65      (fixstr "Alice")
          a6 61 63 74 69 76 65   (fixstr "active")
          c3                     (true)
          ~27 bytes
```

**Strengths:**
- ~30-50% smaller than JSON
- Faster to parse than JSON
- No schema required (self-describing)
- Drop-in replacement for JSON in many cases
- Supports binary data natively

**Weaknesses:**
- Not human readable
- Larger than protobuf (field names still in the data)
- Less tooling than JSON or protobuf
- Less type safety (no schema validation)

**When to use:** When you want something smaller/faster than JSON but do not
want to define schemas. Good for caching, logging, and internal messages.

### CBOR (Concise Binary Object Representation)

IETF standard (RFC 8949). Similar to MessagePack but with more features:
deterministic encoding, tags for dates/bigints/URIs, and a formal spec.

```
JSON:     {"id":42,"name":"Alice"}
CBOR:     a2 62 69 64 18 2a 64 6e 61 6d 65 65 41 6c 69 63 65
          ~17 bytes
```

**Strengths:**
- IETF standard (important for compliance-sensitive environments)
- Deterministic encoding (same data always produces same bytes)
- Rich type system (dates, bignums, URIs via tags)
- Self-describing

**Weaknesses:**
- Similar to MessagePack in most practical aspects
- Slightly less community adoption than MessagePack
- Not human readable

**When to use:** IoT (CBOR is the encoding for COSE and CWT, used in IoT
security), FIDO2/WebAuthn (attestation data), and anywhere an IETF standard
is required.

### FlatBuffers

Google's zero-copy serialization format. The serialized data can be accessed
directly without parsing/unpacking.

```
Traditional deserialization:
  bytes --> allocate struct --> copy fields into struct --> use struct

FlatBuffers:
  bytes --> use bytes directly (fields accessed by offset)
```

**Strengths:**
- Zero-copy access (no deserialization step)
- Extremely fast for read-heavy workloads
- Good for memory-mapped files

**Weaknesses:**
- Larger than protobuf on the wire
- More complex API
- Less widely adopted
- Schema required

**When to use:** Game engines, performance-critical applications where you
read data far more often than you write it.

### bincode

A Rust-specific binary format that directly serializes Rust types. Not
cross-language, but extremely fast and compact within Rust ecosystems.

```rust
// bincode can serialize any type that implements serde::Serialize
let bytes = bincode::serialize(&user).unwrap();
let user: User = bincode::deserialize(&bytes).unwrap();
```

**When to use:** Rust-to-Rust communication, caching, IPC between Rust
processes.

---

## Comparison Table

```
+---------------+-------+-------+---------+----------+-----------+
| Format        | Size  | Speed | Schema  | Human    | Language  |
|               |       |       | needed? | readable | support   |
+---------------+-------+-------+---------+----------+-----------+
| JSON          | Large | Slow  | No      | Yes      | Universal |
| YAML          | Large | Slow  | No      | Yes      | Wide      |
| MessagePack   | Med   | Fast  | No      | No       | Wide      |
| CBOR          | Med   | Fast  | No      | No       | Wide      |
| Protobuf      | Small | Fast  | Yes     | No       | Wide      |
| FlatBuffers   | Med   | V.Fast| Yes     | No       | Moderate  |
| bincode       | Small | V.Fast| No*     | No       | Rust only |
+---------------+-------+-------+---------+----------+-----------+

* bincode uses Rust's type system as an implicit schema
```

### Size Comparison (Same Data)

For a typical `User` struct with 5 fields:

```
JSON:        ~95 bytes
YAML:        ~75 bytes
MessagePack: ~55 bytes
CBOR:        ~50 bytes
Protobuf:    ~35 bytes
bincode:     ~30 bytes
```

Exact sizes depend on the data, but the ratios are representative.

---

## When to Use What

```
                         Need human readability?
                        /                       \
                      Yes                        No
                      /                            \
              Public API?                    Internal service?
              /         \                    /              \
           Yes           No              Yes                No
            |             |               |                  |
          JSON          TOML/YAML     Protobuf           Need schema?
       (web APIs)     (config files)  (gRPC)             /          \
                                                       Yes          No
                                                        |            |
                                                    Protobuf     MessagePack
                                                                 or CBOR
                                                                 or bincode
```

**Simple rules:**
- Public-facing API? JSON.
- Configuration file? TOML or YAML.
- Internal services with gRPC? Protobuf.
- Fast binary without schemas? MessagePack or bincode.
- IoT or standards compliance? CBOR.
- Maximum read performance? FlatBuffers.

---

## Rust and serde: One Interface, Every Format

Rust's `serde` crate provides a single serialization/deserialization
framework. You derive `Serialize` and `Deserialize` on your types once,
then use any format:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct User {
    id: u64,
    name: String,
    email: String,
    active: bool,
    roles: Vec<String>,
}
```

### Cargo.toml

```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rmp-serde = "1"          # MessagePack
ciborium = "0.2"          # CBOR
bincode = "1"
```

### Serializing to Every Format

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct User {
    id: u64,
    name: String,
    email: String,
    active: bool,
    roles: Vec<String>,
}

fn main() {
    let user = User {
        id: 42,
        name: "Alice Chen".to_string(),
        email: "alice@example.com".to_string(),
        active: true,
        roles: vec!["admin".to_string(), "developer".to_string()],
    };

    let json_bytes = serde_json::to_vec(&user).unwrap();
    println!("JSON:        {} bytes", json_bytes.len());
    println!("  {}", String::from_utf8_lossy(&json_bytes));

    let msgpack_bytes = rmp_serde::to_vec(&user).unwrap();
    println!("MessagePack: {} bytes", msgpack_bytes.len());

    let mut cbor_bytes = Vec::new();
    ciborium::into_writer(&user, &mut cbor_bytes).unwrap();
    println!("CBOR:        {} bytes", cbor_bytes.len());

    let bincode_bytes = bincode::serialize(&user).unwrap();
    println!("bincode:     {} bytes", bincode_bytes.len());

    println!();

    let from_json: User = serde_json::from_slice(&json_bytes).unwrap();
    let from_msgpack: User = rmp_serde::from_slice(&msgpack_bytes).unwrap();
    let from_cbor: User = ciborium::from_reader(&cbor_bytes[..]).unwrap();
    let from_bincode: User = bincode::deserialize(&bincode_bytes).unwrap();

    assert_eq!(from_json, user);
    assert_eq!(from_msgpack, user);
    assert_eq!(from_cbor, user);
    assert_eq!(from_bincode, user);

    println!("All formats round-trip correctly.");
}
```

### Expected Output

```
JSON:        95 bytes
  {"id":42,"name":"Alice Chen","email":"alice@example.com","active":true,"roles":["admin","developer"]}
MessagePack: 73 bytes
CBOR:        75 bytes
bincode:     63 bytes

All formats round-trip correctly.
```

---

## Benchmarking Serialization Speed

```rust
use std::time::Instant;

fn bench<F: Fn() -> Vec<u8>>(name: &str, iterations: u64, f: F) {
    let start = Instant::now();
    let mut total_bytes = 0;
    for _ in 0..iterations {
        let bytes = f();
        total_bytes += bytes.len();
    }
    let elapsed = start.elapsed();
    let per_op = elapsed / iterations as u32;
    println!(
        "{:12} {:>8} ops  {:>10?} total  {:>8?}/op  {} bytes/msg",
        name,
        iterations,
        elapsed,
        per_op,
        total_bytes / iterations as usize,
    );
}

fn main() {
    let user = User {
        id: 42,
        name: "Alice Chen".to_string(),
        email: "alice@example.com".to_string(),
        active: true,
        roles: vec!["admin".to_string(), "developer".to_string()],
    };

    let iterations = 1_000_000;

    println!("Serialization benchmark ({} iterations):", iterations);
    bench("JSON", iterations, || serde_json::to_vec(&user).unwrap());
    bench("MessagePack", iterations, || rmp_serde::to_vec(&user).unwrap());
    bench("bincode", iterations, || bincode::serialize(&user).unwrap());
    bench("CBOR", iterations, || {
        let mut buf = Vec::new();
        ciborium::into_writer(&user, &mut buf).unwrap();
        buf
    });
}
```

Typical results (relative, varies by machine):

```
Serialization benchmark (1000000 iterations):
JSON             1000000 ops     450ms total      450ns/op  95 bytes/msg
MessagePack      1000000 ops     280ms total      280ns/op  73 bytes/msg
bincode          1000000 ops     120ms total      120ns/op  63 bytes/msg
CBOR             1000000 ops     310ms total      310ns/op  75 bytes/msg
```

bincode is fastest because it skips field names entirely and uses a fixed,
predictable encoding. JSON is slowest because it must format numbers as text
and quote every string and field name.

---

## Schema Evolution: Adding and Removing Fields

A critical concern: what happens when you add a field to a struct but old
data (or old services) uses the old format?

### JSON

JSON is naturally flexible. Missing fields can be handled with `Option`:

```rust
#[derive(Deserialize)]
struct User {
    id: u64,
    name: String,
    avatar_url: Option<String>,  // new field, absent in old data
}
```

Old JSON `{"id":42,"name":"Alice"}` deserializes fine -- `avatar_url` is
`None`.

### Protobuf

Protobuf is designed for evolution. Unknown fields are preserved, not
rejected:

```protobuf
// v1
message User {
  uint64 id = 1;
  string name = 2;
}

// v2 (backward compatible)
message User {
  uint64 id = 1;
  string name = 2;
  string avatar_url = 3;  // new field, old clients ignore it
}
```

Rule: never reuse or change field numbers. Old code ignores unknown field
numbers. New code treats missing fields as default values.

### MessagePack / CBOR

Same as JSON: schema-less, so missing fields are simply absent. Use `Option`
in Rust.

### bincode

bincode has no field names or field numbers. It encodes fields in declaration
order. **Adding or removing fields breaks backward compatibility.** Only use
bincode when both sides are compiled from the same Rust code (same binary,
IPC, or caching within a single service).

---

## Exercises

1. **Size comparison.** Create a `Product` struct with these fields:
   `id: u64`, `name: String`, `price_cents: u64`, `category: String`,
   `tags: Vec<String>` (with 3 tags), `in_stock: bool`.
   Serialize it in JSON, MessagePack, CBOR, and bincode. Print the byte
   sizes. Which format is smallest? By how much?

2. **Speed benchmark.** Using the benchmarking code above, measure
   serialization and deserialization speed for all four formats. Which is
   fastest? Is the fastest for serialization also the fastest for
   deserialization?

3. **Round-trip verification.** Serialize the `Product` struct to each
   format, then deserialize back and assert equality. This proves your
   serde derives are correct.

4. **Schema evolution.** Serialize a `User` with fields `{id, name}` to
   JSON. Then add a new field `email: Option<String>` to the struct and
   deserialize the old JSON. Verify it works (email should be `None`). Try
   the same with bincode. What happens?

5. **Inspect binary formats.** Serialize a simple struct to MessagePack and
   print the raw bytes as hex. Try to decode them manually using the
   MessagePack spec. Identify the type markers, field names, and values in
   the byte stream.

6. **Network integration.** Build a TCP client and server where the client
   serializes a `Message` struct using MessagePack, sends the length-prefixed
   bytes over TCP, and the server deserializes it. Compare with sending JSON
   over the same connection. Measure the difference in throughput.

---

Next: [Lesson 17: Load Balancing, Proxies, and CDNs](./17-load-balancing.md)
