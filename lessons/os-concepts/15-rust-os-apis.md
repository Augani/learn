# Lesson 15: Working with the OS from Rust — std::process, std::fs, std::io

This lesson is a practical tour of Rust's standard library interfaces
for interacting with the operating system. Everything from the previous
lessons (processes, files, I/O, signals, sockets) comes together here
through Rust's well-designed APIs.

---

## std::process — Running and Managing Processes

### Running External Commands

```rust
use std::process::Command;

fn run_commands() -> std::io::Result<()> {
    let output = Command::new("ls")
        .args(["-la", "/tmp"])
        .output()?;

    println!("Status: {}", output.status);
    println!("Stdout: {}", String::from_utf8_lossy(&output.stdout));
    println!("Stderr: {}", String::from_utf8_lossy(&output.stderr));

    let status = Command::new("echo")
        .arg("Hello from child")
        .status()?;

    println!("Exit code: {:?}", status.code());

    Ok(())
}
```

### Spawning Long-Running Processes

```rust
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};

fn spawn_and_stream() -> std::io::Result<()> {
    let mut child = Command::new("tail")
        .args(["-f", "/var/log/system.log"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;

    let stdout = child.stdout.take().expect("stdout not captured");
    let reader = BufReader::new(stdout);

    for (count, line) in reader.lines().enumerate() {
        let line = line?;
        println!("[{}] {}", count, line);
        if count >= 10 {
            break;
        }
    }

    child.kill()?;
    child.wait()?;
    Ok(())
}
```

### Piping Data Through a Child Process

```rust
use std::process::{Command, Stdio};
use std::io::Write;

fn pipe_through_child() -> std::io::Result<()> {
    let mut child = Command::new("sort")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()?;

    let stdin = child.stdin.as_mut().unwrap();
    writeln!(stdin, "banana")?;
    writeln!(stdin, "apple")?;
    writeln!(stdin, "cherry")?;
    drop(child.stdin.take());

    let output = child.wait_with_output()?;
    println!("Sorted:\n{}", String::from_utf8_lossy(&output.stdout));
    Ok(())
}
```

### Environment Variables and Working Directory

```rust
use std::process::Command;

fn command_environment() -> std::io::Result<()> {
    let output = Command::new("env")
        .env("MY_VAR", "hello")
        .env("ANOTHER", "world")
        .env_clear()
        .env("PATH", "/usr/bin:/bin")
        .env("MY_VAR", "hello")
        .current_dir("/tmp")
        .output()?;

    println!("{}", String::from_utf8_lossy(&output.stdout));
    Ok(())
}
```

### Checking Exit Status

```rust
use std::process::Command;

fn check_status() -> std::io::Result<()> {
    let status = Command::new("test")
        .args(["-f", "/etc/hosts"])
        .status()?;

    if status.success() {
        println!("/etc/hosts exists");
    } else {
        println!("/etc/hosts does not exist");
        println!("Exit code: {:?}", status.code());
    }

    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        if let Some(signal) = status.signal() {
            println!("Killed by signal: {}", signal);
        }
    }

    Ok(())
}
```

---

## std::fs — File System Operations

### Reading and Writing Files

```rust
use std::fs;
use std::io;

fn file_operations() -> io::Result<()> {
    fs::write("example.txt", "Hello, world!\nSecond line\n")?;

    let contents = fs::read_to_string("example.txt")?;
    println!("Text: {}", contents);

    let bytes = fs::read("example.txt")?;
    println!("Bytes: {} total", bytes.len());

    fs::copy("example.txt", "example_copy.txt")?;

    fs::rename("example_copy.txt", "example_renamed.txt")?;

    fs::remove_file("example.txt")?;
    fs::remove_file("example_renamed.txt")?;

    Ok(())
}
```

### Directory Operations

