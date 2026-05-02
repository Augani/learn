# Lesson 11 — Number Theory

> **Analogy:** Locks and keys. Primes are the atoms of numbers —
> every integer is uniquely built from them. RSA encryption works because
> multiplying two primes is easy (locking), but factoring the product is hard (picking the lock).

## Prime Numbers

A prime p > 1 has exactly two divisors: 1 and itself.

```
Primes:     2, 3, 5, 7, 11, 13, 17, 19, 23, 29, ...
Not prime:  4 = 2*2,  6 = 2*3,  15 = 3*5

Note: 1 is NOT prime (by convention, for uniqueness of factorization).
Note: 2 is the ONLY even prime.
```

### Fundamental Theorem of Arithmetic

Every integer n > 1 has a UNIQUE prime factorization (up to ordering).

```
60  = 2^2 * 3 * 5
360 = 2^3 * 3^2 * 5
1001 = 7 * 11 * 13
```

This is like atoms in chemistry — primes are the building blocks.

### Infinitely Many Primes (Euclid's Proof)

```
Proof by contradiction:
  Assume finitely many primes: p1, p2, ..., pk.
  Let N = p1 * p2 * ... * pk + 1.
  N is not divisible by any pi (remainder 1 for each).
  So N is either prime or has a prime factor not in our list.
  Contradiction. There must be infinitely many primes.  QED
```

## GCD and LCM

```
GCD(a, b) = Greatest Common Divisor = largest d dividing both a and b
LCM(a, b) = Least Common Multiple = smallest m divisible by both a and b

GCD(12, 18) = 6
LCM(12, 18) = 36

Key relation: GCD(a, b) * LCM(a, b) = a * b
So: LCM(12, 18) = (12 * 18) / 6 = 36
```

### Euclidean Algorithm

The most elegant algorithm in mathematics. Over 2300 years old.

```
GCD(252, 198):
  252 = 1 * 198 + 54
  198 = 3 * 54  + 36
   54 = 1 * 36  + 18
   36 = 2 * 18  + 0
                   ^
  GCD = 18 (last non-zero remainder)
```

```python
def gcd(a, b):
    while b:
        a, b = b, a % b
    return a

def lcm(a, b):
    return a * b // gcd(a, b)
```

**Why it works:** gcd(a, b) = gcd(b, a mod b), and the remainders strictly decrease.

### Extended Euclidean Algorithm

Finds x, y such that ax + by = gcd(a, b). (Bezout's identity)

```
GCD(35, 15):
  35 = 2*15 + 5
  15 = 3*5  + 0
  GCD = 5

Back-substitute:
  5 = 35 - 2*15
  So: 35*1 + 15*(-2) = 5

  x = 1, y = -2
```

This is how we find modular inverses (Lesson 10).

## Primality Testing

### Trial Division

```python
def is_prime(n):
    if n < 2:
        return False
    if n < 4:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    i = 5
    while i * i <= n:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True
```

Only need to check up to sqrt(n). If n has a factor > sqrt(n),
the corresponding co-factor is < sqrt(n).

### Sieve of Eratosthenes

Find ALL primes up to n in O(n log log n):

```
Mark all numbers 2 to n as potentially prime.
For each prime p starting from 2:
  Mark all multiples of p (starting from p^2) as composite.

Sieve up to 30:
 2  3  4  5  6  7  8  9  10 11 12 13 14 15
16 17 18 19 20 21 22 23 24 25 26 27 28 29 30

Cross out multiples of 2: 4,6,8,10,12,14,16,18,20,22,24,26,28,30
Cross out multiples of 3: 9,15,21,27
Cross out multiples of 5: 25

Primes: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29
```

```python
def sieve(n):
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    for i in range(2, int(n**0.5) + 1):
        if is_prime[i]:
            for j in range(i*i, n + 1, i):
                is_prime[j] = False
    return [i for i in range(2, n + 1) if is_prime[i]]
```

## RSA Encryption — The Crown Jewel

RSA makes number theory the basis of internet security.

### Key Generation

```
1. Choose two large primes p, q  (in practice, 512+ bits each)
2. Compute n = p * q
3. Compute phi(n) = (p-1)(q-1)
4. Choose e such that gcd(e, phi(n)) = 1  (commonly e = 65537)
5. Compute d = e^(-1) mod phi(n)  (using extended Euclidean)

Public key:  (e, n)   -- share with everyone
Private key: (d, n)   -- keep secret
```

### Encryption and Decryption

```
Encrypt: C = M^e mod n
Decrypt: M = C^d mod n

WHY this works:
  C^d = (M^e)^d = M^(e*d) mod n

  Since e*d === 1 (mod phi(n)):
  e*d = 1 + k*phi(n) for some integer k

  M^(e*d) = M^(1 + k*phi(n))
           = M * (M^phi(n))^k
           === M * 1^k  (mod n)     [by Euler's theorem]
           === M  (mod n)
```

### Toy Example

```python
def rsa_demo():
    p, q = 61, 53
    n = p * q
    phi_n = (p - 1) * (q - 1)
    e = 17

    def extended_gcd(a, b):
        if a == 0:
            return b, 0, 1
        g, x, y = extended_gcd(b % a, a)
        return g, y - (b // a) * x, x

    _, d, _ = extended_gcd(e, phi_n)
    d = d % phi_n

    message = 42
    encrypted = pow(message, e, n)
    decrypted = pow(encrypted, d, n)

    print(f"n = {n}")
    print(f"Public key (e, n) = ({e}, {n})")
    print(f"Private key (d, n) = ({d}, {n})")
    print(f"Original:  {message}")
    print(f"Encrypted: {encrypted}")
    print(f"Decrypted: {decrypted}")

rsa_demo()
```

### Why RSA Is Secure

```
To break RSA, you need to factor n = p * q.

Multiplying:  p * q = n          EASY (milliseconds)
Factoring:    n -> p, q          HARD (centuries for large n)

This asymmetry is the "lock and key":
  Building the lock (multiplying) is easy.
  Picking the lock (factoring) is hard.

No known polynomial-time algorithm for factoring exists.
(Quantum computers could change this — see Shor's algorithm.)
```

## Divisibility Rules (Formal)

```
a | b  means  b = a * k  for some integer k

Properties:
  a | 0  for all a
  1 | a  for all a
  If a | b and b | c, then a | c  (transitivity)
  If a | b and a | c, then a | (bx + cy) for any integers x, y
```

## Linear Diophantine Equations

Find integer solutions to ax + by = c.

```
Solutions exist if and only if gcd(a, b) | c.

3x + 5y = 1:
  gcd(3, 5) = 1, and 1 | 1, so solutions exist.
  Extended Euclidean: 3*2 + 5*(-1) = 1
  One solution: x=2, y=-1
  General: x = 2 + 5t, y = -1 - 3t for any integer t

6x + 4y = 7:
  gcd(6, 4) = 2, and 2 does not divide 7.
  NO integer solutions exist.
```

## Exercises

1. Find gcd(1071, 462) using the Euclidean algorithm.

2. Find integers x, y such that 42x + 30y = gcd(42, 30).

3. Verify RSA with p=11, q=13, e=7: encrypt and decrypt the message M=9.

4. Prove: if p is prime and p | (a*b), then p | a or p | b.
   (This is Euclid's lemma — fundamental to unique factorization.)

5. **Python challenge:** Implement the Sieve of Eratosthenes and use it to find
   all twin primes (primes p where p+2 is also prime) up to 10,000.

6. How many integers between 1 and 100 are coprime to 100? (Use Euler's totient.)

---

[Next: Lesson 12 — Finite Automata](12-finite-automata.md)
