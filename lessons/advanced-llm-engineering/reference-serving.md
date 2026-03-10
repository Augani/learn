# Reference: LLM Serving Engines — Comparing vLLM, TGI, TensorRT-LLM, and Ollama

Quick reference for choosing and configuring LLM serving infrastructure.

---

## Engine Comparison

```
Feature              vLLM           TGI            TensorRT-LLM    Ollama
──────────────────────────────────────────────────────────────────────────────────
Primary use case     Production     Production     Max perf        Local/dev
                     serving        serving        NVIDIA           single-user

Continuous batching  Yes            Yes            Yes             No
PagedAttention       Yes            No (custom)    Yes (paged KV)  No
Flash Attention      FA2            FA2            FA2/FA3         Depends
Tensor parallelism   Yes            Yes            Yes             No
Pipeline parallelism Yes            No             Yes             No
Speculative decode   Yes            No             Yes             No
Prefix caching       Yes            No             Yes             No
Quantization         AWQ,GPTQ,FP8   AWQ,GPTQ,EETQ FP8,INT8,INT4   GGUF (all types)
                     bitsandbytes   bitsandbytes

OpenAI-compat API    Yes            Yes            Via Triton      Yes
Streaming            Yes            Yes            Yes             Yes
Multi-model          Manual         No             Via Triton      Yes (auto)
GPU required         Yes            Yes            Yes (NVIDIA)    No (CPU ok)
LoRA serving         Yes            Yes            No              No (merge only)
Grammar/JSON mode    Yes            Yes            No              Yes

Setup complexity     Low            Low            High            Very low
Documentation        Good           Good           Moderate        Good
License              Apache 2.0     Apache 2.0     Apache 2.0      MIT
```

---

## When to Use What

```
Decision tree:

Are you running locally / developing?
├── Yes → Ollama
│         Simplest setup, runs on CPU, great for experimentation
└── No (production serving)
    │
    Do you need absolute maximum performance?
    ├── Yes → TensorRT-LLM
    │         Best throughput on NVIDIA, but complex setup
    └── No
        │
        Do you need HF ecosystem integration?
        ├── Yes → TGI
        │         Best HF model hub support, Docker-native
        └── No → vLLM
                  Best general-purpose choice, PagedAttention,
                  most features, most active development
```

---

## vLLM

### Installation

```bash
pip install vllm
```

### Basic Server

```bash
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3-8B-Instruct \
  --port 8000
```

### Production Configuration

```bash
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3-70B-Instruct \
  --tensor-parallel-size 4 \
  --gpu-memory-utilization 0.90 \
  --max-model-len 8192 \
  --enable-prefix-caching \
  --max-num-seqs 256 \
  --port 8000 \
  --host 0.0.0.0
```

### With Quantization

```bash
# AWQ
python -m vllm.entrypoints.openai.api_server \
  --model TheBloke/Llama-3-70B-Instruct-AWQ \
  --quantization awq \
  --tensor-parallel-size 2

# GPTQ
python -m vllm.entrypoints.openai.api_server \
  --model TheBloke/Llama-3-70B-Instruct-GPTQ \
  --quantization gptq \
  --tensor-parallel-size 2
```

### With Speculative Decoding

```bash
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3-70B-Instruct \
  --speculative-model meta-llama/Llama-3-8B-Instruct \
  --num-speculative-tokens 5 \
  --tensor-parallel-size 4
```

### With LoRA Adapters

```bash
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3-8B-Instruct \
  --enable-lora \
  --lora-modules code-adapter=./code-lora math-adapter=./math-lora \
  --max-lora-rank 64
```

### Python API

```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Llama-3-8B-Instruct",
    gpu_memory_utilization=0.90,
    max_model_len=4096,
)

params = SamplingParams(
    temperature=0.7,
    top_p=0.9,
    max_tokens=1024,
    stop=["<|eot_id|>"],
    presence_penalty=0.1,
)

prompts = [
    "Explain quantum computing in simple terms:",
    "Write a Python function to sort a list:",
]

outputs = llm.generate(prompts, params)

for output in outputs:
    print(f"Prompt: {output.prompt[:50]}...")
    print(f"Output: {output.outputs[0].text[:200]}")
    print("---")
```

### Key vLLM Tuning Parameters

