# Lesson 02: Building a Tokenizer from Scratch

Before your model can read Python code, it needs to turn text into
numbers. That is what a tokenizer does. In this lesson, you will build
a Byte Pair Encoding (BPE) tokenizer from scratch in pure Python — no
Hugging Face, no sentencepiece, no libraries. Just you and the algorithm.

For a deeper dive into tokenizer design choices and advanced techniques,
see [Advanced LLM Engineering Lesson 02: Custom Tokenizers](../advanced-llm-engineering/02-custom-tokenizers.md).

---

## The Core Idea

Think of a tokenizer like a text compression algorithm. Instead of
storing every character individually, you find common patterns and give
them short codes.

```
Without tokenization (character-level):
  "def hello" → ['d', 'e', 'f', ' ', 'h', 'e', 'l', 'l', 'o']
  9 tokens for 9 characters. No compression.

With BPE tokenization:
  "def hello" → ['def', ' hello']
  2 tokens for 9 characters. Much better.

The trade-off:
  Fewer tokens = faster training, longer effective context
  But vocabulary must be learned from data first
```

BPE works by starting with individual bytes (256 possible values) and
repeatedly merging the most frequent pair of adjacent tokens into a new
token. After enough merges, common words and patterns become single
tokens.

```
BPE Merge Process:

  Start:  ['d', 'e', 'f', ' ', 'h', 'e', 'l', 'l', 'o']

  Most frequent pair: ('l', 'l') → merge into 'll'
  Result: ['d', 'e', 'f', ' ', 'h', 'e', 'll', 'o']

  Most frequent pair: ('d', 'e') → merge into 'de'
  Result: ['de', 'f', ' ', 'h', 'e', 'll', 'o']

  Most frequent pair: ('de', 'f') → merge into 'def'
  Result: ['def', ' ', 'h', 'e', 'll', 'o']

  Most frequent pair: ('ll', 'o') → merge into 'llo'
  Result: ['def', ' ', 'h', 'e', 'llo']

  ... and so on until we reach our target vocabulary size
```

---

## Step 1: Byte-Level Encoding

Everything starts as bytes. This guarantees we can encode any text —
including Unicode, emojis, and binary data — without "unknown token"
problems.

```python
# tokenizer/bpe.py — Part 1: Byte-level foundation

class BPETokenizer:
    """A byte-level BPE tokenizer built from scratch."""

    def __init__(self):
        # Base vocabulary: 256 byte values
        # Each byte gets its own token ID (0-255)
        self.merges = {}          # (token_a, token_b) → merged_token_id
        self.vocab = {}           # token_id → bytes
        self.inverse_vocab = {}   # bytes → token_id

        # Initialize with single bytes
        for i in range(256):
            self.vocab[i] = bytes([i])
            self.inverse_vocab[bytes([i])] = i

        self.next_id = 256  # Next available token ID

    def _text_to_bytes(self, text: str) -> list[int]:
        """Convert text to a list of byte-level token IDs."""
        return list(text.encode("utf-8"))

    def _bytes_to_text(self, token_ids: list[int]) -> str:
        """Convert token IDs back to text."""
        byte_values = b""
        for tid in token_ids:
            byte_values += self.vocab[tid]
        return byte_values.decode("utf-8", errors="replace")
```

```
Byte-Level Encoding:

  Text: "def"
    ↓ UTF-8 encode
  Bytes: [100, 101, 102]
    ↓ Each byte is a token ID
  Tokens: [100, 101, 102]

  Text: "π"  (Greek pi)
    ↓ UTF-8 encode
  Bytes: [207, 128]
    ↓ Two bytes = two tokens
  Tokens: [207, 128]

  Key insight: We never get "unknown" tokens because
  every possible byte (0-255) is in our vocabulary.
```

---

## Step 2: Counting Pairs

The core of BPE: find the most frequent adjacent pair of tokens.

```python
# tokenizer/bpe.py — Part 2: Pair counting

    def _count_pairs(self, token_lists: list[list[int]]) -> dict:
        """Count frequency of adjacent token pairs across all sequences."""
        pair_counts = {}
        for tokens in token_lists:
            for i in range(len(tokens) - 1):
                pair = (tokens[i], tokens[i + 1])
                pair_counts[pair] = pair_counts.get(pair, 0) + 1
        return pair_counts

    def _merge_pair(self, tokens: list[int], pair: tuple, new_id: int) -> list[int]:
        """Replace all occurrences of pair in tokens with new_id."""
        result = []
        i = 0
        while i < len(tokens):
            # Check if this position matches the pair
            if i < len(tokens) - 1 and tokens[i] == pair[0] and tokens[i + 1] == pair[1]:
                result.append(new_id)
                i += 2  # Skip both tokens in the pair
            else:
                result.append(tokens[i])
                i += 1
        return result
```

---

## Step 3: Training the Tokenizer

