# Lesson 02: SLIs, SLOs, and SLAs

## The Restaurant Quality Guarantee

Imagine you run a restaurant. You make three kinds of promises:

- **What you measure** (SLI): "We track how long each table waits for their food"
- **What you target** (SLO): "95% of orders will arrive within 15 minutes"
- **What you guarantee to customers** (SLA): "If your food takes more than 30 minutes, it is free"

```
+------------------+     +------------------+     +------------------+
|       SLI        |     |       SLO        |     |       SLA        |
| (Indicator)      |     | (Objective)      |     | (Agreement)      |
|                  |     |                  |     |                  |
| What you MEASURE | --> | What you TARGET  | --> | What you PROMISE |
|                  |     |                  |     |   (with teeth)   |
| "Order latency"  |     | "p95 < 15 min"  |     | "> 30 min = free"|
+------------------+     +------------------+     +------------------+
     Internal              Internal + Eng          External + Legal
```

The SLI is your thermometer. The SLO is the temperature you aim for. The SLA is the contract you sign that says what happens if you miss badly.

## Service Level Indicators (SLIs)

An SLI is a quantitative measure of some aspect of your service. Good SLIs are:

- **Measurable**: You can actually collect the data
- **User-facing**: They reflect what users experience
- **Simple**: One number, not a committee report

```
COMMON SLIs BY SERVICE TYPE

+-------------------+--------------------------------+
| Service Type      | Good SLIs                      |
+-------------------+--------------------------------+
| Web API           | Request latency (p50, p95, p99)|
|                   | Error rate (5xx / total)       |
|                   | Throughput (requests/sec)      |
+-------------------+--------------------------------+
| Storage System    | Durability (data loss rate)    |
|                   | Read/write latency             |
|                   | Availability (successful ops)  |
+-------------------+--------------------------------+
| Data Pipeline     | Freshness (data age)           |
|                   | Correctness (valid records %)  |
|                   | Throughput (records/sec)       |
+-------------------+--------------------------------+
| Streaming Service | Startup time                   |
|                   | Buffering ratio                |
|                   | Resolution quality             |
+-------------------+--------------------------------+
```

## Choosing Good SLIs

The key question: **Does this metric reflect what users care about?**

```
BAD SLI                        GOOD SLI
+--------------------------+   +--------------------------+
| CPU utilization = 45%    |   | p99 latency = 120ms     |
| (Users do not care about |   | (Users feel this         |
|  your CPU)               |   |  directly)               |
+--------------------------+   +--------------------------+

| Free disk = 200GB        |   | Error rate = 0.01%      |
| (Capacity metric, not    |   | (Users see errors        |
|  user-facing)            |   |  directly)               |
+--------------------------+   +--------------------------+

| Uptime = 99.99%          |   | Successful requests /   |
| (Binary, no nuance)      |   |  total requests = 99.9% |
|                          |   | (Proportional, nuanced) |
+--------------------------+   +--------------------------+
```

## Service Level Objectives (SLOs)

An SLO is a target value for an SLI, measured over a time window.

Formula: `SLI [operator] [target] over [time window]`

Examples:
- 99.9% of HTTP requests return successfully in a 30-day window
- p99 latency < 200ms over a rolling 7-day window
- 99.99% of uploaded files are retrievable within 28 days

```
SLO STRUCTURE

  +------ SLI ------+  +-- Target --+  +-- Window --+
  |                  |  |            |  |            |
  "Request success    >=   99.9%       over 30 days"
   rate"
```

### How Tight Should Your SLO Be?

```
RELIABILITY COST CURVE

  Cost |
       |                              *
       |                          *
       |                      *
       |                  *
       |             *
       |        *
       |   *
       | *
       +--------------------------------
        99%  99.9% 99.95% 99.99% 99.999%
                    SLO Target

Each additional "9" costs roughly 10x more.
99.9% -> 99.99% is NOT a 0.09% improvement.
It is a 10x reduction in allowed downtime.
```

### The Nines Table

