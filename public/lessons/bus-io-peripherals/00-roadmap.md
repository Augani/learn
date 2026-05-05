# Bus Architecture, I/O & Peripherals — No Degree Required

This track explains how the CPU communicates with the rest of the machine:
storage, network cards, USB devices, displays, and more. If “the OS reads from
disk” or “the NIC receives a packet” feels hand-wavy, this track fills in the
missing path between the processor and the devices around it.

You do not need hardware-design experience. We stay focused on conceptual data
movement, interrupts, DMA, and the system-level mental model developers need.

---

## Why This Track Matters

Software depends on I/O constantly:

- disks deliver data
- networks deliver packets
- GPUs render frames
- keyboards and mice produce input events

But those things do not talk to the CPU magically. Data moves through buses,
controllers, registers, interrupts, and memory.

Understanding that path makes operating systems, drivers, storage, networking,
and performance much easier to reason about.

---

## How This Track Is Organized

```
Phase 1: Core Communication Paths   (Lessons 01-03)
Phase 2: Major I/O Buses            (Lessons 04-06)
Phase 3: Devices in Action          (Lessons 07-10)
```

Each lesson starts with the system journey intuition, then explains the actual
communication mechanism, then ends with a practical tracing or inspection task.

---

## Phase 1: Core Communication Paths (Lessons 01–03)

- [ ] **01 - The System Bus**
      Address, data, and control signaling; how components exchange information
- [ ] **02 - Interrupts**
      Hardware interrupts, IRQs, handlers, and why devices can get the CPU's attention
- [ ] **03 - DMA — Direct Memory Access**
      Bulk transfers without involving the CPU byte by byte

```
  +----------+     +------------+     +------+
  | Bus      |---->| Interrupts |---->| DMA  |
  +----------+     +------------+     +------+
      01              02              03
```

---

## Phase 2: Major I/O Buses (Lessons 04–06)

- [ ] **04 - PCIe**
      Lanes, bandwidth, device communication, why high-speed devices use PCIe
- [ ] **05 - USB Architecture**
      Host controllers, endpoints, descriptors, classes, device enumeration
- [ ] **06 - Storage Interfaces**
      SATA vs NVMe, command queues, SSD vs HDD behavior at a conceptual level

```
  +------+     +------+     +---------+
  | PCIe |---->| USB  |---->| Storage |
  +------+     +------+     +---------+
     04           05           06
```

---

## Phase 3: Devices in Action (Lessons 07–10)

- [ ] **07 - Display and GPU Communication**
      Framebuffers, command submission, display controllers, GPU data flow
- [ ] **08 - Network Interface Cards**
      Packet DMA, ring buffers, offloads, NIC to kernel path
- [ ] **09 - Memory-Mapped I/O vs Port I/O**
      Device registers, MMIO regions, how software talks to hardware control surfaces
- [ ] **10 - Putting It Together**
      A full journey such as a keystroke or packet moving from device to application

```
  +---------+     +------+     +---------+     +------------+
  | Display |---->| NIC  |---->| MMIO/PIO|---->| Full Path  |
  +---------+     +------+     +---------+     +------------+
      07            08           09             10
```

---

## Who This Track Is For

- Developers who use operating systems, networking, or storage every day but want the hardware path underneath
- Systems and backend engineers who want a better model of device communication
- Anyone who wants to understand how data really moves through a computer

## Prerequisites

You should be comfortable with:

- basic CPU/memory ideas
- the idea that devices communicate with the operating system through drivers

Helpful but not required:

- [Computer Architecture](../computer-architecture/00-roadmap.md)
- [Boot Process & Firmware](../boot-process-firmware/00-roadmap.md)
- [Operating Systems](../os-concepts/00-roadmap.md)

---

## What You Will Be Able To Explain After This Track

- how devices signal the CPU and move data into memory
- why DMA is so important for performance
- why PCIe, USB, NVMe, and NICs are discussed differently in systems work
- how memory-mapped device registers let software control hardware
- how a real input or output event travels from hardware into the OS and app layers

---

## Time Estimate

```
Phase 1:  ~6 hours   (core bus and signal mechanisms)
Phase 2:  ~7 hours   (common buses and storage)
Phase 3:  ~7 hours   (device case studies and full-path tracing)
          --------
Total:    ~20 hours
```

This track works best when you pair it with real inspection tools such as
system profilers, device listings, kernel logs, and interface diagrams.

---

## Recommended Reading

These books are optional — the lessons are designed to stand on their own.

- **Computer Systems: A Programmer's Perspective** by Randal Bryant and David O'Hallaron (Pearson, 3rd Edition 2015) — Good systems-level bridge for programmers
- **Modern Operating Systems** by Andrew Tanenbaum and Herbert Bos (Pearson, 5th Edition 2022) — Useful for the OS side of device and interrupt behavior
- **Linux Device Drivers** by Jonathan Corbet, Alessandro Rubini, and Greg Kroah-Hartman (O'Reilly, 3rd Edition 2005) — Older but still conceptually helpful for driver mental models

---

*Track version: 2026.05*