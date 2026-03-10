# Container Security Hardening

## The Apartment Security Analogy

Container security is like apartment building security. Each layer adds protection:

- **Lock your door** (run as non-root) — don't leave the apartment door wide open for anyone to walk in
- **Don't let strangers in** (network policies) — the building has a buzzer system; only authorized visitors get in
- **Limit what each tenant can do** (drop capabilities) — tenants can rearrange furniture but can't knock down walls
- **Security guard at the entrance** (seccomp profiles) — checks IDs and prevents known troublemakers from entering
- **Building fire code compliance** (Docker Bench) — regular inspections ensure everything meets safety standards
- **Don't give tenants the master key** (least privilege) — each tenant gets a key to their unit, not the maintenance closet

A single unlocked door can compromise the entire building.

---

## Running as Non-Root

By default, containers run as root. Inside the container, root is UID 0. If an attacker breaks out of the container, they're root on the host.

### The Problem

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci --production
CMD ["node", "server.js"]
```

```bash
docker run --rm myapp whoami
```

```
root
```

Your Node.js server runs as root. If someone exploits a vulnerability in your app, they have root access inside the container and potentially to the host via container escape exploits.

### The Fix: USER Instruction

```dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY . .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker run --rm myapp whoami
```

```
appuser
```

### Go Application (Distroless)

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /server .

FROM gcr.io/distroless/static-debian12
COPY --from=builder /server /server
USER nonroot
ENTRYPOINT ["/server"]
```

Distroless images include a `nonroot` user (UID 65532) built in.

### Scratch Image

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /server .

FROM scratch
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /server /server
USER 65534
ENTRYPOINT ["/server"]
```

UID 65534 is conventionally `nobody`. With scratch images, you need to copy `/etc/passwd` from the builder.

### Gotchas with Non-Root

**Binding to privileged ports:**

Non-root users can't bind to ports below 1024:

```bash
docker run --user 1000 nginx:alpine
```

```
nginx: [emerg] bind() to 0.0.0.0:80 failed (13: Permission denied)
```

Solutions:
- Use ports above 1024 (e.g., 8080 instead of 80)
- Use `--cap-add NET_BIND_SERVICE` (adds just the one capability needed)
- Map ports externally: `-p 80:8080`

**Writing to directories:**

Non-root users can't write to root-owned directories:

```bash
docker run --user 1000 -v mydata:/data alpine touch /data/test.txt
```

```
touch: /data/test.txt: Permission denied
```

Set ownership during image build:

```dockerfile
RUN mkdir -p /data && chown 1000:1000 /data
USER 1000
```

---

## Read-Only Filesystems

Make the container's filesystem read-only. If an attacker gets in, they can't write malware, scripts, or config changes.

```bash
docker run --read-only --tmpfs /tmp:size=10m myapp
```

The container can only write to explicitly mounted volumes and tmpfs.

In Compose:

```yaml
services:
  api:
    build: ./api
    read_only: true
    tmpfs:
      - /tmp:size=10m
      - /run:size=5m
    volumes:
      - upload-data:/app/uploads
```

The application can write to:
- `/tmp` (tmpfs, in memory)
- `/run` (tmpfs, for PID files)
- `/app/uploads` (named volume, persistent)

Everything else is read-only. An attacker can't modify the application code, install tools, or create cron jobs.

### Common Read-Only Issues

**Node.js needs a writable `/tmp` for some operations:**

```yaml
services:
  api:
    read_only: true
    tmpfs:
      - /tmp:size=50m
```

**Nginx needs writable cache/pid directories:**

```yaml
services:
  nginx:
    image: nginx:alpine
    read_only: true
    tmpfs:
      - /tmp:size=10m
      - /var/cache/nginx:size=50m
      - /var/run:size=5m
```

**PostgreSQL needs writable data directory:**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    read_only: true
    tmpfs:
      - /tmp:size=50m
      - /run/postgresql:size=5m
    volumes:
      - pgdata:/var/lib/postgresql/data
```

---

## Dropping Capabilities

