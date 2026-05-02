# Lesson 01: Containers vs Virtual Machines

---

## What You Think Containers Are (And Why You're Probably Wrong)

If you've been deploying Go or TypeScript services, you've used Docker.
You type `docker build`, you type `docker run`, things work. But ask
yourself: do you actually know what a container **is**?

Most developers think containers are "lightweight VMs." That mental model
will lead you astray every time you debug a container networking issue,
troubleshoot an OOM kill, or try to understand why your app can see the
host's processes.

A container is not a VM. A container is a **regular Linux process** with
some clever restrictions applied to it.

Let's unpack that.

---

## The Apartment Building Analogy

### Virtual Machines = Separate Houses

Imagine a suburban street. Each house has its own foundation, plumbing,
electrical system, heating, roof, and yard. If the house next door has a
plumbing leak, your house is completely unaffected. Each house is entirely
self-contained.

That's a virtual machine. Each VM runs its own **complete operating system**
— its own kernel, its own device drivers, its own system libraries. The
hypervisor (VMware, Hyper-V, KVM) acts like the land developer who
allocates physical space for each house.

```
┌──────────────────────────────────────────┐
│              Physical Hardware             │
├──────────────────────────────────────────┤
│              Hypervisor (VMware/KVM)       │
├────────────┬────────────┬────────────────┤
│   VM 1     │   VM 2     │   VM 3         │
│ ┌────────┐ │ ┌────────┐ │ ┌────────────┐ │
│ │ Your   │ │ │ Your   │ │ │ Your       │ │
│ │ App    │ │ │ App    │ │ │ App        │ │
│ ├────────┤ │ ├────────┤ │ ├────────────┤ │
│ │ Libs   │ │ │ Libs   │ │ │ Libs       │ │
│ ├────────┤ │ ├────────┤ │ ├────────────┤ │
│ │ Full OS│ │ │ Full OS│ │ │ Full OS    │ │
│ │ Kernel │ │ │ Kernel │ │ │ Kernel     │ │
│ └────────┘ │ └────────┘ │ └────────────┘ │
└────────────┴────────────┴────────────────┘
```

Each VM: 500MB–2GB+ of OS overhead, 30 seconds to several minutes to boot.

### Containers = Apartments in a Building

Now imagine an apartment building. Every apartment shares the same
foundation, the same plumbing system, the same electrical grid. But each
apartment has its own locked door, its own thermostat, its own mailbox.
Your neighbor can't walk into your apartment, and you can't walk into
theirs.

