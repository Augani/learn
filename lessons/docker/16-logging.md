# Logging in Containers

## The Restaurant Order System Analogy

Container logging works like a busy restaurant kitchen:

- Every station (container) **calls out their orders** (writes to stdout/stderr) — the grill calls out "burger ready," the salad station calls out "caesar up"
- A **central expeditor** (logging driver) stands at the pass and decides where each call goes — to the printer, to the display screen, or to the manager's tablet
- The expeditor **routes orders** based on rules — appetizers go to one screen, entrees to another, complaints to the manager (log routing by level/source)
- At the end of the night, all orders are **recorded in a ledger** (centralized logging) so you can review what happened, when, and by whom

Without a central expeditor, each station shouts into the void and nobody has a complete picture of what happened.

---

## stdout/stderr: The Logging Interface

In the Docker world, there's one golden rule: **applications should write logs to stdout and stderr**. Not to files. Not to a custom logging directory. stdout and stderr.

This is because Docker captures everything written to stdout and stderr and routes it through a logging driver. If your app writes to `/var/log/app.log`, Docker never sees it.

Think of it like this: in Go, you use `io.Writer` interfaces — you don't hard-code file paths. stdout is the universal writer that Docker plugs into.

### What This Means in Practice

**Go — just use the standard logger:**

```go
package main

import (
	"log/slog"
	"os"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	logger.Info("server starting", "port", 8080)
	logger.Error("database connection failed", "error", "connection refused", "host", "postgres")
}
```

Output:

```json
{"time":"2024-01-15T10:30:00Z","level":"INFO","msg":"server starting","port":8080}
{"time":"2024-01-15T10:30:01Z","level":"ERROR","msg":"database connection failed","error":"connection refused","host":"postgres"}
```

**TypeScript — configure your logger for stdout:**

```typescript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty" }
      : undefined,
});

logger.info({ port: 3000 }, "server starting");
logger.error({ err: new Error("connection refused"), host: "postgres" }, "database connection failed");
```

**What about existing apps that write to files?**

Create a symlink in your Dockerfile:

```dockerfile
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log
```

This is exactly what the official nginx Docker image does. Nginx thinks it's writing to files, but everything goes to stdout/stderr.

---

## docker logs Command

The `docker logs` command reads from the container's log output.

```bash
docker logs myapp-api-1

docker logs -f myapp-api-1

docker logs --tail 50 myapp-api-1

docker logs --since 5m myapp-api-1

docker logs --since 2024-01-15T10:00:00 myapp-api-1

docker logs --until 2024-01-15T11:00:00 myapp-api-1

docker logs -f --since 5m myapp-api-1
```

With Docker Compose:

```bash
docker compose logs

docker compose logs api

docker compose logs -f api postgres

docker compose logs --tail 100 --since 5m api
```

### Filtering Logs

Docker doesn't have built-in log filtering. Use standard Unix tools:

```bash
docker logs myapp-api-1 2>&1 | grep "ERROR"

docker logs myapp-api-1 2>&1 | jq 'select(.level == "ERROR")'

docker logs myapp-api-1 2>&1 | jq 'select(.msg | contains("database"))'
```

The `2>&1` redirects stderr to stdout so you can pipe both streams.

---

## Logging Drivers

Logging drivers determine where Docker sends container logs. The default is `json-file`.

### json-file (Default)

Docker writes each log line as a JSON object to a file on disk.

```bash
docker info --format '{{.LoggingDriver}}'
```

```
json-file
```

The logs are stored at:

```
/var/lib/docker/containers/<container-id>/<container-id>-json.log
```

Each line looks like:

```json
{"log":"server starting on :8080\n","stream":"stdout","time":"2024-01-15T10:30:00.000000000Z"}
```

Configure per container:

```bash
docker run -d \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  --log-opt compress=true \
  myapp
```

In Compose:

```yaml
services:
  api:
    build: ./api
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
        compress: "true"
```

