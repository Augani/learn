# Lesson 16: GPU Clusters & Cost Optimization

> Training ML models on GPUs is like renting construction equipment.
> You wouldn't buy a crane to build one house. You rent it, use it
> efficiently, and return it when done. Cloud GPUs work the same
> way -- the key is knowing WHEN to rent, WHAT to rent, and HOW
> to minimize waste.

---

## GPU Landscape

```
  +------------+--------+----------+----------+-----------+
  | GPU        | VRAM   | FP16     | Cost/hr  | Best For  |
  |            |        | TFLOPS   | (cloud)  |           |
  +------------+--------+----------+----------+-----------+
  | T4         | 16 GB  | 65       | $0.50    | Inference |
  | A10G       | 24 GB  | 125      | $1.00    | Fine-tune |
  | L4         | 24 GB  | 121      | $0.80    | Inference |
  | V100       | 16 GB  | 125      | $2.50    | Training  |
  | A100 40GB  | 40 GB  | 312      | $4.00    | Training  |
  | A100 80GB  | 80 GB  | 312      | $6.00    | LLM train |
  | H100 80GB  | 80 GB  | 990      | $10.00   | LLM train |
  +------------+--------+----------+----------+-----------+

  Rule of thumb for model fitting:
  +-------------------+---------------------------+
  | Model Size        | Minimum GPU (inference)   |
  +-------------------+---------------------------+
  | < 1B params       | T4 (16 GB)                |
  | 1-3B params       | A10G (24 GB) in FP16      |
  | 7B params         | A100 40GB FP16 or T4 INT4 |
  | 13B params        | A100 80GB FP16             |
  | 70B params        | 2x A100 80GB FP16          |
  +-------------------+---------------------------+
```

---

## Spot Instances -- 60-90% Savings

```
  On-demand:  $4.00/hr for A100  (guaranteed availability)
  Spot:       $1.20/hr for A100  (can be interrupted!)

  +--------------------------------------------------+
  |  Spot Instance Timeline:                          |
  |                                                    |
  |  Start ---> Training -----> INTERRUPTED!           |
  |  $1.20/hr   (save checkpoints every 30 min)       |
  |                                                    |
  |  Auto-restart on new spot instance:               |
  |  Resume ---> Training ---> Training ---> Done!     |
  |  (from last checkpoint)                            |
  +--------------------------------------------------+

  When to use spot:
  +---------------------+----------------------------------+
  | Use Spot            | Avoid Spot                       |
  +---------------------+----------------------------------+
  | Training jobs       | Real-time inference endpoints    |
  | Batch inference     | Latency-critical services        |
  | Hyperparameter      | Jobs that can't checkpoint       |
  | search              |                                  |
  | Data preprocessing  | Short jobs (< 1 hour)            |
  +---------------------+----------------------------------+
```

```python
import boto3
import json


def launch_spot_training(
    image_uri,
    instance_type,
    max_spot_price,
    checkpoint_s3_uri,
):
    sagemaker_client = boto3.client("sagemaker")

    response = sagemaker_client.create_training_job(
        TrainingJobName="my-spot-training-job",
        AlgorithmSpecification={
            "TrainingImage": image_uri,
            "TrainingInputMode": "File",
        },
        ResourceConfig={
            "InstanceType": instance_type,
            "InstanceCount": 1,
            "VolumeSizeInGB": 100,
        },
        EnableManagedSpotTraining=True,
        StoppingCondition={
            "MaxRuntimeInSeconds": 86400,
            "MaxWaitTimeInSeconds": 172800,
        },
        CheckpointConfig={
            "S3Uri": checkpoint_s3_uri,
        },
        InputDataConfig=[{
            "ChannelName": "train",
            "DataSource": {
                "S3DataSource": {
                    "S3Uri": "s3://bucket/train/",
                    "S3DataType": "S3Prefix",
                }
            },
        }],
        OutputDataConfig={
            "S3OutputPath": "s3://bucket/output/",
        },
        RoleArn="arn:aws:iam::role/SageMakerRole",
    )

    return response
```

---

## Checkpoint Strategy for Spot

