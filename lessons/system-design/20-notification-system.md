# Lesson 20: Design a Notification System

Notifications seem simple — send a message to a user. But a real system
handles iOS push, Android push, email, SMS, and in-app notifications,
each with different providers, different formats, different failure modes,
and different costs. Oh, and users hate getting spammed, so you need
preferences, rate limiting, and deduplication.

**Analogy:** Think of a notification system like a post office that handles
every kind of delivery: express mail (push notifications), regular mail
(email), telegrams (SMS), and bulletin boards (in-app). Each delivery
channel has different rules, different carriers, different costs, and
different speeds. Your job is to build the sorting facility that routes
the right message to the right channel at the right time.

---

## Step 1: Requirements

### Functional Requirements

1. **Multiple channels** — iOS push (APNs), Android push (FCM), email
   (SendGrid/SES), SMS (Twilio), in-app
2. **User preferences** — Users can opt out of channels, categories, or
   all notifications
3. **Templating** — Notifications use templates with variables
   ("Hi {name}, your order {order_id} shipped")
4. **Scheduling** — Send now, or schedule for a future time
5. **Retry logic** — Retry failed deliveries with backoff
6. **Tracking** — Open rates, click rates, delivery status

### Non-Functional Requirements

1. **Reliability** — No notification should be silently lost
2. **No duplicates** — Same notification should not be sent twice
3. **Scalable** — Handle millions of notifications per hour
4. **Soft real-time** — Push/SMS within seconds, email within minutes
5. **Extensible** — Easy to add new channels

### Scale Estimation

```
Active users:          100M
Notifications/day:     500M across all channels
  - Push:              300M (60%)
  - Email:             100M (20%)
  - SMS:               25M  (5%)
  - In-app:            75M  (15%)

Peak rate:             ~20,000 notifications/second
Average payload:       ~500 bytes
```

---

## Step 2: High-Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                    NOTIFICATION SOURCES                       │
│  (order service, marketing, security alerts, social, etc.)   │
└────────────────────────────┬─────────────────────────────────┘
                             │
                      ┌──────▼───────┐
                      │ Notification │
                      │     API      │
                      │  (validate,  │
                      │   enqueue)   │
                      └──────┬───────┘
                             │
                      ┌──────▼───────┐
                      │   Message    │
                      │   Queue      │
                      │  (Kafka /    │
                      │   RabbitMQ)  │
                      └──────┬───────┘
                             │
                      ┌──────▼───────┐
                      │ Notification │
                      │   Service    │
                      │ (orchestrate,│
                      │  template,   │
                      │  route)      │
                      └──────┬───────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    ┌─────▼─────┐     ┌─────▼─────┐     ┌──────▼─────┐
    │   Push    │     │   Email   │     │    SMS     │
    │  Worker   │     │  Worker   │     │   Worker   │
    └─────┬─────┘     └─────┬─────┘     └──────┬─────┘
          │                 │                   │
    ┌─────▼─────┐     ┌─────▼─────┐     ┌──────▼─────┐
    │  APNs /   │     │ SendGrid/ │     │  Twilio    │
    │   FCM     │     │   SES     │     │            │
    └───────────┘     └───────────┘     └────────────┘
```

### The Flow (Step by Step)

```
1. Order Service calls: POST /api/v1/notifications
   {
     "user_id": "user_123",
     "type": "order_shipped",
     "data": { "order_id": "ORD-456", "tracking": "1Z999..." },
     "channels": ["push", "email"]
   }

2. Notification API validates the request and pushes to message queue

3. Notification Service picks up the message:
   a. Check user preferences (does user_123 want push + email?)
   b. Check rate limits (has user_123 been notified too many times today?)
   c. Render templates with user data
   d. Route to appropriate channel workers

4. Channel workers send via third-party providers

5. Track delivery status (sent, delivered, opened, clicked)
```

---

## Step 3: Component Deep Dives

### Deep Dive 1: Preventing Duplicate Notifications

Duplicates are the fastest way to annoy users and get your app uninstalled.

**How duplicates happen:**

```
Scenario 1: Producer retry
  Order Service sends notification → timeout → retries → now TWO messages in queue

