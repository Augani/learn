# Lesson 02: Linux Namespaces

---

## The Department Analogy

Imagine a large company with multiple departments: Engineering, Marketing,
Sales, and HR. Each department operates as if it's the entire company.
Engineering has an employee #1, Marketing has an employee #1. Each
department has its own org chart, its own internal network, its own file
server. If you ask someone in Engineering "who is employee #1?", they'll
give you the name of the first engineer. They don't even know Marketing's
employee #1 exists.

But in reality, they're all in the same building, using the same
electricity, the same elevators, the same cafeteria.

That's exactly what Linux namespaces do. Each namespace gives a process
(and its children) an isolated view of a particular system resource. The
process thinks it has its own private version of that resource, but it's
really sharing the same underlying kernel.

---

## What Is a Namespace?

A namespace wraps a global system resource in an abstraction that makes it
appear to the processes inside the namespace that they have their own
isolated instance of the resource. Changes inside one namespace are
invisible to processes in other namespaces.

Linux has eight types of namespaces. Containers primarily use six:

| Namespace | Isolates | Kernel Flag |
|-----------|----------|-------------|
| PID | Process IDs | `CLONE_NEWPID` |
| NET | Network stack | `CLONE_NEWNET` |
| MNT | Mount points (filesystem) | `CLONE_NEWNS` |
| UTS | Hostname and domain name | `CLONE_NEWUTS` |
| USER | User and group IDs | `CLONE_NEWUSER` |
| IPC | Inter-process communication | `CLONE_NEWIPC` |

Two additional namespaces exist (cgroup namespace and time namespace)
but the six above are the ones that matter for understanding containers.

---

## PID Namespace — "I Am Process Number One"

### The Concept

Every Linux system has a process tree. PID 1 is the init process — the
ancestor of all other processes. If PID 1 dies, the system panics.

A PID namespace gives a process its own process tree. Inside that
namespace, the first process gets PID 1. It can only see processes in its
namespace. From outside, that same process has a completely different PID.

Think of it like apartment numbering. In Building A, there's an Apartment 1.
In Building B, there's also an Apartment 1. They're completely different
apartments, but both are "number 1" in their own context.

### See It in Action

Start a container and check its PID:

```bash
docker run -d --name pid-demo ubuntu sleep 3600
```

From inside the container:

```bash
docker exec pid-demo ps aux
```

```
USER  PID  %CPU  %MEM   VSZ    RSS   TTY  STAT  START  TIME  COMMAND
root  1    0.0   0.0    2516   580   ?    Ss    10:00  0:00  sleep 3600
root  7    0.0   0.0    5900   3000  ?    Rs    10:01  0:00  ps aux
```

`sleep` is PID 1 inside the container. It thinks it's the init process.

From the host:

```bash
docker inspect --format '{{.State.Pid}}' pid-demo
```

```
48723
```

On the host, that same `sleep` process has PID 48723. Two different PIDs,
same process.

### Using unshare to Create a PID Namespace

`unshare` is a Linux command that creates namespaces manually. This is
literally what Docker does under the hood (via syscalls).

```bash
sudo unshare --pid --fork --mount-proc bash
```

What this does:
- `--pid` — create a new PID namespace
- `--fork` — fork a new process (required for PID namespace)
- `--mount-proc` — mount a new `/proc` so `ps` works correctly

Inside this new namespace:

```bash
ps aux
```

```
USER  PID  %CPU  %MEM   VSZ    RSS   TTY  STAT  START  TIME  COMMAND
root  1    0.0   0.0    8264   5200  pts/0 S    10:00  0:00  bash
root  2    0.0   0.0    9888   3400  pts/0 R+   10:00  0:00  ps aux
```

Your bash shell is PID 1. The entire process list has only two entries.
You can't see any of the host's other processes.

Type `exit` to leave the namespace.

### Why PID 1 Matters in Containers

