# Lesson 16: Maximum Likelihood Estimation

> **Analogy:** A detective finds a body. Multiple suspects.
> The detective asks: "Given this evidence, which suspect
> MOST LIKELY committed the crime?" MLE asks the same
> question about model parameters.

---

## The Core Idea

```
  YOU OBSERVE DATA. YOU HAVE A MODEL.
  WHICH PARAMETERS MAKE THE DATA MOST LIKELY?

  Observed data: [2.1, 1.8, 2.3, 2.0, 1.9]

  Model: Normal distribution with mean mu and std sigma

  Question: What mu and sigma make this data most probable?

  ┌──────────────────────────────────────────────┐
  │  Likelihood = P(data | parameters)            │
  │                                               │
  │  MLE finds: argmax_theta P(data | theta)      │
  │                                               │
  │  "Find the parameters that maximize the       │
  │   probability of seeing what we actually saw"  │
  └──────────────────────────────────────────────┘

  The detective analogy:
  Evidence (data) = footprints, fingerprints, motive
  Suspect (parameters) = who did it
  Likelihood = P(this evidence | suspect X did it)
  MLE = the suspect that best explains ALL the evidence
```

---

## Likelihood vs Probability

```
  THEY LOOK THE SAME BUT AREN'T
  ==============================

  P(data | theta) -- same formula, different perspective:

  PROBABILITY:                    LIKELIHOOD:
  theta is fixed, data varies     Data is fixed, theta varies

  "Given a fair coin (theta=0.5), "Given 7 heads in 10 flips,
   what's the chance of            what's the most likely
   7 heads in 10 flips?"           value of theta?"

  ┌──────────────────────┐       ┌──────────────────────┐
  │ theta = 0.5 (fixed)  │       │ data = 7/10 (fixed)  │
  │                      │       │                      │
  │ P(7|10,0.5) = 0.117  │       │ L(0.3) = 0.009      │
  │ P(8|10,0.5) = 0.044  │       │ L(0.5) = 0.117      │
  │ P(5|10,0.5) = 0.246  │       │ L(0.7) = 0.267  MAX │
  └──────────────────────┘       │ L(0.9) = 0.057      │
                                 └──────────────────────┘
```

---

## MLE for a Coin

```python
import numpy as np
import matplotlib.pyplot as plt

flips = np.array([1, 1, 1, 0, 1, 0, 1, 1, 0, 1])
n_heads = flips.sum()
n_total = len(flips)

theta_values = np.linspace(0.01, 0.99, 200)
likelihoods = (theta_values ** n_heads) * ((1 - theta_values) ** (n_total - n_heads))

mle_theta = theta_values[np.argmax(likelihoods)]
print(f"Observed: {n_heads}/{n_total} heads")
print(f"MLE estimate: theta = {mle_theta:.3f}")
print(f"Analytical MLE: theta = {n_heads / n_total:.3f}")

plt.figure(figsize=(8, 4))
plt.plot(theta_values, likelihoods)
plt.axvline(mle_theta, color="red", linestyle="--", label=f"MLE = {mle_theta:.2f}")
plt.xlabel("theta (probability of heads)")
plt.ylabel("Likelihood")
plt.title("Likelihood Function for Coin Flips")
plt.legend()
plt.show()
```

---

## Log-Likelihood: Avoiding Numerical Underflow

```
  PROBLEM: Multiplying many small probabilities
  ==============================================

  L(theta) = P(x1|theta) * P(x2|theta) * ... * P(xn|theta)

  With 1000 data points, each P ~ 0.01:
  L = 0.01^1000 = 10^(-2000)  --> UNDERFLOW!

  SOLUTION: Take the log
  ======================

  log L(theta) = log P(x1|theta) + log P(x2|theta) + ... + log P(xn|theta)

  Products become sums. No underflow.
  Maximizing log L gives the same theta as maximizing L
  (because log is monotonically increasing).

  ┌─────────────────────────────────────────┐
  │  In practice, we MINIMIZE negative      │
  │  log-likelihood (NLL):                  │
  │                                         │
  │  NLL = -log L(theta) = -sum log P(xi|t) │
  │                                         │
  │  This is what "loss functions" are!     │
  └─────────────────────────────────────────┘
```

```python
import numpy as np

flips = np.array([1, 1, 1, 0, 1, 0, 1, 1, 0, 1])

def log_likelihood_bernoulli(theta, data):
    if theta <= 0 or theta >= 1:
        return -np.inf
    return np.sum(data * np.log(theta) + (1 - data) * np.log(1 - theta))

theta_values = np.linspace(0.01, 0.99, 200)
log_likes = [log_likelihood_bernoulli(t, flips) for t in theta_values]

mle_idx = np.argmax(log_likes)
print(f"MLE via log-likelihood: theta = {theta_values[mle_idx]:.3f}")
```

---

## MLE for a Normal Distribution

```
  Given data points x1, x2, ..., xn from Normal(mu, sigma^2):

  Log-likelihood:
  log L(mu, sigma) = -n/2 * log(2pi) - n*log(sigma) - sum(xi - mu)^2 / (2*sigma^2)

  Take derivative, set to zero:

  MLE for mu:     mu_hat = (1/n) sum xi          (sample mean!)
  MLE for sigma:  sigma_hat^2 = (1/n) sum (xi - mu_hat)^2  (sample variance)

  The sample mean IS the maximum likelihood estimate.
  Not a coincidence -- it's a mathematical consequence.
```

