# Lesson 01: Model Sizes and Parameters — What the Numbers Actually Mean

When someone says "Llama 3 has 70 billion parameters," what does that
actually mean? How much memory does it need? How much compute? And
when a model card says "3B active parameters" — active out of what?

This lesson demystifies the numbers behind model sizes.

---

## Parameters

**Plain English:** A parameter is a single number that the model
learned during training. A "7B model" has 7 billion of these numbers.

**Technical definition:** A parameter is a learnable scalar value
(weight or bias) in a neural network. The total parameter count is
the sum of all elements across all weight matrices and bias vectors
in the model. Parameters are stored as floating-point numbers, so
each one occupies 2–4 bytes of memory depending on precision.

**Example:** Think of parameters like the knobs on a massive mixing
board. A 7B parameter model has 7 billion knobs, each set to a
specific position during training. Together, they define everything
the model "knows."

```
A tiny neural network with 15 parameters:

    Input (4)  ──→  Hidden (3)  ──→  Output (1)

    Weight matrix W1: 4 × 3 = 12 parameters
    Bias vector b1:       3 =  3 parameters
                              ──────
                     Total:   15 parameters

    A 7B model is this idea scaled up ~500 million times.
```

**Cross-reference:** See [Math Foundations, Lesson 01: Vectors and Matrices](../math-foundations/01-vectors-matrices.md) for how weight matrices work.

---

## Parameter Count

**Plain English:** The total number of learnable numbers in a model.
Bigger count generally means more capable, but also more expensive.

**Technical definition:** For a given architecture, the parameter
count is calculated by summing the dimensions of all weight tensors.
For a transformer, the dominant terms are the embedding matrix, the
attention weight matrices (Q, K, V, O per layer), the feed-forward
network weights (two matrices per layer), and layer normalization
parameters.

**Example:** A GPT-style transformer with 32 layers, hidden size
4096, and vocabulary 50,000:

```
Calculating parameter count for a transformer:

    Embedding:        vocab × hidden = 50,000 × 4,096 = 204.8M
    Per attention layer:
      Q, K, V, O:    4 × (hidden × hidden) = 4 × 4,096² = 67.1M
    Per FFN layer:
      Up + Down:      2 × (hidden × 4×hidden) = 2 × 4,096 × 16,384 = 134.2M
    Layer norm:       2 × hidden per layer (negligible)

    Per transformer layer: 67.1M + 134.2M ≈ 201.3M
    All 32 layers:         32 × 201.3M ≈ 6,442M ≈ 6.4B
    + Embedding:           204.8M
    + Output head:         204.8M (often tied with embedding)
                           ──────
    Total:                 ≈ 6.8B parameters
```

---

## Model Size (in Memory)

**Plain English:** How much GPU memory the model needs. A 7B model
in FP16 needs about 14 GB just for the weights.

**Technical definition:** Model size in bytes = parameter count ×
bytes per parameter. The bytes per parameter depends on the numerical
precision: FP32 = 4 bytes, FP16/BF16 = 2 bytes, INT8 = 1 byte,
INT4 = 0.5 bytes.

**Example:** Think of it like a warehouse. Each parameter is a box.
FP32 boxes are large (4 units each). INT4 boxes are tiny (half a
unit each). Same number of boxes, but the warehouse size changes
dramatically.

```
Memory for a 7B parameter model:

    Precision    Bytes/param    Total memory
    ─────────    ───────────    ────────────
    FP32         4 bytes        28.0 GB
    FP16/BF16    2 bytes        14.0 GB
    INT8         1 byte          7.0 GB
    INT4         0.5 bytes       3.5 GB

    Formula: memory_GB = parameters × bytes_per_param / (1024³)
             (or approximately: params_in_billions × bytes_per_param)
```

**Cross-reference:** See [GPU & CUDA Fundamentals, Lesson 07: Memory Management for ML](../gpu-cuda-fundamentals/07-memory-estimation.md) for full memory estimation including optimizer states and activations.

---

## Calculating Parameter Counts for Common Architectures

### MLP (Multi-Layer Perceptron)

