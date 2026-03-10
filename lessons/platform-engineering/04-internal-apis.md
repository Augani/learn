# Lesson 04: Internal APIs & SDKs

## The Vending Machine Analogy

A good vending machine has clear buttons, shows what's available, tells you
the price, and gives you exactly what you selected. You don't need to
understand how the refrigeration works or where the inventory is stored.

A bad vending machine has unlabeled buttons, eats your money sometimes, and
occasionally gives you the wrong item. You learn to avoid it and go to the
store down the street instead.

Internal platform APIs are vending machines for infrastructure. When they
work well, developers press a button and get a database, a deployment, or
a certificate. When they don't, developers go around the platform entirely.

```
  PLATFORM API AS A VENDING MACHINE:

  Developer                    Platform API                Infrastructure
  +----------+                +------------------+        +-------------+
  |  "I need |   POST /db    | Validate request |        |             |
  |  a       |-------------->| Check quotas     |------->| Provision   |
  |  database"|               | Provision infra  |        | PostgreSQL  |
  |          |   201 Created | Configure access  |<-------| Configure   |
  |          |<--------------| Return connection |        | backups     |
  +----------+                +------------------+        +-------------+
      |
      | Response:
      | {
      |   "host": "pg-abc123.internal",
      |   "port": 5432,
      |   "secret_path": "vault://secrets/pg-abc123"
      | }
```

## Designing Platform APIs

Platform APIs serve a different audience than external APIs. Your consumers
are internal developers who will use these APIs daily. They'll read your
source code when the docs are wrong. They'll complain in Slack when
something breaks. Design accordingly.

### API Design Principles for Internal Platforms

**Intent-based, not mechanism-based.** The API should express what the
developer wants, not how the platform achieves it.

```
  BAD (mechanism-based):
  POST /terraform/apply
  {
    "module": "rds",
    "vars": {
      "engine": "postgres",
      "instance_class": "db.t3.medium",
      "allocated_storage": 50,
      "multi_az": true,
      "backup_retention_period": 7,
      "vpc_security_group_ids": ["sg-abc123"],
      "db_subnet_group_name": "private-subnet-group"
    }
  }

  GOOD (intent-based):
  POST /databases
  {
    "name": "payments-db",
    "engine": "postgresql",
    "size": "medium",
    "environment": "production"
  }
```

The intent-based API hides the 15 Terraform variables behind meaningful
abstractions. The developer says "I want a medium production PostgreSQL
database" and the platform translates that into the right Terraform
configuration, security groups, subnet placement, backup policies, and
monitoring.

**Consistent resource model.** Every resource in your platform should follow
the same patterns:

```
  PLATFORM API RESOURCE MODEL:

  POST   /v1/{resources}              Create a resource
  GET    /v1/{resources}              List resources
  GET    /v1/{resources}/{id}         Get a resource
  PATCH  /v1/{resources}/{id}         Update a resource
  DELETE /v1/{resources}/{id}         Delete a resource
  GET    /v1/{resources}/{id}/status  Get provisioning status

  Applied consistently:

  POST   /v1/databases               Create database
  POST   /v1/caches                  Create cache
  POST   /v1/queues                  Create message queue
  POST   /v1/certificates            Create TLS certificate
  POST   /v1/dns-records             Create DNS record
```

**Async with status tracking.** Infrastructure provisioning takes time. Don't
make developers poll. Use async patterns:

```
  ASYNC PROVISIONING FLOW:

  1. Developer creates resource:
     POST /v1/databases
     Response: 202 Accepted
     {
       "id": "db-abc123",
       "status": "provisioning",
       "status_url": "/v1/databases/db-abc123/status"
     }

  2. Platform provisions asynchronously:
     +--------+     +-----------+     +---------+     +----------+
     | Create |---->| Provision |---->| Config  |---->| Ready    |
     | record |     | infra     |     | access  |     | notify   |
     +--------+     +-----------+     +---------+     +----------+

  3. Developer gets notified (webhook or poll):
     GET /v1/databases/db-abc123/status
     {
       "id": "db-abc123",
       "status": "ready",
       "connection": {
         "host": "pg-abc123.internal",
         "port": 5432,
         "secret_path": "vault://secrets/db/db-abc123"
       },
       "provisioned_at": "2025-01-15T10:30:00Z"
     }
```

