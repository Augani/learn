# Lesson 09: Feature Engineering for Time Series

> Give your model a calendar and a memory, and it can learn patterns that statistical methods miss.

---

## The Calendar and Memory Analogy

Imagine predicting how busy a restaurant will be tonight. You'd
check: What day of the week is it? (calendar feature) How busy
was it last Friday? (lag feature) What's the average for the past
month? (rolling feature) Is there a holiday coming up? (event
feature)

Feature engineering for time series is about encoding these
intuitions as numbers that ML models can learn from. You're
translating temporal context into tabular features.

```
  TIME SERIES → FEATURE TABLE

  Date       | Value     Date       | Value | Lag1 | Lag7 | DayOfWeek | Rolling7
  -----------|-----  →   -----------|-------|------|------|-----------|--------
  2024-01-01 | 100       2024-01-08 | 130   | 125  | 100  | Monday    | 115.7
  2024-01-02 | 105       2024-01-09 | 128   | 130  | 105  | Tuesday   | 117.1
  ...                     ...
```

---

## Lag Features

The most fundamental time series feature. Lag-k is simply the
value from k steps ago.

```python
import pandas as pd
import numpy as np

# Create sample daily sales data
np.random.seed(42)
dates = pd.date_range('2023-01-01', periods=365, freq='D')
trend = np.linspace(100, 150, 365)
seasonal = 20 * np.sin(2 * np.pi * np.arange(365) / 7)  # weekly pattern
noise = np.random.randn(365) * 5
sales = pd.DataFrame({'date': dates, 'sales': trend + seasonal + noise})
sales.set_index('date', inplace=True)

# Create lag features
for lag in [1, 7, 14, 28]:
    sales[f'lag_{lag}'] = sales['sales'].shift(lag)

print(sales.dropna().head())
```

```
  LAG FEATURE INTUITION

  lag_1:  "What happened yesterday?"
  lag_7:  "What happened same day last week?"
  lag_14: "What happened two weeks ago?"
  lag_28: "What happened four weeks ago?"

  Choose lags that match your data's patterns:
  - Daily data with weekly seasonality → lag 7
  - Monthly data with yearly seasonality → lag 12
  - Hourly data with daily pattern → lag 24
```

---

## Rolling Statistics

Capture recent trends and volatility with rolling windows.

```python
# Rolling features
for window in [7, 14, 30]:
    sales[f'rolling_mean_{window}'] = sales['sales'].shift(1).rolling(window).mean()
    sales[f'rolling_std_{window}'] = sales['sales'].shift(1).rolling(window).std()

# Rolling min/max (captures range)
sales['rolling_min_7'] = sales['sales'].shift(1).rolling(7).min()
sales['rolling_max_7'] = sales['sales'].shift(1).rolling(7).max()

# Expanding mean (all history)
sales['expanding_mean'] = sales['sales'].shift(1).expanding().mean()

print(sales.dropna().head())
```

Important: always use `.shift(1)` before rolling to avoid data
leakage. The rolling window should only include past data.

---

## Date/Time Features

Extract calendar information that captures human patterns.

```python
# Calendar features
sales['day_of_week'] = sales.index.dayofweek      # 0=Mon, 6=Sun
sales['day_of_month'] = sales.index.day
sales['month'] = sales.index.month
sales['quarter'] = sales.index.quarter
sales['day_of_year'] = sales.index.dayofyear
sales['week_of_year'] = sales.index.isocalendar().week.values
sales['is_weekend'] = (sales.index.dayofweek >= 5).astype(int)
sales['is_month_start'] = sales.index.is_month_start.astype(int)
sales['is_month_end'] = sales.index.is_month_end.astype(int)
```

```
  CALENDAR FEATURES
  +------------------+----------------------------------+
  | Feature          | Captures                         |
  +------------------+----------------------------------+
  | day_of_week      | Weekly patterns (Mon vs Fri)     |
  | month            | Yearly seasonality               |
  | is_weekend       | Weekday vs weekend behavior      |
  | day_of_month     | Monthly patterns (payday effect) |
  | quarter          | Quarterly business cycles        |
  | is_month_end     | End-of-month spikes              |
  +------------------+----------------------------------+
```