Linux capabilities split root's superpowers into granular permissions. By default, Docker containers get a subset of capabilities. You should drop the ones you don't need.

### Default Docker Capabilities

```bash
docker run --rm alpine cat /proc/1/status | grep Cap
```

```
CapPrm: 00000000a80425fb
CapEff: 00000000a80425fb
```

Decode them:

```bash
docker run --rm alpine sh -c "apk add -q libcap && capsh --decode=00000000a80425fb"
```

```
0x00000000a80425fb=cap_chown,cap_dac_override,cap_fowner,cap_fsetid,
cap_kill,cap_setgid,cap_setuid,cap_setpcap,cap_net_bind_service,
cap_net_raw,cap_sys_chroot,cap_mknod,cap_audit_write,cap_setfcap
```

Most applications need almost none of these.

### Drop All, Add Back What You Need

```bash
docker run --cap-drop ALL --cap-add NET_BIND_SERVICE myapp
```

In Compose:

```yaml
services:
  api:
    build: ./api
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

### Common Capability Requirements

| Capability | What It Does | Who Needs It |
|-----------|-------------|-------------|
| `NET_BIND_SERVICE` | Bind to ports < 1024 | Web servers on port 80/443 |
| `CHOWN` | Change file ownership | Init processes |
| `SETGID` / `SETUID` | Change user/group IDs | Processes that drop privileges |
| `NET_RAW` | Raw socket access | Ping, network diagnostics |
| `SYS_PTRACE` | Process tracing | Debuggers (never in production) |

A typical web API needs NO capabilities if it runs as non-root on a port above 1024.

### What Capabilities Prevent

Without `NET_RAW`, an attacker can't ARP spoof or sniff network traffic. Without `SYS_ADMIN`, they can't mount filesystems or manipulate cgroups. Without `SYS_PTRACE`, they can't attach to other processes.

---

## Seccomp Profiles

Seccomp (Secure Computing Mode) filters which system calls a container can make. It's the security guard checking IDs.

Docker's default seccomp profile blocks about 44 system calls, including:
- `reboot` — can't reboot the host
- `mount` — can't mount filesystems
- `ptrace` — can't trace other processes
- `add_key` / `keyctl` — can't access kernel keyrings

### Custom Seccomp Profile

Create a strict profile that only allows what your app needs:

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64"],
  "syscalls": [
    {
      "names": [
        "accept", "accept4", "bind", "close", "connect",
        "epoll_create1", "epoll_ctl", "epoll_wait",
        "exit_group", "fcntl", "fstat", "futex",
        "getpeername", "getpid", "getsockname", "getsockopt",
        "listen", "mmap", "mprotect", "nanosleep",
        "openat", "read", "recvfrom", "recvmsg",
        "rt_sigaction", "rt_sigprocmask", "sendmsg", "sendto",
        "setsockopt", "socket", "write", "writev",
        "clone", "execve", "set_tid_address", "arch_prctl",
        "brk", "access", "pipe2", "getrandom", "statx",
        "newfstatat", "pread64", "sigaltstack"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

Apply it:

```bash
docker run --security-opt seccomp=myprofile.json myapp
```

In Compose:

```yaml
services:
  api:
    build: ./api
    security_opt:
      - seccomp:./seccomp-profile.json
```

### Generating Seccomp Profiles

Manually listing syscalls is tedious. Use a tool to generate profiles from observed behavior:

```bash
docker run --security-opt seccomp=unconfined \
  --label seccomp-profile-recorder \
  myapp
```

Then use tools like `oci-seccomp-bpf-hook` or Inspektor Gadget to record which syscalls your container actually uses, and generate a minimal profile.

### No Seccomp (Dangerous)

```bash
docker run --security-opt seccomp=unconfined myapp
```

This disables seccomp entirely. Only use this for debugging, never in production.

---

## AppArmor and SELinux

AppArmor (Ubuntu/Debian) and SELinux (RHEL/CentOS) provide Mandatory Access Control — rules about what files, networks, and capabilities a process can access.

### AppArmor

Docker applies a default AppArmor profile (`docker-default`) that:
- Prevents writing to `/proc` and `/sys`
- Prevents mounting filesystems
- Prevents accessing raw devices

Custom AppArmor profile:

```
#include <tunables/global>

