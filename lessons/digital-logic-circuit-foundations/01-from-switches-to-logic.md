# Lesson 01: From Switches to Logic

> **The one thing to remember**: Digital logic begins with a simple physical idea:
> use components that can behave like reliable switches, then interpret those two
> switch states as `0` and `1`.

---

## Start With a Faucet

Imagine a faucet that is either closed or open.

- closed: no water flows
- open: water flows

That is the intuition for a switch.

At the hardware level, computers rely on components that can control whether electrical current or voltage effectively passes in a way that other parts of the circuit can treat as one of two useful states.

---

## The Real World Is Analog, but Digital Simplifies It

Electricity is not naturally binary. Voltage can vary continuously.

So why do computers act as if there are only two states?

Because engineering gets much easier when circuits treat ranges of analog behavior as two reliable categories:

- low -> `0`
- high -> `1`

This is how messy physical reality becomes manageable digital logic.

---

## Transistors as Switches

You do not need semiconductor physics for the beginner model.

The useful intuition is:

- a transistor can act like a controllable switch
- one signal can influence whether another path is effectively open or closed

By combining many such switches, circuits can perform logic and store state.

This is one of the deepest ideas in computing:

> Tiny physical switches, arranged correctly, can implement reasoning and arithmetic.

---

## Why Two States Are So Useful

Two-state systems are easier to make reliable because small noise or variation is less likely to cause misinterpretation.

```
SIMPLIFIED DIGITAL VIEW

  low voltage   ---> treat as 0
  uncertain     ---> avoid relying on this region
  high voltage  ---> treat as 1
```

This is what lets huge circuits work without every tiny physical fluctuation becoming a disaster.

---

## Inputs, Outputs, and Decision Behavior

Once we have signals that behave like `0` and `1`, we can build components whose output depends on the inputs.

Examples of questions a circuit can answer:

- are both inputs on?
- is at least one input on?
- is the input off?

Those questions become logic gates in the next lesson.

---

## Hardware Does Not “Know” True and False

As with binary data generally, the meaning is interpretation.

The same two-state signal may mean:

- false / true
- off / on
- no current / current
- branch not taken / taken

The power of digital systems is that one physical representation can support many layers of meaning.

---

## Why Developers Should Care

This lesson explains the first bridge between physics and software:

- why computers prefer binary
- why logic starts from controllable two-state signals
- why digital abstraction is about reliable categories, not perfectly clean physics

It sets up the entire rest of the track. Once you accept that controlled switches can represent `0` and `1`, gates and arithmetic become much less magical.

---

## Common Misunderstandings

### “Electricity itself is binary”

No. Digital systems impose a binary interpretation on analog electrical behavior.

### “A transistor is already a logic gate”

Not by itself in the conceptual sense we care about. Gates are built from switch behavior arranged in useful patterns.

### “This is too low level to matter for software” 

No. It explains why the whole stack below software can compute anything at all.

---

## Hands-On Exercise

Draw a table with one column for an input signal and one for whether a switch-controlled lamp would be on or off.

1. Mark input low and high.
2. Mark the corresponding output behavior.
3. Explain how that simple switch behavior could be interpreted as `0` and `1`.
4. If you want, use a basic online logic simulator and toggle a virtual switch connected to a light.

---

## Recap

- Digital systems begin by treating physical signals as reliable two-state values.
- Transistors can be understood as controllable switches for this level of explanation.
- Binary works well because two states are easier to distinguish reliably than many states.
- The same two-state signals can later represent logic, numbers, and control.

Next, we make those signals useful by combining them into logic gates.