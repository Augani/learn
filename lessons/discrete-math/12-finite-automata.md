# Lesson 12 — Finite Automata

> **Analogy:** A vending machine. It has states (idle, coin inserted, item selected),
> inputs (insert coin, press button), and transitions. It accepts certain sequences
> of inputs and rejects others. That's a finite automaton.

## What Is a Finite Automaton?

A machine with a fixed number of states that reads input one symbol at a time
and either accepts or rejects the input string.

```
Vending machine:
                    coin                 button
  +--------+  ------------->  +----------+  ---------->  +----------+
  |  IDLE  |                  | HAS_COIN |               | DISPENSE |
  | (start)|  <-------------  |          |               | (accept) |
  +--------+     refund       +----------+               +----------+
```

## Deterministic Finite Automaton (DFA)

A DFA is a 5-tuple (Q, Sigma, delta, q0, F):

```
Q     = finite set of states
Sigma = input alphabet (finite set of symbols)
delta = transition function: Q x Sigma -> Q
q0    = start state (in Q)
F     = set of accept states (subset of Q)
```

### Example: Strings ending in "01"

```
Alphabet: {0, 1}
Accept strings that end with "01"

States: q0 (start), q1 (seen 0), q2 (seen 01, accept)

           0          1
  +----+ -----> +----+ -----> +====+
  | q0 |        | q1 |        | q2 |
  +----+ <----- +----+ <----- +====+
     ^     1       ^     0       |
     |             +------0------+
     +----------1-----------------+

Transition table:
         |  0   |  1
  -------+------+------
    q0   |  q1  |  q0
    q1   |  q1  |  q2
   *q2   |  q1  |  q0

  (* marks accept state)
```

Test string "1001":
```
State: q0 -> read '1' -> q0
       q0 -> read '0' -> q1
       q1 -> read '0' -> q1
       q1 -> read '1' -> q2  (accept state!)  ACCEPTED
```

### Python DFA Simulator

```python
class DFA:
    def __init__(self, states, alphabet, transitions, start, accept):
        self.states = states
        self.alphabet = alphabet
        self.transitions = transitions
        self.start = start
        self.accept = accept

    def run(self, input_string):
        current = self.start
        for symbol in input_string:
            if symbol not in self.alphabet:
                return False
            current = self.transitions[(current, symbol)]
        return current in self.accept

ends_with_01 = DFA(
    states={'q0', 'q1', 'q2'},
    alphabet={'0', '1'},
    transitions={
        ('q0', '0'): 'q1', ('q0', '1'): 'q0',
        ('q1', '0'): 'q1', ('q1', '1'): 'q2',
        ('q2', '0'): 'q1', ('q2', '1'): 'q0',
    },
    start='q0',
    accept={'q2'}
)

for s in ['01', '1001', '10', '0011', '']:
    print(f"'{s}': {'Accept' if ends_with_01.run(s) else 'Reject'}")
```

## Nondeterministic Finite Automaton (NFA)

An NFA can be in MULTIPLE states simultaneously. It accepts if ANY path leads
to an accept state.

Key differences from DFA:

```
DFA:  delta: Q x Sigma -> Q           (exactly one next state)
NFA:  delta: Q x Sigma -> P(Q)        (set of possible next states)
      Also allows epsilon-transitions  (move without reading input)
```

### Example: Strings containing "01"

```
           0,1         0           1
  +----+ -------> +----+ ------> +====+ ------->
  | q0 |          | q0 |         | q1 |  | q2 |
  +----+          +----+         +----+  +====+
                                           0,1
                                          (self-loop)

Wait, let me draw this more clearly:

           0           1         0,1
  +----+ -----> +----+ -----> +====+
  | q0 |        | q1 |        ||q2||  (accept, with self-loop)
  +----+        +----+        +====+
    |  ^                        ^ |
    +--+ 0,1                    +-+ 0,1

Actually, NFA for "contains 01":

  State q0: on 0, go to {q0, q1}   on 1, go to {q0}
  State q1: on 1, go to {q2}       on 0, go to {}
  State q2: on 0, go to {q2}       on 1, go to {q2}

  q0 --0--> q0, q1
  q0 --1--> q0
  q1 --1--> q2
  q2 --0,1--> q2
```