profile docker-myapp flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>

  network inet tcp,
  network inet udp,

  /app/** r,
  /app/uploads/** rw,
  /tmp/** rw,

  deny /etc/shadow r,
  deny /proc/*/mem rw,
}
```

Apply it:

```bash
sudo apparmor_parser -r -W myapp-profile

docker run --security-opt apparmor=docker-myapp myapp
```

### SELinux

On SELinux-enabled systems, Docker containers run with the `container_t` SELinux type by default.

```bash
docker run --security-opt label=type:container_t myapp
```

For stricter isolation, use custom SELinux types.

---

## Resource Limits

Without resource limits, a single container can consume all CPU and memory on the host, starving other containers and the host OS.

### Memory Limits

```bash
docker run -d --memory 512m --memory-swap 512m myapp
```

`--memory 512m` — hard limit of 512MB RAM
`--memory-swap 512m` — same as memory (no swap allowed)

If the container exceeds the memory limit, Docker kills it (OOM killed).

In Compose:

```yaml
services:
  api:
    build: ./api
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 128M
```

### CPU Limits

```bash
docker run -d --cpus 1.5 myapp
```

The container can use at most 1.5 CPU cores.

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: "1.5"
        reservations:
          cpus: "0.25"
```

### PID Limits

Prevent fork bombs:

```bash
docker run -d --pids-limit 100 myapp
```

The container can have at most 100 processes. A `:(){ :|:& };:` inside the container is neutralized.

### Why Limits Matter

Without memory limits, a memory leak in one container can trigger the host's OOM killer, which might kill OTHER containers or system processes. Set limits on every container in production.

In Go terms, it's like setting `GOMEMLIMIT` — you explicitly state the resource budget rather than hoping for the best.

---

## Docker Bench for Security

Docker Bench is an automated security audit tool. It checks your Docker installation against CIS (Center for Internet Security) benchmarks.

```bash
docker run --rm --net host --pid host --userns host --cap-add audit_control \
  -e DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST \
  -v /etc:/etc:ro \
  -v /var/lib:/var/lib:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  docker/docker-bench-security
```

Sample output:

```
[INFO] 1 - Host Configuration
[PASS] 1.1  - Ensure a separate partition for containers has been created
[WARN] 1.2  - Ensure only trusted users are allowed to control Docker daemon
[PASS] 1.3  - Ensure auditing is configured for Docker files and directories

[INFO] 4 - Container Images and Build File
[WARN] 4.1  - Ensure a user for the container has been created
[WARN] 4.2  - Ensure that containers use only trusted base images
[PASS] 4.3  - Ensure that unnecessary packages are not installed in the container
[WARN] 4.5  - Ensure Content trust for Docker is Enabled

[INFO] 5 - Container Runtime
[WARN] 5.1  - Ensure that, if applicable, an AppArmor Profile is enabled
[WARN] 5.2  - Ensure that, if applicable, SELinux security options are set
[PASS] 5.3  - Ensure that Linux kernel capabilities are restricted within containers
[WARN] 5.4  - Ensure that privileged containers are not used
```

Fix every `[WARN]` for production deployments.

---

## The Principle of Least Privilege

Every security measure follows one principle: give containers ONLY the permissions they need to function. Nothing more.

| Permission | Default | Hardened |
|-----------|---------|---------|
| User | root (UID 0) | non-root (UID 65534) |
| Filesystem | read-write | read-only + specific tmpfs/volumes |
| Capabilities | 14 capabilities | DROP ALL, add only needed |
| Syscalls | ~300+ allowed | Custom seccomp with ~50 allowed |
| Network | Full access | Specific ports and networks only |
| Resources | Unlimited | CPU, memory, PID limits |

---

## Before and After: Hardening a Real Container

### Before (Insecure)

