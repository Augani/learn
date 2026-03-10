# Lesson 03: Publish/Subscribe Pattern

> **The one thing to remember**: Pub/sub is a newspaper delivery
> system. The publisher (newspaper) doesn't know who reads it. The
> subscribers don't know who wrote it. They're connected only by the
> topic (sports, business, comics). Add or remove subscribers
> without changing anything about the publisher.

---

## The Newspaper Analogy

Before the internet, newspapers worked like this:

1. Reporters write articles on specific topics (sports, politics, weather)
2. The newspaper publishes them
3. You subscribe to the sections you care about
4. The newspaper delivers those sections to your doorstep

The reporters don't know your name. You don't know the reporters
personally. The newspaper company is the broker in the middle.
If a new neighbor moves in and subscribes, no reporter has to
change anything. If a reporter quits, you still get your paper
from whoever replaces them.

This is the publish/subscribe pattern.

```
THE NEWSPAPER MODEL

  Publishers                    Broker                Subscribers
  (Reporters)                 (Newspaper)             (Readers)

  Sports Writer ---+
                   |     +---> Sports Section ----> Alice (sports fan)
  Sports Writer ---+---->|                    ----> Bob (sports fan)
                         |
  Finance Writer --+---->+---> Finance Section ---> Carol (investor)
                   |     |                    ---> David (trader)
  Finance Writer --+     |
                         +---> Weather Section ---> Alice (also weather)
  Weather Writer ------->|                    ---> Eve (farmer)
```

---

## How Pub/Sub Works in Software

In a messaging system, the "newspaper sections" are called
**topics** (or sometimes **channels** or **subjects**).

```
PUB/SUB ARCHITECTURE

  Publisher 1 ----\                         /--> Subscriber A
                   \   +-----------+       /
  Publisher 2 -------->|  Topic:   |------/----> Subscriber B
                   /   | "orders" |       \
  Publisher 3 ----/    +-----------+       \---> Subscriber C

  ANY publisher can write to the topic.
  ALL subscribers receive EVERY message.
  Publishers and subscribers don't know about each other.
```

The key properties:

1. **Decoupling**: Publishers don't know who subscribes. Subscribers
   don't know who publishes. They only agree on the topic name and
   message format.

2. **Fan-out**: One message reaches ALL subscribers. Publish once,
   deliver to many.

3. **Dynamic**: Add or remove subscribers at any time. No
   configuration changes needed on the publisher side.

---

## Fan-Out: One Message, Many Consumers

Fan-out is the superpower of pub/sub. When something happens, you
publish one event and every interested service gets a copy.

```
FAN-OUT: Order Created Event

                         +---> Inventory Service (reserve items)
                         |
  Order Service          +---> Payment Service (charge card)
       |                 |
       +-- "order.created" ---> Email Service (send confirmation)
                         |
                         +---> Analytics Service (track metrics)
                         |
                         +---> Fraud Detection (check patterns)

  The Order Service publishes ONE message.
  FIVE services each get their own copy.
  Adding a 6th service requires ZERO changes to Order Service.
```

Compare this to the synchronous approach where the Order Service
would need to call each service individually. With pub/sub, the
Order Service doesn't even know these other services exist.

---

## Topics, Subscriptions, and Filtering

### Topics: Organizing Messages

Topics are named channels that organize messages by category.
Think of them as filing cabinets.

```
TOPIC HIERARCHY (common patterns)

  orders.created        orders.shipped        orders.cancelled
  payments.received     payments.refunded     payments.failed
  users.registered      users.updated         users.deleted
  inventory.reserved    inventory.released    inventory.low-stock
```

Some systems support **hierarchical topics** with wildcards:

```
WILDCARD SUBSCRIPTIONS

  Topic published:    orders.created
                      orders.shipped
                      orders.cancelled

  Subscriber A: "orders.*"        --> Gets ALL order events
  Subscriber B: "orders.created"  --> Gets ONLY new orders
  Subscriber C: "*.cancelled"     --> Gets ALL cancellation events
```

### Content-Based Filtering

Some systems let subscribers filter by message content, not just
the topic name:

```python
subscription = pubsub.subscribe(
    topic='orders',
    filter_expression="region = 'US' AND total > 1000"
)
```

This subscriber only receives high-value US orders. The broker
filters on the server side, so the subscriber doesn't waste
bandwidth receiving messages it'll ignore.

---

## Pub/Sub in Code: Real Examples

### Example 1: Redis Pub/Sub (Simplest)

Redis pub/sub is fire-and-forget. If nobody is listening when a
message is published, it's gone.

```python
import redis

r = redis.Redis()

r.publish('notifications', json.dumps({
    'type': 'order_shipped',
    'order_id': 'ord-789',
    'tracking': 'UPS-1234567890'
}))
```

```python
import redis

r = redis.Redis()
pubsub = r.pubsub()
pubsub.subscribe('notifications')

for message in pubsub.listen():
    if message['type'] == 'message':
        data = json.loads(message['data'])
        print(f"Notification: {data['type']} for {data['order_id']}")
```

### Example 2: Kafka Topics (Durable)

Kafka topics persist messages. Subscribers can join late and still
read old messages.

```java
// Publisher
Properties props = new Properties();
props.put("bootstrap.servers", "localhost:9092");
props.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
props.put("value.serializer", "org.apache.kafka.common.serialization.StringSerializer");

KafkaProducer<String, String> producer = new KafkaProducer<>(props);

producer.send(new ProducerRecord<>("order-events",
    orderId,
    "{\"type\":\"created\",\"orderId\":\"ord-789\",\"total\":59.99}"
));
```