The NFA "guesses" where the "01" substring starts.

## NFA to DFA Conversion (Subset Construction)

Every NFA can be converted to an equivalent DFA. The DFA states are SETS of NFA states.

```
NFA for "contains 01":

DFA states = subsets of {q0, q1, q2}:

Start: {q0}

{q0} --0--> {q0, q1}    {q0} --1--> {q0}
{q0, q1} --0--> {q0, q1}  {q0, q1} --1--> {q0, q2}
{q0, q2} --0--> {q0, q1, q2}  {q0, q2} --1--> {q0, q2}
{q0, q1, q2} --0--> {q0, q1, q2}  {q0, q1, q2} --1--> {q0, q2}

Accept states: any containing q2 = {q0,q2}, {q0,q1,q2}
```

**Key theorem:** NFAs and DFAs accept exactly the same class of languages.
But NFA->DFA conversion can exponentially blow up the number of states.

## Regular Expressions — Formally

Regular expressions define the same languages as finite automata.

```
Base cases:
  a       matches the single character a
  empty   matches the empty string
  null    matches nothing

Operations:
  R1 R2     concatenation (R1 followed by R2)
  R1 | R2   union (R1 or R2)
  R*        Kleene star (zero or more repetitions of R)
```

```
Regex            Language                  Automaton
-----            --------                  ---------
0*               {empty, 0, 00, 000, ...} Loop on 0
(0|1)*01         strings ending in 01      Our DFA above
(0|1)*01(0|1)*   strings containing 01     Our NFA above
```

### Regex to NFA (Thompson's Construction)

```
For 'a':           For R1|R2:          For R*:
                     +-->[R1]-->+        +-->[R]--+
 -->[q0]--a-->[q1]   |         |        |    |    |
                   -->[        ]-->    -->[   v   ]-->
                     |         |        | +--<---+|
                     +-->[R2]-->+        +---------+
```

## What Finite Automata CANNOT Do

Regular languages have limitations. No finite automaton can recognize:

```
{ 0^n 1^n | n >= 0 }    "equal 0s then 1s"    (needs counting)
{ ww | w in {0,1}* }    "repeated string"       (needs memory)
Balanced parentheses     "((()))" vs "(()"      (needs stack)
```

**Pumping Lemma for Regular Languages:**

If L is regular, there exists p such that any string s in L with |s| >= p
can be split as s = xyz where:
1. |y| > 0
2. |xy| <= p
3. xy^i z is in L for all i >= 0

If you can show no such split works, L is NOT regular.

```
Prove { 0^n 1^n } is not regular:

  Take s = 0^p 1^p (length 2p >= p).
  For any split xyz with |xy| <= p:
    y = 0^k for some k > 0 (y is all 0s since |xy| <= p)
  Pump: xy^2z = 0^(p+k) 1^p
  p + k != p, so this is NOT in the language.
  Contradiction with pumping lemma. Not regular.  QED
```

## DFA Minimization

Two states are equivalent if they produce the same accept/reject for all inputs.
Merge equivalent states.

```
Before:                    After:
  q0 --a--> q1             q0 --a--> q1
  q0 --b--> q2             q0 --b--> q1  (q1 and q2 merged)
  q1 --a--> q3             q1 --a--> q2
  q2 --a--> q3             q2 (accept)
  q1 --b--> q1
  q2 --b--> q2
```

## Exercises

1. Design a DFA over {0, 1} that accepts strings with an even number of 1s.

2. Design an NFA for strings over {a, b} that end with "aba".

3. Convert your NFA from exercise 2 to a DFA using subset construction.

4. Use the pumping lemma to prove that { 0^n^2 | n >= 0 } (strings of 0s
   whose length is a perfect square) is not regular.

5. **Python challenge:** Extend the DFA class to support NFA simulation
   by tracking a SET of current states.

6. Write a regular expression for: binary strings where every '0' is
   immediately followed by at least one '1'.

---

[Next: Lesson 13 — Computability](13-computability.md)
