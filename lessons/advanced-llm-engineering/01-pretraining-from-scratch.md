# Lesson 01: Pre-training from Scratch — The Full Pipeline

Building a language model from scratch is like brewing beer. You need
quality ingredients (data), the right recipe (training objectives),
proper equipment (compute), and patience (lots of GPU hours). Skip any
step and you get something undrinkable.

This lesson walks through the entire pre-training pipeline — from raw
internet text to a model that can generate coherent language.

---

## The Pre-training Pipeline at a Glance

```
Raw Data          Clean Data        Tokenized         Trained
(Internet)   -->  (Filtered)   -->  (Token IDs)  -->  (Model)

  TB of text      Quality filter     BPE/SP encode    Gradient
  CommonCrawl     Dedup              Vocab 32k-128k   descent
  Books, Code     Toxic removal      Pack sequences    for weeks
  Wikipedia       Language filter    Create batches
```

Every step matters. Models trained on bad data produce bad outputs.
Models with bad tokenizers waste capacity on splitting common words.
Models trained with wrong hyperparameters diverge or plateau.

---

## Step 1: Data Collection

Modern LLMs train on trillions of tokens. Where does all that text
come from?

### Common Data Sources

```
Source            Size (tokens)   Quality    Notes
────────────────────────────────────────────────────────
CommonCrawl       ~3T+           Low-Med    Web scrape, needs heavy filtering
The Pile          800B           Medium     Curated mix (EleutherAI)
Wikipedia         ~4B            High       Clean but small
Books (various)   ~30B           High       Copyright concerns
GitHub code       ~300B          Medium     Need to filter low-quality repos
arXiv papers      ~20B           High       Scientific text
Stack Exchange    ~15B           Medium     Q&A pairs
```

### The Data Mix Problem

You do not just dump everything together. The ratio of different data
sources dramatically affects model behavior.

```python
data_mix = {
    "web_text": 0.50,
    "books": 0.15,
    "code": 0.15,
    "scientific": 0.08,
    "wikipedia": 0.05,
    "math": 0.04,
    "conversation": 0.03,
}
```

Llama 2 trained on 2T tokens with roughly this distribution. More code
in the mix produces better reasoning. More books produces better prose.
The mix is one of the most important (and least published) decisions in
LLM development.

---

## Step 2: Data Cleaning

Raw web data is a disaster. HTML fragments, duplicated pages, spam,
toxic content, personal information. Cleaning is 80% of the data work.

### Cleaning Pipeline

```
Raw HTML
  │
  ├── Extract text (trafilatura / resiliparse)
  │
  ├── Language filter (fastText lid.176)
  │     Keep only target languages
  │
  ├── Quality filter
  │     - Perplexity scoring (KenLM)
  │     - Heuristics: line length, symbol ratio, repetition
  │     - Remove pages with too many special characters
  │
  ├── Deduplication
  │     - Exact dedup (hash-based)
  │     - Near-dedup (MinHash / SimHash)
  │     - URL-level dedup
  │
  ├── PII removal
  │     - Regex for emails, phone numbers, SSNs
  │     - Named entity recognition for names
  │
  └── Toxic content filter
        - Classifier-based filtering
        - Word list filtering (crude but fast)
```

### Quality Filtering with Perplexity

One powerful technique: train a small language model on high-quality
text (Wikipedia), then score every document. High perplexity means the
document looks nothing like good writing — likely garbage.

```python
import kenlm

model = kenlm.Model("wikipedia_5gram.binary")

def perplexity_score(text):
    return model.perplexity(text)

good_doc = "The transformer architecture uses self-attention..."
bad_doc = "BUY NOW!!! CLICK HERE >>> best deals 2024 <<<!!!"

print(perplexity_score(good_doc))   # ~150 (reasonable)
print(perplexity_score(bad_doc))    # ~8500 (garbage)
```

### Deduplication Matters More Than You Think

The internet is full of duplicates. The same news article appears on
hundreds of sites. Without dedup, your model memorizes boilerplate
instead of learning language.

```python
from datasketch import MinHash, MinHashLSH

def create_minhash(text, num_perm=128):
    mh = MinHash(num_perm=num_perm)
    for word in text.split():
        mh.update(word.encode("utf-8"))
    return mh

lsh = MinHashLSH(threshold=0.8, num_perm=128)

for doc_id, text in enumerate(documents):
    mh = create_minhash(text)
    if not lsh.query(mh):
        lsh.insert(str(doc_id), mh)
        keep_document(doc_id)
    else:
        discard_as_duplicate(doc_id)
```

MinHash LSH finds near-duplicates in O(1) per query. At web scale
(billions of documents), exact comparison is impossible — you need
probabilistic methods like this.

---

## Step 3: Tokenizer Training

Before training the model, you need to convert text to numbers. This
means training a tokenizer on your data.

### BPE (Byte Pair Encoding)

The most common approach. Start with individual characters, then
iteratively merge the most frequent adjacent pairs.

