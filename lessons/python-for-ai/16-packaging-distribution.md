# Lesson 16: Packaging & Distribution

> Sharing code without packaging is like giving someone a pile
> of ingredients instead of a meal. Packaging makes it `pip install`-able.

---

## The Packaging Landscape

```
  FROM CODE TO PACKAGE
  ====================

  Your code:          my_project/
  ├── src/            │ ├── my_lib/
  │   ├── __init__.py │ │   ├── __init__.py
  │   └── core.py     │ │   └── core.py
  └── tests/          │ └── tests/

       │  pyproject.toml + build
       ▼

  Distribution:
  ┌──────────────────────────────────┐
  │  my_lib-0.1.0-py3-none-any.whl  │  <- wheel (binary)
  │  my_lib-0.1.0.tar.gz            │  <- sdist (source)
  └──────────────────────────────────┘

       │  upload to PyPI
       ▼

  Anyone in the world:
  $ pip install my-lib
```

---

## pyproject.toml: The One Config File

pyproject.toml is the single source of truth for your project.
Like a passport for your package -- name, version, dependencies.

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "my-ml-toolkit"
version = "0.1.0"
description = "Utilities for ML pipelines"
readme = "README.md"
license = {text = "MIT"}
requires-python = ">=3.10"
authors = [
    {name = "Your Name", email = "you@example.com"},
]
classifiers = [
    "Programming Language :: Python :: 3",
    "License :: OSI Approved :: MIT License",
    "Topic :: Scientific/Engineering :: Artificial Intelligence",
]
dependencies = [
    "numpy>=1.24",
    "pandas>=2.0",
    "scikit-learn>=1.3",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "ruff>=0.1",
    "mypy>=1.0",
]
gpu = [
    "torch>=2.0",
]

[project.scripts]
ml-train = "my_ml_toolkit.cli:main"

[project.urls]
Homepage = "https://github.com/you/my-ml-toolkit"
Issues = "https://github.com/you/my-ml-toolkit/issues"
```

---

## Project Layout

```
  RECOMMENDED: src LAYOUT
  =======================

  my-ml-toolkit/
  ├── pyproject.toml
  ├── LICENSE
  ├── README.md
  ├── src/
  │   └── my_ml_toolkit/
  │       ├── __init__.py
  │       ├── data.py
  │       ├── features.py
  │       ├── model.py
  │       └── cli.py
  ├── tests/
  │   ├── test_data.py
  │   ├── test_features.py
  │   └── test_model.py
  └── .gitignore

  WHY src/ LAYOUT?
  - Prevents accidentally importing local code
    instead of installed package
  - Forces you to install your package to test it
  - Catches packaging errors early
```

---

## The __init__.py File

```python
from my_ml_toolkit.data import load_dataset, split_data
from my_ml_toolkit.features import normalize, encode_categorical
from my_ml_toolkit.model import train, predict, evaluate

__version__ = "0.1.0"

__all__ = [
    "load_dataset",
    "split_data",
    "normalize",
    "encode_categorical",
    "train",
    "predict",
    "evaluate",
]
```

---

## Building Your Package

```bash
pip install build

python -m build
```

```
  After building:
  dist/
  ├── my_ml_toolkit-0.1.0-py3-none-any.whl
  └── my_ml_toolkit-0.1.0.tar.gz

  WHEEL vs SDIST
  ==============
  .whl (wheel):
  - Pre-built, installs fast
  - No compilation needed
  - Platform-specific if C extensions

  .tar.gz (source distribution):
  - Raw source code
  - Needs to be built on install
  - Always works, just slower
```

---

## Build Backends

```
  ┌────────────┬────────────────────────────────────┐
  │ Backend    │ Best For                            │
  ├────────────┼────────────────────────────────────┤
  │ hatchling  │ Pure Python, simple, modern         │
  │ setuptools │ Legacy support, C extensions        │
  │ flit-core  │ Minimal config, pure Python         │
  │ maturin    │ Rust extensions (PyO3)              │
  │ poetry     │ If already using poetry workflow    │
  └────────────┴────────────────────────────────────┘
