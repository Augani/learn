# TypeScript & Modern Web Track

## Who This Is For

You know Rust or Go. You think in types, ownership, and concurrency.
Now you need to build web apps — specifically AI-powered ones.
This track gets you there fast.

```
  YOUR JOURNEY
  ============

  Rust/Go Developer
       |
       v
  +------------------+     +-------------------+     +------------------+
  | TypeScript Core   |---->| React & Next.js   |---->| Production Apps  |
  | Lessons 01-05     |     | Lessons 06-09     |     | Lessons 10-18    |
  +------------------+     +-------------------+     +------------------+
       |                         |                         |
       | - Type system           | - Components            | - Auth, forms
       | - Generics              | - Server components     | - Testing
       | - Async patterns        | - App router            | - Deployment
       | - Node runtime          | - Data fetching         | - AI capstone
       |                         |                         |
       v                         v                         v
     FOUNDATION               FRAMEWORK                SHIPPING
```

## Lessons

| #  | Lesson                        | Key Concepts                              |
|----|-------------------------------|-------------------------------------------|
| 01 | TypeScript for Systems Devs   | TS vs Rust/Go, why TS, type system basics |
| 02 | Type System Deep Dive         | Generics, unions, mapped & conditional    |
| 03 | Utility Types                 | Partial, Pick, Omit, Record, inference    |
| 04 | Async TypeScript              | Promises, async/await, AbortController    |
| 05 | Node Runtime                  | Event loop, modules, npm, built-in APIs   |
| 06 | React Fundamentals            | Components, JSX, props, state, hooks      |
| 07 | React Patterns                | Custom hooks, compound components, ctx    |
| 08 | Next.js Fundamentals          | App router, RSC, layouts, routing         |
| 09 | Next.js Data                  | Server actions, caching, streaming        |
| 10 | Forms & Validation            | React Hook Form, Zod, error handling      |
| 11 | State Management              | Zustand, Jotai, TanStack Query            |
| 12 | Styling                       | Tailwind, CSS modules, responsive, dark   |
| 13 | Testing                       | Vitest, RTL, Playwright, MSW              |
| 14 | Authentication                | Auth.js, sessions, middleware, guards     |
| 15 | API Routes                    | Next.js APIs, tRPC, end-to-end types      |
| 16 | Performance                   | Core Web Vitals, lazy load, splitting     |
| 17 | Deployment                    | Vercel, Docker, CI/CD, env vars           |
| 18 | Build an AI Web App           | Capstone: full-stack AI app               |

## Reference Sheets

- `reference-typescript.md` — TypeScript cheat sheet for systems programmers
- `reference-react-patterns.md` — Common React patterns quick reference

## How to Use This Track

```
  RECOMMENDED PACE
  ================

  Week 1: Lessons 01-05  (TypeScript + Node foundation)
  Week 2: Lessons 06-09  (React + Next.js)
  Week 3: Lessons 10-14  (Production patterns)
  Week 4: Lessons 15-18  (APIs, perf, deploy, capstone)
```

Each lesson is self-contained with runnable examples and exercises.
Code examples assume you have Node.js 20+ and a package manager (pnpm recommended).

```bash
npm install -g pnpm
pnpm create next-app@latest my-app --typescript
```

## Mental Model: Systems Dev to Web Dev

```
  Rust/Go Concept          TypeScript Equivalent
  =====================    =====================
  enum variants        --> discriminated unions
  trait/interface       --> interface + generics
  Result<T, E>         --> Promise<T> + try/catch
  ownership/borrowing  --> garbage collection (no manual mgmt)
  cargo/go mod         --> npm/pnpm + package.json
  compile-time checks  --> tsc type checking (no runtime cost)
  goroutines/tokio     --> async/await + event loop
  structs              --> interfaces / type aliases
```

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Effective TypeScript** by Dan Vanderkam (O'Reilly, 2nd Edition 2024) — 83 ways to improve your TypeScript
- **The Road to React** by Robin Wieruch (self-published, 2024 Edition) — Modern React with hooks and TypeScript

---

[Next: Lesson 01 - TypeScript for Systems Devs →](./01-typescript-for-systems-devs.md)