```
--gpu-memory-utilization 0.90
  Fraction of GPU memory for KV cache. Higher = more concurrent requests.
  Don't go above 0.95 (need room for activations).

--max-model-len 8192
  Maximum sequence length. Lower = less memory per request = more concurrency.

--max-num-seqs 256
  Maximum concurrent requests. Set based on your latency requirements.

--enforce-eager
  Disable CUDA graph compilation. Slower but uses less memory.
  Use when running close to memory limits.

--enable-chunked-prefill
  Process long prompts in chunks. Prevents prefill from blocking decode.
  Recommended for mixed workloads.
```

---

## TGI (Text Generation Inference)

### Docker Setup

```bash
docker run --gpus all --shm-size 1g -p 8080:80 \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id meta-llama/Llama-3-8B-Instruct
```

### Production Configuration

```bash
docker run --gpus all --shm-size 1g -p 8080:80 \
  -e HF_TOKEN=$HF_TOKEN \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id meta-llama/Llama-3-70B-Instruct \
  --num-shard 4 \
  --max-input-tokens 4096 \
  --max-total-tokens 8192 \
  --max-batch-prefill-tokens 4096 \
  --quantize awq \
  --max-concurrent-requests 128
```

### With Quantization

```bash
# AWQ
docker run --gpus all --shm-size 1g -p 8080:80 \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id TheBloke/Llama-3-70B-Instruct-AWQ \
  --quantize awq \
  --num-shard 2

# GPTQ
docker run --gpus all --shm-size 1g -p 8080:80 \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id TheBloke/Llama-3-70B-Instruct-GPTQ \
  --quantize gptq \
  --num-shard 2

# bitsandbytes 4-bit
docker run --gpus all --shm-size 1g -p 8080:80 \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id meta-llama/Llama-3-70B-Instruct \
  --quantize bitsandbytes-nf4 \
  --num-shard 4
```

### API Usage

```bash
# generate
curl http://localhost:8080/generate \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": "What is machine learning?",
    "parameters": {
      "max_new_tokens": 256,
      "temperature": 0.7,
      "top_p": 0.9
    }
  }'

# streaming
curl http://localhost:8080/generate_stream \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": "What is machine learning?",
    "parameters": {"max_new_tokens": 256}
  }'

# OpenAI-compatible
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tgi",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 256
  }'
```

### Key TGI Parameters

```
--num-shard N
  Number of GPUs for tensor parallelism.

--max-input-tokens N
  Maximum prompt length. Reject longer prompts.

--max-total-tokens N
  Maximum total sequence (prompt + generation).

--max-batch-prefill-tokens N
  Maximum tokens in a prefill batch. Controls latency spikes.

--waiting-served-ratio 0.3
  Ratio of waiting time to serve time for scheduling.
  Lower = more responsive to new requests.
```

---

## TensorRT-LLM

### Installation

```bash
pip install tensorrt_llm -U --pre \
  --extra-index-url https://pypi.nvidia.com
```

### Build Engine

```bash
# convert HF model to TensorRT-LLM format
python convert_checkpoint.py \
  --model_dir meta-llama/Llama-3-8B-Instruct \
  --output_dir ./llama-3-8b-ckpt \
  --dtype bfloat16 \
  --tp_size 1

# build the TRT engine
trtllm-build \
  --checkpoint_dir ./llama-3-8b-ckpt \
  --output_dir ./llama-3-8b-engine \
  --max_batch_size 64 \
  --max_input_len 4096 \
  --max_seq_len 8192 \
  --gemm_plugin bfloat16 \
  --gpt_attention_plugin bfloat16 \
  --paged_kv_cache enable
```

### Multi-GPU Build

```bash
# 4-GPU tensor parallel
python convert_checkpoint.py \
  --model_dir meta-llama/Llama-3-70B-Instruct \
  --output_dir ./llama-3-70b-ckpt \
  --dtype bfloat16 \
  --tp_size 4

trtllm-build \
  --checkpoint_dir ./llama-3-70b-ckpt \
  --output_dir ./llama-3-70b-engine \
  --max_batch_size 128 \
  --max_input_len 4096 \
  --max_seq_len 8192 \
  --gemm_plugin bfloat16 \
  --gpt_attention_plugin bfloat16 \
  --paged_kv_cache enable \
  --workers 4
```

### Serve with Triton

```bash
# using the Triton Inference Server backend
docker run --gpus all -p 8000:8000 \
  -v ./llama-3-8b-engine:/models/llama \
  nvcr.io/nvidia/tritonserver:latest-trtllm \
  tritonserver --model-repository /models
```

---

## Ollama

### Installation

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# or via Homebrew
brew install ollama
```

### Basic Usage

```bash
# pull and run a model
ollama pull llama3:8b
ollama run llama3:8b

