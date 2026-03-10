# Lesson 02: Processes — Programs in Motion

A program sitting on disk does nothing. A process is what happens when the OS
brings it to life. This lesson covers what a process is, what it contains, how
it's born, and how it dies.

---

## Program vs Process

| | Program | Process |
|--|---------|---------|
| **What** | A file on disk (binary or script) | A running instance of a program |
| **Where** | `/usr/bin/ls`, `./target/debug/myapp` | In memory, managed by the kernel |
| **How many** | One file | Many processes from the same program |
| **State** | Static, unchanging | Dynamic — has a PID, memory, open files |

### The cooking analogy

- A **recipe** (program) sits in a cookbook on the shelf. It doesn't do anything.
- A **cook following that recipe** (process) is the active thing — they have
  ingredients on the counter (memory), timers running (CPU time), pots on the
  stove (I/O). Multiple cooks can follow the same recipe at the same time.

You can run `cargo run` in three terminals simultaneously. Same binary, three
separate processes, each with their own memory, PID, and state.

---

## What a Process Contains

Every process is more than just "running code." The kernel maintains a data
structure for each process (called the Process Control Block or `task_struct`
on Linux):

```
┌──────────────────────────────────────────────┐
│                  PROCESS                      │
│                                              │
│  PID: 42381           PPID: 42380            │
│  State: RUNNING       Priority: 20           │
│  User: augustus        Group: staff           │
│                                              │
│  ┌────────────────────────────────────────┐   │
│  │          VIRTUAL ADDRESS SPACE          │   │
│  │                                        │   │
│  │  ┌──────────────────┐                  │   │
│  │  │ Text (code)      │ read-only, exec  │   │
│  │  ├──────────────────┤                  │   │
│  │  │ Data (globals)   │ read-write       │   │
│  │  ├──────────────────┤                  │   │
│  │  │ Heap        ↑    │ grows upward     │   │
│  │  │                  │                  │   │
│  │  │             ↓    │                  │   │
│  │  │ Stack            │ grows downward   │   │
│  │  └──────────────────┘                  │   │
│  └────────────────────────────────────────┘   │
│                                              │
│  File descriptors: [0=stdin, 1=stdout,       │
│                     2=stderr, 3=logfile.txt]  │
│                                              │
│  CPU registers (when not running):           │
│    Program counter, Stack pointer, etc.      │
│                                              │
│  Signals: pending=[], blocked=[]             │
│  CPU time used: 0.042 seconds                │
└──────────────────────────────────────────────┘
```

Key components:
- **PID** — Unique process identifier. Assigned by the kernel, never reused
  while the process exists.
- **PPID** — Parent's PID. Every process has a parent except PID 1 (init/systemd).
- **Code (text segment)** — The machine instructions. Read-only, shared between
  processes running the same binary.
- **Data segment** — Initialized global/static variables.
- **Heap** — Dynamic allocations (`Box::new()`, `Vec::push()`, `String::from()`).
- **Stack** — Local variables, function call frames. One per thread.
- **File descriptors** — Integer handles to open files, sockets, pipes.
- **Saved CPU state** — When the process isn't running on the CPU, its registers
  are saved here so it can resume later.

---

## Process Lifecycle

```
 fork() or
 exec()
    │
    ▼
┌────────┐  scheduler   ┌─────────┐
│ CREATED├─────────────►│  READY  │◄──────────────┐
└────────┘              └────┬────┘               │
                             │                    │
                     gets CPU time          timer interrupt
                             │              (preempted)
                             ▼                    │
                        ┌─────────┐               │
                        │ RUNNING ├───────────────┘
                        └──┬───┬──┘
                           │   │
              needs I/O    │   │   calls exit()
              or wait      │   │   or returns
                           │   │   from main()
                           ▼   ▼
                  ┌─────────┐ ┌────────────┐
                  │ WAITING │ │ TERMINATED │
                  │(blocked)│ │  (zombie)  │
                  └────┬────┘ └──────┬─────┘
                       │             │
                  I/O done      parent calls
                       │        wait()
                       ▼             ▼
                    READY        cleaned up
                                (gone)
```

1. **Created** — kernel allocates a PID, creates the process control block.
2. **Ready** — loaded into memory, waiting for CPU time.
3. **Running** — actively executing on a CPU core.
4. **Waiting/Blocked** — waiting for I/O, a timer, a mutex, etc.
5. **Terminated** — finished but not fully cleaned up (zombie state until parent
   calls `wait()`).

---

## fork() and exec() — How Processes Are Born

