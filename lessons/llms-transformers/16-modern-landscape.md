# Lesson 16: The Modern LLM Landscape — A Late-2024 Snapshot

You've now learned the full stack: from the transformer architecture to
attention, positional encoding, BERT, GPT, scaling laws, pretraining,
RLHF, inference optimization, and RAG. This final lesson surveys the
field as it looked in late 2024: who was building what, how the models
compared, and how to think about LLMs as a developer building with them.

Provider lineups change quickly, so treat concrete product names, prices,
and context windows here as a snapshot rather than a live catalog.

---

## The Major Players

### OpenAI: GPT-4, GPT-4o, o1

The company that started the modern LLM era.

```
Timeline:
  GPT-1 (2018)  → 117M params, proved pretraining works
  GPT-2 (2019)  → 1.5B params, emergent zero-shot abilities
  GPT-3 (2020)  → 175B params, in-context learning
  ChatGPT (2022) → GPT-3.5 + RLHF, launched the AI revolution
  GPT-4 (2023)  → Multimodal (text + images), reasoning leap
  GPT-4o (2024) → Omni: text + image + audio, faster/cheaper
  o1 (2024)     → Reasoning model, chain-of-thought at inference
```

**Key innovations:**
- Pioneered scaling laws for LLMs
- ChatGPT popularized conversational AI
- GPT-4 showed multimodal capabilities (understanding images)
- o1 introduced "extended thinking" -- spending more compute at
  inference time on harder problems

**Model access:** API only (closed source). Weights are not released.

### Anthropic: Claude 3 Family

Founded by former OpenAI researchers, focused on AI safety.

```
Timeline:
  Claude 1 (2023)    → First release, safety-focused
  Claude 2 (2023)    → Improved capabilities, 100K context
  Claude 3 (2024)    → Three-tier family: Haiku, Sonnet, Opus
  Claude 3.5 (2024)  → Significant capability improvements
```

**The Claude 3 family:**
```
┌──────────────┬─────────────┬──────────────┬──────────────┐
│              │ Haiku        │ Sonnet       │ Opus         │
│              │ (small)      │ (medium)     │ (large)      │
├──────────────┼─────────────┼──────────────┼──────────────┤
│ Speed        │ Fastest      │ Balanced     │ Slowest      │
│ Cost         │ Cheapest     │ Medium       │ Most expensive│
│ Capability   │ Good         │ Very good    │ Best         │
│ Best for     │ Simple tasks,│ Most tasks,  │ Complex      │
│              │ high volume  │ coding, chat │ reasoning    │
└──────────────┴─────────────┴──────────────┴──────────────┘
```

**Key innovations:**
- Constitutional AI (principles-based alignment)
- 200K token context window
- Strong focus on safety and honesty
- Extended thinking (Claude spending time reasoning before answering)

**Model access:** API only (closed source). Weights are not released.

### Google: Gemini Family

Google's response to ChatGPT, built on decades of AI research.

```
Timeline:
  PaLM (2022)          → 540B params, strong reasoning
  PaLM 2 (2023)        → Improved, used in Bard
  Gemini 1.0 (2023)    → Native multimodal (text + image + video)
  Gemini 1.5 (2024)    → 1M token context window
  Gemini 2.0 (2024)    → Improved capabilities, agentic features
```

**Key innovations:**
- Native multimodality (trained on text, images, audio, and video
  from the start, not added after)
- 1 million token context window (longest in the industry)
- Integration with Google ecosystem (Search, Workspace, Android)

**Model access:** API (closed source). Integrated into Google products.

### Meta: Llama (Open Weights)

Meta's contribution to democratizing LLMs.

```
Timeline:
  Llama 1 (2023)    → 7B-65B, initially leaked, then released
  Llama 2 (2023)    → 7B-70B, officially open, commercial license
  Code Llama (2023) → Specialized for code
  Llama 3 (2024)    → 8B-70B, trained on 15T tokens
  Llama 3.1 (2024)  → 8B-70B-405B, competitive with GPT-4
```

