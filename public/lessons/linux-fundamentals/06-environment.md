# Lesson 06: Environment Variables, PATH, and Configuration

Environment variables are the invisible layer of configuration that shapes how every program on your system behaves. They determine which editor opens when you run `git commit`, which database your application connects to, and which Python version runs when you type `python`.

---

## What Are Environment Variables?

Environment variables are key-value pairs that are part of every process's environment. When a process creates a child process (fork+exec), the child inherits a copy of the parent's environment.

**The analogy:** Environment variables are like settings on a shared whiteboard in an office. When a new team member (child process) joins, they get a photocopy of the current whiteboard. They can modify their own copy, but changes do not affect the original whiteboard or other team members' copies.

This inheritance model is important:
- Setting a variable in your shell makes it available to all commands you run from that shell.
- A child process modifying its environment does NOT affect the parent.
- This is why `cd` must be a shell built-in — an external program cannot change the parent shell's working directory.

---

## Viewing Environment Variables

```bash
env                              # all environment variables
printenv                         # same thing
printenv HOME                    # value of a specific variable
echo $HOME                       # value of a specific variable (shell expansion)
echo $PATH                       # the PATH variable
echo "$HOME"                     # always quote to handle spaces correctly
```

### Shell variables vs environment variables

There is a distinction:

```bash
MY_VAR="hello"                   # shell variable — only visible in this shell
echo $MY_VAR                     # works in this shell
bash -c 'echo $MY_VAR'          # empty — child process doesn't see it

export MY_VAR="hello"            # environment variable — inherited by children
bash -c 'echo $MY_VAR'          # "hello" — child process sees it
```

`export` promotes a shell variable to an environment variable. Without `export`, the variable exists only in the current shell.

---

## Setting and Unsetting Variables

```bash
export DATABASE_URL="postgres://localhost:5432/mydb"
export PORT=8080
export DEBUG=true

unset DATABASE_URL               # remove the variable entirely

export PATH="$HOME/bin:$PATH"    # prepend to PATH (don't overwrite)
```

### Inline variables for a single command

```bash
PORT=3000 cargo run              # PORT is set only for this command
DATABASE_URL="sqlite::memory:" cargo test  # set just for tests
ENV=test LOG_LEVEL=debug ./my-app          # multiple variables
```

This is useful for running a command with different settings without modifying your shell environment.

---

## PATH: The Search Path

PATH is the most important environment variable. It is a colon-separated list of directories that the shell searches when you type a command name.

```bash
echo $PATH
# /opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
```

When you type `git`, the shell checks:
1. `/opt/homebrew/bin/git` — exists? Run it. No? Continue.
2. `/usr/local/bin/git` — exists? Run it. No? Continue.
3. `/usr/bin/git` — exists? Run it.

**Order matters.** The first match wins. This is how you can override system programs with your own versions by putting your directory first:

```bash
export PATH="$HOME/bin:$PATH"    # your ~/bin is searched FIRST
```

### Common PATH additions

```bash
# Homebrew (Apple Silicon)
export PATH="/opt/homebrew/bin:$PATH"

# Homebrew (Intel Mac)
export PATH="/usr/local/bin:$PATH"

# Rust (cargo)
export PATH="$HOME/.cargo/bin:$PATH"

# Go
export PATH="$HOME/go/bin:$PATH"

# Node (nvm)
export NVM_DIR="$HOME/.nvm"

# Python (pyenv)
export PATH="$HOME/.pyenv/bin:$PATH"

# Custom scripts
export PATH="$HOME/bin:$PATH"
```

### Diagnosing PATH issues

```bash
which python3                    # which python3 would be executed
which -a python3                 # ALL python3 executables in PATH
type -a python3                  # includes aliases and functions too
echo $PATH | tr ':' '\n'        # view PATH entries, one per line
```

---

## Common Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `HOME` | User's home directory | `/Users/augustus` |
| `USER` | Current username | `augustus` |
| `SHELL` | User's login shell | `/bin/zsh` |
| `PATH` | Command search path | `/usr/local/bin:/usr/bin:/bin` |
| `EDITOR` | Default text editor | `nvim` |
| `VISUAL` | Visual editor (preferred over EDITOR) | `code --wait` |
| `TERM` | Terminal type | `xterm-256color` |
| `LANG` | Locale setting | `en_US.UTF-8` |
| `LC_ALL` | Override all locale settings | `en_US.UTF-8` |
| `PAGER` | Program for viewing long output | `less` |
| `TMPDIR` | Temporary file directory | `/tmp` |
| `XDG_CONFIG_HOME` | User config directory | `~/.config` |
| `XDG_DATA_HOME` | User data directory | `~/.local/share` |

### Variables commonly used in development

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Database connection string |
| `REDIS_URL` | Redis connection string |
| `PORT` | Server port |
| `NODE_ENV` | Node.js environment (development/production) |
| `RUST_LOG` | Rust logging level (env_logger / tracing) |
| `RUST_BACKTRACE` | Enable Rust backtraces (1 or full) |
| `GOPATH` | Go workspace directory |
| `CARGO_HOME` | Cargo home directory |
| `AWS_REGION` | AWS region |
| `AWS_PROFILE` | AWS credentials profile |

---

## .env Files and direnv

### .env files

The convention of storing configuration in `.env` files comes from the Twelve-Factor App methodology. Many frameworks (Node, Python, Rust with dotenvy) load `.env` automatically.

```bash
# .env file
DATABASE_URL=postgres://localhost:5432/myapp
REDIS_URL=redis://localhost:6379
PORT=3000
SECRET_KEY=your-secret-here
RUST_LOG=info
```

**Loading .env manually in a shell script:**

```bash
set -o allexport
source .env
set +o allexport
```

