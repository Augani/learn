# Lesson 15: Context Windows, RAG, and Memory

An LLM can only see what's in its context window. It has no persistent
memory, no access to the internet, and no way to look up facts it
wasn't trained on. This lesson covers the fundamental limitation of
context windows, and the engineering techniques -- especially RAG --
that work around them.

---

## The Context Window: What the Model Can See

The context window is the total number of tokens the model can process
in a single forward pass. Everything -- the system prompt, conversation
history, user's message, AND the model's response -- must fit within
this window.

```
┌──────────────────────────────────────────────────────┐
│              Context Window (e.g., 200K tokens)       │
│                                                       │
│  ┌─────────────┐                                     │
│  │ System      │  "You are a helpful assistant..."   │
│  │ Prompt      │  (~200-2000 tokens)                 │
│  └─────────────┘                                     │
│  ┌─────────────┐                                     │
│  │ Conversation│  Previous messages back and forth    │
│  │ History     │  (~0-100K tokens)                    │
│  └─────────────┘                                     │
│  ┌─────────────┐                                     │
│  │ User's      │  The current question               │
│  │ Message     │  (~10-10K tokens)                    │
│  └─────────────┘                                     │
│  ┌─────────────┐                                     │
│  │ Model's     │  Generated response                 │
│  │ Response    │  (~100-4K tokens)                    │
│  └─────────────┘                                     │
│                                                       │
│  Total of all sections must be < context window       │
└──────────────────────────────────────────────────────┘
```

### Context Windows Over Time

```
┌──────────────────┬────────────────┬─────────────────────┐
│ Model            │ Context Window │ Approximate Pages   │
├──────────────────┼────────────────┼─────────────────────┤
│ GPT-2 (2019)       │ 1,024 tokens     │ ~1.5 pages        │
│ GPT-3 (2020)       │ 2,048 tokens     │ ~3 pages          │
│ GPT-3.5 Turbo (2023)│ 16,384 tokens   │ ~24 pages         │
│ GPT-4 (2023)       │ 8K-32K tokens    │ ~12-49 pages      │
│ GPT-4 Turbo (2023) │ 128,000 tokens   │ ~190 pages        │
│ Claude 3 (2024)    │ 200,000 tokens   │ ~300 pages        │
│ Gemini 1.5 (2024)  │ 1,000,000 tokens │ ~1500 pages       │
└──────────────────┴────────────────┴─────────────────────┘

Roughly: 1 token ≈ 0.75 words, 1 page ≈ 500 words ≈ 670 tokens
```

---

## Why Context Windows Are Limited

### The Quadratic Cost of Attention

Standard self-attention computes a score between EVERY pair of tokens.
If you have n tokens, that's n * n = n^2 attention scores.

```
Context length     Attention computations     Memory for KV cache
───────────────    ──────────────────────     ──────────────────
1,000 tokens       1,000,000                  ~2.6 GB
10,000 tokens      100,000,000                ~26 GB
100,000 tokens     10,000,000,000             ~260 GB
1,000,000 tokens   1,000,000,000,000          ~2,600 GB

10x more tokens → 100x more computation!
```

**Analogy:** At a dinner party of 10 people, everyone can talk to
everyone (100 conversations). At a party of 100 people, that's 10,000
conversations. At 1,000 people, it's a million. The number of
interactions grows quadratically.

### Techniques for Longer Context

Researchers have developed methods to reduce the quadratic cost:

**Sliding Window Attention:**
Each token only attends to the nearest W tokens instead of all tokens.
Cost: O(n * W) instead of O(n^2).

```
Full attention (n=8):        Sliding window (W=3):

Token can attend to:         Token can attend to:
1: [1]                       1: [1]
2: [1,2]                     2: [1,2]
3: [1,2,3]                   3: [1,2,3]
4: [1,2,3,4]                 4: [2,3,4]
5: [1,2,3,4,5]               5: [3,4,5]
6: [1,2,3,4,5,6]             6: [4,5,6]
7: [1,2,3,4,5,6,7]           7: [5,6,7]
8: [1,2,3,4,5,6,7,8]         8: [6,7,8]

Full: tokens see everything   Window: tokens see only nearby
      O(n^2)                          O(n * W)
```

