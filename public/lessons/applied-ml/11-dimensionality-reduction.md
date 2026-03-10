# Lesson 11: Dimensionality Reduction

## Shadows of 3D Objects on a Wall

Hold a ball between a lamp and a wall. The shadow is a 2D
representation of a 3D object. You lose some information (depth),
but the shadow still tells you it is round.

Dimensionality reduction does the same thing: projects
high-dimensional data into fewer dimensions, keeping the most
important structure while discarding noise.

```
  3D OBJECT             2D SHADOW
  =========             =========

     ___
    /   \               ___
   |  o  |    lamp-->  /   \
    \___/              \___/

  100 features          2-3 features
  Hard to visualize     Easy to plot
  May contain noise     Captures essence
```

---

## Why Reduce Dimensions?

```
  THE CURSE OF DIMENSIONALITY
  ===========================

  Dimensions    Points Needed     Data Feels
  ----------    -------------     ----------
  1             10                Dense
  2             100               Manageable
  3             1,000             Sparse
  10            10,000,000,000    Mostly empty!

  As dimensions increase:
  - All points become equidistant
  - Distance metrics break down
  - Models need exponentially more data
  - Overfitting risk skyrockets

  BENEFITS OF REDUCTION
  =====================
  + Visualization (plot in 2D/3D)
  + Faster training
  + Reduce overfitting
  + Remove noise
  + Find hidden structure
```

---

## PCA: Principal Component Analysis

PCA finds the directions of maximum variance in your data and
projects onto those directions. Like finding the best angle to
photograph a building to capture its most distinctive features.

```
  PCA VISUALIZED
  ==============

  Original data scattered in 2D:

       .  .
    .  .  .  .
  .  .  .  .  .  .
    .  .  .  .
       .  .

  PCA finds the axis of maximum spread:

       .  .
    .  . /. . .
  .  . / .  .  .  .    <-- PC1 (most variance)
    . / .  .  .
     / .  .
    /

  Then the perpendicular axis:
       |
  PC2  |  .  .
    .  | .  .  .
  -----+----------  PC1
    .  | .  .
       |  .
```

### PCA in Practice

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.datasets import load_iris

iris = load_iris(as_frame=True)
X = iris.data
y = iris.target

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

pca = PCA(n_components=2)
X_pca = pca.fit_transform(X_scaled)

print(f"Original shape: {X.shape}")
print(f"Reduced shape: {X_pca.shape}")
print(f"Variance explained: {pca.explained_variance_ratio_}")
print(f"Total variance kept: {pca.explained_variance_ratio_.sum():.3f}")

plt.figure(figsize=(10, 7))
scatter = plt.scatter(X_pca[:, 0], X_pca[:, 1], c=y, cmap="viridis", s=50)
plt.xlabel(f"PC1 ({pca.explained_variance_ratio_[0]:.1%} variance)")
plt.ylabel(f"PC2 ({pca.explained_variance_ratio_[1]:.1%} variance)")
plt.colorbar(scatter, label="Species")
plt.title("Iris Dataset - PCA")
plt.show()
```

### How Many Components?

```python
pca_full = PCA()
pca_full.fit(X_scaled)

cumulative_variance = np.cumsum(pca_full.explained_variance_ratio_)
print(f"Cumulative variance: {cumulative_variance}")

plt.plot(range(1, len(cumulative_variance) + 1), cumulative_variance, "o-")
plt.axhline(y=0.95, color="r", linestyle="--", label="95% variance")
plt.xlabel("Number of Components")
plt.ylabel("Cumulative Explained Variance")
plt.legend()
plt.title("Scree Plot")
plt.show()

n_95 = np.argmax(cumulative_variance >= 0.95) + 1
print(f"Components for 95% variance: {n_95}")
```

```
  SCREE PLOT
  ==========

  Variance
  Explained
  100% |                    ___________
       |              _____/
   95% |--------- __/____________________  <- keep this many
       |        _/
   80% |      _/
       |    _/
       |  _/
       | /
   0%  +---+---+---+---+---+---+---+---> Component
       1   2   3   4   5   6   7   8
