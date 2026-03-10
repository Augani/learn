# Lesson 11: RNNs and LSTMs — Learning from Sequences

CNNs are great for images — data with spatial structure. But what about
data where ORDER matters? Text, time series, music, stock prices. The
meaning depends on the sequence.

"Dog bites man" vs "Man bites dog" — same words, completely different
meaning. You need a network that understands order.

---

## Why Order Matters

A fully connected network treats inputs as an unordered bag:

```
Fully connected sees:     {bites, dog, man}
                          Same as:
                          {man, bites, dog}

We need a network that sees:
    "dog" → "bites" → "man"     (normal)
    "man" → "bites" → "dog"     (newsworthy)
```

**Go analogy:** The difference between a `map[string]int` (unordered)
and a `[]string` (ordered). For text, order is everything.

---

## The RNN Idea: Memory That Carries Forward

A Recurrent Neural Network processes one element at a time and maintains
a **hidden state** — a memory that carries information from previous
elements.

```
Regular network:   Input → [Network] → Output
                   (no memory, each input independent)

RNN:               Input₁ → [Network + Memory] → Output₁
                                   ↓ (pass memory)
                   Input₂ → [Network + Memory] → Output₂
                                   ↓ (pass memory)
                   Input₃ → [Network + Memory] → Output₃
```

**Analogy — reading a book:**

A regular network is like reading each word in isolation — you see
"bank" but don't know if it means a river bank or a financial bank.

An RNN is like YOU reading a book. When you reach the word "bank,"
you remember the previous words ("the river overflowed its...") and
know it means a river bank. Your brain carries context forward.

---

## The RNN Equations

At each time step t:

```
h_t = tanh(W_hh * h_{t-1} + W_xh * x_t + b_h)
y_t = W_hy * h_t + b_y

Where:
  x_t     = input at time t
  h_{t-1} = hidden state from previous step (the memory)
  h_t     = new hidden state (updated memory)
  y_t     = output at time t
  W_hh    = weights for hidden-to-hidden (how memory transforms)
  W_xh    = weights for input-to-hidden (how input enters memory)
  W_hy    = weights for hidden-to-output (how memory produces output)
```

**The key insight:** The hidden state `h_t` is a compressed summary of
everything the network has seen so far. At step 5, it encodes information
from steps 1, 2, 3, 4, and 5.

---

## Unrolling Through Time

The same network is applied at each time step. We "unroll" it to
visualize the full sequence:

```
                    Unrolled RNN processing "the cat sat"

    "the"          "cat"          "sat"
      │              │              │
      ▼              ▼              ▼
   ┌──────┐       ┌──────┐       ┌──────┐
   │      │──h₁──→│      │──h₂──→│      │──h₃──→ final hidden state
   │ RNN  │       │ RNN  │       │ RNN  │
   │ Cell │       │ Cell │       │ Cell │
   └──────┘       └──────┘       └──────┘
      │              │              │
      ▼              ▼              ▼
    out₁           out₂           out₃

   Same weights W_hh, W_xh, W_hy are SHARED across all steps!
```

**Important:** There's only ONE set of weights. The RNN cell is the same
at every time step — it's the hidden state that changes. This is
parameter sharing across time (just like CNN shares filters across space).

**TypeScript analogy:**

```typescript
// An RNN is like a reduce/fold operation
const finalState = words.reduce(
    (hiddenState, word) => rnnCell(hiddenState, word),
    initialHiddenState
);
```

---

## Hidden State as Short-Term Memory

The hidden state is a vector (say, 128 numbers) that encodes the
network's "understanding" of what it has read so far.

```
Processing: "The quick brown fox jumps"

After "The":      h₁ = [0.1, -0.3, 0.5, ...]  "Start of sentence, article"
After "quick":    h₂ = [0.4, -0.1, 0.7, ...]  "Something is quick"
After "brown":    h₃ = [0.3, -0.2, 0.8, ...]  "Something quick and brown"
After "fox":      h₄ = [0.6, 0.1, 0.9, ...]   "A quick brown fox"
After "jumps":    h₅ = [0.8, 0.3, 0.4, ...]   "The fox is jumping"

Each h is a compressed summary of the sequence so far.
You don't design what these numbers mean — the network learns it.
```

