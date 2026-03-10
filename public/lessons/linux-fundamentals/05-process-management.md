# Lesson 05: Process Management — ps, top, kill, jobs

Every running program on your system is a process. When you run `cargo build`, that is a process. When PostgreSQL serves queries, that is a process. Your shell itself is a process. Understanding how to inspect, control, and terminate processes is fundamental to working with Unix systems.

---

## What Is a Process?

A process is a running instance of a program. Each process has:

- **PID** — Process ID, a unique number assigned by the kernel
- **PPID** — Parent Process ID (the process that spawned it)
- **UID** — User ID of the owner
- **State** — Running, sleeping, stopped, zombie
- **File descriptors** — Open files, sockets, pipes
- **Environment** — Inherited environment variables
- **Memory** — Its own virtual address space

When you type `ls` in your shell, the shell (parent process) forks a copy of itself, then the child process exec's the `ls` program. This fork+exec model means every process (except PID 1) has a parent.

```bash
echo $$                    # current shell's PID
echo $PPID                 # parent's PID
```

---

## ps: List Processes

`ps` shows a snapshot of current processes.

### Common invocations

```bash
ps                         # processes in your current terminal session
ps aux                     # all processes, all users (BSD style — common on macOS)
ps -ef                     # all processes (System V style — common on Linux)
```

### Reading ps aux output

```
USER       PID  %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1   0.0  0.1  34564  4872 ?        Ss   Jan14   0:03 /sbin/init
augustus   1234   2.3  1.2 456789 12345 pts/0    S    10:30   0:05 cargo build
```

| Column | Meaning |
|--------|---------|
| USER | Process owner |
| PID | Process ID |
| %CPU | CPU usage percentage |
| %MEM | Memory usage percentage |
| VSZ | Virtual memory size (KB) |
| RSS | Resident Set Size — actual physical memory used (KB) |
| TTY | Terminal associated with process (`?` = no terminal, daemon) |
| STAT | Process state |
| START | When the process started |
| TIME | Total CPU time consumed |
| COMMAND | The command that launched the process |

### Process states (STAT column)

