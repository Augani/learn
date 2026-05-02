# Lesson 01: What is a Time Series?

> Data with a heartbeat — when your observations come with timestamps, everything changes.

---

## The Diary vs Snapshot Analogy

Think of the difference between a diary and a snapshot photo. A
snapshot captures one moment — heights of students in a class, prices
of houses in a neighborhood. That's cross-sectional data. A diary
records the same thing over time — your weight every morning, your
mood every evening. That's a time series.

The order matters. Shuffle diary pages and you lose the story.
Shuffle snapshot photos and nothing changes. This single difference
— that sequence carries meaning — is what makes time series special.

```
  CROSS-SECTIONAL DATA              TIME SERIES DATA
  (Snapshot)                        (Diary)

  Student | Height                  Date       | Temperature
  --------|-------                  -----------|-----------
  Alice   | 165cm                  2024-01-01  | 2°C
  Bob     | 178cm                  2024-01-02  | 3°C
  Carol   | 171cm                  2024-01-03  | 1°C
  Dave    | 182cm                  2024-01-04  | 4°C

  Order doesn't matter ✗           Order matters ✓
  No time dependency               Yesterday affects today
  Rows are independent             Rows are correlated
```

---

## What Makes Time Series Different?

Three properties set time series apart from regular tabular data:

1. **Temporal ordering** — the sequence of observations matters
2. **Autocorrelation** — past values influence future values
3. **Non-independence** — you can't treat rows as independent samples

```
  REGULAR ML                        TIME SERIES ML
  +------------------+              +------------------+
  | Shuffle freely   |              | Never shuffle    |
  | Random splits OK |              | Time-based split |
  | IID assumption   |              | Correlated obs   |
  | Features → Label |              | Past → Future    |
  +------------------+              +------------------+
```

These differences affect everything: how you split data, how you
validate models, and which algorithms work.

---

## Time Series Examples in the Wild

Time series data is everywhere:

- **Finance:** Stock prices, exchange rates, trading volume
- **Weather:** Temperature, rainfall, wind speed
- **Web:** Page views, API requests, server latency
- **Business:** Daily sales, monthly revenue, quarterly earnings
- **Health:** Heart rate, blood glucose, step count
- **IoT:** Sensor readings, energy consumption, machine vibration

---

## Working with Time Series in Python

The foundation of time series work in Python is the pandas
`DatetimeIndex`. It tells pandas that your data is time-indexed.

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Create a simple time series
dates = pd.date_range(start='2024-01-01', periods=365, freq='D')
np.random.seed(42)
values = np.cumsum(np.random.randn(365)) + 100  # random walk

ts = pd.Series(values, index=dates, name='price')

# The index is a DatetimeIndex
print(type(ts.index))
# <class 'pandas.core.indexes.datetimes.DatetimeIndex'>

print(ts.head())
# 2024-01-01    100.496714
# 2024-01-02    100.358450
# 2024-01-03    101.006138
# 2024-01-04    102.529168
# 2024-01-05    101.764052
```

```python
# Time-based slicing — pandas makes this easy
jan = ts['2024-01']           # all of January
q1 = ts['2024-01':'2024-03'] # first quarter

# Resampling — change frequency
weekly = ts.resample('W').mean()    # daily → weekly average
monthly = ts.resample('ME').mean()  # daily → monthly average

print(f"Daily points:   {len(ts)}")
print(f"Weekly points:  {len(weekly)}")
print(f"Monthly points: {len(monthly)}")
```

---

## Plotting a Time Series

Visualization is your first tool. Always plot your data before
modeling.

```python
fig, axes = plt.subplots(2, 1, figsize=(12, 8))

# Raw daily data
axes[0].plot(ts.index, ts.values, linewidth=0.8)
axes[0].set_title('Daily Price (Raw)')
axes[0].set_ylabel('Price')

# Monthly average — smoother view
axes[1].plot(monthly.index, monthly.values, marker='o', linewidth=2)
axes[1].set_title('Monthly Average Price')
axes[1].set_ylabel('Price')

plt.tight_layout()
plt.savefig('time_series_plot.png', dpi=150)
plt.show()
```

```
  A time series plot tells a story:

  Price
  110 |                          *
      |                    *   *   *
  105 |              *   *       *
      |         *  *
  100 |--- * --*--------------------------
      |  *
   95 |*
      +--+--+--+--+--+--+--+--+--+--+--> Time
        Jan Feb Mar Apr May Jun Jul Aug
```

---

## Loading Real-World Time Series Data

```python
# Example: Air Passengers dataset (classic time series dataset)
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url, parse_dates=['Month'], index_col='Month')

print(df.head())
#             Passengers
# Month
# 1949-01-01         112
# 1949-02-01         118
# 1949-03-01         132
# 1949-04-01         129
# 1949-05-01         121

# Quick summary
print(f"Date range: {df.index.min()} to {df.index.max()}")
print(f"Frequency:  Monthly")
print(f"Points:     {len(df)}")

# Plot it
df.plot(figsize=(12, 4), title='Monthly Airline Passengers (1949-1960)')
plt.ylabel('Passengers (thousands)')
plt.show()
```

---

## Exercises

### Exercise 1: Build Your First Time Series

Create a pandas Series with a DatetimeIndex representing daily
temperatures for one year. Use `np.random.randn()` to simulate
temperature fluctuations around a seasonal pattern (warmer in
summer, cooler in winter). Plot the result.

Hint: Use `np.sin()` to create the seasonal pattern, then add noise.

```python
# Starter code
dates = pd.date_range('2024-01-01', periods=365, freq='D')
day_of_year = np.arange(365)
seasonal = 15 + 10 * np.sin(2 * np.pi * (day_of_year - 80) / 365)
# Add noise and create the Series...
```

### Exercise 2: Explore a Real Dataset

Download a time series dataset of your choice (stock prices from
Yahoo Finance, weather data from NOAA, or web traffic from Google
Trends). Load it into pandas, set the date column as the index,
and answer:

1. What is the date range and frequency?
2. Are there any missing dates?
3. What does the overall trend look like?
4. Can you spot any seasonal patterns?

---

Next: [Lesson 02: Components and Decomposition](./02-components-decomposition.md)
