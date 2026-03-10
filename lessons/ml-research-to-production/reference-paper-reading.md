# Reference: Paper Reading

Quick reference for reading ML papers, common notation, and
navigating arXiv.

---

## Three-Pass Method (Quick Reference)

```
Pass 1: Scout (5-10 min)
  Read:  Title, abstract, intro/conclusion, section headings, figures
  Ask:   Is this relevant? What's the main idea?
  Kill:  If not relevant, stop here.

Pass 2: Walk-Through (30-60 min)
  Read:  Entire paper, skip dense proofs
  Focus: Figures, algorithm boxes, experiment tables
  Ask:   What's the architecture? How does it compare to baselines?
  Kill:  If not useful for my work, stop here.

Pass 3: Deep Dive (2-4 hours)
  Read:  Everything including appendix, derivations, references
  Do:    Work through math on paper, check implementation details
  Goal:  Be able to reimplement from memory.
```

---

## Paper Anatomy Cheat Sheet

```
+-------------------+------------------+----------------------------+
| Section           | Read When        | Look For                   |
+-------------------+------------------+----------------------------+
| Abstract          | Always           | Problem, method, result    |
| Introduction      | Pass 1+          | Motivation, prior gaps     |
| Related Work      | Surveying field  | Landscape of approaches    |
| Method            | Pass 2+          | Architecture, equations    |
| Experiments       | Pass 2+          | Datasets, baselines, #s    |
| Ablations         | Pass 2+          | Which components matter    |
| Conclusion        | Pass 1+          | Summary, limitations       |
| Appendix          | Pass 3           | Hyperparams, proofs, code  |
| References        | As needed        | Key prior work to read     |
+-------------------+------------------+----------------------------+
```

---

## Common Math Notation

### Scalars, Vectors, Matrices

```
Notation          Meaning                     Code
--------          -------                     ----
x                 Scalar                      x (float)
x, x (bold)       Vector                      x = torch.tensor([...])
X, X (bold cap)   Matrix                      X = torch.randn(m, n)
X (calligraphic)  Set or distribution         dataset / distribution
R^d               d-dimensional real space    torch.randn(d)
R^{m x n}         m-by-n matrix space         torch.randn(m, n)
```

### Operations

```
Notation          Meaning                     Code
--------          -------                     ----
x^T               Transpose                   x.T
X^{-1}            Matrix inverse              torch.linalg.inv(X)
||x||_2           L2 norm                     torch.norm(x, p=2)
||x||_1           L1 norm                     torch.norm(x, p=1)
x . y             Dot product                 torch.dot(x, y)
X @ Y             Matrix multiply             X @ Y
x * y (odot)      Element-wise multiply       x * y
diag(x)           Diagonal matrix from vec    torch.diag(x)
tr(X)             Trace (sum of diagonal)     torch.trace(X)
det(X)            Determinant                 torch.linalg.det(X)
```

### Calculus and Optimization

```
Notation          Meaning                     Code
--------          -------                     ----
nabla_theta L     Gradient of L wrt theta     loss.backward()
partial L /       Partial derivative          (autograd)
  partial x
argmax_x f(x)     x that maximizes f          torch.argmax(f_x)
argmin_x f(x)     x that minimizes f          torch.argmin(f_x)
min/max           Minimum/maximum value       torch.min() / torch.max()
```

### Probability and Statistics

```
Notation          Meaning                     Code
--------          -------                     ----
P(x)              Probability of x            (context-dependent)
p(x)              Probability density          (context-dependent)
E[x]              Expected value (mean)       x.mean()
Var(x)            Variance                    x.var()
sigma             Standard deviation           x.std()
N(mu, sigma^2)    Normal distribution         torch.randn() * sigma + mu
KL(p || q)        KL divergence               F.kl_div()
H(p)              Entropy                     -(p * p.log()).sum()
```

### Indexing Conventions

```
Notation          Meaning                     Code
--------          -------                     ----
x_i               i-th element                x[i]
x_{1:T}           Elements 1 through T        x[1:T+1]  (0-indexed!)
x^{(t)}           Value at time step t        x_t  or  x[t]
W^{(l)}           Layer l's weights            layers[l].weight
theta             All parameters              model.parameters()
theta_i           i-th parameter group         param_groups[i]
```

---

## Activation Functions

