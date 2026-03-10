# Lesson 11: Question Answering

## The Big Analogy: Open-Book vs Closed-Book Exams

```
EXTRACTIVE QA                    GENERATIVE QA
(Open-book exam)                 (Closed-book exam)

  "Where is Paris?"              "Where is Paris?"
       |                              |
       v                              v
  Search the textbook            Recall from memory
       |                              |
       v                              v
  Highlight the answer:          Generate answer:
  "Paris is the capital          "Paris is the capital
   of [France]"                   of France, located in
                                  northern Europe"
  Answer = span in text
  Exact, verifiable              Answer = generated text
                                 Fluent, may hallucinate


OPEN-DOMAIN QA
(Library research)

  "Where is Paris?"
       |
       v
  Search millions of documents (Retriever)
       |
       v
  Find relevant passages
       |
       v
  Extract/generate answer (Reader)
```

## Extractive QA Pipeline

```
EXTRACTIVE QA ARCHITECTURE

  Question: "When was Python created?"
       |
       v
  +----------+
  | Tokenize |    [CLS] When was Python created? [SEP] Context... [SEP]
  +----+-----+
       |
       v
  +----------+
  | BERT /   |    Encode question + context together
  | RoBERTa  |
  +----+-----+
       |
       v
  +----------+
  | Start &  |    Score each token as potential
  | End Head |    start/end of answer span
  +----+-----+
       |
       v
  Answer span: tokens 45-48 = "1991"
```

```python
from transformers import pipeline, AutoTokenizer, AutoModelForQuestionAnswering
import torch

qa_pipeline = pipeline(
    "question-answering",
    model="deepset/roberta-base-squad2",
    device=0 if torch.cuda.is_available() else -1,
)

context = """
Python was created by Guido van Rossum and first released in 1991.
It emphasizes code readability with its notable use of significant
indentation. Python is dynamically typed and garbage-collected.
It supports multiple programming paradigms including structured,
object-oriented, and functional programming.
"""

result = qa_pipeline(
    question="When was Python first released?",
    context=context,
)

print(f"Answer: {result['answer']}")
print(f"Score: {result['score']:.4f}")
print(f"Start: {result['start']}, End: {result['end']}")
```

### Manual Extractive QA

```python
import torch
from transformers import AutoTokenizer, AutoModelForQuestionAnswering

class ExtractiveQA:
    def __init__(self, model_name: str = "deepset/roberta-base-squad2"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForQuestionAnswering.from_pretrained(model_name)
        self.model.eval()

    def answer(
        self,
        question: str,
        context: str,
        max_answer_length: int = 50,
    ) -> dict:
        inputs = self.tokenizer(
            question,
            context,
            return_tensors="pt",
            max_length=512,
            truncation=True,
            return_offsets_mapping=True,
        )

        offset_mapping = inputs.pop("offset_mapping")[0]

        with torch.no_grad():
            outputs = self.model(**inputs)

        start_logits = outputs.start_logits[0]
        end_logits = outputs.end_logits[0]

        question_length = len(
            self.tokenizer.encode(question, add_special_tokens=False)
        )
        context_start = question_length + 2

        start_logits[:context_start] = -float("inf")
        end_logits[:context_start] = -float("inf")

        start_probs = torch.softmax(start_logits, dim=0)
        end_probs = torch.softmax(end_logits, dim=0)

        best_score = -float("inf")
        best_start = 0
        best_end = 0

        for start_idx in range(context_start, len(start_logits)):
            for end_idx in range(start_idx, min(start_idx + max_answer_length, len(end_logits))):
                score = start_probs[start_idx].item() + end_probs[end_idx].item()
                if score > best_score:
                    best_score = score
                    best_start = start_idx
                    best_end = end_idx

        start_char = offset_mapping[best_start][0].item()
        end_char = offset_mapping[best_end][1].item()
        answer_text = context[start_char:end_char]

        return {
            "answer": answer_text,
            "score": best_score / 2,
            "start": start_char,
            "end": end_char,
        }

qa = ExtractiveQA()
result = qa.answer(
    question="Who created Python?",
    context=context,
)
print(f"Answer: {result['answer']}, Score: {result['score']:.4f}")
```

## Open-Domain QA with Retrieval

```
RETRIEVAL-AUGMENTED QA

  Question: "What is the speed of light?"
       |
       v
  +-----------+
  | Retriever |     Search document index
  | (BM25 or  |     Find top-k relevant passages
  |  Dense)   |
  +-----+-----+
        |
        v
  Top passages:
  1. "The speed of light in vacuum is 299,792,458 m/s..."
  2. "Light travels at approximately 300,000 km/s..."
  3. "Einstein showed that nothing can exceed the speed..."
        |
        v
  +-----+-----+
  |  Reader   |     Extract/generate answer from passages
  | (BERT or  |
  |  LLM)     |
  +-----+-----+
        |
        v
  Answer: "299,792,458 m/s"
```

