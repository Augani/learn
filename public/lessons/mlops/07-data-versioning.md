# Lesson 07: Data Versioning

## Git for Your Data

```
  Code (git)                     Data (DVC / lakeFS)
  +------------------------+     +------------------------+
  | git commit abc123      |     | dvc commit v2.1        |
  | "Fixed tokenizer bug"  |     | "Added 50K new samples"|
  |                        |     |                        |
  | git checkout v1.0      |     | dvc checkout v1.0      |
  | (restore old code)     |     | (restore old dataset)  |
  +------------------------+     +------------------------+
```

You would never develop code without git. But most teams develop
ML models with **unversioned data** -- like writing a novel where
someone randomly changes chapters and you can't undo it.

Data versioning gives you the same superpowers git gives code:
history, rollback, branching, and reproducibility.

---

## Why Version Data?

```
  Monday:    Train on dataset v1 --> accuracy 0.94
  Tuesday:   Someone "fixes" 10K labels
  Wednesday: Train on dataset v2 --> accuracy 0.87
  Thursday:  "What happened?!"

  Without versioning: hours of debugging
  With versioning:    diff v1 vs v2, find the problem in minutes
```

---

## DVC (Data Version Control)

DVC extends git for large files and datasets. Git tracks the
metadata (small pointer files), DVC tracks the actual data.

```
  Git Repository
  +----------------------------------+
  | code/train.py          (git)     |
  | code/model.py          (git)     |
  | data/train.csv.dvc     (git)     | <-- tiny pointer file
  | dvc.yaml               (git)     |
  | dvc.lock               (git)     |
  +----------------------------------+
           |
           | pointer references
           v
  Remote Storage (S3, GCS, Azure)
  +----------------------------------+
  | data/train.csv         (100 GB)  | <-- actual data
  | data/val.csv           (20 GB)   |
  +----------------------------------+
```

### Getting Started with DVC

```bash
pip install dvc dvc-s3

cd my-ml-project
git init
dvc init

mkdir data
# ... put your dataset in data/

dvc add data/train.csv

git add data/train.csv.dvc data/.gitignore
git commit -m "data: add training dataset v1"

dvc remote add -d myremote s3://my-bucket/dvc-store
dvc push
```

### The .dvc Pointer File

```yaml
# data/train.csv.dvc
outs:
- md5: a1b2c3d4e5f6...
  size: 1073741824
  hash: md5
  path: train.csv
```

### Switching Between Data Versions

```bash
git log --oneline
# abc123 data: add augmented samples v2
# def456 data: add training dataset v1

git checkout def456 -- data/train.csv.dvc
dvc checkout

# Now data/train.csv is back to v1

git checkout abc123 -- data/train.csv.dvc
dvc checkout

# Now data/train.csv is v2 again
```

---

## DVC Pipelines

DVC can track entire ML pipelines, not just data files.

```
  dvc.yaml defines the pipeline:

  +----------+     +-----------+     +----------+     +--------+
  | prepare  | --> | featurize | --> | train    | --> | eval   |
  | data     |     | data      |     | model    |     | model  |
  +----------+     +-----------+     +----------+     +--------+
  deps: raw.csv    deps: clean.csv   deps: feat.csv   deps: model.pkl
  outs: clean.csv  outs: feat.csv    outs: model.pkl  metrics: scores.json
```

```yaml
# dvc.yaml
stages:
  prepare:
    cmd: python src/prepare.py
    deps:
      - src/prepare.py
      - data/raw.csv
    outs:
      - data/clean.csv

  featurize:
    cmd: python src/featurize.py
    deps:
      - src/featurize.py
      - data/clean.csv
    outs:
      - data/features.csv

  train:
    cmd: python src/train.py
    deps:
      - src/train.py
      - data/features.csv
    outs:
      - models/model.pkl
    params:
      - train.learning_rate
      - train.n_estimators

  evaluate:
    cmd: python src/evaluate.py
    deps:
      - src/evaluate.py
      - models/model.pkl
      - data/features.csv
    metrics:
      - metrics/scores.json:
          cache: false
```

```bash
dvc repro

dvc repro train

dvc metrics show
```

---

## lakeFS: Git-Like Operations on Data Lakes

```
  lakeFS                            Git
  +----------------------------+    +----------------------------+
  | Branch from main data      |    | Branch from main code      |
  | Make changes (add/delete)  |    | Make changes (edit files)  |
  | Commit changes             |    | Commit changes             |
  | Merge to main              |    | Merge to main              |
  | Rollback if broken         |    | Revert if broken           |
  +----------------------------+    +----------------------------+

  lakeFS works at the storage layer (S3-compatible).
  Your tools (Spark, pandas) don't need to change.
```

### lakeFS with Python