Training means: repeatedly find the most frequent pair, merge it, and
add the merged token to the vocabulary. Repeat until we reach the
desired vocabulary size.

```python
# tokenizer/bpe.py — Part 3: Training

    def train(self, text: str, vocab_size: int = 8192, verbose: bool = True):
        """Train BPE tokenizer on text data.

        Args:
            text: Training text (all your Python code concatenated)
            vocab_size: Target vocabulary size (256 base + N merges)
            verbose: Print progress during training
        """
        assert vocab_size > 256, "vocab_size must be > 256 (base byte vocabulary)"
        num_merges = vocab_size - 256

        # Start with byte-level tokens
        token_ids = self._text_to_bytes(text)

        # Split into chunks for efficiency (process in segments)
        chunk_size = 100_000
        chunks = []
        for i in range(0, len(token_ids), chunk_size):
            chunks.append(token_ids[i:i + chunk_size])

        if verbose:
            print(f"Training BPE tokenizer:")
            print(f"  Text length: {len(token_ids):,} bytes")
            print(f"  Target vocab size: {vocab_size}")
            print(f"  Merges to learn: {num_merges}")
            print()

        for merge_idx in range(num_merges):
            # Count all adjacent pairs across chunks
            pair_counts = {}
            for chunk in chunks:
                for i in range(len(chunk) - 1):
                    pair = (chunk[i], chunk[i + 1])
                    pair_counts[pair] = pair_counts.get(pair, 0) + 1

            if not pair_counts:
                break

            # Find the most frequent pair
            best_pair = max(pair_counts, key=pair_counts.get)
            best_count = pair_counts[best_pair]

            # Create new token
            new_id = self.next_id
            self.merges[best_pair] = new_id
            self.vocab[new_id] = self.vocab[best_pair[0]] + self.vocab[best_pair[1]]
            self.inverse_vocab[self.vocab[new_id]] = new_id
            self.next_id += 1

            # Apply merge to all chunks
            chunks = [self._merge_pair(chunk, best_pair, new_id) for chunk in chunks]

            if verbose and (merge_idx + 1) % 500 == 0:
                total_tokens = sum(len(c) for c in chunks)
                token_repr = self.vocab[new_id]
                try:
                    display = token_repr.decode("utf-8")
                except UnicodeDecodeError:
                    display = str(token_repr)
                print(f"  Merge {merge_idx + 1}/{num_merges}: "
                      f"{best_pair} → {new_id} "
                      f"('{display}', count={best_count}, "
                      f"total_tokens={total_tokens:,})")

        if verbose:
            total_tokens = sum(len(c) for c in chunks)
            ratio = len(token_ids) / total_tokens
            print(f"\nDone! Compression ratio: {ratio:.1f}x")
            print(f"  Original: {len(token_ids):,} tokens (bytes)")
            print(f"  After BPE: {total_tokens:,} tokens")
            print(f"  Vocabulary size: {len(self.vocab)}")
```

```
Training Progress (example):

  Training BPE tokenizer:
    Text length: 52,428,800 bytes
    Target vocab size: 8192
    Merges to learn: 7936

    Merge  500/7936: (32, 32) → 756  ('  ', count=8421033)
    Merge 1000/7936: (101, 108) → 1256 ('el', count=412889)
    Merge 1500/7936: (115, 101) → 1756 ('se', count=298112)
    ...

  Done! Compression ratio: 3.8x
    Original: 52,428,800 tokens (bytes)
    After BPE: 13,797,052 tokens
    Vocabulary size: 8192
```

---

## Step 4: Encode and Decode

Once trained, the tokenizer needs to encode new text (text → token IDs)
and decode token IDs back to text.

```python
# tokenizer/bpe.py — Part 4: Encode and Decode

    def encode(self, text: str) -> list[int]:
        """Encode text into token IDs using learned merges."""
        # Start with byte-level tokens
        tokens = self._text_to_bytes(text)

        # Apply merges in the order they were learned
        # (This is the key insight: merge order matters!)
        for pair, new_id in self.merges.items():
            tokens = self._merge_pair(tokens, pair, new_id)

        return tokens

    def decode(self, token_ids: list[int]) -> str:
        """Decode token IDs back to text."""
        byte_values = b""
        for tid in token_ids:
            if tid in self.vocab:
                byte_values += self.vocab[tid]
            else:
                byte_values += b"?"  # Unknown token fallback
        return byte_values.decode("utf-8", errors="replace")
```

---

## Step 5: Save and Load

You train the tokenizer once, then save it. Every other part of the
pipeline loads the saved tokenizer.

