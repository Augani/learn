# Lesson 35: Design a Payment System

Payment systems are the one place where "eventually consistent" isn't
good enough and "oops, we lost a transaction" ends your company. Every
cent must be accounted for, every operation must be idempotent, and
the system must handle failures gracefully without losing or duplicating
money.

**Analogy:** A payment system is like a meticulous accountant who uses
double-entry bookkeeping. Every transaction has two entries — a debit
and a credit — that must always balance. If the accountant is
interrupted mid-entry, they must be able to resume exactly where they
left off without recording anything twice.

---

## Step 1: Requirements

### Functional Requirements

1. **Accept payments** — Process credit card, debit, and wallet payments
2. **Refunds** — Full and partial refunds
3. **Reconciliation** — Match internal records with bank records
4. **Ledger** — Immutable record of all financial transactions
5. **Multi-currency** — Handle USD, EUR, GBP, etc.

### Non-Functional Requirements

1. **Correctness above all** — No lost or duplicate transactions
2. **Idempotency** — Retries never double-charge
3. **Auditability** — Complete history, immutable
4. **PCI DSS compliance** — Never store raw card numbers
5. **Availability** — Payments should work 99.99% of the time

### Scale Estimation

```
Transactions/day:      10M
Peak TPS:              500
Average transaction:   $45
Daily volume:          $450M
Ledger entries/day:    20M (2 entries per transaction)
Storage/year:          ~2 TB (ledger + metadata)
```

---

## Step 2: High-Level Design

```
┌──────────────────────────────────────────────────────────┐
│                       CLIENTS                             │
│              (checkout page, mobile app)                  │
└────────┬─────────────────────────────────────────────────┘
         │
  ┌──────▼──────┐     ┌──────────────┐
  │  Payment    │────▶│  Idempotency │
  │  Gateway    │     │  Store       │
  └──────┬──────┘     └──────────────┘
         │
  ┌──────▼──────┐     ┌──────────────┐
  │  Payment    │────▶│   Ledger     │
  │  Service    │     │   Service    │
  └──────┬──────┘     └──────────────┘
         │
  ┌──────▼──────┐
  │  Payment    │     (Stripe, Adyen, bank APIs)
  │  Provider   │
  │  Gateway    │
  └──────┬──────┘
         │
  ┌──────▼──────┐
  │  Reconciler │     (daily batch job)
  └─────────────┘
```

---

## Step 3: Double-Entry Ledger

The foundation of any financial system. Every transaction creates two
entries that must sum to zero.

```
DOUBLE-ENTRY BOOKKEEPING:

  User pays $50 for an order:

  ┌──────────────┬──────────────┬────────┬─────────┐
  │ entry_id     │ account      │ debit  │ credit  │
  ├──────────────┼──────────────┼────────┼─────────┤
  │ e_001        │ user_wallet  │ $50    │         │  (money leaves user)
  │ e_002        │ merchant_rev │        │ $50     │  (money enters merchant)
  └──────────────┴──────────────┴────────┴─────────┘

  INVARIANT: sum(debits) = sum(credits)  ALWAYS

  Refund $20:
  ┌──────────────┬──────────────┬────────┬─────────┐
  │ e_003        │ merchant_rev │ $20    │         │  (money leaves merchant)
  │ e_004        │ user_wallet  │        │ $20     │  (money returns to user)
  └──────────────┴──────────────┴────────┴─────────┘
```

```go
package ledger

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

type LedgerEntry struct {
	ID            string
	TransactionID string
	AccountID     string
	Amount        decimal.Decimal
	EntryType     string
	CreatedAt     time.Time
}

func RecordPayment(
	ctx context.Context,
	pool *pgxpool.Pool,
	txnID string,
	fromAccount string,
	toAccount string,
	amount decimal.Decimal,
) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`INSERT INTO ledger_entries (transaction_id, account_id, amount, entry_type)
		 VALUES ($1, $2, $3, 'DEBIT')`,
		txnID, fromAccount, amount,
	)
	if err != nil {
		return fmt.Errorf("debit entry: %w", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO ledger_entries (transaction_id, account_id, amount, entry_type)
		 VALUES ($1, $2, $3, 'CREDIT')`,
		txnID, toAccount, amount,
	)
	if err != nil {
		return fmt.Errorf("credit entry: %w", err)
	}

	return tx.Commit(ctx)
}
```

### Critical Rule: Immutable Ledger

```
NEVER update or delete ledger entries.

  Wrong: UPDATE ledger SET amount = 30 WHERE id = 'e_001'
  Right: INSERT new correcting entries

  To fix a $50 charge that should have been $30:
    1. Record reversal: debit merchant $50, credit user $50
    2. Record correct charge: debit user $30, credit merchant $30

  The original entries remain. Full audit trail preserved.
```

---

## Step 4: Idempotent Payment Processing

Payments MUST be idempotent. See Lesson 28 for the general pattern.
Here's the payment-specific flow:

```
┌────────┐
│ Client │── POST /payments
│        │   Idempotency-Key: "pay_abc123"
└───┬────┘   Amount: $50
    │
