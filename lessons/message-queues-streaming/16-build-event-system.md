# Lesson 16: Capstone — Build an Event-Driven Order Processing System

> **The one thing to remember**: This capstone ties together
> everything from the module. You'll build a real order processing
> system with Kafka, event sourcing, dead letter queues, and
> multiple consumers. When you're done, you'll have a working system
> that handles orders the way production systems do.

---

## What You'll Build

```
SYSTEM ARCHITECTURE

  +--------+     +------------------+     +------------------+
  | REST   |---->| Order Service    |---->| Kafka            |
  | API    |     | (Producer)       |     | Topic: orders    |
  +--------+     +------------------+     +--------+---------+
                                                   |
                      +----------------------------+---+
                      |                |               |
                      v                v               v
               +------+-----+  +------+-----+  +------+------+
               | Payment    |  | Inventory  |  | Notification|
               | Consumer   |  | Consumer   |  | Consumer    |
               +------+-----+  +------+-----+  +------+------+
                      |                |               |
                      v                v               v
               +------+-----+  +------+-----+  +------+------+
               | Kafka:     |  | Kafka:     |  | Email/SMS   |
               | payments   |  | inventory  |  | (simulated) |
               +------+-----+  +------+-----+  +-------------+
                      |                |
                      v                v
               +------+----------------------------------+
               |          Dead Letter Queue               |
               |          Kafka: orders-dlq               |
               +------------------------------------------+
                                   |
                                   v
               +------------------------------------------+
               |          DLQ Processor                    |
               |          (monitor and retry)              |
               +------------------------------------------+

  Event Store: All order events stored in Kafka
  Read Model: Order status view (rebuilt from events)
```

---

## Step 1: Set Up the Infrastructure

You need Docker for Kafka and ZooKeeper (or KRaft mode).

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  kafka:
    image: confluentinc/cp-kafka:7.5.0
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:29093
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:29093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LOG_DIRS: /var/lib/kafka/data
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'false'
      CLUSTER_ID: 'MkU3OEVBNTcwNTJENDM2Qk'
```

Start it and create topics:

```bash
docker compose up -d

docker exec -it $(docker ps -q) kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic orders \
  --partitions 3 \
  --replication-factor 1

docker exec -it $(docker ps -q) kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic order-events \
  --partitions 3 \
  --replication-factor 1

docker exec -it $(docker ps -q) kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic payments \
  --partitions 3 \
  --replication-factor 1

docker exec -it $(docker ps -q) kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic inventory \
  --partitions 3 \
  --replication-factor 1

docker exec -it $(docker ps -q) kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic orders-dlq \
  --partitions 1 \
  --replication-factor 1
```

Install Python dependencies:

```bash
pip install kafka-python flask
```

---

## Step 2: Define the Event Schema

All events follow a consistent structure:

```python
import json
import uuid
from datetime import datetime

def create_event(event_type, aggregate_id, data, correlation_id=None):
    return {
        'event_id': str(uuid.uuid4()),
        'event_type': event_type,
        'aggregate_id': aggregate_id,
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'correlation_id': correlation_id or str(uuid.uuid4()),
        'data': data,
        'version': 1
    }
```

Events in our system:

```
ORDER LIFECYCLE EVENTS

  OrderPlaced       --> Order created by customer
  PaymentRequested  --> Payment service asked to charge
  PaymentSucceeded  --> Payment went through
  PaymentFailed     --> Payment was declined
  InventoryReserved --> Items set aside in warehouse
  InventoryFailed   --> Items not available
  OrderConfirmed    --> Everything succeeded, order is live
  OrderFailed       --> Something went wrong, order cancelled
  NotificationSent  --> Customer was notified
```

---

## Step 3: Build the Order Service (Producer)

The order service accepts HTTP requests and publishes events:

```python
from flask import Flask, request, jsonify
from kafka import KafkaProducer
import json
import uuid

app = Flask(__name__)

producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    key_serializer=lambda k: k.encode('utf-8') if k else None,
    acks='all',
    enable_idempotence=True
)

