# Lesson 15: Webhooks & Event-Driven APIs

> Instead of clients asking "anything new?" every 5 seconds,
> the server says "here, this just happened."

---

## Polling vs Webhooks

```
  POLLING (client-driven):
  Client: "Any new orders?"   Server: "No."
  Client: "Any new orders?"   Server: "No."
  Client: "Any new orders?"   Server: "No."
  Client: "Any new orders?"   Server: "Yes! Here's one."

  99% of requests are wasted!

  WEBHOOKS (server-driven):
  Server: (order arrives)
  Server: POST to client's URL -> "Here's the new order"

  Zero wasted requests. Instant delivery.

  +----------+                    +----------+
  | Provider |  POST /webhook --> | Consumer |
  | (Stripe) |  {event data}     | (You)    |
  +----------+                    +----------+

  COMPARISON:
  +------------------+------------------+-------------------+
  |                  | Polling          | Webhooks          |
  +------------------+------------------+-------------------+
  | Latency          | Up to interval   | Near real-time    |
  | Wasted requests  | Many (99%+)      | Zero              |
  | Server load      | High             | Low               |
  | Client needs     | Just HTTP client | Public URL        |
  | Reliability      | Client controls  | Server must retry |
  | Debugging        | Easy             | Harder            |
  +------------------+------------------+-------------------+
```

---

## Webhook Architecture

```
  REGISTRATION:
  POST /webhooks
  {
    "url": "https://myapp.com/hooks/stripe",
    "events": ["payment.completed", "payment.failed"],
    "secret": "whsec_..."
  }

  DELIVERY:
  POST https://myapp.com/hooks/stripe
  Content-Type: application/json
  X-Webhook-Signature: sha256=abc123...
  X-Webhook-ID: evt_123
  X-Webhook-Timestamp: 1705000000

  {
    "id": "evt_123",
    "type": "payment.completed",
    "created_at": "2024-01-12T10:00:00Z",
    "data": {
      "payment_id": "pay_456",
      "amount": 5000,
      "currency": "usd"
    }
  }

  CONSUMER RESPONSE:
  200 OK (or 2xx) = acknowledged
  Anything else = retry
```

---

## Webhook Delivery System

```
  DELIVERY PIPELINE:

  Event occurs
      |
      v
  +------------------+
  | Event Store      |  Persist event (for replay)
  +------------------+
      |
      v
  +------------------+
  | Delivery Queue   |  Async delivery (don't block producer)
  +------------------+
      |
      v
  +------------------+
  | Delivery Worker  |  POST to consumer URL
  +------------------+
      |
      +-- 2xx? -> Mark delivered
      |
      +-- Timeout/5xx? -> Schedule retry
      |
      +-- 4xx? -> Mark failed (don't retry client errors)
```

```python
import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from enum import Enum

class DeliveryStatus(Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRYING = "retrying"

@dataclass
class WebhookEvent:
    event_id: str
    event_type: str
    payload: dict
    created_at: float = field(default_factory=time.time)

@dataclass
class WebhookSubscription:
    subscription_id: str
    url: str
    events: List[str]
    secret: str
    active: bool = True

@dataclass
class DeliveryAttempt:
    event_id: str
    subscription_id: str
    attempt_number: int
    status: DeliveryStatus
    status_code: Optional[int] = None
    next_retry_at: Optional[float] = None
    response_body: Optional[str] = None

class WebhookService:
    def __init__(self):
        self.subscriptions: Dict[str, WebhookSubscription] = {}
        self.events: List[WebhookEvent] = []
        self.deliveries: List[DeliveryAttempt] = []
        self.max_retries = 5
        self.retry_intervals = [60, 300, 1800, 7200, 36000]

    def register(self, sub: WebhookSubscription):
        self.subscriptions[sub.subscription_id] = sub

    def sign_payload(self, payload: bytes, secret: str) -> str:
        return hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()

    def publish_event(self, event: WebhookEvent):
        self.events.append(event)
        for sub in self.subscriptions.values():
            if not sub.active:
                continue
            if event.event_type not in sub.events and "*" not in sub.events:
                continue
            self._schedule_delivery(event, sub)

    def _schedule_delivery(self, event: WebhookEvent, sub: WebhookSubscription):
        attempt = DeliveryAttempt(
            event_id=event.event_id,
            subscription_id=sub.subscription_id,
            attempt_number=1,
            status=DeliveryStatus.PENDING,
        )
        self.deliveries.append(attempt)

    def prepare_request(self, event: WebhookEvent, sub: WebhookSubscription) -> dict:
        payload = json.dumps({
            "id": event.event_id,
            "type": event.event_type,
            "created_at": event.created_at,
            "data": event.payload,
        }).encode()

        signature = self.sign_payload(payload, sub.secret)

        return {
            "url": sub.url,
            "headers": {
                "Content-Type": "application/json",
                "X-Webhook-ID": event.event_id,
                "X-Webhook-Signature": f"sha256={signature}",
                "X-Webhook-Timestamp": str(int(event.created_at)),
            },
            "body": payload,
        }

    def get_retry_delay(self, attempt_number: int) -> float:
        idx = min(attempt_number - 1, len(self.retry_intervals) - 1)
        return self.retry_intervals[idx]
```

