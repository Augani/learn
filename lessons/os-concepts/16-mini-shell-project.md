# Lesson 16: Building a Mini Shell in Rust

Time to put everything together. We'll build a working Unix shell that
demonstrates processes, file descriptors, pipes, signals, and system
calls — all the concepts from this course.

Our shell will:
- Read commands from stdin (REPL loop)
- Parse command + arguments
- Execute external commands (fork + exec via Command)
- Handle pipes (`cmd1 | cmd2`)
- Handle redirection (`>`, `<`, `>>`)
- Support built-in commands: `cd`, `pwd`, `exit`, `echo`
- Handle Ctrl+C gracefully

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────┐
│                     Main REPL Loop                     │
│                                                        │
│  1. Print prompt                                       │
│  2. Read line from stdin                               │
│  3. Parse into commands                                │
│  4. Execute                                            │
│     ├── Built-in? → handle directly                    │
│     ├── Pipeline?  → connect with pipes                │
│     └── Single?    → spawn child process               │
│  5. Wait for completion                                │
│  6. Go to 1                                            │
└───────────────────────────────────────────────────────┘
```

```
Data flow through the shell:

User types: ls -la /tmp | grep log > output.txt

                    │
                    ▼
┌──────────────────────────────────────────┐
│ Raw input: "ls -la /tmp | grep log > output.txt" │
└──────────────────────────────────────────┘
                    │ parse
                    ▼
┌──────────────────────────────────────────┐
│ Pipeline:                                │
│   Command 1: ["ls", "-la", "/tmp"]       │
│     stdin:  inherit                      │
│     stdout: pipe                         │
│   Command 2: ["grep", "log"]             │
│     stdin:  pipe                         │
│     stdout: redirect to "output.txt"     │
└──────────────────────────────────────────┘
                    │ execute
                    ▼
┌──────────────────────────────────────────┐
│ Spawn processes, wire up fds, wait       │
└──────────────────────────────────────────┘
```

---

## Step 1: The REPL Loop

Start with the simplest possible shell — just read and echo:

```rust
use std::io::{self, BufRead, Write};

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    loop {
        write!(stdout, "rush> ").unwrap();
        stdout.flush().unwrap();

        let mut line = String::new();
        let bytes = stdin.lock().read_line(&mut line).unwrap();

        if bytes == 0 {
            println!();
            break;
        }

        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        println!("You typed: {}", line);
    }
}
```

---

## Step 2: Data Structures

Define the types that represent parsed commands:

```rust
#[derive(Debug)]
enum Redirect {
    None,
    Overwrite(String),
    Append(String),
    Input(String),
}

#[derive(Debug)]
struct ParsedCommand {
    program: String,
    args: Vec<String>,
    stdout_redirect: Redirect,
    stdin_redirect: Redirect,
}

#[derive(Debug)]
struct Pipeline {
    commands: Vec<ParsedCommand>,
}
```

---

## Step 3: Parsing

Parse a raw input line into a pipeline of commands:

```rust
fn parse_line(input: &str) -> Option<Pipeline> {
    let input = input.trim();
    if input.is_empty() {
        return None;
    }

    let pipe_segments: Vec<&str> = input.split('|').collect();
    let mut commands = Vec::new();

    for (index, segment) in pipe_segments.iter().enumerate() {
        let segment = segment.trim();
        if segment.is_empty() {
            eprintln!("rush: syntax error near unexpected token '|'");
            return None;
        }

        match parse_command(segment, index == 0, index == pipe_segments.len() - 1) {
            Some(cmd) => commands.push(cmd),
            None => return None,
        }
    }

    Some(Pipeline { commands })
}

