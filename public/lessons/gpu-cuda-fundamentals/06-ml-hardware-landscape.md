# Lesson 06: ML Hardware Landscape — GPUs, TPUs, and Beyond

The ML hardware world moves fast. NVIDIA dominates, but Google TPUs,
AMD GPUs, Apple Silicon, and Intel accelerators all have roles to play.
This lesson maps the landscape so you can read a spec sheet, compare
options, and understand what hardware discussions in ML papers actually
mean.

---

## The Core Idea

Different ML workloads need different hardware. Training a 70B parameter
model requires different hardware than running inference on a phone.
The right choice depends on your model size, budget, and deployment
target.

**Analogy: Vehicles for different jobs.** An NVIDIA H100 is a
semi-truck — massive capacity, expensive, built for hauling heavy loads
(training large models). An Apple M3 is a sports car — efficient, fast
for its size, great for personal use (local inference). A Google TPU
pod is a freight train — optimized for one route (matrix multiply) and
incredibly efficient at scale.

```
ML Hardware Landscape:

                    Training Large Models
                           ▲
                           │
              ┌────────────┼────────────┐
              │            │            │
         NVIDIA H100   Google TPU   AMD MI300X
         (datacenter)  (cloud only) (datacenter)
              │            │            │
              │       ┌────┴────┐       │
              │       │ TPU Pod │       │
              │       └─────────┘       │
              │                         │
         NVIDIA A100                    │
              │                         │
         ┌────┴────┐              ┌─────┴─────┐
         │ RTX 4090│              │ AMD MI250  │
         │(prosumer)│             └───────────┘
         └────┬────┘
              │
         ┌────┴────┐    ┌───────────┐
         │RTX 4080 │    │Apple M3/M4│
         │(consumer)│   │  (laptop) │
         └─────────┘    └───────────┘
              │                │
              ▼                ▼
         Local Training    Edge Inference
         / Inference
```

---

## NVIDIA GPU Generations

NVIDIA dominates ML hardware. Here is the evolution:

```
NVIDIA GPU Timeline for ML:

2017 ──► V100 (Volta)
         First tensor cores, 16 GB HBM2
         The GPU that trained BERT and early GPT models

2020 ──► A100 (Ampere)
         3rd gen tensor cores, 40/80 GB HBM2e
         TF32 format, MIG (multi-instance GPU)
         The workhorse of 2020-2023 ML

2022 ──► H100 (Hopper)
         4th gen tensor cores, 80 GB HBM3
         Transformer Engine (FP8), NVLink 4.0
         Built specifically for transformer training

2024 ──► B200 (Blackwell)
         5th gen tensor cores, 192 GB HBM3e
         2nd gen Transformer Engine, NVLink 5.0
         Designed for trillion-parameter models
```

### NVIDIA GPU Comparison

```
┌──────────┬────────┬────────┬────────┬────────┬──────────┐
│          │ V100   │ A100   │ H100   │ B200   │ RTX 4090 │
│          │ (2017) │ (2020) │ (2022) │ (2024) │ (2022)   │
├──────────┼────────┼────────┼────────┼────────┼──────────┤
│ CUDA     │ 5,120  │ 6,912  │ 16,896 │ 18,432 │ 16,384   │
│ Cores    │        │        │        │        │          │
├──────────┼────────┼────────┼────────┼────────┼──────────┤
│ Tensor   │ 640    │ 432    │ 528    │ 576    │ 512      │
│ Cores    │        │        │        │        │          │
├──────────┼────────┼────────┼────────┼────────┼──────────┤
│ Memory   │ 16/32  │ 40/80  │ 80     │ 192    │ 24       │
│ (GB)     │ HBM2   │ HBM2e  │ HBM3   │ HBM3e  │ GDDR6X   │
├──────────┼────────┼────────┼────────┼────────┼──────────┤
│ Bandwidth│ 900    │ 2,039  │ 3,350  │ 8,000  │ 1,008    │
│ (GB/s)   │        │        │        │        │          │
├──────────┼────────┼────────┼────────┼────────┼──────────┤
│ FP16     │ 125    │ 312    │ 1,979  │ 4,500  │ 330      │
│ TFLOPS   │        │        │ (FP8)  │ (FP8)  │          │
├──────────┼────────┼────────┼────────┼────────┼──────────┤
│ TDP      │ 300W   │ 400W   │ 700W   │ 1000W  │ 450W     │
├──────────┼────────┼────────┼────────┼────────┼──────────┤
│ Price    │ ~$5K   │ ~$15K  │ ~$30K  │ ~$40K+ │ ~$1.6K   │
│ (approx) │ (used) │        │        │        │          │
├──────────┼────────┼────────┼────────┼────────┼──────────┤
│ Use Case │Legacy  │General │LLM     │Frontier│Research/ │
│          │training│purpose │training│models  │hobbyist  │
└──────────┴────────┴────────┴────────┴────────┴──────────┘
```

