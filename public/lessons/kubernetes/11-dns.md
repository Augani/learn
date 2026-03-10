# Lesson 11: DNS in Kubernetes — Service Discovery

## The Big Picture

Imagine you start a new job at a big company. You need to reach the accounting
department, but you don't know anyone's direct phone number. You don't need to.
You pick up the phone, dial "accounting," and the internal phone directory
connects you to someone available in that department. You never memorize
extensions. If someone in accounting leaves and a new person is hired, the
directory updates and your call still goes through.

That's exactly how DNS works in Kubernetes. CoreDNS is the internal phone
directory. Services are department names. Pods are the people with extensions.
You never hardcode Pod IPs — you just use the Service name, and the DNS system
figures out the rest.

If you've used Go's `net.Dial("tcp", "my-service:8080")` or Node's
`fetch("http://my-service:8080")` inside a Kubernetes cluster, DNS is the
reason those hostnames resolve to actual IP addresses.

---

## Prerequisites

- Lesson 05 (Services)
- Lesson 08 (Namespaces)
- Lesson 09 (Kubernetes networking model)
- A running `kind` cluster

```bash
kind create cluster --name dns-lab
```

---

## CoreDNS: The Cluster's Phone Directory

Every Kubernetes cluster runs a DNS server. Since Kubernetes 1.13, that DNS
server is **CoreDNS**. Before CoreDNS, clusters used kube-dns, which was a
combination of three containers doing the same job less efficiently.

CoreDNS runs as a Deployment in the `kube-system` namespace:

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
```

You'll see something like:

```
NAME                       READY   STATUS    RESTARTS   AGE
coredns-5d78c9869d-4xjkl   1/1     Running   0          5m
coredns-5d78c9869d-9wrtm   1/1     Running   0          5m
```

There's a Service that exposes CoreDNS to all Pods in the cluster:

```bash
kubectl get svc -n kube-system kube-dns
```

```
NAME       TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)                  AGE
kube-dns   ClusterIP   10.96.0.10   <none>        53/UDP,53/TCP,9153/TCP   5m
```

That `10.96.0.10` address is crucial. Every Pod in the cluster is configured to
use this as its DNS server. Check any Pod's `/etc/resolv.conf` and you'll see
it.

### How CoreDNS Gets Its Data

CoreDNS doesn't maintain its own database. It watches the Kubernetes API server
for Service and Endpoint changes. When you create a Service, the API server
stores it in etcd. CoreDNS sees the change and immediately starts resolving
that Service name to its ClusterIP.

Think of it like this: the API server is the HR department that tracks all
employees. CoreDNS subscribes to HR updates. When someone new is hired (Service
created) or someone leaves (Service deleted), CoreDNS updates its directory
automatically.

---

## The DNS Naming Format

Every Service in Kubernetes gets a DNS name following this pattern:

```
<service-name>.<namespace>.svc.cluster.local
```

Let's break that down:

| Part | Meaning |
|------|---------|
| `service-name` | The name you gave the Service |
| `namespace` | The namespace the Service lives in |
| `svc` | Indicates this is a Service (not a Pod) |
| `cluster.local` | The default cluster domain |

### Examples

A Service named `api` in the `production` namespace:
```
api.production.svc.cluster.local
```

A Service named `postgres` in the `databases` namespace:
```
postgres.databases.svc.cluster.local
```

A Service named `redis` in the `default` namespace:
```
redis.default.svc.cluster.local
```

### Shorthand Works Too

You don't always need the full name. Kubernetes configures each Pod's
`/etc/resolv.conf` with search domains:

```
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

Because of the `search` line, these all resolve to the same thing (from a Pod
in the `default` namespace):

```
redis                                  # shortest — same namespace
redis.default                          # explicit namespace
redis.default.svc                      # explicit svc
redis.default.svc.cluster.local        # fully qualified (FQDN)
```

**The rule**: if you're calling a Service in the same namespace, just use the
Service name. If you're calling a Service in a different namespace, use
`<service>.<namespace>`.

This is just like how in Go you can call functions in the same package by name,
but need `package.Function()` for other packages.

### The ndots:5 Setting

That `ndots:5` in resolv.conf is important. It means: if the hostname has fewer
than 5 dots, try appending the search domains first before treating it as an
absolute name.

`redis` has 0 dots (less than 5), so Kubernetes tries:
1. `redis.default.svc.cluster.local` — found it!

