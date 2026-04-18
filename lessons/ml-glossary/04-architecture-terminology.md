# Lesson 04: Architecture Terminology — The Building Blocks

When someone describes a model as "a 32-layer transformer with 32
heads, hidden dimension 4096, and 128K context length" — what does
each of those terms mean? This lesson maps every architectural term
to its place inside a transformer.

---

## Layers

**Plain English:** A layer is one processing step in a neural network.
A "32-layer transformer" means the input passes through 32 identical
processing blocks, one after another.

**Technical definition:** In a transformer, each layer (or "block")
consists of a multi-head self-attention sublayer followed by a
feed-forward network sublayer, each with residual connections and
layer normalization. The number of layers (often called depth) is
a primary factor in model capacity.

**Example:** Think of layers like floors in a building. Each floor
does some processing on the data as it passes through. The ground
floor handles basic patterns, middle floors handle intermediate
concepts, and top floors handle abstract reasoning.

```
Transformer layers stacked:

    Input tokens
         │
         ▼
    ┌─────────────┐
    │   Layer 1    │  ← Basic pattern recognition
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │   Layer 2    │
    └──────┬──────┘
           │
         . . .
           │
    ┌──────▼──────┐
    │   Layer 32   │  ← Abstract reasoning
    └──────┬──────┘
           │
           ▼
    Output logits
```

**Cross-reference:** See [LLMs & Transformers, Lesson 04: Neural Network Foundations](../llms-transformers/04-neural-network-foundations.md) for how layers work.

---

## Attention Heads

**Plain English:** Each attention head looks at the input from a
different "perspective." Multiple heads let the model pay attention
to different relationships simultaneously.

**Technical definition:** Multi-head attention splits the hidden
dimension into H parallel attention computations (heads). Each head
operates on a d_head = d_model / H dimensional subspace, computing
its own Q, K, V projections. The outputs are concatenated and
projected back to d_model dimensions. Typical values: 32 heads for
a 4096-dim model (128 dims per head).

**Example:** Like reading a sentence with multiple highlighters.
One head highlights subject-verb relationships, another highlights
adjective-noun pairs, another tracks pronouns to their referents —
all at the same time.

```
Multi-head attention (4 heads shown):

    Input: "The cat sat on the mat"

    Head 1: "The cat" ←→ "sat"        (subject-verb)
    Head 2: "cat" ←→ "mat"            (noun relationships)
    Head 3: "on" ←→ "mat"             (preposition-object)
    Head 4: "The" ←→ "the"            (article patterns)

    Each head sees the full sequence but attends to
    different relationships.

    ┌──────────────────────────────────────┐
    │         Multi-Head Attention          │
    │                                      │
    │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
    │  │Head 1│ │Head 2│ │Head 3│ │Head 4││
    │  │128-d │ │128-d │ │128-d │ │128-d ││
    │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘│
    │     └────┬───┴────┬───┴────┬───┘    │
    │          │  Concat + Project │        │
    │          └────────┬─────────┘        │
    │                   │ 512-d output     │
    └───────────────────┼──────────────────┘
                        ▼
```

**Cross-reference:** See [LLMs & Transformers, Lesson 05: Self-Attention](../llms-transformers/05-self-attention.md) for the attention mechanism in detail.

---

## Hidden Dimension (d_model)

**Plain English:** The size of the internal representation at each
layer. A hidden dimension of 4096 means each token is represented
as a vector of 4096 numbers inside the model.

**Technical definition:** The hidden dimension (d_model) is the
width of the residual stream — the vector size that flows through
all layers. It determines the model's representational capacity.
All weight matrices in the transformer are sized relative to d_model.
Larger d_model = more capacity but quadratically more parameters
in attention layers.

**Example:** Think of d_model as the "bandwidth" of the model's
internal communication channel. A 4096-wide channel can carry more
nuanced information than a 512-wide channel.

