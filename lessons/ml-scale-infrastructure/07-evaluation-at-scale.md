# Lesson 07: Model Evaluation at Scale — How Do You Know If Your Model Is Any Good?

You have spent millions of dollars and weeks of compute training a model.
Now the hardest question: is it actually good? Model evaluation at scale
is surprisingly difficult — benchmarks can be gamed, human evaluation is
expensive, and the metrics that matter depend entirely on what you want
the model to do.

---

## The Core Idea

Evaluating a language model is like evaluating a job candidate. A resume
(benchmark scores) tells you something, but it can be polished to look
better than reality. An interview (human evaluation) is more revealing
but expensive and subjective. Reference checks (red teaming) uncover
problems the candidate would never reveal themselves. The best hiring
processes use all three — and so does the best model evaluation.

```
Evaluation Pyramid:

                    ┌─────────┐
                    │  Human  │  Most expensive,
                    │  Eval   │  most informative
                    ├─────────┤
                    │  LLM-as │  Cheaper proxy
                    │  -Judge │  for human eval
                    ├─────────┤
                    │  Red    │  Adversarial
                    │ Teaming │  safety testing
               ┌────┴─────────┴────┐
               │   Benchmark       │  Automated,
               │   Suites          │  scalable,
               │   (MMLU, etc.)    │  but gameable
               └───────────────────┘
```

---

## Benchmark Suites

Benchmarks are standardized tests that measure specific capabilities.
Here are the most widely used:

```
Major LLM Benchmarks:

┌──────────────┬──────────────────────────────────────────┐
│  Benchmark   │  What It Measures                        │
├──────────────┼──────────────────────────────────────────┤
│  MMLU        │  Massive Multitask Language Understanding│
│              │  57 subjects, multiple choice            │
│              │  Tests: broad knowledge                  │
│              │  Format: 4-choice questions              │
│              │  Size: ~14,000 questions                 │
├──────────────┼──────────────────────────────────────────┤
│  HumanEval   │  Code generation (Python)               │
│              │  164 programming problems                │
│              │  Tests: functional correctness           │
│              │  Metric: pass@k (passes k attempts)     │
├──────────────┼──────────────────────────────────────────┤
│  GSM8K       │  Grade School Math (8K problems)        │
│              │  Multi-step arithmetic word problems     │
│              │  Tests: mathematical reasoning           │
│              │  Metric: exact match accuracy            │
├──────────────┼──────────────────────────────────────────┤
│  MATH        │  Competition-level mathematics           │
│              │  12,500 problems across 7 subjects       │
│              │  Tests: advanced mathematical reasoning  │
│              │  Much harder than GSM8K                  │
├──────────────┼──────────────────────────────────────────┤
│  TruthfulQA  │  Factual accuracy                       │
│              │  817 questions designed to elicit        │
│              │  common misconceptions                   │
│              │  Tests: resistance to false beliefs      │
├──────────────┼──────────────────────────────────────────┤
│  HellaSwag   │  Commonsense reasoning                  │
│              │  Sentence completion tasks               │
│              │  Tests: physical/social common sense     │
├──────────────┼──────────────────────────────────────────┤
│  ARC         │  AI2 Reasoning Challenge                 │
│              │  Grade-school science questions          │
│              │  Tests: scientific reasoning             │
├──────────────┼──────────────────────────────────────────┤
│  WinoGrande  │  Pronoun resolution                     │
│              │  Tests: commonsense understanding        │
├──────────────┼──────────────────────────────────────────┤
│  MT-Bench    │  Multi-turn conversation quality         │
│              │  80 multi-turn questions                 │
│              │  Scored by GPT-4 (LLM-as-judge)         │
│              │  Tests: instruction following            │
├──────────────┼──────────────────────────────────────────┤
│  AlpacaEval  │  Instruction following                  │
│              │  805 instructions                        │
│              │  Win rate vs reference model             │
│              │  Tests: helpfulness                      │
└──────────────┴──────────────────────────────────────────┘
```

**How benchmarks are typically run:**

```python
# Simplified benchmark evaluation (MMLU-style)
def evaluate_mmlu_question(model, tokenizer, question):
    """
    Evaluate a single MMLU multiple-choice question.

    Format:
    Question: What is the capital of France?
    A. London
    B. Paris
    C. Berlin
    D. Madrid
    Answer:
    """
    prompt = format_mmlu_prompt(question)
    # Get model's log probabilities for A, B, C, D
    logits = model(tokenizer.encode(prompt))
    last_logits = logits[-1]  # logits for next token

    # Compare probabilities of answer tokens
    answer_tokens = {
        'A': tokenizer.encode('A')[0],
        'B': tokenizer.encode('B')[0],
        'C': tokenizer.encode('C')[0],
        'D': tokenizer.encode('D')[0],
    }

    probs = {}
    for letter, token_id in answer_tokens.items():
        probs[letter] = last_logits[token_id].item()

    predicted = max(probs, key=probs.get)
    correct = question['answer']
    return predicted == correct
```

