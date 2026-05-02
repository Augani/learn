# Lesson 13: Transactions and ACID — How Databases Stay Correct

You already know how to read and write data. But what happens when a
single logical operation requires MULTIPLE writes? What if one write
succeeds and the next fails? You can end up with data that is
half-updated — the most dangerous kind of bug because it looks almost
right.

Transactions solve this. They are the single most important concept
separating a database from a bunch of files.

---

## What Is a Transaction?

A transaction is a group of operations that are treated as ONE unit.
Either ALL of them succeed, or NONE of them do. There is no in-between.

**Analogy — moving apartments:**
You're moving from Apartment A to Apartment B. The "transaction" is:
1. Pack everything into the truck at Apartment A
2. Drive to Apartment B
3. Unload everything into Apartment B

If the truck breaks down halfway, you don't just leave half your stuff on
the highway. You either complete the entire move or you bring everything
back to Apartment A. You never end up with your couch on the road and
your bed in a third city.

---

## The ATM Problem: Why Transactions Exist

Here's the classic example. Alice wants to transfer $500 to Bob.

Without a transaction, this is two separate operations:

```
Step 1: Subtract $500 from Alice's account
Step 2: Add $500 to Bob's account
```

What if the power goes out after Step 1 but before Step 2?

- Alice lost $500
- Bob never received it
- $500 just vanished from the system

This is not a theoretical problem. Every financial system, inventory
system, and booking system faces this. The solution is to wrap both
operations in a transaction.

---

## Setting Up: The Bank Schema

```sql
-- Connect to learn_db and create our tables
CREATE TABLE accounts (
    id          SERIAL PRIMARY KEY,
    owner       TEXT NOT NULL,
    balance     NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT positive_balance CHECK (balance >= 0)
);

INSERT INTO accounts (owner, balance) VALUES
    ('Alice', 1000.00),
    ('Bob',    500.00),
    ('Charlie', 250.00);

SELECT * FROM accounts;
```

```
 id |  owner  | balance
----+---------+---------
  1 | Alice   | 1000.00
  2 | Bob     |  500.00
  3 | Charlie |  250.00
```

Notice the `CHECK (balance >= 0)` constraint. The database itself will
refuse to let a balance go negative. This is important — it means the
database helps enforce business rules.

---

## BEGIN, COMMIT, ROLLBACK

These three commands control transactions:

| Command    | What it does |
|------------|-------------|
| `BEGIN`    | Start a transaction — "I'm about to do a group of operations" |
| `COMMIT`  | Finish successfully — "Everything worked, make it permanent" |
| `ROLLBACK`| Cancel everything — "Something went wrong, undo it all" |

### The Safe Money Transfer

```sql
BEGIN;

UPDATE accounts SET balance = balance - 500 WHERE owner = 'Alice';
UPDATE accounts SET balance = balance + 500 WHERE owner = 'Bob';

-- Check balances before committing
SELECT owner, balance FROM accounts WHERE owner IN ('Alice', 'Bob');

COMMIT;
```

```
 owner | balance
-------+---------
 Alice |  500.00
 Bob   | 1000.00
```

Both updates happened. Both are now permanent. If ANYTHING had failed
between `BEGIN` and `COMMIT`, neither update would have taken effect.

### Rolling Back: The "Never Mind" Button

```sql
BEGIN;

UPDATE accounts SET balance = balance - 9999 WHERE owner = 'Bob';

-- Oh wait, that's wrong
SELECT owner, balance FROM accounts WHERE owner = 'Bob';
-- Shows Bob with a huge negative (but the CHECK constraint might catch this)

ROLLBACK;

-- Bob's balance is unchanged
SELECT owner, balance FROM accounts WHERE owner = 'Bob';
```

`ROLLBACK` undoes everything since `BEGIN`. It's as if those statements
never happened.