**Key innovations:**
- Open weights (anyone can download and run the models)
- Trained on massive data (15T tokens for Llama 3)
- Proved open models can approach closed-model quality
- Created a massive ecosystem of fine-tuned derivatives

**Model access:** Open weights (downloadable). Free for most uses.

### Mistral: European Efficiency

A French AI company focused on efficient, high-quality models.

```
Timeline:
  Mistral 7B (2023)    → Punched above its weight class
  Mixtral 8x7B (2024)  → Mixture of Experts, competitive with GPT-3.5
  Mistral Large (2024) → Competitive with GPT-4
```

**Key innovations:**
- Sliding window attention for efficiency
- Mixture of Experts (MoE) architecture: 8 expert sub-networks,
  only 2 active per token (faster inference at same quality)
- Strong performance relative to model size

**Model access:** Mix of open and closed models.

---

## Open vs Closed Models

This is one of the most important distinctions in the LLM landscape:

```
┌──────────────────┬───────────────────┬───────────────────┐
│                  │ Open Weights       │ Closed Source     │
├──────────────────┼───────────────────┼───────────────────┤
│ Examples         │ Llama, Mistral,   │ GPT-4, Claude,    │
│                  │ Falcon, Phi       │ Gemini             │
├──────────────────┼───────────────────┼───────────────────┤
│ Can download     │ Yes               │ No                │
│ Can fine-tune    │ Yes               │ Limited/No        │
│ Can self-host    │ Yes               │ No                │
│ Can inspect      │ Yes               │ No                │
│ Data privacy     │ Full control      │ Trust the provider│
│ Cost control     │ Your hardware     │ Per-token pricing │
│ Max capability   │ Near frontier     │ Frontier          │
│ Safety guardrails│ You're responsible│ Built in          │
│ Community        │ Huge ecosystem    │ Vendor lock-in    │
└──────────────────┴───────────────────┴───────────────────┘
```

### When to Use Open Models

- You need full data privacy (healthcare, finance, government)
- You want to fine-tune on proprietary data
- You need to control costs (high volume, predictable pricing)
- You need to modify the model's behavior fundamentally
- You're doing research

### When to Use Closed Models

- You need the highest capability available
- You want managed infrastructure (no GPU management)
- You need strong built-in safety and content filtering
- You're prototyping and want the simplest integration
- Your volume doesn't justify self-hosting costs

---

## Multimodal Models: Beyond Text

Modern LLMs increasingly work with multiple modalities:

```
┌─────────────────────────────────────────────────────┐
│              Multimodal LLMs                         │
│                                                      │
│  Input modalities:                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ Text │ │Image │ │Audio │ │Video │ │ Code │     │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘     │
│     └────────┴────────┴────────┴────────┘          │
│                       │                              │
│              ┌────────▼────────┐                    │
│              │  Unified Model  │                    │
│              └────────┬────────┘                    │
│                       │                              │
│     ┌────────┬────────┼────────┬────────┐          │
│  ┌──▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐    │
│  │ Text │ │Image │ │Audio │ │Video │ │ Code │    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
│  Output modalities:                                  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**What multimodal models can do:**
- Describe images and answer questions about them
- Generate images from text descriptions
- Transcribe and understand audio
- Analyze charts, diagrams, and screenshots
- Understand video content
- Convert between modalities (image → text, text → image)

### How Vision Works in LLMs

Images are converted to tokens that the transformer processes alongside
text tokens:

```
Image → Split into patches → Embed each patch → Token sequence

┌──────────────────────┐
│ ┌────┬────┬────┬────┐│     Each patch becomes a "token"
│ │ P1 │ P2 │ P3 │ P4 ││     that the transformer processes
│ ├────┼────┼────┼────┤│     just like a text token
│ │ P5 │ P6 │ P7 │ P8 ││
│ ├────┼────┼────┼────┤│     A 512x512 image might become
│ │ P9 │P10 │P11 │P12 ││     ~200 tokens
│ ├────┼────┼────┼────┤│
│ │P13 │P14 │P15 │P16 ││
│ └────┴────┴────┴────┘│
└──────────────────────┘

