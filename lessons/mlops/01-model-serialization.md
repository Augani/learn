# Lesson 01: Model Serialization

## Saving Your Game Progress

```
  +-------------------+       +-------------------+
  | Your Model        |       | Serialized File   |
  | (lives in RAM)    | ----> | (lives on disk)   |
  |                   |       |                   |
  | Weights, config,  |       | .pt, .onnx,       |
  | architecture      |       | .safetensors      |
  +-------------------+       +-------------------+
```

Think of model serialization like **saving your game progress**.

When you're playing a video game, all your progress exists in the
console's memory. If you turn it off without saving, everything is
gone. Serialization is that save button -- it writes your model's
learned weights and configuration to a file so you can load it
later, on a different machine, or in a completely different runtime.

---

## Why Serialization Matters in Production

```
  Training Machine          Production Server
  (expensive GPU box)       (cheap inference box)

  +--------+                +--------+
  | Train  |   serialize    | Load   |
  | Model  | ------------> | Model  |
  |        |   (file)       |        |
  +--------+                +--------+
      $$$                      $
```

You train once (expensive), serve many times (cheap). The
serialized file is the bridge between these two worlds.

---

## Format 1: Pickle / PyTorch Native (.pt / .pth)

The simplest approach. PyTorch's default save mechanism.

```python
import torch
from transformers import AutoModel

model = AutoModel.from_pretrained("bert-base-uncased")

torch.save(model.state_dict(), "model_weights.pt")

loaded_model = AutoModel.from_pretrained("bert-base-uncased")
loaded_model.load_state_dict(torch.load("model_weights.pt"))
loaded_model.eval()
```

### The Pickle Problem

```
  +-------------------------------------------+
  |  WARNING: Pickle files can execute         |
  |  arbitrary code when loaded!               |
  |                                            |
  |  Loading a pickle file = running unknown   |
  |  code on your machine.                     |
  |                                            |
  |  Like opening an email attachment from a   |
  |  stranger -- it might be fine, or it might |
  |  install malware.                          |
  +-------------------------------------------+
```

**When to use:** Internal pipelines where you control both the
save and load environments. Never load untrusted pickle files.

---

## Format 2: ONNX (Open Neural Network Exchange)

ONNX is the **universal translator** for ML models.

```
  PyTorch Model ----+
                     |
  TensorFlow Model --+--> ONNX Format --> Any ONNX Runtime
                     |
  Scikit-learn -----+

  Like converting a Word doc to PDF --
  anyone can read it regardless of their software.
```

### Exporting to ONNX

```python
import torch
import onnx
import onnxruntime as ort
import numpy as np

class SentimentModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.linear1 = torch.nn.Linear(768, 256)
        self.relu = torch.nn.ReLU()
        self.linear2 = torch.nn.Linear(256, 2)

    def forward(self, x):
        x = self.linear1(x)
        x = self.relu(x)
        return self.linear2(x)

model = SentimentModel()
model.eval()

dummy_input = torch.randn(1, 768)

torch.onnx.export(
    model,
    dummy_input,
    "sentiment.onnx",
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={
        "input": {0: "batch_size"},
        "output": {0: "batch_size"},
    },
)

onnx_model = onnx.load("sentiment.onnx")
onnx.checker.check_model(onnx_model)
```

### Running ONNX Inference

```python
session = ort.InferenceSession("sentiment.onnx")

input_data = np.random.randn(1, 768).astype(np.float32)

outputs = session.run(None, {"input": input_data})
predictions = outputs[0]
```

### ONNX Performance Benefits

```
  PyTorch Eager Mode    vs    ONNX Runtime
  +------------------+       +------------------+
  | Python overhead  |       | Optimized C++    |
  | Dynamic graphs   |       | Graph fusion     |
  | Flexible         |       | Constant folding |
  | ~100 infer/sec   |       | ~300 infer/sec   |
  +------------------+       +------------------+
```

---

## Format 3: TorchScript

TorchScript compiles your PyTorch model into a portable format
that can run **without Python**.

```
  Python + PyTorch  --->  TorchScript  --->  C++ Runtime
                                              (no Python!)

  Like compiling source code into a standalone executable.
```

### Tracing vs Scripting

```
  Tracing                        Scripting
  +------------------------+     +------------------------+
  | Run model with sample  |     | Analyze Python code    |
  | input, record ops      |     | directly, convert to   |
  |                        |     | TorchScript IR         |
  | Good for: simple       |     |                        |
  | feed-forward models    |     | Good for: models with  |
  |                        |     | control flow (if/else) |
  | Misses: dynamic        |     |                        |
  | control flow           |     | Needs: type annotations|
  +------------------------+     +------------------------+
```

### Tracing Example

```python
import torch

class SimpleModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.linear = torch.nn.Linear(10, 5)

    def forward(self, x):
        return self.linear(x)

model = SimpleModel()
model.eval()

example_input = torch.randn(1, 10)
traced_model = torch.jit.trace(model, example_input)

traced_model.save("model_traced.pt")

loaded = torch.jit.load("model_traced.pt")
output = loaded(torch.randn(1, 10))
```

