# Lesson 10 — Modular Arithmetic

> **Analogy:** Clock math. After 12 comes 1, not 13.
> 8 o'clock + 7 hours = 3 o'clock. That's arithmetic modulo 12.
> Modular arithmetic is the foundation of cryptography and hashing.

## The Modulo Operation

```
a mod n = remainder when a is divided by n

17 mod 5 = 2    (17 = 3*5 + 2)
-3 mod 5 = 2    (-3 = -1*5 + 2, remainder is always non-negative)
```

We write `a === b (mod n)` to mean a and b have the same remainder mod n.

```
17 === 2 (mod 5)     because 5 | (17 - 2) = 15
38 === 2 (mod 12)    because 12 | (38 - 2) = 36
```

## Congruence Classes

All integers sharing the same remainder form a congruence class:

```
mod 3:
  [0] = {..., -6, -3, 0, 3, 6, 9, ...}
  [1] = {..., -5, -2, 1, 4, 7, 10, ...}
  [2] = {..., -4, -1, 2, 5, 8, 11, ...}

The clock with 3 hours:
         [0]
        / | \
     [2]     [1]
```

## Modular Arithmetic Operations

You can add, subtract, and multiply mod n:

```
(a + b) mod n = ((a mod n) + (b mod n)) mod n
(a * b) mod n = ((a mod n) * (b mod n)) mod n
(a - b) mod n = ((a mod n) - (b mod n) + n) mod n

Example (mod 7):
  (15 + 23) mod 7 = (1 + 2) mod 7 = 3
  (15 * 23) mod 7 = (1 * 2) mod 7 = 2
```

**Warning:** Division does NOT work the same way. You need modular inverses.

## Modular Exponentiation

Computing a^b mod n efficiently using repeated squaring:

```
2^10 mod 1000:

2^1  = 2
2^2  = 4
2^4  = 16
2^8  = 256
2^10 = 2^8 * 2^2 = 256 * 4 = 1024 mod 1000 = 24
```

```python
def mod_pow(base, exp, mod):
    result = 1
    base = base % mod
    while exp > 0:
        if exp % 2 == 1:
            result = (result * base) % mod
        exp = exp >> 1
        base = (base * base) % mod
    return result

print(mod_pow(2, 10, 1000))
print(pow(2, 10, 1000))
```

Python's built-in `pow(base, exp, mod)` does this natively.

## Modular Inverse

The modular inverse of a (mod n) is a number x such that:

```
a * x === 1 (mod n)

3 * x === 1 (mod 7)
3 * 5 = 15 = 2*7 + 1 === 1 (mod 7)
So 3^(-1) === 5 (mod 7)
```

**When does an inverse exist?** Only when gcd(a, n) = 1.

```
2 has no inverse mod 4:
  2*0=0, 2*1=2, 2*2=0, 2*3=2  (mod 4)
  Never hits 1. Because gcd(2,4) = 2 != 1.
```

### Finding Inverses: Extended Euclidean Algorithm

```
Find 7^(-1) mod 11:

Apply Extended Euclidean Algorithm to gcd(7, 11):
  11 = 1*7 + 4
   7 = 1*4 + 3
   4 = 1*3 + 1
   3 = 3*1 + 0

Back-substitute:
  1 = 4 - 1*3
    = 4 - 1*(7 - 1*4) = 2*4 - 1*7
    = 2*(11 - 1*7) - 1*7 = 2*11 - 3*7

So 1 = -3*7 + 2*11
=> -3*7 === 1 (mod 11)
=> 7^(-1) === -3 === 8 (mod 11)

Check: 7 * 8 = 56 = 5*11 + 1 === 1 (mod 11)
```

```python
def extended_gcd(a, b):
    if a == 0:
        return b, 0, 1
    gcd, x1, y1 = extended_gcd(b % a, a)
    x = y1 - (b // a) * x1
    y = x1
    return gcd, x, y

def mod_inverse(a, m):
    gcd, x, _ = extended_gcd(a % m, m)
    if gcd != 1:
        return None
    return x % m

print(mod_inverse(7, 11))
```

## Euler's Totient Function

phi(n) = count of integers from 1 to n that are coprime to n.

```
phi(1)  = 1
phi(6)  = |{1, 5}| = 2           (2,3,4,6 share factors with 6)
phi(7)  = 6                      (7 is prime, all 1..6 are coprime)
phi(12) = |{1, 5, 7, 11}| = 4
```

**For prime p:** phi(p) = p - 1

**For prime powers:** phi(p^k) = p^k - p^(k-1)

**Multiplicative:** If gcd(a, b) = 1, then phi(a*b) = phi(a) * phi(b)

```python
def euler_totient(n):
    result = n
    p = 2
    temp = n
    while p * p <= temp:
        if temp % p == 0:
            while temp % p == 0:
                temp //= p
            result -= result // p
        p += 1
    if temp > 1:
        result -= result // temp
    return result
```

## Euler's Theorem

If gcd(a, n) = 1:

```
a^phi(n) === 1 (mod n)
```

**Special case (Fermat's Little Theorem):** If p is prime:

```
a^(p-1) === 1 (mod p)     for a not divisible by p
a^p === a (mod p)          for any a
```

**Application: Fast modular inverse**

```
a^(-1) === a^(phi(n)-1) (mod n)

If n is prime:
a^(-1) === a^(n-2) (mod n)

7^(-1) mod 11 = 7^9 mod 11 = 8
```

## Applications

### Hashing

```python
def simple_hash(key, table_size):
    return key % table_size
```

### Checksums (ISBN, Credit Cards)

```
ISBN-10 check digit:
  d1*1 + d2*2 + d3*3 + ... + d9*9 + d10*10 === 0 (mod 11)

Luhn algorithm (credit cards):
  Sum of digits (with doubling rule) === 0 (mod 10)
```

### Cryptography Preview

RSA encryption relies entirely on modular arithmetic:

```
Public key:  (e, n)
Private key: (d, n)

Encrypt: ciphertext = message^e mod n
Decrypt: message = ciphertext^d mod n

Works because: e*d === 1 (mod phi(n))
(We'll see this fully in Lesson 11)
```

## The Chinese Remainder Theorem

Solve simultaneous congruences:

```
x === 2 (mod 3)
x === 3 (mod 5)
x === 2 (mod 7)

Since 3, 5, 7 are pairwise coprime, a unique solution exists mod 105 (=3*5*7).

Solution: x === 23 (mod 105)
Check: 23 mod 3 = 2, 23 mod 5 = 3, 23 mod 7 = 2.
```

```python
def chinese_remainder(remainders, moduli):
    N = 1
    for m in moduli:
        N *= m

    result = 0
    for r, m in zip(remainders, moduli):
        Ni = N // m
        xi = mod_inverse(Ni, m)
        result += r * Ni * xi

    return result % N

print(chinese_remainder([2, 3, 2], [3, 5, 7]))
```

## Exercises

1. Compute by hand: 3^100 mod 7 (use Fermat's Little Theorem).

2. Find the modular inverse of 13 mod 20 using the extended Euclidean algorithm.

3. Compute phi(60). Use the formula for prime factorizations.

4. Solve using CRT: x === 1 (mod 3), x === 4 (mod 5), x === 6 (mod 7)

5. **Python challenge:** Implement a function that verifies ISBN-10 check digits
   using modular arithmetic.

6. Prove that if p is prime, then (p-1)! === -1 (mod p). (Wilson's Theorem)

---

[Next: Lesson 11 — Number Theory](11-number-theory.md)