Mistral uses sliding window attention. Information propagates through
multiple layers -- layer 1 sees local context, layer 2 sees wider
context through the representations built by layer 1, and so on.

**Sparse Attention:**
Only compute attention for a subset of token pairs (local + global
patterns). Used in models like Longformer and BigBird.

**Ring Attention:**
Distribute the sequence across multiple GPUs, with each GPU processing
a chunk and passing KV information around in a ring pattern. Enables
arbitrarily long sequences given enough GPUs.

**Flash Attention:**
Not about reducing the theoretical cost, but about making standard
attention dramatically faster through better GPU memory access patterns.
Avoids materializing the full n * n attention matrix in GPU memory.
Now standard in virtually all transformer implementations.

---

## The Fundamental Problem: No Persistent Memory

LLMs have no memory between conversations. Every new conversation
starts from scratch. The model knows only what's in:
1. Its weights (learned during training)
2. The current context window

```
Conversation 1:
  User: "My name is Alice and I'm building a cooking app."
  AI: "Nice to meet you, Alice! I'd be happy to help..."

Conversation 2 (new session):
  User: "How's my app coming along?"
  AI: "I don't have any context about an app you're building.
       Could you tell me more?"
  (Completely forgotten everything from Conversation 1)
```

**Analogy:** Talking to someone with severe amnesia. Every time you
start a conversation, they have no memory of any previous interaction.
You have to re-introduce yourself and re-explain the context every
time.

### Why This Is Hard to Fix

- **Weights are frozen after training.** You can't update them for
  each user.
- **Context window is finite.** You can't fit all past conversations.
- **Fine-tuning per user** would be prohibitively expensive and
  create privacy/safety issues.

---

## RAG: Retrieval-Augmented Generation

RAG is the most practical solution to the "LLM knows nothing beyond
its training data" problem. Instead of hoping the model memorized
the right facts, you LOOK UP the facts and include them in the prompt.

### The Core Idea

```
WITHOUT RAG:
  User: "What's our company's refund policy?"
  LLM: "I don't have access to your company's policies.
        Generally, most companies offer 30-day returns..."
  (Guessing based on training data)

WITH RAG:
  1. Search company knowledge base for "refund policy"
  2. Find: "Full refund within 90 days for unused items.
     50% refund for opened items within 30 days..."
  3. Include this in the prompt

  User: "What's our company's refund policy?"
  LLM: "According to your policy, customers can get a full
        refund within 90 days for unused items, or a 50%
        refund for opened items within 30 days."
  (Accurate, grounded in actual source)
```

**Analogy:** Imagine you're a customer support agent. Without RAG,
you're answering from memory (unreliable). With RAG, you have a search
engine for your company's documentation and you look up the answer
before responding (reliable).

### How RAG Works: The Full Pipeline

```
┌──────────────────────────────────────────────────────┐
│              RAG Pipeline                             │
│                                                       │
│  INDEXING (done once, ahead of time):                │
│                                                       │
│  Your documents                                      │
│  ┌──────────┐                                        │
│  │ Doc 1    │──┐                                     │
│  │ Doc 2    │──┤──→ Split into chunks (500-1000 tokens)│
│  │ Doc 3    │──┤                                     │
│  │ ...      │──┘         │                           │
│  └──────────┘            ▼                           │
│                    Embed each chunk                   │
│                    (text → vector)                    │
│                          │                           │
│                          ▼                           │
│                    Store in vector DB                 │
│                    ┌────────────────┐                │
│                    │ Chunk 1: [0.2, 0.8, ...]        │
│                    │ Chunk 2: [0.5, 0.1, ...]        │
│                    │ Chunk 3: [0.9, 0.3, ...]        │
│                    │ ...                             │
│                    └────────────────┘                │
│                                                       │
│                                                       │
│  RETRIEVAL (at query time):                          │
│                                                       │
│  User question: "What's the refund policy?"          │
│         │                                            │
│         ▼                                            │
│  Embed the question → [0.3, 0.7, ...]               │
│         │                                            │
│         ▼                                            │
│  Find most similar chunks in vector DB               │
│  (cosine similarity search)                          │
│         │                                            │
│         ▼                                            │
│  Top 3 relevant chunks retrieved                     │
│         │                                            │
│         ▼                                            │
│  ┌─────────────────────────────────┐                │
│  │ System: You are a helpful agent │                │
│  │ Context:                        │                │
│  │   [Retrieved chunk 1]           │                │
│  │   [Retrieved chunk 2]           │                │
│  │   [Retrieved chunk 3]           │                │
│  │ User: What's the refund policy? │                │
│  └───────────────┬─────────────────┘                │
│                  │                                    │
│                  ▼                                    │
│  LLM generates answer grounded in the context        │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Step 1: Chunking Documents

Raw documents are too long to embed as single vectors. Split them into
overlapping chunks:

```python
def chunk_document(text, chunk_size=500, overlap=50):
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start = end - overlap
    return chunks