**Analogy — a whiteboard:**
`BEGIN` means you start writing on the whiteboard. `COMMIT` means you take
a photo of it and save it permanently. `ROLLBACK` means you wipe the
board clean. Until you take the photo, nothing is saved.

---

## What Happens When a Transaction Fails Mid-Way

Let's try to transfer more money than Alice has:

```sql
BEGIN;

UPDATE accounts SET balance = balance - 2000 WHERE owner = 'Alice';

-- This will fail because of the CHECK constraint (balance >= 0)
-- The transaction is now in an ERROR state
```

```
ERROR:  new row for relation "accounts" violates check constraint "positive_balance"
```

Once a transaction hits an error in PostgreSQL, it's "poisoned." You
can't run any more commands in it — every subsequent command will fail
with:

```
ERROR:  current transaction is aborted, commands ignored until end of transaction block
```

Your only option is `ROLLBACK`:

```sql
ROLLBACK;

-- Alice's balance is untouched
SELECT owner, balance FROM accounts;
```

This is exactly the safety guarantee you want. The database didn't let
a partial transfer happen.

---

## SAVEPOINT: Partial Rollback

Sometimes you want to undo PART of a transaction without losing
everything. `SAVEPOINT` creates a named bookmark you can roll back to.

**Analogy — video game save points:**
You're playing a hard level. You save at the boss door. You try the boss,
die, and reload from the save. You don't restart the entire game — just
from your save point.

```sql
BEGIN;

UPDATE accounts SET balance = balance - 100 WHERE owner = 'Alice';
-- Alice: 400 (she had 500 after our earlier transfer)

SAVEPOINT before_charlie;

UPDATE accounts SET balance = balance + 100 WHERE owner = 'Charlie';
-- Charlie: 350

-- Actually, we want to give it to Bob instead
ROLLBACK TO SAVEPOINT before_charlie;

-- Charlie's update is undone, but Alice's deduction still stands
UPDATE accounts SET balance = balance + 100 WHERE owner = 'Bob';

COMMIT;

SELECT * FROM accounts;
```

The key: `ROLLBACK TO SAVEPOINT` only undoes work back to that savepoint.
Everything before the savepoint remains intact, and the transaction is
still alive — you can keep going and eventually `COMMIT`.

### Nested Savepoints

You can create multiple savepoints and nest them:

```sql
BEGIN;

SAVEPOINT sp1;
UPDATE accounts SET balance = balance - 50 WHERE owner = 'Bob';

SAVEPOINT sp2;
UPDATE accounts SET balance = balance - 50 WHERE owner = 'Charlie';

-- Undo only the Charlie update
ROLLBACK TO SAVEPOINT sp2;

-- Bob's deduction is still in effect
COMMIT;
```

---

## ACID: The Four Guarantees

ACID is not just a buzzword. It's four specific guarantees that every
relational database provides. These guarantees are what separate a real
database from a file on disk.

### A — Atomicity

**"All or nothing. No halfway."**

**Analogy — a light switch:**
A light is either ON or OFF. You can't have it 50% on. A transaction
is the same: either every operation in the transaction completes, or
none of them do. There's no state where half the operations took effect.

In practice: if you have a transaction with 10 UPDATE statements and
the 7th one fails, the first 6 are rolled back too. It's as if you
never ran any of them.

```sql
BEGIN;

-- These three should all succeed or all fail as a unit
INSERT INTO accounts (owner, balance) VALUES ('Dave', 300.00);
INSERT INTO accounts (owner, balance) VALUES ('Eve', 400.00);
-- Simulate failure: try inserting a duplicate primary key or violating a constraint
INSERT INTO accounts (owner, balance) VALUES ('Frank', -100.00);
-- Fails: violates positive_balance constraint

ROLLBACK;

-- Dave and Eve were never created
SELECT * FROM accounts WHERE owner IN ('Dave', 'Eve', 'Frank');
-- Returns 0 rows
```

### C — Consistency

**"The database always moves from one valid state to another."**

