# Lesson 05: The Container Runtime Ecosystem

---

## The Car Dealership Analogy

When you buy a car, you interact with the **dealership**. You say "I want
a blue sedan with leather seats." The dealership doesn't build the car.
They send your order to the **factory floor**, which coordinates the
actual manufacturing. The factory floor doesn't weld the chassis — that
happens on the **assembly line**, where workers and robots do the physical
work.

That's the container runtime stack:

- **Docker** is the dealership — the friendly interface you interact with
- **containerd** is the factory floor — manages the lifecycle of containers
- **runc** is the assembly line — actually creates the container using
  Linux kernel features (namespaces, cgroups, etc.)

You don't need to understand the assembly line to buy a car. But when
something goes wrong — when a container won't start, when Kubernetes
drops Docker support, when you need to debug a low-level issue — knowing
the layers saves you hours.

---

## The Full Pipeline: What Happens When You Type `docker run`

```bash
docker run -d --name api -p 3000:3000 --memory 512m myapp:v1
```

Here's every step, from your keyboard to a running process:

```
You type "docker run"
        │
        ▼
┌───────────────────┐
│   Docker CLI      │  Parses arguments, sends REST API request
│   (docker)        │  to Docker daemon over unix socket
└────────┬──────────┘
         │  HTTP POST /containers/create
         │  HTTP POST /containers/{id}/start
         ▼
┌───────────────────┐
│   Docker Daemon   │  Validates config, manages images, networks,
│   (dockerd)       │  volumes. Delegates container lifecycle to
│                   │  containerd via gRPC.
└────────┬──────────┘
         │  gRPC: CreateContainer, StartContainer
         ▼
┌───────────────────┐
│   containerd      │  High-level container runtime. Manages image
│                   │  pulling, storage, networking setup, and
│                   │  delegates actual container creation to a
│                   │  shim process.
└────────┬──────────┘
         │  Spawns containerd-shim-runc-v2
         ▼
┌───────────────────┐
│ containerd-shim   │  Acts as the parent of the container process.
│                   │  Allows containerd to restart without killing
│                   │  containers. Monitors the container.
└────────┬──────────┘
         │  Executes runc
         ▼
┌───────────────────┐
│   runc            │  Low-level OCI runtime. Makes the actual
│                   │  clone() syscalls with namespace flags,
│                   │  sets up cgroups, mounts filesystem,
│                   │  configures security, then exec()s
│                   │  your application.
└────────┬──────────┘
         │  clone() + exec()
         ▼
┌───────────────────┐
│   Your Process    │  Running inside namespaces, limited by
│   (PID 1)         │  cgroups, seeing the overlay filesystem.
│                   │  A regular Linux process with restrictions.
└───────────────────┘
```

That's 6 layers between your command and a running process. Let's
understand each one.

---

## Layer 1: Docker CLI

The `docker` command is a REST API client. That's it. It formats your
commands into HTTP requests and sends them to the Docker daemon.

```bash
docker run nginx
```

Translates roughly to:

```bash
curl --unix-socket /var/run/docker.sock \
  -X POST http://localhost/containers/create \
  -H "Content-Type: application/json" \
  -d '{"Image": "nginx"}'
```

Followed by:

```bash
curl --unix-socket /var/run/docker.sock \
  -X POST http://localhost/containers/{id}/start
```

You could literally replace the Docker CLI with `curl`. The CLI just
makes it ergonomic.

### Prove It

```bash
curl --unix-socket /var/run/docker.sock http://localhost/version 2>/dev/null | python3 -m json.tool
```

You're talking to the Docker daemon directly via its REST API.

---

## Layer 2: Docker Daemon (dockerd)

The Docker daemon is a background service that:
- Listens on the Docker socket (`/var/run/docker.sock`)
- Manages images (pull, push, build, cache)
- Manages networks (bridge, overlay, etc.)
- Manages volumes (named volumes, bind mounts)
- Manages container lifecycle (create, start, stop, remove)
- Provides the REST API that the CLI uses

