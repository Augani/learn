# Reference: NLP Libraries Comparison

## Core Frameworks

```
+--------------------+----------------+------------------+------------------+
| Library            | Best For       | Language         | Key Feature      |
+--------------------+----------------+------------------+------------------+
| HuggingFace        | Models, fine-  | Python           | Model Hub,       |
| Transformers       | tuning, infr.  |                  | 200K+ models     |
+--------------------+----------------+------------------+------------------+
| spaCy              | Production NLP | Python           | Fast pipelines,  |
|                    | pipelines      |                  | 70+ languages    |
+--------------------+----------------+------------------+------------------+
| NLTK               | Education,     | Python           | Corpora, classic |
|                    | prototyping    |                  | algorithms       |
+--------------------+----------------+------------------+------------------+
| Stanza             | Academic NLP,  | Python           | Stanford models, |
|                    | multilingual   |                  | 66 languages     |
+--------------------+----------------+------------------+------------------+
| Flair              | Sequence       | Python           | Stacked embed,   |
|                    | labeling       |                  | state-of-art NER |
+--------------------+----------------+------------------+------------------+
```

## Embedding Libraries

```
+--------------------+----------------+------------------+------------------+
| Library            | Best For       | Speed            | Quality          |
+--------------------+----------------+------------------+------------------+
| sentence-          | Semantic search| Fast (GPU/CPU)   | Excellent        |
| transformers       | similarity     |                  |                  |
+--------------------+----------------+------------------+------------------+
| OpenAI Embeddings  | Production     | API call         | Excellent        |
| (text-embedding-3) | applications   |                  |                  |
+--------------------+----------------+------------------+------------------+
| FastText           | Word vectors,  | Very fast (CPU)  | Good             |
|                    | low resource   |                  |                  |
+--------------------+----------------+------------------+------------------+
| GloVe              | Static word    | Instant (lookup) | Good             |
|                    | embeddings     |                  |                  |
+--------------------+----------------+------------------+------------------+
```

## Vector Databases

```
+--------------------+----------------+------------------+------------------+
| Database           | Type           | Scale            | Best For         |
+--------------------+----------------+------------------+------------------+
| FAISS              | Library        | Billions         | Research, batch  |
| (Facebook)         | (in-memory)    |                  | offline search   |
+--------------------+----------------+------------------+------------------+
| Pinecone           | Managed SaaS   | Millions         | Production,      |
|                    |                |                  | no ops overhead  |
+--------------------+----------------+------------------+------------------+
| Weaviate           | Self-hosted /  | Millions         | Hybrid search    |
|                    | Cloud          |                  | (vector + BM25)  |
+--------------------+----------------+------------------+------------------+
| Qdrant             | Self-hosted /  | Millions         | Filtering +      |
|                    | Cloud          |                  | vector search    |
+--------------------+----------------+------------------+------------------+
| pgvector           | Postgres       | Millions         | Existing Postgres|
|                    | extension      |                  | infrastructure   |
+--------------------+----------------+------------------+------------------+
| ChromaDB           | Embedded       | Thousands        | Prototyping,     |
|                    |                |                  | local dev        |
+--------------------+----------------+------------------+------------------+
```

## Text Processing Tools

```
+--------------------+--------------------------------------------------+
| Task               | Recommended Tool                                 |
+--------------------+--------------------------------------------------+
| Tokenization       | tiktoken (OpenAI), tokenizers (HF), spaCy        |
| Sentence Split     | spaCy, nltk.sent_tokenize, pysbd                |
| Language Detection | langdetect, fasttext, lingua-py                  |
| Spell Check        | pyspellchecker, textblob, symspellpy             |
| Text Cleaning      | clean-text, beautifulsoup4 (HTML)                |
| PDF Extraction     | PyMuPDF, pdfplumber, unstructured                |
| OCR                | Tesseract (pytesseract), EasyOCR, PaddleOCR      |
+--------------------+--------------------------------------------------+
```

## Training & Fine-Tuning

```
+--------------------+--------------------------------------------------+
| Tool               | Best For                                         |
+--------------------+--------------------------------------------------+
| HuggingFace Trainer| Standard fine-tuning with callbacks              |
| PEFT / LoRA        | Parameter-efficient fine-tuning                   |
| TRL                | RLHF, DPO alignment training                    |
| Axolotl            | Easy fine-tuning configuration                    |
| Unsloth            | Fast LoRA fine-tuning (2x speed)                 |
| vLLM               | Fast LLM inference serving                        |
| Ollama             | Local LLM running                                 |
+--------------------+--------------------------------------------------+
```

## Evaluation

```
+--------------------+--------------------------------------------------+
| Metric             | Library / Tool                                   |
+--------------------+--------------------------------------------------+
| BLEU               | nltk, sacrebleu, evaluate (HF)                   |
| ROUGE              | rouge-score, evaluate (HF)                       |
| BERTScore          | bert-score, evaluate (HF)                        |
| Perplexity         | evaluate (HF), lm-evaluation-harness             |
| NER F1             | seqeval, evaluate (HF)                           |
| General benchmarks | lm-evaluation-harness (EleutherAI)               |
+--------------------+--------------------------------------------------+
```

## RAG Frameworks

```
+--------------------+--------------------------------------------------+
| Framework          | Best For                                         |
+--------------------+--------------------------------------------------+
| LangChain          | Complex chains, many integrations                |
| LlamaIndex         | Document indexing, structured data                |
| Haystack           | Production search pipelines                       |
| Vercel AI SDK      | Web app integration (Next.js)                    |
| Semantic Kernel    | Enterprise (.NET / Python)                        |
+--------------------+--------------------------------------------------+
```

## Quick Install Commands

```bash
pip install transformers datasets evaluate accelerate
pip install sentence-transformers
pip install spacy && python -m spacy download en_core_web_sm
pip install nltk && python -c "import nltk; nltk.download('punkt')"
pip install rouge-score bert-score sacrebleu
pip install openai tiktoken
pip install faiss-cpu        # or faiss-gpu
pip install chromadb
pip install langchain langchain-openai
pip install fastapi uvicorn
```

## Model Selection Guide

```
TASK -> RECOMMENDED MODEL

  Embeddings (English):    all-MiniLM-L6-v2 (fast), all-mpnet-base-v2 (accurate)
  Embeddings (Multi):      paraphrase-multilingual-MiniLM-L12-v2
  Classification:          distilbert-base-uncased, roberta-base
  NER:                     dslim/bert-base-NER, xlm-roberta-large-ner-hrl
  Summarization:           facebook/bart-large-cnn, google/pegasus-xsum
  Translation:             Helsinki-NLP/opus-mt-{src}-{tgt}
  QA:                      deepset/roberta-base-squad2
  Generation:              gpt-4o, claude-3, llama-3, mistral
  Reranking:               cross-encoder/ms-marco-MiniLM-L-6-v2
```
