# Lesson 5: Zero-Downtime Migrations

> The hardest part of changing a system isn't writing new code.
> It's changing the old code while it's still running.

---

## The Analogy

Imagine replacing the engine of a plane while it's flying. That
sounds insane — but that's exactly what zero-downtime database
migration is. Your application is the plane, the database schema
is the engine, and your users are the passengers who really don't
want turbulence.

The trick isn't to be fast. It's to be incremental. You don't
swap the whole engine at once. You install the new engine alongside
the old one, gradually shift load, verify everything works, then
remove the old one. At no point is the plane without an engine.

---

## The Expand-Contract Pattern

Every zero-downtime schema change follows this pattern:

```
  Phase 1: EXPAND
  Add the new thing alongside the old thing.
  Both exist. Old code still works.

  Phase 2: MIGRATE
  Move data/traffic from old to new.
  Both still work.

  Phase 3: CONTRACT
  Remove the old thing.
  Only new thing exists.

  Timeline:
  ──────────────────────────────────────────────────>
  │ Old only │ Old + New │ New only    │
  │          │ (both     │ (old        │
  │          │  work)    │  removed)   │
  └──────────┴───────────┴─────────────┘
       EXPAND    MIGRATE    CONTRACT
```

### Example: Renaming a Column

You need to rename `user_name` to `display_name`. In a monolith
with downtime, you'd just `ALTER TABLE ... RENAME COLUMN`. In
production with zero downtime:

```
  Step 1: EXPAND — Add new column
  ALTER TABLE users ADD COLUMN display_name TEXT;

  Step 2: DUAL WRITE — Write to both columns
  UPDATE code: SET both user_name AND display_name

  Step 3: BACKFILL — Copy existing data
  UPDATE users SET display_name = user_name
  WHERE display_name IS NULL;

  Step 4: SWITCH READS — Read from new column
  UPDATE code: READ from display_name

  Step 5: STOP OLD WRITES — Write only to new column
  UPDATE code: STOP writing to user_name

  Step 6: CONTRACT — Remove old column
  ALTER TABLE users DROP COLUMN user_name;
```

This takes 6 deployments instead of 1. Each deployment is safe
to roll back. At no point do reads or writes fail.

---

## Dual Writes

During migration, you write to both old and new locations:

```go
type UserRepository struct {
	db          *sql.DB
	useDualWrite bool
	useNewRead   bool
}

func (r *UserRepository) UpdateDisplayName(ctx context.Context, userID string, name string) error {
	if r.useDualWrite {
		_, err := r.db.ExecContext(ctx, `
			UPDATE users
			SET user_name = $2, display_name = $2
			WHERE id = $1`,
			userID, name)
		return err
	}

	_, err := r.db.ExecContext(ctx, `
		UPDATE users SET user_name = $2 WHERE id = $1`,
		userID, name)
	return err
}

func (r *UserRepository) GetDisplayName(ctx context.Context, userID string) (string, error) {
	var column string
	if r.useNewRead {
		column = "display_name"
	} else {
		column = "user_name"
	}

	var name string
	err := r.db.QueryRowContext(ctx,
		fmt.Sprintf("SELECT %s FROM users WHERE id = $1", column),
		userID).Scan(&name)
	return name, err
}
```

The flags `useDualWrite` and `useNewRead` are feature flags that
you toggle independently:

```
  Deploy 1: useDualWrite=true,  useNewRead=false
  (writing to both, reading from old — verify writes work)

  Deploy 2: useDualWrite=true,  useNewRead=true
  (writing to both, reading from new — verify reads work)

  Deploy 3: useDualWrite=false, useNewRead=true
  (writing only to new, reading from new — old column unused)

  Deploy 4: DROP COLUMN user_name
```

---

## Shadow Reads

Before switching reads to the new source, validate with shadow
reads: read from both old and new, compare results, but only
return the old result to the user.

```
  ┌──────────┐
  │  Request  │
  └────┬─────┘
       │
  ┌────▼─────┐
  │  Read    │──── PRIMARY (old) ────> Return to user
  │  Both    │
  │          │──── SHADOW (new) ────> Log & compare
  └──────────┘

  If PRIMARY != SHADOW:
    Log the difference
    Increment mismatch counter
    Alert if mismatch_rate > threshold
```

