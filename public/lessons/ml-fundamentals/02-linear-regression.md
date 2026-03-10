# Lesson 02: Linear Regression — Your First Model

Linear regression draws the best straight line through your data.
That is the entire algorithm. Everything else is details about what
"best" means and how to find it.

---

## The Core Idea

You have data points scattered on a chart. You want a line that
captures the general trend.

```
Price ($k)
    500 │                          .
        │                     .
    400 │                .  .
        │           .  .
    300 │        .  .
        │     .
    200 │  .  .
        │.
    100 │
        └──────────────────────────── sqft
        800   1200   1600   2000   2400

Question: what line best fits these points?
```

The equation of a line: `y = mx + b`

```
y = mx + b

y  →  what we are predicting (price)
x  →  our input feature (square footage)
m  →  slope (how much price increases per sqft)
b  →  intercept (price when sqft = 0, a baseline)

In ML terminology:
y = w * x + b

w  →  weight (same as slope)
b  →  bias (same as intercept)
```

```
Slope = how steep the line is:

    High slope (m=3):        Low slope (m=0.5):       Negative slope (m=-1):

    y │        /             y │          .──          y │\
      │      /                 │      .──                │ \
      │    /                   │  .──                    │  \
      │  /                     │──                       │   \
      │/                       │                         │    \
      └────── x                └────── x                 └────── x

    "Price rises fast        "Price rises slowly       "Price drops as
     with square footage"     with square footage"      square footage rises"
```

---

## What "Fitting" Means

"Fitting" a model means finding the values of `w` and `b` that make
the line match the data as closely as possible.

```
Bad fit (wrong w and b):         Good fit (right w and b):

Price │        .                 Price │            .
      │  ──────────── line             │         ./
      │     .   .                      │      ./  .
      │   .                            │   ./ .
      │ .   .                          │ ./.
      └────────────── sqft             └────────────── sqft

The line is far from the points.  The line passes through the trend.
Large errors.                     Small errors.
```

How do we measure "how wrong" the line is? We need a number that
captures the total error.

---

## The Loss Function: How Wrong Are We?

For each data point, the error is the distance between the actual
value and what our line predicts:

```
error = actual - predicted
      = y - (w * x + b)

    Price │
          │     . ← actual price ($350k)
          │     |
          │     | ← error (the gap)
          │     |
          │─────x──── predicted by line ($310k)
          │
          └──────────── sqft

error = 350,000 - 310,000 = 40,000
```

But some errors are positive (line too low) and some are negative
(line too high). If we just add them up, they cancel out.

Solution: **square the errors**. Squaring makes everything positive
and penalizes big errors more than small ones.

### Mean Squared Error (MSE)

```
         1   n
MSE  =   ─   Σ  (yᵢ - ŷᵢ)²
         n  i=1

In words:
1. For each point: compute (actual - predicted)
2. Square it
3. Average all the squared errors
```

```
Example with 4 data points:

Actual:     [200,  300,  350,  400]   (thousands)
Predicted:  [210,  280,  360,  390]

Errors:     [-10,   20,  -10,   10]
Squared:    [100,  400,  100,  100]
Mean:       (100 + 400 + 100 + 100) / 4 = 175

MSE = 175 (in units of thousands-squared)
```

```python
import numpy as np

actual = np.array([200, 300, 350, 400])
predicted = np.array([210, 280, 360, 390])

errors = actual - predicted
squared_errors = errors ** 2
mse = np.mean(squared_errors)
print(f"MSE: {mse}")  # 175.0
```

**Why squared and not absolute value?**
- Squaring punishes large errors disproportionately (an error of 10 costs 100, an error of 20 costs 400)
- Squaring is differentiable everywhere (important for gradient descent in the next lesson)
- Squaring has a smooth minimum (absolute value has a sharp corner)

---

## Implementing Linear Regression From Scratch

Let us build the entire thing with just numpy.

### Step 1: Generate Some Data

```python
import numpy as np

np.random.seed(42)

sqft = np.linspace(800, 2800, 50)
noise = np.random.randn(50) * 30
prices = 0.15 * sqft + 50 + noise

print(f"Data: {len(sqft)} houses")
print(f"Sqft range: {sqft.min():.0f} - {sqft.max():.0f}")
print(f"Price range: ${prices.min()*1000:,.0f} - ${prices.max()*1000:,.0f}")
```

### Step 2: Find the Best Line (Closed-Form Solution)

