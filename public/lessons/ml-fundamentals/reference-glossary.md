# ML Glossary — Every Term Explained in Plain English

Quick reference for every ML term you'll encounter in this track.
Organized by category. Cross-language analogies included where helpful.

---

## The Basics

### Model

A function that takes input and produces output. You don't write the rules —
the model *learns* them from data.

**TypeScript analogy:** Imagine a function where you don't write the body.
Instead, you show it thousands of input/output examples, and it figures out
what the function body should be.

```
// You write this in normal programming:
function celsiusToFahrenheit(c: number): number {
    return c * 1.8 + 32;
}

// In ML, you'd show the model:
// (0, 32), (100, 212), (37, 98.6), ...
// And it would LEARN that the rule is: output = input * 1.8 + 32
```

### Parameters (Weights and Biases)

The numbers inside the model that get adjusted during training.

- **Weights** — multipliers applied to inputs (how important is each input?)
- **Bias** — an offset added after multiplication (a baseline adjustment)

**Analogy:** A recipe. Weights are how much of each ingredient to use.
Bias is the oven temperature. Training adjusts these until the dish tastes right.

**Go analogy:** Think of a struct with numeric fields. Training is the process
of finding the best values for those fields.

```python
# A simple model: y = weight * x + bias
weight = 0.5   # parameter — learned from data
bias = 2.0     # parameter — learned from data
```

### Hyperparameters

Settings you choose BEFORE training. The model doesn't learn these — you
pick them, run training, and see if they work.

| Hyperparameter | What It Controls |
|----------------|-----------------|
| Learning rate | How big each adjustment step is |
| Batch size | How many examples to look at per step |
| Number of layers | How deep the network is |
| Number of epochs | How many times to go through the data |

**Analogy:** Parameters are the recipe itself. Hyperparameters are the
kitchen setup — which oven, what altitude, how long to preheat.

---

## The Training Process

### Training

Showing the model examples and adjusting its parameters so it makes
fewer mistakes over time.

**Analogy:** A student doing practice problems. Each wrong answer leads
to studying and correcting understanding. The practice problems are the
training data. The corrections are parameter updates.

### Inference

Using a trained model to make predictions on new data. Training is done.
Now the model is just answering questions.

**TypeScript analogy:** Training = compiling. Inference = running.

### Epoch

One complete pass through the entire training dataset.

If you have 10,000 images and you show all 10,000 to the model once,
that's 1 epoch. You typically train for many epochs (10, 100, sometimes
thousands).

**Analogy:** Reading through a textbook once is 1 epoch. You usually
need to re-read chapters multiple times to really learn the material.

### Batch

A small group of training examples processed together before updating
the model's parameters.

If you have 10,000 examples and use batches of 32, each epoch has
10,000 / 32 = 312 batches (and 312 parameter updates per epoch).

**Analogy:** You don't grade all 200 student papers before giving any
feedback. You grade a stack of 32, notice common mistakes, then adjust
your teaching before grading the next stack.

### Iteration (Step)

One parameter update. Process one batch → compute loss → update
parameters = one iteration.

```
1 epoch = (dataset size / batch size) iterations
Example: 10,000 examples / 32 batch size = 312 iterations per epoch
```

---

## Measuring Performance

### Loss Function (Cost Function, Objective Function)

A function that measures how wrong the model's predictions are. The model's
goal is to minimize this number.

These three terms mean slightly different things technically but are used
interchangeably in practice:

- **Loss** — error on a single example
- **Cost** — average error across a batch or dataset
- **Objective** — the thing being optimized (usually = cost)

**Common loss functions:**

| Loss Function | When to Use | Formula Intuition |
|--------------|-------------|-------------------|
| MSE (Mean Squared Error) | Predicting numbers (regression) | Average of (prediction - actual)^2 |
| Cross-Entropy | Choosing categories (classification) | How surprised the model is by the correct answer |
| Binary Cross-Entropy | Yes/no decisions | Cross-entropy for 2 classes |

**Analogy:** A golf scorecard. Lower is better. The loss function is how
you calculate the score. Training is playing rounds to lower your score.

### Gradient

The direction and magnitude of the steepest increase of the loss. Points
"uphill." You go the OPPOSITE direction to reduce the loss.

**Analogy:** Standing on a foggy hillside. The gradient tells you which
direction is uphill. You want to go downhill (reduce loss), so you walk
the opposite direction.

**Go analogy:** Think of it as a vector (slice of float64) — one number
per parameter, telling you how to adjust that parameter.

