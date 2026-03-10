# Docker Networking

## The Office Communication Analogy

Docker networking is like communication systems in an office building:

- **Bridge network** is the office building intercom — people in the same building can call each other by name, but outsiders can't dial in unless you set up a reception desk (port mapping)
- **Host network** is like sharing a phone line with the building — your container uses the exact same network as the host, same phone number and all
- **Overlay network** is like a company-wide phone system across multiple office buildings — containers on different physical machines can talk as if they're in the same room
- **None network** is like an office with no phone at all — completely isolated, can't call anyone, no one can call you

---

## Network Types

### Bridge Network (Default)

When you start a container without specifying a network, Docker puts it on the default bridge network. It's a virtual network switch that connects containers on the same host.

```bash
docker network ls
```

```
NETWORK ID     NAME      DRIVER    SCOPE
a1b2c3d4e5f6   bridge    bridge    local
f6e5d4c3b2a1   host      host      local
1a2b3c4d5e6f   none      null      local
```

Start two containers on the default bridge:

```bash
docker run -d --name web nginx:alpine
docker run -d --name api node:20-alpine sleep 3600
```

They can talk via IP address but NOT by container name on the default bridge:

```bash
docker exec web ping -c 2 $(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' api)
```

```
PING 172.17.0.3 (172.17.0.3): 56 data bytes
64 bytes from 172.17.0.3: seq=0 ttl=64 time=0.089 ms
64 bytes from 172.17.0.3: seq=1 ttl=64 time=0.085 ms
```

The default bridge is limited. Create a user-defined bridge for real projects:

```bash
docker network create myapp-network

docker run -d --name web --network myapp-network nginx:alpine
docker run -d --name api --network myapp-network node:20-alpine sleep 3600
```

Now they CAN talk by container name:

```bash
docker exec api ping -c 2 web
```

```
PING web (172.18.0.2): 56 data bytes
64 bytes from 172.18.0.2: seq=0 ttl=64 time=0.078 ms
```

This works because user-defined bridges have built-in DNS resolution.

**Key difference between default and user-defined bridges:**

| Feature | Default bridge | User-defined bridge |
|---------|---------------|-------------------|
| DNS resolution | No (IP only) | Yes (by container name) |
| Automatic isolation | No (all containers share it) | Yes (per-network) |
| Live connect/disconnect | No (restart required) | Yes |
| Link containers | `--link` (deprecated) | Automatic |

### Host Network

The container shares the host's network stack directly. No NAT, no port mapping, no virtual bridge.

```bash
docker run -d --name web --network host nginx:alpine
```

Nginx now listens on the HOST's port 80, not a container port. If your host already has something on port 80, there's a conflict.

```bash
curl http://localhost:80
```

When to use host networking:
- Performance-critical applications where NAT overhead matters
- Applications that need to see the real client IP without proxy protocol
- Networking tools that need raw access to the host network

When NOT to use it:
- Multiple containers that need the same port
- Any situation where you want network isolation
- Production deployments (you lose container isolation benefits)

Think of it this way: in Go, it's like embedding a struct instead of composing with a pointer — you get direct access but lose the abstraction boundary.

### Overlay Network

Overlay networks span multiple Docker hosts. Containers on different physical machines can communicate as if they're on the same network.

```bash
docker network create --driver overlay --attachable my-overlay
```

This requires Docker Swarm mode or an external key-value store. In practice, you'll use this with Docker Swarm or Kubernetes.

```bash
docker swarm init

docker network create --driver overlay backend

docker service create --name api --network backend myapp-api:latest
docker service create --name db --network backend postgres:16
```

The `api` service can reach `db` by name, even if they're running on different physical servers.

Overlay networking works by encapsulating container traffic in VXLAN tunnels between hosts. The containers don't know or care that packets are being wrapped and unwrapped.

### None Network

Complete network isolation. The container has only a loopback interface.

```bash
docker run -d --name isolated --network none alpine sleep 3600

docker exec isolated ip addr
```

```
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536
    inet 127.0.0.1/8 scope host lo
```

No `eth0`. No external connectivity. Use this for:
- Batch processing jobs that don't need network
- Security-sensitive computation (cryptographic operations)
- Running untrusted code in complete isolation

---

## Port Mapping

Port mapping is the reception desk in our office analogy. External visitors (traffic from outside Docker) need to be directed to the right office (container).

```bash
docker run -d -p 8080:80 --name web nginx:alpine
```

This maps host port 8080 to container port 80. Traffic flow:

```
Client -> Host:8080 -> Docker NAT -> Container:80
```

Map to a specific host interface:

```bash
docker run -d -p 127.0.0.1:8080:80 --name web nginx:alpine
```

Now only localhost can reach it. Critical for databases:

