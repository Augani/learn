# Lesson 09: Shell Scripting — Automating Your Workflow

Shell scripts are programs written in your shell's language. They automate repetitive tasks — deployments, backups, data processing, environment setup. As a developer, you will write and maintain shell scripts regularly, even if you prefer Go or Rust for "real" programs.

---

## When to Script vs When to Use a Real Language

Use a shell script when:
- Orchestrating other command-line tools (git, docker, curl, rsync)
- Automating a sequence of commands you would type manually
- Quick file manipulation and text processing
- Setup and teardown scripts (CI/CD, dev environment)
- The script is under ~200 lines

Use Go, Python, or Rust when:
- Complex data structures are needed (shell arrays are painful)
- Error handling needs to be robust (shell error handling is fragile)
- Cross-platform compatibility matters (shell scripts are full of OS quirks)
- The script grows beyond ~200 lines
- You need to parse complex formats (XML, JSON beyond what jq handles)
- Performance matters (shell scripts spawn many processes)

---

## The Shebang Line

The first line tells the OS which interpreter to use:

```bash
#!/bin/bash                      # use bash at this exact path
#!/usr/bin/env bash              # find bash in PATH (more portable)
#!/usr/bin/env zsh               # use zsh
#!/usr/bin/env python3           # use python3
```

Always prefer `#!/usr/bin/env bash` because bash might be in different locations on different systems. The `env` approach searches PATH.

Make scripts executable:

```bash
chmod +x my-script.sh
./my-script.sh                   # run it
```

Or run without making executable:

```bash
bash my-script.sh
```

---

## The Safe Script Header

Every bash script should start with:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `set -e` — Exit on any command failure. Without this, the script happily continues after errors.
- `set -u` — Error on undefined variables. Without this, `$TYPO` silently expands to empty string.
- `set -o pipefail` — A pipeline fails if ANY command fails, not just the last one.

This is the equivalent of strict mode. Without it, shell scripts are dangerously lenient.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Without set -e, this script would continue after the failing cd:
cd /nonexistent/directory        # script exits here with set -e
echo "This never runs"
```

---

## Variables and Quoting

```bash
name="Augustus"
count=42
path="/path/with spaces/file"

echo "Hello, $name"             # variable expansion
echo "Count: ${count}"          # braces for clarity
echo "Path: $path"              # always quote variables with spaces
```

### Double quotes vs single quotes

```bash
name="world"
echo "Hello, $name"             # Hello, world (expansion happens)
echo 'Hello, $name'             # Hello, $name (literal, no expansion)
echo "Today is $(date)"         # command substitution works in double quotes
echo 'Today is $(date)'         # literal: Today is $(date)
```

**Rule of thumb:** Always use double quotes around variables (`"$var"`) unless you specifically need word splitting or glob expansion. Unquoted variables are the source of many shell script bugs.

```bash
file="my document.txt"
cat $file                        # BUG: tries to open "my" and "document.txt"
cat "$file"                      # correct: opens "my document.txt"
```

---

## Conditionals

### if / elif / else

```bash
#!/usr/bin/env bash
set -euo pipefail

if [[ -f "Cargo.toml" ]]; then
    echo "This is a Rust project"
elif [[ -f "package.json" ]]; then
    echo "This is a Node.js project"
elif [[ -f "go.mod" ]]; then
    echo "This is a Go project"
else
    echo "Unknown project type"
fi
```

### [[ ]] vs [ ]

Use `[[ ]]` in bash scripts. It is a bash built-in with better syntax:

```bash
# [[ ]] advantages over [ ]:
[[ "$name" == "Augustus" ]]     # == works ([ ] requires = )
[[ "$name" == A* ]]             # glob patterns work
[[ "$name" =~ ^[A-Z] ]]        # regex works
[[ -f "$file" && -r "$file" ]]  # && works ([ ] requires -a)
[[ -z "$var" || -n "$other" ]]  # || works ([ ] requires -o)
```

### File tests

```bash
[[ -f "$path" ]]                # is a regular file
[[ -d "$path" ]]                # is a directory
[[ -e "$path" ]]                # exists (any type)
[[ -r "$path" ]]                # is readable
[[ -w "$path" ]]                # is writable
[[ -x "$path" ]]                # is executable
[[ -s "$path" ]]                # exists and is not empty
[[ -L "$path" ]]                # is a symlink
```

### String and numeric tests

```bash
[[ -z "$var" ]]                 # string is empty
[[ -n "$var" ]]                 # string is not empty
[[ "$a" == "$b" ]]              # strings are equal
[[ "$a" != "$b" ]]              # strings are not equal