```

Chunk size matters:
- **Too small** (100 tokens): loses context, retrieves fragments
- **Too large** (2000 tokens): wastes context window, dilutes relevance
- **Sweet spot**: 200-1000 tokens depending on document type

### Step 2: Creating Embeddings

An embedding model converts text into a dense vector that captures its
meaning. Similar texts have similar vectors.

```python
from openai import OpenAI

client = OpenAI()

def embed_text(text):
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

chunk_vector = embed_text("Our refund policy allows returns within 90 days.")
query_vector = embed_text("How do I return a product?")

# These vectors will be similar (high cosine similarity)
# because they're about the same topic
```

### Step 3: Vector Database

Store the embeddings in a specialized database optimized for similarity
search:

```python
import chromadb

client = chromadb.Client()
collection = client.create_collection("company_docs")

collection.add(
    documents=["Refund policy: 90 days...", "Shipping: 3-5 days...", ...],
    ids=["doc1", "doc2", ...],
    embeddings=[embed_text(doc) for doc in documents]
)

results = collection.query(
    query_embeddings=[embed_text("How do I return a product?")],
    n_results=3
)
```

Popular vector databases:

```
┌──────────────────┬──────────────────┬──────────────────────┐
│ Database         │ Type             │ Best For             │
├──────────────────┼──────────────────┼──────────────────────┤
│ ChromaDB         │ Lightweight      │ Prototyping, small   │
│ Pinecone         │ Managed cloud    │ Production, managed  │
│ Weaviate         │ Open source      │ Self-hosted, features│
│ pgvector         │ Postgres ext.    │ Already using PG     │
│ Qdrant           │ Open source      │ Performance          │
│ FAISS            │ Library (Meta)   │ Research, in-memory  │
└──────────────────┴──────────────────┴──────────────────────┘
```

### Step 4: Similarity Search

**Cosine similarity** measures how similar two vectors are by the angle
between them:

```
cosine_similarity(A, B) = (A · B) / (|A| × |B|)

Value range: -1 to 1
  1.0  = identical meaning
  0.8+ = very similar
  0.5  = somewhat related
  0.0  = unrelated
 -1.0  = opposite meaning
```

```
Query: "How do I get a refund?"

Chunk                              Cosine Similarity
─────                              ─────────────────
"Refund policy: full refund..."    0.92 ← most relevant
"Returns must be in original..."   0.87
"Customer support hours..."        0.45
"Our CEO founded the company..."   0.12 ← irrelevant
```

### Step 5: Augment the Prompt

Combine retrieved chunks with the user's question:

```python
def rag_prompt(question, retrieved_chunks):
    context = "\n\n".join(retrieved_chunks)
    return f"""Answer the question based on the following context.
If the context doesn't contain the answer, say so.

Context:
{context}

Question: {question}

Answer:"""

prompt = rag_prompt(
    "How do I get a refund?",
    ["Refund policy: Full refund within 90 days...",
     "Returns must be in original packaging..."]
)

response = llm.generate(prompt)
```

---

## RAG vs Fine-Tuning: When to Use Which

```
┌──────────────────┬───────────────────┬───────────────────┐
│                  │ RAG               │ Fine-Tuning        │
├──────────────────┼───────────────────┼───────────────────┤
│ Knowledge source │ External docs     │ Baked into weights │
│ Update frequency │ Real-time         │ Retrain needed     │
│ Setup cost       │ Low               │ Medium-high        │
│ Ongoing cost     │ Per-query retrieval│ One-time training  │
│ Accuracy         │ High (cited)      │ Medium (memorized) │
│ Hallucination    │ Lower (grounded)  │ Higher             │
│ Best for         │ Facts, policies,  │ Style, format,     │
│                  │ current info      │ domain expertise   │
│ Works with       │ Any LLM           │ Specific model     │
└──────────────────┴───────────────────┴───────────────────┘