# with specific quantization
ollama pull llama3:70b-instruct-q4_K_M

# list models
ollama list

# serve as API
ollama serve  # starts on port 11434
```

### API Usage

```bash
# generate
curl http://localhost:11434/api/generate \
  -d '{"model": "llama3:8b", "prompt": "Hello!", "stream": false}'

# chat
curl http://localhost:11434/api/chat \
  -d '{
    "model": "llama3:8b",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'

# OpenAI-compatible
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3:8b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Custom Models (Modelfile)

```dockerfile
# Modelfile
FROM llama3:8b

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096

SYSTEM "You are an expert Python developer."

TEMPLATE """{{ .System }}
{{ .Prompt }}
"""
```

```bash
ollama create my-coding-assistant -f Modelfile
ollama run my-coding-assistant
```

---

## Performance Benchmarks (Approximate)

```
Single A100-80GB, Llama 3 8B, 512 output tokens:

Engine          Throughput       TTFT (p50)    ITL (p50)
                (tok/s total)
──────────────────────────────────────────────────────────
vLLM            ~4500           ~35ms         ~12ms
TGI             ~3800           ~40ms         ~14ms
TensorRT-LLM    ~5200           ~25ms         ~10ms
Ollama          ~80             ~200ms        ~25ms

Notes:
  - Throughput measured at batch size 32
  - Ollama is single-request (no batching)
  - TensorRT-LLM has highest throughput but hardest setup
  - vLLM is best throughput-to-complexity ratio
  - Real numbers vary with hardware, model, and workload
```

```
Concurrent request capacity (A100-80GB, Llama 3 8B, 4K context):

Engine          Max Concurrent      Memory Usage
──────────────────────────────────────────────────
vLLM            ~120 requests       78 GB
TGI             ~80 requests        76 GB
TensorRT-LLM    ~150 requests       79 GB
Ollama          1 request           20 GB

vLLM's PagedAttention gives it the best memory efficiency.
TensorRT-LLM's optimized kernels give it the highest raw throughput.
```

---

## Health Check Endpoints

```
vLLM:
  GET http://localhost:8000/health
  GET http://localhost:8000/v1/models

TGI:
  GET http://localhost:8080/health
  GET http://localhost:8080/info

TensorRT-LLM (Triton):
  GET http://localhost:8000/v2/health/ready
  GET http://localhost:8000/v2/models

Ollama:
  GET http://localhost:11434/api/tags
```

---

## Docker Compose Example (vLLM)

```yaml
version: "3.8"

services:
  llm:
    image: vllm/vllm-openai:latest
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - HF_TOKEN=${HF_TOKEN}
    ports:
      - "8000:8000"
    volumes:
      - ./model-cache:/root/.cache/huggingface
    command: >
      --model meta-llama/Llama-3-8B-Instruct
      --gpu-memory-utilization 0.90
      --max-model-len 8192
      --enable-prefix-caching
      --port 8000
      --host 0.0.0.0
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 120s
```

---

## Cost Comparison (Cloud GPU, per 1M output tokens)

```
Model: Llama 3 70B, 4-bit quantized

Engine          GPU Setup        $/hour    Throughput     $/1M tokens
──────────────────────────────────────────────────────────────────────
vLLM            2× A100-80GB     ~$6       ~2000 tok/s    ~$0.83
TGI             2× A100-80GB     ~$6       ~1600 tok/s    ~$1.04
TensorRT-LLM    2× A100-80GB     ~$6       ~2400 tok/s    ~$0.69
Ollama          1× A100-80GB     ~$3       ~50 tok/s      ~$16.67

For comparison:
  OpenAI GPT-4o:     $2.50/1M output tokens (no GPU cost)
  Claude 3 Sonnet:   $3.00/1M output tokens (no GPU cost)

Self-hosting is cheaper at scale (>10M tokens/day).
API providers are cheaper at low volume or when you factor in
engineering time for self-hosting.
```

---

## Quick Start Decision

```
Just want to try a model locally?
  → ollama run llama3:8b

Need a production API with good defaults?
  → vLLM with default settings

Need to serve from Docker?
  → TGI (built for containerized deployment)

Need absolute maximum throughput on NVIDIA?
  → TensorRT-LLM (be prepared for complex setup)

Need to serve multiple models or LoRA adapters?
  → vLLM with --enable-lora

Running on Mac/CPU only?
  → Ollama (GGUF models, Metal acceleration on Mac)
```
