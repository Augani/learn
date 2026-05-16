# Lesson 06: Storage Interfaces

> **The one thing to remember**: Storage performance is not only about the medium.
> The interface and protocol matter too. SATA and NVMe represent different eras and assumptions about how storage devices should communicate with the system.

---

## Start With Two Delivery Systems

Imagine one warehouse system designed for slower, more sequential loading patterns, and another designed for many fast queued requests in parallel.

That is a useful way to think about SATA and NVMe.

They are both storage communication paths, but they reflect different performance assumptions.

---

## SATA Intuition

**SATA** is strongly associated with older storage assumptions and was long common for hard drives and SATA SSDs.

It works, but it reflects a world where storage communication expectations were different from today's fastest solid-state paths.

For beginners, the key idea is:

- SATA is important historically and still relevant
- but it is not the modern fastest path for high-performance SSDs

---

## NVMe Intuition

**NVMe** is designed for modern solid-state storage communicating much more directly and efficiently with the system.

It benefits from:

- better alignment with high-speed interconnects such as PCIe
- deeper command queues
- lower overhead for modern storage patterns

This is why NVMe SSDs are discussed so differently from SATA drives.

---

## HDD vs SSD Behavior

Even before the interface question, the storage medium matters.

### HDD

- mechanical movement
- stronger penalties for random access
- slower access patterns overall

### SSD

- no spinning disk or seek arm
- much better random-access behavior
- very different internal behavior and performance characteristics

The interface and the medium interact, but they are not the same issue.

---

## Why Queues Matter

Modern storage often benefits from handling multiple outstanding requests effectively.

That is one reason newer interfaces and protocols matter: they are not just “faster wires,” but better ways to express modern storage workloads.

---

## Why Developers Should Care

Storage interfaces explain:

- why NVMe drives feel different from SATA drives
- why queue depth and workload shape matter in storage performance
- why the medium alone does not tell the whole performance story

This helps connect file I/O performance with the hardware path underneath.

---

## Hands-On Exercise

Inspect the storage in one machine.

1. Determine whether it uses SATA, NVMe, or another major interface.
2. Note whether the device is an HDD or SSD.
3. Write a short explanation of why interface and medium both matter for performance.

---

## Recap

- Storage performance depends on both the medium and the communication interface.
- SATA reflects older storage assumptions and remains historically important.
- NVMe is designed for fast modern solid-state storage workloads.
- Queueing and protocol design matter, not just raw device speed.

Next, we move from buses and interfaces to specific device communication stories, starting with displays and GPUs.