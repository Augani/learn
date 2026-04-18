# Cost Calculator Reference — Quick-Reference Tables and Formulas

Use this reference for back-of-envelope training cost estimates.
All numbers are approximate and based on 2024 pricing.

---

## Core Formulas

```
Total FLOPS:
  C = 6 × N × D

  N = number of parameters
  D = number of training tokens
  6 = forward (2) + backward (4) FLOPS per parameter per token


GPU-Hours:
  GPU_hours = C / (GPU_FLOPS × MFU × 3600)

  GPU_FLOPS = peak FLOPS of one GPU (BF16)
  MFU = Model FLOPS Utilization (typically 0.30-0.55)


Training Cost:
  Cost = GPU_hours × $/GPU-hour


Wall-Clock Time:
  Days = GPU_hours / (num_GPUs × 24)


Chinchilla-Optimal Tokens:
  D_optimal = 20 × N


Chinchilla-Optimal Compute:
  C_optimal = 6 × N × 20N = 120 × N²


Model Memory (inference, BF16):
  Memory_GB = N × 2 / (1024³)
  (2 bytes per parameter in BF16)


Model Memory (training, BF16 + Adam FP32):
  Memory_GB = N × (2 + 2 + 4 + 4) / (1024³)
  = N × 12 / (1024³)
  (params + grads + adam_m + adam_v)
```

---

## GPU Specifications

```
┌──────────────┬──────────┬──────────┬──────────┬──────────┐
│  GPU         │  Memory  │  BF16    │  FP32    │  Interconn│
│              │  (GB)    │  TFLOPS  │  TFLOPS  │  (GB/s)  │
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│  V100 16GB   │  16      │  125*    │  15.7    │  300     │
│  V100 32GB   │  32      │  125*    │  15.7    │  300     │
│  A100 40GB   │  40      │  312     │  19.5    │  600     │
│  A100 80GB   │  80      │  312     │  19.5    │  600     │
│  H100 SXM    │  80      │  990     │  67      │  900     │
│  H100 PCIe   │  80      │  756     │  51      │  600     │
│  B200        │  192     │  2,250   │  180     │  1,800   │
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│  TPU v4      │  32      │  275     │  275     │  ─       │
│  TPU v5e     │  16      │  197     │  197     │  ─       │
│  TPU v5p     │  95      │  459     │  459     │  ─       │
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│  AMD MI300X  │  192     │  1,307   │  163     │  896     │
│  Apple M2 U  │  192**   │  27      │  3.6     │  ─       │
└──────────────┴──────────┴──────────┴──────────┴──────────┘

  * V100 uses FP16 (no native BF16), with tensor cores
  ** Apple M2 Ultra uses unified memory (shared CPU/GPU)
  Interconnect = NVLink bandwidth (bidirectional)
```

---

## Cloud GPU Pricing (On-Demand, 2024)

```
┌──────────────┬──────────┬──────────┬──────────┬──────────┐
│  GPU         │  AWS     │  GCP     │  Azure   │  Lambda  │
│              │  ($/hr)  │  ($/hr)  │  ($/hr)  │  ($/hr)  │
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│  A100 40GB   │  $4.10   │  $3.67   │  $3.40   │  $1.10   │
│  A100 80GB   │  $5.12   │  $5.07   │  $4.50   │  $1.29   │
│  H100 80GB   │  $8.25   │  $8.86   │  $7.35   │  $2.49   │
└──────────────┴──────────┴──────────┴──────────┴──────────┘

  Spot/Preemptible: ~60-70% discount (can be interrupted)
  Reserved (1yr):   ~30-40% discount
  Reserved (3yr):   ~50-60% discount

  Note: Prices change frequently. Always check current pricing.
```

---

## FLOPS-per-Dollar

```
FLOPS per dollar (BF16, on-demand, 40% MFU):

┌──────────────┬──────────┬──────────┬──────────────────┐
│  GPU         │  $/hr    │  Eff.    │  TFLOPS/$        │
│              │          │  TFLOPS  │  (higher=better) │
├──────────────┼──────────┼──────────┼──────────────────┤
│  A100 (AWS)  │  $5.12   │  125     │  24.4            │
│  A100 (Lamb) │  $1.29   │  125     │  96.9            │
│  H100 (AWS)  │  $8.25   │  396     │  48.0            │
│  H100 (Lamb) │  $2.49   │  396     │  159.0           │
│  H100 (spot) │  $2.50   │  396     │  158.4           │
└──────────────┴──────────┴──────────┴──────────────────┘

  Effective TFLOPS = Peak BF16 TFLOPS × MFU (0.40)
```

