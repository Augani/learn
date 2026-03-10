# Lesson 07: Users, Groups, and sudo

Unix was designed from the ground up as a multi-user system. Even if you are the only person using your Mac, the OS maintains dozens of user accounts behind the scenes — each service, daemon, and system component runs under its own user for isolation and security.

---

## The Multi-User Model

Every process runs as some user. Every file is owned by some user. The kernel enforces access controls based on who you are (your user ID) and what groups you belong to.

Key concepts:
- **UID** — User ID, a numeric identifier. The kernel works with UIDs, not usernames.
- **GID** — Group ID, a numeric identifier for groups.
- **Username** — Human-readable name mapped to a UID.
- Groups — A user belongs to one primary group and can belong to multiple supplementary groups.

```bash
whoami                          # your username
id                              # your UID, GID, and all group memberships
id -u                           # your UID number
id -g                           # your primary GID number
id -Gn                          # names of all your groups
groups                          # same as id -Gn
```

---

## root: The Superuser

`root` is UID 0 and has unrestricted access to the entire system. Root can:
- Read, write, and execute any file regardless of permissions
- Kill any process
- Bind to privileged ports (below 1024)
- Change file ownership
- Modify system configuration
- Install and remove software system-wide

**The analogy:** root is like having the master key to every room in a building, the ability to change any lock, and the authority to demolish walls. Extremely powerful, extremely dangerous if misused.

On macOS, the root account is disabled by default. You use `sudo` instead.

---

## sudo: Temporary Superuser Access

