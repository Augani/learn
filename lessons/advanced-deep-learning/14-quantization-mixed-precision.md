# Lesson 14: Quantization & Mixed Precision

> A high-resolution photo and a compressed JPEG show the same scene.
> The JPEG is 10x smaller and loads faster. You lose some detail,
> but for most purposes it's good enough. Quantization does the
> same thing for neural network weights.

---

## Why Numbers Matter

```
  Neural network weights are just numbers:
  w = 0.0023145675659179688

  FP32 (32 bits per number):
  [0][01110111][00100101110100101000000]
   ^     ^              ^
  sign exponent(8)   mantissa(23)
  Range: +/- 3.4e38, Precision: ~7 decimal digits

  FP16 (16 bits per number):
  [0][01110][0010010111]
  Range: +/- 65504, Precision: ~3.3 decimal digits

  INT8 (8 bits per number):
  [00010111]
  Range: -128 to 127, No fractions

  Size comparison for a 7B parameter model:
  +--------+---------+----------+
  | Format | Per Num | 7B Model |
  +--------+---------+----------+
  | FP32   | 4 bytes | 28 GB    |
  | FP16   | 2 bytes | 14 GB    |
  | INT8   | 1 byte  |  7 GB    |
  | INT4   | 0.5 byte|  3.5 GB  |
  +--------+---------+----------+
```

---

## Mixed Precision Training

Use FP16 for speed, FP32 for stability. Best of both worlds.

```
  Without mixed precision:
  FP32 weights --> FP32 forward --> FP32 backward --> FP32 update
  (Slow, uses lots of memory)

  With mixed precision:
  FP32 weights (master copy)
       |
       v
  FP16 weights (copy) --> FP16 forward --> FP16 backward
                                               |
                                               v
                                     FP32 gradient update
                                     (applied to FP32 master)

  Why keep FP32 master weights?
  Small updates vanish in FP16:
    FP16: 1.0 + 0.00001 = 1.0   (update lost!)
    FP32: 1.0 + 0.00001 = 1.00001 (update preserved)
```

```python
import torch
from torch.cuda.amp import autocast, GradScaler

model = build_model().cuda()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
scaler = GradScaler()

for batch_x, batch_y in dataloader:
    batch_x = batch_x.cuda()
    batch_y = batch_y.cuda()

    optimizer.zero_grad()

    with autocast():
        output = model(batch_x)
        loss = loss_fn(output, batch_y)

    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
```

---

## Loss Scaling -- Why We Need It

```
  FP16 gradient range problem:

  FP16 smallest representable: ~6e-8
  Many gradients in deep networks: 1e-7 to 1e-5

             Representable in FP16
             |<-------------------->|
  ----+------+----------------------+------+----
      |      6e-8                  65504   |
      0                                   inf

      ^^^^^^^^^
      Gradients that vanish to zero in FP16!

  Loss scaling fix:
  1. Multiply loss by scale factor (e.g., 1024)
  2. All gradients are 1024x larger (safely in FP16 range)
  3. Before weight update, divide gradients by 1024
  4. Net effect: same math, no underflow

  Dynamic loss scaling:
  - Start with high scale (65536)
  - If gradients overflow (inf/nan): halve the scale, skip step
  - If N steps with no overflow: double the scale
  - Automatically finds the sweet spot
```

---

## BFloat16 -- The ML-Optimized Format

```
  FP16:    [sign(1)][exponent(5)][mantissa(10)]
  BF16:    [sign(1)][exponent(8)][mantissa(7)]
  FP32:    [sign(1)][exponent(8)][mantissa(23)]

  BF16 has SAME exponent range as FP32!
  This means: same dynamic range, less precision

  +--------+-------------------+------------------+
  | Format | Range             | Precision        |
  +--------+-------------------+------------------+
  | FP32   | +/- 3.4e38       | ~7 decimal digits|
  | FP16   | +/- 65504        | ~3.3 digits      |
  | BF16   | +/- 3.4e38       | ~2.4 digits      |
  +--------+-------------------+------------------+

  Why BF16 is better for training:
  - No loss scaling needed (range matches FP32)
  - Simpler code
  - Slightly less precise but rarely matters in practice
  - Supported on A100, H100, and newer GPUs
```

```python
with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
    output = model(input_tensor)
    loss = loss_fn(output, target)

loss.backward()
optimizer.step()
```

---

## Post-Training Quantization (PTQ)

Quantize an already-trained model. No retraining needed.