This keeps at most 3 log files of 10MB each (30MB total per container), compressed.

### Why Log Rotation Matters

Without log rotation, a busy container can fill your disk:

```bash
docker run -d --name chatty alpine sh -c "while true; do echo 'hello world'; done"
```

After a few hours, you'll find gigabytes of logs at the container's json-file location. This has brought down production servers.

**Always configure max-size and max-file.** Set it globally in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  }
}
```

Then restart Docker. Every new container gets these defaults.

### syslog

Send logs to a syslog server:

```bash
docker run -d \
  --log-driver syslog \
  --log-opt syslog-address=tcp://logserver:514 \
  --log-opt tag="myapp-api" \
  myapp
```

### fluentd

Send logs to Fluentd for processing and forwarding:

```bash
docker run -d \
  --log-driver fluentd \
  --log-opt fluentd-address=localhost:24224 \
  --log-opt tag="docker.{{.Name}}" \
  myapp
```

### awslogs

Send logs directly to AWS CloudWatch:

```bash
docker run -d \
  --log-driver awslogs \
  --log-opt awslogs-region=us-east-1 \
  --log-opt awslogs-group=/ecs/myapp \
  --log-opt awslogs-stream-prefix=api \
  myapp
```

### Logging Driver Comparison

| Driver | docker logs? | Remote? | Use case |
|--------|-------------|---------|----------|
| json-file | Yes | No | Development, small deployments |
| local | Yes | No | Better performance than json-file |
| syslog | No | Yes | Traditional Linux logging |
| fluentd | No | Yes | Log aggregation pipelines |
| awslogs | No | Yes | AWS deployments |
| gcplogs | No | Yes | GCP deployments |
| none | No | No | Disable logging entirely |

Important: with non-`json-file`/`local` drivers, `docker logs` doesn't work. The logs go directly to the remote system.

---

## Structured Logging

Unstructured logs are like free-form notes. Structured logs are like database rows — every field has a name and type, making them searchable and parseable.

### Unstructured (Bad for Containers)

```
[2024-01-15 10:30:00] INFO: User john@example.com logged in from 192.168.1.100
[2024-01-15 10:30:01] ERROR: Failed to send email to jane@example.com: connection timeout
```

Try parsing "from 192.168.1.100" programmatically. Every log message has a different format.

### Structured (Good for Containers)

```json
{"time":"2024-01-15T10:30:00Z","level":"info","msg":"user logged in","user":"john@example.com","ip":"192.168.1.100","service":"auth"}
{"time":"2024-01-15T10:30:01Z","level":"error","msg":"email send failed","recipient":"jane@example.com","error":"connection timeout","service":"notifications"}
```

Now you can query: "show me all errors from the notifications service in the last hour."

### Go Structured Logging with slog

```go
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/users", loggingMiddleware(handleUsers))

	slog.Info("server starting", "port", 8080)
	http.ListenAndServe(":8080", mux)
}

func loggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		recorder := &statusRecorder{ResponseWriter: w, status: 200}
		next(recorder, r)

		slog.Info("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.status,
			"duration_ms", time.Since(start).Milliseconds(),
			"remote_addr", r.RemoteAddr,
			"user_agent", r.UserAgent(),
		)
	}
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`[{"id": 1, "name": "Alice"}]`))
}
```

Output:

```json
{"time":"2024-01-15T10:30:00Z","level":"INFO","msg":"server starting","port":8080}
{"time":"2024-01-15T10:30:01Z","level":"INFO","msg":"http request","method":"GET","path":"/api/users","status":200,"duration_ms":2,"remote_addr":"172.18.0.1:54321","user_agent":"curl/8.4.0"}
```

### TypeScript Structured Logging with Pino

```typescript
import pino from "pino";
import express from "express";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label: string) => ({ level: label }),
  },
});

