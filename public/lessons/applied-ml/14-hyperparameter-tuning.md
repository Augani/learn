# Lesson 14: Hyperparameter Tuning

## Finding the Perfect Recipe

A chef does not just throw random amounts of spices into a dish.
They systematically adjust -- more salt, less pepper, a touch more
garlic -- tasting after each adjustment until the dish is perfect.

Hyperparameter tuning is the same process. You systematically adjust
the knobs of your algorithm until performance peaks.

```
  PARAMETERS vs HYPERPARAMETERS
  =============================

  Parameters (learned from data):
  - Model weights
  - Tree split thresholds
  - SVM support vectors
  -> The algorithm figures these out

  Hyperparameters (set by YOU):
  - Learning rate
  - Number of trees
  - Max depth
  - Regularization strength
  -> You must choose these before training
```

---

## Grid Search: Try Every Combination

Like a chef who systematically tries every combination of salt
(low/medium/high) and pepper (low/medium/high).

```
  GRID SEARCH VISUALIZATION
  =========================

  learning_rate
  0.1   |  [82%]  [84%]  [83%]
  0.05  |  [83%]  [86%]  [85%]   <- best!
  0.01  |  [80%]  [82%]  [81%]
        +--------+-------+------
           100     200     500    n_estimators

  Tries ALL 9 combinations (3 x 3 = 9)
```

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split

df = pd.read_csv(
    "https://raw.githubusercontent.com/datasciencedojo/"
    "datasets/master/titanic.csv"
)

df["Sex_encoded"] = (df["Sex"] == "male").astype(int)
df["Age"] = df["Age"].fillna(df["Age"].median())

features = ["Pclass", "Sex_encoded", "Age", "SibSp", "Parch", "Fare"]
X = df[features]
y = df["Survived"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

param_grid = {
    "n_estimators": [50, 100, 200],
    "max_depth": [3, 5, 7, 10],
    "min_samples_split": [2, 5, 10],
    "min_samples_leaf": [1, 2, 5]
}

total_combinations = 3 * 4 * 3 * 3
print(f"Total combinations: {total_combinations}")
print(f"Total fits (with 5-fold CV): {total_combinations * 5}")

grid_search = GridSearchCV(
    RandomForestClassifier(random_state=42),
    param_grid,
    cv=5,
    scoring="accuracy",
    n_jobs=-1,
    verbose=0
)

grid_search.fit(X_train, y_train)

print(f"Best params: {grid_search.best_params_}")
print(f"Best CV score: {grid_search.best_score_:.3f}")
print(f"Test score: {grid_search.best_estimator_.score(X_test, y_test):.3f}")
```

---

## Random Search: Smarter Sampling

Grid search is exhaustive but wasteful. Research shows that random
search finds good hyperparameters faster because it covers more of
the important dimensions.

```
  GRID SEARCH vs RANDOM SEARCH
  ============================

  Grid (9 points):               Random (9 points):
  +---+---+---+                  +-------+-------+
  | x | x | x |                  |  x    |     x |
  +---+---+---+                  |    x  |  x    |
  | x | x | x |                  | x     |    x  |
  +---+---+---+                  |     x |       |
  | x | x | x |                  |  x    |   x   |
  +---+---+---+                  +-------+-------+

  Grid tests 3 values per param   Random tests 9 different values
  If only 1 param matters,         per param. Better coverage of
  you only tested 3 values.        the important dimension.
```

```python
from scipy.stats import uniform, randint

param_distributions = {
    "n_estimators": randint(50, 500),
    "max_depth": randint(3, 15),
    "min_samples_split": randint(2, 20),
    "min_samples_leaf": randint(1, 10),
    "max_features": uniform(0.3, 0.7)
}

random_search = RandomizedSearchCV(
    RandomForestClassifier(random_state=42),
    param_distributions,
    n_iter=100,
    cv=5,
    scoring="accuracy",
    n_jobs=-1,
    random_state=42
)

random_search.fit(X_train, y_train)

print(f"Best params: {random_search.best_params_}")
print(f"Best CV score: {random_search.best_score_:.3f}")
print(f"Test score: {random_search.best_estimator_.score(X_test, y_test):.3f}")
```

---

## Bayesian Optimization: Learn as You Search

Instead of blind search, Bayesian optimization builds a model of
which hyperparameters are promising and focuses exploration there.
Like a chef who learns from each tasting -- if more garlic helped
last time, try even more garlic next.

```
  BAYESIAN OPTIMIZATION
  =====================

  Step 1: Try a few random points
  Step 2: Build a model of "score = f(hyperparams)"
  Step 3: Find the most promising region
  Step 4: Sample there
  Step 5: Update the model, repeat

  Iteration 1:  Try random points (explore)
  Iteration 5:  Starting to focus on good region
  Iteration 20: Zeroing in on optimum
  Iteration 50: Fine-tuning around the best

  Compared to random search:
  Random:   o  o  o  o  o  o  o  o  o  o  (scattered)
  Bayesian: o  o    o    ooo   oooo        (focused)
```

```python
from sklearn.model_selection import cross_val_score

try:
    from skopt import BayesSearchCV
    from skopt.space import Integer, Real

    bayes_search = BayesSearchCV(
        RandomForestClassifier(random_state=42),
        {
            "n_estimators": Integer(50, 500),
            "max_depth": Integer(3, 15),
            "min_samples_split": Integer(2, 20),
            "min_samples_leaf": Integer(1, 10),
            "max_features": Real(0.3, 1.0)
        },
        n_iter=50,
        cv=5,
        scoring="accuracy",
        n_jobs=-1,
        random_state=42
    )

    bayes_search.fit(X_train, y_train)
    print(f"Best params: {bayes_search.best_params_}")
    print(f"Best CV score: {bayes_search.best_score_:.3f}")
except ImportError:
    print("Install scikit-optimize: pip install scikit-optimize")
```

### Optuna (Modern Alternative)

```python
try:
    import optuna
    optuna.logging.set_verbosity(optuna.logging.WARNING)

    def objective(trial):
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 50, 500),
            "max_depth": trial.suggest_int("max_depth", 3, 15),
            "min_samples_split": trial.suggest_int("min_samples_split", 2, 20),
            "min_samples_leaf": trial.suggest_int("min_samples_leaf", 1, 10),
            "max_features": trial.suggest_float("max_features", 0.3, 1.0),
        }

        model = RandomForestClassifier(**params, random_state=42)
        scores = cross_val_score(model, X_train, y_train, cv=5, scoring="accuracy")
        return scores.mean()

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=50)

    print(f"Best params: {study.best_params}")
    print(f"Best CV score: {study.best_value:.3f}")
