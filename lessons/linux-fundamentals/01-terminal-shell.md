# Lesson 01: The Terminal and Shell — What They Actually Are

These two terms get used interchangeably but they are distinct things. Understanding the difference clears up a lot of confusion about how you interact with your computer at the command line.

---

## Terminal Emulator vs Shell

**Terminal emulator** — The graphical window you open. Examples: iTerm2, Terminal.app, Alacritty, kitty, Windows Terminal. It handles drawing text on screen, colors, fonts, scrolling, and keyboard input.

**Shell** — The program running inside that window. It reads what you type, interprets it, and executes commands. Examples: bash, zsh, fish, sh, dash.

**The analogy:** The terminal is the TV screen. The shell is the channel you're watching. You can switch channels (shells) without buying a new TV (terminal). You can also watch the same channel on a different TV.

macOS ships with zsh as the default shell since Catalina (10.15). Before that it was bash. Linux distros typically default to bash.

Check your current shell:

```bash
echo $SHELL           # your login shell
echo $0               # the shell running right now (might differ from login shell)
```

List all available shells on your system:

```bash
cat /etc/shells
```

Switch to a different shell temporarily:

```bash
bash                  # start a bash session inside your current shell
exit                  # go back to the previous shell
```

---

## How a Command Executes

When you type `ls -la /tmp` and press Enter, here is what actually happens:

1. **You type** — The terminal captures keystrokes and sends them to the shell.
2. **Shell parses** — The shell breaks your input into tokens: command (`ls`), arguments (`-la`, `/tmp`).
3. **Shell resolves the command** — Is it a built-in? An alias? A function? Or an external program? If external, the shell searches through PATH to find the executable.
4. **fork + exec** — The shell creates a child process (fork), then replaces it with the program (exec). The child process runs `ls` with the arguments.
5. **Output** — `ls` writes to stdout. The shell receives this output and the terminal renders it on screen.
6. **Exit code** — `ls` finishes and returns an exit code (0 for success). The shell stores this in `$?`.

This fork+exec model is fundamental to Unix. Every command you run (except built-ins) creates a new process. This is why environment variables set in a child process don't affect the parent — each process has its own copy.

---

## PATH: Where the Shell Looks for Programs

When you type `git status`, how does the shell know where `git` lives on disk?

PATH is an environment variable containing a colon-separated list of directories. The shell searches these directories in order, left to right, and runs the first match.

```bash
echo $PATH
# /usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
```

This means the shell checks:
1. `/usr/local/bin/git` — found it? Run it. Not found? Continue.
2. `/usr/bin/git` — found it? Run it. Not found? Continue.
3. `/bin/git` — and so on.

Find where a specific program lives:

```bash
which git             # /usr/bin/git
which -a python3      # all matches in PATH, not just the first
type git              # git is /usr/bin/git (also shows aliases and built-ins)
```

If a program isn't in your PATH, you get `command not found`. You can still run it by providing the full path:

```bash
/usr/local/custom/bin/my-tool --version
```

---

## Shell Built-ins vs External Programs

Some commands are part of the shell itself (built-ins). Others are separate programs on disk (external).

**Why does this matter?** Built-ins execute inside the shell process — no fork+exec. This makes them fast, and it also means they can modify the shell's own state (like changing the current directory).

Common built-ins:
- `cd` — must be built-in because changing directory affects the shell process itself
- `echo`, `printf` — built-in for speed (also exist as external programs)
- `export` — modifies the shell's environment
- `source` / `.` — runs a script in the current shell (not a child process)
- `alias` — creates command shortcuts
- `type` — tells you what something is

Common external programs:
- `ls`, `grep`, `find`, `cat`, `git`, `curl`

Check if something is a built-in:

```bash
type cd               # cd is a shell builtin
type ls               # ls is /bin/ls
type echo             # echo is a shell builtin (but /bin/echo also exists)
```

On macOS, many "standard" commands are the BSD variants, which sometimes have different flags than the GNU/Linux versions. For example, `sed -i` requires an empty string argument on macOS (`sed -i '' 's/a/b/'`) but not on Linux (`sed -i 's/a/b/'`). You can install the GNU versions via Homebrew (`coreutils`, `gnu-sed`, etc.) if you want consistency.

---

## Keyboard Shortcuts and History

