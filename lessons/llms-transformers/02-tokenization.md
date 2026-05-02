# Lesson 02: Tokenization — How Text Becomes Numbers

Neural networks do math. They multiply matrices, add vectors, compute
gradients. They cannot read "hello" — they need numbers. Tokenization
is the process of converting text into numbers the model can work with.

This is NOT a boring preprocessing step. Tokenization decisions directly
affect what the model can and cannot do. It is why LLMs struggle to count
letters in a word or reverse a string.

---

## The Problem

```
Human sees:     "Hello, how are you?"
Computer needs: [15496, 11, 703, 527, 499, 30]
```

How do you convert text to numbers? There are three obvious approaches,
and they all have problems.

---

## Approach 1: Character-Level

Split text into individual characters. Each character gets a number.

```
"Hello" → ["H", "e", "l", "l", "o"] → [72, 101, 108, 108, 111]
```

**Pros:**
- Tiny vocabulary (~256 characters for ASCII, ~65k for Unicode)
- Can handle ANY word, even made-up ones like "covfefe"
- No unknown words ever

**Cons:**
- Sequences become very long ("transformer" = 11 tokens)
- Each character carries almost no meaning on its own
- Model has to learn that "c", "a", "t" together mean a furry animal
- Like reading a book one letter at a time — you lose the big picture

**The analogy:** Imagine describing a painting pixel by pixel. Yes, all the
information is there, but it is incredibly inefficient. You want to describe
shapes and objects, not individual dots.

---

## Approach 2: Word-Level

Split text on spaces and punctuation. Each word gets a number.

```
"Hello, how are you?" → ["Hello", ",", "how", "are", "you", "?"]
                      → [4521, 2, 891, 67, 301, 3]
```

**Pros:**
- Each token carries clear meaning
- Sequences are short
- Natural unit for language

**Cons:**
- Vocabulary is HUGE (English has 170,000+ words)
- What about "unhappiness"? "preprocessing"? "GPT-4"?
- What about typos: "teh"? New words: "ChatGPT"?
- Every unseen word becomes [UNK] (unknown) — the model is blind to it

**The analogy:** Imagine a dictionary where you can only look up whole words.
If someone says "ungooglable," you are stuck. You cannot break it into
"un-" + "google" + "-able" and figure out the meaning.

---

## Approach 3: Subword Tokenization — The Sweet Spot

The insight: split words into meaningful pieces. Common words stay whole.
Rare words get split into common parts.

```
"unhappiness" → ["un", "happi", "ness"]
"transformer" → ["transform", "er"]
"ChatGPT"     → ["Chat", "G", "PT"]
"preprocessing" → ["pre", "process", "ing"]
```

**Why this works:**
- "un-" means "not" in many words: unhappy, unlikely, unfair
- "-ness" means "state of" in many words: happiness, sadness, darkness
- "-ing" means ongoing action: running, coding, eating
- The model learns these subword patterns and can handle new words

**The analogy:** When you encounter a word you have never seen before, you do
not give up. You break it into parts you recognize. "Antidisestablishmentarianism"
is intimidating, but "anti-dis-establish-ment-arian-ism" is parseable. Subword
tokenization does this automatically.

---

## BPE: Byte Pair Encoding (The Algorithm GPT Uses)

BPE is the most common subword tokenization algorithm. GPT-2, GPT-3, GPT-4,
and many other models use it (or variants of it).

### The core idea

Start with individual characters. Repeatedly merge the most frequent pair
of adjacent tokens into a new token. Stop when you reach your desired
vocabulary size.

### Step by step

Starting corpus: `"low low low low low lower lower newest newest widest"`

**Step 0:** Split every word into characters (with a special end-of-word marker `_`)

```
l o w _     (appears 5 times: "low" x5)
l o w e r _ (appears 2 times: "lower" x2)
n e w e s t _ (appears 2 times: "newest" x2)
w i d e s t _ (appears 1 time: "widest" x1)
```

**Step 1:** Count all adjacent pairs
```
(l, o)  → 7 times   ← MOST FREQUENT
(o, w)  → 7 times
(w, _)  → 5 times
(w, e)  → 4 times
(e, r)  → 2 times
(r, _)  → 2 times
(e, s)  → 3 times
(s, t)  → 3 times
(t, _)  → 3 times
(n, e)  → 2 times
(w, i)  → 1 time
(i, d)  → 1 time
(d, e)  → 1 time
```

