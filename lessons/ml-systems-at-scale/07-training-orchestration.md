# Lesson 07: Training Orchestration

> **Analogy**: Orchestrating a large training run is like managing
> a construction site with 64 cranes. If one crane breaks, you
> don't tear down the building -- you fix the crane and resume.
> If it rains, you cover the exposed concrete and wait. The foreman
> (orchestrator) handles scheduling, failures, and resource
> management so the engineers (GPUs) can focus on building.

---

## Why Orchestration Matters

A single-GPU training script runs on one machine. You SSH in,
start it, and check back later. Multi-node training at scale
introduces entirely new categories of problems:

```
+-----------------------------+-------------------------------+
| Problem                     | Scale Impact                  |
+-----------------------------+-------------------------------+
| Hardware failure             | With 64 GPUs, MTBF is 64x    |
|                             | shorter than single GPU       |
+-----------------------------+-------------------------------+
| Network partition            | Stalls all GPUs until resolved|
+-----------------------------+-------------------------------+
| Job preemption (cloud)      | Lose partial training progress|
+-----------------------------+-------------------------------+
| Resource contention          | Other jobs compete for GPUs   |
+-----------------------------+-------------------------------+
| Dependency management        | CUDA, NCCL, driver versions  |
|                             | must match across all nodes   |
+-----------------------------+-------------------------------+
| Reproducibility             | Same config on different      |
|                             | hardware = different results  |
+-----------------------------+-------------------------------+
```

---

## Slurm: The HPC Standard

Slurm (Simple Linux Utility for Resource Management) is the
default scheduler for GPU clusters at universities, national
labs, and many companies.

### Basic Multi-Node Slurm Job

```bash
#!/bin/bash
#SBATCH --job-name=train-7b
#SBATCH --partition=gpu
#SBATCH --nodes=4
#SBATCH --ntasks-per-node=1
#SBATCH --gpus-per-node=8
#SBATCH --cpus-per-task=96
#SBATCH --mem=0
#SBATCH --time=72:00:00
#SBATCH --exclusive
#SBATCH --output=logs/%j_%t.out
#SBATCH --error=logs/%j_%t.err

export MASTER_ADDR=$(scontrol show hostname $SLURM_NODELIST | head -n1)
export MASTER_PORT=29500
export WORLD_SIZE=$((SLURM_NNODES * 8))

module load cuda/12.1
module load nccl/2.18

srun --kill-on-bad-exit=1 \
  torchrun \
    --nnodes=$SLURM_NNODES \
    --nproc_per_node=8 \
    --rdzv_id=$SLURM_JOB_ID \
    --rdzv_backend=c10d \
    --rdzv_endpoint=$MASTER_ADDR:$MASTER_PORT \
    train.py \
    --config configs/7b.yaml
```

Key flags:
- `--exclusive`: no other jobs on your nodes (prevents interference)
- `--mem=0`: use all available memory
- `--kill-on-bad-exit=1`: if one task dies, kill all (clean failure)

### Slurm Job Arrays for Hyperparameter Search

```bash
#!/bin/bash
#SBATCH --job-name=hpsearch
#SBATCH --array=0-15
#SBATCH --nodes=1
#SBATCH --gpus-per-node=8
#SBATCH --time=24:00:00

LR_VALUES=(1e-5 2e-5 5e-5 1e-4 2e-4 5e-4 1e-3 2e-3)
BS_VALUES=(32 64)

LR_IDX=$((SLURM_ARRAY_TASK_ID / 2))
BS_IDX=$((SLURM_ARRAY_TASK_ID % 2))

LR=${LR_VALUES[$LR_IDX]}
BS=${BS_VALUES[$BS_IDX]}

torchrun --nproc_per_node=8 train.py \
  --lr $LR \
  --batch-size $BS \
  --wandb-name "lr${LR}_bs${BS}"
```

### Slurm Pro Tips

```
Tip 1: Node health checks before training
  Add to your sbatch script:
    nvidia-smi --query-gpu=gpu_name,memory.total,ecc.errors.corrected.aggregate.total \
      --format=csv
    Check for ECC errors -- a GPU with many corrected errors may
    fail mid-training.

Tip 2: NCCL debugging environment variables
  export NCCL_DEBUG=INFO         # Print NCCL initialization
  export NCCL_DEBUG_SUBSYS=ALL   # All subsystems
  export NCCL_SOCKET_IFNAME=ib0  # Force InfiniBand interface
  export NCCL_IB_DISABLE=0       # Ensure IB is enabled

Tip 3: Exclusive node allocation
  Always use --exclusive for multi-node training.
  Other jobs on the same node can cause:
  - Memory pressure (OOM kills)
  - PCIe bandwidth contention
  - CPU scheduling interference
```

