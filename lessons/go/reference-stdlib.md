# Go Standard Library: Most Useful Packages

## Tier 1: Use Daily

### fmt — Formatted I/O

```go
fmt.Println("hello")
fmt.Printf("name: %s, age: %d\n", name, age)
fmt.Sprintf("formatted %s", value)
fmt.Fprintf(writer, "to writer: %s", value)
fmt.Errorf("wrapped: %w", err)
```

```
%v    default format
%+v   struct with field names
%#v   Go syntax representation
%T    type
%d    integer
%f    float
%s    string
%q    quoted string
%p    pointer
%t    bool
%x    hex
%%    literal %
```

### errors — Error Creation and Inspection

```go
errors.New("something failed")
fmt.Errorf("context: %w", err)
errors.Is(err, target)
errors.As(err, &target)
errors.Join(err1, err2)
errors.Unwrap(err)
```

### strings — String Manipulation

```go
strings.Contains(s, substr)
strings.HasPrefix(s, prefix)
strings.HasSuffix(s, suffix)
strings.Index(s, substr)
strings.Split(s, sep)
strings.Join(elems, sep)
strings.TrimSpace(s)
strings.Trim(s, cutset)
strings.ToLower(s)
strings.ToUpper(s)
strings.ReplaceAll(s, old, new)
strings.NewReader(s)
strings.Builder{}
strings.Map(fn, s)
strings.Count(s, substr)
strings.EqualFold(a, b)           // case-insensitive
strings.NewReplacer(pairs...).Replace(s)
```

### strconv — String Conversions

```go
strconv.Atoi("42")                // string -> int
strconv.Itoa(42)                  // int -> string
strconv.ParseFloat("3.14", 64)   // string -> float64
strconv.ParseBool("true")        // string -> bool
strconv.FormatFloat(3.14, 'f', 2, 64)
strconv.FormatInt(42, 16)        // int -> hex string
```

---

## Tier 2: Use Weekly

### encoding/json — JSON Encode/Decode

```go
json.Marshal(v)
json.MarshalIndent(v, "", "  ")
json.Unmarshal(data, &v)
json.NewEncoder(w).Encode(v)
json.NewDecoder(r).Decode(&v)
json.Valid(data)
```

Struct tags:
```
`json:"name"`             field name
`json:"name,omitempty"`   omit if zero
`json:"-"`                skip always
`json:",string"`          encode number as string
```

### net/http — HTTP Client and Server

Client:
```go
http.Get(url)
http.Post(url, contentType, body)
http.NewRequest(method, url, body)
client := &http.Client{Timeout: 10 * time.Second}
client.Do(req)
```

Server:
```go
http.HandleFunc(pattern, handler)
http.ListenAndServe(addr, handler)
http.NewServeMux()
http.Error(w, msg, code)
http.Redirect(w, r, url, code)
http.FileServer(http.Dir("./static"))
```

Testing:
```go
httptest.NewServer(handler)
httptest.NewRecorder()
httptest.NewRequest(method, url, body)
```

### os — Operating System Interface

```go
os.ReadFile(name)
os.WriteFile(name, data, perm)
os.Open(name)
os.Create(name)
os.Mkdir(name, perm)
os.MkdirAll(path, perm)
os.Remove(name)
os.RemoveAll(path)
os.Rename(old, new)
os.ReadDir(name)
os.Stat(name)
os.Getenv(key)
os.LookupEnv(key)
os.Setenv(key, value)
os.UserHomeDir()
os.Exit(code)
os.Args
os.Stdin / os.Stdout / os.Stderr
```

### io — Core I/O Interfaces

```go
io.ReadAll(r)
io.Copy(dst, src)
io.CopyN(dst, src, n)
io.NopCloser(r)
io.LimitReader(r, n)
io.TeeReader(r, w)
io.MultiReader(readers...)
io.MultiWriter(writers...)
io.Pipe()
io.EOF
io.Discard
```

### context — Cancellation and Deadlines

```go
context.Background()
context.TODO()
context.WithCancel(parent)
context.WithTimeout(parent, duration)
context.WithDeadline(parent, time)
context.WithValue(parent, key, val)
context.AfterFunc(ctx, fn)
```

### sync — Synchronization Primitives

```go
sync.Mutex{}           / .Lock() / .Unlock()
sync.RWMutex{}         / .RLock() / .RUnlock()
sync.WaitGroup{}       / .Add(n) / .Done() / .Wait()
sync.Once{}            / .Do(fn)
sync.Map{}             / .Load() / .Store() / .Delete()
sync.Pool{}            / .Get() / .Put()
sync.Cond{}            / .Wait() / .Signal() / .Broadcast()
```