```rust
use std::fs;
use std::io;
use std::path::Path;

fn directory_operations() -> io::Result<()> {
    fs::create_dir("test_dir")?;

    fs::create_dir_all("deep/nested/path")?;

    for entry in fs::read_dir(".")? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let marker = if file_type.is_dir() {
            "DIR "
        } else if file_type.is_symlink() {
            "LINK"
        } else {
            "FILE"
        };
        println!("[{}] {}", marker, entry.path().display());
    }

    fs::remove_dir("test_dir")?;

    fs::remove_dir_all("deep")?;

    Ok(())
}
```

### File Metadata and Permissions

```rust
use std::fs;
use std::io;
use std::os::unix::fs::{MetadataExt, PermissionsExt};
use std::time::SystemTime;

fn metadata_demo(path: &str) -> io::Result<()> {
    let meta = fs::metadata(path)?;

    println!("Path: {}", path);
    println!("Size: {} bytes", meta.len());
    println!("Type: {}", if meta.is_file() {
        "file"
    } else if meta.is_dir() {
        "directory"
    } else {
        "other"
    });

    println!("Permissions: {:o}", meta.mode() & 0o777);
    println!("Inode: {}", meta.ino());
    println!("Hard links: {}", meta.nlink());
    println!("UID: {}", meta.uid());
    println!("GID: {}", meta.gid());
    println!("Device: {}", meta.dev());

    if let Ok(modified) = meta.modified() {
        if let Ok(duration) = SystemTime::now().duration_since(modified) {
            println!("Modified: {} seconds ago", duration.as_secs());
        }
    }

    Ok(())
}

fn set_permissions_demo(path: &str) -> io::Result<()> {
    let perms = fs::Permissions::from_mode(0o644);
    fs::set_permissions(path, perms)?;
    Ok(())
}
```

### Recursive Directory Walking

```rust
use std::fs;
use std::io;
use std::path::Path;

fn walk_dir_recursive(dir: &Path) -> io::Result<Vec<(String, u64)>> {
    let mut files = Vec::new();
    walk_dir_inner(dir, &mut files)?;
    Ok(files)
}

fn walk_dir_inner(dir: &Path, files: &mut Vec<(String, u64)>) -> io::Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            walk_dir_inner(&path, files)?;
        } else {
            let size = entry.metadata()?.len();
            files.push((path.display().to_string(), size));
        }
    }

    Ok(())
}
```

---

## std::io — Read, Write, and BufRead Traits

### The Core Traits

```rust
use std::io::{self, Read, Write, BufRead, BufReader, BufWriter};
use std::fs::File;

fn generic_copy<R: Read, W: Write>(reader: &mut R, writer: &mut W) -> io::Result<u64> {
    let mut buffer = [0u8; 8192];
    let mut total = 0u64;

    loop {
        let bytes_read = reader.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        writer.write_all(&buffer[..bytes_read])?;
        total += bytes_read as u64;
    }

    writer.flush()?;
    Ok(total)
}

fn copy_file_buffered(src: &str, dst: &str) -> io::Result<u64> {
    let mut reader = BufReader::new(File::open(src)?);
    let mut writer = BufWriter::new(File::create(dst)?);
    generic_copy(&mut reader, &mut writer)
}
```

### Line-by-Line Processing

```rust
use std::io::{self, BufRead};

fn process_lines<R: BufRead>(reader: R) -> io::Result<(usize, usize, usize)> {
    let mut lines = 0;
    let mut words = 0;
    let mut bytes = 0;

    for line in reader.lines() {
        let line = line?;
        lines += 1;
        words += line.split_whitespace().count();
        bytes += line.len() + 1;
    }

    Ok((lines, words, bytes))
}
```

### Stdin, Stdout, Stderr

```rust
use std::io::{self, BufRead, Write};

fn interactive_prompt() -> io::Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    loop {
        write!(stdout, "> ")?;
        stdout.flush()?;

        let mut input = String::new();
        let bytes = stdin.lock().read_line(&mut input)?;

        if bytes == 0 {
            println!("\nEOF — goodbye!");
            break;
        }

        let trimmed = input.trim();
        if trimmed == "exit" {
            break;
        }

        writeln!(stdout, "You entered: '{}'", trimmed)?;
    }

    Ok(())
}
```