---

## Tensor Cores: The Secret Weapon

Tensor cores are specialized matrix-multiply-accumulate units. They
operate on small matrix tiles (e.g., 4×4 or 16×16) in a single clock
cycle, delivering massive throughput for the operations that dominate
ML workloads.

```
Tensor Core Supported Precisions:

Generation    Supported Formats
──────────    ─────────────────
Volta (V100)  FP16 → FP32 accumulate
Ampere (A100) FP16, BF16, TF32, INT8, INT4
Hopper (H100) FP16, BF16, TF32, FP8, INT8
Blackwell     FP16, BF16, TF32, FP8, FP4, INT8

FP8 on H100:
  ┌─────────────────────────────────────────┐
  │  FP32 matmul:    ~67 TFLOPS             │
  │  FP16 matmul:    ~990 TFLOPS            │
  │  FP8 matmul:     ~1,979 TFLOPS          │
  │                                          │
  │  FP8 is ~30× faster than FP32!          │
  │  This is why mixed precision matters.    │
  └─────────────────────────────────────────┘
```

---

## Google TPUs

Google's Tensor Processing Units are custom ASICs designed specifically
for matrix multiplication. You cannot buy them — they are only available
through Google Cloud.

```
TPU Architecture:

┌─────────────────────────────────────┐
│           TPU Chip                   │
│                                     │
│  ┌───────────────────────────────┐  │
│  │    Matrix Multiply Unit       │  │
│  │    (MXU) — 128×128 systolic   │  │
│  │    array                      │  │
│  │                               │  │
│  │    Optimized for one thing:   │  │
│  │    large matrix multiplies    │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────┐  ┌───────────┐       │
│  │  HBM      │  │  Vector   │       │
│  │  Memory   │  │  Unit     │       │
│  └───────────┘  └───────────┘       │
└─────────────────────────────────────┘

TPU Generations:
┌──────────┬────────┬───────────┬──────────┐
│          │ TPU v4  │ TPU v5e   │ TPU v5p  │
├──────────┼────────┼───────────┼──────────┤
│ BF16     │ 275    │ 197       │ 459      │
│ TFLOPS   │        │           │          │
├──────────┼────────┼───────────┼──────────┤
│ HBM      │ 32 GB  │ 16 GB     │ 95 GB    │
├──────────┼────────┼───────────┼──────────┤
│ Bandwidth│ 1,200  │ 820       │ 2,765    │
│ (GB/s)   │        │           │          │
├──────────┼────────┼───────────┼──────────┤
│ Best for │Training│Inference  │Training  │
│          │at scale│cost-opt   │at scale  │
└──────────┴────────┴───────────┴──────────┘

TPU Pods: up to 8,960 chips connected with high-speed
interconnect. Google uses these to train Gemini.
```

Key differences from GPUs:
- **BF16 native** — TPUs were designed around BF16 from the start
- **Systolic array** — fixed dataflow, extremely efficient for matmul
- **No CUDA** — uses JAX/XLA for programming
- **Cloud only** — cannot buy or self-host

---

## AMD GPUs (ROCm)

AMD's MI-series GPUs are the main NVIDIA alternative for datacenter ML.

```
AMD MI-Series:

┌──────────┬──────────┬──────────┐
│          │ MI250X   │ MI300X   │
├──────────┼──────────┼──────────┤
│ Compute  │ 383      │ 1,307    │
│ (FP16    │ TFLOPS   │ TFLOPS   │
│  TFLOPS) │          │          │
├──────────┼──────────┼──────────┤
│ Memory   │ 128 GB   │ 192 GB   │
│          │ HBM2e    │ HBM3     │
├──────────┼──────────┼──────────┤
│ Bandwidth│ 3,277    │ 5,300    │
│ (GB/s)   │          │          │
├──────────┼──────────┼──────────┤
│ Price    │ ~$15K    │ ~$15K    │
└──────────┴──────────┴──────────┘

Pros: More memory (192 GB MI300X vs 80 GB H100)
      Competitive pricing
Cons: Software ecosystem (ROCm) less mature than CUDA
      Not all PyTorch ops fully optimized
```

---

## Apple Silicon

Apple's M-series chips have a unified memory architecture — CPU, GPU,
and Neural Engine share the same memory pool. Great for local inference,
not designed for large-scale training.

