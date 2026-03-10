# Lesson 11: System Calls — The Boundary Between Your Code and the Kernel

Your program can do a lot on its own: math, string manipulation, sorting
data in memory. But the moment it needs to touch the outside world —
open a file, send a network packet, allocate memory, create a process —
it must ask the kernel for help. That request is a system call.

---

## What Is a System Call?

A system call (syscall) is the mechanism your program uses to request
services from the operating system kernel.

Your code runs in **user mode** (restricted). The kernel runs in
**kernel mode** (unrestricted). A syscall is the controlled gateway
between them.

```
┌─────────────────────────────────────────────────────┐
│                    User Space                        │
│                                                      │
│  Your Rust Program                                   │
│  ┌────────────────────────────────────────────────┐  │
│  │ let file = File::open("data.txt")?;            │  │
│  │                  │                              │  │
│  │                  ▼                              │  │
│  │ Rust std library: calls libc open()            │  │
│  │                  │                              │  │
│  │                  ▼                              │  │
│  │ libc: sets up registers, triggers syscall      │  │
│  └──────────────────┼─────────────────────────────┘  │
│                     │                                │
├═════════════════════╪════════════════════════════════╡
│                     │  ← SYSCALL BOUNDARY            │
├═════════════════════╪════════════════════════════════╡
│                     ▼                                │
│                 Kernel Space                          │
│  ┌────────────────────────────────────────────────┐  │
│  │ Syscall handler: validate args, check perms    │  │
│  │ VFS layer: resolve path, find inode            │  │
│  │ File system driver: read from disk             │  │
│  │ Return fd number to user space                 │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Analogy: the government office**

A syscall is like going to a government office to get something done
that only the government can do (issue a passport, register a car).

1. You fill out the paperwork (set registers with arguments)
2. You submit it at the window (trigger the syscall instruction)
3. You wait while the clerk processes it (kernel handles the request)
4. The clerk calls your name and hands you the result (kernel returns)
5. You go back to your normal life (program continues in user mode)

You can't go behind the counter yourself. You can't issue your own
passport. The government office (kernel) is the only one with that
power.

---

## User Mode vs Kernel Mode

Modern CPUs have hardware-enforced privilege levels.

```
┌─────────────────────────────────────────────┐
│  Ring 0: Kernel Mode (privileged)           │
│  - Can access ALL memory                    │
│  - Can talk to hardware directly            │
│  - Can modify page tables                   │
│  - Can enable/disable interrupts            │
│  - Can execute privileged instructions      │
├─────────────────────────────────────────────┤
│  Ring 1-2: (unused on most modern OSes)     │
├─────────────────────────────────────────────┤
│  Ring 3: User Mode (restricted)             │
│  - Can only access own process memory       │
│  - Cannot touch hardware                    │
│  - Cannot modify page tables                │
│  - Cannot disable interrupts                │
│  - Privileged instructions cause a fault    │
└─────────────────────────────────────────────┘
```

If user-mode code tries to execute a privileged instruction (like
writing to a hardware port), the CPU triggers a fault and the kernel
kills the process. This is how the OS protects itself and other
processes from buggy or malicious code.

---

## The Syscall Mechanism Step by Step

What actually happens during a syscall on x86-64 Linux:

```
User Space                          Kernel Space

1. Put syscall number in rax
   (e.g., 1 = write)
2. Put args in rdi, rsi, rdx,
   r10, r8, r9
3. Execute `syscall` instruction
        │
        │ ── CPU switches to ──────→ 4. Save user registers
             kernel mode                5. Look up handler in
                                           syscall table[rax]
                                        6. Execute handler
                                           (validate args,
                                            do the work)
                                        7. Put return value in rax
        │ ←── CPU switches back ─── 8. Restore user registers
        │      to user mode             Execute `sysret`
        ▼
9. Check return value in rax
   (negative = error, -errno)
```

The `syscall` instruction is the hardware-level gateway. On older
x86 systems, `int 0x80` was used (a software interrupt). On ARM,
it's `svc` (supervisor call). The principle is the same everywhere.

### The Mode Switch Cost

A syscall is much more expensive than a regular function call:

```
Function call:       ~1-2 ns    (just jump + stack frame)
System call:      ~100-1000 ns  (mode switch + kernel work)