┌───▼─────────────────────────────────────────────────┐
│                 Payment Service                      │
│                                                     │
│  1. Check idempotency store for "pay_abc123"        │
│     → Found? Return cached result.                  │
│     → Not found? Continue.                          │
│                                                     │
│  2. Acquire lock on "pay_abc123"                    │
│     → Lock failed? Another request in progress.     │
│        Wait and return that result.                 │
│                                                     │
│  3. Create payment record (status: PENDING)         │
│                                                     │
│  4. Call payment provider (Stripe API)              │
│     → Success: status = COMPLETED                   │
│     → Failure: status = FAILED                      │
│     → Timeout: status = UNKNOWN (need reconcile)    │
│                                                     │
│  5. Record ledger entries                           │
│                                                     │
│  6. Store result in idempotency cache               │
│                                                     │
│  7. Release lock, return result                     │
└─────────────────────────────────────────────────────┘
```

### The Timeout Problem

```
Most dangerous case: you call Stripe, the call times out.
Did the charge go through or not?

  Service ──▶ Stripe API ──▶ ???  (timeout after 30s)

  Option A: Stripe charged the card (response got lost)
  Option B: Stripe never received the request

  If you retry: Option A means double-charge
  If you don't: Option B means lost sale

SOLUTION:
  1. Always send an idempotency key TO Stripe
  2. Stripe deduplicates on their end
  3. Safe to retry after timeout
  4. Reconciliation catches remaining edge cases
```

---

## Step 5: Reconciliation

No matter how careful you are, discrepancies happen. Daily reconciliation
catches them.

```
RECONCILIATION FLOW (daily batch job):

  ┌──────────────────┐     ┌──────────────────┐
  │  Internal Ledger │     │  Bank/Provider   │
  │  (your records)  │     │  Statement       │
  └────────┬─────────┘     └────────┬─────────┘
           │                        │
           └───────────┬────────────┘
                       │
                ┌──────▼──────┐
                │  Reconciler │
                │             │
                │  For each   │
                │  transaction│
                │  in either: │
                │             │
                │  Match?     │──▶ OK ✓
                │  Mismatch?  │──▶ Flag for review
                │  Missing?   │──▶ Alert + investigate
                └─────────────┘

COMMON DISCREPANCIES:
  - Amount mismatch (currency conversion rounding)
  - Transaction in our ledger but not in bank (charge failed silently)
  - Transaction in bank but not in ledger (timeout → charge went through)
  - Timing differences (charged at 11:59 PM, settles next day)
```

---

## Step 6: PCI Compliance

```
PCI DSS: Never store, process, or transmit raw card numbers
         in your own systems.

WRONG (PCI nightmare):
  Client ──▶ Your API ──▶ stores card number ──▶ charges later
  You are now responsible for PCI compliance (expensive, risky)

RIGHT (tokenization):
  Client ──▶ Stripe.js (client-side) ──▶ Stripe
                                         ──▶ returns token "tok_abc123"
  Client ──▶ Your API (sends token only, never sees card number)
  Your API ──▶ Stripe (charges token "tok_abc123")

  Card number NEVER touches your servers.

  ┌────────┐     ┌──────────┐     ┌──────────┐
  │ Client │────▶│ Stripe   │────▶│  Token   │
  │ (browser)│   │ (iframe) │     │ tok_abc  │
  └────────┘     └──────────┘     └────┬─────┘
                                       │
  ┌────────────────────────────────────▼──────┐
  │           Your Backend                     │
  │   Only sees tok_abc, never card number    │
  │   Charges via Stripe API using token      │
  └────────────────────────────────────────────┘
```

---

## Step 7: Refunds

```
FULL REFUND:
  Original: user pays $50 to merchant
    debit user_wallet $50 / credit merchant_revenue $50

  Refund: reverse the charge
    debit merchant_revenue $50 / credit user_wallet $50

  + Call payment provider API to process refund
  + Refund may take 5-10 business days to appear

PARTIAL REFUND ($20 of $50):
  debit merchant_revenue $20 / credit user_wallet $20

  Original transaction amount doesn't change.
  Refund is a NEW set of ledger entries linked to the original.
```

```
Payment states:

  PENDING ──▶ COMPLETED ──▶ REFUND_PENDING ──▶ REFUNDED
     │                           │
     ▼                           ▼
   FAILED                  REFUND_FAILED

  Each state transition creates ledger entries.
  Each transition is idempotent (repeating is safe).
```

---

## Trade-Off Summary

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| Ledger | Mutable rows | Immutable append-only | Immutable (auditability) |
| Idempotency | DB unique constraint | Redis + DB | Both (Redis for speed, DB for durability) |
| Card handling | Store tokens | Tokenize via Stripe/Adyen | Tokenize (avoid PCI scope) |
| Reconciliation | Real-time | Daily batch | Daily batch + alerts for anomalies |
| Currency | Store as float | Store as integer (cents) | Integer (no floating point errors) |
| Provider | Single (Stripe) | Multi (Stripe + Adyen) | Multi for redundancy |

### Critical: Never Use Floats for Money

```
0.1 + 0.2 = 0.30000000000000004 in IEEE 754

Use integer cents:
  $50.00 = 5000 cents (int64)
  $0.01  = 1 cent (int64)

Or use decimal libraries:
  Go: shopspring/decimal
  TypeScript: decimal.js
  Rust: rust_decimal
```

---

## Exercises

1. Implement a double-entry ledger in Go. Create payment and refund
   functions. Verify that sum(debits) always equals sum(credits).

2. Design the payment state machine. Draw all valid state transitions.
   Implement it with explicit transition validation (reject invalid
   transitions like FAILED → REFUNDED).

3. Build a reconciliation job: given your internal ledger and a bank
   statement CSV, find all discrepancies. Handle amount mismatches,
   missing transactions, and timing differences.

4. Calculate: 10M transactions/day, each with 2 ledger entries at
   200 bytes each. How much ledger storage per year? When do you need
   to archive old entries?

---

*Next: [Lesson 36 — Design a Web Crawler](./36-design-web-crawler.md),
where we build a polite, distributed crawler that can handle billions
of pages.*