### Platform API Implementation

Here's a Go implementation of a platform API for database provisioning:

```go
package platform

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DatabaseSize string

const (
	DatabaseSizeSmall  DatabaseSize = "small"
	DatabaseSizeMedium DatabaseSize = "medium"
	DatabaseSizeLarge  DatabaseSize = "large"
)

type DatabaseEngine string

const (
	DatabaseEnginePostgres DatabaseEngine = "postgresql"
	DatabaseEngineMySQL    DatabaseEngine = "mysql"
)

type DatabaseStatus string

const (
	DatabaseStatusProvisioning DatabaseStatus = "provisioning"
	DatabaseStatusReady        DatabaseStatus = "ready"
	DatabaseStatusFailed       DatabaseStatus = "failed"
	DatabaseStatusDeleting     DatabaseStatus = "deleting"
)

type CreateDatabaseRequest struct {
	Name        string         `json:"name" binding:"required,alphanum_hyphen,max=63"`
	Engine      DatabaseEngine `json:"engine" binding:"required,oneof=postgresql mysql"`
	Size        DatabaseSize   `json:"size" binding:"required,oneof=small medium large"`
	Environment string         `json:"environment" binding:"required,oneof=staging production"`
	Team        string         `json:"team" binding:"required"`
	Backup      *BackupConfig  `json:"backup,omitempty"`
}

type BackupConfig struct {
	Enabled   bool   `json:"enabled"`
	Retention string `json:"retention"`
}

type DatabaseResponse struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Engine      DatabaseEngine `json:"engine"`
	Size        DatabaseSize   `json:"size"`
	Environment string         `json:"environment"`
	Team        string         `json:"team"`
	Status      DatabaseStatus `json:"status"`
	Connection  *Connection    `json:"connection,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	StatusURL   string         `json:"status_url"`
}

type Connection struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	SecretPath string `json:"secret_path"`
}

type DatabaseHandler struct {
	provisioner Provisioner
	store       DatabaseStore
	quotas      QuotaService
}

func (h *DatabaseHandler) Create(c *gin.Context) {
	var req CreateDatabaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": fmt.Sprintf("Validation failed: %v", err),
		})
		return
	}

	allowed, err := h.quotas.Check(c.Request.Context(), req.Team, "database")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "quota_check_failed"})
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "quota_exceeded",
			"message": fmt.Sprintf("Team %s has reached database quota", req.Team),
		})
		return
	}

	dbID := fmt.Sprintf("db-%s", uuid.New().String()[:8])

	db := &Database{
		ID:          dbID,
		Name:        req.Name,
		Engine:      req.Engine,
		Size:        req.Size,
		Environment: req.Environment,
		Team:        req.Team,
		Status:      DatabaseStatusProvisioning,
		CreatedAt:   time.Now(),
	}

	if err := h.store.Save(c.Request.Context(), db); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "storage_failed"})
		return
	}

	go h.provisionAsync(context.Background(), db)

	c.JSON(http.StatusAccepted, DatabaseResponse{
		ID:          db.ID,
		Name:        db.Name,
		Engine:      db.Engine,
		Size:        db.Size,
		Environment: db.Environment,
		Team:        db.Team,
		Status:      db.Status,
		CreatedAt:   db.CreatedAt,
		StatusURL:   fmt.Sprintf("/v1/databases/%s/status", db.ID),
	})
}

func (h *DatabaseHandler) provisionAsync(ctx context.Context, db *Database) {
	result, err := h.provisioner.Provision(ctx, db)
	if err != nil {
		db.Status = DatabaseStatusFailed
		db.FailureReason = err.Error()
		h.store.Save(ctx, db)
		return
	}

	db.Status = DatabaseStatusReady
	db.Connection = &Connection{
		Host:       result.Host,
		Port:       result.Port,
		SecretPath: fmt.Sprintf("vault://secrets/db/%s", db.ID),
	}
	h.store.Save(ctx, db)
}
```

## CLI Tools for Developers

APIs are great for automation. But for daily developer workflows, a CLI
provides a better experience. Your platform CLI wraps the platform API
with ergonomic commands.

```
  PLATFORM CLI INTERACTION:

  $ platform db create \
      --name payments-db \
      --engine postgresql \
      --size medium \
      --env production

  Creating database payments-db...
  Status: provisioning ⠋

  Database created successfully!
  ID:          db-abc123
  Host:        pg-abc123.internal
  Port:        5432
  Secret Path: vault://secrets/db/db-abc123

  Connection string saved to vault. Access with:
  $ platform secrets get db/db-abc123
