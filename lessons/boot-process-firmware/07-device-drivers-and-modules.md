# Lesson 07: Device Drivers and Modules

> **The one thing to remember**: Hardware does not become usable just because
> the kernel exists. Drivers are the software components that know how to talk to specific classes of hardware, and modules let some of that support be loaded flexibly.

---

## Start With Translators

Imagine a large international conference.

You have one central organizer, but many attendees speak different technical languages.
To make everyone useful, you need translators.

Drivers play that role between the operating system and hardware devices.

---

## What a Driver Does

At a high level, a driver provides the logic needed for the OS to:

- recognize a device
- configure it
- exchange data with it
- present it through the OS's abstractions

The OS wants a coherent system view. Devices each have their own low-level behaviors. Drivers bridge the gap.

---

## Probing and Detection

During startup, the system often needs to determine:

- what devices exist
- which drivers match them
- what resources those devices use

This is part of **probing** and hardware discovery on the operating-system side.

Firmware did early discovery. The kernel and drivers take this much further.

---

## Kernel Modules

Not all driver support must be built permanently into one monolithic binary.

Many systems support **kernel modules**, which are pieces of kernel-level functionality that can be loaded when needed.

This helps with:

- hardware variation across machines
- reducing permanently loaded code
- updating some support paths more flexibly

The exact mechanisms vary, but the main idea is modularity in low-level support.

---

## User-Space Device Management

Modern systems often involve user-space tools too, not only kernel code.

For example, user-space mechanisms may:

- react to device arrival
- create device nodes or update metadata
- trigger additional configuration steps

This means “driver startup” can be partly kernel-side and partly coordinated with user-space management tools.

---

## Why Developers Should Care

Drivers and modules explain:

- why a machine can boot but still lack working networking, display, or storage support
- why hardware compatibility depends on software support, not only physical presence
- why kernel logs and device-management tools matter during system bring-up

This is the point where the OS becomes a practical hardware-using system, not just an initialized kernel image.

---

## Hands-On Exercise

Inspect device information on your system.

1. Find one hardware device and identify the driver or subsystem associated with it if possible.
2. Look for one kernel log line or system report showing device initialization.
3. Explain how firmware discovery and driver initialization are different stages of the startup story.

---

## Recap

- Drivers let the OS communicate with real hardware devices.
- Probing and matching help determine which support path applies to each device.
- Kernel modules allow some low-level support to be loaded flexibly.
- Device readiness depends on both kernel and often user-space management steps.

Next, we follow the boot path beyond device readiness into the environment most developers actually interact with: user space.