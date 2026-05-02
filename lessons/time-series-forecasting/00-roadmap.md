# Time Series & Forecasting - Track Roadmap

Welcome to the Time Series & Forecasting track. Time is the one
dimension that changes everything. When your data has a timestamp,
the rules of machine learning shift — you can't shuffle rows, you
can't ignore yesterday, and the future depends on the past.

This track takes you from understanding what makes time series
special, through classical statistical methods that have powered
forecasting for decades, to modern deep learning approaches that
push the boundaries of what's predictable. You'll build real
forecasting systems, learn when simple beats complex, and develop
the judgment to pick the right tool for each problem.

```
  +----------------------------------------------------------+
  |           TIME SERIES & FORECASTING                      |
  |                                                          |
  |   Observe --> Decompose --> Model --> Evaluate --> Apply  |
  |     |           |            |          |           |    |
  |   Understand  Patterns    Forecast   Validate    Deploy  |
  +----------------------------------------------------------+
```

---

## Phase 1: Foundations (~6 hrs)

Understanding time series data — what makes it different, how to
break it apart, and the statistical properties that matter.

- [ ] [01 - What is a Time Series?](01-what-is-time-series.md)
- [ ] [02 - Components and Decomposition](02-components-decomposition.md)
- [ ] [03 - Stationarity and Why It Matters](03-stationarity.md)
- [ ] [04 - Autocorrelation and Partial Autocorrelation](04-autocorrelation.md)

```
  Phase 1 Focus:
  +-----------+     +-----------+     +-----------+     +-----------+
  |  What is  | --> | Decompose | --> |  Station- | --> |  ACF /    |
  |  a Time   |     |  Trend +  |     |  arity    |     |  PACF     |
  |  Series?  |     | Seasonal  |     |  Tests    |     |  Patterns |
  +-----------+     +-----------+     +-----------+     +-----------+
```

---

## Phase 2: Classical Methods (~6 hrs)

The statistical workhorses of forecasting. These methods are
interpretable, fast, and still beat deep learning on many problems.

- [ ] [05 - Moving Averages and Smoothing](05-moving-averages-smoothing.md)
- [ ] [06 - ARIMA Models](06-arima.md)
- [ ] [07 - SARIMA and Seasonal Models](07-sarima-seasonal.md)

```
  Phase 2 Focus:
  +-----------+     +-----------+     +-----------+
  | Smoothing | --> |   ARIMA   | --> |  SARIMA   |
  |  & Moving |     |  AR + MA  |     | Seasonal  |
  | Averages  |     |  + Diff   |     |  Patterns |
  +-----------+     +-----------+     +-----------+
```

---

## Phase 3: Evaluation & Features (~6 hrs)

How to properly evaluate forecasts (hint: no random splits) and
how to turn time series into features for ML models.

- [ ] [08 - Time Series Evaluation](08-evaluation-metrics.md)
- [ ] [09 - Feature Engineering for Time Series](09-feature-engineering-ts.md)
- [ ] [10 - Machine Learning for Time Series](10-ml-for-time-series.md)

```
  Phase 3 Focus:
  +-----------+     +-----------+     +-----------+
  | Walk-Fwd  | --> |   Lag &   | --> | XGBoost / |
  | Validation|     |  Rolling  |     | LightGBM  |
  |  Metrics  |     | Features  |     | Forecasts |
  +-----------+     +-----------+     +-----------+
```

---

## Phase 4: Modern Methods (~6 hrs)

Prophet for business forecasting, deep learning for complex
patterns, and transformers for state-of-the-art results.

- [ ] [11 - Prophet and Additive Models](11-prophet.md)
- [ ] [12 - Deep Learning for Forecasting](12-deep-learning-forecasting.md)
- [ ] [13 - Temporal Fusion Transformers](13-temporal-fusion-transformers.md)

```
  Phase 4 Focus:
  +-----------+     +-----------+     +-----------+
  |  Prophet  | --> |   LSTM /  | --> | Temporal  |
  |  Additive |     |   GRU     |     |  Fusion   |
  |  Models   |     | Sequence  |     | Transform |
  +-----------+     +-----------+     +-----------+
```

---

## Phase 5: Applications & Capstone (~6 hrs)

Anomaly detection, domain-specific forecasting, and a complete
end-to-end project that ties everything together.

- [ ] [14 - Anomaly Detection in Time Series](14-anomaly-detection-ts.md)
- [ ] [15 - Domain Applications](15-domain-applications.md)
- [ ] [16 - Capstone: End-to-End Forecasting Project](16-end-to-end-project.md)

```
  Phase 5 Focus:
  +-----------+     +-----------+     +-----------+
  |  Anomaly  | --> |  Finance  | --> | End-to-   |
  | Detection |     |  IoT /    |     |  End      |
  |  Alerts   |     |  Demand   |     |  Project  |
  +-----------+     +-----------+     +-----------+
```

---

## Reference Materials

Quick-look resources you will keep coming back to.

- [Methods Comparison Table](./reference-methods.md) — All forecasting methods compared: strengths, weaknesses, use cases
- [Datasets Reference](./reference-datasets.md) — Curated public time series datasets for practice

---

## How to Use This Track

```
  +---------------------------------------------------+
  |  1. Read the lesson on your phone/tablet          |
  |  2. Try the code examples in a Jupyter notebook   |
  |  3. Do the exercises with real datasets            |
  |  4. Check the box when you feel confident          |
  |  5. Move to the next lesson                        |
  +---------------------------------------------------+
```

**Time estimate:** ~28-32 hours total (4-5 weeks at ~1 hour per day)

**Prerequisites:**
- Python (loops, functions, pandas basics)
- Applied ML track recommended (feature engineering, model evaluation)
- Basic statistics (mean, variance, correlation)

**Tools you will need:**
- Python 3.8+
- pip install pandas numpy matplotlib statsmodels scikit-learn pmdarima prophet xgboost pytorch-forecasting

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Forecasting: Principles and Practice** by Rob J Hyndman and George Athanasopoulos (OTexts, 3rd Edition 2021) — The forecasting bible. *Free online at otexts.com/fpp3*
- **Time Series Analysis and Its Applications** by Robert H. Shumway and David S. Stoffer (Springer, 4th Edition 2017) — Rigorous statistical treatment of time series methods

---

[Start with Lesson 01: What is a Time Series? -->](01-what-is-time-series.md)
