# Lesson 08: Time Series Evaluation

> You can't randomly split time series data — the future must never leak into the past.

---

## The Weather Forecaster Analogy

How do you grade a weather forecaster? You don't let them see
tomorrow's weather before making their prediction. You don't let
them cherry-pick which days to predict. And you judge them on a
streak of predictions, not just one lucky guess.

Time series evaluation works the same way. The rules are stricter
than regular ML because time has a direction — you must always
predict forward, never peek ahead.

```
  REGULAR ML SPLIT              TIME SERIES SPLIT
  (random is fine)              (must respect time)

  [A][B][C][D][E][F]            [A][B][C][D] | [E][F]
  Shuffle → [C][A][F][B][D][E]  Train ------->  Test
  Random train/test split ✓     Always chronological ✓
  Random split for TS ✗         Random split ✗
```

---

## Error Metrics

### MAE — Mean Absolute Error

Average of absolute errors. Easy to interpret, in the same units
as the data.

MAE = (1/n) × Σ|y(t) - ŷ(t)|

### RMSE — Root Mean Squared Error

Penalizes large errors more heavily than MAE.

RMSE = √((1/n) × Σ(y(t) - ŷ(t))²)

### MAPE — Mean Absolute Percentage Error

Percentage-based, so you can compare across different scales.
Warning: breaks when actual values are near zero.

MAPE = (100/n) × Σ|y(t) - ŷ(t)| / |y(t)|

### SMAPE — Symmetric MAPE

Fixes MAPE's asymmetry problem.

SMAPE = (100/n) × Σ 2|y(t) - ŷ(t)| / (|y(t)| + |ŷ(t)|)

```
  METRIC COMPARISON
  +--------+------------+----------+------------------+
  | Metric | Scale-free | Outlier  | Zero-safe        |
  |        |            | Penalty  |                  |
  +--------+------------+----------+------------------+
  | MAE    | No         | Low      | Yes              |
  | RMSE   | No         | High     | Yes              |
  | MAPE   | Yes        | Low      | No (divides by y)|
  | SMAPE  | Yes        | Low      | Mostly           |
  +--------+------------+----------+------------------+
```

```python
import numpy as np

def mae(actual, predicted):
    return np.mean(np.abs(actual - predicted))

def rmse(actual, predicted):
    return np.sqrt(np.mean((actual - predicted) ** 2))

def mape(actual, predicted):
    return np.mean(np.abs((actual - predicted) / actual)) * 100

def smape(actual, predicted):
    return np.mean(2 * np.abs(actual - predicted) / (np.abs(actual) + np.abs(predicted))) * 100

# Example
actual = np.array([100, 110, 120, 130, 140])
predicted = np.array([102, 108, 125, 128, 145])

print(f"MAE:   {mae(actual, predicted):.2f}")
print(f"RMSE:  {rmse(actual, predicted):.2f}")
print(f"MAPE:  {mape(actual, predicted):.2f}%")
print(f"SMAPE: {smape(actual, predicted):.2f}%")
```

---

## Train/Test Split for Time Series

Never use random splits. Always split chronologically.

```python
import pandas as pd

url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url, parse_dates=['Month'], index_col='Month')
ts = df['Passengers']

# Time-based split: last 2 years as test
train = ts[:'1958-12']
test = ts['1959-01':]

print(f"Train: {train.index[0]} to {train.index[-1]} ({len(train)} points)")
print(f"Test:  {test.index[0]} to {test.index[-1]} ({len(test)} points)")
```

---

## Walk-Forward Validation

The gold standard for time series evaluation. Train on all data
up to time t, predict t+1, then expand the training window and
repeat.

```
  WALK-FORWARD VALIDATION

  Step 1: [Train---------] → Predict [1]
  Step 2: [Train----------] → Predict [2]
  Step 3: [Train-----------] → Predict [3]
  Step 4: [Train------------] → Predict [4]

  Each step: retrain (or update) the model, predict next point
```

