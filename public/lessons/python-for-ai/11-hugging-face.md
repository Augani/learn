# Lesson 11: Hugging Face

> Hugging Face is like an app store for AI models.
> Browse, download, and run state-of-the-art models in 3 lines of code.

---

## The Ecosystem

```
  Hugging Face Ecosystem:
  ┌──────────────────────────────────────────────┐
  │                  The Hub                      │
  │  (models, datasets, spaces - like GitHub)     │
  └──────────┬────────────────┬──────────────────┘
             │                │
  ┌──────────▼──────┐  ┌─────▼──────────────┐
  │  transformers   │  │    datasets         │
  │  (models +      │  │    (data loading    │
  │   tokenizers)   │  │     + processing)   │
  └──────────┬──────┘  └────────────────────┘
             │
  ┌──────────▼──────┐  ┌────────────────────┐
  │  pipelines      │  │    evaluate         │
  │  (high-level    │  │    (metrics)        │
  │   inference)    │  │                     │
  └─────────────────┘  └────────────────────┘
```

---

## Pipelines: The Easy Way

Pipelines are the fast food of ML. Order what you want,
get results immediately, no cooking required.

```python
from transformers import pipeline

classifier = pipeline("sentiment-analysis")
result = classifier("I love building AI applications with Python!")
print(result)

results = classifier([
    "This model is amazing!",
    "I'm frustrated with the slow training time.",
    "The results are okay, nothing special.",
])
for r in results:
    print(f"  {r['label']}: {r['score']:.4f}")
```

### Available Pipeline Tasks

```
  Task                    Pipeline Name
  ─────────────────────   ──────────────────────
  Sentiment analysis      "sentiment-analysis"
  Text classification     "text-classification"
  Named entity recog.     "ner"
  Question answering      "question-answering"
  Summarization           "summarization"
  Translation             "translation_en_to_fr"
  Text generation         "text-generation"
  Fill mask               "fill-mask"
  Zero-shot classif.      "zero-shot-classification"
  Image classification    "image-classification"
  Object detection        "object-detection"
```

### More Pipeline Examples

```python
from transformers import pipeline

qa = pipeline("question-answering")
result = qa(
    question="What is the capital of France?",
    context="France is a country in Western Europe. Its capital is Paris, "
            "which is known for the Eiffel Tower.",
)
print(f"Answer: {result['answer']} (score: {result['score']:.4f})")

summarizer = pipeline("summarization")
text = (
    "Machine learning is a subset of artificial intelligence that focuses on "
    "building systems that learn from data. Unlike traditional programming where "
    "rules are explicitly coded, ML systems discover patterns automatically. "
    "Deep learning, a further subset, uses neural networks with many layers to "
    "learn increasingly abstract representations of data."
)
summary = summarizer(text, max_length=50, min_length=20)
print(f"Summary: {summary[0]['summary_text']}")
```

---

## Tokenizers

Tokenizers convert text to numbers. Like a translator who breaks
sentences into words, then looks up each word's ID in a dictionary.

```
  "I love AI" -> tokenizer -> [101, 146, 1567, 9932, 102]

  Step 1: Split    "I" "love" "AI"
  Step 2: Map      I->146, love->1567, AI->9932
  Step 3: Add      [CLS]=101 ... [SEP]=102
```

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

text = "Machine learning is transforming the world!"
tokens = tokenizer(text)
print(f"Input IDs: {tokens['input_ids']}")
print(f"Attention mask: {tokens['attention_mask']}")

token_strings = tokenizer.convert_ids_to_tokens(tokens["input_ids"])
print(f"Tokens: {token_strings}")

decoded = tokenizer.decode(tokens["input_ids"])
print(f"Decoded: {decoded}")
```

### Batch Tokenization

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

texts = [
    "Short text.",
    "This is a much longer piece of text that contains more words.",
    "Medium length example here.",
]

batch = tokenizer(
    texts,
    padding=True,
    truncation=True,
    max_length=32,
    return_tensors="pt",
)

print(f"Input IDs shape: {batch['input_ids'].shape}")
print(f"Attention mask shape: {batch['attention_mask'].shape}")
for i, text in enumerate(texts):
    real_tokens = batch["attention_mask"][i].sum().item()
    print(f"  '{text[:30]}...' -> {real_tokens} tokens")
```

---

## Models: Under the Hood

```python
from transformers import AutoModel, AutoTokenizer
import torch

tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
model = AutoModel.from_pretrained("bert-base-uncased")

inputs = tokenizer("Hello, world!", return_tensors="pt")

with torch.no_grad():
    outputs = model(**inputs)

print(f"Last hidden state: {outputs.last_hidden_state.shape}")
print(f"Pooler output: {outputs.pooler_output.shape}")

total_params = sum(p.numel() for p in model.parameters())
print(f"Parameters: {total_params:,}")
```

### For Classification

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch

model_name = "distilbert-base-uncased-finetuned-sst-2-english"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

texts = ["I love this!", "This is terrible."]
inputs = tokenizer(texts, padding=True, return_tensors="pt")

with torch.no_grad():
    outputs = model(**inputs)

