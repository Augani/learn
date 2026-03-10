# Reference: MLOps Tools Comparison

A practical guide to choosing MLOps tools for each stage of the
ML lifecycle.

---

## Tool Landscape

```
  +------------------------------------------------------------------+
  |                     MLOps Tool Categories                          |
  |                                                                    |
  |  DATA              TRAINING           SERVING          MONITORING  |
  |  +--------+        +--------+         +--------+      +--------+  |
  |  |DVC     |        |MLflow  |         |Seldon  |      |Evidently| |
  |  |LakeFS  |        |W&B     |         |BentoML |      |Arize   |  |
  |  |Delta   |        |ClearML |         |TorchSer|      |Whylabs |  |
  |  |Feast   |        |Neptune |         |TFServe |      |NannyML |  |
  |  +--------+        +--------+         |vLLM    |      +--------+  |
  |                                       |TGI     |                   |
  |  PIPELINE          INFRA              +--------+      REGISTRY    |
  |  +--------+        +--------+                         +--------+  |
  |  |Airflow |        |K8s     |                         |MLflow  |  |
  |  |Prefect |        |Docker  |                         |DVC     |  |
  |  |Dagster |        |Terraform|                        |W&B     |  |
  |  |Kubeflow|        |Pulumi  |                         |Vertex  |  |
  |  +--------+        +--------+                         +--------+  |
  +------------------------------------------------------------------+
```

---

## Experiment Tracking

```
  +-------------+--------+--------+----------+---------+-----------+
  | Tool        | Free   | Self-  | Cloud    | UI      | Best For  |
  |             | Tier   | hosted | hosted   | Quality |           |
  +-------------+--------+--------+----------+---------+-----------+
  | MLflow      | OSS    | Yes    | Databr.  | Good    | Standard  |
  | W&B         | Free*  | No     | Yes      | Best    | Research  |
  | ClearML     | OSS    | Yes    | Yes      | Good    | Teams     |
  | Neptune     | Free*  | No     | Yes      | Good    | Collab    |
  | Comet       | Free*  | No     | Yes      | Good    | Enterprise|
  | TensorBoard | OSS    | Yes    | No       | Basic   | Quick viz |
  +-------------+--------+--------+----------+---------+-----------+
  * = limited free tier

  Recommendation:
  - Solo / small team: MLflow (free, self-hosted)
  - Research team: W&B (best UI, easy sharing)
  - Enterprise: MLflow on Databricks or ClearML
```

---

## Data Versioning

```
  +-------------+--------+-----------+----------+------------------+
  | Tool        | Free   | Storage   | Git-like | Best For         |
  +-------------+--------+-----------+----------+------------------+
  | DVC         | OSS    | Any cloud | Yes      | Data + models    |
  | LakeFS      | OSS    | S3-compat.| Yes      | Data lakes       |
  | Delta Lake  | OSS    | Any       | ACID txn | Spark ecosystem  |
  | Pachyderm   | OSS    | K8s       | Yes      | Data pipelines   |
  +-------------+--------+-----------+----------+------------------+

  Recommendation:
  - Files/models: DVC (simple, Git-integrated)
  - Data lake: LakeFS (branch your data like code)
  - Spark users: Delta Lake
```

---

## Feature Stores

```
  +-------------+--------+-----------+----------+------------------+
  | Tool        | Free   | Online    | Offline  | Best For         |
  +-------------+--------+-----------+----------+------------------+
  | Feast       | OSS    | Redis/DDB | Files/BQ | Standard choice  |
  | Tecton      | No     | Yes       | Yes      | Enterprise       |
  | Hopsworks   | OSS    | Yes       | Yes      | Full platform    |
  | AWS Feature | No     | Yes       | Yes      | AWS-only         |
  | GCP Feature | No     | Yes       | Yes      | GCP-only         |
  +-------------+--------+-----------+----------+------------------+

  Recommendation:
  - Start simple: Feast (open source, flexible)
  - Enterprise: Tecton (managed, low-latency)
  - Cloud-native: Use your cloud's feature store
```

---

## Model Serving

```
  +-------------+--------+---------+----------+-------------------+
  | Tool        | Free   | GPU     | Batching | Best For          |
  +-------------+--------+---------+----------+-------------------+
  | vLLM        | OSS    | Yes     | Cont.    | LLM inference     |
  | TGI         | OSS    | Yes     | Cont.    | HuggingFace LLMs  |
  | TorchServe  | OSS    | Yes     | Static   | PyTorch models    |
  | TF Serving  | OSS    | Yes     | Static   | TensorFlow models |
  | Triton      | OSS    | Yes     | Dynamic  | Multi-framework   |
  | BentoML     | OSS    | Yes     | Adaptive | General purpose   |
  | Seldon Core | OSS    | Yes     | Yes      | Kubernetes native |
  | Ray Serve   | OSS    | Yes     | Dynamic  | Complex pipelines |
  +-------------+--------+---------+----------+-------------------+

  Decision guide:
  - LLMs: vLLM (best throughput) or TGI (HuggingFace ecosystem)
  - PyTorch models: TorchServe or BentoML
  - Multi-framework: Triton Inference Server
  - Kubernetes-native: Seldon Core
```

