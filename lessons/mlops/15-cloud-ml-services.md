# Lesson 15: Cloud ML Services

> Running ML in the cloud is like choosing between cooking at home,
> ordering meal kits, or eating at a restaurant. You can build
> everything yourself (DIY on VMs), use semi-managed services
> (SageMaker, Vertex AI), or go fully managed (API calls).
> Each trades control for convenience.

---

## The ML Cloud Spectrum

```
  MORE CONTROL                                    MORE CONVENIENCE
  <------------------------------------------------->

  Raw VMs          Managed          Managed       API-only
  (EC2/GCE)        Training         Endpoints     (OpenAI, etc.)
  +--------+       +--------+       +--------+   +--------+
  | You    |       | You    |       | You    |   | You    |
  | manage |       | write  |       | upload |   | call   |
  | EVERY- |       | code,  |       | model, |   | API,   |
  | THING  |       | cloud  |       | cloud  |   | done   |
  |        |       | handles|       | serves |   |        |
  |        |       | infra  |       | it     |   |        |
  +--------+       +--------+       +--------+   +--------+

  Cost:     $        $$              $$$           $$$$
  Effort:   High     Medium          Low           Minimal
  Control:  Full     Good            Some          None
```

---

## AWS SageMaker

```
  SageMaker ecosystem:

  +--------------------------------------------------+
  |  SageMaker                                        |
  |                                                    |
  |  +------------+  +------------+  +-------------+  |
  |  | Studio     |  | Training   |  | Endpoints   |  |
  |  | (notebooks)|  | Jobs       |  | (inference) |  |
  |  +------------+  +------------+  +-------------+  |
  |                                                    |
  |  +------------+  +------------+  +-------------+  |
  |  | Processing |  | Pipelines  |  | Feature     |  |
  |  | Jobs       |  | (ML CI/CD) |  | Store       |  |
  |  +------------+  +------------+  +-------------+  |
  |                                                    |
  |  +------------+  +------------+  +-------------+  |
  |  | Ground     |  | Clarify    |  | Model       |  |
  |  | Truth      |  | (explain)  |  | Monitor     |  |
  |  | (labeling) |  |            |  |             |  |
  |  +------------+  +------------+  +-------------+  |
  +--------------------------------------------------+
```

```python
import sagemaker
from sagemaker.pytorch import PyTorch

session = sagemaker.Session()
role = sagemaker.get_execution_role()

estimator = PyTorch(
    entry_point="train.py",
    source_dir="./src",
    role=role,
    instance_count=1,
    instance_type="ml.p3.2xlarge",
    framework_version="2.1",
    py_version="py310",
    hyperparameters={
        "epochs": 10,
        "batch-size": 64,
        "learning-rate": 0.001,
    },
    metric_definitions=[
        {"Name": "train:loss", "Regex": "train_loss: ([0-9\\.]+)"},
        {"Name": "val:accuracy", "Regex": "val_accuracy: ([0-9\\.]+)"},
    ],
)

estimator.fit({
    "train": "s3://my-bucket/data/train/",
    "validation": "s3://my-bucket/data/val/",
})
```

### SageMaker Deployment

```python
from sagemaker.pytorch import PyTorchModel

model = PyTorchModel(
    model_data=estimator.model_data,
    role=role,
    framework_version="2.1",
    py_version="py310",
    entry_point="inference.py",
)

predictor = model.deploy(
    initial_instance_count=1,
    instance_type="ml.g4dn.xlarge",
    endpoint_name="my-model-endpoint",
)

result = predictor.predict({"inputs": "Hello, world!"})

predictor.delete_endpoint()
```

---

## GCP Vertex AI

