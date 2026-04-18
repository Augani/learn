# Lesson 15: Domain Applications

> The same forecasting toolkit, three different worlds — finance, IoT, and demand forecasting each have their own rules.

---

## Why Domain Matters

A forecasting model doesn't exist in a vacuum. The same ARIMA model
that works for monthly sales might fail spectacularly on stock
prices. Each domain has unique data characteristics, pitfalls, and
evaluation criteria.

```
  DOMAIN LANDSCAPE

  +------------------+------------------+------------------+
  |    FINANCE       |      IoT         |    DEMAND        |
  +------------------+------------------+------------------+
  | Stock prices     | Sensor readings  | Retail sales     |
  | Volatility       | Machine health   | Supply chain     |
  | High frequency   | Streaming data   | Seasonal spikes  |
  | Efficient market | Missing values   | Promotions       |
  | Regime changes   | Anomalies        | External factors |
  +------------------+------------------+------------------+
```

---

## Finance: Stock Prediction Caveats

### The Hard Truth

Stock prices are notoriously difficult to forecast. The Efficient
Market Hypothesis suggests that prices already reflect all available
information, making prediction nearly impossible.

```
  WHAT YOU CAN FORECAST              WHAT YOU CAN'T
  +-------------------------+        +-------------------------+
  | Volatility (how much    |        | Direction (up or down)  |
  |   prices will move)     |        | Exact price tomorrow    |
  | Long-term trends        |        | Short-term movements    |
  | Risk metrics (VaR)      |        | Black swan events       |
  | Correlation patterns    |        | Market timing           |
  +-------------------------+        +-------------------------+
```

### Volatility Modeling with GARCH

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Simulate stock returns (in practice, use real data)
np.random.seed(42)
n = 1000
returns = np.random.randn(n) * 0.02  # ~2% daily volatility

# Add volatility clustering (calm periods and stormy periods)
for i in range(1, n):
    if abs(returns[i-1]) > 0.03:
        returns[i] *= 2  # big moves follow big moves

dates = pd.date_range('2020-01-01', periods=n, freq='B')
returns_series = pd.Series(returns, index=dates)

# GARCH model for volatility forecasting
from arch import arch_model

model = arch_model(returns_series * 100, vol='Garch', p=1, q=1)
result = model.fit(disp='off')
print(result.summary())

# Forecast volatility
forecast = result.forecast(horizon=5)
print("\nVolatility forecast (next 5 days):")
print(np.sqrt(forecast.variance.iloc[-1]))
```

### Common Finance Pitfalls

- **Look-ahead bias** — using future information in features
- **Survivorship bias** — only analyzing stocks that still exist
- **Overfitting** — finding patterns in noise
- **Transaction costs** — a model that beats the market by 0.1%
  loses money after fees

---

## IoT: Sensor Data and Predictive Maintenance

### Problem Framing

IoT time series are high-frequency, often noisy, and may have
missing values from sensor failures. The goal is usually anomaly
detection or predicting equipment failure before it happens.

```
  PREDICTIVE MAINTENANCE PIPELINE

  Sensors ──> Collect ──> Clean ──> Features ──> Model ──> Alert
    |           |          |          |           |          |
  Vibration   Stream    Handle     Rolling     Predict   Notify
  Temp        data      missing    stats       failure   before
  Pressure    to DB     values     Frequency   time      break
```

```python
# Simulated sensor data
np.random.seed(42)
n = 24 * 60  # 24 hours of minute-level data
t = np.arange(n)

# Normal operation + degradation starting at hour 18
normal = 50 + 2 * np.sin(2 * np.pi * t / 60) + np.random.randn(n) * 0.5
degradation = np.zeros(n)
degradation[18*60:] = np.linspace(0, 15, n - 18*60)  # gradual increase

sensor = pd.Series(
    normal + degradation,
    index=pd.date_range('2024-01-01', periods=n, freq='min'),
    name='temperature'
)

# Feature engineering for predictive maintenance
features = pd.DataFrame({
    'value': sensor,
    'rolling_mean_60': sensor.rolling(60).mean(),
    'rolling_std_60': sensor.rolling(60).std(),
    'rolling_max_60': sensor.rolling(60).max(),
    'rate_of_change': sensor.diff(60),  # change over last hour
})

