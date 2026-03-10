# Docker CLI Cheat Sheet

---

## Containers

### Run a Container

```bash
docker run nginx

docker run -d nginx

docker run -d --name my-nginx -p 8080:80 nginx

docker run -d \
  --name api \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgres://localhost/mydb \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  --memory 512m \
  --cpus 1.5 \
  myapp:latest

docker run --rm -it ubuntu bash

docker run --rm -it golang:1.22 go version
```

### Run Flags Quick Reference

| Flag | Short | Purpose | Example |
|------|-------|---------|---------|
| `--detach` | `-d` | Run in background | `-d` |
| `--name` | | Name the container | `--name api` |
| `--publish` | `-p` | Map port host:container | `-p 8080:80` |
| `--env` | `-e` | Set env variable | `-e NODE_ENV=prod` |
| `--volume` | `-v` | Mount volume/bind | `-v ./data:/data` |
| `--interactive` | `-i` | Keep STDIN open | `-i` |
| `--tty` | `-t` | Allocate terminal | `-t` |
| `--rm` | | Remove on exit | `--rm` |
| `--restart` | | Restart policy | `--restart unless-stopped` |
| `--memory` | `-m` | Memory limit | `-m 512m` |
| `--cpus` | | CPU limit | `--cpus 2` |
| `--network` | | Connect to network | `--network mynet` |
| `--workdir` | `-w` | Working directory | `-w /app` |
| `--user` | `-u` | Run as user | `-u 1000:1000` |
| `--env-file` | | Load env from file | `--env-file .env` |
| `--platform` | | Target platform | `--platform linux/arm64` |

### List Containers

```bash
docker ps

docker ps -a

docker ps -q

docker ps --filter status=exited

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

docker ps -a --filter ancestor=nginx
```

### Container Lifecycle

```bash
docker start my-container

docker stop my-container

docker stop -t 30 my-container

docker restart my-container

docker kill my-container

docker kill -s SIGUSR1 my-container

docker pause my-container
docker unpause my-container

docker rm my-container

docker rm -f my-container

docker rm $(docker ps -aq --filter status=exited)
```

### Execute Commands in Running Containers

```bash
docker exec -it my-container bash

docker exec -it my-container sh

docker exec my-container ls -la /app

docker exec -it -u root my-container bash

docker exec -e DEBUG=true my-container node script.js

docker exec -w /app/src my-container cat main.go
```

### Logs

```bash
docker logs my-container

docker logs -f my-container

docker logs --tail 100 my-container

docker logs --since 1h my-container

docker logs --since 2024-01-15T10:00:00 my-container

docker logs -f --tail 50 my-container

docker logs my-container 2>&1 | grep "ERROR"

docker logs --timestamps my-container
```

### Copy Files

```bash
docker cp my-container:/app/config.json ./config.json

docker cp ./local-file.txt my-container:/app/file.txt

docker cp my-container:/app/logs/ ./backup-logs/
```

### Inspect

```bash
docker inspect my-container

docker inspect --format '{{.State.Status}}' my-container

docker inspect --format '{{.NetworkSettings.IPAddress}}' my-container

docker inspect --format '{{json .Config.Env}}' my-container | jq

docker inspect --format '{{.HostConfig.Memory}}' my-container

docker inspect --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' my-container
```

### Stats

```bash
docker stats

docker stats my-container

docker stats --no-stream

docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Attach and Interact

```bash
docker attach my-container

docker wait my-container

docker top my-container

docker diff my-container

docker rename old-name new-name
```

---

## Images

### Build

```bash
docker build -t myapp:latest .

docker build -t myapp:v1.2.3 -f Dockerfile.prod .

docker build --build-arg GO_VERSION=1.22 -t myapp .

docker build --no-cache -t myapp .

docker build --target builder -t myapp-builder .

docker build --platform linux/amd64,linux/arm64 -t myapp .

DOCKER_BUILDKIT=1 docker build -t myapp .

docker build --progress=plain -t myapp .
```

### List and Manage Images

```bash
docker images

docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

docker images -f dangling=true

docker image ls myapp

docker rmi myapp:latest

docker rmi $(docker images -q --filter dangling=true)

docker image prune

docker image prune -a
```

### Tag and Push

```bash
docker tag myapp:latest registry.example.com/myapp:v1.2.3

docker push registry.example.com/myapp:v1.2.3

docker pull nginx:1.25-alpine

docker login registry.example.com
docker logout registry.example.com
```

### Image Information

```bash
docker history myapp:latest

docker history --no-trunc myapp:latest

docker inspect myapp:latest

docker inspect --format '{{.Config.Env}}' myapp:latest

docker image inspect --format '{{.Size}}' myapp:latest

docker manifest inspect nginx:latest
```

### Save and Load

```bash
docker save myapp:latest -o myapp.tar

docker save myapp:latest | gzip > myapp.tar.gz

docker load -i myapp.tar

cat myapp.tar.gz | docker load
```

---

## Volumes

```bash
docker volume create my-data

docker volume ls

docker volume inspect my-data

docker volume rm my-data

docker volume prune

docker run -v my-data:/app/data myapp

docker run -v $(pwd)/config:/app/config:ro myapp

docker run --tmpfs /tmp myapp

docker run -v my-data:/data busybox ls -la /data

