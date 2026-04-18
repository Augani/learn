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

## Track 14: Math Foundations
**[→ Start here](./math-foundations/00-roadmap.md)**
9 lessons — vectors, matrices, dot products, derivatives, gradients, chain rule, probability, MLE, and the math-to-ML map.
*Status: Complete*

## Track 15: GPU & CUDA Fundamentals
**[→ Start here](./gpu-cuda-fundamentals/00-roadmap.md)**
11 lessons — CPU vs GPU architecture, memory hierarchy, CUDA programming, tensor ops, ML hardware, multi-GPU, profiling, capstone.
*Status: Complete*

## Track 16: ML Glossary
**[→ Start here](./ml-glossary/00-roadmap.md)**
7 lessons — model sizes, quantization, training terminology, architecture terminology, scaling, modern LLM terms, data & evaluation. Use as a companion alongside any ML/AI track.
*Status: Complete*

## Track 17: Scale & Infrastructure
**[→ Start here](./ml-scale-infrastructure/00-roadmap.md)**
9 lessons — training data pipelines, compute planning, distributed training, pre-training & post-training pipelines, cost estimation, evaluation at scale.
*Status: Complete*

## Track 18: Build & Deploy LLM Capstone
**[→ Start here](./build-deploy-llm/00-roadmap.md)**
9 lessons — build a small transformer from scratch, train it, optimize, export to ONNX, deploy to browser and CLI. The capstone project.
*Status: Complete*

---

## Total: ~289 lessons across 18 tracks

Estimated time: 30-38 weeks at ~2 hours/day, or 15-19 weeks at ~4 hours/day.

---

## ML/AI Deep Dive Path

A recommended sequential path through all ML/AI tracks — from math foundations
to building and deploying your own language model.

```
  ┌─────────────────┐
  │ Math Foundations │  (Track 14)
  │   (9 lessons)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │  GPU & CUDA     │  (Track 15)
  │  (11 lessons)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ ML Fundamentals │  (Track 7)
  │  (14 lessons)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ LLMs &          │  (Track 8)
  │ Transformers    │
  │  (16 lessons)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐     ┌──────────────────┐
  │  Applied ML     │     │   ML Glossary    │  (Track 16)
  │  (18 lessons)   │◄───►│  (7 lessons)     │
  └────────┬────────┘     │  companion ref   │
           │              └──────────────────┘
  ┌────────▼────────┐
  │ Advanced Deep   │
  │ Learning        │
  │  (16 lessons)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ AI Engineering  │
  │  (20 lessons)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ Scale &         │  (Track 17)
  │ Infrastructure  │
  │  (9 lessons)    │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ Advanced LLM    │
  │ Engineering     │
  │  (14 lessons)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ Build & Deploy  │  (Track 18)
  │ LLM Capstone    │
  │  (9 lessons)    │
  └─────────────────┘
```

**Suggested schedule:**

```
Weeks 1-2:   Math Foundations (Track 14)
Weeks 3-4:   GPU & CUDA Fundamentals (Track 15)
Weeks 5-6:   ML Fundamentals (Track 7)
Weeks 7-8:   LLMs & Transformers (Track 8)
Weeks 9-10:  Applied ML + ML Glossary as companion (Tracks + Track 16)
Weeks 11-12: Advanced Deep Learning
Weeks 13-14: AI Engineering
Weeks 15-16: Scale & Infrastructure (Track 17)
Weeks 17-18: Advanced LLM Engineering
Weeks 19-21: Build & Deploy LLM Capstone (Track 18)
```

---

## Quick Reference

- **[ML Glossary](./ml-glossary/00-roadmap.md)** — Use as a companion resource alongside any ML/AI track. Covers model sizes, quantization, training terms, architecture terms, scaling, modern LLM terminology, and evaluation. Keep it open while working through Tracks 7, 8, 14–18, Applied ML, Advanced Deep Learning, AI Engineering, and Advanced LLM Engineering.

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