```

### CLI Design Principles

**Consistent verb-noun pattern.** Every command follows the same structure:

```
  platform <resource> <action> [flags]

  platform db create --name mydb --engine postgresql
  platform db list --team payments
  platform db status db-abc123
  platform db delete db-abc123

  platform cache create --name mycache --engine redis
  platform cache list --team payments

  platform secret get db/db-abc123
  platform secret rotate db/db-abc123

  platform service create --template go-microservice --name my-service
  platform service list --team payments
  platform service logs my-service --env production
```

**Rich output with machine-readable option.** Human-friendly by default, but
support JSON output for scripting:

```
  $ platform db list --team payments
  NAME           ENGINE       SIZE     STATUS   CREATED
  payments-db    postgresql   medium   ready    2025-01-15
  payments-cache redis        small    ready    2025-01-10
  analytics-db   postgresql   large    ready    2024-12-01

  $ platform db list --team payments --output json
  [
    {
      "name": "payments-db",
      "engine": "postgresql",
      "size": "medium",
      "status": "ready",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
```

**Interactive prompts for missing required fields.** If a developer forgets
a flag, prompt instead of erroring:

```
  $ platform db create
  ? Database name: payments-db
  ? Engine (postgresql/mysql): postgresql
  ? Size (small/medium/large): medium
  ? Environment (staging/production): production
  ? Team: payments

  Creating database payments-db...
```

### CLI Implementation with Cobra

```go
package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var dbCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new database",
	Long:  "Provision a new managed database through the platform",
	RunE:  runDBCreate,
}

func init() {
	dbCmd.AddCommand(dbCreateCmd)
	dbCreateCmd.Flags().StringP("name", "n", "", "Database name")
	dbCreateCmd.Flags().StringP("engine", "e", "postgresql", "Database engine")
	dbCreateCmd.Flags().StringP("size", "s", "small", "Database size")
	dbCreateCmd.Flags().String("env", "staging", "Target environment")
	dbCreateCmd.Flags().String("team", "", "Owning team")
	dbCreateCmd.Flags().StringP("output", "o", "text", "Output format (text/json)")
}

func runDBCreate(cmd *cobra.Command, args []string) error {
	name, _ := cmd.Flags().GetString("name")
	if name == "" {
		name = promptString("Database name")
	}

	engine, _ := cmd.Flags().GetString("engine")
	size, _ := cmd.Flags().GetString("size")
	env, _ := cmd.Flags().GetString("env")
	team, _ := cmd.Flags().GetString("team")

	if team == "" {
		team = detectTeamFromContext()
		if team == "" {
			team = promptString("Team")
		}
	}

	client := newPlatformClient()
	resp, err := client.CreateDatabase(cmd.Context(), CreateDatabaseRequest{
		Name:        name,
		Engine:      engine,
		Size:        size,
		Environment: env,
		Team:        team,
	})
	if err != nil {
		return fmt.Errorf("failed to create database: %w", err)
	}

	output, _ := cmd.Flags().GetString("output")
	if output == "json" {
		return printJSON(resp)
	}

	fmt.Printf("Database created successfully!\n")
	fmt.Printf("ID:          %s\n", resp.ID)
	fmt.Printf("Status:      %s\n", resp.Status)
	fmt.Printf("Status URL:  %s\n", resp.StatusURL)

	if resp.Status == "provisioning" {
		fmt.Printf("\nCheck status with: platform db status %s\n", resp.ID)
	}

	return nil
}
```

## Self-Service Provisioning

The combination of APIs and CLI tools enables true self-service. But
self-service needs guardrails — quotas, policies, and approval workflows
for expensive or sensitive resources.

```
  SELF-SERVICE WITH GUARDRAILS:

  Developer Request
       |
       v
  +----------+     +-----------+     +----------+     +---------+
  | Validate |---->| Check     |---->| Check    |---->| Auto-   |
  | input    |     | quotas    |     | policies |     | approve |
  +----------+     +-----------+     +----------+     +---------+
       |                |                 |                |
       v                v                 v                v
  [400 Bad        [403 Quota         [Needs human    [202 Start
   Request]        exceeded]          approval]       provisioning]
                                          |
                                          v
                                    +-----------+
                                    | Notify    |
                                    | approver  |
                                    | via Slack |
                                    +-----------+
```

### Policy Engine

Use Open Policy Agent (OPA) to enforce platform policies:

```rego
package platform.database

default allow := false

allow {
    input.size == "small"
    input.environment == "staging"
}

allow {
    input.size == "small"
    input.environment == "production"
    quota_available
}

allow {
    input.size != "small"
    input.environment == "production"
    quota_available
    approval_granted
}

quota_available {
    current := data.quotas[input.team].databases
    limit := data.limits[input.team].databases
    current < limit
}

approval_granted {
    some approval in data.approvals
    approval.resource_id == input.id
    approval.approved == true
    time.now_ns() < approval.expires_ns
}

reasons[msg] {
    not quota_available
    msg := sprintf("Team %s has reached their database quota", [input.team])
}

reasons[msg] {
    input.size != "small"
    input.environment == "production"
    not approval_granted
    msg := "Large production databases require team lead approval"
}
```

## API Versioning for Internal Consumers

Internal APIs need versioning too. Your consumers are internal, but they
still depend on your API contract. Breaking changes without warning erode
trust.

```
  VERSIONING STRATEGY:

  /v1/databases    <-- Current stable API
  /v2/databases    <-- Next version (in development or early adoption)

  Lifecycle:
  +----------+     +----------+     +----------+     +----------+
  | v1 (GA)  |---->| v2 (beta)|---->| v2 (GA)  |---->| v1       |
  | current  |     | opt-in   |     | current  |     | deprecated|
  +----------+     +----------+     +----------+     +----------+
                                                          |
                                                     6 month sunset
                                                          |
                                                          v
                                                     +----------+
                                                     | v1       |
                                                     | removed  |
                                                     +----------+
```

### Deprecation Communication

```yaml
deprecation_policy:
  announcement: "6 months before removal"
  communication_channels:
    - engineering_newsletter
    - slack_platform_channel
    - deprecation_header_in_api_responses
    - backstage_api_catalog_annotation

  api_headers:
    deprecated_endpoint:
      Deprecation: "Sun, 01 Jun 2025 00:00:00 GMT"
      Sunset: "Mon, 01 Dec 2025 00:00:00 GMT"
      Link: "<https://platform.internal/docs/migration/v1-to-v2>; rel=\"successor-version\""

  migration_support:
    - migration_guide_published: true
    - office_hours_scheduled: true
    - automated_migration_tool: true
    - usage_tracking: "identify teams still on v1"
```

### SDK Generation

For frequently used platform APIs, generate client SDKs from the API
specification. This reduces integration friction:

```yaml
openapi: "3.0.3"
info:
  title: Platform Database API
  version: "1.0.0"

paths:
  /v1/databases:
    post:
      operationId: createDatabase
      summary: Create a managed database
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateDatabaseRequest"
      responses:
        "202":
          description: Database provisioning started
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DatabaseResponse"
        "400":
          description: Invalid request
        "403":
          description: Quota exceeded or policy violation
```

Generate clients for the languages your teams use:

```bash
openapi-generator generate \
  -i platform-api.yaml \
  -g go \
  -o sdk/go/platform \
  --additional-properties=packageName=platform

openapi-generator generate \
  -i platform-api.yaml \
  -g typescript-fetch \
  -o sdk/typescript/platform
```

Now teams integrate with the platform using a type-safe, documented SDK
instead of hand-written HTTP calls.

## Exercises

1. **API inventory.** List every manual infrastructure process at your
   organization (database creation, DNS updates, certificate requests).
   Design an intent-based API endpoint for each.

2. **Build a platform CLI command.** Pick one of the APIs from exercise 1
   and implement a CLI command for it using Cobra (Go) or Click (Python).
   Include interactive prompts for missing fields.

3. **Policy design.** Write OPA policies for three scenarios: quota
   enforcement, size-based approval gates, and environment restrictions
   (e.g., no large databases in staging).

4. **Versioning plan.** You need to add a breaking change to your database
   API (splitting the `size` field into `cpu` and `memory`). Write a
   migration plan with timeline, communication, and backward compatibility.