PID 1 has special responsibilities in Linux:
- It reaps zombie processes (orphaned child processes)
- It receives signals (SIGTERM, SIGINT) when the container is stopped
- If PID 1 exits, the entire namespace (container) is destroyed

This is why your Dockerfile's `ENTRYPOINT`/`CMD` matters. If you use shell
form:

```dockerfile
CMD node server.js
```

The actual PID 1 is `/bin/sh -c "node server.js"`. `sh` doesn't forward
signals to `node`. When Docker sends SIGTERM to stop the container, `sh`
receives it and does nothing with it. After 10 seconds, Docker sends
SIGKILL (the unkillable signal) and your Node process dies without
graceful shutdown.

Use exec form instead:

```dockerfile
CMD ["node", "server.js"]
```

Now `node` is PID 1 and receives SIGTERM directly.

In Go, you typically handle this:

```go
sigChan := make(chan os.Signal, 1)
signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)
<-sigChan
server.Shutdown(ctx)
```

This works correctly when your Go binary is PID 1 in the container.

---

## NET Namespace — "I Have My Own Network"

### The Concept

Each network namespace gets its own:
- Network interfaces (eth0, lo)
- IP addresses
- Routing tables
- Firewall rules (iptables)
- Ports

It's like each apartment having its own phone line and mailbox. Two
apartments can both have someone answering on "extension 1" (port 80)
without conflict.

### See It in Action

Run two nginx containers, both listening on port 80 inside:

```bash
docker run -d --name web1 -p 8081:80 nginx
docker run -d --name web2 -p 8082:80 nginx
```

Both containers listen on port 80 inside their namespace. The `-p` flag
maps host ports to container ports. No conflict because each container
has its own network stack.

Check each container's IP:

```bash
docker inspect --format '{{.NetworkSettings.IPAddress}}' web1
docker inspect --format '{{.NetworkSettings.IPAddress}}' web2
```

```
172.17.0.2
172.17.0.3
```

Different IPs, different network namespaces.

Inside web1:

```bash
docker exec web1 ip addr
```

It sees its own `eth0` with its own IP. It has no knowledge of web2's
network.

### Using unshare for Network Namespaces

```bash
sudo unshare --net bash
```

Inside the new namespace:

```bash
ip link
```

```
1: lo: <LOOPBACK> mtu 65536 qdisc noop state DOWN mode DEFAULT group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
```

You only have a loopback interface. No `eth0`, no connection to the
outside world. Docker sets up virtual ethernet pairs (`veth`) to connect
the container's namespace to the host's network bridge.

Type `exit` to leave.

Clean up:

```bash
docker rm -f web1 web2
```

### How Docker Networking Works

Docker creates a virtual bridge network (like a virtual switch):

```
┌─────────────────────────────────────────┐
│                Host                      │
│                                          │
│    ┌──────────────────────────┐          │
│    │     docker0 bridge       │          │
│    │     (172.17.0.1)         │          │
│    └──┬──────────┬────────────┘          │
│       │          │                       │
│    ┌──┴──┐    ┌──┴──┐                    │
│    │veth1│    │veth2│    (host side)      │
│    └──┬──┘    └──┬──┘                    │
│ ------│----------│----------- namespace  │
│    ┌──┴──┐    ┌──┴──┐    boundaries      │
│    │eth0 │    │eth0 │    (container side) │
│    │.0.2 │    │.0.3 │                    │
│    └─────┘    └─────┘                    │
│   Container1  Container2                 │
└─────────────────────────────────────────┘
```

Each container gets a virtual ethernet interface (`veth`). One end is in
the container's namespace (seen as `eth0`), the other is on the host
bridge. The bridge handles routing between containers and to the outside
world.

---

## MNT Namespace — "I Have My Own Filesystem"

### The Concept

The mount namespace gives each container its own view of the filesystem.
A container can mount and unmount filesystems without affecting the host
or other containers.

