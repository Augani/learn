# Lesson 11: Prophet and Additive Models

> Prophet makes forecasting accessible — it handles holidays, changepoints, and seasonality so you can focus on the business problem.

---

## What is Prophet?

Prophet is an additive forecasting model developed at Meta
(Facebook). It decomposes a time series into three components:

y(t) = g(t) + s(t) + h(t) + ε(t)

- **g(t)** — trend (piecewise linear or logistic growth)
- **s(t)** — seasonality (Fourier series)
- **h(t)** — holiday effects
- **ε(t)** — error term

```
  PROPHET ARCHITECTURE

  +------------------+
  |   Trend g(t)     |  Piecewise linear with changepoints
  +------------------+
          +
  +------------------+
  | Seasonality s(t) |  Fourier series (yearly, weekly, daily)
  +------------------+
          +
  +------------------+
  |  Holidays h(t)   |  User-specified holiday effects
  +------------------+
          =
  +------------------+
  |  Forecast y(t)   |  With uncertainty intervals
  +------------------+
```

Prophet shines for business forecasting: it handles missing data,
outliers, and holiday effects out of the box. It's designed for
analysts who know their domain but aren't time series statisticians.

---

## Basic Prophet Usage

```python
import pandas as pd
import numpy as np
from prophet import Prophet
import matplotlib.pyplot as plt

# Prophet requires columns named 'ds' (date) and 'y' (value)
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url)
df.columns = ['ds', 'y']
df['ds'] = pd.to_datetime(df['ds'])

# Split train/test
train = df[df['ds'] < '1959-01-01']
test = df[df['ds'] >= '1959-01-01']

# Fit Prophet
model = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
model.fit(train)

# Create future dataframe and predict
future = model.make_future_dataframe(periods=len(test), freq='MS')
forecast = model.predict(future)

# Plot forecast
fig = model.plot(forecast)
plt.title('Prophet Forecast — Airline Passengers')
plt.show()
```

---

## Component Plots

Prophet's killer feature — you can see exactly what each component
contributes.

```python
# Plot individual components
fig = model.plot_components(forecast)
plt.show()

# Access components directly
print("Trend sample:")
print(forecast[['ds', 'trend']].tail())

print("\nYearly seasonality sample:")
print(forecast[['ds', 'yearly']].head(12))
```

```
  COMPONENT VISUALIZATION

  Trend:       ────────────/──────────
                          /
  Yearly:      ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿
               (peaks in summer)

  Combined:    ~~~~~/~~~~~∿∿∿∿∿∿∿∿∿∿
```

---

## Trend Changepoints

Prophet automatically detects points where the trend changes
direction. You can control this behavior.

```python
# Visualize changepoints
from prophet.plot import add_changepoints_to_plot

model_cp = Prophet(
    changepoint_prior_scale=0.5,  # higher = more flexible trend
    n_changepoints=25             # number of potential changepoints
)
model_cp.fit(train)
forecast_cp = model_cp.predict(future)

fig = model_cp.plot(forecast_cp)
add_changepoints_to_plot(fig.gca(), model_cp, forecast_cp)
plt.title('Prophet with Changepoints')
plt.show()

# Print detected changepoints
print("Changepoints:")
print(model_cp.changepoints)
```

```
  CHANGEPOINT FLEXIBILITY

  Low changepoint_prior_scale (0.01):
  ──────────────────────────────────  (rigid trend)

  High changepoint_prior_scale (0.5):
  ────────/──────\────/──────────── (flexible trend)
```

---

## Adding Holiday Effects

```python
# Define holidays
holidays = pd.DataFrame({
    'holiday': 'christmas',
    'ds': pd.to_datetime(['1949-12-25', '1950-12-25', '1951-12-25',
                          '1952-12-25', '1953-12-25', '1954-12-25',
                          '1955-12-25', '1956-12-25', '1957-12-25',
                          '1958-12-25', '1959-12-25', '1960-12-25']),
    'lower_window': -2,   # effect starts 2 days before
    'upper_window': 2     # effect lasts 2 days after
})

model_holidays = Prophet(holidays=holidays)
model_holidays.fit(train)
forecast_h = model_holidays.predict(future)

# The holiday effect is now a separate component
fig = model_holidays.plot_components(forecast_h)
plt.show()
```

---

## Custom Seasonality

Prophet supports adding custom seasonal patterns beyond the
built-in yearly, weekly, and daily.

```python
# Add monthly seasonality
model_custom = Prophet(yearly_seasonality=True)
model_custom.add_seasonality(
    name='monthly',
    period=30.5,
    fourier_order=5
)
model_custom.fit(train)
forecast_custom = model_custom.predict(future)

fig = model_custom.plot_components(forecast_custom)
plt.show()
```

---

## Uncertainty Intervals

Prophet provides uncertainty intervals by default — crucial for
business decision-making.

```python
# Forecast with uncertainty
forecast_cols = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(24)
print(forecast_cols)

# The width of the interval grows with forecast horizon
# (further out = more uncertain)
plt.figure(figsize=(12, 5))
plt.plot(forecast['ds'], forecast['yhat'], label='Forecast')
plt.fill_between(
    forecast['ds'],
    forecast['yhat_lower'],
    forecast['yhat_upper'],
    alpha=0.2, label='Uncertainty'
)
plt.plot(df['ds'], df['y'], 'k.', label='Actual')
plt.legend()
plt.title('Prophet Forecast with Uncertainty Intervals')
plt.show()
```

---

## When to Use Prophet

```
  PROPHET IS GREAT FOR              PROPHET IS NOT IDEAL FOR
  +-------------------------+       +-------------------------+
  | Business forecasting    |       | High-frequency data     |
  | Strong seasonality      |       | (sub-hourly)            |
  | Holiday effects matter  |       | Short series (<2 years) |
  | Missing data / outliers |       | Complex dependencies    |
  | Non-technical users     |       | Multi-variate           |
  | Quick baselines         |       | Real-time forecasting   |
  +-------------------------+       +-------------------------+
```

---

## Exercises

### Exercise 1: Business Forecasting

Use Prophet to forecast a business metric (retail sales, website
traffic, or energy consumption). Add relevant holidays for your
region. Compare the forecast with and without holiday effects —
how much do holidays improve accuracy?

### Exercise 2: Seasonality Tuning

Fit Prophet to the airline passengers dataset with different
`fourier_order` values for yearly seasonality (try 3, 5, 10, 20).
Plot the yearly component for each. How does the Fourier order
affect the shape of the seasonal pattern? What's the risk of
setting it too high?

---

Next: [Lesson 12: Deep Learning for Forecasting](./12-deep-learning-forecasting.md)
