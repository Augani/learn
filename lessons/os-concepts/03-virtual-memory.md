# Lesson 03: Virtual Memory — Every Process Thinks It Has All the RAM

Your laptop has 16 GB of RAM, but you're running a browser with 50 tabs, an
IDE, Slack, Spotify, and three terminals. Each process acts like it has
gigabytes of contiguous memory to itself. This lesson explains the trick.

---

## The Problem

Without virtual memory:
- Every process would see real physical addresses.
- Process A could read/write process B's memory (no protection).
- You'd need to manually decide "process A gets addresses 0-1GB, process B
  gets 1-2GB" (fragmentation nightmare).
- A process would need all its memory to be contiguous in physical RAM.

Virtual memory solves all of these.

---

## Virtual Addresses vs Physical Addresses

Every pointer in your Rust code is a **virtual address**. It is NOT a location
in physical RAM. The CPU and kernel collaborate to translate each virtual
address to a physical one:

```
Your Rust code                     Physical RAM
─────────────                      ────────────

Process A
  let x = 42;
  // x is at virtual              ┌─────────────┐
  // address 0x7FFE_1234          │ Frame 0     │
                                  ├─────────────┤
  0x7FFE_1234 ──────────────────► │ x = 42      │  Frame 517
                                  ├─────────────┤
Process B                         │ y = 99      │  Frame 518
  let y = 99;                     ├─────────────┤
  // y is ALSO at virtual         │ ...         │
  // address 0x7FFE_1234          └─────────────┘
                                       ▲
  0x7FFE_1234 ─────────────────────────┘
                                  (different physical frame!)
```

Key insight: **the same virtual address in two different processes maps to
different physical locations.** Process A and B can both use address
`0x7FFE_1234` without conflicting because each process has its own mapping.

---

## The Floor Plan Analogy

Imagine a hotel where every guest is given a floor plan showing rooms
101 through 150. Every guest thinks they have "Room 101."

But the hotel manager (the kernel) knows:
- Guest A's "Room 101" is actually physical room 3-B on the third floor.
- Guest B's "Room 101" is actually physical room 7-A on the seventh floor.

The guests never see the real room numbers. They just use their floor plan
(virtual addresses), and the manager translates behind the scenes (page table).

If Guest A tries to visit "Room 200" — a room not on their floor plan — the
manager intercepts and says "Access denied!" (segmentation fault).

---

## Pages and Frames

Memory is divided into fixed-size blocks:

- **Virtual page** — a block of virtual address space (typically 4 KB).
- **Physical frame** — a block of physical RAM (same size, 4 KB).

```
Virtual address space (per process)    Physical RAM

Page 0  ┌────────┐                    ┌────────┐  Frame 0
        │        │──────────────┐     │ (free) │
Page 1  ├────────┤              │     ├────────┤  Frame 1
        │        │─────────┐    │     │ Proc B │
Page 2  ├────────┤         │    │     ├────────┤  Frame 2
        │        │───┐     │    └────►│ Proc A │
Page 3  ├────────┤   │     │          ├────────┤  Frame 3
        │(unused)│   │     └────────► │ Proc A │
        └────────┘   │               ├────────┤  Frame 4
                     │               │ (free) │
                     │               ├────────┤  Frame 5
                     └──────────────►│ Proc A │
                                     └────────┘
```

Notice:
- Virtual pages are contiguous (0, 1, 2, 3) but map to scattered physical
  frames (2, 3, 5). The process sees smooth, continuous memory even though it's
  fragmented in physical RAM.
- Page 3 is "unused" — it has no physical frame assigned. If the process tries
  to access it, a page fault occurs.

### Why 4 KB?

4 KB (4096 bytes) is the standard page size on x86. It's a balance:
- Too small → huge page tables, too many entries to track.
- Too large → wasted memory when a process uses only part of a page.

Check your system:
```bash
getconf PAGE_SIZE
```
Apple Silicon Macs use 16 KB pages. x86 Linux uses 4 KB.

---

## Page Tables — The Translation Directory

Each process has a **page table** maintained by the kernel. It maps virtual
page numbers to physical frame numbers:

```
Process A's Page Table
┌──────────────┬─────────────────┬────────────────┐
│ Virtual Page │ Physical Frame  │ Flags          │
├──────────────┼─────────────────┼────────────────┤
│ 0            │ 2               │ R (read-only)  │
│ 1            │ 3               │ RW (read-write)│
│ 2            │ 5               │ RW             │
│ 3            │ — (not mapped)  │ —              │
│ ...          │ ...             │ ...            │
│ 1023         │ 817             │ RW             │
└──────────────┴─────────────────┴────────────────┘
```

The flags control permissions:
- **R** — read only (code segment)
- **RW** — read/write (heap, stack)
- **X** — executable (code segment)
- **U** — user accessible (vs kernel-only pages)

### How address translation works

A virtual address has two parts:

```
Virtual address: 0x00002A38
                 ──────────

Split into:
┌────────────────────┬────────────────┐
│ Page number (high  │ Offset within  │
│ bits)              │ page (low bits)│
│                    │                │
│ 0x00002 = page 2   │ 0xA38 = byte   │
│                    │ 2616 in page   │
└────────────────────┴────────────────┘

Page table lookup:
  Page 2 → Frame 5

Physical address:
  Frame 5 base address + offset 0xA38
```

