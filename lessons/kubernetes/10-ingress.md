# Ingress and Ingress Controllers

## The Lobby Receptionist Analogy

Your office building has dozens of companies (Services) inside. Without a receptionist, every company would need its own entrance with its own address and its own door person. That's expensive — like creating a LoadBalancer for each Service.

Instead, the building has one lobby with one receptionist (the Ingress Controller). Visitors (external traffic) enter through one door, tell the receptionist who they're visiting ("I'm here for Acme Corp on the 5th floor"), and get directed to the right place.

The receptionist follows a routing sheet (the Ingress resource) that says:
- "Acme Corp visitors → 5th floor" (host-based routing: `acme.example.com`)
- "Anyone asking for accounting → 3rd floor" (path-based routing: `/accounting`)
- "VIP visitors → check their badge first" (TLS/authentication)

One entrance, one receptionist, many destinations.

---

## Why Ingress?

Without Ingress, exposing multiple HTTP services means:

```
api.example.com    → LoadBalancer ($18/month) → API Service
web.example.com    → LoadBalancer ($18/month) → Web Service
admin.example.com  → LoadBalancer ($18/month) → Admin Service
docs.example.com   → LoadBalancer ($18/month) → Docs Service
```

Four load balancers = ~$72/month. And you need DNS records pointing to four different IPs.

With Ingress:

```
*.example.com → LoadBalancer ($18/month) → Ingress Controller
    api.example.com/    → API Service
    web.example.com/    → Web Service
    admin.example.com/  → Admin Service
    docs.example.com/   → Docs Service
```

One load balancer, one IP, one Ingress Controller routing to all services based on HTTP headers and paths.

---

## Two Parts: Ingress Resource + Ingress Controller

**Ingress Resource**: A Kubernetes object that defines routing rules. "Traffic for `api.example.com/v1` goes to the `api-v1` Service." This is what you create with `kubectl apply`.

**Ingress Controller**: A Pod running a reverse proxy (nginx, Traefik, HAProxy, etc.) that reads Ingress resources and configures itself accordingly. This must be installed separately — Kubernetes doesn't include one by default.

The Ingress Resource is the routing sheet. The Ingress Controller is the receptionist who reads the sheet and directs traffic.

Without an Ingress Controller, Ingress resources do nothing. They're just data sitting in etcd.

---

## Ingress Controllers

### nginx Ingress Controller

The most popular. Runs nginx as a reverse proxy. Configured via Ingress resources and annotations.

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/kind/deploy.yaml
```

This deploys the nginx Ingress Controller as a Deployment with a Service. In kind, it uses a special configuration that maps to host ports.

### Traefik

Automatic HTTPS with Let's Encrypt. Good dashboard. Popular with smaller teams.

### AWS ALB Ingress Controller

Creates AWS Application Load Balancers. Native to AWS. Supports WAF, Cognito auth, etc.

### Istio Gateway

If you're using Istio service mesh, its Gateway replaces Ingress.

### Which to choose?

| Controller | Best For |
|-----------|----------|
| nginx | General purpose, most documentation, widest support |
| Traefik | Automatic TLS, simpler config, good for small teams |
| AWS ALB | EKS deployments, AWS-native features |
| Kong | API gateway features (rate limiting, auth, transformations) |
| Cilium | High performance, eBPF-based |

For learning and most production uses: nginx.

---

## Ingress Resource: Routing Rules

### Path-Based Routing

Route different URL paths to different Services:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$1
spec:
  ingressClassName: nginx
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /api/(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: api-svc
                port:
                  number: 80
          - path: /(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: frontend-svc
                port:
                  number: 80
```

Traffic flow:
- `app.example.com/api/users` → `api-svc:80/users` (rewrite removes `/api` prefix)
- `app.example.com/dashboard` → `frontend-svc:80/dashboard`

The `rewrite-target: /$1` annotation strips the matched path prefix. Without it, the backend would receive `/api/users` instead of `/users`.

### Host-Based Routing

