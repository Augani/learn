# Lesson 18: RBAC — Role-Based Access Control

## The Big Picture

Think of an office building with key card access. There are several moving
parts:

- **Authentication** (who are you?): you swipe your badge at the door. The
  system checks if you're an employee. It doesn't care what you want to do —
  it's just verifying your identity.

- **Role** (what doors can this card type open?): "Engineering" cards can open
  the engineering lab, the cafeteria, and the parking garage. "Finance" cards
  can open the finance office, the cafeteria, and the board room.

- **RoleBinding** (giving someone a card): Alice gets an "Engineering" card.
  Now Alice can access engineering areas. Bob gets a "Finance" card. Charlie
  gets both (he works cross-functionally).

- **ServiceAccount** (automated systems): the mail-delivery robot has its own
  badge. It can access the mailroom and hallways, but not engineering labs or
  finance offices. It's not a person — it's a machine with specific
  permissions.

In Kubernetes, RBAC controls who (users, groups, ServiceAccounts) can do what
(get, create, delete) to which resources (Pods, Services, Secrets) in which
namespaces.

---

## Prerequisites

- Lesson 08 (Namespaces)
- Lesson 06 (ConfigMaps and Secrets)

```bash
kind create cluster --name rbac-lab
```

---

## Authentication: Who Are You?

Before Kubernetes checks what you can do, it needs to know who you are.
Kubernetes doesn't have a built-in user database. Instead, it supports multiple
authentication mechanisms:

### Client Certificates

The most common for cluster administrators. Your kubeconfig contains a client
certificate signed by the cluster's CA.

```bash
kubectl config view
```

You'll see something like:

```yaml
users:
- name: kind-rbac-lab
  user:
    client-certificate-data: <base64-encoded cert>
    client-key-data: <base64-encoded key>
```

The certificate contains a Common Name (CN) which becomes your username, and
Organization (O) fields which become your group memberships.

### ServiceAccount Tokens

Pods authenticate using ServiceAccount tokens. Every Pod gets a token
automatically mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token`.

### OIDC Tokens

Production clusters often use OpenID Connect (Google, Azure AD, Okta) for human
users. The cluster is configured to trust tokens from an OIDC provider.

### Key Point

Kubernetes doesn't manage users. It trusts external identity providers
(certificates, OIDC, tokens). It only manages what authenticated identities can
do. That's RBAC.

---

## The RBAC Model

```
User/ServiceAccount  ──→  RoleBinding  ──→  Role  ──→  Permissions
     (who)              (connects them)   (what can be done)
```

### Role: What Can Be Done

A Role defines a set of permissions (called rules) in a specific namespace:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: default
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "watch", "list"]
```

This Role says: "In the `default` namespace, you can get, watch, and list
Pods."

### ClusterRole: Cluster-Wide Permissions

A ClusterRole is like a Role but works across all namespaces, or for
cluster-scoped resources (nodes, namespaces themselves):

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: secret-reader
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "watch", "list"]
```

### RoleBinding: Giving Someone a Card

A RoleBinding grants a Role to a user, group, or ServiceAccount within a
specific namespace:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: default
subjects:
- kind: User
  name: alice
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

### ClusterRoleBinding: Building-Wide Card

A ClusterRoleBinding grants a ClusterRole across the entire cluster:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: read-secrets-everywhere
subjects:
- kind: Group
  name: security-team
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: secret-reader
  apiGroup: rbac.authorization.k8s.io
```

### The Four Resources

| Resource | Scope | Purpose |
|----------|-------|---------|
| Role | Namespace | Define permissions within a namespace |
| ClusterRole | Cluster | Define permissions cluster-wide |
| RoleBinding | Namespace | Grant Role/ClusterRole to subjects in a namespace |
| ClusterRoleBinding | Cluster | Grant ClusterRole to subjects across all namespaces |

**Useful trick**: a RoleBinding can reference a ClusterRole. This gives the
subject those permissions but only in the RoleBinding's namespace. This lets
you define a ClusterRole once and bind it in multiple namespaces.

---

## API Groups and Verbs

### API Groups

Resources belong to API groups. Here are the common ones:

| API Group | Resources |
|-----------|-----------|
| `""` (core) | pods, services, secrets, configmaps, namespaces, nodes |
| `apps` | deployments, statefulsets, daemonsets, replicasets |
| `batch` | jobs, cronjobs |
| `networking.k8s.io` | ingresses, networkpolicies |
| `rbac.authorization.k8s.io` | roles, rolebindings, clusterroles |
| `autoscaling` | horizontalpodautoscalers |

### Verbs

