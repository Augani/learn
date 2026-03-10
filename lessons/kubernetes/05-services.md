# Services

## The Company Phone Number Analogy

Your company has a main phone number: 1-800-ACME-CO. Employees come and go — people quit, new hires start, people move desks. But the phone number stays the same. When a customer calls, the phone system routes the call to whoever is available right now.

Pods are the employees. They're ephemeral — they get created, crash, get replaced, scale up, scale down. Each Pod has its own IP address, but that IP is temporary. When the Pod dies, its IP dies with it.

A **Service** is the company phone number. It gives a stable DNS name and IP address that never changes, regardless of which Pods are behind it. Traffic gets routed to healthy, available Pods.

Without Services, your frontend would need to know the exact IP addresses of every backend Pod. And those IPs change every time a Pod restarts. That's the problem Services solve.

---

## How Services Find Pods: Label Selectors

Services don't know about specific Pods. They know about labels. A Service says "send traffic to any Pod with the label `app: my-api`." The Service continuously watches for Pods matching that selector and updates its routing table.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-api
spec:
  selector:
    app: my-api    # ← finds Pods with this label
  ports:
    - port: 80           # ← Service listens on port 80
      targetPort: 8080   # ← forwards to Pod port 8080
```

The Deployment creates Pods with `app: my-api` label. The Service finds them automatically.

```
Deployment (app: my-api, replicas: 3)
    ↓ creates
Pod A (10.244.1.5:8080) ─┐
Pod B (10.244.2.3:8080) ──┼── matched by Service selector
Pod C (10.244.1.8:8080) ─┘
    ↑ routes to
Service (my-api, ClusterIP: 10.96.0.50:80)
```

When you scale the Deployment to 5 replicas, two new Pods appear with the same label. The Service automatically includes them. When you scale down, removed Pods are automatically excluded.

### Endpoints

Behind the scenes, Kubernetes maintains an **Endpoints** object for each Service. It's the list of Pod IPs currently matching the selector.

```bash
kubectl get endpoints my-api
```

```
NAME     ENDPOINTS                                         AGE
my-api   10.244.1.5:8080,10.244.2.3:8080,10.244.1.8:8080  5m
```

When a Pod fails its readiness probe, it's removed from the Endpoints list. Traffic stops being routed to it. When it passes readiness again, it's added back.

---

## Service Types

### ClusterIP (Default) — Internal Phone Extension

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-api
spec:
  type: ClusterIP
  selector:
    app: my-api
  ports:
    - name: http
      port: 80
      targetPort: 8080
```

ClusterIP creates a virtual IP address that's only reachable from inside the cluster. It's like an internal phone extension — employees can call it, but customers can't.

DNS name inside the cluster:
- `my-api` (within the same namespace)
- `my-api.default` (from other namespaces, where `default` is the namespace)
- `my-api.default.svc.cluster.local` (fully qualified)

**Use when**: Services need to talk to each other (API → database, frontend → API). Most Services should be ClusterIP.

For Go/TypeScript engineers: your database connection string would be `postgres://user:pass@postgres-svc:5432/mydb`. The `postgres-svc` hostname resolves via cluster DNS to the Service's ClusterIP.

### NodePort — Public Phone Number on Every Building

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-api-nodeport
spec:
  type: NodePort
  selector:
    app: my-api
  ports:
    - name: http
      port: 80
      targetPort: 8080
      nodePort: 30080
```

NodePort opens a port on every node in the cluster. External traffic can reach the Service via `<any-node-ip>:30080`.

```
External Client
    ↓
Node A:30080  or  Node B:30080  or  Node C:30080
    ↓                ↓                ↓
    └───────── Service (kube-proxy routes) ──────┘
                     ↓
              Pod (any node)
```

Port range: 30000-32767. If you don't specify `nodePort`, Kubernetes assigns one randomly.

NodePort also creates a ClusterIP — it's a superset. Internal traffic still works via the ClusterIP.

**Use when**: Development, testing, or when you need direct node access. Not ideal for production (no load balancing between nodes, ugly port numbers).

### LoadBalancer — Billboard Directing to Your Store

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-api-lb
spec:
  type: LoadBalancer
  selector:
    app: my-api
  ports:
    - name: http
      port: 80
      targetPort: 8080
```