**Analogy — a balanced checkbook:**
At the end of every transaction, the books must balance. If total money
in the system was $1,750 before a transfer, it must be $1,750 after.
You can't create or destroy money.

Consistency means your constraints, foreign keys, CHECK rules, NOT NULL
rules, and unique constraints are ALWAYS satisfied after a transaction
commits. The database will refuse to commit a transaction that would
violate any rule.

```sql
-- The CHECK constraint is a consistency rule
-- Try violating it:
BEGIN;
UPDATE accounts SET balance = -9999 WHERE owner = 'Alice';
-- ERROR: violates check constraint "positive_balance"
ROLLBACK;

-- Total money in the system should always be consistent
SELECT SUM(balance) AS total_money FROM accounts;
```

Real-world consistency rules:
- A foreign key reference must point to an existing row
- An email column marked UNIQUE can't have duplicates
- A NOT NULL column can't be empty
- A CHECK constraint must be satisfied

### I — Isolation

**"Your transaction can't see another transaction's unfinished work."**

**Analogy — exam cubicles:**
In an exam hall, each student works in their own cubicle. You can't see
what the person next to you is writing. You can't copy their half-written
answer. Only after everyone submits (commits) are the answers collected
and graded. Your work doesn't interfere with theirs until you both hand
in your papers.

In practice: two transactions running at the same time each see a
consistent snapshot of the data. Transaction A's uncommitted changes are
invisible to Transaction B.

We'll explore isolation levels in depth in [Lesson 14](./14-concurrency-mvcc.md),
but here's the core idea:

```
Session A:                          Session B:

BEGIN;
UPDATE accounts
  SET balance = 0
  WHERE owner = 'Alice';
                                    -- Session B runs a query:
                                    SELECT balance FROM accounts
                                      WHERE owner = 'Alice';
                                    -- Still sees Alice's OLD balance!
                                    -- Session A hasn't committed yet.

COMMIT;
                                    -- NOW Session B sees the new balance
                                    SELECT balance FROM accounts
                                      WHERE owner = 'Alice';
                                    -- Sees 0
```

### D — Durability

**"Once committed, it's permanent — even if the power goes out."**

**Analogy — a notarized document:**
When you get a document notarized, it's officially recorded. Even if the
office burns down, there's a record. Once `COMMIT` returns successfully,
your data is on disk. If the server crashes one millisecond later, your
data is still there when it comes back up.

How Postgres achieves this: the **Write-Ahead Log (WAL)**. Before telling
you "committed," Postgres writes the change to a durable log file. We'll
cover this in detail in [Lesson 15](./15-wal-recovery.md).

---

## Autocommit Mode

Here's something that surprises many developers: **every single SQL
statement you run outside of an explicit transaction IS its own
transaction.**

```sql
-- This:
INSERT INTO accounts (owner, balance) VALUES ('Grace', 100.00);

-- Is actually executed as:
BEGIN;
INSERT INTO accounts (owner, balance) VALUES ('Grace', 100.00);
COMMIT;
```

PostgreSQL wraps every standalone statement in an implicit transaction.
This is called **autocommit mode**. It means even a single INSERT either
fully succeeds or fully fails.

This is why you only need explicit `BEGIN`/`COMMIT` when you have
MULTIPLE statements that must succeed or fail together.

```sql
-- Clean up
DELETE FROM accounts WHERE owner = 'Grace';
```

---

## Practical Example: Inventory Update

Transactions aren't just for bank transfers. Here's an e-commerce
scenario: a customer buys a product, so you need to:

1. Decrease inventory
2. Create an order record
3. Create order line items

All three must succeed together. If the inventory goes to zero but the
order isn't created, you've lost track of a sale.