```

### What Do Components Mean?

```python
loadings = pd.DataFrame(
    pca.components_.T,
    columns=["PC1", "PC2"],
    index=iris.feature_names
)
print(loadings.round(3))
```

---

## t-SNE: For Beautiful Visualizations

t-SNE is great at revealing clusters in 2D plots. It focuses on
preserving local neighborhoods -- points that are close in high
dimensions stay close in the plot.

```
  PCA vs t-SNE
  =============

  PCA: Preserves GLOBAL structure (overall shape)
       Good for: feature reduction, preprocessing

  t-SNE: Preserves LOCAL structure (neighborhoods)
         Good for: visualization, cluster discovery

  PCA output:                t-SNE output:
     . .  . .  . .           ...    ...
    . .  . .  . .           ...    ...
   . .  . .  . .                ...
                                ...
  (overlapping)              (separated clusters)
```

```python
from sklearn.manifold import TSNE

tsne = TSNE(n_components=2, perplexity=30, random_state=42)
X_tsne = tsne.fit_transform(X_scaled)

plt.figure(figsize=(10, 7))
scatter = plt.scatter(X_tsne[:, 0], X_tsne[:, 1], c=y, cmap="viridis", s=50)
plt.colorbar(scatter, label="Species")
plt.title("Iris Dataset - t-SNE")
plt.show()
```

### t-SNE Caveats

```
  t-SNE GOTCHAS
  =============

  1. NOT deterministic (different runs = different plots)
     Fix: set random_state

  2. Perplexity matters a LOT
     Low (5-10): tight local clusters
     Medium (30): balanced (default)
     High (50-100): global structure

  3. Distances between clusters are MEANINGLESS
     Only within-cluster structure is preserved

  4. CANNOT transform new data
     fit_transform only, no separate transform

  5. SLOW on large datasets
     Use PCA first to reduce to ~50 dims, then t-SNE
```

---

## UMAP: The Best of Both Worlds

UMAP preserves both local and global structure, is faster than
t-SNE, and can transform new data.

```python
from umap import UMAP

reducer = UMAP(n_components=2, n_neighbors=15, min_dist=0.1, random_state=42)
X_umap = reducer.fit_transform(X_scaled)

plt.figure(figsize=(10, 7))
scatter = plt.scatter(X_umap[:, 0], X_umap[:, 1], c=y, cmap="viridis", s=50)
plt.colorbar(scatter, label="Species")
plt.title("Iris Dataset - UMAP")
plt.show()
```

```
  METHOD COMPARISON
  =================

  Feature        PCA          t-SNE        UMAP
  -------        ---          -----        ----
  Speed          Fast         Slow         Medium
  Scalability    Excellent    Poor         Good
  Global struct  Preserved    Lost         Preserved
  Local struct   OK           Excellent    Excellent
  Deterministic  Yes          No*          No*
  Transform new  Yes          No           Yes
  Use for ML     Yes          Viz only     Yes/Viz

  * With random_state fixed
```

---

## PCA as Preprocessing

```python
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.datasets import load_digits

digits = load_digits()
X_d, y_d = digits.data, digits.target
print(f"Original features: {X_d.shape[1]}")

pipeline = Pipeline([
    ("scaler", StandardScaler()),
    ("pca", PCA(n_components=0.95)),
    ("classifier", RandomForestClassifier(n_estimators=100, random_state=42))
])

scores = cross_val_score(pipeline, X_d, y_d, cv=5)
print(f"With PCA (95% variance): {scores.mean():.3f}")

pipeline_no_pca = Pipeline([
    ("scaler", StandardScaler()),
    ("classifier", RandomForestClassifier(n_estimators=100, random_state=42))
])

scores_no = cross_val_score(pipeline_no_pca, X_d, y_d, cv=5)
print(f"Without PCA: {scores_no.mean():.3f}")
```

---

## Exercises

### Exercise 1: PCA on Digits

```python
from sklearn.datasets import load_digits
digits = load_digits()
X, y = digits.data, digits.target
```

1. How many components capture 95% of variance?
2. Plot the data in 2D using PCA -- can you see digit clusters?
3. Compare classification accuracy with 10, 20, 30 PCA components

### Exercise 2: t-SNE Perplexity Experiment

Using the digits dataset, create t-SNE plots with perplexity
values of 5, 15, 30, 50, and 100. How does the visualization
change? Which perplexity gives the clearest clusters?

### Exercise 3: Method Comparison

On the same dataset, create side-by-side 2D plots using PCA, t-SNE,
and UMAP. Which method best separates the digit classes visually?
Time each method -- which is fastest?

---

[Next: Lesson 12 - Metrics That Matter -->](12-metrics-that-matter.md)
