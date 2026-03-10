# Lesson 15: Networking on Linux — Ports, Interfaces, Firewalls

Every time your application accepts an HTTP request, connects to a database, or calls an external API, it is using the network. Understanding how networking works at the OS level helps you debug connection issues, configure services, and secure your systems.

---

## Network Interfaces

A network interface is a point of connection between your computer and a network. You can think of it as a port (in the physical sense) on your computer.

```bash
# macOS
ifconfig

# Linux (modern)
ip addr

# Linux (legacy, also works on macOS)
ifconfig
```

### Common interfaces

| Interface | Purpose |
|-----------|---------|
| `lo` / `lo0` | Loopback — talking to yourself (127.0.0.1) |
| `eth0` / `en0` | Ethernet (wired) |
| `wlan0` / `en1` | Wi-Fi |
| `docker0` | Docker bridge network |
| `veth*` | Virtual ethernet (Docker containers) |
| `utun*` | VPN tunnel interfaces (macOS) |

The loopback interface (`lo0` on macOS, `lo` on Linux) is special. Traffic on `127.0.0.1` never leaves your machine — it goes directly from one process to another through the kernel. When you run a server on `localhost:8080`, traffic stays entirely within your computer.

---

## IP Addresses, Subnets, and Gateways

### IP addresses

Every interface can have one or more IP addresses. These identify your machine on the network.

```bash
# Your current IP addresses
# macOS:
ifconfig | grep "inet "

# Linux:
ip addr | grep "inet "

# Just your primary private IP
ipconfig getifaddr en0            # macOS
hostname -I                       # Linux
```

### Private vs public IPs

Private IP ranges (used on local networks, not routable on the internet):
- `10.0.0.0/8` — large networks
- `172.16.0.0/12` — medium networks
- `192.168.0.0/16` — home/small office (most common)

Your router has a public IP from your ISP. Devices on your network have private IPs. The router translates between them (NAT).

### Subnet masks

A subnet mask defines which part of an IP address identifies the network and which part identifies the host.

`192.168.1.0/24` means:
- First 24 bits (192.168.1) = network
- Last 8 bits (.0 to .255) = host
- 254 usable addresses (192.168.1.1 through 192.168.1.254)

### Default gateway

The gateway is the router that connects your local network to other networks (including the internet).

```bash
# macOS
netstat -rn | grep default
route -n get default             # detailed

# Linux
ip route | grep default
```

---

## Ports: Multiplexing Connections

An IP address identifies a machine. A port identifies a specific service on that machine. Together they form a socket address: `192.168.1.10:8080`.

Ports range from 0 to 65535:
- **0-1023** — Well-known/privileged ports. Require root to bind. HTTP (80), HTTPS (443), SSH (22), PostgreSQL (5432).
- **1024-49151** — Registered ports. Common applications.
- **49152-65535** — Dynamic/ephemeral ports. Used for outgoing connections.

### What "listening" means

When a server "listens on port 8080," it tells the kernel: "Send me any TCP connections arriving at port 8080." The kernel routes incoming packets to the correct process based on the port number.

```bash
# What's listening on your machine?
lsof -i -P -n | grep LISTEN     # macOS (best option)
sudo lsof -i -P -n | grep LISTEN  # shows everything including root processes
netstat -an | grep LISTEN        # macOS/Linux
ss -tlnp                         # Linux only (faster)
```

### Binding to specific addresses

A server can bind to:
- `0.0.0.0:8080` — All interfaces (accessible from network)
- `127.0.0.1:8080` — Loopback only (accessible only from this machine)
- `192.168.1.10:8080` — A specific interface

This is why some services are "not reachable from other machines" — they are bound to `127.0.0.1`.

---

## DNS Resolution

DNS translates human-readable domain names to IP addresses.

### How resolution works

1. Your program calls `getaddrinfo("example.com")`
2. The resolver checks `/etc/hosts` for a local override
3. If not found, it queries the configured DNS server
4. DNS server returns the IP address
5. Your program connects to the IP

### Configuration files

```bash
# Local hostname overrides
cat /etc/hosts
# 127.0.0.1  localhost
# 127.0.0.1  myapp.local

# DNS server configuration (Linux)
cat /etc/resolv.conf

# DNS configuration (macOS)
scutil --dns | head -20
```

### DNS tools

```bash
# Simple lookup
nslookup example.com

# Detailed lookup
dig example.com

# Even simpler
host example.com

# What IP will your system actually use?
getent hosts example.com         # Linux
dscacheutil -q host -a name example.com  # macOS
```

### Useful /etc/hosts entries for development

```
127.0.0.1  api.local
127.0.0.1  app.local
127.0.0.1  db.local
```

This lets you use `http://api.local:8080` instead of `http://localhost:8080`, which is useful when developing multiple services.

---

## HTTP Tools: curl and wget

### curl

`curl` is the Swiss Army knife for HTTP.

