# Lesson 12: Debugging Tools — strace, lsof, netstat, htop

When something goes wrong in production or on your local machine — a process hangs, a port is already in use, a server is not responding — these tools let you look under the hood and understand exactly what is happening. They answer questions that no amount of log reading can.

---

## The Debugging Mindset

Before reaching for any tool, ask a clear question:

- "What is using port 3000?" → `lsof`
- "Why is this process stuck?" → `strace/dtruss` + `htop`
- "Is my server actually listening?" → `netstat/ss` or `lsof`
- "What files does this process have open?" → `lsof`
- "What system calls is this program making?" → `strace/dtruss`
- "Is this a network problem or a server problem?" → `tcpdump` + `curl`

---

## strace (Linux) / dtruss (macOS): Watch System Calls

Every interaction between a program and the operating system happens through system calls — opening files, reading network data, allocating memory, forking processes. `strace` lets you watch these calls in real time.

### Linux: strace

```bash
strace ls /tmp                   # trace all syscalls made by ls
strace -e trace=open,read ls     # only show open and read calls
strace -p 1234                   # attach to running process
strace -c ls /tmp                # summary: count and time each syscall
strace -f cargo build            # follow child processes (fork)
strace -e trace=network curl http://example.com  # only network calls
```

### macOS: dtruss

macOS does not have strace. The equivalent is `dtruss`, which requires `sudo`:

```bash
sudo dtruss ls /tmp              # trace syscalls
sudo dtruss -p 1234              # attach to running process
sudo dtruss -f cargo build       # follow forks
```

On recent macOS versions, System Integrity Protection (SIP) may restrict `dtruss`. You might need to use `dtrace` directly or Instruments.app for profiling.

The examples below use Linux `strace` syntax unless noted. On macOS,
translate them to `sudo dtruss` where possible.

### What to look for

```bash
# Program can't find a file? Look for failed open() calls
strace -e trace=open,openat myprogram 2>&1 | grep "ENOENT"

# Program hanging? See what syscall it's stuck on
strace -p $(pgrep myprogram)
# If you see: read(5,  — it's waiting for input on file descriptor 5
# Use lsof to find what fd 5 is

# Slow startup? Time the syscalls
strace -T myprogram 2>&1 | sort -t'<' -k2 -rn | head -20
```

### Practical example: Why is my program slow to start?

```bash
# Linux
strace -T -e trace=open,openat node server.js 2>&1 | grep -v "ENOENT" | sort -t'<' -k2 -rn | head -10

# This shows the slowest file opens, which might reveal:
# - Slow NFS mounts
# - Reading huge config files
# - Opening thousands of node_modules files
```

---

## lsof: List Open Files

`lsof` (list open files) is one of the most versatile debugging tools. Since Unix treats everything as a file (network connections, pipes, devices), `lsof` can answer a huge range of questions.

### What is using a specific port?

This is probably the most common use:

```bash
lsof -i :3000                   # what process is on port 3000
lsof -i :8080                   # what process is on port 8080
lsof -i :5432                   # what's using the PostgreSQL port
```

Output:

```
COMMAND   PID    USER   FD   TYPE   DEVICE SIZE/OFF NODE NAME
node    12345 augustus   22u  IPv6 0x1234   0t0      TCP *:3000 (LISTEN)
```

### What's listening on any port?

```bash
lsof -i -P -n | grep LISTEN     # all listening ports
# -P = don't convert port numbers to service names
# -n = don't resolve hostnames
```

### What files does a process have open?

```bash
lsof -p 1234                    # all files open by PID 1234
lsof -c postgres                # all files open by processes named "postgres"
lsof -c node                    # all files open by node processes
```

### Who is using a specific file?

```bash
lsof /var/log/system.log        # who has this file open
lsof +D /var/log                # all open files in this directory
lsof +D /tmp                    # what's using temp files
```

### Network connections for a process

```bash
lsof -i -a -p 1234              # network connections for PID 1234
# -a = AND (both -i and -p must match)
```

### Find processes with deleted files still open