The daemon does NOT directly create containers. It delegates to
containerd.

### Why This Separation Matters

In the early Docker days (pre-1.11), the daemon did everything. If the
daemon crashed or was upgraded, ALL running containers died. That's
terrible for production.

By separating the daemon from containerd, you can:
- Upgrade the Docker daemon without killing containers
- Restart dockerd after a crash and reconnect to running containers
- Use containerd without Docker at all (which Kubernetes does)

---

## Layer 3: containerd

containerd is a high-level container runtime. "High-level" means it
handles the lifecycle management but doesn't do the low-level Linux
kernel work itself.

containerd manages:
- **Image operations:** Pulling images from registries, unpacking layers,
  managing the image store
- **Container lifecycle:** Create, start, stop, delete
- **Snapshot management:** The filesystem layers and storage
- **Task execution:** The actual running process and its I/O
- **Namespaces:** (containerd namespaces, different from Linux namespaces)
  for multi-tenancy

containerd exposes a gRPC API that clients (like dockerd) use.

### containerd Without Docker

You can use containerd directly with its own CLI:

```bash
ctr images pull docker.io/library/nginx:alpine
ctr run docker.io/library/nginx:alpine my-nginx
```

Or use `nerdctl`, which is a Docker-compatible CLI for containerd:

```bash
nerdctl run -d --name my-nginx -p 8080:80 nginx:alpine
```

Kubernetes uses containerd directly (not through Docker). More on this
later.

---

## Layer 4: containerd-shim

The shim is a small process that sits between containerd and the actual
container process. Every container has its own shim.

### Why Does the Shim Exist?

Imagine you have 50 running containers and containerd crashes. Without
the shim, all 50 containers die (because their parent process died).

With the shim:
- The shim is the direct parent of the container process
- The shim is independent of containerd
- If containerd crashes, the shim keeps running, and so does the container
- When containerd restarts, it reconnects to existing shims

The shim also handles:
- STDIO forwarding (container logs go through the shim)
- Exit status reporting
- Keeping the container's exit code until someone asks for it

```
containerd ──┬── shim ─── container process A
             ├── shim ─── container process B
             └── shim ─── container process C
```

If containerd dies and restarts, it finds the three shims still running
and reconnects.

---

## Layer 5: runc

runc is the low-level container runtime. It does the actual work of
creating a container using Linux kernel features. It's a standalone
binary that:

1. Reads an OCI runtime spec (a JSON configuration file)
2. Creates Linux namespaces (PID, NET, MNT, UTS, USER, IPC)
3. Sets up cgroups (CPU, memory, I/O limits)
4. Mounts the root filesystem (overlay)
5. Applies security restrictions (seccomp, AppArmor, capabilities)
6. Calls `exec()` to replace itself with your application

runc was extracted from Docker and donated to the Open Container
Initiative (OCI). It's the reference implementation of the OCI runtime
specification.

### Using runc Directly

You could technically run a container with runc alone:

```bash
mkdir /tmp/runc-demo && cd /tmp/runc-demo
mkdir rootfs
docker export $(docker create alpine) | tar -C rootfs -xf -
runc spec
runc run my-container
```

`runc spec` generates an OCI runtime spec (`config.json`). `runc run`
reads the spec and creates a container. It's raw, manual, and nobody
does this in production — but understanding it demystifies containers.

After runc creates the process and sets up all the isolation, runc
**exits**. Your application process becomes a child of the shim, not
runc. runc is a tool that creates containers, not a daemon that manages
them.

---

## Layer 6: Your Process

After all those layers, your application is running as a regular Linux
process. It has:
- Its own PID namespace (it sees PID 1)
- Its own network namespace (its own IP and ports)
- Its own mount namespace (the overlay filesystem)
- cgroup limits enforced by the kernel
- Security restrictions (seccomp, capabilities)

From your application's perspective, it's running on a tiny machine all
by itself. It doesn't know about Docker, containerd, runc, or any of the
infrastructure above it.