```python
# tokenizer/bpe.py — Part 5: Persistence

    def save(self, path: str):
        """Save tokenizer to a JSON file."""
        import json

        data = {
            "merges": {f"{a},{b}": new_id for (a, b), new_id in self.merges.items()},
            "vocab_size": len(self.vocab),
        }
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Saved tokenizer ({len(self.vocab)} tokens) to {path}")

    @classmethod
    def load(cls, path: str) -> "BPETokenizer":
        """Load tokenizer from a JSON file."""
        import json

        with open(path, "r") as f:
            data = json.load(f)

        tokenizer = cls()
        for pair_str, new_id in data["merges"].items():
            a, b = pair_str.split(",")
            pair = (int(a), int(b))
            tokenizer.merges[pair] = int(new_id)
            tokenizer.vocab[int(new_id)] = tokenizer.vocab[pair[0]] + tokenizer.vocab[pair[1]]
            tokenizer.inverse_vocab[tokenizer.vocab[int(new_id)]] = int(new_id)
            tokenizer.next_id = max(tokenizer.next_id, int(new_id) + 1)

        print(f"Loaded tokenizer ({len(tokenizer.vocab)} tokens) from {path}")
        return tokenizer
```

---

## Putting It All Together

```python
# train_tokenizer.py — Complete training script

from tokenizer.bpe import BPETokenizer


def main():
    # Load training data
    with open("data/train.txt", "r", encoding="utf-8") as f:
        text = f.read()

    print(f"Training data: {len(text) / 1024 / 1024:.1f}MB")

    # Train tokenizer
    tokenizer = BPETokenizer()
    tokenizer.train(text, vocab_size=8192, verbose=True)

    # Save
    tokenizer.save("tokenizer/vocab.json")

    # Test encode/decode roundtrip
    test_code = '''def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
'''

    tokens = tokenizer.encode(test_code)
    decoded = tokenizer.decode(tokens)

    print(f"\nRoundtrip test:")
    print(f"  Original length: {len(test_code)} chars")
    print(f"  Token count: {len(tokens)}")
    print(f"  Compression: {len(test_code) / len(tokens):.1f}x")
    print(f"  Roundtrip match: {decoded == test_code}")
    print(f"\nTokens: {tokens[:20]}...")
    print(f"Decoded: {decoded[:80]}...")


if __name__ == "__main__":
    main()
```

```
Expected Output:

  Training data: 95.2MB
  Training BPE tokenizer:
    Text length: 99,876,543 bytes
    Target vocab size: 8192
    Merges to learn: 7936
    ...
  Done! Compression ratio: 3.8x

  Saved tokenizer (8192 tokens) to tokenizer/vocab.json

  Roundtrip test:
    Original length: 89 chars
    Token count: 24
    Compression: 3.7x
    Roundtrip match: True
```

---

## Why BPE Works Well for Code

```
BPE learns code-specific tokens:

  Common Python tokens our BPE will learn:
  ┌──────────────────────────────────────┐
  │  "def "    "return "   "import "     │
  │  "self."   "    "      "if "         │
  │  "class "  "print("   "for "        │
  │  "None"    "True"     "False"       │
  │  "__init__" "self,"   ":\n"         │
  └──────────────────────────────────────┘

  These are exactly the patterns that appear
  most frequently in Python code. BPE discovers
  them automatically from the data.
```

---

## Connection to ML

The tokenizer is the first component in the pipeline. Every other
component depends on it:

- The **embedding layer** maps token IDs to vectors (Lesson 03)
- The **training data** is stored as token ID sequences (Lesson 04)
- The **model output** is a probability distribution over token IDs (Lesson 05)
- The **ONNX export** must include the tokenizer vocabulary (Lesson 07)

If the tokenizer is wrong, everything downstream is wrong.

See [LLMs & Transformers Lesson 02: Tokenization](../llms-transformers/02-tokenization.md)
for the theory behind tokenization and how production models handle it.

---

## Exercises

### Exercise 1: Train Your Tokenizer

Run the complete training script on your Python dataset. Verify:
- The vocabulary has exactly 8192 tokens
- Encode/decode roundtrip produces identical text
- Common Python keywords are single tokens

### Exercise 2: Inspect the Vocabulary

Write a function that prints the top 50 most "interesting" tokens
(longest byte sequences). What Python patterns did BPE discover?

```python
def inspect_vocab(tokenizer, top_n=50):
    """Print the longest tokens in the vocabulary."""
    tokens_by_length = sorted(
        tokenizer.vocab.items(),
        key=lambda x: len(x[1]),
        reverse=True
    )
    for tid, token_bytes in tokens_by_length[:top_n]:
        try:
            display = token_bytes.decode("utf-8")
        except UnicodeDecodeError:
            display = repr(token_bytes)
        print(f"  ID {tid:5d}: ({len(token_bytes):2d} bytes) '{display}'")
```

### Exercise 3: Compression Analysis

Encode 10 different Python files and compute the compression ratio
for each. Which files compress best? Which compress worst? Why?

---

Next: [Lesson 03: Building the Transformer](./03-transformer-architecture.md)
