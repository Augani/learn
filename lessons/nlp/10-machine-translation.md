# Lesson 10: Machine Translation

## Analogy: The Interpreter in Your Head

When a human interpreter translates a speech, they don't translate
word-by-word. They listen to a full sentence, understand the meaning,
then express that meaning in the target language. Modern machine
translation works the same way.

```
  WORD-BY-WORD (bad):
  "Das Haus ist gross" -> "The house is big"  (works here)
  "Ich bin kalt"       -> "I am cold"         (works here)
  "Es gibt"            -> "It gives"          (WRONG! means "there is")

  MEANING-BASED (good):
  "Es gibt viele Hunde" -> understand meaning -> "There are many dogs"
```

## Evolution of Machine Translation

```
  1950s          1990s          2014           2017+
  +--------+    +--------+    +----------+    +------------+
  | Rule   |    |Statist.|    | Seq2Seq  |    | Transformer|
  | Based  |--->| MT     |--->| + Attn   |--->| (SOTA)     |
  +--------+    +--------+    +----------+    +------------+
  Hand-coded    Learn from     Neural         Self-attention
  grammar       parallel       encoder-       parallel
  rules         corpora        decoder        processing

  QUALITY OVER TIME:
  |                                     ****
  |                                 ****
  |                             ****
  |                         ****
  |                     ****
  |             ********
  |         ****
  |  *******
  +---------------------------------> Time
```

## Sequence-to-Sequence Architecture

The encoder reads the source language and compresses it into a
"meaning vector." The decoder generates the target language from
that vector.

```
  ENCODER                         DECODER
  +-----+  +-----+  +-----+     +-----+  +-----+  +-----+
  | ich |->| bin |->|froh |     | I   |->| am  |->|happy|
  +-----+  +-----+  +-----+     +-----+  +-----+  +-----+
    |         |         |           ^        ^        ^
    v         v         v           |        |        |
  [h1]  -> [h2]  -> [h3]  ====> [h4]  -> [h5]  -> [h6]
                       |           ^
                       |           |
                    CONTEXT      START
                    VECTOR       TOKEN

  The context vector is a compressed representation
  of the entire source sentence.

  PROBLEM: One fixed-size vector can't capture a
  long sentence's full meaning!
```

## Attention Mechanism

Attention solves the bottleneck by letting the decoder look back at
ALL encoder states, not just the final one.

```
  ENCODER STATES:        ATTENTION WEIGHTS:      DECODER
  +------+               at step "happy":
  | ich  | h1  --------  0.05  ----+
  +------+                         |
  +------+                         v
  | bin  | h2  --------  0.15  ---[weighted]---> [happy]
  +------+                         ^
  +------+                         |
  | froh | h3  --------  0.80  ----+
  +------+
                ^
                |
  "froh" gets highest attention when
  generating "happy" (because froh = happy)
```

## Translation with Hugging Face

```python
from transformers import pipeline

translator = pipeline(
    "translation",
    model="Helsinki-NLP/opus-mt-de-en"
)

german_texts = [
    "Ich lerne maschinelles Lernen.",
    "Das Wetter ist heute sehr schoen.",
    "Wo ist der naechste Bahnhof?",
]

for text in german_texts:
    result = translator(text)
    print(f"  DE: {text}")
    print(f"  EN: {result[0]['translation_text']}\n")
```

## Multi-language Translation

```python
from transformers import MarianMTModel, MarianTokenizer

def translate(text, source_lang, target_lang):
    model_name = f"Helsinki-NLP/opus-mt-{source_lang}-{target_lang}"
    tokenizer = MarianTokenizer.from_pretrained(model_name)
    model = MarianMTModel.from_pretrained(model_name)

    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True)
    translated = model.generate(**inputs)
    result = tokenizer.decode(translated[0], skip_special_tokens=True)
    return result

pairs = [
    ("Bonjour le monde", "fr", "en"),
    ("Hello world", "en", "de"),
    ("La vida es bella", "es", "en"),
]

for text, src, tgt in pairs:
    translated = translate(text, src, tgt)
    print(f"  [{src}] {text}")
    print(f"  [{tgt}] {translated}\n")
```

## Using mBART for Many-to-Many Translation

