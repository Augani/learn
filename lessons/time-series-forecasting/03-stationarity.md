# Lesson 03: Stationarity and Why It Matters

> A stationary series plays by consistent rules — and that's exactly what forecasting models need.

---

## The River Analogy

Picture two rivers. The first flows at a steady rate year-round —
same average depth, same variability, predictable. The second floods
in spring, dries up in summer, and its behavior keeps changing. Which
river would you rather build a bridge over?

A stationary time series is the steady river. Its statistical
properties — mean, variance, autocorrelation — don't change over
time. Most forecasting models assume stationarity because they learn
patterns from the past and apply them to the future. If the rules
keep changing, past patterns become useless.

```
  STATIONARY                        NON-STATIONARY
  (steady river)                    (flooding river)

  |  ~ ~ ~ ~ ~ ~ ~ ~ ~             |              ~~~
  | ~ ~ ~ ~ ~ ~ ~ ~ ~ ~            |          ~~~
  |~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~           |      ~~~
  +------------------------->       |  ~~~
  Constant mean & variance          +-------------------->
                                    Mean drifts over time
```

---

## What is Stationarity?

A time series is **strictly stationary** if its statistical
properties are identical no matter where you look in time. In
practice, we use **weak stationarity** (second-order):

1. **Constant mean** — the average doesn't drift up or down
2. **Constant variance** — the spread doesn't grow or shrink
3. **Constant autocovariance** — the relationship between values
   at different lags depends only on the lag, not on time

```
  STATIONARY CHECKLIST
  +------------------------------------------+
  | ✓ Mean is constant over time             |
  | ✓ Variance is constant over time         |
  | ✓ Covariance depends only on lag         |
  +------------------------------------------+

  NON-STATIONARY SYMPTOMS
  +------------------------------------------+
  | ✗ Trend (mean changes)                   |
  | ✗ Growing variance (heteroscedasticity)  |
  | ✗ Seasonality (periodic mean shifts)     |
  | ✗ Structural breaks (sudden changes)     |
  +------------------------------------------+
```

---

## Why Models Need Stationarity

Most classical time series models (ARIMA, exponential smoothing)
assume stationarity. Here's why:

- They learn coefficients from historical data
- Those coefficients assume the data-generating process is stable
- If the process changes, the learned coefficients become wrong

Think of it this way: if you learn that "the average temperature
in January is 2°C," that's useful for predicting next January —
but only if the climate isn't changing.

---

## Testing for Stationarity

### Augmented Dickey-Fuller (ADF) Test

The most common test. The null hypothesis is that the series has
a unit root (is non-stationary).

- **p-value < 0.05** → reject null → series is likely stationary
- **p-value > 0.05** → fail to reject → series is likely non-stationary

```python
import pandas as pd
import numpy as np
from statsmodels.tsa.stattools import adfuller

# Load data
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url, parse_dates=['Month'], index_col='Month')
ts = df['Passengers']

# Run ADF test
result = adfuller(ts, autolag='AIC')

print(f'ADF Statistic: {result[0]:.4f}')
print(f'p-value:       {result[1]:.4f}')
print(f'Lags Used:     {result[2]}')
print(f'Observations:  {result[3]}')
print('Critical Values:')
for key, value in result[4].items():
    print(f'  {key}: {value:.4f}')

# p-value > 0.05 → non-stationary (as expected for airline data)
```

### KPSS Test

The KPSS test flips the hypothesis — the null is that the series
IS stationary. Use both tests together for confidence.

```python
from statsmodels.tsa.stattools import kpss

stat, p_value, lags, crit = kpss(ts, regression='ct', nlags='auto')
print(f'KPSS Statistic: {stat:.4f}')
print(f'p-value:        {p_value:.4f}')

# p-value < 0.05 → reject null → series is non-stationary
```

```
  INTERPRETING BOTH TESTS TOGETHER
  +------------------+------------------+------------------+
  | ADF              | KPSS             | Conclusion       |
  +------------------+------------------+------------------+
  | Reject (p<0.05)  | Fail to reject   | Stationary ✓     |
  | Fail to reject   | Reject (p<0.05)  | Non-stationary ✗ |
  | Reject           | Reject           | Trend-stationary |
  | Fail to reject   | Fail to reject   | Inconclusive     |
  +------------------+------------------+------------------+
```

---

## Making a Series Stationary

### Differencing

The most common technique. Subtract each value from the previous
one. This removes trends.

```python
import matplotlib.pyplot as plt

# First difference: y'(t) = y(t) - y(t-1)
ts_diff1 = ts.diff().dropna()

# Check if first differencing was enough
result = adfuller(ts_diff1)
print(f'After 1st differencing — p-value: {result[1]:.4f}')

# If still non-stationary, try second differencing
ts_diff2 = ts_diff1.diff().dropna()
result2 = adfuller(ts_diff2)
print(f'After 2nd differencing — p-value: {result2[1]:.4f}')
```

```python
# Visualize the effect of differencing
fig, axes = plt.subplots(3, 1, figsize=(12, 8), sharex=True)

axes[0].plot(ts)
axes[0].set_title('Original (Non-Stationary)')

axes[1].plot(ts_diff1)
axes[1].set_title('First Difference')

axes[2].plot(ts_diff2)
axes[2].set_title('Second Difference')

plt.tight_layout()
plt.show()
```

### Log Transform + Differencing

When variance grows with the level (multiplicative seasonality),
take the log first to stabilize variance, then difference.

```python
ts_log = np.log(ts)
ts_log_diff = ts_log.diff().dropna()

result = adfuller(ts_log_diff)
print(f'Log + differencing — p-value: {result[1]:.4f}')
```

### Seasonal Differencing

For seasonal non-stationarity, subtract the value from the same
season in the previous cycle.

```python
# Seasonal difference with period 12 (monthly data)
ts_seasonal_diff = ts.diff(12).dropna()

result = adfuller(ts_seasonal_diff)
print(f'Seasonal differencing — p-value: {result[1]:.4f}')
```

```
  DIFFERENCING DECISION TREE

  Is the series stationary?
  ├── YES → Done, proceed to modeling
  └── NO
      ├── Is variance growing? → Log transform first
      ├── Is there a trend? → First difference (d=1)
      ├── Still non-stationary? → Second difference (d=2)
      └── Seasonal pattern? → Seasonal difference (D=1)
```

---

## Exercises

### Exercise 1: Test and Transform

Load a time series dataset (stock prices, GDP, or CO2 levels).
Run the ADF and KPSS tests. If non-stationary, apply the
appropriate transformations (differencing, log + differencing)
until both tests agree the series is stationary. Plot each step.

### Exercise 2: The Stationarity Report

Write a function `stationarity_report(series)` that:
1. Runs both ADF and KPSS tests
2. Prints the test statistics and p-values
3. Returns a verdict: "stationary", "non-stationary", "trend-stationary", or "inconclusive"

Test it on three different series: a random walk, a seasonal
series, and white noise.

---

Next: [Lesson 04: Autocorrelation and Partial Autocorrelation](./04-autocorrelation.md)