Merge the most frequent pair: `(l, o)` → `lo`

**Step 2:** Updated corpus
```
lo w _      (5 times)
lo w e r _  (2 times)
n e w e s t _ (2 times)
w i d e s t _ (1 time)
```

Count pairs again. Most frequent: `(lo, w)` → merge to `low`

**Step 3:** Updated corpus
```
low _       (5 times)
low e r _   (2 times)
n e w e s t _ (2 times)
w i d e s t _ (1 time)
```

Next most frequent: `(low, _)` → merge to `low_`

**Step 4:** Updated corpus
```
low_        (5 times)
low e r _   (2 times)
n e w e s t _ (2 times)
w i d e s t _ (1 time)
```

Continue merging: `(e, s)` → `es`, then `(es, t)` → `est`, etc.

After enough merges, the vocabulary contains:
```
Individual chars: a, b, c, ..., z, _
Learned merges:   lo, low, low_, er, es, est, est_, new, ...
```

Common words like "low" become single tokens. Rare words get split into
known subwords.

### Python: BPE from scratch

```python
from collections import Counter

def get_pairs(tokens_list):
    pairs = Counter()
    for tokens, freq in tokens_list:
        for i in range(len(tokens) - 1):
            pairs[(tokens[i], tokens[i + 1])] += freq
    return pairs


def merge_pair(pair, tokens_list):
    merged = []
    target = pair[0] + pair[1]
    for tokens, freq in tokens_list:
        new_tokens = []
        i = 0
        while i < len(tokens):
            if i < len(tokens) - 1 and tokens[i] == pair[0] and tokens[i + 1] == pair[1]:
                new_tokens.append(target)
                i += 2
            else:
                new_tokens.append(tokens[i])
                i += 1
        merged.append((tuple(new_tokens), freq))
    return merged


def train_bpe(corpus, num_merges):
    tokens_list = []
    for word, freq in corpus.items():
        chars = tuple(word) + ("_",)
        tokens_list.append((chars, freq))

    merges = []
    for step in range(num_merges):
        pairs = get_pairs(tokens_list)
        if not pairs:
            break
        best_pair = pairs.most_common(1)[0][0]
        merges.append(best_pair)
        tokens_list = merge_pair(best_pair, tokens_list)
        print(f"Merge {step + 1}: {best_pair[0]} + {best_pair[1]} → {best_pair[0] + best_pair[1]}")

    return merges, tokens_list


corpus = {"low": 5, "lower": 2, "newest": 2, "widest": 1}
merges, result = train_bpe(corpus, num_merges=10)

print("\nFinal tokenization:")
for tokens, freq in result:
    print(f"  {' '.join(tokens)} (x{freq})")
```

---

## Real-World Tokenization Examples

### GPT-4 tokenization (using tiktoken)

```python
import tiktoken

enc = tiktoken.encoding_for_model("gpt-4")

examples = [
    "Hello, world!",
    "unhappiness",
    "The transformer architecture",
    "def fibonacci(n):",
    "antidisestablishmentarianism",
    "   spaces   matter   ",
    "GPT-4 is great",
]

for text in examples:
    tokens = enc.encode(text)
    decoded = [enc.decode([t]) for t in tokens]
    print(f"'{text}'")
    print(f"  Tokens: {decoded}")
    print(f"  IDs:    {tokens}")
    print(f"  Count:  {len(tokens)}")
    print()
```

Sample output (approximate):
```
'Hello, world!'
  Tokens: ['Hello', ',', ' world', '!']
  IDs:    [9906, 11, 1917, 0]
  Count:  4

'unhappiness'
  Tokens: ['unh', 'app', 'iness']
  IDs:    [...some numbers...]
  Count:  3

'antidisestablishmentarianism'
  Tokens: ['ant', 'idis', 'establish', 'ment', 'arian', 'ism']
  IDs:    [...]
  Count:  6
```

Notice:
- Common words like "Hello" stay as one token
- Spaces are attached to the following word (" world")
- Long words get split into recognizable subwords

---

## The Vocabulary Size Tradeoff

