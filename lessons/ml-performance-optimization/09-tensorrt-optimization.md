# 09 - TensorRT Optimization

## The Analogy

You've written a play. During rehearsals, the director makes changes on the
fly -- new lines, rearranged scenes, improvisation. That's training mode. It
needs to be flexible.

Opening night is different. The script is locked. Every actor knows their
exact cues, every light change is programmed, every scene transition is
rehearsed to perfection. Nothing changes at runtime. That's inference mode.

TensorRT is the stage manager who takes your finished script and optimizes
every transition, every blocking, every lighting cue for maximum performance.
It produces a production that's 2-10x faster than rehearsals, but it can't
improvise anymore.

```
  PYTORCH INFERENCE vs TENSORRT

  PyTorch (flexible, general):
  Python -> C++ dispatch -> kernel selection -> CUDA kernel -> result
           ~10us overhead    ~5us per op

  TensorRT (optimized, fixed):
  C++ -> pre-selected fused kernel -> result
         ~1us overhead
         layers fused, precision optimized, memory pre-allocated

  TensorRT eliminates:
  - Python overhead (zero)
  - Kernel selection (decided at build time)
  - Unnecessary memory copies (pre-planned)
  - Unfused operations (fused at build time)
```

## The TensorRT Pipeline

```
  TENSORRT WORKFLOW

  PyTorch Model
       |
       v
  ONNX Export  ----------> .onnx file
       |
       v
  TensorRT Engine Build --> .engine file (GPU-specific)
       |                    (takes minutes, includes:
       |                     - layer fusion
       |                     - precision calibration
       |                     - kernel auto-tuning
       |                     - memory planning)
       v
  TensorRT Runtime -------> Ultra-fast inference
```

## Step 1: ONNX Export

ONNX (Open Neural Network Exchange) is an intermediate format that TensorRT
can consume. Export your PyTorch model to ONNX:

```python
import torch
import torch.onnx

model = MyModel().cuda().eval()

dummy_input = torch.randn(1, 3, 224, 224, device='cuda')

torch.onnx.export(
    model,
    dummy_input,
    "model.onnx",
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={
        "input": {0: "batch_size"},
        "output": {0: "batch_size"},
    },
    opset_version=17,
    do_constant_folding=True,
)
```

### Validating the ONNX Model

```python
import onnx
import onnxruntime as ort
import numpy as np

onnx_model = onnx.load("model.onnx")
onnx.checker.check_model(onnx_model)

ort_session = ort.InferenceSession("model.onnx")

pytorch_output = model(dummy_input).detach().cpu().numpy()

ort_output = ort_session.run(
    None,
    {"input": dummy_input.cpu().numpy()}
)[0]

np.testing.assert_allclose(pytorch_output, ort_output, rtol=1e-3, atol=1e-5)
print("ONNX model validated successfully")
```

### Common ONNX Export Issues

```
  ONNX EXPORT TROUBLESHOOTING

  Problem                     Solution
  ------------------------------------------------------------------
  Unsupported op             Use opset_version=17+, or register custom op
  Dynamic control flow       Refactor to use torch.where instead of if/else
  In-place operations        ONNX doesn't support in-place; PyTorch handles this
  Custom autograd Function   Implement symbolic() method for ONNX export
  Data-dependent shapes      Use dynamic_axes for variable dimensions
```

## Step 2: Building the TensorRT Engine

### Using trtexec (Command Line)

```bash
trtexec \
    --onnx=model.onnx \
    --saveEngine=model.engine \
    --fp16 \
    --minShapes=input:1x3x224x224 \
    --optShapes=input:32x3x224x224 \
    --maxShapes=input:64x3x224x224 \
    --workspace=4096 \
    --verbose
```

### Using the Python API

```python
import tensorrt as trt

logger = trt.Logger(trt.Logger.WARNING)
builder = trt.Builder(logger)
network = builder.create_network(
    1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
)
parser = trt.OnnxParser(network, logger)

with open("model.onnx", "rb") as f:
    if not parser.parse(f.read()):
        for error in range(parser.num_errors):
            print(parser.get_error(error))
        raise RuntimeError("ONNX parsing failed")

config = builder.create_builder_config()
config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 4 * (1 << 30))

config.set_flag(trt.BuilderFlag.FP16)

profile = builder.create_optimization_profile()
profile.set_shape(
    "input",
    min=(1, 3, 224, 224),
    opt=(32, 3, 224, 224),
    max=(64, 3, 224, 224),
)
config.add_optimization_profile(profile)

serialized_engine = builder.build_serialized_network(network, config)

with open("model.engine", "wb") as f:
    f.write(serialized_engine)
```

### What Happens During Engine Build