fn parse_command(input: &str, is_first: bool, is_last: bool) -> Option<ParsedCommand> {
    let mut tokens: Vec<String> = Vec::new();
    let mut stdout_redirect = Redirect::None;
    let mut stdin_redirect = Redirect::None;

    let mut chars = input.chars().peekable();
    while let Some(&ch) = chars.peek() {
        match ch {
            ' ' | '\t' => {
                chars.next();
            }
            '>' => {
                chars.next();
                let append = chars.peek() == Some(&'>');
                if append {
                    chars.next();
                }
                let filename = collect_word(&mut chars);
                if filename.is_empty() {
                    eprintln!("rush: syntax error near unexpected token 'newline'");
                    return None;
                }
                if !is_last {
                    eprintln!("rush: output redirect in middle of pipeline");
                    return None;
                }
                stdout_redirect = if append {
                    Redirect::Append(filename)
                } else {
                    Redirect::Overwrite(filename)
                };
            }
            '<' => {
                chars.next();
                let filename = collect_word(&mut chars);
                if filename.is_empty() {
                    eprintln!("rush: syntax error near unexpected token 'newline'");
                    return None;
                }
                if !is_first {
                    eprintln!("rush: input redirect in middle of pipeline");
                    return None;
                }
                stdin_redirect = Redirect::Input(filename);
            }
            '\'' => {
                chars.next();
                let quoted = collect_until(&mut chars, '\'');
                tokens.push(quoted);
            }
            '"' => {
                chars.next();
                let quoted = collect_until(&mut chars, '"');
                tokens.push(quoted);
            }
            _ => {
                let word = collect_word(&mut chars);
                if !word.is_empty() {
                    tokens.push(word);
                }
            }
        }
    }

    if tokens.is_empty() {
        eprintln!("rush: empty command");
        return None;
    }

    let program = tokens.remove(0);
    Some(ParsedCommand {
        program,
        args: tokens,
        stdout_redirect,
        stdin_redirect,
    })
}

fn collect_word(chars: &mut std::iter::Peekable<std::str::Chars>) -> String {
    let mut word = String::new();
    while let Some(&ch) = chars.peek() {
        if ch == ' ' || ch == '\t' || ch == '|' || ch == '>' || ch == '<' {
            break;
        }
        word.push(ch);
        chars.next();
    }
    word
}

fn collect_until(chars: &mut std::iter::Peekable<std::str::Chars>, delimiter: char) -> String {
    let mut result = String::new();
    while let Some(&ch) = chars.peek() {
        chars.next();
        if ch == delimiter {
            break;
        }
        result.push(ch);
    }
    result
}
```

---

## Step 4: Built-in Commands

Some commands can't be external programs. `cd` changes the shell's own
working directory — a child process can't do that for its parent.

```rust
use std::env;
use std::path::Path;

enum BuiltinResult {
    Handled,
    Exit,
    NotBuiltin,
}

fn handle_builtin(cmd: &ParsedCommand) -> BuiltinResult {
    match cmd.program.as_str() {
        "exit" => BuiltinResult::Exit,
        "cd" => {
            builtin_cd(&cmd.args);
            BuiltinResult::Handled
        }
        "pwd" => {
            builtin_pwd();
            BuiltinResult::Handled
        }
        "echo" => {
            builtin_echo(&cmd.args);
            BuiltinResult::Handled
        }
        _ => BuiltinResult::NotBuiltin,
    }
}

fn builtin_cd(args: &[String]) {
    let target = if args.is_empty() {
        match env::var("HOME") {
            Ok(home) => home,
            Err(_) => {
                eprintln!("rush: cd: HOME not set");
                return;
            }
        }
    } else {
        args[0].clone()
    };

    let path = Path::new(&target);
    if let Err(err) = env::set_current_dir(path) {
        eprintln!("rush: cd: {}: {}", target, err);
    }
}

fn builtin_pwd() {
    match env::current_dir() {
        Ok(path) => println!("{}", path.display()),
        Err(err) => eprintln!("rush: pwd: {}", err),
    }
}

fn builtin_echo(args: &[String]) {
    println!("{}", args.join(" "));
}
```

---

## Step 5: Executing External Commands

### Single Command (No Pipes)

```rust
use std::fs::{File, OpenOptions};
use std::process::{Command, Stdio};

