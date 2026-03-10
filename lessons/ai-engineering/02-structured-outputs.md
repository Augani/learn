# 02 - Structured Outputs

Getting free text from an LLM is like getting a handwritten
note from a doctor. It might be brilliant, but good luck
parsing it. Structured outputs let you get clean, predictable
data you can actually use in code.

---

## Why Structure Matters

```
WITHOUT STRUCTURE:              WITH STRUCTURE:
"The sentiment is mostly        {"sentiment": "positive",
positive, I'd say about          "confidence": 0.85,
85% confident. The main          "topics": ["battery",
topics are battery life           "screen"]}
and screen quality."

     Hard to parse                  json.loads() and done
```

---

## JSON Mode

The simplest approach: ask the model to respond in JSON.

```python
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o-mini",
    response_format={"type": "json_object"},
    messages=[
        {
            "role": "system",
            "content": (
                "Extract entities from text. "
                "Respond in JSON with keys: "
                "people (list), places (list), dates (list)."
            ),
        },
        {
            "role": "user",
            "content": (
                "Marie Curie moved to Paris in 1891 "
                "to study at the Sorbonne."
            ),
        },
    ],
)

import json
data = json.loads(response.choices[0].message.content)
print(data)
```

---

## Schema Validation with Pydantic

JSON mode gives you JSON, but not guaranteed STRUCTURE.
Pydantic is your safety net. Like a bouncer checking IDs
at the door.

```python
from pydantic import BaseModel, Field
from typing import Literal
import json
from openai import OpenAI


class ReviewAnalysis(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float = Field(ge=0.0, le=1.0)
    topics: list[str]
    summary: str = Field(max_length=100)


client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o-mini",
    response_format={"type": "json_object"},
    messages=[
        {
            "role": "system",
            "content": (
                "Analyze product reviews. Respond in JSON matching "
                "this schema:\n"
                f"{ReviewAnalysis.model_json_schema()}"
            ),
        },
        {
            "role": "user",
            "content": "The battery lasts forever but the screen is dim.",
        },
    ],
)

raw = json.loads(response.choices[0].message.content)
analysis = ReviewAnalysis.model_validate(raw)
print(f"Sentiment: {analysis.sentiment}")
print(f"Confidence: {analysis.confidence}")
print(f"Topics: {analysis.topics}")
```

---

## OpenAI Structured Outputs (Native)

OpenAI now supports Pydantic schemas directly. No more
praying the JSON is valid.

```python
from openai import OpenAI
from pydantic import BaseModel


class CalendarEvent(BaseModel):
    title: str
    date: str
    duration_minutes: int
    attendees: list[str]
    is_recurring: bool


client = OpenAI()

response = client.beta.chat.completions.parse(
    model="gpt-4o-mini",
    messages=[
        {
            "role": "system",
            "content": "Extract calendar events from text.",
        },
        {
            "role": "user",
            "content": (
                "Let's meet with Sarah and Tom next Tuesday "
                "at 2pm for 30 minutes to discuss the roadmap. "
                "Make it a weekly thing."
            ),
        },
    ],
    response_format=CalendarEvent,
)

event = response.choices[0].message.parsed
print(f"Title: {event.title}")
print(f"Attendees: {event.attendees}")
print(f"Recurring: {event.is_recurring}")
```

---

## Function Calling

Function calling is like giving the model a menu of actions
it can request. The model doesn't call the function -- it
tells YOU what to call and with what arguments.

```
+----------+     "call get_weather      +----------+
|          |      for San Francisco"    |          |
|   LLM    | -------------------------> | YOUR APP |
|          |                            |          |
|          | <------------------------- |          |
+----------+     {"temp": 72,           +----------+
                  "condition": "sunny"}       |
                                              v
                                      [actual API call]
```