| SLO | Monthly Downtime | Annual Downtime |
|-----|-----------------|-----------------|
| 99% | 7.3 hours | 3.65 days |
| 99.9% | 43.8 minutes | 8.77 hours |
| 99.95% | 21.9 minutes | 4.38 hours |
| 99.99% | 4.38 minutes | 52.6 minutes |
| 99.999% | 26.3 seconds | 5.26 minutes |

## Service Level Agreements (SLAs)

An SLA is a contract (often with financial consequences) between a service provider and its customers. SLAs should always be **looser** than SLOs.

```
THE SAFETY MARGIN

100%  |
      |
99.99%|  <-- Internal SLO (what you aim for)
      |
      |  <-- SAFETY MARGIN (breathing room)
      |
99.9% |  <-- External SLA (what you promise customers)
      |
      |  If you meet your SLO, you will always
      |  meet your SLA. The margin absorbs surprises.
```

Why the gap? Because:
- SLAs have legal and financial consequences
- You need room for unexpected events
- Customers should rarely see you miss an SLA

## Putting It All Together: A Real Example

Your e-commerce checkout service:

```
+----------------------------------------------------------+
|  CHECKOUT SERVICE RELIABILITY SPEC                       |
|                                                          |
|  SLI: Proportion of checkout requests that complete      |
|       successfully (HTTP 2xx) within 500ms               |
|                                                          |
|  SLO: 99.95% of requests succeed within 500ms           |
|       over a rolling 30-day window                       |
|                                                          |
|  SLA: 99.9% availability per calendar month              |
|       Breach penalty: 10% service credit                 |
|                                                          |
|  Error Budget: 0.05% = ~21.6 minutes/month               |
|                                                          |
+----------------------------------------------------------+
```

Prometheus query for this SLI:

```promql
sum(rate(http_requests_total{
  service="checkout",
  code=~"2.."
}[30d]))
/
sum(rate(http_requests_total{
  service="checkout"
}[30d]))
```

## SLO Document Template

Every service should have an SLO document. Here is the structure:

```yaml
service: checkout-api
owner: payments-team
last_reviewed: 2025-01-15

slis:
  - name: availability
    description: Proportion of successful HTTP requests
    good_event: status_code < 500
    valid_event: all HTTP requests excluding health checks

  - name: latency
    description: Proportion of fast requests
    good_event: response_time < 500ms
    valid_event: all HTTP requests excluding health checks

slos:
  - sli: availability
    target: 99.95
    window: 30d

  - sli: latency
    target: 99.0
    window: 30d

sla:
  target: 99.9
  penalty: "10% credit for each 0.1% below target"
```

## Common Mistakes

```
MISTAKE #1: Too many SLIs
+---+---+---+---+---+---+---+---+---+---+
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |10|
+---+---+---+---+---+---+---+---+---+---+
  ^-- If you track 50 SLIs, you track none.
      Pick 3-5 per service.

MISTAKE #2: SLO = SLA
  SLO: 99.9%  <--+-- Same number means no safety margin.
  SLA: 99.9%  <--+   You WILL breach the SLA eventually.

MISTAKE #3: 100% as a target
  100% is not an SLO. It is a fantasy.
  Even Google does not target 100%.

MISTAKE #4: Not reviewing SLOs
  Set it and forget it = irrelevant SLOs.
  Review quarterly. Adjust based on data.
```

## Exercises

1. **Pick SLIs**: For a service you work on (or a service you use daily), identify three meaningful SLIs. Explain why each reflects user experience.

2. **Write an SLO**: Using the SLO document template above, write a complete SLO spec for a user-facing API. Include availability and latency SLIs with realistic targets.

3. **Calculate the budget**: If your SLO is 99.95% over 30 days, how many minutes of downtime can you have? What if you change the window to 7 days?

4. **SLA gap analysis**: Your SLO is 99.99% and your SLA is 99.95%. Over the past month, your actual availability was 99.96%. Did you miss your SLO? Did you breach your SLA? What action should you take?

5. **PromQL practice**: Write a Prometheus query to calculate the error rate for a service called `payment-gateway` over the last 7 days, counting only 5xx responses as errors.

---

[Next: Lesson 03 - Error Budgets -->](03-error-budgets.md)
