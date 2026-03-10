# Lesson 18: Monitoring and Observability

Monitoring tells you when something is wrong. Observability tells you why. A well-monitored system detects problems before users do, gives you the data to diagnose root causes, and prevents the same failures from recurring.

---

## The Three Pillars of Observability

### 1. Metrics

Numeric measurements over time. They answer "how much" and "how many."

Examples:
- CPU usage: 73%
- Request count: 1,250 requests/minute
- Error rate: 2.3%
- Response time p99: 450ms
- Active database connections: 42/50

Metrics are cheap to collect, efficient to store (just numbers), and ideal for dashboards and alerts. But they lack detail — you know the error rate spiked, but not which endpoint or which user was affected.

### 2. Logs

Discrete events with context. They answer "what happened."

Examples:
- `2024-01-15T10:30:17Z ERROR Failed to process order #12345: payment gateway timeout`
- `2024-01-15T10:30:18Z INFO User augustus logged in from 192.168.1.10`

Logs provide rich detail about individual events. But they are expensive to store at high volume, and searching through millions of log lines is slow without proper indexing.

### 3. Traces

The path of a single request through multiple services. They answer "where did time get spent."

A trace might show:
```
→ API Gateway (2ms)
  → Auth Service (15ms)
  → User Service (45ms)
    → PostgreSQL Query (30ms)
    → Redis Cache Set (3ms)
  → Response (1ms)
Total: 96ms
```

Traces are invaluable for microservices architectures where a single user request touches many services. Without traces, you see that the request took 96ms but cannot tell which service was slow.

### How they complement each other

1. **Metrics alert you:** "Error rate exceeded 5%"
2. **Logs explain:** "Payment gateway returning 503 errors"
3. **Traces pinpoint:** "The timeout happens on the call from Order Service to Payment Gateway, specifically when the gateway calls its database"

---

## Prometheus: Metrics Collection

Prometheus is the standard open-source metrics system. It works on a pull model — Prometheus scrapes HTTP endpoints on your services at regular intervals.

### How it works

1. Your application exposes metrics at `/metrics` (an HTTP endpoint)
2. Prometheus scrapes this endpoint every 15-30 seconds
3. Metrics are stored as time series data
4. You query metrics using PromQL (Prometheus Query Language)

### Metric types

| Type | Purpose | Example |
|------|---------|---------|
| Counter | Value that only increases | Total requests served, total errors |
| Gauge | Value that goes up and down | Current CPU usage, active connections |
| Histogram | Distribution of values | Request duration, response sizes |
| Summary | Like histogram but calculates quantiles client-side | Similar to histogram |

### Exposing metrics from a Rust application

Using the `prometheus` crate:

```rust
use prometheus::{IntCounter, Histogram, register_int_counter, register_histogram, opts};

lazy_static! {
    static ref REQUEST_COUNTER: IntCounter = register_int_counter!(
        "http_requests_total",
        "Total number of HTTP requests"
    ).unwrap();

    static ref REQUEST_DURATION: Histogram = register_histogram!(
        "http_request_duration_seconds",
        "HTTP request duration in seconds",
        vec![0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
    ).unwrap();
}

async fn handle_request() {
    REQUEST_COUNTER.inc();

    let timer = REQUEST_DURATION.start_timer();
    // ... handle request ...
    timer.observe_duration();
}
```

The `/metrics` endpoint produces output like:

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total 12543

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.005"} 8234
http_request_duration_seconds_bucket{le="0.01"} 10567
http_request_duration_seconds_bucket{le="0.025"} 11890
http_request_duration_seconds_bucket{le="0.05"} 12100
http_request_duration_seconds_sum 45.23
http_request_duration_seconds_count 12543
```

### PromQL: Querying metrics

```promql
# Request rate (requests per second, averaged over 5 minutes)
rate(http_requests_total[5m])

# Error rate as a percentage
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# CPU usage
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage
node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes
```

### Running Prometheus locally with Docker

```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

volumes:
  prometheus_data:
```

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'myapp'
    static_configs:
      - targets: ['host.docker.internal:8080']
```

Access Prometheus UI at `http://localhost:9090`.

---

## Grafana: Dashboards and Visualization

Grafana connects to data sources (Prometheus, PostgreSQL, Elasticsearch) and creates visual dashboards.

### Running Grafana locally

```yaml
services:
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  grafana_data:
```

Access at `http://localhost:3000` (admin/admin).

### Useful dashboard panels

- **Request rate** — Line graph showing requests/second over time
- **Error rate** — Percentage of 5xx responses
- **Latency percentiles** — p50, p95, p99 response times
- **CPU and Memory** — System resource utilization
- **Database connections** — Active vs max connections
- **Queue depth** — Messages waiting to be processed

---

## Alerting