This happens on EVERY memory access. The CPU does it in hardware, not software,
so it's fast. But looking up the page table in memory for every access would
be slow, so the CPU caches recent translations in the TLB.

### TLB — Translation Lookaside Buffer

The TLB is a small, fast cache inside the CPU that stores recent page table
entries. It typically holds 64-1024 entries.

```
CPU wants address 0x7FFE_1234:

1. Check TLB: "Do I have page 0x7FFE_1 cached?"
   ├─ HIT (>99% of the time): Use cached frame number. ~1 nanosecond.
   └─ MISS: Walk the page table in memory. ~10-100 nanoseconds.
             Then cache the result in TLB.
```

TLB misses are expensive. Context switches flush (or tag) the TLB because each
process has a different page table. This is one reason context switches are
costly.

---

## Page Faults — When Memory Isn't There

A page fault occurs when a process accesses a virtual page that doesn't
currently have a physical frame:

```
Process accesses virtual page 42
            │
            ▼
    ┌───────────────┐
    │ Page in TLB?  │──── YES ──► Translate, continue
    └───────┬───────┘
            │ NO
            ▼
    ┌───────────────┐
    │ Page in page  │──── YES ──► Load into TLB, continue
    │ table (valid)?│
    └───────┬───────┘
            │ NO
            ▼
    ┌──────────────────────────────┐
    │       PAGE FAULT             │
    │  (CPU interrupts process,    │
    │   kernel takes over)         │
    └──────────┬───────────────────┘
               │
               ▼
    ┌──────────────────┐
    │ Valid address but │    ┌──────────────────┐
    │ page on disk?     │─NO─►│ Invalid address   │
    │ (swapped out)     │    │ → SIGSEGV        │
    └────────┬─────────┘    │ (segfault)       │
             │ YES           └──────────────────┘
             ▼
    ┌──────────────────┐
    │ Load page from   │
    │ disk into a free │
    │ physical frame   │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ Update page table│
    │ Resume process   │
    └──────────────────┘
```

Three types of page faults:

1. **Minor (soft)** — The page is in memory but not mapped yet (e.g., first
   access after `mmap` with lazy allocation). Just update the page table. Fast.

2. **Major (hard)** — The page was swapped to disk. Must read it back from the
   swap device. Slow (milliseconds — 100,000x slower than RAM access).

3. **Invalid** — The address isn't in the process's address space at all.
   Kernel sends SIGSEGV (segmentation fault) and typically kills the process.

---

## Swapping — Disk as Overflow RAM

When physical RAM is full and a process needs more:

```
RAM is full:
┌──────┬──────┬──────┬──────┬──────┐
│Proc A│Proc B│Proc C│Proc D│Proc E│   All frames occupied
└──────┴──────┴──────┴──────┴──────┘

Process F needs memory. Kernel picks a victim page
(say Proc B's least-recently-used page):

1. Write Proc B's page to swap space on disk
2. Mark Proc B's page table entry as "on disk"
3. Give that physical frame to Process F

Later, when Proc B accesses that page:
→ Page fault → Kernel loads it from disk → Very slow
```

This is why your computer gets painfully slow when you run out of RAM. Disk
access is ~100,000x slower than RAM access. macOS calls this "memory pressure."

Check swap usage:
```bash
# Linux
swapon --show
free -h

# macOS
sysctl vm.swapusage
```

---

## Memory Protection

Virtual memory gives us protection for free:

```
Process A's page table          Process B's page table
┌────────┬────────┐            ┌────────┬────────┐
│ VPage  │ Frame  │            │ VPage  │ Frame  │
├────────┼────────┤            ├────────┼────────┤
│ 0      │ 100    │            │ 0      │ 200    │
│ 1      │ 101    │            │ 1      │ 201    │
│ 2      │ 102    │            │ 2      │ 202    │
└────────┴────────┘            └────────┴────────┘

Process A can ONLY access frames 100, 101, 102.
Process B can ONLY access frames 200, 201, 202.

Process A cannot even name a virtual address that maps
to frames 200-202. There is no address it can use.
```

This is why:
- A bug in Chrome can't corrupt your Rust program's memory.
- A malicious app can't read your password manager's decrypted passwords.
- Rust's memory safety guarantees are per-process — different processes can't
  interfere regardless of what language they're written in.

---

## Process Memory Layout — In Detail