LoadBalancer provisions an actual load balancer from your cloud provider (AWS ELB, GCP Load Balancer, Azure Load Balancer).

```
Internet
    ↓
Cloud Load Balancer (external IP)
    ↓
Node A:NodePort  or  Node B:NodePort
    ↓                    ↓
    └──── Service ────────┘
              ↓
          Pod (any node)
```

LoadBalancer is a superset of NodePort, which is a superset of ClusterIP. You get all three.

```bash
kubectl get svc my-api-lb
```

```
NAME         TYPE           CLUSTER-IP     EXTERNAL-IP    PORT(S)
my-api-lb    LoadBalancer   10.96.0.50     34.123.45.67   80:31234/TCP
```

The `EXTERNAL-IP` is the load balancer's public IP. Point your DNS to it.

**Use when**: You need to expose a service to the internet. One load balancer per Service.

**Problem**: Each LoadBalancer Service creates a separate cloud load balancer. At $15-20/month each, 10 services = $150-200/month just for load balancers. This is why Ingress exists (one load balancer, multiple routing rules).

### ExternalName — Call Forwarding

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-db
spec:
  type: ExternalName
  externalName: db.example.com
```

ExternalName creates a DNS CNAME record. When Pods resolve `external-db`, they get `db.example.com`. No proxying, no ClusterIP — just a DNS alias.

**Use when**: You need to point to an external service (managed database, third-party API) with a consistent internal name. If the external service moves, you update the Service, not every consumer.

---

## Service DNS

Kubernetes runs CoreDNS in the cluster, giving every Service a DNS name. This is how Pods find Services.

```
<service-name>                                    → within same namespace
<service-name>.<namespace>                        → cross-namespace
<service-name>.<namespace>.svc.cluster.local      → fully qualified
```

From a Go app in namespace `default`:

```go
resp, err := http.Get("http://my-api:80/users")

resp, err := http.Get("http://my-api.staging:80/users")
```

The first resolves to `my-api.default.svc.cluster.local`.
The second resolves to `my-api.staging.svc.cluster.local`.

For TypeScript (Node.js):

```typescript
const response = await fetch('http://my-api:80/users');

const response = await fetch('http://my-api.staging:80/users');
```

DNS resolution happens at the cluster level. Your code doesn't need any Kubernetes-specific libraries. Standard HTTP clients work.

---

## How kube-proxy Routes Traffic

kube-proxy runs on every node and programs the kernel's network stack to route Service traffic.

When a Pod sends traffic to a ClusterIP:

1. Pod sends a packet to `10.96.0.50:80` (the ClusterIP)
2. iptables rules on the node intercept the packet
3. iptables DNAT (destination NAT) rewrites the destination to a real Pod IP
4. The packet goes to `10.244.1.5:8080` (a real Pod)

```
Pod → ClusterIP 10.96.0.50:80
         ↓ (iptables DNAT)
      Pod IP 10.244.1.5:8080 (randomly selected)
```

The selection is random with equal probability by default. Not round-robin, not least-connections — random. For most workloads, this is fine because with enough traffic, random approaches uniform distribution.

The Pod doesn't know about the Service. The packet arrives as if it was sent directly from the client Pod.

---

## Session Affinity

By default, each request can go to any Pod. If you need sticky sessions (all requests from a client go to the same Pod):

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-api
spec:
  selector:
    app: my-api
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600
  ports:
    - port: 80
      targetPort: 8080
```

kube-proxy uses the client's IP to consistently route to the same Pod for the duration of the timeout.

**Use sparingly.** Session affinity reduces load distribution and makes scaling less effective. Prefer stateless services with external session storage (Redis, database).

---

## Multi-Port Services

A single Service can expose multiple ports:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-api
spec:
  selector:
    app: my-api
  ports:
    - name: http
      port: 80
      targetPort: 8080
    - name: metrics
      port: 9090
      targetPort: 9090
    - name: grpc
      port: 50051
      targetPort: 50051
