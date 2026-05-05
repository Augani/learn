# Lesson 02: Interrupts

> **The one thing to remember**: Interrupts let hardware get the CPU's attention
> without the CPU constantly checking every device in a wasteful loop.

---

## Start With a Doorbell

Imagine waiting for a package.

One terrible strategy is to open the front door every second just to check whether the courier arrived.

A much better strategy is for the courier to ring the doorbell when needed.

That is the intuition behind interrupts.

---

## Why Polling Alone Is Wasteful

Without interrupts, the CPU might have to **poll** devices:

- ask keyboard: anything happened?
- ask disk: done yet?
- ask network card: packet ready?

Doing that continuously wastes time.

Interrupts let devices signal the CPU only when attention is needed.

---

## What an Interrupt Is

An interrupt is a hardware or system signal that causes the CPU to pause its normal current flow and handle an event.

Examples:

- keyboard input arrived
- timer tick occurred
- disk I/O completed
- network packet arrived

The CPU is not permanently abandoning its current work. It is being told, “There is something important to handle now.”

---

## IRQs and Handlers

You will often hear terms like:

- **IRQ**: interrupt request
- **interrupt handler**: code that runs in response

The beginner mental model is:

1. device raises an interrupt request
2. system routes that request appropriately
3. CPU runs a handler
4. normal work eventually resumes

This is one of the core bridges between hardware events and software response.

---

## Top Half and Bottom Half Intuition

In some operating-system designs, interrupt handling is split conceptually into:

- a very quick immediate response
- later deferred work

You do not need deep kernel internals here. The useful intuition is:

> The system often wants the urgent interrupt acknowledgment to happen fast, while heavier follow-up work can happen later.

That keeps the machine responsive and avoids spending too long in the most sensitive interrupt context.

---

## Why Developers Should Care

Interrupts explain:

- why devices can react efficiently without constant polling
- why input, timers, storage completion, and networking integrate into the OS the way they do
- why latency and interrupt storms can become performance concerns

This is the doorbell model of hardware communication.

---

## Hands-On Exercise

Choose one hardware event, such as a key press or packet arrival.

1. Write the polling version of the story.
2. Write the interrupt-driven version of the story.
3. Compare which wastes more CPU time.
4. Explain why fast interrupt handling and deferred work might both be useful.

---

## Recap

- Interrupts let devices signal the CPU when attention is needed.
- They are more efficient than constant polling for many hardware events.
- IRQs trigger handlers that connect device events to OS behavior.
- Good interrupt handling balances responsiveness and overhead.

Next, we look at how devices move a lot of data without forcing the CPU to copy everything one small piece at a time: DMA.