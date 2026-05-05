# Boot Process & Firmware — No Degree Required

This track explains what happens between pressing the power button and reaching
user space. If BIOS, UEFI, bootloaders, kernel initialization, and device setup
feel like disconnected jargon, this track turns them into one continuous story.

You do not need prior firmware or kernel experience. We build the sequence from
first principles and keep the focus on the mental model software developers need.

---

## Why This Track Matters

Every running system has to start somehow.

That startup path explains:

- where the very first instruction comes from
- how hardware gets discovered and initialized
- how the OS kernel reaches memory and starts executing
- why secure boot and trust chains matter

Without this track, the path from “powered off machine” to “running process” is
mostly invisible.

---

## How This Track Is Organized

```
Phase 1: Power-On Foundations      (Lessons 01-03)
Phase 2: Loading the OS            (Lessons 04-07)
Phase 3: From Kernel to User Space (Lessons 08-10)
```

Each lesson follows the same pattern:

1. start with the system journey intuition
2. explain the real mechanism underneath it
3. connect it upward to the OS, drivers, security, or app startup
4. end with a practical observation task or inspection exercise

---

## Phase 1: Power-On Foundations (Lessons 01–03)

- [ ] **01 - Power On — What Happens First**
      Power-good signal, reset vector, first CPU instruction, firmware entry
- [ ] **02 - BIOS vs UEFI**
      Legacy BIOS, modern UEFI, why firmware interfaces evolved
- [ ] **03 - POST and Hardware Discovery**
      Power-on self-test, memory training, early device enumeration

```
  +----------+     +-----------+     +----------------+
  | Power On |---->| BIOS/UEFI |---->| POST/Discovery |
  +----------+     +-----------+     +----------------+
      01               02                 03
```

---

## Phase 2: Loading the OS (Lessons 04–07)

- [ ] **04 - The Bootloader**
      GRUB, systemd-boot, loading the kernel, choosing boot entries
- [ ] **05 - Kernel Initialization**
      Early startup, memory setup, page tables, decompression, hardware handoff
- [ ] **06 - Init Systems**
      PID 1, systemd vs older init, service dependencies, targets
- [ ] **07 - Device Drivers and Modules**
      Driver model, modules, probing, user-space device management

```
  +------------+     +----------+     +------------+     +---------+
  | Bootloader |---->| Kernel   |---->| Init/PID 1 |---->| Drivers |
  +------------+     +----------+     +------------+     +---------+
       04               05              06              07
```

---

## Phase 3: From Kernel to User Space (Lessons 08–10)

- [ ] **08 - User Space Startup**
      Shells, login managers, session startup, desktop environments
- [ ] **09 - Firmware Beyond PCs**
      Embedded bootloaders, U-Boot, phones, secure chains in non-PC devices
- [ ] **10 - Secure Boot and Trust Chains**
      TPM, measured boot, attestation, why trust at startup matters

```
  +------------+     +-------------+     +-------------+
  | User Space |---->| Non-PC Boot |---->| Secure Boot |
  +------------+     +-------------+     +-------------+
       08               09                 10
```

---

## Who This Track Is For

- Self-taught developers who want the “power button to shell prompt” story
- Systems and backend developers who work around Linux but never learned boot flow
- Security-minded engineers who want to understand trust chains at startup

## Prerequisites

You should be comfortable with:

- the idea of CPU, memory, and storage
- basic operating system concepts like processes and the kernel

Helpful but not required:

- [Computer Architecture](../computer-architecture/00-roadmap.md)
- [Operating Systems](../os-concepts/00-roadmap.md)

---

## What You Will Be Able To Explain After This Track

- what the CPU does immediately after power-on
- how firmware differs from the bootloader and from the OS kernel
- how kernel startup leads to drivers, init, and finally user space
- how boot differs across PCs, embedded systems, and modern secure devices
- why secure boot and measured boot matter for real systems security

---

## Time Estimate

```
Phase 1:  ~6 hours   (first instruction to early firmware)
Phase 2:  ~8 hours   (loading kernel and starting services)
Phase 3:  ~5 hours   (user space, embedded devices, trust chains)
          --------
Total:    ~19 hours
```

Use this track actively. Looking at real firmware settings, boot logs, and init
service graphs makes the flow much easier to remember.

---

## Recommended Reading

These books are optional — the lessons are designed to stand on their own.

- **Linux Kernel Development** by Robert Love (Addison-Wesley, 3rd Edition 2010) — Still useful for early kernel mental models
- **How Linux Works** by Brian Ward (No Starch Press, 3rd Edition 2021) — Strong practical systems view, including boot and init behavior
- **Operating Systems: Three Easy Pieces** by Remzi and Andrea Arpaci-Dusseau (2018) — Free and excellent for broader OS context

---

*Track version: 2026.05*