```
  FP32 trained model --> Quantize --> INT8 model
                                      (smaller, faster)

  How quantization maps values:

  FP32 range:  [-1.5 ............... +2.3]
  INT8 range:  [-128 ............... +127]

  Linear mapping:
    scale = (max_fp32 - min_fp32) / (max_int8 - min_int8)
    zero_point = round(-min_fp32 / scale) + min_int8

    quantized = round(fp32_value / scale) + zero_point
    dequantized = (quantized - zero_point) * scale

  Example:
    FP32 weights: [0.12, -0.53, 1.21, -1.48, 0.87]
    scale = (1.21 - (-1.48)) / (127 - (-128)) = 0.01055
    zero_point = round(1.48 / 0.01055) - 128 = 12

    Quantized:  [23, -38, 127, -128, 94]
    Dequantized: [0.116, -0.527, 1.213, -1.476, 0.865]
    Error:       small!
```

```python
import torch

def quantize_tensor(tensor, num_bits=8):
    qmin = -(2 ** (num_bits - 1))
    qmax = 2 ** (num_bits - 1) - 1

    min_val = tensor.min()
    max_val = tensor.max()

    scale = (max_val - min_val) / (qmax - qmin)
    if scale == 0:
        scale = torch.tensor(1.0)
    zero_point = qmin - torch.round(min_val / scale)
    zero_point = torch.clamp(zero_point, qmin, qmax)

    quantized = torch.clamp(
        torch.round(tensor / scale + zero_point), qmin, qmax
    ).to(torch.int8)

    return quantized, scale, zero_point


def dequantize_tensor(quantized, scale, zero_point):
    return (quantized.float() - zero_point) * scale


weights = torch.randn(1000, 1000)
q_weights, scale, zp = quantize_tensor(weights)

original_size = weights.nelement() * 4
quantized_size = q_weights.nelement() * 1 + 8
print(f"Compression: {original_size / quantized_size:.1f}x")

reconstructed = dequantize_tensor(q_weights, scale, zp)
error = (weights - reconstructed).abs().mean()
print(f"Mean absolute error: {error:.6f}")
```

---

## GPTQ -- Quantizing Large Language Models

```
  GPTQ: quantizes one layer at a time, using calibration data
  to minimize the quantization error

  +------------+     +------------------+     +------------+
  | Calibration| --> | Layer-by-layer   | --> | INT4 Model |
  | dataset    |     | quantization     |     | (4x smaller|
  | (128 examples)   | with error       |     |  than FP16)|
  +------------+     | compensation     |     +------------+
                     +------------------+

  Key insight: when you quantize one weight, adjust
  remaining weights to compensate for the error
```

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, GPTQConfig

model_name = "meta-llama/Llama-2-7b-hf"
tokenizer = AutoTokenizer.from_pretrained(model_name)

quantization_config = GPTQConfig(
    bits=4,
    dataset="c4",
    tokenizer=tokenizer,
    group_size=128,
)

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=quantization_config,
    device_map="auto",
)

model.save_pretrained("llama-2-7b-gptq-4bit")
```

---

## bitsandbytes -- Easy Quantization

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
import torch

bnb_config_8bit = BitsAndBytesConfig(
    load_in_8bit=True,
)

bnb_config_4bit = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

model_8bit = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    quantization_config=bnb_config_8bit,
    device_map="auto",
)

model_4bit = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    quantization_config=bnb_config_4bit,
    device_map="auto",
)
```

```
  NF4 (NormalFloat4) -- optimized for neural net weights:

  Neural network weights follow a normal distribution:
        ____
       /    \
      /      \
  ___/        \___
  Most weights are near zero, few are large

  NF4 places quantization levels at the quantiles
  of a normal distribution:

  Uniform INT4:  |----|----|----|----|----|----|----|
  NF4:           |--|---|------|------|------|---|--|
                 (more levels near zero where weights cluster)

  Result: better accuracy than uniform INT4
```

---

## QLoRA -- Quantized Fine-Tuning

