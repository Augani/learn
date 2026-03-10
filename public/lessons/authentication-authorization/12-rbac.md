# Lesson 12: Role-Based Access Control (RBAC)

> **The one thing to remember**: RBAC assigns permissions to roles,
> then assigns roles to users. Instead of saying "Alice can read
> reports, write reports, and delete reports," you say "Alice is a
> Manager, and Managers can read, write, and delete reports." When
> you hire a new manager, you just assign the role — not dozens of
> individual permissions.

---

## The Restaurant Analogy

```
RBAC IS LIKE RESTAURANT STAFF ROLES

  WITHOUT RBAC (direct permissions):
  ┌─────────────────────────────────────────────────────┐
  │ Alice: can cook, can serve, can order supplies,     │
  │        can close the register, can lock up          │
  │ Bob:   can cook, can order supplies                 │
  │ Carol: can serve, can close the register            │
  │ Dave:  can cook, can serve, can close the register  │
  │                                                     │
  │ New hire Eve does the same job as Carol.             │
  │ Manually copy all of Carol's permissions to Eve.     │
  │ Hope you don't miss any.                            │
  └─────────────────────────────────────────────────────┘

  WITH RBAC (role-based):
  ┌─────────────────────────────────────────────────────┐
  │ ROLES:                                              │
  │   Chef:    can cook, can order supplies             │
  │   Server:  can serve, can close the register        │
  │   Manager: can cook, can serve, can order supplies, │
  │            can close the register, can lock up      │
  │                                                     │
  │ ASSIGNMENTS:                                        │
  │   Alice → Manager                                   │
  │   Bob   → Chef                                      │
  │   Carol → Server                                    │
  │   Dave  → Chef + Server                             │
  │                                                     │
  │ New hire Eve? Just assign "Server." Done.           │
  └─────────────────────────────────────────────────────┘
```

---

## The Three Components

```
RBAC COMPONENTS

  ┌─────────┐         ┌─────────┐         ┌──────────────┐
  │  USERS  │────────►│  ROLES  │────────►│ PERMISSIONS  │
  └─────────┘  has    └─────────┘  has    └──────────────┘
               role(s)             permission(s)

  User:       A person or system (alice, bob, api-service)
  Role:       A named collection of permissions (admin, editor, viewer)
  Permission: A specific allowed action (posts:write, users:delete)

  Users NEVER have permissions directly.
  Users have ROLES. Roles have PERMISSIONS.
  This indirection is what makes RBAC manageable.
```

---

## Database Schema for RBAC

```sql
-- Users table (you probably already have this)
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Roles table
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

-- Permissions table
CREATE TABLE permissions (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

-- Many-to-many: users <-> roles
CREATE TABLE user_roles (
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id     INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    granted_at  TIMESTAMP DEFAULT NOW(),
    granted_by  INTEGER REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

-- Many-to-many: roles <-> permissions
CREATE TABLE role_permissions (
    role_id       INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
```

```
DATABASE SCHEMA DIAGRAM

  users              user_roles           roles
  ┌──────────┐      ┌──────────────┐     ┌────────────┐
  │ id       │──┐   │ user_id (FK) │  ┌──│ id         │
  │ email    │  └──►│ role_id (FK) │──┘  │ name       │
  │ name     │      │ granted_at   │     │ description│
  └──────────┘      │ granted_by   │     └─────┬──────┘
                    └──────────────┘           │
                                              │
                    role_permissions      permissions
                    ┌──────────────┐     ┌────────────┐
                    │ role_id (FK) │──┐  │ id         │
                    │ perm_id (FK) │  └──│ name       │
                    └──────────────┘     │ description│
                                        └────────────┘
```

Seed data example:

```sql
INSERT INTO roles (name, description) VALUES
    ('admin',  'Full system access'),
    ('editor', 'Can create and edit content'),
    ('viewer', 'Read-only access');

INSERT INTO permissions (name, description) VALUES
    ('posts:read',   'View blog posts'),
    ('posts:write',  'Create and edit blog posts'),
    ('posts:delete', 'Delete blog posts'),
    ('users:read',   'View user profiles'),
    ('users:write',  'Edit user profiles'),
    ('users:delete', 'Delete user accounts');

-- Admin gets everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin';

-- Editor gets post read/write and user read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'editor'
  AND p.name IN ('posts:read', 'posts:write', 'users:read');

-- Viewer gets read-only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'viewer'
  AND p.name IN ('posts:read', 'users:read');
```

---

## Checking Permissions

The core question: "Does this user have permission X?"

```python
def user_has_permission(user_id, permission_name):
    query = """
        SELECT COUNT(*) > 0
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = %s AND p.name = %s
    """
    result = database.execute(query, (user_id, permission_name))
    return result[0][0]

def get_user_permissions(user_id):
    query = """
        SELECT DISTINCT p.name
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = %s
    """
    rows = database.execute(query, (user_id,))
    return {row[0] for row in rows}
```

---

## Middleware Implementation

In a web application, you typically check permissions in middleware:

```javascript
function requirePermission(permission) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const hasPermission = await checkUserPermission(
            req.user.id,
            permission
        );

        if (!hasPermission) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

app.get('/api/posts',
    authMiddleware,
    requirePermission('posts:read'),
    (req, res) => {
        // User is authenticated AND has posts:read permission
    }
);

app.delete('/api/posts/:id',
    authMiddleware,
    requirePermission('posts:delete'),
    (req, res) => {
        // Only users with posts:delete permission reach here
    }
);
```