```python
from openai import OpenAI
import json

client = OpenAI()

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "City name",
                    },
                    "units": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                    },
                },
                "required": ["city"],
            },
        },
    }
]

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "What's the weather in Tokyo?"}
    ],
    tools=tools,
)

tool_call = response.choices[0].message.tool_calls[0]
function_name = tool_call.function.name
arguments = json.loads(tool_call.function.arguments)
print(f"Model wants to call: {function_name}")
print(f"With arguments: {arguments}")
```

---

## Tool Use Loop

The real power: the model calls a tool, gets results, then
reasons about them.

```python
from openai import OpenAI
import json

client = OpenAI()

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Search product catalog",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "max_price": {"type": "number"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_inventory",
            "description": "Check if a product is in stock",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string"},
                },
                "required": ["product_id"],
            },
        },
    },
]


def handle_tool_call(name, args):
    if name == "search_products":
        return json.dumps([
            {"id": "p1", "name": "Widget A", "price": 29.99},
            {"id": "p2", "name": "Widget B", "price": 49.99},
        ])
    elif name == "check_inventory":
        return json.dumps({"in_stock": True, "quantity": 15})
    return json.dumps({"error": "Unknown function"})


def run_conversation(user_message):
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOLS,
        )

        choice = response.choices[0]

        if choice.finish_reason == "stop":
            return choice.message.content

        if choice.message.tool_calls:
            messages.append(choice.message)
            for tc in choice.message.tool_calls:
                result = handle_tool_call(
                    tc.function.name,
                    json.loads(tc.function.arguments),
                )
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })


result = run_conversation(
    "Find me a widget under $40 and check if it's in stock"
)
print(result)
```

---

## Retry with Validation

Models sometimes produce invalid JSON. Build retry logic.

```python
from pydantic import BaseModel, ValidationError
from openai import OpenAI
import json

client = OpenAI()


class TaskExtraction(BaseModel):
    tasks: list[str]
    priority: str
    deadline: str | None


def extract_with_retry(text: str, max_retries: int = 3) -> TaskExtraction:
    for attempt in range(max_retries):
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract tasks from text. Respond in JSON: "
                        f"{TaskExtraction.model_json_schema()}"
                    ),
                },
                {"role": "user", "content": text},
            ],
        )

        try:
            raw = json.loads(response.choices[0].message.content)
            return TaskExtraction.model_validate(raw)
        except (json.JSONDecodeError, ValidationError) as exc:
            if attempt == max_retries - 1:
                raise ValueError(
                    f"Failed after {max_retries} attempts"
                ) from exc

    raise ValueError("Unreachable")


result = extract_with_retry(
    "Need to finish the report by Friday, high priority. "
    "Also update the dashboard."
)
print(result.model_dump_json(indent=2))
```

---

## Choosing Your Approach

```
+-------------------+------------------+------------------+
|                   | Reliability      | Flexibility      |
+-------------------+------------------+------------------+
| JSON mode         | Medium           | High             |
| + Pydantic        | High             | High             |
| Native structured | Very High        | Medium           |
| Function calling  | Very High        | Low (schema)     |
+-------------------+------------------+------------------+

Simple extraction?     -> JSON mode + Pydantic
Critical data path?    -> Native structured outputs
Model needs actions?   -> Function calling
```

---

## Exercises

**Exercise 1: Entity Extractor**
Build a structured entity extractor that takes any text and
returns a Pydantic model with: people, organizations, dates,
locations, and monetary amounts. Include retry logic.

**Exercise 2: Multi-Tool Agent**
Define 3 tools (calculator, dictionary lookup, unit converter)
and build a tool-use loop that handles a conversation needing
all three tools.

**Exercise 3: Schema Evolution**
Build a system that extracts product info into a Pydantic model.
Then add a new field to the schema. Write migration logic that
handles both old and new format responses.

**Exercise 4: Validation Dashboard**
Process 20 text inputs through your structured output pipeline.
Track: success rate, retry count, validation errors, and latency.
Print a summary table at the end.

---

Next: [03 - Evaluation](03-evaluation.md)
