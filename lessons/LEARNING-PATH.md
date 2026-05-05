# Systems Programming, DevOps & AI Learning Path

A self-taught path to systems programming, infrastructure, AI, and deep algorithmic problem solving.
53 tracks, 906 lessons — work through them in parallel or sequentially.

---

## Recommended Order

The tracks are organized into **8 sections** below. A good approach:

1. Start with **Fundamentals** and a **Language** in parallel
2. Add **Infrastructure** basics (Linux, Docker) early
3. Move into **AI / Machine Learning** or **Software Engineering** based on your goals
4. Tackle **Architecture** and **Advanced AI/ML** once you have a solid base
5. Fill in **Operations** topics as needed

```
Weeks 1-4:    Fundamentals (CS, Data Structures) + a Language (Rust or Python)
Weeks 5-8:    Linux + Docker + Networking basics
Weeks 9-12:   ML Fundamentals + Applied ML (or Software Engineering tracks)
Weeks 13-16:  LLMs & Transformers + AI Engineering
Weeks 17-20:  System Design + Cloud Architecture
Weeks 21-24:  Advanced tracks based on your career path
Weeks 25+:    Capstone projects combining everything
```

---

## Fundamentals

**[CS Fundamentals](./cs-fundamentals/00-roadmap.md)**
12 lessons — how computers work, memory, types, pointers, compilation, linking.

**[Computer Architecture](./computer-architecture/00-roadmap.md)**
16 lessons — CPU execution, instruction sets, pipelines, caches, virtual memory, SIMD, multicore.

**[Data Representation & Encoding](./data-representation-encoding/00-roadmap.md)**
12 lessons — integers, floating point, text encodings, endianness, media formats, compression, serialization.

**[Digital Logic & Circuit Foundations](./digital-logic-circuit-foundations/00-roadmap.md)**
12 lessons — switches, gates, adders, memory cells, registers, counters, simple CPU construction.

**[Boot Process & Firmware](./boot-process-firmware/00-roadmap.md)**
10 lessons — power-on, BIOS vs UEFI, bootloaders, kernel init, drivers, init systems, secure boot.

**[Bus Architecture, I/O & Peripherals](./bus-io-peripherals/00-roadmap.md)**
10 lessons — system bus, interrupts, DMA, PCIe, USB, storage, GPU, NICs, MMIO, full device-to-app paths.

**[History & Mental Models of Computing](./history-mental-models-computing/00-roadmap.md)**
8 lessons — computability, stored programs, transistors, OS evolution, networking, ISA wars, caches, multicore.

**[Data Structures & Algorithms](./data-structures/00-roadmap.md)**
16 lessons — arrays, hash maps, trees, graphs, caching. In Rust.

**[DSA Mastery](./dsa-mastery/00-roadmap.md)**
65 lessons — a full zero-to-hard LeetCode sequence covering data structures, algorithms, paradigms, strings, advanced topics, and interview problem-solving methodology. No prerequisites required.

**[Discrete Math & Logic](./discrete-math/00-roadmap.md)**
14 lessons — sets, logic, proofs, combinatorics, graph theory, number theory.

**[Math Foundations](./math-foundations/00-roadmap.md)**
9 lessons — vectors, matrices, dot products, derivatives, gradients, chain rule, probability, MLE.

**[Math for AI](./math-for-ai/00-roadmap.md)**
18 lessons — linear algebra, calculus, probability, statistics, optimization for ML.

---

## Languages

**[Rust](./rust/00-roadmap.md)**
20 lessons — ownership, traits, async, building real programs.

**[Go](./go/00-roadmap.md)**
18 lessons — goroutines, channels, interfaces, building services and CLI tools.

**[Python for AI](./python-for-ai/00-roadmap.md)**
16 lessons — NumPy, pandas, matplotlib, Jupyter, Python for ML practitioners.

**[TypeScript & Modern Web](./typescript-web/00-roadmap.md)**
18 lessons — types, generics, React, Node, full-stack patterns for systems thinkers.

**[C/C++ for ML](./c-cpp-for-ml/00-roadmap.md)**
14 lessons — just enough C/C++ to understand ML frameworks, CUDA kernels, and performance code.

---

## AI / Machine Learning

**[Machine Learning Fundamentals](./ml-fundamentals/00-roadmap.md)**
14 lessons — linear regression, neural networks, CNNs, embeddings. In Python.

**[Applied ML](./applied-ml/00-roadmap.md)**
18 lessons — EDA, feature engineering, model selection, XGBoost, evaluation, deployment.

**[Advanced Deep Learning](./advanced-deep-learning/00-roadmap.md)**
16 lessons — regularization, GANs, diffusion models, vision transformers, distributed training.

