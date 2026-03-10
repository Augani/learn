# Lesson 08: Services and Daemons — systemd, launchd

A daemon is a long-running background process that typically starts at boot and provides some service — serving web pages, managing databases, handling SSH connections, scheduling tasks. The word comes from Greek mythology (helpful supernatural beings), not anything sinister.

**The analogy:** Daemons are like building utilities — heating, plumbing, electricity. They run in the background without you thinking about them. You just expect the lights to work when you flip the switch. Similarly, when you run `psql`, you expect the PostgreSQL daemon to be listening. When you `ssh` into a server, you expect `sshd` to be running.

---

## How Daemons Differ from Regular Processes

A daemon typically:
- Detaches from the terminal (no controlling TTY)
- Runs in the background
- Starts automatically at boot
- Writes output to log files instead of stdout
- Has a PID file so you can find it
- Runs as a service account (not root, not your user)
- Restarts automatically if it crashes

You have been interacting with daemons constantly — every time you connect to a database, make an HTTP request to localhost, or push to git over SSH.

---

## Linux: systemd

systemd is the init system and service manager on most modern Linux distributions (Ubuntu, Fedora, Debian, Arch, RHEL). It is PID 1 — the first process started by the kernel, and the ancestor of all other processes.

### systemctl: The control command

```bash
# Service management
sudo systemctl start nginx        # start a service
sudo systemctl stop nginx         # stop a service
sudo systemctl restart nginx      # stop then start
sudo systemctl reload nginx       # reload config without stopping (if supported)
sudo systemctl status nginx       # show current state, recent logs

# Boot behavior
sudo systemctl enable nginx       # start automatically at boot
sudo systemctl disable nginx      # don't start at boot
sudo systemctl enable --now nginx  # enable AND start immediately

# Querying
systemctl list-units --type=service              # all loaded services
systemctl list-units --type=service --state=running  # only running services
systemctl is-active nginx         # quick check: "active" or "inactive"
systemctl is-enabled nginx        # "enabled" or "disabled"
```

### Unit files

systemd services are defined by unit files, typically in `/etc/systemd/system/` (custom) or `/usr/lib/systemd/system/` (package-installed).

Example service file (`/etc/systemd/system/myapp.service`):

```ini
[Unit]
Description=My Application Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=myapp
Group=myapp
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/bin/server
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5
Environment=RUST_LOG=info
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
```

Key sections:
- `[Unit]` — Description, dependencies, ordering
- `[Service]` — How to start, stop, restart. What user to run as.
- `[Install]` — When to start (multi-user.target = normal boot)

After creating or modifying a unit file:

```bash
sudo systemctl daemon-reload      # reload unit file definitions
sudo systemctl start myapp        # start the new service
sudo systemctl enable myapp       # enable at boot
```

### journalctl: Reading logs

systemd captures all stdout and stderr from services into the journal.

```bash
journalctl -u nginx               # all logs for nginx
journalctl -u nginx --since today  # today's logs
journalctl -u nginx -f            # follow (live tail)
journalctl -u nginx --since "2024-01-15 10:00" --until "2024-01-15 11:00"
journalctl -u nginx -n 50        # last 50 lines
journalctl -u nginx -p err       # only errors
journalctl -b                     # all logs since last boot
journalctl --disk-usage           # how much space logs consume
```

---

## macOS: launchd

macOS uses `launchd` as its init system (PID 1). It serves the same role as systemd on Linux but has a different interface.

### launchctl: The control command

```bash
# List loaded services
launchctl list                    # all loaded services
launchctl list | grep postgres    # find specific service

# Start/stop services (modern syntax)
sudo launchctl bootstrap system /Library/LaunchDaemons/com.example.myapp.plist
sudo launchctl bootout system /Library/LaunchDaemons/com.example.myapp.plist

# Legacy syntax (still commonly used)
sudo launchctl load /Library/LaunchDaemons/com.example.myapp.plist
sudo launchctl unload /Library/LaunchDaemons/com.example.myapp.plist

# Check if running
launchctl list com.example.myapp  # shows PID if running, status code
```

### plist files

launchd services are defined by property list (plist) files in XML format.

Locations:

| Directory | Scope | When |
|-----------|-------|------|
| `~/Library/LaunchAgents/` | Per-user services | On user login |
| `/Library/LaunchAgents/` | All-user services | On user login |
| `/Library/LaunchDaemons/` | System-wide services | At boot |
| `/System/Library/LaunchDaemons/` | Apple system services | At boot (don't modify) |

Example plist (`~/Library/LaunchAgents/com.myapp.server.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.myapp.server</string>

    <key>ProgramArguments</key>
    <array>
        <string>/opt/myapp/bin/server</string>
        <string>--port</string>
        <string>8080</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>WorkingDirectory</key>
    <string>/opt/myapp</string>

    <key>StandardOutPath</key>
    <string>/var/log/myapp/stdout.log</string>

    <key>StandardErrorPath</key>
    <string>/var/log/myapp/stderr.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>RUST_LOG</key>
        <string>info</string>
    </dict>
</dict>
</plist>
```

Key properties:
- `Label` — Unique identifier for the service
- `ProgramArguments` — Command and arguments as an array
- `RunAtLoad` — Start when the plist is loaded (at boot or login)
- `KeepAlive` — Restart if the process dies
- `WorkingDirectory` — The process's working directory

### macOS log: Reading system logs

```bash
log show --predicate 'process == "myapp"' --last 1h
log show --predicate 'subsystem == "com.apple.network"' --last 5m
log stream --predicate 'process == "postgres"'    # live follow
```

The macOS unified log system replaced traditional syslog files. It is powerful but the query syntax takes getting used to.

---

## Homebrew Services

If you use Homebrew (and you probably do on macOS), it provides a simplified wrapper around launchd for installed services.

```bash
brew services list                # show all Homebrew-managed services
brew services start postgresql@16 # start PostgreSQL
brew services stop postgresql@16  # stop PostgreSQL
brew services restart postgresql@16
brew services start redis         # start Redis
brew services info postgresql@16  # show details

# What brew services does under the hood:
# It creates/manages plist files in ~/Library/LaunchAgents/
# and uses launchctl to load/unload them
```

This is by far the easiest way to manage development services on macOS. Behind the scenes, `brew services start` creates a plist in `~/Library/LaunchAgents/` and loads it with `launchctl`.

---

## Common Services You Will Encounter

| Service | What it does | Command |
|---------|-------------|---------|
| PostgreSQL | Relational database | `brew services start postgresql@16` |
| Redis | In-memory key-value store | `brew services start redis` |
| nginx | Web server / reverse proxy | `brew services start nginx` |
| Docker Desktop | Container runtime | Managed by Docker.app on macOS |
| sshd | SSH server | `sudo systemctl start sshd` (Linux) |

---

## Creating Your Own Service

### On Linux (systemd)

```bash
sudo cat > /etc/systemd/system/myapi.service <<'EOF'
[Unit]
Description=My Rust API
After=network.target

[Service]
Type=simple
User=www-data
ExecStart=/opt/myapi/target/release/myapi
Restart=on-failure
RestartSec=3
Environment=RUST_LOG=info
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl start myapi
sudo systemctl enable myapi
sudo systemctl status myapi
```

### On macOS (launchd via plist)

```bash
cat > ~/Library/LaunchAgents/com.myapi.server.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.myapi.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/myapi/target/release/myapi</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>8080</string>
        <key>RUST_LOG</key>
        <string>info</string>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/myapi.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/myapi.stderr.log</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.myapi.server.plist
```

---

## Exercises

### Exercise 1: Explore running services (macOS)

```bash
# List all loaded launchd services
launchctl list | head -20

# Count loaded services
launchctl list | wc -l

# Find Homebrew services
brew services list

# Find Apple services
launchctl list | grep "com.apple" | head -10
```

### Exercise 2: Manage a Homebrew service

```bash
# Check if you have PostgreSQL installed
brew list | grep postgres

# If not installed:
# brew install postgresql@16

# Start PostgreSQL
brew services start postgresql@16

# Verify it's running
brew services list
lsof -i :5432

# Check the plist file it created
ls ~/Library/LaunchAgents/ | grep postgres
cat ~/Library/LaunchAgents/homebrew.mxcl.postgresql@16.plist

# Stop PostgreSQL
brew services stop postgresql@16

# Verify it stopped
lsof -i :5432
```

### Exercise 3: View service logs

```bash
# View recent system logs (macOS)
log show --last 5m | tail -20

# View logs for a specific process
log show --predicate 'process == "postgres"' --last 1h --info

# On Linux, you would use:
# journalctl -u postgresql --since "1 hour ago"
# journalctl -f -u postgresql    # follow mode
```

### Exercise 4: Create a simple service (macOS)

```bash
# Create a simple script that logs the date every 30 seconds
mkdir -p ~/bin
cat > ~/bin/time-logger.sh <<'EOF'
#!/bin/bash
while true; do
    echo "$(date '+%Y-%m-%d %H:%M:%S') - heartbeat"
    sleep 30
done
EOF
chmod +x ~/bin/time-logger.sh

# Create a launchd plist
cat > ~/Library/LaunchAgents/com.learn.timelogger.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.learn.timelogger</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>~/bin/time-logger.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/time-logger.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/time-logger.err</string>
</dict>
</plist>
EOF

# Load the service
launchctl load ~/Library/LaunchAgents/com.learn.timelogger.plist

# Check it's running
launchctl list | grep timelogger

# Watch the log
tail -f /tmp/time-logger.log

# Stop and remove when done
launchctl unload ~/Library/LaunchAgents/com.learn.timelogger.plist
rm ~/Library/LaunchAgents/com.learn.timelogger.plist
rm ~/bin/time-logger.sh
```

---

Next: [Lesson 09 — Shell Scripting](./09-shell-scripting.md)