except ImportError:
    print("Install optuna: pip install optuna")
```

---

## Comparing Search Strategies

```
  SEARCH STRATEGY COMPARISON
  ==========================

  Method        Trials   Speed     Quality   When to Use
  ------        ------   -----     -------   -----------
  Grid          All      Slow      OK        Few params, small grid
  Random        N        Fast      Good      General purpose
  Bayesian      N        Medium    Best      Expensive models
  Optuna        N        Medium    Best      Complex search spaces

  EFFICIENCY (for same compute budget)
  ====================================

  Grid:     [################]  100 trials, tests everything
  Random:   [########--------]  50 trials, 90% as good
  Bayesian: [####------------]  25 trials, 95% as good
```

---

## Analyzing Search Results

```python
results = pd.DataFrame(random_search.cv_results_)
results = results.sort_values("rank_test_score")

print(results[["params", "mean_test_score", "std_test_score",
               "rank_test_score"]].head(10))

import matplotlib.pyplot as plt

for param in ["param_max_depth", "param_n_estimators"]:
    plt.figure(figsize=(8, 5))
    plt.scatter(results[param], results["mean_test_score"], alpha=0.5)
    plt.xlabel(param.replace("param_", ""))
    plt.ylabel("CV Score")
    plt.title(f"Score vs {param.replace('param_', '')}")
    plt.show()
```

---

## Practical Tuning Strategy

```
  STEP-BY-STEP TUNING APPROACH
  ============================

  Step 1: Establish a baseline
          -> Default hyperparameters, measure CV score

  Step 2: Coarse random search (50-100 trials)
          -> Wide ranges, find the right ballpark

  Step 3: Fine grid search around best region
          -> Narrow ranges, find the optimum

  Step 4: Evaluate final model on held-out test set
          -> Only look at test set ONCE at the end

  BUDGET ALLOCATION
  =================

  Compute Budget    Strategy
  1 minute          Random search, 20 trials
  10 minutes        Random search, 100 trials
  1 hour            Bayesian optimization, 200 trials
  1 day             Bayesian + ensemble of top configs
```

```python
from sklearn.model_selection import StratifiedKFold

coarse_params = {
    "n_estimators": randint(50, 500),
    "max_depth": randint(2, 20),
    "min_samples_split": randint(2, 30),
    "learning_rate": uniform(0.01, 0.29),
    "subsample": uniform(0.5, 0.5)
}

coarse_search = RandomizedSearchCV(
    GradientBoostingClassifier(random_state=42),
    coarse_params,
    n_iter=50,
    cv=StratifiedKFold(5, shuffle=True, random_state=42),
    scoring="accuracy",
    n_jobs=-1,
    random_state=42
)
coarse_search.fit(X_train, y_train)

best = coarse_search.best_params_
print(f"Coarse best: {best}")

fine_params = {
    "n_estimators": [best["n_estimators"] - 50,
                     best["n_estimators"],
                     best["n_estimators"] + 50],
    "max_depth": [max(1, best["max_depth"] - 1),
                  best["max_depth"],
                  best["max_depth"] + 1],
    "learning_rate": [best["learning_rate"] * 0.5,
                      best["learning_rate"],
                      best["learning_rate"] * 1.5],
    "subsample": [max(0.5, best["subsample"] - 0.1),
                  best["subsample"],
                  min(1.0, best["subsample"] + 0.1)]
}

fine_search = GridSearchCV(
    GradientBoostingClassifier(random_state=42),
    fine_params,
    cv=5,
    scoring="accuracy",
    n_jobs=-1
)
fine_search.fit(X_train, y_train)
print(f"Fine best: {fine_search.best_params_}")
print(f"Fine CV: {fine_search.best_score_:.3f}")
print(f"Test: {fine_search.best_estimator_.score(X_test, y_test):.3f}")
```

---

## Exercises

### Exercise 1: Grid vs Random

Tune a RandomForest on Titanic data using both GridSearchCV and
RandomizedSearchCV with the same compute budget (same total number
of fits). Which finds better hyperparameters?

### Exercise 2: Optuna Deep Dive

Use Optuna to tune an XGBoost model on California Housing with at
least 8 hyperparameters. Use `study.trials_dataframe()` to analyze
which hyperparameters mattered most.

### Exercise 3: Full Tuning Pipeline

Implement the 3-step tuning strategy (baseline, coarse random, fine
grid) on a GradientBoosting model. Track improvement at each step.
How much did tuning improve over the default?

---

[Next: Lesson 15 - Bias, Fairness & Interpretability -->](15-bias-fairness-interpretability.md)