Scenario 2: Consumer crash
  Worker picks up message → sends push → crashes before acknowledging
  → message redelivered → push sent AGAIN

Scenario 3: Race condition
  Two instances of Order Service both trigger "order shipped" notification
```

**Solution: Idempotency key**

Every notification request includes a unique idempotency key. Before
processing, check if we've already handled this key.

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  Incoming   │────▶│  Check       │────▶│  Process   │
│  Message    │     │  Redis Set   │     │  & Send    │
└─────────────┘     │  (dedup)     │     └────────────┘
                    └──────┬───────┘
                           │
                    Already seen?
                    → Skip silently
```

**Analogy:** Like a bouncer at a club with a guest list. Each person has a
unique ticket number. If someone shows up with a ticket number already
checked off, they don't get in again — even if they insist it's their first
time.

```
Implementation:

Idempotency key = hash(user_id + notification_type + reference_id)

Example: hash("user_123" + "order_shipped" + "ORD-456") → "dedup:a8f3c2..."

Before sending:
  EXISTS dedup:a8f3c2...  → if yes, skip
  SET dedup:a8f3c2... EX 86400  → mark as processed, expire in 24h
```

---

### Deep Dive 2: Rate Limiting Per User

Nobody wants 50 push notifications in an hour. Different categories get
different limits.

```
Rate limit rules:
┌──────────────────┬───────────────┬─────────┐
│ Category         │ Channel       │ Limit   │
├──────────────────┼───────────────┼─────────┤
│ Marketing        │ Push          │ 3/day   │
│ Marketing        │ Email         │ 1/day   │
│ Transactional    │ Push          │ 20/day  │
│ Transactional    │ Email         │ 10/day  │
│ Security         │ All           │ No limit│
│ Social           │ Push          │ 10/hour │
└──────────────────┴───────────────┴─────────┘
```

**Analogy:** Like a receptionist screening calls. "Sorry, the marketing
department already called you three times today. I'll hold the next call
until tomorrow. But if it's an emergency from security — put them through
immediately."

```
Redis implementation:

Key:    ratelimit:{user_id}:{category}:{channel}:{date}
Value:  count of notifications sent

INCR ratelimit:user_123:marketing:push:2024-01-15
→ returns 4
→ limit is 3/day
→ BLOCK this notification (or queue for tomorrow)
```

---

### Deep Dive 3: Priority Queues

Not all notifications are equal. A "your account was compromised" alert
should jump ahead of a "weekly digest" email.

```
                    ┌──────────────────────┐
                    │   Notification API   │
                    └──────────┬───────────┘
                               │
              Classify priority based on type:
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
  ┌──────▼──────┐      ┌──────▼──────┐      ┌───────▼─────┐
  │  Critical   │      │   Normal    │      │    Low      │
  │   Queue     │      │   Queue     │      │   Queue     │
  │  (security, │      │  (orders,   │      │ (marketing, │
  │   payment)  │      │   social)   │      │  digest)    │
  └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
         │                    │                    │
    10 workers           5 workers            2 workers
    (high capacity)      (medium)            (low, throttled)
```

Priority levels:

1. **Critical (P0):** Security alerts, payment failures, password resets.
   Process immediately, bypass rate limits.
2. **Normal (P1):** Order updates, friend requests, comments.
   Process within seconds.
3. **Low (P2):** Marketing, weekly digests, recommendations.
   Process within minutes, heavily rate-limited.

---

### Deep Dive 4: Template Rendering

Hardcoding notification text is unmaintainable. Templates let you change
copy without deploying code.

```
Template store (database or config service):

Template ID: "order_shipped"
Push title:  "Your order is on its way!"
Push body:   "Order {{.OrderID}} shipped via {{.Carrier}}. Track: {{.TrackingURL}}"
Email subject: "Good news — your order shipped"
Email body:  (HTML template with tracking details)
SMS body:    "Order {{.OrderID}} shipped. Track at {{.TrackingURL}}"
```