---

## Tier 3: Use When Needed

### time — Time and Duration

```go
time.Now()
time.Since(start)
time.Until(deadline)
time.Sleep(d)
time.After(d)
time.NewTicker(d)
time.NewTimer(d)
time.Parse(layout, value)
t.Format(layout)
t.Add(d)
t.Sub(other)
t.Before(other) / t.After(other)
t.Unix() / t.UnixMilli()
time.Duration
time.Second / time.Minute / time.Hour
```

Reference time: `Mon Jan 2 15:04:05 MST 2006`

### path/filepath — File Path Manipulation

```go
filepath.Join(parts...)
filepath.Dir(path)
filepath.Base(path)
filepath.Ext(path)
filepath.Abs(path)
filepath.Walk(root, fn)
filepath.WalkDir(root, fn)  // preferred over Walk
filepath.Glob(pattern)
filepath.Match(pattern, name)
filepath.Rel(basepath, targetpath)
```

### sort / slices — Sorting

```go
sort.Ints(s)
sort.Strings(s)
sort.Slice(s, func(i, j int) bool { ... })
sort.Search(n, func(i int) bool { ... })

slices.Sort(s)           // Go 1.21+
slices.SortFunc(s, cmp)
slices.Contains(s, v)
slices.Index(s, v)
slices.Compact(s)
```

### maps — Map Utilities (Go 1.21+)

```go
maps.Keys(m)
maps.Values(m)
maps.Clone(m)
maps.Equal(m1, m2)
maps.DeleteFunc(m, fn)
```

### regexp — Regular Expressions

```go
regexp.MatchString(pattern, s)
re := regexp.MustCompile(pattern)
re.FindString(s)
re.FindAllString(s, n)
re.ReplaceAllString(s, repl)
re.FindStringSubmatch(s)
```

### log/slog — Structured Logging (Go 1.21+)

```go
slog.Info("msg", "key", "value")
slog.Error("msg", "err", err)
slog.Debug("msg", "key", "value")
slog.With("key", "value")
slog.New(slog.NewJSONHandler(w, opts))
slog.New(slog.NewTextHandler(w, opts))
```

### bufio — Buffered I/O

```go
scanner := bufio.NewScanner(reader)
for scanner.Scan() {
    line := scanner.Text()
}
err := scanner.Err()

reader := bufio.NewReader(r)
line, err := reader.ReadString('\n')

writer := bufio.NewWriter(w)
writer.WriteString("hello")
writer.Flush()
```

### bytes — Byte Slice Operations

```go
bytes.Contains(b, sub)
bytes.Equal(a, b)
bytes.Join(slices, sep)
bytes.Split(b, sep)
bytes.TrimSpace(b)
bytes.NewReader(b)
bytes.NewBuffer(b)
bytes.Buffer{}
```

### text/template — Text Templates

```go
tmpl := template.Must(template.New("t").Parse("Hello {{.Name}}"))
tmpl.Execute(writer, data)
```

### embed — Embed Files in Binary

```go
//go:embed static/*
var staticFiles embed.FS

//go:embed version.txt
var version string
```

### crypto — Hashing

```go
h := sha256.New()
h.Write(data)
hash := h.Sum(nil)
hex.EncodeToString(hash)
```

---

## Package Decision Tree

```
Need to...                       Use...
+---------------------------------+------------------------+
| Work with strings               | strings, strconv       |
| Work with byte slices           | bytes                  |
| Read/write files                | os, io, bufio          |
| Parse/create JSON               | encoding/json          |
| HTTP client/server              | net/http               |
| Handle time/dates               | time                   |
| Manage paths                    | path/filepath          |
| Sort data                       | sort, slices           |
| Regular expressions             | regexp                 |
| Structured logging              | log/slog               |
| Synchronization                 | sync, context          |
| Embed static files              | embed                  |
| Generate random numbers         | math/rand/v2, crypto   |
| Text templates                  | text/template          |
| Command-line flags              | flag                   |
| Run external commands           | os/exec                |
| Compress/decompress             | compress/gzip          |
| Work with CSV                   | encoding/csv           |
| XML parsing                     | encoding/xml           |
| Base64 encoding                 | encoding/base64        |
+---------------------------------+------------------------+
```

---

[Back to Roadmap](00-roadmap.md)