```
  Vertex AI ecosystem:

  +--------------------------------------------------+
  |  Vertex AI                                        |
  |                                                    |
  |  +------------+  +------------+  +-------------+  |
  |  | Workbench  |  | Training   |  | Endpoints   |  |
  |  | (notebooks)|  | (Custom +  |  | (online +   |  |
  |  |            |  |  AutoML)   |  |  batch)     |  |
  |  +------------+  +------------+  +-------------+  |
  |                                                    |
  |  +------------+  +------------+  +-------------+  |
  |  | Pipelines  |  | Feature    |  | Model       |  |
  |  | (Kubeflow) |  | Store      |  | Registry    |  |
  |  +------------+  +------------+  +-------------+  |
  |                                                    |
  |  +------------+  +------------+                    |
  |  | Experiments|  | Model      |                    |
  |  | (tracking) |  | Monitoring |                    |
  |  +------------+  +------------+                    |
  +--------------------------------------------------+
```

```python
from google.cloud import aiplatform

aiplatform.init(project="my-project", location="us-central1")

job = aiplatform.CustomTrainingJob(
    display_name="pytorch-training",
    script_path="train.py",
    container_uri="us-docker.pkg.dev/vertex-ai/training/pytorch-gpu.2-1:latest",
    requirements=["transformers", "datasets"],
)

model = job.run(
    replica_count=1,
    machine_type="n1-standard-8",
    accelerator_type="NVIDIA_TESLA_T4",
    accelerator_count=1,
    args=["--epochs=10", "--batch-size=64"],
)

endpoint = model.deploy(
    machine_type="n1-standard-4",
    accelerator_type="NVIDIA_TESLA_T4",
    accelerator_count=1,
    min_replica_count=1,
    max_replica_count=3,
)

prediction = endpoint.predict(instances=[{"text": "Hello, world!"}])
```

---

## Azure Machine Learning

```
  Azure ML ecosystem:

  +--------------------------------------------------+
  |  Azure ML                                         |
  |                                                    |
  |  +------------+  +------------+  +-------------+  |
  |  | Compute    |  | Jobs       |  | Endpoints   |  |
  |  | Instances  |  | (training) |  | (managed +  |  |
  |  | (notebooks)|  |            |  |  batch)     |  |
  |  +------------+  +------------+  +-------------+  |
  |                                                    |
  |  +------------+  +------------+  +-------------+  |
  |  | Pipelines  |  | Data       |  | Model       |  |
  |  | (Designer) |  | Assets     |  | Registry    |  |
  |  +------------+  +------------+  +-------------+  |
  |                                                    |
  |  +------------+  +------------+                    |
  |  | MLflow     |  | Responsible|                    |
  |  | Integration|  | AI tools   |                    |
  |  +------------+  +------------+                    |
  +--------------------------------------------------+
```

```python
from azure.ai.ml import MLClient, command, Input
from azure.identity import DefaultAzureCredential

ml_client = MLClient(
    DefaultAzureCredential(),
    subscription_id="your-sub-id",
    resource_group_name="my-rg",
    workspace_name="my-workspace",
)

training_job = command(
    code="./src",
    command="python train.py --epochs 10 --lr 0.001",
    environment="AzureML-pytorch-2.1-cuda12@latest",
    compute="gpu-cluster",
    instance_count=1,
    inputs={
        "train_data": Input(
            type="uri_folder",
            path="azureml://datastores/data/paths/train/"
        ),
    },
)

returned_job = ml_client.jobs.create_or_update(training_job)
ml_client.jobs.stream(returned_job.name)
```

---

## Cloud Comparison Matrix

