# Lesson 05: Kernel Initialization

> **The one thing to remember**: Once the bootloader hands off control, the kernel
> still has a huge amount of early setup to do before the system is ready for normal processes and user space.

---

## Start With the Operating System Waking Up Properly

The kernel does not begin life in the same comfortable environment that your programs do.

At early startup, it still needs to establish many of the conditions later software depends on:

- memory management structures
- interrupt handling foundations
- device discovery paths
- core scheduler and process setup

So “kernel started” does not yet mean “system is ready.”

---

## Early Startup Is Special

Early kernel code often runs with limited assumptions.

It may need to:

- unpack or decompress parts of itself
- establish page tables and memory mappings
- initialize core subsystems in a careful order
- consume information passed by the bootloader or firmware

This is one of the reasons kernel startup code is a distinct and specialized part of operating systems.

---

## Memory Setup Matters Immediately

The kernel needs a stable view of memory very early.

That means startup often includes:

- understanding available physical memory
- setting up address mappings
- creating early allocation structures

Without this, later kernel code would have nowhere reliable to place or track its own data.

---

## The Kernel Is Building the World It Will Later Run

This is the key mental model.

The kernel is not just “another program starting.”
It is setting up the environment in which all later programs will exist.

That includes things like:

- process model foundations
- device access infrastructure
- filesystem support
- interrupts and scheduling

The kernel has to create the world it will later manage.

---

## Why Developers Should Care

Kernel initialization explains:

- why boot logs show many stages before login or shells appear
- why early kernel failures can happen long before user-space tools exist
- why bootloaders pass structured startup information forward
- why operating system startup is more than just “load binary and run main”

---

## Hands-On Exercise

Inspect a kernel boot log.

1. Find a few early lines showing memory setup, CPU setup, or early subsystem initialization.
2. Identify one thing the kernel had to establish before user space could exist.
3. Explain why that task belongs to the kernel and not the bootloader.

---

## Recap

- Kernel startup is an extended initialization phase, not an instant transition to normal operation.
- The kernel must establish memory, subsystem, and execution foundations.
- Early kernel code runs under special constraints.
- User space depends on a lot of groundwork being laid first.

Next, we follow the boot story into the component that becomes process 1 and coordinates the rest of system startup: the init system.