### Gradient Descent

The algorithm that repeatedly:
1. Computes the gradient (which direction is uphill?)
2. Steps in the opposite direction (go downhill)
3. Repeats until the loss is small enough

### Learning Rate

How big each step is during gradient descent. Too big = overshoot and
never converge. Too small = takes forever.

```
new_weight = old_weight - learning_rate * gradient
```

**Analogy:** Walking down a mountain in fog. Big steps = faster but you
might step off a cliff. Tiny steps = safe but you'll be walking all night.
You want medium steps.

Typical values: 0.001, 0.01, 0.0001

---

## Generalization Problems

### Overfitting

The model memorizes the training data instead of learning general patterns.
Performs great on training data, terrible on new data.

**Analogy:** A student who memorizes every practice test answer but can't
solve a new problem they haven't seen before.

**TypeScript analogy:** Writing a function that hardcodes if/else for every
known input instead of implementing the actual algorithm.

### Underfitting

The model is too simple to capture the patterns in the data. Performs
poorly on BOTH training and new data.

**Analogy:** Trying to explain global economics with a single sentence.
The explanation is too simple to be useful.

### Regularization

Techniques that prevent overfitting by penalizing complexity.

| Technique | How It Works |
|-----------|-------------|
| Dropout | Randomly disable neurons during training (forces redundancy) |
| Weight decay (L2) | Penalize large weights (keep parameters small) |
| L1 regularization | Push some weights to exactly zero (feature selection) |
| Early stopping | Stop training when validation loss starts increasing |
| Data augmentation | Create more training data via transformations |

---

## Data Concepts

### Feature

An input variable. One measurable property of the data.

For a house price model: square footage, number of bedrooms, zip code
are all features.

**TypeScript analogy:** Fields in your input interface:
```typescript
interface HouseFeatures {
    squareFeet: number;
    bedrooms: number;
    zipCode: string;
}
```

### Label

The correct answer. What you're trying to predict.

For house prices: the label is the actual sale price. For email spam
detection: the label is "spam" or "not spam."

### Dataset

A collection of examples, each with features and (optionally) labels.

### Train / Validation / Test Split

Splitting your data into three sets:

| Set | Purpose | Analogy |
|-----|---------|---------|
| Training set (70-80%) | Learn from this data | Studying from the textbook |
| Validation set (10-15%) | Tune hyperparameters, detect overfitting | Practice exams |
| Test set (10-15%) | Final performance measurement | The real final exam |

**Critical rule:** Never let the model see the test set during training.
That would be like giving students the final exam to study from.

---

## Neural Network Mechanics

### Forward Pass

Feeding an input through the network to get an output. Data flows
forward: input → hidden layers → output.

**Analogy:** An assembly line. Raw materials enter one end, move through
stations, finished product comes out the other end.

### Backward Pass (Backpropagation)

After the forward pass, computing how much each parameter contributed to
the error and adjusting them accordingly. Error flows backward.

**Analogy:** The finished product has a defect. QA traces backward through
the assembly line to figure out which station caused the problem and how
to fix it.

### Activation Function

A function applied after each neuron's calculation that introduces
non-linearity. Without activation functions, a deep network would just
be a fancy linear equation.

| Function | Output Range | When to Use |
|----------|-------------|-------------|
| ReLU | 0 to infinity | Default for hidden layers |
| Sigmoid | 0 to 1 | Binary classification output |
| Softmax | 0 to 1 (sums to 1) | Multi-class classification output |
| Tanh | -1 to 1 | When you need negative outputs |

```
ReLU(x) = max(0, x)     — if negative, output 0. Otherwise, pass through.
Sigmoid(x) = 1/(1+e^-x) — squashes any number to between 0 and 1.
```

**ReLU analogy:** A bouncer at a club. Negative numbers? Rejected (0).
Positive numbers? Come right in (pass through unchanged).

**Sigmoid analogy:** A confidence meter. Any input gets compressed to a
probability between 0% and 100%.

**Softmax:** Like sigmoid but for multiple choices. Outputs a probability
distribution that sums to 1. "60% cat, 30% dog, 10% bird."

---

## Architecture Types

### CNN (Convolutional Neural Network)

Specialized for grid-like data (images, video). Uses small sliding filters
that detect patterns like edges, textures, and shapes.

**Analogy:** Looking at an image through a small magnifying glass, sliding
it across every part. Each magnifying glass detects a different feature
(edges, colors, textures).