fn execute_single(cmd: &ParsedCommand) -> io::Result<()> {
    let stdin_cfg = match &cmd.stdin_redirect {
        Redirect::Input(path) => {
            let file = File::open(path).map_err(|err| {
                io::Error::new(err.kind(), format!("rush: {}: {}", path, err))
            })?;
            Stdio::from(file)
        }
        _ => Stdio::inherit(),
    };

    let stdout_cfg = match &cmd.stdout_redirect {
        Redirect::Overwrite(path) => {
            let file = File::create(path).map_err(|err| {
                io::Error::new(err.kind(), format!("rush: {}: {}", path, err))
            })?;
            Stdio::from(file)
        }
        Redirect::Append(path) => {
            let file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
                .map_err(|err| {
                    io::Error::new(err.kind(), format!("rush: {}: {}", path, err))
                })?;
            Stdio::from(file)
        }
        _ => Stdio::inherit(),
    };

    let mut child = Command::new(&cmd.program)
        .args(&cmd.args)
        .stdin(stdin_cfg)
        .stdout(stdout_cfg)
        .spawn()
        .map_err(|err| {
            io::Error::new(err.kind(), format!("rush: {}: {}", cmd.program, err))
        })?;

    let status = child.wait()?;

    if !status.success() {
        if let Some(code) = status.code() {
            if code != 0 {
                // Non-zero exit, but not a signal — normal failure
            }
        }
    }

    Ok(())
}
```

### Pipeline Execution

```rust
fn execute_pipeline(pipeline: &Pipeline) -> io::Result<()> {
    if pipeline.commands.len() == 1 {
        return execute_single(&pipeline.commands[0]);
    }

    let mut children = Vec::new();
    let mut prev_stdout: Option<std::process::ChildStdout> = None;

    for (index, cmd) in pipeline.commands.iter().enumerate() {
        let is_first = index == 0;
        let is_last = index == pipeline.commands.len() - 1;

        let stdin_cfg = if is_first {
            match &cmd.stdin_redirect {
                Redirect::Input(path) => {
                    let file = File::open(path).map_err(|err| {
                        io::Error::new(err.kind(), format!("rush: {}: {}", path, err))
                    })?;
                    Stdio::from(file)
                }
                _ => Stdio::inherit(),
            }
        } else {
            match prev_stdout.take() {
                Some(stdout) => Stdio::from(stdout),
                None => Stdio::inherit(),
            }
        };

        let stdout_cfg = if is_last {
            match &cmd.stdout_redirect {
                Redirect::Overwrite(path) => {
                    let file = File::create(path).map_err(|err| {
                        io::Error::new(err.kind(), format!("rush: {}: {}", path, err))
                    })?;
                    Stdio::from(file)
                }
                Redirect::Append(path) => {
                    let file = OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(path)
                        .map_err(|err| {
                            io::Error::new(err.kind(), format!("rush: {}: {}", path, err))
                        })?;
                    Stdio::from(file)
                }
                _ => Stdio::inherit(),
            }
        } else {
            Stdio::piped()
        };

        let mut child = Command::new(&cmd.program)
            .args(&cmd.args)
            .stdin(stdin_cfg)
            .stdout(stdout_cfg)
            .spawn()
            .map_err(|err| {
                io::Error::new(err.kind(), format!("rush: {}: {}", cmd.program, err))
            })?;

        if !is_last {
            prev_stdout = child.stdout.take();
        }

        children.push(child);
    }

    for mut child in children {
        child.wait()?;
    }

    Ok(())
}
```

---

## Step 6: Signal Handling

Handle Ctrl+C so it doesn't kill the shell itself:

```rust
use signal_hook::consts::SIGINT;
use signal_hook::flag;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

