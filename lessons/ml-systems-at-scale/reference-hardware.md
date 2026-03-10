# Reference: GPU/TPU Hardware Comparison

Quick reference for ML training hardware specifications.

---

## NVIDIA GPU Comparison

```
+------------------+----------+----------+----------+----------+----------+
| Specification    | V100     | A100     | H100     | H200     | B200     |
+------------------+----------+----------+----------+----------+----------+
| Architecture     | Volta    | Ampere   | Hopper   | Hopper   | Blackwell|
| Release Year     | 2017     | 2020     | 2022     | 2024     | 2024     |
+------------------+----------+----------+----------+----------+----------+
| FP32 TFLOPS      | 15.7     | 19.5     | 67       | 67       | 90       |
| TF32 TFLOPS      | --       | 156      | 495      | 495      | 1,125    |
| FP16 TFLOPS      | 125      | 312      | 989      | 989      | 2,250    |
| BF16 TFLOPS      | --       | 312      | 989      | 989      | 2,250    |
| FP8 TFLOPS       | --       | --       | 1,979    | 1,979    | 4,500    |
| INT8 TOPS        | --       | 624      | 1,979    | 1,979    | 4,500    |
+------------------+----------+----------+----------+----------+----------+
| HBM Type         | HBM2     | HBM2e    | HBM3     | HBM3e   | HBM3e   |
| HBM Capacity     | 32 GB    | 80 GB    | 80 GB    | 141 GB   | 192 GB   |
| HBM Bandwidth    | 900 GB/s | 2 TB/s   | 3.35 TB/s| 4.8 TB/s | 8 TB/s  |
+------------------+----------+----------+----------+----------+----------+
| TDP (Watts)      | 300W     | 400W     | 700W     | 700W     | 1000W    |
| Transistors      | 21.1B    | 54.2B    | 80B      | 80B      | 208B     |
| Process Node     | 12nm     | 7nm      | 4nm      | 4nm      | 4nm      |
+------------------+----------+----------+----------+----------+----------+
```

---

## Interconnect Comparison

```
+------------------+----------+----------+----------+----------+----------+
| Interconnect     | V100     | A100     | H100     | H200     | B200     |
+------------------+----------+----------+----------+----------+----------+
| NVLink Version   | NVLink 2 | NVLink 3 | NVLink 4 | NVLink 4 | NVLink 5|
| NVLink BW        | 300 GB/s | 600 GB/s | 900 GB/s | 900 GB/s |1800 GB/s|
| (bidirectional)  |          |          |          |          |          |
+------------------+----------+----------+----------+----------+----------+
| PCIe Version     | PCIe 3.0 | PCIe 4.0 | PCIe 5.0 | PCIe 5.0 | PCIe 5.0|
| PCIe BW          | 32 GB/s  | 64 GB/s  | 128 GB/s | 128 GB/s | 128 GB/s|
| (bidirectional)  |          |          |          |          |          |
+------------------+----------+----------+----------+----------+----------+
| NVLink/PCIe      | 9.4x     | 9.4x     | 7.0x     | 7.0x     | 14.1x   |
| Ratio             |          |          |          |          |          |
+------------------+----------+----------+----------+----------+----------+
```

### InfiniBand Generations

```
+------------------+-----------+------------------+
| Generation       | Rate      | Effective BW     |
+------------------+-----------+------------------+
| HDR              | 200 Gb/s  | 25 GB/s          |
| NDR              | 400 Gb/s  | 50 GB/s          |
| XDR              | 800 Gb/s  | 100 GB/s         |
+------------------+-----------+------------------+

Note: 1 byte = 8 bits. Effective bandwidth accounts for
encoding overhead (~3-5%).
```

---

## DGX Systems

```
+------------------+------------------+------------------+
| System           | DGX A100         | DGX H100         |
+------------------+------------------+------------------+
| GPUs             | 8x A100 80GB     | 8x H100 80GB     |
| Total GPU Memory | 640 GB           | 640 GB            |
| GPU Interconnect | NVSwitch (600GB/s)| NVSwitch (900GB/s)|
| CPU              | 2x AMD EPYC 7742 | 2x Intel Xeon     |
| System Memory    | 2 TB DDR4        | 2 TB DDR5         |
| Storage          | 30 TB NVMe       | 30 TB NVMe        |
| Network          | 8x HDR IB        | 8x NDR IB         |
|                  | (200 Gb/s each)  | (400 Gb/s each)   |
| Total Network BW | 200 GB/s         | 400 GB/s          |
| Power            | 6.5 kW           | 10.2 kW           |
| List Price       | ~$200K           | ~$300K            |
+------------------+------------------+------------------+
```

---

## Google TPU Comparison

```
+------------------+----------+----------+----------+----------+
| Specification    | TPU v3   | TPU v4   | TPU v5e  | TPU v5p  |
+------------------+----------+----------+----------+----------+
| Release Year     | 2018     | 2021     | 2023     | 2023     |
+------------------+----------+----------+----------+----------+
| BF16 TFLOPS      | 123      | 275      | 197      | 459      |
| INT8 TOPS        | --       | --       | 394      | 918      |
| HBM Capacity     | 16 GB    | 32 GB    | 16 GB    | 95 GB    |
| HBM Bandwidth    | 900 GB/s | 1.2 TB/s | 820 GB/s | 2.76 TB/s|
+------------------+----------+----------+----------+----------+
| ICI BW per chip  | 656 GB/s | 1.1 TB/s | 1.6 TB/s | 4.8 TB/s |
| Max Pod Size     | 1024     | 4096     | 256      | 8960     |
| chips            | chips    | chips    | chips    | chips    |
+------------------+----------+----------+----------+----------+
| TDP per chip     | ~200W    | ~170W    | ~100W    | ~200W    |
| Topology         | 2D torus | 3D torus | 2D torus | 3D torus |
+------------------+----------+----------+----------+----------+

Note: TPU v5e is optimized for cost efficiency (inference + training).
      TPU v5p is optimized for training performance.
```