Input to transformer:
  [text tokens...] [P1] [P2] [P3] ... [P16] [text tokens...]
```

---

## Reasoning Models: o1 and Extended Thinking

A major development in 2024: models that "think" before answering.

### The Idea

Instead of generating the answer immediately, the model first generates
a chain of reasoning (potentially hundreds of tokens of internal
thought), then produces the final answer.

```
Traditional model:
  Input: "What is 347 × 283?"
  Output: "98,201" (may be wrong)

Reasoning model:
  Input: "What is 347 × 283?"
  [Extended thinking]:
    "Let me break this down.
     347 × 283
     = 347 × 200 + 347 × 80 + 347 × 3
     = 69,400 + 27,760 + 1,041
     = 69,400 + 27,760 = 97,160
     = 97,160 + 1,041 = 98,201"
  Output: "98,201" (more reliable)
```

### Scaling Inference Compute

This represents a philosophical shift: instead of only scaling TRAINING
compute, also scale INFERENCE compute. Spend more time thinking about
harder problems.

```
Traditional scaling:          Inference-time scaling:

Train longer → smarter model  Think longer → better answer

Fixed inference cost           Variable inference cost
Same speed for all questions   Harder questions take longer
Capability fixed at training   Capability scales with thinking time
```

**Analogy:** A student who has studied more (training compute) will
generally do better on exams. But even a well-studied student benefits
from spending more time on hard questions (inference compute) rather
than rushing through them.

### How It Works

The model is trained (via RL) to generate useful intermediate reasoning
before the final answer. The reward signal is whether the final answer
is correct, so the model learns WHAT reasoning steps are helpful.

```
Model without reasoning training:
  Q: "Is 97 prime?"
  A: "No" (wrong! 97 IS prime)

Model with reasoning training:
  Q: "Is 97 prime?"
  [Thinking]:
    "I need to check if 97 is divisible by any primes up to sqrt(97) ≈ 9.8
     Primes to check: 2, 3, 5, 7
     97/2 = 48.5 (not divisible)
     97/3 = 32.33 (not divisible)
     97/5 = 19.4 (not divisible)
     97/7 = 13.86 (not divisible)
     No prime factors found, so 97 is prime."
  A: "Yes, 97 is prime." (correct!)
```

---

## Model Evaluation: Benchmarks and Their Limits

How do we compare models? Benchmarks -- standardized tests -- but
they're imperfect.

### Major Benchmarks

```
┌──────────────────┬──────────────────────────────────────┐
│ Benchmark        │ What It Tests                        │
├──────────────────┼──────────────────────────────────────┤
│ MMLU             │ 57 subjects (STEM, humanities, etc.) │
│                  │ Multiple choice, tests breadth       │
├──────────────────┼──────────────────────────────────────┤
│ HumanEval        │ Code generation (Python functions)   │
│                  │ Pass@1: does generated code work?    │
├──────────────────┼──────────────────────────────────────┤
│ GSM8K            │ Grade school math word problems      │
│                  │ Tests multi-step reasoning           │
├──────────────────┼──────────────────────────────────────┤
│ MATH             │ Competition-level math               │
│                  │ Much harder than GSM8K               │
├──────────────────┼──────────────────────────────────────┤
│ HellaSwag        │ Common sense reasoning               │
│                  │ Complete the story/scenario          │
├──────────────────┼──────────────────────────────────────┤
│ ARC              │ Science questions (grade school)     │
│                  │ Tests scientific reasoning           │
├──────────────────┼──────────────────────────────────────┤
│ MT-Bench         │ Multi-turn conversation quality      │
│                  │ Rated by GPT-4 as judge              │
├──────────────────┼──────────────────────────────────────┤
│ Chatbot Arena    │ Human preference (blind comparison)  │
│                  │ Users vote on which response is better│
└──────────────────┴──────────────────────────────────────┘
```

### The Problem with Benchmarks

```
Benchmark limitations:

1. CONTAMINATION
   Models may have seen benchmark questions in training data
   → Inflated scores that don't reflect true capability

2. NARROW SCOPE
   MMLU tests multiple choice, but real tasks are open-ended
   → Good at benchmarks ≠ good at real tasks

3. GAMING
   Models can be specifically trained to perform well on benchmarks
   → Goodhart's law: when a measure becomes a target, it ceases
     to be a good measure

4. HUMAN DISAGREEMENT
   On Chatbot Arena, human preferences vary widely
   → "Which is better" depends on what you value
```

### What Actually Matters

For developers, the best evaluation is testing on YOUR use case:

```
Step 1: Define your task (customer support, code review, etc.)
Step 2: Create 50-100 representative examples
Step 3: Run multiple models on your examples
Step 4: Evaluate outputs (accuracy, style, cost, speed)
Step 5: Choose the model that best fits your needs

Don't just pick the model with the highest MMLU score.
Pick the one that works best for YOUR task at YOUR budget.
```

---

## The Cost Landscape

### API Pricing (Approximate, varies by provider and changes frequently)

```
┌──────────────────┬───────────────┬────────────────┐
│ Model Tier       │ Input Cost    │ Output Cost    │
│                  │ ($/1M tokens) │ ($/1M tokens)  │
├──────────────────┼───────────────┼────────────────┤
│ Small            │               │                │
│ (Haiku, GPT-4o   │ $0.15 - $0.50│ $0.60 - $1.50 │
│  mini, Llama 8B) │               │                │
├──────────────────┼───────────────┼────────────────┤
│ Medium           │               │                │
│ (Sonnet, GPT-4o, │ $2.50 - $5.00│ $10 - $15     │
│  Llama 70B)      │               │                │
├──────────────────┼───────────────┼────────────────┤
│ Large            │               │                │
│ (Opus, GPT-4,    │ $10 - $15    │ $30 - $75     │
│  reasoning)      │               │                │
└──────────────────┴───────────────┴────────────────┘

For context:
  A typical chatbot conversation: ~1000 tokens input + 500 output
  At medium tier: ~$0.01 per conversation
  At 10,000 conversations/day: ~$100/day = ~$3,000/month
```

### Self-Hosting vs API

```
┌──────────────────┬────────────────────┬─────────────────────┐
│                  │ API (Cloud)         │ Self-Hosted (GPU)   │
├──────────────────┼────────────────────┼─────────────────────┤
│ Setup            │ Minutes            │ Days to weeks       │
│ Cost model       │ Pay per token      │ Pay for hardware    │
│ Break-even       │ Low volume         │ High volume         │
│ Maintenance      │ None               │ Significant         │
│ Scaling          │ Automatic          │ Manual              │
│ Data privacy     │ Shared with vendor │ Full control        │
│ Model choice     │ Vendor's models    │ Any open model      │
│ Customization    │ Limited            │ Full control        │
└──────────────────┴────────────────────┴─────────────────────┘

Rule of thumb: If you're spending > $5,000/month on API calls,
self-hosting starts to make financial sense.
```

---

## Building with LLMs: A Developer's Guide

### Pattern 1: Simple API Call

The simplest integration. Send a prompt, get a response.

```python
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain REST APIs briefly."}
    ],
    temperature=0.3,
    max_tokens=500,
)

print(response.choices[0].message.content)
```

**Use when:** Simple Q&A, text generation, one-shot tasks.

### Pattern 2: RAG (Retrieval-Augmented Generation)

Add your own knowledge. Covered in Lesson 15.

**Use when:** You need the model to answer questions about your data.

### Pattern 3: Tool Use / Function Calling

Let the model call your APIs.

```python
tools = [{
    "type": "function",
    "function": {
        "name": "get_order_status",
        "description": "Look up order status by order ID",
        "parameters": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string"}
            },
            "required": ["order_id"]
        }
    }
}]

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "Where is my order #12345?"}
    ],
    tools=tools,
)