fn setup_signal_handlers() -> Arc<AtomicBool> {
    let interrupted = Arc::new(AtomicBool::new(false));
    flag::register(SIGINT, Arc::clone(&interrupted))
        .expect("Failed to register SIGINT handler");
    interrupted
}
```

When Ctrl+C is pressed during a child process, the child gets SIGINT
and terminates. The shell catches it and continues the REPL loop.

---

## Step 7: Complete Shell

Here's the full working shell with all pieces connected:

```rust
use std::env;
use std::fs::{File, OpenOptions};
use std::io::{self, BufRead, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use signal_hook::consts::SIGINT;
use signal_hook::flag;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

// ── Data Structures ──────────────────────────────────────

#[derive(Debug)]
enum Redirect {
    None,
    Overwrite(String),
    Append(String),
    Input(String),
}

#[derive(Debug)]
struct ParsedCommand {
    program: String,
    args: Vec<String>,
    stdout_redirect: Redirect,
    stdin_redirect: Redirect,
}

#[derive(Debug)]
struct Pipeline {
    commands: Vec<ParsedCommand>,
}

enum BuiltinResult {
    Handled,
    Exit,
    NotBuiltin,
}

// ── Parsing ──────────────────────────────────────────────

fn parse_line(input: &str) -> Option<Pipeline> {
    let input = input.trim();
    if input.is_empty() {
        return None;
    }

    let pipe_segments: Vec<&str> = input.split('|').collect();
    let mut commands = Vec::new();

    for (index, segment) in pipe_segments.iter().enumerate() {
        let segment = segment.trim();
        if segment.is_empty() {
            eprintln!("rush: syntax error near unexpected token '|'");
            return None;
        }
        match parse_command(segment, index == 0, index == pipe_segments.len() - 1) {
            Some(cmd) => commands.push(cmd),
            None => return None,
        }
    }

    Some(Pipeline { commands })
}

fn parse_command(input: &str, is_first: bool, is_last: bool) -> Option<ParsedCommand> {
    let mut tokens: Vec<String> = Vec::new();
    let mut stdout_redirect = Redirect::None;
    let mut stdin_redirect = Redirect::None;

    let mut chars = input.chars().peekable();
    while let Some(&ch) = chars.peek() {
        match ch {
            ' ' | '\t' => { chars.next(); }
            '>' => {
                chars.next();
                let append = chars.peek() == Some(&'>');
                if append { chars.next(); }
                skip_whitespace(&mut chars);
                let filename = collect_word(&mut chars);
                if filename.is_empty() {
                    eprintln!("rush: syntax error near unexpected token 'newline'");
                    return None;
                }
                if !is_last {
                    eprintln!("rush: output redirect only allowed on last command");
                    return None;
                }
                stdout_redirect = if append {
                    Redirect::Append(filename)
                } else {
                    Redirect::Overwrite(filename)
                };
            }
            '<' => {
                chars.next();
                skip_whitespace(&mut chars);
                let filename = collect_word(&mut chars);
                if filename.is_empty() {
                    eprintln!("rush: syntax error near unexpected token 'newline'");
                    return None;
                }
                if !is_first {
                    eprintln!("rush: input redirect only allowed on first command");
                    return None;
                }
                stdin_redirect = Redirect::Input(filename);
            }
            '\'' => {
                chars.next();
                let quoted = collect_until(&mut chars, '\'');
                tokens.push(quoted);
            }
            '"' => {
                chars.next();
                let quoted = collect_until(&mut chars, '"');
                tokens.push(quoted);
            }
            _ => {
                let word = collect_word(&mut chars);
                if !word.is_empty() {
                    tokens.push(word);
                }
            }
        }
    }

    if tokens.is_empty() {
        return None;
    }

    let program = tokens.remove(0);
    Some(ParsedCommand {
        program,
        args: tokens,
        stdout_redirect,
        stdin_redirect,
    })
}

fn skip_whitespace(chars: &mut std::iter::Peekable<std::str::Chars>) {
    while let Some(&ch) = chars.peek() {
        if ch != ' ' && ch != '\t' {
            break;
        }
        chars.next();
    }
}

fn collect_word(chars: &mut std::iter::Peekable<std::str::Chars>) -> String {
    let mut word = String::new();
    while let Some(&ch) = chars.peek() {
        if ch == ' ' || ch == '\t' || ch == '|' || ch == '>' || ch == '<' {
            break;
        }
        word.push(ch);
        chars.next();
    }
    word
}

fn collect_until(chars: &mut std::iter::Peekable<std::str::Chars>, delimiter: char) -> String {
    let mut result = String::new();
    while let Some(&ch) = chars.peek() {
        chars.next();
        if ch == delimiter {
            break;
        }
        result.push(ch);
    }
    result
}

// ── Built-in Commands ────────────────────────────────────

fn handle_builtin(cmd: &ParsedCommand) -> BuiltinResult {
    match cmd.program.as_str() {
        "exit" => BuiltinResult::Exit,
        "cd" => {
            builtin_cd(&cmd.args);
            BuiltinResult::Handled
        }
        "pwd" => {
            builtin_pwd();
            BuiltinResult::Handled
        }
        "echo" => {
            builtin_echo(&cmd.args);
            BuiltinResult::Handled
        }
        _ => BuiltinResult::NotBuiltin,
    }
}

fn builtin_cd(args: &[String]) {
    let target = if args.is_empty() {
        match env::var("HOME") {
            Ok(home) => home,
            Err(_) => {
                eprintln!("rush: cd: HOME not set");
                return;
            }
        }
    } else if args[0] == "-" {
        match env::var("OLDPWD") {
            Ok(old) => {
                println!("{}", old);
                old
            }
            Err(_) => {
                eprintln!("rush: cd: OLDPWD not set");
                return;
            }
        }
    } else {
        args[0].clone()
    };

    let current = env::current_dir().ok();

    let path = if target.starts_with('~') {
        if let Ok(home) = env::var("HOME") {
            Path::new(&home).join(&target[1..].trim_start_matches('/'))
        } else {
            Path::new(&target).to_path_buf()
        }
    } else {
        Path::new(&target).to_path_buf()
    };

    match env::set_current_dir(&path) {
        Ok(()) => {
            if let Some(prev) = current {
                env::set_var("OLDPWD", prev);
            }
        }
        Err(err) => eprintln!("rush: cd: {}: {}", target, err),
    }
}

fn builtin_pwd() {
    match env::current_dir() {
        Ok(path) => println!("{}", path.display()),
        Err(err) => eprintln!("rush: pwd: {}", err),
    }
}

fn builtin_echo(args: &[String]) {
    println!("{}", args.join(" "));
}

// ── Execution ────────────────────────────────────────────

fn execute_pipeline(pipeline: &Pipeline) -> io::Result<()> {
    if pipeline.commands.len() == 1 {
        let cmd = &pipeline.commands[0];

        match handle_builtin(cmd) {
            BuiltinResult::Exit => {
                std::process::exit(0);
            }
            BuiltinResult::Handled => return Ok(()),
            BuiltinResult::NotBuiltin => {}
        }

        return execute_single(cmd);
    }

    let mut children = Vec::new();
    let mut prev_stdout: Option<std::process::ChildStdout> = None;

    for (index, cmd) in pipeline.commands.iter().enumerate() {
        let is_first = index == 0;
        let is_last = index == pipeline.commands.len() - 1;

        let stdin_cfg = if is_first {
            match &cmd.stdin_redirect {
                Redirect::Input(path) => {
                    let file = File::open(path).map_err(|err| {
                        io::Error::new(err.kind(), format!("rush: {}: {}", path, err))
                    })?;
                    Stdio::from(file)
                }
                _ => Stdio::inherit(),
            }
        } else {
            match prev_stdout.take() {
                Some(out) => Stdio::from(out),
                None => Stdio::inherit(),
            }
        };

        let stdout_cfg = if is_last {
            make_stdout_redirect(&cmd.stdout_redirect)?
        } else {
            Stdio::piped()
        };

        let mut child = Command::new(&cmd.program)
            .args(&cmd.args)
            .stdin(stdin_cfg)
            .stdout(stdout_cfg)
            .spawn()
            .map_err(|err| {
                io::Error::new(err.kind(), format!("rush: {}: {}", cmd.program, err))
            })?;

        if !is_last {
            prev_stdout = child.stdout.take();
        }

        children.push(child);
    }

    for mut child in children {
        child.wait()?;
    }

    Ok(())
}

fn execute_single(cmd: &ParsedCommand) -> io::Result<()> {
    let stdin_cfg = match &cmd.stdin_redirect {
        Redirect::Input(path) => {
            let file = File::open(path).map_err(|err| {
                io::Error::new(err.kind(), format!("rush: {}: {}", path, err))
            })?;
            Stdio::from(file)
        }
        _ => Stdio::inherit(),
    };

    let stdout_cfg = make_stdout_redirect(&cmd.stdout_redirect)?;

    let mut child = Command::new(&cmd.program)
        .args(&cmd.args)
        .stdin(stdin_cfg)
        .stdout(stdout_cfg)
        .spawn()
        .map_err(|err| {
            io::Error::new(err.kind(), format!("rush: {}: {}", cmd.program, err))
        })?;

    child.wait()?;
    Ok(())
}

fn make_stdout_redirect(redirect: &Redirect) -> io::Result<Stdio> {
    match redirect {
        Redirect::Overwrite(path) => {
            let file = File::create(path).map_err(|err| {
                io::Error::new(err.kind(), format!("rush: {}: {}", path, err))
            })?;
            Ok(Stdio::from(file))
        }
        Redirect::Append(path) => {
            let file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
                .map_err(|err| {
                    io::Error::new(err.kind(), format!("rush: {}: {}", path, err))
                })?;
            Ok(Stdio::from(file))
        }
        _ => Ok(Stdio::inherit()),
    }
}

// ── Prompt ───────────────────────────────────────────────

fn get_prompt() -> String {
    let cwd = env::current_dir()
        .map(|p| {
            if let Ok(home) = env::var("HOME") {
                let home_path = Path::new(&home);
                if let Ok(relative) = p.strip_prefix(home_path) {
                    return format!("~/{}", relative.display());
                }
            }
            p.display().to_string()
        })
        .unwrap_or_else(|_| "?".to_string());

    format!("rush {}> ", cwd)
}

// ── Main ─────────────────────────────────────────────────

fn main() {
    let interrupted = Arc::new(AtomicBool::new(false));
    flag::register(SIGINT, Arc::clone(&interrupted))
        .expect("Failed to register SIGINT handler");

    let stdin = io::stdin();
    let mut stdout = io::stdout();

    loop {
        interrupted.store(false, Ordering::SeqCst);

        let prompt = get_prompt();
        write!(stdout, "{}", prompt).unwrap();
        stdout.flush().unwrap();

        let mut line = String::new();
        let bytes = match stdin.lock().read_line(&mut line) {
            Ok(n) => n,
            Err(_) => {
                if interrupted.load(Ordering::SeqCst) {
                    println!();
                    continue;
                }
                break;
            }
        };

        if bytes == 0 {
            println!();
            break;
        }

        if interrupted.load(Ordering::SeqCst) {
            println!();
            continue;
        }

        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let pipeline = match parse_line(line) {
            Some(p) => p,
            None => continue,
        };

        if let Err(err) = execute_pipeline(&pipeline) {
            eprintln!("{}", err);
        }
    }
}
```

---

## Cargo.toml

```toml
[package]
name = "rush"
version = "0.1.0"
edition = "2021"

[dependencies]
signal-hook = "0.3"
```

---

## Testing the Shell

Build and run:

```bash
cargo build --release
./target/release/rush
```

Test these commands:

```bash
# Basic commands
rush ~/> ls -la
rush ~/> echo hello world
rush ~/> pwd

# Built-in cd
rush ~/> cd /tmp
rush /tmp> pwd
rush /tmp> cd -
rush ~/> cd ~/Projects

# Pipes
rush ~/> ls -la | head -5
rush ~/> cat /etc/hosts | grep localhost
rush ~/> ps aux | grep rust | head -3

# Redirection
rush ~/> echo "hello" > /tmp/test.txt
rush ~/> cat /tmp/test.txt
rush ~/> echo "world" >> /tmp/test.txt
rush ~/> cat /tmp/test.txt
rush ~/> wc -l < /tmp/test.txt

# Pipes + redirection
rush ~/> ls /etc | sort | head -10 > /tmp/sorted.txt
rush ~/> cat /tmp/sorted.txt

# Quoted arguments
rush ~/> echo "hello   world"
rush ~/> echo 'single quoted'

# Error handling
rush ~/> nonexistent_command
rush ~/> cat /nonexistent/file

# Ctrl+C (should not kill the shell)
rush ~/> sleep 100
^C
rush ~/>

# Exit
rush ~/> exit
```

---

## How It Maps to OS Concepts

```
Shell Feature           OS Concept (Lesson)
──────────────────────────────────────────────────────────
REPL loop               stdin/stdout file descriptors (10)
Parsing                 (pure logic, no OS)
Built-in commands       Process environment, cwd (02)
External commands       fork() + exec() via Command (02, 11)
Pipes                   pipe() + dup2() (13)
Redirection             open() + dup2() (10, 11)
Ctrl+C handling         Signals — SIGINT (13)
Wait for children       wait() syscall (11)
File open/create        File descriptors (10)
PATH lookup             exec searches PATH (02)
```

---

## Extension Ideas

Here are progressively harder features to add:

### 1. Command History

Store commands in a Vec and support up-arrow (or `history` command):

```rust
struct Shell {
    history: Vec<String>,
}

fn builtin_history(history: &[String]) {
    for (index, cmd) in history.iter().enumerate() {
        println!("{:4}  {}", index + 1, cmd);
    }
}
```

### 2. Environment Variables

Support `export VAR=value` and `$VAR` expansion:

```rust
fn expand_variables(input: &str) -> String {
    let mut result = String::new();
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '$' {
            let mut var_name = String::new();
            while let Some(&next) = chars.peek() {
                if next.is_alphanumeric() || next == '_' {
                    var_name.push(next);
                    chars.next();
                } else {
                    break;
                }
            }
            match env::var(&var_name) {
                Ok(val) => result.push_str(&val),
                Err(_) => {}
            }
        } else {
            result.push(ch);
        }
    }

    result
}
```

### 3. Job Control (Background Processes)

Support `command &` and `fg`/`bg`:

```rust
struct Job {
    id: u32,
    pid: u32,
    command: String,
    child: std::process::Child,
}