---

## Quick Cost Lookup Table

Training cost estimates (H100, $3.50/hr, 40% MFU, Chinchilla-optimal):

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  Model   │ Tokens   │ GPU-hrs  │ Cost     │ 256 GPUs │
│  Size    │ (20×N)   │          │          │ (days)   │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│  100M    │  2B      │  8       │  $30     │  <0.01   │
│  500M    │  10B     │  210     │  $740    │  0.03    │
│  1B      │  20B     │  840     │  $2,940  │  0.14    │
│  3B      │  60B     │  7,600   │  $26,500 │  1.2     │
│  7B      │  140B    │  41,200  │  $144K   │  6.7     │
│  13B     │  260B    │  142,000 │  $497K   │  23      │
│  30B     │  600B    │  756,000 │  $2.6M   │  123     │
│  70B     │  1.4T    │  4.1M    │  $14.4M  │  670     │
│  175B    │  3.5T    │  25.7M   │  $90M    │  4,180   │
└──────────┴──────────┴──────────┴──────────┴──────────┘

  For over-trained models (e.g., LLaMA-style):
  Multiply cost by (actual_tokens / chinchilla_tokens)

  Example: 7B model on 2T tokens (vs 140B Chinchilla)
  Over-training factor: 2T / 140B = 14.3×
  Cost: $144K × 14.3 ≈ $2.1M
```

---

## Memory Requirements

```
Model memory by precision:

┌──────────┬──────────┬──────────┬──────────┬──────────┐
│  Model   │  FP32    │  BF16    │  INT8    │  INT4    │
│  Size    │  (GB)    │  (GB)    │  (GB)    │  (GB)    │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│  1B      │  4.0     │  2.0     │  1.0     │  0.5     │
│  3B      │  12.0    │  6.0     │  3.0     │  1.5     │
│  7B      │  28.0    │  14.0    │  7.0     │  3.5     │
│  13B     │  52.0    │  26.0    │  13.0    │  6.5     │
│  30B     │  120.0   │  60.0    │  30.0    │  15.0    │
│  70B     │  280.0   │  140.0   │  70.0    │  35.0    │
│  175B    │  700.0   │  350.0   │  175.0   │  87.5    │
└──────────┴──────────┴──────────┴──────────┴──────────┘

  Training memory (BF16 mixed precision, Adam optimizer):
  ~12-16 bytes per parameter (params + grads + optimizer)
  Plus activations (~2-4× model size depending on batch/seq)

  Rule of thumb for training:
  Total GPU memory needed ≈ 16 × model_size_BF16
```

---

## Training Time Estimates

```
Wall-clock time (256 × H100, 40% MFU, Chinchilla-optimal):

┌──────────┬──────────┬──────────┐
│  Model   │ Tokens   │ Days     │
├──────────┼──────────┼──────────┤
│  1B      │  20B     │  0.1     │
│  3B      │  60B     │  1.2     │
│  7B      │  140B    │  6.7     │
│  13B     │  260B    │  23      │
│  70B     │  1.4T    │  670     │
└──────────┴──────────┴──────────┘

  To scale for different cluster sizes:
  days_new = days_256 × (256 / num_gpus)

  Example: 7B on 64 GPUs = 6.7 × (256/64) = 26.8 days
```

---

## Useful Conversions

```
1 PFLOP  = 10^15 FLOPS
1 EFLOP  = 10^18 FLOPS
1 PFLOP-day = 10^15 × 86,400 = 8.64 × 10^19 FLOPS

1 TB = 10^12 bytes
1 trillion tokens ≈ 4 TB of text (at ~4 chars/token)

1 GPU-year = 8,760 GPU-hours
1 H100-year ≈ 3.12 × 10^21 BF16 FLOPS (at 100% utilization)
            ≈ 1.25 × 10^21 BF16 FLOPS (at 40% MFU)
```

---

## Cost Estimation Checklist

```
□  Calculate total FLOPS: C = 6 × N × D
□  Choose GPU type and look up BF16 FLOPS
□  Estimate MFU (0.30-0.55, use 0.40 as default)
□  Calculate GPU-hours: C / (GPU_FLOPS × MFU × 3600)
□  Look up cloud pricing for chosen GPU
□  Calculate raw GPU cost: GPU-hours × $/hr
□  Add overhead multiplier (1.2-1.5×) for:
   □  Failed runs and restarts
   □  Hyperparameter tuning
   □  Evaluation runs
   □  Data preparation compute
□  Add storage costs (checkpoints, data)
□  Add networking/data transfer costs
□  Verify total fits within budget
□  Verify wall-clock time fits within timeline
```
