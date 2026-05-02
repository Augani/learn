# Lesson 07: SARIMA and Seasonal Models

> When your data dances to a seasonal beat, SARIMA adds the rhythm section that ARIMA is missing.

---

## Why ARIMA Isn't Enough

ARIMA handles trends beautifully, but it's tone-deaf to seasonality.
If your data spikes every December or dips every Monday, ARIMA will
try to model those patterns with non-seasonal parameters — and it
won't do a great job.

SARIMA extends ARIMA by adding a second set of parameters
specifically for the seasonal component.

```
  ARIMA(p, d, q)           →  Non-seasonal part
  ×
  SARIMA(P, D, Q, s)       →  Seasonal part

  Full notation: SARIMA(p, d, q)(P, D, Q, s)

  Example: SARIMA(1, 1, 1)(1, 1, 1, 12)
           +---------+  +-----------+
           Non-seasonal  Seasonal (monthly data, s=12)
```

```
  PARAMETER GUIDE
  +-------+----------------------------------+
  | p, d, q | Non-seasonal AR, diff, MA      |
  | P, D, Q | Seasonal AR, diff, MA          |
  | s       | Seasonal period (12=monthly,   |
  |         |   7=daily with weekly pattern,  |
  |         |   4=quarterly)                  |
  +-------+----------------------------------+
```

---

## Seasonal Differencing

Just as regular differencing removes trends, seasonal differencing
removes seasonal patterns by subtracting the value from s periods
ago.

Regular: y'(t) = y(t) - y(t-1)
Seasonal: y_s(t) = y(t) - y(t-s)

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Load airline passengers
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url, parse_dates=['Month'], index_col='Month')
ts = df['Passengers']

# Seasonal differencing (period=12)
ts_seasonal_diff = ts.diff(12).dropna()

# Regular + seasonal differencing
ts_both_diff = ts.diff(12).diff().dropna()

fig, axes = plt.subplots(3, 1, figsize=(12, 8), sharex=True)
axes[0].plot(ts)
axes[0].set_title('Original')
axes[1].plot(ts_seasonal_diff)
axes[1].set_title('Seasonal Difference (D=1)')
axes[2].plot(ts_both_diff)
axes[2].set_title('Seasonal + Regular Difference (D=1, d=1)')
plt.tight_layout()
plt.show()
```

---

## Fitting SARIMA with statsmodels

```python
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf

# Log transform for variance stabilization
ts_log = np.log(ts)

# Split train/test
train = ts_log[:'1958']
test = ts_log['1959':]

# Fit SARIMA(1,1,1)(1,1,1,12)
model = SARIMAX(
    train,
    order=(1, 1, 1),
    seasonal_order=(1, 1, 1, 12),
    enforce_stationarity=False,
    enforce_invertibility=False
)
fitted = model.fit(disp=False)

print(fitted.summary())
```

```python
# Forecast and compare
forecast = fitted.get_forecast(steps=len(test))
forecast_mean = forecast.predicted_mean
conf_int = forecast.conf_int()

plt.figure(figsize=(12, 5))
plt.plot(np.exp(train), label='Train')
plt.plot(np.exp(test), label='Test')
plt.plot(np.exp(forecast_mean), label='SARIMA Forecast', linewidth=2, linestyle='--')
plt.fill_between(
    conf_int.index,
    np.exp(conf_int.iloc[:, 0]),
    np.exp(conf_int.iloc[:, 1]),
    alpha=0.2
)
plt.legend()
plt.title('SARIMA(1,1,1)(1,1,1,12) Forecast')
plt.show()
```

---

## Auto ARIMA with pmdarima

Manually selecting (p,d,q)(P,D,Q,s) is tedious. `pmdarima`
automates the search.

```python
import pmdarima as pm

# auto_arima searches over parameter space
auto_model = pm.auto_arima(
    ts_log,
    seasonal=True,
    m=12,                  # seasonal period
    d=None,                # auto-detect d
    D=None,                # auto-detect D
    start_p=0, max_p=3,
    start_q=0, max_q=3,
    start_P=0, max_P=2,
    start_Q=0, max_Q=2,
    trace=True,            # print search progress
    error_action='ignore',
    suppress_warnings=True,
    stepwise=True          # faster search
)

print(auto_model.summary())
print(f"\nBest order: {auto_model.order}")
print(f"Seasonal order: {auto_model.seasonal_order}")
```

```python
# Forecast with auto_arima
n_forecast = 24
forecast, conf_int = auto_model.predict(
    n_periods=n_forecast,
    return_conf_int=True
)

# Plot
idx = pd.date_range(ts.index[-1], periods=n_forecast + 1, freq='MS')[1:]
plt.figure(figsize=(12, 5))
plt.plot(ts, label='Observed')
plt.plot(idx, np.exp(forecast), label='auto_arima Forecast', linewidth=2)
plt.fill_between(idx, np.exp(conf_int[:, 0]), np.exp(conf_int[:, 1]), alpha=0.2)
plt.legend()
plt.title('auto_arima Forecast')
plt.show()
```

---

## SARIMA vs Holt-Winters: When to Use Which

```
  DECISION GUIDE
  +------------------+------------------+------------------+
  | Criterion        | SARIMA           | Holt-Winters     |
  +------------------+------------------+------------------+
  | Interpretability | Parameters need  | Intuitive level/ |
  |                  | statistical      | trend/seasonal   |
  |                  | knowledge        | components       |
  +------------------+------------------+------------------+
  | Flexibility      | Handles complex  | Limited to       |
  |                  | autocorrelation  | exponential      |
  |                  | structures       | smoothing        |
  +------------------+------------------+------------------+
  | Ease of use      | Needs parameter  | Fewer choices    |
  |                  | selection        | to make          |
  +------------------+------------------+------------------+
  | Best for         | Complex seasonal | Simple seasonal  |
  |                  | + autocorrelation| patterns, quick  |
  |                  | patterns         | baselines        |
  +------------------+------------------+------------------+
```

---

## Exercises

### Exercise 1: Seasonal Forecasting

Using the airline passengers dataset:
1. Fit a SARIMA model using `auto_arima`
2. Fit a Holt-Winters model (from Lesson 05)
3. Compare both forecasts on a held-out test set (last 2 years)
4. Which model produces lower MAE? Lower RMSE?

### Exercise 2: Find the Season

Pick a dataset with a non-obvious seasonal period (daily data with
weekly patterns, hourly data with daily patterns). Use ACF plots
to identify the seasonal period, then fit a SARIMA model. Does
adding the seasonal component improve the forecast compared to
plain ARIMA?

---

Next: [Lesson 08: Time Series Evaluation](./08-evaluation-metrics.md)