### When to alert (wake someone up)

Alert when there is **user-facing impact that requires human intervention:**
- Error rate exceeds 5% for more than 5 minutes
- p99 latency exceeds 2 seconds
- Disk usage above 90%
- Service is down (health check failing)
- Certificate expiring within 7 days

### When NOT to alert

Do not alert for things that are:
- Self-healing (auto-scaled, auto-restarted)
- Not user-facing
- Expected (scheduled maintenance, known spikes)

**Every alert should be actionable.** If you receive an alert and there is nothing you can do about it, remove the alert. Alert fatigue is real and dangerous — teams that get too many false alerts start ignoring real ones.

### Alert structure

A good alert includes:
- **What** is happening: "Error rate exceeded 5% on API service"
- **Impact**: "Users are seeing 500 errors on /api/orders"
- **Dashboard link**: Direct link to the relevant Grafana dashboard
- **Runbook link**: Step-by-step guide for diagnosing and fixing

---

## Health Checks and Readiness Probes

### Health check (liveness)

"Is the process alive and not stuck?"

```
GET /health → 200 OK
```

A liveness check should be simple — verify the process can respond. If it fails, the orchestrator (Kubernetes, Docker) restarts the container.

### Readiness check

"Can this process serve traffic?"

```
GET /ready → 200 OK
```

A readiness check verifies dependencies — can the process connect to its database? Is its cache populated? If it fails, the load balancer stops sending traffic to this instance, but does NOT restart it.

### Example implementation

```rust
async fn health() -> StatusCode {
    StatusCode::OK
}

async fn ready(pool: &PgPool, redis: &RedisPool) -> StatusCode {
    let db_ok = sqlx::query("SELECT 1")
        .execute(pool)
        .await
        .is_ok();

    let redis_ok = redis.get_connection()
        .and_then(|mut conn| redis::cmd("PING").query::<String>(&mut conn))
        .is_ok();

    if db_ok && redis_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    }
}
```

Docker health check in docker-compose.yml:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 30s
```

---

## The USE Method

Brendan Gregg's USE method for analyzing system performance:

- **U**tilization — What percentage of the resource is being used?
- **S**aturation — How much work is queued/waiting?
- **E**rrors — Are there error events?

Apply USE to each resource:

| Resource | Utilization | Saturation | Errors |
|----------|------------|------------|--------|
| CPU | `%CPU` | Run queue length, load average | Machine check exceptions |
| Memory | `%used` | Swap usage, OOM events | Allocation failures |
| Disk I/O | `%busy` | Wait queue length | Device errors |
| Network | Bandwidth used | TCP retransmits, dropped packets | Interface errors |
| DB connections | Active/Max | Queue depth | Connection refused |

### Command-line tools for USE

```bash
# CPU
top -l 1 | head -10              # macOS
uptime                           # load average

# Memory
vm_stat                          # macOS
free -h                          # Linux

# Disk
iostat -w 2                      # macOS
df -h                            # space

# Network
netstat -an | grep -c ESTABLISHED
nettop                           # macOS, real-time
```

---

## The RED Method

Tom Wilkie's RED method for monitoring request-driven services:

- **R**ate — Requests per second
- **E**rrors — Failed requests per second
- **D**uration — Response time distribution

These three metrics give you immediate visibility into service health from the user's perspective.

### Implementing RED in Prometheus

```promql
# Rate
rate(http_requests_total[5m])

# Errors
rate(http_requests_total{status=~"5.."}[5m])

# Duration (p50, p95, p99)
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

**Why percentiles matter more than averages:** An average latency of 100ms hides the fact that 1% of users experience 5-second latencies. The p99 (99th percentile) shows you the worst experience that 1 in 100 users has.

---

## Practical: Full Monitoring Stack with Docker Compose

```yaml
services:
  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      RUST_LOG: info

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana_data:/var/lib/grafana

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"

volumes:
  grafana_data:
```

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api:8080']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

---

## Exercises

### Exercise 1: System metrics from the command line

```bash
# CPU usage
echo "=== CPU ==="
uptime
top -l 1 | head -5              # macOS

# Memory
echo "=== Memory ==="
vm_stat | head -10               # macOS

# Disk
echo "=== Disk ==="
df -h | grep -v "^/dev/disk\|devfs\|map "

# Network connections
echo "=== Network ==="
netstat -an | grep -c ESTABLISHED
echo "established connections"

# Processes
echo "=== Top Processes ==="
ps aux | sort -k3 -rn | head -5
```

### Exercise 2: Run Prometheus and Grafana