---

## Webhook Verification

Consumers MUST verify that webhooks actually came from
the expected provider.

```
  HMAC SIGNATURE VERIFICATION:

  Provider:
  1. Compute HMAC-SHA256(payload, shared_secret)
  2. Send in X-Webhook-Signature header

  Consumer:
  1. Read the raw request body (before parsing)
  2. Compute HMAC-SHA256(body, shared_secret)
  3. Compare with header value
  4. If match: genuine. If not: REJECT.

  ALSO CHECK:
  - Timestamp is recent (within 5 minutes)
  - Event ID hasn't been seen before (replay protection)
```

```python
import hmac
import hashlib
import time

def verify_webhook(
    payload: bytes,
    signature_header: str,
    secret: str,
    timestamp_header: str,
    tolerance_seconds: int = 300,
) -> bool:
    timestamp = int(timestamp_header)
    now = int(time.time())
    if abs(now - timestamp) > tolerance_seconds:
        return False

    signed_payload = f"{timestamp}.{payload.decode()}".encode()
    expected = hmac.new(
        secret.encode(),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    provided = signature_header.replace("sha256=", "")
    return hmac.compare_digest(expected, provided)
```

---

## Retry Strategy

```
  EXPONENTIAL BACKOFF:
  Attempt 1: immediately
  Attempt 2: after 1 minute
  Attempt 3: after 5 minutes
  Attempt 4: after 30 minutes
  Attempt 5: after 2 hours
  Attempt 6: after 10 hours
  Give up after 24 hours total.

  +-----+----------+---------+
  | Try | Delay    | Total   |
  +-----+----------+---------+
  | 1   | 0        | 0       |
  | 2   | 1 min    | 1 min   |
  | 3   | 5 min    | 6 min   |
  | 4   | 30 min   | 36 min  |
  | 5   | 2 hr     | 2h 36m  |
  | 6   | 10 hr    | 12h 36m |
  +-----+----------+---------+

  WHAT TRIGGERS A RETRY:
  - Timeout (consumer didn't respond in 30 seconds)
  - 5xx response (server error)
  - Connection refused
  - DNS failure

  WHAT DOES NOT RETRY:
  - 2xx response (success!)
  - 4xx response (client error — retrying won't help)
  - Consumer returned 410 Gone (unsubscribe)
```

---

## Event-Driven API Patterns