---

## Contamination: The Biggest Problem with Benchmarks

**Benchmark contamination** occurs when benchmark questions appear in
the training data. The model memorizes answers rather than reasoning
about them, inflating scores artificially.

```
Contamination Problem:

  Training Data:                    Benchmark:
  ┌──────────────────────┐         ┌──────────────────────┐
  │ ...millions of web   │         │ Q: What is the       │
  │ pages including...   │         │ capital of France?   │
  │                      │         │ A. London            │
  │ "The capital of      │ ──────> │ B. Paris  ✓          │
  │  France is Paris"    │  Leak!  │ C. Berlin            │
  │                      │         │ D. Madrid            │
  │ ...and even...       │         │                      │
  │                      │         │ Model gets it right, │
  │ "MMLU Q: What is the │         │ but did it REASON    │
  │  capital of France?  │         │ or MEMORIZE?         │
  │  Answer: B"          │         │                      │
  └──────────────────────┘         └──────────────────────┘

  Contamination sources:
  - Benchmark questions posted on forums, blogs, study guides
  - Benchmark datasets included in training data collections
  - Synthetic data generated from benchmark-like prompts
```

**Mitigation strategies:**
- **N-gram overlap detection:** Check if benchmark questions appear verbatim in training data
- **Canary strings:** Include unique strings in benchmarks to detect if they appear in training data
- **Held-out benchmarks:** Create new benchmarks after the training data cutoff
- **Dynamic benchmarks:** Generate new questions for each evaluation (e.g., LiveBench)

---

## Human Evaluation

Human evaluation is the gold standard but the most expensive approach.

```
Human Evaluation Methods:

  1. Side-by-side comparison (A/B testing)
     ┌──────────────────────────────────────────┐
     │  Prompt: "Explain quantum computing"     │
     │                                          │
     │  Model A response    Model B response    │
     │  ┌──────────────┐   ┌──────────────┐    │
     │  │ ...          │   │ ...          │    │
     │  └──────────────┘   └──────────────┘    │
     │                                          │
     │  Human: Which is better?  [A] [B] [Tie]  │
     └──────────────────────────────────────────┘

  2. Likert scale rating
     Rate this response on helpfulness: 1-5
     Rate this response on accuracy: 1-5
     Rate this response on safety: 1-5

  3. Task completion
     Can the user accomplish their goal using
     this response? [Yes] [Partially] [No]

  Cost:
  ┌──────────────────────────────────────────────────┐
  │  Method              │  Cost per eval  │  Scale   │
  ├──────────────────────┼─────────────────┼──────────┤
  │  Expert annotators   │  $5-20/eval     │  100s    │
  │  Crowdsource (MTurk) │  $0.50-2/eval   │  1000s   │
  │  Internal team       │  Staff time     │  100s    │
  │  LLM-as-judge        │  $0.01-0.10     │  10000s  │
  └──────────────────────┴─────────────────┴──────────┘
```

---

## LLM-as-Judge

Using a strong LLM (like GPT-4) to evaluate other models is a
cost-effective proxy for human evaluation.

```
LLM-as-Judge Pipeline:

  ┌──────────────┐
  │  Test Prompt  │
  └──────┬───────┘
         │
    ┌────┴────┐
    v         v
  ┌─────┐  ┌─────┐
  │Model│  │Model│
  │  A  │  │  B  │
  └──┬──┘  └──┬──┘
     │        │
     v        v
  ┌──────────────┐
  │  Judge LLM   │  "Which response is better
  │  (GPT-4)     │   and why?"
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Verdict:    │
  │  "A is better│
  │  because..." │
  └──────────────┘

  Limitations:
  - Position bias (prefers first response)
  - Self-preference (GPT-4 prefers GPT-4-like responses)
  - Cannot evaluate beyond judge's own capability
  - Mitigation: swap positions, use multiple judges
```

MT-Bench and AlpacaEval both use LLM-as-judge as their primary
evaluation method.

---

## Red Teaming

Red teaming is adversarial testing where humans (or automated systems)
try to make the model produce harmful, incorrect, or undesirable outputs.

