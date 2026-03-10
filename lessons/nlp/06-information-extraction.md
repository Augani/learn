# Lesson 06: Information Extraction

## Analogy: Reading Between the Lines

NER finds the nouns. Information extraction finds the verbs and
relationships connecting them. It's like reading a family tree -- you
don't just want names, you want to know who married whom, who is
whose parent, and who works where.

```
  NER FINDS:                    IE FINDS:
  +--------+                    +--------+  founded  +--------+
  | Elon   |                    | Elon   |---------->| SpaceX |
  | Musk   |                    | Musk   |           +--------+
  +--------+                    +--------+
  +--------+                         |
  | SpaceX |                         | CEO_of
  +--------+                         |
  +--------+                         v
  | 2002   |                    +--------+  in_year  +------+
  +--------+                    | SpaceX |---------->| 2002 |
                                +--------+           +------+
```

## The IE Pipeline

```
  Raw Text
    |
    v
  +--------------------+
  | NER                |  Find entities
  +--------------------+
    |
    v
  +--------------------+
  | Dependency Parsing |  Find grammatical structure
  +--------------------+
    |
    v
  +--------------------+
  | Relation Extraction|  Find relationships between entities
  +--------------------+
    |
    v
  +--------------------+
  | Knowledge Graph    |  Store as structured triples
  +--------------------+
```

## Dependency Parsing

Every sentence has a grammatical tree structure. Dependency parsing
reveals who does what to whom.

```
  "The cat sat on the mat"

           sat (ROOT)
          /    \
        cat    on
        /       \
      The       mat
                /
              the

  DEPENDENCY LABELS:
  The  --det-->  cat
  cat  --nsubj-> sat
  sat  --ROOT
  on   --prep--> sat
  the  --det-->  mat
  mat  --pobj--> on
```

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The engineer designed the bridge in Tokyo.")

for token in doc:
    print(f"  {token.text:12} --{token.dep_:10}--> {token.head.text}")
```

### Visualizing Dependencies

```python
from spacy import displacy

doc = nlp("Apple acquired a startup in San Francisco.")
displacy.render(doc, style="dep", options={"compact": True})
```

## Extracting Subject-Verb-Object Triples

The core of information extraction: who did what to whom.

```
  "Google acquired YouTube in 2006"

  Subject: Google
  Verb:    acquired
  Object:  YouTube
  Time:    2006

  TRIPLE: (Google, acquired, YouTube)
```

```python
import spacy

nlp = spacy.load("en_core_web_sm")

def extract_svo_triples(text):
    doc = nlp(text)
    triples = []

    for token in doc:
        if token.dep_ != "ROOT":
            continue

        verb = token.text
        subjects = []
        objects = []

        for child in token.children:
            if child.dep_ in ("nsubj", "nsubjpass"):
                subjects.append(get_full_phrase(child))
            elif child.dep_ in ("dobj", "attr", "pobj"):
                objects.append(get_full_phrase(child))
            elif child.dep_ == "prep":
                for grandchild in child.children:
                    if grandchild.dep_ == "pobj":
                        objects.append(
                            f"{child.text} {get_full_phrase(grandchild)}"
                        )

        for subj in subjects:
            for obj in objects:
                triples.append((subj, verb, obj))

    return triples

def get_full_phrase(token):
    phrase_parts = []
    for child in token.lefts:
        if child.dep_ in ("compound", "amod", "det"):
            phrase_parts.append(child.text)
    phrase_parts.append(token.text)
    return " ".join(phrase_parts)

sentences = [
    "Tesla manufactures electric vehicles.",
    "Marie Curie discovered radium.",
    "The company hired 500 engineers in Berlin.",
]

for sentence in sentences:
    triples = extract_svo_triples(sentence)
    print(f"  '{sentence}'")
    for s, v, o in triples:
        print(f"    ({s}, {v}, {o})")
```

## Relation Extraction with Transformers

For more complex relationships, use a pre-trained model.

```python
from transformers import pipeline

re_pipeline = pipeline(
    "text2text-generation",
    model="Babelscape/rebel-large"
)