`google.com` has 1 dot (less than 5), so Kubernetes tries:
1. `google.com.default.svc.cluster.local` — nope
2. `google.com.svc.cluster.local` — nope
3. `google.com.cluster.local` — nope
4. `google.com` — found it (external DNS)

This means external DNS lookups are slower because they go through all the
search domains first. For production apps that make lots of external DNS calls,
you can use a trailing dot (`google.com.`) to skip the search — a trailing dot
means "this is already fully qualified."

---

## Seeing DNS in Action

Let's create a Service and resolve it from another Pod.

### Step 1: Deploy an Application

```yaml
# file: dns-demo.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-api
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hello-api
  template:
    metadata:
      labels:
        app: hello-api
    spec:
      containers:
      - name: hello
        image: hashicorp/http-echo
        args:
        - "-text=hello from the API"
        ports:
        - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: hello-api
  namespace: default
spec:
  selector:
    app: hello-api
  ports:
  - port: 80
    targetPort: 5678
```

```bash
kubectl apply -f dns-demo.yaml
```

### Step 2: Run a Debug Pod

```bash
kubectl run dnsutils --image=tutum/dnsutils --command -- sleep 3600
kubectl wait --for=condition=ready pod/dnsutils --timeout=60s
```

### Step 3: Resolve the Service

```bash
kubectl exec dnsutils -- nslookup hello-api
```

```
Server:    10.96.0.10
Address:   10.96.0.10#53

Name:      hello-api.default.svc.cluster.local
Address:   10.96.45.123
```

The `Server` is CoreDNS. The `Address` in the response is the ClusterIP of the
`hello-api` Service. You're seeing the phone directory in action.

### Step 4: Try the Full Name

```bash
kubectl exec dnsutils -- nslookup hello-api.default.svc.cluster.local
```

Same result. The shorthand and full name both work.

### Step 5: Check the Pod's DNS Config

```bash
kubectl exec dnsutils -- cat /etc/resolv.conf
```

```
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

---

## Cross-Namespace DNS

Let's create a Service in another namespace and resolve it.

```bash
kubectl create namespace backend
```

```yaml
# file: backend-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: backend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-svc
        image: hashicorp/http-echo
        args:
        - "-text=user service response"
        ports:
        - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: backend
spec:
  selector:
    app: user-service
  ports:
  - port: 80
    targetPort: 5678
```

```bash
kubectl apply -f backend-service.yaml
```

Now from the `dnsutils` Pod (which is in the `default` namespace):

```bash
kubectl exec dnsutils -- nslookup user-service.backend
```

```
Server:    10.96.0.10
Address:   10.96.0.10#53

Name:      user-service.backend.svc.cluster.local
Address:   10.96.78.45
```

Just `user-service` without the namespace won't work from the `default`
namespace — it would try `user-service.default.svc.cluster.local` and fail.

This is the equivalent of importing from another package in Go:

```go
// Within the same namespace — just use the name
resp, err := http.Get("http://hello-api:80")

// Cross-namespace — qualify with namespace
resp, err := http.Get("http://user-service.backend:80")
```

In TypeScript/Node:

```typescript
// Same namespace
const resp = await fetch("http://hello-api:80");

// Cross-namespace
const resp = await fetch("http://user-service.backend:80");
```

---

## DNS Policies

Every Pod has a `dnsPolicy` that controls how DNS resolution works. Think of it
as choosing which phone directory to use.

### ClusterFirst (Default)

The default. All DNS queries go to CoreDNS first. If CoreDNS can't resolve the
name (it's not a cluster Service), it forwards the query to the upstream DNS
server (usually the node's DNS).

```yaml
spec:
  dnsPolicy: ClusterFirst
  containers:
  - name: app
    image: my-app
```

This is what you want 99% of the time. Your Pod can resolve both cluster
Services (`hello-api`) and external domains (`google.com`).

### Default

Uses the DNS configuration from the node the Pod runs on. The Pod gets the
node's `/etc/resolv.conf`. Cluster Service names will **not** resolve.

```yaml
spec:
  dnsPolicy: Default
  containers:
  - name: app
    image: my-app