```

When a Service has multiple ports, each must have a `name`. Use meaningful names — they're used in Ingress configurations and debugging.

---

## Hands-On: Create and Test Services

### Setup

```bash
kind create cluster --name svc-lab
```

### Deploy a backend

```bash
kubectl create deployment api --image=hashicorp/http-echo:latest -- -text="hello from api" -listen=:8080

kubectl scale deployment api --replicas=3
```

### Create a ClusterIP Service

```bash
kubectl expose deployment api --port=80 --target-port=8080
```

```bash
kubectl get svc api

kubectl get endpoints api
```

### Test from inside the cluster

```bash
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- curl http://api:80
```

You should see "hello from api". The `curl-test` Pod resolves `api` via DNS, gets the ClusterIP, and kube-proxy routes to one of the 3 Pods.

### Test DNS resolution

```bash
kubectl run dns-test --image=busybox:1.36 --rm -it --restart=Never -- nslookup api.default.svc.cluster.local
```

You'll see the Service's ClusterIP returned as an A record.

### Watch endpoints update as you scale

Terminal 1:
```bash
kubectl get endpoints api -w
```

Terminal 2:
```bash
kubectl scale deployment api --replicas=5
sleep 10
kubectl scale deployment api --replicas=2
```

Watch Terminal 1 — the endpoints list grows and shrinks as Pods come and go.

### Test with port-forward

```bash
kubectl port-forward svc/api 8080:80
```

```bash
curl http://localhost:8080
```

Port-forward works with Services, not just Pods. It picks one of the backing Pods.

---

## Hands-On: NodePort Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-nodeport
spec:
  type: NodePort
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30080
```

```bash
kubectl apply -f nodeport-svc.yaml

kubectl get svc api-nodeport
```

In kind, you can't access NodePort from your laptop directly (the nodes are Docker containers). But you can verify it works:

```bash
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- curl http://api-nodeport:80
```

To access NodePort from your laptop with kind, you need to configure port mappings in the kind cluster config:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30080
        hostPort: 30080
```

---

## Hands-On: Service Discovery Between Microservices

This simulates a typical Go/TypeScript microservices setup: a frontend that calls a backend API.

Deploy the backend:

```bash
kubectl create deployment backend --image=hashicorp/http-echo:latest -- -text='{"status":"ok","service":"backend"}' -listen=:8080

kubectl expose deployment backend --port=80 --target-port=8080
```

Deploy a "frontend" that calls the backend:

```bash
kubectl run frontend --image=curlimages/curl --rm -it --restart=Never -- sh -c '
  echo "=== Calling backend service ==="
  curl -s http://backend:80
  echo ""
  echo "=== DNS lookup ==="
  nslookup backend
  echo ""
  echo "=== Calling backend 10 times ==="
  for i in $(seq 1 10); do
    curl -s http://backend:80
    echo ""
  done
'
```

The frontend finds the backend purely through DNS. No IP addresses hardcoded. No service registry. Just `http://backend:80`.

This is exactly how your Go or TypeScript services should communicate:

```go
resp, err := http.Get("http://backend:80/api/users")
```

```typescript
const resp = await fetch('http://backend:80/api/users');
```

The Kubernetes DNS system resolves `backend` to the Service's ClusterIP, and kube-proxy routes to a healthy Pod.

---

## Hands-On: Headless Service

A headless Service (ClusterIP: None) returns individual Pod IPs instead of a single virtual IP. Used with StatefulSets for direct Pod addressing.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-headless
spec:
  clusterIP: None
  selector:
    app: api
  ports:
    - port: 8080
      targetPort: 8080
```

```bash
kubectl apply -f headless-svc.yaml

