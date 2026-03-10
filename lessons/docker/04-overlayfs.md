# Lesson 04: Union Filesystems and OverlayFS

---

## The Overhead Projector Analogy

Remember overhead projectors from school? The teacher would stack
transparent sheets on top of each other. The bottom sheet might have a
map. The next sheet adds city names. The next adds roads. The projector
shows you the combined result — you see the map with cities and roads, as
if it were one image.

If the teacher wants to update just the roads, they replace only the roads
sheet. The map and cities stay the same.

That's exactly how container filesystems work. Each layer is a transparent
sheet. The bottom layers are read-only (the base image). You see the
combined result as if it's a single filesystem. When a running container
writes a file, it goes on a new writable layer on top — never modifying
the layers below.

---

## How OverlayFS Works

OverlayFS is a union filesystem — it merges multiple directories into a
single unified view. Docker uses OverlayFS (specifically `overlay2`) as
its default storage driver.

### The Three Directories

```
┌─────────────────────────────┐
│         merged              │  ← What you see inside the container
│    (unified view)           │     This is the container's root filesystem
├─────────────────────────────┤
│         upper               │  ← Read-write layer (container's changes)
│    (container layer)        │     New files, modified files, deleted files
├─────────────────────────────┤
│         lower               │  ← Read-only layers (image layers)
│    (image layers)           │     Stacked: layer1 + layer2 + layer3...
└─────────────────────────────┘
```

**Lower directory (lowerdir):** Read-only layers from the image. Multiple
directories stacked on top of each other.

**Upper directory (upperdir):** A single read-write layer. All container
writes go here.

**Merged directory (merged):** The unified view presented to the container.
It looks like a single filesystem.

**Work directory (workdir):** Internal scratch space for OverlayFS
operations. You never interact with this directly.

### What Happens During Different Operations

**Reading a file that exists in a lower layer:**
OverlayFS looks through the layers top-down. If the file is in the upper
layer, return it. Otherwise, check each lower layer from top to bottom.
Return the first match.

**Writing a new file:**
The file is created directly in the upper layer. Lower layers are
untouched.

**Modifying an existing file (copy-on-write):**
The file is copied from the lower layer to the upper layer. The
modification happens on the copy. The original in the lower layer is
unchanged. Future reads return the upper layer's version.

**Deleting a file:**
A special "whiteout" file is created in the upper layer. This tells
OverlayFS to hide the file from the lower layer. The file still exists
in the lower layer but is invisible in the merged view.

### Copy-on-Write in Practice

