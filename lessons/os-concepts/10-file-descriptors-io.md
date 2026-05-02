# Lesson 10: File Descriptors and I/O — Everything Is a File

One of Unix's most powerful ideas: files, network connections, pipes,
devices, and even random number generators all look the same to your
program. They're all file descriptors — small integers you read from
and write to.

---

## The Unix Philosophy: Everything Is a File

In Unix, nearly everything is accessed through the same interface:
open it, get a file descriptor, read/write through it, close it.

```
┌─────────────────────────────────────────────┐
│              Your Program                    │
│                                              │
│  fd 0 ──→ stdin  (keyboard)                 │
│  fd 1 ──→ stdout (terminal)                 │
│  fd 2 ──→ stderr (terminal)                 │
│  fd 3 ──→ /home/alice/data.txt              │
│  fd 4 ──→ TCP socket (connection to server) │
│  fd 5 ──→ pipe (to another process)         │
│  fd 6 ──→ /dev/urandom (random bytes)       │
│                                              │
│  All accessed with read() and write()        │
└─────────────────────────────────────────────┘
```

This uniformity means you can write ONE function that processes data,
and it works whether the data comes from a file, a network socket, a
pipe, or the keyboard. Rust's `Read` and `Write` traits are the modern
expression of this idea.

---

## File Descriptors: What They Actually Are

A file descriptor (fd) is a small non-negative integer. It's an index
into a per-process table that the kernel maintains.

**Analogy: deli counter tickets**

File descriptors are like numbered tickets at a deli counter. When you
"open" a resource, the OS hands you a ticket with the next available
number. You show that ticket (number) whenever you want to interact
with that resource. When you're done, you return the ticket (close).

```
Process #1234 — File Descriptor Table
┌─────┬──────────────────────────────────────────────────┐
│ fd  │ Points to (in kernel)                            │
├─────┼──────────────────────────────────────────────────┤
│  0  │ → Open File Description → terminal /dev/pts/1   │
│  1  │ → Open File Description → terminal /dev/pts/1   │
│  2  │ → Open File Description → terminal /dev/pts/1   │
│  3  │ → Open File Description → /home/alice/data.txt  │
│  4  │ → Open File Description → TCP socket 10.0.0.1   │
│  5  │ (unused)                                         │
│  6  │ (unused)                                         │
│ ... │                                                  │
└─────┴──────────────────────────────────────────────────┘
```

The three standard file descriptors that every process starts with:

| fd | Name   | Purpose                    | C constant    |
|----|--------|----------------------------|---------------|
| 0  | stdin  | Standard input (keyboard)  | STDIN_FILENO  |
| 1  | stdout | Standard output (terminal) | STDOUT_FILENO |
| 2  | stderr | Standard error (terminal)  | STDERR_FILENO |

When you open a new file, the kernel assigns the **lowest available**
fd number. If 0, 1, 2 are taken and nothing else is open, the next
file you open gets fd 3.

---

## The Kernel's View: Three-Level Structure

There are actually three levels of indirection:

```
Process A                     Kernel
┌──────────┐
│ fd table  │
│ 0 ──→ ───┼──→ ┌──────────────────────┐
│ 1 ──→ ───┼──→ │ Open File Description │──→ ┌────────┐
│ 3 ──→ ───┼──→ │ - file offset: 1024  │    │ Inode  │
└──────────┘    │ - access mode: O_RD  │    │ (vnode)│
                │ - flags              │    │        │
Process B       └──────────────────────┘    │ actual │
┌──────────┐                                │ file   │
│ fd table  │    ┌──────────────────────┐    │ on disk│
│ 0 ──→ ───┼──→ │ Open File Description │──→ │        │
│ 1 ──→ ───┼──→ │ - file offset: 0     │    └────────┘
│ 4 ──→ ───┼──→ │ - access mode: O_RW  │
└──────────┘    └──────────────────────┘
```

1. **File descriptor table** (per process): maps fd numbers to open file descriptions
2. **Open file description** (kernel-wide): tracks offset, mode, flags
3. **Inode/vnode** (kernel-wide): represents the actual file on disk

Two processes can open the same file independently. They each get their
own open file description (with separate offsets), both pointing to the
same inode.

If a process forks, the child **shares** the parent's open file
descriptions — so they share the file offset. Writes from parent and
child interleave.

---

## The Fundamental I/O Operations

Everything boils down to five operations:

### open() — Get a File Descriptor

```
open("/home/alice/data.txt", O_RDONLY)  →  returns fd 3

Kernel:
1. Resolve the path to an inode
2. Check permissions
3. Create an Open File Description (offset=0, mode=read)
4. Find lowest unused fd in process table
5. Point that fd at the Open File Description
6. Return the fd number
```

### read() — Pull Bytes In

```
read(fd=3, buffer, count=100)

1. Kernel looks up fd 3 → Open File Description → inode
2. Reads up to 100 bytes from current offset
3. Copies data from kernel buffer to your buffer
4. Advances the offset by bytes read
5. Returns number of bytes actually read (may be less than 100)
```