```bash
docker run -d -p 127.0.0.1:5432:5432 --name db postgres:16
```

Map a range of ports:

```bash
docker run -d -p 8000-8010:8000-8010 --name multi-port myapp
```

Let Docker choose a random host port:

```bash
docker run -d -p 80 --name web nginx:alpine

docker port web
```

```
80/tcp -> 0.0.0.0:32768
```

Map UDP ports (for DNS, game servers, etc.):

```bash
docker run -d -p 53:53/udp --name dns coredns/coredns
```

### Port Mapping Gotcha

When you use `-p 8080:80`, Docker adds iptables rules that bypass your host firewall. This means:

```bash
docker run -d -p 5432:5432 postgres:16
```

Your PostgreSQL is now exposed to the ENTIRE network, even if your host firewall blocks port 5432. This has bitten countless teams.

Always bind to 127.0.0.1 for services that shouldn't be publicly accessible:

```bash
docker run -d -p 127.0.0.1:5432:5432 postgres:16
```

---

## DNS Resolution Between Containers

On a user-defined network, Docker runs an embedded DNS server at 127.0.0.11 inside each container.

```bash
docker network create app-net

docker run -d --name postgres --network app-net postgres:16
docker run -d --name redis --network app-net redis:7-alpine
docker run -d --name api --network app-net myapp-api:latest
```

Inside the `api` container, you can resolve other containers by name:

```bash
docker exec api nslookup postgres
```

```
Server:    127.0.0.11
Address:   127.0.0.11:53

Name:      postgres
Address:   172.20.0.2
```

This is how you configure your application:

In a Go application:

```go
package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "postgres"
	}

	connStr := fmt.Sprintf("host=%s port=5432 user=myapp dbname=myapp sslmode=disable", dbHost)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		panic(err)
	}
	defer db.Close()
}
```

In a TypeScript/Node application:

```typescript
import { createClient } from "redis";

const redisHost = process.env.REDIS_HOST ?? "redis";

const client = createClient({
  url: `redis://${redisHost}:6379`,
});

await client.connect();
```

The container name IS the hostname. No IP addresses, no service discovery tools needed for simple setups.

### Network Aliases

Give a container multiple DNS names:

```bash
docker run -d --name postgres-primary --network app-net \
  --network-alias db \
  --network-alias postgres \
  postgres:16
```

Now `db`, `postgres`, and `postgres-primary` all resolve to the same container. Useful when migrating from one service name to another.

### Multiple Networks for Isolation

A container can be on multiple networks. This lets you create network segments:

```bash
docker network create frontend
docker network create backend

docker run -d --name api --network frontend myapp-api
docker network connect backend api

docker run -d --name web --network frontend nginx
docker run -d --name db --network backend postgres:16
```

```
frontend:  web <-> api
backend:         api <-> db
```

The `web` container CANNOT reach `db` directly. All traffic must go through `api`. This is the principle of least privilege applied to networking.

---

## Docker Compose Networking

Docker Compose automatically creates a network for each project. The network name is `{project-directory}_default`.

```yaml
# docker-compose.yml
services:
  api:
    build: ./api
    ports:
      - "3000:3000"

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: myapp

  redis:
    image: redis:7-alpine
```

```bash
docker compose up -d
docker network ls
```

```
NETWORK ID     NAME                  DRIVER
abc123         myproject_default     bridge
```

All three services are on `myproject_default` and can reach each other by service name:
- `api` can connect to `postgres:5432` and `redis:6379`
- `postgres` can be reached at hostname `postgres`
- `redis` can be reached at hostname `redis`

### Custom Networks in Compose

For network isolation, define explicit networks:

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    networks:
      - frontend

  api:
    build: ./api
    networks:
      - frontend
      - backend

  worker:
    build: ./worker
    networks:
      - backend

  postgres:
    image: postgres:16
    networks:
      - backend

  redis:
    image: redis:7-alpine
    networks:
      - backend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true
```

The `internal: true` flag on the backend network means containers on it have NO outbound internet access. The database can't phone home even if compromised.

Network topology:

```
Internet -> nginx -> api -> postgres
                  -> api -> redis
                         -> worker -> postgres
                                   -> worker -> redis
```

`nginx` cannot reach `postgres` or `redis`. `worker` cannot receive external traffic.

### Fixed IP Addresses in Compose

Sometimes you need predictable IPs (rare, but it happens):

```yaml
services:
  api:
    build: ./api
    networks:
      app-net:
        ipv4_address: 172.28.0.10

networks:
  app-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

---

## Practical Examples

### Example 1: Microservices Communication

Three services: a Go API, a Node.js frontend, and PostgreSQL.

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      API_URL: http://api:8080
    networks:
      - frontend-net

  api:
    build: ./api
    environment:
      DB_HOST: postgres
      DB_PORT: "5432"
    networks:
      - frontend-net
      - backend-net

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: devpassword
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - backend-net

networks:
  frontend-net:
  backend-net:
    internal: true

volumes:
  pgdata:
```

