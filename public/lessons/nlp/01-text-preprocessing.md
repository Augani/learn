# Lesson 01: Text Preprocessing

## Analogy: Preparing Ingredients

Before you cook a meal, you wash vegetables, peel skins, chop everything
into uniform pieces, and discard parts you don't need. Text preprocessing
is identical -- raw text is messy, and models need clean, uniform input.

```
  RAW TEXT                          PREPROCESSED TEXT
  +------------------------+       +-------------------+
  | "The CATS were         |       | ["cat", "sit",    |
  |  sitting on 3 mats!!!" | ----> |  "mat"]           |
  +------------------------+       +-------------------+
       ^                                ^
       |                                |
  Dirty produce               Washed, chopped, ready
```

## The Preprocessing Pipeline

```
  Raw Text
    |
    v
  +------------------+
  | Lowercasing      |  "The CAT" -> "the cat"
  +------------------+
    |
    v
  +------------------+
  | Remove Noise     |  Strip HTML, URLs, special chars
  +------------------+
    |
    v
  +------------------+
  | Tokenization     |  "the cat sat" -> ["the", "cat", "sat"]
  +------------------+
    |
    v
  +------------------+
  | Stop Word        |  Remove "the", "is", "a", etc.
  | Removal          |
  +------------------+
    |
    v
  +------------------+
  | Stemming OR      |  "running" -> "run"
  | Lemmatization    |  "better"  -> "good" (lemma only)
  +------------------+
    |
    v
  Clean Tokens
```

## Step 1: Lowercasing and Noise Removal

```python
import re

def clean_text(text):
    text = text.lower()
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'http\S+|www\.\S+', '', text)
    text = re.sub(r'[^a-z\s]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

raw = "<p>Check out https://example.com! NLP is AMAZING!!!</p>"
print(clean_text(raw))
```

Output: `check out  nlp is amazing`

## Step 2: Tokenization

Tokenization splits text into individual units (tokens). Think of it
like chopping a sentence into word-sized pieces.

```
  "The cat sat on the mat"
       |
       v
  ["The", "cat", "sat", "on", "the", "mat"]
```

Three approaches, each with different granularity:

```
  WORD TOKENS         SENTENCE TOKENS        SUBWORD TOKENS
  +-----------+       +---------------+       +-------------+
  | "don't"   |       | Sentence 1.   |       | "un"        |
  | -> ["do", |       | Sentence 2.   |       | "##believ"  |
  |    "n't"] |       | Sentence 3.   |       | "##able"    |
  +-----------+       +---------------+       +-------------+
```

```python
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize

nltk.download('punkt_tab', quiet=True)

text = "Dr. Smith didn't believe it. The results were incredible!"

words = word_tokenize(text)
print("Words:", words)

sentences = sent_tokenize(text)
print("Sentences:", sentences)
```

### Tokenization with spaCy

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Dr. Smith didn't believe it.")

for token in doc:
    print(f"{token.text:12} | is_stop={token.is_stop} | is_punct={token.is_punct}")
```

## Step 3: Stop Word Removal

Stop words are the "filler" words -- like peeling away the skin to get
to the fruit underneath. Words like "the", "is", "at" carry little
meaning on their own.

```
  BEFORE:  ["the", "cat", "is", "sitting", "on", "the", "mat"]
                 |                    |                     |
  AFTER:         v                    v                     v
           [      "cat",        "sitting",             "mat"]
```

```python
from nltk.corpus import stopwords

nltk.download('stopwords', quiet=True)
stop_words = set(stopwords.words('english'))

tokens = ["the", "cat", "is", "sitting", "on", "the", "mat"]
filtered = [t for t in tokens if t not in stop_words]
print(filtered)
```

**Warning:** Don't blindly remove stop words for every task. For
sentiment analysis, "not" is critical ("not good" vs "good"). For
search, they may matter less.

## Step 4: Stemming vs Lemmatization

Both reduce words to a base form, but they work differently:

```
  STEMMING (Crude chop)            LEMMATIZATION (Smart lookup)
  +---------------------+         +-------------------------+
  | "running"  -> "run"  |         | "running"  -> "run"     |
  | "runner"   -> "runner"|        | "runner"   -> "runner"   |
  | "better"   -> "better"|       | "better"   -> "good"     |
  | "studies"  -> "studi" |        | "studies"  -> "study"    |
  | "easily"   -> "easili"|        | "easily"   -> "easily"   |
  +---------------------+         +-------------------------+
       ^                                 ^
       |                                 |
  Just chops suffixes            Uses dictionary + POS tags
  Fast but imprecise             Slower but accurate
```

```python
from nltk.stem import PorterStemmer, WordNetLemmatizer

nltk.download('wordnet', quiet=True)

stemmer = PorterStemmer()
lemmatizer = WordNetLemmatizer()

words = ["running", "better", "studies", "geese", "was"]

for word in words:
    stem = stemmer.stem(word)
    lemma = lemmatizer.lemmatize(word, pos='v')
    print(f"{word:12} | stem={stem:10} | lemma={lemma}")
```

## Step 5: Regex for Text Extraction

Regular expressions are your Swiss Army knife for text patterns.
Like having a metal detector that finds specific shapes in the sand.

```python
import re

text = "Contact us at support@company.com or sales@company.com. Call 555-1234."

emails = re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', text)
print("Emails:", emails)

phones = re.findall(r'\d{3}-\d{4}', text)
print("Phones:", phones)
```

### Common Regex Patterns for NLP

```
  PATTERN              MATCHES               EXAMPLE
  +------------------+---------------------+------------------+
  | \b\w+\b          | Whole words          | "cat" in "cat!"  |
  | [A-Z][a-z]+      | Capitalized words    | "London"          |
  | \d+\.\d+         | Decimal numbers      | "3.14"            |
  | #\w+             | Hashtags             | "#nlp"            |
  | @\w+             | Mentions             | "@user"           |
  +------------------+---------------------+------------------+
```

## Putting It All Together

```python
import re
import spacy

nlp = spacy.load("en_core_web_sm")

def preprocess_pipeline(text):
    text = text.lower()
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'http\S+', '', text)
    text = re.sub(r'[^a-z\s]', '', text)

    doc = nlp(text)
    tokens = [
        token.lemma_
        for token in doc
        if not token.is_stop and not token.is_punct and len(token.text) > 1
    ]
    return tokens

raw = "<p>The runners were QUICKLY running towards the 3 finish lines!</p>"
print(preprocess_pipeline(raw))
```

## When NOT to Preprocess

```
  TASK                    SKIP THESE STEPS
  +---------------------+----------------------------------+
  | Sentiment Analysis  | Don't remove "not", "never"      |
  | NER                 | Don't lowercase proper nouns     |
  | Machine Translation | Keep everything -- context matters|
  | Transformer Models  | They have their own tokenizers   |
  +---------------------+----------------------------------+
```

## Exercises

1. Write a function that extracts all hashtags and mentions from a tweet,
   then returns the cleaned tweet text without them.

2. Build a preprocessing pipeline that handles messy product reviews:
   strip HTML, normalize whitespace, remove URLs, tokenize, remove stop
   words, and lemmatize. Test it on 5 sample reviews.

3. Compare the output of `PorterStemmer`, `SnowballStemmer`, and spaCy's
   lemmatizer on this list: ["organizing", "organization", "organized",
   "better", "best", "mice", "was", "been"]. Which gives the most
   useful results for a search engine?

4. Write a regex that extracts all monetary amounts from text like
   "$1,234.56" or "USD 500" or "1000 dollars".

---

**Next:** [02 - Text Representation](02-text-representation.md)
