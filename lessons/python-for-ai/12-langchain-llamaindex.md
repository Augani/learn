# Lesson 12: LangChain & LlamaIndex

> LangChain is like a set of LEGO instructions for building with LLMs.
> LlamaIndex is like a librarian who reads all your documents
> so the LLM doesn't have to.

---

## The Problem They Solve

LLMs are powerful but stateless. They don't know your data,
can't browse the web mid-conversation, and forget everything
between calls. These frameworks add memory, tools, and data access.

```
  Without frameworks:           With frameworks:
  ┌────────────────┐            ┌────────────────┐
  │     LLM        │            │     LLM        │
  │  (just text    │            │  + Memory       │
  │   in/out)      │            │  + Tools        │
  └────────────────┘            │  + Your Data    │
                                │  + Web Access   │
                                └────────────────┘
```

---

## LangChain Basics

### Chat Models

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

messages = [
    SystemMessage(content="You are a helpful Python tutor."),
    HumanMessage(content="Explain list comprehensions in one sentence."),
]
response = llm.invoke(messages)
print(response.content)
```

### Prompt Templates

Like Mad Libs for LLMs. You define the structure,
fill in the blanks at runtime.

```python
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert in {domain}. Be concise."),
    ("human", "{question}"),
])

formatted = prompt.invoke({
    "domain": "machine learning",
    "question": "What is gradient descent?",
})
print(formatted.messages)
```

### Output Parsers

```python
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

prompt = ChatPromptTemplate.from_messages([
    ("system", "Extract the following info as JSON with keys: name, language, experience_years"),
    ("human", "{text}"),
])

chain = prompt | llm | JsonOutputParser()

result = chain.invoke({
    "text": "Alice has been writing Python for 5 years and recently started with Rust."
})
print(result)
```

---

## Chains: Composing Steps

Chains link steps together using the pipe operator.
Like a conveyor belt in a factory - each station does one job.

```
  LCEL Chain (LangChain Expression Language):

  prompt ──> llm ──> parser ──> result
    │          │        │
    │  Fill    │ Call   │ Parse
    │  template│ model  │ output
```

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

explain = ChatPromptTemplate.from_messages([
    ("human", "Explain {concept} simply in 2 sentences."),
])

analogy = ChatPromptTemplate.from_messages([
    ("human", "Create a real-world analogy for this: {explanation}"),
])

chain = explain | llm | StrOutputParser()
result = chain.invoke({"concept": "backpropagation"})
print(result)
```

### Sequential Chains

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
from langchain_core.runnables import RunnablePassthrough

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
parser = StrOutputParser()

explain_prompt = ChatPromptTemplate.from_messages([
    ("human", "Explain {concept} in 2 sentences."),
])

quiz_prompt = ChatPromptTemplate.from_messages([
    ("human", "Based on this explanation, create a quiz question:\n{explanation}"),
])

chain = (
    {"explanation": explain_prompt | llm | parser, "concept": RunnablePassthrough()}
    | quiz_prompt
    | llm
    | parser
)

result = chain.invoke({"concept": "transformers in NLP"})
print(result)
```

---

## RAG: Retrieval-Augmented Generation

RAG is like giving someone an open-book exam instead of a closed-book one.
The LLM gets to look up relevant information before answering.

```
  RAG Pipeline:
  ┌──────┐    ┌──────────┐    ┌──────────┐    ┌──────┐
  │ Query│───>│ Retriever│───>│ Context  │───>│ LLM  │
  │      │    │ (search  │    │ + Query  │    │      │
  │      │    │  docs)   │    │ (prompt) │    │      │
  └──────┘    └──────────┘    └──────────┘    └──┬───┘
                                                 │
                                              Answer
                                              (grounded
                                               in docs)
```

### Building a Simple RAG with LangChain

```python
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

documents = [
    "PyTorch uses dynamic computational graphs for automatic differentiation.",
    "NumPy arrays are stored in contiguous memory blocks for fast access.",
    "Scikit-learn provides a consistent API: fit, predict, score.",
    "Pandas DataFrames are like spreadsheets with labeled rows and columns.",
    "The GIL prevents true parallel Python thread execution.",
    "Transformers use self-attention to process all tokens simultaneously.",
]

embeddings = OpenAIEmbeddings()
vectorstore = FAISS.from_texts(documents, embeddings)
retriever = vectorstore.as_retriever(search_kwargs={"k": 2})

prompt = ChatPromptTemplate.from_messages([
    ("system", "Answer based only on this context:\n{context}"),
    ("human", "{question}"),
])

def format_docs(docs):
    return "\n".join(doc.page_content for doc in docs)

chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | ChatOpenAI(model="gpt-4o-mini", temperature=0)
    | StrOutputParser()
)

