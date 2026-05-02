# Lesson 16: Capstone — End-to-End Forecasting Project

> Put it all together — from raw data to production-ready forecasts, using everything you've learned.

---

## Project Overview

In this capstone, you'll build a complete forecasting system using
the airline passengers dataset. The pipeline covers every step:
exploration, stationarity testing, baseline models, statistical
models, ML models, proper evaluation, and final model selection.

```
  END-TO-END PIPELINE

  +--------+    +--------+    +--------+    +--------+    +--------+
  |  EDA   | -> | Station| -> |Baseline| -> | Models | -> | Select |
  | Explore|    | arity  |    | Naive  |    | ARIMA  |    | Best   |
  | & Plot |    | Test & |    | Moving |    | XGBoost|    | Model  |
  |        |    | Diff   |    | Avg    |    | Prophet|    | Report |
  +--------+    +--------+    +--------+    +--------+    +--------+
```

---

## Step 1: Data Loading and Exploration

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from statsmodels.tsa.seasonal import STL
from statsmodels.tsa.stattools import adfuller, kpss
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
import warnings
warnings.filterwarnings('ignore')

# Load data
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url, parse_dates=['Month'], index_col='Month')
ts = df['Passengers']

# Basic info
print("=== Dataset Overview ===")
print(f"Date range:  {ts.index[0]} to {ts.index[-1]}")
print(f"Frequency:   Monthly")
print(f"Data points: {len(ts)}")
print(f"Min:         {ts.min()}")
print(f"Max:         {ts.max()}")
print(f"Mean:        {ts.mean():.1f}")
print(f"Std:         {ts.std():.1f}")
print(f"Missing:     {ts.isna().sum()}")

# Visualize
fig, axes = plt.subplots(2, 2, figsize=(14, 8))

axes[0, 0].plot(ts)
axes[0, 0].set_title('Raw Time Series')

axes[0, 1].hist(ts, bins=20, edgecolor='black')
axes[0, 1].set_title('Distribution')

axes[1, 0].boxplot([ts[ts.index.month == m].values for m in range(1, 13)],
                    labels=range(1, 13))
axes[1, 0].set_title('Monthly Box Plot')
axes[1, 0].set_xlabel('Month')

# Year-over-year comparison
for year in ts.index.year.unique():
    yearly = ts[ts.index.year == year]
    axes[1, 1].plot(yearly.index.month, yearly.values, label=str(year))
axes[1, 1].set_title('Year-over-Year')
axes[1, 1].legend(fontsize=7, ncol=2)

plt.tight_layout()
plt.show()
```

---

## Step 2: Decomposition and Stationarity

```python
# STL Decomposition
stl = STL(ts, period=12, robust=True)
result = stl.fit()
fig = result.plot()
fig.set_size_inches(14, 8)
plt.tight_layout()
plt.show()

print("\n=== Stationarity Tests (Original) ===")
adf_result = adfuller(ts, autolag='AIC')
print(f"ADF Statistic: {adf_result[0]:.4f}, p-value: {adf_result[1]:.4f}")

kpss_stat, kpss_p, _, _ = kpss(ts, regression='ct', nlags='auto')
print(f"KPSS Statistic: {kpss_stat:.4f}, p-value: {kpss_p:.4f}")

# Log transform + differencing
ts_log = np.log(ts)
ts_log_diff = ts_log.diff(12).diff().dropna()

print("\n=== Stationarity Tests (Log + Seasonal + Regular Diff) ===")
adf_result2 = adfuller(ts_log_diff)
print(f"ADF Statistic: {adf_result2[0]:.4f}, p-value: {adf_result2[1]:.4f}")

# ACF/PACF of stationary series
fig, axes = plt.subplots(1, 2, figsize=(14, 4))
plot_acf(ts_log_diff, lags=30, ax=axes[0])
plot_pacf(ts_log_diff, lags=30, ax=axes[1], method='ywm')
plt.tight_layout()
plt.show()
```

---

## Step 3: Train/Test Split

```python
# Hold out last 2 years for testing
train = ts[:'1958-12']
test = ts['1959-01':]
train_log = np.log(train)
test_log = np.log(test)

print(f"Train: {train.index[0]} to {train.index[-1]} ({len(train)} points)")
print(f"Test:  {test.index[0]} to {test.index[-1]} ({len(test)} points)")
```

---

## Step 4: Baseline Models

```python
from sklearn.metrics import mean_absolute_error

results = {}

# Baseline 1: Naive (last value)
naive_pred = pd.Series(train.iloc[-1], index=test.index)
results['Naive'] = mean_absolute_error(test, naive_pred)

# Baseline 2: Seasonal Naive (same month last year)
seasonal_naive = train.iloc[-12:].values
seasonal_naive_pred = pd.Series(seasonal_naive, index=test.index)
results['Seasonal Naive'] = mean_absolute_error(test, seasonal_naive_pred)

# Baseline 3: Moving Average (12-month)
ma_pred = pd.Series(train.rolling(12).mean().iloc[-1], index=test.index)
results['Moving Avg (12)'] = mean_absolute_error(test, ma_pred)

print("=== Baseline Results ===")
for name, mae_val in results.items():
    print(f"{name:20s} MAE: {mae_val:.2f}")
```

---

## Step 5: Statistical Models

```python
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX

# Holt-Winters
hw = ExponentialSmoothing(
    train, trend='mul', seasonal='mul', seasonal_periods=12
).fit()
hw_pred = hw.forecast(len(test))
results['Holt-Winters'] = mean_absolute_error(test, hw_pred)

# SARIMA
sarima = SARIMAX(
    train_log, order=(1, 1, 1), seasonal_order=(1, 1, 1, 12)
).fit(disp=False)
sarima_pred = np.exp(sarima.forecast(len(test)))
results['SARIMA(1,1,1)(1,1,1,12)'] = mean_absolute_error(test, sarima_pred)

# Auto ARIMA
import pmdarima as pm
auto = pm.auto_arima(train_log, seasonal=True, m=12, stepwise=True,
                     suppress_warnings=True)
auto_pred = np.exp(pd.Series(
    auto.predict(len(test)),
    index=test.index
))
results[f'auto_arima {auto.order}{auto.seasonal_order}'] = mean_absolute_error(test, auto_pred)

print("\n=== Statistical Model Results ===")
for name, mae_val in results.items():
    print(f"{name:40s} MAE: {mae_val:.2f}")
```

---

## Step 6: ML Model

```python
import xgboost as xgb

# Feature engineering
def create_features(series):
    df = pd.DataFrame({'target': series})
    for lag in [1, 2, 3, 6, 12]:
        df[f'lag_{lag}'] = series.shift(lag)
    for w in [3, 6, 12]:
        df[f'roll_mean_{w}'] = series.shift(1).rolling(w).mean()
    df['month'] = series.index.month
    df['year'] = series.index.year
    return df.dropna()

features = create_features(ts)
feat_train = features[:'1958-12']
feat_test = features['1959-01':]

X_train = feat_train.drop('target', axis=1)
y_train = feat_train['target']
X_test = feat_test.drop('target', axis=1)
y_test = feat_test['target']

xgb_model = xgb.XGBRegressor(
    n_estimators=200, max_depth=4, learning_rate=0.1, random_state=42
)
xgb_model.fit(X_train, y_train)
xgb_pred = xgb_model.predict(X_test)
results['XGBoost'] = mean_absolute_error(y_test, xgb_pred)
```

---

## Step 7: Model Comparison and Selection

```python
# Final comparison
print("\n" + "=" * 55)
print("FINAL MODEL COMPARISON")
print("=" * 55)
sorted_results = sorted(results.items(), key=lambda x: x[1])
for i, (name, mae_val) in enumerate(sorted_results):
    marker = " ← BEST" if i == 0 else ""
    print(f"{i+1}. {name:40s} MAE: {mae_val:.2f}{marker}")

best_name = sorted_results[0][0]
best_mae = sorted_results[0][1]
baseline_mae = results['Seasonal Naive']
improvement = (baseline_mae - best_mae) / baseline_mae * 100
print(f"\nBest model: {best_name}")
print(f"Improvement over seasonal naive: {improvement:.1f}%")
```

```python
# Visualization of all forecasts
plt.figure(figsize=(14, 6))
plt.plot(train[-24:], label='Train (last 2 years)', color='gray', alpha=0.5)
plt.plot(test, label='Actual', linewidth=2, color='black')
plt.plot(test.index, hw_pred, label='Holt-Winters', linestyle='--')
plt.plot(test.index, sarima_pred, label='SARIMA', linestyle='--')
plt.plot(test.index, xgb_pred, label='XGBoost', linestyle='--')
plt.plot(test.index, seasonal_naive_pred, label='Seasonal Naive', linestyle=':')
plt.legend()
plt.title('All Models — Forecast Comparison')
plt.ylabel('Passengers')
plt.tight_layout()
plt.show()
```

---

## Step 8: Final Report

```python
print("\n" + "=" * 55)
print("FORECASTING PROJECT REPORT")
print("=" * 55)
print(f"""
Dataset: Monthly Airline Passengers (1949-1960)
Train:   {train.index[0].strftime('%Y-%m')} to {train.index[-1].strftime('%Y-%m')} ({len(train)} months)
Test:    {test.index[0].strftime('%Y-%m')} to {test.index[-1].strftime('%Y-%m')} ({len(test)} months)

Key Findings:
- Data shows strong upward trend and multiplicative seasonality
- Series is non-stationary (ADF p={adf_result[1]:.4f})
- Log transform + seasonal + regular differencing achieves stationarity
- Best model: {best_name} (MAE: {best_mae:.2f})
- {improvement:.1f}% improvement over seasonal naive baseline

Recommendation:
- For this dataset, {best_name} provides the best accuracy
- Holt-Winters is a strong alternative with simpler implementation
- Seasonal naive is a surprisingly competitive baseline
""")
```

---

## Exercises

### Exercise 1: Your Own Capstone

Repeat this entire pipeline on a different dataset:
- Monthly electricity consumption
- Daily stock prices
- Weekly retail sales
- Hourly energy demand

Document your findings in a report similar to Step 8.

### Exercise 2: Extend the Pipeline

Add these enhancements to the capstone:
1. Walk-forward validation instead of a single train/test split
2. Prophet model (from Lesson 11)
3. Confidence intervals for the best model
4. A simple dashboard that shows the forecast and highlights
   periods of high uncertainty

---

Next: [Methods Comparison Reference](./reference-methods.md)