---

## Kubernetes for ML Training

Kubernetes is the standard for cloud-native ML training.
The key abstractions for ML are:

```
+-------------------+---------------------------------------+
| K8s Concept       | ML Training Use                       |
+-------------------+---------------------------------------+
| Pod               | One worker process (usually 1 node)   |
| Job               | A training run (fixed # of workers)   |
| StatefulSet       | Workers with stable network identity  |
| PersistentVolume  | Shared storage for checkpoints/data   |
| DaemonSet         | GPU monitoring agents                 |
| Service           | Rendezvous endpoint for torchrun      |
+-------------------+---------------------------------------+
```

### PyTorchJob with Kubeflow

```yaml
apiVersion: kubeflow.org/v1
kind: PyTorchJob
metadata:
  name: train-7b
  namespace: ml-training
spec:
  elasticPolicy:
    rdzvBackend: c10d
    minReplicas: 4
    maxReplicas: 8
    metrics:
      - type: Resource
        resource:
          name: gpu-utilization
          target:
            type: Utilization
            averageUtilization: 80
  pytorchReplicaSpecs:
    Worker:
      replicas: 4
      restartPolicy: OnFailure
      template:
        spec:
          containers:
            - name: trainer
              image: training:latest
              command:
                - torchrun
                - --nnodes=4
                - --nproc_per_node=8
                - --rdzv_backend=c10d
                - --rdzv_endpoint=train-7b-worker-0:29500
                - train.py
                - --config=configs/7b.yaml
              resources:
                limits:
                  nvidia.com/gpu: 8
                  memory: 900Gi
                  cpu: "96"
              volumeMounts:
                - name: data
                  mountPath: /data
                - name: checkpoints
                  mountPath: /checkpoints
          volumes:
            - name: data
              persistentVolumeClaim:
                claimName: training-data
            - name: checkpoints
              persistentVolumeClaim:
                claimName: training-checkpoints
          tolerations:
            - key: nvidia.com/gpu
              operator: Exists
              effect: NoSchedule
```

---

## Fault Tolerance

At scale, failures are not exceptional events -- they're routine.

```
Failure rates (approximate, per-GPU per-month):

  GPU hardware failure:     0.1 - 0.5%
  Network transient:        1 - 5%
  NVLink error:             0.05 - 0.2%
  ECC uncorrectable:        0.01 - 0.1%
  Node reboot (kernel):     0.5 - 2%
  Preemption (cloud):       10 - 50% (spot instances)

  For a 256-GPU cluster running for 30 days:
  Expected GPU failures:    0.5 - 3
  Expected network issues:  5 - 30
  Expected node reboots:    3 - 12

  Without fault tolerance: you WILL lose training runs.
```

### Auto-Restart Pattern

```bash
#!/bin/bash

MAX_RESTARTS=5
RESTART_COUNT=0
CHECKPOINT_DIR="/checkpoints/run-$(date +%Y%m%d)"

while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
    echo "Starting training attempt $((RESTART_COUNT + 1))..."

    LATEST_CKPT=$(ls -t $CHECKPOINT_DIR/checkpoint-*.pt 2>/dev/null | head -1)

    RESUME_FLAG=""
    if [ -n "$LATEST_CKPT" ]; then
        echo "Resuming from $LATEST_CKPT"
        RESUME_FLAG="--resume-from $LATEST_CKPT"
    fi

    srun torchrun \
        --nnodes=$SLURM_NNODES \
        --nproc_per_node=8 \
        --rdzv_id=$SLURM_JOB_ID \
        --rdzv_backend=c10d \
        --rdzv_endpoint=$MASTER_ADDR:$MASTER_PORT \
        train.py \
        --checkpoint-dir $CHECKPOINT_DIR \
        $RESUME_FLAG

    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        echo "Training completed successfully."
        exit 0
    fi

    RESTART_COUNT=$((RESTART_COUNT + 1))
    echo "Training failed with exit code $EXIT_CODE. Restart $RESTART_COUNT/$MAX_RESTARTS"

    sleep 30
done

echo "Training failed after $MAX_RESTARTS attempts."
exit 1
```

### NCCL Timeout Handling

The most common failure mode is NCCL timeout -- one node stops
responding and all others hang waiting for a collective operation.