### Cursor — Read/Write from In-Memory Buffers

```rust
use std::io::{Cursor, Read, Write};

fn cursor_demo() -> std::io::Result<()> {
    let mut buffer = Cursor::new(Vec::new());

    writeln!(buffer, "Hello, world!")?;
    writeln!(buffer, "Second line")?;

    buffer.set_position(0);

    let mut contents = String::new();
    buffer.read_to_string(&mut contents)?;
    println!("Buffer contents: {}", contents);

    Ok(())
}
```

---

## std::env — Environment and Arguments

```rust
use std::env;
use std::path::PathBuf;

fn environment_demo() {
    let args: Vec<String> = env::args().collect();
    println!("Program: {}", args[0]);
    println!("Arguments: {:?}", &args[1..]);

    if let Ok(home) = env::var("HOME") {
        println!("HOME = {}", home);
    }

    match env::var("MISSING_VAR") {
        Ok(val) => println!("MISSING_VAR = {}", val),
        Err(env::VarError::NotPresent) => println!("MISSING_VAR not set"),
        Err(env::VarError::NotUnicode(_)) => println!("MISSING_VAR not valid unicode"),
    }

    println!("\nAll environment variables:");
    for (key, value) in env::vars().take(5) {
        println!("  {} = {}", key, value);
    }

    let cwd: PathBuf = env::current_dir().unwrap();
    println!("\nCurrent directory: {}", cwd.display());

    let exe: PathBuf = env::current_exe().unwrap();
    println!("Current executable: {}", exe.display());
}
```

---

## std::path — Cross-Platform Path Handling

```rust
use std::path::{Path, PathBuf};

fn path_demo() {
    let path = Path::new("/home/alice/documents/report.pdf");

    println!("Full path:  {}", path.display());
    println!("File name:  {:?}", path.file_name());
    println!("Extension:  {:?}", path.extension());
    println!("Stem:       {:?}", path.file_stem());
    println!("Parent:     {:?}", path.parent());
    println!("Is absolute: {}", path.is_absolute());
    println!("Exists:     {}", path.exists());

    println!("\nComponents:");
    for component in path.components() {
        println!("  {:?}", component);
    }

    let mut built = PathBuf::from("/home");
    built.push("alice");
    built.push("documents");
    built.push("report.pdf");
    println!("\nBuilt path: {}", built.display());

    built.set_extension("txt");
    println!("Changed ext: {}", built.display());

    built.set_file_name("notes.md");
    println!("Changed name: {}", built.display());

    let joined = Path::new("/home/alice").join("projects").join("src/main.rs");
    println!("Joined: {}", joined.display());
}
```

### Path Patterns for OS Operations

```rust
use std::path::{Path, PathBuf};
use std::fs;
use std::io;

fn find_files_by_extension(dir: &Path, ext: &str) -> io::Result<Vec<PathBuf>> {
    let mut results = Vec::new();
    find_files_recursive(dir, ext, &mut results)?;
    Ok(results)
}

fn find_files_recursive(dir: &Path, ext: &str, results: &mut Vec<PathBuf>) -> io::Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            find_files_recursive(&path, ext, results)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some(ext) {
            results.push(path);
        }
    }

    Ok(())
}
```

---

## std::time — Timing and Durations

```rust
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

fn time_demo() {
    let start = Instant::now();
    std::thread::sleep(Duration::from_millis(100));
    let elapsed = start.elapsed();
    println!("Elapsed: {:?}", elapsed);
    println!("As millis: {}ms", elapsed.as_millis());
    println!("As micros: {}us", elapsed.as_micros());

    let now = SystemTime::now();
    let unix_timestamp = now.duration_since(UNIX_EPOCH).unwrap();
    println!("\nUnix timestamp: {} seconds", unix_timestamp.as_secs());

    let timeout = Duration::from_secs(30);
    let deadline = Instant::now() + timeout;
    println!("Deadline is {} seconds from now",
        deadline.duration_since(Instant::now()).as_secs());
}

fn benchmark<F: FnMut()>(name: &str, iterations: u32, mut func: F) {
    let start = Instant::now();
    for _ in 0..iterations {
        func();
    }
    let elapsed = start.elapsed();
    println!("{}: {:?} total, {:?} per iteration",
        name,
        elapsed,
        elapsed / iterations
    );
}
```

