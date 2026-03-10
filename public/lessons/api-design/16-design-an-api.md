# Lesson 16: Design an API (Capstone)

> Design a complete API for a real product.
> Apply everything from the previous 15 lessons.

---

## The Project: A Task Management API

Design and implement an API for a collaborative task
management application (like a simplified Asana/Linear).

```
  FEATURES:
  +---------------------------------------------------+
  | Workspaces (multi-tenant)                          |
  | Projects within workspaces                         |
  | Tasks within projects                              |
  | Task assignments, labels, due dates                |
  | Comments on tasks                                  |
  | Real-time updates via webhooks                     |
  | API key and OAuth authentication                   |
  +---------------------------------------------------+
```

---

## Step 1: Resource Modeling

```
  RESOURCES AND RELATIONSHIPS:

  Workspace
    |-- has many --> Project
    |-- has many --> Member (User + role)
    |
    Project
      |-- has many --> Task
      |-- has many --> Label
      |
      Task
        |-- belongs to --> Assignee (User)
        |-- has many --> Label (many-to-many)
        |-- has many --> Comment
        |-- has one --> Parent Task (subtasks)
        |
        Comment
          |-- belongs to --> Author (User)

  URL HIERARCHY:
  /workspaces/{ws_id}
  /workspaces/{ws_id}/projects
  /workspaces/{ws_id}/projects/{proj_id}
  /workspaces/{ws_id}/projects/{proj_id}/tasks
  /workspaces/{ws_id}/projects/{proj_id}/tasks/{task_id}
  /workspaces/{ws_id}/projects/{proj_id}/tasks/{task_id}/comments

  SHORTCUT (for cross-project access):
  /tasks/{task_id}
  /tasks/{task_id}/comments
```

---

## Step 2: Endpoint Design

```
  TASKS ENDPOINTS:

  LIST TASKS:
  GET /workspaces/{ws_id}/projects/{proj_id}/tasks
  Query params:
    ?status=open,in_progress
    &assignee=user_123
    &label=bug,urgent
    &due_before=2024-02-01
    &sort=due_date
    &order=asc
    &after=task_abc     (cursor pagination)
    &limit=50
    &fields=id,title,status,assignee

  Response:
  {
    "data": [
      {
        "id": "task_abc",
        "title": "Fix login bug",
        "status": "open",
        "priority": "high",
        "assignee": {
          "id": "user_123",
          "name": "Alice"
        },
        "labels": [
          {"id": "lbl_1", "name": "bug", "color": "#ff0000"}
        ],
        "due_date": "2024-01-20",
        "created_at": "2024-01-10T08:00:00Z",
        "updated_at": "2024-01-15T14:30:00Z"
      }
    ],
    "pagination": {
      "next_cursor": "task_def",
      "has_more": true
    }
  }

  CREATE TASK:
  POST /workspaces/{ws_id}/projects/{proj_id}/tasks
  {
    "title": "Implement search",
    "description": "Add full-text search to the API",
    "status": "open",
    "priority": "medium",
    "assignee_id": "user_123",
    "label_ids": ["lbl_1", "lbl_2"],
    "due_date": "2024-02-15",
    "parent_task_id": null
  }

  Response: 201 Created
  Location: /tasks/task_xyz

  UPDATE TASK:
  PATCH /tasks/{task_id}
  {
    "status": "in_progress",
    "assignee_id": "user_456"
  }

  Response: 200 OK (full task object)

  DELETE TASK:
  DELETE /tasks/{task_id}
  Response: 204 No Content
```

---

## Step 3: Authentication & Authorization

```
  TWO AUTH METHODS:

  1. API KEY (for integrations/scripts):
  Authorization: Bearer tsk_live_abc123...

  2. OAUTH 2.0 (for user-facing apps):
  Authorization: Bearer eyJhbGciOiJSUz...

  AUTHORIZATION MODEL:
  +----------+------+------+--------+--------+
  | Action   | Owner| Admin| Member | Viewer |
  +----------+------+------+--------+--------+
  | Create   | YES  | YES  | YES    | NO     |
  | Read     | YES  | YES  | YES    | YES    |
  | Update   | YES  | YES  | OWN*   | NO     |
  | Delete   | YES  | YES  | NO     | NO     |
  | Manage   | YES  | YES  | NO     | NO     |
  | members  |      |      |        |        |
  +----------+------+------+--------+--------+
  * Members can update tasks assigned to them

  SCOPES FOR OAUTH:
  tasks:read      - Read tasks
  tasks:write     - Create/update tasks
  projects:read   - Read projects
  projects:write  - Create/update projects
  workspace:admin - Full workspace management
```

