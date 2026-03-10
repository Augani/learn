# Lesson 07: Matplotlib & Visualization

> A chart is worth a thousand print statements.
> Visualization is like turning on the lights in a dark room full of data.

---

## The Two Interfaces

Matplotlib has two ways to work: pyplot (quick sketches) and
object-oriented (detailed blueprints). Use pyplot for exploration,
OO for anything you'll share.

```
  pyplot (implicit)              OO (explicit)
  ─────────────────              ──────────────
  plt.plot(x, y)                 fig, ax = plt.subplots()
  plt.title("Hi")                ax.plot(x, y)
  plt.show()                     ax.set_title("Hi")
                                 fig.show()
  Like saying "draw here"        Like saying "draw on THIS canvas"
```

---

## Your First Plot

```python
import matplotlib.pyplot as plt
import numpy as np

epochs = np.arange(1, 21)
train_loss = 2.0 * np.exp(-0.2 * epochs) + 0.1 * np.random.default_rng(42).standard_normal(20)
val_loss = 2.2 * np.exp(-0.15 * epochs) + 0.15 * np.random.default_rng(43).standard_normal(20)

fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(epochs, train_loss, label="Train Loss", marker="o", markersize=4)
ax.plot(epochs, val_loss, label="Val Loss", marker="s", markersize=4)
ax.set_xlabel("Epoch")
ax.set_ylabel("Loss")
ax.set_title("Training Progress")
ax.legend()
ax.grid(True, alpha=0.3)
fig.tight_layout()
plt.savefig("training_curve.png", dpi=150)
plt.show()
```

---

## Common Plot Types

### Bar Chart

Like comparing heights of buildings side by side.

```python
import matplotlib.pyplot as plt
import numpy as np

models = ["BERT", "GPT-2", "T5", "RoBERTa", "DistilBERT"]
accuracy = [89.2, 91.5, 90.8, 90.1, 87.3]
colors = ["#2196F3", "#4CAF50", "#FF9800", "#9C27B0", "#F44336"]

fig, ax = plt.subplots(figsize=(8, 5))
bars = ax.bar(models, accuracy, color=colors, edgecolor="black", linewidth=0.5)

for bar, acc in zip(bars, accuracy):
    ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3,
            f"{acc}%", ha="center", va="bottom", fontsize=10)

ax.set_ylabel("Accuracy (%)")
ax.set_title("Model Comparison on GLUE Benchmark")
ax.set_ylim(85, 93)
ax.grid(axis="y", alpha=0.3)
fig.tight_layout()
plt.show()
```

### Scatter Plot

Like a map showing where each data point lives.

```python
import matplotlib.pyplot as plt
import numpy as np

rng = np.random.default_rng(42)
params = rng.uniform(50, 1500, 50)
accuracy = 80 + 10 * (1 - np.exp(-params / 500)) + rng.standard_normal(50)
latency = params * 0.1 + rng.standard_normal(50) * 5

fig, ax = plt.subplots(figsize=(8, 6))
scatter = ax.scatter(params, accuracy, c=latency, s=60,
                     cmap="viridis", alpha=0.8, edgecolors="black", linewidth=0.5)
cbar = fig.colorbar(scatter, ax=ax, label="Latency (ms)")
ax.set_xlabel("Parameters (M)")
ax.set_ylabel("Accuracy (%)")
ax.set_title("Accuracy vs Model Size (color = latency)")
fig.tight_layout()
plt.show()
```

### Histogram

Like sorting marbles into bins by size.

```python
import matplotlib.pyplot as plt
import numpy as np

rng = np.random.default_rng(42)
model_a_scores = rng.normal(0.85, 0.05, 500)
model_b_scores = rng.normal(0.82, 0.08, 500)

fig, ax = plt.subplots(figsize=(8, 5))
ax.hist(model_a_scores, bins=30, alpha=0.6, label="Model A", color="#2196F3")
ax.hist(model_b_scores, bins=30, alpha=0.6, label="Model B", color="#F44336")
ax.axvline(model_a_scores.mean(), color="#2196F3", linestyle="--", linewidth=1.5)
ax.axvline(model_b_scores.mean(), color="#F44336", linestyle="--", linewidth=1.5)
ax.set_xlabel("Score")
ax.set_ylabel("Frequency")
ax.set_title("Score Distribution: Model A vs Model B")
ax.legend()
fig.tight_layout()
plt.show()
```