**[LLMs & Transformers](./llms-transformers/00-roadmap.md)**
16 lessons — attention, transformer architecture, GPT, RLHF, chat-model alignment.

**[NLP Deep Dive](./nlp/00-roadmap.md)**
16 lessons — tokenization, embeddings, sequence models, NER, sentiment, summarization.

**[Computer Vision](./computer-vision/00-roadmap.md)**
16 lessons — image classification, object detection, segmentation, video understanding.

**[Reinforcement Learning](./reinforcement-learning/00-roadmap.md)**
16 lessons — MDPs, Q-learning, policy gradients, PPO, multi-agent RL.

**[AI Engineering](./ai-engineering/00-roadmap.md)**
20 lessons — prompt engineering, RAG, fine-tuning, agents, function calling, production AI.

**[Time Series & Forecasting](./time-series-forecasting/00-roadmap.md)**
16 lessons — stationarity, ARIMA, Prophet, neural forecasting, anomaly detection, domain applications.

**[Ethics, Fairness & Responsible AI](./ethics-fairness-ai/00-roadmap.md)**
16 lessons — bias detection, fairness metrics, interpretability, governance, responsible deployment.

---

## Advanced AI/ML

**[ML Systems at Scale](./ml-systems-at-scale/00-roadmap.md)**
12 lessons — distributed training, data pipelines, feature stores, model serving at scale.

**[Advanced LLM Engineering](./advanced-llm-engineering/00-roadmap.md)**
14 lessons — pretraining, custom tokenizers, MoE, KV-cache optimization, speculative decoding.

**[ML Performance Optimization](./ml-performance-optimization/00-roadmap.md)**
12 lessons — profiling, quantization, pruning, kernel fusion, inference optimization.

**[ML Research to Production](./ml-research-to-production/00-roadmap.md)**
12 lessons — reading papers, reproducing results, experiment tracking, production-ready code.

**[GPU & CUDA Fundamentals](./gpu-cuda-fundamentals/00-roadmap.md)**
11 lessons — CPU vs GPU architecture, memory hierarchy, CUDA programming, tensor ops, profiling.

**[ML Glossary](./ml-glossary/00-roadmap.md)**
7 lessons — model sizes, quantization, training terminology, architecture terms, scaling, modern LLM terms.

**[Scale & Infrastructure](./ml-scale-infrastructure/00-roadmap.md)**
9 lessons — training data pipelines, compute planning, distributed training, cost estimation.

**[Build & Deploy LLM Capstone](./build-deploy-llm/00-roadmap.md)**
9 lessons — build a small transformer from scratch, train it, optimize, export to ONNX, deploy.

---

## Software Engineering

**[Testing & Quality](./testing-quality/00-roadmap.md)**
18 lessons — unit testing, integration testing, TDD, property-based testing, CI testing.

**[Design Patterns](./design-patterns/00-roadmap.md)**
18 lessons — creational, structural, behavioral patterns, SOLID principles, refactoring.

**[CI/CD Pipelines](./ci-cd-pipelines/00-roadmap.md)**
16 lessons — GitHub Actions, build automation, deployment strategies, release management.

**[Authentication & Authorization](./authentication-authorization/00-roadmap.md)**
16 lessons — OAuth 2.0, OIDC, JWTs, RBAC, session management, API keys.

**[API Design & Protocols](./api-design/00-roadmap.md)**
16 lessons — REST, GraphQL, gRPC, WebSockets, versioning, rate limiting, documentation.

---

## Infrastructure

**[Linux/Unix Fundamentals](./linux-fundamentals/00-roadmap.md)**
18 lessons — shell, processes, file systems, SSH, debugging tools.

**[Docker Deep Dive](./docker/00-roadmap.md)**
18 lessons — namespaces, cgroups, overlayfs, images, networking, compose, security.

**[Kubernetes](./kubernetes/00-roadmap.md)**
20 lessons — Pods, Deployments, Services, Ingress, Helm, RBAC, observability.

**[Cloud Architecture & IaC](./cloud-architecture/00-roadmap.md)**
18 lessons — AWS/GCP/Azure patterns, well-architected framework, Terraform, cost optimization.

**[Infrastructure as Code](./infrastructure-as-code/00-roadmap.md)**
15 lessons — Terraform, Pulumi, CloudFormation, state management, modules, testing.

**[Message Queues & Streaming](./message-queues-streaming/00-roadmap.md)**
16 lessons — Kafka, RabbitMQ, SQS, event-driven architecture, stream processing.