answer = chain.invoke("How does PyTorch handle gradients?")
print(answer)
```

---

## LlamaIndex: The Data Framework

LlamaIndex specializes in connecting LLMs to your data.
If LangChain is a general toolbox, LlamaIndex is a specialized
data indexing and retrieval system.

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader

documents = SimpleDirectoryReader("./data").load_data()

index = VectorStoreIndex.from_documents(documents)

query_engine = index.as_query_engine()
response = query_engine.query("What are the main findings?")
print(response)
```

### Custom Document Loading

```python
from llama_index.core import Document, VectorStoreIndex

docs = [
    Document(text="PyTorch tensors can live on GPUs for fast computation."),
    Document(text="Hugging Face provides pre-trained transformer models."),
    Document(text="Scikit-learn is best for classical ML on tabular data."),
]

index = VectorStoreIndex.from_documents(docs)
query_engine = index.as_query_engine()
response = query_engine.query("What's good for tabular data?")
print(response)
```

---

## Agents: LLMs That Use Tools

Agents are like giving the LLM hands. Instead of just thinking,
it can take actions: search the web, run code, query databases.

```python
from langchain_openai import ChatOpenAI
from langchain.agents import tool, AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

@tool
def calculate(expression: str) -> str:
    """Evaluate a math expression."""
    try:
        result = eval(expression)
        return str(result)
    except Exception as exc:
        return f"Error: {exc}"

@tool
def word_count(text: str) -> str:
    """Count words in text."""
    return str(len(text.split()))

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant with access to tools."),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

agent = create_openai_tools_agent(llm, [calculate, word_count], prompt)
executor = AgentExecutor(agent=agent, tools=[calculate, word_count], verbose=True)

result = executor.invoke({"input": "What's 2^10 + 3^5?"})
print(result["output"])
```

```
  Agent Decision Loop:
  ┌──────────────────────────────────────┐
  │ 1. LLM sees question                │
  │ 2. Decides which tool to use         │
  │ 3. Calls tool with arguments         │
  │ 4. Gets tool result                  │
  │ 5. Decides: answer or use more tools │
  │ 6. Returns final answer              │
  └──────────────────────────────────────┘
```

---

## Memory: Persistent Conversations

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a Python tutor. Be concise."),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}"),
])

chain = prompt | llm
store = {}

def get_session_history(session_id):
    if session_id not in store:
        store[session_id] = InMemoryChatMessageHistory()
    return store[session_id]

with_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history",
)

config = {"configurable": {"session_id": "user_1"}}
r1 = with_history.invoke({"input": "What is a decorator?"}, config=config)
print(f"Q1: {r1.content}\n")

r2 = with_history.invoke({"input": "Give me an example."}, config=config)
print(f"Q2: {r2.content}")
```

---

## Structured Output

```python
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

class CodeReview(BaseModel):
    issues: list[str] = Field(description="List of issues found")
    severity: str = Field(description="overall severity: low, medium, high")
    suggestion: str = Field(description="Main improvement suggestion")

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
structured_llm = llm.with_structured_output(CodeReview)

result = structured_llm.invoke(
    "Review this Python code: "
    "def f(x): return x+1 if x > 0 else None"
)
print(f"Issues: {result.issues}")
print(f"Severity: {result.severity}")
print(f"Suggestion: {result.suggestion}")
```

---

## Choosing Between Them

```
  Need                          Use
  ────────────────────────────  ──────────────
  General LLM orchestration     LangChain
  Document Q&A, RAG             LlamaIndex
  Agent with tools              LangChain
  Complex data ingestion        LlamaIndex
  Prompt chaining               LangChain
  Structured data extraction    Either
  Production RAG pipeline       Either + vector DB
```

---

## Exercises

1. **RAG Pipeline**: Build a RAG system that answers questions about
   a set of text files. Use LangChain with FAISS. Test with 5 questions
   and verify answers are grounded in the source documents.

2. **Custom Agent**: Create a LangChain agent with 3 custom tools:
   a calculator, a string manipulation tool, and a mock database
   lookup. Test with queries that require multiple tool calls.

3. **Structured Extraction**: Use LangChain's structured output to
   extract structured data from unstructured text (e.g., parse job
   postings into title, company, salary, requirements).

4. **Conversational RAG**: Build a chatbot that maintains conversation
   history AND retrieves from a document store. The bot should
   reference both prior conversation and source documents.

5. **Index Comparison**: Using LlamaIndex, create indexes over the
   same documents with different chunking strategies (100, 500, 1000
   tokens). Compare retrieval quality for the same set of queries.

---

[Next: Lesson 13 - Virtual Environments ->](13-virtual-environments.md)