It's like each apartment having its own set of shelves and closets. Your
neighbor adding a bookshelf doesn't affect your apartment's layout.

### How Containers Use It

When Docker starts a container, it:
1. Creates a new mount namespace
2. Mounts the container image as the root filesystem
3. Mounts `/proc`, `/sys`, and other special filesystems
4. Mounts any volumes the user specified

From inside the container, `/` is the image's root. The host's `/` is
invisible.

```bash
docker run --rm ubuntu ls /
```

```
bin  boot  dev  etc  home  lib  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var
```

This is Ubuntu's filesystem, not your host's.

```bash
docker run --rm alpine ls /
```

```
bin  dev  etc  home  lib  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var
```

Alpine's filesystem looks different (different packages, different
structure).

### Prove It's Isolated

```bash
docker run --rm ubuntu bash -c "touch /CONTAINER_FILE && ls /CONTAINER_FILE"
```

```
/CONTAINER_FILE
```

```bash
ls /CONTAINER_FILE
```

```
ls: /CONTAINER_FILE: No such file or directory
```

The file only exists inside the container's mount namespace.

### Using unshare for Mount Namespaces

```bash
sudo unshare --mount bash
```

Now you can mount things without affecting the host:

```bash
mkdir /tmp/test-mount
mount -t tmpfs tmpfs /tmp/test-mount
echo "hello" > /tmp/test-mount/test.txt
cat /tmp/test-mount/test.txt
```

From another terminal on the host, `/tmp/test-mount/test.txt` doesn't
exist. The mount is only visible in your namespace.

Type `exit` to leave.

---

## UTS Namespace — "I Have My Own Hostname"

### The Concept

UTS stands for "UNIX Time-Sharing" (historical name). It isolates the
hostname and domain name. Each container can have its own hostname without
affecting the host or other containers.

This is the simplest namespace. It's like each apartment having its own
name on the door — "The Smiths", "The Garcias" — even though they're all
at the same street address.

### See It in Action

```bash
docker run --rm ubuntu hostname
```

```
a1b2c3d4e5f6
```

The container gets a random hostname (its short container ID by default).

```bash
docker run --rm --hostname my-api ubuntu hostname
```

```
my-api
```

You can set it explicitly. This is useful when your application logs the
hostname or when services need to identify themselves.

### Using unshare

```bash
sudo unshare --uts bash
hostname container-test
hostname
```

```
container-test
```

The host's hostname is unchanged. Only this namespace sees the new name.

Type `exit` to leave.

### Why It Matters for Your Apps

In Go, `os.Hostname()` returns the container's hostname, not the host's.
If you're using the hostname for service discovery, logging, or distributed
tracing, you need to be aware of this.

```go
host, _ := os.Hostname()
log.Printf("Service running on %s", host)
```

In a container, this logs the container ID or whatever you set with
`--hostname`. Set meaningful hostnames for better observability:

```bash
docker run -d --hostname api-server-1 --name api myapp
```

---

## USER Namespace — "I Am Root (But Not Really)"

### The Concept

The user namespace maps user and group IDs between the namespace and the
host. A process can be root (UID 0) inside its namespace but map to an
unprivileged user (e.g., UID 65534) on the host.

This is like being the manager of your department (top authority within
that scope) but not being the CEO (top authority in the whole company).

### Why This Matters for Security

Without user namespaces, root in a container IS root on the host. If an
attacker escapes the container (exploiting a kernel vulnerability), they
have full root access to the host.

With user namespaces, root inside the container maps to nobody on the
host. Even if an attacker escapes, they're unprivileged.

### See the Mapping

Run a container and check the user:

```bash
docker run --rm ubuntu id
```

```
uid=0(root) gid=0(root) groups=0(root)
```