These work in both bash and zsh with default settings. They use readline/emacs keybindings.

**Line editing:**

| Shortcut | Action |
|----------|--------|
| `Ctrl+A` | Move cursor to beginning of line |
| `Ctrl+E` | Move cursor to end of line |
| `Ctrl+K` | Delete from cursor to end of line |
| `Ctrl+U` | Delete from cursor to beginning of line |
| `Ctrl+W` | Delete the word before the cursor |
| `Alt+B` | Move back one word |
| `Alt+F` | Move forward one word |
| `Ctrl+L` | Clear the screen (same as `clear`) |

**History:**

| Shortcut | Action |
|----------|--------|
| `Up arrow` | Previous command in history |
| `Down arrow` | Next command in history |
| `Ctrl+R` | Reverse search through history (type to filter, press again to cycle) |
| `!!` | Repeat the entire last command |
| `!$` | Last argument of the previous command |
| `!grep` | Last command that started with `grep` |

`Ctrl+R` is incredibly useful. Press it, start typing part of a previous command, and it finds the most recent match. Press `Ctrl+R` again to go further back. Press `Enter` to execute, or `Ctrl+G` to cancel.

```bash
history               # show command history
history | grep docker # find previous docker commands
```

**Tab completion:**

Press Tab to complete commands, filenames, and arguments. Press Tab twice to show all possibilities if the completion is ambiguous.

zsh has richer tab completion than bash out of the box — it can complete git branches, command flags, hostnames, and more.

---

## Configuration Files: .zshrc and .bashrc

Your shell reads configuration files at startup. Which file depends on the type of shell session:

**For zsh (macOS default):**

| File | When it runs |
|------|-------------|
| `~/.zprofile` | Login shells only (opening a new terminal window) |
| `~/.zshrc` | Every interactive shell (new tab, new window, typing `zsh`) |
| `~/.zshenv` | Every zsh invocation, even scripts (rarely used manually) |

**For bash:**

| File | When it runs |
|------|-------------|
| `~/.bash_profile` | Login shells only |
| `~/.bashrc` | Interactive non-login shells (new tab in some terminals) |

**In practice**, most of your customization goes in `~/.zshrc` (or `~/.bashrc`). This is where you put:

- Aliases
- PATH modifications
- Shell options
- Prompt customization
- Functions

Example `~/.zshrc` additions:

```bash
export EDITOR="nvim"
export PATH="$HOME/bin:$HOME/.cargo/bin:$PATH"

alias ll="ls -la"
alias gs="git status"
alias gd="git diff"
alias dc="docker compose"
alias k="kubectl"

mkcd() {
    mkdir -p "$1" && cd "$1"
}
```

After editing your config, apply changes without restarting:

```bash
source ~/.zshrc
```

---

## Exercises

### Exercise 1: Explore your shell environment

```bash
echo $SHELL
echo $0
echo $PATH | tr ':' '\n'       # print PATH entries, one per line
type cd
type ls
type git
which -a python3
```

### Exercise 2: Use history effectively

1. Run a few commands (anything — `ls`, `pwd`, `date`).
2. Press `Ctrl+R` and type `ls` to find your previous `ls` command.
3. Try `!!` to repeat the last command.
4. Run `echo hello world`, then run `echo !$` — it should print `world`.

### Exercise 3: Customize your shell

Add these to your `~/.zshrc` (or `~/.bashrc`):

```bash
alias ll="ls -lah"
alias ..="cd .."
alias ...="cd ../.."
alias ports="lsof -i -P -n | grep LISTEN"

mkcd() {
    mkdir -p "$1" && cd "$1"
}
```

Then `source ~/.zshrc` and try:
- `ll`
- `..`
- `mkcd /tmp/test-directory`
- `ports`

### Exercise 4: Understand PATH resolution

```bash
mkdir -p ~/bin
cat > ~/bin/hello <<'EOF'
#!/bin/bash
echo "Hello from ~/bin!"
EOF
chmod +x ~/bin/hello

# If ~/bin is not in your PATH, this fails:
hello

# Add it to PATH:
export PATH="$HOME/bin:$PATH"

# Now it works:
hello
which hello
```

---

Next: [Lesson 02 — Navigation, Files, and Permissions](./02-files-permissions.md)