```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "server.js"]
```

```yaml
services:
  api:
    build: .
    ports:
      - "3000:3000"
```

Problems:
1. Runs as root
2. Full Node.js image (900MB, huge attack surface)
3. Read-write filesystem
4. All default capabilities
5. No resource limits
6. No health check
7. `npm install` (not `npm ci`, includes devDependencies)

### After (Hardened)

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs20-debian12

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

USER nonroot

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "const h=require('http');h.get('http://localhost:8080/health',(r)=>{process.exit(r.statusCode===200?0:1)})"]

CMD ["dist/server.js"]
```

```yaml
services:
  api:
    build: .
    ports:
      - "8080:8080"
    read_only: true
    tmpfs:
      - /tmp:size=10m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 256M
        reservations:
          cpus: "0.25"
          memory: 64M
    healthcheck:
      test: ["CMD", "/nodejs/bin/node", "-e", "const h=require('http');h.get('http://localhost:8080/health',(r)=>{process.exit(r.statusCode===200?0:1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
    restart: unless-stopped
```

What changed:

| Aspect | Before | After |
|--------|--------|-------|
| Base image | node:20 (900MB) | distroless (130MB) |
| User | root | nonroot |
| Filesystem | read-write | read-only |
| Capabilities | 14 | 0 |
| Privilege escalation | Possible | Blocked (no-new-privileges) |
| Resource limits | None | 1 CPU, 256MB |
| Health check | None | HTTP check every 30s |
| Shell access | Yes | No (distroless has no shell) |

### Go Application Hardened

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o /server .

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /server /server

USER 65534

EXPOSE 8080
ENTRYPOINT ["/server"]
```

```yaml
services:
  api:
    build: .
    ports:
      - "8080:8080"
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 512M
    restart: unless-stopped
```

This is about as hardened as a container can get:
- `scratch` base: no OS, no shell, no package manager, no utilities
- UID 65534: runs as nobody
- Read-only: can't write to filesystem at all
- No capabilities: can't do anything privileged
- `no-new-privileges`: processes can't gain elevated permissions
- Resource limits: can't starve the host

---

## no-new-privileges

The `no-new-privileges` flag prevents processes inside the container from gaining additional privileges through setuid binaries, filesystem capabilities, or other mechanisms.

```yaml
services:
  api:
    security_opt:
      - no-new-privileges:true
```

Without this, an attacker who finds a setuid binary inside the container can escalate to root. With it, even setuid binaries run with the current user's privileges.

Think of it as a one-way ratchet: privileges can only decrease, never increase.

---

## Network Security

### Limit Container Network Access

```yaml
services:
  api:
    networks:
      - frontend
      - backend

  postgres:
    networks:
      - backend

networks:
  frontend:
  backend:
    internal: true
```

The database has no internet access (`internal: true`). Only containers on the `backend` network can reach it.

### Disable Inter-Container Communication

By default, containers on the same bridge can communicate freely. Disable it:

```bash
docker network create --opt com.docker.network.bridge.enable_icc=false restricted
```

Containers on this network can't talk to each other unless explicitly linked.

---

## Security Scanning Checklist

Run through this before every production deployment:

```bash
trivy image --severity HIGH,CRITICAL myapp:latest

docker run --rm -v /var/run/docker.sock:/var/run/docker.sock:ro \
  docker/docker-bench-security

docker inspect myapp:latest | jq '.[0].Config.User'

docker inspect myapp:latest | jq '.[0].Config.Healthcheck'

docker history myapp:latest
```

### Automated Security Checks

```yaml
name: Security Audit

on:
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t myapp:audit .

      - name: Check for root user
        run: |
          USER=$(docker inspect myapp:audit | jq -r '.[0].Config.User')
          if [ "$USER" = "" ] || [ "$USER" = "root" ] || [ "$USER" = "0" ]; then
            echo "ERROR: Container runs as root!"
            exit 1
          fi

      - name: Check for health check
        run: |
          HC=$(docker inspect myapp:audit | jq '.[0].Config.Healthcheck')
          if [ "$HC" = "null" ]; then
            echo "WARNING: No health check defined"
          fi

      - name: Vulnerability scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:audit
          exit-code: 1
          severity: CRITICAL

      - name: Check image size
        run: |
          SIZE=$(docker image inspect myapp:audit --format='{{.Size}}')
          MAX_SIZE=$((500 * 1024 * 1024))
          if [ "$SIZE" -gt "$MAX_SIZE" ]; then
            echo "WARNING: Image is $(($SIZE / 1024 / 1024))MB (max: 500MB)"
          fi
```

---

## Exercises

### Exercise 1: Harden an Existing Container

Take this Dockerfile and compose file. Apply every hardening measure from this lesson:

```dockerfile
FROM python:3.12
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "app.py"]
```

```yaml
services:
  api:
    build: .
    ports:
      - "5000:5000"
```

Your hardened version should:
- Run as non-root
- Use a minimal base image
- Have a read-only filesystem
- Drop all capabilities
- Set resource limits
- Include a health check

### Exercise 2: Capability Exploration

1. Run a container with all capabilities and verify you can perform privileged operations
2. Drop ALL capabilities and observe what fails
3. Add back capabilities one at a time until your application works
4. Document the minimum set of capabilities needed

```bash
docker run --cap-drop ALL alpine ping -c 1 google.com

docker run --cap-drop ALL --cap-add NET_RAW alpine ping -c 1 google.com
```

### Exercise 3: Docker Bench Audit

Run Docker Bench for Security on your Docker host. Fix every warning that's applicable to your environment. Document what you changed and why.

### Exercise 4: Seccomp Profile

1. Run your application with `--security-opt seccomp=unconfined` and log the syscalls it makes
2. Create a custom seccomp profile that allows ONLY those syscalls
3. Verify the application runs normally with the custom profile
4. Test that blocked syscalls actually fail

### Exercise 5: Complete Security Review

Take a multi-service docker-compose application and perform a full security review:
1. Check all images for root user
2. Verify health checks exist
3. Confirm resource limits are set
4. Ensure read-only filesystems where possible
5. Verify network isolation between services
6. Scan all images for vulnerabilities
7. Check that no secrets are baked into images

---

## What Would Happen If...

**...a container running as root has a remote code execution vulnerability?**

The attacker gets root inside the container. With container escape exploits (they exist and are discovered regularly), they become root on the host. Game over. Running as non-root means the attacker starts with limited privileges, making escape much harder.

**...you didn't set memory limits and a container has a memory leak?**

The container consumes all available RAM. The Linux OOM killer activates and may kill other containers, your database, or system services. With a memory limit, only the leaking container is killed.

**...you ran a container with `--privileged`?**

The container has ALL capabilities, access to all devices, and can modify the host kernel. It's essentially running directly on the host with no isolation. An attacker in a privileged container IS an attacker on the host. Never use `--privileged` in production unless you have an extremely specific and well-understood reason.

**...you forgot `no-new-privileges` and there's a setuid binary in the image?**

An attacker running as non-root finds the setuid binary, executes it, and escalates to root inside the container. With `no-new-privileges`, setuid is neutralized and the escalation fails.

**...your read-only filesystem container needs to write a temp file?**

The write fails. The application crashes. That's why you add `tmpfs` mounts for directories that need writes:

```yaml
read_only: true
tmpfs:
  - /tmp:size=10m
```

Plan your writable directories before enabling read-only mode.

---

## Key Takeaways

1. Never run as root in production — use the `USER` instruction
2. Use `read_only: true` with explicit tmpfs/volume mounts for writable paths
3. `cap_drop: ALL` then add back only what you need
4. `no-new-privileges: true` prevents privilege escalation
5. Set memory, CPU, and PID limits on every container
6. Use distroless or scratch base images to minimize attack surface
7. Run Docker Bench for Security regularly
8. Network isolation: use internal networks, limit inter-container communication
9. Security is layers — each measure reduces risk, all together they provide defense in depth