**Important**: Note the HTTP status codes:
- **401 Unauthorized** = Not authenticated (who are you?)
- **403 Forbidden** = Authenticated but not authorized (you can't do this)

These are often confused, but they mean different things.

---

## Role Hierarchies

In many systems, roles form a hierarchy where higher roles inherit
permissions from lower roles:

```
ROLE HIERARCHY

              ┌───────┐
              │ Admin │
              └───┬───┘
                  │ inherits
              ┌───┴───┐
              │Manager│
              └───┬───┘
                  │ inherits
           ┌──────┴──────┐
           │             │
       ┌───┴───┐     ┌──┴──┐
       │Editor │     │Viewer│
       └───────┘     └─────┘

  Admin has:   Admin permissions + Manager + Editor + Viewer
  Manager has: Manager permissions + Editor + Viewer
  Editor has:  Editor permissions + Viewer
  Viewer has:  Viewer permissions only
```

Implementation with a parent reference:

```sql
ALTER TABLE roles ADD COLUMN parent_role_id INTEGER REFERENCES roles(id);

UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'viewer')
WHERE name = 'editor';

UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'editor')
WHERE name = 'manager';

UPDATE roles SET parent_role_id = (SELECT id FROM roles WHERE name = 'manager')
WHERE name = 'admin';
```

```python
def get_role_permissions_with_hierarchy(role_id):
    query = """
        WITH RECURSIVE role_tree AS (
            SELECT id, parent_role_id FROM roles WHERE id = %s
            UNION ALL
            SELECT r.id, r.parent_role_id
            FROM roles r
            JOIN role_tree rt ON r.id = rt.parent_role_id
        )
        SELECT DISTINCT p.name
        FROM role_tree rt
        JOIN role_permissions rp ON rt.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
    """
    rows = database.execute(query, (role_id,))
    return {row[0] for row in rows}
```

---

## Permission Naming Conventions

```
NAMING PATTERN: resource:action

  EXAMPLES:
  posts:read        posts:write       posts:delete
  users:read        users:write       users:delete
  comments:read     comments:write    comments:moderate
  billing:view      billing:manage
  settings:read     settings:write

  ALTERNATIVE PATTERN: resource:action:scope

  posts:read:own      ← Only your own posts
  posts:read:all      ← All posts
  posts:write:own     ← Only edit your own
  posts:write:all     ← Edit anyone's posts

  This gives you fine-grained control:
  An editor can edit their own posts (posts:write:own)
  A manager can edit anyone's posts (posts:write:all)
```

---

## Caching Permissions

Querying the database for every permission check is expensive.
Cache user permissions after loading them:

```python
import json
import redis

r = redis.Redis()
CACHE_TTL = 300  # 5 minutes

def get_user_permissions_cached(user_id):
    cache_key = f"user:{user_id}:permissions"
    cached = r.get(cache_key)

    if cached:
        return json.loads(cached)

    permissions = get_user_permissions_from_db(user_id)
    r.setex(cache_key, CACHE_TTL, json.dumps(list(permissions)))
    return permissions

def invalidate_user_permissions(user_id):
    r.delete(f"user:{user_id}:permissions")
```

**Invalidation triggers**: Clear the cache when:
- A user's roles change
- A role's permissions change
- A role in the user's hierarchy changes

---

## Common Patterns and Pitfalls

```
RBAC BEST PRACTICES

  DO:
  ✓ Start with a few broad roles (admin, member, viewer)
  ✓ Add granular roles as needs emerge
  ✓ Use permission names, not role names, in code
  ✓ Cache permissions aggressively
  ✓ Log permission changes for audit trails
  ✓ Allow users to have multiple roles

  DON'T:
  ✗ Check role names in code: if user.role == "admin"
    (Check permissions instead — roles change, permissions are stable)
  ✗ Create a role per user (that's just direct permissions with extra steps)
  ✗ Start with 50 granular roles (role explosion)
  ✗ Hardcode role IDs in application code
  ✗ Forget to handle "no roles assigned" gracefully
```

```
WRONG WAY vs RIGHT WAY

  ❌ WRONG: Checking roles in code
  if (user.role === 'admin' || user.role === 'editor') {
      allowEdit();
  }
  // What happens when you add a "content_manager" role?
  // You have to find and update every role check.

  ✓ RIGHT: Checking permissions in code
  if (userHasPermission(user.id, 'posts:write')) {
      allowEdit();
  }
  // Add "content_manager" role? Just give it posts:write permission.
  // No code changes needed.
```

---

## RBAC in JWT Tokens

You can embed role or permission information in JWT tokens to avoid
database lookups on every request:

```
EMBEDDING ROLES IN JWT

  Option A: Include role name
  {
    "sub": "42",
    "role": "editor",
    "exp": 1705316400
  }
  Pro: Small token
  Con: Need to resolve role → permissions on each request

  Option B: Include permissions
  {
    "sub": "42",
    "permissions": ["posts:read", "posts:write", "users:read"],
    "exp": 1705316400
  }
  Pro: No database lookup needed
  Con: Token grows with permissions, stale until refresh

  RECOMMENDATION:
  For most apps → Include role name, cache permission resolution.
  For microservices → Include permissions (each service checks locally).
```

---

## Exercises

1. **Design roles**: You're building a school management system with
   these users: students, teachers, department heads, and
   administrators. Design the roles, permissions, and hierarchy.
   What permissions does a teacher need that a student doesn't?

2. **Build it**: Implement the RBAC database schema, seed it with
   roles and permissions, and write middleware that checks permissions
   before allowing access to an endpoint.

3. **Permission check**: Given this scenario — a user has roles
   "editor" and "moderator" — write a SQL query that returns all
   unique permissions for this user. Handle the case where roles
   have overlapping permissions.

4. **Role explosion**: Your team has created 47 roles to handle
   different combinations of permissions. This is unmaintainable.
   How would you redesign this? (Hint: think about combining
   multiple roles per user vs creating a role for every combination.)

---

[Next: Lesson 13 — Attribute-Based Access Control](./13-abac.md)