```

Use case: almost never. Maybe for a Pod that only talks to external services
and you want to bypass CoreDNS entirely.

### None

No DNS configuration is auto-applied. You must provide it yourself via
`dnsConfig`.

```yaml
spec:
  dnsPolicy: None
  dnsConfig:
    nameservers:
    - 8.8.8.8
    - 8.8.4.4
    searches:
    - my-company.com
  containers:
  - name: app
    image: my-app
```

Use case: when you need to point at a custom DNS server (e.g., a corporate DNS
that resolves internal domains).

### ClusterFirstWithHostNet

If your Pod uses `hostNetwork: true` (binds to the node's network), the
default behavior changes to use the node's DNS. `ClusterFirstWithHostNet`
forces it back to using CoreDNS.

```yaml
spec:
  hostNetwork: true
  dnsPolicy: ClusterFirstWithHostNet
  containers:
  - name: app
    image: my-app
```

### Comparison Table

| Policy | Resolves cluster Services? | Resolves external DNS? | When to use |
|--------|---------------------------|----------------------|-------------|
| ClusterFirst | Yes | Yes (via forward) | Almost always |
| Default | No | Yes (node's DNS) | Rare edge cases |
| None | Depends on dnsConfig | Depends on dnsConfig | Custom DNS servers |
| ClusterFirstWithHostNet | Yes | Yes | hostNetwork Pods |

---

## Headless Services: When You Need Pod IPs Directly

A normal Service gets a ClusterIP, and DNS resolves the Service name to that
single ClusterIP. The Service then load-balances across its Pods.

A **headless Service** has no ClusterIP (`clusterIP: None`). When you do a DNS
lookup, instead of getting one Service IP, you get the IP addresses of every
individual Pod behind the Service.

Think of the phone directory analogy: a normal Service is like calling the
"accounting department" number and being connected to whoever's available. A
headless Service is like looking up accounting in the directory and getting
every person's direct extension — then you choose who to call.

### Why Would You Want This?

1. **StatefulSets** — each replica has a unique identity and you need to reach
   specific Pods (e.g., `postgres-0`, `postgres-1`)
2. **Client-side load balancing** — your app wants to know all Pod IPs and
   implement its own routing
3. **Peer discovery** — Pods in a cluster (like Redis or Cassandra) need to
   find each other

### Creating a Headless Service

```yaml
# file: headless-demo.yaml
apiVersion: v1
kind: Service
metadata:
  name: hello-headless
spec:
  clusterIP: None
  selector:
    app: hello-api
  ports:
  - port: 80
    targetPort: 5678
```

```bash
kubectl apply -f headless-demo.yaml
```

Now look up the headless Service:

```bash
kubectl exec dnsutils -- nslookup hello-headless
```

```
Server:    10.96.0.10
Address:   10.96.0.10#53

Name:      hello-headless.default.svc.cluster.local
Address:   10.244.0.5
Name:      hello-headless.default.svc.cluster.local
Address:   10.244.0.6
```

You get **two** addresses — one for each Pod. Compare with the regular Service:

```bash
kubectl exec dnsutils -- nslookup hello-api
```

```
Name:      hello-api.default.svc.cluster.local
Address:   10.96.45.123
```

One address — the ClusterIP.

### DNS Records for Individual Pods in StatefulSets

When a headless Service is paired with a StatefulSet, each Pod gets its own DNS
record:

```
<pod-name>.<service-name>.<namespace>.svc.cluster.local
```

So for a StatefulSet named `postgres` with a headless Service named `postgres`:

```
postgres-0.postgres.default.svc.cluster.local → 10.244.0.5
postgres-1.postgres.default.svc.cluster.local → 10.244.0.6
postgres-2.postgres.default.svc.cluster.local → 10.244.0.7
```

This is how database replicas find each other. The primary at `postgres-0` is
always reachable at that exact DNS name, even if the Pod is restarted on a
different node with a different IP.

---

## Debugging DNS

DNS problems are one of the most common issues in Kubernetes. Here's your
debugging toolkit.

### Tool 1: nslookup

Quick and simple. Asks "does this name resolve?"

```bash
kubectl exec dnsutils -- nslookup hello-api
```

If it fails:

```
** server can't find hello-api.default.svc.cluster.local: NXDOMAIN
```

`NXDOMAIN` means "this name doesn't exist." Check that the Service exists:

```bash
kubectl get svc hello-api
```

### Tool 2: dig

More detailed than nslookup. Shows you the full DNS response.

```bash
kubectl exec dnsutils -- dig hello-api.default.svc.cluster.local
```

```
;; ANSWER SECTION:
hello-api.default.svc.cluster.local. 30 IN A 10.96.45.123

