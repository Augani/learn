# Lesson 10: The Process Model — How Programs Run on an OS

## The Recipe vs. The Cooking

You have a cookbook on your shelf. That's a **program** — instructions sitting on disk,
doing nothing. Now you open the book, gather ingredients, fire up the stove, and start
cooking. *That* is a **process** — a program that's actively running.

One recipe can be cooked by multiple chefs at the same time in different kitchens. Likewise,
one program (like `/usr/bin/python3`) can have dozens of processes running simultaneously.
The program is the blueprint. The process is the live execution.

---

## What Lives Inside a Process

Every process carries a bundle of state with it. Think of it as an apartment that comes
fully furnished the moment someone moves in:

```
┌──────────────────────────────────────────────────────┐
│                  PROCESS (PID 4821)                   │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │    CODE      │  │    DATA     │  │  ENVIRONMENT │  │
│  │  (text seg)  │  │ (globals,   │  │  VARIABLES   │  │
│  │  read-only   │  │  statics)   │  │  PATH=/usr.. │  │
│  │  machine     │  │             │  │  HOME=/home  │  │
│  │  instructions│  │             │  │  LANG=en_US  │  │
│  └─────────────┘  └─────────────┘  └──────────────┘  │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │    STACK     │  │    HEAP     │  │  OPEN FILES  │  │
│  │  function    │  │  dynamic    │  │  fd 0: stdin │  │
│  │  call frames │  │  allocations│  │  fd 1: stdout│  │
│  │  local vars  │  │  malloc/new │  │  fd 2: stderr│  │
│  │  grows down  │  │  grows up   │  │  fd 3: log   │  │
│  └─────────────┘  └─────────────┘  └──────────────┘  │
│                                                       │
│  PID: 4821    Parent PID: 1023    State: Running      │
│  User: alice  Priority: 20        CPU time: 0.34s     │
└──────────────────────────────────────────────────────┘
```

- **Code (text segment):** The compiled machine instructions. Read-only — you can't
  rewrite your own instructions mid-flight (normally).
- **Data segment:** Global and static variables. Initialized when the process starts.
- **Stack:** Function call frames, local variables, return addresses. Grows and shrinks
  as functions are called and returned. (Covered deeply in Lesson 5.)
- **Heap:** Dynamically allocated memory — anything you `malloc`, `new`, or `Box::new`.
  (Covered in Lesson 6.)
- **Open files:** Numbered slots called file descriptors. More on this below.
- **Environment variables:** Key-value pairs inherited from the parent process.

---

## Process Isolation — Every Process Gets Its Own Apartment

Imagine an apartment building. Each tenant has their own unit with their own kitchen,
bathroom, and living room. Tenant A **cannot** walk into Tenant B's apartment and rummage
through their fridge. The building (OS) enforces locked doors between units.

This is **process isolation**. Each process gets its own **virtual address space** — its
own private view of memory. When Process A writes to address `0x7fff1234`, and Process B
reads from address `0x7fff1234`, they are reading/writing to *completely different* physical
memory locations. The OS and hardware translate virtual addresses to physical addresses
behind the scenes.

```
  VIRTUAL MEMORY VIEW             PHYSICAL MEMORY (RAM)

  Process A         Process B
  ┌────────┐        ┌────────┐
  │ 0x0000 │        │ 0x0000 │       ┌────────────────────┐
  │  code  │───┐    │  code  │──┐    │  Physical RAM       │
  │        │   │    │        │  │    │                     │
  │ 0x1000 │   │    │ 0x1000 │  │    │  0x00A0: A's code   │
  │  data  │─┐ │    │  data  │┐ │    │  0x00B0: B's code   │
  │        │ │ │    │        ││ │    │  0x0400: A's data   │
  │ 0x7000 │ │ └───>│        ││ │    │  0x0800: B's data   │
  │  stack │ │      │ 0x7000 ││ └──> │  0x1000: A's stack  │
  │        │ │      │  stack ││      │  0x1400: B's stack  │
  └────────┘ │      └────────┘│      └────────────────────┘
             │                │
             └──>  0x0400     └──> 0x0800
              (different physical locations!)
```

