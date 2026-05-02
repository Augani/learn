# Lesson 15 — Edge Deployment

## From Lab to Real World

Your model works great on your workstation with a beefy GPU. Now ship it to
a phone with 4GB of RAM and no GPU. That's the edge deployment challenge —
making models small, fast, and efficient enough for real-world constraints.

Think of it as packing for a camping trip. At home you have everything. On
the trail you need the essentials only, and they need to be lightweight.

## The Deployment Pipeline

```
  Training                          Deployment
  (powerful machine)                (constrained device)

  +===========+                     +-----------+
  | PyTorch   |                     | Phone     |
  | Model     |                     | Raspberry |
  | (FP32)    |                     | Pi / Edge |
  +===========+                     | device    |
       |                            +-----------+
       v                                 ^
  +-----------+    +-----------+         |
  | Export to |    | Optimize  |    +-----------+
  | ONNX      |--->| Quantize  |--->| Runtime   |
  +-----------+    | Prune     |    | (ONNX RT  |
                   +-----------+    | TensorRT  |
                                    | CoreML    |
                                    | TFLite)   |
                                    +-----------+
```

## ONNX — The Universal Format

ONNX (Open Neural Network Exchange) is like PDF for models. Train in
PyTorch, run anywhere.

```python
import torch
import torch.nn as nn

class SimpleClassifier(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = nn.Linear(64, num_classes)

    def forward(self, x):
        x = self.features(x)
        x = x.flatten(1)
        return self.classifier(x)

model = SimpleClassifier()
model.eval()

dummy_input = torch.randn(1, 3, 224, 224)

torch.onnx.export(
    model,
    dummy_input,
    "model.onnx",
    input_names=["image"],
    output_names=["logits"],
    dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
    opset_version=17,
)
```

## Running ONNX Models

```python
import onnxruntime as ort
import numpy as np

session = ort.InferenceSession("model.onnx")

input_data = np.random.randn(1, 3, 224, 224).astype(np.float32)
outputs = session.run(None, {"image": input_data})

logits = outputs[0]
predicted_class = np.argmax(logits, axis=1)
print(f"Predicted: {predicted_class}")
```

## Quantization — Shrink Model Size

Quantization reduces the precision of weights and activations. Fewer bits
means smaller model and faster math.

```
  FP32 (full precision)     INT8 (quantized)
  32 bits per number         8 bits per number

  Weight: 0.12345678        Weight: 12 (scaled integer)
  Memory: 4 bytes           Memory: 1 byte

  Model size: ~100 MB  -->  Model size: ~25 MB
  Speed:      1x       -->  Speed:      2-4x faster
  Accuracy:   100%     -->  Accuracy:   ~99% (usually)
```

### Post-Training Quantization (PTQ)

Quantize after training. No retraining needed.

```python
import torch.quantization

model.eval()

model.qconfig = torch.quantization.get_default_qconfig("x86")
model_prepared = torch.quantization.prepare(model)

with torch.no_grad():
    for images, _ in calibration_loader:
        model_prepared(images)

model_quantized = torch.quantization.convert(model_prepared)

torch.save(model_quantized.state_dict(), "model_int8.pth")
```

### Quantization-Aware Training (QAT)

Simulate quantization during training. Better accuracy than PTQ.

```python
model.train()
model.qconfig = torch.quantization.get_default_qat_qconfig("x86")
model_qat = torch.quantization.prepare_qat(model)

for epoch in range(5):
    for images, labels in train_loader:
        outputs = model_qat(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()

model_qat.eval()
model_quantized = torch.quantization.convert(model_qat)
```

## TorchScript — PyTorch's Own Export

```python
model.eval()

scripted = torch.jit.script(model)
scripted.save("model_scripted.pt")

traced = torch.jit.trace(model, dummy_input)
traced.save("model_traced.pt")

loaded = torch.jit.load("model_scripted.pt")
output = loaded(dummy_input)
```

Tracing records the execution graph for one input. Scripting analyzes the
Python code. Tracing is simpler but misses control flow (if/else, loops
with variable length). Scripting handles control flow but requires
TorchScript-compatible code.

