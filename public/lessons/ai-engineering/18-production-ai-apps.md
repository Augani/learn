# 18 - Production AI Apps

Demo code calls the API once and prints the result.
Production code handles failures, manages load, streams
responses, and stays up at 3 AM. The difference between
a science fair project and a power plant.

---

## Production vs Demo

```
  DEMO CODE:                    PRODUCTION CODE:
  ──────────                    ────────────────
  response = client.chat(...)   try:
  print(response)                 response = client.chat(...)
                                except RateLimitError:
                                  backoff_and_retry()
                                except APIError:
                                  use_fallback_model()
                                except Timeout:
                                  return cached_response()

  One user                      1000 concurrent users
  Happy path only               Every error path handled
  No monitoring                 Full observability
  Sync blocking                 Async streaming
```

---

## Streaming Responses

Users don't want to stare at a loading spinner for 10 seconds.
Stream tokens as they're generated.

```python
from openai import OpenAI

client = OpenAI()


def stream_response(messages: list[dict]) -> str:
    full_response = ""

    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            full_response += delta.content
            print(delta.content, end="", flush=True)

    print()
    return full_response
```

### FastAPI Streaming Endpoint

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from openai import OpenAI

app = FastAPI()
client = OpenAI()


def generate_stream(prompt: str):
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield f"data: {delta.content}\n\n"

    yield "data: [DONE]\n\n"


@app.get("/chat")
async def chat(prompt: str):
    return StreamingResponse(
        generate_stream(prompt),
        media_type="text/event-stream",
    )
```

---

## Retry with Exponential Backoff

```python
import time
import random
from openai import OpenAI, RateLimitError, APIError, APITimeoutError

client = OpenAI()


def call_with_retry(
    messages: list[dict],
    max_retries: int = 5,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
) -> str:
    last_exception = None

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                timeout=30,
            )
            return response.choices[0].message.content

        except RateLimitError as exc:
            last_exception = exc
            delay = min(base_delay * (2 ** attempt) + random.uniform(0, 1), max_delay)
            print(f"Rate limited. Retrying in {delay:.1f}s (attempt {attempt + 1})")
            time.sleep(delay)

        except APITimeoutError as exc:
            last_exception = exc
            delay = min(base_delay * (2 ** attempt), max_delay)
            print(f"Timeout. Retrying in {delay:.1f}s (attempt {attempt + 1})")
            time.sleep(delay)

        except APIError as exc:
            if exc.status_code and exc.status_code >= 500:
                last_exception = exc
                delay = base_delay * (2 ** attempt)
                print(f"Server error. Retrying in {delay:.1f}s")
                time.sleep(delay)
            else:
                raise

    raise last_exception
```

```
  RETRY TIMING
  ============

  Attempt 1: immediate
  Attempt 2: ~1s  delay
  Attempt 3: ~2s  delay
  Attempt 4: ~4s  delay
  Attempt 5: ~8s  delay

  + random jitter to prevent thundering herd

  ┌────────────────────────────────────────────┐
  │  Without jitter: 1000 clients all retry    │
  │  at exactly 1s, 2s, 4s -> same spike       │
  │                                            │
  │  With jitter: clients spread out their     │
  │  retries -> smooth load                    │
  └────────────────────────────────────────────┘
```

---

## Fallback Models

```python
from openai import OpenAI
import anthropic


def call_with_fallback(
    prompt: str,
    primary_model: str = "gpt-4o",
    fallback_model: str = "gpt-4o-mini",
) -> dict:
    openai_client = OpenAI()
    messages = [{"role": "user", "content": prompt}]

    try:
        response = openai_client.chat.completions.create(
            model=primary_model,
            messages=messages,
            timeout=30,
        )
        return {
            "content": response.choices[0].message.content,
            "model_used": primary_model,
            "fallback": False,
        }
    except Exception as primary_err:
        print(f"Primary model failed: {primary_err}")

    try:
        response = openai_client.chat.completions.create(
            model=fallback_model,
            messages=messages,
            timeout=30,
        )
        return {
            "content": response.choices[0].message.content,
            "model_used": fallback_model,
            "fallback": True,
        }
    except Exception as fallback_err:
        print(f"Fallback also failed: {fallback_err}")

    try:
        claude = anthropic.Anthropic()
        response = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        return {
            "content": response.content[0].text,
            "model_used": "claude-sonnet-4-20250514",
            "fallback": True,
        }
    except Exception:
        return {
            "content": "Service temporarily unavailable. Please try again.",
            "model_used": "none",
            "fallback": True,
        }
```

---

## Caching

```python
import hashlib
import json
import time
from pathlib import Path