```
  ENGINE BUILD PROCESS

  1. LAYER FUSION
     Conv + BatchNorm + ReLU  -->  Single fused kernel
     Linear + GELU            -->  Single fused kernel
     Multiple element-wise    -->  Single fused kernel

  2. PRECISION CALIBRATION (for INT8)
     Run calibration data through network
     Determine per-layer scale factors
     Quantize weights and activations

  3. KERNEL AUTO-TUNING
     For each layer, try multiple CUDA kernel implementations
     Benchmark each on your specific GPU
     Select the fastest per-layer

  4. MEMORY PLANNING
     Pre-allocate all intermediate buffers
     Reuse memory between non-overlapping layers
     Minimize total memory footprint

  This process takes 1-30 minutes depending on model size.
  The engine is specific to the GPU it was built on.
```

## Step 3: Running Inference

```python
import tensorrt as trt
import numpy as np
import pycuda.driver as cuda
import pycuda.autoinit

def load_engine(engine_path):
    logger = trt.Logger(trt.Logger.WARNING)
    runtime = trt.Runtime(logger)
    with open(engine_path, "rb") as f:
        engine = runtime.deserialize_cuda_engine(f.read())
    return engine

class TRTInference:
    def __init__(self, engine_path):
        self.engine = load_engine(engine_path)
        self.context = self.engine.create_execution_context()

        self.inputs = []
        self.outputs = []
        self.bindings = []
        self.stream = cuda.Stream()

        for i in range(self.engine.num_io_tensors):
            name = self.engine.get_tensor_name(i)
            dtype = trt.nptype(self.engine.get_tensor_dtype(name))
            shape = self.engine.get_tensor_shape(name)

            size = trt.volume(shape)
            host_mem = cuda.pagelocked_empty(size, dtype)
            device_mem = cuda.mem_alloc(host_mem.nbytes)

            self.bindings.append(int(device_mem))
            if self.engine.get_tensor_mode(name) == trt.TensorIOMode.INPUT:
                self.inputs.append({"host": host_mem, "device": device_mem, "name": name})
            else:
                self.outputs.append({"host": host_mem, "device": device_mem, "name": name})

    def infer(self, input_data):
        np.copyto(self.inputs[0]["host"], input_data.ravel())
        cuda.memcpy_htod_async(
            self.inputs[0]["device"],
            self.inputs[0]["host"],
            self.stream,
        )

        for inp in self.inputs:
            self.context.set_tensor_address(inp["name"], int(inp["device"]))
        for out in self.outputs:
            self.context.set_tensor_address(out["name"], int(out["device"]))

        self.context.execute_async_v3(stream_handle=self.stream.handle)

        for out in self.outputs:
            cuda.memcpy_dtoh_async(out["host"], out["device"], self.stream)

        self.stream.synchronize()
        return self.outputs[0]["host"].copy()

trt_model = TRTInference("model.engine")
input_data = np.random.randn(1, 3, 224, 224).astype(np.float32)
output = trt_model.infer(input_data)
```

### Simpler: torch-tensorrt

For a PyTorch-native experience, use `torch-tensorrt`:

```python
import torch
import torch_tensorrt

model = MyModel().cuda().eval()
dummy_input = torch.randn(1, 3, 224, 224, device='cuda')

trt_model = torch_tensorrt.compile(
    model,
    inputs=[
        torch_tensorrt.Input(
            min_shape=[1, 3, 224, 224],
            opt_shape=[32, 3, 224, 224],
            max_shape=[64, 3, 224, 224],
            dtype=torch.float16,
        )
    ],
    enabled_precisions={torch.float16},
)

output = trt_model(dummy_input.half())
```

`torch-tensorrt` stays in the PyTorch ecosystem -- you get a `torch.nn.Module`
back that you can use like any other model.

## Precision Calibration

### FP16 Inference

FP16 is the easiest precision optimization. Most models lose negligible
accuracy:

```
  PRECISION COMPARISON

  Precision    Speed (relative)    Memory    Accuracy Loss
  --------------------------------------------------------
  FP32         1.0x               1.0x      Baseline
  FP16         2-3x               0.5x      < 0.1% typical
  INT8         3-5x               0.25x     0.1-1% typical
  INT4         5-8x               0.125x    1-5% (needs care)
```

### INT8 Calibration

INT8 quantization maps fp32 values to 8-bit integers. This requires
**calibration** -- running representative data through the model to determine
the optimal mapping range for each layer.

```python
import tensorrt as trt
import numpy as np

class CalibrationDataset:
    def __init__(self, data, batch_size=32):
        self.data = data
        self.batch_size = batch_size
        self.current_index = 0

    def get_batch(self):
        if self.current_index >= len(self.data):
            return None
        batch = self.data[self.current_index:self.current_index + self.batch_size]
        self.current_index += self.batch_size
        return [batch.astype(np.float32)]

class Int8Calibrator(trt.IInt8EntropyCalibrator2):
    def __init__(self, dataset, cache_file="calibration.cache"):
        super().__init__()
        self.dataset = dataset
        self.cache_file = cache_file
        self.device_input = cuda.mem_alloc(
            dataset.batch_size * 3 * 224 * 224 * 4
        )

    def get_batch_size(self):
        return self.dataset.batch_size

    def get_batch(self, names):
        batch = self.dataset.get_batch()
        if batch is None:
            return None
        cuda.memcpy_htod(self.device_input, batch[0])
        return [int(self.device_input)]

    def read_calibration_cache(self):
        try:
            with open(self.cache_file, "rb") as f:
                return f.read()
        except FileNotFoundError:
            return None

    def write_calibration_cache(self, cache):
        with open(self.cache_file, "wb") as f:
            f.write(cache)
```

