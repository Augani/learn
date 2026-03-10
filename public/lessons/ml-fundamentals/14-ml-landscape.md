# Lesson 14: The ML Landscape — Supervised, Unsupervised, and Beyond

You've learned the core mechanics: neural networks, backpropagation,
CNNs, RNNs, embeddings. But these are all tools for **supervised
learning** — learning from labeled examples.

There's a much bigger landscape. This lesson zooms out to show you the
full picture of how machines learn, how the paradigms connect, and where
the field is heading. This is the bridge to Track 8 (LLMs & Transformers).

---

## Supervised Learning — What We've Covered

Everything in Lessons 01-13 has been supervised learning:

```
Training data:  (input, correct_answer) pairs

  Image of cat  →  "cat"
  House features →  $450,000
  Email text     →  "spam"

The model learns: input → correct_answer
```

**Strengths:**
- Clear objective (minimize prediction error)
- Well-understood, mature techniques
- Works extremely well when you have labeled data

**Weakness:**
- Requires labeled data. Lots of it. And labeling is expensive.

| Task | Labels Needed | Cost |
|------|--------------|------|
| Image classification | ~10,000+ labeled images | $$$$ (human annotators) |
| Medical diagnosis | Thousands of expert-labeled scans | $$$$$ (doctors' time) |
| Spam detection | Millions of labeled emails | $$$ (automated + human) |
| Self-driving | Millions of labeled road scenarios | $$$$$$ |

**Go analogy:** Supervised learning is like having a mentor who reviews
every piece of code you write and tells you exactly what's wrong. Very
effective, but the mentor's time is expensive and doesn't scale.

---

## Unsupervised Learning — Finding Structure Without Labels

No labels. No correct answers. The model finds patterns on its own.

### Clustering: Grouping Similar Things

**K-Means Clustering:**

Given N data points, group them into K clusters by minimizing the
distance from each point to its cluster center.

```
Before clustering:              After K-Means (K=3):

    •  •                        Cluster A (●):  ●  ●
  •      •                        ●      ●
       •                              ●
                    •  •                         Cluster B (▲):  ▲  ▲
                 •     •                          ▲     ▲
                    •                                ▲

  •  •                          Cluster C (■):  ■  ■
    •                              ■
```

**Analogy:** Dumping a pile of laundry on the floor and sorting it
into groups. Nobody tells you the groups — you naturally sort by
color, fabric type, or clothing category.

```python
from sklearn.cluster import KMeans
import numpy as np

X = np.random.randn(300, 2)
X[:100] += [2, 2]
X[100:200] += [-2, 2]

kmeans = KMeans(n_clusters=3, random_state=42)
labels = kmeans.fit_predict(X)
centers = kmeans.cluster_centers_

print(f"Cluster sizes: {np.bincount(labels)}")
print(f"Cluster centers:\n{centers}")
```

**Real-world uses:**
- Customer segmentation (group users by behavior)
- Document topic discovery
- Anomaly detection (points far from any cluster center)
- Image compression (reduce colors to K representative colors)

### Dimensionality Reduction: PCA

Principal Component Analysis finds the directions of maximum variance
in your data and projects it onto fewer dimensions.

```
Original data (3D):          After PCA (2D):

       •                      •
      / •                    / •
     / •     →  find the    / •
    •  •        2 most     •  •
   / •          important
  •             directions

100 features → 2-3 features that capture most of the variance
```

**Analogy:** Photographing a 3D object. Each photo is a 2D projection.
PCA finds the angle that captures the most information about the
object's shape.

```python
from sklearn.decomposition import PCA
import numpy as np

X = np.random.randn(1000, 50)

pca = PCA(n_components=2)
X_reduced = pca.fit_transform(X)
print(f"Original shape: {X.shape}")        # (1000, 50)
print(f"Reduced shape: {X_reduced.shape}")  # (1000, 2)
print(f"Variance explained: {pca.explained_variance_ratio_.sum():.2%}")
```

---

## Semi-Supervised Learning — A Little Label Goes a Long Way

What if you have a FEW labeled examples and LOTS of unlabeled data?

```
Dataset:
  Labeled:    100 images with labels    (expensive to create)
  Unlabeled:  100,000 images, no labels (cheap — just scrape the web)

Semi-supervised learning uses BOTH.
```

**How it works (simplified):**

1. Train a model on the 100 labeled examples
2. Use it to predict labels for the unlabeled data
3. Take the most confident predictions as "pseudo-labels"
4. Retrain on labeled + pseudo-labeled data
5. Repeat

**Analogy:** You're learning to identify birds. A friend names 10 species
for you (labeled data). Then you go birdwatching alone (unlabeled data).
You use what you learned to tentatively identify birds, and over time
your identifications improve.

---

## Self-Supervised Learning — This Is How LLMs Train

The most important paradigm for modern AI. The model creates its own
labels from the data itself. No human labeling needed.

### For Language: Predict the Next Word

```
Training text: "The cat sat on the mat"

Self-supervised task (next word prediction):
  Input: "The"          → Predict: "cat"
  Input: "The cat"      → Predict: "sat"
  Input: "The cat sat"  → Predict: "on"
  Input: "The cat sat on" → Predict: "the"
  Input: "The cat sat on the" → Predict: "mat"

The label IS part of the data. No human annotator needed.
You just need text. And the internet has a LOT of text.
```

**This is exactly how GPT is trained.** Given all the text before a
position, predict the next word. Repeat over trillions of words. The
model learns grammar, facts, reasoning, code, and more — all from
predicting the next word.

### For Language: Masked Word Prediction (BERT)

```
Training text: "The cat sat on the mat"
Masked input:  "The [MASK] sat on the mat"
Predict:       [MASK] = "cat"

The model sees the surrounding context and predicts the missing word.
This is how BERT is trained.
```

### For Images: Predict Missing Patches

```
Original image:        Masked image:          Task:
┌──┬──┬──┬──┐         ┌──┬──┬──┬──┐          Predict the
│██│░░│██│░░│         │██│░░│▓▓│░░│          missing
│░░│██│░░│██│         │░░│▓▓│░░│██│          patches (▓▓)
│██│░░│██│░░│         │██│░░│▓▓│░░│
│░░│██│░░│██│         │░░│██│░░│▓▓│
└──┴──┴──┴──┘         └──┴──┴──┴──┘
```

**Why self-supervised learning changed everything:**

| Paradigm | Data Needed | Scale |
|----------|-------------|-------|
| Supervised | Labeled data (expensive) | Thousands to millions |
| Self-supervised | Raw data (free) | Billions to trillions |

The internet has trillions of words and billions of images. Self-supervised
learning can use ALL of it, no labeling required. This is why LLMs can
be so large and capable.

**TypeScript analogy:** It's like learning TypeScript by reading every
GitHub repository and predicting what comes next in the code. You'd learn
syntax, patterns, idioms, and common bugs — all without anyone explicitly
teaching you.

---

## Reinforcement Learning — Learning from Rewards

No labeled data. No predefined tasks. An **agent** takes **actions** in
an **environment** and receives **rewards** (or penalties). It learns to
maximize cumulative reward.

```
┌─────────────┐    action     ┌─────────────────┐
│    Agent     │─────────────→│   Environment    │
│  (the model) │              │  (game, world)   │
│              │←─────────────│                  │
└─────────────┘  reward +     └─────────────────┘
                 next state

Loop:
  1. Agent observes state
  2. Agent chooses action
  3. Environment returns reward + new state
  4. Agent updates its strategy
  5. Repeat
```

**Analogy — training a dog:**

| RL Concept | Dog Training |
|-----------|-------------|
| Agent | The dog |
| Environment | The house, yard, park |
| State | What the dog currently sees/hears |
| Action | Sit, fetch, bark, roll over |
| Reward | Treat (positive), "no!" (negative) |
| Policy | The dog's learned strategy for getting treats |

The dog doesn't get a manual. It tries things, gets feedback, and over
time learns which behaviors lead to treats.

### Where RL Is Used

| Application | Agent | Environment | Reward |
|------------|-------|-------------|--------|
| Game playing (AlphaGo) | Game AI | The game board | Win/lose |
| Robotics | Robot controller | Physical world | Task completion |
| RLHF (ChatGPT training) | Language model | Text generation | Human preference |
| Recommendation systems | Recommender | User interactions | User engagement |
| Trading (careful!) | Trading bot | Financial markets | Profit/loss |

### RLHF — How ChatGPT Was Trained

Reinforcement Learning from Human Feedback is the secret sauce that
makes LLMs actually useful and safe:

```
Step 1: Pre-train with self-supervised learning (predict next word)
        → Model can generate text but is often wrong, toxic, unhelpful

Step 2: Fine-tune with supervised learning
        → Human trainers write ideal responses to prompts
        → Model learns to imitate good responses

Step 3: Train a reward model with human preferences
        → Show humans two model responses, they pick the better one
        → Train a model to predict which response humans prefer

Step 4: Optimize the language model using RL
        → Generate responses, score them with the reward model
        → Update the language model to get higher scores
        → Result: model that generates helpful, harmless responses
```

---

## Transfer Learning — Standing on the Shoulders of Giants

Why train from scratch when someone else already trained a great model?

```
Traditional:
  Task A → Train model A from scratch
  Task B → Train model B from scratch
  Task C → Train model C from scratch

Transfer learning:
  Pre-train on huge dataset → General model
                                   ↓
                              Fine-tune for Task A
                              Fine-tune for Task B
                              Fine-tune for Task C
```

**Analogy:** Learning to drive a car. You don't learn from scratch for
every new car model. You learn the fundamentals once, then adapt to
specific cars (this one has the turn signal on the left instead of
the right).

### How It Works in Practice

```python
import torch
from torchvision import models

model = models.resnet50(pretrained=True)

for param in model.parameters():
    param.requires_grad = False

model.fc = torch.nn.Linear(2048, 5)

# Train ONLY the new last layer on your small dataset
# The rest of the model keeps its pre-trained knowledge
```

**Why it works:** Early layers learn general features (edges, textures,
shapes). These are useful for almost any image task. Only the final
layers need task-specific training.

```
Pre-trained on ImageNet (1M images, 1000 classes):
  Layer 1: Edge detection       (universal — keep frozen)
  Layer 2: Texture detection    (universal — keep frozen)
  Layer 3: Part detection       (semi-universal — maybe fine-tune)
  Layer 4: Object detection     (task-specific — definitely fine-tune)
  Final: Classification head    (replace entirely for your task)
```

---

## Foundation Models — One Model to Rule Them All

The ultimate expression of transfer learning. A single massive model
trained on enormous data that can be adapted to many tasks.

```
                   Foundation Model
              (trained on internet-scale data)
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
        Translation   Summarization  Code Generation
            │            │            │
        Fine-tune     Fine-tune     Fine-tune
        (small data)  (small data)  (small data)
```

| Foundation Model | Type | Parameters | Training Data |
|-----------------|------|-----------|---------------|
| GPT-4 | Language | ~1 trillion (est.) | Trillions of tokens |
| Claude | Language | Not disclosed | Trillions of tokens |
| DALL-E 3 | Image | Not disclosed | Billions of image-text pairs |
| Whisper | Speech | 1.5B | 680K hours of audio |

**The paradigm shift:**

```
2015: Train a specific model for each task
      Spam detector, sentiment analyzer, translator, summarizer
      Each trained from scratch on task-specific data

2024: Use one foundation model for everything
      "Classify this email as spam" → GPT
      "What's the sentiment?" → GPT
      "Translate to French" → GPT
      "Summarize this article" → GPT
      Same model, different prompts
```

---

## The Learning Paradigm Map

```
                        Machine Learning
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    Supervised          Unsupervised       Reinforcement
    (labeled data)      (no labels)        (rewards)
          │                  │                  │
    ┌─────┼─────┐     ┌─────┼─────┐          Agent
    │           │     │           │          learns
Classification  Regression  Clustering  Dimensionality  from
(cat/dog)    ($450K)  (k-means)  reduction    trial
                                (PCA)        & error
          │
    ┌─────┴─────────┐
    │               │
  Semi-          Self-
  supervised     supervised
  (few labels)   (create own labels)
                      │
               Next word prediction
               Masked language model
                      │
                Foundation Models
                  (GPT, Claude)
                      │
                  Fine-tuning
                  with RLHF
                      │
                   ChatGPT
```

---

## What's Real and What's Hype

An honest assessment of where ML stands:

### What ML Does Well Today

| Capability | Status | Examples |
|-----------|--------|---------|
| Image classification | Superhuman | Medical imaging, quality control |
| Natural language understanding | Very good | Search, translation, summarization |
| Code generation | Good (with caveats) | Copilot, Claude, GPT for coding |
| Game playing | Superhuman | Chess, Go, StarCraft |
| Speech recognition | Very good | Whisper, voice assistants |
| Recommendation | Very good | YouTube, Netflix, Spotify |
| Protein structure | Revolutionary | AlphaFold |

### What ML Struggles With

| Challenge | Why It's Hard |
|-----------|-------------|
| Reasoning about novel situations | Models interpolate between training data, not truly reason |
| Factual reliability | LLMs confidently state incorrect facts (hallucination) |
| Common sense physics | Humans intuitively understand physics; models don't |
| Long-term planning | Models are reactive, not strategic (improving rapidly) |
| Sample efficiency | Humans learn from few examples; ML needs thousands+ |
| Causal reasoning | ML finds correlations, not causes |

### The Honest State of Things

- LLMs are incredibly useful but not intelligent in the way humans are
- They're pattern matchers trained on human-generated data
- They can generalize within the distribution of their training data
- They fail on tasks that require genuine novelty or deep reasoning
  about unfamiliar domains
- But they're improving rapidly, and the boundary of "what they can't
  do" is shrinking every year

---

## How This Connects to Track 8

You now have the foundation to understand LLMs and Transformers:

```
What you know (this track):            What's next (Track 8):
─────────────────────────              ──────────────────────
Neural networks                    →   Deep networks (many layers)
Backpropagation                    →   Training at scale
RNNs and their problems            →   Why attention replaced them
Embeddings                         →   Token embeddings + positional encoding
Self-supervised learning            →   How GPT/BERT are pre-trained
Sequence processing                →   Self-attention mechanism
Loss functions                     →   Cross-entropy for language modeling
```

Track 8 will cover:
- The Transformer architecture in detail (self-attention, multi-head
  attention, feed-forward layers, layer normalization)
- How GPT generates text (autoregressive decoding)
- Tokenization (BPE, SentencePiece)
- Positional encoding (how Transformers know word order)
- Scaling laws (why bigger models work better)
- Fine-tuning and RLHF
- Practical LLM usage (prompting, RAG, agents)

---

## Key Takeaways

1. **Supervised learning** needs labels. Powerful but expensive to scale.
2. **Unsupervised learning** finds structure without labels (clustering,
   dimensionality reduction).
3. **Self-supervised learning** creates labels from the data itself.
   This is how GPT and BERT train — predict the next word.
4. **Reinforcement learning** learns from rewards through trial and
   error. RLHF uses this to align LLMs with human preferences.
5. **Transfer learning** reuses a pre-trained model's knowledge for
   new tasks. Fine-tuning is faster and cheaper than training from
   scratch.
6. **Foundation models** are massive pre-trained models that can be
   adapted to many tasks. This is the current paradigm.
7. **The paradigm shift:** From training task-specific models to
   prompting general-purpose foundation models.
8. **ML is powerful but not magic.** Understanding what it can and
   can't do makes you a better engineer.

---

## Exercises

1. **Clustering exploration:** Generate 3 clusters of 2D data
   (use `np.random.randn` with different centers). Run K-Means
   with K=2, 3, 4, 5. Which K best matches the true structure?
   Try the elbow method (plot K vs. total within-cluster distance).

2. **PCA on MNIST:** Load the MNIST dataset (784 dimensions per image).
   Apply PCA to reduce to 2 dimensions. Plot the 2D points, colored
   by digit label. Do digits cluster together? How much variance do
   the first 2 components explain? What about the first 50?

3. **Self-supervised pretext task:** Take the MNIST digit images. Create
   a self-supervised task: rotate each image by 0, 90, 180, or 270
   degrees. Train a model to predict the rotation angle. Then freeze
   the learned features and train a classifier on top with only 100
   labeled examples. Compare to training from scratch with 100 labels.

4. **Reinforcement learning basics:** Implement a simple RL agent for
   a grid world. The agent starts at position (0,0) and needs to reach
   (4,4). It can move up/down/left/right. Give +10 reward for reaching
   the goal, -1 for each step (encourages efficiency), -5 for hitting
   walls. Use Q-learning (a simple RL algorithm).

5. **Transfer learning experiment:** Use a pre-trained ResNet from
   `torchvision.models`. Replace the final layer for a 5-class
   problem. Compare training accuracy when:
   (a) All layers are frozen (only train the new final layer)
   (b) Last 2 blocks are unfrozen
   (c) All layers are unfrozen
   How does each approach perform with 50, 200, and 1000 training
   images per class?

---

## What's Next

You've completed the ML Fundamentals track. You understand:

- How neural networks learn (forward pass, backprop, gradient descent)
- Training in practice (loss functions, optimizers, regularization)
- PyTorch for building real models
- CNNs for images, RNNs/LSTMs for sequences
- Embeddings as the bridge between discrete symbols and continuous math
- The landscape of learning paradigms

**Next track:** [Track 8 — LLMs & Transformers](../llms-transformers/00-roadmap.md)

You have everything you need to understand how GPT, Claude, and modern
language models work under the hood.

---

Back to the [Roadmap](./00-roadmap.md)
