# Systems Programming, DevOps & AI Learning Path

A self-taught path to systems programming, infrastructure, and AI competency.
Each track is independent — work through them in parallel or sequentially.

---

## Recommended Order

Start with **Track 1 and Track 4 in parallel** (Rust is your language,
Linux is your environment). Then add databases and the rest.
Docker before Kubernetes. ML before LLMs.

```
Week 1-2:   Rust (Track 1) + Linux Fundamentals (Track 4)
Week 3-4:   Databases (Track 2) + Data Structures (Track 5)
Week 5-6:   OS Concepts (Track 3) + Networking (Track 6)
Week 7-8:   ML Fundamentals (Track 7)
Week 9-10:  LLMs & Transformers (Track 8)
Week 11-12: Docker Deep Dive (Track 9)
Week 13-14: Kubernetes (Track 10)
Week 15-17: System Design (Track 11)
Week 18-20: Security & Cryptography (Track 12)
Week 21-23: Compilers & Interpreters (Track 13)
Week 24+:   Build projects combining everything
```

---

## Track 1: Rust
**[→ Start here](./rust/00-roadmap.md)**
20 lessons — ownership, traits, async, building real programs.
*Status: Complete*

## Track 2: Databases
**[→ Start here](./databases/00-roadmap.md)**
22 lessons — PostgreSQL internals, SQL, schema design, Rust/sqlx.
*Status: Complete*

## Track 3: Operating Systems
**[→ Start here](./os-concepts/00-roadmap.md)**
16 lessons — processes, memory, threads, syscalls, file systems.
*Status: Complete*

## Track 4: Linux/Unix Fundamentals
**[→ Start here](./linux-fundamentals/00-roadmap.md)**
18 lessons — shell, processes, Docker, SSH, debugging tools.
*Status: Complete*

## Track 5: Data Structures & Algorithms
**[→ Start here](./data-structures/00-roadmap.md)**
16 lessons — arrays, hash maps, trees, graphs, caching. In Rust.
*Status: Complete*

## Track 6: Networking
**[→ Start here](./networking/00-roadmap.md)**
18 lessons — TCP/IP, HTTP, TLS, sockets, building servers in Rust.
*Status: Complete*

## Track 7: Machine Learning Fundamentals
**[→ Start here](./ml-fundamentals/00-roadmap.md)**
14 lessons — linear regression, neural networks, CNNs, embeddings. In Python.
*Status: Complete*

## Track 8: LLMs & Transformers
**[→ Start here](./llms-transformers/00-roadmap.md)**
16 lessons — attention, transformer architecture, GPT, RLHF, chat-model alignment.
*Status: Complete*

## Track 9: Docker Deep Dive
**[→ Start here](./docker/00-roadmap.md)**
18 lessons — namespaces, cgroups, overlayfs, images, networking, compose, security.
*Status: Complete*

## Track 10: Kubernetes
**[→ Start here](./kubernetes/00-roadmap.md)**
20 lessons — Pods, Deployments, Services, Ingress, Helm, RBAC, observability.
*Status: Complete*

## Track 11: System Design
**[→ Start here](./system-design/00-roadmap.md)**
22 lessons — scaling, caching, databases, queues, microservices, real-world designs.
*Status: Complete*

## Track 12: Security & Cryptography
**[→ Start here](./security-cryptography/00-roadmap.md)**
22 lessons — hashing, encryption, TLS, OWASP Top 10, auth, secrets, threat modeling.
*Status: Complete*

## Track 13: Compilers & Interpreters
**[→ Start here](./compilers-interpreters/00-roadmap.md)**
22 lessons — lexers, parsers, ASTs, interpreters, type checkers, bytecode VMs, LLVM.
*Status: Complete*

---

## Total: ~244 lessons across 13 tracks

Estimated time: 23-27 weeks at ~2 hours/day, or 12-14 weeks at ~4 hours/day.

---

## Project Ideas (after finishing tracks)

| Project | Tracks it exercises |
|---------|-------------------|
| Build a key-value store | Rust, OS, Data Structures |
| Build a load balancer | Rust, Networking, Linux |
| Build a static site generator | Rust, Linux |
| Build a REST API with auth | Rust, Databases, Networking |
| Build a log aggregator | Rust, Linux, Networking |
| Build a simple database | Rust, OS, Data Structures, Databases |
| Build a container runtime | Rust, OS, Linux |
| Build a mini transformer | ML, LLMs, Python |
| Build an LLM-powered CLI tool | Rust, LLMs, Networking |
| Fine-tune a small language model | ML, LLMs, Linux |
| Deploy a microservices app on K8s | Docker, Kubernetes, Networking |
| Build a CI/CD pipeline | Docker, Kubernetes, Linux |
| Create a Helm chart for your app | Kubernetes, Docker |
| Build a K8s operator in Go | Kubernetes, Go, Rust |
| Design and build a URL shortener | System Design, Databases, Rust |
| Build a real-time chat system | System Design, Networking, Docker |
| Design a distributed task queue | System Design, Message Queues, Rust |
| Build an encrypted file vault | Security, Cryptography, Rust |
| Implement OAuth 2.0 from scratch | Security, Networking, Go/TS |
| Build a secrets manager CLI | Security, Cryptography, Rust |
| Build a programming language | Compilers, Data Structures, Rust |
| Build a Lua/Lisp interpreter | Compilers, OS Concepts |
| Write a linter for your language | Compilers, ASTs, Go |
