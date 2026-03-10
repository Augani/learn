# Lesson 03: Model Servers

## Industrial-Grade Serving

```
  FastAPI DIY Server              Dedicated Model Server
  +--------------------+          +--------------------+
  | You build:         |          | Built-in:          |
  |  - Batching        |          |  - Batching        |
  |  - GPU mgmt        |          |  - GPU mgmt        |
  |  - Health checks   |          |  - Health checks   |
  |  - Model loading   |          |  - Model loading   |
  |  - Metrics         |          |  - Metrics         |
  |  - Multi-model     |          |  - Multi-model     |
  +--------------------+          +--------------------+
  You: the handyman               You: plug and play
```

Think of it like cooking. In Lesson 02, you built a kitchen from
scratch. Model servers are like buying a **commercial kitchen** --
all the equipment is pre-installed, certified, and optimized. You
just bring the recipes (models).

---

## The Model Server Landscape

```
  +----------------------------------------------------------+
  |                    Model Servers                          |
  |                                                          |
  |  General Purpose        LLM-Specialized                  |
  |  +-----------------+    +-----------------+              |
  |  | TorchServe      |    | vLLM            |              |
  |  | Triton          |    | TGI             |              |
  |  | TF Serving      |    | Ollama          |              |
  |  | BentoML         |    | llama.cpp       |              |
  |  +-----------------+    +-----------------+              |
  +----------------------------------------------------------+
```

---

## TorchServe

PyTorch's official serving solution. If PyTorch is your
framework, TorchServe is the natural choice.

```
  Model Archive (.mar)
  +----------------------------+
  | model.pt (weights)         |
  | handler.py (pre/post proc) |
  | model-config.yaml          |
  +----------------------------+
        |
        v
  TorchServe
  +----------------------------+
  | Management API (:8081)     |
  | Inference API  (:8080)     |
  | Metrics API    (:8082)     |
  +----------------------------+
```

### Creating a Model Archive

```python
# handler.py
import torch
from ts.torch_handler.base_handler import BaseHandler


class SentimentHandler(BaseHandler):
    def preprocess(self, data):
        texts = []
        for row in data:
            input_text = row.get("data") or row.get("body")
            if isinstance(input_text, (bytes, bytearray)):
                input_text = input_text.decode("utf-8")
            texts.append(input_text)

        inputs = self.tokenizer(
            texts, return_tensors="pt", padding=True, truncation=True, max_length=512
        )
        return inputs

    def inference(self, inputs):
        with torch.no_grad():
            outputs = self.model(**inputs)
        return outputs

    def postprocess(self, outputs):
        probs = torch.softmax(outputs.logits, dim=-1)
        predictions = torch.argmax(probs, dim=-1)
        results = []
        for idx, pred in enumerate(predictions):
            results.append({
                "label": "positive" if pred.item() == 1 else "negative",
                "confidence": round(probs[idx][pred].item(), 4),
            })
        return results
```

### Packaging and Starting

```bash
torch-model-archiver \
  --model-name sentiment \
  --version 1.0 \
  --serialized-file model.pt \
  --handler handler.py \
  --extra-files "tokenizer/" \
  --export-path model_store/

torchserve --start \
  --model-store model_store \
  --models sentiment=sentiment.mar \
  --ncs
```

### Calling TorchServe

```python
import requests

response = requests.post(
    "http://localhost:8080/predictions/sentiment",
    data="This product is fantastic!",
)
print(response.json())
```

---

## NVIDIA Triton Inference Server

The **Swiss Army knife** of model servers. Supports every
major framework and is built for maximum throughput.

```
  Triton Inference Server
  +--------------------------------------------------+
  |                                                    |
  |  Model Repository                                  |
  |  +------+  +------+  +------+  +------+           |
  |  | ONNX |  | PT   |  | TF   |  | TRT  |          |
  |  +------+  +------+  +------+  +------+           |
  |                                                    |
  |  Features:                                         |
  |  - Dynamic batching                                |
  |  - Model pipelines (ensembles)                     |
  |  - GPU/CPU scheduling                              |
  |  - HTTP + gRPC endpoints                           |
  |  - Concurrent model execution                      |
  |  - Model versioning                                |
  +--------------------------------------------------+
```

### Model Repository Structure

```
model_repository/
  sentiment/
    config.pbtxt
    1/
      model.onnx
    2/
      model.onnx
  embeddings/
    config.pbtxt
    1/
      model.pt
```

### Triton Config File

```
# config.pbtxt
name: "sentiment"
platform: "onnxruntime_onnx"
max_batch_size: 64

input [
  {
    name: "input_ids"
    data_type: TYPE_INT64
    dims: [ -1 ]
  },
  {
    name: "attention_mask"
    data_type: TYPE_INT64
    dims: [ -1 ]
  }
]

output [
  {
    name: "logits"
    data_type: TYPE_FP32
    dims: [ 2 ]
  }
]

dynamic_batching {
  preferred_batch_size: [ 8, 16, 32 ]
  max_queue_delay_microseconds: 5000
}
```

### Running Triton

```bash
docker run --gpus all -p 8000:8000 -p 8001:8001 -p 8002:8002 \
  -v $(pwd)/model_repository:/models \
  nvcr.io/nvidia/tritonserver:24.01-py3 \
  tritonserver --model-repository=/models
```

### Triton Client