| Verb | HTTP Method | Meaning |
|------|-------------|---------|
| `get` | GET (single) | Read a specific resource |
| `list` | GET (collection) | List all resources |
| `watch` | GET (streaming) | Watch for changes |
| `create` | POST | Create a resource |
| `update` | PUT | Update a resource |
| `patch` | PATCH | Partially update a resource |
| `delete` | DELETE | Delete a resource |
| `deletecollection` | DELETE | Delete multiple resources |

### Common Permission Sets

**Read-only**:
```yaml
verbs: ["get", "list", "watch"]
```

**Read-write**:
```yaml
verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

**Everything** (use sparingly):
```yaml
verbs: ["*"]
```

---

## ServiceAccounts: Identity for Pods

Every Pod runs as a ServiceAccount. If you don't specify one, it uses the
`default` ServiceAccount in its namespace.

### The Default ServiceAccount Problem

The `default` ServiceAccount in each namespace has minimal permissions. But in
some clusters, it might have more than you think. The principle of least
privilege says: create dedicated ServiceAccounts for your apps with only the
permissions they need.

### Create a ServiceAccount

```yaml
# file: rbac-demo.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-reader
  namespace: default
```

### Create a Role

```yaml
# appended to rbac-demo.yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-configmap-reader
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
```

### Bind the Role to the ServiceAccount

```yaml
# appended to rbac-demo.yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-reader-binding
  namespace: default
subjects:
- kind: ServiceAccount
  name: app-reader
  namespace: default
roleRef:
  kind: Role
  name: pod-configmap-reader
  apiGroup: rbac.authorization.k8s.io
```

### Use the ServiceAccount in a Pod

```yaml
# appended to rbac-demo.yaml
---
apiVersion: v1
kind: Pod
metadata:
  name: rbac-test
spec:
  serviceAccountName: app-reader
  containers:
  - name: kubectl
    image: bitnami/kubectl:latest
    command: ["sleep", "infinity"]
```

```bash
kubectl apply -f rbac-demo.yaml
kubectl wait --for=condition=ready pod/rbac-test --timeout=60s
```

### Test the Permissions

```bash
kubectl exec rbac-test -- kubectl get pods
```

Works — the ServiceAccount has `get, list, watch` on Pods.

```bash
kubectl exec rbac-test -- kubectl get configmaps
```

Works — the ServiceAccount has `get, list` on ConfigMaps.

```bash
kubectl exec rbac-test -- kubectl get secrets
```

```
Error from server (Forbidden): secrets is forbidden: User
"system:serviceaccount:default:app-reader" cannot list resource
"secrets" in API group "" in the namespace "default"
```

Denied. The ServiceAccount doesn't have permissions on Secrets. This is RBAC
working as intended.

```bash
kubectl exec rbac-test -- kubectl delete pod rbac-test
```

```
Error from server (Forbidden): pods "rbac-test" is forbidden: User
"system:serviceaccount:default:app-reader" cannot delete resource
"pods" in API group "" in the namespace "default"
```

Denied. The ServiceAccount can read Pods but not delete them.

---

## Testing Permissions: kubectl auth can-i

You can check permissions without actually executing commands:

```bash
kubectl auth can-i get pods --as system:serviceaccount:default:app-reader
```
```
yes
```

```bash
kubectl auth can-i delete pods --as system:serviceaccount:default:app-reader
```
```
no
```

```bash
kubectl auth can-i get secrets --as system:serviceaccount:default:app-reader
```
```
no
```

The `--as` flag impersonates a user or ServiceAccount. Very useful for testing
RBAC without creating test Pods.

### Check All Permissions

```bash
kubectl auth can-i --list --as system:serviceaccount:default:app-reader
```

Shows every permission the ServiceAccount has.

---

## Real-World RBAC Patterns

### Pattern 1: Namespace Admin

Give a team full control over their namespace but nothing else:

```yaml
# file: team-admin.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: team-alpha
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: team-alpha-admin
  namespace: team-alpha
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: team-alpha-admin-binding
  namespace: team-alpha
subjects:
- kind: ServiceAccount
  name: team-alpha-admin
  namespace: team-alpha
roleRef:
  kind: ClusterRole
  name: admin
  apiGroup: rbac.authorization.k8s.io
