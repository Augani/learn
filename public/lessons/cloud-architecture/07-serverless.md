# Lesson 7: Serverless Patterns

## The Big Analogy: Event Catering vs Running a Restaurant

```
RUNNING A RESTAURANT (Servers)     EVENT CATERING (Serverless)
+----------------------------+     +----------------------------+
| Kitchen always staffed     |     | Chef arrives when booked   |
| Rent paid 24/7             |     | Pay only for the event     |
| You handle capacity:       |     | Caterer scales to guests:  |
|   10 chefs for 10 guests   |     |   50 guests? 50 portions   |
|   10 chefs for 100 guests  |     |   500 guests? 500 portions |
|   (oops, understaffed)     |     |   0 guests? $0 cost        |
| Fixed overhead             |     | Zero idle cost             |
+----------------------------+     +----------------------------+
```

## Lambda Deep Dive

```
LAMBDA LIFECYCLE

  COLD START                        WARM INVOCATION
  +---------------------------+     +------------------+
  | 1. Download code          |     | 1. Reuse         |
  | 2. Create execution env   |     |    existing      |
  | 3. Initialize runtime     |     |    environment   |
  | 4. Run init code          |     | 2. Run handler   |
  | 5. Run handler            |     |    function      |
  +---------------------------+     +------------------+
  ~100ms - 2s extra latency         Fast (<10ms overhead)

  COLD STARTS HAPPEN WHEN:
  - First invocation
  - After ~15 min idle
  - Scaling up new instances
  - Code deployment

  MITIGATION:
  - Provisioned Concurrency (keep N instances warm)
  - Smaller packages (faster download)
  - Init code outside handler (reused on warm start)
```

### Lambda with Terraform (Complete Setup)

```hcl
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "api-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "api" {
  filename         = "lambda.zip"
  function_name    = "api-handler"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  memory_size      = 512
  timeout          = 30
  source_code_hash = filebase64sha256("lambda.zip")

  environment {
    variables = {
      TABLE_NAME   = aws_dynamodb_table.main.name
      ENVIRONMENT  = "production"
    }
  }
}
```

## API Gateway: The Front Door

```
API GATEWAY TYPES

  REST API                        HTTP API
  +------------------------+     +------------------------+
  | Full featured          |     | Simpler, cheaper       |
  | Request validation     |     | Lower latency          |
  | Caching                |     | JWT authorizers         |
  | WAF integration        |     | OIDC/OAuth2            |
  | Usage plans + API keys |     | 70% cheaper than REST  |
  | Request/Response       |     | Good for most APIs     |
  | transformation         |     |                        |
  +------------------------+     +------------------------+

  REQUEST FLOW:
  Client --> API GW --> Lambda --> DynamoDB
    |           |
    |           +-- Auth (Cognito / JWT / IAM)
    |           +-- Rate Limiting
    |           +-- Request Validation
    |
    <-- Response (with caching if enabled)
```

### API Gateway with Terraform

```hcl
resource "aws_apigatewayv2_api" "main" {
  name          = "app-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["https://myapp.com"]
    allow_methods = ["GET", "POST", "PUT", "DELETE"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "prod"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_items" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /items"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_lambda_permission" "apigw" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
```

## Step Functions: Orchestrating Workflows

```
STEP FUNCTIONS = State Machine for Cloud Workflows

  Think of it as a flowchart that AWS executes:

  START
    |
    v
  +------------------+
  | Validate Order   |  (Lambda)
  +--------+---------+
           |
     +-----+-----+
     |           |
   Valid      Invalid
     |           |
     v           v
  +--------+  +--------+
  | Process|  | Notify |  (Lambda)
  | Payment|  | User   |
  +---+----+  +--------+
      |           |
      |           v
      |         END (fail)
      v
  +------------------+
  | Ship Order       |  (Lambda / ECS)
  +------------------+
      |
      v
  +------------------+
  | Wait 3 days      |  (Wait state)
  +------------------+
      |
      v
  +------------------+
  | Send Review Req  |  (Lambda + SES)
  +------------------+
      |
      v
    END (success)
```

### Step Functions with Terraform