text = (
    "Elon Musk is the CEO of Tesla, which is headquartered "
    "in Austin, Texas. Tesla was founded in 2003 by Martin "
    "Eberhard and Marc Tarpenning."
)

output = re_pipeline(text, max_length=256, num_beams=4)
print(output[0]['generated_text'])
```

## Building a Knowledge Graph

A knowledge graph stores extracted relations as (subject, relation,
object) triples -- nodes connected by edges.

```
  +--------+  founded_by  +----------+
  | Tesla  |<-------------| Eberhard |
  +--------+              +----------+
      |
      | headquartered_in
      v
  +--------+
  | Austin |
  +--------+
      |
      | located_in
      v
  +--------+
  | Texas  |
  +--------+
```

```python
import networkx as nx

knowledge_graph = nx.DiGraph()

triples = [
    ("Tesla", "founded_by", "Martin Eberhard"),
    ("Tesla", "founded_by", "Marc Tarpenning"),
    ("Tesla", "headquartered_in", "Austin"),
    ("Austin", "located_in", "Texas"),
    ("Elon Musk", "CEO_of", "Tesla"),
    ("Tesla", "manufactures", "electric vehicles"),
]

for subject, relation, obj in triples:
    knowledge_graph.add_edge(subject, obj, relation=relation)

print("Nodes:", list(knowledge_graph.nodes()))
print("Edges:", knowledge_graph.number_of_edges())

for source, target, data in knowledge_graph.edges(data=True):
    print(f"  {source} --[{data['relation']}]--> {target}")
```

### Querying the Knowledge Graph

```python
def query_kg(graph, entity, relation=None):
    results = []
    for source, target, data in graph.edges(data=True):
        if source == entity:
            if relation is None or data['relation'] == relation:
                results.append((data['relation'], target))
        if target == entity:
            if relation is None or data['relation'] == relation:
                results.append((data['relation'], source))
    return results

print("Everything about Tesla:")
for rel, ent in query_kg(knowledge_graph, "Tesla"):
    print(f"  {rel}: {ent}")

print("\nWho founded what?")
for rel, ent in query_kg(knowledge_graph, "Martin Eberhard"):
    print(f"  {rel}: {ent}")
```

## Full Pipeline: Text to Knowledge Graph

```python
import spacy
import networkx as nx

nlp = spacy.load("en_core_web_sm")

def text_to_knowledge_graph(texts):
    graph = nx.DiGraph()

    for text in texts:
        doc = nlp(text)
        entities = {ent.text: ent.label_ for ent in doc.ents}

        for token in doc:
            if token.dep_ == "ROOT" and token.pos_ == "VERB":
                subjects = [
                    child for child in token.children
                    if child.dep_ in ("nsubj", "nsubjpass")
                ]
                objects = [
                    child for child in token.children
                    if child.dep_ in ("dobj", "attr")
                ]

                for subj in subjects:
                    subj_text = get_full_phrase(subj)
                    for obj in objects:
                        obj_text = get_full_phrase(obj)
                        graph.add_node(subj_text, type=entities.get(subj_text, "UNKNOWN"))
                        graph.add_node(obj_text, type=entities.get(obj_text, "UNKNOWN"))
                        graph.add_edge(subj_text, obj_text, relation=token.lemma_)

    return graph

texts = [
    "Google acquired YouTube.",
    "Microsoft developed Windows.",
    "Apple designed the iPhone.",
    "Google developed Android.",
]

kg = text_to_knowledge_graph(texts)

for source, target, data in kg.edges(data=True):
    print(f"  ({source}) --[{data['relation']}]--> ({target})")
```

## Exercises

1. Extract all subject-verb-object triples from a Wikipedia paragraph
   about a company. Build a knowledge graph and visualize it.

2. Write a function that extracts "person works at organization"
   relations from text using dependency parsing. Test on 10 sentences
   like "John works at Google" and "The engineer at NASA..."

3. Use the REBEL model to extract relations from a news article. Compare
   the results with your dependency-parsing approach. Which finds more?

4. Build a mini knowledge graph from 5 related Wikipedia paragraphs.
   Implement a query function that answers questions like "Where is
   X headquartered?" and "Who founded Y?"

---

**Next:** [07 - Text Similarity](07-text-similarity.md)