Or one-liner: `export $(grep -v '^#' .env | xargs)`

**Security:** Never commit `.env` files to version control. Add `.env` to `.gitignore`.

### direnv: Automatic environment per directory

`direnv` automatically loads and unloads environment variables when you `cd` into and out of directories.

```bash
brew install direnv
```

Add to your `~/.zshrc`:

```bash
eval "$(direnv hook zsh)"
```

Usage:

```bash
cd ~/projects/myapp
echo 'export DATABASE_URL="postgres://localhost/myapp"' > .envrc
direnv allow                     # trust this .envrc file
# Now DATABASE_URL is set automatically when you're in this directory

cd ~                             # DATABASE_URL is automatically unset
cd ~/projects/myapp              # DATABASE_URL is automatically set again
```

This keeps project-specific variables isolated. No more forgetting to source a `.env` file.

---

## Configuration Precedence

Most well-designed programs follow this precedence (highest to lowest):

1. **Command-line flags** — `--port 3000`
2. **Environment variables** — `PORT=3000`
3. **Configuration files** — `config.toml`, `.env`
4. **Default values** — hardcoded in the program

This means environment variables override config files, and command-line flags override everything. This convention makes it easy to override configuration in different environments (dev, staging, production) without modifying files.

---

## Profile Files: When Each One Runs

This is one of the most confusing aspects of shell configuration. Here is the definitive guide:

### zsh (macOS default)

| File | When it runs |
|------|-------------|
| `/etc/zshenv` | Every zsh invocation (system-wide) |
| `~/.zshenv` | Every zsh invocation (even scripts, non-interactive) |
| `/etc/zprofile` | Login shells only (system-wide) |
| `~/.zprofile` | Login shells only |
| `/etc/zshrc` | Interactive shells (system-wide) |
| `~/.zshrc` | Interactive shells |
| `~/.zlogin` | Login shells, after .zshrc |
| `~/.zlogout` | When a login shell exits |

### bash

| File | When it runs |
|------|-------------|
| `/etc/profile` | Login shells (system-wide) |
| `~/.bash_profile` | Login shells (if exists, bash skips .bashrc) |
| `~/.bashrc` | Interactive non-login shells |
| `~/.bash_logout` | When a login shell exits |

### What does "login shell" mean?

- **Login shell** — The first shell session when you log in (SSH sessions, opening Terminal.app). Has a `-` prefix in `$0`.
- **Non-login interactive shell** — A new shell started from an existing one (typing `bash` or `zsh`, opening a new tab in some terminals).
- **Non-interactive shell** — Running a script. Only `~/.zshenv` runs for zsh. For bash, nothing runs unless explicitly sourced.

### Practical advice

For **zsh** (macOS), put everything in `~/.zshrc`. It runs for every interactive shell, which covers terminal windows and tabs. Use `~/.zprofile` only for things that should run once per login session (like starting ssh-agent).

For **bash**, many people add this to `~/.bash_profile`:

```bash
if [ -f ~/.bashrc ]; then
    source ~/.bashrc
fi
```

This ensures `.bashrc` runs for login shells too, so you only need to maintain one file.

---

## Exercises

### Exercise 1: Explore your environment

```bash
# Count how many environment variables you have
env | wc -l

# Find all PATH-like variables (containing colon-separated paths)
env | grep -E '=.*:.*/'

# View your PATH entries one per line
echo $PATH | tr ':' '\n'

# Check what shell you're using
echo "Shell: $SHELL"
echo "Running: $0"
echo "Home: $HOME"
echo "User: $USER"
```

### Exercise 2: Understand variable inheritance

```bash
# Set a shell variable (not exported)
LOCAL_VAR="I am local"
echo $LOCAL_VAR                  # works

# Try accessing it from a child process
bash -c 'echo "From child: $LOCAL_VAR"'    # empty

# Now export it
export LOCAL_VAR
bash -c 'echo "From child: $LOCAL_VAR"'    # works

# Prove that child modifications don't affect parent
bash -c 'export LOCAL_VAR="modified"; echo "In child: $LOCAL_VAR"'
echo "In parent: $LOCAL_VAR"     # still "I am local"

# Clean up
unset LOCAL_VAR
```

### Exercise 3: Add a custom directory to PATH

```bash
# Create a custom bin directory
mkdir -p ~/bin

# Create a custom script
cat > ~/bin/greet <<'EOF'
#!/bin/bash
echo "Hello, $USER! The time is $(date +%H:%M)."
EOF
chmod +x ~/bin/greet

# Try running it (may fail if ~/bin isn't in PATH)
greet 2>/dev/null || echo "Not found in PATH yet"

# Add to PATH temporarily
export PATH="$HOME/bin:$PATH"
greet

# To make it permanent, add to ~/.zshrc:
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
```

### Exercise 4: Set up a .env workflow

```bash
mkdir -p /tmp/env-exercise
cd /tmp/env-exercise

# Create a .env file
cat > .env <<'EOF'
APP_NAME=my-awesome-app
DATABASE_URL=postgres://localhost:5432/myapp
REDIS_URL=redis://localhost:6379
PORT=3000
LOG_LEVEL=debug
EOF

# Load it
set -o allexport
source .env
set +o allexport

# Verify
echo "App: $APP_NAME"
echo "DB: $DATABASE_URL"
echo "Port: $PORT"
echo "Log Level: $LOG_LEVEL"

# Override with an inline variable
PORT=8080 bash -c 'echo "Server on port $PORT"'

# Clean up
unset APP_NAME DATABASE_URL REDIS_URL PORT LOG_LEVEL
```

---

Next: [Lesson 07 — Users, Groups, and sudo](./07-users-groups.md)
