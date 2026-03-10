# Reference: Key AI/ML Libraries

> When to use what. Organized by task, not alphabetically.

---

## The Ecosystem at a Glance

```
  DATA                MODELS              DEPLOYMENT
  ────                ──────              ──────────
  NumPy               scikit-learn        FastAPI
  Pandas              PyTorch             Flask
  Polars              TensorFlow          BentoML
  DuckDB              JAX                 MLflow
  Apache Arrow        XGBoost             ONNX Runtime
                      LightGBM            TorchServe
  VISUALIZATION       HuggingFace         vLLM
  ─────────────
  Matplotlib          LLM / AI ENG        EXPERIMENT
  Seaborn             ────────────        ──────────
  Plotly              LangChain           Weights & Biases
                      LlamaIndex          MLflow
  DATA VALIDATION     OpenAI SDK          Optuna
  ───────────────     Anthropic SDK       Ray Tune
  Pydantic            Instructor
  Pandera
  Great Expectations
```

---

## Data Processing

```
  ┌─────────────┬──────────────────────────────────────────┐
  │ Library     │ When to Use                              │
  ├─────────────┼──────────────────────────────────────────┤
  │ NumPy       │ Numerical arrays, linear algebra,        │
  │             │ foundation of everything                  │
  ├─────────────┼──────────────────────────────────────────┤
  │ Pandas      │ Tabular data, CSV/Excel, EDA,            │
  │             │ the default for data manipulation         │
  ├─────────────┼──────────────────────────────────────────┤
  │ Polars      │ Large datasets, faster than Pandas,      │
  │             │ Rust-powered, lazy evaluation             │
  ├─────────────┼──────────────────────────────────────────┤
  │ DuckDB      │ SQL on local files, analytics,           │
  │             │ Parquet files, embedded database          │
  ├─────────────┼──────────────────────────────────────────┤
  │ Apache Arrow│ Zero-copy data interchange between       │
  │             │ systems, columnar memory format           │
  └─────────────┴──────────────────────────────────────────┘
```

```python
import numpy as np
a = np.random.randn(1000, 100)

import pandas as pd
df = pd.read_csv("data.csv")

import polars as pl
df = pl.scan_csv("big_data.csv").filter(pl.col("value") > 0).collect()

import duckdb
result = duckdb.sql("SELECT * FROM 'data.parquet' WHERE score > 0.9")
```

---

## Classical ML

```
  ┌──────────────┬─────────────────────────────────────────┐
  │ Library      │ When to Use                             │
  ├──────────────┼─────────────────────────────────────────┤
  │ scikit-learn │ Classification, regression, clustering, │
  │              │ pipelines, preprocessing -- the default  │
  ├──────────────┼─────────────────────────────────────────┤
  │ XGBoost      │ Gradient boosting, tabular data,        │
  │              │ Kaggle competitions, production models   │
  ├──────────────┼─────────────────────────────────────────┤
  │ LightGBM     │ Same as XGBoost but faster training,    │
  │              │ handles categorical features natively    │
  ├──────────────┼─────────────────────────────────────────┤
  │ CatBoost     │ Gradient boosting with native           │
  │              │ categorical support, less tuning needed  │
  └──────────────┴─────────────────────────────────────────┘
```

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("model", RandomForestClassifier(n_estimators=100)),
])
pipe.fit(X_train, y_train)

import xgboost as xgb
model = xgb.XGBClassifier(n_estimators=200, learning_rate=0.1)
model.fit(X_train, y_train)
```

---

## Deep Learning

```
  ┌─────────────┬──────────────────────────────────────────┐
  │ Library     │ When to Use                              │
  ├─────────────┼──────────────────────────────────────────┤
  │ PyTorch     │ Research, custom architectures,          │
  │             │ dynamic graphs, the default for DL       │
  ├─────────────┼──────────────────────────────────────────┤
  │ TensorFlow  │ Production serving, mobile/edge,         │
  │             │ TFLite, legacy systems                    │
  ├─────────────┼──────────────────────────────────────────┤
  │ JAX         │ High-performance numerical computing,    │
  │             │ auto-diff, JIT compilation, TPUs          │
  ├─────────────┼──────────────────────────────────────────┤
  │ Lightning   │ PyTorch boilerplate reduction,           │
  │             │ multi-GPU training, experiment tracking   │
  └─────────────┴──────────────────────────────────────────┘
```

```python
import torch
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(784, 128),
    nn.ReLU(),
    nn.Linear(128, 10),
)

