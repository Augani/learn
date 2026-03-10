# Lesson 11: SSH — Remote Access, Keys, Tunnels, Config

SSH (Secure Shell) is how you securely access remote machines, transfer files, and create encrypted tunnels. If you deploy to servers, connect to remote databases, or push to GitHub, you are using SSH.

---

## What SSH Does

SSH provides:
1. **Encrypted remote shell access** — run commands on another machine
2. **Secure file transfer** — SCP, SFTP, rsync over SSH
3. **Port forwarding / tunneling** — securely access remote services through encrypted channels
4. **Authentication** — verify identity with keys instead of passwords

Everything is encrypted. Unlike telnet or rsh (its predecessors), SSH prevents eavesdropping, man-in-the-middle attacks, and credential theft.

---

## Password vs Key-Based Authentication

### Password authentication

```bash
ssh user@server.example.com
# prompts for password
```

This works but has downsides:
- Passwords can be brute-forced
- You have to type it every time
- Passwords can be phished or intercepted if you use them elsewhere

### Key-based authentication (preferred)

SSH key pairs use public-key cryptography:
- **Private key** — stays on YOUR machine, never shared. Like a physical key to your house.
- **Public key** — placed on remote servers. Like the lock that accepts your key.

Anyone with the lock (public key) can verify you have the key, but cannot derive the key from the lock. This is fundamentally more secure than passwords.

---

## Generating SSH Keys

```bash
ssh-keygen -t ed25519 -C "augustus@example.com"
```

- `-t ed25519` — Use the Ed25519 algorithm (modern, fast, secure). Fallback: `-t rsa -b 4096` for older systems.
- `-C` — Comment, typically your email. Just a label.

You will be prompted:
1. **File location** — Default `~/.ssh/id_ed25519` is fine. Use a custom name if you have multiple keys.
2. **Passphrase** — Encrypts your private key on disk. Recommended. Without it, anyone who accesses your private key file can impersonate you.

This creates two files:
- `~/.ssh/id_ed25519` — Private key. Permissions should be `600` (only you can read).
- `~/.ssh/id_ed25519.pub` — Public key. Safe to share.

```bash
ls -la ~/.ssh/
cat ~/.ssh/id_ed25519.pub        # this is what you paste into GitHub, servers, etc.
```

### Setting up key-based auth on a server

```bash
ssh-copy-id user@server.example.com
```

This copies your public key to the server's `~/.ssh/authorized_keys`. Now you can SSH without a password.

If `ssh-copy-id` is not available:

```bash
cat ~/.ssh/id_ed25519.pub | ssh user@server "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

For GitHub/GitLab, paste your public key in the web settings.

---

## ssh-agent: Key Management

`ssh-agent` keeps your private key decrypted in memory so you do not have to type your passphrase every time.

```bash
eval "$(ssh-agent -s)"           # start the agent
ssh-add ~/.ssh/id_ed25519        # add your key (prompts for passphrase once)
ssh-add -l                       # list keys loaded in the agent
```

On macOS, the Keychain integrates with ssh-agent. Add this to `~/.ssh/config`:

```
Host *
    AddKeysToAgent yes
    UseKeychain yes
    IdentityFile ~/.ssh/id_ed25519
```

Now macOS will:
- Automatically add keys to the agent
- Store the passphrase in Keychain (so you never type it again)
- Load the key when needed

---

## ~/.ssh/config: Host Configuration

The SSH config file lets you create aliases and set per-host options. This is where SSH becomes truly convenient.

```bash
# ~/.ssh/config

Host github
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519

Host prod
    HostName 10.0.1.50
    User deploy
    IdentityFile ~/.ssh/deploy_key
    Port 2222

Host staging
    HostName staging.example.com
    User deploy
    IdentityFile ~/.ssh/deploy_key
    ForwardAgent yes

Host dev-*
    User augustus
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3

Host dev-web
    HostName 10.0.2.10

Host dev-api
    HostName 10.0.2.11

Host dev-db
    HostName 10.0.2.12