```
Smaller vocabulary (e.g., 8,000 tokens):
  + Fewer parameters in the embedding layer
  + Model sees each token more often during training
  - Every sentence becomes MANY tokens (longer sequences)
  - Each token carries less meaning
  - "transformer" might be ["trans", "form", "er"] = 3 tokens

Larger vocabulary (e.g., 100,000 tokens):
  + Shorter sequences (fewer tokens per sentence)
  + Each token carries more meaning
  - More parameters in the embedding layer
  - Rare tokens are seen less often during training
  - "transformer" might be ["transformer"] = 1 token
```

Most modern models use 32,000 to 100,000 tokens:
```
GPT-2:    50,257 tokens
GPT-4:    ~100,000 tokens
Llama 2:  32,000 tokens
Claude:   ~100,000 tokens
```

**The analogy:** Vocabulary size is like choosing your unit of measurement.
Measure a room in millimeters? Very precise, but lots of numbers. Measure in
kilometers? Few numbers, but you lose detail. Meters is the sweet spot for
rooms. Subword tokens are the sweet spot for text.

---

## Special Tokens

Models use special tokens for structure:

```
[BOS] or <s>     Beginning of sequence — "I'm starting to read"
[EOS] or </s>    End of sequence — "I'm done"
[PAD]            Padding — filler for batching (making sequences same length)
[UNK]            Unknown — fallback for truly unrecognizable input
[CLS]            Classification — BERT uses this for sentence-level tasks
[SEP]            Separator — marks boundaries between segments
[MASK]           Mask — BERT training: "predict this hidden word"
```

In GPT-style models, special tokens mark boundaries:

```
<|system|>You are a helpful assistant.<|end|>
<|user|>What is Python?<|end|>
<|assistant|>Python is a programming language...<|end|>
```

These are actual tokens in the vocabulary, with their own IDs and embeddings.
The model learns that `<|user|>` means "a human is talking" and
`<|assistant|>` means "now I should respond helpfully."

---

## How Tokenization Affects Model Behavior

Tokenization is not just plumbing — it directly impacts what the model can do.

### Why LLMs struggle with letter counting

```
Question: "How many letters are in 'strawberry'?"

What the model sees (tokens): ["str", "aw", "berry"]

The model does not see individual letters! It sees 3 tokens.
It has to figure out letter count from subword tokens,
which is not what it was trained to do.
```

This is why LLMs often get letter-counting questions wrong. They are
processing text at the subword level, not the character level.

### Why LLMs struggle with string reversal

```
Question: "Reverse the word 'hello'"

Tokens: ["hello"] or ["hel", "lo"]

The model would need to decompose the token into characters,
reverse them, and recompose. This is not natural for a system
that thinks in subword chunks.
```

### Tokenization and arithmetic

```
"12345 + 67890" might tokenize as:
["123", "45", " +", " ", "678", "90"]

The numbers are split at arbitrary boundaries!
"123" and "45" are separate tokens — the model has to learn
that they form the number 12345. This makes arithmetic hard.
```

### Language bias

BPE trained on mostly English text will be efficient for English but
wasteful for other languages:

```
English: "Hello"        → 1 token
Korean:  "안녕하세요"      → 3-5 tokens
Arabic:  "مرحبا"         → 3-4 tokens
```

The same meaning takes more tokens in non-English languages, which means:
- Shorter effective context window for non-English text
- Higher cost (APIs charge per token)
- Potentially worse performance

---

## From Tokens to Embeddings: The Lookup

Once text is tokenized into token IDs, each ID is converted to a vector
using an embedding table. This is a giant lookup table learned during training.

```
Token ID → Embedding Vector

15496 → [0.023, -0.441, 0.782, ..., 0.119]    (768 numbers for GPT-2)
   11 → [-0.336, 0.091, -0.227, ..., 0.558]
  703 → [0.712, 0.004, 0.339, ..., -0.891]
```

```
         Tokenize              Embed
"Hello" ─────────→ [15496] ─────────→ [0.023, -0.441, 0.782, ...]
                                       ↑
                                       768-dimensional vector
                                       (GPT-2)
```

The embedding table has `vocab_size x embedding_dim` parameters:
```
GPT-2:   50,257 tokens x 768 dims  =  38.6 million parameters (just for embeddings!)
GPT-3:   50,257 tokens x 12,288 dims = 617 million parameters
```

