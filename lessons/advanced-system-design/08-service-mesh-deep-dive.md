# Lesson 8: Service Mesh Deep Dive

> A service mesh is an infrastructure layer for handling
> service-to-service communication. It's either the best thing
> that happened to your microservices, or the worst thing you
> added to your operational burden.

---

## The Analogy

Imagine a city without traffic lights, road signs, or lane
markings. Every driver negotiates intersections individually.
Some follow rules, some don't. When there's a crash, nobody
knows about it until they hit the traffic jam.

Now imagine the city installs a complete traffic management
system: traffic lights, speed sensors, cameras, lane controls,
and a central traffic authority. Traffic flows better, crashes
are detected instantly, and rush hour is managed proactively.

But: the traffic management system itself can break. When it
does, the entire city gridlocks — worse than having no system
at all.

That's a service mesh. Powerful when you need it. Dangerous
when you don't.

---

## What a Service Mesh Actually Does

```
  Without service mesh:
  Every service implements its own:
  - Retries
  - Timeouts
  - Circuit breakers
  - TLS certificates
  - Load balancing
  - Observability
  - Access control

  Service A ──────────────────> Service B
  (with custom retry logic,    (with different retry logic,
   hardcoded timeout,           different timeout,
   no mTLS)                     maybe mTLS)


  With service mesh:
  The mesh proxy handles ALL of the above consistently.

  Service A ──> [Proxy A] ═══════> [Proxy B] ──> Service B
                  │                    │
                  └──── Mesh Control ──┘
                        Plane

  Service A and B know nothing about retries, TLS, or
  circuit breakers. The proxies handle everything.
```

### The Sidecar Pattern

```
  Pod (Kubernetes)
  ┌─────────────────────────────────┐
  │                                 │
  │  ┌───────────┐  ┌───────────┐  │
  │  │ Your App  │  │  Envoy    │  │
  │  │           │──│  Proxy    │──│──> Network
  │  │ (port     │  │  (sidecar)│  │
  │  │  8080)    │  │  (port    │  │
  │  │           │  │   15001)  │  │
  │  └───────────┘  └───────────┘  │
  │                                 │
  └─────────────────────────────────┘

  All inbound/outbound traffic goes through the proxy.
  iptables rules redirect traffic transparently.
  Your application doesn't know the proxy exists.
```

---

## Architecture: Control Plane vs Data Plane

```
  ┌─────────────────────────────────────────────────────┐
  │                  CONTROL PLANE                       │
  │                                                     │
  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
  │  │ Config   │  │ Service  │  │ Certificate      │  │
  │  │ Manager  │  │ Discovery│  │ Authority (CA)   │  │
  │  └──────────┘  └──────────┘  └──────────────────┘  │
  │                                                     │
  └─────────────────────┬───────────────────────────────┘
                        │ xDS API (config push)
           ┌────────────┼────────────┐
           │            │            │
           ▼            ▼            ▼
  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
  │ Envoy Proxy │ │ Envoy Proxy │ │ Envoy Proxy │
  │ (sidecar)   │ │ (sidecar)   │ │ (sidecar)   │
  ├─────────────┤ ├─────────────┤ ├─────────────┤
  │ Service A   │ │ Service B   │ │ Service C   │
  └─────────────┘ └─────────────┘ └─────────────┘

  DATA PLANE: Envoy proxies handling actual traffic
  CONTROL PLANE: Configuration, certificates, policy
```

---

## Istio vs Linkerd vs Consul Connect

```
  ┌──────────────┬────────────────┬─────────────────┬───────────────┐
  │              │ Istio          │ Linkerd          │ Consul Connect│
  ├──────────────┼────────────────┼─────────────────┼───────────────┤
  │ Proxy        │ Envoy          │ linkerd2-proxy   │ Envoy/built-in│
  │              │                │ (Rust, purpose-  │               │
  │              │                │  built)          │               │
  ├──────────────┼────────────────┼─────────────────┼───────────────┤
  │ Complexity   │ High           │ Low              │ Medium        │
  │              │ (many knobs)   │ (opinionated)    │               │
  ├──────────────┼────────────────┼─────────────────┼───────────────┤
  │ Resource     │ High           │ Low              │ Medium        │
  │ overhead     │ (~50MB/proxy)  │ (~10MB/proxy)    │               │
  ├──────────────┼────────────────┼─────────────────┼───────────────┤
  │ Latency      │ ~3-5ms added   │ ~1ms added       │ ~2-3ms added  │
  │ overhead     │                │                  │               │
  ├──────────────┼────────────────┼─────────────────┼───────────────┤
  │ mTLS         │ Yes (auto)     │ Yes (auto)       │ Yes (auto)    │
  ├──────────────┼────────────────┼─────────────────┼───────────────┤
  │ Multi-cluster│ Yes            │ Yes              │ Yes           │
  ├──────────────┼────────────────┼─────────────────┼───────────────┤
  │ Best for     │ Complex policy │ Simplicity,      │ Multi-runtime │
  │              │ requirements,  │ low overhead,    │ (K8s + VMs),  │
  │              │ Envoy ecosystem│ getting started  │ HashiCorp     │
  └──────────────┴────────────────┴─────────────────┴───────────────┘
```

