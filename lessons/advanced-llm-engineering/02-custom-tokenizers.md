# Lesson 02: Custom Tokenizers — Controlling How Your Model Sees Text

A tokenizer is the lens your model looks through. Give it a bad lens
and everything is blurry — the model wastes capacity splitting common
words into fragments it has to reassemble. Give it a good lens and the
model sees clean, meaningful units from the start.

Think of tokenization like cutting a pizza. You could cut it into 4
giant slices (whole words), 1000 tiny pieces (characters), or something
in between that makes each piece the right size for eating. The
vocabulary size is how many different piece shapes you allow.

---

## Why Custom Tokenizers Matter

Off-the-shelf tokenizers (GPT-4's, Llama's) are trained on general
internet text. They work fine for English prose. But they are terrible
for:

- **Domain-specific text:** Medical terms, legal jargon, chemical formulas
- **Non-English languages:** Many tokenizers use 3-5x more tokens for
  non-Latin scripts
- **Code:** Variable names get split into meaningless fragments
- **Mixed-language text:** Switching between languages within a document

```
GPT-4 tokenizer on English:
  "transformer" → ["transform", "er"]           2 tokens

GPT-4 tokenizer on Japanese:
  "変圧器" (transformer) → ["変", "圧", "器"]    3 tokens
  But this is only 3 characters!

GPT-4 tokenizer on code:
  "getUserById" → ["get", "User", "By", "Id"]   4 tokens

Custom tokenizer trained on your code:
  "getUserById" → ["getUserById"]                1 token
```

Fewer tokens means shorter sequences, which means faster training and
inference, lower memory usage, and longer effective context windows.

---

## The Three Major Algorithms

### 1. Byte Pair Encoding (BPE)

The most widely used. GPT-2, GPT-3, GPT-4, Llama, and most modern LLMs
use BPE or a variant of it.

**How it works — the merge algorithm:**

```
Start with characters:  l o w e r _   l o w e s t _

Step 1: Count pairs.  Most frequent: (l, o) appears 2 times
        Merge: "lo"
        Result: lo w e r _   lo w e s t _

Step 2: Count pairs.  Most frequent: (lo, w) appears 2 times
        Merge: "low"
        Result: low e r _   low e s t _

Step 3: Count pairs.  Most frequent: (low, e) appears 2 times
        Merge: "lowe"
        Result: lowe r _   lowe s t _

...continue until vocab_size reached
```

Each merge creates a new token. The vocabulary starts with all
individual bytes (256 entries) and grows by one with each merge rule.

```python
from tokenizers import Tokenizer, models, trainers, pre_tokenizers
from tokenizers.normalizers import NFC

tokenizer = Tokenizer(models.BPE())
tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)

trainer = trainers.BpeTrainer(
    vocab_size=32000,
    special_tokens=["<pad>", "<s>", "</s>", "<unk>"],
    min_frequency=2,
    show_progress=True,
    initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
)

files = ["medical_corpus.txt", "clinical_notes.txt"]
tokenizer.train(files, trainer)

output = tokenizer.encode("Acetaminophen 500mg PO q6h PRN")
print(output.tokens)
```

With a general tokenizer, "Acetaminophen" might split into 4-5 pieces.
A medical tokenizer trained on clinical text would keep it as one or
two tokens.

### 2. Unigram (SentencePiece)

Unigram works backwards from BPE. Instead of building up from
characters, it starts with a large vocabulary and prunes it down.

```
Start:  huge vocabulary (all substrings up to some length)
        {"a", "b", ..., "the", "th", "he", "cat", "ca", "at", ...}

Step 1: Calculate the loss if each token is removed
Step 2: Remove the tokens whose removal hurts least
Step 3: Repeat until target vocab_size reached

The result: keep tokens that are most useful for encoding the data
```

The key insight is that Unigram uses a probabilistic model. For any
input text, it finds the tokenization that maximizes the overall
probability. This means the same word might be tokenized differently
depending on context.

```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input="domain_corpus.txt",
    model_prefix="domain_unigram",
    vocab_size=32000,
    model_type="unigram",
    character_coverage=0.9995,
    byte_fallback=True,
    num_threads=16,
    input_sentence_size=5000000,
    shuffle_input_sentence=True,
)

sp = spm.SentencePieceProcessor(model_file="domain_unigram.model")
print(sp.encode("Acetaminophen 500mg PO q6h PRN", out_type=str))
```

**BPE vs Unigram:** BPE is deterministic — the same input always
produces the same tokens. Unigram can sample different tokenizations,
which acts as a regularizer during training. In practice, both produce
similar quality models.

### 3. WordPiece

Used by BERT and its descendants. Similar to BPE but uses a different
merge criterion.

```
BPE merges:      most frequent pair
WordPiece merges: pair that maximizes likelihood of training data

BPE asks:       "Which pair appears most often?"
WordPiece asks: "Which merge would make the training data most probable?"
```

```
WordPiece tokenization example:

"unrelated" → ["un", "##related"]

The "##" prefix means "this continues the previous token"
(no space before it)

"unhappiness" → ["un", "##happi", "##ness"]
```

