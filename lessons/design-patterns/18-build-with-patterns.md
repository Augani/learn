# Lesson 18: Build With Patterns (Capstone)

> **The one thing to remember**: Patterns aren't academic exercises —
> they're tools for fixing real, messy code. In this capstone, you'll
> take a deliberately terrible codebase and systematically refactor it
> using SOLID principles, GoF patterns, and clean architecture. This
> is what applying patterns looks like in practice.

---

## The Scenario

You've inherited a small e-commerce order processing system. It
works, but it's painful to change, impossible to test, and new
developers take weeks to understand it.

Your job: refactor it step by step, applying the patterns you've
learned. We'll start with the messy version, identify the problems,
and fix them one at a time.

---

## The Messy Codebase

Here's the "before" code. Read it and identify every problem:

```typescript
class OrderManager {
  private db = new Database("postgres://localhost:5432/shop");
  private stripe = new StripeClient(process.env.STRIPE_KEY!);

  async handleOrder(req: any): Promise<any> {
    const data = req.body;

    if (!data.email || !data.email.includes("@")) {
      return { status: 400, error: "bad email" };
    }

    if (!data.items || data.items.length === 0) {
      return { status: 400, error: "no items" };
    }

    let total = 0;
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const product = await this.db.query(
        `SELECT * FROM products WHERE id = '${item.productId}'`
      );
      if (!product) {
        return { status: 400, error: "product not found" };
      }
      if (product.stock < item.quantity) {
        return { status: 400, error: "not enough stock" };
      }
      total += product.price * item.quantity;

      if (data.coupon === "SAVE10") {
        total = total * 0.9;
      } else if (data.coupon === "SAVE20") {
        total = total * 0.8;
      } else if (data.coupon === "HALFOFF") {
        total = total * 0.5;
      }
    }

    if (total > 10000) {
      total = total * 0.95;
    }

    try {
      const payment = await this.stripe.charges.create({
        amount: Math.round(total * 100),
        currency: "usd",
        source: data.paymentToken,
      });

      await this.db.query(
        `INSERT INTO orders (customer_email, total, payment_id, status)
         VALUES ('${data.email}', ${total}, '${payment.id}', 'confirmed')`
      );

      for (const item of data.items) {
        await this.db.query(
          `INSERT INTO order_items (order_id, product_id, quantity)
           VALUES (LASTVAL(), '${item.productId}', ${item.quantity})`
        );
        await this.db.query(
          `UPDATE products SET stock = stock - ${item.quantity}
           WHERE id = '${item.productId}'`
        );
      }

      const nodemailer = require("nodemailer");
      const transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        auth: { user: "shop@gmail.com", pass: "password123" },
      });
      await transport.sendMail({
        from: "shop@gmail.com",
        to: data.email,
        subject: "Order Confirmed!",
        html: `<h1>Thanks!</h1><p>Total: $${total}</p>`,
      });

      console.log("Order placed: " + data.email + " $" + total);

      return { status: 200, orderId: payment.id };
    } catch (e) {
      console.log("ERROR: " + e);
      return { status: 500, error: "something went wrong" };
    }
  }
}
```

---

## Step 1: Identify the Problems

Before writing any code, catalog every issue:

```
PROBLEM INVENTORY

  ┌─────────────────────────────────────────────────────┐
  │ #  PROBLEM                    PRINCIPLE VIOLATED     │
  │                                                      │
  │ 1  God Object (does everything)     SRP             │
  │ 2  Direct DB connection (no DI)     DIP             │
  │ 3  SQL injection vulnerability      Security        │
  │ 4  Hardcoded credentials            Security        │
  │ 5  `any` types everywhere           Type safety     │
  │ 6  Coupon logic in wrong place      SRP             │
  │ 7  No transaction (partial failure) Correctness     │
  │ 8  Email logic mixed with orders    SRP             │
  │ 9  No error types (generic catch)   Error handling  │
  │ 10 Untestable (real DB, real Stripe) DIP            │
  │ 11 Magic numbers (10000, 0.9, etc)  Readability     │
  │ 12 Console.log for logging          SRP             │
  │ 13 Coupon discount applied per-item Bug!            │
  │ 14 No input validation on quantity  Defensive prog  │
  └─────────────────────────────────────────────────────┘
```

---

## Step 2: Define the Domain (Entities + Value Objects)

Start from the inside (Clean Architecture). Define what an Order
really IS, independent of any framework:

```typescript
class Money {
  constructor(
    readonly cents: number,
    readonly currency: string = "USD"
  ) {
    if (cents < 0) throw new InvalidMoneyError(cents);
    if (!Number.isInteger(cents)) throw new InvalidMoneyError(cents);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.cents * factor), this.currency);
  }

  applyDiscount(percentage: number): Money {
    if (percentage < 0 || percentage > 100) {
      throw new InvalidDiscountError(percentage);
    }
    return this.multiply(1 - percentage / 100);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}

class EmailAddress {
  readonly value: string;

  constructor(raw: string) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed.includes("@") || trimmed.length < 3) {
      throw new InvalidEmailError(raw);
    }
    this.value = trimmed;
  }
}

class OrderItem {
  constructor(
    readonly productId: string,
    readonly productName: string,
    readonly unitPrice: Money,
    readonly quantity: number
  ) {
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new InvalidQuantityError(quantity);
    }
  }

  subtotal(): Money {
    return this.unitPrice.multiply(this.quantity);
  }
}

class Order {
  readonly items: ReadonlyArray<OrderItem>;
  private _status: OrderStatus = "pending";

  constructor(
    readonly id: string,
    readonly customerEmail: EmailAddress,
    items: OrderItem[]
  ) {
    if (items.length === 0) throw new EmptyOrderError();
    this.items = [...items];
  }

  subtotal(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.subtotal()),
      new Money(0)
    );
  }

  confirm(): void {
    this._status = "confirmed";
  }

  get status(): OrderStatus {
    return this._status;
  }
}
```

Notice: no database, no HTTP, no frameworks. Pure business logic
with proper validation.

---

## Step 3: Extract Interfaces (Ports)

Define what the use case NEEDS without specifying HOW:

```typescript
interface ProductCatalog {
  findById(id: string): Promise<Product | null>;
  decrementStock(id: string, quantity: number): Promise<void>;
}

interface OrderRepository {
  save(order: Order): Promise<void>;
}

interface PaymentProcessor {
  charge(amount: Money, token: string): Promise<PaymentReceipt>;
}

interface OrderNotifier {
  sendConfirmation(order: Order, total: Money): Promise<void>;
}

interface DiscountPolicy {
  apply(subtotal: Money, couponCode: string | null): Money;
}
```

---

## Step 4: Implement the Use Case

The use case orchestrates the business logic:

```typescript
interface PlaceOrderRequest {
  customerEmail: string;
  items: Array<{ productId: string; quantity: number }>;
  paymentToken: string;
  couponCode: string | null;
}

type PlaceOrderResult =
  | { success: true; orderId: string; total: Money }
  | { success: false; error: string };

class PlaceOrderUseCase {
  constructor(
    private catalog: ProductCatalog,
    private orders: OrderRepository,
    private payments: PaymentProcessor,
    private notifier: OrderNotifier,
    private discounts: DiscountPolicy
  ) {}

  async execute(request: PlaceOrderRequest): Promise<PlaceOrderResult> {
    const email = new EmailAddress(request.customerEmail);

    const orderItems: OrderItem[] = [];
    for (const item of request.items) {
      const product = await this.catalog.findById(item.productId);
      if (!product) {
        return { success: false, error: `Product not found: ${item.productId}` };
      }
      if (product.stock < item.quantity) {
        return { success: false, error: `Insufficient stock: ${product.name}` };
      }
      orderItems.push(
        new OrderItem(product.id, product.name, product.price, item.quantity)
      );
    }

    const order = new Order(generateId(), email, orderItems);
    const subtotal = order.subtotal();
    const total = this.discounts.apply(subtotal, request.couponCode);

    const receipt = await this.payments.charge(total, request.paymentToken);

    for (const item of request.items) {
      await this.catalog.decrementStock(item.productId, item.quantity);
    }

    order.confirm();
    await this.orders.save(order);
    await this.notifier.sendConfirmation(order, total);

    return { success: true, orderId: order.id, total };
  }
}
```

---

## Step 5: Implement the Strategy (Discounts)

The coupon logic becomes a Strategy:

```typescript
class StandardDiscountPolicy implements DiscountPolicy {
  private coupons: Record<string, number> = {
    SAVE10: 10,
    SAVE20: 20,
    HALFOFF: 50,
  };

  private readonly BULK_THRESHOLD = new Money(1_000_000);
  private readonly BULK_DISCOUNT = 5;

  apply(subtotal: Money, couponCode: string | null): Money {
    let total = subtotal;

    if (couponCode && this.coupons[couponCode]) {
      total = total.applyDiscount(this.coupons[couponCode]);
    }

    if (total.cents >= this.BULK_THRESHOLD.cents) {
      total = total.applyDiscount(this.BULK_DISCOUNT);
    }

    return total;
  }
}
```

Now adding a new coupon type doesn't touch the order logic.

---

## Step 6: Implement the Adapters