By default, Docker runs containers as root. This is root on the host too
(unless you've enabled user namespace remapping).

Better practice:

```bash
docker run --rm --user 1000:1000 ubuntu id
```

```
uid=1000 gid=1000 groups=1000
```

Now the container runs as a non-root user.

### In Dockerfiles

```dockerfile
FROM node:20-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --chown=appuser:appgroup . .
USER appuser
CMD ["node", "server.js"]
```

This creates a non-root user and switches to it before running your app.
Always do this in production.

### Using unshare

```bash
unshare --user --map-root-user bash
```

Now you're "root" inside the namespace:

```bash
id
```

```
uid=0(root) gid=0(root) groups=0(root)
```

But from another terminal:

```bash
ps aux | grep "unshare"
```

That process is running as your regular user, not root.

Type `exit` to leave.

---

## IPC Namespace — "My Own Message Board"

### The Concept

IPC (Inter-Process Communication) namespace isolates System V IPC objects
and POSIX message queues. Processes in different IPC namespaces can't
communicate through shared memory segments or message queues.

Think of it like office mail. Each department has its own internal mail
system. A memo in Engineering's inbox doesn't show up in Marketing's
inbox.

### When It Matters

Most Go and Node.js apps don't use System V IPC directly. But if you're
running databases (PostgreSQL uses shared memory), message brokers, or
legacy C/C++ applications, IPC isolation prevents interference between
containers.

```bash
docker run --rm ubuntu ipcs
```

```
------ Message Queues --------
key        msqid      owner      perms      used-bytes   messages

------ Shared Memory Segments --------
key        shmid      owner      perms      bytes      nattch     status

------ Semaphore Arrays --------
key        semid      owner      perms      nsems
```

Empty. The container has its own clean IPC namespace.

---

## How Docker Uses All Namespaces Together

When you run `docker run -d --name api -p 3000:3000 myapp`, Docker
creates a process with ALL of these namespaces:

```
docker run --name api myapp
    │
    ├── PID namespace  → api sees only its own processes (PID 1)
    ├── NET namespace  → api gets its own IP, ports, interfaces
    ├── MNT namespace  → api sees only its own filesystem
    ├── UTS namespace  → api has its own hostname
    ├── USER namespace → api has its own user mapping
    └── IPC namespace  → api has its own shared memory / semaphores
```

All of these are created with a single `clone()` syscall (or
`unshare()` + `setns()`):

```c
clone(child_fn,
      child_stack + STACK_SIZE,
      CLONE_NEWPID | CLONE_NEWNET | CLONE_NEWNS |
      CLONE_NEWUTS | CLONE_NEWUSER | CLONE_NEWIPC |
      SIGCHLD,
      NULL);
```

That single syscall creates what we call a "container." There's no
container object in the kernel. It's just a process with a bunch of
namespace flags.

---

## Viewing Namespaces on the Host

Every process has namespace references in `/proc/[pid]/ns/`:

```bash
docker run -d --name ns-demo ubuntu sleep 3600
CONTAINER_PID=$(docker inspect --format '{{.State.Pid}}' ns-demo)
sudo ls -la /proc/$CONTAINER_PID/ns/
```

```
lrwxrwxrwx 1 root root 0 Jan 15 10:00 cgroup -> 'cgroup:[4026532567]'
lrwxrwxrwx 1 root root 0 Jan 15 10:00 ipc -> 'ipc:[4026532495]'
lrwxrwxrwx 1 root root 0 Jan 15 10:00 mnt -> 'mnt:[4026532493]'
lrwxrwxrwx 1 root root 0 Jan 15 10:00 net -> 'net:[4026532497]'
lrwxrwxrwx 1 root root 0 Jan 15 10:00 pid -> 'pid:[4026532496]'
lrwxrwxrwx 1 root root 0 Jan 15 10:00 user -> 'user:[4026531837]'
lrwxrwxrwx 1 root root 0 Jan 15 10:00 uts -> 'uts:[4026532494]'
```

Each number in brackets is a namespace ID. Two processes with the same
namespace ID share that namespace. Two processes with different IDs are
isolated.

Compare to a host process:

```bash
sudo ls -la /proc/1/ns/
```

Different namespace IDs confirm the container process is isolated.

```bash
docker rm -f ns-demo
```

---

## Entering a Container's Namespace — What `docker exec` Really Does

When you run `docker exec -it mycontainer bash`, Docker:

1. Finds the container's main process PID on the host
2. Uses `setns()` to join ALL of that process's namespaces
3. Forks a new process (`bash`) inside those namespaces

It's like getting a temporary visitor badge to enter a specific department.
You can see what they see, use their resources, but you entered from
outside.

You can do this manually with `nsenter`:

```bash
docker run -d --name exec-demo ubuntu sleep 3600
CONTAINER_PID=$(docker inspect --format '{{.State.Pid}}' exec-demo)

sudo nsenter --target $CONTAINER_PID --pid --net --mount --uts --ipc bash
```

Now you're inside the container's namespaces. `ps aux` shows only the
container's processes. `hostname` shows the container's hostname.

This is exactly what `docker exec` does.

Type `exit` to leave. Then clean up:

```bash
docker rm -f exec-demo
```

---

## Namespace Sharing Between Containers

Sometimes you WANT containers to share namespaces. Docker supports this:

### Shared Network Namespace (Sidecar Pattern)

```bash
docker run -d --name main-app --network none ubuntu sleep 3600
docker run -d --name sidecar --network container:main-app ubuntu sleep 3600
```

Both containers share the same network namespace. They can communicate
over localhost. This is how Kubernetes pods work — all containers in a
pod share a network namespace.

### Shared PID Namespace

```bash
docker run -d --name app --pid host ubuntu sleep 3600
docker exec app ps aux
```

With `--pid host`, the container can see ALL host processes. Useful for
debugging, dangerous for security.

Clean up:

```bash
docker rm -f main-app sidecar app 2>/dev/null
```

---

## Exercises

### Exercise 1: PID Namespace Exploration

```bash
docker run -d --name ex1 ubuntu bash -c "while true; do sleep 1; done"
```

Questions:
1. What PID does the `bash` process have inside the container?
2. What PID does it have on the host?
3. If you `docker exec ex1 kill 1`, what happens?
4. Why?

Investigate using `docker exec`, `docker top`, and `docker inspect`.

Clean up: `docker rm -f ex1`

### Exercise 2: Network Namespace Isolation

```bash
docker run -d --name net1 -p 8081:80 nginx
docker run -d --name net2 -p 8082:80 nginx
```

Questions:
1. Can net1 reach net2 by IP address? (Hint: `docker exec net1 curl 172.17.0.3`)
2. Can net1 reach net2 by container name? Why or why not?
3. Create a user-defined network and try again. What changes?

```bash
docker network create mynet
docker run -d --name net3 --network mynet nginx
docker run -d --name net4 --network mynet nginx
docker exec net3 curl net4
```

User-defined networks provide DNS resolution by container name. The
default bridge network does not.

Clean up:

```bash
docker rm -f net1 net2 net3 net4
docker network rm mynet
```

### Exercise 3: Mount Namespace Verification

```bash
docker run -d --name mnt1 ubuntu bash -c "mkdir -p /data && echo 'from mnt1' > /data/file.txt && sleep 3600"
docker run -d --name mnt2 ubuntu bash -c "mkdir -p /data && echo 'from mnt2' > /data/file.txt && sleep 3600"
```

Questions:
1. What does `/data/file.txt` contain in mnt1?
2. What does it contain in mnt2?
3. Does `/data/file.txt` exist on the host?

```bash
docker exec mnt1 cat /data/file.txt
docker exec mnt2 cat /data/file.txt
```

Each container has its own `/data/file.txt`. They don't interfere.

Clean up: `docker rm -f mnt1 mnt2`

### Exercise 4: Build a "Container" Without Docker

This exercise uses `unshare` to create something container-like from
scratch. Requires a Linux system (not macOS Docker Desktop).

```bash
sudo unshare --pid --fork --mount-proc --net --uts bash
```

Inside your "container":

```bash
hostname my-container
hostname
ps aux
ip link
id
echo $$
```

You now have:
- Your own PID space (you're PID 1)
- Your own hostname
- Your own (empty) network
- But you still share the host's filesystem (no MNT isolation without
  more setup)

Type `exit` to return to the host.

### Exercise 5: Understand the Kubernetes Pod Model

Kubernetes pods share network and IPC namespaces between containers.
Simulate this with Docker:

```bash
docker run -d --name pod-infra --network none -p 8080:80 busybox sleep 3600

docker run -d --name pod-nginx \
  --network container:pod-infra \
  --ipc container:pod-infra \
  nginx

docker run -d --name pod-sidecar \
  --network container:pod-infra \
  --ipc container:pod-infra \
  busybox sleep 3600
```

Now `pod-nginx` and `pod-sidecar` share network and IPC. The sidecar can
reach nginx on `localhost:80`:

```bash
docker exec pod-sidecar wget -qO- http://localhost:80
```

This is the Kubernetes pod model. Same network, same IPC, separate PID
and filesystem.

Clean up:

```bash
docker rm -f pod-infra pod-nginx pod-sidecar
```

---

## What Would Happen If...

**Q: You disable all namespaces for a container?**

```bash
docker run --pid host --network host --uts host --ipc host ubuntu bash
```

This container can see all host processes, use the host's network directly,
has the host's hostname, and shares IPC. It's barely a "container" at
this point — just a process with cgroup limits.

**Q: Two containers share PID namespace but not NET?**

They can see each other's processes but can't communicate over network.
Each still has its own IP and ports.

**Q: A process inside a container tries to join a different namespace?**

It fails unless it has the `CAP_SYS_ADMIN` capability (or `--privileged`).
Namespace boundaries are enforced by the kernel.

**Q: You create thousands of namespaces?**

Each namespace has minimal kernel overhead. You can create thousands of
them on a modern system. This is why a single host can run hundreds of
containers — each with six namespaces — without breaking a sweat.

---

## Connecting to Go and TypeScript

### In Go

Go's `os/exec` package can set namespace flags:

```go
cmd := exec.Command("/bin/sh")
cmd.SysProcAttr = &syscall.SysProcAttr{
    Cloneflags: syscall.CLONE_NEWPID | syscall.CLONE_NEWNS | syscall.CLONE_NEWUTS,
}
cmd.Run()
```

This is literally how container runtimes work at the lowest level. They
fork a process with namespace flags.

### In TypeScript/Node.js

Node.js runs on V8 and doesn't have direct access to Linux syscalls for
namespace creation. But it's deeply affected by namespaces:

- `process.pid` returns the PID inside the container's PID namespace
- `os.hostname()` returns the UTS namespace hostname
- Network calls go through the NET namespace
- File operations go through the MNT namespace

Understanding namespaces helps you debug why your Node.js app can't reach
a service (NET namespace), why your process monitoring shows PID 1 (PID
namespace), or why `/etc/hosts` looks different than expected (MNT
namespace).

---

## Key Takeaways

1. Namespaces are a Linux kernel feature that provides isolation for
   system resources.

2. There are six primary namespaces used by containers: PID, NET, MNT,
   UTS, USER, and IPC.

3. A "container" is a process with all six namespaces applied. There's no
   magic container object in the kernel.

4. `docker exec` works by joining an existing process's namespaces using
   `setns()`.

5. Namespaces provide **isolation**, not **security**. A kernel exploit
   can break out of namespaces.

6. Kubernetes pods are containers that share NET and IPC namespaces.

---

## Next Lesson

Namespaces give isolation — each container thinks it's alone. But what
stops one container from eating all the CPU and memory on the host?
Lesson 03 covers **cgroups** — the resource limiting mechanism that acts
as a building manager setting utility limits per apartment.