WordPiece is rarely used for new models. BPE dominates the modern LLM
landscape. You mainly encounter WordPiece when working with BERT-family
models.

---

## Vocabulary Size Tradeoffs

This is one of the most impactful decisions. Here is the tradeoff:

```
                    Small Vocab              Large Vocab
                    (8K-16K)                 (64K-128K)
                    ─────────                ─────────
Sequence length     Longer (more tokens      Shorter (fewer tokens
                    per sentence)            per sentence)

Training speed      Slower (more tokens      Faster (fewer tokens
                    to process)              to process)

Embedding table     Small (fewer params      Large (more params
                    in embeddings)           in embeddings)

Rare word handling  Good (breaks into        May have dedicated
                    known subwords)          tokens for rare words

Memory per token    Less (smaller softmax)   More (bigger softmax)

Context window      Effectively shorter      Effectively longer
                    (more tokens per doc)    (fewer tokens per doc)
```

**Rules of thumb:**

```
Model Size        Recommended Vocab Size
──────────────────────────────────────────
< 500M params     8,000 - 16,000
500M - 3B         16,000 - 32,000
3B - 13B          32,000 - 64,000
13B+              32,000 - 128,000

Multilingual      64,000 - 128,000+
Code-heavy        32,000 - 64,000
Domain-specific   16,000 - 32,000
```

Llama uses 32,000. GPT-4 uses ~100,000. Gemma uses 256,000.
There is no single right answer.

### Measuring Vocabulary Efficiency

The key metric is **fertility** — how many tokens per word on average.

```python
def measure_fertility(tokenizer, test_texts):
    total_tokens = 0
    total_words = 0

    for text in test_texts:
        words = text.split()
        total_words += len(words)
        tokens = tokenizer.encode(text)
        total_tokens += len(tokens)

    fertility = total_tokens / total_words
    return fertility

general_tokenizer = load_tokenizer("gpt2")
custom_tokenizer = load_tokenizer("medical_bpe")

medical_texts = load_medical_corpus()

print(f"GPT-2 fertility: {measure_fertility(general_tokenizer, medical_texts):.2f}")
print(f"Custom fertility: {measure_fertility(custom_tokenizer, medical_texts):.2f}")
```

Lower fertility is better. A fertility of 1.0 means every word is a
single token. A fertility of 3.0 means every word gets split into
three pieces on average.

---

## Multilingual Tokenization

This is where custom tokenizers provide the biggest win. General
English tokenizers are deeply unfair to other languages.

```
English:  "Hello world"     → 2 tokens  (fertility ~1.3)
Japanese: "こんにちは世界"    → 7 tokens  (fertility ~3.5)
Arabic:   "مرحبا بالعالم"   → 9 tokens  (fertility ~4.5)
Thai:     "สวัสดีชาวโลก"    → 12 tokens (fertility ~6.0)

Same meaning, 2-6x more tokens. This means:
  - 2-6x higher inference cost
  - 2-6x shorter effective context
  - Worse quality due to fragmented representations
```

### Building a Balanced Multilingual Tokenizer

```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input="multilingual_corpus.txt",
    model_prefix="multilingual",
    vocab_size=64000,
    model_type="bpe",
    character_coverage=0.9999,
    byte_fallback=True,
    split_digits=True,
    num_threads=32,
    input_sentence_size=10000000,
    shuffle_input_sentence=True,
    max_sentence_length=4096,
)
```

The key parameter is `character_coverage`. For multilingual tokenizers,
set it to 0.9999 to ensure you cover characters from all your target
languages. For English-only, 0.9995 is sufficient.

**Data balancing for multilingual training:**

If your corpus is 90% English and 10% Japanese, the tokenizer will be
90% optimized for English. You need to oversample low-resource languages:

```python
import math

language_ratios = {
    "en": 0.40,
    "zh": 0.15,
    "ja": 0.10,
    "ko": 0.08,
    "de": 0.07,
    "fr": 0.07,
    "es": 0.05,
    "ar": 0.04,
    "hi": 0.04,
}

alpha = 0.3  # smoothing factor (0 = uniform, 1 = proportional)

smoothed = {}
total = sum(v ** alpha for v in language_ratios.values())
for lang, ratio in language_ratios.items():
    smoothed[lang] = (ratio ** alpha) / total

# English drops from 40% to ~22%, underrepresented languages increase
```

This "temperature sampling" approach (used by mBERT, XLM-R) prevents
dominant languages from hogging the vocabulary.

---

## Training on Domain Data

### Step-by-Step: Building a Code Tokenizer