class ResponseCache:
    def __init__(self, cache_dir: str = ".cache/llm", ttl_seconds: int = 3600):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl_seconds

    def _make_key(self, model: str, messages: list[dict]) -> str:
        content = json.dumps({"model": model, "messages": messages}, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()

    def get(self, model: str, messages: list[dict]) -> str | None:
        key = self._make_key(model, messages)
        path = self.cache_dir / f"{key}.json"

        if not path.exists():
            return None

        data = json.loads(path.read_text())
        if time.time() - data["timestamp"] > self.ttl:
            path.unlink()
            return None

        return data["response"]

    def set(self, model: str, messages: list[dict], response: str) -> None:
        key = self._make_key(model, messages)
        path = self.cache_dir / f"{key}.json"
        path.write_text(json.dumps({
            "response": response,
            "timestamp": time.time(),
            "model": model,
        }))


cache = ResponseCache(ttl_seconds=7200)


def cached_chat(model: str, messages: list[dict]) -> str:
    cached = cache.get(model, messages)
    if cached is not None:
        return cached

    from openai import OpenAI
    client = OpenAI()
    response = client.chat.completions.create(model=model, messages=messages)
    result = response.choices[0].message.content

    cache.set(model, messages, result)
    return result
```

---

## Logging and Observability

```python
import logging
import time
import uuid
from dataclasses import dataclass, field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_app")


@dataclass
class RequestTrace:
    request_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    model: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: float = 0
    cached: bool = False
    fallback: bool = False
    error: str = ""

    def log(self):
        logger.info(
            "request_id=%s model=%s tokens=%d+%d latency=%.0fms cached=%s fallback=%s error=%s",
            self.request_id,
            self.model,
            self.prompt_tokens,
            self.completion_tokens,
            self.latency_ms,
            self.cached,
            self.fallback,
            self.error or "none",
        )


def traced_chat(model: str, messages: list[dict]) -> tuple[str, RequestTrace]:
    trace = RequestTrace(model=model)
    start = time.perf_counter()

    try:
        from openai import OpenAI
        client = OpenAI()
        response = client.chat.completions.create(model=model, messages=messages)
        result = response.choices[0].message.content
        trace.prompt_tokens = response.usage.prompt_tokens
        trace.completion_tokens = response.usage.completion_tokens
    except Exception as exc:
        trace.error = str(exc)
        result = ""
    finally:
        trace.latency_ms = (time.perf_counter() - start) * 1000
        trace.log()

    return result, trace
```

---

## Rate Limiting

```python
import time
import threading


class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.rpm = requests_per_minute
        self.timestamps: list[float] = []
        self.lock = threading.Lock()

    def acquire(self) -> float:
        with self.lock:
            now = time.time()
            self.timestamps = [t for t in self.timestamps if now - t < 60]

            if len(self.timestamps) >= self.rpm:
                wait_time = 60 - (now - self.timestamps[0])
                return wait_time

            self.timestamps.append(now)
            return 0.0

    def wait_and_acquire(self):
        while True:
            wait_time = self.acquire()
            if wait_time <= 0:
                return
            time.sleep(wait_time)


limiter = RateLimiter(requests_per_minute=50)
```

---

## Production Checklist

```
  ┌───┬──────────────────────────────────────────────┐
  │ 1 │ Retry with exponential backoff + jitter       │
  │ 2 │ Fallback to cheaper/different model            │
  │ 3 │ Cache identical requests                       │
  │ 4 │ Stream responses to reduce perceived latency   │
  │ 5 │ Rate limit outgoing API calls                  │
  │ 6 │ Log every request: model, tokens, latency, err │
  │ 7 │ Set timeouts on all external calls             │
  │ 8 │ Validate LLM outputs before using them         │
  │ 9 │ Monitor cost per request and per user           │
  │10 │ Graceful degradation when services are down     │
  └───┴──────────────────────────────────────────────┘
```

---

## Exercises

**Exercise 1: Resilient Chat API**
Build a FastAPI chat endpoint with streaming, retries, fallback,
and caching. Test it by simulating failures (wrong API key,
timeout, rate limits).

**Exercise 2: Load Test**
Use a load testing tool to send 100 concurrent requests to your
chat API. Measure p50, p95, and p99 latency. Identify bottlenecks.

**Exercise 3: Cost Dashboard**
Build a simple dashboard that tracks: total tokens used, cost per
model, cache hit rate, error rate, average latency. Log to a
JSON file and build a simple HTML viewer.

**Exercise 4: Circuit Breaker**
Implement a circuit breaker pattern: after 5 consecutive failures,
stop calling the primary model for 60 seconds and use only the
fallback. Auto-recover after the cooldown.

---

Next: [19 - Cost Optimization](19-cost-optimization.md)