```python
import os
import signal

os.environ['NCCL_TIMEOUT'] = '1800'
os.environ['TORCH_NCCL_BLOCKING_WAIT'] = '0'
os.environ['TORCH_NCCL_ASYNC_ERROR_HANDLING'] = '1'

dist.init_process_group(
    backend="nccl",
    timeout=timedelta(minutes=30),
)

def handle_timeout(signum, frame):
    print(f"Rank {dist.get_rank()}: Timeout detected, saving emergency checkpoint")
    save_emergency_checkpoint()
    dist.destroy_process_group()
    sys.exit(1)

signal.signal(signal.SIGALRM, handle_timeout)
```

---

## Elastic Training

Elastic training allows the number of workers to change during
training. Workers can be added or removed without restarting.

### PyTorch Elastic (torchrun)

```bash
torchrun \
  --nnodes=4:8 \
  --nproc_per_node=8 \
  --max_restarts=3 \
  --rdzv_id=my_training \
  --rdzv_backend=c10d \
  --rdzv_endpoint=master:29500 \
  train.py
```

`--nnodes=4:8` means: run with minimum 4 nodes, maximum 8.
If nodes fail, training continues as long as 4+ remain.

```python
import torch.distributed as dist

def train_elastic():
    dist.init_process_group("nccl")

    while not training_complete:
        current_world_size = dist.get_world_size()
        adjust_batch_size(current_world_size)
        adjust_learning_rate(current_world_size)

        try:
            for batch in loader:
                loss = model(batch)
                loss.backward()
                optimizer.step()
        except RuntimeError as e:
            if "NCCL" in str(e):
                print("Worker failure detected, re-rendezvousing...")
                dist.destroy_process_group()
                dist.init_process_group("nccl")
                reload_checkpoint()
                continue
            raise
```

### Batch Size Adjustment

When the world size changes, the effective batch size changes.
You need to adjust to maintain training dynamics:

```
Original: 8 nodes, batch_per_gpu=4, accum=8
  Effective batch = 8 * 8 * 4 * 8 = 2048

Node failure, now 6 nodes:
  Option A: Keep batch_per_gpu and accum, accept smaller effective batch
    Effective batch = 6 * 8 * 4 * 8 = 1536  (different training dynamics)

  Option B: Adjust accum to maintain effective batch
    accum = 2048 / (6 * 8 * 4) = 10.67 -> round to 11
    Effective batch ≈ 2112  (close enough)
    LR stays the same

  Option B is almost always better.
```

---

## Cost Management

GPU compute is expensive. Managing costs is an engineering skill.

```
Cloud GPU Costs (approximate, 2024):

+----------------+------------------+------------------+---------+
| GPU            | On-Demand $/hr   | Spot $/hr        | Savings |
+----------------+------------------+------------------+---------+
| A100 80GB      | $3.00 - $4.50    | $1.00 - $1.80    | 55-65%  |
| H100 80GB      | $4.50 - $8.00    | $2.00 - $3.50    | 50-60%  |
| 8x H100 node   | $36 - $65        | $16 - $28        | 55-60%  |
+----------------+------------------+------------------+---------+
```

### Spot Instance Strategy

```
Spot instances are 50-65% cheaper but can be preempted.

Risk mitigation:
1. Checkpoint every 500 steps (lose max ~50 min of compute)
2. Use 2-minute preemption warning to save emergency checkpoint
3. Spread across multiple availability zones
4. Mix spot and on-demand: run master on on-demand, workers on spot
```

```python
import signal

def spot_preemption_handler(signum, frame):
    print("Received preemption signal, saving checkpoint...")
    save_checkpoint(model, optimizer, step, "emergency")
    dist.barrier()
    sys.exit(0)

signal.signal(signal.SIGTERM, spot_preemption_handler)

try:
    import requests
    response = requests.get(
        "http://metadata.google.internal/computeMetadata/v1/instance/preempted",
        headers={"Metadata-Flavor": "Google"},
        timeout=1,
    )
except Exception:
    pass
```

### Cost Tracking