---

## mTLS: Zero Trust Networking

Mutual TLS means both client and server verify each other's
identity. The mesh automates certificate issuance and rotation.

```
  Without mTLS:

  Service A ──── plain HTTP ────> Service B
  (anyone on the network can see the traffic)
  (anyone can impersonate Service A)


  With mTLS:

  Service A ──── encrypted, authenticated ────> Service B
  │                                              │
  │ "I am Service A,                             │ "I am Service B,
  │  here's my cert                              │  here's my cert
  │  signed by the mesh CA"                      │  signed by the mesh CA"
  │                                              │
  └── Both verify each other's identity ─────────┘
```

### Certificate Rotation

```
  Mesh CA (Root)
       │
       ├── Issues short-lived certs (24 hours)
       │   to each sidecar proxy
       │
       ├── Rotates automatically before expiry
       │
       └── No application changes needed

  ┌───────────────────────────────────────────────┐
  │  Certificate Lifecycle                         │
  │                                               │
  │  T=0:    Proxy starts, requests cert from CA  │
  │  T=0.5s: CA issues cert (valid 24 hours)      │
  │  T=12h:  Proxy requests new cert (50% life)   │
  │  T=12.5s: CA issues new cert                  │
  │  T=24h:  Old cert expires (already replaced)  │
  │                                               │
  │  If CA is down at T=12h:                      │
  │  Retry at T=13h, T=14h, ...                   │
  │  Old cert still valid until T=24h             │
  └───────────────────────────────────────────────┘
```

---

## Traffic Management

### Canary Deployments

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: order-service
spec:
  hosts:
    - order-service
  http:
    - match:
        - headers:
            x-canary:
              exact: "true"
      route:
        - destination:
            host: order-service
            subset: canary
    - route:
        - destination:
            host: order-service
            subset: stable
          weight: 95
        - destination:
            host: order-service
            subset: canary
          weight: 5
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: order-service
spec:
  host: order-service
  subsets:
    - name: stable
      labels:
        version: v1
    - name: canary
      labels:
        version: v2
```

### Circuit Breaking

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: payment-service
spec:
  host: payment-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: DEFAULT
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
        maxRequestsPerConnection: 10
        maxRetries: 3
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

This configuration:
- Limits to 100 TCP connections
- Limits pending HTTP/1.1 requests to 100
- If a pod returns 5 consecutive 5xx errors, eject it for 30s
- Never eject more than 50% of pods (availability protection)

### Retry Policy

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: inventory-service
spec:
  hosts:
    - inventory-service
  http:
    - route:
        - destination:
            host: inventory-service
      retries:
        attempts: 3
        perTryTimeout: 2s
        retryOn: gateway-error,connect-failure,refused-stream,5xx
      timeout: 8s
```

---

## Observability Integration

One of the biggest wins of a service mesh: automatic observability
without application changes.

```
  What you get for free:

  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  REQUEST METRICS (every request, automatically):            │
  │  - istio_requests_total (counter)                          │
  │  - istio_request_duration_milliseconds (histogram)         │
  │  - istio_request_bytes (histogram)                         │
  │  - istio_response_bytes (histogram)                        │
  │                                                             │
  │  Labels: source, destination, method, response_code,       │
  │          connection_security, protocol                      │
  │                                                             │
  │  DISTRIBUTED TRACES (automatic span generation):            │
  │  - Sidecar creates spans for every request                 │
  │  - Propagates trace context headers                        │
  │  - Reports to Jaeger/Zipkin/Tempo                          │
  │                                                             │
  │  ACCESS LOGS (per-request):                                 │
  │  - Source/destination IPs and services                     │
  │  - Request method, path, protocol                          │
  │  - Response code, latency, bytes                           │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

### Service Graph

The mesh knows every connection between every service:

```
  ┌──────────┐    200 req/s    ┌──────────┐
  │ Frontend │────────────────>│ API GW   │
  └──────────┘   p99: 12ms    └────┬─────┘
                                   │
                    ┌──────────────┬┘───────────────┐
                    │              │                │
                    ▼              ▼                ▼
              ┌──────────┐  ┌──────────┐     ┌──────────┐
              │ Order    │  │ User     │     │ Search   │
              │ 150 req/s│  │ 180 req/s│     │ 50 req/s │
              │ p99: 45ms│  │ p99: 8ms │     │ p99: 120ms│
              └────┬─────┘  └──────────┘     └──────────┘
                   │
           ┌───────┴────────┐
           │                │
           ▼                ▼
     ┌──────────┐     ┌──────────┐
     │ Inventory│     │ Payment  │
     │ 100 req/s│     │ 50 req/s │
     │ p99: 20ms│     │ p99: 200ms│ ← bottleneck
     └──────────┘     └──────────┘

  This graph is auto-generated. No instrumentation needed.
