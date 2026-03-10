# Lesson 05: GPU Management

## Driving a Race Car

```
  CPU                              GPU
  +---------------------------+    +---------------------------+
  | Few powerful cores        |    | Thousands of small cores  |
  | Great at complex tasks    |    | Great at parallel tasks   |
  | The brain surgeon         |    | The army of workers       |
  |                           |    |                           |
  | [*] [*] [*] [*]          |    | [.][.][.][.][.][.][.][.] |
  |  4-64 cores               |    | [.][.][.][.][.][.][.][.] |
  |                           |    | [.][.][.][.][.][.][.][.] |
  |                           |    |  hundreds to thousands    |
  +---------------------------+    +---------------------------+
```

Think of a GPU like a **race car**. Incredibly fast, but you need
to know how to drive it, fuel it properly, manage the engine
temperature, and not crash it by running out of gas (memory).

---

## CUDA Basics

CUDA is NVIDIA's programming model for GPUs. In Python/PyTorch,
you rarely write CUDA directly, but understanding it matters.

```
  CPU (Host)                    GPU (Device)
  +----------------+            +----------------+
  | Python code    |            | CUDA kernels   |
  | Data prep      | --copy-->  | Matrix multiply|
  | Control flow   | <--copy--  | Convolutions   |
  +----------------+            +----------------+
      RAM (64GB+)                  VRAM (16-80GB)

  The bottleneck is often the copy between Host and Device.
  Like a factory where the loading dock is the slowest part.
```

### Device Management in PyTorch

```python
import torch


def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def print_gpu_info():
    if not torch.cuda.is_available():
        print("No CUDA GPU available")
        return

    for i in range(torch.cuda.device_count()):
        props = torch.cuda.get_device_properties(i)
        total_mem = props.total_mem / (1024 ** 3)
        print(f"GPU {i}: {props.name}, {total_mem:.1f} GB")


device = get_device()
model = model.to(device)
input_tensor = input_tensor.to(device)
```

---

## GPU Memory: The Most Precious Resource

```
  GPU Memory Layout During Training
  +--------------------------------------------------+
  | Model Weights        | 30-40%                     |
  +----------------------+                            |
  | Gradients            | 30-40%                     |
  +----------------------+                            |
  | Optimizer States     | 15-25%                     |
  +----------------------+                            |
  | Activations (cache)  | 5-15%                      |
  +----------------------+----------------------------+
  | Fragmentation / Overhead                          |
  +--------------------------------------------------+

  GPU Memory Layout During Inference
  +--------------------------------------------------+
  | Model Weights        | 60-80%                     |
  +----------------------+                            |
  | KV Cache (LLMs)      | 10-30%                     |
  +----------------------+                            |
  | Input/Output Buffers | 5-10%                      |
  +--------------------------------------------------+
```

### Monitoring Memory

```python
def log_gpu_memory(tag: str = ""):
    if not torch.cuda.is_available():
        return

    allocated = torch.cuda.memory_allocated() / (1024 ** 3)
    reserved = torch.cuda.memory_reserved() / (1024 ** 3)
    max_allocated = torch.cuda.max_memory_allocated() / (1024 ** 3)

    print(f"[{tag}] Allocated: {allocated:.2f} GB")
    print(f"[{tag}] Reserved:  {reserved:.2f} GB")
    print(f"[{tag}] Peak:      {max_allocated:.2f} GB")


def estimate_model_size(model: torch.nn.Module) -> float:
    param_bytes = sum(p.numel() * p.element_size() for p in model.parameters())
    buffer_bytes = sum(b.numel() * b.element_size() for b in model.buffers())
    total_gb = (param_bytes + buffer_bytes) / (1024 ** 3)
    return total_gb
```

---

## Handling OOM: When You Run Out of Gas

```
  CUDA Out of Memory
  +-------------------------------------------+
  |                                           |
  |  RuntimeError: CUDA out of memory.        |
  |  Tried to allocate 2.00 GiB               |
  |                                           |
  |  This is the #1 GPU error you'll see.     |
  |  Like running out of gas on the highway.  |
  |                                           |
  +-------------------------------------------+
```

