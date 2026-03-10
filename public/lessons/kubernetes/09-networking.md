# Kubernetes Networking

## The Campus Analogy

Think of a Kubernetes cluster as a university campus.

Every room on campus (Pod) has its own phone extension (IP address). Any room can call any other room directly — Room 301 in the Science Building can call Room 215 in the Library by dialing the extension. No need to go through a switchboard for direct calls.

The campus also has department phone numbers (Services). When you call the "Physics Department," the switchboard (kube-proxy) routes your call to one of the available professors. You don't need to know which office they're in.

Visitors from outside campus (external traffic) come through the main entrance (Ingress or LoadBalancer). The receptionist checks who they're looking for and directs them to the right building.

---

## The Kubernetes Networking Model

Kubernetes networking has three fundamental rules:

1. **Every Pod gets its own IP address.** No NAT between Pods. No port mapping. Pod A at 10.244.1.5 can reach Pod B at 10.244.2.3 directly.

2. **Pods on any node can communicate with Pods on any other node** without NAT. A Pod on Node 1 can reach a Pod on Node 3 by IP, as if they were on the same network.

3. **Agents on a node (kubelet, kube-proxy) can communicate with all Pods on that node.**

These rules create a flat network. Every Pod has a unique, routable IP address. No port conflicts, no NAT tables, no port mapping.

### Why this matters for Go/TypeScript developers

In Docker on your laptop, containers in different networks can't reach each other without port mapping or shared networks. In Kubernetes, every container can reach every other container by IP. Your code connects to `10.244.2.3:8080` the same way it connects to `localhost:8080` — just a TCP connection.

This means your Go HTTP client or Node.js `fetch` works exactly as expected:

```go
resp, err := http.Get("http://10.244.2.3:8080/api/users")
```

In practice, you use Service DNS names instead of IPs (Services give stable names for ephemeral Pod IPs). But the underlying network allows direct Pod-to-Pod communication.

---

## How Pods Get IP Addresses

Each node is assigned a CIDR range (a block of IP addresses). Pods on that node get IPs from that range.

```
Cluster CIDR: 10.244.0.0/16 (65,536 addresses)

Node A CIDR: 10.244.1.0/24 (256 addresses)
  Pod: 10.244.1.5
  Pod: 10.244.1.12
  Pod: 10.244.1.87

Node B CIDR: 10.244.2.0/24 (256 addresses)
  Pod: 10.244.2.3
  Pod: 10.244.2.15
  Pod: 10.244.2.201

Node C CIDR: 10.244.3.0/24 (256 addresses)
  Pod: 10.244.3.1
  Pod: 10.244.3.44
```

When a Pod is created on Node A, it gets the next available IP from 10.244.1.0/24. When it dies, the IP is recycled.

This is managed by the CNI (Container Network Interface) plugin.

---

## CNI Plugins

Kubernetes doesn't implement networking itself. It delegates to a CNI plugin. The CNI plugin is responsible for:
- Assigning IP addresses to Pods
- Setting up routes so Pods on different nodes can reach each other
- Implementing network policies

### Common CNI Plugins

**Calico**: The most popular. Supports NetworkPolicies. Uses BGP for routing or VXLAN for encapsulation. Good performance. Works everywhere.

**Cilium**: Uses eBPF (extended Berkeley Packet Filter) in the Linux kernel. Very high performance. Rich NetworkPolicy support. Becoming the default for many new clusters.

**Flannel**: Simple. Uses VXLAN overlays. No NetworkPolicy support. Good for learning, not for production.

**AWS VPC CNI**: For EKS. Assigns Pods real VPC IP addresses. Pods are directly routable from EC2 instances, Lambda, etc. No overlay network.

**kindnet**: Used by kind. Minimal, just for local development.

### How a CNI plugin works (simplified)

1. Pod is scheduled on Node A
2. kubelet calls the CNI plugin: "Create network for this Pod"
3. CNI plugin:
   - Creates a network namespace for the Pod
   - Creates a virtual ethernet pair (veth) — one end in the Pod, one on the host
   - Assigns an IP from the node's CIDR range
   - Sets up routes so the Pod can reach other Pods

