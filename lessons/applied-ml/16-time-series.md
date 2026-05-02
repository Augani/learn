# Lesson 16: Time Series

## Predicting the Future from the Past

A doctor monitors your heart rate over time -- patterns in the
signal tell them about your health. Time series forecasting does
the same thing for business metrics, stock prices, and sensor data.
The past contains clues about the future.

```
  TIME SERIES vs REGULAR DATA
  ===========================

  Regular:   [age=25, income=50K] -> predict: buys_car?
             Order doesn't matter. Each row independent.

  Time series: [Jan=100, Feb=120, Mar=115, Apr=130, ...]
               Order matters! Each point depends on previous.

  ┌────────────────────────────────────────────────┐
  │  Value                                         │
  │  |       *                                     │
  │  |    *     *     *                            │
  │  |  *    *     *     *                         │
  │  | *  *    *     *                             │
  │  |*         *           ??? (forecast)         │
  │  +─────────────────────────>                   │
  │                           Time                 │
  └────────────────────────────────────────────────┘
```

---

## Components of a Time Series

```
  Every time series can be decomposed:

  TREND:       Long-term direction (up/down/flat)
  SEASONALITY: Repeating patterns (daily/weekly/yearly)
  RESIDUAL:    Random noise left after removing trend + season

  ┌──────────────────────────────────────────┐
  │  Original = Trend + Seasonality + Noise  │
  └──────────────────────────────────────────┘

  EXAMPLE: Ice cream sales
  Trend:       Growing 5% per year (population growth)
  Seasonality: Peak in summer, low in winter (yearly cycle)
  Noise:       Random day-to-day variation
```

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

np.random.seed(42)
days = 365 * 3
t = np.arange(days)

trend = 0.05 * t
seasonality = 20 * np.sin(2 * np.pi * t / 365)
noise = np.random.randn(days) * 5
sales = 100 + trend + seasonality + noise

dates = pd.date_range("2022-01-01", periods=days, freq="D")
ts = pd.Series(sales, index=dates)

fig, axes = plt.subplots(4, 1, figsize=(12, 8), sharex=True)
axes[0].plot(ts)
axes[0].set_title("Original")
axes[1].plot(dates, 100 + trend)
axes[1].set_title("Trend")
axes[2].plot(dates, seasonality)
axes[2].set_title("Seasonality")
axes[3].plot(dates, noise)
axes[3].set_title("Noise")
plt.tight_layout()
plt.show()
```

---

## Stationarity

```
  A time series is STATIONARY if its statistical properties
  don't change over time.

  Stationary:                 Non-stationary:
  ~~~~~~~~~~~                 ___________/
  Mean is constant            Mean changes (trend)
  Variance is constant        Variance changes

  WHY IT MATTERS:
  Most models assume stationarity.
  You must TRANSFORM non-stationary data first.

  COMMON TRANSFORMS:
  - Differencing: y'(t) = y(t) - y(t-1)
  - Log transform: reduces variance growth
  - Seasonal differencing: y'(t) = y(t) - y(t-12)
```

```python
import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller

np.random.seed(42)
stationary = np.random.randn(200)
non_stationary = np.cumsum(np.random.randn(200))

for name, data in [("Stationary", stationary), ("Non-stationary", non_stationary)]:
    result = adfuller(data)
    print(f"{name}:")
    print(f"  ADF statistic: {result[0]:.3f}")
    print(f"  p-value: {result[1]:.4f}")
    print(f"  Stationary: {'Yes' if result[1] < 0.05 else 'No'}")
    print()
```

---

## ARIMA

```
  ARIMA(p, d, q)
  ==============

  AR(p):  AutoRegressive - use p past values
          y(t) = c + a1*y(t-1) + a2*y(t-2) + ... + ap*y(t-p)

  I(d):   Integrated - difference d times to make stationary

  MA(q):  Moving Average - use q past error terms
          y(t) = c + e(t) + b1*e(t-1) + ... + bq*e(t-q)

  SARIMA(p,d,q)(P,D,Q,s): seasonal version
  s = seasonal period (12 for monthly, 7 for daily)
```

```python
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from sklearn.metrics import mean_absolute_error

np.random.seed(42)
n = 200
t = np.arange(n)
y = 50 + 0.1 * t + 10 * np.sin(2 * np.pi * t / 30) + np.random.randn(n) * 3

train_size = int(n * 0.8)
train, test = y[:train_size], y[train_size:]

model = ARIMA(train, order=(5, 1, 2))
fitted = model.fit()

forecast = fitted.forecast(steps=len(test))
mae = mean_absolute_error(test, forecast)
print(f"ARIMA MAE: {mae:.2f}")
print(fitted.summary().tables[1])
```

---

## Prophet

```
  Facebook/Meta Prophet:
  - Handles trends, seasonality, holidays automatically
  - Robust to missing data and outliers
  - Easy to use, hard to beat for business forecasting
  - Not the most accurate, but very practical

  ┌─────────────────────────────────────────┐
  │  y(t) = g(t) + s(t) + h(t) + e(t)     │
  │                                         │
  │  g(t) = growth (linear or logistic)     │
  │  s(t) = seasonality (Fourier series)    │
  │  h(t) = holidays/events                 │
  │  e(t) = error term                      │
  └─────────────────────────────────────────┘
