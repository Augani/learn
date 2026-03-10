# Lesson 23: Proxies and Service Discovery

Every request in a distributed system needs to know where to go. As you
scale from 5 services to 500, finding the right server becomes a real
problem. Proxies route traffic; service discovery tells them where to
route it.

**Analogy:** Walk into a large office building. The receptionist at the
front desk is a **reverse proxy** — you tell them who you're visiting,
and they direct you. The office directory on the wall is **service
discovery** — it maps names to room numbers. A **service mesh** is like
having a personal assistant for every employee who handles all their
mail, calls, and meeting logistics so the employee can focus on work.

---

## Forward vs Reverse Proxies

```
FORWARD PROXY (client-side):

  ┌────────┐     ┌──────────┐     ┌──────────┐
  │ Client │────▶│ Forward  │────▶│  Server  │
  │        │     │  Proxy   │     │          │
  └────────┘     └──────────┘     └──────────┘

  Client knows it's using a proxy.
  Server sees the proxy's IP, not the client's.
  Use case: VPNs, corporate firewalls, anonymity

REVERSE PROXY (server-side):

  ┌────────┐     ┌──────────┐     ┌──────────┐
  │ Client │────▶│ Reverse  │────▶│  Server  │
  │        │     │  Proxy   │     │          │
  └────────┘     └──────────┘     └──────────┘

  Client doesn't know there's a proxy.
  Client thinks it's talking to the real server.
  Use case: Load balancing, SSL termination, caching
```

**When to use what:**

| Feature | Forward Proxy | Reverse Proxy |
|---------|--------------|---------------|
| Who benefits | Client | Server |
| Hides | Client identity | Server identity |
| SSL termination | No | Yes |
| Load balancing | No | Yes |
| Caching | Client-side | Server-side |
| Examples | Squid, corporate proxy | Nginx, HAProxy, Envoy |

---

## Reverse Proxy Deep Dive

A reverse proxy sits in front of your backend servers and handles:

```
┌──────────────────────────────────────────────────────────────┐
│                     REVERSE PROXY                             │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐      │
│  │    SSL      │  │    Rate      │  │  Load          │      │
│  │ Termination │─▶│  Limiting    │─▶│  Balancing     │      │
│  └─────────────┘  └──────────────┘  └────────┬───────┘      │
│                                              │               │
│  ┌─────────────┐  ┌──────────────┐           │               │
│  │  Response   │  │  Request     │           │               │
│  │  Caching    │  │  Routing     │◀──────────┘               │
│  └─────────────┘  └──────────────┘                           │
└──────────────────────────────────────────────────────────────┘
         │                │               │
    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
    │ Svc A   │     │ Svc B   │     │ Svc C   │
    └─────────┘     └─────────┘     └─────────┘
```

### Nginx as Reverse Proxy

```nginx
upstream api_servers {
    server 10.0.1.1:8080 weight=3;
    server 10.0.1.2:8080 weight=2;
    server 10.0.1.3:8080 weight=1;
    server 10.0.1.4:8080 backup;
}

server {
    listen 443 ssl;
    server_name api.example.com;

    location /api/v1/ {
        proxy_pass http://api_servers;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }
}
```

---

## Service Discovery

When Service A needs to call Service B, how does it find B's IP address
and port? In a dynamic environment (containers, auto-scaling), addresses
change constantly.

```
THE PROBLEM:

  Static world (old way):
    Service A → calls 10.0.1.5:8080 (hardcoded)
    Server dies → everything breaks

  Dynamic world (containers/k8s):
    Service B might be at:
      10.0.1.5:8080  (Monday)
      10.0.2.9:3000  (Tuesday, after scaling)
      10.0.3.1:8080, 10.0.3.2:8080  (Wednesday, two instances)
```

### Client-Side Discovery

The client queries a service registry and picks an instance.

```
┌──────────┐     ┌────────────────┐
│ Service  │────▶│   Service      │
│    A     │     │   Registry     │
│          │     │ (Consul/etcd)  │
└────┬─────┘     └────────────────┘
     │                  │
     │  "Where is B?"   │ "B is at 10.0.2.9:3000
     │                  │  and 10.0.2.10:3000"
     │                  │
     │  Pick one (round-robin, random, etc.)
     │
     ▼
┌──────────┐
│ Service  │
│    B     │
│ 10.0.2.9 │
└──────────┘
```

### Server-Side Discovery

The client calls a load balancer/proxy, which handles finding the right instance.

```
┌──────────┐     ┌──────────┐     ┌────────────────┐
│ Service  │────▶│   Load   │────▶│   Service      │
│    A     │     │ Balancer │     │   Registry     │
└──────────┘     └────┬─────┘     └────────────────┘
                      │
                      ▼
                 ┌──────────┐
                 │ Service  │
                 │    B     │
                 └──────────┘
```

| Approach | Pros | Cons |
|----------|------|------|
| Client-side | No extra hop, client chooses strategy | Client needs discovery library, language-specific |
| Server-side | Simple clients, centralized control | Extra network hop, LB is a bottleneck |

---

## Service Registry: Consul

Consul is a popular service registry. Services register themselves on
startup and send heartbeats. Consul returns healthy instances.

