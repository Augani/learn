# Lesson 17: Logs — journalctl, Log Rotation, Structured Logging

Logs are the primary way you understand what your software is doing. They are essential for debugging, monitoring, auditing, and post-incident analysis. Good logging practices separate developers who can quickly diagnose production issues from those who are stuck guessing.

---

## Why Logs Matter

Logs serve multiple purposes:

- **Debugging** — Understanding what happened leading up to a bug
- **Monitoring** — Detecting anomalies and performance issues
- **Auditing** — Recording who did what and when (security, compliance)
- **Incident response** — Reconstructing what went wrong after an outage

Without logs, you are debugging in the dark. With bad logs (too verbose, unstructured, missing context), you are debugging in a fog.

---

## Where Logs Live

### Traditional Unix: /var/log

```bash
ls /var/log/

# Common log files (Linux)
/var/log/syslog          # general system messages (Ubuntu/Debian)
/var/log/messages        # general system messages (RHEL/CentOS)
/var/log/auth.log        # authentication events
/var/log/kern.log        # kernel messages
/var/log/nginx/          # nginx access and error logs
/var/log/postgresql/     # PostgreSQL logs
```

```bash
# View recent system log entries (macOS)
log show --last 5m

# View recent system log entries (Linux)
tail -100 /var/log/syslog
```

### Application logs

Applications typically log to:
- stdout/stderr (the modern approach — let the infrastructure handle log storage)
- `/var/log/appname/` (traditional approach)
- A logging service (CloudWatch, Datadog, Elasticsearch)

---

## syslog: The Traditional Unix Logging System

syslog is the standard Unix logging protocol. Applications send messages with a facility (what kind of program) and a severity level, and the syslog daemon routes them to the appropriate files.

### Severity levels

| Level | Name | When to use |
|-------|------|------------|
| 0 | Emergency | System is unusable |
| 1 | Alert | Immediate action required |
| 2 | Critical | Critical conditions |
| 3 | Error | Error conditions |
| 4 | Warning | Warning conditions |
| 5 | Notice | Normal but significant |
| 6 | Info | Informational |
| 7 | Debug | Debug-level messages |

### Sending syslog messages

```bash
logger "Hello from the command line"
logger -p user.error "Something went wrong"
logger -t myapp "Application started"
```

---

## journalctl: Querying systemd Logs (Linux)

On systems using systemd, logs are managed by `journald` and queried with `journalctl`. This is a significant improvement over reading flat text files — the journal is indexed and supports structured queries.

### Basic usage

```bash
journalctl                       # all logs (careful: this can be huge)
journalctl -f                    # follow (live tail)
journalctl -n 50                 # last 50 entries
journalctl --no-pager            # don't paginate
```

### Filtering by service

```bash
journalctl -u nginx              # logs from nginx service
journalctl -u postgresql         # logs from PostgreSQL
journalctl -u myapp              # logs from your application
journalctl -u nginx -u myapp     # logs from multiple services
```

### Filtering by time

```bash
journalctl --since today
journalctl --since "2024-01-15 10:00" --until "2024-01-15 11:00"
journalctl --since "1 hour ago"
journalctl --since "30 min ago"
journalctl -b                    # since last boot
journalctl -b -1                 # previous boot
```

### Filtering by priority

```bash
journalctl -p err                # errors and above (err, crit, alert, emerg)
journalctl -p warning            # warnings and above
journalctl -u myapp -p err       # only errors from myapp
```

### Output formats

```bash
journalctl -o json               # JSON output (for processing)
journalctl -o json-pretty        # human-readable JSON
journalctl -o short-iso          # ISO timestamps
journalctl -o verbose            # all fields
```

### Disk usage

```bash
journalctl --disk-usage          # how much space the journal uses
sudo journalctl --vacuum-size=500M   # shrink journal to 500MB
sudo journalctl --vacuum-time=2weeks # remove entries older than 2 weeks
```

---

## macOS Unified Log

macOS replaced traditional syslog with the unified logging system. It is powerful but has different tools.

```bash
# Recent log entries
log show --last 5m

# Filter by process
log show --predicate 'process == "postgres"' --last 1h

# Filter by subsystem
log show --predicate 'subsystem == "com.apple.network"' --last 5m

# Filter by message content
log show --predicate 'eventMessage contains "error"' --last 1h

# Live stream
log stream
log stream --predicate 'process == "myapp"'

# Debug level (very verbose)
log show --last 5m --info --debug
```

The unified log stores messages in a compressed binary format, which is why you use the `log` command rather than `cat`.

---

## Log Rotation: Preventing Disk Full

Without rotation, log files grow indefinitely until they fill the disk. Log rotation automatically:
1. Renames the current log (e.g., `app.log` becomes `app.log.1`)
2. Creates a new empty log file
3. Compresses old logs
4. Deletes logs older than a retention period

### logrotate (Linux)

`logrotate` is the standard log rotation tool on Linux.

Configuration in `/etc/logrotate.d/myapp`:

```
/var/log/myapp/*.log {
    daily                   # rotate daily
    rotate 14               # keep 14 rotated files
    compress                # gzip old logs
    delaycompress           # don't compress the most recent rotated log
    missingok               # don't error if log file is missing
    notifempty              # don't rotate empty files
    create 0644 myapp myapp # create new log with these permissions
    postrotate
        systemctl reload myapp  # tell the app to reopen log files
    endscript
}
```

```bash
# Test rotation (dry run)
sudo logrotate -d /etc/logrotate.d/myapp

# Force rotation
sudo logrotate -f /etc/logrotate.d/myapp
```

### macOS

macOS uses `newsyslog` for log rotation, configured in `/etc/newsyslog.conf`. For Homebrew services, logs are typically managed by `asl` or the unified log system which handles rotation automatically.

---

## Structured Logging: JSON vs Plain Text

### Plain text logs

```
2024-01-15 10:30:15 ERROR Failed to connect to database: connection refused
```

Readable by humans. Terrible for machines. How do you extract the timestamp? The error type? The database host? You end up writing fragile regex patterns.

### Structured (JSON) logs

```json
{"timestamp":"2024-01-15T10:30:15Z","level":"error","message":"Failed to connect to database","error":"connection refused","database_host":"db.internal","database_port":5432,"retry_count":3,"request_id":"req-abc-123"}
```

Harder for humans to read raw. Excellent for machines. Every field is a named key that can be indexed, searched, and filtered. You can query "show me all errors where database_host is db.internal and retry_count > 2" without regex.

### Why structured logging wins

- **Search and filter** — Find all requests with `request_id=abc-123` across all services
- **Aggregation** — Count errors per endpoint per minute
- **Dashboards** — Plot error rates, latency percentiles, request counts
- **Correlation** — Follow a request through multiple services using a trace ID
- **Alerting** — Alert when error rate exceeds threshold

The trade-off: structured logs are harder to read with `cat` and `grep`. Use `jq` to make them readable:

```bash
cat app.log | jq '.'                           # pretty-print
cat app.log | jq 'select(.level == "error")'   # filter errors
cat app.log | jq -r '[.timestamp, .level, .message] | @tsv'  # tabular view
```

---

## Log Levels

Use the right level for the right situation:

| Level | When to use | Example |
|-------|------------|---------|
| `trace` | Very detailed debugging, per-request flow | "Entering function X with args Y" |
| `debug` | Detailed info useful during development | "Cache miss for key user:123" |
| `info` | Normal operations worth recording | "Server started on port 8080" |
| `warn` | Something unexpected but handled | "Connection pool near capacity (90%)" |
| `error` | Something failed and needs attention | "Failed to process payment: timeout" |
| `fatal` | Application cannot continue | "Cannot bind to port 8080: address in use" |

**In production:** Set log level to `info` or `warn`. Enable `debug` temporarily when investigating an issue.

**During development:** Use `debug` or `trace`.

The log level acts as a filter — setting the level to `warn` means you see `warn`, `error`, and `fatal`, but not `info`, `debug`, or `trace`.

---

## Practical Log Aggregation

When running multiple services, you need to aggregate logs into one place.

### Simple approach: stdout + Docker

Docker captures stdout/stderr from containers:

```bash
docker compose logs -f              # all services
docker compose logs -f api          # one service
```

### Development: piping and tee

```bash
# Run server and save logs
./myapp 2>&1 | tee -a app.log

# Multiple services with prefixed output
{ ./api-server 2>&1 | sed 's/^/[api] /' & \
  ./worker 2>&1 | sed 's/^/[worker] /' & \
  wait; } | tee -a all.log
```

### Rust: tracing crate

The `tracing` crate is the standard for structured, contextual logging in Rust:

```rust
use tracing::{info, warn, error, instrument};
use tracing_subscriber::{fmt, EnvFilter};

fn init_logging() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .json()
        .init();
}

#[instrument(skip(pool))]
async fn get_user(pool: &PgPool, user_id: i64) -> Result<User, Error> {
    info!(user_id, "fetching user");

    match sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await
    {
        Ok(user) => {
            info!(user_id, "user found");
            Ok(user)
        }
        Err(e) => {
            error!(user_id, error = %e, "failed to fetch user");
            Err(e.into())
        }
    }
}
```

Control log level with `RUST_LOG` environment variable:

```bash
RUST_LOG=info cargo run
RUST_LOG=debug cargo run
RUST_LOG=myapp=debug,sqlx=warn cargo run    # per-crate levels
```

---

## Exercises

### Exercise 1: Explore system logs

```bash
# macOS: recent system log entries
log show --last 10m --predicate 'messageType == 16' | head -30
# messageType 16 = error

# Find authentication events (macOS)
log show --last 1h --predicate 'process == "loginwindow"' | head -20

# Find network events (macOS)
log show --last 5m --predicate 'subsystem == "com.apple.network"' --info | head -20

# On Linux you would use:
# journalctl --since "10 min ago"
# journalctl -u sshd --since today
# journalctl -p err --since "1 hour ago"
```