A return of 0 means end-of-file (EOF). A return of -1 means error.

### write() — Push Bytes Out

```
write(fd=1, "Hello\n", 6)

1. Kernel looks up fd 1 → Open File Description → terminal
2. Copies 6 bytes from your buffer to kernel
3. Delivers to the output device
4. Advances offset (for files)
5. Returns number of bytes written
```

### lseek() — Move the Offset

```
lseek(fd=3, 0, SEEK_SET)   ← go to beginning
lseek(fd=3, 100, SEEK_CUR) ← skip forward 100 bytes
lseek(fd=3, -10, SEEK_END) ← go to 10 bytes before end
```

Not all file descriptors support seeking. Pipes, sockets, and terminals
don't — they're sequential streams.

### close() — Release the File Descriptor

```
close(fd=3)

1. Remove fd 3 from the process's fd table
2. Decrement reference count on the Open File Description
3. If ref count reaches 0, free the description
4. If no more descriptions point to the inode, flush and release
```

Always close your file descriptors. Leaking them is a resource bug,
just like leaking memory. Rust's `Drop` trait handles this automatically
for `File` objects.

---

## Buffered vs Unbuffered I/O

System calls are expensive (~100ns-1us each). If you call `read()` one
byte at a time on a 1 MB file, that's one million system calls.

**Buffered I/O** reads a large chunk (e.g., 8 KB) in one system call,
then serves individual reads from an in-memory buffer.

```
Unbuffered (1 byte at a time):
read(fd, buf, 1)  → syscall → kernel → disk → 1 byte
read(fd, buf, 1)  → syscall → kernel → disk → 1 byte
read(fd, buf, 1)  → syscall → kernel → disk → 1 byte
... 1,000,000 syscalls for 1 MB

Buffered (8 KB chunks):
read(fd, buf, 8192) → syscall → kernel → disk → 8192 bytes
  then serve 8192 individual reads from memory (no syscall)
read(fd, buf, 8192) → syscall → kernel → disk → 8192 bytes
  ...
... only 128 syscalls for 1 MB
```

This is why `BufReader` and `BufWriter` exist in Rust.

```
┌──────────────┐     ┌──────────────┐     ┌────────────┐
│ Your code    │     │   Buffer     │     │   Kernel   │
│              │     │   (8 KB)     │     │            │
│ read 1 byte ──────→│ serve from   │     │            │
│ read 1 byte ──────→│ buffer       │     │            │
│ read 1 byte ──────→│              │     │            │
│ ...          │     │ buffer empty ──────→│ read 8KB   │
│ read 1 byte ──────→│ refill       │     │ from disk  │
│              │     │ buffer       │     │            │
└──────────────┘     └──────────────┘     └────────────┘
```

---

## File Descriptor Limits

Every process has a limit on how many file descriptors it can open.

```bash
# See limits
ulimit -n        # soft limit (usually 256 or 1024)
ulimit -Hn       # hard limit (can be higher)

# Linux: see actual limits for a running process
cat /proc/<PID>/limits

# Raise the soft limit for current shell
ulimit -n 4096
```

Running out of file descriptors is a common production issue for servers
that handle many connections. Each client connection = 1 file descriptor.
If you hit the limit, `open()` and `accept()` return `EMFILE` (too many
open files).

---

## How Shell Redirection Works

When you type `ls > output.txt`, the shell:

1. Forks a child process
2. In the child, opens `output.txt` and gets fd 3
3. Closes fd 1 (stdout)
4. Duplicates fd 3 into fd 1 (using `dup2(3, 1)`)
5. Closes fd 3 (no longer needed)
6. Execs `ls` — which writes to fd 1, which now points to the file

```
Before redirection:         After dup2(3, 1):
┌─────┬─────────────┐      ┌─────┬──────────────┐
│  0  │ keyboard    │      │  0  │ keyboard     │
│  1  │ terminal    │      │  1  │ output.txt   │  ← redirected!
│  2  │ terminal    │      │  2  │ terminal     │
│  3  │ output.txt  │      │  3  │ (closed)     │
└─────┴─────────────┘      └─────┴──────────────┘
```

`ls` doesn't know or care that stdout was redirected. It just writes
to fd 1 like it always does. This is the power of the fd abstraction.

Pipe redirection (`ls | grep foo`) works similarly:

1. Shell creates a pipe (gets two fds: read-end and write-end)
2. Fork child 1 (ls): redirect stdout to write-end of pipe
3. Fork child 2 (grep): redirect stdin to read-end of pipe
4. Both children exec their programs

---

## Rust: File Descriptors and I/O

### Basic file I/O

```rust
use std::fs::File;
use std::io::{self, Read, Write};

fn basic_io() -> io::Result<()> {
    let mut file = File::create("output.txt")?;
    file.write_all(b"Hello, world!\n")?;
    file.write_all(b"Second line\n")?;

    let mut file = File::open("output.txt")?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    println!("Read: {}", contents);

    std::fs::remove_file("output.txt")?;
    Ok(())
}
```