**Plain English:** A stack of fully connected layers. Each layer
connects every input to every output.

**Technical definition:** For an MLP with layer sizes
[n₀, n₁, n₂, ..., nₖ], the parameter count is
Σᵢ (nᵢ × nᵢ₊₁ + nᵢ₊₁) — each layer has a weight matrix plus
a bias vector.

```
MLP parameter count example:

    Layer sizes: [784, 256, 128, 10]

    Layer 1: 784 × 256 + 256 = 200,960
    Layer 2: 256 × 128 + 128 =  32,896
    Layer 3: 128 × 10  + 10  =   1,290
                                ───────
    Total:                      235,146 parameters
```

```python
# Calculate MLP parameter count
layer_sizes = [784, 256, 128, 10]
total_params = 0
for i in range(len(layer_sizes) - 1):
    weights = layer_sizes[i] * layer_sizes[i + 1]
    biases = layer_sizes[i + 1]
    total_params += weights + biases
    print(f"Layer {i+1}: {layer_sizes[i]}→{layer_sizes[i+1]} = "
          f"{weights:,} weights + {biases:,} biases = {weights + biases:,}")
print(f"Total: {total_params:,} parameters")
```

### CNN (Convolutional Neural Network)

**Plain English:** Uses small sliding filters instead of connecting
everything to everything. Much fewer parameters than an MLP for
image tasks.

**Technical definition:** For a convolutional layer with C_in input
channels, C_out output channels, and kernel size K×K, the parameter
count is C_in × C_out × K × K + C_out (bias).

```
CNN parameter count example:

    Conv layer: 3 input channels, 64 output channels, 3×3 kernel
    Parameters: 3 × 64 × 3 × 3 + 64 = 1,792

    Compare to a fully connected layer on a 224×224×3 image:
    FC: (224 × 224 × 3) × 64 + 64 = 9,634,880

    CNN uses 5,000× fewer parameters for the same input/output!
```

### Transformer

**Plain English:** The architecture behind GPT, Llama, Claude, and
most modern LLMs. Parameter count scales with layers, hidden size,
and vocabulary.

**Technical definition:** See the calculation above. The dominant
terms are the attention matrices (4 × d² per layer) and the FFN
matrices (8 × d² per layer for standard 4× expansion), giving
approximately 12 × d² parameters per layer.

```
Quick transformer parameter estimate:

    params ≈ 12 × num_layers × hidden_size²

    Example: 32 layers, hidden_size 4096
    params ≈ 12 × 32 × 4096² ≈ 6.4B

    (Plus embedding and output head — add vocab × hidden_size)
```

---

## Active Parameters (MoE Models)

**Plain English:** In a Mixture of Experts model, only some parameters
are used for each input. "3B active" means only 3 billion parameters
process any given token, even if the model has 50B+ total.

**Technical definition:** MoE architectures replace the standard
feed-forward network (FFN) in each transformer layer with multiple
"expert" FFNs. A routing mechanism selects the top-k experts (usually
2) for each token. The "active parameter count" is the number of
parameters that participate in a single forward pass. The "total
parameter count" includes all experts.

**Example:** Imagine a hospital with 100 specialist doctors (total
staff), but each patient only sees 2 doctors per visit (active staff).
The hospital's total capacity is 100 doctors, but the cost per patient
visit is based on 2.

```
MoE parameter breakdown:

    Mixtral 8x7B:
    ┌─────────────────────────────────────────┐
    │  Shared parameters (attention, etc.)     │
    │  ≈ 6B parameters (always active)         │
    ├─────────────────────────────────────────┤
    │  Expert FFNs: 8 experts × ~7B each       │
    │  Total expert params: ≈ 56B              │
    │  Active experts per token: 2 of 8        │
    │  Active expert params: ≈ 14B             │
    ├─────────────────────────────────────────┤
    │  Total parameters:  ≈ 47B                │
    │  Active parameters: ≈ 13B per token      │
    └─────────────────────────────────────────┘

    Inference cost ∝ active parameters (13B)
    Memory cost ∝ total parameters (47B)
```

---

