# 19 - Cost Optimization

AI API costs can explode overnight. A chatbot that costs
$5/day in testing can cost $5,000/day in production. Cost
optimization is the difference between a viable product
and bankruptcy.

---

## Where the Money Goes

```
  COST BREAKDOWN
  ==============

  Tokens = the currency of LLM APIs.

  ┌───────────────┬──────────┬───────────┐
  │ Model         │ Input    │ Output    │
  ├───────────────┼──────────┼───────────┤
  │ GPT-4o        │ $2.50/1M │ $10.00/1M │
  │ GPT-4o-mini   │ $0.15/1M │ $0.60/1M  │
  │ Claude Sonnet │ $3.00/1M │ $15.00/1M │
  │ Claude Haiku  │ $0.25/1M │ $1.25/1M  │
  │ Llama 3 (self)│ ~$0.10/1M│ ~$0.10/1M │
  └───────────────┴──────────┴───────────┘

  A typical chat message:
  System prompt:     500 tokens
  Conversation:      2000 tokens
  User message:      100 tokens
  Response:          500 tokens
  Total:             3100 tokens

  At GPT-4o rates: ~$0.01 per message
  At 10,000 users * 20 messages/day = ~$2,000/day
```

---

## Model Routing: Right Model for the Job

```
  NOT EVERY QUERY NEEDS GPT-4
  ===========================

  "What time is it?"       -> cheap model  ($0.001)
  "Summarize this email"   -> medium model ($0.005)
  "Debug this complex bug" -> expensive model ($0.05)

  ┌─────────────────┐
  │  User Request    │
  └────────┬────────┘
           │
  ┌────────v────────┐
  │  Router (cheap)  │  Classifies complexity
  └────────┬────────┘
           │
     ┌─────┼─────┐
     v     v     v
  Simple Medium Complex
  (Haiku)(Sonnet)(Opus)
  $0.001 $0.005  $0.05

  Save 80% by routing simple queries to cheap models.
```

```python
from openai import OpenAI

client = OpenAI()

ROUTER_PROMPT = """Classify the complexity of this user query.
Output ONLY one word: simple, medium, or complex.

simple: greetings, factual lookups, simple math, yes/no questions
medium: summarization, writing, analysis of short text
complex: multi-step reasoning, code generation, long document analysis"""

MODEL_MAP = {
    "simple": "gpt-4o-mini",
    "medium": "gpt-4o-mini",
    "complex": "gpt-4o",
}

COST_MAP = {
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4o": {"input": 2.50, "output": 10.00},
}


def route_and_respond(user_message: str) -> dict:
    route_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": ROUTER_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=5,
    )

    complexity = route_response.choices[0].message.content.strip().lower()
    if complexity not in MODEL_MAP:
        complexity = "medium"

    model = MODEL_MAP[complexity]

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": user_message}],
    )

    usage = response.usage
    costs = COST_MAP[model]
    cost = (usage.prompt_tokens * costs["input"] + usage.completion_tokens * costs["output"]) / 1_000_000

    return {
        "content": response.choices[0].message.content,
        "model": model,
        "complexity": complexity,
        "tokens": usage.prompt_tokens + usage.completion_tokens,
        "cost": cost,
    }
```

---

## Prompt Compression

```
  BEFORE COMPRESSION (850 tokens):
  ================================
  "You are a helpful, knowledgeable, and friendly AI assistant
   that helps users with their questions. You should always be
   polite and provide detailed, comprehensive answers. If you
   don't know something, say so honestly. Always format your
   responses in a clear and organized manner..."
   [goes on for paragraphs]

  AFTER COMPRESSION (120 tokens):
  ================================
  "Helpful AI assistant. Be concise. Say when unsure.
   Use clear formatting."

  SAME BEHAVIOR. 7x fewer tokens.

  TECHNIQUES:
  ┌───┬──────────────────────────────────────────┐
  │ 1 │ Remove filler words and redundancy        │
  │ 2 │ Use bullet points instead of prose        │
  │ 3 │ Abbreviate where meaning is preserved     │
  │ 4 │ Move examples to few-shot, not system     │
  │ 5 │ Strip conversation history > N turns      │
  │ 6 │ Summarize old context instead of keeping  │
  └───┴──────────────────────────────────────────┘
```

---

## Conversation Summarization

```python
from openai import OpenAI

client = OpenAI()


def summarize_old_messages(messages: list[dict], keep_recent: int = 4) -> list[dict]:
    if len(messages) <= keep_recent + 1:
        return messages

    system_msg = messages[0] if messages[0]["role"] == "system" else None
    start = 1 if system_msg else 0

    old_messages = messages[start:-keep_recent]
    recent_messages = messages[-keep_recent:]

    if not old_messages:
        return messages

    conversation_text = "\n".join(
        f"{m['role']}: {m['content'][:200]}" for m in old_messages
    )

    summary_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "Summarize this conversation in 2-3 sentences. "
                           "Preserve key facts, decisions, and context.",
            },
            {"role": "user", "content": conversation_text},
        ],
        max_tokens=150,
    )

    summary = summary_response.choices[0].message.content
    result = []
    if system_msg:
        result.append(system_msg)
    result.append({"role": "system", "content": f"Previous conversation summary: {summary}"})
    result.extend(recent_messages)

    return result
```

