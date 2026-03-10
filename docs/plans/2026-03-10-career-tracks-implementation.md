# Career Tracks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 9 career tracks, 6 new topic areas (~99 lessons), and book recommendations to the learn platform.

**Architecture:** Career tracks are a data layer on top of existing topics — a JSON definition in `generate-manifest.ts` that maps career names to ordered lists of topic IDs. The UI adds a new `careerTrack` view state and a career track detail page. New topics are markdown lesson files following existing conventions.

**Tech Stack:** TypeScript, React, Vite, Tailwind CSS, Markdown lessons

---

## Phase 1: New Topic Lessons (6 topics, ~99 files)

### Task 1: Create ci-cd-pipelines topic (16 lessons)

**Files:**
- Create: `lessons/ci-cd-pipelines/00-roadmap.md`
- Create: `lessons/ci-cd-pipelines/01-why-cicd.md` through `16-build-pipeline-project.md`

**Lesson outline:**
1. Why CI/CD matters
2. Version control workflows (trunk-based, gitflow, GitHub flow)
3. Git hooks and pre-commit
4. Introduction to GitHub Actions
5. Workflows, jobs, and steps
6. Build automation
7. Automated testing in CI
8. Linting and code quality gates
9. Artifacts and caching
10. Environment variables and secrets
11. Deployment strategies (blue-green)
12. Canary and rolling deployments
13. Feature flags
14. Monitoring deployments
15. Multi-environment pipelines
16. Build a complete CI/CD pipeline (project)

### Task 2: Create testing-quality topic (18 lessons)

**Files:**
- Create: `lessons/testing-quality/00-roadmap.md`
- Create: `lessons/testing-quality/01-why-testing.md` through `18-build-test-suite.md`

**Lesson outline:**
1. Why testing matters
2. The testing pyramid
3. Unit testing fundamentals
4. Writing good assertions
5. Mocking, stubs, and fakes
6. Integration testing
7. End-to-end testing
8. Test-driven development (TDD)
9. Property-based testing
10. Snapshot and golden file testing
11. Test fixtures and factories
12. Code coverage — what it means and doesn't
13. Mutation testing
14. Testing async code
15. Testing databases and external services
16. Performance and load testing
17. Test architecture and organization
18. Build a comprehensive test suite (project)

### Task 3: Create design-patterns topic (18 lessons)

**Files:**
- Create: `lessons/design-patterns/00-roadmap.md`
- Create: `lessons/design-patterns/01-why-patterns.md` through `18-build-with-patterns.md`

**Lesson outline:**
1. Why design patterns exist
2. SOLID principles — single responsibility
3. SOLID — open/closed, Liskov, interface segregation, dependency inversion
4. Creational patterns — factory, builder
5. Creational patterns — singleton, prototype
6. Structural patterns — adapter, facade
7. Structural patterns — decorator, proxy
8. Structural patterns — composite, bridge
9. Behavioral patterns — strategy, observer
10. Behavioral patterns — command, state
11. Behavioral patterns — iterator, template method
12. Dependency injection
13. Clean architecture
14. Hexagonal architecture (ports and adapters)
15. Domain-driven design basics
16. Repository and unit of work patterns
17. Anti-patterns and when NOT to use patterns
18. Refactor a codebase using patterns (project)

### Task 4: Create infrastructure-as-code topic (15 lessons)

**Files:**
- Create: `lessons/infrastructure-as-code/00-roadmap.md`
- Create: `lessons/infrastructure-as-code/01-why-iac.md` through `15-build-infrastructure.md`

**Lesson outline:**
1. Why infrastructure as code
2. Declarative vs imperative
3. Terraform — installation and first resource
4. Terraform — providers and resources
5. Terraform — variables and outputs
6. Terraform — state management
7. Terraform — modules
8. Terraform — data sources and dependencies
9. Terraform — workspaces and environments
10. Remote state and locking
11. Terraform — advanced patterns (for_each, dynamic blocks)
12. Testing infrastructure code
13. Policy as code (OPA/Sentinel)
14. Drift detection and remediation
15. Build a multi-environment infrastructure (project)

