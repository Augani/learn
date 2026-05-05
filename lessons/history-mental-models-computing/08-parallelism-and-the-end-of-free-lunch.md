# Lesson 08: Parallelism and the End of Free Lunch

> **The one thing to remember**: For a long time, software often got faster just by running on newer CPUs.
> That easy trend slowed when frequency and power scaling hit limits, pushing computing toward multicore, parallelism, and new performance tradeoffs.

---

## Start With the Free Lunch Idea

For many years, developers often benefited from a powerful pattern:

- buy a newer machine
- run the same software
- get more performance “for free”

That was never literally free, but it felt that way from the application developer's point of view.

Eventually, that trend slowed.

---

## Why Clock Speeds Could Not Keep Rising Forever

Higher clocks and more aggressive execution eventually ran harder into:

- power limits
- thermal limits
- complexity costs

That meant system designers could not rely indefinitely on simply pushing one core faster and faster.

This was a major turning point in computing.

---

## The Move to Multicore

One major response was to place multiple cores on a chip.

That increased total available computation, but it changed the problem for software.

Instead of relying mainly on faster single-thread performance, developers increasingly needed to think about:

- threads
- parallel work
- synchronization
- load balance

This is why parallelism became a mainstream software concern.

---

## Amdahl's Law Intuition

One useful mental model here is the intuition behind **Amdahl's Law**:

- if part of your workload must stay serial
- then adding more parallel resources eventually helps less than you hope

You do not need the full formula on the first pass. The key lesson is:

> Parallel speedup is limited by the parts that cannot be parallelized well.

This is one reason multicore scaling is always workload-dependent.

---

## Why This Changed Software Culture

Once free speedups slowed, many topics became more important:

- concurrency
- data locality
- vectorization
- distributed computation
- accelerator use

This historical shift is one reason modern engineering feels more performance-conscious and system-aware than some earlier software eras did.

---

## Why Developers Should Care

The end of free lunch explains:

- why parallel programming became essential instead of optional in many domains
- why multicore and SIMD show up everywhere now
- why software can no longer assume the next hardware generation will automatically fix all performance problems

This is one of the clearest examples of history becoming day-to-day engineering reality.

---

## Hands-On Exercise

Write a short paragraph answering this question:

“Why doesn't doubling the number of cores always cut runtime in half?”

Mention at least:

- serial work
- coordination overhead
- workload dependence

---

## Recap

- Easy single-core speed scaling eventually slowed because of power and thermal limits.
- Multicore and parallelism became the main path forward for more throughput.
- Parallel speedup is limited by serial work and coordination overhead.
- Modern software performance work is shaped by this historical shift.

You now have the full arc of the track: from computability and stored programs through hardware shifts, operating systems, networking, ISA design, the memory wall, and the move into the multicore era.