const app = express();

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      remoteAddr: req.ip,
      userAgent: req.get("user-agent"),
    }, "http request");
  });

  next();
});

app.get("/api/users", (_req, res) => {
  res.json([{ id: 1, name: "Alice" }]);
});

app.listen(3000, () => {
  logger.info({ port: 3000 }, "server starting");
});
```

### Log Levels

Use levels consistently across services:

| Level | When to use |
|-------|------------|
| `debug` | Development-only details, variable dumps |
| `info` | Normal operations — startup, shutdown, requests |
| `warn` | Something unexpected but handled — retries, fallbacks |
| `error` | Something failed — failed requests, broken connections |
| `fatal` | Application cannot continue — missing config, port conflict |

Control level via environment variable:

```yaml
services:
  api:
    environment:
      LOG_LEVEL: ${LOG_LEVEL:-info}
```

In development: `LOG_LEVEL=debug`. In production: `LOG_LEVEL=warn`.

---

## Centralized Logging with ELK/EFK Stack

When you have dozens of containers, reading logs with `docker logs` doesn't scale. You need centralized logging.

### ELK Stack: Elasticsearch + Logstash + Kibana

```
Containers -> Logstash (collect/parse) -> Elasticsearch (store/index) -> Kibana (visualize/search)
```

### EFK Stack: Elasticsearch + Fluentd + Kibana

```
Containers -> Fluentd (collect/route) -> Elasticsearch (store/index) -> Kibana (visualize/search)
```

Fluentd is lighter than Logstash and more common in containerized environments.

### Practical: Log Aggregation with Docker Compose

```yaml
services:
  api:
    build: ./api
    logging:
      driver: fluentd
      options:
        fluentd-address: "localhost:24224"
        tag: "app.api"
    depends_on:
      - fluentd

  worker:
    build: ./worker
    logging:
      driver: fluentd
      options:
        fluentd-address: "localhost:24224"
        tag: "app.worker"
    depends_on:
      - fluentd

  fluentd:
    build: ./fluentd
    ports:
      - "24224:24224"
      - "24224:24224/udp"
    volumes:
      - ./fluentd/conf:/fluentd/etc:ro
    depends_on:
      elasticsearch:
        condition: service_healthy

  elasticsearch:
    image: elasticsearch:8.12.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - esdata:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  kibana:
    image: kibana:8.12.0
    ports:
      - "5601:5601"
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    depends_on:
      elasticsearch:
        condition: service_healthy

volumes:
  esdata:
```

### Fluentd Configuration

```dockerfile
FROM fluent/fluentd:v1.16-debian-1
USER root
RUN fluent-gem install fluent-plugin-elasticsearch
USER fluent
COPY conf/fluent.conf /fluentd/etc/fluent.conf
```

```xml
# fluentd/conf/fluent.conf
<source>
  @type forward
  port 24224
  bind 0.0.0.0
</source>

<filter app.**>
  @type parser
  key_name log
  reserve_data true
  <parse>
    @type json
  </parse>
</filter>

<match app.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  logstash_format true
  logstash_prefix docker
  include_tag_key true
  <buffer>
    flush_interval 5s
  </buffer>
</match>
```

This pipeline:
1. Receives logs from containers via the fluentd driver
2. Parses JSON log lines into structured fields
3. Sends them to Elasticsearch with daily indices (`docker-2024.01.15`)

### Simpler Alternative: Loki + Grafana

The EFK stack is heavy. For smaller deployments, Grafana Loki is lighter:

```yaml
services:
  api:
    build: ./api
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    volumes:
      - loki-data:/loki

  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./promtail-config.yml:/etc/promtail/config.yml:ro
    command: -config.file=/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  loki-data:
  grafana-data:
```

Promtail reads Docker's json-file logs and ships them to Loki. No need to change logging drivers.

---

## Log Correlation

With multiple services, you need to trace a request across them. Use a correlation/request ID.

### Go Middleware

```go
func correlationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		ctx := context.WithValue(r.Context(), "request_id", requestID)
		w.Header().Set("X-Request-ID", requestID)

		logger := slog.With("request_id", requestID)
		ctx = context.WithValue(ctx, "logger", logger)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