Route different hostnames to different Services:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-host-ingress
spec:
  ingressClassName: nginx
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-svc
                port:
                  number: 80
    - host: web.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-svc
                port:
                  number: 80
    - host: admin.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: admin-svc
                port:
                  number: 80
```

Each hostname routes to a different Service. The Ingress Controller inspects the HTTP `Host` header to make the routing decision.

### Path Types

| Type | Matching |
|------|---------|
| `Prefix` | Matches URL path prefix. `/api` matches `/api`, `/api/`, `/api/users` |
| `Exact` | Exact match only. `/api` matches `/api` but NOT `/api/users` |
| `ImplementationSpecific` | Up to the Ingress Controller. nginx supports regex here. |

### Default Backend

What happens when no rule matches:

```yaml
spec:
  ingressClassName: nginx
  defaultBackend:
    service:
      name: default-svc
      port:
        number: 80
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-svc
                port:
                  number: 80
```

Unmatched requests (wrong host, wrong path) go to `default-svc`. Without a default backend, the Ingress Controller returns 404.

---

## TLS Termination

The Ingress Controller handles HTTPS so your backend services don't have to.

### Create a TLS Secret

```bash
kubectl create secret tls app-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key
```

For development, generate a self-signed certificate:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=app.example.com"

kubectl create secret tls app-tls --cert=tls.crt --key=tls.key
```

### Configure TLS in Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.example.com
        - web.example.com
      secretName: app-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-svc
                port:
                  number: 80
    - host: web.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-svc
                port:
                  number: 80
```

- `ssl-redirect: "true"` redirects HTTP to HTTPS
- The `tls` section specifies which hosts use which certificate
- Backend Services receive plain HTTP (TLS is terminated at the Ingress Controller)

### Automatic TLS with cert-manager

In production, you don't create certificates manually. cert-manager automates it with Let's Encrypt:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: auto-tls-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.example.com
      secretName: api-tls-auto
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-svc
                port:
                  number: 80
```

cert-manager sees the annotation, requests a certificate from Let's Encrypt, stores it in the Secret, and renews it automatically.

---

## Common nginx Annotations

The nginx Ingress Controller is configured primarily through annotations:

```yaml
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /
  nginx.ingress.kubernetes.io/ssl-redirect: "true"
  nginx.ingress.kubernetes.io/proxy-body-size: "50m"
  nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
  nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
  nginx.ingress.kubernetes.io/enable-cors: "true"
  nginx.ingress.kubernetes.io/cors-allow-origin: "https://web.example.com"
  nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE"
  nginx.ingress.kubernetes.io/limit-rps: "100"
  nginx.ingress.kubernetes.io/limit-rpm: "1000"
  nginx.ingress.kubernetes.io/configuration-snippet: |
    more_set_headers "X-Request-ID: $req_id";
  nginx.ingress.kubernetes.io/auth-url: "http://auth-service.default.svc.cluster.local:80/verify"
  nginx.ingress.kubernetes.io/websocket-services: "ws-service"
```

Key annotations:
- **rewrite-target**: Rewrite the URL path before forwarding
- **proxy-body-size**: Max request body size (default 1m — too small for file uploads)
- **limit-rps/rpm**: Rate limiting per client IP
- **enable-cors**: CORS headers (essential for frontend-backend separation)
- **auth-url**: External authentication (forward auth to a service)
- **websocket-services**: Enable WebSocket proxying

---

## Hands-On: Ingress in kind

### Create a kind cluster with port mappings

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraConfig:
            nodeStatusUpdateFrequency: 10s
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
```

Save as `kind-ingress.yaml`:

```bash
kind create cluster --name ingress-lab --config kind-ingress.yaml
```

### Install nginx Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/kind/deploy.yaml
```

Wait for it to be ready:

```bash
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

### Deploy two backend services

```bash
kubectl create deployment api --image=hashicorp/http-echo:latest -- -text="API Service Response" -listen=:8080

kubectl expose deployment api --port=80 --target-port=8080

kubectl create deployment web --image=hashicorp/http-echo:latest -- -text="Web Service Response" -listen=:8080

kubectl expose deployment web --port=80 --target-port=8080
```

### Create Ingress with path-based routing

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
```

