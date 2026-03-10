# Lesson 04: Text Processing — grep, sed, awk, jq

In Unix, text is the universal interface. Configuration files are text. Logs are text. Command output is text. The tools in this lesson let you search, transform, and analyze text at the command line faster than opening an editor or writing a script.

---

## grep: Search for Patterns

`grep` searches for lines matching a pattern and prints them. The name stands for "Global Regular Expression Print."

### Basic usage

```bash
grep "error" logfile.txt           # lines containing "error"
grep "error" *.log                 # search across multiple files
grep -r "TODO" src/                # recursive search in directory
grep -ri "todo" src/               # recursive + case-insensitive
```

### Essential flags

```bash
grep -i "error" file              # case-insensitive match
grep -v "debug" file              # invert: lines NOT matching
grep -c "error" file              # count of matching lines
grep -n "error" file              # show line numbers
grep -l "error" *.log             # list filenames with matches (not the lines)
grep -L "error" *.log             # list filenames WITHOUT matches
grep -w "error" file              # match whole words only ("error" but not "errors")
grep -o "error" file              # print only the matched part, not the whole line
```

### Context: show surrounding lines

```bash
grep -A 3 "FATAL" file            # 3 lines After each match
grep -B 2 "FATAL" file            # 2 lines Before each match
grep -C 2 "FATAL" file            # 2 lines of Context (before and after)
```

### Regular expressions

```bash
grep "^Start" file                # lines starting with "Start"
grep "end$" file                  # lines ending with "end"
grep "^$" file                    # empty lines
grep -E "[0-9]{3}\.[0-9]{3}" f    # extended regex: IP-like pattern
grep -E "error|warning|fatal" f   # multiple patterns (OR)
grep -E "^(GET|POST) " file      # GET or POST at start of line
```

Use `-E` (or `egrep`) for extended regex. Without it, you need to escape special characters: `\|`, `\(`, `\{`.

### Useful patterns

```bash
grep -rn "func.*Error" --include="*.go" .       # Go error functions
grep -rn "TODO\|FIXME\|HACK" src/               # find all code markers
grep -c "" file                                  # count total lines (every line matches empty pattern)
grep -rl "deprecated" --include="*.rs" src/      # Rust files with "deprecated"
```

---

## sed: Stream Editor

`sed` processes text line by line, applying transformations. Most commonly used for find-and-replace.

### Substitution

```bash
sed 's/old/new/' file             # replace first "old" per line
sed 's/old/new/g' file            # replace ALL occurrences per line
sed 's/old/new/gi' file           # case-insensitive replace (GNU sed)
```

**macOS vs Linux:** In-place editing differs:

```bash
sed -i '' 's/old/new/g' file      # macOS: requires empty string after -i
sed -i 's/old/new/g' file         # Linux: no empty string needed
```

### Address ranges

```bash
sed '5s/old/new/' file            # substitute only on line 5
sed '5,10s/old/new/g' file       # substitute on lines 5-10
sed '/START/,/END/s/old/new/g' f  # substitute between START and END markers
```

### Deleting lines

```bash
sed '/^#/d' file                  # delete comment lines
sed '/^$/d' file                  # delete empty lines
sed '1d' file                     # delete first line
sed '$d' file                     # delete last line
sed '1,5d' file                   # delete lines 1-5
```

### Printing specific lines

```bash
sed -n '5p' file                  # print only line 5
sed -n '5,10p' file               # print lines 5-10
sed -n '/pattern/p' file          # print lines matching pattern (like grep)
```

### Inserting and appending

```bash
sed '1i\Header Line' file        # insert before line 1
sed '$a\Footer Line' file        # append after last line
```

### Practical examples

```bash
# Remove trailing whitespace
sed 's/[[:space:]]*$//' file

# Replace multiple spaces with a single space
sed 's/  */ /g' file

# Extract text between markers
sed -n '/BEGIN/,/END/p' file

# Comment out a line containing a pattern
sed '/pattern/s/^/# /' file

# Add a prefix to every line
sed 's/^/PREFIX: /' file
```

---

## awk: Pattern Scanning and Processing

