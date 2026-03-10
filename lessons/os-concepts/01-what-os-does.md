# Lesson 01: What the OS Does — The Big Picture

Every time you run `cargo run`, dozens of invisible things happen between your
code and the hardware. The operating system orchestrates all of it. This lesson
explains what it does and why it exists.

---

## The OS as a Manager

Think of a large hotel.

- **Guests** are your programs (processes). Each guest thinks they have the
  whole hotel to themselves.
- **The hotel manager** is the OS. It assigns rooms (memory), manages the front
  desk (I/O), ensures guests don't wander into each other's rooms (protection),
  and handles checkout (process termination).

Without the manager, guests would fight over rooms, the kitchen would catch
fire, and nobody would know who has which key.

The OS does two fundamental things:

1. **Abstraction** — Hides ugly hardware details. You call `File::open()`, not
   "send these specific bytes to SATA controller register 0x1F7."
2. **Protection** — Prevents programs from stepping on each other or crashing
   the system.

---

## Kernel vs User Space

The most important boundary in any OS.

```
┌─────────────────────────────────────────────────────────┐
│                      USER SPACE                         │
│                                                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│   │ Your Rust│  │  Chrome  │  │  Slack   │   ...       │
│   │  program │  │          │  │          │             │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│        │              │              │                   │
│        │         System calls        │                   │
│        │      (the ONLY gateway)     │                   │
├────────▼──────────────▼──────────────▼───────────────────┤
│                     KERNEL SPACE                         │
│                                                         │
│   ┌─────────────┐ ┌──────────┐ ┌──────────────────┐    │
│   │  Process    │ │  Memory  │ │  File system     │    │
│   │  manager    │ │  manager │ │  driver          │    │
│   └─────────────┘ └──────────┘ └──────────────────┘    │
│   ┌─────────────┐ ┌──────────┐ ┌──────────────────┐    │
│   │  Scheduler  │ │  Network │ │  Device drivers  │    │
│   │             │ │  stack   │ │                  │    │
│   └──────┬──────┘ └────┬─────┘ └────────┬─────────┘    │
├──────────▼──────────────▼───────────────▼───────────────┤
│                     HARDWARE                            │
│   CPU    RAM    Disk    NIC    GPU    USB    ...        │
└─────────────────────────────────────────────────────────┘
```

### The theater analogy

- **Front-of-house** (user space) — The audience area. You can sit in your
  seat, watch the show, buy a drink. You have limited, controlled access.
- **Backstage** (kernel space) — Lighting rigs, trapdoors, electrical panels.
  Only trained crew (the kernel) goes here. If an audience member wanders
  backstage and flips the wrong switch, the whole theater goes dark.

Your Rust code runs front-of-house. When it needs something backstage (open a
file, send a network packet, allocate memory), it asks the stage manager (makes
a system call). The kernel does the actual work and returns the result.

### Why two modes?

The CPU itself enforces this. x86 processors have "rings":

```
Ring 0 — Kernel mode (full hardware access)
Ring 3 — User mode (restricted, no direct hardware access)
```

If your user-mode code tries to execute a privileged instruction (like writing
directly to a disk controller register), the CPU raises an exception. The
kernel catches it and typically kills your process with a segfault.

---

## The Kernel's Five Main Jobs

### 1. Process Management
Creating, scheduling, and terminating processes. Deciding which process gets
CPU time and when. Covered in lessons 02, 05, and 06.

### 2. Memory Management
Giving each process its own virtual address space. Mapping virtual addresses to
physical RAM. Handling the case when RAM is full (swapping). Covered in lessons
03 and 04.

### 3. File Systems
Organizing data on disk into files and directories. Translating `open("data.txt")`
into "read sectors 4817-4820 on disk 1." Covered in lessons 09 and 10.

### 4. I/O and Device Management
Talking to hardware through device drivers. Making a USB keyboard, an NVMe SSD,
and a network card all look like file descriptors to your code. Covered in
lesson 10.

### 5. Networking
Implementing TCP/IP, UDP, DNS resolution, routing. When your Rust code calls
`TcpStream::connect()`, the kernel handles the three-way handshake, packet
fragmentation, retransmissions, and congestion control. Covered in the
networking module.

---

## What Happens When You Run `cargo run`

Let's trace it step by step:

