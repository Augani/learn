# Quick Reference: All Design Patterns

> A one-page cheat sheet for every pattern covered in this course.
> Use this for quick recall during code reviews, design discussions,
> or interviews.

---

## Creational Patterns

```
PATTERN          WHAT IT DOES                          USE WHEN
─────────────    ─────────────────────────────────     ──────────────────────────
Factory Method   Creates objects without specifying     You have conditional object
                 the exact class                        creation (if/else to pick type)

Abstract Factory Creates families of related objects    You need matching sets of
                 that belong together                   objects (theme, platform)

Builder          Constructs complex objects step        Object has many optional
                 by step                                parameters or complex setup

Singleton        Ensures exactly one instance exists    Shared resource: config, pool,
                 globally                               hardware (use sparingly!)

Prototype        Creates new objects by cloning an      Object creation is expensive
                 existing one                           and you need many similar copies
```

---

## Structural Patterns

```
PATTERN          WHAT IT DOES                          USE WHEN
─────────────    ─────────────────────────────────     ──────────────────────────
Adapter          Converts one interface to another      Integrating a library or
                                                        legacy system with a
                                                        different API

Facade           Provides a simple interface to a       Complex subsystem with many
                 complex subsystem                      classes; callers need a
                                                        simplified API

Decorator        Adds behavior by wrapping objects;     You need to add features
                 stackable                              without modifying the class;
                                                        middleware

Proxy            Controls access to an object           Lazy loading, caching,
                 (caching, auth, logging, lazy)         access control, logging

Composite        Treats single objects and groups       Tree structures (file systems,
                 uniformly                              UI components, menus, org
                                                        charts)

Bridge           Separates abstraction from             Two independent dimensions
                 implementation                         of variation; avoid class
                                                        explosion
```

---

## Behavioral Patterns

```
PATTERN          WHAT IT DOES                          USE WHEN
─────────────    ─────────────────────────────────     ──────────────────────────
Strategy         Defines a family of swappable          You have multiple ways to do
                 algorithms                             the same thing; replace
                                                        if/else chains

Observer         Objects subscribe to events and        Multiple objects must react
                 get notified on changes                to changes; event systems;
                                                        pub/sub

Command          Encapsulates an action as an object    Undo/redo, queueing, logging,
                                                        macro recording

State            Changes behavior based on internal     Object acts differently based
                 state                                  on condition; finite state
                                                        machines

Iterator         Traverses a collection without         You need to walk through data
                 exposing its internal structure         without knowing how it's
                                                        stored

Template Method  Defines algorithm skeleton; lets       Multiple classes follow the
                 subclasses override specific steps      same algorithm with
                                                        different details
```

---

## Architectural Patterns

```
PATTERN              WHAT IT DOES                      USE WHEN
──────────────────   ─────────────────────────────     ──────────────────────────
Dependency Injection Pass dependencies in from outside  Always. This is non-negotiable
                     instead of creating them inside    for testable, maintainable code

Clean Architecture   Concentric layers with deps        Medium-to-large applications
                     pointing inward; entities at       with meaningful business logic
                     the center

Hexagonal (Ports     Business core with ports           You need to support multiple
& Adapters)          (interfaces) and adapters          entry points (HTTP, CLI, tests)
                     (implementations)                  or swap infrastructure

Repository           Collection-like interface for      Anytime you access a database
                     data access; hides DB details      or external data store

Unit of Work         Groups multiple operations into    Multiple repositories must
                     a single transaction               save/update atomically
```

---

## Domain-Driven Design Concepts

```
CONCEPT              WHAT IT MEANS                     USE WHEN
──────────────────   ─────────────────────────────     ──────────────────────────
Ubiquitous Language  Shared vocab between developers    Always. Name things the way
                     and business stakeholders          the business names them

Bounded Context      Separate models for separate       Different departments use the
                     parts of the business              same words differently

Entity               Object with unique identity        Objects tracked over time
                     (identity-based equality)          (users, orders, accounts)

Value Object         Object defined by its values       Quantities, measurements,
                     (value-based equality, immutable)  addresses, money

Aggregate            Cluster of objects treated as       Related objects that must
                     one unit with a root entity        change together
```

---

## Decision Flowchart

```
WHICH PATTERN DO I NEED?

  What's the problem?
  │
  ├─ Object creation is complex
  │  ├─ Need to choose between types → Factory
  │  ├─ Need matching families      → Abstract Factory
  │  ├─ Many optional parameters    → Builder
  │  └─ Need copies of a template   → Prototype
  │
  ├─ Interfaces don't match
  │  ├─ One API to another          → Adapter
  │  └─ Simplify many APIs to one   → Facade
  │
  ├─ Need to add behavior
  │  ├─ Stack multiple behaviors    → Decorator
  │  └─ Control access/caching      → Proxy
  │
  ├─ Need flexible algorithms
  │  ├─ Swap algorithms at runtime  → Strategy
  │  └─ Same skeleton, diff steps   → Template Method
  │
  ├─ Need event communication
  │  └─ Notify multiple listeners   → Observer
  │
  ├─ Need to track/replay actions
  │  └─ Undo, queue, log actions    → Command
  │
  ├─ Behavior changes with state
  │  └─ Object acts differently     → State
  │
  ├─ Tree/hierarchy structure
  │  └─ Treat parts and wholes same → Composite
  │
  ├─ Two dimensions of variation
  │  └─ Avoid class explosion       → Bridge
  │
  ├─ Code is untestable
  │  └─ Pass dependencies in        → Dependency Injection
  │
  └─ Architecture is tangled
     ├─ Business logic is unclear    → Clean Architecture
     ├─ Hard to swap infrastructure  → Hexagonal / Ports & Adapters
     └─ DB logic mixed with domain   → Repository + Unit of Work
```

---

## One-Line Reminders

- **Factory**: "I'll make the right type for you"
- **Builder**: "Configure me step by step, then build"
- **Singleton**: "There can be only one (but usually shouldn't be)"
- **Adapter**: "I translate between two incompatible interfaces"
- **Facade**: "I'm the simple front door to a complex system"
- **Decorator**: "I wrap you to add behavior, and I'm stackable"
- **Proxy**: "I stand in for you and control access"
- **Composite**: "Groups and individuals look the same to me"
- **Bridge**: "I separate WHAT from HOW"
- **Strategy**: "Pick your algorithm at runtime"
- **Observer**: "I'll let everyone know when something changes"
- **Command**: "I'm an action you can store, queue, or undo"
- **State**: "I act differently depending on my condition"
- **Iterator**: "I give you items one at a time"
- **Template Method**: "Same recipe, different ingredients"
- **Repository**: "I look like a collection but I'm hiding a database"
- **Unit of Work**: "All or nothing — one transaction"
- **DI**: "Don't call us, we'll call you (with your dependencies)"

---

[← Back to Capstone](./18-build-with-patterns.md) · [Reference: SOLID Principles →](./reference-solid.md) · [Back to Roadmap](./00-roadmap.md)