```bash
curl http://localhost:8080                # GET request
curl -v http://localhost:8080             # verbose (show headers, TLS handshake)
curl -s http://localhost:8080             # silent (no progress bar)
curl -o file.html http://example.com     # save to file
curl -I http://example.com               # headers only (HEAD request)

# POST with JSON
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Augustus", "email": "aug@example.com"}'

# POST form data
curl -X POST http://localhost:8080/login \
  -d "username=admin&password=secret"

# Custom headers
curl -H "Authorization: Bearer TOKEN" http://localhost:8080/api/me

# Follow redirects
curl -L http://example.com

# With timeout
curl --connect-timeout 5 --max-time 10 http://slow-server.com

# Show timing information
curl -w "\nDNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" -o /dev/null -s http://example.com
```

### wget

```bash
brew install wget                # install on macOS
wget http://example.com/file.tar.gz      # download file
wget -q -O- http://example.com          # quiet, output to stdout (like curl)
wget --mirror http://example.com        # download entire site
```

---

## netcat (nc): The Network Swiss Army Knife

`netcat` creates raw TCP/UDP connections. Useful for testing whether a port is open, sending raw data, and simple client-server communication.

```bash
# Check if a port is open
nc -zv localhost 8080            # -z = scan only, -v = verbose

# Simple server (listen on port 9999)
nc -l 9999
# In another terminal:
nc localhost 9999
# Now type messages — they appear on the other side

# Send data to a port
echo "Hello" | nc localhost 9999

# Port scanning
nc -zv server.example.com 20-100   # scan ports 20-100
```

---

## Firewalls

Firewalls control which network connections are allowed in and out.

### Linux: iptables / nftables

`iptables` is the traditional Linux firewall. `nftables` is its modern replacement, but `iptables` syntax is still widely used.

```bash
# List current rules
sudo iptables -L -n -v

# Allow incoming SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow incoming HTTP and HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow established connections
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Block everything else
sudo iptables -A INPUT -j DROP
```

Many Linux servers use `ufw` (Uncomplicated Firewall) as a simpler frontend:

```bash
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

### macOS: pf (Packet Filter)

macOS uses `pf`, inherited from OpenBSD. Most users never need to touch it because macOS's application-level firewall (System Settings > Network > Firewall) handles typical cases.

```bash
# Check if pf is enabled
sudo pfctl -s info

# Show rules
sudo pfctl -s rules
```

For development on macOS, you rarely need to configure the firewall manually.

---

## Common Networking Scenarios

### "Connection refused" — Nothing is listening

```bash
# Check if anything is listening on the port
lsof -i :8080
# If empty: no server is running on that port
# Fix: start the server
```

### "Address already in use" — Port is taken

```bash
# Find what's using the port
lsof -i :8080
# Kill it or use a different port
```

### "Connection timed out" — Firewall or routing issue

```bash
# Can you reach the host at all?
ping server.example.com

# Can you reach the specific port?
nc -zv -w 5 server.example.com 8080

# Trace the network path
traceroute server.example.com
```

### "Name resolution failed" — DNS issue

```bash
# Can you resolve the hostname?
nslookup server.example.com
dig server.example.com

# Try with a specific DNS server
dig @8.8.8.8 server.example.com

# Check /etc/hosts for overrides
grep server.example.com /etc/hosts
```

---

## Exercises

### Exercise 1: Explore your network configuration

```bash
# Your interfaces and IPs
ifconfig | grep -E "^[a-z]|inet "    # macOS

# Your default gateway
netstat -rn | grep default

# Your DNS servers
scutil --dns | grep nameserver       # macOS

# Your public IP (if connected to internet)
curl -s https://ifconfig.me
```

### Exercise 2: Port scanning and listening

```bash
# See all listening ports
lsof -i -P -n | grep LISTEN

# Start a test server
python3 -m http.server 7777 &
SERVER_PID=$!

# Verify it's listening
lsof -i :7777
nc -zv localhost 7777

# Test the connection
curl -s http://localhost:7777

# Clean up
kill $SERVER_PID
```

### Exercise 3: DNS investigation

```bash
# Look up github.com
nslookup github.com
dig github.com
host github.com

# Check your /etc/hosts
cat /etc/hosts

# Time a DNS lookup
time nslookup example.com
```

### Exercise 4: curl timing

```bash
# Measure connection timing to a website
curl -w "\n---Timing---\nDNS Lookup:    %{time_namelookup}s\nTCP Connect:   %{time_connect}s\nTLS Handshake: %{time_appconnect}s\nFirst Byte:    %{time_starttransfer}s\nTotal:         %{time_total}s\n" -o /dev/null -s https://github.com
```

### Exercise 5: netcat communication

```bash
# Terminal 1: Start a listener
nc -l 5555

# Terminal 2: Connect to it
nc localhost 5555

# Type messages in either terminal — they appear on the other
# Press Ctrl+C to stop
```

---

Next: [Lesson 16 — Disk, Filesystems, and Storage](./16-disk-storage.md)
