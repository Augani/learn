# Lesson 05: Scaling and Compute Terminology — Measuring the Machine

Training a large model is an industrial operation. This lesson defines
the units we use to measure compute, speed, and efficiency — and the
laws that govern how they relate to each other.

---

## FLOPS (Floating Point Operations Per Second)

**Plain English:** A measure of how fast a processor can do math.
More FLOPS = more math per second = faster training.

**Technical definition:** FLOPS (Floating Point Operations Per Second)
measures computational throughput. One FLOP is one floating-point
addition or multiplication. GPU specs list peak FLOPS, but practical
throughput is typically 30–60% of peak due to memory bottlenecks.
Common units: TFLOPS (10¹² FLOPS), PFLOPS (10¹⁵ FLOPS).

**Example:** Think of FLOPS like horsepower in a car. A GPU with
1000 TFLOPS has more "horsepower" than one with 300 TFLOPS — it
can do more math per second.

```
FLOPS comparison:

    ┌──────────┬──────────────┬──────────────┐
    │ Hardware │ FP16 TFLOPS  │ FP8 TFLOPS   │
    ├──────────┼──────────────┼──────────────┤
    │ V100     │ 125          │ N/A          │
    │ A100     │ 312          │ N/A          │
    │ H100     │ 990          │ 1,979        │
    │ B200     │ 2,250        │ 4,500        │
    └──────────┴──────────────┴──────────────┘

    Note: These are peak (tensor core) FLOPS.
    Practical throughput is 30-60% of peak.
```

**Cross-reference:** See [GPU & CUDA Fundamentals, Lesson 06: ML Hardware Landscape](../gpu-cuda-fundamentals/06-ml-hardware-landscape.md) for hardware specs.

---

## GPU-Hours

**Plain English:** One GPU running for one hour. Training a model
might take 100,000 GPU-hours — that is 100 GPUs running for 1,000
hours, or 1,000 GPUs running for 100 hours.

**Technical definition:** A unit of compute resource consumption.
GPU-hours = number_of_GPUs × wall_clock_hours. Used for cost
estimation: cost = GPU-hours × price_per_GPU_hour. Does not account
for GPU utilization — 1 GPU-hour at 50% utilization delivers half
the compute of 1 GPU-hour at 100% utilization.

**Example:** Like person-hours in construction. Building a house
might take 2,000 person-hours. You can use 10 workers for 200 hours
or 100 workers for 20 hours (with some coordination overhead).

```
GPU-hours estimation:

    Training Llama 2 70B:
    Total compute: ~1.7 × 10²⁴ FLOPS
    Hardware: A100 GPUs (~150 TFLOPS practical)

    GPU-hours = total_FLOPS / (FLOPS_per_GPU × 3600)
              = 1.7×10²⁴ / (150×10¹² × 3600)
              ≈ 3,148,000 GPU-hours

    With 2,000 GPUs: 3,148,000 / 2,000 ≈ 1,574 hours ≈ 66 days

    Cost at $2/GPU-hour: 3,148,000 × $2 = ~$6.3M
```

**Cross-reference:** See [Scale & Infrastructure, Lesson 02: Compute Planning](../ml-scale-infrastructure/02-compute-planning.md) for detailed cost estimation.

---

## Tokens Per Second

**Plain English:** How many tokens the model can process (or generate)
each second. Higher = faster inference.

**Technical definition:** For inference, tokens/second measures
generation throughput — the number of output tokens produced per
second. For training, it measures the number of tokens processed
per second across all GPUs. Affected by model size, batch size,
hardware, and optimization techniques (KV cache, speculative
decoding, etc.).

**Example:** A human reads about 4 tokens per second. GPT-4 can
generate about 50–100 tokens per second. A small model on a fast
GPU might generate 500+ tokens per second.

```
Tokens/second benchmarks (approximate):

    ┌──────────────┬──────────┬──────────────────┐
    │ Model        │ Hardware │ Tokens/sec (gen)  │
    ├──────────────┼──────────┼──────────────────┤
    │ Llama 7B     │ A100     │ ~150             │
    │ Llama 70B    │ 8×A100   │ ~30              │
    │ Llama 7B INT4│ RTX 4090 │ ~100             │
    │ GPT-4 (API)  │ Unknown  │ ~50-100          │
    └──────────────┴──────────┴──────────────────┘

    Training throughput (different metric):
    Llama 2 70B training: ~380 tokens/sec/GPU on A100
```

---

## Throughput

**Plain English:** How much total work gets done per unit of time.
For ML, usually measured in tokens/second, samples/second, or
FLOPS achieved.

**Technical definition:** The rate at which a system processes data.
Training throughput is typically measured in tokens/second (for
language models) or samples/second (for vision models) across the
entire cluster. Throughput = batch_size × sequence_length /
time_per_step. Maximizing throughput means maximizing GPU utilization.