**Why isolation matters:**
- A buggy program can't crash other programs.
- A malicious program can't read another program's passwords from memory.
- Each process thinks it has the entire machine to itself.

---

## Process States — The Job Applicant Lifecycle

A process goes through a lifecycle, much like a job applicant:

```
                    ┌───────────┐
        admitted    │           │  dispatch
     ┌─────────────>│   READY   ├──────────────┐
     │              │ (in pool) │               │
     │              └─────┬─────┘               v
┌────┴────┐               │             ┌──────────────┐
│         │               │  preempted  │              │
│   NEW   │               │ (time's up) │   RUNNING    │
│(created)│               └─────────────┤  (on CPU)    │
└─────────┘                             └──────┬───────┘
                                               │
                          ┌────────────────┐   │  I/O or
                          │                │   │  event wait
                          │    WAITING     │<──┘
                          │  (blocked on   │
                          │   I/O, sleep)  │───> back to READY
                          └────────────────┘    when I/O completes

                                     ┌──────────────┐
               (from RUNNING) ──────>│  TERMINATED   │
                    exit()           │  (finished)   │
                                     └──────────────┘
```

| State        | Job Analogy                                    |
|-------------|------------------------------------------------|
| **New**      | Application submitted, being processed          |
| **Ready**    | In the interview pool, waiting for your turn    |
| **Running**  | Actually working at the desk (on the CPU)       |
| **Waiting**  | On break, waiting for something (I/O, data)     |
| **Terminated**| Quit or fired — cleaning out the desk           |

Most processes spend the majority of their life in **ready** or **waiting**. A web server
waiting for a network request is in the waiting state. When data arrives, it moves to ready,
then the scheduler gives it CPU time (running).

---

## Context Switching — Changing the TV Channel

Your computer has maybe 4-16 CPU cores, but runs hundreds of processes. How? The OS rapidly
switches between them — like a TV cycling through channels so fast you think they're all
playing at once.

Each switch is a **context switch**:

1. Save Process A's state (registers, program counter, stack pointer) into its PCB
   (Process Control Block — its "bookmark").
2. Load Process B's state from its PCB.
3. Jump to wherever Process B left off.

```
  CPU Timeline:
  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐
  │  A   │switch│  B   │switch│  C   │switch│  A   │ ...
  │ runs │ A→B  │ runs │ B→C  │ runs │ C→A  │ runs │
  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘
         ~1-10μs       ~1-10μs       ~1-10μs

  Each "switch" block = saving old state, loading new state
  This overhead is the COST of multitasking.
```

