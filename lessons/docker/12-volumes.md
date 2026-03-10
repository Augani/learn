# Volumes and Bind Mounts

## The Storage Analogy

Docker gives you three ways to persist data:

- **Named volumes** are like a storage unit. Docker manages the facility — you just get a key and a unit number. You don't know (or care) exactly where in the warehouse your stuff is stored. Docker handles the location, security, and maintenance.

- **Bind mounts** are like bringing your own filing cabinet into the office. You know exactly where it is on your desk (host filesystem), you can access it with or without Docker, and you have full control — but also full responsibility.

- **tmpfs mounts** are like a whiteboard in a meeting room. Fast to write on, great for temporary work, but everything is wiped when you leave the room (container stops). It only exists in memory.

---

## Named Volumes

Docker manages the storage. You create a volume, attach it to a container, and Docker handles where the data actually lives on disk.

### Creating and Using Volumes

```bash
docker volume create mydata

docker volume ls
```

```
DRIVER    VOLUME NAME
local     mydata
```

Attach it to a container:

```bash
docker run -d --name db \
  -v mydata:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=devpassword \
  postgres:16
```

The volume `mydata` is now mounted at `/var/lib/postgresql/data` inside the container. PostgreSQL writes its data files there.

### Data Survives Container Death

```bash
docker rm -f db

docker run -d --name db-new \
  -v mydata:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=devpassword \
  postgres:16
```

All your tables, rows, and indexes are still there. The volume exists independently of any container.

### Inspect a Volume

```bash
docker volume inspect mydata
```

```json
[
  {
    "CreatedAt": "2024-01-15T10:30:00Z",
    "Driver": "local",
    "Labels": {},
    "Mountpoint": "/var/lib/docker/volumes/mydata/_data",
    "Name": "mydata",
    "Options": {},
    "Scope": "local"
  }
]
```

The `Mountpoint` shows where Docker stores the data on the host. You should NOT access this directly — it's Docker's internal storage. Think of it like poking around in your storage unit's warehouse after hours.

### Anonymous Volumes

If you don't name a volume, Docker creates an anonymous one:

```bash
docker run -d -v /var/lib/postgresql/data postgres:16
```

```bash
docker volume ls
```

```
DRIVER    VOLUME NAME
local     a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

Anonymous volumes get garbage-collected when no container references them. Always name your volumes.

### Volume in Dockerfile

The `VOLUME` instruction in a Dockerfile declares that a path should be a volume:

```dockerfile
FROM postgres:16
VOLUME /var/lib/postgresql/data
```

This means: "even if the user forgets to mount a volume, create an anonymous volume here so data isn't lost when the container's writable layer is removed."

But don't rely on this — explicit is better than implicit. Always mount named volumes in your `docker run` or compose file.

---

## Bind Mounts

You map a specific host directory into the container. The container sees exactly what's on the host filesystem.

### Development Workflow

This is the killer feature for development. Edit code on your host, see changes immediately in the container.

```bash
docker run -d --name dev-api \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/package.json:/app/package.json \
  -p 3000:3000 \
  node:20-alpine \
  sh -c "cd /app && npm install && npm run dev"
```

Every time you save a file in `./src`, the change is instantly visible inside the container. Hot reload works exactly like local development.

For a Go project:

```bash
docker run -d --name dev-api \
  -v $(pwd):/app \
  -p 8080:8080 \
  golang:1.22-alpine \
  sh -c "cd /app && go run ."
```

### Bind Mount vs Named Volume Syntax

Both use the `-v` flag but the syntax differs:

```bash
# Named volume: just a name, no path
-v mydata:/var/lib/postgresql/data

# Bind mount: absolute or relative path on the host
-v /home/user/project:/app
-v ./src:/app/src
```

The newer `--mount` syntax is more explicit:

```bash
# Named volume
--mount type=volume,source=mydata,target=/var/lib/postgresql/data

# Bind mount
--mount type=bind,source=$(pwd)/src,target=/app/src
```

The `--mount` syntax fails if the source directory doesn't exist. The `-v` syntax silently creates it. For safety, prefer `--mount`.

### Read-Only Bind Mounts

Mount config files that the container should read but never modify:

```bash
docker run -d --name web \
  -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v $(pwd)/certs:/etc/ssl/certs:ro \
  -p 80:80 \
  nginx:alpine