---

## Step 4: Error Handling

```
  RFC 7807 ERROR RESPONSES:

  VALIDATION ERROR (422):
  {
    "type": "https://api.taskflow.io/errors/validation",
    "title": "Validation Error",
    "status": 422,
    "detail": "Request body contains invalid fields",
    "errors": [
      {
        "field": "title",
        "code": "required",
        "message": "Title is required"
      },
      {
        "field": "due_date",
        "code": "invalid_format",
        "message": "Must be ISO 8601 date (YYYY-MM-DD)"
      }
    ]
  }

  NOT FOUND (404):
  {
    "type": "https://api.taskflow.io/errors/not-found",
    "title": "Not Found",
    "status": 404,
    "detail": "Task task_xyz does not exist"
  }

  RATE LIMITED (429):
  {
    "type": "https://api.taskflow.io/errors/rate-limit",
    "title": "Rate Limit Exceeded",
    "status": 429,
    "detail": "You have exceeded 100 requests per minute"
  }
  Headers:
    Retry-After: 32
    X-RateLimit-Limit: 100
    X-RateLimit-Remaining: 0
    X-RateLimit-Reset: 1705000032
```

---

## Step 5: Versioning

```
  URL PATH VERSIONING:
  /api/v1/tasks
  /api/v2/tasks

  VERSIONING POLICY:
  - v1 supported for 12 months after v2 launch
  - Breaking changes ONLY in new major version
  - Non-breaking additions in current version
  - Deprecation warnings in response headers:
    Sunset: Sat, 01 Jan 2025 00:00:00 GMT
    Deprecation: true

  WHAT'S A BREAKING CHANGE:
  +-- Removing a field              BREAKING
  +-- Renaming a field              BREAKING
  +-- Changing a field type         BREAKING
  +-- Removing an endpoint          BREAKING
  +-- Adding a required field       BREAKING
  +-- Adding an optional field      NOT BREAKING
  +-- Adding a new endpoint         NOT BREAKING
  +-- Adding a new enum value       NOT BREAKING
```

---

## Step 6: Webhooks

```
  WEBHOOK EVENTS:
  task.created
  task.updated
  task.deleted
  task.assigned
  task.completed
  comment.created
  project.created
  member.added
  member.removed

  REGISTRATION:
  POST /workspaces/{ws_id}/webhooks
  {
    "url": "https://myapp.com/hooks/taskflow",
    "events": ["task.created", "task.completed"],
    "secret": "whsec_..."
  }

  DELIVERY:
  POST https://myapp.com/hooks/taskflow
  X-Webhook-Signature: sha256=abc123
  X-Webhook-ID: evt_789
  {
    "id": "evt_789",
    "type": "task.completed",
    "workspace_id": "ws_1",
    "created_at": "2024-01-15T14:30:00Z",
    "data": {
      "task": {
        "id": "task_abc",
        "title": "Fix login bug",
        "status": "completed",
        "completed_by": {"id": "user_123", "name": "Alice"},
        "completed_at": "2024-01-15T14:30:00Z"
      }
    }
  }
```

---

## Step 7: Rate Limiting

```
  RATE LIMITS:
  +-------------------+-----------+-----------+
  | Plan              | Per Minute| Per Day   |
  +-------------------+-----------+-----------+
  | Free              | 60        | 10,000    |
  | Pro               | 300       | 100,000   |
  | Enterprise        | 1,000     | Unlimited |
  +-------------------+-----------+-----------+

  RESPONSE HEADERS (on every response):
  X-RateLimit-Limit: 300
  X-RateLimit-Remaining: 247
  X-RateLimit-Reset: 1705000060

  SPECIAL LIMITS:
  Bulk operations: 10 per minute
  File uploads: 100 per hour
  Webhook registrations: 20 per workspace
```

---

## Step 8: OpenAPI Specification (Excerpt)

