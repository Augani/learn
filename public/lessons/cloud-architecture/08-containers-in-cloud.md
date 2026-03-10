# Lesson 8: Containers in Cloud

## Connecting to the Docker & Kubernetes Tracks

This lesson bridges the Docker/K8s tracks with AWS container services.
If you have not done those tracks, review them first.

```
CONTAINER JOURNEY

  Docker Track          K8s Track           THIS LESSON
  +-----------+         +-----------+       +----------------+
  | Build     |-------->| Orchestrate|----->| Run on AWS     |
  | container |         | with K8s   |      | (ECS/EKS/      |
  | images    |         | locally    |      |  Fargate)      |
  +-----------+         +-----------+       +----------------+
```

## AWS Container Ecosystem

```
+----------------------------------------------------------+
|                AWS CONTAINER SERVICES                      |
+----------------------------------------------------------+
|                                                            |
|  REGISTRY        ORCHESTRATION         COMPUTE            |
|  +------+        +--------+           +---------+         |
|  | ECR  |------->| ECS    |---------->| EC2     |         |
|  | Store |       | (AWS   |    or     | (you    |         |
|  | images|       |  native)|          |  manage)|         |
|  +------+        +--------+           +---------+         |
|     |            +--------+           +---------+         |
|     +----------->| EKS    |---------->| Fargate |         |
|                  | (K8s   |    or     | (server-|         |
|                  |  managed)          |  less)  |         |
|                  +--------+           +---------+         |
|                                                            |
|  SUPPORTING: App Mesh (service mesh), Cloud Map (discovery)|
+----------------------------------------------------------+
```

## ECR: Container Registry

```
DOCKER HUB                          ECR (Elastic Container Registry)
+----------------------+            +-----------------------------+
| Public, anyone can   |            | Private, AWS-integrated     |
| pull. Rate limited.  |            | IAM-based auth. No limits.  |
+----------------------+            | Image scanning built-in.    |
                                    | Lifecycle policies.         |
                                    +-----------------------------+
```

### ECR with Terraform and CLI

```hcl
resource "aws_ecr_repository" "app" {
  name                 = "app"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
```

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

docker build -t app:v1.0 .

docker tag app:v1.0 \
  123456789.dkr.ecr.us-east-1.amazonaws.com/app:v1.0

docker push \
  123456789.dkr.ecr.us-east-1.amazonaws.com/app:v1.0
```

## ECS: AWS-Native Orchestration

```
ECS CONCEPTS

  Cluster = Logical grouping (the "fleet")
  Service = Long-running task definition + desired count
  Task    = Running instance of a task definition
  Task Definition = Blueprint (like docker-compose)

  +-------- ECS Cluster --------+
  |                              |
  |  Service: web (desired: 3)  |
  |  +------+ +------+ +------+ |
  |  |Task 1| |Task 2| |Task 3| |
  |  |web:v2| |web:v2| |web:v2| |
  |  +------+ +------+ +------+ |
  |                              |
  |  Service: worker (desired: 2)|
  |  +------+ +------+          |
  |  |Task 1| |Task 2|          |
  |  |wrk:v1| |wrk:v1|          |
  |  +------+ +------+          |
  +------------------------------+
```

### ECS Service with Terraform (Fargate)

```hcl
resource "aws_ecs_cluster" "main" {
  name = "app-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "web" {
  family                   = "web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "web"
      image     = "${aws_ecr_repository.app.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = "us-east-1"
          "awslogs-stream-prefix" = "web"
        }
      }
      environment = [
        { name = "PORT", value = "8080" },
        { name = "DB_HOST", value = aws_db_instance.main.address }
      ]
      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = aws_secretsmanager_secret.db_password.arn
        }
      ]
    }
  ])
}

resource "aws_ecs_service" "web" {
  name            = "web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = 3
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 8080
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}

resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.web.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_cpu" {
  name               = "cpu-auto-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 70.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
```

## EKS: Managed Kubernetes

```
EKS ARCHITECTURE

  +------------- EKS Cluster ---------------+
  |                                          |
  |  Control Plane (AWS Managed)             |
  |  +------------------------------------+  |
  |  | API Server | etcd | Scheduler      |  |
  |  | (you never see these)              |  |
  |  +------------------------------------+  |
  |                                          |
  |  Worker Nodes                            |
  |  +------------+  +------------+          |
  |  | EC2 Node 1 |  | EC2 Node 2 |         |
  |  | +---+ +---+|  | +---+ +---+|         |
  |  | |Pod| |Pod||  | |Pod| |Pod||         |
  |  | +---+ +---+|  | +---+ +---+|         |
  |  +------------+  +------------+          |
  |                                          |
  |  OR Fargate Profiles (serverless pods)   |
  |  +------+ +------+ +------+             |
  |  | Pod  | | Pod  | | Pod  |             |
  |  |(no EC2 to manage)      |             |
  |  +------+ +------+ +------+             |
  +------------------------------------------+
```

### EKS with Terraform

```hcl
resource "aws_eks_cluster" "main" {
  name     = "app-cluster"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.29"

  vpc_config {
    subnet_ids              = aws_subnet.private[*].id
    endpoint_private_access = true
    endpoint_public_access  = true
    security_group_ids      = [aws_security_group.eks.id]
  }
}

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "main"
  node_role_arn   = aws_iam_role.eks_node.arn
  subnet_ids      = aws_subnet.private[*].id
  instance_types  = ["t3.medium"]

  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 2
  }

  update_config {
    max_unavailable = 1
  }
}
```

## ECS vs EKS Decision Guide

```
CHOOSE ECS                          CHOOSE EKS
+-------------------------------+   +-------------------------------+
| AWS-only deployment           |   | Multi-cloud / hybrid          |
| Simpler operational model     |   | Existing K8s investment       |
| Tight AWS integration needed  |   | Need Helm / K8s ecosystem     |
| Smaller team / less K8s exp   |   | Complex networking (Istio)    |
| Lower cost (no control plane) |   | Community tooling matters     |
| Task definitions are enough   |   | Need CRDs / operators         |
+-------------------------------+   +-------------------------------+
```

## Service Mesh with App Mesh

```
WITHOUT SERVICE MESH              WITH APP MESH
+-----+     +-----+              +-----+     +-----+
|Svc A|---->|Svc B|              |Svc A|---->|Svc B|
+-----+     +-----+              |proxy|     |proxy|
  No observability                +-----+     +-----+
  No traffic control                |            |
  No retries                        v            v
                                 +------------------+
                                 | App Mesh         |
                                 | - mTLS           |
                                 | - Traffic rules  |
                                 | - Observability  |
                                 | - Retries        |
                                 | - Circuit break  |
                                 +------------------+
```

**GCP equivalents**: Artifact Registry (ECR), Cloud Run (Fargate), GKE (EKS)

## Exercises

1. Create an ECR repository with Terraform. Build a simple Docker
   image, push it to ECR, and verify it appears.

2. Deploy a Fargate ECS service with Terraform: cluster, task
   definition, service, and ALB. Use auto-scaling based on CPU.

3. Set up an EKS cluster with a managed node group using Terraform.
   Deploy a simple app using kubectl.

4. Migrate a docker-compose application to ECS task definitions.
   Map each service in docker-compose to an ECS container definition.

5. Design a container deployment pipeline: code push -> build
   image -> push to ECR -> deploy to ECS with blue/green. Draw
   the architecture diagram.

---

[Next: Lesson 9 - Terraform Basics](09-terraform-basics.md)