```

The `:ro` flag makes the mount read-only. If nginx tries to write to the config file, it gets a "read-only filesystem" error. This is a security best practice.

### Bind Mount Gotchas

**Problem 1: File permissions**

Your host user is UID 1000. The container runs as UID 999 (postgres). PostgreSQL can't write to the mounted directory.

```bash
docker run -d \
  -v $(pwd)/pgdata:/var/lib/postgresql/data \
  postgres:16
```

```
FATAL: data directory "/var/lib/postgresql/data" has wrong ownership
```

Fix: use a named volume instead, or set ownership:

```bash
mkdir -p pgdata
sudo chown 999:999 pgdata
```

**Problem 2: Mac/Windows performance**

On macOS and Windows, bind mounts go through a virtualization layer. File-heavy operations (like `node_modules` with thousands of files) are painfully slow.

Solution: use a named volume for `node_modules`:

```bash
docker run -d \
  -v $(pwd):/app \
  -v node_modules:/app/node_modules \
  -p 3000:3000 \
  node:20-alpine \
  sh -c "cd /app && npm install && npm run dev"
```

Your source code uses a fast bind mount. The `node_modules` directory uses a named volume (stored inside the Docker VM, much faster).

**Problem 3: Bind mount overrides container contents**

If the container has files at `/app` and you bind-mount an empty directory to `/app`, the container's files are hidden:

```bash
mkdir empty-dir
docker run -v $(pwd)/empty-dir:/app myapp
```

The application finds no code at `/app` and crashes.

---

## tmpfs Mounts

In-memory storage. Fast, temporary, gone when the container stops.

```bash
docker run -d --name cache \
  --tmpfs /tmp:size=100m \
  --tmpfs /run:size=10m \
  myapp
```

Or with `--mount`:

```bash
docker run -d --name cache \
  --mount type=tmpfs,destination=/tmp,tmpfs-size=104857600 \
  myapp
```

### When to Use tmpfs

- **Scratch space** for processing: unzip, transform, re-upload without touching disk
- **Sensitive data** that should never be written to disk (encryption keys during processing)
- **Performance** for temporary files that don't need persistence

Think of it like Go's `bytes.Buffer` — fast, in-memory, and discarded when you're done.

In TypeScript terms, it's like storing data in a `Map` versus writing to a file. The Map is faster but gone when the process exits.

---

## Comparing Mount Types

| Feature | Named Volume | Bind Mount | tmpfs |
|---------|-------------|------------|-------|
| Host location | Docker manages | You specify | Memory only |
| Survives restart | Yes | Yes (it's host fs) | No |
| Shared between containers | Yes | Yes | No |
| Performance on Mac | Good | Slow with many files | Fastest |
| Backup with Docker | `docker volume` | Standard fs tools | N/A |
| Use in production | Yes | Rarely | Yes (temp data) |
| Pre-populated | Yes (from image) | No (host overrides) | No |

### Decision Tree

```
Need to persist data across container restarts?
├── Yes -> Is it config/code you edit on the host?
│   ├── Yes -> Bind mount (development) or ConfigMap (production)
│   └── No -> Named volume (databases, uploads, caches)
└── No -> Is it sensitive temporary data?
    ├── Yes -> tmpfs (never hits disk)
    └── No -> Container's writable layer is fine
```

---

## Volume Drivers

The `local` driver stores data on the host filesystem. But volumes can use different drivers for different backends.

### NFS Volume

Share storage across multiple Docker hosts:

```bash
docker volume create --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.100,rw \
  --opt device=:/shared/data \
  nfs-data
```

### SSHFS Volume

Mount a remote filesystem via SSH:

```bash
docker plugin install vieux/sshfs

docker volume create --driver vieux/sshfs \
  -o sshcmd=user@remote:/path/to/data \
  -o password=secret \
  remote-data
```

### Cloud Volumes

AWS EBS, Azure Disk, and GCP Persistent Disk all have volume drivers. In practice, you'll use Kubernetes persistent volumes rather than Docker volume drivers for cloud storage.

---

## Practical Examples

### PostgreSQL with Persistent Data

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: devpassword
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "127.0.0.1:5432:5432"

volumes:
  pgdata:
```

Two mounts:
1. `pgdata` — named volume for database files (persistent, Docker-managed)
2. `./init.sql` — bind mount for initialization script (read-only, runs on first start)

The `docker-entrypoint-initdb.d` directory is a PostgreSQL Docker convention. Any `.sql` files there run when the database is first created.

