# Lesson 17: LLM Deployment

> Deploying an LLM is like running a busy restaurant kitchen.
> Orders (requests) come in constantly, each dish (response) takes
> time to prepare (generate tokens), and you need to serve multiple
> tables (users) simultaneously without anyone waiting too long.
> The tricks are batching orders, prepping ingredients (KV cache),
> and using the right equipment (optimized inference engines).

---

## Why LLM Deployment Is Different

```
  Traditional ML model:
    Input --> [Model] --> Output
    Time: 5-50ms, fixed

  LLM:
    Input --> [Model] --> token --> token --> token --> ... --> done
    Time: 500ms-30s, VARIABLE (depends on output length)

  Challenges unique to LLMs:
  +-----------------------------------------------------+
  | 1. Autoregressive: generate one token at a time      |
  | 2. Memory-bound: weights + KV cache dominate         |
  | 3. Variable length: 10 tokens to 4000 tokens output  |
  | 4. Large models: 7B-70B+ parameters                  |
  | 5. High memory: KV cache grows with sequence length   |
  +-----------------------------------------------------+
```

---

## The KV Cache

```
  Without KV cache (naive):
  Step 1: Process [The]           --> predict "cat"
  Step 2: Process [The, cat]      --> predict "sat"
  Step 3: Process [The, cat, sat] --> predict "on"
  Recomputing attention for ALL previous tokens each step!

  With KV cache:
  Step 1: Process [The]           --> cache K,V for "The"
  Step 2: Process [cat] + cached  --> cache K,V for "cat"
  Step 3: Process [sat] + cached  --> cache K,V for "sat"
  Only compute attention for the NEW token!

  KV cache memory:
  Per token: 2 * num_layers * hidden_dim * 2 bytes (FP16)

  LLaMA-7B: 2 * 32 * 4096 * 2 = 512 KB per token
  With 4096 token context: 512KB * 4096 = 2 GB per sequence!

  For 32 concurrent users with 4K context:
  KV cache alone = 64 GB!

  +------+------------+-----------+-----------+
  | Model| Per Token  | 4K ctx    | 32 users  |
  +------+------------+-----------+-----------+
  | 7B   | 512 KB     | 2 GB      | 64 GB     |
  | 13B  | 800 KB     | 3.2 GB    | 102 GB    |
  | 70B  | 2.5 MB     | 10 GB     | 320 GB    |
  +------+------------+-----------+-----------+
```

---

## Continuous Batching

```
  Static batching (naive):
  +------+------+------+------+
  | Req1 | Req2 | Req3 | Req4 |  <-- Start together
  | 100  | 20   | 50   | 10   |  <-- Output tokens needed
  | tok  | tok  | tok  | tok  |
  +------+------+------+------+
  Wait until ALL requests finish before accepting new ones.
  Req2 (20 tokens) waits for Req1 (100 tokens). Wasted GPU!

  Continuous batching:
  Time ->  0    10   20   30   40   ...  100
  Req1:    [=========================...====]
  Req2:    [====]
  Req3:    [============]
  Req4:    [==]
  Req5:         [========]     <-- Req5 enters when Req4 finishes
  Req6:              [====]    <-- Req6 enters when Req2 finishes

  As requests finish, NEW requests immediately take their slot.
  GPU stays fully utilized. Throughput increases 2-10x.
```

---

## vLLM -- High-Performance LLM Serving

```
  vLLM key innovations:
  1. PagedAttention: manages KV cache like OS virtual memory
  2. Continuous batching: maximizes GPU utilization
  3. Tensor parallelism: split across multiple GPUs

  PagedAttention:
  Traditional: allocate contiguous memory for max sequence length
    [=============================] 4096 tokens reserved
    [====]                          Only 500 used = 87% wasted!

  PagedAttention: allocate in small pages (like OS memory)
    [page1][page2][page3][page4]    Only allocate what's needed
    New page allocated on demand    No wasted memory
```

