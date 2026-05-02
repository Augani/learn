# Lesson 2: Compute Services

## The Big Analogy: Transportation

Cloud compute options are like getting around a city:

```
+------------------+------------------------------------------+
| TRANSPORT        | CLOUD EQUIVALENT                         |
+------------------+------------------------------------------+
|                  |                                          |
| Buying a car     | EC2 Instance                             |
| You own it, you  | Full VM, you manage OS, patches,         |
| maintain it, you | scaling. Always running, always paying.  |
| drive it         |                                          |
|                  |                                          |
| Taking a taxi    | AWS Lambda (Serverless)                  |
| Pay per ride,    | Pay per invocation. No car to maintain.  |
| no maintenance,  | Just say where you want to go.           |
| just hop in      |                                          |
|                  |                                          |
| Renting a car    | Fargate                                  |
| Flexibility of   | Run containers without managing servers. |
| driving without  | You pick the specs, AWS runs it.         |
| ownership        |                                          |
|                  |                                          |
| Company shuttle  | ECS on EC2                               |
| Shared bus with  | You manage the fleet of EC2 instances,   |
| a set route      | ECS schedules containers on them.        |
|                  |                                          |
+------------------+------------------------------------------+
```

## EC2: The Virtual Machine

EC2 (Elastic Compute Cloud) gives you a full virtual server.
Like owning a car -- maximum control, maximum responsibility.

```
EC2 INSTANCE ANATOMY
+------------------------------------------+
|  Instance Type: t3.medium                |
|  +------------------------------------+  |
|  | vCPUs: 2     | Memory: 4 GB       |  |
|  +------------------------------------+  |
|  | Storage: EBS (attached disk)       |  |
|  +------------------------------------+  |
|  | Network: ENI (virtual NIC)         |  |
|  +------------------------------------+  |
|  | OS: Amazon Linux 2 / Ubuntu / etc  |  |
|  +------------------------------------+  |
|  | Security Group (firewall rules)    |  |
|  +------------------------------------+  |
+------------------------------------------+

INSTANCE FAMILY CHEAT SHEET:
  t3/t4g  = General purpose (burstable, cheap)
  m6i/m7g = General purpose (steady workloads)
  c6i/c7g = Compute optimized (CPU-heavy)
  r6i/r7g = Memory optimized (databases)
  p4/p5   = GPU instances (ML training)
  i3/i4i  = Storage optimized (databases)
```

### EC2 with Terraform

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id

  vpc_security_group_ids = [aws_security_group.web.id]

  tags = {
    Name        = "web-server"
    Environment = "production"
  }
}
```

### EC2 with AWS CLI

```bash
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.micro \
  --key-name my-keypair \
  --security-group-ids sg-0123456789abcdef0 \
  --subnet-id subnet-0123456789abcdef0

aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=web-server"

aws ec2 stop-instances --instance-ids i-0123456789abcdef0

aws ec2 terminate-instances --instance-ids i-0123456789abcdef0
```

## AWS Lambda: Serverless Compute

Lambda runs your code without any servers to manage. You upload
a function, define a trigger, and AWS handles everything else.

```
LAMBDA EXECUTION MODEL

  Event Source          Lambda Function        Output
  +-----------+        +---------------+      +--------+
  | API       |------->|               |----->| HTTP   |
  | Gateway   |        | Your Code     |      | Response|
  +-----------+        | (Python/Node/ |      +--------+
  | S3 Upload |------->|  Go/Rust/Java)|----->| Write  |
  +-----------+        |               |      | to DB  |
  | Schedule  |------->| Max 15 min    |      +--------+
  | (cron)    |        | Max 10 GB RAM |
  +-----------+        +---------------+

  YOU PAY FOR:
  - Number of invocations
  - Duration (ms) x Memory allocated
  - FREE TIER: 1M requests/month
