# Lesson 04: The Bootloader

> **The one thing to remember**: The bootloader is the stage that bridges firmware
> and the operating system kernel. Its job is to locate the kernel, prepare the handoff, and start it correctly.

---

## Start With a Stage Manager

Imagine a theater production.

The building opens, the lights work, the seats exist, and the stage is ready.
But someone still needs to bring the right script, place the actors, and start the show.

That is the bootloader's role in the startup sequence.

Firmware gets the system far enough to continue. The bootloader prepares and starts the OS kernel.

---

## Why a Separate Bootloader Exists

You might wonder: why does firmware not just load the operating system directly in all cases?

A separate bootloader helps with practical tasks like:

- choosing which OS or kernel entry to start
- locating kernel images and related files
- passing startup parameters
- supporting recovery or special boot modes

It acts as a configurable handoff layer between firmware and kernel.

---

## Examples: GRUB and systemd-boot

Two names you will often hear are:

- **GRUB**
- **systemd-boot**

You do not need every implementation detail. The useful point is that bootloaders vary in complexity and features, but they serve the same broad purpose: finding and launching the kernel correctly.

---

## What the Bootloader Usually Needs to Do

At a high level, the bootloader may:

- read boot configuration
- locate the kernel image
- load an initramfs or similar early userspace support if needed
- pass command-line parameters or platform information
- transfer control to the kernel entry point

This is a much richer handoff than “jump to OS.”

---

## Why Multi-Boot and Recovery Live Here

The bootloader is often where systems support choices such as:

- boot normal kernel
- boot older kernel
- boot recovery mode
- boot another operating system

That makes it a visible and important part of real machine administration.

---

## Why Developers Should Care

Bootloaders explain:

- why kernel parameters exist
- why multi-boot systems need explicit startup configuration
- why boot failures can happen after firmware but before the kernel fully starts
- why distro installation and system recovery often involve bootloader tooling

---

## Hands-On Exercise

Inspect your system's boot configuration if accessible.

1. Identify the bootloader in use if possible.
2. Find one kernel boot entry or kernel command line.
3. Write a short note explaining what the bootloader contributes that firmware alone would not handle conveniently.

---

## Recap

- The bootloader bridges firmware and the OS kernel.
- It locates the kernel, prepares parameters, and starts execution.
- It often handles boot menus, recovery, and multi-boot choices.
- Boot problems can occur specifically at this handoff stage.

Next, we follow the handoff into the kernel itself.