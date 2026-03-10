# Lesson 03: Pipes, Redirection, and Composition — The Unix Philosophy

The power of Unix does not come from any single command. It comes from the ability to connect small, focused programs together into pipelines that solve complex problems. This is the Unix philosophy and it is the reason command-line tools written in the 1970s are still used daily.

---

## The Unix Philosophy

Doug McIlroy summarized it:

1. Write programs that do one thing and do it well.
2. Write programs to work together.
3. Write programs to handle text streams, because that is a universal interface.

This is why `grep` only searches, `sort` only sorts, and `wc` only counts. None of them try to do everything. Instead, you compose them.

If you think about it, this is the same principle behind functional composition in programming — small pure functions chained together. Unix had this idea decades before functional programming became trendy.

---

## The Three Standard Streams

Every process in Unix gets three file descriptors automatically:

| Stream | File Descriptor | Default | Purpose |
|--------|----------------|---------|---------|
| stdin | 0 | keyboard | Input to the program |
| stdout | 1 | terminal | Normal output |
| stderr | 2 | terminal | Error messages |

By default, stdin comes from your keyboard, and both stdout and stderr display on your terminal. But you can redirect any of them.

This separation of stdout and stderr is important. A program can write results to stdout and errors to stderr, and you can handle them independently. When you pipe `cmd1 | cmd2`, only stdout flows through the pipe — stderr still goes to your terminal so you can see errors.

---

## Pipes: Connecting Programs

The pipe (`|`) takes the stdout of the left command and feeds it as stdin to the right command.

```bash
ls -la | head -5                # list files, show only first 5 lines
cat /var/log/system.log | grep "error"    # search log for errors
ps aux | grep postgres          # find postgres processes
history | grep "docker" | tail -10        # last 10 docker commands
```

**The analogy:** Think of an assembly line in a factory. Each worker (command) has one job. The first worker takes raw material, does their task, and passes the result to the next worker. No single worker needs to understand the whole process — they just handle their piece.

```bash
cat access.log | grep "POST" | awk '{print $1}' | sort | uniq -c | sort -rn | head -10
```

This pipeline:
1. `cat access.log` — reads the file
2. `grep "POST"` — filters to POST requests
3. `awk '{print $1}'` — extracts the first column (IP address)
4. `sort` — sorts IPs alphabetically (required for uniq)
5. `uniq -c` — counts consecutive duplicates
6. `sort -rn` — sorts by count, descending
7. `head -10` — shows top 10

Each step is simple. Combined, they answer "What are the top 10 IP addresses making POST requests?"

---

## Redirection: Controlling Where Data Goes

### Output redirection

```bash
echo "hello" > output.txt      # write stdout to file (overwrites)
echo "world" >> output.txt     # append stdout to file
ls nonexistent 2> errors.txt   # write stderr to file
ls nonexistent 2>> errors.txt  # append stderr to file
```

### Redirecting both stdout and stderr

```bash
command > output.txt 2>&1      # redirect stderr to wherever stdout goes, then stdout to file
command &> output.txt          # shorthand: redirect both to file (bash/zsh)
command > output.txt 2> errors.txt  # stdout and stderr to different files
```

The order matters with `2>&1`. This is a common gotcha:

```bash
command > file 2>&1            # CORRECT: stderr goes to file
command 2>&1 > file            # WRONG: stderr goes to terminal, only stdout goes to file
```

Why? `2>&1` means "point fd 2 to wherever fd 1 currently points." So you need to redirect fd 1 first.

### Input redirection

```bash
sort < unsorted.txt            # read stdin from file
wc -l < data.txt               # count lines in file via stdin
```

### Here documents (heredoc)

Feed multi-line input directly:

```bash
cat <<EOF
Hello, $USER!
Today is $(date).
EOF

cat <<'EOF'
This is literal text.
$USER is not expanded.
EOF
```

Single-quoting the delimiter (`'EOF'`) prevents variable expansion.

### Here strings

Feed a single string as stdin:

```bash
grep "pattern" <<< "search in this string"
wc -w <<< "count these words"
```

---

## /dev/null: The Black Hole

`/dev/null` is a special file that discards everything written to it and produces no output when read. It is the data black hole.

```bash
command > /dev/null             # discard stdout (hide output)
command 2> /dev/null            # discard stderr (hide errors)
command &> /dev/null            # discard everything

if grep -q "pattern" file.txt 2>/dev/null; then
    echo "Found it"
fi
```

Use it when you care about the exit code but not the output.

---

## tee: Write to Both Stdout and a File

`tee` reads from stdin and writes to both stdout AND a file. It is like a T-junction in plumbing — the data flows in two directions.

```bash
ls -la | tee listing.txt                  # display AND save
ls -la | tee listing.txt | grep ".rs"     # save AND continue pipeline
ls -la | tee -a listing.txt              # append instead of overwrite
```

Common use case — logging a build while still seeing output:

```bash
make 2>&1 | tee build.log
```

---

## xargs: Convert Stdin to Arguments

Some commands do not read from stdin — they take arguments. `xargs` bridges the gap by converting stdin lines into command arguments.

```bash
find . -name "*.tmp" | xargs rm          # delete all .tmp files
echo "file1.txt file2.txt" | xargs cat   # cat multiple files
grep -rl "TODO" src/ | xargs wc -l       # count lines in files containing TODO
```