### RNN (Recurrent Neural Network)

Processes sequential data (text, time series) by maintaining a hidden
state that carries information from previous steps.

**Analogy:** Reading a book one word at a time while keeping a mental
summary of what you've read so far.

### LSTM (Long Short-Term Memory)

An improved RNN with gates that control what to remember and what to
forget. Solves the problem of RNNs forgetting early parts of long sequences.

**Analogy:** Reading a book with a notebook. You decide what's worth
writing down (input gate), what to erase from your notes (forget gate),
and what from your notes is relevant to the current paragraph (output gate).

### Transformer

The architecture behind GPT, BERT, and modern LLMs. Uses "attention" to
look at all parts of the input simultaneously, rather than one at a time
like RNNs.

**Analogy:** Instead of reading a book word by word, you can see the
entire page at once and decide which words are most relevant to each
other. This is fundamentally faster and captures long-range relationships.

Covered in depth in Track 8 (LLMs & Transformers).

---

## Representations

### Embedding

A learned mapping from discrete items (words, categories) to dense
vectors of real numbers. Items with similar meaning end up close together
in vector space.

```
"king"  → [0.2, 0.8, -0.1, 0.5, ...]   (300 numbers)
"queen" → [0.3, 0.7, -0.1, 0.6, ...]   (nearby in the space)
"pizza" → [-0.9, 0.1, 0.7, -0.3, ...]  (far away)
```

**Go analogy:** Like a map[string][]float64 that positions semantically
similar keys near each other in the float-slice space.

### Latent Space

The internal representation a model learns. The hidden "map" where the
model organizes concepts.

**Analogy:** Your brain's internal map of animal similarity. You don't
consciously build it, but you know a dog is more like a wolf than a fish.
A model's latent space works the same way.

### Representation (Learned Representation)

The way a model internally encodes information. Good representations
capture the important structure and discard noise.

---

## Learning Paradigms

### Supervised Learning

Training with labeled data. You give the model inputs AND the correct
outputs. "Here's a photo of a cat, the label is 'cat'."

Most of what we cover in this track.

### Unsupervised Learning

Training WITHOUT labels. The model finds structure on its own.
Clustering, dimensionality reduction, anomaly detection.

**Analogy:** Dumping a box of Lego on the floor and asking someone to
organize them. They'll group by color, size, or shape without you telling
them how.

### Reinforcement Learning

An agent learns by taking actions in an environment and receiving
rewards or penalties. No correct answers — just "that was good" or
"that was bad."

**Analogy:** Training a dog. The dog tries things. Good things get
treats. Bad things get nothing. Over time, the dog learns what gets
treats.

### Self-Supervised Learning

Creates labels from the data itself. For text: mask a word and predict
it. No human labeling needed.

This is how GPT, BERT, and most modern language models are trained.

### Transfer Learning

Using a model trained on one task as the starting point for a different
task. Instead of learning from scratch, you start with existing knowledge.

**Analogy:** Learning Spanish is easier if you already speak Portuguese.
You transfer your knowledge of Romance language structure.

### Foundation Models

Massive models (GPT-4, Claude) trained on enormous datasets that can
be adapted to many downstream tasks. One model, many uses.

---

## Quick Reference Table

| Term | One-Line Definition |
|------|-------------------|
| Model | A learned function: input → output |
| Weight | A multiplier the model learns |
| Bias | An offset the model learns |
| Hyperparameter | A setting YOU choose before training |
| Epoch | One pass through all training data |
| Batch | A subset of examples processed together |
| Loss | How wrong the model is (lower = better) |
| Gradient | Direction of steepest increase in loss |
| Learning rate | Step size during gradient descent |
| Overfitting | Memorizing training data, failing on new data |
| Feature | An input variable |
| Label | The correct answer |
| Forward pass | Input → output through the network |
| Backprop | Tracing error backward to update parameters |
| ReLU | max(0, x) — the default activation function |
| Softmax | Turns numbers into probabilities that sum to 1 |
| CNN | Neural network for images (sliding filters) |
| RNN | Neural network for sequences (has memory) |
| LSTM | Better RNN with forget/remember gates |
| Transformer | Parallel attention-based architecture (GPT, etc.) |
| Embedding | Dense vector representing a word/item |
| Supervised | Learning from labeled examples |
| Unsupervised | Finding patterns without labels |
| Reinforcement | Learning from rewards/penalties |

---

Back to the [Roadmap](./00-roadmap.md)