```
High addresses (e.g., 0x7FFF_FFFF_FFFF on 64-bit)
┌──────────────────────────────────────────┐
│             KERNEL SPACE                 │  Mapped into every process
│  (accessible only from kernel mode)      │  but inaccessible from
│                                          │  user code
├──────────────────────────────────────────┤ ← boundary (varies by OS)
│                                          │
│              STACK                       │  ↓ grows downward
│  - Local variables                       │
│  - Function arguments                   │
│  - Return addresses                     │
│  - One per thread                       │
│              ↓                          │
│                                          │
│     (unmapped gap — guard pages)         │  triggers segfault on
│                                          │  stack overflow
│                                          │
│              ↑                          │
│              HEAP                       │  ↑ grows upward
│  - Box::new(), Vec, String              │
│  - Anything dynamically sized           │
│                                          │
├──────────────────────────────────────────┤
│              BSS                        │  Uninitialized statics
│  static mut COUNTER: u64;  // = 0       │  (zeroed by kernel)
├──────────────────────────────────────────┤
│              DATA                       │  Initialized statics
│  static GREETING: &str = "hello";       │  and global constants
├──────────────────────────────────────────┤
│              TEXT (code)                │  Your compiled machine code
│  fn main() { ... }                      │  Read-only, executable
│  fn process_data() { ... }              │
└──────────────────────────────────────────┘
Low addresses (e.g., 0x0000_0000_0400)
```

The gap between stack and heap means both can grow without immediately
conflicting. Guard pages at the edges trigger a segfault if either grows
too far.

---

## mmap — A Preview

`mmap` (memory-mapped files) lets you map a file directly into your process's
virtual address space. Instead of calling `read()`, you access the file contents
as if they were in memory:

```
Regular file I/O:                Memory-mapped file:
File on disk                     File on disk
    │                                │
    │ read() syscall                 │ mmap() syscall
    ▼                                ▼
Kernel buffer                    Mapped directly into
    │                            your process's virtual
    │ copy to user               address space
    ▼                                │
Your buffer                      You read it like an array:
                                 let data = &mapped[0..100];
```

Covered in depth in lesson 12. For now, just know it exists — you'll see it
in `strace` output when the dynamic linker loads shared libraries.

---

## Virtual Memory in Rust — Seeing It

### Check how much virtual memory your process uses

```rust
fn main() {
    println!("PID: {}", std::process::id());

    let small_vec: Vec<u8> = vec![0; 1024];
    println!("Allocated 1 KB on heap at: {:p}", small_vec.as_ptr());

    let big_vec: Vec<u8> = vec![0; 100 * 1024 * 1024];
    println!("Allocated 100 MB on heap at: {:p}", big_vec.as_ptr());

    let stack_var = 42u64;
    println!("Stack variable at: {:p}", &stack_var);

    println!("\nRun in another terminal:");
    println!("  Linux: pmap {}", std::process::id());
    println!("  macOS: vmmap {}", std::process::id());
    println!("Press Enter to exit...");

    let mut input = String::new();
    std::io::stdin().read_line(&mut input).unwrap();
}
```

### Address space exploration

```rust
static GLOBAL: u64 = 12345;
static mut UNINITIALIZED: u64 = 0;

fn some_function() {
    println!("  code (text) is near:    {:p}", some_function as *const ());
}

fn main() {
    let stack_var: u64 = 42;
    let heap_var = Box::new(99u64);

    println!("Memory layout of this process:");
    some_function();
    println!("  global (data) is at:    {:p}", &GLOBAL);
    unsafe {
        println!("  uninitialized (BSS):    {:p}", &UNINITIALIZED);
    }
    println!("  heap allocation at:     {:p}", &*heap_var);
    println!("  stack variable at:      {:p}", &stack_var);

    println!("\nNotice: stack addresses > heap addresses > data/code addresses");
    println!("(This matches the memory layout diagram above)");
}
```

---

## Exercises

### Exercise 1: Page size and address math
Run `getconf PAGE_SIZE` on your system. If the page size is 4096 (0x1000)
bytes, and you have a virtual address `0x0040_3B20`:
- What page number is this? (Divide by page size: `0x0040_3B20 / 0x1000`)
- What is the offset within that page?

### Exercise 2: Watch virtual memory grow
```rust
fn main() {
    println!("PID: {}", std::process::id());

    let mut allocations: Vec<Vec<u8>> = Vec::new();

    for i in 0..20 {
        let chunk = vec![1u8; 10 * 1024 * 1024]; // 10 MB
        allocations.push(chunk);
        println!(
            "Allocated {} MB total. Check memory in htop.",
            (i + 1) * 10
        );
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
}
```
Watch in `htop` as the process's RSS (Resident Set Size) grows.

### Exercise 3: Trigger a segfault
```rust
fn main() {
    let null_ptr: *const u64 = std::ptr::null();
    unsafe {
        println!("{}", *null_ptr);
    }
}
```
This dereferences a null pointer (virtual address 0x0). The page table has no
mapping for page 0, so the CPU generates a page fault. The kernel sees it's an
invalid access and sends SIGSEGV. Rust catches this and panics.

### Exercise 4: Thinking questions
1. If two processes are running the same binary (e.g., two instances of `ls`),
   can they share the text (code) segment in physical memory? (Yes, and they
   do. The kernel maps both processes' text pages to the same physical frames.)
2. Why does the stack grow downward and the heap grow upward?
3. If your process has 4 GB of virtual address space but only uses 50 MB,
   how much physical RAM does it consume? (Answer: roughly 50 MB, not 4 GB.
   Only mapped pages use physical frames.)

---

Next: [Lesson 04: The Stack and Heap in Depth — What Your Rust Code Actually Does](./04-stack-heap-deep.md)