```

```python
try:
    from prophet import Prophet
    import pandas as pd
    import numpy as np

    np.random.seed(42)
    dates = pd.date_range("2020-01-01", periods=730, freq="D")
    values = 100 + np.arange(730) * 0.1 + 20 * np.sin(2 * np.pi * np.arange(730) / 365)
    values += np.random.randn(730) * 5

    df = pd.DataFrame({"ds": dates, "y": values})

    train = df.iloc[:600]
    test = df.iloc[600:]

    model = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
    model.fit(train)

    future = model.make_future_dataframe(periods=130)
    forecast = model.predict(future)

    predictions = forecast.iloc[600:]["yhat"].values
    mae = np.mean(np.abs(test["y"].values - predictions))
    print(f"Prophet MAE: {mae:.2f}")

except ImportError:
    print("Install prophet: pip install prophet")
```

---

## ML Approaches to Time Series

```
  FEATURE ENGINEERING FOR TIME SERIES
  ====================================

  Instead of feeding raw time series to ML models,
  create features from the time dimension:

  Lag features:     y(t-1), y(t-2), ..., y(t-n)
  Rolling stats:    mean_7d, std_7d, min_30d, max_30d
  Date features:    day_of_week, month, quarter, is_holiday
  Difference:       y(t) - y(t-1), y(t) - y(t-7)
  Cyclic encoding:  sin(2*pi*month/12), cos(2*pi*month/12)
```

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

np.random.seed(42)
dates = pd.date_range("2020-01-01", periods=730, freq="D")
values = 100 + np.arange(730) * 0.05 + 15 * np.sin(2 * np.pi * np.arange(730) / 365)
values += np.random.randn(730) * 3

df = pd.DataFrame({"date": dates, "value": values})

for lag in [1, 7, 14, 30]:
    df[f"lag_{lag}"] = df["value"].shift(lag)

df["rolling_mean_7"] = df["value"].shift(1).rolling(7).mean()
df["rolling_std_7"] = df["value"].shift(1).rolling(7).std()
df["rolling_mean_30"] = df["value"].shift(1).rolling(30).mean()

df["day_of_week"] = df["date"].dt.dayofweek
df["month"] = df["date"].dt.month
df["day_of_year"] = df["date"].dt.dayofyear

df = df.dropna()

feature_cols = [c for c in df.columns if c not in ["date", "value"]]
X = df[feature_cols]
y = df["value"]

train_size = int(len(df) * 0.8)
X_train, X_test = X.iloc[:train_size], X.iloc[train_size:]
y_train, y_test = y.iloc[:train_size], y.iloc[train_size:]

model = GradientBoostingRegressor(n_estimators=200, max_depth=5, random_state=42)
model.fit(X_train, y_train)

preds = model.predict(X_test)
mae = mean_absolute_error(y_test, preds)
print(f"GBM MAE: {mae:.2f}")

importances = pd.Series(model.feature_importances_, index=feature_cols)
print("\nTop features:")
print(importances.sort_values(ascending=False).head(10))
```

---

## Evaluation for Time Series

```
  CRITICAL: Never shuffle time series data!

  ┌──────────────────────────────────────────────────┐
  │  WRONG: Random train/test split                   │
  │  (future data leaks into training)                │
  │                                                    │
  │  RIGHT: Temporal split                             │
  │  [──── train ────][── test ──]                    │
  │  Past                        Future                │
  │                                                    │
  │  BETTER: Walk-forward validation                   │
  │  [train 1][test1]                                  │
  │  [train 2────][test2]                              │
  │  [train 3────────][test3]                          │
  └──────────────────────────────────────────────────┘

  METRICS:
  MAE  = mean(|actual - predicted|)
  MAPE = mean(|actual - predicted| / |actual|) * 100
  RMSE = sqrt(mean((actual - predicted)^2))
```

---

## Method Selection

```
  ┌──────────────┬──────────────────────────────────────┐
  │ Method       │ When to Use                          │
  ├──────────────┼──────────────────────────────────────┤
  │ ARIMA        │ Single series, linear patterns       │
  │ SARIMA       │ Single series with seasonality       │
  │ Prophet      │ Business forecasting, holidays       │
  │ XGBoost/LGB  │ Many features, complex patterns      │
  │ LSTM/GRU     │ Long sequences, deep learning        │
  │ Transformer  │ Multiple series, attention patterns   │
  └──────────────┴──────────────────────────────────────┘
```

---

## Exercises

**Exercise 1:** Download a real time series dataset (e.g., airline
passengers). Decompose it into trend, seasonality, and residual.
Fit ARIMA and Prophet. Compare MAE.

**Exercise 2:** Build a gradient boosting forecaster with lag features,
rolling statistics, and date features. Compare with ARIMA on the
same dataset. Which wins and why?

**Exercise 3:** Implement walk-forward validation for a time series
model with 5 expanding windows. Plot the predictions vs actuals
for each window.

**Exercise 4:** Build a multi-step forecaster that predicts 7 days
ahead. Compare recursive (predict one step, feed back) vs direct
(separate model per horizon) approaches.

---

[Next: Lesson 17 - Recommendation Systems -->](17-recommendation-systems.md)
