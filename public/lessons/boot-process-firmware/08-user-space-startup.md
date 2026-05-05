# Lesson 08: User Space Startup

> **The one thing to remember**: Reaching user space means the machine has moved
> from kernel-controlled bring-up into the environment where shells, login managers,
> services, and applications can actually begin doing useful work for users.

---

## Start With the Building Finally Opening

Early boot is like unlocking the building, checking the systems, and getting the staff in place.

User-space startup is when the building becomes ready for normal occupants and work.

That means:

- services are started
- login mechanisms become available
- shells or graphical sessions can begin
- application processes can run in the environment users recognize

---

## What User Space Means

**User space** is the part of the system where ordinary processes run outside the kernel.

This is where you find things like:

- shells
- daemons and background services
- desktop environments
- application binaries

The kernel provides the underlying machinery. User space is where most higher-level software actually lives.

---

## Shells, Login, and Sessions

On many systems, user-space startup eventually reaches a login path:

- text login on a console
- a graphical login manager
- a remote SSH session

After authentication, a shell or desktop session starts, and the user gets an interactive environment.

This is the point where most people feel like “the computer has finished booting.”

---

## Why Background Services Matter Too

User space is not only about what appears on screen.

A lot of useful system behavior depends on background services such as:

- networking helpers
- logging
- time synchronization
- display managers
- application infrastructure daemons

This is why user-space startup is both an interactive and a service-orchestration story.

---

## Why Developers Should Care

User-space startup explains:

- why a machine can boot “most of the way” yet still fail before a usable login appears
- why service failures can block normal machine use even when the kernel is healthy
- why shells, desktop environments, and daemons are late boot stages, not early firmware or kernel behavior

---

## Hands-On Exercise

Observe your own system startup path.

1. Identify whether your environment reaches a text login, desktop login, or another session mechanism.
2. Note one background service that needs to be present before the environment feels fully usable.
3. Explain why user-space startup is a separate stage from kernel initialization.

---

## Recap

- User space is where ordinary processes and interactive environments run.
- Reaching user space means the kernel and init system have already done major groundwork.
- Login paths, shells, desktop sessions, and daemons are part of late startup.
- A machine is not truly usable until this part of the process succeeds.

Next, we widen the picture beyond PCs and see how boot differs in embedded devices, phones, and other systems.