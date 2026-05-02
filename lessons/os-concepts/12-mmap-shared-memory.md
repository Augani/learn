# Lesson 12: Memory-Mapped Files and Shared Memory

What if instead of reading a file byte by byte through `read()` syscalls,
you could just point at a region of your process's memory and have the
file contents appear there? That's `mmap`. It's one of the most powerful
and widely-used OS features — databases, allocators, and shared libraries
all depend on it.

---

## What Is mmap?

`mmap` (memory map) tells the kernel: "Take this file and make it appear
in my virtual address space. I'll access it like regular memory."

```
Traditional read():                 mmap():

Your program:                       Your program:
  buffer = allocate(4096)              ptr = mmap(file)
  read(fd, buffer, 4096)  ← syscall   data = ptr[0..4096]  ← memory access
  process(buffer)                      process(data)
  read(fd, buffer, 4096)  ← syscall   data = ptr[4096..8192] ← memory access
  process(buffer)                      process(data)

  Total: N read() syscalls             Total: 1 mmap() syscall
         N copies kernel→user                 0 copies (direct access)
```

**Analogy: the library book**

With `read()`, you're photocopying pages from a library book one at a
time. Each photocopy requires walking to the copy machine (syscall),
copying the page (kernel-to-user copy), walking back (return).

With `mmap()`, the library puts the entire book on your desk. You flip
to any page instantly. The book is still the library's (the file on disk),
but you're reading it directly. If you need a page that wasn't pre-loaded,
the library silently fetches it and slides it into the binding (page fault).

---

## How mmap Works Under the Hood

```
Virtual Address Space of Process
┌──────────────────────────────────────────┐
│ 0x0000...                                │
│        Code segment                      │
│        Data segment                      │
│        Heap ↓                            │
│        ...                               │
│        ┌─────────────────────────┐       │
│ 0x7f.. │  mmap region            │       │
│        │  File: data.bin         │       │
│        │  Offset: 0              │       │
│        │  Length: 1 GB           │       │
│        │                         │       │
│        │  Virtual pages:         │       │
│        │  Page 0: loaded  ✓     │       │
│        │  Page 1: not yet  ✗    │       │
│        │  Page 2: loaded  ✓     │       │
│        │  Page 3: not yet  ✗    │       │
│        │  ...                    │       │
│        └─────────────────────────┘       │
│        ...                               │
│        Stack ↑                           │
│ 0xFFFF...                                │
└──────────────────────────────────────────┘
```

Step by step:

1. **You call mmap()**: kernel reserves a range of virtual addresses
   and records "these addresses map to this file"
2. **No data is loaded yet**: the pages are marked "not present" in the
   page table
3. **You access an address**: CPU tries to read/write the virtual address
4. **Page fault**: the page isn't in RAM, so the CPU traps to the kernel
5. **Kernel loads the page**: reads the corresponding file block from disk
   into a physical page, maps it into your virtual address space
6. **You continue**: the access completes as if the data was always there
7. **Subsequent accesses to the same page**: no fault, direct memory access

```
First access to mmap'd page:

Your code:  let x = data[500];
                │
CPU:  translate virtual addr → page not present
                │
         ┌──────▼──────┐
         │  PAGE FAULT  │
         └──────┬──────┘
                │
Kernel: 1. Find which file this maps to
        2. Calculate file offset (page 0 → bytes 0-4095)
        3. Read from disk into physical memory
        4. Update page table: virtual → physical
        5. Return to user code
                │
Your code:  x now has the value ← transparently loaded
```

---

## Benefits of mmap

### 1. No copy between kernel and user space

With `read()`, data is copied: disk → kernel buffer → user buffer.
With `mmap()`, the page IS your buffer. The kernel maps the same
physical page directly into your address space.

```
read() path:
  Disk → Kernel page cache → Copy to user buffer → Your code reads it

mmap() path:
  Disk → Kernel page cache ← Your code reads it directly
                               (same physical page, mapped into
                                both kernel and user space)
```

### 2. OS handles caching automatically

The kernel's page cache decides what stays in RAM. Frequently accessed
pages stay cached. Rarely used pages get evicted. You don't manage
any of this.

### 3. Random access without seeking

With `read()`, you need `lseek()` to jump around. With mmap, just
access any offset directly: `data[offset]`.

### 4. Lazy loading

A 10 GB file can be mmap'd even if you only have 4 GB of RAM. Only
pages you actually touch get loaded.

---

## mmap Modes

```rust
// mmap function signature (simplified)
mmap(
    addr:   *mut c_void,   // suggested address (usually NULL = let OS pick)
    length: size_t,        // how many bytes to map
    prot:   c_int,         // protection: PROT_READ, PROT_WRITE, PROT_EXEC
    flags:  c_int,         // MAP_SHARED, MAP_PRIVATE, MAP_ANONYMOUS
    fd:     c_int,         // file descriptor (-1 for anonymous)
    offset: off_t,         // offset into the file
) -> *mut c_void           // pointer to mapped region
```

### MAP_SHARED vs MAP_PRIVATE