```python
from tokenizers import Tokenizer, models, trainers, pre_tokenizers

tokenizer = Tokenizer(models.BPE())
tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)

trainer = trainers.BpeTrainer(
    vocab_size=32000,
    special_tokens=["<pad>", "<eos>", "<bos>", "<unk>"],
    min_frequency=2,
    show_progress=True,
)

tokenizer.train(files=["clean_data.txt"], trainer=trainer)
tokenizer.save("my_tokenizer.json")
```

### SentencePiece (Alternative)

Google's SentencePiece treats the input as a raw stream of bytes —
no pre-tokenization needed. Used by Llama, T5, and many others.

```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input="clean_data.txt",
    model_prefix="sp_model",
    vocab_size=32000,
    model_type="bpe",
    character_coverage=0.9995,
    byte_fallback=True,
    split_digits=True,
    num_threads=16,
)

sp = spm.SentencePieceProcessor(model_file="sp_model.model")
print(sp.encode("Hello, world!", out_type=str))
# ['▁Hello', ',', '▁world', '!']
```

Vocabulary size is a key decision. See Lesson 02 for the full analysis.

---

## Step 4: Training Objectives

### Causal Language Modeling (CLM)

The GPT approach. Predict the next token given all previous tokens.
The model can only look left — it never sees future tokens.

```
Input:  [The] [cat] [sat] [on]  [the]
Target: [cat] [sat] [on]  [the] [mat]

The model predicts each next token using only the tokens before it.
This is called "autoregressive" generation.
```

```python
import torch
import torch.nn as nn

class CLMHead(nn.Module):
    def __init__(self, hidden_size, vocab_size):
        super().__init__()
        self.linear = nn.Linear(hidden_size, vocab_size)

    def forward(self, hidden_states, labels=None):
        logits = self.linear(hidden_states)

        loss = None
        if labels is not None:
            shift_logits = logits[..., :-1, :].contiguous()
            shift_labels = labels[..., 1:].contiguous()
            loss = nn.functional.cross_entropy(
                shift_logits.view(-1, shift_logits.size(-1)),
                shift_labels.view(-1),
            )
        return logits, loss
```

### Masked Language Modeling (MLM)

The BERT approach. Randomly mask 15% of tokens and predict them.
The model sees both left and right context.

```
Input:  [The] [MASK] [sat] [on] [the] [MASK]
Target: [The] [cat]  [sat] [on] [the] [mat]

The model reconstructs masked tokens using bidirectional context.
Good for understanding, bad for generation.
```

Most modern LLMs use CLM. It naturally supports text generation —
you just keep predicting the next token. MLM requires special
decoding tricks for generation and is mainly used for encoder
models (BERT, RoBERTa) that do classification and extraction.

---

## Step 5: The Training Loop

Here is a minimal but realistic pre-training loop:

```python
import torch
from torch.utils.data import DataLoader
from torch.cuda.amp import GradScaler, autocast
from transformers import GPT2Config, GPT2LMHeadModel

config = GPT2Config(
    vocab_size=32000,
    n_positions=2048,
    n_embd=768,
    n_layer=12,
    n_head=12,
)
model = GPT2LMHeadModel(config).cuda()

optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=6e-4,
    betas=(0.9, 0.95),
    weight_decay=0.1,
)

scaler = GradScaler()
gradient_accumulation_steps = 8

model.train()
step = 0

for epoch in range(num_epochs):
    for batch_idx, batch in enumerate(dataloader):
        input_ids = batch["input_ids"].cuda()

        with autocast(dtype=torch.bfloat16):
            outputs = model(input_ids=input_ids, labels=input_ids)
            loss = outputs.loss / gradient_accumulation_steps

        scaler.scale(loss).backward()

        if (batch_idx + 1) % gradient_accumulation_steps == 0:
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad()
            step += 1

            if step % 100 == 0:
                print(f"Step {step}, Loss: {loss.item():.4f}")
```

Key details that matter:

- **Mixed precision (bfloat16):** Cuts memory in half, speeds up training 2x
- **Gradient accumulation:** Simulates larger batch sizes without more memory
- **Gradient clipping:** Prevents exploding gradients (essential for LLMs)
- **AdamW:** Adam with decoupled weight decay — standard for transformers
- **Betas (0.9, 0.95):** Standard for LLM pre-training (not the PyTorch default of 0.999)

---

## Step 6: Learning Rate Schedule

The learning rate schedule is critical. Nearly all LLMs use a warmup
followed by cosine decay.

```
Learning Rate
     │
 max │        ╭────────╮
     │       ╱          ╲
     │      ╱            ╲
     │     ╱              ╲
     │    ╱                ╲
 min │───╱                  ╲──────
     │
     └──────────────────────────── Steps
       warmup    cosine decay    min lr
```

```python
from torch.optim.lr_scheduler import CosineAnnealingLR, LinearLR, SequentialLR

warmup_steps = 2000
total_steps = 100000
min_lr_ratio = 0.1

warmup = LinearLR(
    optimizer,
    start_factor=0.01,
    end_factor=1.0,
    total_iters=warmup_steps,
)

decay = CosineAnnealingLR(
    optimizer,
    T_max=total_steps - warmup_steps,
    eta_min=6e-4 * min_lr_ratio,
)

scheduler = SequentialLR(
    optimizer,
    schedulers=[warmup, decay],
    milestones=[warmup_steps],
)
```