```java
// Subscriber (Consumer Group: "email-service")
Properties props = new Properties();
props.put("bootstrap.servers", "localhost:9092");
props.put("group.id", "email-service");
props.put("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
props.put("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");

KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
consumer.subscribe(Arrays.asList("order-events"));

while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    for (ConsumerRecord<String, String> record : records) {
        sendOrderEmail(record.value());
    }
}
```

### Example 3: RabbitMQ Fanout Exchange

RabbitMQ implements pub/sub through fanout exchanges. The exchange
copies each message to every bound queue.

```python
import pika

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

channel.exchange_declare(exchange='order_events', exchange_type='fanout')

channel.basic_publish(
    exchange='order_events',
    routing_key='',
    body=json.dumps({
        'type': 'order_created',
        'order_id': 'ord-789',
        'items': [{'sku': 'SHOE-42', 'qty': 1}]
    })
)
```

```python
channel.exchange_declare(exchange='order_events', exchange_type='fanout')

result = channel.queue_declare(queue='', exclusive=True)
queue_name = result.method.queue
channel.queue_bind(exchange='order_events', queue=queue_name)

def callback(ch, method, properties, body):
    event = json.loads(body)
    print(f"Inventory: reserving items for {event['order_id']}")

channel.basic_consume(queue=queue_name, on_message_callback=callback, auto_ack=True)
channel.start_consuming()
```

---

## Pub/Sub vs Direct Messaging

```
DIRECT MESSAGING (Point-to-Point)

  Service A ---message---> Service B

  One sender, one receiver.
  A knows exactly who B is.
  Like sending a letter to a specific person.


PUB/SUB (Topic-Based)

  Service A ---event---> [ Topic ] ---copy---> Service B
                                   ---copy---> Service C
                                   ---copy---> Service D

  One sender, many receivers.
  A doesn't know who's listening.
  Like publishing in a newspaper.
```

| Feature | Direct (Point-to-Point) | Pub/Sub |
|---|---|---|
| Receivers | Exactly one | Zero or more |
| Coupling | Sender knows receiver | Sender knows only topic |
| Adding consumers | Change sender config | Just subscribe |
| Message fate | Consumed and gone | Delivered to all subscribers |
| Use case | Task distribution | Event notification |

---

## Common Pub/Sub Pitfalls

### The Slow Consumer Problem

If one subscriber processes messages slowly, what happens? It
depends on the system:

- **Kafka**: Slow consumer just falls behind. Its offset stays
  low while others advance. No impact on other consumers.
- **RabbitMQ**: The slow consumer's queue fills up, potentially
  causing memory issues on the broker.
- **Redis**: Messages are dropped if the consumer can't keep up.
  Redis pub/sub has no buffer.

### Message Ordering

Pub/sub systems generally preserve order per-publisher, but if
multiple publishers write to the same topic, ordering across
publishers is not guaranteed.

```
ORDERING GUARANTEE

  Publisher A:  [1] [2] [3]  --> Subscriber sees 1, 2, 3 (in order)
  Publisher B:  [X] [Y] [Z]  --> Subscriber sees X, Y, Z (in order)

  But INTERLEAVED, it might be: 1, X, 2, Y, 3, Z
  Or: X, 1, 2, Y, Z, 3
  Order WITHIN a publisher is preserved.
  Order ACROSS publishers is not guaranteed.
```

### The "Nobody's Listening" Problem

What happens if you publish to a topic with no subscribers?

- **Kafka**: Message is stored regardless. Future subscribers
  can read it.
- **RabbitMQ** (fanout): Message is discarded. No queue to
  store it in.
- **Redis**: Message is discarded. Fire and forget.

This is why Kafka is often preferred for event-driven architectures
— you can add new services that read historical events.

---

## Real-World Pub/Sub Examples

**Stock market data**: Exchanges publish price updates to topics
per stock symbol. Trading systems subscribe to the symbols they
care about. Thousands of subscribers, real-time delivery.

**Chat applications**: Each chat room is a topic. Users subscribe
when they join, unsubscribe when they leave. Messages fan out to
all participants.

**IoT sensor data**: Thousands of sensors publish temperature,
humidity, and pressure readings. Different systems subscribe:
alerting, dashboards, long-term storage.

**Microservices events**: When a user updates their profile, the
"user.updated" event fans out to the search index, the
recommendation engine, the email service, and the audit log.

---

## Exercises

1. **Design topics**: You're building a ride-sharing app (like
   Uber). Design the topic structure. What events would each
   service publish? What would each service subscribe to?

2. **Fan-out math**: Your system publishes 10,000 order events
   per second. You have 8 subscriber services. How many total
   message deliveries per second does the broker handle?

3. **Choose the system**: For each scenario, would you use Redis
   pub/sub, RabbitMQ fanout, or Kafka topics? Why?
   - Real-time game events (acceptable to lose some)
   - Financial transaction auditing
   - Distributing cache invalidation signals

4. **Build it**: Using Docker, set up RabbitMQ. Create a fanout
   exchange. Write one publisher and three subscribers in Python.
   Verify that all three subscribers receive every message.

---

[Next: Lesson 04 — Point-to-Point Messaging](./04-point-to-point.md)
