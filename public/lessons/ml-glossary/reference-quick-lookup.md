# Quick Lookup Reference — Alphabetical Term Index

Find any term in one line. Follow the link for the full explanation
with examples, diagrams, and exercises.

---

## A

**Active Parameters** — The subset of a model's parameters that process each input token (relevant in MoE models where only top-k experts fire per token).
→ [Lesson 01: Model Sizes and Parameters](./01-model-sizes-parameters.md)

**Attention Heads** — Parallel attention computations within a layer, each focusing on different relationships in the input sequence.
→ [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)

## B

**Batch Size** — The number of training examples processed in one forward/backward pass before updating weights.
→ [Lesson 03: Training Terminology](./03-training-terminology.md)

**Beam Search** — A decoding strategy that explores multiple candidate sequences simultaneously, keeping the top-B scoring paths.
→ [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)

**Benchmarks** — Standardized tests for measuring model capabilities (MMLU, HumanEval, GSM8K, etc.).
→ [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)

**BF16 (Brain Floating Point 16)** — A 16-bit format with the same exponent range as FP32 but less precision; preferred for training.
→ [Lesson 02: Quantization and Precision](./02-quantization-precision.md)

**BPE (Byte Pair Encoding)** — A tokenization algorithm that iteratively merges the most frequent character pairs to build a vocabulary.
→ [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)

## C

**Chinchilla-Optimal** — The compute-optimal balance between model size and training data; roughly tokens ≈ 20 × parameters.
→ [Lesson 05: Scaling and Compute Terminology](./05-scaling-compute-terminology.md)

**Compute-Optimal Training** — Choosing model size and data amount to minimize loss for a fixed compute budget.
→ [Lesson 05: Scaling and Compute Terminology](./05-scaling-compute-terminology.md)

**Constitutional AI** — An alignment technique where the model critiques and revises its own outputs based on a set of written principles.
→ [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)

**Contamination** — When benchmark test data appears in the model's training data, inflating evaluation scores.
→ [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)

**Context Length (Context Window)** — The maximum number of tokens a model can process in a single forward pass.
→ [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)

**Convergence** — When the loss function plateaus and additional training produces negligible improvement.
→ [Lesson 03: Training Terminology](./03-training-terminology.md)

## D

**Decoder** — The part of a transformer that generates output tokens using causal (left-to-right) attention; GPT-style models are decoder-only.
→ [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)

**DPO (Direct Preference Optimization)** — A simpler alternative to RLHF that trains directly on preference pairs without a separate reward model.
→ [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)

## E

**Encoder** — The part of a transformer that processes input with bidirectional attention; BERT is encoder-only.
→ [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)

**Epoch** — One complete pass through the entire training dataset.
→ [Lesson 03: Training Terminology](./03-training-terminology.md)

## F

**Feed-Forward Network (FFN)** — A two-layer network inside each transformer block that processes each token independently; stores most of the model's "knowledge."
→ [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)

**FLOPS** — Floating Point Operations Per Second; a measure of computational throughput (TFLOPS = 10¹² FLOPS).
→ [Lesson 05: Scaling and Compute Terminology](./05-scaling-compute-terminology.md)

**FP8** — An 8-bit floating-point format (E4M3 or E5M2) supported on H100+ GPUs; combines INT8 compactness with floating-point flexibility.
→ [Lesson 02: Quantization and Precision](./02-quantization-precision.md)

**FP16** — 16-bit floating point (half precision); 2 bytes per parameter, range ±65,504.
→ [Lesson 02: Quantization and Precision](./02-quantization-precision.md)

**FP32** — 32-bit floating point (full precision); 4 bytes per parameter, the baseline format.
→ [Lesson 02: Quantization and Precision](./02-quantization-precision.md)

## G

**GPU-Hours** — A unit of compute: one GPU running for one hour. Cost = GPU-hours × price per GPU-hour.
→ [Lesson 05: Scaling and Compute Terminology](./05-scaling-compute-terminology.md)

**Gradient** — A vector of partial derivatives pointing in the direction of steepest loss increase; training goes the opposite way.
→ [Lesson 03: Training Terminology](./03-training-terminology.md)

**Greedy Decoding** — Always selecting the highest-probability next token; fast and deterministic but can be repetitive.
→ [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)

**GSM8K** — A benchmark of 8,500 grade-school math word problems testing multi-step arithmetic reasoning.
→ [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)

## H

**Hidden Dimension (d_model)** — The size of the internal vector representation at each layer (e.g., 4096 for Llama 7B).
→ [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)

**Human Evaluation** — Having trained annotators judge model outputs for quality, helpfulness, and safety.
→ [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)

**HumanEval** — A coding benchmark of 164 Python problems where generated code is executed against test cases.
→ [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)

## I

**Instruction Tuning** — Fine-tuning a model on (instruction, response) pairs to make it follow diverse instructions.
→ [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)

**INT4** — 4-bit integer quantization; 0.5 bytes per parameter, 16 possible values, significant memory savings with some quality loss.
→ [Lesson 02: Quantization and Precision](./02-quantization-precision.md)