```bash
kubectl apply -f demo-ingress.yaml
```

### Test routing

```bash
curl http://localhost/

curl http://localhost/api
```

First returns "Web Service Response." Second returns "API Service Response." One entry point, different backends.

### Verify Ingress

```bash
kubectl get ingress

kubectl describe ingress demo-ingress
```

---

## Hands-On: Host-Based Routing

### Deploy a third service

```bash
kubectl create deployment admin --image=hashicorp/http-echo:latest -- -text="Admin Panel Response" -listen=:8080

kubectl expose deployment admin --port=80 --target-port=8080
```

### Create host-based Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: host-ingress
spec:
  ingressClassName: nginx
  rules:
    - host: api.localhost
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
    - host: web.localhost
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
    - host: admin.localhost
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: admin
                port:
                  number: 80
```

```bash
kubectl apply -f host-ingress.yaml
```

### Test with Host header

```bash
curl -H "Host: api.localhost" http://localhost/

curl -H "Host: web.localhost" http://localhost/

curl -H "Host: admin.localhost" http://localhost/
```

Same IP (localhost), different responses based on the Host header. This is how virtual hosting works.

On macOS, `*.localhost` resolves to 127.0.0.1 by default, so you can also try:

```bash
curl http://api.localhost/

curl http://web.localhost/
```

---

## Hands-On: TLS with Self-Signed Certificate

### Generate a self-signed cert

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=app.localhost"
```

### Create the TLS Secret

```bash
kubectl create secret tls app-tls --cert=tls.crt --key=tls.key
```

