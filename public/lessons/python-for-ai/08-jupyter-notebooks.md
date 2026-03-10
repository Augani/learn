# Lesson 08: Jupyter Notebooks

> Jupyter is the ML engineer's workbench.
> Like a lab notebook where your experiments actually run.

---

## What Is Jupyter?

Imagine a document where paragraphs of explanation sit next to
live, runnable code, and the results (tables, charts, numbers)
appear right below each code block. That's Jupyter.

```
  Traditional Script:           Jupyter Notebook:
  ┌──────────────────┐          ┌──────────────────┐
  │ code             │          │ ## Markdown cell  │
  │ code             │          │ explanation       │
  │ code             │          ├──────────────────┤
  │ code             │          │ code cell         │
  │ code             │          │ >>> output        │
  │ # comment        │          ├──────────────────┤
  │ code             │          │ ## Markdown cell  │
  └──────────────────┘          │ more explanation  │
  Run all at once               ├──────────────────┤
  Output at the end             │ code cell + chart │
                                └──────────────────┘
                                Run cell by cell
                                Output inline
```

---

## Installation and Launch

```bash
pip install jupyterlab notebook

jupyter lab

jupyter notebook
```

### VS Code Alternative

VS Code has built-in Jupyter support. Open any `.ipynb` file
and you get the same experience without a browser.

---

## Cell Types

### Code Cells

```python
import numpy as np

data = np.random.default_rng(42).standard_normal((5, 3))
print(data.shape)
data
```

The last expression in a cell is automatically displayed.
No `print()` needed for the final value.

### Markdown Cells

```markdown
## Experiment: Fine-tuning BERT

**Hypothesis**: Lower learning rates produce more stable training.

| Parameter | Value |
|-----------|-------|
| LR        | 3e-5  |
| Epochs    | 3     |
| Batch     | 32    |

LaTeX works too: $L = -\sum y_i \log(\hat{y}_i)$
```

### Raw Cells

Plain text, no execution, no formatting. Rarely used.

---

## Essential Keyboard Shortcuts

```
  Command Mode (press Esc first):
  ────────────────────────────────
  A          Insert cell above
  B          Insert cell below
  DD         Delete current cell
  M          Convert to markdown
  Y          Convert to code
  Z          Undo cell delete
  Shift+Up   Select multiple cells
  C/V/X      Copy/Paste/Cut cells

  Edit Mode (press Enter first):
  ──────────────────────────────
  Shift+Enter    Run cell, move to next
  Ctrl+Enter     Run cell, stay in place
  Alt+Enter      Run cell, insert below
  Tab            Autocomplete
  Shift+Tab      Show docstring
  Ctrl+/         Toggle comment
```

---

## Magic Commands

Magic commands are like cheat codes for your notebook.
They start with `%` (line magic) or `%%` (cell magic).

### Timing

```python
%timeit sum(range(1000))
```

```python
%%timeit
total = 0
for i in range(1000):
    total += i
```

### System Commands

```python
!pip install transformers

!ls -la data/

files = !ls data/*.csv
print(files)
```

### Environment Info

```python
%who

%whos

%env HOME
```

### Autoreload (Development Lifesaver)

When you're editing a `.py` module and importing it in a notebook,
autoreload re-imports it automatically. Like hot-reload for web dev.

```python
%load_ext autoreload
%autoreload 2

from my_module import train_model
```

Now edit `my_module.py`, and the notebook picks up changes
without restarting the kernel.

---

## Display System

Jupyter's display system is richer than `print()`.
Like the difference between reading a text description
of a painting vs actually seeing it.

```python
import pandas as pd
import numpy as np

df = pd.DataFrame(
    np.random.default_rng(42).standard_normal((5, 4)),
    columns=["loss", "accuracy", "f1", "latency"],
)
df
```

DataFrames render as formatted HTML tables automatically.

### Rich Display

```python
from IPython.display import display, HTML, Markdown, JSON

display(Markdown("## This is a **dynamic** heading"))

display(HTML("<div style='background:#e3f2fd;padding:10px;border-radius:5px'>"
             "<b>Training complete!</b> Accuracy: 95.2%</div>"))
```

### Multiple Outputs

```python
from IPython.display import display

for name, score in [("BERT", 89.2), ("GPT-2", 91.5), ("T5", 90.8)]:
    display(f"{name}: {score}%")
```

---

## Inline Plots