---

## Memory Budget Calculator

```
For a transformer with P parameters:

FP32 training (baseline):
  Parameters:     4P bytes
  Gradients:      4P bytes
  Adam optimizer: 8P bytes (momentum + variance)
  Total:          16P bytes + activations

BF16 mixed precision:
  Parameters:     2P bytes
  Gradients:      2P bytes
  Adam optimizer: 12P bytes (FP32 master + momentum + variance)
  Total:          16P bytes + activations (no savings in total!)

  BUT: activations are in BF16 (half the memory)

BF16 with FSDP (ZeRO-3) across N GPUs:
  Per GPU:        16P / N bytes + activations
  Example: 7B model, N=8: 16 * 7e9 / 8 = 14 GB + activations

Quick reference:
+----------+--------+--------+--------+--------+--------+
| Model    | FP32   | BF16   | FSDP   | FSDP   | FSDP   |
| Size     | Total  | Total  | 8 GPUs | 32 GPUs| 64 GPUs|
+----------+--------+--------+--------+--------+--------+
| 1.3B     | 20.8GB | 20.8GB | 2.6 GB | 0.65 GB| 0.33 GB|
| 7B       | 112 GB | 112 GB | 14 GB  | 3.5 GB | 1.75 GB|
| 13B      | 208 GB | 208 GB | 26 GB  | 6.5 GB | 3.25 GB|
| 30B      | 480 GB | 480 GB | 60 GB  | 15 GB  | 7.5 GB |
| 70B      | 1120GB | 1120GB | 140 GB | 35 GB  | 17.5 GB|
| 175B     | 2800GB | 2800GB | 350 GB | 87.5 GB| 43.75GB|
+----------+--------+--------+--------+--------+--------+

  Note: These are optimizer + parameters + gradients only.
  Add activation memory (depends on batch size and seq length).
```

---

## Activation Memory Estimates

```
Per-layer activation memory for a transformer:

  Attention:
    QKV projections:  3 * B * S * H * dtype_size
    Attention scores: B * num_heads * S * S * dtype_size
    Attention output: B * S * H * dtype_size

  MLP:
    Gate/Up proj:     2 * B * S * intermediate * dtype_size
    Down proj input:  B * S * intermediate * dtype_size

  Where:
    B = batch size
    S = sequence length
    H = hidden dimension
    dtype_size = 2 bytes (BF16) or 4 bytes (FP32)

Example (1 layer, B=4, S=2048, H=4096, BF16):
  Attention (no Flash):  3*4*2048*4096*2 + 4*32*2048*2048*2 + 4*2048*4096*2
                       = 100 MB + 1 GB + 67 MB ≈ 1.2 GB
  Attention (Flash):     ~100 MB (scores not materialized)
  MLP:                   2*4*2048*11008*2 + 4*2048*11008*2
                       = 360 MB + 180 MB = 540 MB
  Total per layer:       ~640 MB (with Flash Attention)
  24 layers:             ~15 GB

  With activation checkpointing (every 4 layers):
  Stored: 6 layers worth = ~3.8 GB (recompute the rest)
```

---

## Bandwidth Requirements for Distributed Training

```
All-Reduce bandwidth needed (ring algorithm):

  Data size D, N GPUs:
  Bytes per GPU ≈ 2D (for large N)
  Time = 2D / bandwidth

+----------+--------+--------+--------+-----------+-----------+
| Model    | D(BF16)| NVLink | IB NDR | NVLink    | IB NDR    |
|          |        |900GB/s | 50GB/s | Time      | Time      |
+----------+--------+--------+--------+-----------+-----------+
| 1.3B     | 2.6 GB |  ✓     |  ✓     | 5.8 ms    | 104 ms    |
| 7B       | 14 GB  |  ✓     |  ✓     | 31 ms     | 560 ms    |
| 13B      | 26 GB  |  ✓     |  ✓     | 58 ms     | 1.04 s    |
| 70B      | 140 GB |  ✓     |  ✓     | 311 ms    | 5.6 s     |
+----------+--------+--------+--------+-----------+-----------+

Rule of thumb:
  If communication time > 20% of compute time, your
  parallelism strategy needs adjustment.
```

---

## Cloud GPU Pricing (Approximate, 2024)

```
On-Demand ($/GPU/hour):
+----------+--------+--------+--------+
| GPU      | AWS    | GCP    | Azure  |
+----------+--------+--------+--------+
| A100 40G | $3.67  | $2.95  | $3.40  |
| A100 80G | $4.10  | $3.67  | $3.67  |
| H100 80G | $5.32  | $5.07  | $5.10  |
+----------+--------+--------+--------+

Spot/Preemptible ($/GPU/hour, varies widely):
+----------+--------+--------+--------+
| GPU      | AWS    | GCP    | Azure  |
+----------+--------+--------+--------+
| A100 80G | ~$1.50 | ~$1.10 | ~$1.47 |
| H100 80G | ~$2.50 | ~$2.00 | ~$2.55 |
+----------+--------+--------+--------+

Reserved (1-year, $/GPU/hour equivalent):
+----------+--------+--------+--------+
| GPU      | AWS    | GCP    | Azure  |
+----------+--------+--------+--------+
| A100 80G | ~$2.70 | ~$2.20 | ~$2.50 |
| H100 80G | ~$3.50 | ~$3.00 | ~$3.40 |
+----------+--------+--------+--------+

Note: Prices change frequently. Check provider pricing
pages for current rates. Multi-GPU instances (e.g., 8x H100)
often have slight per-GPU discounts.
```
