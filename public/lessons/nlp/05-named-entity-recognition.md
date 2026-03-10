# Lesson 05: Named Entity Recognition

## Analogy: Highlighting Names in a Book

Imagine reading a novel with a highlighter. Every time you see a
person's name, you highlight it yellow. Company names get green.
Locations get blue. That's exactly what NER does -- it finds and
labels the "named things" in text.

```
  INPUT:
  "Apple CEO Tim Cook announced the new iPhone in Cupertino."

  OUTPUT:
  "[Apple]ORG CEO [Tim Cook]PERSON announced the new
   [iPhone]PRODUCT in [Cupertino]GPE."

  +----------+----------+
  | Entity   | Label    |
  +----------+----------+
  | Apple    | ORG      |
  | Tim Cook | PERSON   |
  | iPhone   | PRODUCT  |
  | Cupertino| GPE      |
  +----------+----------+
```

## Common Entity Types

```
  LABEL    MEANING              EXAMPLES
  +--------+-------------------+---------------------------+
  | PERSON | People            | Tim Cook, Marie Curie     |
  | ORG    | Organizations     | Apple, United Nations     |
  | GPE    | Countries/Cities  | France, New York          |
  | LOC    | Non-GPE locations | Mount Everest, Pacific    |
  | DATE   | Dates             | January 2024, last week   |
  | MONEY  | Monetary values   | $500, 10 million euros    |
  | PRODUCT| Products          | iPhone, Windows 11        |
  | EVENT  | Named events      | World Cup, Olympics       |
  +--------+-------------------+---------------------------+
```

## NER with spaCy

```python
import spacy

nlp = spacy.load("en_core_web_sm")

text = """
Elon Musk founded SpaceX in 2002. The company is headquartered
in Hawthorne, California. In 2020, SpaceX launched astronauts
to the International Space Station for NASA.
"""

doc = nlp(text)

for ent in doc.ents:
    print(f"  {ent.text:30} {ent.label_:8} ({spacy.explain(ent.label_)})")
```

## BIO Tagging Scheme

Under the hood, NER is a token-level classification task. Each token
gets a tag: B (beginning), I (inside), or O (outside) of an entity.

```
  TOKEN:   Tim    Cook   works  at   Apple   Inc   .
  TAG:     B-PER  I-PER  O      O    B-ORG   I-ORG O

  B = Beginning of an entity
  I = Inside (continuation of) an entity
  O = Outside any entity

  WHY BIO?
  It handles adjacent entities of the same type:

  "Tim Cook and Jeff Bezos"
   B-PER I-PER O  B-PER I-PER   <-- Two separate PERSON entities
```

```
  FULL BIO SEQUENCE EXAMPLE:

  "Barack Obama visited Paris in January 2024"

  Token:    Barack  Obama  visited  Paris  in  January  2024
  B/I/O:    B-PER   I-PER  O        B-GPE  O   B-DATE   I-DATE
            |_______|       |        |      |   |________|
            PERSON          |        GPE    |      DATE
                            O              O
```

## NER with Hugging Face Transformers

```python
from transformers import pipeline

ner_pipeline = pipeline(
    "ner",
    model="dslim/bert-base-NER",
    aggregation_strategy="simple"
)

text = "Microsoft was founded by Bill Gates and Paul Allen in Albuquerque."

entities = ner_pipeline(text)
for entity in entities:
    print(f"  {entity['word']:20} {entity['entity_group']:6} "
          f"score={entity['score']:.3f}")
```

## Extracting Structured Data

NER is the first step in turning unstructured text into structured data.

```
  UNSTRUCTURED:
  "Dr. Sarah Chen at Stanford University published
   a paper on quantum computing in Nature on March 15."

  STRUCTURED:
  +------------+-----------------------+
  | Field      | Value                 |
  +------------+-----------------------+
  | Author     | Dr. Sarah Chen        |
  | Affiliation| Stanford University   |
  | Topic      | quantum computing     |
  | Journal    | Nature                |
  | Date       | March 15              |
  +------------+-----------------------+
```