```bash
mkdir -p /tmp/monitoring-exercise/monitoring
cd /tmp/monitoring-exercise

cat > monitoring/prometheus.yml <<'EOF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF

cat > docker-compose.yml <<'EOF'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
EOF

docker compose up -d

echo "Prometheus: http://localhost:9090"
echo "Grafana: http://localhost:3001 (admin/admin)"
echo ""
echo "Try these PromQL queries in Prometheus:"
echo "  up"
echo "  prometheus_http_requests_total"
echo "  rate(prometheus_http_requests_total[5m])"
echo ""
echo "Run 'docker compose down' when done"
```

### Exercise 3: Monitor your system with node-exporter

```bash
cd /tmp/monitoring-exercise

cat > monitoring/prometheus.yml <<'EOF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
EOF

cat > docker-compose.yml <<'EOF'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
EOF

docker compose up -d

echo "Now in Prometheus (http://localhost:9090), try:"
echo "  node_cpu_seconds_total"
echo "  node_memory_MemTotal_bytes"
echo "  node_filesystem_avail_bytes"
echo "  rate(node_cpu_seconds_total{mode='idle'}[5m])"
echo ""
echo "In Grafana (http://localhost:3001):"
echo "  1. Add Prometheus as a data source (URL: http://prometheus:9090)"
echo "  2. Import dashboard ID 1860 (Node Exporter Full)"
```

### Exercise 4: Create a health check endpoint

Create a simple health check server:

```bash
mkdir -p /tmp/health-exercise
cd /tmp/health-exercise

cat > health_server.py <<'EOF'
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "healthy"}).encode())
        elif self.path == '/ready':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ready",
                "checks": {
                    "database": "connected",
                    "cache": "connected"
                }
            }).encode())
        elif self.path == '/metrics':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            metrics = """# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/health"} 42
http_requests_total{method="GET",path="/ready"} 15
# HELP up Whether the service is up
# TYPE up gauge
up 1
"""
            self.wfile.write(metrics.encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

port = int(os.environ.get('PORT', '8080'))
server = HTTPServer(('0.0.0.0', port), HealthHandler)
print(f"Health check server on port {port}")
server.serve_forever()
EOF

python3 health_server.py &
SERVER_PID=$!
sleep 1

# Test health endpoint
echo "=== Health ==="
curl -s http://localhost:8080/health | python3 -m json.tool

echo "=== Ready ==="
curl -s http://localhost:8080/ready | python3 -m json.tool

echo "=== Metrics ==="
curl -s http://localhost:8080/metrics

# Clean up
kill $SERVER_PID
rm -rf /tmp/health-exercise
```

### Exercise 5: Apply the USE method

```bash
echo "=== USE Method: System Health ==="

echo ""
echo "--- CPU ---"
echo "Utilization:"
top -l 1 | grep "CPU usage" 2>/dev/null || uptime
echo "Saturation (load average):"
uptime | awk -F'load averages:' '{print $2}'
echo "Errors: check dmesg or system log for CPU errors"

echo ""
echo "--- Memory ---"
echo "Utilization:"
vm_stat 2>/dev/null | grep -E "Pages (free|active|inactive|speculative|wired)" || free -h
echo "Saturation: check for swap usage"
sysctl vm.swapusage 2>/dev/null || cat /proc/swaps 2>/dev/null

echo ""
echo "--- Disk ---"
echo "Utilization:"
df -h / | tail -1
echo "Saturation:"
iostat -w 1 -c 2 2>/dev/null | tail -1 || echo "Check with iostat"

echo ""
echo "--- Network ---"
echo "Connections:"
netstat -an | grep -c ESTABLISHED
echo "established connections"
```

---

## What's Next

You have completed the Linux/Unix fundamentals course. Here is where to go deeper:

**Practice daily:**
- Use the command line for everything you can. Resist the urge to use GUI tools for file management, git operations, and service management.
- When you encounter a problem, try to solve it with the tools from these lessons before reaching for a web search.

**Deep dives:**
- **Networking:** Study TCP/IP in depth — "TCP/IP Illustrated" by W. Richard Stevens
- **Operating Systems:** "Operating Systems: Three Easy Pieces" (free online) — covers processes, memory, file systems, concurrency
- **Linux Administration:** "The Linux Command Line" by William Shotts (free online)
- **Containers:** Dive deeper into Kubernetes for orchestrating containers at scale
- **Observability:** Learn OpenTelemetry for standardized metrics, logs, and traces

**Projects to try:**
- Set up a complete CI/CD pipeline with GitHub Actions or GitLab CI
- Deploy a Rust/Go application to a Linux server with systemd, nginx, PostgreSQL, and monitoring
- Create a development environment with Docker Compose that mirrors production
- Write a shell script that automates your most common development tasks
- Set up Prometheus + Grafana monitoring for a personal project

The command line is a multiplier on your effectiveness as a developer. Every hour invested in these fundamentals pays dividends for your entire career.
