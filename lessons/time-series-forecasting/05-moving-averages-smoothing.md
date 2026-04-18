# Lesson 05: Moving Averages and Smoothing

> Smoothing is noise-canceling for your data — it reveals the signal hiding beneath the static.

---

## The Noise-Canceling Headphones Analogy

You're on a noisy train trying to listen to a podcast. Without
noise-canceling headphones, you hear everything — the podcast, the
engine, conversations, announcements. Turn on noise canceling and
the background fades, leaving just the signal you care about.

Smoothing methods do the same thing for time series. They average
out the short-term noise to reveal the underlying trend and
patterns. The trade-off: more smoothing means less noise but also
less responsiveness to real changes.

```
  RAW DATA (noisy)
  |  *  *     *        *
  | * ** * * * *  *  * * *
  |*  *   * *   ** **     *
  +-----------------------------> Time

  SMOOTHED DATA (signal revealed)
  |
  |     ~~~~~~~~
  |  ~~~        ~~~~~~~~
  +-----------------------------> Time
```

---

## Simple Moving Average (SMA)

The simplest smoother. Average the last k observations.

SMA(t) = (y(t) + y(t-1) + ... + y(t-k+1)) / k

```
  WINDOW SIZE TRADE-OFF

  Small window (k=3)              Large window (k=20)
  +-------------------+           +-------------------+
  | Responsive        |           | Very smooth       |
  | Still noisy       |           | Slow to react     |
  | Catches changes   |           | Misses changes    |
  +-------------------+           +-------------------+
```

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Generate noisy data with a trend
np.random.seed(42)
n = 200
trend = np.linspace(50, 100, n)
noise = np.random.randn(n) * 5
ts = pd.Series(trend + noise)

# Simple moving averages with different windows
sma_5 = ts.rolling(window=5).mean()
sma_20 = ts.rolling(window=20).mean()
sma_50 = ts.rolling(window=50).mean()

plt.figure(figsize=(12, 5))
plt.plot(ts, alpha=0.4, label='Raw data')
plt.plot(sma_5, label='SMA(5)', linewidth=2)
plt.plot(sma_20, label='SMA(20)', linewidth=2)
plt.plot(sma_50, label='SMA(50)', linewidth=2)
plt.legend()
plt.title('Simple Moving Average — Window Size Comparison')
plt.show()
```

---

## Weighted Moving Average

Not all past observations are equally important. A weighted moving
average gives more weight to recent values.

```python
# Linearly weighted moving average
weights = np.arange(1, 6)  # [1, 2, 3, 4, 5]
wma = ts.rolling(window=5).apply(
    lambda x: np.dot(x, weights) / weights.sum(),
    raw=True
)

plt.figure(figsize=(12, 5))
plt.plot(ts, alpha=0.4, label='Raw data')
plt.plot(sma_5, label='SMA(5)', linewidth=2)
plt.plot(wma, label='WMA(5)', linewidth=2)
plt.legend()
plt.title('SMA vs Weighted Moving Average')
plt.show()
```

---

## Exponential Smoothing

Exponential smoothing gives exponentially decreasing weights to
older observations. The smoothing parameter α (alpha) controls
how fast the weights decay.

### Simple Exponential Smoothing (SES)

Best for series with no trend and no seasonality.

ŷ(t+1) = α·y(t) + (1-α)·ŷ(t)

```
  ALPHA CONTROLS RESPONSIVENESS

  α close to 1                    α close to 0
  +-------------------+           +-------------------+
  | Trusts recent     |           | Trusts history    |
  | data heavily      |           | more than recent  |
  | Responsive        |           | Very smooth       |
  | More noise        |           | Slow to adapt     |
  +-------------------+           +-------------------+
```

```python
from statsmodels.tsa.holtwinters import SimpleExpSmoothing