;; Query time: 1 msec
;; SERVER: 10.96.0.10#53(10.96.0.10)
```

The `A` record maps the name to an IP. The `30` is the TTL (time-to-live) in
seconds — how long the result is cached.

For a headless Service, you'll see multiple A records:

```bash
kubectl exec dnsutils -- dig hello-headless.default.svc.cluster.local
```

```
;; ANSWER SECTION:
hello-headless.default.svc.cluster.local. 30 IN A 10.244.0.5
hello-headless.default.svc.cluster.local. 30 IN A 10.244.0.6
```

### Tool 3: dig for SRV Records

SRV records include port information. Useful for StatefulSets:

```bash
kubectl exec dnsutils -- dig SRV hello-headless.default.svc.cluster.local
```

### Common DNS Debugging Flowchart

```
Can't reach a Service by name?
│
├── Does the Service exist? → kubectl get svc <name> -n <namespace>
│   └── No → Create it
│
├── Does the Service have endpoints? → kubectl get endpoints <name>
│   └── No endpoints → Labels don't match Pod labels
│
├── Can you resolve the name? → kubectl exec <pod> -- nslookup <service>
│   └── NXDOMAIN → Check namespace, check CoreDNS is running
│
├── Does the IP respond? → kubectl exec <pod> -- wget -qO- <service>:<port>
│   └── Connection refused → Wrong port or app not listening
│
└── Is CoreDNS healthy? → kubectl get pods -n kube-system -l k8s-app=kube-dns
    └── Not Running → Check CoreDNS logs
