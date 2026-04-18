# Reference: Time Series Datasets

> Curated public datasets for practicing every technique in this track.

---

## Beginner Datasets

Great for getting started. Small, clean, well-documented.

| Dataset | Domain | Size | Frequency | Description |
|---------|--------|------|-----------|-------------|
| **Airline Passengers** | Transport | 144 points | Monthly | Classic dataset. Monthly international airline passengers 1949-1960. Strong trend + multiplicative seasonality. |
| **Sunspot Numbers** | Science | 3000+ points | Monthly | Monthly sunspot counts from 1749. ~11-year cycle. Good for cyclical pattern analysis. |
| **Nile River Flow** | Hydrology | 100 points | Annual | Annual flow of the Nile at Aswan 1871-1970. Structural break around 1898. |
| **CO2 Mauna Loa** | Climate | 700+ points | Monthly | Atmospheric CO2 concentration. Clear trend + seasonality. Available via statsmodels. |

### Quick Load

```python
import statsmodels.api as sm

# Airline passengers
air = sm.datasets.get_rdataset("AirPassengers").data

# CO2
co2 = sm.datasets.co2.load_pandas().data

# Sunspots
sunspots = sm.datasets.sunspots.load_pandas().data
```

---

## Intermediate Datasets

More complex patterns, larger size, real-world messiness.

| Dataset | Domain | Size | Frequency | Description |
|---------|--------|------|-----------|-------------|
| **Daily Minimum Temperatures** | Weather | 3650 points | Daily | Melbourne daily min temps 1981-1990. Daily seasonality + noise. |
| **Electricity Consumption** | Energy | 2000+ points | Daily/Hourly | Household or grid-level electricity usage. Multiple seasonalities (daily, weekly, yearly). |
| **Web Traffic (Wikipedia)** | Web | 145k series | Daily | Daily page views for 145k Wikipedia articles. Kaggle competition dataset. |
| **Bike Sharing** | Transport | 17k points | Hourly | Hourly bike rental counts in Washington DC. Weather + calendar effects. |
| **Jena Climate** | Weather | 420k points | 10-min | Temperature, pressure, humidity from Jena, Germany. High-frequency multivariate. |

### Download Links

- Daily Min Temps: `https://raw.githubusercontent.com/jbrownlee/Datasets/master/daily-min-temperatures.csv`
- Bike Sharing: UCI ML Repository — `https://archive.ics.uci.edu/dataset/275/bike+sharing+dataset`
- Jena Climate: Available via TensorFlow Datasets or Kaggle

---

## Advanced / Competition Datasets

Large-scale, multi-series, competition-grade.

| Dataset | Domain | Size | Frequency | Description |
|---------|--------|------|-----------|-------------|
| **M4 Competition** | Mixed | 100k series | Various | 100,000 time series across yearly, quarterly, monthly, weekly, daily, hourly frequencies. The benchmark for forecasting methods. |
| **M5 Competition** | Retail | 30k series | Daily | Walmart daily sales for 3,049 products across 10 stores. Hierarchical forecasting. |
| **Kaggle Store Sales** | Retail | 1.8M rows | Daily | Daily sales for 54 stores, 33 product families. Promotions, holidays, oil prices. |
| **ETTh/ETTm** | Energy | 70k points | Hourly/15-min | Electricity Transformer Temperature dataset. Popular DL forecasting benchmark. |
| **Weather** | Climate | 52k points | 10-min | 21 meteorological indicators. Multi-variate forecasting benchmark. |

### Download Links

- M4: `https://github.com/Mcompetitions/M4-methods/tree/master/Dataset`
- M5: Kaggle — `https://www.kaggle.com/c/m5-forecasting-accuracy`
- Store Sales: Kaggle — `https://www.kaggle.com/c/store-sales-time-series-forecasting`
- ETT: `https://github.com/zhouhaoyi/ETDataset`

---

## Domain-Specific Datasets

### Finance

| Dataset | Description | Source |
|---------|-------------|--------|
| Yahoo Finance | Stock prices, any ticker, any date range | `yfinance` Python package |
| FRED | Federal Reserve economic data (GDP, unemployment, interest rates) | `https://fred.stlouisfed.org` |
| Quandl | Financial and economic datasets | `https://data.nasdaq.com` |

### IoT / Sensor

| Dataset | Description | Source |
|---------|-------------|--------|
| NASA Turbofan | Engine degradation simulation for predictive maintenance | NASA Prognostics Data Repository |
| SKAB | Server KPIs with labeled anomalies | `https://github.com/waico/SKAB` |
| NAB | Numenta Anomaly Benchmark — streaming anomaly detection | `https://github.com/numenta/NAB` |

### Demand Forecasting

| Dataset | Description | Source |
|---------|-------------|--------|
| Rossmann Store Sales | Daily sales for 1,115 drug stores | Kaggle |
| Corporación Favorita | Grocery sales with promotions and oil prices | Kaggle |
| UCI Online Retail | Transactional data for UK online retailer | UCI ML Repository |

---

## Suggested Exercises by Dataset

| Dataset | Suggested Exercise | Relevant Lessons |
|---------|-------------------|------------------|
| Airline Passengers | Full decomposition + SARIMA + evaluation | 02, 03, 07, 08 |
| Daily Min Temps | Stationarity testing + ACF/PACF analysis | 03, 04 |
| Bike Sharing | Feature engineering + XGBoost forecasting | 09, 10 |
| M4 (monthly subset) | Compare ARIMA vs Prophet vs Holt-Winters | 06, 07, 11 |
| NASA Turbofan | Anomaly detection + predictive maintenance | 14, 15 |
| Store Sales | End-to-end demand forecasting project | 16 |
| ETTh | LSTM / TFT deep learning forecasting | 12, 13 |

---

[Back to Roadmap](./00-roadmap.md)
