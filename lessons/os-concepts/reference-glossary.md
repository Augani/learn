# OS Concepts — Reference Glossary

Quick-reference for OS terms, syscalls, and process states.
Keep this open in a side tab while working through the lessons.

---

## Process States Diagram

```
                          ┌─────────────────────┐
                          │                     │
            ┌─────────────▼──────────┐          │
            │                        │          │
    ┌──────►│        READY           │          │
    │       │  (in scheduler queue)  │          │
    │       │                        │          │
    │       └───────────┬────────────┘          │
    │                   │                       │
    │           scheduler picks                 │
    │            this process                   │
    │                   │                       │
    │       ┌───────────▼────────────┐          │
    │       │                        │  timer   │
    │       │       RUNNING          ├──────────┘
    │       │  (on CPU right now)    │  interrupt
    │       │                        │  (preempted)
    │       └──┬─────────────────┬───┘
    │          │                 │
    │    waits for I/O      calls exit()
    │    or event               │
    │          │        ┌───────▼────────────┐
    │          │        │                    │
    │          │        │    TERMINATED      │
    │          │        │    (zombie until   │
    │          │        │     parent waits)  │
    │          │        │                    │
    │          │        └────────────────────┘
    │          │
    │  ┌───────▼────────────┐
    │  │                    │
    │  │      WAITING       │
    │  │  (blocked on I/O,  │
    │  │   sleep, mutex)    │
    │  │                    │
    │  └───────┬────────────┘
    │          │
    │     I/O completes
    │     or event fires
    │          │
    └──────────┘
```

---

## Core Terms

| Term | Definition |
|------|-----------|
| **Kernel** | The core of the OS. Runs in privileged mode with direct hardware access. |
| **User space** | Where your programs run. No direct hardware access; must ask the kernel via syscalls. |
| **System call (syscall)** | A function call that crosses from user space into the kernel. The only way your code talks to hardware. |
| **Process** | A running instance of a program. Has its own memory space, file descriptors, PID. |
| **Thread** | A unit of execution within a process. Shares the process's memory but has its own stack. |
| **PID** | Process ID. A unique integer identifying a running process. |
| **PPID** | Parent Process ID. The PID of the process that created this one. |
| **File descriptor (fd)** | An integer handle to an open file, socket, pipe, or device. 0=stdin, 1=stdout, 2=stderr. |
| **Virtual memory** | An abstraction giving each process its own address space, mapped to physical RAM by the kernel. |
| **Page** | A fixed-size block of memory (typically 4 KB). The unit of virtual-to-physical mapping. |
| **Page table** | A per-process data structure mapping virtual page numbers to physical frame numbers. |
| **Page fault** | A hardware interrupt triggered when a process accesses a virtual page not currently in physical RAM. |
| **TLB** | Translation Lookaside Buffer. A CPU cache for recent virtual-to-physical translations. |
| **Context switch** | Saving one thread's CPU state and loading another's. Costs ~1-10 microseconds. |
| **Scheduler** | The kernel component that decides which thread runs next on each CPU core. |
| **Preemption** | The OS forcibly pausing a running thread (via timer interrupt) to let another run. |
| **Time slice / quantum** | The maximum time a thread runs before being preempted (typically 1-10 ms). |
| **Mutex** | Mutual exclusion lock. Only one thread can hold it at a time. |
| **Semaphore** | A counter-based synchronization primitive. Allows up to N concurrent accessors. |
| **Atomic operation** | A CPU-level operation that completes indivisibly. No other thread can see a partial result. |
| **Deadlock** | Two or more threads each waiting for a resource the other holds. Nothing progresses. |
| **Race condition** | A bug where the outcome depends on unpredictable thread timing. |
| **Data race** | Two threads access the same memory concurrently, at least one writes, with no synchronization. Undefined behavior in C/C++. Prevented at compile time in Rust. |
| **Stack** | Per-thread memory region. Grows/shrinks automatically with function calls. Fast, LIFO. |
| **Heap** | Process-wide memory region. Allocated/freed manually (or by ownership in Rust). Slower, flexible. |
| **BSS segment** | Uninitialized global/static variables. Zeroed at process start. |
| **Text segment** | The read-only, executable machine code of the program. |
| **mmap** | Memory-map a file or device into a process's virtual address space. |
| **fork()** | Create a new process by cloning the current one. Child gets a copy of parent's memory. |
| **exec()** | Replace the current process's code with a new program. Keeps the same PID. |
| **Signal** | An asynchronous notification sent to a process (e.g., SIGKILL, SIGTERM, SIGSEGV). |
| **Zombie process** | A terminated process whose exit status hasn't been collected by its parent (via wait()). |
| **Orphan process** | A process whose parent terminated. Adopted by init/systemd (PID 1). |
| **IPC** | Inter-Process Communication. Pipes, sockets, shared memory, message queues. |
| **Pipe** | A unidirectional byte stream between two processes. Created by pipe(). |
| **Socket** | A bidirectional communication endpoint. Can be local (Unix domain) or networked (TCP/UDP). |

