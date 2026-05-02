# Lesson 10: API Gateways

## The Hotel Reception Analogy

A hotel reception desk is a single entry point for all guests. It handles
check-in, directions, room service orders, and security -- you don't go
directly to housekeeping or the kitchen. An API gateway is the same:
one front door for all API traffic.

```
  WITHOUT GATEWAY:                WITH GATEWAY:
  +--------+    +--------+       +--------+   +---------+   +--------+
  | Client |--->| Users  |       | Client |-->| Gateway |-->| Users  |
  |        |--->| Orders |       +--------+   |         |-->| Orders |
  |        |--->| Search |                    |         |-->| Search |
  +--------+    +--------+                    +---------+   +--------+
  Client knows every service      Client knows ONE address
  Client handles auth, retries    Gateway handles cross-cutting concerns
```

## What Does a Gateway Do?

```
  +------------------------------------------------------------+
  |                      API GATEWAY                            |
  +------------------------------------------------------------+
  |                                                            |
  |  +------------+  +-------------+  +------------------+     |
  |  | ROUTING    |  | AUTH        |  | RATE LIMITING    |     |
  |  | /users ->A |  | Verify JWT  |  | 100 req/min      |     |
  |  | /orders->B |  | API keys    |  | per client        |     |
  |  +------------+  +-------------+  +------------------+     |
  |                                                            |
  |  +------------+  +-------------+  +------------------+     |
  |  | TRANSFORM  |  | LOGGING     |  | LOAD BALANCING   |     |
  |  | XML -> JSON|  | Access logs |  | Round-robin       |     |
  |  | Rename flds|  | Metrics     |  | Weighted          |     |
  |  +------------+  +-------------+  +------------------+     |
  |                                                            |
  |  +------------+  +-------------+  +------------------+     |
  |  | CACHING    |  | CORS        |  | CIRCUIT BREAKER  |     |
  |  | Cache GETs |  | Headers     |  | Fail fast         |     |
  |  +------------+  +-------------+  +------------------+     |
  |                                                            |
  +------------------------------------------------------------+
```

## Request Flow Through a Gateway

```
  Client Request
       |
       v
  +--- GATEWAY -------------------------------------------+
  |  1. TLS Termination (HTTPS -> HTTP internally)        |
  |  2. Authentication (verify token/key)                 |
  |  3. Rate Limiting (check quotas)                      |
  |  4. Request Transformation (rewrite headers/body)     |
  |  5. Routing (match path to upstream service)          |
  |  6. Load Balancing (pick a server instance)           |
  |  7. Forward Request                                   |
  +-------------------------------------------------------+
       |
       v
  Upstream Service
       |
       v
  +--- GATEWAY (response path) ---------------------------+
  |  8. Response Transformation (filter fields, format)   |
  |  9. Caching (store for future requests)               |
  | 10. Logging & Metrics (record latency, status)        |
  | 11. Return to Client                                  |
  +-------------------------------------------------------+
```

## Popular API Gateways

```
  +----------------+--------------------------------------------------+
  | Gateway        | Best For                                         |
  +----------------+--------------------------------------------------+
  | Kong           | Plugin ecosystem, Lua extensibility              |
  | Envoy          | Service mesh sidecar, gRPC support               |
  | AWS API GW     | Serverless (Lambda integration)                  |
  | NGINX          | High-performance reverse proxy + gateway         |
  | Traefik        | Container-native, auto-discovery                 |
  | KrakenD        | Ultra-fast, declarative config                   |
  +----------------+--------------------------------------------------+
```

## Go - Simple API Gateway

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

type Route struct {
	Prefix  string
	Target  *url.URL
	StripPrefix bool
}

type Gateway struct {
	routes []Route
}

func NewGateway(routes []Route) *Gateway {
	return &Gateway{routes: routes}
}

func (g *Gateway) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	apiKey := r.Header.Get("X-API-Key")
	if apiKey == "" {
		http.Error(w, `{"error":"missing API key"}`, http.StatusUnauthorized)
		return
	}

	for _, route := range g.routes {
		if strings.HasPrefix(r.URL.Path, route.Prefix) {
			proxy := httputil.NewSingleHostReverseProxy(route.Target)

			if route.StripPrefix {
				r.URL.Path = strings.TrimPrefix(r.URL.Path, route.Prefix)
				if r.URL.Path == "" {
					r.URL.Path = "/"
				}
			}

			r.Host = route.Target.Host

			proxy.ModifyResponse = func(resp *http.Response) error {
				resp.Header.Set("X-Gateway", "custom-gateway")
				resp.Header.Set("X-Response-Time", time.Since(start).String())
				return nil
			}

			log.Printf("[%s] %s %s -> %s (%s)",
				apiKey[:8], r.Method, r.URL.Path,
				route.Target.Host, time.Since(start))

			proxy.ServeHTTP(w, r)
			return
		}
	}

	http.Error(w, `{"error":"no route matched"}`, http.StatusNotFound)
}