```
Hidden dimension through a transformer:

    Token "cat" → Embedding → [0.12, -0.45, ..., 0.33]
                                    ↑
                              d_model = 4096 numbers
                                    │
                                    ▼
    ┌─────────────────────────────────────┐
    │  Every layer operates on this       │
    │  4096-dimensional vector            │
    │                                     │
    │  Attention: 4096 → 4096             │
    │  FFN:       4096 → 16384 → 4096     │
    │  Output:    4096                     │
    └─────────────────────────────────────┘

    Common hidden dimensions:
    ┌──────────┬──────────┬──────────────┐
    │ Model    │ d_model  │ Parameters   │
    ├──────────┼──────────┼──────────────┤
    │ GPT-2    │ 768      │ 117M         │
    │ Llama 7B │ 4,096    │ 6.7B         │
    │ Llama 70B│ 8,192    │ 70B          │
    │ GPT-4*   │ ~12,288? │ ~1.8T?       │
    └──────────┴──────────┴──────────────┘
    (* estimated, not officially confirmed)
```

---

## Context Length (Context Window)

**Plain English:** The maximum number of tokens the model can
"see" at once. A 128K context length means the model can process
about 100,000 words in a single prompt.

**Technical definition:** The maximum sequence length the model
can process in a single forward pass. Determined by the positional
encoding scheme and the quadratic memory cost of self-attention
(O(n²) for standard attention). Modern models use techniques like
RoPE, ALiBi, or sliding window attention to extend context length.

**Example:** Context length is like the model's working memory.
A 4K context is like remembering the last few pages of a book.
A 128K context is like remembering the entire book.

```
Context length comparison:

    GPT-3 (2020):     2,048 tokens  ≈ 1,500 words
    GPT-3.5 (2022):   4,096 tokens  ≈ 3,000 words
    GPT-4 (2023):   128,000 tokens  ≈ 100,000 words
    Claude 3 (2024): 200,000 tokens ≈ 150,000 words

    What fits in different context lengths:

    2K tokens:   ████                    A short email
    4K tokens:   ████████                A blog post
    32K tokens:  ████████████████████    A research paper
    128K tokens: ████████████████████    A short novel
                 ████████████████████
                 ████████████████████
```

**Cross-reference:** See [LLMs & Transformers, Lesson 06: Positional Encoding](../llms-transformers/06-positional-encoding.md) for how position information works.

---

## Vocabulary Size

**Plain English:** The number of unique tokens the model knows.
A vocabulary of 50,000 means the model can recognize 50,000
different token "words."

**Technical definition:** The size of the tokenizer's vocabulary —
the number of unique tokens that can be represented. Each token
maps to a row in the embedding matrix (shape: vocab_size × d_model).
Larger vocabularies handle more languages and rare words but increase
the embedding matrix size. Common values: 32K–256K tokens.

**Example:** Like the number of words in a dictionary. A bigger
dictionary recognizes more words but takes up more shelf space
(memory).

```
Vocabulary size examples:

    ┌──────────────┬────────────┬─────────────────┐
    │ Model        │ Vocab size │ Embedding params │
    ├──────────────┼────────────┼─────────────────┤
    │ GPT-2        │ 50,257     │ 38.6M           │
    │ Llama 2      │ 32,000     │ 131M            │
    │ Llama 3      │ 128,256    │ 525M            │
    │ GPT-4        │ ~100,000   │ ~1.2B (est.)    │
    └──────────────┴────────────┴─────────────────┘

    Embedding params = vocab_size × d_model
    Llama 2: 32,000 × 4,096 = 131,072,000 ≈ 131M
```

**Cross-reference:** See [LLMs & Transformers, Lesson 02: Tokenization](../llms-transformers/02-tokenization.md) for how tokenizers work.

---

## Encoder and Decoder

**Plain English:** An encoder reads and understands input. A decoder
generates output. Some models have both (like translators), some
have only a decoder (like GPT), some have only an encoder (like BERT).

**Technical definition:** In the original transformer architecture,
the encoder processes the input sequence with bidirectional attention
(each token attends to all others), and the decoder generates the
output sequence with causal (left-to-right) attention plus
cross-attention to the encoder output. Modern LLMs (GPT, Llama,
Claude) are decoder-only — they use causal attention without a
separate encoder.

**Example:** Think of a translator. The encoder is like reading and
understanding the French sentence. The decoder is like writing the
English translation word by word. GPT-style models skip the encoder
and just generate text word by word.