Why so expensive?
- CPU flushes pipeline
- Switches privilege level
- Saves/restores registers
- May flush TLB entries (Spectre mitigations)
- Kernel validates all arguments
- May trigger scheduler
```

This is why buffered I/O matters. Every `read()` or `write()` syscall
costs hundreds of nanoseconds even before any actual I/O happens.

---

## Common System Calls

### Process Management

| Syscall   | Purpose                                     |
|-----------|---------------------------------------------|
| fork()    | Create a copy of the current process        |
| exec()    | Replace current process with a new program  |
| exit()    | Terminate the process                       |
| wait()    | Wait for a child process to finish          |
| getpid()  | Get current process ID                      |
| kill()    | Send a signal to a process                  |

### File I/O

| Syscall   | Purpose                                     |
|-----------|---------------------------------------------|
| open()    | Open a file, get a file descriptor          |
| read()    | Read bytes from an fd                       |
| write()   | Write bytes to an fd                        |
| close()   | Close a file descriptor                     |
| lseek()   | Move the read/write offset                  |
| stat()    | Get file metadata (without opening)         |
| fstat()   | Get metadata for an open fd                 |

### Memory

| Syscall   | Purpose                                     |
|-----------|---------------------------------------------|
| mmap()    | Map a file or allocate memory               |
| munmap()  | Unmap memory                                |
| brk()     | Adjust the data segment (heap) size         |
| mprotect()| Change memory protection (read/write/exec)  |

### Network

| Syscall   | Purpose                                     |
|-----------|---------------------------------------------|
| socket()  | Create a socket                             |
| bind()    | Bind a socket to an address                 |
| listen()  | Mark socket as accepting connections        |
| accept()  | Accept an incoming connection               |
| connect() | Connect to a remote address                 |

### Other

| Syscall   | Purpose                                     |
|-----------|---------------------------------------------|
| ioctl()   | Device-specific control (catch-all)         |
| epoll_*   | Efficient I/O event monitoring (Linux)      |
| kqueue()  | Efficient I/O event monitoring (macOS/BSD)  |
| clone()   | Create a thread (Linux)                     |

---

## Why Minimize System Calls

Every syscall has overhead. High-performance code reduces syscall count.

```
Strategy 1: Buffered I/O
──────────────────────────────
Instead of:   1,000,000 x write(fd, &byte, 1)      = 1M syscalls
Do:           125 x write(fd, &buffer[8192], 8192)  = 125 syscalls

Strategy 2: Batch operations
──────────────────────────────
Instead of:   stat() + open() + read() + close() per file
Linux offers: io_uring for batching multiple I/O operations

Strategy 3: Memory-mapped I/O
──────────────────────────────
Instead of:   repeated read() calls
Do:           mmap() the file once, then access memory directly
              (page faults replace explicit reads — handled by kernel
               transparently)

Strategy 4: Vectored I/O
──────────────────────────────
Instead of:   write(header) + write(body) + write(footer)
Do:           writev(fd, [header, body, footer])  = 1 syscall
```

---

## Tracing System Calls: strace and dtruss

You can watch every syscall a program makes in real time.

### Linux: strace

```bash
# Trace all syscalls of a command
strace ls /tmp

# Count syscalls by type
strace -c ls /tmp

# Trace a running process
strace -p <PID>

# Show only file-related syscalls
strace -e trace=file ls /tmp

# Show only network syscalls
strace -e trace=network curl https://example.com

# Show timestamps
strace -t ls /tmp

# Follow forked children
strace -f ./my_server
```

### macOS: dtruss (requires SIP adjustments or root)

```bash
# Trace syscalls (requires sudo)
sudo dtruss ls /tmp

# Trace a running process
sudo dtruss -p <PID>
```

### Example strace output

```
$ strace cat /etc/hostname 2>&1 | head -20

execve("/usr/bin/cat", ["cat", "/etc/hostname"], ...) = 0
brk(NULL)                               = 0x556b3c4f1000
mmap(NULL, 8192, PROT_READ|PROT_WRITE, ...) = 0x7f2a...
access("/etc/ld.so.preload", R_OK)      = -1 ENOENT
openat(AT_FDCWD, "/etc/hostname", O_RDONLY) = 3
fstat(3, {st_mode=S_IFREG|0644, st_size=12, ...}) = 0
read(3, "mycomputer\n", 131072)         = 12
write(1, "mycomputer\n", 12)            = 12
read(3, "", 131072)                     = 0     ← EOF
close(3)                                = 0
close(1)                                = 0
close(2)                                = 0
exit_group(0)                           = ?
```

Reading this trace:

1. `execve` — kernel loads the `cat` binary
2. `brk`, `mmap` — dynamic linker sets up memory
3. `openat` — opens `/etc/hostname`, gets fd 3
4. `fstat` — checks the file size (12 bytes)
5. `read(3, ...)` — reads the file contents (12 bytes)
6. `write(1, ...)` — writes to stdout (fd 1)
7. `read(3, ...)` returns 0 — EOF
8. `close` — cleans up
9. `exit_group` — terminates

Even this simple command makes ~15 syscalls. A web server handling one
request might make hundreds.

---

## Rust and System Calls

Rust's standard library wraps syscalls for you. You almost never need
to call them directly.

### The layers

```
Your Rust code
    │
    ▼
std::fs::File::open()     ← Rust standard library
    │
    ▼
libc::open()              ← C library wrapper (thin)
    │
    ▼
syscall instruction       ← CPU instruction
    │
    ▼
Kernel sys_open()         ← Kernel handler
```

### Using the libc crate for raw syscalls

You almost never need this, but it's useful for understanding:

```rust
// Cargo.toml: libc = "0.2"

use std::ffi::CString;