`sudo` (superuser do) lets authorized users run individual commands as root. It prompts for your password (not root's password), logs the action, and then executes the command with root privileges.

```bash
sudo ls /var/root               # list root's home directory
sudo cat /etc/sudoers           # view the sudoers config
sudo mkdir /opt/myapp           # create directory in protected location
```

### How sudo works

1. You type `sudo some-command`.
2. sudo checks `/etc/sudoers` to verify you are authorized.
3. sudo prompts for your password (cached for a few minutes).
4. sudo executes `some-command` as root.
5. The action is logged (typically in `/var/log/auth.log` on Linux or unified log on macOS).

### Common sudo usage

```bash
sudo -s                         # start a root shell (interactive)
sudo -i                         # start a root login shell (loads root's profile)
sudo -u postgres psql           # run command as a different user
sudo -k                         # expire cached credentials (force re-prompt)
sudo !!                         # re-run the last command with sudo (very handy)
```

### Why you should NOT run everything as root

- **No safety net.** `rm -rf /` as root destroys your entire system. As a normal user, you can only damage your own files.
- **Malware scope.** A compromised root process can install rootkits, modify system binaries, and hide its presence.
- **Audit trail.** Running as your own user provides accountability. `sudo` logs who did what and when.
- **Principle of least privilege.** Every process should run with the minimum permissions it needs.

---

## User Database: /etc/passwd

Despite the name, `/etc/passwd` does not contain passwords (those are in `/etc/shadow` on Linux, or managed by Directory Services on macOS). It is the user database.

```bash
cat /etc/passwd | head -5
```

Each line has seven colon-separated fields:

```
username:x:UID:GID:comment:home_directory:login_shell
```

Example:

```
augustus:x:501:20:Augustus Otu:/Users/augustus:/bin/zsh
nobody:x:65534:65534:Nobody:/nonexistent:/usr/bin/false
_postgres:x:216:216:PostgreSQL Server:/var/empty:/usr/bin/false
```

- `x` in the password field means the password is stored elsewhere.
- Users with `/usr/bin/false` or `/usr/sbin/nologin` as their shell cannot log in interactively — they are service accounts.

### Group database: /etc/group

```bash
cat /etc/group | head -10
```

Format: `groupname:x:GID:member1,member2,...`

```
staff:x:20:root
admin:x:80:augustus
docker:x:999:augustus
```

---

## Managing Users (Linux)

On Linux, you manage users with these commands:

```bash
sudo useradd -m -s /bin/bash newuser   # create user with home dir and bash shell
sudo passwd newuser                     # set password
sudo usermod -aG docker newuser         # add user to docker group (-a = append, -G = supplementary groups)
sudo userdel -r olduser                 # delete user and their home directory
```

### Managing users on macOS

macOS uses Directory Services instead of the standard Linux utilities. The command-line tool is `dscl`:

```bash
# List all users
dscl . list /Users

# Get info about a user
dscl . read /Users/augustus

# List user groups
dscl . list /Groups

# Check group membership
dscl . read /Groups/admin GroupMembership
```

For most purposes on macOS, you manage users through System Preferences (System Settings) rather than the command line. The important thing is understanding the concepts — they apply everywhere.

---

## File Ownership

Every file has an owner (user) and a group. When you create a file, you become the owner and your primary group becomes the file's group.

```bash
ls -la myfile.txt
# -rw-r--r--  1 augustus  staff  1024 Jan 15 10:00 myfile.txt
#                ^^^^^^^^  ^^^^^
#                owner     group
```

### Changing ownership

```bash
sudo chown otheruser file.txt           # change owner
sudo chown otheruser:developers file.txt # change owner and group
sudo chown :developers file.txt         # change group only
sudo chown -R augustus:staff project/    # recursive
chgrp developers file.txt              # change group only (may not need sudo if you're in the group)
```

### How group permissions work in practice

Scenario: You and three colleagues are working on a project.

```bash
# Admin creates a shared group (Linux)
sudo groupadd projectx
sudo usermod -aG projectx alice
sudo usermod -aG projectx bob
sudo usermod -aG projectx charlie

# Set up shared directory
sudo mkdir /opt/projectx
sudo chown :projectx /opt/projectx
sudo chmod 2775 /opt/projectx    # setgid ensures new files inherit the group
```

Now everyone in `projectx` can read and write files in `/opt/projectx`, and new files automatically belong to the `projectx` group.

---

## Service Accounts

Many system daemons run under dedicated service accounts. These accounts:
- Have no password (cannot log in)
- Have a non-interactive shell (`/usr/bin/false` or `/usr/sbin/nologin`)
- Own only the files they need
- Have minimal group memberships

Examples:

| Account | Service |
|---------|---------|
| `_postgres` or `postgres` | PostgreSQL database |
| `www-data` or `_www` | Web server (Apache/nginx) |
| `nobody` | Unprivileged catch-all |
| `_mysql` or `mysql` | MySQL database |
| `git` | Git hosting services |

This isolation means that if a service is compromised, the attacker only gets the permissions of that service account — not root access.

```bash
# See service accounts on macOS
dscl . list /Users | grep '^_'

# See service accounts on Linux
grep '/usr/sbin/nologin\|/bin/false' /etc/passwd
```

---

## Exercises

### Exercise 1: Inspect your user identity

```bash
# Who are you?
whoami

# Full identity
id

# What groups do you belong to?
groups

# Your home directory
echo $HOME

# Your shell
echo $SHELL

# Your entry in /etc/passwd
grep "^$(whoami):" /etc/passwd
```

### Exercise 2: Explore the user database

```bash
# How many user accounts exist?
# macOS:
dscl . list /Users | wc -l

# How many are service accounts (start with _)?
dscl . list /Users | grep '^_' | wc -l

# How many are real human accounts?
dscl . list /Users | grep -v '^_' | grep -v '^$'

# On Linux, you'd use:
# cat /etc/passwd | wc -l
# grep -c '/bin/bash\|/bin/zsh' /etc/passwd
```

### Exercise 3: Understand file ownership

```bash
# Create files and check ownership
touch /tmp/my-test-file
ls -la /tmp/my-test-file         # owned by you

# Check who owns system files
ls -la /etc/hosts                # owned by root
ls -la /usr/bin/git              # owned by root

# Check who owns your home directory
ls -la ~/
```

### Exercise 4: Practice with sudo

```bash
# Try reading a file you don't have permission for
cat /etc/sudoers 2>&1 || echo "Permission denied (expected)"

# Now with sudo
sudo cat /etc/sudoers | head -5

# Check sudo log (macOS)
log show --predicate 'process == "sudo"' --last 5m

# See the last time you used sudo
sudo -v                          # validate/extend credentials
sudo -k                          # expire credentials
```

### Exercise 5: Group membership investigation

```bash
# List all groups on the system
# macOS:
dscl . list /Groups

# Check if you're in the admin group (macOS)
dscl . read /Groups/admin GroupMembership

# Check if you're in the staff group (macOS)
dscl . read /Groups/staff GroupMembership

# On Linux:
# cat /etc/group | grep $(whoami)
```

---

Next: [Lesson 08 — Services and Daemons](./08-services-daemons.md)
