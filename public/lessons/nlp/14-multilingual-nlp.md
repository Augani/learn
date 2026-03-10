# Lesson 14: Multilingual NLP

## The Big Analogy: Universal Translators

```
MULTILINGUAL MODELS = UNIVERSAL TRANSLATORS

  Monolingual model:             Multilingual model:
  = Speaks one language          = Speaks 100+ languages

  English model                  mBERT / XLM-R
  +----------+                   +------------------+
  | "cat"    |                   | "cat" (en)       |
  | "dog"    |                   | "gato" (es)      |
  | "house"  |                   | "Katze" (de)     |
  +----------+                   | "chat" (fr)      |
                                 +------------------+

  The magic: "cat", "gato", "Katze", and "chat"
  all land in SIMILAR positions in the embedding space.
  Train on English, test on Spanish. It works!
```

## Cross-Lingual Transfer

```
ZERO-SHOT CROSS-LINGUAL TRANSFER

  Step 1: Train on English labeled data
  +------------------+
  | English NER      |
  | "Apple" -> ORG   |
  | "London" -> LOC  |
  +------------------+
          |
          v
  Fine-tune XLM-R on English NER
          |
          v
  Step 2: Test on other languages (zero-shot!)
  +------------------+
  | Spanish input:   |     No Spanish training data used!
  | "Apple abrió en  |
  |  Madrid"         |
  |  ORG        LOC  |
  +------------------+

  This works because XLM-R learned shared representations
  across languages during pre-training.
```

```python
from transformers import (
    AutoTokenizer,
    AutoModelForTokenClassification,
    pipeline,
)

model_name = "Davlan/xlm-roberta-large-ner-hrl"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForTokenClassification.from_pretrained(model_name)

ner = pipeline("ner", model=model, tokenizer=tokenizer, aggregation_strategy="simple")

test_sentences = {
    "en": "Apple Inc. is headquartered in Cupertino, California.",
    "es": "Apple Inc. tiene su sede en Cupertino, California.",
    "de": "Apple Inc. hat seinen Hauptsitz in Cupertino, Kalifornien.",
    "fr": "Apple Inc. a son siege a Cupertino, en Californie.",
    "zh": "Apple Inc.的总部位于加利福尼亚州库比蒂诺。",
    "ar": "يقع المقر الرئيسي لشركة Apple Inc. في كوبرتينو، كاليفورنيا.",
}

for lang, sentence in test_sentences.items():
    entities = ner(sentence)
    entity_strs = [
        f"{e['word']}({e['entity_group']})" for e in entities
    ]
    print(f"{lang}: {', '.join(entity_strs)}")
```

## Multilingual Embeddings

```
MULTILINGUAL EMBEDDING SPACE

  English "king"     -----.
  Spanish "rey"      -----+---> Similar vector region
  French "roi"       -----'

  English "queen"    -----.
  Spanish "reina"    -----+---> Similar vector region
  French "reine"     -----'

  Same concept in different languages
  maps to the same neighborhood.

  This enables:
  - Cross-lingual search (query in English, find Spanish docs)
  - Zero-shot classification across languages
  - Multilingual semantic similarity
```

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

sentences = {
    "en": "The weather is beautiful today",
    "es": "El clima esta hermoso hoy",
    "de": "Das Wetter ist heute wunderschon",
    "fr": "Le temps est magnifique aujourd'hui",
    "ja": "今日は天気がいいです",
    "unrelated_en": "I need to buy groceries",
}

embeddings = {}
for lang, text in sentences.items():
    embeddings[lang] = model.encode(text, normalize_embeddings=True)

print("Cross-lingual similarity:")
for lang in ["es", "de", "fr", "ja", "unrelated_en"]:
    sim = np.dot(embeddings["en"], embeddings[lang])
    print(f"  en <-> {lang}: {sim:.4f}")
```

## Cross-Lingual Text Classification

```python
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    Trainer,
    TrainingArguments,
)
from datasets import load_dataset
import numpy as np

def train_crosslingual_classifier():
    model_name = "xlm-roberta-base"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name, num_labels=3
    )

    dataset = load_dataset("xnli", "en")

    def tokenize(examples):
        return tokenizer(
            examples["premise"],
            examples["hypothesis"],
            truncation=True,
            max_length=128,
            padding="max_length",
        )

    tokenized = dataset.map(tokenize, batched=True)

    training_args = TrainingArguments(
        output_dir="./xlm-r-xnli",
        num_train_epochs=3,
        per_device_train_batch_size=32,
        per_device_eval_batch_size=64,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
    )

    def compute_metrics(eval_pred):
        predictions = np.argmax(eval_pred.predictions, axis=-1)
        accuracy = np.mean(predictions == eval_pred.label_ids)
        return {"accuracy": accuracy}

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        compute_metrics=compute_metrics,
    )

    trainer.train()
    return trainer

