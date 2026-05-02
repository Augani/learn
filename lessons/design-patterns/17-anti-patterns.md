# Lesson 17: Anti-Patterns

> **The one thing to remember**: An anti-pattern is a common
> "solution" that looks reasonable but actually makes things worse.
> Knowing anti-patterns is just as important as knowing patterns —
> you can't fix a problem if you can't name it. This lesson is your
> field guide to recognizing bad code structures before they cause
> real damage.

---

## What's an Anti-Pattern?

A design pattern is a proven good solution. An anti-pattern is a
proven BAD solution — one that developers keep falling into despite
the pain it causes.

```
PATTERN vs ANTI-PATTERN

  Pattern:      Problem → Known good solution → Better code
  Anti-Pattern: Problem → Tempting bad solution → Worse code

  Anti-patterns are seductive because they seem like the easy path.
  They solve the immediate problem but create bigger problems later.
```

---

## The God Object

### What It Looks Like

One class does everything. It knows about users, orders, payments,
emails, logging, database access, and probably makes coffee too.

```
THE GOD OBJECT

  ┌──────────────────────────────────────┐
  │            ApplicationManager         │
  │                                       │
  │  users: Map<string, User>            │
  │  orders: Map<string, Order>          │
  │  db: DatabaseConnection              │
  │  mailer: EmailClient                 │
  │  logger: Logger                      │
  │  cache: RedisClient                  │
  │  config: AppConfig                   │
  │                                       │
  │  createUser()                        │
  │  deleteUser()                        │
  │  placeOrder()                        │
  │  cancelOrder()                       │
  │  chargePayment()                     │
  │  refundPayment()                     │
  │  sendEmail()                         │
  │  generateReport()                    │
  │  clearCache()                        │
  │  rotateLog()                         │
  │  migrateDatabase()                   │
  │  ... 47 more methods ...             │
  └──────────────────────────────────────┘

  3,000 lines. Imported by every file.
  Change anything? Pray nothing breaks.
```

### Why It Happens

- "I'll just add one more method" (repeated 50 times)
- No one wants to refactor because it's too risky
- New developers add to it because that's where everything already is

### How to Fix It

Apply SRP. Extract responsibilities into separate classes:

```
AFTER REFACTORING

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ UserService  │  │ OrderService │  │ PaymentSvc   │
  │ createUser() │  │ placeOrder() │  │ charge()     │
  │ deleteUser() │  │ cancelOrder()│  │ refund()     │
  └──────────────┘  └──────────────┘  └──────────────┘
```

---

## Spaghetti Code

### What It Looks Like

Code with tangled, unpredictable control flow. Functions call
functions that call functions in a web of dependencies with no
clear structure. Following the logic feels like tracing a plate
of spaghetti.

```
SPAGHETTI CODE FLOW

  start() → processA() → helperX() → processB() → helperX()
     ↑          │                         │
     │          ↓                         ↓
     │     utilityZ() ←──── processC() ──→ helperY()
     │          │                │            │
     └──────────┘                ↓            │
                            processA() ←──────┘
                            (circular!)
```

### Why It Happens

- No upfront design — code grows organically
- Fixing bugs by patching instead of understanding
- Copy-pasting code and adding branches
- No separation of concerns

### How to Fix It

- Identify and extract clear layers (input, processing, output)
- Remove circular dependencies
- Each function should have one clear purpose
- Use patterns like Strategy and Command to organize control flow

---

## Lava Flow

### What It Looks Like

Dead code that nobody dares remove. Old functions, unused variables,
commented-out blocks, deprecated modules — all frozen in place like
hardened lava.

```
LAVA FLOW

  // TODO: remove this after Q3 2019 migration
  function oldCalculatePrice(items) {
    // ... 200 lines of dead code ...
  }

  // Old version - keeping just in case
  // function processOrder_v1(order) {
  //   ... 150 commented-out lines ...
  // }

  function calculatePrice(items) {
    // This is a copy of oldCalculatePrice with one line changed
    // ... 198 lines identical to the dead function ...
    // Line 147: changed "tax * 1.07" to "tax * 1.08"
    // ... remaining identical lines ...
  }
```