```python
class CostTracker:
    def __init__(self, gpu_cost_per_hour, num_gpus):
        self.cost_per_second = (gpu_cost_per_hour * num_gpus) / 3600
        self.start_time = time.time()
        self.total_tokens = 0

    def update(self, tokens_processed):
        self.total_tokens += tokens_processed

    def report(self):
        elapsed = time.time() - self.start_time
        total_cost = elapsed * self.cost_per_second
        cost_per_token = total_cost / max(self.total_tokens, 1)
        tokens_per_dollar = 1.0 / cost_per_token if cost_per_token > 0 else 0

        return {
            "elapsed_hours": elapsed / 3600,
            "total_cost_usd": total_cost,
            "cost_per_1M_tokens": cost_per_token * 1e6,
            "tokens_per_dollar": tokens_per_dollar,
            "total_tokens": self.total_tokens,
        }
```

---

## Container-Based Training

Docker containers ensure reproducibility across nodes:

```dockerfile
FROM nvcr.io/nvidia/pytorch:24.01-py3

RUN pip install --no-cache-dir \
    deepspeed==0.13.1 \
    flash-attn==2.5.0 \
    wandb==0.16.3 \
    transformers==4.38.0

COPY train.py /app/train.py
COPY configs/ /app/configs/

WORKDIR /app

ENV NCCL_DEBUG=WARN
ENV NCCL_SOCKET_IFNAME=eth0
ENV TORCH_NCCL_ASYNC_ERROR_HANDLING=1

ENTRYPOINT ["torchrun"]
```

```bash
docker build -t training:v1.2.3 .
docker push registry.example.com/training:v1.2.3
```

Pin **every** dependency version. A training run that starts on
Monday and fails on Wednesday shouldn't produce different results
when restarted because pip resolved a different package version.

---

## Multi-Cloud and Hybrid Orchestration

Some teams split training across providers for cost or capacity:

```
Architecture:

  +-------------------+     +-------------------+
  |  Cloud Provider A |     |  Cloud Provider B |
  |  32x H100 (spot)  |     |  32x H100 (spot)  |
  |  $16/hr           |     |  $14/hr           |
  +--------+----------+     +----------+--------+
           |                           |
           +------- VPN Tunnel --------+
           |     100 Gbps link         |
           |                           |
  +--------+---------------------------+--------+
  |            Orchestration Layer               |
  |  - Job scheduling                            |
  |  - Checkpoint management                     |
  |  - Failure detection                         |
  |  - Cost optimization                         |
  +-+--------------------------------------------+
    |
  +-+--------------------------------------------+
  |          Shared Storage                       |
  |  - S3-compatible (checkpoints)               |
  |  - High-speed NFS (data cache)               |
  +----------------------------------------------+

Challenges:
  - Cross-cloud latency (10-50ms vs <1ms intra-cloud)
  - Different network fabrics
  - Billing across providers
  - Data transfer costs

Strategy: use DP across clouds (tolerates latency),
  TP within cloud (needs NVLink), PP within cloud.
```

---

## Production Checklist

```
Before launching a multi-week training run:

Infrastructure:
  [ ] All nodes pass GPU health check (nvidia-smi, DCGM)
  [ ] InfiniBand/RoCE connectivity verified between all pairs
  [ ] NCCL all-reduce benchmark passes on full cluster
  [ ] Shared filesystem throughput tested
  [ ] Checkpoint save/load tested end-to-end

Training:
  [ ] Short validation run (100 steps) produces expected loss
  [ ] Checkpoint resume produces identical loss at resume step
  [ ] Gradient accumulation math verified (global batch size correct)
  [ ] Learning rate schedule visualized and approved
  [ ] Data pipeline sustains required throughput

Operations:
  [ ] Auto-restart script tested
  [ ] Monitoring dashboards set up
  [ ] Alerting configured (loss spikes, GPU failures, OOM)
  [ ] Cost tracking enabled
  [ ] On-call rotation established for the training run

Documentation:
  [ ] Training config committed to version control
  [ ] Container image tagged and pinned
  [ ] Expected training duration and cost estimated
```

---

## Exercises

1. **Slurm script**: Write a Slurm batch script for 8-node
   training with auto-restart on failure, health checks, and
   NCCL environment variables.

2. **Fault tolerance**: Implement a training loop that handles
   NCCL timeouts gracefully -- detecting the failure, saving
   a checkpoint, and restarting with one fewer node.

3. **Cost analysis**: For a 13B model trained on 1T tokens at
   1000 tokens/sec/GPU with 64 GPUs, calculate total training
   time and cost with (a) on-demand H100s and (b) spot H100s
   assuming 2 preemptions per day with 1 hour recovery each.

4. **Elastic scaling**: Design an elastic training system that
   scales from 4 to 8 nodes based on spot instance availability.
   How do you handle batch size, learning rate, and data loader
   state across scale changes?
