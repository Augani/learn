# Reference: Forecasting Methods Comparison

> Quick-look comparison of every forecasting method covered in this track.

---

## Methods at a Glance

| Method | Type | Best For | Data Needed | Training Time | Interpretability |
|--------|------|----------|-------------|---------------|------------------|
| Naive | Baseline | Benchmarking | Any | Instant | High |
| Seasonal Naive | Baseline | Seasonal benchmarking | 1+ full season | Instant | High |
| Moving Average | Smoothing | Noise reduction, trends | 10+ points | Instant | High |
| Simple Exp. Smoothing | Statistical | No trend, no seasonality | 10+ points | Seconds | High |
| Holt's Linear | Statistical | Trend, no seasonality | 20+ points | Seconds | High |
| Holt-Winters | Statistical | Trend + seasonality | 2+ full seasons | Seconds | High |
| ARIMA | Statistical | Non-seasonal, complex autocorrelation | 50+ points | Seconds | Medium |
| SARIMA | Statistical | Seasonal + autocorrelation | 2+ full seasons | Seconds | Medium |
| Prophet | Additive | Business forecasting, holidays | 2+ years | Seconds | High |
| XGBoost/LightGBM | ML | Many features, non-linear patterns | 100+ points | Seconds | Medium |
| LSTM/GRU | Deep Learning | Long sequences, complex patterns | 1000+ points | Minutes | Low |
| Temporal Fusion Transformer | Deep Learning | Multi-horizon, multi-variate | 1000+ points | Minutes-Hours | Medium |
| N-BEATS | Deep Learning | Univariate, interpretable DL | 1000+ points | Minutes | Medium |

---

## Detailed Comparison

### Statistical Methods

| Method | Strengths | Weaknesses | When to Use |
|--------|-----------|------------|-------------|
| **SES** | Simple, fast, few parameters | No trend/seasonality handling | Stationary series, quick baseline |
| **Holt-Winters** | Handles trend + seasonality, intuitive | Limited to exponential patterns | Clear trend and seasonality, moderate data |
| **ARIMA** | Flexible autocorrelation modeling, well-understood theory | Manual parameter selection, assumes linearity | Complex autocorrelation, no seasonality |
| **SARIMA** | Full seasonal + non-seasonal modeling | Many parameters to tune, slow for large data | Seasonal data with complex autocorrelation |

### ML Methods

| Method | Strengths | Weaknesses | When to Use |
|--------|-----------|------------|-------------|
| **XGBoost** | Handles many features, non-linear, fast | No native uncertainty, needs feature engineering | External features available, enough data |
| **LightGBM** | Faster than XGBoost, handles categoricals | Same as XGBoost | Large datasets, categorical features |
| **Random Forest** | Robust, less overfitting | Slower than boosting, less accurate | When robustness matters more than accuracy |

### Deep Learning Methods

| Method | Strengths | Weaknesses | When to Use |
|--------|-----------|------------|-------------|
| **LSTM** | Learns temporal patterns automatically | Needs lots of data, slow to train, hard to tune | Long sequences, complex non-linear patterns |
| **GRU** | Simpler than LSTM, often comparable | Same data requirements as LSTM | When LSTM is too slow, similar performance needed |
| **TFT** | Interpretable attention, multi-horizon, variable selection | Complex setup, needs pytorch-forecasting | Multi-variate, need interpretability + DL power |
| **N-BEATS** | Interpretable decomposition, strong univariate performance | Univariate only, complex architecture | Univariate forecasting competitions |

### Additive Models

| Method | Strengths | Weaknesses | When to Use |
|--------|-----------|------------|-------------|
| **Prophet** | Easy to use, handles holidays, missing data, outliers | Less flexible than SARIMA, can overfit changepoints | Business forecasting, non-technical users |

---

## Computational Cost

```
  SPEED RANKING (fastest to slowest)

  Naive / Seasonal Naive     ████  (instant)
  Moving Average             ████  (instant)
  Exponential Smoothing      ███   (seconds)
  ARIMA / SARIMA             ███   (seconds)
  Prophet                    ███   (seconds)
  XGBoost / LightGBM        ██    (seconds)
  LSTM / GRU                 █     (minutes)
  TFT / N-BEATS              █     (minutes to hours)
```

---

## Decision Flowchart

```
  START
  |
  Is this a quick baseline?
  ├── YES → Seasonal Naive
  └── NO
      |
      Do you have < 100 data points?
      ├── YES → Holt-Winters or ARIMA
      └── NO
          |
          Do you have external features?
          ├── YES → XGBoost / LightGBM
          └── NO
              |
              Is the data seasonal?
              ├── YES → SARIMA or Prophet
              └── NO
                  |
                  Do you have 1000+ points?
                  ├── YES → LSTM or TFT
                  └── NO → ARIMA
```

---

[Back to Roadmap](./00-roadmap.md)