```
Three transformer architectures:

    Encoder-only (BERT):
    ┌──────────────────┐
    │     ENCODER      │  Bidirectional attention
    │  "The cat sat"   │  Every token sees every other token
    └────────┬─────────┘
             │
        Classification / Embeddings

    Decoder-only (GPT, Llama, Claude):
    ┌──────────────────┐
    │     DECODER      │  Causal (left-to-right) attention
    │  "The" → "cat"   │  Each token only sees previous tokens
    │  → "sat" → ...   │
    └────────┬─────────┘
             │
        Next token prediction

    Encoder-Decoder (T5, original Transformer):
    ┌──────────────────┐     ┌──────────────────┐
    │     ENCODER      │────→│     DECODER      │
    │  "Le chat"       │     │  "The" → "cat"   │
    │  (French input)  │     │  (English output) │
    └──────────────────┘     └────────┬─────────┘
                                      │
                                 Translation
```

**Cross-reference:** See [LLMs & Transformers, Lesson 07: The Full Transformer](../llms-transformers/07-full-transformer.md) for the complete architecture.

---

## Feed-Forward Network (FFN)

**Plain English:** A simple two-layer network inside each transformer
layer that processes each token independently. It is where most of
the model's "knowledge" is stored.

**Technical definition:** The FFN sublayer in each transformer block
applies two linear transformations with a nonlinearity:
FFN(x) = W₂ · activation(W₁ · x + b₁) + b₂. The inner dimension
is typically 4× the hidden dimension (d_ff = 4 × d_model). This
accounts for about 2/3 of the parameters in each layer.

**Example:** If attention is "which tokens should talk to each
other," the FFN is "what should each token think about after
listening."

```
FFN inside a transformer layer:

    ┌─────────────────────────────────────────┐
    │            Transformer Layer             │
    │                                         │
    │  Input (d_model = 4096)                 │
    │       │                                 │
    │       ▼                                 │
    │  ┌──────────────┐                       │
    │  │  Attention    │  "Who to listen to"   │
    │  └──────┬───────┘                       │
    │         │ + residual                    │
    │         ▼                               │
    │  ┌──────────────┐                       │
    │  │     FFN       │  "What to think"     │
    │  │ 4096 → 16384 │  (expand)             │
    │  │ → activation │                       │
    │  │ 16384 → 4096 │  (compress)           │
    │  └──────┬───────┘                       │
    │         │ + residual                    │
    │         ▼                               │
    │  Output (d_model = 4096)                │
    └─────────────────────────────────────────┘

    FFN parameters per layer:
    W1: 4096 × 16384 = 67.1M
    W2: 16384 × 4096 = 67.1M
    Total: 134.2M (2/3 of layer params)
```

**Cross-reference:** See [LLMs & Transformers, Lesson 08: Feed-Forward Networks](../llms-transformers/08-feed-forward-networks.md) for FFN details.

---

## Layer Normalization

**Plain English:** A technique that stabilizes training by
normalizing the values flowing through the network. Without it,
values can explode or vanish as they pass through many layers.

**Technical definition:** Layer normalization computes the mean and
variance across the features of each token independently, then
normalizes: LN(x) = γ × (x - μ) / √(σ² + ε) + β, where γ and β
are learnable parameters. Modern transformers use "pre-norm"
(normalize before attention/FFN) rather than "post-norm."

**Example:** Like adjusting the volume on each channel of a mixing
board to keep everything at a consistent level — preventing any
single channel from drowning out the others.

```
Layer norm in a transformer:

    Pre-norm (modern, e.g., Llama):
    x → LayerNorm → Attention → + residual → LayerNorm → FFN → + residual

    Post-norm (original transformer):
    x → Attention → + residual → LayerNorm → FFN → + residual → LayerNorm
```

---

## Residual Connections

**Plain English:** Shortcuts that let information skip over layers.
They make deep networks trainable by ensuring gradients can flow
back through many layers without vanishing.

**Technical definition:** A residual connection adds the input of a
sublayer to its output: output = sublayer(x) + x. This creates a
"skip connection" that allows gradients to flow directly through
the network during backpropagation, mitigating the vanishing
gradient problem in deep networks.

**Example:** Like having an express elevator alongside the stairs.
Information can take the stairs (go through the layer) or the
elevator (skip the layer), or both.

```
Residual connection:

    x ──────────────────┐
    │                   │ (skip / shortcut)
    ▼                   │
    ┌──────────┐        │
    │  Layer    │        │
    └────┬─────┘        │
         │              │
         ▼              │
        (+) ◄───────────┘   output = Layer(x) + x
         │
         ▼
       output
```