@app.route('/orders', methods=['POST'])
def place_order():
    body = request.json
    order_id = f"ord-{uuid.uuid4().hex[:8]}"
    correlation_id = str(uuid.uuid4())

    event = create_event(
        event_type='OrderPlaced',
        aggregate_id=order_id,
        correlation_id=correlation_id,
        data={
            'customer_id': body['customer_id'],
            'items': body['items'],
            'total': sum(item['price'] * item['quantity']
                        for item in body['items']),
            'shipping_address': body.get('shipping_address', {})
        }
    )

    producer.send('order-events', key=order_id, value=event)
    producer.send('orders', key=order_id, value=event)

    producer.flush()

    return jsonify({
        'order_id': order_id,
        'status': 'placed',
        'correlation_id': correlation_id
    }), 202


@app.route('/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    order = rebuild_order_from_events(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    return jsonify(order)


def rebuild_order_from_events(order_id):
    from kafka import KafkaConsumer, TopicPartition

    consumer = KafkaConsumer(
        bootstrap_servers=['localhost:9092'],
        value_deserializer=lambda m: json.loads(m.decode('utf-8')),
        auto_offset_reset='earliest',
        consumer_timeout_ms=5000
    )

    partitions = consumer.partitions_for_topic('order-events')
    if not partitions:
        return None

    topic_partitions = [TopicPartition('order-events', p) for p in partitions]
    consumer.assign(topic_partitions)
    consumer.seek_to_beginning()

    order_state = None
    for message in consumer:
        event = message.value
        if event['aggregate_id'] != order_id:
            continue

        if order_state is None:
            order_state = {
                'order_id': order_id,
                'status': 'unknown',
                'events': []
            }

        order_state['events'].append(event['event_type'])

        if event['event_type'] == 'OrderPlaced':
            order_state.update({
                'status': 'placed',
                'customer_id': event['data']['customer_id'],
                'items': event['data']['items'],
                'total': event['data']['total']
            })
        elif event['event_type'] == 'PaymentSucceeded':
            order_state['status'] = 'paid'
        elif event['event_type'] == 'PaymentFailed':
            order_state['status'] = 'payment_failed'
        elif event['event_type'] == 'InventoryReserved':
            order_state['status'] = 'confirmed'
        elif event['event_type'] == 'OrderFailed':
            order_state['status'] = 'failed'

    consumer.close()
    return order_state


if __name__ == '__main__':
    app.run(port=5000)
```

---

## Step 4: Build the Payment Consumer

The payment consumer reads from the `orders` topic and processes
payments:

```python
from kafka import KafkaConsumer, KafkaProducer
import json
import random
import time

consumer = KafkaConsumer(
    'orders',
    bootstrap_servers=['localhost:9092'],
    group_id='payment-service',
    auto_offset_reset='earliest',
    value_deserializer=lambda m: json.loads(m.decode('utf-8')),
    enable_auto_commit=False
)

producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    key_serializer=lambda k: k.encode('utf-8') if k else None,
    acks='all'
)

dlq_producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    key_serializer=lambda k: k.encode('utf-8') if k else None
)

MAX_RETRIES = 3

def process_payment(event):
    order_id = event['aggregate_id']
    total = event['data']['total']

    print(f"Processing payment for {order_id}: ${total}")
    time.sleep(0.5)

    if random.random() < 0.1:
        raise Exception("Payment gateway timeout")

    success = random.random() < 0.9

    if success:
        payment_event = create_event(
            event_type='PaymentSucceeded',
            aggregate_id=order_id,
            correlation_id=event['correlation_id'],
            data={
                'amount': total,
                'payment_method': 'visa',
                'transaction_id': f"txn-{uuid.uuid4().hex[:8]}"
            }
        )
        print(f"Payment succeeded for {order_id}")
    else:
        payment_event = create_event(
            event_type='PaymentFailed',
            aggregate_id=order_id,
            correlation_id=event['correlation_id'],
            data={
                'amount': total,
                'reason': 'Insufficient funds'
            }
        )
        print(f"Payment FAILED for {order_id}")

    producer.send('order-events', key=order_id, value=payment_event)
    producer.send('payments', key=order_id, value=payment_event)


