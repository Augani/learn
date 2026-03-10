# Lesson 27: Workflow Engines

Some operations take minutes, hours, or days. An order goes through
payment, fraud check, inventory reservation, shipping, and email
notification. If step 3 fails, you need to undo steps 1 and 2. Managing
this with ad-hoc code and cron jobs turns into a nightmare at scale.

**Analogy:** A workflow engine is a project manager with a checklist.
The PM doesn't do the work — they track which tasks are done, which
failed, what to retry, and what to do if something goes wrong. Without
the PM, tasks get lost, repeated, or done in the wrong order.

---

## The Problem with Naive Approaches

```
Order processing without a workflow engine:

  1. API handler calls payment service         ← what if this times out?
  2. If success, call inventory service        ← what if server crashes here?
  3. If success, call shipping service         ← what if this fails?
  4. Send confirmation email                   ← did steps 1-3 actually finish?

  Questions that keep you up at night:
  - Server crashed after step 2. Did step 1 complete? Do we retry?
  - Payment charged but inventory failed. How do we refund?
  - This ran for 45 minutes. What state is it in right now?
  - We deployed new code. What about in-flight orders?
```

A workflow engine answers all of these by making execution **durable**
— the state of every step is persisted, and execution resumes after
crashes exactly where it left off.

---

## Workflow Engine Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Workflow Engine                        │
│                                                        │
│  ┌──────────────┐     ┌────────────────────────┐       │
│  │   Workflow    │     │   Execution Store      │       │
│  │   Definition  │     │   (durable state)      │       │
│  │   "order"     │     │                        │       │
│  │              │     │  workflow_id: wf_123    │       │
│  │  step1: pay  │     │  current_step: 3       │       │
│  │  step2: inv  │     │  state: {paid: true,   │       │
│  │  step3: ship │     │    reserved: true}     │       │
│  │  step4: email│     │  status: RUNNING       │       │
│  └──────────────┘     └────────────────────────┘       │
│                                                        │
│  ┌──────────────┐     ┌────────────────────────┐       │
│  │   Workers    │     │   Timer Service        │       │
│  │   (execute   │     │   (timeouts, delays,   │       │
│  │    steps)    │     │    scheduled retries)  │       │
│  └──────────────┘     └────────────────────────┘       │
└────────────────────────────────────────────────────────┘
```

### Key Guarantee: Durability

```
Without workflow engine:
  Code runs → server crashes → state lost → ????

With workflow engine:
  Step 1 completes → state persisted to DB
  Server crashes
  New server picks up → reads state from DB
  Resumes at step 2 → as if nothing happened
```

---

## Temporal: The Modern Workflow Engine

Temporal is the most popular workflow engine. You write workflows as
regular code, and Temporal handles durability, retries, and timeouts.

```go
package workflows

import (
	"fmt"
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

func OrderWorkflow(ctx workflow.Context, order Order) (OrderResult, error) {
	options := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval: time.Second,
			MaximumAttempts: 3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, options)

	var paymentResult PaymentResult
	err := workflow.ExecuteActivity(ctx, ProcessPayment, order).Get(ctx, &paymentResult)
	if err != nil {
		return OrderResult{}, fmt.Errorf("payment failed: %w", err)
	}

	var inventoryResult InventoryResult
	err = workflow.ExecuteActivity(ctx, ReserveInventory, order).Get(ctx, &inventoryResult)
	if err != nil {
		_ = workflow.ExecuteActivity(ctx, RefundPayment, paymentResult).Get(ctx, nil)
		return OrderResult{}, fmt.Errorf("inventory failed, refunded: %w", err)
	}

	var shippingResult ShippingResult
	err = workflow.ExecuteActivity(ctx, ScheduleShipping, order).Get(ctx, &shippingResult)
	if err != nil {
		_ = workflow.ExecuteActivity(ctx, ReleaseInventory, inventoryResult).Get(ctx, nil)
		_ = workflow.ExecuteActivity(ctx, RefundPayment, paymentResult).Get(ctx, nil)
		return OrderResult{}, fmt.Errorf("shipping failed, rolled back: %w", err)
	}

	_ = workflow.ExecuteActivity(ctx, SendConfirmationEmail, order).Get(ctx, nil)

	return OrderResult{
		PaymentID:  paymentResult.ID,
		TrackingNo: shippingResult.TrackingNumber,
	}, nil
}
```

**The magic:** This looks like normal Go code, but Temporal records
every step. If the server crashes after `ProcessPayment`, when a new
worker picks up this workflow, it replays the history, skips the
already-completed payment step, and resumes at `ReserveInventory`.

---

## Saga Pattern

When a workflow spans multiple services, and each step has a compensating
action (undo), that's a **saga**.

```
SAGA: Order Processing

  Forward actions:          Compensating actions:
  ┌─────────────────┐      ┌─────────────────────┐
  │ 1. Charge card  │ ───▶ │ 1c. Refund card     │
  │ 2. Reserve inv  │ ───▶ │ 2c. Release inv     │
  │ 3. Book shipping│ ───▶ │ 3c. Cancel shipping  │
  │ 4. Send email   │      │ (no compensation)    │
  └─────────────────┘      └─────────────────────┘

  Happy path: 1 → 2 → 3 → 4 ✓

  Failure at step 3:
    1 ✓ → 2 ✓ → 3 ✗ → compensate: 2c → 1c
    (undo in reverse order)