### Strategies to Reduce Memory

```python
@torch.inference_mode()
def efficient_inference(model, inputs):
    return model(inputs)


model = model.half()


def clear_gpu_cache():
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
```

### Gradient Checkpointing (Training)

```
  Normal:       Save all activations      (fast, lots of memory)
  Checkpointed: Save some, recompute rest (slower, less memory)

  Memory: [============================] Normal
  Memory: [============]                  Checkpointed (~60% less)
  Speed:  [====] Normal
  Speed:  [======] Checkpointed (~20% slower)
```

```python
from torch.utils.checkpoint import checkpoint


class MemoryEfficientModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.layer1 = torch.nn.Linear(768, 768)
        self.layer2 = torch.nn.Linear(768, 768)
        self.layer3 = torch.nn.Linear(768, 10)

    def forward(self, x):
        x = checkpoint(self.layer1, x, use_reentrant=False)
        x = checkpoint(self.layer2, x, use_reentrant=False)
        return self.layer3(x)
```

---

## Multi-GPU Serving

```
  Single GPU                    Multi-GPU
  +----------+                  +----------+----------+
  | Full     |                  | Half of  | Half of  |
  | Model    |                  | Model    | Model    |
  | 14GB     |                  | 7GB      | 7GB      |
  | (GPU 0)  |                  | (GPU 0)  | (GPU 1)  |
  +----------+                  +----------+----------+

  Data Parallel                 Tensor Parallel
  +----------+----------+       +----------+----------+
  | Full     | Full     |       | Layer    | Layer    |
  | Model    | Model    |       | split    | split    |
  | Batch 1  | Batch 2  |       | across   | across   |
  | (GPU 0)  | (GPU 1)  |       | (GPU 0)  | (GPU 1)  |
  +----------+----------+       +----------+----------+
```

### Data Parallel with PyTorch

```python
import torch.nn as nn

model = MyModel()

if torch.cuda.device_count() > 1:
    model = nn.DataParallel(model)

model = model.to("cuda")
```

### Model Parallel (Pipeline)

```python
class PipelineModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = torch.nn.Linear(768, 768).to("cuda:0")
        self.decoder = torch.nn.Linear(768, 10).to("cuda:1")

    def forward(self, x):
        x = x.to("cuda:0")
        x = self.encoder(x)
        x = x.to("cuda:1")
        return self.decoder(x)
```

### Using Accelerate for Multi-GPU

```python
from accelerate import init_empty_weights, load_checkpoint_and_dispatch

with init_empty_weights():
    model = MyLargeModel()

model = load_checkpoint_and_dispatch(
    model,
    checkpoint="model_weights/",
    device_map="auto",
    no_split_module_classes=["TransformerBlock"],
)
```

---

## GPU Scheduling for Serving

```
  Multiple Models, Limited GPUs

  Strategy 1: Dedicated GPUs
  GPU 0: [Model A          ]
  GPU 1: [Model B          ]
  GPU 2: [Model C          ]
  Simple but wasteful if models are small.

  Strategy 2: GPU Sharing (MPS/MIG)
  GPU 0: [Model A | Model B]
  GPU 1: [Model C | Model D]
  Better utilization, more complex.

  Strategy 3: Time-Sliced
  GPU 0: [A][B][A][B][A][B]
  Models take turns. Adds latency jitter.
```

### NVIDIA MIG (Multi-Instance GPU)

```
  A100 GPU (80GB)
  +--------------------------------------------------+
  | MIG Instance 1 | MIG Instance 2 | MIG Instance 3 |
  | (26GB, Model A)| (26GB, Model B)| (26GB, Model C)|
  +--------------------------------------------------+
  Each instance is isolated -- like separate GPUs.
```

```bash
# Enable MIG mode
sudo nvidia-smi -i 0 -mig 1

# Create instances (A100)
sudo nvidia-smi mig -i 0 -cgi 9,9,9 -C

# List instances
nvidia-smi mig -i 0 -lgi
```