```hcl
resource "aws_sfn_state_machine" "order" {
  name     = "order-processing"
  role_arn = aws_iam_role.step_functions.arn

  definition = jsonencode({
    StartAt = "ValidateOrder"
    States = {
      ValidateOrder = {
        Type     = "Task"
        Resource = aws_lambda_function.validate.arn
        Next     = "IsValid"
      }
      IsValid = {
        Type = "Choice"
        Choices = [
          {
            Variable     = "$.valid"
            BooleanEquals = true
            Next         = "ProcessPayment"
          }
        ]
        Default = "NotifyInvalid"
      }
      ProcessPayment = {
        Type     = "Task"
        Resource = aws_lambda_function.payment.arn
        Next     = "ShipOrder"
        Retry = [
          {
            ErrorEquals     = ["PaymentError"]
            IntervalSeconds = 5
            MaxAttempts     = 3
          }
        ]
      }
      ShipOrder = {
        Type     = "Task"
        Resource = aws_lambda_function.ship.arn
        End      = true
      }
      NotifyInvalid = {
        Type     = "Task"
        Resource = aws_lambda_function.notify.arn
        End      = true
      }
    }
  })
}
```

## Event-Driven Architecture Patterns

```
PATTERN 1: S3 Event -> Lambda
+--------+    event    +--------+    write    +----------+
| S3     |------------>| Lambda |------------>| DynamoDB |
| Upload |             | Process|             | Metadata |
+--------+             +--------+             +----------+

PATTERN 2: API -> SQS -> Lambda (decoupled)
+--------+  +------+  +--------+  +--------+
| API GW |->| SQS  |->| Lambda |->| RDS    |
| (fast) |  |Queue |  |(worker)|  |        |
+--------+  +------+  +--------+  +--------+
             Buffer     Process     Store
             requests   async

PATTERN 3: EventBridge (Event Bus)
+--------+
| Order  |--+
| Service|  |    +-----------+    +----------+
+--------+  +--->| Event     |--->| Invoice  |
                 | Bridge    |    | Lambda   |
+--------+  +--->| (central  |--->+----------+
| Payment|--+    |  bus)     |    +----------+
| Service|       |           |--->| Notify   |
+--------+       +-----------+    | Lambda   |
                                  +----------+

PATTERN 4: Kinesis (Streaming)
+--------+  +----------+  +--------+  +---------+
| IoT    |->| Kinesis  |->| Lambda |->| S3 +    |
| Sensors|  | Stream   |  | (real- |  | Redshift|
| (1M/s) |  | (buffer) |  |  time) |  | (store) |
+--------+  +----------+  +--------+  +---------+
```

### SQS Queue with Terraform

```hcl
resource "aws_sqs_queue" "orders" {
  name                       = "order-processing"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 86400
  receive_wait_time_seconds  = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.orders_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "orders_dlq" {
  name                      = "order-processing-dlq"
  message_retention_seconds = 1209600
}

resource "aws_lambda_event_source_mapping" "sqs" {
  event_source_arn = aws_sqs_queue.orders.arn
  function_name    = aws_lambda_function.process_order.arn
  batch_size       = 10
}
```

**GCP equivalents**: Cloud Functions (Lambda), Cloud Endpoints (API Gateway), Workflows (Step Functions), Pub/Sub (SQS/SNS/EventBridge)

## Exercises

1. Build a serverless API with Terraform: API Gateway + Lambda +
   DynamoDB. Create endpoints for GET and POST on `/items`.

2. Create a Step Functions state machine that processes an image
   upload: validate file type -> resize image -> store metadata.
   Use Lambda for each step.

3. Design an event-driven order processing system using SQS,
   Lambda, and DynamoDB. Include a dead-letter queue for failed
   messages. Implement with Terraform.

4. Compare the monthly cost of running a REST API that handles
   10 million requests/month using:
   - EC2 (t3.medium, 24/7)
   - Lambda (average 200ms, 256MB per invocation)
   Which is cheaper? At what request volume do they break even?

5. Design an event-driven architecture for a video processing
   platform: user uploads video -> transcode to multiple formats
   -> generate thumbnail -> update database -> notify user.
   Draw the architecture and identify which AWS services to use.

---

[Next: Lesson 8 - Containers in Cloud](08-containers-in-cloud.md)