### Why It Happens

- Fear of deleting code ("what if we need it?")
- No one knows if the code is still used
- No tests, so removing code might break things silently
- "We'll clean it up later" (later never comes)

### How to Fix It

- Version control IS your backup — delete dead code fearlessly
- Use code coverage tools to find unused functions
- Regular "code archaeology" sessions to clean up
- If no test covers it and no one calls it, delete it

---

## Golden Hammer

### What It Looks Like

Using the same tool/pattern/technology for everything, regardless
of whether it's appropriate.

```
GOLDEN HAMMER EXAMPLES

  "We know React, so let's build the CLI tool in React."

  "MongoDB worked great for the last project, so let's use
   it for this financial ledger that needs ACID transactions."

  "Let's use microservices for this two-page website."

  "Every class needs a Factory, an Interface, a Builder,
   and a Singleton."

  "We always use the Repository pattern — even for this
   script that runs once and reads one CSV file."
```

### Why It Happens

- Comfort with familiar tools
- Resume-driven development
- Overconfidence from past success
- Not evaluating alternatives

### How to Fix It

- Evaluate each problem independently
- Learn multiple tools and paradigms
- Ask "is this the simplest solution?" before adding complexity
- Seek opinions from developers with different backgrounds

---

## Premature Optimization

### What It Looks Like

Optimizing code before you know if it's slow. Adding caching,
threading, complex data structures, or clever tricks to "make it
fast" when the simple version works fine.

```
PREMATURE OPTIMIZATION

  BEFORE (simple, works, handles 1000 req/sec):
    users = db.query("SELECT * FROM users WHERE active = true")

  AFTER "OPTIMIZATION" (complex, handles 1050 req/sec):
    users = cache.get("active_users")
    if not users:
        users = db.query("SELECT * FROM users WHERE active = true")
        cache.set("active_users", users, ttl=300)
        invalidation_queue.register("users", "active_users")
        metrics.increment("cache_miss")
    else:
        metrics.increment("cache_hit")

  You added 10 lines of code, a cache dependency, and a cache
  invalidation bug — for a 5% improvement nobody asked for.
  Meanwhile, there's an O(n²) loop in the billing code that
  actually IS the bottleneck.
```

### The Rule

Profile first. Optimize the bottleneck. Ignore everything else.

---

## Copy-Paste Programming

### What It Looks Like

Duplicating code instead of abstracting shared logic. Small
differences between copies accumulate. Bugs fixed in one copy
aren't fixed in the others.

```
COPY-PASTE DIVERGENCE

  Version 1 (original):     createUser(name, email)
  Version 2 (copied):       createAdmin(name, email)  // added role check
  Version 3 (copied):       createGuest(name, email)  // removed email validation

  Bug found in email validation — fixed in Version 1.
  Version 2: still has the bug.
  Version 3: doesn't even HAVE validation anymore.
  Nobody remembers Version 3 exists.
```

### How to Fix It