tool_call = response.choices[0].message.tool_calls[0]
# tool_call.function.name == "get_order_status"
# tool_call.function.arguments == '{"order_id": "12345"}'
```

**Use when:** The model needs to interact with external systems.

### Pattern 4: Structured Output

Force the model to output valid JSON matching a schema.

```python
response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user",
         "content": "Extract: 'John Smith, age 35, from NYC'"}
    ],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "person",
            "schema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "age": {"type": "integer"},
                    "city": {"type": "string"}
                }
            }
        }
    }
)
# {"name": "John Smith", "age": 35, "city": "NYC"}
```

**Use when:** You need reliable, parseable output for downstream code.

### Pattern 5: Multi-Model Pipeline

Use different models for different parts of a workflow.

```
┌──────────────────────────────────────────────┐
│          Multi-Model Pipeline                 │
│                                               │
│  User input                                   │
│      │                                        │
│      ▼                                        │
│  Small model (Haiku/GPT-4o-mini)             │
│  → Classify intent ($0.001)                   │
│      │                                        │
│      ├── Simple question                      │
│      │   → Small model answers ($0.01)        │
│      │                                        │
│      ├── Complex reasoning                    │
│      │   → Large model (Opus/GPT-4) ($0.10)  │
│      │                                        │
│      └── Code generation                      │
│          → Sonnet + code review ($0.05)       │
│                                               │
│  Average cost: $0.02 per query                │
│  (vs $0.10 if using large model for everything)│
└──────────────────────────────────────────────┘
```

**Use when:** You need to optimize cost while maintaining quality for
complex queries.

---

## What's Next: The Frontier

### Agents and Autonomous Systems

LLMs that can plan, use tools, and execute multi-step tasks
independently. Think: "Build me a data pipeline" instead of
"Write me a function."

### Smaller, Smarter Models

The trend toward models that match GPT-3.5 quality at 7B parameters.
Techniques like distillation, better data curation, and longer
training make small models increasingly capable.

### Longer Context and Better Memory

Moving from 200K to millions of tokens. Better memory architectures
that give LLMs persistent knowledge across conversations.

### Better Reasoning

Extended thinking, chain-of-thought, and inference-time compute
scaling are making models better at math, logic, and planning.

### Multimodal Everything

Models that natively understand and generate text, images, audio,
video, and code. The boundaries between modalities are blurring.

### Specialized Models

Domain-specific models (medical, legal, financial) that combine
the general capabilities of foundation models with deep expertise.

---

## How to Think About LLMs as a Developer

### When to Use LLMs

```
Good fit:                        Bad fit:
─────────                        ────────
Natural language understanding   Exact computation
Text generation/summarization    Deterministic logic
Code assistance                  Real-time systems
Classification at scale          Where 100% accuracy needed
Conversational interfaces        Simple CRUD operations
Complex pattern matching         Where explainability required
```

### The Right Mental Model

Think of an LLM as a very capable but imperfect colleague:
- It has broad knowledge but can be confidently wrong
- It follows instructions well but needs clear directions
- It's great for drafts that you review and refine
- It's a tool that amplifies YOUR capabilities

### The Developer's Decision Tree

```
Need to add AI to your product?
        │
        ▼
Is it a text/language task? ──No──→ Consider traditional ML
        │
       Yes
        │
        ▼
Do you need real-time facts? ──Yes──→ RAG or tool use
        │
       No
        │
        ▼
Is data privacy critical? ──Yes──→ Open model, self-host
        │
       No
        │
        ▼
Start with an API (GPT-4 or Claude).
Optimize later:
  - Switch to smaller model if quality is sufficient
  - Add RAG if domain knowledge is needed
  - Fine-tune if behavior needs to change
  - Self-host if costs are too high