## TensorRT — NVIDIA GPU Optimization

TensorRT fuses layers, optimizes memory, and selects the best CUDA kernels
for your specific GPU.

```
  PyTorch model        TensorRT engine

  Conv -> BN -> ReLU   Fused into one operation
  (3 kernel launches)  (1 kernel launch)

  Typical speedup: 2-5x over PyTorch on the same GPU
```

```python
import torch_tensorrt

model.eval().cuda()

trt_model = torch_tensorrt.compile(
    model,
    inputs=[torch_tensorrt.Input(
        min_shape=[1, 3, 224, 224],
        opt_shape=[8, 3, 224, 224],
        max_shape=[32, 3, 224, 224],
        dtype=torch.float16,
    )],
    enabled_precisions={torch.float16},
)

input_data = torch.randn(1, 3, 224, 224).cuda().half()
output = trt_model(input_data)
```

## CoreML — Apple Devices

```python
import coremltools as ct

traced = torch.jit.trace(model.eval(), dummy_input)

coreml_model = ct.convert(
    traced,
    inputs=[ct.ImageType(name="image", shape=(1, 3, 224, 224),
                          scale=1/255.0,
                          bias=[-0.485/0.229, -0.456/0.224, -0.406/0.225])],
    convert_to="mlprogram",
)

coreml_model.save("model.mlpackage")
```

## TFLite — Mobile and Embedded

```python
import tensorflow as tf
import onnx
from onnx_tf.backend import prepare

onnx_model = onnx.load("model.onnx")
tf_rep = prepare(onnx_model)
tf_rep.export_graph("model_tf")

converter = tf.lite.TFLiteConverter.from_saved_model("model_tf")
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()

with open("model.tflite", "wb") as f:
    f.write(tflite_model)
```

## Benchmarking

Always measure before and after optimization:

```python
import time

def benchmark(model, input_data, num_runs=100, warmup=10):
    for _ in range(warmup):
        model(input_data)

    if torch.cuda.is_available():
        torch.cuda.synchronize()

    start = time.perf_counter()
    for _ in range(num_runs):
        model(input_data)
    if torch.cuda.is_available():
        torch.cuda.synchronize()
    elapsed = time.perf_counter() - start

    avg_ms = (elapsed / num_runs) * 1000
    fps = num_runs / elapsed

    print(f"Average latency: {avg_ms:.1f} ms")
    print(f"Throughput: {fps:.0f} images/sec")
    return avg_ms
```

## Model Size Comparison

```
  +---------------------+--------+---------+--------+
  | Format              | Size   | Latency | Device |
  +---------------------+--------+---------+--------+
  | PyTorch FP32        | 100 MB | 15 ms   | GPU    |
  | TorchScript FP32    |  98 MB | 14 ms   | GPU    |
  | ONNX FP32           |  96 MB | 10 ms   | CPU    |
  | ONNX INT8 (PTQ)     |  25 MB |  5 ms   | CPU    |
  | TensorRT FP16       |  50 MB |  3 ms   | GPU    |
  | CoreML FP16         |  50 MB |  8 ms   | Apple  |
  | TFLite INT8         |  25 MB | 12 ms   | Mobile |
  +---------------------+--------+---------+--------+
  (Approximate values for a ResNet-50-class model)
```

## Exercises

1. Export a trained model to ONNX. Run inference with ONNX Runtime. Compare
   the outputs to PyTorch to verify they match (within floating-point
   tolerance).

2. Apply post-training quantization (dynamic) to a ResNet-18. Measure the
   model file size before and after. Run the benchmark function to compare
   inference speed.

3. Export the same model to TorchScript using both `torch.jit.trace` and
   `torch.jit.script`. Do both produce identical outputs? Which is faster?

4. Profile your model's inference with `torch.profiler`. Identify the top 3
   slowest operations. Are they candidates for fusion?

5. Build a complete deployment pipeline: train a classifier, export to ONNX,
   quantize to INT8, and run inference on 100 test images. Report accuracy
   drop (if any) and speedup factor.

---

**Next: [Lesson 16 — Build a Vision System](16-build-vision-system.md)**
