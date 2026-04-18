# Lesson 04: Autocorrelation and Partial Autocorrelation

> ACF and PACF are the X-ray of your time series — they reveal the hidden structure that guides model selection.

---

## The Echo Analogy

Shout in a canyon and you hear echoes. The first echo is loud and
clear. The second is fainter. By the third or fourth, it's barely
audible. Autocorrelation works the same way — today's value echoes
into tomorrow, the day after, and beyond, but the echo fades.

ACF measures all the echoes (direct and indirect). PACF measures
only the direct echo at each lag, filtering out the indirect ones.
Together, they tell you exactly how your time series remembers its
past.

```
  THE ECHO EFFECT

  Today's value ──────> Tomorrow (strong echo)
       |                     |
       +──────────────> Day +2 (weaker echo)
       |                     |
       +──────────────> Day +3 (faint echo)
       |
       +──────────────> Day +4 (barely there)

  ACF:  measures ALL echoes (direct + indirect)
  PACF: measures ONLY direct echoes (removes indirect)
```

---

## Autocorrelation Function (ACF)

The ACF measures the correlation between a time series and its
lagged versions. At lag k, it's the correlation between y(t) and
y(t-k).

```
  ACF PLOT (Correlogram)

  Correlation
   1.0 |█
       |█ █
   0.5 |█ █ █
       |█ █ █ █
   0.0 |█-█-█-█-█-█-█-█-█--- (significance band)
       |          █ █
  -0.5 |
       +--+--+--+--+--+--+--+--> Lag
        0  1  2  3  4  5  6  7

  Bars outside the shaded band are statistically significant.
```

Key patterns to recognize:

- **Slow decay** → non-stationary series (needs differencing)
- **Sharp cutoff after lag q** → MA(q) process
- **Alternating positive/negative** → possible over-differencing

---

## Partial Autocorrelation Function (PACF)

The PACF measures the correlation between y(t) and y(t-k) after
removing the effects of all intermediate lags. It isolates the
direct relationship.

```
  PACF PLOT

  Correlation
   1.0 |█
       |█
   0.5 |█ █
       |█ █
   0.0 |█-█---█-█-█-█-█-█--- (significance band)
       |    █
  -0.5 |
       +--+--+--+--+--+--+--+--> Lag
        0  1  2  3  4  5  6  7

  Sharp cutoff after lag p → AR(p) process
```

---

## Reading ACF/PACF for Model Selection

This is the practical payoff — ACF and PACF patterns tell you
which ARIMA parameters to use.

```
  PATTERN RECOGNITION GUIDE
  +------------------+------------------+------------------+
  | Pattern          | ACF              | PACF             |
  +------------------+------------------+------------------+
  | AR(p)            | Gradual decay    | Cuts off at p    |
  | MA(q)            | Cuts off at q    | Gradual decay    |
  | ARMA(p,q)        | Gradual decay    | Gradual decay    |
  | Non-stationary   | Very slow decay  | Large lag-1      |
  | White noise      | All near zero    | All near zero    |
  | Seasonal (s=12)  | Spikes at 12,24  | Spike at 12      |
  +------------------+------------------+------------------+
```

```
  AR(1) PATTERN                     MA(1) PATTERN

  ACF:  Exponential decay           ACF:  Spike at lag 1, then zero
  |████                             |████
  |██                               |██
  |█                                |
  |                                 |
  +---------> Lag                   +---------> Lag

  PACF: Spike at lag 1 only         PACF: Exponential decay
  |████                             |████
  |                                 |██
  |                                 |█
  |                                 |
  +---------> Lag                   +---------> Lag
```

---

## Computing ACF and PACF in Python

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
from statsmodels.tsa.stattools import acf, pacf

# Load data
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url, parse_dates=['Month'], index_col='Month')
ts = df['Passengers']

# Make stationary first (log + differencing)
ts_stationary = np.log(ts).diff().dropna()

# Plot ACF and PACF side by side
fig, axes = plt.subplots(1, 2, figsize=(14, 4))

plot_acf(ts_stationary, lags=30, ax=axes[0])
axes[0].set_title('ACF')

plot_pacf(ts_stationary, lags=30, ax=axes[1], method='ywm')
axes[1].set_title('PACF')

plt.tight_layout()
plt.show()
```

```python
# Get numerical ACF values
acf_values = acf(ts_stationary, nlags=12)
print("ACF values (lags 0-12):")
for i, val in enumerate(acf_values):
    bar = '█' * int(abs(val) * 30)
    sign = '+' if val >= 0 else '-'
    print(f"  Lag {i:2d}: {val:+.3f} {sign}{bar}")
```

---

## Lag Plots

A lag plot shows y(t) vs y(t-k) as a scatter plot. Strong
correlation appears as a tight diagonal pattern.

```python
from pandas.plotting import lag_plot

fig, axes = plt.subplots(1, 3, figsize=(14, 4))

for i, lag in enumerate([1, 6, 12]):
    lag_plot(ts, lag=lag, ax=axes[i])
    axes[i].set_title(f'Lag {lag}')

plt.tight_layout()
plt.show()
```

```
  LAG PLOT INTERPRETATION

  Strong correlation (lag 1)    Weak correlation (lag 6)
  y(t)                          y(t)
  |      .***.                  |    . .  . .
  |    .** **.                  |  .  . .. .
  |   ** . .**                  | . .  . . .
  |  **  .  **                  |. . .  . .
  | **  .   .**                 | .  . . .
  +--------------> y(t-1)      +--------------> y(t-6)
```

---

## Exercises

### Exercise 1: ACF/PACF Detective

Generate three synthetic time series using numpy:
1. An AR(2) process: `y(t) = 0.6*y(t-1) - 0.3*y(t-2) + noise`
2. An MA(1) process: `y(t) = noise + 0.7*noise(t-1)`
3. White noise: `y(t) = noise`

Plot the ACF and PACF for each. Can you identify which is which
just from the plots? Match the patterns to the guide above.

### Exercise 2: Real Data Interpretation

Take the airline passengers dataset (or another seasonal dataset).
Make it stationary, then plot ACF and PACF. Answer:
1. What lag shows the strongest autocorrelation?
2. Is there evidence of seasonal autocorrelation?
3. Based on the ACF/PACF patterns, what ARIMA order would you try?

---

Next: [Lesson 05: Moving Averages and Smoothing](./05-moving-averages-smoothing.md)
