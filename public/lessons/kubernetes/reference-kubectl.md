# kubectl Cheat Sheet

This is your quick-reference card for `kubectl`. Think of it like the keyboard shortcuts poster you tape next to your monitor — you'll use it constantly until muscle memory takes over.

kubectl talks to the Kubernetes API server the same way `curl` talks to a REST API. Every command is ultimately an HTTP request to the API server. Knowing that helps when things break.

---

## Shortnames

Kubernetes resources have shortnames so you don't type `persistentvolumeclaim` fifty times a day.

| Full Name                | Short | Full Name            | Short  |
|--------------------------|-------|----------------------|--------|
| pods                     | po    | services             | svc    |
| deployments              | deploy| namespaces           | ns     |
| configmaps               | cm    | persistentvolumeclaims| pvc   |
| replicasets              | rs    | statefulsets         | sts    |
| daemonsets               | ds    | horizontalpodautoscalers | hpa |
| ingresses                | ing   | nodes                | no     |
| serviceaccounts          | sa    | storageclasses       | sc     |
| persistentvolumes        | pv    | networkpolicies      | netpol |
| cronjobs                 | cj    | endpoints            | ep     |

---

## Common Flags

These flags work with almost every command. Memorize them.

```bash
-n <namespace>          # target a specific namespace
-A                      # all namespaces
-o yaml                 # output as YAML (great for seeing full spec)
-o json                 # output as JSON (great for piping to jq)
-o wide                 # extra columns (node name, IP, etc.)
-o jsonpath='{...}'     # extract specific fields
-o name                 # just the resource type/name
--selector key=value    # filter by label (same as -l)
-l key=value            # filter by label
-w                      # watch for changes (like tail -f)
--dry-run=client        # preview what would happen without doing it
--all-namespaces        # same as -A
-f <file>               # specify a file
-R                      # recursive (process directories)
--field-selector        # filter by field (status.phase=Running)
--sort-by               # sort output (.metadata.creationTimestamp)
```

---

## Cluster Info and Context

Think of contexts like SSH profiles — each one stores a cluster address, user credentials, and default namespace. You switch between them the way you switch between AWS profiles.

```bash
kubectl cluster-info

kubectl config current-context

kubectl config get-contexts

kubectl config use-context my-cluster

kubectl config set-context --current --namespace=my-app

kubectl config view

kubectl config view --minify

kubectl config set-context my-ctx \
  --cluster=my-cluster \
  --user=my-user \
  --namespace=production

kubectl config delete-context old-context

kubectl config get-clusters

kubectl config set-credentials my-user --token=<token>

kubectl api-resources

kubectl api-versions

kubectl version --client

kubectl get componentstatuses
```

Practical pattern — quickly switch namespace without typing `-n` every time:

```bash
kubectl config set-context --current --namespace=staging
```

Now every command targets `staging` until you switch again. Like `cd`-ing into a directory.

---

## Getting Information (Read Operations)

These are your `ls` and `cat` equivalents. You'll use `get` and `describe` hundreds of times a day.

### List Resources

```bash
kubectl get pods

kubectl get po -n kube-system

kubectl get deploy,svc,po

kubectl get all

kubectl get po -o wide

kubectl get po -o yaml

kubectl get po -o json | jq '.items[].metadata.name'

kubectl get po --sort-by=.metadata.creationTimestamp

kubectl get po --field-selector=status.phase=Running

kubectl get po -l app=nginx

kubectl get po -l 'app in (nginx, redis)'

kubectl get po -l 'app!=frontend'

kubectl get po -w

kubectl get events --sort-by=.lastTimestamp

kubectl get no

kubectl get ns

kubectl get svc -A

kubectl get pvc

kubectl get cm

kubectl get secrets

kubectl get ing

kubectl get hpa

kubectl get netpol

kubectl get cj
```

### Describe (Detailed View)

`describe` is like `get` but with full details, events, and conditions. This is your first stop when debugging.

```bash
kubectl describe po my-pod

kubectl describe deploy my-deploy

kubectl describe svc my-service

kubectl describe no my-node

kubectl describe pvc my-claim

kubectl describe ing my-ingress

kubectl describe ns my-namespace
```