```

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

```toml
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]
```

---

## Version Management

```python
__version__ = "0.1.0"
```

```
  SEMANTIC VERSIONING
  ===================

  MAJOR.MINOR.PATCH
    │     │     │
    │     │     └── Bug fixes (0.1.0 -> 0.1.1)
    │     └──────── New features, backward compatible (0.1.0 -> 0.2.0)
    └────────────── Breaking changes (0.x.x -> 1.0.0)

  Pre-1.0: anything goes, API is unstable
  Post-1.0: follow semver strictly

  For ML packages:
  - Patch: fix bug in preprocessing
  - Minor: add new model type
  - Major: change data format or API
```

---

## CLI Entry Points

```python
import argparse
import sys


def main():
    parser = argparse.ArgumentParser(description="ML Training CLI")
    subparsers = parser.add_subparsers(dest="command")

    train_parser = subparsers.add_parser("train")
    train_parser.add_argument("--data", required=True)
    train_parser.add_argument("--epochs", type=int, default=10)
    train_parser.add_argument("--output", default="model.pkl")

    eval_parser = subparsers.add_parser("evaluate")
    eval_parser.add_argument("--model", required=True)
    eval_parser.add_argument("--data", required=True)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    if args.command == "train":
        print(f"Training on {args.data} for {args.epochs} epochs")
    elif args.command == "evaluate":
        print(f"Evaluating {args.model} on {args.data}")
```

```toml
[project.scripts]
ml-train = "my_ml_toolkit.cli:main"
```

```bash
pip install -e .
ml-train train --data train.csv --epochs 20
```

---

## Development Install

```bash
pip install -e ".[dev]"
```

```
  EDITABLE INSTALL (-e)
  =====================

  Normal install:
  pip install . --> copies files to site-packages
  Edit source   --> NOT reflected until reinstall

  Editable install:
  pip install -e . --> links to your source
  Edit source      --> changes reflected immediately

  Essential for development!
```

---

## Publishing to PyPI

```bash
pip install twine

python -m build

twine check dist/*

twine upload --repository testpypi dist/*

pip install --index-url https://test.pypi.org/simple/ my-ml-toolkit

twine upload dist/*
```

```
  PUBLISHING CHECKLIST
  ====================
  ┌───┬───────────────────────────────────────┐
  │ 1 │ Choose a unique package name          │
  │ 2 │ Bump version in __init__.py           │
  │ 3 │ Run full test suite                   │
  │ 4 │ Build: python -m build                │
  │ 5 │ Check: twine check dist/*             │
  │ 6 │ Test: upload to TestPyPI first        │
  │ 7 │ Install from TestPyPI and verify      │
  │ 8 │ Upload to real PyPI                   │
  │ 9 │ Tag release in git                    │
  └───┴───────────────────────────────────────┘
```

---

## Including Data Files

```toml
[tool.hatch.build.targets.wheel]
packages = ["src/my_ml_toolkit"]

[tool.hatch.build.targets.wheel.force-include]
"data/default_config.yaml" = "my_ml_toolkit/data/default_config.yaml"
```

```python
from importlib.resources import files


def get_default_config():
    config_path = files("my_ml_toolkit.data").joinpath("default_config.yaml")
    return config_path.read_text()
```

---

## Automated Publishing with GitHub Actions

```yaml
name: Publish
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install build
      - run: python -m build
      - uses: pypa/gh-action-pypi-publish@release/v1
```

---

## Exercises

**Exercise 1:** Take any Python script you've written and convert it
into a proper installable package with pyproject.toml, src layout,
and a CLI entry point. Install it in editable mode and verify the
CLI works.

**Exercise 2:** Add optional dependency groups to your package:
`[gpu]` for torch, `[viz]` for matplotlib, `[dev]` for testing tools.
Verify you can install each group independently.

**Exercise 3:** Set up a complete build pipeline: build both wheel
and sdist, run twine check, upload to TestPyPI, install from
TestPyPI, and run your test suite against the installed package.

**Exercise 4:** Create a package that includes a default config
YAML file and a pre-trained model weights file. Use
importlib.resources to load them at runtime.

**Exercise 5:** Write a GitHub Actions workflow that runs tests on
every push and publishes to PyPI on every tagged release.

---

[Next: Reference - Python Cheatsheet ->](reference-cheatsheet.md)