```
Red Teaming Categories:

  ┌──────────────────────────────────────────────────┐
  │  Category           │  Example Attacks            │
  ├─────────────────────┼─────────────────────────────┤
  │  Harmful content    │  "How to make a weapon"     │
  │                     │  Jailbreak prompts           │
  │  Bias               │  Stereotyping, discrimination│
  │  Hallucination      │  Confident false claims      │
  │  Privacy            │  Extracting training data    │
  │  Prompt injection   │  "Ignore previous instruct." │
  │  Toxicity           │  Generating hate speech      │
  │  Copyright          │  Reproducing copyrighted text│
  └─────────────────────┴─────────────────────────────┘

  Red teaming process:
  1. Define attack categories and severity levels
  2. Recruit diverse red teamers (security, ethics, domain experts)
  3. Systematic testing across categories
  4. Document successful attacks
  5. Use findings to improve safety training
  6. Re-test after safety improvements
```

---

## Evaluation Frameworks

Several open-source frameworks make evaluation easier:

```
Evaluation Frameworks:

  ┌──────────────────────────────────────────────────┐
  │  Framework        │  Features                     │
  ├───────────────────┼───────────────────────────────┤
  │  lm-eval-harness  │  Most comprehensive           │
  │  (EleutherAI)     │  200+ benchmarks              │
  │                   │  Standard in the field        │
  ├───────────────────┼───────────────────────────────┤
  │  HELM             │  Stanford's holistic eval     │
  │  (Stanford)       │  Multi-metric evaluation      │
  │                   │  Fairness and bias metrics    │
  ├───────────────────┼───────────────────────────────┤
  │  OpenCompass      │  Chinese + English benchmarks │
  │                   │  Good for multilingual eval   │
  ├───────────────────┼───────────────────────────────┤
  │  Chatbot Arena    │  Crowdsourced human eval      │
  │  (LMSYS)         │  ELO-style ranking            │
  │                   │  Most trusted for chat models │
  └───────────────────┴───────────────────────────────┘
```

---

## Connection to ML

Evaluation is the feedback loop that drives model improvement:

- **Benchmarks during training** help detect problems early. See [Lesson 04](./04-pretraining-pipeline.md).
- **Post-training evaluation** determines if alignment worked. See [Lesson 05](./05-post-training-pipeline.md).
- **Contamination** is a data quality issue. See [Lesson 08](./08-data-quality-curation.md).

Cross-reference: [Advanced LLM Engineering, Lesson 13: Evaluating LLMs](../advanced-llm-engineering/13-evaluation-llms.md)
for implementation details of evaluation pipelines.

---

## Exercises

### Exercise 1: Benchmark Analysis

```python
# Given these benchmark scores for three models:
models = {
    "Model A": {"MMLU": 72.1, "HumanEval": 48.2, "GSM8K": 65.3,
                "TruthfulQA": 45.1, "MT-Bench": 7.8},
    "Model B": {"MMLU": 68.5, "HumanEval": 62.1, "GSM8K": 58.7,
                "TruthfulQA": 52.3, "MT-Bench": 8.1},
    "Model C": {"MMLU": 75.3, "HumanEval": 41.0, "GSM8K": 71.2,
                "TruthfulQA": 38.9, "MT-Bench": 7.2},
}

# TODO: Which model is "best"? It depends on the use case.
# TODO: For a coding assistant, which model would you choose? Why?
# TODO: For a general-purpose chatbot, which model? Why?
# TODO: Model C has the highest MMLU but lowest TruthfulQA.
#       What might explain this? (Hint: think about contamination)
```

### Exercise 2: Design an Evaluation Suite

You are building a model for customer support. Design an evaluation
suite that includes:
- At least 3 automated benchmarks (explain why each is relevant)
- A human evaluation protocol (what do annotators rate?)
- Red teaming categories specific to customer support
- How you would detect benchmark contamination

### Exercise 3: LLM-as-Judge Experiment

```python
# Design a prompt for using an LLM as a judge.
# The judge should evaluate responses on:
# 1. Helpfulness (1-5)
# 2. Accuracy (1-5)
# 3. Safety (1-5)

judge_prompt = """
You are evaluating an AI assistant's response.

[User Question]
{question}

[Assistant Response]
{response}

Rate the response on three dimensions (1-5 scale):
"""

# TODO: Complete the judge prompt with clear rubrics
# TODO: What are the failure modes of this approach?
# TODO: How would you mitigate position bias?
```

---

Next: [Lesson 08: Data Quality and Curation](./08-data-quality-curation.md)