```

---

## Performance Overhead

The sidecar proxy adds latency to every request. This is
the primary cost of a service mesh.

```
  Overhead per hop:

  Istio (Envoy):      ~3-5ms added latency
                      ~50MB memory per sidecar
                      ~0.5 CPU cores per 1000 req/s

  Linkerd:            ~1ms added latency
                      ~10MB memory per sidecar
                      ~0.2 CPU cores per 1000 req/s

  For a request that traverses 5 services:

  Without mesh:  50ms total latency
  With Istio:    50 + (5 × 2 × 4ms) = 90ms  (ingress + egress per hop)
  With Linkerd:  50 + (5 × 2 × 1ms) = 60ms

  That's 80% overhead with Istio or 20% with Linkerd.
```

### Resource Overhead at Scale

```
  500 pods, each with a sidecar:

  Istio:
  - Memory: 500 × 50MB = 25 GB
  - CPU: 500 × 0.1 cores = 50 cores
  - Control plane: ~2 GB memory, ~2 cores
  - Total: ~25 GB RAM, ~52 cores

  Linkerd:
  - Memory: 500 × 10MB = 5 GB
  - CPU: 500 × 0.05 cores = 25 cores
  - Control plane: ~500 MB memory, ~1 core
  - Total: ~5.5 GB RAM, ~26 cores

  At $0.05/core-hour (on-demand):
  Istio: ~$22K/year just for the mesh overhead
  Linkerd: ~$11K/year
```

---

## When NOT to Use a Service Mesh

This is the most important section. A service mesh is not always
the right answer.

```
  DON'T use a service mesh when:

  ✗ You have fewer than 10 services
    (the overhead isn't justified)

  ✗ Your team can't operate Kubernetes reliably yet
    (a mesh adds a layer of complexity on top)

  ✗ Latency overhead is unacceptable
    (sub-millisecond requirements)

  ✗ You don't need mTLS
    (maybe your network is already trusted)

  ✗ Your services already handle retries/circuit breakers
    (libraries like resilience4j, go-kit)

  ✗ You're running on serverless/FaaS
    (sidecar model doesn't apply)


  DO use a service mesh when:

  ✓ You have 20+ services with complex routing needs
  ✓ You need zero-trust networking (mTLS everywhere)
  ✓ You want consistent observability without code changes
  ✓ You need traffic management (canary, A/B, circuit breaking)
  ✓ Multiple teams, multiple languages, need consistent behavior
  ✓ Compliance requires encrypted service-to-service traffic
```

### Alternatives to a Full Mesh

```
  ┌─────────────────────┬──────────────────────────────────┐
  │ Need                │ Alternative                      │
  ├─────────────────────┼──────────────────────────────────┤
  │ mTLS only           │ SPIFFE/SPIRE (identity only)     │
  │ Retries/CB          │ Application library (resilience4j│
  │                     │  go-kit, Polly)                  │
  │ Observability       │ OpenTelemetry SDK                │
  │ Traffic routing     │ Nginx/HAProxy/Traefik ingress    │
  │ Service discovery   │ DNS, Consul (without mesh)       │
  └─────────────────────┴──────────────────────────────────┘
```

---

## Debugging Mesh Issues

When things go wrong, the mesh adds a layer of indirection
that makes debugging harder:

```
  Common failure modes:

  1. Sidecar not injected
     Symptom: Direct pod-to-pod traffic, no mTLS
     Diagnosis: kubectl describe pod → look for envoy/linkerd container
     Fix: Check namespace label (istio-injection=enabled)

  2. Certificate expiry
     Symptom: TLS handshake failures, 503 errors
     Diagnosis: Check cert validity in proxy admin (:15000/certs)
     Fix: Restart the CA, check CA health

  3. Configuration sync delay
     Symptom: Stale routing rules, traffic going to old versions
     Diagnosis: istioctl proxy-status → check SYNC column
     Fix: Check control plane health, restart proxy if stale

  4. Resource exhaustion
     Symptom: High latency, proxy OOMKilled
     Diagnosis: kubectl top pod, check proxy memory/CPU
     Fix: Increase sidecar resource limits
```

```bash
istioctl proxy-status
istioctl proxy-config routes <pod-name>
istioctl proxy-config clusters <pod-name>
istioctl analyze --namespace production
```

---

## Exercises

1. **Mesh evaluation.** You have 30 microservices in Kubernetes,
   3 programming languages (Go, Java, Python), and a need for
   mTLS. Compare Istio and Linkerd for your use case. What are
   the deciding factors? Write a decision memo.

2. **Traffic management.** You're deploying a new version of your
   payment service. Design a canary rollout strategy using Istio
   VirtualService. Start at 1%, ramp to 5%, 25%, 50%, 100%.
   What metrics do you check at each stage before ramping?
   What's the automatic rollback trigger?

3. **Performance analysis.** Your checkout flow traverses 8
   services. Current P99 latency is 400ms with a 500ms SLO.
   You're considering Istio. Calculate the expected latency
   impact. Is it acceptable? What optimizations can you make?

4. **Mesh migration.** You have 50 services running without a
   mesh. Design a plan to incrementally adopt Linkerd. Which
   services do you mesh first? How do you handle the transition
   period where some services are meshed and some aren't?

---

[Next: Lesson 9 — API Evolution -->](09-api-evolution.md)
