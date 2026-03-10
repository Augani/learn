# Reference: Key Formulas

> All formulas from the course with visual explanations.
> Bookmark this page.

---

## Linear Algebra

```
  VECTORS
  =======

  Dot product:     a . b = sum(ai * bi) = |a||b|cos(theta)

  Magnitude:       |a| = sqrt(sum(ai^2))

  Cosine sim:      cos(theta) = (a . b) / (|a| |b|)

  ┌──────────────────────────────────────────────┐
  │  cos = 1:  identical direction                │
  │  cos = 0:  perpendicular (unrelated)          │
  │  cos = -1: opposite direction                 │
  └──────────────────────────────────────────────┘

  MATRICES
  ========

  Matrix multiply:    (AB)_ij = sum_k A_ik B_kj
  Shapes:             (m x n) @ (n x p) = (m x p)

  Transpose:          (A^T)_ij = A_ji
  Identity:           AI = IA = A
  Inverse:            AA^-1 = A^-1 A = I

  Determinant (2x2):  det([a b; c d]) = ad - bc

  EIGENVALUES
  ===========

  Av = lambda * v
  A: matrix, v: eigenvector, lambda: eigenvalue

  "A stretches v by factor lambda"

  SVD
  ===

  A = U S V^T

  U: left singular vectors (m x m)
  S: singular values (diagonal, m x n)
  V^T: right singular vectors (n x n)
```

---

## Calculus

```
  DERIVATIVES
  ===========

  Power rule:       d/dx[x^n] = n * x^(n-1)
  Chain rule:       d/dx[f(g(x))] = f'(g(x)) * g'(x)
  Product rule:     d/dx[f*g] = f'g + fg'

  COMMON DERIVATIVES IN ML
  ========================

  d/dx[e^x]       = e^x
  d/dx[ln(x)]     = 1/x
  d/dx[sigmoid]   = sigmoid(x) * (1 - sigmoid(x))
  d/dx[tanh]      = 1 - tanh^2(x)
  d/dx[ReLU]      = 0 if x<0, 1 if x>0

  GRADIENT
  ========

  grad(f) = [df/dx1, df/dx2, ..., df/dxn]

  Points in direction of steepest INCREASE.
  Gradient descent goes OPPOSITE: theta = theta - lr * grad(f)

  ┌────────────────────────────────────────┐
  │  theta_new = theta - lr * grad(L)      │
  │                                        │
  │  lr = learning rate                    │
  │  L = loss function                     │
  │  grad(L) = gradient of loss w.r.t. theta│
  └────────────────────────────────────────┘
```

---

## Probability

```
  BASIC RULES
  ===========

  P(A) in [0, 1]
  P(not A) = 1 - P(A)
  P(A or B) = P(A) + P(B) - P(A and B)
  P(A and B) = P(A|B) * P(B) = P(B|A) * P(A)

  If independent: P(A and B) = P(A) * P(B)

  BAYES' THEOREM
  ==============

  P(A|B) = P(B|A) * P(A) / P(B)

  posterior = likelihood * prior / evidence

  DISTRIBUTIONS
  =============

  Normal:    f(x) = (1/sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2 / (2*sigma^2))
  Bernoulli: P(x) = p^x * (1-p)^(1-x),  x in {0, 1}
  Binomial:  P(k) = C(n,k) * p^k * (1-p)^(n-k)
  Poisson:   P(k) = (lambda^k * e^(-lambda)) / k!

  SOFTMAX
  =======

  softmax(z_i) = exp(z_i) / sum_j(exp(z_j))

  Converts logits to probabilities.
  All outputs in (0, 1), sum to 1.
```

---

## Expected Value and Variance

```
  E[X] = sum(x_i * P(x_i))                (discrete)
  E[X] = integral(x * f(x) dx)            (continuous)

  E[aX + b] = a*E[X] + b
  E[X + Y] = E[X] + E[Y]                  (always)

  Var(X) = E[(X - E[X])^2]
         = E[X^2] - (E[X])^2

  Var(aX + b) = a^2 * Var(X)
  SD(X) = sqrt(Var(X))

  If independent:
  Var(X + Y) = Var(X) + Var(Y)

  Cov(X, Y) = E[(X - mu_x)(Y - mu_y)]
  Corr(X, Y) = Cov(X,Y) / (sigma_x * sigma_y)   in [-1, 1]
```

---

## Information Theory

```
  ENTROPY
  =======

  H(X) = -sum(P(x) * log(P(x)))

  Measures uncertainty. Max when uniform.

  CROSS-ENTROPY
  =============

  H(P, Q) = -sum(P(x) * log(Q(x)))

  H(P, Q) = H(P) + D_KL(P || Q)

  For classification:
  CE loss = -sum(y_i * log(y_hat_i))
         = -log(predicted prob of true class)

  KL DIVERGENCE
  =============

  D_KL(P || Q) = sum(P(x) * log(P(x) / Q(x)))

  D_KL >= 0, equals 0 iff P = Q
  NOT symmetric: D_KL(P||Q) != D_KL(Q||P)

  MUTUAL INFORMATION
  ==================

  I(X; Y) = H(X) + H(Y) - H(X, Y) = H(X) - H(X|Y)
```

