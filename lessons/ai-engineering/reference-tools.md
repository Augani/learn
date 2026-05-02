# Reference: AI Engineering Tools

> Tools and frameworks for building AI applications.
> Organized by what you're building.

---

## LLM Providers

```
  ┌─────────────────┬──────────────────────────────────────┐
  │ Provider        │ Key Models & Features                │
  ├─────────────────┼──────────────────────────────────────┤
  │ OpenAI          │ GPT-4o, o3, DALL-E, Whisper          │
  │                 │ Best ecosystem, function calling      │
  ├─────────────────┼──────────────────────────────────────┤
  │ Anthropic       │ Claude Opus/Sonnet/Haiku              │
  │                 │ Long context, MCP, tool use           │
  ├─────────────────┼──────────────────────────────────────┤
  │ Google          │ Gemini Pro/Flash, 1M context          │
  │                 │ Multimodal, grounding                 │
  ├─────────────────┼──────────────────────────────────────┤
  │ Mistral         │ Large, Small, Mixtral                 │
  │                 │ European, open + hosted               │
  ├─────────────────┼──────────────────────────────────────┤
  │ DeepSeek        │ V3, R1 (reasoning)                    │
  │                 │ Strong coding, low cost               │
  └─────────────────┴──────────────────────────────────────┘
```

---

## Frameworks

```
  ┌─────────────────┬──────────────────────────────────────┐
  │ Framework       │ Best For                             │
  ├─────────────────┼──────────────────────────────────────┤
  │ LangChain       │ Complex chains, agents, integrations │
  │                 │ Large ecosystem, many connectors      │
  ├─────────────────┼──────────────────────────────────────┤
  │ LlamaIndex      │ RAG pipelines, data indexing         │
  │                 │ Document loading, query engines       │
  ├─────────────────┼──────────────────────────────────────┤
  │ Instructor      │ Structured outputs with Pydantic     │
  │                 │ Type-safe LLM responses               │
  ├─────────────────┼──────────────────────────────────────┤
  │ DSPy            │ Optimizing prompts programmatically  │
  │                 │ Automated prompt engineering          │
  ├─────────────────┼──────────────────────────────────────┤
  │ Semantic Kernel │ Enterprise AI, .NET + Python          │
  │                 │ Microsoft ecosystem integration       │
  ├─────────────────┼──────────────────────────────────────┤
  │ Haystack        │ Search-focused RAG pipelines          │
  │                 │ Document processing, NLP              │
  └─────────────────┴──────────────────────────────────────┘

  WHEN TO USE A FRAMEWORK VS RAW API:

  Raw API calls:
  - Simple chatbot, single model
  - Full control needed
  - Minimal dependencies preferred

  Framework (LangChain, LlamaIndex):
  - Complex multi-step pipelines
  - Multiple data sources
  - RAG with advanced retrieval
  - Rapid prototyping
```

---

## Vector Databases

```
  ┌─────────────────┬──────────────────────────────────────┐
  │ Database        │ Best For                             │
  ├─────────────────┼──────────────────────────────────────┤
  │ Pinecone        │ Managed, serverless, easy setup      │
  │                 │ Best for getting started quickly      │
  ├─────────────────┼──────────────────────────────────────┤
  │ Weaviate        │ Hybrid search (vector + keyword)     │
  │                 │ Self-hosted or managed                │
  ├─────────────────┼──────────────────────────────────────┤
  │ ChromaDB        │ Local development, lightweight       │
  │                 │ Embeds in your Python process         │
  ├─────────────────┼──────────────────────────────────────┤
  │ Qdrant          │ Performance-focused, Rust-based      │
  │                 │ Filtering, self-hosted or cloud       │
  ├─────────────────┼──────────────────────────────────────┤
  │ pgvector        │ PostgreSQL extension                  │
  │                 │ Use if you already have Postgres      │
  ├─────────────────┼──────────────────────────────────────┤
  │ FAISS           │ Library (not a database)              │
  │                 │ Fastest for batch similarity search   │
  └─────────────────┴──────────────────────────────────────┘

  SELECTION GUIDE:
  Just getting started? -> ChromaDB
  Need managed + scale? -> Pinecone
  Have PostgreSQL?      -> pgvector
  Need hybrid search?   -> Weaviate
  Maximum performance?  -> Qdrant or FAISS
```

---

## Evaluation Tools

