# Lesson 01: Power On — What Happens First

> **The one thing to remember**: A computer does not “wake up knowing everything.”
> After power becomes stable, the CPU begins from a predefined starting point,
> and firmware takes over the job of bringing the machine into a usable state.

---

## Start With a Reset, Not a Resume

If a machine is fully powered off, there is no active running program waiting to continue.

That means boot has to begin from a carefully designed reset path:

- power becomes stable enough
- hardware reset conditions are satisfied
- the CPU starts from a known initial location

This is the first great lesson of booting:

> The machine begins in a tiny, controlled, almost blank state.

---

## Power-Good and Reset Intuition

A real machine cannot start executing code the instant electricity begins flowing.

Power supplies need to stabilize. Components need to see that the voltage is acceptable.

One high-level signal often involved in this story is the idea of **power good**:

- the hardware decides power is stable enough
- reset can be released
- the CPU may begin its startup sequence

You do not need circuit details. The useful point is that startup requires electrical readiness before software-like behavior can begin.

---

## The Reset Vector

When reset is released, the CPU does not choose an instruction address randomly.

It begins from a predefined starting location often called the **reset vector**.

This is the CPU's “start here” rule.

That first instruction usually points into firmware code stored in non-volatile memory.

```
POWER-ON STARTUP STORY

  stable power
      -> reset released
      -> CPU starts at reset vector
      -> firmware code begins running
```

This is the bridge from raw hardware into system startup logic.

---

## Why Firmware Exists

The machine at power-on is not ready for your operating system yet.

Early startup code needs to:

- perform low-level initialization
- check basic hardware condition
- prepare memory and devices enough for the next stage
- find and start a boot path

This is why systems include **firmware**: low-level code stored on the machine that runs before the OS.

Firmware is closer to the hardware than the operating system is.

---

## Non-Volatile Storage Matters Here

If RAM is empty or undefined at power-on, where does the first code come from?

It must come from storage that persists without power, such as firmware flash memory or an equivalent non-volatile medium.

This is why the early boot path depends on a persistent low-level code source built into the platform.

---

## The System Is Still Very Primitive

At this point in the story, the system is not “a computer running apps.”

It is much closer to:

- CPU can start at a known location
- firmware can run limited initialization code
- hardware still needs setup and discovery

That is why the early boot environment feels so different from normal application development.

---

## Why Developers Should Care

This lesson explains:

- why boot starts from firmware rather than directly from the OS
- why the first instruction must come from a known built-in location
- why power stability and reset behavior matter before software startup

It also sets the tone for the whole track: startup is a chain of dependencies, not one magical leap.

---

## Common Misunderstandings

### “When power turns on, the OS just starts”

No. Firmware and earlier initialization stages come first.

### “The CPU begins from whatever code is on disk”

No. The CPU begins from a predefined hardware start point, not from the filesystem.

### “Startup is purely a software problem” 

No. Electrical stability, reset behavior, firmware storage, and hardware readiness all matter.

---

## Hands-On Exercise

Draw a five-step boot chain for the first instant of startup.

1. stable power
2. reset release
3. reset vector
4. firmware entry
5. next-stage initialization

Then write one sentence explaining why the OS cannot be the first code executed.

---

## Recap

- A powered-off machine must start from a controlled reset sequence.
- Power must stabilize before meaningful startup begins.
- The CPU begins at a predefined reset vector.
- Firmware is the first substantial code that runs.
- Early boot is the transition from raw hardware conditions into system initialization.

Next, we compare the two major firmware models most developers hear about: BIOS and UEFI.