```python
import torch
import os
from pathlib import Path


class SpotCheckpointer:
    def __init__(self, checkpoint_dir, save_every_n_steps=500):
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.save_every_n_steps = save_every_n_steps

    def save(self, model, optimizer, scheduler, step, epoch, loss):
        checkpoint = {
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "scheduler_state_dict": scheduler.state_dict(),
            "step": step,
            "epoch": epoch,
            "loss": loss,
        }

        path = self.checkpoint_dir / f"checkpoint_step_{step}.pt"
        torch.save(checkpoint, path)

        latest_path = self.checkpoint_dir / "checkpoint_latest.pt"
        torch.save(checkpoint, latest_path)

        self._cleanup_old_checkpoints(keep=3)

    def load_latest(self, model, optimizer, scheduler):
        latest_path = self.checkpoint_dir / "checkpoint_latest.pt"
        if not latest_path.exists():
            return 0, 0, float("inf")

        checkpoint = torch.load(latest_path)
        model.load_state_dict(checkpoint["model_state_dict"])
        optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        scheduler.load_state_dict(checkpoint["scheduler_state_dict"])

        return checkpoint["step"], checkpoint["epoch"], checkpoint["loss"]

    def _cleanup_old_checkpoints(self, keep=3):
        checkpoints = sorted(
            self.checkpoint_dir.glob("checkpoint_step_*.pt"),
            key=lambda p: p.stat().st_mtime,
        )
        for old_ckpt in checkpoints[:-keep]:
            old_ckpt.unlink()

    def should_save(self, step):
        return step % self.save_every_n_steps == 0
```

---

## Auto-Scaling for Inference

```
  Load pattern:
  Requests
  ^
  |        ****
  |       *    *
  |      *      ***
  |  ***          **
  | *               ***
  +----------------------> Time
  9am              9pm

  Without auto-scaling:
  Provision for peak --> waste money at low load

  With auto-scaling:
  +--------------------------------------------------+
  | Scale-up trigger:  CPU > 70% for 3 minutes       |
  | Scale-down trigger: CPU < 30% for 10 minutes     |
  | Min replicas: 1                                   |
  | Max replicas: 8                                   |
  | Cooldown: 5 minutes between scaling events        |
  +--------------------------------------------------+
```

```python
import boto3

asg_client = boto3.client("application-autoscaling")

asg_client.register_scalable_target(
    ServiceNamespace="sagemaker",
    ResourceId="endpoint/my-model-endpoint/variant/AllTraffic",
    ScalableDimension="sagemaker:variant:DesiredInstanceCount",
    MinCapacity=1,
    MaxCapacity=8,
)

asg_client.put_scaling_policy(
    PolicyName="my-scaling-policy",
    ServiceNamespace="sagemaker",
    ResourceId="endpoint/my-model-endpoint/variant/AllTraffic",
    ScalableDimension="sagemaker:variant:DesiredInstanceCount",
    PolicyType="TargetTrackingScaling",
    TargetTrackingScalingPolicyConfiguration={
        "TargetValue": 70.0,
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "SageMakerVariantInvocationsPerInstance",
        },
        "ScaleInCooldown": 600,
        "ScaleOutCooldown": 300,
    },
)
```

---

## Cost Optimization Strategies

```
  +---+-----------------------------------------------+---------+
  | # | Strategy                                       | Savings |
  +---+-----------------------------------------------+---------+
  | 1 | Use spot instances for training                | 60-90%  |
  | 2 | Right-size GPU (don't use A100 for BERT)      | 50-70%  |
  | 3 | Mixed precision training (2x throughput)       | ~50%    |
  | 4 | Scale to zero when not in use                 | variable|
  | 5 | Reserved instances for steady workloads        | 30-40%  |
  | 6 | Quantize models for cheaper inference GPUs     | 50-75%  |
  | 7 | Batch inference instead of real-time           | 60-80%  |
  | 8 | Use CPU for small models (< 100M params)      | 80-90%  |
  | 9 | Multi-model endpoints (share GPU)              | 50-70%  |
  |10 | Distill to smaller model                       | 80-95%  |
  +---+-----------------------------------------------+---------+
```

---

## Cost Tracking and Budgets