```

The built-in `admin` ClusterRole gives full access to most namespace resources.
Binding it in a specific namespace restricts it to that namespace.

### Pattern 2: CI/CD Deployer

A ServiceAccount for your CI/CD pipeline that can only deploy apps:

```yaml
# file: deployer.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ci-deployer
  namespace: production
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: deployer
  namespace: production
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
- apiGroups: [""]
  resources: ["services", "configmaps"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ci-deployer-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: ci-deployer
  namespace: production
roleRef:
  kind: Role
  name: deployer
  apiGroup: rbac.authorization.k8s.io
```

The deployer can create/update Deployments and Services but can't delete them
or access Secrets beyond reading. Principle of least privilege.

### Pattern 3: Monitoring Reader

A ServiceAccount for Prometheus that needs read access to everything across all
namespaces:

```yaml
# file: monitoring.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus
  namespace: monitoring
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus-reader
rules:
- apiGroups: [""]
  resources: ["pods", "services", "endpoints", "nodes"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["nodes/metrics"]
  verbs: ["get"]
- nonResourceURLs: ["/metrics"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: prometheus-reader-binding
subjects:
- kind: ServiceAccount
  name: prometheus
  namespace: monitoring
roleRef:
  kind: ClusterRole
  name: prometheus-reader
  apiGroup: rbac.authorization.k8s.io
```

Notice `nonResourceURLs` — this grants access to URL paths that aren't standard
resources, like the `/metrics` endpoint on the API server.

### Pattern 4: Restricted Pod Security

A ServiceAccount that can create Pods but only with specific constraints:

```yaml
# file: restricted-creator.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: restricted-pod-creator
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "create"]
  resourceNames: []
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get"]
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: []
```

This role can create and read Pods, read Pod logs, but cannot `exec` into Pods.
This prevents someone from creating a Pod and then using `kubectl exec` to get a
shell, which is a common escalation vector.

---

## Built-in ClusterRoles

Kubernetes comes with several built-in ClusterRoles:

| ClusterRole | Permissions |
|-------------|-------------|
| `cluster-admin` | Everything (superuser) |
| `admin` | Full access within a namespace (no quota/RBAC modification) |
| `edit` | Read/write most namespace resources (no Roles/RoleBindings) |
| `view` | Read-only access to most namespace resources (no Secrets) |

```bash
kubectl get clusterroles | grep -E "^(cluster-admin|admin|edit|view)\s"
```

```bash
kubectl describe clusterrole view
```

Using built-in roles saves time. Bind `view` for read-only users, `edit` for
developers, `admin` for team leads.

---

## Aggregated ClusterRoles

Kubernetes can automatically combine permissions from multiple ClusterRoles
using label-based aggregation. The built-in roles use this:

```bash
kubectl get clusterrole admin -o yaml | grep -A 5 aggregationRule
```

```yaml
aggregationRule:
  clusterRoleSelectors:
  - matchLabels:
      rbac.authorization.k8s.io/aggregate-to-admin: "true"
```

Any ClusterRole with the label `rbac.authorization.k8s.io/aggregate-to-admin:
"true"` automatically has its permissions added to the `admin` ClusterRole.

This is useful when installing CRDs (Custom Resource Definitions) — you can
create a ClusterRole for your custom resources and label it to aggregate into
the built-in roles.

---

## Securing Pod ServiceAccounts

### Disable Auto-Mounting Tokens

By default, every Pod gets a ServiceAccount token mounted. If your app doesn't
call the Kubernetes API, disable this:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: no-api-access
spec:
  automountServiceAccountToken: false
  containers:
  - name: app
    image: my-app
```

Or disable it on the ServiceAccount itself:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: no-api-sa
automountServiceAccountToken: false
```

### Token Audience and Expiry

Modern Kubernetes uses bound service account tokens with limited lifetime and
audience:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: bound-token-pod
spec:
  serviceAccountName: app-reader
  containers:
  - name: app
    image: my-app
    volumeMounts:
    - name: token
      mountPath: /var/run/secrets/tokens
  volumes:
  - name: token
    projected:
      sources:
      - serviceAccountToken:
          audience: my-api-server
          expirationSeconds: 3600
          path: token
```

The token is only valid for 1 hour and only for the specified audience. Much
more secure than the default long-lived tokens.

---

## Relating to Go/TypeScript Patterns

### Go: Middleware Authorization

In Go web apps, you check permissions in middleware:

```go
func requireRole(role string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            user := getUserFromContext(r.Context())
            if !user.HasRole(role) {
                http.Error(w, "forbidden", http.StatusForbidden)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

Kubernetes RBAC does the same thing at the API server level. Every API request
goes through authentication → authorization (RBAC check) → admission →
execution. The Role is like your `requireRole("admin")` middleware.

### TypeScript: JWT Claims

In Express/Node, you might check JWT claims:

```typescript
const authorize = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const claims = verifyJWT(req.headers.authorization);
    const hasPermission = requiredPermissions.every(
      (perm) => claims.permissions.includes(perm)
    );
    if (!hasPermission) return res.status(403).json({ error: "forbidden" });
    next();
  };
};