def evaluate_crosslingual(trainer, tokenizer, languages: list[str]):
    results = {}

    for lang in languages:
        dataset = load_dataset("xnli", lang, split="test")

        def tokenize(examples):
            return tokenizer(
                examples["premise"],
                examples["hypothesis"],
                truncation=True,
                max_length=128,
                padding="max_length",
            )

        tokenized = dataset.map(tokenize, batched=True)
        metrics = trainer.evaluate(tokenized)
        results[lang] = metrics["eval_accuracy"]
        print(f"{lang}: {metrics['eval_accuracy']:.4f}")

    return results
```

## Language Detection

```python
from transformers import pipeline

lang_detector = pipeline(
    "text-classification",
    model="papluca/xlm-roberta-base-language-detection",
)

texts = [
    "Hello, how are you?",
    "Hola, como estas?",
    "Bonjour, comment allez-vous?",
    "こんにちは、お元気ですか？",
    "مرحبا، كيف حالك؟",
]

for text in texts:
    result = lang_detector(text)[0]
    print(f"'{text[:30]}...' -> {result['label']} ({result['score']:.4f})")
```

## Translation with MarianMT

```python
from transformers import MarianMTModel, MarianTokenizer

def translate(
    texts: list[str],
    source_lang: str,
    target_lang: str,
) -> list[str]:
    model_name = f"Helsinki-NLP/opus-mt-{source_lang}-{target_lang}"
    tokenizer = MarianTokenizer.from_pretrained(model_name)
    model = MarianMTModel.from_pretrained(model_name)

    inputs = tokenizer(
        texts,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=512,
    )

    translated = model.generate(**inputs)
    return tokenizer.batch_decode(translated, skip_special_tokens=True)

english_texts = [
    "The cat sat on the mat.",
    "Machine learning is transforming the world.",
]

french = translate(english_texts, "en", "fr")
german = translate(english_texts, "en", "de")
spanish = translate(english_texts, "en", "es")

for en, fr, de, es in zip(english_texts, french, german, spanish):
    print(f"EN: {en}")
    print(f"FR: {fr}")
    print(f"DE: {de}")
    print(f"ES: {es}")
    print()
```

## Challenges in Multilingual NLP

```
COMMON CHALLENGES

  1. SCRIPT DIFFERENCES
     Latin: "cat"  |  Arabic: "قط"  |  Chinese: "猫"
     Tokenizers must handle all scripts

  2. MORPHOLOGICAL COMPLEXITY
     English: "cat" -> "cats"  (simple)
     Turkish: "ev" -> "evlerinizden" (from your houses)
     Finnish: "talo" -> "taloissammekin" (in our houses too)

  3. LOW-RESOURCE LANGUAGES
     English: Billions of tokens available
     Yoruba: Very limited training data
     Solution: Transfer learning from related languages

  4. TRANSLATIONESE
     Translated text sounds different from native text.
     Models trained on translated data may learn artifacts.

  5. EVALUATION
     Metrics designed for English may not work for:
     - Languages without word boundaries (Chinese, Japanese)
     - Highly inflected languages (Finnish, Turkish)
     - Right-to-left languages (Arabic, Hebrew)
```

## Exercises

1. Fine-tune XLM-RoBERTa on English sentiment data, then evaluate zero-shot performance on French, German, and Spanish sentiment datasets. Report accuracy drop per language.

2. Build a multilingual search engine: index documents in 3 languages using multilingual embeddings, then search across all languages with a query in any language.

3. Implement language detection on a corpus of 1000 sentences in 5 languages. Measure accuracy and find which language pairs are most confused.

4. Create a translation pipeline that detects the source language automatically, then translates to English. Handle at least 5 source languages.

5. Compare monolingual BERT vs multilingual XLM-R on English NER. Then evaluate XLM-R on German and Spanish NER zero-shot. Report F1 scores.

## Key Takeaways

```
+-------------------------------------------+
| MULTILINGUAL NLP                          |
|                                           |
| 1. XLM-R enables zero-shot transfer     |
| 2. Multilingual embeddings align langs   |
| 3. Train on English, test on many langs  |
| 4. Performance drops for distant langs   |
| 5. Low-resource langs need special care  |
| 6. Always evaluate on target language    |
+-------------------------------------------+
```