`awk` is a small programming language designed for processing structured text (columns, records). Think of it as a text processing pipeline where you define what to do for each line.

### Basic column extraction

By default, awk splits each line on whitespace. `$1` is the first column, `$2` the second, and so on. `$0` is the entire line.

```bash
awk '{print $1}' file             # first column
awk '{print $1, $3}' file        # first and third columns
awk '{print $NF}' file           # last column (NF = number of fields)
awk '{print $(NF-1)}' file       # second-to-last column
```

### Custom delimiters

```bash
awk -F',' '{print $2}' data.csv          # comma-delimited
awk -F':' '{print $1}' /etc/passwd       # colon-delimited
awk -F'\t' '{print $1}' data.tsv        # tab-delimited
```

### Built-in variables

| Variable | Meaning |
|----------|---------|
| `$0` | Entire current line |
| `$1..$N` | Column N |
| `NR` | Current line number (record number) |
| `NF` | Number of fields in current line |
| `FS` | Field separator (default: whitespace) |
| `OFS` | Output field separator (default: space) |

```bash
awk '{print NR, $0}' file               # add line numbers
awk 'NR==5' file                         # print only line 5
awk 'NR>=5 && NR<=10' file              # print lines 5-10
awk 'NF>3' file                          # lines with more than 3 fields
```

### Pattern matching

```bash
awk '/error/' file                        # lines containing "error" (like grep)
awk '/error/ {print $1, $4}' file        # extract columns from matching lines
awk '$3 > 100 {print $1, $3}' file       # lines where column 3 > 100
awk '$1 == "admin" {print}' file         # lines where first column is "admin"
```

### BEGIN and END blocks

```bash
# Sum the values in column 3
awk '{sum += $3} END {print "Total:", sum}' file

# Count lines matching a pattern
awk '/ERROR/ {count++} END {print "Errors:", count}' file

# Average of column 2
awk '{sum += $2; n++} END {print "Average:", sum/n}' file

# Print header and footer
awk 'BEGIN {print "Name\tScore"} {print $1 "\t" $2} END {print "---\nDone"}' file
```

### Practical awk examples

```bash
# Print unique values in column 1
awk '!seen[$1]++ {print $1}' file

# Swap columns 1 and 2
awk '{print $2, $1}' file

# Sum file sizes from ls -l
ls -l | awk '{total += $5} END {print "Total bytes:", total}'

# Parse key=value pairs
awk -F'=' '{print $1, "->", $2}' config.env

# Format output as table
ps aux | awk '{printf "%-10s %6s %s\n", $1, $3, $11}'
```

---

## cut: Extract Columns

`cut` is simpler than awk when you just need to extract columns by position or delimiter.

```bash
cut -d',' -f1,3 data.csv         # fields 1 and 3, comma-delimited
cut -d':' -f1 /etc/passwd        # first field, colon-delimited
cut -c1-10 file                  # characters 1-10 of each line
cut -c5- file                    # characters 5 to end
```

---

## sort: Sort Lines

```bash
sort file                         # alphabetical sort
sort -n file                      # numeric sort
sort -r file                      # reverse sort
sort -k2 file                    # sort by column 2
sort -k2 -n file                 # sort by column 2, numerically
sort -t',' -k3 -n file           # sort CSV by column 3, numerically
sort -u file                      # sort and remove duplicates
sort -h file                      # human-readable numbers (1K, 2M, 3G)
```

---

## uniq: Remove Duplicates

`uniq` only removes **adjacent** duplicates. Always `sort` first.

```bash
sort file | uniq                  # remove duplicates
sort file | uniq -c               # count occurrences
sort file | uniq -d               # show only duplicates
sort file | uniq -u               # show only unique lines (appearing once)
```

The `sort | uniq -c | sort -rn` pattern is extremely common for frequency analysis.

---

## tr: Translate Characters

`tr` works on characters, not strings. It reads from stdin only.

```bash
echo "hello" | tr 'a-z' 'A-Z'          # HELLO (uppercase)
echo "HELLO" | tr 'A-Z' 'a-z'          # hello (lowercase)
echo "hello   world" | tr -s ' '       # squeeze repeated spaces
cat file | tr -d '\r'                   # remove carriage returns (Windows line endings)
echo "hello:world" | tr ':' '\n'        # replace colons with newlines
cat file | tr -d '[:digit:]'            # remove all digits
```

