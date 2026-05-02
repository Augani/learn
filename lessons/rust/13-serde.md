# Lesson 13: Serialization with Serde

Serde is Rust's main serialization framework for JSON, YAML, TOML, and
other formats. It lets you convert between Rust types and serialized data
while keeping the shape of that data explicit in your types.

---

## Setup

Add to `Cargo.toml`:
```bash
cargo add serde --features derive
cargo add serde_json
```

---

## Basic Serialization/Deserialization

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct User {
    name: String,
    email: String,
    age: u32,
    active: bool,
}

fn main() -> serde_json::Result<()> {
    let user = User {
        name: "Augustus".to_string(),
        email: "aug@example.com".to_string(),
        age: 30,
        active: true,
    };

    // Serialize to JSON string
    let json = serde_json::to_string(&user)?;
    println!("{json}");
    // {"name":"Augustus","email":"aug@example.com","age":30,"active":true}

    // Pretty print
    let pretty = serde_json::to_string_pretty(&user)?;
    println!("{pretty}");

    // Deserialize from JSON string
    let json_str = r#"{"name":"Bob","email":"bob@test.com","age":25,"active":false}"#;
    let parsed: User = serde_json::from_str(json_str)?;
    println!("{parsed:?}");

    Ok(())
}
```

**Go equivalent:**
```go
type User struct {
    Name   string `json:"name"`
    Email  string `json:"email"`
    Age    uint32 `json:"age"`
    Active bool   `json:"active"`
}

data, _ := json.Marshal(user)
json.Unmarshal(data, &user)
```

Notice: Rust uses lowercase field names automatically (serde's default).
Go requires struct tags.

---

## Field Attributes

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct ApiResponse {
    #[serde(rename = "userId")]
    user_id: u64,

    #[serde(rename = "firstName")]
    first_name: String,

    #[serde(default)]
    score: f64,

    #[serde(skip_serializing_if = "Option::is_none")]
    nickname: Option<String>,

    #[serde(skip)]
    internal_cache: String,

    #[serde(alias = "email_address")]
    email: String,
}
```

| Attribute | What it does | Go equivalent |
|-----------|-------------|---------------|
| `#[serde(rename = "x")]` | JSON key name | `` `json:"x"` `` |
| `#[serde(default)]` | Use Default if missing | (manual check) |
| `#[serde(skip)]` | Don't serialize/deserialize | `` `json:"-"` `` |
| `#[serde(skip_serializing_if = "...")]` | Omit if condition met | `` `json:",omitempty"` `` |
| `#[serde(alias = "x")]` | Accept alternate name | (not available) |
| `#[serde(flatten)]` | Inline nested struct | (embedded struct) |

### Rename all fields

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Config {
    database_url: String,      // serializes as "databaseUrl"
    max_connections: u32,      // serializes as "maxConnections"
}

// Other options: "snake_case", "SCREAMING_SNAKE_CASE", "kebab-case", "PascalCase"
```

---

## Enums with Serde

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum Message {
    #[serde(rename = "text")]
    Text { content: String },

    #[serde(rename = "image")]
    Image { url: String, width: u32, height: u32 },

    #[serde(rename = "system")]
    System { content: String },
}

fn main() -> serde_json::Result<()> {
    let msg = Message::Text { content: "hello".to_string() };
    let json = serde_json::to_string(&msg)?;
    println!("{json}");
    // {"type":"text","content":"hello"}

    let input = r#"{"type":"image","url":"pic.png","width":100,"height":200}"#;
    let parsed: Message = serde_json::from_str(input)?;
    println!("{parsed:?}");

    Ok(())
}
```

**TS equivalent:** This is like discriminated unions:
```typescript
type Message =
  | { type: "text"; content: string }
  | { type: "image"; url: string; width: number; height: number }
```

### Enum tagging styles

| Style | Attribute | JSON output |
|-------|-----------|-------------|
| Externally tagged (default) | (none) | `{"Text": {"content": "hi"}}` |
| Internally tagged | `#[serde(tag = "type")]` | `{"type": "Text", "content": "hi"}` |
| Adjacently tagged | `#[serde(tag = "t", content = "c")]` | `{"t": "Text", "c": {"content": "hi"}}` |
| Untagged | `#[serde(untagged)]` | `{"content": "hi"}` (tries each variant) |

---

## Working with Dynamic JSON

When you don't know the shape ahead of time:

```rust
use serde_json::Value;

fn main() -> serde_json::Result<()> {
    let data: Value = serde_json::from_str(r#"{"name": "Augustus", "scores": [90, 85]}"#)?;

    let name = data["name"].as_str().unwrap_or("unknown");
    let first_score = data["scores"][0].as_i64();

    println!("Name: {name}");
    println!("Score: {first_score:?}");

    // Build JSON dynamically
    let dynamic = serde_json::json!({
        "status": "ok",
        "count": 42,
        "items": ["a", "b", "c"]
    });
    println!("{}", serde_json::to_string_pretty(&dynamic)?);

    Ok(())
}
```

**TS equivalent:** Working with `any` — lose type safety, gain flexibility.

---

## Custom Serialization

```rust
use serde::{Deserialize, Serialize, Serializer, Deserializer};

#[derive(Debug)]
struct Timestamp(i64);

impl Serialize for Timestamp {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&format!("{}ms", self.0))
    }
}

impl<'de> Deserialize<'de> for Timestamp {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        let num = s.trim_end_matches("ms")
            .parse::<i64>()
            .map_err(serde::de::Error::custom)?;
        Ok(Timestamp(num))
    }
}
```

---

## Exercises

### Exercise 1: API response type
```rust
// Define a struct for this JSON and deserialize it:
// {
//   "id": 1,
//   "title": "Hello World",
//   "tags": ["rust", "programming"],
//   "metadata": {
//     "author": "Augustus",
//     "published": true
//   }
// }
```

### Exercise 2: Enum serialization
```rust
// Define a tagged enum for API events:
// {"event": "login", "user_id": 123}
// {"event": "purchase", "item": "book", "price": 29.99}
// {"event": "logout", "user_id": 123}
```

---

## Key Takeaways

1. **`#[derive(Serialize, Deserialize)]`** handles 90% of cases.
2. **`#[serde(rename_all = "camelCase")]`** for API compatibility.
3. **`#[serde(tag = "type")]`** for discriminated union JSON.
4. **`serde_json::Value`** for dynamic JSON (like Go's `map[string]interface{}`).
5. **`serde_json::json!()`** macro for building JSON inline.
6. **Coming from Go:** No struct tags needed — serde derives everything.
   `rename` attributes replace `` `json:"name"` `` tags.

Next: [Lesson 14 — Smart Pointers](./14-smart-pointers.md)
