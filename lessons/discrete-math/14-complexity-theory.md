# Lesson 14 — Complexity Theory

> Not "can we solve it?" but "how FAST can we solve it?"
> Some problems are solvable in principle but would take longer than
> the age of the universe. Complexity theory maps the landscape.

## Time Complexity Classes

```
+------------------------------------------------------------+
| Class    | Informal                  | Example              |
+----------+---------------------------+----------------------+
| O(1)     | Constant                  | Array index lookup   |
| O(log n) | Logarithmic               | Binary search        |
| O(n)     | Linear                    | Linear search        |
| O(n lg n)| Linearithmic              | Merge sort           |
| O(n^2)   | Quadratic                 | Bubble sort          |
| O(n^k)   | Polynomial (tractable)    | Matrix multiply      |
| O(2^n)   | Exponential (intractable) | Brute force SAT      |
| O(n!)    | Factorial                 | Brute force TSP      |
+----------+---------------------------+----------------------+

The wall between "doable" and "not doable" in practice:

  O(n^3)         barely feasible for large n
  -------------- THE WALL ----------------
  O(2^n)         forget it for n > 50
```

## P: Polynomial Time

A problem is in P if there exists an algorithm solving it in O(n^k) time
for some constant k.

```
P = problems we can solve EFFICIENTLY

Examples:
  - Sorting                        O(n log n)
  - Shortest path (Dijkstra)       O(V^2) or O(E + V log V)
  - Primality testing (AKS)        O(n^6) where n = number of digits
  - Maximum matching in graphs     O(V^3)
  - Linear programming             Polynomial
  - 2-SAT                          O(V + E)
```

## NP: Nondeterministic Polynomial Time

A problem is in NP if a proposed solution can be VERIFIED in polynomial time.

```
NP = problems where we can CHECK answers quickly

Think of it as:
  SOLVING might be hard.
  CHECKING a given solution is easy.
```

### Example: Sudoku

```
Solving a 9x9 Sudoku: might require backtracking (exponential?)

Verifying a filled grid:
  - Check each row has 1-9:     O(n^2)
  - Check each column has 1-9:  O(n^2)
  - Check each box has 1-9:     O(n^2)
  Total verification: O(n^2)    Polynomial!

So Sudoku (generalized) is in NP.
```

### Formal Definition

```
NP = { L | there exists a polynomial-time verifier V such that:
  x in L  <=>  there exists certificate c with |c| <= poly(|x|)
               and V(x, c) accepts }

The "certificate" is the proposed solution.
The "verifier" checks if it's correct.
```

## P vs NP

```
Is P = NP?

                +------------------------------+
                |            NP                |
                |   +--------------------+     |
                |   |        P           |     |
                |   |                    |     |
                |   |  Sorting           |     |
                |   |  Shortest path     |     |
                |   |  Primality         |     |
                |   +--------------------+     |
                |                              |
                |  Factoring? Graph iso?        |
                |  (NP but maybe not NP-complete)|
                |                              |
                |  +-----------------------+   |
                |  |    NP-COMPLETE        |   |
                |  |  SAT, TSP, Clique,    |   |
                |  |  Vertex Cover, ...    |   |
                |  +-----------------------+   |
                +------------------------------+

If P = NP:  The inner circle expands to fill everything.
            Every NP problem has an efficient solution.
            Cryptography breaks. Optimization becomes easy.

If P != NP: Some problems are fundamentally harder to solve than to verify.
            (This is what everyone believes, but nobody can prove.)
```

The P vs NP question is one of the Clay Millennium Prize Problems ($1M reward).

## NP-Complete: The Hardest Problems in NP

A problem is NP-complete if:
1. It's in NP (solutions can be verified quickly)
2. Every other NP problem can be reduced to it in polynomial time

```
If you solve ANY NP-complete problem efficiently, you solve ALL of NP.
They are the "hardest" problems in NP.
```

## Reductions

A reduction transforms one problem into another:

```
Problem A reduces to Problem B (A <=p B):
  There exists a polynomial-time function f such that:
  x in A  <=>  f(x) in B

Meaning: B is AT LEAST as hard as A.
If you can solve B, you can solve A (by transforming first).
```

```
  "I don't know how to solve Problem A..."
                    |
                    v
  "But if I could solve Problem B,
   I could transform my A instances into B instances
   and use B's solver!"
                    |
                    v
  "Therefore B is at least as hard as A."
```

## The Cook-Levin Theorem

SAT (Boolean Satisfiability) was the first problem proved NP-complete.

```
SAT: Given a boolean formula, is there an assignment of variables
     that makes it TRUE?

(x1 OR x2) AND (NOT x1 OR x3) AND (NOT x2 OR NOT x3)

Try x1=T, x2=F, x3=T:
  (T OR F) AND (F OR T) AND (T OR F) = T AND T AND T = T
  SATISFIABLE!
```

Cook (1971) proved: every NP problem can be reduced to SAT.
Once you have one NP-complete problem, you can prove others by reduction.

## The NP-Complete Zoo