For cross-node communication, the CNI plugin either:
- **Overlay (VXLAN)**: Encapsulates Pod traffic in UDP packets between nodes (Flannel, Calico in VXLAN mode)
- **Native routing (BGP)**: Programs the network's routing tables so routers know which node has which Pod IPs (Calico in BGP mode)
- **Cloud integration**: Uses cloud-native networking (AWS VPC CNI assigns VPC IPs directly)

---

## Traffic Flows

### Pod-to-Pod (Same Node)

```
Pod A (10.244.1.5) → Linux bridge/veth → Pod B (10.244.1.12)
```

Traffic stays on the node. Goes through the Linux bridge (or eBPF with Cilium). Fast — just memory copies.

### Pod-to-Pod (Different Nodes)

```
Pod A (10.244.1.5) on Node 1
    ↓
Node 1's network interface
    ↓ (VXLAN tunnel or routed)
Node 2's network interface
    ↓
Pod B (10.244.2.3) on Node 2
```

With VXLAN: the original packet is wrapped in a UDP packet, sent to Node 2, unwrapped, and delivered. Small overhead.

With BGP: the packet is routed directly. Node 1's routing table knows "10.244.2.0/24 is on Node 2." No encapsulation.

With AWS VPC CNI: Pods have real VPC IPs. Traffic uses standard VPC routing. No overlay.

### Pod-to-Service

```
Pod A (10.244.1.5) → ClusterIP (10.96.0.50:80)
    ↓ (kube-proxy iptables DNAT)
Pod B (10.244.2.3:8080)
```

The Pod sends to the Service's ClusterIP. Before the packet leaves the node, iptables rules (programmed by kube-proxy) rewrite the destination to a real Pod IP. The response goes back through the same path.

The Pod doesn't know about the Service — it just sees a response from a Pod IP. The DNAT is transparent.

### External-to-Service (NodePort)

```
Client → Node IP:30080
    ↓ (kube-proxy iptables)
Pod B (10.244.2.3:8080)
```

Traffic hits a node's port. kube-proxy rules route it to a Pod. The Pod could be on any node — kube-proxy handles cross-node forwarding.

### External-to-Service (LoadBalancer)

```
Client → Cloud LB (34.123.45.67:80)
    ↓
Node A:NodePort or Node B:NodePort
    ↓ (kube-proxy iptables)
Pod (10.244.x.x:8080)
```

The cloud load balancer distributes across nodes. Then kube-proxy routes to a Pod.

### External-to-Service (Ingress)

```
Client → Cloud LB → Ingress Controller Pod
    ↓ (HTTP routing based on host/path)
Service → Pod
```

The Ingress controller is itself a Pod. It receives all external traffic, inspects HTTP headers, and routes to the appropriate Service.

---

## How kube-proxy Works

kube-proxy watches the API server for Service and Endpoint changes. When a Service is created or its endpoints change, kube-proxy updates the node's network rules.

### iptables mode (default)

kube-proxy creates iptables rules for each Service. When a packet's destination matches a Service's ClusterIP, iptables rewrites it to a Pod IP using probabilistic selection.

For a Service with 3 endpoints:

```
-A KUBE-SERVICES -d 10.96.0.50/32 -p tcp --dport 80 -j KUBE-SVC-XXXX

-A KUBE-SVC-XXXX -m statistic --mode random --probability 0.333 -j KUBE-SEP-AAA
-A KUBE-SVC-XXXX -m statistic --mode random --probability 0.500 -j KUBE-SEP-BBB
-A KUBE-SVC-XXXX -j KUBE-SEP-CCC

-A KUBE-SEP-AAA -p tcp -j DNAT --to-destination 10.244.1.5:8080
-A KUBE-SEP-BBB -p tcp -j DNAT --to-destination 10.244.2.3:8080
-A KUBE-SEP-CCC -p tcp -j DNAT --to-destination 10.244.1.8:8080
```

