# Lesson 13 — Computability

> What computers CANNOT do. Not because of speed or memory,
> but because of fundamental mathematical impossibility.
> Some problems have NO algorithm. Period.

## The Turing Machine

Alan Turing (1936) defined the simplest possible model of computation
that captures everything a computer can do.

```
+-----------------------------------------------+
|  ...  | B | 1 | 0 | 1 | 1 | B | B |  ...     |  <-- infinite tape
+-----------------------------------------------+
                    ^
                    |
              +-----+-----+
              |   STATE    |
              |   q3       |  <-- finite control
              +-----+-----+
                    |
            read/write head

Components:
  - Infinite tape divided into cells (each holds a symbol)
  - Read/write head (positioned on one cell)
  - Finite set of states
  - Transition function: (state, symbol) -> (new_state, write_symbol, move L/R)
```

### Example: Binary Increment

```
Input: "1011" on tape
Output: "1100"

States: q0 (scan right to end), q1 (add 1, carry), q_halt

q0: scan right until blank
  (q0, 0) -> (q0, 0, R)
  (q0, 1) -> (q0, 1, R)
  (q0, B) -> (q1, B, L)    found end, go back

q1: add with carry
  (q1, 1) -> (q1, 0, L)    1+1 = 0, carry
  (q1, 0) -> (q_halt, 1, L)  0+1 = 1, done
  (q1, B) -> (q_halt, 1, L)  leading carry

Trace on "1011":
  q0: [1] 0 1 1 B -> 1 [0] 1 1 B -> 1 0 [1] 1 B -> 1 0 1 [1] B -> 1 0 1 1 [B]
  q1: 1 0 1 [1] B -> 1 0 1 [0] B   (1->0, carry)
  q1: 1 0 [1] 0 B -> 1 0 [0] 0 B   (1->0, carry)
  q1: 1 [0] 0 0 B -> 1 [1] 0 0 B   (0->1, stop)
  Result: 1100
```

## The Church-Turing Thesis

> Any function that can be computed by ANY mechanical process
> can be computed by a Turing machine.

This is a THESIS, not a theorem — it can't be proved. But every model of
computation ever invented (lambda calculus, register machines, Python, etc.)
has been shown equivalent to Turing machines.

```
Turing Machine = Lambda Calculus = Python = C = JavaScript = ...

All compute the same class of functions.
Your language choice doesn't change what's computable.
```

## The Halting Problem

**Does a given program halt on a given input, or loop forever?**

```python
def obvious_halt(n):
    return n + 1

def obvious_loop():
    while True:
        pass

def tricky(n):
    while n != 1:
        if n % 2 == 0:
            n = n // 2
        else:
            n = 3 * n + 1
```

That third one is the Collatz conjecture. Nobody knows if it halts for all n.

### Proof That the Halting Problem Is Undecidable

```
Theorem: No program can decide, for ALL programs P and inputs I,
         whether P(I) halts.

Proof (by contradiction):
  Assume H(P, I) exists, where:
    H(P, I) = "halts"  if P(I) terminates
    H(P, I) = "loops"  if P(I) runs forever

  Construct a diabolical program D:

    def D(P):
        if H(P, P) == "halts":
            loop forever
        else:
            halt

  Now ask: Does D(D) halt?

  Case 1: D(D) halts.
    Then H(D, D) = "halts"
    But D's code says: if "halts" then loop forever
    Contradiction!

  Case 2: D(D) loops.
    Then H(D, D) = "loops"
    But D's code says: if "loops" then halt
    Contradiction!

  Both cases lead to contradiction.
  Therefore H cannot exist.  QED
```

```
The paradox visualized:

  D(D) halts?
       |
  +----+----+
  |         |
 YES       NO
  |         |
  D says    D says
  LOOP      HALT
  |         |
  BOOM!     BOOM!
```

This is deeply related to the liar's paradox: "This statement is false."

## Decidable vs Recognizable

```
DECIDABLE (Recursive):
  There exists a TM that always halts and correctly
  answers YES or NO.

  Example: "Is this string a valid Python expression?"

RECOGNIZABLE (Recursively Enumerable):
  There exists a TM that halts and says YES for strings in the language,
  but might loop forever for strings NOT in the language.

  Example: "Does this program ever print 'hello'?"
  (Run it and watch. If it prints hello, say YES.
   But if it never does... you wait forever.)

UNRECOGNIZABLE:
  No TM can even recognize it.

  Example: The complement of the halting problem.
  "Does this program loop forever?" is NOT recognizable.
```

