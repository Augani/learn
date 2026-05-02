# Lesson 13: Attribute-Based Access Control (ABAC)

> **The one thing to remember**: ABAC makes access decisions based
> on attributes — properties of the user, the resource, the action,
> and the environment. Instead of "Editors can edit posts," ABAC says
> "Users in the Engineering department can edit documents they own,
> during business hours, from the corporate network." It's more
> complex than RBAC, but far more expressive.

---

## The Hospital Analogy

```
WHY RBAC ISN'T ALWAYS ENOUGH

  Hospital access control with RBAC:
    Role "Doctor" → can view patient records

  But the REAL rules are:
    - Doctors can view records of THEIR patients only
    - ER doctors can view any record during emergencies
    - Records older than 7 years require department head approval
    - Psychiatric records need extra clearance
    - Access is only allowed from hospital network OR approved VPN
    - Residents can view but not modify records

  You'd need hundreds of roles to model this with RBAC:
    "ER-Doctor-On-Duty", "Psychiatrist-With-Clearance",
    "Resident-Internal-Network", ...

  ABAC handles this naturally by evaluating ATTRIBUTES:
    - User attributes: role=doctor, department=ER, clearance=high
    - Resource attributes: patient=assigned, type=psychiatric, age=3years
    - Environment attributes: time=14:30, network=hospital-wifi
    - Action: view (not modify)
```

---

## ABAC Components

```
ABAC DECISION MODEL

  ┌──────────────────┐
  │ ACCESS REQUEST    │
  │                   │
  │ Subject: Alice    │
  │ Action:  read     │
  │ Resource: Doc #42 │
  │ Environment: now  │
  └────────┬──────────┘
           │
           ▼
  ┌────────────────────────────────────────────────┐
  │              POLICY ENGINE                      │
  │                                                 │
  │  Subject         Resource        Environment    │
  │  Attributes      Attributes      Attributes     │
  │  ┌───────────┐   ┌───────────┐  ┌───────────┐  │
  │  │ role:     │   │ owner:    │  │ time:     │  │
  │  │  engineer │   │  alice    │  │  14:30    │  │
  │  │ dept:     │   │ status:   │  │ ip:       │  │
  │  │  backend  │   │  draft    │  │  10.0.1.5 │  │
  │  │ clearance:│   │ class:    │  │ device:   │  │
  │  │  secret   │   │  internal │  │  laptop   │  │
  │  └───────────┘   └───────────┘  └───────────┘  │
  │                                                 │
  │  POLICIES:                                      │
  │  "Engineers can read internal docs they own"     │
  │  "Secret docs require 'secret' clearance"        │
  │  "Draft docs only accessible on corp network"    │
  │                                                 │
  │  DECISION: ✓ ALLOW                              │
  └────────────────────────────────────────────────┘
```

The four attribute categories:

```
ATTRIBUTE CATEGORIES

  SUBJECT attributes (who is requesting):
  ┌────────────────────────────────────────┐
  │ user_id, role, department, clearance,  │
  │ tenure, location, team, manager        │
  └────────────────────────────────────────┘

  RESOURCE attributes (what is being accessed):
  ┌────────────────────────────────────────┐
  │ owner, type, classification, status,   │
  │ department, created_date, sensitivity  │
  └────────────────────────────────────────┘

  ACTION attributes (what operation):
  ┌────────────────────────────────────────┐
  │ read, write, delete, approve, share,   │
  │ export, print                          │
  └────────────────────────────────────────┘

  ENVIRONMENT attributes (context):
  ┌────────────────────────────────────────┐
  │ time, date, ip_address, device_type,   │
  │ network, geolocation, risk_score       │
  └────────────────────────────────────────┘
```

---

## Writing ABAC Policies

Policies are rules that combine attributes to make decisions:

```python
def can_access_document(subject, resource, action, environment):
    # Policy 1: Users can read their own documents
    if (action == "read"
            and resource.owner_id == subject.user_id):
        return True

    # Policy 2: Managers can read all documents in their department
    if (action == "read"
            and subject.role == "manager"
            and resource.department == subject.department):
        return True

    # Policy 3: Anyone can read published public documents
    if (action == "read"
            and resource.status == "published"
            and resource.classification == "public"):
        return True

    # Policy 4: Only owners can edit draft documents
    if (action == "write"
            and resource.status == "draft"
            and resource.owner_id == subject.user_id):
        return True

    # Policy 5: Secret documents require clearance AND corp network
    if (resource.classification == "secret"):
        if (subject.clearance_level < resource.required_clearance):
            return False
        if (environment.network != "corporate"):
            return False

    # Policy 6: No modifications outside business hours
    if (action in ["write", "delete"]
            and not is_business_hours(environment.time)):
        return False

    # Default deny
    return False
```

---

## Policy Engines

For real applications, you don't hard-code policies in your app.
You use a policy engine — a separate system that evaluates policies:

```
POLICY ENGINE ARCHITECTURE

  Your Application            Policy Engine
  ──────────────────          ─────────────
       │                           │
       │ "Can Alice edit Doc #42?" │
       │ {                         │
       │   subject: {              │
       │     id: "alice",          │
       │     role: "engineer",     │
       │     dept: "backend"       │
       │   },                      │
       │   action: "write",        │
       │   resource: {             │
       │     id: "doc-42",         │
       │     owner: "alice",       │
       │     class: "internal"     │
       │   },                      │
       │   environment: {          │
       │     time: "14:30",        │
       │     network: "corporate"  │
       │   }                       │
       │ }                         │
       │──────────────────────────►│
       │                           │ Evaluate policies...
       │      { "allow": true }    │
       │◄──────────────────────────│
```

Popular policy engines:

```
POLICY ENGINES

  ┌──────────────┬──────────────────────────────────────────┐
  │ Engine       │ Description                              │
  ├──────────────┼──────────────────────────────────────────┤
  │ OPA          │ Open Policy Agent. General-purpose.      │
  │ (Rego)       │ Policies in Rego language. Very popular  │
  │              │ in Kubernetes and microservices.          │
  ├──────────────┼──────────────────────────────────────────┤
  │ Cedar        │ By AWS. Purpose-built for authorization. │
  │              │ Used in Amazon Verified Permissions.      │
  │              │ Fast, analyzable policies.                │
  ├──────────────┼──────────────────────────────────────────┤
  │ Casbin       │ Library for Go, Python, Java, etc.       │
  │              │ Supports RBAC, ABAC, and hybrid models.  │
  │              │ Easy to integrate, runs in-process.       │
  ├──────────────┼──────────────────────────────────────────┤
  │ Zanzibar     │ Google's authorization system.           │
  │ (SpiceDB,    │ Relationship-based (ReBAC). Open-source  │
  │  OpenFGA)    │ implementations: SpiceDB, OpenFGA.       │
  └──────────────┴──────────────────────────────────────────┘
```

### OPA (Open Policy Agent) Example

```rego
# policy.rego

package document.access

default allow = false

# Users can read their own documents
allow {
    input.action == "read"
    input.resource.owner == input.subject.id
}

# Managers can read documents in their department
allow {
    input.action == "read"
    input.subject.role == "manager"
    input.resource.department == input.subject.department
}

# Edits only during business hours
allow {
    input.action == "write"
    input.resource.owner == input.subject.id
    is_business_hours
}

is_business_hours {
    hour := time.clock(time.now_ns())[0]
    hour >= 9
    hour < 17
}
```

### Cedar Example

```
// Cedar policy

permit(
    principal in Role::"engineer",
    action == Action::"read",
    resource
) when {
    resource.department == principal.department
};

permit(
    principal,
    action == Action::"write",
    resource
) when {
    resource.owner == principal
    && resource.status == "draft"
};

forbid(
    principal,
    action,
    resource
) when {
    resource.classification == "secret"
    && !principal.clearance.contains("secret")
};
```

---

## RBAC vs ABAC: When to Use Which

```
DECISION GUIDE

  Use RBAC when:
  ├── Permissions are based on job function
  ├── You have a manageable number of roles (<20)
  ├── Access rules don't depend on resource properties
  ├── You need simplicity and auditability
  └── Example: "Admins can manage users, editors can edit posts"

  Use ABAC when:
  ├── Access depends on WHO owns the resource
  ├── Access depends on TIME, LOCATION, or CONTEXT
  ├── You need fine-grained, dynamic policies
  ├── RBAC would require too many roles (role explosion)
  └── Example: "Doctors can view their own patients' records
       during business hours from the hospital network"

  Use BOTH (hybrid) when:
  ├── You need RBAC's simplicity for basic access
  ├── PLUS ABAC's flexibility for special rules
  └── Example: RBAC for "editors can access the CMS" +
       ABAC for "editors can only edit their own articles
       unless they're a senior editor"
```

```
COMPLEXITY COMPARISON

  RBAC:
  Complexity: Low
  Setup time: Hours
  Maintenance: Easy (add roles, assign permissions)
  Debugging: Easy (check role → check permissions)

  ABAC:
  Complexity: High
  Setup time: Days to weeks
  Maintenance: Moderate (policies can interact unexpectedly)
  Debugging: Harder (which policy matched? why was access denied?)
```

---

## Implementing Hybrid RBAC + ABAC

Most real systems use a hybrid approach:

```python
def authorize(subject, action, resource, environment):
    # Layer 1: RBAC check (fast, covers most cases)
    if not rbac_check(subject.roles, action, resource.type):
        return False

    # Layer 2: ABAC policies (contextual rules)
    policies = get_policies_for(resource.type, action)

    for policy in policies:
        result = evaluate_policy(policy, subject, action, resource, environment)
        if result == "deny":
            return False

    return True

def rbac_check(roles, action, resource_type):
    permission_needed = f"{resource_type}:{action}"
    for role in roles:
        if permission_needed in role.permissions:
            return True
    return False
```

```
HYBRID DECISION FLOW

  Request comes in
       │
       ▼
  ┌─────────────┐    No
  │ RBAC: Does  │──────────► 403 Forbidden
  │ role allow  │
  │ this action?│
  └──────┬──────┘
         │ Yes
         ▼
  ┌─────────────┐    No
  │ ABAC: Do    │──────────► 403 Forbidden
  │ contextual  │
  │ policies    │
  │ allow it?   │
  └──────┬──────┘
         │ Yes
         ▼
    ✓ ALLOW
```

---

## Exercises

1. **Policy design**: Write ABAC policies for a file sharing system
   (like Google Drive) that handles: personal files, shared files,
   public links, expiring share links, and organization-wide files.
   What attributes do you need for subjects, resources, and
   environment?

2. **RBAC limitation**: Design a scenario where RBAC alone would
   require more than 30 roles. Then show how ABAC handles the same
   scenario with fewer than 5 policies.

3. **Build it**: Using Casbin or a similar library in your language,
   implement a policy engine that supports: role-based access, owner
   checks (users can only edit their own resources), and time-based
   restrictions (no deletions on weekends).

4. **Debugging exercise**: Given these policies and this access
   request, determine whether access should be allowed:
   - Policy 1: Engineers can read internal documents
   - Policy 2: Only owners can edit draft documents
   - Policy 3: No access to secret documents without clearance
   - Request: Alice (engineer, no clearance) wants to read Doc #99
     (internal, secret, owned by Bob)
   Which policies apply? What's the final decision?

---

[Next: Lesson 14 — Multi-Factor Authentication](./14-mfa.md)