```bash
lsof | grep deleted             # files deleted but still held open by a process
# This is a common reason for disk space not being freed
```

---

## netstat / ss: Network Connections

### netstat (available on macOS and Linux)

```bash
netstat -an                      # all connections, numeric (no DNS resolution)
netstat -an | grep LISTEN        # all listening ports
netstat -an | grep ESTABLISHED   # all active connections
netstat -an | grep ":8080"       # connections on port 8080
```

### ss (Linux only, faster replacement for netstat)

```bash
ss -tlnp                        # TCP, listening, numeric, show process
ss -tunlp                       # TCP and UDP, listening
ss -s                           # connection statistics summary
ss state established            # only established connections
ss dst 10.0.1.50                # connections to a specific host
```

### Which to use?

On macOS: use `lsof -i` (more informative than macOS `netstat`).
On Linux: use `ss` (faster than `netstat`, more features).

---

## htop: Interactive Process Viewer

`htop` is an improved `top` that you should install immediately:

```bash
brew install htop                # macOS
```

### Navigating htop

| Key | Action |
|-----|--------|
| Arrow keys | Navigate process list |
| `F1` | Help |
| `F2` | Setup (customize display) |
| `F3` | Search by name |
| `F4` | Filter (only show matching) |
| `F5` | Tree view (parent-child relationships) |
| `F6` | Sort by column |
| `F9` | Send signal to process |
| `F10` | Quit |
| `Space` | Tag process (for batch operations) |
| `u` | Filter by user |
| `H` | Toggle threads |
| `t` | Toggle tree view |

### What to look for

- **CPU bars** — Is a process consuming all CPU? Is it one core or all of them?
- **Memory bars** — Is memory nearly full? Is swap being used?
- **Load average** — Numbers above your CPU count mean the system is overloaded.
- **Process state** — `R` = running, `S` = sleeping, `D` = disk wait (I/O bound), `Z` = zombie.
- **RES column** — Actual physical memory used by the process. `VIRT` is virtual memory (often misleadingly large).

---

## tcpdump: Capture Network Packets

`tcpdump` captures and displays network traffic. Useful for debugging network issues, API calls, and connection problems.

```bash
# Capture on any interface (requires sudo)
sudo tcpdump -i any                        # all traffic
sudo tcpdump -i any port 8080              # only port 8080
sudo tcpdump -i any host 10.0.1.50        # only traffic to/from this host
sudo tcpdump -i any port 80 -A            # show HTTP content in ASCII
sudo tcpdump -i lo0 port 5432             # PostgreSQL on loopback (macOS)

# Save capture to file for analysis
sudo tcpdump -i any port 8080 -w capture.pcap

# Read saved capture
tcpdump -r capture.pcap
```

### Common filters

```bash
sudo tcpdump port 443                      # HTTPS traffic
sudo tcpdump 'tcp[tcpflags] & (tcp-syn) != 0'  # SYN packets (new connections)
sudo tcpdump -i any 'dst port 53'          # DNS queries
```

On macOS, the loopback interface is `lo0` (not `lo` as on Linux).

---

## dmesg: Kernel Messages (Linux)

```bash
dmesg                            # all kernel messages
dmesg | tail -20                 # recent kernel messages
dmesg -T                         # human-readable timestamps
dmesg | grep -i error            # kernel errors
dmesg | grep -i "usb\|disk"     # USB and disk events
```

On macOS, kernel messages are in the unified log:

```bash
log show --predicate 'sender == "kernel"' --last 5m
```

---

## Practical Debugging Scenarios

### Scenario 1: "Something is already using port 3000"

```bash
# Find what's using the port
lsof -i :3000

# Output: node  12345  augustus  22u  IPv6 ...  TCP *:3000 (LISTEN)

# Kill it if needed
kill 12345

# Verify it's free
lsof -i :3000
```

### Scenario 2: "My process is using too much memory"

```bash
# Find the process
ps aux | sort -k4 -rn | head -5

# Or use htop and sort by %MEM (press F6, select %MEM)

# See what files it has open (possible memory-mapped files)
lsof -p PID | wc -l

# Check if it's leaking file descriptors
watch 'lsof -p PID | wc -l'     # if the count keeps growing, it's leaking
```

