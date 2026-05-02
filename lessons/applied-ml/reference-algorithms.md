# Reference: Algorithm Comparison

> Quick reference for choosing the right algorithm.
> No algorithm is best for everything -- know the tradeoffs.

---

## Classification Algorithms

```
  ┌──────────────────┬──────┬──────┬────────┬──────────┬───────────────┐
  │ Algorithm        │Speed │Interp│Handles │ Feature  │ Best For      │
  │                  │      │      │Nonlin  │ Scaling  │               │
  ├──────────────────┼──────┼──────┼────────┼──────────┼───────────────┤
  │ Logistic Reg.    │Fast  │High  │No      │Required  │Baseline,      │
  │                  │      │      │        │          │linear problems│
  ├──────────────────┼──────┼──────┼────────┼──────────┼───────────────┤
  │ Decision Tree    │Fast  │High  │Yes     │Not needed│Explainability │
  ├──────────────────┼──────┼──────┼────────┼──────────┼───────────────┤
  │ Random Forest    │Med   │Med   │Yes     │Not needed│General purpose│
  │                  │      │      │        │          │robust default │
  ├──────────────────┼──────┼──────┼────────┼──────────┼───────────────┤
  │ XGBoost/LightGBM │Med   │Low   │Yes     │Not needed│Tabular data   │
  │                  │      │      │        │          │competitions   │
  ├──────────────────┼──────┼──────┼────────┼──────────┼───────────────┤
  │ SVM              │Slow  │Low   │Yes     │Required  │Small datasets │
  │                  │      │      │(kernel)│          │high dimensions│
  ├──────────────────┼──────┼──────┼────────┼──────────┼───────────────┤
  │ KNN              │Fast* │Med   │Yes     │Required  │Prototyping    │
  │                  │      │      │        │          │small data     │
  ├──────────────────┼──────┼──────┼────────┼──────────┼───────────────┤
  │ Naive Bayes      │Fast  │High  │No      │Not needed│Text, baseline │
  ├──────────────────┼──────┼──────┼────────┼──────────┼───────────────┤
  │ Neural Network   │Slow  │Low   │Yes     │Required  │Complex data   │
  │                  │      │      │        │          │images, text   │
  └──────────────────┴──────┴──────┴────────┴──────────┴───────────────┘

  * KNN: fast to train, slow to predict
```

---

## Regression Algorithms

```
  ┌──────────────────┬──────┬──────┬────────┬───────────────────┐
  │ Algorithm        │Speed │Interp│Nonlin  │ Best For          │
  ├──────────────────┼──────┼──────┼────────┼───────────────────┤
  │ Linear Reg.      │Fast  │High  │No      │Baseline, simple   │
  ├──────────────────┼──────┼──────┼────────┼───────────────────┤
  │ Ridge/Lasso      │Fast  │High  │No      │Regularized linear │
  ├──────────────────┼──────┼──────┼────────┼───────────────────┤
  │ ElasticNet       │Fast  │High  │No      │Feature selection   │
  ├──────────────────┼──────┼──────┼────────┼───────────────────┤
  │ Decision Tree    │Fast  │High  │Yes     │Explainability     │
  ├──────────────────┼──────┼──────┼────────┼───────────────────┤
  │ Random Forest    │Med   │Med   │Yes     │General purpose    │
  ├──────────────────┼──────┼──────┼────────┼───────────────────┤
  │ XGBoost/LightGBM │Med   │Low   │Yes     │Best performance   │
  ├──────────────────┼──────┼──────┼────────┼───────────────────┤
  │ SVR              │Slow  │Low   │Yes     │Small datasets     │
  ├──────────────────┼──────┼──────┼────────┼───────────────────┤
  │ Neural Network   │Slow  │Low   │Yes     │Complex patterns   │
  └──────────────────┴──────┴──────┴────────┴───────────────────┘
```

---

## Clustering Algorithms

```
  ┌──────────────────┬──────────┬──────────┬──────────────────────┐
  │ Algorithm        │ Needs K? │ Shape    │ Best For             │
  ├──────────────────┼──────────┼──────────┼──────────────────────┤
  │ K-Means          │ Yes      │ Spherical│ General purpose      │
  │                  │          │          │ large datasets       │
  ├──────────────────┼──────────┼──────────┼──────────────────────┤
  │ DBSCAN           │ No       │ Arbitrary│ Noisy data, unknown  │
  │                  │          │          │ number of clusters   │
  ├──────────────────┼──────────┼──────────┼──────────────────────┤
  │ Hierarchical     │ No*      │ Arbitrary│ Small data,          │
  │                  │          │          │ dendrogram wanted    │
  ├──────────────────┼──────────┼──────────┼──────────────────────┤
  │ Gaussian Mixture │ Yes      │ Elliptical│ Soft clustering      │
  │                  │          │          │ probabilistic        │
  ├──────────────────┼──────────┼──────────┼──────────────────────┤
  │ HDBSCAN          │ No       │ Arbitrary│ Varying density      │
  │                  │          │          │ clusters             │
  └──────────────────┴──────────┴──────────┴──────────────────────┘

  * Can cut dendrogram at any level
```