On Unix systems, creating a new process is a two-step dance:

### fork() — Clone yourself

`fork()` creates an almost-exact copy of the calling process:

```
BEFORE fork():
┌──────────────────┐
│  Process A       │
│  PID: 100        │
│  Code + Data     │
│  Stack           │
│  File descriptors│
└──────────────────┘

AFTER fork():
┌──────────────────┐    ┌──────────────────┐
│  Process A       │    │  Process B       │
│  PID: 100        │    │  PID: 101        │
│  (parent)        │    │  (child)         │
│  Code + Data     │    │  Code + Data     │ ← copy of parent's
│  Stack           │    │  Stack           │ ← copy of parent's
│  File descriptors│    │  File descriptors│ ← copies (same fds)
│                  │    │  PPID: 100       │
│  fork() returns  │    │  fork() returns  │
│  child PID (101) │    │  0               │
└──────────────────┘    └──────────────────┘
```

Both processes continue executing from the point after fork(). The only
difference: fork() returns the child's PID to the parent and 0 to the child.

In practice, Linux uses "copy-on-write" (COW) — it doesn't actually copy all
the memory. Both parent and child share the same physical pages until one of
them writes, at which point only the modified page is copied.

### exec() — Become a different program

After fork(), the child typically calls `exec()` to replace itself with a new
program:

```
BEFORE exec("ls"):          AFTER exec("ls"):
┌──────────────────┐        ┌──────────────────┐
│  Process B       │        │  Process B       │
│  PID: 101        │        │  PID: 101        │ ← same PID!
│  (copy of shell) │   ──►  │  (now running ls)│
│  Shell's code    │        │  ls's code       │ ← replaced
│  Shell's data    │        │  ls's data       │ ← replaced
│  Shell's stack   │        │  ls's stack      │ ← replaced
│  fd 0,1,2       │        │  fd 0,1,2       │ ← preserved
└──────────────────┘        └──────────────────┘
```

Key insight: `exec()` doesn't create a new process. It replaces the current
process's program image. Same PID, same file descriptors, entirely new code.

This is why every command you run in a shell involves `fork() + exec()`:
1. Shell forks itself.
2. Child exec's the command.
3. Parent waits for child to finish.

---

## Parent and Child Processes

Every process (except PID 1) has a parent:

```
init/systemd (PID 1)
├── sshd (PID 500)
│   └── bash (PID 1200)
│       └── cargo (PID 3400)
│           └── your_program (PID 3405)
└── NetworkManager (PID 600)
```

You can see this tree with `pstree`:
```bash
pstree -p
```

---

## Zombie and Orphan Processes

### Zombie process

When a process terminates, it doesn't fully disappear. It remains in the
process table as a "zombie" until its parent reads its exit status with
`wait()` or `waitpid()`:

```
Process lifecycle:
Running → Terminated → Zombie → (parent calls wait) → Gone

Why? The kernel needs to keep the exit status around so the parent can
check: "Did my child succeed or fail? What was the exit code?"
```

Zombies consume almost no resources (no memory, no CPU) — just a slot in the
process table. But if a parent spawns millions of children and never calls
`wait()`, you can exhaust the PID space.

You can spot zombies in `ps` — they show state `Z`:
```bash
ps aux | grep Z
```

### Orphan process

If a parent dies before its child, the child becomes an orphan. The kernel
re-parents it to PID 1 (init/systemd), which periodically calls `wait()` to
clean up orphans.

```
BEFORE parent dies:           AFTER parent dies:
┌────────┐                    ┌────────────────┐
│Parent  │                    │ init (PID 1)   │
│PID: 100│                    │ adopts orphans │
│  │     │                    │   │            │
│  ▼     │                    │   ▼            │
│┌──────┐│                    │ ┌──────┐       │
││Child ││                    │ │Child │       │
││PID:  ││   parent exits     │ │PID:  │       │
││101   ││  ─────────────►    │ │101   │       │
│└──────┘│                    │ │PPID: │       │
└────────┘                    │ │1     │       │
                              │ └──────┘       │
                              └────────────────┘
```

---

## Seeing Processes on Your System

### ps — snapshot of current processes
```bash
ps aux
```
Key columns:
- `USER` — who owns the process
- `PID` — process ID
- `%CPU`, `%MEM` — resource usage
- `STAT` — state (R=running, S=sleeping, Z=zombie, T=stopped)
- `COMMAND` — what program is running

### top / htop — live, updating view
```bash
htop
```
Shows CPU usage per core, memory usage, process tree. Press `t` for tree view.