---

## std::net — TCP and UDP

### TCP Server

```rust
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;

fn tcp_server() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080")?;
    println!("Listening on 127.0.0.1:8080");

    for stream in listener.incoming() {
        let stream = stream?;
        let peer = stream.peer_addr()?;
        println!("Connection from {}", peer);

        let reader = BufReader::new(&stream);
        let mut writer = &stream;

        for line in reader.lines() {
            let line = line?;
            if line.is_empty() {
                break;
            }
            writeln!(writer, "Echo: {}", line)?;
        }
    }

    Ok(())
}
```

### TCP Client

```rust
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;

fn tcp_client() -> std::io::Result<()> {
    let mut stream = TcpStream::connect("127.0.0.1:8080")?;
    println!("Connected to server");

    writeln!(stream, "Hello, server!")?;

    let mut reader = BufReader::new(&stream);
    let mut response = String::new();
    reader.read_line(&mut response)?;
    println!("Server says: {}", response.trim());

    Ok(())
}
```

---

## Error Handling Patterns for OS Operations

### Pattern 1: Propagate with Context

```rust
use std::fs;
use std::io;
use std::path::Path;

fn read_config(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|err| {
        format!("Failed to read config '{}': {}", path.display(), err)
    })
}
```

### Pattern 2: Match on Error Kind

```rust
use std::fs;
use std::io;
use std::path::Path;

fn ensure_directory(path: &Path) -> io::Result<()> {
    match fs::create_dir(path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == io::ErrorKind::AlreadyExists => Ok(()),
        Err(err) => Err(err),
    }
}
```

### Pattern 3: Custom Error Types

```rust
use std::fmt;
use std::io;

#[derive(Debug)]
enum AppError {
    Io(io::Error),
    Config(String),
    NotFound(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Io(err) => write!(f, "I/O error: {}", err),
            AppError::Config(msg) => write!(f, "Config error: {}", msg),
            AppError::NotFound(path) => write!(f, "Not found: {}", path),
        }
    }
}

impl std::error::Error for AppError {}

impl From<io::Error> for AppError {
    fn from(err: io::Error) -> Self {
        AppError::Io(err)
    }
}
```

### Pattern 4: Retry on Transient Errors

```rust
use std::io;
use std::thread;
use std::time::Duration;

fn retry_operation<F, T>(max_retries: u32, delay: Duration, mut operation: F) -> io::Result<T>
where
    F: FnMut() -> io::Result<T>,
{
    let mut last_error = None;

    for attempt in 0..=max_retries {
        match operation() {
            Ok(result) => return Ok(result),
            Err(err) => {
                let is_transient = matches!(
                    err.kind(),
                    io::ErrorKind::Interrupted
                    | io::ErrorKind::WouldBlock
                    | io::ErrorKind::TimedOut
                );

                if !is_transient || attempt == max_retries {
                    return Err(err);
                }

                eprintln!("Attempt {} failed: {}. Retrying in {:?}...",
                    attempt + 1, err, delay);
                thread::sleep(delay);
                last_error = Some(err);
            }
        }
    }

    Err(last_error.unwrap())
}
```

---

## Cross-Platform Considerations

```rust
fn platform_specific() {
    #[cfg(target_os = "linux")]
    {
        println!("Running on Linux");
    }

    #[cfg(target_os = "macos")]
    {
        println!("Running on macOS");
    }

    #[cfg(target_os = "windows")]
    {
        println!("Running on Windows");
    }

    #[cfg(unix)]
    {
        println!("Running on a Unix-like system");
        use std::os::unix::fs::PermissionsExt;
    }

    #[cfg(target_family = "unix")]
    {
        use std::os::unix::process::ExitStatusExt;
    }

    #[cfg(target_pointer_width = "64")]
    {
        println!("64-bit system");
    }
}
```

