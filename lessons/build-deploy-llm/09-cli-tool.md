# Lesson 09: CLI Tool Deployment

The second deliverable: a Python CLI tool that runs on any laptop
without a GPU. Type a prompt, get a code completion. pip-installable,
CPU-only, no CUDA required. This is the kind of tool you can hand to
a colleague and say "pip install this, then run it."

---

## The Core Idea

A CLI tool is the simplest possible deployment. No web server, no
browser, no cloud. Just a Python package that loads the model and
generates text from the command line.

```
CLI Tool — What the User Sees:

  $ pip install mini-llm-cli
  $ mini-llm "def fibonacci(n):"

  def fibonacci(n):
      if n <= 1:
          return n
      return fibonacci(n - 1) + fibonacci(n - 2)

  That is it. One command to install, one command to run.
```

---

## Project Structure

```
deploy/cli/
├── pyproject.toml          # Package metadata and build config
├── setup.py                # Backward-compatible setup
├── README.md               # Package documentation
└── mini_llm_cli/
    ├── __init__.py          # Package init
    ├── __main__.py          # Entry point: python -m mini_llm_cli
    ├── generate.py          # Generation logic
    ├── tokenizer.py         # BPE tokenizer (copied from main project)
    └── model/
        ├── model.onnx       # ONNX model file
        └── vocab.json       # Tokenizer vocabulary
```

---

## Step 1: Package Configuration

```toml
# deploy/cli/pyproject.toml

[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.backends._legacy:_Backend"

[project]
name = "mini-llm-cli"
version = "0.1.0"
description = "Python code completion using a small transformer model"
readme = "README.md"
requires-python = ">=3.9"
license = {text = "MIT"}

dependencies = [
    "numpy>=1.24",
    "onnxruntime>=1.16",
]

[project.scripts]
mini-llm = "mini_llm_cli.__main__:main"

[tool.setuptools.packages.find]
include = ["mini_llm_cli*"]

[tool.setuptools.package-data]
mini_llm_cli = ["model/*.onnx", "model/*.json"]
```

```python
# deploy/cli/setup.py — Backward-compatible setup

from setuptools import setup, find_packages

setup(
    name="mini-llm-cli",
    version="0.1.0",
    packages=find_packages(),
    package_data={
        "mini_llm_cli": ["model/*.onnx", "model/*.json"],
    },
    include_package_data=True,
    install_requires=[
        "numpy>=1.24",
        "onnxruntime>=1.16",
    ],
    entry_points={
        "console_scripts": [
            "mini-llm=mini_llm_cli.__main__:main",
        ],
    },
    python_requires=">=3.9",
)
```

---

## Step 2: The Tokenizer (Python, Standalone)

Copy the BPE tokenizer into the CLI package. It must be self-contained
— no imports from the main project.

```python
# deploy/cli/mini_llm_cli/tokenizer.py

import json
from pathlib import Path


class BPETokenizer:
    """Standalone BPE tokenizer for the CLI tool."""

    def __init__(self):
        self.merges = {}
        self.vocab = {}
        for i in range(256):
            self.vocab[i] = bytes([i])

    @classmethod
    def load(cls, path: str) -> "BPETokenizer":
        """Load tokenizer from vocab.json."""
        tokenizer = cls()
        with open(path, "r") as f:
            data = json.load(f)

        for pair_str, new_id in data["merges"].items():
            a, b = pair_str.split(",")
            pair = (int(a), int(b))
            tokenizer.merges[pair] = int(new_id)
            tokenizer.vocab[int(new_id)] = (
                tokenizer.vocab[pair[0]] + tokenizer.vocab[pair[1]]
            )

        return tokenizer

    def encode(self, text: str) -> list[int]:
        """Encode text to token IDs."""
        tokens = list(text.encode("utf-8"))
        for pair, new_id in self.merges.items():
            tokens = self._merge_pair(tokens, pair, new_id)
        return tokens

    def decode(self, token_ids: list[int]) -> str:
        """Decode token IDs to text."""
        byte_values = b""
        for tid in token_ids:
            byte_values += self.vocab.get(tid, b"?")
        return byte_values.decode("utf-8", errors="replace")

    def _merge_pair(self, tokens, pair, new_id):
        result = []
        i = 0
        while i < len(tokens):
            if (i < len(tokens) - 1 and
                    tokens[i] == pair[0] and tokens[i + 1] == pair[1]):
                result.append(new_id)
                i += 2
            else:
                result.append(tokens[i])
                i += 1
        return result
```

---

## Step 3: Generation Logic