### Exercise 2: Process structured logs with jq

```bash
# Create sample structured logs
cat > /tmp/structured.log <<'EOF'
{"timestamp":"2024-01-15T10:30:15Z","level":"info","message":"server started","port":8080}
{"timestamp":"2024-01-15T10:30:16Z","level":"info","message":"request received","method":"GET","path":"/api/users","status":200,"duration_ms":45}
{"timestamp":"2024-01-15T10:30:17Z","level":"error","message":"database query failed","error":"connection timeout","query":"SELECT * FROM users","duration_ms":5000}
{"timestamp":"2024-01-15T10:30:18Z","level":"info","message":"request received","method":"POST","path":"/api/users","status":201,"duration_ms":120}
{"timestamp":"2024-01-15T10:30:19Z","level":"warn","message":"slow query detected","query":"SELECT * FROM orders","duration_ms":3500}
{"timestamp":"2024-01-15T10:30:20Z","level":"error","message":"request failed","method":"GET","path":"/api/orders","status":500,"error":"internal server error","duration_ms":15}
{"timestamp":"2024-01-15T10:30:21Z","level":"info","message":"request received","method":"GET","path":"/api/health","status":200,"duration_ms":2}
EOF

# Pretty-print all entries
cat /tmp/structured.log | jq '.'

# Filter errors only
cat /tmp/structured.log | jq 'select(.level == "error")'

# Show requests slower than 1000ms
cat /tmp/structured.log | jq 'select(.duration_ms > 1000) | {message, duration_ms}'

# Tabular view of requests
cat /tmp/structured.log | jq -r 'select(.method) | [.timestamp, .method, .path, .status, (.duration_ms | tostring) + "ms"] | @tsv'

# Count by level
cat /tmp/structured.log | jq -r '.level' | sort | uniq -c | sort -rn

rm /tmp/structured.log
```

### Exercise 3: Log analysis pipeline

```bash
# Create a more realistic log file
cat > /tmp/app.log <<'EOF'
2024-01-15 10:30:15 [INFO] Server started on port 8080
2024-01-15 10:30:16 [INFO] GET /api/users 200 45ms 192.168.1.10
2024-01-15 10:30:17 [ERROR] POST /api/users 500 230ms 192.168.1.11 - database connection failed
2024-01-15 10:30:18 [INFO] GET /api/posts 200 12ms 192.168.1.10
2024-01-15 10:30:19 [WARN] Connection pool at 85% capacity
2024-01-15 10:30:20 [INFO] GET /api/users 200 38ms 192.168.1.12
2024-01-15 10:30:21 [ERROR] DELETE /api/users/5 500 340ms 192.168.1.10 - foreign key constraint
2024-01-15 10:30:22 [INFO] GET /api/health 200 2ms 192.168.1.100
2024-01-15 10:30:23 [ERROR] POST /api/posts 503 5200ms 192.168.1.14 - upstream timeout
2024-01-15 10:30:24 [INFO] GET /api/users 200 30ms 192.168.1.10
2024-01-15 10:30:25 [WARN] Disk usage above 80%
2024-01-15 10:30:26 [INFO] PUT /api/users/3 200 55ms 192.168.1.10
EOF

# Count by log level
grep -oE '\[(INFO|WARN|ERROR)\]' /tmp/app.log | sort | uniq -c | sort -rn

# Extract and display only error messages
grep ERROR /tmp/app.log

# Find the slowest requests
grep -oE '[0-9]+ms' /tmp/app.log | sort -t'm' -k1 -rn | head -5

# Count requests per IP
grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' /tmp/app.log | sort | uniq -c | sort -rn

rm /tmp/app.log
```

### Exercise 4: Live log monitoring

```bash
# Create a script that generates logs
cat > /tmp/log-generator.sh <<'EOF'
#!/bin/bash
LEVELS=("INFO" "WARN" "ERROR")
PATHS=("/api/users" "/api/posts" "/api/health" "/api/orders")
while true; do
    LEVEL=${LEVELS[$((RANDOM % 3))]}
    PATH_=${PATHS[$((RANDOM % 4))]}
    STATUS=$((200 + (RANDOM % 4) * 100))
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$LEVEL] GET $PATH_ $STATUS $((RANDOM % 500))ms"
    sleep 1
done
EOF
chmod +x /tmp/log-generator.sh

# Start generating logs in background
/tmp/log-generator.sh > /tmp/live.log &
GEN_PID=$!

# Watch the log file live
tail -f /tmp/live.log

# In another terminal, filter for errors only
tail -f /tmp/live.log | grep --line-buffered ERROR

# Clean up (Ctrl+C first, then)
kill $GEN_PID 2>/dev/null
rm -f /tmp/log-generator.sh /tmp/live.log
```

---

Next: [Lesson 18 — Monitoring and Observability](./18-monitoring.md)