| State | Meaning |
|-------|---------|
| `R` | Running or runnable |
| `S` | Sleeping (waiting for input/event) |
| `D` | Uninterruptible sleep (usually I/O) |
| `T` | Stopped (suspended with Ctrl+Z) |
| `Z` | Zombie (finished but parent hasn't collected exit status) |

Additional characters after the state:
- `s` — session leader
- `+` — foreground process group
- `l` — multi-threaded
- `<` — high priority
- `N` — low priority

### Filtering processes

```bash
ps aux | grep postgres           # find postgres processes
ps aux | grep -v grep | grep postgres  # exclude the grep process itself
pgrep -f postgres                # PIDs of processes matching "postgres"
pgrep -la postgres               # PIDs and full command lines
```

### Process tree

```bash
ps -ef --forest                  # show process tree (Linux)
pstree                           # tree view of all processes (install via brew on macOS)
```

---

## top and htop: Real-Time Monitoring

### top

`top` shows processes in real time, updating every few seconds.

```bash
top                              # launch interactive viewer
```

Inside `top`:
- `q` — quit
- `P` — sort by CPU (default on macOS)
- `M` — sort by memory
- `k` — kill a process (type PID, then signal)
- `1` — toggle per-CPU display (Linux)

macOS `top` differs slightly from Linux. To get Linux-like sorting:

```bash
top -o cpu                       # sort by CPU (macOS)
top -o mem                       # sort by memory (macOS)
```

### htop (recommended)

`htop` is an improved version of `top` with color, mouse support, and easier navigation.

```bash
brew install htop                # install on macOS
htop                             # launch
```

Inside `htop`:
- Arrow keys to navigate
- `F6` — choose sort column
- `F9` — send signal (kill)
- `F5` — tree view
- `F4` — filter by name
- `/` — search
- `q` — quit

`htop` also shows CPU and memory as visual bars, making it much easier to assess system health at a glance.

---

## Signals: Communicating with Processes

Signals are how the kernel and other processes communicate with a running process. When you press `Ctrl+C`, you are sending a signal.

### Common signals

| Signal | Number | Keyboard | Behavior |
|--------|--------|----------|----------|
| SIGINT | 2 | Ctrl+C | Interrupt — politely ask to stop (program can catch and handle) |
| SIGTERM | 15 | (none) | Terminate — default signal from `kill`. Polite shutdown request |
| SIGKILL | 9 | (none) | Kill — forcefully terminate. Cannot be caught or ignored |
| SIGTSTP | 20 | Ctrl+Z | Suspend — pause the process |
| SIGCONT | 18 | (none) | Continue — resume a stopped process |
| SIGHUP | 1 | (none) | Hangup — terminal closed. Many daemons reload config on SIGHUP |
| SIGQUIT | 3 | Ctrl+\ | Quit — like SIGINT but produces a core dump |

### kill: Send Signals

Despite the name, `kill` sends any signal. The default is SIGTERM (15).

```bash
kill 1234                        # send SIGTERM to PID 1234
kill -TERM 1234                  # same thing, explicit
kill -15 1234                    # same thing, by number

kill -9 1234                     # SIGKILL — force kill (last resort)
kill -KILL 1234                  # same thing

kill -STOP 1234                  # pause the process
kill -CONT 1234                  # resume the process
```

**Always try SIGTERM before SIGKILL.** SIGTERM lets the process clean up (close files, flush buffers, release locks). SIGKILL terminates immediately with no cleanup — which can corrupt data, leave lock files, or orphan child processes.

### killall and pkill

```bash
killall firefox                  # kill all processes named "firefox"
pkill -f "node server.js"       # kill processes matching the full command line
pkill -u augustus                 # kill all processes owned by user
```

---

## Job Control: Background and Foreground

Your shell can manage multiple processes as "jobs."

### Running in the background

```bash
cargo build &                    # start command in background
```

The `&` at the end runs the command in the background. The shell prints the job number and PID:

```
[1] 12345
```

### Managing jobs

```bash
jobs                             # list background jobs in current shell
fg                               # bring most recent background job to foreground
fg %2                            # bring job 2 to foreground
bg                               # resume most recent suspended job in background
bg %1                            # resume job 1 in background
```

### The typical workflow

1. Start a long-running command: `make`
2. Realize you need the terminal: press `Ctrl+Z` (suspends the process)
3. See the suspended job: `jobs` shows `[1]+ Stopped make`
4. Resume it in the background: `bg %1`
5. Later, bring it back: `fg %1`

### Keeping processes running after logout

When you close your terminal, the shell sends SIGHUP to all its child processes, which typically kills them. Two ways to prevent this:

```bash
nohup long-running-command &     # immune to SIGHUP, output goes to nohup.out
disown %1                       # remove job from shell's job table (won't get SIGHUP)
```

For persistent sessions, use `tmux` or `screen` — they create sessions that survive terminal disconnection.

---

## Process Priority: nice and renice

Every process has a "niceness" value from -20 (highest priority) to 19 (lowest priority). Default is 0. Higher niceness = lower priority = nicer to other processes.

```bash
nice -n 10 cargo build           # start with low priority (nice to others)
nice -n -5 important-task        # start with higher priority (needs sudo for negative values)

renice 10 -p 1234                # change priority of running process
renice -5 -p 1234                # increase priority (needs sudo)
```

Practical use: running a CPU-intensive build without slowing down your development environment.

```bash
nice -n 15 make -j8 &           # build in background, low priority
```

---

## lsof: List Open Files

Since everything in Unix is a file (including network connections), `lsof` is incredibly versatile.

### What is using a port?

```bash
lsof -i :3000                   # what process is using port 3000
lsof -i :8080                   # what process is using port 8080
lsof -i -P -n | grep LISTEN    # all listening ports
```

### What files does a process have open?

```bash
lsof -p 1234                    # all files open by PID 1234
lsof -c postgres                # all files open by processes named "postgres"
```

### Who is using a file?

```bash
lsof /var/log/system.log        # what processes have this file open
lsof +D /var/log                # all open files in a directory
```

---

## /proc Filesystem (Linux Only)

On Linux, `/proc` is a virtual filesystem that exposes kernel and process information as files. It does not exist on macOS.

```bash
cat /proc/cpuinfo               # CPU information
cat /proc/meminfo               # memory information
cat /proc/1234/status           # status of process 1234
cat /proc/1234/cmdline          # command line of process 1234
ls /proc/1234/fd/               # file descriptors open by process 1234
cat /proc/loadavg               # system load average
cat /proc/uptime                # system uptime in seconds
```

On macOS, you get similar information through `sysctl` and `Activity Monitor`:

```bash
sysctl -n hw.ncpu               # number of CPUs
sysctl -n hw.memsize            # total memory in bytes
vm_stat                         # memory statistics
```

---

## Exercises

### Exercise 1: Explore running processes

```bash
# See all processes
ps aux | head -20

# Find your shell process
ps aux | grep "$$"

# Count total processes
ps aux | wc -l

# Find the 5 processes using the most memory
ps aux --sort=-%mem | head -6       # Linux
ps aux -r | head -6                 # macOS (sorted by CPU, but shows memory too)

# Find the 5 processes using the most CPU
ps aux --sort=-%cpu | head -6       # Linux
ps aux | sort -k3 -rn | head -6    # works on both
```

### Exercise 2: Job control

```bash
# Start a long-running process
sleep 300 &
echo "Job started with PID $!"

# List jobs
jobs

# Start another, then suspend it
sleep 600
# Press Ctrl+Z

# List jobs again
jobs

# Resume the suspended job in background
bg %2

# Bring the first job to foreground
fg %1

# Kill it with Ctrl+C
```

### Exercise 3: Find and kill processes

```bash
# Start a test process
sleep 1000 &
SLEEP_PID=$!
echo "Started sleep with PID: $SLEEP_PID"

# Verify it's running
ps aux | grep "sleep 1000" | grep -v grep

# Send SIGTERM (polite)
kill $SLEEP_PID

# Verify it stopped
ps aux | grep "sleep 1000" | grep -v grep

# Start another and force kill it
sleep 1000 &
SLEEP_PID=$!
kill -9 $SLEEP_PID

# Verify
jobs
```

### Exercise 4: Port investigation

```bash
# Start a simple HTTP server (Python)
python3 -m http.server 8888 &
SERVER_PID=$!

# Find what's using port 8888
lsof -i :8888

# Check it's listening
curl -s http://localhost:8888 > /dev/null && echo "Server is running"

# Kill the server
kill $SERVER_PID

# Verify port is free
lsof -i :8888
```

### Exercise 5: Monitor with htop

```bash
# Install htop if needed
brew install htop

# Start some CPU-intensive background tasks
for i in {1..3}; do
    yes > /dev/null &
done

# Open htop and observe the CPU usage
htop

# After observing, kill the background jobs
killall yes
```

---

Next: [Lesson 06 — Environment Variables, PATH, and Configuration](./06-environment.md)
