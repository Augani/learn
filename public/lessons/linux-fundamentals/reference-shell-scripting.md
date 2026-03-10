# Reference: Bash Scripting Patterns

A practical reference for writing reliable shell scripts. All patterns work in both bash and zsh unless noted.

---

## The Safe Script Header

Every script should start with this:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

What each flag does:

- `set -e` — Exit immediately if any command fails (non-zero exit code)
- `set -u` — Treat unset variables as an error (catches typos)
- `set -o pipefail` — A pipeline fails if ANY command in it fails, not just the last one

Without `pipefail`, this silently succeeds even if `curl` fails:

```bash
curl https://example.com/data | grep "error"
```

With `pipefail`, the script exits if `curl` fails.

---

## Variables

```bash
name="Augustus"
readonly VERSION="1.0.0"

echo "$name"
echo "${name}_suffix"
echo "Version: $VERSION"
```

**Quoting rules:**

```bash
name="world"

echo "Hello $name"         # Hello world — variables expand in double quotes
echo 'Hello $name'         # Hello $name — single quotes are literal
echo "Path is $(pwd)"      # command substitution works in double quotes
echo "She said \"hi\""     # escape quotes with backslash
```

**Parameter expansion:**

```bash
file="/path/to/report.tar.gz"

echo "${file%.tar.gz}"      # /path/to/report     (remove shortest suffix match)
echo "${file%%.*}"          # /path/to/report      (remove longest suffix match)
echo "${file#*/}"           # path/to/report.tar.gz (remove shortest prefix match)
echo "${file##*/}"          # report.tar.gz         (remove longest prefix match — basename)

name="Augustus"
echo "${name^^}"            # AUGUSTUS  (uppercase, bash 4+ only)
echo "${name,,}"            # augustus  (lowercase, bash 4+ only)
echo "${name:0:3}"          # Aug      (substring: offset, length)
echo "${#name}"             # 8        (string length)
```

**Default values:**

```bash
echo "${PORT:-3000}"        # use 3000 if PORT is unset or empty
echo "${PORT:=3000}"        # same, but also assign 3000 to PORT
echo "${PORT:+override}"    # use "override" if PORT IS set
echo "${PORT:?PORT is required}"  # error and exit if PORT is unset
```

---

## Conditionals

### if / elif / else

```bash
if [[ "$status" == "ok" ]]; then
    echo "All good"
elif [[ "$status" == "warn" ]]; then
    echo "Warning"
else
    echo "Error"
fi
```

### Test operators

**String comparisons:**

```bash
[[ "$a" == "$b" ]]         # equal
[[ "$a" != "$b" ]]         # not equal
[[ -z "$a" ]]              # empty string
[[ -n "$a" ]]              # non-empty string
[[ "$a" == *.txt ]]        # glob matching
[[ "$a" =~ ^[0-9]+$ ]]    # regex matching
```

**Numeric comparisons:**

```bash
[[ "$a" -eq "$b" ]]        # equal
[[ "$a" -ne "$b" ]]        # not equal
[[ "$a" -lt "$b" ]]        # less than
[[ "$a" -le "$b" ]]        # less than or equal
[[ "$a" -gt "$b" ]]        # greater than
[[ "$a" -ge "$b" ]]        # greater than or equal

(( a == b ))               # arithmetic comparison (alternative syntax)
(( a > b ))
(( a >= b ))
```

**File tests:**

```bash
[[ -f "$path" ]]           # is a regular file
[[ -d "$path" ]]           # is a directory
[[ -e "$path" ]]           # exists (any type)
[[ -r "$path" ]]           # is readable
[[ -w "$path" ]]           # is writable
[[ -x "$path" ]]           # is executable
[[ -s "$path" ]]           # exists and is non-empty
[[ -L "$path" ]]           # is a symbolic link
[[ "$a" -nt "$b" ]]        # a is newer than b
[[ "$a" -ot "$b" ]]        # a is older than b
```

**Logical operators:**

```bash
[[ "$a" == "x" && "$b" == "y" ]]   # AND
[[ "$a" == "x" || "$b" == "y" ]]   # OR
[[ ! -f "$path" ]]                  # NOT
```

### case statement

```bash
case "$command" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server
        start_server
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}" >&2
        exit 1
        ;;
esac
```

---

## Loops

### for loop

```bash
for item in one two three; do
    echo "$item"
done

for file in *.txt; do
    echo "Processing: $file"
done

for file in /var/log/*.log; do
    [[ -f "$file" ]] || continue
    echo "Size: $(wc -l < "$file") lines in $file"
done

for i in {1..10}; do
    echo "Iteration $i"
done

for (( i=0; i<10; i++ )); do
    echo "$i"
done
```