```
Name          Math                          Code
----          ----                          ----
ReLU          max(0, x)                     F.relu(x)
GELU          x * Phi(x)                    F.gelu(x)
SiLU/Swish    x * sigmoid(x)               F.silu(x)
Sigmoid       1 / (1 + exp(-x))            torch.sigmoid(x)
Tanh          (exp(x)-exp(-x)) /           torch.tanh(x)
              (exp(x)+exp(-x))
Softmax       exp(x_i) / sum(exp(x_j))     F.softmax(x, dim=-1)
Log-Softmax   log(softmax(x))              F.log_softmax(x, dim=-1)
```

---

## Loss Functions Quick Reference

```
Task              Loss              PyTorch
----              ----              -------
Classification    Cross-Entropy     F.cross_entropy(logits, targets)
Binary            BCE               F.binary_cross_entropy_with_logits()
Regression        MSE               F.mse_loss(pred, target)
Regression        L1 / MAE          F.l1_loss(pred, target)
Regression        Huber / Smooth L1 F.smooth_l1_loss(pred, target)
Contrastive       InfoNCE           (custom, see Lesson 08)
Contrastive       Triplet           nn.TripletMarginLoss()
Generation        KL Divergence     F.kl_div()
```

---

## arXiv Tips

### Finding Papers

```
By category:
  cs.LG   - Machine Learning (general)
  cs.CV   - Computer Vision
  cs.CL   - Computation and Language (NLP)
  cs.AI   - Artificial Intelligence
  stat.ML - Statistical Machine Learning
  cs.RO   - Robotics
  cs.IR   - Information Retrieval

URL patterns:
  Latest:    arxiv.org/list/cs.LG/recent
  Search:    arxiv.org/search/?query=...
  Paper:     arxiv.org/abs/2301.12345
  PDF:       arxiv.org/pdf/2301.12345
```

### Version Tracking

```
arXiv papers have versions:
  v1: First submission (may have bugs)
  v2: Usually fixes from reviewer feedback
  v3+: Post-acceptance revisions

Always check for the latest version.
URL: arxiv.org/abs/2301.12345v3
```

### arXiv ID Format

```
Pre-2007:  category/YYMMNNN     (e.g., hep-th/0601001)
Post-2007: YYMM.NNNNN           (e.g., 2301.12345)

The YYMM tells you when it was submitted.
2301 = January 2023
2312 = December 2023
```

---

## Paper Reading Notes Template

```
Paper: [Title]
Authors: [First Author et al.]
Year: [Year]
Venue: [arXiv / NeurIPS / ICML / etc.]
Link: [URL]
Pass Level: [1 / 2 / 3]
Date Read: [YYYY-MM-DD]

One-sentence summary:
  [What problem does it solve and how?]

Method:
  [2-3 sentences describing the approach]

Key equations:
  [List the 1-3 most important equations]

Results:
  [Main numbers from the paper]

Strengths:
  - [...]
  - [...]

Weaknesses:
  - [...]
  - [...]

Missing details (for implementation):
  - [Hyperparameters not reported]
  - [Ambiguous descriptions]

Relevance to my work:
  [How could I use this?]

Follow-up papers to read:
  - [Paper A (for concept X)]
  - [Paper B (competing approach)]
```

---

## Critical Reading Checklist

```
Baselines:
  [ ] Are baselines recent (< 2 years old)?
  [ ] Were baselines tuned fairly?
  [ ] Is compute budget comparable?

Experiments:
  [ ] Multiple datasets tested?
  [ ] Error bars / confidence intervals reported?
  [ ] Statistical significance tested?
  [ ] Ablation study included?

Reproducibility:
  [ ] Code available?
  [ ] Hyperparameters fully specified?
  [ ] Dataset preprocessing described?
  [ ] Hardware specified?
  [ ] Random seeds reported?

Red flags:
  [ ] Results seem too good (>10% over SOTA)?
  [ ] Only tested on toy/small datasets?
  [ ] No comparison to recent methods?
  [ ] Vague method description?
  [ ] Cherry-picked qualitative examples?
```

---

## Useful Search Tools

```
Tool                    Best For
----                    --------
Semantic Scholar        Citation graphs, related papers, TLDRs
Google Scholar          Broad search, citation counts, alerts
Papers With Code        Finding implementations and benchmarks
Connected Papers       Visual citation graph exploration
arXiv Sanity           Personalized paper recommendations
Daily Papers (HF)      Community-curated daily arXiv picks
```