app.get("/users", authorize(["users:read"]), getUsers);
app.post("/users", authorize(["users:write"]), createUser);
```

RBAC rules are the Kubernetes equivalent of `["users:read"]` permission arrays.
The verb + resource mapping is exactly like `users:read` → `get pods`.

### ServiceAccounts = API Keys

A ServiceAccount token is functionally equivalent to an API key in your apps.
You create a key, give it specific scopes, and your service uses it to
authenticate. Same pattern, different level of the stack.

---

## Exercises

### Exercise 1: Progressive Permission Escalation

1. Create a ServiceAccount with no permissions
2. Deploy a Pod using it with kubectl installed
3. Try `kubectl get pods` — observe the Forbidden error
4. Add a Role allowing `get, list` on Pods, bind it
5. Try again — observe success
6. Try `kubectl delete pod <name>` — observe Forbidden
7. Add `delete` verb, try again — observe success
8. Document each step's minimal permission set

### Exercise 2: Namespace Isolation

1. Create two namespaces: `team-a` and `team-b`
2. Create a ServiceAccount in `team-a`
3. Grant it `admin` access in `team-a`
4. Deploy a Pod with kubectl in `team-a` using that ServiceAccount
5. Verify full access to `team-a` resources
6. Verify zero access to `team-b` resources
7. Verify zero access to cluster-scoped resources (nodes)

### Exercise 3: CI/CD Service Account

1. Create a `ci-deployer` ServiceAccount
2. Grant it permissions to:
   - Create/update Deployments
   - Create/update Services
   - Read (but not modify) Secrets
   - Cannot delete anything
   - Cannot exec into Pods
3. Test each allowed and denied action with `kubectl auth can-i --as`
4. Deploy a test Pod as the CI/CD user and verify it can deploy

### Exercise 4: Audit Permissions

1. List all ClusterRoleBindings: `kubectl get clusterrolebindings`
2. Find which subjects have `cluster-admin`
3. Check the `default` ServiceAccount's permissions in each namespace
4. Identify any overly permissive bindings
5. Create a "security report" of your cluster's RBAC configuration

### Exercise 5: Break and Fix

1. Deploy an app that reads ConfigMaps from the Kubernetes API
2. Give it a ServiceAccount with `get` on ConfigMaps
3. Break it by removing the RoleBinding
4. Observe the app failing with 403 errors
5. Fix it by recreating the binding
6. Add auditing: make the app log what API calls it makes and whether they
   succeed

---

## What Would Happen If...

**Q: A Pod doesn't specify a ServiceAccount?**
A: It uses the `default` ServiceAccount in its namespace. In most clusters,
the `default` ServiceAccount has minimal permissions. But always check — some
cluster setups give it more than expected.

**Q: You create a RoleBinding in namespace A that references a ServiceAccount
in namespace B?**
A: It works. The ServiceAccount in namespace B gets the Role's permissions in
namespace A. This is how cross-namespace access is granted.

**Q: You delete a RoleBinding but not the Role?**
A: The Role exists but nobody has it. No effect until you create a new
RoleBinding. Roles are just definitions — they don't grant access on their own.

**Q: Two Roles grant different permissions and both are bound to the same
ServiceAccount?**
A: Permissions are additive (union). If Role A grants `get pods` and Role B
grants `create pods`, the ServiceAccount can do both. There's no "deny" in
RBAC — you can only add permissions, never remove them.

**Q: You give a Pod the `cluster-admin` ClusterRole?**
A: That Pod can do absolutely everything in the cluster — create, delete,
modify any resource, even escalate its own permissions. This is extremely
dangerous. Never do this in production. If the Pod is compromised, the attacker
owns the cluster.

**Q: Someone creates a Role that grants `create` on Roles and RoleBindings?**
A: Privilege escalation risk. They could create a new Role with any permissions
and bind it to themselves. Kubernetes has some safeguards (you can only grant
permissions you already have), but this is still dangerous. Guard RBAC
resources carefully.

---

## Key Takeaways

1. **RBAC = who can do what to which resources**: Roles define permissions,
   Bindings grant them to subjects
2. **Roles are namespace-scoped**, ClusterRoles are cluster-wide
3. **ServiceAccounts are Pod identities**: create dedicated ones, don't use
   `default`
4. **Permissions are additive**: no deny rules, only allow. Union of all
   bound Roles
5. **Principle of least privilege**: start with no permissions, add only what's
   needed
6. **`kubectl auth can-i`**: your RBAC debugging tool
7. **Disable auto-mount tokens**: if your Pod doesn't call the Kubernetes API,
   don't give it a token
8. **Built-in roles**: use `view`, `edit`, `admin` before creating custom ones

---

## Cleanup

```bash
kubectl delete -f rbac-demo.yaml 2>/dev/null
kubectl delete -f team-admin.yaml 2>/dev/null
kubectl delete namespace team-alpha 2>/dev/null
kind delete cluster --name rbac-lab
```

---

Next: [Lesson 19: Observability →](./19-observability.md)