```
Rendering flow:

┌────────────┐     ┌───────────────┐     ┌──────────────┐
│ Notification│    │   Template    │     │  Rendered    │
│ Data       │───▶│   Engine      │───▶│  Message     │
│ {OrderID:  │    │               │     │              │
│  "ORD-456",│    │  Fetch template│     │ "Order ORD-  │
│  Carrier:  │    │  + merge data │     │  456 shipped │
│  "UPS"}    │    │               │     │  via UPS..." │
└────────────┘    └───────────────┘     └──────────────┘
```

**Why not just pass the final text?**

1. **Localization** — Same template in English, Spanish, Japanese
2. **A/B testing** — Try different copy, measure open rates
3. **Consistency** — Marketing changes text without touching code
4. **Audit trail** — Know which template version was sent

---

### Deep Dive 5: User Preference Service

Users should control what they receive. The preference service is a simple
CRUD store that the notification service checks before sending.

```
User preferences table:
┌──────────┬──────────────┬──────────┬─────────┐
│ user_id  │ category     │ channel  │ enabled │
├──────────┼──────────────┼──────────┼─────────┤
│ user_123 │ marketing    │ push     │ false   │
│ user_123 │ marketing    │ email    │ true    │
│ user_123 │ social       │ push     │ true    │
│ user_123 │ social       │ email    │ false   │
│ user_123 │ security     │ *        │ true    │  ← can't disable
└──────────┴──────────────┴──────────┴─────────┘
```

```
Notification Service logic:

1. Receive notification for user_123, type "marketing", channels ["push", "email"]
2. Fetch preferences for user_123
3. Filter: push=disabled for marketing → remove push
4. Remaining channels: [email]
5. Send only email
```