### Path Separator Differences

```rust
use std::path::{Path, MAIN_SEPARATOR};

fn portable_paths() {
    println!("Path separator: '{}'", MAIN_SEPARATOR);

    let path = Path::new("src").join("main.rs");
    println!("Joined: {}", path.display());

    let config_dir = dirs_config();
    println!("Config dir: {:?}", config_dir);
}

fn dirs_config() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME").ok().map(|h| {
            std::path::PathBuf::from(h).join("Library").join("Application Support")
        })
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_CONFIG_HOME")
            .ok()
            .map(std::path::PathBuf::from)
            .or_else(|| {
                std::env::var("HOME").ok().map(|h| {
                    std::path::PathBuf::from(h).join(".config")
                })
            })
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA").ok().map(std::path::PathBuf::from)
    }
}
```

---

## Exercises

### Exercise 1: Build a File Backup Tool

Build a command-line tool that copies a directory tree, preserving
permissions and timestamps:

```
Usage: backup <source_dir> <dest_dir>

Requirements:
- Recursively copy all files and subdirectories
- Preserve file permissions (mode)
- Preserve modification timestamps
- Skip files that haven't changed (compare mtime + size)
- Print a summary: files copied, files skipped, total bytes
- Handle errors gracefully (log and continue, don't abort)
```

Starter structure:

```rust
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::os::unix::fs::{MetadataExt, PermissionsExt};
use std::time::SystemTime;

struct BackupStats {
    files_copied: u64,
    files_skipped: u64,
    dirs_created: u64,
    bytes_copied: u64,
    errors: u64,
}

fn backup_directory(src: &Path, dst: &Path, stats: &mut BackupStats) -> io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
        stats.dirs_created += 1;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            backup_directory(&src_path, &dst_path, stats)?;
        } else {
            match backup_file(&src_path, &dst_path) {
                Ok(copied) => {
                    if copied {
                        stats.files_copied += 1;
                        stats.bytes_copied += entry.metadata()?.len();
                    } else {
                        stats.files_skipped += 1;
                    }
                }
                Err(err) => {
                    eprintln!("Error copying {}: {}", src_path.display(), err);
                    stats.errors += 1;
                }
            }
        }
    }

    Ok(())
}

fn backup_file(src: &Path, dst: &Path) -> io::Result<bool> {
    let src_meta = fs::metadata(src)?;

    if dst.exists() {
        let dst_meta = fs::metadata(dst)?;
        let src_modified = src_meta.modified()?;
        let dst_modified = dst_meta.modified()?;

        if src_meta.len() == dst_meta.len() && src_modified <= dst_modified {
            return Ok(false);
        }
    }

    fs::copy(src, dst)?;

    let permissions = fs::Permissions::from_mode(src_meta.mode() & 0o777);
    fs::set_permissions(dst, permissions)?;

    Ok(true)
}
```

### Exercise 2: System Information Tool

Write a program that prints system information:
- Current user (UID, username via env)
- Current working directory
- Home directory
- OS type and version
- Number of CPU cores (read from /proc/cpuinfo or sysctl)
- Total memory (read from /proc/meminfo or sysctl)
- Current process PID

### Exercise 3: File Watcher

Write a program that watches a directory for changes by polling:
- Check for new files, deleted files, and modified files every 2 seconds
- Print events: `[NEW] file.txt`, `[DELETED] old.txt`, `[MODIFIED] data.csv`
- Track files using a `HashMap<PathBuf, (u64, SystemTime)>` (size + mtime)

### Exercise 4: Process Launcher

Write a tool that reads a config file and launches multiple processes:

```
# processes.conf
web: python -m http.server 8080
api: cargo run --bin api_server
worker: ./target/release/worker --threads 4
```

Requirements:
- Parse the config file
- Spawn all processes
- Print their PIDs
- Wait for Ctrl+C (SIGINT)
- On SIGINT, send SIGTERM to all children and wait for them

---

Next: [Lesson 16: Building a Mini Shell in Rust](./16-mini-shell-project.md)