```yaml
openapi: 3.1.0
info:
  title: TaskFlow API
  version: "1.0"
  description: Collaborative task management API

servers:
  - url: https://api.taskflow.io/v1

paths:
  /workspaces/{ws_id}/projects/{proj_id}/tasks:
    get:
      summary: List tasks in a project
      operationId: listTasks
      parameters:
        - name: ws_id
          in: path
          required: true
          schema:
            type: string
        - name: proj_id
          in: path
          required: true
          schema:
            type: string
        - name: status
          in: query
          schema:
            type: string
            enum: [open, in_progress, completed, cancelled]
        - name: after
          in: query
          schema:
            type: string
          description: Cursor for pagination
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
      responses:
        "200":
          description: List of tasks
          headers:
            X-RateLimit-Remaining:
              schema:
                type: integer
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/Task"
                  pagination:
                    $ref: "#/components/schemas/Pagination"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "429":
          $ref: "#/components/responses/RateLimited"

components:
  schemas:
    Task:
      type: object
      required: [id, title, status, created_at]
      properties:
        id:
          type: string
        title:
          type: string
        description:
          type: string
          nullable: true
        status:
          type: string
          enum: [open, in_progress, completed, cancelled]
        priority:
          type: string
          enum: [low, medium, high, urgent]
        assignee:
          $ref: "#/components/schemas/UserSummary"
          nullable: true
        due_date:
          type: string
          format: date
          nullable: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
    Pagination:
      type: object
      properties:
        next_cursor:
          type: string
          nullable: true
        has_more:
          type: boolean
```

---

## Step 9: Performance Considerations

```
  CACHING STRATEGY:
  +-----------------------------+--------------------------+
  | Endpoint                    | Cache-Control            |
  +-----------------------------+--------------------------+
  | GET /tasks/{id}             | private, max-age=10      |
  | GET /tasks (list)           | private, max-age=5       |
  | GET /projects               | private, max-age=30      |
  | GET /workspaces             | private, max-age=60      |
  +-----------------------------+--------------------------+
  All support ETags for conditional requests.

  DATABASE INDEXES:
  - tasks: (project_id, status, due_date)
  - tasks: (assignee_id, status)
  - comments: (task_id, created_at)
  - tasks: (workspace_id, updated_at) for cursor pagination

  EAGER LOADING:
  Task list includes assignee and labels (no N+1).
  Task detail includes recent comments (last 10).
```

---

## Exercises

### Exercise 1: Implement the Core

Build the Tasks CRUD endpoints with:
1. List with filtering, sorting, cursor pagination
2. Create with validation
3. Update (PATCH for partial updates)
4. Delete with soft-delete
5. Proper error responses (RFC 7807)

### Exercise 2: Add Authentication

Implement API key authentication:
1. Generate API keys (store hashed)
2. Validate on every request
3. Rate limit per API key
4. Return proper 401/403 errors

### Exercise 3: Add Webhooks

Implement the webhook system:
1. Register webhook subscriptions
2. Publish events on task changes
3. Verify signatures on the consumer side
4. Implement retry with exponential backoff

### Exercise 4: SDK Design

Design a Python SDK for your API:
```python
from taskflow import TaskFlowClient

client = TaskFlowClient(api_key="tsk_live_abc123")

tasks = client.tasks.list(
    workspace_id="ws_1",
    project_id="proj_1",
    status=["open", "in_progress"],
    limit=25,
)

for task in tasks:
    print(f"{task.title} - {task.status}")

new_task = client.tasks.create(
    workspace_id="ws_1",
    project_id="proj_1",
    title="New feature",
    priority="high",
)
```

---

## Design Review Checklist

```
  REVIEW YOUR API AGAINST THESE:

  [ ] Resources are nouns, actions are HTTP methods
  [ ] Consistent naming (plural nouns, kebab-case)
  [ ] Proper status codes for every response
  [ ] RFC 7807 error format with actionable details
  [ ] Cursor pagination for list endpoints
  [ ] Field selection support (?fields=id,name)
  [ ] Filtering and sorting
  [ ] ETag and Cache-Control headers
  [ ] Rate limiting with proper headers
  [ ] Authentication (API key + OAuth)
  [ ] Authorization (role-based access)
  [ ] Versioned URL (/v1/)
  [ ] Webhook support for state changes
  [ ] OpenAPI spec is complete and accurate
  [ ] Idempotency keys for POST/PUT
  [ ] CORS headers for browser clients
  [ ] Compression (gzip/brotli)
```

---

## Key Takeaways

```
  1. Start with resource modeling, not endpoints
  2. URL hierarchy reflects resource relationships
  3. PATCH for partial updates, PUT for full replacement
  4. Cursor pagination for all list endpoints
  5. RFC 7807 for all error responses
  6. Rate limit by plan tier with proper headers
  7. Webhooks for real-time integrations
  8. OpenAPI spec is the source of truth
  9. Cache headers and ETags from day one
  10. Design the SDK experience first, API second
```