```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Llama-2-7b-chat-hf",
    tensor_parallel_size=1,
    gpu_memory_utilization=0.90,
    max_model_len=4096,
    dtype="float16",
)

sampling_params = SamplingParams(
    temperature=0.7,
    top_p=0.9,
    max_tokens=256,
)

prompts = [
    "Explain quantum computing in simple terms.",
    "Write a Python function to sort a list.",
    "What is the capital of France?",
]

outputs = llm.generate(prompts, sampling_params)

for output in outputs:
    prompt = output.prompt
    generated = output.outputs[0].text
    print(f"Prompt: {prompt[:50]}...")
    print(f"Output: {generated[:100]}...")
    print()
```

### vLLM as OpenAI-Compatible Server

```bash
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-2-7b-chat-hf \
    --tensor-parallel-size 1 \
    --gpu-memory-utilization 0.9 \
    --max-model-len 4096 \
    --port 8000
```

```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="dummy",
)

response = client.chat.completions.create(
    model="meta-llama/Llama-2-7b-chat-hf",
    messages=[
        {"role": "user", "content": "Explain gradient descent."},
    ],
    temperature=0.7,
    max_tokens=256,
)

print(response.choices[0].message.content)
```

---

## Text Generation Inference (TGI)

```
  Hugging Face's production LLM server:

  +---------------------------------------------------+
  | TGI Features:                                      |
  | - Continuous batching                              |
  | - Tensor parallelism                               |
  | - Quantization (GPTQ, AWQ, bitsandbytes)          |
  | - Flash Attention                                  |
  | - Token streaming (Server-Sent Events)             |
  | - Watermarking (detect AI text)                    |
  | - Production-ready Docker images                   |
  +---------------------------------------------------+
```

```bash
docker run --gpus all \
    -p 8080:80 \
    -v /data:/data \
    ghcr.io/huggingface/text-generation-inference:latest \
    --model-id meta-llama/Llama-2-7b-chat-hf \
    --quantize gptq \
    --max-input-length 2048 \
    --max-total-tokens 4096 \
    --max-batch-prefill-tokens 4096
```

```python
import requests

response = requests.post(
    "http://localhost:8080/generate",
    json={
        "inputs": "What is machine learning?",
        "parameters": {
            "max_new_tokens": 200,
            "temperature": 0.7,
            "top_p": 0.9,
        },
    },
)

print(response.json()["generated_text"])
```

---

## Quantized Inference

```
  Serving a 7B model:

  FP16:   14 GB VRAM, A100 required    --> $6/hr
  INT8:    7 GB VRAM, T4 sufficient     --> $0.50/hr
  INT4:  3.5 GB VRAM, consumer GPU OK  --> $0.30/hr

  Quality vs Cost tradeoff:
  +--------+------------+----------+-----------+
  | Format | VRAM (7B)  | Quality  | Cost      |
  +--------+------------+----------+-----------+
  | FP16   | 14 GB      | Best     | $$$       |
  | INT8   | 7 GB       | ~Same    | $$        |
  | GPTQ-4 | 3.5 GB     | Good     | $         |
  | AWQ-4  | 3.5 GB     | Better   | $         |
  | GGUF-4 | 3.5 GB     | Good     | $ (CPU!)  |
  +--------+------------+----------+-----------+
```

```python
from vllm import LLM

llm_quantized = LLM(
    model="TheBloke/Llama-2-7B-Chat-AWQ",
    quantization="awq",
    gpu_memory_utilization=0.90,
    dtype="float16",
)
```

---

## Streaming Responses

```
  Without streaming:
  User sends request
  |
  [========= 5 second wait =========]
  |
  Full response appears at once

  With streaming:
  User sends request
  |
  T-h-e- -c-a-t- -s-a-t- -o-n- -...
  Tokens appear as they're generated!
  First token in ~200ms, rest stream in
```