---

## Fourier Features for Seasonality

Sine and cosine pairs capture smooth seasonal patterns. They're
especially useful when the seasonal period is long (365 days for
yearly seasonality).

```python
def fourier_features(index, period, n_harmonics):
    """Create Fourier features for seasonality."""
    t = np.arange(len(index))
    features = {}
    for k in range(1, n_harmonics + 1):
        features[f'sin_{period}_{k}'] = np.sin(2 * np.pi * k * t / period)
        features[f'cos_{period}_{k}'] = np.cos(2 * np.pi * k * t / period)
    return pd.DataFrame(features, index=index)

# Weekly seasonality (period=7, 3 harmonics)
weekly_fourier = fourier_features(sales.index, period=7, n_harmonics=3)

# Yearly seasonality (period=365, 5 harmonics)
yearly_fourier = fourier_features(sales.index, period=365, n_harmonics=5)

sales = pd.concat([sales, weekly_fourier, yearly_fourier], axis=1)
```

```
  FOURIER FEATURES

  More harmonics = more complex seasonal shape
  Fewer harmonics = smoother seasonal shape

  1 harmonic:  ∿∿∿∿∿∿  (simple sine wave)
  3 harmonics: ∿∿∿∿∿∿  (captures sharper peaks)
  5 harmonics: ∿∿∿∿∿∿  (captures fine detail)
```

---

## Building a Complete Feature Set

```python
def create_features(df, target_col='sales', lags=[1, 7, 14],
                    windows=[7, 14, 30]):
    """Create a complete feature set for time series ML."""
    features = pd.DataFrame(index=df.index)

    # Lag features
    for lag in lags:
        features[f'lag_{lag}'] = df[target_col].shift(lag)

    # Rolling features
    for w in windows:
        shifted = df[target_col].shift(1)
        features[f'roll_mean_{w}'] = shifted.rolling(w).mean()
        features[f'roll_std_{w}'] = shifted.rolling(w).std()

    # Calendar features
    features['dow'] = df.index.dayofweek
    features['month'] = df.index.month
    features['is_weekend'] = (df.index.dayofweek >= 5).astype(int)

    # Target
    features['target'] = df[target_col]

    return features.dropna()

# Build features and train a model
feature_df = create_features(sales)
print(f"Features: {feature_df.shape[1] - 1}")
print(f"Samples:  {len(feature_df)}")
```

---

## Using Features with scikit-learn

```python
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error
import matplotlib.pyplot as plt

# Time-based split
split_date = '2023-10-01'
train = feature_df[:split_date]
test = feature_df[split_date:]

X_train = train.drop('target', axis=1)
y_train = train['target']
X_test = test.drop('target', axis=1)
y_test = test['target']

# Fit a simple Ridge regression
model = Ridge(alpha=1.0)
model.fit(X_train, y_train)
predictions = model.predict(X_test)

print(f"MAE: {mean_absolute_error(y_test, predictions):.2f}")

# Plot
plt.figure(figsize=(12, 5))
plt.plot(y_test.index, y_test.values, label='Actual')
plt.plot(y_test.index, predictions, label='Predicted', linewidth=2)
plt.legend()
plt.title('Ridge Regression with Time Series Features')
plt.show()
```

---

## Exercises

### Exercise 1: Feature Importance

Using the feature set from `create_features()`, train a Random
Forest regressor. Use `feature_importances_` to rank the features.
Which features matter most? Do lag features or calendar features
dominate?

### Exercise 2: Build and Compare

Take a real time series dataset (daily energy consumption, hourly
bike rentals, or weekly retail sales). Create a feature set with
lags, rolling stats, and calendar features. Train a Ridge
regression and compare its MAE against a seasonal naive baseline.
How much do the engineered features help?

---

Next: [Lesson 10: Machine Learning for Time Series](./10-ml-for-time-series.md)