print("Payment consumer started...")
for message in consumer:
    event = message.value

    if event['event_type'] != 'OrderPlaced':
        consumer.commit()
        continue

    retry_count = event.get('_retry_count', 0)

    try:
        process_payment(event)
        consumer.commit()
    except Exception as e:
        print(f"Error processing {event['aggregate_id']}: {e}")

        if retry_count >= MAX_RETRIES:
            print(f"Max retries reached. Sending to DLQ.")
            event['_dlq_reason'] = str(e)
            event['_retry_count'] = retry_count
            dlq_producer.send(
                'orders-dlq',
                key=event['aggregate_id'],
                value=event
            )
            dlq_producer.flush()
            consumer.commit()
        else:
            event['_retry_count'] = retry_count + 1
            producer.send('orders', key=event['aggregate_id'], value=event)
            producer.flush()
            consumer.commit()
```

---

## Step 5: Build the Inventory Consumer

```python
from kafka import KafkaConsumer, KafkaProducer
import json
import time

consumer = KafkaConsumer(
    'payments',
    bootstrap_servers=['localhost:9092'],
    group_id='inventory-service',
    auto_offset_reset='earliest',
    value_deserializer=lambda m: json.loads(m.decode('utf-8')),
    enable_auto_commit=False
)

producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    key_serializer=lambda k: k.encode('utf-8') if k else None,
    acks='all'
)

inventory = {
    'SHOE-42': 100,
    'HAT-01': 50,
    'SHIRT-L': 75,
    'JACKET-M': 30
}

processed_orders = set()

def reserve_inventory(event):
    order_id = event['aggregate_id']

    if order_id in processed_orders:
        print(f"Already processed {order_id}, skipping (idempotent)")
        return

    print(f"Reserving inventory for {order_id}")
    time.sleep(0.3)

    all_available = True
    for item in event.get('_original_items', []):
        sku = item['sku']
        qty = item['quantity']
        if inventory.get(sku, 0) < qty:
            all_available = False
            break

    if all_available:
        for item in event.get('_original_items', []):
            inventory[item['sku']] -= item['quantity']

        inv_event = create_event(
            event_type='InventoryReserved',
            aggregate_id=order_id,
            correlation_id=event['correlation_id'],
            data={'reserved_items': event.get('_original_items', [])}
        )
        print(f"Inventory reserved for {order_id}")
    else:
        inv_event = create_event(
            event_type='InventoryFailed',
            aggregate_id=order_id,
            correlation_id=event['correlation_id'],
            data={'reason': 'Items not available'}
        )
        print(f"Inventory FAILED for {order_id}")

    producer.send('order-events', key=order_id, value=inv_event)
    producer.send('inventory', key=order_id, value=inv_event)
    processed_orders.add(order_id)


print("Inventory consumer started...")
for message in consumer:
    event = message.value

    if event['event_type'] != 'PaymentSucceeded':
        consumer.commit()
        continue

    try:
        reserve_inventory(event)
        consumer.commit()
    except Exception as e:
        print(f"Inventory error: {e}")
        consumer.commit()
```

---

## Step 6: Build the DLQ Processor

```python
from kafka import KafkaConsumer, KafkaProducer
import json
import time

consumer = KafkaConsumer(
    'orders-dlq',
    bootstrap_servers=['localhost:9092'],
    group_id='dlq-processor',
    auto_offset_reset='earliest',
    value_deserializer=lambda m: json.loads(m.decode('utf-8'))
)

producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    key_serializer=lambda k: k.encode('utf-8') if k else None
)

print("DLQ processor started...")
print("Monitoring dead letter queue for failed messages...\n")