```

When Service A calls Service B, pass the request ID:

```go
req, _ := http.NewRequestWithContext(ctx, "GET", "http://service-b/api/data", nil)
req.Header.Set("X-Request-ID", ctx.Value("request_id").(string))
```

Now you can search Kibana/Grafana for a single request ID and see the entire trace across all services.

---

## Exercises

### Exercise 1: Structured Logging

Take a Go or TypeScript web server and:
1. Add structured JSON logging for all HTTP requests
2. Include method, path, status, duration, and request ID
3. Run it in Docker and view logs with `docker logs`
4. Parse the output with `jq` to find all requests slower than 100ms

### Exercise 2: Log Rotation

1. Run a container that generates logs rapidly
2. Observe disk usage growing without rotation
3. Configure `max-size: 1m` and `max-file: 3`
4. Verify that total log storage stays under 3MB

```bash
docker run -d --name logspammer \
  --log-opt max-size=1m \
  --log-opt max-file=3 \
  alpine sh -c "while true; do echo 'log line $(date)'; sleep 0.01; done"

docker inspect --format='{{.LogPath}}' logspammer
ls -la $(dirname $(docker inspect --format='{{.LogPath}}' logspammer))
```

### Exercise 3: Centralized Logging

Set up Loki + Promtail + Grafana with Docker Compose. Run 3 application containers. In Grafana:
1. Find all ERROR level logs across all containers
2. Filter logs from a specific container
3. Search for a specific request ID across services

### Exercise 4: Log-Based Debugging

Create a multi-service application where:
1. Service A receives an HTTP request
2. Service A calls Service B
3. Service B calls Service C
4. Service C returns an error

Use structured logging and request ID correlation to trace the error from the client response all the way back to Service C.

---

## What Would Happen If...

**...you wrote logs to a file inside the container instead of stdout?**

`docker logs` shows nothing. Your logging driver receives nothing. The file grows until the container's writable layer fills up. When the container is removed, the logs are gone. If you must write to files, mount a volume for the log directory — but you're fighting Docker's design.

**...you didn't set up log rotation?**

Disk fills up. Docker can't write new logs, containers can't write to their writable layers, and everything grinds to a halt. This is one of the most common Docker-in-production failures. The fix is two lines of config in `daemon.json`. There's no excuse for skipping it.

**...you used the fluentd driver but Fluentd was down?**

By default, Docker buffers logs in memory and blocks the container when the buffer is full. Your application hangs because it can't write to stdout. Configure `fluentd-async: "true"` to prevent blocking, but you may lose logs during the outage.

**...you logged sensitive data (passwords, tokens, PII)?**

It's now in your logging pipeline — Elasticsearch, CloudWatch, log files, backup tapes. Data retention policies for logs are often measured in months or years. Redact sensitive fields before logging. Never log request bodies that might contain credentials.

**...your structured logs are inconsistent across services?**

One service uses `"level": "ERROR"`, another uses `"severity": "error"`, a third uses `"lvl": 3`. Your Kibana dashboards break, alerts don't fire, and debugging takes 3x longer. Agree on field names across teams: `time`, `level`, `msg`, `request_id`, `service`.

---

## Key Takeaways

1. Write logs to stdout/stderr — let Docker handle routing
2. Use structured JSON logging — it's searchable and parseable
3. Always configure log rotation (`max-size`, `max-file`) — disk full = outage
4. Use correlation IDs to trace requests across services
5. Start with `json-file` driver + Loki for small deployments
6. Graduate to EFK/ELK when you need powerful search and visualization
7. Control log level via environment variable — `debug` in dev, `warn` in prod
8. Never log sensitive data — it persists in your logging pipeline for years
