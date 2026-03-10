# Lesson 02: Navigation, Files, and Permissions

Unix has a single organizing principle for its filesystem: everything is a file. Regular files, directories, hardware devices, network sockets, running processes — the OS presents them all through the same file interface. Once you internalize this, the system stops feeling arbitrary.

---

## The Directory Structure

Unix filesystems are a single tree rooted at `/`. There are no drive letters like `C:\` or `D:\`.

| Directory | Purpose |
|-----------|---------|
| `/` | Root of the entire filesystem |
| `/home` (Linux) or `/Users` (macOS) | User home directories |
| `/etc` | System configuration files (think "et cetera" for config) |
| `/var` | Variable data — logs, databases, mail, caches |
| `/tmp` | Temporary files (cleared on reboot) |
| `/usr` | User system resources — programs, libraries, docs |
| `/usr/local` | Locally installed programs (Homebrew installs here on Intel Macs) |
| `/usr/bin` | Standard system programs |
| `/bin` | Essential programs (ls, cp, mv) |
| `/sbin` | System administration programs |
| `/opt` | Optional/third-party software (Homebrew on Apple Silicon: `/opt/homebrew`) |
| `/dev` | Device files (disks, terminals, random number generators) |
| `/proc` (Linux only) | Virtual filesystem exposing kernel and process info |

On macOS, the structure is similar but has some extras:
- `/Applications` — GUI apps
- `/Library` — System-wide libraries and preferences
- `~/Library` — Per-user libraries and preferences
- `/System` — macOS system files (read-only on recent versions)

---

## Navigation

```bash
pwd                     # print working directory (where you are)
cd /var/log             # change to absolute path
cd log                  # change to relative path (subdirectory of current)
cd ~                    # go to home directory
cd                      # also goes home (shortcut)
cd -                    # go to previous directory (toggle)
cd ..                   # go up one level
cd ../..                # go up two levels
```

### Listing files

```bash
ls                      # list files in current directory
ls /etc                 # list files in /etc
ls -l                   # long format: permissions, owner, size, date
ls -la                  # long format including hidden files
ls -lh                  # human-readable sizes (4.2K instead of 4096)
ls -lt                  # sort by modification time (newest first)
ls -lS                  # sort by size (largest first)
ls -R                   # recursive (list subdirectories too)
ls -1                   # one file per line (useful for piping)
```

Reading `ls -l` output:

```
drwxr-xr-x  5 augustus  staff   160 Jan 15 10:30 src
-rw-r--r--  1 augustus  staff  2048 Jan 15 09:15 Cargo.toml
lrwxr-xr-x  1 augustus  staff    12 Jan 14 08:00 link -> target.txt
```

| Field | Meaning |
|-------|---------|
| `d` or `-` or `l` | Type: directory, file, or symlink |
| `rwxr-xr-x` | Permissions (owner/group/other) |
| `5` | Link count |
| `augustus` | Owner |
| `staff` | Group |
| `160` | Size in bytes |
| `Jan 15 10:30` | Last modification time |
| `src` | Filename |

---

## File Operations

### Creating files and directories

```bash
touch newfile.txt               # create empty file (or update timestamp if exists)
mkdir mydir                     # create directory
mkdir -p parent/child/grandchild  # create nested directories (-p = parents)
```

### Copying

```bash
cp source.txt dest.txt          # copy file
cp source.txt /path/to/dir/     # copy file into directory
cp -r sourcedir/ destdir/       # copy directory recursively
cp -i source.txt dest.txt       # prompt before overwriting
```

### Moving and renaming

```bash
mv old.txt new.txt              # rename file
mv file.txt /path/to/dir/      # move file to directory
mv olddir/ newdir/              # rename directory
```

### Deleting

```bash
rm file.txt                     # delete file (no confirmation, no trash)
rm -i file.txt                  # prompt before deleting
rm -r mydir/                    # delete directory and all contents
rmdir emptydir/                 # delete empty directory only (safer)
```

There is no "undo" for `rm`. The file is gone. If you want a safety net, consider aliasing `rm` to use trash:

```bash
# Install: brew install trash
alias rm="trash"                # moves to trash instead of deleting
```

---

## Viewing File Contents

```bash
cat file.txt                    # print entire file to stdout
less file.txt                   # paginated viewer (q to quit, / to search, n for next match)
head file.txt                   # first 10 lines
head -n 30 file.txt             # first 30 lines
tail file.txt                   # last 10 lines
tail -n 30 file.txt             # last 30 lines
tail -f logfile.txt             # follow — watch for new lines in real time (Ctrl+C to stop)
wc file.txt                     # count lines, words, characters
wc -l file.txt                  # count lines only
```

`less` is your friend for large files. Inside `less`:
- `Space` or `f` — page forward
- `b` — page backward
- `/pattern` — search forward
- `?pattern` — search backward
- `n` — next search match
- `N` — previous search match
- `g` — go to beginning
- `G` — go to end
- `q` — quit

---

## File Permissions

Every file and directory has three sets of permissions for three categories of users:

| Category | Symbol | Who |
|----------|--------|-----|
| Owner | `u` | The user who owns the file |
| Group | `g` | Users in the file's group |
| Other | `o` | Everyone else |

Each category gets three permission bits:

| Permission | Symbol | On a file | On a directory |
|-----------|--------|-----------|----------------|
| Read | `r` | Can view contents | Can list files |
| Write | `w` | Can modify contents | Can create/delete files |
| Execute | `x` | Can run as a program | Can `cd` into the directory |

**The analogy:** Permissions are like access badges in an office building. Read = you can look at documents. Write = you can edit them. Execute = you can use the equipment. The owner is the department head, the group is the department staff, and other is everyone else in the building.

### Reading permissions

```
-rwxr-xr--
```

Break it down:
- `-` — file type (`-` = regular file, `d` = directory, `l` = symlink)
- `rwx` — owner can read, write, execute
- `r-x` — group can read, execute (no write)
- `r--` — others can read only

### Changing permissions: symbolic mode

```bash
chmod u+x script.sh            # add execute for owner
chmod g+w file.txt              # add write for group
chmod o-r file.txt              # remove read for others
chmod a+r file.txt              # add read for all (a = all)
chmod u+x,g-w file.txt         # multiple changes at once
```

### Changing permissions: numeric (octal) mode

Each permission has a numeric value: `r=4`, `w=2`, `x=1`. Add them up for each category.

| Number | Permission | Meaning |
|--------|-----------|---------|
| `7` | `rwx` | Full access |
| `6` | `rw-` | Read and write |
| `5` | `r-x` | Read and execute |
| `4` | `r--` | Read only |
| `0` | `---` | No access |

Common combinations:

```bash
chmod 755 script.sh             # rwxr-xr-x — owner full, others can read+execute
chmod 644 file.txt              # rw-r--r-- — owner read+write, others read only
chmod 600 secrets.env           # rw------- — owner only, nobody else
chmod 700 private_dir/          # rwx------ — owner only on a directory
chmod 777 file.txt              # rwxrwxrwx — everyone can do everything (almost never correct)
```

### Changing ownership

```bash
chown augustus file.txt          # change owner
chown augustus:staff file.txt    # change owner and group
chown -R augustus:staff dir/     # recursive
chgrp developers file.txt      # change group only
```

On macOS, you typically need `sudo` for `chown`.

---

## Hidden Files (Dotfiles)

Files and directories starting with `.` are hidden from normal `ls` output. They are conventionally used for configuration.

```bash
ls -a                           # show all files including hidden
ls -la                          # long format with hidden files
```

Common dotfiles:
- `~/.zshrc` — zsh configuration
- `~/.gitconfig` — git configuration
- `~/.ssh/` — SSH keys and config
- `~/.config/` — XDG config directory (many modern tools use this)

---

## Special Permissions (Brief)

These exist but you will rarely set them yourself:

- **setuid** (`s` on owner execute) — When executed, the program runs as the file's owner, not the user running it. Example: `passwd` runs as root so it can modify `/etc/shadow`.
- **setgid** (`s` on group execute) — Program runs with the file's group. On directories: new files inherit the directory's group.
- **Sticky bit** (`t` on other execute) — On directories: only the file owner can delete files inside. Used on `/tmp` so users can't delete each other's temp files.

```bash
ls -la /tmp                     # you'll see drwxrwxrwt — the t is the sticky bit
ls -la /usr/bin/passwd          # you'll see -rwsr-xr-x — the s is setuid
```

---

## Exercises

### Exercise 1: Navigate and explore

```bash
cd /
ls -la
cd /etc
ls | head -20
cd ~
pwd
```

### Exercise 2: Create a project structure

```bash
mkdir -p ~/exercise/project/{src,tests,docs}
touch ~/exercise/project/src/{main.rs,lib.rs}
touch ~/exercise/project/tests/test_main.rs
touch ~/exercise/project/docs/README.md
touch ~/exercise/project/{Cargo.toml,.gitignore,.env}

ls -laR ~/exercise/project/
```

### Exercise 3: Permissions practice

```bash
cd ~/exercise/project

chmod 755 src/main.rs
ls -l src/main.rs               # rwxr-xr-x

chmod 600 .env
ls -l .env                      # rw------- (only you can read your secrets)

chmod 644 Cargo.toml
ls -l Cargo.toml                # rw-r--r--

cat > src/run.sh <<'EOF'
#!/bin/bash
echo "running!"
EOF

chmod u+x src/run.sh
./src/run.sh                    # should print "running!"

chmod u-x src/run.sh
./src/run.sh                    # should get "permission denied"
```

### Exercise 4: Understanding directory permissions

```bash
mkdir ~/exercise/restricted
touch ~/exercise/restricted/secret.txt
echo "top secret" > ~/exercise/restricted/secret.txt

chmod 000 ~/exercise/restricted
ls ~/exercise/restricted        # permission denied
cat ~/exercise/restricted/secret.txt  # permission denied

chmod 755 ~/exercise/restricted # restore access
cat ~/exercise/restricted/secret.txt  # works again

rm -rf ~/exercise               # clean up
```

---

Next: [Lesson 03 — Pipes, Redirection, and Composition](./03-pipes-redirection.md)
