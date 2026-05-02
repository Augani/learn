# Operating Systems — How Your Code Actually Runs

What the OS does between your Rust binary and the hardware.
No CS degree assumed. Everyday analogies for everything.
Rust code examples where it makes concepts concrete.

---

## Reference Files

- [Glossary & Concepts](./reference-glossary.md) — Terms, syscalls cheat sheet

---

## The Roadmap

### Phase 1: Processes and Memory (Hours 1–12)
- [ ] [Lesson 01: What the OS does — the big picture](./01-what-os-does.md)
- [ ] [Lesson 02: Processes — programs in motion](./02-processes.md)
- [ ] [Lesson 03: Virtual memory — every process thinks it has all the RAM](./03-virtual-memory.md)
- [ ] [Lesson 04: The stack and heap in depth — what your Rust code actually does](./04-stack-heap-deep.md)

### Phase 2: Threads, Scheduling, and Concurrency (Hours 13–24)
- [ ] [Lesson 05: Threads — doing multiple things in one process](./05-threads.md)
- [ ] [Lesson 06: Context switching — how the OS juggles programs](./06-context-switching.md)
- [ ] [Lesson 07: Synchronization — mutexes, semaphores, atomics](./07-synchronization.md)
- [ ] [Lesson 08: Deadlocks and race conditions — when concurrency goes wrong](./08-deadlocks-races.md)

### Phase 3: File Systems and I/O (Hours 25–36)
- [ ] [Lesson 09: File systems — how files actually work](./09-file-systems.md)
- [ ] [Lesson 10: File descriptors and I/O — the Unix everything-is-a-file model](./10-file-descriptors-io.md)
- [ ] [Lesson 11: System calls — the boundary between your code and the kernel](./11-syscalls.md)
- [ ] [Lesson 12: Memory-mapped files and shared memory](./12-mmap-shared-memory.md)

### Phase 4: Inter-Process Communication (Hours 37–44)
- [ ] [Lesson 13: Pipes, signals, and IPC](./13-pipes-signals-ipc.md)
- [ ] [Lesson 14: Sockets as IPC — talking between processes](./14-sockets-ipc.md)

### Phase 5: Practical Systems Programming in Rust (Hours 45–52)
- [ ] [Lesson 15: Working with the OS from Rust — std::process, std::fs, std::io](./15-rust-os-apis.md)
- [ ] [Lesson 16: Building a mini shell in Rust](./16-mini-shell-project.md)

---

## How to use these lessons

Every lesson has:
1. Concept explained with everyday analogies
2. What's happening under the hood (diagrams)
3. Rust code you can run to see the concept in action
4. Exercises

Many examples use Linux/macOS terminal commands alongside Rust code.

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Operating Systems: Three Easy Pieces** by Remzi and Andrea Arpaci-Dusseau (Arpaci-Dusseau Books) — Best OS textbook, ever. *Free at pages.cs.wisc.edu/~remzi/OSTEP*
- **Modern Operating Systems** by Andrew Tanenbaum and Herbert Bos (Pearson, 5th Edition 2022) — Comprehensive OS reference
