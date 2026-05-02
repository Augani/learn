# Lesson 15: Multi-Region Architecture

## The Big Analogy: Restaurant Chain

```
SINGLE REGION                   MULTI-REGION
(One restaurant)                (Restaurant chain)

  +----------+                  NYC        London      Tokyo
  |  Kitchen |                  +------+   +------+   +------+
  |  Tables  |                  |Kitchen|  |Kitchen|  |Kitchen|
  |  Staff   |                  |Tables |  |Tables |  |Tables |
  +----------+                  +------+   +------+   +------+
                                    \         |         /
  If kitchen floods,                 \        |        /
  everyone goes hungry.               Shared menu (data)
                                      Any location can serve
                                      customers if one closes.
```

## Active-Active vs Active-Passive

```
ACTIVE-ACTIVE                        ACTIVE-PASSIVE

  us-east-1        eu-west-1          us-east-1        eu-west-1
  +--------+       +--------+         +--------+       +--------+
  | App    |       | App    |         | App    |       | App    |
  | Server |       | Server |         | Server |       | (idle) |
  +---+----+       +---+----+         +---+----+       +---+----+
      |                |                  |                |
  +---+----+       +---+----+         +---+----+       +---+----+
  | DB     |<----->| DB     |         | DB     |------>| DB     |
  |(primary)|  sync|(primary)|        |(primary)|  rep |(replica)|
  +--------+       +--------+         +--------+       +--------+

  Both serve traffic              Only primary serves
  Both write locally              Failover if primary dies
  Conflict resolution needed      No write conflicts
  Complex but robust              Simpler, slower failover

  RTO: ~0 (instant)               RTO: minutes to hours
  Cost: 2x                        Cost: 1.5x
```

## Route 53: Global Traffic Routing

```
ROUTE 53 ROUTING POLICIES

  User Request: app.example.com
         |
         v
  +------+-------+
  |  Route 53    |
  |              |
  | Which policy?|
  +------+-------+
         |
    +----+----+----+----+
    |    |    |    |    |
    v    v    v    v    v

  Simple  Weighted  Latency  Failover  Geolocation

  Simple:     Always same target
  Weighted:   70% to A, 30% to B
  Latency:    Route to closest region
  Failover:   Primary, switch on failure
  Geolocation: EU users -> EU, US users -> US
```

```hcl
resource "aws_route53_health_check" "primary" {
  fqdn              = "us-east-1.app.example.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 10

  regions = ["us-east-1", "eu-west-1", "ap-southeast-1"]
}

resource "aws_route53_health_check" "secondary" {
  fqdn              = "eu-west-1.app.example.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 10
}

resource "aws_route53_record" "primary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.example.com"
  type    = "A"

  alias {
    name                   = aws_lb.primary.dns_name
    zone_id                = aws_lb.primary.zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier  = "primary"
  health_check_id = aws_route53_health_check.primary.id
}

resource "aws_route53_record" "secondary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.example.com"
  type    = "A"

  alias {
    name                   = aws_lb.secondary.dns_name
    zone_id                = aws_lb.secondary.zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "SECONDARY"
  }

  set_identifier  = "secondary"
  health_check_id = aws_route53_health_check.secondary.id
}
```

### Latency-Based Routing

```hcl
resource "aws_route53_record" "latency_us" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"

  alias {
    name                   = aws_lb.us_east.dns_name
    zone_id                = aws_lb.us_east.zone_id
    evaluate_target_health = true
  }

  latency_routing_policy {
    region = "us-east-1"
  }

  set_identifier = "us-east-1"
}

resource "aws_route53_record" "latency_eu" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"

  alias {
    name                   = aws_lb.eu_west.dns_name
    zone_id                = aws_lb.eu_west.zone_id
    evaluate_target_health = true
  }

  latency_routing_policy {
    region = "eu-west-1"
  }

  set_identifier = "eu-west-1"
}
```

## Global Database Patterns

```
DYNAMODB GLOBAL TABLES

  us-east-1              eu-west-1            ap-northeast-1
  +-----------+          +-----------+        +-----------+
  | DynamoDB  |<-------->| DynamoDB  |<------>| DynamoDB  |
  | Table     |   sync   | Table     |  sync  | Table     |
  | (replica) |          | (replica) |        | (replica) |
  +-----------+          +-----------+        +-----------+

  Write anywhere, read anywhere
  Eventually consistent (typically < 1 second)
  Conflict resolution: last writer wins


AURORA GLOBAL DATABASE

  us-east-1 (PRIMARY)            eu-west-1 (SECONDARY)
  +-----------+                  +-----------+
  | Aurora    |   async repl     | Aurora    |
  | Writer    |----------------->| Reader    |
  | Instance  |   < 1 second     | Instance  |
  +-----------+                  +-----------+

  Write only to primary
  Promote secondary in < 1 minute for DR
```

```hcl
resource "aws_dynamodb_table" "global" {
  name             = "user-sessions"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "session_id"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "session_id"
    type = "S"
  }

  replica {
    region_name = "eu-west-1"
  }

  replica {
    region_name = "ap-northeast-1"
  }
}
```

## Global Load Balancing with CloudFront

```
CLOUDFRONT + MULTI-REGION ORIGINS

  Users worldwide
       |
       v
  +----------+
  | CloudFront|     Edge locations (400+)
  | CDN       |     Cache static content
  +-----+----+
        |
        | Origin failover
        v
  +-----+------+
  | Origin     |
  | Group      |
  +--+------+--+
     |      |
     v      v
  Primary  Secondary
  Origin   Origin
  (us-east) (eu-west)
```

```hcl
resource "aws_cloudfront_distribution" "global" {
  enabled = true

  origin_group {
    origin_id = "failover-group"

    failover_criteria {
      status_codes = [500, 502, 503, 504]
    }

    member {
      origin_id = "primary"
    }

    member {
      origin_id = "secondary"
    }
  }

  origin {
    domain_name = aws_lb.us_east.dns_name
    origin_id   = "primary"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  origin {
    domain_name = aws_lb.eu_west.dns_name
    origin_id   = "secondary"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "failover-group"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.global.arn
    ssl_support_method  = "sni-only"
  }
}
```

## Exercises

1. Design a multi-region architecture for an e-commerce app with active-passive failover. Draw the data flow for normal operation and during failover.

2. Configure Route 53 with latency-based routing for three regions (US, EU, Asia) with health checks on each.

3. Set up a DynamoDB Global Table across two regions and write a test that verifies replication latency.

4. Create a CloudFront distribution with origin failover between a primary and secondary ALB.

5. Calculate the cost difference between active-active and active-passive for an application running 10 EC2 instances per region across 2 regions.

## Key Takeaways

```
+-------------------------------------------+
| MULTI-REGION ARCHITECTURE                 |
|                                           |
| 1. Active-active: best RTO, highest cost |
| 2. Active-passive: simpler, slower DR    |
| 3. Route 53 is the global traffic cop    |
| 4. Global databases handle replication   |
| 5. CloudFront adds edge caching + DR     |
| 6. Test failover regularly               |
+-------------------------------------------+
```
