# Lesson 13: Temporal Fusion Transformers

> Attention-based forecasting that tells you not just what it predicts, but why — and which inputs mattered most.

---

## Beyond LSTMs

LSTMs process sequences step by step. Transformers process the
entire sequence at once using attention — they can directly connect
any two time steps without passing information through every
intermediate step.

For forecasting, the Temporal Fusion Transformer (TFT) combines
the best of both worlds: LSTM-like sequence processing with
transformer-style attention, plus built-in variable selection that
tells you which features drove each prediction.

Cross-reference: [Advanced Deep Learning](../advanced-deep-learning/)
covers attention mechanisms in depth.

```
  LSTM                              TRANSFORMER
  x1 → x2 → x3 → x4 → output      x1 ←→ x2 ←→ x3 ←→ x4 → output
  Sequential processing             All-to-all attention
  Information must flow step        Direct connections between
  by step through the chain         any two time steps
```

---

## TFT Architecture

The Temporal Fusion Transformer has four key components:

```
  TFT ARCHITECTURE

  +--------------------------------------------------+
  |  1. Variable Selection Network                    |
  |     Learns which inputs matter (per time step)    |
  +--------------------------------------------------+
              |
  +--------------------------------------------------+
  |  2. LSTM Encoder-Decoder                          |
  |     Captures local temporal patterns              |
  +--------------------------------------------------+
              |
  +--------------------------------------------------+
  |  3. Multi-Head Attention                          |
  |     Captures long-range dependencies              |
  +--------------------------------------------------+
              |
  +--------------------------------------------------+
  |  4. Quantile Output                               |
  |     Produces prediction intervals (10th, 50th,    |
  |     90th percentiles)                             |
  +--------------------------------------------------+
```

### Variable Selection

TFT automatically learns which features are important at each
time step. This is a huge advantage over LSTMs where all inputs
are treated equally.

### Multi-Horizon Prediction

TFT predicts multiple future time steps simultaneously, not
recursively. This avoids error accumulation.

---

## N-BEATS: Another Modern Architecture

N-BEATS (Neural Basis Expansion Analysis for Time Series) takes a
different approach — it uses fully connected layers with backward
and forward residual connections.

```
  N-BEATS ARCHITECTURE

  Input ──> [Block 1] ──> [Block 2] ──> ... ──> [Block N]
               |              |                     |
               v              v                     v
            Backcast       Backcast              Backcast
            Forecast       Forecast              Forecast
               |              |                     |
               +──────────────+─────────────────────+
                              |
                         Final Forecast

  Each block: explains part of the signal, passes the rest forward
  Interpretable version: blocks specialize in trend vs seasonality
```

---

## Using TFT with pytorch-forecasting

```python
import pandas as pd
import numpy as np
import pytorch_lightning as pl
from pytorch_forecasting import TimeSeriesDataSet, TemporalFusionTransformer
from pytorch_forecasting.data import GroupNormalizer

# Prepare data in the required format
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url)
df.columns = ['date', 'passengers']
df['date'] = pd.to_datetime(df['date'])
df['time_idx'] = range(len(df))
df['group'] = 'airline'  # single series
df['month'] = df['date'].dt.month

# Define the dataset
max_encoder_length = 24   # use 24 months of history
max_prediction_length = 12  # predict 12 months ahead
training_cutoff = len(df) - max_prediction_length

training = TimeSeriesDataSet(
    df[df.time_idx <= training_cutoff],
    time_idx='time_idx',
    target='passengers',
    group_ids=['group'],
    max_encoder_length=max_encoder_length,
    max_prediction_length=max_prediction_length,
    static_categoricals=['group'],
    time_varying_known_reals=['time_idx', 'month'],
    time_varying_unknown_reals=['passengers'],
    target_normalizer=GroupNormalizer(groups=['group']),
)

# Create dataloaders
train_dataloader = training.to_dataloader(train=True, batch_size=32)
val = TimeSeriesDataSet.from_dataset(training, df, min_prediction_idx=training_cutoff + 1)
val_dataloader = val.to_dataloader(train=False, batch_size=32)
```

```python
# Define and train TFT
tft = TemporalFusionTransformer.from_dataset(
    training,
    learning_rate=0.03,
    hidden_size=16,
    attention_head_size=1,
    dropout=0.1,
    hidden_continuous_size=8,
    output_size=7,  # 7 quantiles
    loss=pytorch_forecasting.metrics.QuantileLoss(),
)

print(f"Number of parameters: {tft.size() / 1e3:.1f}k")

# Train
trainer = pl.Trainer(max_epochs=50, gradient_clip_val=0.1)
trainer.fit(tft, train_dataloaders=train_dataloader, val_dataloaders=val_dataloader)
```

---

## Interpreting Attention Outputs

The real power of TFT — understanding what the model learned.

```python
# Get predictions and interpretations
predictions = tft.predict(val_dataloader, return_x=True)

# Variable importance
interpretation = tft.interpret_output(predictions.output, reduction='sum')

# Plot variable importance
fig = tft.plot_interpretation(interpretation)
plt.show()

# Attention weights show which past time steps matter most
# for each prediction
```

```
  ATTENTION INTERPRETATION

  Past time steps:  [t-24] [t-23] ... [t-12] ... [t-1]
  Attention weight:  0.02   0.01  ...  0.15  ...  0.08
                                        ↑
                                  Same month last year
                                  gets high attention!

  Variable importance:
  passengers (lag)  ████████████████  (most important)
  month             ████████          (seasonal signal)
  time_idx          ████              (trend signal)
```

---

## When to Use TFT vs Simpler Models

```
  MODEL SELECTION GUIDE
  +------------------+----------+----------+----------+
  | Criterion        | ARIMA    | XGBoost  | TFT      |
  +------------------+----------+----------+----------+
  | Data needed      | < 100    | 100s     | 1000s+   |
  | Features         | Target   | Many     | Many     |
  |                  | only     |          |          |
  | Interpretability | High     | Medium   | High     |
  | Multi-horizon    | Yes      | Recursive| Native   |
  | Uncertainty      | Built-in | No       | Built-in |
  | Training time    | Seconds  | Seconds  | Minutes+ |
  | Multiple series  | One      | One      | Many     |
  +------------------+----------+----------+----------+
```

---

## Exercises

### Exercise 1: TFT Forecasting

Using the pytorch-forecasting library, train a TFT model on the
airline passengers dataset (or a larger dataset like the M4
competition data). Examine:
1. Which variables does the model consider most important?
2. What do the attention weights reveal about temporal patterns?
3. How do the prediction intervals compare to Prophet's?

### Exercise 2: Architecture Comparison

Compare three deep learning approaches on the same dataset:
1. LSTM (from Lesson 12)
2. TFT (from this lesson)
3. A simple feedforward network with lag features

Create a table comparing MAE, training time, and interpretability.
When is the added complexity of TFT justified?

---

Next: [Lesson 14: Anomaly Detection in Time Series](./14-anomaly-detection-ts.md)