### while loop

```bash
count=0
while [[ $count -lt 10 ]]; do
    echo "Count: $count"
    (( count++ ))
done

while read -r line; do
    echo "Line: $line"
done < input.txt

while IFS=',' read -r name age city; do
    echo "$name is $age years old, lives in $city"
done < data.csv
```

### Loop over command output

```bash
while read -r pid; do
    echo "Process: $pid"
done < <(pgrep -f "myapp")

find . -name "*.rs" -print0 | while IFS= read -r -d '' file; do
    echo "Rust file: $file"
done
```

### Loop control

```bash
for item in "${items[@]}"; do
    [[ "$item" == "skip" ]] && continue
    [[ "$item" == "done" ]] && break
    process "$item"
done
```

---

## Functions

```bash
greet() {
    local name="$1"
    local greeting="${2:-Hello}"
    echo "$greeting, $name!"
}

greet "Augustus"              # Hello, Augustus!
greet "Augustus" "Hey"        # Hey, Augustus!
```

**Function arguments:**

```bash
process_files() {
    local target_dir="$1"
    shift
    local files=("$@")

    echo "Directory: $target_dir"
    echo "File count: ${#files[@]}"

    for file in "${files[@]}"; do
        echo "  Processing: $file"
    done
}

process_files "/tmp" "a.txt" "b.txt" "c.txt"
```

**Return values:**
Functions return exit codes (0-255). Use stdout for actual data:

```bash
get_timestamp() {
    date +%Y%m%d_%H%M%S
}

timestamp=$(get_timestamp)
echo "Backup: backup_${timestamp}.tar.gz"

validate_port() {
    local port="$1"
    if (( port < 1 || port > 65535 )); then
        return 1
    fi
    return 0
}

if validate_port "$PORT"; then
    echo "Valid port"
else
    echo "Invalid port" >&2
    exit 1
fi
```

---

## Arrays

```bash
fruits=("apple" "banana" "cherry")

echo "${fruits[0]}"            # apple (first element)
echo "${fruits[@]}"            # all elements
echo "${#fruits[@]}"           # array length (3)
echo "${fruits[@]:1:2}"        # slice: banana cherry

fruits+=("date")               # append element

for fruit in "${fruits[@]}"; do
    echo "$fruit"
done

unset 'fruits[1]'              # remove element at index 1
```

**Associative arrays (bash 4+):**

```bash
declare -A config
config[host]="localhost"
config[port]="5432"
config[db]="myapp"

echo "${config[host]}"
echo "${!config[@]}"           # all keys
echo "${config[@]}"            # all values

for key in "${!config[@]}"; do
    echo "$key = ${config[$key]}"
done
```

---

## Command Substitution

```bash
current_dir=$(pwd)
file_count=$(ls -1 | wc -l)
git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "none")

echo "We are in $current_dir with $file_count files on branch $git_branch"
```

---

## Exit Codes

```bash
command_that_might_fail
status=$?

if [[ $status -ne 0 ]]; then
    echo "Command failed with exit code $status" >&2
    exit 1
fi

command1 && echo "succeeded" || echo "failed"

if grep -q "pattern" file.txt; then
    echo "Pattern found"
fi
```

Convention: `0` = success, `1-125` = error, `126` = not executable, `127` = not found, `128+N` = killed by signal N.

---

## Error Handling

### trap for cleanup

```bash
#!/usr/bin/env bash
set -euo pipefail

TMPDIR=$(mktemp -d)

cleanup() {
    rm -rf "$TMPDIR"
    echo "Cleaned up temp directory"
}

trap cleanup EXIT

echo "Working in $TMPDIR"
cp important_file.txt "$TMPDIR/"
process_data "$TMPDIR/important_file.txt"
```

### Error handler

```bash
on_error() {
    local line_number=$1
    echo "ERROR: Script failed at line $line_number" >&2
}

trap 'on_error $LINENO' ERR
```

### Retry pattern

```bash
retry() {
    local max_attempts="$1"
    shift
    local cmd=("$@")
    local attempt=1

    while (( attempt <= max_attempts )); do
        if "${cmd[@]}"; then
            return 0
        fi
        echo "Attempt $attempt/$max_attempts failed. Retrying..." >&2
        (( attempt++ ))
        sleep $(( attempt * 2 ))
    done

    echo "All $max_attempts attempts failed" >&2
    return 1
}

retry 3 curl -sf "https://api.example.com/health"
```