The events section at the bottom of `describe` output is gold for debugging. It tells you what happened and when.

### Resource Usage

```bash
kubectl top nodes

kubectl top pods

kubectl top pods -n my-namespace

kubectl top pods --sort-by=memory

kubectl top pods --sort-by=cpu

kubectl top pods -l app=nginx

kubectl top pod my-pod --containers
```

`top` requires the metrics-server to be installed. In kind:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

---

## Debugging

When something goes wrong (and it will), this is your toolkit.

### Logs

```bash
kubectl logs my-pod

kubectl logs my-pod -c my-container

kubectl logs my-pod --previous

kubectl logs my-pod -f

kubectl logs my-pod --tail=100

kubectl logs my-pod --since=1h

kubectl logs my-pod --since=5m

kubectl logs -l app=nginx

kubectl logs -l app=nginx --all-containers

kubectl logs deploy/my-deploy

kubectl logs job/my-job
```

### Exec (Shell Into Containers)

```bash
kubectl exec my-pod -- ls /app

kubectl exec my-pod -c my-container -- cat /etc/config

kubectl exec -it my-pod -- /bin/sh

kubectl exec -it my-pod -- /bin/bash

kubectl exec my-pod -- env

kubectl exec my-pod -- wget -qO- http://my-service:8080/health

kubectl exec my-pod -- nslookup my-service
```

### Port Forwarding

Maps a port on your laptop to a port in the cluster. Like an SSH tunnel.

```bash
kubectl port-forward pod/my-pod 8080:80

kubectl port-forward svc/my-service 8080:80

kubectl port-forward deploy/my-deploy 8080:80

kubectl port-forward pod/my-pod 8080:80 -n staging

kubectl port-forward pod/my-pod 8080:80 --address=0.0.0.0
```

Then hit `http://localhost:8080` in your browser.

### Copying Files

```bash
kubectl cp my-pod:/var/log/app.log ./app.log

kubectl cp ./config.yaml my-pod:/etc/config/config.yaml

kubectl cp my-pod:/data ./local-data -c my-container
```

### Debugging Nodes and DNS

```bash
kubectl run debug --image=busybox --rm -it --restart=Never -- /bin/sh

kubectl run debug --image=nicolaka/netshoot --rm -it --restart=Never -- /bin/bash

kubectl get endpoints my-service

kubectl run dns-test --image=busybox --rm -it --restart=Never -- nslookup my-service.default.svc.cluster.local
```

---

## Creating and Modifying Resources

### Apply and Delete

```bash
kubectl apply -f deployment.yaml

kubectl apply -f ./manifests/

kubectl apply -f ./manifests/ -R

kubectl apply -f https://raw.githubusercontent.com/.../manifest.yaml

kubectl delete -f deployment.yaml

kubectl delete po my-pod

kubectl delete po my-pod --grace-period=0 --force

kubectl delete deploy my-deploy

kubectl delete po -l app=nginx

kubectl delete all -l app=nginx

kubectl delete ns my-namespace

kubectl diff -f deployment.yaml
```

### Create Resources Imperatively

```bash
kubectl run nginx --image=nginx

kubectl run nginx --image=nginx --port=80

kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml

kubectl create deploy my-app --image=my-app:v1 --replicas=3

kubectl create deploy my-app --image=my-app:v1 --dry-run=client -o yaml > deploy.yaml

kubectl create svc clusterip my-svc --tcp=80:8080

kubectl create ns my-namespace

kubectl create cm my-config --from-literal=key=value

kubectl create cm my-config --from-file=config.yaml

kubectl create secret generic my-secret --from-literal=password=abc123

kubectl create job my-job --image=busybox -- echo "hello"

kubectl create cronjob my-cron --image=busybox --schedule="*/5 * * * *" -- echo "tick"
```

### Editing Live Resources

```bash
kubectl edit deploy my-deploy

kubectl patch deploy my-deploy -p '{"spec":{"replicas":5}}'

kubectl patch deploy my-deploy --type=json \
  -p='[{"op":"replace","path":"/spec/replicas","value":5}]'

kubectl replace -f deployment.yaml

kubectl replace --force -f deployment.yaml
```