```go
type ShadowReader struct {
	primary    Repository
	shadow     Repository
	mismatchCh chan<- Mismatch
}

func (s *ShadowReader) GetUser(ctx context.Context, userID string) (*User, error) {
	primaryResult, primaryErr := s.primary.GetUser(ctx, userID)

	go func() {
		shadowCtx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()

		shadowResult, shadowErr := s.shadow.GetUser(shadowCtx, userID)
		if shadowErr != nil {
			s.mismatchCh <- Mismatch{
				UserID: userID,
				Type:   "shadow_error",
				Detail: shadowErr.Error(),
			}
			return
		}

		if !reflect.DeepEqual(primaryResult, shadowResult) {
			s.mismatchCh <- Mismatch{
				UserID:  userID,
				Type:    "data_mismatch",
				Primary: primaryResult,
				Shadow:  shadowResult,
			}
		}
	}()

	return primaryResult, primaryErr
}
```

Shadow reads catch bugs before users see them. Run them for at
least a week before switching the primary read path.

---

## Large Table Migrations

The real challenge isn't small schema changes — it's migrating
tables with billions of rows.

### The Problem

```
  ALTER TABLE orders ADD COLUMN region TEXT DEFAULT 'us-east';

  On a 2-billion row table, this:
  - Locks the table (PostgreSQL < 11 with default values)
  - Takes hours to complete
  - Blocks all writes during the ALTER
  - Your application returns 503 for hours
```

### Ghost Table Pattern (pt-online-schema-change / gh-ost)

```
  Step 1: Create shadow table with new schema

  orders (original)          _orders_new (shadow)
  ┌──────────────────┐       ┌──────────────────────┐
  │ id               │       │ id                   │
  │ user_id          │       │ user_id              │
  │ total            │       │ total                │
  │                  │       │ region (new column!) │
  └──────────────────┘       └──────────────────────┘

  Step 2: Copy data in chunks

  ┌──────────────────┐  chunk  ┌──────────────────────┐
  │ orders           │ ──────> │ _orders_new          │
  │ (2 billion rows) │  1000   │ (copying...)         │
  └──────────────────┘  at a   └──────────────────────┘
                        time

  Step 3: Capture ongoing changes (triggers or binlog)

  New writes to 'orders' ──> Also applied to '_orders_new'

  Step 4: Atomic swap when caught up

  RENAME TABLE orders TO _orders_old,
               _orders_new TO orders;

  Step 5: Drop old table (after verification)
```

### gh-ost (GitHub's Online Schema Tool)

gh-ost avoids triggers entirely by reading the MySQL binary log:

```
  ┌───────────────┐
  │  Application  │
  │  (writes to   │
  │   orders)     │
  └──────┬────────┘
         │
         ▼
  ┌───────────────┐     binlog      ┌───────────────┐
  │    orders     │ ──────────────> │    gh-ost     │
  │  (original)   │                 │  (reads binlog│
  └───────────────┘                 │   applies to  │
                                    │   ghost table)│
                                    └──────┬────────┘
                                           │
                                           ▼
                                    ┌───────────────┐
                                    │  _orders_gho  │
                                    │  (ghost table) │
                                    └───────────────┘
```

```bash
gh-ost \
  --host=db-primary.internal \
  --database=myapp \
  --table=orders \
  --alter="ADD COLUMN region VARCHAR(32) DEFAULT 'us-east'" \
  --chunk-size=1000 \
  --max-load=Threads_running=50 \
  --critical-load=Threads_running=200 \
  --throttle-control-replicas=db-replica.internal \
  --max-lag-millis=1500 \
  --execute
```

Key flags:
- `--max-load`: Pause if DB load exceeds threshold
- `--critical-load`: Abort if load is dangerously high
- `--max-lag-millis`: Pause if replica lag exceeds threshold
- `--chunk-size`: Rows copied per iteration

---

## Feature Flags for Migrations

Feature flags decouple deployment from activation:

```
  ┌──────────────────────────────────────────────────────┐
  │                  Migration Timeline                   │
  ├──────────────────────────────────────────────────────┤
  │                                                      │
  │  Day 1: Deploy dual-write code (flag OFF)            │
  │         Test in staging                              │
  │                                                      │
  │  Day 2: Enable dual-write (flag ON for 1% traffic)   │
  │         Monitor error rates                          │
  │                                                      │
  │  Day 3: Enable dual-write (flag ON for 100%)         │
  │         Start backfill job                           │
  │                                                      │
  │  Day 5: Backfill complete                            │
  │         Enable shadow reads (flag ON for 10%)        │
  │                                                      │
  │  Day 8: Shadow reads showing 0% mismatch             │
  │         Switch primary reads (flag ON)               │
  │                                                      │
  │  Day 12: Disable old writes (flag OFF)               │
  │                                                      │
  │  Day 15: Remove old column/table                     │
  │          Remove feature flags and dual-write code    │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

```go
type MigrationFlags struct {
	DualWriteEnabled   func() bool
	NewReadEnabled     func() bool
	ShadowReadEnabled  func() bool
	ShadowReadPercent  func() int
}

func (r *OrderRepository) Create(ctx context.Context, order *Order) error {
	if r.flags.DualWriteEnabled() {
		return r.createInBothStores(ctx, order)
	}
	return r.createInOldStore(ctx, order)
}

func (r *OrderRepository) Get(ctx context.Context, orderID string) (*Order, error) {
	if r.flags.NewReadEnabled() {
		return r.getFromNewStore(ctx, orderID)
	}

	result, err := r.getFromOldStore(ctx, orderID)
	if err != nil {
		return nil, err
	}

	if r.flags.ShadowReadEnabled() && rand.Intn(100) < r.flags.ShadowReadPercent() {
		go r.shadowCompare(ctx, orderID, result)
	}

	return result, nil
}
```

---

## Backfill Strategies

Copying data from old to new at scale requires care:

```
  WRONG: One giant UPDATE

  UPDATE orders SET region = 'us-east' WHERE region IS NULL;
  -- Locks 2 billion rows. DB falls over.


  RIGHT: Chunked backfill

  Loop:
    SELECT id FROM orders
    WHERE region IS NULL
    ORDER BY id
    LIMIT 1000;

    UPDATE orders SET region = 'us-east'
    WHERE id IN (...batch of 1000...);

    Sleep 100ms (let the DB breathe)

  Repeat until no more NULL rows.
```

```go
func BackfillRegion(ctx context.Context, db *sql.DB, batchSize int, sleepBetween time.Duration) error {
	for {
		result, err := db.ExecContext(ctx, `
			WITH batch AS (
				SELECT id FROM orders
				WHERE region IS NULL
				ORDER BY id
				LIMIT $1
				FOR UPDATE SKIP LOCKED
			)
			UPDATE orders SET region = 'us-east'
			WHERE id IN (SELECT id FROM batch)`,
			batchSize)
		if err != nil {
			return fmt.Errorf("backfill batch failed: %w", err)
		}

		affected, _ := result.RowsAffected()
		if affected == 0 {
			break
		}

		fmt.Printf("Backfilled %d rows\n", affected)
		time.Sleep(sleepBetween)
	}
	return nil
}
```

Key details:
- `FOR UPDATE SKIP LOCKED`: Don't block on rows being modified
  by other transactions. Skip them and get them next iteration.
- Sleep between batches to prevent overwhelming the DB.
- Monitor replication lag during backfill — if lag increases,
  slow down.

---

## PostgreSQL-Specific Considerations

PostgreSQL has specific behaviors that affect migrations:

```
  Safe (no lock / fast lock):
  ✓ ADD COLUMN without DEFAULT (PostgreSQL 11+: with DEFAULT too)
  ✓ CREATE INDEX CONCURRENTLY
  ✓ DROP INDEX CONCURRENTLY
  ✓ ADD CONSTRAINT ... NOT VALID
  ✓ VALIDATE CONSTRAINT (only holds ShareUpdateExclusiveLock)

  Dangerous (takes ACCESS EXCLUSIVE lock):
  ✗ ADD COLUMN with DEFAULT (PostgreSQL < 11)
  ✗ ALTER COLUMN TYPE
  ✗ ADD CONSTRAINT (validated immediately)
  ✗ DROP COLUMN (can be fast, but locks)
  ✗ RENAME COLUMN
  ✗ RENAME TABLE