```python
from dataclasses import dataclass
from datetime import datetime


@dataclass
class GPUJob:
    job_id: str
    gpu_type: str
    num_gpus: int
    start_time: datetime
    end_time: datetime | None
    cost_per_gpu_hour: float
    is_spot: bool
    team: str
    project: str

    def cost(self) -> float:
        if self.end_time is None:
            return 0.0
        hours = (self.end_time - self.start_time).total_seconds() / 3600
        return hours * self.num_gpus * self.cost_per_gpu_hour

    def utilization_report(self) -> dict:
        return {
            "job_id": self.job_id,
            "gpu_type": self.gpu_type,
            "num_gpus": self.num_gpus,
            "duration_hours": (
                (self.end_time - self.start_time).total_seconds() / 3600
                if self.end_time else 0
            ),
            "total_cost": self.cost(),
            "team": self.team,
            "project": self.project,
            "spot": self.is_spot,
        }


class CostTracker:
    def __init__(self, monthly_budget: float):
        self.monthly_budget = monthly_budget
        self.jobs: list[GPUJob] = []

    def add_job(self, job: GPUJob):
        self.jobs.append(job)

    def monthly_spend(self, year: int, month: int) -> float:
        return sum(
            job.cost()
            for job in self.jobs
            if job.start_time.year == year and job.start_time.month == month
        )

    def spend_by_team(self, year: int, month: int) -> dict[str, float]:
        teams: dict[str, float] = {}
        for job in self.jobs:
            if job.start_time.year == year and job.start_time.month == month:
                teams[job.team] = teams.get(job.team, 0) + job.cost()
        return teams

    def budget_remaining(self, year: int, month: int) -> float:
        return self.monthly_budget - self.monthly_spend(year, month)

    def alert_if_over_budget(self, year: int, month: int, threshold_pct=80):
        spend = self.monthly_spend(year, month)
        pct_used = (spend / self.monthly_budget) * 100
        if pct_used >= threshold_pct:
            return {
                "alert": True,
                "spend": spend,
                "budget": self.monthly_budget,
                "pct_used": pct_used,
            }
        return {"alert": False, "pct_used": pct_used}
```

---

## Cluster Architecture

```
  Typical GPU cluster for ML:

  +-------------------------------------------------------+
  |  Cluster                                               |
  |                                                        |
  |  +-------------------+  +-------------------+          |
  |  | Training Pool     |  | Inference Pool    |          |
  |  | (spot + on-demand)|  | (on-demand only)  |          |
  |  |                   |  |                   |          |
  |  | 8x A100 nodes     |  | 4x T4 nodes      |          |
  |  | (NVLink within)   |  | (auto-scaling)    |          |
  |  | InfiniBand across |  |                   |          |
  |  +-------------------+  +-------------------+          |
  |                                                        |
  |  +-------------------+  +-------------------+          |
  |  | Preprocessing     |  | Shared Storage    |          |
  |  | Pool (CPU)        |  | (S3 / GCS / EFS)  |          |
  |  |                   |  |                   |          |
  |  | Spot instances    |  | Model artifacts   |          |
  |  | c5.4xlarge        |  | Datasets          |          |
  |  +-------------------+  | Checkpoints       |          |
  |                         +-------------------+          |
  +-------------------------------------------------------+

  Job scheduler (Kubernetes / SLURM):
  - Queue training jobs
  - Assign GPUs based on priority
  - Preempt low-priority jobs for high-priority
  - Track utilization metrics
```

---

## Exercises

1. **Spot training**: Write a training script with checkpointing
   that can resume from interruption. Simulate interruption by
   killing the process mid-training and restarting.

2. **Cost calculator**: Build a function that takes model size,
   dataset size, and target training time as input and recommends
   the cheapest GPU configuration (instance type, count, spot
   vs on-demand).

3. **Auto-scaling simulation**: Create a mock endpoint that
   receives variable load. Implement auto-scaling logic that
   adds/removes replicas based on request queue depth.

4. **Budget tracker**: Implement the CostTracker class and generate
   a monthly report showing spend by team, project, and GPU type.
   Add alerts when spending exceeds 80% of budget.

5. **GPU utilization**: Write a monitoring script that checks GPU
   utilization (nvidia-smi) every 30 seconds. Alert if a GPU
   is allocated but utilization is below 10% for more than
   15 minutes (wasted money).

---

**Next**: [Lesson 17 - LLM Deployment](./17-llm-deployment.md)
