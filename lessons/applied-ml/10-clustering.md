# Lesson 10: Clustering

## Sorting Party Guests into Groups

You are hosting a big party. You do not have assigned seating, but
you notice guests naturally form groups: the sports fans cluster
around the TV, the foodies gather near the kitchen, and the
bookworms find the quiet corner.

Clustering does exactly this -- it finds natural groupings in data
without being told what the groups are.

```
  SUPERVISED vs UNSUPERVISED
  ==========================

  Supervised (Classification):
  "Here are cats and dogs. Learn the difference."
  Labels given: Cat, Dog, Cat, Dog...

  Unsupervised (Clustering):
  "Here are animals. Find natural groups."
  No labels. Algorithm discovers structure.

  +-------+     +-------+     +-------+
  |  . .  |     | x x   |     |  o o  |
  | . . . |     |  x x  |     | o o o |
  |  . .  |     | x x   |     |  o o  |
  +-------+     +-------+     +-------+
  Group A       Group B       Group C
```

---

## K-Means: The Workhorse

### How It Works

```
  K-MEANS ALGORITHM
  =================

  Step 1: Pick K random center points

      *           .  .
                 . .
     .  .  .        *
      .  .

  Step 2: Assign each point to nearest center

      *           B  B
     A A         B B
     A  A  A        *
      A  A

  Step 3: Move centers to mean of their cluster

          *       B  B
     A A         B B
     A  A  A      *
      A  A

  Step 4: Repeat steps 2-3 until centers stop moving

       *          B  B
     A A         B B
     A  A  A    *
      A  A

  Converged! Centers are stable.
```

### K-Means in Practice

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.datasets import make_blobs

X, y_true = make_blobs(
    n_samples=300, centers=4, cluster_std=0.8, random_state=42
)

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
labels = kmeans.fit_predict(X_scaled)

print(f"Cluster sizes: {np.bincount(labels)}")
print(f"Inertia: {kmeans.inertia_:.2f}")
print(f"Centroids:\n{kmeans.cluster_centers_}")

plt.scatter(X_scaled[:, 0], X_scaled[:, 1], c=labels, cmap="viridis", s=20)
plt.scatter(kmeans.cluster_centers_[:, 0], kmeans.cluster_centers_[:, 1],
            c="red", marker="X", s=200, edgecolors="black")
plt.title("K-Means Clustering")
plt.show()
```

### Choosing K: The Elbow Method

```python
inertias = []
k_range = range(2, 11)

for k in k_range:
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    km.fit(X_scaled)
    inertias.append(km.inertia_)

plt.plot(k_range, inertias, "o-")
plt.xlabel("K (number of clusters)")
plt.ylabel("Inertia (within-cluster sum of squares)")
plt.title("Elbow Method")
plt.show()
```

```
  THE ELBOW METHOD
  ================

  Inertia
  |
  |\
  | \
  |  \
  |   \___
  |       \____
  |            \___________
  +---+---+---+---+---+---> K
      2   3   4   5   6

  The "elbow" is at K=4 (where curve bends sharply)
  Adding more clusters after this gives diminishing returns
```

### Silhouette Score

```python
from sklearn.metrics import silhouette_score

for k in range(2, 8):
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(X_scaled)
    score = silhouette_score(X_scaled, labels)
    print(f"K={k}: Silhouette = {score:.3f}")
```

```
  SILHOUETTE SCORE
  ================

  Range: -1 to +1

  +1.0  Perfect separation
  +0.5  Good clusters
   0.0  Overlapping clusters
  -0.5  Points in wrong cluster
  -1.0  Completely wrong
```

---

## DBSCAN: Density-Based Clustering

K-Means assumes round clusters. DBSCAN finds clusters of any shape
by looking at point density -- like finding crowds in a city by
looking at where people gather.

```
  K-MEANS vs DBSCAN
  ==================

  K-Means only finds round:     DBSCAN finds any shape:

    ....        ....              .....
   ......      ......            .......
    ....        ....              .....
                                  ....  ....
                                       ......
                                        ....

  K-Means needs K in advance     DBSCAN finds K automatically
  Can't handle noise             Labels noise as -1
  Spherical clusters only        Arbitrary shapes
```

### DBSCAN in Practice

```python
from sklearn.cluster import DBSCAN
from sklearn.datasets import make_moons

X_moons, y_moons = make_moons(n_samples=300, noise=0.1, random_state=42)

dbscan = DBSCAN(eps=0.2, min_samples=5)
labels = dbscan.fit_predict(X_moons)

n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
n_noise = list(labels).count(-1)
print(f"Clusters: {n_clusters}")
print(f"Noise points: {n_noise}")