Context switches are not free. Each one takes roughly 1-10 microseconds, and more
importantly, it thrashes the CPU cache (the CPU had cached Process A's data; now it needs
Process B's data, so it starts with cache misses). This is why having 10,000 processes
context-switching constantly would grind a machine to a halt — and why we often prefer
threads or async I/O for concurrency (covered in Lesson 9).

---

## fork() — Photocopying a Process

On Unix systems, the primary way to create a new process is `fork()`. It's like running a
photocopier on your entire apartment:

```
  Before fork():                After fork():

  ┌──────────────┐              ┌──────────────┐   ┌──────────────┐
  │  Process A   │              │  Process A    │   │  Process A'  │
  │  PID: 100    │   fork()     │  PID: 100     │   │  PID: 101    │
  │  code + data │  ────────>   │  (parent)     │   │  (child)     │
  │  heap + stack│              │  fork()       │   │  fork()      │
  │              │              │  returns 101  │   │  returns 0   │
  └──────────────┘              └──────────────┘   └──────────────┘
                                     │                   │
                                     │  IDENTICAL copies  │
                                     │  (but separate     │
                                     │   memory!)         │
```

The key trick: `fork()` returns **twice** — once in the parent (returning the child's PID)
and once in the child (returning 0). That's how each copy knows which one it is.

In practice, the OS uses **copy-on-write**: it doesn't actually duplicate all the memory.
Both parent and child share the same physical pages until one of them writes, at which point
only the modified page is copied. Like two roommates sharing a bookshelf — we only buy a
second copy of a book when one person wants to write notes in the margins.

---

## exec() — Renovating the Apartment

After `fork()`, the child is an exact copy of the parent. Usually, you want it to run a
*different* program. That's what `exec()` does — it replaces the process's code, data,
heap, and stack with a completely new program, *but keeps the same PID, file descriptors,
and environment variables*.

Analogy: you keep your apartment number (PID) and your mailbox (file descriptors), but you
gut the interior and completely renovate it into a new layout (different program).

```
  fork() + exec() — the Unix way to launch a program:

  Shell (PID 50)
       │
       │ fork()
       ├──────────> Child (PID 51) — copy of shell
       │                  │
       │                  │ exec("/bin/ls")
       │                  v
       │            Child (PID 51) — now running "ls"
       │                  │
       │                  │ exits
       │                  v
       │            (PID 51 terminated)
       │
       │ wait() — collects child's exit status
       v
  Shell (PID 50) — prints prompt again
```

This fork-then-exec pattern is how *every* command you run in a shell works. The shell
forks itself, the child exec's the command, the parent waits for the child to finish.

---

## The Process Tree — A Family Hierarchy

Every process has a parent (except the first one). This creates a tree:

```
  PID 1: init (or systemd)
  ├── PID 200: sshd (SSH daemon)
  │   └── PID 1501: sshd (your session)
  │       └── PID 1510: bash (your shell)
  │           ├── PID 2001: vim (editing a file)
  │           └── PID 2050: cargo run
  │               └── PID 2051: my_program
  ├── PID 300: nginx (web server)
  │   ├── PID 301: nginx worker
  │   ├── PID 302: nginx worker
  │   └── PID 303: nginx worker
  └── PID 400: postgres (database)
      ├── PID 401: postgres worker
      └── PID 402: postgres worker
```

PID 1 is special — it's the ancestor of all processes, started by the kernel at boot.
If a process's parent dies, the orphaned child is "adopted" by PID 1 (init).

You can see this tree on Linux with `pstree` or `ps auxf`.

---

## Signals — Tapping a Process on the Shoulder

Signals are simple messages the OS (or another process) can send to a process. Think of
them as tapping someone on the shoulder with a specific instruction card:

| Signal    | Number | Meaning                            | Analogy                         |
|-----------|--------|------------------------------------|---------------------------------|
| `SIGTERM` | 15     | "Please stop gracefully"           | Polite note: "Please leave"     |
| `SIGKILL` | 9      | "Stop NOW. No cleanup."            | Security drags you out          |
| `SIGINT`  | 2      | Ctrl+C — "Interrupt"               | Someone taps you: "Stop that"   |
| `SIGHUP`  | 1      | Terminal disconnected               | The phone line went dead        |
| `SIGSEGV` | 11     | Segmentation fault                  | You tried to enter a locked room|
| `SIGCHLD` | 17     | Child process finished              | "Your kid is done at school"    |
| `SIGSTOP` | 19     | Pause (can't be caught)             | Freeze! Don't move.            |
| `SIGCONT` | 18     | Resume after stop                   | "OK, you can move again"       |

A process can **catch** most signals and define custom behavior (like saving work before
shutting down on SIGTERM). But SIGKILL and SIGSTOP **cannot** be caught — the OS enforces
them directly. That's why `kill -9` always works (but is rude — the process gets no chance
to clean up).

---

## Environment Variables — Sticky Notes on the Door

When you set `export DATABASE_URL=postgres://localhost/mydb` in your shell, you're putting
a sticky note on the door of your apartment. When you `fork()` a child process, the child
gets *copies* of all the sticky notes. But if the child changes one, the parent's copy is
unaffected — they're independent copies after fork.

```
  Shell (PID 50)
  Environment:
    PATH=/usr/bin:/bin
    HOME=/home/alice
    DATABASE_URL=postgres://localhost/mydb
       │
       │ fork() + exec("my_server")
       v
  my_server (PID 51)
  Environment:               <── gets copies of parent's env
    PATH=/usr/bin:/bin
    HOME=/home/alice
    DATABASE_URL=postgres://localhost/mydb
```

This is why you `export` variables in your shell — without export, the variable lives only
in the shell's internal memory and isn't passed to children.

---

## File Descriptors — Numbered Slots for I/O

Every process has a table of **file descriptors** (FDs) — numbered slots that point to
open files, sockets, pipes, or devices. The first three are always:

```
  File Descriptor Table (per process):
  ┌─────┬──────────────────────────────────┐
  │ FD  │ Points to                         │
  ├─────┼──────────────────────────────────┤
  │  0  │ stdin  (keyboard input)           │
  │  1  │ stdout (screen output)            │
  │  2  │ stderr (error output)             │
  │  3  │ /var/log/app.log (opened by app)  │
  │  4  │ TCP socket to 10.0.0.5:5432       │
  │  5  │ (closed)                          │
  │  6  │ pipe to child process             │
  └─────┴──────────────────────────────────┘
```

When your shell does `my_program > output.txt`, it:
1. Forks.
2. In the child, opens `output.txt` and assigns it to FD 1 (replacing stdout).
3. Execs `my_program`.
4. Now when the program writes to stdout (FD 1), it goes to the file.

The program doesn't even know it's writing to a file — it just writes to FD 1 like always.
This is the Unix philosophy of **composability**: programs don't care where their input
comes from or where their output goes.

Pipes work the same way: `ls | grep foo` connects FD 1 of `ls` to FD 0 of `grep`.

---

## The Process Table

The OS maintains a **process table** — a master list of every running process:

```
  ┌──────┬────────┬────────┬─────────┬──────────┬────────────┬──────────┐
  │ PID  │ PPID   │ State  │ User    │ Memory   │ Open FDs   │ Priority │
  ├──────┼────────┼────────┼─────────┼──────────┼────────────┼──────────┤
  │  1   │  0     │ Sleep  │ root    │  12 MB   │ 3          │ 20       │
  │ 200  │  1     │ Sleep  │ root    │   8 MB   │ 5          │ 20       │
  │ 1510 │ 1501   │ Sleep  │ alice   │  24 MB   │ 4          │ 20       │
  │ 2001 │ 1510   │ Run    │ alice   │  48 MB   │ 7          │ 20       │
  │ 2050 │ 1510   │ Run    │ alice   │ 132 MB   │ 12         │ 20       │
  └──────┴────────┴────────┴─────────┴──────────┴────────────┴──────────┘
```

This is what `ps aux` or `top` shows you — a snapshot of this table.

---

## Zombie Processes and Orphans

### Zombies

When a child process terminates, it doesn't fully disappear. It becomes a **zombie** — it's
done executing, but its entry stays in the process table so the parent can read its exit
status (via `wait()`).

Analogy: an employee quits but their badge and desk nameplate are still there until HR
(the parent) processes the paperwork.

```
  Parent (PID 100)                Child (PID 101)
       │                               │
       │  fork()                       │
       ├──────────────────────────────>│
       │                               │ does work...
       │                               │ exits with status 0
       │                               │
       │                          ┌────┴─────────────┐
       │                          │  ZOMBIE (PID 101) │
       │                          │  State: Z          │
       │                          │  Exit code: 0      │
       │  wait() — reads status   │  Waiting for       │
       │<─────────────────────────│  parent to collect  │
       │                          └────────────────────┘
       │                          (now fully removed)
```

A few zombies are harmless. Thousands of zombies mean a parent process isn't calling
`wait()` — a bug. Zombies take up a slot in the process table but consume no CPU or memory
beyond that slot.

### Orphans

If a parent dies before its child, the child becomes an **orphan**. The OS re-parents
orphans to PID 1 (init/systemd), which periodically calls `wait()` to clean them up.

---

## Daemons — The Night Security Guard

A **daemon** is a process that runs in the background, detached from any terminal. It's
like a security guard who patrols the building all night while everyone else is asleep.

Common daemons: `sshd` (SSH server), `nginx` (web server), `cron` (scheduled tasks),
`systemd` (the init daemon itself).

Traditionally, creating a daemon meant:
1. `fork()` — the parent exits, so the shell thinks the command finished.
2. `setsid()` — create a new session, detach from the terminal.
3. `fork()` again — ensure the process can never re-acquire a terminal.
4. Close stdin/stdout/stderr (they pointed at the now-detached terminal).
5. Open log files for output instead.

Modern systems use systemd to manage daemons, which handles all of this for you.

---

## Code Examples: Spawning Processes

### Python — Simple and direct

```python
import subprocess
import os

# Method 1: subprocess (recommended for most uses)
# Like hiring a contractor to do a job and waiting for them to finish
result = subprocess.run(["ls", "-la", "/tmp"], capture_output=True, text=True)
print(f"Exit code: {result.returncode}")
print(f"Output:\n{result.stdout}")

# Method 2: low-level fork (to understand what's happening underneath)
pid = os.fork()

if pid == 0:
    # We're in the child process (fork returned 0)
    print(f"Child process! My PID is {os.getpid()}, parent is {os.getppid()}")
    os._exit(0)  # Child exits — use _exit, not sys.exit, after fork
else:
    # We're in the parent process (fork returned child's PID)
    print(f"Parent process! My PID is {os.getpid()}, child is {pid}")
    child_pid, status = os.waitpid(pid, 0)  # Wait for child to finish
    print(f"Child {child_pid} exited with status {os.WEXITSTATUS(status)}")

# Method 3: environment variables
import os
os.environ["MY_APP_MODE"] = "production"
result = subprocess.run(["env"], capture_output=True, text=True)
# The child process inherits our environment variables
```

### Go — Built-in concurrency meets OS processes

```go
package main

import (
    "fmt"
    "os"
    "os/exec"
    "os/signal"
    "syscall"
)

func main() {
    // Spawn a child process — Go wraps fork+exec into one clean API
    // Like sending a contractor out with specific instructions
    cmd := exec.Command("ls", "-la", "/tmp")
    cmd.Stdout = os.Stdout  // Child's stdout → our stdout
    cmd.Stderr = os.Stderr  // Child's stderr → our stderr

    // Set environment for the child process
    cmd.Env = append(os.Environ(), "MY_VAR=hello_from_parent")

    err := cmd.Run()  // Blocks until child exits (like wait())
    if err != nil {
        fmt.Fprintf(os.Stderr, "Command failed: %v\n", err)
        os.Exit(1)
    }
    fmt.Printf("Child exited with code: %d\n", cmd.ProcessState.ExitCode())

    // Handling signals — catching a tap on the shoulder
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)

    go func() {
        sig := <-sigChan
        fmt.Printf("\nReceived signal: %v. Cleaning up...\n", sig)
        // Save state, close connections, flush buffers...
        os.Exit(0)
    }()

    fmt.Println("Process running. PID:", os.Getpid())
    fmt.Println("Parent PID:", os.Getppid())
    select {} // Block forever (until signal)
}
```

### Rust — Maximum control, safe abstractions

```rust
use std::process::{Command, exit};
use std::env;

fn main() {
    // Spawn a child process
    // Rust's Command builder is like writing a detailed work order
    let output = Command::new("ls")
        .args(&["-la", "/tmp"])
        .env("MY_VAR", "hello_from_rust")  // Add an env var for the child
        .output()                           // fork + exec + wait, all in one
        .expect("Failed to execute process");

    println!("Exit status: {}", output.status);
    println!("Stdout:\n{}", String::from_utf8_lossy(&output.stdout));

    if !output.status.success() {
        eprintln!("Stderr:\n{}", String::from_utf8_lossy(&output.stderr));
        exit(1);
    }

    // Reading our own process info
    println!("My PID: {}", std::process::id());

    // Reading environment variables
    match env::var("HOME") {
        Ok(home) => println!("Home directory: {}", home),
        Err(_) => println!("HOME not set"),
    }

    // Spawning without waiting (non-blocking) — like a fire-and-forget contractor
    let mut child = Command::new("sleep")
        .arg("5")
        .spawn()
        .expect("Failed to start process");

    println!("Spawned child PID: {}", child.id());

    // We can do other work here while the child runs...
    println!("Doing other work while child sleeps...");

    // Then wait when we're ready
    let status = child.wait().expect("Failed to wait for child");
    println!("Child finished with: {}", status);
}
```

---

## Signal Handling — A Practical Example

Here's a common pattern: a server that cleans up gracefully on SIGTERM.

```python
import signal
import sys
import time

# Our "resources" to clean up
connections = []
temp_files = ["/tmp/app.lock", "/tmp/app.cache"]

def graceful_shutdown(signum, frame):
    """Called when we receive SIGTERM or SIGINT."""
    sig_name = signal.Signals(signum).name
    print(f"\nReceived {sig_name}. Shutting down gracefully...")

    # Close connections
    for conn in connections:
        print(f"  Closing connection: {conn}")
        # conn.close()

    # Clean up temp files
    for f in temp_files:
        print(f"  Removing temp file: {f}")
        # os.unlink(f)

    print("Cleanup complete. Goodbye!")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGTERM, graceful_shutdown)  # kill <pid>
signal.signal(signal.SIGINT, graceful_shutdown)   # Ctrl+C

print(f"Server running (PID {os.getpid()}). Press Ctrl+C to stop.")
while True:
    time.sleep(1)  # Simulate doing work
```

Without signal handling, SIGTERM would kill the process immediately — no cleanup, no
flushing buffers, no removing lock files. This is why well-written servers always handle
SIGTERM.

---

## Exercises

### Exercise 1: Process Explorer
Open a terminal and run:
```bash
# See the process tree
pstree -p | head -30

# See your shell's PID
echo $$

# See your shell's environment
env | head -20

# See open file descriptors for your shell
ls -la /proc/$$/fd
```

Explain what each file descriptor (0, 1, 2, and any others) points to.

### Exercise 2: Fork in Action
Write a Python script that:
1. Forks a child process.
2. The child prints "I am the child, PID=X, Parent=Y" and sleeps for 2 seconds.
3. The parent prints "I am the parent, PID=Y, Child=X" and waits for the child.
4. After the child exits, the parent prints the child's exit status.

### Exercise 3: Zombie Spotter
Write a program that creates a zombie process:
1. Fork a child that immediately exits.
2. Have the parent sleep for 30 seconds WITHOUT calling `wait()`.
3. In another terminal, run `ps aux | grep Z` to see the zombie.
4. Then modify the program to properly clean up with `wait()`.

### Exercise 4: Signal Ping-Pong
Write two programs (or one with fork):
- Process A sends `SIGUSR1` to Process B.
- Process B catches it, prints "Got it!", and sends `SIGUSR2` back to Process A.
- Process A catches it and prints "Acknowledged!"
Hint: use `os.kill(pid, signal.SIGUSR1)` in Python.

### Exercise 5: Redirection by Hand
Write a program that:
1. Opens a file for writing.
2. Duplicates that file descriptor onto FD 1 (stdout) using `os.dup2()`.
3. Prints "Hello, file!" using a normal print statement.
4. Verify the text ended up in the file, not on the screen.

This is exactly what the shell does when you write `program > file.txt`.

### Exercise 6: Daemon Sketch
Write pseudocode (or real code) for a daemon that:
1. Forks and has the parent exit.
2. Creates a new session with `os.setsid()`.
3. Closes stdin/stdout/stderr.
4. Opens a log file and writes periodic status messages to it.
5. Handles SIGTERM to shut down cleanly.

---

## Key Takeaways

1. **A process is a running instance of a program** — the program is the recipe, the
   process is the active cooking.
2. **Process isolation** protects processes from each other via separate virtual address
   spaces — each apartment has locked doors.
3. **Context switching** lets the OS run many processes on few CPUs, but each switch has
   a cost — the TV channel analogy.
4. **fork() + exec()** is how Unix creates processes — photocopy then renovate.
5. **Signals** are simple inter-process messages — taps on the shoulder with instructions.
6. **File descriptors** are numbered I/O slots — 0 is stdin, 1 is stdout, 2 is stderr.
7. **Zombies** are finished processes waiting for their parent to collect the exit status.
8. **Daemons** are background processes detached from any terminal.
9. Understanding processes is critical because *everything* you run on a computer is a
   process — your editor, your compiler, your web server, even your shell.