```
You type: cargo run
              │
              ▼
┌─────────────────────────────┐
│ 1. Shell (zsh/bash) reads   │  Your shell is a process. It reads your
│    your command              │  input from stdin (fd 0).
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 2. Shell calls fork()       │  Creates a child process (clone of shell).
│                             │  The child has a new PID but copies of
│                             │  all the parent's memory.
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 3. Child calls exec()      │  Replaces its own code with the `cargo`
│    with "cargo"             │  binary. Same PID, entirely new program.
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 4. Cargo compiles your code │  cargo invokes rustc, which invokes the
│    (if needed)              │  linker. Each of these is a child process.
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 5. Cargo fork+exec's your  │  Your compiled binary becomes a new
│    compiled binary          │  process with its own PID, memory space,
│                             │  file descriptors.
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 6. Your process runs        │  The kernel's scheduler gives it CPU
│                             │  time slices. It shares the CPU with
│                             │  hundreds of other processes.
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 7. Your process calls       │  println!() → write() syscall → kernel
│    println!()               │  writes bytes to terminal's fd.
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 8. Your main() returns      │  Process exits. Kernel frees its memory,
│                             │  closes its file descriptors, notifies
│                             │  the parent (cargo) via wait().
└─────────────────────────────┘
```

That's at least 4 new processes, hundreds of syscalls, and thousands of context
switches — all for a "Hello, world!"

---

## Why You Can't Directly Access Hardware

Imagine if any program could write to any memory address or talk to any device:

- A buggy game overwrites the kernel's memory — the whole system crashes.
- A malicious app reads your password manager's memory.
- Two programs write to the disk at the same time — data corruption.

The OS provides **controlled, safe access** to hardware. Your code goes
through the syscall gate, and the kernel validates every request:

```rust
use std::fs::File;
use std::io::Read;

fn main() -> std::io::Result<()> {
    let mut file = File::open("/etc/hostname")?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    println!("hostname: {}", contents.trim());
    Ok(())
}
```

What you see: `File::open()`.

What actually happens:
1. Rust's standard library calls the `open()` syscall.
2. CPU switches to kernel mode (ring 0).
3. Kernel checks: Does this file exist? Does this user have read permission?
4. Kernel finds the file's disk blocks, reads them into a kernel buffer.
5. Kernel creates a file descriptor, returns it to your process.
6. CPU switches back to user mode (ring 3).
7. `File::open()` returns `Ok(file)`.

---

## macOS vs Linux Kernel — Quick Comparison

| Aspect | Linux | macOS |
|--------|-------|-------|
| Kernel name | Linux | XNU (X is Not Unix) |
| Kernel type | Monolithic (with loadable modules) | Hybrid (Mach microkernel + BSD layer) |
| Process tracing | `strace` | `dtruss` (requires SIP disabled) |
| Process info | `/proc` filesystem | `sysctl`, `ps`, `lsof` |
| File system | ext4, btrfs, xfs | APFS |
| Package manager | apt, dnf, pacman | Homebrew (unofficial) |
| Thread impl | NPTL (clone syscall) | pthreads over Mach threads |

Key practical differences for you as a developer:
- Linux exposes everything through `/proc` and `/sys` pseudo-filesystems.
  macOS does not have these — you use `sysctl` and specific tools instead.
- `strace` (Linux) lets you see every syscall a process makes. On macOS,
  `dtruss` exists but requires disabling System Integrity Protection.
- Both are POSIX-compliant enough that most Rust code works on both without
  changes.

---

## Exercises

### Exercise 1: See the kernel in action
Run `uname -a` to see your kernel version. Then run `getconf PAGE_SIZE` to
see your system's memory page size (likely 4096 bytes on x86, 16384 on Apple
Silicon).

### Exercise 2: Count your processes
Run `ps aux | wc -l` to see how many processes are currently running. You'll
likely see 200-400+ even on a "quiet" system. Each one got its resources from
the kernel.

### Exercise 3: Trace a simple program
On Linux:
```bash
strace -c cargo run 2>&1 | tail -20
```
This shows a summary of every syscall your program makes. Look for `read`,
`write`, `mmap`, `openat` — those are the kernel doing its job.

On macOS (requires SIP adjustment):
```bash
dtruss cargo run 2>&1 | tail -20
```

### Exercise 4: Your first process spawn in Rust
```rust
use std::process::Command;

fn main() {
    let output = Command::new("uname")
        .arg("-a")
        .output()
        .expect("failed to execute uname");

    let kernel_info = String::from_utf8_lossy(&output.stdout);
    println!("Kernel info: {}", kernel_info.trim());
    println!("Exit status: {}", output.status);
}
```
Run this. You just created a child process (`uname`), waited for it to finish,
and captured its output. The kernel handled fork, exec, scheduling, piping
stdout, and cleanup.

### Exercise 5: Thinking questions
1. Why does `println!()` in Rust ultimately need a system call?
2. If the kernel crashed, what would happen to all running processes?
3. Why is it important that your process can't read another process's memory?

---

Next: [Lesson 02: Processes — Programs in Motion](./02-processes.md)