---

## Pipeline Orchestration

```
  +-------------+--------+---------+----------+-------------------+
  | Tool        | Free   | UI      | K8s      | Best For          |
  +-------------+--------+---------+----------+-------------------+
  | Airflow     | OSS    | Good    | Yes      | General ETL+ML   |
  | Prefect     | OSS*   | Great   | Yes      | Modern Airflow   |
  | Dagster     | OSS*   | Great   | Yes      | Data-aware       |
  | Kubeflow    | OSS    | Basic   | Native   | ML-specific      |
  | Metaflow    | OSS    | Basic   | Yes      | Netflix-style    |
  | ZenML       | OSS*   | Good    | Yes      | MLOps pipelines  |
  | Argo        | OSS    | Basic   | Native   | K8s workflows    |
  +-------------+--------+---------+----------+-------------------+
  * = cloud version available

  Recommendation:
  - Already using Airflow: stick with it
  - Greenfield: Prefect or Dagster
  - ML-only: Kubeflow Pipelines or ZenML
  - Data team: Dagster (asset-oriented)
```

---

## Monitoring & Observability

```
  +-------------+--------+---------+----------+-------------------+
  | Tool        | Free   | Drift   | Explain  | Best For          |
  +-------------+--------+---------+----------+-------------------+
  | Evidently   | OSS    | Yes     | Basic    | Reports + tests  |
  | Arize       | Free*  | Yes     | Yes      | Production debug |
  | Whylabs     | Free*  | Yes     | Basic    | Data profiling   |
  | NannyML     | OSS    | Yes     | No       | Performance est. |
  | Fiddler     | No     | Yes     | Yes      | Enterprise       |
  | Seldon Alibi| OSS    | Yes     | Yes      | Explanations     |
  +-------------+--------+---------+----------+-------------------+

  Recommendation:
  - Start: Evidently (OSS, easy to integrate)
  - Production: Arize or Whylabs (managed, alerting)
  - Explanations: Seldon Alibi + SHAP
```

---

## Infrastructure

```
  +------------------+--------+-----------------------------------+
  | Tool             | Free   | Best For                          |
  +------------------+--------+-----------------------------------+
  | Docker           | OSS    | Containerization (required)       |
  | Kubernetes       | OSS    | Orchestration (large scale)       |
  | Terraform        | OSS*   | Infrastructure as code            |
  | Pulumi           | OSS*   | IaC with real programming langs   |
  | Helm             | OSS    | K8s package management            |
  | ArgoCD           | OSS    | GitOps for Kubernetes             |
  +------------------+--------+-----------------------------------+
```

---

## Recommended Stacks

```
  STARTUP STACK (free, simple):
  +--------------------------------------------------+
  | Experiment tracking:  MLflow                      |
  | Data versioning:      DVC                         |
  | Pipeline:             Prefect                     |
  | Serving:              BentoML / FastAPI            |
  | Monitoring:           Evidently                   |
  | Registry:             MLflow Model Registry       |
  | Infrastructure:       Docker + single cloud       |
  +--------------------------------------------------+

  SCALE-UP STACK (growing team):
  +--------------------------------------------------+
  | Experiment tracking:  W&B                         |
  | Data versioning:      DVC + LakeFS               |
  | Feature store:        Feast                       |
  | Pipeline:             Dagster                     |
  | Serving:              vLLM / Triton + K8s         |
  | Monitoring:           Arize / Evidently           |
  | Registry:             MLflow + S3                 |
  | Infrastructure:       Kubernetes + Terraform      |
  +--------------------------------------------------+

  ENTERPRISE STACK (large org):
  +--------------------------------------------------+
  | Platform:             SageMaker / Vertex AI       |
  | Experiment tracking:  Platform-native + W&B       |
  | Feature store:        Tecton / Platform-native    |
  | Pipeline:             Kubeflow / Airflow           |
  | Serving:              Triton + auto-scaling        |
  | Monitoring:           Arize + custom dashboards   |
  | Registry:             Platform-native              |
  | Infrastructure:       K8s + Terraform + ArgoCD    |
  +--------------------------------------------------+
```