### Heatmap

Like a thermal camera image of your data.

```python
import matplotlib.pyplot as plt
import numpy as np

rng = np.random.default_rng(42)
confusion = rng.integers(0, 100, (5, 5))
np.fill_diagonal(confusion, rng.integers(80, 100, 5))
labels = ["cat", "dog", "bird", "fish", "frog"]

fig, ax = plt.subplots(figsize=(7, 6))
im = ax.imshow(confusion, cmap="Blues")
ax.set_xticks(range(5))
ax.set_yticks(range(5))
ax.set_xticklabels(labels, rotation=45, ha="right")
ax.set_yticklabels(labels)
ax.set_xlabel("Predicted")
ax.set_ylabel("Actual")
ax.set_title("Confusion Matrix")

for i in range(5):
    for j in range(5):
        color = "white" if confusion[i, j] > 60 else "black"
        ax.text(j, i, str(confusion[i, j]), ha="center", va="center", color=color)

fig.colorbar(im, ax=ax, shrink=0.8)
fig.tight_layout()
plt.show()
```

---

## Subplots: Multiple Views

Like hanging multiple photos in a gallery. Each subplot is a frame
on the wall, and you arrange them in a grid.

```python
import matplotlib.pyplot as plt
import numpy as np

rng = np.random.default_rng(42)
epochs = np.arange(1, 51)
loss = 2.0 * np.exp(-0.05 * epochs) + rng.standard_normal(50) * 0.05
accuracy = 1 - loss / 3 + rng.standard_normal(50) * 0.02
lr = 0.01 * np.exp(-0.03 * epochs)
grad_norm = np.abs(rng.standard_normal(50)) * np.exp(-0.02 * epochs)

fig, axes = plt.subplots(2, 2, figsize=(12, 8))

axes[0, 0].plot(epochs, loss, color="#2196F3")
axes[0, 0].set_title("Loss")
axes[0, 0].set_ylabel("Loss")
axes[0, 0].grid(True, alpha=0.3)

axes[0, 1].plot(epochs, accuracy, color="#4CAF50")
axes[0, 1].set_title("Accuracy")
axes[0, 1].set_ylabel("Accuracy")
axes[0, 1].grid(True, alpha=0.3)

axes[1, 0].plot(epochs, lr, color="#FF9800")
axes[1, 0].set_title("Learning Rate")
axes[1, 0].set_xlabel("Epoch")
axes[1, 0].set_ylabel("LR")
axes[1, 0].grid(True, alpha=0.3)

axes[1, 1].plot(epochs, grad_norm, color="#9C27B0", alpha=0.7)
axes[1, 1].set_title("Gradient Norm")
axes[1, 1].set_xlabel("Epoch")
axes[1, 1].set_ylabel("Norm")
axes[1, 1].grid(True, alpha=0.3)

fig.suptitle("Training Dashboard", fontsize=14, fontweight="bold")
fig.tight_layout()
plt.show()
```

---

## Customization

```python
import matplotlib.pyplot as plt
import numpy as np

plt.style.use("seaborn-v0_8-whitegrid")

fig, ax = plt.subplots(figsize=(8, 5))

x = np.linspace(0, 10, 100)
for i, (func, name) in enumerate([(np.sin, "sin"), (np.cos, "cos"), (lambda x: np.exp(-x/3), "exp decay")]):
    ax.plot(x, func(x), label=name, linewidth=2)

ax.set_xlabel("x", fontsize=12)
ax.set_ylabel("y", fontsize=12)
ax.set_title("Function Comparison", fontsize=14, pad=15)
ax.legend(fontsize=11, frameon=True, fancybox=True, shadow=True)
ax.set_xlim(0, 10)
ax.tick_params(labelsize=10)

ax.annotate("Crossover", xy=(0.78, 0.71), xytext=(2.5, 1.2),
            fontsize=10, arrowprops=dict(arrowstyle="->", color="gray"))

fig.tight_layout()
plt.show()
```

### Color Maps for ML