**Example:** Like a factory's production rate. A factory that
produces 1,000 widgets per hour has higher throughput than one
producing 500 per hour, even if each widget takes the same time
on the assembly line.

```
Throughput optimization:

    Low throughput:
    GPU ████░░░░░░░░░░░░  25% utilized
        ↑ compute  ↑ waiting for data

    High throughput:
    GPU ████████████████  95% utilized
        ↑ compute overlapped with data loading

    Techniques to improve throughput:
    - Larger batch sizes
    - Data loading pipeline (prefetch)
    - Mixed precision (FP16/BF16)
    - Gradient accumulation
    - Flash attention
```

---

## Latency

**Plain English:** How long it takes to get a single response.
Low latency = fast response. Different from throughput — you can
have high throughput but high latency (batch processing).

**Technical definition:** The time from submitting a request to
receiving the complete response. For LLM inference, two components:
time-to-first-token (TTFT) and inter-token latency (time between
consecutive tokens). Latency is affected by model size, hardware,
batch size, and sequence length.

**Example:** Latency is like the wait time at a restaurant.
Throughput is how many meals the kitchen serves per hour. A busy
kitchen might have high throughput (many meals/hour) but high
latency (long wait per customer).

```
Latency breakdown for LLM inference:

    User sends prompt
         │
         ▼
    ┌─────────────────┐
    │  Prefill phase   │  Process all input tokens at once
    │  (TTFT)          │  Time: proportional to input length
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │  Decode phase    │  Generate tokens one at a time
    │  (per-token)     │  Time: proportional to output length
    └────────┬────────┘
             │
             ▼
    Complete response

    TTFT (Time to First Token): 100ms - 2s (depends on input length)
    Inter-token latency: 10-50ms per token
    Total latency: TTFT + (num_output_tokens × per_token_time)
```

---

## Scaling Laws

**Plain English:** Mathematical relationships that predict how model
performance improves as you increase model size, data, or compute.
They let you plan training runs before spending millions of dollars.

**Technical definition:** Empirical power-law relationships between
model performance (measured as loss) and three factors: number of
parameters (N), dataset size (D), and compute budget (C). The
Kaplan et al. (2020) scaling laws showed L ∝ N^(-0.076) for
parameters and L ∝ D^(-0.095) for data. These relationships hold
across many orders of magnitude.

**Example:** Like knowing that doubling the size of a solar panel
increases power output by a predictable amount. Scaling laws let
you predict "if I 10× the compute, how much better will the model
be?"

```
Scaling law visualization:

    Loss (lower = better)
    │
    │ ╲
    │  ╲
    │   ╲
    │    ╲
    │     ╲
    │      ╲───
    │          ╲───
    │              ╲───────
    │                      ╲──────────
    └──────────────────────────────────
    10⁸  10⁹  10¹⁰  10¹¹  10¹²  10¹³
              Parameters (log scale)

    Key insight: performance improves as a power law
    with model size — but with diminishing returns.
    Going from 1B to 10B helps more than 10B to 100B.
```

**Cross-reference:** See [LLMs & Transformers, Lesson 11: Scaling Laws](../llms-transformers/11-scaling-laws.md) for the full treatment.

---

## Chinchilla-Optimal

**Plain English:** The ideal balance between model size and training
data. The Chinchilla paper showed that most models were too big for
their training data — you get better results with a smaller model
trained on more data.

**Technical definition:** The Hoffmann et al. (2022) "Chinchilla"
paper showed that for a fixed compute budget, the optimal allocation
is approximately equal scaling of parameters and training tokens:
tokens ≈ 20 × parameters. A "chinchilla-optimal" 7B model should
be trained on ~140B tokens. Many models are now trained on far more
tokens than chinchilla-optimal (called "over-training") because
inference cost depends on model size, not training data size.

**Example:** Like studying for an exam. Chinchilla says: do not
just read the textbook once (too little data for your brain size).
Read it 20 times. A smaller brain that reads more will outperform
a bigger brain that reads less.

```
Chinchilla-optimal training:

    Compute budget: C (fixed)

    Old approach (Kaplan 2020):
    "Make the model as big as possible"
    → 200B params, 300B tokens ← undertrained!

    Chinchilla approach (Hoffmann 2022):
    "Balance model size and data"
    → 70B params, 1.4T tokens ← same compute, better results!

    Rule of thumb: tokens ≈ 20 × parameters

    ┌──────────┬────────────┬──────────────────┐
    │ Model    │ Parameters │ Training tokens   │
    ├──────────┼────────────┼──────────────────┤
    │ Chinchilla│ 70B       │ 1.4T (20×)       │
    │ Llama 2  │ 70B        │ 2T (29×)         │
    │ Llama 3  │ 70B        │ 15T (214×)       │
    └──────────┴────────────┴──────────────────┘

    Modern trend: "over-train" smaller models on much more
    data than chinchilla-optimal, because inference is cheaper
    with smaller models.
```

