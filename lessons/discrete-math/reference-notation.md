# Reference — Mathematical Notation for Programmers

> Keep this open while working through the track.
> Every symbol mapped to code you already know.

## Logic Symbols

```
Symbol    Name              Python/Code          Example
------    ----              -----------          -------
~         NOT               not                  ~p = not p
^         AND               and                  p ^ q = p and q
v         OR                or                   p v q = p or q
->        IMPLIES           if p then q          p -> q
<->       IFF               p == q               p <-> q
ALL       FOR ALL           all()                ALL x, P(x)
EX        THERE EXISTS      any()                EX x, P(x)
```

## Set Notation

```
Symbol    Name              Python/Code          Example
------    ----              -----------          -------
{ }       Set               set()                {1, 2, 3}
in        Element of        in                   x in S
not in    Not element of    not in               x not in S
U         Union             |                    A | B
n         Intersection      &                    A & B
-         Difference        -                    A - B
<=        Subset            <=, issubset()       A <= B
<         Proper subset     <                    A < B
|A|       Cardinality       len()                len(A)
P(A)      Power set         --                   set of all subsets
A x B     Cartesian product itertools.product    all pairs (a, b)
{}        Empty set         set()                the empty set
```

## Number Sets

```
Symbol    Name              Description
------    ----              -----------
N         Naturals          {0, 1, 2, 3, ...}
Z         Integers          {..., -2, -1, 0, 1, 2, ...}
Q         Rationals         fractions a/b, b != 0
R         Reals             all real numbers
C         Complex           a + bi
Z+        Positive integers {1, 2, 3, ...}
Z_n       Integers mod n    {0, 1, ..., n-1}
```

## Function Notation

```
Symbol    Meaning                        Code Analogy
------    -------                        -----------
f: A -> B function from A to B          def f(x: A) -> B
f(x)      function application           f(x)
f o g     composition                    f(g(x))
f^(-1)    inverse function               undo f
|-> (maps to) x |-> x^2                 lambda x: x**2
```

## Proof Notation

```
Symbol    Meaning              Usage
------    -------              -----
QED       "end of proof"       marks proof complete
===       "is equivalent to"   logical equivalence
=>        "implies"            in proof steps
<=>       "if and only if"     bidirectional implication
:=        "defined as"         introducing a definition
WLOG      without loss of      simplifying assumption
          generality
```

## Combinatorics

```
Symbol    Name                 Formula                   Python
------    ----                 -------                   ------
n!        Factorial            n*(n-1)*...*1             math.factorial(n)
P(n,k)    Permutation          n!/(n-k)!                math.perm(n, k)
C(n,k)    Combination          n!/(k!(n-k)!)            math.comb(n, k)
SUM       Summation            sum of terms              sum()
PROD      Product              product of terms          math.prod()
```

## Number Theory

```
Symbol    Meaning                      Python
------    -------                      ------
a | b     a divides b                  b % a == 0
a === b   a congruent to b (mod n)     a % n == b % n
(mod n)
gcd(a,b)  greatest common divisor      math.gcd(a, b)
lcm(a,b)  least common multiple        math.lcm(a, b)
phi(n)    Euler's totient              (custom function)
a^(-1)    modular inverse of a         pow(a, -1, n) in Python 3.8+
```

## Graph Theory

```
Symbol    Meaning                      Note
------    -------                      ----
G=(V,E)   graph with vertices, edges   standard definition
deg(v)    degree of vertex v           number of edges touching v
K_n       complete graph on n vertices every pair connected
C_n       cycle graph on n vertices    single cycle
K_{m,n}   complete bipartite graph     two groups, all cross-edges
X(G)      chromatic number             min colors needed
```

## Complexity

```
Symbol    Meaning
------    -------
O(f(n))   Big-O: upper bound
o(f(n))   Little-o: strict upper bound
theta     Theta: tight bound (upper and lower)
omega     Omega: lower bound
P         Polynomial time class
NP        Nondeterministic polynomial time
<=p       Polynomial-time reducibility
```

## Greek Letters Used in Math

```
Letter    Common Use
------    ----------
alpha     angles, constants
beta      angles, constants
gamma     Euler-Mascheroni constant
delta     small change, difference
epsilon   arbitrarily small positive number
phi       Euler's totient, golden ratio
lambda    eigenvalues, lambda calculus
pi        3.14159..., also projection
sigma     summation, standard deviation
theta     angles, Big-Theta notation
omega     Big-Omega notation
```