```go
package discovery

import (
	"fmt"

	consul "github.com/hashicorp/consul/api"
)

type ServiceDiscovery struct {
	client *consul.Client
}

func NewServiceDiscovery(addr string) (*ServiceDiscovery, error) {
	config := consul.DefaultConfig()
	config.Address = addr
	client, err := consul.NewClient(config)
	if err != nil {
		return nil, fmt.Errorf("consul client: %w", err)
	}
	return &ServiceDiscovery{client: client}, nil
}

func (sd *ServiceDiscovery) Register(name, address string, port int) error {
	return sd.client.Agent().ServiceRegister(&consul.AgentServiceRegistration{
		Name:    name,
		Address: address,
		Port:    port,
		Check: &consul.AgentServiceCheck{
			HTTP:     fmt.Sprintf("http://%s:%d/health", address, port),
			Interval: "10s",
			Timeout:  "3s",
		},
	})
}

func (sd *ServiceDiscovery) Discover(name string) (string, error) {
	entries, _, err := sd.client.Health().Service(name, "", true, nil)
	if err != nil {
		return "", fmt.Errorf("discover %s: %w", name, err)
	}
	if len(entries) == 0 {
		return "", fmt.Errorf("no healthy instances of %s", name)
	}
	entry := entries[0]
	return fmt.Sprintf("%s:%d", entry.Service.Address, entry.Service.Port), nil
}
```

---

## Sidecar Proxy Pattern

Instead of building proxy logic into every service, deploy a sidecar
proxy alongside each service instance. The sidecar handles retries,
timeouts, mTLS, and observability.

```
WITHOUT SIDECAR:
  ┌──────────────────────────────────┐
  │          Service A               │
  │  ┌─────────┐ ┌───────────────┐  │
  │  │ Business │ │ Retry logic   │  │
  │  │  Logic   │ │ Circuit break │  │
  │  │          │ │ mTLS          │  │
  │  │          │ │ Tracing       │  │
  │  └─────────┘ └───────────────┘  │
  └──────────────────────────────────┘

WITH SIDECAR (Envoy):
  ┌─────────────┐  ┌─────────────┐
  │  Service A  │  │   Envoy     │
  │  (business  │─▶│  (sidecar)  │───▶ network
  │   logic     │  │ retries,    │
  │   only)     │  │ mTLS, trace │
  └─────────────┘  └─────────────┘

  Service A calls localhost:9090 (Envoy).
  Envoy handles everything else.
```

**Analogy:** Without a sidecar, every employee handles their own mail,
security badge checks, and meeting scheduling. With a sidecar, every
employee gets a personal assistant who handles all that.

---

## Service Mesh

A service mesh is a fleet of sidecar proxies managed by a central
control plane. Envoy + Istio is the most common combination.

```
┌────────────────────────────────────────────────────┐
│                  CONTROL PLANE                      │
│              (Istio / Linkerd)                      │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐     │
│  │  Config   │ │ Service  │ │ Certificate    │     │
│  │  (routing │ │ Discovery│ │ Authority      │     │
│  │   rules)  │ │          │ │ (mTLS certs)   │     │
│  └─────┬─────┘ └────┬─────┘ └───────┬────────┘     │
└────────┼────────────┼───────────────┼──────────────┘
         │            │               │
    ┌────▼────────────▼───────────────▼───────┐
    │              DATA PLANE                  │
    │         (Envoy sidecars)                 │
    │                                          │
    │  ┌──────┐ ┌──────┐    ┌──────┐ ┌──────┐ │
    │  │Svc A │ │Envoy │───▶│Envoy │ │Svc B │ │
    │  │      │▶│proxy │    │proxy │▶│      │ │
    │  └──────┘ └──────┘    └──────┘ └──────┘ │
    └──────────────────────────────────────────┘
```

### When You Need a Service Mesh vs When You Don't

| Situation | Service Mesh? | Why |
|-----------|--------------|-----|
| < 10 microservices | No | Overkill; simple LB + DNS is fine |
| 50+ microservices | Probably | mTLS, observability, traffic control at scale |
| Multi-language services | Yes | Sidecar is language-agnostic |
| Strong security (mTLS everywhere) | Yes | Control plane manages certificates |
| Simple monolith | No | You have one service |
| Need canary deployments | Yes | Traffic splitting built in |

---

## Trade-Off Summary

| Component | Simple Option | Advanced Option | When to Upgrade |
|-----------|--------------|-----------------|-----------------|
| Proxy | Nginx reverse proxy | Envoy / service mesh | > 20 services, need mTLS |
| Discovery | DNS-based | Consul / etcd | Dynamic scaling, health checks |
| Routing | Static config | Service mesh policies | Canary deploys, A/B testing |
| Security | TLS at LB | mTLS via mesh | Zero-trust network |

---

## Exercises

1. Set up Nginx as a reverse proxy for two backend services. Route
   `/api/users` to service A and `/api/orders` to service B.

2. Implement a simple service registry in Go using an in-memory map
   with health check expiration. Services register with TTL and must
   re-register before expiry.

3. Compare latency: direct service-to-service call vs call through an
   Envoy sidecar proxy. Measure the overhead of the extra hop.

4. Design a service discovery system for 200 microservices. Draw the
   architecture and explain your choice between client-side vs
   server-side discovery.

---

*Next: [Lesson 24 — Search Systems](./24-search-systems.md), where we
build inverted indexes and make autocomplete fast.*