```

### Lambda with Terraform

```hcl
resource "aws_lambda_function" "api" {
  filename         = "lambda.zip"
  function_name    = "api-handler"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  memory_size      = 256
  timeout          = 30
  source_code_hash = filebase64sha256("lambda.zip")

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.main.name
    }
  }
}
```

## Fargate: Serverless Containers

Fargate runs containers without managing EC2 instances. Like
renting a car -- you pick the engine size but don't maintain it.

```
FARGATE vs EC2-BACKED CONTAINERS

  ECS on EC2 (you manage servers)     ECS on Fargate (serverless)
  +---------------------------+       +---------------------------+
  | EC2 Instance              |       | Fargate (no server)       |
  | +-------+ +-------+      |       | +-------+ +-------+      |
  | |Container|Container|     |       | |Container|Container|     |
  | +-------+ +-------+      |       | +-------+ +-------+      |
  | +-------+                 |       |                           |
  | |Container|               |       | AWS manages:              |
  | +-------+                 |       |  - Server provisioning    |
  |                           |       |  - Patching               |
  | You manage:               |       |  - Scaling the infra      |
  |  - Instance type          |       |                           |
  |  - OS patching            |       | You define:               |
  |  - Capacity planning      |       |  - CPU/Memory per task    |
  |  - Scaling EC2s           |       |  - Container image        |
  +---------------------------+       +---------------------------+
```

### Fargate Task with Terraform

```hcl
resource "aws_ecs_task_definition" "app" {
  family                   = "app"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = "123456789.dkr.ecr.us-east-1.amazonaws.com/app:latest"
      essential = true
      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]
    }
  ])
}
```

## ECS vs EKS: Container Orchestrators

```
+-------------------+---------------------+
| ECS               | EKS                 |
| (AWS Native)      | (Managed Kubernetes)|
+-------------------+---------------------+
| Simpler setup     | K8s ecosystem       |
| AWS-specific      | Portable            |
| Task definitions  | Pods/Deployments    |
| Tight AWS         | Helm charts         |
| integration       | Service mesh        |
| Lower learning    | Higher learning     |
| curve             | curve               |
| No control plane  | $0.10/hr control    |
| cost              | plane cost          |
+-------------------+---------------------+

CHOOSE ECS WHEN:         CHOOSE EKS WHEN:
- AWS-only deployment    - Multi-cloud strategy
- Simple container apps  - Existing K8s expertise
- Cost-sensitive         - Need K8s ecosystem tools
- Small team             - Complex microservices
```

**GCP equivalents**: Cloud Run (Fargate), GKE (EKS), Compute Engine (EC2), Cloud Functions (Lambda)

## Decision Matrix: Which Compute to Use

```
                    Control
                    High |
                         |  EC2
                         |  (Full VM)
                         |
                         |      ECS on EC2
                         |      (Container fleet)
                         |
                         |          Fargate
                         |          (Serverless containers)
                         |
                         |              Lambda
                    Low  |              (Functions)
                         +--------------------------------
                         Low                          High
                                    Managed-ness
```

```
START HERE:
  |
  Is it a long-running process (>15 min)?
  |--- YES --> Do you need full OS access?
  |            |--- YES --> EC2
  |            |--- NO  --> Fargate / ECS
  |
  |--- NO  --> Is it event-driven / bursty?
               |--- YES --> Lambda
               |--- NO  --> Fargate (steady containers)
```

## Exercises

1. Launch a `t3.micro` EC2 instance using the AWS CLI. SSH into
   it, install nginx, and verify it serves a web page. Then
   terminate the instance.

2. Write a Terraform config that creates an EC2 instance with a
   security group allowing port 80 inbound. Run `terraform plan`.

3. Create a simple Lambda function (in any language) that returns
   `{"status": "ok"}`. Deploy it using the AWS CLI or Terraform.

4. For each scenario, choose the best compute service and explain:
   - A REST API with unpredictable traffic (0-10000 req/sec)
   - A video encoding pipeline processing 2-hour files
   - A web app with steady 24/7 traffic and custom OS packages
   - A batch job that runs nightly for 5 minutes

5. Calculate the monthly cost difference between running a
   `t3.medium` EC2 instance 24/7 vs running Lambda for 1 million
   invocations at 200ms/128MB each. Use the AWS pricing page.

---

[Next: Lesson 3 - Storage Services](03-storage.md)