---

## The Vanishing Gradient Problem in RNNs

Here's the fundamental problem. When you backpropagate through time,
gradients must flow backward through every time step:

```
Gradient flow for a 10-word sentence:

step 10 ← step 9 ← step 8 ← ... ← step 2 ← step 1

Each arrow multiplies by W_hh.
If the largest eigenvalue of W_hh < 1:
    gradient shrinks exponentially → vanishes

After 10 steps:  gradient ≈ 0.5^10 = 0.001
After 20 steps:  gradient ≈ 0.5^20 = 0.000001
After 50 steps:  gradient ≈ effectively zero
```

The network CAN'T learn long-range dependencies because the gradient
signal from early words is essentially zero by the time it reaches them.

**Analogy:** A game of telephone with 50 people. By the time the
message reaches the first person (going backward), it's completely garbled.
Early words in a sentence get no useful learning signal.

```
"The doctor who treated the patient that was admitted after the
accident involving the truck on highway 95 last Tuesday ... was tired."

An RNN struggles to connect "doctor" (word 2) to "was tired" (word 20+).
The gradient from "was tired" vanishes before reaching "doctor."
```

---

## LSTM — The Solution

Long Short-Term Memory (LSTM) cells solve vanishing gradients with
**gates** — learned mechanisms that control what information to keep,
discard, and output.

### The Three Gates

```
┌────────────────────────────────────────────────────────────┐
│                      LSTM Cell                              │
│                                                             │
│  FORGET GATE:    "What should I erase from memory?"         │
│  f_t = sigmoid(W_f · [h_{t-1}, x_t] + b_f)                │
│                                                             │
│  INPUT GATE:     "What new info should I memorize?"         │
│  i_t = sigmoid(W_i · [h_{t-1}, x_t] + b_i)                │
│  candidate = tanh(W_c · [h_{t-1}, x_t] + b_c)             │
│                                                             │
│  OUTPUT GATE:    "What should I output right now?"          │
│  o_t = sigmoid(W_o · [h_{t-1}, x_t] + b_o)                │
│                                                             │
│  CELL STATE UPDATE:                                         │
│  c_t = f_t * c_{t-1} + i_t * candidate                     │
│         ↑ forget old    ↑ add new                           │
│                                                             │
│  HIDDEN STATE:                                              │
│  h_t = o_t * tanh(c_t)                                     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Analogy — a notebook with a pen and an eraser:**

| Gate | Role | Analogy |
|------|------|---------|
| Forget gate | Decides what to erase | Eraser: remove irrelevant old notes |
| Input gate | Decides what to write | Pen: write important new information |
| Output gate | Decides what to share | Highlighter: mark what's relevant NOW |

The **cell state** (`c_t`) is the notebook itself — a long-term memory
that flows through time with minimal modification. Because it's updated
through addition (not multiplication), gradients flow through it much
more easily.

### Information Flow Through an LSTM

```
                  Forget gate    Input gate
                     ↓              ↓
    c_{t-1} ──────[× f_t]────[+ i_t × cand]──────→ c_t
    (old memory)   erase some   add new info       (new memory)
                                                        │
                                                   [tanh]
                                                        │
                                                   [× o_t] ← Output gate
                                                        │
    h_{t-1} ─────────────────────────────────────→ h_t
    (old hidden)     (used in gate computations)   (new hidden)
         │                                              │
         └──── fed into next time step's gates ────────┘


    x_t (current input) ── fed into all three gates
```

### Why LSTMs Solve Vanishing Gradients

The cell state is a **highway** for gradients. The forget gate can be
close to 1.0, meaning "keep everything" — gradients flow straight
through without being multiplied by small numbers.

```
Regular RNN gradient path:
  h₁ ←[× W_hh]← h₂ ←[× W_hh]← h₃ ←[× W_hh]← ... ← h₁₀
  Each multiplication can shrink the gradient.