fn raw_open_example() {
    let path = CString::new("/etc/hostname").unwrap();

    unsafe {
        let fd = libc::open(path.as_ptr(), libc::O_RDONLY);
        if fd < 0 {
            eprintln!("open failed: {}", std::io::Error::last_os_error());
            return;
        }

        let mut buffer = [0u8; 256];
        let bytes_read = libc::read(fd, buffer.as_mut_ptr() as *mut libc::c_void, buffer.len());

        if bytes_read > 0 {
            let content = std::str::from_utf8(&buffer[..bytes_read as usize]).unwrap_or("<invalid utf8>");
            print!("Read: {}", content);
        }

        libc::close(fd);
    }
}
```

Compare to the idiomatic Rust version:

```rust
use std::fs;

fn idiomatic_rust() -> std::io::Result<()> {
    let content = fs::read_to_string("/etc/hostname")?;
    print!("Read: {}", content);
    Ok(())
}
```

The idiomatic version makes the same syscalls under the hood but handles
errors safely, manages the fd lifetime automatically, and is impossible
to use incorrectly.

### Seeing which syscalls Rust uses

```rust
use std::fs::File;
use std::io::{BufWriter, Write};

fn main() -> std::io::Result<()> {
    let file = File::create("/tmp/syscall_test.txt")?;
    let mut writer = BufWriter::new(file);

    for i in 0..100 {
        writeln!(writer, "Line {}", i)?;
    }

    writer.flush()?;
    Ok(())
}
```

Run it under strace:
```bash
# Build first
cargo build --release

# Trace it
strace -c ./target/release/your_binary

# Output shows syscall counts:
# % time     seconds  calls  syscall
# ------ ----------- ------ -------
#  45.00    0.000009      3  write
#  25.00    0.000005      5  mmap
#  15.00    0.000003      1  openat
#  ...
```

Notice how `BufWriter` batches all 100 `writeln!` calls into just
a few `write` syscalls.

---

## Syscall Errors

Syscalls communicate errors by returning -1 and setting `errno`.
Rust wraps this into `std::io::Error`.

```rust
use std::io;
use std::fs::File;

fn handle_syscall_errors() {
    match File::open("/nonexistent") {
        Ok(_) => println!("opened"),
        Err(err) => {
            println!("Error: {}", err);
            println!("Kind: {:?}", err.kind());

            if let Some(os_error) = err.raw_os_error() {
                println!("OS error code: {}", os_error);
            }
        }
    }
}
```

Common errno values:

| errno    | Rust ErrorKind         | Meaning                      |
|----------|------------------------|------------------------------|
| ENOENT   | NotFound               | File doesn't exist           |
| EACCES   | PermissionDenied       | No permission                |
| EEXIST   | AlreadyExists          | File already exists          |
| EMFILE   | (Other)                | Too many open files          |
| ENOMEM   | OutOfMemory            | Not enough memory            |
| EINTR    | Interrupted            | Syscall interrupted by signal|
| EAGAIN   | WouldBlock             | Resource temporarily unavail |
| EPIPE    | BrokenPipe             | Write to closed pipe/socket  |
| ENOSPC   | (Other)                | No space left on device      |

---

## Exercises

### Exercise 1: Trace a Rust Program

Build and trace a simple Rust program:

```rust
use std::fs;

fn main() -> std::io::Result<()> {
    let content = fs::read_to_string("/etc/hosts")?;
    println!("File has {} bytes", content.len());
    fs::write("/tmp/hosts_copy.txt", &content)?;
    Ok(())
}
```

```bash
cargo build --release
strace -c ./target/release/your_binary     # count syscalls
strace ./target/release/your_binary 2>&1 | head -40  # see detail
```

Questions:
1. How many `read` syscalls were made?
2. How many `write` syscalls?
3. What was the buffer size for `read`?
4. What's the total syscall count?

### Exercise 2: Measure Syscall Overhead

Write a program that measures time for 100,000 `getpid()` calls (one of
the cheapest syscalls):

```rust
use std::time::Instant;

fn main() {
    let iterations = 100_000;
    let start = Instant::now();

    for _ in 0..iterations {
        unsafe { libc::getpid(); }
    }

    let elapsed = start.elapsed();
    println!(
        "{} getpid() calls in {:?} ({:.0} ns/call)",
        iterations,
        elapsed,
        elapsed.as_nanos() as f64 / iterations as f64
    );
}
```

### Exercise 3: Buffered vs Unbuffered Syscall Count

Write two versions of a program that writes 10,000 lines to a file:
one using `File` directly, one using `BufWriter`. Run both under
`strace -c` and compare the number of `write` syscalls.

### Exercise 4: Identify the Syscalls

For each Rust operation, predict which syscall(s) will be made, then
verify with strace:

1. `std::fs::read_to_string("file.txt")`
2. `std::process::Command::new("ls").output()`
3. `std::thread::spawn(|| {})`
4. `std::net::TcpListener::bind("127.0.0.1:8080")`

---

Next: [Lesson 12: Memory-Mapped Files and Shared Memory](./12-mmap-shared-memory.md)
