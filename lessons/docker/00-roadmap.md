# Docker Deep Dive — Containers From the Ground Up

You touched Docker in the Linux track. Now we go deep — how containers
actually work under the hood (namespaces, cgroups, overlayfs), building
production-grade images, multi-stage builds, networking, volumes,
Docker Compose patterns, and security.

Think of this as "you used Docker as a user, now understand it as an engineer."

Prerequisites: Track 3 (OS Concepts), Track 4 (Linux Fundamentals)

---

## Reference Files

- [Dockerfile Cheat Sheet](./reference-dockerfile.md) — Best practices and patterns
- [Docker CLI Cheat Sheet](./reference-cli.md) — Essential commands quick reference

---

## The Roadmap

### Phase 1: How Containers Actually Work (Hours 1–10)
- [ ] [Lesson 01: What containers really are — not VMs](./01-containers-vs-vms.md)
- [ ] [Lesson 02: Linux namespaces — isolation from the inside](./02-namespaces.md)
- [ ] [Lesson 03: cgroups — resource limits and accounting](./03-cgroups.md)
- [ ] [Lesson 04: Union filesystems and OverlayFS — layers explained](./04-overlayfs.md)
- [ ] [Lesson 05: The container runtime — containerd, runc, OCI](./05-container-runtime.md)

### Phase 2: Building Images Like a Pro (Hours 11–20)
- [ ] [Lesson 06: Dockerfiles — FROM, RUN, COPY and the build context](./06-dockerfiles.md)
- [ ] [Lesson 07: Image layers and caching — why order matters](./07-layers-caching.md)
- [ ] [Lesson 08: Multi-stage builds — small, secure production images](./08-multi-stage.md)
- [ ] [Lesson 09: Base images — Alpine vs Debian vs distroless vs scratch](./09-base-images.md)
- [ ] [Lesson 10: Image security — scanning, signing, supply chain](./10-image-security.md)

### Phase 3: Networking, Storage, and Compose (Hours 21–32)
- [ ] [Lesson 11: Docker networking — bridge, host, overlay, none](./11-networking.md)
- [ ] [Lesson 12: Volumes and bind mounts — persistent data](./12-volumes.md)
- [ ] [Lesson 13: Docker Compose deep dive — services, depends_on, profiles](./13-compose-deep.md)
- [ ] [Lesson 14: Environment variables, secrets, and configuration](./14-env-secrets.md)
- [ ] [Lesson 15: Health checks and restart policies](./15-healthchecks.md)

### Phase 4: Production Patterns (Hours 33–40)
- [ ] [Lesson 16: Logging and monitoring in containers](./16-logging.md)
- [ ] [Lesson 17: Docker in CI/CD — GitHub Actions, build caches](./17-cicd.md)
- [ ] [Lesson 18: Container security — rootless, read-only, seccomp, AppArmor](./18-security.md)

---

## How to use these lessons

Every lesson has:
1. Concept explained with everyday analogies
2. Hands-on exercises you run on your machine
3. Go/TypeScript comparisons where relevant (build tooling, deployment)
4. "Under the hood" sections showing what Docker is actually doing
5. Common mistakes and how to avoid them