```sql
CREATE TABLE products (
    id    SERIAL PRIMARY KEY,
    name  TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    price NUMERIC(10,2) NOT NULL,
    CONSTRAINT positive_stock CHECK (stock >= 0)
);

CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    customer    TEXT NOT NULL,
    total       NUMERIC(10,2) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders(id),
    product_id  INTEGER NOT NULL REFERENCES products(id),
    quantity    INTEGER NOT NULL,
    unit_price  NUMERIC(10,2) NOT NULL
);

INSERT INTO products (name, stock, price) VALUES
    ('Mechanical Keyboard', 50, 149.99),
    ('USB-C Hub', 200, 49.99),
    ('Monitor Stand', 30, 79.99);
```

### The Transaction

```sql
BEGIN;

-- Step 1: Decrease inventory
UPDATE products SET stock = stock - 2 WHERE name = 'Mechanical Keyboard';
UPDATE products SET stock = stock - 1 WHERE name = 'USB-C Hub';

-- Step 2: Create the order
INSERT INTO orders (customer, total) VALUES ('Alice', 349.97)
    RETURNING id;
-- Suppose this returns id = 1

-- Step 3: Create order items (use the id returned above)
INSERT INTO order_items (order_id, product_id, quantity, unit_price)
VALUES
    (1, 1, 2, 149.99),
    (1, 2, 1, 49.99);

-- Verify everything looks correct
SELECT p.name, p.stock FROM products p;
SELECT * FROM orders;
SELECT * FROM order_items;

COMMIT;
```

If any step fails — maybe the keyboard is out of stock (CHECK constraint
fires), maybe the product_id doesn't exist (foreign key fires) — the
entire order is rolled back. Inventory stays untouched, no phantom orders
exist.

### The Failed Purchase

```sql
BEGIN;

-- Try to buy 100 monitor stands (only 30 in stock)
UPDATE products SET stock = stock - 100 WHERE name = 'Monitor Stand';
-- ERROR: violates check constraint "positive_stock"

ROLLBACK;

-- Stock is untouched
SELECT name, stock FROM products WHERE name = 'Monitor Stand';
-- Still 30
```

---

## Transaction Lifecycle Diagram

```
                      BEGIN
                        │
                        ▼
                ┌───────────────┐
                │  IN PROGRESS  │◄──── SQL statements execute here
                └───────┬───────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
         All good    Error    User decides
              │         │      to cancel
              ▼         ▼         ▼
          ┌────────┐ ┌──────────────┐
          │ COMMIT │ │   ROLLBACK   │
          └───┬────┘ └──────┬───────┘
              │             │
              ▼             ▼
         Changes        Changes
         saved to       discarded
         disk           entirely
```

---

## Common Transaction Mistakes

### Mistake 1: Holding Transactions Open Too Long

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE owner = 'Alice';
-- ... developer goes to lunch ...
-- The row is LOCKED. No one else can update Alice's balance.
-- Eventually: COMMIT or ROLLBACK
```

Long-running transactions hold locks and block other users. Keep
transactions as short as possible: do your computation outside the
transaction, then BEGIN, do the writes, COMMIT.

### Mistake 2: Forgetting to Handle Errors

In application code (TypeScript, Go, Rust), you MUST catch errors and
roll back:

```typescript
// TypeScript with pg
const client = await pool.connect();
try {
    await client.query('BEGIN');
    await client.query('UPDATE accounts SET balance = balance - $1 WHERE owner = $2', [500, 'Alice']);
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE owner = $2', [500, 'Bob']);
    await client.query('COMMIT');
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    client.release();
}
```

```go
// Go with pgx
tx, err := pool.Begin(ctx)
if err != nil {
    return err
}
defer tx.Rollback(ctx) // Rollback is a no-op if already committed

_, err = tx.Exec(ctx, "UPDATE accounts SET balance = balance - $1 WHERE owner = $2", 500, "Alice")
if err != nil {
    return err
}
_, err = tx.Exec(ctx, "UPDATE accounts SET balance = balance + $1 WHERE owner = $2", 500, "Bob")
if err != nil {
    return err
}