```python
import lakefs


repo = lakefs.Repository("ml-datasets")

branch = repo.branch("experiment/new-labels")
branch.create(source_reference="main")

with open("new_labels.csv", "rb") as f:
    branch.object("datasets/labels.csv").upload(f)

branch.commit(
    message="data: update labels with corrected annotations",
    metadata={"author": "data-team", "ticket": "DATA-1234"},
)

diff = branch.diff("main")
for change in diff:
    print(f"{change.type}: {change.path}")

branch.merge_into("main")
```

---

## Dataset Metadata Tracking

Always version not just the data, but information about it:

```python
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, asdict

import pandas as pd


@dataclass
class DatasetVersion:
    name: str
    version: str
    created_at: str
    row_count: int
    column_count: int
    file_hash: str
    schema: dict
    statistics: dict
    source: str
    description: str


def create_dataset_version(
    df: pd.DataFrame,
    name: str,
    version: str,
    source: str,
    description: str,
    output_dir: str,
) -> DatasetVersion:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    data_path = output_path / f"{name}_{version}.parquet"
    df.to_parquet(data_path, index=False)

    file_hash = hashlib.sha256(data_path.read_bytes()).hexdigest()

    schema = {col: str(dtype) for col, dtype in df.dtypes.items()}

    stats = {}
    for col in df.select_dtypes(include="number").columns:
        stats[col] = {
            "mean": float(df[col].mean()),
            "std": float(df[col].std()),
            "min": float(df[col].min()),
            "max": float(df[col].max()),
            "null_count": int(df[col].isnull().sum()),
        }

    version_info = DatasetVersion(
        name=name,
        version=version,
        created_at=datetime.now(timezone.utc).isoformat(),
        row_count=len(df),
        column_count=len(df.columns),
        file_hash=file_hash,
        schema=schema,
        statistics=stats,
        source=source,
        description=description,
    )

    meta_path = output_path / f"{name}_{version}_meta.json"
    meta_path.write_text(json.dumps(asdict(version_info), indent=2))

    return version_info
```

---

## Data Diff: What Changed?

```python
def compare_datasets(
    df_old: pd.DataFrame,
    df_new: pd.DataFrame,
    key_column: str,
) -> dict:
    old_keys = set(df_old[key_column])
    new_keys = set(df_new[key_column])

    added = new_keys - old_keys
    removed = old_keys - new_keys
    common = old_keys & new_keys

    common_old = df_old[df_old[key_column].isin(common)].set_index(key_column)
    common_new = df_new[df_new[key_column].isin(common)].set_index(key_column)

    changed_mask = (common_old != common_new).any(axis=1)
    modified = set(changed_mask[changed_mask].index)

    return {
        "added": len(added),
        "removed": len(removed),
        "modified": len(modified),
        "unchanged": len(common) - len(modified),
        "old_total": len(df_old),
        "new_total": len(df_new),
    }
```

```
  Dataset Diff Report
  +----------------------------------+
  | v1.0 --> v2.0                    |
  |                                  |
  | Added:     5,234 rows            |
  | Removed:   127 rows              |
  | Modified:  892 rows              |
  | Unchanged: 94,747 rows           |
  |                                  |
  | Schema changes:                  |
  | + new_feature (float64)          |
  | ~ label: int64 --> string        |
  +----------------------------------+
```

---

## Reproducibility Manifest

```python
import subprocess
import platform


def create_reproducibility_manifest(
    data_version: str,
    model_config: dict,
    output_path: str,
):
    git_hash = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()

    manifest = {
        "data_version": data_version,
        "code_commit": git_hash,
        "model_config": model_config,
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    Path(output_path).write_text(json.dumps(manifest, indent=2))
    return manifest
```

---

## Tool Comparison

```
  Feature          | DVC        | lakeFS     | Delta Lake
  -----------------|------------|------------|------------
  Git-like ops     | YES        | YES        | Partial
  Large files      | YES        | YES        | YES
  Branching        | Via git    | Native     | No
  Storage          | S3/GCS/etc | S3-compat  | S3/HDFS
  Pipeline support | YES        | No         | No
  Learning curve   | Low        | Medium     | Low
  Best for         | ML teams   | Data lakes | Analytics
```

---

## Exercises

1. **DVC Setup**: Initialize a DVC project, add a dataset,
   push to a local remote. Make changes, commit, and practice
   switching between versions.

2. **Pipeline**: Define a DVC pipeline with prepare, train,
   and evaluate stages. Run `dvc repro` and verify only
   changed stages re-run.

3. **Data Diff**: Write a script that compares two CSV versions
   and produces a diff report showing added, removed, and
   modified rows.

4. **Reproducibility**: Create a full reproducibility manifest
   that captures code version, data version, dependencies,
   and hardware info. Verify you can recreate a training run
   from the manifest.

---

[Next: Lesson 08 - ML Pipelines -->](08-ml-pipelines.md)