---

## Dimensionality Reduction

```
  ┌──────────────────┬──────────┬──────────┬──────────────────────┐
  │ Algorithm        │ Linear?  │ Speed    │ Best For             │
  ├──────────────────┼──────────┼──────────┼──────────────────────┤
  │ PCA              │ Yes      │ Fast     │ Feature reduction    │
  │                  │          │          │ preprocessing        │
  ├──────────────────┼──────────┼──────────┼──────────────────────┤
  │ t-SNE            │ No       │ Slow     │ 2D/3D visualization  │
  │                  │          │          │ cluster exploration  │
  ├──────────────────┼──────────┼──────────┼──────────────────────┤
  │ UMAP             │ No       │ Medium   │ Visualization +      │
  │                  │          │          │ downstream tasks     │
  ├──────────────────┼──────────┼──────────┼──────────────────────┤
  │ LDA              │ Yes      │ Fast     │ Supervised dimension │
  │                  │          │          │ reduction            │
  └──────────────────┴──────────┴──────────┴──────────────────────┘
```

---

## Algorithm Selection Flowchart

```
  What type of problem?
  │
  ├── CLASSIFICATION
  │   ├── Need explainability? -> Logistic Reg / Decision Tree
  │   ├── Tabular data?       -> XGBoost / LightGBM
  │   ├── Image data?         -> CNN (ResNet, EfficientNet)
  │   ├── Text data?          -> Transformers (BERT, etc.)
  │   └── Small dataset?      -> SVM / Random Forest
  │
  ├── REGRESSION
  │   ├── Linear relationship? -> Linear / Ridge / Lasso
  │   ├── Tabular data?       -> XGBoost / LightGBM
  │   └── Complex patterns?   -> Neural Network
  │
  ├── CLUSTERING
  │   ├── Know num clusters?  -> K-Means / GMM
  │   ├── Unknown clusters?   -> DBSCAN / HDBSCAN
  │   └── Need hierarchy?     -> Hierarchical
  │
  ├── TIME SERIES
  │   ├── Single series?      -> ARIMA / Prophet
  │   ├── Many features?      -> XGBoost with lags
  │   └── Multiple series?    -> Transformer / LSTM
  │
  └── RECOMMENDATION
      ├── Have ratings?       -> Matrix Factorization / SVD
      ├── Have item features? -> Content-Based
      └── Both?               -> Hybrid approach
```

---

## Computational Complexity

```
  ┌──────────────────┬────────────┬────────────┬─────────────┐
  │ Algorithm        │ Train      │ Predict    │ Memory      │
  ├──────────────────┼────────────┼────────────┼─────────────┤
  │ Linear Reg.      │ O(np^2)    │ O(p)       │ O(p)        │
  │ Logistic Reg.    │ O(npi)     │ O(p)       │ O(p)        │
  │ Decision Tree    │ O(np log n)│ O(log n)   │ O(nodes)    │
  │ Random Forest    │ O(tnp logn)│ O(t log n) │ O(t*nodes)  │
  │ XGBoost          │ O(tnp logn)│ O(t log n) │ O(t*nodes)  │
  │ SVM              │ O(n^2 p)   │ O(sv * p)  │ O(sv * p)   │
  │ KNN              │ O(1)       │ O(np)      │ O(np)       │
  │ K-Means          │ O(nki)     │ O(kp)      │ O(kp)       │
  └──────────────────┴────────────┴────────────┴─────────────┘

  n = samples, p = features, t = trees, k = clusters
  i = iterations, sv = support vectors
```

---

## Hyperparameter Cheat Sheet

```
  RANDOM FOREST
  n_estimators: 100-500      (more = better, slower)
  max_depth: 5-20 or None    (deeper = more complex)
  min_samples_split: 2-10    (higher = more regularized)
  min_samples_leaf: 1-5      (higher = more regularized)

  XGBOOST / LIGHTGBM
  n_estimators: 100-1000     (with early stopping)
  learning_rate: 0.01-0.3    (lower = slower, needs more trees)
  max_depth: 3-10            (3-6 usually enough)
  subsample: 0.5-1.0         (regularization)
  colsample_bytree: 0.5-1.0  (regularization)
  reg_alpha (L1): 0-10       (sparse features)
  reg_lambda (L2): 0-10      (reduce overfitting)

  SVM
  C: 0.01-100                (regularization strength)
  kernel: rbf, linear, poly  (nonlinearity)
  gamma: scale, auto, float  (kernel bandwidth)

  LOGISTIC REGRESSION
  C: 0.01-100                (inverse regularization)
  penalty: l1, l2, elasticnet
  solver: lbfgs, saga        (depends on penalty)
```