fn execute_background(cmd: &ParsedCommand) -> io::Result<Job> {
    let child = Command::new(&cmd.program)
        .args(&cmd.args)
        .spawn()?;

    let job = Job {
        id: 1,
        pid: child.id(),
        command: format!("{} {}", cmd.program, cmd.args.join(" ")),
        child,
    };

    println!("[{}] {}", job.id, job.pid);
    Ok(job)
}
```

### 4. Glob Expansion

Expand `*.rs` into matching file names before executing:

```rust
fn expand_globs(args: &[String]) -> Vec<String> {
    let mut expanded = Vec::new();
    for arg in args {
        if arg.contains('*') || arg.contains('?') {
            match glob::glob(arg) {
                Ok(paths) => {
                    let matches: Vec<String> = paths
                        .filter_map(|p| p.ok())
                        .map(|p| p.display().to_string())
                        .collect();
                    if matches.is_empty() {
                        expanded.push(arg.clone());
                    } else {
                        expanded.extend(matches);
                    }
                }
                Err(_) => expanded.push(arg.clone()),
            }
        } else {
            expanded.push(arg.clone());
        }
    }
    expanded
}
```

### 5. Readline Support

Use the `rustyline` crate for proper line editing, history, tab
completion:

```rust
// Cargo.toml: rustyline = "13"