**Cross-reference:** See [Scale & Infrastructure, Lesson 02: Compute Planning](../ml-scale-infrastructure/02-compute-planning.md) for applying scaling laws to training plans.

---

## Compute-Optimal Training

**Plain English:** Choosing the model size and data amount that gives
you the best performance for a fixed compute budget.

**Technical definition:** Given a compute budget C, compute-optimal
training finds the (N, D) pair that minimizes loss, where
C ≈ 6ND (the approximate relationship between compute, parameters,
and tokens). The Chinchilla scaling laws provide the optimal ratio,
but practical considerations (inference cost, deployment constraints)
often lead to different choices.

**Example:** Like planning a road trip with a fixed fuel budget.
Compute-optimal means choosing the right car (model size) and route
(data) to get the farthest on your fuel (compute).

```
Compute-optimal decision:

    Fixed budget: 10²² FLOPS

    Option A: 1B model, 833B tokens  → Loss: 2.8
    Option B: 7B model, 119B tokens  → Loss: 2.3  ← compute-optimal
    Option C: 70B model, 12B tokens  → Loss: 2.5  ← undertrained

    C ≈ 6 × N × D
    10²² = 6 × N × D

    Optimal: N and D scale equally with compute
```

---

## MFU (Model FLOPS Utilization)

**Plain English:** What percentage of the GPU's theoretical maximum
compute you are actually using. Higher MFU = more efficient training.

**Technical definition:** MFU = (observed FLOPS) / (peak theoretical
FLOPS). A measure of hardware efficiency during training. Typical
values: 30–60% for large-scale training. Limited by memory bandwidth,
communication overhead, and pipeline bubbles. MFU above 50% is
considered good.

**Example:** Like fuel efficiency in a car. The engine might be
capable of 300 horsepower, but in city driving you only use 50
horsepower (17% utilization). MFU measures how much of the GPU's
power you are actually using.

```
MFU examples:

    ┌──────────────────┬──────────┐
    │ Training setup   │ MFU      │
    ├──────────────────┼──────────┤
    │ Single GPU       │ 40-55%   │
    │ 8 GPUs (1 node)  │ 35-50%   │
    │ 256 GPUs         │ 30-45%   │
    │ 2048 GPUs        │ 25-40%   │
    └──────────────────┴──────────┘

    MFU decreases with more GPUs due to
    communication overhead between nodes.
```

---

## Concept Check Exercises

### Exercise 1: GPU-Hours Calculation

```
You want to train a 3B parameter model on 100B tokens.

a) Total training FLOPS: 6 × 3×10⁹ × 100×10⁹ = ___ FLOPS
b) Using H100 GPUs at 500 TFLOPS practical throughput:
   GPU-seconds: ___ / (500 × 10¹²) = ___ seconds
   GPU-hours: ___ / 3600 = ___
c) With 8 GPUs, wall-clock time: ___ / 8 = ___ hours = ___ days
d) Cost at $3/GPU-hour: ___ GPU-hours × $3 = $___
```

### Exercise 2: Chinchilla-Optimal

```
You have a compute budget of 6 × 10²¹ FLOPS.

Using C ≈ 6 × N × D:
6 × 10²¹ = 6 × N × D
→ N × D = 10²¹

Chinchilla-optimal: D ≈ 20 × N
→ N × 20N = 10²¹
→ 20N² = 10²¹
→ N² = 5 × 10¹⁹
→ N = ___

a) Optimal model size (N): ___ parameters
b) Optimal training tokens (D = 20N): ___ tokens
c) Is a 10B model trained on 100B tokens compute-optimal
   for this budget? Why or why not?
```

### Exercise 3: Throughput vs Latency

```
A serving system processes requests in batches:

    Batch size 1:  Latency = 50ms,  Throughput = 20 req/sec
    Batch size 8:  Latency = 100ms, Throughput = 80 req/sec
    Batch size 32: Latency = 300ms, Throughput = 107 req/sec

a) Which batch size gives the best latency? ___
b) Which gives the best throughput? ___
c) For a real-time chatbot, which would you choose? Why?
d) For batch processing 1M documents, which would you choose? Why?
```

### Exercise 4: Scaling Law Prediction

```
You observe these training results:

    1B model:  loss = 3.2
    3B model:  loss = 2.8
    10B model: loss = 2.4

Assuming loss ∝ N^(-α):
    3.2 / 2.8 = (1/3)^(-α)  → α ≈ ___
    2.8 / 2.4 = (3/10)^(-α) → α ≈ ___

Predict the loss for a 30B model: ___
Predict the loss for a 100B model: ___

(Hint: use log ratios to solve for α)
```

---

Next: [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)