```sql
-- init.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

Test persistence:

```bash
docker compose up -d

docker exec -it myproject-postgres-1 psql -U myapp -d myapp -c \
  "INSERT INTO users (email) VALUES ('test@example.com');"

docker compose down

docker compose up -d

docker exec -it myproject-postgres-1 psql -U myapp -d myapp -c \
  "SELECT * FROM users;"
```

```
 id |       email        |         created_at
----+--------------------+----------------------------
  1 | test@example.com   | 2024-01-15 10:30:00.000000
```

Data survives `docker compose down` because it's in a named volume. The volume is NOT deleted by `down`. You'd need `docker compose down -v` to destroy it.

### Redis with Persistence and tmpfs

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --appendfsync everysec
    volumes:
      - redis-data:/data
    tmpfs:
      - /tmp:size=50m
    ports:
      - "127.0.0.1:6379:6379"

volumes:
  redis-data:
```

Redis writes its append-only file (AOF) to `/data` (named volume). Temporary files go to `/tmp` (tmpfs — in memory, fast).

The `--appendonly yes` flag tells Redis to persist every write operation. Without it, Redis is purely in-memory and you'd lose everything on restart.

Test it:

```bash
docker compose up -d

docker exec myproject-redis-1 redis-cli SET greeting "hello from redis"
docker exec myproject-redis-1 redis-cli GET greeting

docker compose down
docker compose up -d

docker exec myproject-redis-1 redis-cli GET greeting
```

```
"hello from redis"
```

### Full Development Environment

```yaml
services:
  api:
    build:
      context: ./api
    volumes:
      - ./api/src:/app/src
      - ./api/go.mod:/app/go.mod
      - ./api/go.sum:/app/go.sum
      - go-cache:/root/go/pkg/mod
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
    ports:
      - "8080:8080"

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: devpassword
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/migrations:/docker-entrypoint-initdb.d:ro
    ports:
      - "127.0.0.1:5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    ports:
      - "127.0.0.1:6379:6379"

volumes:
  pgdata:
  redis-data:
  go-cache:
```

Three types of mounts working together:
- **Bind mounts** for source code (live editing)
- **Named volumes** for database data (persistence)
- **Named volume** for Go module cache (performance — avoid re-downloading on every build)

---

## Backup and Restore

### Backup a Named Volume

You can't just copy files from the Docker-managed location. Use a temporary container to create a tarball:

```bash
docker run --rm \
  -v pgdata:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/pgdata-$(date +%Y%m%d).tar.gz -C /source .
```

This:
1. Mounts the `pgdata` volume read-only at `/source`
2. Mounts your host's `backups` directory at `/backup`
3. Creates a compressed tarball of the volume contents
4. Removes the temporary container (`--rm`)

### Restore a Named Volume

```bash
docker volume create pgdata-restored

docker run --rm \
  -v pgdata-restored:/target \
  -v $(pwd)/backups:/backup:ro \
  alpine sh -c "cd /target && tar xzf /backup/pgdata-20240115.tar.gz"
```

### PostgreSQL-Specific Backup

For databases, you should use the database's own backup tools:

```bash
docker exec myproject-postgres-1 pg_dump -U myapp -d myapp > backup.sql

docker exec myproject-postgres-1 pg_dumpall -U myapp > full-backup.sql
```

Restore:

```bash
cat backup.sql | docker exec -i myproject-postgres-1 psql -U myapp -d myapp
```

### Redis-Specific Backup

```bash
docker exec myproject-redis-1 redis-cli BGSAVE

docker cp myproject-redis-1:/data/dump.rdb ./backups/redis-dump.rdb
```

Restore by copying the dump file back:

```bash
docker compose down

docker run --rm \
  -v redis-data:/data \
  -v $(pwd)/backups:/backup:ro \
  alpine cp /backup/redis-dump.rdb /data/dump.rdb

docker compose up -d
```

### Automated Backup Script

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

docker exec myproject-postgres-1 \
  pg_dump -U myapp -d myapp -Fc > "$BACKUP_DIR/myapp.dump"

docker exec myproject-redis-1 redis-cli BGSAVE
sleep 2
docker cp myproject-redis-1:/data/dump.rdb "$BACKUP_DIR/redis.rdb"

find /backups -type d -mtime +7 -exec rm -rf {} +

