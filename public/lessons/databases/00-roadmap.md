# Databases From the Ground Up

How databases actually work — from bits on disk to production schemas.
PostgreSQL-focused, with Rust/sqlx for application code.

No CS degree assumed. Everyday analogies for everything.

---

## Reference Files (read anytime)

- [Glossary & Cheat Sheet](./reference-glossary.md) — Terms, SQL syntax, common commands
- [PostgreSQL Setup](./reference-postgres-setup.md) — Installing and running Postgres locally

---

## The Roadmap

### Phase 1: What's Actually Happening (Hours 1–10)
- [ ] [Lesson 01: What is a database (and why not just use files)](./01-what-is-a-database.md)
- [ ] [Lesson 02: How data lives on disk — pages, rows, and storage](./02-data-on-disk.md)
- [ ] [Lesson 03: Indexes — the single most important concept](./03-indexes.md)
- [ ] [Lesson 04: How a query executes — from text to results](./04-query-execution.md)

### Phase 2: SQL & Relational Thinking (Hours 11–28)
- [ ] [Lesson 05: Tables, types, and your first queries](./05-tables-and-types.md)
- [ ] [Lesson 06: Filtering, sorting, and aggregation](./06-filtering-sorting-aggregation.md)
- [ ] [Lesson 07: Joins — connecting tables together](./07-joins.md)
- [ ] [Lesson 08: Subqueries, CTEs, and window functions](./08-subqueries-ctes-windows.md)
- [ ] [Lesson 09: Schema design and normalization](./09-schema-design.md)
- [ ] [Lesson 10: Constraints, foreign keys, and data integrity](./10-constraints.md)

### Phase 3: Performance & Internals (Hours 29–44)
- [ ] [Lesson 11: EXPLAIN — reading what the database is doing](./11-explain.md)
- [ ] [Lesson 12: Index strategies — when, what, and when NOT to index](./12-index-strategies.md)
- [ ] [Lesson 13: Transactions and ACID — how databases stay correct](./13-transactions-acid.md)
- [ ] [Lesson 14: Concurrency — MVCC, locks, and isolation levels](./14-concurrency-mvcc.md)
- [ ] [Lesson 15: WAL and crash recovery — how databases survive failures](./15-wal-recovery.md)

### Phase 4: Practical Patterns (Hours 45–60)
- [ ] [Lesson 16: Schema design patterns for real applications](./16-schema-patterns.md)
- [ ] [Lesson 17: Migrations — evolving your schema safely](./17-migrations.md)
- [ ] [Lesson 18: PostgreSQL superpowers — JSONB, arrays, full-text search](./18-postgres-features.md)
- [ ] [Lesson 19: Common mistakes and anti-patterns](./19-anti-patterns.md)

### Phase 5: Databases in Rust (Hours 61–72)
- [ ] [Lesson 20: sqlx — async Postgres from Rust](./20-sqlx-rust.md)
- [ ] [Lesson 21: Connection pooling, prepared statements, and production patterns](./21-production-patterns.md)
- [ ] [Lesson 22: Building a complete data layer](./22-data-layer-project.md)

---

## How to use these lessons

1. **Install PostgreSQL** first — see [PostgreSQL Setup](./reference-postgres-setup.md)
2. Every lesson has SQL you can run directly in `psql` or any SQL client
3. Exercises build on each other — a `learn_db` database is used throughout
4. Phase 5 connects everything to Rust with sqlx

**Start with Lesson 01 if databases are new.** If you already use databases
but want to understand internals, start with Lesson 02.