```python
from tokenizers import (
    Tokenizer,
    models,
    trainers,
    pre_tokenizers,
    decoders,
    processors,
)
from tokenizers.normalizers import NFC

tokenizer = Tokenizer(models.BPE())

tokenizer.pre_tokenizer = pre_tokenizers.Sequence([
    pre_tokenizers.Split(
        pattern=r"(?<=[a-z])(?=[A-Z])",  # camelCase splitting
        behavior="isolated",
    ),
    pre_tokenizers.ByteLevel(add_prefix_space=False),
])

trainer = trainers.BpeTrainer(
    vocab_size=48000,
    special_tokens=[
        "<pad>", "<s>", "</s>", "<unk>",
        "<|fim_prefix|>", "<|fim_middle|>", "<|fim_suffix|>",
    ],
    min_frequency=3,
    show_progress=True,
    initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
)

code_files = [
    "python_corpus.txt",
    "javascript_corpus.txt",
    "rust_corpus.txt",
    "go_corpus.txt",
]
tokenizer.train(code_files, trainer)

tokenizer.decoder = decoders.ByteLevel()

test = "def getUserById(user_id: int) -> Optional[User]:"
encoded = tokenizer.encode(test)
print(f"Tokens: {encoded.tokens}")
print(f"Count:  {len(encoded.tokens)}")

tokenizer.save("code_tokenizer.json")
```

Notice the special tokens `<|fim_prefix|>`, `<|fim_middle|>`,
`<|fim_suffix|>`. These are for fill-in-the-middle training, where the
model learns to complete code given surrounding context. Essential for
code completion models.

---

## Tokenizer Evaluation Checklist

Run these checks before using your tokenizer in training:

```python
def evaluate_tokenizer(tokenizer, test_corpus, name="tokenizer"):
    total_chars = 0
    total_tokens = 0
    unknown_count = 0
    unk_id = tokenizer.token_to_id("<unk>")

    for text in test_corpus:
        total_chars += len(text)
        encoded = tokenizer.encode(text)
        total_tokens += len(encoded.ids)
        unknown_count += sum(1 for tid in encoded.ids if tid == unk_id)

        decoded = tokenizer.decode(encoded.ids)
        if decoded != text:
            print(f"ROUNDTRIP FAILURE: '{text[:50]}...'")

    compression = total_chars / total_tokens
    unk_rate = unknown_count / total_tokens if total_tokens > 0 else 0

    print(f"\n{name} Evaluation:")
    print(f"  Compression ratio: {compression:.2f} chars/token")
    print(f"  Unknown token rate: {unk_rate:.4%}")
    print(f"  Total tokens: {total_tokens:,}")
```

What to look for:

| Metric | Good | Bad |
|--------|------|-----|
| Compression ratio | 3.5-4.5 chars/token | < 2.0 or > 6.0 |
| Unknown rate | < 0.01% | > 0.1% |
| Roundtrip accuracy | 100% | Any failures |
| Domain fertility | < 1.5 tokens/word | > 3.0 tokens/word |

**Roundtrip accuracy is non-negotiable.** If encode followed by decode
does not produce the original text, your tokenizer is destroying
information. Fix this before anything else.

---

## Common Pitfalls

### 1. Whitespace Handling

Different tokenizers handle spaces differently. Some prepend a space
marker, some use byte-level encoding, some just strip spaces.

```
"Hello World" might tokenize as:
  ByteLevel BPE:  ["Hello", "ĠWorld"]       (Ġ = space)
  SentencePiece:  ["▁Hello", "▁World"]      (▁ = space)
  WordPiece:      ["Hello", "World"]         (space info lost!)
```

Always verify that your tokenizer preserves whitespace correctly.
Code is especially sensitive — indentation matters.

### 2. Number Tokenization

Most tokenizers butcher numbers. "2024" might become ["20", "24"]
or ["202", "4"]. This makes arithmetic impossible.

**Fix: Split digits individually.**

```python
spm.SentencePieceTrainer.train(
    ...
    split_digits=True,  # "2024" → ["2", "0", "2", "4"]
)
```

This gives the model clean, consistent number representations at the
cost of longer sequences for numbers.

### 3. Special Characters in Code

Brackets, braces, semicolons, operators. Make sure these are single
tokens, not split across pieces.

```python
important_tokens = [
    "->", "=>", "!=", "==", "<=", ">=", "<<", ">>",
    "&&", "||", "::", "..", "...", "/**", "*/",
    "    ",  # 4-space indent as one token
]

for token in important_tokens:
    encoded = tokenizer.encode(token)
    if len(encoded.ids) > 1:
        print(f"WARNING: '{token}' splits into {len(encoded.ids)} tokens")
```

---

## Key Takeaways

1. **A custom tokenizer can cut sequence lengths 30-50%** for domain
   data. This directly translates to faster and cheaper inference.

2. **BPE is the safe default.** Use SentencePiece Unigram if you need
   multilingual support or subword regularization.

3. **Vocabulary size 32K is the sweet spot** for most models. Go higher
   for multilingual, lower for small models.

4. **Always verify roundtrip accuracy.** If decode(encode(text)) != text,
   you have a bug.

5. **Multilingual tokenizers need balanced data.** Use temperature
   sampling to prevent English from dominating.

---

## Exercises

1. Train a BPE tokenizer on a code corpus (download from The Stack).
   Compare fertility against GPT-2's tokenizer on Python, Rust, and
   JavaScript files.

2. Train tokenizers with vocab_size 8K, 32K, and 64K on the same
   data. Measure compression ratio, training speed, and downstream
   model performance on a small-scale experiment.

3. Build a bilingual tokenizer for English and one non-Latin script
   language. Target fertility below 1.8 for both languages.