### Getting the raw file descriptor

```rust
use std::fs::File;
use std::os::unix::io::AsRawFd;

fn show_fd() -> std::io::Result<()> {
    let file = File::open("/etc/hosts")?;
    println!("File descriptor number: {}", file.as_raw_fd());
    Ok(())
}
```

### BufReader and BufWriter — buffered I/O

```rust
use std::fs::File;
use std::io::{self, BufRead, BufReader, BufWriter, Write};

fn buffered_reading(path: &str) -> io::Result<()> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);

    for (line_number, line) in reader.lines().enumerate() {
        let line = line?;
        println!("{:4}: {}", line_number + 1, line);
    }
    Ok(())
}

fn buffered_writing(path: &str) -> io::Result<()> {
    let file = File::create(path)?;
    let mut writer = BufWriter::new(file);

    for i in 0..1000 {
        writeln!(writer, "Line {}", i)?;
    }

    writer.flush()?;
    Ok(())
}
```

### Seeking in files

```rust
use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};

fn random_access() -> io::Result<()> {
    let mut file = File::open("/etc/hosts")?;

    file.seek(SeekFrom::Start(10))?;

    let mut buffer = [0u8; 20];
    let bytes_read = file.read(&mut buffer)?;
    println!("Read {} bytes from offset 10: {:?}",
        bytes_read, std::str::from_utf8(&buffer[..bytes_read]));

    file.seek(SeekFrom::End(-10))?;

    let bytes_read = file.read(&mut buffer)?;
    println!("Last 10 bytes: {:?}",
        std::str::from_utf8(&buffer[..bytes_read]));

    Ok(())
}
```

### Stdin, Stdout, Stderr

```rust
use std::io::{self, BufRead, Write};

fn echo_stdin() -> io::Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let line = line?;
        if line == "quit" {
            break;
        }
        writeln!(stdout, "You said: {}", line)?;
    }
    Ok(())
}
```

---

## Exercises

### Exercise 1: Implement `cat` in Rust

Build a simple `cat` command that:
- If given file arguments, prints each file's contents to stdout
- If given no arguments, copies stdin to stdout
- Handles errors (file not found, permission denied) gracefully

```rust
use std::env;
use std::fs::File;
use std::io::{self, BufRead, BufReader, Write};

fn cat_file(path: &str) -> io::Result<()> {
    let file = File::open(path).map_err(|err| {
        io::Error::new(err.kind(), format!("cat: {}: {}", path, err))
    })?;
    let reader = BufReader::new(file);
    let mut stdout = io::stdout().lock();

    for line in reader.lines() {
        let line = line?;
        writeln!(stdout, "{}", line)?;
    }
    Ok(())
}

fn cat_stdin() -> io::Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    let reader = stdin.lock();

    for line in reader.lines() {
        let line = line?;
        writeln!(stdout, "{}", line)?;
    }
    Ok(())
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() <= 1 {
        if let Err(err) = cat_stdin() {
            eprintln!("cat: {}", err);
            std::process::exit(1);
        }
    } else {
        for path in &args[1..] {
            if let Err(err) = cat_file(path) {
                eprintln!("{}", err);
            }
        }
    }
}
```

Test it:
```bash
# Create test files
echo "Hello from file 1" > /tmp/test1.txt
echo "Hello from file 2" > /tmp/test2.txt

# Cat files
cargo run -- /tmp/test1.txt /tmp/test2.txt

# Cat stdin
echo "piped input" | cargo run

# Error handling
cargo run -- /nonexistent/file
```

### Exercise 2: Count File Descriptors

Write a Rust program that opens many files and prints the fd number each
time. Find out your system's limit.

```rust
use std::fs::File;
use std::os::unix::io::AsRawFd;

fn main() {
    let mut files = Vec::new();
    for i in 0..10 {
        let file = File::open("/dev/null").unwrap();
        println!("Opened fd {}", file.as_raw_fd());
        files.push(file);
    }
    println!("Opened {} files, fds go from 3 to {}",
        files.len(), files.last().unwrap().as_raw_fd());
}
```

### Exercise 3: Buffered vs Unbuffered Performance

Write a program that writes 1 million single-byte writes to a file,
first without buffering, then with `BufWriter`. Measure the time
difference using `std::time::Instant`.

### Exercise 4: Shell Redirection in the Terminal

Run these commands and explain what happens at the fd level:

```bash
# Redirect stdout to a file
ls /etc > /tmp/listing.txt

# Redirect stderr to a file
ls /nonexistent 2> /tmp/errors.txt

# Redirect both stdout and stderr
ls /etc /nonexistent > /tmp/out.txt 2> /tmp/err.txt

# Redirect stderr to stdout (merge them)
ls /etc /nonexistent > /tmp/both.txt 2>&1

# Why does this NOT work as expected?
ls /etc /nonexistent 2>&1 > /tmp/wrong.txt
```

---

Next: [Lesson 11: System Calls](./11-syscalls.md)