Rule of thumb:
- Use RAG when: facts change, sources matter, accuracy is critical
- Use fine-tuning when: behavior/style needs to change, not just knowledge
- Use both when: you need domain expertise AND current facts
```

**Analogy:** RAG is like giving someone a reference book to look up
answers. Fine-tuning is like sending them to a training course. The
reference book is always up to date and citable. The training course
changes how they think and communicate.

---

## Tool Use / Function Calling

Another way to give LLMs access to the outside world: let them call
tools and APIs.

```
User: "What's the weather in Tokyo right now?"

WITHOUT tools:
  LLM: "I don't have access to current weather data.
        Generally, Tokyo in February is cold..."

WITH tools:
  LLM recognizes it needs weather data
  → Calls: get_weather(location="Tokyo")
  → API returns: {"temp": 8, "condition": "cloudy"}
  → LLM: "The current weather in Tokyo is 8°C and cloudy."
```

### How Function Calling Works

```
┌────────────────────────────────────────────────────┐
│  1. Define available tools:                         │
│                                                     │
│  tools = [{                                         │
│    "name": "get_weather",                           │
│    "description": "Get current weather",            │
│    "parameters": {                                  │
│      "location": {"type": "string"}                 │
│    }                                                │
│  }]                                                 │
│                                                     │
│  2. LLM decides to call a tool:                     │
│                                                     │
│  LLM output: {                                      │
│    "tool_call": "get_weather",                      │
│    "arguments": {"location": "Tokyo"}               │
│  }                                                  │
│                                                     │
│  3. Your code executes the tool:                    │
│                                                     │
│  result = get_weather("Tokyo")                      │
│  # → {"temp": 8, "condition": "cloudy"}             │
│                                                     │
│  4. Feed result back to LLM:                        │
│                                                     │
│  LLM generates final response using the result      │
│                                                     │
└────────────────────────────────────────────────────┘
```

Common tools LLMs can use:
- Web search (find current information)
- Code execution (run Python, do math)
- Database queries (look up records)
- API calls (weather, stock prices, etc.)
- File operations (read/write documents)

---

## Agents: LLMs That Plan and Act

An **agent** is an LLM that can plan multi-step tasks, use tools, and
iterate until a goal is achieved.

```
User: "Find the cheapest flight from NYC to London next month,
       book it, and add it to my calendar."

Agent reasoning:
  1. I need to search for flights → call flight_search()
  2. Compare results → pick cheapest
  3. Book the flight → call book_flight()
  4. Get confirmation details
  5. Add to calendar → call add_calendar_event()
  6. Report back to user

Each step: LLM generates thought + action,
          observes result, decides next step
```

### The ReAct Pattern

Most agents follow the ReAct (Reason + Act) pattern:

```
┌─────────────────────────────────────────────────────┐
│                  Agent Loop                          │
│                                                      │
│  Thought: "I need to find flight prices first."      │
│  Action: search_flights("NYC", "London", "March")    │
│  Observation: [Flight 1: $450, Flight 2: $380, ...]  │
│                                                      │
│  Thought: "Flight 2 is cheapest at $380. I should    │
│            book this one."                            │
│  Action: book_flight("Flight 2", passenger_info)     │
│  Observation: "Booking confirmed, ref: ABC123"       │
│                                                      │
│  Thought: "Now I need to add this to the calendar."  │
│  Action: add_calendar("London Trip", "March 15-20")  │
│  Observation: "Calendar event created."              │
│                                                      │
│  Thought: "Task complete. Let me summarize."         │
│  Final answer: "I've booked Flight 2 for $380..."    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## The Memory Problem: Current Solutions

Different approaches to giving LLMs memory:

### 1. Conversation History in Context

The simplest approach: include previous messages in the context window.

```
[System prompt]
[User message 1]
[Assistant response 1]
[User message 2]
[Assistant response 2]
...
[Current user message]
```

Problem: context fills up. With a 4K window, you can store maybe 5-10
exchanges before running out of space.

### 2. Conversation Summarization

When history gets too long, summarize older messages:

```
Original: 50 messages of conversation (8000 tokens)
Summary:  "The user is building a cooking app in React.
           We discussed database schema, API design, and
           authentication. Key decisions: PostgreSQL,
           REST API, JWT tokens." (100 tokens)
```

You keep recent messages in full and older ones as summaries. This
preserves important context while fitting in the window.

### 3. External Memory Store

Store conversation history and user preferences in a database.
Retrieve relevant memories when needed (similar to RAG but for
personal context).

```
User says: "How's my cooking app going?"

Memory search finds:
- [2 days ago] "Discussed adding a recipe search feature"
- [1 week ago] "User chose PostgreSQL for the database"
- [2 weeks ago] "User is building a cooking app in React"

These are injected into the context, giving the LLM
relevant personal history.
```

### 4. Fine-Tuning (Per-User or Per-Domain)

Train the model on user-specific or domain-specific data. The
"memory" becomes part of the model's weights. Expensive and
impractical for most use cases.

---

## Building a Simple RAG System

Here's a complete, minimal RAG pipeline:

```python
from openai import OpenAI
import numpy as np

client = OpenAI()

def embed(text):
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return np.array(response.data[0].embedding)

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

documents = [
    "Our return policy allows returns within 90 days of purchase.",
    "Shipping takes 3-5 business days for domestic orders.",
    "We accept Visa, Mastercard, and PayPal for payment.",
    "Customer support is available Monday through Friday, 9am-5pm.",
    "Premium members get free shipping on all orders over $25.",
]

doc_embeddings = [embed(doc) for doc in documents]

def retrieve(query, top_k=2):
    query_embedding = embed(query)
    scores = [cosine_similarity(query_embedding, de) for de in doc_embeddings]
    ranked = sorted(enumerate(scores), key=lambda x: -x[1])
    return [(documents[i], score) for i, score in ranked[:top_k]]

def ask(question):
    retrieved = retrieve(question)
    context = "\n".join([doc for doc, _ in retrieved])

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content":
             f"Answer based on this context:\n{context}\n"
             f"If the context doesn't help, say so."},
            {"role": "user", "content": question}
        ]
    )
    return response.choices[0].message.content

print(ask("Can I return something I bought 2 months ago?"))
print(ask("Do you take American Express?"))
```

---

## Thought Experiments

1. **The Lost Context Problem:** You're in a 50-message conversation
   with an AI about your project. The context window fills up and
   older messages are dropped. You reference something from message 3.
   The AI has no idea what you're talking about. How would you design
   a system to handle this gracefully?

2. **RAG Failure Modes:** Your RAG system retrieves a chunk that says
   "Our old policy was 30-day returns" and another that says "Updated
   to 90-day returns effective January 2024." The LLM might cite
   either. How do you ensure it uses the most current information?

3. **Embedding Quality:** Two chunks: "Python is a programming
   language" and "The python is a large snake." A user asks about
   Python code. Both have high similarity to the query. How would you
   improve retrieval to prefer the programming chunk?

4. **Agent Safety:** An agent has access to tools for email, calendar,
   and file management. A user says "Clean up my inbox." The agent
   deletes 500 emails it considers unimportant. Was this safe? How
   would you design guardrails?

5. **The Memory Dilemma:** An AI with persistent memory could be more
   helpful (remembering your preferences, project context). But it
   also raises privacy concerns (what if it remembers something you
   want forgotten?). How would you balance helpfulness vs privacy?

---

## Key Takeaways

1. **Context windows are limited** by the quadratic cost of attention.
   Techniques like sliding window and Flash Attention help but don't
   eliminate the constraint.
2. **LLMs have no persistent memory** between conversations. Everything
   must fit in the context window or be retrieved at query time.
3. **RAG (Retrieval-Augmented Generation)** solves the knowledge
   problem by looking up relevant documents and including them in
   the prompt.
4. **The RAG pipeline:** chunk documents, embed them, store in a
   vector database, retrieve similar chunks at query time, add to
   prompt.
5. **RAG vs fine-tuning:** RAG for dynamic knowledge and citations,
   fine-tuning for behavior and style changes.
6. **Tool use** lets LLMs call APIs and access real-time information.
7. **Agents** combine LLMs with tools and planning to execute
   multi-step tasks autonomously.

Next: [Lesson 16 — The Modern LLM Landscape](./16-modern-landscape.md)