```
  Problem: Fine-tuning a 7B model needs ~60GB GPU memory

  QLoRA solution:
  1. Load base model in 4-bit (NF4)         --> ~4 GB
  2. Add small LoRA adapters in FP16/BF16   --> ~0.1 GB
  3. Only train the LoRA adapters

  +--------------------------------------------------+
  | Base Model (frozen, 4-bit NF4)                   |
  |                                                  |
  |  Layer: W_q (4-bit) + LoRA_A @ LoRA_B (FP16)   |
  |         ^^^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^       |
  |         frozen        trainable                  |
  +--------------------------------------------------+

  Memory comparison:
  Full fine-tuning FP16:  ~60 GB  (needs 4x A100)
  LoRA FP16:              ~30 GB  (needs 2x A100)
  QLoRA 4-bit:            ~6 GB   (fits on 1 RTX 4090!)
```

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
import torch

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    quantization_config=bnb_config,
    device_map="auto",
)

model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
```

---

## AWQ -- Activation-Aware Weight Quantization

```
  Key insight: not all weights are equally important.
  Weights connected to large activations matter more.

  Standard quantization:
    Treat all weights equally --> some important weights
    get bad quantization --> accuracy drops

  AWQ:
    1. Run calibration data through model
    2. Identify which weights produce large activations
    3. Protect those weights (scale them up before quantizing)
    4. Result: better accuracy at same bit width

  +----------+    +-----------+    +-----------+
  | Calib    | -> | Find      | -> | Quantize  |
  | data     |    | important |    | with      |
  |          |    | weights   |    | protection|
  +----------+    +-----------+    +-----------+
```

---

## Quantization Comparison

```
  +----------+------+----------+----------+------------------+
  | Method   | Bits | Speed    | Quality  | Use Case         |
  +----------+------+----------+----------+------------------+
  | FP32     | 32   | Baseline | Best     | Research         |
  | FP16/BF16| 16   | 2x       | ~Same    | Standard train   |
  | INT8 PTQ | 8    | 2-3x     | Good     | Deployment       |
  | GPTQ     | 4    | 3-4x     | Good     | LLM inference    |
  | AWQ      | 4    | 3-4x     | Better   | LLM inference    |
  | QLoRA    | 4    | N/A      | Tunable  | Fine-tuning      |
  | INT4     | 4    | 3-4x     | OK       | Edge devices     |
  | INT2     | 2    | 4-5x     | Degraded | Extreme edge     |
  +----------+------+----------+----------+------------------+
```

---

## Measuring Quantization Quality

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

def measure_perplexity(model, tokenizer, texts, max_length=512):
    model.eval()
    total_loss = 0.0
    total_tokens = 0

    for text in texts:
        encodings = tokenizer(
            text, return_tensors="pt", truncation=True, max_length=max_length
        )
        input_ids = encodings.input_ids.to(model.device)

        with torch.no_grad():
            outputs = model(input_ids, labels=input_ids)
            total_loss += outputs.loss.item() * input_ids.shape[1]
            total_tokens += input_ids.shape[1]

    avg_loss = total_loss / total_tokens
    perplexity = torch.exp(torch.tensor(avg_loss)).item()
    return perplexity


def compare_quantization(model_name, test_texts):
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    model_fp16 = AutoModelForCausalLM.from_pretrained(
        model_name, torch_dtype=torch.float16, device_map="auto"
    )
    ppl_fp16 = measure_perplexity(model_fp16, tokenizer, test_texts)
    print(f"FP16 perplexity: {ppl_fp16:.2f}")
    del model_fp16

    model_int8 = AutoModelForCausalLM.from_pretrained(
        model_name, load_in_8bit=True, device_map="auto"
    )
    ppl_int8 = measure_perplexity(model_int8, tokenizer, test_texts)
    print(f"INT8 perplexity: {ppl_int8:.2f}")
    print(f"Degradation: {(ppl_int8 - ppl_fp16) / ppl_fp16 * 100:.1f}%")
```

---

## Exercises

1. **Manual quantization**: Implement INT8 quantization for a
   simple neural network. Compare accuracy before and after
   quantization on MNIST.

2. **Mixed precision training**: Train a ResNet on CIFAR-10 with
   and without mixed precision. Compare training speed, memory
   usage, and final accuracy.

3. **BF16 vs FP16**: Train the same model with both formats.
   Does BF16 eliminate the need for loss scaling? Measure the
   difference in training stability.

4. **4-bit LLM**: Load a 7B model with bitsandbytes in 4-bit.
   Measure perplexity on a test set. Compare to FP16 baseline.
   How much quality do you lose?

5. **QLoRA fine-tuning**: Fine-tune a 7B model with QLoRA on a
   small dataset. Compare the fine-tuned model's output quality
   to full FP16 fine-tuning. How close can you get?

---

**Next**: [Lesson 15 - Knowledge Distillation](./15-knowledge-distillation.md)