plt.scatter(X_moons[:, 0], X_moons[:, 1], c=labels, cmap="viridis", s=20)
plt.title(f"DBSCAN: {n_clusters} clusters, {n_noise} noise")
plt.show()
```

```
  DBSCAN PARAMETERS
  =================

  eps (epsilon): Maximum distance between neighbors
  min_samples:   Minimum points to form a dense region

  eps too small  -> Everything is noise
  eps too large  -> Everything is one cluster
  min_samples    -> Higher = stricter density requirement

  DBSCAN POINT TYPES
  ===================

  Core point:    Has >= min_samples neighbors within eps
                 (Center of a crowd)

  Border point:  Within eps of a core point but not core itself
                 (Edge of a crowd)

  Noise point:   Not core and not border
                 (Person standing alone)
```

---

## Hierarchical Clustering

Build a tree of clusters by merging or splitting. Like an
organizational chart -- you can cut it at any level.

```
  DENDROGRAM
  ==========

  Height
  (distance)
    |         _____________
    |        |             |
    |     ___|___       ___|___
    |    |       |     |       |
    |  __|__   __|__ __|__   __|__
    | |     | |    | |    | |     |
    | A     B C    D E    F G     H

  Cut here -------- for 2 clusters: {A,B,C,D} {E,F,G,H}
  Cut here ---- for 4 clusters: {A,B} {C,D} {E,F} {G,H}
```

```python
from sklearn.cluster import AgglomerativeClustering
from scipy.cluster.hierarchy import dendrogram, linkage

linkage_matrix = linkage(X_scaled, method="ward")

plt.figure(figsize=(12, 6))
dendrogram(linkage_matrix, truncate_mode="level", p=5)
plt.title("Hierarchical Clustering Dendrogram")
plt.xlabel("Sample index")
plt.ylabel("Distance")
plt.show()

hc = AgglomerativeClustering(n_clusters=4)
labels_hc = hc.fit_predict(X_scaled)
print(f"Cluster sizes: {np.bincount(labels_hc)}")
```

---

## Choosing the Right Algorithm

```
  ALGORITHM SELECTOR
  ==================

  Know number of clusters?
    Yes --> Data is large?
              Yes --> K-Means (fast, scalable)
              No  --> Hierarchical (see dendrogram)
    No  --> Clusters have weird shapes?
              Yes --> DBSCAN
              No  --> Try K-Means with elbow/silhouette

  ALGORITHM COMPARISON
  ====================

  Feature          K-Means    DBSCAN     Hierarchical
  -------          -------    ------     ------------
  Needs K          Yes        No         Optional
  Cluster shapes   Spherical  Any shape  Any shape
  Handles noise    No         Yes        No
  Scalability      Excellent  Good       Poor (large)
  Deterministic    No*        Yes        Yes

  * K-Means depends on initialization
```

---

## Real-World Example: Customer Segmentation

```python
from sklearn.datasets import make_blobs

np.random.seed(42)
n = 500
customers = pd.DataFrame({
    "annual_spend": np.concatenate([
        np.random.normal(200, 50, n//3),
        np.random.normal(500, 80, n//3),
        np.random.normal(1000, 150, n - 2*(n//3))
    ]),
    "visit_frequency": np.concatenate([
        np.random.normal(2, 1, n//3),
        np.random.normal(8, 2, n//3),
        np.random.normal(15, 3, n - 2*(n//3))
    ])
})

scaler = StandardScaler()
X_customers = scaler.fit_transform(customers)

kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
customers["segment"] = kmeans.fit_predict(X_customers)

segment_summary = customers.groupby("segment").agg(
    avg_spend=("annual_spend", "mean"),
    avg_visits=("visit_frequency", "mean"),
    count=("annual_spend", "count")
).round(2)
print(segment_summary)
```

---

## Exercises

### Exercise 1: K-Means on Iris

```python
from sklearn.datasets import load_iris
iris = load_iris()
X = iris.data
```

1. Apply K-Means with K=3 (we know there are 3 species)
2. Compare cluster labels to true labels using `adjusted_rand_score`
3. Try K=2 and K=5. How does the silhouette score change?
4. Plot the elbow curve for K=1 to K=10

### Exercise 2: DBSCAN Tuning

Generate the moons dataset and find optimal DBSCAN parameters:

```python
from sklearn.datasets import make_moons
X, y = make_moons(n_samples=500, noise=0.15, random_state=42)
```

Try eps values [0.1, 0.2, 0.3, 0.5] and min_samples [3, 5, 10].
Which combination correctly finds the two crescent shapes?

### Exercise 3: Customer Segmentation

Using the Mall Customers dataset (or generate similar data), perform
full customer segmentation:
1. Scale the features
2. Find optimal K using elbow and silhouette methods
3. Profile each segment (what makes them distinct)
4. Name each segment based on its characteristics

---

[Next: Lesson 11 - Dimensionality Reduction -->](11-dimensionality-reduction.md)