```

Now instead of typing:

```bash
ssh -i ~/.ssh/deploy_key -p 2222 deploy@10.0.1.50
```

You just type:

```bash
ssh prod
```

Common config options:

| Option | Purpose |
|--------|---------|
| `HostName` | Actual hostname or IP |
| `User` | Username on the remote server |
| `Port` | SSH port (default: 22) |
| `IdentityFile` | Which private key to use |
| `ForwardAgent` | Forward your SSH agent to the remote (use carefully) |
| `ServerAliveInterval` | Send keepalive every N seconds (prevents timeout) |
| `ProxyJump` | Jump through another host |
| `LocalForward` | Set up port forwarding |

---

## SSH Tunnels: Port Forwarding

SSH tunnels let you securely access services that are not directly reachable — like a database behind a firewall.

**The analogy:** An SSH tunnel is like a secret passage through a castle wall. The database is inside the castle (private network). You cannot reach it directly. But if you have SSH access to a machine inside the castle, you can create a tunnel from your laptop through that machine to the database.

### Local port forwarding (-L)

"Make a remote service available on my local machine."

```bash
ssh -L 5433:localhost:5432 prod
```

This means: "On my local port 5433, forward connections through the SSH connection to localhost:5432 on the remote machine."

```
Your laptop:5433 ──SSH tunnel──> prod server ──> localhost:5432 (PostgreSQL)
```

Now you can connect to the remote PostgreSQL as if it were local:

```bash
psql -h localhost -p 5433 -U myuser mydb
```

More examples:

```bash
# Access a remote web app
ssh -L 8080:localhost:3000 staging
# Now visit http://localhost:8080 in your browser

# Access a database on a DIFFERENT server (not the SSH host)
ssh -L 5433:db-server.internal:5432 bastion
# Tunnel goes: laptop:5433 → bastion → db-server.internal:5432

# Background tunnel (no shell, just forwarding)
ssh -N -f -L 5433:localhost:5432 prod
# -N = no remote command
# -f = go to background
```

### Remote port forwarding (-R)

"Make my local service available on the remote machine."

```bash
ssh -R 8080:localhost:3000 remote-server
```

This exposes your local port 3000 on the remote server's port 8080. Useful for showing a local development server to someone on the remote network.

### Dynamic port forwarding (-D)

Creates a SOCKS proxy through the SSH connection:

```bash
ssh -D 1080 remote-server
```

Configure your browser to use `localhost:1080` as a SOCKS proxy, and all traffic goes through the SSH connection. This is how you browse the web through a remote server.

---

## File Transfer: SCP and rsync

### SCP (Secure Copy)

```bash
scp file.txt user@server:/path/to/destination/
scp user@server:/remote/file.txt ./local/
scp -r directory/ user@server:/path/
```

### rsync (recommended over SCP)

rsync is smarter — it only transfers changed bytes, supports compression, and can resume interrupted transfers.

```bash
rsync -avz ./local/dir/ user@server:/remote/dir/
rsync -avz user@server:/remote/dir/ ./local/dir/
rsync -avz --delete ./src/ user@server:/deploy/src/   # mirror (delete files not in source)
rsync -avz --exclude '.git' --exclude 'node_modules' ./project/ server:/deploy/
```

Flags:
- `-a` — Archive mode (preserves permissions, timestamps, symlinks)
- `-v` — Verbose
- `-z` — Compress during transfer
- `--delete` — Remove files on destination that don't exist in source
- `--exclude` — Skip matching files
- `--dry-run` — Show what would be transferred without actually doing it

**Note the trailing slash on directories.** `dir/` means "contents of dir." `dir` (no slash) means "the directory itself." This distinction matters for rsync.

---

## Jump Hosts / Bastion Hosts

In production environments, servers are often behind a firewall with no direct SSH access. You connect through a jump host (bastion host) that sits in a DMZ.

```
Your laptop → bastion (public IP) → internal-server (private IP)
```

### Using ProxyJump

```bash
ssh -J bastion.example.com internal-server.private
```

In `~/.ssh/config`:

```
Host bastion
    HostName bastion.example.com
    User augustus

