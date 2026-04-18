# Learn Everything

Bite-sized lessons for learning computer science, software engineering, AI/ML, and infrastructure on the go. Every concept explained with everyday analogies first, then the technical details. Short enough to read on a commute, deep enough to actually understand.

**[Live Site](https://augani.github.io/learn)**

## What's Here

- **841 lessons** across **52 topics**
- **14 career tracks** guiding you from beginner to advanced
- **Book recommendations** on every topic (verified, real books — free ones marked)
- **Offline support** — download tracks to read without internet
- **Progress tracking** — pick up where you left off

## Career Tracks

Pick a career path and follow the ordered topics:

| Track | Level | Topics | Lessons |
|-------|-------|--------|---------|
| Backend Engineer | Beginner → Intermediate | 16 | 298 |
| Full-Stack Developer | Beginner → Intermediate | 13 | 248 |
| Cloud / DevOps Engineer | Beginner → Intermediate | 11 | 199 |
| ML Engineer | Intermediate → Advanced | 14 | 236 |
| AI Engineer | Intermediate | 15 | 263 |
| Data Engineer | Intermediate | 11 | 193 |
| Security Engineer | Intermediate → Advanced | 12 | 212 |
| Site Reliability Engineer | Intermediate → Advanced | 14 | 273 |
| Systems Programmer | Intermediate → Advanced | 10 | 166 |
| Platform Engineer | Intermediate → Advanced | 12 | 205 |
| Advanced ML Engineer | Advanced | 10 | 150 |
| Staff+ Backend Engineer | Advanced | 12 | 226 |
| Data Scientist | Beginner → Intermediate | 10 | 182 |
| ML Research Engineer | Advanced | 10 | 150 |

## Topics

### Fundamentals
- **CS Fundamentals** — How computers work, memory, types, compilation, concurrency
- **Data Structures & Algorithms** — Arrays to graphs, Big-O, searching, sorting, caching
- **Discrete Math & Logic** — Propositional logic, sets, graph theory, computability

### Languages
- **Rust** — Ownership, traits, generics, async, web servers
- **Go** — Goroutines, channels, interfaces, HTTP servers, CLI tools
- **Python for AI** — NumPy, pandas, PyTorch, Hugging Face, scikit-learn
- **TypeScript & Modern Web** — Type system, React, Next.js, state management
- **C/C++ for ML** — Pointers, CUDA, PyTorch ops, performance optimization

### AI / Machine Learning
- **Machine Learning Fundamentals** — Linear regression to neural networks
- **Applied ML** — Feature engineering, XGBoost, clustering, time series
- **Advanced Deep Learning** — GANs, diffusion models, vision transformers, distributed training
- **LLMs & Transformers** — Attention, transformer architecture, GPT, BERT, RLHF
- **NLP Deep Dive** — Text processing, embeddings, summarization, translation
- **Computer Vision** — CNNs, object detection, segmentation, video analysis
- **Reinforcement Learning** — MDPs, Q-learning, policy gradients, PPO, RLHF
- **AI Engineering** — Prompt engineering, RAG, agents, function calling, production AI
- **Time Series & Forecasting** — Stationarity, ARIMA, Prophet, neural forecasting, anomaly detection
- **Ethics, Fairness & Responsible AI** — Bias detection, fairness metrics, interpretability, governance, responsible deployment
- **Math for AI** — Linear algebra, calculus, probability, information theory

### Advanced AI/ML (for seasoned engineers)
- **ML Systems at Scale** — Distributed training, GPU clusters, data pipelines at petabyte scale
- **Advanced LLM Engineering** — Pre-training, MoE, KV cache, speculative decoding, serving at scale
- **ML Performance Optimization** — Profiling, CUDA kernels, torch.compile, TensorRT
- **ML Research to Production** — Reading papers, implementing papers, experiment design

### Software Engineering
- **Testing & Quality** — TDD, unit/integration/e2e, mocking, property-based testing
- **Design Patterns** — SOLID, GoF patterns, clean architecture, DDD
- **CI/CD Pipelines** — GitHub Actions, deployment strategies, feature flags
- **Authentication & Authorization** — OAuth 2.0, JWT, RBAC, passkeys, SSO

### Infrastructure
- **Docker Deep Dive** — Namespaces, cgroups, multi-stage builds, security
- **Kubernetes** — Pods to operators, networking, RBAC, Helm
- **Cloud Architecture & IaC** — AWS, Terraform, serverless, multi-region
- **Infrastructure as Code** — Terraform deep dive, modules, state, policy-as-code
- **Message Queues & Streaming** — Kafka, RabbitMQ, event sourcing, CQRS
- **Platform Engineering** — Developer portals, golden paths, infrastructure abstraction

### Architecture
- **System Design** — Caching, load balancing, microservices, 15+ system designs
- **Advanced System Design** — Multi-region, distributed transactions, event sourcing at scale
- **Distributed Systems** — Consensus, replication, CRDTs, Byzantine fault tolerance
- **Networking** — TCP/IP, DNS, TLS, HTTP/2, gRPC, building servers in Rust
- **API Design & Protocols** — REST, GraphQL, gRPC, websockets, rate limiting

### Operations
- **Linux/Unix Fundamentals** — Terminal, permissions, scripting, Docker, networking
- **Operating Systems** — Processes, virtual memory, threads, file systems, syscalls
- **SRE & Observability** — SLIs/SLOs, Prometheus, distributed tracing, incident management
- **Security & Cryptography** — Hashing, encryption, TLS, OWASP, threat modeling
- **Compilers & Interpreters** — Lexers, parsers, ASTs, type checking, VMs

## Running Locally

```bash
# Install dependencies
bun install

# Development server
bun run dev

# Build for production
bun run build
```

## How Lessons Work

Every lesson follows the same structure:
1. **One-line summary** in a blockquote
2. **Everyday analogy** to build intuition
3. **ASCII diagrams** for visual learners
4. **Technical deep-dive** with real code
5. **Exercises** to practice

Lessons are written in Markdown and rendered client-side. The app is a static site with hash routing and offline support via service workers.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** for builds
- **Tailwind CSS v4** for styling
- **react-markdown** + **remark-gfm** for rendering
- **Framer Motion** for animations
- Deployed on **GitHub Pages**

## Contributing

Add lessons by creating Markdown files in the `lessons/` directory. Run `bun run generate` to update the manifest. Follow the existing lesson style — analogies first, then technical details, ASCII diagrams, real code.

## License

MIT
