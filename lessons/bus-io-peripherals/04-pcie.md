# Lesson 04: PCIe

> **The one thing to remember**: PCIe is a high-speed interconnect used by major
> devices such as GPUs, NVMe drives, and network cards. It gives those devices a fast path into the system's broader communication fabric.

---

## Start With High-Speed Lanes

Imagine a highway where different kinds of heavy traffic need fast, structured routes into a city.

PCIe is like the modern high-speed highway system for important internal devices.

It is not just “a slot on the motherboard.” It is the communication path that lets serious high-bandwidth peripherals exchange data with the system efficiently.

---

## Lanes and Bandwidth

One of the first PCIe ideas people hear about is **lanes**.

A device might use:

- x1
- x4
- x8
- x16

The intuitive meaning is:

- more lanes can provide more communication capacity

This is why graphics cards and some fast storage devices care about lane width.

---

## Why PCIe Matters

PCIe is the path used by many high-performance devices because they need:

- low-latency communication
- substantial bandwidth
- structured interaction with the system

Examples include:

- GPUs
- NVMe SSDs
- NICs
- accelerator cards

Without an interconnect like PCIe, these devices would be far more constrained.

---

## Why Developers Should Care

PCIe explains:

- why high-speed devices are discussed in terms of lanes and generations
- why device placement and bandwidth sharing can matter
- why GPUs, fast storage, and NICs are all often framed as PCIe devices in systems discussions

It is the backbone path for much of modern high-performance internal I/O.

---

## Hands-On Exercise

Inspect one machine's device summary.

1. Identify one PCIe-attached device such as a GPU, NVMe drive, or network card.
2. Note what kind of workload benefits from its high-speed connection.
3. Explain in one short paragraph why a slow interconnect would bottleneck that device.

---

## Recap

- PCIe is a major high-speed interconnect for internal devices.
- Lanes describe communication width and help determine bandwidth capacity.
- GPUs, NVMe drives, NICs, and accelerators often rely on PCIe.
- Device performance often depends not just on the device itself but on the path connecting it to the system.

Next, we look at a very different style of bus used for a huge range of external devices: USB.