---

## Syscall Cheat Sheet

Common Linux/macOS system calls, grouped by category.

### Process Management

| Syscall | What it does | Rust equivalent |
|---------|-------------|-----------------|
| `fork()` | Clone current process | `Command::new()` uses fork+exec internally |
| `execve()` | Replace process image with new program | `Command::new("ls").exec()` (Unix ext) |
| `wait() / waitpid()` | Wait for child to terminate, collect exit status | `child.wait()` |
| `exit()` | Terminate current process | `std::process::exit(code)` |
| `getpid()` | Get current process ID | `std::process::id()` |
| `kill()` | Send a signal to a process | `nix::sys::signal::kill()` |
| `clone()` | Create process or thread (Linux-specific, superset of fork) | Used internally by `std::thread::spawn` |

### Memory Management

| Syscall | What it does | Rust equivalent |
|---------|-------------|-----------------|
| `brk() / sbrk()` | Expand/shrink the heap | Allocator uses this internally |
| `mmap()` | Map files or anonymous memory into address space | `memmap2::MmapMut` crate |
| `munmap()` | Unmap memory | Drop the Mmap handle |
| `mprotect()` | Change memory region permissions (read/write/exec) | `libc::mprotect()` |

### File I/O

| Syscall | What it does | Rust equivalent |
|---------|-------------|-----------------|
| `open()` | Open a file, get a file descriptor | `File::open()` / `File::create()` |
| `read()` | Read bytes from fd into buffer | `file.read(&mut buf)` |
| `write()` | Write bytes from buffer to fd | `file.write(&buf)` |
| `close()` | Close a file descriptor | `drop(file)` (automatic) |
| `lseek()` | Move the read/write position in a file | `file.seek(SeekFrom::Start(n))` |
| `stat()` | Get file metadata (size, permissions, timestamps) | `fs::metadata(path)` |
| `dup() / dup2()` | Duplicate a file descriptor | `libc::dup2()` |

### Threads and Synchronization

| Syscall | What it does | Rust equivalent |
|---------|-------------|-----------------|
| `clone()` | Create a thread (Linux) | `std::thread::spawn()` |
| `pthread_create()` | POSIX thread creation (library, wraps clone) | `std::thread::spawn()` |
| `futex()` | Fast userspace mutex (Linux) | Used internally by `std::sync::Mutex` |

### Networking

| Syscall | What it does | Rust equivalent |
|---------|-------------|-----------------|
| `socket()` | Create a communication endpoint | `TcpListener::bind()` / `UdpSocket::bind()` |
| `bind()` | Assign an address to a socket | Part of `TcpListener::bind()` |
| `listen()` | Mark socket as passive (server) | Part of `TcpListener::bind()` |
| `accept()` | Accept incoming connection | `listener.accept()` |
| `connect()` | Connect to a remote socket | `TcpStream::connect()` |
| `send() / recv()` | Send/receive data on socket | `stream.write()` / `stream.read()` |

---

## Process Memory Layout

```
High addresses
┌──────────────────────────────┐
│         Kernel space         │  (not accessible from user code)
├──────────────────────────────┤ ← 0x7FFF...  (varies by OS)
│           Stack              │  grows ↓
│     (local vars, frames)     │
│              ↓               │
│                              │
│         (free space)         │
│                              │
│              ↑               │
│           Heap               │  grows ↑
│    (dynamic allocations)     │
├──────────────────────────────┤
│     BSS (uninitialized       │
│     static/global vars)      │
├──────────────────────────────┤
│     Data (initialized        │
│     static/global vars)      │
├──────────────────────────────┤
│     Text (machine code)      │  read-only, executable
└──────────────────────────────┘
Low addresses (0x0000...)
```

---

## Quick Command Reference

| Task | Linux command | macOS command |
|------|--------------|---------------|
| List processes | `ps aux` | `ps aux` |
| Interactive process view | `htop` | `htop` (install via brew) |
| See process tree | `pstree` | `pstree` (install via brew) |
| Memory usage of a process | `pmap <pid>` | `vmmap <pid>` |
| See open file descriptors | `ls -la /proc/<pid>/fd` | `lsof -p <pid>` |
| See virtual memory stats | `vmstat` | `vm_stat` |
| See syscalls a process makes | `strace -p <pid>` | `dtruss -p <pid>` (needs SIP disabled) |
| See threads of a process | `ps -T -p <pid>` | `ps -M -p <pid>` |
| Kill a process | `kill <pid>` | `kill <pid>` |
| Force kill | `kill -9 <pid>` | `kill -9 <pid>` |
| See CPU info | `lscpu` | `sysctl -a \| grep cpu` |
| See page size | `getconf PAGE_SIZE` | `getconf PAGE_SIZE` |