```python
import matplotlib.pyplot as plt
import numpy as np

%matplotlib inline

fig, ax = plt.subplots(figsize=(8, 4))
x = np.linspace(0, 10, 100)
ax.plot(x, np.sin(x))
ax.set_title("Inline Plot")
plt.show()
```

For higher resolution on retina displays:

```python
%config InlineBackend.figure_format = 'retina'
```

---

## Working with Data

### Loading and Exploring

```python
import pandas as pd

df = pd.read_csv("experiment_results.csv")

print(f"Shape: {df.shape}")
df.head()
```

```python
df.describe()
```

```python
df.info()
```

### Progress Bars with tqdm

Like a loading bar for your data processing.
Shows you how long the boring part will take.

```python
from tqdm.notebook import tqdm
import time

results = []
for i in tqdm(range(100), desc="Processing"):
    time.sleep(0.01)
    results.append(i ** 2)
```

---

## Notebook Best Practices

### 1. Keep Cells Small

```
  Bad:                          Good:
  ┌──────────────────┐          ┌──────────────────┐
  │ 50 lines of code │          │ Load data (5 ln)  │
  │ doing everything │          ├──────────────────┤
  │ at once          │          │ Clean data (8 ln) │
  └──────────────────┘          ├──────────────────┤
                                │ Visualize (6 ln)  │
                                ├──────────────────┤
                                │ Model (10 ln)     │
                                └──────────────────┘
```

### 2. Restart and Run All

Before sharing a notebook, always do Kernel > Restart & Run All.
A notebook that only works when cells are run in a magic order
is like a recipe where step 3 depends on step 7.

### 3. Use a Consistent Structure

```
  1. Title and description
  2. Imports
  3. Configuration / constants
  4. Data loading
  5. Data exploration
  6. Data preprocessing
  7. Modeling
  8. Evaluation
  9. Results and conclusions
```

### 4. Move Reusable Code to Modules

```python
from src.data import load_dataset, clean_data
from src.models import create_model
from src.evaluation import compute_metrics

data = load_dataset("train.csv")
data = clean_data(data)
model = create_model(config)
metrics = compute_metrics(model, data)
```

### 5. Version Control

```
  .gitignore for notebooks:
  ──────────────────────────
  *.ipynb_checkpoints/
```

Use `nbstripout` to strip output before committing:

```bash
pip install nbstripout
nbstripout --install
```

---

## JupyterLab Features

### File Browser

Left sidebar shows your project files. Drag and drop data files
right into your workspace.

### Multiple Views

Open the same notebook in two tabs side by side. Or put a notebook
next to a terminal. Like having two monitors for your experiments.

### Extensions

```bash
pip install jupyterlab-lsp
pip install jupyterlab-code-formatter
```

---

## Debugging in Notebooks

```python
%debug
```

After an exception, `%debug` drops you into an interactive debugger
right at the point of failure.

```python
from IPython.core.debugger import set_trace

def buggy_function(data):
    for i, item in enumerate(data):
        if item < 0:
            set_trace()
        result = item ** 0.5
```

---

## Exporting Notebooks

```bash
jupyter nbconvert --to html my_notebook.ipynb

jupyter nbconvert --to pdf my_notebook.ipynb

jupyter nbconvert --to script my_notebook.ipynb
```

---

## Notebook vs Script Decision

```
  Use a Notebook when:          Use a Script when:
  ──────────────────────        ──────────────────────
  Exploring data                Training in production
  Prototyping models            Running on a cluster
  Creating reports              Building a pipeline
  Teaching / presenting         Writing a library
  Quick experiments             Anything with CI/CD
```

---

## Exercises

1. **Structured Notebook**: Create a notebook with proper sections
   (markdown headers, imports cell, config cell). Load a dataset,
   explore it (5 different views), and create 3 visualizations.

2. **Magic Commands**: Time three different implementations of the
   same function using `%timeit`. Use `%%capture` to suppress output
   of a noisy cell. Use `%who` to inspect your namespace.

3. **Interactive Widgets**: Install `ipywidgets` and create a slider
   that controls a parameter in a live-updating plot.

4. **Module Extraction**: Take a messy notebook with inline code and
   extract the reusable parts into a `utils.py` module. Import and
   use it with `%autoreload`.

5. **Report Notebook**: Create a notebook that could serve as a report:
   title, introduction, methodology, results with charts, and
   conclusion. Export it as HTML.

---

[Next: Lesson 09 - Scikit-Learn ->](09-scikit-learn.md)