---

## Where Everything Lives in a Transformer

```
Complete transformer decoder block (e.g., one layer of Llama):

    Input tokens: "The cat sat on"
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Token Embedding (vocab_size × d_model)          │
    │  + Positional Encoding (RoPE)                    │
    └────────────────────┬────────────────────────────┘
                         │
    ╔════════════════════╪════════════════════════════╗
    ║  LAYER 1           │                            ║
    ║                    ▼                            ║
    ║  ┌──────────────────────────────────┐           ║
    ║  │  RMSNorm (pre-norm)              │           ║
    ║  └──────────────┬───────────────────┘           ║
    ║                 ▼                               ║
    ║  ┌──────────────────────────────────┐           ║
    ║  │  Multi-Head Self-Attention        │           ║
    ║  │  Q, K, V projections (d × d)     │ ← HEADS  ║
    ║  │  32 heads × 128 dims each        │           ║
    ║  │  Output projection (d × d)       │           ║
    ║  └──────────────┬───────────────────┘           ║
    ║                 │ + residual                    ║
    ║                 ▼                               ║
    ║  ┌──────────────────────────────────┐           ║
    ║  │  RMSNorm (pre-norm)              │           ║
    ║  └──────────────┬───────────────────┘           ║
    ║                 ▼                               ║
    ║  ┌──────────────────────────────────┐           ║
    ║  │  Feed-Forward Network             │ ← FFN    ║
    ║  │  Up: d_model → 4×d_model         │           ║
    ║  │  SiLU activation                  │           ║
    ║  │  Down: 4×d_model → d_model       │           ║
    ║  └──────────────┬───────────────────┘           ║
    ║                 │ + residual                    ║
    ╚════════════════╪════════════════════════════════╝
                     │
                   × 32 layers
                     │
                     ▼
    ┌─────────────────────────────────────────────────┐
    │  RMSNorm → Linear (d_model → vocab_size)         │
    │  → Softmax → Next token probabilities            │
    └─────────────────────────────────────────────────┘
```

---

## Concept Check Exercises

### Exercise 1: Architecture Specs

```
Given a model with these specs:
    - 48 layers
    - Hidden dimension: 6144
    - 48 attention heads
    - Vocabulary: 128,000

a) Dimensions per head: 6144 / 48 = ___
b) FFN inner dimension (4× expansion): 6144 × 4 = ___
c) Embedding matrix size: 128,000 × 6144 = ___ parameters
d) Attention params per layer: 4 × 6144² = ___
e) FFN params per layer: 2 × 6144 × 24,576 = ___
f) Approximate total params: ___
```

### Exercise 2: Encoder vs Decoder

```
For each task, which architecture is most appropriate?

a) Sentiment analysis (classify text as positive/negative):
   Encoder-only / Decoder-only / Encoder-Decoder?

b) Text generation (write a story):
   Encoder-only / Decoder-only / Encoder-Decoder?

c) Translation (English to French):
   Encoder-only / Decoder-only / Encoder-Decoder?

d) Code completion (predict next tokens):
   Encoder-only / Decoder-only / Encoder-Decoder?
```

### Exercise 3: Context Length Math

```
Standard self-attention has O(n²) memory complexity where n is
the sequence length.

a) If 4K context uses X memory for attention, how much does
   8K context use? ___X

b) How much does 128K context use relative to 4K? ___X

c) If 4K context attention takes 100 MB, how much memory does
   128K context attention need? ___ GB

d) Why do modern models need techniques like sliding window
   attention or flash attention for long contexts?
```

### Exercise 4: Count the Components

```python
# Given this model config, calculate the component counts:
config = {
    "num_layers": 32,
    "hidden_size": 4096,
    "num_heads": 32,
    "vocab_size": 32000,
    "ffn_multiplier": 4,
}

# TODO: Calculate total attention heads in the model (all layers)
# TODO: Calculate total FFN parameters (all layers)
# TODO: Calculate embedding parameters
# TODO: Calculate total model parameters (approximate)
# TODO: How much memory in FP16?
```

---

Next: [Lesson 05: Scaling and Compute Terminology](./05-scaling-compute-terminology.md)