**[Platform Engineering](./platform-engineering/00-roadmap.md)**
12 lessons — internal developer platforms, golden paths, self-service infrastructure.

---

## Architecture

**[System Design](./system-design/00-roadmap.md)**
38 lessons — scaling, caching, databases, queues, microservices, real-world designs.

**[Advanced System Design](./advanced-system-design/00-roadmap.md)**
13 lessons — distributed transactions, event sourcing at scale, multi-region, service mesh.

**[Distributed Systems](./distributed-systems/00-roadmap.md)**
20 lessons — consensus, replication, partitioning, CAP theorem, CRDTs, Raft.

**[Networking](./networking/00-roadmap.md)**
18 lessons — TCP/IP, HTTP, TLS, sockets, DNS, load balancing, building servers.

**[Concurrency & Parallelism](./concurrency-parallelism/00-roadmap.md)**
16 lessons — threads, locks, atomics, async, channels, actor model, SIMD.

---

## Operations

**[Operating Systems](./os-concepts/00-roadmap.md)**
16 lessons — processes, memory, threads, syscalls, file systems.

**[Databases](./databases/00-roadmap.md)**
22 lessons — PostgreSQL internals, SQL, schema design, indexing, transactions, Rust/sqlx.

**[SRE & Observability](./sre-observability/00-roadmap.md)**
16 lessons — SLOs, monitoring, logging, tracing, incident response, chaos engineering.

**[Security & Cryptography](./security-cryptography/00-roadmap.md)**
22 lessons — hashing, encryption, TLS, OWASP Top 10, auth, secrets, threat modeling.

**[Compilers & Interpreters](./compilers-interpreters/00-roadmap.md)**
22 lessons — lexers, parsers, ASTs, interpreters, type checkers, bytecode VMs, LLVM.

**[MLOps & Production ML](./mlops/00-roadmap.md)**
18 lessons — experiment tracking, model registries, feature stores, monitoring, pipelines.

**[Data Engineering](./data-engineering/00-roadmap.md)**
14 lessons — data pipelines, ETL, data warehouses, Spark, dbt, data quality.

---

## Total: 906 lessons across 53 tracks

Estimated time: 60-80 weeks at ~2 hours/day, or 30-40 weeks at ~4 hours/day.

---

## ML/AI Deep Dive Path

A recommended sequential path through all ML/AI tracks — from math foundations
to building and deploying your own language model.

```
  ┌─────────────────┐
  │ Math Foundations │
  │   (9 lessons)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │  GPU & CUDA     │
  │  (11 lessons)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ ML Fundamentals │
  │  (14 lessons)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │ LLMs &          │
  │ Transformers    │
  │  (16 lessons)   │
  └────────┬────────┘
           │
  ┌────────▼────────┐     ┌──────────────────┐
  │  Applied ML     │     │   ML Glossary    │
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
  ┌────────▼────────────┐
  │ Time Series &       │
  │ Forecasting         │
  │  (16 lessons)       │
  └────────┬────────────┘
           │
  ┌────────▼────────────┐
  │ Ethics, Fairness &  │
  │ Responsible AI      │
  │  (16 lessons)       │
  └────────┬────────────┘
           │
  ┌────────▼────────┐
  │ Scale &         │
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
  │ Build & Deploy  │
  │ LLM Capstone    │
  │  (9 lessons)    │
  └─────────────────┘
```

**Suggested schedule:**

```
Weeks 1-2:   Math Foundations
Weeks 3-4:   GPU & CUDA Fundamentals
Weeks 5-6:   ML Fundamentals
Weeks 7-8:   LLMs & Transformers
Weeks 9-10:  Applied ML + ML Glossary as companion
Weeks 11-12: Advanced Deep Learning
Weeks 13-14: AI Engineering
Weeks 15-16: Time Series & Forecasting
Weeks 17-18: Ethics, Fairness & Responsible AI
Weeks 19-20: Scale & Infrastructure
Weeks 21-22: Advanced LLM Engineering
Weeks 23-25: Build & Deploy LLM Capstone
```

---

## Quick Reference

- **[ML Glossary](./ml-glossary/00-roadmap.md)** — Use as a companion resource alongside any ML/AI track. Covers model sizes, quantization, training terms, architecture terms, scaling, modern LLM terminology, and evaluation. Keep it open while working through ML Fundamentals, LLMs & Transformers, Applied ML, Advanced Deep Learning, AI Engineering, Advanced LLM Engineering, and the capstone tracks.

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
| Build a demand forecasting system | Time Series, Applied ML, Python |
| Audit an ML model for fairness | Ethics & Fairness, Applied ML, Python |
| Build a stock price anomaly detector | Time Series, AI Engineering, Python |