LSTM cell state gradient path:
  c₁ ←[× f₂]← c₂ ←[× f₃]← c₃ ←[× f₄]← ... ← c₁₀
  Forget gates are typically close to 1.0, so the gradient stays strong.
```

---

## GRU — A Simpler Alternative

The Gated Recurrent Unit combines the forget and input gates into a
single "update gate" and merges the cell state with the hidden state.

```
LSTM: 3 gates (forget, input, output) + cell state + hidden state
GRU:  2 gates (reset, update) + hidden state only
```

GRUs have fewer parameters and train faster. Performance is roughly
similar to LSTMs for most tasks. When in doubt, try both.

```python
# In PyTorch, switching between RNN, LSTM, GRU is trivial:
rnn = nn.RNN(input_size=32, hidden_size=64, num_layers=1)
lstm = nn.LSTM(input_size=32, hidden_size=64, num_layers=1)
gru = nn.GRU(input_size=32, hidden_size=64, num_layers=1)
```

---

## Building an RNN in PyTorch

Let's build a character-level language model that learns to predict
the next character in a sequence.

```python
import torch
import torch.nn as nn
import numpy as np

text = "hello world " * 100
chars = sorted(set(text))
char_to_idx = {ch: i for i, ch in enumerate(chars)}
idx_to_char = {i: ch for ch, i in char_to_idx.items()}
vocab_size = len(chars)

def encode(s):
    return [char_to_idx[c] for c in s]

def decode(indices):
    return ''.join(idx_to_char[i] for i in indices)


class CharRNN(nn.Module):
    def __init__(self, vocab_size, hidden_size):
        super().__init__()
        self.hidden_size = hidden_size
        self.embedding = nn.Embedding(vocab_size, hidden_size)
        self.rnn = nn.RNN(hidden_size, hidden_size, batch_first=True)
        self.fc = nn.Linear(hidden_size, vocab_size)

    def forward(self, x, hidden=None):
        x = self.embedding(x)
        output, hidden = self.rnn(x, hidden)
        output = self.fc(output)
        return output, hidden


seq_length = 10
hidden_size = 64
model = CharRNN(vocab_size, hidden_size)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

encoded_text = encode(text)
inputs = []
targets = []
for i in range(0, len(encoded_text) - seq_length):
    inputs.append(encoded_text[i:i + seq_length])
    targets.append(encoded_text[i + 1:i + seq_length + 1])

X = torch.tensor(inputs)
Y = torch.tensor(targets)

for epoch in range(200):
    optimizer.zero_grad()
    output, _ = model(X)
    loss = criterion(output.view(-1, vocab_size), Y.view(-1))
    loss.backward()
    optimizer.step()
    if epoch % 40 == 0:
        print(f"Epoch {epoch:3d} | Loss: {loss.item():.4f}")

model.eval()
start = torch.tensor([[char_to_idx['h']]])
hidden = None
generated = ['h']
for _ in range(30):
    output, hidden = model(start, hidden)
    probs = torch.softmax(output[0, -1], dim=0)
    next_char_idx = torch.multinomial(probs, 1).item()
    generated.append(idx_to_char[next_char_idx])
    start = torch.tensor([[next_char_idx]])

print(f"Generated: {''.join(generated)}")
```

---

## Building an LSTM in PyTorch

Replace `nn.RNN` with `nn.LSTM` — that's the only change:

```python
class CharLSTM(nn.Module):
    def __init__(self, vocab_size, hidden_size):
        super().__init__()
        self.hidden_size = hidden_size
        self.embedding = nn.Embedding(vocab_size, hidden_size)
        self.lstm = nn.LSTM(hidden_size, hidden_size, batch_first=True)
        self.fc = nn.Linear(hidden_size, vocab_size)

    def forward(self, x, hidden=None):
        x = self.embedding(x)
        output, hidden = self.lstm(x, hidden)
        output = self.fc(output)
        return output, hidden