```typescript
class PostgresProductCatalog implements ProductCatalog {
  constructor(private pool: Pool) {}

  async findById(id: string): Promise<Product | null> {
    const result = await this.pool.query(
      "SELECT id, name, price_cents, stock FROM products WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      price: new Money(row.price_cents),
      stock: row.stock,
    };
  }

  async decrementStock(id: string, quantity: number): Promise<void> {
    await this.pool.query(
      "UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1",
      [quantity, id]
    );
  }
}

class StripePaymentProcessor implements PaymentProcessor {
  constructor(private client: StripeClient) {}

  async charge(amount: Money, token: string): Promise<PaymentReceipt> {
    const charge = await this.client.charges.create({
      amount: amount.cents,
      currency: amount.currency.toLowerCase(),
      source: token,
    });
    return { id: charge.id, amount };
  }
}

class SmtpOrderNotifier implements OrderNotifier {
  constructor(private transport: MailTransport) {}

  async sendConfirmation(order: Order, total: Money): Promise<void> {
    await this.transport.send({
      to: order.customerEmail.value,
      subject: "Order Confirmed",
      body: `Order ${order.id} confirmed. Total: $${(total.cents / 100).toFixed(2)}`,
    });
  }
}
```

---

## Step 7: Wire It Together (Composition Root)

```typescript
function createApp(): Express {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const stripe = new StripeClient(process.env.STRIPE_KEY!);
  const mailTransport = createTransport(process.env.SMTP_URL!);

  const placeOrder = new PlaceOrderUseCase(
    new PostgresProductCatalog(pool),
    new PostgresOrderRepository(pool),
    new StripePaymentProcessor(stripe),
    new SmtpOrderNotifier(mailTransport),
    new StandardDiscountPolicy()
  );

  const app = express();
  app.post("/orders", async (req, res) => {
    const result = await placeOrder.execute(req.body);
    if (result.success) {
      res.status(201).json({ orderId: result.orderId });
    } else {
      res.status(400).json({ error: result.error });
    }
  });

  return app;
}
```

---

## Step 8: Test Everything

```typescript
describe("PlaceOrderUseCase", () => {
  it("places a valid order", async () => {
    const catalog = new InMemoryCatalog([
      { id: "p1", name: "Widget", price: new Money(999), stock: 10 },
    ]);
    const orders = new InMemoryOrderRepo();
    const payments = new FakePaymentProcessor();
    const notifier = new FakeNotifier();
    const discounts = new StandardDiscountPolicy();

    const useCase = new PlaceOrderUseCase(
      catalog, orders, payments, notifier, discounts
    );

    const result = await useCase.execute({
      customerEmail: "test@example.com",
      items: [{ productId: "p1", quantity: 2 }],
      paymentToken: "tok_test",
      couponCode: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.total.cents).toBe(1998);
    }
    expect(orders.count()).toBe(1);
    expect(payments.charges).toHaveLength(1);
    expect(notifier.sent).toHaveLength(1);
  });

  it("rejects empty orders", async () => {
    // ... test with no items
  });

  it("applies coupon discounts", async () => {
    // ... test with coupon code
  });

  it("rejects insufficient stock", async () => {
    // ... test with quantity > stock
  });
});
```

No database. No Stripe. No SMTP server. Tests run in milliseconds.

---

## What We Applied

```
PATTERNS USED IN THIS REFACTORING

  PATTERN              WHERE                    WHY
  ──────────────────   ───────────────────────  ──────────────────
  Value Object         Money, EmailAddress       Type safety, validation
  Entity               Order, OrderItem          Business identity
  Repository           OrderRepository           Decouple from DB
  Strategy             DiscountPolicy            Swappable discounts
  Dependency Injection Everything                 Testability
  Facade               PlaceOrderUseCase         Simplify complex flow
  Adapter              StripePaymentProcessor     Wrap external API
  Clean Architecture   Layer separation           Maintainability

  PRINCIPLES APPLIED
  ──────────────────
  SRP:  Each class has one job
  OCP:  New discounts don't change order logic
  LSP:  Any PaymentProcessor implementation works
  ISP:  Small, focused interfaces
  DIP:  Use case depends on abstractions
```

---

## Your Turn

Take a piece of messy code from your own projects — or write
something deliberately messy — and refactor it using this approach:

1. **Inventory problems** (list every issue)
2. **Define domain objects** (entities and value objects)
3. **Extract interfaces** (ports for external dependencies)
4. **Write the use case** (orchestration logic)
5. **Implement adapters** (concrete implementations)
6. **Wire it together** (composition root)
7. **Write tests** (using fake implementations)

The goal isn't perfection. It's recognizing problems and having a
systematic approach to fixing them.

---

## Exercises

1. **Extend**: Add a feature to the refactored code: "orders over
   $500 get free shipping." Where does this logic live?

2. **New adapter**: Replace Stripe with a different payment
   processor. How many files do you need to change?

3. **New use case**: Add "cancel order" functionality. How does
   the architecture support this?

4. **Full refactor**: Take a real piece of messy code (200+ lines)
   from your work or a public repo. Apply this process. Time
   yourself and note what was hardest.

---

[← Previous: Anti-Patterns](./17-anti-patterns.md) · [Reference: All Patterns →](./reference-patterns.md)