```python
import tritonclient.http as httpclient
import numpy as np

client = httpclient.InferenceServerClient(url="localhost:8000")

input_ids = np.array([[101, 2023, 2003, 2307, 102]], dtype=np.int64)
attention_mask = np.ones_like(input_ids, dtype=np.int64)

inputs = [
    httpclient.InferInput("input_ids", input_ids.shape, "INT64"),
    httpclient.InferInput("attention_mask", attention_mask.shape, "INT64"),
]
inputs[0].set_data_from_numpy(input_ids)
inputs[1].set_data_from_numpy(attention_mask)

outputs = [httpclient.InferRequestedOutput("logits")]

result = client.infer("sentiment", inputs, outputs=outputs)
logits = result.as_numpy("logits")
```

---

## vLLM: The LLM Speed Demon

Purpose-built for serving large language models with
PagedAttention for efficient memory management.

```
  Traditional LLM Serving        vLLM PagedAttention
  +---------------------+        +---------------------+
  | KV Cache:           |        | KV Cache:           |
  | [====    wasted   ] |        | [==][==][==][==]    |
  | [=======  wasted  ] |        | Pages allocated     |
  | [===      wasted  ] |        | on demand, like     |
  |                     |        | virtual memory      |
  | Pre-allocated,      |        |                     |
  | lots of waste       |        | 2-4x more throughput|
  +---------------------+        +---------------------+
```

### Running vLLM

```python
from vllm import LLM, SamplingParams

llm = LLM(model="meta-llama/Llama-2-7b-chat-hf")

sampling_params = SamplingParams(
    temperature=0.7,
    top_p=0.9,
    max_tokens=256,
)

prompts = [
    "Explain quantum computing in one sentence:",
    "Write a haiku about machine learning:",
]

outputs = llm.generate(prompts, sampling_params)

for output in outputs:
    print(output.outputs[0].text)
```

### vLLM as an OpenAI-Compatible Server

```bash
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-2-7b-chat-hf \
  --port 8000
```

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="dummy")

response = client.chat.completions.create(
    model="meta-llama/Llama-2-7b-chat-hf",
    messages=[{"role": "user", "content": "What is MLOps?"}],
    max_tokens=100,
)
print(response.choices[0].message.content)
```

---

## Text Generation Inference (TGI)

Hugging Face's production server for text generation models.

```
  TGI Features
  +------------------------------------------+
  | - Tensor parallelism (multi-GPU)         |
  | - Continuous batching                     |
  | - Quantization (GPTQ, AWQ, bitsandbytes) |
  | - Flash Attention                         |
  | - Token streaming                         |
  | - Watermarking                            |
  +------------------------------------------+
```

### Running TGI

```bash
docker run --gpus all -p 8080:80 \
  -v $(pwd)/data:/data \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id meta-llama/Llama-2-7b-chat-hf \
  --quantize gptq \
  --max-input-length 2048 \
  --max-total-tokens 4096
```

### TGI Client

```python
from huggingface_hub import InferenceClient

client = InferenceClient("http://localhost:8080")

response = client.text_generation(
    "What are the benefits of MLOps?",
    max_new_tokens=200,
    temperature=0.7,
)
print(response)

for token in client.text_generation(
    "Explain CI/CD for ML:",
    max_new_tokens=200,
    stream=True,
):
    print(token, end="", flush=True)
```

---

## Choosing the Right Server

```
  Use Case                  Best Choice      Why
  +-----------------------+----------------+------------------+
  | PyTorch models,       | TorchServe     | Native support,  |
  | custom handlers       |                | familiar API     |
  +-----------------------+----------------+------------------+
  | Multi-framework,      | Triton         | Highest thruput, |
  | max throughput        |                | most flexible    |
  +-----------------------+----------------+------------------+
  | LLM serving,          | vLLM           | PagedAttention,  |
  | high concurrency      |                | best memory eff. |
  +-----------------------+----------------+------------------+
  | HF models, easy       | TGI            | Quick setup,     |
  | setup, streaming      |                | great defaults   |
  +-----------------------+----------------+------------------+
  | Custom logic,         | FastAPI + your | Full control     |
  | simple models         | own code       |                  |
  +-----------------------+----------------+------------------+
```

---

## Production Deployment Pattern

```
  Internet
     |
     v
  +--------+      +----------+      +----------+
  | Load   |----->| Gateway  |----->| Model    |
  | Balancer|     | (auth,   |      | Server   |
  |        |      |  rate    |      | (Triton/ |
  +--------+      |  limit)  |      |  vLLM)   |
                  +----------+      +----------+
                                         |
                                    +----+----+
                                    |         |
                                +---v--+  +---v--+
                                | GPU  |  | GPU  |
                                | Pod 1|  | Pod 2|
                                +------+  +------+
```

---

## Exercises

1. **TorchServe Setup**: Package a pretrained PyTorch model
   into a .mar archive. Deploy it with TorchServe and test
   the inference and management APIs.

2. **Triton ONNX Deploy**: Export a model to ONNX, set up the
   model repository structure, write a config.pbtxt, and
   deploy on Triton with dynamic batching enabled.

3. **vLLM Benchmark**: Run vLLM with a small LLM. Benchmark
   throughput (tokens/sec) with different batch sizes and
   compare to a naive HuggingFace generate() loop.

4. **Server Comparison**: Deploy the same model on TorchServe
   and Triton. Compare latency (p50, p95, p99) and throughput
   under load using a tool like `locust` or `wrk`.

---

[Next: Lesson 04 - Batch vs Real-Time -->](04-batch-vs-realtime.md)
