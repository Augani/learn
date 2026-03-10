# Advanced LLM Engineering — Track Roadmap

You know how to use LLMs. You have called APIs, fine-tuned models, maybe
even read the "Attention Is All You Need" paper. This track is for the
next step: understanding what happens inside these systems well enough
to build, optimize, and serve them yourself.

Think of it this way. Most engineers drive cars. Some engineers tune
engines. This track teaches you to build the engine, pick the right
fuel, and design the road it drives on.

---

## Prerequisites

You should be comfortable with:

- Transformer architecture (self-attention, feed-forward layers, residual connections)
- PyTorch (building and training neural networks)
- Basic fine-tuning (LoRA or full fine-tune of a small model)
- GPU concepts (CUDA, tensors on device, mixed precision)
- Linux command line and Python packaging

If any of these feel shaky, review the **LLMs & Transformers** and
**Advanced Deep Learning** tracks first.

---

## How This Track Is Organized

```
Phase 1: Build From Scratch         (Lessons 01-02)
Phase 2: Architecture Deep Dives    (Lessons 03-06)
Phase 3: Inference Optimization     (Lessons 07-10)
Phase 4: Training & Evaluation      (Lessons 11-13)
Phase 5: Capstone                   (Lesson 14)
```

---

## Phase 1: Build From Scratch

Start where the model starts — with data and tokens.

- [ ] **01 - Pre-training from Scratch**
      The full pipeline: data, tokenizer, training, compute
- [ ] **02 - Custom Tokenizers**
      BPE, Unigram, WordPiece — deep dive into vocabulary

```
  +------------------+     +-------------------+
  | Pre-training     |---->| Custom Tokenizers |
  | Pipeline         |     | & Vocabulary      |
  +------------------+     +-------------------+
        01                        02
```

---

## Phase 2: Architecture Deep Dives

The pieces that make modern LLMs different from the original transformer.

- [ ] **03 - Mixture of Experts**
      Route tokens to specialized sub-networks
- [ ] **04 - Attention Variants**
      MQA, GQA, sliding window, flash attention
- [ ] **05 - Positional Encoding Advances**
      RoPE, ALiBi, context extension techniques
- [ ] **06 - KV Cache Optimization**
      PagedAttention, continuous batching, memory management

```
  +------+     +-----------+     +----------+     +----------+
  | MoE  |---->| Attention |---->| Position |---->| KV Cache |
  +------+     | Variants  |     | Encoding |     | Optimize |
    03         +-----------+     +----------+     +----------+
                    04                05               06
```

---

## Phase 3: Inference Optimization

Make models fast and small without (much) quality loss.

- [ ] **07 - Speculative Decoding**
      Use a small model to speed up a big one
- [ ] **08 - Model Quantization (Advanced)**
      GPTQ, AWQ, GGUF, calibration, mixed precision
- [ ] **09 - Serving at Scale**
      vLLM, TGI, TensorRT-LLM, request scheduling
- [ ] **10 - Multi-GPU Inference**
      Tensor parallelism, pipeline parallelism, sharding

```
  +-------------+     +--------------+     +---------+     +-----------+
  | Speculative |---->| Quantization |---->| Serving |---->| Multi-GPU |
  | Decoding    |     | Advanced     |     | @ Scale |     | Inference |
  +-------------+     +--------------+     +---------+     +-----------+
       07                   08                 09               10
```

---

## Phase 4: Training & Evaluation

Align models and measure what matters.

- [ ] **11 - Training Alignment**
      RLHF, DPO, Constitutional AI, reward models
- [ ] **12 - Efficient Fine-tuning**
      LoRA variants, adapters, model merging
- [ ] **13 - Evaluating LLMs**
      Beyond benchmarks: human eval, red teaming, LLM-as-judge

```
  +-----------+     +------------+     +------------+
  | Alignment |---->| Efficient  |---->| Evaluation |
  | Training  |     | Fine-tuning|     | Methods    |
  +-----------+     +------------+     +------------+
       11                12                 13
```

---

## Phase 5: Capstone

- [ ] **14 - Build a Complete LLM System**
      Custom tokenizer + LoRA fine-tune + quantize + serve + evaluate

This is a full end-to-end project. You will build every piece
of the pipeline yourself.

---

## Reference Sheets

- **reference-architectures.md** — LLM architectures, parameter counts, context lengths
- **reference-serving.md** — Comparing vLLM, TGI, TensorRT-LLM, Ollama

---

## Recommended Reading

Two books stand above the rest for this material:

### Build a Large Language Model (From Scratch)
**Sebastian Raschka** — Manning, 2024

This book walks you through implementing a GPT-style model from the
ground up in PyTorch. Every line of code is explained. Raschka covers
tokenization, attention, pre-training, and fine-tuning with a clarity
that is rare in ML writing. If you read one book alongside this track,
make it this one. It pairs directly with Lessons 01, 02, 04, and 12.

### Natural Language Processing with Transformers
**Lewis Tunstall, Leandro von Werra, Thomas Wolf** — O'Reilly, Revised Edition 2022

Written by engineers at Hugging Face, this book covers the practical
side of transformer models. It is especially strong on tokenization,
fine-tuning, and evaluation pipelines. The Hugging Face ecosystem
examples translate directly to production work. Pairs well with
Lessons 02, 08, 12, and 13.

---

## Estimated Time

```
Phase 1: 8-12 hours  (reading + hands-on)
Phase 2: 15-20 hours (architecture study + implementation)
Phase 3: 12-16 hours (optimization experiments)
Phase 4: 10-14 hours (training + evaluation)
Phase 5: 8-12 hours  (capstone project)

Total: ~55-75 hours
```

This is dense material. Take your time. Run the code. Break things.
The goal is not to memorize architectures — it is to develop intuition
for why each design choice exists and when to use it.

---

## Your Development Setup

You will need:

```
Hardware:
  - GPU with at least 16GB VRAM (RTX 4090, A100, or cloud)
  - For multi-GPU lessons: 2+ GPUs or cloud instances
  - 32GB+ system RAM

Software:
  - Python 3.10+
  - PyTorch 2.0+
  - transformers (Hugging Face)
  - vllm, trl, peft, bitsandbytes
  - sentencepiece, tokenizers

Cloud alternatives:
  - Lambda Labs (cheapest A100s)
  - RunPod (flexible GPU rental)
  - Google Colab Pro (good for experimentation)
```

Every lesson includes runnable code. Do not just read it — type it,
change it, see what breaks. That is where the learning happens.
