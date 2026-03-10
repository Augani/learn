# Linux/Unix Fundamentals — Your Daily Environment

The tools, concepts, and mental models for working effectively in a
Unix environment. Everything a systems programmer uses daily.

macOS is Unix under the hood, so most of this applies directly to your machine.

---

## Reference Files

- [Command Cheat Sheet](./reference-commands.md) — Essential commands quick reference
- [Shell Scripting Cheat Sheet](./reference-shell-scripting.md) — Bash scripting patterns
- [macOS vs Linux Command Map](./reference-macos-linux-map.md) — Translate lesson commands between your Mac and a Linux box

---

## The Roadmap

### Phase 1: The Shell (Hours 1–8)
- [ ] [Lesson 01: The terminal and shell — what they actually are](./01-terminal-shell.md)
- [ ] [Lesson 02: Navigation, files, and permissions](./02-files-permissions.md)
- [ ] [Lesson 03: Pipes, redirection, and composition — the Unix philosophy](./03-pipes-redirection.md)
- [ ] [Lesson 04: Text processing — grep, sed, awk, jq, and friends](./04-text-processing.md)

### Phase 2: Processes and System (Hours 9–18)
- [ ] [Lesson 05: Process management — ps, top, kill, jobs, bg, fg](./05-process-management.md)
- [ ] [Lesson 06: Environment variables, PATH, and configuration](./06-environment.md)
- [ ] [Lesson 07: Users, groups, and sudo](./07-users-groups.md)
- [ ] [Lesson 08: Services and daemons — systemd, launchd](./08-services-daemons.md)

### Phase 3: Development Tools (Hours 19–28)
- [ ] [Lesson 09: Shell scripting — automating your workflow](./09-shell-scripting.md)
- [ ] [Lesson 10: Git internals — how git actually works under the hood](./10-git-internals.md)
- [ ] [Lesson 11: SSH — remote access, keys, tunnels, config](./11-ssh.md)
- [ ] [Lesson 12: Debugging tools — strace/dtruss, lsof, netstat, tcpdump, htop](./12-debugging-tools.md)

### Phase 4: Containers and Infrastructure (Hours 29–38)
- [ ] [Lesson 13: Docker — what containers actually are (namespaces, cgroups)](./13-docker.md)
- [ ] [Lesson 14: Docker Compose and multi-container setups](./14-docker-compose.md)
- [ ] [Lesson 15: Networking on Linux — iptables, ports, interfaces](./15-linux-networking.md)
- [ ] [Lesson 16: Disk, filesystems, and storage — df, du, mount, lvm](./16-disk-storage.md)

### Phase 5: Production Operations (Hours 39–44)
- [ ] [Lesson 17: Logs — journalctl, log rotation, structured logging](./17-logs.md)
- [ ] [Lesson 18: Monitoring and observability — metrics, alerts, dashboards](./18-monitoring.md)

---

## How to use these lessons

Every lesson has:
1. Concept explained (what it is, why it exists)
2. Commands you can run locally where possible
3. Practical exercises (not theoretical)
4. "What would happen if..." scenarios

Many examples run directly on macOS, but several later lessons use
Linux-only tools such as `ss`, `iptables`, `journalctl`, and LVM commands.
macOS equivalents are called out where they exist; use a Linux VM or
container when you need the Linux-only commands.

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **How Linux Works** by Brian Ward (No Starch Press, 3rd Edition 2021) — What every power user should know
- **The Linux Command Line** by William Shotts (No Starch Press, 2nd Edition 2019) — From zero to shell scripting. *Free at linuxcommand.org*