return tx.Commit(ctx)
```

```rust
// Rust with sqlx
let mut tx = pool.begin().await?;

sqlx::query("UPDATE accounts SET balance = balance - $1 WHERE owner = $2")
    .bind(500)
    .bind("Alice")
    .execute(&mut *tx)
    .await?;

sqlx::query("UPDATE accounts SET balance = balance + $1 WHERE owner = $2")
    .bind(500)
    .bind("Bob")
    .execute(&mut *tx)
    .await?;

tx.commit().await?;
// If tx is dropped without commit(), it automatically rolls back
```

### Mistake 3: Assuming Autocommit Is Enough

```sql
-- DANGEROUS: these are two separate transactions
UPDATE accounts SET balance = balance - 500 WHERE owner = 'Alice';
-- Power goes out here
UPDATE accounts SET balance = balance + 500 WHERE owner = 'Bob';
-- This never runs. Alice lost $500.
```

Always use explicit `BEGIN`/`COMMIT` when multiple statements must
succeed together.

---

## Key Takeaways

1. **A transaction groups operations** — all succeed or all fail.
2. **BEGIN / COMMIT / ROLLBACK** — start, save, or undo.
3. **SAVEPOINT** — bookmark within a transaction for partial rollback.
4. **ACID** — Atomicity, Consistency, Isolation, Durability. Four guarantees.
5. **Autocommit** — every standalone statement is its own mini-transaction.
6. **Keep transactions short** — long transactions hold locks and block others.
7. **Always handle errors** — catch failures and ROLLBACK in application code.
8. **The database enforces constraints** — CHECK, NOT NULL, UNIQUE, and foreign keys keep data consistent even when your code has bugs.

---

## Exercises

### Exercise 1: Safe Transfer with Verification

Write a transaction that transfers $200 from Bob to Charlie. Before
committing, SELECT both balances to verify the numbers are correct.
Then COMMIT. After committing, verify the total money in the system
hasn't changed (use `SUM(balance)`).

```sql
-- Your solution here
-- Hint: SELECT SUM(balance) FROM accounts; before and after
```

### Exercise 2: Rollback Practice

Start a transaction, delete ALL rows from the accounts table, then
SELECT to see the empty table. Roll back. Verify all data is restored.

```sql
-- Your solution here
-- This demonstrates that even destructive operations are reversible
-- inside a transaction (before COMMIT).
```

### Exercise 3: Savepoint Branching

Write a transaction that:
1. Deducts $100 from Alice
2. Creates a savepoint
3. Adds $100 to Bob
4. Rolls back to the savepoint (undoing Bob's credit)
5. Adds $100 to Charlie instead
6. Commits

Verify final balances. Alice should be down $100, Charlie up $100,
Bob unchanged.

```sql
-- Your solution here
```

### Exercise 4: Constraint as Safety Net

Try to insert an account with a negative balance. Try to update an
account's balance below zero. Observe how the CHECK constraint
prevents inconsistent data even without explicit application-level
validation.

```sql
-- Your solution here
-- Try: INSERT INTO accounts (owner, balance) VALUES ('Hacker', -9999);
-- Try: UPDATE accounts SET balance = -1 WHERE owner = 'Alice';
```

### Exercise 5: The Full Order Flow

Using the products, orders, and order_items tables, write a transaction
that:
1. Checks if a product has enough stock (SELECT ... FOR UPDATE)
2. Decreases stock
3. Creates an order
4. Creates the order item
5. Commits

Then write a version where the stock check fails (not enough inventory)
and observe the rollback.

```sql
-- Your solution here
-- Hint: SELECT stock FROM products WHERE name = 'Monitor Stand' FOR UPDATE;
-- The FOR UPDATE lock prevents other transactions from changing the stock
-- between your check and your update.
```

---

Next: [Lesson 14 — Concurrency: MVCC, Locks, and Isolation Levels](./14-concurrency-mvcc.md)