Think of it like a library reference book. You can't write in the
original (it's read-only). But you can photocopy the page, write on
the photocopy, and put the photocopy in front of the original. Anyone
looking at the shelf sees your modified copy first.

```
Container writes to /etc/nginx/nginx.conf:

Before:
  merged/etc/nginx/nginx.conf → lower/etc/nginx/nginx.conf (original)

During write:
  1. Copy lower/etc/nginx/nginx.conf → upper/etc/nginx/nginx.conf
  2. Apply modification to upper/etc/nginx/nginx.conf

After:
  merged/etc/nginx/nginx.conf → upper/etc/nginx/nginx.conf (modified copy)
  lower/etc/nginx/nginx.conf still exists unchanged
```

---

## Image Layers — How Docker Images Are Built

Every instruction in a Dockerfile that modifies the filesystem creates a
new layer. Let's trace through a Dockerfile:

```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y curl
COPY app.js /app/app.js
RUN chmod +x /app/app.js
```

This creates the following layers:

```
Layer 4: chmod +x /app/app.js              (tiny — just metadata change)
Layer 3: COPY app.js → /app/app.js         (your application file)
Layer 2: apt-get install curl              (curl binary + dependencies)
Layer 1: Ubuntu 22.04 base image           (the full Ubuntu userspace)
```

Each layer is a directory containing only the files that changed in that
step. Layer 2 doesn't contain all of Ubuntu + curl — it only contains
the new files that `apt-get install` added.

### See the Layers

```bash
docker pull nginx:alpine
docker history nginx:alpine
```

```
IMAGE          CREATED       CREATED BY                                      SIZE
a1b2c3d4e5f6   2 weeks ago  CMD ["nginx" "-g" "daemon off;"]                0B
<missing>      2 weeks ago  STOPSIGNAL SIGQUIT                              0B
<missing>      2 weeks ago  EXPOSE map[80/tcp:{}]                           0B
<missing>      2 weeks ago  ENTRYPOINT ["/docker-entrypoint.sh"]            0B
<missing>      2 weeks ago  COPY 30-tune-worker-processes.sh /docker-...    4.62kB
<missing>      2 weeks ago  COPY 20-envsubst-on-templates.sh /docker-...    3.02kB
<missing>      2 weeks ago  COPY 15-local-resolvers.envsh /docker-ent...    298B
<missing>      2 weeks ago  COPY 10-listen-on-ipv6-by-default.sh /doc...    2.12kB
<missing>      2 weeks ago  COPY docker-entrypoint.sh / /docker-entry...    1.62kB
<missing>      2 weeks ago  RUN /bin/sh -c set -x     && addgroup -g ...    17.7MB
<missing>      2 weeks ago  ENV DYNPKG_RELEASE=2                            0B
<missing>      2 weeks ago  ENV NJS_RELEASE=1~alpine3.19                    0B
<missing>      2 weeks ago  ENV NJS_VERSION=0.8.2                           0B
<missing>      2 weeks ago  ENV PKG_RELEASE=1                               0B
<missing>      2 weeks ago  ENV NGINX_VERSION=1.25.3                        0B
<missing>      2 weeks ago  LABEL maintainer=NGINX Docker Maintainers ...   0B
<missing>      2 weeks ago  /bin/sh -c #(nop) ADD file:1f4eb46669b5b...     7.38MB
```

Notice: ENV, LABEL, CMD, EXPOSE, ENTRYPOINT create **0B** layers. They
only add metadata, no filesystem changes. The big layers are the `ADD`
(base Alpine image) and `RUN` (nginx installation).

### Detailed Layer Inspection

```bash
docker inspect nginx:alpine | jq '.[0].RootFS.Layers'
```

```json
[
  "sha256:4693057ce236...",
  "sha256:2e8e5d8e8f70...",
  "sha256:9a867a8e0f3b...",
  "sha256:51dc63f6e1e4...",
  "sha256:a3c92abc7b14...",
  "sha256:f2ba1c9c2f7e...",
  "sha256:e1d0d7c5b8f3..."
]
```

Each SHA256 hash uniquely identifies a layer. These are content-addressed
— the hash is derived from the layer's contents.

---

## Layer Sharing — Why This Saves Disk Space

Here's where OverlayFS really shines. Imagine 50 containers all running
`node:20-alpine`. Without layer sharing, you'd need 50 copies of the
Node.js Alpine image (roughly 180MB each = 9GB).

With layer sharing, there's ONE copy of the base layers. Each container
only stores its own upper layer (the changes it made). If most containers
haven't modified anything, they use almost zero additional disk space.

```
Container A: upper-A + shared-lower-layers
Container B: upper-B + shared-lower-layers
Container C: upper-C + shared-lower-layers
...
Container Z: upper-Z + shared-lower-layers
```

The shared lower layers exist only once on disk. 50 containers running
the same image might use 180MB + (50 * a few KB) instead of 50 * 180MB.

### Prove It

```bash
docker run -d --name share1 nginx:alpine sleep 3600
docker run -d --name share2 nginx:alpine sleep 3600
docker run -d --name share3 nginx:alpine sleep 3600

docker system df -v | head -20
```

Look at the "SHARED SIZE" column. The image data is shared across all
three containers.

```bash
docker rm -f share1 share2 share3
```

### Same Base, Different Apps

```bash
docker pull node:20-alpine
docker pull node:20-alpine  # already cached
```

If you build two images:

```dockerfile
FROM node:20-alpine
COPY app-a/ /app/
```

```dockerfile
FROM node:20-alpine
COPY app-b/ /app/
```

Both images share all the `node:20-alpine` layers. Only the COPY layers
differ. If `node:20-alpine` is 180MB and each app is 5MB, the total disk
usage is 180MB + 5MB + 5MB = 190MB, not 370MB.

---

## docker commit — Turning a Container Into an Image

When you run `docker commit`, Docker takes the container's upper layer
(all the changes) and creates a new image layer from it.

```bash
docker run -it --name customized ubuntu bash
```

Inside the container:

```bash
apt-get update && apt-get install -y vim curl git
echo "custom config" > /etc/my-config.txt
exit
```

Back on the host:

```bash
docker commit customized my-custom-ubuntu:v1
docker history my-custom-ubuntu:v1
```

The new image has all the Ubuntu layers PLUS one new layer containing
vim, curl, git, and your config file.

**Don't use `docker commit` in production.** It creates opaque,
unreproducible images. Always use Dockerfiles for reproducibility.

---

## Where Are Layers Stored on Disk?

Docker stores layers in `/var/lib/docker/overlay2/`:

```bash
ls /var/lib/docker/overlay2/
```

```
a1b2c3d4e5f6...
b2c3d4e5f6a7...
c3d4e5f6a7b8...
l/
```

Each directory is a layer. The `l/` directory contains short symbolic
links to layer directories (for performance — overlay2 needs short paths).

Inside a layer directory:

```bash
ls /var/lib/docker/overlay2/a1b2c3d4e5f6.../
```

```
diff/       # The actual layer content (files)
link        # Short ID linking to l/ directory
lower       # References to parent layers
merged/     # Union mount point (only for running containers)
work/       # OverlayFS work directory
```

The `diff/` directory contains only the files that this layer adds or
modifies. If this layer installs nginx, `diff/` contains the nginx binary
and its dependencies — nothing else.

---

## Understanding Whiteout Files

When a container deletes a file that exists in a lower layer, OverlayFS
can't actually delete it (lower layers are read-only). Instead, it creates
a special whiteout file in the upper layer.

```bash
docker run -it --name whiteout-demo ubuntu bash
```

Inside:

```bash
ls /etc/motd
rm /etc/motd
exit
```

Now inspect the container's upper layer:

```bash
LAYER=$(docker inspect whiteout-demo --format '{{.GraphDriver.Data.UpperDir}}')
ls -la $LAYER/etc/
```

You'll see a character device file with major/minor 0/0 named `.wh.motd`.
That's the whiteout file. It tells OverlayFS: "hide `/etc/motd` from the
lower layers."

Whiteout files for directories work similarly. Deleting a directory creates
an opaque whiteout that hides the entire directory tree below.

```bash
docker rm whiteout-demo
```

---

## Performance Implications

### Copy-on-Write Latency

The first write to a large file from a lower layer triggers a full copy.
If that file is 500MB (like a database file), the first write copies
500MB to the upper layer. Subsequent writes to the same file are fast
(they modify the copy).

This is why databases should ALWAYS use volumes, not the container's
overlay filesystem:

```bash
docker run -d --name db -v pgdata:/var/lib/postgresql/data postgres
```

The volume bypasses OverlayFS entirely. Reads and writes go directly to
the underlying filesystem.

### Layer Count

Each layer adds a tiny amount of overhead to file lookups (OverlayFS
checks each layer top-down). Docker limits the number of lower layers
(typically 128). Excessive layers make builds slower and image pulls
larger.

Minimize layers by combining related operations:

```dockerfile
RUN apt-get update && \
    apt-get install -y curl wget vim && \
    rm -rf /var/lib/apt/lists/*
```

Instead of three separate RUN instructions.

### Inode Exhaustion

Each layer consumes inodes. Running many containers with many layers
can exhaust the filesystem's inode table. Monitor with `df -i`.

---

## Practical Examples

### Seeing Layer Differences

Build an image and examine each layer:

```bash
mkdir /tmp/layer-demo && cd /tmp/layer-demo

cat > Dockerfile <<'EOF'
FROM alpine:3.19
RUN echo "layer 2" > /file2.txt
RUN echo "layer 3" > /file3.txt
COPY local-file.txt /file4.txt
EOF

echo "local content" > local-file.txt
docker build -t layer-demo .
```

Inspect the layers:

```bash
docker history layer-demo
```

Each RUN and COPY created a distinct layer.

### Image Size Analysis with dive

The `dive` tool (github.com/wagoodman/dive) lets you explore each layer
interactively:

```bash
docker run --rm -it \
  -v /var/run/docker.sock:/var/run/docker.sock \
  wagoodman/dive layer-demo
```

You can see exactly which files each layer adds, their sizes, and wasted
space.

### Finding Wasted Space

A common mistake — downloading a file, using it, and deleting it in
separate layers:

```dockerfile
RUN curl -O https://example.com/big-file.tar.gz
RUN tar xzf big-file.tar.gz
RUN rm big-file.tar.gz
```

The `rm` creates a whiteout file in layer 3, but the original file still
exists in layer 1. The image contains both the file AND the whiteout.
The image size includes `big-file.tar.gz` even though it's "deleted."

Fix: do it all in one layer:

```dockerfile
RUN curl -O https://example.com/big-file.tar.gz && \
    tar xzf big-file.tar.gz && \
    rm big-file.tar.gz
```

Now the file is created and deleted in the same layer. It never appears
in the final layer.

Clean up: `rm -rf /tmp/layer-demo`

---

## How This Relates to Your Workflow

### Go Applications

A typical Go service image might have these layers:

```
Layer 1: Alpine base (7MB)
Layer 2: CA certificates (200KB)
Layer 3: Your Go binary (15MB)
───────────────────────────
Total: ~22MB
```

Using `scratch` (empty) base:

```
Layer 1: CA certificates (200KB) — COPY from builder
Layer 2: Your Go binary (15MB) — COPY from builder
───────────────────────────
Total: ~15MB
```

Since Go compiles to a static binary, you don't need any OS layer. The
binary IS the entire filesystem.

### Node.js Applications

Node.js images have more layers due to dependencies:

```
Layer 1: Alpine base (7MB)
Layer 2: Node.js runtime (50MB)
Layer 3: node_modules (150MB)
Layer 4: Your application code (2MB)
───────────────────────────
Total: ~209MB
```

When you update your code (layer 4), layers 1-3 are cached. Only 2MB
needs to be rebuilt and pushed. This is why separating `npm install`
from `COPY .` matters — it preserves the expensive `node_modules`
cache.

---

## Exercises

### Exercise 1: Observe Copy-on-Write

```bash
docker run -d --name cow-demo nginx:alpine sleep 3600
```

Check the upper layer (container's writable layer):

```bash
docker inspect cow-demo --format '{{.GraphDriver.Data.UpperDir}}'
```

```bash
sudo ls $(docker inspect cow-demo --format '{{.GraphDriver.Data.UpperDir}}')
```

It should be mostly empty (the container hasn't written anything yet).

Now write a file inside the container:

```bash
docker exec cow-demo sh -c "echo 'hello' > /tmp/test.txt"
```

Check the upper layer again:

```bash
sudo ls -R $(docker inspect cow-demo --format '{{.GraphDriver.Data.UpperDir}}')
```

You'll see `tmp/test.txt` in the upper directory. The lower layers are
untouched.

Now modify a file that exists in a lower layer:

```bash
docker exec cow-demo sh -c "echo 'modified' >> /etc/hostname"
```

Check the upper layer:

```bash
sudo ls -R $(docker inspect cow-demo --format '{{.GraphDriver.Data.UpperDir}}')
```

`etc/hostname` now appears in the upper layer — it was copied up from
the lower layer and then modified.

Clean up: `docker rm -f cow-demo`

### Exercise 2: Layer Size Investigation

```bash
cat > /tmp/Dockerfile.sizes <<'EOF'
FROM alpine:3.19
RUN dd if=/dev/zero of=/bigfile bs=1M count=50
RUN rm /bigfile
EOF

docker build -t size-test -f /tmp/Dockerfile.sizes /tmp
docker images size-test
```

Questions:
1. How big is the image?
2. Is it ~50MB larger than Alpine even though the file was deleted?
3. Why?

Now fix it:

```bash
cat > /tmp/Dockerfile.sizes2 <<'EOF'
FROM alpine:3.19
RUN dd if=/dev/zero of=/bigfile bs=1M count=50 && rm /bigfile
EOF

docker build -t size-test2 -f /tmp/Dockerfile.sizes2 /tmp
docker images size-test2
```

Compare the sizes. The second image should be much smaller.

Clean up: `docker rmi size-test size-test2`

### Exercise 3: Layer Sharing Proof

```bash
docker pull alpine:3.19

cat > /tmp/Dockerfile.app1 <<'EOF'
FROM alpine:3.19
RUN echo "app1" > /app.txt
EOF

cat > /tmp/Dockerfile.app2 <<'EOF'
FROM alpine:3.19
RUN echo "app2" > /app.txt
EOF

docker build -t app1 -f /tmp/Dockerfile.app1 /tmp
docker build -t app2 -f /tmp/Dockerfile.app2 /tmp

docker system df -v
```

Look at the shared size. Both images share the Alpine base layer.

Clean up: `docker rmi app1 app2`

### Exercise 4: Whiteout Files

```bash
docker run -it --name whiteout ubuntu bash -c \
  "ls -la /etc/legal && rm /etc/legal && exit"
```

Inspect the upper layer:

```bash
UPPER=$(docker inspect whiteout --format '{{.GraphDriver.Data.UpperDir}}')
sudo ls -la $UPPER/etc/
```

Look for the `.wh.legal` whiteout file. This is how OverlayFS "deletes"
files from read-only layers.

Clean up: `docker rm whiteout`

### Exercise 5: Volume vs Overlay Performance

Create a large file using overlay (container filesystem):

```bash
docker run --rm --name perf-overlay alpine sh -c \
  "time dd if=/dev/zero of=/tmp/testfile bs=1M count=500 conv=fdatasync 2>&1"
```

Create a large file using a volume:

```bash
docker volume create perf-vol
docker run --rm --name perf-volume -v perf-vol:/data alpine sh -c \
  "time dd if=/dev/zero of=/data/testfile bs=1M count=500 conv=fdatasync 2>&1"
```

Compare the write speeds. The volume should be faster because it bypasses
the overlay filesystem.

Clean up: `docker volume rm perf-vol`

---

## What Would Happen If...

**Q: You modify the same file in two different containers running the same
image?**

Each container has its own upper layer. Container A's modification goes
to upper-A. Container B's modification goes to upper-B. The lower layers
(shared image) are untouched. Neither container sees the other's changes.

**Q: You run 1000 containers from the same image?**

The image layers exist only once on disk. Each container gets a thin upper
layer (initially empty). Storage usage is: image_size + (1000 * almost
nothing).

**Q: A container modifies a 2GB database file in a lower layer?**

The entire 2GB file is copied to the upper layer (copy-on-write). The
container now uses 2GB of extra storage. This is why databases MUST use
volumes.

**Q: You delete the only running container using an image layer?**

The layer is still stored on disk (the image reference keeps it alive).
Only `docker rmi` or `docker image prune` removes unreferenced layers.

**Q: You `docker save` an image and load it on another machine?**

All layers are packed into a tar archive. On the other machine, layers
are unpacked. If the other machine already has some of those layers (same
SHA256), they're deduplicated.

---

## Key Takeaways

1. OverlayFS merges read-only lower layers (the image) with a read-write
   upper layer (the container) into a single unified view.

2. Writes use copy-on-write: the file is copied from lower to upper on
   first modification. Lower layers are never changed.

3. Deletes create whiteout files that hide lower-layer files without
   actually deleting them.

4. Image layers are shared between containers. Running 100 containers
   from the same image uses barely more disk than running 1.

5. Files "deleted" in a later Dockerfile layer still exist in earlier
   layers and increase image size. Combine operations in single RUN
   instructions.

6. Databases and write-heavy workloads should use volumes to bypass the
   overlay filesystem.

---

## Next Lesson

You now understand the three pillars of containers: namespaces (isolation),
cgroups (resource limits), and overlayfs (layered filesystems). But who
actually puts all of this together? When you type `docker run`, what
software stack actually creates the container? Lesson 05 covers the
**container runtime ecosystem** — Docker, containerd, runc, and the OCI
specifications.
