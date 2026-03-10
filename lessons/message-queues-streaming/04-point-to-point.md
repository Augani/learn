# Lesson 04: Point-to-Point Messaging

> **The one thing to remember**: Point-to-point messaging is like
> a deli counter with a ticket system. Each customer takes a number.
> When a clerk is free, they call the next number. Each ticket goes
> to exactly one clerk. If more customers show up, you add more
> clerks — but each order is still handled by just one.

---

## The Deli Counter Analogy

At a busy deli:

1. You take a number: **42**
2. Three clerks work behind the counter
3. Clerk A finishes with customer 39, calls "Number 40!"
4. Clerk B finishes with customer 41, calls "Number 42!" — that's you
5. Clerk C is still working on a complicated order

Each number (message) goes to exactly one clerk (consumer). No
two clerks work on the same number. If it's slow, one clerk handles
everything. If it's busy, all three clerks are working constantly.

```
POINT-TO-POINT: Deli Counter Model

  Customers                  Ticket Queue              Clerks
  (Producers)                                       (Consumers)

  Customer A ---> [42]          [39] [40] [41] [42]
  Customer B ---> [43]                |    |    |     Clerk A --> [40]
  Customer C ---> [44]                |    |    +--> Clerk B --> [42]
                                      |    |
                                      |    +-------> Clerk C --> [41]
                                      +-----------> Clerk A --> [39]

  Each ticket goes to EXACTLY ONE clerk.
  Clerks work in parallel but never duplicate work.
```

---

## How Point-to-Point Differs from Pub/Sub

This is the fundamental distinction:

```
PUB/SUB: One message, ALL subscribers get a copy

  Message ---> [Topic] ---> Consumer A (gets copy)
                       ---> Consumer B (gets copy)
                       ---> Consumer C (gets copy)

  3 consumers = 3 deliveries of the SAME message


POINT-TO-POINT: One message, ONE consumer gets it

  Message ---> [Queue] ---> Consumer A (gets it)
                             Consumer B (waiting)
                             Consumer C (waiting)

  3 consumers = 1 delivery, to whichever consumer is free
```

| Property | Pub/Sub | Point-to-Point |
|---|---|---|
| Who gets the message? | Everyone | Exactly one consumer |
| Purpose | Notification/broadcast | Work distribution |
| Adding consumers | More copies delivered | Work shared across more workers |
| Analogy | Radio broadcast | Deli counter |

---

## Competing Consumers Pattern

When multiple consumers read from the same queue, they're called
**competing consumers**. They compete for messages — whoever is
free next gets the next message.

```
COMPETING CONSUMERS

  Producer puts tasks in the queue at variable rates:

  Queue: [task-1] [task-2] [task-3] [task-4] [task-5] [task-6]
            |        |        |        |        |        |
            v        v        v        v        v        v
         Worker   Worker   Worker   Worker   Worker   Worker
           A        B        C        A        B        C

  Round-robin style (simplified). In reality, the next FREE
  worker gets the next message. Slow workers get fewer messages.

  This is HOW you scale work processing:
  Too slow? Add more workers.
  Too quiet? Remove some workers.
```

This is the standard pattern for:
- Processing uploaded files
- Sending emails or notifications
- Running background jobs
- Handling webhook deliveries
- Encoding video or audio
- Any task where work can be parallelized

### Code: Competing Consumers with RabbitMQ

**Producer** (sends tasks to the queue):

```python
import pika
import json

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

channel.queue_declare(queue='image_resize', durable=True)

for i in range(100):
    channel.basic_publish(
        exchange='',
        routing_key='image_resize',
        body=json.dumps({
            'image_id': f'img-{i}',
            'sizes': [128, 256, 512, 1024]
        }),
        properties=pika.BasicProperties(delivery_mode=2)
    )

print("Sent 100 image resize tasks")
```

**Worker** (run multiple copies of this):

```python
import pika
import json
import time

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

channel.queue_declare(queue='image_resize', durable=True)
channel.basic_qos(prefetch_count=1)

def process_image(ch, method, properties, body):
    task = json.loads(body)
    print(f"Resizing {task['image_id']} to sizes {task['sizes']}")
    time.sleep(2)
    print(f"Done: {task['image_id']}")
    ch.basic_ack(delivery_tag=method.delivery_tag)

channel.basic_consume(queue='image_resize', on_message_callback=process_image)
print("Worker waiting for tasks...")
channel.start_consuming()
```

Run three copies of the worker in separate terminals. Watch how the
100 tasks are distributed across all three workers automatically.

The key line is `prefetch_count=1`: each worker requests one message
at a time. This ensures a slow worker doesn't hog messages while
fast workers sit idle.

---

## Load Leveling

One of the most valuable properties of point-to-point queues is
**load leveling** — absorbing traffic spikes so your backend
services don't fall over.

```
WITHOUT QUEUE: Traffic spike hits services directly

  Requests     Services
  per second

  |  ****
  | ** **       Services must handle
  |**   **      the peak (5000 rps)
  *      **     or they crash
  |       ****
  +-----------> time

  Peak: 5000 rps --> Services need capacity for 5000 rps
  Average: 1000 rps --> 80% of capacity is wasted most of the time


WITH QUEUE: Queue absorbs the spike

  Requests       Queue         Services
  per second     depth         processing rate

  |  ****        grows         stays flat
  | ** **        during        at 1500 rps
  |**   **       spike
  *      **
  |       ****   drains        still 1500 rps
  +----------->  after spike
     time

  Peak: 5000 rps --> Queue buffers excess
  Services process at a steady 1500 rps
  Queue grows during spike, drains after
  Services never see more than 1500 rps
```