```python
from vllm import LLM, SamplingParams

llm = LLM(model="meta-llama/Llama-2-7b-chat-hf")

sampling_params = SamplingParams(
    temperature=0.7,
    max_tokens=256,
)

for output in llm.generate(
    ["Tell me about black holes."],
    sampling_params,
    use_tqdm=False,
):
    for token in output.outputs[0].token_ids:
        print(llm.get_tokenizer().decode([token]), end="", flush=True)
```

---

## Speculative Decoding

```
  Standard decoding:
  Big model generates 1 token at a time
  Each token: ~30ms on big model

  Speculative decoding:
  1. Small "draft" model generates N tokens quickly (~2ms each)
  2. Big model verifies all N tokens in ONE forward pass (~35ms)
  3. Accept correct tokens, reject wrong ones

  Small model: "The cat sat on the [mat] [and] [looked] [at] [the]"
                                     ok    ok    ok     WRONG
  Big model verifies in one pass: accept 3, reject from token 4

  Result: 3 tokens in ~45ms instead of ~90ms = 2x speedup!

  +-------------------+----------+----------+
  | Method            | Tokens/s | Latency  |
  +-------------------+----------+----------+
  | Standard (7B)     | 33       | 30ms/tok |
  | Speculative (7B   |          |          |
  |  + 0.5B draft)    | 50-80    | 15ms/tok |
  +-------------------+----------+----------+
```

---

## Production LLM Architecture

```
  +------------------------------------------------------------------+
  |                                                                    |
  |  Client --> [Load Balancer] --> [API Gateway]                     |
  |                                      |                            |
  |                    +-----------------+-----------------+          |
  |                    |                                   |          |
  |              [Request Queue]                    [Rate Limiter]    |
  |                    |                                              |
  |           +--------v--------+                                     |
  |           | Inference Engine |                                    |
  |           | (vLLM / TGI)    |                                    |
  |           |                 |                                     |
  |           | GPU 0: Model    |                                    |
  |           | GPU 1: Model    |                                    |
  |           +---------+-------+                                    |
  |                     |                                             |
  |              [Response Cache]                                     |
  |              (exact + semantic)                                    |
  |                                                                    |
  |  Monitoring: latency, throughput, GPU util, queue depth           |
  +------------------------------------------------------------------+
```

---

## Key Metrics for LLM Serving

```
  +------------------------------+-----------------------------+
  | Metric                       | Target                      |
  +------------------------------+-----------------------------+
  | Time to First Token (TTFT)   | < 500ms                     |
  | Inter-Token Latency (ITL)    | < 50ms                      |
  | Throughput (tokens/sec)      | Maximize per GPU dollar     |
  | Queue depth                  | < 10 requests               |
  | GPU utilization              | > 80%                       |
  | KV cache utilization         | < 90% (avoid OOM)           |
  | Request success rate         | > 99.9%                     |
  | P99 end-to-end latency      | < 10s for typical requests  |
  +------------------------------+-----------------------------+
```

---

## Exercises

1. **vLLM setup**: Install vLLM and serve a 7B model locally.
   Measure throughput (tokens/sec) with 1, 10, and 50 concurrent
   requests. How does batching help?

2. **Quantized serving**: Serve the same model in FP16, INT8, and
   INT4. Compare output quality (perplexity), throughput, and
   GPU memory usage.

3. **Streaming API**: Build a FastAPI endpoint that wraps vLLM
   and supports Server-Sent Events streaming. Test with a web
   frontend that shows tokens appearing in real time.

4. **Response caching**: Add a cache layer in front of your LLM
   endpoint. Cache exact matches. Measure cache hit rate and
   latency improvement on a realistic query distribution.

5. **Load testing**: Use a tool like locust or k6 to load test
   your LLM endpoint. Find the maximum throughput before latency
   degrades. Create a scaling plan based on expected traffic.

---

**Next**: [Lesson 18 - End-to-End MLOps](./18-end-to-end-mlops.md)