---

## Scaling and Rollouts

### Scale

```bash
kubectl scale deploy my-deploy --replicas=5

kubectl scale deploy my-deploy --replicas=0

kubectl scale rs my-replicaset --replicas=3

kubectl autoscale deploy my-deploy --min=2 --max=10 --cpu-percent=80
```

### Rollouts

```bash
kubectl rollout status deploy my-deploy

kubectl rollout history deploy my-deploy

kubectl rollout history deploy my-deploy --revision=2

kubectl rollout undo deploy my-deploy

kubectl rollout undo deploy my-deploy --to-revision=2

kubectl rollout restart deploy my-deploy

kubectl rollout pause deploy my-deploy

kubectl rollout resume deploy my-deploy

kubectl set image deploy my-deploy app=my-app:v2

kubectl set image deploy my-deploy app=my-app:v2 --record
```

---

## Labels and Annotations

Labels are for selection (finding things). Annotations are for metadata (attaching notes).

### Labels

```bash
kubectl label po my-pod env=production

kubectl label po my-pod env=staging --overwrite

kubectl label po my-pod env-

kubectl label po -l app=nginx tier=frontend

kubectl get po -l env=production

kubectl get po -l 'env in (production, staging)'

kubectl get po -l env!=test

kubectl get po --show-labels
```

### Annotations

```bash
kubectl annotate po my-pod description="main web server"

kubectl annotate po my-pod description="updated description" --overwrite

kubectl annotate po my-pod description-

kubectl annotate deploy my-deploy kubernetes.io/change-cause="updated to v2"
```

---

## Quick Recipes

### Generate YAML without creating anything

```bash
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
kubectl create deploy app --image=app:v1 --dry-run=client -o yaml > deploy.yaml
kubectl create svc clusterip app-svc --tcp=80:8080 --dry-run=client -o yaml > svc.yaml
```

### Find what node a Pod is running on

```bash
kubectl get po -o wide
kubectl get po my-pod -o jsonpath='{.spec.nodeName}'
```

### Get all images running in a namespace

```bash
kubectl get po -n default -o jsonpath='{.items[*].spec.containers[*].image}' | tr ' ' '\n' | sort -u
```

### Watch Pods restart

```bash
kubectl get po -w
```

### Get all resources with a label

```bash
kubectl get all -l app=nginx
```

### Check resource quota usage

```bash
kubectl describe quota -n my-namespace
```

### See which RBAC rules a user has

```bash
kubectl auth can-i --list
kubectl auth can-i create pods
kubectl auth can-i delete deployments --namespace=production
```

---

## JSONPath Quick Reference

JSONPath lets you extract specific fields. Think of it like `jq` built into kubectl.

```bash
kubectl get po -o jsonpath='{.items[*].metadata.name}'

kubectl get po -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\n"}{end}'

kubectl get no -o jsonpath='{.items[*].status.addresses[?(@.type=="InternalIP")].address}'

kubectl get po -o jsonpath='{.items[0].spec.containers[0].image}'

kubectl get secret my-secret -o jsonpath='{.data.password}' | base64 -d
```

---

## Environment-Specific Tips

### kind (Kubernetes in Docker)

```bash
kind create cluster --name dev
kind create cluster --config kind-config.yaml
kind get clusters
kind delete cluster --name dev
kind load docker-image my-app:v1 --name dev
kubectl cluster-info --context kind-dev
```

### Working with multiple clusters

```bash
export KUBECONFIG=~/.kube/config:~/.kube/staging-config
kubectl config get-contexts
kubectl config use-context staging
```

### Useful aliases

```bash
alias k='kubectl'
alias kg='kubectl get'
alias kd='kubectl describe'
alias kl='kubectl logs'
alias ka='kubectl apply -f'
alias kx='kubectl exec -it'
alias kgp='kubectl get pods'
alias kgs='kubectl get svc'
alias kgd='kubectl get deploy'
alias kgn='kubectl get nodes'
alias kns='kubectl config set-context --current --namespace'
```

Put these in your `.zshrc` or `.bashrc`. Your future self will thank you.
