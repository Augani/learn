# Lesson 12: Deep Learning for Forecasting

> Neural networks learn temporal patterns directly from raw sequences — no manual feature engineering required.

---

## Why Deep Learning for Time Series?

Statistical methods (ARIMA) and ML methods (XGBoost) both require
you to decide the structure: how many lags, which features, what
transformations. Deep learning models learn the temporal structure
directly from the raw sequence.

The trade-off: they need more data, more compute, and more tuning.
But when you have enough data and complex patterns, they can
capture relationships that other methods miss.

Cross-reference: [ML Fundamentals](../ml-fundamentals/) covers
neural network basics.

```
  STATISTICAL          ML                  DEEP LEARNING
  +------------+       +------------+      +------------+
  | You define |       | You define |      | Model      |
  | the model  |       | features   |      | learns     |
  | structure  |       | Model      |      | features   |
  | (p,d,q)    |       | learns     |      | AND        |
  |            |       | weights    |      | structure  |
  +------------+       +------------+      +------------+
  ARIMA, ETS           XGBoost, RF         LSTM, GRU
```

---

## RNNs: The Foundation

A Recurrent Neural Network processes sequences one step at a time,
maintaining a hidden state that carries information forward.

```
  RNN UNROLLED

  x(1) ──> [h1] ──> x(2) ──> [h2] ──> x(3) ──> [h3] ──> ŷ
            |                  |                  |
            h(0)              h(1)               h(2)

  Each step: h(t) = f(W·x(t) + U·h(t-1) + b)

  Problem: vanilla RNNs forget long-term patterns
  (vanishing gradient problem)
```

---

## LSTMs: Long-Term Memory

LSTMs solve the vanishing gradient problem with a gating mechanism
that controls what to remember and what to forget.

```
  LSTM CELL

  +--------------------------------------------------+
  |                                                    |
  |  Forget Gate: What to discard from memory          |
  |  Input Gate:  What new info to store               |
  |  Output Gate: What to output from memory           |
  |                                                    |
  |  Cell State ──────────────────────────> (long-term)|
  |       ↑ forget    ↑ add new                        |
  |  Hidden State ────────────────────────> (short-term)|
  +--------------------------------------------------+
```

---

## GRUs: Simplified LSTMs

GRUs combine the forget and input gates into a single update gate.
Fewer parameters, often similar performance.

```
  LSTM vs GRU
  +------------------+------------------+
  | LSTM             | GRU              |
  +------------------+------------------+
  | 3 gates          | 2 gates          |
  | More parameters  | Fewer parameters |
  | Cell + hidden    | Hidden state     |
  |   state          |   only           |
  | Better for very  | Faster training  |
  |   long sequences | Often comparable |
  +------------------+------------------+
```

---

## Building an LSTM Forecaster in PyTorch

```python
import torch
import torch.nn as nn
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# Load and prepare data
url = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv'
df = pd.read_csv(url, parse_dates=['Month'], index_col='Month')
values = df['Passengers'].values.astype(float)

# Normalize
from sklearn.preprocessing import MinMaxScaler
scaler = MinMaxScaler()
scaled = scaler.fit_transform(values.reshape(-1, 1)).flatten()

# Create sequences: use last `seq_len` values to predict next value
def create_sequences(data, seq_len):
    X, y = [], []
    for i in range(len(data) - seq_len):
        X.append(data[i:i + seq_len])
        y.append(data[i + seq_len])
    return np.array(X), np.array(y)

SEQ_LEN = 12
X, y = create_sequences(scaled, SEQ_LEN)

# Train/test split (chronological)
split = int(len(X) * 0.8)
X_train, X_test = X[:split], X[split:]
y_train, y_test = y[:split], y[split:]

# Convert to PyTorch tensors
X_train_t = torch.FloatTensor(X_train).unsqueeze(-1)  # (batch, seq, 1)
y_train_t = torch.FloatTensor(y_train)
X_test_t = torch.FloatTensor(X_test).unsqueeze(-1)
y_test_t = torch.FloatTensor(y_test)
```