probabilities = torch.softmax(outputs.logits, dim=1)
labels = ["NEGATIVE", "POSITIVE"]

for text, probs in zip(texts, probabilities):
    pred = labels[probs.argmax()]
    confidence = probs.max().item()
    print(f"'{text}' -> {pred} ({confidence:.3f})")
```

---

## Datasets Library

Like a grocery delivery service for data. Order a dataset by name,
and it arrives cleaned and ready to use.

```python
from datasets import load_dataset

dataset = load_dataset("imdb")
print(dataset)
print(f"Train size: {len(dataset['train'])}")
print(f"Test size: {len(dataset['test'])}")
print(f"Sample: {dataset['train'][0]['text'][:100]}...")
print(f"Label: {dataset['train'][0]['label']}")
```

### Processing Datasets

```python
from datasets import load_dataset
from transformers import AutoTokenizer

dataset = load_dataset("imdb", split="train[:1000]")
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

def tokenize_function(examples):
    return tokenizer(
        examples["text"],
        padding="max_length",
        truncation=True,
        max_length=128,
    )

tokenized = dataset.map(tokenize_function, batched=True, batch_size=100)
tokenized = tokenized.remove_columns(["text"])
tokenized.set_format("torch")

print(f"Columns: {tokenized.column_names}")
print(f"Shape: {tokenized[0]['input_ids'].shape}")
```

---

## Fine-Tuning with Trainer

The Trainer handles the training loop, evaluation, logging,
and checkpointing. Like hiring a personal trainer at the gym -
you bring the model and data, they handle the routine.

```python
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
)
from datasets import load_dataset

dataset = load_dataset("imdb")
small_train = dataset["train"].shuffle(seed=42).select(range(1000))
small_test = dataset["test"].shuffle(seed=42).select(range(200))

tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")

def tokenize(examples):
    return tokenizer(examples["text"], truncation=True, max_length=256)

train_ds = small_train.map(tokenize, batched=True)
test_ds = small_test.map(tokenize, batched=True)

model = AutoModelForSequenceClassification.from_pretrained(
    "distilbert-base-uncased", num_labels=2,
)

training_args = TrainingArguments(
    output_dir="./results",
    num_train_epochs=2,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=64,
    eval_strategy="epoch",
    save_strategy="epoch",
    learning_rate=2e-5,
    weight_decay=0.01,
    logging_steps=50,
    load_best_model_at_end=True,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=test_ds,
)

trainer.train()
results = trainer.evaluate()
print(f"Eval results: {results}")
```

---

## The Hub

```python
from huggingface_hub import HfApi, list_models

api = HfApi()

models = list(api.list_models(
    filter="text-classification",
    sort="downloads",
    direction=-1,
    limit=5,
))

for m in models:
    print(f"{m.modelId}: {m.downloads:,} downloads")
```

### Pushing to the Hub

```python
model.push_to_hub("my-username/my-fine-tuned-model")
tokenizer.push_to_hub("my-username/my-fine-tuned-model")
```

---

## Text Generation

```python
from transformers import pipeline

generator = pipeline("text-generation", model="gpt2")

result = generator(
    "The future of artificial intelligence is",
    max_length=50,
    num_return_sequences=2,
    temperature=0.8,
    do_sample=True,
)

for i, r in enumerate(result):
    print(f"Generation {i+1}: {r['generated_text']}")
    print()
```

---

## Embeddings

```python
from transformers import AutoModel, AutoTokenizer
import torch

tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
model = AutoModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

def get_embedding(text):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
    with torch.no_grad():
        outputs = model(**inputs)
    return outputs.last_hidden_state.mean(dim=1).squeeze()

sentences = [
    "The cat sat on the mat",
    "A feline rested on the rug",
    "Python is a programming language",
]

embeddings = [get_embedding(s) for s in sentences]
for i in range(len(sentences)):
    for j in range(i + 1, len(sentences)):
        sim = torch.cosine_similarity(embeddings[i], embeddings[j], dim=0)
        print(f"Similarity('{sentences[i][:30]}', '{sentences[j][:30]}'): {sim:.3f}")
```

---

## Exercises

1. **Pipeline Tour**: Use pipelines for 5 different tasks (sentiment,
   NER, summarization, QA, zero-shot). Process the same input text
   through each and compare outputs.

2. **Custom Fine-Tuning**: Fine-tune a DistilBERT model on a text
   classification task from the Hub. Use the Trainer with proper
   evaluation metrics (accuracy, F1).

3. **Tokenizer Analysis**: Compare tokenization of the same text
   across 3 different tokenizers (BERT, GPT-2, T5). Count tokens,
   compare vocabulary sizes, and find subword splits.

4. **Embedding Search**: Create a simple semantic search engine.
   Embed a collection of 20 sentences, then find the most similar
   ones to a query using cosine similarity.

5. **Model Card**: Fine-tune a small model, push it to the Hub
   (or prepare to), and write a model card with training details,
   metrics, and intended use cases.

---

[Next: Lesson 12 - LangChain & LlamaIndex ->](12-langchain-llamaindex.md)