```python
import matplotlib.pyplot as plt
import numpy as np

fig, axes = plt.subplots(1, 4, figsize=(16, 3))
rng = np.random.default_rng(42)
data = rng.standard_normal((10, 10))
cmaps = ["viridis", "coolwarm", "RdYlGn", "magma"]

for ax, cmap in zip(axes, cmaps):
    im = ax.imshow(data, cmap=cmap, aspect="auto")
    ax.set_title(cmap, fontsize=11)
    fig.colorbar(im, ax=ax, shrink=0.8)

fig.suptitle("Common Colormaps for ML Visualization", fontsize=13)
fig.tight_layout()
plt.show()
```

---

## Saving Figures

```python
import matplotlib.pyplot as plt
import numpy as np

fig, ax = plt.subplots(figsize=(8, 5))
ax.plot([1, 2, 3], [1, 4, 9])

fig.savefig("plot.png", dpi=150, bbox_inches="tight")
fig.savefig("plot.pdf", bbox_inches="tight")
fig.savefig("plot.svg", bbox_inches="tight")
plt.close(fig)
```

```
  Format   Use Case
  ──────   ────────────────────────────────
  PNG      Papers, presentations (raster)
  PDF      LaTeX papers (vector, crisp)
  SVG      Web, interactive docs (vector)
  JPEG     Never for plots (lossy artifacts)
```

---

## Pandas Integration

Pandas has built-in plotting that wraps matplotlib.
Quick and convenient for exploration.

```python
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

rng = np.random.default_rng(42)
df = pd.DataFrame({
    "epoch": range(1, 51),
    "train_loss": 2.0 * np.exp(-0.05 * np.arange(50)) + rng.standard_normal(50) * 0.05,
    "val_loss": 2.2 * np.exp(-0.04 * np.arange(50)) + rng.standard_normal(50) * 0.08,
})

fig, axes = plt.subplots(1, 2, figsize=(12, 4))
df.plot(x="epoch", y=["train_loss", "val_loss"], ax=axes[0], title="Loss Curves")
df[["train_loss", "val_loss"]].plot.hist(bins=20, alpha=0.6, ax=axes[1], title="Loss Distribution")
fig.tight_layout()
plt.show()
```

---

## ML Visualization Recipes

### Learning Rate Finder Plot

```python
import matplotlib.pyplot as plt
import numpy as np

lrs = np.logspace(-5, 0, 100)
losses = 3.0 - 2.5 * np.log10(lrs + 1e-5) / 5 + np.cumsum(np.random.default_rng(42).standard_normal(100) * 0.02)
losses = np.clip(losses, 0.1, 5.0)
losses[80:] = losses[80:] + np.linspace(0, 3, 20)

fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(lrs, losses, linewidth=2)
ax.set_xscale("log")
ax.set_xlabel("Learning Rate")
ax.set_ylabel("Loss")
ax.set_title("Learning Rate Finder")
ax.axvline(lrs[np.argmin(losses)], color="red", linestyle="--", label=f"Best LR: {lrs[np.argmin(losses)]:.1e}")
ax.legend()
ax.grid(True, alpha=0.3)
fig.tight_layout()
plt.show()
```

---

## Exercises

1. **Training Dashboard**: Generate fake training data (50 epochs).
   Create a 2x2 subplot grid showing: loss curve, accuracy curve,
   learning rate schedule, and a bar chart of final metrics.

2. **Confusion Matrix**: Create a 10-class confusion matrix with
   realistic values (high diagonal, low off-diagonal). Display as
   a heatmap with labels and annotations.

3. **Distribution Comparison**: Generate 3 different distributions
   (normal, uniform, exponential). Plot them as overlapping histograms
   with KDE lines and a legend.

4. **Publication-Ready**: Take any plot and make it publication-quality:
   proper fonts, sizes, no unnecessary gridlines, high DPI, tight layout,
   saved as both PNG and PDF.

5. **Interactive Exploration**: Create a function that takes a DataFrame
   and automatically generates a grid of histograms for all numeric
   columns. Handle any number of columns with dynamic subplot layout.

---

[Next: Lesson 08 - Jupyter Notebooks ->](08-jupyter-notebooks.md)
