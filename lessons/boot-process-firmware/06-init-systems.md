# Lesson 06: Init Systems

> **The one thing to remember**: Once the kernel is ready enough, it starts the
> first user-space process. That process becomes PID 1 and is responsible for bringing the rest of the system up.

---

## Start With the First Worker on the Floor

Imagine opening a large factory.

Before normal work begins, one coordinator arrives first and starts everything else in the right order:

- power systems
- safety checks
- teams
- dependencies

In user space, that first coordinator is the init system.

---

## Why PID 1 Matters

The first user-space process gets process ID 1, often called **PID 1**.

That process has a special role because:

- other services may be launched from it directly or indirectly
- it is responsible for key startup orchestration
- it often handles important process-management responsibilities

PID 1 is not just “the first app.” It is the organizer of user-space startup.

---

## Older init vs systemd

Historically, Unix-like systems often used simpler init models with scripts and runlevels.

Modern Linux systems commonly use **systemd**, which provides:

- service definitions
- dependency management
- targets and startup units
- richer orchestration and supervision behavior

You do not need to memorize all systemd features. The important shift is from simpler sequential startup scripts toward more structured dependency-driven service management.

---

## Why Dependency Ordering Matters

System startup is not just “run everything.”

Some services depend on others.

Examples:

- networked services may need networking first
- login services may need authentication infrastructure
- application daemons may need storage mounted

An init system coordinates this startup graph.

---

## Why Developers Should Care

Init systems explain:

- why services have startup dependencies
- why a machine can boot the kernel successfully but still fail to reach a usable user-space state
- why service management tools are deeply tied to startup behavior
- why PID 1 is special in containers and full operating systems alike

---

## Hands-On Exercise

Inspect one service manager on your system.

1. Identify PID 1 if your environment allows it.
2. Find one service and one dependency or startup target.
3. Explain how the init system is different from the kernel and from ordinary applications.

---

## Recap

- The kernel starts the first user-space process, PID 1.
- The init system coordinates startup of the rest of user space.
- Modern systems often use dependency-aware service management such as systemd.
- A successful boot depends on service orchestration after the kernel is already running.

Next, we look at how the system begins to work with actual hardware devices through drivers and modules.