- Extract shared logic into functions
- Use parameters or configuration to handle variations
- Strategy pattern for varying behavior
- Apply the DRY principle (Don't Repeat Yourself) — but don't over-DRY

---

## Cargo Cult Programming

### What It Looks Like

Using patterns, practices, or code without understanding WHY.
Copying architecture from a blog post without knowing if it solves
your specific problem.

```
CARGO CULT EXAMPLES

  "Netflix uses microservices, so we should too."
  (Netflix has 10,000 engineers. You have 3.)

  "I saw this in a tutorial, so it must be correct."
  (The tutorial was for a completely different use case.)

  "Always use dependency injection."
  (Even for a 50-line script?)

  "This code has a try/catch block here."
  "Why?"
  "I don't know, but removing it breaks something."
```

### How to Fix It

- Always ask "WHY does this exist?"
- Understand the trade-offs of every pattern you use
- Question blog posts and tutorials — what's their context?
- If you can't explain why a piece of code exists, investigate

---

## Magic Numbers and Strings

### What It Looks Like

Unexplained literal values scattered throughout the code:

```typescript
if (user.age > 21) { ... }
if (retries < 3) { ... }
if (status === "act_pend_rev_2") { ... }
setTimeout(callback, 86400000);
if (items.length > 999) { ... }
```

What's 21? Why 3 retries? What does "act_pend_rev_2" mean? Why
86400000 milliseconds?

### How to Fix It

```typescript
const LEGAL_DRINKING_AGE = 21;
const MAX_RETRIES = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS_PER_PAGE = 999;

enum OrderStatus {
  PendingReview = "pending_review",
  Approved = "approved",
  Rejected = "rejected",
}
```

---

## When NOT to Use Patterns

This might be the most important anti-pattern: **over-engineering**.

```
THE OVER-ENGINEERING SPECTRUM

  Under-engineered          Just Right          Over-engineered
  ────────────────          ──────────          ───────────────
  Spaghetti code            Clear structure     AbstractSingletonProxy
  No separation             Appropriate use       FactoryBeanManager
  Hard to change            of patterns            ConfiguratorImpl
  Hard to test              Easy to understand   12 files for one feature
                            Easy to change       Nobody can follow it

  SIGNS OF OVER-ENGINEERING:
  ✗ More abstraction layers than business requirements
  ✗ Interfaces with only one implementation (and no plans for more)
  ✗ Factory for objects that never vary
  ✗ Observer pattern with one observer
  ✗ More design patterns than developers on the team
  ✗ "Flexible" code that's never been flexed
```

### The YAGNI Principle

**Y**ou **A**in't **G**onna **N**eed **I**t.

Don't add flexibility you don't need today. When (if) you need it
later, you'll know much more about the actual requirements.

```
YAGNI DECISION FLOW

  "Should I add this abstraction?"
  │
  ├─ Do I need it RIGHT NOW?
  │  ├─ YES → Add it
  │  └─ NO → Don't add it
  │
  "But what if I need it later?"
  │
  └─ Then add it later, when you understand
     the actual requirement.
     Adding it now means you're guessing.
     Guessing creates the wrong abstraction.
```

---

## Anti-Pattern Quick Reference

```
ANTI-PATTERN           SYMPTOM                    FIX
───────────────────    ──────────────────────     ──────────────────
God Object             One class does everything   SRP, extract classes
Spaghetti Code         Tangled control flow        Layer, extract functions
Lava Flow              Dead code everywhere         Delete it (use git)
Golden Hammer          Same solution for all        Evaluate per-problem
Premature Optimization Optimizing without data      Profile first
Copy-Paste             Duplicated code diverges     Extract + parameterize
Cargo Cult             Patterns without reason      Ask "why?"
Magic Numbers          Unexplained literals         Named constants/enums
Over-Engineering       Too many abstractions        YAGNI
Shotgun Surgery        One change → many files      Improve cohesion
Boat Anchor            Unused code "just in case"   Delete it
```

---

## Exercises

1. **God Object hunt**: Open a codebase you work on. Find the
   largest class or module. Does it have multiple responsibilities?
   Sketch how you'd split it.

2. **Lava flow cleanup**: Find commented-out code or functions that
   nothing calls. Delete them. (Your version control has the backup.)

3. **Golden hammer check**: Think about your last three projects.
   Did you use the same architecture/patterns for all three? Would
   a different approach have been simpler for any of them?

4. **YAGNI audit**: Find an abstraction in your codebase with only
   one implementation and no foreseeable second one. Was it worth
   the complexity?

---

[← Previous: Repository and Unit of Work](./16-repository-uow.md) · [Next: Lesson 18 — Build With Patterns (Capstone) →](./18-build-with-patterns.md)
