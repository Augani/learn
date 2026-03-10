# NLP Deep Dive - Track Roadmap

## What This Track Covers

Natural Language Processing beyond just LLMs. You'll learn how text
becomes numbers, how machines extract meaning, and how to build
real NLP systems from the ground up.

```
  +-------------------------------------------------------------+
  |                   NLP DEEP DIVE TRACK                       |
  +-------------------------------------------------------------+
  |                                                             |
  |  FOUNDATIONS (Lessons 1-3)                                  |
  |  +---------------+  +----------------+  +---------------+  |
  |  | Text          |  | Text           |  | Word          |  |
  |  | Preprocessing |->| Representation |->| Embeddings    |  |
  |  +---------------+  +----------------+  +---------------+  |
  |         |                                      |            |
  |         v                                      v            |
  |  CORE NLP TASKS (Lessons 4-8)                              |
  |  +--------+ +-----+ +----------+ +--------+ +-------+     |
  |  |Classif.| | NER | |Info Ext. | |Similar.| |Topics |     |
  |  +--------+ +-----+ +----------+ +--------+ +-------+     |
  |         |                                      |            |
  |         v                                      v            |
  |  GENERATION & UNDERSTANDING (Lessons 9-12)                 |
  |  +--------+ +-----------+ +------+ +----------+           |
  |  |Summariz| |Translation| |  QA  | |Generation|           |
  |  +--------+ +-----------+ +------+ +----------+           |
  |         |                                      |            |
  |         v                                      v            |
  |  PRODUCTION NLP (Lessons 13-16)                            |
  |  +--------+ +-----------+ +--------+ +--------+           |
  |  |Metrics | |Multilingual| |Pipeline| |Capstone|           |
  |  +--------+ +-----------+ +--------+ +--------+           |
  |                                                             |
  +-------------------------------------------------------------+
```

## Prerequisites

- Python 3.9+
- Basic machine learning concepts
- Familiarity with NumPy and pandas
- Completed "LLMs & Transformers" track (recommended, not required)

## Setup

```python
pip install spacy transformers datasets scikit-learn
pip install gensim bertopic sentence-transformers
pip install rouge-score nltk torch
python -m spacy download en_core_web_sm
```

## Lesson Map

| #  | Lesson                  | Key Tools              | Time   |
|----|-------------------------|------------------------|--------|
| 01 | Text Preprocessing      | NLTK, regex, spaCy     | 45 min |
| 02 | Text Representation     | scikit-learn            | 45 min |
| 03 | Word Embeddings         | Gensim, FastText        | 60 min |
| 04 | Text Classification     | sklearn, transformers   | 60 min |
| 05 | Named Entity Recognition| spaCy                   | 45 min |
| 06 | Information Extraction  | spaCy, networkx         | 60 min |
| 07 | Text Similarity         | sentence-transformers   | 45 min |
| 08 | Topic Modeling          | BERTopic, gensim        | 60 min |
| 09 | Summarization           | transformers            | 45 min |
| 10 | Machine Translation     | transformers            | 60 min |
| 11 | Question Answering      | transformers            | 60 min |
| 12 | Text Generation         | transformers            | 45 min |
| 13 | Evaluation Metrics      | rouge-score, nltk       | 45 min |
| 14 | Multilingual NLP        | transformers            | 60 min |
| 15 | Practical NLP Pipeline  | all of the above        | 90 min |
| 16 | Build NLP System        | all of the above        | 120min |

## References

- [reference-tools.md](reference-tools.md) - NLP libraries and when to use each
- [reference-metrics.md](reference-metrics.md) - Evaluation metrics cheat sheet

## How to Use This Track

1. Work through lessons in order -- each builds on the last
2. Run every code example yourself
3. Complete the exercises before moving on
4. Use the reference files when you need a quick lookup
5. The capstone (Lesson 16) ties everything together

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Speech and Language Processing** by Dan Jurafsky and James Martin (3rd Edition draft) — The NLP textbook. *Free at web.stanford.edu/~jurafsky/slp3*
- **Natural Language Processing with Transformers** by Lewis Tunstall, Leandro von Werra, and Thomas Wolf (O'Reilly, Revised Edition 2022) — Practical transformer-based NLP

---

**Next:** [01 - Text Preprocessing](01-text-preprocessing.md)