[[ "$x" -eq "$y" ]]            # numeric equal
[[ "$x" -lt "$y" ]]            # numeric less than
[[ "$x" -gt "$y" ]]            # numeric greater than
(( x > y ))                     # arithmetic comparison (alternative)
```

### case statement

Better than long if/elif chains for string matching:

```bash
case "$1" in
    start)
        echo "Starting..."
        ;;
    stop)
        echo "Stopping..."
        ;;
    restart)
        echo "Restarting..."
        ;;
    -h|--help)
        echo "Usage: $0 {start|stop|restart}"
        ;;
    *)
        echo "Unknown command: $1" >&2
        exit 1
        ;;
esac
```

---

## Loops

### for loop

```bash
for fruit in apple banana cherry; do
    echo "I like $fruit"
done

for file in *.rs; do
    [[ -f "$file" ]] || continue
    echo "Rust file: $file"
done

for i in {1..5}; do
    echo "Iteration $i"
done

for (( i=0; i<10; i++ )); do
    echo "$i"
done
```

### while loop

```bash
count=0
while [[ $count -lt 5 ]]; do
    echo "Count: $count"
    (( count++ ))
done
```

### Reading files line by line

```bash
while IFS= read -r line; do
    echo "Line: $line"
done < input.txt
```

`IFS=` prevents trimming leading/trailing whitespace. `-r` prevents backslash interpretation. Always use both.

### Reading command output

```bash
while IFS= read -r line; do
    echo "Process: $line"
done < <(ps aux | grep "[p]ostgres")
```

---

## Functions

```bash
deploy() {
    local environment="$1"
    local version="${2:-latest}"

    echo "Deploying version $version to $environment"

    if [[ "$environment" == "production" ]]; then
        echo "WARNING: Production deployment!"
        read -rp "Continue? [y/N] " confirm
        [[ "$confirm" =~ ^[Yy]$ ]] || return 1
    fi

    echo "Deploying..."
}

deploy "staging" "v1.2.3"
deploy "production"              # uses default version "latest"
```

### Function arguments

```bash
# $1, $2, ... — positional arguments
# $@ — all arguments as separate words
# $# — number of arguments
# $0 — script name (not function name)

process_files() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: process_files <file1> [file2] ..." >&2
        return 1
    fi

    for file in "$@"; do
        echo "Processing: $file"
    done
}
```

### Return values

Functions communicate through:
1. Exit codes: `return 0` (success) or `return 1` (failure)
2. stdout: capture with `$(function_name)`

```bash
get_branch() {
    git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "none"
}

branch=$(get_branch)
echo "Current branch: $branch"
```

---

## Exit Codes and Error Handling

Every command returns an exit code. `0` means success, anything else means failure.

```bash
echo $?                          # exit code of last command

# Check in scripts
if ! command -v docker &>/dev/null; then
    echo "Docker is not installed" >&2
    exit 1
fi

# Exit with meaningful codes
exit 0                           # success
exit 1                           # general error
exit 2                           # misuse of command
```

### trap: Cleanup on exit

`trap` runs a command when the script receives a signal or exits.

```bash
#!/usr/bin/env bash
set -euo pipefail

TMPDIR=$(mktemp -d)

cleanup() {
    echo "Cleaning up..."
    rm -rf "$TMPDIR"
}

trap cleanup EXIT                # runs cleanup on ANY exit (success, failure, or signal)

echo "Working in $TMPDIR"
# ... do work ...
# cleanup happens automatically when script exits
```

### Error handler with line numbers

```bash
#!/usr/bin/env bash
set -euo pipefail

on_error() {
    echo "ERROR: Script failed at line $1" >&2
    exit 1
}

trap 'on_error $LINENO' ERR
```

---

## Practical Script Examples

### Script 1: Backup script

```bash
#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:?Usage: $0 <source_dir>}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${TIMESTAMP}.tar.gz"

if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "Error: $SOURCE_DIR does not exist" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Backing up $SOURCE_DIR to $BACKUP_DIR/$BACKUP_NAME"
tar czf "$BACKUP_DIR/$BACKUP_NAME" -C "$(dirname "$SOURCE_DIR")" "$(basename "$SOURCE_DIR")"

SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)
echo "Backup complete: $BACKUP_DIR/$BACKUP_NAME ($SIZE)"

OLD_COUNT=$(find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 | wc -l | tr -d ' ')
if [[ "$OLD_COUNT" -gt 0 ]]; then
    echo "Cleaning up $OLD_COUNT backups older than 30 days"
    find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete
fi
```

### Script 2: Deployment script

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_NAME="myapp"
DEPLOY_DIR="/opt/$APP_NAME"
ENVIRONMENT="${1:-staging}"

log() {
    echo "[$(date '+%H:%M:%S')] $*"
}

require_command() {
    if ! command -v "$1" &>/dev/null; then
        echo "Required command '$1' not found" >&2
        exit 1
    fi
}

require_command git
require_command cargo

BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)

log "Deploying $APP_NAME ($BRANCH@$COMMIT) to $ENVIRONMENT"

log "Running tests..."
cargo test --quiet

log "Building release binary..."
cargo build --release --quiet

log "Build complete"
ls -lh target/release/$APP_NAME

if [[ "$ENVIRONMENT" == "production" ]]; then
    log "WARNING: Production deployment"
    read -rp "Type 'yes' to confirm: " confirm
    [[ "$confirm" == "yes" ]] || { echo "Aborted"; exit 1; }
fi

log "Deployment complete"
```

### Script 3: Log analyzer

```bash
#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${1:?Usage: $0 <log_file>}"

if [[ ! -f "$LOG_FILE" ]]; then
    echo "Error: $LOG_FILE not found" >&2
    exit 1
fi

TOTAL=$(wc -l < "$LOG_FILE")
ERRORS=$(grep -c "ERROR" "$LOG_FILE" || true)
WARNINGS=$(grep -c "WARN" "$LOG_FILE" || true)

echo "=== Log Analysis: $(basename "$LOG_FILE") ==="
echo "Total lines:  $TOTAL"
echo "Errors:       $ERRORS"
echo "Warnings:     $WARNINGS"
echo ""
echo "--- Top 5 Error Messages ---"
grep "ERROR" "$LOG_FILE" | awk -F'ERROR ' '{print $2}' | sort | uniq -c | sort -rn | head -5
echo ""
echo "--- Requests per Minute (last 10) ---"
awk '{print $1, $2}' "$LOG_FILE" | cut -d: -f1,2 | sort | uniq -c | tail -10
```

---

## Exercises

### Exercise 1: Write a disk usage monitor

```bash
#!/usr/bin/env bash
set -euo pipefail

THRESHOLD="${1:-80}"

echo "Checking disk usage (threshold: ${THRESHOLD}%)..."

while IFS= read -r line; do
    usage=$(echo "$line" | awk '{print $5}' | tr -d '%')
    mount=$(echo "$line" | awk '{print $9}')

    if [[ -n "$usage" ]] && (( usage > THRESHOLD )); then
        echo "WARNING: $mount is at ${usage}% capacity"
    fi
done < <(df -h | tail -n +2)

echo "Check complete"
```

Save as `~/bin/check-disk.sh`, make executable, and run it:

```bash
chmod +x ~/bin/check-disk.sh
~/bin/check-disk.sh              # default 80% threshold
~/bin/check-disk.sh 50           # custom 50% threshold
```

### Exercise 2: Write a project initializer

Write a script that:
1. Takes a project name and language (rust/go/node) as arguments
2. Creates the project directory
3. Initializes the project based on language
4. Initializes a git repository
5. Creates a `.gitignore`

```bash
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <project-name> <rust|go|node>" >&2
    exit 1
fi

PROJECT_NAME="$1"
LANGUAGE="$2"

if [[ -d "$PROJECT_NAME" ]]; then
    echo "Error: directory '$PROJECT_NAME' already exists" >&2
    exit 1
fi

mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

case "$LANGUAGE" in
    rust)
        cargo init .
        ;;
    go)
        go mod init "$PROJECT_NAME"
        mkdir -p cmd pkg internal
        ;;
    node)
        npm init -y
        echo "node_modules/" > .gitignore
        ;;
    *)
        echo "Unsupported language: $LANGUAGE" >&2
        exit 1
        ;;
esac

git init
echo "Project '$PROJECT_NAME' ($LANGUAGE) created successfully"
```

### Exercise 3: Write a git cleanup script

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Git Cleanup ==="

CURRENT=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT"

echo ""
echo "Merged branches (candidates for deletion):"
git branch --merged | grep -v "^\*" | grep -v "main" | grep -v "master" || echo "  (none)"

echo ""
read -rp "Delete merged branches? [y/N] " confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
    git branch --merged | grep -v "^\*" | grep -v "main" | grep -v "master" | xargs -r git branch -d
    echo "Done"
else
    echo "Skipped"
fi

echo ""
echo "Pruning remote tracking branches..."
git remote prune origin

echo "Cleanup complete"
```

---

Next: [Lesson 10 — Git Internals](./10-git-internals.md)