### Task 5: Create message-queues-streaming topic (16 lessons)

**Files:**
- Create: `lessons/message-queues-streaming/00-roadmap.md`
- Create: `lessons/message-queues-streaming/01-why-async-messaging.md` through `16-build-event-system.md`

**Lesson outline:**
1. Why asynchronous messaging
2. Message queues vs event streams
3. Pub/sub pattern
4. Point-to-point vs broadcast
5. Apache Kafka — architecture
6. Kafka — producers and consumers
7. Kafka — consumer groups and partitions
8. Kafka — exactly-once semantics
9. RabbitMQ — architecture and exchanges
10. RabbitMQ — queues, bindings, routing
11. Dead letter queues and retry patterns
12. Event-driven architecture
13. Event sourcing
14. CQRS (Command Query Responsibility Segregation)
15. Stream processing fundamentals
16. Build an event-driven system (project)

### Task 6: Create authentication-authorization topic (16 lessons)

**Files:**
- Create: `lessons/authentication-authorization/00-roadmap.md`
- Create: `lessons/authentication-authorization/01-identity-basics.md` through `16-build-auth-system.md`

**Lesson outline:**
1. Identity, authentication, and authorization
2. Password-based authentication
3. Hashing and salting passwords
4. Sessions and cookies
5. Token-based authentication
6. JSON Web Tokens (JWT) deep dive
7. OAuth 2.0 — the big picture
8. OAuth 2.0 — authorization code flow
9. OAuth 2.0 — client credentials, device flow
10. OpenID Connect (OIDC)
11. SAML and enterprise SSO
12. Role-based access control (RBAC)
13. Attribute-based access control (ABAC)
14. Multi-factor authentication (MFA)
15. Passkeys and WebAuthn
16. Build a complete auth system (project)

---

## Phase 2: Book Recommendations

### Task 7: Add book recommendations to all topic roadmaps

Add a `## Recommended Reading` section to every `00-roadmap.md` file (existing 36 topics + 6 new ones). Only verified books. Mark free resources.

---

## Phase 3: Career Tracks Data & UI

### Task 8: Update types and manifest generator

**Files:**
- Modify: `src/types.ts`
- Modify: `scripts/generate-manifest.ts`

Add `CareerTrack` interface, `careerTracks` to `Manifest`, and career track definitions in the manifest generator.

### Task 9: Update App.tsx — routing and state

**Files:**
- Modify: `src/App.tsx`

Add `careerTrack` view state, update `parseHash` for `#/career/<id>`, add `currentCareerTrack` state, update navigation functions.

### Task 10: Update App.tsx — landing page

**Files:**
- Modify: `src/App.tsx`

Add career tracks cards section above existing topic grid. Each card shows: title, description, difficulty badge, topic count, overall progress across all topics in the track.

### Task 11: Update App.tsx — career track detail view

**Files:**
- Modify: `src/App.tsx`

New `renderCareerTrack()` function showing: track description, difficulty, book recommendations, ordered list of topics with per-topic progress bars. Clicking a topic opens the existing topic view.

### Task 12: Update generate-manifest.ts — new topic metadata

**Files:**
- Modify: `scripts/generate-manifest.ts`

Add new topics to `TRACK_ORDER` and `formatTrackTitle`.

### Task 13: Update App.tsx — TRACK_CATEGORIES for new topics

**Files:**
- Modify: `src/App.tsx`

Add the 6 new topics to `TRACK_CATEGORIES` with appropriate labels, icons, and colors.

### Task 14: Generate manifest and verify build

Run `bun run generate` and `bun run build` to verify everything compiles and the manifest is correct.

---

## Execution Order

Phase 1 (Tasks 1-6) can run in parallel — each topic is independent.
Phase 2 (Task 7) can run in parallel with Phase 1.
Phase 3 (Tasks 8-14) is sequential and depends on Phase 1 completing.
