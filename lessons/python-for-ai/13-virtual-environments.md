# Lesson 13: Virtual Environments

> Virtual environments are like separate toolboxes for each project.
> Your carpentry tools don't mix with your plumbing tools.

---

## Why You Need Them

Project A needs torch 2.0. Project B needs torch 1.13.
Without isolation, installing one breaks the other.
Like roommates who keep overwriting each other's grocery list.

```
  Without venvs:                With venvs:
  ┌──────────────────┐          ┌──────────┐ ┌──────────┐
  │ System Python     │          │ Project A │ │ Project B │
  │ torch==2.0        │          │ torch 2.0 │ │ torch 1.13│
  │ numpy==1.24       │          │ numpy 1.24│ │ numpy 1.23│
  │ CONFLICT!         │          │ pandas 2.0│ │ pandas 1.5│
  └──────────────────┘          └──────────┘ └──────────┘
                                 Isolated!    Isolated!
```

---

## venv: The Built-In Option

Ships with Python. No extra install needed.
Like the basic toolkit that comes with your house.

```bash
python -m venv .venv

source .venv/bin/activate

pip install numpy pandas torch

deactivate
```

```
  Project directory:
  ├── .venv/              <- virtual environment (gitignore this!)
  │   ├── bin/
  │   │   ├── python      <- isolated Python binary
  │   │   ├── pip         <- isolated pip
  │   │   └── activate    <- activation script
  │   └── lib/
  │       └── python3.11/
  │           └── site-packages/  <- your installed packages
  ├── src/
  ├── requirements.txt
  └── .gitignore          <- should contain ".venv/"
```

### Requirements Files

```bash
pip freeze > requirements.txt

pip install -r requirements.txt
```

```
  requirements.txt (pinned):
  ──────────────────────────
  numpy==1.26.2
  pandas==2.1.4
  torch==2.1.1
  transformers==4.36.0
```

---

## uv: The Modern Choice

uv is like pip on rocket fuel. Written in Rust, 10-100x faster.
If pip is a bicycle, uv is a motorcycle.

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh

uv venv

source .venv/bin/activate

uv pip install numpy pandas torch

uv pip install -r requirements.txt
```

### uv Project Management

```bash
uv init my-ml-project
cd my-ml-project

uv add numpy pandas scikit-learn

uv add torch --extra-index-url https://download.pytorch.org/whl/cpu

uv add pytest --dev

uv run python train.py

uv run pytest
```

### pyproject.toml with uv

```toml
[project]
name = "my-ml-project"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "numpy>=1.26",
    "pandas>=2.1",
    "scikit-learn>=1.3",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "ruff>=0.1",
]

[tool.uv]
dev-dependencies = [
    "pytest>=7.0",
    "ruff>=0.1",
]
```

---

## Poetry: The Full-Featured Option

Poetry handles dependency resolution, virtual environments,
building, and publishing. Like a project manager who does everything.

```bash
curl -sSL https://install.python-poetry.org | python3 -

poetry new ml-project
cd ml-project

poetry add numpy pandas
poetry add torch --source pytorch

poetry add --group dev pytest ruff mypy

poetry install

poetry run python train.py

poetry shell
```

### pyproject.toml with Poetry

```toml
[tool.poetry]
name = "ml-project"
version = "0.1.0"
description = "An ML experiment"
authors = ["You <you@example.com>"]

[tool.poetry.dependencies]
python = "^3.11"
numpy = "^1.26"
pandas = "^2.1"
torch = "^2.1"

[tool.poetry.group.dev.dependencies]
pytest = "^7.0"
ruff = "^0.1"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

### Poetry Lock File

`poetry.lock` pins exact versions of every dependency, including
transitive ones. Like a photo of your exact toolbox contents.
Commit this file to git.

---

## pip-tools: The Middle Ground

Simpler than poetry, more controlled than raw pip.

```bash
pip install pip-tools

echo "numpy>=1.26" > requirements.in
echo "pandas>=2.1" >> requirements.in
echo "torch>=2.1" >> requirements.in

pip-compile requirements.in

pip-sync requirements.txt
```

