# Lesson 13: Docker — What Containers Actually Are

Docker is everywhere in modern development, but there is a common misconception about what containers actually are. They are NOT lightweight virtual machines. Understanding the real mechanism changes how you think about and use them.

---

## Containers Are NOT Lightweight VMs

A virtual machine runs a complete operating system with its own kernel on virtualized hardware. It is a full computer inside a computer.

A container is just a regular process running on the host's kernel, with some isolation applied. The "isolation" comes from Linux kernel features — not from virtualization.

| | Virtual Machine | Container |
|---|---|---|
| Kernel | Own kernel (full OS) | Shares host kernel |
| Boot time | Seconds to minutes | Milliseconds |
| Memory overhead | Hundreds of MB | Nearly zero |
| Isolation | Strong (hardware-level) | Good (kernel-level) |
| Density | Dozens per host | Hundreds per host |

---

## The Linux Features That Enable Containers

Three Linux kernel features make containers possible:

### 1. Namespaces: Isolated views

Namespaces give a process its own isolated view of system resources. The process thinks it has the whole system to itself, but it is actually sharing with everyone else.

| Namespace | What it isolates |
|-----------|-----------------|
| PID | Process IDs — container sees its main process as PID 1 |
| Network | Network interfaces, IP addresses, ports, routing tables |
| Mount | Filesystem mount points — container has its own root filesystem |
| UTS | Hostname — container can have its own hostname |
| User | User and group IDs — root inside container is not root on host |
| IPC | Inter-process communication |

### 2. cgroups: Resource limits

Control groups limit how much CPU, memory, and I/O a process can consume. Without cgroups, a runaway container could consume all host resources.

```bash
# Example: limit a container to 512MB RAM and 1 CPU
docker run --memory=512m --cpus=1 myapp
```

### 3. Union filesystems: Layered images

Container images are built in layers. Each layer adds, removes, or modifies files on top of the previous layer. Layers are shared between images, saving disk space and speeding up pulls.

**The analogy:** A container is like a soundproof room in an office building. It is the same building (kernel), same foundation, same plumbing. But each room is isolated — you cannot hear or see into other rooms. The building manager (cgroups) controls how much electricity each room gets. The room has its own furniture arrangement (mount namespace) even though it is in the same physical building.

---

## Docker Images

An image is an immutable, layered snapshot of a filesystem plus metadata (environment variables, default command, exposed ports).

### Dockerfile: Building an image

A Dockerfile is the recipe for building an image. Each instruction creates a layer.

```dockerfile
FROM rust:1.75-slim AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs
RUN cargo build --release
RUN rm -rf src
COPY src/ src/
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/myapp /usr/local/bin/myapp
EXPOSE 8080
CMD ["myapp"]
```

### Layer caching

Docker caches each layer. If nothing changed, it reuses the cached layer. This is why you copy `Cargo.toml` and `Cargo.lock` before copying source code — dependencies change less often than code, so the `cargo build` layer is cached most of the time.

Order your Dockerfile from least-changing to most-changing.

### Building images

```bash
docker build -t myapp .                  # build with tag "myapp"
docker build -t myapp:v1.2.3 .          # build with version tag
docker build -t myapp -f Dockerfile.dev .  # specify Dockerfile
docker build --no-cache -t myapp .       # force rebuild all layers
```

---

## Running Containers

### Basic commands

```bash
docker run myapp                         # run container from image
docker run -d myapp                      # run detached (background)
docker run -it ubuntu bash               # interactive terminal (for debugging)
docker run --rm myapp                    # remove container when it stops
docker run --name api myapp              # give it a name
docker run -d -p 8080:3000 myapp         # map host:8080 to container:3000
```

### Port mapping (-p)

```bash
docker run -d -p 8080:3000 myapp
# Host port 8080 → Container port 3000
# Access at http://localhost:8080

docker run -d -p 5433:5432 postgres:16
# Host port 5433 → Container's PostgreSQL port 5432
# Connect: psql -h localhost -p 5433

docker run -d -p 127.0.0.1:8080:3000 myapp
# Only accessible from localhost (not network)
```

### Environment variables

```bash
docker run -e DATABASE_URL="postgres://localhost/db" myapp
docker run --env-file .env myapp         # load from file
```

### Container lifecycle

```bash
docker ps                                # running containers
docker ps -a                             # all containers (including stopped)
docker stop container_name               # graceful stop (SIGTERM, then SIGKILL after timeout)
docker kill container_name               # immediate stop (SIGKILL)
docker start container_name              # start a stopped container
docker restart container_name            # stop then start
docker rm container_name                 # remove stopped container
docker rm -f container_name              # force remove (even if running)
```

### Inspecting containers

```bash
docker logs container_name               # stdout/stderr
docker logs -f container_name            # follow (live)
docker logs --tail 100 container_name    # last 100 lines
docker exec -it container_name bash      # shell into running container
docker exec container_name ls /app       # run a command in the container
docker inspect container_name            # detailed JSON metadata
docker stats                             # live CPU/memory usage for all containers
docker top container_name                # processes inside the container
```

---

## Volumes: Persistent Data

Containers are ephemeral — when removed, all data inside is lost. Volumes persist data outside the container's lifecycle.