---

## jq: JSON Processing

`jq` is essential for working with JSON on the command line. APIs return JSON, config files use JSON, and `jq` lets you slice and transform it without writing code.

Install: `brew install jq`

### Basic usage

```bash
echo '{"name":"Augustus","age":30}' | jq '.'            # pretty-print
echo '{"name":"Augustus","age":30}' | jq '.name'         # "Augustus"
echo '{"name":"Augustus","age":30}' | jq -r '.name'      # Augustus (raw, no quotes)
```

### Arrays

```bash
echo '[1,2,3,4,5]' | jq '.[]'                           # iterate array elements
echo '[1,2,3,4,5]' | jq '.[0]'                          # first element
echo '[1,2,3,4,5]' | jq '.[-1]'                         # last element
echo '[1,2,3,4,5]' | jq '.[2:4]'                        # slice: [3,4]
echo '[1,2,3,4,5]' | jq 'length'                        # 5
```

### Nested access

```bash
echo '{"user":{"name":"Aug","address":{"city":"NYC"}}}' | jq '.user.address.city'
```

### Filtering arrays of objects

```bash
cat <<'EOF' | jq '.[] | select(.age > 25) | .name'
[
  {"name": "Alice", "age": 30},
  {"name": "Bob", "age": 22},
  {"name": "Charlie", "age": 28}
]
EOF
# "Alice"
# "Charlie"
```

### Transforming output

```bash
cat <<'EOF' | jq '.[] | {fullName: .name, yearsOld: .age}'
[
  {"name": "Alice", "age": 30},
  {"name": "Bob", "age": 22}
]
EOF

# Map to new structure
cat data.json | jq '[.users[] | {id: .id, email: .email}]'

# Collect into array
cat data.json | jq '[.items[].name]'
```

### Practical jq patterns

```bash
# Parse docker inspect output
docker inspect container_id | jq '.[0].NetworkSettings.IPAddress'

# Extract from API response
curl -s https://api.github.com/repos/rust-lang/rust | jq '{stars: .stargazers_count, forks: .forks_count}'

# CSV-like output from JSON
cat data.json | jq -r '.[] | [.name, .email] | @csv'

# Count items matching condition
cat data.json | jq '[.[] | select(.status == "active")] | length'
```

---

## wc: Count Lines, Words, Characters

```bash
wc file                           # lines, words, characters
wc -l file                        # lines only
wc -w file                        # words only
wc -c file                        # bytes
wc -m file                        # characters (differs from -c with multibyte encodings)
```

---

## Combining Tools: Real-World Examples

### Analyze web server access log

```bash
# Top 10 IP addresses
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10

# Requests per hour
awk '{print $4}' access.log | cut -d: -f2 | sort | uniq -c

# All 5xx errors with their URLs
awk '$9 >= 500 {print $9, $7}' access.log | sort | uniq -c | sort -rn
```

### Find large files and summarize

```bash
find . -type f -name "*.log" -exec wc -l {} + | sort -rn | head -10
```

### Process CSV data

```bash
# Skip header, extract columns 1 and 3, sort by column 3
tail -n +2 data.csv | awk -F',' '{print $1, $3}' | sort -k2 -rn
```

### Clean up messy data

```bash
# Remove blank lines, trim whitespace, sort uniquely
cat messy.txt | sed '/^$/d' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sort -u
```

---

## Exercises

### Exercise 1: grep practice

Create a test file:

```bash
cat > /tmp/code_review.txt <<'EOF'
TODO: refactor the authentication module
FIXME: race condition in connection pool
func handleRequest(w http.ResponseWriter, r *http.Request) {
    // TODO: add rate limiting
    log.Error("failed to connect to database")
    log.Info("request processed successfully")
    log.Error("timeout waiting for response")
    log.Warn("deprecated API endpoint used")
}
// HACK: temporary workaround for timezone bug
func processPayment(amount float64) error {
    log.Info("processing payment")
    log.Error("payment gateway unavailable")
}
EOF
```

