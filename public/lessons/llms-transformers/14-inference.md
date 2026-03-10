# Lesson 14: Inference — How an LLM Generates a Response

You've seen how models are trained. Now let's look at the other side:
what happens when you send a message to ChatGPT or Claude and get a
response back. This is **inference** -- running the trained model to
generate output. And it turns out the engineering challenges of serving
a model are just as fascinating as training one.

---

## The Autoregressive Loop

LLMs generate text one token at a time. The full process:

```
Your prompt: "What is the capital of France?"

Step 1 (Prefill): Process ALL prompt tokens in parallel
  ┌──────────────────────────────────────────────┐
  │  "What" "is" "the" "capital" "of" "France" "?"│
  │              ↓ ↓ ↓ ↓ ↓ ↓ ↓                    │
  │         Process all tokens at once             │
  │         (this is fast — parallelizable)        │
  │              ↓                                 │
  │  Output: probability distribution for next token│
  └──────────────────────────────────────────────┘

Step 2 (Decode): Generate tokens one at a time
  → "The"       (sample from distribution, append)
  → "capital"   (run model again with one new token)
  → "of"        (run model again)
  → "France"    (run model again)
  → "is"        (run model again)
  → "Paris"     (run model again)
  → "."         (run model again)
  → <EOS>       (end of sequence — stop generating)
```

This is why LLM responses stream in word by word. Each token requires
a full forward pass through the model. You literally can't generate
the second word until you've decided on the first.

**Analogy:** Writing by hand vs printing. A printer (parallel) can lay
down an entire page at once. Handwriting (autoregressive) produces one
letter at a time, each letter depending on what came before.

---

## From Logits to Words: The Sampling Process

At each step, the model outputs **logits** -- raw scores for every
token in its vocabulary. These scores are converted to probabilities
using softmax, and then a token is selected.

```
Model output (logits) for next token after "The capital of France is":

Token          Logit     After Softmax
────────────   ──────    ─────────────
"Paris"         8.2       0.42
"the"           6.1       0.15
"a"             5.8       0.12
"located"       5.3       0.08
"known"         4.9       0.06
"one"           4.7       0.05
"called"        4.2       0.03
  ...           ...        ...
"banana"       -3.1       0.00001
"the42xyz"     -8.5       0.0000001
```

50,000+ tokens, each with a probability. How do you pick one?

---

## Temperature: Controlling Randomness

Temperature divides the logits before softmax, controlling how
"peaked" or "flat" the probability distribution is.

```
logits_adjusted = logits / temperature
probabilities = softmax(logits_adjusted)
```

### The Effect

```
Temperature = 0.0 (deterministic):
  "Paris"     → 1.00    Always picks "Paris"
  Everything else → 0.00

Temperature = 0.3 (focused):
  "Paris"     → 0.85    Almost always "Paris"
  "the"       → 0.08    Occasionally "the"
  "a"         → 0.04
  rest        → 0.03

Temperature = 1.0 (standard):
  "Paris"     → 0.42    Original distribution
  "the"       → 0.15
  "a"         → 0.12
  rest        → 0.31

Temperature = 2.0 (creative/chaotic):
  "Paris"     → 0.18    Much flatter
  "the"       → 0.12    Many tokens are plausible
  "a"         → 0.10
  "banana"    → 0.02    Even weird tokens get a shot
```

**Analogy:** Temperature is like the "adventurousness" dial at a
restaurant. Temperature 0 is always ordering your usual. Temperature
0.7 is trying something new from your favorite cuisine. Temperature
2.0 is pointing randomly at the menu blindfolded.

### When to Use What

```
┌─────────────────────┬──────────────┬──────────────────────┐
│ Use Case            │ Temperature  │ Why                  │
├─────────────────────┼──────────────┼──────────────────────┤
│ Code generation     │ 0.0 - 0.2   │ Correctness matters  │
│ Factual Q&A         │ 0.0 - 0.3   │ Accuracy matters     │
│ General chat        │ 0.5 - 0.8   │ Natural conversation │
│ Creative writing    │ 0.7 - 1.0   │ Variety and style    │
│ Brainstorming       │ 0.8 - 1.2   │ Novel ideas          │
│ "Temperature 0"     │ 0.0         │ Reproducible output  │
└─────────────────────┴──────────────┴──────────────────────┘
```

---

## Top-k Sampling

Instead of sampling from all 50,000+ tokens, only consider the k
most likely tokens.