```

---

## Thought Experiments

1. **The Open Source Question:** If Meta releases a model as capable
   as GPT-4 as open weights, what happens to OpenAI's business model?
   What are the safety implications of anyone being able to run a
   frontier model without guardrails?

2. **The Reasoning Ceiling:** o1-style models spend more compute at
   inference time to reason better. Is there a ceiling to this? Can
   you make any model arbitrarily smart by letting it think longer?

3. **Model Selection:** You're building a customer support chatbot.
   Requirements: handle 100K conversations/day, company-specific
   knowledge, needs to escalate to humans appropriately. Which model
   architecture (API vs self-hosted, with/without RAG, which model
   size) would you choose and why?

4. **The Benchmark Problem:** You create a new benchmark for LLMs.
   Within 6 months, models are specifically trained to ace your
   benchmark. The scores go up, but real-world performance doesn't
   improve as much. How do you create a benchmark that resists this?

5. **Five Years From Now:** Based on what you've learned about scaling
   laws, architectural improvements, and current trends -- what do
   you think LLMs will be capable of in 2029? What will still be hard?

---

## Key Takeaways

1. **The field is moving fast.** Today's frontier model is next year's
   baseline.
2. **Closed models (GPT-4, Claude) lead on capability.** Open models
   (Llama, Mistral) are catching up and offer control and privacy.
3. **Multimodal is the new default.** Modern models work with text,
   images, audio, and more.
4. **Reasoning models** (o1, extended thinking) trade inference speed
   for better answers on hard problems.
5. **For developers,** start with an API call, add RAG for domain
   knowledge, and optimize (smaller models, self-hosting) as you
   scale.
6. **Benchmarks are imperfect.** Test on YOUR use case, not abstract
   leaderboards.
7. **The right model depends on your constraints:** quality, cost,
   speed, privacy, and volume all factor in.

---

## What's Next

Congratulations -- you've completed the LLMs & Transformers track.
You now understand:

```
✓ How language modeling works (predicting the next token)
✓ How tokenization turns text into numbers
✓ Why attention was the breakthrough (and how it works)
✓ The full transformer architecture
✓ Positional encoding (sinusoidal, learned, RoPE)
✓ BERT (encoder-only, understanding) vs GPT (decoder-only, generation)
✓ Why scaling works (and Chinchilla's lesson about data)
✓ How pretraining turns a random model into a knowledge engine
✓ How RLHF/Constitutional AI aligns models with human values
✓ How inference works (sampling, KV cache, speculative decoding)
✓ RAG, tool use, and agents
✓ The modern landscape and how to build with LLMs
```

### Where to Go From Here

**If you want to build with LLMs:**
- Start building. Pick an API (OpenAI, Anthropic, or open source)
  and build something real.
- Learn prompt engineering deeply -- it's the highest-leverage skill.
- Build a RAG system over your own documents.
- Experiment with different models and compare cost/quality tradeoffs.

**If you want to go deeper on the theory:**
- Read the original papers: "Attention Is All You Need," BERT, GPT-2,
  Chinchilla, Constitutional AI.
- Implement a small transformer from scratch (Andrej Karpathy's
  minGPT/nanoGPT is excellent for this).
- Study the Hugging Face Transformers library source code.
- Follow research from Anthropic, OpenAI, Google DeepMind, and Meta
  FAIR.

**If you want to train your own models:**
- Start with fine-tuning an open model (Llama, Mistral) on your data
  using LoRA/QLoRA.
- Learn the Hugging Face ecosystem (Transformers, PEFT, TRL).
- Experiment with quantization and efficient deployment (vLLM, TGI,
  llama.cpp).

The field is moving fast, but the fundamentals you've learned -- the
transformer architecture, attention, scaling, and alignment -- are the
foundation everything is built on. New models come and go, but these
concepts will remain relevant.