```bash
# Find all TODO/FIXME/HACK markers
grep -nE "TODO|FIXME|HACK" /tmp/code_review.txt

# Count error log lines
grep -c "log.Error" /tmp/code_review.txt

# Show error lines with 1 line of context
grep -n -A 1 "log.Error" /tmp/code_review.txt

# Find lines that are NOT comments or blank
grep -v "^[[:space:]]*//" /tmp/code_review.txt | grep -v "^$"
```

### Exercise 2: sed and awk

```bash
# Replace all "log.Error" with "log.Errorf" (just output, don't modify file)
sed 's/log\.Error/log.Errorf/g' /tmp/code_review.txt

# Delete all comment lines
sed '/^[[:space:]]*\/\//d' /tmp/code_review.txt

# Extract just the log messages (the string in quotes after log.*)
grep -oE 'log\.(Error|Info|Warn)\("([^"]+)"\)' /tmp/code_review.txt | awk -F'"' '{print $2}'
```

### Exercise 3: Build a log analyzer pipeline

```bash
cat > /tmp/api_log.txt <<'EOF'
2024-01-15T10:30:15Z INFO  GET    /api/users       200 45ms  192.168.1.10
2024-01-15T10:30:16Z ERROR POST   /api/users       500 230ms 192.168.1.11
2024-01-15T10:30:17Z INFO  GET    /api/posts       200 12ms  192.168.1.10
2024-01-15T10:30:18Z WARN  GET    /api/users       401 8ms   192.168.1.12
2024-01-15T10:30:19Z INFO  GET    /api/posts       200 15ms  192.168.1.13
2024-01-15T10:30:20Z ERROR DELETE /api/users/5     500 340ms 192.168.1.10
2024-01-15T10:30:21Z INFO  GET    /api/users       200 22ms  192.168.1.11
2024-01-15T10:30:22Z INFO  GET    /api/posts       200 18ms  192.168.1.10
2024-01-15T10:30:23Z ERROR POST   /api/posts       503 5200ms 192.168.1.14
2024-01-15T10:30:24Z INFO  GET    /api/users       200 30ms  192.168.1.10
2024-01-15T10:30:25Z INFO  PUT    /api/users/3     200 55ms  192.168.1.10
2024-01-15T10:30:26Z ERROR GET    /api/health      500 100ms 192.168.1.15
EOF
```

Build pipelines to answer:

```bash
# 1. Count requests per HTTP method
awk '{print $3}' /tmp/api_log.txt | sort | uniq -c | sort -rn

# 2. Find requests slower than 100ms
awk '{gsub("ms","",$6); if ($6+0 > 100) print $0}' /tmp/api_log.txt

# 3. Top IPs by request count
awk '{print $7}' /tmp/api_log.txt | sort | uniq -c | sort -rn

# 4. Error rate (errors / total)
awk 'BEGIN{t=0;e=0} {t++} /ERROR/{e++} END{printf "Error rate: %.1f%% (%d/%d)\n", e/t*100, e, t}' /tmp/api_log.txt
```

### Exercise 4: jq practice

```bash
cat > /tmp/users.json <<'EOF'
{
  "users": [
    {"id": 1, "name": "Alice", "role": "admin", "active": true},
    {"id": 2, "name": "Bob", "role": "user", "active": false},
    {"id": 3, "name": "Charlie", "role": "user", "active": true},
    {"id": 4, "name": "Diana", "role": "admin", "active": true},
    {"id": 5, "name": "Eve", "role": "user", "active": false}
  ]
}
EOF
```

```bash
# List all user names
jq -r '.users[].name' /tmp/users.json

# Get active users only
jq '.users[] | select(.active == true) | .name' /tmp/users.json

# Count admins
jq '[.users[] | select(.role == "admin")] | length' /tmp/users.json

# Create a summary object
jq '{total: (.users | length), active: ([.users[] | select(.active)] | length), admins: ([.users[] | select(.role == "admin")] | length)}' /tmp/users.json
```

---

Next: [Lesson 05 — Process Management](./05-process-management.md)