func main() {
	usersURL, _ := url.Parse("http://localhost:8081")
	ordersURL, _ := url.Parse("http://localhost:8082")

	gateway := NewGateway([]Route{
		{Prefix: "/api/users", Target: usersURL, StripPrefix: true},
		{Prefix: "/api/orders", Target: ordersURL, StripPrefix: true},
	})

	fmt.Println("Gateway on :8080")
	fmt.Println("  /api/users  -> localhost:8081")
	fmt.Println("  /api/orders -> localhost:8082")
	log.Fatal(http.ListenAndServe(":8080", gateway))
}
```

## TypeScript - Gateway with Middleware Chain

```typescript
type Middleware = (req: Request, next: () => Promise<Response>) => Promise<Response>;

function compose(...middlewares: Middleware[]): Middleware {
  return async (req, finalNext) => {
    let index = 0;
    const next = async (): Promise<Response> => {
      if (index < middlewares.length) {
        const mw = middlewares[index++];
        return mw(req, next);
      }
      return finalNext();
    };
    return next();
  };
}

const authMiddleware: Middleware = async (req, next) => {
  const apiKey = req.headers.get("X-API-Key");
  if (!apiKey) {
    return Response.json({ error: "missing API key" }, { status: 401 });
  }
  return next();
};

const loggingMiddleware: Middleware = async (req, next) => {
  const start = Date.now();
  const response = await next();
  const duration = Date.now() - start;
  console.log(`${req.method} ${new URL(req.url).pathname} -> ${response.status} (${duration}ms)`);
  return response;
};

const corsMiddleware: Middleware = async (req, next) => {
  const response = await next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  return response;
};

const routes: Record<string, string> = {
  "/api/users": "http://localhost:8081",
  "/api/orders": "http://localhost:8082",
};

const pipeline = compose(loggingMiddleware, corsMiddleware, authMiddleware);

const server = Bun.serve({
  port: 8080,
  async fetch(req) {
    return pipeline(req, async () => {
      const url = new URL(req.url);
      for (const [prefix, target] of Object.entries(routes)) {
        if (url.pathname.startsWith(prefix)) {
          const upstream = target + url.pathname.slice(prefix.length);
          return fetch(upstream, {
            method: req.method,
            headers: req.headers,
            body: req.body,
          });
        }
      }
      return Response.json({ error: "not found" }, { status: 404 });
    });
  },
});

console.log(`Gateway on :${server.port}`);
```

## Gateway Patterns

```
  PATTERN 1: Backend for Frontend (BFF)
  +--------+     +-----------+     +--------+
  | Mobile |---->| Mobile BFF|---->|        |
  +--------+     +-----------+     |Services|
  +--------+     +-----------+     |        |
  | Web    |---->| Web BFF   |---->|        |
  +--------+     +-----------+     +--------+
  Each client type gets its own gateway

  PATTERN 2: API Composition
  +--------+     +---------+     +-------+
  | Client |---->| Gateway |---->| Users | \
  +--------+     |         |---->| Orders|  > aggregate
                 |         |     +-------+ /  into one
                 |         |<--- combined response
                 +---------+

  PATTERN 3: Canary Routing
  +---------+
  | Gateway |--90%--> v1 (stable)
  |         |--10%--> v2 (canary)
  +---------+
```

## Exercises

1. **Run the Go gateway** with two simple upstream services on ports 8081
   and 8082. Route requests through the gateway.

2. **Add rate limiting** to the TypeScript gateway as another middleware.

3. **Implement response caching.** Cache GET responses for 60 seconds.
   Return `X-Cache: HIT` or `X-Cache: MISS` headers.

4. **Design a gateway config** for a microservices app with: user service,
   product service, order service, payment service. What routes, rate limits,
   and auth rules would you set?

---

[Next: Lesson 11 - Documentation ->](11-documentation.md)