```

### Safe Constraint Addition

```sql
-- WRONG: Locks table while scanning all rows
ALTER TABLE orders ADD CONSTRAINT orders_total_positive
  CHECK (total >= 0);

-- RIGHT: Two-step process
-- Step 1: Add constraint without validating (instant, no scan)
ALTER TABLE orders ADD CONSTRAINT orders_total_positive
  CHECK (total >= 0) NOT VALID;

-- Step 2: Validate existing rows (holds weaker lock, no blocking)
ALTER TABLE orders VALIDATE CONSTRAINT orders_total_positive;
```

### Safe Index Creation

```sql
-- WRONG: Blocks all writes during index build
CREATE INDEX idx_orders_region ON orders (region);

-- RIGHT: Allows writes during index build
CREATE INDEX CONCURRENTLY idx_orders_region ON orders (region);

-- Note: CONCURRENTLY can't run in a transaction block
-- and if it fails, you get an INVALID index that must be dropped
```

---

## Migration Rollback Strategy

Every migration step needs a rollback plan:

```
  ┌─────────────────────┬────────────────────────────────┐
  │ Migration Step      │ Rollback                       │
  ├─────────────────────┼────────────────────────────────┤
  │ Add new column      │ DROP COLUMN (safe if unused)   │
  │ Enable dual write   │ Toggle feature flag OFF        │
  │ Start backfill      │ Kill backfill job (data stays) │
  │ Enable shadow read  │ Toggle shadow flag OFF         │
  │ Switch to new read  │ Toggle read flag OFF           │
  │ Stop old writes     │ Re-enable old write flag       │
  │ Drop old column     │ ⚠ NOT REVERSIBLE              │
  └─────────────────────┴────────────────────────────────┘

  The DROP is the only irreversible step.
  Wait at least 1 week after stopping old writes before dropping.
  Keep a backup.
```

---

## Real-World Migration: Sharding

The most complex migration: splitting a single database into
multiple shards.

```
  Before: Single database

  ┌────────────────────────────┐
  │  PostgreSQL (all data)     │
  │  orders, users, payments   │
  └────────────────────────────┘

  After: Sharded by customer_id

  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
  │  Shard 0  │ │  Shard 1  │ │  Shard 2  │ │  Shard 3  │
  │ cust % 4  │ │ cust % 4  │ │ cust % 4  │ │ cust % 4  │
  │   == 0    │ │   == 1    │ │   == 2    │ │   == 3    │
  └───────────┘ └───────────┘ └───────────┘ └───────────┘
```

Migration plan:

1. **Add shard key to all queries** (biggest code change)
2. **Set up shard databases** (empty, same schema)
3. **Enable dual writes** (write to old DB + correct shard)
4. **Backfill historical data** to shards
5. **Shadow read** from shards, compare with old DB
6. **Switch reads** to shards
7. **Stop writing to old DB**
8. **Decommission old DB** (after verification period)

This migration typically takes 3-6 months at scale. The code
changes in step 1 alone can take weeks, because every query
that doesn't include the shard key will break.

---

## Exercises

1. **Column rename.** You need to rename `email_address` to `email`
   in a users table with 50 million rows. Write the complete
   migration plan with all SQL statements, code changes, and
   feature flag states for each step. How long will this take?

2. **Type change.** You need to change a column from `INTEGER` to
   `BIGINT` on a 500-million-row table. The column is used in
   JOINs and WHERE clauses. Design the migration. Why can't you
   just `ALTER COLUMN TYPE`?

3. **Shard migration.** Your orders table has 1 billion rows and
   needs to be sharded by customer_id. The table has foreign keys
   to products and users. Design the migration plan. What happens
   to cross-shard joins? How do you handle orders that reference
   products from any shard?

4. **Rollback scenario.** You're mid-migration (dual-writes enabled,
   backfill 60% complete) when you discover a bug in the dual-write
   code that's writing corrupted data to the new column. Design
   the recovery plan. What data do you trust? How do you restart?

---

[Next: Lesson 6 — Observability at Scale -->](06-observability-at-scale.md)