Cache preferences in Redis (users don't change preferences often).
Invalidate on preference update.

---

### Deep Dive 6: Retry with Exponential Backoff

Third-party providers fail. APNs might be down, SendGrid might throttle
you, Twilio might timeout. You need retry logic that doesn't make things
worse.

**Analogy:** Like calling a restaurant for a reservation. If they're busy,
you don't call back every 2 seconds — that makes their phone ring
constantly. You wait 5 minutes, then 15 minutes, then an hour.

```
Retry schedule:
  Attempt 1: immediate
  Attempt 2: wait 1 second
  Attempt 3: wait 4 seconds
  Attempt 4: wait 16 seconds
  Attempt 5: wait 64 seconds
  Attempt 6: wait 256 seconds (~4 minutes)
  Give up after 6 attempts → move to dead letter queue

Formula: delay = base^attempt (exponential)
With jitter: delay = base^attempt + random(0, base^attempt * 0.5)
```

Jitter prevents the "thundering herd" problem — if a provider goes down
and comes back, you don't want all retries hitting it at the exact same
time.

```
Retry flow:

┌──────────┐     ┌──────────────┐     ┌──────────┐
│  Worker  │────▶│  Send via    │────▶│ Success? │
│          │     │  Provider    │     │          │
└──────────┘     └──────────────┘     └────┬─────┘
                                           │
                                    Yes────┴────No
                                    │           │
                              ┌─────▼───┐  ┌───▼──────┐
                              │  Mark   │  │ Retries  │
                              │ Delivered│  │ left?    │
                              └─────────┘  └───┬──────┘
                                               │
                                        Yes────┴────No
                                        │           │
                                  ┌─────▼────┐ ┌───▼──────┐
                                  │ Re-enqueue│ │ Dead     │
                                  │ with delay│ │ Letter   │
                                  └──────────┘ │ Queue    │
                                               └──────────┘
```

**Dead letter queue (DLQ):** Notifications that fail all retries go here.
An operator or automated process reviews them. Maybe the user's device
token is invalid (uninstalled the app), or their email bounced.

---

### Deep Dive 7: Analytics and Tracking

How do you know if notifications are working?

```
Tracking pipeline:

┌────────────┐     ┌────────────┐     ┌────────────┐
│  Send      │────▶│  Delivery  │────▶│  Open/     │
│  Event     │     │  Callback  │     │  Click     │
│            │     │ (provider  │     │  Tracking  │
│  "sent to  │     │  webhook)  │     │ (pixel/    │
│   APNs"    │     │  "delivered│     │  redirect) │
└──────┬─────┘     └──────┬─────┘     └──────┬─────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                   ┌──────▼──────┐
                   │  Analytics  │
                   │  Database   │
                   │ (ClickHouse │
                   │  or similar)│
                   └─────────────┘
```

**Email open tracking:** Embed a 1x1 pixel image with a unique URL. When
the email client loads the image, you log the open.

**Email click tracking:** Replace links with redirect URLs through your
tracking service. When clicked, log the event and redirect to the original
URL.

**Push notification tracking:** APNs and FCM provide delivery receipts via
webhooks. For opens, instrument your app to report when a notification is
tapped.

Key metrics to track:

```
Per notification type:
  - Sent count
  - Delivery rate (delivered / sent)
  - Open rate (opened / delivered)
  - Click rate (clicked / opened)
  - Unsubscribe rate (opted out after receiving)

Per channel:
  - Provider error rates
  - Average delivery latency
  - Cost per notification
```

---

## Step 4: Scaling

### Partition Workers by Channel

Each channel has different throughput characteristics:

```
Push workers:   High throughput, low latency
                → 20 workers, batching to APNs/FCM

Email workers:  Medium throughput, higher latency acceptable
                → 10 workers, batch sends via SendGrid

SMS workers:    Low throughput (expensive), strict rate limits
                → 3 workers, careful throttling

In-app workers: Internal only, fast
                → 5 workers, direct write to in-app store
```

### Separate Queues Per Priority

```
                     ┌─────────────────┐
                     │  Notification   │
                     │  Service        │
                     └────────┬────────┘
                              │
               ┌──────────────┼──────────────┐
               │              │              │
        ┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
        │ Critical Q  │ │ Normal Q │ │  Low Q      │
        │ (dedicated) │ │          │ │ (throttled) │
        └──────┬──────┘ └────┬─────┘ └──────┬──────┘
               │             │              │
        ┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
        │ 10 workers  │ │ 5 workers│ │ 2 workers   │
        │ (fast drain)│ │          │ │ (slow drain)│
        └─────────────┘ └──────────┘ └─────────────┘
```

### Provider Failover

Don't depend on a single provider. If SendGrid goes down, fall back to
Amazon SES. If Twilio fails, try Vonage.

```
Channel: Email
  Primary:   SendGrid
  Secondary: Amazon SES
  Tertiary:  Mailgun

Channel: SMS
  Primary:   Twilio
  Secondary: Vonage

Failover logic:
  if primary.send() fails with 5xx:
    try secondary
  if secondary fails:
    try tertiary
  if all fail:
    enqueue for retry
```

### Scheduled Notifications

For notifications scheduled for the future (e.g., "remind me in 2 hours"):

```
┌────────────┐     ┌──────────────┐     ┌────────────┐
│  Schedule  │────▶│  Scheduler   │────▶│  Message   │
│  Request   │     │  Database    │     │  Queue     │
│ (send at   │     │ (poll every  │     │ (process   │
│  3:00 PM)  │     │  minute for  │     │  normally) │
└────────────┘     │  due items)  │     └────────────┘
                   └──────────────┘

Alternative: Use delayed messages in the queue
(RabbitMQ supports this natively, Kafka needs a scheduler)
```

---

## Complete Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                     NOTIFICATION SOURCES                              │
│  Order Svc │ Auth Svc │ Social Svc │ Marketing │ Scheduler           │
└──────┬─────┴────┬─────┴─────┬──────┴─────┬─────┴───────┬────────────┘
       └──────────┴───────────┴────────────┴─────────────┘
                              │
                       ┌──────▼───────┐
                       │    API       │──▶ Validate, idempotency check
                       │   Gateway    │──▶ Rate limit (global)
                       └──────┬───────┘
                              │
                       ┌──────▼───────┐
                       │ Notification │──▶ Fetch user preferences
                       │   Service    │──▶ Check per-user rate limits
                       │              │──▶ Render templates
                       │              │──▶ Classify priority
                       └──────┬───────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
    ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
    │ Critical Q  │    │ Normal Q    │    │  Low Q      │
    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
           │                  │                  │
    ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
    │ Push Workers│    │Email Workers│    │ SMS Workers │
    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
           │                  │                  │
    ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
    │ APNs / FCM  │    │ SendGrid/  │    │   Twilio    │
    │ (primary)   │    │  SES       │    │  / Vonage   │
    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
           └──────────────────┼──────────────────┘
                              │
                       ┌──────▼───────┐
                       │  Analytics   │──▶ Delivery status
                       │  Pipeline    │──▶ Open/click tracking
                       │  (Kafka →    │──▶ Dashboards
                       │  ClickHouse) │
                       └──────────────┘

  Supporting services:
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ User Pref    │  │  Template    │  │   Dedup      │
  │ Service      │  │  Service     │  │   Store      │
  │ (prefs DB    │  │ (template DB │  │  (Redis)     │
  │  + Redis     │  │  + renderer) │  │              │
  │  cache)      │  │              │  │              │
  └──────────────┘  └──────────────┘  └──────────────┘
```

---

## Trade-Off Summary

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| Queue | Single queue, priority field | Separate queues per priority | Separate — isolate critical from low |
| Dedup | Database check | Redis set with TTL | Redis — fast, auto-expire |
| Templates | Hardcoded strings | Template engine + store | Template engine — change without deploy |
| Retry | Fixed interval | Exponential backoff + jitter | Backoff + jitter — don't amplify failures |
| Provider | Single per channel | Multiple with failover | Multiple — providers go down |
| Tracking | Per-notification DB row | Event stream + OLAP | Event stream — analytics at scale |

---

## Common Interview Follow-Ups

**Q: How do you handle invalid device tokens?**
When APNs or FCM returns "invalid token," remove it from the user's device
registry. Many tokens become invalid when users uninstall the app. Run a
periodic cleanup job to validate stored tokens.

**Q: How do you handle timezone-aware notifications?**
Store user timezone in the preference service. The scheduler converts
"send at 9 AM user-local-time" to UTC before enqueueing.

**Q: How do you prevent notification fatigue?**
1. Global daily cap per user (e.g., max 15 notifications/day across all types)
2. Smart batching — combine multiple social notifications into one
   ("Alice, Bob, and 3 others liked your post")
3. Machine learning — predict which notifications a user will engage with

**Q: How would you add a new channel (e.g., WhatsApp Business)?**
1. Create a new worker that implements the channel interface
2. Add the channel to the routing logic in the notification service
3. Add user preference options for the new channel
4. Deploy the worker — no changes to the core notification service needed

This is the power of the queue-based architecture: channel workers are
independent, pluggable components.

---

## Hands-On Exercise

Build a minimal notification service:

1. Create a notification API that accepts channel, user, and message data
2. Implement a simple in-memory queue with three priority levels
3. Build a "push worker" that simulates sending (just logs it)
4. Add idempotency checking with an in-memory set
5. Implement exponential backoff retry (simulate 30% failure rate)
6. Add per-user rate limiting (max 5 notifications per minute)

---

## Key Takeaways

1. **Decouple with queues** — the API should never directly call third-party
   providers. Queues give you retry, buffering, and rate control for free
2. **Idempotency is non-negotiable** — duplicate notifications destroy user
   trust faster than missing notifications
3. **Priority queues prevent critical notifications from being delayed** by
   a marketing email blast
4. **Retry with backoff + jitter** — never hammer a failing provider
5. **Provider failover** — never depend on a single external service
6. **User preferences are a first-class concern**, not an afterthought

---

*Next: [Lesson 21 — Design a Rate Limiter](./21-design-rate-limiter.md),
where we implement the algorithms that protect systems from overload.*
