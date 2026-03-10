# Kubernetes — Orchestrating Containers at Scale

Docker runs one container on one machine. Kubernetes runs thousands of
containers across hundreds of machines and keeps them healthy. This track
takes you from "what is a Pod" to deploying real applications with
networking, storage, autoscaling, and observability.

Think of it as: Docker is one chef cooking one dish. Kubernetes is the
restaurant manager coordinating 50 chefs, handling orders, replacing
anyone who drops a plate, and scaling up when the dinner rush hits.

Prerequisites: Track 9 (Docker Deep Dive), Track 6 (Networking)

---

## Reference Files

- [kubectl Cheat Sheet](./reference-kubectl.md) — Essential commands and patterns
- [YAML Templates](./reference-yaml.md) — Common resource manifests

---

## The Roadmap

### Phase 1: Core Concepts (Hours 1–10)
- [ ] [Lesson 01: Why Kubernetes exists — the orchestration problem](./01-why-k8s.md)
- [ ] [Lesson 02: Architecture — control plane, nodes, etcd, API server](./02-architecture.md)
- [ ] [Lesson 03: Pods — the smallest deployable unit](./03-pods.md)
- [ ] [Lesson 04: ReplicaSets and Deployments — desired state](./04-deployments.md)
- [ ] [Lesson 05: Services — stable networking for ephemeral Pods](./05-services.md)

### Phase 2: Configuration and Storage (Hours 11–18)
- [ ] [Lesson 06: ConfigMaps and Secrets — configuration management](./06-configmaps-secrets.md)
- [ ] [Lesson 07: Volumes and PersistentVolumeClaims — stateful workloads](./07-volumes-pvc.md)
- [ ] [Lesson 08: Namespaces — multi-tenancy and organization](./08-namespaces.md)

### Phase 3: Networking and Traffic (Hours 19–28)
- [ ] [Lesson 09: Kubernetes networking model — every Pod gets an IP](./09-networking.md)
- [ ] [Lesson 10: Ingress and Ingress Controllers — HTTP routing](./10-ingress.md)
- [ ] [Lesson 11: DNS in Kubernetes — service discovery](./11-dns.md)
- [ ] [Lesson 12: Network Policies — firewalls for Pods](./12-network-policies.md)

### Phase 4: Workload Patterns (Hours 29–36)
- [ ] [Lesson 13: StatefulSets — databases and ordered workloads](./13-statefulsets.md)
- [ ] [Lesson 14: DaemonSets and Jobs — every node and batch work](./14-daemonsets-jobs.md)
- [ ] [Lesson 15: Horizontal Pod Autoscaler — scaling on metrics](./15-hpa.md)
- [ ] [Lesson 16: Resource requests, limits, and QoS classes](./16-resources-qos.md)

### Phase 5: Production Operations (Hours 37–46)
- [ ] [Lesson 17: Helm — package management for Kubernetes](./17-helm.md)
- [ ] [Lesson 18: RBAC — who can do what in the cluster](./18-rbac.md)
- [ ] [Lesson 19: Observability — Prometheus, Grafana, logging](./19-observability.md)
- [ ] [Lesson 20: Debugging — kubectl debug, events, logs, exec](./20-debugging.md)

---

## How to use these lessons

Every lesson has:
1. Concept explained with everyday analogies
2. Hands-on exercises using kind (Kubernetes in Docker) on your Mac
3. Real YAML manifests you apply and experiment with
4. "What happens when..." walkthroughs of failure scenarios
5. Go/TypeScript deployment examples where relevant
