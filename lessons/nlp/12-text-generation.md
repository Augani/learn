# Lesson 12: Text Generation — Decoding Strategies

## The Big Analogy: Choosing the Next Word in a Story

```
DECODING = HOW THE MODEL PICKS THE NEXT WORD

  The cat sat on the ___

  Greedy:      "mat"  (always pick highest probability)
  Beam Search: "mat" OR "roof" (explore top paths)
  Sampling:    "sofa" (randomly from distribution)
  Top-k:       "mat"/"roof"/"chair" (random from top 3)
  Nucleus:     "mat"/"roof" (random from top 90% probability mass)

  Think of it like autocomplete:
  Greedy   = always pick the #1 suggestion
  Sampling = sometimes pick #2 or #3 for variety
  Nucleus  = pick from suggestions until you've covered 90% likely
```

## How Language Models Generate Text

```
AUTOREGRESSIVE GENERATION

  Input:  "The cat"
               |
               v
  +-------------------+
  |  Language Model    |
  | (GPT, LLaMA, etc) |
  +-------------------+
               |
               v
  Probability distribution over vocabulary:
  "sat":  0.25
  "is":   0.18
  "ran":  0.12
  "was":  0.10
  "the":  0.03
  ...     ...
  (50,000+ words)

  Pick one word, append it, repeat:
  "The cat" -> "sat" -> "The cat sat"
  "The cat sat" -> "on" -> "The cat sat on"
  "The cat sat on" -> "the" -> "The cat sat on the"
  ...until [EOS] token or max length
```

## Greedy Decoding

```
GREEDY: Always pick the most probable next token

  Step 1: P("sat"|"The cat")  = 0.25  <-- PICK
          P("is"|"The cat")   = 0.18
          P("ran"|"The cat")  = 0.12

  Step 2: P("on"|"The cat sat")    = 0.30  <-- PICK
          P("down"|"The cat sat")  = 0.22

  Result: "The cat sat on the mat."

  PROBLEM: Always picks the safe, boring option.
  "Once upon a time there was a king. The king was a king.
   The king was a king. The king was..."  (repetitive!)
```

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

def greedy_decode(
    model: AutoModelForCausalLM,
    tokenizer: AutoTokenizer,
    prompt: str,
    max_new_tokens: int = 50,
) -> str:
    input_ids = tokenizer.encode(prompt, return_tensors="pt")
    generated = input_ids.clone()

    for _ in range(max_new_tokens):
        with torch.no_grad():
            outputs = model(generated)

        next_token_logits = outputs.logits[:, -1, :]
        next_token_id = torch.argmax(next_token_logits, dim=-1, keepdim=True)

        if next_token_id.item() == tokenizer.eos_token_id:
            break

        generated = torch.cat([generated, next_token_id], dim=-1)

    return tokenizer.decode(generated[0], skip_special_tokens=True)
```

## Beam Search

```
BEAM SEARCH (beam_width=3)

  "The cat"
       |
       +-- "sat"  (score: 0.25) ----+-- "on"    (0.25 * 0.30 = 0.075)
       |                             +-- "down"  (0.25 * 0.22 = 0.055)
       |
       +-- "is"   (score: 0.18) ----+-- "a"     (0.18 * 0.35 = 0.063)
       |                             +-- "very"  (0.18 * 0.15 = 0.027)
       |
       +-- "ran"  (score: 0.12) ----+-- "away"  (0.12 * 0.40 = 0.048)
                                     +-- "fast"  (0.12 * 0.25 = 0.030)

  Keep top 3 at each step:
  1. "sat on"   (0.075)
  2. "is a"     (0.063)
  3. "sat down" (0.055)

  Continue expanding each beam...
  Better than greedy but still deterministic.
```

```python
def beam_search_decode(
    model: AutoModelForCausalLM,
    tokenizer: AutoTokenizer,
    prompt: str,
    beam_width: int = 5,
    max_new_tokens: int = 50,
) -> str:
    input_ids = tokenizer.encode(prompt, return_tensors="pt")

    outputs = model.generate(
        input_ids,
        max_new_tokens=max_new_tokens,
        num_beams=beam_width,
        early_stopping=True,
        no_repeat_ngram_size=3,
        length_penalty=1.0,
    )

    return tokenizer.decode(outputs[0], skip_special_tokens=True)
```

## Temperature Sampling

```
TEMPERATURE CONTROLS RANDOMNESS

  Original logits: [2.0, 1.0, 0.5, 0.1]

  T=0.1 (sharp):   [0.98, 0.01, 0.005, 0.001]  ~= greedy
  T=1.0 (normal):  [0.47, 0.17, 0.10, 0.07]     balanced
  T=2.0 (flat):    [0.30, 0.24, 0.22, 0.20]      nearly uniform

  LOW temp  = confident, repetitive, safe
  HIGH temp = creative, diverse, risky

  Formula: P(token) = softmax(logits / temperature)
```

```python
def temperature_sample(
    model: AutoModelForCausalLM,
    tokenizer: AutoTokenizer,
    prompt: str,
    temperature: float = 0.7,
    max_new_tokens: int = 100,
) -> str:
    input_ids = tokenizer.encode(prompt, return_tensors="pt")
    generated = input_ids.clone()

    for _ in range(max_new_tokens):
        with torch.no_grad():
            outputs = model(generated)

        logits = outputs.logits[:, -1, :]
        scaled_logits = logits / temperature

        probs = torch.softmax(scaled_logits, dim=-1)
        next_token_id = torch.multinomial(probs, num_samples=1)

        if next_token_id.item() == tokenizer.eos_token_id:
            break

        generated = torch.cat([generated, next_token_id], dim=-1)

    return tokenizer.decode(generated[0], skip_special_tokens=True)