```
  +-------------------+----------------+----------------+----------------+
  | Feature           | AWS SageMaker  | GCP Vertex AI  | Azure ML       |
  +-------------------+----------------+----------------+----------------+
  | Notebook IDE      | Studio         | Workbench      | Compute Inst.  |
  | AutoML            | Autopilot      | AutoML         | AutoML         |
  | Training          | Training Jobs  | Custom Jobs    | Jobs/Commands  |
  | Serving           | Endpoints      | Endpoints      | Endpoints      |
  | Pipelines         | SageMaker Pipe | Kubeflow-based | Designer/SDK   |
  | Feature Store     | Feature Store  | Feature Store  | (via Feast)    |
  | Experiment Track  | Experiments    | Experiments    | MLflow         |
  | Model Registry    | Model Registry | Model Registry | Model Registry |
  | Monitoring        | Model Monitor  | Model Monitor  | (via custom)   |
  +-------------------+----------------+----------------+----------------+
  | GPU Options       | P3, P4, G4, G5 | T4, A100, L4   | T4, A100, V100 |
  | Spot/Preemptible  | Yes            | Yes            | Yes            |
  | Multi-cloud       | No             | No             | No             |
  +-------------------+----------------+----------------+----------------+

  Pricing (approximate, GPU training per hour):
  +-------------------+----------------+
  | Instance          | ~Cost/hr       |
  +-------------------+----------------+
  | T4 (16GB)         | $0.50-1.00     |
  | A10G (24GB)       | $1.00-2.00     |
  | V100 (16GB)       | $2.00-3.00     |
  | A100 (40GB)       | $3.00-5.00     |
  | A100 (80GB)       | $5.00-8.00     |
  | H100 (80GB)       | $8.00-12.00    |
  +-------------------+----------------+
```

---

## Managed vs DIY Decision

```
  Use MANAGED (SageMaker/Vertex/Azure) when:
  +----------------------------------------------+
  | - Team < 5 ML engineers                       |
  | - Don't want to manage Kubernetes             |
  | - Need quick time-to-production               |
  | - Standard training workflows                 |
  | - Budget allows 20-40% premium over raw VMs   |
  +----------------------------------------------+

  Use DIY (Kubernetes + raw VMs) when:
  +----------------------------------------------+
  | - Team > 10 ML engineers                      |
  | - Have dedicated MLOps/platform team           |
  | - Need custom infrastructure                  |
  | - Cost optimization is critical               |
  | - Multi-cloud or hybrid requirements           |
  | - Very large scale (100+ GPU training)         |
  +----------------------------------------------+

  Use API-only (OpenAI, Anthropic, etc.) when:
  +----------------------------------------------+
  | - No ML team                                   |
  | - Standard NLP/vision tasks                    |
  | - Rapid prototyping                            |
  | - Budget per query is acceptable               |
  | - Data privacy allows external API calls       |
  +----------------------------------------------+
```

---

## Multi-Cloud Architecture

```
  +---------------------------------------------------+
  |  Your ML Platform                                   |
  |                                                     |
  |  +--------+  +--------+  +--------+                |
  |  | MLflow |  | Docker |  | Airflow|  <-- Portable  |
  |  +--------+  +--------+  +--------+     tools      |
  |       |           |           |                     |
  |  +----v-----------v-----------v----+               |
  |  |   Abstraction Layer             |               |
  |  |   (Terraform / Pulumi)          |               |
  |  +----+------------+-----------+---+               |
  |       |            |           |                    |
  +-------+------------+-----------+--------------------+
          |            |           |
     +----v----+  +----v----+  +--v------+
     | AWS     |  | GCP     |  | Azure   |
     | (train) |  | (serve) |  | (data)  |
     +---------+  +---------+  +---------+

  Key principle: keep YOUR code cloud-agnostic.
  Use containers (Docker) and portable frameworks (MLflow).
  Only cloud-specific code should be in infrastructure layer.
```

---

## Exercises

1. **SageMaker training**: Create a SageMaker training job that
   trains a PyTorch model on a small dataset in S3. Monitor the
   job in the SageMaker console.

2. **Model deployment**: Deploy a trained model as a SageMaker or
   Vertex AI endpoint. Write a client that sends requests and
   measures latency (p50, p95, p99).

3. **Cost comparison**: For a specific training job (e.g., fine-tune
   BERT on 100K samples), estimate costs on all three clouds.
   Include spot instance pricing.

4. **Portable training**: Write a training script that works
   locally AND on any cloud. Use environment variables and
   config files to switch between local paths and cloud storage.

5. **Auto-scaling endpoint**: Deploy a model endpoint with
   auto-scaling (min=1, max=4 replicas). Load test it and
   observe scaling behavior.

---

**Next**: [Lesson 16 - GPU Clusters & Cost](./16-gpu-clusters-cost.md)