For simple linear regression with one feature, there is an exact formula.
No iterating, no guessing. Just algebra.

```
The normal equation:

         Σ (xᵢ - x̄)(yᵢ - ȳ)
w   =   ─────────────────────
         Σ (xᵢ - x̄)²

b   =   ȳ - w * x̄

Where x̄ is the mean of x, ȳ is the mean of y.
```

```python
x_mean = np.mean(sqft)
y_mean = np.mean(prices)

numerator = np.sum((sqft - x_mean) * (prices - y_mean))
denominator = np.sum((sqft - x_mean) ** 2)

w = numerator / denominator
b = y_mean - w * x_mean

print(f"Weight (slope): {w:.4f}")
print(f"Bias (intercept): {b:.2f}")
print(f"Interpretation: each extra sqft adds ${w*1000:.0f} to the price")
```

### Step 3: Make Predictions

```python
predictions = w * sqft + b

mse = np.mean((prices - predictions) ** 2)
rmse = np.sqrt(mse)
print(f"MSE: {mse:.2f}")
print(f"RMSE: {rmse:.2f} (in same units as price)")
print(f"Average error: ~${rmse * 1000:,.0f}")
```

### Step 4: Visualize

```python
import matplotlib.pyplot as plt

plt.figure(figsize=(10, 6))
plt.scatter(sqft, prices, alpha=0.6, label="Actual data")
plt.plot(sqft, predictions, color="red", linewidth=2, label=f"y = {w:.4f}x + {b:.2f}")
plt.xlabel("Square Footage")
plt.ylabel("Price ($k)")
plt.title("House Price vs Square Footage")
plt.legend()
plt.grid(True, alpha=0.3)
plt.savefig("linear_regression.png", dpi=100, bbox_inches="tight")
plt.show()
```

```
What the plot looks like (ASCII approximation):

Price ($k)
    500 │                      . .  ──── Best fit line
        │                 .  ./
    400 │            .  ./ .
        │         . / .
    300 │      . /. .
        │    ./. .
    200 │  /. .
        │/ .
    100 │
        └──────────────────────────── sqft
        800   1200   1600   2000   2400   2800
```

---

## Multiple Features: More Than One Input

Real models use many features, not just one. The equation extends naturally:

```
One feature:    y = w₁x₁ + b
Two features:   y = w₁x₁ + w₂x₂ + b
n features:     y = w₁x₁ + w₂x₂ + ... + wₙxₙ + b

Or in vector form: y = w · x + b  (dot product!)
```

```
Example: predicting house price with 3 features

price = w₁ * sqft + w₂ * bedrooms + w₃ * age + b

      ┌──────┐    ┌──────────────────┐
      │ w₁   │    │     sqft         │
      │ w₂   │  · │     bedrooms     │  + b  =  predicted price
      │ w₃   │    │     age          │
      └──────┘    └──────────────────┘
      weights     features               bias
```

```python
X = np.array([
    [1400, 3, 20],
    [1800, 4,  5],
    [1200, 2, 35],
    [2200, 5, 10],
    [1600, 3, 15],
    [2000, 4,  8],
    [1000, 2, 40],
    [2400, 5,  3],
])
y = np.array([250, 350, 180, 420, 300, 380, 160, 460])

X_with_bias = np.column_stack([X, np.ones(len(X))])

weights = np.linalg.lstsq(X_with_bias, y, rcond=None)[0]

w = weights[:-1]
b = weights[-1]

print(f"Weight for sqft:     {w[0]:.4f} (${w[0]*1000:.0f} per sqft)")
print(f"Weight for bedrooms: {w[1]:.4f} (${w[1]*1000:,.0f} per bedroom)")
print(f"Weight for age:      {w[2]:.4f} (${w[2]*1000:,.0f} per year)")
print(f"Bias:                {b:.2f}")

predictions = X_with_bias @ weights
mse = np.mean((y - predictions) ** 2)
print(f"\nMSE: {mse:.2f}")
```

```
What np.linalg.lstsq does:

It solves the "normal equation" — the generalization of the
closed-form solution to multiple features.

Instead of finding the best line, it finds the best
hyperplane (a flat surface in higher dimensions).

Think of it like this:
- 1 feature: best line through points in 2D
- 2 features: best plane through points in 3D
- n features: best hyperplane through points in (n+1)D
```

---

## Feature Scaling: Why It Matters

When features have very different scales, the model struggles.