```
Top-k = 5:

Original distribution:        After top-k filtering:

"Paris"     0.42              "Paris"     0.42 / 0.83 = 0.51
"the"       0.15              "the"       0.15 / 0.83 = 0.18
"a"         0.12              "a"         0.12 / 0.83 = 0.14
"located"   0.08              "located"   0.08 / 0.83 = 0.10
"known"     0.06              "known"     0.06 / 0.83 = 0.07
"one"       0.05              ────────── (filtered out) ──────
"called"    0.03
"banana"    0.00001
...

Only the top 5 tokens are kept. Their probabilities
are renormalized to sum to 1.0.
```

Top-k prevents sampling extremely unlikely tokens (like "banana"
after "The capital of France is"). But it has a problem: k is fixed.
Sometimes the model is very confident (only 2 good choices), and
sometimes it's uncertain (20 reasonable choices). A fixed k doesn't
adapt.

---

## Top-p / Nucleus Sampling

Top-p sampling adapts to the distribution. Instead of a fixed number
of tokens, keep tokens until their cumulative probability reaches p.

```
Top-p = 0.9:

Token       Probability   Cumulative   Include?
─────────   ───────────   ──────────   ────────
"Paris"     0.42          0.42         ✓
"the"       0.15          0.57         ✓
"a"         0.12          0.69         ✓
"located"   0.08          0.77         ✓
"known"     0.06          0.83         ✓
"one"       0.05          0.88         ✓
"called"    0.03          0.91         ✓ (crosses 0.9 threshold)
"named"     0.02          0.93         ✗ (stop here)
...
```

### Why Top-p Is Better Than Top-k

```
Scenario 1: Model is confident
  "Paris" has 0.95 probability
  Top-k=50: Includes 49 unlikely tokens (bad)
  Top-p=0.9: Includes only "Paris" (good)

Scenario 2: Model is uncertain
  Top 20 tokens each have ~0.04 probability
  Top-k=5: Misses 15 reasonable options (bad)
  Top-p=0.9: Includes all 20+ reasonable options (good)
```

Top-p adapts the number of candidates to the model's confidence level.
This is why it's the most commonly used sampling strategy in practice.

### Combining Parameters

In practice, APIs let you set multiple parameters:

```python
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Write a poem about coding"}],
    temperature=0.8,
    top_p=0.95,
    max_tokens=200,
)
```

Temperature and top-p are often used together. Temperature reshapes
the distribution, then top-p truncates the tail.

---

## Greedy Decoding vs Beam Search

### Greedy Decoding (Temperature = 0)

Always pick the highest-probability token. Simple, fast, deterministic.
But often produces repetitive, "safe" text.

```
"The the the the the..." or
"I think it's important to note that it's important to note that..."
```

Greedy decoding can get stuck in loops because the most likely next
token is often similar to recent tokens.

### Beam Search

Track the top-b most probable SEQUENCES simultaneously:

```
Beam search with b=3:

Step 1: "The" (0.3), "Paris" (0.25), "A" (0.15)

Step 2: Expand each:
  "The capital"     (0.3 × 0.4 = 0.12)
  "The city"        (0.3 × 0.2 = 0.06)
  "Paris is"        (0.25 × 0.5 = 0.125)  ← best!
  "Paris ,"         (0.25 × 0.1 = 0.025)
  "A beautiful"     (0.15 × 0.3 = 0.045)
  ...

Keep top 3 overall:
  "Paris is"        (0.125)
  "The capital"     (0.12)
  "The city"        (0.06)

Continue expanding...
```

Beam search finds better overall sequences than greedy decoding, but
it's slower (b times more computation) and still tends toward generic
text. It's used for machine translation but rarely for chat.

---

## The KV Cache: Why the Second Token Is Faster

The most important optimization in LLM inference: the **KV cache**.

### The Problem

In autoregressive generation, to predict token N, you need to run
attention over all N-1 previous tokens. Each token computes Q, K, and
V vectors and attends to all previous K and V vectors.

Without caching, predicting token 100 requires recomputing the K and V
vectors for tokens 1-99. Predicting token 101 requires recomputing
them for tokens 1-100. That's enormous redundant work.

### The Solution

Cache the K and V vectors from all previous tokens. When generating
token N, only compute the NEW Q, K, V for token N, then attend to the
cached K and V from tokens 1 through N-1.