This is how large e-commerce sites handle Black Friday. Orders pour
in at 10x the normal rate, but the queue absorbs the spike. Workers
process steadily. Customers might wait a bit longer for their
confirmation email, but the system doesn't crash.

```
LOAD LEVELING TIMELINE

  Time    Incoming    Queue     Processing    Queue
          Rate        Adds      Rate          Depth
  ------  ---------   ------    ----------    ------
  10:00   100/s       100       100/s         0
  10:05   500/s       500       100/s         2000 (growing)
  10:10   5000/s      5000      100/s         25000 (spike!)
  10:15   500/s       500       100/s         27000 (still draining)
  10:30   100/s       100       100/s         20000 (draining)
  11:00   50/s        50        100/s         5000 (almost done)
  11:30   50/s        50        100/s         0 (caught up)
```

---

## Acknowledgments and Reliability

What happens if a worker crashes while processing a message? With
proper acknowledgment handling, the message goes back to the queue
for another worker.

```
ACKNOWLEDGMENT FLOW

  1. Worker pulls message from queue
     Queue: [msg-1] [msg-2] [msg-3]
     Worker: processing msg-1
     Status: msg-1 is "in-flight" (invisible to other workers)

  2a. SUCCESS: Worker sends ACK
      Queue: [msg-2] [msg-3]          (msg-1 removed)
      Worker: ready for next

  2b. FAILURE: Worker crashes (no ACK)
      Queue: [msg-1] [msg-2] [msg-3]  (msg-1 returns to queue)
      msg-1 will be picked up by another worker
```

```python
def process_task(ch, method, properties, body):
    try:
        result = do_work(json.loads(body))
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
```

The three acknowledgment modes:
- **ACK** (acknowledge): Message processed successfully. Remove it.
- **NACK** (negative acknowledge): Processing failed. Put it back.
- **REJECT**: Message is bad/unprocessable. Send to dead letter queue.

---

## Priority Queues

Sometimes not all tasks are equal. A password reset email should
be sent before a weekly newsletter. Priority queues let you
assign importance levels.

```
PRIORITY QUEUE

  Normal messages:     [news] [promo] [news] [promo]
  Priority messages:   [password-reset] [fraud-alert]

  Processing order: fraud-alert, password-reset, news, promo, news, promo

  Higher priority messages jump ahead in the queue.
```

```python
channel.queue_declare(
    queue='emails',
    durable=True,
    arguments={'x-max-priority': 10}
)

channel.basic_publish(
    exchange='',
    routing_key='emails',
    body=json.dumps({'type': 'newsletter', 'to': 'user@example.com'}),
    properties=pika.BasicProperties(priority=1)
)

channel.basic_publish(
    exchange='',
    routing_key='emails',
    body=json.dumps({'type': 'password_reset', 'to': 'user@example.com'}),
    properties=pika.BasicProperties(priority=9)
)
```

---

## Scaling with Point-to-Point

The beauty of the competing consumers pattern is horizontal scaling.
Need more throughput? Add more workers. Each new worker instantly
shares the load.

```
SCALING WORKERS

  Throughput needed: 1000 tasks/second
  Each worker handles: 100 tasks/second

  1 worker:   100/s   (way behind)
  5 workers:  500/s   (still behind)
  10 workers: 1000/s  (just right)
  12 workers: 1200/s  (comfortable headroom)

  No code changes. No configuration changes.
  Just start more worker processes.
```

This is also why containers and Kubernetes are a natural fit for
queue workers. Kubernetes can auto-scale workers based on queue
depth:

```
AUTOSCALING BASED ON QUEUE DEPTH

  Queue depth: 0-100     --> 2 workers (baseline)
  Queue depth: 100-500   --> 5 workers
  Queue depth: 500-2000  --> 10 workers
  Queue depth: 2000+     --> 20 workers (max)

  As queue fills, more workers spin up.
  As queue drains, workers scale down.
  You only pay for what you use.
```

---

## Point-to-Point vs Pub/Sub: When to Use Each

```
DECISION GUIDE

  "Each piece of work needs to be done ONCE"
  --> Point-to-Point (competing consumers)
  Example: Send this email, process this payment, resize this image

  "Multiple systems need to know about this EVENT"
  --> Pub/Sub (fan-out)
  Example: Order placed, user signed up, payment received

  "I need BOTH"
  --> Pub/Sub to fan out, then Point-to-Point within each service

  Order Created (event) --> [Topic: orders.created]
                              |
                              +--> Inventory Service --> [Queue] --> Workers
                              |
                              +--> Email Service --> [Queue] --> Workers
                              |
                              +--> Analytics Service --> [Queue] --> Workers
```

---

## Exercises

1. **Calculate capacity**: Your email service processes one email
   per 50ms. During a product launch, you expect 100,000 emails
   in 10 minutes. How many workers do you need? What's the queue
   depth at peak?

2. **Design for failure**: A worker crashes after reading a message
   but before finishing work. The message is requeued. But the
   worker already charged the customer's credit card. How do you
   prevent double-charging? (Hint: idempotency)

3. **Build it**: Create a task queue with RabbitMQ. Write a producer
   that generates 1000 tasks. Write a worker that takes 100ms per
   task. Run 1, 5, and 10 workers. Measure total time for each.
   Graph the results.

4. **Priority in practice**: Design a notification system with three
   priority levels: critical (security alerts), normal (order
   updates), low (marketing). How would you ensure critical messages
   are always processed first, even under heavy load?

---

[Next: Lesson 05 — Kafka Architecture](./05-kafka-architecture.md)