### Scripting Example

```python
class BranchingModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.linear_a = torch.nn.Linear(10, 5)
        self.linear_b = torch.nn.Linear(10, 5)

    def forward(self, x: torch.Tensor, use_branch_a: bool) -> torch.Tensor:
        if use_branch_a:
            return self.linear_a(x)
        return self.linear_b(x)

model = BranchingModel()
scripted_model = torch.jit.script(model)
scripted_model.save("model_scripted.pt")
```

---

## Format 4: SafeTensors

The **safe** alternative to pickle, created by Hugging Face.

```
  Pickle                    SafeTensors
  +---------------------+   +---------------------+
  | Can execute code    |   | Only stores tensors  |
  | Arbitrary objects   |   | No code execution    |
  | Security risk       |   | Memory-mapped        |
  | Slower loading      |   | Fast loading         |
  +---------------------+   +---------------------+

  Like the difference between running an .exe file
  vs opening a .csv file -- one can do anything,
  the other just has data.
```

### Using SafeTensors

```python
from safetensors.torch import save_file, load_file
import torch

tensors = {
    "weight": torch.randn(768, 256),
    "bias": torch.randn(256),
}

save_file(tensors, "model.safetensors")

loaded_tensors = load_file("model.safetensors")
```

### With Hugging Face Models

```python
from transformers import AutoModel

model = AutoModel.from_pretrained("bert-base-uncased")
model.save_pretrained("./saved_model", safe_serialization=True)

loaded = AutoModel.from_pretrained("./saved_model")
```

---

## Format Comparison

```
  Format        | Safety | Speed  | Portability | Python-Free
  --------------|--------|--------|-------------|------------
  Pickle (.pt)  | LOW    | Medium | PyTorch     | No
  ONNX          | HIGH   | Fast   | Universal   | Yes
  TorchScript   | MEDIUM | Fast   | PyTorch C++ | Yes
  SafeTensors   | HIGH   | V.Fast | HF Ecosystem| No
```

---

## Production Serialization Pattern

A real-world save function that captures everything you need:

```python
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone

import torch
from safetensors.torch import save_file


def save_model_artifact(
    model: torch.nn.Module,
    output_dir: str,
    model_name: str,
    metadata: dict,
) -> Path:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    state_dict = model.state_dict()
    weights_path = output_path / f"{model_name}.safetensors"
    save_file(state_dict, str(weights_path))

    file_hash = hashlib.sha256(weights_path.read_bytes()).hexdigest()

    manifest = {
        "model_name": model_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sha256": file_hash,
        "format": "safetensors",
        "metadata": metadata,
    }

    manifest_path = output_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    return output_path


def load_model_artifact(
    model: torch.nn.Module,
    artifact_dir: str,
    model_name: str,
) -> torch.nn.Module:
    artifact_path = Path(artifact_dir)

    manifest_path = artifact_path / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"No manifest found in {artifact_dir}")

    manifest = json.loads(manifest_path.read_text())

    weights_path = artifact_path / f"{model_name}.safetensors"
    file_hash = hashlib.sha256(weights_path.read_bytes()).hexdigest()

    if file_hash != manifest["sha256"]:
        raise ValueError("Weight file hash mismatch -- file may be corrupted")

    from safetensors.torch import load_file
    state_dict = load_file(str(weights_path))
    model.load_state_dict(state_dict)
    model.eval()

    return model
```

---

## Common Pitfalls

```
  Pitfall                        Fix
  +----------------------------+----------------------------+
  | Saving full model with     | Save state_dict only       |
  | pickle (couples to code)   |                            |
  +----------------------------+----------------------------+
  | Forgetting model.eval()    | Always call before saving  |
  | before export              | or inference               |
  +----------------------------+----------------------------+
  | Not validating after load  | Compare outputs on sample  |
  |                            | input before/after         |
  +----------------------------+----------------------------+
  | Missing version metadata   | Always save a manifest     |
  +----------------------------+----------------------------+
  | ONNX dynamic axes missing  | Specify batch_size axis    |
  +----------------------------+----------------------------+
```

---

## Exercises

1. **Save & Load Roundtrip**: Train a simple sklearn model,
   serialize it with pickle and ONNX. Compare file sizes and
   load times.

2. **SafeTensors Migration**: Take a model saved with
   `torch.save()` and convert it to SafeTensors format.
   Verify the outputs match on 100 random inputs.

3. **ONNX Export with Validation**: Export a pretrained
   HuggingFace model to ONNX. Run the ONNX checker.
   Compare inference speed between PyTorch and ONNX Runtime.

4. **Production Artifact**: Use the `save_model_artifact`
   pattern above to save a model with full metadata.
   Write a script that verifies integrity on load.

---

[Next: Lesson 02 - Serving with FastAPI -->](02-serving-with-fastapi.md)