```
MAP_SHARED:
  - Changes to the mapping are written back to the file
  - Changes are visible to other processes mapping the same file
  - Used for: IPC, shared databases

MAP_PRIVATE (copy-on-write):
  - You get a private copy — writes don't affect the file
  - Uses copy-on-write: pages are shared until you modify one,
    then the kernel copies that page for you
  - Used for: loading shared libraries, private working copies

MAP_ANONYMOUS:
  - Not backed by any file — just a region of zeroed memory
  - Used for: memory allocation (malloc uses this for large allocations)
```

```
MAP_SHARED — two processes, same file:

Process A virtual space:        Process B virtual space:
┌────────────────┐              ┌────────────────┐
│ mmap region    │              │ mmap region    │
│ page 0 ────────┼──┐      ┌───┼── page 0       │
│ page 1 ────────┼──┼──┐   │   │                │
└────────────────┘  │  │   │   └────────────────┘
                    │  │   │
                    ▼  ▼   ▼
              Physical Memory
              ┌──────────┐
              │ page X   │ ← shared by both processes
              │ page Y   │ ← shared by both processes
              └──────────┘

              Write by A → visible to B (and written to file)
```

---

## Use Cases

### 1. Databases

PostgreSQL, SQLite, and many databases use mmap to access their data
files. Instead of explicit read/write calls, they map the database file
into memory and access records via pointer arithmetic.

### 2. Large File Processing

Processing a 50 GB log file? Map it and scan through it. The OS pages
in only what you need.

### 3. Shared Libraries

When you link against `libc.so`, the OS doesn't copy it into every
process. It mmaps the shared library file and maps the same physical
pages into every process that uses it.

### 4. Inter-Process Communication (IPC)

Two processes can map the same file with `MAP_SHARED` to communicate
through shared memory — the fastest form of IPC.

### 5. Memory Allocators

When `malloc` needs a large chunk of memory (typically > 128 KB),
it uses `mmap(MAP_ANONYMOUS)` instead of `brk()`. This returns
memory directly from the OS.

---

## Anonymous mmap

An anonymous mapping isn't backed by a file — it's just a chunk of
zeroed virtual memory.

```
Regular mmap:        file on disk ← backs the memory pages
Anonymous mmap:      no file     ← pages are zero-filled on demand

Common uses:
- malloc/jemalloc for large allocations
- Thread stacks (each thread gets an anonymous mmap for its stack)
- Shared memory between parent and child (MAP_SHARED|MAP_ANONYMOUS + fork)
```

When you call `Vec::with_capacity(1_000_000)` in Rust, the allocator
may ultimately use an anonymous mmap to get that memory from the OS.

---

## Dangers and Gotchas

### 1. File truncation

If another process truncates the mapped file, accessing the now-invalid
region causes a `SIGBUS` signal (not a segfault — a bus error).

### 2. Synchronization

With `MAP_SHARED`, two processes writing to the same page need
synchronization (mutexes, atomics). The kernel doesn't prevent
concurrent writes.

### 3. msync for durability

Changes to a `MAP_SHARED` mapping aren't immediately flushed to disk.
You must call `msync()` to ensure data is written. (Similar to
`fsync()` for regular writes.)

### 4. Not always faster

For small files read once sequentially, `read()` can be faster than
mmap because mmap has setup overhead (page table manipulation). mmap
shines for large files, random access, and repeated access.

```
Use read() when:               Use mmap() when:
- Small file, read once       - Large file
- Sequential access            - Random access patterns
- Need precise control         - Multiple processes sharing data
  over read size               - Repeated access to same data
                               - Memory-like access pattern
```

### 5. 32-bit address space limits

On 32-bit systems, you only have ~3 GB of virtual address space. You
can't mmap a 4 GB file. On 64-bit systems, virtual address space is
effectively unlimited (128 TB+), so this isn't an issue.

---

## Rust: Using mmap with the memmap2 Crate

### Reading a file with mmap

```rust
// Cargo.toml: memmap2 = "0.9"

use memmap2::Mmap;
use std::fs::File;
use std::io;

fn mmap_read(path: &str) -> io::Result<()> {
    let file = File::open(path)?;
    let mmap = unsafe { Mmap::map(&file)? };

    println!("File size: {} bytes", mmap.len());
    println!("First 100 bytes as string:");

    let end = std::cmp::min(100, mmap.len());
    if let Ok(text) = std::str::from_utf8(&mmap[..end]) {
        println!("{}", text);
    }

    let newline_count = mmap.iter().filter(|&&b| b == b'\n').count();
    println!("Total newlines: {}", newline_count);

    Ok(())
}
```

### Writing with mmap

```rust
use memmap2::MmapMut;
use std::fs::OpenOptions;
use std::io::{self, Write};

fn mmap_write(path: &str) -> io::Result<()> {
    let message = b"Hello from mmap!\n";

    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .open(path)?;

    file.set_len(message.len() as u64)?;

    let mut mmap = unsafe { MmapMut::map_mut(&file)? };

    mmap[..message.len()].copy_from_slice(message);

    mmap.flush()?;

    println!("Wrote {} bytes via mmap", message.len());
    Ok(())
}
```