```
+--------------------------------------------------+
|                                                  |
|  ALL LANGUAGES                                   |
|  +--------------------------------------------+  |
|  |  RECOGNIZABLE                              |  |
|  |  +--------------------------------------+  |  |
|  |  |  DECIDABLE                           |  |  |
|  |  |                                      |  |  |
|  |  |  "Is n prime?"                       |  |  |
|  |  |  "Is this a valid regex?"            |  |  |
|  |  |  "Does this DFA accept string s?"    |  |  |
|  |  +--------------------------------------+  |  |
|  |                                            |  |
|  |  "Does program P halt on input I?"         |  |
|  |  (Halting problem - recognizable, not      |  |
|  |   decidable)                               |  |
|  +--------------------------------------------+  |
|                                                  |
|  "Does program P loop forever on input I?"       |
|  (Not even recognizable!)                        |
+--------------------------------------------------+
```

## Reductions

To prove problem B is undecidable, reduce the halting problem to B.

```
If we could solve B, we could solve Halting.
But we CAN'T solve Halting.
Therefore we CAN'T solve B.
```

### Example: The Totality Problem

"Does program P halt on ALL inputs?"

```
Reduction from Halting:
  Given (P, I), construct P':
    P'(x) = P(I)    (ignores x, just runs P on I)

  P halts on I  <=>  P' halts on ALL inputs
                     (because P' does the same thing regardless of input)

  If we could decide Totality, we could decide Halting.
  Therefore Totality is undecidable.  QED
```

## Other Undecidable Problems

```
+---------------------------------------+-------------------+
| Problem                               | Status            |
+---------------------------------------+-------------------+
| Does this program halt?               | Undecidable       |
| Are these two programs equivalent?    | Undecidable       |
| Does this program ever output "yes"?  | Undecidable       |
| Is this Diophantine equation solvable?| Undecidable       |
| Does this grammar generate all strings| Undecidable       |
| Does this regex match all strings?    | DECIDABLE!        |
| Is this number prime?                 | DECIDABLE          |
+---------------------------------------+-------------------+
```

Rice's Theorem: ANY non-trivial semantic property of programs is undecidable.

```
"Does this program compute a constant function?"  Undecidable.
"Does this program ever use more than 1GB of memory?"  Undecidable.
"Does this program have a bug?"  Undecidable (in general).
```

## Practical Implications

```
1. No perfect virus scanner exists.
   (Detecting malicious behavior is undecidable.)

2. No perfect compiler optimizer exists.
   (Determining if code is dead is undecidable.)

3. No perfect static analyzer exists.
   (All useful program properties are undecidable — Rice's theorem.)

4. Type systems are intentionally limited.
   (They reject some valid programs to remain decidable.)
```

## Python: Simulating a Turing Machine

```python
class TuringMachine:
    def __init__(self, transitions, start, accept, reject, blank='B'):
        self.transitions = transitions
        self.start = start
        self.accept = accept
        self.reject = reject
        self.blank = blank

    def run(self, tape_input, max_steps=10000):
        tape = dict(enumerate(tape_input))
        head = 0
        state = self.start
        steps = 0

        while steps < max_steps:
            symbol = tape.get(head, self.blank)
            if state == self.accept:
                return True, steps
            if state == self.reject:
                return False, steps

            key = (state, symbol)
            if key not in self.transitions:
                return False, steps

            new_state, write, direction = self.transitions[key]
            tape[head] = write
            head += 1 if direction == 'R' else -1
            state = new_state
            steps += 1

        return None, steps
```

## Exercises

1. Trace the binary increment Turing machine on input "111".

2. Explain in your own words why D(D) creates a contradiction in the halting proof.

3. Prove that "Does program P accept the empty string?" is undecidable
   using a reduction from the halting problem.

4. Give an example of a problem that is recognizable but not decidable.
   Explain why it fits this category.

5. **Python challenge:** Implement a Turing machine that accepts the language
   { 0^n 1^n | n >= 1 } (which we showed is not regular in Lesson 12).

6. Why can't we just "run the program and see if it halts"?
   What specifically goes wrong with this approach?

---

[Next: Lesson 14 — Complexity Theory](14-complexity-theory.md)
