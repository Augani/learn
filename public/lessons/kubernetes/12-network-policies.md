# Lesson 12: Network Policies — Firewalls for Pods

## The Big Picture

Picture an office building with no security. Every door is unlocked. Anyone on
any floor can walk into any room — the CEO's office, the server room, the
accounting vault. That's how Kubernetes networking works by default: every Pod
can talk to every other Pod, no restrictions.

Network Policies are the access card system. You install card readers on doors
and program rules: "only the engineering team can enter the engineering lab,"
"only the finance team can access the accounting vault." If a door has no card
reader, it stays open. But once you install one, only people with matching
badges get through.

In Kubernetes terms: by default, all Pods accept traffic from everywhere. A
NetworkPolicy "installs a card reader" on selected Pods. Once applied, only
traffic matching the policy rules gets through. Everything else is denied.

---

## Prerequisites

- Lesson 05 (Services)
- Lesson 08 (Namespaces)
- Lesson 09 (Kubernetes networking model)
- Lesson 11 (DNS)

### Important: CNI Plugin Requirement

Not all Kubernetes CNI plugins enforce Network Policies. `kind` uses kindnet by
default, which does **not** support them. We need to install Calico.

Create a cluster without the default CNI:

```bash
cat <<EOF | kind create cluster --name netpol-lab --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  disableDefaultCNI: true
  podSubnet: 192.168.0.0/16
nodes:
- role: control-plane
- role: worker
- role: worker
EOF
```

Install Calico:

```bash
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/calico.yaml
```

Wait for Calico to be ready:

```bash
kubectl wait --for=condition=ready pods -l k8s-app=calico-node -n kube-system --timeout=120s
```

---

## The Default: Wide Open

Let's prove that everything can talk to everything by default.

### Deploy Three Services

```yaml
# file: netpol-demo.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    env: production
---
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
  labels:
    env: monitoring
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
      tier: frontend
  template:
    metadata:
      labels:
        app: web
        tier: frontend
    spec:
      containers:
      - name: web
        image: hashicorp/http-echo
        args: ["-text=web-frontend"]
        ports:
        - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: production
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 5678
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api
      tier: backend
  template:
    metadata:
      labels:
        app: api
        tier: backend
    spec:
      containers:
      - name: api
        image: hashicorp/http-echo
        args: ["-text=api-backend"]
        ports:
        - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: production
spec:
  selector:
    app: api
  ports:
  - port: 80
    targetPort: 5678
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: database
  namespace: production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: database
      tier: database
  template:
    metadata:
      labels:
        app: database
        tier: database
    spec:
      containers:
      - name: db
        image: hashicorp/http-echo
        args: ["-text=database-response"]
        ports:
        - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: database
  namespace: production
spec:
  selector:
    app: database
  ports:
  - port: 80
    targetPort: 5678
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prom
        image: hashicorp/http-echo
        args: ["-text=prometheus"]
        ports:
        - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: monitoring
spec:
  selector:
    app: prometheus
  ports:
  - port: 80
    targetPort: 5678
```

```bash
kubectl apply -f netpol-demo.yaml
kubectl wait --for=condition=ready pods --all -n production --timeout=60s
kubectl wait --for=condition=ready pods --all -n monitoring --timeout=60s
```

### Test Connectivity

```bash
kubectl exec -n production deploy/web -- wget -qO- --timeout=3 api.production:80
kubectl exec -n production deploy/web -- wget -qO- --timeout=3 database.production:80
kubectl exec -n production deploy/api -- wget -qO- --timeout=3 database.production:80
kubectl exec -n monitoring deploy/prometheus -- wget -qO- --timeout=3 api.production:80
```

Everything works. The web frontend can reach the database directly (it shouldn't
need to). Monitoring can reach everything. There are no boundaries.

---

## NetworkPolicy Anatomy

A NetworkPolicy is a Kubernetes resource that selects Pods and defines what
traffic they allow. Here's the structure:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: policy-name
  namespace: target-namespace
spec:
  podSelector:
    matchLabels:
      app: target-app
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: allowed-source
    ports:
    - protocol: TCP
      port: 80
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: allowed-destination
    ports:
    - protocol: TCP
      port: 443
