# Lesson 09: Memory-Mapped I/O vs Port I/O

> **The one thing to remember**: Devices often expose control registers that software
> can read or write. Memory-mapped I/O treats those control regions like special addresses in the system's address space, while port I/O uses a separate access model in some architectures.

---

## Start With Control Panels

Imagine a machine with a control panel full of switches and status lights.

Software needs some way to interact with that panel:

- read status
- set options
- start actions

Device registers play that role in hardware.

The question is how those control surfaces are exposed to the CPU.

---

## Memory-Mapped I/O

In **memory-mapped I/O** or **MMIO**, device registers appear as special addresses in the system's address space.

That means the CPU can interact with those device control locations through address-based access patterns similar in concept to memory access.

This does **not** mean the device is ordinary RAM. It means the address space includes device-controlled regions.

---

## Port I/O

Some architectures also support a separate **port I/O** model.

At a high level, this means device access happens through a distinct mechanism rather than ordinary memory-style address space mapping.

You do not need to master architecture-specific instructions here. The key distinction is that device interaction can be modeled either as special memory addresses or as a separate I/O access space.

---

## Why MMIO Is So Important

MMIO is common because it provides a unified way for software to target device-controlled registers through the system's broader addressing model.

This makes many hardware control interactions conceptually cleaner from the OS and driver point of view.

That said, those regions still have special semantics and are not the same as normal cached RAM.

---

## Why Developers Should Care

MMIO vs port I/O explains:

- how software can “talk to hardware registers” in concrete terms
- why device drivers often reference mapped control regions
- why not every memory-looking address behaves like ordinary RAM

It is one of the most direct interfaces between software and hardware control state.

---

## Hands-On Exercise

Choose one device conceptually, such as a NIC or GPU.

1. Imagine it exposes registers for status and control.
2. Write two examples of what software might read or write there.
3. Explain why those accesses are logically different from reading ordinary program data.

---

## Recap

- Devices often expose control and status through registers.
- MMIO maps those registers into the address space as special regions.
- Port I/O uses a separate access model on some systems.
- Device register access is a key way software controls hardware behavior.

Next, we bring the whole track together by tracing a complete device-to-software journey.