```
Without scaling:

sqft:     [800, 1000, 1200, ..., 2800]     range: 2000
bedrooms: [1, 2, 3, 4, 5]                  range: 4

The sqft values dominate because they are so much larger.
A change of 1 in bedrooms has the same magnitude as a change of 1 in sqft,
but a bedroom is worth WAY more than 1 square foot.
```

**Normalization** rescales features to a common range:

```python
def normalize(X):
    means = np.mean(X, axis=0)
    stds = np.std(X, axis=0)
    return (X - means) / stds, means, stds

X_normalized, means, stds = normalize(X)
```

```
After normalization:

sqft:     [-1.5, -0.9, -0.3, ..., 1.5]    range: ~3
bedrooms: [-1.5, -0.5,  0.5,  1.5]        range: ~3

Now both features contribute equally.
The weights tell you the TRUE importance of each feature.
```

---

## Evaluating Your Model

### R-squared (R2): How Much Variance Does the Model Explain?

```
R² = 1 - (sum of squared errors / sum of squared deviations from mean)

R² = 1 means perfect fit (all variance explained)
R² = 0 means the model is no better than just predicting the mean
R² < 0 means the model is WORSE than predicting the mean
```

```python
def r_squared(y_actual, y_predicted):
    ss_res = np.sum((y_actual - y_predicted) ** 2)
    ss_tot = np.sum((y_actual - np.mean(y_actual)) ** 2)
    return 1 - (ss_res / ss_tot)

r2 = r_squared(y, predictions)
print(f"R²: {r2:.4f}")
```

```
R² interpretation:

R² = 0.95 → "The model explains 95% of the price variation"
R² = 0.50 → "The model explains only half the variation"
R² = 0.10 → "The model barely explains anything — missing features?"
```

---

## Connection to Real Problems

Linear regression is not just a toy. It is used in production at scale:

```
Use case                       Features                          Target
────────────────────────────────────────────────────────────────────────
House pricing                  sqft, bedrooms, location          price
Salary prediction              experience, education, role       salary
Ad revenue                     clicks, impressions, time         revenue
Energy consumption             temperature, time, occupancy      kWh
Manufacturing quality          temperature, pressure, speed      defect rate
```

Linear regression is also the foundation for understanding every other model.
Neural networks are, at their core, many linear regressions stacked together
with nonlinear activations in between.

---

## Exercises

### Exercise 1: Implement MSE and RMSE

```python
import numpy as np

def mse(y_actual, y_predicted):
    # TODO: implement mean squared error
    pass

def rmse(y_actual, y_predicted):
    # TODO: implement root mean squared error
    pass

actual = np.array([3, -0.5, 2, 7])
predicted = np.array([2.5, 0.0, 2, 8])

print(f"MSE: {mse(actual, predicted)}")    # expected: 0.375
print(f"RMSE: {rmse(actual, predicted)}")  # expected: 0.6123...
```

### Exercise 2: Single-Feature Linear Regression

Generate data from a known relationship and recover it:

```python
np.random.seed(0)
x = np.linspace(0, 10, 100)
y = 3 * x + 7 + np.random.randn(100) * 2

# TODO: implement the closed-form solution to find w and b
# TODO: verify that w ≈ 3 and b ≈ 7
# TODO: plot the data and your line
```

### Exercise 3: Multi-Feature Model

Use this dataset of car fuel efficiency:

```python
np.random.seed(42)
n = 200
horsepower = np.random.uniform(80, 300, n)
weight = np.random.uniform(2000, 5000, n)
cylinders = np.random.choice([4, 6, 8], n)

mpg = 50 - 0.05 * horsepower - 0.005 * weight - 1.5 * cylinders + np.random.randn(n) * 2

# TODO: build a multi-feature linear regression
# TODO: normalize the features first
# TODO: split into train/test (80/20)
# TODO: report MSE and R² on both train and test sets
# TODO: which feature has the biggest impact on fuel efficiency?
```

### Exercise 4: The Effect of Outliers

```python
np.random.seed(42)
x = np.linspace(0, 10, 50)
y = 2 * x + 5 + np.random.randn(50) * 1.5

# TODO: fit a line, record w and b
# TODO: add one extreme outlier: x=5, y=100
# TODO: refit the line — how much did w and b change?
# TODO: why is linear regression sensitive to outliers?
```

---

Next: [Lesson 03: Gradient Descent](./03-gradient-descent.md)