```
Apple Silicon for ML:

┌──────────┬────────┬────────┬────────┐
│          │ M2 Pro │ M3 Max │ M4 Max │
├──────────┼────────┼────────┼────────┤
│ GPU      │ 19     │ 40     │ 40     │
│ Cores    │        │        │        │
├──────────┼────────┼────────┼────────┤
│ Unified  │ 32 GB  │ 128 GB │ 128 GB │
│ Memory   │        │        │        │
├──────────┼────────┼────────┼────────┤
│ Bandwidth│ 200    │ 400    │ 546    │
│ (GB/s)   │        │        │        │
├──────────┼────────┼────────┼────────┤
│ FP16     │ ~6.8   │ ~14.2  │ ~17.4  │
│ TFLOPS   │        │        │        │
├──────────┼────────┼────────┼────────┤
│ Best for │Local   │Local   │Local   │
│          │infer.  │infer.  │infer.  │
│          │small   │7-13B   │7-30B   │
│          │models  │models  │models  │
└──────────┴────────┴────────┴────────┘

Key advantage: 128 GB unified memory means you can
run a 70B model (quantized to 4-bit ≈ 35 GB) on a
laptop. No other consumer hardware can do this.

Key limitation: ~10-50× slower than datacenter GPUs
for training. Not practical for training large models.
```

---

## Intel Gaudi

Intel's Gaudi accelerators target the price-performance sweet spot
for training workloads.

```
Intel Gaudi:

┌──────────┬──────────┬──────────┐
│          │ Gaudi 2  │ Gaudi 3  │
├──────────┼──────────┼──────────┤
│ BF16     │ 432      │ 1,835    │
│ TFLOPS   │          │          │
├──────────┼──────────┼──────────┤
│ Memory   │ 96 GB    │ 128 GB   │
│          │ HBM2e    │ HBM2e    │
├──────────┼──────────┼──────────┤
│ Bandwidth│ 2,460    │ 3,700    │
│ (GB/s)   │          │          │
├──────────┼──────────┼──────────┤
│ Best for │Training  │Training  │
│          │cost-opt  │cost-opt  │
└──────────┴──────────┴──────────┘

Available on AWS (DL1/DL2q instances).
Uses PyTorch with Habana plugin — not CUDA.
```

---

## Choosing Hardware: Decision Framework

```
What are you doing?
       │
       ├── Training a model > 70B parameters
       │   └── NVIDIA H100/B200 cluster or TPU v5p pod
       │
       ├── Training a model 7B-70B parameters
       │   └── 4-8× A100 80GB or H100
       │       or MI300X (if budget-conscious)
       │
       ├── Fine-tuning (LoRA/QLoRA) a 7B-13B model
       │   └── Single A100 40GB, RTX 4090, or RTX 3090
       │
       ├── Inference at scale (serving thousands of users)
       │   └── H100, A100, or TPU v5e (cost-optimized)
       │
       ├── Local inference (personal use)
       │   └── Apple M3/M4 Max (large memory)
       │       or RTX 4090 (faster, less memory)
       │
       └── Learning / experimenting
           └── Google Colab (free T4)
               or RTX 3060 12GB (~$300 used)
```

---

## Exercises

### Exercise 1: Read the Spec Sheet

```
You are evaluating hardware for fine-tuning a 13B parameter model
using QLoRA (4-bit quantization).

1. How much GPU memory do you need?
   (Hint: 13B params × 0.5 bytes/param for 4-bit ≈ 6.5 GB
    plus optimizer states, activations ≈ ~12-16 GB total)

2. Which of these GPUs can handle it?
   - RTX 3060 12GB
   - RTX 4090 24GB
   - A100 40GB
   - Apple M3 Max 128GB

3. Which would you choose and why?
   Consider: cost, speed, availability.
```

### Exercise 2: Cost Comparison

```
You need to train a 7B model for 100 GPU-hours.
Compare the cost on these platforms:

Cloud GPU          $/hour (approx)    Total Cost
─────────          ───────────────    ──────────
A100 40GB (AWS)    ~$3.00/hr          $___
A100 80GB (AWS)    ~$4.50/hr          $___
H100 (Lambda)      ~$2.50/hr          $___
RTX 4090 (own)     ~$0.15/hr (elec)   $___

TODO: Which option is cheapest for a one-time training run?
TODO: At what point does buying your own GPU break even?
```

### Exercise 3: Hardware Evolution

```
Look at the NVIDIA GPU table above.

1. How has memory bandwidth grown from V100 to B200?
   Calculate the ratio.

2. How has FP16 TFLOPS grown from V100 to B200?
   Calculate the ratio.

3. Which grew faster — bandwidth or compute?
   What does this tell you about the memory wall problem?
```

---

Next: [Lesson 07: Memory Management for ML](./07-memory-estimation.md)