---

## The OCI Specifications

The Open Container Initiative (OCI) created two key specifications to
standardize containers:

### Image Specification (image-spec)

Defines the format of container images:
- A manifest (JSON describing the image)
- Configuration (environment variables, entrypoint, etc.)
- A set of filesystem layers (tar archives)

This means any tool that produces OCI-compliant images can work with any
runtime that consumes them. You can build with Docker, run with containerd.
Build with Buildah, run with CRI-O. The image format is universal.

### Runtime Specification (runtime-spec)

Defines how to run a container:
- A `config.json` file describing the container
- Root filesystem path
- Namespace configuration
- Cgroup configuration
- Mount points
- Security settings

Any OCI-compliant runtime (runc, crun, gVisor, Kata Containers) can
read this spec and create a container.

### Why Standards Matter

Before OCI, Docker's image format and runtime were proprietary. If you
built an image with Docker, you could only run it with Docker. OCI broke
that coupling:

```
Build tools:        Docker, Buildah, kaniko, ko
Image registries:   Docker Hub, GitHub CR, AWS ECR, GCP GCR
Container runtimes: runc, crun, gVisor, Kata Containers
Orchestrators:      Kubernetes, Nomad, Docker Swarm
```

Any combination works because they all speak OCI.

---

## Why Kubernetes Dropped Docker

This is one of the most misunderstood events in container history.
In December 2020, Kubernetes announced deprecation of "dockershim."
Headlines screamed "Kubernetes drops Docker support!" Panic ensued.

### What Actually Happened

Kubernetes talks to container runtimes through an interface called CRI
(Container Runtime Interface). CRI is a gRPC API that defines how to
create, start, stop, and delete containers.

containerd implements CRI natively. Docker does not.

The old architecture:

```
Kubernetes ──→ dockershim ──→ Docker daemon ──→ containerd ──→ runc
```

Kubernetes had to maintain a special adapter (`dockershim`) to translate
CRI calls into Docker API calls. Docker then translated those into
containerd calls. Two unnecessary translations.

The new architecture:

```
Kubernetes ──→ containerd ──→ runc
```

Direct. Clean. Fewer moving parts. Better performance.

### What Didn't Change