```

### Checking CoreDNS Logs

```bash
kubectl logs -n kube-system -l k8s-app=kube-dns
```

Look for errors like:
- `SERVFAIL` — CoreDNS can't reach upstream DNS
- `i/o timeout` — network issues between CoreDNS and the API server

---

## CoreDNS Configuration

CoreDNS is configured via a ConfigMap:

```bash
kubectl get configmap coredns -n kube-system -o yaml
```

The Corefile looks like:

```
.:53 {
    errors
    health {
       lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf {
       max_concurrent 1000
    }
    cache 30
    loop
    reload
    loadbalance
}
```

Key plugins:
- **kubernetes** — resolves Service and Pod names within the cluster
- **forward** — forwards external queries to upstream DNS
- **cache** — caches results for the TTL duration (30 seconds)
- **errors** — logs errors
- **health/ready** — health check endpoints

You can add custom DNS entries by editing this ConfigMap. For example, to
resolve `mydb.internal` to an external database:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
           ttl 30
        }
        hosts {
           192.168.1.100 mydb.internal
           fallthrough
        }
        prometheus :9153
        forward . /etc/resolv.conf
        cache 30
        loop
        reload
        loadbalance
    }
```

---

## ExternalName Services

There's a special Service type that creates a CNAME DNS record pointing to an
external domain:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-db
spec:
  type: ExternalName
  externalName: prod-db.us-east-1.rds.amazonaws.com
```

Now Pods can use `external-db` as the hostname, and DNS resolves it to the AWS
RDS endpoint. If you migrate the database, you update one Service definition
instead of changing every app's config.

Think of it as a DNS redirect — "when someone asks for `external-db`, tell them
to call `prod-db.us-east-1.rds.amazonaws.com` instead."

```bash
kubectl exec dnsutils -- nslookup external-db
```

```
external-db.default.svc.cluster.local  canonical name = prod-db.us-east-1.rds.amazonaws.com
```

---

## Real-World DNS Patterns

### Pattern 1: Microservice Communication (Go/TypeScript)

Your Go API server connects to a Redis cache and a PostgreSQL database:

```go
redisAddr := "redis.cache:6379"
pgConnStr := "postgres://user:pass@postgres.databases:5432/mydb"
```

Both `redis.cache` and `postgres.databases` are Service names with namespace
qualifiers. No IPs anywhere.

In TypeScript:

```typescript
const redisClient = createClient({ url: "redis://redis.cache:6379" });
const pool = new Pool({ host: "user-service.backend", port: 5432 });
```

### Pattern 2: Environment-Based Service Names

Instead of hardcoding, use environment variables from ConfigMaps:

```yaml
env:
- name: DATABASE_HOST
  value: "postgres.databases.svc.cluster.local"
- name: CACHE_HOST
  value: "redis.cache.svc.cluster.local"
```

Using the FQDN (with trailing `.cluster.local`) avoids the extra DNS lookups
from search domain expansion.

### Pattern 3: DNS-Based Health Checking

A sidecar that checks if dependencies are resolvable before starting the main
app:

```yaml
initContainers:
- name: wait-for-db
  image: busybox
  command:
  - sh
  - -c
  - |
    until nslookup postgres.databases.svc.cluster.local; do
      echo "waiting for database DNS..."
      sleep 2
    done
```

---

## Exercises

### Exercise 1: Multi-Namespace Service Discovery

1. Create three namespaces: `frontend`, `api`, `database`
2. Deploy a simple web server in each namespace
3. Create Services for each
4. From a Pod in `frontend`, resolve all three Services
5. Verify you need namespace-qualified names for cross-namespace resolution

### Exercise 2: Headless Service Exploration

1. Create a Deployment with 3 replicas
2. Create both a normal Service and a headless Service pointing to the same Pods
3. Use `dig` to compare the DNS responses
4. Scale the Deployment to 5 replicas and re-query the headless Service
5. Observe how the DNS response changes

### Exercise 3: DNS Policy Experiment

1. Create a Pod with `dnsPolicy: Default`
2. Try to resolve a cluster Service from it — observe the failure
3. Create a Pod with `dnsPolicy: ClusterFirst`
4. Resolve the same Service — observe success
5. Create a Pod with `dnsPolicy: None` and custom `dnsConfig` pointing to
   `8.8.8.8`. Can it resolve `google.com`? Can it resolve cluster Services?

### Exercise 4: ExternalName Redirect

1. Create an ExternalName Service pointing to `httpbin.org`
2. From a Pod, `nslookup` the ExternalName Service
3. Use `wget` to make an HTTP request through the ExternalName Service
4. Change the `externalName` to a different domain and observe the update

---

## What Would Happen If...

**Q: CoreDNS crashes?**
A: New DNS lookups fail. Existing connections keep working (they already resolved
the IP). Pods with cached DNS results continue for the TTL duration. This is why
CoreDNS runs 2 replicas by default — if one dies, the other keeps serving.

**Q: You create two Services with the same name in different namespaces?**
A: Totally fine. `api.frontend.svc.cluster.local` and
`api.backend.svc.cluster.local` are completely different DNS names. Same
concept as Go packages — `net/http` and `custom/http` coexist.

**Q: A Pod tries to resolve a Service that doesn't exist?**
A: The Pod gets an NXDOMAIN response. In Go, `net.Dial()` returns an error. In
Node, `fetch()` throws. Your app should handle DNS resolution failures
gracefully with retries.

**Q: You change a Service's ClusterIP?**
A: You can't change it after creation. You'd have to delete and recreate the
Service. But since Pods use the DNS name (not the IP), the new ClusterIP gets
picked up automatically after the DNS cache expires (30 seconds by default).

**Q: External DNS lookups are slow?**
A: Likely the `ndots:5` setting causing search domain expansion. Use FQDNs with
a trailing dot for external names: `api.stripe.com.` instead of
`api.stripe.com`. Or reduce `ndots` via `dnsConfig`.

---

## Key Takeaways

1. **CoreDNS** is the cluster's DNS server — it watches the API server and
   automatically creates DNS records for Services
2. **Service DNS format**: `<service>.<namespace>.svc.cluster.local`
3. **Same namespace** — just use the Service name. **Cross-namespace** — add
   the namespace
4. **ClusterFirst** is the default DNS policy and almost always what you want
5. **Headless Services** (`clusterIP: None`) return Pod IPs instead of a single
   ClusterIP — essential for StatefulSets
6. **Debug with**: `nslookup` for quick checks, `dig` for details, `kubectl
   logs` on CoreDNS for server-side issues
7. **ndots:5** means short names try search domains first — use FQDNs for
   external domains in performance-sensitive apps

---

## Cleanup

```bash
kubectl delete -f dns-demo.yaml
kubectl delete -f backend-service.yaml
kubectl delete -f headless-demo.yaml
kubectl delete pod dnsutils
kubectl delete namespace backend
kind delete cluster --name dns-lab
```

---

Next: [Lesson 12: Network Policies →](./12-network-policies.md)