```
SAT
 |
 +--> 3-SAT (each clause has exactly 3 literals)
       |
       +--> CLIQUE (is there a complete subgraph of size k?)
       |     |
       |     +--> VERTEX COVER (can you cover all edges with k vertices?)
       |     |
       |     +--> INDEPENDENT SET (k vertices with no edges between them?)
       |
       +--> 3-COLORING (can graph be colored with 3 colors?)
       |
       +--> HAMILTONIAN CYCLE (visit every vertex exactly once?)
       |     |
       |     +--> TSP (Traveling Salesperson: shortest route visiting all cities?)
       |
       +--> SUBSET SUM (subset adding to target?)
             |
             +--> KNAPSACK (maximize value within weight limit?)
             |
             +--> PARTITION (split into two equal-sum subsets?)
```

## Classic NP-Complete Problems

### Traveling Salesperson (TSP)

```
Visit all cities exactly once and return home.
Minimize total distance.

  A ---3--- B
  |  \      |
  5    7    4
  |      \  |
  C ---2--- D

Brute force: try all (n-1)!/2 routes. For 20 cities: ~10^17 routes.
```

### Subset Sum

```
Given set S = {3, 7, 1, 8, 4} and target T = 12.
Is there a subset summing to T?

Answer: {3, 1, 8} = 12.  YES.

For n items: 2^n possible subsets to check.
```

### Graph Coloring

```
Given graph G and number k, can G be colored with k colors
such that no two adjacent vertices share a color?

  2 colors: polynomial (check if bipartite)
  3 colors: NP-complete!
  k colors (k >= 3): NP-complete!
```

## Proving NP-Completeness

To prove problem X is NP-complete:

```
1. Show X is in NP (give a polynomial-time verifier)
2. Reduce a KNOWN NP-complete problem to X
   (show Known-Problem <=p X)

Example: Prove CLIQUE is NP-complete.

Step 1: X in NP?
  Certificate: the k vertices forming the clique.
  Verification: check all C(k,2) pairs are edges. Polynomial. Yes.

Step 2: Reduce 3-SAT to CLIQUE.
  [Technical construction that transforms any 3-SAT formula
   into a graph where satisfiability = existence of a k-clique]
```

## Beyond NP

```
+--------------------------------------------------+
|  EXPTIME  (solvable in exponential time)         |
|  +--------------------------------------------+  |
|  |  PSPACE  (polynomial space)                |  |
|  |  +--------------------------------------+  |  |
|  |  |  NP              co-NP              |  |  |
|  |  |  +----------+    +----------+       |  |  |
|  |  |  |    P     |    |    P     |       |  |  |
|  |  |  +----------+    +----------+       |  |  |
|  |  +--------------------------------------+  |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+

co-NP: problems whose COMPLEMENT is in NP.
  "Is this formula UNSATISFIABLE?" is in co-NP.

PSPACE: problems solvable with polynomial memory.
  QBF (quantified boolean formulas) is PSPACE-complete.
  Generalized chess/checkers are PSPACE-hard.

EXPTIME: problems requiring exponential time.
  Generalized chess (on nxn board) is EXPTIME-complete.
```

## Coping with NP-Completeness

If your problem is NP-complete, you have options:

```
1. EXACT for small inputs
   n <= 20-25: brute force might work

2. APPROXIMATION algorithms
   TSP: 2-approximation (answer within 2x optimal)
   Vertex Cover: 2-approximation

3. HEURISTICS
   Genetic algorithms, simulated annealing
   No guarantees, but often good in practice

4. SPECIAL CASES
   2-SAT is in P (only 3-SAT+ is NP-complete)
   Planar graphs: many problems become easier

5. PARAMETERIZED complexity
   Vertex Cover of size k: O(2^k * n) — tractable when k is small
```

## Python: Brute Force NP-Complete Problems

```python
from itertools import combinations

def subset_sum(numbers, target):
    for size in range(len(numbers) + 1):
        for combo in combinations(numbers, size):
            if sum(combo) == target:
                return combo
    return None

print(subset_sum([3, 7, 1, 8, 4], 12))


def is_clique(graph, vertices):
    for i, v1 in enumerate(vertices):
        for v2 in vertices[i+1:]:
            if v2 not in graph.get(v1, set()):
                return False
    return True

def find_clique(graph, k):
    for combo in combinations(graph.keys(), k):
        if is_clique(graph, combo):
            return combo
    return None
```

## Exercises

1. Explain in your own words the difference between P and NP using a real-world analogy.

2. Why does the existence of one NP-complete problem (SAT) let us prove
   many other problems are NP-complete?

3. Show that INDEPENDENT SET is in NP by describing a polynomial-time verifier.

4. If someone proves P = NP tomorrow, what happens to RSA encryption? Why?

5. **Python challenge:** Implement a brute-force 3-SAT solver that takes a formula
   in CNF (list of clauses, each clause a list of literals) and finds a satisfying
   assignment or reports unsatisfiable.

6. The problem "given a graph, does it have a Hamiltonian path?" is NP-complete.
   The problem "given a graph, does it have an Euler path?" is in P.
   What makes these two problems so different in difficulty?

---

This concludes the Discrete Math & Logic track.
[Back to Track Roadmap](00-roadmap.md)

## Further Reading

- Sipser, "Introduction to the Theory of Computation" (the standard reference)
- Arora & Barak, "Computational Complexity: A Modern Approach"
- The Clay Mathematics Institute P vs NP problem page