- Docker images still work in Kubernetes (they're OCI images)
- `docker build` still works for building images
- Docker Compose still works for local development
- Docker CLI still works for everything except running Kubernetes nodes

The only thing that changed is that Kubernetes nodes no longer need
Docker installed. They only need containerd (or CRI-O).

### The Real Reason

Docker the daemon runs lots of services: image building, volume
management, networking, swarm mode. Kubernetes doesn't need ANY of that.
It has its own image pulling, its own volume management, its own
networking. Running Docker on Kubernetes nodes was like installing a full
kitchen when you only need a microwave.

---

## Alternative Container Runtimes

### crun

A lightweight runc alternative written in C (runc is written in Go).
Faster startup, smaller memory footprint. Used by Podman and Red Hat
systems.

### gVisor (runsc)

Google's container runtime that provides an additional security boundary.
Instead of containers sharing the host kernel directly, gVisor implements
a user-space kernel that intercepts container syscalls. Stronger isolation
than namespaces alone, but with a performance cost.

Think of it like a translation layer: instead of your container speaking
directly to the Linux kernel, it speaks to gVisor, which translates safe
calls to the real kernel.

```
Standard:  Container → syscall → Host Kernel
gVisor:    Container → syscall → gVisor (user-space kernel) → Host Kernel
```

### Kata Containers

Combines the best of VMs and containers. Each container runs in a
lightweight VM with its own kernel. You get VM-level isolation with
container-like ergonomics and speed. The VM boots in less than a second
using a minimal kernel.

```
Standard:    Container → shared Host Kernel
Kata:        Container → dedicated micro-VM kernel → Host Kernel
```

### Firecracker

Amazon's microVM technology (used by Lambda and Fargate). Creates tiny VMs
that boot in under 125ms with minimal memory overhead. Like Kata, but even
more lightweight.

### When to Use What

| Runtime | Isolation | Performance | Use Case |
|---------|-----------|-------------|----------|
| runc | Standard namespaces | Fastest | General purpose, trusted workloads |
| crun | Standard namespaces | Fast (lighter than runc) | Same as runc, lighter |
| gVisor | User-space kernel | ~20% overhead | Untrusted workloads, multi-tenant |
| Kata | Per-container VM | ~5-10% overhead | Strong isolation requirements |
| Firecracker | MicroVM | Fast boot, low overhead | Serverless, FaaS |

---

## Podman — Docker Without the Daemon

Podman is a Docker-compatible tool that runs containers without a daemon.
There's no background service — each `podman` command directly interacts
with the container runtime.

```bash
podman run -d --name api -p 3000:3000 myapp:v1
podman ps
podman logs api
```

The commands are identical to Docker. Many people alias `docker=podman`.

### Why Daemonless Matters

Docker's daemon runs as root. A vulnerability in the daemon could give
an attacker root access to the host. Podman runs containers as your user,
using rootless containers and user namespaces.

```
Docker:  docker CLI → dockerd (root) → containerd → runc
Podman:  podman CLI → conmon (user) → crun/runc
```

No daemon = no single point of failure, no root service.

---

## Tracing the Full Stack on a Running System

### See What's Running

```bash
docker run -d --name trace-demo nginx:alpine

ps aux | grep -E "docker|containerd|shim|nginx"
```

You'll see:
- `dockerd` — the Docker daemon
- `containerd` — the container runtime
- `containerd-shim-runc-v2` — the shim for your container
- `nginx` — your actual application

### Follow the Parent Chain

```bash
NGINX_PID=$(docker inspect --format '{{.State.Pid}}' trace-demo)

ps -o pid,ppid,comm -p $NGINX_PID
```

The parent (PPID) of nginx is the containerd-shim. The parent of the
shim is containerd (or PID 1 if the shim was reparented).

### Inspect the Container's OCI Config

```bash
CONTAINER_ID=$(docker inspect --format '{{.Id}}' trace-demo)
cat /run/containerd/io.containerd.runtime.v2.task/moby/$CONTAINER_ID/config.json | python3 -m json.tool | head -50
```

This is the OCI runtime spec that runc used to create your container.
It contains all the namespace, cgroup, mount, and security settings.

Clean up: `docker rm -f trace-demo`

---

## How This Connects to Your Go/TypeScript Work

### Building Container-Aware Applications

Now that you know the stack, you can write better containerized services:

**Graceful shutdown:** Your process is PID 1. When Docker stops the
container, it sends SIGTERM. You have 10 seconds (by default) to shut
down before SIGKILL.

Go:
```go
ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
defer stop()

srv := &http.Server{Addr: ":8080"}
go srv.ListenAndServe()

<-ctx.Done()
shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
srv.Shutdown(shutdownCtx)
```

Node.js/TypeScript:
```typescript
const server = app.listen(3000);

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
});
```

**Health checks:** containerd (via Docker or Kubernetes) can check if
your process is actually working, not just running. Expose a `/healthz`
endpoint.

**Resource awareness:** Your app runs inside cgroup limits. Go's
`runtime.NumCPU()` shows host CPUs, not cgroup limits. Use
`automaxprocs`. Node's V8 heap should be configured to match the memory
cgroup.

---

## Exercises

### Exercise 1: Trace the Process Tree

```bash
docker run -d --name tree-exercise nginx:alpine
```

Find the full process tree from dockerd to nginx. Use `ps`, `pstree`,
or `/proc/[pid]/status` to trace parent-child relationships.

Questions:
1. What is the parent of the nginx process?
2. What is the parent of the containerd-shim?
3. If you stop dockerd, does nginx keep running?

Clean up: `docker rm -f tree-exercise`

### Exercise 2: Talk to Docker Without the CLI

Use `curl` to interact with the Docker daemon directly:

```bash
curl --unix-socket /var/run/docker.sock http://localhost/containers/json 2>/dev/null | python3 -m json.tool

curl --unix-socket /var/run/docker.sock -X POST \
  -H "Content-Type: application/json" \
  -d '{"Image": "alpine", "Cmd": ["echo", "hello from curl"]}' \
  http://localhost/containers/create 2>/dev/null | python3 -m json.tool
```

This proves the Docker CLI is just a REST client.

### Exercise 3: Examine the OCI Spec

```bash
docker run -d --name spec-exercise --memory 256m --cpus 1 alpine sleep 3600
CONTAINER_ID=$(docker inspect --format '{{.Id}}' spec-exercise)
```

Find and examine the OCI runtime spec (config.json) for this container.
Look for:
- Namespace configurations
- cgroup settings (memory limit, CPU)
- Mount points
- Security settings (capabilities, seccomp)

Clean up: `docker rm -f spec-exercise`

### Exercise 4: Compare Image Formats

Pull the same image and examine its manifest:

```bash
docker pull alpine:3.19
docker inspect alpine:3.19 | python3 -m json.tool > /tmp/alpine-inspect.json

docker manifest inspect alpine:3.19 > /tmp/alpine-manifest.json 2>/dev/null
```

Look at:
- How layers are referenced (by SHA256 digest)
- The image configuration
- Platform specifications (amd64, arm64)

### Exercise 5: Simulate What runc Does

This is conceptual — you won't actually run runc, but trace the syscalls:

```bash
docker run -d --name strace-demo alpine sleep 3600
PID=$(docker inspect --format '{{.State.Pid}}' strace-demo)

sudo cat /proc/$PID/cgroup
sudo cat /proc/$PID/mountinfo | head -20
sudo ls -la /proc/$PID/ns/
```

These files show you the namespaces, cgroups, and mounts that runc
configured for the container.

Clean up: `docker rm -f strace-demo`

---

## What Would Happen If...

**Q: containerd crashes while containers are running?**

The containers keep running (the shims are independent). When containerd
restarts, it reconnects to existing shims and resumes management.

**Q: The Docker daemon crashes?**

Same thing — containers stay up via containerd/shims. You can't use
`docker` commands until the daemon restarts, but your services continue
serving traffic.

**Q: You kill the containerd-shim for a container?**

The container process gets reparented to PID 1 (init). The container
keeps running but containerd loses track of it. It becomes an orphan
that needs manual cleanup.

**Q: Two different OCI runtimes try to run the same image?**

They can. An OCI image is just layers + metadata. runc, crun, gVisor,
and Kata can all consume the same image. The runtime spec (config.json)
might differ, but the image is universal.

**Q: You install Kubernetes on a node with Docker installed?**

Modern Kubernetes (1.24+) ignores Docker and uses containerd directly
through CRI. Docker and Kubernetes can coexist on the same machine, each
using containerd independently (in different containerd namespaces).

---

## Key Takeaways

1. Docker is a stack: CLI → daemon → containerd → shim → runc → your
   process. Each layer has a specific responsibility.

2. runc does the actual Linux kernel work (namespaces, cgroups, mounts).
   Everything above it is lifecycle management and API convenience.

3. OCI specifications (image-spec, runtime-spec) standardize container
   formats, allowing mix-and-match between build tools, registries, and
   runtimes.

4. Kubernetes dropped Docker (dockershim) because it could talk to
   containerd directly. Docker images still work everywhere.

5. The shim pattern allows containerd to restart without killing
   containers — critical for production reliability.

6. Alternative runtimes (gVisor, Kata, Firecracker) provide stronger
   isolation at the cost of performance, for when namespaces aren't
   enough.

---

## Next Lesson

Now that you understand what containers are (lesson 01), how they're
isolated (lesson 02-03), how their filesystems work (lesson 04), and the
software stack that creates them (this lesson), it's time to write
Dockerfiles. Lesson 06 covers **building container images** step by step,
with real Go and Node.js examples.
