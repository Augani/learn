# Lesson 18: CLI Tools with Clap

Building CLI tools is one of Rust's sweet spots. `clap` is the standard
argument parser for command-line apps. It handles flags, subcommands,
validation, help text, and shell-friendly UX.

---

## Setup

```bash
cargo add clap --features derive
```

---

## Basic CLI

```rust
use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "greet", about = "A greeting CLI tool")]
struct Args {
    /// Name of the person to greet
    name: String,

    /// Number of times to greet
    #[arg(short, long, default_value_t = 1)]
    count: u32,

    /// Use uppercase greeting
    #[arg(short, long)]
    uppercase: bool,
}

fn main() {
    let args = Args::parse();

    for _ in 0..args.count {
        let greeting = format!("Hello, {}!", args.name);
        if args.uppercase {
            println!("{}", greeting.to_uppercase());
        } else {
            println!("{greeting}");
        }
    }
}
```

```bash
$ cargo run -- Augustus -c 3 --uppercase
HELLO, AUGUSTUS!
HELLO, AUGUSTUS!
HELLO, AUGUSTUS!

$ cargo run -- --help
A greeting CLI tool

Usage: greet [OPTIONS] <NAME>

Arguments:
  <NAME>  Name of the person to greet

Options:
  -c, --count <COUNT>  Number of times to greet [default: 1]
  -u, --uppercase      Use uppercase greeting
  -h, --help           Print help
```

**Go equivalent (cobra):**
```go
var rootCmd = &cobra.Command{
    Use:   "greet [name]",
    Short: "A greeting CLI tool",
    Run: func(cmd *cobra.Command, args []string) { ... },
}
```

Rust's derive approach is more concise — the struct IS the configuration.

---

## Subcommands

```rust
use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(name = "todo", about = "A TODO list manager")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Add a new task
    Add {
        /// The task description
        description: String,

        /// Priority level
        #[arg(short, long, default_value = "medium")]
        priority: String,
    },

    /// List all tasks
    List {
        /// Show only completed tasks
        #[arg(long)]
        done: bool,
    },

    /// Mark a task as complete
    Done {
        /// Task ID to mark as done
        id: u32,
    },

    /// Remove a task
    Remove {
        /// Task ID to remove
        id: u32,

        /// Skip confirmation
        #[arg(short, long)]
        force: bool,
    },
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Add { description, priority } => {
            println!("Adding task: {description} (priority: {priority})");
        }
        Commands::List { done } => {
            if done {
                println!("Showing completed tasks");
            } else {
                println!("Showing all tasks");
            }
        }
        Commands::Done { id } => {
            println!("Marking task {id} as done");
        }
        Commands::Remove { id, force } => {
            if force {
                println!("Removing task {id}");
            } else {
                println!("Are you sure? Use --force to skip confirmation");
            }
        }
    }
}
```

```bash
$ cargo run -- add "Buy groceries" --priority high
$ cargo run -- list --done
$ cargo run -- done 3
```

---

## Argument Types

```rust
use std::path::PathBuf;
use clap::Parser;

#[derive(Parser, Debug)]
struct Args {
    /// Positional argument (required)
    input: String,

    /// Optional positional
    output: Option<String>,

    /// File path
    #[arg(short, long)]
    config: Option<PathBuf>,

    /// Multiple values
    #[arg(short, long)]
    tags: Vec<String>,

    /// Enum value
    #[arg(short, long, default_value = "json")]
    format: OutputFormat,

    /// Environment variable fallback
    #[arg(long, env = "API_KEY")]
    api_key: Option<String>,
}

#[derive(Debug, Clone, clap::ValueEnum)]
enum OutputFormat {
    Json,
    Yaml,
    Toml,
}
```

---

## Reading Files and Stdin

A complete example showing a practical CLI pattern:

```rust
use clap::Parser;
use std::fs;
use std::io::{self, Read};

#[derive(Parser)]
#[command(name = "wc", about = "Count lines, words, chars")]
struct Args {
    /// Input file (reads stdin if not provided)
    file: Option<String>,

    /// Count lines
    #[arg(short, long)]
    lines: bool,

    /// Count words
    #[arg(short, long)]
    words: bool,
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    let content = match &args.file {
        Some(path) => fs::read_to_string(path)?,
        None => {
            let mut buf = String::new();
            io::stdin().read_to_string(&mut buf)?;
            buf
        }
    };

    if args.lines || (!args.lines && !args.words) {
        println!("Lines: {}", content.lines().count());
    }
    if args.words || (!args.lines && !args.words) {
        println!("Words: {}", content.split_whitespace().count());
    }

    Ok(())
}
```

---

## Error Handling in CLIs

Use `anyhow` for clean error messages:

```rust
use anyhow::{Context, Result};
use clap::Parser;

#[derive(Parser)]
struct Args {
    config_path: String,
}

fn main() -> Result<()> {
    let args = Args::parse();

    let content = std::fs::read_to_string(&args.config_path)
        .context(format!("Failed to read config file: {}", args.config_path))?;

    let port: u16 = content.trim().parse()
        .context("Config file must contain a valid port number")?;

    println!("Starting server on port {port}");
    Ok(())
}
```

---

## Exercises

### Exercise 1: File search CLI
```
Build a CLI tool that:
- Takes a search pattern and a directory path
- Recursively searches for files matching the pattern
- Options: --extension (filter by ext), --ignore-case, --max-depth
```

### Exercise 2: JSON formatter
```
Build a CLI tool that:
- Reads JSON from stdin or a file
- Pretty-prints it (default) or compacts it (--compact)
- Options: --sort-keys, --indent <N>
```

---

## Key Takeaways

1. **`clap` with derive** — struct = CLI definition. Clean and type-safe.
2. **Subcommands as enums** — `match` on them for exhaustive handling.
3. **`anyhow`** for CLI error handling — human-readable error messages.
4. **Coming from Go:** Like `cobra` but the derive approach is more concise.
   No `init()` boilerplate, no `cmd.Flags().StringVar(...)` chains.

Next: [Lesson 19 — HTTP API with Axum](./19-http-axum.md)