use rustyline::DefaultEditor;

fn main() -> rustyline::Result<()> {
    let mut rl = DefaultEditor::new()?;
    let _ = rl.load_history("/tmp/rush_history.txt");

    loop {
        let prompt = get_prompt();
        match rl.readline(&prompt) {
            Ok(line) => {
                let line = line.trim();
                if line.is_empty() { continue; }
                rl.add_history_entry(line)?;

                // ... parse and execute ...
            }
            Err(rustyline::error::ReadlineError::Interrupted) => {
                println!("^C");
                continue;
            }
            Err(rustyline::error::ReadlineError::Eof) => {
                println!("exit");
                break;
            }
            Err(err) => {
                eprintln!("Error: {}", err);
                break;
            }
        }
    }

    rl.save_history("/tmp/rush_history.txt")?;
    Ok(())
}
```

---

## Exercises

### Exercise 1: Build and Test the Shell

Copy the complete shell code, build it, and test all the features:
- Basic commands, pipes, redirection
- Built-in commands (cd, pwd, echo, exit)
- Error handling
- Ctrl+C handling

### Exercise 2: Add `type` Built-in

Add a `type` command that tells you whether a command is built-in or
external (and where the external is found):

```
rush> type cd
cd is a shell builtin
rush> type ls
ls is /bin/ls
rush> type nonexistent
nonexistent: not found
```

Hint: search directories in `$PATH` for the executable.

### Exercise 3: Add `export` and Variable Expansion

Implement:
- `export VAR=value` — sets an environment variable
- `$VAR` expansion in arguments
- `env` built-in that lists all environment variables

### Exercise 4: Add Stderr Redirection

Support `2>` and `2>&1`:
- `command 2> error.log` — redirect stderr to file
- `command > out.txt 2>&1` — redirect both stdout and stderr

### Exercise 5: Add Command History and `!!`

- Store each command in a history Vec
- `history` built-in prints numbered history
- `!!` re-executes the last command
- `!N` re-executes command number N from history

---

## What You've Learned

This mini shell project ties together:

1. **Processes** (Lesson 02): fork + exec to run programs
2. **Virtual Memory** (Lesson 03): each child gets its own address space
3. **File Systems** (Lesson 09): navigating directories with cd
4. **File Descriptors** (Lesson 10): stdin/stdout/stderr, redirection
5. **System Calls** (Lesson 11): every operation goes through syscalls
6. **Pipes** (Lesson 13): connecting processes with pipe()
7. **Signals** (Lesson 13): handling Ctrl+C with SIGINT
8. **Rust OS APIs** (Lesson 15): std::process, std::fs, std::io

You now understand what happens between typing a command and seeing its
output — every step, from parsing to process creation to I/O wiring.
