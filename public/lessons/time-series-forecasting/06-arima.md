# Lesson 06: ARIMA Models

> ARIMA is the Swiss Army knife of time series forecasting — three components, one powerful framework.

---

## The Weather Prediction Analogy

How do you predict tomorrow's weather? You look at today's weather
(autoregressive — the past predicts the future), you consider how
far off yesterday's forecast was (moving average — learning from
errors), and you might need to think about changes rather than
absolutes (differencing — "it's getting warmer" vs "it's 20°C").

ARIMA combines all three ideas into one model:
- **AR** (AutoRegressive) — use past values
- **I** (Integrated) — use differencing to handle trends
- **MA** (Moving Average) — use past forecast errors

```
  ARIMA(p, d, q)
  +--------+     +--------+     +--------+
  |  AR(p) |  +  |  I(d)  |  +  |  MA(q) |
  | Past   |     | Differ-|     | Past   |
  | values |     | encing |     | errors |
  +--------+     +--------+     +--------+
      |               |              |
      v               v              v
  y depends on    Make series    y depends on
  y(t-1)..y(t-p)  stationary    e(t-1)..e(t-q)
```

---

## The AR Component

An AR(p) model predicts using a linear combination of the last p
values:

y(t) = c + φ₁·y(t-1) + φ₂·y(t-2) + ... + φₚ·y(t-p) + ε(t)

```
  AR(1): y(t) = c + φ₁·y(t-1) + ε
  "Tomorrow depends on today"

  AR(2): y(t) = c + φ₁·y(t-1) + φ₂·y(t-2) + ε
  "Tomorrow depends on today and yesterday"
```

How to identify p: look at the PACF — it cuts off after lag p.

---

## The MA Component

An MA(q) model predicts using a linear combination of the last q
forecast errors:

y(t) = c + ε(t) + θ₁·ε(t-1) + θ₂·ε(t-2) + ... + θ_q·ε(t-q)

```
  MA(1): y(t) = c + ε(t) + θ₁·ε(t-1)
  "Correct based on yesterday's mistake"

  MA(2): y(t) = c + ε(t) + θ₁·ε(t-1) + θ₂·ε(t-2)
  "Correct based on the last two mistakes"
```

How to identify q: look at the ACF — it cuts off after lag q.

---

## The I (Integrated) Component

The d parameter is the number of times you difference the series
to make it stationary. Most series need d=0 or d=1. Rarely d=2.

```
  d=0: Series is already stationary
  d=1: First difference → y'(t) = y(t) - y(t-1)
  d=2: Second difference → y''(t) = y'(t) - y'(t-1)
```

---

## The Box-Jenkins Methodology

The classic approach to building ARIMA models:

```
  BOX-JENKINS WORKFLOW

  +------------+     +------------+     +------------+
  | 1. Identify|     | 2. Estimate|     | 3. Diagnose|
  |  - Plot    | --> |  - Fit     | --> |  - Check   |
  |  - ACF/PACF|     |  - ARIMA   |     |  residuals |
  |  - ADF test|     |  (p,d,q)   |     |  - Ljung-  |
  +------------+     +------------+     |    Box test |
       ^                                +------+-----+
       |                                       |
       +----------- Revise if needed ----------+
```

---

## Fitting ARIMA in Python

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf

# Load data
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url, parse_dates=['Month'], index_col='Month')
ts = df['Passengers']

# Step 1: Make stationary
ts_log = np.log(ts)
ts_diff = ts_log.diff().dropna()

result = adfuller(ts_diff)
print(f"ADF p-value: {result[1]:.4f}")  # Should be < 0.05

# Step 2: Identify p and q from ACF/PACF
fig, axes = plt.subplots(1, 2, figsize=(14, 4))
plot_acf(ts_diff, lags=20, ax=axes[0])
plot_pacf(ts_diff, lags=20, ax=axes[1], method='ywm')
plt.tight_layout()
plt.show()
```

```python
# Step 3: Fit ARIMA model
# From ACF/PACF analysis: try ARIMA(1,1,1) on log-transformed data
model = ARIMA(ts_log, order=(1, 1, 1))
fitted = model.fit()

print(fitted.summary())
```

```python
# Step 4: Check residuals (diagnostics)
residuals = fitted.resid

fig, axes = plt.subplots(2, 2, figsize=(12, 8))

# Residual plot
axes[0, 0].plot(residuals)
axes[0, 0].set_title('Residuals')

# Histogram
axes[0, 1].hist(residuals, bins=25, density=True)
axes[0, 1].set_title('Residual Distribution')

# ACF of residuals (should show no significant autocorrelation)
plot_acf(residuals, lags=20, ax=axes[1, 0])
axes[1, 0].set_title('ACF of Residuals')

# Q-Q plot
from scipy import stats
stats.probplot(residuals, plot=axes[1, 1])
axes[1, 1].set_title('Q-Q Plot')

plt.tight_layout()
plt.show()
```

---

## Forecasting with ARIMA

```python
# Forecast the next 24 months
forecast = fitted.get_forecast(steps=24)
forecast_mean = np.exp(forecast.predicted_mean)  # reverse log transform
conf_int = np.exp(forecast.conf_int())

plt.figure(figsize=(12, 5))
plt.plot(ts, label='Observed')
plt.plot(forecast_mean, label='Forecast', color='red', linewidth=2)
plt.fill_between(
    conf_int.index,
    conf_int.iloc[:, 0],
    conf_int.iloc[:, 1],
    alpha=0.2, color='red', label='95% CI'
)
plt.legend()
plt.title('ARIMA Forecast — Airline Passengers')
plt.show()
```

---

## Choosing p, d, q with AIC

Instead of manually reading ACF/PACF, you can compare models using
information criteria. Lower AIC = better model.

```python
# Grid search over p, d, q
import warnings
warnings.filterwarnings('ignore')

best_aic = np.inf
best_order = None

for p in range(4):
    for d in range(2):
        for q in range(4):
            try:
                model = ARIMA(ts_log, order=(p, d, q))
                result = model.fit()
                if result.aic < best_aic:
                    best_aic = result.aic
                    best_order = (p, d, q)
            except:
                continue

print(f"Best order: ARIMA{best_order}")
print(f"Best AIC:   {best_aic:.2f}")
```

---

## Exercises

### Exercise 1: Build Your Own ARIMA

Pick a non-seasonal time series (stock prices, daily temperatures,
or generate a synthetic one). Follow the full Box-Jenkins workflow:
1. Plot the series and test for stationarity
2. Difference if needed (determine d)
3. Plot ACF/PACF to identify p and q
4. Fit the model and check residuals
5. Forecast 30 steps ahead

### Exercise 2: AIC Model Selection

Using the airline passengers dataset (log-transformed), fit all
ARIMA(p,d,q) combinations for p ∈ {0,1,2,3}, d ∈ {0,1}, q ∈
{0,1,2,3}. Create a table of the top 5 models by AIC. Does the
best AIC model match what you'd pick from ACF/PACF analysis?

---

Next: [Lesson 07: SARIMA and Seasonal Models](./07-sarima-seasonal.md)