```python
import numpy as np
from scipy.optimize import minimize

np.random.seed(42)
true_mu, true_sigma = 5.0, 2.0
data = np.random.normal(true_mu, true_sigma, size=100)

def neg_log_likelihood_normal(params, data):
    mu, log_sigma = params
    sigma = np.exp(log_sigma)
    n = len(data)
    nll = n * np.log(sigma) + np.sum((data - mu) ** 2) / (2 * sigma ** 2)
    return nll

result = minimize(
    neg_log_likelihood_normal,
    x0=[0.0, 0.0],
    args=(data,),
    method="Nelder-Mead",
)

mu_hat = result.x[0]
sigma_hat = np.exp(result.x[1])

print(f"True:     mu = {true_mu}, sigma = {true_sigma}")
print(f"MLE:      mu = {mu_hat:.3f}, sigma = {sigma_hat:.3f}")
print(f"Analytic: mu = {data.mean():.3f}, sigma = {data.std():.3f}")
```

---

## MLE IS Training Neural Networks

```
  CROSS-ENTROPY LOSS IS NEGATIVE LOG-LIKELIHOOD
  ===============================================

  Classification:
  Model outputs P(class | input, theta)

  MLE says: maximize sum log P(true_class_i | input_i, theta)
  Training says: minimize -sum log P(true_class_i | input_i, theta)

  THEY ARE THE SAME THING!

  ┌──────────────────────────────────────────┐
  │  MLE objective:                          │
  │  max_theta  sum log P(y_i | x_i, theta) │
  │                                          │
  │  = min_theta -sum log P(y_i | x_i, theta)│
  │                                          │
  │  = min_theta  cross_entropy_loss         │
  │                                          │
  │  Regression with MSE loss:               │
  │  = MLE assuming Gaussian noise           │
  └──────────────────────────────────────────┘

  When you call loss.backward(), you are computing
  the gradient of the negative log-likelihood!
```

---

## MLE for Linear Regression

```python
import numpy as np

np.random.seed(42)
n = 200
X = np.column_stack([np.ones(n), np.random.randn(n)])
true_weights = np.array([3.0, 1.5])
noise_std = 0.5
y = X @ true_weights + np.random.randn(n) * noise_std

mle_weights = np.linalg.lstsq(X, y, rcond=None)[0]
print(f"True weights:  {true_weights}")
print(f"MLE weights:   {mle_weights.round(3)}")

residuals = y - X @ mle_weights
mle_sigma = np.sqrt(np.mean(residuals ** 2))
print(f"True sigma:  {noise_std}")
print(f"MLE sigma:   {mle_sigma:.3f}")
```

---

## MAP: MLE with a Prior

```
  MAXIMUM A POSTERIORI (MAP)
  ==========================

  MLE: Find theta that maximizes P(data | theta)
  MAP: Find theta that maximizes P(theta | data)

  By Bayes: P(theta | data) is proportional to P(data | theta) * P(theta)
                                                 ──────────────   ────────
                                                 likelihood        prior

  MAP = MLE + regularization

  ┌─────────────────────────────────────────────┐
  │  Gaussian prior on weights:                  │
  │  P(theta) = Normal(0, sigma^2)               │
  │                                              │
  │  MAP objective:                              │
  │  min -log P(data|theta) - log P(theta)       │
  │  = min loss + lambda * ||theta||^2           │
  │                                              │
  │  This IS L2 regularization (weight decay)!  │
  └─────────────────────────────────────────────┘

  Laplace prior --> L1 regularization (Lasso)
  Gaussian prior --> L2 regularization (Ridge)
```

```python
import numpy as np
from sklearn.linear_model import Ridge, Lasso, LinearRegression

np.random.seed(42)
X = np.random.randn(50, 10)
true_w = np.zeros(10)
true_w[:3] = [2.0, -1.0, 0.5]
y = X @ true_w + np.random.randn(50) * 0.5

mle_model = LinearRegression().fit(X, y)
l2_model = Ridge(alpha=1.0).fit(X, y)
l1_model = Lasso(alpha=0.1).fit(X, y)

print("True weights:    ", true_w.round(2))
print("MLE (no prior):  ", mle_model.coef_.round(2))
print("MAP (L2/Ridge):  ", l2_model.coef_.round(2))
print("MAP (L1/Lasso):  ", l1_model.coef_.round(2))
```

---

## Key Takeaways

```
  ┌──────────────────────────────────────────────────┐
  │  MLE = find params that make data most likely     │
  │  Log-likelihood avoids numerical underflow        │
  │  NLL = negative log-likelihood = loss function    │
  │  Cross-entropy loss = NLL for classification      │
  │  MSE loss = NLL assuming Gaussian noise           │
  │  MAP = MLE + prior = MLE + regularization         │
  │  L2 regularization = Gaussian prior               │
  │  L1 regularization = Laplace prior                │
  │  Training a neural net IS doing MLE               │
  └──────────────────────────────────────────────────┘
```

---

## Exercises

**Exercise 1:** Generate 500 samples from a Poisson distribution
with lambda=4. Write the log-likelihood function for the Poisson
and use scipy.optimize.minimize to find the MLE. Verify it equals
the sample mean.

**Exercise 2:** Implement MLE for a mixture of two Gaussians using
the EM algorithm. Generate data from two known Gaussians, then
recover the parameters.

**Exercise 3:** Show empirically that minimizing MSE loss on
regression data gives the same weights as the MLE derived from
the normal distribution log-likelihood.

**Exercise 4:** Compare MLE, Ridge, and Lasso on a dataset with 100
features but only 5 truly relevant ones. Show that MAP estimates
(Ridge/Lasso) generalize better than pure MLE when data is scarce.

**Exercise 5:** Fit a logistic regression model manually by writing
the log-likelihood and optimizing with gradient descent. Compare
your result with sklearn's LogisticRegression.

---

[Next: Lesson 17 - Information Theory ->](17-information-theory.md)