The probabilities ensure roughly equal distribution: 33.3%, 50% of remaining (33.3%), and 100% of remaining (33.3%).

**Limitation**: iptables processes rules sequentially. With 10,000 Services, there are 10,000+ rules to traverse per packet. Performance degrades at scale.

### IPVS mode

Uses Linux IPVS (IP Virtual Server), which is a proper L4 load balancer in the kernel. Uses hash tables instead of sequential rules.

```
Service 10.96.0.50:80
  → 10.244.1.5:8080 (weight 1)
  → 10.244.2.3:8080 (weight 1)
  → 10.244.1.8:8080 (weight 1)
```

Supports multiple load balancing algorithms:
- Round-robin
- Least connections
- Source hash (session affinity)

Much better performance at scale. Recommended for clusters with hundreds of Services.

### nftables mode (newer)

Uses nftables instead of iptables. More efficient rule processing, better performance than iptables, simpler rule management.

---

## DNS in Kubernetes

CoreDNS runs as a Deployment in `kube-system` and handles all DNS resolution in the cluster.

### Service DNS

```
my-service.my-namespace.svc.cluster.local → ClusterIP
```

### Pod DNS (rarely used directly)

```
10-244-1-5.my-namespace.pod.cluster.local → 10.244.1.5
```

### Headless Service DNS

```
my-headless.my-namespace.svc.cluster.local → [10.244.1.5, 10.244.2.3, 10.244.1.8]
```

Returns multiple A records (one per Pod), not a single ClusterIP.

### SRV Records

```
_http._tcp.my-service.my-namespace.svc.cluster.local → port 80 on the ClusterIP
```

SRV records include the port. Useful for service discovery protocols.

### How DNS resolution works in a Pod

When a Pod does `nslookup my-service`:

1. Pod's `/etc/resolv.conf` points to CoreDNS (usually `10.96.0.10`)
2. CoreDNS receives the query
3. CoreDNS checks if it's a cluster domain (`.cluster.local`)
4. If yes, looks up the Service and returns the ClusterIP
5. If no, forwards to upstream DNS (node's DNS, cloud DNS)

```bash
kubectl exec my-pod -- cat /etc/resolv.conf
```

```
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

The `search` directive means `my-service` is expanded to:
1. `my-service.default.svc.cluster.local` (found! returns ClusterIP)
2. If not found: `my-service.svc.cluster.local`
3. If not found: `my-service.cluster.local`
4. If not found: `my-service` (forwarded to upstream)

The `ndots:5` option means any name with fewer than 5 dots gets the search suffixes appended. This is why `api.backend` works (2 dots < 5, so search suffixes are tried).

---

## Hands-On: Explore Pod Networking

### Setup

```bash
kind create cluster --name net-lab --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
EOF
```

### See Pod IPs

```bash
kubectl create deployment web --image=nginx:1.25 --replicas=6

kubectl get pods -o wide
```

Note the IP addresses and which node each Pod is on. Pods on the same node share an IP prefix. Pods on different nodes have different prefixes.

### Direct Pod-to-Pod communication

Get a Pod IP:

```bash
POD_IP=$(kubectl get pod -l app=web -o jsonpath='{.items[0].status.podIP}')
echo $POD_IP
```

Curl it from another Pod:

```bash
kubectl run curl --image=curlimages/curl --rm -it --restart=Never -- curl http://$POD_IP:80
```

Direct Pod-to-Pod communication works without any Service.

### Cross-node Pod communication

Find two Pods on different nodes:

```bash
kubectl get pods -o wide -l app=web
```

Pick a Pod on Node A and curl a Pod on Node B:

```bash
kubectl exec <pod-on-node-a> -- curl -s http://<pod-on-node-b-ip>:80
```

Works seamlessly. The CNI plugin handles cross-node routing.

### Inspect DNS

```bash
kubectl run dns-debug --image=busybox:1.36 --rm -it --restart=Never -- sh -c '
  echo "=== resolv.conf ==="
  cat /etc/resolv.conf
  echo ""
  echo "=== Lookup kubernetes service ==="
  nslookup kubernetes.default.svc.cluster.local
  echo ""
  echo "=== Lookup external domain ==="
  nslookup google.com
'
```

---

## Hands-On: Service Networking

### Create a Service and trace the traffic

```bash
kubectl expose deployment web --port=80 --target-port=80

kubectl get svc web
kubectl get endpoints web
```

### See how kube-proxy routes traffic

```bash
kubectl run trace --image=curlimages/curl --rm -it --restart=Never -- sh -c '
  SVC_IP=$(nslookup web | grep Address | tail -1 | awk "{print \$2}")
  echo "Service IP: $SVC_IP"
  echo ""
  for i in $(seq 1 10); do
    curl -s -o /dev/null -w "Request $i: connected to %{remote_ip}\n" http://web:80
  done
'
```

Each request might connect to a different Pod IP. kube-proxy is distributing traffic.

### Inspect iptables rules (advanced)

In kind, nodes are Docker containers. You can see the iptables rules:

```bash
docker exec net-lab-worker iptables -t nat -L KUBE-SERVICES -n | head -20
```

You'll see rules for each Service's ClusterIP, routing to chains that DNAT to Pod IPs.

---

## Hands-On: Network Debugging

### DNS not resolving?

```bash
kubectl run dns-test --image=busybox:1.36 --rm -it --restart=Never -- nslookup my-service
```

If it fails:

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns

kubectl logs -n kube-system -l k8s-app=kube-dns
```

CoreDNS might be down or misconfigured.

### Pod can't reach another Pod?

```bash
kubectl run net-test --image=nicolaka/netshoot --rm -it --restart=Never -- sh -c '
  echo "=== Ping test ==="
  ping -c 3 10.244.2.3
  echo ""
  echo "=== TCP test ==="
  nc -zv 10.244.2.3 8080
  echo ""
  echo "=== Traceroute ==="
  traceroute 10.244.2.3
'
```

`netshoot` is a container image packed with networking tools. Essential for debugging.

### Service endpoints empty?

```bash
kubectl get endpoints my-service
```

If `<none>`, either:
- No Pods match the Service's selector (check labels)
- Pods exist but aren't ready (check readiness probes)

```bash
kubectl get pods --show-labels

kubectl get pods -l app=my-api
```

### Port not reachable?

```bash
kubectl exec my-pod -- netstat -tlnp

kubectl exec my-pod -- ss -tlnp
```

Check if the process is actually listening on the expected port.

---

## Network Performance Considerations

### Pod-to-Pod overhead

| CNI Mode | Overhead |
|----------|----------|
| Same node | Negligible (virtual bridge) |
| VXLAN overlay | ~5-10% (encapsulation) |
| BGP native routing | ~1-2% (no encapsulation) |
| AWS VPC CNI | ~0% (native VPC routing) |
| eBPF (Cilium) | Lower than iptables |

For most Go/TypeScript APIs, the overhead is negligible. It matters for high-throughput data processing.

### DNS performance

Each DNS lookup adds latency (typically 1-5ms). For high-frequency service calls:
- Use connection pooling in your HTTP clients (Go's `http.Client` does this by default)
- Use gRPC with long-lived connections
- Consider DNS caching in the Pod (NodeLocal DNSCache)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns-custom
  namespace: kube-system
data:
  custom.server: |
    cache 30
```

### Connection pooling in Go

```go
client := &http.Client{
    Transport: &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 100,
        IdleConnTimeout:     90 * time.Second,
    },
}
```

Reuse the client across requests. Don't create a new `http.Client` per request.

---

## What Would Happen If...

**...the CNI plugin crashed on a node?**

Existing Pods keep their network connections. But new Pods can't get IP addresses. They'd stay in `ContainerCreating` state. The kubelet logs would show CNI errors. Restart the CNI plugin (usually a DaemonSet — it auto-restarts).

**...CoreDNS went down?**

All new DNS lookups fail. Existing connections work (already resolved). Pods would get `SERVFAIL` errors. Since CoreDNS runs as a Deployment, the failed Pods get replaced. Brief DNS outage, usually seconds.

**...you exhausted the Pod CIDR range?**

No more IPs for new Pods. They'd stay `Pending` with an error about IP allocation. This happens on large clusters with small CIDR ranges. Plan for growth — `/16` gives 65,536 addresses.

**...two Pods had the same IP?**

This shouldn't happen (the CNI plugin assigns unique IPs). If it does (bug in the CNI), traffic gets misrouted. Both Pods receive traffic meant for the other. Network chaos.

**...network latency between nodes was high?**

Cross-node Pod communication is slow. Services that spread across nodes would have variable latency depending on which Pod handles the request. Use topology-aware routing or pod affinity to keep communicating Pods on the same node.

**...you ran a database and its client on different nodes?**

Every query crosses the network. The VXLAN overhead adds a few hundred microseconds per packet. For a database doing 10,000 queries/second, that adds up. Use node affinity to co-locate database clients with the database, or accept the overhead (it's often acceptable).

---

## Networking for Go/TypeScript Microservices

### Service-to-Service Communication

```go
const backendURL = "http://user-service.backend:80"

resp, err := client.Get(backendURL + "/api/users/" + userID)
```

Kubernetes DNS resolves `user-service.backend` to the ClusterIP. kube-proxy routes to a healthy Pod. Your code doesn't need to know about Pods, nodes, or IPs.

### gRPC Services

gRPC uses long-lived HTTP/2 connections. With kube-proxy's iptables mode, the connection goes to one Pod and stays there. No load balancing across Pods for the life of the connection.

Solutions:
- Use a headless Service and client-side load balancing (grpc-go supports this)
- Use a service mesh (Istio, Linkerd) for L7 load balancing
- Use multiple short-lived connections

```go
conn, err := grpc.Dial(
    "dns:///my-grpc-service.default:50051",
    grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"round_robin"}`),
)
```

The `dns:///` prefix tells grpc-go to use DNS for service discovery and round-robin across all returned IPs (from a headless Service).

---

## Exercises

1. **Trace a packet.** Deploy nginx on two different nodes. From a Pod on Node A, curl the nginx Pod on Node B. Use `tcpdump` in a privileged Pod on Node A to see the packet. Observe the VXLAN encapsulation (if your CNI uses it).

2. **DNS exploration.** Deploy a service. From a test Pod, resolve the service using:
   - Short name (`my-svc`)
   - Namespace-qualified (`my-svc.default`)
   - Fully qualified (`my-svc.default.svc.cluster.local`)
   - SRV record (`nslookup -type=srv _http._tcp.my-svc.default.svc.cluster.local`)

3. **Headless vs. regular Service.** Create both for the same Deployment (3 replicas). Compare DNS responses. Regular returns 1 IP. Headless returns 3 IPs.

4. **Pod-to-Pod latency.** Use `kubectl exec` to run `ping` between Pods on the same node and on different nodes. Compare the latency. Same-node should be sub-millisecond. Cross-node depends on your network.

5. **Break DNS and fix it.** Scale CoreDNS to 0 replicas (`kubectl scale deployment coredns -n kube-system --replicas=0`). Try resolving a Service name from a test Pod. Scale CoreDNS back up. Verify resolution works again. Note how long the outage lasted.

---

## Key Takeaways

- Every Pod gets its own IP — no NAT, no port mapping
- CNI plugins handle IP assignment and cross-node routing
- kube-proxy programs iptables/IPVS rules for Service routing
- ClusterIP is a virtual IP — kube-proxy translates it to real Pod IPs
- CoreDNS provides cluster DNS — Services get automatic DNS names
- The flat network model means your Go/TypeScript code "just works" with standard HTTP clients
- Use IPVS mode for large clusters (hundreds of Services)
- gRPC needs special handling for load balancing (headless Services or service mesh)

Next: Ingress — routing external HTTP traffic into the cluster.