```
WITHOUT KV cache (wasteful):

Generating token 5:
  Compute Q, K, V for tokens 1, 2, 3, 4   ← redundant!
  Compute Q, K, V for token 5              ← new
  Attend token 5 to all others

Generating token 6:
  Compute Q, K, V for tokens 1, 2, 3, 4, 5  ← redundant!
  Compute Q, K, V for token 6                ← new
  Attend token 6 to all others


WITH KV cache (efficient):

Generating token 5:
  Look up cached K, V for tokens 1, 2, 3, 4  ← from cache!
  Compute Q, K, V for token 5                 ← new
  Cache K, V for token 5
  Attend token 5's Q to all cached K, V

Generating token 6:
  Look up cached K, V for tokens 1, 2, 3, 4, 5  ← from cache!
  Compute Q, K, V for token 6                    ← new
  Cache K, V for token 6
  Attend token 6's Q to all cached K, V
```

### The Speed Difference

```
Without KV cache:  O(n²) total computation for n tokens
With KV cache:     O(n) total computation for n tokens

For a 1000-token response:
  Without cache: ~1,000,000 units of work
  With cache:    ~1,000 units of work
  Speedup:       ~1000x
```

### The Memory Cost

The KV cache uses significant memory. For a 70B parameter model with
a 4K context window:

```
KV cache size per token:
  2 (K and V) × num_layers × d_model × sizeof(float16)
  = 2 × 80 × 8192 × 2 bytes
  = 2.6 MB per token

For 4K context: 2.6 MB × 4096 = ~10.5 GB
For 100K context: 2.6 MB × 100K = ~260 GB

The KV cache can be LARGER than the model itself!
```

This is one reason context windows are limited. Longer context means
more KV cache memory, which means fewer requests can be served
simultaneously.

---

## Prefill vs Decode: Two Different Workloads

LLM inference has two distinct phases with very different performance
characteristics:

```
Phase 1: PREFILL (process the prompt)
  ┌─────────────────────────────────────────────────┐
  │  All prompt tokens processed IN PARALLEL        │
  │  Like a regular neural network forward pass     │
  │  COMPUTE-BOUND (lots of math, GPUs stay busy)   │
  │  Fast: processes thousands of tokens per second  │
  └─────────────────────────────────────────────────┘

Phase 2: DECODE (generate the response)
  ┌─────────────────────────────────────────────────┐
  │  One token generated at a time                  │
  │  Each step needs full attention over all prior  │
  │  MEMORY-BOUND (loading weights from memory)      │
  │  Slow: generates 30-100 tokens per second       │
  └─────────────────────────────────────────────────┘
```

This is why you see a pause before the response starts streaming
(prefill), then a steady stream of tokens (decode).

**Analogy:** Prefill is like reading a book chapter (fast, parallel
processing of all the text). Decode is like writing a response letter
(slow, one word at a time).

### Time to First Token (TTFT) vs Throughput

```
                    Prefill              Decode
                    (prompt)             (response)
                    ┌─────────────┐      ┌──────────────────────┐
User sends message  │ Processing  │      │ T  o  k  e  n  s    │
──────────────────► │ all prompt  │ ───► │ streaming out one    │
                    │ tokens      │      │ at a time            │
                    └─────────────┘      └──────────────────────┘
                    │← TTFT ──────│      │← Token throughput ──│

TTFT (Time to First Token): How long until the first word appears
Token throughput: How fast subsequent tokens stream
```

For user experience:
- Low TTFT = responsive (the assistant starts replying quickly)
- High throughput = fast completion (the full response arrives quickly)

---

## Speculative Decoding: A Clever Speed Trick

The bottleneck of autoregressive generation: one token at a time,
with the full model. Speculative decoding works around this.

### The Idea

Use a small, fast "draft" model to guess several tokens ahead. Then
verify all guesses simultaneously with the large model.

```
Traditional (token by token):
  Big model: "The" → "capital" → "of" → "France" → "is" → "Paris"
  6 sequential forward passes through the big model

Speculative decoding:
  Small model drafts: "The capital of France is Paris"
  Big model verifies all 6 tokens IN PARALLEL (one forward pass)
  If big model agrees: accept all 6 tokens at once!
  If big model disagrees at position 4:
    Accept tokens 1-3, resample position 4 from big model
```