Host internal-*
    ProxyJump bastion
    User deploy

Host internal-web
    HostName 10.0.1.10

Host internal-api
    HostName 10.0.1.11
```

Now:

```bash
ssh internal-web                 # automatically jumps through bastion
scp file.txt internal-api:/tmp/  # file transfer through bastion
```

### Tunneling through a bastion

```bash
ssh -L 5433:db.internal:5432 -J bastion.example.com db.internal
```

This creates: `laptop:5433 → bastion → db.internal:5432`

---

## Security Best Practices

1. **Use Ed25519 keys** — stronger and faster than RSA
2. **Always use a passphrase** on your private key
3. **Use ssh-agent** to avoid typing the passphrase repeatedly
4. **Never share your private key** — if compromised, generate a new pair
5. **Use `~/.ssh/config`** — avoid typing sensitive info in command history
6. **Set correct permissions:**

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519     # private key: owner read/write only
chmod 644 ~/.ssh/id_ed25519.pub # public key: readable by all
chmod 600 ~/.ssh/config          # config: owner only
chmod 600 ~/.ssh/authorized_keys # authorized keys: owner only
```

---

## Exercises

### Exercise 1: Generate and inspect SSH keys

```bash
# Generate a key (if you don't have one)
ls ~/.ssh/id_ed25519 2>/dev/null || ssh-keygen -t ed25519 -C "your@email.com"

# Inspect your keys
ls -la ~/.ssh/

# View your public key
cat ~/.ssh/id_ed25519.pub

# Check permissions
stat -f "%Sp %SN" ~/.ssh/id_ed25519   # macOS: should be -rw-------
```

### Exercise 2: Set up SSH config

Create or edit `~/.ssh/config`:

```bash
cat >> ~/.ssh/config <<'EOF'

Host github.com
    IdentityFile ~/.ssh/id_ed25519
    AddKeysToAgent yes
    UseKeychain yes
EOF

chmod 600 ~/.ssh/config

# Test GitHub SSH connection
ssh -T git@github.com
```

### Exercise 3: SSH agent

```bash
# Check if agent is running
ssh-add -l 2>/dev/null || eval "$(ssh-agent -s)"

# Add your key
ssh-add ~/.ssh/id_ed25519

# List loaded keys
ssh-add -l

# Check fingerprint matches your key
ssh-keygen -lf ~/.ssh/id_ed25519.pub
```

### Exercise 4: Local port forwarding (if you have a remote server)

```bash
# If you have a remote server with PostgreSQL:
ssh -N -L 5433:localhost:5432 your-server &
TUNNEL_PID=$!

# Connect to remote Postgres through the tunnel
psql -h localhost -p 5433 -U postgres

# When done, kill the tunnel
kill $TUNNEL_PID
```

If you do not have a remote server, you can practice with localhost:

```bash
# Start a simple server
python3 -m http.server 9999 &
SERVER_PID=$!

# Create a tunnel to yourself (demonstrating the concept)
ssh -N -L 8888:localhost:9999 localhost &
TUNNEL_PID=$!

# Access through the tunnel
curl http://localhost:8888

# Clean up
kill $SERVER_PID $TUNNEL_PID
```

### Exercise 5: rsync practice

```bash
# Create test directories
mkdir -p /tmp/rsync-source /tmp/rsync-dest
echo "file 1" > /tmp/rsync-source/a.txt
echo "file 2" > /tmp/rsync-source/b.txt
echo "file 3" > /tmp/rsync-source/c.txt

# Sync
rsync -avz /tmp/rsync-source/ /tmp/rsync-dest/

# Modify source
echo "modified" > /tmp/rsync-source/a.txt
echo "new file" > /tmp/rsync-source/d.txt

# Sync again (only changes transfer)
rsync -avz /tmp/rsync-source/ /tmp/rsync-dest/

# Verify
diff <(ls /tmp/rsync-source) <(ls /tmp/rsync-dest)

# Clean up
rm -rf /tmp/rsync-source /tmp/rsync-dest
```

---

Next: [Lesson 12 — Debugging Tools](./12-debugging-tools.md)
