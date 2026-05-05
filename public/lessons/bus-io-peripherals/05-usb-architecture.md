# Lesson 05: USB Architecture

> **The one thing to remember**: USB is a general-purpose device architecture built
> around a host-managed model. It supports many kinds of peripherals by standardizing how devices describe themselves and communicate.

---

## Start With a Universal Docking Standard

Imagine a building with a standardized docking station for many device types:

- keyboard
- mouse
- camera
- microphone
- storage stick

The devices are different, but the connection model is standardized enough that the system can recognize and work with them through one broad architecture.

That is the big idea behind USB.

---

## Host-Centric Model

USB is strongly **host-controlled**.

That means the host system, through a controller, manages communication and enumeration rather than every device acting as a full equal peer.

This is one reason USB feels different from some other interconnects.

The host organizes the conversation.

---

## Descriptors and Enumeration

When a USB device is connected, the system needs to learn what it is.

Devices provide structured information often described through **descriptors**.

That helps the host understand things like:

- device identity
- capabilities
- interface type
- class information

This discovery process is called **enumeration**.

That is how the machine learns, “This is a keyboard,” or “This is mass storage,” rather than treating the device as a mystery blob.

---

## Endpoints and Classes

At a conceptual level, USB devices expose communication endpoints and may belong to standardized device classes.

Why that matters:

- standardized classes let many devices work with generic system support
- specialized devices may still need more specific software support

This balance is one reason USB can support both plug-and-play convenience and more advanced device behavior.

---

## Why Developers Should Care

USB architecture explains:

- why connecting a device triggers discovery and configuration activity
- why many common device types work automatically without custom drivers in everyday cases
- why device classes and descriptors matter to the OS

It is the everyday external-device story behind the ports most users touch constantly.

---

## Hands-On Exercise

Connect or inspect one USB device.

1. Identify its device type or class if your OS exposes that information.
2. Note one way the system figures out what kind of device it is.
3. Explain why standardized descriptors make plug-and-play behavior possible.

---

## Recap

- USB is a host-managed architecture for many kinds of external devices.
- Devices are discovered through enumeration.
- Descriptors and classes help the system understand what a device is and how to communicate with it.
- USB's structured standardization is what makes so many peripherals easy to use.

Next, we compare two major storage-interface worlds: SATA and NVMe.