```python
# deploy/cli/mini_llm_cli/generate.py

import numpy as np
import onnxruntime as ort
from pathlib import Path

from .tokenizer import BPETokenizer


class CodeGenerator:
    """Generate Python code completions using ONNX Runtime."""

    def __init__(self, model_dir: str = None):
        if model_dir is None:
            # Default: look for model files in the package
            model_dir = str(Path(__file__).parent / "model")

        model_path = str(Path(model_dir) / "model.onnx")
        vocab_path = str(Path(model_dir) / "vocab.json")

        # Load tokenizer
        self.tokenizer = BPETokenizer.load(vocab_path)

        # Load ONNX model (CPU only)
        self.session = ort.InferenceSession(
            model_path,
            providers=["CPUExecutionProvider"],
        )

    def generate(self, prompt: str, max_tokens: int = 100,
                 temperature: float = 0.8, top_k: int = 50,
                 stream: bool = False):
        """Generate code completion.

        Args:
            prompt: Input Python code
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (higher = more random)
            top_k: Top-k filtering (0 = no filtering)
            stream: If True, yield tokens one at a time

        Returns:
            Generated text (or generator if stream=True)
        """
        tokens = self.tokenizer.encode(prompt)

        if stream:
            return self._generate_stream(tokens, max_tokens,
                                          temperature, top_k)
        else:
            return self._generate_batch(tokens, max_tokens,
                                         temperature, top_k)

    def _generate_batch(self, tokens, max_tokens, temperature, top_k):
        """Generate all tokens at once, return complete text."""
        for _ in range(max_tokens):
            next_token = self._predict_next(tokens, temperature, top_k)
            tokens.append(next_token)

        return self.tokenizer.decode(tokens)

    def _generate_stream(self, tokens, max_tokens, temperature, top_k):
        """Generate tokens one at a time, yielding partial text."""
        for i in range(max_tokens):
            next_token = self._predict_next(tokens, temperature, top_k)
            tokens.append(next_token)

            # Yield the full text so far
            yield self.tokenizer.decode(tokens)

    def _predict_next(self, tokens, temperature, top_k):
        """Predict the next token given current tokens."""
        input_array = np.array([tokens], dtype=np.int64)

        logits = self.session.run(
            ["logits"],
            {"input_ids": input_array},
        )[0]

        # Last position logits
        next_logits = logits[0, -1, :].astype(np.float64) / temperature

        # Top-k filtering
        if top_k > 0:
            top_indices = np.argsort(next_logits)[-top_k:]
            mask = np.full_like(next_logits, -np.inf)
            mask[top_indices] = next_logits[top_indices]
            next_logits = mask

        # Softmax
        exp_logits = np.exp(next_logits - np.max(next_logits))
        probs = exp_logits / exp_logits.sum()

        # Sample
        return int(np.random.choice(len(probs), p=probs))
```

---

## Step 4: CLI Entry Point

```python
# deploy/cli/mini_llm_cli/__main__.py

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(
        prog="mini-llm",
        description="Python code completion using a small transformer model. "
                    "Runs locally on CPU — no GPU required.",
    )

    parser.add_argument(
        "prompt",
        nargs="?",
        help="Python code to complete. Use quotes for multi-line input.",
    )
    parser.add_argument(
        "-f", "--file",
        help="Read prompt from a file instead of command line.",
    )
    parser.add_argument(
        "-n", "--max-tokens",
        type=int,
        default=100,
        help="Maximum number of tokens to generate (default: 100).",
    )
    parser.add_argument(
        "-t", "--temperature",
        type=float,
        default=0.8,
        help="Sampling temperature. Higher = more random (default: 0.8).",
    )
    parser.add_argument(
        "-k", "--top-k",
        type=int,
        default=50,
        help="Top-k filtering. 0 = no filtering (default: 50).",
    )
    parser.add_argument(
        "--stream",
        action="store_true",
        help="Stream output token by token.",
    )
    parser.add_argument(
        "--model-dir",
        help="Path to directory containing model.onnx and vocab.json.",
    )

    args = parser.parse_args()

    # Get prompt
    if args.file:
        with open(args.file, "r") as f:
            prompt = f.read()
    elif args.prompt:
        prompt = args.prompt
    elif not sys.stdin.isatty():
        prompt = sys.stdin.read()
    else:
        parser.print_help()
        sys.exit(1)

    # Load model
    from .generate import CodeGenerator

    try:
        generator = CodeGenerator(model_dir=args.model_dir)
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        sys.exit(1)

    # Generate
    if args.stream:
        for partial_text in generator.generate(
            prompt,
            max_tokens=args.max_tokens,
            temperature=args.temperature,
            top_k=args.top_k,
            stream=True,
        ):
            # Clear line and reprint (simple streaming)
            sys.stdout.write(f"\r{partial_text}")
            sys.stdout.flush()
        print()  # Final newline
    else:
        result = generator.generate(
            prompt,
            max_tokens=args.max_tokens,
            temperature=args.temperature,
            top_k=args.top_k,
        )
        print(result)


if __name__ == "__main__":
    main()
```