for message in consumer:
    event = message.value
    order_id = event.get('aggregate_id', 'unknown')
    reason = event.get('_dlq_reason', 'unknown')
    retries = event.get('_retry_count', 0)

    print(f"DEAD LETTER: order={order_id}")
    print(f"  Reason: {reason}")
    print(f"  Retries: {retries}")
    print(f"  Event type: {event.get('event_type')}")
    print()

    should_retry = 'timeout' in reason.lower()

    if should_retry:
        print(f"  --> Retrying (transient failure)")
        event['_retry_count'] = 0
        event.pop('_dlq_reason', None)
        producer.send('orders', key=order_id, value=event)
        producer.flush()
    else:
        print(f"  --> Archived (non-retryable)")
        failure_event = create_event(
            event_type='OrderFailed',
            aggregate_id=order_id,
            correlation_id=event.get('correlation_id'),
            data={
                'reason': reason,
                'original_event': event.get('event_type')
            }
        )
        producer.send('order-events', key=order_id, value=failure_event)
        producer.flush()
```

---

## Step 7: Test the System

Open separate terminals for each service:

```bash
python order_service.py
python payment_consumer.py
python inventory_consumer.py
python dlq_processor.py
```

Send test orders:

```bash
curl -X POST http://localhost:5000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust-001",
    "items": [
      {"sku": "SHOE-42", "name": "Running Shoes", "price": 59.99, "quantity": 1},
      {"sku": "HAT-01", "name": "Baseball Cap", "price": 19.99, "quantity": 2}
    ]
  }'

curl http://localhost:5000/orders/<order-id-from-above>
```

---

## Step 8: Observe the Event Flow

Watch the events flow through the system:

```
EXPECTED EVENT FLOW

  1. POST /orders
     --> OrderPlaced event to [orders] and [order-events]

  2. Payment consumer reads OrderPlaced from [orders]
     --> Processes payment (simulated)
     --> PaymentSucceeded to [payments] and [order-events]
     (or PaymentFailed if declined)

  3. Inventory consumer reads PaymentSucceeded from [payments]
     --> Reserves inventory (simulated)
     --> InventoryReserved to [inventory] and [order-events]

  4. GET /orders/<id>
     --> Replays events from [order-events]
     --> Returns current state: { status: "confirmed", ... }

  If payment gateway timeout (random):
     --> Retried up to 3 times
     --> If still failing, sent to [orders-dlq]
     --> DLQ processor handles it
```

---

## Extensions and Challenges

Once the basic system works, try these enhancements:

1. **Add a notification consumer** that reads from `order-events`
   and prints confirmation messages for every `OrderConfirmed`.

2. **Add a real-time dashboard** that counts orders per minute
   using a tumbling window over the `order-events` topic.

3. **Implement the saga pattern**: If inventory fails after
   payment succeeded, publish a `RefundRequested` event and have
   the payment consumer process refunds.

4. **Add order status tracking**: Build a read model (simple
   in-memory dictionary or SQLite) that maintains current order
   status, updated by projecting events from `order-events`.

5. **Stress test**: Write a script that sends 1000 orders in
   rapid succession. Monitor how the system handles the load.
   Measure end-to-end latency from order placement to confirmation.

6. **Add metrics**: Track and print: messages processed per
   second, average processing latency, DLQ rate, retry rate.

---

## What You've Learned

By building this system, you've practiced:

- **Event-driven architecture**: Services communicate through events
- **Event sourcing**: Order state rebuilt from event history
- **Kafka producers and consumers**: With proper acks and commits
- **Consumer groups**: Multiple consumers sharing work
- **Dead letter queues**: Handling failures gracefully
- **Idempotency**: Using processed_orders set to prevent duplicates
- **Retry with backoff**: Exponential retry before dead-lettering
- **Event schema**: Consistent event structure across services

This is how real production systems work. The specifics vary (Java
instead of Python, Kubernetes instead of Docker, PostgreSQL read
models instead of in-memory) but the patterns are identical.

---

[Messaging Patterns Reference](./reference-patterns.md) |
[Tools Comparison Reference](./reference-tools.md)