The frontend calls the API at `http://api:8080`. The API connects to PostgreSQL at `postgres:5432`. The frontend cannot directly access PostgreSQL.

### Example 2: Debugging Network Issues

Inspect a network to see connected containers:

```bash
docker network inspect myproject_default
```

```json
[
  {
    "Name": "myproject_default",
    "Driver": "bridge",
    "IPAM": {
      "Config": [
        { "Subnet": "172.20.0.0/16", "Gateway": "172.20.0.1" }
      ]
    },
    "Containers": {
      "abc123...": {
        "Name": "myproject-api-1",
        "IPv4Address": "172.20.0.2/16"
      },
      "def456...": {
        "Name": "myproject-postgres-1",
        "IPv4Address": "172.20.0.3/16"
      }
    }
  }
]
```

Test connectivity from inside a container:

```bash
docker exec -it myproject-api-1 sh

wget -qO- http://postgres:5432 2>&1 || echo "Connection attempt made"

nslookup redis
```

Run a temporary debug container on the same network:

```bash
docker run -it --rm --network myproject_default nicolaka/netshoot

nslookup postgres
dig postgres
ping api
curl http://api:8080/health
tcpdump -i eth0 port 5432
```

`netshoot` is a container image packed with networking tools. It's invaluable for debugging.

### Example 3: Load Balancing with Compose

Scale a service and Docker distributes DNS responses:

```yaml
services:
  api:
    build: ./api
    deploy:
      replicas: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

```bash
docker compose up -d --scale api=3

docker exec myproject-nginx-1 nslookup api
```

```
Name:      api
Address 1: 172.20.0.3
Address 2: 172.20.0.4
Address 3: 172.20.0.5
```

Docker returns all three IPs. Your nginx config can upstream to `api:8080` and it'll round-robin across the three instances.

---

## Exercises

### Exercise 1: Network Isolation

Create three containers: `frontend`, `api`, and `database`. Set up networks so that:
- `frontend` can reach `api`
- `api` can reach `database`
- `frontend` CANNOT reach `database`

Verify by running `ping` from `frontend` to `database` (should fail).

### Exercise 2: Multi-Service App

Write a `docker-compose.yml` with:
- A web server (nginx) on port 80
- A backend API (any language) on an internal network
- A PostgreSQL database on an internal network
- Redis on an internal network

Verify that only nginx is accessible from the host.

### Exercise 3: DNS Round Robin

Create a compose file that scales a service to 3 replicas. From another container on the same network, resolve the service name and confirm you get 3 different IP addresses.

### Exercise 4: Debug a Broken Network

Start two containers on DIFFERENT networks:

```bash
docker network create net-a
docker network create net-b
docker run -d --name svc-a --network net-a nginx:alpine
docker run -d --name svc-b --network net-b alpine sleep 3600
```

From `svc-b`, try to reach `svc-a`. Diagnose why it fails. Fix it without recreating containers.

---

## What Would Happen If...

**...you ran a database with `-p 5432:5432` instead of `-p 127.0.0.1:5432:5432`?**

Your database is now accessible from any machine that can reach your host. Docker's port mapping bypasses iptables firewall rules. Anyone on your network (or the internet, if your host is public) can connect to your database. This has caused real data breaches.

**...two containers on different user-defined networks try to communicate?**

They can't. Different bridge networks are isolated from each other by default. You'd need to connect one container to both networks using `docker network connect`.

**...you forget to set up a custom network and use the default bridge?**

Containers can communicate by IP but not by name. Your app's connection string `postgres://db:5432/myapp` fails with "host not found." You spend an hour debugging before realizing you need a user-defined network.

**...your compose project name collides with another project?**

Both projects share the same network. Containers from project A can accidentally reach containers from project B. Use explicit project names: `docker compose -p myproject up`.

**...a container on an `internal: true` network tries to pull data from the internet?**

The request fails. Internal networks have no gateway to the outside world. This is by design — it prevents a compromised database container from exfiltrating data.

---

## Key Takeaways

1. Always use user-defined bridge networks — never the default bridge
2. Containers on the same user-defined network resolve each other by name
3. Bind database/internal service ports to 127.0.0.1, not 0.0.0.0
4. Use multiple networks for isolation — frontend shouldn't talk to database
5. Docker Compose creates a network per project automatically
6. `internal: true` blocks outbound internet — use it for databases
7. `netshoot` is your best friend for debugging container networking