```python
import spacy

nlp = spacy.load("en_core_web_sm")

def extract_entities_by_type(text):
    doc = nlp(text)
    entities = {}
    for ent in doc.ents:
        label = ent.label_
        if label not in entities:
            entities[label] = []
        entities[label].append(ent.text)
    return entities

text = """
Google announced a $2 billion investment in London on Tuesday.
CEO Sundar Pichai said the new data center will create 3,000 jobs.
"""

result = extract_entities_by_type(text)
for label, ents in result.items():
    print(f"  {label:8}: {ents}")
```

## Training a Custom NER Model

Sometimes you need entities that pre-trained models don't recognize --
like drug names, legal terms, or product codes.

```python
import spacy
from spacy.training import Example

nlp = spacy.blank("en")

ner = nlp.add_pipe("ner")
ner.add_label("DRUG")
ner.add_label("DOSAGE")
ner.add_label("CONDITION")

train_data = [
    ("Take 500mg of ibuprofen for headache", {
        "entities": [(5, 10, "DOSAGE"), (14, 24, "DRUG"), (29, 37, "CONDITION")]
    }),
    ("Prescribe amoxicillin 250mg for infection", {
        "entities": [(10, 21, "DRUG"), (22, 27, "DOSAGE"), (32, 41, "CONDITION")]
    }),
    ("Use aspirin 100mg daily for pain", {
        "entities": [(4, 11, "DRUG"), (12, 17, "DOSAGE"), (28, 32, "CONDITION")]
    }),
]

optimizer = nlp.begin_training()

for epoch in range(30):
    losses = {}
    for text, annotations in train_data:
        example = Example.from_dict(nlp.make_doc(text), annotations)
        nlp.update([example], drop=0.3, losses=losses)

    if epoch % 10 == 0:
        print(f"  Epoch {epoch:3d} | Loss: {losses['ner']:.3f}")

doc = nlp("Take 200mg of aspirin for fever")
for ent in doc.ents:
    print(f"  {ent.text:15} -> {ent.label_}")
```

## NER Evaluation

```
  GOLD (true):     [Tim Cook]PER works at [Apple]ORG
  PREDICTED:       [Tim]PER [Cook]PER works at [Apple]ORG

  EXACT MATCH:
    "Tim Cook" as PER -> MISS (predicted two separate entities)
    "Apple" as ORG    -> HIT

  PARTIAL MATCH:
    "Tim Cook" partially overlaps -> PARTIAL HIT

  +-------------------+
  | Precision = TP / (TP + FP)
  | Recall    = TP / (TP + FN)
  | F1        = 2 * P * R / (P + R)
  +-------------------+
```

```python
from seqeval.metrics import classification_report

true_tags = [
    ["B-PER", "I-PER", "O", "O", "B-ORG"],
    ["O", "B-GPE", "O", "O", "B-DATE", "I-DATE"],
]

pred_tags = [
    ["B-PER", "I-PER", "O", "O", "B-ORG"],
    ["O", "B-GPE", "O", "O", "B-DATE", "O"],
]

print(classification_report(true_tags, pred_tags))
```

## Common NER Challenges

```
  CHALLENGE                    EXAMPLE
  +-------------------------+-----------------------------------+
  | Ambiguity               | "Apple" = company or fruit?       |
  | Nested entities         | "[New York]GPE [University]ORG"   |
  | Abbreviations           | "WHO" = World Health Organization |
  | Novel entities          | New company/product names         |
  | Boundary detection      | "Dr. Martin Luther King Jr."      |
  +-------------------------+-----------------------------------+
```

## Exercises

1. Use spaCy to extract all entities from a Wikipedia article about a
   famous person. Group entities by type and count them. Which entity
   type appears most often?

2. Build a custom NER model for a domain of your choice (e.g., recipes:
   INGREDIENT, QUANTITY, TECHNIQUE). Create 15 training examples and
   evaluate on 5 test examples.

3. Compare spaCy's NER with Hugging Face's `dslim/bert-base-NER` on
   10 sentences. Where do they agree? Where do they disagree? Which
   is more accurate?

4. Write a function that takes a news article and produces a structured
   summary: {people: [...], organizations: [...], locations: [...],
   dates: [...]}. Test on 3 real articles.

---

**Next:** [06 - Information Extraction](06-information-extraction.md)