echo "Backup completed: $BACKUP_DIR"
```

Schedule with cron:

```
0 2 * * * /opt/scripts/backup.sh >> /var/log/backup.log 2>&1
```

---

## Volume Management

### List volumes

```bash
docker volume ls
```

```
DRIVER    VOLUME NAME
local     myproject_pgdata
local     myproject_redis-data
local     a1b2c3d4e5f6...  (anonymous)
```

### Remove unused volumes

```bash
docker volume prune
```

This removes ALL volumes not attached to a running container. Dangerous if you have stopped containers whose data you want to keep.

Remove a specific volume:

```bash
docker volume rm mydata
```

Docker refuses if a container (even stopped) is using it:

```
Error: volume is in use - [abc123def456]
```

### Copy data between volumes

```bash
docker volume create new-pgdata

docker run --rm \
  -v old-pgdata:/source:ro \
  -v new-pgdata:/target \
  alpine sh -c "cd /source && cp -a . /target/"
```

---

## Exercises

### Exercise 1: Persistence Test

1. Run a PostgreSQL container with a named volume
2. Create a table and insert data
3. Stop and remove the container
4. Start a new PostgreSQL container with the same volume
5. Verify your data is still there
6. Run `docker compose down -v` and repeat — confirm data is gone

### Exercise 2: Development Bind Mount

1. Create a simple Node.js or Go HTTP server
2. Run it in a container with a bind mount for your source code
3. Modify the response message on your host
4. Verify the change is reflected without rebuilding the container

### Exercise 3: Backup and Restore

1. Run PostgreSQL with a named volume
2. Insert test data
3. Create a backup using the tarball method
4. Delete the volume
5. Restore from the backup to a new volume
6. Verify data integrity

### Exercise 4: Volume Performance

Compare bind mount vs named volume performance on macOS:

```bash
time docker run --rm -v $(pwd)/node-project:/app node:20-alpine \
  sh -c "cd /app && npm install"

time docker run --rm \
  -v $(pwd)/node-project:/app \
  -v nm-cache:/app/node_modules \
  node:20-alpine \
  sh -c "cd /app && npm install"
```

Measure the difference.

### Exercise 5: tmpfs for Sensitive Processing

1. Run a container with a tmpfs mount at `/secrets`
2. Write a file to `/secrets/key.txt`
3. Verify you can read it
4. Stop and restart the container
5. Verify `/secrets/key.txt` is gone

---

## What Would Happen If...

**...you ran `docker compose down -v` instead of `docker compose down`?**

The `-v` flag removes named volumes. Your database data is gone. This is the most common "oops" moment in Docker. In production, NEVER use `-v` unless you mean it. It's like `DROP DATABASE` — no undo.

**...you bind-mounted your entire home directory into a container running as root?**

The container has root access to your entire home directory. A malicious or buggy process inside the container could delete your SSH keys, modify your shell config, or read your credentials. Always mount the minimum necessary directory.

**...two containers mount the same named volume simultaneously?**

It works, but with no coordination. If both write to the same file, you get corruption — like two people editing the same Google Doc offline and merging blindly. Databases handle this with their own locking, but arbitrary file access is unsafe.

**...you forgot to mount a volume for PostgreSQL?**

PostgreSQL writes to the container's writable layer. When you stop the container, all data is preserved in the stopped container. When you REMOVE the container (`docker rm`), the data is gone. Forever.

**...your named volume fills up the Docker disk?**

Docker stores volumes at `/var/lib/docker/volumes/`. If this partition fills up, all containers on the host are affected — they can't write logs, can't create new files, and may crash. Monitor disk usage:

```bash
docker system df
```

```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          15        5         4.2GB     2.8GB (66%)
Containers      8         3         250MB     150MB (60%)
Local Volumes   6         3         12GB      8GB (66%)
Build Cache     0         0         0B        0B
```

---

## Key Takeaways

1. Use named volumes for any data that must survive container removal
2. Use bind mounts for development — edit on host, run in container
3. Use tmpfs for sensitive or temporary data that should never hit disk
4. Always name your volumes — anonymous volumes are easy to lose
5. Back up databases with their native tools (`pg_dump`, `redis-cli BGSAVE`)
6. Never use `docker compose down -v` in production unless you're absolutely sure
7. On macOS, use named volumes for `node_modules` to avoid performance issues
8. Mount things read-only (`:ro`) when the container shouldn't write to them