---

## Semantic Caching

```python
import numpy as np
from openai import OpenAI

client = OpenAI()


class SemanticCache:
    def __init__(self, similarity_threshold: float = 0.95):
        self.threshold = similarity_threshold
        self.entries: list[dict] = []

    def _get_embedding(self, text: str) -> list[float]:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        return response.data[0].embedding

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        a_arr = np.array(a)
        b_arr = np.array(b)
        return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))

    def get(self, query: str) -> str | None:
        query_embedding = self._get_embedding(query)

        best_score = 0.0
        best_response = None

        for entry in self.entries:
            score = self._cosine_similarity(query_embedding, entry["embedding"])
            if score > best_score:
                best_score = score
                best_response = entry["response"]

        if best_score >= self.threshold:
            return best_response

        return None

    def set(self, query: str, response: str) -> None:
        embedding = self._get_embedding(query)
        self.entries.append({
            "query": query,
            "embedding": embedding,
            "response": response,
        })
```

```
  EXACT CACHE:
  "What is Python?" -> HIT
  "What's Python?"  -> MISS  (different string!)

  SEMANTIC CACHE:
  "What is Python?" -> HIT
  "What's Python?"  -> HIT  (same meaning!)
  "Tell me about Python" -> HIT
  "Python tutorial" -> MISS (different intent)
```

---

## Token Budget Management

```python
import tiktoken


def count_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))


def trim_to_budget(
    messages: list[dict],
    max_tokens: int = 4000,
    model: str = "gpt-4o-mini",
) -> list[dict]:
    encoding = tiktoken.encoding_for_model(model)

    system_msgs = [m for m in messages if m["role"] == "system"]
    other_msgs = [m for m in messages if m["role"] != "system"]

    system_tokens = sum(len(encoding.encode(m["content"])) for m in system_msgs)
    budget = max_tokens - system_tokens

    trimmed = []
    used = 0
    for msg in reversed(other_msgs):
        msg_tokens = len(encoding.encode(msg["content"]))
        if used + msg_tokens > budget:
            break
        trimmed.insert(0, msg)
        used += msg_tokens

    return system_msgs + trimmed
```

---

## Cost Tracking

```python
from dataclasses import dataclass, field
from collections import defaultdict

PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "text-embedding-3-small": {"input": 0.02, "output": 0.0},
}


@dataclass
class CostTracker:
    total_cost: float = 0.0
    total_requests: int = 0
    cost_by_model: dict = field(default_factory=lambda: defaultdict(float))
    tokens_by_model: dict = field(default_factory=lambda: defaultdict(int))

    def record(self, model: str, input_tokens: int, output_tokens: int):
        prices = PRICING.get(model, {"input": 5.0, "output": 15.0})
        cost = (input_tokens * prices["input"] + output_tokens * prices["output"]) / 1_000_000

        self.total_cost += cost
        self.total_requests += 1
        self.cost_by_model[model] += cost
        self.tokens_by_model[model] += input_tokens + output_tokens

    def report(self) -> str:
        lines = [f"Total cost: ${self.total_cost:.4f} ({self.total_requests} requests)"]
        for model, cost in sorted(self.cost_by_model.items()):
            tokens = self.tokens_by_model[model]
            lines.append(f"  {model}: ${cost:.4f} ({tokens:,} tokens)")
        return "\n".join(lines)
```

---

## Optimization Priorities

```
  BIGGEST IMPACT FIRST
  ====================

  ┌───┬─────────────────────────┬──────────┐
  │ 1 │ Model routing            │ 50-80%   │
  │ 2 │ Caching (exact+semantic) │ 20-50%   │
  │ 3 │ Prompt compression       │ 10-30%   │
  │ 4 │ Conversation trimming    │ 10-20%   │
  │ 5 │ Batch processing         │ 5-15%    │
  │ 6 │ Output length limits     │ 5-10%    │
  └───┴─────────────────────────┴──────────┘

  Stack them: route + cache + compress = 80%+ savings
```

---

## Exercises

**Exercise 1: Router Implementation**
Build a model router that classifies queries into 3 tiers.
Test it on 50 diverse queries. Measure classification accuracy
and calculate savings vs using the expensive model for everything.

**Exercise 2: Semantic Cache**
Implement a semantic cache. Test with 100 queries where 30%
are paraphrases of earlier queries. Measure hit rate and verify
response quality matches the original.

**Exercise 3: Token Budget**
Build a chat application with a strict token budget of 4000
tokens per request. Implement conversation summarization when
the budget is exceeded. Test with a 20-turn conversation.

**Exercise 4: Cost Dashboard**
Build a cost tracking system that logs every API call. Generate
a daily report showing: total cost, cost per model, cache hit
rate, average tokens per request, and projected monthly cost.

---

Next: [20 - AI Safety & Guardrails](20-ai-safety-guardrails.md)