### Create TLS Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.localhost
      secretName: app-tls
  rules:
    - host: app.localhost
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
```

```bash
kubectl apply -f tls-ingress.yaml
```

### Test HTTPS

```bash
curl -k https://app.localhost/
```

The `-k` flag skips certificate validation (since it's self-signed). In production, cert-manager would provide a valid Let's Encrypt certificate.

---

## Hands-On: Simulating a Microservices Frontend + API

This is a common Go/TypeScript architecture: a frontend (React/Next.js) and a backend API, both behind one domain.

```
app.localhost/          → frontend (serves HTML/JS)
app.localhost/api/*     → backend API (JSON responses)
```

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fullstack-ingress
  annotations:
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  ingressClassName: nginx
  rules:
    - host: app.localhost
      http:
        paths:
          - path: /api(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: web
                port:
                  number: 80
```

```bash
kubectl apply -f fullstack-ingress.yaml

curl http://app.localhost/

curl http://app.localhost/api/users
```

The frontend serves the SPA. The API handles data requests. One domain, no CORS issues, one TLS certificate.

This is exactly how you'd deploy a Go API + React frontend in production.

---

## Ingress vs. Gateway API

The Gateway API is the newer, more expressive replacement for Ingress. It's the future of Kubernetes external routing.

| Feature | Ingress | Gateway API |
|---------|---------|-------------|
| Maturity | Stable, widely used | v1.0 released, growing adoption |
| Routing | Host, path | Host, path, headers, query params, method |
| TLS | Basic | Full lifecycle management |
| Traffic splitting | Annotation hacks | Native canary/weighted routing |
| Multi-team | Single resource | Separate Gateway and Route resources |
| TCP/UDP | Annotations | Native support |

Gateway API splits concerns:
- **GatewayClass**: Cluster operator defines available gateway types (like StorageClass)
- **Gateway**: Team creates a gateway (like creating a LoadBalancer)
- **HTTPRoute**: Team defines routing rules (like Ingress rules)

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-route
spec:
  parentRefs:
    - name: my-gateway
  hostnames:
    - "api.example.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /v1
      backendRefs:
        - name: api-v1
          port: 80
          weight: 90
        - name: api-v2
          port: 80
          weight: 10
```

Native traffic splitting (90/10 canary) without needing service mesh annotations.

For now, learn Ingress first. Gateway API is where things are heading, but Ingress is what you'll encounter in most existing clusters.

---

## What Would Happen If...

**...the Ingress Controller Pod crashed?**

All external traffic stops being routed. Internal Service-to-Service traffic (ClusterIP) is unaffected. The Ingress Controller is a Deployment, so Kubernetes recreates the Pod. Downtime is typically 10-30 seconds.

Run multiple replicas for high availability:

```bash
kubectl scale deployment ingress-nginx-controller -n ingress-nginx --replicas=3
```

**...you created an Ingress but no Ingress Controller was installed?**

The Ingress resource is stored in etcd but nothing happens. No routing. No errors (Kubernetes doesn't validate that a controller exists). This is a common "my Ingress doesn't work" gotcha.

```bash
kubectl get pods -n ingress-nginx
```

If empty, no controller is installed.

**...two Ingress resources defined conflicting rules?**

Both get applied. The Ingress Controller merges them. If there's a true conflict (same host + same path pointing to different Services), the behavior is controller-specific. nginx uses the first one created. Avoid conflicts — use one Ingress per set of related routes.

**...you forgot the `ingressClassName`?**

In older versions, the default IngressClass would handle it. In newer versions, the Ingress might be ignored entirely. Always specify `ingressClassName`.

```bash
kubectl get ingressclass
```

**...the backend Service had no ready endpoints?**

The Ingress Controller returns 503 (Service Unavailable). It knows the Service exists but can't route to any healthy Pods.

---

## Production Checklist

- [ ] Ingress Controller deployed with multiple replicas
- [ ] TLS configured with cert-manager for automatic certificate management
- [ ] Rate limiting annotations to prevent abuse
- [ ] `proxy-body-size` set appropriately for your API (default 1m is too small for file uploads)
- [ ] CORS configured if frontend and API are on different origins
- [ ] Health check endpoint configured on backend services
- [ ] Monitoring/logging for the Ingress Controller (nginx metrics, access logs)
- [ ] Default backend configured for unmatched routes (custom 404 page)
- [ ] WebSocket support enabled if needed

---

## Exercises

1. **Path routing.** Deploy three services (frontend, API, docs). Create an Ingress that routes `/` to frontend, `/api` to API, and `/docs` to docs. Test each path.

2. **Host routing.** Deploy three services. Create an Ingress that routes `api.localhost`, `web.localhost`, and `docs.localhost` to different services. Test with curl and Host headers.

3. **TLS termination.** Generate a self-signed certificate. Create a TLS Ingress. Verify that HTTPS works and HTTP redirects to HTTPS.

4. **Rate limiting.** Add rate limiting annotations (10 requests per second). Use a loop to hit the endpoint rapidly and observe 429 (Too Many Requests) responses.

```bash
for i in $(seq 1 50); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api
done
```

5. **Canary deployment with Ingress.** Deploy two versions of an API (v1 and v2). Use nginx canary annotations to send 10% of traffic to v2:

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
```

Hit the endpoint 100 times and count v1 vs. v2 responses.

6. **Debug Ingress routing.** Check the nginx Ingress Controller's configuration:

```bash
kubectl exec -n ingress-nginx deployment/ingress-nginx-controller -- cat /etc/nginx/nginx.conf | head -100
```

Find your routing rules in the generated nginx config. Understand how Ingress resources translate to nginx configuration.

---

## Key Takeaways

- Ingress provides HTTP routing from one external entry point to multiple internal Services
- You need two things: an Ingress Resource (routing rules) and an Ingress Controller (the proxy that implements them)
- Path-based routing: different URL paths to different Services
- Host-based routing: different hostnames to different Services
- TLS termination: HTTPS at the Ingress, plain HTTP to backends
- nginx is the most common Ingress Controller; Gateway API is the future
- One Ingress Controller + one LoadBalancer replaces many individual LoadBalancer Services
- Always specify `ingressClassName` in your Ingress resources
- Use cert-manager for automatic TLS certificate management in production

You've completed the Kubernetes fundamentals. You now understand: why Kubernetes exists, its architecture, Pods, Deployments, Services, ConfigMaps/Secrets, Volumes, Namespaces, Networking, and Ingress. That's enough to deploy and manage Go/TypeScript applications in production.