```python
from transformers import MBartForConditionalGeneration, MBart50TokenizerFast

model_name = "facebook/mbart-large-50-many-to-many-mmt"
model = MBartForConditionalGeneration.from_pretrained(model_name)
tokenizer = MBart50TokenizerFast.from_pretrained(model_name)

def translate_mbart(text, src_lang, tgt_lang):
    tokenizer.src_lang = src_lang
    inputs = tokenizer(text, return_tensors="pt", truncation=True)
    generated = model.generate(
        **inputs,
        forced_bos_token_id=tokenizer.lang_code_to_id[tgt_lang],
        max_length=128
    )
    return tokenizer.batch_decode(generated, skip_special_tokens=True)[0]

result = translate_mbart(
    "Machine translation has improved dramatically.",
    "en_XX",
    "fr_XX"
)
print(f"  EN -> FR: {result}")
```

## Translation Quality Challenges

```
  CHALLENGE              EXAMPLE
  +--------------------+------------------------------------------+
  | Word Order         | EN: "I eat an apple"                     |
  |                    | DE: "Ich esse einen Apfel"               |
  |                    | JP: "Watashi wa ringo wo tabemasu"       |
  |                    |     (I [topic] apple [obj] eat)          |
  +--------------------+------------------------------------------+
  | Gender Agreement   | EN: "The doctor said she..."             |
  |                    | ES: "La doctora dijo que ella..."        |
  |                    |     (gender must agree throughout)       |
  +--------------------+------------------------------------------+
  | Idioms             | EN: "It's raining cats and dogs"         |
  |                    | FR: "Il pleut des cordes"                |
  |                    |     (literally: "it rains ropes")        |
  +--------------------+------------------------------------------+
  | Ambiguity          | EN: "I saw her duck"                     |
  |                    | -> Did she duck? Or did I see her duck?  |
  +--------------------+------------------------------------------+
```

## Evaluating Translation: BLEU Score

```
  REFERENCE: "The cat is on the mat"
  CANDIDATE: "The cat sits on the mat"

  BLEU compares n-gram overlap:

  1-gram matches: The, cat, on, the, mat  = 5/6
  2-gram matches: "the cat", "on the", "the mat" = 3/5
  3-gram matches: "on the mat" = 1/4

  BLEU = geometric mean of n-gram precisions * brevity penalty

  SCALE:
  +------+-------------------+
  | BLEU | Quality           |
  +------+-------------------+
  | > 50 | Very good         |
  | 30-50| Understandable    |
  | 10-30| Gist only         |
  | < 10 | Barely usable     |
  +------+-------------------+
```

```python
from nltk.translate.bleu_score import sentence_bleu, corpus_bleu

reference = [["the", "cat", "is", "on", "the", "mat"]]
candidate = ["the", "cat", "sits", "on", "the", "mat"]

score = sentence_bleu(reference, candidate)
print(f"  BLEU score: {score:.4f}")

references_corpus = [
    [["the", "cat", "is", "on", "the", "mat"]],
    [["there", "is", "a", "cat", "on", "the", "mat"]],
]
candidates_corpus = [
    ["the", "cat", "sits", "on", "the", "mat"],
    ["a", "cat", "is", "on", "the", "mat"],
]

corpus_score = corpus_bleu(references_corpus, candidates_corpus)
print(f"  Corpus BLEU: {corpus_score:.4f}")
```

## Back-Translation for Data Augmentation

Translate to another language and back to create paraphrases.

```
  ORIGINAL:   "I love machine learning"
       |
       v  translate EN -> FR
  FRENCH:     "J'adore l'apprentissage automatique"
       |
       v  translate FR -> EN
  AUGMENTED:  "I love automatic learning"

  You now have a paraphrase for free!
```

```python
from transformers import pipeline

en_to_fr = pipeline("translation", model="Helsinki-NLP/opus-mt-en-fr")
fr_to_en = pipeline("translation", model="Helsinki-NLP/opus-mt-fr-en")

def back_translate(text):
    french = en_to_fr(text)[0]['translation_text']
    english = fr_to_en(french)[0]['translation_text']
    return english, french

original = "The weather is beautiful today"
augmented, intermediate = back_translate(original)

print(f"  Original:     {original}")
print(f"  Intermediate: {intermediate}")
print(f"  Augmented:    {augmented}")
```

## Exercises

1. Translate 10 English sentences to French, German, and Spanish using
   Helsinki-NLP models. Then translate back to English. How much
   information is lost in the round trip?

2. Compute BLEU scores for translations of 5 sentences where you have
   human reference translations. What score range do you get?

3. Use back-translation to create 5 paraphrases of the sentence "Machine
   learning is transforming the technology industry." Use 5 different
   intermediate languages.

4. Find an idiom in your language that doesn't translate literally to
   English. Test how different translation models handle it. Which
   model captures the meaning best?

---

**Next:** [11 - Question Answering](11-question-answering.md)
