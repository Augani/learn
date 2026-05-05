# History & Mental Models of Computing — No Degree Required

This track explains why modern computing looks the way it does. It is not a
timeline of trivia. It is a guided tour of the key ideas and turning points that
still shape how software, hardware, and systems behave today.

You do not need prior history knowledge. We focus on the moments and mental
models that most directly help self-taught developers reason better about modern systems.

---

## Why This Track Matters

Many computing ideas feel arbitrary until you know the problems they were solving:

- why code and data share memory
- why caches became essential
- why networking is packet-based
- why multicore replaced endless clock-speed growth

This track turns “historical facts” into explanations for current system design.

---

## How This Track Is Organized

```
Phase 1: Foundations of the Model   (Lessons 01-03)
Phase 2: System and Network Shifts  (Lessons 04-06)
Phase 3: Modern Constraints         (Lessons 07-08)
```

Each lesson starts with the problem of the era, explains the breakthrough idea,
then connects it directly to what developers still see today.

---

## Phase 1: Foundations of the Model (Lessons 01–03)

- [ ] **01 - Turing Machines and Computability**
      Universal computation, limits of computation, halting intuition
- [ ] **02 - Von Neumann and Stored Programs**
      Why code and data share memory, the fetch-execute model
- [ ] **03 - From Vacuum Tubes to Transistors**
      Reliability, scaling, and why transistorization changed everything

```
  +---------+     +-------------+     +-------------+
  | Turing  |---->| Von Neumann |---->| Transistors |
  +---------+     +-------------+     +-------------+
      01              02               03
```

---

## Phase 2: System and Network Shifts (Lessons 04–06)

- [ ] **04 - The OS Revolution**
      Batch systems, timesharing, Unix, and why processes and files matter
- [ ] **05 - The Network Revolution**
      ARPANET, packet switching, TCP/IP, why the internet looks like it does
- [ ] **06 - RISC vs CISC and the Architecture Wars**
      ISA design battles, ARM vs x86 context, why different tradeoffs survived

```
  +------+     +----------+     +-----------+
  |  OS  |---->| Networks |---->| ISA Wars  |
  +------+     +----------+     +-----------+
     04            05             06
```

---

## Phase 3: Modern Constraints (Lessons 07–08)

- [ ] **07 - The Memory Wall and Caching**
      CPU vs memory speed gap, why caches became mandatory
- [ ] **08 - Parallelism and the End of Free Lunch**
      Why clock speeds stopped scaling cleanly, multicore, Amdahl's Law intuition

```
  +-------------+     +-------------+
  | Memory Wall |---->| Parallelism |
  +-------------+     +-------------+
        07               08
```

---

## Who This Track Is For

- Self-taught developers who want stronger “why” behind modern systems design
- Anyone learning systems topics and noticing that many conventions feel historically accidental
- Engineers who want a compact conceptual history instead of a trivia-heavy chronology

## Prerequisites

You should be comfortable with:

- basic programming concepts
- high-level ideas about computers, operating systems, and networks

Helpful but not required:

- [CS Fundamentals](../cs-fundamentals/00-roadmap.md)
- [Computer Architecture](../computer-architecture/00-roadmap.md)
- [Networking](../networking/00-roadmap.md)

---

## What You Will Be Able To Explain After This Track

- why universal computation was such a conceptual breakthrough
- why modern programs and data share memory
- why operating systems, packet networks, and caches emerged the way they did
- why ISA debates and multicore transitions still matter today
- why modern computing feels the way it does instead of some other way

---

## Time Estimate

```
Phase 1:  ~6 hours   (foundational ideas)
Phase 2:  ~7 hours   (systems and networking revolutions)
Phase 3:  ~4 hours   (modern performance constraints)
          --------
Total:    ~17 hours
```

Read this track alongside the others. It is designed to strengthen intuition by
explaining why the later technical details were necessary responses to real constraints.

---

## Recommended Reading

These books are optional — the lessons stand on their own.

- **Code: The Hidden Language of Computer Hardware and Software** by Charles Petzold (Microsoft Press, 2nd Edition 2022) — Excellent bridge from historical ideas to modern mental models
- **The Innovators** by Walter Isaacson (Simon & Schuster, 2014) — Broad historical overview of computing's key figures and shifts
- **Where Wizards Stay Up Late** by Katie Hafner and Matthew Lyon (Simon & Schuster, 1996) — Strong narrative on the ARPANET and networking origins

---

*Track version: 2026.05*