```
┌──────────────────────────────────────────────────┐
│            Speculative Decoding                   │
│                                                   │
│  Draft model (7B):  Fast, less accurate           │
│  "The capital of France is Paris"                 │
│                                                   │
│  Target model (70B): Slow, more accurate          │
│  Verify: ✓    ✓      ✓  ✓      ✓  ✓              │
│                                                   │
│  All accepted! Got 6 tokens for the cost of       │
│  1 big-model forward pass + 6 small-model passes  │
│                                                   │
│  Typical speedup: 2-3x                            │
└──────────────────────────────────────────────────┘
```

The key insight: verifying N tokens in parallel costs the same as
generating 1 token (because the big model processes sequences in
parallel during prefill). So if the small model guesses right most
of the time, you get a big speedup.

**Analogy:** A junior developer (draft model) writes code, a senior
developer (target model) reviews it. If the junior is good, the
senior approves entire functions at once. If the junior makes a
mistake, the senior corrects just that part. Either way, faster than
the senior writing everything from scratch.

---

## Batching: Serving Multiple Users

A single GPU generating text for one user is incredibly wasteful.
During decode, the GPU is mostly idle, waiting to load model weights
from memory. **Batching** serves multiple requests simultaneously.

```
Without batching:                With batching:

User A: generate token           Users A, B, C, D: generate tokens
  GPU: 5% utilized               GPU: 40% utilized
  Wait...
User B: generate token           Cost per user: 4x cheaper
  GPU: 5% utilized               Throughput: 4x higher
  Wait...                        Latency: slightly higher per user
```

### Continuous Batching

Requests arrive and finish at different times. **Continuous batching**
dynamically adds and removes requests from the batch:

```
Time →
         ┌───────────────────────┐
User A:  │ prefill │ decode ████│ done
         └─────────┴────────────┘
              ┌───────────────────────────────┐
User B:       │ prefill │ decode █████████████│ done
              └─────────┴────────────────────┘
                   ┌─────────────────┐
User C:            │ pf │ decode ████│ done
                   └────┴───────────┘
                        ┌──────────────────────────┐
User D:                 │ prefill │ decode █████████│
                        └─────────┴────────────────┘

Users enter and leave the batch dynamically.
No user has to wait for others to finish.
```

---

## Quantization: Making Models Smaller

Full-precision model weights use float16 (16 bits per number). For a
70B parameter model, that's 140 GB of memory -- more than any single
GPU has. **Quantization** reduces the precision to fit models on
smaller hardware.

```
┌───────────┬──────┬──────────┬──────────────────────────────┐
│ Precision │ Bits │ 70B Size │ Quality Impact               │
├───────────┼──────┼──────────┼──────────────────────────────┤
│ float32   │ 32   │ 280 GB   │ Baseline (training)          │
│ float16   │ 16   │ 140 GB   │ Negligible loss              │
│ int8      │ 8    │ 70 GB    │ Very minor loss (~1%)        │
│ int4      │ 4    │ 35 GB    │ Small loss (~3-5%)           │
│ int3      │ 3    │ 26 GB    │ Noticeable loss              │
│ int2      │ 2    │ 17.5 GB  │ Significant loss             │
└───────────┴──────┴──────────┴──────────────────────────────┘
```

### How Quantization Works (Simplified)

Original float16 weight: 0.0234375

Map to int8 (256 possible values): round to nearest in a scaled range

```
float16: [−1.0, −0.996, ..., 0.0234375, ..., 0.996, 1.0]
          65,536 possible values, high precision

int8:    [−1.0, −0.992, ..., 0.024, ..., 0.992, 1.0]
          256 possible values, lower precision but close enough

int4:    [−1.0, −0.867, ..., 0.067, ..., 0.867, 1.0]
          16 possible values, notably less precise
```

Modern quantization techniques (GPTQ, AWQ) are more sophisticated --
they quantize different parts of the model to different precisions
based on sensitivity analysis.

### Running Models Locally

Quantization is what makes it possible to run LLMs on consumer
hardware:

```
┌───────────────────┬──────────────┬─────────────────────┐
│ Model             │ Quantization │ Hardware Required     │
├───────────────────┼──────────────┼─────────────────────┤
│ Llama 3 8B        │ int4 (Q4)    │ 6 GB VRAM (laptop)  │
│ Llama 3 70B       │ int4 (Q4)    │ 40 GB VRAM          │
│ Mistral 7B        │ int4 (Q4)    │ 6 GB VRAM (laptop)  │
│ Mixtral 8x7B      │ int4 (Q4)    │ 26 GB VRAM          │
└───────────────────┴──────────────┴─────────────────────┘

Tools: llama.cpp, ollama, vLLM, TGI
Formats: GGUF, GPTQ, AWQ, EXL2
```