```

### Key Concepts

**podSelector**: which Pods this policy applies to. Like CSS selectors target
HTML elements, `podSelector` targets Pods by labels.

**policyTypes**: whether the policy covers incoming traffic (`Ingress`),
outgoing traffic (`Egress`), or both.

**ingress.from**: who is allowed to send traffic TO the selected Pods. Think of
it as "who can knock on this door."

**egress.to**: where the selected Pods are allowed to send traffic. Think of it
as "which doors can these Pods knock on."

### The Critical Rule

Once a NetworkPolicy selects a Pod (via `podSelector`), **all traffic not
explicitly allowed is denied** for the policy types listed. If you create an
Ingress policy for a Pod, all ingress not matching a rule is blocked. Egress
remains unrestricted unless you also add Egress to `policyTypes`.

An empty `podSelector: {}` matches ALL Pods in the namespace.

---

## Step 1: Default Deny All Ingress

The first thing you should do in any production namespace is create a default
deny policy. This flips the model from "allow everything" to "deny everything
unless explicitly allowed."

```yaml
# file: default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
```

This says: "For ALL Pods in the `production` namespace, deny all incoming
traffic." No `ingress` rules means nothing is allowed in.

```bash
kubectl apply -f default-deny.yaml
```

### Test: Everything Should Be Blocked

```bash
kubectl exec -n production deploy/web -- wget -qO- --timeout=3 api.production:80
```

```
wget: download timed out
command terminated with exit code 1
```

Even Pods within the same namespace can no longer reach each other. The access
card readers are installed, and nobody has a badge yet.

Cross-namespace is blocked too:

```bash
kubectl exec -n monitoring deploy/prometheus -- wget -qO- --timeout=3 api.production:80
```

Timeout. Good.

---

## Step 2: Allow Specific Traffic

Now let's open the doors we actually want open. The architecture should be:

```
[Internet] → web → api → database
[monitoring] → all pods (for scraping metrics)
```

### Allow Web to Receive Traffic from Anyone

```yaml
# file: allow-web-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: web
      tier: frontend
  policyTypes:
  - Ingress
  ingress:
  - ports:
    - protocol: TCP
      port: 5678
```

No `from` restriction means "allow from anywhere" on port 5678.

### Allow API to Receive Traffic Only from Web

```yaml
# file: allow-api-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-from-web
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api
      tier: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: web
          tier: frontend
    ports:
    - protocol: TCP
      port: 5678
```

This says: "The `api` Pod accepts incoming traffic only from Pods with labels
`app=web, tier=frontend` on port 5678."

### Allow Database to Receive Traffic Only from API

```yaml
# file: allow-db-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-db-from-api
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: database
      tier: database
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api
          tier: backend
    ports:
    - protocol: TCP
      port: 5678
```

### Apply All Policies

```bash
kubectl apply -f allow-web-ingress.yaml
kubectl apply -f allow-api-ingress.yaml
kubectl apply -f allow-db-ingress.yaml
```

### Test the Rules

```bash
kubectl exec -n production deploy/web -- wget -qO- --timeout=3 api.production:80
```
Expected: **Success** (web → api is allowed)

```bash
kubectl exec -n production deploy/web -- wget -qO- --timeout=3 database.production:80
```
Expected: **Timeout** (web → database is NOT allowed, must go through api)

```bash
kubectl exec -n production deploy/api -- wget -qO- --timeout=3 database.production:80
```
Expected: **Success** (api → database is allowed)

```bash
kubectl exec -n monitoring deploy/prometheus -- wget -qO- --timeout=3 api.production:80
```
Expected: **Timeout** (monitoring → api not allowed yet)

The architecture is enforced. The web frontend can't skip the API and hit the
database directly. This is defense in depth.

---

## Cross-Namespace Policies

Let's allow the monitoring namespace to scrape metrics from all Pods in
production.

```yaml
# file: allow-monitoring.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring-ingress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          env: monitoring
    ports:
    - protocol: TCP
      port: 5678
