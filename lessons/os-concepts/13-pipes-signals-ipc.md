# Lesson 13: Pipes, Signals, and IPC

Processes are isolated by design — each has its own memory space, its
own file descriptors, its own view of the world. But processes need to
talk to each other. Inter-Process Communication (IPC) is how they do it.

This lesson covers the three most common Unix IPC mechanisms: pipes,
signals, and Unix domain sockets.

---

## IPC Overview

```
IPC Mechanisms (fastest → most flexible):

Speed      Mechanism           Direction    Best For
──────────────────────────────────────────────────────
Fastest    Shared memory       Bidirectional  Bulk data, databases
           (lesson 12)

Fast       Pipes               Unidirectional Streaming data between
                                              related processes

Fast       Unix domain sockets Bidirectional  Client-server on same
           (lesson 14)                        machine

Medium     Signals             One-way notify  Process control
                                              (stop, reload, etc.)

Slower     Message queues      Bidirectional  Decoupled messaging

Slowest    TCP sockets         Bidirectional  Cross-machine comms
```

---

## Pipes — One-Way Data Channels

A pipe is a unidirectional byte stream between two processes. One
process writes, the other reads.

**Analogy: pneumatic tube system**

A pipe is like the pneumatic tube systems in old banks or hospitals.
You put a capsule (data) in one end, and it shoots through the tube
to come out the other end. The tube only goes one direction. You can't
send a capsule back through the same tube.

```
Process A (writer)              Process B (reader)
┌──────────────┐                ┌──────────────┐
│              │                │              │
│ write(fd) ───┼──→ ═══════ ──→┼─── read(fd)  │
│              │     pipe       │              │
│              │   (kernel      │              │
│              │    buffer,     │              │
│              │    ~64 KB)     │              │
└──────────────┘                └──────────────┘
```

### How Pipes Work

A pipe is a kernel buffer (typically 64 KB on Linux). It has two file
descriptors: one for reading, one for writing.

```
pipe() syscall returns two fds:
  pipe_fds[0] = read end
  pipe_fds[1] = write end

Writer:  write(pipe_fds[1], data, len)
         data goes into kernel buffer

Reader:  read(pipe_fds[0], buf, len)
         data comes out of kernel buffer

If buffer is full:   write() blocks (writer waits)
If buffer is empty:  read() blocks (reader waits)
If write end closed: read() returns 0 (EOF)
If read end closed:  write() gets SIGPIPE (broken pipe)
```

### Anonymous Pipes (the `|` operator)

When you type `ls | grep foo`, the shell:

1. Creates a pipe: `pipe()` → read_fd, write_fd
2. Forks child 1 (for `ls`):
   - Close read_fd (ls doesn't read from the pipe)
   - Redirect stdout (fd 1) to write_fd: `dup2(write_fd, 1)`
   - Exec `ls`
3. Forks child 2 (for `grep`):
   - Close write_fd (grep doesn't write to the pipe)
   - Redirect stdin (fd 0) to read_fd: `dup2(read_fd, 0)`
   - Exec `grep foo`
4. Close both pipe fds in the parent
5. Wait for both children

```
Shell: ls | grep foo

Before:
  Shell:  fd 0=stdin, 1=stdout, 2=stderr
          Creates pipe: read_fd=3, write_fd=4

After fork + dup2 + exec:

  ls (child 1):                    grep (child 2):
  ┌────────────────┐              ┌────────────────┐
  │ fd 0: stdin    │              │ fd 0: pipe_read │ ← reads from pipe
  │ fd 1: pipe_write│ ← writes   │ fd 1: stdout    │
  │ fd 2: stderr   │   to pipe   │ fd 2: stderr    │
  └────────────────┘              └────────────────┘
            │                              ▲
            └──── kernel pipe buffer ──────┘
```

### Named Pipes (FIFOs)

Anonymous pipes only work between related processes (parent-child).
Named pipes have a path in the file system and can connect unrelated
processes.

```bash
# Create a named pipe
mkfifo /tmp/my_pipe

# Terminal 1 (reader) — this will block until someone writes
cat /tmp/my_pipe

# Terminal 2 (writer)
echo "Hello through the pipe!" > /tmp/my_pipe

# Clean up
rm /tmp/my_pipe
```

Named pipes look like files but behave like pipes — data flows through
the kernel buffer, it's not stored on disk.

---

## Signals — Asynchronous Process Notifications

A signal is a software interrupt delivered to a process. It interrupts
whatever the process is doing and runs a signal handler (or takes a
default action).

**Analogy: tapping someone on the shoulder**

Signals are like tapping someone on the shoulder while they're working.
They stop what they're doing, deal with the interruption, then go back
to work. Some taps are polite requests ("please finish up" = SIGTERM),
some are forceful ("STOP RIGHT NOW" = SIGKILL).

### Common Signals

```
Signal    Number  Default Action  Meaning
────────────────────────────────────────────────────────
SIGTERM     15    Terminate       "Please shut down gracefully"
                                  (can be caught and handled)

SIGKILL      9    Terminate       "Die immediately"
                                  (CANNOT be caught or ignored)

SIGINT       2    Terminate       Ctrl+C from terminal

SIGHUP       1    Terminate       Terminal closed / "reload config"

SIGQUIT      3    Core dump       Ctrl+\ from terminal

SIGSTOP     19    Stop            Pause process (CANNOT be caught)

SIGCONT     18    Continue        Resume paused process

SIGUSR1     10    Terminate       User-defined signal 1
SIGUSR2     12    Terminate       User-defined signal 2

SIGCHLD     17    Ignore          Child process stopped or exited

SIGPIPE     13    Terminate       Write to pipe with no reader

SIGSEGV     11    Core dump       Invalid memory access (segfault)

SIGALRM     14    Terminate       Alarm timer expired
```

### Sending Signals

```bash
# Send SIGTERM (default)
kill <PID>
kill -TERM <PID>
kill -15 <PID>

# Send SIGKILL (force kill)
kill -9 <PID>
kill -KILL <PID>

# Send SIGINT (like Ctrl+C)
kill -INT <PID>

# Send to all processes with a name
killall -TERM my_server
pkill -TERM my_server

# Send SIGHUP (often used for "reload config")
kill -HUP <PID>
```

### Signal Flow

```
                       Signal Delivery
                       ═══════════════

Another process                     Target process
(or the kernel)                     ┌─────────────────┐
       │                            │ Running          │
       │  kill(pid, SIGTERM)        │ normal code      │
       │         │                  │     ...          │
       └─────────┼──────────────→   │ ─── INTERRUPTED  │
                 │                  │     │            │
                 │                  │     ▼            │
                 │                  │ Signal handler   │
                 │                  │   (your code)    │
                 │                  │     │            │
                 │                  │     ▼            │
                 │                  │ Resume normal    │
                 │                  │ code             │
                 │                  └─────────────────┘

For SIGKILL / SIGSTOP:
  → No handler runs, kernel takes action directly
```

### Signal Handlers

A signal handler is a function that runs when a signal is delivered.
The process was doing something else — the handler interrupts it.

Important rules for signal handlers:
- Must be **async-signal-safe** (can't use malloc, printf, mutex lock)
- Should be as short as possible
- Typically: set a flag (atomic bool), then return
- The main loop checks the flag and does the actual work

```
                      Signal Handler Pattern

Main loop:                          Signal handler:
┌───────────────────────┐           ┌───────────────────────┐
│ loop {                │           │ fn handle_sigterm() {  │
│   if SHOULD_STOP {    │  ← checks│   SHOULD_STOP = true;  │
│     cleanup();        │           │ }                      │
│     break;            │           │                        │
│   }                   │  flag ──→ │ (sets atomic bool)     │
│   do_work();          │           └───────────────────────┘
│ }                     │
└───────────────────────┘
```

---

## Rust: Pipes with std::process

### Piping output between programs

```rust
use std::process::{Command, Stdio};
use std::io::{Read, Write};

fn pipe_between_commands() -> std::io::Result<()> {
    let mut ls = Command::new("ls")
        .arg("/etc")
        .stdout(Stdio::piped())
        .spawn()?;

    let ls_stdout = ls.stdout.take().expect("failed to capture stdout");

    let grep = Command::new("grep")
        .arg("host")
        .stdin(Stdio::from(ls_stdout))
        .output()?;

    ls.wait()?;

    println!("Filtered output:");
    println!("{}", String::from_utf8_lossy(&grep.stdout));

    Ok(())
}
```

### Reading from a child's stdout

```rust
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};

fn read_child_output() -> std::io::Result<()> {
    let mut child = Command::new("ping")
        .args(["-c", "4", "127.0.0.1"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let stdout = child.stdout.take().expect("failed to capture stdout");
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        let line = line?;
        println!("[PING] {}", line);
    }

    let status = child.wait()?;
    println!("Ping exited with: {}", status);

    Ok(())
}
```

### Writing to a child's stdin

```rust
use std::process::{Command, Stdio};
use std::io::Write;

fn write_to_child() -> std::io::Result<()> {
    let mut child = Command::new("wc")
        .arg("-l")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()?;

    {
        let stdin = child.stdin.as_mut().expect("failed to get stdin");
        writeln!(stdin, "line one")?;
        writeln!(stdin, "line two")?;
        writeln!(stdin, "line three")?;
    }

    let output = child.wait_with_output()?;
    println!("wc -l says: {}", String::from_utf8_lossy(&output.stdout).trim());

    Ok(())
}
```

### Building a pipeline (cmd1 | cmd2 | cmd3)

```rust
use std::process::{Command, Stdio};

fn pipeline() -> std::io::Result<()> {
    let mut find = Command::new("find")
        .args([".", "-name", "*.rs"])
        .stdout(Stdio::piped())
        .spawn()?;

    let find_out = find.stdout.take().unwrap();

    let mut sort = Command::new("sort")
        .stdin(Stdio::from(find_out))
        .stdout(Stdio::piped())
        .spawn()?;

    let sort_out = sort.stdout.take().unwrap();

    let head = Command::new("head")
        .arg("-5")
        .stdin(Stdio::from(sort_out))
        .output()?;

    find.wait()?;
    sort.wait()?;

    println!("First 5 .rs files:");
    print!("{}", String::from_utf8_lossy(&head.stdout));

    Ok(())
}
```

---

## Rust: Signal Handling with signal-hook

```rust
// Cargo.toml:
// signal-hook = "0.3"

use signal_hook::consts::{SIGINT, SIGTERM};
use signal_hook::flag;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

fn main() {
    let running = Arc::new(AtomicBool::new(true));

    flag::register(SIGINT, Arc::clone(&running)).expect("failed to register SIGINT");
    flag::register(SIGTERM, Arc::clone(&running)).expect("failed to register SIGTERM");

    println!("PID: {}. Press Ctrl+C or send SIGTERM to stop.", std::process::id());

    let mut count = 0u64;
    while running.load(Ordering::Relaxed) {
        count += 1;
        println!("Working... iteration {}", count);
        thread::sleep(Duration::from_secs(1));
    }

    println!("Received shutdown signal. Cleaning up...");
    println!("Completed {} iterations.", count);
}
```

### More advanced signal handling with channels

```rust
use signal_hook::consts::{SIGINT, SIGTERM, SIGUSR1};
use signal_hook::iterator::Signals;
use std::thread;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut signals = Signals::new([SIGINT, SIGTERM, SIGUSR1])?;

    let handle = signals.handle();

    let signal_thread = thread::spawn(move || {
        for signal in signals.forever() {
            match signal {
                SIGINT => {
                    println!("\nReceived SIGINT (Ctrl+C) — shutting down");
                    break;
                }
                SIGTERM => {
                    println!("Received SIGTERM — shutting down");
                    break;
                }
                SIGUSR1 => {
                    println!("Received SIGUSR1 — printing status");
                }
                _ => unreachable!(),
            }
        }
    });

    println!("PID: {}", std::process::id());
    println!("Send SIGUSR1 for status, SIGINT/SIGTERM to stop");
    println!("  kill -USR1 {}", std::process::id());

    signal_thread.join().unwrap();
    handle.close();

    println!("Goodbye!");
    Ok(())
}
```

---

## Unix Domain Sockets (Brief Intro)

Unix domain sockets are like TCP sockets but for processes on the same
machine. They use a file path instead of IP:port and are significantly
faster than TCP (no network stack overhead).

```
TCP socket:                     Unix domain socket:
  IP:port → network stack       file path → kernel shortcut
  → TCP/IP processing           → direct memory copy
  → loopback interface           between processes
  (many layers)                  (minimal layers)
```

We'll cover these in depth in Lesson 14.

---

## Message Queues (Brief Overview)

POSIX message queues allow processes to send discrete messages with
priorities. Unlike pipes (which are byte streams), message queues
preserve message boundaries.

```
Pipe:    write("hel") + write("lo")  →  read might get "hello" (merged)
Queue:   send("hello") + send("world") → recv gets "hello" then "world"
```

In practice, Unix domain sockets have largely replaced message queues
for new code. But you'll encounter them in older systems and embedded
applications.

---

## Choosing an IPC Mechanism

```
Need to...                               Use...
─────────────────────────────────────────────────────
Stream data parent→child                 Pipe (anonymous)
Stream data between unrelated procs      Named pipe or Unix socket
Send structured messages                 Unix domain socket
Notify a process (start, stop, reload)   Signal
Share large data with zero copy          Shared memory (mmap)
Build client-server on same machine      Unix domain socket
Build client-server across machines      TCP socket
```

---

## Exercises

### Exercise 1: Pipe Two Rust Programs

Create two separate Rust programs:

**producer.rs** — writes numbered lines to stdout:
```rust
use std::io::{self, Write};

fn main() -> io::Result<()> {
    let mut stdout = io::stdout().lock();
    for i in 1..=20 {
        writeln!(stdout, "Message {}: The quick brown fox", i)?;
    }
    Ok(())
}
```

**consumer.rs** — reads from stdin, counts lines, prints summary:
```rust
use std::io::{self, BufRead};

fn main() -> io::Result<()> {
    let stdin = io::stdin();
    let mut count = 0;
    let mut total_bytes = 0;

    for line in stdin.lock().lines() {
        let line = line?;
        count += 1;
        total_bytes += line.len();
        eprintln!("[consumer] Got: {}", line);
    }

    println!("Processed {} lines, {} total bytes", count, total_bytes);
    Ok(())
}
```

Run them connected with a pipe:
```bash
cargo build --release
./target/release/producer | ./target/release/consumer
```

### Exercise 2: Named Pipe Communication

Create a named pipe and send data between two terminals:

```bash
# Create the pipe
mkfifo /tmp/rust_pipe

# Terminal 1: Read from pipe (blocks until data arrives)
cat /tmp/rust_pipe

# Terminal 2: Write to pipe
echo "Hello through the named pipe!" > /tmp/rust_pipe
```

Now write a Rust program that reads from a named pipe:
```rust
use std::fs::File;
use std::io::{BufRead, BufReader};

fn main() -> std::io::Result<()> {
    println!("Waiting for data on /tmp/rust_pipe...");
    let file = File::open("/tmp/rust_pipe")?;
    let reader = BufReader::new(file);

    for line in reader.lines() {
        let line = line?;
        println!("Received: {}", line);
    }

    println!("Pipe closed.");
    Ok(())
}
```

### Exercise 3: Graceful Shutdown with Signals

Write a server-like program that:
1. Starts a work loop (printing a counter every second)
2. On SIGINT (Ctrl+C): prints "Shutting down..." and exits cleanly
3. On SIGUSR1: prints current statistics without stopping

Test it:
```bash
cargo run &
kill -USR1 $!    # trigger status report
kill -USR1 $!    # trigger again
kill -INT $!     # graceful shutdown
```

### Exercise 4: Build a Three-Stage Pipeline in Rust

Build a pipeline in a single Rust program using `std::process::Command`:

1. Stage 1: `find . -name "*.rs"` (find all Rust files)
2. Stage 2: `xargs wc -l` (count lines in each)
3. Stage 3: `sort -n` (sort by line count)

Connect them with pipes and print the final output.

---

Next: [Lesson 14: Sockets as IPC](./14-sockets-ipc.md)