**Handling filenames with spaces:**

```bash
find . -name "*.txt" -print0 | xargs -0 rm    # -print0 and -0 use null delimiters
```

**Limiting arguments per invocation:**

```bash
find . -name "*.log" | xargs -n 1 gzip        # compress one file at a time
```

**Using a placeholder for argument position:**

```bash
find . -name "*.bak" | xargs -I {} mv {} /backup/   # move each .bak to /backup
```

---

## Command Substitution

Capture the output of a command and use it as part of another command or assignment.

```bash
current_branch=$(git rev-parse --abbrev-ref HEAD)
echo "On branch: $current_branch"

tar czf "backup-$(date +%Y%m%d).tar.gz" src/

echo "There are $(ls | wc -l) files here"
```

The older backtick syntax works too but is harder to read and nest:

```bash
echo "Branch: `git branch --show-current`"    # works but avoid this
```

---

## Process Substitution

Treat the output of a command as if it were a file. This uses `<(command)` syntax.

```bash
diff <(ls dir1) <(ls dir2)                     # compare directory contents
diff <(sort file1) <(sort file2)               # compare sorted versions

while read -r line; do
    echo "Process: $line"
done < <(ps aux | grep postgres)
```

This is useful when a command expects a filename but you want to give it dynamic output instead.

---

## Practical Pipeline Examples

### Find the 10 largest files in a directory tree

```bash
find . -type f -exec du -h {} + 2>/dev/null | sort -rh | head -10
```

### Count unique HTTP status codes in an access log

```bash
awk '{print $9}' access.log | sort | uniq -c | sort -rn
```

### Find all Go files containing "error" and count matches per file

```bash
grep -rc "error" --include="*.go" . | grep -v ":0$" | sort -t: -k2 -rn
```

### Extract and sort unique email addresses from a file

```bash
grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' contacts.txt | sort -u
```

### Monitor a log file for errors and also save them

```bash
tail -f /var/log/app.log | grep --line-buffered "ERROR" | tee -a errors.log
```

### Show disk usage of subdirectories, sorted

```bash
du -h -d 1 2>/dev/null | sort -rh
```

---

## Exercises

### Exercise 1: Basic pipes

```bash
# Count how many files are in /etc
ls /etc | wc -l

# Find all lines in your shell history containing "git"
history | grep "git"

# List all running processes, sorted by memory usage, top 10
ps aux | sort -k4 -rn | head -10
```

### Exercise 2: Redirection

```bash
# Save the output of ls -la to a file
ls -la > ~/listing.txt

# Append the current date to that file
date >> ~/listing.txt

# Run a command that fails, capture the error
ls /nonexistent 2> ~/errors.txt
cat ~/errors.txt

# Combine stdout and stderr into one file
ls -la / /nonexistent &> ~/combined.txt
cat ~/combined.txt
```

### Exercise 3: Build a pipeline

Create a sample data file:

```bash
cat > ~/sample_log.txt <<'EOF'
2024-01-15 10:30:15 INFO  192.168.1.100 GET /api/users 200
2024-01-15 10:30:16 ERROR 192.168.1.101 POST /api/users 500
2024-01-15 10:30:17 INFO  192.168.1.100 GET /api/posts 200
2024-01-15 10:30:18 WARN  192.168.1.102 GET /api/users 401
2024-01-15 10:30:19 INFO  192.168.1.103 GET /api/posts 200
2024-01-15 10:30:20 ERROR 192.168.1.100 DELETE /api/users/5 500
2024-01-15 10:30:21 INFO  192.168.1.101 GET /api/users 200
2024-01-15 10:30:22 INFO  192.168.1.100 GET /api/posts 200
2024-01-15 10:30:23 ERROR 192.168.1.104 POST /api/posts 503
2024-01-15 10:30:24 INFO  192.168.1.100 GET /api/users 200
EOF
```

Now answer these questions using pipelines:

```bash
# 1. How many ERROR lines are there?
grep "ERROR" ~/sample_log.txt | wc -l

# 2. What are the unique IP addresses?
awk '{print $4}' ~/sample_log.txt | sort -u

# 3. Which IP made the most requests?
awk '{print $4}' ~/sample_log.txt | sort | uniq -c | sort -rn | head -1

# 4. What endpoints returned 500?
grep " 500$" ~/sample_log.txt | awk '{print $5, $6}'

# 5. Save all ERROR lines to a separate file, and also display them
grep "ERROR" ~/sample_log.txt | tee ~/errors_only.txt
```

### Exercise 4: xargs and process substitution

```bash
# Create test files
mkdir -p /tmp/xargs-test
touch /tmp/xargs-test/{a,b,c,d,e}.txt

# Use find + xargs to list file details
find /tmp/xargs-test -name "*.txt" | xargs ls -la

# Compare two directory listings using process substitution
mkdir -p /tmp/dir1 /tmp/dir2
touch /tmp/dir1/{a,b,c}.txt
touch /tmp/dir2/{b,c,d}.txt
diff <(ls /tmp/dir1) <(ls /tmp/dir2)

# Clean up
rm -rf /tmp/xargs-test /tmp/dir1 /tmp/dir2
```

---

Next: [Lesson 04 — Text Processing](./04-text-processing.md)