### /proc on Linux
Every process gets a directory `/proc/<pid>/`:
```bash
ls /proc/self/        # "self" is the current process
cat /proc/self/maps   # virtual memory map
cat /proc/self/status # process info
ls -la /proc/self/fd  # open file descriptors
```

On macOS, use `lsof -p <pid>` and `vmmap <pid>` instead.

---

## Rust: Spawning Processes with std::process::Command

Rust's `Command` wraps the fork+exec pattern:

```rust
use std::process::Command;

fn main() {
    let child = Command::new("sleep")
        .arg("2")
        .spawn()
        .expect("failed to spawn");

    println!("spawned child with PID: {}", child.id());

    let output = child.wait_with_output().expect("failed to wait");
    println!("child exited with: {}", output.status);
}
```

### Capturing output

```rust
use std::process::Command;

fn main() {
    let output = Command::new("ls")
        .arg("-la")
        .arg("/tmp")
        .output()
        .expect("failed to execute ls");

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("Files:\n{}", stdout);
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("Error: {}", stderr);
    }
}
```

### Piping between processes

```rust
use std::process::{Command, Stdio};

fn main() {
    let ls = Command::new("ls")
        .arg("-la")
        .stdout(Stdio::piped())
        .spawn()
        .expect("failed to start ls");

    let grep = Command::new("grep")
        .arg(".rs")
        .stdin(ls.stdout.expect("failed to get ls stdout"))
        .output()
        .expect("failed to start grep");

    let result = String::from_utf8_lossy(&grep.stdout);
    println!("Rust files:\n{}", result);
}
```

This creates a pipe between two processes — exactly what the shell does when
you type `ls -la | grep .rs`.

### Getting the current process info

```rust
fn main() {
    println!("My PID: {}", std::process::id());

    #[cfg(unix)]
    {
        use std::os::unix::process::parent_id;
        println!("My parent PID: {}", parent_id());
    }
}
```

---

## Exercises

### Exercise 1: Process tree exploration
Run `pstree -p` (Linux) or `pstree` (macOS, install via `brew install pstree`).
Find your terminal emulator, the shell inside it, and see how processes nest.

### Exercise 2: Spawn and observe
```rust
use std::process::Command;
use std::thread;
use std::time::Duration;

fn main() {
    println!("Parent PID: {}", std::process::id());

    let mut children = Vec::new();

    for i in 0..3 {
        let child = Command::new("sleep")
            .arg("30")
            .spawn()
            .expect("failed to spawn");
        println!("Spawned child {} with PID: {}", i, child.id());
        children.push(child);
    }

    println!("\nNow run: ps --ppid {} (Linux) or ps -o pid,ppid,comm (macOS)", std::process::id());
    println!("You should see 3 sleep processes.");
    println!("Press Ctrl+C to kill everything.\n");

    thread::sleep(Duration::from_secs(30));

    for mut child in children {
        let _ = child.kill();
        let _ = child.wait();
    }
}
```
Run this, then in another terminal verify the child processes with `ps`.

### Exercise 3: Zombie creation (Linux)
```rust
use std::process::Command;
use std::thread;
use std::time::Duration;

fn main() {
    let child = Command::new("echo")
        .arg("I will become a zombie")
        .spawn()
        .expect("failed to spawn");

    let pid = child.id();
    println!("Child PID: {}", pid);

    thread::sleep(Duration::from_secs(10));

    println!("Check: ps -o pid,state,comm -p {}", pid);
    println!("The child has exited but we never called wait().");
    println!("On Linux it should show state 'Z' (zombie).");

    thread::sleep(Duration::from_secs(20));
}
```
Note: When the Rust `Command` child handle is dropped, Rust automatically calls
`wait()`, cleaning the zombie. This exercise holds the handle alive to show the
zombie state.

### Exercise 4: Process info gathering
Write a Rust program that:
1. Prints its own PID and parent PID.
2. Spawns `uname -a` and captures + prints the output.
3. Spawns `ps -o pid,ppid,comm -p <self_pid>` and prints the output.
4. Handles errors properly using `Result`.

### Exercise 5: Thinking questions
1. Why does Unix use the two-step fork+exec pattern instead of a single
   "create new process from this binary" call?
2. What would happen if init (PID 1) crashed?
3. If fork() copies the parent's memory, why doesn't every fork double RAM
   usage? (Hint: COW.)

---

Next: [Lesson 03: Virtual Memory — Every Process Thinks It Has All the RAM](./03-virtual-memory.md)