---

## Monitoring GPUs in Production

```python
import subprocess
import json


def get_gpu_metrics() -> list[dict]:
    result = subprocess.run(
        [
            "nvidia-smi",
            "--query-gpu=index,name,temperature.gpu,utilization.gpu,"
            "utilization.memory,memory.used,memory.total,power.draw",
            "--format=csv,noheader,nounits",
        ],
        capture_output=True,
        text=True,
        check=True,
    )

    metrics = []
    for line in result.stdout.strip().split("\n"):
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 8:
            continue
        metrics.append({
            "gpu_index": int(parts[0]),
            "name": parts[1],
            "temperature_c": int(parts[2]),
            "gpu_util_pct": int(parts[3]),
            "mem_util_pct": int(parts[4]),
            "mem_used_mb": int(parts[5]),
            "mem_total_mb": int(parts[6]),
            "power_draw_w": float(parts[7]),
        })
    return metrics


def check_gpu_health(metrics: list[dict]) -> list[str]:
    alerts = []
    for gpu in metrics:
        if gpu["temperature_c"] > 85:
            alerts.append(f"GPU {gpu['gpu_index']}: Temperature {gpu['temperature_c']}C (critical)")
        if gpu["mem_util_pct"] > 95:
            alerts.append(f"GPU {gpu['gpu_index']}: Memory {gpu['mem_util_pct']}% (near OOM)")
        if gpu["gpu_util_pct"] < 10:
            alerts.append(f"GPU {gpu['gpu_index']}: Utilization {gpu['gpu_util_pct']}% (underutilized)")
    return alerts
```

---

## Memory-Efficient Inference Patterns

```python
import gc


class GPUModelManager:
    def __init__(self, device: str = "cuda"):
        self.device = torch.device(device)
        self.loaded_model: torch.nn.Module | None = None
        self.model_name: str | None = None

    def load(self, model: torch.nn.Module, name: str):
        if self.loaded_model is not None:
            self.unload()

        self.loaded_model = model.to(self.device)
        self.loaded_model.eval()
        self.model_name = name

    def unload(self):
        if self.loaded_model is None:
            return

        self.loaded_model.cpu()
        del self.loaded_model
        self.loaded_model = None
        self.model_name = None

        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    @torch.inference_mode()
    def predict(self, inputs: torch.Tensor) -> torch.Tensor:
        if self.loaded_model is None:
            raise RuntimeError("No model loaded")
        inputs = inputs.to(self.device)
        return self.loaded_model(inputs)
```

---

## Common GPU Card Specs

```
  Card         | VRAM  | Use Case
  -------------|-------|---------------------------
  T4           | 16 GB | Inference, small training
  A10G         | 24 GB | Inference, medium models
  L4           | 24 GB | Inference (newer, faster)
  A100 40GB    | 40 GB | Training + inference
  A100 80GB    | 80 GB | Large model training
  H100         | 80 GB | LLM training & inference

  Model Size Quick Math:
  1B params  x fp16 = ~2 GB VRAM
  7B params  x fp16 = ~14 GB VRAM
  13B params x fp16 = ~26 GB VRAM
  70B params x fp16 = ~140 GB VRAM (needs multi-GPU)
```

---

## Exercises

1. **Memory Profiler**: Write a script that loads a model,
   logs memory before/after loading, runs inference, and
   logs peak memory. Compare fp32 vs fp16.

2. **OOM Recovery**: Intentionally trigger an OOM error by
   feeding an oversized batch. Write a handler that catches
   it, clears the cache, retries with a smaller batch.

3. **Multi-GPU Benchmark**: If you have 2+ GPUs, compare
   DataParallel vs single-GPU throughput. At what batch
   size does multi-GPU become worthwhile?

4. **GPU Monitor Dashboard**: Build a simple script that
   polls `nvidia-smi` every 5 seconds and logs metrics
   to a CSV. Plot utilization over a training run.

---

[Next: Lesson 06 - Experiment Tracking -->](06-experiment-tracking.md)