```

The LSTM returns `hidden` as a tuple `(h_n, c_n)` — both the hidden
state AND the cell state. The RNN only returns `h_n`.

---

## Stacked RNNs (Deep RNNs)

Just like CNNs have multiple conv layers, you can stack RNN/LSTM layers:

```python
lstm = nn.LSTM(
    input_size=64,
    hidden_size=128,
    num_layers=3,       # 3 stacked LSTM layers
    dropout=0.2,        # dropout between layers
    batch_first=True
)
```

```
Input sequence: [x₁, x₂, x₃, x₄, x₅]
                  │    │    │    │    │
                  ▼    ▼    ▼    ▼    ▼
Layer 1:       [LSTM][LSTM][LSTM][LSTM][LSTM] ──→ h₁
                  │    │    │    │    │
                  ▼    ▼    ▼    ▼    ▼
Layer 2:       [LSTM][LSTM][LSTM][LSTM][LSTM] ──→ h₂
                  │    │    │    │    │
                  ▼    ▼    ▼    ▼    ▼
Layer 3:       [LSTM][LSTM][LSTM][LSTM][LSTM] ──→ h₃
                  │    │    │    │    │
                  ▼    ▼    ▼    ▼    ▼
               [out₁][out₂][out₃][out₄][out₅]
```

---

## Bidirectional RNNs

Sometimes future context matters too. A bidirectional RNN processes
the sequence in both directions:

```
Forward:    The cat sat on the ___
            →  →  →  → →

Backward:   The cat sat on the ___
                              ←  ← ← ← ←

Combine:    Each position gets context from BOTH directions.
```

```python
lstm = nn.LSTM(
    input_size=64,
    hidden_size=128,
    bidirectional=True,   # process both directions
    batch_first=True
)
# Output hidden size is 128 * 2 = 256 (forward + backward concatenated)
```

---

## When to Use RNNs vs LSTMs

| Scenario | Use |
|----------|-----|
| Short sequences (<20 tokens) | RNN is fine |
| Long sequences (20+ tokens) | LSTM or GRU |
| Need to remember distant info | LSTM |
| Want fewer parameters | GRU |
| Don't care about sequence order | Don't use RNN at all — use a CNN or feedforward |

---

## Key Takeaways

1. **RNNs process sequences** by maintaining a hidden state that
   carries forward through time.
2. **The hidden state** is a compressed summary of everything seen
   so far.
3. **Vanilla RNNs suffer from vanishing gradients** — they forget
   early parts of long sequences.
4. **LSTMs solve this** with gates (forget, input, output) that control
   information flow and a cell state highway for gradients.
5. **GRUs** are a simpler alternative with similar performance.
6. **In PyTorch,** switching between RNN/LSTM/GRU is a one-line change.
7. **Stacking layers** and using bidirectional processing can improve
   performance.

---

## Exercises

1. **RNN vs LSTM:** Train both the CharRNN and CharLSTM on a longer
   text (e.g., a few paragraphs from a book). Compare the quality of
   generated text after 500 epochs.

2. **Sequence length experiment:** Train the CharLSTM with sequence
   lengths of 5, 10, 20, and 50. How does longer context affect the
   quality of generated text? What happens to training speed?

3. **Sentiment classifier:** Build an LSTM that classifies movie
   reviews as positive or negative. Use the IMDB dataset from
   `torchtext` or load it as CSV. Take the final hidden state and
   feed it through a linear layer with sigmoid output.

4. **Hidden state visualization:** After training, print the hidden
   state values at each time step for a short input. Do certain
   dimensions correlate with specific characters or patterns?

5. **GRU comparison:** Replace the LSTM with a GRU. Compare parameter
   count, training speed, and final loss. Is there a meaningful
   difference for this simple task?

---

Next: [Lesson 12 — The Problems with RNNs](./12-rnn-problems.md)