```
  ┌─────────────────┬──────────────────────────────────────┐
  │ Tool            │ What It Does                         │
  ├─────────────────┼──────────────────────────────────────┤
  │ RAGAS           │ RAG evaluation (faithfulness,        │
  │                 │ relevancy, context precision)         │
  ├─────────────────┼──────────────────────────────────────┤
  │ DeepEval        │ LLM output testing framework         │
  │                 │ Unit tests for AI                     │
  ├─────────────────┼──────────────────────────────────────┤
  │ Promptfoo       │ Prompt testing and comparison         │
  │                 │ A/B test prompts systematically       │
  ├─────────────────┼──────────────────────────────────────┤
  │ LangSmith       │ Tracing, debugging, evaluation        │
  │                 │ From LangChain team                   │
  ├─────────────────┼──────────────────────────────────────┤
  │ Braintrust      │ Logging, evals, prompt playground     │
  │                 │ Production monitoring                 │
  └─────────────────┴──────────────────────────────────────┘
```

---

## Serving and Deployment

```
  ┌─────────────────┬──────────────────────────────────────┐
  │ Tool            │ What It Does                         │
  ├─────────────────┼──────────────────────────────────────┤
  │ vLLM            │ High-throughput LLM inference         │
  │                 │ PagedAttention, continuous batching   │
  ├─────────────────┼──────────────────────────────────────┤
  │ Ollama          │ Local LLM running made easy           │
  │                 │ Pull and run models like Docker       │
  ├─────────────────┼──────────────────────────────────────┤
  │ TGI             │ HuggingFace Text Generation Inference│
  │                 │ Production serving of HF models       │
  ├─────────────────┼──────────────────────────────────────┤
  │ llama.cpp       │ CPU inference for Llama models        │
  │                 │ Run on laptops, quantized models      │
  ├─────────────────┼──────────────────────────────────────┤
  │ BentoML         │ Package models as API services        │
  │                 │ Containerized ML serving              │
  ├─────────────────┼──────────────────────────────────────┤
  │ Modal           │ Serverless GPU compute               │
  │                 │ Run GPU workloads without infra       │
  └─────────────────┴──────────────────────────────────────┘
```

---

## Guardrails and Safety

```
  ┌─────────────────┬──────────────────────────────────────┐
  │ Tool            │ What It Does                         │
  ├─────────────────┼──────────────────────────────────────┤
  │ Guardrails AI   │ Input/output validation framework    │
  │                 │ Validators, structured output         │
  ├─────────────────┼──────────────────────────────────────┤
  │ NeMo Guardrails │ NVIDIA's guardrails framework        │
  │                 │ Programmable safety rails             │
  ├─────────────────┼──────────────────────────────────────┤
  │ Rebuff          │ Prompt injection detection            │
  │                 │ Multi-layer defense                   │
  ├─────────────────┼──────────────────────────────────────┤
  │ LLM Guard       │ Content moderation for LLMs          │
  │                 │ Toxicity, PII, topic filtering        │
  └─────────────────┴──────────────────────────────────────┘
```

---

## Observability

```
  ┌─────────────────┬──────────────────────────────────────┐
  │ Tool            │ What It Does                         │
  ├─────────────────┼──────────────────────────────────────┤
  │ LangSmith       │ Trace LLM calls, debug chains        │
  ├─────────────────┼──────────────────────────────────────┤
  │ Helicone        │ LLM proxy with logging + analytics   │
  ├─────────────────┼──────────────────────────────────────┤
  │ Portkey         │ AI gateway: caching, fallbacks, logs │
  ├─────────────────┼──────────────────────────────────────┤
  │ Weights & Biases│ Experiment tracking + prompts         │
  └─────────────────┴──────────────────────────────────────┘
```

---

## Decision Matrix

```
  Building a chatbot?
  -> OpenAI/Anthropic SDK + FastAPI

  Building RAG?
  -> LlamaIndex + ChromaDB (dev) / Pinecone (prod)

  Need structured outputs?
  -> Instructor + Pydantic

  Building agents?
  -> LangChain or raw SDK + function calling

  Self-hosting models?
  -> vLLM (GPU) or Ollama (local dev)

  Need safety/guardrails?
  -> Guardrails AI or NeMo Guardrails

  Evaluating quality?
  -> RAGAS (RAG) or Promptfoo (prompts)
```