kubectl run dns-test --image=busybox:1.36 --rm -it --restart=Never -- nslookup api-headless
```

Instead of one IP (the ClusterIP), you get multiple A records — one for each Pod. This lets clients connect to specific Pods, which is essential for databases (connect to the primary, not a random replica).

---

## Service vs. Ingress

A common question: "When do I use a Service vs. an Ingress?"

| | Service (LoadBalancer) | Ingress |
|---|---|---|
| **Layer** | L4 (TCP/UDP) | L7 (HTTP/HTTPS) |
| **Routing** | Port-based | Path/host-based |
| **TLS** | You configure | Ingress handles termination |
| **Cost** | One LB per Service | One LB for many Services |
| **Protocol** | Any TCP/UDP | HTTP/HTTPS (mainly) |

Use **Service** for:
- Internal communication between services (ClusterIP)
- Non-HTTP traffic (databases, gRPC, MQTT)
- Simple external access when you don't need path routing

Use **Ingress** for:
- HTTP routing based on paths or hostnames
- TLS termination
- Multiple services behind one external IP

---

## What Would Happen If...

**...all Pods behind a Service crashed?**

The Service would have zero endpoints. Any traffic to the Service would fail (connection refused or timeout). As soon as the Deployment recreates the Pods and they pass readiness, the Service starts routing again.

```bash
kubectl get endpoints my-api
```

```
NAME     ENDPOINTS   AGE
my-api   <none>      5m
```

**...you created a Service before the Deployment?**

The Service would exist with zero endpoints. It's ready and waiting. As soon as Pods with matching labels appear, they're added to the endpoints. Order doesn't matter — the reconciliation loop handles it.

**...you changed the Service's selector?**

The endpoints update immediately. Old Pods are removed, new Pods (matching the new selector) are added. This is how blue-green deployments work with Services.

**...a Pod's readiness probe fails?**

The Pod is removed from the Service's endpoints. Traffic is no longer routed to it. The Pod is still running (liveness is fine), it's just not receiving traffic. When readiness passes again, it's added back.

**...you deleted a Service?**

The DNS name stops resolving. Existing connections continue until they close (TCP keepalive), but new connections fail. The Pods keep running — they don't know the Service was deleted. Recreate the Service with the same name and selector, and everything works again.

**...you had 100 Pods and used kube-proxy in iptables mode?**

kube-proxy creates iptables rules for each endpoint. With 100 Pods, that's 100+ rules per Service. At scale (thousands of Services, tens of thousands of Pods), iptables performance degrades. This is when you switch to IPVS mode:

```bash
kubectl edit configmap kube-proxy -n kube-system
```

Set `mode: "ipvs"`. IPVS uses hash tables instead of sequential rule processing, scaling much better.

---

## Production Patterns

### Health-checked backend

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: my-go-api:v1
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080
```

The readiness probe ensures the Service only routes to Pods that can handle traffic. During rolling updates, old Pods continue receiving traffic until new Pods pass readiness.

### Multiple Services for one Deployment

You can have multiple Services pointing to the same Pods:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-internal
spec:
  type: ClusterIP
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: api-metrics
spec:
  type: ClusterIP
  selector:
    app: api
  ports:
    - port: 9090
      targetPort: 9090
```

One Service for application traffic, another for Prometheus scraping. Clean separation of concerns.

---

## Exercises

1. **Verify load balancing.** Deploy 3 replicas of http-echo with different text (use separate Deployments with the same label). Create a Service. Curl it 20 times from a test Pod and count the distribution.

2. **Test endpoint updates.** Watch `kubectl get endpoints my-svc -w` while scaling a Deployment up and down. Correlate the endpoint changes with Pod creation/deletion times.

3. **Cross-namespace communication.** Create two namespaces. Deploy an API in one, deploy a client in the other. Have the client call the API using `<service-name>.<namespace>:80`. Verify it works.

4. **Break and fix DNS.** Deploy a service, verify it works. Delete the CoreDNS Pods (`kubectl delete pods -n kube-system -l k8s-app=kube-dns`). Try to resolve the Service name. Watch CoreDNS come back (it's managed by a Deployment) and resolution work again.

5. **Compare ClusterIP and headless.** Create both a regular and headless Service for the same Deployment. Use `nslookup` from a test Pod to compare the DNS responses. Regular returns one IP (ClusterIP), headless returns multiple IPs (Pod IPs).

---

## Key Takeaways

- Services provide stable DNS names and IPs for ephemeral Pods
- Label selectors are the glue between Services and Pods
- ClusterIP for internal traffic, NodePort for development, LoadBalancer for production external access
- Readiness probes control whether a Pod receives traffic from a Service
- DNS-based service discovery means your Go/TypeScript code just uses hostnames
- Endpoints update automatically as Pods scale up/down or pass/fail readiness

Next: ConfigMaps and Secrets — getting configuration into your Pods.