```bash
# Run a quantized model locally with ollama
ollama run llama3:70b-q4

# Or with llama.cpp
./main -m llama-3-70b-Q4_K_M.gguf -p "Hello, world!" -n 100
```

---

## The Full Inference Pipeline

Putting it all together, here's what happens when you send a message
to an LLM API:

```
1. Your message arrives at the API server

2. TOKENIZATION
   "What is the capital of France?" →
   [2, 1841, 374, 279, 6864, 315, 9822, 30]

3. PREFILL (process prompt)
   All tokens processed in parallel
   KV cache populated for all prompt tokens
   Time: 50-500ms depending on prompt length

4. DECODE LOOP (generate response)
   For each new token:
     a. Run forward pass (Q for new token, K/V from cache)
     b. Get logits for next token
     c. Apply temperature, top-p, top-k
     d. Sample next token
     e. Add new K, V to cache
     f. Stream token to user
     g. Check stopping conditions
   Time: 10-40ms per token

5. DETOKENIZATION
   [791, 6864, 315, 9822, 374, 12366, 13] →
   "The capital of France is Paris."

6. Response streamed back to you
```

### Why Streaming Matters

Without streaming, you'd wait for the entire response (potentially
30+ seconds for a long response). Streaming sends each token as it's
generated, making the interaction feel responsive even though the
total generation time is the same.

```
Without streaming:
  User sends message → [..........30 seconds..........] → Full response

With streaming:
  User sends message → [100ms] → "The" "capital" "of" "France" ...
  (tokens appear one by one as they're generated)
```

---

## Performance Benchmarks

Typical inference performance for a 70B parameter model:

```
┌────────────────────┬──────────────┬────────────────────┐
│ Metric             │ Typical      │ What Affects It    │
├────────────────────┼──────────────┼────────────────────┤
│ TTFT (short prompt)│ 100-300 ms   │ Model size, GPU    │
│ TTFT (long prompt) │ 1-10 sec     │ Prompt length      │
│ Decode speed       │ 30-100 tok/s │ GPU, quantization  │
│ Batch throughput   │ 1000+ tok/s  │ Batch size, GPU    │
│ Memory usage       │ 35-140 GB    │ Quantization level │
└────────────────────┴──────────────┴────────────────────┘

Note: 30-100 tokens/second ≈ 22-75 words/second
A typical human reads at about 4 words/second
```

---

## Thought Experiments

1. **Temperature Intuition:** You're building a coding assistant. The
   user asks for a function to sort a list. What temperature would
   you use? Now the user asks for a creative name for their startup.
   Different temperature? Why?

2. **The KV Cache Tradeoff:** A 200K token context window needs ~520 GB
   of KV cache per request. If your GPU has 80 GB, how many concurrent
   users can you serve with a 200K context? What about a 4K context?
   How does this affect pricing?

3. **Speculative Decoding Failure:** When would speculative decoding
   NOT help? Think about scenarios where the small draft model would
   disagree with the large model most of the time.

4. **Quantization Quality:** You quantize a model from float16 to int4.
   Where would you expect the most quality loss: factual Q&A, creative
   writing, or code generation? Why?

5. **The Streaming UX:** Streaming makes the AI feel faster, but the
   total time is the same. Is this psychologically honest? Compare
   to a progress bar that's also "just" a UX trick.

---

## Key Takeaways

1. **Autoregressive generation** produces one token at a time, each
   depending on all previous tokens. This is inherently sequential.
2. **Temperature** controls randomness (0 = deterministic, 1 = standard,
   >1 = creative/chaotic).
3. **Top-p sampling** adapts the candidate pool to the model's
   confidence. Better than fixed top-k.
4. **The KV cache** avoids recomputing attention for past tokens,
   providing roughly 1000x speedup for long sequences.
5. **Prefill is compute-bound** (fast, parallel). **Decode is memory-
   bound** (slow, sequential).
6. **Speculative decoding** uses a small model to draft and a large
   model to verify, getting 2-3x speedup.
7. **Quantization** shrinks models from float16 to int4, enabling
   local deployment at the cost of minor quality loss.
8. **Batching and streaming** are essential for serving models to many
   users efficiently.

Next: [Lesson 15 — Context Windows, RAG, and Memory](./15-context-rag.md)