```

### Orchestration vs Choreography

```
ORCHESTRATION (central coordinator):
  ┌──────────────┐
  │ Orchestrator │──── "Payment: charge $50"
  │  (Temporal)  │──── "Inventory: reserve 2x Widget"
  │              │──── "Shipping: schedule pickup"
  └──────────────┘
  Pro: clear flow, easy to debug, central visibility
  Con: single point of coordination

CHOREOGRAPHY (event-driven):
  Payment service ──publishes──▶ "PaymentCharged" event
  Inventory service ──listens──▶ reserves stock
  Inventory service ──publishes──▶ "InventoryReserved" event
  Shipping service ──listens──▶ schedules pickup

  Pro: loosely coupled, no central coordinator
  Con: hard to trace flow, implicit dependencies, debugging nightmare
```

| Factor | Orchestration | Choreography |
|--------|--------------|--------------|
| Visibility | Central dashboard | Distributed traces needed |
| Complexity | O(n) steps in one place | O(n^2) event relationships |
| Coupling | Services coupled to orchestrator | Services coupled via events |
| Best for | Complex multi-step flows | Simple pub/sub reactions |
| Debugging | Look at orchestrator logs | Correlate events across services |

**Recommendation:** Use orchestration for complex business workflows.
Use choreography for simple event reactions (user signed up → send
welcome email).

---

## AWS Step Functions

Serverless workflow engine using JSON state machines.

```
┌────────────┐     ┌──────────────┐     ┌────────────┐
│ Start      │────▶│ Validate     │────▶│ Process    │
│            │     │ Order        │     │ Payment    │
└────────────┘     └──────┬───────┘     └─────┬──────┘
                          │ invalid            │
                          ▼                    ▼
                   ┌──────────────┐     ┌──────────────┐
                   │ Reject       │     │ Check        │
                   │ (end)        │     │ Inventory    │
                   └──────────────┘     └──────┬───────┘
                                               │
                                        ┌──────▼──────┐
                                        │   Ship      │
                                        │   Order     │
                                        └─────────────┘
```

**Trade-off: Temporal vs Step Functions**

| Factor | Temporal | Step Functions |
|--------|----------|---------------|
| Language | Code in Go/Java/Python/TS | JSON/YAML state machine |
| Hosting | Self-hosted or Temporal Cloud | AWS managed |
| Testing | Unit test like normal code | Harder to test state machines |
| Vendor lock-in | None | AWS-specific |
| Complexity | Handles any pattern | Limited to state machine model |
| Cost | Infrastructure cost | Per-state-transition pricing |

---

## Long-Running Workflows

Some workflows run for days or weeks (loan approval, background checks).

```
Loan Application Workflow:

  Day 1: Submit application
         │
  Day 1: ┌──▶ Credit check (async, takes 5 min)
         │
  Day 2: ┌──▶ Wait for document upload (human step)
         │     Timer: if no upload in 7 days, send reminder
         │
  Day 8: ┌──▶ Manual review (human step)
         │     Timer: if no review in 3 days, escalate
         │
  Day 10: ┌──▶ Approve/Reject
          │
  Day 10: ┌──▶ Notify applicant
```

Temporal handles this naturally. The workflow "sleeps" between steps
(no resources consumed), wakes up when an event arrives or a timer fires.

```go
func LoanWorkflow(ctx workflow.Context, app LoanApplication) error {
	var creditResult CreditCheckResult
	_ = workflow.ExecuteActivity(ctx, CheckCredit, app).Get(ctx, &creditResult)

	uploadCh := workflow.GetSignalChannel(ctx, "document-uploaded")
	timerCtx, cancel := workflow.WithCancel(ctx)
	timer := workflow.NewTimer(timerCtx, 7*24*time.Hour)

	selector := workflow.NewSelector(ctx)
	var docs Documents

	selector.AddReceive(uploadCh, func(ch workflow.ReceiveChannel, more bool) {
		ch.Receive(ctx, &docs)
		cancel()
	})
	selector.AddFuture(timer, func(f workflow.Future) {
		_ = workflow.ExecuteActivity(ctx, SendReminder, app).Get(ctx, nil)
	})
	selector.Select(ctx)

	var decision string
	reviewCh := workflow.GetSignalChannel(ctx, "review-decision")
	reviewCh.Receive(ctx, &decision)

	return workflow.ExecuteActivity(ctx, NotifyApplicant, decision).Get(ctx, nil)
}
```

---

## Exercises

1. Implement an order processing saga in Go with Temporal. Include
   three activities (payment, inventory, shipping) with compensating
   actions for each.

2. Design a workflow for user onboarding: verify email, set up profile,
   provision resources, send welcome email. Handle the case where email
   verification takes up to 24 hours.

3. Compare orchestration vs choreography for a food delivery system:
   order placed, restaurant confirms, driver assigned, picked up,
   delivered. Draw both approaches.

4. Estimate Temporal's storage needs for a system processing 100K
   workflows/day, average 5 steps each, 30-day retention.

---

*Next: [Lesson 28 — Idempotency and Exactly-Once Semantics](./28-idempotency-exactly-once.md),
where we ensure operations happen exactly once, even when networks fail.*