Why warmup? Early in training, gradients are wild because the model
weights are random. A small learning rate lets the optimizer find a
reasonable region of the loss landscape before cranking up the speed.

---

## Compute Requirements and Cost

This is where pre-training gets real. Training a model from scratch
is expensive. Here are rough estimates:

```
Model Size    GPUs Needed      Time        Cost (Cloud)
─────────────────────────────────────────────────────────
125M          1x A100          ~4 hours    ~$8
350M          1x A100          ~1 day      ~$50
1.3B          8x A100          ~3 days     ~$2,400
7B            64x A100         ~2 weeks    ~$100,000
13B           128x A100        ~3 weeks    ~$300,000
70B           512x A100        ~2 months   ~$2,000,000+
```

These are rough numbers for training on ~1T tokens. Actual costs
vary with hardware utilization, data pipeline efficiency, and how
many times you restart due to failures.

### The Chinchilla Scaling Law

DeepMind's Chinchilla paper showed that most models were trained on
too little data. The optimal ratio is approximately:

```
Tokens ≈ 20 × Parameters

So a 7B model should see ~140B tokens
And a 70B model should see ~1.4T tokens
```

Training on fewer tokens wastes model capacity. Training on more
tokens is always helpful but has diminishing returns.

### MFU: Model FLOPS Utilization

How much of your GPU's theoretical compute are you actually using?

```
MFU = (actual_flops / peak_theoretical_flops) × 100

Good MFU:    40-55%  (well-optimized training)
Typical MFU: 30-40%  (most setups)
Bad MFU:     <25%    (bottlenecked somewhere)
```

Most training runs waste 50-70% of their GPU capacity on memory
transfers, synchronization, and idle time. Optimizing MFU is where
serious engineering effort goes.

---

## Putting It All Together: A Realistic Config

Here is what a production pre-training config looks like for a
1.3B parameter model:

```yaml
model:
  hidden_size: 2048
  num_layers: 24
  num_heads: 16
  vocab_size: 32000
  max_seq_length: 2048
  dropout: 0.0           # No dropout for pre-training

training:
  batch_size: 512         # Global batch size in sequences
  gradient_accumulation: 32
  learning_rate: 2e-4
  min_learning_rate: 2e-5
  warmup_steps: 2000
  total_steps: 150000
  weight_decay: 0.1
  grad_clip: 1.0
  precision: bf16

data:
  tokenizer: sentencepiece
  vocab_size: 32000
  sequence_length: 2048
  sources:
    - web: 0.50
    - books: 0.15
    - code: 0.15
    - scientific: 0.10
    - wiki: 0.05
    - math: 0.05

hardware:
  gpus: 8
  gpu_type: A100-80GB
  distributed: FSDP       # Fully Sharded Data Parallel
```

---

## Common Failures and How to Spot Them

### Loss Spikes

```
Loss
  │    ╱╲
  │   ╱  ╲
  │  ╱    ╲╱──────
  │ ╱
  │╱
  └──────────────── Steps
```

Loss spikes happen. Small ones (2x) usually recover on their own.
Large ones (10x+) often mean corrupted data, learning rate too high,
or numerical instability. Fix: lower learning rate, check data batch,
ensure gradient clipping is working.

### Loss Plateau

```
Loss
  │╲
  │ ╲
  │  ╲────────────────
  │
  └──────────────── Steps
```

The model stops improving. Could mean: learning rate too low (already
decayed too far), data exhaustion (model has seen all data multiple
times), or model capacity reached (need bigger model for more progress).

### Divergence

```
Loss
  │            ╱
  │           ╱
  │          ╱
  │─────────╱
  └──────────────── Steps
```

Loss starts going up. Training is broken. Usually caused by learning
rate too high, gradient explosion, or numerical issues with fp16
(use bf16 instead). Stop training, fix the issue, restart from last
good checkpoint.

---

## Key Takeaways

1. **Data quality dominates.** A smaller model on clean data beats a
   bigger model on garbage data. Every time.

2. **Deduplication is essential.** Without it, models memorize instead
   of generalize.

3. **The data mix is a hyperparameter.** More code improves reasoning.
   More books improve prose. Tune the mix for your use case.

4. **Chinchilla scaling:** Train on 20x more tokens than parameters.

5. **Monitor MFU.** If you are below 30%, you are wasting money on
   idle GPUs.

6. **Pre-training is expensive.** For most teams, fine-tuning an
   existing model is the right choice. Pre-train only when you need
   capabilities that no existing model has.

---

## Exercises

1. **Data pipeline:** Download a 1GB sample from CommonCrawl. Build a
   cleaning pipeline that filters language, removes duplicates, and
   scores quality. Measure how much data survives each step.

2. **Small-scale pre-train:** Train a 125M parameter GPT-2 on your
   cleaned data. Track loss curves. Experiment with different data
   mixes and compare output quality.

3. **Tokenizer impact:** Train the same model with vocab_size=8000 and
   vocab_size=32000. Compare sequence lengths, training speed, and
   generation quality.