These embeddings are LEARNED. During training, the model adjusts these
vectors so that similar tokens end up near each other in vector space —
just like Word2Vec from Track 7, but learned end-to-end with the rest of
the model.

---

## Trying It Yourself

### Using tiktoken (OpenAI's tokenizer)

```python
import tiktoken

enc = tiktoken.encoding_for_model("gpt-4")

text = "The transformer architecture revolutionized natural language processing."

tokens = enc.encode(text)
print(f"Text: {text}")
print(f"Token IDs: {tokens}")
print(f"Number of tokens: {len(tokens)}")
print()

for token_id in tokens:
    token_text = enc.decode([token_id])
    print(f"  {token_id:>6} → '{token_text}'")
```

### Using HuggingFace tokenizers

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

text = "The transformer architecture is fascinating."
encoded = tokenizer(text)

print(f"Token IDs: {encoded['input_ids']}")
print(f"Tokens: {tokenizer.convert_ids_to_tokens(encoded['input_ids'])}")
print(f"Decoded: {tokenizer.decode(encoded['input_ids'])}")
```

### Interactive exploration

OpenAI has a free tokenizer tool at platform.openai.com/tokenizer.
Paste text and see how it splits into tokens in real time. Try:
- English vs other languages
- Code vs prose
- Numbers and math expressions
- Made-up words

---

## The Full Pipeline

```
                 Tokenize         Lookup            Model
"Hello world" ──────────→ [15496, 1917] ──────→ [vec1, vec2] ──────→ predictions
    text           token IDs          embeddings         transformer
                                   (768 dims each)       layers
```

This pipeline runs for EVERY piece of text the model processes:
1. **Tokenize:** Split text into subword tokens, convert to IDs
2. **Embed:** Look up each ID in the embedding table to get a vector
3. **Process:** Feed the sequence of vectors through transformer layers
4. **Predict:** Output a probability distribution over the vocabulary

Steps 1-2 happen before the model. Step 4 happens after. The transformer
(steps 3) is where the magic happens — and that is what the rest of this
track is about.

---

## Key Takeaways

```
1. Computers need numbers, not text. Tokenization bridges the gap.

2. Character-level is too granular. Word-level can not handle new words.
   Subword tokenization is the sweet spot.

3. BPE: start with characters, repeatedly merge frequent pairs.
   Common words stay whole, rare words split into known parts.

4. Vocabulary size is a tradeoff: smaller = longer sequences,
   larger = more parameters. Most models use 32k-100k tokens.

5. Tokenization directly affects model capabilities: letter counting,
   arithmetic, and non-English performance are all impacted.

6. Token IDs become embedding vectors through a learned lookup table.
   These embeddings are the actual input to the transformer.
```

---

## Exercises

### Exercise 1: Manual BPE
Take the string "abracadabra" and manually run BPE for 5 merge steps.
What tokens do you end up with?

### Exercise 2: Tokenization surprises
Using tiktoken or the OpenAI tokenizer tool, find:
1. A common English word that becomes more than 2 tokens
2. A short word that is a single token
3. How "  " (multiple spaces) tokenizes
4. How code `for i in range(10):` tokenizes

### Exercise 3: Token count estimation
Without using a tokenizer, estimate how many tokens these sentences use.
Then check with tiktoken. How close were you?
1. "The quick brown fox jumps over the lazy dog."
2. "def quicksort(arr): return arr if len(arr) <= 1 else ..."
3. "supercalifragilisticexpialidocious"

### Exercise 4: Why tokenization matters
Explain in your own words why the sentence "How many r's are in strawberry?"
is a hard question for GPT. What would need to change about tokenization
to make it easy?

### Exercise 5: Build a tokenizer
Extend the BPE Python code above. Feed it a paragraph from Wikipedia and
train with 100 merges. Then tokenize a new sentence that was NOT in the
training data. How well does it handle unseen words?

---

## What is next

We now know how text becomes numbers. But in 2014, there was a fundamental
problem with how sequence models (RNNs) processed these numbers: the
bottleneck problem. Understanding this problem is essential to appreciating
why transformers were such a breakthrough. [Lesson 03](./03-seq2seq-bottleneck.md)
explains the sequence-to-sequence architecture and its fatal flaw.

---

[Next: Lesson 03 — The Seq2Seq Bottleneck](./03-seq2seq-bottleneck.md) | [Back to Roadmap](./00-roadmap.md)