import jax
import jax.numpy as jnp
grad_fn = jax.grad(loss_fn)
```

---

## NLP and LLMs

```
  ┌───────────────┬────────────────────────────────────────┐
  │ Library       │ When to Use                            │
  ├───────────────┼────────────────────────────────────────┤
  │ HuggingFace   │ Pre-trained models, tokenizers,        │
  │ Transformers  │ fine-tuning, model hub                  │
  ├───────────────┼────────────────────────────────────────┤
  │ OpenAI SDK    │ GPT-4, embeddings, function calling    │
  ├───────────────┼────────────────────────────────────────┤
  │ Anthropic SDK │ Claude models, tool use, long context  │
  ├───────────────┼────────────────────────────────────────┤
  │ LangChain     │ Chains, agents, RAG pipelines,         │
  │               │ multi-step LLM workflows                │
  ├───────────────┼────────────────────────────────────────┤
  │ LlamaIndex    │ Data indexing, RAG, document Q&A       │
  ├───────────────┼────────────────────────────────────────┤
  │ Instructor    │ Structured outputs from LLMs,          │
  │               │ Pydantic validation of LLM responses    │
  ├───────────────┼────────────────────────────────────────┤
  │ vLLM          │ High-throughput LLM serving,            │
  │               │ PagedAttention, production inference    │
  └───────────────┴────────────────────────────────────────┘
```

```python
from transformers import pipeline
classifier = pipeline("sentiment-analysis")
result = classifier("I love this library!")

from openai import OpenAI
client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}],
)

import anthropic
client = anthropic.Anthropic()
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
```

---

## Computer Vision

```
  ┌──────────────┬─────────────────────────────────────────┐
  │ Library      │ When to Use                             │
  ├──────────────┼─────────────────────────────────────────┤
  │ torchvision  │ Image transforms, pre-trained models,   │
  │              │ datasets, augmentation                   │
  ├──────────────┼─────────────────────────────────────────┤
  │ OpenCV       │ Image processing, video, real-time      │
  │              │ computer vision, non-DL tasks            │
  ├──────────────┼─────────────────────────────────────────┤
  │ Pillow       │ Basic image loading, saving, resizing   │
  ├──────────────┼─────────────────────────────────────────┤
  │ Ultralytics  │ YOLO object detection, ready-to-use     │
  └──────────────┴─────────────────────────────────────────┘
```

---

## Experiment Tracking and MLOps

```
  ┌──────────────┬─────────────────────────────────────────┐
  │ Tool         │ When to Use                             │
  ├──────────────┼─────────────────────────────────────────┤
  │ W&B          │ Experiment tracking, visualization,     │
  │              │ hyperparameter sweeps, team sharing      │
  ├──────────────┼─────────────────────────────────────────┤
  │ MLflow       │ Experiment tracking, model registry,    │
  │              │ deployment, open-source alternative      │
  ├──────────────┼─────────────────────────────────────────┤
  │ DVC          │ Data version control, pipeline          │
  │              │ reproducibility, large file tracking     │
  ├──────────────┼─────────────────────────────────────────┤
  │ Optuna       │ Hyperparameter optimization,            │
  │              │ Bayesian search, pruning                 │
  └──────────────┴─────────────────────────────────────────┘
```

---

## Visualization

```
  ┌──────────────┬─────────────────────────────────────────┐
  │ Library      │ When to Use                             │
  ├──────────────┼─────────────────────────────────────────┤
  │ Matplotlib   │ Publication-quality plots, full         │
  │              │ control, the foundation                  │
  ├──────────────┼─────────────────────────────────────────┤
  │ Seaborn      │ Statistical plots, heatmaps,            │
  │              │ prettier defaults on top of matplotlib   │
  ├──────────────┼─────────────────────────────────────────┤
  │ Plotly       │ Interactive plots, dashboards,           │
  │              │ web-based visualization                  │
  └──────────────┴─────────────────────────────────────────┘
```

---

## Data Validation

```
  ┌──────────────────┬──────────────────────────────────────┐
  │ Library          │ When to Use                          │
  ├──────────────────┼──────────────────────────────────────┤
  │ Pydantic         │ API input validation, config         │
  │                  │ parsing, structured data             │
  ├──────────────────┼──────────────────────────────────────┤
  │ Pandera          │ DataFrame schema validation,         │
  │                  │ statistical checks                   │
  ├──────────────────┼──────────────────────────────────────┤
  │ Great            │ Enterprise data quality, data        │
  │ Expectations     │ contracts, monitoring                │
  └──────────────────┴──────────────────────────────────────┘
```

---

## Decision Flowchart

```
  What are you building?
  │
  ├── Tabular ML ──────────> scikit-learn + XGBoost
  │
  ├── Deep Learning ───────> PyTorch + Lightning
  │
  ├── NLP / Text ──────────> HuggingFace Transformers
  │
  ├── LLM Application ────> OpenAI/Anthropic SDK + LangChain
  │
  ├── RAG System ──────────> LlamaIndex + vector DB
  │
  ├── Computer Vision ─────> PyTorch + torchvision
  │
  ├── Data Pipeline ───────> Pandas (small) / Polars (large)
  │
  └── Production API ──────> FastAPI + ONNX Runtime
```