```python
from sentence_transformers import SentenceTransformer
import numpy as np

class SimpleRetriever:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.encoder = SentenceTransformer(model_name)
        self.documents: list[str] = []
        self.embeddings: np.ndarray | None = None

    def index(self, documents: list[str]) -> None:
        self.documents = documents
        self.embeddings = self.encoder.encode(
            documents,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

    def search(self, query: str, top_k: int = 5) -> list[tuple[str, float]]:
        if self.embeddings is None or len(self.documents) == 0:
            return []

        query_embedding = self.encoder.encode(
            [query],
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        scores = np.dot(self.embeddings, query_embedding.T).squeeze()
        top_indices = np.argsort(scores)[::-1][:top_k]

        return [
            (self.documents[idx], float(scores[idx]))
            for idx in top_indices
        ]


class OpenDomainQA:
    def __init__(self):
        self.retriever = SimpleRetriever()
        self.reader = ExtractiveQA()

    def index_documents(self, documents: list[str]) -> None:
        self.retriever.index(documents)

    def answer(self, question: str, top_k: int = 3) -> dict:
        passages = self.retriever.search(question, top_k=top_k)

        best_answer = None
        best_score = -float("inf")

        for passage_text, retrieval_score in passages:
            result = self.reader.answer(question, passage_text)
            combined_score = result["score"] * retrieval_score

            if combined_score > best_score:
                best_score = combined_score
                best_answer = {
                    "answer": result["answer"],
                    "score": combined_score,
                    "source_passage": passage_text[:200],
                    "retrieval_score": retrieval_score,
                    "reader_score": result["score"],
                }

        return best_answer if best_answer else {"answer": "", "score": 0}
```

## Handling Long Documents

```
SLIDING WINDOW FOR LONG CONTEXTS

  Document (5000 tokens)
  +--------------------------------------------------+
  |                                                    |
  |  Window 1 (512 tokens)                            |
  |  [=================]                              |
  |              [=================]                   |
  |              Window 2 (overlapping)               |
  |                          [=================]       |
  |                          Window 3                  |
  +--------------------------------------------------+

  Each window gets scored independently.
  Best answer across all windows wins.
  Overlap ensures we don't miss answers at boundaries.
```

```python
def answer_long_document(
    qa_model: ExtractiveQA,
    question: str,
    document: str,
    window_size: int = 400,
    stride: int = 200,
) -> dict:
    words = document.split()
    windows = []

    for start in range(0, len(words), stride):
        end = min(start + window_size, len(words))
        window_text = " ".join(words[start:end])
        windows.append((window_text, start))

        if end >= len(words):
            break

    best_result = {"answer": "", "score": -1.0}

    for window_text, word_offset in windows:
        result = qa_model.answer(question, window_text)

        if result["score"] > best_result["score"]:
            best_result = {
                "answer": result["answer"],
                "score": result["score"],
                "window_offset": word_offset,
            }

    return best_result
```

## Reading Comprehension Benchmarks

```
COMMON QA DATASETS

  +----------+--------+----------+-----------------------------+
  | Dataset  | Size   | Type     | Description                 |
  +----------+--------+----------+-----------------------------+
  | SQuAD    | 100K+  | Extract  | Wikipedia passages          |
  | SQuAD 2  | 150K+  | Extract  | + unanswerable questions    |
  | NQ       | 300K+  | Open     | Google search questions     |
  | TriviaQA | 95K    | Open     | Trivia questions            |
  | HotpotQA | 113K   | Multi-hop| Requires reasoning          |
  +----------+--------+----------+-----------------------------+
```

## Exercises

1. Build an extractive QA system using a pre-trained model. Test it on 10 question-context pairs and measure exact match and F1 scores.

2. Implement a sliding window approach for answering questions over documents longer than 512 tokens. Compare accuracy with and without overlap.

3. Create an open-domain QA system: index 100 Wikipedia paragraphs, use dense retrieval to find relevant passages, and extract answers with a reader model.

4. Handle unanswerable questions: modify the extractive QA to detect when a question cannot be answered from the given context (score thresholding).

5. Build a multi-hop QA pipeline: given a question like "What country is the birthplace of Python's creator in?", chain two retrieval steps to find the answer.

## Key Takeaways

```
+-------------------------------------------+
| QUESTION ANSWERING                        |
|                                           |
| 1. Extractive QA = find span in text     |
| 2. Open-domain = retrieve then read      |
| 3. Sliding window for long documents     |
| 4. Dense retrieval beats BM25 usually    |
| 5. Score threshold for unanswerable      |
| 6. RAG combines retrieval + generation   |
+-------------------------------------------+
```