```

The `namespaceSelector` selects by namespace labels (we set `env: monitoring`
on the namespace earlier). This allows any Pod in the `monitoring` namespace to
reach any Pod in `production` on port 5678.

```bash
kubectl apply -f allow-monitoring.yaml
```

Test:

```bash
kubectl exec -n monitoring deploy/prometheus -- wget -qO- --timeout=3 api.production:80
```

Expected: **Success** — monitoring can now reach production Pods.

### Combining Pod and Namespace Selectors

You can combine selectors for fine-grained control:

```yaml
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        env: monitoring
    podSelector:
      matchLabels:
        app: prometheus
```

**Important**: when `namespaceSelector` and `podSelector` are in the **same**
list item (no `-` before `podSelector`), it's an AND — both must match. When
they're separate list items (each has a `-`), it's an OR — either can match.

```yaml
# AND: must be in monitoring namespace AND have app=prometheus label
- from:
  - namespaceSelector:
      matchLabels:
        env: monitoring
    podSelector:
      matchLabels:
        app: prometheus

# OR: from monitoring namespace OR from Pods with app=prometheus label
- from:
  - namespaceSelector:
      matchLabels:
        env: monitoring
  - podSelector:
      matchLabels:
        app: prometheus
```

This is a subtle but critical difference. Getting it wrong is a common source
of security holes.

---

## Egress Policies

So far we've only controlled incoming traffic. Egress policies control where
Pods can send traffic to.

### Default Deny Egress

```yaml
# file: default-deny-egress.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-egress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Egress
```

**Warning**: this blocks ALL outgoing traffic, including DNS. Without DNS, Pods
can't resolve Service names. You almost always need to pair a deny-egress
policy with a DNS allow rule.

### Allow DNS Egress

```yaml
# file: allow-dns-egress.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
```

This allows all Pods in production to make DNS queries (port 53) to any
namespace — necessary because CoreDNS runs in `kube-system`.

### Allow API to Reach Database (Egress)

```yaml
# file: api-egress.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-to-database-egress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api
      tier: backend
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
          tier: database
    ports:
    - protocol: TCP
      port: 5678
```

```bash
kubectl apply -f default-deny-egress.yaml
kubectl apply -f allow-dns-egress.yaml
kubectl apply -f api-egress.yaml
```

Now the API can only send traffic to the database (and DNS). It can't make
outbound HTTP calls to the internet or any other Pod. This limits the blast
radius if the API is compromised.

---

## IP Block Policies

Sometimes you need to allow traffic from external IP ranges (not Pods):

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-cidr
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: web
  policyTypes:
  - Ingress
  ingress:
  - from:
    - ipBlock:
        cidr: 10.0.0.0/8
        except:
        - 10.0.1.0/24
    ports:
    - protocol: TCP
      port: 5678
```

This allows traffic from the `10.0.0.0/8` range except `10.0.1.0/24`. Useful
for allowing traffic from your corporate network while blocking a specific
subnet.

---

## Complete Lockdown Example

Here's a comprehensive policy set for a typical three-tier application:

```yaml
# file: full-lockdown.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: frontend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - ports:
    - protocol: TCP
      port: 5678
  egress:
  - to:
    - podSelector:
        matchLabels:
          tier: backend
    ports:
    - protocol: TCP
      port: 5678
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: frontend
    ports:
    - protocol: TCP
      port: 5678
  egress:
  - to:
    - podSelector:
        matchLabels:
          tier: database
    ports:
    - protocol: TCP
      port: 5678
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: database
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: backend
    ports:
    - protocol: TCP
      port: 5678
```

---

## CNI Plugins That Support Network Policies

Not all CNI plugins implement Network Policies. The policy objects will exist
in the API, but they won't do anything without a supporting CNI.

| CNI Plugin | Network Policies | Additional Features |
|-----------|-----------------|-------------------|
| **Calico** | Yes | Global policies, application-layer policies |
| **Cilium** | Yes | L7 policies (HTTP, gRPC), eBPF-based |
| **Weave Net** | Yes | Encrypted networking |
| **Antrea** | Yes | VMware-backed, Octant UI |
| **Flannel** | **No** | Basic overlay networking only |
| **kindnet** | **No** | Simple, default for kind |