docker run --rm -v my-data:/from -v $(pwd):/to busybox \
  sh -c "cd /from && tar czf /to/backup.tar.gz ."

docker run --rm -v my-data:/to -v $(pwd):/from busybox \
  sh -c "cd /to && tar xzf /from/backup.tar.gz"
```

### Volume Mount Types

| Type | Syntax | Use Case |
|------|--------|----------|
| Named volume | `-v mydata:/app/data` | Persistent data, managed by Docker |
| Bind mount | `-v ./local:/container` | Development, config files |
| tmpfs | `--tmpfs /tmp` | Temporary data, no persistence |
| Read-only | `-v ./config:/config:ro` | Config files that shouldn't change |

---

## Networks

```bash
docker network create my-network

docker network create --driver bridge my-bridge

docker network create --driver overlay my-overlay

docker network ls

docker network inspect my-network

docker network rm my-network

docker network prune

docker network connect my-network my-container

docker network disconnect my-network my-container

docker run -d --name api --network my-network myapp

docker run -d --name db --network my-network postgres

docker run -d --name web --network my-network \
  -e API_URL=http://api:3000 nginx
```

### Network Drivers

| Driver | Use Case |
|--------|----------|
| `bridge` | Default. Containers on same host. |
| `host` | Container uses host network directly. |
| `overlay` | Multi-host (Swarm/Kubernetes). |
| `none` | No networking. |
| `macvlan` | Container gets its own MAC address. |

---

## Docker Compose

### Basic Commands

```bash
docker compose up

docker compose up -d

docker compose up -d --build

docker compose down

docker compose down -v

docker compose ps

docker compose logs

docker compose logs -f api

docker compose exec api bash

docker compose run --rm api npm test

docker compose build

docker compose build --no-cache

docker compose pull

docker compose restart

docker compose restart api

docker compose stop

docker compose config

docker compose top
```

### Compose File Reference

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: development
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://user:pass@db:5432/mydb
    env_file:
      - .env
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      db:
        condition: service_healthy
    networks:
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mydb
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - backend

volumes:
  db-data:
  redis-data:

networks:
  backend:
    driver: bridge
```

### Profiles

```yaml
services:
  api:
    build: .
    ports:
      - "3000:3000"

  debug-tools:
    image: busybox
    profiles:
      - debug

  monitoring:
    image: prometheus
    profiles:
      - monitoring
```

```bash
docker compose up

docker compose --profile debug up

docker compose --profile debug --profile monitoring up
```

---

## System Management

### Disk Usage

```bash
docker system df

docker system df -v
```

### Cleanup

```bash
docker system prune

docker system prune -a

docker system prune -a --volumes

docker container prune

docker image prune

docker image prune -a

docker volume prune

docker network prune

docker builder prune

docker builder prune -a
```

### System Info

```bash
docker info

docker version

docker context ls
```

---

## Useful Patterns

### One-Off Commands

```bash
docker run --rm -it node:20-alpine node -e "console.log(process.version)"

docker run --rm -it golang:1.22 go version

docker run --rm -v $(pwd):/app -w /app node:20-alpine npm test

docker run --rm -v $(pwd):/src -w /src golang:1.22 go build -o /dev/null ./...
```

### Debug a Running Container

```bash
docker exec -it my-container sh

docker exec -it my-container cat /etc/resolv.conf

docker exec -it my-container env

docker exec -it my-container ps aux

docker logs --tail 200 -f my-container

docker stats --no-stream my-container

docker top my-container

docker inspect --format '{{json .State}}' my-container | jq
```

### Debug a Crashed Container

```bash
docker logs my-crashed-container

docker inspect --format '{{.State.ExitCode}}' my-crashed-container

docker inspect --format '{{.State.OOMKilled}}' my-crashed-container

docker commit my-crashed-container debug-image
docker run --rm -it debug-image sh

docker cp my-crashed-container:/app/logs ./crash-logs
```

### Port Debugging

```bash
docker port my-container

docker inspect --format '{{range $p, $conf := .NetworkSettings.Ports}}{{$p}} -> {{(index $conf 0).HostPort}}{{"\n"}}{{end}}' my-container
```

### Environment Inspection

```bash
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' my-container
```

### Bulk Operations

```bash
docker stop $(docker ps -q)

docker rm $(docker ps -aq)

docker rmi $(docker images -q)

docker volume rm $(docker volume ls -q)
```

### Export and Import

```bash
docker export my-container > container-fs.tar

docker import container-fs.tar my-imported-image

docker save myapp:v1 myapp:v2 -o images.tar

docker load -i images.tar
```

---

## Build Performance

### BuildKit Features

```bash
export DOCKER_BUILDKIT=1

docker build --progress=plain -t myapp .

docker build --ssh default -t myapp .

docker build --secret id=npmrc,src=$HOME/.npmrc -t myapp .

docker buildx build --cache-from type=registry,ref=myapp:cache \
  --cache-to type=registry,ref=myapp:cache -t myapp .

docker buildx create --use

docker buildx build --platform linux/amd64,linux/arm64 \
  -t registry.example.com/myapp:latest --push .
```

### Build Output

```bash
docker build --output type=local,dest=./out .

docker build --output type=tar,dest=./out.tar .
```
