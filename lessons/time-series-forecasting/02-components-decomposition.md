# Lesson 02: Components and Decomposition

> Every time series is a mix of signals — decomposition separates the melody from the noise.

---

## The Song Analogy

Listen to any song and you hear one sound. But a producer sees
layers: vocals, drums, bass, guitar, synths. Decomposition is the
audio mixing board for your time series — it separates the combined
signal into individual components you can understand and model
independently.

A time series is typically a mix of:
- **Trend** — the long-term direction (vocals)
- **Seasonality** — repeating patterns at fixed intervals (drums)
- **Residuals** — everything left over, the noise (static)

```
  ORIGINAL SIGNAL (what you observe)
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

         =  DECOMPOSE INTO

  TREND (long-term direction)
  ──────────────────/────────────────
                   /

  + SEASONALITY (repeating pattern)
  ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿

  + RESIDUALS (noise / irregular)
  ·  · ·  ··  · ·  · ··  ·  · · ·  ·
```

---

## The Four Components

### Trend

The long-term movement. Is the series going up, down, or staying
flat over months or years?

### Seasonality

Patterns that repeat at known, fixed intervals. Monthly sales
spikes in December. Daily website traffic peaks at noon. Weekly
restaurant bookings peak on Fridays.

### Cyclical

Longer-term fluctuations without a fixed period. Business cycles,
economic booms and busts. Unlike seasonality, cycles don't have a
predictable length.

### Residuals (Noise)

What's left after removing trend and seasonality. Ideally random.
If there's structure in the residuals, your decomposition missed
something.

```
  COMPONENT BREAKDOWN
  +------------------+----------+------------------+
  | Component        | Period   | Example          |
  +------------------+----------+------------------+
  | Trend            | Years    | GDP growth       |
  | Seasonality      | Fixed    | Holiday sales    |
  | Cyclical         | Variable | Business cycles  |
  | Residual         | None     | Random shocks    |
  +------------------+----------+------------------+
```

---

## Additive vs Multiplicative Decomposition

The key question: how do the components combine?

**Additive:** Y(t) = Trend + Seasonal + Residual
- Seasonal fluctuations are roughly constant in size
- Use when the seasonal pattern doesn't grow with the trend

**Multiplicative:** Y(t) = Trend × Seasonal × Residual
- Seasonal fluctuations grow proportionally with the trend
- Use when peaks get bigger as the series increases

```
  ADDITIVE                          MULTIPLICATIVE
  (constant amplitude)              (growing amplitude)

  |    /\  /\  /\  /\              |         /\
  |   /  \/  \/  \/  \             |      /\/ \
  |  /                 \            |   /\/     \
  | /                   \           | /\/        \
  +------------------------->      +-------------------->
  Seasonal swings stay same        Seasonal swings grow
```

---

## Decomposition in Python

```python
import pandas as pd
import matplotlib.pyplot as plt
from statsmodels.tsa.seasonal import seasonal_decompose

# Load the classic airline passengers dataset
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url, parse_dates=['Month'], index_col='Month')
ts = df['Passengers']

# Multiplicative decomposition (seasonal swings grow with trend)
result = seasonal_decompose(ts, model='multiplicative', period=12)

# Plot all components
fig = result.plot()
fig.set_size_inches(12, 8)
plt.tight_layout()
plt.show()
```

```python
# Access individual components
print("Trend (first 5 non-null):")
print(result.trend.dropna().head())

print("\nSeasonal (first 12 — one full cycle):")
print(result.seasonal.head(12))

print("\nResidual (first 5 non-null):")
print(result.resid.dropna().head())
```

---

## Manual Decomposition

Understanding what happens under the hood:

```python
import numpy as np

# Step 1: Estimate trend with a moving average
trend = ts.rolling(window=12, center=True).mean()

# Step 2: Remove trend to isolate seasonal + residual
detrended = ts / trend  # multiplicative: divide by trend

# Step 3: Average each month across years to get seasonal pattern
seasonal = detrended.groupby(detrended.index.month).transform('mean')

# Step 4: Residual is what's left
residual = ts / (trend * seasonal)

# Plot manual decomposition
fig, axes = plt.subplots(4, 1, figsize=(12, 10), sharex=True)
axes[0].plot(ts)
axes[0].set_title('Original')
axes[1].plot(trend)
axes[1].set_title('Trend (12-month moving average)')
axes[2].plot(seasonal)
axes[2].set_title('Seasonal')
axes[3].plot(residual)
axes[3].set_title('Residual')
plt.tight_layout()
plt.show()
```

```
  MANUAL DECOMPOSITION PIPELINE

  Original ──> Moving Avg ──> Detrend ──> Avg by Month ──> Residual
    Y(t)        Trend(t)     Y/Trend     Seasonal(t)     Y/(T×S)
```

---

## STL Decomposition

For more robust decomposition, use STL (Seasonal and Trend
decomposition using Loess). It handles outliers better and allows
the seasonal component to change over time.

```python
from statsmodels.tsa.seasonal import STL

stl = STL(ts, period=12, robust=True)
result = stl.fit()

fig = result.plot()
fig.set_size_inches(12, 8)
plt.tight_layout()
plt.show()
```

---

## Exercises

### Exercise 1: Additive vs Multiplicative

Load the airline passengers dataset. Decompose it using both
`model='additive'` and `model='multiplicative'`. Compare the
residual plots. Which model produces residuals that look more
random (less structured)? Why?

### Exercise 2: Decompose a New Dataset

Find a time series with clear seasonality (suggestions: monthly
electricity consumption, daily bike rentals, or weekly grocery
sales). Decompose it and write a one-paragraph interpretation of
each component: What does the trend tell you? What drives the
seasonality? Are the residuals random or is there structure you
missed?

---

Next: [Lesson 03: Stationarity and Why It Matters](./03-stationarity.md)