---

## Conda: The Scientific Option

Conda manages Python itself plus non-Python dependencies (CUDA, MKL).
Like a package manager for the entire operating system.

```bash
conda create -n ml-env python=3.11

conda activate ml-env

conda install numpy pandas pytorch -c pytorch

conda deactivate

conda env export > environment.yml

conda env create -f environment.yml
```

### When to Use Conda

```
  Use conda when:                  Use pip/uv when:
  ─────────────────────────        ─────────────────────────
  Need CUDA/GPU drivers            Pure Python packages
  Scientific computing (MKL)       Web development
  Cross-platform reproducibility   Fast iteration
  Non-Python dependencies          Lightweight setup
  Shared cluster environments      Docker containers
```

---

## Comparison Table

```
  Tool       Speed    Lock File    Build    Publish    Notes
  ─────────  ───────  ──────────   ──────   ────────   ──────────────
  venv+pip   Slow     Manual       No       No         Built-in
  uv         Fast!!   uv.lock      Yes      Yes        Modern, Rust
  poetry     Medium   poetry.lock  Yes      Yes        Full-featured
  pip-tools  Medium   Yes          No       No         Compilation
  conda      Slow     env.yml      No       conda-pkg  Scientific
```

---

## Best Practices

### 1. Always Use a Virtual Environment

```bash
python -m venv .venv
echo ".venv/" >> .gitignore
```

### 2. Pin Your Dependencies

```
  Dev:        numpy>=1.26     (flexible, latest compatible)
  CI/Deploy:  numpy==1.26.2   (exact, reproducible)
```

### 3. Separate Dev Dependencies

```toml
[project.optional-dependencies]
dev = ["pytest", "ruff", "mypy"]
```

### 4. Use a Lock File

Lock files ensure everyone gets the exact same versions.
Like a recipe with exact measurements vs "some flour."

### 5. Document Python Version

```toml
[project]
requires-python = ">=3.11"
```

---

## Managing Multiple Python Versions

```bash
uv python install 3.11 3.12

uv venv --python 3.11

uv venv --python 3.12
```

Or use pyenv:

```bash
pyenv install 3.11.7
pyenv install 3.12.1
pyenv local 3.11.7
```

---

## Docker for ML

When virtual environments aren't enough (CUDA versions,
system libraries), Docker is the nuclear option.

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "train.py"]
```

```bash
docker build -t ml-experiment .
docker run --gpus all ml-experiment
```

---

## Project Template

```
  my-ml-project/
  ├── .venv/                  <- gitignored
  ├── .gitignore
  ├── pyproject.toml          <- project metadata + deps
  ├── uv.lock                 <- exact versions (committed)
  ├── src/
  │   └── my_project/
  │       ├── __init__.py
  │       ├── data.py
  │       ├── model.py
  │       └── train.py
  ├── tests/
  │   ├── test_data.py
  │   └── test_model.py
  ├── notebooks/
  │   └── exploration.ipynb
  └── data/                   <- gitignored if large
      └── .gitkeep
```

---

## Exercises

1. **Setup Comparison**: Create the same project with venv+pip, uv,
   and poetry. Install numpy, pandas, and pytest. Compare setup time
   and generated files.

2. **Lock File Analysis**: Generate a lock file with uv or poetry for
   a project with torch, transformers, and pandas. Count the total
   number of transitive dependencies.

3. **Multi-Version Testing**: Create a project that uses match
   statements (3.10+). Set up virtual environments with Python 3.9
   and 3.11. Verify it fails on 3.9 and passes on 3.11.

4. **Docker ML Environment**: Write a Dockerfile for an ML project
   that installs PyTorch with CUDA support. Include a multi-stage
   build that separates dependency installation from code.

5. **Dependency Audit**: Take an existing project with unpinned deps.
   Pin everything, create a lock file, and verify a clean install
   in a fresh virtual environment produces identical versions.

---

[Next: Lesson 14 - Testing ML Code ->](14-testing-ml-code.md)
