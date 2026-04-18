# Lesson 10: Machine Learning for Time Series

> When you turn time into features, gradient boosting becomes a forecasting powerhouse.

---

## When ML Beats ARIMA

ARIMA is elegant but limited — it only uses the target series
itself. ML models like XGBoost can use dozens of features: lags,
rolling stats, calendar info, external variables (weather, holidays,
promotions). When the signal lives in those extra features, ML wins.

```
  ARIMA                             ML (XGBoost/LightGBM)
  +-------------------+             +-------------------+
  | Input: past values|             | Input: features   |
  | of target series  |             | - Lags            |
  | only              |             | - Rolling stats   |
  |                   |             | - Calendar        |
  |                   |             | - External vars   |
  +-------------------+             +-------------------+
  | Strengths:        |             | Strengths:        |
  | - Interpretable   |             | - Handles many    |
  | - Few data points |             |   features        |
  | - Uncertainty     |             | - Non-linear      |
  |   intervals       |             | - External data   |
  +-------------------+             +-------------------+
```

Cross-reference: [Applied ML Lessons 06-08](../applied-ml/) cover
XGBoost and Random Forests in depth.

---

## XGBoost Forecasting Pipeline

```python
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error
import matplotlib.pyplot as plt

# Load airline passengers
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url, parse_dates=['Month'], index_col='Month')
ts = df['Passengers']

# Feature engineering
def create_ml_features(series):
    df = pd.DataFrame({'target': series})

    # Lag features
    for lag in [1, 2, 3, 6, 12]:
        df[f'lag_{lag}'] = series.shift(lag)

    # Rolling features
    for w in [3, 6, 12]:
        df[f'roll_mean_{w}'] = series.shift(1).rolling(w).mean()
        df[f'roll_std_{w}'] = series.shift(1).rolling(w).std()

    # Calendar features
    df['month'] = series.index.month
    df['year'] = series.index.year

    return df.dropna()

features = create_ml_features(ts)
print(f"Features: {[c for c in features.columns if c != 'target']}")
```

```python
# Time-based split
split = '1958-01'
train = features[:split]
test = features[split:]

X_train = train.drop('target', axis=1)
y_train = train['target']
X_test = test.drop('target', axis=1)
y_test = test['target']

# Train XGBoost
model = xgb.XGBRegressor(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42
)
model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

# Predict
predictions = model.predict(X_test)
print(f"MAE:  {mean_absolute_error(y_test, predictions):.2f}")
print(f"RMSE: {np.sqrt(mean_squared_error(y_test, predictions)):.2f}")
```

---

## Feature Importance Analysis

One of ML's biggest advantages — you can see what drives the
forecast.

```python
# Built-in feature importance
importance = model.feature_importances_
feature_names = X_train.columns

# Sort and plot
idx = np.argsort(importance)
plt.figure(figsize=(10, 6))
plt.barh(range(len(idx)), importance[idx])
plt.yticks(range(len(idx)), feature_names[idx])
plt.xlabel('Feature Importance')
plt.title('XGBoost Feature Importance for Time Series')
plt.tight_layout()
plt.show()
```

```
  TYPICAL FEATURE IMPORTANCE RANKING

  lag_12      ████████████████████  (same month last year)
  lag_1       ██████████████        (last month)
  month       ████████████          (seasonality)
  roll_mean_12 ██████████           (yearly trend)
  lag_6       ████████              (6 months ago)
  roll_std_12 ██████                (volatility)
  ...
```

---

## LightGBM Alternative

LightGBM is often faster than XGBoost and handles categorical
features natively.

```python
import lightgbm as lgb

lgb_model = lgb.LGBMRegressor(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42
)
lgb_model.fit(X_train, y_train)

lgb_predictions = lgb_model.predict(X_test)
print(f"LightGBM MAE: {mean_absolute_error(y_test, lgb_predictions):.2f}")
```

---

## XGBoost vs ARIMA: Head-to-Head

```python
from statsmodels.tsa.statespace.sarimax import SARIMAX

# Fit SARIMA
sarima = SARIMAX(
    ts[:split],
    order=(1, 1, 1),
    seasonal_order=(1, 1, 1, 12)
).fit(disp=False)

sarima_forecast = sarima.get_forecast(steps=len(test))
sarima_pred = sarima_forecast.predicted_mean

# Compare
print("=== Model Comparison ===")
print(f"SARIMA  MAE: {mean_absolute_error(y_test, sarima_pred):.2f}")
print(f"XGBoost MAE: {mean_absolute_error(y_test, predictions):.2f}")

# Plot both
plt.figure(figsize=(12, 5))
plt.plot(y_test.index, y_test.values, label='Actual', linewidth=2)
plt.plot(y_test.index, sarima_pred.values, label='SARIMA', linestyle='--')
plt.plot(y_test.index, predictions, label='XGBoost', linestyle='--')
plt.legend()
plt.title('SARIMA vs XGBoost — Airline Passengers')
plt.show()
```

```
  WHEN TO USE WHAT
  +------------------+------------------+
  | Use ARIMA when   | Use ML when      |
  +------------------+------------------+
  | Few data points  | Lots of data     |
  | No external vars | External features|
  | Need confidence  | Complex patterns |
  |   intervals      | Non-linear       |
  | Interpretability | relationships    |
  |   is critical    | Feature          |
  |                  |   importance     |
  +------------------+------------------+
```

---

## Multi-Step Forecasting with ML

ML models predict one step at a time. For multi-step forecasts,
use recursive prediction — feed predictions back as features.

```python
def recursive_forecast(model, last_features, steps, feature_names):
    """Recursively forecast multiple steps ahead."""
    predictions = []
    current = last_features.copy()

    for _ in range(steps):
        pred = model.predict(current[feature_names].values.reshape(1, -1))[0]
        predictions.append(pred)

        # Shift lags (simplified — update lag_1 with prediction)
        for lag in sorted([int(c.split('_')[1]) for c in feature_names if c.startswith('lag_')], reverse=True):
            if lag > 1:
                prev_lag = f'lag_{lag - 1}'
                if prev_lag in current:
                    current[f'lag_{lag}'] = current[prev_lag]
            else:
                current['lag_1'] = pred

    return predictions
```

---

## Exercises

### Exercise 1: XGBoost vs ARIMA Showdown

Using a dataset of your choice (monthly sales, daily temperatures,
or weekly web traffic):
1. Build an XGBoost model with lag, rolling, and calendar features
2. Fit a SARIMA model
3. Evaluate both with walk-forward validation
4. Which wins? Analyze feature importance to understand why.

### Exercise 2: External Features

Find a time series where external data could help (e.g., ice cream
sales + temperature, retail sales + holiday calendar). Add external
features to your XGBoost model. Does the external data improve the
forecast compared to using only lag/rolling features?

---

Next: [Lesson 11: Prophet and Additive Models](./11-prophet.md)
