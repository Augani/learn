# Lesson 29: Multi-Tenancy

Most B2B SaaS products serve hundreds of customers (tenants) on shared
infrastructure. The challenge: keep tenants isolated so one customer's
traffic spike doesn't crash another's experience, while keeping costs
low by sharing resources.

**Analogy:** An apartment building is multi-tenant. Residents share the
building structure, plumbing, and electricity, but each apartment has
its own lock, its own space, and its own lease. A noisy neighbor
shouldn't keep everyone awake. A tenant running 10 space heaters
shouldn't trip the building's breaker. That's multi-tenancy.

---

## Isolation Models

```
SILO (fully isolated):
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Tenant A │  │ Tenant B │  │ Tenant C │
  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │
  │ │ App  │ │  │ │ App  │ │  │ │ App  │ │
  │ │ DB   │ │  │ │ DB   │ │  │ │ DB   │ │
  │ │ Cache│ │  │ │ Cache│ │  │ │ Cache│ │
  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │
  └──────────┘  └──────────┘  └──────────┘
  Each tenant gets their own everything.

POOL (fully shared):
  ┌────────────────────────────────────────┐
  │         Shared Infrastructure          │
  │  ┌──────┐  ┌──────┐  ┌──────┐         │
  │  │ App  │  │  DB  │  │Cache │         │
  │  │(all  │  │(all  │  │(all  │         │
  │  │tenants)│ │tenants)│ │tenants)│       │
  │  └──────┘  └──────┘  └──────┘         │
  │  tenant_id column in every table       │
  └────────────────────────────────────────┘

BRIDGE (hybrid):
  ┌────────────────────────────────────────┐
  │      Shared App Servers                │
  │  ┌──────┐  ┌──────┐  ┌──────┐         │
  │  │ App  │  │ App  │  │ App  │         │
  │  └──┬───┘  └──┬───┘  └──┬───┘         │
  └─────┼─────────┼─────────┼──────────────┘
        │         │         │
   ┌────▼───┐ ┌──▼─────┐ ┌─▼──────┐
   │ DB: A  │ │ DB: B  │ │ DB: C  │
   └────────┘ └────────┘ └────────┘
   Each tenant gets own DB, shares compute.
```

### Comparison

| Factor | Silo | Pool | Bridge |
|--------|------|------|--------|
| Isolation | Strongest | Weakest | Medium |
| Cost per tenant | Highest | Lowest | Medium |
| Noisy neighbor risk | None | High | Medium |
| Onboarding speed | Slow (provision infra) | Instant | Medium |
| Compliance | Easiest (separate everything) | Hardest | Depends |
| Operational burden | High (N deployments) | Low (1 deployment) | Medium |
| Best for | Enterprise, regulated | SMB, high-volume | Mid-market |

---

## The Noisy Neighbor Problem

One tenant's heavy workload degrades performance for everyone else.

```
SCENARIO: Shared database, 100 tenants

  Normal day:
    Each tenant: ~100 QPS
    Total: 10,000 QPS (database handles fine)

  Tenant X runs a massive export:
    Tenant X: 50,000 QPS (heavy scan query)
    Everyone else: timeouts, slow queries

  ┌────────────────────────────────────┐
  │           Shared Database          │
  │                                    │
  │  Tenant A: 100 QPS  ──▶ OK        │
  │  Tenant B: 100 QPS  ──▶ OK        │
  │  Tenant X: 50K QPS  ──▶ hogging   │
  │  Tenant C: 100 QPS  ──▶ TIMEOUT   │
  │  Tenant D: 100 QPS  ──▶ TIMEOUT   │
  └────────────────────────────────────┘
```

### Solutions

**1. Per-Tenant Rate Limiting**

```go
package tenancy

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type TenantRateLimiter struct {
	client *redis.Client
}

func (rl *TenantRateLimiter) Allow(ctx context.Context, tenantID string, limit int, window time.Duration) (bool, error) {
	key := fmt.Sprintf("rate:%s", tenantID)
	pipe := rl.client.Pipeline()

	now := time.Now().UnixMilli()
	windowStart := now - window.Milliseconds()

	pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%d", windowStart))
	pipe.ZCard(ctx, key)
	pipe.ZAdd(ctx, key, redis.Z{Score: float64(now), Member: fmt.Sprintf("%d", now)})
	pipe.Expire(ctx, key, window)

	results, err := pipe.Exec(ctx)
	if err != nil {
		return false, fmt.Errorf("rate limit check: %w", err)
	}

	count := results[1].(*redis.IntCmd).Val()
	return count < int64(limit), nil
}
```

**2. Resource Quotas**

```
Tenant tier definitions:

  ┌────────────┬──────────┬───────────┬──────────────┐
  │   Tier     │ API Rate │ Storage   │ DB Connections│
  ├────────────┼──────────┼───────────┼──────────────┤
  │ Free       │ 100/min  │ 1 GB      │ 5            │
  │ Pro        │ 1000/min │ 50 GB     │ 20           │
  │ Enterprise │ 10K/min  │ 500 GB    │ 100          │
  └────────────┴──────────┴───────────┴──────────────┘
```

**3. Query Isolation**

