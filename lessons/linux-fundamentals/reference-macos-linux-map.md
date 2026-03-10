# Reference: macOS vs Linux Command Map

These lessons often use both macOS and Linux examples. The underlying Unix
ideas are mostly the same, but the command names and tooling are not.

Think of it like this:

- **Linux** = one kernel family, usually with GNU userland tools
- **macOS** = XNU kernel, BSD-style userland, Apple-specific tooling

Same general concepts. Different knobs and command surfaces.

---

## The Big Picture

If you are learning on a Mac, separate each lesson into two layers:

1. **The concept**
   Processes, ports, logs, services, filesystems, signals, sockets
2. **The tool**
   `systemctl`, `journalctl`, `ss`, `ip`, `launchctl`, `log show`, `lsof`

The concept transfers. The exact command often does not.

---

## Quick Translation Table

| Task | macOS | Linux | Notes |
|------|-------|-------|------|
| Show network interfaces | `ifconfig` | `ip addr` | `ifconfig` exists on macOS by default; Linux has mostly moved to `ip` |
| Show routes / default gateway | `netstat -rn` or `route -n get default` | `ip route` | Same concept, different syntax |
| See listening ports | `lsof -i -P -n | grep LISTEN` | `ss -tlnp` | `lsof` works on Linux too; `ss` is usually better there |
| Trace system calls | `sudo dtruss` | `strace` | macOS tracing is more restricted by SIP |
| Show process tree / activity | `top` or `htop` | `top` or `htop` | Similar on both |
| Manage services | `launchctl` | `systemctl` | `launchd` vs `systemd` |
| Read system logs | `log show`, `log stream` | `journalctl` | Linux may also still have `/var/log/*` |
| Install packages | `brew install ...` | `apt install ...`, `dnf install ...` | Package manager depends on distro |
| List disks | `diskutil list` | `lsblk` | Different storage terminology |
| Show mounted filesystems | `mount`, `df -h` | `mount`, `df -h`, `findmnt` | `findmnt` is Linux-specific |
| Firewall rules | `pfctl` | `iptables` / `nft` | The lessons focus on Linux firewalls |
| View kernel messages | `log show --predicate 'sender == \"kernel\"'` | `dmesg` | Same question, different tools |

---

## Services: launchd vs systemd

This is one of the biggest sources of confusion.

| Idea | macOS | Linux |
|------|-------|------|
| Service manager | `launchd` | `systemd` |
| CLI tool | `launchctl` | `systemctl` |
| Service definition | plist file | unit file |
| Per-service logs | unified log | journal |

**Analogy:** Both are hotel front desks for long-running processes.

- They start services
- restart them if they crash
- keep track of status
- expose logs

But the front-desk software is different on each OS.

---

## Networking: `ifconfig`/`lsof` vs `ip`/`ss`

On macOS, the older BSD-style tools are still normal:

```bash
ifconfig
netstat -rn
lsof -i :8080
```

On Linux, modern practice is:

```bash
ip addr
ip route
ss -tlnp
```

**Mental model:** macOS often answers "what is happening on this machine?"
with older Unix utilities. Linux more often answers the same question with
the newer `iproute2` and `ss` toolchain.

---

## Logging: `log show` vs `journalctl`

On macOS:

```bash
log show --last 10m
log stream
```

On Linux with systemd:

```bash
journalctl --since "10 min ago"
journalctl -u nginx -f
```

Both are ways to query structured system logs. The key idea is the same:

- logs are indexed
- you can filter by time
- you can filter by service
- you can stream live output

---

## Firewalls: `pf` vs `iptables` / `nftables`

The Linux lessons use `iptables` because it is still widely seen in docs and
production systems, even though `nftables` is the modern Linux direction.

macOS uses Packet Filter (`pf`):

```bash
sudo pfctl -sr        # show rules
sudo pfctl -sa        # show status and rules
```

Linux uses:

```bash
sudo iptables -L -n -v
sudo nft list ruleset
```

If a lesson is specifically about `iptables`, the cleanest way to follow it
is to use a Linux VM or container rather than trying to force a macOS mapping.

---

## Package Managers

| macOS | Linux |
|------|------|
| `brew install jq` | `apt install jq` or `dnf install jq` |
| `brew services start postgresql` | `systemctl start postgresql` |

**Important:** Homebrew is not the OS package manager in the Linux sense. It
is a user-space package ecosystem layered on top of macOS.

---

## Common Gotchas

### `sed -i` behaves differently

macOS BSD `sed`:

```bash
sed -i '' 's/old/new/g' file.txt
```

Linux GNU `sed`:

```bash
sed -i 's/old/new/g' file.txt
```

### GNU flags are not guaranteed on macOS

Examples:
- `ls --color` is common on Linux, not standard on macOS
- `grep -P` may not exist on macOS default `grep`
- `readlink -f` often works on Linux, not on macOS default `readlink`

### Linux admin lessons may require a real Linux environment

Use Linux for lessons centered on:
- `systemd`
- `journalctl`
- `iptables` / `nftables`
- LVM
- `ss`
- `/proc`-heavy workflows

---

## When to Stay on macOS vs Switch to Linux

Stay on macOS for:
- shell basics
- pipes and redirection
- text processing
- git
- ssh
- basic debugging with `lsof`, `top`, `tcpdump`, `dtruss`

Switch to Linux for:
- service management with `systemd`
- journal analysis with `journalctl`
- firewall configuration
- low-level disk management
- container internals and production-like ops work

---

## The Right Way to Learn From Cross-Platform Lessons

Do not memorize commands in isolation. For every command, ask:

1. What question is this command answering?
2. What subsystem is it interrogating?
3. What is the equivalent question on my OS?

Example:

- Linux question: "Which TCP ports are listening?" -> `ss -tlnp`
- macOS question: "Which TCP ports are listening?" -> `lsof -i -P -n | grep LISTEN`

Different tools. Same question. That is the skill you want.