Use 500-1000 representative samples for calibration. The calibration cache
is saved so you only need to calibrate once.

## Layer Fusion in TensorRT

TensorRT performs aggressive fusion that goes beyond what `torch.compile`
does:

```
  TENSORRT FUSION PATTERNS

  Pattern 1: Conv + BN + ReLU
  Before: [Conv kernel] -> [BN kernel] -> [ReLU kernel]
  After:  [Fused ConvBNReLU kernel]
  Savings: 2 fewer kernel launches, 2 fewer memory roundtrips

  Pattern 2: FC + Bias + Activation
  Before: [MatMul] -> [BiasAdd] -> [GELU]
  After:  [Fused MatMulBiasGELU]

  Pattern 3: Multi-head Attention
  Before: [QKV proj] -> [Reshape] -> [Transpose] -> [MatMul] -> [Scale]
          -> [Softmax] -> [MatMul] -> [Transpose] -> [Reshape]
  After:  [FusedMultiHeadAttention]  (single optimized kernel)

  Pattern 4: Residual Connection
  Before: [Layer output] -> [Add with residual]
  After:  [Layer with fused residual add]  (last write combines both)
```

## Dynamic Shapes

Real inference workloads have variable batch sizes and sequence lengths.
TensorRT handles this with optimization profiles:

```python
profile = builder.create_optimization_profile()

profile.set_shape("input_ids", min=(1, 1), opt=(16, 128), max=(64, 512))
profile.set_shape("attention_mask", min=(1, 1), opt=(16, 128), max=(64, 512))

config.add_optimization_profile(profile)
```

TensorRT optimizes for the `opt` shape and ensures correctness for all shapes
between `min` and `max`. The engine is most efficient at `opt` shapes.

For multiple common shapes, create multiple profiles:

```python
profile1 = builder.create_optimization_profile()
profile1.set_shape("input", min=(1, 128), opt=(32, 128), max=(64, 128))

profile2 = builder.create_optimization_profile()
profile2.set_shape("input", min=(1, 512), opt=(32, 512), max=(64, 512))

config.add_optimization_profile(profile1)
config.add_optimization_profile(profile2)
```

## Benchmarking TensorRT vs PyTorch

```python
import time
import torch
import numpy as np

def benchmark_pytorch(model, input_tensor, num_runs=1000, warmup=100):
    model.eval()
    with torch.inference_mode():
        for _ in range(warmup):
            _ = model(input_tensor)
        torch.cuda.synchronize()

        start = time.perf_counter()
        for _ in range(num_runs):
            _ = model(input_tensor)
        torch.cuda.synchronize()
        elapsed = time.perf_counter() - start

    latency_ms = elapsed / num_runs * 1000
    throughput = num_runs / elapsed
    print(f"PyTorch: {latency_ms:.2f}ms, {throughput:.0f} infer/s")
    return latency_ms

def benchmark_tensorrt(trt_model, input_data, num_runs=1000, warmup=100):
    for _ in range(warmup):
        _ = trt_model.infer(input_data)

    start = time.perf_counter()
    for _ in range(num_runs):
        _ = trt_model.infer(input_data)
    elapsed = time.perf_counter() - start

    latency_ms = elapsed / num_runs * 1000
    throughput = num_runs / elapsed
    print(f"TensorRT: {latency_ms:.2f}ms, {throughput:.0f} infer/s")
    return latency_ms

pytorch_latency = benchmark_pytorch(model, input_tensor)
trt_latency = benchmark_tensorrt(trt_model, input_data)
print(f"Speedup: {pytorch_latency / trt_latency:.2f}x")
```

Typical results:

```
  MODEL BENCHMARKS (A100, batch=32)

  Model           PyTorch     TRT FP16    TRT INT8    Speedup
  ----------------------------------------------------------
  ResNet-50       4.2ms       1.1ms       0.7ms       6.0x
  BERT-base       8.5ms       2.8ms       1.5ms       5.7x
  GPT-2 small     15.3ms      5.1ms       --          3.0x
  ViT-Large       12.7ms      4.2ms       2.1ms       6.0x
  EfficientNet-B4 6.8ms       1.9ms       1.1ms       6.2x
```

## Exercises

1. Export a PyTorch model to ONNX. Validate that the ONNX output matches
   PyTorch output within tolerance.

2. Build a TensorRT engine with FP16 precision. Benchmark latency and
   throughput against the original PyTorch model.

3. Implement INT8 calibration for your model. How much accuracy do you lose?
   How much speed do you gain over FP16?

4. Build an engine with dynamic batch size support (min=1, opt=32, max=64).
   Benchmark at various batch sizes. Where is the sweet spot?