---

## Argument Parsing

### Simple positional arguments

```bash
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <source> <destination>" >&2
    exit 1
fi

SOURCE="$1"
DESTINATION="$2"
```

### Flags with getopts

```bash
#!/usr/bin/env bash
set -euo pipefail

VERBOSE=false
OUTPUT=""
DRY_RUN=false

usage() {
    echo "Usage: $0 [-v] [-n] [-o output_file] <input_file>" >&2
    exit 1
}

while getopts ":vno:" opt; do
    case $opt in
        v) VERBOSE=true ;;
        n) DRY_RUN=true ;;
        o) OUTPUT="$OPTARG" ;;
        :) echo "Option -$OPTARG requires an argument" >&2; usage ;;
        *) usage ;;
    esac
done
shift $((OPTIND - 1))

if [[ $# -lt 1 ]]; then
    usage
fi

INPUT="$1"
$VERBOSE && echo "Processing $INPUT..."
```

### Long options with manual parsing

```bash
#!/usr/bin/env bash
set -euo pipefail

VERBOSE=false
OUTPUT=""
ENVIRONMENT="production"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -o|--output)
            OUTPUT="$2"
            shift 2
            ;;
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--verbose] [--output file] [--env name] <input>"
            exit 0
            ;;
        -*)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
        *)
            break
            ;;
    esac
done
```

---

## Logging

```bash
readonly LOG_FILE="/var/log/myapp.log"

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info()  { log "INFO"  "$@"; }
log_warn()  { log "WARN"  "$@"; }
log_error() { log "ERROR" "$@" >&2; }

log_info "Starting deployment"
log_warn "Disk usage above 80%"
log_error "Failed to connect to database"
```

---

## Common Patterns

### Check if a command exists

```bash
require_command() {
    if ! command -v "$1" &>/dev/null; then
        echo "Required command '$1' not found. Please install it." >&2
        exit 1
    fi
}

require_command docker
require_command jq
require_command curl
```

### Confirmation prompt

```bash
confirm() {
    local message="${1:-Are you sure?}"
    read -rp "$message [y/N] " response
    [[ "$response" =~ ^[Yy]$ ]]
}

if confirm "Delete all logs?"; then
    rm -f /var/log/myapp/*.log
fi
```

### Lock file (prevent concurrent execution)

```bash
LOCKFILE="/tmp/myapp.lock"

acquire_lock() {
    if [[ -f "$LOCKFILE" ]]; then
        local pid
        pid=$(cat "$LOCKFILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Script already running (PID: $pid)" >&2
            exit 1
        fi
        echo "Removing stale lock file"
    fi
    echo $$ > "$LOCKFILE"
}

release_lock() {
    rm -f "$LOCKFILE"
}

trap release_lock EXIT
acquire_lock
```

### Temporary files

```bash
tmpfile=$(mktemp)
tmpdir=$(mktemp -d)

trap 'rm -rf "$tmpfile" "$tmpdir"' EXIT

curl -sf "https://api.example.com/data" > "$tmpfile"
process_data "$tmpfile"
```

### Reading config files

```bash
if [[ -f ".env" ]]; then
    set -o allexport
    source .env
    set +o allexport
fi
```

### Progress indicator

```bash
spinner() {
    local pid=$1
    local chars='|/-\'
    local i=0
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r%s Working..." "${chars:i++%4:1}"
        sleep 0.2
    done
    printf "\r"
}

long_running_command &
spinner $!
wait $!
```

### Parallel execution

```bash
pids=()
for host in server1 server2 server3; do
    ssh "$host" "uptime" &
    pids+=($!)
done

for pid in "${pids[@]}"; do
    wait "$pid" || echo "A command failed"
done
```

### Here documents

```bash
cat <<EOF > config.yaml
database:
  host: ${DB_HOST}
  port: ${DB_PORT}
  name: ${DB_NAME}
EOF

cat <<'EOF' > script.sh
#!/bin/bash
echo "Variables are NOT expanded: $HOME"
EOF
```

### Safe file overwrite

```bash
safe_write() {
    local target="$1"
    local tmpfile="${target}.tmp.$$"

    cat > "$tmpfile"

    if [[ -s "$tmpfile" ]]; then
        mv "$tmpfile" "$target"
    else
        rm -f "$tmpfile"
        echo "ERROR: Empty output, keeping original file" >&2
        return 1
    fi
}

generate_config | safe_write /etc/myapp/config.yaml
```