### Scenario 3: "Why is this process stuck?"

```bash
# Check its state
ps aux | grep PID

# If state is D (uninterruptible sleep), it's waiting on I/O
# If state is S (sleeping), check what it's waiting for:

# Linux:
strace -p PID
# Look at the syscall it's stuck on (read, write, futex, etc.)

# macOS:
sudo dtruss -p PID

# Check if it's waiting on a network connection
lsof -i -a -p PID
```

### Scenario 4: "Is my server actually receiving requests?"

```bash
# Check if it's listening
lsof -i :8080 | grep LISTEN

# Watch for incoming connections
sudo tcpdump -i any port 8080 -c 10      # capture 10 packets

# Test with curl
curl -v http://localhost:8080/health

# Check number of established connections
lsof -i :8080 | grep -c ESTABLISHED
```

### Scenario 5: "The disk is full but I can't find what's using space"

```bash
# Check disk usage
df -h

# Find large directories
du -sh /* 2>/dev/null | sort -rh | head -10
du -sh /var/* 2>/dev/null | sort -rh | head -10

# Find large files
find / -type f -size +100M 2>/dev/null | head -20

# Check for deleted files still held open (disk space not freed)
lsof | grep deleted | sort -k7 -rn | head -10
```

### Scenario 6: "Why is DNS resolution slow?"

```bash
# Time DNS lookups
time nslookup example.com
time dig example.com

# Check what DNS server is being used
cat /etc/resolv.conf             # Linux
scutil --dns | head -20          # macOS

# Trace DNS queries
sudo tcpdump -i any port 53 -c 20
```

---

## macOS-Specific Tools

| Tool | Purpose |
|------|---------|
| `Activity Monitor.app` | GUI process viewer |
| `Instruments.app` | Performance profiling (Xcode) |
| `fs_usage` | Real-time filesystem activity |
| `nettop` | Real-time network usage per process |
| `sample PID` | Sample a process's call stack |

```bash
sudo fs_usage -f filesys         # watch filesystem operations
sudo nettop                      # interactive network usage
sample 1234 5                    # sample process 1234 for 5 seconds
```

---

## Exercises

### Exercise 1: Port investigation

```bash
# Start a test server
python3 -m http.server 9876 &
SERVER_PID=$!

# Find it with lsof
lsof -i :9876

# Check with netstat
netstat -an | grep 9876

# Verify with curl
curl -s http://localhost:9876 > /dev/null && echo "Server responding"

# Kill and verify
kill $SERVER_PID
sleep 1
lsof -i :9876 && echo "Still running" || echo "Port is free"
```

### Exercise 2: Process file descriptors

```bash
# Check how many files your shell has open
lsof -p $$ | wc -l

# Check what files your shell has open
lsof -p $$

# Find processes with the most open files
lsof | awk '{print $2}' | sort | uniq -c | sort -rn | head -10
```

### Exercise 3: Network connections

```bash
# List all listening ports
lsof -i -P -n | grep LISTEN

# Count established connections
lsof -i -P -n | grep -c ESTABLISHED

# Find connections to a specific remote
lsof -i -P -n | grep github
```

### Exercise 4: Resource monitoring

```bash
# Open htop
htop

# While htop is running in one terminal, in another terminal:

# Create CPU load
yes > /dev/null &
YES_PID=$!

# Watch it appear in htop (sort by CPU with F6)
# Notice CPU bar fill up

# Kill the load generator
kill $YES_PID
```

### Exercise 5: Filesystem debugging (macOS)

```bash
# Watch filesystem activity
sudo fs_usage -f filesys -w 2>/dev/null | head -50

# In another terminal, do some file operations
touch /tmp/test-{1..10}.txt
ls /tmp/test-*.txt
rm /tmp/test-*.txt

# See the operations appear in fs_usage
```

---

Next: [Lesson 13 — Docker](./13-docker.md)