```python
import matplotlib.pyplot as plt
from statsmodels.tsa.holtwinters import ExponentialSmoothing

def walk_forward_validation(series, n_test, seasonal_periods=12):
    """Walk-forward validation with Holt-Winters."""
    train = series[:-n_test]
    predictions = []
    actuals = []

    for i in range(n_test):
        # Fit model on all available data
        model = ExponentialSmoothing(
            train,
            trend='mul',
            seasonal='mul',
            seasonal_periods=seasonal_periods
        ).fit(optimized=True)

        # Predict next step
        pred = model.forecast(1)
        predictions.append(pred.values[0])
        actuals.append(series.iloc[len(train)])

        # Expand training window
        train = series[:len(train) + 1]

    return np.array(actuals), np.array(predictions)

# Run walk-forward validation
actuals, predictions = walk_forward_validation(ts, n_test=24)

print(f"Walk-Forward MAE:  {mae(actuals, predictions):.2f}")
print(f"Walk-Forward RMSE: {rmse(actuals, predictions):.2f}")
print(f"Walk-Forward MAPE: {mape(actuals, predictions):.2f}%")
```

---

## Expanding Window vs Sliding Window

```
  EXPANDING WINDOW                  SLIDING WINDOW
  (use all history)                 (fixed-size window)

  Step 1: [===] → pred             Step 1: [===] → pred
  Step 2: [====] → pred            Step 2:  [===] → pred
  Step 3: [=====] → pred           Step 3:   [===] → pred
  Step 4: [======] → pred          Step 4:    [===] → pred

  Training set grows               Training set stays same size
  More data over time              Adapts to recent patterns
  Good for stable processes        Good for changing processes
```

```python
def sliding_window_validation(series, n_test, window_size, seasonal_periods=12):
    """Sliding window validation with Holt-Winters."""
    predictions = []
    actuals = []

    for i in range(n_test):
        # Fixed-size training window
        start = len(series) - n_test - window_size + i
        end = len(series) - n_test + i
        train = series[start:end]

        model = ExponentialSmoothing(
            train,
            trend='mul',
            seasonal='mul',
            seasonal_periods=seasonal_periods
        ).fit(optimized=True)

        pred = model.forecast(1)
        predictions.append(pred.values[0])
        actuals.append(series.iloc[end])

    return np.array(actuals), np.array(predictions)

# Compare expanding vs sliding
act_exp, pred_exp = walk_forward_validation(ts, n_test=24)
act_sld, pred_sld = sliding_window_validation(ts, n_test=24, window_size=72)

print(f"Expanding window MAPE: {mape(act_exp, pred_exp):.2f}%")
print(f"Sliding window MAPE:   {mape(act_sld, pred_sld):.2f}%")
```

---

## Baseline Models

Always compare against simple baselines. If your fancy model can't
beat a naive forecast, it's not worth the complexity.

```python
# Naive: predict last value
naive_pred = ts.shift(1).dropna()

# Seasonal naive: predict same month last year
seasonal_naive_pred = ts.shift(12).dropna()

# Mean: predict the historical mean
mean_pred = pd.Series(ts.mean(), index=ts.index)

# Compare on test set
test_start = '1959-01'
print(f"Naive MAE:          {mae(ts[test_start:].values, ts.shift(1)[test_start:].values):.2f}")
print(f"Seasonal Naive MAE: {mae(ts[test_start:].values, ts.shift(12)[test_start:].values):.2f}")
```

---

## Exercises

### Exercise 1: Walk-Forward Showdown

Using the airline passengers dataset, implement walk-forward
validation for three models:
1. Seasonal naive (predict same month last year)
2. Holt-Winters
3. SARIMA (from Lesson 07)

Compare MAE, RMSE, and MAPE. Which model wins? By how much does
it beat the seasonal naive baseline?

### Exercise 2: Window Size Experiment

Run sliding window validation with window sizes of 36, 60, 84,
and 108 months. Plot MAPE vs window size. Is there a sweet spot?
What happens when the window is too small or too large?

---

Next: [Lesson 09: Feature Engineering for Time Series](./09-feature-engineering-ts.md)