That's a container. All containers on a host share the **same Linux
kernel**. But each container gets its own isolated view of:
- Processes (it thinks it's the only thing running)
- Network (it has its own IP, its own ports)
- Filesystem (it sees only its own files)
- Users (it can have its own root user)
- Hostname (it can have its own hostname)

```
┌──────────────────────────────────────────┐
│              Physical Hardware             │
├──────────────────────────────────────────┤
│              Host OS + Kernel              │
├──────────────────────────────────────────┤
│              Container Runtime             │
├────────────┬────────────┬────────────────┤
│ Container1 │ Container2 │ Container3      │
│ ┌────────┐ │ ┌────────┐ │ ┌────────────┐ │
│ │ Your   │ │ │ Your   │ │ │ Your       │ │
│ │ App    │ │ │ App    │ │ │ App        │ │
│ ├────────┤ │ ├────────┤ │ ├────────────┤ │
│ │ Libs   │ │ │ Libs   │ │ │ Libs       │ │
│ └────────┘ │ └────────┘ │ └────────────┘ │
└────────────┴────────────┴────────────────┘
```

Each container: a few MB overhead, starts in **milliseconds**.

---

## The Shared Kernel — Why This Matters

In a VM, if you run Ubuntu and your app needs a specific kernel feature,
you can upgrade just that VM's kernel. Each VM is independent.

In a container, every container uses the host's kernel. Period. If the host
runs Linux kernel 5.15, all containers run on kernel 5.15. You can't run a
container that needs kernel 6.1 on a host with kernel 5.15.

This is why:
- You can't run a Windows container on a Linux host (different kernel)
- Docker Desktop on macOS runs a hidden Linux VM (macOS kernel ≠ Linux kernel)
- Container "images" don't contain a kernel — just userspace files

### What's in a Container Image Then?

A container image contains:
- Your application binary
- Libraries your app depends on (libc, libssl, etc.)
- Configuration files
- A minimal set of userspace tools (maybe `sh`, `ls`, `cat`)

It does NOT contain:
- A kernel
- Device drivers
- A bootloader
- Hardware abstraction layers

That's why a Go binary compiled as a static binary can run in a
**completely empty** container (the `scratch` image). There's literally
nothing in the image except your binary. It borrows the kernel from the
host.

---

## Why Containers Start in Milliseconds

When you start a VM, the hypervisor must:
1. Allocate virtual hardware (CPU, RAM, disk, network)
2. Load a bootloader
3. Boot an entire OS kernel
4. Initialize device drivers
5. Start system services (init/systemd)
6. Finally start your application

That's 30 seconds to several minutes.

When you start a container, the runtime must:
1. Set up namespaces (a few syscalls)
2. Set up cgroups (a few more syscalls)
3. Mount the filesystem layers (near-instant)
4. Start your process

That's it. There's no kernel to boot. There's no OS to initialize. Your
process just starts, exactly like if you ran it directly on the host —
except with isolation boundaries around it.

Think about it this way: starting a container is almost the same cost as
just running a new process. Because that's fundamentally what it is.

---

## How This Relates to Your Go/TypeScript Deployments

### Go Deployment Without Docker

```bash
GOOS=linux GOARCH=amd64 go build -o server ./cmd/server
scp server user@production:/usr/local/bin/
ssh user@production "systemctl restart myapp"
```

Problems:
- "Works on my machine" — different libc versions, missing certificates
- No isolation — your app can see every process, every file
- No resource limits — a memory leak eats all host RAM
- Rollback means keeping old binaries around and hoping

### Go Deployment With Docker

```bash
docker build -t myapp:v1.2.3 .
docker push registry.example.com/myapp:v1.2.3
docker pull registry.example.com/myapp:v1.2.3
docker run -d --name api -p 8080:8080 --memory 512m myapp:v1.2.3
```

What you get:
- Identical environment everywhere (the image IS the environment)
- Process isolation (your app can't see host processes)
- Resource limits (memory and CPU caps)
- Instant rollback (`docker run myapp:v1.2.2`)

### TypeScript/Node.js — Same Story, More Dependencies

```bash
docker run -d \
  --name api \
  -p 3000:3000 \
  --memory 1g \
  -e NODE_ENV=production \
  myapp:v2.0.0
```

Node.js apps especially benefit because the image bundles the exact
Node.js version AND all `node_modules`. No more "but I have Node 18 and
production has Node 16."

---

## Your First Container — Dissected

Let's run the simplest possible container and explain every step.

```bash
docker run hello-world
```

Output:

```
Unable to find image 'hello-world:latest' locally
latest: Pulling from library/hello-world
c1ec31eb5944: Pull complete
Digest: sha256:d211f485f2dd1dee407a80973c8f129f00d54604d2c90732e8e320e5038a0348
Status: Downloaded newer image for hello-world:latest

Hello from Docker!
This message shows that your installation appears to be working correctly.
...
```

### What Actually Happened — Step by Step

**Step 1: Docker client sends request to Docker daemon**

When you type `docker run hello-world`, the Docker CLI (the `docker`
command) sends an API request to the Docker daemon (`dockerd`). The daemon
is a background process that actually manages containers.

Think of it like a restaurant: you (the CLI) tell the waiter (the API)
what you want, and the kitchen (the daemon) makes it happen.

**Step 2: Daemon checks for the image locally**

```
Unable to find image 'hello-world:latest' locally
```

The daemon looks in its local image storage. It doesn't find `hello-world`,
so it needs to download it.

**Step 3: Daemon pulls the image from Docker Hub**

```
latest: Pulling from library/hello-world
c1ec31eb5944: Pull complete
```

Docker Hub is the default image registry (like npm for Node packages or
pkg.go.dev for Go modules). The daemon downloads the image layers.

The `hello-world` image is about 13KB. It contains a single static
binary that prints a message. That's it. No operating system, no shell, no
libraries.

**Step 4: Daemon creates a container from the image**

A container is created by:
- Setting up namespaces (PID, NET, MNT, UTS, USER)
- Setting up cgroups (resource limits)
- Mounting the image's filesystem as the container's root filesystem
- Configuring the container's network

**Step 5: Daemon starts the container's process**

The `hello-world` image specifies that its entry point is `/hello`. The
daemon starts this binary as the container's PID 1 (the main process).

**Step 6: The process runs and exits**

The `/hello` binary prints its message and exits with code 0. Since the
main process exited, the container stops.

**Step 7: Container remains in "exited" state**

```bash
docker ps -a
```

```
CONTAINER ID  IMAGE        COMMAND   CREATED        STATUS                    NAMES
a1b2c3d4e5f6  hello-world  "/hello"  2 minutes ago  Exited (0) 2 minutes ago  keen_darwin
```

The container still exists (you can inspect its logs, filesystem changes,
etc.) but it's not running. Use `docker rm` to delete it.

---

## Let's Prove Containers Share the Kernel

Run a container and check its kernel version:

```bash
docker run --rm ubuntu uname -r
```

Now check your host's kernel version:

```bash
uname -r
```

They're the same. The container is using the host's kernel.

Compare that to a VM — if you ran `uname -r` inside a VM, you'd see the
VM's own kernel version, potentially completely different from the host.

---

## Let's Prove Containers Are Just Processes

Start a long-running container:

```bash
docker run -d --name sleeper ubuntu sleep 3600
```

Find the container's main process from the **host**:

```bash
docker top sleeper
```

```
UID    PID    PPID   C  STIME  TTY  TIME      CMD
root   12345  12300  0  10:00  ?    00:00:00  sleep 3600
```

That PID (12345) is a real process on your host. You can see it with
regular `ps`:

```bash
ps aux | grep "sleep 3600"
```

The container's "sleep 3600" is just a regular Linux process. The
container runtime set up namespaces and cgroups around it, but it's still
just a process.

Inside the container, however:

```bash
docker exec sleeper ps aux
```

```
USER  PID  %CPU  %MEM  VSZ    RSS    TTY  STAT  START  TIME  COMMAND
root  1    0.0   0.0   2516   580    ?    Ss    10:00  0:00  sleep 3600
root  7    0.0   0.0   5900   3000   ?    Rs    10:01  0:00  ps aux
```

Inside the container, `sleep` has PID 1. Outside, it has PID 12345.
That's namespace magic — we'll cover this in detail in the next lesson.

```bash
docker rm -f sleeper
```

---

## The Comparison Table You Actually Need

| Feature | Virtual Machine | Container |
|---------|----------------|-----------|
| Isolation level | Hardware-level | Process-level |
| Has own kernel | Yes | No (uses host kernel) |
| Boot time | 30s–minutes | Milliseconds |
| Memory overhead | 500MB–2GB+ | A few MB |
| Image size | Gigabytes | Megabytes |
| Density (per host) | 10s of VMs | 100s–1000s of containers |
| Security isolation | Stronger | Weaker (shared kernel) |
| OS flexibility | Any OS | Same OS family as host |
| Hardware emulation | Yes | No |
| Live migration | Yes | Possible but uncommon |
| Startup sequence | BIOS → Bootloader → Kernel → Init → App | App |

---

## Image Layers: Building Blocks, Not Monoliths

Container images aren't single files — they're stacks of **layers**,
each representing a change from the layer below.

**Analogy — transparent overlays on a map:** Remember old-school overhead
projectors? You'd have a base map (the country outline), then stack
transparent sheets on top: one for roads, one for cities, one for rivers.
The final image is all sheets stacked together. Change the rivers? Swap
just that one sheet. Everything else stays the same.

Docker images work identically:

```
Your Dockerfile:                    Image Layers:
─────────────────────              ─────────────────────
FROM ubuntu:22.04         →        Layer 1: Ubuntu base filesystem (77MB)
RUN apt-get install curl  →        Layer 2: curl + dependencies (15MB)
COPY app /usr/local/bin/  →        Layer 3: your binary (8MB)
CMD ["app"]               →        (metadata only, no new layer)

Total image: 100MB
```

The magic: layers are **shared and cached**. If 10 different images all
start with `FROM ubuntu:22.04`, that 77MB base layer exists only ONCE on
disk. Change your app binary? Only Layer 3 (8MB) needs to be rebuilt and
re-pushed. The other layers are already cached everywhere.

This is why build order in Dockerfiles matters enormously:

```
❌ Bad: change code → rebuild everything
COPY . /app                    ← changes every time you edit code
RUN npm install                ← reinstalls ALL packages every time!
RUN npm run build              ← rebuilds every time

✅ Good: change code → only rebuild code layer
COPY package.json /app/        ← only changes when dependencies change
RUN npm install                ← cached if package.json didn't change!
COPY . /app                    ← this layer changes, but npm install is cached
RUN npm run build
```

This turns a 5-minute build into a 10-second build. Understanding layers
is the single biggest practical Docker optimization.

---

## Container Security: The Shared Wall Problem

Containers share the host kernel. This is their greatest strength (speed,
efficiency) and their greatest weakness (security).

**Analogy — apartments with thin walls:** In the apartment building, each
unit has locked doors (namespaces) and utility meters (cgroups). But all
apartments share the same foundation and plumbing. If someone finds a crack
in the foundation (a kernel vulnerability), they can potentially reach
ANY apartment.

```
VM Security Model:            Container Security Model:
┌──────────┐ ┌──────────┐    ┌──────────┐ ┌──────────┐
│  VM 1    │ │  VM 2    │    │Container1│ │Container2│
│ ┌──────┐ │ │ ┌──────┐ │    │ ┌──────┐ │ │ ┌──────┐ │
│ │ App  │ │ │ │ App  │ │    │ │ App  │ │ │ │ App  │ │
│ ├──────┤ │ │ ├──────┤ │    │ └──────┘ │ │ └──────┘ │
│ │Kernel│ │ │ │Kernel│ │    └────┬─────┘ └────┬─────┘
│ └──────┘ │ │ └──────┘ │         │              │
└────┬─────┘ └────┬─────┘    ┌────┴──────────────┴────┐
┌────┴──────────────┴────┐    │   SHARED HOST KERNEL    │
│     Hypervisor          │    │   (single attack surface)│
│     (tiny attack surface)│    └─────────────────────────┘
└─────────────────────────┘

Kernel exploit in VM: affects only that VM's kernel.
Kernel exploit in container: affects EVERY container + host.
```

This is why:
- **Never run containers as root** unless absolutely necessary
- **Use read-only filesystems** (`--read-only`) when possible
- **Drop capabilities** — containers don't need `CAP_SYS_ADMIN`
- **Use security profiles** (AppArmor, seccomp) to limit syscalls
- Running untrusted code? Use VMs or gVisor (a user-space kernel)

---

## When VMs Still Win

Containers aren't always the answer. VMs are better when:

- **You need strong security isolation.** Containers share a kernel. A
  kernel exploit in one container could affect all containers on the host.
  VMs have a much smaller attack surface (the hypervisor interface).

- **You need a different OS.** Want to run Windows and Linux workloads on
  the same host? VMs. Containers can only run the host's OS family.

- **You need different kernel versions.** One workload needs kernel 5.15
  features, another needs 6.1. VMs. Containers all share the same kernel.

- **You're running untrusted code.** If you're running user-submitted code
  (like a coding challenge platform), VMs provide much stronger isolation.

- **Compliance requirements mandate it.** Some regulatory frameworks
  require hardware-level isolation.

In practice, most modern deployments use containers. But understanding
when VMs are the right choice makes you a better engineer.

---

## Exercises

### Exercise 1: Explore Container Overhead

Run an Ubuntu container and check its memory footprint:

```bash
docker run -d --name test-ubuntu ubuntu sleep 3600
docker stats --no-stream test-ubuntu
```

Now run an nginx container:

```bash
docker run -d --name test-nginx nginx
docker stats --no-stream test-nginx
```

Compare the memory usage. The Ubuntu container doing nothing uses almost
zero memory because `sleep` is a tiny process. Nginx uses more because
it's an actual web server. Neither is "running an OS."

Clean up:

```bash
docker rm -f test-ubuntu test-nginx
```

### Exercise 2: Image Sizes

Compare image sizes:

```bash
docker pull ubuntu:22.04
docker pull alpine:3.19
docker pull golang:1.22
docker pull node:20
docker pull nginx:alpine
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
```

Questions to answer:
- Why is `golang` so much larger than `alpine`?
- Why is `node` larger than `golang`?
- How does `nginx:alpine` compare to `ubuntu`?

### Exercise 3: Prove Filesystem Isolation

Create a file inside a container:

```bash
docker run --rm ubuntu bash -c "echo 'hello from container' > /tmp/test.txt && cat /tmp/test.txt"
```

Now check if that file exists on your host:

```bash
ls /tmp/test.txt
```

It doesn't. The container had its own filesystem. When the container was
removed (`--rm`), its filesystem layer was deleted.

### Exercise 4: Prove Network Isolation

```bash
docker run --rm ubuntu hostname -I
```

The container got its own IP address, separate from your host. Each
container gets its own network namespace with its own network stack.

### Exercise 5: Process Count Inside vs Outside

Start three containers:

```bash
docker run -d --name c1 ubuntu sleep 3600
docker run -d --name c2 ubuntu sleep 3600
docker run -d --name c3 ubuntu sleep 3600
```

Check processes inside container c1:

```bash
docker exec c1 ps aux
```

You'll see only the processes belonging to c1. It has no idea c2 and c3
exist. But on the host:

```bash
docker top c1
docker top c2
docker top c3
```

The host sees all three processes.

Clean up:

```bash
docker rm -f c1 c2 c3
```

---

## What Would Happen If...

**Q: You run `rm -rf /` inside a container?**

The container's filesystem gets destroyed, the container crashes. The host
is completely unaffected. Other containers are unaffected. It's like
trashing your apartment — the building still stands.

**Q: A container tries to load a kernel module?**

It fails (unless you gave it special privileges). Containers share the
host kernel but can't modify it. This is a security boundary.

**Q: Two containers listen on port 8080?**

Each container has its own network namespace, so both can listen on port
8080 inside their container. The conflict only happens if you try to map
both to the same host port (`-p 8080:8080`).

**Q: Your container process forks 10,000 child processes?**

Without cgroup limits, those become 10,000 real processes on the host,
potentially exhausting host resources. With cgroups, you can limit PIDs
per container. We'll cover this in lesson 03.

**Q: Docker daemon crashes?**

All running containers continue to run (if using containerd). The daemon
manages lifecycle, but the containers are real processes managed by
containerd/runc underneath. You just can't manage them via `docker`
commands until the daemon restarts.

---

## Key Takeaways

1. A container is a regular Linux process with isolation (namespaces) and
   resource limits (cgroups) applied to it.

2. Containers share the host kernel. VMs have their own kernels.

3. Container images contain userspace files (binaries, libraries), NOT
   a kernel or OS.

4. Containers start in milliseconds because there's no kernel to boot.

5. The isolation is real but not as strong as VMs. A kernel vulnerability
   affects all containers on the host.

6. Docker on macOS/Windows runs a hidden Linux VM because containers
   need a Linux kernel.

---

## Next Lesson

Now that you know containers are processes with boundaries, let's look at
**how** those boundaries are created. Lesson 02 covers **Linux namespaces**
— the kernel feature that makes a process think it's alone in the world.