```python
# Define LSTM model
class LSTMForecaster(nn.Module):
    def __init__(self, input_size=1, hidden_size=64, num_layers=2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.2
        )
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        last_hidden = lstm_out[:, -1, :]  # take last time step
        return self.fc(last_hidden).squeeze()

model = LSTMForecaster()
print(model)
print(f"Parameters: {sum(p.numel() for p in model.parameters()):,}")
```

---

## Training Loop

```python
criterion = nn.MSELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

# Training
epochs = 100
train_losses = []

for epoch in range(epochs):
    model.train()
    optimizer.zero_grad()
    output = model(X_train_t)
    loss = criterion(output, y_train_t)
    loss.backward()
    optimizer.step()
    train_losses.append(loss.item())

    if (epoch + 1) % 20 == 0:
        print(f"Epoch {epoch+1}/{epochs}, Loss: {loss.item():.6f}")

# Plot training loss
plt.figure(figsize=(10, 4))
plt.plot(train_losses)
plt.xlabel('Epoch')
plt.ylabel('MSE Loss')
plt.title('Training Loss')
plt.show()
```

---

## Evaluation and Comparison

```python
# Predict
model.eval()
with torch.no_grad():
    predictions = model(X_test_t).numpy()

# Inverse transform
pred_actual = scaler.inverse_transform(predictions.reshape(-1, 1)).flatten()
y_actual = scaler.inverse_transform(y_test.reshape(-1, 1)).flatten()

# Metrics
from sklearn.metrics import mean_absolute_error
mae = mean_absolute_error(y_actual, pred_actual)
print(f"LSTM MAE: {mae:.2f}")

# Plot
plt.figure(figsize=(12, 5))
plt.plot(range(len(y_actual)), y_actual, label='Actual')
plt.plot(range(len(pred_actual)), pred_actual, label='LSTM Prediction')
plt.legend()
plt.title(f'LSTM Forecast (MAE: {mae:.2f})')
plt.show()
```

---

## Encoder-Decoder for Multi-Step Forecasting

For predicting multiple steps ahead, use an encoder-decoder
architecture. The encoder processes the input sequence, and the
decoder generates the output sequence.

```python
class EncoderDecoder(nn.Module):
    def __init__(self, input_size=1, hidden_size=64, output_steps=12):
        super().__init__()
        self.output_steps = output_steps
        self.encoder = nn.LSTM(input_size, hidden_size, batch_first=True)
        self.decoder = nn.LSTM(input_size, hidden_size, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        # Encode
        _, (hidden, cell) = self.encoder(x)

        # Decode: use last input as first decoder input
        decoder_input = x[:, -1:, :]  # (batch, 1, 1)
        outputs = []

        for _ in range(self.output_steps):
            decoder_out, (hidden, cell) = self.decoder(decoder_input, (hidden, cell))
            pred = self.fc(decoder_out)
            outputs.append(pred)
            decoder_input = pred  # feed prediction back

        return torch.cat(outputs, dim=1).squeeze(-1)
```

```
  ENCODER-DECODER ARCHITECTURE

  Input sequence          Output sequence
  [x1, x2, ..., xn] --> ENCODER --> [hidden state] --> DECODER --> [ŷ1, ŷ2, ..., ŷm]
                                                          ↑
                                                    Feed predictions
                                                    back as input
```

---

## Exercises

### Exercise 1: LSTM Forecaster

Build and train the LSTM model from this lesson on the airline
passengers dataset. Experiment with:
1. Different `hidden_size` values (32, 64, 128)
2. Different `seq_len` values (6, 12, 24)
3. Different `num_layers` (1, 2, 3)

Which configuration gives the best test MAE?

### Exercise 2: LSTM vs ARIMA

Using the same dataset and train/test split, compare:
1. LSTM (best configuration from Exercise 1)
2. SARIMA (from Lesson 07)
3. XGBoost (from Lesson 10)

Create a comparison table with MAE and RMSE. Which model wins?
Is the deep learning complexity justified for this dataset size?

---

Next: [Lesson 13: Temporal Fusion Transformers](./13-temporal-fusion-transformers.md)