# Fit SES with different alpha values
ses_low = SimpleExpSmoothing(ts).fit(smoothing_level=0.1, optimized=False)
ses_high = SimpleExpSmoothing(ts).fit(smoothing_level=0.9, optimized=False)
ses_auto = SimpleExpSmoothing(ts).fit()  # auto-optimize alpha

print(f"Optimized alpha: {ses_auto.params['smoothing_level']:.3f}")

plt.figure(figsize=(12, 5))
plt.plot(ts, alpha=0.4, label='Raw data')
plt.plot(ses_low.fittedvalues, label='SES (α=0.1)', linewidth=2)
plt.plot(ses_high.fittedvalues, label='SES (α=0.9)', linewidth=2)
plt.plot(ses_auto.fittedvalues, label=f'SES (α={ses_auto.params["smoothing_level"]:.2f})', linewidth=2)
plt.legend()
plt.title('Simple Exponential Smoothing')
plt.show()
```

---

## Holt's Linear Trend Method

SES can't handle trends. Holt's method adds a second equation to
track the trend.

- Level equation: ℓ(t) = α·y(t) + (1-α)·(ℓ(t-1) + b(t-1))
- Trend equation: b(t) = β·(ℓ(t) - ℓ(t-1)) + (1-β)·b(t-1)

```python
from statsmodels.tsa.holtwinters import Holt

# Data with a clear trend
trend_data = pd.Series(np.cumsum(np.random.randn(100)) + np.arange(100) * 0.5)

holt = Holt(trend_data).fit()
forecast = holt.forecast(20)

plt.figure(figsize=(12, 5))
plt.plot(trend_data, label='Data')
plt.plot(holt.fittedvalues, label='Holt fitted', linewidth=2)
plt.plot(range(100, 120), forecast, label='Forecast', linewidth=2, linestyle='--')
plt.legend()
plt.title("Holt's Linear Trend Method")
plt.show()
```

---

## Holt-Winters (Triple Exponential Smoothing)

The full package — handles level, trend, AND seasonality. This is
the most powerful exponential smoothing method.

```
  EXPONENTIAL SMOOTHING FAMILY

  +---------------------+-------+-------+------------+
  | Method              | Level | Trend | Seasonality |
  +---------------------+-------+-------+------------+
  | Simple (SES)        |  ✓    |       |            |
  | Holt's              |  ✓    |  ✓    |            |
  | Holt-Winters        |  ✓    |  ✓    |     ✓      |
  +---------------------+-------+-------+------------+
```

```python
from statsmodels.tsa.holtwinters import ExponentialSmoothing

# Load seasonal data
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url, parse_dates=['Month'], index_col='Month')
ts_air = df['Passengers']

# Split into train/test
train = ts_air[:'1958']
test = ts_air['1959':]

# Fit Holt-Winters (multiplicative seasonality)
hw = ExponentialSmoothing(
    train,
    trend='mul',
    seasonal='mul',
    seasonal_periods=12
).fit()

# Forecast
forecast = hw.forecast(len(test))

plt.figure(figsize=(12, 5))
plt.plot(train, label='Train')
plt.plot(test, label='Test')
plt.plot(forecast, label='Holt-Winters Forecast', linewidth=2, linestyle='--')
plt.legend()
plt.title('Holt-Winters Forecast — Airline Passengers')
plt.show()
```

---

## Exercises

### Exercise 1: Smoothing Showdown

Take a noisy time series (generate one or use real data). Apply:
1. SMA with window 7 and window 30
2. Simple Exponential Smoothing with α=0.1 and α=0.5
3. Holt-Winters (if seasonal)

Plot all on the same chart. Which method best reveals the
underlying pattern without over-smoothing?

### Exercise 2: Forecast with Holt-Winters

Using the airline passengers dataset, split into train (1949-1957)
and test (1958-1960). Fit Holt-Winters with both additive and
multiplicative seasonality. Compare the forecasts against the test
set using MAE. Which model fits better and why?

---

Next: [Lesson 06: ARIMA Models](./06-arima.md)