# Simple threshold-based alert
alert_threshold = features['rolling_mean_60'].mean() + 3 * features['rolling_mean_60'].std()
alerts = features[features['rolling_mean_60'] > alert_threshold]

plt.figure(figsize=(14, 5))
plt.plot(sensor, alpha=0.5, label='Sensor reading')
plt.plot(features['rolling_mean_60'], label='60-min rolling mean', linewidth=2)
plt.axhline(alert_threshold, color='red', linestyle='--', label='Alert threshold')
plt.legend()
plt.title('Predictive Maintenance — Temperature Sensor')
plt.show()
```

### IoT-Specific Challenges

- **Missing data** — sensors go offline, packets get lost
- **High frequency** — millions of data points per day
- **Multiple sensors** — correlations between sensors matter
- **Concept drift** — normal behavior changes over time

---

## Demand Forecasting: Retail and Supply Chain

### Problem Framing

Demand forecasting drives inventory management, staffing, and
supply chain planning. Get it wrong and you either run out of
stock (lost sales) or overstock (wasted money).

```
  DEMAND FORECASTING FACTORS

  +------------------+
  |   Base Demand    |  Historical sales pattern
  +------------------+
          +
  +------------------+
  |   Seasonality    |  Holiday spikes, summer dips
  +------------------+
          +
  +------------------+
  |   Promotions     |  Sales, discounts, marketing
  +------------------+
          +
  +------------------+
  |  External Factors|  Weather, events, competitors
  +------------------+
          =
  +------------------+
  |  Final Forecast  |
  +------------------+
```

```python
# Simulated weekly retail sales
np.random.seed(42)
weeks = 156  # 3 years
t = np.arange(weeks)

# Components
base = 1000
trend = 2 * t
yearly_seasonal = 200 * np.sin(2 * np.pi * t / 52)
holiday_spikes = np.zeros(weeks)
for year in range(3):
    holiday_spikes[year * 52 + 48:year * 52 + 52] = 500  # holiday season
noise = np.random.randn(weeks) * 50

sales = pd.Series(
    base + trend + yearly_seasonal + holiday_spikes + noise,
    index=pd.date_range('2022-01-01', periods=weeks, freq='W'),
    name='weekly_sales'
)

# Feature engineering for demand forecasting
demand_features = pd.DataFrame({
    'sales': sales,
    'lag_1': sales.shift(1),
    'lag_52': sales.shift(52),  # same week last year
    'rolling_mean_4': sales.shift(1).rolling(4).mean(),
    'rolling_mean_12': sales.shift(1).rolling(12).mean(),
    'week_of_year': sales.index.isocalendar().week.values,
    'is_holiday_season': ((sales.index.month == 12) & (sales.index.day > 7)).astype(int),
})

# Train XGBoost demand model
from sklearn.metrics import mean_absolute_error
import xgboost as xgb

df_clean = demand_features.dropna()
split = int(len(df_clean) * 0.8)
train = df_clean[:split]
test = df_clean[split:]

X_train = train.drop('sales', axis=1)
y_train = train['sales']
X_test = test.drop('sales', axis=1)
y_test = test['sales']

model = xgb.XGBRegressor(n_estimators=100, max_depth=4, random_state=42)
model.fit(X_train, y_train)
predictions = model.predict(X_test)

print(f"Demand Forecast MAE: {mean_absolute_error(y_test, predictions):.0f} units")
```

### Demand Forecasting Pitfalls

- **Stockout bias** — you can't sell what you don't have (censored demand)
- **Promotion effects** — sales spikes from discounts aren't organic demand
- **Cannibalization** — promoting one product steals sales from another
- **New products** — no history to learn from (cold start problem)

---

## Exercises

### Exercise 1: Domain-Specific Forecasting

Choose one domain (finance, IoT, or demand) and:
1. Find or simulate a relevant dataset
2. Apply appropriate preprocessing for that domain
3. Build a forecasting model using techniques from this track
4. Evaluate using domain-appropriate metrics
5. Document the domain-specific pitfalls you encountered

### Exercise 2: Cross-Domain Comparison

Take the same forecasting method (e.g., SARIMA or XGBoost) and
apply it to datasets from two different domains. Compare:
1. How much preprocessing was needed for each?
2. Which features mattered most in each domain?
3. Did the same hyperparameters work for both?
4. What domain knowledge was essential?

---

Next: [Lesson 16: Capstone — End-to-End Forecasting Project](./16-end-to-end-project.md)