### Searching a large file efficiently

```rust
use memmap2::Mmap;
use std::fs::File;
use std::io;

fn search_mmap(path: &str, pattern: &[u8]) -> io::Result<Vec<usize>> {
    let file = File::open(path)?;
    let mmap = unsafe { Mmap::map(&file)? };
    let mut positions = Vec::new();

    let data = &mmap[..];
    let mut offset = 0;

    while offset + pattern.len() <= data.len() {
        if &data[offset..offset + pattern.len()] == pattern {
            positions.push(offset);
        }
        offset += 1;
    }

    Ok(positions)
}

fn main() -> io::Result<()> {
    let positions = search_mmap("/var/log/system.log", b"error")?;
    println!("Found 'error' at {} positions", positions.len());
    for pos in positions.iter().take(10) {
        println!("  offset: {}", pos);
    }
    Ok(())
}
```

---

## Performance Comparison: read() vs mmap()

```rust
use std::fs::File;
use std::io::{self, BufReader, Read};
use std::time::Instant;
use memmap2::Mmap;

fn count_newlines_read(path: &str) -> io::Result<(usize, std::time::Duration)> {
    let start = Instant::now();
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut buffer = Vec::new();
    reader.read_to_end(&mut buffer)?;

    let count = buffer.iter().filter(|&&b| b == b'\n').count();
    Ok((count, start.elapsed()))
}

fn count_newlines_mmap(path: &str) -> io::Result<(usize, std::time::Duration)> {
    let start = Instant::now();
    let file = File::open(path)?;
    let mmap = unsafe { Mmap::map(&file)? };

    let count = mmap.iter().filter(|&&b| b == b'\n').count();
    Ok((count, start.elapsed()))
}

fn main() -> io::Result<()> {
    let path = "/var/log/system.log";

    let (count1, time1) = count_newlines_read(path)?;
    println!("read():  {} newlines in {:?}", count1, time1);

    let (count2, time2) = count_newlines_mmap(path)?;
    println!("mmap():  {} newlines in {:?}", count2, time2);

    Ok(())
}
```

Typical results for a large file (first access):
- `read()` and `mmap()` are similar — both are limited by disk I/O
- For subsequent accesses (data in page cache), mmap can be faster
  because it avoids the kernel-to-user copy

---

## Shared Memory Between Processes

Two processes can communicate through shared memory backed by a file
or by anonymous shared mappings.

```
Process A                          Process B
┌──────────────────────┐          ┌──────────────────────┐
│ mmap("shared.dat",   │          │ mmap("shared.dat",   │
│      MAP_SHARED)     │          │      MAP_SHARED)     │
│                      │          │                      │
│ Write: data[0] = 42  │          │ Read:  data[0] → 42  │
│                      │          │                      │
│ Both map the same    │          │ Both map the same    │
│ physical pages       │          │ physical pages       │
└──────────────────────┘          └──────────────────────┘
         │                                  │
         └──────────┐    ┌──────────────────┘
                    ▼    ▼
            Physical Memory
            ┌────────────┐
            │ Shared page│
            │ data[0]=42 │
            └────────────┘
```

This is the fastest IPC mechanism — no syscalls to send/receive data,
just memory reads and writes. But you need synchronization (atomics,
mutexes) to prevent races.

---

## Exercises

### Exercise 1: mmap a File and Count Words

Use the `memmap2` crate to memory-map a text file and count:
- Total bytes
- Number of newlines
- Number of words (whitespace-delimited)

Compare timing against `fs::read_to_string()`.

### Exercise 2: Random Access with mmap

Memory-map a large binary file and read specific offsets without
scanning the whole file. For example, read bytes at offsets 0, 1000,
1000000, and the last byte.

### Exercise 3: Build a Simple Key-Value Store

Create a fixed-record key-value store using mmap:
- Each record: 32 bytes for key, 96 bytes for value (128 bytes total)
- Memory-map a file, calculate offset by record number
- Write and read records by index

```rust
#[repr(C)]
struct Record {
    key: [u8; 32],
    value: [u8; 96],
}
```

### Exercise 4: Shared Memory IPC

Write two programs:
1. A writer that memory-maps a shared file and writes a counter value
   every second
2. A reader that memory-maps the same file and reads + prints the
   counter value every second

Observe how changes from the writer appear in the reader without any
explicit communication.

### Exercise 5: Benchmark read() vs mmap()

Create a test file of 100 MB. Benchmark these operations:
1. Sequential read with `read()` (BufReader, 8 KB buffer)
2. Sequential scan with `mmap()`
3. 1000 random 4 KB reads with `read()` + `seek()`
4. 1000 random 4 KB reads with `mmap()` (just index into the slice)

For which access pattern does mmap win? For which is read() competitive?

---

Next: [Lesson 13: Pipes, Signals, and IPC](./13-pipes-signals-ipc.md)