## Compute Requirements

**Plain English:** Bigger models need more math operations to train
and run. A rough rule: training FLOPS ≈ 6 × parameters × tokens.

**Technical definition:** For a single forward pass, the compute is
approximately 2 × parameter_count FLOPS (one multiply and one add
per parameter). For training (forward + backward), it is approximately
6 × parameter_count FLOPS per token. Total training compute =
6 × params × total_training_tokens.

**Example:** Training a 7B model on 2 trillion tokens:
6 × 7B × 2T = 8.4 × 10²² FLOPS. On an H100 GPU doing ~1000
TFLOPS (practical throughput), that is about 84,000 GPU-hours,
or ~3,500 GPU-days.

```
Compute estimation:

    Training FLOPS ≈ 6 × params × tokens

    7B model, 2T tokens:
    6 × 7×10⁹ × 2×10¹² = 8.4×10²² FLOPS

    H100 practical throughput: ~1×10¹⁵ FLOPS/sec
    Time: 8.4×10²² / 1×10¹⁵ = 8.4×10⁷ seconds
         = ~972 days on 1 GPU
         = ~12 days on 80 GPUs (with good scaling)
```

**Cross-reference:** See [Scale & Infrastructure, Lesson 02: Compute Planning](../ml-scale-infrastructure/02-compute-planning.md) for detailed compute estimation.

---

## Storage Requirements

**Plain English:** A saved model file takes up disk space proportional
to its parameter count and precision.

**Technical definition:** Storage ≈ parameter_count × bytes_per_param,
plus metadata overhead (typically negligible). Checkpoint files during
training are larger because they include optimizer states (2–3× the
model size for Adam).

**Example:**

```
Storage for a 70B model:

    Weights only (FP16):  70B × 2 bytes = 140 GB
    Training checkpoint:  weights + optimizer states
                          ≈ 140 GB + 280 GB = 420 GB (Adam, FP16)
    Quantized (INT4):     70B × 0.5 bytes = 35 GB
```

---

## Concept Check Exercises

### Exercise 1: Memory Calculation

```
Calculate the GPU memory needed for a 7B parameter model:

    a) In FP32 (full precision):    7B × ___ bytes = ___ GB
    b) In FP16 (half precision):    7B × ___ bytes = ___ GB
    c) In INT4 (4-bit quantized):   7B × ___ bytes = ___ GB

    Answers:
    a) 7 × 4 = 28 GB
    b) 7 × 2 = 14 GB
    c) 7 × 0.5 = 3.5 GB
```

### Exercise 2: Parameter Count

```
Calculate the parameter count for this MLP:

    Input: 1024 features
    Hidden layer 1: 512 neurons
    Hidden layer 2: 256 neurons
    Output: 10 classes

    Layer 1: 1024 × 512 + 512 = ___
    Layer 2: 512 × 256 + 256  = ___
    Layer 3: 256 × 10 + 10    = ___
    Total:                      ___
```

### Exercise 3: Transformer Estimation

```
Estimate the parameter count for a transformer with:
    - 24 layers
    - Hidden size: 2048
    - Vocabulary: 32,000

    Attention + FFN per layer ≈ 12 × hidden² = 12 × 2048² = ___
    All layers: 24 × ___ = ___
    Embedding: 32,000 × 2048 = ___
    Total estimate: ___

    How much memory in FP16? ___
```

### Exercise 4: MoE Active vs Total

```
A Mixture of Experts model has:
    - 32 transformer layers
    - Hidden size: 4096
    - 8 expert FFNs per layer, top-2 routing
    - Standard attention (shared, not expert)

    Shared attention params per layer: 4 × 4096² = ___
    Single expert FFN params: 2 × 4096 × 16384 = ___
    All 8 experts per layer: 8 × ___ = ___
    Active experts per layer (top-2): 2 × ___ = ___

    Total params per layer: shared + all experts = ___
    Active params per layer: shared + active experts = ___

    Which number determines inference speed? ___
    Which number determines memory requirement? ___
```

---

Next: [Lesson 02: Quantization and Precision](./02-quantization-precision.md)
