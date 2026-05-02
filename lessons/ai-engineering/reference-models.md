# Reference: Model Comparison

> Which model for which task. Prices and capabilities
> change frequently -- check provider docs for latest.

---

## Model Comparison Table

```
  ┌──────────────────┬──────────┬────────┬────────┬──────────┐
  │ Model            │ Provider │Context │Quality │ Cost     │
  ├──────────────────┼──────────┼────────┼────────┼──────────┤
  │ GPT-4o           │ OpenAI   │ 128K   │ High   │ $$       │
  │ GPT-4o-mini      │ OpenAI   │ 128K   │ Good   │ $        │
  │ o3               │ OpenAI   │ 200K   │ V.High │ $$$$     │
  │ o3-mini          │ OpenAI   │ 200K   │ High   │ $$       │
  ├──────────────────┼──────────┼────────┼────────┼──────────┤
  │ Claude Opus 4    │Anthropic │ 200K   │ V.High │ $$$$     │
  │ Claude Sonnet 4  │Anthropic │ 200K   │ High   │ $$       │
  │ Claude Haiku 3.5 │Anthropic │ 200K   │ Good   │ $        │
  ├──────────────────┼──────────┼────────┼────────┼──────────┤
  │ Gemini 2.0 Flash │ Google   │ 1M     │ Good   │ $        │
  │ Gemini 2.5 Pro   │ Google   │ 1M     │ High   │ $$       │
  ├──────────────────┼──────────┼────────┼────────┼──────────┤
  │ Llama 3.3 70B    │ Meta     │ 128K   │ Good   │ Free*    │
  │ Llama 3.1 405B   │ Meta     │ 128K   │ High   │ Free*    │
  ├──────────────────┼──────────┼────────┼────────┼──────────┤
  │ Mistral Large    │ Mistral  │ 128K   │ High   │ $$       │
  │ Mistral Small    │ Mistral  │ 128K   │ Good   │ $        │
  │ Mixtral 8x7B     │ Mistral  │ 32K    │ Good   │ Free*    │
  ├──────────────────┼──────────┼────────┼────────┼──────────┤
  │ DeepSeek V3      │ DeepSeek │ 128K   │ High   │ $        │
  │ DeepSeek R1      │ DeepSeek │ 128K   │ V.High │ $$       │
  ├──────────────────┼──────────┼────────┼────────┼──────────┤
  │ Qwen 2.5 72B    │ Alibaba  │ 128K   │ Good   │ Free*    │
  └──────────────────┴──────────┴────────┴────────┴──────────┘

  * Free = open weights, pay for compute to host
  $ = budget   $$ = moderate   $$$ = expensive   $$$$ = premium
```

---

## When to Use Which Model

```
  TASK-BASED SELECTION
  ====================

  Simple Q&A, classification:
  -> GPT-4o-mini, Claude Haiku, Gemini Flash
  -> Cheapest option that meets quality bar

  Code generation:
  -> Claude Sonnet 4, GPT-4o, DeepSeek V3
  -> All strong at coding, test on your use case

  Long document analysis:
  -> Gemini 2.5 Pro (1M context)
  -> Claude (200K context)
  -> GPT-4o (128K context)

  Complex reasoning / math:
  -> o3, Claude Opus 4, DeepSeek R1
  -> Reasoning models for multi-step problems

  Creative writing:
  -> Claude Opus 4, GPT-4o
  -> Better at nuance and style

  Structured output (JSON):
  -> GPT-4o (native JSON mode)
  -> Claude Sonnet 4 (with tool use)

  Embeddings:
  -> text-embedding-3-small (OpenAI, cheap)
  -> text-embedding-3-large (OpenAI, better)
  -> Voyage AI (specialized)

  Self-hosted / privacy:
  -> Llama 3.3 70B, Mistral, Qwen 2.5
  -> Full control, no data leaves your servers
```

---

## Cost Comparison (per 1M tokens)

```
  ┌──────────────────┬──────────┬───────────┬───────────┐
  │ Model            │ Input    │ Output    │ Notes     │
  ├──────────────────┼──────────┼───────────┼───────────┤
  │ GPT-4o-mini      │ $0.15    │ $0.60     │ Best value│
  │ GPT-4o           │ $2.50    │ $10.00    │           │
  │ o3-mini          │ $1.10    │ $4.40     │           │
  │ o3               │ $10.00   │ $40.00    │ Reasoning │
  ├──────────────────┼──────────┼───────────┼───────────┤
  │ Claude Haiku 3.5 │ $0.25    │ $1.25     │ Best value│
  │ Claude Sonnet 4  │ $3.00    │ $15.00    │           │
  │ Claude Opus 4    │ $15.00   │ $75.00    │ Premium   │
  ├──────────────────┼──────────┼───────────┼───────────┤
  │ Gemini Flash     │ $0.075   │ $0.30     │ Cheapest  │
  │ Gemini Pro       │ $1.25    │ $5.00     │           │
  ├──────────────────┼──────────┼───────────┼───────────┤
  │ DeepSeek V3      │ $0.27    │ $1.10     │           │
  │ DeepSeek R1      │ $0.55    │ $2.19     │ Reasoning │
  └──────────────────┴──────────┴───────────┴───────────┘

  Note: Prices as of early 2025. Check provider websites.
```

---

## Model Selection Flowchart

```
  Need the best quality possible?
  │
  ├── YES: Complex reasoning needed?
  │   ├── YES -> o3, Claude Opus 4, DeepSeek R1
  │   └── NO  -> GPT-4o, Claude Sonnet 4
  │
  └── NO: Budget-sensitive?
      │
      ├── YES: Self-hosting possible?
      │   ├── YES -> Llama 3.3 70B, Qwen 2.5
      │   └── NO  -> GPT-4o-mini, Gemini Flash
      │
      └── NO: Need long context (>128K)?
          ├── YES -> Gemini 2.5 Pro (1M)
          └── NO  -> Claude Sonnet 4, GPT-4o
```

---

## Open vs Closed Models

```
  CLOSED (API-only):           OPEN WEIGHTS:
  ==================           ==============
  + Easy to use                + Full control
  + Always up-to-date          + No data leaves your servers
  + No infrastructure          + Customize / fine-tune freely
  - Data sent to provider      + No per-token cost (pay compute)
  - Rate limits                - Need GPU infrastructure
  - Price can change           - You manage updates
  - Provider can discontinue   - Harder to set up

  WHEN TO SELF-HOST:
  - Strict data privacy requirements
  - Very high volume (>$10K/month API cost)
  - Need fine-tuned model weights
  - Regulated industry (healthcare, finance)
  - Offline / air-gapped environments
```

---

## Embedding Models

```
  ┌────────────────────────┬──────┬────────────┬──────────┐
  │ Model                  │ Dims │ Max Tokens │ Cost/1M  │
  ├────────────────────────┼──────┼────────────┼──────────┤
  │ text-embedding-3-small │ 1536 │ 8191       │ $0.02    │
  │ text-embedding-3-large │ 3072 │ 8191       │ $0.13    │
  │ Voyage 3               │ 1024 │ 32000      │ $0.06    │
  │ Cohere embed v3        │ 1024 │ 512        │ $0.10    │
  │ BGE-large (open)       │ 1024 │ 512        │ Free*    │
  │ E5-mistral (open)      │ 4096 │ 32768      │ Free*    │
  └────────────────────────┴──────┴────────────┴──────────┘

  For most RAG applications:
  text-embedding-3-small is the best starting point.
  Switch to large or specialized models only if retrieval
  quality is insufficient.
```