**INT8** — 8-bit integer quantization; 1 byte per parameter, 256 possible values, minimal quality loss for most models.
→ [Lesson 02: Quantization and Precision](./02-quantization-precision.md)

## L

**Latency** — Time from submitting a request to receiving the complete response; includes time-to-first-token and per-token generation time.
→ [Lesson 05: Scaling and Compute Terminology](./05-scaling-compute-terminology.md)

**Layer Normalization** — A technique that normalizes values within each layer to stabilize training and prevent exploding/vanishing values.
→ [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)

**Layers** — Sequential processing blocks in a neural network; a "32-layer transformer" passes input through 32 identical blocks.
→ [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)

**Learning Rate** — A hyperparameter controlling how large a step the model takes when updating weights; too high = divergence, too low = slow training.
→ [Lesson 03: Training Terminology](./03-training-terminology.md)

**Loss** — A scalar value measuring how wrong the model's predictions are; training minimizes this value.
→ [Lesson 03: Training Terminology](./03-training-terminology.md)

## M

**MFU (Model FLOPS Utilization)** — The percentage of a GPU's theoretical peak compute actually achieved during training; 30–60% is typical.
→ [Lesson 05: Scaling and Compute Terminology](./05-scaling-compute-terminology.md)

**MMLU** — Massive Multitask Language Understanding; a benchmark of ~16,000 multiple-choice questions across 57 academic subjects.
→ [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)

**Model Size** — The memory footprint of a model's weights; calculated as parameter count × bytes per parameter.
→ [Lesson 01: Model Sizes and Parameters](./01-model-sizes-parameters.md)

**MoE (Mixture of Experts)** — An architecture where only a subset of "expert" networks process each token, reducing compute while maintaining total capacity.
→ [Lesson 01: Model Sizes and Parameters](./01-model-sizes-parameters.md)

## O

**Overfitting** — When a model memorizes training data instead of learning general patterns; training loss decreases but validation loss increases.
→ [Lesson 03: Training Terminology](./03-training-terminology.md)

## P

**Parameter** — A single learnable number (weight or bias) in a neural network; a "7B model" has 7 billion parameters.
→ [Lesson 01: Model Sizes and Parameters](./01-model-sizes-parameters.md)

**Parameter Count** — The total number of learnable values in a model; determines capacity, memory, and compute requirements.
→ [Lesson 01: Model Sizes and Parameters](./01-model-sizes-parameters.md)

## Q

**Quantization** — Reducing the numerical precision of model weights (e.g., FP32 → INT4) to decrease memory usage and increase speed.
→ [Lesson 02: Quantization and Precision](./02-quantization-precision.md)

## R

**Red Teaming** — Adversarial testing to find harmful, incorrect, or undesirable model behaviors before deployment.
→ [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)

**Regularization** — Techniques (weight decay, dropout, early stopping) that prevent overfitting by discouraging model complexity.
→ [Lesson 03: Training Terminology](./03-training-terminology.md)

**Residual Connections** — Skip connections that add a layer's input to its output, enabling gradient flow through deep networks.
→ [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)

**RLHF (Reinforcement Learning from Human Feedback)** — A three-stage alignment process: SFT → reward model → RL optimization using human preference data.
→ [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)

## S

**Scaling Laws** — Power-law relationships predicting how model performance improves with more parameters, data, or compute.
→ [Lesson 05: Scaling and Compute Terminology](./05-scaling-compute-terminology.md)

**System Prompt** — Hidden instructions prepended to a conversation that configure the model's behavior and constraints.
→ [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)

## T

**Temperature** — A parameter (0.0–2.0) controlling output randomness; low = focused/deterministic, high = creative/diverse.
→ [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)

**Throughput** — The rate at which a system processes data (tokens/second, samples/second); distinct from latency.
→ [Lesson 05: Scaling and Compute Terminology](./05-scaling-compute-terminology.md)

**Tokenization** — Breaking text into discrete tokens (subwords, characters, or words) that the model can process.
→ [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)

**Tokens Per Second** — A measure of inference speed (generation) or training speed (processing); higher = faster.
→ [Lesson 05: Scaling and Compute Terminology](./05-scaling-compute-terminology.md)

**Top-k** — A sampling strategy that restricts token selection to the k highest-probability candidates.
→ [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)

**Top-p (Nucleus Sampling)** — A sampling strategy that considers the smallest set of tokens whose cumulative probability exceeds p.
→ [Lesson 06: Modern LLM Terminology](./06-modern-llm-terminology.md)

## U

**Underfitting** — When a model is too simple to capture data patterns; both training and validation losses remain high.
→ [Lesson 03: Training Terminology](./03-training-terminology.md)

## V

**Vocabulary** — The fixed set of tokens a model can recognize, determined during tokenizer training; maps token strings to integer IDs.
→ [Lesson 07: Data and Evaluation Terminology](./07-data-and-evaluation.md)

**Vocabulary Size** — The number of unique tokens in the tokenizer's vocabulary; affects the embedding matrix size (vocab_size × d_model).
→ [Lesson 04: Architecture Terminology](./04-architecture-terminology.md)