```
Connection pool per tenant (or per tier):

  ┌──────────────────────────────────────┐
  │         Connection Pool Manager       │
  │                                      │
  │  Enterprise tenants: 50 connections  │
  │  Pro tenants:        10 connections  │
  │  Free tenants:       shared pool(20) │
  └──────────────────────────────────────┘
```

---

## Tenant-Aware Data Isolation

### Approach 1: Shared Tables with tenant_id

```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    total DECIMAL(10,2),
    created_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_tenant ON orders (tenant_id, created_at);

-- EVERY query MUST include tenant_id
SELECT * FROM orders WHERE tenant_id = $1 AND created_at > $2;
```

**Risk:** A missing `WHERE tenant_id = ?` leaks data across tenants.

**Mitigation: Row-Level Security (PostgreSQL)**

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
    USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Application sets tenant context per request:
SET app.current_tenant = 'tenant_abc123';
SELECT * FROM orders;  -- automatically filtered by tenant
```

### Approach 2: Schema per Tenant

```
Database: myapp
  ├── schema: tenant_abc
  │   ├── orders
  │   ├── users
  │   └── products
  ├── schema: tenant_def
  │   ├── orders
  │   ├── users
  │   └── products
  └── schema: shared
      ├── tenants
      └── billing
```

### Approach 3: Database per Tenant

```
  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
  │  db_tenant_abc │  │  db_tenant_def │  │  db_tenant_ghi │
  │  ┌──────────┐  │  │  ┌──────────┐  │  │  ┌──────────┐  │
  │  │ orders   │  │  │  │ orders   │  │  │  │ orders   │  │
  │  │ users    │  │  │  │ users    │  │  │  │ users    │  │
  │  └──────────┘  │  │  └──────────┘  │  │  └──────────┘  │
  └────────────────┘  └────────────────┘  └────────────────┘
```

| Strategy | Isolation | Cost | Migration | Cross-Tenant Queries |
|----------|----------|------|-----------|---------------------|
| Shared table | Low | Low | Easy | Easy |
| Schema per tenant | Medium | Medium | Per-schema | Possible |
| DB per tenant | High | High | Per-DB | Hard |

---

## Tenant-Aware Routing

```
┌────────┐     ┌──────────────┐     ┌──────────────────┐
│ Client │────▶│  API Gateway  │────▶│  Tenant Router   │
│        │     │  (extract     │     │                  │
│        │     │   tenant_id)  │     │  Enterprise ──▶ dedicated pool│
└────────┘     └──────────────┘     │  Pro ──▶ shared pool A  │
                                    │  Free ──▶ shared pool B │
                                    └──────────────────┘

Tenant ID from:
  - JWT claim: {"tenant_id": "abc123"}
  - Subdomain: abc123.myapp.com
  - Header: X-Tenant-ID: abc123
  - API key prefix: tk_abc123_xxxxx
```

```typescript
interface TenantContext {
    tenantId: string;
    tier: "free" | "pro" | "enterprise";
    region: string;
    dbConnectionString: string;
}

function resolveTenant(request: Request): TenantContext {
    const tenantId = extractTenantId(request);
    if (!tenantId) {
        throw new UnauthorizedError("Missing tenant identifier");
    }

    const config = tenantConfigCache.get(tenantId);
    if (!config) {
        throw new NotFoundError(`Unknown tenant: ${tenantId}`);
    }

    return {
        tenantId: config.id,
        tier: config.tier,
        region: config.region,
        dbConnectionString: config.dbUrl,
    };
}

function extractTenantId(request: Request): string | null {
    const fromHeader = request.headers.get("X-Tenant-ID");
    if (fromHeader) return fromHeader;

    const host = request.headers.get("Host") ?? "";
    const subdomain = host.split(".")[0];
    if (subdomain && subdomain !== "www" && subdomain !== "api") {
        return subdomain;
    }

    return null;
}
```

---

## Back-of-Envelope: Multi-Tenant Costs

```
1000 tenants, shared pool model:

  Compute: 10 app servers × $200/month = $2,000
  Database: 1 PostgreSQL cluster (primary + 2 replicas) = $1,500
  Cache: 1 Redis cluster = $500
  Total: $4,000/month
  Per tenant: $4/month

vs Silo model (1000 separate deployments):

  Compute: 1000 × 1 server × $50/month = $50,000
  Database: 1000 × $20/month = $20,000
  Total: $70,000/month
  Per tenant: $70/month

Shared is 17x cheaper. But an Enterprise tenant paying $10K/month
probably expects dedicated infrastructure.
```

---

## Exercises

1. Implement tenant-aware middleware in Go that extracts tenant ID
   from JWT claims, validates it, and injects a tenant context into
   the request.

2. Set up PostgreSQL row-level security for a multi-tenant orders
   table. Verify that queries without a tenant context return zero rows.

3. Design a tenant routing system that sends Enterprise tenants to
   dedicated database instances and pools Free/Pro tenants together.
   Draw the architecture.

4. Calculate: you have 500 tenants, 80% free, 15% pro, 5% enterprise.
   Enterprise tenants generate 60% of revenue but 40% of load. Design
   an infrastructure allocation strategy.

---

*Next: [Lesson 30 — Geo-Distributed Systems](./30-geo-distributed-systems.md),
where we build systems that span continents and handle data sovereignty.*