```

## Top-k Sampling

```
TOP-K SAMPLING (k=3)

  Full distribution:          After top-k filtering:
  "mat":   0.25               "mat":   0.25 -> 0.42
  "roof":  0.18               "roof":  0.18 -> 0.30
  "chair": 0.15               "chair": 0.15 -> 0.25
  "floor": 0.10               (renormalize to sum to 1)
  "bed":   0.08
  "car":   0.05               Everything else = 0
  ...      ...

  Only sample from the top k tokens.
  Prevents picking very unlikely tokens.
```

## Nucleus (Top-p) Sampling

```
NUCLEUS SAMPLING (p=0.9)

  Sorted by probability:
  "mat":    0.25  | cumsum: 0.25
  "roof":   0.18  | cumsum: 0.43
  "chair":  0.15  | cumsum: 0.58
  "floor":  0.10  | cumsum: 0.68
  "bed":    0.08  | cumsum: 0.76
  "sofa":   0.07  | cumsum: 0.83
  "table":  0.05  | cumsum: 0.88
  "rug":    0.04  | cumsum: 0.92  <-- cutoff here (>0.9)
  --------
  Everything below "rug" = 0

  Adaptive: uses fewer tokens when model is confident,
            more tokens when model is uncertain.
```

```python
def nucleus_sample(
    model: AutoModelForCausalLM,
    tokenizer: AutoTokenizer,
    prompt: str,
    top_p: float = 0.9,
    temperature: float = 0.7,
    max_new_tokens: int = 100,
) -> str:
    input_ids = tokenizer.encode(prompt, return_tensors="pt")
    generated = input_ids.clone()

    for _ in range(max_new_tokens):
        with torch.no_grad():
            outputs = model(generated)

        logits = outputs.logits[:, -1, :] / temperature
        sorted_logits, sorted_indices = torch.sort(logits, descending=True)
        cumulative_probs = torch.cumsum(
            torch.softmax(sorted_logits, dim=-1), dim=-1
        )

        sorted_indices_to_remove = cumulative_probs > top_p
        sorted_indices_to_remove[..., 1:] = sorted_indices_to_remove[..., :-1].clone()
        sorted_indices_to_remove[..., 0] = False

        indices_to_remove = sorted_indices_to_remove.scatter(
            1, sorted_indices, sorted_indices_to_remove
        )
        logits[indices_to_remove] = float("-inf")

        probs = torch.softmax(logits, dim=-1)
        next_token_id = torch.multinomial(probs, num_samples=1)

        if next_token_id.item() == tokenizer.eos_token_id:
            break

        generated = torch.cat([generated, next_token_id], dim=-1)

    return tokenizer.decode(generated[0], skip_special_tokens=True)
```

## Using HuggingFace Generate

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "gpt2"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name)

prompt = "The future of artificial intelligence"
input_ids = tokenizer.encode(prompt, return_tensors="pt")

greedy_output = model.generate(input_ids, max_new_tokens=50)

beam_output = model.generate(
    input_ids,
    max_new_tokens=50,
    num_beams=5,
    no_repeat_ngram_size=2,
    early_stopping=True,
)

sampling_output = model.generate(
    input_ids,
    max_new_tokens=50,
    do_sample=True,
    temperature=0.7,
    top_k=50,
    top_p=0.9,
)

for name, output in [
    ("Greedy", greedy_output),
    ("Beam", beam_output),
    ("Sampling", sampling_output),
]:
    text = tokenizer.decode(output[0], skip_special_tokens=True)
    print(f"\n{name}:\n{text}")
```

## Choosing a Strategy

```
+----------------+-----------+-------------+------------+
| Strategy       | Quality   | Diversity   | Best For   |
+----------------+-----------+-------------+------------+
| Greedy         | Medium    | None        | Translation|
| Beam Search    | High      | Low         | Summarize  |
| Temperature    | Varies    | High        | Creative   |
| Top-k          | Good      | Medium      | Dialog     |
| Nucleus (top-p)| Good      | Medium-High | General    |
| Top-k + top-p  | Best      | Tunable     | Production |
+----------------+-----------+-------------+------------+
```

## Exercises

1. Implement greedy, beam search, and nucleus sampling from scratch. Generate text from the same prompt with each and compare the outputs qualitatively.

2. Experiment with temperature values (0.1, 0.5, 0.7, 1.0, 1.5) on a creative writing prompt. Describe how the output changes at each level.

3. Implement repetition penalty: penalize tokens that already appeared in the generated text. Compare outputs with and without the penalty.

4. Build a text generation API that accepts decoding parameters (temperature, top_k, top_p, max_tokens) and returns generated text with metadata about the generation process.

5. Compare top-k and top-p sampling on 50 generations of the same prompt. Measure vocabulary diversity (unique tokens / total tokens) for each method.

## Key Takeaways

```
+-------------------------------------------+
| TEXT GENERATION STRATEGIES                |
|                                           |
| 1. Greedy = deterministic, repetitive    |
| 2. Beam search = better but still rigid  |
| 3. Temperature = controls randomness     |
| 4. Top-k = sample from top k tokens     |
| 5. Nucleus = adaptive top-p sampling    |
| 6. Production: top-p + temperature      |
+-------------------------------------------+
```