### Named volumes

```bash
docker volume create pgdata
docker run -d -v pgdata:/var/lib/postgresql/data postgres:16

# Data persists even after container is removed
docker rm -f my-postgres
docker run -d -v pgdata:/var/lib/postgresql/data postgres:16
# Same data is still there
```

### Bind mounts (mount a host directory)

```bash
docker run -v $(pwd):/app myapp          # mount current dir into container
docker run -v $(pwd)/src:/app/src myapp  # mount just the source code
```

Bind mounts are essential for development — edit code on your host, see changes in the container.

### Volume management

```bash
docker volume ls                         # list volumes
docker volume inspect pgdata            # show volume details
docker volume rm pgdata                  # remove volume
docker volume prune                      # remove unused volumes
```

---

## Networking

### Bridge network (default)

Containers on the same bridge network can communicate by name:

```bash
docker network create mynet
docker run -d --name db --network mynet postgres:16
docker run -d --name api --network mynet -e DATABASE_URL="postgres://db:5432/myapp" myapp
# "api" container can reach "db" by hostname "db"
```

### Host network

Container uses the host's network directly (no port mapping needed):

```bash
docker run --network host myapp
# Container's port 3000 IS host's port 3000
```

macOS note: `--network host` does not work the same on macOS because Docker runs in a Linux VM. Use port mapping instead.

### Network commands

```bash
docker network ls                        # list networks
docker network inspect bridge           # inspect default network
docker network create mynet              # create custom network
docker network rm mynet                  # remove network
```

---

## Multi-Stage Builds

Multi-stage builds produce small production images by separating the build environment from the runtime environment.

### Rust example (produces a ~100MB image instead of ~2GB)

```dockerfile
FROM rust:1.75 AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/myapp /usr/local/bin/
CMD ["myapp"]
```

### Go example (produces a ~10MB image)

```dockerfile
FROM golang:1.22 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o server .

FROM alpine:3.19
COPY --from=builder /app/server /usr/local/bin/
CMD ["server"]
```

### Static Rust binary (scratch image — absolute minimum)

```dockerfile
FROM rust:1.75 AS builder
WORKDIR /app
COPY . .
RUN rustup target add x86_64-unknown-linux-musl
RUN cargo build --release --target x86_64-unknown-linux-musl

FROM scratch
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/myapp /myapp
CMD ["/myapp"]
```

The `scratch` image is completely empty — no shell, no OS, nothing. Your static binary is the only thing in the image. Image size: just your binary.

---

## Cleanup

Docker accumulates images, containers, volumes, and networks over time:

```bash
docker system df                         # show Docker disk usage
docker system prune                      # remove stopped containers, unused networks, dangling images
docker system prune -a                   # also remove unused images (not just dangling)
docker image prune                       # remove dangling images
docker container prune                   # remove stopped containers
docker volume prune                      # remove unused volumes
```

---

## Exercises

### Exercise 1: Run and inspect containers

```bash
# Run a container
docker run -d --name test-nginx -p 8888:80 nginx:alpine

# Verify it's running
docker ps
curl http://localhost:8888

# Look at the logs
docker logs test-nginx

# Shell into the container
docker exec -it test-nginx sh
# Inside: ls /etc/nginx/
# Inside: cat /etc/nginx/nginx.conf
# Inside: exit

# Check resource usage
docker stats --no-stream

# Clean up
docker stop test-nginx
docker rm test-nginx
```

### Exercise 2: Build a custom image

Create a simple project:

```bash
mkdir -p /tmp/docker-exercise
cat > /tmp/docker-exercise/server.py <<'EOF'
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

port = int(os.environ.get('PORT', '8080'))
print(f"Starting server on port {port}")
httpd = HTTPServer(('0.0.0.0', port), SimpleHTTPRequestHandler)
httpd.serve_forever()
EOF

cat > /tmp/docker-exercise/Dockerfile <<'EOF'
FROM python:3.12-slim
WORKDIR /app
COPY server.py .
ENV PORT=8080
EXPOSE 8080
CMD ["python", "server.py"]
EOF

cd /tmp/docker-exercise
docker build -t my-server .
docker run -d --name my-server -p 9999:8080 my-server
curl http://localhost:9999

# Clean up
docker stop my-server
docker rm my-server
docker rmi my-server
rm -rf /tmp/docker-exercise
```

### Exercise 3: Volumes

```bash
# Create a volume
docker volume create testdata

# Write data to it
docker run --rm -v testdata:/data alpine sh -c 'echo "persistent data" > /data/test.txt'

# Read it from a new container (data persists)
docker run --rm -v testdata:/data alpine cat /data/test.txt

# Clean up
docker volume rm testdata
```

### Exercise 4: Container networking

```bash
# Create a network
docker network create exercise-net

# Run two containers on the same network
docker run -d --name server --network exercise-net nginx:alpine
docker run --rm --network exercise-net alpine wget -q -O- http://server:80

# The second container can reach "server" by name
# Without the shared network, this would fail

# Clean up
docker stop server
docker rm server
docker network rm exercise-net
```

---

Next: [Lesson 14 — Docker Compose](./14-docker-compose.md)