```
  PATTERN 1: SIMPLE WEBHOOK
  Provider sends one event to one URL.
  Most common. Used by Stripe, GitHub, Slack.

  PATTERN 2: EVENT FEED (pull-based)
  GET /events?after=evt_123&limit=100
  Consumer polls for events.
  Good when consumer can't expose a public URL.

  PATTERN 3: SERVER-SENT EVENTS (SSE)
  Client opens long-lived HTTP connection.
  Server pushes events as they happen.
  One-directional. Simpler than WebSockets.

  GET /events/stream
  Content-Type: text/event-stream

  data: {"type": "order.created", "id": "ord_1"}

  data: {"type": "order.shipped", "id": "ord_1"}

  PATTERN 4: WEBSOCKET EVENTS
  Bidirectional. Client and server can send.
  Best for real-time interactive applications.

  PATTERN 5: MESSAGE QUEUE (Kafka, RabbitMQ)
  For internal service-to-service communication.
  Consumer groups, ordering guarantees, replay.
```

---

## Designing Webhook Events

```
  EVENT NAMING:
  resource.action format

  GOOD:                          BAD:
  order.created                  newOrder
  order.updated                  ORDER_UPDATE
  payment.completed              paymentDone
  user.deleted                   removeUser

  EVENT PAYLOAD:
  Include enough data for the consumer to act
  WITHOUT making additional API calls.

  LEAN (consumer must fetch more):
  {
    "type": "order.created",
    "data": { "order_id": "ord_123" }
  }

  FAT (consumer has everything):
  {
    "type": "order.created",
    "data": {
      "order_id": "ord_123",
      "customer": { "id": "cust_1", "name": "Alice" },
      "items": [{ "sku": "WIDGET", "qty": 2, "price": 999 }],
      "total": 1998,
      "currency": "usd"
    }
  }

  BEST PRACTICE: fat events.
  Reduces round-trips. Consumer can process independently.
```

---

## Idempotency

```
  PROBLEM: retries mean duplicate deliveries.

  Event: payment.completed (id: evt_123)
  Attempt 1: delivered, but consumer returned timeout
  Attempt 2: delivered again

  Consumer processes payment TWICE!

  SOLUTION: idempotency on the consumer side.

  Consumer tracks processed event IDs:
  1. Receive event evt_123
  2. Check: have I processed evt_123 before?
     YES -> return 200 (already done)
     NO  -> process it, record evt_123, return 200

  processed_events = set()

  def handle_webhook(event):
      if event["id"] in processed_events:
          return 200  # already processed, skip
      process(event)
      processed_events.add(event["id"])
      return 200
```

---

## Exercises

### Exercise 1: Build a Webhook System

Implement a complete webhook system:
1. Registration endpoint (subscribe to events)
2. Event publishing (trigger delivery to subscribers)
3. Signature generation and verification
4. Retry with exponential backoff (simulate failures)
5. Event replay endpoint (re-deliver past events)

### Exercise 2: Webhook Consumer

Build a consumer that:
1. Receives webhooks on a public endpoint
2. Verifies the signature
3. Checks timestamp freshness (reject > 5 min old)
4. Deduplicates events (idempotency)
5. Processes the event and returns 200

### Exercise 3: Event Feed

Implement a pull-based event feed as an alternative:
1. `GET /events?after=<cursor>&limit=100`
2. Return events in chronological order
3. Include a cursor for the next page
4. Consumer polls every 30 seconds
5. Compare latency and reliability with push webhooks

### Exercise 4: Monitoring Dashboard

Build monitoring for your webhook system:
1. Track delivery success rate per subscriber
2. Track average delivery latency
3. Track retry rate (how many events need retries?)
4. Alert when a subscriber's failure rate > 50%
5. Auto-disable subscribers that fail > 90% for 24 hours

---

## Key Takeaways

```
  1. Webhooks: server pushes events, no polling waste
  2. Sign payloads with HMAC-SHA256 for verification
  3. Check timestamp freshness to prevent replay attacks
  4. Retry with exponential backoff (1min, 5min, 30min...)
  5. Don't retry 4xx errors (client's problem)
  6. Fat events reduce consumer round-trips
  7. Consumers MUST be idempotent (track event IDs)
  8. Event feed is a pull-based alternative for no-URL consumers
  9. SSE for one-way real-time streaming
  10. Resource.action naming convention for events
```

---

Next: [Lesson 16 — Design an API (Capstone)](./16-design-an-api.md)