---

## Maximum Likelihood

```
  MLE: theta_hat = argmax_theta P(data | theta)

  Log-likelihood: l(theta) = sum(log(P(x_i | theta)))

  NLL: -l(theta) = -sum(log(P(x_i | theta)))    (minimize this)

  MAP: theta_hat = argmax_theta P(data|theta) * P(theta)
     = argmin_theta [-log P(data|theta) - log P(theta)]
     = argmin_theta [NLL + regularization]

  Gaussian prior -> L2 regularization
  Laplace prior  -> L1 regularization
```

---

## Statistical Testing

```
  CONFIDENCE INTERVAL
  ===================

  CI = x_bar +/- z * (sigma / sqrt(n))

  z = 1.96 for 95% confidence
  z = 2.58 for 99% confidence
  z = 1.65 for 90% confidence

  STANDARD ERROR
  ==============

  SE = sigma / sqrt(n)

  More samples -> smaller SE -> tighter CI

  HYPOTHESIS TEST
  ===============

  H0: no effect (mu1 = mu2)
  H1: there is an effect (mu1 != mu2)

  t-statistic = (x_bar1 - x_bar2) / SE(x_bar1 - x_bar2)
  p-value = P(|t| > |t_observed| | H0 is true)

  Reject H0 if p < alpha (typically alpha = 0.05)

  Bonferroni: alpha_adjusted = alpha / n_comparisons
```

---

## Loss Functions

```
  ┌────────────────┬──────────────────────────────┐
  │ Name           │ Formula                      │
  ├────────────────┼──────────────────────────────┤
  │ MSE            │ (1/n) sum((y - y_hat)^2)     │
  │ MAE            │ (1/n) sum(|y - y_hat|)       │
  │ Cross-Entropy  │ -sum(y * log(y_hat))         │
  │ Binary CE      │ -[y*log(yh) + (1-y)*log(1-yh)]│
  │ Hinge          │ max(0, 1 - y * y_hat)        │
  │ Huber          │ MSE if |e|<d, MAE otherwise  │
  │ KL Divergence  │ sum(P * log(P/Q))            │
  └────────────────┴──────────────────────────────┘
```

---

## Activation Functions

```
  ┌────────────┬──────────────────────┬───────────┐
  │ Name       │ Formula              │ Range     │
  ├────────────┼──────────────────────┼───────────┤
  │ Sigmoid    │ 1/(1+e^-x)           │ (0, 1)    │
  │ Tanh       │ (e^x-e^-x)/(e^x+e^-x)│ (-1, 1)  │
  │ ReLU       │ max(0, x)            │ [0, inf)  │
  │ LeakyReLU  │ max(alpha*x, x)      │ (-inf,inf)│
  │ GELU       │ x * Phi(x)           │ (-inf,inf)│
  │ Softmax    │ e^xi / sum(e^xj)     │ (0,1) s=1│
  └────────────┴──────────────────────┴───────────┘
```

---

## Optimization

```
  SGD:     theta = theta - lr * grad(L)

  Momentum: v = beta*v + grad(L)
            theta = theta - lr*v

  Adam:    m = b1*m + (1-b1)*grad(L)         (first moment)
           v = b2*v + (1-b2)*(grad(L))^2     (second moment)
           m_hat = m / (1-b1^t)              (bias correction)
           v_hat = v / (1-b2^t)
           theta = theta - lr * m_hat / (sqrt(v_hat) + eps)

  Default Adam: lr=0.001, b1=0.9, b2=0.999, eps=1e-8

  LEARNING RATE SCHEDULES
  =======================

  Step decay:    lr = lr0 * gamma^(epoch/step_size)
  Cosine:        lr = lr_min + 0.5*(lr_max - lr_min)*(1 + cos(pi*t/T))
  Warmup:        lr = lr_max * (t / warmup_steps)  for t < warmup
```

---

## Regularization

```
  L1 (Lasso):   loss + lambda * sum(|w_i|)       (sparse weights)
  L2 (Ridge):   loss + lambda * sum(w_i^2)       (small weights)
  ElasticNet:   loss + l1*sum(|wi|) + l2*sum(wi^2) (both)
  Dropout:      randomly zero out neurons during training
  BatchNorm:    normalize activations: x_hat = (x - mu) / sigma
```

---

## Metrics

```
  Accuracy    = (TP + TN) / (TP + TN + FP + FN)
  Precision   = TP / (TP + FP)    "of predicted pos, how many correct?"
  Recall      = TP / (TP + FN)    "of actual pos, how many found?"
  F1          = 2 * P * R / (P + R)
  AUC-ROC     = area under ROC curve (TPR vs FPR)

  ┌─────────────────────────────────────────┐
  │            Predicted                     │
  │            Pos    Neg                    │
  │  Actual Pos  TP    FN                    │
  │  Actual Neg  FP    TN                    │
  └─────────────────────────────────────────┘
```