For production, Calico and Cilium are the most popular choices. Cilium is
particularly powerful because it can enforce policies at Layer 7 — meaning you
can write rules like "allow GET requests to `/api/health` but block POST
requests."

---

## Relating to Go/TypeScript Patterns

Network Policies map to concepts you already know:

**Middleware in Express/Go**: Network policies are like a cluster-level
middleware. In Express, you might write:

```typescript
app.use("/api", requireAuth);
```

Network policies do the same thing but at the network level — before the
request even reaches your app.

**Go's `net/http` handlers**: you might check the client IP in your handler:

```go
func handler(w http.ResponseWriter, r *http.Request) {
    if !isAllowedIP(r.RemoteAddr) {
        http.Error(w, "forbidden", 403)
        return
    }
}
```

Network policies do this check before the packet reaches your Pod, which is
more efficient and more secure — your app doesn't need to handle unauthorized
traffic at all.

---

## Exercises

### Exercise 1: Build a Firewall

1. Deploy a three-tier app (frontend, backend, database) in a namespace
2. Create a default-deny-all policy (both ingress and egress)
3. Progressively add policies to allow only the traffic flow:
   `frontend → backend → database`
4. Verify at each step that unauthorized paths are blocked
5. Don't forget to allow DNS egress

### Exercise 2: Cross-Namespace Access

1. Create namespaces: `team-a`, `team-b`, `shared`
2. Deploy apps in each namespace
3. Create policies so that:
   - `team-a` can reach `shared` but not `team-b`
   - `team-b` can reach `shared` but not `team-a`
   - `shared` cannot initiate connections to either team
4. Test all six combinations

### Exercise 3: Egress Control

1. Deploy a Pod that normally can reach the internet
2. Create an egress policy that only allows traffic to cluster-internal IPs
3. Verify the Pod can still reach cluster Services
4. Verify the Pod can NOT reach `google.com`
5. Add an exception for a specific external IP range

### Exercise 4: Policy Debugging

1. Deploy an app that depends on three internal services
2. Apply a Network Policy but deliberately include a subtle mistake (wrong
   label selector, missing DNS egress, AND vs OR confusion)
3. Use `kubectl describe networkpolicy` and connectivity tests to find the bug
4. Fix the policy and verify

---

## What Would Happen If...

**Q: You create a NetworkPolicy but your CNI doesn't support it?**
A: The policy object is created and stored in etcd, but nothing enforces it.
All traffic flows freely. This is dangerous because you think you're protected
but you're not. Always verify your CNI supports policies.

**Q: You create a default-deny egress but forget to allow DNS?**
A: All Service name resolution breaks. Pods can still reach other Pods by IP
address, but any attempt to use Service names fails. This is the most common
NetworkPolicy mistake.

**Q: Two policies select the same Pod with different rules?**
A: Policies are additive (union). If Policy A allows traffic from frontend and
Policy B allows traffic from monitoring, the Pod accepts traffic from both.
Policies never conflict — they only add more allowed paths.

**Q: You delete all NetworkPolicies from a namespace?**
A: All Pods in that namespace go back to the default: accept all traffic.
Network Policies are not sticky — removing them removes the restrictions.

**Q: A Pod matches a policy's `podSelector` but the traffic doesn't match any
`ingress` rule?**
A: The traffic is denied. Being selected by a policy with no matching rules is
the same as being behind a locked door with no matching key cards.

---

## Key Takeaways

1. **Default is wide open**: all Pods can talk to all Pods. You must explicitly
   restrict.
2. **Start with default deny**: create deny-all policies first, then allow
   specific traffic
3. **Always allow DNS**: egress deny breaks DNS resolution. Allow port 53 UDP/TCP
4. **AND vs OR**: same list item = AND, separate list items = OR. Get this wrong
   and you'll either block too much or allow too much
5. **Policies are additive**: multiple policies on the same Pod create a union
   of allowed traffic
6. **CNI must support it**: Flannel and kindnet do NOT enforce policies. Use
   Calico or Cilium
7. **Labels are everything**: your label strategy directly impacts how
   expressive your policies can be

---

## Cleanup

```bash
kind delete cluster --name netpol-lab
```

---

Next: [Lesson 13: StatefulSets →](./13-statefulsets.md)