```python
# deploy/cli/mini_llm_cli/__init__.py

"""Mini LLM CLI — Python code completion from the command line."""

__version__ = "0.1.0"
```

---

## Step 5: Prepare and Install

```python
# prepare_cli_deploy.py

import shutil
import os
from pathlib import Path


def prepare_cli_deployment():
    """Copy model files into the CLI package."""
    model_dir = Path("deploy/cli/mini_llm_cli/model")
    model_dir.mkdir(parents=True, exist_ok=True)

    # Copy ONNX model
    shutil.copy("deploy/model.onnx", model_dir / "model.onnx")

    # Copy tokenizer vocabulary
    shutil.copy("tokenizer/vocab.json", model_dir / "vocab.json")

    model_size = (model_dir / "model.onnx").stat().st_size
    print(f"CLI deployment ready:")
    print(f"  Model: {model_size / 1024 / 1024:.1f} MB")
    print(f"\nTo install:")
    print(f"  cd deploy/cli")
    print(f"  pip install -e .")
    print(f"\nTo run:")
    print(f'  mini-llm "def fibonacci(n):"')


prepare_cli_deployment()
```

```bash
# Install the CLI tool
cd deploy/cli
pip install -e .

# Test it
mini-llm "def fibonacci(n):"
mini-llm "class LinkedList:" --max-tokens 200 --temperature 0.7
mini-llm --file my_code.py --max-tokens 50
echo "import os" | mini-llm --stream
```

```
Usage Examples:

  $ mini-llm "def fibonacci(n):"
  def fibonacci(n):
      if n <= 1:
          return n
      return fibonacci(n - 1) + fibonacci(n - 2)

  $ mini-llm "class Stack:" --max-tokens 200
  class Stack:
      def __init__(self):
          self.items = []

      def push(self, item):
          self.items.append(item)

      def pop(self):
          if self.is_empty():
              raise IndexError("pop from empty stack")
          return self.items.pop()

      def is_empty(self):
          return len(self.items) == 0

  $ mini-llm -f partial_code.py -n 50 -t 0.5
  [completes the code in the file]

  $ echo "import os\nimport sys\n\ndef main():" | mini-llm
  [reads from stdin and completes]
```

---

## Package README

```markdown
<!-- deploy/cli/README.md -->

# mini-llm-cli

Python code completion using a small transformer model.
Runs entirely on CPU — no GPU required.

## Install

```bash
pip install mini-llm-cli
```

## Usage

```bash
# Basic usage
mini-llm "def fibonacci(n):"

# With options
mini-llm "class Stack:" --max-tokens 200 --temperature 0.7

# From a file
mini-llm --file my_code.py

# Streaming output
mini-llm "import os" --stream

# From stdin
echo "def hello():" | mini-llm
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-n`, `--max-tokens` | Max tokens to generate | 100 |
| `-t`, `--temperature` | Sampling temperature | 0.8 |
| `-k`, `--top-k` | Top-k filtering | 50 |
| `--stream` | Stream output | off |
| `--model-dir` | Custom model directory | bundled |
| `-f`, `--file` | Read prompt from file | - |

## Requirements

- Python 3.9+
- No GPU required (CPU-only inference)
- ~60MB disk space for model files
```

---

## Exercises

### Exercise 1: Install and Test

Prepare the CLI deployment, install it with pip, and test with at
least 5 different prompts. Verify:
- Installation works without errors
- `mini-llm` command is available
- Generation produces reasonable Python code
- `--file` and stdin modes work

### Exercise 2: Add Interactive Mode

Add an `--interactive` flag that starts a REPL-like session:

```
$ mini-llm --interactive
Mini LLM Interactive Mode (type 'quit' to exit)

>>> def fibonacci(n):
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

>>> class Stack:
class Stack:
    ...
```

### Exercise 3: Benchmark CLI Performance

Measure end-to-end latency for the CLI tool:
- Model loading time
- Time to generate 50 tokens
- Time to generate 200 tokens

Compare with the ONNX Runtime benchmark from Lesson 07.

---

Next: [Deployment Checklist Reference](./reference-deployment-checklist.md)
